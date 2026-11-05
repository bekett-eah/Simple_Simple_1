/* Pasos a seguir de cada trámite, horarios de atención y citas, para el asistente (asistente.js) y el chat de WhatsApp
   (whatsapp.html). Los pasos se arman con la ficha del catálogo (costo, tiempo e institución), con si el trámite tiene
   formulario en el nuevo diseño (formularios.js) o se hace en el portal de la institución, y con si permite cita (citas.js).
   canal: 'web' (el asistente, por defecto) o 'whatsapp', que cambia cómo se llena la solicitud, se paga y se recibe.
   Las citas ofrecen los próximos días hábiles y, de ejemplo, algunos horarios ya ocupados (siempre los mismos).
   Se carga después de formularios.js y citas.js. */
window.PASOS_TRAMITE = (() => {
  const formularios = window.FORMULARIOS_TRAMITES || {};
  const citas = window.CITAS_TRAMITES || {};
  const normalizar = texto => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function horaLegible(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  }
  // Horario de atención: el de la sede o, si no tiene uno propio, el del trámite (citas.js); de lunes a viernes
  const horarioDe = (cita, sede) => sede?.horario || cita.horario;
  const horarioLargo = h => `de lunes a viernes, de ${horaLegible(h.desde)} a ${horaLegible(h.hasta)}`;
  const horarioCorto = h => `Lun a vie, ${horaLegible(h.desde)} a ${horaLegible(h.hasta)}`;

  function costoDe(t) {
    const texto = normalizar(t.costo);
    if (texto.startsWith('no tiene costo') || texto.includes('gratu')) return { resumen: 'No tiene costo' };
    const montos = (t.costo.match(/\$\s?[\d.,]+/g) || []).map(m => m.replace(/\s/, '').replace(/[.,]$/, ''));
    if (!montos.length) return { resumen: 'El costo no está indicado' };
    if (montos.length === 1) return { resumen: `Cuesta ${montos[0]}`, pago: montos[0] };
    const valor = m => parseFloat(m.slice(1).replace(/,/g, ''));
    const minimo = montos.reduce((a, b) => (valor(b) < valor(a) ? b : a));
    return { resumen: `Cuesta desde ${minimo}, según lo que solicites,`, pago: `desde ${minimo}` };
  }

  function pasosDe(t, canal = 'web') {
    const costo = costoDe(t);
    // "la PNC", "el MJSP", "la Dirección General de…": el artículo sale de la primera palabra del nombre completo
    const articulo = /(a|ion|dad)$/.test(normalizar(t.institucion.split(' ')[0])) ? 'la' : 'el';
    const entrega = `${articulo} ${t.institucion.replace(/.*\(([^)]+)\).*/, '$1')}`;
    const enLinea = Boolean(formularios[t.numero]);
    const cita = citas[t.numero];
    const whatsapp = canal === 'whatsapp';
    // "Tarda 5 días hábiles"; los tiempos escritos como frase ("A partir del…") se dejan tal cual
    const tarda = /^(\d|hasta)/i.test(t.tiempo) ? `Tarda ${t.tiempo.charAt(0).toLowerCase()}${t.tiempo.slice(1)}` : `${t.tiempo}`;
    // Por WhatsApp los textos son más cortos: cada paso va en una sola línea del mensaje
    const llenar = whatsapp
      ? { titulo: cita ? 'Responde las preguntas o agenda tu cita' : 'Responde las preguntas', texto: cita ? `Aquí mismo, uno por uno, o con cita presencial; atienden ${horarioLargo(cita.horario)}` : 'Te pedimos los datos aquí, uno por uno' }
      : { titulo: cita ? 'Llena el formulario o agenda tu cita' : 'Llena el formulario', texto: cita ? `Hazlo en línea en Simple.sv o agenda una cita en la institución desde este chat; atienden ${horarioLargo(cita.horario)}` : 'Lo llenas en línea en Simple.sv, sin hacer filas' };
    const pago = whatsapp
      ? `Con tarjeta, en un enlace seguro que te enviamos aquí${cita ? '; con cita, pagas en la sede' : ''}`
      : `Pagas ${costo.pago} con tarjeta al terminar el formulario${cita ? '; si vas con cita, pagas en la sede' : ''}`;
    return [
      { titulo: 'Revisa lo que necesitas', texto: `${costo.resumen} y lo entrega ${entrega}${whatsapp ? '' : '. Los requisitos están en la ficha oficial del trámite'}` },
      enLinea ? llenar : { titulo: 'Inicia en el portal de la institución', texto: 'Este trámite se hace en el portal oficial de la institución; se abre en una pestaña nueva' },
      costo.pago && { titulo: 'Paga el trámite', texto: enLinea ? pago : `Pagas ${costo.pago} en el portal de la institución` },
      { titulo: 'La institución lo revisa', texto: tarda },
      !enLinea ? { titulo: 'Recibe tu documento', texto: 'Sigue el trámite en el portal de la institución y guarda tu comprobante' }
        : whatsapp ? { titulo: 'Recibe tu documento', texto: 'Te avisamos aquí y lo descargas en Mis documentos' }
        : { titulo: 'Recibe tu documento', texto: 'Lo descargas en Mis documentos. Te avisamos por correo cuando finalice y, si quieres, también por WhatsApp' }
    ].filter(Boolean);
  }

  /* Citas */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS_A_OFRECER = 5;
  const capitalizar = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
  const fechaDe = iso => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
  const isoDe = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const fechaLarga = f => `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
  const fechaCorta = f => capitalizar(`${DIAS[f.getDay()].slice(0, 3)} ${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}`);
  const minutosDe = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const horaDe = minutos => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

  // Los próximos días hábiles, desde mañana
  function diasDisponibles() {
    const dias = [];
    const dia = new Date();
    while (dias.length < DIAS_A_OFRECER) {
      dia.setDate(dia.getDate() + 1);
      if (dia.getDay() !== 0 && dia.getDay() !== 6) dias.push(new Date(dia));
    }
    return dias;
  }

  // Horarios libres de ejemplo: en cada sede y día algunos ya están ocupados (siempre los mismos)
  function horariosLibres(cita, sede, fecha) {
    const { desde, hasta, cada } = horarioDe(cita, cita.sedes[sede]);
    const libres = [];
    for (let m = minutosDe(desde); m < minutosDe(hasta); m += cada) {
      const semilla = [...`${fecha}-${sede}-${m}`].reduce((s, c) => Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
      if (semilla % 3) libres.push(horaDe(m));
    }
    return libres;
  }

  // Lo que hay que llevar: lo de citas.js y, si el trámite tiene costo, su pago en la sede (por documento, si pide varios)
  function queLlevar(t, cita, cantidad = 1) {
    const costo = costoDe(t);
    const varios = cantidad > 1 ? ` por cada documento (${cantidad} en total)` : '';
    const pago = costo.resumen === 'No tiene costo' ? []
      : [costo.pago && !costo.pago.startsWith('desde') ? `El pago de ${costo.pago}${varios}, que se hace en la sede` : 'El pago del trámite, que se hace en la sede'];
    return [...cita.llevar, ...pago];
  }

  // Archivo .ics de la cita para el calendario del teléfono o la computadora, con recordatorio un día antes.
  // sede: índice en cita.sedes; fecha: 'AAAA-MM-DD'; hora: 'HH:MM'
  function descargarCalendario(t, cita, { sede, fecha, hora, codigo, cantidad = 1 }) {
    const s = cita.sedes[sede];
    const inicio = fechaDe(fecha);
    inicio.setHours(...hora.split(':').map(Number));
    const fin = new Date(inicio.getTime() + horarioDe(cita, s).cada * 60000);
    const utc = f => f.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const texto = x => x.replace(/([\\,;])/g, '\\$1');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Simple.sv//Citas//ES', 'BEGIN:VEVENT',
      `UID:cita-${codigo}@simple.sv`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(inicio)}`, `DTEND:${utc(fin)}`,
      `SUMMARY:${texto(`Cita: ${t.nombre}`)}`,
      `LOCATION:${texto(`${s.nombre} · ${s.detalle} · ${t.institucion}`)}`,
      `DESCRIPTION:${texto(`Cita N.º ${codigo}. Qué llevar: ${queLlevar(t, cita, cantidad).join('. ')}`)}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${texto(`Mañana tienes tu cita: ${t.nombre}`)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    enlace.download = `cita-${codigo}.ics`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  }

  return {
    pasosDe, costoDe, horaLegible, horarioDe, horarioLargo, horarioCorto,
    capitalizar, fechaDe, isoDe, fechaLarga, fechaCorta, diasDisponibles, horariosLibres, queLlevar, descargarCalendario
  };
})();
