/* Gestión de Recursos Humanos · 1920x1080, en la línea del video de Platzi (fondo negro a azul eléctrico,
 * laptop 3D con la aplicación, chips y tarjetas de vidrio). La narración es la del video original y cada
 * elemento entra cuando la voz lo menciona (los tiempos de T vienen de la transcripción palabra por palabra).
 * Todo es función del tiempo: window.__seek(t) deja el cuadro exacto para renderizar cuadro por cuadro. */
(() => {
  const Q = new URLSearchParams(location.search);
  const FPS = Number(Q.get('fps')) || 60;
  const RENDER = Q.has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1920, H = 1080, DURATION = 296;

  /* ------------------------------------------------------------ momentos (s), sincronizados con la voz */
  const T = {
    arc: 6.2, una: 13.9, uno: 19.5, mods: 21.5,
    m1: 33.8, m1b: 45.4, m1c: 55.0,
    m2: 65.0, m2b: 74.6, m2c: 83.2,
    m3: 91.8, m3b: 97.0, m3c: 106.8, m3d: 113.0, m3e: 122.2,
    m4: 132.1, m4b: 136.8, m4c: 159.7,
    m5: 168.0, m5b: 173.0, m5c: 179.0, m5d: 186.3,
    m6: 196.0, m6b: 200.4, m6c: 214.0, m6d: 224.6, m6e: 235.2,
    m7: 245.4, m7b: 248.4, m7c: 256.4,
    m8: 262.2, m8b: 264.3, m8c: 273.3,
    out: 280.7, end: 287.4,
  };
  const MSTART = [T.m1, T.m2, T.m3, T.m4, T.m5, T.m6, T.m7, T.m8, T.out];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eo = (p) => 1 - Math.pow(1 - p, 3);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // Efectos evaluados en cada cuadro (flotación, contadores, partículas…)
  const FX = [];
  const fx = (start, dur, fn) => FX.push({ start, dur, fn });
  const runFX = (t) => { for (const f of FX) f.fn(f.dur > 0 ? clamp((t - f.start) / f.dur) : t >= f.start ? 1 : 0, t); };
  // números pseudoaleatorios estables (el render en paralelo necesita el mismo cuadro siempre)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ------------------------------------------------------------ íconos (trazo de 24 px) */
  const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
  const ICON = {
    settings: S('<path d="M4 6h9M18 6h2M4 12h3M12 12h8M4 18h11M20 18h0"/><circle cx="15.5" cy="6" r="2.2"/><circle cx="9.5" cy="12" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/>'),
    folder: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>'),
    userplus: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M19 8v6M16 11h6"/>'),
    usercheck: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M15.5 11l2 2 4-4"/>'),
    users: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>'),
    swap: S('<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    wallet: S('<path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h11.5V8"/><rect x="3.5" y="8" width="17" height="11.5" rx="2.5"/><path d="M15.5 13.75h2"/>'),
    target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
    scale: S('<path d="M12 4v16M7.5 20h9M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7ZM17 7l-3 6a3 3 0 0 0 6 0l-3-6Z"/>'),
    logout: S('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>'),
    idcard: S('<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.3"/><path d="M5.5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 10h4.5M14 13.5h3"/>'),
    layers: S('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
    grid: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
    briefcase: S('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3 12.5h18"/>'),
    building: S('<path d="M4 21V5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15 5v16M15 9h3.5A1.5 1.5 0 0 1 20 10.5V21M2.5 21h19M8 8h3M8 12h3M8 16h3"/>'),
    sitemap: S('<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="2.5" y="16" width="6" height="5" rx="1.2"/><rect x="15.5" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M5.5 16v-4h13v4"/>'),
    cal: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17h2"/>'),
    finger: S('<path d="M12 11v3c0 2.5-.7 4.6-2 6.5M8.5 8.8A4 4 0 0 1 16 11v2c0 2.2-.3 4.2-1 6M5.5 7A7.5 7.5 0 0 1 19.5 11v2.5M4.6 15c.3-1.1.4-2.4.4-4M18.8 17.5c.2-.6.3-1.3.4-2"/>'),
    file: S('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    filesign: S('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 17c1.5-2 2.5-2 3 0s1.5 1.5 3-.5"/>'),
    check: S('<path d="m5 12.5 4.5 4.5L19 7"/>', ' stroke-width="2.8"'),
    arrow: S('<path d="M7 17 17 7M9 7h8v8"/>', ' stroke-width="2.8"'),
    trend: S('<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>'),
    pin: S('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    award: S('<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7"/>'),
    money: S('<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.6 5.8 4.6 0 1.2-1.3 2.1-3 2.1-1.3 0-2.5-.6-3-1.7M12 6v1.6M12 16.4V18"/>'),
    gift: S('<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3.5-5-4-5-1.5S12 8 12 8Zm0 0c1.5-3.5 5-4 5-1.5S12 8 12 8Z"/>'),
    receipt: S('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
    plane: S('<path d="M10.5 13.5 3 10.5 21 3l-7.5 18-3-7.5ZM10.5 13.5 21 3"/>'),
    rotate: S('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>'),
    bell: S('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    star: S('<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
    send: S('<path d="M21 3 3.5 10.5l7 2.5 2.5 7z"/><path d="M21 3 10.5 13"/>'),
    link: S('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
    chart: S('<path d="M3.5 20.5h17M6.5 17v-5M11.5 17V7M16.5 17v-8"/>'),
  };
  const ic = (name, cls = '') => `<span class="ic ${cls}"><i data-i="${name}"></i></span>`;

  /* ------------------------------------------------------------ los 8 bloques */
  const MODS = [
    { n: '01', i: 'settings', short: 'Configuración', title: [['Configuración'], ['inicial', 'c-b']], sub: 'El terreno sobre el que<br><b>todo se construye</b>' },
    { n: '02', i: 'folder', short: 'Expediente', title: [['Expediente'], ['digital', 'c-b']], sub: 'El <b>corazón</b> de la plataforma' },
    { n: '03', i: 'userplus', short: 'Ingreso', title: [['Ingreso'], ['de personal', 'c-b']], sub: 'Reclutamiento, selección<br>y <b>contratación</b>' },
    { n: '04', i: 'swap', short: 'Movimientos', title: [['Movimientos'], ['de personal', 'c-b']], sub: 'Todo lo que pasa <b>dentro</b><br>de la institución' },
    { n: '05', i: 'clock', short: 'Tiempo', title: [['Control'], ['de tiempo', 'c-b']], sub: 'El tiempo como <b>rejilla</b><br>y como <b>pulso</b>' },
    { n: '06', i: 'wallet', short: 'Nómina', title: [['Compensación,'], ['nómina', 'c-b'], ['y finanzas', 'c-b']], sub: 'El bloque más crítico: <b>el dinero</b>' },
    { n: '07', i: 'target', short: 'Evaluación', title: [['Evaluación'], ['del desempeño', 'c-b']], sub: 'Evaluaciones y <b>reevaluaciones</b>' },
    { n: '08', i: 'logout', short: 'Salida', title: [['Sanciones'], ['y renuncia', 'c-b']], sub: 'El <b>cierre</b> del ciclo' },
  ];
  const modAt = (t) => { let k = -1; for (let j = 0; j < 8; j++) if (t >= MSTART[j] - 0.5) k = j; return t >= T.out - 0.5 ? -1 : k; };

  /* ------------------------------------------------------------ la aplicación dentro de la laptop (1280x758) */
  const PAY = [
    ['Ramírez Alvarado, C.', 780, 148], ['Menjívar Portillo, J.', 917, 174], ['Cruz Hernández, M.', 1054, 200], ['Sosa Bonilla, R.', 1191, 226],
    ['Interiano Peña, L.', 1328, 252], ['Zaldaña Mejía, A.', 1465, 278], ['Guevara Torres, D.', 1602, 304], ['Aguilar Rivas, S.', 839, 159],
  ];
  const money = (v) => `$ ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const AV = ['#5FF0DF', '#9FD8FF', '#FFCB6E', '#B9A6FF', '#7CF0A0', '#FF9DB0'];
  const head = (crumb, title, right = '') => `<div class="crumb">${crumb}</div><div class="row" style="justify-content:space-between;align-items:center"><h3>${title}</h3>${right}</div>`;
  function appHTML() {
    const nav = MODS.map((m, k) => `<div data-k="${k}"><span class="n">${m.n}</span><i data-i="${m.i}"></i>${m.short}</div>`).join('');
    const scr = [];
    // 01 · configuración
    scr.push(`${head('Configuración inicial', 'Estructura institucional', '<span class="btn"><i data-i="plus"></i>Nueva plaza</span>')}
      <div class="row" style="margin-top:20px">${[['Cifrado presupuestario', 412], ['Plaza nominal', 1860], ['Empleados', 24713]].map(([k, v], j) => `<div class="box" style="flex:1"><div class="k">${k}</div><div class="big">${fmt(v)}</div><div class="bar" style="margin-top:12px"><i style="width:${[62, 78, 90][j]}%"></i></div></div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><div class="box" style="flex:1.25"><div class="k" style="margin-bottom:12px">Estructura</div>
        ${[['Tipos de institución', 12, 22], ['Categorías', 38, 40], ['Catálogo de plazas', 1860, 92], ['Proyectos de inversión', 64, 48], ['Estructura organizacional', 146, 70]].map(([k, v, w]) => `<div style="display:flex;align-items:center;gap:14px;height:44px"><span style="width:210px;font-weight:600;color:#C9D0E2">${k}</span><div class="bar" style="flex:1"><i style="width:${w}%"></i></div><b style="width:60px;text-align:right">${fmt(v)}</b></div>`).join('')}</div>
        <div class="box" style="flex:1"><div class="k" style="margin-bottom:12px">Establecimiento</div>
        ${['Horarios', 'Asuetos', 'Tipos de licencia', 'Permisos', 'Horas compensatorias', 'Inconsistencias'].map((k) => `<div style="display:flex;align-items:center;justify-content:space-between;height:37px;font-weight:600;color:#C9D0E2">${k}<span class="tog on" style="--on:1"></span></div>`).join('')}</div></div>`);
    // 02 · expediente
    scr.push(`<div class="crumb">Expediente digital</div>
      <div class="box" style="display:flex;align-items:center;gap:20px;margin-top:8px"><div class="av2" style="width:84px;height:84px;font-size:28px;background:linear-gradient(145deg,#5FF0DF,#3D8BFF)">ML</div>
        <div style="flex:1"><h3>María López Hernández</h3><div style="color:#8C95AE;font-weight:600;margin-top:4px">Técnica administrativa II · Dirección de Talento Humano</div>
        <div class="row" style="gap:8px;margin-top:10px"><span class="tag c">Activa</span><span class="tag">Ley de Salario</span><span class="tag a">Plaza N.º 0457</span></div></div>
        <span class="btn"><i data-i="file"></i>Hoja de vida</span></div>
      <div class="row" style="gap:6px;margin:18px 0 14px">${['Información personal', 'Laboral', 'Puesto', 'Descuentos', 'Movimientos', 'Carta de renta'].map((k, j) => `<span class="tag" style="height:34px;padding:0 16px;font-size:13.5px;${j ? 'background:#151A2B;color:#8C95AE' : ''}">${k}</span>`).join('')}</div>
      <div class="row"><div class="box" style="flex:1.3;display:grid;grid-template-columns:1fr 1fr;gap:16px 24px">
        ${[['DUI', '01234567-8'], ['Fecha de ingreso', '03/02/2016'], ['Cifrado presupuestario', '2026-0102-3-01'], ['Salario', '$ 1,054.00'], ['Unidad', 'Talento Humano'], ['Jefatura', 'Lic. Roberto Sosa'], ['Correo', 'mlopez@institucion.gob.sv'], ['Teléfono', '2222-0000']].map(([k, v]) => `<div><div class="k">${k}</div><div style="font-weight:700;font-size:16px;margin-top:5px">${v}</div></div>`).join('')}</div>
        <div class="box" style="flex:1"><div class="k" style="margin-bottom:14px">Historial</div>
        ${[['2025', 'Nuevas funciones', 'c'], ['2022', 'Traslado', ''], ['2019', 'Ascenso', 'a'], ['2016', 'Ingreso', 'c']].map(([y, k, c]) => `<div style="display:flex;align-items:center;gap:14px;height:56px"><span class="tag ${c}" style="width:62px;justify-content:center">${y}</span><b style="font-size:16px">${k}</b></div>`).join('')}</div></div>`);
    // 03 · ingreso
    scr.push(`${head('Bolsa de empleo', 'Oferta 0457 · Técnico de sistemas', '<span class="tag c" style="height:32px">Publicada</span>')}
      <div class="box" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between">${['Datos generales', 'Información personal', 'Formación', 'Experiencia', 'Descríbete', 'Documentación'].map((k, j) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:${j < 4 ? '#fff' : '#6A7391'}"><span style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;background:${j < 4 ? 'var(--blue)' : '#1B2136'}">${j < 4 ? '✓' : j + 1}</span>${k}</div>`).join('<span style="flex:1;height:2px;margin:0 8px;background:#1B2136"></span>')}</div>
      <div class="box" style="margin-top:16px"><table><tr><th>Candidato</th><th>Formación</th><th>Experiencia</th><th>Puntaje</th><th>Estado</th></tr>
      ${[['Andrea Martínez', 'Ing. en Sistemas', '6 años', 92, 'c', 'Seleccionada'], ['Kevin Rodríguez', 'Lic. en Computación', '4 años', 85, '', 'Entrevista'], ['Gabriela Flores', 'Téc. en Redes', '3 años', 78, '', 'Invitada'], ['Óscar Ramos', 'Ing. Industrial', '5 años', 71, 'a', 'En revisión'], ['Daniela Castro', 'Lic. en Informática', '2 años', 66, 'a', 'En revisión']].map(([n, f, e, p, c, s], j) => `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="av2" style="width:32px;height:32px;font-size:12px;background:${AV[j]}">${n.split(' ').map((x) => x[0]).join('')}</span><b>${n}</b></div></td><td>${f}</td><td>${e}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="width:90px"><i style="width:${p}%"></i></div>${p}</div></td><td><span class="tag ${c}">${s}</span></td></tr>`).join('')}</table></div>`);
    // 04 · movimientos
    scr.push(`${head('Movimientos de personal', 'Solicitudes de movimiento', '<span class="btn"><i data-i="plus"></i>Nueva solicitud</span>')}
      <div class="row" style="gap:8px;margin:16px 0">${['Ascensos', 'Funciones', 'Destacamentos', 'Permutas', 'Traslados'].map((k, j) => `<span class="tag ${j ? '' : 'c'}" style="height:32px;padding:0 14px">${k}</span>`).join('')}</div>
      <div class="box"><table><tr><th>Empleado</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Estado</th></tr>
      ${[['Cruz Hernández, M.', 'Ascenso', 'Técnico I', 'Técnico II', 'c', 'Acuerdo firmado'], ['Sosa Bonilla, R.', 'Traslado', 'Sede central', 'Oficina regional', '', 'Validación'], ['Zaldaña Mejía, A.', 'Permuta', 'Unidad Jurídica', 'Unidad Financiera', '', 'Validación'], ['Guevara Torres, D.', 'Destacamento', 'Planificación', 'Proyecto especial', 'a', 'Solicitud'], ['Aguilar Rivas, S.', 'Funciones', 'Asistente', 'Coordinación', 'a', 'Solicitud'], ['Menjívar Portillo, J.', 'Ascenso', 'Analista I', 'Analista II', 'c', 'Acuerdo firmado']].map(([n, k, o, d, c, s]) => `<tr><td><b>${n}</b></td><td><span class="tag">${k}</span></td><td>${o}</td><td>${d}</td><td><span class="tag ${c}">${s}</span></td></tr>`).join('')}</table></div>`);
    // 05 · tiempo
    const days = Array.from({ length: 35 }, (_, j) => { const c = j % 7 > 4 ? '#151A2B' : [9, 10].includes(j) ? 'rgba(56,225,208,.55)' : j === 17 ? 'rgba(255,181,71,.6)' : j < 23 ? 'rgba(0,102,255,.55)' : '#1B2136'; return `<span style="border-radius:8px;background:${c};font-size:12px;font-weight:700;color:rgba(255,255,255,.7);padding:6px 8px">${j < 31 ? j + 1 : ''}</span>`; }).join('');
    scr.push(`${head('Control de tiempo', 'Horarios rotativos · Octubre 2026', '<span class="tag c" style="height:32px"><i data-i="finger"></i>Marcador vinculado</span>')}
      <div class="row" style="margin-top:16px"><div class="box" style="flex:1.35"><div class="k" style="margin-bottom:12px">Plan de trabajo mensual</div><div style="display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:52px;gap:8px">${days}</div></div>
      <div class="box" style="flex:1"><div class="k" style="margin-bottom:10px">Marcas de hoy</div>
        ${[['Entrada', '07:58'], ['Salida a almuerzo', '12:01'], ['Regreso', '12:59'], ['Salida', '—']].map(([k, v], j) => `<div style="display:flex;align-items:center;justify-content:space-between;height:46px;border-bottom:1px solid rgba(255,255,255,.05)"><span style="font-weight:600;color:#C9D0E2">${k}</span><b style="font-family:var(--mono);font-size:17px;color:${j === 0 ? '#5FF0DF' : '#fff'}">${v}</b></div>`).join('')}
        <div class="k" style="margin:18px 0 10px">Saldos</div>
        ${[['Licencias', 70], ['Permisos', 45], ['Misiones oficiales', 25]].map(([k, w]) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:600;color:#C9D0E2;margin-bottom:6px">${k}<span>${w}%</span></div><div class="bar"><i style="width:${w}%"></i></div></div>`).join('')}</div></div>`);
    // 06 · nómina
    scr.push(`${head('Planilla', 'Planilla ordinaria · Octubre 2026', `<div class="row" style="gap:6px">${['Apertura', 'Archivos', 'UFI', 'Hacienda', 'Cierre'].map((k, j) => `<span class="tag ${j < 3 ? 'c' : ''}">${j < 3 ? '✓ ' : ''}${k}</span>`).join('')}</div>`)}
      <div class="box" style="margin-top:16px"><table><tr><th>Empleado</th><th class="r">Devengado</th><th class="r">Descuentos</th><th class="r">Líquido</th></tr>
      ${PAY.map(([n, d, s]) => `<tr><td><b>${n}</b></td><td class="r">${money(d)}</td><td class="r">${money(s)}</td><td class="r"><b>${money(d - s)}</b></td></tr>`).join('')}
      <tr><td style="border:0;padding-top:14px"><b>Total</b></td><td class="r" style="border:0;padding-top:14px">${money(PAY.reduce((a, r) => a + r[1], 0))}</td><td class="r" style="border:0;padding-top:14px">${money(PAY.reduce((a, r) => a + r[2], 0))}</td><td class="r" style="border:0;padding-top:14px;color:#5FF0DF;font-weight:800">${money(PAY.reduce((a, r) => a + r[1] - r[2], 0))}</td></tr></table></div>`);
    // 07 · evaluación
    scr.push(`${head('Evaluación del desempeño', 'Evaluación 2026 · María López', '<span class="tag a" style="height:32px">Jefatura en curso</span>')}
      <div class="row" style="margin-top:16px"><div class="box" style="flex:1.2">
        ${[['Competencias', 88], ['Satisfacción', 82], ['Metas personales', 91], ['Preguntas técnicas', 76]].map(([k, v]) => `<div style="margin-bottom:22px"><div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:8px">${k}<span style="color:#5FF0DF">${v}</span></div><div class="bar" style="height:10px"><i style="width:${v}%"></i></div></div>`).join('')}</div>
        <div class="box" style="flex:1">${[['Empleado', 'Autoevaluación', 'c', 'Completa'], ['Jefe de unidad', 'Evaluación de jefatura', 'a', 'En curso'], ['Si apela su nota', 'Reevaluación', '', 'Disponible']].map(([k, v, c, s]) => `<div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06)"><div class="k">${k}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><b style="font-size:17px">${v}</b><span class="tag ${c}">${s}</span></div></div>`).join('')}</div></div>`);
    // 08 · salida
    scr.push(`${head('Sanciones y renuncia', 'Acciones de personal', '<span class="btn"><i data-i="plus"></i>Registrar acción</span>')}
      <div class="box" style="margin-top:16px"><table><tr><th>Empleado</th><th>Acción</th><th>Ruta</th><th>Estado</th></tr>
      ${[['Guevara Torres, D.', 'Sanción leve', 'Expediente', '', 'Registrada'], ['Interiano Peña, L.', 'Sanción grave', 'Unidad jurídica', 'a', 'Caso abierto'], ['Ramírez Alvarado, C.', 'Renuncia voluntaria', 'Baja efectiva', 'c', '31/10/2026'], ['Sosa Bonilla, R.', 'Renuncia simple', 'Baja efectiva', 'c', '15/11/2026'], ['Aguilar Rivas, S.', 'Sanción leve', 'Expediente', '', 'Registrada']].map(([n, k, r, c, s]) => `<tr><td><b>${n}</b></td><td>${k}</td><td>${r}</td><td><span class="tag ${c}">${s}</span></td></tr>`).join('')}</table></div>`);
    return `<div class="app" id="app"><div class="side"><div class="logo"><i>RH</i>Talento Humano</div><div class="nav">${nav}</div></div>
      <div class="main"><div class="top"><div class="srch"><i data-i="search"></i>Buscar empleado, plaza o trámite…</div><span class="sp"></span><span class="bell"><i data-i="bell"></i></span><div class="who"><span class="av">AD</span>Administración RH</div></div>
      ${scr.map((s, k) => `<div class="view scrn" data-s="${k}">${s}</div>`).join('')}</div></div>`;
  }
  function laptop() {
    const keys = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) keys.push('<i></i>');
    keys.push('<i class="w2"></i><i></i><i></i><i class="sp"></i><i></i><i></i><i class="w2"></i>');
    return `<div class="lap3d"><div class="lap" id="lap">
      <div class="base"><div class="hinge"></div><div class="kb">${keys.join('')}</div><div class="tp"></div><div class="front"></div></div>
      <div class="lid"><div class="scr" id="scr">${appHTML()}</div><span class="cam"></span></div>
    </div></div>`;
  }

  /* ------------------------------------------------------------ marcado general */
  // chip con su momento de entrada (data-at)
  const chip = (c, cls = '') => `<div class="chip ${cls}" data-at="${c.at ?? ''}" style="left:${c.x}px;top:${c.y}px">${ic(c.i, c.c || '')}${c.t}</div>`;
  const lines = (arr) => arr.map((l) => `<span class="ln">${l}</span>`).join('');
  const hero = (m, k) => `<div class="hero" id="hero${k}"><div class="kick"><span class="n">${m.n}</span>BLOQUE ${m.n}</div>
    ${m.title.map(([w, c]) => `<div class="l"><span class="w ${c || 'c-w'}">${w}</span></div>`).join('')}
    <p class="sub">${m.sub}</p></div>`;
  const gcard = (c, x, y, cls = '', w = 330, h = 300, at = '') => `<div class="glass gcard ${cls}" data-at="${at}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${ic(c.i, c.c || '')}${c.n ? `<span class="num">${c.n}</span>` : ''}<b>${c.t}</b>${c.s ? `<small>${c.s}</small>` : ''}</div>`;
  const node = (x, y, w, html, cls = '', id = '') => `<div class="glass node ${cls}" ${id ? `id="${id}"` : ''} style="left:${x}px;top:${y}px;width:${w}px">${html}</div>`;
  const kick = (id, x, y, txt) => `<div class="lbl2" id="${id}" style="left:${x}px;top:${y}px;font-size:24px;letter-spacing:.3em;color:var(--sky)">${txt}</div>`;
  const GLOW = 'filter:drop-shadow(0 0 10px rgba(61,139,255,.95))';
  const pathEl = (d, color = '#3D8BFF', w = 4, extra = '') => `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" style="${GLOW}" ${extra}/>`;
  const dot = (attr, color = '#9FD8FF', r = 9) => `<circle ${attr} r="${r}" fill="${color}" style="filter:drop-shadow(0 0 12px ${color})"/>`;

  // arco del ciclo laboral (intro)
  const ARC = { p0: [250, 820], p1: [960, -60], p2: [1670, 820] };
  const bez = (u) => [0, 1].map((d) => (1 - u) ** 2 * ARC.p0[d] + 2 * (1 - u) * u * ARC.p1[d] + u ** 2 * ARC.p2[d]);
  const ARCU = [0, 0.18, 0.38, 0.62, 0.82, 1];
  const ARCN = [['Solicitud de plaza', 'file'], ['Ingreso', 'userplus'], ['Desarrollo', 'trend'], ['Tiempo', 'clock'], ['Compensación', 'wallet'], ['Desvinculación', 'logout']];
  // red final: 8 bloques en círculo
  const RR = 260; // radio del radar de evaluación
  const NET = MODS.map((m, k) => { const a = -Math.PI / 2 + (k * Math.PI * 2) / 8; return [960 + Math.cos(a) * 340, 470 + Math.sin(a) * 290]; });

  const SC = (k) => `<div class="scene" id="m${k + 1}">${hero(MODS[k], k + 1)}`;
  function markup() {
    return `
      <div id="bg"></div><div id="glow"></div><div id="glow2"></div><div id="sheen"></div><div id="grid"></div><div id="dots"></div>
      <div id="cam">
        <div id="bignum"><b></b></div>

        <!-- ===== intro ===== -->
        <div class="scene" id="intro">
          <svg class="wire" id="introRing" style="z-index:28"><circle id="ir1" cx="960" cy="380" r="205" stroke="rgba(97,158,255,.6)" stroke-width="2.5" fill="none" stroke-dasharray="4 12"/>
            <circle id="ir2" cx="960" cy="380" r="248" stroke="rgba(56,225,208,.4)" stroke-width="2" fill="none"/></svg>
          <div class="tile" id="rhTile" style="top:380px"><span class="mono">RH</span></div>
          <div id="introT" style="position:absolute;left:0;right:0;top:690px;text-align:center;z-index:30">
            <div class="kickc" style="font-size:34px;font-weight:700;letter-spacing:.5em;color:var(--sky);margin-left:.5em">GESTIÓN DE</div>
            <div class="l" style="margin-top:14px;font-size:120px;font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap"><span class="w c-w">Recursos</span> <span class="w c-b">Humanos</span></div>
          </div>
          <svg class="wire" id="arcSvg"><path id="arcPath" d="M${ARC.p0} Q${ARC.p1} ${ARC.p2}" stroke="#3D8BFF" stroke-width="4" fill="none" style="${GLOW}"/>
            ${ARCN.map((_, k) => { const [x, y] = bez(ARCU[k]); return `<circle class="an" cx="${x}" cy="${y}" r="14" fill="#fff" style="filter:drop-shadow(0 0 12px rgba(61,139,255,1))"/>`; }).join('')}
            ${dot('id="comet"', '#9FD8FF', 10)}</svg>
          ${ARCN.map(([t, i], k) => { const [x, y] = bez(ARCU[k]); return `<div class="chip arcc" style="left:${x}px;top:${y + (k === 0 || k === 5 ? 40 : -116)}px">${ic(i, k === 5 ? 'c' : '')}${t}</div>`; }).join('')}
          <div class="say" id="arcSay" style="left:0;right:0;top:620px;text-align:center">${lines(['Desde que se <b>solicita una plaza</b>', 'hasta que la persona <b>se desvincula</b>'])}</div>
          <div class="glass" id="una" style="left:330px;top:370px;width:1260px;height:340px;border-radius:170px;display:flex;align-items:center;gap:44px;padding-left:96px">
            <span class="ic" style="width:150px;height:150px;border-radius:44px;font-size:84px"><i data-i="idcard"></i></span>
            <div><div class="unaT" style="font-size:76px;font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap">Una sola <span class="c-b">dirección</span></div>
            <div class="unaS" style="margin-top:22px;font-size:27px;font-weight:800;letter-spacing:.22em;color:var(--sky);white-space:nowrap">UNA SOLA CREDENCIAL</div>
            <div class="unaD" style="margin-top:8px;font-size:34px;font-weight:800;letter-spacing:.12em;color:var(--cyan);white-space:nowrap">IDENTIDAD DIGITAL DE EL SALVADOR</div></div></div>
          <div id="uno" style="position:absolute;left:0;right:0;top:340px;text-align:center;z-index:30;font-size:150px;font-weight:800;line-height:1.02;text-transform:uppercase;white-space:nowrap">
            <div class="w c-w">Un ingreso,</div><div class="w c-b">toda la gestión</div></div>
          <div id="modsH" style="position:absolute;left:0;right:0;top:120px;text-align:center;z-index:30">
            <div class="l" style="font-size:84px;font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap"><span class="w c-w">Más de</span> <span class="w c-b"><span id="n30">30</span> módulos</span></div>
            <div class="sub2" style="margin-top:20px;font-size:38px;font-weight:500;color:rgba(255,255,255,.9)">organizados en <b>8 bloques</b></div></div>
          <div id="modsG" style="position:absolute;left:0;top:0;width:1920px;height:1080px;perspective:2200px;z-index:30">
            ${MODS.map((m, k) => gcard({ i: m.i, n: m.n, t: m.short }, 230 + (k % 4) * 375, 360 + Math.floor(k / 4) * 300, 'modc', 340, 260)).join('')}</div>
        </div>

        <!-- ===== 01 · configuración ===== -->
        ${SC(0)}
          ${[{ t: 'Tipos de institución', i: 'building', x: 640, y: 160, at: 38.0 }, { t: 'Categorías', i: 'layers', x: 1470, y: 120, at: 39.4 }, { t: 'Catálogo de plazas', i: 'grid', x: 1440, y: 790, at: 40.3, c: 'c' },
            { t: 'Proyectos de inversión pública', i: 'briefcase', x: 860, y: 930, at: 41.7 }, { t: 'Estructura organizacional', i: 'sitemap', x: 640, y: 770, at: 43.4 }].map((c) => chip(c, 'hc')).join('')}
          <div class="hline" id="m1line" style="left:0;top:538px;width:1010px"></div><div class="circ" id="m1circ" style="left:1052px;top:540px"><i data-i="arrow"></i></div>
          <div class="say" id="m1say" style="left:1150px;top:380px">${lines(['Cada institución registra', 'sus <b>establecimientos</b>', 'y <b>dependencias</b>'])}</div>
          ${kick('m1k', 1156, 230, 'CARGA INICIAL')}
          <div id="m1stats" style="position:absolute;left:1150px;top:290px;z-index:30">
            ${[['Cifrado presupuestario', 412], ['Plaza nominal', 1860], ['Empleados', 24713]].map(([k, v], j) => `<div class="st" style="margin-bottom:${j < 2 ? 38 : 0}px"><div class="stn" data-to="${v}" style="font-size:112px;font-weight:800;line-height:1;letter-spacing:-.02em;${j === 2 ? 'color:var(--blue);text-shadow:0 0 50px rgba(0,102,255,.6)' : ''}">0</div><div style="margin-top:6px;font-size:28px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.75)">${k}</div></div>`).join('')}</div>
          <div class="glass" id="m1cat" style="left:1060px;top:190px;width:760px;height:700px;padding:44px 50px">
            <div style="font-size:23px;font-weight:800;letter-spacing:.24em;color:var(--sky);margin-bottom:6px">CONFIGURACIÓN DE</div><div style="font-size:23px;font-weight:800;letter-spacing:.24em;color:var(--sky);margin-bottom:18px">ESTABLECIMIENTO</div>
            ${['Horarios', 'Asuetos', 'Tipos de licencia', 'Permisos', 'Horas compensatorias', 'Inconsistencias de marcación'].map((k) => `<div class="tg" style="display:flex;align-items:center;justify-content:space-between;height:84px;border-bottom:1.5px solid rgba(255,255,255,.08);font-size:34px;font-weight:700">${k}<span class="sw" style="position:relative;width:96px;height:52px;border-radius:26px;background:rgba(255,255,255,.12);flex:none"><i style="position:absolute;left:6px;top:6px;width:40px;height:40px;border-radius:50%;background:#7C86A6"></i></span></div>`).join('')}</div>
        </div>

        <!-- ===== 02 · expediente ===== -->
        ${SC(1)}
          ${[{ t: 'Hoja de vida única', i: 'idcard', x: 700, y: 170, at: 70.4 }, { t: 'Información personal y laboral', i: 'users', x: 1240, y: 110, at: 72.4 }, { t: 'Datos del puesto', i: 'briefcase', x: 1440, y: 860, at: 74.0, c: 'c' }].map((c) => chip(c, 'hc')).join('')}
          <div class="hline" id="m2line" style="left:0;top:538px;width:1010px"></div><div class="circ" id="m2circ" style="left:1052px;top:540px"><i data-i="folder"></i></div>
          <div class="vline" id="m2v" style="left:1050px;top:590px;height:440px"></div>
          ${[['Registro de personal nuevo', 'userplus', 75.3], ['Órdenes de descuento', 'receipt', 77.0], ['Historial de movimientos', 'trend', 79.8], ['Carta de renta', 'file', 82.0]].map(([t, i, at], k) => chip({ t, i, x: 1150, y: 250 + k * 150, at, c: k === 3 ? 'c' : '' }, 'm2a')).join('')}
          <div class="say" id="m2say" style="left:112px;top:170px">${lines(['Seguimiento a su', '<b>carrera institucional</b>'])}</div>
          <svg class="wire" id="m2stairs">${pathEl('M240 900 H560 V730 H880 V560 H1200 V390 H1600', '#3D8BFF', 4, 'id="m2sp"')}${dot('id="m2dot"', '#5FF0DF', 16)}</svg>
          ${[['2016', 'Ingreso', 'userplus', 240, 900], ['2019', 'Ascenso', 'award', 560, 730], ['2022', 'Traslado', 'pin', 880, 560], ['2025', 'Nuevas funciones', 'star', 1200, 390]].map(([y, t, i, x, yy]) => `<div class="glass m2s" style="left:${x + 20}px;top:${yy + 26}px;padding:20px 28px;border-radius:24px;display:flex;align-items:center;gap:18px">${ic(i, 'c')}<div><div style="font-size:20px;font-weight:800;letter-spacing:.2em;color:var(--sky)">${y}</div><div style="font-size:32px;font-weight:800;white-space:nowrap">${t}</div></div></div>`).join('')}
        </div>

        <!-- ===== 03 · ingreso de personal ===== -->
        ${SC(2)}
          ${[{ t: 'Bolsa de empleo', i: 'briefcase', x: 700, y: 170, at: 94.8 }, { t: 'Portal del candidato', i: 'userplus', x: 1440, y: 860, at: 95.9, c: 'c' }].map((c) => chip(c, 'hc')).join('')}
          <div class="say" id="m3say1" style="left:0;right:0;top:230px;text-align:center">${lines(['Registro en <b>seis pasos</b>'])}</div>
          <div class="hline" id="m3track" style="left:230px;top:526px;width:1460px;background:rgba(255,255,255,.14);box-shadow:none"></div>
          <div class="hline" id="m3fill" style="left:230px;top:526px;width:1460px"></div>
          ${['Datos generales', 'Información personal', 'Formación', 'Experiencia', 'Descríbete', 'Documentación'].map((t, k) => `<div class="step m3st" style="left:${230 + k * 292}px;top:491px"><div class="dot"><i data-i="${['idcard', 'users', 'award', 'briefcase', 'star', 'file'][k]}"></i></div><b>${t.replace(' ', '<br>')}</b><small>PASO ${k + 1}</small></div>`).join('')}
          ${[['Hoja de vida', 'file', 104.2, 420], ['Postulaciones', 'send', 105.0, 820], ['Convocatorias', 'bell', 105.9, 1220]].map(([t, i, at, x]) => chip({ t, i, x, y: 800, at, c: 'c' }, 'm3b')).join('')}
          ${kick('m3k', 1150, 290, 'LADO INSTITUCIONAL')}
          ${[['Configura y publica ofertas', 'send', 108.3], ['Gestiona candidatos', 'users', 110.3], ['Invita a postulantes', 'bell', 111.7]].map(([t, i, at], k) => chip({ t, i, x: 1150, y: 370 + k * 150, at, c: k === 2 ? 'c' : '' }, 'm3i')).join('')}
          <div class="say" id="m3say2" style="left:0;right:0;top:170px;text-align:center">${lines(['<em>Contrataciones</em> para los escenarios reales'])}</div>
          <svg class="wire" id="m3wires">${pathEl('M600 400 C 820 400, 820 540, 1040 540')}${pathEl('M600 680 C 820 680, 820 540, 1040 540')}${pathEl('M1040 540 H1180', '#5FF0DF')}
            ${dot('class="m3p"')}${dot('class="m3p"')}</svg>
          ${node(150, 358, 450, `${ic('building')}<span style="margin-left:16px">Plaza vacante</span>`, 'm3n')}
          ${node(150, 638, 450, `${ic('plus')}<span style="margin-left:16px">Creación de plaza nueva</span>`, 'm3n')}
          <div class="glass node hi" id="m3sign" style="left:1180px;top:476px;width:580px;height:128px;font-size:40px;font-weight:800">${ic('filesign', 'c')}<span style="margin-left:22px">Firma de contrato</span></div>
          ${kick('m3fk', 1186, 660, 'FORMAS DE CONTRATO')}
          ${[['Ley de Salario', 'scale'], ['Contrato · GOES', 'filesign'], ['Servicios profesionales', 'briefcase']].map(([t, i]) => `<div class="chip m3f" style="left:1186px;top:710px">${ic(i)}${t}</div>`).join('')}
          <div class="say" id="m3say3" style="left:0;right:0;top:200px;text-align:center">${lines(['<em>Talento externo:</em> consultorías'])}</div>
          ${[['Catálogo de consultoras', 'grid', 125.0], ['Expediente del consultor', 'folder', 126.5], ['Entregables', 'file', 127.9], ['Control de actividades', 'cal', 129.1], ['Nómina de consultoría', 'wallet', 130.4]].map(([t, i, at], k) => gcard({ i, t, n: `0${k + 1}`, c: k === 4 ? 'c' : '' }, 150 + k * 336, 400, 'm3c', 310, 300, at)).join('')}
        </div>

        <!-- ===== 04 · movimientos ===== -->
        ${SC(3)}
          ${[['Ascensos', 'Promociones y cambios de nivel'], ['Asignación y remoción de funciones', 'Delegar o retirar responsabilidades'], ['Destacamento', 'Envío temporal a otra dependencia'], ['Permutas', 'Intercambio voluntario de plazas'], ['Traslados', 'Internos o entre instituciones']].map(([t, s], k) => `<div class="glass m4c" style="left:${120 + k * 344}px;top:260px;width:320px;height:560px;padding:28px">
            <svg class="m4i" viewBox="0 0 264 220" style="width:264px;height:220px">${[
              '<path d="M20 190 H90 V140 H160 V90 H240" stroke="rgba(159,216,255,.55)" stroke-width="5" fill="none" stroke-linecap="round"/><circle class="d" r="15" fill="#fff"/>',
              '<circle cx="132" cy="110" r="44" fill="rgba(0,102,255,.25)" stroke="#3D8BFF" stroke-width="4"/><circle class="o1" r="13" fill="#5FF0DF"/><circle class="o2" r="13" fill="#FFB547"/><circle class="o3" r="11" fill="#9FD8FF"/>',
              '<rect x="18" y="70" width="88" height="80" rx="16" fill="none" stroke="#3D8BFF" stroke-width="4"/><rect x="158" y="70" width="88" height="80" rx="16" fill="none" stroke="#3D8BFF" stroke-width="4"/><path d="M106 110 H158" stroke="rgba(159,216,255,.4)" stroke-width="3" stroke-dasharray="6 7"/><circle class="d" r="15" fill="#5FF0DF"/>',
              '<path d="M50 110 C 90 40, 174 40, 214 110" stroke="rgba(159,216,255,.3)" stroke-width="3" fill="none" stroke-dasharray="6 7"/><path d="M50 110 C 90 180, 174 180, 214 110" stroke="rgba(159,216,255,.3)" stroke-width="3" fill="none" stroke-dasharray="6 7"/><circle class="d1" r="16" fill="#fff"/><circle class="d2" r="16" fill="#B9A6FF"/>',
              '<rect x="18" y="70" width="88" height="80" rx="16" fill="none" stroke="#3D8BFF" stroke-width="4"/><rect x="158" y="70" width="88" height="80" rx="16" fill="none" stroke="#3D8BFF" stroke-width="4"/><path d="M106 110 H158" stroke="#3D8BFF" stroke-width="4"/><circle class="d" r="15" fill="#fff"/>',
            ][k]}</svg>
            <div style="position:absolute;left:28px;right:24px;top:270px"><div style="font-size:20px;font-weight:800;letter-spacing:.2em;color:var(--sky)">0${k + 1}</div><b style="display:block;margin-top:8px;font-size:${k === 1 ? 30 : 38}px;font-weight:800;line-height:1.12">${t}</b>
            <small class="m4d" style="display:block;margin-top:14px;font-size:23px;font-weight:500;line-height:1.3;color:rgba(255,255,255,.72)">${s}</small></div></div>`).join('')}
          <div class="say" id="m4say2" style="left:0;right:0;top:260px;text-align:center">${lines(['Todos comparten <b>la misma lógica</b>'])}</div>
          <svg class="wire" id="m4wires">${pathEl('M560 540 H700')}${pathEl('M1220 540 H1360')}${dot('class="m4p"')}</svg>
          ${node(160, 476, 400, `${ic('file')}<span style="margin-left:16px">Solicitud</span>`, 'm4n')}
          ${node(700, 476, 520, `${ic('search')}<span style="margin-left:16px">Cadena de validación</span>`, 'm4n')}
          ${node(1360, 476, 420, `${ic('filesign', 'c')}<span style="margin-left:16px">Acuerdo firmado</span>`, 'm4n hi')}
        </div>

        <!-- ===== 05 · control de tiempo ===== -->
        ${SC(4)}
          ${[{ t: 'Horarios rotativos', i: 'clock', x: 700, y: 170, at: 170.3 }, { t: 'Asignación de horarios', i: 'cal', x: 1380, y: 110, at: 171.6 }, { t: 'Reportes', i: 'chart', x: 1480, y: 860, at: 172.8, c: 'c' }].map((c) => chip(c, 'hc')).join('')}
          <div class="say" id="m5say1" style="left:112px;top:400px">${lines(['Edición <b>masiva</b>', 'o <b>individual</b>'])}</div>
          <div class="say" id="m5say1b" style="left:112px;top:370px">${lines(['<b>Plan de trabajo</b>', '<b>mensual</b> y distribución', 'operativa'])}</div>
          <div class="calh" id="m5calh" style="left:900px;top:220px">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="cal" id="m5cal" style="left:900px;top:270px">${Array.from({ length: 35 }, (_, j) => { const c = j % 7 > 4 ? 'w' : [9, 10, 11].includes(j) ? 'l' : [17, 25].includes(j) ? 'p' : 'f'; return `<i>${j < 31 ? j + 1 : ''}<b class="${j >= 31 ? 'w' : c}"></b></i>`; }).join('')}</div>
          <div class="legend" id="m5leg" style="left:900px;top:730px"><span><i style="background:#3D8BFF"></i>Jornada</span><span><i style="background:#38E1D0"></i>Licencia</span><span><i style="background:#FFB547"></i>Permiso</span><span><i style="background:rgba(255,255,255,.15)"></i>Descanso</span></div>
          <div class="say" id="m5say2" style="left:112px;top:400px">${lines(['<em>Marcador:</em>', 'el tiempo', 'como pulso'])}</div>
          <div class="ring" id="m5ring" style="left:760px;top:190px;width:560px;height:560px">
            <svg viewBox="0 0 560 560" style="position:absolute;inset:0;width:560px;height:560px"><circle class="rp" cx="280" cy="280" r="150" fill="none" stroke="#38E1D0" stroke-width="3"/><circle class="rp" cx="280" cy="280" r="150" fill="none" stroke="#38E1D0" stroke-width="3"/><circle class="rp" cx="280" cy="280" r="150" fill="none" stroke="#38E1D0" stroke-width="3"/>
              <circle cx="280" cy="280" r="150" fill="rgba(10,20,50,.85)" stroke="#38E1D0" stroke-width="10" style="filter:drop-shadow(0 0 24px rgba(56,225,208,.8))"/></svg>
            <i data-i="finger" style="position:absolute;left:200px;top:200px;font-size:160px;color:#5FF0DF"></i>
            <div class="clock" id="m5clock" style="top:470px;font-size:64px">07:58:30</div></div>
          ${[['Registro biométrico', 'finger', 180.6], ['Dispositivo vinculado', 'link', 183.3], ['Marcas del personal', 'check', 185.3]].map(([t, i, at], k) => chip({ t, i, x: 1360, y: 300 + k * 150, at, c: k === 2 ? 'c' : '' }, 'm5m')).join('')}
          <div class="say" id="m5say3" style="left:0;right:0;top:180px;text-align:center">${lines(['Permisos, misiones y <b>licencias</b>'])}</div>
          ${[['Licencias', 'Distribución de tiempo y comprobantes', 'cal', 189.1], ['Permisos', 'Solicitud, aprobación y registro', 'filesign', 192.2], ['Misiones oficiales', 'Internas y externas', 'plane', 193.4]].map(([t, s, i, at], k) => `<div class="glass gcard m5c" data-at="${at}" style="left:${290 + k * 460}px;top:330px;width:420px;height:420px">${ic(i, k === 1 ? 'c' : '')}<b style="font-size:44px">${t}</b><small style="font-size:26px">${s}</small></div>`).join('')}
        </div>

        <!-- ===== 06 · nómina ===== -->
        ${SC(5)}
          ${kick('m6k', 1300, 132, 'PLANILLA')}
          ${[['Apertura', 201.6], ['Generación de archivos', 205.0], ['UFI', 208.2], ['Hacienda', 208.7], ['Cierre', 209.4]].map(([t, at]) => `<div class="glass m6s" data-at="${at}" style="left:1300px;top:${190 + [0, 1, 2, 3, 4].indexOf([201.6, 205.0, 208.2, 208.7, 209.4].indexOf(at)) * 140}px;width:520px;height:104px;border-radius:26px;display:flex;align-items:center;gap:22px;padding:0 26px;font-size:34px;font-weight:800;white-space:nowrap"><span class="ck" style="width:52px;height:52px;border-radius:50%;border:3px solid rgba(159,216,255,.6);display:grid;place-items:center;font-size:28px;color:#fff;flex:none"><i data-i="check"></i></span>${t}</div>`).join('')}
          <svg class="wire" id="m6sv"><path d="M1352 294 V330 M1352 434 V470 M1352 574 V610 M1352 714 V750" stroke="rgba(159,216,255,.45)" stroke-width="3" stroke-dasharray="6 7"/></svg>
          ${[['Pago a acreedores', 'users', 210.2, 120, 880], ['Descuentos adicionales', 'receipt', 212.0, 560, 950], ['Aguinaldo', 'gift', 212.9, 880, 860]].map(([t, i, at, x, y], k) => chip({ t, i, x, y, at, c: k === 2 ? 'c' : '' }, 'm6x')).join('')}
          <div class="say" id="m6say1" style="left:0;right:0;top:150px;text-align:center">${lines(['<em>Presupuesto:</em> proyección anual y asignación'])}</div>
          <div class="bars" id="m6bars" style="left:343px;top:300px;height:480px;gap:14px">${Array.from({ length: 12 }, (_, k) => { const a = [0.42, 0.5, 0.58, 0.66, 0.72, 0.8, 0.62, 0.7, 0.78, 0.86, 0.92, 1][k], b = [0.36, 0.44, 0.47, 0.55, 0.6, 0.64, 0.5, 0.58, 0.66, 0.7, 0.76, 0.84][k]; return `<div class="grp" style="display:flex;align-items:flex-end;gap:6px;position:relative"><div class="b in" style="width:42px;height:${a * 480}px"></div><div class="b out" style="width:42px;height:${b * 480}px"></div><small style="position:absolute;left:0;right:0;bottom:-42px;text-align:center;font-size:20px;font-weight:800;color:rgba(255,255,255,.6)">${'EFMAMJJASOND'[k]}</small></div>`; }).join('')}</div>
          <svg class="wire" id="m6tr"><path id="m6trp" d="${Array.from({ length: 12 }, (_, k) => `${k ? 'L' : 'M'}${388 + k * 104} ${780 - [0.22, 0.3, 0.26, 0.34, 0.4, 0.36, 0.3, 0.42, 0.46, 0.44, 0.5, 0.56][k] * 480}`).join(' ')}" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 8px rgba(255,255,255,.8))"/></svg>
          <div class="legend" id="m6leg" style="left:0;right:0;justify-content:center;top:855px;font-size:26px"><span><i style="background:#38E1D0"></i>Ingresos</span><span><i style="background:#FFB547"></i>Egresos</span><span><i style="background:#fff;height:4px;width:30px;border-radius:2px"></i>Transferencias</span></div>
          <div class="ring" id="m6ring" style="left:360px;top:170px;width:620px;height:620px">
            <svg viewBox="0 0 620 620" style="position:absolute;inset:0;width:620px;height:620px"><circle cx="310" cy="310" r="240" fill="rgba(10,20,50,.6)" stroke="rgba(255,255,255,.1)" stroke-width="18"/>
              <circle id="m6arc" cx="310" cy="310" r="240" fill="none" stroke="#38E1D0" stroke-width="18" stroke-linecap="round" transform="rotate(-90 310 310)" style="filter:drop-shadow(0 0 18px rgba(56,225,208,.8))"/>
              ${Array.from({ length: 9 }, (_, k) => { const a = -Math.PI / 2 + ((k + 0.5) * Math.PI * 2) / 9; return `<text class="rt" x="${310 + Math.cos(a) * 186}" y="${310 + Math.sin(a) * 186 + 10}" text-anchor="middle" font-size="28" font-weight="800" fill="rgba(159,216,255,.85)" font-family="Manrope Variable">${k + 1}</text>`; }).join('')}</svg>
            <div style="position:absolute;left:0;right:0;top:240px;text-align:center"><div style="font-size:26px;font-weight:800;letter-spacing:.34em;color:var(--sky);margin-left:.34em">REFRENDA</div><div id="m6rt" style="margin-top:8px;font-size:68px;font-weight:800">9 pasos</div></div></div>
          <div class="say" id="m6say2" style="left:1110px;top:300px">${lines(['Proceso <b>anual</b>', 'de plazas'])}</div>
          <div id="m6steps" style="position:absolute;left:1110px;top:470px;z-index:30">${['Detalle y actualización', 'Cálculo salarial', 'Asignación', 'Inconsistencias', 'Resumen final'].map((t, k) => `<div class="m6st" style="display:flex;align-items:center;gap:18px;height:74px;font-size:34px;font-weight:700"><span style="width:18px;height:18px;border-radius:50%;background:${k === 4 ? 'var(--cyan)' : 'var(--blue-l)'};box-shadow:0 0 14px ${k === 4 ? 'var(--cyan)' : 'var(--blue-l)'}"></span>${t}</div>`).join('')}</div>
          ${[['Aumentos salariales', 'trend', 236.0, ''], ['Beneficios', 'gift', 237.4, 'Generales, personalizados y por desempeño'], ['Constancias', 'file', 240.9, 'Salariales y de tiempo laboral'], ['Remuneraciones', 'money', 243.3, 'e indemnizaciones']].map(([t, i, at, s], k) => `<div class="glass gcard m6c" data-at="${at}" style="left:${150 + k * 410}px;top:330px;width:380px;height:400px">${ic(i, k === 3 ? 'c' : '')}<b style="font-size:38px">${t}</b>${s ? `<small style="font-size:23px">${s}</small>` : ''}</div>`).join('')}
        </div>

        <!-- ===== 07 · evaluación ===== -->
        ${SC(6)}
          <svg class="wire radar" id="m7radar" style="z-index:30"><g transform="translate(640 560)">
            ${[1, 0.66, 0.33].map((r) => `<path d="M0 ${-RR * r} L${RR * r} 0 L0 ${RR * r} L${-RR * r} 0Z" fill="none" stroke="rgba(159,216,255,.18)" stroke-width="2"/>`).join('')}
            <path class="ax" d="M0 ${-RR} V${RR}" stroke="rgba(159,216,255,.45)" stroke-width="2"/><path class="ax" d="M${-RR} 0 H${RR}" stroke="rgba(159,216,255,.45)" stroke-width="2"/>
            <path id="m7poly" fill="rgba(0,102,255,.38)" stroke="#5FF0DF" stroke-width="4" stroke-linejoin="round" style="filter:drop-shadow(0 0 16px rgba(56,225,208,.7))"/>
            ${[[0, -RR - 30, 'middle', ['COMPETENCIAS']], [RR + 26, 8, 'start', ['SATISFACCIÓN']], [0, RR + 50, 'middle', ['METAS PERSONALES']], [-RR - 26, -8, 'end', ['PREGUNTAS', 'TÉCNICAS']]].map(([x, y, a, t]) => `<text class="rl" x="${x}" y="${y}" text-anchor="${a}" font-size="25">${t.map((w, j) => `<tspan x="${x}" dy="${j ? 32 : 0}">${w}</tspan>`).join('')}</text>`).join('')}
            ${[0, 1, 2, 3].map(() => '<circle class="rv" r="9" fill="#5FF0DF" style="filter:drop-shadow(0 0 10px #5FF0DF)"/>').join('')}</g></svg>
          <div class="say" id="m7say" style="left:1180px;top:420px">${lines(['<b>Cuatro tipos</b>', 'de evaluación'])}</div>
          ${[['EMPLEADO', 'Autoevaluación', 'usercheck', '', 257.2], ['JEFE DE UNIDAD', 'Evaluación de jefatura', 'users', '', 258.2], ['CUANDO APELA SU NOTA', 'Reevaluación', 'rotate', 'c', 259.9]].map(([k, t, i, c, at], j) => `<div class="glass m7f" data-at="${at}" style="left:1190px;top:${190 + j * 250}px;width:660px;height:170px;display:flex;align-items:center;gap:26px;padding:0 34px">${ic(i, c)}<div><div style="font-size:20px;font-weight:800;letter-spacing:.22em;color:${c ? 'var(--cyan)' : 'var(--sky)'}">${k}</div><div style="margin-top:8px;font-size:40px;font-weight:800;white-space:nowrap">${t}</div></div></div>`).join('')}
          <svg class="wire" id="m7arw"><path d="M1520 368 V432 M1506 416 L1520 432 L1534 416" stroke="#9FD8FF" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M1520 618 V682 M1506 666 L1520 682 L1534 666" stroke="#5FF0DF" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
        </div>

        <!-- ===== 08 · sanciones y renuncia ===== -->
        ${SC(7)}
          ${kick('m8k1', 150, 150, 'SANCIONES')}
          <div class="lbl2" id="m8grav" style="left:180px;top:450px;font-size:19px;color:rgba(255,255,255,.6)">CLASIFICACIÓN POR GRAVEDAD</div>
          <svg class="wire" id="m8tree">${pathEl('M540 330 V500 C540 550 500 560 400 560 C 330 560 330 600 330 640 V690')}${pathEl('M540 500 C540 550 580 560 680 560 C 750 560 750 600 750 640 V690', '#FFB547')}
            ${pathEl('M1360 400 C 1430 400, 1460 500, 1530 500 M1360 620 C 1430 620, 1460 520, 1530 520', '#3D8BFF')}${pathEl('M750 820 V880', '#FFB547', 3, 'stroke-dasharray="6 9"')}</svg>
          ${node(370, 230, 340, `${ic('scale')}<span style="margin-left:16px">Sanción</span>`, 'm8n')}
          ${node(130, 700, 400, `<div><small>LEVES</small>Directo al expediente</div>`, 'm8n')}
          ${node(560, 700, 380, `<div><small style="color:var(--amber)">GRAVES</small>Unidad jurídica</div>`, 'm8n')}
          <div class="chip" id="m8acu" style="left:560px;top:890px">${ic('filesign', 'a')}Acuerdo y cierre</div>
          ${kick('m8k2', 1000, 150, 'RENUNCIA · DOS MODALIDADES')}
          ${node(1000, 336, 360, 'Simple', 'm8r')}
          ${node(1000, 556, 360, 'Voluntaria', 'm8r')}
          <div class="ring" id="m8ring" style="left:1530px;top:410px;width:200px;height:200px"><svg viewBox="0 0 200 200" style="position:absolute;inset:0;width:200px;height:200px"><circle cx="100" cy="100" r="80" fill="rgba(10,20,50,.85)" stroke="#38E1D0" stroke-width="8" style="filter:drop-shadow(0 0 18px rgba(56,225,208,.8))"/></svg><i data-i="check" style="position:absolute;left:60px;top:60px;font-size:80px;color:#5FF0DF"></i></div>
          <div class="lbl2" id="m8lbl" style="left:1505px;top:630px;font-size:24px;color:var(--cyan)">BAJA EFECTIVA</div>
          <div class="chip" id="m8dig" style="left:1000px;top:800px">${ic('send', 'c')}Tramitada por el propio empleado</div>
        </div>

        <!-- ===== cierre ===== -->
        <div class="scene" id="outro">
          <svg class="wire" id="netSvg">${NET.map((a, i) => NET.map((b, j) => (j > i ? `<line class="nl" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(97,158,255,.35)" stroke-width="2"/>` : '')).join('')).join('')}
            ${NET.map((a) => `<line class="ns2" x1="${a[0]}" y1="${a[1]}" x2="960" y2="470" stroke="#3D8BFF" stroke-width="3" style="${GLOW}"/>`).join('')}</svg>
          ${MODS.map((m, k) => `<div class="nn" style="position:absolute;left:${NET[k][0] - 60}px;top:${NET[k][1] - 29}px;width:120px;z-index:31;text-align:center"><span class="ic" style="margin:0 auto"><i data-i="${m.i}"></i></span><div style="margin:8px -80px 0;font-size:20px;font-weight:800;letter-spacing:.14em;color:rgba(255,255,255,.85);white-space:nowrap">${m.n} · ${m.short.toUpperCase()}</div></div>`).join('')}
          <div class="tile" id="netTile" style="top:470px;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:56px"><span class="mono" style="font-size:90px">RH</span></div>
          <div id="netStats" style="position:absolute;left:0;right:0;top:880px;display:flex;justify-content:center;gap:150px;z-index:32">
            ${[['8', 'BLOQUES'], ['30+', 'MÓDULOS'], ['1', 'PLATAFORMA']].map(([v, k]) => `<div class="ns" style="text-align:center"><div style="font-size:92px;font-weight:800;line-height:1">${v}</div><div style="margin-top:6px;font-size:22px;font-weight:800;letter-spacing:.3em;color:var(--sky)">${k}</div></div>`).join('')}</div>
          <div id="endT" style="position:absolute;left:0;right:0;top:230px;text-align:center;font-size:58px;font-weight:400;z-index:50">Un ingreso, <b style="font-weight:800">toda la gestión</b></div>
          <div class="endpill" id="endPill" style="top:340px"><div class="rh">RH</div><div class="tx"><small>GESTIÓN DE</small><b>Recursos Humanos</b></div></div>
          <div id="endGob" style="position:absolute;left:0;right:0;top:660px;display:flex;justify-content:center;z-index:50"><img src="assets/logo-gobierno.png" alt="" style="height:170px"></div>
        </div>

        <!-- mosaicos de transición entre bloques -->
        ${MODS.map((m, k) => `<div class="tile mt" id="tile${k + 1}"><i data-i="${m.i}"></i><span class="tn">${m.n}</span></div>`).join('')}

        <div id="dev">${laptop()}</div>
      </div>
      <div id="brand"><span class="mk">RH</span><span>GESTIÓN DE<br>RECURSOS HUMANOS</span></div>
      <div id="hud"><span class="lbl">BLOQUE <b id="hudN">01</b> / 08</span><span class="segs">${MODS.map(() => '<i></i>').join('')}</span></div>
      <div id="vig"></div><div id="grain"></div>
      <div id="fade"></div>`;
  }

  /* ------------------------------------------------------------ construcción */
  let tl;
  function build() {
    $('#stage').innerHTML = markup();
    $$('i[data-i]').forEach((i) => { i.innerHTML = ICON[i.dataset.i] || ''; });

    tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const blurIn = (el, t, from = {}, dur = 0.7) => tl.fromTo(el, { opacity: 0, filter: 'blur(14px)', ...from },
      { opacity: 1, filter: 'blur(0px)', x: 0, y: 0, scale: 1, duration: dur, immediateRender: false }, t);
    const blurOut = (el, t, to = {}, dur = 0.45) => tl.to(el, { opacity: 0, filter: 'blur(14px)', duration: dur, ease: 'power2.in', ...to }, t);
    const float = (el, k, amp = 8, sp = 1.3) => fx(0, DURATION, (p, t) => { el.style.translate = `0 ${Math.sin(t * sp + k * 1.7) * amp}px`; });
    const hide = (sel) => gsap.set(sel, { opacity: 0 });
    const say = (sel, t0, t1) => {
      const ls = $$(`${sel} .ln`);
      hide(ls);
      ls.forEach((l, k) => blurIn(l, t0 + k * 0.12, { y: 30 }, 0.65));
      if (t1) ls.forEach((l, k) => blurOut(l, t1 + k * 0.04, { y: -24 }, 0.4));
    };
    const words = (els, t0, gap = 0.4) => { hide(els); els.forEach((w, k) => tl.fromTo(w, { letterSpacing: '0.5em', opacity: 0, filter: 'blur(12px)' },
      { letterSpacing: '0.005em', opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', immediateRender: false }, t0 + k * gap)); };
    // chips que entran en su momento (data-at, o escalonados desde t0) y salen juntos en t1
    const chipsIn = (els, t0, t1, gap = 0.3) => els.forEach((c, k) => {
      hide(c);
      const at = c.dataset.at ? +c.dataset.at - 0.15 : t0 + k * gap;
      tl.fromTo(c, { opacity: 0, scale: 0.7, y: 24, filter: 'blur(12px)' }, { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'back.out(1.7)', immediateRender: false }, at);
      float(c, k);
      if (t1) blurOut(c, t1 + k * 0.04, { scale: 0.8 }, 0.35);
    });
    // fila que entra deslizándose y se revela de izquierda a derecha
    const rowIn = (c, t0) => {
      hide(c);
      tl.fromTo(c, { opacity: 0, x: -40, scale: 0.9 }, { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: 'back.out(1.6)', immediateRender: false }, t0);
      tl.fromTo(c, { clipPath: 'inset(0 100% 0 0 round 22px)', filter: 'blur(8px)' }, { clipPath: 'inset(0 0% 0 0 round 22px)', filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', immediateRender: false }, t0);
    };
    const draw = (path, t0, dur, ease = 'power2.inOut') => {
      const L = path.getTotalLength();
      gsap.set(path, { strokeDasharray: `${L} ${L + 2}`, strokeDashoffset: L });
      tl.to(path, { strokeDashoffset: 0, duration: dur, ease }, t0);
    };
    // viaja una luz por un trazo (en bucle si loop) entre t0 y t1
    const travel = (dt, path, t0, dur, loop = 0, phase = 0, t1 = DURATION, ease = eo) => {
      const L = path.getTotalLength();
      fx(0, 0, (p, t) => {
        if (t < t0 || t > t1) { dt.style.opacity = 0; return; }
        let u = (t - t0) / dur + phase;
        if (loop) u %= 1; else u = clamp(u);
        const pt = path.getPointAtLength((loop ? u : ease(u)) * L);
        dt.setAttribute('cx', pt.x); dt.setAttribute('cy', pt.y);
        dt.style.opacity = loop ? Math.sin(u * Math.PI) : 1;
      });
    };
    const count = (el, t0, dur, to) => fx(t0, dur, (p) => { el.textContent = fmt(eo(p) * to); });
    const glowOn = (el, a, b) => fx(0, 0, (p, t) => {
      const on = t >= a && t < b;
      el.style.borderColor = on ? 'rgba(95,240,223,.75)' : '';
      el.style.boxShadow = on ? '0 0 0 6px rgba(56,225,208,.12), 0 0 46px rgba(56,225,208,.4), 0 34px 70px rgba(0,0,0,.5), inset 0 1.5px 0 rgba(255,255,255,.22)' : '';
    });
    const outAll = (sels, t) => tl.to(sels, { opacity: 0, filter: 'blur(14px)', duration: 0.45, ease: 'power2.in' }, t);

    // visibilidad por escena (no se dibuja lo que no está en pantalla)
    const win = (sel, a, b) => { const el = $(sel); fx(0, 0, (p, t) => { el.style.visibility = t >= a && t < b ? 'visible' : 'hidden'; }); };
    win('#intro', 0, T.m1 + 1.2);
    MODS.forEach((m, k) => win(`#m${k + 1}`, MSTART[k] - 0.6, MSTART[k + 1] + 0.6));
    win('#outro', T.out - 0.6, DURATION + 1);

    /* ---------- fondo vivo ---------- */
    fx(0, DURATION, (p, t) => {
      $('#glow').style.transform = `translate(${1300 + Math.sin(t * 0.21) * 330}px, ${760 + Math.cos(t * 0.17) * 110}px)`;
      $('#glow2').style.transform = `translate(${520 + Math.cos(t * 0.13) * 260}px, ${300 + Math.sin(t * 0.19) * 120}px)`;
      $('#grid').style.backgroundPosition = `0 ${(t * 22) % 110}px`;
    });
    const dots = $('#dots');
    const DOTS = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd() * H, r: 1.2 + rnd() * 2.6, s: 8 + rnd() * 22, ph: rnd() * 6.28, a: 0.15 + rnd() * 0.45 }));
    dots.innerHTML = DOTS.map(() => '<i></i>').join('');
    const dEls = $$('i', dots);
    fx(0, DURATION, (p, t) => DOTS.forEach((d, k) => {
      const y = ((d.y - t * d.s) % (H + 40) + H + 40) % (H + 40) - 20;
      dEls[k].style.cssText = `width:${d.r * 2}px;height:${d.r * 2}px;transform:translate(${d.x + Math.sin(t * 0.5 + d.ph) * 24}px,${y}px);opacity:${d.a * (0.6 + 0.4 * Math.sin(t * 1.3 + d.ph))};box-shadow:0 0 ${d.r * 5}px rgba(159,216,255,.9)`;
    }));
    const sweep = (t0, d = 2.6) => tl.fromTo('#sheen', { xPercent: 0 }, { xPercent: 420, duration: d, ease: 'none', immediateRender: false }, t0);
    sweep(0.3); sweep(T.una); MSTART.forEach((s) => sweep(s - 0.3)); sweep(T.end);
    tl.fromTo('#fade', { opacity: 1 }, { opacity: 0, duration: 1.0, ease: 'power1.out' }, 0);
    tl.to('#fade', { opacity: 1, duration: 1.0, ease: 'power1.in' }, DURATION - 1.0);
    // cámara: acercamiento lento en cada escena
    const CUTS = [0, T.arc, T.una, T.uno, T.mods, T.m1, T.m1b, T.m1c, T.m2, T.m2b, T.m2c, T.m3, T.m3b, T.m3c, T.m3d, T.m3e, T.m4, T.m4b, T.m4c,
      T.m5, T.m5b, T.m5c, T.m5d, T.m6, T.m6b, T.m6c, T.m6d, T.m6e, T.m7, T.m7b, T.m7c, T.m8, T.m8b, T.out, T.end];
    CUTS.forEach((s, k) => {
      const e = CUTS[k + 1] ?? DURATION;
      tl.fromTo('#cam', { scale: 1 }, { scale: 1.03, duration: e - s, ease: 'none', immediateRender: false }, s);
    });

    /* ---------- HUD, marca y número gigante ---------- */
    hide(['#hud', '#brand', '#bignum']);
    blurIn('#hud', T.m1 + 1.0, { y: -20 }, 0.6);
    blurIn('#brand', T.arc + 0.2, { x: -20 }, 0.6);
    blurOut('#hud', T.out - 0.4, {}, 0.4);
    blurOut('#brand', T.end - 0.4, {}, 0.4);
    const segs = $$('#hud .segs i');
    const navs = $$('#app .nav div'), scrns = $$('#app .scrn');
    fx(0, DURATION, (p, t) => {
      segs.forEach((s, k) => s.style.setProperty('--p', clamp((t - MSTART[k]) / (MSTART[k + 1] - MSTART[k]))));
      const k = modAt(t);
      if (k >= 0) { $('#hudN').textContent = MODS[k].n; $('#bignum b').textContent = MODS[k].n; }
      // la pantalla de la laptop cambia justo al inicio del bloque (cuando la laptop anterior ya salió)
      let ks = 0;
      for (let j = 0; j < 8; j++) if (t >= MSTART[j]) ks = j;
      scrns.forEach((s, j) => { s.style.visibility = j === ks ? 'visible' : 'hidden'; });
      navs.forEach((d, j) => d.classList.toggle('on', j === ks));
    });
    MSTART.slice(0, 8).forEach((s, k) => {
      tl.fromTo('#bignum', { opacity: 0, x: 120, filter: 'blur(20px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', immediateRender: false }, s + 0.8);
      tl.to('#bignum', { opacity: 0, x: -80, filter: 'blur(20px)', duration: 0.5, ease: 'power2.in' }, MSTART[k + 1] - 0.9);
    });

    /* ---------- laptop ---------- */
    const dev = $('#dev'), lap = $('#lap');
    $('#app').style.transform = `scale(${$('#scr').clientWidth / 1280})`;
    const POSE = {
      R: { x: 850, y: 230, scale: 0.9, rot: { rotationY: -28, rotationX: -12, rotationZ: 1.5 } },
      L: { x: -40, y: 230, scale: 0.9, rot: { rotationY: 26, rotationX: -12, rotationZ: -1.5 } },
      LL: { x: -90, y: 230, scale: 0.9, rot: { rotationY: 28, rotationX: -12, rotationZ: -1.5 } },
      P: { x: 120, y: 190, scale: 1.0, rot: { rotationY: 16, rotationX: -8, rotationZ: -1 } },
    };
    gsap.set(dev, { opacity: 0, x: POSE.R.x, y: POSE.R.y, scale: POSE.R.scale });
    gsap.set(lap, POSE.R.rot);
    fx(0, DURATION, (p, t) => { dev.style.translate = `0 ${Math.sin(t * 1.0) * 8}px`; });
    const devIn = (t, P, from = 1) => {
      tl.fromTo(dev, { x: P.x + 760 * from, y: P.y, scale: P.scale, opacity: 0, filter: 'blur(12px)' }, { x: P.x, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', immediateRender: false }, t);
      tl.fromTo(lap, { ...P.rot, rotationY: P.rot.rotationY - 24 * from }, { ...P.rot, duration: 1.6, ease: 'expo.out', immediateRender: false }, t);
    };
    const devTo = (t, P, dur = 1.1) => {
      tl.to(dev, { x: P.x, y: P.y, scale: P.scale, duration: dur, ease: 'power3.inOut' }, t);
      tl.to(lap, { ...P.rot, duration: dur, ease: 'power3.inOut' }, t);
      tl.to(dev, { keyframes: [{ filter: 'blur(4px)', duration: dur * 0.45, ease: 'power1.in' }, { filter: 'blur(0px)', duration: dur * 0.55, ease: 'power1.out' }] }, t);
    };
    const devOut = (t, dir = -1) => tl.to(dev, { x: `+=${960 * dir}`, opacity: 0, filter: 'blur(14px)', duration: 0.6, ease: 'power3.in' }, t);

    /* ---------- apertura de cada bloque ---------- */
    const tileIn = (k, t) => {
      const el = $(`#tile${k}`);
      hide(el);
      tl.fromTo(el, { opacity: 0, scale: 0.35, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.5)', immediateRender: false }, t);
      tl.fromTo(el, { filter: 'blur(20px)' }, { filter: 'blur(0px)', duration: 0.5, ease: 'power2.out', immediateRender: false }, t);
      tl.to(el, { scale: 2.6, opacity: 0, filter: 'blur(18px)', duration: 0.5, ease: 'power3.in' }, t + 1.0);
    };
    const heroIn = (k, t0, t1) => {
      const h = $(`#hero${k}`);
      h.style.top = `${540 - h.offsetHeight / 2}px`;
      hide($$('.kick, .sub', h));
      blurIn($('.kick', h), t0, { x: -30 }, 0.6);
      words($$('.l .w', h), t0 + 0.15, 0.32);
      blurIn($('.sub', h), t0 + 0.9, { y: 26 });
      blurOut(h, t1, { x: -160 }, 0.5);
    };
    // mosaico → título a la izquierda + laptop a la derecha con sus chips; t1 = cuando sale el título
    const open = (k, t1, laptopToo = true) => {
      const s = MSTART[k - 1];
      tileIn(k, s - 0.5);
      heroIn(k, s + 0.55, t1);
      if (laptopToo) devIn(s + 0.6, POSE.R);
      chipsIn($$(`#m${k} > .chip.hc`), s + 1.8, t1);
    };

    /* ================= INTRO ================= */
    hide(['#rhTile', '#introT .kickc', '#una', '#uno', '#modsH .sub2', '.modc']);
    tl.fromTo('#rhTile', { opacity: 0, scale: 0.3, rotation: -10 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.4)', immediateRender: false }, 0.4);
    tl.fromTo('#rhTile', { filter: 'blur(24px)' }, { filter: 'blur(0px)', duration: 0.8, ease: 'power2.out', immediateRender: false }, 0.4);
    draw($('#ir1'), 0.8, 1.6); draw($('#ir2'), 1.0, 1.8);
    $('#introRing').style.transformOrigin = '960px 380px';
    fx(0, T.arc + 1, (p, t) => { $('#introRing').style.transform = `rotate(${t * 6}deg)`; });
    blurIn('#introT .kickc', 1.5, { y: 20 }, 0.7);
    words($$('#introT .w'), 1.9, 0.45);
    fx(2.5, T.arc - 3, (p, t) => { $('#rhTile').style.translate = `0 ${Math.sin(t * 1.6) * 6}px`; });
    // el monograma vuela a la esquina y queda como marca
    tl.to('#rhTile', { x: -960 + 107, y: -380 + 81, scale: 0.17, opacity: 0, duration: 0.9, ease: 'power3.inOut' }, T.arc - 0.7);
    tl.to('#introRing', { opacity: 0, scale: 0.6, duration: 0.6, ease: 'power2.in' }, T.arc - 0.7);
    blurOut('#introT', T.arc - 0.65, { y: 40 }, 0.5);
    // arco del ciclo laboral: de la solicitud de la plaza a la desvinculación
    draw($('#arcPath'), T.arc + 0.1, 2.4);
    const an = $$('#arcSvg .an');
    hide(an);
    const arcAt = [10.0, 10.9, 11.3, 11.7, 12.1, 12.5];
    an.forEach((c, k) => tl.fromTo(c, { opacity: 0, scale: 0, transformOrigin: 'center', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, Math.min(arcAt[k] - 0.4, T.arc + 0.5 + k * 0.4)));
    $$('.arcc').forEach((c, k) => {
      gsap.set(c, { xPercent: -50 });
      hide(c);
      tl.fromTo(c, { opacity: 0, y: 30, scale: 0.7, filter: 'blur(12px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'back.out(1.6)', immediateRender: false }, arcAt[k] - 0.1);
      float(c, k, 6);
    });
    travel($('#comet'), $('#arcPath'), 9.4, 3.6, 1, 0, T.una - 0.6);
    say('#arcSay', 9.8, T.una - 0.6);
    // todo converge en "una sola dirección"
    $$('.arcc').forEach((c, k) => tl.to(c, { left: 960, top: 540, opacity: 0, scale: 0.4, filter: 'blur(10px)', duration: 0.7, ease: 'power3.in' }, T.una - 0.7 + k * 0.03));
    tl.to('#arcSvg', { opacity: 0, duration: 0.6, ease: 'power2.in' }, T.una - 0.6);
    tl.fromTo('#una', { opacity: 0, scale: 1.3, filter: 'blur(20px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, T.una);
    hide(['#una .unaS', '#una .unaD']);
    blurIn('#una .unaS', 16.2, { y: 16 }, 0.6);
    tl.fromTo('#una .unaD', { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.out', immediateRender: false }, 17.6);
    fx(T.una + 1, 6, (p, t) => { $('#una').style.translate = `0 ${Math.sin((t - T.una) * 2) * 5}px`; });
    blurOut('#una', T.uno - 0.45, { scale: 0.85 }, 0.45);
    // "Un ingreso, toda la gestión"
    gsap.set('#uno', { opacity: 1 });
    words($$('#uno .w'), T.uno, 0.95);
    blurOut('#uno', T.mods - 0.4, { scale: 1.1 }, 0.4);
    // más de 30 módulos, en 8 bloques
    words($$('#modsH .w'), T.mods + 0.1, 0.5);
    count($('#n30'), 22.8, 0.9, 30);
    blurIn('#modsH .sub2', 24.4, { y: 20 }, 0.6);
    $$('.modc').forEach((c, k) => {
      tl.fromTo(c, { opacity: 0, y: 80, rotationX: -40, scale: 0.85, filter: 'blur(12px)' }, { opacity: 1, y: 0, rotationX: 0, scale: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', immediateRender: false }, 24.0 + k * 0.22);
      float(c, k, 6, 1.1);
      glowOn(c, 26.2 + k * 0.9, 26.2 + (k + 1) * 0.9);
      tl.to(c, { opacity: 0, y: -40, scale: 0.9, filter: 'blur(14px)', duration: 0.45, ease: 'power2.in' }, T.m1 - 0.95 + k * 0.03);
    });
    blurOut('#modsH', T.m1 - 0.95, { y: -30 }, 0.45);

    /* ================= 01 · CONFIGURACIÓN ================= */
    open(1, T.m1b - 0.4);
    devTo(T.m1b - 0.3, POSE.L);
    gsap.set('#m1line', { scaleX: 0 });
    hide(['#m1circ', '#m1k', '#m1stats .st', '#m1cat', '#m1cat .tg']);
    tl.to('#m1line', { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, T.m1b + 0.2);
    tl.fromTo('#m1circ', { opacity: 0, scale: 0.2, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)', immediateRender: false }, T.m1b + 0.7);
    say('#m1say', T.m1b + 0.8, 50.0);
    blurIn('#m1k', 50.5, { x: 30 }, 0.6);
    [51.7, 53.3, 54.1].forEach((t0, k) => {
      const s = $$('#m1stats .st')[k];
      blurIn(s, t0 - 0.2, { x: 40 }, 0.6);
      count($('.stn', s), t0 - 0.2, 1.4, +$('.stn', s).dataset.to);
      blurOut(s, T.m1c - 0.6 + k * 0.05, { x: 60 }, 0.4);
    });
    blurOut('#m1k', T.m1c - 0.6, {}, 0.4);
    tl.to(['#m1circ', '#m1line'], { opacity: 0, duration: 0.4 }, T.m1c - 0.5);
    devTo(T.m1c - 0.3, POSE.LL);
    blurIn('#m1cat', T.m1c + 0.1, { x: 60, scale: 0.95 }, 0.8);
    [58.3, 59.1, 60.0, 61.2, 62.0, 63.2].forEach((t0, k) => {
      const g = $$('#m1cat .tg')[k];
      tl.fromTo(g, { opacity: 0, x: 30 }, { opacity: 0.45, x: 0, duration: 0.5, immediateRender: false }, T.m1c + 0.6 + k * 0.15);
      tl.to(g, { opacity: 1, duration: 0.3 }, t0 - 0.1);
      const sw = $('.sw', g), kn = $('.sw i', g);
      fx(t0, 0.35, (p) => { const e = eo(p); kn.style.transform = `translateX(${e * 44}px)`; kn.style.background = p > 0.5 ? '#5FF0DF' : '#7C86A6'; kn.style.boxShadow = p > 0.5 ? '0 0 16px #5FF0DF' : 'none'; sw.style.background = `rgba(56,225,208,${0.12 + e * 0.3})`; });
    });
    blurOut('#m1cat', T.m2 - 0.6, { x: 60 }, 0.45);
    devOut(T.m2 - 0.7, -1);

    /* ================= 02 · EXPEDIENTE ================= */
    open(2, T.m2b - 0.4);
    devTo(T.m2b - 0.3, POSE.L);
    gsap.set('#m2line', { scaleX: 0 }); gsap.set('#m2v', { scaleY: 0 });
    hide(['#m2circ', '.m2s']);
    tl.to('#m2line', { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, T.m2b + 0.1);
    tl.fromTo('#m2circ', { opacity: 0, scale: 0.2, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)', immediateRender: false }, T.m2b + 0.5);
    tl.to('#m2v', { scaleY: 1, duration: 0.7, ease: 'power2.out' }, T.m2b + 0.8);
    $$('.m2a').forEach((c, k) => {
      rowIn(c, +c.dataset.at - 0.2);
      float(c, k, 5);
      blurOut(c, T.m2c - 0.6 + k * 0.05, { x: 40 }, 0.4);
    });
    tl.to(['#m2circ', '#m2line', '#m2v'], { opacity: 0, duration: 0.4 }, T.m2c - 0.5);
    devOut(T.m2c - 0.6, -1);
    say('#m2say', 85.4, T.m3 - 0.7);
    const sio = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
    draw($('#m2sp'), T.m2c + 0.2, 4.2, 'sine.inOut');
    travel($('#m2dot'), $('#m2sp'), T.m2c + 0.2, 4.2, 0, 0, T.m3 - 0.6, sio);
    // cada peldaño aparece cuando la luz llega a su esquina
    const m2L = $('#m2sp').getTotalLength();
    $$('.m2s').forEach((s, k) => {
      const f = [0, 490, 980, 1470][k] / m2L;
      blurIn(s, T.m2c + 0.2 + (Math.acos(1 - 2 * f) / Math.PI) * 4.2 - 0.05, { y: 30, scale: 0.9 }, 0.6);
      float(s, k, 5, 1.1);
    });
    outAll(['#m2stairs', '.m2s', '#m2say'], T.m3 - 0.6);

    /* ================= 03 · INGRESO DE PERSONAL ================= */
    open(3, T.m3b - 0.3);
    devOut(T.m3b - 0.5, 1);
    hide(['.m3st', '#m3track', '#m3k', '.m3n', '#m3sign', '#m3fk', '.m3f', '.m3c']);
    gsap.set('#m3fill', { scaleX: 0 });
    say('#m3say1', T.m3b + 0.2, T.m3c - 0.6);
    tl.fromTo('#m3track', { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, T.m3b + 0.3);
    const STEP = [98.5, 100.0, 101.4, 102.2, 102.6, 103.0];
    const STI = ['idcard', 'users', 'award', 'briefcase', 'star', 'file'];
    $$('.m3st').forEach((s, k) => {
      tl.fromTo(s, { opacity: 0, y: 30, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.8)', immediateRender: false }, T.m3b + 0.6 + k * 0.15);
      fx(STEP[k], 0, (p) => { s.classList.toggle('ok', p >= 1); $('.dot i', s).innerHTML = p >= 1 ? ICON.check : ICON[STI[k]]; });
      tl.fromTo($('.dot', s), { scale: 1 }, { keyframes: [{ scale: 1.25, duration: 0.15 }, { scale: 1, duration: 0.3 }], immediateRender: false }, STEP[k]);
    });
    fx(0, 0, (p, t) => {
      let f = 0;
      for (let k = 0; k < 5; k++) f += clamp((t - STEP[k]) / (STEP[k + 1] - STEP[k]));
      $('#m3fill').style.transform = `scaleX(${f / 5})`;
    });
    chipsIn($$('.m3b'), 0, T.m3c - 0.6);
    outAll(['.m3st', '#m3track', '#m3fill'], T.m3c - 0.6);
    // lado institucional
    devIn(T.m3c - 0.1, POSE.L, -1);
    blurIn('#m3k', T.m3c + 0.4, { x: 30 }, 0.6);
    $$('.m3i').forEach((c, k) => { rowIn(c, +c.dataset.at - 0.2); float(c, k, 5); blurOut(c, T.m3d - 0.6 + k * 0.05, { x: 40 }, 0.4); });
    blurOut('#m3k', T.m3d - 0.6, {}, 0.4);
    devOut(T.m3d - 0.6, -1);
    // contrataciones: plaza vacante o plaza nueva → firma de contrato
    say('#m3say2', T.m3d + 0.2, T.m3e - 0.25);
    const m3p = $$('#m3wires path');
    // las dos rutas aparecen tenues y se encienden cuando la voz las nombra
    $$('.m3n').forEach((n, k) => {
      tl.fromTo(n, { opacity: 0, x: -50, filter: 'blur(12px)' }, { opacity: 0.45, x: 0, filter: 'blur(0px)', duration: 0.7, immediateRender: false }, 114.6 + k * 0.3);
      tl.to(n, { opacity: 1, duration: 0.3 }, [117.0, 118.8][k]);
      glowOn(n, [117.0, 118.8][k], [118.8, 120.4][k]);
    });
    draw(m3p[0], 117.5, 1.2); draw(m3p[1], 119.3, 1.0);
    draw(m3p[2], 120.1, 0.4);
    blurIn('#m3sign', 120.4, { scale: 1.2 }, 0.8);
    $$('#m3wires .m3p').forEach((d, k) => travel(d, m3p[k], 120.6 + k * 0.4, 1.6, 1, 0, T.m3e - 0.6));
    fx(120.4, 2, (p, t) => { $('#m3sign').style.translate = `0 ${Math.sin(t * 2) * 4}px`; });
    blurIn('#m3fk', 120.9, { y: 16 }, 0.5);
    $$('.m3f').forEach((f, k) => {
      f.style.top = `${710 + k * 82}px`;
      tl.fromTo(f, { opacity: 0, x: -30, filter: 'blur(10px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.5, ease: 'back.out(1.6)', immediateRender: false }, 120.7 + k * 0.18);
    });
    outAll(['.m3n', '#m3sign', '#m3fk', '.m3f', '#m3wires'], T.m3e - 0.25);
    // talento externo: consultorías
    say('#m3say3', T.m3e + 0.3, T.m4 - 0.7);
    const m3c = $$('.m3c');
    m3c.forEach((c, k) => {
      tl.fromTo(c, { opacity: 0, x: 200, rotationY: -30, filter: 'blur(14px)' }, { opacity: 0.4, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, 123.4 + k * 0.15);
      const a = +c.dataset.at;
      tl.to(c, { opacity: 1, y: -14, duration: 0.45, ease: 'back.out(1.8)' }, a - 0.15);
      glowOn(c, a - 0.15, (k < 4 ? +m3c[k + 1].dataset.at : T.m4 - 0.7) - 0.15);
      float(c, k, 6, 1.1);
      blurOut(c, T.m4 - 0.7 + k * 0.04, { y: -40 }, 0.4);
    });

    /* ================= 04 · MOVIMIENTOS ================= */
    open(4, T.m4b - 0.3);
    devOut(T.m4b - 0.5, 1);
    hide(['.m4c', '.m4d', '.m4n', '#m4wires']);
    const m4c = $$('.m4c');
    const M4F = [137.2, 140.0, 145.3, 151.0, 156.2, T.m4c - 0.6];
    m4c.forEach((c, k) => {
      tl.fromTo(c, { opacity: 0, y: 80, scale: 0.85, filter: 'blur(14px)' }, { opacity: 0.4, y: 0, scale: 0.95, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', immediateRender: false }, T.m4b + k * 0.1);
      tl.to(c, { opacity: 1, scale: 1.03, y: -18, duration: 0.5, ease: 'back.out(1.6)' }, M4F[k]);
      blurIn($('.m4d', c), M4F[k] + 0.4, { y: 14 }, 0.5);
      if (k < 4) tl.to(c, { opacity: 0.8, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' }, M4F[k + 1]);
      glowOn(c, M4F[k], M4F[k + 1]);
      blurOut(c, T.m4c - 0.6 + k * 0.04, { y: -30 }, 0.4);
    });
    // mini animaciones de cada forma de movimiento
    const at = (el, x, y) => { el.setAttribute('cx', x); el.setAttribute('cy', y); };
    fx(T.m4b, T.m4c - T.m4b, (p, t) => {
      const tt = Math.max(0, t - T.m4b);
      const u = (tt % 3) / 3, st = [[55, 172], [125, 122], [200, 72]];
      const i = Math.min(2, Math.floor(u * 3)), f = eo(clamp((u * 3 - i) * 1.6)), a = st[Math.max(0, i - 1)], b = st[i];
      at(m4c[0].querySelector('.d'), i ? lerp(a[0], b[0], f) : b[0], i ? lerp(a[1], b[1], f) - Math.sin(f * Math.PI) * 30 : b[1]);
      const o = m4c[1], ang = tt * 1.4, v = (tt % 4) / 4;
      at($('.o1', o), 132 + Math.cos(ang) * 78, 110 + Math.sin(ang) * 78);
      const r2 = lerp(78, 140, clamp(v * 2 - 1)), r3 = lerp(140, 78, clamp(v * 2));
      at($('.o2', o), 132 + Math.cos(ang + 2.1) * r2, 110 + Math.sin(ang + 2.1) * r2);
      $('.o2', o).style.opacity = 1 - clamp(v * 2 - 1);
      at($('.o3', o), 132 + Math.cos(ang + 4.2) * r3, 110 + Math.sin(ang + 4.2) * r3);
      $('.o3', o).style.opacity = clamp(v * 3);
      const w3 = (tt % 3.2) / 3.2;
      at(m4c[2].querySelector('.d'), lerp(62, 202, w3 < 0.5 ? eo(clamp(w3 * 2.4)) : 1 - eo(clamp((w3 - 0.5) * 2.4))), 110);
      const pm = m4c[3], w4 = eo(clamp(((tt % 2.6) / 2.6) * 1.5)), s4 = Math.floor(tt / 2.6) % 2;
      const P = (q) => [lerp(50, 214, q), 110 - Math.sin(q * Math.PI) * 52];
      const A = P(s4 ? 1 - w4 : w4), B = P(s4 ? w4 : 1 - w4);
      at($('.d1', pm), A[0], A[1]); at($('.d2', pm), B[0], 220 - B[1]);
      const d5 = m4c[4].querySelector('.d'), w5 = (tt % 3) / 3;
      at(d5, lerp(62, 202, eo(clamp(w5 * 1.6))), 110);
      d5.style.opacity = w5 > 0.9 ? 1 - (w5 - 0.9) * 10 : 1;
    });
    // todos comparten la misma lógica
    say('#m4say2', T.m4c + 0.1, T.m5 - 0.6);
    [162.4, 164.6, 166.8].forEach((t0, k) => blurIn($$('.m4n')[k], t0 - 0.3, { x: -40 }, 0.6));
    tl.set('#m4wires', { opacity: 1 }, T.m4c);
    $$('#m4wires path').forEach((p, k) => draw(p, [163.6, 165.8][k], 0.5));
    const m4path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    m4path.setAttribute('d', 'M560 540 H1360'); m4path.style.display = 'none'; $('#m4wires').appendChild(m4path);
    travel($('.m4p'), m4path, 166.4, 1.4, 1, 0, T.m5 - 0.6);
    outAll(['.m4n', '#m4wires'], T.m5 - 0.6);

    /* ================= 05 · CONTROL DE TIEMPO ================= */
    open(5, T.m5b - 0.3);
    devOut(T.m5b - 0.5, 1);
    hide(['#m5calh', '#m5cal i', '#m5leg', '#m5ring', '.m5c']);
    say('#m5say1', 174.0, 175.9);
    say('#m5say1b', 176.1, T.m5c - 0.6);
    blurIn('#m5calh', T.m5b + 0.3, { y: -20 }, 0.6);
    $$('#m5cal i').forEach((c, j) => {
      const r = Math.floor(j / 7), col = j % 7;
      tl.fromTo(c, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', immediateRender: false }, T.m5b + 0.4 + (r + col) * 0.06);
      tl.fromTo($('b', c), { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 174.2 + (r + col) * 0.12);
    });
    blurIn('#m5leg', 177.6, { y: 20 }, 0.6);
    outAll(['#m5calh', '#m5cal', '#m5leg'], T.m5c - 0.6);
    say('#m5say2', T.m5c + 0.2, T.m5d - 0.15);
    tl.fromTo('#m5ring', { opacity: 0, scale: 0.6, filter: 'blur(16px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, T.m5c + 0.2);
    fx(T.m5c, T.m5d - T.m5c, (p, t) => {
      $$('#m5ring .rp').forEach((c, k) => { const u = (((t - T.m5c) / 1.8) + k / 3) % 1; c.setAttribute('r', 150 + u * 130); c.style.opacity = (1 - u) * 0.8; });
      $('#m5clock').textContent = `07:58:${String((30 + Math.floor(t - T.m5c)) % 60).padStart(2, '0')}`;
    });
    $$('.m5m').forEach((c, k) => { rowIn(c, +c.dataset.at - 0.2); float(c, k, 5); });
    outAll(['#m5ring', '.m5m'], T.m5d - 0.15);
    say('#m5say3', T.m5d + 0.4, T.m6 - 0.7);
    $$('.m5c').forEach((c, k) => {
      tl.fromTo(c, { opacity: 0, y: 100, rotationX: -30, filter: 'blur(14px)' }, { opacity: 1, y: 0, rotationX: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, +c.dataset.at - 0.3);
      float(c, k, 7, 1.1);
      blurOut(c, T.m6 - 0.7 + k * 0.04, { y: -30 }, 0.4);
    });

    /* ================= 06 · NÓMINA ================= */
    open(6, T.m6b - 0.3);
    devTo(T.m6b - 0.3, POSE.P);
    hide(['#m6k', '.m6s', '#m6sv', '#m6bars', '#m6leg', '#m6ring', '#m6steps .m6st', '.m6c']);
    blurIn('#m6k', T.m6b + 0.2, { x: 30 }, 0.5);
    const m6s = $$('.m6s');
    m6s.forEach((s, k) => {
      const t0 = +s.dataset.at;
      tl.fromTo(s, { opacity: 0, x: 50, filter: 'blur(14px)' }, { opacity: 0.5, x: 0, filter: 'blur(0px)', duration: 0.6, immediateRender: false }, T.m6b + 0.4 + k * 0.25);
      tl.to(s, { opacity: 1, duration: 0.3 }, t0 - 0.1);
      const ck = $('.ck', s);
      gsap.set($('i', ck), { opacity: 0, scale: 0.3 });
      tl.to($('i', ck), { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, t0);
      tl.to(ck, { backgroundColor: k === 4 ? '#12B5A6' : '#0066FF', borderColor: '#fff', boxShadow: '0 0 24px rgba(0,102,255,.9)', duration: 0.3 }, t0);
      glowOn(s, t0, k < 4 ? +m6s[k + 1].dataset.at : T.m6c - 0.15);
      blurOut(s, T.m6c - 0.15 + k * 0.04, { x: 50 }, 0.4);
    });
    tl.to('#m6sv', { opacity: 1, duration: 0.6 }, T.m6b + 1.2);
    chipsIn($$('.m6x'), 0, T.m6c - 0.15);
    outAll(['#m6sv', '#m6k'], T.m6c - 0.15);
    devOut(T.m6c - 0.15, -1);
    // presupuesto
    say('#m6say1', T.m6c + 0.45, T.m6d - 0.6);
    tl.set('#m6bars', { opacity: 1 }, T.m6c);
    $$('#m6bars .grp').forEach((g, k) => {
      tl.fromTo($$('.b', g), { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.12, immediateRender: false }, 215.2 + k * 0.42);
      tl.fromTo($('small', g), { opacity: 0 }, { opacity: 1, duration: 0.4, immediateRender: false }, 215.2 + k * 0.42);
    });
    blurIn('#m6leg', 222.2, { y: 20 }, 0.5);
    draw($('#m6trp'), 223.6, 0.9);
    outAll(['#m6bars', '#m6leg', '#m6tr'], T.m6d - 0.6);
    // refrenda: proceso anual de plazas en 9 pasos
    tl.fromTo('#m6ring', { opacity: 0, scale: 0.7, filter: 'blur(16px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, T.m6d + 0.1);
    say('#m6say2', 225.7, T.m6e - 0.5);
    const arc = $('#m6arc'), AL = 2 * Math.PI * 240;
    fx(0, 0, (p, t) => {
      const q = clamp((t - 227.3) / 7.3), s = q * 9;
      const f = q >= 1 ? 1 : (Math.floor(s) + eo(s % 1)) / 9;
      arc.setAttribute('stroke-dasharray', `${AL * f} ${AL}`);
      $$('#m6ring .rt').forEach((r, k) => { const on = s >= k + 0.5; r.style.opacity = on ? 1 : 0.3; r.setAttribute('fill', on ? '#5FF0DF' : 'rgba(159,216,255,.85)'); });
      $('#m6rt').textContent = q >= 1 ? 'Completa' : '9 pasos';
    });
    [228.6, 230.8, 232.0, 233.1, 234.2].forEach((t0, k) => blurIn($$('#m6steps .m6st')[k], t0 - 0.2, { x: 30 }, 0.5));
    outAll(['#m6ring', '#m6steps'], T.m6e - 0.5);
    // aumentos, beneficios, constancias, remuneraciones
    $$('.m6c').forEach((c, k) => {
      tl.fromTo(c, { opacity: 0, scale: 0.7, y: 40, filter: 'blur(14px)' }, { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'back.out(1.5)', immediateRender: false }, +c.dataset.at - 0.3);
      float(c, k, 6, 1.1);
      blurOut(c, T.m7 - 0.7 + k * 0.04, { y: -30 }, 0.4);
    });

    /* ================= 07 · EVALUACIÓN ================= */
    open(7, T.m7b - 0.3);
    devOut(T.m7b - 0.5, 1);
    hide(['#m7radar', '#m7radar .rl', '#m7radar .rv', '.m7f', '#m7arw']);
    tl.fromTo('#m7radar', { opacity: 0, scale: 0.8, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, T.m7b);
    $('#m7radar').style.transformOrigin = '640px 560px';
    say('#m7say', 249.5, T.m7c - 0.5);
    const RV = [0.88, 0.82, 0.91, 0.76], RT = [251.4, 252.7, 254.0, 255.1];
    RT.forEach((t0, k) => { blurIn($$('#m7radar .rl')[k], t0, { y: 10 }, 0.5); tl.to($$('#m7radar .rv')[k], { opacity: 1, duration: 0.3 }, t0); });
    const rv = $$('#m7radar .rv');
    fx(0, 0, (p, t) => {
      const b = 1 + Math.sin(t * 2.2) * 0.02;
      const r = RV.map((v, k) => v * RR * eo(clamp((t - RT[k]) / 0.8)) * b);
      $('#m7poly').setAttribute('d', `M0 ${-r[0]} L${r[1]} 0 L0 ${r[2]} L${-r[3]} 0Z`);
      [[0, -r[0]], [r[1], 0], [0, r[2]], [-r[3], 0]].forEach(([x, y], k) => { rv[k].setAttribute('cx', x); rv[k].setAttribute('cy', y); });
    });
    $$('.m7f').forEach((f, k) => { blurIn(f, +f.dataset.at - 0.3, { x: 60 }, 0.7); float(f, k, 5); });
    tl.to('#m7arw', { opacity: 1, duration: 0.5 }, 258.0);
    outAll(['#m7radar', '.m7f', '#m7arw'], T.m8 - 0.6);

    /* ================= 08 · SANCIONES Y RENUNCIA ================= */
    open(8, T.m8b - 0.3, false);
    hide(['#m8k1', '#m8grav', '.m8n', '#m8acu', '#m8k2', '.m8r', '#m8ring', '#m8lbl', '#m8dig']);
    const m8p = $$('#m8tree path');
    hide(m8p);
    blurIn('#m8k1', T.m8b + 0.1, { x: 30 }, 0.5);
    blurIn($$('.m8n')[0], 264.4, { y: -30 }, 0.6);
    tl.set([m8p[0], m8p[1]], { opacity: 1 }, 266.2);
    draw(m8p[0], 266.3, 1.2); draw(m8p[1], 266.5, 1.2);
    blurIn('#m8grav', 266.4, { y: 10 }, 0.5);
    blurIn($$('.m8n')[1], 267.3, { y: 30 }, 0.6);
    blurIn($$('.m8n')[2], 269.3, { y: 30 }, 0.6);
    tl.set(m8p[3], { opacity: 1 }, 271.6); draw(m8p[3], 271.6, 0.4);
    blurIn('#m8acu', 271.8, { y: 20, scale: 0.85 }, 0.6);
    blurIn('#m8k2', 273.4, { x: 30 }, 0.5);
    blurIn($$('.m8r')[0], 275.4, { x: -40 }, 0.6);
    blurIn($$('.m8r')[1], 275.9, { x: -40 }, 0.6);
    blurIn('#m8dig', 276.9, { y: 20, scale: 0.85 }, 0.6);
    float($('#m8dig'), 1, 5);
    tl.set(m8p[2], { opacity: 1 }, 277.8);
    draw(m8p[2], 277.8, 1.6);
    tl.fromTo('#m8ring', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2)', immediateRender: false }, 279.3);
    blurIn('#m8lbl', 279.6, { y: 20 }, 0.5);
    outAll(['#m8k1', '#m8grav', '#m8tree', '.m8n', '#m8acu', '#m8k2', '.m8r', '#m8ring', '#m8lbl', '#m8dig'], T.out - 0.25);

    /* ================= CIERRE ================= */
    hide(['.nn', '.nl', '.ns2', '#netTile', '.ns', '#endT', '#endPill', '#endGob']);
    $$('.nn').forEach((n, k) => {
      tl.fromTo(n, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)', immediateRender: false }, 280.9 + k * 0.12);
      float(n, k, 6);
    });
    tl.fromTo('#netTile', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.6)', immediateRender: false }, 283.8);
    $$('.ns2').forEach((l, k) => { tl.set(l, { opacity: 1 }, 284.0); draw(l, 284.0 + k * 0.06, 0.7); });
    $$('.nl').forEach((l, k) => tl.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.5, immediateRender: false }, 284.8 + k * 0.03));
    fx(285.5, 3, (p, t) => $$('.nl').forEach((l, k) => { l.setAttribute('stroke', `rgba(97,158,255,${0.25 + 0.35 * Math.max(0, Math.sin(t * 2.4 - k * 0.5))})`); }));
    [281.5, 282.5, 283.9].forEach((t0, k) => blurIn($$('.ns')[k], t0 - 0.1, { y: 30 }, 0.7));
    // todo converge al centro y aparece la imagen final
    $$('.nn').forEach((n, k) => tl.to(n, { left: 900, top: 441, opacity: 0, scale: 0.3, filter: 'blur(10px)', duration: 0.7, ease: 'power3.in' }, T.end - 0.8 + k * 0.03));
    tl.to(['#netSvg', '.ns'], { opacity: 0, filter: 'blur(12px)', duration: 0.6, ease: 'power2.in' }, T.end - 0.8);
    tl.to('#netTile', { scale: 2.4, opacity: 0, filter: 'blur(18px)', duration: 0.5, ease: 'power3.in' }, T.end - 0.2);
    tl.fromTo('#endPill', { opacity: 0, scale: 1.25, filter: 'blur(18px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, T.end + 0.1);
    tl.fromTo('#endPill .rh', { scale: 0.3, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2)', immediateRender: false }, T.end + 0.35);
    blurIn('#endT', T.end + 1.6, { y: -24 }, 0.7);
    blurIn('#endGob', T.end + 2.2, { y: 20 }, 0.7);
    fx(T.end + 1, 20, (p, t) => { $('#endPill').style.translate = `0 ${Math.sin((t - T.end) * 1.8) * 4}px`; });

    tl.set({}, {}, DURATION);
  }

  /* ------------------------------------------------------------ grano (evita el bandeado de los degradados) */
  function grain() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
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
  window.__size = [W, H];
  window.__T = T;

  function fit() {
    if (RENDER) return;
    const ui = 52;
    const s = Math.min(innerWidth / W, (innerHeight - ui) / H);
    const st = $('#stage');
    st.style.transform = `scale(${s})`;
    st.style.left = `${(innerWidth - W * s) / 2}px`;
    st.style.top = `${(innerHeight - ui - H * s) / 2}px`;
  }

  async function init() {
    await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Manrope Variable"`)));
    await document.fonts.ready;
    build();
    grain();
    await Promise.all($$('img').map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
    seek(0);
    window.__ready = true;
    if (!RENDER) startPreview();
  }

  function startPreview() {
    fit();
    addEventListener('resize', fit);
    const scrub = $('#scrub'), tc = $('#time'), voz = $('#voz'), jump = $('#jump');
    scrub.max = DURATION;
    jump.innerHTML = Object.entries(T).map(([k, v]) => `<option value="${v}">${k}</option>`).join('');
    let clock = null;
    const playFrom = (t0) => { const p0 = performance.now(); clock = () => t0 + (performance.now() - p0) / 1000; voz.currentTime = t0; voz.play().catch(() => {}); };
    const stop = () => { clock = null; voz.pause(); };
    $('#play').onclick = () => (clock ? stop() : playFrom(current >= DURATION ? 0 : current));
    jump.onchange = () => { stop(); seek(+jump.value); scrub.value = current; };
    scrub.oninput = () => { stop(); seek(+scrub.value); };
    addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (clock) stop(); else playFrom(current); } });
    const loop = () => {
      if (clock) { let t = clock(); if (t >= DURATION) { t = DURATION; stop(); } seek(t); scrub.value = t; }
      tc.textContent = `${current.toFixed(2)} s`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  init();
})();
