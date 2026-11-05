

import argparse
import json
import re
import sys
from pathlib import Path
from collections import defaultdict


def texto(valor):
    if valor is None:
        return ""
    if isinstance(valor, str):
        return re.sub(r"\s+", " ", valor).strip()
    return str(valor).strip()


def clave_tramite(registro):
    for campo in ("id", "slug", "titulo", "nombre"):
        valor = registro.get(campo)
        if valor not in (None, ""):
            return f"{campo}:{texto(valor).casefold()}"
    return "sin_clave:" + json.dumps(registro, ensure_ascii=False, sort_keys=True)


def clave_institucion(registro):
    inst = registro.get("institucion") or {}
    iid = inst.get("id", registro.get("institucion_id"))
    if iid not in (None, ""):
        return "id:" + texto(iid)
    nombre = texto(inst.get("nombre")) or "Institución no especificada"
    siglas = texto(inst.get("siglas"))
    return f"nombre:{nombre.casefold()}|{siglas.casefold()}"


def md_escape(value):
    return texto(value).replace("|", "\\|").replace("`", "\\`")


def unir_jsons(carpeta, salida):
    carpeta = Path(carpeta).expanduser().resolve()
    salida = Path(salida).expanduser().resolve()
    if not carpeta.is_dir():
        raise FileNotFoundError(f"No existe la carpeta de JSON: {carpeta}")

    archivos = sorted(p for p in carpeta.rglob("*.json") if p.is_file() and salida not in p.parents)
    if not archivos:
        raise FileNotFoundError(f"No se encontraron archivos .json dentro de {carpeta}")

    tramites = {}
    categorias = {}
    archivos_leidos = []
    errores = []

    for archivo in archivos:
        try:
            datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
            if not isinstance(datos, dict):
                errores.append(f"{archivo.name}: la raíz no es un objeto JSON")
                continue
            categoria = datos.get("categoria")
            if not isinstance(categoria, dict) or categoria.get("id") is None or not texto(categoria.get("nombre")):
                errores.append(f"{archivo.name}: no tiene `categoria.id` y `categoria.nombre`; se omitió")
                continue

            cat = {"id": categoria.get("id"), "nombre": texto(categoria.get("nombre"))}
            categorias[str(cat["id"])] = cat
            bloque = datos.get("tramites") or {}
            filas = bloque.get("data", []) if isinstance(bloque, dict) else []
            if not isinstance(filas, list):
                errores.append(f"{archivo.name}: `tramites.data` no es una lista; se omitió")
                continue

            for fila in filas:
                if not isinstance(fila, dict):
                    continue
                llave = clave_tramite(fila)
                if llave not in tramites:
                    # Copia para no modificar el objeto cargado en memoria accidentalmente.
                    tramites[llave] = dict(fila)
                    tramites[llave]["categorias_filtro"] = []
                registro = tramites[llave]
                lista = registro.setdefault("categorias_filtro", [])
                if not any(str(c.get("id")) == str(cat["id"]) for c in lista if isinstance(c, dict)):
                    lista.append(dict(cat))
                # Completa campos faltantes si el mismo trámite viene más completo en otro JSON.
                for campo, valor in fila.items():
                    if registro.get(campo) in (None, "", [], {}) and valor not in (None, "", [], {}):
                        registro[campo] = valor
            archivos_leidos.append({"archivo": str(archivo), "categoria": cat, "cantidad_en_archivo": len(filas)})
        except Exception as exc:
            errores.append(f"{archivo.name}: {type(exc).__name__}: {exc}")

    if not tramites:
        detalle = "\n".join(errores)
        raise ValueError("No se pudieron extraer trámites de los JSON.\n" + detalle)

    registros = list(tramites.values())
    for registro in registros:
        registro["categorias_filtro"] = sorted(
            registro.get("categorias_filtro", []), key=lambda c: texto(c.get("nombre")).casefold()
        )
        registro["categoria_filtro"] = ", ".join(c["nombre"] for c in registro["categorias_filtro"])
    registros.sort(key=lambda r: texto(r.get("titulo") or r.get("nombre") or r.get("id")).casefold())

    por_institucion = {}
    for registro in registros:
        inst = registro.get("institucion") or {}
        key = clave_institucion(registro)
        if key not in por_institucion:
            por_institucion[key] = {
                "id": inst.get("id", registro.get("institucion_id")),
                "nombre": texto(inst.get("nombre")) or "Institución no especificada",
                "siglas": texto(inst.get("siglas")),
                "categorias": {},
                "tramites": {}
            }
        grupo = por_institucion[key]
        for cat in registro.get("categorias_filtro", []):
            grupo["categorias"][str(cat["id"])] = cat
        tkey = clave_tramite(registro)
        grupo["tramites"][tkey] = {
            "id": registro.get("id"),
            "titulo": texto(registro.get("titulo") or registro.get("nombre")) or "Sin título",
            "slug": texto(registro.get("slug")),
            "categorias": [c["nombre"] for c in registro.get("categorias_filtro", [])] or ["Categoría no identificada"]
        }

    indice = []
    for grupo in por_institucion.values():
        indice.append({
            "id": grupo["id"],
            "nombre": grupo["nombre"],
            "siglas": grupo["siglas"],
            "categorias": sorted(grupo["categorias"].values(), key=lambda c: c["nombre"].casefold()),
            "cantidad_tramites": len(grupo["tramites"]),
            "tramites": sorted(grupo["tramites"].values(), key=lambda t: t["titulo"].casefold())
        })
    indice.sort(key=lambda x: x["nombre"].casefold())

    salida.mkdir(parents=True, exist_ok=True)
    combinado = {
        "fuente": "JSON filtrados por categoría de Simple.sv",
        "resumen": {
            "archivos_leidos": len(archivos_leidos),
            "categorias_encontradas": len(categorias),
            "tramites_unicos": len(registros),
            "instituciones_unicas": len(indice)
        },
        "categorias": sorted(categorias.values(), key=lambda c: c["nombre"].casefold()),
        "archivos_procesados": archivos_leidos,
        "errores": errores,
        "tramites": registros,
        "instituciones": indice
    }
    (salida / "tramites_combinados.json").write_text(
        json.dumps(combinado, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lineas_txt = [
        "ÍNDICE DE INSTITUCIONES DE SIMPLE.SV", "=" * 68,
        f"Archivos JSON procesados correctamente: {len(archivos_leidos)}",
        f"Categorías encontradas: {len(categorias)}",
        f"Instituciones únicas: {len(indice)}",
        f"Trámites únicos: {len(registros)}",
        "La categoría corresponde al filtro oficial indicado en cada JSON de entrada.", ""
    ]
    lineas_md = [
        "# Índice de instituciones de Simple.sv", "",
        f"- **Archivos procesados:** {len(archivos_leidos)}",
        f"- **Categorías encontradas:** {len(categorias)}",
        f"- **Instituciones únicas:** {len(indice)}",
        f"- **Trámites únicos:** {len(registros)}", "",
        "> La categoría corresponde al filtro oficial indicado en cada JSON de entrada.", ""
    ]

    for inst in indice:
        etiqueta = inst["nombre"] + (f" ({inst['siglas']})" if inst["siglas"] else "")
        cats = ", ".join(c["nombre"] for c in inst["categorias"]) or "Sin categoría identificada"
        lineas_txt += ["-" * 68, f"INSTITUCIÓN: {etiqueta}", f"ID: {inst['id']}",
                       f"Categorías: {cats}", f"Cantidad de trámites: {inst['cantidad_tramites']}", "Trámites:"]
        lineas_md += [f"## {md_escape(etiqueta)}", "", f"- **ID:** {inst['id']}",
                      f"- **Categorías:** {', '.join(md_escape(c['nombre']) for c in inst['categorias']) or 'Sin categoría identificada'}",
                      f"- **Cantidad de trámites:** {inst['cantidad_tramites']}", "", "**Trámites**", ""]
        for tr in inst["tramites"]:
            categoria_tr = ", ".join(tr["categorias"])
            lineas_txt.append(f"  - {tr['titulo']} (ID: {tr['id']}; categoria: {categoria_tr}; slug: {tr['slug']})")
            lineas_md.append(f"- {md_escape(tr['titulo'])} — ID: `{tr['id']}`; categoría: {', '.join(md_escape(c) for c in tr['categorias'])}; slug: `{md_escape(tr['slug'])}`")
        lineas_txt.append("")
        lineas_md.append("")

    if errores:
        lineas_txt += ["ADVERTENCIAS", *[f"- {e}" for e in errores], ""]
        lineas_md += ["## Advertencias", "", *[f"- {md_escape(e)}" for e in errores], ""]
    (salida / "indice_instituciones.txt").write_text("\n".join(lineas_txt) + "\n", encoding="utf-8")
    (salida / "indice_instituciones.md").write_text("\n".join(lineas_md) + "\n", encoding="utf-8")

    print("Proceso terminado.")
    print(f"JSON combinado: {salida / 'tramites_combinados.json'}")
    print(f"TXT:            {salida / 'indice_instituciones.txt'}")
    print(f"Markdown:       {salida / 'indice_instituciones.md'}")
    print(f"Categorías: {len(categorias)} | Instituciones: {len(indice)} | Trámites únicos: {len(registros)}")
    if errores:
        print(f"Advertencias: {len(errores)} (quedaron registradas en el JSON combinado y en los archivos de índice).")


def main():
    parser = argparse.ArgumentParser(description="Une JSON de categorías de Simple.sv y genera TXT, Markdown y JSON combinados.")
    parser.add_argument("carpeta", nargs="?", help="Carpeta que contiene los JSON de categorías")
    parser.add_argument("--salida", default="resultado_simple_sv", help="Carpeta de salida (por defecto: resultado_simple_sv)")
    args = parser.parse_args()
    carpeta = args.carpeta or input("Ruta de la carpeta donde guardaste los JSON: ").strip().strip('"')
    if not carpeta:
        print("No se indicó una carpeta.", file=sys.stderr)
        return 2
    try:
        unir_jsons(carpeta, args.salida)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
