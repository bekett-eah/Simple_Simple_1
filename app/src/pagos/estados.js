/* Estados de una orden de pago (plan, fase 5). Los cambia solo el backend, al verificar el resultado con la pasarela;
   la app los consulta y los muestra. */
export const ESTADOS_PAGO = {
  pendiente: { texto: 'Pendiente de pago', final: false },
  procesando: { texto: 'Verificando el pago', final: false },
  aprobado: { texto: 'Pago aprobado', final: true },
  rechazado: { texto: 'Pago rechazado', final: true },
  expirado: { texto: 'La orden de pago venció', final: true },
  reembolsado: { texto: 'Pago reembolsado', final: true }
};

// Un pago rechazado se puede intentar de nuevo con otra tarjeta o método (vuelve a procesando)
const TRANSICIONES = {
  pendiente: ['procesando', 'expirado'],
  procesando: ['aprobado', 'rechazado', 'pendiente', 'expirado'],
  rechazado: ['procesando', 'expirado'],
  aprobado: ['reembolsado'],
  expirado: [],
  reembolsado: []
};

export const esFinal = estado => ESTADOS_PAGO[estado]?.final === true;
export const transicionValida = (de, a) => TRANSICIONES[de]?.includes(a) ?? false;
export const textoDe = estado => ESTADOS_PAGO[estado]?.texto ?? 'Estado desconocido';
export const sePuedePagar = estado => estado === 'pendiente' || estado === 'rechazado';

// Montos en centavos (nunca decimales de punto flotante); El Salvador usa dólares
export const formatearMonto = ({ centavos, moneda = 'USD' }) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: moneda }).format(centavos / 100);
