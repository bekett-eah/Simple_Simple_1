/* Inicio de sesión con Identidad Digital por OpenID Connect: código de autorización con PKCE en el navegador del
   sistema (Custom Tabs), nunca en un WebView (RFC 8252). Es la hipótesis del plan (fase 3) y solo se activa con
   identidad.proveedor = "oidc" y los datos que entregue el proveedor (emisor, clienteId): no hay direcciones fijas
   en el código, el endpoint de autorización sale del documento de descubrimiento del emisor.
   La app no canjea el código: lo entrega al backend junto con el verificador y el nonce, y el backend valida los
   tokens (firma, emisor, audiencia, expiración, nonce) y crea la sesión de la app. */
import { nuevaSolicitud } from './pkce.js';
import { ErrorIdentidad } from './errores.js';

const CLAVE_PENDIENTE = 'simple-app-oidc-pendiente';
const VIGENCIA_SOLICITUD = 10 * 60 * 1000;
const ESPERA_TRAS_CERRAR = 1500;

/* navegador: { abrir(url), alCerrar(fn) } (Custom Tabs). retornos: { alRecibir(fn) } (enlaces sv.simple.app:/…).
   almacen: localStorage, porque Android puede cerrar la app mientras la persona está en el navegador y la solicitud
   pendiente debe sobrevivir; dura 10 minutos y se borra al usarla. */
export function crearProveedorOidc({ config, navegador, retornos, almacen, fetch = globalThis.fetch.bind(globalThis), ahora = Date.now, cripto = globalThis.crypto }) {
  const { emisor, clienteId, redireccion, alcances } = config;
  let descubrimiento = null;

  async function descubrir() {
    if (descubrimiento) return descubrimiento;
    const respuesta = await fetch(new URL('.well-known/openid-configuration', emisor.endsWith('/') ? emisor : `${emisor}/`).href,
      { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' });
    if (!respuesta.ok) throw new ErrorIdentidad('descubrimiento', `El proveedor respondió ${respuesta.status}`);
    const documento = await respuesta.json();
    // El documento debe ser del mismo emisor configurado y el endpoint, https (RFC 8414, sección 3.3)
    if (documento.issuer !== emisor) throw new ErrorIdentidad('descubrimiento', 'El emisor del documento no coincide');
    if (!String(documento.authorization_endpoint).startsWith('https://')) throw new ErrorIdentidad('descubrimiento', 'Endpoint de autorización inválido');
    descubrimiento = documento;
    return documento;
  }

  /* Valida la dirección de retorno contra la solicitud pendiente y devuelve lo que el backend necesita para canjear
     el código. Se exporta para completar el inicio de sesión si la app se reabrió desde el enlace. */
  function completar(urlRetorno) {
    const pendiente = almacen.leer(CLAVE_PENDIENTE);
    almacen.borrar(CLAVE_PENDIENTE);
    if (!pendiente || ahora() - pendiente.creada > VIGENCIA_SOLICITUD) throw new ErrorIdentidad('vencida', 'El inicio de sesión tardó demasiado');
    if (!urlRetorno.startsWith(redireccion)) throw new ErrorIdentidad('retorno', 'Dirección de retorno inesperada');
    const parametros = new URL(urlRetorno).searchParams;
    if (parametros.get('state') !== pendiente.state) throw new ErrorIdentidad('state', 'La respuesta no corresponde a esta solicitud');
    // RFC 9207: si el proveedor informa el emisor, debe ser el esperado (defensa contra mezcla de proveedores)
    if (parametros.has('iss') && parametros.get('iss') !== emisor) throw new ErrorIdentidad('emisor', 'La respuesta viene de otro emisor');
    if (parametros.has('error')) throw new ErrorIdentidad(parametros.get('error') === 'access_denied' ? 'cancelado' : 'proveedor', parametros.get('error_description') || parametros.get('error'));
    const code = parametros.get('code');
    if (!code) throw new ErrorIdentidad('retorno', 'La respuesta no trae el código de autorización');
    return { proveedor: 'oidc', code, codeVerifier: pendiente.codeVerifier, nonce: pendiente.nonce, redirectUri: redireccion };
  }

  async function iniciar() {
    const { authorization_endpoint: endpoint } = await descubrir();
    const solicitud = await nuevaSolicitud(cripto);
    almacen.guardar(CLAVE_PENDIENTE, { state: solicitud.state, nonce: solicitud.nonce, codeVerifier: solicitud.codeVerifier, creada: ahora() });
    const url = new URL(endpoint);
    Object.entries({
      response_type: 'code', client_id: clienteId, redirect_uri: redireccion, scope: alcances.join(' '),
      state: solicitud.state, nonce: solicitud.nonce, code_challenge: solicitud.codeChallenge, code_challenge_method: 'S256'
    }).forEach(([clave, valor]) => url.searchParams.set(clave, valor));

    let fallar;
    const resultado = new Promise((resolver, rechazar) => {
      let terminado = false;
      const terminar = accion => { if (!terminado) { terminado = true; quitarRetorno(); quitarCierre(); accion(); } };
      const quitarRetorno = retornos.alRecibir(urlRetorno => {
        if (!urlRetorno.startsWith(redireccion)) return;
        terminar(() => { try { resolver(completar(urlRetorno)); } catch (error) { rechazar(error); } });
      });
      // Sin retorno, la solicitud ya no sirve: se borra para que un enlace viejo no se confunda con ella
      fallar = error => terminar(() => { almacen.borrar(CLAVE_PENDIENTE); rechazar(error); });
      // Al volver por el enlace, Android también cierra el navegador: se espera un momento antes de darlo por cancelado
      const quitarCierre = navegador.alCerrar(() => setTimeout(() => fallar(new ErrorIdentidad('cancelado', 'Se cerró el inicio de sesión')), ESPERA_TRAS_CERRAR));
    });
    try {
      await navegador.abrir(url.href);
    } catch (error) {
      fallar(error);
    }
    return resultado;
  }

  function haySolicitudPendiente() {
    const pendiente = almacen.leer(CLAVE_PENDIENTE);
    return Boolean(pendiente && ahora() - pendiente.creada <= VIGENCIA_SOLICITUD);
  }

  return { nombre: 'oidc', iniciar, completar, haySolicitudPendiente };
}
