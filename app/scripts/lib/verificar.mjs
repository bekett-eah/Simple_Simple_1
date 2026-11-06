/* Revisa la carpeta www antes de empaquetarla: lo que entra aquí termina dentro del APK y cualquiera puede
   extraerlo. Lo usa el build (falla si hay problemas) y scripts/verificar-paquete.mjs. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const TEXTO = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest']);
const SECRETOS = [
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['clave de Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['clave de AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['clave de Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['token CSRF capturado', /name="csrf-token"\s+content="[^"]+"/i],
  ['token en la URL', /[?&](access_token|id_token|token)=[A-Za-z0-9._-]{16,}/]
];
const TERCEROS = [
  ['Google Fonts', /fonts\.(googleapis|gstatic)\.com/],
  ['CDN jsDelivr', /cdn\.jsdelivr\.net/],
  ['Google Analytics', /google-analytics|googletagmanager|\bgtag\(/]
];
// Partes de la maqueta que simulan servicios reales: no pueden ir en producción. Cuando se reemplacen por el servicio
// real, se quitan de aquí (docs/04-pagos.md y docs/05-pruebas-seguridad-despliegue.md)
const SIMULACIONES_DE_LA_MAQUETA = {
  'nuevoDiseno/pasarela-serfinsa.js': 'pasarela de pago simulada (aprueba el pago con una autorización al azar)',
  'nuevoDiseno/integraciones.js': 'integración simulada con SIMPLE v2 (las solicitudes no llegan a la institución)',
  'nuevoDiseno/ciudadano.js': 'datos fijos de la cuenta de prueba'
};
const HTTP_PERMITIDO = /http:\/\/www\.w3\.org\//;
// Referencias a otros archivos: src y href en HTML, url() en CSS
const REFERENCIAS = { '.html': /\b(?:src|href)="([^"]*)"/g, '.css': /url\(\s*['"]?([^'")]+)['"]?\s*\)/g };

export function listarArchivos(raiz) {
  return readdirSync(raiz, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => path.relative(raiz, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
}

/* Archivo de www al que apunta una referencia relativa, o null si no es una ruta local (otro esquema, un ancla o
   una dirección que arma un script, como href="tramite.html?n=' + n + '") */
export function destinoLocal(valor, desde) {
  if (!valor || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(valor) || /['"+${}<>]/.test(valor)) return null;
  let ruta = new URL(valor, `https://localhost/${desde}`).pathname;
  if (ruta.endsWith('/')) ruta += 'index.html';
  try {
    return decodeURIComponent(ruta.slice(1)).normalize('NFC');
  } catch {
    return ruta.slice(1);
  }
}

/* paginasSinCapa: páginas que no llevan la capa móvil a propósito (redirecciones y la página de error, que en Android
   no tiene acceso a los plugins). produccion: además rechaza las simulaciones de la maqueta.
   Devuelve { errores, total, mayores }. */
export function verificarWww(raiz, { paginasSinCapa = [], produccion = false } = {}) {
  const errores = [];
  const archivos = listarArchivos(raiz);
  const existentes = new Set(archivos.map(a => a.normalize('NFC')));
  if (produccion) {
    Object.entries(SIMULACIONES_DE_LA_MAQUETA)
      .filter(([archivo]) => existentes.has(archivo))
      .forEach(([archivo, descripcion]) => errores.push(`${archivo}: ${descripcion}; no puede ir en producción`));
  }
  let total = 0;
  const tamanos = [];
  for (const archivo of archivos) {
    const tamano = statSync(path.join(raiz, archivo)).size;
    total += tamano;
    tamanos.push([archivo, tamano]);
    if (!/^[\x20-\x7E]+$/.test(archivo)) errores.push(`${archivo}: la ruta tiene caracteres fuera de ASCII (fallaría dentro del APK)`);
    if (/(^|\/)(login_files|Identidad digital_files)\//.test(archivo)) errores.push(`${archivo}: copia capturada de un sitio oficial; no va en la app`);
    if (!TEXTO.has(path.extname(archivo).toLowerCase())) continue;

    const contenido = readFileSync(path.join(raiz, archivo), 'utf8');
    const linea = indice => contenido.slice(0, indice).split('\n').length;
    for (const [nombre, patron] of SECRETOS) {
      const encontrado = contenido.match(patron);
      if (encontrado) errores.push(`${archivo}:${linea(encontrado.index)}: posible ${nombre}`);
    }
    for (const [nombre, patron] of TERCEROS) {
      const encontrado = contenido.match(patron);
      if (encontrado) errores.push(`${archivo}:${linea(encontrado.index)}: depende de ${nombre}; la app debe usar recursos propios`);
    }
    for (const encontrado of contenido.matchAll(/http:\/\/[^\s"'`<>)]+/g)) {
      if (!HTTP_PERMITIDO.test(encontrado[0])) errores.push(`${archivo}:${linea(encontrado.index)}: dirección sin cifrar ${encontrado[0]}`);
    }
    const referencias = REFERENCIAS[path.extname(archivo).toLowerCase()];
    for (const encontrado of referencias ? contenido.matchAll(referencias) : []) {
      const destino = destinoLocal(encontrado[1].trim(), archivo);
      if (destino && !existentes.has(destino)) errores.push(`${archivo}:${linea(encontrado.index)}: apunta a ${encontrado[1].trim()}, que no está en www`);
    }
    if (archivo.endsWith('.html')) {
      if (!contenido.includes('http-equiv="Content-Security-Policy"')) errores.push(`${archivo}: falta la política de seguridad de contenido`);
      if (!paginasSinCapa.includes(archivo) && !contenido.includes('app-movil/app-movil.js')) errores.push(`${archivo}: falta la capa móvil (app-movil.js)`);
    }
  }
  const mayores = tamanos.sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { errores, total, mayores, archivos: archivos.length };
}
