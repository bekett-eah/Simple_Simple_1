/* Banners de 1600x600 para el carrusel de Simple.sv (misma línea que el video de Platzi):
 *   ?v=asistente  funciones del asistente: buscar por texto o voz, ver los pasos, agendar cita, avisos por WhatsApp
 *   ?v=whatsapp   hacer un trámite completo por WhatsApp
 * Todo es función del tiempo: window.__seek(t) deja el cuadro exacto para renderizar cuadro por cuadro. */
(() => {
  const Q = new URLSearchParams(location.search);
  const V = Q.get('v') === 'whatsapp' ? 'whatsapp' : 'asistente';
  const FPS = Number(Q.get('fps')) || 30;
  const RENDER = Q.has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1600, HH = 600, DURATION = 20;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Efectos evaluados en cada cuadro (flotación, tecleo, puntos de "escribiendo"…)
  const FX = [];
  const fx = (start, dur, fn) => FX.push({ start, dur, fn });
  const runFX = (t) => { for (const f of FX) f.fn(f.dur > 0 ? clamp((t - f.start) / f.dur) : t >= f.start ? 1 : 0, t); };

  /* ------------------------------------------------------------ íconos (trazo de 24 px) */
  const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
  const ICON = {
    search: S('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>'),
    star: S('<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
    idcard: S('<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.3"/><path d="M5.5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 10h4.5M14 13.5h3"/>'),
    question: S('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/>'),
    calcheck: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4"/>'),
    list: S('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>'),
    mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    wa: S('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><g transform="translate(7.3 7.3) scale(.4)" stroke-width="4.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></g>'),
    send: S('<path d="M21 3 3.5 10.5l7 2.5 2.5 7z"/><path d="M21 3 10.5 13"/>'),
    back: S('<path d="m15 5-7 7 7 7"/>'),
    video: S('<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>'),
    phone: S('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>'),
    verified: S('<path d="M12 2.5 14.4 4.6l3.1-.3.8 3 2.7 1.6-1.2 2.9 1.2 2.9-2.7 1.6-.8 3-3.1-.3L12 21.5l-2.4-2.1-3.1.3-.8-3-2.7-1.6L4.2 12 3 9.1l2.7-1.6.8-3 3.1.3z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    read: S('<path d="m2 12.5 4 4L13.5 8M10.5 16l1 .5L19 8"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    lock: S('<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    card: S('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>'),
    bell: S('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    file: S('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    check: S('<path d="m5 12.5 4.5 4.5L19 7"/>', ' stroke-width="2.6"'),
    chat: S('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z"/><path d="M8.5 10.5h7M8.5 14h4.5"/>'),
    robotmini: S('<rect x="4" y="7" width="16" height="12" rx="5"/><path d="M12 7V4M9.5 12v1.5M14.5 12v1.5M2 12v3M22 12v3"/><circle cx="12" cy="3.5" r="1"/>'),
    wifi: S('<path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/>'),
    sticker: S('<path d="M20 12.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5z"/><path d="M12.5 20c0-4.1 3.4-7.5 7.5-7.5"/>'),
  };
  const ic = (name, cls = '') => `<span class="ic ${cls}"><i data-i="${name}"></i></span>`;
  const ROBOT = 'assets/simple-robot-asistente-sin-fondo.png';

  /* ------------------------------------------------------------ contenido de cada banner */
  const CFG = {
    asistente: {
      l1: [['Tu nuevo', 'c-w'], ['asistente', 'c-b']],
      rot: ['Busca tu trámite', 'Mira los pasos', 'Agenda tu cita', 'Háblale por voz'],
      sub: 'y resuelve tus trámites<br>en <b>Simple.sv</b>',
      chips1: [
        { t: 'Más solicitados', i: 'star', x: 905, y: 64 },
        { t: 'Agendar cita', i: 'calcheck', x: 1318, y: 140 },
        { t: 'Identidad Digital', i: 'idcard', x: 850, y: 368 },
        { t: 'Preguntas frecuentes', i: 'question', x: 1235, y: 452 },
      ],
      circ: 'robotmini',
      say2: ['Escríbele o <b>envíale un audio</b>', 'y te muestra el trámite,', '<b>sus requisitos, el costo</b>', '<b>y los pasos a seguir</b>'],
      chips2: [
        { t: 'Audio · 0:04', i: 'mic', x: 70, y: 84 },
        { t: 'Ver los pasos', i: 'list', x: 455, y: 448 },
      ],
      say3: ['<b>Agenda tu cita</b> en la sede,', 'el día y la hora que prefieras', 'y recibe <b>avisos por WhatsApp</b>', 'cuando tu trámite finalice'],
      cards: [
        { img: 'capturas/panel_audio.png', pos: '50% 100%', cap: 'Te escucha', i: 'mic' },
        { img: 'capturas/panel_pasos.png', pos: '50% 10%', cap: 'Pasos a seguir', i: 'list' },
        { img: 'capturas/panel_cita.png', pos: '50% 40%', cap: 'Agenda tu cita', i: 'calcheck' },
        { img: 'capturas/panel_whatsapp.png', pos: '50% 62%', cap: 'Avisos por WhatsApp', i: 'wa', g: true },
      ],
      pills: ['Disponible 24/7', 'Por texto o por voz', 'Sin filas'],
    },
    whatsapp: {
      l1: [['Solicita por', 'c-w'], ['WhatsApp', 'c-g']],
      rot: ['Antecedentes penales', 'Solvencia de agua', 'Certificación de DUI', 'Títulos y notas'],
      sub: 'y muchos trámites más,<br><b>sin filas</b>',
      chips1: [
        { t: 'Identidad Digital', i: 'idcard', x: 905, y: 74 },
        { t: 'Pago en línea', i: 'card', x: 1300, y: 150 },
        { t: 'Documento en PDF', i: 'file', x: 880, y: 392 },
        { t: 'Te avisamos', i: 'bell', x: 1326, y: 452, g: true },
      ],
      circ: 'wa',
      say2: ['Inicia sesión con tu', '<b>Identidad Digital</b> y responde', 'en el chat: te pedimos', '<b>los datos uno por uno</b>'],
      chips2: [
        { t: 'Escribe «Hola»', i: 'chat', x: 470, y: 96, g: true },
        { t: 'Datos uno por uno', i: 'list', x: 520, y: 430 },
      ],
      say3: ['<b>Paga en línea</b> con tarjeta', 'y recibe tu documento', '<b>por WhatsApp</b>', 'y <b>por correo</b>'],
      cards: [
        { html: () => `<div class="inner"><div class="wa-row"><div class="wa-b wa-q">Revisa tu solicitud de <b>Solvencia de cuenta de agua</b>:
            <div class="wa-sum"><span>Cuenta</span>0123-4567<span>Titular</span>María López<span>Entrega</span>1 día hábil<span>Total</span><b>$3.39</b></div><em>10:42</em></div>
            <div class="wa-btns"><span class="on"><i data-i="send"></i>Enviar solicitud</span><span>Corregir un dato</span></div></div></div>`, cap: 'Revisa tus datos', i: 'list' },
        { html: () => `<div class="inner"><div class="cc"><div class="cc-chip"></div><div class="cc-num">•••• •••• •••• 4242</div>
            <div class="cc-row"><span><small>TITULAR</small>MARÍA LÓPEZ</span><span><small>VENCE</small>08/29</span></div></div>
            <div class="pay-tot"><span>Total a pagar</span><b>$3.39</b></div><div class="pay-btn">Pagar $3.39</div></div>`, cap: 'Pago seguro', i: 'lock' },
        { html: () => `<div class="inner"><div class="okc"><i data-i="check"></i></div>
            <div class="wa-b" style="margin-top:14px">¡Listo! Tu solicitud <b>N.º 48213</b> quedó registrada<em>10:44</em></div>
            <div class="doc"><div class="doc-top"><img src="assets/escudo-el-salvador.png" alt=""><div><small>ANDA</small><b>Solvencia de cuenta</b></div></div>
            <i class="ln" style="width:90%"></i><i class="ln" style="width:70%"></i><div class="doc-foot"><span class="pdf">PDF</span><span class="seal"><i data-i="check"></i>Emitido</span></div></div></div>`, cap: 'Tu documento', i: 'file' },
        { html: () => `<div class="inner" style="padding-top:34px"><div class="notif"><span class="ni"><i data-i="wa"></i></span><div><small>WhatsApp · ahora</small><b>Simple.sv</b><span>Tu trámite finalizó. Descarga tu solvencia aquí</span></div></div>
            <div class="notif" style="margin-top:14px"><span class="ni" style="background:#0066FF"><i data-i="file"></i></span><div><small>Correo · ahora</small><b>Simple.sv</b><span>Tu documento está listo</span></div></div></div>`, cap: 'Te avisamos', i: 'bell', g: true },
      ],
      pills: ['Desde tu celular', 'Pago seguro', 'Sin filas'],
    },
  };
  const C = CFG[V];

  /* ------------------------------------------------------------ marcado */
  function laptop() {
    const keys = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) keys.push('<i></i>');
    keys.push('<i class="w2"></i><i></i><i></i><i class="sp"></i><i></i><i></i><i class="w2"></i>');
    return `<div class="lap3d"><div class="lap" id="lap">
      <div class="base"><div class="hinge"></div><div class="kb">${keys.join('')}</div><div class="tp"></div><div class="front"></div></div>
      <div class="lid"><div class="scr"><img id="scrA" src="capturas/landing_busqueda.png" alt=""><img id="scrB" src="capturas/landing_saludo.png" alt="" style="opacity:0"></div><span class="cam"></span></div>
    </div></div>`;
  }
  function phone() {
    return `<div class="ph3d"><div class="ph" id="lap"><div class="scr"><div class="notch"></div>
      <div class="wa" id="wa">
        <div class="wa-head"><i data-i="back"></i><span class="wa-ava"><img src="${ROBOT}" alt=""></span>
          <div class="wa-who"><b>Simple.sv <i data-i="verified"></i></b><small id="waEstado">en línea</small></div>
          <span class="wa-acts"><i data-i="video"></i><i data-i="phone"></i></span></div>
        <div class="wa-body"><div class="wa-msgs" id="waMsgs">
          <div class="wa-day">HOY</div>
          <div class="wa-row me" id="m0"><div class="wa-b">Hola<em>10:40 <i data-i="read"></i></em></div></div>
          <div class="wa-row" id="m1"><div class="wa-b">¡Hola, María! 👋 Vamos a crear tu solicitud de <b>Solvencia de cuenta de agua</b>, de la ANDA<em>10:40</em></div></div>
          <div class="wa-row" id="m2"><div class="wa-b wa-q">Usaremos estos datos de tu <b>Identidad Digital</b>:
            <div class="wa-sum"><span>DUI</span>01234567-8<span>Nombre</span>María López</div><em>10:40</em></div>
            <div class="wa-btns"><span id="bOk">Sí, continuar</span></div></div>
          <div class="wa-row me" id="m3"><div class="wa-b">Sí, continuar<em>10:41 <i data-i="read"></i></em></div></div>
          <div class="wa-row" id="m4"><div class="wa-b"><b>N.º de cuenta</b><br>Escríbelo como aparece en tu factura<em>10:41</em></div></div>
          <div class="wa-row me" id="m5"><div class="wa-b">0123-4567<em>10:41 <i data-i="read"></i></em></div></div>
          <div class="wa-row" id="m6"><div class="wa-b wa-q">Revisa tu solicitud:
            <div class="wa-sum"><span>Cuenta</span>0123-4567<span>Total</span><b>$3.39</b></div><em>10:42</em></div>
            <div class="wa-btns"><span id="bEnviar"><i data-i="send"></i>Enviar solicitud</span></div></div>
          <div class="wa-row me" id="m7"><div class="wa-b">Enviar solicitud<em>10:42 <i data-i="read"></i></em></div></div>
          <div class="wa-row" id="m8"><div class="wa-b">Paga en línea para terminar:
            <div class="wa-link"><div class="wa-link-top"><i data-i="lock"></i><div><b>Pagar $3.39 · Simple.sv</b><small>Pago seguro con tarjeta</small></div></div><span class="wa-link-pie">pagos.simple.sv</span></div><em>10:42</em></div></div>
        </div><div class="wa-typing" id="waTyping"><i></i><i></i><i></i></div></div>
        <div class="wa-input"><i data-i="plus"></i><div class="wa-field"><span id="waTxt"></span><span class="ph-t" id="waPh">Mensaje</span></div><span class="wa-send"><i data-i="send"></i></span></div>
      </div></div></div></div>`;
  }

  function markup() {
    const chip = (c, k, cls = '') => `<div class="chip ${cls}" style="left:${c.x}px;top:${c.y}px">${ic(c.i, c.g ? 'g' : '')}${c.t}</div>`;
    const lines = (arr) => arr.map((l) => `<span class="ln">${l}</span>`).join('');
    const card = (c) => `<div class="card ${c.html ? 'dark' : ''}">${c.html ? c.html() : `<img src="${c.img}" alt="" style="object-position:${c.pos}">`}
      <div class="chip cap">${ic(c.i, c.g ? 'g' : '')}${c.cap}</div></div>`;
    const devPos = V === 'asistente' ? 'left:860px;top:36px' : 'left:1160px;top:34px';
    return `
      <div id="bg"></div><div id="glow"></div><div id="sheen"></div>
      <div id="cam">
        <div id="hline"></div><div id="vline"></div><div id="circ" class="${V === 'whatsapp' ? 'wa' : ''}"><i data-i="${C.circ}"></i></div>
        <div class="dev" id="dev" style="${devPos}">${V === 'asistente' ? laptop() : phone()}</div>
        ${C.chips1.map((c, k) => chip(c, k, 'c1')).join('')}
        ${C.chips2.map((c, k) => chip(c, k, 'c2')).join('')}
        <div class="hero" id="hero">
          <div class="l1">${C.l1.map(([w, cls]) => `<span class="w ${cls}">${w}</span>`).join(' ')}</div>
          <div class="rot">${C.rot.map((r) => `<b>${r}</b>`).join('')}</div>
          <p class="sub">${C.sub}</p>
        </div>
        <div class="say" id="say2">${lines(C.say2)}</div>
        <div class="say" id="say3">${lines(C.say3)}</div>
        <div id="cardsWrap"><div id="strip">${C.cards.map(card).join('')}</div></div>
        ${C.pills.map((p, k) => `<div class="pill" style="left:${[96, 150, 112][k]}px;top:${[150, 248, 346][k]}px"><span>${p}</span></div>`).join('')}
      </div>
      <div id="tile">${V === 'asistente' ? `<img src="${ROBOT}" alt="">` : '<i data-i="wa"></i>'}</div>
      <div id="end">
        <div id="endT">Ingresa a</div>
        <div id="endPill"><div class="logo" data-logo></div></div>
        ${V === 'asistente'
          ? `<div id="endFab" class="bot"><img src="${ROBOT}" alt="">¿Necesitas ayuda?</div>`
          : '<div id="endFab" class="wa"><i data-i="wa"></i>Realizar trámite en WhatsApp</div>'}
        <div id="endGob"><img src="assets/logo-gobierno.png" alt=""></div>
      </div>
      <div id="vig"></div>
      <div id="fade"></div>`;
  }

  /* ------------------------------------------------------------ construcción */
  let tl;
  function build() {
    $('#stage').innerHTML = markup();
    $$('i[data-i]').forEach((i) => { i.innerHTML = ICON[i.dataset.i] || ''; });
    $$('[data-logo]').forEach((d) => { d.innerHTML = window.__logo; });

    tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const blurIn = (el, t, from = {}, dur = 0.7) => tl.fromTo(el, { opacity: 0, filter: 'blur(14px)', ...from },
      { opacity: 1, filter: 'blur(0px)', x: 0, y: 0, scale: 1, duration: dur, immediateRender: false }, t);
    const blurOut = (el, t, to = {}, dur = 0.45) => tl.to(el, { opacity: 0, filter: 'blur(14px)', duration: dur, ease: 'power2.in', ...to }, t);

    // estados iniciales
    gsap.set(['.chip.c1', '.chip.c2', '.card .cap', '.hero .rot b', '.say .ln', '.pill', '#tile', '#circ', '#cardsWrap', '#endT', '#endPill', '#endFab', '#endGob'], { opacity: 0 });
    gsap.set('#hline', { scaleX: 0 });
    gsap.set('#vline', { scaleY: 0 });

    /* ---------- fondo vivo ---------- */
    fx(0, DURATION, (p, t) => {
      $('#glow').style.transform = `translate(${1180 + Math.sin(t * 0.32) * 230}px, ${560 + Math.cos(t * 0.27) * 70}px)`;
    });
    const sweep = (t0, d) => tl.fromTo('#sheen', { xPercent: 0 }, { xPercent: 420, duration: d, ease: 'none', immediateRender: false }, t0);
    sweep(0.2, 2.6); sweep(6.9, 2.4); sweep(17.3, 2.2);
    tl.fromTo('#fade', { opacity: 1 }, { opacity: 0, duration: 0.7, ease: 'power1.out' }, 0);
    tl.fromTo('#cam', { scale: 1.0 }, { scale: 1.035, duration: 6.7, ease: 'none' }, 0);
    tl.fromTo('#cam', { scale: 1.035 }, { scale: 1, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, 6.7);
    tl.fromTo('#cam', { scale: 1 }, { scale: 1.025, duration: 7.2, ease: 'none', immediateRender: false }, 7.4);

    /* ---------- dispositivo ---------- */
    // Momentos de cada escena: 1 titular · 2 línea y texto · 3 tarjetas · 4 píldoras · mosaico · imagen final
    const T2 = 6.7, T3 = 10.55, T4 = 14.6, TT = 16.6, TE = 17.7;
    const dev = $('#dev'), lap = $('#lap');
    const LAPTOP = V === 'asistente';
    const pose1 = LAPTOP ? { rotationY: -30, rotationX: -14, rotationZ: 1.5 } : { rotationY: -20, rotationX: 6, rotationZ: 1 };
    const pose2 = LAPTOP ? { rotationY: 26, rotationX: -12, rotationZ: -1.5 } : { rotationY: 20, rotationX: 6, rotationZ: -1 };
    const x2 = LAPTOP ? -830 : -880;
    gsap.set(lap, pose1);
    gsap.set(dev, { scale: LAPTOP ? 0.92 : 1, opacity: 0 });
    tl.fromTo(dev, { x: 520, opacity: 0, filter: 'blur(10px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', immediateRender: false }, 0.15);
    tl.fromTo(lap, { rotationY: pose1.rotationY - 22 }, { rotationY: pose1.rotationY, duration: 1.6, ease: 'expo.out', immediateRender: false }, 0.15);
    fx(0, DURATION, (p, t) => { dev.style.translate = `0 ${Math.sin(t * 1.1) * 6}px`; });
    // a la izquierda, mirando al texto (escena 2)
    tl.to(dev, { x: x2, duration: 1.0, ease: 'power3.inOut' }, T2);
    tl.to(lap, { ...pose2, duration: 1.0, ease: 'power3.inOut' }, T2);
    tl.to(dev, { keyframes: [{ filter: 'blur(5px)', duration: 0.45, ease: 'power1.in' }, { filter: 'blur(0px)', duration: 0.55, ease: 'power1.out' }] }, T2);
    // sale para dar paso a las tarjetas (escena 3)
    tl.to(dev, { x: x2 - 700, opacity: 0, filter: 'blur(12px)', duration: 0.6, ease: 'power3.in' }, T3);
    // vuelve a la derecha (escena 4)
    tl.set(lap, pose1, T4);
    if (LAPTOP) { tl.set('#scrA', { opacity: 0 }, T4); tl.set('#scrB', { opacity: 1 }, T4); }
    tl.fromTo(dev, { x: 620, opacity: 0, filter: 'blur(12px)' }, { x: LAPTOP ? 40 : 30, opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', immediateRender: false }, T4 + 0.05);
    blurOut(dev, TT - 0.15, { scale: LAPTOP ? 0.8 : 0.85, x: LAPTOP ? 120 : 60 }, 0.5);

    /* ---------- escena 1 · titular ---------- */
    gsap.set(['.hero .l1 .w', '.hero .sub'], { opacity: 0 });
    const words = $$('.hero .l1 .w');
    words.forEach((w, k) => {
      tl.fromTo(w, { letterSpacing: '0.62em', opacity: 0, filter: 'blur(10px)' }, { letterSpacing: '0.005em', opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', immediateRender: false }, 0.35 + k * 0.45);
    });
    const rots = $$('.hero .rot b');
    rots.forEach((r, k) => {
      const t0 = 1.5 + k * 1.25;
      tl.fromTo(r, { opacity: 0, y: 46, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out', immediateRender: false }, t0);
      if (k < rots.length - 1) tl.to(r, { opacity: 0, y: -40, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, t0 + 1.25 - 0.3);
    });
    blurIn('.hero .sub', 1.95, { y: 24 });
    $$('.chip.c1').forEach((c, k) => {
      blurIn(c, 1.05 + k * 0.22, { scale: 0.7, y: 20 }, 0.6);
      fx(0, DURATION, (p, t) => { c.style.translate = `0 ${Math.sin(t * 1.3 + k * 1.7) * 7}px`; });
      blurOut(c, T2 - 0.2 + k * 0.04, { scale: 0.8 }, 0.35);
    });
    blurOut('#hero', T2 - 0.15, { x: -140 }, 0.5);

    /* ---------- escena 2 · línea, círculo y texto ---------- */
    tl.to('#hline', { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, T2 + 0.6);
    tl.fromTo('#circ', { opacity: 0, scale: 0.2, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)', immediateRender: false }, T2 + 1.15);
    tl.to('#vline', { scaleY: 1, duration: 0.6, ease: 'power2.out' }, T2 + 1.4);
    fx(T2 + 1.6, DURATION, (p, t) => { $('#circ').style.boxShadow = `0 0 0 ${10 + Math.sin(t * 3) * 4}px ${V === 'whatsapp' ? 'rgba(0,168,132,.2)' : 'rgba(0,102,255,.2)'}, 0 0 40px ${V === 'whatsapp' ? 'rgba(37,211,102,.6)' : 'rgba(0,102,255,.9)'}`; });
    const say = (sel, t0, t1) => {
      const ls = $$(`${sel} .ln`);
      const h = ls.length * 41;
      $(sel).style.top = `${300 - h / 2 - 2}px`;
      ls.forEach((l, k) => blurIn(l, t0 + k * 0.1, { y: 26 }, 0.6));
      if (t1) ls.forEach((l, k) => blurOut(l, t1 + k * 0.04, { y: -20 }, 0.35));
    };
    say('#say2', T2 + 1.45, T3 - 0.05);
    $$('.chip.c2').forEach((c, k) => {
      blurIn(c, T2 + 1.95 + k * 0.25, { scale: 0.7, y: 20 }, 0.6);
      fx(0, DURATION, (p, t) => { c.style.translate = `0 ${Math.sin(t * 1.3 + k * 2.1) * 7}px`; });
      blurOut(c, T3 - 0.05 + k * 0.05, { scale: 0.8 }, 0.35);
    });

    /* ---------- escena 3 · tarjetas ---------- */
    tl.set('#cardsWrap', { opacity: 1 }, T3 + 0.2);
    tl.fromTo('#strip', { x: 900, filter: 'blur(16px)' }, { x: 50, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', immediateRender: false }, T3 + 0.25);
    tl.to('#strip', { x: -560, duration: T4 - 0.2 - (T3 + 1.15), ease: 'sine.inOut' }, T3 + 1.15);
    $$('.card .cap').forEach((c, k) => blurIn(c, T3 + 0.8 + k * 0.42, { y: 16, scale: 0.85 }, 0.5));
    say('#say3', T3 + 0.55, T4 - 0.25);
    tl.to('#strip', { x: -1500, filter: 'blur(16px)', duration: 0.55, ease: 'power3.in' }, T4 - 0.2);
    tl.to(['#hline', '#vline', '#circ'], { opacity: 0, duration: 0.4 }, T4 - 0.1);

    /* ---------- escena 4 · píldoras y mosaico ---------- */
    $$('.pill').forEach((p, k) => {
      const t0 = T4 + 0.25 + k * 0.3;
      tl.fromTo(p, { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.6)', immediateRender: false }, t0);
      tl.fromTo($('span', p), { clipPath: 'inset(0 100% 0 0)', filter: 'blur(8px)' }, { clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', immediateRender: false }, t0 + 0.12);
      fx(0, DURATION, (pp, t) => { p.style.translate = `0 ${Math.sin(t * 1.4 + k) * 5}px`; });
      blurOut(p, TT - 0.15 + k * 0.04, { scale: 0.9, x: -40 }, 0.4);
    });
    // el desenfoque va aparte: con el rebote de back.out quedaría negativo (inválido) y se congelaría
    tl.fromTo('#tile', { opacity: 0, scale: 0.35, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.5)', immediateRender: false }, TT);
    tl.fromTo('#tile', { filter: 'blur(20px)' }, { filter: 'blur(0px)', duration: 0.55, ease: 'power2.out', immediateRender: false }, TT);
    fx(TT + 0.7, 0.6, (p) => { $('#tile').style.translate = `0 ${-Math.sin(p * Math.PI) * 8}px`; });
    tl.to('#tile', { scale: 2.4, opacity: 0, filter: 'blur(18px)', duration: 0.45, ease: 'power3.in' }, TE - 0.3);

    /* ---------- escena 5 · imagen final ---------- */
    blurIn('#endT', TE - 0.1, { y: -24 }, 0.6);
    tl.fromTo('#endPill', { opacity: 0, scale: 1.25, filter: 'blur(18px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', immediateRender: false }, TE - 0.05);
    tl.from($$('#endPill svg > *'), { y: 30, opacity: 0, duration: 0.45, stagger: 0.03, ease: 'back.out(2)' }, TE + 0.15);
    tl.fromTo('#endFab', { opacity: 0, y: 30, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(2)', immediateRender: false }, TE + 0.6);
    blurIn('#endGob', TE + 0.85, { y: 16 }, 0.5);
    fx(TE + 0.6, DURATION, (p, t) => { $('#endPill').style.translate = `0 ${Math.sin((t - TE - 0.6) * 2.4) * 3}px`; });

    if (V === 'whatsapp') chatWA();
    tl.set({}, {}, DURATION);
  }

  /* ------------------------------------------------------------ chat de WhatsApp dentro del teléfono */
  function chatWA() {
    const wa = $('#wa');
    const scr = $('.ph .scr');
    const s = scr.clientWidth / 390;
    wa.style.transform = `scale(${s})`;
    wa.style.height = `${scr.clientHeight / s}px`;
    const viewH = scr.clientHeight / s - 100 - 70;
    const msgs = $('#waMsgs'), typing = $('#waTyping');
    gsap.set(['#waMsgs .wa-row', typing], { opacity: 0 });
    let y = 0;
    const show = (el, t) => {
      el = $(el);
      const target = Math.min(0, viewH - (el.offsetTop + el.offsetHeight + 12));
      if (target < y - 0.5) { tl.to(msgs, { y: target, duration: 0.45, ease: 'power2.out' }, t); y = target; }
    };
    const pop = (el, t, from = 'left') => {
      tl.fromTo(el, { opacity: 0, y: 14, scale: 0.94, transformOrigin: `${from} bottom` }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.6)', immediateRender: false }, t);
      show(el, t);
    };
    const typingAt = (after, t0, t1) => {
      after = $(after);
      const top = after.offsetTop + after.offsetHeight + 8;
      tl.set(typing, { top }, t0);
      const need = viewH - (top + 46);
      if (need < y - 0.5) { tl.to(msgs, { y: need, duration: 0.35, ease: 'power2.out' }, t0); y = need; }
      tl.fromTo(typing, { opacity: 0, scale: 0.8, transformOrigin: 'left bottom' }, { opacity: 1, scale: 1, duration: 0.2, immediateRender: false }, t0);
      tl.to(typing, { opacity: 0, duration: 0.08 }, t1 - 0.05);
      fx(t0, t1 - t0, (p, t) => { $$('i', typing).forEach((d, k) => { d.style.transform = `translateY(${-4 * Math.max(0, Math.sin(t * 9 - k * 0.9))}px)`; }); });
      fx(0, 0, (p, t) => { if (t >= t0 && t < t1) $('#waEstado').textContent = 'escribiendo…'; });
    };
    fx(0, 0, () => { $('#waEstado').textContent = 'en línea'; });
    // lo que se escribe en el campo
    const segs = [{ text: 'Hola', start: 0.9, dur: 0.3, clear: 1.45 }, { text: '0123-4567', start: 5.55, dur: 0.7, clear: 6.45 }];
    fx(0, 0, (p, t) => {
      let txt = '', on = false;
      for (const g of segs) if (t >= g.start && t < g.clear) { on = true; txt = g.text.slice(0, Math.round(clamp((t - g.start) / g.dur) * g.text.length)); }
      $('#waTxt').textContent = txt;
      $('#waPh').style.display = on ? 'none' : '';
    });
    pop('#m0', 1.45, 'right');
    typingAt('#m0', 1.75, 2.3);
    pop('#m1', 2.3);
    typingAt('#m1', 2.75, 3.3);
    pop('#m2', 3.3);
    tl.set('#bOk', { className: 'on' }, 4.3);
    pop('#m3', 4.45, 'right');
    typingAt('#m3', 4.75, 5.2);
    pop('#m4', 5.2);
    pop('#m5', 6.45, 'right');
    typingAt('#m5', 6.75, 7.25);
    pop('#m6', 7.25);
    tl.set('#bEnviar', { className: 'on' }, 8.35);
    pop('#m7', 8.5, 'right');
    typingAt('#m7', 8.8, 9.3);
    pop('#m8', 9.3);
  }

  /* ------------------------------------------------------------ reloj y vista previa */
  let current = 0;
  function seek(t) {
    current = clamp(t, 0, DURATION);
    tl.time(current, false);
    runFX(current);
  }
  window.__seek = seek;
  window.__duration = DURATION;
  window.__fps = FPS;
  window.__size = [W, HH];

  function fit() {
    if (RENDER) return;
    const ui = 52;
    const s = Math.min(innerWidth / W, (innerHeight - ui) / HH);
    const st = $('#stage');
    st.style.transform = `scale(${s})`;
    st.style.left = `${(innerWidth - W * s) / 2}px`;
    st.style.top = `${(innerHeight - ui - HH * s) / 2}px`;
  }

  async function init() {
    const svg = await fetch('assets/logo-inline.svg').then((r) => r.text());
    window.__logo = svg.replaceAll('#1C1E4D', '#FFFFFF');
    await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Manrope Variable"`)));
    await document.fonts.ready;
    build();
    await Promise.all($$('img').map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
    seek(0);
    window.__ready = true;
    if (!RENDER) startPreview();
  }

  function startPreview() {
    fit();
    addEventListener('resize', fit);
    const scrub = $('#scrub'), tc = $('#time');
    scrub.max = DURATION;
    let clock = null;
    const playFrom = (t0) => { const p0 = performance.now(); clock = () => t0 + (performance.now() - p0) / 1000; };
    $('#play').onclick = () => playFrom(current >= DURATION ? 0 : current);
    scrub.oninput = () => { clock = null; seek(+scrub.value); };
    addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (clock) clock = null; else playFrom(current); } });
    const loop = () => {
      if (clock) { let t = clock(); if (t >= DURATION) { t = DURATION; clock = null; } seek(t); scrub.value = t; }
      tc.textContent = `${current.toFixed(2)} s`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  init();
})();
