/* Asistente de Simple.sv: chat lateral que entiende lo que la persona necesita y, con sesión, HACE el trámite aquí
   mismo: identifica el trámite, usa los datos de la Identidad Digital, pide solo lo que falta (varias cosas en un
   mensaje), muestra un resumen para confirmar, cobra en la pasarela dentro del chat y entrega el comprobante.
   También agenda la cita, dice cómo van los trámites, responde dudas de costo, plazo y requisitos, y deriva a
   atención ciudadana. Sin sesión (landing), cuando hacen falta los datos de la cuenta lleva al login de Identidad
   Digital, que vuelve a la landing con sesión, y el chat sigue donde iba. El botón de WhatsApp de la landing también
   pasa por aquí (realizarPorWhatsApp): después del login va directo al chat de WhatsApp.
   Lo usan Indexlogin.html (con sesión) y la landing index.html (con o sin sesión, según sesion.js).
   Cada página define antes window.ASISTENTE_PAGINA = { sesion, verCategoria(id), verTema(id), verBusqueda(texto) }
   y su propio catálogo, del que se usan TRAMITES, CATEGORIAS, TEMAS, TEMA_DE, SINONIMOS, PALABRAS_VACIAS,
   normalizar, palabrasDeBusqueda, textoDeBusqueda, costoCorto y escapar (son iguales en las dos páginas).
   Piezas: interprete.js (la IA o, sin ella, el modo básico), motor-tramite.js (las reglas del formulario: la IA solo
   propone), integraciones.js (envío y pago, simulados en esta vista), metricas-asistente.js (clics, mensajes, etc.).
   Datos: formularios.js, citas.js, pasos-tramite.js y, con sesión, canales.js, ciudadano.js y mis-tramites.js.
   Estilos en asistente.css; el marcado del botón y del panel está en cada página. */
(() => {
  // Carpeta de este script (nuevoDiseño/): los enlaces del chat salen de aquí, así sirven igual desde la landing (en la raíz) que desde Indexlogin.html
  const APP = new URL('.', document.currentScript.src).href;
  const PAGINA = window.ASISTENTE_PAGINA || {};
  // En la landing depende de sesion.js: sin sesión, lo que necesita la cuenta lleva al login y al volver el chat sigue
  let SESION = Boolean(PAGINA.sesion);
  const FORMULARIOS = window.FORMULARIOS_TRAMITES || {};
  const ICONO_CATEGORIA = { empleo: 'ph-briefcase', documentos: 'ph-identification-card', vivienda: 'ph-house-line', estudio: 'ph-graduation-cap' };
  const {
    pasosDe, costoDe, horaLegible, horarioDe, horarioLargo, horarioCorto,
    capitalizar, fechaDe, isoDe, fechaLarga, fechaCorta, diasDisponibles, queLlevar, descargarCalendario
  } = window.PASOS_TRAMITE;
  const M = window.MOTOR_TRAMITE;
  const I = window.INTERPRETE;
  const X = window.INTEGRACIONES;
  const MET = window.METRICAS_ASISTENTE || { registrar() {}, nuevaSesion() {}, fijarTramite() {} };
  // Los datos de la cuenta (ciudadano.js) existen solo con sesión: en la landing se cargan al iniciarla
  const cuenta = () => window.CIUDADANO || {};

  // Solo enlaces http(s) del catálogo
  function urlSegura(url) {
    return /^https?:\/\//i.test(String(url || '')) ? url : '#';
  }

  // Sin sesión, hacer el trámite pide iniciar sesión; el login vuelve al destino pedido (?destino=…&n=…)
  const LOGIN = APP + 'login.html';
  const conSesion = (destino, numero) => `${LOGIN}?destino=${destino}${numero ? `&n=${numero}` : ''}`;

  let abiertoAntes = false;
  // sinFoco: abrir sin enfocar el campo de texto (apertura automática: en el celular saldría el teclado sin que nadie lo pidiera)
  function alternarAsistente(abrir, sinFoco = false) {
    const panel = document.getElementById('asistente');
    const fab = document.getElementById('fab');
    const teniaFoco = panel.contains(document.activeElement);
    panel.classList.toggle('open', abrir);
    fab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) {
      // El panel entra desde la derecha con una transición de 0.3 s. En Android, si el campo recibe el foco
      // mientras aún está fuera de pantalla, el teclado no se abre; por eso se enfoca de nuevo al terminar la transición.
      const campo = document.getElementById('texto-asistente');
      if (!sinFoco) {
        campo.focus({ preventScroll: true });
        setTimeout(() => { if (panel.classList.contains('open')) campo.focus({ preventScroll: true }); }, 320);
      }
      // La primera vez que se abre: empieza la conversación para las métricas y, si quedó un trámite a medias, se ofrece seguir
      if (!abiertoAntes) {
        abiertoAntes = true;
        MET.nuevaSesion('web');
        if (SESION && !conversacion.numero) ofrecerReanudar();
      }
    }
    else if (teniaFoco) fab.focus({ preventScroll: true });
  }

  const filasBot = caja => [...caja.children].filter(c => c.classList.contains('l2-fila-bot') && !c.classList.contains('l2-escribiendo'));

  function agregarMensaje(clase, html) {
    const caja = document.getElementById('mensajes');
    const div = document.createElement('div');
    div.className = clase;
    div.innerHTML = html;
    if (clase === 'l2-bot') {
      const fila = document.createElement('div');
      fila.className = 'l2-fila-bot';
      fila.innerHTML = '<img class="l2-avatar-bot" src="' + APP + '../src/assets/brand/simple-robot-asistente-sin-fondo-72.png" alt="" width="36" height="36">';
      fila.appendChild(div);
      caja.appendChild(fila);
      // Lo que el asistente dijo, en texto, para que la IA entienda respuestas cortas como "sí" o "en Santa Ana"
      const texto = div.cloneNode(true);
      texto.querySelectorAll('.l2-options, .l2-chat-pasos, .l2-chat-nota, .l2-campo-seguro').forEach(n => n.remove());
      I.recordar('asistente', texto.textContent);
    } else {
      caja.appendChild(div);
    }
    // Cada mensaje del asistente guarda cómo iba la conversación (para volver a ese punto) y el botón de volver pasa al último
    if (clase === 'l2-bot') caja.lastElementChild._conv = clonar(conversacion);
    actualizarVolver();
    caja.scrollTop = caja.scrollHeight;
    return div;
  }

  const clonar = valor => JSON.parse(JSON.stringify(valor));

  // "Escribiendo…" mientras la IA piensa; devuelve la función que lo quita
  function mostrarEscribiendo() {
    const caja = document.getElementById('mensajes');
    const fila = document.createElement('div');
    fila.className = 'l2-fila-bot l2-escribiendo';
    fila.innerHTML = '<img class="l2-avatar-bot" src="' + APP + '../src/assets/brand/simple-robot-asistente-sin-fondo-72.png" alt="" width="36" height="36"><div class="l2-bot"><span class="l2-puntos" aria-label="Escribiendo"><i></i><i></i><i></i></span></div>';
    caja.appendChild(fila);
    caja.scrollTop = caja.scrollHeight;
    return () => fila.remove();
  }

  /* Volver al paso anterior: el último mensaje del asistente lleva siempre un botón para deshacer el último paso.
     Quita lo que la persona eligió o escribió y la respuesta que recibió, y la conversación queda en el mensaje anterior.
     No aparece en el saludo inicial (todavía no hay ningún paso que deshacer). */
  function actualizarVolver() {
    const caja = document.getElementById('mensajes');
    caja.querySelectorAll('.l2-volver').forEach(b => b.remove());
    const ultimo = filasBot(caja).at(-1)?.querySelector('.l2-bot');
    if (!ultimo || !caja.querySelector(':scope > .l2-me')) return;
    // Una solicitud ya enviada no se deshace
    if (conversacion.fase === 'presentada') return;
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
    const anterior = filasBot(caja).at(-1);
    conversacion = anterior?._conv ? clonar(anterior._conv) : { numero: null };
    actualizarVolver();
    caja.scrollTop = caja.scrollHeight;
    // El foco queda en el primer botón del mensaje al que se volvió
    anterior?.querySelector('button:not(.l2-option-volver), a')?.focus({ preventScroll: true });
  }

  /* ===== Conversación =====
     conversacion: { numero } mientras solo se mira un trámite; al hacerlo aquí: { numero, estado (motor-tramite.js),
     fase: 'recopilando' | 'confirmando' | 'pagando' | 'presentada', preguntados, solicitud, pagoAprobado }.
     Sin sesión (landing) solo se orienta; WhatsApp, con sesión, avisa cuando el trámite finaliza (canales.js). */
  const nivelWA = numero => window.CANAL_WHATSAPP?.niveles?.[numero];
  const esJudicial = numero => (window.CANAL_WHATSAPP?.judiciales || []).includes(numero);
  const CITAS = window.CITAS_TRAMITES || {};
  // Los de uso más común según prompt-rediseno-simple-sv.md; reemplazar cuando haya estadísticas reales
  const MAS_SOLICITADOS = [99, 100, 73, 113, 64, 61, 53, 52];
  // Las listas del chat se paginan de 4 en 4; con más de 8 trámites también se ofrece verlos en el catálogo
  const POR_PAGINA_CHAT = 4;
  const EN_CHAT = 8;
  let conversacion = { numero: null };
  // Los archivos adjuntos solo viven en esta página: no se guardan en el navegador ni van a la IA
  const ARCHIVOS = new Map();
  const tramiteActual = () => TRAMITES.find(t => t.numero === conversacion.numero);
  const boton = (texto, accion, clase = '') => `<button type="button" class="l2-option ${clase}" onclick="${accion}">${texto}</button>`;
  const conIcono = (icono, texto) => `<i class="ph ${icono}" aria-hidden="true"></i>${texto}`;
  const enCurso = () => Boolean(conversacion.estado) && ['recopilando', 'confirmando', 'pagando'].includes(conversacion.fase);
  const sigla = t => t.institucion.replace(/.*\(([^)]+)\).*/, '$1');
  const vacio = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  const minuscula = texto => `${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
  // Los datos sensibles se muestran tapados en el chat: solo las últimas cifras
  const tapar = texto => (String(texto).length > 4 ? `•••• ${String(texto).slice(-4)}` : '••••');

  // Saludos, agradecimientos y despedidas se contestan con cortesía; lo demás fuera de tema recuerda para qué sirve
  const SALUDOS = ['hola', 'ola', 'hey', 'saludos', 'buen', 'buenas', 'buenos', 'dia', 'dias', 'tarde', 'tardes', 'noche', 'noches', 'que', 'tal', 'como', 'estas', 'esta', 'usted', 'tu'];
  const DESPEDIDAS = ['adios', 'chao', 'chau', 'bye', 'hasta', 'luego', 'pronto', 'manana', 'nos', 'vemos'];
  const palabrasDelMensaje = texto => normalizar(texto).split(/[^a-z0-9ñ]+/).filter(Boolean).map(p => p.replace(/(.)\1{2,}/g, '$1'));
  function tipoDeSaludo(texto) {
    const palabras = palabrasDelMensaje(texto);
    if (palabras.length && palabras.every(p => SALUDOS.includes(p))) return 'saludo';
    if (palabras.length && palabras.every(p => DESPEDIDAS.includes(p))) return 'despedida';
    return 'gracias';
  }

  // Mensajes cortos: amables, pero al grano (a la persona no le gusta leer mucho de una vez)
  const RESPUESTAS = {
    saludo: { texto: `¡Hola! Dime qué necesitas y lo hacemos aquí mismo. Por ejemplo: <strong>antecedentes penales para un empleo</strong>`, categorias: true },
    gracias: { texto: '¡Con gusto! ¿Necesitas otro trámite?' },
    despedida: { texto: '¡Hasta pronto!' },
    sinSentido: { texto: 'No te entendí. Escribe tu trámite, por ejemplo <strong>partida de nacimiento</strong>', categorias: true },
    fueraDeTema: { texto: 'Solo puedo ayudarte con trámites de Simple.sv. ¿Cuál buscas?', categorias: true }
  };

  function responderSinBuscar(tipo) {
    const { texto, categorias } = RESPUESTAS[tipo];
    // Con un trámite a medias no se vuelven a ofrecer categorías: se recuerda lo que falta
    const seguir = enCurso() ? `<p class="l2-chat-nota">Tu solicitud de ${escapar(tramiteActual().nombre)} sigue aquí.</p>` : '';
    agregarMensaje('l2-bot', `${texto}${categorias && !enCurso() ? `<div class="l2-options l2-options-grid">${botonesCategorias()}</div>` : ''}${seguir}`);
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

  // Categorías del chat: las pestañas del catálogo (Judiciales, DUI y partidas, Agua y hogar, Educación y títulos)
  function botonesCategorias() {
    return Object.entries(CATEGORIAS).map(([id, nombre]) => boton(conIcono(ICONO_CATEGORIA[id], nombre), `verCategoria('${id}')`)).join('');
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

  /* ===== Lo que la persona escribe =====
     interprete.js lo convierte en intención, trámite y datos (con IA o, sin ella, en modo básico). Los datos pasan por
     motor-tramite.js antes de aceptarse; nada se envía ni se paga sin un clic de la persona. */
  let avisoModoBasico = false;
  let cola = Promise.resolve();
  // Los mensajes se atienden en orden, aunque la persona escriba otro mientras la IA responde el anterior
  const responderAsistente = texto => { cola = cola.then(() => atender(texto)).catch(() => agregarMensaje('l2-bot', 'Algo falló de mi lado. Intenta de nuevo')); return cola; };

  async function atender(texto) {
    // Sin sesión: dudas sobre la Identidad Digital y preguntas frecuentes, antes de buscar trámites
    if (!SESION && !enCurso()) {
      const frase = ` ${palabrasDelMensaje(texto).join(' ')} `;
      if (CLAVES_IDENTIDAD.some(c => frase.includes(` ${c} `))) { verIdentidad(''); return; }
      const pregunta = PREGUNTAS.findIndex(p => p.claves.some(c => frase.includes(` ${c} `)));
      if (pregunta >= 0) { verRespuesta(pregunta, false); return; }
    }
    // Respuestas a "¿Es a tu nombre?" y el nombre completo: se entienden aquí, sin la IA
    if (enCurso() && conversacion.fase === 'recopilando') {
      const siNo = /^(s[ií]|s[ií],? es (m[ií]a|a mi nombre|mio|mío)|es m[ií]a)[\s.!]*$/i.test(texto) ? true : /^no\b/i.test(texto) ? false : null;
      if (conversacion.preguntandoSiEsSuyo && siNo !== null) { responderSiEsSuyo(siNo, false); return; }
      if (conversacion.esperaNombre !== undefined && recibirNombre(texto)) return;
    }
    const quitarEscribiendo = mostrarEscribiendo();
    const r = await I.interpretar(texto, { canal: 'web', sesion: SESION, estado: enCurso() ? conversacion.estado : null, fase: conversacion.fase || '', buscar: buscarTramites });
    quitarEscribiendo();
    MET.registrar('modo', { modo: r.modo === 'ia' ? 'ia' : 'basico' });
    if (r.latencia) MET.registrar('respuesta', { latencia: r.latencia });
    const notaBasico = r.modo !== 'ia' && !avisoModoBasico && r.intencion !== 'bloqueado';
    if (notaBasico) avisoModoBasico = true;

    switch (r.intencion) {
      case 'bloqueado':
        agregarMensaje('l2-bot', r.motivo === 'tarjeta'
          ? 'Por tu seguridad no envié ese mensaje: parece un número de tarjeta. Nunca la escribas en el chat; se paga en la pasarela segura'
          : 'Por tu seguridad no envié ese mensaje. No compartas tu contraseña ni códigos de verificación, ni siquiera conmigo');
        return;
      case 'saludo': responderSinBuscar(tipoDeSaludo(texto)); return;
      case 'sin_sentido': responderSinBuscar('sinSentido'); return;
      case 'fuera_de_ambito':
        if (enCurso() && !r.respuesta) { recordarPendientes('No te entendí.'); return; }
        responderSinBuscar('fueraDeTema');
        return;
      case 'pedir_humano': derivar(); return;
      case 'consultar_estado': mostrarEstado(); return;
      case 'cancelar': if (enCurso()) { cancelarSolicitud(); return; } break;
      case 'confirmar': if (conversacion.fase === 'confirmando') { confirmarSolicitud(false); return; } break;
      case 'pregunta': responderPregunta(r, notaBasico); return;
      default: break;
    }

    // Otro trámite (o el primero): primero se pregunta cómo hacerlo; lo que ya dijo se usa aquí en el chat, en WhatsApp
    // (el borrador) o al volver del login
    if (r.tramite && !(enCurso() && r.tramite === conversacion.numero)) {
      if (enCurso()) agregarMensaje('l2-bot', `Dejo pendiente tu solicitud de <strong>${escapar(tramiteActual().nombre)}</strong>; no se envió nada`);
      const t = TRAMITES.find(x => x.numero === r.tramite);
      if (!t) return;
      MET.fijarTramite(r.tramite);
      conversacion = { numero: r.tramite, datosDichos: r.datos || [] };
      if (FORMULARIOS[r.tramite] && r.datos?.length) guardarBorrador(r.tramite, r.datos);
      mensajeTramite(t, false, notaBasico);
      return;
    }
    // Datos o correcciones para el trámite en curso
    if (enCurso()) {
      if (conversacion.fase === 'pagando') { agregarMensaje('l2-bot', 'Termina o cancela el pago en la ventana de pago para seguir'); return; }
      const resultado = M.aplicarDatos(conversacion.estado, r.datos);
      if (resultado.aceptados.length || resultado.rechazados.length) { avanzar({ ...resultado, notaBasico }); return; }
      recordarPendientes('No te entendí.');
      return;
    }
    // Varios posibles: la persona elige
    const candidatos = (r.candidatos || []).map(n => TRAMITES.find(t => t.numero === n)).filter(Boolean);
    if (candidatos.length) {
      agregarMensaje('l2-bot', `¿Cuál de estos necesitas?${listaDeTramites(candidatos.slice(0, 3))}${notaModoBasico(notaBasico)}`);
      return;
    }
    const coincidencias = buscarTramites(texto);
    if (!coincidencias.length) {
      agregarMensaje('l2-bot', `No lo encontré. Prueba con otras palabras o elige una opción
        <div class="l2-options l2-options-grid">${botonesCategorias()}</div>${notaModoBasico(notaBasico)}`);
      return;
    }
    const verTodos = coincidencias.length > 3
      ? `<div class="l2-options"><button class="l2-option" onclick="mostrarEnCatalogo(this.dataset.q)" data-q="${escapar(texto)}">Ver los ${coincidencias.length} en la lista</button></div>`
      : '';
    agregarMensaje('l2-bot', `${coincidencias.length === 1 ? 'Encontré este trámite' : '¿Cuál de estos buscas?'}${listaDeTramites(coincidencias.slice(0, 3))}${verTodos}${notaModoBasico(notaBasico)}`);
  }

  const notaModoBasico = mostrar => (mostrar ? '<p class="l2-chat-nota l2-modo-basico"><i class="ph ph-info" aria-hidden="true"></i>Estoy en modo básico: escribe una cosa a la vez, con palabras sencillas</p>' : '');

  // Dudas de costo, plazo o requisitos: la respuesta sale del catálogo o de la ficha (nunca se inventa)
  function responderPregunta(r, notaBasico) {
    const t = TRAMITES.find(x => x.numero === (r.tramite || conversacion.numero));
    const respuesta = r.respuesta || (t ? I.responderPregunta(t.numero, normalizar('cuanto cuesta y cuanto tarda')) : '');
    const fuente = r.fuente === 'ficha' || r.fuente === 'catalogo' ? '<p class="l2-chat-nota"><i class="ph ph-seal-check" aria-hidden="true"></i>Según la ficha oficial del trámite</p>' : '';
    let siguiente = '';
    if (enCurso()) siguiente = conversacion.fase === 'confirmando'
      ? `<div class="l2-options">${boton(conIcono('ph-check', 'Seguir con mi solicitud'), 'verSolicitud()')}</div>`
      : `<p class="l2-chat-nota">Cuando quieras seguimos con tu solicitud: ${escapar(listaDeEtiquetas(conversacion.preguntados))}</p>`;
    else if (t && FORMULARIOS[t.numero]) siguiente = `<div class="l2-options">${boton(conIcono('ph-lightning', 'Hacerlo aquí'), `hacerTramite(${t.numero})`, 'l2-option-principal')}</div>`;
    else if (t) siguiente = `<div class="l2-options">${enlaceFormulario(t)}</div>`;
    agregarMensaje('l2-bot', `${escapar(respuesta || 'No tengo ese dato en la ficha oficial. Escríbenos a contacto@simple.sv')}${fuente}${siguiente}${notaModoBasico(notaBasico)}`);
  }

  // iniciar: el formulario como botón principal, "Iniciar trámite" (opcionesDe); si no, "Prefiero el formulario"
  function enlaceFormulario(t, iniciar = false) {
    const etiqueta = iniciar ? 'Iniciar trámite' : 'Prefiero el formulario';
    const clase = iniciar ? 'l2-option l2-option-principal' : 'l2-option';
    // Los trámites del flujo corto (flujo-corto.js) se llenan sin sesión: se pide al pasar al pago
    const directo = Boolean(window.FLUJO_CORTO?.aplica(t.numero));
    if (FORMULARIOS[t.numero] && !SESION && !directo) {
      return `<a class="${clase}" href="${conSesion('tramite', t.numero)}"><i class="ph ph-arrow-right" aria-hidden="true"></i>${etiqueta}</a>`;
    }
    if (FORMULARIOS[t.numero]) {
      const icono = FORMULARIOS[t.numero].icono || ICONO_CATEGORIA[t.categoria] || 'ph-file-text';
      return `<a class="${clase}" href="${APP}tramite.html?n=${t.numero}" data-transicion="${escapar(t.nombre)}" data-transicion-icono="${icono}" data-transicion-rapida><i class="ph ph-arrow-right" aria-hidden="true"></i>${etiqueta}</a>`;
    }
    return `<a class="l2-option l2-option-principal" href="${escapar(urlSegura(t.enlace_tramite))}" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-square-out" aria-hidden="true"></i>Ir al portal de la institución</a>`;
  }

  /* Pasos a seguir de cada trámite (pasos-tramite.js), en un desplegable con el diseño de "Cómo funciona":
     cerrado al ver el trámite, abierto si la persona los pide. */
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

  // Cómo hacer el trámite. Con formulario hay dos caminos: "Iniciar trámite" (el formulario) y "Hacerlo por WhatsApp". Sin formulario: el portal de la institución. Sin sesión, lo que se haga aquí pide iniciar
  // sesión y vuelve al mismo punto
  function opcionesDe(t) {
    if (!FORMULARIOS[t.numero]) {
      return `<div class="l2-options">${enlaceFormulario(t)}</div>
        <p class="l2-chat-nota">Este trámite se hace en el portal de la institución; se abre en una pestaña nueva</p>`;
    }
    const iniciar = enlaceFormulario(t, true);
    // WhatsApp lleva una etiqueta en la esquina: es una propuesta nueva
    const whatsapp = boton(`${conIcono('ph-whatsapp-logo', 'Hacerlo por WhatsApp')}<span class="l2-etiqueta-propuesta">Propuesta nueva</span>`, 'llevarPorWhatsApp()', 'l2-option-wa l2-option-con-etiqueta');
    // Sin sesión, una sola nota al final: lo que hace falta para iniciar
    const nota = SESION ? ''
      : '<p class="l2-chat-nota">Necesitas tu Identidad Digital. <button type="button" class="l2-chat-enlace" onclick="verIdentidad()">¿No la tienes?</button></p>';
    return `<div class="l2-options l2-options-separadas">${iniciar}${whatsapp}</div>${nota}`;
  }

  function mensajeTramite(t, verPasos, notaBasico = false) {
    agregarMensaje('l2-bot', `${verPasos ? 'Estos son los pasos para' : 'Perfecto:'} <strong>${escapar(t.nombre)}</strong>${pasosDesplegables(t, verPasos)}
      ${opcionesDe(t)}${notaModoBasico(notaBasico)}`);
  }

  // verPasos: los pasos se muestran abiertos; eco: repite como mensaje de la persona el trámite que eligió.
  // Antes de empezar, siempre se pregunta cómo hacerlo: aquí en el chat, por WhatsApp o en el formulario
  function elegirTramite(numero, verPasos = false, eco = true) {
    const t = TRAMITES.find(x => x.numero === numero);
    if (eco) agregarMensaje('l2-me', escapar(t.nombre));
    conversacion = { numero };
    MET.fijarTramite(numero);
    mensajeTramite(t, verPasos);
  }

  /* ===== Identidad: el login de Identidad Digital =====
     Sin sesión (landing), lo que necesita los datos de la cuenta (hacer el trámite, agendar, llevarlo a WhatsApp) pide
     confirmar la identidad: lleva al login (?destino=inicio), que marca la sesión (sesion.js) y vuelve a la landing.
     Allí el chat se abre solo y sigue con lo que se iba a hacer, guardado en este navegador mientras tanto.
     WhatsApp no vuelve: el login (?destino=whatsapp) abre de una vez su chat con el "Hola" ya enviado */
  let pendienteDeSesion = null;   // lo que se hace al iniciar sesión: { tipo: 'tramite' | 'whatsapp' | 'ninguno', numero, datos }
  let destinoWhatsApp = null;     // el trámite que se lleva a WhatsApp (null: WhatsApp pregunta cuál)
  const CLAVE_PENDIENTE = 'simple-asistente-pendiente';
  const VIGENCIA_PENDIENTE = 30 * 60 * 1000;

  // Pide confirmar la identidad con un botón; con abrirYa (la persona ya tocó algo que la necesita), lleva al login de una vez.
  // datos: lo que ya dijo, para seguir con eso al volver (si no se dan, se conserva lo guardado)
  // conWhatsApp: también ofrece hacerlo por WhatsApp, que sigue con lo mismo
  function pedirIdentidad(accion, texto, { abrirYa = false, extra = '', conWhatsApp = false } = {}) {
    pendienteDeSesion = accion;
    if (accion.numero && accion.datos) guardarBorrador(accion.numero, accion.datos);
    const whatsapp = conWhatsApp ? boton(conIcono('ph-whatsapp-logo', 'Hacerlo por WhatsApp'), 'llevarPorWhatsApp()', 'l2-option-wa') : '';
    agregarMensaje('l2-bot', `${texto}
      <div class="l2-options">${boton(conIcono('ph-identification-card', 'Continuar con mi Identidad Digital'), 'abrirLogin()', 'l2-option-principal')}${whatsapp}${boton('No tengo Identidad Digital', "verIdentidad('No tengo Identidad Digital')")}</div>
      <p class="l2-chat-nota"><i class="ph ph-lock-simple" aria-hidden="true"></i>Te llevamos a iniciar sesión y vuelves aquí para seguir. Nunca escribas tu contraseña en el chat</p>${extra}`);
    if (abrirYa) abrirLogin();
  }

  // WhatsApp no vuelve a la landing: el login abre de una vez su chat con el "Hola" ya enviado
  function abrirLogin() {
    if (SESION) return;
    if (pendienteDeSesion?.tipo === 'whatsapp') { location.href = conSesion('whatsapp', FORMULARIOS[pendienteDeSesion.numero] ? pendienteDeSesion.numero : null); return; }
    try { localStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...(pendienteDeSesion || { tipo: 'ninguno' }), guardado: Date.now() })); } catch { /* sin almacenamiento */ }
    // El número del trámite viaja en la URL: la landing reabre el chat con ese trámite aunque el almacenamiento falle
    const tramite = pendienteDeSesion?.tipo === 'tramite' && FORMULARIOS[pendienteDeSesion.numero] ? pendienteDeSesion.numero : null;
    location.href = conSesion('inicio', tramite);
  }

  // Lo que quedó pendiente al ir al login: se usa una sola vez
  function tomarPendiente() {
    try {
      const pendiente = JSON.parse(localStorage.getItem(CLAVE_PENDIENTE));
      localStorage.removeItem(CLAVE_PENDIENTE);
      return pendiente && Date.now() - pendiente.guardado < VIGENCIA_PENDIENTE ? pendiente : null;
    } catch { return null; }
  }

  // Los datos de la cuenta y sus trámites llegan con la sesión (en la maqueta, ciudadano.js y mis-tramites.js), una sola vez
  const cargarScript = src => new Promise(listo => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = script.onerror = listo;
    document.head.append(script);
  });
  let cargaDeSesion = null;
  function cargarSesion() {
    cargaDeSesion = cargaDeSesion || (async () => {
      if (!window.CIUDADANO) await cargarScript(APP + 'ciudadano.js');
      if (!window.MIS_TRAMITES) await cargarScript(APP + 'mis-tramites.js');
      if (!window.CANAL_WHATSAPP) await cargarScript(APP + 'canales.js');
    })();
    return cargaDeSesion;
  }

  // De vuelta del login con sesión: el chat se abre y sigue con lo que se iba a hacer
  async function seguirConSesion(accion) {
    await cargarSesion();
    abiertoAntes = true;
    MET.nuevaSesion('web');
    alternarAsistente(true);
    MET.registrar('sesion');
    const nombre = (cuenta().nombres || '').split(' ')[0];
    agregarMensaje('l2-bot', `¡Listo${nombre ? `, ${escapar(nombre)}` : ''}! Ya confirmamos tu identidad`);
    if (accion.tipo === 'whatsapp') { destinoWhatsApp = Number(accion.numero) || null; confirmarNumeroWhatsApp(); return; }
    if (accion.numero) {
      const borrador = leerBorrador();
      iniciarTramite(accion.numero, borrador?.numero === accion.numero ? borrador.datos : accion.datos || []);
      return;
    }
    agregarMensaje('l2-bot', `¿Qué trámite hacemos? Escríbelo o elige
      <div class="l2-options l2-options-grid">${botonesCategorias()}</div>`);
  }

  /* ===== El trámite en el chat ===== */
  // Botón "Hacerlo aquí": sin sesión, primero se confirma la identidad (en el login, y se vuelve aquí)
  function hacerTramite(numero) {
    agregarMensaje('l2-me', 'Hacerlo aquí en el chat');
    if (!SESION) {
      conversacion = { numero };
      pedirIdentidad({ tipo: 'tramite', numero, datos: leerBorrador()?.numero === numero ? undefined : [] }, 'Para usar tus datos de forma segura, confirma tu identidad', { abrirYa: true });
      return;
    }
    iniciarTramite(numero, conversacion.numero === numero ? conversacion.datosDichos || [] : []);
  }

  function iniciarTramite(numero, datos = [], { notaBasico = false } = {}) {
    const t = TRAMITES.find(x => x.numero === numero);
    if (!t) return;
    if (conversacion.fase === 'presentada') MET.nuevaSesion('web');
    MET.fijarTramite(numero);
    // Sin formulario en el nuevo diseño, se hace en el portal de la institución
    if (!FORMULARIOS[numero]) {
      conversacion = { numero };
      mensajeTramite(t, false);
      return;
    }
    // Sin sesión: lo que dijo queda guardado y, al volver del login, se sigue con eso
    if (!SESION) {
      conversacion = { numero };
      pedirIdentidad({ tipo: 'tramite', numero, datos },
        `Puedo hacer tu <strong>${escapar(t.nombre)}</strong> aquí mismo. ${escapar(costoDe(t).resumen.replace(/,$/, ''))}${t.tiempo ? ` y tarda ${escapar(minuscula(t.tiempo))}` : ''}.
        Para usar tus datos de forma segura, confirma tu identidad; después solo revisas y confirmas`,
        { extra: `${pasosDesplegables(t, false)}${notaModoBasico(notaBasico)}`, conWhatsApp: true });
      return;
    }
    const estado = M.crear(numero, cuenta());
    const resultado = M.aplicarDatos(estado, datos);
    conversacion = { numero, estado, fase: 'recopilando', preguntados: [], yaPreguntados: [] };
    const deCuenta = M.resumen(estado).cuenta.length;
    avanzar({ ...resultado, intro: `Perfecto: <strong>${escapar(t.nombre)}</strong>.${deCuenta ? ' Ya tengo tus datos de la Identidad Digital.' : ''}`, notaBasico });
  }

  /* Siguiente paso: la sede si es con cita, lo que falte (varias cosas en un mensaje) o el resumen para confirmar.
     rechazados: datos que no se pudieron usar, con su motivo. */
  function avanzar({ intro = '', rechazados = [], notaBasico = false } = {}) {
    const { estado } = conversacion;
    const avisos = rechazados.map(r => `<li><strong>${escapar(r.etiqueta)}:</strong> ${escapar(r.error)}</li>`).join('');
    const encabezado = `${intro}${avisos ? `<ul class="l2-chat-avisos">${avisos}</ul>` : ''}`;
    conversacion.fase = 'recopilando';
    if (M.modoCita(estado)) {
      const sede = M.campoConOrigen(estado, 'sedes');
      if (vacio(estado.respuestas[sede.nombre]?.valor)) { preguntarSede(encabezado, notaBasico); return; }
      const dia = M.campoConOrigen(estado, 'dias');
      const hora = M.campoConOrigen(estado, 'horas');
      if (vacio(estado.respuestas[dia?.nombre]?.valor) || vacio(estado.respuestas[hora?.nombre]?.valor)) M.proponerHorario(estado);
    }
    conversacion.esperaNombre = undefined;
    conversacion.opcionesNombre = null;
    conversacion.preguntandoSiEsSuyo = false;
    // Un nombre que puede ser el de la Identidad Digital (la persona inscrita en la partida): primero, si es suyo
    const suyo = M.preguntarSiEsSuyo(estado, cuenta());
    if (suyo) { preguntarSiEsSuyo(suyo, encabezado, notaBasico); return; }
    // Lo que puede ser de quien inició sesión espera a lo que lo decide (el tipo de partida). Un nombre se pide solo y
    // completo, en un mensaje, cuando le toca
    const faltan = M.pendientes(estado).filter(c => !c.origen && !M.esperaCondicion(estado, c));
    const primerNombre = faltan.findIndex(c => M.prefijoDeNombre(c.nombre) !== null);
    if (primerNombre === 0) { preguntarNombre(M.prefijoDeNombre(faltan[0].nombre), encabezado, notaBasico); return; }
    if (faltan.length) { preguntarDatos(primerNombre > 0 ? faltan.slice(0, primerNombre) : faltan, encabezado, notaBasico); return; }
    mostrarSolicitud(encabezado, notaBasico);
  }

  /* ----- Nombres: en un solo mensaje, no parte por parte ----- */
  const PREGUNTA_NOMBRE = () => (FORMULARIOS[conversacion.numero].preguntaNombre || '¿Es a tu nombre?').replace(/\?$/, '');

  function preguntarSiEsSuyo(suyo, encabezado, notaBasico) {
    conversacion.preguntandoSiEsSuyo = true;
    conversacion.preguntados = [];
    agregarMensaje('l2-bot', `${encabezado ? `${encabezado} ` : ''}${escapar(PREGUNTA_NOMBRE())}, <strong>${escapar(suyo.nombre)}</strong>?
      <p class="l2-chat-nota">Es el nombre de tu Identidad Digital</p>
      <div class="l2-options l2-options-grid">${boton(conIcono('ph-user-check', 'Sí, es a mi nombre'), 'responderSiEsSuyo(true)')}${boton(conIcono('ph-users', 'No, es de otra persona'), 'responderSiEsSuyo(false)')}</div>
      ${progreso('datos')}${notaModoBasico(notaBasico)}`);
    guardarBorradorActual();
  }

  // Si es suyo, su nombre, su DUI y su fecha salen de la cuenta; si no, el nombre se pide completo
  function responderSiEsSuyo(esSuyo, eco = true) {
    if (!enCurso() || !conversacion.preguntandoSiEsSuyo) return;
    conversacion.preguntandoSiEsSuyo = false;
    if (eco) agregarMensaje('l2-me', esSuyo ? 'Sí, es a mi nombre' : 'No, es de otra persona');
    M.responderSiEsSuyo(conversacion.estado, esSuyo, cuenta());
    avanzar();
  }

  function preguntarNombre(prefijo, encabezado, notaBasico) {
    conversacion.esperaNombre = prefijo;
    conversacion.preguntados = M.camposDeNombre(conversacion.estado, prefijo).filter(c => !c.opcional).map(c => c.nombre);
    agregarMensaje('l2-bot', `${encabezado ? `${encabezado} ` : ''}Solo me falta esto:
      <ul class="l2-chat-campos"><li class="l2-campo-chat"><strong>Nombre completo</strong><small>Nombres y apellidos, como aparecen en el documento</small></li></ul>
      <p class="l2-chat-nota">Escríbelo abajo en un solo mensaje, por ejemplo «Juan Carlos Pérez Gómez»</p>
      ${progreso('datos')}${notaModoBasico(notaBasico)}`);
    document.getElementById('texto-asistente').placeholder = 'Escribe el nombre completo';
    guardarBorradorActual();
  }

  /* El nombre escrito se reparte aquí (sin la IA). Con 3 palabras se pregunta cuáles son los apellidos. Devuelve false
     si lo escrito no parece un nombre ("no lo sé", una pregunta): entonces lo atiende el intérprete */
  function recibirNombre(texto) {
    const prefijo = conversacion.esperaNombre;
    const conCasada = M.camposDeNombre(conversacion.estado, prefijo).some(c => c.nombre.endsWith('apellido_de_casada'));
    const { opciones, error, noEsNombre } = M.partirNombre(texto, { conCasada });
    if (noEsNombre) return false;
    if (error) { agregarMensaje('l2-bot', escapar(error)); return true; }
    if (opciones.length === 1) { ponerNombre(opciones[0]); return true; }
    conversacion.opcionesNombre = opciones;
    agregarMensaje('l2-bot', `¿Cuáles son los apellidos?
      <div class="l2-options l2-options-grid">${opciones.map((o, i) => boton(escapar(o.apellidos), `elegirApellidos(${i})`)).join('')}</div>`);
    return true;
  }

  function elegirApellidos(i) {
    const opcion = conversacion.opcionesNombre?.[i];
    if (!enCurso() || !opcion) return;
    agregarMensaje('l2-me', escapar(opcion.apellidos));
    ponerNombre(opcion);
  }

  function ponerNombre(opcion) {
    const error = M.ponerNombre(conversacion.estado, conversacion.esperaNombre, opcion.partes);
    if (error) { agregarMensaje('l2-bot', escapar(error)); return; }
    avanzar({ intro: `Anoté ${escapar(M.anotadoComo(opcion)).replace(/\*([^*]+)\*/g, '<strong>$1</strong>')}.` });
  }

  const listaDeEtiquetas = nombres => (nombres || []).map(n => M.campoDe(conversacion.estado, n)?.etiqueta || n).join(', ');
  const SENSIBLE = /dui|documento|pasaporte|carnet|nie|nit|nrc|cuenta|identidad/i;
  const esSensible = c => c.tipo === 'texto' && SENSIBLE.test(c.nombre);

  /* Lo que falta, en un solo mensaje: hasta 3 cosas (en modo básico, una). Opciones como botones (o una lista si son
     muchas), archivos con el clip y datos sensibles en un campo seguro dentro del mensaje; lo demás se escribe abajo,
     todo junto o por partes. */
  function preguntarDatos(faltan, encabezado, notaBasico) {
    const basico = I.modo() === 'basico';
    const grupo = faltan.slice(0, basico ? 1 : 3);
    const { estado } = conversacion;
    const repetidos = grupo.filter(c => conversacion.yaPreguntados.includes(c.nombre));
    if (repetidos.length) MET.registrar('repetido', { cuantos: repetidos.length });
    conversacion.preguntados = grupo.map(c => c.nombre);
    conversacion.yaPreguntados = [...new Set([...conversacion.yaPreguntados, ...conversacion.preguntados])];
    MET.registrar('pregunta', { cuantos: grupo.length });
    const escritos = grupo.filter(c => c.tipo === 'texto' && !esSensible(c));
    const campos = grupo.map(c => {
      const ayuda = c.ayuda ? `<small>${escapar(c.ayuda)}</small>` : '';
      let control = '';
      if (c.tipo === 'opciones' || c.tipo === 'lista') {
        const opciones = M.opcionesDe(estado, c);
        control = opciones.length <= 8
          ? `<div class="l2-options l2-options-grid">${opciones.map(o => `<button type="button" class="l2-option" onclick="elegirOpcion('${c.nombre}', this.dataset.valor)" data-valor="${escapar(o.valor)}">${escapar(o.texto)}</button>`).join('')}</div>`
          : `<label class="l2-sr" for="lista-${c.nombre}">${escapar(c.etiqueta)}</label>
             <select class="l2-chat-select" id="lista-${c.nombre}" onchange="elegirOpcion('${c.nombre}', this.value)"><option value="">Elige o escríbelo abajo</option>${opciones.map(o => `<option value="${escapar(o.valor)}">${escapar(o.texto)}</option>`).join('')}</select>`;
      } else if (c.tipo === 'archivo') {
        control = `<div class="l2-options">${boton(conIcono('ph-paperclip', `Adjuntar ${escapar(minuscula(c.etiqueta))}`), `adjuntarArchivo('${c.nombre}')`)}</div>`;
      } else if (esSensible(c)) {
        control = `<form class="l2-campo-seguro" onsubmit="event.preventDefault(); guardarSeguro('${c.nombre}', this)">
            <label class="l2-sr" for="seguro-${c.nombre}">${escapar(c.etiqueta)}</label>
            <input id="seguro-${c.nombre}" name="valor" autocomplete="off" inputmode="${c.modo === 'numeric' ? 'numeric' : 'text'}" placeholder="${escapar(c.placeholder || 'Escríbelo aquí')}">
            <button type="submit" class="l2-option l2-option-principal" aria-label="Guardar ${escapar(c.etiqueta)}"><i class="ph ph-lock-simple" aria-hidden="true"></i></button>
            <span class="l2-campo-error" role="alert"></span>
          </form>`;
      }
      return `<li class="l2-campo-chat"><strong>${escapar(c.etiqueta)}</strong>${ayuda}${control}</li>`;
    }).join('');
    const conBotones = grupo.some(c => c.tipo === 'opciones' || c.tipo === 'lista');
    const como = !escritos.length ? ''
      : basico ? 'Escríbelo abajo'
      : conBotones ? 'Toca una opción y escribe lo demás abajo, o escríbelo todo en un mensaje'
      : escritos.length > 1 ? 'Escríbelo abajo en un solo mensaje, como te salga' : 'Escríbelo abajo';
    agregarMensaje('l2-bot', `${encabezado ? `${encabezado} ` : ''}${grupo.length === 1 ? 'Solo me falta esto:' : 'Me falta esto:'}
      <ul class="l2-chat-campos">${campos}</ul>
      ${como ? `<p class="l2-chat-nota">${como}${grupo.some(esSensible) ? '. Los datos del candado van en su propio campo y no se guardan en el chat' : ''}</p>` : ''}
      ${progreso('datos')}${notaModoBasico(notaBasico)}`);
    const primero = escritos[0];
    const entrada = document.getElementById('texto-asistente');
    entrada.placeholder = primero ? (primero.placeholder || `Escribe: ${minuscula(primero.etiqueta)}`) : 'Escribe tu duda aquí';
    guardarBorradorActual();
  }

  // Recordatorio corto de lo que falta (cuando lo escrito no sirvió)
  function recordarPendientes(inicio) {
    if (conversacion.fase === 'confirmando') {
      agregarMensaje('l2-bot', `${inicio} Tu solicitud está lista para confirmar
        <div class="l2-options">${boton(conIcono('ph-check', 'Ver mi solicitud'), 'verSolicitud()')}</div>`);
      return;
    }
    if (conversacion.preguntandoSiEsSuyo) { agregarMensaje('l2-bot', `${inicio} Para seguir dime si es a tu nombre: responde sí o no`); return; }
    const faltan = M.pendientes(conversacion.estado).filter(c => !c.origen).slice(0, 3);
    agregarMensaje('l2-bot', `${inicio} Para seguir necesito: <strong>${escapar(faltan.map(c => c.etiqueta).join(', ') || 'tu confirmación')}</strong>`);
  }

  function elegirOpcion(nombre, valor) {
    if (!enCurso() || conversacion.fase === 'pagando' || vacio(valor)) return;
    const c = M.campoVisible(conversacion.estado, nombre);
    if (!c) return;
    const opcion = M.opcionesDe(conversacion.estado, c).find(o => o.valor === valor);
    agregarMensaje('l2-me', escapar(opcion?.texto || valor));
    avanzar(M.aplicarDatos(conversacion.estado, [{ campo: nombre, valor }]));
  }

  // Dato sensible escrito en su campo seguro: se valida aquí, no pasa por la IA y en el chat queda tapado
  function guardarSeguro(nombre, formulario) {
    if (!enCurso()) return;
    const valor = formulario.valor.value.trim();
    const { rechazados } = M.aplicarDatos(conversacion.estado, [{ campo: nombre, valor }]);
    const error = rechazados[0]?.error || (vacio(conversacion.estado.respuestas[nombre]?.valor) ? 'Escribe el dato para seguir' : '');
    if (error) {
      formulario.querySelector('.l2-campo-error').textContent = error;
      formulario.valor.setAttribute('aria-invalid', 'true');
      formulario.valor.focus();
      return;
    }
    formulario.outerHTML = `<p class="l2-campo-listo"><i class="ph ph-lock-simple" aria-hidden="true"></i>Guardado: ${escapar(tapar(valor))}</p>`;
    agregarMensaje('l2-me', escapar(tapar(valor)));
    avanzar();
  }

  // Archivos: JPG, PNG o PDF de hasta 5 MB (el límite de SIMPLE); se quedan en esta página
  const MAX_ARCHIVO = 5 * 1024 * 1024;
  function adjuntarArchivo(nombre) {
    if (!enCurso()) return;
    const c = M.campoVisible(conversacion.estado, nombre);
    if (!c) return;
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = c.acepta || '.jpg,.jpeg,.png,.pdf';
    entrada.addEventListener('change', () => {
      const archivo = entrada.files[0];
      if (!archivo) return;
      const extension = archivo.name.split('.').pop().toLowerCase();
      if (!entrada.accept.split(',').some(a => a.replace('.', '') === extension)) {
        agregarMensaje('l2-bot', `Ese archivo no sirve: usa ${escapar(entrada.accept.replace(/\./g, '').toUpperCase().replace(/,/g, ', '))}`);
        return;
      }
      if (archivo.size > MAX_ARCHIVO) { agregarMensaje('l2-bot', 'El archivo pesa más de 5 MB. Prueba con una foto más liviana o un PDF más pequeño'); return; }
      ARCHIVOS.set(nombre, archivo);
      M.poner(conversacion.estado, c, archivo.name, 'ciudadano');
      const tamano = archivo.size > 1048576 ? `${(archivo.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(archivo.size / 1024))} KB`;
      agregarMensaje('l2-me', `<span class="l2-adjunto"><i class="ph ph-file-text" aria-hidden="true"></i>${escapar(archivo.name)} · ${tamano}</span>`);
      avanzar();
    });
    entrada.click();
  }

  // Barra de avance: datos, confirmar, pago (si se paga en línea) y revisión (o cita agendada)
  function progreso(etapa) {
    const { estado } = conversacion;
    const pago = estado ? M.monto(estado) : {};
    const cita = estado && M.modoCita(estado);
    const etapas = [['datos', 'Datos'], ['confirmar', 'Confirmar'], ...(pago.enLinea ? [['pago', 'Pago']] : []), ['revision', cita ? 'Cita' : 'En revisión']];
    const actual = etapas.findIndex(([id]) => id === etapa);
    return `<ol class="l2-progreso" aria-label="Avance de tu solicitud">${etapas.map(([id, texto], i) => `
      <li class="${i < actual || etapa === 'listo' ? 'hecho' : i === actual ? 'actual' : ''}"${i === actual ? ' aria-current="step"' : ''}>${escapar(texto)}</li>`).join('')}</ol>`;
  }

  const filas = lista => lista.map(([dt, dd]) => `<div><dt>${escapar(dt)}</dt><dd>${dd}</dd></div>`).join('');

  /* Resumen para confirmar: lo pedido, los datos de la cuenta (plegados), el costo y las declaraciones que se aceptan
     al confirmar. Un clic confirma (y abre el pago si lo hay). */
  function mostrarSolicitud(encabezado = '', notaBasico = false) {
    const t = tramiteActual();
    const { estado } = conversacion;
    const r = M.resumen(estado);
    const pago = M.monto(estado);
    const cita = M.modoCita(estado);
    conversacion.fase = 'confirmando';
    conversacion.preguntados = [];
    document.getElementById('texto-asistente').placeholder = 'Escribe tu duda aquí';
    const valor = f => escapar(f.sensible && f.tipo !== 'archivo' ? tapar(f.texto) : f.texto);
    // Arriba, lo que la persona dijo o eligió (y la cita propuesta); lo que se completó solo (opciones ya marcadas,
    // listas de una opción) va plegado. Lo que el trámite ya trae elegido (el servicio de ANDA) es el trámite mismo
    const solicitud = r.solicitud.filter(f => ['ciudadano', 'propuesta'].includes(f.origen));
    const detalles = r.solicitud.filter(f => ['defecto', 'unica'].includes(f.origen));
    const costo = pago.enLinea ? `Pagas <strong>${escapar(pago.total)}</strong> con tarjeta, en la pasarela segura`
      : cita ? (pago.enSede ? 'Pagas en la sede el día de tu cita' : 'No tiene costo')
      : 'No tiene costo';
    const declaraciones = r.consentimientos.map(f => `<li>${escapar(f.texto)}</li>`).join('');
    const propuesta = cita && Object.values(estado.respuestas).some(x => x.origen === 'propuesta');
    agregarMensaje('l2-bot', `${encabezado ? `${encabezado} ` : ''}${cita ? 'Revisa tu cita' : 'Revisa tu solicitud'} de <strong>${escapar(t.nombre)}</strong>
      ${progreso('confirmar')}
      <dl class="l2-cita l2-resumen">${filas(solicitud.map(f => [f.etiqueta, valor(f)]))}${filas([['Costo', costo], ['Tarda', escapar(t.tiempo || 'Según la institución')]])}</dl>
      ${detalles.length ? `<details class="l2-chat-datos"><summary><i class="ph ph-list-checks" aria-hidden="true"></i>Más detalles de la solicitud (${detalles.length})</summary>
        <dl class="l2-cita l2-resumen">${filas(detalles.map(f => [f.etiqueta, valor(f)]))}</dl></details>` : ''}
      ${r.cuenta.length ? `<details class="l2-chat-datos"><summary><i class="ph ph-identification-card" aria-hidden="true"></i>Tus datos de Identidad Digital (${r.cuenta.length})</summary>
        <dl class="l2-cita l2-resumen">${filas(r.cuenta.map(f => [f.etiqueta, valor(f)]))}</dl>
        <p class="l2-chat-nota">Si algo está mal, cámbialo en Mi cuenta</p></details>` : ''}
      <p class="l2-chat-nota">Al confirmar aceptas los <button type="button" class="l2-chat-enlace" data-terminos>términos y condiciones</button>${declaraciones ? ' y declaras:' : ''}</p>
      ${declaraciones ? `<ul class="l2-chat-declara">${declaraciones}</ul>` : ''}
      <div class="l2-options">${boton(conIcono(cita ? 'ph-calendar-check' : pago.enLinea ? 'ph-credit-card' : 'ph-paper-plane-tilt', cita ? 'Confirmar cita' : pago.enLinea ? `Confirmar y pagar ${escapar(pago.total)}` : 'Confirmar y enviar'), 'confirmarSolicitud()', 'l2-option-principal')}${cita ? boton(conIcono('ph-calendar-blank', propuesta ? 'Otro día u hora' : 'Cambiar día u hora'), 'otroHorario()') : CITAS[t.numero] ? boton(conIcono('ph-calendar-check', 'Prefiero ir con cita'), 'agendarCita()') : ''}${boton(conIcono('ph-pencil-simple', 'Corregir algo'), 'corregirSolicitud()')}</div>
      <p class="l2-chat-nota">También puedes escribir el cambio, por ejemplo «cambia el lugar a…»</p>${notaModoBasico(notaBasico)}`);
    guardarBorradorActual();
  }

  // "Seguir con mi solicitud": vuelve a mostrar el resumen
  function verSolicitud() {
    if (!enCurso()) return;
    agregarMensaje('l2-me', 'Ver mi solicitud');
    avanzar();
  }

  // Corregir: se elige qué cambiar y se vuelve a preguntar solo eso (los datos de la cuenta se cambian en Mi cuenta)
  function corregirSolicitud() {
    if (!enCurso()) return;
    agregarMensaje('l2-me', 'Corregir algo');
    const { estado } = conversacion;
    const cambiables = M.editables(estado).filter(c => !c.origen && estado.respuestas[c.nombre] && !['cuenta', 'tramite'].includes(estado.respuestas[c.nombre].origen) && !estado.respuestas[c.nombre].repetido);
    agregarMensaje('l2-bot', `¿Qué quieres cambiar? Elige o escríbelo
      <div class="l2-options">${cambiables.map(c => `<button type="button" class="l2-option" onclick="cambiarCampo('${c.nombre}')">${escapar(c.etiqueta)}</button>`).join('')}${boton('Nada, todo está bien', 'verSolicitud()', 'l2-option-volver')}</div>`);
  }

  function cambiarCampo(nombre) {
    if (!enCurso()) return;
    const c = M.campoDe(conversacion.estado, nombre);
    agregarMensaje('l2-me', escapar(c?.etiqueta || nombre));
    delete conversacion.estado.respuestas[nombre];
    // Un campo que no es obligatorio no aparecería en lo que falta: se pregunta igual
    const faltan = M.pendientes(conversacion.estado).filter(x => !x.origen);
    if (c && !faltan.some(x => x.nombre === nombre)) { conversacion.fase = 'recopilando'; preguntarDatos([c], '', false); return; }
    avanzar();
  }

  /* ----- Cita ----- */
  // Botón "Agendar cita" del trámite: pasa a cita y pregunta la sede (sin sesión, primero se confirma la identidad en el login)
  function agendarCita() {
    const numero = conversacion.numero;
    if (!CITAS[numero]) return;
    agregarMensaje('l2-me', 'Agendar cita');
    if (!SESION) {
      const dichos = leerBorrador()?.numero === numero ? leerBorrador().datos.filter(d => !d.campo.startsWith('cita_')) : [];
      pedirIdentidad({ tipo: 'tramite', numero, datos: [...dichos, { campo: 'cita_dia', valor: 'el primero disponible' }] }, 'Para agendar tu cita, confirma tu identidad', { abrirYa: true });
      return;
    }
    if (enCurso() && conversacion.numero === numero) {
      avanzar(M.aplicarDatos(conversacion.estado, [{ campo: 'cita_dia', valor: 'el primero disponible' }]));
      return;
    }
    iniciarTramite(numero, [{ campo: 'cita_dia', valor: 'el primero disponible' }]);
  }

  function preguntarSede(encabezado, notaBasico) {
    const { estado } = conversacion;
    const sede = M.campoConOrigen(estado, 'sedes');
    agregarMensaje('l2-bot', `${encabezado ? `${encabezado} ` : ''}¿En qué sede te queda mejor? Te propongo el primer horario libre
      <div class="l2-chat-tramites">${M.opcionesDe(estado, sede).map(o => `
        <button type="button" class="l2-chat-tramite" onclick="elegirSede('${o.valor}')">
          <span><strong>${escapar(o.texto)}</strong><small>${escapar(o.detalle || '')}</small></span>
          <i class="ph ph-map-pin" aria-hidden="true"></i>
        </button>`).join('')}</div>
      <p class="l2-chat-nota">También puedes escribir, por ejemplo «Santa Ana el martes en la tarde»</p>${progreso('datos')}${notaModoBasico(notaBasico)}`);
    guardarBorradorActual();
  }

  function elegirSede(valor) {
    if (!enCurso() || !M.modoCita(conversacion.estado)) return;
    const { estado } = conversacion;
    const sede = M.campoConOrigen(estado, 'sedes');
    const opcion = M.opcionesDe(estado, sede).find(o => o.valor === valor);
    if (!opcion) return;
    agregarMensaje('l2-me', escapar(opcion.texto));
    // Otra sede: el día y la hora se vuelven a proponer
    [M.campoConOrigen(estado, 'dias'), M.campoConOrigen(estado, 'horas')].forEach(c => { if (c) delete estado.respuestas[c.nombre]; });
    avanzar(M.aplicarDatos(estado, [{ campo: sede.nombre, valor }]));
  }

  // Otro día u hora: los próximos días hábiles y, al elegir uno, sus horas libres
  function otroHorario() {
    if (!enCurso() || !M.modoCita(conversacion.estado)) return;
    agregarMensaje('l2-me', 'Otro día u hora');
    const dia = M.campoConOrigen(conversacion.estado, 'dias');
    agregarMensaje('l2-bot', `¿Qué día prefieres?
      <div class="l2-options l2-options-grid l2-options-3">${M.opcionesDe(conversacion.estado, dia).map(o => boton(fechaCorta(fechaDe(o.valor)), `elegirDia('${o.valor}')`)).join('')}</div>`);
  }

  function elegirDia(fecha) {
    if (!enCurso() || !M.modoCita(conversacion.estado)) return;
    const { estado } = conversacion;
    const dia = M.campoConOrigen(estado, 'dias');
    const hora = M.campoConOrigen(estado, 'horas');
    agregarMensaje('l2-me', capitalizar(fechaLarga(fechaDe(fecha))));
    delete estado.respuestas[hora.nombre];
    M.aplicarDatos(estado, [{ campo: dia.nombre, valor: fecha }]);
    agregarMensaje('l2-bot', `¿A qué hora el <strong>${fechaLarga(fechaDe(fecha))}</strong>?
      <div class="l2-options l2-options-grid l2-options-3">${M.opcionesDe(estado, hora).map(o => boton(escapar(o.texto), `elegirHora('${o.valor}')`)).join('')}</div>`);
  }

  function elegirHora(valor) {
    if (!enCurso() || !M.modoCita(conversacion.estado)) return;
    const hora = M.campoConOrigen(conversacion.estado, 'horas');
    agregarMensaje('l2-me', horaLegible(valor));
    avanzar(M.aplicarDatos(conversacion.estado, [{ campo: hora.nombre, valor }]));
  }

  /* ----- Confirmar, pagar y enviar ----- */
  // eco: repite el botón como mensaje de la persona (no hace falta si escribió "sí, confirmo")
  async function confirmarSolicitud(eco = true) {
    if (conversacion.fase !== 'confirmando') return;
    const { estado } = conversacion;
    if (M.pendientes(estado).length) { avanzar(); return; }
    const cita = M.modoCita(estado);
    const pago = M.monto(estado);
    if (eco) agregarMensaje('l2-me', cita ? 'Confirmar cita' : pago.enLinea ? `Confirmar y pagar ${escapar(pago.total)}` : 'Confirmar y enviar');
    // La misma solicitud enviada hace unos minutos no se vuelve a enviar ni a cobrar
    const repetida = X.duplicada(estado.numero, estado.respuestas);
    if (repetida) {
      agregarMensaje('l2-bot', `Ya enviaste esta misma solicitud hace unos minutos: <strong>N.º ${escapar(repetida.id)}</strong>. No la volví a enviar ni a cobrar
        <div class="l2-options"><a class="l2-option" href="${APP}mis-tramites.html?tramite=${escapar(repetida.id)}">${conIcono('ph-folder-open', 'Verla en Mis documentos')}</a></div>`);
      return;
    }
    MET.registrar('confirmado');
    conversacion.solicitud = { id: conversacion.solicitud?.id || X.nuevoId() };
    // Pagado antes y falló el envío: se reintenta sin volver a cobrar
    if (conversacion.pagoAprobado) { await presentarSolicitud(conversacion.pagoAprobado); return; }
    if (pago.enLinea) { abrirPago(pago.total); return; }
    await presentarSolicitud(null);
  }

  // La pasarela (pago.html) se abre sobre el chat; al terminar avisa con postMessage
  let marcoPago = null;
  function abrirPago(total) {
    const { numero } = conversacion;
    conversacion.fase = 'pagando';
    conversacion.solicitud.total = total;
    X.prepararPago({ numero, solicitud: conversacion.solicitud.id, total });
    guardarBorradorActual();
    agregarMensaje('l2-bot', `Te abro la pasarela segura para pagar <strong>${escapar(total)}</strong>. Nunca escribas los datos de tu tarjeta en el chat${progreso('pago')}`);
    marcoPago = document.createElement('iframe');
    marcoPago.className = 'l2-pago-marco';
    marcoPago.title = 'Pago seguro de Simple.sv';
    marcoPago.src = `${APP}pago.html?n=${numero}&solicitud=${conversacion.solicitud.id}&modo=asistente`;
    document.body.append(marcoPago);
    marcoPago.focus();
  }

  function cerrarPago() {
    marcoPago?.remove();
    marcoPago = null;
    document.getElementById('texto-asistente').focus({ preventScroll: true });
  }

  window.addEventListener('message', async e => {
    if (!marcoPago || e.source !== marcoPago.contentWindow || e.data?.tipo !== 'simple-pago') return;
    cerrarPago();
    if (conversacion.fase !== 'pagando') return;
    if (e.data.resultado === 'aprobado' && e.data.solicitud === conversacion.solicitud?.id) {
      MET.registrar('clic', { etiqueta: 'Pagar' });
      MET.registrar('pagado');
      conversacion.pagoAprobado = { total: e.data.total, autorizacion: e.data.autorizacion, referencia: e.data.referencia };
      await presentarSolicitud(conversacion.pagoAprobado);
      return;
    }
    conversacion.fase = 'confirmando';
    guardarBorradorActual();
    agregarMensaje('l2-bot', `No se completó el pago. Tu solicitud sigue guardada aquí, sin enviar ni cobrar
      <div class="l2-options">${boton(conIcono('ph-credit-card', `Pagar ${escapar(conversacion.solicitud?.total || '')}`), 'reintentarPago()', 'l2-option-principal')}${boton('Corregir algo', 'corregirSolicitud()')}</div>`);
  });

  function reintentarPago() {
    if (conversacion.fase !== 'confirmando' || !conversacion.solicitud?.total) return;
    agregarMensaje('l2-me', 'Pagar');
    abrirPago(conversacion.solicitud.total);
  }

  // Envía la solicitud (integraciones.js). Si la institución falla, nada se da por hecho y se puede reintentar
  async function presentarSolicitud(pago) {
    const { estado, numero } = conversacion;
    const cita = M.modoCita(estado) ? M.citaElegida(estado) : null;
    const quitarEscribiendo = mostrarEscribiendo();
    const resultado = await X.presentar({ id: conversacion.solicitud.id, numero, respuestas: estado.respuestas, canal: 'web', pago, cita });
    quitarEscribiendo();
    if (!resultado.ok) {
      MET.registrar('error', { donde: 'presentar' });
      conversacion.fase = 'confirmando';
      guardarBorradorActual();
      const cobrado = pago ? ` Tu pago de ${escapar(pago.total)} sí quedó registrado (autorización ${escapar(pago.autorizacion)}): al reintentar no se cobra otra vez.` : '';
      agregarMensaje('l2-bot', `${escapar(resultado.error)}${cobrado}
        <div class="l2-options">${boton(conIcono('ph-arrow-clockwise', 'Intentar de nuevo'), 'confirmarSolicitud()', 'l2-option-principal')}${boton(conIcono('ph-headset', 'Hablar con una persona'), 'derivar()')}</div>`);
      return;
    }
    conversacion.fase = 'presentada';
    conversacion.solicitud = resultado.solicitud;
    borrarBorrador();
    MET.registrar('presentado', { cita: Boolean(cita) });
    if (cita) comprobanteCita(resultado.solicitud, cita);
    else comprobante(resultado.solicitud, pago);
  }

  function comprobante(s, pago) {
    const t = tramiteActual();
    const correo = cuenta().correo_notificaciones;
    const fecha = new Date(s.creada).toLocaleString('es-SV', { dateStyle: 'long', timeStyle: 'short' });
    agregarMensaje('l2-bot', `<strong>¡Listo!</strong> ${pago ? `Pagaste ${escapar(pago.total)} y tu` : 'Tu'} solicitud de <strong>${escapar(t.nombre)}</strong> quedó enviada a ${escapar(sigla(t))}
      ${progreso('revision')}
      <dl class="l2-cita l2-resumen">${filas([
        ['N.º', `<strong>${escapar(s.id)}</strong>`],
        ['Estado', escapar(X.etapaLegible(s))],
        ['Fecha', escapar(fecha)],
        ...(pago ? [['Pago', `${escapar(pago.total)} · autorización ${escapar(pago.autorizacion)}`]] : []),
        ['Tarda', escapar(t.tiempo || 'Según la institución')]
      ])}</dl>
      <p class="l2-cita-titulo">¿Qué sigue?</p>
      <ul class="l2-cita-llevar"><li>La institución la revisa; si falta algo, te avisamos para corregirlo</li><li>Te avisamos por correo${correo ? ` a ${escapar(correo)}` : ''} cuando esté lista</li><li>La descargas en Mis documentos</li></ul>
      <div class="l2-options"><a class="l2-option l2-option-principal" href="${APP}mis-tramites.html?tramite=${escapar(s.id)}">${conIcono('ph-folder-open', 'Ver en Mis documentos')}</a>${boton(conIcono('ph-whatsapp-logo', 'Avisarme por WhatsApp'), 'iniciarWhatsApp()', 'l2-option-wa')}</div>
      <p class="l2-chat-nota">Vista de diseño: ${pago ? 'el pago es simulado y ' : ''}no se envió nada a la institución</p>`);
  }

  function comprobanteCita(s, cita) {
    const t = tramiteActual();
    const datos = CITAS[t.numero];
    const sede = datos.sedes[cita.sede];
    agregarMensaje('l2-bot', `<strong>¡Listo!</strong> Tu cita para <strong>${escapar(t.nombre)}</strong> quedó agendada
      ${progreso('listo')}
      <dl class="l2-cita">${filas([
        ['Cita', `<strong>N.º ${escapar(s.id)}</strong>`],
        ['Sede', `${escapar(sede.nombre)} · ${escapar(sede.detalle)}`],
        ['Atención', horarioCorto(horarioDe(datos, sede))],
        ['Fecha', capitalizar(fechaLarga(fechaDe(cita.fecha)))],
        ['Hora', horaLegible(cita.hora)]
      ])}</dl>
      <p class="l2-cita-titulo">Qué llevar</p>
      <ul class="l2-cita-llevar">${queLlevar(t, datos, cita.cantidad).map(x => `<li>${escapar(x)}</li>`).join('')}</ul>
      <div class="l2-options">${boton(conIcono('ph-calendar-plus', 'Agregar a mi calendario'), 'agregarCalendario()', 'l2-option-principal')}${boton(conIcono('ph-whatsapp-logo', 'Avisarme por WhatsApp'), 'iniciarWhatsApp()', 'l2-option-wa')}</div>
      <p class="l2-chat-nota">Vista de diseño: la cita no se registró en la institución</p>`);
  }

  function agregarCalendario() {
    const s = conversacion.solicitud;
    if (!s?.cita) return;
    descargarCalendario(tramiteActual(), CITAS[conversacion.numero], { ...s.cita, codigo: s.id });
  }

  function cancelarSolicitud() {
    const t = tramiteActual();
    if (marcoPago) cerrarPago();
    conversacion = { numero: null };
    borrarBorrador();
    MET.registrar('cancelado');
    agregarMensaje('l2-bot', `Listo, dejé tu solicitud de <strong>${escapar(t?.nombre || 'trámite')}</strong>. No se envió nada ni se cobró. ¿Te ayudo con otro trámite?`);
  }

  /* ----- Cómo van mis trámites ----- */
  // Los de la cuenta (mis-tramites.js) y los enviados desde este navegador, con su etapa; y el que quedó a medias
  function mostrarEstado() {
    const lista = M.tramitesEnProceso(X.guardadas());
    const formato = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', year: 'numeric' });
    const borrador = leerBorrador();
    const medias = borrador && SESION && !enCurso()
      ? `<p class="l2-chat-pregunta">Y tienes a medias: <strong>${escapar(TRAMITES.find(t => t.numero === borrador.numero)?.nombre || '')}</strong></p><div class="l2-options">${boton(conIcono('ph-play', 'Seguir con ese'), 'reanudar()')}</div>`
      : '';
    if (!lista.length) {
      agregarMensaje('l2-bot', `No tienes trámites en proceso${medias}`);
      return;
    }
    agregarMensaje('l2-bot', `${lista.length === 1 ? 'Tienes 1 trámite en proceso' : `Tienes ${lista.length} trámites en proceso`}
      <div class="l2-chat-tramites">${lista.slice(0, 5).map(s => {
        const t = TRAMITES.find(x => x.numero === s.numero);
        return `<a class="l2-chat-tramite" href="${APP}mis-tramites.html?tramite=${escapar(s.id)}">
          <span><strong>${escapar(t.nombre)}</strong><small>N.º ${escapar(s.id)} · ${escapar(X.etapaLegible(s))} · desde el ${escapar(formato.format(new Date(s.fecha)))}</small></span>
          <i class="ph ph-caret-right" aria-hidden="true"></i></a>`;
      }).join('')}</div>${medias}`);
  }

  /* ----- Atención humana ----- */
  // Los canales de Contáctanos, con un resumen del caso para no tener que repetirlo (sin datos sensibles)
  function derivar() {
    MET.registrar('derivado');
    const t = tramiteActual();
    const resumen = enCurso()
      ? `${t.nombre}: ${M.resumen(conversacion.estado).solicitud.filter(f => !f.sensible).map(f => `${f.etiqueta}: ${f.texto}`).join('; ')}`
      : t ? t.nombre : '';
    agregarMensaje('l2-bot', `Te atiende una persona de Simple.sv en horario hábil: WhatsApp <strong>+503 6027-7777</strong> o <strong>contacto@simple.sv</strong>
      ${resumen ? `<p class="l2-chat-pregunta">Cuéntales esto para no repetir nada:</p><p class="l2-chat-resumen">${escapar(resumen)}</p>` : ''}
      <div class="l2-options"><a class="l2-option" href="${APP}contactanos.html">${conIcono('ph-headset', 'Ir a Contáctanos')}</a></div>
      ${enCurso() ? '<p class="l2-chat-nota">Tu solicitud sigue guardada aquí mientras tanto</p>' : ''}`);
  }

  /* ----- Seguir después ----- */
  // Lo que la persona dio (no los datos de la cuenta, ni los sensibles, ni archivos) se guarda 24 horas en este navegador
  const CLAVE_BORRADOR = 'simple-asistente-borrador';
  const VIGENCIA = 24 * 60 * 60 * 1000;
  function leerBorrador() {
    try {
      const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR));
      return b && FORMULARIOS[b.numero] && Date.now() - b.guardado < VIGENCIA ? b : null;
    } catch { return null; }
  }
  function guardarBorrador(numero, datos) {
    try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ numero, datos, guardado: Date.now() })); } catch { /* sin almacenamiento */ }
  }
  function guardarBorradorActual() {
    const { estado, numero } = conversacion;
    if (!estado) return;
    const datos = Object.entries(estado.respuestas)
      .filter(([nombre, r]) => r.origen === 'ciudadano' && !/^(sede|fecha|hora)_/.test(nombre) && !M.campoDe(estado, nombre)?.origen
        && M.campoDe(estado, nombre)?.tipo !== 'archivo' && !SENSIBLE.test(nombre))
      .map(([campo, r]) => ({ campo, valor: r.valor }));
    if (M.modoCita(estado)) datos.push({ campo: 'cita_dia', valor: 'el primero disponible' });
    guardarBorrador(numero, datos);
  }
  const borrarBorrador = () => { try { localStorage.removeItem(CLAVE_BORRADOR); } catch { /* sin almacenamiento */ } };

  function ofrecerReanudar() {
    const b = leerBorrador();
    if (!b) return;
    const t = TRAMITES.find(x => x.numero === b.numero);
    agregarMensaje('l2-bot', `Tienes a medias tu solicitud de <strong>${escapar(t.nombre)}</strong>. ¿Seguimos donde quedó?
      <div class="l2-options">${boton(conIcono('ph-play', 'Sí, seguir'), 'reanudar()', 'l2-option-principal')}${boton('No, descartarla', 'descartarBorrador()', 'l2-option-volver')}</div>`);
  }

  function reanudar() {
    const b = leerBorrador();
    if (!b) return;
    agregarMensaje('l2-me', 'Seguir');
    // Las respuestas de varias opciones se guardaron como lista; el motor las recibe separadas por comas
    iniciarTramite(b.numero, (b.datos || []).map(d => ({ campo: d.campo, valor: Array.isArray(d.valor) ? d.valor.join(', ') : d.valor })));
  }

  function descartarBorrador() {
    agregarMensaje('l2-me', 'No, descartarla');
    borrarBorrador();
    agregarMensaje('l2-bot', 'Listo, la descarté. ¿Qué trámite necesitas?');
  }

  /* Sin sesión (landing): hacer el trámite, agendar la cita o llevarlo a WhatsApp piden confirmar la identidad en el
     login (pedirIdentidad). Además, ayuda para crear la Identidad Digital y las preguntas frecuentes de
     Contáctanos, que también se responden si se escriben. */

  // Llevar a WhatsApp el trámite que se está viendo: WhatsApp sigue con lo que ya se dijo aquí (el borrador)
  function llevarPorWhatsApp() {
    const numero = conversacion.numero;
    if (!FORMULARIOS[numero]) return;
    agregarMensaje('l2-me', 'Hacerlo por WhatsApp');
    if (SESION) { destinoWhatsApp = numero; confirmarNumeroWhatsApp(); return; }
    pedirIdentidad({ tipo: 'whatsapp', numero }, 'Por WhatsApp te pedimos solo lo que falta. Primero confirma tu identidad', { abrirYa: true });
  }

  // Botón flotante "Realizar trámite en WhatsApp" de la landing: sin sesión, se confirma la identidad en el login, que
  // abre el WhatsApp de Simple.sv con el "Hola" ya enviado; con sesión, se confirma el celular aquí y se va a WhatsApp
  function realizarPorWhatsApp() {
    alternarAsistente(true);
    agregarMensaje('l2-me', 'Realizar trámite en WhatsApp');
    if (SESION) { destinoWhatsApp = null; confirmarNumeroWhatsApp(); return; }
    pedirIdentidad({ tipo: 'whatsapp' }, 'Por WhatsApp entendemos lo que necesitas y te pedimos solo lo que falta. Primero confirma tu identidad', { abrirYa: true });
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
      <div class="l2-options"><a class="l2-option l2-option-principal" href="https://login.gob.sv/" target="_blank" rel="noopener noreferrer">${conIcono('ph-arrow-square-out', 'Crear mi Identidad Digital')}</a>${SESION ? '' : boton(conIcono('ph-sign-in', 'Ya la tengo: iniciar sesión'), 'abrirLogin()')}</div>`);
  }

  // Las de Contáctanos; claves: frases (sin tildes) que, escritas en el chat, llevan a la respuesta
  const PREGUNTAS = [
    { pregunta: '¿Cómo me registro en Simple.sv?', claves: ['como registrarse', 'registrarse en simple', 'registrarte en simple'],
      respuesta: 'Crea tu <strong>Identidad Digital</strong> en login.gob.sv con tu DUI, tu correo y tu celular. Con ella inicias sesión',
      extra: () => boton(conIcono('ph-identification-badge', 'Cómo crear mi Identidad Digital'), "verIdentidad('Cómo crear mi Identidad Digital')") },
    { pregunta: '¿Cómo solicito un trámite?', claves: ['como solicito', 'como solicitar', 'como hago un tramite', 'como se hace un tramite', 'como funciona simple'],
      respuesta: 'Escríbeme qué necesitas: lo hacemos aquí mismo. Inicias sesión, confirmas y pagas si hace falta. Te confirmamos por correo' },
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
  const ENLACE_MI_CUENTA = '<a class="l2-option" href="' + APP + '../SIMPLE ACTUAL/Identidad digital.html" target="_blank" rel="noopener noreferrer"><i class="ph ph-user-circle" aria-hidden="true"></i>Ir a Mi cuenta</a>';
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
    if (!cuenta().telefono) {
      agregarMensaje('l2-bot', `Tu cuenta no tiene celular. Agrégalo en <strong>Mi cuenta</strong>. Mientras tanto, te avisamos por correo
        <div class="l2-options">${ENLACE_MI_CUENTA}</div>`);
      return;
    }
    agregarMensaje('l2-bot', `¿Te avisamos al <strong>${escapar(cuenta().telefono)}</strong>?
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
    const reservado = t && (nivelWA(t.numero) === 'r' || esJudicial(t.numero));
    const aviso = reservado ? ' Por privacidad, el aviso no dirá el nombre del trámite.' : '';
    // Si ya envió la solicitud no hace falta nada más; si no, se le ofrece hacerla aquí
    const hecha = conversacion.fase === 'presentada' || !t;
    const siguiente = hecha ? '' : ` Ahora hagamos tu trámite
      <div class="l2-options">${FORMULARIOS[t.numero] ? boton(conIcono('ph-lightning', 'Hacerlo aquí en el chat'), `hacerTramite(${t.numero})`, 'l2-option-principal') : enlaceFormulario(t)}</div>`;
    agregarMensaje('l2-bot', `¡Listo! Te escribiremos al <strong>${escapar(cuenta().telefono)}</strong> cuando finalice.${aviso} También te avisamos por correo${siguiente ? '.' : ''}${siguiente}
      <p class="l2-chat-nota">Nunca te pediremos datos por WhatsApp. Responde BAJA para dejar de recibir avisos</p>`);
  }

  /* Botón de WhatsApp de la landing: después de iniciar sesión (?whatsapp) el chat se abre solo para confirmar
     el celular de la cuenta y lleva al chat de WhatsApp de Simple.sv, que ya envía el "Hola" y pregunta qué trámite hacer.
     Si el número no es el correcto, se cambia en Mi cuenta: los mensajes solo van al número registrado. */
  function confirmarNumeroWhatsApp() {
    if (!cuenta().telefono) {
      agregarMensaje('l2-bot', `Necesitamos un celular en tu cuenta. Agrégalo en <strong>Mi cuenta</strong> y vuelve aquí
        <div class="l2-options">${ENLACE_MI_CUENTA}${boton('Ya lo agregué', 'numeroWhatsAppCambiado()')}</div>`);
      return;
    }
    agregarMensaje('l2-bot', `Seguimos por <strong>WhatsApp</strong>. ¿Te escribimos al <strong>${escapar(cuenta().telefono)}</strong>?
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

  // Con un trámite elegido aquí, WhatsApp empieza con ese y con lo que ya se dijo (el borrador); si no, pregunta cuál
  function irAWhatsApp() {
    agregarMensaje('l2-me', 'Sí, ir a WhatsApp');
    agregarMensaje('l2-bot', 'Te llevamos a WhatsApp…');
    const tramite = FORMULARIOS[destinoWhatsApp] ? `n=${destinoWhatsApp}&` : '';
    setTimeout(() => { location.href = `${APP}whatsapp.html?${tramite}hola=1`; }, 1200);
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
    MET.registrar('mensaje');
    responderAsistente(texto);
  }

  /* ===== Audio: dicta tu consulta con el micrófono (reconocimiento de voz del navegador) =====
     La animación de grabación (punto, ondas y tiempo) arranca al tocar el micrófono, sin esperar al reconocimiento de voz,
     y las ondas siguen el volumen real del micrófono, como en WhatsApp */
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  let grabacion = null;

  function alternarMicrofono() {
    if (grabacion) { grabacion.detener(); return; }
    if (!Reconocimiento && !navigator.mediaDevices?.getUserMedia) {
      agregarMensaje('l2-bot', 'Tu navegador no permite audio. Escribe tu consulta o usa Chrome');
      return;
    }
    const formulario = document.querySelector('.l2-form');
    const microfono = document.getElementById('microfono');
    const textoVivo = document.getElementById('grabando-texto');
    const tiempo = document.getElementById('grabando-tiempo');
    const ondas = document.querySelector('.l2-ondas');
    const barras = [...ondas.children];
    const g = grabacion = { inicio: Date.now(), transcripcion: '', error: '', reconocimiento: null, flujo: null, contexto: null, cuadro: 0, reloj: 0, cerrada: false };

    formulario.classList.add('grabando');
    microfono.setAttribute('aria-pressed', 'true');
    microfono.setAttribute('aria-label', 'Detener y enviar audio');
    g.reloj = setInterval(() => {
      const s = Math.floor((Date.now() - g.inicio) / 1000);
      tiempo.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 250);

    // Ondas con el volumen del micrófono; si no hay permiso, quedan con su animación de siempre
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(flujo => {
        if (g.cerrada) { flujo.getTracks().forEach(pista => pista.stop()); return; }
        g.flujo = flujo;
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) return;
        g.contexto = new Contexto();
        const analizador = g.contexto.createAnalyser();
        analizador.fftSize = 64;
        g.contexto.createMediaStreamSource(flujo).connect(analizador);
        const datos = new Uint8Array(analizador.frequencyBinCount);
        ondas.classList.add('con-nivel');
        const pintar = () => {
          analizador.getByteFrequencyData(datos);
          barras.forEach((barra, n) => {
            const nivel = datos[n * 2 + 1] / 255;
            barra.style.height = `${Math.round(5 + Math.min(1, nivel * 1.6) * 15)}px`;
          });
          g.cuadro = requestAnimationFrame(pintar);
        };
        pintar();
      }).catch(() => {
        if (!g.error) g.error = 'Activa el micrófono en tu navegador o escribe tu consulta';
        cerrar();
      });
    }

    // Termina la grabación una sola vez: apaga el micrófono, quita la animación y envía lo dictado
    function cerrar() {
      if (g.cerrada) return;
      g.cerrada = true;
      const segundos = Math.max(1, Math.round((Date.now() - g.inicio) / 1000));
      clearInterval(g.reloj);
      cancelAnimationFrame(g.cuadro);
      g.flujo?.getTracks().forEach(pista => pista.stop());
      g.contexto?.close().catch(() => {});
      ondas.classList.remove('con-nivel');
      barras.forEach(barra => { barra.style.height = ''; });
      grabacion = null;
      formulario.classList.remove('grabando');
      microfono.setAttribute('aria-pressed', 'false');
      microfono.setAttribute('aria-label', 'Enviar audio');
      textoVivo.textContent = 'Escuchando…';
      tiempo.textContent = '0:00';
      if (!g.transcripcion) {
        agregarMensaje('l2-bot', g.error || 'No alcancé a escucharte. Intenta de nuevo o escribe tu consulta');
        return;
      }
      agregarMensaje('l2-me l2-me-audio', `<span class="l2-audio-cab"><i class="ph ph-microphone" aria-hidden="true"></i>Audio · ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}</span>${escapar(g.transcripcion)}`);
      MET.registrar('mensaje', { audio: true });
      responderAsistente(g.transcripcion);
    }

    // Con reconocimiento de voz, el audio se cierra cuando este termina; sin él, al detener
    g.detener = () => { if (g.reconocimiento) g.reconocimiento.stop(); else cerrar(); };
    if (!Reconocimiento) { g.error = 'Tu navegador no convierte el audio en texto. Escribe tu consulta o usa Chrome'; return; }
    g.reconocimiento = new Reconocimiento();
    g.reconocimiento.lang = 'es-SV';
    g.reconocimiento.interimResults = true;
    g.reconocimiento.onresult = e => {
      g.transcripcion = [...e.results].map(resultado => resultado[0].transcript).join(' ').trim();
      textoVivo.textContent = g.transcripcion || 'Escuchando…';
    };
    g.reconocimiento.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') g.error = 'Activa el micrófono en tu navegador o escribe tu consulta';
      else if (e.error === 'network' || e.error === 'language-not-supported') g.error = 'Tu navegador no pudo convertir el audio en texto. Escribe tu consulta o usa Chrome';
    };
    // Si el reconocimiento se corta solo y falló, la animación termina con el aviso; si no, espera a que la persona detenga el audio
    g.reconocimiento.onend = () => {
      g.reconocimiento = null;
      cerrar();
    };
    g.reconocimiento.start();
  }

  /* ===== Inicio ===== */
  // Con un video u otro <dialog> abierto, Escape solo cierra ese diálogo y el chat sigue abierto (y con el pago abierto, tampoco)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.querySelector('dialog[open]') && !marcoPago) alternarAsistente(false);
  });

  // Cada botón o enlace que se toca en el chat cuenta como un clic (métricas: clics por trámite)
  document.getElementById('mensajes').addEventListener('click', e => {
    const control = e.target.closest('button, a');
    if (control && !control.matches('.l2-nav-btn, .l2-chat-enlace, summary *')) MET.registrar('clic', { etiqueta: control.textContent.trim().slice(0, 40) });
  });

  // Los botones de los mensajes llaman a estas funciones desde su onclick
  Object.assign(window, {
    alternarAsistente, enviarMensaje, alternarMicrofono, paginarChat, volverPasoAnterior,
    verCategoria, verMasCategorias, verTema, elegirTramite, mostrarEnCatalogo, irDesdeAsistente, abrirTemaDesdeAsistente,
    hacerTramite, elegirOpcion, guardarSeguro, adjuntarArchivo, verSolicitud, corregirSolicitud, cambiarCampo,
    responderSiEsSuyo, elegirApellidos,
    agendarCita, elegirSede, otroHorario, elegirDia, elegirHora, confirmarSolicitud, reintentarPago, agregarCalendario,
    derivar, reanudar, descartarBorrador,
    iniciarWhatsApp, respuestaNotificaciones, cambiarNumero, confirmarWhatsApp,
    cambiarNumeroWhatsApp, numeroWhatsAppCambiado, irAWhatsApp,
    llevarPorWhatsApp, realizarPorWhatsApp, abrirLogin, verIdentidad, verPreguntas, verRespuesta
  });

  const parametros = new URLSearchParams(location.search);
  // Con sesión, al volver del login para agendar una cita (?cita=número) o para seguir en el chat (?asistente=número):
  // el chat se abre en ese punto, con lo que se había dicho en la landing
  const citaPedida = Number(parametros.get('cita'));
  const tramitePedido = Number(parametros.get('asistente'));
  if (SESION && (CITAS[citaPedida] || FORMULARIOS[tramitePedido])) {
    history.replaceState(null, '', location.pathname);
    tomarPendiente(); // ya se retomó con la URL: se descarta la copia guardada
    const borrador = leerBorrador();
    const numero = CITAS[citaPedida] ? citaPedida : tramitePedido;
    const datos = borrador?.numero === numero ? borrador.datos : [];
    abiertoAntes = true;
    MET.nuevaSesion('web');
    alternarAsistente(true);
    if (CITAS[citaPedida] && !datos.some(d => d.campo.startsWith('cita_'))) datos.push({ campo: 'cita_dia', valor: 'el primero disponible' });
    iniciarTramite(numero, datos);
  }

  // Con sesión, al volver del login desde el botón de WhatsApp (?whatsapp): el chat se abre con "Cómo funciona por
  // WhatsApp" (lo pinta la página), sin el saludo ni las categorías, y pregunta si el celular
  // es el correcto
  if (SESION && parametros.has('whatsapp')) {
    history.replaceState(null, '', location.pathname);
    document.querySelectorAll('#mensajes > .l2-fila-bot:not(:has(#pasos-chat))').forEach(f => f.remove());
    alternarAsistente(true);
    confirmarNumeroWhatsApp();
  }

  // Con sesión, los datos de la cuenta se cargan de una vez; de vuelta del login que pidió el chat de la landing
  // (?destino=inicio), el chat sigue con lo que se iba a hacer
  if (SESION) {
    cargarSesion();
    const pendiente = !CITAS[citaPedida] && !FORMULARIOS[tramitePedido] && !parametros.has('whatsapp') ? tomarPendiente() : null;
    if (pendiente) seguirConSesion(pendiente);
  }
})();
