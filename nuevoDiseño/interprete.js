/* Intérprete del asistente (asistente.js) y del chat de WhatsApp (whatsapp.html): convierte lo que la persona escribe
   en intención, trámite y datos para el formulario.
   Primero le pregunta a la IA (POST /api/asistente: asistente_ia.py en servidor.py). Si no hay IA (página abierta como
   archivo, servidor sin clave, sin red o con error), entiende lo básico aquí mismo y el chat sigue ("modo básico").
   Antes de enviar: los datos de la cuenta nunca salen del navegador; DUI, correos, teléfonos y números largos se
   cambian por marcadores ([DUI_1]…) que se restituyen al volver; un número de tarjeta o una contraseña no se envían.
   La IA solo propone: cada dato pasa después por motor-tramite.js. Se carga después de motor-tramite.js. */
window.INTERPRETE = (() => {
  const M = window.MOTOR_TRAMITE;
  // En la app móvil (app/) la dirección viene de su configuración; null: sin IA, solo el modo básico
  const RUTA = window.SIMPLE_CONFIG ? window.SIMPLE_CONFIG.asistenteUrl : '/api/asistente';
  const ESPERA_MAXIMA = 60000;
  // Después de una falla, el modo básico dura un minuto antes de volver a intentar con la IA
  const REINTENTO = 60000;
  let sinIAHasta = 0;
  let historial = [];
  const normalizar = M.normalizar;
  const catalogo = () => window.CATALOGO_TRAMITES || [];
  const tramiteDe = numero => catalogo().find(t => t.numero === numero);

  /* ----- Protección de datos ----- */
  const PATRONES = [
    ['CORREO', /[\w.+-]+@[\w-]+(\.[\w-]+)+/g],
    ['DUI', /\b\d{8}-?\d\b/g],
    ['TEL', /(\+?503[\s-]?)?\b[2-7]\d{3}[\s-]?\d{4}\b/g],
    ['NUM', /\b\d{5,}\b/g]
  ];
  const CONTRASENA = /\b(contrase[nñ]a|password|clave|pin|c[oó]digo de (verificaci[oó]n|seguridad))\b[^.?!]{0,20}?(\bes\b|:)\s*\S+/i;

  // 13 a 19 cifras (con espacios o guiones) que pasan el algoritmo de Luhn: parece una tarjeta
  function pareceTarjeta(texto) {
    return (texto.match(/(?:\d[ -]?){12,18}\d/g) || []).some(candidato => {
      const cifras = candidato.replace(/\D/g, '');
      if (cifras.length < 13) return false;
      let suma = 0;
      [...cifras].reverse().forEach((c, i) => { let d = Number(c); if (i % 2) { d *= 2; if (d > 9) d -= 9; } suma += d; });
      return suma % 10 === 0;
    });
  }

  function proteger(texto) {
    if (pareceTarjeta(texto)) return { bloqueo: 'tarjeta' };
    if (CONTRASENA.test(texto)) return { bloqueo: 'contrasena' };
    const marcadores = {};
    const cuenta = {};
    let salida = texto;
    PATRONES.forEach(([tipo, patron]) => {
      salida = salida.replace(patron, encontrado => {
        cuenta[tipo] = (cuenta[tipo] || 0) + 1;
        const marca = `[${tipo}_${cuenta[tipo]}]`;
        marcadores[marca] = encontrado.trim();
        return marca;
      });
    });
    return { texto: salida, marcadores };
  }

  const restituir = (valor, marcadores) => String(valor).replace(/\[[A-Z]+_\d+\]/g, marca => marcadores[marca] ?? marca);

  // Lo que se le cuenta a la IA de la conversación: los últimos turnos, ya protegidos
  function recordar(rol, texto) {
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!limpio) return;
    historial = [...historial, { rol, texto: rol === 'ciudadano' ? limpio : limpio.slice(0, 300) }].slice(-6);
  }
  const olvidar = () => { historial = []; };

  /* ----- Con IA ----- */
  // contexto: { canal, sesion, estado (del motor), fase, buscar(texto) → trámites (opcional, la búsqueda de la página) }
  async function interpretar(texto, { canal = 'web', sesion = true, estado = null, fase = '', buscar = null } = {}) {
    const protegido = proteger(texto);
    const base = { tramite: 0, candidatos: [], datos: [], respuesta: '', fuente: 'ninguna' };
    if (protegido.bloqueo) return { ...base, modo: 'local', intencion: 'bloqueado', motivo: protegido.bloqueo };
    let resultado = null;
    if (RUTA && Date.now() >= sinIAHasta && /^https?:$/.test(location.protocol)) {
      const inicio = performance.now();
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA);
      try {
        const contexto = {
          canal, sesion, fase,
          tramite: estado?.numero || 0,
          pendientes: estado ? M.pendientes(estado).map(c => c.nombre) : [],
          llenos: estado ? Object.keys(estado.respuestas) : [],
          historial
        };
        const r = await fetch(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje: protegido.texto, contexto }), signal: control.signal });
        const datos = await r.json().catch(() => null);
        if (r.ok && datos?.modo === 'ia') resultado = { ...base, ...datos, latencia: Math.round(performance.now() - inicio) };
        else sinIAHasta = Date.now() + REINTENTO;
      } catch {
        sinIAHasta = Date.now() + REINTENTO;
      } finally {
        clearTimeout(reloj);
      }
    }
    if (resultado) resultado.datos = (resultado.datos || []).map(d => ({ campo: d.campo, valor: restituir(d.valor, protegido.marcadores) }));
    else resultado = interpretarLocal(texto, { estado, fase, buscar });
    recordar('ciudadano', protegido.texto);
    return resultado;
  }

  /* ----- Sin IA: lo básico ----- */
  const SALUDOS = ['hola', 'ola', 'hey', 'saludos', 'buen', 'buenas', 'buenos', 'dia', 'dias', 'tarde', 'tardes', 'noche', 'noches', 'que', 'tal', 'como', 'estas', 'esta', 'usted'];
  const AGRADECIMIENTOS = ['gracias', 'muchas', 'mil', 'ok', 'okey', 'vale', 'perfecto', 'genial', 'excelente', 'muy', 'bien'];
  const DESPEDIDAS = ['adios', 'chao', 'chau', 'bye', 'hasta', 'luego', 'pronto', 'manana', 'nos', 'vemos'];
  const PIDE_CONSULTA = ['mis tramites', 'mis solicitudes', 'mis documentos', 'en proceso', 'estado de mi', 'como va', 'como van', 'seguimiento', 'ya esta lista', 'ya salio'];
  const PIDE_HUMANO = /\b(hablar|comunicarme|atender|atienda)\b.*\b(persona|humano|agente|asesor|operador|alguien)\b|\b(reclamo|queja|denuncia)\b/;
  const CONFIRMA = /^(si|confirmo|confirmar|dale|listo|ok|okey|de acuerdo|correcto|enviar|envialo|esta bien|todo bien)\b/;
  const CANCELA = /^(cancela|cancelar|ya no|olvidalo|no quiero|mejor no)\b/;
  const PREGUNTA = /\?|^(cuanto|cuando|donde|que|como|cuales|cual|requisitos|hay que)\b/;
  const QUIERE_HACER = /\b(quiero|necesito|ocupo|hacer|sacar|solicitar|tramitar|pedir)\b/;
  const VACIAS = new Set(['quiero', 'necesito', 'ocupo', 'para', 'una', 'uno', 'del', 'las', 'los', 'por', 'con', 'mis', 'que', 'como', 'hacer', 'sacar', 'tramite', 'tramites', 'solicitar', 'pedir', 'constancia', 'certificacion']);
  const SINONIMOS = { trabajo: ['antecedentes'], empleo: ['antecedentes'], chamba: ['antecedentes'], policia: ['policiales'], agua: ['anda'], recibo: ['anda'], partida: ['partidas'], nacimiento: ['partidas'], bachiller: ['titulo'], viajar: ['migratoria'] };
  const palabrasDe = texto => normalizar(texto).split(/[^a-z0-9ñ]+/).filter(p => p.length >= 3 && !VACIAS.has(p));
  const raiz = p => (p.length > 4 ? p.replace(/(es|s)$/, '') : p);

  // Los trámites con más palabras del mensaje en su nombre (doble) o en su institución y descripción
  function buscarLocal(texto) {
    const buscadas = new Set(palabrasDe(texto).map(raiz));
    [...buscadas].forEach(p => (SINONIMOS[p] || []).forEach(s => buscadas.add(s)));
    if (!buscadas.size) return [];
    const puntos = catalogo().map(t => {
      const nombre = normalizar(t.nombre);
      const resto = normalizar(`${t.institucion} ${t.dependencia} ${t.descripcion}`);
      const p = [...buscadas].reduce((s, b) => s + (nombre.includes(b) ? 2 : resto.includes(b) ? 1 : 0), 0);
      return { numero: t.numero, p: p + (p && window.FORMULARIOS_TRAMITES?.[t.numero] ? 0.5 : 0) };
    }).filter(x => x.p >= 2).sort((a, b) => b.p - a.p);
    return puntos.filter(x => x.p >= puntos[0]?.p - 1).slice(0, 3).map(x => x.numero);
  }

  // El mensaje nombra el trámite: dos o más palabras distintivas de su nombre
  function nombraTramite(n, numero) {
    const palabras = palabrasDe(tramiteDe(numero)?.nombre || '').filter(p => p.length >= 4).map(raiz);
    return palabras.filter(p => n.includes(p)).length >= Math.min(2, palabras.length);
  }

  // Cómo se dicen algunas opciones en el habla de todos los días ("para la chamba" → de empleo)
  const OPCION_COLOQUIAL = { chamba: 'empleo', trabajo: 'empleo', trabajar: 'empleo', estudiar: 'estudio', estudios: 'estudio', universidad: 'estudio', viajar: 'migratorios', viaje: 'migratorios' };

  // Opciones de los campos que faltan nombradas en el mensaje, y pistas de cita (sede, día, mañana o tarde)
  function datosDelTexto(texto, estado) {
    const base = normalizar(texto).replace(/[^a-z0-9ñ]+/g, ' ');
    const n = ` ${base} ${base.split(' ').map(p => OPCION_COLOQUIAL[p]).filter(Boolean).join(' ')} `;
    const datos = [];
    const contiene = clave => clave.length >= 4 && n.includes(` ${clave} `);
    M.pendientes(estado).filter(c => (c.tipo === 'opciones' || c.tipo === 'lista') && !c.origen).forEach(c => {
      const opciones = M.opcionesDe(estado, c);
      const sinoGenerico = opciones.length <= 3 && opciones.every(o => ['si', 'no'].includes(o.valor));
      const coinciden = sinoGenerico
        ? opciones.filter(o => n.trim() === o.valor || n.trim().startsWith(`${o.valor} `))
        : opciones.filter(o => contiene(normalizar(o.texto).replace(/^(de|del|la|el) /, '')) || contiene(normalizar(o.valor).replace(/_/g, ' ')));
      if (coinciden.length === 1) datos.push({ campo: c.nombre, valor: coinciden[0].valor });
    });
    const cita = window.CITAS_TRAMITES?.[estado.numero];
    if (cita) {
      const quiereCita = / cita | presencial | en persona /.test(n);
      const sede = cita.sedes.find(s => n.includes(` ${normalizar(s.nombre)} `));
      const dia = ['pasado manana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes'].find(d => n.includes(` ${d} `));
      const franja = n.match(/ (manana|tarde|temprano) /)?.[1] || n.match(/ (\d{1,2}(:\d{2})? ?(am|pm)?) /)?.[1];
      if (sede) datos.push({ campo: 'cita_sede', valor: sede.nombre });
      if (dia) datos.push({ campo: 'cita_dia', valor: dia });
      if (franja && (sede || dia || quiereCita)) datos.push({ campo: 'cita_franja', valor: franja });
      // "Con cita", sin más: pasa a cita y el asistente pregunta la sede
      if (quiereCita && !sede && !dia && !franja) datos.push({ campo: 'cita_dia', valor: 'el primero disponible' });
    }
    return datos;
  }

  // Costo, plazo o requisitos del catálogo y del formulario: nada que no esté escrito ahí
  function responderPregunta(numero, n) {
    const t = tramiteDe(numero);
    if (!t) return '';
    const costo = window.PASOS_TRAMITE.costoDe(t).resumen.replace(/,$/, '');
    const tiempo = t.tiempo ? `${t.tiempo.charAt(0).toLowerCase()}${t.tiempo.slice(1)}` : '';
    const requisitos = window.FORMULARIOS_TRAMITES?.[numero]?.informacion?.requisitos?.lista;
    if (/cuest|cost|preci|pag|cobr|vale/.test(n)) return `${t.nombre}: ${costo.charAt(0).toLowerCase()}${costo.slice(1)}.`;
    if (/\bhora\b|horario|abren|cierran|atienden/.test(n)) {
      const cita = window.CITAS_TRAMITES?.[numero];
      return cita ? `Para ${t.nombre} atienden ${window.PASOS_TRAMITE.horarioLargo(cita.horario)}.` : 'El horario de atención no está en la ficha oficial; consúltalo en el portal de la institución.';
    }
    if (/tard|tiempo|demor|cuando|dias|horas/.test(n)) return tiempo ? `${t.nombre} tarda ${tiempo}.` : 'El plazo no está indicado en la ficha oficial.';
    if (/requisit|llevar|document|piden|necesito/.test(n)) {
      return requisitos?.length ? `Para ${t.nombre} necesitas: ${requisitos.join('; ')}.` : `Los requisitos de ${t.nombre} están en su ficha oficial (simple.sv).`;
    }
    return `${t.nombre}: ${costo.charAt(0).toLowerCase()}${costo.slice(1)}${tiempo ? ` y tarda ${tiempo}` : ''}.`;
  }

  function interpretarLocal(texto, { estado = null, fase = '', buscar = null } = {}) {
    const n = normalizar(texto);
    const palabras = n.split(/[^a-z0-9ñ]+/).filter(Boolean);
    const base = { modo: 'local', tramite: 0, candidatos: [], datos: [], respuesta: '', fuente: 'ninguna' };
    if (PIDE_HUMANO.test(n)) return { ...base, intencion: 'pedir_humano' };
    if (PIDE_CONSULTA.some(c => n.includes(c))) return { ...base, intencion: 'consultar_estado' };
    if (fase === 'confirmando' && CONFIRMA.test(n)) return { ...base, intencion: 'confirmar' };
    if (estado && CANCELA.test(n)) return { ...base, intencion: 'cancelar' };
    const solo = lista => palabras.length > 0 && palabras.every(p => lista.includes(p));
    if (solo(SALUDOS) || solo(AGRADECIMIENTOS) || solo(DESPEDIDAS)) return { ...base, intencion: 'saludo' };

    let encontrados = (buscar ? buscar(texto).map(t => t.numero ?? t) : buscarLocal(texto)).slice(0, 3);
    // Si nombra la institución ("de la PNC", "de ANDA"), entre los posibles queda el de esa institución
    const deInstitucion = encontrados.filter(numero => {
      const sigla = normalizar(tramiteDe(numero)?.institucion.match(/\(([^)]+)\)\s*$/)?.[1] || '');
      return sigla && new RegExp(`\\b${sigla}\\b`).test(n);
    });
    if (encontrados.length > 1 && deInstitucion.length === 1) encontrados = deInstitucion;
    if (estado) {
      // Una pregunta ("¿a qué hora atienden en Santa Ana?") no es un dato, aunque nombre una opción
      if (PREGUNTA.test(n) && !QUIERE_HACER.test(n)) return { ...base, intencion: 'pregunta', respuesta: responderPregunta(estado.numero, n), fuente: 'ficha' };
      const datos = datosDelTexto(texto, estado);
      if (datos.length) return { ...base, intencion: fase === 'confirmando' ? 'corregir' : 'aportar_datos', datos };
      const otro = encontrados.find(numero => numero !== estado.numero && nombraTramite(n, numero));
      if (otro) return { ...base, intencion: 'iniciar_tramite', tramite: otro, datos: window.FORMULARIOS_TRAMITES?.[otro] ? datosDelTexto(texto, M.crear(otro)) : [] };
      // Lo escrito es la respuesta del primer texto que falta (sin IA se pregunta uno a la vez)
      const texto1 = M.pendientes(estado).find(c => c.tipo === 'texto');
      if (texto1) return { ...base, intencion: 'aportar_datos', datos: [{ campo: texto1.nombre, valor: texto.trim() }] };
    }
    if (encontrados.length === 1 || (encontrados.length && nombraTramite(n, encontrados[0]))) {
      const numero = encontrados[0];
      if (PREGUNTA.test(n) && !QUIERE_HACER.test(n)) return { ...base, intencion: 'pregunta', tramite: numero, respuesta: responderPregunta(numero, n), fuente: 'catalogo' };
      return { ...base, intencion: 'iniciar_tramite', tramite: numero, datos: window.FORMULARIOS_TRAMITES?.[numero] ? datosDelTexto(texto, M.crear(numero)) : [] };
    }
    if (encontrados.length) return { ...base, intencion: 'buscar_tramite', candidatos: encontrados };
    const pareceTexto = palabras.some(p => p.length >= 2 && /[aeiou]/.test(p) && !/[^aeiou\d]{5,}/.test(p));
    return { ...base, intencion: pareceTexto ? 'fuera_de_ambito' : 'sin_sentido' };
  }

  const modo = () => (!RUTA || Date.now() < sinIAHasta || !/^https?:$/.test(location.protocol) ? 'basico' : 'ia');

  return { interpretar, interpretarLocal, proteger, restituir, recordar, olvidar, modo, datosDelTexto, responderPregunta, buscarLocal };
})();
