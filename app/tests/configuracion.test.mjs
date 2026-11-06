// Configuración por ambiente (scripts/lib/configuracion.mjs). Uso: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargar, origenesDeConexion, validar } from '../scripts/lib/configuracion.mjs';

const raiz = new URL('../', import.meta.url);
const appId = 'sv.simple.app';
const leer = entorno => cargar(entorno, { raiz, appId, variables: {} });

test('desarrollo y pruebas son válidos y usan simuladores', () => {
  for (const entorno of ['desarrollo', 'pruebas']) {
    const config = leer(entorno);
    assert.equal(config.backend.tipo, 'simulado');
    assert.equal(config.identidad.proveedor, 'simulado');
    assert.equal(config.pagos.pasarela, 'simulada');
  }
});

test('producción se detiene mientras falten los datos institucionales', () => {
  assert.throws(() => leer('produccion'), error => {
    assert.ok(error.errores.some(e => e.includes('backend.url')));
    assert.ok(error.errores.some(e => e.includes('identidad.emisor')));
    assert.ok(error.errores.some(e => e.includes('identidad.clienteId')));
    return true;
  });
});

test('producción completa con https pasa la validación', () => {
  const config = {
    entorno: 'produccion', depuracion: false, servicios: { asistente: null },
    backend: { tipo: 'http', url: 'https://api.ejemplo.gob.sv/app/' },
    identidad: { proveedor: 'oidc', emisor: 'https://id.ejemplo.gob.sv', clienteId: 'simple-app', redireccion: 'sv.simple.app:/oauth2redirect', alcances: ['openid'] },
    pagos: { pasarela: 'backend' }, sesion: { minutosInactividad: 5, segundosRenovacionAnticipada: 60 },
    enlaces: { crearIdentidad: 'https://login.gob.sv/' }
  };
  assert.deepEqual(validar(config, { entorno: 'produccion', appId }), []);
  assert.deepEqual(origenesDeConexion(config), ['https://api.ejemplo.gob.sv', 'https://id.ejemplo.gob.sv']);
});

test('rechaza simuladores en producción, secretos y direcciones sin cifrar', () => {
  const base = leer('desarrollo');
  const errores = validar({ ...base, entorno: 'produccion', depuracion: true }, { entorno: 'produccion', appId });
  assert.ok(errores.some(e => e.includes('backend simulado')));
  assert.ok(errores.some(e => e.includes('identidad simulada')));
  assert.ok(errores.some(e => e.includes('pasarela simulada')));
  assert.ok(errores.some(e => e.includes('depuracion')));

  const conSecreto = { ...base, identidad: { proveedor: 'simulado', clientSecret: 'x' } };
  assert.ok(validar(conSecreto, { entorno: 'desarrollo', appId }).some(e => e.includes('identidad.clientSecret')));

  const conHttp = { ...base, servicios: { asistente: 'http://192.168.1.10:8080/api/asistente' } };
  assert.ok(validar(conHttp, { entorno: 'desarrollo', appId }).some(e => e.includes('servicios.asistente')));
});

test('la dirección de retorno debe usar el esquema de la app', () => {
  const config = { ...leer('desarrollo'), backend: { tipo: 'http', url: 'https://api.ejemplo.gob.sv' },
    identidad: { proveedor: 'oidc', emisor: 'https://id.ejemplo.gob.sv', clienteId: 'x', redireccion: 'https://otra.app/cb', alcances: ['openid'] } };
  assert.ok(validar(config, { entorno: 'desarrollo', appId }).some(e => e.includes('identidad.redireccion')));
});

test('SIMPLE_ASISTENTE_URL apunta el asistente sin editar el archivo, y se valida', () => {
  const config = cargar('desarrollo', { raiz, appId, variables: { SIMPLE_ASISTENTE_URL: 'https://prueba.ejemplo.sv/api/asistente' } });
  assert.equal(config.servicios.asistente, 'https://prueba.ejemplo.sv/api/asistente');
  assert.deepEqual(origenesDeConexion(config), ['https://prueba.ejemplo.sv']);
  assert.throws(() => cargar('desarrollo', { raiz, appId, variables: { SIMPLE_ASISTENTE_URL: 'http://10.0.2.2:8080/api/asistente' } }));
});

test('ambiente desconocido', () => {
  assert.throws(() => leer('staging'), /Ambiente desconocido/);
});
