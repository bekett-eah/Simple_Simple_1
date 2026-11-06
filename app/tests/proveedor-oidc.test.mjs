// Inicio de sesión OIDC con PKCE (src/identidad/proveedor-oidc.js) con navegador y retornos falsos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, storageEnMemoria } from '../src/nucleo/almacen.js';
import { crearProveedorOidc } from '../src/identidad/proveedor-oidc.js';
import { desafioS256 } from '../src/identidad/pkce.js';

const EMISOR = 'https://id.ejemplo.gob.sv';
const CONFIG = { emisor: EMISOR, clienteId: 'simple-app', redireccion: 'sv.simple.app:/oauth2redirect', alcances: ['openid', 'profile'] };
const DESCUBRIMIENTO = { issuer: EMISOR, authorization_endpoint: `${EMISOR}/authorize` };

function escenario({ documento = DESCUBRIMIENTO, ahora = () => 1000 } = {}) {
  const oyentes = { retorno: [], cierre: [] };
  const abiertas = [];
  const navegador = {
    abrir: async url => { abiertas.push(url); },
    alCerrar: fn => { oyentes.cierre.push(fn); return () => { oyentes.cierre = oyentes.cierre.filter(f => f !== fn); }; }
  };
  const retornos = { alRecibir: fn => { oyentes.retorno.push(fn); return () => { oyentes.retorno = oyentes.retorno.filter(f => f !== fn); }; } };
  const fetch = async url => {
    assert.equal(url, `${EMISOR}/.well-known/openid-configuration`);
    return { ok: true, status: 200, json: async () => documento };
  };
  const almacen = crearAlmacen(storageEnMemoria());
  const proveedor = crearProveedorOidc({ config: CONFIG, navegador, retornos, almacen, fetch, ahora });
  const esperarApertura = async () => { while (!abiertas.length) await new Promise(r => setImmediate(r)); return new URL(abiertas[0]); };
  return { proveedor, oyentes, esperarApertura, almacen };
}

test('abre el endpoint del emisor con PKCE S256, state y nonce, y entrega el código al volver', async () => {
  const { proveedor, oyentes, esperarApertura } = escenario();
  const resultado = proveedor.iniciar();
  const url = await esperarApertura();
  const p = url.searchParams;
  assert.equal(url.origin + url.pathname, `${EMISOR}/authorize`);
  assert.equal(p.get('response_type'), 'code');
  assert.equal(p.get('client_id'), 'simple-app');
  assert.equal(p.get('redirect_uri'), CONFIG.redireccion);
  assert.equal(p.get('scope'), 'openid profile');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.ok(p.get('state') && p.get('nonce'));

  oyentes.retorno.forEach(fn => fn(`${CONFIG.redireccion}?code=ABC&state=${p.get('state')}&iss=${encodeURIComponent(EMISOR)}`));
  const r = await resultado;
  assert.equal(r.code, 'ABC');
  assert.equal(r.nonce, p.get('nonce'));
  assert.equal(r.redirectUri, CONFIG.redireccion);
  assert.equal(await desafioS256(r.codeVerifier), p.get('code_challenge'));
  assert.equal(proveedor.haySolicitudPendiente(), false);
  assert.equal(oyentes.retorno.length + oyentes.cierre.length, 0, 'se quitan los oyentes');
});

test('rechaza un state distinto (CSRF) y otro emisor (RFC 9207)', async () => {
  for (const [extra, motivo] of [['&state=otro', 'state'], ['&iss=https%3A%2F%2Fotro.example', 'emisor']]) {
    const { proveedor, oyentes, esperarApertura } = escenario();
    const resultado = proveedor.iniciar();
    const p = (await esperarApertura()).searchParams;
    const state = extra.startsWith('&state') ? '' : `&state=${p.get('state')}`;
    oyentes.retorno.forEach(fn => fn(`${CONFIG.redireccion}?code=ABC${state}${extra}`));
    await assert.rejects(resultado, e => e.motivo === motivo);
  }
});

test('access_denied es una cancelación; cerrar el navegador sin volver también', async () => {
  const uno = escenario();
  const r1 = uno.proveedor.iniciar();
  const p = (await uno.esperarApertura()).searchParams;
  uno.oyentes.retorno.forEach(fn => fn(`${CONFIG.redireccion}?error=access_denied&state=${p.get('state')}`));
  await assert.rejects(r1, e => e.motivo === 'cancelado');

  const dos = escenario();
  const r2 = dos.proveedor.iniciar();
  await dos.esperarApertura();
  assert.equal(dos.proveedor.haySolicitudPendiente(), true);
  dos.oyentes.cierre.forEach(fn => fn());
  await assert.rejects(r2, e => e.motivo === 'cancelado');
  assert.equal(dos.proveedor.haySolicitudPendiente(), false, 'una solicitud cancelada no queda pendiente');
});

test('si el navegador no abre, no queda una solicitud pendiente', async () => {
  const almacen = crearAlmacen(storageEnMemoria());
  const fetch = async () => ({ ok: true, status: 200, json: async () => DESCUBRIMIENTO });
  const navegador = { abrir: async () => { throw new Error('sin navegador'); }, alCerrar: () => () => {} };
  const proveedor = crearProveedorOidc({ config: CONFIG, navegador, retornos: { alRecibir: () => () => {} }, almacen, fetch });
  await assert.rejects(proveedor.iniciar(), /sin navegador/);
  assert.equal(proveedor.haySolicitudPendiente(), false);
});

test('una solicitud vencida no cuenta como pendiente', async () => {
  let reloj = 0;
  const { proveedor, esperarApertura } = escenario({ ahora: () => reloj });
  proveedor.iniciar().catch(() => {});
  await esperarApertura();
  assert.equal(proveedor.haySolicitudPendiente(), true);
  reloj = 10 * 60 * 1000 + 1;
  assert.equal(proveedor.haySolicitudPendiente(), false);
});

test('una solicitud vieja (más de 10 minutos) no se acepta', async () => {
  let reloj = 0;
  const { proveedor, oyentes, esperarApertura } = escenario({ ahora: () => reloj });
  const resultado = proveedor.iniciar();
  const p = (await esperarApertura()).searchParams;
  reloj = 11 * 60 * 1000;
  oyentes.retorno.forEach(fn => fn(`${CONFIG.redireccion}?code=ABC&state=${p.get('state')}`));
  await assert.rejects(resultado, e => e.motivo === 'vencida');
});

test('el documento de descubrimiento debe ser del mismo emisor y con endpoint https', async () => {
  await assert.rejects(escenario({ documento: { ...DESCUBRIMIENTO, issuer: 'https://otro.example' } }).proveedor.iniciar(), e => e.motivo === 'descubrimiento');
  await assert.rejects(escenario({ documento: { ...DESCUBRIMIENTO, authorization_endpoint: 'http://id.ejemplo.gob.sv/authorize' } }).proveedor.iniciar(), e => e.motivo === 'descubrimiento');
});

test('completa con el enlace de retorno si Android cerró la app durante el inicio de sesión', async () => {
  const { proveedor, esperarApertura, almacen } = escenario();
  proveedor.iniciar().catch(() => {});
  const p = (await esperarApertura()).searchParams;
  // La app se reabre desde cero: otro proveedor con el mismo almacenamiento
  const reabierto = crearProveedorOidc({ config: CONFIG, navegador: { abrir: async () => {}, alCerrar: () => () => {} }, retornos: { alRecibir: () => () => {} }, almacen, ahora: () => 2000 });
  assert.equal(reabierto.haySolicitudPendiente(), true);
  assert.equal(reabierto.completar(`${CONFIG.redireccion}?code=XYZ&state=${p.get('state')}`).code, 'XYZ');
  assert.throws(() => reabierto.completar(`${CONFIG.redireccion}?code=XYZ&state=${p.get('state')}`), e => e.motivo === 'vencida', 'la solicitud es de un solo uso');
});
