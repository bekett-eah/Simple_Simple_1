/* Transformaciones que el build aplica a la copia del frontend web para la app (nunca a los archivos originales).
   Son funciones puras sobre texto para poder probarlas (tests/transformar.test.mjs). */

// La carpeta del rediseño se llama nuevoDiseño; en disco (macOS) la ñ queda descompuesta (NFD) y en el HTML compuesta
// (NFC). Dentro del APK eso rompe las rutas, así que en la app la carpeta pasa a llamarse nuevoDiseno (solo ASCII).
export const CARPETA_ORIGINAL = 'nuevoDiseño';
export const CARPETA_APP = 'nuevoDiseno';
const VARIANTES_CARPETA = [CARPETA_ORIGINAL.normalize('NFC'), CARPETA_ORIGINAL.normalize('NFD'), encodeURI(CARPETA_ORIGINAL.normalize('NFC'))];

export function renombrarCarpeta(texto) {
  return VARIANTES_CARPETA.reduce((salida, variante) => salida.split(`${variante}/`).join(`${CARPETA_APP}/`), texto);
}

/* Sin viewport-fit=cover la app no dibuja debajo de la barra de estado: el frontend no reserva el área segura
   (env(safe-area-inset-*)) en todas sus páginas y Capacitor se encarga del margen (SystemBars, insetsHandling). */
export function ajustarViewport(html) {
  return html.replace(/(<meta\s+name="viewport"\s+content=")([^"]*)(")/i, (_, inicio, contenido, fin) => {
    const partes = contenido.split(',').map(p => p.trim()).filter(p => p && !/^viewport-fit\s*=/i.test(p));
    return `${inicio}${partes.join(', ')}${fin}`;
  });
}

/* Fuentes de Google Fonts e íconos de Phosphor desde el paquete, no desde un CDN: la app funciona sin conexión,
   no le cuenta a terceros qué pantallas se abren y la política de seguridad puede limitarse a 'self'. */
export function vendorizarRecursos(html, prefijo) {
  return html
    .replace(/[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*\n?/gi, '')
    .replace(/<link\s+href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"\s+rel="stylesheet"\s*\/?>/gi,
      `<link rel="stylesheet" href="${prefijo}vendor/fuentes/fuentes.css">`)
    .replace(/<link\s+rel="stylesheet"\s+href="https:\/\/cdn\.jsdelivr\.net\/npm\/@phosphor-icons\/web@[\d.]+\/src\/regular\/style\.css"[^>]*>/gi,
      `<link rel="stylesheet" href="${prefijo}vendor/phosphor/regular/style.css">`);
}

// Política de seguridad de contenido de la app. 'unsafe-inline' sigue siendo necesario porque el frontend usa
// scripts y manejadores en línea (onclick="…" con valores interpolados); ver docs/05-pruebas-seguridad-despliegue.md.
export function politicaDeSeguridad(origenesConexion = []) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    `connect-src 'self' blob: ${origenesConexion.join(' ')}`.trim(),
    "frame-src 'self'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

/* Primero la política (antes de que cargue cualquier recurso) y luego la capa móvil, antes de los scripts de la
   página: así window.SIMPLE_CONFIG existe cuando corre interprete.js y la sesión se revisa antes que sesion.js. */
export function inyectarCapaMovil(html, { prefijo, csp }) {
  const bloque = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<link rel="stylesheet" href="${prefijo}app-movil/app-movil.css">`,
    `<script src="${prefijo}app-movil/app-movil.js"></script>`
  ].join('\n  ');
  const charset = /<meta\s+charset="[^"]*"\s*\/?>/i;
  if (charset.test(html)) return html.replace(charset, m => `${m}\n  ${bloque}`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => `${m}\n  <meta charset="UTF-8">\n  ${bloque}`);
  throw new Error('La página no tiene <head>: no se puede inyectar la capa móvil');
}

// '../' por cada carpeta entre la página y la raíz de www (index.html → '', nuevoDiseno/tramite.html → '../')
export const prefijoDe = rutaRelativa => '../'.repeat(rutaRelativa.split('/').length - 1);

/* Página que reemplaza en la app a una copia capturada de un sitio oficial (el login de Identidad Digital y "Mi
   cuenta"): conserva la dirección para que los enlaces existentes sigan sirviendo y lleva a la pantalla de la app,
   con los mismos parámetros (?destino=…&n=…). */
export function paginaDeRedireccion({ destino, csp }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple.sv</title>
  <!-- Generada por app/scripts/construir-web.mjs: en la app esta dirección lleva a una pantalla propia -->
  <script>location.replace(${JSON.stringify(destino)} + location.search + location.hash);</script>
</head>
<body><p><a href="${destino}">Continuar</a></p></body>
</html>
`;
}

/* @font-face de un CSS de Fontsource, solo de los subconjuntos indicados y solo woff2 (todo WebView compatible lo
   lee). Devuelve el CSS y los archivos que hay que copiar. */
export function fuentesDeFontsource(css, { subconjuntos = ['latin', 'latin-ext'], carpeta }) {
  const archivos = [];
  const bloques = css.split('@font-face').slice(1).map(b => `@font-face${b.slice(0, b.indexOf('}') + 1)}`);
  const elegidos = bloques.filter(b => subconjuntos.some(s => new RegExp(`-${s}-\\d+-(normal|italic)\\.woff2`).test(b)))
    .map(b => b.replace(/src:\s*url\(\.\/files\/([^)]+\.woff2)\)\s*format\('woff2'\)[^;]*;/, (_, archivo) => {
      archivos.push(archivo);
      return `src: url(./${carpeta}/${archivo}) format('woff2');`;
    }));
  return { css: elegidos.join('\n'), archivos };
}

// Phosphor: el mismo CSS, con el @font-face reducido a woff2
export function phosphorSoloWoff2(css) {
  return css.replace(/src:\s*url\("\.\/Phosphor\.woff2"\)\s*format\("woff2"\)[^;]*;/, 'src: url("./Phosphor.woff2") format("woff2");');
}
