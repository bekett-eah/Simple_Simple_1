/* Utilidades de las pantallas propias de la app */
import { ErrorBiometria } from '../sesion/biometria.js';
import { ErrorIdentidad } from '../identidad/errores.js';
import { ErrorSesion } from '../sesion/sesion.js';
import { ErrorHttp } from '../nucleo/http.js';

export const CLAVE_BIOMETRIA_OMITIDA = 'simple-app-biometria-omitida';
export const CLAVE_DESBLOQUEO_OMITIDO = 'simple-app-desbloqueo-omitido';

export function crearAviso(nodo) {
  return (texto, tipo = '') => {
    nodo.textContent = texto;
    nodo.className = `app-mensaje ${tipo}`.trim();
  };
}

// Mensaje para la persona; null si no hace falta decir nada (por ejemplo, si canceló la huella)
export function mensajeDeError(error) {
  if (error instanceof ErrorBiometria) {
    if (error.motivo === 'cancelado') return null;
    if (error.motivo === 'bloqueada') return 'Hubo demasiados intentos. Espera un momento o entra con Identidad Digital.';
    if (error.motivo === 'no_disponible') return 'Este teléfono no tiene huella ni rostro configurados.';
    return 'No se reconoció tu huella o tu rostro. Intenta de nuevo.';
  }
  if (error instanceof ErrorIdentidad) {
    return error.motivo === 'cancelado' ? 'Se canceló el inicio de sesión.' : 'No se pudo completar el inicio de sesión. Intenta de nuevo.';
  }
  if (error instanceof ErrorSesion) return error.message;
  if (error instanceof ErrorHttp && (error.codigo === 'sin_red' || error.codigo === 'tiempo_agotado')) {
    return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  }
  return 'Ocurrió un problema. Intenta de nuevo.';
}

// Versión y ambiente al pie de la pantalla (fuera de producción, también qué está simulado)
export function textoDelPie(config) {
  const { version, commit } = config.compilacion;
  const base = `Simple.sv ${version} (${commit})`;
  if (config.entorno === 'produccion') return base;
  return `${base} · ambiente de ${config.entorno}: Identidad Digital, sesión y pagos simulados`;
}

export function ocupar(botones, ocupados) {
  botones.forEach(boton => { boton.disabled = ocupados; });
}
