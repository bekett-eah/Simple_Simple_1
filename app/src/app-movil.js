/* Capa móvil de Simple.sv. scripts/construir-web.mjs la inyecta al inicio del <head> de cada página de la app, antes
   que los scripts del frontend web, que se reutilizan tal cual.
   Al cargar (sin esperar al DOM):
   - window.SIMPLE_CONFIG para el frontend (dirección del asistente con IA) y clases en <html> (app-movil, app-android).
   - La marca de sesión de la maqueta se alinea con la sesión real; si la app se abrió en frío y la persona activó la
     biometría, primero va al desbloqueo.
   Con el DOM listo: botón Atrás, enlaces externos, descargas, aviso sin conexión, bloqueo por inactividad y el
   controlador de la pantalla propia que corresponda.
   Las piezas se eligen según la configuración del ambiente (config/<entorno>.json, embebida por el build). */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';
import { crearAlmacen, storageEnMemoria } from './nucleo/almacen.js';
import { crearClienteHttp } from './nucleo/http.js';
import { abrirEnlacesExternos, manejarBotonAtras, manejarDescargas } from './nucleo/navegacion.js';
import { vigilarConexion } from './nucleo/red.js';
import { crearBackendHttp } from './backend/backend-http.js';
import { crearBackendSimulado } from './backend/backend-simulado.js';
import { crearProveedorOidc } from './identidad/proveedor-oidc.js';
import { crearProveedorSimulado } from './identidad/proveedor-simulado.js';
import { crearBiometriaNativa, crearBiometriaSimulada } from './sesion/biometria.js';
import { CLAVES, crearGestorSesion } from './sesion/sesion.js';
import { crearServicioPagos } from './pagos/servicio-pagos.js';
import { formatearMonto } from './pagos/estados.js';
import { crearPasarelaRedireccion, crearPasarelaSimulada } from './pagos/pasarelas.js';
import { preguntar } from './ui/dialogo.js';
import { CONTROLADORES } from './controladores/index.js';
import { CLAVE_DESBLOQUEO_OMITIDO } from './controladores/comunes.js';

/* global __CONFIG_APP__ */
const config = __CONFIG_APP__;
const nativa = Capacitor.isNativePlatform();
const raiz = document.documentElement;
const pantalla = raiz.dataset.pantalla || null;
// pago.html también se abre dentro de un iframe del asistente: ahí no se registran los eventos nativos
const marcoPrincipal = window.top === window;
// Raíz de www (este script está en www/app-movil/)
const RAIZ_WWW = new URL('../', document.currentScript.src);

// Cuenta de prueba de la maqueta (nuevoDiseño/ciudadano.js): la usa el backend simulado. El documento llega enmascarado
const USUARIO_PRUEBA = { id: 'usuario-prueba', nombre: 'María Fernanda López García', documento: '*****097-8' };

const almacenamiento = nombre => { try { return window[nombre] || storageEnMemoria(); } catch { return storageEnMemoria(); } };
const local = crearAlmacen(almacenamiento('localStorage'));
const deSesion = crearAlmacen(almacenamiento('sessionStorage'));
const espera = ms => new Promise(resolver => setTimeout(resolver, ms));

window.SIMPLE_CONFIG = Object.freeze({ entorno: config.entorno, asistenteUrl: config.servicios.asistente });
raiz.classList.add('app-movil', `app-${Capacitor.getPlatform()}`);
/* El WebView de Android no convierte voz en texto: sin reconocimiento de voz no se ofrece el dictado. En iOS tampoco,
   hasta declarar los permisos de micrófono y de reconocimiento de voz y probarlo (docs/06-preparacion-ios.md) */
const sinDictado = Capacitor.getPlatform() === 'ios' || (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window));
if (sinDictado) raiz.classList.add('app-sin-dictado');

/* ----- Integraciones con el sistema ----- */
const navegadorSistema = {
  abrir: url => Browser.open({ url, toolbarColor: '#1C1E4D' }),
  alCerrar: funcion => {
    const manejador = Browser.addListener('browserFinished', funcion);
    return () => { manejador.then(m => m.remove()); };
  }
};
const retornosApp = {
  alRecibir: funcion => {
    const manejador = App.addListener('appUrlOpen', evento => funcion(evento.url));
    return () => { manejador.then(m => m.remove()); };
  }
};

// Trámite de una solicitud (para el backend simulado): las de este navegador (integraciones.js) y las de la cuenta
function tramiteDeSolicitud(solicitudId) {
  const solicitudes = [...(window.INTEGRACIONES?.guardadas?.() || []), ...(window.MIS_TRAMITES || [])];
  const numero = solicitudes.find(s => s.id === solicitudId)?.numero;
  const tramite = (window.CATALOGO_TRAMITES || []).find(t => t.numero === numero);
  return tramite ? { numero, nombre: tramite.nombre, costo: tramite.costo } : null;
}

const backend = config.backend.tipo === 'http'
  ? crearBackendHttp({ http: crearClienteHttp({ base: config.backend.url }) })
  : crearBackendSimulado({ almacen: local, usuario: USUARIO_PRUEBA, tramiteDe: tramiteDeSolicitud, latencia: () => espera(350) });

const identidad = config.identidad.proveedor === 'oidc'
  ? crearProveedorOidc({ config: config.identidad, navegador: navegadorSistema, retornos: retornosApp, almacen: local })
  : crearProveedorSimulado({
    confirmar: () => preguntar({
      etiqueta: 'Identidad Digital simulada',
      titulo: 'Ingresar con la cuenta de prueba',
      mensaje: `En el ambiente de ${config.entorno} la app no se conecta con Identidad Digital: entra con la cuenta de prueba de la maqueta.`,
      detalle: [USUARIO_PRUEBA.nombre, `Documento ${USUARIO_PRUEBA.documento}`],
      aceptar: 'Ingresar'
    })
  });

const sinBiometria = { simulada: false, disponibilidad: async () => ({ disponible: false }), guardar: async () => {}, leer: async () => null, eliminar: async () => {} };
const biometria = nativa
  ? crearBiometriaNativa()
  : config.entorno === 'produccion'
    ? sinBiometria
    : crearBiometriaSimulada({
      almacen: local,
      confirmar: texto => preguntar({
        etiqueta: 'Biometría simulada',
        titulo: texto,
        mensaje: 'En el navegador no hay sensor: esto simula la huella o el rostro del teléfono.',
        aceptar: 'Usar huella simulada'
      })
    });

const marca = {
  poner: () => { try { localStorage.setItem(CLAVES.marcaMaqueta, '1'); } catch { /* sin almacenamiento */ } },
  quitar: () => { try { localStorage.removeItem(CLAVES.marcaMaqueta); } catch { /* sin almacenamiento */ } }
};
const sesion = crearGestorSesion({ backend, biometria, almacenSesion: deSesion, almacenLocal: local, marca, plataforma: Capacitor.getPlatform(), config: config.sesion });

const pagos = crearServicioPagos({
  backend, sesion, almacen: local,
  pasarelas: config.pagos.pasarela === 'simulada'
    ? {
      tarjeta: crearPasarelaSimulada({
        backend,
        confirmar: orden => preguntar({
          etiqueta: 'Pasarela simulada',
          titulo: `Pagar ${formatearMonto(orden.monto)}`,
          mensaje: `${orden.concepto}. No se cobra nada: la simulación hace de pasarela y avisa al backend simulado.`,
          aceptar: 'Aprobar pago',
          cancelar: 'Rechazar pago'
        })
      })
    }
    : { tarjeta: crearPasarelaRedireccion({ navegador: navegadorSistema }) }
});

// Quien cierra sesión no quiere que se le pida la huella enseguida: vuelve a pedirse al abrir la app otra vez
async function cerrarSesion() {
  deSesion.guardar(CLAVE_DESBLOQUEO_OMITIDO, true);
  await sesion.cerrar();
}

window.SIMPLE_APP = Object.freeze({ config, nativa, sesion, identidad, pagos, preguntar, cerrarSesion });

/* ----- Sesión al cargar la página ----- */
const enPantallaPropia = pantalla !== null;
const rutaActual = () => location.pathname + location.search;
const irA = (pagina, volver = rutaActual()) => location.replace(new URL(`app-movil/${pagina}?volver=${encodeURIComponent(volver)}`, RAIZ_WWW));

/* Dirección con la que Android abrió la app, si es un retorno del inicio de sesión que aún no se procesó: Android pudo
   cerrar la app mientras la persona estaba en el navegador, y entonces la app vuelve a abrir en index.html. La
   solicitud pendiente sigue en localStorage. getLaunchUrl repite la misma dirección mientras viva el proceso, por eso
   se anota cuál ya se usó. tomar: false solo consulta. */
const CLAVE_RETORNO_PROCESADO = 'simple-app-retorno-procesado';
async function retornoAlAbrir({ tomar }) {
  if (!nativa || !identidad.completar || !identidad.haySolicitudPendiente()) return null;
  const url = (await App.getLaunchUrl().catch(() => null))?.url;
  if (!url?.startsWith(config.identidad.redireccion) || deSesion.leer(CLAVE_RETORNO_PROCESADO) === url) return null;
  if (tomar) deSesion.guardar(CLAVE_RETORNO_PROCESADO, url);
  return url;
}

// Sin sesión y con la biometría activada, primero se desbloquea (salvo que la persona eligiera seguir sin sesión)
function pedirDesbloqueo() {
  if (!enPantallaPropia && !sesion.haySesion() && sesion.biometriaActiva() && !deSesion.leer(CLAVE_DESBLOQUEO_OMITIDO)) irA('desbloqueo.html');
}

sesion.sincronizarMarca();
if (marcoPrincipal) {
  // Un inicio de sesión que quedó a medias tiene prioridad sobre el desbloqueo
  if (pantalla !== 'inicio-sesion' && nativa && identidad.completar && identidad.haySolicitudPendiente()) {
    retornoAlAbrir({ tomar: false }).then(url => (url ? location.replace(new URL('app-movil/inicio-sesion.html', RAIZ_WWW)) : pedirDesbloqueo()));
  } else {
    pedirDesbloqueo();
  }
}

/* ----- Con el DOM listo ----- */
function avisar(texto) {
  const aviso = document.createElement('div');
  aviso.className = 'app-aviso';
  aviso.setAttribute('role', 'status');
  aviso.textContent = texto;
  document.body.append(aviso);
  setTimeout(() => aviso.remove(), 4000);
}

// Al volver de segundo plano tras el tiempo de inactividad, la sesión se bloquea
function alVolver() {
  if (!sesion.volverAlFrente()) return;
  irA(sesion.biometriaActiva() ? 'desbloqueo.html' : 'inicio-sesion.html');
}

// "Cerrar sesión" del menú de la maqueta (enlace con el ícono ph-sign-out): también cierra la sesión real
function cerrarDesdeElMenu(evento) {
  const enlace = evento.target.closest?.('a.l2-menu-item');
  if (!enlace?.querySelector('.ph-sign-out')) return;
  evento.preventDefault();
  cerrarSesion().finally(() => { location.href = enlace.href; });
}

document.addEventListener('DOMContentLoaded', () => {
  // Las pantallas propias ya indican el ambiente al pie
  if (config.entorno !== 'produccion' && !enPantallaPropia) {
    const etiqueta = document.createElement('div');
    etiqueta.className = 'app-entorno';
    etiqueta.setAttribute('aria-hidden', 'true');
    etiqueta.textContent = `${config.entorno} · datos simulados`;
    document.body.append(etiqueta);
  }
  document.addEventListener('click', cerrarDesdeElMenu, true);
  if (marcoPrincipal) {
    vigilarConexion({ Network });
    if (nativa) {
      manejarBotonAtras({ App });
      abrirEnlacesExternos({ abrirExterno: url => navegadorSistema.abrir(url) });
      manejarDescargas({ Filesystem, Directory, Share, avisar });
      App.addListener('pause', () => sesion.pasarASegundoPlano());
      App.addListener('resume', alVolver);
    } else {
      document.addEventListener('visibilitychange', () => (document.hidden ? sesion.pasarASegundoPlano() : alVolver()));
    }
  }
  const controlador = CONTROLADORES[pantalla];
  if (controlador) {
    controlador({
      app: window.SIMPLE_APP, documento: document, ubicacion: location, almacenLocal: local, almacenSesion: deSesion,
      retornoAlAbrir: () => retornoAlAbrir({ tomar: true })
    });
  }
});
