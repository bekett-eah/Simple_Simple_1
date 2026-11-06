// Genera bd/base_conocimiento.json para el asistente de IA (asistente_ia.py), con los mismos datos del rediseño
// que usa generar_semilla.mjs:
//   src/data/catalogo-landing.js                 → los 118 trámites
//   archivos/catalogo_118_tramites_simple_sv.md → la ficha de cada trámite (sección "#### N.")
//   nuevoDiseño/canales.js                               → nivel de WhatsApp y trámites judiciales
//   nuevoDiseño/formularios.js                           → los formularios completos (todos los pasos), sin las listas largas
//   nuevoDiseño/citas.js                                 → sedes y horarios de los trámites con cita
//   nuevoDiseño/ciudadano.js                             → solo los NOMBRES de los campos que vienen de la Identidad Digital (nunca los valores)
// Python lo lee sin tener que interpretar JavaScript. En producción se reemplaza por la vista v_tramite_chatbot y la API
// interna del reporte (GET /api/tramites?buscar=, /api/tramites/{n}/formulario, /api/tramites/{n}/canal).
// Uso: node bd/generar_base_conocimiento.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, raiz), 'utf8');
const window = {};
['src/data/catalogo-landing.js', 'nuevoDiseño/canales.js', 'nuevoDiseño/formularios.js', 'nuevoDiseño/citas.js', 'nuevoDiseño/ciudadano.js']
  .forEach(ruta => vm.runInNewContext(leer(ruta), { window }));
const { CATALOGO_TRAMITES: tramites, CANAL_WHATSAPP: canal, FORMULARIOS_TRAMITES: formularios, CITAS_TRAMITES: citas, CIUDADANO: cuenta } = window;

// La misma regla de generar_semilla.mjs: números de documento escritos y archivos adjuntos son datos sensibles
const SENSIBLE = /dui|documento|pasaporte|carnet|nie|nit|nrc|cuenta|identidad/i;
const NIVEL = { v: 'verde', a: 'amarillo', r: 'rojo' };
// Las listas más largas que esto no van al modelo: las valida el navegador
const MAX_OPCIONES = 60;

// Ficha de cada trámite en el catálogo en Markdown: desde "#### N. Nombre" hasta el siguiente encabezado
const fichas = {};
const md = leer('archivos/catalogo_118_tramites_simple_sv.md').split('\n');
let actual = null;
md.forEach(linea => {
  const encabezado = linea.match(/^#### (\d+)\. /);
  if (encabezado) { actual = Number(encabezado[1]); fichas[actual] = [linea.slice(5)]; return; }
  if (/^#{1,4} /.test(linea) || linea.startsWith('---')) { actual = null; return; }
  if (actual && linea.trim()) fichas[actual].push(linea.replace(/^\s*- /, '- ').trim());
});

const opcionesDe = c => (c.opciones || []).map(o => (Array.isArray(o) ? [String(o[0]), String(o[1])] : [String(o.valor), String(o.texto)]));

function campo(c) {
  const salida = { tipo: c.tipo };
  ['nombre', 'etiqueta', 'ayuda', 'si', 'prellenarSi', 'depende', 'origen', 'patron', 'modo', 'igualA', 'mensaje'].forEach(k => { if (c[k]) salida[k] = c[k]; });
  ['opcional', 'soloLectura', 'multiple', 'cantidad'].forEach(k => { if (c[k]) salida[k] = true; });
  if (c.marcado !== undefined) salida.marcado = c.marcado;
  if (c.min) salida.min = c.min;
  if (c.max) salida.max = c.max;
  if (c.tipo === 'nota' || c.tipo === 'seccion') salida.titulo = c.titulo || '';
  if (c.tipo === 'nota') salida.lineas = c.lineas || [];
  const opciones = opcionesDe(c);
  if (opciones.length) {
    if (opciones.length <= MAX_OPCIONES) salida.opciones = opciones;
    else salida.opcionesTotales = opciones.length;
  }
  salida.sensible = c.tipo === 'archivo' || (c.tipo === 'texto' && SENSIBLE.test(c.nombre || ''));
  return salida;
}

const paso = p => {
  const salida = { titulo: p.titulo || '', campos: (p.campos || []).filter(c => !['desplegable', 'finDesplegable', 'resumen'].includes(c.tipo)).map(campo) };
  ['si', 'tipo', 'fin', 'boton'].forEach(k => { if (p[k]) salida[k] = p[k]; });
  if (p.monto) salida.monto = p.monto;
  return salida;
};

const base = {
  descripcion: 'Base de conocimiento del asistente de Simple.sv. Generada por bd/generar_base_conocimiento.mjs: no editar a mano.',
  campos_de_cuenta: Object.keys(cuenta).sort(),
  tramites: tramites.map(t => ({
    numero: t.numero,
    nombre: t.nombre,
    institucion: t.institucion,
    sigla: t.institucion.match(/\(([^)]+)\)\s*$/)?.[1] || '',
    dependencia: t.dependencia || '',
    categoria: t.categoria,
    descripcion: t.descripcion || '',
    costo: t.costo || '',
    tiempo: t.tiempo || '',
    modalidad: t.modalidad || '',
    publico: t.publico || '',
    enlace_simple: t.enlace_simple || '',
    enlace_tramite: t.enlace_tramite || '',
    en_chat: Boolean(formularios[t.numero]),
    cita: Boolean(citas[t.numero]),
    nivel_whatsapp: NIVEL[canal.niveles[t.numero]] || 'amarillo',
    judicial: canal.judiciales.includes(t.numero)
  })),
  fichas: Object.fromEntries(Object.entries(fichas).map(([n, lineas]) => [n, lineas.join('\n')])),
  formularios: Object.fromEntries(Object.entries(formularios).map(([n, f]) => [n, {
    informacion: f.informacion || null,
    preseleccion: f.preseleccion || {},
    pasos: [f, ...(f.pasos || [])].map(paso)
  }])),
  citas
};

writeFileSync(new URL('bd/base_conocimiento.json', raiz), `${JSON.stringify(base, null, 1)}\n`);
const totalCampos = Object.values(base.formularios).reduce((s, f) => s + f.pasos.reduce((x, p) => x + p.campos.filter(c => c.nombre).length, 0), 0);
console.log(`base_conocimiento.json: ${base.tramites.length} trámites, ${Object.keys(base.fichas).length} fichas, ${Object.keys(base.formularios).length} formularios (${totalCampos} campos con nombre)`);
