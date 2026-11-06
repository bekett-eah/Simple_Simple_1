/* Mi cuenta en la app (app-movil/mi-cuenta.html): datos de la sesión, biometría, cerrar sesión y desvincular el
   teléfono (plan, fase 4: "Permitir cerrar sesión y desvincular un dispositivo"). */
import { crearAviso, mensajeDeError, ocupar, textoDelPie } from './comunes.js';

export async function pantallaMiCuenta({ app, documento, ubicacion }) {
  const { sesion, config, preguntar, cerrarSesion } = app;
  const $ = selector => documento.querySelector(selector);
  const avisar = crearAviso($('#mensaje'));
  const alternar = $('#alternar-biometria');
  const cerrar = $('#cerrar-sesion');
  const desvincular = $('#desvincular');
  const botones = [alternar, cerrar, desvincular];
  $('#pie').textContent = textoDelPie(config);
  $('#ir-identidad').href = config.enlaces.crearIdentidad;

  if (!sesion.haySesion()) { ubicacion.replace('inicio-sesion.html?destino=cuenta'); return; }
  const usuario = sesion.actual();
  $('#nombre').textContent = usuario?.nombre || '—';
  $('#documento').textContent = usuario?.documento || '—';

  const disponible = await sesion.biometriaDisponible();
  function pintarBiometria() {
    const activa = sesion.biometriaActiva();
    $('#estado-biometria').textContent = disponible
      ? `Huella o rostro: ${activa ? 'activado' : 'desactivado'}`
      : 'Este teléfono no tiene huella ni rostro configurados';
    alternar.hidden = !disponible;
    alternar.textContent = activa ? 'Desactivar' : 'Activar';
  }
  pintarBiometria();

  async function ejecutar(accion) {
    ocupar(botones, true);
    try {
      await accion();
    } catch (error) {
      avisar(mensajeDeError(error) || '', 'error');
    } finally {
      ocupar(botones, false);
      pintarBiometria();
    }
  }

  alternar.addEventListener('click', () => ejecutar(async () => {
    if (sesion.biometriaActiva()) {
      await sesion.desactivarBiometria();
      avisar('Listo: ya no se usará tu huella o tu rostro en este teléfono.', 'exito');
    } else {
      await sesion.activarBiometria();
      avisar('Listo: la próxima vez entra con tu huella o tu rostro.', 'exito');
    }
  }));

  cerrar.addEventListener('click', () => ejecutar(async () => {
    await cerrarSesion();
    ubicacion.replace('../index.html');
  }));

  desvincular.addEventListener('click', () => ejecutar(async () => {
    const confirmado = await preguntar({
      etiqueta: 'Desvincular este teléfono',
      titulo: '¿Desvincular este teléfono?',
      mensaje: 'Se cerrará tu sesión y se borrará el ingreso con huella o rostro. Para volver a usar la app tendrás que entrar con Identidad Digital.',
      aceptar: 'Desvincular',
      cancelar: 'Cancelar'
    });
    if (!confirmado) return;
    await sesion.desvincular();
    ubicacion.replace('../index.html');
  }));
}
