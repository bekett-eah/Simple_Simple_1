// Línea base sin IA: el modo básico del intérprete (nuevoDiseño/interprete.js) sobre pruebas/evaluacion_nlu.jsonl,
// con la misma calificación que evaluar_asistente.py (que usa la IA real y gasta créditos). Gratis.
// Uso: node pruebas/evaluar_local.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
const window = {};
const contexto = vm.createContext({ window, location: { protocol: 'file:', search: '' }, performance, setTimeout, clearTimeout });
['src/data/catalogo-landing.js', 'nuevoDiseño/formularios.js', 'nuevoDiseño/citas.js', 'nuevoDiseño/ciudadano.js',
  'nuevoDiseño/pasos-tramite.js', 'nuevoDiseño/motor-tramite.js', 'nuevoDiseño/interprete.js']
  .forEach(ruta => vm.runInContext(readFileSync(new URL(ruta, raiz), 'utf8'), contexto, { filename: ruta }));
const { INTERPRETE: I, MOTOR_TRAMITE: M } = window;

const normalizar = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
function calificar(caso, r) {
  const { esperado } = caso;
  const fallas = [];
  const intenciones = [].concat(esperado.intencion);
  if (!intenciones.includes(r.intencion)) fallas.push(`intención ${r.intencion} (esperada ${intenciones.join('/')})`);
  if ('tramite' in esperado && r.tramite !== esperado.tramite) fallas.push(`trámite ${r.tramite} (esperado ${esperado.tramite})`);
  const posibles = [r.tramite, ...(r.candidatos || [])];
  (esperado.candidatos_incluyen || []).forEach(n => { if (!posibles.includes(n)) fallas.push(`falta el candidato ${n}`); });
  const datos = Object.fromEntries((r.datos || []).map(d => [d.campo, d.valor]));
  Object.entries(esperado.datos || {}).forEach(([campo, valor]) => {
    const obtenido = datos[campo];
    if (obtenido === undefined) fallas.push(`falta ${campo}`);
    else if (!(normalizar(obtenido).includes(normalizar(valor)) || normalizar(valor).includes(normalizar(obtenido)))) fallas.push(`${campo}=${obtenido} (esperado ${valor})`);
  });
  (esperado.respuesta_incluye || []).forEach(f => { if (!normalizar(r.respuesta).includes(normalizar(f))) fallas.push(`la respuesta no dice "${f}"`); });
  return fallas;
}

const casos = readFileSync(new URL('pruebas/evaluacion_nlu.jsonl', raiz), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const grupos = {};
let bien = 0;
for (const caso of casos) {
  const n = caso.contexto?.tramite;
  const estado = n ? M.crear(n) : null;
  const r = I.interpretarLocal(caso.mensaje, { estado, fase: caso.contexto?.fase || '' });
  // El intérprete local devuelve saludos sin sentido como sin_sentido; la IA, como fuera de ámbito
  if (r.intencion === 'sin_sentido') r.intencion = 'fuera_de_ambito';
  const fallas = calificar(caso, r);
  const grupo = caso.id.split('-')[0];
  grupos[grupo] = grupos[grupo] || [0, 0];
  grupos[grupo][1]++;
  if (!fallas.length) { bien++; grupos[grupo][0]++; }
  console.log(`${fallas.length ? 'FALLA' : 'OK   '} ${caso.id}: ${caso.mensaje.slice(0, 60)}${fallas.length ? ` — ${fallas.join('; ')}` : ''}`);
}
console.log(`\nModo básico (sin IA): ${bien} de ${casos.length} (${Math.round((100 * bien) / casos.length)}%)`);
Object.entries(grupos).sort().forEach(([g, [b, t]]) => console.log(`  ${g}: ${b}/${t}`));
