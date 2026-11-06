/* Flujo corto de los trámites de las dos primeras páginas del catálogo (16 trámites en Indexlogin.html). Lo usa tramite.html.
   Toma el formulario completo de formularios.js (que no se toca: el chat y WhatsApp lo siguen usando tal cual) y lo
   resume en 2 pasos; entre uno y otro se pide iniciar sesión (tramite.html):
     1. Tu solicitud: todo en el mismo paso. Solo lo que la persona tiene que escribir o elegir va a la vista; lo ya
        elegido y lo opcional, en desplegables cerrados y editables.
     2. Pago: lo que viene de la Identidad Digital, en una card desplegable editable (se llena al iniciar sesión), y el
        total. Al volver del login se llega al paso 2; la pasarela se abre al pulsar "Pagar" y, al pagar, se va directo a Mis documentos.
        (La cita presencial del 99 no se paga: su paso 2 es "Confirma tu cita". Un trámite sin pago, o que solo a veces lo
        tiene, termina en un paso 2 "Confirma tu solicitud": tras confirmar va igual a Mis documentos.)
   Qué va en la card de la Identidad Digital (paso 2):
     - los campos de solo lectura (vienen de la Identidad Digital): aquí se pueden editar;
     - los campos que la cuenta ya trae (ciudadano.js), salvo los que solo se llenan según lo respondido (prellenarSi).
   Qué va en "Ya elegido por ti" (paso 1): lo que ya viene elegido (preguntas de opciones marcadas y listas con una sola
   opción), aunque decida qué otras preguntas salen; se puede cambiar ahí mismo. Las aceptaciones de términos o
   condiciones siempre se ven.
   Condiciones: al juntar pasos, la condición de un paso se suma a la de cada uno de sus campos con "&&"
   ('campo=a&&otro!=b'); tramite.html (cumple) la entiende. */
(() => {
  // Números de catálogo de los trámites con flujo corto, en el orden en que salen en Indexlogin.html: la primera página
  // (8 trámites) y la segunda
  const NUMEROS = [99, 100, 73, 74, 75, 113, 61, 62, 63, 64, 101, 105, 109, 48, 49, 50];
  const REALES = ['texto', 'lista', 'opciones', 'archivo'];
  const unir = (...condiciones) => condiciones.filter(Boolean).join('&&');
  const esAceptacion = nombre => /^(acepta|condiciones)/.test(nombre || '');

  const aplica = numero => NUMEROS.includes(Number(numero));

  function reducir(definicion, ciudadano = {}) {
    const original = [definicion, ...(definicion.pasos || [])];
    const preseleccion = definicion.preseleccion || {};

    // Un dato de la cuenta que sale en varios pasos (con otras condiciones) va una sola vez en la card, sin condición
    const veces = {};
    original.forEach(p => (p.campos || []).forEach(c => { if (c.nombre && REALES.includes(c.tipo)) veces[c.nombre] = (veces[c.nombre] || 0) + 1; }));

    function clasificar(c) {
      if (c.soloLectura) return 'cuenta';
      const deCuenta = ciudadano[c.nombre] && ['texto', 'lista'].includes(c.tipo);
      if (deCuenta && !c.prellenarSi) return 'cuenta';
      // Ya viene elegida: una pregunta de opciones marcada o una lista obligatoria con una sola opción (queda elegida sola)
      const elegida = (c.tipo === 'opciones' && (c.marcado || preseleccion[c.nombre]))
        || (c.tipo === 'lista' && c.opciones?.length === 1 && !c.opcional && !c.depende);
      if (elegida && !esAceptacion(c.nombre)) return 'preseleccionado';
      return c.opcional ? 'opcional' : 'requerido';
    }

    const requeridos = [];
    const opcionales = [];
    const elegidos = [];
    const cuenta = [];
    const notasDeCita = [];
    const notasDeRevision = [];
    const enCuenta = new Set();
    let pago = null;
    let fin = null;

    original.forEach(paso => {
      if (paso.tipo === 'pago') { pago = paso; return; }
      const esRevision = paso.tipo === 'revision';
      if (esRevision && paso.fin) fin = { fin: paso.fin, si: paso.si };
      // Notas y secciones esperan al siguiente campo y van donde él vaya
      let pendientes = [];
      (paso.campos || []).forEach(c => {
        if (c.tipo === 'desplegable' || c.tipo === 'finDesplegable' || c.tipo === 'resumen') return;
        if (!REALES.includes(c.tipo)) {
          if (esRevision) { if (c.tipo === 'nota') (paso.fin ? notasDeCita : notasDeRevision).push({ ...c, si: unir(paso.si, c.si) }); }
          else pendientes.push({ ...c, si: unir(paso.si, c.si) });
          return;
        }
        const destino = clasificar(c);
        const campo = { ...c, si: unir(paso.si, c.si) };
        if (destino === 'cuenta') {
          // Se puede editar: ya no es de solo lectura
          if (enCuenta.has(c.nombre)) { pendientes = []; return; }
          enCuenta.add(c.nombre);
          delete campo.soloLectura;
          campo.deCuenta = true;
          if (veces[c.nombre] > 1) delete campo.si;
          cuenta.push(campo);
          pendientes = [];
          return;
        }
        const lista = destino === 'preseleccionado' ? elegidos : destino === 'opcional' ? opcionales : requeridos;
        lista.push(...pendientes, campo);
        pendientes = [];
      });
    });

    // Paso 1: todo en el mismo paso
    const campos = [...requeridos];
    if (elegidos.length) {
      campos.push(
        { tipo: 'desplegable', titulo: 'Ya elegido por ti', icono: 'ph-check-circle', abierto: false, ocultarVacio: true, vistaPrevia: true },
        { tipo: 'nota', estilo: 'info', lineas: ['Lo dejamos elegido por ti. Cámbialo si no es lo que necesitas'] },
        ...elegidos,
        { tipo: 'finDesplegable' }
      );
    }
    if (opcionales.length) {
      campos.push({ tipo: 'desplegable', titulo: 'Más datos (opcionales)', icono: 'ph-list-plus', abierto: false, ocultarVacio: true }, ...opcionales);
    }
    const pasos = [{
      titulo: 'Tu solicitud',
      subtitulo: 'Completa lo que falta; lo demás ya está listo',
      boton: 'Continuar',
      campos
    }];

    // Paso 2: pago (o confirmar la cita). Los datos de la Identidad Digital van en una card desplegable editable
    if (pago) {
      const camposDePago = [];
      if (cuenta.length) {
        camposDePago.push(
          { tipo: 'desplegable', titulo: 'Tus datos', icono: 'ph-user-circle', abierto: false, ocultarVacio: true, vistaPrevia: true },
          { tipo: 'nota', estilo: 'info', lineas: ['Vienen de tu Identidad Digital. Si algo cambió, corrígelo aquí'] },
          ...cuenta,
          { tipo: 'finDesplegable' }
        );
      }
      // El resumen del pago (trámite, institución y total) va después de la card de datos, y una sola nota informativa
      camposDePago.push({ tipo: 'resumenPago' });
      const notas = (pago.campos || []).filter(c => c.tipo === 'nota');
      const nota = notas.find(c => (c.estilo || 'info') === 'info') || notas[0];
      if (nota) camposDePago.push(nota);
      pasos.push({ ...pago, campos: camposDePago });
    }
    // Sin pago (o con pago solo en algunos casos): el paso 2 es confirmar la solicitud
    const complemento = si => {
      const m = (si || '').match(/^(\w+)(!?=)([^|&]*)$/);
      return m ? `${m[1]}${m[2] === '=' ? '!=' : '='}${m[3]}` : null;
    };
    if (!fin && (!pago || (pago.si && complemento(pago.si)))) {
      const camposDeConfirmar = [];
      if (!pago && cuenta.length) {
        camposDeConfirmar.push(
          { tipo: 'desplegable', titulo: 'Tus datos', icono: 'ph-user-circle', abierto: false, ocultarVacio: true, vistaPrevia: true },
          { tipo: 'nota', estilo: 'info', lineas: ['Vienen de tu Identidad Digital. Si algo cambió, corrígelo aquí'] },
          ...cuenta,
          { tipo: 'finDesplegable' }
        );
      }
      camposDeConfirmar.push({ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-clipboard-text', abierto: true });
      const informativa = notasDeRevision.find(c => (c.estilo || 'info') === 'info') || notasDeRevision[0];
      if (informativa) camposDeConfirmar.push(informativa);
      pasos.push({
        titulo: 'Confirma tu solicitud',
        subtitulo: 'Revisa tus datos y confirma',
        tipo: 'revision',
        boton: 'Confirmar solicitud',
        ...(pago ? { si: complemento(pago.si) } : {}),
        campos: camposDeConfirmar
      });
    }
    if (fin) {
      pasos.push({
        titulo: 'Confirma tu cita',
        subtitulo: 'Revisa tu cita antes de confirmar',
        tipo: 'revision',
        si: fin.si,
        fin: fin.fin,
        boton: 'Confirmar cita',
        campos: [{ tipo: 'resumen', titulo: 'Tu cita', icono: 'ph-clipboard-text', abierto: true }, ...notasDeCita]
      });
    }
    return pasos;
  }

  window.FLUJO_CORTO = { aplica, reducir };
})();
