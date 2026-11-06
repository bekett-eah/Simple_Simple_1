/* Adónde ir después de iniciar sesión o de desbloquear la app. Los destinos son la misma lista blanca de la maqueta
   web (nuevoDiseño/login.html, irADestino): solo números en los parámetros, así un enlace no puede mandar a otra
   página. Las rutas son relativas a las pantallas de la app (www/app-movil/). */
const BASE = '../nuevoDiseno/';
const DESTINOS = {
  tramites: 'Indexlogin.html',
  documentos: 'mis-tramites.html',
  whatsapp: 'whatsapp.html?hola=1',
  inicio: '../index.html',
  cuenta: '../app-movil/mi-cuenta.html'
};
const CON_NUMERO = {
  tramite: 'tramite.html?n=',
  pago: 'tramite.html?continuar=1&n=',
  whatsapp: 'whatsapp.html?hola=1&n=',
  cita: 'Indexlogin.html?cita=',
  asistente: 'Indexlogin.html?asistente=',
  inicio: '../index.html?asistente='
};

export function destinoTrasIniciarSesion(busqueda) {
  const parametros = new URLSearchParams(busqueda);
  const destino = parametros.get('destino');
  const numero = parametros.get('n') || '';
  const solicitud = parametros.get('tramite') || '';
  if (Object.hasOwn(CON_NUMERO, destino) && /^\d{1,4}$/.test(numero)) return BASE + CON_NUMERO[destino] + numero;
  if (destino === 'documentos' && /^\d{7}$/.test(solicitud)) return `${BASE}${DESTINOS.documentos}?tramite=${solicitud}`;
  return BASE + ((Object.hasOwn(DESTINOS, destino) && DESTINOS[destino]) || DESTINOS.tramites);
}

/* Ruta interna a la que volver (?volver=… del desbloqueo). Solo páginas de la propia app, nunca otro origen:
   devuelve la ruta con su búsqueda o null si no es segura. pagina: la dirección de la página actual. Se comparan el
   esquema y el host, no URL.origin, que vale "null" con el esquema propio de iOS (capacitor://localhost). */
const PAGINAS = /^\/(index\.html|nuevoDiseno\/[A-Za-z-]+\.html|app-movil\/[a-z-]+\.html)?$/;

export function rutaInterna(valor, pagina) {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')) return null;
  try {
    const base = new URL(pagina);
    const url = new URL(valor, base);
    if (url.protocol !== base.protocol || url.host !== base.host || !PAGINAS.test(url.pathname)) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
