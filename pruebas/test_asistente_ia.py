"""Pruebas del intérprete de IA (asistente_ia.py) y de /api/asistente en servidor.py, con un cliente simulado:
no llaman a la API ni gastan créditos. Uso: python -m unittest discover pruebas
"""
import functools
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import asistente_ia  # noqa: E402
import servidor  # noqa: E402

JSON = {"Content-Type": "application/json", "Host": "localhost:8080"}


class ClienteFalso:
    """Imita client.beta.messages.create: guarda lo que se le pidió y devuelve la salida indicada."""

    def __init__(self, salida=None, parada="end_turn", error=None):
        self.salidas = salida if isinstance(salida, list) else [salida]
        self.parada, self.error, self.pedidos = parada, error, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._crear))

    def _crear(self, **kwargs):
        self.pedidos.append(kwargs)
        if self.error:
            raise self.error
        salida = self.salidas[min(len(self.pedidos), len(self.salidas)) - 1]
        uso = SimpleNamespace(input_tokens=100, output_tokens=20, cache_read_input_tokens=90, cache_creation_input_tokens=0)
        return SimpleNamespace(stop_reason=self.parada, usage=uso, content=[SimpleNamespace(type="text", text=json.dumps(salida))])


def salida(**cambios):
    base = {"intencion": "iniciar_tramite", "tramite": 0, "candidatos": [], "datos": [], "respuesta": "", "fuente": "ninguna"}
    return {**base, **cambios}


def cuerpo(mensaje="necesito mis antecedentes penales", **contexto):
    return json.dumps({"mensaje": mensaje, "contexto": {"canal": "web", "sesion": True, **contexto}}).encode()


class Base(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory()
        self.registro_original = asistente_ia.REGISTRO
        asistente_ia.REGISTRO = Path(self.temporal.name) / "asistente.jsonl"
        asistente_ia._peticiones.clear()
        os.environ.pop("SIMPLE_IA", None)
        os.environ.pop("SIMPLE_ORIGENES", None)

    def tearDown(self):
        asistente_ia.REGISTRO = self.registro_original
        self.temporal.cleanup()


class Controles(Base):
    def test_sin_sdk_responde_503(self):
        original = asistente_ia._cliente_anthropic
        asistente_ia._cliente_anthropic = lambda: None
        try:
            estado, datos = asistente_ia.responder(cuerpo(), JSON, "1.1.1.1")
        finally:
            asistente_ia._cliente_anthropic = original
        self.assertEqual((estado, datos["modo"]), (503, "sin_ia"))

    def test_apagada(self):
        os.environ["SIMPLE_IA"] = "0"
        self.assertEqual(asistente_ia.responder(cuerpo(), JSON, "1.1.1.1", ClienteFalso(salida()))[0], 503)

    def test_rechaza_otro_origen_tipo_y_peticiones_malas(self):
        cliente = ClienteFalso(salida())
        self.assertEqual(asistente_ia.responder(cuerpo(), {**JSON, "Origin": "https://malo.example"}, "1", cliente)[0], 403)
        self.assertEqual(asistente_ia.responder(cuerpo(), {"Content-Type": "text/plain"}, "1", cliente)[0], 415)
        self.assertEqual(asistente_ia.responder(b"{", JSON, "1", cliente)[0], 400)
        self.assertEqual(asistente_ia.responder(cuerpo("x" * 1001), JSON, "1", cliente)[0], 400)
        self.assertEqual(asistente_ia.responder(b"x" * (asistente_ia.MAX_CUERPO + 1), JSON, "1", cliente)[0], 413)
        self.assertEqual(cliente.pedidos, [], "nada de esto debe llegar a la IA")

    def test_mismo_origen_se_acepta(self):
        estado, _ = asistente_ia.responder(cuerpo(), {**JSON, "Origin": "http://localhost:8080"}, "1", ClienteFalso(salida()))
        self.assertEqual(estado, 200)

    def test_otros_origenes_solo_con_simple_origenes(self):
        app = {**JSON, "Origin": "https://localhost"}
        self.assertEqual(asistente_ia.responder(cuerpo(), app, "1", ClienteFalso(salida()))[0], 403, "por defecto, ninguno")
        self.assertEqual(asistente_ia.cabeceras_cors(app), {"Vary": "Origin"})
        os.environ["SIMPLE_ORIGENES"] = "https://localhost, Capacitor://localhost/"
        self.assertEqual(asistente_ia.responder(cuerpo(), app, "1", ClienteFalso(salida()))[0], 200)
        self.assertEqual(asistente_ia.responder(cuerpo(), {**JSON, "Origin": "capacitor://localhost"}, "1", ClienteFalso(salida()))[0], 200)
        self.assertEqual(asistente_ia.responder(cuerpo(), {**JSON, "Origin": "https://malo.example"}, "1", ClienteFalso(salida()))[0], 403)
        self.assertEqual(asistente_ia.cabeceras_cors(app), {"Vary": "Origin", "Access-Control-Allow-Origin": "https://localhost"})
        self.assertEqual(asistente_ia.cabeceras_cors({**JSON, "Origin": "https://malo.example"}), {"Vary": "Origin"})

    def test_consulta_previa(self):
        os.environ["SIMPLE_ORIGENES"] = "https://localhost"
        previa = {"Origin": "https://localhost", "Access-Control-Request-Method": "POST"}
        estado, cabeceras = asistente_ia.responder_preflight(previa)
        self.assertEqual(estado, 204)
        self.assertEqual(cabeceras["Access-Control-Allow-Origin"], "https://localhost")
        self.assertEqual(cabeceras["Access-Control-Allow-Headers"], "Content-Type")
        self.assertEqual(asistente_ia.responder_preflight({**previa, "Access-Control-Request-Method": "DELETE"})[0], 403)
        estado, cabeceras = asistente_ia.responder_preflight({**previa, "Origin": "https://malo.example"})
        self.assertEqual(estado, 403)
        self.assertNotIn("Access-Control-Allow-Origin", cabeceras)

    def test_limite_por_minuto(self):
        cliente = ClienteFalso(salida())
        estados = [asistente_ia.responder(cuerpo(), JSON, "2.2.2.2", cliente)[0] for _ in range(asistente_ia.POR_MINUTO + 1)]
        self.assertEqual(estados[-1], 429)
        self.assertEqual(asistente_ia.responder(cuerpo(), JSON, "3.3.3.3", cliente)[0], 200, "otra IP no se afecta")


class Interpretacion(Base):
    def test_depura_lo_que_propone_la_ia(self):
        cliente = ClienteFalso(salida(tramite=99, candidatos=[99, 100, 9999], respuesta="no debe salir", datos=[
            {"campo": "tipo_de_tramite", "valor": "empleo"},
            {"campo": "nombres", "valor": "Otra Persona"},            # solo lectura: viene de la cuenta
            {"campo": "inventado", "valor": "x"},                     # no existe
            {"campo": "cita_sede", "valor": "Santa Ana"},             # pista de cita: el trámite 99 tiene cita
        ]))
        estado, datos = asistente_ia.responder(cuerpo(), JSON, "1", cliente)
        self.assertEqual(estado, 200)
        self.assertEqual(datos["modo"], "ia")
        self.assertEqual(datos["tramite"], 99)
        self.assertEqual(datos["candidatos"], [100])
        self.assertEqual([d["campo"] for d in datos["datos"]], ["tipo_de_tramite", "cita_sede"])
        self.assertEqual(datos["respuesta"], "", "en iniciar_tramite la aplicación escribe sus propios mensajes")

    def test_datos_sensibles_solo_como_marcador(self):
        propuestas = [{"campo": "numero_de_cuenta", "valor": "12345678"}, {"campo": "numero_de_cuenta", "valor": "[NUM_1]"}]
        cliente = ClienteFalso(salida(intencion="aportar_datos", datos=propuestas))
        _, datos = asistente_ia.responder(cuerpo("mi cuenta es [NUM_1]", tramite=61, pendientes=["numero_de_cuenta"]), JSON, "1", cliente)
        self.assertEqual(datos["datos"], [{"campo": "numero_de_cuenta", "valor": "[NUM_1]"}])

    def test_la_respuesta_llega_en_preguntas(self):
        cliente = ClienteFalso(salida(intencion="pregunta", respuesta="Cuesta $3.00 y tarda 12 horas hábiles.", fuente="ficha"))
        _, datos = asistente_ia.responder(cuerpo("cuanto cuesta?", tramite=99), JSON, "1", cliente)
        self.assertEqual(datos["respuesta"], "Cuesta $3.00 y tarda 12 horas hábiles.")
        self.assertEqual(datos["fuente"], "ficha")

    def test_peticion_a_claude(self):
        cliente = ClienteFalso(salida())
        asistente_ia.responder(cuerpo("ocupo antecedentes penales para la chamba", tramite=99, pendientes=["lugar_de_presentacion"],
                                      llenos=["nombres"], historial=[{"rol": "ciudadano", "texto": "hola"}]), JSON, "1", cliente)
        pedido = cliente.pedidos[0]
        self.assertEqual(pedido["model"], asistente_ia.MODELO)
        self.assertEqual(pedido["fallbacks"], "default")
        self.assertIn("server-side-fallback-2026-07-01", pedido["betas"])
        self.assertEqual(pedido["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertEqual(pedido["output_config"]["format"]["schema"], asistente_ia.ESQUEMA)
        self.assertIn("99 | Constancia de antecedentes penales", pedido["system"][0]["text"])
        contenido = pedido["messages"][0]["content"]
        self.assertIn("<mensaje_ciudadano>\nocupo antecedentes penales para la chamba\n</mensaje_ciudadano>", contenido)
        self.assertIn("lugar_de_presentacion", contenido)
        self.assertNotIn("María", contenido, "los datos de la cuenta nunca van a la IA")

    def test_prefijo_en_cache_estable(self):
        cliente = ClienteFalso(salida())
        asistente_ia.responder(cuerpo("hola"), JSON, "1", cliente)
        asistente_ia.responder(cuerpo("partida de nacimiento"), JSON, "1", cliente)
        self.assertEqual(cliente.pedidos[0]["system"], cliente.pedidos[1]["system"])

    def test_sin_tramite_activo_incluye_posibles_formularios(self):
        cliente = ClienteFalso(salida())
        asistente_ia.responder(cuerpo("necesito la solvencia de agua de ANDA"), JSON, "1", cliente)
        self.assertIn("Trámite 64", cliente.pedidos[0]["messages"][0]["content"])

    def test_segunda_lectura_para_un_tramite_no_previsto(self):
        cliente = ClienteFalso([salida(tramite=113), salida(intencion="aportar_datos", datos=[{"campo": "nacionalidad", "valor": "salvadorena"}])])
        _, datos = asistente_ia.responder(cuerpo("me voy de viaje y piden un papel de que no tengo problemas para salir del pais"), JSON, "1", cliente)
        self.assertEqual(len(cliente.pedidos), 2)
        self.assertEqual(datos["datos"], [{"campo": "nacionalidad", "valor": "salvadorena"}])

    def test_rechazo_de_la_ia(self):
        _, datos = asistente_ia.responder(cuerpo(), JSON, "1", ClienteFalso(salida(), parada="refusal"))
        self.assertEqual(datos["intencion"], "fuera_de_ambito")

    def test_error_de_credenciales_deja_el_modo_basico(self):
        class AuthenticationError(Exception):
            pass
        estado, datos = asistente_ia.responder(cuerpo(), JSON, "1", ClienteFalso(error=AuthenticationError("sin clave")))
        self.assertEqual((estado, datos["motivo"]), (503, "credenciales"))

    def test_bitacora_sin_textos(self):
        asistente_ia.responder(cuerpo("mi lugar es Banco Agrícola"), JSON, "1", ClienteFalso(salida(tramite=99)))
        linea = asistente_ia.REGISTRO.read_text(encoding="utf-8")
        self.assertIn('"tramite": 99', linea)
        self.assertNotIn("Banco", linea)


class Servidor(Base):
    """servidor.py real en un puerto libre."""

    def setUp(self):
        super().setUp()
        self.servidores = []
        # Igual que al ejecutarlo: sirve la carpeta del proyecto
        self.url = self.levantar(RAIZ)

    def levantar(self, carpeta):
        manejador = functools.partial(servidor.ConRangos, directory=str(carpeta))
        http = ThreadingHTTPServer(("127.0.0.1", 0), manejador)
        threading.Thread(target=http.serve_forever, daemon=True).start()
        self.servidores.append(http)
        return f"http://127.0.0.1:{http.server_address[1]}"

    def tearDown(self):
        for http in self.servidores:
            http.shutdown()
            http.server_close()
        super().tearDown()

    def pedir(self, ruta, datos=None, url=None):
        peticion = urllib.request.Request((url or self.url) + ruta, data=datos, headers={"Content-Type": "application/json"} if datos else {})
        try:
            with urllib.request.urlopen(peticion) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_api_y_estaticos(self):
        os.environ["SIMPLE_IA"] = "0"
        estado, contenido = self.pedir("/api/asistente", cuerpo())
        self.assertEqual(estado, 503)
        self.assertEqual(json.loads(contenido)["modo"], "sin_ia")
        self.assertEqual(self.pedir("/nuevoDise%C3%B1o/motor-tramite.js")[0], 200)
        self.assertEqual(self.pedir("/index.html")[0], 200)
        self.assertEqual(self.pedir("/api/otra", cuerpo())[0], 404)

    def test_cors_para_la_app(self):
        os.environ["SIMPLE_IA"] = "0"
        os.environ["SIMPLE_ORIGENES"] = "https://localhost"
        previa = urllib.request.Request(self.url + "/api/asistente", method="OPTIONS", headers={
            "Origin": "https://localhost", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        with urllib.request.urlopen(previa) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers["Access-Control-Allow-Origin"], "https://localhost")
            self.assertEqual(r.headers["Access-Control-Allow-Methods"], "POST")
        envio = urllib.request.Request(self.url + "/api/asistente", data=cuerpo(), headers={"Content-Type": "application/json", "Origin": "https://localhost"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(envio)
        # Aunque responda 503 (IA apagada), el navegador debe poder leer {"modo": "sin_ia"}
        self.assertEqual(error.exception.code, 503)
        self.assertEqual(error.exception.headers["Access-Control-Allow-Origin"], "https://localhost")
        self.assertEqual(error.exception.headers["Vary"], "Origin")
        error.exception.close()
        ajena = urllib.request.Request(self.url + "/api/asistente", method="OPTIONS", headers={"Origin": "https://malo.example", "Access-Control-Request-Method": "POST"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(ajena)
        self.assertEqual(error.exception.code, 403)
        self.assertIsNone(error.exception.headers["Access-Control-Allow-Origin"])
        error.exception.close()
        self.assertEqual(self.pedir("/index.html")[0], 200)

    def test_la_bitacora_no_se_sirve(self):
        privada = Path(servidor.PRIVADA)
        creada = not privada.exists()
        privada.mkdir(exist_ok=True)
        archivo = privada / "prueba-no-servir.txt"
        archivo.write_text("privado", encoding="utf-8")
        # Aunque alguien sirva el repositorio completo (python3 servidor.py 8080 0.0.0.0), la bitácora no sale
        completo = self.url
        try:
            self.assertEqual(self.pedir("/registros/prueba-no-servir.txt", url=completo)[0], 404)
            self.assertEqual(self.pedir("/%72egistros/prueba-no-servir.txt", url=completo)[0], 404)
            self.assertEqual(self.pedir("/registros/../registros/prueba-no-servir.txt", url=completo)[0], 404)
            self.assertEqual(self.pedir("/bd/base_conocimiento.json", url=completo)[0], 200)
        finally:
            archivo.unlink()
            if creada:
                privada.rmdir()


if __name__ == "__main__":
    unittest.main()
