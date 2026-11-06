/* Pantalla de inicio de sesión (app-movil/inicio-sesion.html). Recibe los mismos parámetros que el login de la
   maqueta (?destino=…&n=…) o ?volver=/ruta interna cuando viene del desbloqueo. */
import { destinoTrasIniciarSesion, rutaInterna } from '../nucleo/destinos.js';
import { CLAVE_BIOMETRIA_OMITIDA, crearAviso, mensajeDeError, ocupar, textoDelPie } from './comunes.js';

// Adónde iba la persona: sobrevive si Android cierra la app mientras está en el navegador
const CLAVE_DESTINO = 'simple-app-destino-tras-ingreso';

export async function pantallaInicioSesion({ app, documento, ubicacion, almacenLocal, retornoAlAbrir }) {
  const { sesion, identidad, config } = app;
  const $ = selector => documento.querySelector(selector);
  const avisar = crearAviso($('#mensaje'));
  const botonIdentidad = $('#ingresar-identidad');
  const botonBiometria = $('#ingresar-biometria');
  const parametros = new URLSearchParams(ubicacion.search);
  const porParametros = new URL(destinoTrasIniciarSesion(ubicacion.search), ubicacion.href);
  const destino = rutaInterna(parametros.get('volver'), ubicacion.href) || porParametros.pathname + porParametros.search;
  $('#crear-identidad').href = config.enlaces.crearIdentidad;
  $('#pie').textContent = textoDelPie(config);

  if (sesion.haySesion()) { ubicacion.replace(destino); return; }
  botonBiometria.hidden = !sesion.biometriaActiva();

  async function continuar(hacia) {
    almacenLocal.borrar(CLAVE_DESTINO);
    const ofrecer = !sesion.biometriaActiva() && !almacenLocal.leer(CLAVE_BIOMETRIA_OMITIDA) && await sesion.biometriaDisponible();
    ubicacion.replace(ofrecer ? `biometria.html?siguiente=${encodeURIComponent(hacia)}` : hacia);
  }

  async function ingresar(accion, textoEspera) {
    ocupar([botonIdentidad, botonBiometria], true);
    avisar(textoEspera);
    try {
      await accion();
    } catch (error) {
      avisar(mensajeDeError(error) || '', 'error');
      botonBiometria.hidden = !sesion.biometriaActiva();
      ocupar([botonIdentidad, botonBiometria], false);
    }
  }

  botonIdentidad.addEventListener('click', () => ingresar(async () => {
    almacenLocal.guardar(CLAVE_DESTINO, destino);
    const resultado = await identidad.iniciar();
    avisar('Validando tu identidad…');
    await sesion.iniciar(resultado);
    await continuar(destino);
  }, 'Abriendo Identidad Digital…'));

  botonBiometria.addEventListener('click', () => ingresar(async () => {
    await sesion.desbloquear();
    ubicacion.replace(destino);
  }, 'Esperando tu huella o tu rostro…'));

  // La app se reabrió con el retorno del inicio de sesión (Android la cerró mientras la persona estaba en el navegador)
  const retorno = await retornoAlAbrir();
  if (retorno) {
    const hacia = rutaInterna(almacenLocal.leer(CLAVE_DESTINO), ubicacion.href) || destino;
    ingresar(async () => {
      await sesion.iniciar(identidad.completar(retorno));
      await continuar(hacia);
    }, 'Validando tu identidad…');
  }
}
