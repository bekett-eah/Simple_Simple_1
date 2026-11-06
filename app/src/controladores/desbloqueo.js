/* Desbloqueo con biometría al abrir la app o al volver después de un rato sin usarla
   (app-movil/desbloqueo.html?volver=/ruta). Pide la huella apenas se abre. */
import { rutaInterna } from '../nucleo/destinos.js';
import { CLAVE_DESBLOQUEO_OMITIDO, crearAviso, mensajeDeError, ocupar } from './comunes.js';

export function pantallaDesbloqueo({ app, documento, ubicacion, almacenSesion }) {
  const { sesion } = app;
  const $ = selector => documento.querySelector(selector);
  const avisar = crearAviso($('#mensaje'));
  const boton = $('#desbloquear');
  const volver = rutaInterna(new URLSearchParams(ubicacion.search).get('volver'), ubicacion.href) || '/index.html';
  $('#usar-identidad').href = `inicio-sesion.html?volver=${encodeURIComponent(volver)}`;

  if (sesion.haySesion()) { ubicacion.replace(volver); return; }
  if (!sesion.biometriaActiva()) { ubicacion.replace(`inicio-sesion.html?volver=${encodeURIComponent(volver)}`); return; }

  async function desbloquear() {
    ocupar([boton], true);
    avisar('Esperando tu huella o tu rostro…');
    try {
      await sesion.desbloquear();
      ubicacion.replace(volver);
    } catch (error) {
      avisar(mensajeDeError(error) || '', 'error');
      // Si la credencial se borró (biometría cambiada o dispositivo revocado) solo queda Identidad Digital
      boton.hidden = !sesion.biometriaActiva();
      ocupar([boton], false);
    }
  }

  boton.addEventListener('click', desbloquear);
  // Seguir sin sesión: no se vuelve a pedir la huella hasta que la app se cierre
  $('#sin-sesion').addEventListener('click', () => {
    almacenSesion.guardar(CLAVE_DESBLOQUEO_OMITIDO, true);
    ubicacion.replace(volver);
  });
  desbloquear();
}
