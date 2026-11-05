#!/usr/bin/env python3
"""Scraper respetuoso para catalogar el portal público Simple.sv.

El endpoint JSON predeterminado se toma del JSON facilitado por el usuario:
http://simple.sv/tramites-filtro?per_page=9&page=1
No se garantiza que siga vigente; se puede sustituir con --api-url.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs, urlencode

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DEFAULT_SITE = "https://www.simple.sv/"
# Observado en los metadatos del JSON proporcionado por el usuario; verificar al ejecutar.
DEFAULT_API = "http://simple.sv/tramites-filtro"
DEFAULT_PER_PAGE = 9
USER_AGENT = "SimpleSV-ResearchScraper/1.0 (public catalog research; contact: configure-me)"


def setup_logging(log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(log_path, encoding="utf-8")],
    )


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=4, connect=4, read=4, status=4,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8"})
    return session


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float, bool)):
        return str(value)
    soup = BeautifulSoup(str(value), "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()


def get_url(session: requests.Session, url: str, timeout: int, delay: float, *, expect_json: bool = False) -> requests.Response:
    if delay > 0:
        time.sleep(delay)
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    if expect_json:
        ctype = response.headers.get("Content-Type", "").lower()
        try:
            response.json()
        except ValueError as exc:
            raise ValueError(f"La respuesta de {url} no es JSON válido (Content-Type={ctype!r}).") from exc
    return response


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    # Evitar fragmentos, que no identifican páginas distintas en el servidor.
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.params, parsed.query, ""))


def api_url_with_page(api_url: str, page: int, per_page: int) -> str:
    parsed = urlparse(api_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page)]
    query["per_page"] = [str(per_page)]
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, urlencode(query, doseq=True), ""))


def extract_api_payload(payload: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Acepta la estructura paginada observada en el JSON y variantes habituales."""
    if not isinstance(payload, dict):
        raise ValueError("La raíz del JSON no es un objeto.")
    pagination: dict[str, Any] = {}
    block = payload.get("tramites", payload)
    if isinstance(block, dict):
        pagination = {k: block.get(k) for k in (
            "current_page", "from", "to", "per_page", "total", "last_page",
            "first_page_url", "last_page_url", "next_page_url", "prev_page_url", "path"
        ) if k in block}
        rows = block.get("data")
        if rows is None:
            rows = block.get("items")
        if rows is None and isinstance(block.get("tramites"), list):
            rows = block["tramites"]
    elif isinstance(block, list):
        rows = block
    else:
        rows = None
    if rows is None:
        # Algunas respuestas podrían devolver los registros en una clave superior.
        rows = payload.get("data") or payload.get("items")
    if not isinstance(rows, list):
        raise ValueError("No se encontró una lista de trámites reconocible en el JSON.")
    return [r for r in rows if isinstance(r, dict)], pagination


def scrape_api(session: requests.Session, api_url: str, per_page: int, timeout: int, delay: float,
               max_pages: int | None) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    pages_meta: list[dict[str, Any]] = []
    errors: list[str] = []
    first_url = api_url_with_page(api_url, 1, per_page)
    logging.info("Consultando endpoint JSON: %s", first_url)
    try:
        response = get_url(session, first_url, timeout, delay, expect_json=True)
        payload = response.json()
        rows, meta = extract_api_payload(payload)
        pages_meta.append(meta)
        for row in rows:
            key = str(row.get("id") or row.get("slug") or json.dumps(row, sort_keys=True, ensure_ascii=False))
            if key not in seen_ids:
                seen_ids.add(key)
                records.append(row)
        total_pages = meta.get("last_page")
        if total_pages is None:
            total = meta.get("total")
            actual_per_page = meta.get("per_page") or per_page
            total_pages = (int(total) + int(actual_per_page) - 1) // int(actual_per_page) if total else 1
        try:
            total_pages = int(total_pages)
        except (TypeError, ValueError):
            total_pages = 1
        if max_pages is not None:
            total_pages = min(total_pages, max_pages)
        for page in range(2, total_pages + 1):
            url = api_url_with_page(api_url, page, per_page)
            try:
                logging.info("Página JSON %s/%s: %s", page, total_pages, url)
                page_response = get_url(session, url, timeout, delay, expect_json=True)
                page_payload = page_response.json()
                page_rows, page_meta = extract_api_payload(page_payload)
                pages_meta.append(page_meta)
                new_count = 0
                for row in page_rows:
                    key = str(row.get("id") or row.get("slug") or json.dumps(row, sort_keys=True, ensure_ascii=False))
                    if key not in seen_ids:
                        seen_ids.add(key)
                        records.append(row)
                        new_count += 1
                logging.info("Página %s: %s registros; %s nuevos", page, len(page_rows), new_count)
                if not page_rows:
                    logging.warning("La página %s devolvió cero registros; se detiene la paginación.", page)
                    break
            except Exception as exc:  # conserva los datos ya recuperados
                message = f"Página {page} ({url}): {type(exc).__name__}: {exc}"
                errors.append(message)
                logging.exception("Error recuperando página; se continúa cuando sea posible")
    except Exception as exc:
        message = f"Endpoint JSON ({first_url}): {type(exc).__name__}: {exc}"
        errors.append(message)
        logging.exception("No fue posible recuperar el endpoint JSON")
        return [], {"endpoint": api_url, "status": "failed"}, errors
    final_meta = {
        "endpoint": api_url,
        "pages_attempted": len(pages_meta),
        "pagination_first_page": pages_meta[0] if pages_meta else {},
        "pagination_last_page": pages_meta[-1] if pages_meta else {},
        "errors": errors,
    }
    return records, final_meta, errors


def same_site(url: str, site_url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    site_host = (urlparse(site_url).hostname or "").lower()
    if not host or not site_host:
        return False
    # Permite www.simple.sv y simple.sv, pero no dominios parecidos.
    return host == site_host or host.removeprefix("www.") == site_host.removeprefix("www.")


def extract_page_record(url: str, html_text: str) -> dict[str, Any]:
    soup = BeautifulSoup(html_text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    title = clean_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
    h1 = clean_text(soup.find("h1").get_text(" ", strip=True)) if soup.find("h1") else ""
    description = ""
    meta_desc = soup.find("meta", attrs={"name": re.compile("description", re.I)})
    if meta_desc:
        description = clean_text(meta_desc.get("content", ""))
    headings = []
    for tag in soup.find_all(re.compile(r"^h[1-6]$")):
        text = clean_text(tag.get_text(" ", strip=True))
        if text:
            headings.append({"level": tag.name, "text": text})
    links = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        absolute = normalize_url(urljoin(url, href))
        links.append({"text": clean_text(a.get_text(" ", strip=True)), "url": absolute})
    # Elimina enlaces duplicados conservando orden.
    seen_links = set()
    unique_links = []
    for link in links:
        key = (link["url"], link["text"])
        if key not in seen_links:
            seen_links.add(key)
            unique_links.append(link)
    body = soup.body or soup
    text = clean_text(body.get_text(" ", strip=True))
    return {
        "url": url, "http_title": title, "h1": h1, "meta_description": description,
        "headings": headings, "links": unique_links, "text": text,
    }


def crawl_portal(session: requests.Session, site_url: str, seed_urls: Iterable[str], timeout: int,
                 delay: float, max_pages: int) -> tuple[list[dict[str, Any]], list[str]]:
    queue = deque(normalize_url(urljoin(site_url, u)) for u in seed_urls)
    visited: set[str] = set()
    pages: list[dict[str, Any]] = []
    errors: list[str] = []
    while queue and len(visited) < max_pages:
        url = queue.popleft()
        if url in visited or not same_site(url, site_url):
            continue
        visited.add(url)
        try:
            logging.info("Página del portal %s/%s: %s", len(visited), max_pages, url)
            response = get_url(session, url, timeout, delay)
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" not in content_type and not response.text.lstrip().lower().startswith(("<!doctype html", "<html")):
                logging.info("Se omite contenido no HTML: %s (%s)", url, content_type)
                continue
            page = extract_page_record(response.url, response.text)
            pages.append(page)
            for link in page["links"]:
                linked = link["url"]
                if same_site(linked, site_url) and linked not in visited and len(visited) + len(queue) < max_pages * 4:
                    # Evita parámetros de sesión y anchors ya retirados por normalize_url.
                    if not any(x in urlparse(linked).query.lower() for x in ("token=", "sessionid=", "phpsessid=")):
                        queue.append(linked)
        except Exception as exc:
            message = f"Página HTML ({url}): {type(exc).__name__}: {exc}"
            errors.append(message)
            logging.warning("No se pudo leer %s: %s", url, exc)
    return pages, errors


def deduplicate_pages(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result, seen = [], set()
    for page in pages:
        url = page.get("url", "")
        if url not in seen:
            seen.add(url)
            result.append(page)
    return result


def categorize(records: list[dict[str, Any]]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for record in records:
        inst = record.get("institucion") or {}
        institution = clean_text(inst.get("nombre")) or "Institución no especificada"
        siglas = clean_text(inst.get("siglas"))
        inst_label = f"{institution} ({siglas})" if siglas else institution
        modalities = record.get("modalidades") or []
        categories = sorted({clean_text(m.get("clasificacion")) or "Sin clasificación" for m in modalities if isinstance(m, dict)})
        if not categories:
            categories = ["Sin clasificación"]
        for category in categories:
            grouped[category][inst_label].append(record)
    return {cat: dict(insts) for cat, insts in sorted(grouped.items())}


def record_to_lines(record: dict[str, Any]) -> list[str]:
    inst = record.get("institucion") or {}
    out = [f"TRÁMITE: {clean_text(record.get('titulo')) or 'Sin título'}",
           f"ID: {record.get('id', 'No indicado')}",
           f"RNT ID: {record.get('rnt_id', 'No indicado')}",
           f"Slug: {record.get('slug', '')}",
           f"Estado: {record.get('estado', 'No indicado')}",
           f"Estado del trámite: {record.get('estado_tramite', 'No indicado')}",
           f"Institución: {clean_text(inst.get('nombre')) or 'No indicada'}",
           f"Siglas: {clean_text(inst.get('siglas')) or 'No indicadas'}",
           f"Institución ID: {record.get('institucion_id', inst.get('id', 'No indicado'))}",
           f"Subtítulo: {clean_text(record.get('sub_titulo')) or 'No indicado'}",
           f"Descripción para búsqueda: {clean_text(record.get('descripcion_busqueda')) or 'No indicada'}",
           f"Imagen: {record.get('imagen') or 'No indicada'}"]
    modalities = record.get("modalidades") or []
    if not modalities:
        out.append("Modalidades: no hay modalidades en el registro.")
    for index, modality in enumerate(modalities, 1):
        out.extend(["", f"  MODALIDAD {index}: {clean_text(modality.get('titulo')) or 'Sin título'}",
                    f"  Modalidad ID: {modality.get('id', 'No indicado')}",
                    f"  Tipo de trámite: {modality.get('tipo_tramite', 'No indicado')}",
                    f"  Estado modalidad: {modality.get('estado_modalidad', 'No indicado')}",
                    f"  Slug: {modality.get('slug', '')}",
                    f"  Clasificación: {clean_text(modality.get('clasificacion')) or 'No indicada'}",
                    f"  Medio de presentación: {clean_text(modality.get('medios_presentacion')) or 'No indicado'}",
                    f"  Duración promedio: {clean_text(modality.get('duracion_promedio')) or 'No indicada'}",
                    f"  Costo (texto): {clean_text(modality.get('costo_tramite')) or 'No indicado'}",
                    f"  Descripción para búsqueda: {clean_text(modality.get('descripcion_busqueda')) or 'No indicada'}",
                    f"  Descripción completa: {clean_text(modality.get('descripcion')) or 'No indicada'}",
                    f"  URL del trámite: {modality.get('url_sitio') or 'No indicada'}",
                    f"  URL de costos: {modality.get('url_costo') or 'No indicada'}"])
        costs = modality.get("costos") or []
        out.append(f"  Costos estructurados ({len(costs)}):")
        if costs:
            for cost in costs:
                out.append(f"    - ID: {cost.get('id', 'No indicado')} | Costo: {cost.get('costo', 'No indicado')} | Descripción: {clean_text(cost.get('descripcion')) or 'Sin descripción'}")
        else:
            out.append("    - Sin costos estructurados en el JSON.")
    return out


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def export_txt(path: Path, payload: dict[str, Any]) -> None:
    records = payload.get("tramites", [])
    grouped = categorize(records)
    lines = ["CATÁLOGO DOCUMENTADO DE SIMPLE.SV", "=" * 72,
             f"Fecha de extracción UTC: {payload.get('extracted_at_utc', '')}",
             f"Trámites únicos extraídos: {len(records)}",
             f"Páginas del portal registradas: {len(payload.get('portal_pages', []))}",
             "Endpoint JSON configurado: " + str(payload.get("source", {}).get("api_url", "")),
             "Aviso: los datos reflejan lo devuelto por el sitio en la fecha de extracción.", ""]
    for category, institutions in grouped.items():
        lines += ["#" * 72, f"CATEGORÍA / CLASIFICACIÓN: {category}", "#" * 72]
        for institution, items in institutions.items():
            lines += ["", f"INSTITUCIÓN: {institution}", "-" * 72]
            unique = {}
            for item in items:
                unique[str(item.get("id") or item.get("slug") or item.get("titulo"))] = item
            for record in unique.values():
                lines += [""] + record_to_lines(record) + [""]
    lines += ["", "=" * 72, "PÁGINAS HTML DEL PORTAL", "=" * 72]
    for page in payload.get("portal_pages", []):
        lines += [f"URL: {page.get('url', '')}", f"Título: {page.get('http_title', '')}",
                  f"H1: {page.get('h1', '')}", f"Descripción meta: {page.get('meta_description', '')}",
                  f"Encabezados: {' | '.join(x.get('text', '') for x in page.get('headings', []))}",
                  f"Texto: {page.get('text', '')}", "Enlaces:"]
        lines += [f"  - {x.get('text') or '(sin texto)'}: {x.get('url')}" for x in page.get("links", [])]
        lines.append("")
    lines += ["", "ERRORES / ADVERTENCIAS", "=" * 72]
    errs = payload.get("errors", [])
    lines += [f"- {e}" for e in errs] if errs else ["No se registraron errores."]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def md_escape(text: Any) -> str:
    return clean_text(text).replace("|", "\\|").replace("\n", " ")


def export_markdown(path: Path, payload: dict[str, Any]) -> None:
    records = payload.get("tramites", [])
    grouped = categorize(records)
    lines = ["# Catálogo documentado de Simple.sv", "",
             f"- **Fecha de extracción (UTC):** {payload.get('extracted_at_utc', '')}",
             f"- **Trámites únicos extraídos:** {len(records)}",
             f"- **Páginas HTML registradas:** {len(payload.get('portal_pages', []))}",
             f"- **Endpoint JSON configurado:** `{payload.get('source', {}).get('api_url', '')}`", "",
             "> La extracción puede estar incompleta si el endpoint cambió o si alguna página falló. Verifica la sección de errores y el total declarado por el servidor.", ""]
    for category, institutions in grouped.items():
        lines += [f"## Clasificación: {category}", ""]
        for institution, items in institutions.items():
            lines += [f"### Institución: {institution}", ""]
            unique = {}
            for item in items:
                unique[str(item.get("id") or item.get("slug") or item.get("titulo"))] = item
            for record in unique.values():
                inst = record.get("institucion") or {}
                lines += [f"#### {md_escape(record.get('titulo') or 'Trámite sin título')}", "",
                          f"- **ID:** {record.get('id', 'No indicado')}",
                          f"- **RNT ID:** {record.get('rnt_id', 'No indicado')}",
                          f"- **Slug:** `{record.get('slug', '')}`",
                          f"- **Estado:** {md_escape(record.get('estado', 'No indicado'))}",
                          f"- **Estado del trámite:** {md_escape(record.get('estado_tramite', 'No indicado'))}",
                          f"- **Institución ID:** {record.get('institucion_id', inst.get('id', 'No indicado'))}",
                          f"- **Subtítulo:** {md_escape(record.get('sub_titulo')) or 'No indicado'}",
                          f"- **Descripción de búsqueda:** {md_escape(record.get('descripcion_busqueda')) or 'No indicada'}",
                          f"- **Imagen:** {record.get('imagen') or 'No indicada'}", ""]
                modalities = record.get("modalidades") or []
                if modalities:
                    lines.append("**Modalidades**")
                    for i, m in enumerate(modalities, 1):
                        lines += [f"##### Modalidad {i}: {md_escape(m.get('titulo') or 'Sin título')}", "",
                                  f"- **ID:** {m.get('id', 'No indicado')}",
                                  f"- **Tipo:** {md_escape(m.get('tipo_tramite')) or 'No indicado'}",
                                  f"- **Estado:** {md_escape(m.get('estado_modalidad')) or 'No indicado'}",
                                  f"- **Clasificación:** {md_escape(m.get('clasificacion')) or 'No indicada'}",
                                  f"- **Presentación:** {md_escape(m.get('medios_presentacion')) or 'No indicada'}",
                                  f"- **Duración promedio:** {md_escape(m.get('duracion_promedio')) or 'No indicada'}",
                                  f"- **Costo (texto):** {md_escape(m.get('costo_tramite')) or 'No indicado'}",
                                  f"- **Descripción:** {md_escape(m.get('descripcion')) or 'No indicada'}",
                                  f"- **URL del trámite:** {m.get('url_sitio') or 'No indicada'}",
                                  f"- **URL de costos:** {m.get('url_costo') or 'No indicada'}", ""]
                        costs = m.get("costos") or []
                        if costs:
                            lines += ["**Costos estructurados**", "", "| ID | Costo | Descripción |", "|---:|---:|---|"]
                            for c in costs:
                                lines.append(f"| {c.get('id', '')} | {md_escape(c.get('costo', ''))} | {md_escape(c.get('descripcion', ''))} |")
                            lines.append("")
                        else:
                            lines += ["- No hay costos estructurados para esta modalidad.", ""]
                else:
                    lines += ["No se encontraron modalidades en el registro.", ""]
    lines += ["## Páginas HTML del portal", ""]
    for page in payload.get("portal_pages", []):
        lines += [f"### {md_escape(page.get('http_title') or page.get('url'))}", "",
                  f"- **URL:** {page.get('url', '')}", f"- **H1:** {md_escape(page.get('h1'))}",
                  f"- **Descripción meta:** {md_escape(page.get('meta_description'))}",
                  f"- **Encabezados:** {'; '.join(md_escape(x.get('text')) for x in page.get('headings', []))}", "",
                  f"**Texto extraído:** {md_escape(page.get('text'))}", "", "**Enlaces**", ""]
        lines += [f"- [{md_escape(link.get('text') or 'Enlace sin texto')}]({link.get('url')})" for link in page.get("links", [])]
        lines.append("")
    lines += ["## Errores y advertencias", ""]
    errs = payload.get("errors", [])
    lines += [f"- {e}" for e in errs] if errs else ["- No se registraron errores."]
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")



def institution_index(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resume instituciones, categorías y trámites sin duplicar registros."""
    institutions: dict[str, dict[str, Any]] = {}
    for record in records:
        inst = record.get("institucion") or {}
        name = clean_text(inst.get("nombre")) or "Institución no especificada"
        siglas = clean_text(inst.get("siglas")) or ""
        inst_id = inst.get("id", record.get("institucion_id"))
        key = str(inst_id if inst_id is not None else f"{name}|{siglas}")
        item = institutions.setdefault(key, {
            "id": inst_id, "nombre": name, "siglas": siglas,
            "categorias": set(), "tramites": {}
        })
        for modality in record.get("modalidades") or []:
            if isinstance(modality, dict):
                item["categorias"].add(clean_text(modality.get("clasificacion")) or "Sin clasificación")
        item["tramites"][str(record.get("id") or record.get("slug") or record.get("titulo"))] = {
            "id": record.get("id"), "titulo": clean_text(record.get("titulo")) or "Sin título",
            "slug": record.get("slug", "")
        }
    result = []
    for item in institutions.values():
        result.append({
            "id": item["id"], "nombre": item["nombre"], "siglas": item["siglas"],
            "categorias": sorted(item["categorias"] or {"Sin clasificación"}),
            "cantidad_tramites": len(item["tramites"]),
            "tramites": sorted(item["tramites"].values(), key=lambda x: x["titulo"].casefold())
        })
    return sorted(result, key=lambda x: x["nombre"].casefold())

def export_institution_index(out_dir: Path, records: list[dict[str, Any]]) -> None:
    index = institution_index(records)
    (out_dir / "indice_instituciones.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    txt = ["ÍNDICE DE INSTITUCIONES DE SIMPLE.SV", "=" * 60,
           f"Instituciones únicas encontradas: {len(index)}",
           "Las categorías se derivan de la clasificación registrada en cada modalidad.", ""]
    md = ["# Índice de instituciones de Simple.sv", "",
          f"- **Instituciones únicas encontradas:** {len(index)}",
          "- Las categorías se derivan de la clasificación registrada en cada modalidad.", ""]
    for inst in index:
        label = inst["nombre"] + (f" ({inst['siglas']})" if inst["siglas"] else "")
        cats = ", ".join(inst["categorias"])
        txt += ["-" * 60, f"INSTITUCIÓN: {label}", f"ID: {inst['id']}",
                f"Categorías: {cats}", f"Cantidad de trámites: {inst['cantidad_tramites']}", "Trámites:"]
        md += [f"## {label}", "", f"- **ID:** {inst['id']}",
               f"- **Categorías:** {', '.join(md_escape(c) for c in inst['categorias'])}",
               f"- **Cantidad de trámites:** {inst['cantidad_tramites']}", "", "**Trámites**", ""]
        for tr in inst["tramites"]:
            txt.append(f"  - {tr['titulo']} (ID: {tr['id']}; slug: {tr['slug']})")
            md.append(f"- {md_escape(tr['titulo'])} — ID: `{tr['id']}`; slug: `{tr['slug']}`")
        txt.append("")
        md.append("")
    (out_dir / "indice_instituciones.txt").write_text("\n".join(txt) + "\n", encoding="utf-8")
    (out_dir / "indice_instituciones.md").write_text("\n".join(md) + "\n", encoding="utf-8")

def main() -> int:
    parser = argparse.ArgumentParser(description="Extrae el catálogo JSON y rastrea páginas públicas de Simple.sv.")
    parser.add_argument("--site-url", default=DEFAULT_SITE, help=f"URL inicial del portal (predeterminado: {DEFAULT_SITE})")
    parser.add_argument("--api-url", default=DEFAULT_API, help=f"Endpoint JSON (predeterminado, observado en el JSON del usuario: {DEFAULT_API})")
    parser.add_argument("--per-page", type=int, default=DEFAULT_PER_PAGE, help="Registros por página del endpoint JSON.")
    parser.add_argument("--delay", type=float, default=1.25, help="Pausa mínima entre solicitudes, en segundos (predeterminado: 1.25).")
    parser.add_argument("--timeout", type=int, default=25, help="Timeout HTTP en segundos.")
    parser.add_argument("--max-pages", type=int, default=None, help="Limita páginas JSON para pruebas; sin límite usa la paginación declarada.")
    parser.add_argument("--max-html-pages", type=int, default=150, help="Máximo de páginas HTML del mismo dominio que se rastrearán.")
    parser.add_argument("--out-dir", default="salida_simple_sv", help="Directorio de salida.")
    parser.add_argument("--no-crawl", action="store_true", help="Solo descarga el catálogo JSON; no rastrea páginas HTML.")
    parser.add_argument("--skip-robots-check", action="store_true", help="No consulta robots.txt (no recomendado).")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    setup_logging(out_dir / "scraper.log")
    if args.delay < 0:
        parser.error("--delay no puede ser negativo")
    session = make_session()

    # Consulta robots.txt y registra el resultado; no interpreta permisos de forma agresiva.
    robots_url = urljoin(args.site_url, "/robots.txt")
    robots_info: dict[str, Any] = {"url": robots_url, "checked": False, "status_code": None, "note": ""}
    if not args.skip_robots_check:
        try:
            resp = get_url(session, robots_url, args.timeout, args.delay)
            robots_info.update({"checked": True, "status_code": resp.status_code, "text": resp.text[:20000]})
            logging.info("robots.txt consultado: HTTP %s. Revísalo antes de una extracción extensa.", resp.status_code)
        except Exception as exc:
            robots_info["note"] = f"No se pudo consultar robots.txt: {type(exc).__name__}: {exc}"
            logging.warning(robots_info["note"])

    tramites, api_meta, api_errors = scrape_api(session, args.api_url, args.per_page, args.timeout, args.delay, args.max_pages)
    portal_pages: list[dict[str, Any]] = []
    html_errors: list[str] = []
    if not args.no_crawl:
        # Las rutas de partida son URLs públicas observadas en el portal; el resto se descubre siguiendo enlaces internos.
        seeds = [args.site_url, urljoin(args.site_url, "/index.php/tramites-filtrados"), urljoin(args.site_url, "/instrucciones")]
        portal_pages, html_errors = crawl_portal(session, args.site_url, seeds, args.timeout, args.delay, args.max_html_pages)
        portal_pages = deduplicate_pages(portal_pages)

    # Resumen de paginación: el servidor es la fuente del total, no un número hardcodeado.
    declared_total = api_meta.get("pagination_first_page", {}).get("total")
    if declared_total is None and tramites:
        declared_total = len(tramites)
    errors = api_errors + html_errors
    payload = {
        "source": {
            "site_url": args.site_url,
            "api_url": args.api_url,
            "api_endpoint_basis": "URL observada en el JSON proporcionado por el usuario; disponibilidad actual no garantizada.",
            "api_metadata": api_meta,
            "robots_txt": robots_info,
        },
        "extracted_at_utc": datetime.now(timezone.utc).isoformat(),
        "declared_total_tramites": declared_total,
        "unique_tramites_extracted": len(tramites),
        "tramites": tramites,
        "portal_pages": portal_pages,
        "errors": errors,
        "completeness": {
            "api_ok": bool(tramites) and not (api_errors and not api_meta.get("pages_attempted")),
            "matches_declared_total": (declared_total == len(tramites)) if declared_total is not None else None,
            "html_pages_count": len(portal_pages),
            "warning": "La extracción HTML está limitada por --max-html-pages; los enlaces externos se registran pero no se rastrean.",
        },
    }
    write_json(out_dir / "simple_sv_completo.json", payload)
    export_txt(out_dir / "simple_sv_documentacion.txt", payload)
    export_markdown(out_dir / "simple_sv_documentacion.md", payload)
    export_institution_index(out_dir, tramites)
    summary = {
        "tramites_unicos": len(tramites), "total_declarado": declared_total,
        "paginas_html": len(portal_pages), "errores": len(errors),
        "coincide_total": payload["completeness"]["matches_declared_total"],
        "salidas": ["simple_sv_completo.json", "simple_sv_documentacion.txt", "simple_sv_documentacion.md", "indice_instituciones.json", "indice_instituciones.txt", "indice_instituciones.md", "scraper.log"],
    }
    (out_dir / "resumen_ejecucion.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    logging.info("Proceso finalizado: %s", json.dumps(summary, ensure_ascii=False))
    if not tramites:
        logging.error("No se recuperaron trámites. Verifica --api-url y la estructura actual de la respuesta.")
        return 2
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
