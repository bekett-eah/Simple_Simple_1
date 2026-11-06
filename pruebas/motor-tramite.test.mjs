// Pruebas del motor de trámites (nuevoDiseño/motor-tramite.js) con los formularios reales del rediseño.
// Uso: node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
function cargar() {
  const window = {};
  const contexto = vm.createContext({ window });
  ['src/data/catalogo-landing.js', 'nuevoDiseño/formularios.js', 'nuevoDiseño/citas.js', 'nuevoDiseño/ciudadano.js',
    'nuevoDiseño/mis-tramites.js', 'nuevoDiseño/pasos-tramite.js', 'nuevoDiseño/motor-tramite.js']
    .forEach(ruta => vm.runInContext(readFileSync(new URL(ruta, raiz), 'utf8'), contexto, { filename: ruta }));
  return window;
}
const window = cargar();
const M = window.MOTOR_TRAMITE;
const CUENTA = window.CIUDADANO;
// Los arreglos del contexto vm son de otro "realm": se copian para compararlos con deepEqual
const nombres = campos => Array.from(campos, c => c.nombre);
const valor = (estado, campo) => estado.respuestas[campo]?.valor;

test('todos los formularios se pueden crear y no piden datos de solo lectura', () => {
  const numeros = Object.keys(window.FORMULARIOS_TRAMITES).map(Number);
  assert.ok(numeros.length >= 28);
  for (const n of numeros) {
    const estado = M.crear(n);
    assert.ok(estado, `trámite ${n}`);
    for (const c of M.pendientes(estado)) assert.ok(!c.soloLectura, `${n}: ${c.nombre} es de solo lectura y no debe pedirse`);
    for (const c of M.camposVisibles(estado).filter(c => c.soloLectura)) assert.ok(estado.respuestas[c.nombre], `${n}: falta prellenar ${c.nombre}`);
    assert.doesNotThrow(() => M.monto(estado), `monto de ${n}`);
  }
});

test('antecedentes penales: con un mensaje completo no falta nada y se paga en línea', () => {
  const estado = M.crear(99);
  assert.equal(valor(estado, 'modalidad'), 'en_linea');
  assert.equal(valor(estado, 'apostilla'), 'no');
  assert.equal(valor(estado, 'tipo_de_certificacion'), 'residente');
  assert.equal(valor(estado, 'nombres'), CUENTA.nombres);
  assert.deepEqual(nombres(M.pendientes(estado)), ['tipo_de_tramite', 'lugar_de_presentacion']);

  const { aceptados, rechazados } = M.aplicarDatos(estado, [{ campo: 'tipo_de_tramite', valor: 'De empleo' }, { campo: 'lugar_de_presentacion', valor: 'Banco Agrícola' }]);
  assert.equal(rechazados.length, 0);
  assert.equal(aceptados.length, 2);
  assert.equal(valor(estado, 'tipo_de_tramite'), 'empleo');
  assert.equal(M.pendientes(estado).length, 0);
  const pago = M.monto(estado);
  assert.equal(pago.enLinea, true);
  assert.equal(pago.total, '$3.00');
  const resumen = M.resumen(estado);
  assert.ok(resumen.cuenta.some(f => f.nombre === 'numero_de_documento'));
  assert.ok(resumen.solicitud.some(f => f.nombre === 'lugar_de_presentacion' && f.texto === 'Banco Agrícola'));
});

test('antecedentes penales: un lugar genérico se rechaza con el mensaje del formulario', () => {
  const estado = M.crear(99);
  const { rechazados } = M.aplicarDatos(estado, { lugar_de_presentacion: 'para trabajo' });
  assert.equal(rechazados.length, 1);
  assert.match(rechazados[0].error, /específico/);
  assert.equal(valor(estado, 'lugar_de_presentacion'), undefined);
});

test('un campo que aparece por otro dato del mismo mensaje también se aplica (apostilla y país)', () => {
  const estado = M.crear(99);
  const { aceptados } = M.aplicarDatos(estado, [{ campo: 'pais_de_presentacion', valor: 'españa' }, { campo: 'apostilla', valor: 'si' }]);
  assert.deepEqual(Array.from(aceptados, a => a.campo).sort(), ['apostilla', 'pais_de_presentacion']);
  assert.equal(valor(estado, 'pais_de_presentacion'), 'España');
});

test('no se aceptan opciones inventadas, datos de solo lectura ni consentimientos', () => {
  const estado = M.crear(99);
  const r = M.aplicarDatos(estado, { tipo_de_tramite: 'para la NASA', nombres: 'Otra Persona' });
  assert.equal(r.aceptados.length, 0);
  assert.equal(r.rechazados.length, 2);
  assert.equal(valor(estado, 'nombres'), CUENTA.nombres);
  const partida = M.crear(73);
  assert.equal(partida.respuestas.acepta_terminos.origen, 'consentimiento');
  assert.equal(M.aplicarDatos(partida, { acepta_terminos: 'acepto' }).rechazados.length, 1);
});

test('cita: las pistas en lenguaje natural eligen sede, día y hora; con cita no hay pago en línea', () => {
  const estado = M.crear(99);
  const { aceptados } = M.aplicarDatos(estado, [{ campo: 'cita_sede', valor: 'santa ana' }, { campo: 'cita_franja', valor: 'en la tarde' }]);
  assert.equal(valor(estado, 'modalidad'), 'cita');
  assert.ok(M.modoCita(estado));
  assert.ok(aceptados.some(a => a.campo === 'sede_de_retiro' && a.texto === 'Santa Ana'));
  assert.ok(valor(estado, 'hora_de_llegada') >= '12:00');
  assert.equal(valor(estado, 'cantidad_de_constancias'), '1');
  assert.equal(valor(estado, 'telefono_de_contacto'), CUENTA.telefono_de_contacto);
  assert.deepEqual(nombres(M.pendientes(estado)), ['direccion_de_residencia']);
  const pago = M.monto(estado);
  assert.equal(pago.enLinea, false);
  assert.equal(pago.enSede, true);
  const cita = M.citaElegida(estado);
  assert.equal(cita.sede, 1);
  assert.match(cita.fecha, /^\d{4}-\d{2}-\d{2}$/);
});

test('cita: sin pistas de horario se propone el primero libre', () => {
  const estado = M.crear(99);
  M.aplicarDatos(estado, [{ campo: 'modalidad', valor: 'cita' }, { campo: 'sede_de_retiro', valor: 'San Salvador' }]);
  const propuestos = M.proponerHorario(estado);
  assert.equal(propuestos.length, 2);
  assert.equal(estado.respuestas.fecha_de_retiro.origen, 'propuesta');
});

test('partidas: los datos de la cuenta se usan solo cuando la partida es de quien inicia sesión', () => {
  const estado = M.crear(73);
  assert.equal(valor(estado, 'primer_nombre'), undefined, 'sin tipo de partida no se prellena');
  M.aplicarDatos(estado, { tipo_partida: 'nacimiento' });
  assert.equal(valor(estado, 'primer_nombre'), undefined, 'antes se pregunta si la partida es suya');
  const pregunta = M.preguntarSiEsSuyo(estado, CUENTA);
  assert.equal(pregunta.prefijo, '');
  assert.ok(pregunta.nombre.startsWith(CUENTA.primer_nombre));
  M.responderSiEsSuyo(estado, true, CUENTA);
  assert.equal(M.preguntarSiEsSuyo(estado, CUENTA), null, 'no se vuelve a preguntar');
  assert.equal(valor(estado, 'primer_nombre'), CUENTA.primer_nombre);
  assert.equal(valor(estado, 'anio_partida'), CUENTA.anio_partida);
  assert.equal(valor(estado, 'dui_inscrito'), CUENTA.dui_inscrito);
  assert.deepEqual(nombres(M.pendientes(estado)), ['ambito_documento']);
  assert.equal(M.monto(estado).total, '$5.00');

  M.aplicarDatos(estado, { tipo_partida: 'defuncion' });
  assert.equal(valor(estado, 'primer_nombre'), undefined, 'la de defunción no es de quien inicia sesión');
  assert.ok(nombres(M.pendientes(estado)).includes('primer_nombre'));
  assert.equal(M.preguntarSiEsSuyo(estado, CUENTA), null, 'en la de defunción no se pregunta');
});

test('partidas: si no es suya, el nombre se pide completo y no se usan los datos de la cuenta', () => {
  const estado = M.crear(73);
  M.aplicarDatos(estado, { tipo_partida: 'nacimiento' });
  M.responderSiEsSuyo(estado, false, CUENTA);
  assert.equal(valor(estado, 'anio_partida'), undefined);
  const falta = M.nombrePendiente(estado);
  assert.equal(falta.prefijo, '');
  assert.equal(falta.espera, false);
  const { opciones } = M.partirNombre('Juan Carlos Pérez Gómez');
  assert.equal(M.ponerNombre(estado, '', opciones[0].partes), '');
  assert.equal(valor(estado, 'primer_nombre'), 'Juan');
  assert.equal(valor(estado, 'segundo_nombre'), 'Carlos');
  assert.equal(valor(estado, 'primer_apellido'), 'Pérez');
  assert.equal(valor(estado, 'segundo_apellido'), 'Gómez');
  assert.equal(M.nombrePendiente(estado), null);
  assert.ok(nombres(M.pendientes(estado)).includes('anio_partida'));
});

test('partidas: el nombre espera al tipo de partida', () => {
  const estado = M.crear(73);
  assert.equal(M.nombrePendiente(estado).espera, true);
});

test('nombre completo en un mensaje: se reparte en nombres y apellidos', () => {
  const partes = texto => Array.from(M.partirNombre(texto).opciones || [], o => [o.nombres, o.apellidos]);
  assert.deepEqual(partes('Ana López'), [['Ana', 'López']]);
  assert.deepEqual(partes('María de los Ángeles Rivas Cruz'), [['María de los Ángeles', 'Rivas Cruz']]);
  assert.deepEqual(partes('Juan Pérez Gómez'), [['Juan', 'Pérez Gómez'], ['Juan Pérez', 'Gómez']], 'con 3 palabras se dan las dos formas');
  assert.deepEqual(partes('Rosa Elena Beatriz Martínez Flores'), [['Rosa Elena Beatriz', 'Martínez Flores']]);
  assert.deepEqual(partes('Juan Pérez, Gómez'), [['Juan Pérez', 'Gómez']], 'la coma separa nombres de apellidos');
  const casada = M.partirNombre('Ana María López García de Rivas', { conCasada: true }).opciones[0].partes;
  assert.equal(casada.apellido_de_casada, 'Rivas');
  assert.equal(casada.segundo_apellido, 'García');
  const conCasada = M.partirNombre('Rosa Elena Martínez de Hernández', { conCasada: true }).opciones.map(o => [o.nombres, o.apellidos]);
  assert.deepEqual(conCasada[0], ['Rosa Elena', 'Martínez de Hernández'], 'con apellido de casada, primero dos nombres y un apellido');
  assert.equal(M.anotadoComo({ nombres: 'Ana', apellidos: 'Pérez Gómez' }), '*Ana* como nombre y *Pérez Gómez* como apellidos');
  assert.ok(M.partirNombre('Ana').error);
  assert.ok(M.partirNombre('Ana 123').error);
});

test('lista que depende de otra: el municipio se acepta aunque llegue antes que el departamento', () => {
  const estado = M.crear(64);
  const r = M.aplicarDatos(estado, [{ campo: 'municipio', valor: 'Mejicanos' }, { campo: 'departamento', valor: 'San Salvador' }]);
  assert.equal(r.rechazados.length, 0);
  assert.equal(valor(estado, 'departamento'), '06');
  assert.ok(valor(estado, 'municipio'));
});

test('correo: la confirmación copia el de la cuenta; uno escrito debe coincidir', () => {
  const estado = M.crear(64);
  assert.equal(valor(estado, 'correo_notificaciones'), CUENTA.correo_notificaciones);
  assert.equal(estado.respuestas.confirmar_correo.repetido, true);
  const otro = M.aplicarDatos(estado, { correo_notificaciones: 'NUEVO@correo.com', confirmar_correo: 'otro@correo.com' });
  assert.equal(valor(estado, 'correo_notificaciones'), 'nuevo@correo.com');
  assert.equal(otro.rechazados.length, 1);
});

test('monto que depende de lo respondido (no restricción migratoria)', () => {
  const estado = M.crear(113);
  M.aplicarDatos(estado, { nacionalidad: 'salvadorena', tipo_de_tramiten: 'constancia_natural_nacional' });
  assert.equal(M.monto(estado).total, '$10.00');
  const extranjero = M.crear(113);
  M.aplicarDatos(extranjero, { nacionalidad: 'rep_legal', tipo_tramite_rl: 'delegado_extranjero' });
  assert.equal(M.monto(extranjero).total, '$11.00');
});

test('preselección del trámite y tipo de documento de la cuenta', () => {
  const estado = M.crear(48);
  assert.equal(estado.respuestas.tipo_tramite.origen, 'tramite');
  M.aplicarDatos(estado, { tipo_persona: 'persona natural' });
  assert.equal(valor(estado, 'tipo_documento'), 'dui');
  assert.equal(valor(estado, 'numero_de_documento'), CUENTA.numero_de_documento);
  M.aplicarDatos(estado, { tipo_documento: 'pasaporte' });
  assert.equal(valor(estado, 'numero_de_documento'), undefined, 'el DUI de la cuenta no sirve como número de pasaporte');
});

test('formatos que la gente escribe distinto', () => {
  const estado = M.crear(75);
  assert.equal(M.aplicarDatos(estado, { dui_titular: '062450978' }).rechazados.length, 0);
  assert.equal(valor(estado, 'dui_titular'), '06245097-8');
});

test('trámites en proceso: los de este navegador primero y sin los finalizados', () => {
  const lista = M.tramitesEnProceso([{ id: '9999999', numero: 99, estado: 'en_revision', fecha: '2026-10-29T10:00' }]);
  assert.equal(lista[0].id, '9999999');
  assert.ok(lista.every(t => t.estado !== 'finalizado'));
});
