// Cliente HTTP del backend (src/nucleo/http.js): reintentos solo cuando no hay efectos dobles
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorHttp, crearClienteHttp } from '../src/nucleo/http.js';

function respuesta(estado, cuerpo, cabeceras = {}) {
  return { ok: estado >= 200 && estado < 300, status: estado, headers: new Headers(cabeceras), text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

// fetch falso que devuelve las respuestas en orden y anota cada pedido
function fetchFalso(respuestas) {
  const pedidos = [];
  const fetch = async (url, opciones) => {
    pedidos.push({ url, ...opciones });
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  };
  return { fetch, pedidos };
}

const esperas = [];
const cliente = fetch => crearClienteHttp({ base: 'https://api.ejemplo.gob.sv/app', fetch, esperar: async ms => { esperas.push(ms); } });

test('arma el pedido: ruta, JSON, token, sin cookies y sin seguir redirecciones', async () => {
  const { fetch, pedidos } = fetchFalso([respuesta(200, { ok: true })]);
  assert.deepEqual(await cliente(fetch).post('v1/sesiones', { cuerpo: { a: 1 }, token: 'T' }), { ok: true });
  const [p] = pedidos;
  assert.equal(p.url, 'https://api.ejemplo.gob.sv/app/v1/sesiones');
  assert.equal(p.method, 'POST');
  assert.equal(p.body, '{"a":1}');
  assert.equal(p.headers.Authorization, 'Bearer T');
  assert.equal(p.headers['Content-Type'], 'application/json');
  assert.equal(p.credentials, 'omit');
  assert.equal(p.redirect, 'error');
  assert.equal(p.cache, 'no-store');
});

test('GET se reintenta ante 503 y respeta Retry-After', async () => {
  esperas.length = 0;
  const { fetch, pedidos } = fetchFalso([respuesta(503, {}, { 'Retry-After': '2' }), respuesta(200, { estado: 'aprobado' })]);
  assert.deepEqual(await cliente(fetch).get('v1/ordenes-pago/1'), { estado: 'aprobado' });
  assert.equal(pedidos.length, 2);
  assert.deepEqual(esperas, [2000]);
});

test('POST sin clave de idempotencia no se repite (podría cobrar o canjear dos veces)', async () => {
  const { fetch, pedidos } = fetchFalso([respuesta(503, { codigo: 'caido' })]);
  await assert.rejects(cliente(fetch).post('v1/sesiones/renovacion', { cuerpo: {} }), e => e instanceof ErrorHttp && e.estado === 503 && e.codigo === 'caido');
  assert.equal(pedidos.length, 1);
});

test('POST con clave de idempotencia se repite con la misma clave', async () => {
  const { fetch, pedidos } = fetchFalso([new TypeError('Failed to fetch'), respuesta(201, { id: 'ord-1' })]);
  assert.deepEqual(await cliente(fetch).post('v1/ordenes-pago', { cuerpo: {}, claveIdempotencia: 'K1' }), { id: 'ord-1' });
  assert.equal(pedidos.length, 2);
  assert.ok(pedidos.every(p => p.headers['Idempotency-Key'] === 'K1'));
});

test('los errores 4xx no se reintentan y traen el código del backend', async () => {
  const { fetch, pedidos } = fetchFalso([respuesta(401, { codigo: 'token_invalido', mensaje: 'La sesión no es válida' })]);
  await assert.rejects(cliente(fetch).get('v1/x'), e => e.estado === 401 && e.codigo === 'token_invalido' && e.message === 'La sesión no es válida');
  assert.equal(pedidos.length, 1);
});

test('sin red después de los reintentos', async () => {
  const { fetch, pedidos } = fetchFalso([new TypeError('x'), new TypeError('x'), new TypeError('x')]);
  await assert.rejects(cliente(fetch).get('v1/x'), e => e.codigo === 'sin_red' && e.estado === 0);
  assert.equal(pedidos.length, 3);
});

test('tiempo agotado', async () => {
  const lento = (url, { signal }) => new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abort'), { name: 'AbortError' }))));
  const http = crearClienteHttp({ base: 'https://api.ejemplo.gob.sv', fetch: lento, tiempoMaximo: 20, reintentos: 0 });
  await assert.rejects(http.post('v1/x', { cuerpo: {} }), e => e.codigo === 'tiempo_agotado');
});
