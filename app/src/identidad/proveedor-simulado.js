/* Identidad Digital simulada para desarrollo y pruebas, mientras no haya ambiente de pruebas del proveedor.
   Sigue la misma forma que el proveedor real (state, nonce y PKCE) para que el resto de la app no cambie, y siempre
   muestra que es una simulación. La validación del build impide usarla en producción. */
import { aleatorio, nuevaSolicitud } from './pkce.js';
import { ErrorIdentidad } from './errores.js';

// confirmar(): muestra la pantalla simulada del proveedor y resuelve true si la persona acepta
export function crearProveedorSimulado({ confirmar, cripto = globalThis.crypto }) {
  async function iniciar() {
    const solicitud = await nuevaSolicitud(cripto);
    if (!(await confirmar())) throw new ErrorIdentidad('cancelado', 'Se canceló el inicio de sesión');
    return { proveedor: 'simulado', code: `simulado-${aleatorio(16, cripto)}`, codeVerifier: solicitud.codeVerifier, nonce: solicitud.nonce, redirectUri: 'simulado' };
  }
  return { nombre: 'simulado', iniciar, completar: null, haySolicitudPendiente: () => false };
}
