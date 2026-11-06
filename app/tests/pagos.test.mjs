// Pagos (src/pagos/) con el backend simulado: idempotencia, monto calculado por el backend y confirmación verificada
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, storageEnMemoria } from '../src/nucleo/almacen.js';
import { centavosDe, crearBackendSimulado } from '../src/backend/backend-simulado.js';
import { crearServicioPagos } from '../src/pagos/servicio-pagos.js';
import { crearPasarelaSimulada } from '../src/pagos/pasarelas.js';
import { esFinal, formatearMonto, sePuedePagar, textoDe, transicionValida } from '../src/pagos/estados.js';

const TRAMITES = { 'sol-1': { numero: 73, nombre: 'Constancia de antecedentes policiales', costo: '$10.00 *(Modalidad única)*' }, 'sol-gratis': { numero: 5, nombre: 'Gratis', costo: 'No tiene costo' } };

async function escenario({ decisiones = [true] } = {}) {
  const local = crearAlmacen(storageEnMemoria());
  const backend = crearBackendSimulado({ almacen: local, usuario: { id: 'u1' }, tramiteDe: id => TRAMITES[id] || null });
  const { accessToken } = await backend.crearSesion({ proveedor: 'simulado', code: 'simulado-x', codeVerifier: 'v', nonce: 'n', dispositivo: { id: 'd1' } });
  const sesion = { obtenerToken: async () => accessToken };
  const pasarela = crearPasarelaSimulada({ backend, confirmar: async () => decisiones.shift() });
  const servicio = crearServicioPagos({ backend, sesion, almacen: local, pasarelas: { tarjeta: pasarela }, esperar: async () => {}, intervaloConsulta: 0 });
  return { backend, servicio, local, accessToken };
}

test('el monto lo calcula el backend y la misma solicitud devuelve la misma orden', async () => {
  const { servicio } = await escenario();
  const orden = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  assert.deepEqual(orden.monto, { centavos: 1000, moneda: 'USD' });
  assert.equal(orden.estado, 'pendiente');
  assert.equal('claveIdempotencia' in orden, false, 'la clave no se devuelve');
  const otraVez = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  assert.equal(otraVez.id, orden.id, 'doble toque o recarga: no se crea otra orden');
});

test('un trámite sin costo no genera orden', async () => {
  const { servicio } = await escenario();
  await assert.rejects(servicio.prepararOrden({ solicitudId: 'sol-gratis' }), e => e.estado === 422 && e.codigo === 'sin_costo');
});

test('pago aprobado: el estado final viene del backend y la clave se olvida', async () => {
  const { servicio, local } = await escenario({ decisiones: [true] });
  const orden = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  const final = await servicio.pagar({ orden, metodo: 'tarjeta' });
  assert.equal(final.estado, 'aprobado');
  assert.deepEqual(final.historial.map(h => h.estado), ['procesando', 'aprobado']);
  assert.deepEqual(local.leer('simple-app-claves-pago'), {});
  await assert.rejects(servicio.pagar({ orden: final, metodo: 'tarjeta' }), e => e.motivo === 'no_se_puede_pagar');
});

test('pago rechazado: se puede intentar de nuevo con la misma orden', async () => {
  const { servicio } = await escenario({ decisiones: [false, true] });
  const orden = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  const rechazado = await servicio.pagar({ orden, metodo: 'tarjeta' });
  assert.equal(rechazado.estado, 'rechazado');
  assert.equal((await servicio.prepararOrden({ solicitudId: 'sol-1' })).id, orden.id);
  const aprobado = await servicio.pagar({ orden: rechazado, metodo: 'tarjeta' });
  assert.equal(aprobado.estado, 'aprobado');
});

test('métodos no ofrecidos por el backend no se aceptan', async () => {
  const { servicio } = await escenario();
  const orden = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  await assert.rejects(servicio.pagar({ orden, metodo: 'google_pay' }), e => e.motivo === 'metodo_no_disponible');
});

test('una solicitud no tiene dos órdenes vigentes, aunque llegue otra clave', async () => {
  const { servicio, local } = await escenario({ decisiones: [true] });
  const orden = await servicio.prepararOrden({ solicitudId: 'sol-1' });
  local.borrar('simple-app-claves-pago'); // el teléfono perdió sus claves (por ejemplo, iOS borró el almacenamiento)
  assert.equal((await servicio.prepararOrden({ solicitudId: 'sol-1' })).id, orden.id);
  const pagada = await servicio.pagar({ orden, metodo: 'tarjeta' });
  const despues = await servicio.prepararOrden({ solicitudId: 'sol-1' }); // volver a la pantalla de pago ya pagada
  assert.equal(despues.id, pagada.id);
  assert.equal(despues.estado, 'aprobado');
  await assert.rejects(servicio.pagar({ orden: despues, metodo: 'tarjeta' }), e => e.motivo === 'no_se_puede_pagar');
});

test('el backend no acepta la misma clave de idempotencia para otra solicitud', async () => {
  const { backend, accessToken } = await escenario();
  await backend.crearOrdenPago({ token: accessToken, solicitudId: 'sol-1', claveIdempotencia: 'K' });
  await assert.rejects(backend.crearOrdenPago({ token: accessToken, solicitudId: 'sol-2', claveIdempotencia: 'K' }), e => e.codigo === 'idempotencia_reutilizada');
});

test('sin sesión válida el backend no crea órdenes', async () => {
  const { backend } = await escenario();
  await assert.rejects(backend.crearOrdenPago({ token: 'acc-falso', solicitudId: 'sol-1', claveIdempotencia: 'K' }), e => e.estado === 401);
});

test('estados y transiciones', () => {
  assert.ok(transicionValida('pendiente', 'procesando'));
  assert.ok(transicionValida('procesando', 'aprobado'));
  assert.ok(transicionValida('rechazado', 'procesando'));
  assert.ok(transicionValida('aprobado', 'reembolsado'));
  assert.ok(!transicionValida('pendiente', 'aprobado'), 'no se aprueba sin procesar');
  assert.ok(!transicionValida('aprobado', 'rechazado'));
  assert.ok(!transicionValida('reembolsado', 'aprobado'));
  assert.ok(esFinal('aprobado') && esFinal('rechazado') && !esFinal('procesando'));
  assert.ok(sePuedePagar('pendiente') && sePuedePagar('rechazado') && !sePuedePagar('aprobado'));
  assert.equal(textoDe('reembolsado'), 'Pago reembolsado');
});

test('montos en centavos', () => {
  assert.equal(centavosDe('$10.00 *(Modalidad única)*'), 1000);
  assert.equal(centavosDe('$39.55 *(Persona Natural)*'), 3955);
  assert.equal(centavosDe('$1,234.5'), 123450);
  assert.equal(centavosDe('$300.00 será el monto máximo'), 30000);
  assert.equal(centavosDe('No tiene costo *(Modalidad única)*'), null);
  assert.match(formatearMonto({ centavos: 1000, moneda: 'USD' }), /10\.00/);
});
