// Pruebas del intérprete del navegador (nuevoDiseño/interprete.js): protección de datos antes de enviar a la IA y
// el modo básico (sin IA). Uso: node --test pruebas/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
const SCRIPTS = ['src/data/catalogo-landing.js', 'nuevoDiseño/formularios.js', 'nuevoDiseño/citas.js', 'nuevoDiseño/ciudadano.js',
  'nuevoDiseño/pasos-tramite.js', 'nuevoDiseño/motor-tramite.js', 'nuevoDiseño/interprete.js'];
function cargar(window, protocolo) {
  const contexto = vm.createContext({ window, location: { protocol: protocolo, search: '' }, performance, setTimeout, clearTimeout });
  SCRIPTS.forEach(ruta => vm.runInContext(readFileSync(new URL(ruta, raiz), 'utf8'), contexto, { filename: ruta }));
  return window;
}
// Como una página abierta con file://: el intérprete no intenta llamar a la IA
const window = cargar({}, 'file:');
const I = window.INTERPRETE;
const M = window.MOTOR_TRAMITE;
const plano = x => JSON.parse(JSON.stringify(x));

test('protege DUI, correos, teléfonos y números largos con marcadores que se restituyen', () => {
  const p = I.proteger('mi dui es 06245097-8, correo ana@correo.com, cel 7000-1234 y cuenta 1234567');
  assert.equal(p.texto, 'mi dui es [DUI_1], correo [CORREO_1], cel [TEL_1] y cuenta [NUM_1]');
  assert.equal(I.restituir('[DUI_1]', p.marcadores), '06245097-8');
  assert.equal(I.restituir('[NUM_1]', p.marcadores), '1234567');
  assert.equal(I.proteger('nací en 1992').texto, 'nací en 1992', 'un año no es un dato sensible');
});

test('no envía tarjetas ni contraseñas', () => {
  assert.equal(I.proteger('mi tarjeta es 4111 1111 1111 1111').bloqueo, 'tarjeta');
  assert.equal(I.proteger('mi contraseña es Hola123').bloqueo, 'contrasena');
  assert.equal(I.proteger('olvidé mi contraseña').bloqueo, undefined, 'preguntar por la contraseña sí se puede');
});

test('sin IA: identifica el trámite y extrae opciones del mismo mensaje', async () => {
  const r = await I.interpretar('necesito mis antecedentes penales para un empleo');
  assert.equal(r.modo, 'local');
  assert.equal(r.intencion, 'iniciar_tramite');
  assert.equal(r.tramite, 99);
  assert.deepEqual(plano(r.datos), [{ campo: 'tipo_de_tramite', valor: 'empleo' }]);
});

test('sin IA: con un trámite activo, lo escrito responde lo que falta', () => {
  const estado = M.crear(99);
  M.aplicarDatos(estado, { tipo_de_tramite: 'empleo' });
  const r = I.interpretarLocal('Banco Agrícola', { estado, fase: 'recopilando' });
  assert.equal(r.intencion, 'aportar_datos');
  assert.deepEqual(plano(r.datos), [{ campo: 'lugar_de_presentacion', valor: 'Banco Agrícola' }]);
});

test('sin IA: preguntas de costo y plazo con datos del catálogo', () => {
  const estado = M.crear(99);
  const costo = I.interpretarLocal('¿cuánto cuesta?', { estado });
  assert.equal(costo.intencion, 'pregunta');
  assert.match(costo.respuesta, /\$3\.00/);
  assert.match(I.interpretarLocal('cuanto tarda la partida de nacimiento?').respuesta, /tarda/);
});

test('sin IA: cita con sede y franja', () => {
  const estado = M.crear(99);
  const r = I.interpretarLocal('mejor con cita en Santa Ana el martes en la tarde', { estado });
  assert.deepEqual(plano(r.datos).map(d => d.campo).sort(), ['cita_dia', 'cita_franja', 'cita_sede']);
});

test('sin IA: estado, atención humana, confirmar y cancelar', () => {
  const estado = M.crear(99);
  assert.equal(I.interpretarLocal('como va mi tramite').intencion, 'consultar_estado');
  assert.equal(I.interpretarLocal('quiero hablar con una persona').intencion, 'pedir_humano');
  assert.equal(I.interpretarLocal('sí, confirmo', { estado, fase: 'confirmando' }).intencion, 'confirmar');
  assert.equal(I.interpretarLocal('cancelar', { estado }).intencion, 'cancelar');
  assert.equal(I.interpretarLocal('hola buenas tardes').intencion, 'saludo');
  assert.equal(I.interpretarLocal('asdfghjk').intencion, 'sin_sentido');
});

test('sin IA: un mensaje ambiguo ofrece candidatos', () => {
  const r = I.interpretarLocal('antecedentes');
  assert.equal(r.intencion, 'buscar_tramite');
  assert.ok(r.candidatos.includes(99) && r.candidatos.includes(100));
});

test('en la app móvil sin asistente configurado el modo es básico; en la web con https se intenta la IA', () => {
  assert.equal(cargar({ SIMPLE_CONFIG: { entorno: 'pruebas', asistenteUrl: null } }, 'https:').INTERPRETE.modo(), 'basico');
  assert.equal(cargar({}, 'https:').INTERPRETE.modo(), 'ia');
});
