/* Asistente de Simple.sv: chat lateral para encontrar el trámite, ver sus pasos, ir al formulario, agendar la cita
   y los avisos o el canal de WhatsApp. Lo usan Indexlogin.html (con sesión) y la landing index.html (sin sesión).
   Cada página define antes window.ASISTENTE_PAGINA = { sesion, verCategoria(id), verTema(id), verBusqueda(texto) }
   y su propio catálogo, del que se usan TRAMITES, CATEGORIAS, TEMAS, TEMA_DE, SINONIMOS, PALABRAS_VACIAS,
   normalizar, palabrasDeBusqueda, textoDeBusqueda, costoCorto y escapar (son iguales en las dos páginas).
   Datos: formularios.js, citas.js, pasos-tramite.js y, con sesión, canales.js y ciudadano.js.
   Estilos en asistente.css; el marcado del botón y del panel está en cada página. */
(() => {
  const PAGINA = window.ASISTENTE_PAGINA || {};
  const SESION = Boolean(PAGINA.sesion);
  const FORMULARIOS = window.FORMULARIOS_TRAMITES || {};
  const ICONO_CATEGORIA = { empleo: 'ph-briefcase', documentos: 'ph-identification-card', vivienda: 'ph-house-line', estudio: 'ph-graduation-cap' };
  const {
    pasosDe, horaLegible, horarioDe, horarioLargo, horarioCorto,
    capitalizar, fechaDe, isoDe, fechaLarga, fechaCorta, diasDisponibles, horariosLibres, queLlevar
  } = window.PASOS_TRAMITE;

  // Solo enlaces http(s) del catálogo
  function urlSegura(url) {
    return /^https?:\/\//i.test(String(url || '')) ? url : '#';
  }

  // Sin sesión, hacer el trámite pide iniciar sesión; el login vuelve al destino pedido (?destino=…&n=…)
  const LOGIN = '../SIMPLE%20ACTUAL/Login%20-%20Gobierno%20de%20El%20Salvador.html';
  const conSesion = (destino, numero) => `${LOGIN}?destino=${destino}${numero ? `&n=${numero}` : ''}`;

  function alternarAsistente(abrir) {
    const panel = document.getElementById('asistente');
    const fab = document.getElementById('fab');
    const teniaFoco = panel.contains(document.activeElement);
    panel.classList.toggle('open', abrir);
    fab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) {
      // El panel entra desde la derecha con una transición de 0.3 s. En Android, si el campo recibe el foco
      // mientras aún está fuera de pantalla, el teclado no se abre; por eso se enfoca de nuevo al terminar la transición.
      const campo = document.getElementById('texto-asistente');
      campo.focus({ preventScroll: true });
      setTimeout(() => { if (panel.classList.contains('open')) campo.focus({ preventScroll: true }); }, 320);
    }
    else if (teniaFoco) fab.focus({ preventScroll: true });
  }

  function agregarMensaje(clase, html) {
    const caja = document.getElementById('mensajes');
    const div = document.createElement('div');
    div.className = clase;
    div.innerHTML = html;
    if (clase === 'l2-bot') {
      const fila = document.createElement('div');
      fila.className = 'l2-fila-bot';
      fila.innerHTML = '<img class="l2-avatar-bot" src="../src/assets/brand/simple-robot-asistente-sin-fondo.png" alt="" width="36" height="36">';
      fila.appendChild(div);
      caja.appendChild(fila);
    } else {
      caja.appendChild(div);
    }
    // Cada mensaje del asistente guarda cómo iba la conversación (para volver a ese punto) y el botón de volver pasa al último
    if (clase === 'l2-bot') caja.lastElementChild._conv = clonar(conversacion);
    actualizarVolver();
    caja.scrollTop = caja.scrollHeight;
  }

  const clonar = valor => JSON.parse(JSON.stringify(valor));

  /* Volver al paso anterior: el último mensaje del asistente lleva siempre un botón para deshacer el último paso.
     Quita lo que la persona eligió o escribió y la respuesta que recibió, y la conversación queda en el mensaje anterior.
     No aparece en el saludo inicial (todavía no hay ningún paso que deshacer). */
  function actualizarVolver() {
    const caja = document.getElementById('mensajes');
    caja.querySelectorAll('.l2-volver').forEach(b => b.remove());
    const ultimo = [...caja.children].filter(c => c.classList.contains('l2-fila-bot')).at(-1)?.querySelector('.l2-bot');
    if (!ultimo || !caja.querySelector(':scope > .l2-me')) return;
    const fila = document.createElement('div');
    fila.className = 'l2-options l2-volver';
    fila.innerHTML = boton(conIcono('ph-arrow-u-up-left', 'Volver al paso anterior'), 'volverPasoAnterior()', 'l2-option-volver');
    ultimo.appendChild(fila);
  }

  function volverPasoAnterior() {
    const caja = document.getElementById('mensajes');
    const hijos = [...caja.children];
    const inicio = hijos.map(c => c.classList.contains('l2-me')).lastIndexOf(true);
    if (inicio < 0) return;
    hijos.slice(inicio).forEach(c => c.remove());
    const anterior = [...caja.children].filter(c => c.classList.contains('l2-fila-bot')).at(-1);
    conversacion = anterior?._conv ? clonar(anterior._conv) : { numero: null };
    actualizarVolver();
    caja.scrollTop = caja.scrollHeight;
    // El foco queda en el primer botón del mensaje al que se volvió
    anterior?.querySelector('button:not(.l2-option-volver), a')?.focus({ preventScroll: true });
  }

  /* ===== Encuentra el trámite y lleva al formulario, agenda la cita o lo conecta con WhatsApp =====
     El chat de la web no llena datos del trámite: lleva al formulario o, si el trámite lo permite, agenda la cita
     en la institución (citas.js). Con sesión, WhatsApp solo avisa cuando el trámite finaliza (canales.js);
     sin sesión (landing), el trámite se puede llevar al chat de WhatsApp de Simple.sv (whatsapp.html) tras iniciar sesión. */
  const NIVELES_WA = window.CANAL_WHATSAPP?.niveles || {};
  const JUDICIALES = new Set(window.CANAL_WHATSAPP?.judiciales || []);
  const CITAS = window.CITAS_TRAMITES || {};
  // Los de uso más común según prompt-rediseno-simple-sv.md; reemplazar cuando haya estadísticas reales
  const MAS_SOLICITADOS = [99, 100, 73, 113, 64, 61, 53, 52];
  // Las listas del chat se paginan de 4 en 4; con más de 8 trámites también se ofrece verlos en el catálogo
  const POR_PAGINA_CHAT = 4;
  const EN_CHAT = 8;
  let conversacion = { numero: null };
  const tramiteActual = () => TRAMITES.find(t => t.numero === conversacion.numero);
  const boton = (texto, accion, clase = '') => `<button type="button" class="l2-option ${clase}" onclick="${accion}">${texto}</button>`;
  const conIcono = (icono, texto) => `<i class="ph ${icono}" aria-hidden="true"></i>${texto}`;

  /* Validación: el asistente solo atiende trámites. Saludos, agradecimientos y despedidas se contestan con cortesía;
     un mensaje sin sentido o sin ninguna palabra de trámites recibe una respuesta que recuerda para qué sirve.
     Es de trámites si tiene alguna palabra de los nombres, instituciones y categorías del catálogo, de los sinónimos
     o de PALABRAS_TRAMITE (las descripciones no cuentan: tienen demasiadas palabras comunes). */
  const SALUDOS = ['hola', 'ola', 'hey', 'saludos', 'buen', 'buenas', 'buenos', 'dia', 'dias', 'tarde', 'tardes', 'noche', 'noches', 'que', 'tal', 'como', 'estas', 'esta', 'usted', 'tu'];
  const AGRADECIMIENTOS = ['gracias', 'muchas', 'mil', 'ok', 'okey', 'vale', 'listo', 'perfecto', 'genial', 'excelente', 'muy', 'bien'];
  const DESPEDIDAS = ['adios', 'chao', 'chau', 'bye', 'hasta', 'luego', 'pronto', 'manana', 'nos', 'vemos'];
  const PALABRAS_TRAMITE = ['tramite', 'gestion', 'constancia', 'certificado', 'certificacion', 'certificar', 'solvencia', 'documento', 'papel',
    'partida', 'nacimiento', 'matrimonio', 'defuncion', 'divorcio', 'dui', 'identidad', 'pasaporte', 'licencia', 'permiso', 'cita', 'requisito',
    'formulario', 'pago', 'pagar', 'costo', 'precio', 'apostilla', 'apostillar', 'registro', 'inscripcion', 'inscribir', 'solicitud', 'solicitar',
    'renovar', 'renovacion', 'titulo', 'bachiller', 'nota', 'estudio', 'universidad', 'escuela', 'colegio', 'agua', 'factura', 'recibo', 'cuenta',
    'antecedente', 'penal', 'policial', 'trabajo', 'empleo', 'vivienda', 'casa', 'vehiculo', 'carro', 'placa', 'migracion', 'viaje', 'viajar',
    'extranjero', 'empresa', 'negocio', 'impuesto', 'alcaldia', 'municipal', 'descargar', 'seguimiento', 'ventanilla', 'institucion', 'sede',
    'paso', 'proceso', 'procedimiento'];
  // Palabras demasiado comunes en los nombres de instituciones y trámites para indicar el tema
  const NO_TEMATICAS = new Set(['salvador', 'nacional', 'general', 'direccion', 'republica', 'autonoma', 'ejecutiva', 'comision', 'superior', 'unidad',
    'oficina', 'publica', 'publico', 'social', 'centro', 'instituto', 'fondo', 'consejo', 'por', 'con', 'sin', 'sus', 'como', 'esta', 'este', 'otro', 'otra',
    'mas', 'sobre', 'entre', 'ante', 'desde', 'hasta', 'segun', 'cual', 'del', 'las', 'los', 'una', 'uno', 'para', 'que']);
  const formas = p => [p, p.replace(/s$/, ''), p.replace(/es$/, '')].filter(f => f.length >= 3);
  const palabrasDelMensaje = texto => normalizar(texto).split(/[^a-z0-9ñ]+/).filter(Boolean).map(p => p.replace(/(.)\1{2,}/g, '$1'));
  const VOCABULARIO = new Set();
  [...TRAMITES.map(t => `${t.nombre} ${t.institucion} ${t.dependencia}`), ...Object.values(CATEGORIAS), ...TEMAS.map(x => `${x.nombre} ${x.desc}`),
    ...Object.keys(SINONIMOS), ...Object.values(SINONIMOS).flat(), ...PALABRAS_TRAMITE]
    .forEach(texto => palabrasDelMensaje(texto)
      .filter(p => p.length >= 3 && !NO_TEMATICAS.has(p) && !PALABRAS_VACIAS.includes(p))
      .forEach(p => formas(p).forEach(f => VOCABULARIO.add(f))));
  // Parece una palabra: tiene vocal y no es un tecleo al azar (cinco o más consonantes seguidas)
  const pareceTexto = p => p.length >= 2 && /[aeiou]/.test(p) && !/[^aeiou\d]{5,}/.test(p);

  function clasificarMensaje(texto) {
    const palabras = palabrasDelMensaje(texto);
    const solo = lista => palabras.length > 0 && palabras.every(p => lista.includes(p));
    if (solo(SALUDOS)) return 'saludo';
    if (solo(AGRADECIMIENTOS)) return 'gracias';
    if (solo(DESPEDIDAS)) return 'despedida';
    if (palabras.some(p => formas(p).some(f => VOCABULARIO.has(f)))) return 'tramite';
    return palabras.some(pareceTexto) ? 'fueraDeTema' : 'sinSentido';
  }

  // Mensajes cortos: amables, pero al grano (a la persona no le gusta leer mucho de una vez)
  const RESPUESTAS = {
    saludo: { texto: '¡Hola! ¿Qué trámite buscas?', categorias: true },
    gracias: { texto: '¡Con gusto! ¿Necesitas otro trámite?' },
    despedida: { texto: '¡Hasta pronto!' },
    sinSentido: { texto: 'No te entendí. Escribe tu trámite, por ejemplo <strong>partida de nacimiento</strong>', categorias: true },
    fueraDeTema: { texto: 'Solo puedo ayudarte con trámites de Simple.sv. ¿Cuál buscas?', categorias: true }
  };

  function responderSinBuscar(tipo) {
    const { texto, categorias } = RESPUESTAS[tipo];
    agregarMensaje('l2-bot', `${texto}${categorias ? `<div class="l2-options l2-options-grid">${botonesCategorias()}</div>` : ''}`);
  }

  // Ordena por palabras encontradas; suben los que ya tienen formulario y los que contienen la frase completa
  function buscarTramites(texto) {
    const palabras = palabrasDeBusqueda(texto);
    const frase = normalizar(texto.trim());
    return TRAMITES.map(t => {
      const cuerpo = textoDeBusqueda(t);
      const aciertos = palabras.filter(p => cuerpo.includes(p)).length;
      const puntos = aciertos ? aciertos + (FORMULARIOS[t.numero] ? 0.5 : 0) + (normalizar(t.nombre).includes(frase) ? 2 : 0) : 0;
      return { t, puntos };
    }).filter(x => x.puntos > 0).sort((a, b) => b.puntos - a.puntos).map(x => x.t);
  }

  // Categorías del chat: los más solicitados, las pestañas del catálogo y las categorías temáticas;
  // sin sesión, también la ayuda con la Identidad Digital y las preguntas frecuentes
  function botonesCategorias() {
    return boton(conIcono('ph-star', 'Más solicitados'), "verCategoria('solicitados')")
      + Object.entries(CATEGORIAS).map(([id, nombre]) => boton(conIcono(ICONO_CATEGORIA[id], nombre), `verCategoria('${id}')`)).join('')
      + boton(conIcono('ph-squares-four', 'Más categorías'), 'verMasCategorias()')
      + (SESION ? '' : boton(conIcono('ph-identification-badge', 'Identidad Digital'), "verIdentidad('Identidad Digital')")
        + boton(conIcono('ph-question', 'Preguntas frecuentes'), 'verPreguntas()'));
  }
  document.getElementById('opciones-inicio').innerHTML = botonesCategorias();

  // Con más de POR_PAGINA_CHAT elementos, cada página es un grupo y abajo va el paginador del catálogo.
  // nombre: lo que se lista, en plural ("trámites"), para las etiquetas de las flechas.
  function listaPaginada(elementos, opcion, nombre) {
    const paginas = [];
    for (let i = 0; i < elementos.length; i += POR_PAGINA_CHAT) paginas.push(elementos.slice(i, i + POR_PAGINA_CHAT));
    const grupos = paginas.map((p, i) => `<div class="l2-chat-tramites"${i ? ' hidden' : ''}>${p.map(opcion).join('')}</div>`).join('');
    if (paginas.length < 2) return grupos;
    return `<div class="l2-chat-lista">${grupos}
        <div class="l2-chat-paginador">
          <button type="button" class="l2-nav-btn" aria-label="${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} anteriores" onclick="paginarChat(this, -1)" disabled><i class="ph ph-caret-left" aria-hidden="true"></i></button>
          <span class="l2-pager" role="status" aria-live="polite">Página 1 de ${paginas.length}</span>
          <button type="button" class="l2-nav-btn" aria-label="Más ${nombre}" onclick="paginarChat(this, 1)"><i class="ph ph-caret-right" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

  // verPasos: al elegir, los pasos del trámite se muestran abiertos (la persona los pidió)
  function listaDeTramites(lista, verPasos = false) {
    return listaPaginada(lista, t => `
      <button type="button" class="l2-chat-tramite" onclick="elegirTramite(${t.numero}${verPasos ? ', true' : ''})">
        <span><strong>${escapar(t.nombre)}</strong><small>${escapar(t.institucion)}</small></span>
        <i class="ph ph-caret-right" aria-hidden="true"></i>
      </button>`, 'trámites');
  }

  function paginarChat(control, delta) {
    const lista = control.closest('.l2-chat-lista');
    const paginas = [...lista.querySelectorAll('.l2-chat-tramites')];
    const destino = Math.max(0, Math.min(paginas.length - 1, paginas.findIndex(p => !p.hidden) + delta));
    paginas.forEach((p, i) => { p.hidden = i !== destino; });
    const [anterior, siguiente] = lista.querySelectorAll('.l2-nav-btn');
    anterior.disabled = destino === 0;
    siguiente.disabled = destino === paginas.length - 1;
    lista.querySelector('.l2-pager').textContent = `Página ${destino + 1} de ${paginas.length}`;
    // Si el botón tocado quedó desactivado, el foco pasa al otro
    if (control.disabled) (control === anterior ? siguiente : anterior).focus();
  }

  // Trámites de una categoría en el chat; si son muchos, también se ofrecen en el catálogo
  function mostrarLista(lista, intro, verTodos) {
    const mas = verTodos && lista.length > EN_CHAT ? `<div class="l2-options">${boton(`Ver los ${lista.length} en la lista`, verTodos)}</div>` : '';
    agregarMensaje('l2-bot', `${intro}${listaDeTramites(lista)}${mas}`);
  }

  function verCategoria(id) {
    if (id === 'solicitados') {
      agregarMensaje('l2-me', 'Más solicitados');
      mostrarLista(MAS_SOLICITADOS.map(n => TRAMITES.find(t => t.numero === n)).filter(Boolean), '¿Cuál de estos necesitas?');
      return;
    }
    agregarMensaje('l2-me', escapar(CATEGORIAS[id]));
    mostrarLista(TRAMITES.filter(t => t.categoria === id), '¿Cuál de estos necesitas?', `irDesdeAsistente('${id}')`);
  }

  function verMasCategorias() {
    agregarMensaje('l2-me', 'Más categorías');
    agregarMensaje('l2-bot', `¿De qué tema es tu trámite?
      <div class="l2-options l2-options-grid">${TEMAS.map(tema => boton(conIcono(`ph-${tema.icono}`, escapar(tema.nombre)), `verTema('${tema.id}')`)).join('')}</div>`);
  }

  function verTema(id) {
    const tema = TEMAS.find(x => x.id === id);
    agregarMensaje('l2-me', escapar(tema.nombre));
    mostrarLista(TRAMITES.filter(t => TEMA_DE[t.numero] === id), '¿Cuál de estos necesitas?', `abrirTemaDesdeAsistente('${id}')`);
  }

  function responderAsistente(texto) {
    // Sin sesión: dudas sobre la Identidad Digital y preguntas frecuentes, antes de buscar trámites
    if (!SESION) {
      const frase = ` ${palabrasDelMensaje(texto).join(' ')} `;
      if (CLAVES_IDENTIDAD.some(c => frase.includes(` ${c} `))) { verIdentidad(''); return; }
      const pregunta = PREGUNTAS.findIndex(p => p.claves.some(c => frase.includes(` ${c} `)));
      if (pregunta >= 0) { verRespuesta(pregunta, false); return; }
    }
    const tipo = clasificarMensaje(texto);
    if (tipo !== 'tramite') { responderSinBuscar(tipo); return; }
    // "¿Cuáles son los pasos?": los del trámite que nombre el mensaje o, si no nombra ninguno, los del último que vio
    const palabras = palabrasDelMensaje(texto);
    const pidePasos = palabras.some(p => PIDE_PASOS.includes(p));
    const consulta = pidePasos ? palabras.filter(p => !PIDE_PASOS.includes(p)).join(' ') : texto;
    if (pidePasos && clasificarMensaje(consulta) !== 'tramite') {
      // Sin reiniciar la conversación: se conserva la cita, si ya la agendó
      if (tramiteActual()) mensajeTramite(tramiteActual(), true);
      else agregarMensaje('l2-bot', `¿De qué trámite quieres ver los pasos?
        <div class="l2-options l2-options-grid">${botonesCategorias()}</div>`);
      return;
    }
    const coincidencias = buscarTramites(consulta);

    if (coincidencias.length === 0) {
      agregarMensaje('l2-bot', `No lo encontré. Prueba con otras palabras o elige una opción
        <div class="l2-options l2-options-grid">${botonesCategorias()}</div>`);
      return;
    }
    if (pidePasos && coincidencias.length === 1) { elegirTramite(coincidencias[0].numero, true, false); return; }

    const verTodos = coincidencias.length > 3
      ? `<div class="l2-options"><button class="l2-option" onclick="mostrarEnCatalogo(this.dataset.q)" data-q="${escapar(consulta)}">Ver los ${coincidencias.length} en la lista</button></div>`
      : '';
    const pregunta = pidePasos ? '¿De cuál quieres ver los pasos?' : coincidencias.length === 1 ? 'Encontré este trámite' : '¿Cuál de estos buscas?';
    agregarMensaje('l2-bot', `${pregunta}${listaDeTramites(coincidencias.slice(0, 3), pidePasos)}${verTodos}`);
  }

  function enlaceFormulario(t) {
    if (FORMULARIOS[t.numero] && !SESION) {
      return `<a class="l2-option l2-option-principal" href="${conSesion('tramite', t.numero)}"><i class="ph ph-arrow-right" aria-hidden="true"></i>Ir al formulario</a>`;
    }
    if (FORMULARIOS[t.numero]) {
      const icono = FORMULARIOS[t.numero].icono || ICONO_CATEGORIA[t.categoria] || 'ph-file-text';
      return `<a class="l2-option l2-option-principal" href="tramite.html?n=${t.numero}" data-transicion="${escapar(t.nombre)}" data-transicion-icono="${icono}" data-transicion-rapida><i class="ph ph-arrow-right" aria-hidden="true"></i>Ir al formulario</a>`;
    }
    return `<a class="l2-option l2-option-principal" href="${escapar(urlSegura(t.enlace_tramite))}" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-square-out" aria-hidden="true"></i>Ir al formulario en simple.sv</a>`;
  }

  /* Pasos a seguir de cada trámite (pasos-tramite.js), en un desplegable con el diseño de "Cómo funciona":
     cerrado al ver el trámite, abierto si la persona los pide. */
  const PIDE_PASOS = ['paso', 'pasos', 'proceso', 'procedimiento', 'seguir', 'como'];

  function pasosDesplegables(t, abiertos) {
    return desplegablePasos(pasosDe(t), abiertos, 'Pasos a seguir');
  }

  function desplegablePasos(pasos, abiertos, titulo) {
    return `<details class="l2-chat-pasos"${abiertos ? ' open' : ''}>
        <summary><span class="l2-pasos-titulo">${titulo}</span><small>${pasos.length} pasos</small><span class="l2-pasos-accion" aria-hidden="true"><i class="ph ph-caret-up"></i></span></summary>
        <ol class="l2-pasos-vert">${pasos.map((p, i) => `
          <li>
            <span class="l2-paso hecho" aria-hidden="true">${i + 1}</span>
            <div class="l2-paso-msg">
              <span class="l2-paso-card-num">Paso ${i + 1} de ${pasos.length}</span>
              <strong>${escapar(p.titulo)}</strong>
              <span class="l2-paso-card-texto">${escapar(p.texto)}</span>
            </div>
          </li>`).join('')}</ol>
      </details>`;
  }

  // Al abrir unos pasos, el chat se desplaza para que se vea su inicio y, si caben, todos
  document.getElementById('mensajes').addEventListener('toggle', e => {
    if (!e.target.matches('.l2-chat-pasos') || !e.target.open) return;
    const caja = document.getElementById('mensajes');
    const r = e.target.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (r.top < c.top) caja.scrollBy({ top: r.top - c.top - 12, behavior });
    else if (r.bottom > c.bottom) caja.scrollBy({ top: Math.min(r.bottom - c.bottom + 12, r.top - c.top - 12), behavior });
  }, true);

  // Cómo hacer el trámite: formulario, cita (si la permite) y WhatsApp. Con sesión, WhatsApp avisa cuando finaliza;
  // sin sesión, los trámites con formulario se pueden llevar al chat de WhatsApp de Simple.sv
  function opcionesDe(t) {
    const cita = CITAS[t.numero];
    const agendar = cita ? boton(conIcono('ph-calendar-check', 'Agendar cita'), 'agendarCita()') : '';
    // Termina en "p. m.", que ya sirve de punto antes de la frase que sigue
    const horario = cita ? `Citas ${horarioLargo(cita.horario)} ` : '';
    if (!SESION) {
      const whatsapp = FORMULARIOS[t.numero] ? boton(conIcono('ph-whatsapp-logo', 'Llevarlo por WhatsApp'), 'llevarPorWhatsApp()', 'l2-option-wa') : '';
      return `<div class="l2-options">${enlaceFormulario(t)}${agendar}${whatsapp}</div>
        <p class="l2-chat-nota">${horario}Necesitas tu Identidad Digital. <button type="button" class="l2-chat-enlace" onclick="verIdentidad()">¿No la tienes?</button></p>`;
    }
    return `<div class="l2-options">${enlaceFormulario(t)}${agendar}${boton(conIcono('ph-whatsapp-logo', 'Avisarme por WhatsApp'), 'iniciarWhatsApp()', 'l2-option-wa')}</div>
      <p class="l2-chat-nota">${horario}Te avisamos por correo cuando finalice</p>`;
  }

  function mensajeTramite(t, verPasos) {
    agregarMensaje('l2-bot', `${verPasos ? 'Estos son los pasos para' : 'Perfecto:'} <strong>${escapar(t.nombre)}</strong>${pasosDesplegables(t, verPasos)}
      <p class="l2-chat-pregunta">¿Cómo quieres hacerlo?</p>${opcionesDe(t)}`);
  }

  // verPasos: los pasos se muestran abiertos; eco: repite como mensaje de la persona el trámite que eligió
  function elegirTramite(numero, verPasos = false, eco = true) {
    conversacion = { numero };
    const t = tramiteActual();
    if (eco) agregarMensaje('l2-me', escapar(t.nombre));
    mensajeTramite(t, verPasos);
  }

  /* Cita en la institución (citas.js): sede, día y hora desde el chat, sin pasar por el formulario.
     El formulario del trámite conserva su propia opción de cita. Días, horarios libres y qué llevar: pasos-tramite.js. */
  const citaDelTramite = () => CITAS[conversacion.numero];

  function resumenCita(codigo) {
    const t = tramiteActual();
    const { sede, fecha, hora } = conversacion.cita;
    const s = citaDelTramite().sedes[sede];
    return `<dl class="l2-cita">
        ${codigo ? `<div><dt>Cita</dt><dd>N.º ${codigo}</dd></div>` : ''}
        <div><dt>Trámite</dt><dd>${escapar(t.nombre)}</dd></div>
        <div><dt>Sede</dt><dd>${escapar(s.nombre)} · ${escapar(s.detalle)}</dd></div>
        <div><dt>Atención</dt><dd>${horarioCorto(horarioDe(citaDelTramite(), s))}</dd></div>
        <div><dt>Fecha</dt><dd>${capitalizar(fechaLarga(fechaDe(fecha)))}</dd></div>
        <div><dt>Hora</dt><dd>${horaLegible(hora)}</dd></div>
      </dl>
      <p class="l2-cita-titulo">Qué llevar</p>
      <ul class="l2-cita-llevar">${queLlevar(t, citaDelTramite()).map(x => `<li>${escapar(x)}</li>`).join('')}</ul>`;
  }

  // Una cita ya confirmada no se cambia con los botones de mensajes anteriores: se vuelve a elegir el trámite
  const citaAbierta = () => Boolean(conversacion.cita) && !conversacion.cita.codigo;

  function agendarCita() {
    if (!citaDelTramite()) return;
    agregarMensaje('l2-me', 'Agendar cita');
    if (!SESION) {
      pedirSesion('cita', 'Para agendar, inicia sesión', conIcono('ph-sign-in', 'Sí, iniciar sesión y agendar'));
      return;
    }
    preguntarSede();
  }

  function preguntarSede() {
    conversacion.cita = {};
    agregarMensaje('l2-bot', `¿En qué sede te queda mejor?
      <div class="l2-chat-tramites">${citaDelTramite().sedes.map((s, i) => `
        <button type="button" class="l2-chat-tramite" onclick="elegirSede(${i})">
          <span><strong>${escapar(s.nombre)}</strong><small>${escapar(s.detalle)} · ${horarioCorto(horarioDe(citaDelTramite(), s))}</small></span>
          <i class="ph ph-map-pin" aria-hidden="true"></i>
        </button>`).join('')}</div>`);
  }

  function elegirSede(i) {
    const sede = citaDelTramite()?.sedes[i];
    if (!sede || !citaAbierta()) return;
    conversacion.cita = { sede: i };
    agregarMensaje('l2-me', escapar(sede.nombre));
    preguntarDia();
  }

  // El horario de la sede ya va en el botón con que se eligió
  function preguntarDia() {
    agregarMensaje('l2-bot', `¿Qué día prefieres?
      <div class="l2-options l2-options-grid l2-options-3">${diasDisponibles().map(f => boton(fechaCorta(f), `elegirDia('${isoDe(f)}')`)).join('')}</div>`);
  }

  function elegirDia(fecha) {
    if (!citaAbierta() || conversacion.cita.sede === undefined) return;
    conversacion.cita = { sede: conversacion.cita.sede, fecha };
    const larga = fechaLarga(fechaDe(fecha));
    agregarMensaje('l2-me', capitalizar(larga));
    agregarMensaje('l2-bot', `¿A qué hora el <strong>${larga}</strong>?
      <div class="l2-options l2-options-grid l2-options-3">${horariosLibres(citaDelTramite(), conversacion.cita.sede, fecha).map(h => boton(horaLegible(h), `elegirHora('${fecha}', '${h}')`)).join('')}</div>
      <div class="l2-options">${boton(conIcono('ph-calendar-blank', 'Otro día'), 'otroDia()')}</div>`);
  }

  function otroDia() {
    if (!citaAbierta() || conversacion.cita.sede === undefined) return;
    agregarMensaje('l2-me', 'Otro día');
    preguntarDia();
  }

  function elegirHora(fecha, hora) {
    if (!citaAbierta() || conversacion.cita.fecha !== fecha) return;
    conversacion.cita.hora = hora;
    agregarMensaje('l2-me', horaLegible(hora));
    agregarMensaje('l2-bot', `Revisa y confirma tu cita${resumenCita()}
      <div class="l2-options">${boton(conIcono('ph-check', 'Finalizar cita'), 'confirmarCita()', 'l2-option-principal')}${boton('Cambiar', 'cambiarCita()')}</div>`);
  }

  function cambiarCita() {
    if (!citaAbierta()) return;
    agregarMensaje('l2-me', 'Cambiar');
    preguntarSede();
  }

  function confirmarCita() {
    if (!citaAbierta() || !conversacion.cita.hora) return;
    conversacion.cita.codigo = String(Date.now()).slice(-6);
    agregarMensaje('l2-me', 'Finalizar cita');
    agregarMensaje('l2-bot', `¡Listo! Tu cita está confirmada${resumenCita(conversacion.cita.codigo)}
      <div class="l2-options">${boton(conIcono('ph-whatsapp-logo', 'Avisarme por WhatsApp'), 'iniciarWhatsApp()', 'l2-option-wa')}</div>
      <p class="l2-chat-nota">Vista de diseño: la cita aún no se registra en la institución</p>`);
  }

  /* Sin sesión (landing): para hacer el trámite, agendar la cita o llevarlo a WhatsApp se inicia sesión con la
     Identidad Digital; el login vuelve al paso pedido. Además, ayuda para crear la Identidad Digital y las preguntas
     frecuentes de Contáctanos, que también se responden si se escriben. */
  function pedirSesion(destino, texto, etiqueta, clase = 'l2-option-principal') {
    agregarMensaje('l2-bot', `${texto}. ¿Ya tienes tu <strong>Identidad Digital</strong>?
      <div class="l2-options"><a class="l2-option ${clase}" href="${conSesion(destino, conversacion.numero)}">${etiqueta}</a>${boton('No, ¿cómo la creo?', "verIdentidad('No, ¿cómo la creo?')")}</div>`);
  }

  function llevarPorWhatsApp() {
    if (!FORMULARIOS[conversacion.numero]) return;
    agregarMensaje('l2-me', 'Llevarlo por WhatsApp');
    pedirSesion('whatsapp', 'Por WhatsApp te pedimos los datos uno por uno. Primero inicia sesión',
      conIcono('ph-whatsapp-logo', 'Sí, iniciar sesión y abrir WhatsApp'), 'l2-option-wa');
  }

  const CLAVES_IDENTIDAD = ['identidad digital', 'login gob', 'prueba de vida', 'no tengo cuenta', 'crear cuenta', 'crear una cuenta', 'crear mi cuenta',
    'registrarme', 'como me registro', 'iniciar sesion', 'contrasena'];
  const PASOS_IDENTIDAD = [
    { titulo: 'Ten a mano', texto: 'Tu DUI, tu correo personal y un celular activo' },
    { titulo: 'Regístrate en login.gob.sv', texto: 'Llena el registro con tus datos' },
    { titulo: 'Haz la prueba de vida', texto: 'Con la cámara confirmamos que eres tú' },
    { titulo: 'Inicia sesión en Simple.sv', texto: 'Y haz tus trámites en línea' }
  ];

  // etiqueta: lo que se repite como mensaje de la persona ('' si ya lo escribió)
  function verIdentidad(etiqueta = 'No tengo Identidad Digital') {
    if (etiqueta) agregarMensaje('l2-me', escapar(etiqueta));
    agregarMensaje('l2-bot', `La <strong>Identidad Digital</strong> es tu cuenta para hacer trámites en línea. No compartas tu contraseña${desplegablePasos(PASOS_IDENTIDAD, true, 'Cómo crearla')}
      <div class="l2-options"><a class="l2-option l2-option-principal" href="https://login.gob.sv/" target="_blank" rel="noopener noreferrer">${conIcono('ph-arrow-square-out', 'Crear mi Identidad Digital')}</a><a class="l2-option" href="${conSesion('tramites')}">${conIcono('ph-sign-in', 'Ya la tengo: iniciar sesión')}</a></div>`);
  }

  // Las de Contáctanos; claves: frases (sin tildes) que, escritas en el chat, llevan a la respuesta
  const PREGUNTAS = [
    { pregunta: '¿Cómo me registro en Simple.sv?', claves: ['como registrarse', 'registrarse en simple', 'registrarte en simple'],
      respuesta: 'Crea tu <strong>Identidad Digital</strong> en login.gob.sv con tu DUI, tu correo y tu celular. Con ella inicias sesión',
      extra: () => boton(conIcono('ph-identification-badge', 'Cómo crear mi Identidad Digital'), "verIdentidad('Cómo crear mi Identidad Digital')") },
    { pregunta: '¿Cómo solicito un trámite?', claves: ['como solicito', 'como solicitar', 'como hago un tramite', 'como se hace un tramite', 'como funciona simple'],
      respuesta: 'Inicia sesión, busca tu trámite, llena los datos y paga si hace falta. Te confirmamos por correo' },
    { pregunta: '¿Qué hago si mi trámite tarda demasiado?', claves: ['tarda mucho', 'tarda demasiado', 'se tarda', 'se demora', 'no me responden', 'no me han respondido'],
      respuesta: 'Revisa el plazo del trámite y tu correo, por si te piden corregir algo. En el seguimiento ves su estado' },
    { pregunta: '¿Puedo hacer trámites desde el extranjero?', claves: ['extranjero', 'exterior', 'fuera del pais', 'otro pais'],
      respuesta: 'Sí. Muchos piden DUI vigente; si no lo tienes, alguien con DUI puede hacerlo por ti. Algunos son en persona' },
    { pregunta: '¿Con qué tarjeta puedo pagar?', claves: ['con que tarjeta', 'que tarjeta', 'tipo de tarjeta', 'tarjeta internacional', 'cargo adicional', 'formas de pago', 'metodos de pago'],
      respuesta: 'Con tarjeta de crédito o débito, nacional o internacional. La internacional tiene un cargo de 1.7% + IVA, que ves antes de pagar' }
  ];

  function verPreguntas() {
    agregarMensaje('l2-me', 'Preguntas frecuentes');
    agregarMensaje('l2-bot', `¿Cuál es tu duda?${listaPaginada(PREGUNTAS, p => `
      <button type="button" class="l2-chat-tramite" onclick="verRespuesta(${PREGUNTAS.indexOf(p)})">
        <span><strong>${escapar(p.pregunta)}</strong></span>
        <i class="ph ph-caret-right" aria-hidden="true"></i>
      </button>`, 'preguntas')}`);
  }

  // eco: repite la pregunta como mensaje de la persona (no hace falta si ya la escribió)
  function verRespuesta(i, eco = true) {
    const p = PREGUNTAS[i];
    if (eco) agregarMensaje('l2-me', escapar(p.pregunta));
    agregarMensaje('l2-bot', `${p.respuesta}
      <div class="l2-options">${p.extra ? p.extra() : ''}${boton(conIcono('ph-question', 'Ver otras preguntas'), 'verPreguntas()')}</div>`);
  }

  /* Con sesión, WhatsApp no hace el trámite: solo avisa cuando finaliza, al celular registrado en la cuenta
     (ciudadano.js). Para usar otro número se cambia en Mi cuenta. El aviso por correo llega siempre.
     En los trámites sensibles (nivel r) y judiciales de canales.js, el aviso no nombra el trámite. */
  const CUENTA = window.CIUDADANO || {};
  const ENLACE_MI_CUENTA = '<a class="l2-option" href="../SIMPLE ACTUAL/Identidad digital.html" target="_blank" rel="noopener noreferrer"><i class="ph ph-user-circle" aria-hidden="true"></i>Ir a Mi cuenta</a>';
  function iniciarWhatsApp() {
    agregarMensaje('l2-me', 'Avisarme por WhatsApp');
    agregarMensaje('l2-bot', `Por WhatsApp solo te avisamos cuando finalice. ¿Tienes activas las <strong>notificaciones por WhatsApp</strong> en tu Identidad Digital?
      <div class="l2-options">${boton('Sí, están activas', "respuestaNotificaciones(true, 'Sí, están activas')")}${boton('No / no sé', "respuestaNotificaciones(false, 'No / no sé')")}</div>`);
  }

  function respuestaNotificaciones(activas, etiqueta) {
    agregarMensaje('l2-me', escapar(etiqueta));
    if (!activas) {
      agregarMensaje('l2-bot', `Actívalas en <strong>Mi cuenta</strong>. Mientras tanto, te avisamos por correo
        <div class="l2-options">${ENLACE_MI_CUENTA}${boton('Ya las activé', "respuestaNotificaciones(true, 'Ya las activé')")}</div>`);
      return;
    }
    if (!CUENTA.telefono) {
      agregarMensaje('l2-bot', `Tu cuenta no tiene celular. Agrégalo en <strong>Mi cuenta</strong>. Mientras tanto, te avisamos por correo
        <div class="l2-options">${ENLACE_MI_CUENTA}</div>`);
      return;
    }
    agregarMensaje('l2-bot', `¿Te avisamos al <strong>${escapar(CUENTA.telefono)}</strong>?
      <div class="l2-options">${boton('Sí, a ese número', 'confirmarWhatsApp()')}${boton('No, quiero otro', 'cambiarNumero()')}</div>`);
  }

  function cambiarNumero() {
    agregarMensaje('l2-me', 'No, quiero otro');
    agregarMensaje('l2-bot', `Solo avisamos al número de tu cuenta. Cámbialo en <strong>Mi cuenta</strong> y vuelve aquí
      <div class="l2-options">${ENLACE_MI_CUENTA}${boton('Ya lo cambié', "respuestaNotificaciones(true, 'Ya lo cambié')")}</div>`);
  }

  function confirmarWhatsApp() {
    agregarMensaje('l2-me', 'Sí, a ese número');
    const t = tramiteActual();
    const reservado = NIVELES_WA[t.numero] === 'r' || JUDICIALES.has(t.numero);
    const aviso = reservado ? ' Por privacidad, el aviso no dirá el nombre del trámite.' : '';
    // Si ya agendó la cita no hace falta nada más; si no, se le ofrece empezar el trámite
    const agendada = conversacion.cita?.codigo;
    const siguiente = agendada ? '' : ` Ahora inicia tu trámite
      <div class="l2-options">${enlaceFormulario(t)}${CITAS[t.numero] ? boton(conIcono('ph-calendar-check', 'Agendar cita'), 'agendarCita()') : ''}</div>`;
    agregarMensaje('l2-bot', `¡Listo! Te escribiremos al <strong>${escapar(CUENTA.telefono)}</strong> cuando finalice.${aviso} También te avisamos por correo${siguiente ? '.' : ''}${siguiente}
      <p class="l2-chat-nota">Nunca te pediremos datos por WhatsApp. Responde BAJA para dejar de recibir avisos. Vista de diseño: aún no se envían mensajes reales</p>`);
  }

  /* Botón de WhatsApp de la landing: después de iniciar sesión (?whatsapp) el chat se abre solo para confirmar
     el celular de la cuenta y lleva al chat de WhatsApp de Simple.sv, que ya envía el "Hola" y pregunta qué trámite hacer.
     Si el número no es el correcto, se cambia en Mi cuenta: los mensajes solo van al número registrado. */
  function confirmarNumeroWhatsApp() {
    if (!CUENTA.telefono) {
      agregarMensaje('l2-bot', `Necesitamos un celular en tu cuenta. Agrégalo en <strong>Mi cuenta</strong> y vuelve aquí
        <div class="l2-options">${ENLACE_MI_CUENTA}${boton('Ya lo agregué', 'numeroWhatsAppCambiado()')}</div>`);
      return;
    }
    agregarMensaje('l2-bot', `Seguimos por <strong>WhatsApp</strong>. ¿Te escribimos al <strong>${escapar(CUENTA.telefono)}</strong>?
      <div class="l2-options">${boton(conIcono('ph-whatsapp-logo', 'Sí, ir a WhatsApp'), 'irAWhatsApp()', 'l2-option-wa')}${boton('No, cambiarlo', 'cambiarNumeroWhatsApp()')}</div>`);
  }

  function cambiarNumeroWhatsApp() {
    agregarMensaje('l2-me', 'No, cambiarlo');
    agregarMensaje('l2-bot', `Cámbialo en <strong>Mi cuenta</strong> y vuelve aquí
      <div class="l2-options">${ENLACE_MI_CUENTA}${boton('Ya lo cambié', 'numeroWhatsAppCambiado()')}</div>`);
  }

  function numeroWhatsAppCambiado() {
    agregarMensaje('l2-me', 'Ya lo cambié');
    confirmarNumeroWhatsApp();
  }

  function irAWhatsApp() {
    agregarMensaje('l2-me', 'Sí, ir a WhatsApp');
    agregarMensaje('l2-bot', 'Te llevamos a WhatsApp…');
    setTimeout(() => { location.href = 'whatsapp.html?hola=1'; }, 1200);
  }

  // Ver en el catálogo de la página: cada página dice cómo abrirlo (ASISTENTE_PAGINA)
  function mostrarEnCatalogo(texto) {
    alternarAsistente(false);
    PAGINA.verBusqueda?.(texto);
  }

  function irDesdeAsistente(cat) {
    alternarAsistente(false);
    PAGINA.verCategoria?.(cat);
  }

  function abrirTemaDesdeAsistente(id) {
    alternarAsistente(false);
    PAGINA.verTema?.(id);
  }

  function enviarMensaje() {
    const entrada = document.getElementById('texto-asistente');
    const texto = entrada.value.trim();
    if (!texto) return;
    entrada.value = '';
    agregarMensaje('l2-me', escapar(texto));
    responderAsistente(texto);
  }

  /* ===== Audio: dicta tu consulta con el micrófono (reconocimiento de voz del navegador) ===== */
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  let reconocimiento = null;
  let relojGrabacion = null;

  function alternarMicrofono() {
    if (reconocimiento) { reconocimiento.stop(); return; }
    if (!Reconocimiento) {
      agregarMensaje('l2-bot', 'Tu navegador no permite audio. Escribe tu consulta o usa Chrome');
      return;
    }
    const formulario = document.querySelector('.l2-form');
    const microfono = document.getElementById('microfono');
    const textoVivo = document.getElementById('grabando-texto');
    const tiempo = document.getElementById('grabando-tiempo');
    const inicio = Date.now();
    let transcripcion = '';

    reconocimiento = new Reconocimiento();
    reconocimiento.lang = 'es-SV';
    reconocimiento.interimResults = true;
    reconocimiento.onresult = e => {
      transcripcion = [...e.results].map(resultado => resultado[0].transcript).join(' ').trim();
      textoVivo.textContent = transcripcion || 'Escuchando…';
    };
    reconocimiento.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') agregarMensaje('l2-bot', 'Activa el micrófono en tu navegador o escribe tu consulta');
    };
    reconocimiento.onend = () => {
      const segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      clearInterval(relojGrabacion);
      reconocimiento = null;
      formulario.classList.remove('grabando');
      microfono.setAttribute('aria-pressed', 'false');
      microfono.setAttribute('aria-label', 'Enviar audio');
      textoVivo.textContent = 'Escuchando…';
      tiempo.textContent = '0:00';
      if (!transcripcion) return;
      agregarMensaje('l2-me l2-me-audio', `<span class="l2-audio-cab"><i class="ph ph-microphone" aria-hidden="true"></i>Audio · ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}</span>${escapar(transcripcion)}`);
      responderAsistente(transcripcion);
    };

    reconocimiento.start();
    formulario.classList.add('grabando');
    microfono.setAttribute('aria-pressed', 'true');
    microfono.setAttribute('aria-label', 'Detener y enviar audio');
    relojGrabacion = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      tiempo.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
  }

  /* ===== Inicio ===== */
  // Con un video u otro <dialog> abierto, Escape solo cierra ese diálogo y el chat sigue abierto
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) alternarAsistente(false); });

  // Los botones de los mensajes llaman a estas funciones desde su onclick
  Object.assign(window, {
    alternarAsistente, enviarMensaje, alternarMicrofono, paginarChat, volverPasoAnterior,
    verCategoria, verMasCategorias, verTema, elegirTramite, mostrarEnCatalogo, irDesdeAsistente, abrirTemaDesdeAsistente,
    agendarCita, elegirSede, elegirDia, otroDia, elegirHora, cambiarCita, confirmarCita,
    iniciarWhatsApp, respuestaNotificaciones, cambiarNumero, confirmarWhatsApp,
    cambiarNumeroWhatsApp, numeroWhatsAppCambiado, irAWhatsApp,
    llevarPorWhatsApp, verIdentidad, verPreguntas, verRespuesta
  });

  // Con sesión, al volver del login para agendar una cita (?cita=número) el chat se abre en ese paso
  const citaPedida = Number(new URLSearchParams(location.search).get('cita'));
  if (SESION && CITAS[citaPedida]) {
    history.replaceState(null, '', location.pathname);
    alternarAsistente(true);
    elegirTramite(citaPedida);
    agendarCita();
  }

  // Con sesión, al volver del login desde el botón de WhatsApp (?whatsapp): el chat se abre con "Cómo funciona por
  // WhatsApp" (lo pinta la página) y la miniatura del video, sin el saludo ni las categorías, y pregunta si el celular
  // es el correcto
  if (SESION && new URLSearchParams(location.search).has('whatsapp')) {
    history.replaceState(null, '', location.pathname);
    document.querySelectorAll('#mensajes > .l2-fila-bot:not(:has(#pasos-chat, #chat-video))').forEach(f => f.remove());
    alternarAsistente(true);
    confirmarNumeroWhatsApp();
  }
})();
