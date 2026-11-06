/* Pantalla para activar la biometría después del primer ingreso (app-movil/biometria.html?siguiente=/ruta) */
import { rutaInterna } from '../nucleo/destinos.js';
import { CLAVE_BIOMETRIA_OMITIDA, crearAviso, mensajeDeError, ocupar } from './comunes.js';

export function pantallaBiometria({ app, documento, ubicacion, almacenLocal }) {
  const { sesion } = app;
  const $ = selector => documento.querySelector(selector);
  const avisar = crearAviso($('#mensaje'));
  const activar = $('#activar');
  const omitir = $('#omitir');
  const siguiente = rutaInterna(new URLSearchParams(ubicacion.search).get('siguiente'), ubicacion.href) || '/nuevoDiseno/Indexlogin.html';

  if (!sesion.haySesion()) { ubicacion.replace('inicio-sesion.html'); return; }

  activar.addEventListener('click', async () => {
    ocupar([activar, omitir], true);
    avisar('Confirma con tu huella o tu rostro…');
    try {
      await sesion.activarBiometria();
      avisar('Listo: la próxima vez entra con tu huella o tu rostro.', 'exito');
      setTimeout(() => ubicacion.replace(siguiente), 900);
    } catch (error) {
      avisar(mensajeDeError(error) || 'No se activó. Puedes hacerlo después en Mi cuenta.', 'error');
      ocupar([activar, omitir], false);
    }
  });

  // No se vuelve a ofrecer: queda en Mi cuenta
  omitir.addEventListener('click', () => {
    almacenLocal.guardar(CLAVE_BIOMETRIA_OMITIDA, true);
    ubicacion.replace(siguiente);
  });
}
