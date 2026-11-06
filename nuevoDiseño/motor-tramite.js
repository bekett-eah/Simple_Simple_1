/* Motor de los trámites que se completan conversando: las reglas de cada formulario de formularios.js, sin pantallas.
   Lo usan el asistente (asistente.js) y el chat de WhatsApp (whatsapp.html); las pruebas lo cargan en Node
   (pruebas/motor-tramite.test.mjs). La IA (interprete.js) solo propone datos: aquí se decide qué se acepta.
   Se carga después de catalogo-landing.js, formularios.js, citas.js y pasos-tramite.js.

   Estado de una solicitud: { numero, respuestas: { campo: { valor, texto, etiqueta, origen, repetido } } }
   origen: 'tramite' (preseleccion del formulario), 'cuenta' (Identidad Digital, ciudadano.js), 'defecto' (opción ya
   marcada en el formulario), 'unica' (lista con una sola opción), 'consentimiento' (declaración ya marcada: se acepta al
   confirmar), 'propuesta' (horario de cita sugerido) o 'ciudadano' (lo que la persona escribió o eligió).
   Las condiciones 'campo=valor' y 'campo!=valor' se evalúan como en tramite.html: "!=" solo se cumple con una respuesta. */
window.MOTOR_TRAMITE = (() => {
  const formularios = () => window.FORMULARIOS_TRAMITES || {};
  const citas = () => window.CITAS_TRAMITES || {};
  const pasosTramite = () => window.PASOS_TRAMITE;
  const tramiteDe = numero => (window.CATALOGO_TRAMITES || []).find(t => t.numero === numero);

  const normalizar = texto => String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  // Para comparar con las respuestas que no se aceptan: mayúsculas, sin tildes ni puntuación al final
  const paraComparar = texto => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').replace(/[\s.,;:]+$/, '').trim();
  const ES_DATO = c => Boolean(c.nombre) && ['opciones', 'lista', 'texto', 'archivo'].includes(c.tipo);
  const vacio = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  /* ----- Condiciones ----- */
  function cumple(si, respuestas) {
    if (!si) return true;
    const [, nombre, distinto, esperado] = si.match(/^(\w+)(!?)=(.*)$/);
    const actual = respuestas[nombre]?.valor;
    const valores = Array.isArray(actual) ? actual.map(String) : vacio(actual) ? [] : [String(actual)];
    const coincide = esperado.split('|').some(v => valores.includes(v));
    return distinto ? valores.length > 0 && !coincide : coincide;
  }
  const aplica = (item, respuestas) => cumple(item.si, respuestas);

  /* ----- Pasos y campos ----- */
  // La revisión aporta solo los datos de la cuenta que muestra (de solo lectura); el pago no tiene datos
  function pasosConDatos(formulario) {
    return [formulario, ...(formulario.pasos || [])]
      .filter(p => !p.tipo || (p.tipo === 'revision' && p.campos.some(c => c.soloLectura)))
      .map(p => (p.tipo ? { si: p.si, titulo: p.titulo, campos: p.campos.filter(c => c.soloLectura) } : p));
  }

  // En el formulario todos los campos se ven a la vez; conversando se preguntan en orden. Un campo que depende de otro
  // ("si") va después de ese, aunque en el formulario esté más abajo
  function ordenarPorDependencias(campos) {
    const orden = [];
    const puestos = new Set();
    const poner = c => {
      if (puestos.has(c)) return;
      puestos.add(c);
      const dependeDe = campos.find(x => x.nombre && x.nombre === (c.si?.match(/^(\w+)!?=/)?.[1] || c.depende));
      if (dependeDe && campos.indexOf(dependeDe) > campos.indexOf(c)) poner(dependeDe);
      orden.push(c);
    };
    campos.forEach(poner);
    return orden;
  }

  // Todos los campos de datos del formulario, una vez cada nombre (la primera vez que aparece)
  function todosLosCampos(formulario) {
    const vistos = new Map();
    pasosConDatos(formulario).forEach(p => p.campos.filter(ES_DATO).forEach(c => { if (!vistos.has(c.nombre)) vistos.set(c.nombre, c); }));
    return [...vistos.values()];
  }

  // Los campos de datos que se ven con lo respondido: su paso aplica y su condición se cumple
  function camposVisibles(estado) {
    const formulario = formularios()[estado.numero];
    const vistos = new Map();
    pasosConDatos(formulario).filter(p => aplica(p, estado.respuestas)).forEach(p => {
      ordenarPorDependencias(p.campos).filter(c => ES_DATO(c) && aplica(c, estado.respuestas)).forEach(c => {
        if (!vistos.has(c.nombre)) vistos.set(c.nombre, c);
      });
    });
    return [...vistos.values()];
  }

  const campoVisible = (estado, nombre) => camposVisibles(estado).find(c => c.nombre === nombre);
  const campoDe = (estado, nombre) => todosLosCampos(formularios()[estado.numero]).find(c => c.nombre === nombre);
  const campoConOrigen = (estado, origen) => camposVisibles(estado).find(c => c.origen === origen);

  /* ----- Opciones ----- */
  // Las de la pregunta: las del formulario, las de la lista que depende de otra (municipios) o las de la cita (citas.js)
  function opcionesDe(estado, c) {
    const P = pasosTramite();
    const cita = citas()[estado.numero];
    if (c.origen === 'sedes') return (cita?.sedes || []).map((s, i) => ({ valor: String(i), texto: s.nombre, detalle: `${s.detalle} · ${P.horarioCorto(P.horarioDe(cita, s))}` }));
    if (c.origen === 'dias') return P.diasDisponibles().map(f => ({ valor: P.isoDe(f), texto: P.capitalizar(P.fechaLarga(f)) }));
    if (c.origen === 'horas') {
      const sede = estado.respuestas[campoConOrigen(estado, 'sedes')?.nombre]?.valor;
      const fecha = estado.respuestas[campoConOrigen(estado, 'dias')?.nombre]?.valor;
      if (!cita || vacio(sede) || vacio(fecha)) return [];
      return P.horariosLibres(cita, Number(sede), fecha).map(h => ({ valor: h, texto: P.horaLegible(h) }));
    }
    const lista = c.depende ? c.opcionesPor?.[estado.respuestas[c.depende]?.valor] : c.opciones;
    return (lista || []).map(o => (Array.isArray(o) ? { valor: String(o[0]), texto: String(o[1]) } : { valor: String(o.valor), texto: o.texto, detalle: o.detalle }));
  }

  // La opción que corresponde a lo escrito o propuesto: por valor, por texto o, si es la única que lo contiene, por parte del texto
  function resolverOpcion(opciones, entrada) {
    const buscado = normalizar(entrada);
    if (!buscado) return null;
    const exacta = opciones.find(o => normalizar(o.valor) === buscado || normalizar(o.texto) === buscado);
    if (exacta) return exacta;
    const parciales = opciones.filter(o => {
      const texto = normalizar(o.texto);
      return texto.includes(buscado) || (buscado.length >= 4 && buscado.includes(texto)) || normalizar(o.valor).replace(/_/g, ' ') === buscado;
    });
    return parciales.length === 1 ? parciales[0] : null;
  }

  // Declaraciones y términos que el formulario trae marcados (una sola opción): se aceptan con el clic de confirmar
  const esConsentimiento = c => c.tipo === 'opciones' && c.marcado === true && (c.opciones || []).length === 1;

  /* ----- Validación de textos (la misma de whatsapp.html y tramite.html) ----- */
  function validar(campo, valor, respuestas = {}) {
    if (vacio(valor)) return campo.opcional ? '' : 'Escribe una respuesta para seguir';
    if (campo.min && valor.length < campo.min) return `Escribe al menos ${campo.min} caracteres`;
    if (campo.max && valor.length > campo.max) return `Escribe como máximo ${campo.max} caracteres`;
    if (campo.prohibidos?.includes(paraComparar(valor))) return campo.mensaje || 'Revisa este dato e inténtalo de nuevo';
    if (campo.modo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return campo.mensaje || 'Escribe un correo válido, por ejemplo nombre@correo.com';
    if (campo.patron && !new RegExp(`^(?:${campo.patron})$`).test(valor)) return campo.mensaje || 'Revisa el formato e inténtalo de nuevo';
    if (campo.igualA && valor !== respuestas[campo.igualA]?.valor) return campo.mensaje || 'No coincide con lo que escribiste antes';
    return '';
  }

  // Formatos que la gente escribe distinto: fechas con barras, teléfonos con espacios, DUI sin guion
  function limpiarTexto(campo, valor) {
    let v = String(valor ?? '').trim().replace(/\s+/g, ' ');
    if (campo.modo === 'tel') v = v.replace(/[\s()]/g, '');
    if (campo.patron?.includes('(0[1-9]|[12][0-9]|3[01])-')) v = v.replace(/[/.]/g, '-');
    if (campo.patron?.startsWith('[0-9]{8}-')) v = v.replace(/^(\d{8})(\d)$/, '$1-$2');
    if (campo.modo === 'email') v = v.toLowerCase();
    return v;
  }

  /* ----- Respuestas ----- */
  function poner(estado, campo, valor, origen, extra = {}) {
    let texto = valor;
    if (campo.tipo === 'opciones' || campo.tipo === 'lista') {
      const opciones = opcionesDe(estado, campo);
      const textoDe = v => opciones.find(o => o.valor === String(v))?.texto ?? v;
      texto = Array.isArray(valor) ? valor.map(textoDe).join(', ') : textoDe(valor);
    }
    estado.respuestas[campo.nombre] = { valor, texto: texto ?? 'Omitido', etiqueta: campo.etiqueta || campo.nombre, origen, ...extra };
  }

  const quitar = (estado, nombre) => { delete estado.respuestas[nombre]; };
  const TIPO_DOCUMENTO = /^tipo_(de_)?documento(_de_identidad)?$/;

  /* Lo que se completa solo: datos de la Identidad Digital, opciones ya marcadas, listas de una sola opción, la cantidad
     (1) y la confirmación de un correo que vino de la cuenta. Los datos que pueden ser de otra persona (prellenarSi: la
     persona inscrita en una partida) se toman de la cuenta solo cuando su condición se cumple y la persona dijo que son
     suyos (estado.esDeQuienInicia, ver preguntarSiEsSuyo). Lo de la cuenta que deja de aplicar (por ejemplo, la partida
     de defunción no es de quien inicia sesión) se quita. */
  function completar(estado, cuenta = window.CIUDADANO || {}) {
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      let cambios = 0;
      const visibles = camposVisibles(estado);
      const documentoNoDui = visibles.some(c => TIPO_DOCUMENTO.test(c.nombre) && !vacio(estado.respuestas[c.nombre]?.valor) && estado.respuestas[c.nombre].valor !== 'dui');
      visibles.forEach(c => {
        const actual = estado.respuestas[c.nombre];
        const deCuenta = cuenta[c.nombre] !== undefined && (!c.prellenarSi || (cumple(c.prellenarSi, estado.respuestas) && estado.esDeQuienInicia === true))
          && !(documentoNoDui && c.nombre === 'numero_de_documento');
        if (actual) {
          if (actual.origen === 'cuenta' && c.tipo === 'texto' && !c.soloLectura && !deCuenta && !actual.repetido) { quitar(estado, c.nombre); cambios++; }
          return;
        }
        if (c.soloLectura) { poner(estado, c, cuenta[c.nombre] || '—', 'cuenta'); cambios++; return; }
        // Confirmar un dato que vino de la cuenta (el correo) no hace falta: se copia y no se repite en el resumen
        if (c.tipo === 'texto' && c.igualA) {
          const original = estado.respuestas[c.igualA];
          if (original?.origen === 'cuenta') { poner(estado, c, original.valor, 'cuenta', { repetido: true }); cambios++; }
          return;
        }
        if (c.tipo === 'texto' && deCuenta) { poner(estado, c, cuenta[c.nombre], 'cuenta'); cambios++; return; }
        if (c.tipo === 'opciones' && c.marcado !== undefined) {
          const primera = opcionesDe(estado, c)[0]?.valor;
          const valor = c.marcado === true ? (c.multiple ? [primera] : primera) : c.marcado;
          poner(estado, c, valor, esConsentimiento(c) ? 'consentimiento' : 'defecto');
          cambios++;
          return;
        }
        if (c.tipo === 'opciones' && c.cantidad) { poner(estado, c, '1', 'defecto'); cambios++; return; }
        if (TIPO_DOCUMENTO.test(c.nombre) && cuenta.numero_de_documento && opcionesDe(estado, c).some(o => o.valor === 'dui')) {
          poner(estado, c, 'dui', 'cuenta');
          cambios++;
          return;
        }
        if (c.tipo === 'lista' && !c.depende && !c.opcional && opcionesDe(estado, c).length === 1) { poner(estado, c, opcionesDe(estado, c)[0].valor, 'unica'); cambios++; }
      });
      if (!cambios) break;
    }
    return estado;
  }

  function crear(numero, cuenta = window.CIUDADANO || {}) {
    const formulario = formularios()[numero];
    if (!formulario) return null;
    const estado = { numero, respuestas: {} };
    // Lo que ya viene elegido por el trámite (por ejemplo, el servicio o el tipo de trámite) no se pregunta, esté en el paso que esté
    Object.entries(formulario.preseleccion || {}).forEach(([nombre, valor]) => {
      poner(estado, todosLosCampos(formulario).find(c => c.nombre === nombre) || { nombre, tipo: 'texto' }, valor, 'tramite');
    });
    return completar(estado, cuenta);
  }

  /* ----- Lo que falta ----- */
  // Obligatorios que se ven y no tienen respuesta, en el orden en que se preguntarían. Una lista que depende de otra
  // (municipios) espera a que se responda la otra
  function pendientes(estado) {
    return camposVisibles(estado).filter(c => {
      if (c.opcional || c.soloLectura || !vacio(estado.respuestas[c.nombre]?.valor)) return false;
      if ((c.tipo === 'lista' || c.tipo === 'opciones') && !opcionesDe(estado, c).length && !c.origen) return false;
      return true;
    });
  }

  // Lo que se puede cambiar conversando (no los datos de la cuenta de solo lectura, ni archivos, ni consentimientos)
  const editables = estado => camposVisibles(estado).filter(c => !c.soloLectura && c.tipo !== 'archivo' && !esConsentimiento(c));

  /* ----- Nombres por partes (nombrePorPartes de formularios.js) ----- */
  // Conversando, un nombre no se pide parte por parte: primero si es el de quien inició sesión y, si no, completo en un
  // solo mensaje, que aquí se reparte en nombres y apellidos
  const PARTES_NOMBRE = ['primer_nombre', 'segundo_nombre', 'tercer_nombre', 'primer_apellido', 'segundo_apellido', 'apellido_de_casada'];
  const parteDe = nombre => PARTES_NOMBRE.find(p => nombre === p || nombre.endsWith(`_${p}`)) || null;
  // '' para el nombre principal, 'madre_' para el de la madre…; null si el campo no es parte de un nombre
  const prefijoDeNombre = nombre => { const parte = parteDe(nombre || ''); return parte ? nombre.slice(0, -parte.length) : null; };
  const camposDeNombre = (estado, prefijo) => camposVisibles(estado).filter(c => c.tipo === 'texto' && prefijoDeNombre(c.nombre) === prefijo);

  // ¿Hay que preguntar si el nombre es el de quien inició sesión? Cuando una parte obligatoria que puede venir de su
  // Identidad Digital (prellenarSi) ya aplica, está vacía y aún no lo ha dicho
  function preguntarSiEsSuyo(estado, cuenta = window.CIUDADANO || {}) {
    if (estado.esDeQuienInicia !== undefined) return null;
    const c = pendientes(estado).find(x => x.prellenarSi && prefijoDeNombre(x.nombre) !== null && cumple(x.prellenarSi, estado.respuestas) && cuenta[x.nombre]);
    if (!c) return null;
    const prefijo = prefijoDeNombre(c.nombre);
    return { prefijo, nombre: camposDeNombre(estado, prefijo).map(x => cuenta[x.nombre]).filter(Boolean).join(' ') };
  }

  // La respuesta: si es suyo, sus datos (el nombre, el DUI, la fecha de nacimiento…) salen de la cuenta
  function responderSiEsSuyo(estado, esSuyo, cuenta = window.CIUDADANO || {}) {
    estado.esDeQuienInicia = Boolean(esSuyo);
    return completar(estado, cuenta);
  }

  // Un dato que puede ser de quien inició sesión espera a que se responda lo que lo decide (el tipo de partida)
  const esperaCondicion = (estado, c) => { const campo = c.prellenarSi?.match(/^(\w+)!?=/)?.[1]; return Boolean(campo && vacio(estado.respuestas[campo]?.valor)); };

  // Un nombre que falta (alguna parte obligatoria vacía), para pedirlo completo: el primero en el orden de las preguntas
  function nombrePendiente(estado) {
    const c = pendientes(estado).find(x => x.tipo === 'texto' && prefijoDeNombre(x.nombre) !== null);
    if (!c) return null;
    const prefijo = prefijoDeNombre(c.nombre);
    return { prefijo, campos: camposDeNombre(estado, prefijo), espera: esperaCondicion(estado, c) };
  }

  // Une "de", "del", "de la", "de los"… a la palabra que sigue: "María de los Ángeles" son dos palabras
  function palabrasDeNombre(texto) {
    const sueltas = String(texto).trim().split(/\s+/).filter(Boolean);
    const palabras = [];
    let particula = '';
    for (const p of sueltas) {
      if (/^(de|del|la|las|los|y)$/i.test(p)) { particula += `${p} `; continue; }
      palabras.push(particula + p);
      particula = '';
    }
    if (particula) palabras.push(particula.trim());
    return palabras;
  }

  /* El nombre completo escrito en un mensaje, repartido en partes. Con coma, lo de antes son los nombres y lo de después
     los apellidos; sin coma: 2 palabras son nombre y apellido, 4 son dos y dos, 5 o más llevan los nombres que sobran en
     el tercero. Con 3 no se sabe si son 1 nombre y 2 apellidos o al revés: se devuelven las dos formas (la primera, la
     más común). Un "de …" al final es el apellido de casada si el formulario lo pide.
     Devuelve { opciones: [{ partes, nombres, apellidos }] } o { error } */
  // Palabras que no van en un nombre: lo escrito es otra cosa ("no lo sé", "¿qué nombre?")
  const NO_ES_NOMBRE = /(^|[\s,])(no|si|sí|se|sé|que|qué|como|cómo|cual|cuál|quiero|ayuda|cancelar|favor|tengo|es|mi|mis|para|porque|donde|dónde|cuando|cuándo|hola|gracias|ok|listo|nombre|nombres|apellido|apellidos)(?=[\s,]|$)/i;
  function partirNombre(texto, { conCasada = false } = {}) {
    const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ');
    if (!new RegExp(`^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ,]+$`).test(limpio)) return { error: 'Usa solo letras', noEsNombre: /[0-9?¿]/.test(limpio) };
    if (NO_ES_NOMBRE.test(limpio)) return { error: 'Escribe el nombre y los apellidos, por ejemplo Juan Carlos Pérez Gómez', noEsNombre: true };
    let casada = '';
    const forma = (nombres, apellidos) => {
      const partes = { primer_nombre: nombres[0], segundo_nombre: nombres[1] || '', tercer_nombre: nombres.slice(2).join(' '),
        primer_apellido: apellidos[0], segundo_apellido: apellidos.slice(1).join(' ') };
      if (conCasada) partes.apellido_de_casada = casada;
      return { partes, nombres: nombres.join(' '), apellidos: [...apellidos, ...(casada ? [`de ${casada}`] : [])].join(' ') };
    };
    if (limpio.includes(',')) {
      const [antes, despues] = limpio.split(/\s*,\s*/);
      const nombres = palabrasDeNombre(antes);
      const apellidos = palabrasDeNombre(despues || '');
      if (!nombres.length || !apellidos.length) return { error: 'Escribe los nombres, una coma y los apellidos' };
      if (conCasada && apellidos.length > 1 && /^de /i.test(apellidos[apellidos.length - 1])) casada = apellidos.pop().replace(/^de /i, '');
      return { opciones: [forma(nombres, apellidos)] };
    }
    const palabras = palabrasDeNombre(limpio);
    if (conCasada && palabras.length >= 3 && /^de /i.test(palabras[palabras.length - 1])) casada = palabras.pop().replace(/^de /i, '');
    const n = palabras.length;
    if (n < 2) return { error: 'Escribe al menos un nombre y un apellido' };
    if (n === 2) return { opciones: [forma(palabras.slice(0, 1), palabras.slice(1))] };
    // Con apellido de casada lo común es dos nombres y un apellido ("Rosa Elena Martínez de Hernández")
    if (n === 3) {
      const opciones = [forma(palabras.slice(0, 1), palabras.slice(1)), forma(palabras.slice(0, 2), palabras.slice(2))];
      return { opciones: casada ? opciones.reverse() : opciones };
    }
    return { opciones: [forma(palabras.slice(0, n - 2), palabras.slice(n - 2))] };
  }

  // "*Ana* como nombre y *Pérez Gómez* como apellidos": para confirmar cómo se repartió (en negrita de WhatsApp)
  const anotadoComo = ({ nombres, apellidos }) => `*${nombres}* como ${palabrasDeNombre(nombres).length > 1 ? 'nombres' : 'nombre'} y *${apellidos}* como ${palabrasDeNombre(apellidos).length > 1 ? 'apellidos' : 'apellido'}`;

  // Pone las partes del nombre en los campos del grupo (las vacías quedan como omitidas). Devuelve el primer error
  function ponerNombre(estado, prefijo, partes, origen = 'ciudadano') {
    const campos = camposDeNombre(estado, prefijo);
    for (const c of campos) {
      const valor = partes[parteDe(c.nombre)] || '';
      if (!valor) { if (!c.opcional) return `${c.etiqueta}: escríbelo`; continue; }
      const error = validar(c, limpiarTexto(c, valor), estado.respuestas);
      if (error) return error === 'Usa solo letras' ? error : `${c.etiqueta}: ${error.charAt(0).toLowerCase()}${error.slice(1)}`;
    }
    campos.forEach(c => {
      const valor = partes[parteDe(c.nombre)] || '';
      if (valor) poner(estado, c, limpiarTexto(c, valor), origen);
      else quitar(estado, c.nombre);
    });
    completar(estado);
    return '';
  }

  /* ----- Aplicar lo que propone la IA o lo que la persona eligió ----- */
  // datos: [{ campo, valor }] o { campo: valor }. Se aplican en varias vueltas: un dato puede hacer visible a otro
  // (por ejemplo, apostilla=si muestra el país). Devuelve lo aceptado y lo rechazado con su motivo.
  function aplicarDatos(estado, datos, origen = 'ciudadano') {
    let porAplicar = (Array.isArray(datos) ? datos : Object.entries(datos || {}).map(([campo, valor]) => ({ campo, valor })))
      .filter(d => d && d.campo && !vacio(d.valor));
    const aceptados = [];
    const rechazados = [];
    const pistasCita = porAplicar.filter(d => /^cita_/.test(d.campo));
    porAplicar = porAplicar.filter(d => !/^cita_/.test(d.campo));
    for (let vuelta = 0; vuelta < 5 && porAplicar.length; vuelta++) {
      const siguen = [];
      for (const d of porAplicar) {
        const c = campoVisible(estado, d.campo);
        // La lista que depende de otra (municipio) espera a que esa tenga respuesta, aunque venga en el mismo mensaje
        if (!c || (c.depende && vacio(estado.respuestas[c.depende]?.valor))) { siguen.push(d); continue; }
        const resultado = valorPara(estado, c, d.valor);
        if (resultado.error) rechazados.push({ campo: c.nombre, etiqueta: c.etiqueta || c.nombre, valor: d.valor, error: resultado.error });
        else {
          poner(estado, c, resultado.valor, origen);
          aceptados.push({ campo: c.nombre, etiqueta: c.etiqueta || c.nombre, texto: estado.respuestas[c.nombre].texto });
        }
      }
      completar(estado);
      if (siguen.length === porAplicar.length) { porAplicar = siguen; break; }
      porAplicar = siguen;
    }
    porAplicar.forEach(d => {
      const c = campoDe(estado, d.campo);
      // Un dato de un campo que no aplica con lo respondido (o que no existe) se ignora sin molestar a la persona
      if (c) rechazados.push({ campo: c.nombre, etiqueta: c.etiqueta || c.nombre, valor: d.valor, error: '', noAplica: true });
    });
    if (pistasCita.length) aceptados.push(...resolverCita(estado, Object.fromEntries(pistasCita.map(d => [d.campo, d.valor]))));
    return { aceptados, rechazados: rechazados.filter(r => r.error) , ignorados: rechazados.filter(r => !r.error) };
  }

  function valorPara(estado, c, entrada) {
    if (c.soloLectura) return { error: 'Este dato viene de tu Identidad Digital: si está mal, cámbialo en Mi cuenta' };
    if (c.tipo === 'archivo') return { error: 'Este documento se adjunta con el clip' };
    if (esConsentimiento(c)) return { error: 'Esto se acepta al confirmar la solicitud' };
    if (c.tipo === 'opciones' || c.tipo === 'lista') {
      const opciones = opcionesDe(estado, c);
      const entradas = c.multiple ? (Array.isArray(entrada) ? entrada : String(entrada).split(/\s*[,;]\s*/)) : [Array.isArray(entrada) ? entrada[0] : entrada];
      const elegidas = entradas.map(e => resolverOpcion(opciones, e));
      if (!elegidas.length || elegidas.some(o => !o)) {
        const muestra = opciones.slice(0, 4).map(o => o.texto).join(', ');
        return { error: `Elige una de las opciones${muestra ? `: ${muestra}${opciones.length > 4 ? '…' : ''}` : ''}` };
      }
      return { valor: c.multiple ? elegidas.map(o => o.valor) : elegidas[0].valor };
    }
    const valor = limpiarTexto(c, entrada);
    const error = validar(c, valor, estado.respuestas);
    return error ? { error } : { valor };
  }

  /* ----- Cita presencial ----- */
  // Pistas en lenguaje natural ("Santa Ana", "el martes", "en la mañana", "10:30"): eligen la sede, el primer día que
  // coincide y la primera hora libre de la franja. Si el trámite tiene modalidad en línea o cita, pasa a cita.
  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  function resolverCita(estado, { cita_sede: sedeTexto, cita_dia: diaTexto, cita_franja: franjaTexto } = {}) {
    const aceptados = [];
    const cita = citas()[estado.numero];
    if (!cita) return aceptados;
    const modalidad = todosLosCampos(formularios()[estado.numero]).find(c => c.tipo === 'opciones' && (c.opciones || []).some(o => o.valor === 'cita'));
    if (modalidad && estado.respuestas[modalidad.nombre]?.valor !== 'cita') {
      poner(estado, modalidad, 'cita', 'ciudadano');
      completar(estado);
      aceptados.push({ campo: modalidad.nombre, etiqueta: modalidad.etiqueta, texto: estado.respuestas[modalidad.nombre].texto });
    }
    const sedeCampo = campoConOrigen(estado, 'sedes');
    if (!sedeCampo) return aceptados;
    if (sedeTexto) {
      const buscado = normalizar(sedeTexto);
      const sede = opcionesDe(estado, sedeCampo).find(o => normalizar(o.texto).includes(buscado) || buscado.includes(normalizar(o.texto)) || normalizar(o.detalle).includes(buscado));
      if (sede) { poner(estado, sedeCampo, sede.valor, 'ciudadano'); aceptados.push({ campo: sedeCampo.nombre, etiqueta: sedeCampo.etiqueta, texto: sede.texto }); }
    }
    if (vacio(estado.respuestas[sedeCampo.nombre]?.valor)) return aceptados;
    if (diaTexto || franjaTexto) proponerHorario(estado, { diaTexto, franjaTexto, origen: 'ciudadano' }).forEach(a => aceptados.push(a));
    return aceptados;
  }

  // El día y la hora: los que coinciden con las pistas o, sin pistas, el primer horario libre (como propuesta)
  function proponerHorario(estado, { diaTexto = '', franjaTexto = '', origen = 'propuesta' } = {}) {
    const aceptados = [];
    const diaCampo = campoConOrigen(estado, 'dias');
    if (!diaCampo) return aceptados;
    const dias = opcionesDe(estado, diaCampo);
    const pista = normalizar(diaTexto);
    const manana = new Date(); manana.setDate(manana.getDate() + 1);
    const numeroDia = pista.match(/\b(\d{1,2})\b/)?.[1];
    const dia = (pista && (
      dias.find(o => o.valor === pista)
      || (/pasado manana/.test(pista) ? dias[1] : null)
      || (/^manana$|^para manana/.test(pista) ? dias.find(o => o.valor === pasosTramite().isoDe(manana)) : null)
      || dias.find(o => DIAS.some(d => pista.includes(d) && normalizar(o.texto).startsWith(d)))
      || (numeroDia ? dias.find(o => Number(o.valor.slice(8)) === Number(numeroDia)) : null)
    )) || null;
    const elegido = dia || dias[0];
    if (!elegido) return aceptados;
    poner(estado, diaCampo, elegido.valor, dia ? origen : 'propuesta');
    aceptados.push({ campo: diaCampo.nombre, etiqueta: diaCampo.etiqueta, texto: elegido.texto });
    const horaCampo = campoConOrigen(estado, 'horas');
    if (!horaCampo) return aceptados;
    const horas = opcionesDe(estado, horaCampo);
    const f = normalizar(franjaTexto);
    const exacta = f.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|a\.?\s?m\.?|pm|p\.?\s?m\.?)?/);
    let hora = null;
    if (exacta && /\d/.test(f)) {
      let h = Number(exacta[1]);
      if (/p/.test(exacta[3] || '') && h < 12) h += 12;
      if (!exacta[3] && h < 7) h += 12;
      const buscada = `${String(h).padStart(2, '0')}:${exacta[2] || '00'}`;
      hora = horas.find(o => o.valor >= buscada);
    } else if (/tarde/.test(f)) hora = horas.find(o => o.valor >= '12:00');
    else if (/manana|temprano/.test(f)) hora = horas.find(o => o.valor < '12:00');
    const horaElegida = hora || horas[0];
    if (horaElegida) {
      poner(estado, horaCampo, horaElegida.valor, hora || dia ? origen : 'propuesta');
      aceptados.push({ campo: horaCampo.nombre, etiqueta: horaCampo.etiqueta, texto: horaElegida.texto });
    }
    return aceptados;
  }

  const modoCita = estado => Boolean(campoConOrigen(estado, 'sedes'));

  // La cita que quedó elegida, para el comprobante y el calendario (pasos-tramite.js)
  function citaElegida(estado) {
    const valor = origen => estado.respuestas[campoConOrigen(estado, origen)?.nombre]?.valor;
    const cantidad = camposVisibles(estado).find(c => c.cantidad);
    return { sede: Number(valor('sedes')), fecha: valor('dias'), hora: valor('horas'), cantidad: Number(cantidad && estado.respuestas[cantidad.nombre]?.valor) || 1 };
  }

  /* ----- Resumen y pago ----- */
  // Lo respondido que se ve, separado en datos de la cuenta, declaraciones y lo demás (sin repetidos ni omitidos)
  function resumen(estado) {
    const filas = camposVisibles(estado)
      .map(c => ({ c, r: estado.respuestas[c.nombre] }))
      .filter(({ r }) => r && !vacio(r.valor) && !r.repetido)
      .map(({ c, r }) => ({ nombre: c.nombre, etiqueta: c.etiqueta || c.nombre, texto: String(r.texto), origen: r.origen, tipo: c.tipo, sensible: c.tipo === 'archivo' || SENSIBLE.test(c.nombre) }));
    return {
      cuenta: filas.filter(f => f.origen === 'cuenta'),
      consentimientos: filas.filter(f => f.origen === 'consentimiento'),
      solicitud: filas.filter(f => f.origen !== 'cuenta' && f.origen !== 'consentimiento')
    };
  }
  const SENSIBLE = /dui|documento|pasaporte|carnet|nie|nit|nrc|cuenta|identidad/i;

  // Pago en línea: solo si el paso de pago del formulario aplica (con cita se paga en la sede). El monto, el del paso
  // (que puede depender de lo respondido) o el del catálogo
  function monto(estado) {
    const formulario = formularios()[estado.numero];
    const tramite = tramiteDe(estado.numero);
    const costo = pasosTramite().costoDe(tramite);
    const pago = (formulario.pasos || []).find(p => p.tipo === 'pago');
    const enLinea = Boolean(pago) && aplica(pago, estado.respuestas);
    const fijo = Array.isArray(pago?.monto) ? pago.monto.find(([si]) => cumple(si, estado.respuestas))?.[1] : pago?.monto;
    const total = enLinea ? fijo || costo.pago?.replace('desde ', '') || null : null;
    return {
      enLinea: enLinea && Boolean(total),
      total,
      desde: enLinea && !fijo && Boolean(costo.pago?.startsWith('desde')),
      gratis: costo.resumen === 'No tiene costo',
      enSede: modoCita(estado) && costo.resumen !== 'No tiene costo',
      resumen: costo.resumen
    };
  }

  /* ----- Trámites en proceso (Mis documentos y los pedidos en este navegador) ----- */
  function tramitesEnProceso(guardados = [], deLaCuenta = window.MIS_TRAMITES || []) {
    const ids = new Set(guardados.map(t => t.id));
    return [...guardados, ...deLaCuenta.filter(t => !ids.has(t.id))]
      .filter(t => t.estado !== 'finalizado' && t.estado !== 'completado' && tramiteDe(t.numero) && typeof t.fecha === 'string')
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  return {
    normalizar, paraComparar, cumple, aplica, pasosConDatos, ordenarPorDependencias, todosLosCampos, camposVisibles, campoVisible,
    campoDe, campoConOrigen, opcionesDe, resolverOpcion, esConsentimiento, validar, limpiarTexto, poner, completar, crear, pendientes,
    editables, aplicarDatos, resolverCita, proponerHorario, modoCita, citaElegida, resumen, monto, tramitesEnProceso,
    prefijoDeNombre, camposDeNombre, preguntarSiEsSuyo, responderSiEsSuyo, esperaCondicion, nombrePendiente, partirNombre, anotadoComo, ponerNombre
  };
})();
