/* Integraciones del asistente con los sistemas de las instituciones. En esta vista de diseño son SIMULADAS: no se
   envía nada a la institución ni se cobra nada. La interfaz es la que usará la versión real:
   - presentar   → iniciar en SIMPLE v2 la tarea inicial del trámite publicada como servicio ("Trámites disponibles"
                   en el módulo API; hoy no hay ninguna publicada) con los datos de la solicitud
   - consultar   → GET /backend/api/tramites/{id} y "Consultar estado" de la API REST de SIMPLE (token por encabezado,
                   no en la URL como hoy)
   - el pago va por la pasarela SERFINSA (pago.html) y la cita, por la agenda de la institución.
   Aquí la solicitud se guarda en este navegador, en 'simple-tramites-nuevos', de donde la leen Mis documentos
   (mis-tramites.html) y el chat de WhatsApp. estado: 'proceso' | 'finalizado' (mis-tramites.js);
   etapa: los códigos de estado_tramite de bd/esquema_tramites.sql (iniciado, pendiente_pago, en_revision, subsanar,
   completado, rechazado) y cita_agendada.
   Con ?simular=fallo en la dirección, presentar falla, para probar cómo el asistente maneja un error de la institución. */
window.INTEGRACIONES = (() => {
  const CLAVE = 'simple-tramites-nuevos';
  const CLAVE_PAGO = 'simple-asistente-pago';
  const MINUTOS_DUPLICADO = 10;
  const ETAPAS = {
    iniciado: 'Iniciada',
    pendiente_pago: 'Pendiente de pago',
    en_revision: 'En revisión por la institución',
    subsanar: 'Requiere corrección',
    completado: 'Finalizada',
    rechazado: 'No aprobada',
    cita_agendada: 'Cita agendada'
  };
  const leer = (clave, porDefecto) => { try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; } };
  const guardarEn = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } };
  const guardadas = () => { const lista = leer(CLAVE, []); return Array.isArray(lista) ? lista : []; };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const dos = n => String(n).padStart(2, '0');
  const ahoraISO = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`; };

  // Huella de la solicitud (trámite y respuestas) para no enviar dos veces la misma
  function huella(numero, respuestas) {
    const texto = `${numero}|${Object.keys(respuestas).sort().map(k => `${k}=${JSON.stringify(respuestas[k]?.valor ?? '')}`).join('&')}`;
    let h = 2166136261;
    for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return h.toString(36);
  }

  // La misma solicitud enviada hace menos de 10 minutos (doble clic, recarga, la misma conversación repetida)
  function duplicada(numero, respuestas) {
    const firma = huella(numero, respuestas);
    const limite = Date.now() - MINUTOS_DUPLICADO * 60000;
    return guardadas().find(s => s.huella === firma && s.numero === numero && new Date(s.creada || s.fecha).getTime() > limite) || null;
  }

  function nuevoId() {
    const usados = new Set(guardadas().map(s => s.id));
    let id;
    do { id = String(Math.floor(1000000 + Math.random() * 9000000)); } while (usados.has(id));
    return id;
  }

  // El pago lo hace pago.html dentro del chat: aquí se deja lo que debe cobrar
  function prepararPago({ numero, solicitud, total }) {
    guardarEn(CLAVE_PAGO, { numero, solicitud, total, preparado: Date.now() });
  }

  /* Presenta la solicitud a la institución. pago: { total, autorizacion, referencia } si se pagó en línea;
     cita: { sede, fecha, hora, cantidad } si es con cita. Devuelve { ok, solicitud } o { ok: false, error }. */
  async function presentar({ id = nuevoId(), numero, respuestas, canal = 'web', pago = null, cita = null }) {
    await espera(500);
    if (new URLSearchParams(location.search).get('simular') === 'fallo') {
      return { ok: false, error: 'La institución no respondió. Tu solicitud no se envió y no se hizo ningún cobro.' };
    }
    const fecha = ahoraISO();
    const solicitud = {
      id, numero, canal, fecha, creada: new Date().toISOString(),
      estado: 'proceso',
      etapa: cita ? 'cita_agendada' : 'en_revision',
      huella: huella(numero, respuestas),
      ...(pago ? { total: pago.total, autorizacion: pago.autorizacion, referencia: pago.referencia } : {}),
      ...(cita ? { cita } : {}),
      simulada: true
    };
    guardarEn(CLAVE, [solicitud, ...guardadas().filter(s => s.id !== id)].slice(0, 20));
    return { ok: true, solicitud, simulado: true };
  }

  // Estado de una solicitud: las de este navegador y las de la cuenta (mis-tramites.js)
  function consultar(id) {
    return guardadas().find(s => s.id === id) || (window.MIS_TRAMITES || []).find(s => s.id === id) || null;
  }

  const etapaLegible = s => ETAPAS[s?.etapa] || (s?.estado === 'finalizado' ? ETAPAS.completado : 'En proceso');

  return { presentar, consultar, duplicada, prepararPago, nuevoId, etapaLegible, guardadas, ETAPAS, CLAVE_PAGO };
})();
