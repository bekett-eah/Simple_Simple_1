"""Servidor estático para probar el sitio en la red local.

Igual que `python3 -m http.server`, pero acepta peticiones por partes (Range).
Safari, en Mac y en iPhone, las necesita para reproducir videos, y todos los
navegadores las usan para adelantar o reiniciar un video sin volver a bajarlo.

Sirve la carpeta desde donde se ejecuta, como `python3 -m http.server`.
Uso: python3 servidor.py [puerto] [dirección]   (por defecto 8080 y 0.0.0.0)
"""
import os
import re
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RANGO = re.compile(r"bytes=(\d*)-(\d*)$")


class ConRangos(SimpleHTTPRequestHandler):
    def send_head(self):
        rango = RANGO.match(self.headers.get("Range", "").strip())
        ruta = self.translate_path(self.path)
        if not rango or os.path.isdir(ruta):
            return super().send_head()
        try:
            archivo = open(ruta, "rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "Archivo no encontrado")
            return None
        tamano = os.fstat(archivo.fileno()).st_size
        inicio, fin = rango.groups()
        if inicio:
            inicio, fin = int(inicio), int(fin) if fin else tamano - 1
        else:
            # "bytes=-N": los últimos N bytes
            inicio, fin = max(tamano - int(fin or 0), 0), tamano - 1
        fin = min(fin, tamano - 1)
        if inicio > fin:
            archivo.close()
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{tamano}")
            self.end_headers()
            return None
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(ruta))
        self.send_header("Content-Range", f"bytes {inicio}-{fin}/{tamano}")
        self.send_header("Content-Length", str(fin - inicio + 1))
        self.end_headers()
        archivo.seek(inicio)
        self.restante = fin - inicio + 1
        return archivo

    def copyfile(self, origen, destino):
        restante = getattr(self, "restante", None)
        if restante is None:
            return super().copyfile(origen, destino)
        while restante > 0:
            bloque = origen.read(min(64 * 1024, restante))
            if not bloque:
                break
            destino.write(bloque)
            restante -= len(bloque)
        self.restante = None

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    direccion = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
    print(f"Sirviendo {os.getcwd()} en http://{direccion}:{puerto}/ (Ctrl + C para detener)")
    ThreadingHTTPServer((direccion, puerto), ConRangos).serve_forever()
