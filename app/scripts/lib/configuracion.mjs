/* Configuración de la app por ambiente (config/<entorno>.json): se valida antes de construir y viaja dentro del
   paquete, así que solo puede llevar valores públicos (direcciones, identificador de cliente). Ningún secreto:
   los secretos del proveedor de identidad y de la pasarela viven en el backend (plan, fases 3 y 5).
   En producción no se aceptan simuladores ni datos pendientes: el build se detiene con la lista de lo que falta. */
import { readFileSync } from 'node:fs';

export const ENTORNOS = ['desarrollo', 'pruebas', 'produccion'];
const CLAVES_PROHIBIDAS = /secret|secreto|password|contrase|private|privad|token|api[_-]?key/i;

const esHttps = valor => {
  try { return new URL(valor).protocol === 'https:'; } catch { return false; }
};

// Busca claves que parezcan secretos en cualquier nivel del objeto
function clavesSospechosas(objeto, ruta = '') {
  if (!objeto || typeof objeto !== 'object') return [];
  return Object.entries(objeto).flatMap(([clave, valor]) => {
    const aqui = ruta ? `${ruta}.${clave}` : clave;
    return [...(CLAVES_PROHIBIDAS.test(clave) ? [aqui] : []), ...clavesSospechosas(valor, aqui)];
  });
}

/* Devuelve la lista de errores (vacía si la configuración sirve). appId: el de capacitor.config.json, porque la
   dirección de retorno del inicio de sesión debe usar su esquema (RFC 8252, sección 7.1). */
export function validar(config, { entorno, appId }) {
  const errores = [];
  const exigir = (condicion, mensaje) => { if (!condicion) errores.push(mensaje); };
  exigir(config.entorno === entorno, `"entorno" debe ser "${entorno}" (es "${config.entorno}")`);
  clavesSospechosas(config).forEach(c => errores.push(`"${c}" parece un secreto: los secretos van en el backend, nunca en la app`));

  const { servicios = {}, backend = {}, identidad = {}, pagos = {}, sesion = {}, enlaces = {} } = config;
  exigir(servicios.asistente === null || esHttps(servicios.asistente), 'servicios.asistente debe ser null o una dirección https');
  exigir(['simulado', 'http'].includes(backend.tipo), 'backend.tipo debe ser "simulado" o "http"');
  if (backend.tipo === 'http') exigir(esHttps(backend.url), 'backend.url debe ser una dirección https del backend de la app');

  exigir(['simulado', 'oidc'].includes(identidad.proveedor), 'identidad.proveedor debe ser "simulado" u "oidc"');
  if (identidad.proveedor === 'oidc') {
    exigir(esHttps(identidad.emisor), 'identidad.emisor (issuer de Identidad Digital) debe ser una dirección https: pedirlo al proveedor');
    exigir(typeof identidad.clienteId === 'string' && identidad.clienteId.length > 0, 'identidad.clienteId: pedir el identificador de cliente al proveedor');
    exigir(typeof identidad.redireccion === 'string' && identidad.redireccion.startsWith(`${appId}:/`),
      `identidad.redireccion debe usar el esquema de la app (${appId}:/…)`);
    exigir(Array.isArray(identidad.alcances) && identidad.alcances.includes('openid'), 'identidad.alcances debe incluir "openid"');
    exigir(backend.tipo === 'http', 'con identidad "oidc" el backend debe ser "http": es quien canjea el código y valida los tokens');
  }

  exigir(['simulada', 'backend'].includes(pagos.pasarela), 'pagos.pasarela debe ser "simulada" o "backend"');
  if (pagos.pasarela === 'backend') exigir(backend.tipo === 'http', 'pagos por "backend" requieren backend.tipo "http"');

  exigir(Number.isInteger(sesion.minutosInactividad) && sesion.minutosInactividad >= 1 && sesion.minutosInactividad <= 60,
    'sesion.minutosInactividad debe ser un entero entre 1 y 60');
  exigir(Number.isInteger(sesion.segundosRenovacionAnticipada) && sesion.segundosRenovacionAnticipada >= 0 && sesion.segundosRenovacionAnticipada <= 600,
    'sesion.segundosRenovacionAnticipada debe ser un entero entre 0 y 600');
  exigir(esHttps(enlaces.crearIdentidad), 'enlaces.crearIdentidad debe ser una dirección https');

  if (entorno === 'produccion') {
    exigir(config.depuracion === false, 'producción no puede tener "depuracion": true');
    exigir(backend.tipo !== 'simulado', 'producción no puede usar el backend simulado');
    exigir(identidad.proveedor !== 'simulado', 'producción no puede usar la identidad simulada');
    exigir(pagos.pasarela !== 'simulada', 'producción no puede usar la pasarela simulada');
  }
  return errores;
}

// Orígenes a los que la app puede conectarse (connect-src de la política de seguridad de contenido)
export function origenesDeConexion(config) {
  const urls = [config.servicios?.asistente, config.backend?.tipo === 'http' ? config.backend.url : null,
    config.identidad?.proveedor === 'oidc' ? config.identidad.emisor : null];
  return [...new Set(urls.filter(Boolean).map(u => new URL(u).origin))];
}

/* Lee config/<entorno>.json. SIMPLE_ASISTENTE_URL permite apuntar el asistente con IA a un servidor de prueba sin
   editar el archivo (debe ser https: la app corre en https://localhost y el WebView bloquea el contenido mixto). */
export function cargar(entorno, { raiz, appId, variables = process.env }) {
  if (!ENTORNOS.includes(entorno)) throw new Error(`Ambiente desconocido "${entorno}". Usa: ${ENTORNOS.join(', ')}`);
  const config = JSON.parse(readFileSync(new URL(`config/${entorno}.json`, raiz), 'utf8'));
  if (variables.SIMPLE_ASISTENTE_URL) config.servicios = { ...config.servicios, asistente: variables.SIMPLE_ASISTENTE_URL };
  const errores = validar(config, { entorno, appId });
  if (errores.length) {
    const error = new Error(`La configuración de "${entorno}" no sirve:\n  - ${errores.join('\n  - ')}`);
    error.errores = errores;
    throw error;
  }
  return config;
}
