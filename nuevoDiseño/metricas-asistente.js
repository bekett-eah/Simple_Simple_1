/* Métricas del asistente (web y WhatsApp) para medir si de verdad ahorra trabajo al ciudadano. Se guardan solo en
   este navegador ('simple-asistente-metricas', hasta 3 000 eventos) y las resume metricas.html, que también las
   exporta en JSON para las pruebas con usuarios. Nunca guardan lo que la persona escribe: solo qué pasó y cuándo.
   Eventos: inicio (conversación nueva), mensaje (escribió o dictó), clic (tocó un botón del chat o de la pasarela),
   tramite (quedó identificado), pregunta (el asistente pidió datos; cuantos = cuántos), repetido (pidió algo que ya se
   había dado), confirmado, pagado, presentado (solicitud enviada o cita agendada), cancelado, derivado (a atención
   humana), error, modo (ia | basico) y respuesta (latencia de la IA en ms). */
window.METRICAS_ASISTENTE = (() => {
  const CLAVE = 'simple-asistente-metricas';
  const MAXIMO = 3000;
  const leer = () => { try { const lista = JSON.parse(localStorage.getItem(CLAVE)); return Array.isArray(lista) ? lista : []; } catch { return []; } };
  const nuevoId = () => Math.random().toString(36).slice(2, 10);
  let sesion = nuevoId();
  let canal = 'web';
  let tramite = null;
  // La conversación sigue siendo la misma al volver de otra página (WhatsApp sale a pagar a pago.html y regresa)
  const CLAVE_SESION = c => `simple-asistente-sesion-${c}`;
  const recordarSesion = () => { try { sessionStorage.setItem(CLAVE_SESION(canal), JSON.stringify({ sesion, tramite })); } catch { /* sin almacenamiento */ } };
  function retomar(deCanal) {
    try {
      const guardada = JSON.parse(sessionStorage.getItem(CLAVE_SESION(deCanal)));
      if (!guardada?.sesion) return false;
      ({ sesion, tramite } = guardada);
      canal = deCanal;
      return true;
    } catch { return false; }
  }

  function registrar(tipo, datos = {}) {
    const evento = { s: sesion, c: canal, t: tipo, n: datos.tramite ?? tramite, ms: Date.now() };
    // Las claves propias del evento (s, c, t, n, ms) no se pisan con los datos
    Object.entries(datos).forEach(([k, v]) => { if (!['tramite', 's', 'c', 't', 'n', 'ms'].includes(k) && v !== undefined) evento[k] = v; });
    try { localStorage.setItem(CLAVE, JSON.stringify([...leer(), evento].slice(-MAXIMO))); } catch { /* sin almacenamiento */ }
  }

  // Una conversación nueva (al abrir el chat o al empezar otro trámite después de terminar uno)
  function nuevaSesion(deCanal = canal) {
    sesion = nuevoId();
    canal = deCanal;
    tramite = null;
    recordarSesion();
    registrar('inicio');
  }

  function fijarTramite(numero) {
    if (numero === tramite) return;
    tramite = numero;
    recordarSesion();
    registrar('tramite', { tramite: numero });
  }

  return { registrar, nuevaSesion, retomar, fijarTramite, leer, borrar: () => { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }, CLAVE };
})();
