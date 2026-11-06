/* Pagos de trámites desde la app (plan, fase 5), sin depender de una sola pasarela:
   1. El backend crea la orden y calcula el monto (la app nunca lo envía).
   2. La persona elige un método de los que el backend ofrece y la pasarela correspondiente lo procesa.
   3. El resultado se confirma consultando al backend, que lo verificó con la pasarela: lo que muestre la pasarela en
      pantalla no marca nada como pagado.
   La clave de idempotencia es la misma para todos los reintentos de una solicitud (doble toque, recarga, red que
   falla): el backend devuelve la misma orden y no puede cobrar dos veces. */
import { esFinal, sePuedePagar } from './estados.js';

const CLAVES_ORDEN = 'simple-app-claves-pago';
const esperaPorDefecto = ms => new Promise(resolver => setTimeout(resolver, ms));

export class ErrorPago extends Error {
  constructor(motivo, mensaje = motivo) {
    super(mensaje);
    this.name = 'ErrorPago';
    this.motivo = motivo; // metodo_no_disponible | no_se_puede_pagar
  }
}

/* pasarelas: { [metodo]: { ejecutar(intento, { orden }) } }. almacen: localStorage (las claves deben sobrevivir a
   una recarga o a que Android cierre la app a mitad del pago). */
export function crearServicioPagos({
  backend, sesion, pasarelas, almacen, nuevaClave = () => globalThis.crypto.randomUUID(),
  esperar = esperaPorDefecto, ahora = Date.now, intervaloConsulta = 2000, tiempoMaximoConfirmacion = 120000
}) {
  function claveDe(solicitudId) {
    const claves = almacen.leer(CLAVES_ORDEN, {});
    if (!claves[solicitudId]) {
      claves[solicitudId] = nuevaClave();
      almacen.guardar(CLAVES_ORDEN, claves);
    }
    return claves[solicitudId];
  }

  function olvidarClave(solicitudId) {
    const claves = almacen.leer(CLAVES_ORDEN, {});
    delete claves[solicitudId];
    almacen.guardar(CLAVES_ORDEN, claves);
  }

  async function prepararOrden({ solicitudId }) {
    const token = await sesion.obtenerToken();
    return backend.crearOrdenPago({ token, solicitudId, claveIdempotencia: claveDe(solicitudId) });
  }

  async function consultar(ordenId) {
    return backend.consultarOrden({ token: await sesion.obtenerToken(), ordenId });
  }

  // Consulta al backend hasta un estado final; si no llega a tiempo devuelve la orden como esté (la UI dice "en verificación")
  async function esperarConfirmacion(ordenId) {
    const limite = ahora() + tiempoMaximoConfirmacion;
    for (;;) {
      const orden = await consultar(ordenId);
      if (esFinal(orden.estado) || ahora() >= limite) return orden;
      await esperar(intervaloConsulta);
    }
  }

  async function pagar({ orden, metodo }) {
    if (!sePuedePagar(orden.estado)) throw new ErrorPago('no_se_puede_pagar', 'Esta orden ya no se puede pagar');
    const pasarela = pasarelas[metodo];
    if (!orden.metodos.includes(metodo) || !pasarela) throw new ErrorPago('metodo_no_disponible', 'Ese método de pago no está disponible');
    // Cada intento tiene su propia clave: si la red falla, el cliente HTTP repite el mismo intento sin crear otro
    const intento = await backend.iniciarPago({ token: await sesion.obtenerToken(), ordenId: orden.id, metodo, claveIdempotencia: nuevaClave() });
    await pasarela.ejecutar(intento, { orden });
    const final = await esperarConfirmacion(orden.id);
    if (final.estado === 'aprobado' || final.estado === 'expirado') olvidarClave(orden.solicitudId);
    return final;
  }

  return { prepararOrden, pagar, consultar, esperarConfirmacion };
}
