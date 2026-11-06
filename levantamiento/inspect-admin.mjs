#!/usr/bin/env node
/* Levantamiento de SimpleSV · primera extracción (PLAN_LEVANTAMIENTO.md, sección 4).

   Se conecta a un Chrome abierto con depuración remota, donde una persona ya inició sesión a mano con el usuario de
   pruebas, y documenta la pantalla del administrador que está abierta. Solo lectura: no hace clic, no llena ni envía
   formularios y no recorre enlaces. No guarda cookies, tokens, almacenamiento local, valores de campos, cabeceras ni
   cuerpos HTTP, ni parámetros de consulta; los textos pasan por un filtro que oculta DUI, NIT, correos y teléfonos.

   Uso (ver README.md):
     node inspect-admin.mjs                                  espera el inicio de sesión y captura la pantalla abierta
     node inspect-admin.mjs --ruta /backend/x --nombre x     abre (GET) una ruta del inventario ya aprobada y la captura
     --esperar 30      minutos que espera el inicio de sesión
     --aprobada        permite abrir una ruta cuyo nombre parece una acción (crear, editar, exportar…)
   Salida: salida/<nombre>.json y salida/<nombre>.md (por defecto, levantamiento-inicial) */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ORIGEN = 'https://simple-dev.egob.sv';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'salida');

// Rutas cuyo nombre sugiere una operación que cambia datos: se marcan en el inventario y no se abren sin --aprobada
// ("iniciar": en SIMPLE, abrir /tramites/iniciar/N crea un trámite; "token": la pantalla del código de acceso de la API lo
// puede cambiar; "seleccionar": en Configuración › Modelador, elige el conector en uso)
const POSIBLE_ESCRITURA = /(eliminar|borrar|delete|destroy|remove|quitar|logout|salir|iniciar|start|cambiar|change|regenerar|token|seleccionar|activar|desactivar|publicar|despublicar|aprobar|rechazar|enviar|send|ejecutar|importar|import|exportar|export|descargar|download|reset|clonar|duplicar|copiar|archivar|restaurar|cancelar|finalizar|asignar|reasignar|guardar|store|update|actualizar|crear|create|nuevo|new|editar|edit|subir|upload)/i;

const espera = ms => new Promise(r => setTimeout(r, ms));
const ocultar = t => String(t || '')
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
  .replace(/\b\d{4}-\d{6}-\d{3}-\d\b/g, '[NIT]')
  .replace(/\b\d{8}-\d\b/g, '[DUI]')
  .replace(/\b\d{9,}\b/g, '[número]');

// Pantalla del administrador con sesión: mismo origen, bajo /backend y fuera de las rutas de autenticación
export function esAdministrador(url) {
  try {
    const u = new URL(url);
    return u.origin === ORIGEN && u.pathname.startsWith('/backend') && !/\/(login|logout|salir)(\/|$)/.test(u.pathname);
  } catch { return false; }
}

/* ----- Lo que se lee de la pantalla (se ejecuta dentro de la página; todo sale ya filtrado) ----- */
function leerPantalla(origen) {
  const ocultarTexto = t => (t || '').replace(/\s+/g, ' ').trim()
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/\b\d{4}-\d{6}-\d{3}-\d\b/g, '[NIT]')
    .replace(/\b\d{8}-\d\b/g, '[DUI]')
    .replace(/(\+?503[\s-]?)?\b[2-7]\d{3}[\s-]?\d{4}\b/g, '[teléfono]')
    .replace(/\b\d{9,}\b/g, '[número]')
    .slice(0, 160);
  const visible = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  // Íconos de fuente (Material Icons): su nombre va aparte, para que no se mezcle con el texto ("account_tree Procesos")
  const ICONOS = '.material-icons, .material-icons-outlined, .material-icons-round, .material-symbols-outlined, .material-symbols-rounded';
  const iconoDe = el => (el.querySelector(ICONOS)?.textContent || '').trim();
  const textoDe = (el, alternativo = '') => {
    const icono = iconoDe(el);
    let texto = el.innerText || alternativo || '';
    if (icono) texto = texto.replace(icono, '');
    return ocultarTexto(texto) || ocultarTexto(el.getAttribute('aria-label') || el.title || '');
  };
  // Texto de una etiqueta sin el de los controles que tenga adentro (un select dentro de un label traería sus opciones)
  const textoSinControles = el => {
    const copia = el.cloneNode(true);
    copia.querySelectorAll('input, select, textarea, option, button').forEach(n => n.remove());
    return ocultarTexto(copia.textContent);
  };
  // Ruta del mismo origen, sin parámetros de consulta; el hash solo si es una ruta de SPA (#/…) sin valores
  const rutaDe = href => {
    if (!href || /^(javascript:|mailto:|tel:|data:)/i.test(href) || (href.startsWith('#') && !/^#!?\//.test(href))) return null;
    try {
      const u = new URL(href, location.href);
      if (u.origin !== origen) return null;
      const hash = /^#!?\//.test(u.hash) && !/[=&]/.test(u.hash) ? u.hash : '';
      return ocultarTexto(u.pathname) + hash;
    } catch { return null; }
  };
  // /usuario_editar/23 → /usuario_editar/{id} (también los identificadores largos, que el filtro ya ocultó)
  const plantillaDe = ruta => ruta.replace(/\/(\d+|\[número\])(?=\/|#|$)/g, '/{id}');
  const recurso = href => {
    try {
      const u = new URL(href, location.href);
      return { ruta: (u.origin === origen ? '' : u.origin) + ocultarTexto(u.pathname), parametros: [...u.searchParams.keys()] };
    } catch { return null; }
  };

  const encabezados = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible)
    .map(h => ({ nivel: Number(h.tagName[1]), texto: ocultarTexto(h.innerText) })).filter(h => h.texto);

  // Enlaces agrupados por plantilla de ruta (/editar/23 → /editar/{id}). Dentro de una tabla, el texto solo se guarda si
  // es un botón de acción: el resto es contenido de la celda (nombres de trámites, de personas…) y no se lee
  const enlaces = [];
  document.querySelectorAll('a[href]').forEach(a => {
    const ruta = rutaDe(a.getAttribute('href'));
    if (!ruta) return;
    const enTabla = !!a.closest('table, [role="grid"], .dataTables_wrapper');
    const esAccion = /\bbtn\b/.test(a.className) || !!a.querySelector(ICONOS) || a.hasAttribute('title') || a.hasAttribute('aria-label');
    const texto = enTabla && !esAccion ? '(texto de la celda, no se lee)' : textoDe(a);
    const plantilla = plantillaDe(ruta);
    const previo = enlaces.find(e => e.ruta === plantilla && e.texto === texto);
    if (previo) { previo.veces++; previo.visible = previo.visible || visible(a); return; }
    enlaces.push({ texto, icono: iconoDe(a), ruta: plantilla, enMenu: !!a.closest('nav, aside, header, [role="navigation"], .sidebar, .navbar, .menu, .nav'), enTabla, visible: visible(a), veces: 1 });
  });

  const botones = [];
  document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"], a.btn').forEach(b => {
    const texto = textoDe(b, b.tagName === 'INPUT' ? b.value : '');
    const icono = iconoDe(b);
    const tipo = b.tagName === 'A' ? 'enlace con estilo de botón' : (b.getAttribute('type') || b.tagName.toLowerCase());
    const deshabilitado = b.disabled === true || b.getAttribute('aria-disabled') === 'true';
    const previo = botones.find(x => x.texto === texto && x.icono === icono && x.tipo === tipo && x.deshabilitado === deshabilitado);
    if (previo) { previo.veces++; return; }
    botones.push({ texto, icono, tipo, deshabilitado, visible: visible(b), veces: 1 });
  });

  const etiquetaDe = c => {
    if (c.id) {
      const l = document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
      if (l) return textoSinControles(l);
    }
    const envolvente = c.closest('label');
    if (envolvente) return textoSinControles(envolvente);
    const ids = c.getAttribute('aria-labelledby');
    if (ids) return ocultarTexto(ids.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
    return ocultarTexto(c.getAttribute('aria-label') || '');
  };
  // Metadatos del campo; su valor nunca se lee
  const campoDe = c => {
    const control = c.tagName.toLowerCase();
    const tipo = control === 'input' ? (c.getAttribute('type') || 'text').toLowerCase() : control;
    const campo = { etiqueta: etiquetaDe(c), control, tipo, nombre: c.getAttribute('name') || '', id: c.id || '' };
    if (tipo === 'hidden') return campo;
    return Object.assign(campo, {
      requerido: c.required === true || c.getAttribute('aria-required') === 'true',
      deshabilitado: c.disabled === true,
      soloLectura: c.readOnly === true,
      visible: visible(c),
      placeholder: ocultarTexto(c.getAttribute('placeholder')),
      patron: c.getAttribute('pattern') || '',
      min: c.getAttribute('min') || '', max: c.getAttribute('max') || '',
      minlength: c.getAttribute('minlength') || '', maxlength: c.getAttribute('maxlength') || '',
      multiple: c.multiple === true,
      acepta: c.getAttribute('accept') || '',
      ...(control === 'select' ? { opciones: c.options.length } : {})
    });
  };
  // Formularios iguales (por ejemplo, el de "Eliminar" de cada fila) se agrupan: misma plantilla de acción y mismos campos
  const formularios = [];
  [...document.forms].forEach(f => {
    const accion = rutaDe(f.getAttribute('action') || location.href);
    const datos = {
      id: f.id || '', nombre: f.getAttribute('name') || '',
      metodo: (f.getAttribute('method') || 'get').toUpperCase(),
      accion: accion ? plantillaDe(accion) : '(otro origen)',
      codificacion: f.getAttribute('enctype') || '',
      visible: visible(f),
      campos: [...f.querySelectorAll('input, select, textarea')].map(campoDe)
    };
    const clave = `${datos.metodo} ${datos.accion} ${datos.campos.map(c => `${c.nombre}:${c.tipo}`).join(',')}`;
    const previo = formularios.find(x => x.clave === clave);
    if (previo) { previo.veces++; previo.visible = previo.visible || datos.visible; return; }
    formularios.push({ clave, ...datos, veces: 1 });
  });
  const sueltos = [...document.querySelectorAll('input, select, textarea')].filter(c => !c.form);
  if (sueltos.length) formularios.push({ clave: '', id: '', nombre: '(campos fuera de un formulario)', metodo: '', accion: '', codificacion: '', visible: true, campos: sueltos.map(campoDe), veces: 1 });
  formularios.forEach((f, i) => { delete f.clave; f.numero = i + 1; });

  // Tablas: solo la estructura (columnas y cantidad de filas), nunca el contenido de las celdas
  const tablas = [...document.querySelectorAll('table')].map(t => {
    let columnas = [...t.querySelectorAll('thead th, thead td')].map(c => ocultarTexto(c.innerText));
    if (!columnas.some(Boolean)) columnas = [...(t.rows[0]?.querySelectorAll('th') || [])].map(c => ocultarTexto(c.innerText));
    const filas = t.tBodies.length ? [...t.tBodies].reduce((n, b) => n + b.rows.length, 0) : t.rows.length;
    return { titulo: ocultarTexto(t.caption?.innerText || t.getAttribute('aria-label')), columnas: columnas.filter(Boolean), filas, visible: visible(t) };
  });

  const scripts = [...document.scripts].filter(s => s.src).map(s => recurso(s.src)).filter(Boolean);
  const estilos = [...document.querySelectorAll('link[rel~="stylesheet"][href]')].map(l => recurso(l.href)).filter(Boolean);
  const iframes = [...document.querySelectorAll('iframe[src]')].map(f => recurso(f.src)).filter(Boolean);

  // Marcadores de tecnología: versiones que expone la página y convenciones del DOM
  const w = window;
  let vue = w.Vue?.version || null;
  if (!vue && (document.querySelector('[data-v-app]') || document.getElementById('app')?.__vue_app__ || document.getElementById('app')?.__vue__)) vue = 'presente';
  const raizReact = document.getElementById('root') || document.getElementById('app');
  const marcadores = {
    jquery: w.jQuery?.fn?.jquery || null,
    jqueryUi: w.jQuery?.ui?.version || null,
    bootstrap: w.bootstrap?.Tooltip?.VERSION || w.jQuery?.fn?.tooltip?.Constructor?.VERSION || null,
    vue,
    react: !!(document.querySelector('[data-reactroot]') || (raizReact && Object.keys(raizReact).some(k => k.startsWith('__react')))),
    angular: document.querySelector('[ng-version]')?.getAttribute('ng-version') || w.angular?.version?.full || null,
    livewire: !!(w.Livewire || document.querySelector('[wire\\:id]')),
    alpine: w.Alpine?.version || (document.querySelector('[x-data]') ? 'presente' : null),
    inertia: !!document.querySelector('[data-page]'),
    htmx: w.htmx?.version || null,
    datatables: w.jQuery?.fn?.dataTable?.version || w.DataTable?.version || null,
    select2: !!w.jQuery?.fn?.select2,
    sweetalert: !!(w.Swal || w.swal),
    chartjs: w.Chart?.version || null,
    moment: w.moment?.version || null,
    tinymce: w.tinymce?.majorVersion ? `${w.tinymce.majorVersion}.${w.tinymce.minorVersion}` : null,
    ckeditor: w.CKEDITOR?.version || null,
    axios: !!w.axios,
    lodash: w._?.VERSION || null,
    metaCsrf: !!document.querySelector('meta[name="csrf-token"]'),
    campoToken: !!document.querySelector('input[name="_token"]'),
    campoMetodo: !!document.querySelector('input[name="_method"]'),
    generador: document.querySelector('meta[name="generator"]')?.content || null,
    clasesBody: (document.body?.className || '').slice(0, 200),
    materialIcons: !!document.querySelector(ICONOS),
    analitica: !!(w.ga || w.gtag || w.dataLayer)
  };

  return {
    titulo: ocultarTexto(document.title), idioma: document.documentElement.lang || '',
    encabezados, enlaces, botones, formularios, tablas,
    recursos: { scripts, estilos, scriptsEnLinea: [...document.scripts].filter(s => !s.src).length, iframes },
    marcadores
  };
}

/* ----- Tecnologías: confirmadas (la página expone la versión), indicios (nombre de recurso o marcador) y desconocidas ----- */
function clasificarTecnologias(m, recursos, rutas, rutasSolicitudes) {
  const confirmadas = [];
  const indicios = [];
  const conVersion = (nombre, version, evidencia) => { if (version) confirmadas.push({ nombre, version: version === 'presente' ? null : version, evidencia }); };
  conVersion('jQuery', m.jquery, 'window.jQuery.fn.jquery');
  conVersion('jQuery UI', m.jqueryUi, 'window.jQuery.ui.version');
  conVersion('Bootstrap (JS)', m.bootstrap, 'versión del plugin Tooltip');
  conVersion('Vue', m.vue, 'window.Vue o raíz de la aplicación');
  conVersion('Angular', m.angular, 'atributo ng-version / window.angular');
  conVersion('Alpine.js', m.alpine, 'window.Alpine o atributo x-data');
  conVersion('htmx', m.htmx, 'window.htmx.version');
  conVersion('DataTables', m.datatables, 'jQuery.fn.dataTable.version');
  conVersion('Chart.js', m.chartjs, 'window.Chart.version');
  conVersion('Moment.js', m.moment, 'window.moment.version');
  conVersion('TinyMCE', m.tinymce, 'window.tinymce');
  conVersion('CKEditor', m.ckeditor, 'window.CKEDITOR.version');
  conVersion('Lodash', m.lodash, 'window._.VERSION');
  if (m.react) confirmadas.push({ nombre: 'React', version: null, evidencia: 'raíz con propiedades __react*' });
  if (m.livewire) confirmadas.push({ nombre: 'Livewire', version: null, evidencia: 'window.Livewire o atributo wire:id' });
  if (m.select2) confirmadas.push({ nombre: 'Select2', version: null, evidencia: 'jQuery.fn.select2' });
  if (m.sweetalert) confirmadas.push({ nombre: 'SweetAlert', version: null, evidencia: 'window.Swal / window.swal' });
  if (m.axios) confirmadas.push({ nombre: 'Axios', version: null, evidencia: 'window.axios' });
  if (m.materialIcons) confirmadas.push({ nombre: 'Material Icons (fuente de íconos)', version: null, evidencia: 'elementos con clase material-icons' });
  if (m.inertia) indicios.push({ nombre: 'Inertia.js', evidencia: 'atributo data-page' });

  const todos = [...recursos.scripts, ...recursos.estilos].map(r => r.ruta);
  const buscar = re => todos.find(r => re.test(r.toLowerCase()));
  const porRecurso = (nombre, re, yaConfirmada) => {
    const r = buscar(re);
    if (r && !confirmadas.some(c => c.nombre.startsWith(yaConfirmada || nombre))) indicios.push({ nombre, evidencia: `recurso ${r}` });
  };
  porRecurso('Bootstrap', /bootstrap/, 'Bootstrap');
  porRecurso('jQuery', /jquery(?!.*ui)/, 'jQuery');
  porRecurso('Font Awesome', /font-?awesome|fontawesome/);
  porRecurso('AdminLTE', /adminlte/);
  porRecurso('Vue', /\bvue(\.min)?\.js|vue\.(global|runtime)/, 'Vue');
  porRecurso('Laravel Livewire', /livewire/, 'Livewire');
  porRecurso('Compilado con Vite', /\/build\/assets\//);
  porRecurso('Google reCAPTCHA', /recaptcha/);
  porRecurso('Google Maps JavaScript API', /maps\.googleapis\.com/);
  porRecurso('Chosen (listas desplegables)', /chosen/);
  porRecurso('Bootstrap Timepicker', /timepicker/);
  if (recursos.scripts.some(r => r.ruta.endsWith('/js/app.js') && r.parametros.includes('id'))) indicios.push({ nombre: 'Laravel Mix', evidencia: '/js/app.js con parámetro de versión "id"' });
  const laravel = [m.metaCsrf && 'meta csrf-token', m.campoToken && 'campo _token', m.campoMetodo && 'campo _method para simular PUT o DELETE'].filter(Boolean);
  if (m.lodash && m.axios && m.jquery) laravel.push('lodash, axios y jQuery globales, como el bootstrap.js por defecto de Laravel');
  if (laravel.length) indicios.push({ nombre: 'Laravel (backend)', evidencia: laravel.join('; ') });
  if (rutas.some(r => /^\/ayuda\/simple\//.test(r))) indicios.push({ nombre: 'SIMPLE (plataforma de código abierto del Gobierno de Chile)', evidencia: 'ayuda publicada en /ayuda/simple/…' });
  if (rutasSolicitudes.some(r => r.startsWith('/cdn-cgi/'))) indicios.push({ nombre: 'Cloudflare delante del sitio', evidencia: 'recursos en /cdn-cgi/ (ofuscación de correos de Cloudflare)' });
  if (/sidebar-mini|layout-fixed|hold-transition/.test(m.clasesBody)) indicios.push({ nombre: 'AdminLTE', evidencia: `clases del body: ${m.clasesBody}` });
  if (rutas.some(r => /claveunica/i.test(r))) indicios.push({ nombre: 'Autenticación con Clave Única (patrón de SIMPLE)', evidencia: 'rutas con "claveunica"' });
  if (m.generador) indicios.push({ nombre: m.generador, evidencia: 'meta generator' });
  if (m.analitica) indicios.push({ nombre: 'Analítica web (Google)', evidencia: 'window.ga / gtag / dataLayer' });

  const desconocidas = ['Lenguaje y framework del backend (sin evidencia directa)', 'Base de datos', 'Catálogo de APIs internas', 'Modelo de roles y permisos'];
  return { confirmadas, indicios: indicios.filter((x, i) => indicios.findIndex(y => y.nombre === x.nombre) === i), desconocidas };
}

/* ----- Captura de una pantalla: solicitudes al recargarla (GET) y estructura ----- */
export async function capturar(pagina, { destino = null, recargar = true } = {}) {
  const notas = [];
  const solicitudes = new Map();
  const otrosOrigenes = new Set();
  const url = destino || pagina.url();

  if (recargar && !destino && new URL(url).search) {
    notas.push('No se recargó la pantalla: su URL tiene parámetros de consulta, que podrían ser de un solo uso');
  } else if (recargar) {
    const alResponder = respuesta => {
      let u;
      try { u = new URL(respuesta.url()); } catch { return; }
      if (u.protocol === 'data:') return;
      if (u.origin !== ORIGEN) { otrosOrigenes.add(u.host); return; }
      const pedido = respuesta.request();
      const clave = [pedido.method(), ocultar(u.pathname), pedido.resourceType(), respuesta.status()].join(' ');
      const previa = solicitudes.get(clave);
      if (previa) previa.veces++;
      else solicitudes.set(clave, { metodo: pedido.method(), ruta: ocultar(u.pathname), tipo: pedido.resourceType(), estado: respuesta.status(), veces: 1 });
    };
    pagina.on('response', alResponder);
    // Se abre con GET (no se usa "recargar": si la pantalla vino de un POST, recargar lo reenviaría)
    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 45_000 }).catch(e => notas.push(`La carga no terminó en reposo de red: ${e.message.split('\n')[0]}`));
    await espera(1500);
    pagina.off('response', alResponder);
  }

  const final = new URL(pagina.url());
  if (destino && final.pathname !== new URL(destino).pathname) notas.push(`La ruta pedida redirigió a ${ocultar(final.pathname)}`);
  const leido = await pagina.evaluate(leerPantalla, ORIGEN);
  const rutas = [...leido.enlaces.map(e => e.ruta), ...leido.formularios.map(f => f.accion)];
  const marcar = e => ({ ...e, accion: POSIBLE_ESCRITURA.test(e.ruta) || POSIBLE_ESCRITURA.test(e.texto) ? 'posible escritura' : 'lectura' });

  return {
    herramienta: 'levantamiento/inspect-admin.mjs',
    generado: new Date().toISOString(),
    entorno: ORIGEN,
    pantalla: { ruta: ocultar(final.pathname), titulo: leido.titulo, idioma: leido.idioma, sesionActiva: esAdministrador(final.href) },
    encabezados: leido.encabezados,
    enlaces: {
      navegacion: leido.enlaces.filter(e => e.enMenu).map(marcar),
      contenido: leido.enlaces.filter(e => !e.enMenu).map(marcar)
    },
    botones: leido.botones,
    formularios: leido.formularios.map(f => ({ ...f, operacion: !f.metodo ? 'sin formulario' : f.metodo === 'GET' ? 'lectura (GET)' : 'escritura probable' })),
    tablas: leido.tablas,
    recursos: leido.recursos,
    tecnologias: clasificarTecnologias(leido.marcadores, leido.recursos, rutas, [...solicitudes.values()].map(s => s.ruta)),
    solicitudes: { alRecargar: [...solicitudes.values()], otrosOrigenes: [...otrosOrigenes].sort() },
    notas
  };
}

/* ----- Informe en Markdown ----- */
const celda = t => (String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '—');
const tablaMd = (cabeceras, filas) => (filas.length
  ? [`| ${cabeceras.join(' | ')} |`, `|${cabeceras.map(() => '---').join('|')}|`, ...filas.map(f => `| ${f.map(celda).join(' | ')} |`)].join('\n')
  : '_Ninguno_');
const sino = v => (v ? 'sí' : 'no');

export function aMarkdown(x) {
  const validaciones = c => [c.patron && `patrón ${c.patron}`, c.minlength && `mín. ${c.minlength} car.`, c.maxlength && `máx. ${c.maxlength} car.`, c.min && `mín. ${c.min}`, c.max && `máx. ${c.max}`, c.acepta && `acepta ${c.acepta}`, c.multiple && 'múltiple', c.opciones !== undefined && `${c.opciones} opciones`, c.soloLectura && 'solo lectura', c.deshabilitado && 'deshabilitado', c.visible === false && 'oculto'].filter(Boolean).join(', ');
  return [
    `# Levantamiento · ${x.pantalla.titulo || x.pantalla.ruta}`,
    '',
    `- **Generado:** ${x.generado}`,
    `- **Entorno:** ${x.entorno}`,
    `- **Ruta:** \`${x.pantalla.ruta}\``,
    `- **Título:** ${x.pantalla.titulo || '—'} · **Idioma:** ${x.pantalla.idioma || '—'} · **Sesión activa:** ${sino(x.pantalla.sesionActiva)}`,
    '',
    '> Solo lectura. Sin cookies, tokens, valores de campos, cabeceras, cuerpos HTTP ni parámetros de consulta. DUI, NIT, correos y teléfonos ocultos. Revisar antes de compartir.',
    '',
    '## Encabezados visibles',
    x.encabezados.length ? x.encabezados.map(h => `${'  '.repeat(h.nivel - 1)}- h${h.nivel}: ${h.texto}`).join('\n') : '_Ninguno_',
    '',
    '## Navegación (menús y cabecera)',
    tablaMd(['Texto', 'Ícono', 'Ruta', 'Visible', 'Acción'], x.enlaces.navegacion.map(e => [e.texto, e.icono, `\`${e.ruta}\``, sino(e.visible), e.accion])),
    '',
    '## Otros enlaces del mismo origen',
    tablaMd(['Texto', 'Ícono', 'Ruta', 'En tabla', 'Visible', 'Veces', 'Acción'], x.enlaces.contenido.map(e => [e.texto, e.icono, `\`${e.ruta}\``, sino(e.enTabla), sino(e.visible), e.veces, e.accion])),
    '',
    '## Botones',
    tablaMd(['Texto', 'Ícono', 'Tipo', 'Deshabilitado', 'Visible', 'Veces'], x.botones.map(b => [b.texto, b.icono, b.tipo, sino(b.deshabilitado), sino(b.visible), b.veces])),
    '',
    '## Formularios',
    x.formularios.length ? x.formularios.map(f => [
      `### ${f.numero}. ${f.nombre || f.id || 'Formulario'} · ${f.metodo || '—'} \`${f.accion || '—'}\` · ${f.operacion}${f.veces > 1 ? ` · ×${f.veces}` : ''}${f.visible ? '' : ' · oculto'}`,
      tablaMd(['Etiqueta', 'Control', 'Tipo', 'Nombre', 'Obligatorio', 'Placeholder', 'Otras reglas'], f.campos.map(c => [c.etiqueta, c.control, c.tipo, c.nombre, c.tipo === 'hidden' ? '—' : sino(c.requerido), c.placeholder, c.tipo === 'hidden' ? 'oculto (valor no leído)' : validaciones(c)]))
    ].join('\n\n')).join('\n\n') : '_Ninguno_',
    '',
    '## Tablas (solo estructura)',
    tablaMd(['Título', 'Columnas', 'Filas', 'Visible'], x.tablas.map(t => [t.titulo, t.columnas.join(' · '), t.filas, sino(t.visible)])),
    '',
    '## Recursos',
    `**Scripts (${x.recursos.scripts.length}, más ${x.recursos.scriptsEnLinea} en línea)**`,
    x.recursos.scripts.map(r => `- \`${r.ruta}\`${r.parametros.length ? ` (parámetros: ${r.parametros.join(', ')})` : ''}`).join('\n') || '_Ninguno_',
    '',
    `**Hojas de estilo (${x.recursos.estilos.length})**`,
    x.recursos.estilos.map(r => `- \`${r.ruta}\`${r.parametros.length ? ` (parámetros: ${r.parametros.join(', ')})` : ''}`).join('\n') || '_Ninguna_',
    ...(x.recursos.iframes.length ? ['', '**Iframes**', x.recursos.iframes.map(r => `- \`${r.ruta}\``).join('\n')] : []),
    '',
    '## Tecnologías',
    '**Confirmadas** (la página expone la librería o su versión)',
    x.tecnologias.confirmadas.map(t => `- ${t.nombre}${t.version ? ` ${t.version}` : ''} — ${t.evidencia}`).join('\n') || '_Ninguna_',
    '',
    '**Indicios** (nombre de recurso, marcador del DOM o convención)',
    x.tecnologias.indicios.map(t => `- ${t.nombre} — ${t.evidencia}`).join('\n') || '_Ninguno_',
    '',
    '**Desconocidas** (sin evidencia suficiente)',
    x.tecnologias.desconocidas.map(t => `- ${t}`).join('\n'),
    '',
    '## Solicitudes del mismo origen al cargar la pantalla',
    tablaMd(['Método', 'Ruta', 'Tipo', 'Estado', 'Veces'], x.solicitudes.alRecargar.map(s => [s.metodo, `\`${s.ruta}\``, s.tipo, s.estado, s.veces])),
    '',
    `**Otros orígenes contactados:** ${x.solicitudes.otrosOrigenes.join(', ') || 'ninguno'}`,
    ...(x.notas.length ? ['', '## Notas', x.notas.map(n => `- ${n}`).join('\n')] : []),
    ''
  ].join('\n');
}

/* ----- Ejecución ----- */
async function conectar() {
  for (let intento = 0; intento < 30; intento++) {
    try { return await chromium.connectOverCDP(CDP_URL); } catch { await espera(1000); }
  }
  throw new Error(`No hay un Chrome con depuración remota en ${CDP_URL}. Ábrelo como indica README.md`);
}

async function principal() {
  const argumentos = process.argv.slice(2);
  const opcion = (nombre, porDefecto) => {
    const i = argumentos.indexOf(`--${nombre}`);
    return i >= 0 && argumentos[i + 1] ? argumentos[i + 1] : porDefecto;
  };
  const ruta = opcion('ruta', null);
  const nombre = opcion('nombre', 'levantamiento-inicial').replace(/[^\w-]/g, '-');
  const minutos = Number(opcion('esperar', '30'));

  if (ruta) {
    if (!/^\/backend(\/[\w\-.~%]*)*$/.test(ruta)) throw new Error('--ruta debe ser una ruta bajo /backend, sin parámetros de consulta');
    if (POSIBLE_ESCRITURA.test(ruta) && !argumentos.includes('--aprobada')) throw new Error(`"${ruta}" parece una acción que cambia datos. Revísala y, si solo muestra información, repite con --aprobada`);
  }

  const navegador = await conectar();
  const buscar = () => navegador.contexts().flatMap(c => c.pages()).reverse().find(p => esAdministrador(p.url()));
  const limite = Date.now() + minutos * 60_000;
  let pagina = null;
  let avisado = false;
  while (!pagina && Date.now() < limite) {
    const candidata = buscar();
    if (candidata) {
      await candidata.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await espera(1500);
      if (esAdministrador(candidata.url())) { pagina = candidata; break; }
    }
    if (!avisado) { console.log(`Esperando el inicio de sesión manual en ${ORIGEN}/backend (hasta ${minutos} min)…`); avisado = true; }
    await espera(2000);
  }
  if (!pagina) { console.error('No se detectó una pantalla del administrador con sesión iniciada'); process.exit(2); }

  const informe = await capturar(pagina, { destino: ruta ? ORIGEN + ruta : null });
  await mkdir(CARPETA, { recursive: true });
  await writeFile(path.join(CARPETA, `${nombre}.json`), JSON.stringify(informe, null, 2) + '\n');
  await writeFile(path.join(CARPETA, `${nombre}.md`), aMarkdown(informe));
  if (!informe.pantalla.sesionActiva) console.warn(`Aviso: la pantalla terminó en ${informe.pantalla.ruta}; la sesión puede haber vencido`);
  console.log(`Listo: salida/${nombre}.json y salida/${nombre}.md`);
  console.log(`Ruta ${informe.pantalla.ruta} · ${informe.enlaces.navegacion.length} enlaces de navegación · ${informe.enlaces.contenido.length} otros enlaces · ${informe.formularios.length} formularios · ${informe.tablas.length} tablas · ${informe.solicitudes.alRecargar.length} solicitudes`);
  // Solo se corta la conexión: el Chrome y la sesión quedan abiertos para las siguientes capturas
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch(e => { console.error(e.message); process.exit(1); });
}
