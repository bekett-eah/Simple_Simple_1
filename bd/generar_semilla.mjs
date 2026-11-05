// Genera bd/semilla_tramites.sql a partir de los datos del rediseño:
//   src/data/catalogo-landing.js  → instituciones, categorías y los 118 trámites
//   nuevoDiseño/canales.js        → nivel de WhatsApp y trámites judiciales
//   nuevoDiseño/formularios.js    → primer paso de cada formulario (campos, opciones y reglas)
// Uso: node bd/generar_semilla.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
const cargar = (ruta, contexto) => vm.runInNewContext(readFileSync(new URL(ruta, raiz), 'utf8'), contexto);
const window = {};
cargar('src/data/catalogo-landing.js', { window });
cargar('nuevoDiseño/canales.js', { window });
cargar('nuevoDiseño/formularios.js', { window });
const { CATALOGO_TRAMITES: tramites, CANAL_WHATSAPP: canal, FORMULARIOS_TRAMITES: formularios } = window;

const q = v => (v === undefined || v === null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const b = v => (v ? 'true' : 'false');
const json = v => `${q(JSON.stringify(v))}::jsonb`;
const sql = [];
const insertar = (tabla, columnas, filas) => {
  if (!filas.length) return;
  sql.push(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES\n${filas.map(f => `  (${f.join(', ')})`).join(',\n')};\n`);
};

/* ----- Categorías e instituciones ----- */
const CATEGORIAS = { empleo: 'Empleo y trabajo', documentos: 'DUI y partidas', vivienda: 'Agua y hogar', estudio: 'Educación y títulos', otros: 'Otros trámites' };
insertar('categoria', ['id', 'nombre'], Object.entries(CATEGORIAS).map(([id, nombre]) => [q(id), q(nombre)]));

// El sitio de ventanilla de cada institución es el que más se repite entre sus trámites (algunos enlazan a otra)
const instituciones = new Map();
tramites.forEach(t => {
  if (!instituciones.has(t.institucion)) instituciones.set(t.institucion, { id: instituciones.size + 1, siglas: t.institucion.match(/\(([^)]+)\)\s*$/)?.[1], hosts: {} });
  const host = (t.enlace_tramite || '').match(/https:\/\/([a-z0-9-]+\.ventanilla\.simple\.sv)/)?.[1];
  if (host) instituciones.get(t.institucion).hosts[host] = (instituciones.get(t.institucion).hosts[host] || 0) + 1;
});
instituciones.forEach(i => { i.host = Object.entries(i.hosts).sort((a, b) => b[1] - a[1])[0]?.[0]; });
insertar('institucion', ['id', 'nombre', 'siglas', 'sitio_ventanilla'],
  [...instituciones].map(([nombre, i]) => [i.id, q(nombre), q(i.siglas), q(i.host)]));

/* ----- Trámites y canal de WhatsApp ----- */
const NIVEL = { v: 'verde', a: 'amarillo', r: 'rojo' };
insertar('tramite', ['numero', 'nombre', 'descripcion', 'institucion_id', 'dependencia', 'categoria_id', 'costo', 'tiempo', 'modalidad', 'publico', 'enlace_simple', 'enlace_tramite', 'imagen'],
  tramites.map(t => [t.numero, q(t.nombre), q(t.descripcion), instituciones.get(t.institucion).id, q(t.dependencia), q(CATEGORIAS[t.categoria] ? t.categoria : 'otros'), q(t.costo), q(t.tiempo), q(t.modalidad), q(t.publico), q(t.enlace_simple), q(t.enlace_tramite), q(t.imagen)]));
insertar('tramite_canal', ['tramite_numero', 'nivel_whatsapp', 'es_judicial'],
  tramites.map(t => [t.numero, q(NIVEL[canal.niveles[t.numero]] || 'amarillo'), b(canal.judiciales.includes(t.numero))]));

/* ----- Estados para avisos ----- */
insertar('estado_tramite', ['codigo', 'nombre', 'mensaje_ciudadano', 'plantilla_whatsapp'], [
  ['iniciado', 'Iniciado', 'Recibimos tu solicitud.', 'tramite_recibido'],
  ['pendiente_pago', 'Pendiente de pago', 'Tu trámite está listo para pagar.', 'tramite_pago_pendiente'],
  ['en_revision', 'En revisión', 'La institución está revisando tu solicitud.', 'tramite_en_revision'],
  ['subsanar', 'Requiere corrección', 'Tu solicitud necesita una corrección. Ingresa a simple.sv para verla.', 'tramite_corregir'],
  ['completado', 'Finalizado', 'Tu trámite finalizó. Descarga tu documento en simple.sv.', 'tramite_finalizado'],
  ['rechazado', 'No aprobado', 'Tu solicitud no fue aprobada. Ingresa a simple.sv para ver el motivo.', 'tramite_actualizacion']
].map(f => f.map(q)));

/* ----- Primer paso de cada formulario ----- */
const SENSIBLE = /dui|documento|pasaporte|carnet|nie|nit|nrc|cuenta|identidad/i;
const TIPO_CAMPO = { nota: 'nota', seccion: 'seccion', opciones: 'opciones', lista: 'lista', texto: 'texto', archivo: 'archivo' };
const filas = { tarea: [], paso: [], campo: [], opcion: [], visibilidad: [], validacion: [], documento: [], sincronizacion: [] };
let idTarea = 0, idPaso = 0, idCampo = 0;

tramites.forEach(t => {
  filas.sincronizacion.push([t.numero, q('catalogo'), 'NULL', q(createHash('sha256').update(JSON.stringify(t)).digest('hex')), q('ok')]);
  const def = formularios[t.numero];
  if (!def) return;
  const tarea = ++idTarea, paso = ++idPaso;
  filas.tarea.push([tarea, t.numero, q('inicio'), q('Inicio del trámite'), 1, 'true', 'false', q('ciudadano')]);
  filas.paso.push([paso, tarea, 1, q(def.numero || '1'), q(def.titulo), q(def.subtitulo)]);

  def.campos.forEach((c, orden) => {
    const campo = ++idCampo;
    const contenido = c.tipo === 'nota' ? { titulo: c.titulo || null, lineas: c.lineas || [] }
      : c.tipo === 'seccion' ? { titulo: c.titulo }
      : c.sugerencias ? { sugerencias: c.sugerencias } : null;
    // Números de documento escritos y archivos adjuntos: no se piden por WhatsApp
    const sensible = c.tipo === 'archivo' || (c.tipo === 'texto' && SENSIBLE.test(c.nombre || ''));
    filas.campo.push([campo, paso, orden + 1, q(TIPO_CAMPO[c.tipo]), q(c.nombre), q(c.etiqueta), q(c.ayuda), q(c.placeholder),
      q(def.preseleccion?.[c.nombre]), b(!c.opcional && !c.soloLectura && !['nota', 'seccion'].includes(c.tipo)), b(c.multiple), b(c.soloLectura),
      q(c.modo), q(c.tipo === 'nota' ? c.estilo || 'info' : null), contenido ? json(contenido) : 'NULL', b(sensible)]);

    (c.opciones || []).forEach((op, i) => {
      const [valor, texto, detalle, icono] = Array.isArray(op) ? [op[0], op[1]] : [op.valor, op.texto, op.detalle, op.icono];
      filas.opcion.push([campo, i + 1, q(valor), q(texto), q(detalle), q(icono)]);
    });

    if (c.si) {
      const [, controlador, operador, valor] = c.si.match(/^(\w+)(!?=)(.*)$/);
      filas.visibilidad.push([campo, q(controlador), q(operador), q(valor)]);
    }
    if (c.patron) filas.validacion.push([campo, q('patron'), q(c.patron), q(c.mensaje)]);
    if (c.max) filas.validacion.push([campo, q('longitud_maxima'), q(c.max), 'NULL']);
    if (c.modo === 'email') filas.validacion.push([campo, q('correo'), q('true'), q('Escribe un correo válido.')]);
    if (c.igualA) filas.validacion.push([campo, q('igual_a'), q(c.igualA), q(c.mensaje)]);
    if (c.acepta) filas.validacion.push([campo, q('formato_archivo'), q(c.acepta), 'NULL']);
    if (c.tipo === 'archivo') filas.documento.push([t.numero, q(c.etiqueta), q(c.ayuda), q(c.acepta), b(!c.opcional), 'false']);
  });
  filas.sincronizacion.push([t.numero, q('portal'), 'NULL', q(createHash('sha256').update(JSON.stringify(def)).digest('hex')), q('ok')]);
});

insertar('tarea', ['id', 'tramite_numero', 'identificador', 'nombre', 'orden', 'es_inicial', 'es_final', 'responsable'], filas.tarea);
insertar('paso', ['id', 'tarea_id', 'orden', 'numero_visible', 'titulo', 'subtitulo'], filas.paso);
insertar('campo', ['id', 'paso_id', 'orden', 'tipo', 'nombre', 'etiqueta', 'ayuda', 'placeholder', 'valor_inicial', 'obligatorio', 'multiple', 'solo_lectura', 'modo_teclado', 'estilo_nota', 'contenido', 'dato_sensible'], filas.campo);
insertar('campo_opcion', ['campo_id', 'orden', 'valor', 'texto', 'detalle', 'icono'], filas.opcion);
insertar('regla_visibilidad', ['campo_id', 'campo_controlador', 'operador', 'valor'], filas.visibilidad);
insertar('regla_validacion', ['campo_id', 'tipo', 'valor', 'mensaje'], filas.validacion);
insertar('documento_requerido', ['tramite_numero', 'nombre', 'descripcion', 'formatos', 'obligatorio', 'se_puede_enviar_por_whatsapp'], filas.documento);
insertar('sincronizacion', ['tramite_numero', 'origen', 'version_simple', 'hash_contenido', 'resultado'], filas.sincronizacion);

// Las tablas con id explícito deben continuar su secuencia después del último id cargado
['institucion', 'tarea', 'paso', 'campo'].forEach(tabla => sql.push(`SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), (SELECT max(id) FROM ${tabla}));\n`));

const encabezado = `-- Carga inicial generada por bd/generar_semilla.mjs. No editar a mano: vuelve a generarla.\n-- ${tramites.length} trámites, ${idTarea} con formulario (${idCampo} campos).\n\nBEGIN;\n\n`;
writeFileSync(new URL('bd/semilla_tramites.sql', raiz), encabezado + sql.join('\n') + '\nCOMMIT;\n');
console.log(`semilla_tramites.sql: ${tramites.length} trámites, ${instituciones.size} instituciones, ${idTarea} formularios, ${idCampo} campos, ${filas.opcion.length} opciones`);
