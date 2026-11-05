/* Simple.sv · Tu trámite por WhatsApp — video tutorial 1080x1920 (o 1920x1080 con ?format=h)
 * Todo es función del tiempo: window.__seek(t) deja el cuadro exacto, lo que permite renderizar
 * cuadro por cuadro. Las escenas se acomodan a la locución (voz/voz.js, generada con voz.py). */
(() => {
  const Q = new URLSearchParams(location.search);
  const FPS = Number(Q.get('fps')) || 30;
  const RENDER = Q.has('render');
  if (RENDER) document.body.classList.add('render');
  const HORIZ = Q.get('format') === 'h';
  if (HORIZ) document.body.classList.add('fmt-h');
  const W = HORIZ ? 1920 : 1080;
  const HH = HORIZ ? 1080 : 1920;
  // en render el canvas de fondo sigue la escala del dispositivo (supermuestreo)
  const SS = RENDER ? (window.devicePixelRatio || 1) : 1;
  const DURATION = 78;

  // Inicio de cada escena y de su frase de locución
  const SC = { intro: 0, p1: 10, p2: 19, p3: 29, p4: 38.8, p5: 49.5, p6: 57.5, cierre: 67.5 };
  const NARRA = Object.keys(SC).map((id) => ({ id, t: SC[id] + (id === 'intro' ? 0.8 : 0.6), d: (window.VOZ || {})[id] || 0 }));
  window.NARRA = NARRA;

  // Momentos que usa la banda sonora
  const CUES = { whoosh: [], swoosh: [], pop: [], tap: [], type: [], chime: [], ding: [], thump: [] };
  window.CUES = CUES;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Efectos propios evaluados en cada cuadro (tecleo, cursor, puntos de "escribiendo"…)
  const FX = [];
  const fx = (start, dur, fn) => FX.push({ start, dur, fn });
  const runFX = (t) => { for (const f of FX) f.fn(f.dur > 0 ? clamp((t - f.start) / f.dur) : t >= f.start ? 1 : 0, t); };

  /* ------------------------------------------------------------ íconos (trazo de 24 px) */
  const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
  const ICON = {
    search: S('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>'),
    user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>'),
    spark: S('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
    grid: S('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
    file: S('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    x: S('<path d="M6 6l12 12M18 6 6 18"/>'),
    star: S('<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
    brief: S('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18"/>'),
    idcard: S('<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.3"/><path d="M5.5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 10h4.5M14 13.5h3"/>'),
    house: S('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>'),
    cap: S('<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5v5"/>'),
    shield: S('<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>'),
    chev: S('<path d="m9 6 6 6-6 6"/>'),
    chevd: S('<path d="m6 9 6 6 6-6"/>'),
    arrow: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    wa: S('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><g transform="translate(7.3 7.3) scale(.4)" stroke-width="4.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></g>'),
    mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    send: S('<path d="M21 3 3.5 10.5l7 2.5 2.5 7z"/><path d="M21 3 10.5 13"/>'),
    lock: S('<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    card: S('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>'),
    bell: S('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    download: S('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    back: S('<path d="m15 5-7 7 7 7"/>'),
    video: S('<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>'),
    phone: S('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>'),
    verified: S('<path d="M12 2.5 14.4 4.6l3.1-.3.8 3 2.7 1.6-1.2 2.9 1.2 2.9-2.7 1.6-.8 3-3.1-.3L12 21.5l-2.4-2.1-3.1.3-.8-3-2.7-1.6L4.2 12 3 9.1l2.7-1.6.8-3 3.1.3z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    read: S('<path d="m2 12.5 4 4L13.5 8M10.5 16l1 .5L19 8"/>'),
    face: S('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16c1.4 1 3.6 1 5 0"/>'),
    check: S('<path d="m5 12.5 4.5 4.5L19 7"/>', ' stroke-width="2.6"'),
    wifi: S('<path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/>'),
    mail: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
    folder: S('<path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m9 13.5 2.2 2.2L15.5 11"/>'),
    globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"/>'),
    chat: S('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z"/><path d="M8.5 10.5h7M8.5 14h4.5"/>'),
    robotmini: S('<rect x="4" y="7" width="16" height="12" rx="5"/><path d="M12 7V4M9.5 12v1.5M14.5 12v1.5M2 12v3M22 12v3"/><circle cx="12" cy="3.5" r="1"/>'),
  };

  // Robot del asistente (piezas de src/assets/brand/simple-robot-asistente.svg, sin el fondo)
  const ROBOT = `<svg viewBox="150 90 724 800"><defs>
      <linearGradient id="RHEAD" x1="512" y1="300" x2="512" y2="730" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4EEFC"/></linearGradient>
      <linearGradient id="RVISOR" x1="512" y1="400" x2="512" y2="650" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1C1E4D"/><stop offset="1" stop-color="#253272"/></linearGradient>
      <clipPath id="RBODY"><path d="M356 742 H668 V800 Q668 868 600 868 H424 Q356 868 356 800 Z"/></clipPath>
    </defs>
    <g class="r-all">
      <rect x="496" y="196" width="32" height="130" rx="16" fill="#fff" stroke="#DCE6F5" stroke-width="4"/>
      <circle class="r-glow" cx="512" cy="168" r="58" fill="#9FD8FF" opacity=".55"/>
      <circle cx="512" cy="168" r="30" fill="#fff" stroke="#9FD8FF" stroke-width="10"/>
      <rect x="184" y="456" width="76" height="170" rx="38" fill="#0066FF"/><rect x="764" y="456" width="76" height="170" rx="38" fill="#0066FF"/>
      <rect x="200" y="490" width="30" height="102" rx="15" fill="#9FD8FF" opacity=".85"/><rect x="794" y="490" width="30" height="102" rx="15" fill="#9FD8FF" opacity=".85"/>
      <path d="M356 742 H668 V800 Q668 868 600 868 H424 Q356 868 356 800 Z" fill="#fff" stroke="#DCE6F5" stroke-width="4"/>
      <g clip-path="url(#RBODY)"><rect x="356" y="780" width="312" height="26" fill="#1C53C0"/><rect x="356" y="822" width="312" height="26" fill="#0066FF"/></g>
      <rect x="232" y="318" width="560" height="430" rx="150" fill="url(#RHEAD)" stroke="#DCE6F5" stroke-width="4"/>
      <rect x="290" y="392" width="444" height="272" rx="112" fill="url(#RVISOR)"/>
      <g class="r-eyes">
        <rect x="394" y="470" width="72" height="98" rx="36" fill="#9FD8FF"/><rect x="558" y="470" width="72" height="98" rx="36" fill="#9FD8FF"/>
        <circle cx="418" cy="498" r="14" fill="#fff"/><circle cx="582" cy="498" r="14" fill="#fff"/>
      </g>
      <path class="r-smile" d="M458 606 Q512 646 566 606" stroke="#9FD8FF" stroke-width="20" stroke-linecap="round" fill="none"/>
      <circle cx="332" cy="612" r="16" fill="#0066FF" opacity=".9"/><circle cx="692" cy="612" r="16" fill="#0066FF" opacity=".9"/>
    </g></svg>`;

  const STEPS = [
    { t: 'Pide ayuda al <span class="hl">asistente</span>', s: 'Toca <b>«¿Necesitas ayuda?»</b> en Simple.sv' },
    { t: 'Busca tu <span class="hl">trámite</span>', s: 'Escribe, por ejemplo, <b>«solvencia de agua»</b>' },
    { t: 'Llévalo por <span class="hw">WhatsApp</span>', s: 'Inicia sesión con tu <b>Identidad Digital</b>' },
    { t: 'Responde en el <span class="hw">chat</span>', s: 'Te pedimos los datos <b>uno por uno</b>' },
    { t: 'Revisa y <span class="hl">paga en línea</span>', s: 'Pago seguro con <b>tarjeta de crédito o débito</b>' },
    { t: 'Recibe tu <span class="hl">documento</span>', s: 'Te avisamos por <b>WhatsApp y por correo</b>' },
  ];
  const STEP_AT = [SC.p1, SC.p2, SC.p3, SC.p4, SC.p5, SC.p6];

  /* ------------------------------------------------------------ fondo vivo (líneas de flujo de la landing) */
  const bgCtx = $('#bg').getContext('2d');
  const rnd = mulberry32(11);
  const FLOWS = Array.from({ length: 6 }, (_, i) => {
    const y0 = (HH / 6) * (i + 0.5) + (rnd() - 0.5) * 120;
    return { y0, y1: y0 + (rnd() - 0.5) * 420, a: 60 + rnd() * 120, sp: 40 + rnd() * 60, ph: rnd() * 6.28, dash: 90 + rnd() * 140, gap: 220 + rnd() * 200 };
  });
  const BLOBS = [
    { x: 0.15, y: 0.18, r: 620, c: '0,102,255', a: 0.10, sx: 0.07, sy: 0.05 },
    { x: 0.9, y: 0.45, r: 700, c: '159,216,255', a: 0.42, sx: 0.05, sy: 0.08 },
    { x: 0.3, y: 0.85, r: 760, c: '0,102,255', a: 0.07, sx: 0.06, sy: 0.04 },
  ];
  function drawBG(t) {
    const g = bgCtx;
    g.setTransform(SS, 0, 0, SS, 0, 0);
    const lg = g.createLinearGradient(0, 0, 0, HH);
    lg.addColorStop(0, '#FAFCFF'); lg.addColorStop(1, '#EAF1FC');
    g.fillStyle = lg; g.fillRect(0, 0, W, HH);
    for (const b of BLOBS) {
      const x = W * b.x + Math.sin(t * b.sx * 6.28) * 90, y = HH * b.y + Math.cos(t * b.sy * 6.28) * 110;
      const rg = g.createRadialGradient(x, y, 0, x, y, b.r);
      rg.addColorStop(0, `rgba(${b.c},${b.a})`); rg.addColorStop(1, `rgba(${b.c},0)`);
      g.fillStyle = rg; g.fillRect(0, 0, W, HH);
    }
    g.fillStyle = 'rgba(0,102,255,0.07)';
    for (let y = 24; y < HH; y += 48) for (let x = 24; x < W; x += 48) g.fillRect(x - 1.5, y - 1.5, 3, 3);
    for (const f of FLOWS) {
      const wob = Math.sin(t * 0.35 + f.ph) * 40;
      const path = () => { g.beginPath(); g.moveTo(-60, f.y0); g.bezierCurveTo(W * 0.35, f.y0 - f.a + wob, W * 0.65, f.y1 + f.a - wob, W + 60, f.y1); };
      path(); g.setLineDash([]); g.strokeStyle = 'rgba(0,102,255,0.07)'; g.lineWidth = 2; g.stroke();
      path(); g.setLineDash([f.dash, f.gap]); g.lineDashOffset = -t * f.sp; g.strokeStyle = 'rgba(0,102,255,0.22)'; g.lineWidth = 2.5; g.stroke();
    }
    g.setLineDash([]);
    FLOWS.forEach((f, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + i);
      const x = i % 2 ? W - 70 : 70, y = i % 2 ? f.y1 : f.y0;
      g.fillStyle = `rgba(159,216,255,${0.25 + pulse * 0.35})`; g.beginPath(); g.arc(x, y, 14 + pulse * 8, 0, 6.29); g.fill();
      g.fillStyle = 'rgba(0,102,255,0.55)'; g.beginPath(); g.arc(x, y, 5, 0, 6.29); g.fill();
    });
  }
  $('#bg').width = W * SS; $('#bg').height = HH * SS;

  /* ------------------------------------------------------------ utilidades de animación */
  function splitChars(el) {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w'; w.style.display = 'inline-block';
            for (const c of part) {
              const s = document.createElement('span');
              s.textContent = c; s.style.display = 'inline-block';
              w.appendChild(s); out.push(s);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && !n.matches('i[data-i]')) walk(n);
      });
    };
    walk(el);
    return out;
  }

  // Posición de un elemento dentro de la pantalla del teléfono (unidades de .ui)
  function posIn(el, root) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  /* ------------------------------------------------------------ construcción */
  let tl;

  function build() {
    // íconos, logos y robots
    $$('i[data-i]').forEach((i) => { i.innerHTML = ICON[i.dataset.i] || ''; });
    $$('[data-logo]').forEach((d) => { d.innerHTML = window.__logo; });
    $$('[data-robot]').forEach((d) => { d.innerHTML = ROBOT; });

    // encabezados de cada paso
    const head = $('#head');
    head.innerHTML = STEPS.map((s, i) => `<div class="hstep" id="hs${i + 1}"><div class="eyebrow"><span class="pill">PASO ${i + 1}</span></div><h2 class="htitle">${s.t}</h2><p class="hsub">${s.s}</p></div>`).join('');
    $('#ghost').innerHTML = STEPS.map((_, i) => `<span id="gh${i + 1}">${i + 1}</span>`).join('');
    // el título se achica si no cabe en una línea
    // (en horizontal el título ocupa dos líneas, no hace falta achicarlo)
    if (!HORIZ) $$('.htitle').forEach((h) => { const max = head.offsetWidth; if (h.scrollWidth > max) h.style.fontSize = `${74 * max / h.scrollWidth}px`; });

    // (sin escala en la vista previa todavía: fit() se aplica después de construir)
    const dotRects = $$('#introSteps .dots b').map((d) => d.getBoundingClientRect());
    const barRects = $$('#progBar i').map((d) => d.getBoundingClientRect());

    tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const ui = $('.ui');
    const T = (sel) => (typeof sel === 'string' ? $(sel) : sel);

    // estados iniciales
    gsap.set(['#hud', '#head', '#ghost', '#phoneWrap', '#cloud', '#outro', '.hstep', '#ghost span'], { opacity: 0 });
    gsap.set(['#scrBot', '#scrLogin', '#scrWA'], { visibility: 'hidden' });
    gsap.set(['.bt-row', '.wa-row', '.wa-day', '#ldGlobo', '.ld-fabs .fab', '#waNotif', '#lgOk', '#lgCheck', '#payOk'], { opacity: 0 });
    gsap.set('#progBar i', { '--f': 0 });

    /* ---------- toque en pantalla ---------- */
    const tap = $('#tap');
    let tapPos = { x: 300, y: 700 };
    gsap.set(tap, { x: tapPos.x, y: tapPos.y });
    function tapAt(t, x, y, lead = 0.5) {
      tl.to(tap, { opacity: 1, duration: 0.2 }, t - lead);
      tl.fromTo(tap, { x: tapPos.x, y: tapPos.y }, { x, y, duration: lead * 0.85, ease: 'power2.inOut', immediateRender: false }, t - lead);
      tl.to(tap, { scale: 0.78, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, t);
      tl.fromTo($('i', tap), { scale: 0.6, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, t);
      tl.to(tap, { opacity: 0, duration: 0.25 }, t + 0.35);
      tapPos = { x, y };
      CUES.tap.push(t);
    }
    // centro de un elemento dentro de .ui, descontando el desplazamiento del chat en ese momento
    const centerOf = (el, dy = 0) => { const p = posIn(T(el), ui); return { x: p.x + p.w / 2, y: p.y + p.h / 2 + dy }; };

    /* ---------- texto que se escribe ---------- */
    // segs: [{ text, start, dur, clear, sfx }] — entre start y clear el campo muestra el texto que se va escribiendo
    function field(el, ph, segs) {
      el = T(el);
      fx(0, 0, (p, t) => {
        let s = '', active = false;
        for (const g of segs) {
          if (t >= g.start && t < (g.clear ?? Infinity)) { active = true; s = g.text.slice(0, Math.round(clamp((t - g.start) / g.dur) * g.text.length)); }
        }
        el.textContent = s;
        if (ph) T(ph).style.display = active ? 'none' : '';
      });
      segs.forEach((g) => { if (g.sfx !== false) for (let k = 0; k < g.text.length; k++) CUES.type.push(g.start + (k + 0.5) * (g.dur / g.text.length)); });
    }
    const caretBlink = (el, from, to) => fx(0, 0, (p, t) => { T(el).style.opacity = t >= from && t < to && Math.floor((t - from) * 2.4) % 2 === 0 ? 1 : 0; });

    /* ---------- burbujas de chat ---------- */
    const pop = (el, t, from = 'left') => {
      tl.fromTo(T(el), { opacity: 0, y: 16, scale: 0.94, transformOrigin: `${from} bottom` }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'back.out(1.6)', immediateRender: false }, t);
      CUES.pop.push(t);
    };
    function makeChat(msgsSel, viewH, typingSel) {
      const msgs = $(msgsSel), typing = $(typingSel);
      gsap.set(typing, { opacity: 0 });
      let y = 0;
      const api = {
        get y() { return y; },
        // desplaza el chat para que el elemento quede completo arriba de la barra de escribir
        show(el, t) {
          el = T(el);
          const bottom = el.offsetTop + el.offsetHeight + 14;
          const target = Math.min(0, viewH - bottom);
          if (target < y - 0.5) { tl.to(msgs, { y: target, duration: 0.5, ease: 'power2.out' }, t); y = target; }
        },
        // puntos de "escribiendo" justo debajo del último mensaje visible
        typing(after, t0, t1) {
          after = T(after);
          const top = after ? after.offsetTop + after.offsetHeight + 8 : 14;
          tl.set(typing, { top }, t0);
          const need = viewH - (top + 46);
          if (need < y - 0.5) { tl.to(msgs, { y: need, duration: 0.4, ease: 'power2.out' }, t0); y = need; }
          tl.fromTo(typing, { opacity: 0, scale: 0.8, transformOrigin: 'left bottom' }, { opacity: 1, scale: 1, duration: 0.2, immediateRender: false }, t0);
          tl.to(typing, { opacity: 0, duration: 0.1 }, t1 - 0.05);
          fx(t0, t1 - t0, (p, t) => {
            $$('i', typing).forEach((d, k) => { d.style.transform = `translateY(${-4 * Math.max(0, Math.sin(t * 9 - k * 0.9))}px)`; });
          });
        },
      };
      return api;
    }
    const bot = makeChat('#btMsgs', 847.5 - 104 - 74, '#btTyping');
    const wa = makeChat('#waMsgs', 847.5 - 104 - 70, '#waTyping');

    /* ---------- encabezado de paso ---------- */
    STEPS.forEach((_, i) => {
      const t = STEP_AT[i];
      const hs = $(`#hs${i + 1}`), gh = $(`#gh${i + 1}`);
      const words = splitChars($('.htitle', hs));
      tl.set(hs, { opacity: 1 }, t);
      tl.from($('.eyebrow', hs), { y: 30, opacity: 0, duration: 0.45 }, t + 0.05);
      tl.from(words, { y: 60, opacity: 0, rotationX: -70, transformOrigin: '50% 100%', duration: 0.55, stagger: 0.018, ease: 'back.out(1.7)' }, t + 0.12);
      tl.from($('.hsub', hs), { y: 24, opacity: 0, duration: 0.5 }, t + 0.45);
      tl.fromTo(gh, { opacity: 0, x: 120, scale: 0.85 }, { opacity: 1, x: 0, scale: 1, duration: 0.9, ease: 'expo.out', immediateRender: false }, t);
      tl.to($$('#progBar i')[i], { '--f': 1, duration: 0.7, ease: 'power2.inOut' }, t + 0.1);
      tl.set('#progN', { textContent: i + 1 }, t);
      const next = i < 5 ? STEP_AT[i + 1] : SC.cierre;
      tl.to(hs, { opacity: 0, y: -40, duration: 0.35, ease: 'power2.in' }, next - 0.35);
      tl.to(gh, { opacity: 0, x: -80, duration: 0.35, ease: 'power2.in' }, next - 0.35);
      if (i) CUES.swoosh.push(t - 0.2);
    });

    /* ================= INTRO 0–10 ================= */
    tl.fromTo('#introGlow', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6, ease: 'power2.out' }, 0);
    tl.fromTo('#robot', { y: -820, rotation: -10 }, { y: 0, rotation: 0, duration: 0.85, ease: 'power2.in' }, 0.1);
    tl.to('#robot', { scaleY: 0.86, scaleX: 1.1, transformOrigin: '50% 100%', duration: 0.1, ease: 'power1.out' }, 0.95);
    tl.to('#robot', { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 1.05);
    CUES.thump.push(0.95);
    tl.fromTo('#hi', { scale: 0, rotation: -12, transformOrigin: '0% 100%' }, { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }, 1.25);
    CUES.pop.push(1.25);
    fx(1.4, 3, (p, t) => { $('#hi span').style.transform = `rotate(${Math.sin(t * 14) * 18 * (1 - p)}deg)`; $('#hi span').style.display = 'inline-block'; });
    const logoParts = $$('#introLogo svg > *');
    tl.from(logoParts, { y: 40, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'back.out(2)' }, 2.1);
    tl.from(logoParts.slice(-3), { x: 70, duration: 0.6, stagger: 0.06, ease: 'expo.out' }, 2.5);
    const t1 = splitChars($('#introT .l1'));
    const t2 = splitChars($('#introT .l2'));
    tl.from(t1, { y: 120, opacity: 0, rotationX: -80, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.035, ease: 'back.out(1.8)' }, 3.4);
    tl.from(t2, { y: 120, opacity: 0, rotationX: -80, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.03, ease: 'back.out(1.8)' }, 4.1);
    tl.from('#introT .wa-word > i', { scale: 0, rotation: -120, duration: 0.6, ease: 'back.out(2.4)' }, 4.5);
    CUES.pop.push(4.5);
    const intLine = $('#introLine path');
    tl.fromTo(intLine, { strokeDashoffset: 860, strokeDasharray: '860 860' }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 6.3);
    tl.set(intLine, { strokeDasharray: '10 14' }, 7.2);
    $$('#introSteps .dots b').forEach((d, k) => {
      tl.from(d, { scale: 0, y: 40, duration: 0.5, ease: 'back.out(2.6)' }, 6.4 + k * 0.13);
      CUES.pop.push(6.4 + k * 0.13);
    });
    tl.from('#introSteps p', { y: 30, opacity: 0, duration: 0.5 }, 7.2);
    fx(0, DURATION, (p, t) => { if (t > 7.2) $('#introLine path').style.strokeDashoffset = -t * 30; });
    // los seis pasos vuelan a la barra de progreso
    const dotsEl = $$('#introSteps .dots b');
    const pb = $$('#progBar i');
    tl.set('#hud', { opacity: 1 }, 9.0);
    tl.from('#hudLogo', { y: -40, opacity: 0, duration: 0.5 }, 9.2);
    tl.from('#progTxt', { y: -30, opacity: 0, duration: 0.5 }, 9.5);
    tl.from(pb, { scaleX: 0, duration: 0.4, stagger: 0.05, transformOrigin: '0 50%' }, 9.45);
    dotsEl.forEach((d, k) => {
      const a = dotRects[k], b = barRects[k];
      tl.to(d, { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2),
        scale: 0.12, duration: 0.65, ease: 'power3.in' }, 8.95 + k * 0.04);
      tl.to(d, { opacity: 0, duration: 0.1 }, 9.55 + k * 0.04);
    });
    tl.to(['#robot', '#hi', '#introLogo'], { y: -200, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power2.in' }, 9.0);
    tl.to(['#introT', '#introSteps p', '#introLine', '#introGlow'], { y: -160, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power2.in' }, 9.1);
    CUES.whoosh.push(9.0);

    /* ================= PASO 1 · asistente 10–19 ================= */
    tl.set(['#head', '#ghost'], { opacity: 1 }, SC.p1);
    tl.fromTo('#phoneWrap', { opacity: 0, y: 1300, rotationX: 30, scale: 0.9, transformPerspective: 2400 }, { opacity: 1, y: 0, rotationX: 0, scale: 1, duration: 1.0, ease: 'expo.out', immediateRender: false }, 10.1);
    CUES.whoosh.push(10.1);
    tl.from(['.ld-head', '.ld-chip', '.ld-hero h3', '.ld-search'], { y: 26, opacity: 0, duration: 0.5, stagger: 0.08 }, 10.6);
    tl.from('.ld-card', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1 }, 11.0);
    $$('.ld-fabs .fab').forEach((f, k) => {
      tl.fromTo(f, { opacity: 0, scale: 0.4, x: 40 }, { opacity: 1, scale: 1, x: 0, duration: 0.55, ease: 'back.out(2)', immediateRender: false }, 11.9 + k * 0.15);
      CUES.pop.push(11.9 + k * 0.15);
    });
    tl.fromTo('#ldGlobo', { opacity: 0, scale: 0.6, transformOrigin: '100% 100%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, 12.5);
    CUES.pop.push(12.5);
    tl.to('#fabBot', { scale: 1.07, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 12.9);
    { const c = centerOf('#fabBot'); tapAt(14.4, c.x - 40, c.y); }
    tl.to('#ldGlobo', { opacity: 0, duration: 0.2 }, 14.5);
    tl.to('#ldDim', { opacity: 1, duration: 0.4 }, 14.6);
    tl.set('#scrBot', { visibility: 'visible' }, 14.6);
    tl.fromTo('#scrBot', { y: 847 }, { y: 0, duration: 0.6, ease: 'expo.out', immediateRender: false }, 14.6);
    CUES.swoosh.push(14.6);
    bot.typing(null, 15.2, 15.8);
    pop('#b1', 15.8);
    bot.typing('#b1', 16.2, 16.7);
    pop('#b2', 16.7);
    tl.from('#b2 .bt-cats span', { opacity: 0, y: 12, scale: 0.9, duration: 0.35, stagger: 0.07, ease: 'back.out(2)' }, 16.95);

    /* ================= PASO 2 · buscar 19–29 ================= */
    tl.set('#cloud', { opacity: 1 }, 19.2);
    $$('#cloud .tag').forEach((g, k) => {
      const t = 19.3 + k * 0.08;
      tl.fromTo(g, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)', immediateRender: false }, t);
      fx(t, 3, (p, tt) => { g.style.translate = `0 ${Math.sin(tt * 2 + k) * 10}px`; });
      if (g.id !== 'tagHot') tl.to(g, { opacity: 0, scale: 0.6, x: k > 3 ? 120 : -120, duration: 0.45, ease: 'power2.in' }, 21.7 + k * 0.03);
    });
    tl.to('#tagHot', { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1 }, 21.0);
    // la píldora elegida vuela al campo de escribir del asistente (en horizontal se mide, el teléfono está a la derecha)
    const hotTo = HORIZ ? (() => {
      const a = $('#tagHot').getBoundingClientRect(), b = $('#btField').getBoundingClientRect();
      return { x: b.left + b.width * 0.35 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2) };
    })() : { x: -280, y: 700 };
    tl.to('#tagHot', { x: hotTo.x, y: hotTo.y, scale: 0.4, opacity: 0, duration: 0.6, ease: 'power3.in' }, 21.75);
    tl.set('#btField', { className: 'bt-field focus' }, 19.6);
    field('#btTxt', '#btPh', [{ text: 'solvencia de agua', start: 20.0, dur: 1.5, clear: 21.9 }]);
    caretBlink('#btCaret', 19.6, 21.9);
    { const c = centerOf('#btSend'); tapAt(21.8, c.x, c.y); }
    tl.to('#btSend', { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, 21.8);
    tl.set('#btField', { className: 'bt-field' }, 21.9);
    pop('#u1', 21.95, 'right');
    bot.show('#u1', 21.95);
    bot.typing('#u1', 22.3, 23.0);
    pop('#b3', 23.0);
    bot.show('#b3', 23.0);
    tl.from('#b3 .bt-res', { opacity: 0, x: -20, duration: 0.35, stagger: 0.12 }, 23.2);
    { const c = centerOf('#res1', bot.y); tapAt(25.6, c.x, c.y); }
    tl.set('#res1', { className: 'bt-res sel' }, 25.6);

    /* ================= PASO 3 · WhatsApp + Identidad Digital 29–38.8 ================= */
    pop('#u2', 29.3, 'right');
    bot.show('#u2', 29.3);
    bot.typing('#u2', 29.6, 30.2);
    pop('#b4', 30.2);
    bot.show('#b4', 30.2);
    tl.from(['#b4 .bt-pasos', '#b4 .bt-q', '#b4 .bt-btn', '#b4 .bt-note'], { opacity: 0, y: 12, duration: 0.35, stagger: 0.1 }, 30.45);
    tl.to('#btnLlevar', { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 31.2);
    { const c = centerOf('#btnLlevar', bot.y); tapAt(31.9, c.x, c.y); }
    tl.set('#btnLlevar', { className: 'bt-btn wa on' }, 31.9);
    tl.set('#scrLogin', { visibility: 'visible' }, 32.3);
    tl.fromTo('#scrLogin', { x: 390 }, { x: 0, duration: 0.6, ease: 'expo.out', immediateRender: false }, 32.3);
    tl.to('#scrBot', { x: -120, duration: 0.6, ease: 'expo.out' }, 32.3);
    CUES.swoosh.push(32.3);
    tl.from(['.lg-top', '.lg-badge', '.lg-card h4', '.lg-card p'], { opacity: 0, y: 18, duration: 0.4, stagger: 0.07 }, 32.55);
    const ins = $$('.lg-in');
    tl.set(ins[0], { className: 'lg-in focus' }, 33.1);
    field('#lgDui', null, [{ text: '01234567-8', start: 33.25, dur: 0.85 }]);
    caretBlink('#lgCaret1', 33.1, 34.15);
    tl.set(ins[0], { className: 'lg-in' }, 34.15);
    tl.set(ins[1], { className: 'lg-in focus' }, 34.15);
    field('#lgPass', null, [{ text: '••••••••', start: 34.3, dur: 0.6 }]);
    caretBlink('#lgCaret2', 34.15, 35.1);
    tl.set(ins[1], { className: 'lg-in' }, 35.1);
    { const c = centerOf('#lgBtn'); tapAt(35.2, c.x, c.y); }
    tl.to('#lgBtn', { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, 35.2);
    tl.to('#lgOk', { opacity: 1, duration: 0.3 }, 35.45);
    const ring = $('#lgRing');
    const RL = 2 * Math.PI * 86;
    gsap.set(ring, { strokeDasharray: RL, strokeDashoffset: RL });
    tl.to(ring, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut' }, 35.55);
    fx(35.5, 1.1, (p, t) => { $('#lgFace').style.transform = `scale(${1 + Math.sin(t * 10) * 0.04})`; });
    tl.to('#lgFace', { opacity: 0, scale: 0.5, duration: 0.2 }, 36.55);
    tl.fromTo('#lgCheck', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.6)', immediateRender: false }, 36.6);
    tl.to(ring, { stroke: '#059669', duration: 0.2 }, 36.55);
    CUES.chime.push(36.6);
    tl.from(['#lgOkT', '#lgOkS'], { opacity: 0, y: 14, duration: 0.4, stagger: 0.12 }, 36.75);

    /* ================= PASO 4 · chat de WhatsApp 38.8–49.5 ================= */
    tl.set('#scrWA', { visibility: 'visible' }, 38.9);
    tl.fromTo('#scrWA', { clipPath: 'circle(0px at 195px 640px)' }, { clipPath: 'circle(980px at 195px 640px)', duration: 0.75, ease: 'power3.inOut', immediateRender: false }, 38.9);
    CUES.whoosh.push(38.9);
    tl.to('.wa-day:not(.later)', { opacity: 1, duration: 0.3 }, 39.5);
    field('#waTxt', '#waPh', [
      { text: 'Hola', start: 39.35, dur: 0.01, clear: 40.25, sfx: false },
      { text: '0123-4567', start: 47.7, dur: 0.75, clear: 48.85 },
    ]);
    caretBlink('#waCaret', 39.4, 40.2);
    { const c = centerOf('#waSend'); tapAt(40.15, c.x, c.y); }
    pop('#w0', 40.25, 'right');
    const estado = (t0, t1) => fx(0, 0, (p, t) => { if (t >= t0 && t < t1) $('#waEstado').textContent = 'escribiendo…'; });
    fx(0, 0, () => { $('#waEstado').textContent = 'en línea'; });
    wa.typing('#w0', 40.55, 41.1); estado(40.55, 41.1);
    pop('#w1', 41.1); wa.show('#w1', 41.1);
    wa.typing('#w1', 41.4, 41.9); estado(41.4, 41.9);
    pop('#w2', 41.9); wa.show('#w2', 41.9);
    wa.typing('#w2', 42.2, 42.7); estado(42.2, 42.7);
    pop('#w3', 42.7); wa.show('#w3', 42.7);
    tl.from('#w3 li', { opacity: 0, x: -12, duration: 0.3, stagger: 0.12 }, 42.9);
    wa.typing('#w3', 43.4, 43.8); estado(43.4, 43.8);
    pop('#w4', 43.8); wa.show('#w4', 43.8);
    { const c = centerOf('#waEmpezar', wa.y); tapAt(44.65, c.x, c.y); }
    tl.set('#waEmpezar', { className: 'on' }, 44.65);
    pop('#w5', 44.85, 'right'); wa.show('#w5', 44.85);
    wa.typing('#w5', 45.1, 45.55); estado(45.1, 45.55);
    pop('#w6', 45.55); wa.show('#w6', 45.55);
    { const c = centerOf('#waNatural', wa.y); tapAt(46.45, c.x, c.y); }
    tl.set('#waNatural', { className: 'on' }, 46.45);
    pop('#w7', 46.65, 'right'); wa.show('#w7', 46.65);
    wa.typing('#w7', 46.9, 47.3); estado(46.9, 47.3);
    pop('#w8', 47.3); wa.show('#w8', 47.3);
    caretBlink('#waCaret', 47.6, 48.75);
    { const c = centerOf('#waSend'); tapAt(48.75, c.x, c.y); }
    pop('#w9', 48.85, 'right'); wa.show('#w9', 48.85);

    /* ================= PASO 5 · revisar y pagar 49.5–57.5 ================= */
    wa.typing('#w9', 49.65, 50.05); estado(49.65, 50.05);
    pop('#w10', 50.05); wa.show('#w10', 50.05);
    { const c = centerOf('#waEnviar', wa.y); tapAt(51.0, c.x, c.y); }
    tl.set('#waEnviar', { className: 'on' }, 51.0);
    pop('#w11', 51.2, 'right'); wa.show('#w11', 51.2);
    wa.typing('#w11', 51.4, 51.8); estado(51.4, 51.8);
    pop('#w12', 51.8); wa.show('#w12', 51.8);
    { const c = centerOf('#waPagar', wa.y); tapAt(52.8, c.x, c.y); }
    tl.set('#waPagar', { className: 'on' }, 52.8);
    tl.to('#phoneWrap', { scale: 0.93, opacity: 0.45, duration: 0.5, ease: 'power2.out' }, 53.0);
    tl.fromTo('#pay', { opacity: 0, y: 160, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)', immediateRender: false }, 53.0);
    CUES.swoosh.push(53.0);
    tl.from('#cc', { rotationY: -100, transformPerspective: 1600, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(1.3)' }, 53.25);
    fx(53.9, 0.5, (p) => { $('#ccNum').textContent = '•••• •••• •••• ' + '4242'.slice(0, Math.round(p * 4)).padEnd(4, '•'); });
    for (let k = 0; k < 4; k++) CUES.type.push(53.95 + k * 0.12);
    tl.to('#payBtn', { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 }, 54.7);
    CUES.tap.push(54.7);
    tl.to('#payBtnT', { opacity: 0, duration: 0.15 }, 54.8);
    tl.to('#paySpin', { opacity: 1, duration: 0.15 }, 54.85);
    fx(54.85, 0.9, (p, t) => { $('#paySpin').style.transform = `rotate(${t * 520}deg)`; });
    tl.to('#payOk', { opacity: 1, duration: 0.25 }, 55.75);
    tl.from('#payOk span', { scale: 0.2, rotation: -40, duration: 0.55, ease: 'back.out(2.6)' }, 55.8);
    tl.from(['#payOk b', '#payOk small'], { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 }, 55.95);
    CUES.chime.push(55.8);
    tl.to('#pay', { opacity: 0, y: -120, scale: 0.9, duration: 0.45, ease: 'power2.in' }, 56.7);
    tl.to('#phoneWrap', { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, 56.8);
    pop('#w13', 57.1); wa.show('#w13', 57.1);

    /* ================= PASO 6 · aviso y documento 57.5–67.5 ================= */
    wa.typing('#w13', 57.7, 58.1); estado(57.7, 58.1);
    pop('#w14', 58.1); wa.show('#w14', 58.1);
    tl.fromTo('#clock', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, 59.0);
    CUES.swoosh.push(59.0);
    fx(59.1, 1.3, (p) => {
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      $('#hh').setAttribute('transform', `rotate(${e * 720} 100 100)`);
      $('#mm').setAttribute('transform', `rotate(${e * 720 * 12} 100 100)`);
    });
    for (let k = 0; k < 8; k++) CUES.type.push(59.15 + k * 0.15);
    tl.fromTo('#w15', { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 59.8);
    wa.show('#w15', 59.8);
    tl.to('#clock', { opacity: 0, scale: 0.6, duration: 0.35, ease: 'power2.in' }, 60.45);
    tl.fromTo('#waNotif', { opacity: 0, y: -90 }, { opacity: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', immediateRender: false }, 60.8);
    CUES.ding.push(60.85);
    pop('#w16', 61.5); wa.show('#w16', 61.5);
    tl.to('#waNotif', { opacity: 0, y: -90, duration: 0.4, ease: 'power2.in' }, 62.5);
    { const c = centerOf('#waDescargar', wa.y); tapAt(62.95, c.x, c.y); }
    tl.set('#waDescargar', { className: 'on' }, 62.95);
    tl.to('#phoneWrap', { x: -150, rotationY: 14, scale: 0.94, transformPerspective: 2400, duration: 0.7, ease: 'power3.inOut' }, 63.1);
    tl.fromTo('#doc', { opacity: 0, x: -260, y: 260, scale: 0.3, rotation: -18 }, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 5, duration: 0.85, ease: 'back.out(1.4)', immediateRender: false }, 63.25);
    CUES.whoosh.push(63.25);
    tl.from('#doc .ln', { scaleX: 0, transformOrigin: '0 50%', duration: 0.4, stagger: 0.07 }, 63.7);
    tl.fromTo('#seal', { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.in', immediateRender: false }, 64.25);
    CUES.thump.push(64.6); CUES.chime.push(64.6);
    tl.to('#doc', { y: -10, rotation: 4, duration: 0.15, yoyo: true, repeat: 1 }, 64.6);
    tl.fromTo('#mail', { opacity: 0, x: -200 }, { opacity: 1, x: 0, duration: 0.55, ease: 'back.out(1.6)', immediateRender: false }, 64.9);
    tl.fromTo('#folder', { opacity: 0, x: 200 }, { opacity: 1, x: 0, duration: 0.55, ease: 'back.out(1.6)', immediateRender: false }, 65.4);
    CUES.pop.push(64.9, 65.4);
    fx(65, 2.5, (p, t) => { $('#doc').style.translate = `0 ${Math.sin(t * 2.2) * 8}px`; });

    /* ================= CIERRE 67.5–78 ================= */
    tl.to('#phoneWrap', { y: 1500, rotationX: -20, duration: 0.7, ease: 'power3.in' }, 67.3);
    tl.to(['#doc', '#mail', '#folder'], { y: -1500, opacity: 0, duration: 0.7, stagger: 0.05, ease: 'power3.in' }, 67.3);
    tl.to(['#hud', '#head', '#ghost'], { opacity: 0, duration: 0.4 }, 67.5);
    CUES.whoosh.push(67.4);
    tl.set('#outro', { opacity: 1 }, 67.8);
    tl.fromTo('#robot2', { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.8)', immediateRender: false }, 67.9);
    CUES.pop.push(67.9);
    const obs = $$('#orbit .ob');
    obs.forEach((o, k) => {
      tl.fromTo(o, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)', immediateRender: false }, 68.2 + k * 0.1);
      tl.set(o, { className: 'ob ok' }, 69.0 + k * 0.17);
      tl.to(o, { scale: 1.18, duration: 0.12, yoyo: true, repeat: 1 }, 69.0 + k * 0.17);
      CUES.pop.push(69.0 + k * 0.17);
    });
    fx(68, 10, (p, t) => {
      const a = (t - 68) * 9;
      $('#orbit').style.transform = `rotate(${a}deg)`;
      obs.forEach((o) => { o.style.rotate = `${-a}deg`; });
    });
    CUES.chime.push(70.05);
    const oT = splitChars($('#oT'));
    tl.from(oT, { y: 140, opacity: 0, rotationX: -80, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.035, ease: 'back.out(1.8)' }, 68.4);
    tl.from('#oS', { y: 40, opacity: 0, duration: 0.6 }, 70.1);
    const oParts = $$('#oLogo svg > *');
    tl.from(oParts, { y: 40, opacity: 0, duration: 0.5, stagger: 0.035, ease: 'back.out(2)' }, 73.4);
    tl.from('#oUrl', { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(2)' }, 74.1);
    tl.from('#oFabs .fab', { y: 50, opacity: 0, scale: 0.8, duration: 0.5, stagger: 0.14, ease: 'back.out(2)' }, 74.7);
    CUES.pop.push(74.1, 74.7, 74.84);
    tl.from('#oGob', { y: 30, opacity: 0, duration: 0.5 }, 75.4);
    tl.to('#fade', { opacity: 1, duration: 0.6, ease: 'power1.in' }, 77.4);

    /* ---------- vida del robot ---------- */
    $$('.robot').forEach((r, k) => {
      const eyes = $('.r-eyes', r), glow = $('.r-glow', r);
      fx(0, DURATION, (p, t) => {
        // parpadeo cada ~2.6 s y antena que respira
        const ph = (t + k * 0.7) % 2.6;
        const b = ph < 0.16 ? 1 - Math.sin((ph / 0.16) * Math.PI) * 0.9 : 1;
        eyes.setAttribute('transform', `translate(0 ${519 * (1 - b)}) scale(1 ${b})`);
        glow.setAttribute('r', 50 + Math.sin(t * 3) * 10);
        r.style.translate = `0 ${Math.sin(t * 1.6) * 10}px`;
      });
    });

    tl.set({}, {}, DURATION);
  }

  /* ------------------------------------------------------------ reloj y vista previa */
  let current = 0;
  function seek(t) {
    current = clamp(t, 0, DURATION);
    tl.time(current, false);
    runFX(current);
    drawBG(current);
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
    window.__logo = await fetch('assets/logo-inline.svg').then((r) => r.text());
    await Promise.all([300, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Manrope Variable"`)));
    await document.fonts.ready;
    await Promise.all($$('img').map((i) => (i.complete ? null : i.decode().catch(() => {}))));
    build();
    seek(0);
    window.__ready = true;
    if (!RENDER) startPreview();
  }

  function startPreview() {
    fit();
    addEventListener('resize', fit);
    const scrub = $('#scrub'), tc = $('#time'), btn = $('#play');
    scrub.max = DURATION;
    let clock = null;
    let audioCtx = null, srcNode = null, audioBuf = null;
    const stopAudio = () => { if (srcNode) { try { srcNode.stop(); } catch (e) {} srcNode = null; } };
    const playFrom = (t0, withAudio) => {
      stopAudio();
      if (withAudio && audioBuf) {
        srcNode = audioCtx.createBufferSource();
        srcNode.buffer = audioBuf;
        srcNode.connect(audioCtx.destination);
        const at = audioCtx.currentTime + 0.05;
        srcNode.start(at, t0);
        clock = { now: () => t0 + (audioCtx.currentTime - at) };
      } else {
        const p0 = performance.now();
        clock = { now: () => t0 + (performance.now() - p0) / 1000 };
      }
    };
    btn.onclick = async () => {
      if (!audioCtx) audioCtx = new AudioContext();
      if (!audioBuf) audioBuf = await window.SimpleAudio.render({ withVoice: true });
      await audioCtx.resume();
      playFrom(0, true);
    };
    scrub.oninput = () => { clock = null; stopAudio(); seek(+scrub.value); };
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); if (clock) { clock = null; stopAudio(); } else playFrom(current, !!audioBuf); }
    });
    const loop = () => {
      if (clock) {
        let t = clock.now();
        if (t >= DURATION) { t = DURATION; clock = null; stopAudio(); }
        seek(t);
        scrub.value = t;
      }
      tc.textContent = `${current.toFixed(2)} s`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  init();
})();
