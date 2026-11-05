# Scraper y documentación de Simple.sv

## Qué hace

- Descarga el catálogo de trámites desde un endpoint JSON paginado.
- Sigue la paginación anunciada por el servidor y elimina duplicados por ID/slug.
- Conserva los campos originales, incluidas instituciones, modalidades, clasificaciones, costos, duraciones y enlaces.
- Rastrea páginas HTML públicas del mismo dominio para documentar títulos, encabezados, texto y enlaces internos.
- Exporta JSON, TXT y Markdown, más un log y un resumen de ejecución.
- Usa timeout, reintentos para errores temporales y pausas entre solicitudes.

## Endpoint: qué está verificado y qué no

El JSON proporcionado previamente contiene `tramites.path` con el valor `http://simple.sv/tramites-filtro`, y metadatos de paginación con parámetros `per_page` y `page`. Por eso el script utiliza `http://simple.sv/tramites-filtro` como valor predeterminado, pero **no se garantiza que el endpoint siga disponible**. El script no inventa una API alternativa: si cambia, puedes indicarle la URL observada en DevTools.

También se usa `https://www.simple.sv/index.php/tramites-filtrados` como semilla HTML, porque esa ruta es visible públicamente. El rastreador descubre más enlaces siguiendo los enlaces internos de las páginas obtenidas.

## Instalación

Requiere Python 3.10 o posterior.

```bash
python -m venv .venv
```

Windows:
```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r requirements_simple_sv.txt
```

Linux/macOS:
```bash
source .venv/bin/activate
python -m pip install -r requirements_simple_sv.txt
```

## Ejecución normal

```bash
python simple_sv_scraper.py
```

Por defecto crea la carpeta `salida_simple_sv/` con:

- `simple_sv_completo.json`
- `simple_sv_documentacion.txt`
- `simple_sv_documentacion.md`
- `resumen_ejecucion.json`
- `scraper.log`

## Prueba pequeña

```bash
python simple_sv_scraper.py --max-pages 1 --max-html-pages 10 --delay 1.5
```

## Solo catálogo JSON

```bash
python simple_sv_scraper.py --no-crawl
```

## Cambiar el endpoint cuando se verifique en DevTools

```bash
python simple_sv_scraper.py --api-url "https://DOMINIO/RUTA-OBSERVADA" --per-page 9
```

No copies cookies, tokens, contraseñas ni encabezados de autenticación al compartir una URL.

## Límites y precauciones

- Lee `robots.txt` al inicio y deja el resultado en el JSON; revísalo antes de ejecutar una extracción amplia.
- Usa pausas, timeout y reintentos. Evita aumentar mucho la concurrencia (el script no hace solicitudes en paralelo).
- El rastreo HTML se limita a páginas del mismo dominio y a `--max-html-pages` (150 por defecto). Los enlaces externos se documentan, pero no se rastrean.
- La clasificación se toma de `modalidades[].clasificacion`. No se inventan categorías temáticas que no estén en los datos.
- Si el endpoint devuelve HTML, cambia de estructura o bloquea la solicitud, el error quedará en `scraper.log` y en el archivo exportado.
- La extracción no incluye zonas privadas ni intenta iniciar sesión o saltarse controles de acceso.
- El scraper es una herramienta de investigación: revisa las condiciones del portal y usa los datos de forma responsable.
