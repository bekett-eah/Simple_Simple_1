// Biometría (src/sesion/biometria.js): adaptador nativo con un plugin falso y simulador de desarrollo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccessControl } from '@capgo/capacitor-native-biometric';
import { crearAlmacen, storageEnMemoria } from '../src/nucleo/almacen.js';
import { CLAVE_CREDENCIAL, ErrorBiometria, crearBiometriaNativa, crearBiometriaSimulada, traducirError } from '../src/sesion/biometria.js';

// Imita @capgo/capacitor-native-biometric: anota las llamadas y falla con el código indicado (como string, igual que Android)
function pluginFalso({ disponible = { isAvailable: true, strongBiometryIsAvailable: true, biometryType: 3 }, falla = null } = {}) {
  const llamadas = [];
  const datos = new Map();
  const registrar = (nombre, opciones) => {
    llamadas.push([nombre, opciones]);
    if (falla) throw Object.assign(new Error('falla del plugin'), { code: String(falla) });
  };
  return {
    llamadas, datos,
    isAvailable: async opciones => { llamadas.push(['isAvailable', opciones]); return disponible; },
    setData: async opciones => { registrar('setData', opciones); datos.set(opciones.key, opciones.value); },
    getSecureData: async opciones => {
      registrar('getSecureData', opciones);
      if (!datos.has(opciones.key)) throw Object.assign(new Error('No protected data found'), { code: '21' });
      return { value: datos.get(opciones.key) };
    },
    deleteData: async opciones => { registrar('deleteData', opciones); datos.delete(opciones.key); }
  };
}

test('guarda la credencial protegida por la biometría actual (sin aviso) y la lee con el aviso del sistema', async () => {
  const plugin = pluginFalso();
  const biometria = crearBiometriaNativa({ plugin });
  await biometria.guardar('cred-1');
  const [, opciones] = plugin.llamadas.find(([nombre]) => nombre === 'setData');
  assert.deepEqual(opciones, { key: CLAVE_CREDENCIAL, value: 'cred-1', accessControl: AccessControl.BIOMETRY_CURRENT_SET });
  assert.equal(await biometria.leer({ titulo: 'Ingresa', subtitulo: 'Simple.sv', cancelar: 'Cancelar' }), 'cred-1');
  const [, lectura] = plugin.llamadas.find(([nombre]) => nombre === 'getSecureData');
  assert.deepEqual(lectura, { key: CLAVE_CREDENCIAL, title: 'Ingresa', subtitle: 'Simple.sv', negativeButtonText: 'Cancelar' });
});

test('solo cuenta la biometría fuerte, sin PIN de respaldo', async () => {
  const debil = crearBiometriaNativa({ plugin: pluginFalso({ disponible: { isAvailable: true, strongBiometryIsAvailable: false, biometryType: 4 } }) });
  assert.equal((await debil.disponibilidad()).disponible, false);
  const plugin = pluginFalso();
  assert.equal((await crearBiometriaNativa({ plugin }).disponibilidad()).disponible, true);
  assert.deepEqual(plugin.llamadas[0], ['isAvailable', { useFallback: false }]);
  const roto = { isAvailable: async () => { throw Object.assign(new Error('x'), { code: '1' }); } };
  assert.deepEqual(await crearBiometriaNativa({ plugin: roto }).disponibilidad(), { disponible: false, tipo: null, codigo: '1' });
});

test('si cambiaron las huellas o rostros, el plugin ya no tiene la credencial: invalidada', async () => {
  const biometria = crearBiometriaNativa({ plugin: pluginFalso() });
  await assert.rejects(biometria.leer({ titulo: 'Ingresa' }), e => e instanceof ErrorBiometria && e.motivo === 'invalidada');
});

test('traduce los códigos del plugin', () => {
  const casos = { 0: 'desconocido', 1: 'no_disponible', 2: 'bloqueada', 3: 'no_disponible', 4: 'bloqueada', 10: 'fallida',
    11: 'cancelado', 14: 'no_disponible', 15: 'cancelado', 16: 'cancelado', 17: 'cancelado', 21: 'invalidada', 99: 'desconocido' };
  for (const [codigo, motivo] of Object.entries(casos)) {
    assert.equal(traducirError({ code: codigo }).motivo, motivo, `código ${codigo}`);
  }
  assert.equal(traducirError(new Error('sin código')).motivo, 'desconocido');
  const propio = new ErrorBiometria('cancelado');
  assert.equal(traducirError(propio), propio);
});

test('los errores del plugin al guardar o leer llegan traducidos; eliminar no falla', async () => {
  const bloqueado = crearBiometriaNativa({ plugin: pluginFalso({ falla: 2 }) });
  await assert.rejects(bloqueado.guardar('x'), e => e.motivo === 'bloqueada');
  await assert.rejects(bloqueado.leer({ titulo: 't' }), e => e.motivo === 'bloqueada');
  await bloqueado.eliminar();
});

test('simulador de desarrollo: como en el teléfono, solo leer pide la huella; sin credencial es invalidada', async () => {
  let respuesta = false;
  let avisos = 0;
  const biometria = crearBiometriaSimulada({ almacen: crearAlmacen(storageEnMemoria()), confirmar: async () => { avisos++; return respuesta; } });
  assert.equal(biometria.simulada, true);
  await assert.rejects(biometria.leer({ titulo: 'Ingresa' }), e => e.motivo === 'invalidada');
  await biometria.guardar('cred-1');
  assert.equal(avisos, 0);
  await assert.rejects(biometria.leer({ titulo: 'Ingresa' }), e => e.motivo === 'cancelado');
  respuesta = true;
  assert.equal(await biometria.leer({ titulo: 'Ingresa' }), 'cred-1');
  await biometria.eliminar();
  await assert.rejects(biometria.leer({ titulo: 'Ingresa' }), e => e.motivo === 'invalidada');
});
