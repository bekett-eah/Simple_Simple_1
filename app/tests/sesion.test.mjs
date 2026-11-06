// Gestor de sesión (src/sesion/sesion.js) contra el backend simulado y una biometría falsa
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, storageEnMemoria } from '../src/nucleo/almacen.js';
import { crearBackendSimulado } from '../src/backend/backend-simulado.js';
import { ErrorBiometria } from '../src/sesion/biometria.js';
import { CLAVES, crearGestorSesion } from '../src/sesion/sesion.js';

const USUARIO = { id: 'u1', nombre: 'Cuenta de prueba', documento: '*****097-8' };
const IDENTIDAD = { proveedor: 'simulado', code: 'simulado-abc', codeVerifier: 'v', nonce: 'n', redirectUri: 'simulado' };

function escenario() {
  let reloj = 1_000_000;
  const ahora = () => reloj;
  const local = crearAlmacen(storageEnMemoria());
  const backend = crearBackendSimulado({ almacen: local, usuario: USUARIO, tramiteDe: () => null, ahora });
  const boveda = { valor: null, ultima: null, fallo: null, lecturas: 0 };
  const biometria = {
    disponibilidad: async () => ({ disponible: true }),
    guardar: async valor => { boveda.valor = valor; boveda.ultima = valor; },
    leer: async () => { boveda.lecturas++; if (boveda.fallo) throw boveda.fallo; if (!boveda.valor) throw new ErrorBiometria('invalidada'); return boveda.valor; },
    eliminar: async () => { boveda.valor = null; }
  };
  const marca = { puesta: false, poner() { this.puesta = true; }, quitar() { this.puesta = false; } };
  // Cada "arranque" de la app tiene su propio sessionStorage; localStorage y la bóveda se conservan
  const arrancar = () => crearGestorSesion({
    backend, biometria, almacenSesion: crearAlmacen(storageEnMemoria()), almacenLocal: local, marca, plataforma: 'android',
    config: { minutosInactividad: 5, segundosRenovacionAnticipada: 60 }, ahora
  });
  return { arrancar, backend, boveda, marca, local, avanzar: ms => { reloj += ms; } };
}

test('primer ingreso: el backend crea la sesión y se pone la marca de la maqueta', async () => {
  const { arrancar, marca } = escenario();
  const sesion = arrancar();
  assert.equal(sesion.haySesion(), false);
  const usuario = await sesion.iniciar(IDENTIDAD);
  assert.deepEqual(usuario, USUARIO);
  assert.equal(sesion.haySesion(), true);
  assert.equal(marca.puesta, true);
  assert.match(await sesion.obtenerToken(), /^acc-/);
});

test('renueva el token antes de que venza y la renovación anterior ya no sirve', async () => {
  const { arrancar, backend, avanzar } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  const primero = await sesion.obtenerToken();
  avanzar(14.5 * 60 * 1000); // quedan 30 s de los 15 min
  const segundo = await sesion.obtenerToken();
  assert.notEqual(primero, segundo);
  await assert.rejects(backend.consultarOrden({ token: primero, ordenId: 'x' }), e => e.estado === 401, 'el token anterior se revocó');
});

test('si el backend rechaza la renovación, la sesión termina', async () => {
  const { arrancar, marca, avanzar, local } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  local.borrar('simple-app-simulador-backend'); // el backend olvidó la sesión (revocada)
  avanzar(15 * 60 * 1000);
  await assert.rejects(sesion.obtenerToken(), e => e.motivo === 'expirada');
  assert.equal(sesion.haySesion(), false);
  assert.equal(marca.puesta, false);
});

test('con biometría, al abrir la app de nuevo se entra con la credencial del dispositivo', async () => {
  const { arrancar, boveda, marca } = escenario();
  const primera = arrancar();
  await primera.iniciar(IDENTIDAD);
  await primera.activarBiometria();
  assert.equal(primera.biometriaActiva(), true);
  assert.match(boveda.valor, /^cred-/);
  assert.equal(boveda.lecturas, 1, 'al activarla se confirma con la huella');

  const segunda = arrancar(); // proceso nuevo: sin tokens en sessionStorage
  segunda.sincronizarMarca();
  assert.equal(segunda.haySesion(), false);
  assert.equal(marca.puesta, false);
  assert.equal(segunda.biometriaActiva(), true);
  assert.deepEqual(await segunda.desbloquear(), USUARIO);
  assert.equal(segunda.haySesion(), true);
  assert.equal(boveda.lecturas, 2);
});

test('si no se confirma la huella al activarla, no queda activada y el backend revoca la credencial', async () => {
  const { arrancar, backend, boveda } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  boveda.fallo = new ErrorBiometria('cancelado');
  await assert.rejects(sesion.activarBiometria(), e => e instanceof ErrorBiometria && e.motivo === 'cancelado');
  assert.equal(sesion.biometriaActiva(), false);
  assert.equal(boveda.valor, null);
  await assert.rejects(backend.sesionConDispositivo({ credencial: boveda.ultima, dispositivoId: sesion.dispositivo().id }), e => e.estado === 401);
  assert.equal(sesion.haySesion(), true, 'la sesión sigue abierta');
});

test('si cambió la biometría del teléfono, se borra la credencial y hay que usar Identidad Digital', async () => {
  const { arrancar, boveda } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  await sesion.activarBiometria();
  boveda.fallo = new ErrorBiometria('invalidada');
  const nueva = arrancar();
  await assert.rejects(nueva.desbloquear(), e => e.motivo === 'biometria_cambiada');
  assert.equal(nueva.biometriaActiva(), false);
  assert.equal(boveda.valor, null);
});

test('una credencial revocada en el backend se borra del teléfono', async () => {
  const { arrancar, backend, boveda } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  await sesion.activarBiometria();
  await backend.desvincularDispositivo({ token: await sesion.obtenerToken(), dispositivoId: sesion.dispositivo().id });
  const nueva = arrancar();
  await assert.rejects(nueva.desbloquear(), e => e.motivo === 'credencial_revocada');
  assert.equal(nueva.biometriaActiva(), false);
  assert.equal(boveda.valor, null);
});

test('cancelar la huella no borra nada', async () => {
  const { arrancar, boveda } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  await sesion.activarBiometria();
  boveda.fallo = new ErrorBiometria('cancelado');
  const nueva = arrancar();
  await assert.rejects(nueva.desbloquear(), e => e instanceof ErrorBiometria && e.motivo === 'cancelado');
  assert.equal(nueva.biometriaActiva(), true);
});

test('cerrar sesión revoca los tokens; desvincular además borra la biometría y el dispositivo', async () => {
  const { arrancar, backend, boveda, marca } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  const token = await sesion.obtenerToken();
  await sesion.activarBiometria();
  await sesion.cerrar();
  assert.equal(sesion.haySesion(), false);
  assert.equal(marca.puesta, false);
  assert.equal(sesion.biometriaActiva(), true, 'cerrar sesión no desvincula el teléfono');
  await assert.rejects(backend.consultarOrden({ token, ordenId: 'x' }), e => e.estado === 401);

  await sesion.desbloquear();
  const id = sesion.dispositivo().id;
  const credencial = boveda.valor;
  await sesion.desvincular();
  assert.equal(sesion.biometriaActiva(), false);
  assert.equal(boveda.valor, null);
  await assert.rejects(backend.sesionConDispositivo({ credencial, dispositivoId: id }), e => e.estado === 401);
});

test('bloqueo por inactividad: después de 5 minutos en segundo plano hay que volver a entrar', async () => {
  const { arrancar, avanzar, marca } = escenario();
  const sesion = arrancar();
  await sesion.iniciar(IDENTIDAD);
  sesion.pasarASegundoPlano();
  avanzar(4 * 60 * 1000);
  assert.equal(sesion.volverAlFrente(), false);
  assert.equal(sesion.haySesion(), true);
  sesion.pasarASegundoPlano();
  avanzar(5 * 60 * 1000 + 1);
  assert.equal(sesion.volverAlFrente(), true);
  assert.equal(sesion.haySesion(), false);
  assert.equal(marca.puesta, false);
});

test('el identificador del dispositivo es estable y no se guarda nada sensible en localStorage', async () => {
  const { arrancar, local } = escenario();
  const sesion = arrancar();
  const id = sesion.dispositivo().id;
  assert.equal(arrancar().dispositivo().id, id);
  await sesion.iniciar(IDENTIDAD);
  await sesion.activarBiometria();
  const claves = [CLAVES.dispositivo, CLAVES.biometria].map(c => JSON.stringify(local.leer(c)));
  assert.ok(claves.every(v => !/acc-|ren-|cred-/.test(v)));
});
