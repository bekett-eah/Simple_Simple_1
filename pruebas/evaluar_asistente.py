"""Evaluación de comprensión del asistente con la IA real (asistente_ia.py + Claude) sobre pruebas/evaluacion_nlu.jsonl.

Mide intención, trámite y datos extraídos por caso y por grupo, y guarda el detalle en pruebas/resultados_evaluacion.json.
GASTA CRÉDITOS DE LA API (una o dos llamadas por caso; con Claude Opus 5.5 y caché, del orden de 1 a 3 centavos de
dólar por caso). Por eso solo corre con --confirmo-costo.

Uso: python pruebas/evaluar_asistente.py --confirmo-costo [--solo inicio,datos]
La línea base sin IA (modo básico, gratis): node pruebas/evaluar_local.mjs
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import asistente_ia  # noqa: E402

CASOS = Path(__file__).resolve().parent / "evaluacion_nlu.jsonl"
SALIDA = Path(__file__).resolve().parent / "resultados_evaluacion.json"
CABECERAS = {"Content-Type": "application/json", "Host": "localhost"}


def normalizar(texto):
    texto = unicodedata.normalize("NFD", str(texto or "").lower())
    return re.sub(r"\s+", " ", "".join(c for c in texto if unicodedata.category(c) != "Mn")).strip()


def calificar(caso, r):
    """Lista de fallas (vacía si el caso pasa). La misma regla que evaluar_local.mjs."""
    esperado, fallas = caso["esperado"], []
    intenciones = esperado["intencion"] if isinstance(esperado["intencion"], list) else [esperado["intencion"]]
    if r.get("intencion") not in intenciones:
        fallas.append(f"intención {r.get('intencion')} (esperada {'/'.join(intenciones)})")
    if "tramite" in esperado and r.get("tramite") != esperado["tramite"]:
        fallas.append(f"trámite {r.get('tramite')} (esperado {esperado['tramite']})")
    posibles = [r.get("tramite")] + list(r.get("candidatos") or [])
    for n in esperado.get("candidatos_incluyen", []):
        if n not in posibles:
            fallas.append(f"falta el candidato {n}")
    datos = {d["campo"]: d["valor"] for d in r.get("datos") or []}
    for campo, valor in (esperado.get("datos") or {}).items():
        obtenido = datos.get(campo)
        if obtenido is None:
            fallas.append(f"falta {campo}")
        elif not (normalizar(valor) in normalizar(obtenido) or normalizar(obtenido) in normalizar(valor)):
            fallas.append(f"{campo}={obtenido!r} (esperado {valor!r})")
    for fragmento in esperado.get("respuesta_incluye", []):
        if normalizar(fragmento) not in normalizar(r.get("respuesta")):
            fallas.append(f"la respuesta no dice {fragmento!r}")
    if esperado.get("sin_inventar") and re.search(r"\b\d{1,2}(:\d{2})?\s*(a\.?\s?m|p\.?\s?m|horas)\b", normalizar(r.get("respuesta"))):
        fallas.append("la respuesta da un horario que no está en la ficha")
    return fallas


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmo-costo", action="store_true", help="acepto que esta evaluación gasta créditos de la API")
    parser.add_argument("--solo", default="", help="grupos de casos separados por comas (inicio, datos, pregunta…)")
    args = parser.parse_args()
    if not args.confirmo_costo:
        print("Esta evaluación llama a la API de Claude y gasta créditos. Vuelve a correrla con --confirmo-costo.")
        return 2

    casos = [json.loads(linea) for linea in CASOS.read_text(encoding="utf-8").splitlines() if linea.strip()]
    if args.solo:
        grupos = set(args.solo.split(","))
        casos = [c for c in casos if c["id"].split("-")[0] in grupos]
    asistente_ia.POR_MINUTO = 10**6
    resultados = []
    for caso in casos:
        contexto = {"canal": "web", "sesion": True, "tramite": 0, "fase": "", "pendientes": [], "llenos": [], "historial": [], **caso.get("contexto", {})}
        cuerpo = json.dumps({"mensaje": caso["mensaje"], "contexto": contexto}).encode()
        inicio = time.monotonic()
        estado, r = asistente_ia.responder(cuerpo, CABECERAS, "evaluacion")
        if estado != 200:
            print(f"Sin IA ({estado}: {r}). Revisa ANTHROPIC_API_KEY o `ant auth login` y el paquete anthropic.")
            return 1
        fallas = calificar(caso, r)
        resultados.append({"id": caso["id"], "mensaje": caso["mensaje"], "ok": not fallas, "fallas": fallas,
                           "respuesta": r, "segundos": round(time.monotonic() - inicio, 2)})
        print(f"{'OK   ' if not fallas else 'FALLA'} {caso['id']}: {caso['mensaje'][:60]}{'' if not fallas else ' — ' + '; '.join(fallas)}")

    por_grupo = {}
    for r in resultados:
        grupo = r["id"].split("-")[0]
        bien, total = por_grupo.get(grupo, (0, 0))
        por_grupo[grupo] = (bien + r["ok"], total + 1)
    total_bien = sum(r["ok"] for r in resultados)
    print(f"\nCorrectos: {total_bien} de {len(resultados)} ({round(100 * total_bien / max(1, len(resultados)))}%)")
    for grupo, (bien, total) in sorted(por_grupo.items()):
        print(f"  {grupo}: {bien}/{total}")
    print(f"Tiempo promedio por caso: {round(sum(r['segundos'] for r in resultados) / max(1, len(resultados)), 2)} s")
    SALIDA.write_text(json.dumps({"modelo": asistente_ia.MODELO, "esfuerzo": asistente_ia.ESFUERZO, "resultados": resultados}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Detalle: {SALIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
