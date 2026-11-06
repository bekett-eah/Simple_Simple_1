/* Formulario de cada trámite, copiado del portal simple.sv y del de la institución (sin datos personales).
   Clave: número del trámite en el catálogo. Lo pinta tramite.html y lo usa Indexlogin.html para saber qué tarjetas abren formulario.
   El primer paso va en la raíz (titulo, subtitulo, campos); tramite-publico.html solo muestra ese.
   informacion (opcional): lo que muestra el portal debajo de la descripción, en un solo desplegable cerrado (requisitos-tramite.js):
     { requisitos: { titulo, lista: [texto], importante: { titulo, parrafos: [texto] } }, detalles: [texto], leyes: [[ley, artículos]] }.
     En lista y detalles, lo que va antes de ": " sale en negrita.
   pasos (opcional): los pasos que siguen, en orden: { titulo, subtitulo, campos, si, tipo, boton }.
   - si:    el paso se hace solo si se cumple 'campo=valor' | 'campo!=valor' ('campo=a|b': cualquiera de los valores).
   - tipo:  'revision' (resumen de lo respondido y botón para confirmar) o 'pago' (total y botón de pagar, que abre la
            pasarela SERFINSA simulada y termina en la solicitud enviada; no se envía ni se cobra nada). Sus campos son notas.
   - monto: en el paso de pago, el total ('$5.00', o [['campo=valor', '$10.00'], …]: el primero que se cumpla);
            sin monto, el primero del costo del catálogo.
   - boton: texto del botón principal del paso (por defecto, "Siguiente").
   - fin:   'cita' en el último paso de una cita presencial: al confirmarlo se muestra la cita agendada (sin pago en línea).

   Tipos de campo:
   - nota:     { titulo, lineas, estilo: 'info' | 'aviso' | 'requisitos' }. En lineas, '- ' = viñeta y '## ' = subtítulo.
   - seccion:  { titulo }
   - desplegable: { titulo, icono, abierto, comoFilas }: (comoFilas: sus campos de lectura se muestran como filas "dato · valor", igual que el resumen de la revisión) lo que sigue (hasta el próximo desplegable o resumen) queda dentro de un desplegable
   - finDesplegable: cierra el desplegable anterior; lo que sigue vuelve a quedar fuera de él (campos que sí se escriben)
   - resumen:  { titulo, icono, abierto }: solo en un paso de revisión; el resumen de lo respondido, dentro de un desplegable
   - opciones: { nombre, etiqueta, opciones: [{ valor, texto, detalle, icono }], multiple, columna: una debajo de otra, dosColumnas: en dos columnas (en celular, una debajo de otra),
                 compacto: cuadrícula de 3 columnas sin icono (días, horas, cantidades),
                 origen: 'sedes' | 'dias' | 'horas' en lugar de opciones: las de la cita del trámite en citas.js
                 (las horas libres dependen de la sede y el día elegidos),
                 cantidad: cuántos documentos se piden (la cita lo usa para el pago en la sede) }
   - lista:    { nombre, etiqueta, opciones: [[valor, texto]] }. Con una sola opción, ya viene elegida.
                 depende + opcionesPor en lugar de opciones: las opciones salen de lo elegido en otra lista
                 ({ valorDeLaOtra: [[valor, texto]] }, como los municipios de cada departamento).
   - texto:    { nombre, etiqueta, placeholder, min, max, patron, modo: 'numeric' | 'email' | 'tel', igualA, sugerencias, soloLectura,
                 prohibidos: respuestas que no se aceptan, en mayúsculas y sin tildes (el error es mensaje) }
   - archivo:  { nombre, etiqueta, acepta }
   - opciones con marcado: true (la única opción, como "Acepto los términos") o marcado: 'valor' (esa opción): viene elegida; se puede quitar y,
     si la pregunta es obligatoria, se vuelve a pedir. whatsapp.html no lo usa: ahí se pregunta en la conversación
   info: { titulo, lineas } en una pregunta de opciones: la nota va como un icono de información junto a la etiqueta (tooltip al pasar el cursor;
   en celular, un clic la muestra debajo). En WhatsApp se envía como nota antes de la pregunta.
   Comunes: ayuda, mensaje (error), opcional, media (media fila, junto a los campos con media que lo rodean),
   tercio (un tercio de fila, igual; en el celular, uno debajo de otro),
   si: 'campo=valor' | 'campo!=valor' (se muestra solo si se cumple),
  prellenarSi: igual que si, para los campos que se llenan con ciudadano.js: el dato de quien inició sesión se escribe
  solo mientras se cumpla (por ejemplo, la persona inscrita en una partida, salvo en la de defunción).
  preguntaNombre (del formulario): en los chats (asistente y WhatsApp), lo que se pregunta antes de un nombre por partes
  con prellenarSi, para saber si es el de quien inició sesión ('¿La partida es a tu nombre?'). Si no lo es, el nombre se
  pide completo en un solo mensaje; el formulario del sitio sigue pidiéndolo por partes.
  Los nombres que empiezan con cita_ los reserva el motor para la sede, el día y la hora de la cita (motor-tramite.js):
  un campo así no se guarda. */
(() => {
  const FORMATOS_IMAGEN = 'Formatos permitidos: JPG, JPEG, PNG, PDF';
  const ACEPTA_IMAGEN = '.jpg,.jpeg,.png,.pdf';
  const SOLO_LETRAS = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+";
  const DEPARTAMENTOS = [['01', 'Ahuachapán'], ['09', 'Cabañas'], ['04', 'Chalatenango'], ['07', 'Cuscatlán'], ['05', 'La Libertad'], ['08', 'La Paz'], ['14', 'La Unión'], ['13', 'Morazán'], ['12', 'San Miguel'], ['06', 'San Salvador'], ['10', 'San Vicente'], ['02', 'Santa Ana'], ['03', 'Sonsonate'], ['11', 'Usulután']];
  const SI_NO = [{ valor: 'si', texto: 'Sí', icono: 'ph-check' }, { valor: 'no', texto: 'No', icono: 'ph-x' }];
  const PERSONA = (si_juridica = 'persona_juridica') => [
    { valor: 'persona_natural', texto: 'Persona natural', icono: 'ph-user' },
    { valor: si_juridica, texto: 'Persona jurídica', icono: 'ph-buildings' }
  ];

  // RNPN: nota de costo y aceptación de términos
  const rnpn = ({ costo, terminosTitulo, terminos, aceptaEtiqueta }) => ({
    titulo: 'Nota informativa',
    subtitulo: 'Lee la información antes de continuar',
    campos: [
      { tipo: 'nota', estilo: 'info', titulo: '¡Hola!', desplegable: true, lineas: costo },
      { tipo: 'nota', estilo: 'aviso', titulo: terminosTitulo, desplegable: true, abierta: false, lineas: terminos },
      { tipo: 'opciones', nombre: 'acepta_terminos', etiqueta: aceptaEtiqueta, marcado: true, opciones: [{ valor: 'acepto', texto: 'Acepto los términos', icono: 'ph-handshake' }] }
    ]
  });

  // RNPN: municipios de cada departamento, como los lista el portal (los 262 de antes de la reforma de 2024)
  const MUNICIPIOS = Object.fromEntries(Object.entries({
    '01': 'Ahuachapán,Apaneca,Atiquizaya,Concepción de Ataco,El Refugio,Guaymango,Jujutla,San Francisco Menéndez,San Lorenzo,San Pedro Puxtla,Tacuba,Turín',
    '09': 'Cinquera,Guacotecti,Ilobasco,Jutiapa,San Isidro,Sensuntepeque,Tejutepeque,Victoria,Villa Dolores',
    '04': 'Agua Caliente,Arcatao,Azacualpa,Cancasque,Chalatenango,Citalá,Comalapa,Concepción Quezaltepeque,Dulce Nombre de María,El Carrizal,El Paraíso,La Laguna,La Palma,La Reina,Las Flores,Las Vueltas,Nombre de Jesús,Nueva Concepción,Nueva Trinidad,Ojos de Agua,Potonico,San Antonio de la Cruz,San Antonio Los Ranchos,San Fernando,San Francisco Lempa,San Francisco Morazán,San Ignacio,San Isidro Labrador,San Luis del Carmen,San Miguel de Mercedes,San Rafael,Santa Rita,Tejutla',
    '07': 'Candelaria,Cojutepeque,El Carmen,El Rosario,Monte San Juan,Oratorio de Concepción,San Bartolomé Perulapía,San Cristóbal,San José Guayabal,San Pedro Perulapán,San Rafael Cedros,San Ramón,Santa Cruz Analquito,Santa Cruz Michapa,Suchitoto,Tenancingo',
    '05': 'Antiguo Cuscatlán,Chiltiupán,Ciudad Arce,Colón,Comasagua,Huizúcar,Jayaque,Jicalapa,La Libertad,Nuevo Cuscatlán,Quezaltepeque,Sacacoyo,San José Villanueva,San Juan Opico,San Matías,San Pablo Tacachico,Santa Tecla,Talnique,Tamanique,Teotepeque,Tepecoyo,Zaragoza',
    '08': 'Cuyultitán,El Rosario,Jerusalén,Mercedes La Ceiba,Olocuilta,Paraíso de Osorio,San Antonio Masahuat,San Emigdio,San Francisco Chinameca,San Juan Nonualco,San Juan Talpa,San Juan Tepezontes,San Luis La Herradura,San Luis Talpa,San Miguel Tepezontes,San Pedro Masahuat,San Pedro Nonualco,San Rafael Obrajuelo,Santa María Ostuma,Santiago Nonualco,Tapalhuaca,Zacatecoluca',
    '14': 'Anamorós,Bolívar,Concepción de Oriente,Conchagua,El Carmen,El Sauce,Intipucá,La Unión,Lislique,Meanguera del Golfo,Nueva Esparta,Pasaquina,Polorós,San Alejo,San José,Santa Rosa de Lima,Yayantique,Yucuaiquín',
    '13': 'Arambala,Cacaopera,Chilanga,Corinto,Delicias de Concepción,El Divisadero,El Rosario,Gualococti,Guatajiagua,Joateca,Jocoaitique,Jocoro,Lolotiquillo,Meanguera,Osicala,Perquín,San Carlos,San Fernando,San Francisco Gotera,San Isidro,San Simón,Sensembra,Sociedad,Torola,Yamabal,Yoloaiquín',
    '12': 'Carolina,Chapeltique,Chinameca,Chirilagua,Ciudad Barrios,Comacarán,El Tránsito,Lolotique,Moncagua,Nueva Guadalupe,Nuevo Edén de San Juan,Quelepa,San Antonio,San Gerardo,San Jorge,San Luis de la Reina,San Miguel,San Rafael Oriente,Sesori,Uluazapa',
    '06': 'Aguilares,Apopa,Ayutuxtepeque,Cuscatancingo,Delgado,El Paisnal,Guazapa,Ilopango,Mejicanos,Nejapa,Panchimalco,Rosario de Mora,San Marcos,San Martín,San Salvador,Santiago Texacuangos,Santo Tomás,Soyapango,Tonacatepeque',
    '10': 'Apastepeque,Guadalupe,San Cayetano Istepeque,San Esteban Catarina,San Ildefonso,San Lorenzo,San Sebastián,San Vicente,Santa Clara,Santo Domingo,Tecoluca,Tepetitán,Verapaz',
    '02': 'Candelaria de la Frontera,Chalchuapa,Coatepeque,El Congo,El Porvenir,Masahuat,Metapán,San Antonio Pajonal,San Sebastián Salitrillo,Santa Ana,Santa Rosa Guachipilín,Santiago de la Frontera,Texistepeque',
    '03': 'Acajutla,Armenia,Caluco,Cuisnahuat,Izalco,Juayúa,Nahuizalco,Nahulingo,Salcoatitán,San Antonio del Monte,San Julián,Santa Catarina Masahuat,Santa Isabel Ishuatán,Santo Domingo de Guzmán,Sonsonate,Sonzacate',
    '11': 'Alegría,Berlín,California,Concepción Batres,El Triunfo,Ereguayquín,Estanzuelas,Jiquilisco,Jucuapa,Jucuarán,Mercedes Umaña,Nueva Granada,Ozatlán,Puerto El Triunfo,San Agustín,San Buenaventura,San Dionisio,San Francisco Javier,Santa Elena,Santa María,Santiago de María,Tecapán,Usulután'
  }).map(([departamento, lista]) => [departamento, lista.split(',').map(m => [m, m])]));

  // RNPN: nombre por partes, como lo pide el portal. prefijo: de quién es ('madre_', 'padre_'…); obligatorio: primer nombre
  // y primer apellido; casada: pide el apellido de casada (true, o la condición con que se pide); si: la de todas las partes
  const nombrePorPartes = (prefijo, { obligatorio = false, casada = false, si, prellenarSi } = {}) => {
    const parte = (nombre, etiqueta, requerido = false) => ({
      tipo: 'texto', nombre: prefijo + nombre, etiqueta, max: 50, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', opcional: !requerido, tercio: true, ...(si ? { si } : {}), ...(prellenarSi ? { prellenarSi } : {})
    });
    const partes = [parte('primer_nombre', 'Primer nombre', obligatorio), parte('segundo_nombre', 'Segundo nombre'), parte('tercer_nombre', 'Tercer nombre'),
      parte('primer_apellido', 'Primer apellido', obligatorio), parte('segundo_apellido', 'Segundo apellido')];
    if (casada) partes.push({ ...parte('apellido_de_casada', 'Apellido de casada'), ...(casada === true ? {} : { si: casada }) });
    return partes;
  };

  const ANDA_SERVICIOS = {
    titulo: 'Selección de servicios',
    subtitulo: 'Elige el servicio y cuéntanos quién lo solicita',
    campos: [
      { tipo: 'opciones', nombre: 'servicio_a_solicitar', etiqueta: 'Servicio a solicitar', opciones: [
        { valor: 'factibilidad_vivienda', texto: 'Factibilidad para una vivienda', detalle: '$13.56', icono: 'ph-house-line' },
        { valor: 'cambio_nombre', texto: 'Cambio de nombre', detalle: '$2.26', icono: 'ph-user-switch' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_cuenta', etiqueta: 'N.º de cuenta', modo: 'numeric', si: 'servicio_a_solicitar=cambio_nombre' },
      { tipo: 'archivo', nombre: 'ultima_factura', etiqueta: 'Adjunta imagen de tu última factura', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: 'servicio_a_solicitar=cambio_nombre' },
      { tipo: 'nota', estilo: 'info', titulo: 'Nota', lineas: ['Como tu solicitud es de cambio de nombre, la información que coloques en las pantallas siguientes es la del nuevo responsable de la cuenta, según la documentación que presentas'], si: 'servicio_a_solicitar=cambio_nombre' },
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento de identidad', si: 'tipo_persona=persona_natural', opciones: [
        { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento de identidad', si: 'tipo_persona=persona_natural' }
    ]
  };

  const MINEDUCYT_CENTROS = {
    titulo: 'Requisitos del trámite',
    subtitulo: 'Revisa los requisitos antes de continuar',
    campos: [
      { tipo: 'nota', estilo: 'requisitos', titulo: 'Creación, nominación y funcionamiento de centros educativos', lineas: [
        '## Requisitos de infraestructura para centros educativos oficiales y privados',
        '- Las instalaciones deben ser de uso exclusivo para la prestación de servicios educativos, contar con un aula disponible por cada grado o sección solicitado (no se autorizan grados fusionados)',
        '- El área de recreación debe estar conforme al número de alumnos de los grados y secciones solicitados',
        '- Las áreas educativas deberán incluir todos los servicios necesarios para el funcionamiento del centro educativo, tales como: sala de docentes, sala de primeros auxilios, Dirección y área administrativa, así como también: laboratorio de ciencias y centro de cómputo en caso de III ciclo y Educación Media, y si el bachillerato es técnico debe contar con los talleres o áreas equipadas para las prácticas, según la especialidad',
        '- La infraestructura NO deberá estar ubicada en zonas consideradas de alto riesgo, y que constituyan peligro para la seguridad física y moral o la salud mental y la vida de las niñas y los niños. Las zonas de seguridad internas deben estar señalizadas y ser del conocimiento del personal, alumnos y sus familias',
        'Si solicitas el nivel de Educación Inicial, toma en consideración lo siguiente:',
        '- Si la construcción es de 2 niveles, los niños deben ubicarse en la 1ª planta',
        '- Las áreas verdes o similares para la recreación, esparcimiento y práctica de ejercicios de psicomotricidad deben ser adecuadas a la cantidad de estudiantes proyectados',
        '- Contar con una normativa interna para la protección integral',
        '- Los espacios deben ser cómodos, seguros, accesibles, adecuados y complementarios para las áreas de atención a las niñas y niños que favorezcan el libre movimiento: el salón de juego y psicomotricidad, área de gateo, el salón de descanso, la cocina para el manejo de los alimentos y espacio de aseo personal, todos con características de higiene y convivencia',
        '## Documentación para centros educativos privados',
        'Aplica para creación, nominación y funcionamiento, ampliación de servicios y cambio de domicilio',
        'Persona natural:',
        '- Documento de identificación',
        'Persona jurídica:',
        '- Documento Único de Identidad (DUI), Número de Identificación Tributaria (NIT) y credencial actualizada del Representante Legal',
        '- Estatutos publicados, en los que haga constar que tiene como fines la educación',
        'Permisos:',
        '- Calificación del lugar extendida por la Oficina de Planificación del Área Metropolitana de San Salvador (OPAMSS); en caso de no pertenecer a esta zona, se debe presentar la autorización del departamento correspondiente de la Alcaldía Municipal donde se ubica el centro educativo',
        '- Certificación de autorización de las condiciones de seguridad para los estudiantes, extendida por el Cuerpo de Bomberos de El Salvador. Vigente',
        '- Certificación de autorización de las condiciones de saneamiento ambiental, extendida por la Unidad de Salud del domicilio del centro educativo',
        '- El instrumento público o documento privado reconocido ante notario mediante el cual se hace la transferencia del dominio del inmueble, o documento en el que conste la posesión del inmueble',
        'Documentación del director (no aplica para ampliación de servicios ni cambio de domicilio):',
        '- Documento Único de Identidad (DUI), Número de Identificación Tributaria (NIT) y Número de Identificación Profesional (NIP)',
        '- Currículo',
        '- Solvencia de la Policía Nacional Civil y constancia de antecedentes penales (vigencia de 3 meses)',
        '## Documentación para centros educativos oficiales',
        'Persona jurídica:',
        '- Documento Único de Identidad (DUI) y Número de Identificación Tributaria (NIT)',
        'Permisos:',
        '- Calificación del lugar autorizada por el departamento correspondiente de la Alcaldía Municipal donde se ubica el centro educativo',
        '- Certificación de autorización de las condiciones de seguridad para los estudiantes, extendida por el Cuerpo de Bomberos de El Salvador. Vigente',
        '- Certificación de autorización de las condiciones de saneamiento ambiental, extendida por la Unidad de Salud del domicilio del centro educativo',
        '- Carta de ofrecimiento de persona natural o jurídica para donación o comodato de inmueble a favor del Ministerio de Educación, cuando aplique',
        '## Comisión nominadora',
        'Nombres propuestos para el centro educativo (solo aplica para creación, nominación y funcionamiento de centros educativos privados):',
        '- Se ingresarán tres nombres propuestos en orden de prioridad, con su debida justificación; estos deben establecerse en idioma castellano, según el Reglamento para la Nominación de Centros Educativos',
        'La nominación o cambio de nominación podrá referirse a:',
        '- Nombres de personajes ilustres en cualquier rama de las letras, las ciencias o las artes',
        '- Nombres de maestros distinguidos que hayan recibido algún tipo de mención honorífica',
        'Los centros educativos de educación inicial, parvularia, básica y media se sujetarán a las reglas señaladas anteriormente, pudiendo además proponer nominaciones relacionadas con valores, principios pedagógicos y frases acordes a la naturaleza de la institución educativa o al desarrollo cognitivo, en el caso de la primera infancia',
        'De conformidad con el artículo 98 de la Ley General de Educación es una falta muy grave funcionar sin los acuerdos de autorización y nominación correspondientes. Asimismo, el artículo 100 del referido cuerpo legal establece que en caso de faltas graves y muy graves, las sanciones a aplicar podrán ser multas, la suspensión temporal de funcionamiento o la revocatoria de la autorización de funcionamiento'
      ] }
    ]
  };

  const BACHILLERATOS = ['BACHILLERATO GENERAL', 'BACHILLERATO TÉCNICO VOCACIONAL EN ACUICULTURA', 'BACHILLERATO TÉCNICO VOCACIONAL EN LOGÍSTICA GLOBAL', 'BACHILLERATO TÉCNICO VOCACIONAL EN LÁCTEOS Y CÁRNICOS', 'BACHILLERATO TÉCNICO VOCACIONAL EN ELECTRÓNICA', 'BACHILLERATO TÉCNICO VOCACIONAL EN LOGÍSTICA Y ADUANAS', 'BACHILLERATO TÉCNICO VOCACIONAL EN GESTIÓN Y DESARROLLO TURÍSTICO', 'BACHILLERATO TÉCNICO VOCACIONAL EN SERVICIOS TURÍSTICOS', 'BACHILLERATO TÉCNICO VOCACIONAL EN MANTENIMIENTO DE AERONAVES', 'BACHILLERATO TÉCNICO VOCACIONAL EN PATRIMONIO CULTURAL', 'BACHILLERATO TÉCNICO VOCACIONAL EN AGROINDUSTRIA', 'BACHILLERATO TÉCNICO VOCACIONAL EN MECÁNICA INDUSTRIAL', 'BACHILLERATO TÉCNICO VOCACIONAL EN SISTEMAS ELÉCTRICOS', 'BACHILLERATO TÉCNICO VOCACIONAL EN DESARROLLO DE SOFTWARE', 'BACHILLERATO TÉCNICO VOCACIONAL ADMINISTRATIVO CONTABLE', 'BACHILLERATO TÉCNICO VOCACIONAL EN INFRAESTRUCTURA TECNOLÓGICA Y SERVICIOS INFORMÁTICOS', 'BACHILLERATO TÉCNICO VOCACIONAL EN ATENCIÓN PRIMARIA EN SALUD', 'BACHILLERATO TÉCNICO VOCACIONAL EN MANTENIMIENTO AUTOMOTRIZ', 'BACHILLERATO TÉCNICO VOCACIONAL AGROPECUARIO', 'BACHILLERATO TÉCNICO VOCACIONAL EN INGENIERÍA ELÉCTRICA', 'BACHILLERATO TÉCNICO VOCACIONAL EN INGENIERÍA CIVIL', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN DISEÑO GRÁFICO', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL EN SISTEMAS INFORMÁTICOS', 'BACHILLERATO TÉCNICO VOCACIONAL COMERCIAL OPCIÓN CONTADURÍA', 'BACHILLERATO TÉCNICO VOCACIONAL EN GESTIÓN DE TURISMO ALTERNATIVO', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN MECÁNICA NAVAL', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN ELECTRÓNICA NAVAL', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN MECÁNICA GENERAL', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN ELECTROTECNIA', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN ELECTRÓNICA', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN MECÁNICA AUTOMOTRIZ', 'BACHILLERATO TÉCNICO VOCACIONAL COMERCIAL OPCIÓN SECRETARIADO', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL AERONÁUTICO', 'BACHILLERATO TÉCNICO INDUSTRIAL OPCIÓN ELECTROTECNIA', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN SISTEMAS INFORMÁTICOS', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN ARQUITECTURA', 'BACHILLERATO TÉCNICO INDUSTRIAL OPCIÓN ELECTRÓNICA', 'BACHILLERATO TÉCNICO EN HOTELERÍA', 'BACHILLERATO TÉCNICO COMERCIAL OPCIÓN ASISTENCIA ADMINISTRATIVA', 'BACHILLERATO TÉCNICO VOCACIONAL INDUSTRIAL OPCIÓN ELECTROMECÁNICA', 'BACHILLERATO TÉCNICO VOCACIONAL OPCIÓN ELECTRÓNICA', 'BACHILLERATO TÉCNICO VOCACIONAL AGRÍCOLA', 'BACHILLERATO TÉCNICO INDUSTRIAL OPCIÓN MECÁNICA AUTOMOTRIZ', 'BACHILLERATO TÉCNICO COMERCIAL OPCIÓN ASISTENCIA CONTABLE', 'BACHILLERATO TÉCNICO VOCACIONAL EN SALUD', 'BACHILLERATO TÉCNICO VOCACIONAL EN MÚSICA', 'BACHILLERATO TÉCNICO VOCACIONAL EN PROCESAMIENTO DE LÁCTEOS', 'BACHILLERATO TÉCNICO VOCACIONAL EN PRODUCCIÓN ACUÍCOLA', 'BACHILLERATO TÉCNICO VOCACIONAL EN ELABORACIÓN DE ALIMENTOS Y BEBIDAS', 'BACHILLERATO TÉCNICO VOCACIONAL EN PRODUCCIÓN AGROPECUARIA', 'BACHILLERATO TÉCNICO VOCACIONAL EN TÉCNICAS DE CONFECCIÓN TEXTIL', 'BACHILLERATO TÉCNICO VOCACIONAL EN SERVICIOS PREVENTIVOS DEL VEHÍCULO', 'BACHILLERATO TÉCNICO VOCACIONAL EN DESARROLLO DE PRODUCTOS EN MADERA', 'BACHILLERATO TÉCNICO VOCACIONAL EN ADMINISTRACIÓN Y MERCADEO', 'BACHILLERATO TÉCNICO VOCACIONAL EN DANZA', 'BACHILLERATO TÉCNICO VOCACIONAL EN ARTES PLÁSTICAS', 'TÍTULO DE CONTADOR', 'TÍTULO DE TENEDOR DE LIBROS'];

  // Muestra de la lista de instituciones del portal (allá es una lista completa; aquí sirve de sugerencia al escribir)
  const INSTITUCIONES = ['AHUACHAPÁN - AHUACHAPÁN - CENTRO ESCOLAR ISIDRO MENÉNDEZ', 'AHUACHAPÁN - AHUACHAPÁN - CENTRO ESCOLAR ALEJANDRO DE HUMBOLDT', 'CHALATENANGO - SANTA RITA - INSTITUTO NACIONAL SANTA RITA', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO GENERAL FABIO MORÁN', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO ISABEL CARRILLO DE BOLAÑOS', 'AHUACHAPÁN - AHUACHAPÁN - CENTRO ESCOLAR CANTÓN LOS MAGUEYES', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO CANTÓN RÍO FRÍO', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO DOCTOR RAFAEL MEZA DELGADO', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO DOCTOR ARTURO ROMERO', 'AHUACHAPÁN - AHUACHAPÁN - COMPLEJO EDUCATIVO HACIENDA LA LABOR', 'AHUACHAPÁN - AHUACHAPÁN - INSTITUTO NACIONAL ALEJANDRO DE HUMBOLDT', 'AHUACHAPÁN - AHUACHAPÁN - INSTITUTO NACIONAL LUIS REYNALDO TOBAR', 'LA LIBERTAD - SACACOYO - INSTITUTO NACIONAL DE SACACOYO', 'AHUACHAPÁN - SAN FRANCISCO MENÉNDEZ - INSTITUTO NACIONAL CANTÓN CARA SUCIA', 'AHUACHAPÁN - APANECA - INSTITUTO NACIONAL LICENCIADO JOSÉ DANIEL CARÍAS', 'AHUACHAPÁN - APANECA - CENTRO ESCOLAR GENERAL FRANCISCO MENÉNDEZ', 'AHUACHAPÁN - ATIQUIZAYA - COMPLEJO EDUCATIVO CANTÓN IZCAQUILIO', 'SAN SALVADOR - APOPA - INSTITUTO NACIONAL COLONIA VALLE DEL SOL', 'AHUACHAPÁN - ATIQUIZAYA - INSTITUTO NACIONAL CORNELIO AZENÓN SIERRA', 'AHUACHAPÁN - ATIQUIZAYA - CENTRO ESCOLAR MERCEDES MONTERROSA DE CÁRCAMO', 'CHALATENANGO - SAN IGNACIO - INSTITUTO NACIONAL CANTÓN LAS PILAS', 'SANTA ANA - COATEPEQUE - INSTITUTO NACIONAL DE COATEPEQUE', 'SONSONATE - SONZACATE - CENTRO ESCOLAR EL SAUCE', 'AHUACHAPÁN - CONCEPCIÓN DE ATACO - COMPLEJO EDUCATIVO ANTONIO J. ALFARO', 'AHUACHAPÁN - GUAYMANGO - CENTRO ESCOLAR DE GUAYMANGO', 'CHALATENANGO - ARCATAO - INSTITUTO NACIONAL DE ARCATAO', 'MORAZÁN - YAMABAL - INSTITUTO NACIONAL DE YAMABAL', 'AHUACHAPÁN - JUJUTLA - COMPLEJO EDUCATIVO COLONIA NUEVA', 'CABAÑAS - JUTIAPA - INSTITUTO NACIONAL DE JUTIAPA', 'AHUACHAPÁN - EL REFUGIO - INSTITUTO NACIONAL DE EL REFUGIO', 'AHUACHAPÁN - SAN FRANCISCO MENÉNDEZ - COMPLEJO EDUCATIVO CANTÓN LA HACHADURA', 'LA PAZ - SAN MIGUEL TEPEZONTES - INSTITUTO NACIONAL DE SAN MIGUEL TEPEZONTES', 'AHUACHAPÁN - SAN FRANCISCO MENÉNDEZ - COMPLEJO EDUCATIVO GARITA PALMERA', 'AHUACHAPÁN - SAN LORENZO - COMPLEJO EDUCATIVO ABEL WILFREDO VELASCO CÁRCAMO', 'AHUACHAPÁN - SAN PEDRO PUXTLA - CENTRO ESCOLAR CANTÓN EL CORTEZ', 'SAN SALVADOR - SAN MARTÍN - COMPLEJO EDUCATIVO RESIDENCIAL ALTAVISTA', 'CABAÑAS - CINQUERA - INSTITUTO NACIONAL DE CINQUERA', 'AHUACHAPÁN - TACUBA - INSTITUTO NACIONAL LICENCIADO RENÉ PORFIRIO OSORIO', 'AHUACHAPÁN - TACUBA - COMPLEJO EDUCATIVO JOSÉ MARTÍ', 'AHUACHAPÁN - TACUBA - COMPLEJO EDUCATIVO ADELA CALDERÓN DE HERRERA', 'CUSCATLÁN - EL ROSARIO - INSTITUTO NACIONAL DE EL ROSARIO', 'SAN SALVADOR - MEJICANOS - INSTITUTO NACIONAL DE LA COLONIA SAN RAMÓN', 'AHUACHAPÁN - TURÍN - COMPLEJO EDUCATIVO JUAN DE DIOS DEL CID', 'AHUACHAPÁN - TURÍN - COMPLEJO EDUCATIVO PROFESOR RODRIGO FLORES', 'SANTA ANA - SANTA ANA - INSTITUTO NACIONAL CASERÍO PRIMAVERA', 'SANTA ANA - CANDELARIA DE LA FRONTERA - COMPLEJO EDUCATIVO BARTOLOMÉ BOLAÑOS'];

  // DGCP: países de la apostilla (la lista del portal, sin repetidos y en orden alfabético)
  const PAISES_APOSTILLA = ['Albania', 'Alemania', 'Andorra', 'Antigua y Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bahrein', 'Barbados', 'Belarús', 'Bélgica', 'Belice', 'Benín', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burundi', 'Cabo Verde', 'Canadá', 'Chile', 'Chipre', 'Colombia', 'Cook, Islas', 'Corea del Sur', 'Costa Rica', 'Croacia', 'Dinamarca', 'Dominica', 'Ecuador', 'El Salvador', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos de América', 'Estonia', 'Eswatini', 'Fiji', 'Filipinas', 'Finlandia', 'Francia', 'Georgia', 'Granada', 'Grecia', 'Guatemala', 'Holanda', 'Honduras', 'Hong Kong', 'Hungría', 'India', 'Indonesia', 'Irlanda', 'Islandia', 'Israel', 'Italia', 'Japón', 'Kazajstán', 'Kirguistán', 'Kosovo', 'Lesoto', 'Letonia', 'Liberia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Macao', 'Macedonia', 'Malasia', 'Malawi', 'Malta', 'Marruecos', 'Marshall, Islas', 'Mauricio (Isla)', 'México', 'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro', 'Namibia', 'Nicaragua', 'Niue', 'Noruega', 'Nueva Zelandia', 'Omán', 'Países Bajos', 'Panamá', 'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Checa', 'República Dominicana', 'Rumania', 'Rusia', 'Saint Kitts y Nevis', 'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sri Lanka', 'Suazilandia', 'Sudáfrica', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tayikistán', 'Tonga', 'Trinidad y Tabago', 'Túnez', 'Turquía', 'Ucrania', 'Unión Europea', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Viet Nam', 'Zambia'];

  // DGCP: lugares que el portal rechaza por no decir dónde se entregará la constancia
  const LUGARES_GENERICOS = ['A QUIEN CORRESPONDA', 'A QUIEN INTERESE', 'ALQUILER DE APARTAMENTOS O CASAS', 'APLICAR PLAZA DE PPI', 'ARRENDAMIENTO', 'ARRENDAMIENTOS', 'CARNET CEPA', 'CARNET DE CEPA', 'CIUDAD BARRIOS', 'CIUDAD DE GUATEMALA', 'CLIENTES A LOS QUE DOY SERVICIOS', 'COL SAN FRANCISCO', 'COLONIA LIBERTAD', 'CONDUCTOR', 'CORREO ELECTRONICO', 'CUALQUIER OCASIONES', 'DIFERENTES LUGARES', 'EL SALVADOR', 'EMPLEO EMPLEO', 'EMPLEO EMPRESA', 'EMPRESA COMERCIAL', 'EMPRESA DE TRABAJO', 'EMPRESAS VARIAS', 'EN BUSQUEDA DE EMPLEO', 'EN EL TRABAJO', 'EN EMPLEO', 'EN LA CASA', 'EN LOS EMPLEOS QUE QUIERA APLICAR', 'EN MI LUGAR DE TRABAJO', 'EN MI TRABAJO', 'EN MIGRACION', 'EN TRABAJO', 'EN UN TRABAJO', 'ES PARA SOLICITAR EMPLEO DE UBER', 'FINES ADMINISTRATIVOS', 'FLOR BLANCA', 'FUTURO TRABAJO', 'INDEFINIDO', 'INSTITUCION FINANCIERA', 'JUZGADOS', 'LUGAR DE EMPLEO', 'LUGARES VARIOS', 'OFICINA ADMINISTRATIVA', 'OFICIOS VARIOS', 'PARA ADQUIRIR UN TRABAJO', 'PARA EMPLEO', 'PARA OFERTA LABORAL', 'PARA TRABAJO', 'PARA USO PERSONAL', 'PLATAFORMA VIRTUAL', 'PLATAFORMAS', 'POR MOTIVOS LABORALES', 'PROCESO CONSULAR', 'SAN MIIGUEL', 'SANTA ANA, EL SALVADOR', 'SEDE CENTRAL', 'SOLICITUD DE EMPLEO', 'TENENCIA PERSONAL', 'TRABAJO DE CONSTRUCCION', 'TRABAJO EMPRESA', 'TRAMITE CARNET DE CEPA', 'TRAMITE DE ADOPCION', 'TRAMITE DE CASA', 'TRAMITE PERSONAL', 'TRAMITES MIGRATORIOS', 'TRAMITES PERSONALES', 'TRANSPORTE', 'UNIVERSIDAD', 'USO PERSONAL', 'VARIAS EMPRESAS', 'EMPRESA PRIVADA', 'SAN SALVADOR', 'PRESENTARLA EN FUTURO TRABAJO', 'TRABAJO', 'PARA CREDITO PERSONAL', 'QUIEN INTERESE', 'EMPRESAS', 'LUGAR DE TRABAJO', 'ANTIGUO CUSCATLAN', 'ESTRANJERIA', 'EXTRANGERIA', 'ESTRANGERIA', 'EXTRANGERIA DE ESPANA', 'EXTRANGERIA ESPANA'];

  // Últimos pasos del nuevo diseño: revisar y confirmar la solicitud, y pagar
  const REVISION = { tipo: 'revision', titulo: 'Revisa tu solicitud', subtitulo: 'Confirma que todo esté bien antes de pagar', boton: 'Confirmar solicitud', campos: [] };
  const PAGO = {
    tipo: 'pago',
    titulo: 'Pago',
    subtitulo: 'Paga en línea para terminar tu solicitud',
    campos: [{ tipo: 'nota', estilo: 'info', lineas: ['Pagas con tarjeta de crédito o débito en la pasarela segura de SERFINSA'] }]
  };

  const F = {};

  /* ===== Medio ambiente (MARN) ===== */
  F[71] = {
    numero: '1.1',
    titulo: 'Datos personales',
    subtitulo: 'Cuéntanos quién hace la solicitud',
    icono: 'ph-cloud-lightning',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'solicitud_como', etiqueta: 'Solicitud como', opciones: [
        { valor: 'institucion_publica', texto: 'Institución pública', icono: 'ph-bank' },
        { valor: 'institucion_privada', texto: 'Institución privada', icono: 'ph-briefcase' },
        { valor: 'institucion_academica', texto: 'Institución académica', detalle: 'Universidades, colegios e institutos', icono: 'ph-graduation-cap' }
      ] },
      { tipo: 'opciones', nombre: 'tipo_documento_de_identidad', etiqueta: 'Tipo de documento de identidad', ayuda: 'De la persona que solicita el trámite', opciones: [
        { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residencia', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'pasaporte', etiqueta: 'Número de pasaporte', mensaje: 'Escribe el número de tu pasaporte', si: 'tipo_documento_de_identidad=pasaporte' },
      { tipo: 'texto', nombre: 'carnet_de_residencia', etiqueta: 'Número de carnet de residencia', placeholder: '0000000', max: 7, patron: '[0-9]{7}', modo: 'numeric', mensaje: 'Escribe los 7 números de tu carnet', si: 'tipo_documento_de_identidad=carnet_de_residencia' }
    ]
  };

  /* ===== Empleo y trabajo ===== */
  // DGCP (antecedentes.seguridad.gob.sv). En línea, el portal pide en una sola pantalla el perfil del ciudadano (sale de
  // su cuenta y no se puede cambiar), los datos de la constancia y la apostilla. Al presionar "Solicitar" pide confirmar,
  // porque los datos ya no podrán modificarse, y después se paga. Aquí va en pasos.
  // Con cita (antecedentes.seguridad.gob.sv/servicios/solicitud-cita) pide el mismo perfil, teléfono y dirección de
  // residencia, la sede, la fecha de retiro, la hora de llegada y cuántas constancias (máximo 3); se paga en la sede.
  // Sedes, días y horas salen de citas.js, como en el asistente.
  const EN_LINEA = 'modalidad=en_linea';
  const CITA = 'modalidad=cita';
  F[99] = {
    informacion: {
      requisitos: {
        titulo: 'Datos requeridos',
        lista: ['Documento Único de Identidad vigente'],
        importante: { titulo: '¡Importante!', parrafos: [
          'Te informamos que el trámite de Antecedentes Penales tiene un tiempo de respuesta de 12 horas hábiles, contadas a partir de que finalices tu pago',
          'El documento de tu constancia no será enviado por correo electrónico, sino que, una vez que tu solicitud haya sido procesada completamente y sin observaciones, podrás descargar tu constancia en la sección “Mis documentos”',
          'Para evitar confusión, te aclaramos que las solicitudes de Antecedentes Penales no se muestran en la lista de tus trámites en proceso. Esto no indica que tu solicitud no haya sido recibida; por consiguiente, no debes realizar un nuevo trámite, bastará con que guardes tu comprobante de pago',
          'Una vez completado el proceso, tus solicitudes se mostrarán con el estado “Finalizado”',
          'Si posees dudas, consultas o alguna observación sobre tu constancia, puedes escribir al correo atencion.antecedentes@dgcp.gob.sv'
        ] }
      },
      detalles: [
        'Vigencia: El tipo de vigencia es variable. El documento es vigente a la fecha que se emite, sin embargo, estará disponible en el servidor por un período de 30 días calendario desde su emisión',
        'Periodicidad: El trámite debe ser renovado a demanda',
        'Plazo máximo legal de respuesta: 20 días hábiles',
        'Tipo de solicitud: Trámite de obligación',
        'Tercero autorizado: Este trámite puede ser realizado por un tercero autorizado. El tercero autorizado requiere documentos para comprobar la representación'
      ],
      leyes: [
        ['Ley de Procedimientos Administrativos', 'Artículo 5 y 67, Artículo 64, numeral 2, Artículo 73 y Artículo 86, numeral 1'],
        ['Ley Penitenciaria', 'Artículo 21, numeral 1 y 9; artículo 135'],
        ['Reglamento General de la Ley Penitenciaria', 'Artículo 29, literal g; artículo 35, literal g'],
        ['Reglamento Interno del Órgano Ejecutivo', 'Artículo 35, numeral 1, 12 y 15']
      ]
    },
    titulo: 'Tu solicitud',
    subtitulo: 'Elige cómo quieres hacer tu trámite y cuéntanos para qué lo necesitas',
    campos: [
      { tipo: 'seccion', titulo: 'Datos de la constancia', si: EN_LINEA },
      { tipo: 'lista', nombre: 'tipo_de_tramite', etiqueta: 'Tipo de trámite', ayuda: 'Para qué usarás la constancia', opciones: [['administrativos', 'Administrativos'], ['empleo', 'De empleo'], ['estudio', 'De estudio'], ['migratorios', 'Migratorios'], ['defensa_nacional', 'Ministerio de la Defensa Nacional'], ['visita_centro_penitenciario', 'De visita a centro penitenciario'], ['seguridad_publica', 'Instituciones de seguridad pública']], media: true, si: EN_LINEA, media: true, si: EN_LINEA },
      { tipo: 'texto', nombre: 'lugar_de_presentacion', etiqueta: 'Lugar donde presentarás la constancia', ayuda: 'Empresa o institución que te la pide', min: 4, max: 255, prohibidos: LUGARES_GENERICOS, mensaje: 'Sé más específico: escribe el nombre de la empresa o institución donde entregarás la constancia', media: true, si: EN_LINEA, media: true, si: EN_LINEA },
      { tipo: 'lista', nombre: 'tipo_de_certificacion', etiqueta: 'Tipo de certificación', opciones: [['residente', 'Constancia personal de ciudadano residente en El Salvador']], si: EN_LINEA, si: EN_LINEA },
      { tipo: 'seccion', titulo: 'Cómo harás tu trámite' },
      { tipo: 'opciones', nombre: 'modalidad', etiqueta: 'Modalidad del trámite', marcado: 'en_linea', info: { lineas: ['La constancia de antecedentes penales debe generarse de manera personal y para uso de trámites particulares como empleo, estudio, registro de armas, etc'] }, opciones: [
        { valor: 'en_linea', texto: 'Realizar el trámite en línea', detalle: 'Requiere pago en línea', icono: 'ph-globe' },
        { valor: 'cita', texto: 'Programar una cita para el trámite presencial', detalle: 'No requiere pago en línea', icono: 'ph-calendar-check' }
      ] },
      { tipo: 'seccion', titulo: 'Apostilla', si: EN_LINEA },
      { tipo: 'opciones', nombre: 'apostilla', etiqueta: '¿Deseas enviarla a apostillar?', marcado: 'no', info: { titulo: 'Apostillado de documento', lineas: ['Es un certificado que autentica el origen de un documento público. La apostilla es un método simplificado de legalización de documentos para verificar la autenticidad de la firma, en el ámbito del derecho internacional privado, entre los países suscritos al Convenio del 5 de octubre de 1961 que suprime la exigencia de legalización de los documentos públicos extranjeros (Convención de La Haya sobre la Apostilla)'], si: EN_LINEA }, si: EN_LINEA, opciones: [
        { valor: 'si', texto: 'Sí, enviar', detalle: 'Para presentarla en otro país', icono: 'ph-globe-hemisphere-west' },
        { valor: 'no', texto: 'No enviar', icono: 'ph-x' }
      ] },
      { tipo: 'lista', nombre: 'pais_de_presentacion', etiqueta: 'País donde presentarás el documento', opciones: PAISES_APOSTILLA.map(p => [p, p]), si: 'apostilla=si' }
    ],
    pasos: [
      // Revisión en línea: tus datos (campos de solo lectura, desplegable abierto) y el resumen de lo elegido en el primer paso
      { ...REVISION, si: EN_LINEA, campos: [
        { tipo: 'desplegable', titulo: 'Tus datos', icono: 'ph-user-circle', abierto: true, comoFilas: true },
        { tipo: 'nota', estilo: 'info', lineas: ['La constancia de antecedentes penales será emitida de acuerdo al siguiente perfil del ciudadano'] },
        { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'fecha_de_nacimiento', etiqueta: 'Fecha de nacimiento', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'nombre_del_padre', etiqueta: 'Nombre del padre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'nombre_de_la_madre', etiqueta: 'Nombre de la madre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'telefono', etiqueta: 'Teléfono', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'correo_de_solicitante', etiqueta: 'Correo electrónico', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'genero', etiqueta: 'Género', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'estado_familiar', etiqueta: 'Estado familiar', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión u oficio', soloLectura: true },
        { tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-clipboard-text', abierto: true },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Revisa bien antes de confirmar', lineas: ['Al confirmar, los datos de tu solicitud ya no se podrán modificar'] },
        { tipo: 'nota', estilo: 'info', lineas: ['¿Necesitas ayuda? Escribe a atencion.antecedentes@seguridad.gob.sv en horarios hábiles'] }
      ] },
      { ...PAGO, si: EN_LINEA },
      { si: CITA, titulo: 'Tus datos', subtitulo: 'La constancia se emite con el perfil de tu cuenta', campos: [
        // El perfil de la cuenta (solo lectura) va en una card plegable; el teléfono y la dirección se escriben aquí abajo
        { tipo: 'desplegable', titulo: 'Tu perfil', icono: 'ph-user-circle', abierto: true, comoFilas: true },
        { tipo: 'nota', estilo: 'info', lineas: ['La constancia de antecedentes penales será emitida de acuerdo al siguiente perfil del ciudadano'] },
        { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'fecha_de_nacimiento', etiqueta: 'Fecha de nacimiento', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'genero', etiqueta: 'Género', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'estado_familiar', etiqueta: 'Estado familiar', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'correo_de_solicitante', etiqueta: 'Correo electrónico', soloLectura: true },
        { tipo: 'finDesplegable' },
        { tipo: 'texto', nombre: 'telefono_de_contacto', etiqueta: 'Teléfono', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234', media: true },
        { tipo: 'texto', nombre: 'direccion_de_residencia', etiqueta: 'Dirección de residencia', min: 5, max: 255, media: true }
      ] },
      { si: CITA, titulo: 'Tu cita', subtitulo: 'Elige la sede, el día y la hora en que llegarás', campos: [
        { tipo: 'opciones', nombre: 'sede_de_retiro', etiqueta: 'Sede a la que te acercarás', origen: 'sedes', dosColumnas: true },
        { tipo: 'opciones', nombre: 'fecha_de_retiro', etiqueta: 'Fecha de retiro', origen: 'dias', compacto: true, si: 'sede_de_retiro!=' },
        { tipo: 'opciones', nombre: 'hora_de_llegada', etiqueta: 'Hora de llegada', ayuda: 'Estos horarios están libres en la sede y el día que elegiste', origen: 'horas', compacto: true, si: 'fecha_de_retiro!=' },
        { tipo: 'opciones', nombre: 'cantidad_de_constancias', etiqueta: 'Cantidad de constancias', ayuda: 'Puedes pedir hasta 3', compacto: true, cantidad: true, opciones: [
          { valor: '1', texto: '1 constancia' }, { valor: '2', texto: '2 constancias' }, { valor: '3', texto: '3 constancias' }
        ] }
      ] },
      { ...REVISION, si: CITA, titulo: 'Revisa tu cita', subtitulo: 'Confirma que todo esté bien antes de agendarla', boton: 'Confirmar cita', fin: 'cita', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['No pagas en línea: el pago se hace en la sede el día de tu cita', '¿Necesitas ayuda? Escribe a atencion.antecedentes@seguridad.gob.sv en horarios hábiles'] }
      ] }
    ]
  };

  // PNC (pnc.ventanilla.simple.sv, trámite 51). Tras los datos de la Identidad Digital, el portal pide en un paso el país de
  // residencia, el domicilio, el teléfono, el rubro y dónde se presentará la constancia; al seguir valida los datos con la PNC
  // y pasa a la etapa de pago ($3.50). Comprobado el 2026-11-02 en borradores que ya existían, sin avanzar ninguno
  F[100] = {
    informacion: {
      requisitos: { lista: ['Documento Único de Identidad en Original: Presentar el Documento Único de Identidad en buen estado y vigente'] },
      detalles: [
        'Vigencia: Esta institución no es responsable de la vigencia que la institución requirente otorgue al presente trámite',
        'Periodicidad: El trámite debe ser renovado a demanda',
        'Plazo máximo legal de respuesta: 5 días hábiles',
        'Tipo de solicitud: Trámite de obligación',
        'Número de soporte al usuario: 5000-0253 / 5000-4232. Atención únicamente por mensajes de texto en WhatsApp para soporte del trámite de Constancia de Antecedentes Policiales. No se reciben llamadas',
        'Tipo de trámite: Persona Natural'
      ],
      leyes: [
        ['Acuerdo Ejecutivo en el ramo de Hacienda, número 992, de fecha 28 de septiembre de 2011, que contiene autorización de precios para la venta de productos y servicios de la Policía Nacional Civil, publicado en Diario Oficial Número 184, Tomo 393, de fecha 4 de octubre del 2011', 'Numeral 11'],
        ['Constitución de la República de El Salvador', 'Artículo 86, párrafo/inciso 1; artículo 159'],
        ['Disposiciones Generales de Presupuestos', 'Artículo 153, numeral 3'],
        ['Ley de Procedimientos Administrativos', 'Artículo 18, Artículo 24, Artículo 26, Artículo 64, numeral 2, Artículo 73, Artículo 74, Artículo 86, numeral 1'],
        ['Ley Orgánica de la Policía Nacional Civil', 'Artículo 4, numeral 16; artículo 4, numeral 17; artículo 9, literal e'],
        ['Reglamento de la Ley Orgánica de la Policía Nacional Civil', 'Artículo 23, literal a'],
        ['Reglamento Interno del Órgano Ejecutivo', 'Artículo 35, numeral 7; artículo 35, numeral 15']
      ]
    },
    titulo: 'Datos del solicitante',
    subtitulo: 'Revisa los datos que se usarán en tu trámite',
    campos: [
      { tipo: 'desplegable', titulo: 'Tus datos', icono: 'ph-user-circle', abierto: true, comoFilas: true },
      { tipo: 'nota', estilo: 'info', lineas: ['Usaremos los datos de tu Identidad Digital para este trámite'] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento', soloLectura: true },
      { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true },
      { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true }
    ],
    pasos: [
      { titulo: 'Datos de la solicitud', subtitulo: 'Dinos dónde vives y para qué necesitas la constancia', campos: [
        { tipo: 'seccion', titulo: 'Domicilio y contacto' },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true },
        { tipo: 'opciones', nombre: 'pais', etiqueta: 'País de residencia', opciones: [
          { valor: 'sv', texto: 'El Salvador', icono: 'ph-house-line' },
          { valor: 'extranjero', texto: 'En el extranjero', icono: 'ph-globe-hemisphere-west' }
        ] },
        { tipo: 'lista', nombre: 'departamento_residencia', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true, si: 'pais=sv' },
        { tipo: 'lista', nombre: 'municipio_residencia', etiqueta: 'Municipio', depende: 'departamento_residencia', opcionesPor: MUNICIPIOS, media: true, si: 'pais=sv' },
        { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección', ayuda: 'Calle, avenida, pasaje y número de casa' },
        { tipo: 'texto', nombre: 'telefono', etiqueta: 'Número de teléfono', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234' },
        { tipo: 'seccion', titulo: 'Detalles de la solicitud' },
        { tipo: 'lista', nombre: 'rubro', etiqueta: 'Rubro para el que pides la constancia', opciones: [['001', 'Empleo'], ['006', 'Estudio'], ['002', 'Migración'], ['004', 'Transporte'], ['005', 'Seguridad privada'], ['003', 'ANSP/PNC'], ['007', 'Arma'], ['009', 'Centros penales'], ['012', 'Fuerza Armada'], ['008', 'Otros']] },
        { tipo: 'texto', nombre: 'presentar_en', etiqueta: 'Empresa o institución donde la presentarás', ayuda: 'Escribe su nombre exacto. No uses frases generales como "a quien interese", "no sé", "mi trabajo" o "varias partes"', prohibidos: [...LUGARES_GENERICOS, 'NO SE', 'MI TRABAJO', 'VARIAS PARTES'], mensaje: 'Sé más específico: escribe el nombre de la empresa o institución donde entregarás la constancia' }
      ] },
      { ...REVISION, campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Al confirmar, la PNC valida tus datos. Si no te deja seguir, espera unos minutos y vuelve a intentarlo'] }
      ] },
      { ...PAGO, monto: '$3.50', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $3.50 con tarjeta de crédito o débito en la pasarela segura de SERFINSA. Te enviaremos una copia del comprobante a tu correo', 'Si tu solicitud no tiene observaciones, después de pagar descargas tu constancia. Si las tiene, pasa a revisión y verás el resultado en los próximos 5 días hábiles'] },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Termina el pago por completo para que tu trámite aparezca en Mis documentos', 'Si algo falla, no inicies otro trámite ni vuelvas a pagar: escribe a contacto@simple.sv con tu nombre y tu número de DUI'] }
      ] }
    ]
  };

  /* ===== DUI y partidas ===== */
  // RNPN (rnpn.ventanilla.simple.sv, trámite 93). Después de la nota, el portal pide el tipo de partida y un teléfono, los datos
  // de la persona inscrita (cambian con el tipo), "Completar datos" (dónde está inscrita y los nombres de los padres o de la
  // segunda persona, solo los que se sepan) y dónde se usará el documento. Allá la solicitud va primero a revisión y el pago llega
  // después, con la partida encontrada; aquí se paga al final, como en el resto del nuevo diseño: $5.00, la certificación de
  // partida de El Salvador.
  const EN_PAREJA = 'tipo_partida=matrimonio|divorcio|union_no_matrimonial|regimen_patrimonial';
  // La persona inscrita suele ser quien inició sesión (su nacimiento, su matrimonio…): su DUI y su nombre ya vienen
  // escritos (ciudadano.js) y se pueden corregir. En la de defunción, no. La fecha, solo en la de nacimiento (es la suya).
  const ES_QUIEN_INICIA = 'tipo_partida!=defuncion';
  const FECHA_DE = { nacimiento: 'nacimiento', defuncion: 'defunción', matrimonio: 'matrimonio', divorcio: 'divorcio', union_no_matrimonial: 'unión no matrimonial', regimen_patrimonial: 'régimen patrimonial' };
  F[73] = {
    ...rnpn({
    costo: ['Este trámite que estás a punto de iniciar puede generar un costo variable según el documento solicitado; asegúrate de tener una tarjeta de crédito o débito para realizar el pago', 'El valor generado únicamente constituye un arancel por la prestación del servicio, por lo que no existe devolución del mismo'],
    terminosTitulo: '¡Nota importante!',
    terminos: ['Para realizar el trámite, ten en cuenta los siguientes términos:', '- El trámite solicitado consiste en la búsqueda y validación de la información proporcionada. Una vez ingresado y procesado, no será posible la devolución del costo del servicio, independientemente del resultado', '- Si la información ingresada es incorrecta o inexacta, el documento será desfavorable y no procede la devolución', '- Eres responsable del uso de tarjetas de crédito o débito para el pago del trámite', '- La emisión del documento se basará en la información que haya sido registrada por la alcaldía municipal', '- Eres responsable de la información que ingresas en la etapa de identificación del trámite', '- El plazo de respuesta es de 24 horas hábiles para el servicio de certificación de partidas'],
    aceptaEtiqueta: '¿Aceptas los términos antes mencionados?'
    }),
    preguntaNombre: '¿La partida es a tu nombre?',
    pasos: [
      { titulo: 'Tipo de partida', subtitulo: 'Elige la partida que necesitas', campos: [
        { tipo: 'opciones', nombre: 'tipo_partida', etiqueta: 'Tipo de partida a solicitar', opciones: [
          { valor: 'nacimiento', texto: 'Nacimiento', icono: 'ph-baby' },
          { valor: 'defuncion', texto: 'Defunción', icono: 'ph-flower-lotus' },
          { valor: 'matrimonio', texto: 'Matrimonio', icono: 'ph-heart' },
          { valor: 'divorcio', texto: 'Divorcio', icono: 'ph-heart-break' },
          { valor: 'union_no_matrimonial', texto: 'Unión no matrimonial', icono: 'ph-users' },
          { valor: 'regimen_patrimonial', texto: 'Régimen patrimonial', icono: 'ph-scales' }
        ] },
        { tipo: 'texto', nombre: 'telefono_de_contacto', etiqueta: 'Teléfono de contacto', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234' }
      ] },
      { titulo: 'Datos de la partida', subtitulo: 'Escríbelos como aparecen en la partida', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe los datos de la persona inscrita'], si: 'tipo_partida=nacimiento' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe los datos de la persona fallecida'], si: 'tipo_partida=defuncion' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe los datos de al menos uno de los cónyuges'], si: 'tipo_partida=matrimonio|regimen_patrimonial' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe los datos de al menos uno de los excónyuges'], si: 'tipo_partida=divorcio' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe los datos de al menos uno de los convivientes'], si: 'tipo_partida=union_no_matrimonial' },
        { tipo: 'texto', nombre: 'dui_inscrito', etiqueta: 'DUI', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0', opcional: true, si: 'tipo_partida=nacimiento|defuncion', prellenarSi: ES_QUIEN_INICIA },
        { tipo: 'opciones', nombre: 'genero_primera_persona', etiqueta: 'Primera persona inscrita', si: EN_PAREJA, opciones: [
          { valor: 'f', texto: 'Femenino', icono: 'ph-gender-female' },
          { valor: 'm', texto: 'Masculino', icono: 'ph-gender-male' }
        ] },
        ...nombrePorPartes('', { obligatorio: true, casada: 'tipo_partida=defuncion|divorcio|union_no_matrimonial|regimen_patrimonial', prellenarSi: ES_QUIEN_INICIA }),
        ...Object.entries(FECHA_DE).map(([tipo, texto]) => ({ tipo: 'seccion', titulo: `Fecha de ${texto}`, si: `tipo_partida=${tipo}` })),
        { tipo: 'texto', nombre: 'dia_partida', etiqueta: 'Día', placeholder: 'DD', max: 2, modo: 'numeric', patron: '0?[1-9]|[12][0-9]|3[01]', mensaje: 'Escribe un día del 1 al 31', opcional: true, tercio: true, prellenarSi: 'tipo_partida=nacimiento' },
        { tipo: 'texto', nombre: 'mes_partida', etiqueta: 'Mes', placeholder: 'MM', max: 2, modo: 'numeric', patron: '0?[1-9]|1[0-2]', mensaje: 'Escribe un mes del 1 al 12', opcional: true, tercio: true, prellenarSi: 'tipo_partida=nacimiento' },
        { tipo: 'texto', nombre: 'anio_partida', etiqueta: 'Año', placeholder: 'AAAA', max: 4, modo: 'numeric', patron: '(18|19|20)[0-9]{2}', mensaje: 'Escribe el año con 4 cifras, por ejemplo 1990', tercio: true, prellenarSi: 'tipo_partida=nacimiento' }
      ] },
      { titulo: 'Datos para la búsqueda', subtitulo: 'Ayudan al RNPN a encontrar la partida', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe solo los datos de los que estés seguro. Si tienes dudas, déjalos en blanco'] },
        { tipo: 'seccion', titulo: 'Lugar donde está inscrita la partida' },
        { tipo: 'lista', nombre: 'departamento_partida', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, opcional: true, media: true },
        { tipo: 'lista', nombre: 'municipio_partida', etiqueta: 'Municipio', depende: 'departamento_partida', opcionesPor: MUNICIPIOS, opcional: true, media: true },
        { tipo: 'seccion', titulo: 'Nombre de la madre', si: 'tipo_partida=nacimiento' },
        ...nombrePorPartes('madre_', { casada: true, si: 'tipo_partida=nacimiento' }),
        { tipo: 'seccion', titulo: 'Nombre del padre', si: 'tipo_partida=nacimiento' },
        ...nombrePorPartes('padre_', { si: 'tipo_partida=nacimiento' }),
        { tipo: 'seccion', titulo: 'Segunda persona inscrita', si: EN_PAREJA },
        ...nombrePorPartes('segunda_', { si: EN_PAREJA })
      ] },
      { titulo: 'Uso del documento', subtitulo: 'Cuéntanos dónde vas a presentar la certificación', campos: [
        { tipo: 'opciones', nombre: 'ambito_documento', etiqueta: 'Ámbito de uso del documento', opciones: [
          { valor: 'nacional', texto: 'Uso del documento en El Salvador', icono: 'ph-map-pin' },
          { valor: 'exterior', texto: 'Uso del documento en el exterior', detalle: 'Se puede apostillar', icono: 'ph-globe-hemisphere-west' }
        ] },
        { tipo: 'nota', estilo: 'aviso', titulo: '¡Nota importante!', lineas: ['No podrá ser apostillado para usarlo en el exterior. Si deseas apostillar el documento, elige «Uso del documento en el exterior»'], si: 'ambito_documento=nacional' }
      ] },
      { ...REVISION, campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Revisa bien antes de confirmar', lineas: ['El RNPN busca la partida con los datos que escribiste. Si son incorrectos o inexactos, el documento será desfavorable y no hay devolución'] }
      ] },
      { ...PAGO, monto: '$5.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $5.00, el arancel de la certificación de partida, con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'El pago es por el servicio: no tiene devolución, sea cual sea el resultado de la búsqueda'] }
      ] }
    ]
  };

  // RNPN (rnpn.ventanilla.simple.sv, trámite 88). Después de la nota, el portal pide de quién es la certificación (ya vienen el
  // DUI y el nombre de quien inició sesión, que se cambian si es para otra persona), un teléfono y que se confirmen los datos.
  // No se pasó de ahí: ese "Siguiente" cierra la etapa y probablemente envía la solicitud al RNPN, que busca el registro
  // (1 hora hábil) y certifica el DUI o que no hay DUI. Aquí la confirmación es la revisión y se paga al final: $5.00.
  F[74] = {
    ...rnpn({
    costo: ['Este trámite que estás a punto de iniciar genera un costo de hasta $5.00 por el servicio brindado; asegúrate de tener una tarjeta de crédito o débito para realizar el pago', 'Este valor únicamente constituye un arancel por la prestación del servicio, sin que esto signifique la emisión de un documento favorable. En caso de que el resultado no sea favorable, no hay devolución'],
    terminosTitulo: 'Aceptación de términos',
    terminos: ['Para realizar el trámite, estoy consciente y tengo en cuenta los siguientes términos:', '- La información que ingreso en la etapa de identificación del trámite es mi responsabilidad', '- El trámite solicitado consiste en la búsqueda y validación de la información proporcionada. Una vez ingresado y procesado, no será posible la devolución del costo del servicio independientemente del resultado', '- Si la información es incorrecta o inexacta, el documento será desfavorable y no procederá la devolución', '- Es mi responsabilidad el uso de tarjetas de crédito o débito para el pago del trámite', 'Asimismo declaro bajo juramento: I) Que conozco los términos y requisitos previos establecidos y en caso de estar mintiendo en la información declarada o entregando documentos alterados o falsificados, estaré incurriendo en el delito de estafa informática establecido en el artículo 10 de la Ley Especial contra los Delitos Informáticos y Conexos'],
    aceptaEtiqueta: 'He leído y acepto los términos legales'
    }),
    pasos: [
      { titulo: 'Datos de la persona', subtitulo: 'Escríbelos como están registrados en el RNPN', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Ya escribimos tus datos. Si la certificación es para otra persona, cambia el nombre y el número de DUI, si lo tiene'] },
        { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Número de DUI', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0', opcional: true },
        ...nombrePorPartes('', { obligatorio: true, casada: true }),
        { tipo: 'texto', nombre: 'telefono_de_contacto', etiqueta: 'Teléfono de contacto', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234' }
      ] },
      { ...REVISION, campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Revisa bien antes de confirmar', lineas: ['El RNPN busca el registro con los datos que escribiste. Si son incorrectos o inexactos, el documento será desfavorable y no hay devolución'] }
      ] },
      { ...PAGO, monto: '$5.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $5.00, el arancel de la certificación, con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'El pago es por el servicio: no tiene devolución, sea cual sea el resultado de la búsqueda'] }
      ] }
    ]
  };

  // RNPN (rnpn.ventanilla.simple.sv, trámite 89). La nota cierra la primera etapa; en la siguiente, el portal pide solo el DUI
  // a verificar (allá viene vacío; aquí, con el de quien inició sesión) y que se confirme. No se pasó de ahí: ese "Siguiente"
  // probablemente envía la solicitud al RNPN, que busca si hay más de un registro con el mismo nombre (1 hora hábil). Aquí la
  // confirmación es la revisión y se paga al final: $10.00.
  F[75] = {
    ...rnpn({
    costo: ['Este trámite que estás a punto de iniciar genera un costo de $10.00 por el servicio brindado; asegúrate de tener una tarjeta de crédito o débito para realizar el pago', 'Este valor únicamente constituye un arancel por la prestación del servicio, por lo que no existe devolución del mismo'],
    terminosTitulo: '¡Nota importante!',
    terminos: ['Para realizar el trámite, ten en cuenta los siguientes términos:', '- El trámite solicitado consiste en la búsqueda y validación de la información proporcionada. Una vez ingresado y procesado, no será posible la devolución del costo del servicio, independientemente del resultado', '- Si la información ingresada es incorrecta o inexacta, el documento será desfavorable y no procede la devolución', '- Eres responsable del uso de tarjetas de crédito o débito para el pago del trámite', '- Eres responsable de la información que ingresas en la etapa de identificación del trámite'],
    aceptaEtiqueta: '¿Aceptas los términos antes mencionados?'
    }),
    pasos: [
      { titulo: 'DUI a verificar', subtitulo: 'El RNPN busca si hay otras personas registradas con el mismo nombre', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Ya escribimos tu DUI. Si la constancia es para otra persona, escribe su número de DUI'] },
        { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Número de DUI', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0' }
      ] },
      { ...REVISION, campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Revisa bien antes de confirmar', lineas: ['El RNPN busca con el DUI que escribiste. Si es incorrecto, el documento será desfavorable y no hay devolución'] }
      ] },
      { ...PAGO, monto: '$10.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $10.00, el arancel de la constancia, con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'El pago es por el servicio: no tiene devolución, sea cual sea el resultado de la búsqueda'] }
      ] }
    ]
  };

  // Migración y Extranjería (migracionyextranjeria.ventanilla.simple.sv, trámite 382). Tras la personería, el portal pide un
  // paso de datos que cambia con el tipo de trámite: a la persona natural le trae sus datos del registro del DUI (solo
  // lectura) y le pide teléfono y lugar de nacimiento; en las de NNA y las de representante legal vienen el nombre y el DUI de
  // quien hace el trámite y se escriben los del menor o los de la persona representada. La de representante legal - nacional no
  // se vio (pide el DUI de otra persona; con el propio, el portal no deja seguir), así que solo lleva los datos del
  // representante. No se pasó del paso de datos. El lugar de nacimiento en El Salvador va por departamento y distrito: el
  // portal pone en medio el municipio de 2024, y sus distritos son los 262 municipios de antes (MUNICIPIOS).
  // Se paga al final: $10.00 los nacionales y $11.00 los extranjeros (Art. 325 de la LEME).
  const PAISES = PAISES_APOSTILLA.filter(p => !['El Salvador', 'Unión Europea'].includes(p));
  const NOMBRE_O_NA = "[Nn]/[Aa]|" + SOLO_LETRAS;
  const FECHA_DMA = { placeholder: 'DD-MM-AAAA', max: 10, patron: '(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-(19|20)[0-9]{2}', mensaje: 'Escribe la fecha como DD-MM-AAAA, por ejemplo 05-03-1990' };
  const EDAD_MENOR = { modo: 'numeric', max: 2, patron: '1[0-7]|[0-9]', mensaje: 'Escribe la edad del menor, de 0 a 17 años' };
  const GENERO_MENOR = [{ valor: 'nino', texto: 'Niño', icono: 'ph-gender-male' }, { valor: 'nina', texto: 'Niña', icono: 'ph-gender-female' }];
  const PADRES_NA = { tipo: 'nota', estilo: 'info', lineas: ['Si falta alguno de los padres, escribe N/A'] };
  const TELEFONO = { tipo: 'texto', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234' };
  F[113] = {
    titulo: 'Selección de personería',
    subtitulo: 'Indica en qué calidad haces el trámite',
    campos: [
      { tipo: 'opciones', nombre: 'nacionalidad', etiqueta: 'Calidad en la que actúas', opciones: [
        { valor: 'salvadorena', texto: 'Salvadoreño(a)', icono: 'ph-user' },
        { valor: 'rep_legal', texto: 'Representante legal', icono: 'ph-briefcase' }
      ] },
      { tipo: 'opciones', nombre: 'tipo_tramite_rl', etiqueta: 'Tipo de trámite', si: 'nacionalidad=rep_legal', opciones: [
        { valor: 'delegado_nacional', texto: 'Constancia de no restricción representante legal - nacional', icono: 'ph-identification-card' },
        { valor: 'delegado_extranjero', texto: 'Constancia de no restricción representante legal - extranjero', icono: 'ph-globe-hemisphere-west' },
        { valor: 'constancia_nna_extranjero', texto: 'Constancia de no restricción NNA extranjero', detalle: 'Niñas, niños y adolescentes', icono: 'ph-baby' }
      ] },
      { tipo: 'texto', nombre: 'dui_pe_rln', etiqueta: 'DUI del solicitante', ayuda: 'El de la persona que representas; no puede ser el tuyo', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0', si: 'tipo_tramite_rl=delegado_nacional' },
      { tipo: 'opciones', nombre: 'tipo_de_tramiten', etiqueta: 'Tipo de trámite', si: 'nacionalidad=salvadorena', opciones: [
        { valor: 'constancia_natural_nacional', texto: 'Constancia de no restricción persona natural', icono: 'ph-user' },
        { valor: 'constancia_nna_nacional', texto: 'Constancia de no restricción NNA', detalle: 'Niñas, niños y adolescentes', icono: 'ph-baby' }
      ] }
    ],
    pasos: [
      { si: 'tipo_de_tramiten=constancia_natural_nacional', titulo: 'Tus datos', subtitulo: 'Revisa tus datos y completa los que faltan', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Estos datos vienen del registro de tu DUI y no se pueden cambiar aquí'] },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante', soloLectura: true },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'fecha_de_vencimiento_del_dui', etiqueta: 'Fecha de vencimiento del DUI', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'fecha_de_nacimiento', etiqueta: 'Fecha de nacimiento', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'edad', etiqueta: 'Edad', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'estado_familiar', etiqueta: 'Estado civil', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'nombre_de_la_madre', etiqueta: 'Nombre de la madre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'nombre_del_padre', etiqueta: 'Nombre del padre', soloLectura: true, media: true },
        { ...TELEFONO, nombre: 'telefono_de_contacto', etiqueta: 'Número de teléfono' },
        { tipo: 'opciones', nombre: 'pais_nacimiento', etiqueta: 'País de nacimiento', opciones: [
          { valor: 'el_salvador', texto: 'El Salvador', icono: 'ph-map-pin' },
          { valor: 'otro', texto: 'Otro', icono: 'ph-globe-hemisphere-west' }
        ] },
        { tipo: 'lista', nombre: 'departamento_nacimiento', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true, si: 'pais_nacimiento=el_salvador' },
        { tipo: 'lista', nombre: 'distrito_nacimiento', etiqueta: 'Distrito', depende: 'departamento_nacimiento', opcionesPor: MUNICIPIOS, media: true, si: 'pais_nacimiento=el_salvador' },
        { tipo: 'texto', nombre: 'otro_pais_nacimiento', etiqueta: 'País', sugerencias: PAISES, si: 'pais_nacimiento=otro' },
        { tipo: 'texto', nombre: 'otro_departamento_nacimiento', etiqueta: 'Departamento de nacimiento', media: true, si: 'pais_nacimiento=otro' },
        { tipo: 'texto', nombre: 'otro_municipio_nacimiento', etiqueta: 'Municipio de nacimiento', media: true, si: 'pais_nacimiento=otro' }
      ] },
      { si: 'tipo_de_tramiten=constancia_nna_nacional', titulo: 'Datos del menor', subtitulo: 'Cuéntanos quién lo tiene a cargo y los datos del menor', campos: [
        { tipo: 'seccion', titulo: 'Persona encargada del menor' },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, media: true },
        { tipo: 'lista', nombre: 'parentesco_menor', etiqueta: 'Parentesco con el menor', opciones: [['madre', 'Madre'], ['padre', 'Padre'], ['tioa', 'Tío(a)'], ['hermanoa', 'Hermano(a)'], ['abueloa', 'Abuelo(a)'], ['otro', 'Otro']], media: true },
        { tipo: 'texto', nombre: 'parentesco_menor_otro', etiqueta: 'Especifica el parentesco', media: true, si: 'parentesco_menor=otro' },
        { tipo: 'seccion', titulo: 'Menor de edad' },
        { tipo: 'texto', nombre: 'nombre_menor', etiqueta: 'Nombre', patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'texto', nombre: 'edad_menor', etiqueta: 'Edad', ...EDAD_MENOR, media: true },
        { tipo: 'texto', nombre: 'pasaporte_menor', etiqueta: 'Número de pasaporte', media: true },
        { tipo: 'opciones', nombre: 'genero_menor', etiqueta: 'Género', opciones: GENERO_MENOR },
        { tipo: 'lista', nombre: 'departamento_nacimiento_menor', etiqueta: 'Departamento de nacimiento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'distrito_nacimiento_menor', etiqueta: 'Distrito de nacimiento', depende: 'departamento_nacimiento_menor', opcionesPor: MUNICIPIOS, media: true },
        PADRES_NA,
        { tipo: 'texto', nombre: 'madre_menor', etiqueta: 'Nombre de la madre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true },
        { tipo: 'texto', nombre: 'padre_menor', etiqueta: 'Nombre del padre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true }
      ] },
      { si: 'nacionalidad=rep_legal', titulo: 'Datos del representante', subtitulo: 'Tus datos como representante legal', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Documento Único de Identidad', soloLectura: true, media: true },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', si: 'tipo_tramite_rl!=constancia_nna_extranjero' }
      ] },
      { si: 'tipo_tramite_rl=delegado_extranjero', titulo: 'Persona representada', subtitulo: 'Escribe los datos de la persona extranjera que representas', campos: [
        { tipo: 'texto', nombre: 'nombre_representado', etiqueta: 'Nombre', patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'lista', nombre: 'estado_civil_representado', etiqueta: 'Estado civil', opciones: [['soltero', 'Soltero(a)'], ['casado', 'Casado(a)'], ['divorciado', 'Divorciado(a)'], ['viudo', 'Viudo(a)']], media: true },
        { tipo: 'texto', nombre: 'profesion_representado', etiqueta: 'Profesión u oficio', media: true },
        { tipo: 'texto', nombre: 'fecha_nacimiento_representado', etiqueta: 'Fecha de nacimiento', ...FECHA_DMA, media: true },
        { tipo: 'texto', nombre: 'pais_nacimiento_representado', etiqueta: 'País de nacimiento', sugerencias: PAISES, media: true },
        { tipo: 'texto', nombre: 'lugar_nacimiento_representado', etiqueta: 'Lugar de nacimiento' },
        { tipo: 'opciones', nombre: 'documento_representado', etiqueta: 'Documento de identidad', opciones: [
          { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
          { valor: 'carnet_de_residencia', texto: 'Carnet de residencia', icono: 'ph-identification-badge' }
        ] },
        { tipo: 'texto', nombre: 'pasaporte_representado', etiqueta: 'Número de pasaporte', media: true, si: 'documento_representado=pasaporte' },
        { tipo: 'texto', nombre: 'carnet_representado', etiqueta: 'Número de carnet de residencia', media: true, si: 'documento_representado=carnet_de_residencia' },
        { tipo: 'texto', nombre: 'vencimiento_documento_representado', etiqueta: 'Fecha de vencimiento', ...FECHA_DMA, media: true },
        PADRES_NA,
        { tipo: 'texto', nombre: 'madre_representado', etiqueta: 'Nombre de la madre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true },
        { tipo: 'texto', nombre: 'padre_representado', etiqueta: 'Nombre del padre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true }
      ] },
      { si: 'tipo_tramite_rl=constancia_nna_extranjero', titulo: 'Datos del menor', subtitulo: 'Escribe los datos del menor extranjero que representas', campos: [
        { tipo: 'texto', nombre: 'nombre_menor_ext', etiqueta: 'Nombre', patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'texto', nombre: 'edad_menor_ext', etiqueta: 'Edad', ...EDAD_MENOR, media: true },
        { tipo: 'texto', nombre: 'pasaporte_menor_ext', etiqueta: 'Número de pasaporte', media: true },
        { tipo: 'opciones', nombre: 'genero_menor_ext', etiqueta: 'Género', opciones: GENERO_MENOR },
        { tipo: 'texto', nombre: 'pais_nacimiento_menor_ext', etiqueta: 'País de nacimiento', sugerencias: PAISES, media: true },
        { tipo: 'texto', nombre: 'lugar_nacimiento_menor_ext', etiqueta: 'Lugar de nacimiento', media: true },
        PADRES_NA,
        { tipo: 'texto', nombre: 'madre_menor_ext', etiqueta: 'Nombre de la madre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true },
        { tipo: 'texto', nombre: 'padre_menor_ext', etiqueta: 'Nombre del padre', patron: NOMBRE_O_NA, mensaje: 'Usa solo letras, o N/A', media: true }
      ] },
      { ...REVISION, campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Migración entrega la constancia a partir del cuarto día hábil, contado un día después de solicitada'] }
      ] },
      { ...PAGO, monto: [['tipo_tramite_rl=delegado_extranjero|constancia_nna_extranjero', '$11.00'], ['nacionalidad=salvadorena|rep_legal', '$10.00']], campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas la tasa de la constancia (Art. 325 de la LEME): $10.00 los nacionales y $11.00 los extranjeros, con tarjeta de crédito o débito en la pasarela segura de SERFINSA'] }
      ] }
    ]
  };

  /* ===== Agua y hogar ===== */
  // ANDA: si se quiere la factura o el CCF en físico, se retira en una agencia (el comprobante de pago llega escaneado).
  // s: sufijo de los nombres, para cuando el bloque va en dos pasos del mismo trámite (persona natural y jurídica)
  const facturaAnda = (s = '') => [
    { tipo: 'opciones', nombre: `necesita_factura${s}`, etiqueta: '¿Necesitas factura de consumidor final o comprobante de crédito fiscal?', columna: true, opciones: [
      { valor: 'factura', texto: 'Factura consumidor final', icono: 'ph-receipt' },
      { valor: 'ccf', texto: 'Comprobante de crédito fiscal', icono: 'ph-file-text' },
      { valor: 'no_necesito', texto: 'No necesito ningún documento en físico', icono: 'ph-prohibit' }
    ] },
    { tipo: 'lista', nombre: `escoja_sucursal${s}`, etiqueta: 'Escoge la sucursal para retirar el documento físico', ayuda: 'Lo retiras de 3 a 5 días hábiles después de recibir la resolución', si: `necesita_factura${s}!=no_necesito`, opciones: [
      ['AHUACHAPAN', 'Ahuachapán - 3ª Calle Oriente y 1ª Avenida Sur'], ['APOPA', 'Apopa - Centro Comercial Plaza Mundo Apopa'], ['CENTRO', 'Centro - Calle Rubén Darío, entre 11 y 13 Avenida Sur'],
      ['COJUTEPEQUE', 'Cojutepeque - Final Av. Raúl Contreras'], ['GALERIAS ESCALON', 'Galerías Escalón - Centro Comercial Galerías Escalón'], ['LA UNION', 'La Unión - Avenida General Cabañas, Centro de Gobierno'],
      ['LAS CASCADAS', 'Las Cascadas - Centro Comercial Las Cascadas, local 201'], ['METROSUR', 'Metrosur - Centro Comercial Metrosur, locales C-11 a C-13'], ['QUEZALTEPEQUE', 'Quezaltepeque - 9ª Calle Oriente, costado sur de Parque Morán'],
      ['SAN MIGUEL', 'San Miguel - 8ª Avenida Sur y 15 Calle Oriente, Centro de Gobierno'], ['SAN VICENTE', 'San Vicente - 3ª Calle Poniente #1, barrio El Calvario'], ['SANTA ANA 25', 'Santa Ana 25 - 10ª Avenida Sur y 23ª Calle Poniente'],
      ['SANTA TECLA', 'Santa Tecla - Calle Daniel Hernández, Plaza Concepción'], ['SENSUNTEPEQUE', 'Sensuntepeque - Centro de Gobierno, 5ª Avenida Sur'], ['SONSONATE', 'Sonsonate - Avenida Claudia Lars y 5ª Calle Poniente'],
      ['SOYAPANGO', 'Soyapango - Centro Comercial Plaza Mundo, local 87'], ['UNIVERSITARIA', 'Universitaria - Centro Urbano Libertad, Avenida Don Bosco'], ['USULUTAN', 'Usulután - 4ª Avenida Norte, costado poniente de 6ª Brigada'],
      ['ZACATECOLUCA', 'Zacatecoluca - Centro Comercial San Antonio, Carretera Litoral']
    ] },
    { tipo: 'texto', nombre: `nrc${s}`, etiqueta: 'Número de Registro de Contribuyentes (NRC)', si: `necesita_factura${s}=ccf` },
    { tipo: 'archivo', nombre: `nrc_imagen${s}`, etiqueta: 'Adjuntar imagen de NRC', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: `necesita_factura${s}=ccf` }
  ];
  // ANDA: tras pagar en línea, la solicitud pasa de inmediato a revisión (en el portal, la etapa de pago da 10 minutos)
  const REVISION_ANDA = { ...REVISION, campos: [
    { tipo: 'nota', estilo: 'info', lineas: ['Después de pagar en línea, tu solicitud pasa de inmediato a revisión de ANDA'] }
  ] };
  // Lo que el portal avisa en su "Nota aclaratoria", al entrar a la etapa de pago
  const AVISO_PAGO_ANDA = { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Termina el pago por completo para que tu trámite aparezca en Mis documentos', 'Si algo falla, no inicies otro trámite ni vuelvas a pagar: escribe a contacto@simple.sv con tu nombre y tu número de DUI'] };

  // ANDA (anda.ventanilla.simple.sv, trámite 17): cambio de nombre y factibilidad para una vivienda. Tras el servicio, el portal
  // pide los datos de quien solicita (en el cambio de nombre, los del nuevo responsable) con sus documentos y la certificación
  // del CNR; la factibilidad pide además la dirección y los documentos del inmueble, y termina con una declaración jurada
  // y luego llega la etapa de pago, la misma "Nota aclaratoria" en los dos (comprobado el 2026-11-02). La ubicación en el mapa del
  // portal no se copió (allí es obligatoria: sin el punto marcado no deja seguir).
  const archivo = (nombre, etiqueta, extra = {}) => ({ tipo: 'archivo', nombre, etiqueta, ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, ...extra });
  const SOLO_PDF = { ayuda: 'Formato permitido: PDF', acepta: '.pdf' };
  const PASOS_ANDA_SERVICIOS = [
    { si: 'tipo_persona=persona_natural', titulo: 'Datos del solicitante', subtitulo: 'Revisa tus datos y adjunta tus documentos', campos: [
      ...nombrePorPartes('', { obligatorio: true, casada: true }),
      archivo('imagen_documento', 'Adjuntar imagen de documento'),
      { tipo: 'texto', nombre: 'n_nit', etiqueta: 'Número de identificación tributaria (NIT)', modo: 'numeric', opcional: true, si: 'tipo_de_documento!=dui' },
      archivo('imagen_nit', 'Adjuntar imagen de NIT', { opcional: true, si: 'tipo_de_documento!=dui' }),
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono celular', media: true },
      { ...TELEFONO, nombre: 'telefono_fijo', etiqueta: 'Teléfono fijo', opcional: true, media: true },
      archivo('documento_legal', 'Documento legal que demuestre la disponibilidad del inmueble', { si: 'servicio_a_solicitar=cambio_nombre' }),
      ...facturaAnda(),
      archivo('constancia_cnr', 'Razón y constancia o certificación extractada del CNR', SOLO_PDF)
    ] },
    { si: 'tipo_persona=persona_juridica', titulo: 'Datos de la empresa', subtitulo: 'Escribe los datos de la sociedad y adjunta sus documentos', campos: [
      { tipo: 'texto', nombre: 'n_nit_juri', etiqueta: 'Número de identificación tributaria (NIT)', modo: 'numeric', media: true },
      { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón o denominación social', media: true },
      archivo('imagen_nit_juri', 'Adjuntar imagen de NIT'),
      archivo('escritura_constitucion', 'Adjuntar escritura de constitución de sociedad'),
      archivo('credencial_representante', 'Adjuntar credencial de representante legal o administrador único (vigente)'),
      { tipo: 'texto', nombre: 'correo_empresa', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo_empresa', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_empresa', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
      { ...TELEFONO, nombre: 'telefono_empresa', etiqueta: 'Teléfono celular', media: true },
      { ...TELEFONO, nombre: 'telefono_fijo_empresa', etiqueta: 'Teléfono fijo', opcional: true, media: true },
      archivo('documento_legal_empresa', 'Documento legal que demuestre la disponibilidad del inmueble', { si: 'servicio_a_solicitar=cambio_nombre' }),
      ...facturaAnda('_jur'),
      archivo('constancia_cnr_empresa', 'Razón y constancia o certificación extractada del CNR', SOLO_PDF)
    ] },
    { si: 'servicio_a_solicitar=factibilidad_vivienda', titulo: 'Dirección del servicio', subtitulo: 'Dinos dónde se brindará el servicio y adjunta los documentos del inmueble', campos: [
      { tipo: 'lista', nombre: 'departamento_inmueble', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
      { tipo: 'lista', nombre: 'municipio_inmueble', etiqueta: 'Municipio', depende: 'departamento_inmueble', opcionesPor: MUNICIPIOS, media: true },
      { tipo: 'texto', nombre: 'direccion_inmueble', etiqueta: 'Dirección', max: 200 },
      { tipo: 'seccion', titulo: 'Documentos del inmueble' },
      archivo('documento_legal_inmueble', 'Documento legal que demuestre la disponibilidad del inmueble'),
      archivo('cnr_inmueble', 'Certificación extractada (CNR)', { opcional: true }),
      archivo('croquis_inmueble', 'Croquis de ubicación del inmueble'),
      { tipo: 'opciones', nombre: 'hay_tercero', etiqueta: '¿Quién realizará el trámite?', opciones: [
        { valor: 'no', texto: 'Yo mismo', icono: 'ph-user' },
        { valor: 'si', texto: 'Voy a autorizar a un tercero', icono: 'ph-users' }
      ] },
      { tipo: 'seccion', titulo: 'Tercero autorizado', si: 'hay_tercero=si' },
      { tipo: 'opciones', nombre: 'tipo_documento_tercero', etiqueta: 'Tipo de documento del tercero', si: 'hay_tercero=si', opciones: [
        { valor: 'dui', texto: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'numero_doc_tercero', etiqueta: 'Número de documento del tercero', media: true, si: 'hay_tercero=si' },
      { tipo: 'texto', nombre: 'numero_nit_tercero', etiqueta: 'NIT del tercero', modo: 'numeric', opcional: true, media: true, si: 'hay_tercero=si' },
      archivo('documento_tercero', 'Adjuntar documento del tercero', { si: 'hay_tercero=si' }),
      archivo('nit_tercero', 'Adjuntar NIT del tercero', { opcional: true, si: 'hay_tercero=si' }),
      archivo('autorizacion_tercero', 'Documento que autoriza al tercero a realizar el trámite', { si: 'hay_tercero=si' }),
      { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: ['Declaro bajo juramento que los datos aquí proporcionados son fidedignos; asimismo, autorizo a la ANDA a que investigue la información que he proporcionado, sin que esto signifique la aprobación del servicio que solicito, y me obligo a firmar toda la documentación que sea necesaria al momento en que se me apruebe el servicio solicitado'] },
      { tipo: 'opciones', nombre: 'condiciones_del_servicio', etiqueta: '¿Aceptas la declaración?', marcado: true, opciones: [{ valor: 'he_leido_y_acepto', texto: 'He leído y acepto', icono: 'ph-handshake' }] }
    ] },
    REVISION_ANDA,
    { ...PAGO, monto: [['servicio_a_solicitar=cambio_nombre', '$2.26'], ['servicio_a_solicitar=factibilidad_vivienda', '$13.56']], campos: [
      { tipo: 'nota', estilo: 'info', lineas: ['Pagas el servicio ($2.26 el cambio de nombre y $13.56 la factibilidad para una vivienda) con tarjeta de crédito o débito en la pasarela segura de SERFINSA. Ten todo listo: en el portal tienes 10 minutos para completar el pago'] },
      AVISO_PAGO_ANDA
    ] }
  ];

  F[61] = { ...ANDA_SERVICIOS, preseleccion: { servicio_a_solicitar: 'cambio_nombre' }, pasos: PASOS_ANDA_SERVICIOS };
  F[63] = { ...ANDA_SERVICIOS, preseleccion: { servicio_a_solicitar: 'factibilidad_vivienda' }, pasos: PASOS_ANDA_SERVICIOS };

  // ANDA (anda.ventanilla.simple.sv, trámite 20). Persona natural: el portal pide el NIT si el documento no es el DUI, la imagen
  // del documento, el nombre y el correo (vienen los de la cuenta) y si quiere la factura en físico. Persona jurídica: la razón
  // social, la imagen del NIT, quién hace el trámite, la dirección y el correo. Después va la etapa de pago.
  F[62] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Cuéntanos quién solicita la constancia',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento', si: 'tipo_de_persona=persona_natural', opciones: [
        { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaportes', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residentes', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'nit_instit', etiqueta: 'Número de identificación tributaria (NIT)', modo: 'numeric', si: 'tipo_de_persona=persona_juridica' },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento', si: 'tipo_de_persona=persona_natural' }
    ],
    pasos: [
      { si: 'tipo_de_persona=persona_natural', titulo: 'Identificación del solicitante', subtitulo: 'Revisa tus datos y adjunta tu documento', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['El pago por la emisión de la constancia de no servicio es de $3.39 (IVA incluido)'] },
        { tipo: 'texto', nombre: 'n_nit', etiqueta: 'Número de identificación tributaria (NIT)', modo: 'numeric', si: 'tipo_de_documento!=dui' },
        { tipo: 'archivo', nombre: 'imagen_nit', etiqueta: 'Adjuntar imagen de NIT', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: 'tipo_de_documento!=dui' },
        { tipo: 'archivo', nombre: 'imagen_documento', etiqueta: 'Adjuntar imagen de documento', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN },
        ...nombrePorPartes('', { obligatorio: true, casada: true }),
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
        { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
        ...facturaAnda()
      ] },
      { si: 'tipo_de_persona=persona_juridica', titulo: 'Identificación de la empresa', subtitulo: 'Escribe los datos de la sociedad y de quien hace el trámite', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['El pago por la emisión de la constancia de no servicio es de $3.39 (IVA incluido)'] },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón o denominación social' },
        { tipo: 'archivo', nombre: 'imagen_nit_juri', etiqueta: 'Adjuntar imagen de NIT', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN },
        { tipo: 'seccion', titulo: 'Persona que hace el trámite' },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre', patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'opciones', nombre: 'tipo_documento_juri', etiqueta: 'Tipo de documento', opciones: [
          { valor: 'dui', texto: 'DUI', icono: 'ph-identification-card' },
          { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
          { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
        ] },
        { tipo: 'texto', nombre: 'numero_de_documento_juri', etiqueta: 'Número de documento' },
        { tipo: 'archivo', nombre: 'imagen_documento_juri', etiqueta: 'Adjuntar documento', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN },
        { tipo: 'seccion', titulo: 'Dirección' },
        { tipo: 'lista', nombre: 'departamento_juri', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_juri', etiqueta: 'Municipio', depende: 'departamento_juri', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'texto', nombre: 'direccion_juri', etiqueta: 'Datos complementarios', ayuda: 'Calle, avenida o pasaje; casa, edificio o apartamento; colonia o barrio', max: 200 },
        { tipo: 'texto', nombre: 'correo_de_solicitante', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
        { tipo: 'texto', nombre: 'confirmar_correo_juri', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_de_solicitante', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
        ...facturaAnda('_jur')
      ] },
      REVISION_ANDA,
      { ...PAGO, monto: '$3.39', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $3.39 (IVA incluido) con tarjeta de crédito o débito en la pasarela segura de SERFINSA. Ten todo listo: en el portal tienes 10 minutos para completar el pago'] },
        AVISO_PAGO_ANDA
      ] }
    ]
  };

  F[64] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Completa los datos de la cuenta y cómo quieres recibir tu solvencia',
    campos: [
      { tipo: 'nota', estilo: 'info', titulo: 'Nota', lineas: ['El pago por el servicio de emisión de solvencia de cuenta es de $3.39 (IVA incluido). Si tienes más de una cuenta con saldos en mora o pendientes, debes cancelarlos para que se pueda emitir la solvencia'] },
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'texto', nombre: 'n_cuenta', etiqueta: 'N.º de cuenta', modo: 'numeric' },
      { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón o denominación social', max: 50, si: 'tipo_de_persona=persona_juridica' },
      { tipo: 'texto', nombre: 'nombre_solicitante', etiqueta: 'Nombre del cliente según factura', max: 100, si: 'tipo_de_persona=persona_natural' },
      { tipo: 'archivo', nombre: 'factura', etiqueta: 'Adjuntar imagen de factura (ANDA)', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN },
      { tipo: 'lista', nombre: 'departamento', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
      { tipo: 'lista', nombre: 'municipio', etiqueta: 'Municipio', depende: 'departamento', opcionesPor: MUNICIPIOS, media: true },
      { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección', max: 100 },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', modo: 'email' },
      { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Las direcciones de correo electrónico no coinciden' },
      ...facturaAnda()
    ],
    pasos: [
      REVISION_ANDA,
      { ...PAGO, monto: '$3.39', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $3.39 (IVA incluido) con tarjeta de crédito o débito en la pasarela segura de SERFINSA. Ten todo listo: en el portal tienes 10 minutos para completar el pago'] },
        AVISO_PAGO_ANDA
      ] }
    ]
  };

  F[101] = {
    titulo: 'Fondo Social para la Vivienda',
    subtitulo: 'Elige qué quieres consultar de tu préstamo',
    campos: [
      { tipo: 'nota', estilo: 'info', lineas: ['Estas opciones están disponibles si tienes un préstamo con el FSV'] },
      { tipo: 'opciones', nombre: 'service', etiqueta: 'Selecciona qué trámite deseas realizar', opciones: [
        { valor: 'estado_cuenta', texto: 'Estado de cuenta de préstamo', icono: 'ph-file-text' },
        { valor: 'historico_12_meses', texto: 'Histórico de pagos de los últimos 12 meses', icono: 'ph-calendar' },
        { valor: 'historico_escrituracion', texto: 'Histórico de pagos desde la escrituración', icono: 'ph-clock-counter-clockwise' },
        { valor: 'pago_cuota', texto: 'Pago de cuota de préstamos', icono: 'ph-credit-card' }
      ] }
    ],
    // FSV (fsv.ventanilla.simple.sv, trámite 312): después se elige el préstamo de una tabla que el portal trae de la API del
    // FSV (número y dirección). Es el último paso del portal: las consultas se envían ahí y el pago de cuota sigue en otra
    // etapa, que no se pudo ver (la cuenta de prueba no tiene préstamos). Los préstamos y la cuota de aquí son de ejemplo
    pasos: [
      { titulo: 'Datos del préstamo', subtitulo: 'Elige el préstamo', campos: [
        { tipo: 'opciones', nombre: 'prestamo', etiqueta: 'Selecciona un préstamo', columna: true, opciones: [
          { valor: '1000234567', texto: 'Préstamo 1000234567', detalle: 'Residencial Las Arboledas, pasaje 3, casa 12, Santa Tecla', icono: 'ph-house' },
          { valor: '1000298811', texto: 'Préstamo 1000298811', detalle: 'Colonia Escalón, calle El Mirador, casa 45, San Salvador', icono: 'ph-house' }
        ] },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Aviso', lineas: ['La solicitud puede tener demoras; gracias por tu comprensión y paciencia'] }
      ] },
      { ...REVISION, si: 'service!=pago_cuota', subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] },
      { ...REVISION, si: 'service=pago_cuota', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] },
      { ...PAGO, si: 'service=pago_cuota', titulo: 'Pago de cuota', monto: '$125.40' }
    ]
  };

  // MINVIVIENDA (mivi.ventanilla.simple.sv, trámite 81): inscripción nueva o actualización, de persona natural o jurídica.
  // El segundo paso es el último del portal (su "Siguiente" envía la solicitud): copiado hasta ahí. Las lotificaciones
  // van en una tabla en el portal (una fila por lotificación); aquí se pide una y, si son más de 5, el listado en Excel
  const PROPIETARIO_NO = 'tipo_pro=no';
  const lotificacion = (s, si) => [
    { tipo: 'texto', nombre: 'lot_nombre' + s, etiqueta: 'Nombre de la lotificación', si },
    { tipo: 'lista', nombre: 'lot_departamento' + s, etiqueta: 'Departamento donde está ubicada', opciones: DEPARTAMENTOS, media: true, si },
    { tipo: 'lista', nombre: 'lot_municipio' + s, etiqueta: 'Municipio donde está ubicada', depende: 'lot_departamento' + s, opcionesPor: MUNICIPIOS, media: true, si },
    { tipo: 'texto', nombre: 'lot_lotes' + s, etiqueta: 'Número de lotes', modo: 'numeric', patron: '[0-9]+', mensaje: 'Escribe solo números', tercio: true, si },
    { tipo: 'texto', nombre: 'lot_fecha' + s, etiqueta: 'Inicio de comercialización', ...FECHA_DMA, tercio: true, si },
    { tipo: 'texto', nombre: 'lot_aprobacion' + s, etiqueta: 'Número de aprobación del expediente', tercio: true, si }
  ];
  // Lotificaciones: nuevas y existentes. s: sufijo de los nombres, porque el bloque va en el paso de persona natural y en el
  // de persona jurídica (los campos que dependen de otro se buscan por nombre)
  const lotificacionesMivi = (s = '') => [
    { tipo: 'seccion', titulo: 'Datos de lotificaciones a regularizar' },
    { tipo: 'opciones', nombre: 'num_lotificaciones' + s, etiqueta: '¿Tienes más de 5 lotificaciones?', ayuda: 'Si son más de 5, adjunta el listado completo en Excel', opciones: SI_NO },
    { tipo: 'nota', estilo: 'info', titulo: 'Formato del listado', lineas: ['Descarga el formato del listado de lotificaciones en el portal del Ministerio de Vivienda y adjúntalo lleno'], si: 'num_lotificaciones' + s + '=si' },
    { tipo: 'archivo', nombre: 'listado_lotificaciones' + s, etiqueta: 'Listado de lotificaciones', ayuda: 'Formato permitido: Excel (XLS o XLSX)', acepta: '.xls,.xlsx', si: 'num_lotificaciones' + s + '=si' },
    { tipo: 'seccion', titulo: 'Nueva lotificación a regularizar', si: 'num_lotificaciones' + s + '=no' },
    ...lotificacion(s, 'num_lotificaciones' + s + '=no'),
    { tipo: 'opciones', nombre: 'consulta_act_lot' + s, etiqueta: '¿Necesitas actualizar alguna lotificación existente?', opciones: SI_NO, si: 'num_lotificaciones' + s + '=no' },
    { tipo: 'seccion', titulo: 'Lotificación existente a actualizar', si: 'consulta_act_lot' + s + '=si' },
    ...lotificacion('_existente' + s, 'consulta_act_lot' + s + '=si')
  ];
  // Datos de quien inició sesión: el propietario (o el representante legal) o, si no lo es, quien hace el trámite por él
  const cuentaMivi = (titulo, s = '') => [
    { tipo: 'seccion', titulo, si: 'tipo_pro=si' },
    { tipo: 'seccion', titulo: 'Datos de quien realiza el trámite', si: PROPIETARIO_NO },
    { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Número de DUI', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true, media: true },
    { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
    { tipo: 'lista', nombre: 'departamento_mivi' + s, etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
    { tipo: 'lista', nombre: 'municipio_mivi' + s, etiqueta: 'Municipio', depende: 'departamento_mivi' + s, opcionesPor: MUNICIPIOS, media: true },
    { tipo: 'texto', nombre: 'domicilio_mivi' + s, etiqueta: 'Domicilio', ayuda: 'Calle, avenida, pasaje y número de casa' },
    { tipo: 'archivo', nombre: 'poder_tra' + s, etiqueta: 'Poder de la persona que realiza el trámite', ...SOLO_PDF, si: PROPIETARIO_NO }
  ];
  // Propietario que no es quien inició sesión: su DUI ya se escribió en el primer paso
  const propietarioMivi = (titulo, s = '') => [
    { tipo: 'seccion', titulo },
    { tipo: 'texto', nombre: 'fullname_titular' + s, etiqueta: 'Nombre completo', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
    { ...TELEFONO, nombre: 'tel_titular' + s, etiqueta: 'Teléfono', media: true },
    { tipo: 'texto', nombre: 'correo_titular_1' + s, etiqueta: 'Correo electrónico', modo: 'email', media: true },
    { tipo: 'texto', nombre: 'confirmacion_correo_titular' + s, etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_titular_1' + s, mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
    { tipo: 'lista', nombre: 'departamento_titular' + s, etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
    { tipo: 'lista', nombre: 'municipio_titular' + s, etiqueta: 'Municipio', depende: 'departamento_titular' + s, opcionesPor: MUNICIPIOS, media: true },
    { tipo: 'texto', nombre: 'dom_titular' + s, etiqueta: 'Domicilio', ayuda: 'Calle, avenida, pasaje y número de casa' }
  ].map(c => ({ ...c, si: PROPIETARIO_NO }));
  const declaracionMivi = (s = '') => [
    { tipo: 'nota', estilo: 'info', titulo: 'Declaración jurada', lineas: ['Descarga el formato de declaración jurada en el portal del Ministerio de Vivienda, llénalo y adjúntalo firmado'] },
    { tipo: 'archivo', nombre: 'declaracion_jurada' + s, etiqueta: 'Declaración jurada', ...SOLO_PDF }
  ];

  F[105] = {
    titulo: 'Registro de desarrollador parcelario',
    subtitulo: 'Cuéntanos qué necesitas hacer y quién lo solicita',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_tramite', etiqueta: 'Tipo de trámite', ayuda: 'Elige si es una inscripción nueva o la actualización de tu registro', columna: true, opciones: [
        { valor: 'nuevo', texto: 'Inscripción nueva', icono: 'ph-plus-circle' },
        { valor: 'actualizacion', texto: 'Actualización del registro', icono: 'ph-arrows-clockwise' }
      ] },
      { tipo: 'texto', nombre: 'num_reg_par', etiqueta: 'Número de registro de desarrollador parcelario', si: 'tipo_tramite=actualizacion' },
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'tipo_pro', etiqueta: '¿Eres el propietario del trámite?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'dui_propietario', etiqueta: 'Número de DUI del propietario', ayuda: 'De la persona natural o del representante de la persona jurídica', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0', si: PROPIETARIO_NO }
    ],
    pasos: [
      { si: 'tipo_persona=persona_natural', titulo: 'Datos del solicitante', subtitulo: 'Revisa tus datos y adjunta tus documentos y tus lotificaciones', campos: [
        ...cuentaMivi('Datos del solicitante'),
        ...propietarioMivi('Datos del propietario'),
        ...declaracionMivi(),
        { tipo: 'archivo', nombre: 'antecedentes', etiqueta: 'Solvencia de la PNC o constancia de antecedentes penales', ...SOLO_PDF, si: 'tipo_tramite=nuevo' },
        { tipo: 'archivo', nombre: 'antecedentes_act', etiqueta: 'Constancia de antecedentes penales', ...SOLO_PDF, si: 'tipo_tramite=actualizacion' },
        ...lotificacionesMivi()
      ] },
      { si: 'tipo_persona=persona_juridica', titulo: 'Datos de la empresa', subtitulo: 'Escribe los datos de la empresa y del representante legal', campos: [
        ...cuentaMivi('Representante legal', '_jur'),
        { tipo: 'seccion', titulo: 'Empresa' },
        { tipo: 'texto', nombre: 'nombre_empresa', etiqueta: 'Nombre de la empresa', media: true },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón social', media: true },
        { tipo: 'texto', nombre: 'nit_empresa', etiqueta: 'NIT de la empresa', modo: 'numeric', placeholder: '0000-000000-000-0', media: true },
        { tipo: 'archivo', nombre: 'nit_empresa_archivo', etiqueta: 'NIT de la empresa', ...SOLO_PDF },
        { tipo: 'archivo', nombre: 'escritura_constitucion', etiqueta: 'Escritura de constitución de la empresa', ...SOLO_PDF },
        { tipo: 'archivo', nombre: 'contrato_representante', etiqueta: 'Contrato de administración del representante legal', ...SOLO_PDF },
        ...propietarioMivi('Representante legal', '_jur'),
        ...declaracionMivi('_jur'),
        { tipo: 'archivo', nombre: 'credencial_representante', etiqueta: 'Credencial de representante legal', ...SOLO_PDF },
        ...lotificacionesMivi('_jur')
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  // FONAVIPO (fonavipo.ventanilla.simple.sv, trámite 316): el segundo paso es el último del portal (su "Siguiente" envía la
  // solicitud). Su casilla "¿Confirmas que toda la información ingresada es correcta?" la cubre aquí la revisión
  F[109] = {
    titulo: 'Datos del titular',
    subtitulo: 'Cuéntanos quién es el titular del crédito',
    campos: [
      { tipo: 'opciones', nombre: 'titular_credito', etiqueta: '¿Eres titular del crédito?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre', soloLectura: true, si: 'titular_credito=si' },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true, media: true, si: 'titular_credito=si' },
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'DUI', soloLectura: true, media: true, si: 'titular_credito=si' },
      { tipo: 'nota', estilo: 'aviso', titulo: 'Nota', lineas: ['Verifica la información del titular y completa todos los campos posibles: cualquier omisión puede generar inconsistencias y será motivo de rechazo, y tendrías que ingresar una nueva solicitud'], si: 'titular_credito=no' },
      { tipo: 'opciones', nombre: 'titular_tiene_dui', etiqueta: '¿Tienes el DUI del titular?', opciones: SI_NO, si: 'titular_credito=no' },
      { tipo: 'texto', nombre: 'dui_del_titular', etiqueta: 'DUI del titular', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0', si: 'titular_tiene_dui=si' },
      { tipo: 'lista', nombre: 'tipo_documento', etiqueta: 'Tipo de documento del titular', opciones: [['cedula', 'Cédula de identidad'], ['pasaporte', 'Pasaporte'], ['no_tiene', 'No tiene']], media: true, si: 'titular_tiene_dui=no' },
      { tipo: 'texto', nombre: 'documento_no_duix', etiqueta: 'Número de documento del titular', media: true, si: 'tipo_documento=cedula|pasaporte' },
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Tu número de teléfono' }
    ],
    pasos: [
      { titulo: 'Datos del crédito', subtitulo: 'Escribe el número de referencia y la fecha del estado de cuenta', campos: [
        { tipo: 'texto', nombre: 'n_referencia', etiqueta: 'Número de referencia del crédito', modo: 'numeric', max: 9, patron: '[0-9]{9}', mensaje: 'El número de referencia debe tener 9 dígitos' },
        { tipo: 'nota', estilo: 'info', titulo: 'Si vas a cancelar tu crédito', lineas: ['Elige la fecha exacta en la que quieres que se calcule el saldo total de la deuda. El estado de cuenta solo vale para esa fecha: si cancelas antes o después, el saldo será diferente'] },
        { tipo: 'texto', nombre: 'fecha_proyeccion', etiqueta: 'Fecha para emitir el estado de cuenta', ...FECHA_DMA }
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  /* ===== Educación y títulos (MINEDUCYT) ===== */
  // Muestra de los 6032 centros educativos que lista el portal (allá es una lista completa; aquí sirve de sugerencia al escribir)
  const CENTROS_EXISTENTES = ['10001 - CENTRO ESCOLAR ISIDRO MENÉNDEZ', '10280 - CENTRO ESCOLAR HACIENDA EL PORVENIR, CANTON LOS PINOS', '10585 - INSTITUTO NACIONAL DE ARMENIA', '10865 - CENTRO ESCOLAR 22 DE JUNIO', '11220 - CENTRO ESCOLAR CANTON MINAS DE PLOMO', '11584 - CENTRO ESCOLAR CASERIO LAS LAJAS, CANTON SAN ANTONIO ABAD', '11893 - INSTITUTO NACIONAL SUCHITOTO', '12200 - CENTRO ESCOLAR 15 DE SEPTIEMBRE', '12560 - CENTRO ESCOLAR ASENTAMIENTO 14 DE JULIO, CANTÓN SAN PEDRO', '12890 - INSTITUTO NACIONAL EL TRÁNSITO', '13218 - CENTRO ESCOLAR GENERAL FRANCISCO MORAZAN', '13554 - CENTRO ESCOLAR CASERIO SAN BARTOLO, CANTON LAS CAÑAS', '20265 - COLEGIO ARCO IRIS', '20851 - JARDIN INFANTIL SAN RAFAEL', '21165 - COLEGIO MOISES VINCENZI', '60069 - CENTRO ESCOLAR CASERÍO EL GOLONDRINO, CANTÓN SACRAMENTO', '60341 - CENTRO ESCOLAR MARÍA TIMOTEA VÁSQUEZ VIUDA DE PÉREZ', '66043 - COMPLEJO EDUCATIVO CANTÓN LOS PLANES', '68190 - CENTRO ESCOLAR CANTÓN EL GUAMO', '76011 - CENTRO ESCOLAR CASERÍO PLANES DE HUERTAS, CANTÓN LAS HUERTAS', '80107 - CENTRO ESCOLAR CASERÍO LOS MARTÍNEZ, CANTÓN LA POZA', '84054 - CENTRO ESCOLAR CASERÍO EL BOTIJÓN, CANTÓN PAJIGUA ARRIBA', '86254 - CENTRO ESCOLAR CASERÍO PEÑAS BLANCAS, CANTÓN EL ZOPE', '86515 - CENTRO ESCOLAR CASERÍO LA LEONOR, CANTÓN MANAHUARE'];
  const DOCUMENTO_3 = () => [
    { valor: 'dui', texto: 'DUI', icono: 'ph-identification-card' },
    { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
    { valor: 'carnet_de_residencia', texto: 'Carné de residencia', icono: 'ph-identification-badge' }
  ];
  // Datos de una persona que no es quien inició sesión (representante, apoderado, director): s es el sufijo de los nombres
  const personaMineducyt = (s, quien) => [
    ...nombrePorPartes(`${s}_`, { obligatorio: true, casada: true }),
    { tipo: 'opciones', nombre: `tipo_documento_${s}`, etiqueta: `Tipo de documento ${quien}`, opciones: DOCUMENTO_3() },
    { tipo: 'texto', nombre: `numero_documento_${s}`, etiqueta: 'Número de documento' },
    archivo(`documento_${s}`, `Copia del documento de identidad ${quien}`, SOLO_PDF)
  ];

  // MINEDUCYT (mineducyt.ventanilla.simple.sv, trámite 41): la creación, la ampliación de servicios y el cambio de domicilio
  // de un centro educativo son el mismo trámite; se elige cuál en el cuarto paso. Copiado hasta la declaración jurada, el
  // último paso del portal (su "Siguiente" envía la solicitud; no tiene pago).
  // Grados que se imparten en un nivel, por jornada (en el portal, casillas opcionales de mañana y de tarde)
  const grados = lista => lista.map(g => ({ valor: g, texto: g }));
  const gradosPorJornada = (clave, titulo, lista, si) => [
    { tipo: 'seccion', titulo, si },
    { tipo: 'opciones', nombre: 'grados_' + clave + '_m', etiqueta: 'Jornada matutina', multiple: true, compacto: true, opcional: true, opciones: grados(lista), si },
    { tipo: 'opciones', nombre: 'grados_' + clave + '_v', etiqueta: 'Jornada vespertina', multiple: true, compacto: true, opcional: true, opciones: grados(lista), si }
  ];
  const BACHILLERATOS_TECNICOS = ['ACUICULTURA', 'ADMINISTRACIÓN Y MERCADEO', 'ADMINISTRATIVO CONTABLE', 'AERONÁUTICO', 'AGRÍCOLA', 'AGROINDUSTRIA', 'AGROPECUARIO', 'ARQUITECTURA', 'ARTES PLÁSTICAS', 'ASISTENCIA ADMINISTRATIVA', 'ASISTENCIA CONTABLE', 'ATENCIÓN PRIMARIA EN SALUD', 'CONTADURÍA', 'DANZA', 'DESARROLLO DE PRODUCTOS EN MADERA', 'DESARROLLO DE SOFTWARE', 'DISEÑO GRÁFICO', 'ELABORACIÓN DE ALIMENTOS Y BEBIDAS', 'ELECTROMECÁNICA', 'ELECTRÓNICA', 'ELECTRÓNICA NAVAL', 'ELECTROTECNIA', 'GESTIÓN DE TURISMO ALTERNATIVO', 'GESTIÓN Y DESARROLLO TURÍSTICO', 'HOSTELERÍA Y TURISMO', 'HOTELERÍA', 'INFRA. TEC. Y SERVICIOS INF.', 'INGENIERÍA CIVIL', 'INGENIERÍA ELÉCTRICA', 'LÁCTEOS Y CÁRNICOS', 'LOGÍSTICA GLOBAL', 'LOGÍSTICA Y ADUANAS', 'MANTENIMIENTO AUTOMOTRIZ', 'MANTENIMIENTO DE AERONAVES', 'MANTENIMIENTO ELÉCTRICO', 'MECÁNICA AUTOMOTRIZ', 'MECÁNICA GENERAL', 'MECÁNICA INDUSTRIAL', 'MECÁNICA NAVAL', 'MÚSICA', 'PATRIMONIO CULTURAL', 'PROCESAMIENTO DE LÁCTEOS', 'PRODUCCIÓN ACUÍCOLA', 'PRODUCCIÓN AGROPECUARIA', 'SALUD', 'SECRETARIADO', 'SERVICIOS HOTELEROS', 'SERVICIOS PREVENTIVOS DEL VEHÍCULO', 'SERVICIOS TURÍSTICOS', 'SISTEMAS ELÉCTRICOS', 'SISTEMAS INFORMÁTICOS', 'TÉCNICAS DE CONFECCIÓN TEXTIL', 'TURISMO DE MAR', 'TURISMO SOSTENIBLE'];
  // La sede (dirección, plano, contacto) se pide al crear el centro o cambiarlo de domicilio
  const SEDE_NUEVA = 'tipo_tramite=creacion|cambio_domicilio';
  const PASOS_MINEDUCYT_CENTROS = [
    { titulo: 'Definición del solicitante', subtitulo: 'Cuéntanos quién hace la solicitud', campos: [
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de solicitante', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'tipo_documento', etiqueta: 'Tipo de documento de identidad', si: 'tipo_persona=persona_natural', opciones: [
        { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento de identidad', si: 'tipo_persona=persona_natural' }
    ] },
    { si: 'tipo_persona=persona_natural', titulo: 'Identificación del solicitante', subtitulo: 'Revisa tus datos y adjunta tu documento', campos: [
      archivo('documento_identidad', 'Documento de identidad', { ayuda: 'Formato permitido: PDF, de hasta 1 MB', acepta: '.pdf' }),
      ...nombrePorPartes('', { obligatorio: true, casada: true }),
      { tipo: 'texto', nombre: 'conocido_por', etiqueta: 'Conocido por', opcional: true, media: true },
      { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión', opcional: true, media: true },
      { tipo: 'texto', nombre: 'nit', etiqueta: 'Número de identificación tributaria (NIT)', modo: 'numeric', si: 'tipo_documento!=dui' },
      archivo('documento_nit', 'Documento de identificación tributaria (NIT)', { ...SOLO_PDF, opcional: true, si: 'tipo_documento!=dui' }),
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono de contacto' },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirma tu correo electrónico', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true }
    ] },
    { si: 'tipo_persona=persona_juridica', titulo: 'Identificación del solicitante', subtitulo: 'Escribe los datos de la institución y de quien la representa', campos: [
      { tipo: 'seccion', titulo: 'Fundación, asociación o sociedad que representas' },
      { tipo: 'texto', nombre: 'nombre_institucion', etiqueta: 'Nombre de la institución' },
      archivo('escritura_constitucion', 'Copia de la escritura de constitución', SOLO_PDF),
      { tipo: 'texto', nombre: 'nit_institucion', etiqueta: 'NIT de la institución', modo: 'numeric' },
      archivo('documento_nit_institucion', 'Copia del NIT de la institución', SOLO_PDF),
      { tipo: 'lista', nombre: 'tipo_institucion', etiqueta: 'Tipo de institución', media: true, opciones: [['publico', 'Público'], ['privado', 'Privado'], ['mixta', 'Mixta']] },
      { tipo: 'lista', nombre: 'naturaleza_institucion', etiqueta: 'Naturaleza de la institución', media: true, opciones: [
        ['alcaldia_municipal', 'Alcaldía municipal'], ['asociacion_municipal', 'Asociación municipal'], ['asociacion_cooperativa', 'Asociación cooperativa'],
        ['asociacion_desarrollo_comunal', 'Asociación de desarrollo comunal'], ['asociacion_deportiva', 'Asociación deportiva'], ['asociacion_sin_fines_lucro', 'Asociación sin fines de lucro'],
        ['empresa_mercantil', 'Empresa mercantil'], ['fundacion_sin_fines_lucro', 'Fundación sin fines de lucro'], ['iglesia', 'Iglesia'], ['institucion_autonoma', 'Institución autónoma'],
        ['institucion_organo_ejecutivo', 'Institución de órgano ejecutivo'], ['sociedad_anonima', 'Sociedad anónima de capital variable'], ['sociedad_personas', 'Sociedad de personas'],
        ['sindicato', 'Sindicato'], ['institucion_organo_legislativo', 'Institución de órgano legislativo'], ['institucion_organo_judicial', 'Institución de órgano judicial'],
        ['union_temporal_de_personas', 'Unión temporal de personas'], ['de_beneficencia', 'De beneficencia']
      ] },
      { tipo: 'seccion', titulo: 'Representante legal' },
      ...personaMineducyt('representante', 'del representante legal'),
      archivo('credencial_junta', 'Copia de la credencial de junta directiva', SOLO_PDF),
      { tipo: 'texto', nombre: 'nit_representante', etiqueta: 'NIT del representante legal', modo: 'numeric' },
      archivo('documento_nit_representante', 'Copia del NIT del representante legal', SOLO_PDF),
      { ...TELEFONO, nombre: 'telefono_fijo_representante', etiqueta: 'Teléfono fijo', opcional: true, media: true },
      { ...TELEFONO, nombre: 'telefono_representante', etiqueta: 'Teléfono móvil', media: true },
      { tipo: 'texto', nombre: 'correo_representante', etiqueta: 'Correo electrónico del representante legal', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo_representante', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_representante', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
      { tipo: 'opciones', nombre: 'tiene_apoderado', etiqueta: '¿Cuentas con apoderado legal?', opciones: SI_NO },
      { tipo: 'seccion', titulo: 'Apoderado legal', si: 'tiene_apoderado=si' },
      ...personaMineducyt('apoderado', 'del apoderado legal').map(c => ({ ...c, si: 'tiene_apoderado=si' })),
      archivo('poder', 'Copia del poder o autorización', { ...SOLO_PDF, si: 'tiene_apoderado=si' }),
      { tipo: 'texto', nombre: 'nit_apoderado', etiqueta: 'NIT del apoderado legal', modo: 'numeric', si: 'tiene_apoderado=si' },
      archivo('documento_nit_apoderado', 'Copia del NIT del apoderado legal', { ...SOLO_PDF, si: 'tiene_apoderado=si' }),
      { ...TELEFONO, nombre: 'telefono_fijo_apoderado', etiqueta: 'Teléfono fijo', opcional: true, media: true, si: 'tiene_apoderado=si' },
      { ...TELEFONO, nombre: 'telefono_apoderado', etiqueta: 'Teléfono móvil', media: true, si: 'tiene_apoderado=si' },
      { tipo: 'texto', nombre: 'correo_apoderado', etiqueta: 'Correo electrónico del apoderado legal', modo: 'email', media: true, si: 'tiene_apoderado=si' },
      { tipo: 'texto', nombre: 'confirmar_correo_apoderado', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_apoderado', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true, si: 'tiene_apoderado=si' }
    ] },
    { titulo: 'Tipo de trámite', subtitulo: 'Elige qué necesitas hacer con el centro educativo', campos: [
      { tipo: 'opciones', nombre: 'tipo_tramite', etiqueta: 'Tipo de trámite', columna: true, opciones: [
        { valor: 'ampliacion', texto: 'Ampliación de servicios educativos', icono: 'ph-plus-circle' },
        { valor: 'creacion', texto: 'Creación de centro educativo', icono: 'ph-buildings' },
        { valor: 'cambio_domicilio', texto: 'Cambio de domicilio', icono: 'ph-map-pin' }
      ] }
    ] },
    { titulo: 'Documentos del centro educativo', subtitulo: 'Adjunta las certificaciones vigentes en PDF', campos: [
      { tipo: 'texto', nombre: 'centro_educativo', etiqueta: 'Nombre del centro educativo', ayuda: 'Escribe el código o el nombre para buscarlo', sugerencias: CENTROS_EXISTENTES, si: 'tipo_tramite!=creacion' },
      { tipo: 'seccion', titulo: 'Requisitos del Ministerio de Salud' },
      archivo('certificacion_minsal', 'Certificación de autorización de las condiciones de saneamiento ambiental', SOLO_PDF),
      { tipo: 'texto', nombre: 'vence_minsal', etiqueta: 'Fecha de vencimiento de la certificación', ...FECHA_DMA },
      { tipo: 'seccion', titulo: 'Requisitos del Cuerpo de Bomberos de El Salvador' },
      archivo('certificacion_bomberos', 'Certificación de autorización de las condiciones de seguridad', SOLO_PDF),
      { tipo: 'texto', nombre: 'vence_bomberos', etiqueta: 'Fecha de vencimiento de la certificación', ...FECHA_DMA },
      { tipo: 'seccion', titulo: 'Calificación del lugar' },
      archivo('calificacion_lugar', 'Documento de calificación del lugar emitido por la entidad competente', SOLO_PDF),
      { tipo: 'seccion', titulo: 'Nombres propuestos para el centro educativo', si: 'tipo_tramite=creacion' },
      { tipo: 'nota', estilo: 'info', lineas: ['Escribe tres nombres en orden de prioridad (la opción 1 es la de mayor prioridad) y adjunta un archivo con la justificación de cada uno'], si: 'tipo_tramite=creacion' },
      { tipo: 'texto', nombre: 'nombre_propuesto_1', etiqueta: 'Nombre propuesto (opción 1)', si: 'tipo_tramite=creacion' },
      { tipo: 'texto', nombre: 'nombre_propuesto_2', etiqueta: 'Nombre propuesto (opción 2)', si: 'tipo_tramite=creacion' },
      { tipo: 'texto', nombre: 'nombre_propuesto_3', etiqueta: 'Nombre propuesto (opción 3)', si: 'tipo_tramite=creacion' },
      archivo('justificacion_nombres', 'Justificación de los nombres propuestos', { ayuda: 'Formatos permitidos: PDF, DOC, DOCX', acepta: '.pdf,.doc,.docx', si: 'tipo_tramite=creacion' }),
      { tipo: 'seccion', titulo: 'Director propuesto', si: 'tipo_tramite=creacion' },
      ...personaMineducyt('director', 'del director').map(c => ({ ...c, si: 'tipo_tramite=creacion' })),
      { tipo: 'texto', nombre: 'nip_director', etiqueta: 'Número de Identificación Pedagógica (NIP)', modo: 'numeric', media: true, si: 'tipo_tramite=creacion' },
      { tipo: 'lista', nombre: 'nivel_escalafon', etiqueta: 'Nivel de escalafón', media: true, opciones: [['PDN1', 'Nivel uno'], ['PDN2', 'Nivel dos']], si: 'tipo_tramite=creacion' },
      archivo('documento_nip_director', 'Copia del NIP del director', { ...SOLO_PDF, si: 'tipo_tramite=creacion' }),
      { ...TELEFONO, nombre: 'telefono_director', etiqueta: 'Teléfono móvil del director', si: 'tipo_tramite=creacion' }
    ] },
    { si: SEDE_NUEVA, titulo: 'Sede educativa', subtitulo: 'Dinos dónde funcionará el centro educativo y cómo contactarlo', campos: [
      { tipo: 'seccion', titulo: 'Información de la sede educativa', si: 'tipo_tramite=creacion' },
      { tipo: 'seccion', titulo: 'Nueva ubicación de la sede educativa', si: 'tipo_tramite=cambio_domicilio' },
      { tipo: 'lista', nombre: 'departamento_sede', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
      { tipo: 'lista', nombre: 'municipio_sede', etiqueta: 'Municipio', depende: 'departamento_sede', opcionesPor: MUNICIPIOS, media: true },
      { tipo: 'texto', nombre: 'direccion_est', etiqueta: 'Dirección física', max: 300 },
      { tipo: 'texto', nombre: 'geo_lat_est', etiqueta: 'Latitud', placeholder: '13.6929', modo: 'numeric', patron: '-?[0-9]{1,2}\\.[0-9]+', mensaje: 'Escribe la latitud con decimales, por ejemplo 13.6929', media: true },
      { tipo: 'texto', nombre: 'geo_lon_est', etiqueta: 'Longitud', placeholder: '-89.2182', patron: '-?[0-9]{1,3}\\.[0-9]+', mensaje: 'Escribe la longitud con decimales, por ejemplo -89.2182', media: true },
      archivo('disponibilidad_inmueble', 'Documento legal que demuestre la disponibilidad del inmueble', SOLO_PDF),
      archivo('plano_arquitectonico', 'Plano arquitectónico', SOLO_PDF),
      { ...TELEFONO, nombre: 'telefono_fijo_est', etiqueta: 'Teléfono de la sede educativa', media: true },
      { ...TELEFONO, nombre: 'telefono_movil_est', etiqueta: 'Teléfono alternativo', opcional: true, media: true },
      { tipo: 'texto', nombre: 'correo_est', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirme_correo_est', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_est', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true }
    ] },
    { titulo: 'Servicios a brindar', subtitulo: 'Elige los niveles y, en cada uno, los grados por jornada', campos: [
      { tipo: 'opciones', nombre: 'chk_niveles', etiqueta: 'Niveles a impartir', multiple: true, dosColumnas: true, opciones: [
        { valor: 'inicial', texto: 'Educación inicial', icono: 'ph-baby' },
        { valor: 'parvularia', texto: 'Educación parvularia', icono: 'ph-puzzle-piece' },
        { valor: 'i_ciclo', texto: 'I ciclo', icono: 'ph-book-open' },
        { valor: 'ii_ciclo', texto: 'II ciclo', icono: 'ph-book-open' },
        { valor: 'iii_ciclo', texto: 'III ciclo', icono: 'ph-book-open' },
        { valor: 'bto_general', texto: 'Bachillerato general', icono: 'ph-graduation-cap' },
        { valor: 'bto_tecnico', texto: 'Bachillerato técnico', detalle: 'Lo completas en el paso siguiente', icono: 'ph-wrench' }
      ] },
      ...gradosPorJornada('inicial', 'Educación inicial', ['Lactantes', '1 año', '2 años', '3 años'], 'chk_niveles=inicial'),
      ...gradosPorJornada('inicial_vfc', 'Educación inicial (vía familiar comunitaria)', ['Lactantes', '1 año', '2 años', '3 años'], 'tipo_tramite=ampliacion'),
      archivo('normativa_proteccion', 'Normativa interna para la protección integral de la niñez', { ...SOLO_PDF, si: 'chk_niveles=inicial' }),
      ...gradosPorJornada('parvularia', 'Educación parvularia', ['4 años', '5 años', '6 años'], 'chk_niveles=parvularia'),
      ...gradosPorJornada('parvularia_vfc', 'Educación parvularia (vía familiar comunitaria)', ['4 años', '5 años'], 'tipo_tramite=ampliacion'),
      ...gradosPorJornada('i_ciclo', 'I ciclo', ['Primer grado', 'Segundo grado', 'Tercer grado'], 'chk_niveles=i_ciclo'),
      ...gradosPorJornada('ii_ciclo', 'II ciclo', ['Cuarto grado', 'Quinto grado', 'Sexto grado'], 'chk_niveles=ii_ciclo'),
      ...gradosPorJornada('iii_ciclo', 'III ciclo', ['Séptimo grado', 'Octavo grado', 'Noveno grado'], 'chk_niveles=iii_ciclo'),
      { tipo: 'seccion', titulo: 'Bachillerato general', si: 'chk_niveles=bto_general' },
      { tipo: 'opciones', nombre: 'grados_bachillerato_general', etiqueta: 'Jornada completa', multiple: true, compacto: true, opcional: true, opciones: grados(['Primer año', 'Segundo año']), si: 'chk_niveles=bto_general' }
    ] },
    { si: 'chk_niveles=bto_tecnico', titulo: 'Bachillerato técnico', subtitulo: 'Elige cuántos bachilleratos técnicos impartirás y sus años', campos: [
      { tipo: 'opciones', nombre: 'cantidad_bto', etiqueta: 'Cantidad de bachilleratos técnicos', compacto: true, opciones: grados(['1', '2', '3', '4']) },
      ...[1, 2, 3, 4].flatMap(n => {
        const si = n === 1 ? undefined : 'cantidad_bto=' + ['2', '3', '4'].filter(c => c >= String(n)).join('|');
        return [
          { tipo: 'seccion', titulo: `Bachillerato técnico ${n}`, ...(si ? { si } : {}) },
          { tipo: 'lista', nombre: 'opcion_bto' + n, etiqueta: 'Opción de bachillerato', opciones: BACHILLERATOS_TECNICOS.map(b => [b, b]), ...(si ? { si } : {}) },
          { tipo: 'opciones', nombre: 'bach_tec_' + n, etiqueta: 'Jornada completa', multiple: true, compacto: true, opcional: true, opciones: grados(['Primer año', 'Segundo año', 'Tercer año']), ...(si ? { si } : {}) }
        ];
      })
    ] },
    { titulo: 'Declaración jurada', subtitulo: 'Lee la declaración y confirma que estás de acuerdo', campos: [
      { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: ['Declaro bajo juramento que los datos contenidos en el presente formulario son expresión fiel de la verdad, por lo cual asumo la responsabilidad correspondiente y acepto cualquier revisión de la información por mí proporcionada y las que las instituciones involucradas en el trámite realicen'] },
      { tipo: 'opciones', nombre: 'check_acepta', etiqueta: '¿Estás de acuerdo con la declaración jurada?', marcado: true, opciones: [{ valor: 'acepto', texto: 'Sí, estoy de acuerdo', icono: 'ph-handshake' }] }
    ] },
    { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
  ];
  F[48] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'ampliacion' }, pasos: PASOS_MINEDUCYT_CENTROS };
  F[51] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'cambio_domicilio' }, pasos: PASOS_MINEDUCYT_CENTROS };
  F[54] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'creacion' }, pasos: PASOS_MINEDUCYT_CENTROS };

  // Documentos que se pueden autenticar (código y nombre, como los lista el portal)
  const GRADOS_NOTAS = [['PRIMER GRADO', 'BÁSICA'], ['SEGUNDO GRADO', 'BÁSICA'], ['TERCER GRADO', 'BÁSICA'], ['CUARTO GRADO', 'BÁSICA'], ['QUINTO GRADO', 'BÁSICA'], ['SEXTO GRADO', 'BÁSICA'], ['SÉPTIMO GRADO', 'BÁSICA'], ['OCTAVO GRADO', 'BÁSICA'], ['NOVENO GRADO', 'BÁSICA'], ['PRIMER AÑO DE BACHILLERATO', 'MEDIA'], ['SEGUNDO AÑO DE BACHILLERATO', 'MEDIA'], ['TERCER AÑO DE BACHILLERATO', 'MEDIA'], ['CUARTO AÑO DE BACHILLERATO', 'MEDIA']];
  const DOCUMENTOS_AUTENTICA = [
    ['001', 'Título de bachillerato'],
    ...GRADOS_NOTAS.map(([grado, nivel], i) => [String(i + 2).padStart(3, '0'), `Certificación de notas - ${grado} - EDUCACIÓN ${nivel}`]),
    ['015', 'Boleta de notas PAES/AVANZO']
  ];

  F[49] = {
    preguntaNombre: '¿Los documentos están a tu nombre?',
    titulo: 'Auténtica de documentos académicos',
    subtitulo: 'Lee la nota y confirma que estás de acuerdo con los requisitos',
    campos: [
      { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Los títulos de bachiller emitidos por el Ministerio de Educación, Ciencia y Tecnología a partir del año 2008 ya se encuentran debidamente autenticados en el Ministerio de Relaciones Exteriores de El Salvador y no requieren de documentos académicos adicionales'] },
      { tipo: 'opciones', nombre: 'declara_g3', etiqueta: '¿Estás de acuerdo con los requisitos del trámite?', multiple: true, marcado: true, opciones: [{ valor: 'si_g3', texto: 'Sí, estoy de acuerdo', icono: 'ph-handshake' }] }
    ],
    // MINEDUCYT (mineducyt.ventanilla.simple.sv, trámite 331): copiado hasta "Adjuntar documentación", el último paso del
    // portal (su "Siguiente" envía la solicitud). Los documentos que se pueden autenticar los lista el portal en una tabla
    pasos: [
      { titulo: 'Información del solicitante', subtitulo: 'Cuéntanos si el estudiante es menor de edad', campos: [
        { tipo: 'opciones', nombre: 'es_menor_edad', etiqueta: '¿El estudiante es menor de edad?', opciones: SI_NO },
        { tipo: 'nota', estilo: 'info', lineas: ['Indica tu parentesco con el estudiante'], si: 'es_menor_edad=si' },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante', soloLectura: true, media: true, si: 'es_menor_edad=si' },
        { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Documento', soloLectura: true, media: true, si: 'es_menor_edad=si' },
        { tipo: 'lista', nombre: 'parentesco_con_estudiante', etiqueta: 'Parentesco con el estudiante', opciones: [['padre', 'Padre'], ['madre', 'Madre'], ['otro', 'Otro familiar']], media: true, si: 'es_menor_edad=si' },
        { tipo: 'texto', nombre: 'parentesco_otro', etiqueta: 'Especifica el parentesco', media: true, si: 'parentesco_con_estudiante=otro' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe el documento del interesado'], si: 'es_menor_edad=no' },
        { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento', si: 'es_menor_edad=no', opciones: [
          { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
          { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane' },
          { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
        ] },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento', si: 'es_menor_edad=no' },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Documento original', lineas: ['Al terminar el proceso, presenta el documento original que quieres autenticar para confrontarlo'] }
      ] },
      { titulo: 'Datos del estudiante', subtitulo: 'Escribe el nombre como aparece en los documentos', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe el nombre que tenías cuando estudiabas'], si: 'es_menor_edad=no' },
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe el nombre del estudiante'], si: 'es_menor_edad=si' },
        ...nombrePorPartes('', { obligatorio: true, casada: 'es_menor_edad=no', prellenarSi: 'es_menor_edad=no' }),
        { tipo: 'texto', nombre: 'nie', etiqueta: 'NIE', ayuda: 'Si estudiaste después de 2007; hasta 8 dígitos', modo: 'numeric', max: 8, patron: '[0-9]{1,8}', mensaje: 'Escribe solo números, hasta 8 dígitos', opcional: true },
        { tipo: 'nota', estilo: 'info', lineas: ['La solicitud se atenderá según disponibilidad'] }
      ] },
      { titulo: 'Documentos a autenticar', subtitulo: 'Elige uno o más documentos', campos: [
        { tipo: 'opciones', nombre: 'documentos', etiqueta: 'Documentos que puedes autenticar', multiple: true, columna: true, opciones: DOCUMENTOS_AUTENTICA.map(([valor, texto]) => ({ valor, texto, detalle: valor })) }
      ] },
      { titulo: 'Adjuntar documentación', subtitulo: 'Adjunta cada documento que elegiste', campos: [
        ...DOCUMENTOS_AUTENTICA.map(([valor, texto]) => archivo('adjunto_' + valor, texto, { si: 'documentos=' + valor })),
        { tipo: 'nota', estilo: 'info', lineas: ['Si necesitas adjuntar más de un archivo para un documento, júntalos en un .zip o .rar'] }
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  F[50] = {
    titulo: 'Ingreso de solicitud',
    subtitulo: 'Procedimiento para solicitar tu boleta de resultados PAES/AVANZO',
    campos: [
      { tipo: 'nota', estilo: 'info', titulo: 'Solicitud de NIE (Número de identificación del estudiante)', lineas: ['Bienvenido(a) al proceso de solicitud de boleta de resultados PAES/AVANZO'] },
      { tipo: 'opciones', nombre: 'pregunta_nie_personal', etiqueta: '¿Conoces tu número de NIE?', opciones: SI_NO },
      { tipo: 'nota', estilo: 'info', titulo: 'Nota', lineas: ['Si tu NIE es del 2009 en adelante, no escribas los ceros del inicio'], si: 'pregunta_nie_personal=si' },
      { tipo: 'texto', nombre: 'nie_personal', etiqueta: 'NIE', modo: 'numeric', patron: '[0-9]+', mensaje: 'Escribe tu NIE, solo números', si: 'pregunta_nie_personal=si' },
      { tipo: 'texto', nombre: 'fechapj', etiqueta: 'Año en que hiciste la PAES', placeholder: 'Año', max: 4, patron: '[0-9]{4}', modo: 'numeric', mensaje: 'Escribe el año con 4 números', si: 'pregunta_nie_personal=si' }
    ],
    // Sin NIE, el portal busca a la persona por su nombre y el año de la prueba. Después va la declaración jurada
    pasos: [
      { si: 'pregunta_nie_personal=no', titulo: 'Ingreso de datos', subtitulo: 'Te buscamos por tu nombre y el año en que hiciste la prueba', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true },
        { tipo: 'texto', nombre: 'anio_prueba', etiqueta: 'Año en que hiciste la prueba', placeholder: 'Año', max: 4, patron: '[0-9]{4}', modo: 'numeric', mensaje: 'Escribe el año con 4 números' }
      ] },
      // Último paso del portal: su "Siguiente" envía la solicitud
      { titulo: 'Declaración jurada', subtitulo: 'Lee la declaración y acéptala para terminar', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: [
          'Doy fe y declaro bajo juramento que la información proporcionada en este formulario es verdadera y cumple con los requisitos legales establecidos. Entiendo y acepto que, en caso de falsedad en los datos proporcionados, asumiré la responsabilidad administrativa, civil o penal correspondiente según la normativa vigente',
          'De acuerdo con el Art. 12 de la Ley de Ciberseguridad, cualquier uso indebido de datos o información reservada contenida en sistemas que utilicen Tecnologías de la Información y la Comunicación será sancionado. Asimismo, acepto recibir notificaciones relacionadas con este proceso por correo electrónico y en la plataforma SIMPLE.SV'
        ] },
        { tipo: 'opciones', nombre: 'decla', etiqueta: '¿Aceptas la declaración?', marcado: true, opciones: [{ valor: 'acepto', texto: 'He leído y acepto los términos', icono: 'ph-handshake' }] }
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  // Opciones de bachillerato de la certificación de notas, como las lista el portal (sin tildes)
  const OPCIONES_BACHILLERATO = ['ACADEMICO OPCION CIENCIAS NATURALES', 'ACADEMICO OPCION HUMANIDADES', 'ACADEMICO OPCION HUMANISTICA', 'ACADEMICO OPCION INGLES', 'ACADEMICO OPCION MATEMATICA', 'ACADEMICO OPCION MATEMATICA-FISICA', 'ACUICULTURA', 'ADMINISTRACION Y MERCADEO', 'ADMINISTRATIVO CONTABLE', 'AERONAUTICO', 'AGRICOLA', 'AGROINDUSTRIA', 'AGROPECUARIO', 'ARQUITECTURA', 'ARTES OPCION ARTES ESCENICAS', 'ARTES OPCION ARTES PLASTICAS', 'ARTES OPCION ARTES VISUALES', 'ARTES OPCION MUSICA', 'ARTES PLASTICAS', 'ASISTENCIA ADMINISTRATIVA', 'ASISTENCIA CONTABLE', 'ATENCION PRIMARIA EN SALUD', 'CIENCIAS LETRAS Y MATEMATICAS', 'CIENCIAS Y LETRAS', 'COMERCIO Y ADMINISTRACION', 'COMERCIO Y ADMINISTRACION OPCION COMERCIALIZACION', 'COMERCIO Y ADMINISTRACION OPCION COMPUTACION', 'COMERCIO Y ADMINISTRACION OPCION CONTADURIA', 'COMERCIO Y ADMINISTRACION OPCION SECRETARIADO', 'CONTADURIA', 'DANZA', 'DESARROLLO DE PRODUCTOS EN MADERA', 'DESARROLLO DE SOFTWARE', 'DISENO GRAFICO', 'ELABORACION DE ALIMENTOS Y BEBIDAS', 'ELECTROMECANICA', 'ELECTRONICA', 'ELECTRONICA NAVAL', 'ELECTROTECNIA', 'GENERAL', 'GESTION DE TURISMO ALTERNATIVO', 'GESTION Y DESARROLLO TURISTICO', 'HOSTELERIA Y TURISMO', 'HOTELERIA', 'INDUSTRIAL ESPECIALIDAD ARQUITECTURA', 'INDUSTRIAL ESPECIALIDAD AUTOMOTORES', 'INDUSTRIAL ESPECIALIDAD CONSTRUCCION', 'INDUSTRIAL ESPECIALIDAD ELECTRICIDAD', 'INDUSTRIAL ESPECIALIDAD MECANICA AUTOMOTRIZ', 'INDUSTRIAL ESPECIALIDAD MECANICA GENERAL', 'INDUSTRIAL OPCION ARQUITECTURA', 'INDUSTRIAL OPCION AUTOMOTORES', 'INDUSTRIAL OPCION CONSTRUCCION', 'INDUSTRIAL OPCION ELECTRICIDAD', 'INDUSTRIAL OPCION ELECTRONICA', 'INDUSTRIAL OPCION MECANICA', 'INDUSTRIAL OPCION MECANICA AUTOMOTRIZ', 'INDUSTRIAL OPCION MECANICA DE AVIACION', 'INDUSTRIAL OPCION MECANICA GENERAL', 'INFRA. TEC. Y SERVICIOS INF.', 'INGENIERIA CIVIL', 'INGENIERIA ELECTRICA', 'LACTEOS Y CARNICOS', 'LOGISTICA GLOBAL', 'LOGISTICA Y ADUANAS', 'MANTENIMIENTO AUTOMOTRIZ', 'MANTENIMIENTO DE AERONAVES', 'MANTENIMIENTO ELECTRICO', 'MECANICA AUTOMOTRIZ', 'MECANICA GENERAL', 'MECANICA INDUSTRIAL', 'MECANICA NAVAL', 'MUSICA', 'NAVEGACION Y PESCA OPCION MECANICA NAVAL', 'NAVEGACION Y PESCA OPCION MECANICA Y CONSTRUCCION DE BOTES', 'NAVEGACION Y PESCA OPCION NAVEGACION Y ARTES DE PESCA', 'NAVEGACION Y PESCA OPCION PROCESAMIENTO Y BIOLOGIA MARINA', 'ORIENTACION DOCENTE', 'PATRIMONIO CULTURAL', 'PEDAGOGICO OPCION EDUCACION ESPECIAL', 'PEDAGOGICO OPCION EDUCACION PARVULARIA', 'PEDAGOGICO PLAN II', 'PEDAGOGICO PLAN III', 'PROCESAMIENTO DE LACTEOS', 'PRODUCCION ACUICOLA', 'PRODUCCION AGROPECUARIA', 'SALUD', 'SALUD OPCION ASISTENTE DE ODONTOLOGIA', 'SALUD OPCION ENFERMERIA', 'SALUD OPCION SANEAMIENTO AMBIENTAL', 'SALUD OPCION SANIDAD Y PRODUCCION ANIMAL', 'SECRETARIADO', 'SERVICIOS HOTELEROS', 'SERVICIOS PREVENTIVOS DEL VEHICULO', 'SERVICIOS TURISTICOS', 'SISTEMAS ELECTRICOS', 'SISTEMAS INFORMATICOS', 'TECNICAS DE CONFECCION TEXTIL', 'TECNICAS VOCACIONALES OPCION ALTA COSTURA Y DISENO', 'TECNICAS VOCACIONALES OPCION ARTE Y DECORACION', 'TECNICAS VOCACIONALES OPCION CULTOR DE BELLEZA', 'TITULO DE CONTADOR', 'TITULO DE OFICINISTA', 'TITULO DE SECRETARIADO COMERCIAL', 'TITULO DE TENEDOR DE LIBROS', 'TITULO DE TENEDOR DE LIBROS A CONTADOR', 'TURISMO DE MAR', 'TURISMO SOSTENIBLE'];

  F[52] = {
    preguntaNombre: '¿Los documentos están a tu nombre?',
    titulo: 'Ingreso de solicitudes',
    subtitulo: 'Cuéntanos quién solicita la certificación',
    campos: [
      { tipo: 'opciones', nombre: 'es_menor_edad', etiqueta: '¿El estudiante es menor de edad?', opciones: SI_NO },
      { tipo: 'nota', estilo: 'info', titulo: 'Nota', lineas: ['Indica tu parentesco con el estudiante'], si: 'es_menor_edad=si' },
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante', si: 'es_menor_edad=si' },
      { tipo: 'texto', nombre: 'documento_sol', etiqueta: 'Documento', si: 'es_menor_edad=si' },
      { tipo: 'lista', nombre: 'parentesco_con_estudiante', etiqueta: 'Parentesco con el estudiante', opciones: [['padre', 'Padre'], ['madre', 'Madre'], ['otro', 'Otro familiar']], si: 'es_menor_edad=si' },
      { tipo: 'texto', nombre: 'parentesco_otro', etiqueta: 'Especifica el parentesco', si: 'parentesco_con_estudiante=otro' },
      { tipo: 'nota', estilo: 'info', titulo: 'Nota', lineas: ['Ingresa el documento del interesado'], si: 'es_menor_edad=no' },
      { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento', si: 'es_menor_edad=no', opciones: [
        { valor: 'dui', texto: 'Documento Único de Identidad', detalle: 'DUI', icono: 'ph-identification-card' },
        { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-airplane-tilt' },
        { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento', si: 'es_menor_edad=no' }
    ],
    // MINEDUCYT (trámite 46): copiado hasta la certificación pedida, el último paso del portal (su "Siguiente" envía la
    // solicitud). Allá la institución se elige de una lista por departamento; aquí se busca al escribir
    pasos: [
      { titulo: 'Datos del estudiante', subtitulo: 'Escribe el nombre como aparece en los documentos', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Escribe el nombre que tenías cuando estudiabas'] },
        ...nombrePorPartes('', { obligatorio: true, casada: 'es_menor_edad=no', prellenarSi: 'es_menor_edad=no' }),
        { tipo: 'texto', nombre: 'nie_final', etiqueta: 'NIE', ayuda: 'Si estudiaste después de 2007', modo: 'numeric', patron: '[0-9]+', mensaje: 'Escribe solo números', opcional: true },
        { tipo: 'nota', estilo: 'info', lineas: ['La solicitud se atenderá según disponibilidad'] }
      ] },
      { titulo: 'Certificación', subtitulo: 'Dinos dónde estudiaste y qué grado necesitas', campos: [
        { tipo: 'nota', estilo: 'info', titulo: 'Grados que se atienden en línea', lineas: ['Según el artículo 64 de la Ley General de Educación, aquí se atienden las solicitudes del último grado de cada ciclo en educación básica y del último grado de bachillerato en educación media, según disponibilidad. Las de otros grados se piden en el centro educativo'] },
        { tipo: 'lista', nombre: 'departamento1', etiqueta: 'Departamento de la institución educativa', opciones: DEPARTAMENTOS },
        { tipo: 'texto', nombre: 'institucion1', etiqueta: 'Institución educativa', ayuda: 'Escribe para buscarla. Si no aparece, escribe el nombre completo', sugerencias: INSTITUCIONES },
        { tipo: 'lista', nombre: 'grado1', etiqueta: 'Grado', media: true, opciones: [['3', 'Tercer grado - educación básica'], ['6', 'Sexto grado - educación básica'], ['9', 'Noveno grado - educación básica'], ['11', 'Segundo año de bachillerato - educación media'], ['12', 'Tercer año de bachillerato - educación media']] },
        { tipo: 'texto', nombre: 'anio1', etiqueta: 'Año de estudio', placeholder: 'Año', max: 4, patron: '[0-9]{4}', modo: 'numeric', mensaje: 'Escribe el año con 4 números', media: true },
        { tipo: 'lista', nombre: 'opt1', etiqueta: 'Opción de bachillerato', opciones: OPCIONES_BACHILLERATO.map(b => [b, b]), si: 'grado1=11|12' }
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  F[53] = {
    titulo: 'Datos personales',
    subtitulo: 'Escribe los datos tal como aparecen en tu título',
    campos: [
      { tipo: 'texto', nombre: 'primer_nombre', etiqueta: 'Primer nombre (según título)', ayuda: 'Solo letras', patron: SOLO_LETRAS, mensaje: 'Escribe solo letras' },
      { tipo: 'texto', nombre: 'segundo_nombre', etiqueta: 'Segundo nombre (según título)', ayuda: 'Solo letras', patron: SOLO_LETRAS, mensaje: 'Escribe solo letras', opcional: true },
      { tipo: 'texto', nombre: 'primer_apellido', etiqueta: 'Primer apellido (según título)', ayuda: 'Solo letras', patron: SOLO_LETRAS, mensaje: 'Escribe solo letras' },
      { tipo: 'texto', nombre: 'segundo_apellido', etiqueta: 'Segundo apellido (según título)', ayuda: 'Solo letras', patron: SOLO_LETRAS, mensaje: 'Escribe solo letras', opcional: true },
      { tipo: 'texto', nombre: 'anio_de_graduacion', etiqueta: 'Año de estudio', placeholder: 'Año', max: 4, patron: '[0-9]{4}', modo: 'numeric', mensaje: 'Escribe el año con 4 números' },
      { tipo: 'texto', nombre: 'nieF', etiqueta: 'NIE', ayuda: 'Solo números', patron: '[0-9]+', modo: 'numeric', mensaje: 'Escribe solo números', opcional: true },
      { tipo: 'texto', nombre: 'folio', etiqueta: 'Folio', ayuda: 'Solo números', patron: '[0-9]+', modo: 'numeric', mensaje: 'Escribe solo números', opcional: true },
      { tipo: 'texto', nombre: 'numero', etiqueta: 'Número', ayuda: 'Solo números', patron: '[0-9]+', modo: 'numeric', mensaje: 'Escribe solo números', opcional: true },
      { tipo: 'seccion', titulo: 'Documento de identificación' },
      { tipo: 'lista', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento', opciones: [['dui', 'DUI'], ['pasaporte', 'Pasaporte'], ['carnet_de_menoridad', 'Carnet de menoridad']], opcional: true },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de documento', opcional: true },
      { tipo: 'archivo', nombre: 'copia_documento', etiqueta: 'Copia del documento por ambos lados', ayuda: 'Archivo en formato PDF', acepta: '.pdf', opcional: true },
      { tipo: 'archivo', nombre: 'otros_documentos', etiqueta: 'Otros documentos', ayuda: 'Puedes subir cualquier otro documento que ayude a validar tu identidad', acepta: ACEPTA_IMAGEN, opcional: true },
      { tipo: 'seccion', titulo: 'Estudios' },
      { tipo: 'lista', nombre: 'modalidad_de_estudio', etiqueta: 'Modalidad de estudio', opciones: [['Distancia', 'MF - Distancia'], ['Semipresencial', 'MF - Semipresencial'], ['Nocturna', 'MF - Nocturna'], ['Ed. Acelerada', 'MF - Ed. acelerada'], ['Virtual', 'MF - Virtual'], ['Integrada', 'MF - Integrada'], ['Regular', 'Regular']] },
      { tipo: 'lista', nombre: 'bachillerato_cursado_opcion', etiqueta: 'Estudios realizados', opciones: BACHILLERATOS.map(b => [b, b]) },
      { tipo: 'lista', nombre: 'departamento_estudios', etiqueta: 'Departamento donde realizaste tus estudios', opciones: DEPARTAMENTOS },
      { tipo: 'texto', nombre: 'municipio_estudios', etiqueta: 'Municipio donde realizaste tus estudios' },
      { tipo: 'texto', nombre: 'institucion', etiqueta: 'Institución donde cursó el bachillerato', ayuda: 'Escribe para buscarla. Si no aparece, escribe el nombre completo', sugerencias: INSTITUCIONES },
      { tipo: 'seccion', titulo: 'Información del solicitante' },
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante' },
      { tipo: 'texto', nombre: 'correo_de_solicitante', etiqueta: 'Correo del solicitante', modo: 'email' },
      { tipo: 'nota', estilo: 'info', titulo: 'Trámites en el exterior', lineas: ['Si necesitas la certificación para trámites en el exterior, preséntate a nuestras oficinas para dar seguimiento al proceso de auténtica: Edificio A3, 1.er nivel, Plan Maestro, Centro de Gobierno, Alameda Juan Pablo II y Calle Guadalupe, San Salvador, El Salvador'] }
    ],
    // MINEDUCYT (trámite 21): un solo paso en el portal; su "Siguiente" envía la solicitud
    pasos: [
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  F[55] = {
    titulo: 'Prospectos escolares',
    subtitulo: 'Revisa las indicaciones antes de continuar',
    campos: [
      { tipo: 'nota', estilo: 'requisitos', titulo: 'Requisitos del trámite', lineas: [
        '## Indicaciones',
        '- Ingresa todos los campos de este formulario con la información correspondiente a tu sede educativa',
        '- Lee detenidamente cada ítem y responde con cuidado',
        '- El prospecto a presentar debe contener lo indicado en el formato del Ministerio de Educación',
        'De conformidad con el artículo 82 de la Ley General de Educación, todos los centros privados de educación están en la obligación de presentar al Ministerio de Educación el prospecto escolar'
      ] }
    ],
    // MINEDUCYT (trámite 42): el segundo paso es el último del portal (su "Siguiente" envía la solicitud)
    pasos: [
      { titulo: 'Datos del centro educativo', subtitulo: 'Elige tu centro educativo y adjunta el prospecto', campos: [
        { tipo: 'lista', nombre: 'departamento_centro', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_centro', etiqueta: 'Municipio', depende: 'departamento_centro', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'texto', nombre: 'sede_educativa', etiqueta: 'Nombre del centro educativo', ayuda: 'Escribe el código o el nombre para buscarlo', sugerencias: CENTROS_EXISTENTES },
        { tipo: 'opciones', nombre: 'tipo_de_calendario', etiqueta: 'Tipo de calendario', opciones: [{ valor: 'nacional', texto: 'Nacional', icono: 'ph-flag' }, { valor: 'internacional', texto: 'Internacional', icono: 'ph-globe' }] },
        { tipo: 'opciones', nombre: 'fin_lucro', etiqueta: '¿Tu centro educativo tiene fines de lucro?', opciones: SI_NO },
        { tipo: 'seccion', titulo: 'Prospecto, planta docente y manual de convivencia' },
        { tipo: 'nota', estilo: 'info', lineas: ['Descarga el modelo de prospecto y la plantilla de Excel (planta docente, cuadro de cuotas y datos generales) en el portal del Ministerio de Educación'] },
        archivo('folleto', 'Folleto del prospecto', SOLO_PDF),
        archivo('manual_convivencia', 'Manual de convivencia', SOLO_PDF),
        archivo('plantilla_excel', 'Plantilla de Excel', { ayuda: 'Formato permitido: Excel (XLS o XLSX)', acepta: '.xls,.xlsx' }),
        { tipo: 'seccion', titulo: 'Contacto para notificaciones' },
        { tipo: 'opciones', nombre: 'is_solicitante', etiqueta: '¿A quién le avisamos?', opciones: [{ valor: 'solicitante', texto: 'Responsable del trámite', icono: 'ph-user' }, { valor: 'tercero', texto: 'Tercero autorizado', icono: 'ph-users' }] },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante', soloLectura: true, media: true, si: 'is_solicitante=solicitante' },
        { tipo: 'texto', nombre: 'correo_de_solicitante', etiqueta: 'Correo del solicitante', modo: 'email', soloLectura: true, media: true, si: 'is_solicitante=solicitante' },
        { tipo: 'texto', nombre: 'nombre_del_contacto', etiqueta: 'Nombre del contacto', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: 'is_solicitante=tercero' },
        { tipo: 'texto', nombre: 'correo_contacto', etiqueta: 'Correo electrónico', modo: 'email', media: true, si: 'is_solicitante=tercero' },
        { tipo: 'texto', nombre: 'repetir_correo', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_contacto', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true, si: 'is_solicitante=tercero' },
        { ...TELEFONO, nombre: 'telefono_de_contacto', etiqueta: 'Teléfono de contacto' }
      ] },
      { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] }
    ]
  };

  /* ===== Documentos (catálogo) ===== */
  // Trámites gratis: el último "Siguiente" del portal envía la solicitud; aquí termina en la revisión
  const ENVIAR = { ...REVISION, subtitulo: 'Confirma que todo esté bien antes de enviarla', boton: 'Enviar solicitud', campos: [{ tipo: 'resumen', titulo: 'Tu solicitud', icono: 'ph-list-checks' }] };
  const FORMATO_DUI = { placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]', mensaje: 'Escribe el DUI con el formato 00000000-0' };
  const FACTURA_TELEFONO = { tipo: 'texto', modo: 'tel', placeholder: '7000-1234', patron: '(\\+503 ?)?[2-7][0-9]{3}-?[0-9]{4}', mensaje: 'Escribe un teléfono de 8 dígitos, por ejemplo 7000-1234' };

  // MDN (mdn.ventanilla.simple.sv, trámite 54): para quién es la constancia y, en el segundo paso (el último del portal), los
  // datos de quien la pide, el registro de arma y el domicilio. Para un tercero, el portal trae el nombre del titular desde su DUI
  // y pide el poder; aquí el nombre se escribe
  const PARA_TERCERO = 'a_nombre_de=tercero';
  F[95] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Cuéntanos para quién es la constancia',
    campos: [
      { tipo: 'opciones', nombre: 'a_nombre_de', etiqueta: 'La constancia de homónimos es', opciones: [
        { valor: 'mi_nombre', texto: 'Para mí', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Para otra persona', icono: 'ph-users' }
      ] },
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Tu número de DUI', soloLectura: true, si: 'a_nombre_de=mi_nombre' },
      { tipo: 'texto', nombre: 'dui_del_titular', etiqueta: 'DUI de la persona titular', ...FORMATO_DUI, si: PARA_TERCERO }
    ],
    pasos: [
      { titulo: 'Identificación del solicitante', subtitulo: 'Revisa tus datos y cuéntanos dónde vives', campos: [
        { tipo: 'seccion', titulo: 'Tus datos', si: 'a_nombre_de=mi_nombre' },
        { tipo: 'seccion', titulo: 'Datos de quien realiza el trámite', si: PARA_TERCERO },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true, media: true },
        { tipo: 'archivo', nombre: 'poder_tercero', etiqueta: 'Poder o autorización especial', ayuda: 'Te faculta para iniciar el trámite, hacer consultas y recibir la constancia. ' + FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: PARA_TERCERO },
        { tipo: 'seccion', titulo: 'Datos de la persona titular', si: PARA_TERCERO },
        { tipo: 'texto', nombre: 'nombre_del_titular', etiqueta: 'Nombre completo', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: PARA_TERCERO },
        { tipo: 'texto', nombre: 'correo_del_titular', etiqueta: 'Correo electrónico', modo: 'email', media: true, si: PARA_TERCERO },
        { tipo: 'texto', nombre: 'confirmar_correo_titular', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_del_titular', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true, si: PARA_TERCERO },
        { tipo: 'seccion', titulo: 'Registro de arma y domicilio' },
        { tipo: 'opciones', nombre: 'tiene_registro_de_arma', etiqueta: '¿Tienes registro de arma?', ayuda: 'Si haces el trámite para otra persona, responde por ella', opciones: SI_NO },
        { tipo: 'texto', nombre: 'numero_de_registro', etiqueta: 'Número de registro de arma', si: 'tiene_registro_de_arma=si' },
        { tipo: 'lista', nombre: 'departamento_mdn', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_mdn', etiqueta: 'Municipio', depende: 'departamento_mdn', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'texto', nombre: 'direccion_titular', etiqueta: 'Dirección completa', ayuda: 'Calle o avenida, número de casa, edificio o apartamento, y colonia o barrio' },
        { ...FACTURA_TELEFONO, nombre: 'telefono_de_contacto', etiqueta: 'Teléfono de contacto' }
      ] },
      ENVIAR
    ]
  };

  // MDN (trámite 462): tras el tipo de personería, el portal pide los datos de la factura y cobra $11.00; lo demás de la
  // solicitud llega después del pago. Su casilla "Si los datos son correctos, selecciona la casilla de confirmación" la cubre
  // aquí la revisión
  F[96] = {
    titulo: 'Tipo de personería',
    subtitulo: 'Cuéntanos en qué calidad haces el trámite',
    campos: [
      { tipo: 'opciones', nombre: 'mdn_tipopersona', etiqueta: '¿En qué calidad actúas?', opciones: [
        { valor: 'propietario', texto: 'Personal', icono: 'ph-user' },
        { valor: 'tercero-autorizado', texto: 'Tercero autorizado', icono: 'ph-users' }
      ] },
      { tipo: 'texto', nombre: 'dui_representarmdn', etiqueta: 'DUI de la persona que representas', ...FORMATO_DUI, si: 'mdn_tipopersona=tercero-autorizado' }
    ],
    pasos: [
      { titulo: 'Datos de facturación', subtitulo: 'Escribe los datos para tu factura', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del consumidor final', patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'DUI', ...FORMATO_DUI, media: true },
        { ...FACTURA_TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo donde quieres recibir tu factura', modo: 'email' },
        { tipo: 'texto', nombre: 'direccion_factura', etiqueta: 'Dirección' }
      ] },
      REVISION,
      { ...PAGO, monto: '$11.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $11.00 con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'Después del pago sigues con los datos de tu solicitud de devolución'] },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Termina el pago por completo para que tu trámite aparezca en Mis documentos', 'Si algo falla, no inicies otro trámite ni vuelvas a pagar: escribe a contacto@simple.sv con tu nombre y tu número de DUI', 'Nunca compartas los datos de tu tarjeta por correo o WhatsApp'] }
      ] }
    ]
  };

  // IAIP (iaip.ventanilla.simple.sv, trámite 360): a título personal o para un tercero y, en el segundo paso, los datos de
  // contacto y la institución donde trabajas. Es el último paso que se ve sin guardarlo: copiado hasta ahí
  F[104] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Cuéntanos para quién es la solvencia',
    campos: [
      { tipo: 'opciones', nombre: 'tipousuario', etiqueta: 'Estás pidiendo el trámite', opciones: [
        { valor: 'personal', texto: 'A título personal', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Para otra persona', icono: 'ph-users' }
      ] },
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Tu número de DUI', soloLectura: true, si: 'tipousuario=personal' },
      { tipo: 'texto', nombre: 'dui_tercero', etiqueta: 'DUI de la persona que representas', ayuda: 'No puede ser el tuyo', ...FORMATO_DUI, si: 'tipousuario=tercero' },
      { tipo: 'archivo', nombre: 'autorizacion_tercero', etiqueta: 'Documento de autorización o poder', ayuda: 'Formato permitido: PDF, de hasta 15 MB', acepta: '.pdf', si: 'tipousuario=tercero' }
    ],
    pasos: [
      { titulo: 'Tus datos', subtitulo: 'Revisa tus datos y cuéntanos dónde trabajas', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, si: 'tipousuario=personal' },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
        { ...FACTURA_TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
        { tipo: 'nota', estilo: 'info', lineas: ['Adjunta tu NIT si no está homologado con tu DUI'] },
        { tipo: 'archivo', nombre: 'nit', etiqueta: 'NIT', ayuda: FORMATOS_IMAGEN + ', de hasta 15 MB', acepta: ACEPTA_IMAGEN, opcional: true },
        { tipo: 'seccion', titulo: 'Institución' },
        { tipo: 'texto', nombre: 'nombre_institucion', etiqueta: 'Nombre completo de la institución' },
        { tipo: 'texto', nombre: 'tipo_de_institucion', etiqueta: 'Tipo de institución', media: true },
        { tipo: 'texto', nombre: 'cargo', etiqueta: 'Cargo', media: true }
      ] },
      ENVIAR
    ]
  };

  // TEG (teg.ventanilla.simple.sv, trámite 412): datos del solicitante y de la entidad que representa, y el tipo de constancia.
  // Es el último paso que se ve (con la entidad guardada no aparece otro): copiado hasta ahí
  const ENTIDAD_TEG = (valor, campos) => campos.map(c => ({ ...c, si: 'instancia=' + valor }));
  F[110] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Revisa tus datos y cuéntanos a quién representas',
    campos: [
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true },
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'DUI', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'edad', etiqueta: 'Edad', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión u oficio', media: true },
      { ...FACTURA_TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email' },
      { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección', ayuda: 'Calle, avenida, pasaje y número de casa' },
      { tipo: 'opciones', nombre: 'instancia', etiqueta: '¿A quién representas?', dosColumnas: true, opciones: [
        { valor: 'privada', texto: 'Empresa privada', icono: 'ph-buildings' },
        { valor: 'ong', texto: 'ONG, academia u organismo sin fines de lucro', icono: 'ph-hand-heart' },
        { valor: 'gob', texto: 'Instancia de gobierno', icono: 'ph-bank' },
        { valor: 'personal', texto: 'Ninguna, es a título personal', icono: 'ph-user' }
      ] },
      ...ENTIDAD_TEG('privada', [
        { tipo: 'seccion', titulo: 'Empresa privada' },
        { tipo: 'texto', nombre: 'nom_priv', etiqueta: 'Nombre de la empresa', media: true },
        { tipo: 'texto', nombre: 'propietario1', etiqueta: 'Nombre del propietario', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'nit_priv', etiqueta: 'NIT', modo: 'numeric', media: true },
        { tipo: 'texto', nombre: 'nrc_priv', etiqueta: 'NRC', modo: 'numeric', media: true },
        { tipo: 'texto', nombre: 'giro_priv', etiqueta: 'Giro o razón social', media: true },
        { ...FACTURA_TELEFONO, nombre: 'telefono_priv', etiqueta: 'Teléfono de oficina', media: true },
        { tipo: 'texto', nombre: 'direccion_priv', etiqueta: 'Dirección de la oficina' }
      ]),
      ...ENTIDAD_TEG('ong', [
        { tipo: 'seccion', titulo: 'ONG, academia u organismo' },
        { tipo: 'texto', nombre: 'nombre_ong', etiqueta: 'Nombre de la ONG, academia u organismo', media: true },
        { tipo: 'texto', nombre: 'nom_ong', etiqueta: 'Propietario, socio fundador o titular', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'nit_ong', etiqueta: 'NIT', modo: 'numeric', media: true },
        { tipo: 'texto', nombre: 'giro_ong', etiqueta: 'Giro o razón social', media: true },
        { ...FACTURA_TELEFONO, nombre: 'telefono_ong', etiqueta: 'Teléfono de oficina', media: true },
        { tipo: 'texto', nombre: 'direccion_oficina_ong', etiqueta: 'Dirección de la oficina', media: true },
        { tipo: 'opciones', nombre: 'quien_solicita_ong', etiqueta: '¿Quién hace la solicitud?', opciones: [
          { valor: 'propietario_ong', texto: 'Propietario', icono: 'ph-user' },
          { valor: 'tercero_ong', texto: 'Tercero autorizado', icono: 'ph-users' }
        ] }
      ]),
      { tipo: 'archivo', nombre: 'autorizacion_ong', etiqueta: 'Documento de autorización', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: 'quien_solicita_ong=tercero_ong' },
      ...ENTIDAD_TEG('gob', [
        { tipo: 'seccion', titulo: 'Instancia de gobierno' },
        { tipo: 'texto', nombre: 'nombre_insti_gob', etiqueta: 'Nombre de la institución', media: true },
        { tipo: 'texto', nombre: 'giro_gob', etiqueta: 'Giro o razón social', media: true },
        { tipo: 'texto', nombre: 'nit_insti_gob', etiqueta: 'NIT de la institución', modo: 'numeric', media: true },
        { ...FACTURA_TELEFONO, nombre: 'telefono_gob', etiqueta: 'Teléfono de oficina', media: true },
        { tipo: 'texto', nombre: 'direccion_ofi_gob', etiqueta: 'Dirección de la oficina' },
        { tipo: 'archivo', nombre: 'acreditacion_gob', etiqueta: 'Documento que acredita que puedes pedir la constancia', ayuda: 'Por ejemplo, una resolución administrativa, un decreto o un poder. ' + FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN }
      ])
    ],
    pasos: [
      { titulo: 'Tipo de constancia', subtitulo: 'Elige la constancia que necesitas y su formato', campos: [
        { tipo: 'opciones', nombre: 'tipo_solvencia', etiqueta: 'Tipo de constancia', columna: true, opciones: [
          { valor: 'solvencia_sanciones', texto: 'Constancia de sancionado o no sancionado', icono: 'ph-scales' },
          { valor: 'solvencia_procesos', texto: 'Constancia de procedimientos en trámite', icono: 'ph-folder-open' },
          { valor: 'ambas_solvencias', texto: 'Ambas constancias', icono: 'ph-files' }
        ] },
        { tipo: 'opciones', nombre: 'formato_constancia', etiqueta: 'Formato de la constancia', opciones: [
          { valor: 'digital', texto: 'Digital', icono: 'ph-file-pdf' },
          { valor: 'fisica', texto: 'Física', icono: 'ph-printer' }
        ] },
        { tipo: 'nota', estilo: 'info', lineas: ['Las constancias físicas se retiran en las oficinas del TEG: 87 Avenida Sur, n.º 7, colonia Escalón'], si: 'formato_constancia=fisica' },
        { tipo: 'opciones', nombre: 'individual_o_multiple', etiqueta: '¿La constancia es para una persona o para varias?', si: 'instancia!=personal', opciones: [
          { valor: 'individual', texto: 'Constancia individual', icono: 'ph-user' },
          { valor: 'multiple', texto: 'Constancia múltiple', icono: 'ph-users-three' }
        ] }
      ] },
      ENVIAR
    ]
  };

  // Municipios de cada departamento después de la reforma de 2024, como los lista la Defensoría del Consumidor
  const MUNICIPIOS_2024 = Object.fromEntries(Object.entries({
    '01': 'Norte,Centro,Sur', '02': 'Norte,Centro,Este,Oeste', '03': 'Norte,Centro,Este,Oeste', '04': 'Norte,Centro,Sur',
    '05': 'Norte,Centro,Oeste,Este,Costa,Sur', '06': 'Norte,Oeste,Este,Centro,Sur', '07': 'Norte,Sur', '08': 'Oeste,Centro,Este',
    '09': 'Este,Oeste', '10': 'Norte,Sur', '11': 'Norte,Este,Oeste', '12': 'Norte,Centro,Oeste', '13': 'Norte,Sur', '14': 'Norte,Sur'
  }).map(([d, zonas]) => {
    const nombre = DEPARTAMENTOS.find(([codigo]) => codigo === d)[1];
    return [d, zonas.split(',').map((z, i) => [d + String(i + 1).padStart(2, '0'), nombre + ' ' + z])];
  }));
  // Defensoría del Consumidor (defensoria.ventanilla.simple.sv, trámite 352): tipo de persona y calidad y, en el segundo paso
  // (el último), los datos de registro y del caso; el de persona jurídica pide los de la sociedad y su representante
  const OFICINAS_DEFENSORIA = [['oficina_sansalvador', 'Oficina Central (San Salvador)'], ['oficina_antiguocuscatlan', 'Oficina Plan de la Laguna (Antiguo Cuscatlán)'], ['oficina_santaana', 'Oficina Regional Occidente (Santa Ana)'], ['oficina_sanmiguel', 'Oficina Regional Oriente (San Miguel)'], ['oficina_virtual', 'Oficina Virtual']];
  const NATURAL = 'tipo_persona=persona_natural';
  const JURIDICA = 'tipo_persona=persona_juridica';
  // s: sufijo de los nombres, porque va en la rama de persona natural y en la de jurídica (la lista que depende de otra la busca por nombre)
  const domicilioDefensoria = (etiqueta, si, s = '') => [
    { tipo: 'lista', nombre: 'departamento_defensoria' + s, etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true, si },
    { tipo: 'lista', nombre: 'municipio_defensoria' + s, etiqueta: 'Municipio', depende: 'departamento_defensoria' + s, opcionesPor: MUNICIPIOS_2024, media: true, si },
    { tipo: 'texto', nombre: 'direccion_defensoria' + s, etiqueta, si }
  ];
  F[112] = {
    titulo: 'Tipo de persona',
    subtitulo: 'Cuéntanos quién pide la constancia',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'calidad_natural', etiqueta: '¿En qué calidad actúas?', si: NATURAL, opciones: [
        { valor: 'personal', texto: 'Personal', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Por otra persona', icono: 'ph-users' }
      ] },
      { tipo: 'opciones', nombre: 'calidad_juridico', etiqueta: '¿En qué calidad actúas?', si: JURIDICA, opciones: [
        { valor: 'representante_legal', texto: 'Representante legal', icono: 'ph-identification-badge' },
        { valor: 'apoderado_o_autorizado', texto: 'Apoderado o autorizado', icono: 'ph-file-text' }
      ] },
      { tipo: 'opciones', nombre: 'tipo_documento_tercero', etiqueta: 'Tipo de documento de la persona titular', compacto: true, si: 'calidad_natural=tercero', opciones: [
        { valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet_de_residencia', texto: 'Carnet de residencia' }
      ] },
      { tipo: 'texto', nombre: 'documento_titular_tercero', etiqueta: 'Número de documento de la persona titular', si: 'calidad_natural=tercero' },
      { tipo: 'texto', nombre: 'nit_publico', etiqueta: 'NIT de la empresa', modo: 'numeric', placeholder: '0000-000000-000-0', si: JURIDICA }
    ],
    pasos: [
      { titulo: 'Datos del registro', subtitulo: 'Revisa tus datos y escribe el número de tu caso', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, media: true, si: NATURAL },
        { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'DUI', soloLectura: true, media: true, si: NATURAL },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true, si: NATURAL },
        { ...FACTURA_TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true, si: NATURAL },
        ...domicilioDefensoria('Dirección', NATURAL),
        { tipo: 'seccion', titulo: 'Datos de la sociedad, asociación o cooperativa', si: JURIDICA },
        { tipo: 'texto', nombre: 'razon_o_denominacion_jrl', etiqueta: 'Razón o denominación social', media: true, si: JURIDICA },
        { tipo: 'texto', nombre: 'nombre_comercial_empresa_jrl', etiqueta: 'Nombre comercial', media: true, si: JURIDICA },
        { tipo: 'texto', nombre: 'nombre_de_titular_jrl', etiqueta: 'Nombre del titular', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: JURIDICA },
        { tipo: 'texto', nombre: 'correo_empresa_jrl', etiqueta: 'Correo electrónico de la empresa', modo: 'email', media: true, si: JURIDICA },
        { ...FACTURA_TELEFONO, nombre: 'telefono_jrl', etiqueta: 'Teléfono', media: true, si: JURIDICA },
        { tipo: 'seccion', titulo: 'Representante legal', si: JURIDICA },
        { tipo: 'texto', nombre: 'nombre_representante_jrl', etiqueta: 'Nombre del representante legal', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: JURIDICA },
        { tipo: 'archivo', nombre: 'credencial_jrl', etiqueta: 'Credencial vigente', ayuda: FORMATOS_IMAGEN, acepta: ACEPTA_IMAGEN, si: JURIDICA },
        { tipo: 'archivo', nombre: 'personeria_jrl', etiqueta: 'Documento que acredita la personería del representante legal', ayuda: 'Formato permitido: PDF', acepta: '.pdf', si: JURIDICA },
        { tipo: 'seccion', titulo: 'Dirección de la empresa', si: JURIDICA },
        ...domicilioDefensoria('Dirección de la empresa', JURIDICA, '_jrl'),
        { tipo: 'seccion', titulo: 'Datos del caso' },
        { tipo: 'texto', nombre: 'nombre_del_consumidor_jrl', etiqueta: 'Nombre del consumidor', patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: JURIDICA },
        { tipo: 'texto', nombre: 'caso_numero', etiqueta: 'Número de caso', media: true },
        { tipo: 'lista', nombre: 'oficina_atendio_caso', etiqueta: 'Oficina que atendió el caso', opciones: OFICINAS_DEFENSORIA, media: true }
      ] },
      ENVIAR
    ]
  };

  // Caja Mutual (cajamutual.ventanilla.simple.sv, trámite 346): un solo paso, cuyo "Siguiente" envía la solicitud
  F[114] = {
    titulo: 'Solicitud de historial de pagos',
    subtitulo: 'Elige el seguro del que necesitas el historial',
    campos: [
      { tipo: 'nota', estilo: 'info', lineas: ['El historial incluye tus pagos de los últimos 5 años'] },
      { tipo: 'opciones', nombre: 'tipo_de_seguro', etiqueta: 'Tipo de seguro', columna: true, opciones: [
        { valor: 'seguro_de_vida_opcional', texto: 'Seguro de vida opcional', icono: 'ph-heartbeat' },
        { valor: 'seguro_de_vida_dotal', texto: 'Seguro de vida dotal', icono: 'ph-piggy-bank' },
        { valor: 'seguro_por_sepelio', texto: 'Seguro por sepelio', icono: 'ph-flower-lotus' }
      ] }
    ],
    pasos: [ENVIAR]
  };

  /* ===== Educación: ENA (catálogo) ===== */
  // ENA (ena.ventanilla.simple.sv). Los datos de quien solicita salen de su cuenta y no se cambian. En la certificación de
  // notas (trámite 83) y en el reingreso (339), el pago es el paso siguiente de la misma etapa; en la constancia de estudios
  // (270) la etapa tiene un solo paso y el pago llega en la siguiente (no se avanzó para no enviar la solicitud).
  const DATOS_ENA = [
    { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true },
    { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true },
    { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Documento Único de Identidad', soloLectura: true },
    { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true }
  ];
  const CONFIRMO_ENA = { tipo: 'opciones', nombre: 'confirmacion_de_solicitud', etiqueta: 'Confirmación de solicitud', marcado: true, opciones: [{ valor: 'confirmo', texto: 'Confirmo que la información ingresada es verdadera', icono: 'ph-check-circle' }] };
  const AVISO_PAGO_ENA = { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Termina el pago por completo para que tu trámite aparezca en Mis documentos', 'Si algo falla después de pagar, no inicies otro trámite: escribe a contacto@simple.sv con tu nombre y tu número de DUI'] };
  // Promociones de la ENA: hasta la 27 duraban cuatro años (1956-1959) y desde la 28, tres (1984-1986)
  const PROMOCIONES_ENA = Array.from({ length: 68 }, (_, i) => {
    const promo = i + 1;
    const inicio = promo <= 27 ? 1955 + promo : 1956 + promo;
    const texto = `${inicio}-${inicio + (promo <= 27 ? 3 : 2)} (Promo ${promo})`;
    return [texto, texto];
  });
  const ANIOS_DE_ESTUDIO = [['Primer año', 'Primer año'], ['Segundo año', 'Segundo año'], ['Tercer año', 'Tercer año']];

  F[85] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Revisa tus datos y cuéntanos de tu promoción',
    campos: [
      { tipo: 'desplegable', titulo: 'Tus datos', icono: 'ph-user-circle', abierto: true, comoFilas: true },
      ...DATOS_ENA,
      { tipo: 'finDesplegable' },
      { tipo: 'lista', nombre: 'ao_de_graduacion', etiqueta: 'Periodo de estudios', opciones: PROMOCIONES_ENA },
      { tipo: 'lista', nombre: 'para_ser_utilizado_en', etiqueta: 'Para ser utilizado en', opciones: [['Trabajo', 'Trabajo'], ['Becas', 'Becas'], ['Continuar_estudios', 'Continuar estudios']] },
      CONFIRMO_ENA
    ],
    pasos: [
      REVISION,
      { ...PAGO, monto: '$10.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $10.00 con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'Si tu certificación no tiene observaciones, después de pagar la descargas. Si las tiene, pasa a revisión y verás el resultado en los próximos 5 días hábiles'] },
        AVISO_PAGO_ENA
      ] }
    ]
  };

  F[86] = {
    titulo: 'Datos generales',
    subtitulo: 'Cuéntanos de tus estudios en la ENA',
    campos: [
      { tipo: 'opciones', nombre: 'estudiante_activo', etiqueta: '¿Eres estudiante activo?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'codigo_estudiante', etiqueta: 'Código de estudiante', ayuda: 'Por ejemplo 202300001', modo: 'numeric', max: 12, patron: '[0-9]+', mensaje: 'Escribe solo números', si: 'estudiante_activo=si' },
      { tipo: 'nota', estilo: 'info', lineas: [`La constancia es del año ${new Date().getFullYear()}`], si: 'estudiante_activo=si' },
      { tipo: 'lista', nombre: 'ao_de_estudio', etiqueta: 'Año de estudio', opciones: ANIOS_DE_ESTUDIO, media: true, si: 'estudiante_activo=si' },
      { tipo: 'lista', nombre: 'ciclo_estudio', etiqueta: 'Ciclo de estudio', opciones: [['Ciclo I', 'Ciclo I'], ['Ciclo II', 'Ciclo II']], media: true, si: 'estudiante_activo=si' }
    ],
    pasos: [
      REVISION,
      { ...PAGO, monto: '$5.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $5.00 con tarjeta de crédito o débito en la pasarela segura de SERFINSA'] },
        AVISO_PAGO_ENA
      ] }
    ]
  };

  const PARA_TERCERO_ENA = 'para_quien=tercero';
  const WHATSAPP_ENA = [{ valor: 'si', texto: 'Sí', icono: 'ph-whatsapp-logo' }, { valor: 'no', texto: 'No, solo puedo hacer y recibir llamadas', icono: 'ph-phone' }];
  F[87] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Cuéntanos para quién es el reingreso',
    campos: [
      { tipo: 'opciones', nombre: 'para_quien', etiqueta: '¿Para quién se realizará el trámite?', opciones: [
        { valor: 'personal', texto: 'Para mí', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Para un tercero', icono: 'ph-users' }
      ] },
      { tipo: 'nota', estilo: 'info', lineas: ['Si la persona solicitante es menor de edad, llena la solicitud con la ayuda de un responsable a cargo'], si: PARA_TERCERO_ENA }
    ],
    pasos: [
      { titulo: 'Tus datos', subtitulo: 'Revisa tus datos y dinos cómo contactarte', campos: [
        { tipo: 'seccion', titulo: 'Datos personales', si: 'para_quien=personal' },
        { tipo: 'seccion', titulo: 'Datos del responsable', si: PARA_TERCERO_ENA },
        ...DATOS_ENA,
        { tipo: 'opciones', nombre: 'posee_whatsapp', etiqueta: '¿Tu número de teléfono tiene WhatsApp?', opciones: WHATSAPP_ENA },
        { ...TELEFONO, nombre: 'numero_fijo', etiqueta: 'Número fijo', placeholder: '2200-1234', opcional: true, media: true },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Número de celular', media: true },
        { tipo: 'seccion', titulo: 'Datos del menor de edad', si: PARA_TERCERO_ENA },
        { tipo: 'texto', nombre: 'nombre_del_alumno', etiqueta: 'Nombre completo del alumno', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: PARA_TERCERO_ENA },
        { tipo: 'opciones', nombre: 'posee_correo', etiqueta: '¿El menor de edad tiene correo electrónico?', opciones: SI_NO, si: PARA_TERCERO_ENA },
        { tipo: 'texto', nombre: 'correo_electronico', etiqueta: 'Correo electrónico', modo: 'email', media: true, si: 'posee_correo=si' },
        { tipo: 'texto', nombre: 'confirmar_correo_electronico', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_electronico', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true, si: 'posee_correo=si' },
        { tipo: 'opciones', nombre: 'posee_celular_menor', etiqueta: '¿El menor de edad tiene número de celular?', opciones: SI_NO, si: PARA_TERCERO_ENA },
        { ...TELEFONO, nombre: 'numero_celular_menor', etiqueta: 'Número de celular del menor', si: 'posee_celular_menor=si' },
        { tipo: 'opciones', nombre: 'posee_whatsapp_menor', etiqueta: '¿Ese número tiene WhatsApp?', opciones: WHATSAPP_ENA, si: PARA_TERCERO_ENA }
      ] },
      { titulo: 'Datos del retiro', subtitulo: 'Cuéntanos cuándo y por qué te retiraste', campos: [
        { tipo: 'lista', nombre: 'ao_de_retiro', etiqueta: 'Año en que se retiró', opciones: Array.from({ length: 11 }, (_, i) => [String(2016 + i), String(2016 + i)]), tercio: true },
        { tipo: 'lista', nombre: 'ciclo_estudio', etiqueta: 'Ciclo de estudio', opciones: ['I', 'II', 'III', 'IV', 'V', 'VI'].map(c => [`CICLO ${c}`, `Ciclo ${c}`]), tercio: true },
        { tipo: 'lista', nombre: 'ao_de_estudio', etiqueta: 'Año de estudio en que se retiró', opciones: ANIOS_DE_ESTUDIO.map(([, texto]) => [texto.toUpperCase(), texto]), tercio: true },
        { tipo: 'texto', nombre: 'medio_solicito', etiqueta: 'Por este medio solicito', max: 500 },
        { tipo: 'texto', nombre: 'motivo_de_retiro', etiqueta: 'Motivo por el que se retiró de la institución', max: 500 },
        CONFIRMO_ENA
      ] },
      REVISION,
      { ...PAGO, monto: '$5.00', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Pagas $5.00 con tarjeta de crédito o débito en la pasarela segura de SERFINSA', 'Este valor es solo un arancel por evaluar tu solicitud: no significa que se apruebe. Si el resultado es no factible, no hay devolución'] },
        AVISO_PAGO_ENA
      ] }
    ]
  };

  /* ===== Aviación civil: AAC (catálogo) ===== */
  // AAC (aac.ventanilla.simple.sv). Todos piden el tipo de solicitud, los datos de quien solicita (de su cuenta) y adjuntos
  // en PDF. Varias condiciones del portal apuntan a campos que no existen y nunca se cumplen: esos campos no se copiaron.
  // En las renovaciones y reposiciones el "tipo de trámite" viene oculto y ya marcado, así que aquí no se pregunta.
  // En las tarifas (128), las certificaciones de expedientes y extractadas (130, 131) y el permiso de piloto estudiante
  // (79), el pago sigue en la misma etapa: una nota (10 minutos para pagar) y tarjeta o mandamiento de pago. En los demás
  // la etapa termina con los adjuntos y la AAC los revisa antes del pago. Aquí se paga al final; en la fianza (126), la
  // póliza (127) y las Opspecs (369), el monto lo calcula la AAC al revisar, así que solo se envía la solicitud.
  const PDF_AAC = (nombre, etiqueta, ayuda = '', extra = {}) => ({ tipo: 'archivo', nombre, etiqueta, ayuda: ayuda ? `${ayuda}. Formato PDF` : 'Formato PDF', acepta: '.pdf', ...extra });
  const FOTO_AAC = (ayuda, extra = {}) => ({ tipo: 'archivo', nombre: 'fotografia', etiqueta: 'Fotografía', ayuda, acepta: '.jpg,.jpeg', ...extra });
  const FOTO_FRENTE = 'De frente, con los hombros visibles y el fondo claro y uniforme. Formato JPG';
  const CAMBIAR_FOTO_AAC = [
    { tipo: 'opciones', nombre: 'cambiar_fotografia', etiqueta: '¿Quieres cambiar tu fotografía?', opciones: SI_NO },
    FOTO_AAC(FOTO_FRENTE, { si: 'cambiar_fotografia=si' })
  ];
  const NOMBRE_AAC = [
    { tipo: 'texto', nombre: 'primer_nombre', etiqueta: 'Primer nombre', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'segundo_nombre', etiqueta: 'Segundo nombre', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'primer_apellido', etiqueta: 'Primer apellido', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'segundo_apellido', etiqueta: 'Segundo apellido', soloLectura: true, media: true }
  ];
  const DUI_CUENTA_AAC = { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Documento Único de Identidad (DUI)', soloLectura: true };
  const CONTACTO_AAC = [
    { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
    { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true }
  ];
  const CONFIRMAR_CORREO_AAC = { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Las direcciones de correo electrónico no coinciden' };
  const DOMICILIO_AAC = [
    { tipo: 'lista', nombre: 'departamento', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
    { tipo: 'lista', nombre: 'municipio', etiqueta: 'Municipio', depende: 'departamento', opcionesPor: MUNICIPIOS, media: true },
    { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección completa', ayuda: 'Calle, avenida, pasaje y número de casa', max: 200 }
  ];
  const FECHA_AAC = (nombre, etiqueta, extra = {}) => ({ tipo: 'texto', nombre, etiqueta, placeholder: 'DD-MM-AAAA', max: 10, patron: '(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-(19|20)[0-9]{2}', mensaje: 'Escribe la fecha con el formato DD-MM-AAAA', ...extra });
  const NIT_AAC = { placeholder: '0000-000000-000-0', max: 17, patron: '[0-9]{4}-?[0-9]{6}-?[0-9]{3}-?[0-9]', mensaje: 'Escribe el NIT con el formato 0000-000000-000-0' };
  const NRC_AAC = { placeholder: '000000-0', max: 10, patron: '[0-9]{1,7}-?[0-9]', mensaje: 'Escribe el NRC, por ejemplo 123456-7' };
  const MONTO_AAC = { modo: 'numeric', placeholder: '0.00', patron: '[0-9]+([.,][0-9]{1,2})?', mensaje: 'Escribe solo el monto en números, por ejemplo 15000.00' };

  const SOLICITADO_AAC = { tipo: 'opciones', nombre: 'tramite_solicitado', etiqueta: 'Trámite solicitado', opciones: [
    { valor: 'inscripcion', texto: 'Inscripción', icono: 'ph-pen-nib' },
    { valor: 'anotacion_preventiva', texto: 'Anotación preventiva', icono: 'ph-note-pencil' }
  ] };
  const PROPIETARIO_DEL_DOCUMENTO = { propietario: 'Propietario', detalle: 'Solo si eres el propietario del documento que solicitas' };
  const CALIDAD_AAC = ({ propietario = 'Propietario', detalle, otro = true } = {}) => [
    { tipo: 'opciones', nombre: 'calidad_del_solicitante', etiqueta: 'Calidad del solicitante', opciones: [
      { valor: 'propietario', texto: propietario, detalle, icono: 'ph-user' },
      { valor: 'representante_legal', texto: 'Representante legal', icono: 'ph-briefcase' },
      { valor: 'apoderado', texto: 'Apoderado', icono: 'ph-scroll' },
      ...(otro ? [{ valor: 'otro', texto: 'Otro', icono: 'ph-dots-three' }] : [])
    ] },
    ...(otro ? [{ tipo: 'texto', nombre: 'otro_calidad', etiqueta: 'Especifica tu calidad', max: 100, si: 'calidad_del_solicitante=otro' }] : [])
  ];
  const NO_PROPIETARIO = 'calidad_del_solicitante!=propietario';
  const TIPO_DOC_EMPRESA_AAC = (si) => ({ tipo: 'opciones', nombre: 'tipo_documento_empresa', etiqueta: 'Tipo de documento', opciones: [{ valor: 'nit', texto: 'NIT', icono: 'ph-identification-card' }, { valor: 'nrc', texto: 'NRC', icono: 'ph-file-text' }], ...(si ? { si } : {}) });
  // La persona o sociedad dueña del documento, cuando quien solicita no lo es (certificaciones y pólizas)
  const PROPIETARIO_AAC = [
    { tipo: 'seccion', titulo: 'Datos del propietario', si: NO_PROPIETARIO },
    { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona propietaria', opciones: [{ valor: 'natural', texto: 'Natural', icono: 'ph-user' }, { valor: 'juridica', texto: 'Jurídica', icono: 'ph-buildings' }], si: NO_PROPIETARIO },
    TIPO_DOC_EMPRESA_AAC(NO_PROPIETARIO),
    { tipo: 'texto', nombre: 'dui_propietaria', etiqueta: 'DUI de la persona propietaria', ...FORMATO_DUI, si: NO_PROPIETARIO },
    { tipo: 'texto', nombre: 'nit', etiqueta: 'Número de Identificación Tributaria (NIT)', ...NIT_AAC, media: true, si: 'tipo_persona=juridica' },
    { tipo: 'texto', nombre: 'nrc', etiqueta: 'Número de Registro de Contribuyente (NRC)', ...NRC_AAC, media: true, si: 'tipo_persona=juridica' },
    { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Nombre completo de la persona o sociedad propietaria', ayuda: 'Según el NIT o NRC de la sociedad', max: 200, si: NO_PROPIETARIO }
  ];
  const CLASES_OPERADOR = ['Aéreo', 'Aeródromo', 'OMA', 'OMAE', 'EIA', 'OIM', 'Trabajo aéreo'];
  const OPERADOR_AAC = (clases = CLASES_OPERADOR) => [
    { tipo: 'seccion', titulo: 'Datos del operador' },
    { tipo: 'texto', nombre: 'nombre_del_operador', etiqueta: 'Nombre del operador', max: 150 },
    { tipo: 'lista', nombre: 'clase_de_operador', etiqueta: 'Clase de operador', opciones: [...clases, 'Otro'].map(c => [c, c]) },
    { tipo: 'texto', nombre: 'otro_clase_operador', etiqueta: 'Especifica la clase de operador', max: 100, si: 'clase_de_operador=Otro' }
  ];
  const AERONAVE_AAC = [
    { tipo: 'seccion', titulo: 'Datos de la aeronave' },
    { tipo: 'texto', nombre: 'matricula', etiqueta: 'Matrícula de la aeronave', max: 20, tercio: true },
    { tipo: 'texto', nombre: 'modelo', etiqueta: 'Modelo', max: 60, tercio: true },
    { tipo: 'texto', nombre: 'serie', etiqueta: 'Serie', max: 60, tercio: true }
  ];
  const OBJETIVO_AAC = { tipo: 'texto', nombre: 'objeto_del_documento', etiqueta: 'Objetivo del documento', ayuda: 'Descripción del documento', max: 500 };
  const REFERENCIA_AAC = { tipo: 'texto', nombre: 'referencia_registral', etiqueta: 'Referencia registral', max: 200, opcional: true };
  const AUTORIZA = 'autorizar_persona=si';
  const AUTORIZA_AAC = ({ conNombre = true, si } = {}) => [
    { tipo: 'opciones', nombre: 'autorizar_persona', etiqueta: '¿Autorizas a una persona para presentar, continuar o retirar documentos?', opciones: SI_NO, ...(si ? { si } : {}) },
    { tipo: 'seccion', titulo: 'Persona que autorizas', si: AUTORIZA },
    ...(conNombre ? [{ tipo: 'texto', nombre: 'nombre_persona_autorizada', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: AUTORIZA }] : []),
    { tipo: 'texto', nombre: 'dui_persona_autorizada', etiqueta: 'DUI', ...FORMATO_DUI, media: true, si: AUTORIZA }
  ];
  const PODER_AAC = PDF_AAC('poder', 'Poder', 'Documento que te autoriza a actuar en representación de la persona', { si: 'calidad_del_solicitante=apoderado' });
  const CREDENCIAL_AAC = PDF_AAC('credencial_representante', 'Credencial de representante legal', '', { si: 'calidad_del_solicitante=representante_legal' });
  const AUTORIZACION_AAC = PDF_AAC('autorizacion', 'Autorización', 'De la persona que autorizas para presentar, continuar o retirar documentos', { si: AUTORIZA });

  // Permisos y licencias de pilotos y técnicos: también se piden para un menor de edad, con la ayuda de su responsable
  const MENOR_AAC = 'tipo_solicitud=menor_edad';
  const PARENTESCOS_AAC = { cortos: ['Padre', 'Tío', 'Tía', 'Hermano', 'Hermana', 'Tutor', 'Otro'], todos: ['Padre', 'Madre', 'Tío', 'Tía', 'Hermano', 'Hermana', 'Tutor', 'Tutora', 'Otro'] };
  const sinTildes = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const PARA_QUIEN_AAC = (parentescos) => [
    { tipo: 'opciones', nombre: 'tipo_solicitud', etiqueta: 'Tipo de solicitud', opciones: [{ valor: 'personal', texto: 'Personal', icono: 'ph-user' }, { valor: 'menor_edad', texto: 'Para menor de edad', icono: 'ph-baby' }] },
    { tipo: 'opciones', nombre: 'parentesco', etiqueta: 'Parentesco', compacto: true, opciones: parentescos.map(p => ({ valor: sinTildes(p), texto: p })), si: MENOR_AAC },
    { tipo: 'texto', nombre: 'otros_parentescos', etiqueta: 'Especifica el parentesco', max: 60, si: 'parentesco=otro' }
  ];
  const RESPONSABLE_AAC = { tipo: 'seccion', titulo: 'Datos del responsable del menor de edad', si: MENOR_AAC };
  const DATOS_MENOR_AAC = ({ conFecha = true } = {}) => [
    { tipo: 'seccion', titulo: 'Datos del menor de edad', si: MENOR_AAC },
    { tipo: 'texto', nombre: 'nombres_menor', etiqueta: 'Nombres', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: MENOR_AAC },
    { tipo: 'texto', nombre: 'apellidos_menor', etiqueta: 'Apellidos', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: MENOR_AAC },
    { ...TELEFONO, nombre: 'telefono_menor', etiqueta: 'Teléfono', media: true, si: MENOR_AAC },
    { tipo: 'texto', nombre: 'correo_menor', etiqueta: 'Correo electrónico', modo: 'email', media: true, si: MENOR_AAC },
    ...(conFecha ? [FECHA_AAC('fecha_nacimiento', 'Fecha de nacimiento', { si: MENOR_AAC })] : [])
  ];
  const TUTOR_AAC = PDF_AAC('autorizacion_tutor', 'Autorización de tutor legal', 'Documento firmado que exprese la representación del menor de edad, como el testimonio de escritura pública de poder especial', { si: MENOR_AAC });
  const MEDICO_AAC = PDF_AAC('certificado_medico', 'Certificado médico clase II vigente', 'Según la RAC MED 3.105: dura 24 meses si tienes menos de 40 años y 12 meses desde los 40');
  const LUGARES_ESTUDIO_AAC = [['universidad_don_bosco', 'Universidad Don Bosco'], ['itexsal', 'ITEXSAL'], ['dardano_aerotech', 'Dardano AeroTech'], ['oab_fl_tecnich', 'OAB FL Tecnich'], ['avianca_bogota', 'Avianca Bogotá'], ['aeronautical_tecnical_skills', 'Aeronautical Tecnical Skills']];
  const BACHILLER_AAC = (extra = {}) => PDF_AAC('titulo_bachiller', 'Título de bachiller', 'Emitido por el Ministerio de Educación, o carta de egresado firmada y sellada', extra);
  const REPOSICION_AAC = (nombre, robo, deterioro) => ({ tipo: 'opciones', nombre, etiqueta: 'Tipo de reposición', opciones: [
    { valor: robo, texto: 'Por robo o extravío', icono: 'ph-warning' },
    { valor: deterioro, texto: 'Por deterioro', icono: 'ph-file-x' }
  ] });
  const HABILITACIONES_AAC = (lista) => ({ tipo: 'opciones', nombre: 'habilitaciones', etiqueta: 'Habilitaciones', opciones: lista.map(([valor, texto, detalle]) => ({ valor, texto, detalle: detalle ? `${detalle} · $${valor}` : `$${valor}` })) });
  const PAGO_AAC = monto => ({ ...PAGO, monto, campos: [
    { tipo: 'nota', estilo: 'info', lineas: ['Pagas con tarjeta de crédito o débito en la pasarela segura de SERFINSA'] },
    { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Termina el pago por completo para que tu trámite aparezca en Mis documentos', 'Si algo falla, no inicies otro trámite ni vuelvas a pagar: escribe a contacto@simple.sv'] }
  ] });
  const ENVIAR_AAC = lineas => ({ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas }, ...ENVIAR.campos] });
  const DOCUMENTOS_AAC = (campos, extra = {}) => ({ titulo: 'Documentos requeridos', subtitulo: 'Adjúntalos en PDF', campos, ...extra });
  const SOLICITANTE_AAC = { tipo: 'seccion', titulo: 'Datos del solicitante' };

  F[1] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos qué necesitas y en qué calidad lo pides',
    campos: [SOLICITADO_AAC, ...CALIDAD_AAC({ propietario: 'Administrador o director' })],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los de la fianza', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, DUI_CUENTA_AAC, ...DOMICILIO_AAC, ...CONTACTO_AAC,
        { tipo: 'seccion', titulo: 'Datos de la sociedad' },
        TIPO_DOC_EMPRESA_AAC(),
        { tipo: 'texto', nombre: 'nit', etiqueta: 'Número de Identificación Tributaria (NIT)', ...NIT_AAC, si: 'tipo_documento_empresa=nit' },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Nombre completo de la razón social', ayuda: 'Según el NRC de la sociedad', max: 200, si: 'tipo_documento_empresa=nrc' },
        { tipo: 'texto', nombre: 'nrc', etiqueta: 'Número de Registro de Contribuyente (NRC)', ...NRC_AAC, si: 'tipo_documento_empresa=nrc' },
        ...OPERADOR_AAC(),
        { tipo: 'seccion', titulo: 'Datos del documento' },
        FECHA_AAC('fecha_del_documento', 'Fecha del documento', { tercio: true }),
        FECHA_AAC('vigencia_desde', 'Vigencia desde', { tercio: true }),
        FECHA_AAC('vigencia_hasta', 'Vigencia hasta', { tercio: true, opcional: true }),
        { tipo: 'texto', nombre: 'documento_deseado', etiqueta: 'Objetivo del documento', ayuda: 'Descripción del documento', max: 500 },
        { tipo: 'texto', nombre: 'monto_fianza', etiqueta: 'Monto de la fianza', ayuda: 'En dólares', ...MONTO_AAC },
        ...AUTORIZA_AAC({ si: 'calidad_del_solicitante!=otro' })
      ] },
      DOCUMENTOS_AAC([PODER_AAC, CREDENCIAL_AAC, PDF_AAC('fianza', 'Fianza'), PDF_AAC('resolucion_superintendencia', 'Resolución de la Superintendencia de Obligaciones Mercantiles'), PDF_AAC('nit_nrc', 'NIT o NRC')], { subtitulo: 'La AAC los revisa en una calificación previa. Adjúntalos en PDF' }),
      ENVIAR_AAC(['La AAC revisa tus documentos y después te indica el pago: hasta $300.00, según el monto de la fianza'])
    ]
  };

  F[2] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos qué necesitas y en qué calidad lo pides',
    campos: [SOLICITADO_AAC, ...CALIDAD_AAC(PROPIETARIO_DEL_DOCUMENTO)],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los de la póliza', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, DUI_CUENTA_AAC, ...DOMICILIO_AAC, ...CONTACTO_AAC,
        { tipo: 'texto', nombre: 'sociedad_propietaria', etiqueta: 'Nombre completo de la sociedad propietaria', ayuda: 'Según el NIT o NRC de la sociedad', max: 200, si: 'calidad_del_solicitante=representante_legal' },
        ...PROPIETARIO_AAC,
        ...OPERADOR_AAC([...CLASES_OPERADOR, 'Aviación general']),
        ...AERONAVE_AAC,
        { tipo: 'seccion', titulo: 'Datos del documento' },
        { tipo: 'texto', nombre: 'documento_deseado', etiqueta: 'Objetivo del documento', ayuda: 'Descripción del documento', max: 500 },
        { tipo: 'texto', nombre: 'monto_poliza', etiqueta: 'Monto asegurado', ayuda: 'En dólares estadounidenses', ...MONTO_AAC },
        ...AUTORIZA_AAC({ si: 'calidad_del_solicitante!=otro' })
      ] },
      DOCUMENTOS_AAC([PODER_AAC, AUTORIZACION_AAC, PDF_AAC('poliza_original', 'Póliza original'), CREDENCIAL_AAC, PDF_AAC('nit_nrc', 'NIT o NRC', '', { si: NO_PROPIETARIO })], { subtitulo: 'La AAC los revisa en una calificación previa. Adjúntalos en PDF' }),
      ENVIAR_AAC(['Pagas $60.00 más $1.00 por cada millar o fracción del monto aprobado de la póliza. La AAC te indica el total después de revisar tus documentos'])
    ]
  };

  F[3] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos qué necesitas y en qué calidad lo pides',
    campos: [SOLICITADO_AAC, ...CALIDAD_AAC({ propietario: 'Administrador o director' })],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los de las tarifas', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, { ...DUI_CUENTA_AAC, si: 'calidad_del_solicitante=otro' }, ...DOMICILIO_AAC, ...CONTACTO_AAC,
        { tipo: 'seccion', titulo: 'Datos de la sociedad', si: NO_PROPIETARIO },
        TIPO_DOC_EMPRESA_AAC(NO_PROPIETARIO),
        { tipo: 'texto', nombre: 'nit', etiqueta: 'Número de Identificación Tributaria (NIT)', ...NIT_AAC, si: 'tipo_documento_empresa=nit' },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Nombre completo de la razón social', ayuda: 'Según el NRC de la sociedad', max: 200, si: NO_PROPIETARIO },
        { tipo: 'texto', nombre: 'nrc', etiqueta: 'Número de Registro de Contribuyente (NRC)', ...NRC_AAC, si: NO_PROPIETARIO },
        ...OPERADOR_AAC(['Aéreo', 'Aeródromo', 'EIA', 'OIM', 'OMA', 'OMAE', 'Trabajo aéreo']),
        { tipo: 'seccion', titulo: 'Datos del documento' },
        { tipo: 'opciones', nombre: 'tipo_de_tarifas', etiqueta: 'Tipo de tarifas', multiple: true, opciones: [
          { valor: 'pasajero', texto: 'Pasajeros', icono: 'ph-users' },
          { valor: 'carga', texto: 'Carga', icono: 'ph-package' },
          { valor: 'correo', texto: 'Correo', icono: 'ph-envelope' }
        ] },
        ...AUTORIZA_AAC({ si: 'calidad_del_solicitante!=otro' })
      ] },
      DOCUMENTOS_AAC([PODER_AAC, PDF_AAC('tarifas', 'Tarifas'), CREDENCIAL_AAC, PDF_AAC('nit_nrc', 'NIT o NRC')], { subtitulo: 'La AAC los revisa en una calificación previa. Adjúntalos en PDF' }),
      REVISION,
      PAGO_AAC('$100.00')
    ]
  };

  F[4] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos en qué calidad pides la certificación',
    campos: CALIDAD_AAC({ ...PROPIETARIO_DEL_DOCUMENTO, otro: false }),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los de la aeronave', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
        { tipo: 'seccion', titulo: 'Razón social', si: NO_PROPIETARIO },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón social', max: 200, si: NO_PROPIETARIO },
        ...OPERADOR_AAC(),
        ...AERONAVE_AAC,
        OBJETIVO_AAC,
        ...AUTORIZA_AAC({ conNombre: false })
      ] },
      DOCUMENTOS_AAC([PDF_AAC('nit', 'Número de Identificación Tributaria (NIT)', 'NIT de la sociedad'), PODER_AAC, CREDENCIAL_AAC, PDF_AAC('escritura_constitucion', 'Escritura de constitución', 'De la empresa')]),
      REVISION,
      PAGO_AAC('$20.00')
    ]
  };

  F[5] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos en qué calidad pides la certificación',
    campos: CALIDAD_AAC(PROPIETARIO_DEL_DOCUMENTO),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los del documento', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
        ...PROPIETARIO_AAC,
        ...OPERADOR_AAC(),
        { tipo: 'seccion', titulo: 'Datos del documento' },
        { tipo: 'texto', nombre: 'nombre_del_documento', etiqueta: 'Nombre del documento', max: 200, media: true },
        FECHA_AAC('fecha_del_documento', 'Fecha del documento', { media: true }),
        OBJETIVO_AAC,
        REFERENCIA_AAC,
        ...AERONAVE_AAC,
        ...AUTORIZA_AAC({ conNombre: false })
      ] },
      DOCUMENTOS_AAC([
        PDF_AAC('dui_propietario', 'Documento Único de Identidad (DUI)', 'Del propietario', { si: 'tipo_persona=natural' }),
        AUTORIZACION_AAC, PODER_AAC, CREDENCIAL_AAC,
        PDF_AAC('nit_archivo', 'NIT', 'Un solo archivo con todo el documento', { si: 'tipo_persona=juridica' }),
        PDF_AAC('nrc_archivo', 'NRC', 'Un solo archivo', { si: 'tipo_persona=juridica' })
      ]),
      REVISION,
      PAGO_AAC('$20.00')
    ]
  };

  F[6] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos en qué calidad pides la certificación',
    campos: CALIDAD_AAC(PROPIETARIO_DEL_DOCUMENTO),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y completa los del documento', campos: [
        SOLICITANTE_AAC, ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
        ...PROPIETARIO_AAC,
        ...OPERADOR_AAC(),
        ...AERONAVE_AAC,
        { tipo: 'seccion', titulo: 'Datos del documento' },
        OBJETIVO_AAC,
        REFERENCIA_AAC,
        ...AUTORIZA_AAC()
      ] },
      DOCUMENTOS_AAC([
        PDF_AAC('dui_solicitante', 'Documento Único de Identidad (DUI)', 'Del solicitante', { si: 'tipo_persona=natural' }),
        PODER_AAC, AUTORIZACION_AAC, CREDENCIAL_AAC,
        PDF_AAC('nit_archivo', 'NIT', 'Un solo archivo con todo el documento', { si: 'tipo_persona=juridica' }),
        PDF_AAC('nrc_archivo', 'NRC', 'Un solo archivo', { si: 'tipo_documento_empresa=nrc' })
      ]),
      REVISION,
      PAGO_AAC('$20.00')
    ]
  };

  F[7] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es el permiso',
    campos: PARA_QUIEN_AAC(PARENTESCOS_AAC.cortos),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y dinos dónde estudias', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC, CONFIRMAR_CORREO_AAC,
        ...DATOS_MENOR_AAC({ conFecha: false }),
        FECHA_AAC('fecha_nacimiento', 'Fecha de nacimiento'),
        ...DOMICILIO_AAC,
        { tipo: 'lista', nombre: 'lugar_estudio', etiqueta: 'Organización de instrucción de mantenimiento aprobada donde estudias', opciones: LUGARES_ESTUDIO_AAC }
      ] },
      DOCUMENTOS_AAC([TUTOR_AAC, BACHILLER_AAC(), FOTO_AAC('Con vestimenta formal y fondo blanco. Formato JPG')], { subtitulo: 'Adjunta cada uno en su formato' }),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  F[8] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es el permiso',
    campos: PARA_QUIEN_AAC(PARENTESCOS_AAC.cortos),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y dinos dónde vives', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC,
        ...DATOS_MENOR_AAC(),
        ...DOMICILIO_AAC
      ] },
      DOCUMENTOS_AAC([
        BACHILLER_AAC(),
        PDF_AAC('dui', 'Documento Único de Identidad (DUI)', 'Del solicitante si es mayor de 18 años, o del tercero autorizado', { si: 'tipo_solicitud=personal' }),
        FOTO_AAC(FOTO_FRENTE),
        PDF_AAC('carta_escuela', 'Carta de la escuela', 'Firmada y sellada, en la que te aceptan como piloto estudiante'),
        MEDICO_AAC,
        TUTOR_AAC
      ], { subtitulo: 'Adjunta cada uno en su formato' }),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  F[9] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos qué Opspecs quieres modificar',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_operador', etiqueta: 'Tipo de operador', opciones: [{ valor: '1', texto: 'Nacional', icono: 'ph-map-pin' }, { valor: '2', texto: 'Extranjero', icono: 'ph-globe-hemisphere-west' }] },
      { tipo: 'opciones', nombre: 'tipo_modificacion', etiqueta: 'Tipo de modificación', columna: true, opciones: [
        { valor: '1', texto: 'Para personal gerencial', icono: 'ph-users-three' },
        { valor: '2', texto: 'Para gerente de estación', icono: 'ph-airplane-tilt' },
        { valor: '3', texto: 'Por gerente responsable', icono: 'ph-user-circle' },
        { valor: '4', texto: 'Por gerente de calidad de organización aprobada', icono: 'ph-seal-check' },
        { valor: '5', texto: 'Por cambio de gerente o director de mantenimiento de una OMA', icono: 'ph-wrench' }
      ].map(o => ({ ...o, texto: `Modificación o actualización de Opspec ${o.texto.charAt(0).toLowerCase()}${o.texto.slice(1)}` })) }
    ],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Tus datos y los del personal que cambia', campos: [
        { tipo: 'seccion', titulo: 'Datos del representante o designado' },
        ...NOMBRE_AAC, ...CONTACTO_AAC,
        { tipo: 'seccion', titulo: 'Datos del personal gerencial a modificar' },
        { tipo: 'texto', nombre: 'nombres_gerente', etiqueta: 'Nombres', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'apellidos_gerente', etiqueta: 'Apellidos', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'lista', nombre: 'tipo_documento_gerente', etiqueta: 'Tipo de documento', opciones: [['1', 'DUI'], ['2', 'Pasaporte'], ['3', 'Carnet de residente']], media: true },
        { tipo: 'texto', nombre: 'dui_gerente', etiqueta: 'DUI', ...FORMATO_DUI, media: true, si: 'tipo_documento_gerente=1' },
        { tipo: 'texto', nombre: 'pasaporte_gerente', etiqueta: 'Pasaporte', max: 20, media: true, si: 'tipo_documento_gerente=2' },
        { tipo: 'texto', nombre: 'carnet_gerente', etiqueta: 'Carnet de residente', max: 20, media: true, si: 'tipo_documento_gerente=3' },
        { ...TELEFONO, nombre: 'telefono_gerente', etiqueta: 'Teléfono', media: true },
        { tipo: 'texto', nombre: 'correo_gerente', etiqueta: 'Correo electrónico', modo: 'email', media: true }
      ] },
      DOCUMENTOS_AAC([
        { tipo: 'seccion', titulo: 'Del representante o designado' },
        PDF_AAC('comprobante_representacion', 'Comprobante de representación legal', 'Documento firmado que exprese la representación legal de la empresa'),
        { tipo: 'seccion', titulo: 'Del personal gerencial a modificar' },
        PDF_AAC('carta_director', 'Solicitud por carta al director ejecutivo', 'Escaneada y firmada, con la modificación del personal que pides'),
        PDF_AAC('hoja_de_vida', 'Hoja de vida del personal propuesto', 'Con la experiencia de la persona propuesta para el puesto'),
        PDF_AAC('anexos', 'Anexos', 'Atestados, licencias o diplomas que respalden la hoja de vida'),
        PDF_AAC('cuadro_comparativo', 'Cuadro comparativo del personal', 'Comparativa del personal propuesto, carta de cumplimiento y requisitos de la RAC aplicable'),
        PDF_AAC('nombramiento', 'Nombramiento oficial', 'Del puesto propuesto, firmado por el máximo representante')
      ]),
      ENVIAR_AAC(['La AAC revisa tu solicitud y te responde en 10 días hábiles'])
    ]
  };

  F[10] = {
    titulo: 'Información personal',
    subtitulo: 'Revisa tus datos y cuéntanos de tu licencia',
    campos: [
      ...NOMBRE_AAC, ...CONTACTO_AAC,
      { tipo: 'texto', nombre: 'numero_de_licencia', etiqueta: 'Número de licencia', max: 20 },
      ...DOMICILIO_AAC,
      HABILITACIONES_AAC([['25.00', '1 habilitación', 'Aeronave'], ['35.00', '2 habilitaciones', 'Aeronave y motores']])
    ],
    pasos: [
      DOCUMENTOS_AAC([
        PDF_AAC('licencia_a_renovar', 'Licencia de TMA a renovar', 'Con fotos de los dos lados de la licencia, de hasta 5 MB'),
        PDF_AAC('experiencia_reciente', 'Experiencia reciente', 'Constancia de que durante al menos 6 meses hiciste trabajos de mantenimiento con las habilitaciones de tu licencia', { opcional: true }),
        PDF_AAC('carta_trabajo', 'Carta de tu lugar de trabajo', 'Firmada por el gerente responsable, el representante técnico o personal acreditado ante la AAC'),
        ...CAMBIAR_FOTO_AAC
      ]),
      REVISION,
      PAGO_AAC([['habilitaciones=25.00', '$25.00'], ['habilitaciones=35.00', '$35.00']])
    ]
  };

  F[11] = {
    titulo: 'Información personal',
    subtitulo: 'Revisa tus datos y cuéntanos de tu licencia',
    campos: [
      ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
      { tipo: 'texto', nombre: 'numero_de_permiso', etiqueta: 'Número de licencia', max: 20 },
      ...DOMICILIO_AAC,
      HABILITACIONES_AAC([['30.00', '1 habilitación'], ['40.00', '2 habilitaciones'], ['50.00', '3 habilitaciones']])
    ],
    pasos: [
      DOCUMENTOS_AAC([
        PDF_AAC('bitacoras', 'Bitácoras', 'Que demuestren que volaste en los 6 meses antes del vencimiento de la licencia'),
        MEDICO_AAC,
        PDF_AAC('licencia_a_renovar', 'Licencia a renovar', 'Con fotos de los dos lados de la licencia'),
        ...CAMBIAR_FOTO_AAC
      ]),
      REVISION,
      PAGO_AAC([['habilitaciones=30.00', '$30.00'], ['habilitaciones=40.00', '$40.00'], ['habilitaciones=50.00', '$50.00']])
    ]
  };

  F[12] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es el permiso',
    campos: PARA_QUIEN_AAC(['Padre', 'Tío', 'Hermano', 'Otro']),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y dinos dónde vives', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC,
        ...DATOS_MENOR_AAC(),
        ...DOMICILIO_AAC
      ] },
      DOCUMENTOS_AAC([
        TUTOR_AAC,
        PDF_AAC('dui', 'Documento Único de Identidad (DUI)', 'Si renovaste tu DUI, adjunta los dos lados', { si: 'tipo_solicitud=personal' }),
        BACHILLER_AAC({ opcional: true }),
        ...CAMBIAR_FOTO_AAC
      ], { subtitulo: 'Adjunta cada uno en su formato' }),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  F[13] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es el permiso',
    campos: PARA_QUIEN_AAC(PARENTESCOS_AAC.todos),
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y cuéntanos de tu permiso', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC,
        { tipo: 'texto', nombre: 'numero_de_permiso', etiqueta: 'Número de permiso', max: 20 },
        ...DATOS_MENOR_AAC(),
        ...DOMICILIO_AAC
      ] },
      DOCUMENTOS_AAC([
        PDF_AAC('permiso_a_renovar', 'Permiso de piloto a renovar', 'Con fotos de los dos lados del permiso'),
        MEDICO_AAC,
        ...CAMBIAR_FOTO_AAC,
        TUTOR_AAC
      ], { subtitulo: 'Adjunta cada uno en su formato' }),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  F[14] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos por qué repones tu licencia',
    campos: [REPOSICION_AAC('motivo', 'robo', 'deterioro')],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y cuéntanos de tu licencia', campos: [
        ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
        { tipo: 'texto', nombre: 'numero_de_permiso', etiqueta: 'Número de licencia', max: 20 },
        ...DOMICILIO_AAC
      ] },
      DOCUMENTOS_AAC([PDF_AAC('licencia_a_reponer', 'Licencia a reponer', 'Con fotos de los dos lados de la licencia')]),
      REVISION,
      PAGO_AAC('$20.00')
    ]
  };

  F[15] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos por qué repones tu licencia',
    campos: [REPOSICION_AAC('motivo', 'robo', 'deterioro')],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y cuéntanos de tu licencia', campos: [
        ...NOMBRE_AAC, DUI_CUENTA_AAC, ...CONTACTO_AAC,
        { tipo: 'texto', nombre: 'numero_de_licencia', etiqueta: 'Número de licencia', max: 20 },
        ...DOMICILIO_AAC
      ] },
      // En el portal, por robo o extravío no se adjunta nada
      DOCUMENTOS_AAC([PDF_AAC('licencia_a_reponer', 'Licencia de TMA a reponer', 'Con fotos de los dos lados de la licencia')], { si: 'motivo=deterioro' }),
      REVISION,
      PAGO_AAC('$15.00')
    ]
  };

  F[16] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos por qué repones el permiso y para quién es',
    campos: [REPOSICION_AAC('tipo_reposicion', 'reposicion_por_robo', 'reposicion_por_deterioro'), ...PARA_QUIEN_AAC(PARENTESCOS_AAC.todos)],
    pasos: [
      // La autorización del tutor va aquí y no con el permiso a reponer: así el paso de documentos solo aparece por deterioro
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y dinos dónde vives', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC,
        ...DATOS_MENOR_AAC({ conFecha: false }),
        ...DOMICILIO_AAC,
        TUTOR_AAC
      ] },
      DOCUMENTOS_AAC([PDF_AAC('permiso_a_reponer', 'Permiso a reponer', 'Con imágenes de los dos lados del permiso')], { si: 'tipo_reposicion=reposicion_por_deterioro' }),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  F[17] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es el permiso y por qué lo repones',
    campos: [PARA_QUIEN_AAC(PARENTESCOS_AAC.todos)[0], REPOSICION_AAC('tipo_reposicion', 'reposicion_por_robo', 'reposicion_por_deterioro'), ...PARA_QUIEN_AAC(PARENTESCOS_AAC.todos).slice(1)],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Revisa tus datos y cuéntanos de tu permiso', campos: [
        RESPONSABLE_AAC, ...NOMBRE_AAC, ...CONTACTO_AAC,
        { tipo: 'texto', nombre: 'numero_de_permiso', etiqueta: 'Número de permiso', max: 20 },
        ...DATOS_MENOR_AAC({ conFecha: false }),
        ...DOMICILIO_AAC
      ] },
      DOCUMENTOS_AAC([
        PDF_AAC('permiso_a_reponer', 'Permiso de piloto a reponer', 'Con fotos de los dos lados del permiso'),
        MEDICO_AAC,
        PDF_AAC('dui', 'Documento Único de Identidad (DUI)', 'Con fotos de los dos lados', { si: 'tipo_solicitud=personal' }),
        TUTOR_AAC
      ]),
      REVISION,
      PAGO_AAC('$10.00')
    ]
  };

  /* ===== Salud: ISRI ===== */
  // ISRI (isri.ventanilla.simple.sv). En las constancias (trámites 71 y 60) el portal pregunta para quién es y, en el segundo
  // paso (el último), trae los datos de la cuenta y pide el expediente y el centro; para otra persona pide sus datos y la partida
  // o el documento de representación. En la cita médica (328), los datos del paciente van en un paso aparte y después los médicos.
  // Cada trámite tiene sus propios códigos de centro.
  const CENTROS_ISRI = ['CRINA - Centro de Rehabilitación Integral para la Niñez y la Adolescencia', 'CALE - Centro de Audición y Lenguaje', 'CAL - Centro del Aparato Locomotor',
    'CRC - Centro de Rehabilitación de Ciegos', 'CRP - Centro de Rehabilitación Profesional', 'CRIO - Centro de Rehabilitación de Occidente', 'CRIOR - Centro de Rehabilitación de Oriente', 'UCE - Unidad de Consulta Externa'];
  const centrosIsri = codigos => CENTROS_ISRI.map((texto, i) => [codigos[i], texto]);
  const PARA_TERCERO_ISRI = 'tipo_solicitante=tercero';
  const SOLICITANTE_ISRI = { tipo: 'opciones', nombre: 'tipo_solicitante', etiqueta: '¿Para quién es la solicitud?', opciones: [
    { valor: 'personal', texto: 'Para mí', icono: 'ph-user' },
    { valor: 'tercero', texto: 'Para otra persona', icono: 'ph-users' }
  ] };
  const EXPEDIENTE_ISRI = { tipo: 'texto', nombre: 'numero_expediente', etiqueta: 'Número de expediente', ayuda: 'Correlativo y año de emisión, por ejemplo 0002-2021', placeholder: '0002-2021', max: 12, patron: '[0-9]{1,6}-[0-9]{4}', mensaje: 'Escribe el número de expediente como 0002-2021' };
  const PARTIDA_ISRI = (si) => archivo('partida_de_nacimiento', 'Partida de nacimiento', { si });
  const REPRESENTACION_ISRI = (si) => archivo('documento_de_representacion', 'Documento legal de representación', { ayuda: 'Documento en el que la autoridad competente te otorga la representación de la persona. ' + FORMATOS_IMAGEN, si });
  const constanciaIsri = (nota, codigos) => ({
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es la constancia',
    campos: [
      { tipo: 'nota', estilo: 'info', lineas: [nota] },
      SOLICITANTE_ISRI,
      { tipo: 'opciones', nombre: 'parentesco', etiqueta: 'Parentesco', compacto: true, si: PARA_TERCERO_ISRI, opciones: [
        { valor: 'padres', texto: 'Padre o madre' }, { valor: 'tio', texto: 'Tío' }, { valor: 'tia', texto: 'Tía' }, { valor: 'hermano', texto: 'Hermano' },
        { valor: 'hermana', texto: 'Hermana' }, { valor: 'tutor', texto: 'Tutor' }, { valor: 'otro', texto: 'Otro' }
      ] },
      { tipo: 'texto', nombre: 'otro_parentesco', etiqueta: '¿Cuál es el parentesco?', max: 50, si: 'parentesco=otro' }
    ],
    pasos: [
      { titulo: 'Datos de la constancia', subtitulo: 'Revisa tus datos y cuéntanos dónde recibes la atención', campos: [
        { tipo: 'seccion', titulo: 'Tus datos' },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true },
        { tipo: 'seccion', titulo: 'Datos de la persona que recibe la atención', si: PARA_TERCERO_ISRI },
        { tipo: 'texto', nombre: 'nombres_del_usuario', etiqueta: 'Nombres', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: PARA_TERCERO_ISRI },
        { tipo: 'texto', nombre: 'apellidos_del_usuario', etiqueta: 'Apellidos', max: 60, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: PARA_TERCERO_ISRI },
        { tipo: 'texto', nombre: 'fecha_nacimiento_usuario', etiqueta: 'Fecha de nacimiento', ...FECHA_DMA, si: PARA_TERCERO_ISRI },
        { tipo: 'seccion', titulo: 'Atención en el ISRI' },
        EXPEDIENTE_ISRI,
        { tipo: 'lista', nombre: 'centro_de_atencion', etiqueta: 'Centro de atención', opciones: centrosIsri(codigos) },
        PARTIDA_ISRI('parentesco=padres'),
        REPRESENTACION_ISRI('parentesco!=padres')
      ] },
      ENVIAR
    ]
  });
  F[76] = constanciaIsri('La constancia de horarios corresponde al proceso de rehabilitación que recibes en el centro de atención del ISRI', ['58', '57', '61', '63', '62', '56', '64', '60']);
  F[77] = constanciaIsri('La constancia médica corresponde a la última atención médica que recibiste en el centro de atención del ISRI', ['26', '25', '28', '30', '29', '24', '31', '27']);

  F[78] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es la cita',
    campos: [
      SOLICITANTE_ISRI,
      { tipo: 'opciones', nombre: 'tipo_referencia', etiqueta: '¿El paciente es?', si: PARA_TERCERO_ISRI, opciones: [
        { valor: 'adulto', texto: 'Mayor de 18 años', icono: 'ph-user' },
        { valor: 'menor', texto: 'Menor de 18 años', icono: 'ph-baby' }
      ] },
      { tipo: 'opciones', nombre: 'parentesco', etiqueta: '¿Qué parentesco tienes con el paciente?', compacto: true, si: PARA_TERCERO_ISRI, opciones: [
        { valor: 'padres', texto: 'Padre o madre' }, { valor: 'tutor', texto: 'Tutor' }, { valor: 'representante', texto: 'Representante' }
      ] },
      { tipo: 'texto', nombre: 'dui_paciente', etiqueta: 'DUI del paciente', ayuda: 'Si no tiene DUI, escribe NA', placeholder: '00000000-0', max: 10, patron: '[0-9]{8}-?[0-9]|[Nn][Aa]', mensaje: 'Escribe el DUI con el formato 00000000-0, o NA si no tiene', si: PARA_TERCERO_ISRI }
    ],
    pasos: [
      { titulo: 'Datos del paciente', subtitulo: 'Escríbelos como aparecen en sus documentos', si: PARA_TERCERO_ISRI, campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Tu nombre', soloLectura: true, media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Tu correo electrónico', modo: 'email', soloLectura: true, media: true },
        { tipo: 'seccion', titulo: 'Nombre del paciente' },
        ...nombrePorPartes('paciente_', { obligatorio: true, casada: true }),
        { tipo: 'texto', nombre: 'fecha_nacimiento_paciente', etiqueta: 'Fecha de nacimiento del paciente', ...FECHA_DMA },
        PARTIDA_ISRI(),
        REPRESENTACION_ISRI('parentesco=tutor|representante')
      ] },
      { titulo: 'Datos médicos', subtitulo: 'Cuéntanos dónde y por qué necesitas la cita', campos: [
        { tipo: 'opciones', nombre: 'reponer_cita', etiqueta: '¿Es para reponer una cita perdida?', opciones: [
          { valor: 'cita_subsecuente', texto: 'Sí', detalle: 'Es una cita subsecuente', icono: 'ph-arrow-counter-clockwise' },
          { valor: 'cita_nueva', texto: 'No', detalle: 'Es una cita nueva', icono: 'ph-calendar-plus' }
        ] },
        { tipo: 'texto', nombre: 'medico_atendio', etiqueta: '¿Qué médico atendió al paciente?', max: 100, si: 'reponer_cita=cita_subsecuente' },
        { ...EXPEDIENTE_ISRI, si: 'reponer_cita=cita_subsecuente' },
        { tipo: 'lista', nombre: 'centro_de_atencion', etiqueta: 'Centro de atención', opciones: centrosIsri(['26', '25', '28', '30', '29', '24', '31', '27']) },
        { tipo: 'opciones', nombre: 'posee_referencia', etiqueta: '¿Tienes referencia médica?', opciones: SI_NO, si: 'reponer_cita=cita_nueva' },
        archivo('referencia_medica', 'Referencia médica', { si: 'posee_referencia=si' }),
        { tipo: 'texto', nombre: 'motivo_cita_medica', etiqueta: 'Explica el motivo de la cita médica', max: 255, si: 'posee_referencia=no' }
      ] },
      ENVIAR
    ]
  };

  /* ===== Familia: PGR ===== */
  // PGR (pgr.ventanilla.simple.sv, trámite 348): para quién es la solvencia y, en el segundo paso (el último), los datos de la
  // persona (de la cuenta, o escritos si es para otra), el contacto, los expedientes en la PGR y dónde se presenta la solvencia
  const PARA_TERCERO_PGR = 'is_usuario=iu_0';
  const PAISES_MUNDO = ['Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Anguila', 'Antigua y Barbuda', 'Antillas Holandesas', 'Antártida', 'Arabia Saudita', 'Argelia', 'Argentina', 'Armenia', 'Aruba', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bahréin', 'Bangladesh', 'Barbados', 'Belice', 'Benín', 'Bermudas', 'Bielorrusia', 'Bolivia', 'Bosnia-Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután', 'Bélgica', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Chad', 'China', 'Chile', 'Chipre', 'Ciudad del Vaticano', 'Colombia', 'Comoras', 'Congo', 'Corea del Norte', 'Corea del Sur', 'Costa Rica', 'Costa de Marfil', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Gibraltar', 'Granada', 'Grecia', 'Groenlandia', 'Guadalupe', 'Guam', 'Guatemala', 'Guayana Francesa', 'Guernsey', 'Guinea', 'Guinea Ecuatorial', 'Guinea-Bissau', 'Guyana', 'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia', 'Iraq', 'Irlanda', 'Irán', 'Isla Bouvet', 'Isla Christmas', 'Isla Niue', 'Isla Norfolk', 'Isla de Man', 'Islandia', 'Islas Caimán', 'Islas Cocos', 'Islas Cook', 'Islas Feroe', 'Islas Georgia del Sur y Sandwich del Sur', 'Islas Heard y McDonald', 'Islas Malvinas', 'Islas Marianas del Norte', 'Islas Marshall', 'Islas Salomón', 'Islas Turcas y Caicos', 'Islas Vírgenes Británicas', 'Islas Vírgenes de los Estados Unidos', 'Islas menores alejadas de los Estados Unidos', 'Islas Åland', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jersey', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Líbano', 'Macedonia', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Mali', 'Malta', 'Marruecos', 'Martinica', 'Mauricio', 'Mauritania', 'Mayotte', 'Micronesia', 'Moldavia', 'Mongolia', 'Montenegro', 'Montserrat', 'Mozambique', 'Myanmar', 'México', 'Mónaco', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Nigeria', 'Noruega', 'Nueva Caledonia', 'Nueva Zelanda', 'Níger', 'Omán', 'Pakistán', 'Palau', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Países Bajos', 'Perú', 'Pitcairn', 'Polinesia Francesa', 'Polonia', 'Portugal', 'Puerto Rico', 'Qatar', 'Hong Kong', 'Macao', 'Reino Unido', 'República Centroafricana', 'República Checa', 'República Democrática del Congo', 'República Dominicana', 'Reunión', 'Ruanda', 'Rumania', 'Rusia', 'Sahara Occidental', 'Samoa', 'Samoa Americana', 'San Bartolomé', 'San Cristóbal y Nieves', 'San Marino', 'San Martín', 'San Pedro y Miquelón', 'San Vicente y las Granadinas', 'Santa Elena', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Suazilandia', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Svalbard y Jan Mayen', 'Tailandia', 'Taiwán', 'Tanzania', 'Tayikistán', 'Territorio Británico del Océano Índico', 'Territorio Palestino', 'Territorios Australes Franceses', 'Timor Oriental', 'Togo', 'Tokelau', 'Tonga', 'Trinidad y Tobago', 'Turkmenistán', 'Turquía', 'Tuvalu', 'Túnez', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam', 'Wallis y Futuna', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue'].map(p => [p, p]);
  const LUGARES_PGR = ['ACOPACC DE RL', 'AFP CONFIA', 'AFP CRECER', 'ALCALDÍA MUNICIPAL DE SAN SALVADOR', 'ALCALDÍA MUNICIPAL DE SOYAPANGO', 'ARENA', 'ARZOBISPADO DE SAN SALVADOR', 'ASAMBLEA LEGISLATIVA', 'BANCO AGRÍCOLA', 'BANCO CUSCATLÁN', 'BANCO PROMÉRICA', 'CAPI HAPPY CRITTERS', 'CAPI MAGIC MOMENTS', 'CENTRO DE ACOGIMIENTO', 'CENTRO NACIONAL DE REGISTROS', 'COLEGIO DE TEOLOGÍA DE EL SALVADOR', 'CONAPINA', 'CONSEJO NACIONAL DE LA JUDICATURA', 'CONSEJO SALVADOREÑO DEL CAFÉ', 'CORTE DE CUENTAS DE LA REPÚBLICA', 'CORTE SUPREMA DE JUSTICIA', 'DIRECCIÓN GENERAL DE MIGRACIÓN Y EXTRANJERÍA', 'EMBAJADA DE LOS ESTADOS UNIDOS', 'FEDERACIÓN SALVADOREÑA DE FÚTBOL', 'FMLN', 'FONDO SOCIAL PARA LA VIVIENDA', 'FOSOFAMILIA', 'FUDEM', 'INMIGRACIÓN DE LOS ESTADOS UNIDOS', 'INPEP', 'INSTITUTO CRECER JUNTOS', 'INSTITUTO DE ACCESO A LA INFORMACIÓN PÚBLICA', 'IPSFA', 'ISSS', 'JUZGADOS ESPECIALIZADOS EN NIÑEZ Y ADOLESCENCIA (JENNA)', 'JUZGADOS DE FAMILIA', 'JUZGADOS DE INSTRUCCIÓN', 'LOTERÍA NACIONAL DE BENEFICENCIA', 'MINISTERIO DE AGRICULTURA Y GANADERÍA', 'MINISTERIO DE EDUCACIÓN, CIENCIA Y TECNOLOGÍA', 'MINISTERIO DE TRABAJO Y PREVISIÓN SOCIAL', 'OFICINA PARA ADOPCIONES', 'ONG AS MUJERES', 'ÓRGANO JUDICIAL', 'OTRA ENTIDAD', 'PARTIDO CAMBIO DEMOCRÁTICO', 'PARTIDO FRATERNIDAD PATRIOTA SALVADOREÑA', 'PARTIDO NUESTRO TIEMPO', 'PARTIDO NUEVAS IDEAS', 'PARTIDO VAMOS', 'PCN', 'PDC', 'POLICÍA NACIONAL CIVIL', 'PROCURADURÍA GENERAL DE LA REPÚBLICA', 'SERTRACEN', 'TABERNÁCULO BÍBLICO BAUTISTA AMIGOS DE ISRAEL', 'TRÁMITES PERSONALES', 'TRIBUNAL DE ÉTICA GUBERNAMENTAL', 'TRIBUNAL SUPREMO ELECTORAL', 'UNIDAD DE ACREDITACIONES DE CENTROS DE MEDIACIÓN', 'UNIVERSIDAD DE EL SALVADOR']
    .map(l => [sinTildes(l).toUpperCase().replace(/[^A-Z0-9]+/g, '_'), l]);
  // Los cinco expedientes: cada uno se pide si la persona dijo que tiene al menos esa cantidad
  const EXPEDIENTES_PGR = [1, 2, 3, 4, 5].flatMap(n => {
    const si = 'no_expedientes=' + [1, 2, 3, 4, 5].slice(n - 1).map(k => 'ne_' + k).join('|');
    return [
      { tipo: 'seccion', titulo: `Expediente ${n}`, si },
      { tipo: 'texto', nombre: `nombre_exp_${n}`, etiqueta: 'Nombre asociado al expediente', max: 100, si },
      { tipo: 'texto', nombre: `numero_fisico_exp_${n}`, etiqueta: 'Número físico', max: 30, opcional: true, media: true, si },
      { tipo: 'texto', nombre: `numero_digital_exp_${n}`, etiqueta: 'Número digital', max: 30, opcional: true, media: true, si }
    ];
  });
  F[94] = {
    titulo: 'Tipo de solicitud',
    subtitulo: 'Cuéntanos para quién es la solvencia',
    campos: [
      { tipo: 'opciones', nombre: 'is_usuario', etiqueta: '¿Haces la solicitud para ti o en representación de otra persona?', opciones: [
        { valor: 'iu_1', texto: 'Para mí', detalle: 'Trámite personal', icono: 'ph-user' },
        { valor: 'iu_0', texto: 'Para otra persona', detalle: 'En su representación', icono: 'ph-users' }
      ] },
      { tipo: 'seccion', titulo: 'Documento de la otra persona', si: PARA_TERCERO_PGR },
      { tipo: 'lista', nombre: 'tipo_documento_sol', etiqueta: 'Tipo de documento de identificación', media: true, si: PARA_TERCERO_PGR, opciones: [
        ['td_sol_0', 'DUI'], ['td_sol_1', 'Pasaporte'], ['td_sol_2', 'Carnet de residente'], ['td_sol_8', 'Carnet de minoridad'],
        ['td_sol_3', 'DPI (Guatemala)'], ['td_sol_4', 'DNI (Honduras)'], ['td_sol_5', 'Cédula de identidad (Nicaragua)']
      ] },
      { tipo: 'texto', nombre: 'num_doc_sol', etiqueta: 'Número de documento', max: 20, media: true, si: PARA_TERCERO_PGR },
      archivo('documento_identificacion', 'Documento de identificación', { ...SOLO_PDF, si: PARA_TERCERO_PGR })
    ],
    pasos: [
      { titulo: 'Registro de información', subtitulo: 'Datos de la persona, contacto y dónde presentarás la solvencia', campos: [
        { tipo: 'seccion', titulo: 'Tus datos', si: 'is_usuario=iu_1' },
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, si: 'is_usuario=iu_1' },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', soloLectura: true, media: true, si: 'is_usuario=iu_1' },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico de notificación', modo: 'email', soloLectura: true, media: true, si: 'is_usuario=iu_1' },
        { tipo: 'seccion', titulo: 'Datos de la otra persona', si: PARA_TERCERO_PGR },
        ...nombrePorPartes('sol_', { obligatorio: true, casada: true, si: PARA_TERCERO_PGR }),
        { tipo: 'opciones', nombre: 'sexo_sol', etiqueta: 'Sexo', si: PARA_TERCERO_PGR, opciones: [
          { valor: 's_sol_0', texto: 'Mujer', icono: 'ph-gender-female' },
          { valor: 's_sol_1', texto: 'Hombre', icono: 'ph-gender-male' }
        ] },
        { tipo: 'texto', nombre: 'fecha_nacimiento_sol', etiqueta: 'Fecha de nacimiento', ...FECHA_DMA, media: true, si: PARA_TERCERO_PGR },
        { tipo: 'texto', nombre: 'profesion_solicitante', etiqueta: 'Profesión', max: 60, media: true, si: PARA_TERCERO_PGR },
        { tipo: 'texto', nombre: 'nombre_madre', etiqueta: 'Nombre completo de la madre', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: PARA_TERCERO_PGR },
        { tipo: 'texto', nombre: 'nombre_padre', etiqueta: 'Nombre completo del padre', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', opcional: true, si: PARA_TERCERO_PGR },
        { tipo: 'texto', nombre: 'email_sol', etiqueta: 'Correo electrónico de notificación', modo: 'email', media: true, si: PARA_TERCERO_PGR },
        { tipo: 'texto', nombre: 'confirmar_email_sol', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'email_sol', mensaje: 'Los correos no coinciden', media: true, si: PARA_TERCERO_PGR },
        { tipo: 'seccion', titulo: 'Nacimiento y contacto' },
        { tipo: 'lista', nombre: 'departamento_nacimiento', etiqueta: 'Departamento de nacimiento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_nacimiento', etiqueta: 'Municipio de nacimiento', depende: 'departamento_nacimiento', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'lista', nombre: 'pais', etiqueta: 'País de residencia', opciones: PAISES_MUNDO, media: true },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono para notificaciones', media: true },
        { tipo: 'seccion', titulo: 'Expedientes en la PGR' },
        { tipo: 'opciones', nombre: 'posee_expediente', etiqueta: '¿Tienes expediente en la PGR?', opciones: [
          { valor: 'pe_1', texto: 'Sí', icono: 'ph-check' }, { valor: 'pe_0', texto: 'No', icono: 'ph-x' }
        ] },
        { tipo: 'opciones', nombre: 'no_expedientes', etiqueta: '¿Cuántos expedientes tienes?', compacto: true, si: 'posee_expediente=pe_1', opciones: [1, 2, 3, 4, 5].map(n => ({ valor: 'ne_' + n, texto: String(n) })) },
        ...EXPEDIENTES_PGR,
        { tipo: 'seccion', titulo: 'Uso de la solvencia' },
        { tipo: 'lista', nombre: 'lugar_presentacion_solvencia', etiqueta: 'Lugar donde presentarás la solvencia', opciones: LUGARES_PGR },
        { tipo: 'texto', nombre: 'otra_entidad', etiqueta: 'Escribe la entidad', max: 100, si: 'lugar_presentacion_solvencia=OTRA_ENTIDAD' }
      ] },
      ENVIAR
    ]
  };

  /* ===== Medio ambiente (MARN): LIDAR y tortugas marinas ===== */
  // MARN (marn.ventanilla.simple.sv, trámite 224): indicaciones, datos personales, datos de la investigación y los servicios
  // (el último paso). La resolución de cada producto depende del área: el portal muestra la que toca; aquí van todas en la nota.
  const SERVICIOS_LIDAR = [
    ['IG_1', 'Modelo de elevación digital del terreno', ['Menos de 1 km²: resolución de 2 metros', 'De 1 a 50 km²: 5 metros', 'De 50 a 100 km²: 10 metros', 'Más de 100 km²: 25 metros']],
    ['IG_2', 'Modelo de elevación digital de superficie'],
    ['IG_4', 'Fotografía aérea ortorectificada a color', ['Menos de 1 km²: resolución de 80 centímetros', 'De 1 a 25 km²: 2.5 metros', 'De 25 a 100 km²: 5 metros', 'Más de 100 km²: 10 metros']]
  ];
  F[70] = {
    titulo: 'Datos personales',
    subtitulo: 'Cuéntanos quién hace la solicitud',
    icono: 'ph-mountains',
    campos: [
      { tipo: 'nota', estilo: 'requisitos', titulo: 'Antes de empezar', lineas: ['Ten a mano estos documentos en formato digital:',
        '- Autorización de representación, solo si haces el trámite por otra persona (PDF, JPG, JPEG o PNG)',
        '- DUI, pasaporte o carnet de residencia (PDF, JPG, JPEG o PNG)',
        '- NIT, solo si eres persona jurídica (PDF, JPG, JPEG o PNG)',
        '- NIT o identificación de la institución (PDF, JPG, JPEG o PNG)',
        '- Carta de autorización de la autoridad correspondiente (PDF, JPG, JPEG o PNG)',
        '- Mapa de la zona en la que quieres el servicio (KMZ, RAR o ZIP)'] },
      { tipo: 'opciones', nombre: 'eres_el_dueo_del_tramite', etiqueta: '¿Para quién es el trámite?', opciones: [
        { valor: 'si', texto: 'Para mí', icono: 'ph-user' },
        { valor: 'no', texto: 'Para otra persona', icono: 'ph-users' }
      ] },
      archivo('autorizacion_terceros', 'Autorización por representación de terceros', { si: 'eres_el_dueo_del_tramite=no' }),
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      F[71].campos[1],
      F[71].campos[2],
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: 'tipo_documento_de_identidad=dui' },
      F[71].campos[3],
      F[71].campos[4]
    ],
    pasos: [
      { titulo: 'Datos de la investigación o proyecto', subtitulo: 'Cuéntanos de la institución y del uso de la información', campos: [
        { tipo: 'texto', nombre: 'nombre_de_la_institucion', etiqueta: 'Nombre de la institución', max: 150 },
        { tipo: 'texto', nombre: 'numero_de_nit_institucion', etiqueta: 'NIT o número de identificación de la institución', max: 30 },
        archivo('nit_institucion', 'NIT o identificación de la institución'),
        { tipo: 'opciones', nombre: 'tipo_de_solicitante', etiqueta: 'Tipo de solicitante', opciones: [
          { valor: 'alumno', texto: 'Alumno', icono: 'ph-student' },
          { valor: 'catedratico', texto: 'Catedrático', icono: 'ph-chalkboard-teacher' },
          { valor: 'investigador', texto: 'Investigador', icono: 'ph-flask' }
        ] },
        { tipo: 'texto', nombre: 'no_carnet', etiqueta: 'Número de carnet', max: 30 },
        { tipo: 'opciones', nombre: 'grado_academico', etiqueta: 'Grado académico', compacto: true, opciones: ['Colegio', 'Técnico', 'Universitario', 'Postgrado', 'Maestría', 'Doctorado'].map(g => ({ valor: sinTildes(g), texto: g })) },
        { tipo: 'nota', estilo: 'info', lineas: ['La carta debe estar autorizada por una autoridad de la institución académica (nacional o internacional), o por el titular de la institución o del proyecto de beneficio al país'] },
        archivo('carta_autorizacion', 'Carta de autorización de la autoridad correspondiente'),
        { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['La información es solo para uso investigativo, y el trabajo o resultado final debe compartirse con el MARN para aprovecharlo a nivel nacional y sustentar estudios futuros'] },
        { tipo: 'texto', nombre: 'nombre_investigacion_tesis', etiqueta: 'Nombre de la investigación o proyecto', max: 200 },
        { tipo: 'texto', nombre: 'uso_de_la_informacion', etiqueta: 'Explica el uso de la información', max: 500 }
      ] },
      { titulo: 'Selección de servicios', subtitulo: 'Elige los productos y la zona que necesitas', campos: [
        { tipo: 'opciones', nombre: 'IG', etiqueta: 'Servicios de sistemas de información geográfica', multiple: true, columna: true, opciones: SERVICIOS_LIDAR.map(([valor, texto]) => ({ valor, texto, detalle: 'Por km²', icono: valor === 'IG_4' ? 'ph-camera' : 'ph-mountains' })) },
        ...SERVICIOS_LIDAR.flatMap(([valor, texto, resoluciones]) => {
          const si = 'IG=' + valor;
          return [
            { tipo: 'seccion', titulo: texto, si },
            ...(resoluciones ? [{ tipo: 'nota', estilo: 'info', titulo: 'Resolución del producto', lineas: resoluciones.map(r => '- ' + r), si }] : []),
            { tipo: 'texto', nombre: 'area_a_solicitar_' + valor, etiqueta: 'Área a solicitar (km²)', ayuda: 'Por ejemplo 2.5', modo: 'numeric', max: 10, patron: '[0-9]+([.,][0-9]+)?', mensaje: 'Escribe el área en km², por ejemplo 2.5', media: true, si },
            { tipo: 'archivo', nombre: 'area_' + valor, etiqueta: 'Área a solicitar', ayuda: 'Formatos permitidos: KMZ, ZIP, RAR', acepta: '.kmz,.zip,.rar', media: true, si },
            { tipo: 'texto', nombre: 'solicitud_' + valor, etiqueta: 'Especifica tu requerimiento', ayuda: 'Detalles de la zona y cualquier otra información que consideres relevante', max: 500, si }
          ];
        })
      ] },
      ENVIAR
    ]
  };

  // MARN (trámite 332): personería, el permiso de incubación, el de recolección y la declaración jurada (el último paso). El
  // portal pide la ubicación en un mapa y agrega personas y playas en tablas; aquí van una persona y una playa, y las demás se
  // escriben aparte
  const FECHA_FUTURA = { ...FECHA_DMA, mensaje: 'Escribe la fecha como DD-MM-AAAA, por ejemplo 15-07-2026' };
  F[72] = {
    titulo: 'Registro de personería',
    subtitulo: 'Cuéntanos quién pide el permiso',
    icono: 'ph-waves',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'calidad_natural', etiqueta: '¿En qué calidad actúas?', si: NATURAL, opciones: [
        { valor: 'personal', texto: 'Personal', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Por otra persona', icono: 'ph-users' }
      ] },
      F[112].campos[2],
      { tipo: 'opciones', nombre: 'tipo_documento_titular', etiqueta: 'Tipo de documento de identidad del titular', compacto: true, si: NATURAL, opciones: [
        { valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet_de_residencia', texto: 'Carnet de residencia' }
      ] },
      { tipo: 'texto', nombre: 'doc_titular', etiqueta: 'Número de documento del titular', max: 20, si: NATURAL },
      { tipo: 'texto', nombre: 'numero_nit', etiqueta: 'NIT de la empresa', ...NIT_AAC, si: JURIDICA }
    ],
    pasos: [
      { titulo: 'Permiso de incubación', subtitulo: 'Cuéntanos de la actividad y del lugar', campos: [
        { tipo: 'texto', nombre: 'fundacion_respalda', etiqueta: 'Fundación u organización que respalda el proyecto', max: 150, opcional: true },
        { tipo: 'opciones', nombre: 'actividad_autorizar', etiqueta: 'Actividades a autorizar', multiple: true, columna: true, opciones: [
          { valor: 'corral', texto: 'Construcción o reparación y funcionamiento de corral de incubación', icono: 'ph-fence' },
          { valor: 'in_situ', texto: 'Incubación in situ', icono: 'ph-map-pin' },
          { valor: 'cajas', texto: 'Incubación en cajas o hielera', icono: 'ph-package' },
          { valor: 'construccion_caseta', texto: 'Construcción de caseta para vigilante', icono: 'ph-house-line' },
          { valor: 'reparacion_caseta', texto: 'Reparación de caseta para vigilante', icono: 'ph-wrench' },
          { valor: 'funcionamiento_caseta', texto: 'Funcionamiento de caseta para vigilante', icono: 'ph-eye' }
        ] },
        { tipo: 'texto', nombre: 'ubicacion_inmueble', etiqueta: 'Dirección del inmueble', max: 200 },
        { tipo: 'opciones', nombre: 'tipo_inmueble', etiqueta: 'Tipo de inmueble donde se hará la actividad', opciones: [
          { valor: 'privada', texto: 'Privado', icono: 'ph-house' },
          { valor: 'estatal', texto: 'Estatal', icono: 'ph-bank' }
        ] },
        { tipo: 'texto', nombre: 'dimension_infraestructura', etiqueta: 'Dimensión de la infraestructura para vigilantes (m²)', ayuda: 'Por ejemplo 12', modo: 'numeric', max: 8, patron: '[0-9]+([.,][0-9]+)?', mensaje: 'Escribe solo números, por ejemplo 12', media: true },
        { tipo: 'texto', nombre: 'huevos_recolectar', etiqueta: 'Huevos a recolectar por temporada', ayuda: 'Una estimación, por ejemplo 500', modo: 'numeric', max: 6, patron: '[0-9]+', mensaje: 'Escribe solo números, por ejemplo 500', media: true },
        { tipo: 'opciones', nombre: 'corral_anio_pasado', etiqueta: '¿El año pasado se construyó corral?', opciones: SI_NO },
        { tipo: 'opciones', nombre: 'anio_funciono_corral', etiqueta: '¿Funcionó el corral el año pasado?', opciones: SI_NO, si: 'corral_anio_pasado=si' },
        { tipo: 'opciones', nombre: 'construir_reparar_corral', etiqueta: '¿Construirás un corral o repararás el del año pasado?', si: 'corral_anio_pasado=si', opciones: [
          { valor: 'construir', texto: 'Construir', icono: 'ph-hammer' },
          { valor: 'reparar', texto: 'Reparar', icono: 'ph-wrench' }
        ] },
        { tipo: 'texto', nombre: 'materiales_corral', etiqueta: '¿De qué materiales construirás el corral?', max: 300 },
        { tipo: 'texto', nombre: 'fecha_inicio_funcionamiento', etiqueta: 'Inicio de funcionamiento', ...FECHA_FUTURA, media: true },
        { tipo: 'texto', nombre: 'fecha_fin_funcionamiento', etiqueta: 'Fin de funcionamiento', ...FECHA_FUTURA, media: true },
        { tipo: 'opciones', nombre: 'tramites_anteriores', etiqueta: '¿Has hecho trámites similares en años anteriores?', opciones: SI_NO },
        { tipo: 'texto', nombre: 'cod_resolucion', etiqueta: 'Código de resolución del trámite anterior', max: 30, si: 'tramites_anteriores=si' },
        archivo('croquis', 'Croquis de ubicación del proyecto'),
        archivo('documento_inmueble', 'Escritura o autorización de uso del inmueble', { ...SOLO_PDF, ayuda: 'Si eres propietario, la escritura de compraventa; si no, el documento legal que autoriza su uso. En playa pública no hace falta. Formato permitido: PDF', opcional: true })
      ] },
      { titulo: 'Permiso de recolección', subtitulo: 'Especies, personas y playas del permiso', campos: [
        { tipo: 'opciones', nombre: 'especies_tortugas', etiqueta: 'Especies de tortugas del permiso', multiple: true, dosColumnas: true, opciones: [
          ['golfina', 'Tortuga golfina', 'Lepidochelys olivacea'], ['carey', 'Tortuga carey', 'Eretmochelys imbricata'],
          ['prieta', 'Tortuga prieta', 'Chelonia mydas'], ['baule', 'Tortuga baule', 'Dermochelys coriacea']
        ].map(([valor, texto, detalle]) => ({ valor, texto, detalle, icono: 'ph-waves' })) },
        { tipo: 'seccion', titulo: 'Persona para la que pides permiso' },
        { tipo: 'texto', nombre: 'nombre_persona_permiso', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'dui_persona_permiso', etiqueta: 'Número de DUI', ...FORMATO_DUI, media: true },
        { tipo: 'opciones', nombre: 'funciones_persona', etiqueta: 'Funciones a realizar', multiple: true, dosColumnas: true, opciones: ['Responsable del corral de incubación', 'Técnico', 'Recolector', 'Rastreador', 'Marcaje'].map(f => ({ valor: sinTildes(f).replace(/ /g, '_'), texto: f })) },
        { tipo: 'texto', nombre: 'otras_personas', etiqueta: 'Otras personas', ayuda: 'Nombre, DUI y funciones de cada una', max: 500, opcional: true },
        { tipo: 'seccion', titulo: 'Playa donde se hará la recolecta' },
        { tipo: 'texto', nombre: 'nombre_playa', etiqueta: 'Nombre de la playa', max: 30 },
        { tipo: 'lista', nombre: 'departamento_playa', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_playa', etiqueta: 'Municipio', depende: 'departamento_playa', opcionesPor: MUNICIPIOS_2024, media: true },
        { tipo: 'texto', nombre: 'direccion_playa', etiqueta: 'Dirección', max: 50 },
        { tipo: 'texto', nombre: 'otras_playas', etiqueta: 'Otras playas', ayuda: 'Nombre, departamento, municipio y dirección de cada una', max: 500, opcional: true },
        { tipo: 'nota', estilo: 'info', titulo: 'Carpeta de documentos', lineas: ['Sube una carpeta comprimida en ZIP con el escaneo a color, legible y vigente, del documento de identidad de cada persona del proyecto: recolectores, rastreadores, marcadores, viveristas y personal técnico'] },
        { tipo: 'archivo', nombre: 'documentos_personal', etiqueta: 'Documentos del personal autorizado', ayuda: 'Formato permitido: ZIP', acepta: '.zip' }
      ] },
      { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta los términos', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Consentimiento, términos y condiciones', lineas: ['Si te conceden la autorización, te comprometes a cumplir las condiciones que se te indiquen y los lineamientos técnicos del Ministerio de Medio Ambiente y Recursos Naturales'] },
        { tipo: 'opciones', nombre: 'acepto_terminos', etiqueta: '¿Estás de acuerdo con los términos y condiciones?', marcado: true, opciones: [{ valor: 'si', texto: 'Sí, estoy de acuerdo', icono: 'ph-check-circle' }] }
      ] },
      ENVIAR
    ]
  };

  // 69 (trámite 408), leído el 4 de noviembre de 2026 solo hasta la nota legal: aceptarla le toca al ciudadano
  F[69] = {
    titulo: 'Nota legal',
    subtitulo: 'Certificación técnica para fines judiciales y de seguros',
    icono: 'ph-scales',
    campos: [
      { tipo: 'nota', estilo: 'aviso', titulo: 'Nota legal', lineas: [
        'Si proporcionas información falsa, cometes el delito de estafa informática (artículo 10 de la Ley Especial contra los Delitos Informáticos y Conexos) y el trámite se elimina automáticamente',
        'El MARN puede tomar las medidas que considere pertinentes, incluido el aviso a la Fiscalía General de la República',
        'Después de pagar, no se devuelve el dinero'
      ] },
      { tipo: 'opciones', nombre: 'confirmacion', etiqueta: '¿Aceptas la nota legal?', marcado: true, opciones: [{ valor: 'acepto', texto: 'He leído y acepto los términos legales', icono: 'ph-handshake' }] }
    ],
    pasos: [{ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['Después de aceptar la nota legal, el MARN te pide los datos y los documentos del trámite'] }, ...ENVIAR.campos] }]
  };

  /* ===== Agricultura (MAG) ===== */
  // MAG (mag.ventanilla.simple.sv, trámite 58): el mismo formulario para las dos exoneraciones (agrícola, 66, y veterinaria, 67),
  // con el tipo ya elegido: solicitante, producto y factura con sus documentos (el último paso)
  const ACEPTA_MAG = { ayuda: 'Formatos permitidos: JPG, JPEG, PNG, PDF, DOC, DOCX', acepta: '.jpg,.jpeg,.png,.pdf,.doc,.docx' };
  const EXONERACION_MAG = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Cuéntanos quién importa el producto',
    icono: 'ph-package',
    campos: [
      { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'empresa_importadora', etiqueta: 'Empresa importadora o nombre del consignatario', max: 150 },
      { tipo: 'opciones', nombre: 'tipo_de_exoneracion', etiqueta: 'Tipo de exoneración de visado de importación', opciones: [
        { valor: 'exoneracion_agricola', texto: 'Exoneración agrícola', detalle: 'Productos agrícolas o vegetales', icono: 'ph-plant' },
        { valor: 'exoneracion_veterinaria', texto: 'Exoneración veterinaria', detalle: 'Productos veterinarios o para animales', icono: 'ph-paw-print' }
      ] },
      { tipo: 'nota', estilo: 'info', lineas: ['Si haces el trámite por otra persona, adjunta la carta de autorización de la empresa con los datos del tramitador (DUI, nombre completo, teléfono y correo) y la firma del representante legal o propietario'] },
      archivo('carta_autorizacion', 'Carta de autorización de la empresa', { opcional: true })
    ],
    pasos: [
      { titulo: 'Datos del producto', subtitulo: 'Cuéntanos qué vas a importar', campos: [
        { tipo: 'texto', nombre: 'nombre_producto', etiqueta: 'Nombre del producto', max: 150, media: true },
        { tipo: 'texto', nombre: 'fabricante', etiqueta: 'Fabricante', max: 150, media: true },
        { tipo: 'lista', nombre: 'pais_origen', etiqueta: 'País de origen', opciones: PAISES_MUNDO, media: true },
        { tipo: 'lista', nombre: 'pais_procedencia', etiqueta: 'País de procedencia', opciones: PAISES_MUNDO, media: true },
        { tipo: 'texto', nombre: 'uso_producto', etiqueta: 'Uso específico del producto', max: 300 }
      ] },
      { titulo: 'Factura y documentos', subtitulo: 'Adjunta los documentos del producto', campos: [
        { tipo: 'texto', nombre: 'numero_partida_arancelaria', etiqueta: 'Número de partida arancelaria', max: 20, media: true },
        { tipo: 'texto', nombre: 'numero_factura', etiqueta: 'Número de factura', max: 30, media: true },
        { tipo: 'nota', estilo: 'info', lineas: ['Los documentos deben estar en español'] },
        archivo('factura', 'Factura', ACEPTA_MAG),
        archivo('etiqueta_producto', 'Etiqueta del producto', ACEPTA_MAG),
        archivo('ficha_tecnica', 'Ficha técnica del producto', ACEPTA_MAG),
        archivo('hoja_seguridad', 'Hoja de seguridad del producto', ACEPTA_MAG)
      ] },
      ENVIAR
    ]
  };
  // MAG (trámite 298): matrícula de fierro para herrar ganado. El último paso pide el diseño del fierro (primera vez), la
  // matrícula vencida (refrenda) o la nota de extravío (reposición); el MAG revisa la solicitud y después indica el pago.
  // Para un tercero, el portal trae su nombre desde el DUI; aquí se escribe
  const PARA_TERCERO_MAG = 'a_nombre_de=tercero';
  const OFICINAS_MAG = ['Sede principal Santa Tecla', 'Sede de Matazano', 'Sede regional San Miguel', 'Sede regional Santa Ana', 'Sede regional Chalatenango', 'Sede regional Sonsonate'].map(o => [o, o]);
  const DOCUMENTO_MAG = (nombre, etiqueta, si) => archivo(nombre, etiqueta, { ayuda: FORMATOS_IMAGEN + '. Hasta 15 MB', si });
  F[65] = {
    titulo: 'Información general',
    subtitulo: 'Cuéntanos qué trámite de matrícula necesitas',
    icono: 'ph-cow',
    campos: [
      { tipo: 'opciones', nombre: 'tramite_seleccionado', etiqueta: 'Trámite que deseas realizar', opciones: [
        { valor: 'primera_vez', texto: 'Primera vez', icono: 'ph-plus-circle' },
        { valor: 'refrenda', texto: 'Refrenda', icono: 'ph-arrows-clockwise' },
        { valor: 'reposicion', texto: 'Reposición', icono: 'ph-copy' }
      ] },
      { tipo: 'opciones', nombre: 'a_nombre_de', etiqueta: 'El trámite es', opciones: [
        { valor: 'personal', texto: 'Para mí', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Para otra persona', icono: 'ph-users' }
      ] },
      { tipo: 'texto', nombre: 'dui_del_titular', etiqueta: 'DUI del titular', ...FORMATO_DUI, si: PARA_TERCERO_MAG },
      { tipo: 'lista', nombre: 'oficina_resultados', etiqueta: 'Oficina donde recogerás tus documentos', opciones: OFICINAS_MAG },
      { tipo: 'opciones', nombre: 'tipo_comprobante', etiqueta: 'Comprobante de pago', opciones: [
        { valor: 'factura', texto: 'Factura', icono: 'ph-receipt' },
        { valor: 'ccf', texto: 'Comprobante de crédito fiscal', icono: 'ph-file-text' }
      ] },
      { tipo: 'texto', nombre: 'nrc', etiqueta: 'NRC', ...NRC_AAC, si: 'tipo_comprobante=ccf' }
    ],
    pasos: [
      { titulo: 'Información personal', subtitulo: 'Confirma tus datos y dinos dónde contactarte', campos: [
        { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true, si: 'a_nombre_de=personal' },
        { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true, si: 'a_nombre_de=personal' },
        { tipo: 'seccion', titulo: 'Datos del titular', si: PARA_TERCERO_MAG },
        { tipo: 'texto', nombre: 'nombre_titular', etiqueta: 'Nombre completo del titular', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: PARA_TERCERO_MAG },
        { tipo: 'texto', nombre: 'correo_titular', etiqueta: 'Correo electrónico del titular', modo: 'email', placeholder: 'nombre@correo.com', si: PARA_TERCERO_MAG, media: true },
        { tipo: 'texto', nombre: 'confirmar_correo_titular', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_titular', mensaje: 'Las direcciones de correo electrónico no coinciden', si: PARA_TERCERO_MAG, media: true },
        { tipo: 'seccion', titulo: 'Domicilio y contacto' },
        { tipo: 'lista', nombre: 'departamento', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio', etiqueta: 'Municipio', depende: 'departamento', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'texto', nombre: 'direccion_titular', etiqueta: 'Dirección completa', ayuda: 'Calle o avenida, número de casa, edificio o apartamento y colonia o barrio', max: 200 },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono de contacto' }
      ] },
      { titulo: 'Diseño del fierro', subtitulo: 'Elige cómo será la figura', si: 'tramite_seleccionado=primera_vez', campos: [
        { tipo: 'opciones', nombre: 'tipo_figura', etiqueta: '¿Qué tipo de diseño quieres para tu figura?', opciones: [
          { valor: 'numerico', texto: 'Numérico', icono: 'ph-hash' },
          { valor: 'especial', texto: 'Especial', icono: 'ph-pen-nib' }
        ] },
        DOCUMENTO_MAG('forma_fierro', 'Diseño del fierro', 'tipo_figura=especial')
      ] },
      { titulo: 'Documentación', subtitulo: 'Adjunta tu matrícula vencida', si: 'tramite_seleccionado=refrenda', campos: [
        DOCUMENTO_MAG('matricula_vencida', 'Matrícula vencida')
      ] },
      { titulo: 'Documentación', subtitulo: 'Adjunta el comprobante del extravío', si: 'tramite_seleccionado=reposicion', campos: [
        DOCUMENTO_MAG('nota_extravio', 'Nota de extravío de la alcaldía o denuncia policial')
      ] },
      { ...ENVIAR, campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['El MAG revisa tu solicitud y después te indica el pago', '- Reposición de matrícula extraviada: $21.89', '- Refrenda de matrícula para herrar ganado: $43.79', '- Refrenda de matrícula especial: $90.40'] },
        ...ENVIAR.campos
      ] }
    ]
  };
  F[66] = { ...EXONERACION_MAG, preseleccion: { tipo_de_exoneracion: 'exoneracion_agricola' } };
  F[67] = { ...EXONERACION_MAG, preseleccion: { tipo_de_exoneracion: 'exoneracion_veterinaria' } };

  // MAG (trámite 340): el DUI del representante legal y el tipo de asamblea; el portal verifica el DUI y, en el último paso, trae
  // su nombre y pide los datos de la asociación, del acta del consejo y de la asamblea, con su agenda (los tres primeros puntos
  // son fijos y se agregan hasta 10)
  const HORA_12 = { placeholder: '2:45 PM', max: 11, patron: '(0?[1-9]|1[0-2]):[0-5][0-9] ?([AaPp]\\.? ?[Mm]\\.?)', mensaje: 'Escribe la hora en formato de 12 horas, por ejemplo 2:45 PM' };
  const PUNTOS_AGENDA = [4, 5, 6, 7, 8, 9, 10].map(n => ({ tipo: 'texto', nombre: 'punto_' + n, etiqueta: 'Punto ' + n, max: 200, ...(n > 4 ? { opcional: true, si: `punto_${n - 1}!=` } : {}) }));
  F[68] = {
    titulo: 'Representante legal',
    subtitulo: 'Cuéntanos quién notifica la asamblea',
    icono: 'ph-users-three',
    campos: [
      { tipo: 'texto', nombre: 'dui_representante_legal', etiqueta: 'DUI del representante legal', ...FORMATO_DUI },
      { tipo: 'opciones', nombre: 'tipo', etiqueta: 'Asamblea de carácter', opciones: [
        { valor: 'ordinaria', texto: 'Ordinaria', icono: 'ph-calendar-check' },
        { valor: 'extraordinaria', texto: 'Extraordinaria', icono: 'ph-warning-circle' }
      ] }
    ],
    pasos: [
      { titulo: 'Datos de la asamblea', subtitulo: 'Asociación, acta del consejo y asamblea a celebrar', campos: [
        { tipo: 'texto', nombre: 'nombres_representante_legal', etiqueta: 'Nombre del representante legal', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { ...TELEFONO, nombre: 'telefono_representante', etiqueta: 'Teléfono de contacto', ayuda: 'Fijo o celular', media: true },
        { tipo: 'seccion', titulo: 'Datos de la asociación' },
        { tipo: 'texto', nombre: 'nombre_asociacion', etiqueta: 'Nombre de la asociación', ayuda: 'Escríbelo completo, sin abreviaturas', max: 200 },
        { tipo: 'texto', nombre: 'codificacion', etiqueta: 'Código del Departamento de Asociaciones Agropecuarias', max: 20, opcional: true },
        { tipo: 'lista', nombre: 'departamento_asociacion', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'distrito_asociacion', etiqueta: 'Distrito', depende: 'departamento_asociacion', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'seccion', titulo: 'Acta del consejo de administración' },
        { tipo: 'texto', nombre: 'fecha_reunion_consejo', etiqueta: 'Fecha de la reunión del consejo', ...FECHA_DMA, media: true },
        { tipo: 'texto', nombre: 'numero_acta', etiqueta: 'Número de acta', max: 20, media: true },
        archivo('acta_consejo', 'Acta del consejo de administración', { ayuda: 'Donde se tomó el acuerdo de notificar la asamblea, con las firmas de los presentes. ' + FORMATOS_IMAGEN }),
        { tipo: 'seccion', titulo: 'Asamblea a celebrar' },
        { tipo: 'texto', nombre: 'lugar', etiqueta: 'Lugar de la reunión', ayuda: 'Punto de referencia, caserío o cantón, colonia o barrio', max: 200 },
        { tipo: 'texto', nombre: 'fecha_asamblea', etiqueta: 'Fecha propuesta', ...FECHA_FUTURA, opcional: true, media: true },
        { tipo: 'texto', nombre: 'hora', etiqueta: 'Hora propuesta', ayuda: 'Por ejemplo 2:45 PM', ...HORA_12, media: true },
        { tipo: 'seccion', titulo: 'Agenda propuesta' },
        { tipo: 'nota', estilo: 'info', lineas: ['Los tres primeros puntos son obligatorios y ya vienen incluidos:', '- 1. Comprobación de quórum', '- 2. Aprobación o modificación de la agenda', '- 3. Lectura, aprobación o modificación del acta anterior', 'Escribe desde el punto 4; cada punto que escribas abre el siguiente, hasta el 10'] },
        ...PUNTOS_AGENDA
      ] },
      ENVIAR
    ]
  };

  /* ===== Competencia ===== */
  // Superintendencia de Competencia (sc.ventanilla.simple.sv, trámite 364): con 1 a 4 personas es una consulta y el primer paso es
  // el último; con 5 o más pide los datos de quien solicita y una planilla de la capacitación (el portal deja agregar más
  // planillas y filas; aquí va una de cada una)
  const CAPACITACION = 'Num_perso=5';
  const TEMAS_COMPETENCIA = ['Beneficios de la competencia', 'Introducción al derecho de competencia', 'Presentación general de la Ley de Competencia', 'Prácticas anticompetitivas',
    'Concentraciones económicas', 'Competencia y competencia desleal', 'Promoción de competencia (estudios, opiniones, etc.)', 'Clemencia', 'Competencia y compras públicas',
    'Programa de cumplimiento en competencia (compliance)', 'Asociaciones y gremiales y competencia', 'Competencia y el ejercicio profesional', 'Otros'].map(t => [t, t]);
  F[115] = {
    titulo: 'Datos de la solicitud',
    subtitulo: 'Cuéntanos quién eres y qué necesitas',
    icono: 'ph-scales',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Documento de identidad', compacto: true, opciones: [
        { valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet_de_residencia', texto: 'Carnet de residencia' }
      ] },
      { tipo: 'texto', nombre: 'dui_titular', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: 'tipo_de_documento=dui' },
      { tipo: 'opciones', nombre: 'Num_perso', etiqueta: '¿Cuántas personas quieren recibir la capacitación?', opciones: [
        { valor: '1_4', texto: 'De 1 a 4', detalle: 'Haz una consulta', icono: 'ph-user' },
        { valor: '5', texto: '5 o más', detalle: 'Pide una capacitación', icono: 'ph-users-three' }
      ] },
      { tipo: 'nota', estilo: 'info', si: 'Num_perso=1_4', lineas: ['Puedes consultar sobre un tema específico del derecho de competencia, por ejemplo:',
        '- Plantear un posible caso de prácticas anticompetitivas', '- Saber si una situación sospechosa es o no de competencia',
        '- Conocer los requisitos para pedir autorización de una concentración', '- Conocer los requisitos para presentar una denuncia'] },
      { tipo: 'texto', nombre: 'consulta', etiqueta: 'Escribe tu consulta', max: 1000, si: 'Num_perso=1_4' }
    ],
    pasos: [
      { titulo: 'Datos del solicitante', subtitulo: 'Revisa tus datos y escribe cómo contactarte', si: CAPACITACION, campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true },
        { tipo: 'texto', nombre: 'edad', etiqueta: 'Edad', max: 10, media: true },
        { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión u oficio', max: 100, media: true },
        { tipo: 'seccion', titulo: 'Datos de contacto' },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
        { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección', max: 200 },
        { tipo: 'lista', nombre: 'departamento_solicitante', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'distrito_solicitante', etiqueta: 'Distrito', depende: 'departamento_solicitante', opcionesPor: MUNICIPIOS, media: true }
      ] },
      { titulo: 'Planilla de la capacitación', subtitulo: 'Cuéntanos quiénes la recibirán y sobre qué tema', si: CAPACITACION, campos: [
        { tipo: 'opciones', nombre: 'tipo_de_organizacion', etiqueta: 'Tipo de organización', compacto: true, opciones: ['Pública', 'Privada', 'ONG', 'Academia', 'Gobierno', 'Otros'].map(o => ({ valor: sinTildes(o), texto: o })) },
        { tipo: 'texto', nombre: 'nombre_de_la_institucion', etiqueta: 'Nombre de la institución', max: 150 },
        { tipo: 'seccion', titulo: 'Personas interesadas' },
        { tipo: 'texto', nombre: 'cantidad_personas', etiqueta: 'Cantidad de personas', ayuda: 'Por ejemplo 10', modo: 'numeric', max: 4, patron: '[0-9]+', mensaje: 'Escribe solo números, por ejemplo 10' },
        { tipo: 'opciones', nombre: 'perfil_del_puesto', etiqueta: 'Perfil del puesto', compacto: true, opciones: ['Jefaturas', 'Técnicos', 'Directivos', 'Mandos medios', 'Grupo mixto', 'Estudiantes'].map(p => ({ valor: sinTildes(p).replace(/ /g, '_'), texto: p })) },
        { tipo: 'seccion', titulo: 'Tema de interés' },
        { tipo: 'lista', nombre: 'nombre_tema', etiqueta: 'Tema', opciones: TEMAS_COMPETENCIA },
        { tipo: 'texto', nombre: 'especificar_tema', etiqueta: 'Especifica el tema', max: 150, si: 'nombre_tema=Otros' },
        { tipo: 'texto', nombre: 'horas_disponibles', etiqueta: 'Tiempo disponible (horas)', ayuda: 'Por ejemplo 4', modo: 'numeric', max: 3, patron: '[0-9]+', mensaje: 'Escribe solo números, por ejemplo 4' },
        { tipo: 'opciones', nombre: 'modalidad_capacitacion', etiqueta: 'Modalidad', compacto: true, opciones: [
          { valor: 'presencial', texto: 'Presencial' }, { valor: 'en_linea', texto: 'En línea' }, { valor: 'hibrida', texto: 'Híbrida' }
        ] },
        { tipo: 'texto', nombre: 'fecha_capacitacion', etiqueta: 'Fecha de la capacitación', ...FECHA_FUTURA, media: true },
        { tipo: 'texto', nombre: 'hora_capacitacion', etiqueta: 'Hora', ayuda: 'Por ejemplo 9:00 AM', ...HORA_12, placeholder: '9:00 AM', media: true },
        { tipo: 'texto', nombre: 'alcances_y_comentarios', etiqueta: 'Alcances y comentarios', max: 500 }
      ] },
      ENVIAR
    ]
  };

  /* ===== Veteranos (INABVE) ===== */
  // INABVE (inabve.ventanilla.simple.sv, trámite 406): calidad en la que se actúa y, después, el portal verifica el DUI en el
  // registro de pensionados y muestra el resumen de la pensión con sus descuentos. No se vio ese resumen: la cuenta de prueba no
  // es de un pensionado, así que llega hasta la verificación
  F[116] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Cuéntanos de quién es la pensión',
    icono: 'ph-medal',
    campos: [
      { tipo: 'opciones', nombre: 'personeria', etiqueta: 'Calidad en la que actúas', opciones: [
        { valor: 'personal', texto: 'Personal', detalle: 'La pensión es tuya', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Tercero autorizado', detalle: 'Por un pensionado', icono: 'ph-users' }
      ] },
      { tipo: 'texto', nombre: 'dui_veterano', etiqueta: 'DUI del pensionado', ...FORMATO_DUI, si: 'personeria=tercero' },
      { tipo: 'seccion', titulo: 'Datos del tercero autorizado', si: 'personeria=tercero' },
      { tipo: 'texto', nombre: 'nombre_tercero', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true, si: 'personeria=tercero' },
      { tipo: 'texto', nombre: 'parentesco', etiqueta: 'Parentesco', max: 50, media: true, si: 'personeria=tercero' }
    ],
    pasos: [
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['El INABVE verifica que el DUI esté en el registro de pensionados y te muestra el resumen de la pensión con sus descuentos'] }, ...ENVIAR.campos] }
    ]
  };

  /* ===== Hidrocarburos (DGEHM) ===== */
  const PDF_DGEHM = (nombre, etiqueta, ayuda = '', extra = {}) => ({ tipo: 'archivo', nombre, etiqueta, ayuda: ayuda ? `${ayuda}. Formato PDF` : 'Formato PDF', acepta: '.pdf', ...extra });
  const PDF_ZIP_DGEHM = (nombre, etiqueta, extra = {}) => ({ tipo: 'archivo', nombre, etiqueta, ayuda: 'Si son varios fabricantes, súbelos en un ZIP. Formatos permitidos: PDF, ZIP', acepta: '.pdf,.zip', ...extra });
  const SERIES_DGEHM = () => ({ tipo: 'archivo', nombre: 'listado_numeros_serie', etiqueta: 'Listado con los números de serie de todos los ítems del lote', ayuda: 'Formatos permitidos: JPG, JPEG, PNG, PDF, XLS, XLSX', acepta: '.jpg,.jpeg,.png,.pdf,.xls,.xlsx' });
  const AMBAS_CARAS = 'Las dos caras en un solo archivo';
  const DOCUMENTOS_DGEHM = [{ valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet_de_residencia', texto: 'Carnet de residencia' }];
  const DELEGACION_DGEHM = [
    { tipo: 'seccion', titulo: 'Delegación del trámite' },
    { tipo: 'opciones', nombre: 'autoriza_apoderado', etiqueta: '¿Harás el trámite por medio de un apoderado legal?', opciones: SI_NO },
    { tipo: 'opciones', nombre: 'autoriza_notificaciones', etiqueta: '¿Autorizas a otra persona para recibir notificaciones?', opciones: SI_NO }
  ];
  // Documento de identidad del titular (persona natural) y NIT de la empresa (persona jurídica)
  const TITULAR_DGEHM = [
    { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
    { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Documento de identidad', compacto: true, opciones: DOCUMENTOS_DGEHM, si: NATURAL },
    { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: 'tipo_de_documento=dui' },
    { tipo: 'texto', nombre: 'numero_de_pasaporte', etiqueta: 'Número de pasaporte', max: 20, si: 'tipo_de_documento=pasaporte' },
    { tipo: 'texto', nombre: 'numero_de_carnet', etiqueta: 'Número de carnet de residencia', max: 20, si: 'tipo_de_documento=carnet_de_residencia' },
    { tipo: 'texto', nombre: 'nit_empresa', etiqueta: 'NIT de la empresa', ...NIT_AAC, si: JURIDICA }
  ];
  // Teléfonos y correo (s: sufijo de los campos; sin sufijo son los de quien inició sesión)
  const contactoDgehm = (s = '') => [
    { ...TELEFONO, nombre: 'telefono' + s, etiqueta: 'Teléfono móvil', media: true },
    { ...TELEFONO, nombre: 'telefono_fijo' + s, etiqueta: 'Teléfono fijo', opcional: true, media: true },
    { tipo: 'texto', nombre: 'correo_notificaciones' + s, etiqueta: 'Correo electrónico', modo: 'email', media: true },
    { ...CONFIRMAR_CORREO_AAC, nombre: 'confirmar_correo' + s, etiqueta: 'Confirma el correo', igualA: 'correo_notificaciones' + s, media: true }
  ];
  // Documento de identidad de otra persona (s: sufijo de sus campos). Con DUI la DGEHM trae el nombre del RNPN; con pasaporte o
  // carnet de residencia pide el nombre, el NIT y su imagen
  const identidadDgehm = (s, quien) => {
    const tipo = 'tipo_documento_' + s;
    const sinDui = tipo + '!=dui';
    return [
      { tipo: 'opciones', nombre: tipo, etiqueta: 'Documento de identidad ' + quien, compacto: true, opciones: DOCUMENTOS_DGEHM },
      { tipo: 'texto', nombre: 'dui_' + s, etiqueta: 'Número de DUI', ...FORMATO_DUI, si: tipo + '=dui' },
      { tipo: 'texto', nombre: 'pasaporte_' + s, etiqueta: 'Número de pasaporte', max: 20, si: tipo + '=pasaporte' },
      { tipo: 'texto', nombre: 'carnet_' + s, etiqueta: 'Número de carnet de residencia', max: 20, si: tipo + '=carnet_de_residencia' },
      { tipo: 'texto', nombre: 'nombre_' + s, etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: sinDui },
      { tipo: 'texto', nombre: 'nit_' + s, etiqueta: 'NIT', ...NIT_AAC, si: sinDui },
      PDF_DGEHM('documento_identidad_' + s, 'Imagen del documento de identidad', AMBAS_CARAS + '; del pasaporte, la hoja con los datos personales'),
      PDF_DGEHM('imagen_nit_' + s, 'Imagen del NIT', AMBAS_CARAS, { si: sinDui })
    ];
  };
  const NRC_DGEHM = [
    { tipo: 'texto', nombre: 'numero_nrc', etiqueta: 'Número de Registro de Contribuyente (NRC)', ...NRC_AAC },
    PDF_DGEHM('imagen_nrc', 'Imagen de la tarjeta de NRC', AMBAS_CARAS)
  ];
  const NOTA_EMPRESA_DGEHM = { tipo: 'nota', estilo: 'info', lineas: ['Con el NIT, la DGEHM trae del Registro de Comercio la razón social, la dirección, la actividad y el rubro de la empresa y los datos del establecimiento'] };
  const APODERADO_DGEHM = { titulo: 'Apoderado legal', subtitulo: 'Cuéntanos quién hace el trámite por ti', si: 'autoriza_apoderado=si', campos: [
    ...identidadDgehm('apoderado', 'del apoderado'),
    PDF_DGEHM('poder', 'Poder con que actúa', 'Documento privado con firma legalizada o poder, completo en un solo archivo')
  ] };
  const DECLARACION_DGEHM = { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta la declaración', campos: [
    { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración de documentos adjuntos', lineas: ['Declaras bajo juramento que los documentos que adjuntas son conformes con los originales. Si se comprueba alteración o falsedad, asumes las consecuencias legales, administrativas y judiciales y la anulación de oficio del trámite'] },
    { tipo: 'opciones', nombre: 'declaracion_de_documentos', etiqueta: 'Declaración jurada', marcado: true, opciones: [{ valor: 'acepto', texto: 'Lo declaro bajo juramento', icono: 'ph-seal-check' }] }
  ] };

  // DGEHM (dgehm.ventanilla.simple.sv, trámite 234): un formulario para los nueve trámites de GLP (18 a 26), con el producto ya
  // elegido. La DGEHM verifica el DUI en el RNPN y el NIT de la empresa en el Registro de Comercio; después pide los datos de
  // quien solicita, de quien recibe notificaciones y del apoderado, si los hay, el detalle del producto y la declaración jurada
  // (el último paso). En el portal el detalle es una tabla a la que se agregan ítems; aquí va uno y un campo para los demás
  const PRODUCTOS_GLP = [
    ['importar_cilindros', 'Importación de cilindros portátiles para envasado de GLP', 'ph-cylinder'],
    ['importar_valvulas', 'Importación de válvulas para cilindros portátiles para GLP', 'ph-wrench'],
    ['importar_accesorios', 'Importación de accesorios para cilindros portátiles para GLP', 'ph-puzzle-piece'],
    ['importar_reguladores', 'Importación de reguladores de baja presión para GLP', 'ph-gauge'],
    ['exportar_cilindros', 'Exportación de cilindros portátiles para GLP', 'ph-export'],
    ['comercializar_cilindros', 'Uso en el mercado nacional de cilindros portátiles para GLP', 'ph-storefront'],
    ['exportar_glp', 'Exportación de GLP a granel', 'ph-drop'],
    ['reexportar_glp', 'Reexportación de GLP a granel', 'ph-arrows-clockwise'],
    ['comercializar_reguladores', 'Uso en el mercado nacional de reguladores de baja presión para GLP', 'ph-storefront']
  ].map(([valor, texto, icono]) => ({ valor, texto, icono }));
  const FABRICANTE_GLP = { tipo: 'texto', nombre: 'fabricante', etiqueta: 'Fabricante', max: 35, media: true };
  const CANTIDAD_GLP = { tipo: 'texto', nombre: 'cantidad', etiqueta: 'Cantidad', ayuda: 'Por ejemplo 500', modo: 'numeric', max: 7, patron: '[1-9][0-9]*', mensaje: 'Escribe solo números, por ejemplo 500', media: true };
  const CAPACIDAD_CILINDRO = { tipo: 'texto', nombre: 'capacidad', etiqueta: 'Capacidad (libras)', ayuda: 'No mayor a 100 libras, por ejemplo 25', modo: 'numeric', max: 6, patron: '(100|[1-9][0-9]?)([.,][0-9]{1,2})?', mensaje: 'Escribe la capacidad en libras, hasta 100, por ejemplo 25', media: true };
  const UNIDAD_REGULADOR = { tipo: 'opciones', nombre: 'unidad_de_medida', etiqueta: 'Unidad de medida', opciones: [
    { valor: 'kpa', texto: 'Kilopascal', detalle: 'kPa', icono: 'ph-gauge' }, { valor: 'psi', texto: 'Libra por pulgada cuadrada manométrica', detalle: 'psi', icono: 'ph-gauge' }
  ] };
  const CAPACIDAD_REGULADOR = { tipo: 'texto', nombre: 'capacidad_regulador', etiqueta: 'Capacidad', ayuda: 'Hasta 3.00 kPa o 0.44 psi', modo: 'numeric', max: 4, patron: '[0-3]([.,][0-9]{1,2})?', mensaje: 'Escribe la capacidad, hasta 3.00 kPa o 0.44 psi, por ejemplo 2.75', media: true };
  const PAIS_GLP = (nombre, etiqueta) => ({ tipo: 'lista', nombre, etiqueta, opciones: PAISES_MUNDO, media: true });
  const TRANSPORTE_GLP = { tipo: 'opciones', nombre: 'medio_de_transporte', etiqueta: 'Medio de transporte', compacto: true, opciones: [
    { valor: 'aereo', texto: 'Aéreo' }, { valor: 'maritimo', texto: 'Marítimo' }, { valor: 'terrestre', texto: 'Terrestre' }
  ] };
  const OTROS_ITEMS_GLP = { tipo: 'texto', nombre: 'otros_items', etiqueta: 'Otros ítems', ayuda: 'Si son varios, escribe los mismos datos de cada uno', max: 500, opcional: true };
  const USO_CILINDROS = { tipo: 'texto', nombre: 'uso_cilindros', etiqueta: '¿Qué uso le darás al lote de cilindros?', ayuda: 'Si son varios lotes y presentaciones, detalla cada uno', max: 500 };
  const itemGlp = (producto, titulo, item, despues = []) => ({ titulo, subtitulo: 'Ingresa al menos un ítem', si: 'producto_glp=' + producto, campos: [
    { tipo: 'seccion', titulo: 'Ítem' }, ...item, OTROS_ITEMS_GLP, ...despues
  ] });
  const granelGlp = (producto, accion) => itemGlp(producto, `Datos de ${accion}`, [
    { tipo: 'texto', nombre: 'volumen_' + producto, etiqueta: `Volumen a ${accion === 'exportación' ? 'exportar' : 'reexportar'} (galones estadounidenses)`, ayuda: 'Por ejemplo 50000', modo: 'numeric', max: 12, patron: '[0-9]+([.,][0-9]{1,2})?', mensaje: 'Escribe el volumen en galones, por ejemplo 50000', media: true },
    PAIS_GLP('pais_destino', 'País de destino'),
    { tipo: 'texto', nombre: 'frecuencia_envio', etiqueta: 'Frecuencia de envío', ayuda: 'Por ejemplo mensual', max: 50, media: true },
    { tipo: 'texto', nombre: 'fecha_probable_' + producto, etiqueta: `Fecha probable de ${accion}`, ...FECHA_FUTURA, media: true },
    { tipo: 'texto', nombre: 'precio_fob', etiqueta: 'Precio FOB ($/galón)', ...MONTO_AAC, mensaje: 'Escribe solo el precio en números, por ejemplo 1.25', media: true },
    TRANSPORTE_GLP
  ], [
    { tipo: 'texto', nombre: 'justificacion_' + producto, etiqueta: `Justificación de la ${accion} de GLP`, max: 1000 },
    { tipo: 'archivo', nombre: 'inventarios', etiqueta: 'Niveles de inventarios reales a la fecha y proyección diaria de producción', ayuda: 'Formatos permitidos: XLS, XLSX', acepta: '.xls,.xlsx' }
  ]);
  const GLP_DGEHM = {
    titulo: 'Datos del trámite',
    subtitulo: 'Elige el trámite y cuéntanos quién lo solicita',
    icono: 'ph-gas-can',
    campos: [
      { tipo: 'opciones', nombre: 'producto_glp', etiqueta: 'Trámite a solicitar', columna: true, opciones: PRODUCTOS_GLP },
      ...TITULAR_DGEHM,
      ...DELEGACION_DGEHM
    ],
    pasos: [
      { titulo: 'Datos del solicitante', subtitulo: 'Revisa tus datos y adjunta tus documentos', si: NATURAL, campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, si: 'tipo_de_documento=dui' },
        { tipo: 'texto', nombre: 'nombre_titular', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: 'tipo_de_documento!=dui' },
        ...contactoDgehm(),
        { tipo: 'seccion', titulo: 'Documentos' },
        PDF_DGEHM('imagen_pasaporte', 'Imagen del pasaporte', 'La hoja con tus datos personales', { si: 'tipo_de_documento=pasaporte' }),
        PDF_DGEHM('imagen_carnet', 'Imagen del carnet de residencia', AMBAS_CARAS, { si: 'tipo_de_documento=carnet_de_residencia' }),
        { tipo: 'texto', nombre: 'nit_titular', etiqueta: 'Número de Identificación Tributaria (NIT)', ...NIT_AAC, si: 'tipo_de_documento!=dui' },
        PDF_DGEHM('imagen_nit_titular', 'Imagen del NIT', AMBAS_CARAS, { si: 'tipo_de_documento!=dui' }),
        ...NRC_DGEHM
      ] },
      { titulo: 'Datos de la empresa', subtitulo: 'Contacto, documentos y representante legal', si: JURIDICA, campos: [
        NOTA_EMPRESA_DGEHM,
        ...contactoDgehm(),
        { tipo: 'seccion', titulo: 'Documentos de la empresa' },
        ...NRC_DGEHM,
        PDF_DGEHM('escritura_constitucion', 'Escritura de constitución de la sociedad'),
        PDF_DGEHM('credencial_representante', 'Credencial vigente del representante legal'),
        { tipo: 'seccion', titulo: 'Representante legal' },
        ...identidadDgehm('representante', 'del representante legal')
      ] },
      { titulo: 'Persona para recibir notificaciones', subtitulo: 'Cuéntanos a quién autorizas', si: 'autoriza_notificaciones=si', campos: [
        ...identidadDgehm('notifica', 'de la persona autorizada'),
        ...contactoDgehm('_notifica'),
        { tipo: 'lista', nombre: 'departamento_notifica', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, media: true },
        { tipo: 'lista', nombre: 'municipio_notifica', etiqueta: 'Municipio', depende: 'departamento_notifica', opcionesPor: MUNICIPIOS, media: true },
        { tipo: 'texto', nombre: 'direccion_notifica', etiqueta: 'Dirección para recibir notificaciones', max: 300 }
      ] },
      APODERADO_DGEHM,
      itemGlp('importar_cilindros', 'Datos de importación', [FABRICANTE_GLP, CANTIDAD_GLP, CAPACIDAD_CILINDRO, PAIS_GLP('pais_origen', 'País de origen'), TRANSPORTE_GLP], [USO_CILINDROS]),
      itemGlp('importar_valvulas', 'Datos de importación', [FABRICANTE_GLP, CANTIDAD_GLP, PAIS_GLP('pais_origen', 'País de origen'), { ...TRANSPORTE_GLP, media: true },
        { tipo: 'opciones', nombre: 'tipo_valvula', etiqueta: 'Tipo de válvula', opciones: [
          { valor: 'acoplamiento_rapido', texto: 'Acoplamiento rápido', detalle: 'VAR', icono: 'ph-wrench' }, { valor: 'acoplamiento_roscado', texto: 'Acoplamiento roscado', detalle: 'Tipo POL', icono: 'ph-wrench' }
        ] }], [
        { tipo: 'nota', estilo: 'info', titulo: 'Certificado de calidad del fabricante', lineas: ['- En español', '- Con la norma de fabricación de las válvulas con la que se evalúa cada ítem', '- Con los resultados de los ensayos y sus unidades de medida', '- Con el nombre y la firma de quien lo emite'] },
        PDF_ZIP_DGEHM('certificado_calidad_valvulas', 'Certificado de calidad del fabricante')
      ]),
      itemGlp('importar_accesorios', 'Datos de importación', [FABRICANTE_GLP, CANTIDAD_GLP, PAIS_GLP('pais_origen', 'País de origen'), TRANSPORTE_GLP,
        { tipo: 'opciones', nombre: 'accesorio', etiqueta: 'Accesorio', dosColumnas: true, opciones: ['Abrazadera', 'Base de sustentación', 'Cuello protector de válvula', 'Manguera'].map(a => ({ valor: sinTildes(a).replace(/ /g, '_'), texto: a })) }]),
      itemGlp('importar_reguladores', 'Datos de importación', [FABRICANTE_GLP, CANTIDAD_GLP, PAIS_GLP('pais_origen', 'País de origen'), CAPACIDAD_REGULADOR, UNIDAD_REGULADOR, TRANSPORTE_GLP], [
        { tipo: 'opciones', nombre: 'primera_vez_modelo', etiqueta: '¿Es la primera vez que importas este modelo de regulador?', opciones: SI_NO },
        PDF_ZIP_DGEHM('certificado_aprobacion_modelo', 'Certificado de aprobación de modelo', { si: 'primera_vez_modelo=si' }),
        PDF_ZIP_DGEHM('certificado_modelo_lote', 'Certificado de aprobación de modelo para el lote', { si: 'primera_vez_modelo=no' }),
        PDF_ZIP_DGEHM('planos_modelo', 'Planos de diseño, especificaciones técnicas y resultados de las pruebas del modelo', { si: 'primera_vez_modelo=si' }),
        PDF_ZIP_DGEHM('pruebas_ensayo', 'Pruebas de ensayo que amparan la aprobación de modelo', { si: 'primera_vez_modelo=si' }),
        SERIES_DGEHM(),
        PDF_ZIP_DGEHM('factura_importacion', 'Factura de importación')
      ]),
      itemGlp('exportar_cilindros', 'Datos de exportación', [FABRICANTE_GLP, CANTIDAD_GLP, CAPACIDAD_CILINDRO, PAIS_GLP('pais_destino', 'País de destino'), TRANSPORTE_GLP], [
        PDF_ZIP_DGEHM('certificado_calidad', 'Certificado de calidad del fabricante de los cilindros'),
        SERIES_DGEHM(),
        PDF_ZIP_DGEHM('factura', 'Factura del lote de cilindros')
      ]),
      itemGlp('comercializar_cilindros', 'Productos para el mercado nacional', [FABRICANTE_GLP, CANTIDAD_GLP, CAPACIDAD_CILINDRO, PAIS_GLP('pais_origen', 'País de origen')], [
        USO_CILINDROS,
        PDF_ZIP_DGEHM('certificado_calidad', 'Certificado de calidad del fabricante de los cilindros'),
        PDF_ZIP_DGEHM('certificado_lamina', 'Certificado de calidad de la lámina con que se fabricaron los cilindros'),
        SERIES_DGEHM(),
        PDF_ZIP_DGEHM('factura', 'Factura del lote de cilindros'),
        PDF_ZIP_DGEHM('poliza_importacion', 'Póliza de importación de los cilindros', { opcional: true, ayuda: 'Solo si los cilindros son importados. Formatos permitidos: PDF, ZIP' })
      ]),
      granelGlp('exportar_glp', 'exportación'),
      granelGlp('reexportar_glp', 'reexportación'),
      itemGlp('comercializar_reguladores', 'Productos para el mercado nacional', [FABRICANTE_GLP, CANTIDAD_GLP, PAIS_GLP('pais_origen', 'País de origen'), CAPACIDAD_REGULADOR, UNIDAD_REGULADOR], [
        PDF_ZIP_DGEHM('certificado_modelo_nacional', 'Certificado de aprobación de modelo del lote'),
        SERIES_DGEHM()
      ]),
      DECLARACION_DGEHM,
      ENVIAR
    ]
  };
  [[18, 'comercializar_cilindros'], [19, 'comercializar_reguladores'], [20, 'exportar_glp'], [21, 'exportar_cilindros'], [22, 'importar_accesorios'],
    [23, 'importar_valvulas'], [24, 'importar_cilindros'], [25, 'importar_reguladores'], [26, 'reexportar_glp']]
    .forEach(([numero, producto]) => { F[numero] = { ...GLP_DGEHM, preseleccion: { producto_glp: producto } }; });

  // DGEHM: transferencia de la autorización de funcionamiento (trámites 449 a 457 del portal, uno por instalación). Los ocho piden
  // lo mismo; cambia si preguntan el producto o el nombre del local. Con persona jurídica piden además al representante legal
  const transferenciaDgehm = (instalacion, { producto = false, local = false } = {}) => ({
    titulo: 'Datos de la solicitud',
    subtitulo: 'Transferencia de funcionamiento de ' + instalacion,
    icono: 'ph-swap',
    campos: [
      ...(producto ? [{ tipo: 'opciones', nombre: 'producto', etiqueta: 'Producto que se comercializará o almacenará', opciones: [
        { valor: 'combustibles_liquidos', texto: 'Combustibles líquidos', icono: 'ph-drop' },
        { valor: 'glp', texto: 'Gas licuado de petróleo', detalle: 'GLP', icono: 'ph-gas-can' },
        { valor: 'mixta', texto: 'Mixta', detalle: 'Combustibles líquidos y GLP', icono: 'ph-stack' }
      ] }] : []),
      ...(local ? [
        { tipo: 'texto', nombre: 'nombre_actual_local', etiqueta: 'Nombre actual del local', max: 100 },
        { tipo: 'opciones', nombre: 'cambia_denominacion', etiqueta: '¿Cambiará la denominación del local?', opciones: SI_NO },
        { tipo: 'texto', nombre: 'nueva_denominacion', etiqueta: 'Nueva denominación del local', max: 100, si: 'cambia_denominacion=si' }
      ] : []),
      { tipo: 'opciones', nombre: 'rescinde_contrato', etiqueta: '¿Rescindirás el contrato con el proveedor anterior durante la transferencia?', opciones: SI_NO },
      { tipo: 'seccion', titulo: 'Titular de la transferencia' },
      ...TITULAR_DGEHM,
      { tipo: 'seccion', titulo: 'Documentos de la solicitud' },
      PDF_DGEHM('solicitud_transferencia', 'Solicitud de transferencia certificada por notario', 'Cesión de derechos del operador anterior al nuevo, autorizada por notario. Hasta 7 MB'),
      PDF_DGEHM('disponibilidad_inmueble', 'Documento de disponibilidad del inmueble', 'Escritura inscrita en el CNR, arrendamiento, comodato, usufructo u otro. Hasta 10 MB'),
      PDF_DGEHM('rescision_contrato', 'Documento de rescisión del contrato', 'Hasta 7 MB', { si: 'rescinde_contrato=si' }),
      PDF_DGEHM('solvencia_renta_iva', 'Solvencias de renta e IVA', 'Vigentes, del impuesto sobre la renta y del IVA de las dos personas. Hasta 7 MB'),
      PDF_DGEHM('matricula_comercio', 'Matrícula de comercio', 'Hasta 10 MB'),
      ...DELEGACION_DGEHM
    ],
    pasos: [
      { titulo: 'Datos del titular', subtitulo: 'Revisa tus datos y adjunta tus documentos', si: NATURAL, campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre según el DUI', soloLectura: true, si: 'tipo_de_documento=dui' },
        { tipo: 'texto', nombre: 'fecha_de_vencimiento_del_dui', etiqueta: 'Vencimiento del DUI', soloLectura: true, si: 'tipo_de_documento=dui' },
        { tipo: 'texto', nombre: 'nombre_titular', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: 'tipo_de_documento!=dui' },
        ...contactoDgehm(),
        { tipo: 'seccion', titulo: 'Documentos del titular' },
        PDF_DGEHM('documento_identidad_titular', 'Imagen del documento de identidad', AMBAS_CARAS + '; del pasaporte, la hoja con tus datos personales'),
        { tipo: 'texto', nombre: 'nit_titular', etiqueta: 'Número de Identificación Tributaria (NIT)', ...NIT_AAC, si: 'tipo_de_documento!=dui' },
        PDF_DGEHM('imagen_nit_titular', 'Imagen del NIT', AMBAS_CARAS, { si: 'tipo_de_documento!=dui' }),
        ...NRC_DGEHM
      ] },
      { titulo: 'Datos de la empresa', subtitulo: 'Contacto y documentos de la empresa', si: JURIDICA, campos: [
        NOTA_EMPRESA_DGEHM,
        ...contactoDgehm(),
        { tipo: 'seccion', titulo: 'Documentos de la empresa' },
        PDF_DGEHM('imagen_nit_empresa', 'Imagen del NIT', AMBAS_CARAS),
        ...NRC_DGEHM,
        PDF_DGEHM('escritura_constitucion', 'Escritura de constitución de la sociedad o modificación al pacto social', 'Hasta 15 MB')
      ] },
      { titulo: 'Representante legal', subtitulo: 'Cuéntanos quién representa a la empresa', si: JURIDICA, campos: [
        ...identidadDgehm('representante', 'del representante legal'),
        PDF_DGEHM('credencial_representante', 'Credencial vigente del representante legal', 'Junto con la escritura de constitución y sus modificaciones. Hasta 10 MB')
      ] },
      APODERADO_DGEHM,
      { titulo: 'Persona para recibir notificaciones', subtitulo: 'Cuéntanos a quién autorizas', si: 'autoriza_notificaciones=si', campos: [
        ...identidadDgehm('notifica', 'de la persona autorizada'),
        ...contactoDgehm('_notifica'),
        { tipo: 'lista', nombre: 'departamento_notifica', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, tercio: true },
        { tipo: 'lista', nombre: 'municipio_notifica', etiqueta: 'Municipio', depende: 'departamento_notifica', opcionesPor: MUNICIPIOS_2024, tercio: true },
        { tipo: 'lista', nombre: 'distrito_notifica', etiqueta: 'Distrito', depende: 'departamento_notifica', opcionesPor: MUNICIPIOS, tercio: true },
        { tipo: 'texto', nombre: 'direccion_notifica', etiqueta: 'Dirección para recibir notificaciones', ayuda: 'Residencial, avenida, calle, colonia, polígono, número de casa', max: 300 }
      ] },
      DECLARACION_DGEHM,
      ENVIAR
    ]
  });
  F[27] = transferenciaDgehm('depósito de aprovisionamiento', { producto: true });
  F[28] = transferenciaDgehm('estación de servicio', { producto: true, local: true });
  F[29] = transferenciaDgehm('planta de envasado de GLP', { local: true });
  F[30] = transferenciaDgehm('tanque para consumo privado', { producto: true });
  F[31] = transferenciaDgehm('tanque para consumo privado temporal', { producto: true });
  F[32] = transferenciaDgehm('fábrica de cilindros portátiles para envasado de GLP');
  F[33] = transferenciaDgehm('taller de reparación y mantenimiento de cilindros para GLP');
  F[34] = transferenciaDgehm('taller para instalación de equipos de GLP vehicular');

  /* ===== Viceministerio de Transporte (VMT) ===== */
  // El 44 (trámite 232) valida el código del registro de transporte de carga y con él trae los datos del titular y sus
  // placas: con un código de prueba el portal no deja seguir, así que se copió hasta los materiales y el pago es el del catálogo.
  const CLASES_CARGA = [
    { valor: 'camion', texto: 'Camión', icono: 'ph-truck' },
    { valor: 'panel', texto: 'Panel', icono: 'ph-van' },
    { valor: 'pick_up', texto: 'Pick up', icono: 'ph-car-profile' },
    { valor: 'cabezal_remolque', texto: 'Cabezal y remolque', icono: 'ph-truck-trailer' }
  ];
  const NACIONAL_VMT = 'nacionalidad_tramite=salvadorena';
  const EXTRANJERA_VMT = 'nacionalidad_tramite=extranjera';
  const SOLICITANTE_VMT = [
    { tipo: 'nota', estilo: 'info', lineas: ['Necesitas tu registro de transporte de carga', 'Si aún no lo tienes, regístrate en simple.sv/RegistroDeTransportista y después vuelve a este trámite'] },
    { tipo: 'opciones', nombre: 'nacionalidad_tramite', etiqueta: 'Nacionalidad de quien solicita el permiso', opciones: [
      { valor: 'salvadorena', texto: 'Salvadoreña', icono: 'ph-flag' },
      { valor: 'extranjera', texto: 'Extranjera', icono: 'ph-globe-hemisphere-west' }
    ] },
    { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: '¿Quién solicita el permiso?', opciones: PERSONA(), si: EXTRANJERA_VMT }
  ];
  const REGISTRO_VMT = { titulo: 'Registro de transporte de carga', subtitulo: 'Escribe el código de tu registro', campos: [
    { tipo: 'texto', nombre: 'codigo_registro', etiqueta: 'Código de registro', ayuda: 'Lo recibiste al registrarte como transportista', max: 20 },
    { tipo: 'nota', estilo: 'info', lineas: ['Con el código, el VMT trae los datos del titular, del tercero autorizado y del representante legal de tu registro'] }
  ] };
  const TIPO_PLACA_VMT = si => ({ tipo: 'opciones', nombre: 'tipo_identificacion', etiqueta: 'Tipo de placa', si, opciones: [
    { valor: 'placa_nacional', texto: 'Placa nacional', icono: 'ph-flag' },
    { valor: 'placa_extranjera', texto: 'Placa extranjera', icono: 'ph-globe-hemisphere-west' }
  ] });
  // Datos de la tarjeta de circulación de un vehículo arrendado (el portal los pide en una ventana aparte)
  const arrendadoVmt = (si, despues = []) => [
    { tipo: 'seccion', titulo: 'Datos del vehículo arrendado', si },
    TIPO_PLACA_VMT(si),
    { tipo: 'texto', nombre: 'nombre_propietario', etiqueta: 'Nombre del propietario', max: 50, patron: SOLO_LETRAS, si, media: true },
    { tipo: 'texto', nombre: 'nacionalidad_propietario', etiqueta: 'Nacionalidad del propietario', placeholder: 'Salvadoreña', max: 20, patron: SOLO_LETRAS, si, media: true },
    { tipo: 'texto', nombre: 'marca', etiqueta: 'Marca', max: 20, si, tercio: true },
    { tipo: 'texto', nombre: 'modelo', etiqueta: 'Modelo', max: 30, si, tercio: true },
    { tipo: 'texto', nombre: 'anio', etiqueta: 'Año', modo: 'numeric', placeholder: '2020', max: 4, patron: '(19|20)[0-9]{2}', mensaje: 'Escribe el año con 4 dígitos, por ejemplo 2020', si, tercio: true },
    ...despues,
    { tipo: 'texto', nombre: 'tipo', etiqueta: 'Tipo', ayuda: 'Como aparece en la tarjeta de circulación', max: 25, si, media: true },
    { tipo: 'texto', nombre: 'f_vencimiento', etiqueta: 'Vencimiento de la tarjeta de circulación', ...FECHA_FUTURA, si, media: true },
    { tipo: 'texto', nombre: 'numero_chasis', etiqueta: 'Número de chasis', max: 35, si, tercio: true },
    { tipo: 'texto', nombre: 'numero_chasis_vin', etiqueta: 'Número de chasis VIN', max: 35, si, tercio: true },
    { tipo: 'texto', nombre: 'numero_motor', etiqueta: 'Número de motor', max: 35, si, tercio: true }
  ];
  const MEDIDA_VMT = (nombre, etiqueta, unidad, ejemplo, extra = {}) => ({ tipo: 'texto', nombre, etiqueta: `${etiqueta} (${unidad})`, modo: 'numeric', placeholder: ejemplo, patron: '[0-9]+([.,][0-9]{1,2})?', mensaje: `Escribe solo el número, por ejemplo ${ejemplo}`, ...extra });
  const RECORRIDO_VMT = (desde, hasta, ayuda) => [
    { tipo: 'texto', nombre: desde, etiqueta: 'Lugar de origen', placeholder: 'Colón, La Libertad', ayuda, max: 150, media: true },
    { tipo: 'texto', nombre: hasta, etiqueta: 'Lugar de destino', placeholder: 'Soyapango, San Salvador', ayuda, max: 150, media: true },
    { tipo: 'texto', nombre: 'recorrido', etiqueta: 'Recorrido', ayuda: 'Carreteras por las que vas a circular, por ejemplo CA-12, CA-1 y Bulevar del Ejército', max: 300 }
  ];
  F[44] = {
    titulo: 'Datos del trámite',
    subtitulo: 'Permiso especial para transportar materiales peligrosos',
    icono: 'ph-warning-diamond',
    campos: SOLICITANTE_VMT,
    pasos: [
      REGISTRO_VMT,
      { titulo: 'Vehículo', subtitulo: 'Elige el vehículo que hará el transporte', campos: [
        { tipo: 'opciones', nombre: 'clase_vehiculo', etiqueta: 'Clase de vehículo', dosColumnas: true, opciones: CLASES_CARGA },
        { tipo: 'opciones', nombre: 'vehiculo_arrendado', etiqueta: '¿El vehículo es arrendado?', opciones: SI_NO, info: { titulo: 'Vehículo arrendado', lineas: ['Si no está en tu registro de transporte de carga, agrégalo como arrendado con los datos de su tarjeta de circulación'] } },
        { tipo: 'texto', nombre: 'numero_placa', etiqueta: 'Número de placa o póliza', placeholder: 'C123456', max: 12, media: true },
        { tipo: 'texto', nombre: 'placa_remolque', etiqueta: 'Placa del remolque', placeholder: 'RE12345', max: 12, media: true, si: 'clase_vehiculo=cabezal_remolque' },
        ...arrendadoVmt('vehiculo_arrendado=si')
      ] },
      { titulo: 'Documentos del vehículo', subtitulo: 'Súbelos en un solo PDF por vehículo', campos: [
        { tipo: 'nota', estilo: 'requisitos', si: NACIONAL_VMT, lineas: [
          '- Certificado de emisión de gases',
          '- Certificado del Cuerpo de Bomberos',
          '- Fotografía de perfil del vehículo y de la carga, si el remolque es de plataforma, furgón, cajón o barandal',
          '## Si el vehículo es arrendado',
          '- Contrato de arrendamiento o de prestación de servicios',
          '- Documento de identidad del propietario del vehículo',
          '- Si el propietario es una sociedad: inscripción de la personería, credencial del representante y tarjeta de identificación tributaria'
        ] },
        { tipo: 'nota', estilo: 'requisitos', si: EXTRANJERA_VMT, lineas: [
          '- Certificado de emisión de gases o su equivalente en el país de origen',
          '- Certificado del Cuerpo de Bomberos o su equivalente en el país de origen',
          '- Fotografía de perfil del vehículo y de la carga, si el remolque es de plataforma, furgón, cajón o barandal',
          '- Copia reciente de la tarjeta del vehículo',
          '## Si el vehículo es arrendado',
          '- Contrato de arrendamiento o de prestación de servicios',
          '- Documento de identidad del propietario del vehículo',
          '- Si el arrendante es una sociedad: inscripción en el registro de comercio vigente o su equivalente, credencial del representante legal y su documento de identidad'
        ] },
        { tipo: 'archivo', nombre: 'doc_vehiculo1', etiqueta: 'Documentos del vehículo', ...SOLO_PDF },
        { tipo: 'archivo', nombre: 'doc_vehiculo2', etiqueta: 'Documentos del remolque', ...SOLO_PDF, si: 'clase_vehiculo=cabezal_remolque' }
      ] },
      { titulo: 'Materiales peligrosos', subtitulo: 'Cuéntanos qué vas a transportar', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['El origen, el recorrido y el destino valen para todos los materiales'] },
        ...RECORRIDO_VMT('lugar_procedencia', 'lugar_destino'),
        { tipo: 'seccion', titulo: 'Material' },
        { tipo: 'texto', nombre: 'nombre_quimico', etiqueta: 'Nombre químico', placeholder: 'Hipoclorito de sodio', max: 100, media: true },
        { tipo: 'texto', nombre: 'nombre_comercial', etiqueta: 'Nombre comercial', placeholder: 'Cloro industrial', max: 100, media: true },
        { tipo: 'opciones', nombre: 'estado_material', etiqueta: 'Estado del material', compacto: true, opciones: [
          { valor: 'solido', texto: 'Sólido' }, { valor: 'liquido', texto: 'Líquido' }, { valor: 'gaseoso', texto: 'Gaseoso' }
        ] },
        { tipo: 'texto', nombre: 'tipo_mercaderia', etiqueta: 'Tipo de mercadería consolidada', placeholder: 'Productos de limpieza', max: 150 },
        { tipo: 'opciones', nombre: 'tipo_empaque', etiqueta: 'Tipo de empaque', compacto: true, opciones: [
          { valor: 'recipientes', texto: 'Recipientes' }, { valor: 'barril', texto: 'Barril' }, { valor: 'envase', texto: 'Envase' },
          { valor: 'embalaje', texto: 'Embalaje' }, { valor: 'granel', texto: 'Granel' }, { valor: 'otro', texto: 'Otro' }
        ] },
        { tipo: 'texto', nombre: 'especifique_otro', etiqueta: 'Especifica el tipo de empaque', max: 100, si: 'tipo_empaque=otro' },
        { tipo: 'texto', nombre: 'otros_materiales', etiqueta: 'Otros materiales', ayuda: 'Si son varios, escribe cada uno con su nombre, estado y empaque, separados por punto y coma', max: 500, opcional: true }
      ] },
      REVISION,
      { ...PAGO, monto: [['clase_vehiculo=cabezal_remolque', '$56.50'], ['clase_vehiculo=camion|panel|pick_up', '$39.55']], campos: [
        ...PAGO.campos,
        { tipo: 'nota', estilo: 'info', lineas: ['Camión, panel o pick up: $39.55', 'Cabezal y remolque: $56.50'] }
      ] }
    ]
  };

  const ESPECIAL_VMT = 'tipo_vehiculo=especial';
  const ARRENDADO_45 = 'tipo_vehiculo=arrendado';
  const KG_VMT = (nombre, etiqueta, extra) => MEDIDA_VMT(nombre, etiqueta, 'kilogramos', '9000', { media: true, ...extra });
  const METROS_VMT = (nombre, etiqueta) => MEDIDA_VMT(nombre, etiqueta, 'metros', '4.25', { tercio: true });
  const DOCUMENTOS_SOBREPESO = (si, titulo, extra) => ({ tipo: 'nota', estilo: 'requisitos', si, lineas: [
    '- Fotografías con la fecha de captura del frente, el perfil y la parte trasera del vehículo o la combinación (con la placa, si ya está inscrito)',
    '- Fotografías con la fecha de captura del frente y el perfil de la carga',
    ...extra.propio,
    '## Si el vehículo no es tuyo',
    ...extra.ajeno,
    '## Vehículos con características técnicas especiales',
    `- Si no tienen placa ni tarjeta de circulación, acredita el vehículo con la declaración de mercancía de importación definitiva o temporal${titulo}`
  ] });
  F[45] = {
    titulo: 'Datos del trámite',
    subtitulo: 'Permiso especial para transportar objetos que sobrepasen el peso o las dimensiones de ley',
    icono: 'ph-scales',
    campos: SOLICITANTE_VMT,
    pasos: [
      REGISTRO_VMT,
      { titulo: 'Vehículo', subtitulo: 'Elige el vehículo que hará el transporte', campos: [
        { tipo: 'opciones', nombre: 'tipo_vehiculo', etiqueta: '¿Qué vehículo hará el transporte?', columna: true, opciones: [
          { valor: 'registro', texto: 'Uno de mi registro de transporte de carga', icono: 'ph-truck' },
          { valor: 'especial', texto: 'Uno con características técnicas especiales', detalle: 'Sin placa ni tarjeta de circulación: se identifica con la póliza o la DUCA', icono: 'ph-gear' },
          { valor: 'arrendado', texto: 'Uno arrendado', detalle: 'Con los datos de su tarjeta de circulación', icono: 'ph-handshake' }
        ] },
        { tipo: 'texto', nombre: 'numero_placa', etiqueta: 'Número de placa', placeholder: 'C123456', max: 12, si: 'tipo_vehiculo!=especial' },
        { tipo: 'seccion', titulo: 'Datos del vehículo especial', si: ESPECIAL_VMT },
        { tipo: 'texto', nombre: 'identificacion', etiqueta: 'Número de póliza o DUCA', max: 10, si: ESPECIAL_VMT, media: true },
        { tipo: 'texto', nombre: 'propietario', etiqueta: 'Nombre del propietario', max: 50, patron: SOLO_LETRAS, si: ESPECIAL_VMT, media: true },
        { tipo: 'opciones', nombre: 'clase_especial', etiqueta: 'Clase', compacto: true, si: ESPECIAL_VMT, opciones: [
          { valor: 'camion_pesado', texto: 'Camión pesado' }, { valor: 'maquinaria', texto: 'Maquinaria' }, { valor: 'remolque_modular', texto: 'Remolque modular' }
        ] },
        { tipo: 'texto', nombre: 'tipo_especial', etiqueta: 'Tipo', max: 25, si: ESPECIAL_VMT },
        ...arrendadoVmt(ARRENDADO_45, [
          { tipo: 'opciones', nombre: 'clase_arrendado', etiqueta: 'Clase', compacto: true, si: ARRENDADO_45, opciones: [
            { valor: 'cabezal', texto: 'Cabezal' }, { valor: 'camion', texto: 'Camión' }, { valor: 'remolque', texto: 'Remolque' }
          ] }
        ]),
        { tipo: 'texto', nombre: 'otros_vehiculos', etiqueta: 'Otros vehículos de la combinación', ayuda: 'Si son varios, escribe la placa o la póliza de cada uno, separadas por coma (hasta 10)', max: 200, opcional: true }
      ] },
      { titulo: 'Ejes del vehículo', subtitulo: 'Escribe el peso de cada eje', campos: [
        { tipo: 'seccion', titulo: 'Eje 1' },
        KG_VMT('peso_eje_vacio', 'Peso del eje vacío'),
        KG_VMT('peso_eje_con_carga', 'Peso del eje con carga', { placeholder: '12000', mensaje: 'Escribe solo el número, por ejemplo 12000' }),
        { tipo: 'texto', nombre: 'otros_ejes', etiqueta: 'Otros ejes', ayuda: 'Si son varios, escribe el peso vacío y con carga de cada uno, por ejemplo Eje 2: 4500 / 9000', max: 500, opcional: true }
      ] },
      { titulo: 'Documentos y dimensiones', subtitulo: 'Sube los documentos en un solo PDF por vehículo', campos: [
        DOCUMENTOS_SOBREPESO(NACIONAL_VMT, '', {
          propio: ['- Certificado de emisión de gases original y vigente, para vehículos automotores de carga'],
          ajeno: ['- Contrato de arrendamiento o de prestación de servicios', '- Documento de identidad del propietario del vehículo', '- Si es una sociedad: inscripción de la personería, credencial del representante legal y tarjeta de identificación tributaria']
        }),
        DOCUMENTOS_SOBREPESO(EXTRANJERA_VMT, ', o con la de tránsito si circulan en régimen de tránsito', {
          propio: ['- Copia de la tarjeta de circulación o su equivalente, vigente, a tu nombre y certificada por notario salvadoreño', '- Certificado original y vigente de emisión de gases o su equivalente en el país de origen'],
          ajeno: ['- Copia de la tarjeta de circulación certificada por notario salvadoreño', '- Contrato de arrendamiento o de prestación de servicios', '- Documento de identidad del arrendante, si es persona natural', '- Si el arrendante es una sociedad: inscripción en el registro de comercio vigente o su equivalente, credencial del representante legal y su documento de identidad']
        }),
        { tipo: 'archivo', nombre: 'doc_vehiculo1', etiqueta: 'Documentos del vehículo', ...SOLO_PDF },
        { tipo: 'archivo', nombre: 'doc_otros_vehiculos', etiqueta: 'Documentos de los otros vehículos', ayuda: 'Si son varios, uno detrás de otro en un solo archivo. Formato permitido: PDF', acepta: '.pdf', si: 'otros_vehiculos!=' },
        { tipo: 'seccion', titulo: 'Dimensiones de la combinación vehicular' },
        METROS_VMT('alto_combinacion', 'Alto'),
        METROS_VMT('ancho_combinacion', 'Ancho'),
        METROS_VMT('largo_combinacion', 'Largo')
      ] },
      { titulo: 'Carga y recorrido', subtitulo: 'Cuéntanos qué vas a transportar y por dónde', campos: [
        { tipo: 'texto', nombre: 'descripcion_carga', etiqueta: 'Descripción de la carga', placeholder: 'Transformador eléctrico de 40 toneladas', max: 500 },
        MEDIDA_VMT('peso', 'Peso', 'toneladas métricas', '45.5', { media: true }),
        { tipo: 'texto', nombre: 'fecha_inicio', etiqueta: 'Fecha aproximada del transporte', ...FECHA_FUTURA, media: true },
        METROS_VMT('alto', 'Alto de la carga'),
        METROS_VMT('largo', 'Largo de la carga'),
        METROS_VMT('ancho', 'Ancho de la carga'),
        { tipo: 'texto', nombre: 'observaciones', etiqueta: 'Observaciones', max: 300, opcional: true },
        { tipo: 'seccion', titulo: 'Recorrido' },
        ...RECORRIDO_VMT('desde', 'hasta', 'Aduana, municipio y departamento'),
        { tipo: 'opciones', nombre: 'tipo_escolta', etiqueta: 'Escolta del vehículo', compacto: true, opciones: [
          { valor: 'privada', texto: 'Privada' }, { valor: 'pnc', texto: 'PNC' }, { valor: 'ninguna', texto: 'Ninguna' }
        ] }
      ] },
      REVISION,
      { ...PAGO, monto: '$39.55' }
    ]
  };

  /* 35 a 43, 46 y 47 (VMT) y 117 (MOP), leídos el 4 de noviembre de 2026 solo hasta la nota legal o la declaración jurada.
     Aceptarla le toca al ciudadano y en las pruebas no se aceptó, así que lo que sigue en el portal no se vio: el último
     paso lo dice. El "¿Deseas continuar con el trámite?" del portal no se copió, porque en el rediseño no se pregunta.
     Mismo formulario del portal: 35 y 36 (trámite 351) y 40, 41 y 43 (trámite 320). */
  const ASESORIA_VMT = { tipo: 'nota', estilo: 'info', titulo: 'Asesoría', lineas: ['Si tienes dudas sobre el trámite, escribe al VMT por WhatsApp al 7124-7428 (solo mensajes) o al correo vmtdigital@mop.gob.sv'] };
  const notaLegalVmt = (direccion, extra = []) => ({ tipo: 'nota', estilo: 'aviso', titulo: 'Nota legal', lineas: [
    'Si envías información falsa, cometes el delito de estafa informática (artículo 10 de la Ley Especial contra los Delitos Informáticos y Conexos) y el trámite se elimina automáticamente',
    `${direccion} puede dar aviso a la Fiscalía General de la República para que determine los efectos legales`,
    ...extra
  ] });
  const aceptaNota = (nombre = 'acepto_terminos', valor = 'acepto') => ({ tipo: 'opciones', nombre, etiqueta: '¿Aceptas la nota legal?', marcado: true, opciones: [{ valor, texto: 'He leído y acepto los términos legales', icono: 'ph-handshake' }] });
  const sigueEnPortal = lineas => ({ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas }, ...ENVIAR.campos] });
  const SIGUE_VMT = sigueEnPortal(['Después de aceptar la nota legal, el VMT te pide los datos y los documentos del trámite']);
  const notaLegalTramite = ({ subtitulo, icono, direccion, nombre, antes = [], despues = [], sigue = SIGUE_VMT }) => ({
    titulo: 'Nota legal',
    subtitulo,
    icono,
    campos: [ASESORIA_VMT, ...antes, notaLegalVmt(direccion), aceptaNota(nombre), ...despues],
    pasos: [sigue]
  });
  const TRANSPORTE = 'La Dirección General de Transporte Terrestre';
  const CARGA = 'La Dirección General de Transporte de Carga';

  const apostillaVmt = documento => ({
    titulo: 'Antes de empezar',
    subtitulo: `Apostilla de la ${documento} de licencia de conducir`,
    icono: 'ph-seal-check',
    campos: [
      ASESORIA_VMT,
      { tipo: 'nota', estilo: 'requisitos', titulo: 'Necesitas el código de SERTRACEN', lineas: ['Antes de iniciar, SERTRACEN te envía por correo un código de autorización de tu documento. Con ese código el VMT hace la verificación'] },
      { tipo: 'opciones', nombre: 'terminos', etiqueta: '¿Tienes el código de autorización?', marcado: true, opciones: [{ valor: 'Confirmo', texto: 'Confirmo que tengo el código', icono: 'ph-seal-check' }] },
      notaLegalVmt('La Dirección General de Transporte')
    ],
    pasos: [sigueEnPortal(['El VMT verifica el código de SERTRACEN y después te pide los datos del trámite'])]
  });
  F[35] = apostillaVmt('certificación');
  F[36] = apostillaVmt('constancia de récord');

  F[37] = {
    titulo: 'Revisión de requisitos',
    subtitulo: 'Ten a la mano estos documentos en PDF, legibles y sin errores',
    icono: 'ph-handshake',
    campos: [
      ASESORIA_VMT,
      { tipo: 'nota', estilo: 'requisitos', titulo: 'Documentos del representante del menor', lineas: [
        '## Obligatorios',
        '- NIT del menor',
        '- Boleta de los exámenes de manejo aprobados',
        '- Fianza moral: documento privado ante notario en el que te comprometes a responder por los daños a terceros que ocasione el menor',
        '- Partida de nacimiento del menor, de no más de 6 meses. La edad mínima para pedir la licencia es 15 años',
        '- Fianza bancaria de $571.43 por daños a terceros, vigente hasta que el menor cumpla 18 años',
        '- Si solo está presente uno de los padres: declaración jurada original que explique la ausencia del otro. El trámite lo hace el padre o la madre presente',
        '- Si faltan los dos padres: certificación notarial de la resolución judicial que te faculta para representar al menor',
        '## Adicional',
        '- Si ayudas al representante del menor a usar SIMPLE: el poder con el que lo representas',
        'Los documentos se piden a medida que avanzas en el trámite'
      ] }
    ],
    pasos: [
      { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta los términos', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: [
          'Declaro bajo juramento que conozco los requisitos previos. Si miento en la información o entrego documentos alterados o falsificados, cometo el delito de estafa informática (artículo 10 de la Ley Especial contra los Delitos Informáticos y Conexos) y el trámite queda improcedente. La Dirección de Tránsito Terrestre puede tomar acciones legales y dar aviso a la Fiscalía General de la República',
          'Señalo como medio para recibir notificaciones la plataforma SIMPLE y, para los efectos legales, el correo electrónico que proporcione en el trámite'
        ] },
        { tipo: 'opciones', nombre: 'terminos_condiciones_tramite', etiqueta: '¿Aceptas la declaración jurada?', marcado: true, opciones: [{ valor: 'si_acepto_terminos', texto: 'Lo declaro bajo juramento', icono: 'ph-seal-check' }] }
      ] },
      sigueEnPortal(['Después de la declaración jurada, el VMT te pide los datos y los documentos del trámite'])
    ]
  };

  F[38] = notaLegalTramite({ subtitulo: 'Autorización para realizar el control de emisión de gases', icono: 'ph-gauge', direccion: TRANSPORTE });
  F[39] = notaLegalTramite({ subtitulo: 'Certificación de tarifario', icono: 'ph-receipt', direccion: TRANSPORTE, nombre: 'acepto_terminos_0' });
  F[40] = notaLegalTramite({ subtitulo: 'Constancia de capacidad', icono: 'ph-truck', direccion: CARGA });
  F[41] = notaLegalTramite({ subtitulo: 'Constancia de modificación a la capacidad', icono: 'ph-truck-trailer', direccion: CARGA });
  F[42] = notaLegalTramite({ subtitulo: 'Constancia para la exención de IVA', icono: 'ph-currency-dollar', direccion: TRANSPORTE });
  F[43] = notaLegalTramite({ subtitulo: 'Modificación física de vehículo de transporte de carga', icono: 'ph-wrench', direccion: CARGA });
  F[46] = notaLegalTramite({ subtitulo: 'Registro de transportista de carga', icono: 'ph-identification-badge', direccion: CARGA, antes: [
    { tipo: 'nota', estilo: 'aviso', titulo: 'Usa un correo nuevo', lineas: ['No uses un correo electrónico con el que ya hayas hecho otro registro de transportista: el trámite se deniega automáticamente'] }
  ] });
  F[47] = notaLegalTramite({ subtitulo: 'Renovación de registro de transportista de carga', icono: 'ph-arrows-clockwise', direccion: CARGA });
  F[117] = notaLegalTramite({ subtitulo: 'Constancia de competencia', icono: 'ph-crane', direccion: 'La Dirección General de Caminos',
    sigue: sigueEnPortal(['Después de aceptar la nota legal, el MOP te pide los datos y los documentos del trámite']) });

  /* ===== CEPA ===== */
  // 79 (trámite 190) y 80 (trámite 280): el último "Siguiente" envía la solicitud a CEPA, que confirma la disponibilidad y el
  // costo. 81 (trámite 428): un preformulario (cliente, instancia e instalación) y, en la etapa "Llenado de solicitud", la
  // planilla de personas (en tabla o en archivo), la carpeta de documentos y la sucursal; su último "Siguiente" lo envía a revisión
  const PERSONA_CEPA = [
    { valor: 'persona_natural', texto: 'Persona natural', icono: 'ph-user' },
    { valor: 'persona_juridica', texto: 'Persona jurídica', icono: 'ph-buildings' },
    { valor: 'entidad_publica', texto: 'Entidad pública', icono: 'ph-bank' }
  ];
  const DOCUMENTOS_CEPA = [{ valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet', texto: 'Carnet de residente' }];
  const documentoCepa = (s, si) => [
    { tipo: 'opciones', nombre: 'tipo_de_documento' + s, etiqueta: 'Tipo de documento', compacto: true, opciones: DOCUMENTOS_CEPA, si },
    { tipo: 'texto', nombre: s ? 'dui' + s : 'numero_de_documento', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: `tipo_de_documento${s}=dui` },
    { tipo: 'texto', nombre: 'pasaporte' + s, etiqueta: 'Número de pasaporte', max: 20, si: `tipo_de_documento${s}=pasaporte` },
    { tipo: 'texto', nombre: 'carnet' + s, etiqueta: 'Número de carnet de residente', max: 20, si: `tipo_de_documento${s}=carnet` }
  ];
  const GENERO_CEPA = [{ valor: 'Masculino', texto: 'Masculino', icono: 'ph-gender-male' }, { valor: 'Femenino', texto: 'Femenino', icono: 'ph-gender-female' }];
  const ZIP_CEPA = { ayuda: 'Formatos permitidos: ZIP, RAR. Hasta 15 MB', acepta: '.zip,.rar' };
  const REQUISITOS_FOTO_CEPA = ['- Fotografía de medio cuerpo con fondo blanco, sin sombrero, gorra, lentes ni mantilla y sin que el cabello cubra el rostro, en JPG o BMP de al menos 500 KB'];
  const CARPETA_CEPA = ['## Carpeta de documentos', '- Un ZIP con las carpetas «Primera vez» y «Reposición» y, dentro, una subcarpeta por persona con su número de lista y nombre, por ejemplo 1_Jose Ismael Peña', '- Dentro de cada subcarpeta, los documentos en PDF y la fotografía en PNG o JPG', '- El acta de recepción y notificación del carné y las normas de uso en las empresas de CEPA', '- Tantas subcarpetas como personas haya en la planilla'];
  const EMBAJADAS_CEPA = ['Embajada de Alemania', 'Embajada de Argentina', 'Embajada de Belice', 'Embajada de Brasil', 'Embajada de Canadá', 'Embajada de Chile', 'Embajada de Colombia', 'Embajada de Corea', 'Embajada de Costa Rica', 'Embajada de Cuba', 'Embajada de Ecuador', 'Embajada de España', 'Embajada de Los Estados Unidos', 'Embajada de Francia', 'Embajada de Guatemala', 'Embajada de Honduras', 'Embajada de Italia', 'Embajada de Japón', 'Embajada de Malta', 'Embajada de Marruecos', 'Embajada de México', 'Embajada de Nicaragua', 'Embajada del Estado de Palestina', 'Embajada de Panamá', 'Embajada del Perú', 'Embajada de Qatar', 'Embajada de República Dominicana', 'Embajada de China', 'Embajada de Uruguay', 'Embajada de Venezuela', 'Embajada de Rusia', 'Embajada de Turquía', 'KOIKA', 'ONU Mujeres', 'PNUD', 'Programa Mundial de Alimentos', 'Programa Mundial para las Migraciones', 'Santa Sede – Nunciatura Apostólica', 'Unión Europea'];
  const ARRENDATARIOS_CEPA = ['ACOBAM DE R. L.', 'ACOPLES', 'ADIMEX', 'AERODESPACHOS DE EL SALVADOR, S.A DE C.V.', 'AEROMANTENIMIENTO, S.A. DE C.V.', 'AGENCIA INTERNACIONAL MARITIMA, S.A. DE C.V.', 'AIRPORT CHANNEL CORPORATION, S.A. DE C.V.', 'AIRSUPPORT, S.A. DE C.V.', 'AMERICAN AIRLINES', 'AMERIJET DE EL SALVADOR, S.A. DE C.V.', 'AMERIJET EL SALVADOR, S.A. DE C.V.', 'ANGÉLICA CENTENO VDA. DE MORENA', 'ARTESANIAS ASOCIACION MANOS AMIGAS', 'ARTESANÍAS DE EL SALVADOR, S.A. DE C.V', 'ASESORAMIENTO DE IMPORTACIONES Y EXPORTACIONES, S.A. DE C.V.', 'ATILISA, S.A. DE C.V.', 'AUTO INVERSIONES', 'AVIS RENT A CAR', 'BANCO AGRICOLA', 'BANCO CUSCATLAN', 'BANCO HIPOTECARIO', 'BUDGET RENT CAR', 'BURGER KING', 'CADEJO', 'CALDERÓN INVERSIONES, S.A DE C.V.', 'CARGA URGENTE DE EL SALVADOR, S.A. DE C.V.', 'CARGO INTERNACIONAL', 'CELESTE IMPERIO', 'CLAUDYS CAKE', 'CLUB DE PLAYA SALINITAS, S.A. DE C.V. (DECAMERON)', 'COCESNA', 'COCINA DE VUELOS, S.A. DE C.V.', 'COMCA INTERNACIONAL', 'COMEXCA, S.A. DE C.V.', 'COMPAÑÍA PANAMEÑA DE AVIACIÓN', 'CONSEJO SALVADOREÑO DEL CAFÉ', 'CORPORACIÓN SALVADOREÑO DE TURISMO', 'COURIER INTERNACIONAL, S.A. DE C. V.', 'DELIGHT´S, S.A. DE C.V.', 'DELTA AIRLINES', 'DFASS LATAM EL SALVADOR', 'D.H.L. EXPRESS ( EL SALVADOR), S.A.DE C.V.', 'DHL FORWARDING', 'DISTRIBUIDORA UNOPETROL EL SALVADOR, S.A. DE C.V.', 'DLC. S.A. DE C.V.', 'DOMINO´S PIZZA', 'EL SALVADOR PRODUCTIVO', 'EXIT DE EL SALVADOR, S.A.', 'FARMACIA LA BUENA', 'FUNDACIÓN AYUDA A VIVIR', 'GENTE AYUDANDO GENTE', 'GLOBAL CARGO', 'GO GREEN', 'GOFRES', 'GUTICIA DE EL SALVADOR, S.A. DE C.V.', 'HABANA CIGAR', 'HERTZ RENT A CAR', 'INTECSA', 'INVERSIONES ACOPACIFIC, S.A. DE C. V.', 'INVERSIONES A.H.G., S. A. DE C. V.', 'INVERSIONES ALBRI', 'IRASOL, S.A. DE C. V.', 'KUEHNE & NAGEL', 'LA PLACE DE PARIS, S.A. DE C.V.', 'LINEAS AEREAS DE ESPAÑA, IBERIA', 'LIZARRAN', 'LURYX DUTY FREE, S.A. DE C.V.', 'MARISELA ANCHETA DE MAZA', 'MUDANZAS INTERNACIONAL, S.A.DE C.V.', 'MUNDICARGA EXPRESS, S.A. DE C.V.', 'OVNI INVERSIONES, S.A DE C.V.', 'PANALPINA, S.A. DE C.V.', 'PERÚ EL DORADO, S.A. DE C. V.', 'PIZQUÉ', 'POLLO CAMPERO', 'POLLO CAMPESTRE', 'PRODUCTOS ALIMENTICIOS DIANA, S.A. DE C.V.', 'PROMOTORA MULTIPLE, S.A. DE C.V.', 'PUMA ENERGY', 'QUALITY GRAINS, S.A. DE C.V', 'RESTAURANTE PIZQUÉ', 'RINCON DE MI TIA, S.A. DE C .V.', 'SANTEROS, S.A. DE C.V.', 'SIEMENS', 'SISTEMAS AÉREOS, S.A. DE C.V.', 'SOCIEDAD INTERNACIONAL DE TELECOMUNICACIONES (SITA)', 'SOLDEPOT, S.A. DE C.V.', 'SPIRIT AIRLINES', 'STARBUCKS', 'SUBWAY', 'TAG AIRLINES', 'TAXIS ACACYA', 'TIENDA IDEAL', 'TIENDAS Y FRANQUICIAS, S.A. DE C.V.', 'TODO VERDE, S.A. DE C.V.', 'TRANS EXPRESS DE EL SALVADOR, S.A. DE C.V.', 'TRANSPORTEMOS, S.A. DE C.V.', 'TRANSPORTES ACOPACIFIC', 'TROPIC AIR', 'UDP PRODEYCO ICON', 'UNITED AIRLINES', 'UNO RENT A CAR', 'UPS SCS EL SALVADOR, LTDA DE C.V', 'VOLARIS', 'WENDYS HAMBURGUESA'];
  const CONCESIONARIOS_CEPA = ['Academia Superior de Aviación (ASA)', 'Aeroclasicos', 'Aerosal Training Solution8. L.A Aviators Flight Academy', 'Asersa, S.A. de C.V.', 'ATS – Academia de Formación Académica', 'Aviasa FBO', 'Centro de Adiestramiento Aéreo Académico (CAAA)', 'Centro de Entrenamiento Aeronaútico (CEA)', 'Club Salvadoreño de Aviación (AEROCLUB)', 'Dárdano Aerotech', 'El Salvador FBO', 'El Salvador PARTEX', 'Federación Salvadoreña de Paracaidismo (Fesapade)', 'Flight Training', 'Garán de El Salvador', 'Grupo Poma', 'Grupo QUANTUM', 'Helicopteros de Centroamerica S.A. de C.V. (HELICA)', 'Helicopteros de El Salvador (HELICORP)', 'Industria de Hilos S.A de C.V. (HILOSA)', 'ITEXSAL (Instituto Técnico EXSAL)', 'Link Aviation Services (LAS)', 'Miltair Aviation S.A. de C.V.', 'PANAL Aviación', 'Recursos Aplicados S.A. de C.V.', 'Santa Elena Aviation', 'Textufil'];
  const INSTITUCIONES_CEPA = ['ANDA', 'ANSP', 'BCR', 'CENTA', 'CNR', 'Corte de Cuentas', 'Defensoría del Consumidor', 'DGME', 'Dirección General de Aduanas', 'ISDEMU', 'ISSS', 'MARN', 'Ministerio de Agricultura y Ganadería', 'Ministerio de Economía', 'Ministerio de Educación', 'Ministerio de Hacienda', 'Ministerio de Justicia y Seguridad Pública', 'Ministerio de la Defensa Nacional', 'Ministerio de Obras Públicas', 'Ministerio de Relaciones Exteriores', 'Ministerio de Salud', 'Ministerio de Trabajo', 'Ministerio de Turismo', 'PNC', 'PROESA', 'Protección Civil', 'RNPN', 'VMT'];
  const INSTITUCIONES_AEROPUERTO_CEPA = ['AAC', 'BCR', 'COCESNA', 'Correos de El Salvador', 'DGME', 'Dirección General de Aduanas', 'ISSS', 'Ministerio de Agricultura y Ganadería (cuarentena)', 'Ministerio de Gobernación', 'Ministerio de Hacienda', 'Ministerio De Justicia', 'Ministerio de la Defensa Nacional', 'Ministerio de Relaciones Exteriores', 'Ministerio de Salud', 'Ministerio de Turismo', 'OIRSA', 'PNC'];
  const pares = lista => lista.map(x => [x, x]);
  const OFICINA_CEPA = 'Oficina Central de CEPA';
  const AEROPUERTO_CEPA = 'Aeropuerto Internacional de El Salvador';
  const ILOPANGO_CEPA = 'Aeropuerto de Ilopango';

  F[79] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Servicio VIP en el Aeropuerto Internacional de El Salvador',
    icono: 'ph-airplane-tilt',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA_CEPA },
      ...documentoCepa('', 'tipo_de_persona=persona_natural'),
      { tipo: 'texto', nombre: 'nit_instit', etiqueta: 'NIT de la empresa', ...NIT_AAC, si: 'tipo_de_persona=persona_juridica' },
      { tipo: 'texto', nombre: 'nit_inst_publ', etiqueta: 'NIT de la institución', ...NIT_AAC, si: 'tipo_de_persona=entidad_publica' }
    ],
    pasos: [
      { titulo: 'Solicitud de servicio VIP', subtitulo: 'Cuéntanos sobre el viaje', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Cada servicio VIP cuesta $55.00 por persona desde los 3 años, con IVA incluido'] },
        { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true, si: 'tipo_de_persona=persona_natural' },
        { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true, si: 'tipo_de_persona=persona_natural' },
        { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Razón o denominación social', max: 150, si: 'tipo_de_persona!=persona_natural' },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', soloLectura: true, media: true },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono', media: true },
        { tipo: 'opciones', nombre: 'pasajero', etiqueta: 'Servicio para el pasajero', compacto: true, opciones: [
          { valor: 'salida', texto: 'De salida' }, { valor: 'entrada', texto: 'De entrada' }, { valor: 'ambos', texto: 'De entrada y salida' }
        ] },
        { tipo: 'opciones', nombre: 'cuenta_con_imagen', etiqueta: '¿Tienes la imagen del boleto aéreo?', opciones: SI_NO },
        archivo('imagen_itinerario', 'Imagen del boleto', { si: 'cuenta_con_imagen=si' }),
        { tipo: 'seccion', titulo: 'Datos del pasajero e itinerario', si: 'cuenta_con_imagen=no' },
        { tipo: 'nota', estilo: 'info', si: 'pasajero=ambos', lineas: ['Escribe primero el vuelo de entrada y, en «Otros vuelos», el de salida'] },
        { tipo: 'texto', nombre: 'nombre_pasajero', etiqueta: 'Nombre del pasajero', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: 'cuenta_con_imagen=no', media: true },
        { tipo: 'texto', nombre: 'aerolinea', etiqueta: 'Aerolínea', placeholder: 'Avianca', max: 50, si: 'cuenta_con_imagen=no', media: true },
        { tipo: 'texto', nombre: 'numero_vuelo', etiqueta: 'Número de vuelo', placeholder: 'AV 580', max: 10, si: 'cuenta_con_imagen=no', tercio: true },
        { tipo: 'texto', nombre: 'fecha_vuelo', etiqueta: 'Fecha del vuelo', ...FECHA_FUTURA, si: 'cuenta_con_imagen=no', tercio: true },
        { tipo: 'texto', nombre: 'hora_vuelo', etiqueta: 'Hora del vuelo', ...HORA_12, si: 'cuenta_con_imagen=no', tercio: true },
        { tipo: 'texto', nombre: 'otros_vuelos', etiqueta: 'Otros pasajeros o vuelos', ayuda: 'Si son varios, escribe nombre, vuelo, aerolínea, fecha y hora de cada uno, separados por punto y coma', max: 500, opcional: true, si: 'cuenta_con_imagen=no' },
        { tipo: 'texto', nombre: 'no_de_maletas', etiqueta: 'Maletas además del equipaje de mano', modo: 'numeric', placeholder: '1', max: 2, patron: '[0-9]{1,2}', mensaje: 'Escribe solo el número, por ejemplo 1' },
        { tipo: 'opciones', nombre: 'viaja_con_mascotas', etiqueta: '¿Viajan con mascotas?', opciones: SI_NO, si: 'tipo_de_persona=persona_juridica' },
        { tipo: 'nota', estilo: 'aviso', si: 'viaja_con_mascotas=si', lineas: ['La tarifa del servicio VIP no incluye el impuesto por el ingreso de mascotas: si no lo pagaste antes, tenlo en cuenta'] },
        { tipo: 'texto', nombre: 'informacion_adicional', etiqueta: 'Información adicional', max: 300, opcional: true }
      ] },
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['CEPA verifica la disponibilidad y te avisa a la brevedad', 'Cada servicio cuesta $55.00 por persona desde los 3 años'] }, ...ENVIAR.campos] }
    ]
  };

  F[80] = {
    titulo: 'Identificación del solicitante',
    subtitulo: 'Servicio de tiempo extraordinario en el Puerto de Acajutla',
    icono: 'ph-boat',
    campos: [
      { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, tercio: true },
      { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, tercio: true },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, tercio: true },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
      { ...CONFIRMAR_CORREO_AAC, media: true },
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono de contacto' }
    ],
    pasos: [
      { titulo: 'Identificación del servicio', subtitulo: 'Cuéntanos qué servicio necesitas y cuándo', campos: [
        { tipo: 'opciones', nombre: 'areas_solicitadas', etiqueta: 'Servicio de tiempo extraordinario para', columna: true, opciones: [
          { valor: 'carga_general', texto: 'Carga general', detalle: 'Hierro, sacos jumbo, maquinaria', icono: 'ph-package' },
          { valor: 'contenedores', texto: 'Vaciado y llenado de contenedores', icono: 'ph-shipping-container' },
          { valor: 'patio_contenedores', texto: 'Patio de contenedores', detalle: 'Recepción o despacho', icono: 'ph-stack' },
          { valor: 'patio_vehiculos', texto: 'Patio de vehículos', icono: 'ph-car' },
          { valor: 'alquiler_equipos', texto: 'Alquiler de equipos', detalle: 'Grúas y montacargas', icono: 'ph-crane' },
          { valor: 'granel', texto: 'Carga a granel y básculas', detalle: 'Sólida o líquida', icono: 'ph-drop' }
        ] },
        { tipo: 'archivo', nombre: 'archivo_de_contenedores', etiqueta: 'Listado de contenedores', ayuda: 'Formatos permitidos: XLSX, PDF', acepta: '.xlsx,.pdf', si: 'areas_solicitadas=patio_contenedores' },
        { tipo: 'texto', nombre: 'fecha', etiqueta: 'Fecha de atención', ...FECHA_FUTURA, media: true },
        { tipo: 'texto', nombre: 'fecha_final', etiqueta: 'Fecha de finalización', ...FECHA_FUTURA, media: true, si: 'areas_solicitadas=patio_contenedores' },
        { tipo: 'texto', nombre: 'horario_de_atencion', etiqueta: 'Hora de inicio', ...HORA_12, media: true },
        { tipo: 'texto', nombre: 'horario_de_atencion2', etiqueta: 'Hora de finalización', ...HORA_12, placeholder: '6:00 PM', ayuda: 'Distinta de la hora de inicio', media: true },
        { tipo: 'texto', nombre: 'comentario_general', etiqueta: 'Especificaciones de la solicitud', placeholder: 'Descarga de 3 contenedores de maquinaria', max: 500 }
      ] },
      { titulo: 'Facturación', subtitulo: 'Datos para emitir el documento fiscal', campos: [
        { tipo: 'texto', nombre: 'facturar_nom', etiqueta: 'Facturar a nombre de', ayuda: 'Persona natural o jurídica', max: 150, media: true },
        { ...TELEFONO, nombre: 'telefono_facturacion', etiqueta: 'Teléfono de contacto', ayuda: 'Para la facturación', media: true },
        { tipo: 'opciones', nombre: 'documento_fiscal', etiqueta: 'Documento fiscal a emitir', columna: true, opciones: [
          { valor: 'ccf', texto: 'Comprobante de crédito fiscal', icono: 'ph-file-text' },
          { valor: 'factura', texto: 'Factura de consumidor final', icono: 'ph-receipt' },
          { valor: 'exportacion', texto: 'Factura de exportación', icono: 'ph-export' }
        ] },
        { tipo: 'nota', estilo: 'info', si: 'documento_fiscal=ccf', lineas: ['Persona jurídica: adjunta el NRC legible por ambos lados', 'Persona natural: adjunta el NRC y el DUI legibles por ambos lados'] },
        { tipo: 'nota', estilo: 'info', si: 'documento_fiscal!=ccf', lineas: ['Adjunta el DUI o el NIT legible por ambos lados de quien recibe la factura, o un documento de referencia si es extranjero'] },
        archivo('documento_identificacion', 'Documento para emitir la factura', { ayuda: 'Formatos permitidos: JPG, PNG, PDF', acepta: '.jpg,.jpeg,.png,.pdf' })
      ] },
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['CEPA registra tu solicitud, la revisa y te indica el costo, que varía según el servicio'] }, ...ENVIAR.campos] }
    ]
  };

  const PLANILLA_CEPA = 'seleccione_la_forma=tabla';
  const REPOSICION_CEPA = 'tramites_por_reposicion=si';
  F[81] = {
    titulo: 'Datos generales',
    subtitulo: 'Carnet de acceso a las instalaciones de CEPA',
    icono: 'ph-identification-badge',
    campos: [
      { tipo: 'opciones', nombre: 'persona', etiqueta: 'Persona', opciones: PERSONA() },
      { tipo: 'opciones', nombre: 'personal_o_tercero', etiqueta: '¿Para quién es la solicitud?', opciones: [
        { valor: 'personal', texto: 'Para mí', icono: 'ph-user' },
        { valor: 'tercero', texto: 'Para un tercero', detalle: 'Necesitas un poder', icono: 'ph-users' }
      ] }
    ],
    pasos: [
      { titulo: 'Datos del cliente', subtitulo: 'Confirma tus datos', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
        { tipo: 'opciones', nombre: 'genero', etiqueta: 'Género', opciones: GENERO_CEPA, si: 'persona=persona_natural' },
        ...documentoCepa('', 'persona=persona_natural'),
        { tipo: 'texto', nombre: 'profesion_u_oficio', etiqueta: 'Profesión u oficio', max: 100, si: 'persona=persona_natural' },
        { tipo: 'texto', nombre: 'direccion', etiqueta: 'Dirección', max: 200, si: 'persona=persona_natural' },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono móvil', si: 'persona=persona_natural', media: true },
        { ...TELEFONO, nombre: 'telefono_fijo', etiqueta: 'Teléfono fijo', placeholder: '2200-1234', si: 'persona=persona_natural', media: true },
        { tipo: 'seccion', titulo: 'Datos de la empresa', si: 'persona=persona_juridica' },
        { tipo: 'texto', nombre: 'propietario', etiqueta: 'Propietario', max: 100, si: 'persona=persona_juridica', media: true },
        { tipo: 'texto', nombre: 'nombre_de_la_empresa', etiqueta: 'Empresa o instancia que representas', max: 150, si: 'persona=persona_juridica', media: true },
        { tipo: 'texto', nombre: 'nit', etiqueta: 'NIT', ...NIT_AAC, si: 'persona=persona_juridica', media: true },
        { tipo: 'texto', nombre: 'nrc', etiqueta: 'NRC', ...NRC_AAC, si: 'persona=persona_juridica', media: true },
        { tipo: 'texto', nombre: 'giro', etiqueta: 'Giro o actividad económica', max: 150, si: 'persona=persona_juridica' },
        { ...TELEFONO, nombre: 'telefono_de_oficina', etiqueta: 'Teléfono de oficina', placeholder: '2200-1234', si: 'persona=persona_juridica', media: true },
        { tipo: 'texto', nombre: 'direccion_de_oficina', etiqueta: 'Dirección de oficina', max: 200, si: 'persona=persona_juridica', media: true }
      ] },
      { titulo: 'Tercero autorizado', subtitulo: 'Cuéntanos quién hace el trámite por ti', si: 'personal_o_tercero=tercero', campos: [
        { tipo: 'texto', nombre: 'nombre_tercero', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
        { tipo: 'opciones', nombre: 'genero_tercero', etiqueta: 'Género', opciones: GENERO_CEPA },
        ...documentoCepa('_tercero'),
        { tipo: 'texto', nombre: 'profesion_u_oficio_tercero', etiqueta: 'Profesión u oficio', max: 100, media: true },
        { tipo: 'texto', nombre: 'direccion_tercero', etiqueta: 'Dirección', max: 200, media: true },
        { ...TELEFONO, nombre: 'telefono_movil_tercero', etiqueta: 'Teléfono móvil', media: true },
        { ...TELEFONO, nombre: 'telefono_fijo_tercero', etiqueta: 'Teléfono fijo', placeholder: '2200-1234', media: true },
        { tipo: 'archivo', nombre: 'documento_poder', etiqueta: 'Poder que te autoriza', ayuda: 'Formato PDF, hasta 5 MB', acepta: '.pdf' }
      ] },
      { titulo: 'Instancia e instalación', subtitulo: 'Dinos a qué instalación necesitas entrar', campos: [
        { tipo: 'opciones', nombre: 'seleccione_la_instancia', etiqueta: 'Instancia a la que perteneces', columna: true, opciones: [
          { valor: 'consulados', texto: 'Consulados, embajadas u organismos internacionales', icono: 'ph-globe' },
          { valor: 'arrendatarios', texto: 'Arrendatarios, concesionarios o contratistas', icono: 'ph-storefront' },
          { valor: 'gobierno', texto: 'Entidades de gobierno', icono: 'ph-bank' }
        ] },
        { tipo: 'lista', nombre: 'selecciona_las_instalaciones', etiqueta: 'Instalación a la que necesitas acceso', depende: 'seleccione_la_instancia', opcionesPor: {
          consulados: pares([OFICINA_CEPA, AEROPUERTO_CEPA, ILOPANGO_CEPA]),
          arrendatarios: pares([AEROPUERTO_CEPA, ILOPANGO_CEPA]),
          gobierno: pares([OFICINA_CEPA, AEROPUERTO_CEPA, ILOPANGO_CEPA])
        } },
        { tipo: 'lista', nombre: 'organismo', etiqueta: 'Embajada u organismo', opciones: pares(EMBAJADAS_CEPA), si: 'seleccione_la_instancia=consulados' },
        { tipo: 'lista', nombre: 'arrendatario', etiqueta: 'Arrendatario o concesionario', depende: 'selecciona_las_instalaciones', opcionesPor: {
          [AEROPUERTO_CEPA]: pares(ARRENDATARIOS_CEPA), [ILOPANGO_CEPA]: pares(CONCESIONARIOS_CEPA)
        }, si: 'seleccione_la_instancia=arrendatarios' },
        { tipo: 'lista', nombre: 'institucion', etiqueta: 'Institución', depende: 'selecciona_las_instalaciones', opcionesPor: {
          [OFICINA_CEPA]: pares(INSTITUCIONES_CEPA), [ILOPANGO_CEPA]: pares(INSTITUCIONES_CEPA), [AEROPUERTO_CEPA]: pares(INSTITUCIONES_AEROPUERTO_CEPA)
        }, si: 'seleccione_la_instancia=gobierno' }
      ] },
      { titulo: 'Método de presentación', subtitulo: 'Elige cómo nos das los datos de las personas', campos: [
        { tipo: 'opciones', nombre: 'seleccione_la_forma', etiqueta: 'Método de presentación', columna: true, opciones: [
          { valor: 'tabla', texto: 'Llenar la planilla aquí', detalle: 'Escribes los datos de cada persona', icono: 'ph-table' },
          { valor: 'externo', texto: 'Subir la planilla en un archivo', detalle: 'Con el formato de CEPA, en CSV o XLSX', icono: 'ph-upload-simple' }
        ] }
      ] },
      { titulo: 'Planilla de personas', subtitulo: 'Escribe los datos de cada persona', si: PLANILLA_CEPA, campos: [
        { tipo: 'nota', estilo: 'requisitos', titulo: 'Primera vez: documentos por persona', lineas: [
          '- Nacionales: DUI vigente ampliado al 150 % y solvencia policial y antecedentes penales originales, de no más de 3 meses',
          '- Extranjeros: pasaporte vigente, confirmación de antecedentes policiales y credenciales diplomáticas',
          ...REQUISITOS_FOTO_CEPA
        ] },
        { tipo: 'seccion', titulo: 'Persona 1' },
        { tipo: 'texto', nombre: 'nombre_completo', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', media: true },
        { tipo: 'texto', nombre: 'nacionalidad', etiqueta: 'Nacionalidad', placeholder: 'Salvadoreña', max: 30, patron: SOLO_LETRAS, media: true },
        { tipo: 'opciones', nombre: 'sexo', etiqueta: 'Sexo', opciones: GENERO_CEPA },
        { tipo: 'texto', nombre: 'documento_persona', etiqueta: 'DUI o pasaporte', max: 20, media: true },
        { tipo: 'texto', nombre: 'entidad', etiqueta: 'Entidad', max: 100, media: true },
        { tipo: 'texto', nombre: 'area_de_trabajo', etiqueta: 'Área de trabajo', max: 100, media: true },
        { tipo: 'texto', nombre: 'cargo', etiqueta: 'Cargo', max: 100, media: true },
        { ...TELEFONO, nombre: 'telefono_movil_persona', etiqueta: 'Teléfono móvil', media: true },
        { ...TELEFONO, nombre: 'telefono_fijo_persona', etiqueta: 'Teléfono fijo', placeholder: '2200-1234', media: true },
        { tipo: 'texto', nombre: 'direccion_persona', etiqueta: 'Dirección', max: 100 },
        { tipo: 'texto', nombre: 'otras_personas', etiqueta: 'Otras personas', ayuda: 'Si son varias, escribe los mismos datos de cada una, separadas por punto y coma', max: 1000, opcional: true },
        { tipo: 'opciones', nombre: 'tramites_por_reposicion', etiqueta: '¿Tienes trámites por reposición que agregar?', opciones: SI_NO },
        { tipo: 'nota', estilo: 'requisitos', titulo: 'Reposición: documentos por persona', si: REPOSICION_CEPA, lineas: [
          ...REQUISITOS_FOTO_CEPA,
          '- DUI ampliado al 150 % o pasaporte, según corresponda',
          '- Por extravío o robo: copia de la denuncia ante la PNC',
          '- Por vencimiento o deterioro: entrega el carné, que es propiedad de CEPA',
          '- Por vencimiento: antecedentes y solvencia de la PNC si es nacional, o pasaporte, antecedentes y credenciales diplomáticas si es extranjero'
        ] },
        { tipo: 'seccion', titulo: 'Reposición', si: REPOSICION_CEPA },
        { tipo: 'texto', nombre: 'nombre_reposicion', etiqueta: 'Nombre completo', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras', si: REPOSICION_CEPA },
        { tipo: 'lista', nombre: 'motivo_reposicion', etiqueta: 'Motivo de reposición', si: REPOSICION_CEPA, opciones: pares(['Extravío-primera vez', 'Extravío-segunda vez', 'Extravío-tercera vez', 'Robo-primera vez', 'Robo-segunda vez', 'Robo-tercera vez', 'Hurto-primera vez', 'Hurto-segunda vez', 'Hurto-tercera vez', 'Deterioro-primera vez', 'Deterioro-segunda vez', 'Deterioro-tercera vez', 'Vencimiento']) },
        { tipo: 'opciones', nombre: 'nivel_acceso', etiqueta: 'Nivel de acceso', compacto: true, si: REPOSICION_CEPA, opciones: [{ valor: 'Rojo', texto: 'Rojo' }, { valor: 'Amarillo', texto: 'Amarillo' }, { valor: 'Verde', texto: 'Verde' }] },
        { tipo: 'opciones', nombre: 'categoria_acceso', etiqueta: 'Categoría de acceso', compacto: true, si: REPOSICION_CEPA, opciones: [{ valor: 'B', texto: 'B' }, { valor: 'C', texto: 'C' }, { valor: 'Ninguna', texto: 'Ninguna' }] },
        { tipo: 'texto', nombre: 'relato', etiqueta: 'Breve relato del hecho', max: 100, si: REPOSICION_CEPA },
        { tipo: 'nota', estilo: 'info', lineas: CARPETA_CEPA },
        { tipo: 'archivo', nombre: 'carpeta_de_documentos', etiqueta: 'Carpeta de documentos', ...ZIP_CEPA }
      ] },
      { titulo: 'Planilla de personas', subtitulo: 'Sube la planilla y los documentos', si: 'seleccione_la_forma=externo', campos: [
        { tipo: 'nota', estilo: 'requisitos', titulo: 'El ZIP debe tener', lineas: [
          '- La planilla con el formato de CEPA, en CSV o XLSX, con todos los datos',
          '- El acta de recepción y notificación del carné y las normas de uso en las empresas de CEPA',
          '## Primera vez',
          ...REQUISITOS_FOTO_CEPA,
          '- Nacionales: DUI ampliado al 150 % y solvencia policial y antecedentes penales originales, de no más de 3 meses',
          '- Extranjeros: pasaporte vigente, confirmación de antecedentes policiales y credenciales diplomáticas',
          '## Reposición',
          '- Por vencimiento o deterioro: entrega el carné, que es propiedad de CEPA',
          '- DUI ampliado al 150 % o pasaporte, y la fotografía',
          '- Por extravío o robo: copia de la denuncia ante la PNC',
          '## Orden',
          '- Una subcarpeta por persona con su número de lista y nombre, por ejemplo 1_Jose Ismael Peña, con los documentos en PDF y la fotografía en PNG o JPG',
          '- Tantas subcarpetas como personas haya en la planilla'
        ] },
        { tipo: 'archivo', nombre: 'adjuntar_carpeta', etiqueta: 'Carpeta con la planilla y los documentos', ayuda: 'Formato ZIP, hasta 15 MB', acepta: '.zip' }
      ] },
      { titulo: 'Sucursal de retiro', subtitulo: 'Dónde recogerás los carnets', campos: [
        { tipo: 'lista', nombre: 'selecciona_sucursal', etiqueta: 'Sucursal de retiro', opciones: [[OFICINA_CEPA, OFICINA_CEPA]] },
        { tipo: 'nota', estilo: 'info', lineas: ['Por ahora los carnets se retiran solo en la Oficina Central de CEPA'] }
      ] },
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['CEPA revisa tu solicitud y, si hay observaciones, te contacta para que las corrijas'] }, ...ENVIAR.campos] }
    ]
  };

  /* ===== CONAPINA ===== */
  // 82 (trámite 297): la primera etapa solo pide la asistencia técnica y el contacto; CONAPINA la admite y después habilita la
  // representación legal y los datos del programa. 83 (trámite 458) y 84 (trámite 281) se copiaron enteros; el último
  // "Siguiente" de cada uno envía la solicitud. La geolocalización del CAPI (mapa) no se copió
  const PDF_CONAPINA = (nombre, etiqueta, extra = {}) => ({ tipo: 'archivo', nombre, etiqueta, ayuda: 'Formato PDF, hasta 15 MB', acepta: '.pdf', ...extra });
  const DOC_CONAPINA = (nombre, etiqueta, extra = {}) => archivo(nombre, etiqueta, { ayuda: FORMATOS_IMAGEN + '. Hasta 15 MB', ...extra });
  const DOCUMENTOS_CONAPINA = [{ valor: 'dui', texto: 'DUI' }, { valor: 'pasaporte', texto: 'Pasaporte' }, { valor: 'carnet_de_residencia', texto: 'Carné de residencia' }];
  const CONTACTO_ID_CONAPINA = [
    { tipo: 'nota', estilo: 'info', lineas: ['Estos datos vienen de Identidad Digital: si no están al día, pide que los actualicen'] },
    { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, media: true },
    { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', soloLectura: true, media: true },
    { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono celular', media: true },
    { ...TELEFONO, nombre: 'telefono_alternativo', etiqueta: 'Teléfono alternativo', opcional: true, media: true }
  ];
  // Datos de una persona del CAPI (representante, apoderado o director): nombre por partes, documento, NIT si no es DUI y contacto
  const personaConapina = (s, { contacto = true } = {}) => [
    ...nombrePorPartes(s + '_', { obligatorio: true }),
    { tipo: 'opciones', nombre: 'tipo_documento_' + s, etiqueta: 'Tipo de documento', compacto: true, opciones: DOCUMENTOS_CONAPINA },
    { tipo: 'texto', nombre: 'dui_' + s, etiqueta: 'Número de DUI', ...FORMATO_DUI, si: `tipo_documento_${s}=dui`, media: true },
    { tipo: 'texto', nombre: 'pasaporte_' + s, etiqueta: 'Número de pasaporte', max: 20, si: `tipo_documento_${s}=pasaporte`, media: true },
    { tipo: 'texto', nombre: 'carnet_' + s, etiqueta: 'Número de identificación migratoria', max: 20, si: `tipo_documento_${s}=carnet_de_residencia`, media: true },
    DOC_CONAPINA('documento_identidad_' + s, 'Copia del documento de identidad', { media: true }),
    { tipo: 'texto', nombre: 'nit_' + s, etiqueta: 'NIT', ...NIT_AAC, si: `tipo_documento_${s}!=dui`, media: true },
    DOC_CONAPINA('imagen_nit_' + s, 'Copia del NIT', { si: `tipo_documento_${s}!=dui`, media: true }),
    ...(contacto ? [
      { ...TELEFONO, nombre: 'telefono_movil_' + s, etiqueta: 'Teléfono móvil', media: true },
      { ...TELEFONO, nombre: 'telefono_fijo_' + s, etiqueta: 'Teléfono fijo', placeholder: '2200-1234', opcional: true, media: true },
      { tipo: 'texto', nombre: 'correo_' + s, etiqueta: 'Correo electrónico', modo: 'email', placeholder: 'nombre@correo.com', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo_' + s, etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_' + s, mensaje: 'Las direcciones de correo electrónico no coinciden', media: true }
    ] : [])
  ];
  const NATURAL_C = 'tipo_persona=persona_natural';
  const JURIDICA_C = 'tipo_persona=persona_juridica';
  const tieneConapina = (nombre, etiqueta, extra = {}) => ({ tipo: 'opciones', nombre, etiqueta, opciones: SI_NO, ...extra });
  const exencionConapina = (s, quien, si) => [
    tieneConapina('exento_' + s, `¿Estás exento de pago por ${quien}?`, { si }),
    PDF_CONAPINA('doc_exencion_' + s, `Exención de pago de ${quien}`, { si: `exento_${s}=si` })
  ];

  F[82] = {
    titulo: 'Inicio de solicitud',
    subtitulo: 'Acreditación de programas y registro de miembros de la REA',
    icono: 'ph-hands-clapping',
    campos: [
      { tipo: 'opciones', nombre: 'asistenciaTecnica', etiqueta: '¿CONAPINA te dio asistencia técnica para acreditar tu programa?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'nombreEntidadInicial', etiqueta: 'Nombre de la entidad', max: 150, si: 'asistenciaTecnica=si', media: true },
      { tipo: 'texto', nombre: 'nombreProgramaInicial', etiqueta: 'Nombre del programa', max: 150, si: 'asistenciaTecnica=si', media: true },
      { tipo: 'lista', nombre: 'tecnicoCONAPINAInicial', etiqueta: 'Técnico que te dio la asistencia', si: 'asistenciaTecnica=si', opciones: pares(['Guadalupe Canizales', 'Lourdes Muñoz', 'Mayra Hernández', 'Elenilson Molina', 'Diego Marín', 'Max Morán', 'Raquel Mendoza', 'Javier Martínez', 'Heidy Avilés', 'Fátima Jiménez']) },
      { tipo: 'texto', nombre: 'descripcionAcciones', etiqueta: 'Acciones que desarrolla o desarrollará el programa', placeholder: 'Talleres de crianza positiva para familias', max: 1000, si: 'asistenciaTecnica=no' }
    ],
    pasos: [
      { titulo: 'Información de contacto', subtitulo: 'Confirma tus datos', campos: CONTACTO_ID_CONAPINA },
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['CONAPINA revisa tu solicitud y te notifica por correo', 'Si la admite, sigues con los datos de la representación legal y del programa'] }, ...ENVIAR.campos] }
    ]
  };

  F[83] = {
    titulo: 'Tipo de autorización',
    subtitulo: 'Centro de Atención a la Primera Infancia (CAPI)',
    icono: 'ph-baby',
    campos: [
      { tipo: 'opciones', nombre: 'tipoAutorizacion', etiqueta: 'Tipo de autorización', compacto: true, opciones: [
        { valor: 'definitiva', texto: 'Definitiva' }, { valor: 'provisional', texto: 'Provisional' }, { valor: 'renovacion', texto: 'Renovación' }
      ] },
      { tipo: 'seccion', titulo: 'Calificación del lugar' },
      { tipo: 'lista', nombre: 'departamento_est', etiqueta: 'Departamento del establecimiento', opciones: DEPARTAMENTOS, media: true },
      { tipo: 'lista', nombre: 'municipio_est', etiqueta: 'Municipio', depende: 'departamento_est', opcionesPor: MUNICIPIOS, media: true },
      { tipo: 'texto', nombre: 'institucionCalificacion', etiqueta: 'Institución competente de la calificación', placeholder: 'OPAMSS', ayuda: 'La OPAMSS en el área metropolitana de San Salvador o la alcaldía del municipio', max: 150 },
      { tipo: 'opciones', nombre: 'is_opamss', etiqueta: '¿Tienes la calificación del lugar de la institución competente?', opciones: SI_NO },
      PDF_CONAPINA('doc_opamss', 'Documento de calificación del lugar', { si: 'is_opamss=si' }),
      { tipo: 'nota', estilo: 'aviso', si: 'is_opamss=no', lineas: ['Para la autorización necesitas los permisos de calificación del lugar de la autoridad competente'] }
    ],
    pasos: [
      { titulo: 'Información del solicitante', subtitulo: 'Cuéntanos quién solicita la autorización', campos: [
        { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona', opciones: PERSONA() },
        ...nombrePorPartes('', { obligatorio: true, casada: NATURAL_C, si: NATURAL_C }),
        { tipo: 'opciones', nombre: 'tipo_documento_nat', etiqueta: 'Tipo de documento', compacto: true, opciones: DOCUMENTOS_CONAPINA, si: NATURAL_C },
        { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: 'tipo_documento_nat=dui', media: true },
        { tipo: 'texto', nombre: 'pasaporte_nat', etiqueta: 'Número de pasaporte', max: 20, si: 'tipo_documento_nat=pasaporte', media: true },
        { tipo: 'texto', nombre: 'carnet_nat', etiqueta: 'Número de identificación migratoria', max: 20, si: 'tipo_documento_nat=carnet_de_residencia', media: true },
        DOC_CONAPINA('doc_identificacion_nat', 'Copia del documento de identidad', { si: NATURAL_C, media: true }),
        { tipo: 'texto', nombre: 'nit_nat', etiqueta: 'NIT', ...NIT_AAC, si: 'tipo_documento_nat!=dui', media: true },
        DOC_CONAPINA('doc_nit_nat', 'Copia del NIT', { si: 'tipo_documento_nat!=dui', media: true }),
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono móvil', si: NATURAL_C, media: true },
        { ...TELEFONO, nombre: 'telefono_fijo_nat', etiqueta: 'Teléfono fijo', placeholder: '2200-1234', opcional: true, si: NATURAL_C, media: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', si: NATURAL_C, media: true },
        { ...CONFIRMAR_CORREO_AAC, si: NATURAL_C, media: true },
        { tipo: 'seccion', titulo: 'Datos de la institución', si: JURIDICA_C },
        { tipo: 'opciones', nombre: 'tipoDeInstitucion', etiqueta: 'Clasificación del titular', compacto: true, si: JURIDICA_C, opciones: [
          { valor: 'publica', texto: 'Pública' }, { valor: 'privada', texto: 'Privada' }, { valor: 'ong', texto: 'ONG' }
        ] },
        { tipo: 'texto', nombre: 'nombre_institucion', etiqueta: 'Nombre de la institución', max: 150, si: JURIDICA_C, media: true },
        { tipo: 'texto', nombre: 'nit_institucion', etiqueta: 'NIT de la institución', ...NIT_AAC, si: JURIDICA_C, media: true },
        PDF_CONAPINA('doc_escritura_const', 'Documento de constitución inscrito en el registro correspondiente', { si: JURIDICA_C, media: true }),
        DOC_CONAPINA('doc_nit_institucion', 'Copia del NIT de la institución', { si: JURIDICA_C, media: true })
      ] },
      { titulo: 'Representante legal', subtitulo: 'Datos según su documento de identidad', si: JURIDICA_C, campos: [
        ...personaConapina('representante'),
        DOC_CONAPINA('doc_credencial_junta', 'Credencial vigente del representante legal'),
        tieneConapina('isOtherRepresentante', '¿Tienes otro representante legal?', { media: true }),
        tieneConapina('is_apoderado', '¿Tienes apoderado legal?', { media: true })
      ] },
      { titulo: 'Segundo representante legal', subtitulo: 'Datos según su documento de identidad', si: 'isOtherRepresentante=si', campos: [
        ...personaConapina('representante2'),
        DOC_CONAPINA('doc_credencial_junta2', 'Credencial vigente del segundo representante legal')
      ] },
      { titulo: 'Apoderado legal', subtitulo: 'Datos según su documento de identidad', si: 'is_apoderado=si', campos: [
        ...personaConapina('apoderado'),
        DOC_CONAPINA('doc_poder', 'Poder o autorización'),
        tieneConapina('isOtherApoderado', '¿Tienes otro apoderado legal?')
      ] },
      { titulo: 'Segundo apoderado legal', subtitulo: 'Datos según su documento de identidad', si: 'isOtherApoderado=si', campos: [
        ...personaConapina('apoderado2'),
        PDF_CONAPINA('doc_poder2', 'Poder o autorización')
      ] },
      { titulo: 'Información del establecimiento', subtitulo: 'Dónde funcionará el CAPI', campos: [
        { tipo: 'texto', nombre: 'direccion_est', etiqueta: 'Dirección exacta', ayuda: 'Sin el departamento ni el municipio', max: 300 },
        { tipo: 'texto', nombre: 'punto_de_referencia_est', etiqueta: 'Punto de referencia', max: 150, opcional: true },
        { ...TELEFONO, nombre: 'telefono_fijo_est', etiqueta: 'Teléfono del establecimiento', placeholder: '2200-1234', media: true },
        { ...TELEFONO, nombre: 'telefono_movil_est', etiqueta: 'Teléfono alternativo', opcional: true, media: true },
        { tipo: 'texto', nombre: 'correo_est', etiqueta: 'Correo electrónico', modo: 'email', placeholder: 'capi@correo.com', media: true },
        { tipo: 'texto', nombre: 'confirme_correo_est', etiqueta: 'Confirmar correo', modo: 'email', igualA: 'correo_est', mensaje: 'Las direcciones de correo electrónico no coinciden', media: true },
        PDF_CONAPINA('doc_posesion_inmueble', 'Documento legal que demuestre la disponibilidad del inmueble')
      ] },
      { titulo: 'Información del trámite', subtitulo: 'Requisitos de cada institución', campos: [
        { tipo: 'seccion', titulo: 'Requisitos de CONAPINA' },
        { tipo: 'texto', nombre: 'nombre_sala_cuna_1_tra', etiqueta: 'Nombre del CAPI', ayuda: 'El que prefieres', max: 100 },
        { tipo: 'texto', nombre: 'nombre_sala_cuna_2_tra', etiqueta: 'Nombre alternativo 1', max: 100, si: 'tipoAutorizacion!=renovacion', media: true },
        { tipo: 'texto', nombre: 'nombre_sala_cuna_3_tra', etiqueta: 'Nombre alternativo 2', max: 100, si: 'tipoAutorizacion!=renovacion', media: true },
        tieneConapina('isReciboDeIngresoConapina', '¿Ya pagaste este año el arancel de $45.85 a CONAPINA?'),
        DOC_CONAPINA('doc_reciboIngresoConapina', 'Comprobante de pago del arancel', { si: 'isReciboDeIngresoConapina=si' }),
        { tipo: 'seccion', titulo: 'Instituto Crecer Juntos' },
        tieneConapina('is_permiso_ICJ_tra', '¿Tienes dictamen favorable del Instituto Crecer Juntos sobre los requerimientos generales para CAPI?'),
        PDF_CONAPINA('doc_resolucionICJ', 'Documentación favorable del Instituto Crecer Juntos', { si: 'is_permiso_ICJ_tra=si' }),
        PDF_CONAPINA('doc_descriptivoFuncionamiento', 'Documento descriptivo del funcionamiento del CAPI', { si: 'is_permiso_ICJ_tra=no', media: true }),
        PDF_CONAPINA('doc_nominaPersonal', 'Nómina del personal del CAPI', { si: 'is_permiso_ICJ_tra=no', media: true }),
        { tipo: 'seccion', titulo: 'MINSAL' },
        tieneConapina('is_permiso_minsal_tra', '¿Tienes permiso sanitario vigente del MINSAL para CAPI?'),
        { tipo: 'texto', nombre: 'cadud_minsal', etiqueta: 'Vencimiento del permiso sanitario', ...FECHA_FUTURA, si: 'is_permiso_minsal_tra=si', media: true },
        PDF_CONAPINA('doc_permiso_minsal_tra', 'Permiso sanitario vigente del MINSAL', { si: 'is_permiso_minsal_tra=si', media: true }),
        { tipo: 'seccion', titulo: 'Superintendencia de Regulación Sanitaria' },
        { tipo: 'opciones', nombre: 'is_permiso_alimentos_tra', etiqueta: '¿Tu centro dará servicio de alimentación?', columna: true, opciones: [
          { valor: 'con_certificacion', texto: 'Sí, y tengo la certificación para manipular alimentos', icono: 'ph-check-circle' },
          { valor: 'sin_certificacion', texto: 'Sí, pero no tengo la certificación', icono: 'ph-warning-circle' },
          { valor: 'no', texto: 'No daré servicio de alimentación', icono: 'ph-x-circle' }
        ] },
        { tipo: 'nota', estilo: 'aviso', si: 'is_permiso_alimentos_tra=sin_certificacion', lineas: ['Para un CAPI con alimentación necesitas el permiso de la Superintendencia de Regulación Sanitaria: Blv. Merliot y Av. Jayaque, edificio SRS, Jardines del Volcán, Santa Tecla'] },
        PDF_CONAPINA('doc_permiso_alimentos_tra', 'Permiso vigente para manipular alimentos', { si: 'is_permiso_alimentos_tra=con_certificacion' }),
        { tipo: 'seccion', titulo: 'Bomberos' },
        tieneConapina('is_permiso_bomberos_tra', '¿Tienes la certificación vigente de Bomberos para CAPI?'),
        { tipo: 'texto', nombre: 'areaConstruidaBomberos', etiqueta: 'Área construida del CAPI (m²)', modo: 'numeric', placeholder: '250', patron: '[0-9]+([.,][0-9]{1,2})?', mensaje: 'Escribe solo el número, por ejemplo 250', si: 'is_permiso_bomberos_tra=no' },
        { tipo: 'texto', nombre: 'caduc_bomberos', etiqueta: 'Vencimiento de la certificación', ...FECHA_FUTURA, si: 'is_permiso_bomberos_tra=si', media: true },
        PDF_CONAPINA('doc_permiso_bomberos_tra', 'Certificación vigente de Bomberos', { si: 'is_permiso_bomberos_tra=si', media: true }),
        { tipo: 'seccion', titulo: 'MINEDUCYT' },
        tieneConapina('is_acreditacion_mined_tra', '¿Tienes la acreditación de nivel educativo del MINEDUCYT para CAPI?'),
        PDF_CONAPINA('doc_acreditacion_de_mined_tra', 'Acreditación de nivel educativo del MINEDUCYT', { si: 'is_acreditacion_mined_tra=si' }),
        { tipo: 'opciones', nombre: 'salasDeAtencion', etiqueta: 'Salas que atenderá el CAPI', multiple: true, columna: true, opciones: [
          { valor: 'sala0', texto: 'Sala de lactantes', detalle: 'De 0 a 12 meses' },
          { valor: 'sala1', texto: 'Sala I', detalle: 'De 1 año hasta cumplir 2' },
          { valor: 'sala2', texto: 'Sala II', detalle: 'De 2 años hasta cumplir 3' },
          { valor: 'sala3', texto: 'Sala III', detalle: 'De 3 años hasta cumplir 4' },
          { valor: 'sala4', texto: 'Sala IV', detalle: 'De 4 años hasta cumplir 5' },
          { valor: 'sala5', texto: 'Sala V', detalle: 'De 5 años hasta cumplir 6' },
          { valor: 'sala6', texto: 'Sala VI', detalle: 'De 6 años hasta cumplir 7' }
        ] },
        { tipo: 'seccion', titulo: 'Director del CAPI' },
        ...personaConapina('director', { contacto: false }),
        { tipo: 'texto', nombre: 'nip_director_tra', etiqueta: 'Número de identificación profesional (NIP)', max: 20, media: true },
        DOC_CONAPINA('doc_nip_director_tra', 'Copia del NIP', { media: true }),
        { ...TELEFONO, nombre: 'telefono_movil_director_tra', etiqueta: 'Teléfono móvil del director' },
        DOC_CONAPINA('doc_plan_estrategico_tra', 'Protocolo de actuación ante situaciones que amenacen o vulneren los derechos de las niñas y niños')
      ] },
      { titulo: 'Facturación', subtitulo: 'Comprobantes de Bomberos y MINSAL', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Recibirás los comprobantes escaneados cuando se verifique el pago; si los necesitas en físico, pídelos en las oficinas de cada institución', 'CONAPINA no emite comprobantes: solo te avisa por correo que verificó tu pago'] },
        { tipo: 'opciones', nombre: 'necesita_factura', etiqueta: 'Comprobante que necesitas', opciones: [
          { valor: 'factura', texto: 'Factura de consumidor final', icono: 'ph-receipt' },
          { valor: 'ccf', texto: 'Comprobante de crédito fiscal', icono: 'ph-file-text' }
        ] },
        { tipo: 'texto', nombre: 'nrc', etiqueta: 'NRC', ...NRC_AAC, si: 'necesita_factura=ccf', media: true },
        archivo('doc_adjuntar_imagen_nrc', 'Imagen del NRC', { si: 'necesita_factura=ccf', media: true }),
        { tipo: 'opciones', nombre: 'aNombreDe', etiqueta: 'Comprobante a nombre de', compacto: true, si: NATURAL_C, opciones: [
          { valor: 'deUsuario', texto: 'Usuario simple.sv' }, { valor: 'deSolicitante', texto: 'Solicitante' }, { valor: 'deDirector', texto: 'Director' }
        ] },
        { tipo: 'opciones', nombre: 'aNombreDeJur', etiqueta: 'Comprobante a nombre de', columna: true, si: JURIDICA_C, opciones: [
          { valor: 'deUsuarioJur', texto: 'Usuario simple.sv', icono: 'ph-user' }, { valor: 'deSolicitanteJur', texto: 'Empresa', icono: 'ph-buildings' },
          { valor: 'deRepresentanteJur', texto: 'Representante legal', icono: 'ph-identification-card' }, { valor: 'deDirectorJur', texto: 'Director educativo', icono: 'ph-chalkboard-teacher' },
          { valor: 'deApoLegalJur', texto: 'Apoderado legal', icono: 'ph-scales' }, { valor: 'deRepresentanteJur2', texto: 'Representante legal 2', icono: 'ph-identification-card' },
          { valor: 'deApoLegalJur2', texto: 'Apoderado legal 2', icono: 'ph-scales' }
        ] },
        tieneConapina('mismaDireccionFact', '¿La dirección del comprobante es la del establecimiento?'),
        { tipo: 'lista', nombre: 'departamento_fact', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, si: 'mismaDireccionFact=no', media: true },
        { tipo: 'lista', nombre: 'municipio_fact', etiqueta: 'Municipio', depende: 'departamento_fact', opcionesPor: MUNICIPIOS, si: 'mismaDireccionFact=no', media: true },
        { tipo: 'texto', nombre: 'direccionComprobante', etiqueta: 'Dirección', max: 300, si: 'mismaDireccionFact=no' },
        tieneConapina('gran_contribuyente', '¿Eres gran contribuyente?', { si: 'necesita_factura=ccf' }),
        PDF_CONAPINA('doc_retencion_iva', 'Archivo de retención del 1 % de IVA', { si: 'gran_contribuyente=si' }),
        { tipo: 'opciones', nombre: 'exento_o_tasa_cero', etiqueta: '¿Estás exento del pago de IVA?', compacto: true, opciones: [
          { valor: 'exento_iva', texto: 'Exento de IVA' }, { valor: 'tasa_cero', texto: 'Tasa cero' }, { valor: 'no_soy_exento', texto: 'No soy exento' }
        ] },
        DOC_CONAPINA('doc_exento_iva', 'Resolución del Ministerio de Hacienda que avala la exención o la tasa cero', { ayuda: 'Por ambos lados. ' + FORMATOS_IMAGEN, si: 'exento_o_tasa_cero!=no_soy_exento' }),
        ...exencionConapina('bomberos', 'el Cuerpo de Bomberos', 'is_permiso_bomberos_tra=no'),
        ...exencionConapina('minsal', 'el Ministerio de Salud', 'is_permiso_minsal_tra=no'),
        ...exencionConapina('conapina', 'CONAPINA', 'isReciboDeIngresoConapina=si')
      ] },
      { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta la declaración', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Cero tolerancia a la corrupción', lineas: ['CONAPINA no hace cobros indebidos ni por agilizar trámites', 'Si te piden algún beneficio indebido, repórtalo al Canal Único Antisoborno (CUAS) al 2213-4779'] },
        { tipo: 'nota', estilo: 'info', lineas: ['Declaro bajo juramento que los datos de este formulario son fiel expresión de la verdad, asumo la responsabilidad correspondiente y acepto cualquier revisión de la información de parte de las instituciones del trámite'] },
        { tipo: 'opciones', nombre: 'check_acepta', etiqueta: '¿Estás de acuerdo con la declaración jurada?', marcado: true, opciones: [{ valor: 'acepto', texto: 'Sí, estoy de acuerdo', icono: 'ph-seal-check' }] }
      ] },
      ENVIAR
    ]
  };

  const COBERTURA_CONAPINA = c => 'coberturaTerritorial=' + c;
  F[84] = {
    titulo: 'Información general',
    subtitulo: 'Registro de proyectos de atención a la primera infancia, niñez y adolescencia',
    icono: 'ph-clipboard-text',
    campos: [
      { tipo: 'texto', nombre: 'nombreProyecto', etiqueta: 'Nombre del proyecto', max: 200 },
      { tipo: 'texto', nombre: 'nombreEntidad', etiqueta: 'Nombre de la entidad', max: 150 },
      { tipo: 'seccion', titulo: 'Duración del proyecto' },
      { tipo: 'texto', nombre: 'fechaInicio', etiqueta: 'Fecha de inicio', ...FECHA_FUTURA, media: true },
      { tipo: 'texto', nombre: 'fechaCierre', etiqueta: 'Fecha de cierre', ...FECHA_FUTURA, placeholder: 'DD-MM-AAAA', media: true },
      { tipo: 'seccion', titulo: 'Financiamiento' },
      { tipo: 'texto', nombre: 'costoTotalProyecto', etiqueta: 'Costo total del proyecto (dólares)', ...MONTO_AAC, media: true },
      { tipo: 'texto', nombre: 'inversionNNA', etiqueta: 'Inversión en niñez y adolescencia (dólares)', ...MONTO_AAC, media: true },
      { tipo: 'opciones', nombre: 'tipoFuentesFinanciamiento', etiqueta: 'Fuentes de financiamiento', compacto: true, opciones: [
        { valor: 'fuentesNacionales', texto: 'Nacionales' }, { valor: 'fuentesInternacionales', texto: 'Internacionales' }, { valor: 'fuentesAmbas', texto: 'Ambas' }
      ] },
      { tipo: 'texto', nombre: 'fuentes_nacionales', etiqueta: 'Fuentes nacionales', ayuda: 'Si son varias, sepáralas por coma', max: 300, si: 'tipoFuentesFinanciamiento!=fuentesInternacionales' },
      { tipo: 'texto', nombre: 'fuentes_internacionales', etiqueta: 'Fuentes internacionales', ayuda: 'Si son varias, sepáralas por coma', max: 300, si: 'tipoFuentesFinanciamiento!=fuentesNacionales' }
    ],
    pasos: [
      { titulo: 'Contacto del proyecto', subtitulo: 'Confirma tus datos', campos: [
        tieneConapina('esRepresentante', '¿Eres el representante legal de la entidad?'),
        PDF_CONAPINA('docAutorizacion', 'Documento que te autoriza para registrar el proyecto', { si: 'esRepresentante=no' }),
        ...CONTACTO_ID_CONAPINA
      ] },
      { titulo: 'Población participante', subtitulo: 'Cuéntanos a quién va dirigido', campos: [
        { tipo: 'texto', nombre: 'poblacion_directa', etiqueta: 'Población directa', ayuda: 'Las personas a las que va dirigido, por ejemplo niñas, niños, adolescentes o mujeres embarazadas. Sepáralas por coma', max: 300 },
        { tipo: 'texto', nombre: 'poblacion_indirecta', etiqueta: 'Población indirecta', ayuda: 'Las que se benefician sin participar directamente, por ejemplo el grupo familiar, el centro escolar o la comunidad', max: 300 },
        { tipo: 'texto', nombre: 'requisitos_ingreso', etiqueta: 'Requisitos de ingreso', ayuda: 'Si son varios, sepáralos por coma', max: 300 }
      ] },
      { titulo: 'Contenido técnico', subtitulo: 'Objetivos, normativa y cobertura', campos: [
        { tipo: 'texto', nombre: 'objetivosGenerales', etiqueta: 'Objetivo general', max: 1000 },
        { tipo: 'texto', nombre: 'objetivos_especificos', etiqueta: 'Objetivos específicos', ayuda: 'Si son varios, sepáralos por punto y coma', max: 1000 },
        PDF_CONAPINA('doc_actividadesAtencion', 'Documento con las actividades o acciones de atención'),
        { tipo: 'texto', nombre: 'marco_normativo', etiqueta: 'Marco normativo', ayuda: 'Leyes y normativa nacional e internacional a la que responde el proyecto, separadas por coma', max: 500 },
        { tipo: 'opciones', nombre: 'coberturaTerritorial', etiqueta: 'Cobertura territorial', compacto: true, opciones: [
          { valor: 'nacional', texto: 'Nacional' }, { valor: 'regional', texto: 'Regional' }, { valor: 'departamental', texto: 'Departamental' },
          { valor: 'municipal', texto: 'Municipal' }, { valor: 'local', texto: 'Local' }
        ] },
        { tipo: 'texto', nombre: 'municipios_regionales', etiqueta: 'Municipios participantes', ayuda: 'Departamento y municipio de cada uno, separados por punto y coma', max: 500, si: COBERTURA_CONAPINA('regional') },
        { tipo: 'lista', nombre: 'coberturaDepartamental', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, si: COBERTURA_CONAPINA('departamental') },
        { tipo: 'lista', nombre: 'departamento_cobertura', etiqueta: 'Departamento', opciones: DEPARTAMENTOS, si: COBERTURA_CONAPINA('municipal|local'), media: true },
        { tipo: 'lista', nombre: 'municipio_cobertura', etiqueta: 'Municipio', depende: 'departamento_cobertura', opcionesPor: MUNICIPIOS, si: COBERTURA_CONAPINA('municipal|local'), media: true },
        { tipo: 'texto', nombre: 'coberturaLocal', etiqueta: 'Localidades que incluye', max: 300, si: COBERTURA_CONAPINA('local') },
        PDF_CONAPINA('doc_convenios', 'Convenios para ejecutar el proyecto', { opcional: true })
      ] },
      ENVIAR
    ]
  };

  /* ===== ISSS: constancia de no inscrito y solvencia patronal ===== */
  // ISSS (isss.ventanilla.simple.sv, trámites 39 y 22): el documento del patrono y, en el segundo paso (el último), lo que el
  // ISSS encontró con ese documento; su Siguiente genera la constancia o la solvencia. Gratis, en unos 5 minutos
  const DOCUMENTO_PATRONO = { placeholder: '00000000-0', max: 17, patron: '[0-9]{8}-?[0-9]|[0-9]{4}-?[0-9]{6}-?[0-9]{3}-?[0-9]', mensaje: 'Escribe el DUI (00000000-0) o el NIT (0000-000000-000-0)' };
  const ENVIAR_ISSS = documento => ({ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: [`El ISSS verifica los datos del patrono y genera tu ${documento} en unos 5 minutos`] }, ...ENVIAR.campos] });
  F[91] = {
    titulo: 'Ingreso de información',
    subtitulo: 'Cuéntanos de quién es la constancia',
    campos: [
      { tipo: 'nota', estilo: 'info', lineas: ['Ten a la mano los documentos que piden los requisitos del trámite'] },
      { tipo: 'opciones', nombre: 'tipo_persona', etiqueta: 'Tipo de persona para la constancia', opciones: PERSONA() },
      { tipo: 'texto', nombre: 'nit_de_patrono_o_empresa', etiqueta: 'NIT del patrono o empresa', ...NIT_AAC, si: JURIDICA },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI del patrono', ...FORMATO_DUI, si: NATURAL },
      { tipo: 'texto', nombre: 'presentadoa', etiqueta: 'Presentado a', ayuda: 'La institución o empresa donde presentarás la constancia', max: 100 }
    ],
    pasos: [ENVIAR_ISSS('constancia de no inscripción patronal')]
  };
  F[92] = {
    titulo: 'Solicitud de solvencia patronal',
    subtitulo: 'Cuéntanos de quién es la solvencia',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona para la solvencia', opciones: [
        { valor: '1', texto: 'Persona natural', icono: 'ph-user' }, { valor: '2', texto: 'Persona jurídica', icono: 'ph-buildings' }
      ] },
      { tipo: 'texto', nombre: 'nit_de_patrono_o_empresa', etiqueta: 'Documento del patrono o empresa', ayuda: 'DUI o NIT', ...DOCUMENTO_PATRONO },
      { tipo: 'texto', nombre: 'nit_del_representante_legal', etiqueta: 'DUI del representante legal', ...FORMATO_DUI, si: 'tipo_de_persona=2' }
    ],
    pasos: [ENVIAR_ISSS('solvencia patronal')]
  };

  /* ===== PGR: fijación de cuota alimenticia ===== */
  // PGR (pgr.ventanilla.simple.sv, trámite 386): dónde vive la persona convocada y los datos de quien solicita; la cuota y
  // los beneficiarios (hasta 5, cada uno en su paso); los motivos y las personas convocadas (hasta 5); y la declaración
  // jurada, el último paso. Con DUI, el portal trae del RNPN el nombre del convocado; con otro documento se escribe
  const PAISES_PGR = ['Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita', 'Argelia', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice', 'Benín', 'Bielorrusia', 'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China', 'Chipre', 'Ciudad del Vaticano', 'Colombia', 'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada', 'Grecia', 'Guatemala', 'Guyana', 'Guinea', 'Guinea ecuatorial', 'Guinea-Bisáu', 'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall', 'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí', 'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Centroafricana', 'República Checa', 'República del Congo', 'República Democrática del Congo', 'República Dominicana', 'Ruanda', 'Rumanía', 'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Suazilandia', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía', 'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue'];
  const CONSULADOS_PGR = ['Acayucan, México', 'Asunción, Paraguay', 'Aurora, Colorado, Estados Unidos', 'Barcelona, España', 'Belmopán, Belice', 'Berlín, Alemania', 'Bogotá, Colombia', 'Boston, Massachussets, Estados Unidos', 'Brasilia, Brasil', 'Bruselas, Bélgica', 'Buenos Aires, Argentina', 'Calgary, Canadá', 'Charlotte, Carolina del Norte, Estados Unidos', 'Chicago, Illinois, Estados Unidos', 'Ciudad de Guatemala, Guatemala', 'Ciudad de México, México', 'Ciudad Juárez, México', 'Dallas, Texas, Estados Unidos', 'Doha, Qatar', 'Doral, Florida, Estados Unidos', 'Duluth, Georgia, Estados Unidos', 'El Paso, Texas, Estados Unidos', 'Elizabeth, Nueva Jersey, Estados Unidos', 'Estocolmo, Suecia', 'Fresno, California, Estados Unidos', 'Ginebra, Suiza', 'Guadalajara, México', 'Houston, Texas, Estados Unidos', 'La Haya, Países Bajos', 'La Paz, Bolivia', 'Laredo, Texas, Estados Unidos', 'Las Vegas, Nevada, Estados Unidos', 'Lima, Perú', 'Lisboa, Portugal', 'Londres, Reino Unido', 'Long Island, Nueva York, Estados Unidos', 'Los Ángeles, California, Estados Unidos', 'Madrid, España', 'Managua, Nicaragua', 'Manhattan, Nueva York, Estados Unidos', 'McAllen, Texas, Estados Unidos', 'Melbourne, Australia', 'Milán, Italia', 'Monterrey, México', 'Montreal, Canadá', 'Nashville, Tennessee, Estados Unidos', 'Oaxaca, México', 'Omaha, Nebraska, Estados Unidos', 'Ottawa, Canadá', 'Panamá, Panamá', 'París, Francia', 'Quito, Ecuador', 'Roma, Italia', 'Saint Paul, Minnesota, Estados Unidos', 'Salt Lake City, Utah, Estados Unidos', 'San Bernardino, California, Estados Unidos', 'San Francisco, California, Estados Unidos', 'San José, Costa Rica', 'San Luis Potosí, México', 'Santiago de Chile, Chile', 'Santo Domingo, República Dominicana', 'Seattle, Washington, Estados Unidos', 'Sevilla, España', 'Silver Spring, Maryland, Estados Unidos', 'Springdale, Arkansas, Estados Unidos', 'Tapachula, México', 'Tegucigalpa, Honduras', 'Tijuana, México', 'Toronto, Canadá', 'Tucson, Arizona, Estados Unidos', 'Vancouver, Canadá', 'Viena, Austria', 'Villahermosa, México', 'Woodbridge, Virginia, Estados Unidos'];
  const PROCURADURIAS_PGR = [['PA03', 'Ahuachapán'], ['PA15', 'Apopa'], ['PA04', 'Chalatenango'], ['PA09', 'Cojutepeque'], ['PA13', 'La Libertad'], ['PA08', 'La Unión'], ['PA16', 'Metapán'], ['PA19', 'Puerto de La Libertad'], ['PA01', 'Santa Ana'], ['PA12', 'San Francisco Gotera'], ['PA07', 'San Miguel'], ['PA18', 'San Salvador'], ['PA10', 'San Vicente'], ['PA11', 'Sensuntepeque'], ['PA02', 'Sonsonate'], ['PA14', 'Soyapango'], ['PA06', 'Usulután'], ['PA05', 'Zacatecoluca']];
  const EN_EL_PAIS_PGR = 'is_extranjero=ie_0';
  const EN_EL_EXTRANJERO_PGR = 'is_extranjero=ie_1';
  const DOCUMENTOS_PGR = [['dui', 'DUI'], ['pasaporte', 'Pasaporte'], ['carnet_residente', 'Carnet de residente'], ['carnet_minoridad', 'Carnet de minoridad'],
    ['dpi', 'DPI (Guatemala)'], ['dni', 'DNI (Honduras)'], ['cedula', 'Cédula de identidad (Nicaragua)']];
  const TELEFONO_PGR = { modo: 'tel', placeholder: '7000-1234', max: 20, patron: '\\+?[0-9][0-9 -]{6,18}', mensaje: 'Escribe el teléfono; si es del extranjero, con su código de país, por ejemplo +1 213 555 0100' };
  const SOLO_NUMEROS = { modo: 'numeric', max: 10, patron: '[0-9]+', mensaje: 'Escribe solo números' };
  // Del segundo en adelante, cada beneficiario o convocado se pide si la persona dijo que son al menos esa cantidad
  const desdeElPgr = (campo, prefijo, n) => `${campo}=` + [2, 3, 4, 5].filter(k => k >= n).map(k => prefijo + k).join('|');
  const CUANTOS_PGR = prefijo => [1, 2, 3, 4, 5].map(n => ({ valor: prefijo + n, texto: String(n) }));
  const SEXO_PGR = (s, si) => ({ tipo: 'opciones', nombre: 'sexo_' + s, etiqueta: 'Sexo', ...(si ? { si } : {}), opciones: [
    { valor: 'mujer', texto: 'Mujer', icono: 'ph-gender-female' }, { valor: 'hombre', texto: 'Hombre', icono: 'ph-gender-male' }
  ] });
  const beneficiarioPgr = n => {
    const s = 'ben' + n;
    const partida = `tipo_documento_${s}=partida`;
    return { titulo: `Datos del beneficiario ${n}`, subtitulo: 'La persona que recibirá la cuota', si: n === 1 ? 'is_beneficiario=no' : desdeElPgr('num_beneficiarios', 'nb_', n), campos: [
      ...nombrePorPartes(s + '_', { obligatorio: true, casada: true }),
      SEXO_PGR(s),
      { tipo: 'texto', nombre: 'fecnab_' + s, etiqueta: 'Fecha de nacimiento', ...FECHA_DMA },
      { tipo: 'lista', nombre: 'tipo_documento_' + s, etiqueta: 'Tipo de documento de identidad o identificación', opciones: [...DOCUMENTOS_PGR, ['partida', 'Partida de nacimiento']] },
      { tipo: 'texto', nombre: 'num_doc_' + s, etiqueta: 'Número de documento', max: 20, si: `tipo_documento_${s}!=partida` },
      { tipo: 'texto', nombre: 'partida1_' + s, etiqueta: 'Número de folio', ...SOLO_NUMEROS, tercio: true, si: partida },
      { tipo: 'texto', nombre: 'partida2_' + s, etiqueta: 'Número de libro', ...SOLO_NUMEROS, tercio: true, si: partida },
      { tipo: 'texto', nombre: 'partida3_' + s, etiqueta: 'Número de correlativo', ...SOLO_NUMEROS, tercio: true, si: partida },
      archivo('doc_identificacion_' + s, 'Documento de identificación', { ayuda: 'Si es menor de edad, su partida de nacimiento. ' + FORMATOS_IMAGEN }),
      { tipo: 'lista', nombre: 'afiliacion_' + s, etiqueta: 'Relación con el solicitante', opciones: [
        ['hermano', 'Hermana/o'], ['hijo', 'Hija/o'], ['madre', 'Madre'], ['nieto', 'Nieta/o'], ['padre', 'Padre'], ['sobrino', 'Sobrina/o'], ['otro', 'Otro']
      ] }
    ] };
  };
  const convocadoPgr = n => {
    const s = 'con' + n;
    const tipo = 'tipo_documento_' + s;
    const laboral = `conoce_laboral_${s}=si`;
    const contacto = 'direccion_telefono_' + s;
    const correo = `conoce_correo_${s}=si`;
    return { titulo: `Datos del convocado ${n}`, subtitulo: 'La persona a la que solicitas la cuota', ...(n > 1 ? { si: desdeElPgr('num_convocados', 'nc_', n) } : {}), campos: [
      { tipo: 'lista', nombre: tipo, etiqueta: 'Tipo de documento de identificación', opciones: [...DOCUMENTOS_PGR, ['se_desconoce', 'Se desconoce']] },
      { tipo: 'texto', nombre: 'num_doc_' + s, etiqueta: 'Número de documento', max: 20, si: tipo + '!=se_desconoce' },
      { tipo: 'nota', estilo: 'info', lineas: ['Con el DUI, la PGR obtiene su nombre del Registro Nacional de las Personas Naturales'], si: tipo + '=dui' },
      ...nombrePorPartes(s + '_', { obligatorio: true, casada: true, si: tipo + '!=dui' }),
      SEXO_PGR(s),
      archivo('doc_identificacion_' + s, 'Documento de identificación', { ...SOLO_PDF, opcional: true, si: tipo + '!=se_desconoce' }),
      { tipo: 'seccion', titulo: 'Información laboral' },
      { tipo: 'opciones', nombre: 'conoce_laboral_' + s, etiqueta: '¿Conoces la información laboral del convocado?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'lugar_trabajo_' + s, etiqueta: 'Lugar de trabajo', max: 150, si: laboral },
      { tipo: 'lista', nombre: 'departamento_trabajo_' + s, etiqueta: 'Departamento de trabajo', opciones: DEPARTAMENTOS, opcional: true, media: true, si: laboral },
      { tipo: 'lista', nombre: 'municipio_trabajo_' + s, etiqueta: 'Municipio de trabajo', depende: 'departamento_trabajo_' + s, opcionesPor: MUNICIPIOS, opcional: true, media: true, si: laboral },
      { tipo: 'texto', nombre: 'direccion_trabajo_' + s, etiqueta: 'Dirección del lugar de trabajo', max: 300, opcional: true, si: laboral },
      { tipo: 'texto', nombre: 'ingresos_' + s, etiqueta: 'Ingresos salariales aproximados (en dólares)', ...MONTO_AAC, placeholder: '600.00', mensaje: 'Escribe solo el monto en números, por ejemplo 600.00', opcional: true, si: laboral },
      { tipo: 'opciones', nombre: 'inmuebles_' + s, etiqueta: '¿Posee bienes inmuebles?', multiple: true, opcional: true, opciones: [
        { valor: 'propiedades', texto: 'Propiedades', icono: 'ph-house' }, { valor: 'vehiculos', texto: 'Vehículos', icono: 'ph-car-profile' }
      ] },
      { tipo: 'seccion', titulo: 'Información de contacto' },
      { tipo: 'lista', nombre: 'departamento_' + s, etiqueta: 'Departamento de residencia', opciones: DEPARTAMENTOS, media: true, si: EN_EL_PAIS_PGR },
      { tipo: 'lista', nombre: 'municipio_' + s, etiqueta: 'Municipio de residencia', depende: 'departamento_' + s, opcionesPor: MUNICIPIOS, media: true, si: EN_EL_PAIS_PGR },
      { tipo: 'opciones', nombre: contacto, etiqueta: '¿Conoces su dirección de residencia o su teléfono?', opciones: [
        { valor: 'direccion', texto: 'Dirección', icono: 'ph-map-pin' }, { valor: 'telefono', texto: 'Teléfono', icono: 'ph-phone' }, { valor: 'ambas', texto: 'Ambas', icono: 'ph-check' }
      ] },
      { tipo: 'texto', nombre: 'direccion_' + s, etiqueta: 'Dirección de residencia', max: 300, si: contacto + '!=telefono' },
      { tipo: 'texto', nombre: 'telefono_' + s, etiqueta: 'Teléfono de contacto', ...TELEFONO_PGR, si: contacto + '!=direccion' },
      { tipo: 'opciones', nombre: 'conoce_correo_' + s, etiqueta: '¿Conoces su correo electrónico?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'correo_' + s, etiqueta: 'Correo electrónico', modo: 'email', media: true, si: correo },
      { tipo: 'texto', nombre: 'confirmar_correo_' + s, etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_' + s, mensaje: 'Los correos no coinciden', media: true, si: correo }
    ] };
  };
  F[93] = {
    titulo: 'Registro de información',
    subtitulo: 'Dónde harás el trámite y tus datos',
    campos: [
      { tipo: 'opciones', nombre: 'is_usuario', etiqueta: '¿Haces la solicitud personalmente o ayudas a alguien a quien se le dificulta llenarla?', opciones: [
        { valor: 'iu_1', texto: 'Personalmente', detalle: 'La solicitud es mía', icono: 'ph-user' },
        { valor: 'iu_0', texto: 'Ayudo a alguien', detalle: 'No tiene cuenta o se le dificulta', icono: 'ph-hand-heart' }
      ] },
      { tipo: 'opciones', nombre: 'is_extranjero', etiqueta: '¿La persona convocada está en El Salvador o en el extranjero?', opciones: [
        { valor: 'ie_0', texto: 'El Salvador', icono: 'ph-map-pin' }, { valor: 'ie_1', texto: 'Extranjero', icono: 'ph-globe-hemisphere-west' }
      ] },
      { tipo: 'lista', nombre: 'listado_paises', etiqueta: 'País donde vive la persona convocada', opciones: PAISES_PGR.map(p => [{ Dominica: 'DOMINICANA', Níger: 'NIGER' }[p] || p.toUpperCase().replace(/ /g, '_'), p]), media: true, si: EN_EL_EXTRANJERO_PGR },
      { tipo: 'lista', nombre: 'consulado2', etiqueta: 'Representación diplomática o consular', ayuda: 'La del lugar donde vive la persona convocada', opciones: CONSULADOS_PGR.map((c, i) => ['ext_' + (i + 1), c]), media: true, si: EN_EL_EXTRANJERO_PGR },
      { tipo: 'lista', nombre: 'pad', etiqueta: 'Procuraduría Auxiliar donde harás el trámite', ayuda: 'Una vez iniciado el proceso no podrás cambiar de sede', opciones: PROCURADURIAS_PGR, si: EN_EL_PAIS_PGR },
      { tipo: 'seccion', titulo: 'Tus datos', si: 'is_usuario=iu_1' },
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true, si: 'is_usuario=iu_1' },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', soloLectura: true, media: true, si: 'is_usuario=iu_1' },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico de notificación', modo: 'email', soloLectura: true, media: true, si: 'is_usuario=iu_1' },
      { tipo: 'seccion', titulo: 'Datos de la persona que ayudas', si: PARA_TERCERO_PGR },
      ...nombrePorPartes('sol_', { obligatorio: true, casada: true, si: PARA_TERCERO_PGR }),
      SEXO_PGR('sol', PARA_TERCERO_PGR),
      { tipo: 'texto', nombre: 'fecnac_sol', etiqueta: 'Fecha de nacimiento', ...FECHA_DMA, si: PARA_TERCERO_PGR },
      { tipo: 'lista', nombre: 'tipo_documento_sol', etiqueta: 'Tipo de documento de identificación', opciones: DOCUMENTOS_PGR, media: true, si: PARA_TERCERO_PGR },
      { tipo: 'texto', nombre: 'num_doc_sol', etiqueta: 'Número de documento', max: 20, media: true, si: PARA_TERCERO_PGR },
      archivo('doc_identificacion_sol', 'Documento de identificación', { ...SOLO_PDF, si: PARA_TERCERO_PGR }),
      { tipo: 'texto', nombre: 'email_sol', etiqueta: 'Correo electrónico de notificación', modo: 'email', media: true, si: PARA_TERCERO_PGR },
      { tipo: 'texto', nombre: 'confirmar_email_sol', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'email_sol', mensaje: 'Los correos no coinciden', media: true, si: PARA_TERCERO_PGR },
      { tipo: 'seccion', titulo: 'Residencia y contacto' },
      { tipo: 'lista', nombre: 'departamento_sol', etiqueta: 'Departamento de residencia', opciones: DEPARTAMENTOS, media: true },
      { tipo: 'lista', nombre: 'municipio_sol', etiqueta: 'Municipio de residencia', depende: 'departamento_sol', opcionesPor: MUNICIPIOS, media: true },
      { tipo: 'texto', nombre: 'direccion_sol', etiqueta: 'Dirección exacta de residencia', ayuda: 'Con puntos de referencia, por ejemplo casa color verde con baranda y portón negro, frente a la tienda Juanita', max: 300 },
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono para notificaciones' },
      { tipo: 'opciones', nombre: 'num_wp', etiqueta: '¿Tienes cuenta de WhatsApp?', opciones: WHATSAPP_ENA }
    ],
    pasos: [
      { titulo: 'Cuota alimenticia', subtitulo: 'Cuánto solicitas y para cuántas personas', campos: [
        { tipo: 'texto', nombre: 'cuota_pretendida', etiqueta: 'Cuota mensual que solicitas (en dólares)', ...MONTO_AAC, placeholder: '150.00', mensaje: 'Escribe solo el monto en números, por ejemplo 150.00' },
        { tipo: 'nota', estilo: 'info', lineas: ['La cuota es en beneficio de una o varias personas que tienen derecho a recibir alimentos, salvo cuando la solicitas a tu favor'] },
        { tipo: 'opciones', nombre: 'num_beneficiarios', etiqueta: '¿A favor de cuántas personas solicitas la cuota alimenticia?', ayuda: 'Si son más de 5, inicia otro trámite para las demás', compacto: true, opciones: CUANTOS_PGR('nb_') },
        { tipo: 'opciones', nombre: 'is_beneficiario', etiqueta: '¿La persona solicitante es uno de los beneficiarios?', opciones: SI_NO }
      ] },
      ...[1, 2, 3, 4, 5].map(beneficiarioPgr),
      { titulo: 'Motivos y personas convocadas', subtitulo: 'Cuéntanos por qué solicitas la cuota', campos: [
        { tipo: 'texto', nombre: 'relato', etiqueta: 'Motivos por los que solicitas la cuota alimenticia', ayuda: 'Nárralos brevemente', max: 1000 },
        { tipo: 'opciones', nombre: 'num_convocados', etiqueta: '¿A cuántas personas convocarás y solicitarás cuota alimenticia?', ayuda: 'Si son más de 5, inicia otro trámite para las demás', compacto: true, opciones: CUANTOS_PGR('nc_') }
      ] },
      ...[1, 2, 3, 4, 5].map(convocadoPgr),
      { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta la declaración', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: ['Declaras bajo juramento que los datos ingresados en el formulario son expresión fiel de la verdad, por lo cual asumes la responsabilidad correspondiente y aceptas cualquier revisión de la información proporcionada'] },
        { tipo: 'opciones', nombre: 'i_agreed', etiqueta: '¿Estás de acuerdo con la declaración jurada?', marcado: true, opciones: [{ valor: 'ia_1', texto: 'Sí, estoy de acuerdo', icono: 'ph-seal-check' }] }
      ] },
      ENVIAR
    ]
  };

  /* ===== Imprenta Nacional: Diario Oficial ===== */
  // Imprenta Nacional (imprentanacional.ventanilla.simple.sv, trámites 334 y 65): quién solicita (a título personal, con los
  // datos de la cuenta, o para un tercero) y si es exento de pago; los datos de la constancia o de la publicación; y la
  // declaración jurada, el último paso. La constancia cuesta $3.25; la publicación depende de las tarifas del Diario Oficial
  const PARA_MI_DIN = 'destinatario=para_mi';
  const PARA_TERCERO_DIN = 'destinatario=para_tercero';
  const EXENTO_DIN = 'exencion_de_pago=si';
  const solicitanteDin = ({ nit, notaOpcional }) => [
    { tipo: 'opciones', nombre: 'destinatario', etiqueta: 'Estás solicitando el trámite', opciones: [
      { valor: 'para_mi', texto: 'A título personal', icono: 'ph-user' }, { valor: 'para_tercero', texto: 'Para un tercero', icono: 'ph-users' }
    ] },
    { tipo: 'texto', nombre: 'nombres', etiqueta: 'Nombres', soloLectura: true, media: true, si: PARA_MI_DIN },
    { tipo: 'texto', nombre: 'apellidos', etiqueta: 'Apellidos', soloLectura: true, media: true, si: PARA_MI_DIN },
    { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI', soloLectura: true, media: true, si: PARA_MI_DIN },
    { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', soloLectura: true, media: true, si: PARA_MI_DIN },
    { ...TELEFONO, nombre: 'n_telefono', etiqueta: 'Teléfono de contacto', media: true, si: PARA_MI_DIN },
    { ...TELEFONO, nombre: 'telefono', etiqueta: 'Celular de contacto', media: true, si: PARA_MI_DIN },
    { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: PERSONA(), si: PARA_TERCERO_DIN },
    { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Tipo de documento', si: PARA_TERCERO_DIN, opciones: [
      { valor: 'dui', texto: 'DUI', icono: 'ph-identification-card' }, { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-identification-badge' },
      { valor: 'carnet_de_residente', texto: 'Carnet de residente', icono: 'ph-identification-badge' }
    ] },
    { tipo: 'texto', nombre: 'dui', etiqueta: 'DUI', ...FORMATO_DUI, si: 'tipo_de_documento=dui' },
    { tipo: 'texto', nombre: 'numero_documento_tercero', etiqueta: 'Número de documento', max: 20, si: 'tipo_de_documento!=dui' },
    ...(nit ? [{ tipo: 'texto', nombre: 'nit', etiqueta: 'NIT', ...NIT_AAC, si: 'tipo_de_persona=persona_juridica' }] : []),
    { tipo: 'opciones', nombre: 'exencion_de_pago', etiqueta: '¿Tienes exención de pago?', opciones: SI_NO },
    archivo('nota_de_oficio', 'Nota de oficio', { ayuda: 'El documento que demuestra la exención de pago por publicaciones. Formato PDF, hasta 15 MB', acepta: '.pdf', opcional: notaOpcional, si: EXENTO_DIN })
  ];
  const DECLARACION_DIN = (nombre, texto) => ({ titulo: 'Declaración jurada', subtitulo: 'Lee y acepta la declaración', campos: [
    { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: ['Das fe y declaras bajo juramento la veracidad de la información del formulario y de los documentos anexos, cumpliendo con los requisitos de ley exigidos, por lo que asumes la responsabilidad administrativa, civil o penal que se derive de la falsedad de la información. Aceptas que se publique lo solicitado igual al original y recibir notificaciones por medios electrónicos'] },
    { tipo: 'opciones', nombre, etiqueta: '¿Estás de acuerdo con la declaración jurada?', marcado: true, opciones: [{ valor: 'si', texto, icono: 'ph-seal-check' }] }
  ] });
  F[97] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Cuéntanos quién solicita la constancia',
    campos: solicitanteDin({ nit: true, notaOpcional: true }),
    pasos: [
      { titulo: 'Datos de la constancia', subtitulo: 'Cuéntanos qué publicación necesitas', campos: [
        { tipo: 'opciones', nombre: 'tipo_de_constancia', etiqueta: 'Tipo de constancia', columna: true, opciones: [
          { valor: 'constancia_de_publicacion', texto: 'Constancia de publicación', detalle: 'Indica el Diario Oficial en el que saldrá publicado el documento, acuerdo, decreto o resolución. Se emite mientras ese Diario no circula', icono: 'ph-newspaper' },
          { valor: 'constancia_de_circulacion', texto: 'Constancia de circulación', detalle: 'Cita la fecha en que salió a circulación el Diario Oficial solicitado', icono: 'ph-calendar-check' }
        ] },
        { tipo: 'texto', nombre: 'nombre_del_tramite', etiqueta: 'Nombre del trámite presentado para publicación', max: 200 },
        { tipo: 'texto', nombre: 'solicitante_de_la_constancia', etiqueta: 'Nombre del solicitante de la constancia', ayuda: 'A nombre de quien necesita la constancia', max: 150 },
        { tipo: 'texto', nombre: 'fecha_de_publicacion', etiqueta: 'Fecha de publicación del documento', ...FECHA_DMA, media: true },
        { tipo: 'texto', nombre: 'numero_de_factura', etiqueta: 'Número de factura', ayuda: 'Si tú hiciste la publicación', max: 30, opcional: true, media: true },
        { tipo: 'texto', nombre: 'nombr_del_titular', etiqueta: 'Titular del documento', max: 150, opcional: true },
        { tipo: 'texto', nombre: 'numero_de_decreto', etiqueta: 'Número de decreto, acuerdo o resolución', max: 30, opcional: true, media: true },
        { tipo: 'texto', nombre: 'entidad_emisora', etiqueta: 'Entidad que lo emitió', max: 150, opcional: true, media: true }
      ] },
      DECLARACION_DIN('si_estoy_de_acuerdo', 'Sí, estoy de acuerdo'),
      { ...ENVIAR, si: EXENTO_DIN },
      { ...REVISION, si: 'exencion_de_pago=no' },
      { ...PAGO, si: 'exencion_de_pago=no', monto: '$3.25' }
    ]
  };
  F[98] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Cuéntanos quién solicita la publicación',
    campos: solicitanteDin({ nit: false, notaOpcional: false }),
    pasos: [
      { titulo: 'Datos de la publicación', subtitulo: 'Adjunta el documento que se publicará', campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['La publicación debe ser congruente con lo que exige la ley: todo lo que está en el Diario Oficial es de uso legal cuando está debidamente certificado'] },
        { tipo: 'texto', nombre: 'nombre_documento', etiqueta: 'Nombre del documento', max: 200 },
        { tipo: 'texto', nombre: 'descripcion_del_documento', etiqueta: 'Descripción del documento', ayuda: 'Una pequeña reseña del documento que deseas publicar', max: 500 },
        archivo('adjuntar_documento', 'Documento a publicar', { ayuda: 'Formato PDF, hasta 15 MB', acepta: '.pdf' }),
        archivo('archivo_en_texto', 'Documento en archivo de texto', { ayuda: 'Te da un descuento del 5 %. Formatos DOC y DOCX, hasta 15 MB', acepta: '.doc,.docx', opcional: true })
      ] },
      DECLARACION_DIN('pp', 'Estoy de acuerdo'),
      { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', si: 'exencion_de_pago=no', lineas: ['El costo depende de las tarifas del Diario Oficial: la Imprenta Nacional te avisa el monto cuando revise tu documento'] }, ...ENVIAR.campos] }
    ]
  };

  /* ===== FOSOFAMILIA: solicitud de crédito ===== */
  // FOSOFAMILIA (fosofamilia.ventanilla.simple.sv, trámite 359): la pre solicitud en dos pasos (el segundo es el último): los
  // datos generales del cliente y los del negocio y del crédito. La geolocalización de la vivienda y del negocio es opcional
  // en el portal (un mapa); aquí no se pide
  const SECTORES_FOSOFAMILIA = ['Agricultura y Agroindustria', 'Automotriz', 'Banca y Finanzas', 'Bienes Raíces', 'Construcción', 'Consultoría y Asesoría', 'Educación', 'Energía', 'Entretenimiento y Medios', 'Farmacéutico y Salud', 'Gobierno y Sector Público', 'Hotelería y Turismo', 'Industria Alimentaria', 'Industria Forestal', 'Industria Manufacturera', 'Informática y Tecnología', 'Logística y Transporte', 'Minería', 'Moda y Textil', 'Publicidad y Marketing', 'Retail y Comercio', 'Seguros', 'Servicios de Alimentación y Bebidas', 'Servicios de Consultoría Legal', 'Servicios de Ingeniería', 'Servicios de Telecomunicaciones', 'Servicios Profesionales', 'Telecomunicaciones', 'Trabajo Social y Organizaciones sin Fines de Lucro', 'Venta al por Mayor y al por Menor', 'Arquitectura y Diseño', 'Arte y Entretenimiento', 'Asistencia Sanitaria y Cuidado Personal', 'Biotecnología y Ciencias de la Vida', 'Ciencia y Tecnología', 'Comercio Electrónico', 'Comunicaciones', 'Consultoría Ambiental', 'Consultoría de Recursos Humanos', 'Desarrollo de Software y Tecnología de la Información', 'Distribución y Logística', 'Educación a Distancia y eLearning', 'Energías Renovables', 'Estilo de Vida y Bienestar', 'Exportación e Importación', 'Fabricación de Maquinaria y Equipo Industrial', 'Gestión de Residuos y Reciclaje', 'Hostelería y Restaurantes', 'Ingeniería Civil y Obras Públicas', 'Investigación y Desarrollo', 'Joyería y Accesorios', 'Marketing Digital', 'Medio Ambiente y Conservación', 'Organización de Eventos y Espectáculos', 'Petroquímica y Química', 'Recursos Humanos', 'Seguridad y Vigilancia', 'Software y Desarrollo de Aplicaciones', 'Tecnología Blockchain y Criptomonedas'];
  const GIROS_FOSOFAMILIA = ['Comercial', 'Manufacturero', 'Servicios', 'Tecnología', 'Alimentario', 'Turismo', 'Construcción', 'Energía y Recursos Naturales', 'Financiero', 'Salud', 'Educación', 'Entretenimiento y Medios', 'Moda y Textil', 'Automotriz', 'Transporte y Logística', 'Inmobiliario', 'Agricultura y Agroindustria', 'Consultoría y Asesoría', 'Arte y Artesanía', 'Social y Ambiental', 'Otra'];
  const JURIDICA_FOSOFAMILIA = 'persona=juridica';
  F[102] = {
    titulo: 'Pre solicitud',
    subtitulo: 'Datos generales del cliente',
    campos: [
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true },
      { tipo: 'texto', nombre: 'direccion_de_vivienda', etiqueta: 'Dirección de la vivienda', max: 200 },
      { tipo: 'opciones', nombre: 'persona', etiqueta: 'Persona', opciones: [
        { valor: 'natural', texto: 'Natural', icono: 'ph-user' }, { valor: 'juridica', texto: 'Jurídica', icono: 'ph-buildings' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', soloLectura: true, si: 'persona=natural' },
      { tipo: 'texto', nombre: 'dui_representante_legal', etiqueta: 'DUI del representante legal', ...FORMATO_DUI, media: true, si: JURIDICA_FOSOFAMILIA },
      { tipo: 'texto', nombre: 'nrc', etiqueta: 'NRC (Número de Registro de Contribuyente)', ...NRC_AAC, media: true, si: JURIDICA_FOSOFAMILIA },
      { tipo: 'lista', nombre: 'giro_de_sociedad', etiqueta: 'Giro de la sociedad', opciones: pares(GIROS_FOSOFAMILIA), media: true, si: JURIDICA_FOSOFAMILIA },
      { tipo: 'texto', nombre: 'numero_de_nit', etiqueta: 'Número de NIT', ...NIT_AAC, media: true, si: JURIDICA_FOSOFAMILIA },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Los correos no coinciden', media: true }
    ],
    pasos: [
      { titulo: 'Datos del negocio y del crédito', subtitulo: 'Cuéntanos de tu negocio y cuánto necesitas', campos: [
        { tipo: 'seccion', titulo: 'Datos del negocio' },
        { tipo: 'lista', nombre: 'sector_economico', etiqueta: 'Sector económico', opciones: pares(SECTORES_FOSOFAMILIA), media: true },
        { tipo: 'texto', nombre: 'actividad_productiva', etiqueta: 'Actividad productiva', placeholder: 'Venta de ropa', max: 100, media: true },
        { tipo: 'texto', nombre: 'nombre_de_la_empresa', etiqueta: 'Nombre de tu negocio', max: 100 },
        { tipo: 'texto', nombre: 'direccion_negocio', etiqueta: 'Dirección de tu negocio', ayuda: 'Si tu negocio está en tu casa, déjala en blanco', max: 200, opcional: true },
        { tipo: 'texto', nombre: 'referencia', etiqueta: 'Referencia de la ubicación', ayuda: 'Tengas o no tu negocio en tu vivienda', placeholder: 'Frente al parque central', max: 200 },
        { ...TELEFONO, nombre: 'n_telefono', etiqueta: 'Teléfono del negocio', opcional: true, tercio: true },
        { ...TELEFONO, nombre: 'telefono_vivienda', etiqueta: 'Teléfono de la vivienda', opcional: true, tercio: true },
        { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono celular', tercio: true },
        { tipo: 'seccion', titulo: 'Datos del crédito' },
        { tipo: 'texto', nombre: 'monto_solicitado', etiqueta: 'Monto solicitado (US$)', ...MONTO_AAC, placeholder: '1500.00', mensaje: 'Escribe solo el monto en números, por ejemplo 1500.00' },
        { tipo: 'opciones', nombre: 'destino_del_credito', etiqueta: 'Destino del crédito', ayuda: 'Puedes elegir varios', multiple: true, columna: true, opciones: [
          'Capital de trabajo', 'Activo fijo', 'Compra de inventarios', 'Materia prima', 'Mejoramiento y ampliación de local', 'Traslado de deudas',
          'Iniciativa de negocio', 'Construcción y remodelación', 'Cancelación de saldo a FOSOFAMILIA'
        ].map(d => ({ valor: d, texto: d })) },
        archivo('foto_de_dui', 'Foto de tu DUI', { ayuda: FORMATOS_IMAGEN + '. Hasta 5 MB' }),
        { tipo: 'opciones', nombre: 'visitarle', etiqueta: 'Posibles horas de visita', ayuda: 'Puedes elegir varias', multiple: true, columna: true,
          opciones: ['9 AM', '10 AM', '11 AM', '12 MD', '1 PM', '2 PM', '3 PM'].map(h => ({ valor: h, texto: h })) }
      ] },
      ENVIAR
    ]
  };

  /* ===== CORSAIN: estado de cuenta ===== */
  // CORSAIN (corsain.ventanilla.simple.sv, trámite 50): un solo paso con los datos del solicitante; su Siguiente envía la solicitud
  F[107] = {
    titulo: 'Datos del solicitante',
    subtitulo: 'Cuéntanos de quién es el estado de cuenta',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: [
        { valor: 'persona_natural', texto: 'Persona natural', icono: 'ph-user' },
        { valor: 'persona_juridica', texto: 'Persona jurídica', detalle: 'O representante legal', icono: 'ph-buildings' }
      ] },
      { tipo: 'texto', nombre: 'razon_social', etiqueta: 'Nombre de la empresa o razón social', max: 150 },
      { tipo: 'texto', nombre: 'nit', etiqueta: 'NIT de la empresa o razón social', ...NIT_AAC, si: 'tipo_de_persona=persona_juridica' },
      archivo('adjuntar_carta_poder', 'Acreditación del representante legal o apoderado', { si: 'tipo_de_persona=persona_juridica' }),
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre del solicitante', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI del solicitante', soloLectura: true, media: true },
      { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo para notificaciones', modo: 'email', media: true },
      { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Los correos no coinciden', media: true },
      { ...TELEFONO, nombre: 'telefono', etiqueta: 'Teléfono de contacto' },
      archivo('adjuntar_estado', 'Estado de cuenta o recibo de pago anterior', { opcional: true }),
      { tipo: 'texto', nombre: 'observaciones_solicitante', etiqueta: 'Comentarios adicionales', max: 500, opcional: true }
    ],
    pasos: [{ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['CORSAIN te envía el estado de cuenta en unos 30 minutos hábiles; según el caso, hasta en 5 días hábiles'] }, ...ENVIAR.campos] }]
  };

  /* ===== INDES: certificación de federaciones y asociaciones deportivas ===== */
  // INDES (indes.ventanilla.simple.sv, trámite 363): los datos del solicitante, la declaración jurada y la asociación,
  // federación o institución de la que se pide el certificado. Lo que sigue en el portal se ve cuando se acepta la declaración
// Las asociaciones van por su número en el portal (faltan la 174 y la 211); las federaciones empiezan en la 2
  const ASOCIACIONES_INDES = ['ASOCIACION DEPORTIVA CANARIOS DE ONCE MUNICIPAL', 'ASOCIACIÓN DE AHUACHAPANECOS AMIGOS DEL FÚTBOL', 'AD CANARIOS FUTSAL AHUACHAPAN', 'ASOCIACIÓN DEPORTIVA TORINO', 'ASOCIACIÓN DEPORTIVA ILOBASQUENSE FUTBOL CLUB', 'CLUB DEPORTIVO EL ROBLE', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACION CLUB DEPORTIVO CHALATENANGO', 'ASOCIACION CLUB DEPORTIVO OFICIAL CHALATENANGO', 'ASOCIACION ESCUELA MUNICIPAL DE FUTBOL NUEVA CONCEPCION', 'CLUB DEPORTIVO CHALATENANGO', 'ASOCIACION DEPORTIVA EL PARAISO', 'ESCUELA MUNICIPAL DE FUTBOL NUEVA CONCEPCION', 'ESCUELA DE FUTBOL NUEVA CONCEPCIÓN', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACION CLUB DEPORTIVO BRASILIA', 'ASOCIACION DEPORTIVA CERRO DE LAS PAVAS EN COJUTEPEQUE', 'ASOCIACION ESCUELA DE FUTBOL DE SAN BARTOLOME PERULAPIA', 'ASOCIACION CLUB DEPORTIVO SAN RAFAEL CEDROS', 'ASOCIACIÓN CLUB DEPORTIVO COJUTEPEQUE', 'ASOCIACION DEPORTIVA CLUB DEPORTIVO SAN RAFAEL CEDROS', 'ASOCIACIÓN DEPORTIVA COJUTEPEQUE', 'ASOCIACION DE VETERANOS DEPORTISTAS DE QUEZALTEPEQUE', 'ASOCIACION CLUB DEPORTIVO JUVENTUD INDEPENDIENTE', 'ASOCIACION DEPORTES SIN FRONTERAS DE EL SALVADOR', 'ASOCIACION DEPORTIVA INFANTO JUVENIL DE PREVENCION SOCIAL', 'ASOCIACIÓN ADMINISTRATIVA COMPLEJO DEPORTIVO “ARVIDIO CORTEZ ORANTES”', 'ASOCIACION DEPORTIVA DESTROYER FUTBOL CLUB', 'ASOCIACION DE ALCANCES DEPORTIVOS', 'ASOCIACION CLUB DEPORTIVO FUERTE SAN ISIDRO LEMPA', 'ASOCIACIÓN TURIN FUTBOL CLUB', 'ASOCIACIÓN DEPORTIVA ACADEMIA INCLUSIVA DE FÚTBOL BASE PROF. EFRÉN MARENCO', 'ASOCIACIÓN DE REPRESENTANTES DE EQUIPOS DEL CENTRO DEPORTIVO EL CAFETALÓN', 'ASOCIACIÓN DEPORTIVA JUVENTUD INDEPENDIENTE', 'ASOCIACIÓN CLUB DEPORTIVO INCA', 'ASOCIACION GRUPO DE AMIGOS DEL BEISBOL INFANTO JUVENIL', 'COMITÉ ORGANIZADOR DE LOS XII JUEGOS CENTROAMERICANOS SANTA TECLA 2021', 'ASOCIACIÓN CANGREJERA FUTBOL CLUB', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACIÓN SOCIODEPORTIVA DEPORTE SIN FRONTERAS', 'ASOCIACION DEPORTIVA LA HERRADURA FUTBOL CLUB', 'ASOCIACION DE ARBITROS DE FUTBOL DE EL SALVADOR', 'ASOCIACION DEPORTIVA SAN RAFAEL', 'ASOCIACION CLUB DEPORTIVO PLATENSE', 'ASOCIACIÓN CLUB DEPORTIVO NEO PIPIL', 'ASOCIACIÓN DEPORTIVA SANTA CLARA', 'ASOCIACION CLUB SOCIAL DEPORTIVO CICLON DEL GOLFO', 'ASOCIACION PASAQUINA FUTBOL CLUB', 'ASOCIACION DEPORTIVA CANTON EL TAMARINDO', 'ASOCIACION CLUB DEPORTIVO SANTA MARIA', 'CLUB DEPORTIVO SAN CARLOS ANAMOROS', 'ASOCIACIÓN DEPORTIVA CLUB DEPORTIVO ATLÉTICO BALBOA', 'ASOCIACIÓN CLUB DEPORTIVO OLIMPICO LITORAL', 'ASOCIACIÓN ESCUELAS DE FUTBOL DE PASAQUINA', 'CLUB DEPORTIVO MAGDALENA', 'ASOCIACION CLUB DEPORTIVO CHAGUITE', 'ASOCIACIÓN CORINTO FUTBOL CLUB', 'CLUB DEPORTIVO FUERTE SAN FRANCISCO', 'CLUB DEPORTIVO PIPIL', 'ASOCIACIÓN DEPORTIVA GOTERA FUTBOL CLUB', 'CLUB DEPORTIVO BUENOS AIRES', 'CLUB DEPORTIVO ATLETICO SAN SIMON', 'ASOCIACIÓN CLUB DEPORTIVO VISTA HERMOSA SAN FRANCISCO GOTERA', 'ASOCIACION CLUB DEPORTIVO ATLETICO CHAPARRASTIQUE', 'ASOCIACION CLUB DEPORTIVO LOS ANDES', 'CLUB DEPORTIVO LIBERAL ISMAEL RODRIGUEZ', 'ASOCIACION ACADEMIA DE FUTBOL MILAGRO DE LA PAZ', 'ASOCIACIÓN DEPORTIVA DE ORIENTE', 'ASOCIACIÓN DEPORTIVA AMIGOS DE CRISTO', 'ASOCIACIÓN SALVADOREÑA DE PATINAJE', 'ASOCIACION SALVADOREÑA PARA LA ORGANIZACION Y DESARROLLO DE ESCUELAS INTEGRALES DE FUTBOL', 'ASOCIACION DE ATLETAS MASTER DE EL SALVADOR', 'ASOCIACION ALIANZA DE LEVANTAMIENTO EN POTENCIA DE EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO MARTE SOYAPANGO', 'ASOCIACION CLUB DE NAVEGACION Y PESCA', 'ASOCIACION PEÑA MADRIDISTA EL SALVADOR', 'ASOCIACION DEPORTIVA DE NATACION', 'ASOCIACION SALVADOREÑA DE TENISTAS SENIOR', 'ASOCIACION DE DEPORTISTAS DE AMERICA', 'ASOCIACION NACIONAL DE ARBITROS DE FUTBOL', 'ASOCIACION ATLETICA NEGRO NARANJA', 'ASOCIACION NACIONAL DE ENTRENADORES DE BASKETBALL DE EL SALVADOR', 'ASOCIACION DEPORTIVA DE VETERANOS FUTBOLISTAS DE APOPA', 'ASOCIACION REAL FUTBOL CLUB', 'ASOCIACION SALVADOREÑA DE KARATE DO', 'ASOCIACION DEPORTIVA COMPLEJO ESPAÑA VEINTIDOS DE ABRIL', 'ASOCIACION UNION DEPORTIVA NACIONAL 1906', 'ASOCIACION DE FUTBOLISTAS DE EL SALVADOR', 'ASOCIACION DE FUTBOL NEJAPENSE', 'ASOCIACION ACADEMIA ARES', 'ASOCIACION CLUB DEPORTIVO VENCEDOR JUNIOR', 'ASOCIACION AMIGOS DE FAS', 'ASOCIACION DEPORTIVA INTIPUCA', 'ASOCIACION DE ENTRENADORES DE FUTBOL DE EL SALVADOR', 'ASOCIACION COMITE DEPORTIVO DE SALVADOREÑOS EN EL EXTERIOR', 'ASOCIACION SALVADOREÑA DE ARBITROS DE FUTBOL', 'ASOCIACION SALVADOREÑA DE FOOTBALL AMERICANO', 'ASOCIACION DE ESCUELA DE FUTBOL VALLE NUEVO', 'ASOCIACION PRO FUTBOL PLAYA', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE LA PAZ', 'ASOCIACION DE DEPORTES DE LA COLONIA SANTA LUCIA, ILOPANGO', 'ASOCIACION ESCUELA DE FUTBOL DE GUAZAPA', 'ASOCIACION SALVADOREÑA DE SAMBO Y DISCIPLINAS AFINES', 'ASOCIACION CENTRO PARA EL ESTUDIO DEL AJEDREZ EL ARTE Y LA CIENCIA', 'ASOCIACION QUEQUEISQUE FUTBOL CLUB', 'ASOCIACION DEPORTIVA INTERNACIONAL SAN SALVADOR', 'ASOCIACION DE ESCUELAS COMUNITARIAS DE TAEKWON-DO EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO CAPITALINOS DE CORAZON', 'ASOCIACION SALVADOREÑA DE RUGBY', 'ASOCIACION SALVADOREÑA DE TAEKWON-DO ITF', 'ASOCIACION DE FUTBOLISTAS PROFESIONALES DE EL SALVADOR', 'ASOCIACION SOMOS AGUILA', 'CLUB DEPORTIVO ILOPANECO', 'ASOCIACION PRO VOLEIBOL', 'ASOCIACIÓN POLIDEPORTIVA PARA SORDOS DE EL SALVADOR', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE GOALBALL', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE PARALISIS CEREBRAL', 'ASOCIACIÓN SALVADOREÑA DE BALONCESTO EN SILLA DE RUEDAS', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE FÚTBOL CINCO', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE DISCAPACIDAD INTELECTUAL', 'ASOCIACIÓN DE ARBITROS INDEPENDIENTES DE BALONCESTO DE EL SALVADOR', 'TALLERES DEPORTIVOS SALVADOREÑOS', 'ASOCIACIÓN SALVADOREÑA DE ARBITROS DE VOLEIBOL', 'ASOCIACIÓN DEPORTIVA CENTRO URBANO ATLACATL', 'CLUB DEPORTIVO ATLETICO MARTE', 'ASOCIACIÓN SALVADOREÑA DE BREAKING', 'ASOCIACIÓN BÉTICA SALVADOREÑA PARA EL DESARROLLO DEL DEPORTE ADAPTADO E INCLUSIVO', 'ASOCIACIÓN SALVADOREÑA DE AIKIDO', 'ASOCIACIÓN CLUB DEPORTIVO FUERTE AGUILARES', 'ASOCIACIÓN DE CLUBES DE LA TERCERA DIVISIÓN DEL FÚTBOL PROFESIONAL', 'ASOCIACIÓN UNIÓN SALVADOREÑA DE TAEKWON-DO', 'ASOCIACIÓN DEPORTIVA SAN SALVADOR', 'CLUB SOCIAL DEPORTIVO VENDAVAL', 'ASOCIACIÓN DEL CENTRO DE CAPACITACIÓN PARA ARBITROS DE FUTBOL', 'ASOCIACIÓN SALVADOREÑA DE ACELERACIÓN', 'ASOCIACIÓN ILOPANGO FUTBOL CLUB', 'ASOCIACIÓN DEPORTIVA REAL ATLETICO SONSONATE', 'Comité Organizador de los XXIV Juegos Centroamericanos y del Caribe, San Salvador 2023', 'ASOCIACIÓN UNIDOS POR EL DEPORTE SALVADOREÑO', 'ASOCIACIÓN OLIMPIADAS ESPECIALES DE EL SALVADOR', 'CLUB DEPORTIVO TALLERES JUNIOR', 'ASOCIACION MULTIDEPORTIVA SAN SALVADOR', 'ASOCIACIÓN DEPORTIVA SAN JACINTO', 'ASOCIACION DEPORTIVA CUSCATLAN', 'ASOCIACION SALVADOREÑA DE ARBITROS PROFESIONALES DE FUTBOL', 'ASOCIACIÓN COLEGIO DE FORMACION DE ARBITROS DE FUTBOL', 'COMITÉ OLÍMPICO DE EL SALVADOR', 'COMITE PARALIMPICO DE EL SALVADOR', 'ASOCIACION SALVADOREÑA DE DANZA DEPORTIVA', 'ASOCIACIÓN SALVADOREÑA DE TIRO PRACTICO', 'ASOCIACIÓN FUTBOL SIETE DE EL SALVADOR', 'ASOCIACIÓN SALVADOREÑA DE CLUBES DE FÚTBOL SALA', 'ASOCIACIÓN DEPORTIVA CLUB DEPORTIVO ESTRELLAS DEL SUR', 'ASOCIACIÓN ZACATECOLUCA FUTBOL CLUB', 'ASOCIACION CLUB DE FUTBOL MARTE SOYAPANGO', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACIÓN FUTBOL PLAYA EL SALVADOR', 'ASOCIACIÓN SALVADOREÑA DEPORTIVA DE PARA POWERLIFTING', 'ASOCIACIÓN SALVADOREÑA DE PARA ATLETISMO', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE PARANATACIÓN', 'ASOCIACIÓN SALVADOREÑA DE PARA TIRO DEPORTIVO', 'ASOCIACIÓN SALVADOREÑA DE RUGBY EN SILLA DE RUEDAS', 'ASOCIACIÓN CLUB DEPORTIVO ATLAS', 'ASOCIACIÓN DE PARA DANZA DEPORTIVA SALVADOREÑA', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE FUTBOL 7 DE PARALISIS CEREBRAL', 'CLUB REAL ANTIGUO CUSCATLAN', 'CLUB DEPORTIVO SAN CARLOS LOS TURCOS', 'ASOCIACIÓN DEL DESARROLLO DEL DEPORTE DE LA GIMNASIA Y ARTE', 'ASOCIACIÓN DEPORTIVA ACADEMIA BP', 'ASOCIACION DEPORTIVA SAN SALVADOR ESTE', 'CLUB DEPORTIVO REAL SAN ESTEBAN', 'ASOCIACION CLUB DEPORTIVO AUDAZ', '', 'ASOCIACION DEPORTIVA JUVENTUD BATANECA', 'ASOCIACIÓN AUDAZ FC APASTEPEQUE', 'ASOCIACIÓN DEPORTIVA FANTASMAS DE SAN VICENTE', 'CLUB DEPORTIVO CRUZEIRO', 'ASOCIACIÓN DEPORTIVA BATANECOS', 'ASOCIACIÓN CLUB DEPORTIVO ESTRELLA ROJA', 'ASOCIACIÓN DEPORTIVA FAMILIAS UNIDAS POR EL DEPORTE Y LA SANA RECREACION', 'ASOCIACIÓN CLUB DEPORTIVO ATLETICO VERAPAZ', 'ASOCIACIÓN DEPORTIVA NAPOLEON ANGULO', 'ASOCIACION DEPORTIVA DRAGONCITOS DE EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO FAS', 'ASOCIACION CLUB DEPORTIVO NUEVO SAN SEBASTIAN DE EL SALVADOR Y SUS FUERZAS BASICAS', 'ASOCIACION DEPORTIVA METAPANECA LEONES DE OCCIDENTE', 'ASOCIACION CLUB DEPORTIVO JUVENTUD CANDELAREÑO', 'ASOCIACIÓN', 'ASOCIACIÓN DE ARBITROS DE FUTBOL DE EL SALVADOR - SANTA ANA', 'ASOCIACIÓN DEPORTIVA MASAHUAT', 'ASOCIACIÓN DEPORTIVA SANTA ANA BASKETBALL CLUB', 'SANTIAGUEÑO FUTBOL CLUB', 'ASOCIACIÓN DE ÁRBITROSDE FÚTBOL INTEGRAL', 'ASOCIACIÓN CLUB DEPORTIVO MALACOFF', 'ASOCIACIÓN DEPORTIVA DE OCCIDENTE', 'ASOCIACIÓN DEPORTIVA CLUB DEPORTIVO JUVENTUD CANDELAREÑO', 'ASOCIACIÓN DEPORTIVA', 'ASOCIACIÓN DE DEPORTISTAS MASTER DE EL SALVADOR', 'CENTRO CULTURAL DEPORTIVO', 'ASOCIACION SONSONATE FUTBOL CLUB', 'ASOCIACION DEPORTIVA JUAYUA', 'ASOCIACION DEPORTIVA SALVADOREÑO', 'ASOCIACION SANTA ISABEL DEPORTIVO MUNICIPAL', 'ASOCIACION CLUB DEPORTIVO RACING JR', 'ASOCIACIÓN PROCANCHA CANTON EL SUNZA', 'ASOCIACIÓN DEPORTIVA MUNICIPAL BRUJOS DE IZALCO', 'ASOCIACIÓN DEPORTIVA MUNICIPAL JUAYUA', 'ASOCIACION FUTBOL CLUB LOS LAURELES', 'CLUB DEPORTIVO ESPAÑA', '', 'ASOCIACION CLUB DEPORTIVO MAR Y PLATA', 'ASOCIACION CLUB DEPORTIVO CALIFORNIA', 'ASOCIACIÓN CLUB DEPORTIVO TOPILTZIN', 'CLUB SOCIAL DEPORTIVO ASPIRANTE', 'ASOCIACIÓN POLIDEPORTIVA SANTIAGUEÑA', 'ASOCIACION CLUB DEPORTIVO SANTIAGUEÑO', 'CLUB DEPORTIVO BERLINES', 'CLUB DEPORTIVO VENCEDOR', 'ASOCIACIÓN CLUB DEPORTIVO EL VENCEDOR', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE CROSSFIT', 'ASOCIACIÓN PEÑA DE BARCELONISTAS DE EL SALVADOR', 'ASOCIACIÓN CLUB DEPORTIVO LA ASUNCION', 'ASOCIACION DEPORTIVA ISIDRO METAPAN', 'ASOCIACION DE VOLEIBOL DE PLAYA DE EL SALVADOR', 'ASOCIACION ALIANZA FOOTBALL CLUB DE EL SALVADOR', 'ASOCIACION DE RUGBY LEAGUE DE EL SALVADOR', 'ASOCIACION SALVADOREÑA DE KARATE AMATEUR Y DISCIPLINA ASOCIADAS', 'ASOCIACION DE LA PRIMERA DIVISION DE FUTBOL PROFESIONAL', 'ASOCIACION PRO-DESARROLLO DEL BASKETBALL EN EL SALVADOR, SAN SALVADOR BASKET CLUB', 'ASOCIACION DEPORTIVA REAL ZARAGOZA', 'ASOCIACION AGUILUCHOS DE CORAZON', 'ASOCIACION DE ARBITROS DE BALONCESTO DE EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO GUADALUPANO', 'ASOCIACION DEPORTIVA CLUB DEPORTIVO ESPARTANO', 'ASOCIACION ESCUELA DE FUTBOL DE SAN MARTIN', 'ASOCIACION', 'ASOCIACION LIGA MASTER DE FUTBOLISTAS DE EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO EVEREST-CANTON BARAHONA Y DELICIAS', 'ASOCIACION DE ENTRENADORES DE TENIS DE EL SALVADOR', 'ASOCIACION DEPORTIVA FUTURA II', 'ASOCIACION CLUB DEPORTIVO DRAGON', 'ASOCIACION DEPORTIVA ZACAMIL', 'ASOCIACION CLUB DEPORTIVO SAN FRANCISCO JUNIOR', 'ASOCIACION COMITE DE DEPORTES DE SAN JOSE DE LAS FLORES', 'ASOCIACION CLUB SALVADOREÑO DE SKEET', 'ASOCIACION DE DEPORTES DE TONACATEPEQUE', 'ASOCIACION DEPORTIVA Y RECREATIVA LOURDENSE', 'ASOCIACION EL CLUB DEPORTIVO ARCENSE', 'CLUB DEPORTIVO SANTANECO', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE SANTA ANA', 'ASOCIACION CLUB DE REMO ILOPANGO', 'ASOCIACION CLUB DEPORTIVO VISTA HERMOSA', 'ASOCIACION DEPORTIVA DE LA COLONIA MALAGA', 'CLUB DEPORTIVO MUNICIPAL LIMEÑO', 'ASOCIACION DEPORTIVA EL PEPETO', 'ASOCIACION CLUB DEPORTIVO ONCE MUNICIPAL', 'ASOCIACION DEPORTIVA SAN SALVADOR FUTBOL CLUB', 'ASOCIACION DEPORTIVA LA CHACRA', 'CLUB DEPORTIVO AGUILA', 'ASOCIACION DEPORTIVA MUNICIPAL', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE CHALATENANGO', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE LA UNION', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE SAN VICENTE', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE SONSONATE', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE SAN MIGUEL', 'ASOCIACION DE CLUBES DE LA SEGUNDA DIVISION DE FUTBOL PROFESIONAL', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE SAN SALVADOR', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE CUSCATLAN', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE LA LIBERTAD', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE CABAÑAS', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE AHUACHAPAN', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE USULUTAN', 'ASOCIACION CLUB DEPORTIVO GERARDO BARRIOS', 'ASOCIACION DEPORTIVA DE CHALATENANGO', 'ASOCIACION DEPORTIVA BRUJOS MARIO CALVO FUTBOL CLUB', 'ASOCIACION CLUB DEPORTIVO SAN FELIPE', 'ASOCIACION CLUB DEPORTIVO SAN PABLO MUNICIPAL', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO DE MORAZAN', 'ASOCIACION JOCORO FUTBOL CLUB', 'ASOCIACION DE TAEKWON-DO TRADICIONAL DE EL SALVADOR', 'ASOCIACION CLUB DEPORTIVO CACAHUATIQUE CIUDAD BARRIOS', 'ASOCIACION CLUB DEPORTIVO ATLETICO SAN LORENZO', 'ASOCIACION KUNG FU WUSHU EL SALVADOR', 'ASOCIACION DEPARTAMENTAL DE FUTBOL AFICIONADO', 'ASOCIACION SALVADOREÑA DE FUTBOL PLAYA', 'ASOCIACION DEPORTIVA ILOBASQUENCE FUTBOL CLUB CABAÑAS', 'ASOCIACION DEPORTIVA JUVENTUD CARA SUCIA', 'ASOCIACION CLUB DEPORTIVO REAL SAN ESTEBAN', 'ASOCIACIÓN DEPORTIVA UNIVERSITARIA SALVADOREÑA', 'ASOCIACIÓN DEPORTIVA SALVADOREÑA DE BOCCIA', 'ASOCIACIÓN SALVADOREÑA DE BOXEO PROFESIONAL', 'ASOCIACIÓN SALVADOREÑA DE FÚTBOL DE AMPUTADOS', 'ASOCIACIÓN CLUB DEPORTIVO LUIS ANGEL FIRPO', 'ASOCIACIÓN CLUB DEPORTIVO REAL PAJONAL', 'ASOCIACIÓN SANTA TECLA FUTBOL CLUB', 'ASOCIACIÓN DEPORTIVA SANTA ROSA GUACHIPILIN', 'ASOCIACIÓN CLUB DEPORTIVO TITAN', 'ASOCIACIÓN SALVADOREÑA DEL JUEGO ANCESTRAL DE PELOTA MESOAMERICANA Y JUEGOS TRADICIONALES', 'ASOCIACION SALVADOREÑA DE FUTBOL 7', 'ASOCIACION SANTIAGUEÑA ATLAS FUTBOL CLUB'];
  const FEDERACIONES_INDES = ['FEDERACIÓN SALVADOREÑA DE ECUESTRES (FESADES)', 'FEDERACIÓN SALVADOREÑA DE PATINAJE (FESAP)', 'FEDERACIÓN SALVADOREÑA DE AJEDREZ (FSA)', 'FEDERACIÓN SALVADOREÑA DE ATLETISMO (FEDEATLETISMO)', 'FEDERACIÓN SALVADOREÑA DE BADMINTON (FESALBAD)', 'FEDERACIÓN SALVADOREÑA DE BALONCESTO (FESABAL)', 'FEDERACIÓN SALVADOREÑA DE BALONMANO (FESBAL)', 'FEDERACION SALVADOREÑA DE BÉISBOL (FEDEBEIS)', 'FEDERACIÓN SALVADOREÑA DE BOWLING (FESABOWL)', 'FEDERACIÓN SALVADOREÑA DE BOXEO AMATEUR (FESALBOX)', 'FEDERACIÓN SALVADOREÑA DE CICLISMO (FSC)', 'FEDERACIÓN SALVADOREÑA DE ESGRIMA', 'FEDERACIÓN SALVADOREÑA DE FISICOCULTURISMO Y DEPORTES AFINES (FSFC)', 'FEDERACIÓN SALVADOREÑA DE FUTBOL AMERICANO INTRAMUROS (SAAIF)', 'FEDERACIÓN SALVADOREÑA DE GIMNASIA (F.S.G.)', 'FEDERACION SALVADOREÑA DE GOLF (FESAGOLF)', 'FEDERACION SALVADOREÑA DE HOCKEY (FESAHOCKEY)', 'FEDERACIÓN SALVADOREÑA DE JUDO (FESAJUDO)', 'FEDERACIÓN SALVADOREÑA DE KARATEDO (F.S.K)', 'FEDERACIÓN SALVADOREÑA DE KICKBOXING Y ARTES MARCIALES MIXTAS (FEDERACIÓN SALVADOREÑA DE KICKBOXING Y ARTES MARCI)', 'FEDERACIÓN SALVADOREÑA DE LIMA LAMA (FESADELL)', 'FEDERACIÓN SALVADOREÑA DE LUCHAS AMATEURS (FEDELUCHAS)', 'FEDERACIÓN SALVADOREÑA DE MONTAÑISMO Y ESCALADA (FSME)', 'FEDERACION SALVADOREÑA DE MOTOCICLISMO (FESAMOTO)', 'FEDERACIÓN SALVADOREÑA DE NATACIÓN (FSN)', 'FEDERACION SALVADOREÑA DE PARACAIDISMO Y AERODEPORTES (FESAPADE)', 'FEDERACIÓN SALVADOREÑA DE LEVANTAMIENTO DE PESAS (FEDEPESAS)', 'FEDERACION SALVADOREÑA DE REMO (FEDEREMO)', 'FEDERACIÓN SALVADOREÑA DE RUGBY', 'FEDERACIÓN SALVADOREÑA DE SOFTBOL (FEDESOFT)', 'FEDERACIÓN SALVADOREÑA DE SQUASH (FSS)', 'FEDERACIÓN SALVADOREÑA DE SURF (FESASURF)', 'FEDERACIÓN SALVADOREÑA DE TAEKWONDO (FESAT)', 'FEDERACIÓN SALVADOREÑA DE TENIS (FST)', 'FEDERACIÓN SALVADOREÑA DE TENIS DE MESA (FSTM)', 'FEDERACIÓN SALVADOREÑA DE TIRO CON ARCO (FESTA)', 'FEDERACIÓN SALVADOREÑA DE TIRO (FESATIRO)', 'FEDERACIÓN SALVADOREÑA DE TRIATLÓN (FESTRI)', 'FEDERACIÓN SALVADOREÑA DE VELA (FESAVELA)', 'FEDERACIÓN SALVADOREÑA DE VOLEIBOL (FESAVOL)', 'FEDERACION SALVADOREÑA DE FUTBOL (FESFUT)', 'FEDERACIÓN SALVADOREÑA DE PESCA (FESAPES)', 'FEDERACIÓN SALVADOREÑA DE ENTRENAMIENTO FUNCIONAL (FESEF)', 'FEDERACIÓN SALVADOREÑA DE BAILE DEPORTIVO (FESBADE)', 'FEDERACIÓN SALVADOREÑA DE TEQBALL (FESATEQ)', 'FEDERACIÓN SALVADOREÑA DE PADEL (FSP)', 'FEDERACIÓN SALVADOREÑA DE FRONTON (FESAFRO)', 'FEDERACIÓN FUTBOL SIETE EL SALVADOR (F SIETE ESA)'];
  const JURIDICA_INDES = 'tipo_de_persona=2';
  F[108] = {
    titulo: 'Registro',
    subtitulo: 'Datos del solicitante',
    campos: [
      { tipo: 'opciones', nombre: 'tipo_de_persona', etiqueta: 'Tipo de persona', opciones: [
        { valor: '1', texto: 'Natural', icono: 'ph-user' }, { valor: '2', texto: 'Jurídica', icono: 'ph-buildings' }
      ] },
      { tipo: 'texto', nombre: 'nit', etiqueta: 'Número de identificación tributaria (NIT)', ...NIT_AAC, si: JURIDICA_INDES },
      { tipo: 'opciones', nombre: 'tipo_solicitante', etiqueta: 'Calidad del solicitante', si: JURIDICA_INDES, opciones: [
        { valor: 'representante', texto: 'Representante legal', icono: 'ph-identification-badge' }, { valor: 'apoderado', texto: 'Apoderado legal', icono: 'ph-file-text' }
      ] },
      archivo('documento2', 'Poder', { ayuda: FORMATOS_IMAGEN + '. Hasta 15 MB', si: JURIDICA_INDES }),
      { tipo: 'opciones', nombre: 'tipo_de_documento', etiqueta: 'Documento de identidad', opciones: [
        { valor: 'dui', texto: 'DUI', icono: 'ph-identification-card' }, { valor: 'pasaporte', texto: 'Pasaporte', icono: 'ph-identification-badge' },
        { valor: 'carnet_de_residencia', texto: 'Carnet de residencia', icono: 'ph-identification-badge' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'Número de DUI', ...FORMATO_DUI, si: 'tipo_de_documento=dui' },
      { tipo: 'texto', nombre: 'numero_de_pasaporte', etiqueta: 'Número de pasaporte', max: 20, si: 'tipo_de_documento=pasaporte' },
      { tipo: 'texto', nombre: 'carnet_de_residencia', etiqueta: 'Número de carnet de residencia', max: 20, si: 'tipo_de_documento=carnet_de_residencia' },
      { tipo: 'opciones', nombre: 'tra_tercero', etiqueta: '¿El trámite es para un tercero?', opciones: SI_NO },
      { tipo: 'texto', nombre: 'nombre_de_la_institucion', etiqueta: 'Nombre de la institución', max: 150, si: 'tra_tercero=si' }
    ],
    pasos: [
      { titulo: 'Declaración jurada', subtitulo: 'Lee y acepta la declaración', campos: [
        { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: [
          'Das fe y declaras bajo juramento la veracidad de la información del formulario y de los documentos anexos, cumpliendo con los requisitos de ley exigidos, por lo que asumes la responsabilidad administrativa, civil o penal que se derive de la falsedad de la información',
          'Entiendes que la información que recibes del INDES es para tu uso exclusivo, con fines deportivos y lícitos y sin menoscabo de la integridad o reputación de quienes representan a las federaciones y asociaciones deportivas',
          'Esa información es pública según el art. 59 de la Ley General de los Deportes de El Salvador y se basa solo en los registros de inscripción de federaciones y asociaciones deportivas que reconoce el INDES a la fecha de emisión de la constancia, con jurisdicción nacional',
          'Aceptas recibir notificaciones por correo electrónico y en SIMPLE.SV'
        ] },
        { tipo: 'opciones', nombre: 'declaracion', etiqueta: 'Declaración jurada', marcado: true, opciones: [{ valor: 'declaracion_jurada', texto: 'Lo declaro bajo juramento', icono: 'ph-seal-check' }] }
      ] },
      { titulo: 'Certificado', subtitulo: 'Cuéntanos para quién solicitas el certificado', campos: [
        { tipo: 'opciones', nombre: 'fede_aso', etiqueta: '¿Para qué solicitas tu certificado?', opciones: [
          { valor: '1', texto: 'Asociación', icono: 'ph-users-three' }, { valor: '2', texto: 'Federación', icono: 'ph-trophy' }, { valor: '3', texto: 'Otra institución', icono: 'ph-buildings' }
        ] },
        { tipo: 'lista', nombre: 'nombre_de_la_asociacion', etiqueta: 'Nombre de la asociación', opciones: ASOCIACIONES_INDES.map((a, i) => [String(i + 1), a]).filter(([, a]) => a), si: 'fede_aso=1' },
        { tipo: 'lista', nombre: 'nombre_de_la_federacion', etiqueta: 'Nombre de la federación', opciones: FEDERACIONES_INDES.map((f, i) => [String(i + 2), f]), si: 'fede_aso=2' },
        { tipo: 'texto', nombre: 'otra_institucion', etiqueta: 'Nombre de la institución', max: 150, si: 'fede_aso=3' }
      ] },
      ENVIAR
    ]
  };

  /* ===== FONAT: ingreso a programas de rehabilitación ===== */
  // FONAT (fonat.ventanilla.simple.sv, trámite 342): para quién es y la nacionalidad del beneficiario; sus datos y el contacto (y el
  // representante legal si es extranjero); el siniestro vial con el consentimiento; los requisitos documentales y, al final, el
  // resumen (el último paso). Si el beneficiario es salvadoreño, el portal trae del RNPN los datos del representante con el DUI
  const PARA_TERCERO_FONAT = 'tipo_tramite=tercero';
  const MENOR_FONAT = 'el_beneficiario_es=menor_de_edad';
  const EXTRANJERO_FONAT = 'nacionalidad_beneficiario=extranjera';
  const SIN_SOLICITUD_FONAT = 'documentacion_presentada_sol=no';
  const DOCUMENTO_FONAT = (nombre, etiqueta, extra = {}) => archivo(nombre, etiqueta, { ayuda: FORMATOS_IMAGEN + '. Hasta 5 MB', ...extra });
  F[111] = {
    titulo: 'Ingreso de solicitud',
    subtitulo: 'Datos del solicitante',
    campos: [
      { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo del solicitante', soloLectura: true },
      { tipo: 'opciones', nombre: 'tipo_tramite', etiqueta: '¿Para quién solicitas el trámite?', opciones: [
        { valor: 'personal', texto: 'Para mí', icono: 'ph-user' }, { valor: 'tercero', texto: 'Para un tercero', icono: 'ph-users' }
      ] },
      { tipo: 'opciones', nombre: 'nacionalidad_beneficiario', etiqueta: 'Nacionalidad del beneficiario', opciones: [
        { valor: 'salvadorena', texto: 'Salvadoreña', icono: 'ph-map-pin' }, { valor: 'extranjera', texto: 'Extranjero', icono: 'ph-globe-hemisphere-west' }
      ] },
      { tipo: 'opciones', nombre: 'el_beneficiario_es', etiqueta: '¿El beneficiario es menor o mayor de edad?', si: PARA_TERCERO_FONAT, opciones: [
        { valor: 'menor_de_edad', texto: 'Menor de edad', icono: 'ph-baby' }, { valor: 'mayor_de_edad', texto: 'Mayor de edad', icono: 'ph-user' }
      ] },
      { tipo: 'texto', nombre: 'numero_de_documento', etiqueta: 'DUI del beneficiario', soloLectura: true, media: true, si: 'tipo_tramite=personal' },
      { tipo: 'texto', nombre: 'dui', etiqueta: 'DUI del beneficiario o del representante legal', ayuda: 'Si es menor de edad, el de su representante legal', ...FORMATO_DUI, media: true, si: PARA_TERCERO_FONAT },
      { tipo: 'texto', nombre: 'pasaporte', etiqueta: 'Pasaporte', max: 20, media: true, si: EXTRANJERO_FONAT }
    ],
    pasos: [
      { titulo: 'Datos del beneficiario', subtitulo: 'Cómo contactarlo', campos: [
        { tipo: 'seccion', titulo: 'Beneficiario', si: PARA_TERCERO_FONAT },
        ...nombrePorPartes('beneficiario_', { obligatorio: true, si: PARA_TERCERO_FONAT }),
        { tipo: 'texto', nombre: 'beneficiario_fecha_nacimiento', etiqueta: 'Fecha de nacimiento', ...FECHA_DMA, si: PARA_TERCERO_FONAT },
        { tipo: 'opciones', nombre: 'beneficiario_sexo', etiqueta: 'Sexo del beneficiario', si: PARA_TERCERO_FONAT, opciones: [
          { valor: 'masculino', texto: 'Masculino', icono: 'ph-gender-male' }, { valor: 'femenino', texto: 'Femenino', icono: 'ph-gender-female' }
        ] },
        { tipo: 'seccion', titulo: 'Contacto' },
        { tipo: 'nota', estilo: 'info', lineas: ['Si tienes un familiar, amigo o alguien de confianza, puedes poner su departamento, municipio y teléfono para poder contactarte si es necesario'], si: EXTRANJERO_FONAT },
        { tipo: 'lista', nombre: 'departamento_residencia', etiqueta: 'Departamento de residencia', opciones: DEPARTAMENTOS, opcional: true, media: true },
        { tipo: 'lista', nombre: 'municipio_residencia', etiqueta: 'Municipio de residencia', depende: 'departamento_residencia', opcionesPor: MUNICIPIOS, opcional: true, media: true },
        { ...TELEFONO, nombre: 'telefono_de_contacto', etiqueta: 'Teléfono de contacto del responsable', opcional: true },
        { tipo: 'texto', nombre: 'correo_notificaciones', etiqueta: 'Correo electrónico', modo: 'email', media: true },
        { tipo: 'texto', nombre: 'confirmar_correo', etiqueta: 'Confirma el correo', modo: 'email', igualA: 'correo_notificaciones', mensaje: 'Los correos no coinciden', media: true }
      ] },
      { titulo: 'Representante legal', subtitulo: 'Quién representa al beneficiario', si: PARA_TERCERO_FONAT, campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['Con el DUI, FONAT obtiene del Registro Nacional de las Personas Naturales los datos de quien representa al beneficiario'], si: 'nacionalidad_beneficiario=salvadorena' },
        ...nombrePorPartes('representante_', { obligatorio: true, casada: true, si: EXTRANJERO_FONAT })
      ] },
      { titulo: 'Datos del siniestro vial', subtitulo: 'Cuéntanos qué pasó', campos: [
        { tipo: 'texto', nombre: 'fecha_siniestro_vial', etiqueta: 'Fecha del siniestro vial', ...FECHA_DMA },
        { tipo: 'opciones', nombre: 'tipo_de_victima', etiqueta: 'Tipo de víctima', columna: true, opciones: [
          { valor: 'peaton', texto: 'Peatón', icono: 'ph-person-simple-walk' }, { valor: 'ciclista', texto: 'Ciclista', icono: 'ph-bicycle' },
          { valor: 'pasajero', texto: 'Pasajero', icono: 'ph-users' }, { valor: 'conductor', texto: 'Conductor', icono: 'ph-car-profile' },
          { valor: 'motociclista', texto: 'Motociclista', icono: 'ph-motorcycle' }
        ] },
        { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: ['Siendo beneficiario de los proyectos de la Unidad de Gestión para Rehabilitación (FONAT), das tu consentimiento o, si actúas como representante legal del beneficiario, autorizas su participación en esos proyectos, comprometiéndote al seguimiento, acompañamiento y adherencia a los proyectos'] },
        { tipo: 'opciones', nombre: 'concentimiento_tramite', etiqueta: 'Declaración jurada', marcado: true, opciones: [{ valor: 'he_leido_y_acepto', texto: 'He leído y acepto', icono: 'ph-seal-check' }] }
      ] },
      { titulo: 'Requisitos documentales', subtitulo: 'Cuéntanos qué ya presentaste', campos: [
        { tipo: 'opciones', nombre: 'documentacion_presentada_sol', etiqueta: '¿Ya presentaste en FONAT la solicitud de prestación económica por lesiones a consecuencia de un siniestro vial?', opciones: SI_NO }
      ] },
      { titulo: 'Documentos', subtitulo: 'Adjúntalos en JPG, PNG o PDF', si: SIN_SOLICITUD_FONAT, campos: [
        { tipo: 'nota', estilo: 'info', lineas: ['El modelo de constancia médica en formato FONAT se descarga del portal de FONAT'] },
        DOCUMENTO_FONAT('dui_solicitante', 'DUI del solicitante', { si: 'tipo_tramite=personal' }),
        DOCUMENTO_FONAT('dui_representante_legal', 'DUI del representante legal', { si: MENOR_FONAT }),
        DOCUMENTO_FONAT('documento_pasaporte', 'Pasaporte', { si: EXTRANJERO_FONAT }),
        DOCUMENTO_FONAT('partida_de_nacimiento', 'Partida de nacimiento del menor de edad', { si: MENOR_FONAT }),
        DOCUMENTO_FONAT('acta_policial_siniestro_vial', 'Acta policial del siniestro vial', { opcional: true }),
        DOCUMENTO_FONAT('constancia_medica', 'Constancia médica (formato FONAT)')
      ] },
      ENVIAR
    ]
  };

  /* ===== FOSEP: inscripción en el registro nacional de consultores ===== */
  // FOSEP (foseprnc.ventanilla.simple.sv, trámite 400): un solo paso con los datos de la empresa, su representante legal y su
  // contacto, los códigos de especialización y la experiencia en estudios de preinversión; su Siguiente envía la inscripción.
  // En el portal los estudios son una tabla de hasta 5 filas: aquí va uno y un campo para los demás
  const ESPECIALIDADES_FOSEP = [
    ['administracion', 'ADMINISTRACIÓN (AD)', [['AD.0100', 'AD.0100 ADMINISTRACIÓN Y ORGANIZACIÓN'], ['AD.0200', 'AD.0200 ANÁLISIS DE SISTEMAS'], ['AD.0300', 'AD.0300 ANÁLISIS FINANCIEROS'], ['AD.0400', 'AD.0400 AUDITORÍAS'], ['AD.0500', 'AD.0500 DESARROLLO INSTITUCIONAL'], ['AD.0600', 'AD.0600 EXPORTACIÓN'], ['AD.0700', 'AD.0700 PRIVATIZACIÓN'], ['AD.0800', 'AD.0800 ORGANIZACIÓN Y MÉTODOS'], ['AD.0900', 'AD.0900 RECURSOS HUMANOS'], ['AD.1000', 'AD.1000 CAPACITACIÓN EN ADMINISTRACIÓN'], ['AD.1100', 'AD.1100 OTROS']]],
    ['agropecuario', 'AGROPECUARIO (AG)', [['AG.0100', 'AG.0100 PLANIFICACIÓN AGROPECUARIA'], ['AG.0200', 'AG.0200 FORESTAL'], ['AG.0300', 'AG.0300 PECUARIO'], ['AG.0400', 'AG.0400 PESCA'], ['AG.0500', 'AG.0500 RIEGO Y DRENAJE'], ['AG.0600', 'AG.0600 SANIDAD VEGETAL Y ANIMAL'], ['AG.0700', 'AG.0700 DESARROLLO AGRÍCOLA'], ['AG.0800', 'AG.0800 USO Y MANEJO DE SUELOS'], ['AG.0900', 'AG.0900 AGROINDUSTRIA'], ['AG.1000', 'AG.1000 CAPACITACIÓN AGROPECUARIA'], ['AG.1100', 'AG.1100 OTROS']]],
    ['ambiental', 'AMBIENTAL (AM)', [['AM.0100', 'AM.0100 PLANIFICACIÓN AMBIENTAL'], ['AM.0200', 'AM.0200 ASPECTOS LEGALES E INSTITUCIONALES'], ['AM.0300', 'AM.0300 PROTECCIÓN Y CONSERVACIÓN'], ['AM.0400', 'AM.0400 MANEJO DE DESECHOS'], ['AM.0401', 'AM.0401 SÓLIDOS'], ['AM.0402', 'AM.0402 AGUAS RESIDUALES'], ['AM.0403', 'AM.0403 PELIGROSOS'], ['AM.0404', 'AM.0404 INDUSTRIALES'], ['AM.0405', 'AM.0405 HOSPITALARIOS'], ['AM.0500', 'AM.0500 MANEJO DE CUENCAS'], ['AM.0600', 'AM.0600 MANEJO DE ÁREAS PROTEGIDAS'], ['AM.0700', 'AM.0700 MANEJO DE RECURSOS COSTEROS Y MARINOS'], ['AM.0800', 'AM.0800 REUTILIZACIÓN DE AGUAS RESIDUALES'], ['AM.0900', 'AM.0900 CONTAMINACIÓN ATMOSFÉRICA'], ['AM.1000', 'AM.1000 RUIDO Y VIBRACIONES'], ['AM.1100', 'AM.1100 CALIDAD DEL AGUA'], ['AM.1200', 'AM.1200 OCEANOGRAFÍA Y LIMNOLOGÍA'], ['AM.1300', 'AM.1300 FAUNA Y FLORA'], ['AM.1400', 'AM.1400 MEDIO SOCIO ECONÓMICO'], ['AM.1500', 'AM.1500 PAISAJISMO'], ['AM.1600', 'AM.1600 ASPECTOS SOCIOCULTURALES'], ['AM.1700', 'AM.1700 HISTORIA, ARQUEOLOGÍA Y ANTROPOLOGÍA'], ['AM.1800', 'AM.1800 EVALUACIÓN DE IMPACTO AMBIENTAL'], ['AM.1801', 'AM.1801 EIA TRANSPORTE TERRESTRE'], ['AM.1802', 'AM.1802 EIA TRANSPORTE MARÍTIMO'], ['AM.1803', 'AM.1803 EIA TRANSPORTE AÉREO'], ['AM.1804', 'AM.1804 EIA HOSPITALES'], ['AM.1805', 'AM.1805 EIA AGUAS'], ['AM.1806', 'AM.1806 EIA ACTIVIDADES AGRARIAS, CAZA Y PESCA'], ['AM.1807', 'AM.1807 EIA GENERACIÓN DE ENERGÍA'], ['AM.1808', 'AM.1808 EIA INDUSTRIA'], ['AM.1809', 'AM.1809 EIA TURISMO'], ['AM.1810', 'AM.1810 EIA ORDENAMIENTO TERRITORIAL Y URBANISMO']]],
    ['areas_complementarias', 'ÁREAS COMPLEMENTARIAS (AC)', [['AC.0100', 'AC.0100 SISMOLOGÍA'], ['AC.0200', 'AC.0200 INVESTIGACIÓN GEOLÓGICA Y GEOFÍSICA'], ['AC.0300', 'AC.0300 CARTOGRAFÍA'], ['AC.0400', 'AC.0400 SISTEMAS DE INFORMACIÓN GEOGRÁFICA'], ['AC.0500', 'AC.0500 HIDROGEOLOGÍA'], ['AC.0600', 'AC.0600 GEOTECNIA'], ['AC.0700', 'AC.0700 TOPOGRAFÍA'], ['AC.0800', 'AC.0800 FOTOGRAMETRÍA'], ['AC.0900', 'AC.0900 CATASTROS'], ['AC.1000', 'AC.1000 DEMOGRAFÍA'], ['AC.1100', 'AC.1100 INVENTARIOS Y VALÚOS'], ['AC.1200', 'AC.1200 ESTUDIOS ECONÓMICOS'], ['AC.1300', 'AC.1300 ESTUDIOS SOCIOLÓGICOS'], ['AC.1400', 'AC.1400 SISTEMAS DE INFORMÁTICA'], ['AC.1500', 'AC.1500 ENCUESTAS'], ['AC.1600', 'AC.1600 ARQUEOLOGÍA'], ['AC.1700', 'AC.1700 ESTUDIOS ILEGALES'], ['AC.1800', 'AC.1800 ESTUDIOS DE MERCADO'], ['AC.1900', 'AC.1900 BATIMETRIA'], ['AC.2000', 'AC.2000 OTROS']]],
    ['arquitectura_y_diseno', 'ARQUITECTURA Y DISEÑO (AYD)', [['AYD.0100', 'AYD.0100 EDIFICACIONES'], ['AYD.0101', 'AYD.0101 HOTELES'], ['AYD.0102', 'AYD.0102 COMPLEJOS HABITACIONALES'], ['AYD.0103', 'AYD.0103 INSTALACIONES DEPORTIVAS'], ['AYD.0104', 'AYD.0104 INSTALACIONES INDUSTRIALES'], ['AYD.0105', 'AYD.0105 INSTALACIONES COMERCIALES'], ['AYD.0106', 'AYD.0106 INSTALACIONES RECREATIVAS'], ['AYD.0107', 'AYD.0107 INSTALACIONES MILITARES Y PENITENCIARIAS'], ['AYD.0108', 'AYD.0108 INSTALACIONES CULTURALES'], ['AYD.0109', 'AYD.0109 INSTALACIONES EDUCATIVAS'], ['AYD.0110', 'AYD.0110 INSTALACIONES HOSPITALARIAS'], ['AYD.0111', 'AYD.0111 INSTALACIONES AGROINDUSTRIALES'], ['AYD.0112', 'AYD.0112 INSTALACIONES AGROPECUARIAS'], ['AYD.0113', 'AYD.0113 INSTALACIONES PARA OFICINAS Y SERVICIOS EN GENERAL'], ['AYD0200', 'AYD0200 DISEÑO DE INTERIORES'], ['AYD.0300', 'AYD.0300 DISEÑO MUSEOGRÁFICO'], ['AYD.0400', 'AYD.0400 DISEÑO GRAFICO'], ['AYD.0500', 'AYD.0500 ARQUITECTURA Y PAISAJE'], ['AYD.0600', 'AYD.0600 DISEÑOS DE INGENIERÍA'], ['AYD.0601', 'AYD.0601 DISEÑOS DE INGENIERÍA ESTRUCTURALES'], ['AYD.0602', 'AYD.0602 DISEÑOS DE INGENIERÍA ELÉCTRICOS'], ['AYD.0603', 'AYD.0603 DISEÑOS DE INGENIERÍA HIDRÁULICOS'], ['AYD.604', 'AYD.604 DISEÑOS DE INGENIERÍA MECÁNICOS'], ['AYD.0605', 'AYD.0605 DISEÑOS DE INGENIERÍA OBRAS DE MITIGACIÓN'], ['AYD.0700', 'AYD.0700 CAPACITACIÓN EN ARQUITECTURA Y DISEÑO'], ['AYD.0800', 'AYD.0800 OTROS']]],
    ['ciencia_y_tecnologia', 'CIENCIA Y TECNOLOGÍA (CT)', [['CT.0100', 'CT.0100 ESTUDIOS BÁSICOS'], ['CT.0200', 'CT.0200 TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIÓN TIC'], ['CT.0300', 'CT.0300 ASESORAMIENTO TECNOLÓGICO'], ['CT.0400', 'CT.0400 PROMOCIÓN Y FOMENTO'], ['CT.0500', 'CT.0500 PARQUES TECNOLÓGICOS'], ['CT.0600', 'CT.0600 CAPACITACIÓN EN CIENCIA Y TECNOLOGÍA']]],
    ['desarrollo_urbano', 'DESARROLLO URBANO (DU)', [['DU.0100', 'DU.0100 PLANIFICACIÓN URBANA'], ['DU.0200', 'DU.0200 FORTALECIMIENTO INSTITUCIONAL MUNICIPAL'], ['DU.0300', 'DU.0300 ORDENACIÓN Y DESARROLLO TERRITORIAL'], ['DU.0400', 'DU.0400 LOTES CON SERVICIOS'], ['DU.0500', 'DU.0500 USOS DE SUELOS'], ['DU.0600', 'DU.0600 SERVICIOS URBANOS'], ['DU.0700', 'DU.0700 PARQUES Y ÁREAS ABIERTAS'], ['DU.0800', 'DU.0800 MEJORAMIENTO BARRIAL Y COMUNAL'], ['DU.0900', 'DU.0900 CAPACITACIÓN EN DESARROLLO URBANO'], ['DU.1000', 'DU.1000 ORGANIZACIÓN Y FACILIDAD COMUNAL'], ['DU.1100', 'DU.1100 DESARROLLO URBANO'], ['DU.1200', 'DU.1200 OTROS']]],
    ['educacion', 'EDUCACIÓN (ED)', [['ED.0100', 'ED.0100 PLANIFICACIÓN EDUCATIVA'], ['ED.0200', 'ED.0200 ESTUDIOS GENERALES DE DESARROLLO EDUCACIONAL'], ['ED.0300', 'ED.0300 PARVULARIA'], ['ED.0400', 'ED.0400 BÁSICA'], ['ED.0500', 'ED.0500 MEDIA'], ['ED.0600', 'ED.0600 SUPERIOR NO UNIVERSITARIA'], ['ED.0700', 'ED.0700 VOCACIONAL'], ['ED.0800', 'ED.0800 UNIVERSITARIA'], ['ED.0900', 'ED.0900 NO FORMAL'], ['ED.1000', 'ED.1000 FORMACIÓN DOCENTE'], ['ED.1100', 'ED.1100 EDUCACIÓN ESPECIAL'], ['ED.1200', 'ED.1200 AUDIOVISUALES Y MATERIALES EDUCATIVOS'], ['ED.1300', 'ED.1300 CAPACITACIÓN EN EDUCACIÓN'], ['ED.1400', 'ED.1400 CIENCIA Y TECNOLOGÍA EDUCATIVA'], ['ED.1500', 'ED.1500 OTROS']]],
    ['energia', 'ENERGÍA (EN)', [['EN.0100', 'EN.0100 CENTRALES HIDROELÉCTRICAS'], ['EN.0200', 'EN.0200 CENTRALES GEOTÉRMICAS'], ['EN.0300', 'EN.0300 CENTRALES NUCLEARES'], ['EN.0400', 'EN.0400 CENTRALES TERMOELÉCTRICAS'], ['EN.0500', 'EN.0500 PEQUEÑAS PLANTAS HIDROELÉCTRICAS'], ['EN.0600', 'EN.0600 ENERGÍA SOLAR'], ['EN.0700', 'EN.0700 ENERGÍA EÓLICA'], ['EN.0800', 'EN.0800 RECURSOS MINEROS'], ['EN.0900', 'EN.0900 RED Y SUBESTACIONES DE TRANSMISIÓN'], ['EN.1000', 'EN.1000 RED Y SUBESTACIONES DE DISTRIBUCIÓN'], ['EN.1100', 'EN.1100 ELECTRIFICACIÓN'], ['EN.12000', 'EN.12000 INSTALACIONES ELÉCTRICAS'], ['EN.1300', 'EN.1300 AHORRO ENERGÉTICO'], ['EN.1400', 'EN.1400 COGENERACIÓN'], ['EN.1500', 'EN.1500 EQUIPOS Y MATERIALES'], ['EN.1600', 'EN.1600 EXPLORACIÓN'], ['EN.1700', 'EN.1700 CAPACITACIÓN EN ENERGÍA'], ['EN.1800', 'EN.1800 OTROS']]],
    ['industria', 'INDUSTRIA (IN)', [['IN.0100', 'IN.0100 PLANIFICACIÓN INDUSTRIAL'], ['IN.0200', 'IN.0200 CIENCIA Y TECNOLOGÍA INDUSTRIAL'], ['IN.0300', 'IN.0300 PARQUES INDUSTRIALES Y ZONAS FRANCAS'], ['IN.0400', 'IN.0400 PRODUCCIÓN'], ['IN.0500', 'IN.0500 EQUIPAMIENTO INDUSTRIAL'], ['IN.0600', 'IN.0600 CONTROL DE CALIDAD Y ESTÁNDARES'], ['IN.0700', 'IN.0700 INDUSTRIA MINERA'], ['IN.0800', 'IN.0800 CAPACITACIÓN EN INDUSTRIA'], ['IN.0900', 'IN.0900 OTROS']]],
    ['hidricos_e_ingenieria', 'RECURSOS HÍDRICOS E INGENIERÍA (RH)', [['RH.0100', 'RH.0100 PLANIFICACIÓN HÍDRICA'], ['RH.0101', 'RH.0101 ANÁLISIS HIDROLÓGICOS'], ['RH.0102', 'RH.0102 ANÁLISIS HIDRÁULICOS'], ['RH.0103', 'RH.0103 CONTROL DE INUNDACIONES'], ['RH.0104', 'RH.0104 APROVECHAMIENTO DE CUENCAS'], ['RH.0200', 'RH.0200 AGUA POTABLE'], ['RH.0201', 'RH.0201 INVESTIGACIÓN DE FUENTES'], ['RH.0202', 'RH.0202 DISTRIBUCIÓN'], ['RH.0203', 'RH.0203 EMBALSES Y PEQUEÑAS OBRAS HIDRÁULICAS'], ['RH.0204', 'RH.0204 ALMACENAMIENTO'], ['RH.0205', 'RH.0205 ESTACIONES DE BOMBEO'], ['RH.0206', 'RH.0206 ACUEDUCTOS RURALES'], ['RH.0207', 'RH.0207 ACUEDUCTOS URBANOS'], ['RH.0208', 'RH.0208 CALIDAD DEL AGUA'], ['RH.0209', 'RH.0209 PLANTAS POTABILIZADORAS'], ['RH.0300', 'RH.0300 AGUAS RESIDUALES'], ['RH.0301', 'RH.0301 PLANTAS DE TRATAMIENTO'], ['RH.0302', 'RH.0302 ALCANTARILLADOS'], ['RH.0303', 'RH.0303 ESTACIONES DE BOMBEO'], ['RH.0400', 'RH.0400 AGUAS LLUVIAS'], ['RH.0500', 'RH.0500 TARIFAS Y COSTOS HÍDRICOS'], ['RH.0600', 'RH.0600 CONTABILIDAD Y ADITORIA'], ['RH.0700', 'RH.0700 CAPACITACIÓN EN RECURSOS HÍDRICOS'], ['RH.0800', 'RH.0800 OTROS']]],
    ['salud', 'SALUD (SA)', [['SA.0100', 'SA.0100 PLANIFICACIÓN EN ASPECTOS RELACIONADOS A LA SALUD'], ['SA.0200', 'SA.0200 SALUD PÚBLICA'], ['SA.0300', 'SA.0300 SALUD RURAL'], ['SA.0400', 'SA.0400 SERVICIOS HOSPITALARIOS'], ['SA.0500', 'SA.0500 SERVICIOS ESPECIALIZADOS'], ['SA.0600', 'SA.0600 PROGRAMAS NO TRADICIONALES'], ['SA.0700', 'SA.0700 SALUD PREVENTIVA'], ['SA.0800', 'SA.0800 SALUD MENTAL'], ['SA.0900', 'SA.0900 SALUD OCUPACIONAL'], ['SA.1000', 'SA.1000 EPIDEMIOLOGÍA'], ['SA.1100', 'SA.1100 NUTRICIÓN'], ['SA.1200', 'SA.1200 DESARROLLO MATERNO-INFANTIL'], ['SA.1300', 'SA.1300 CIENCIA Y TECNOLOGÍA APLICADA A LA SALUD'], ['SA.1400', 'SA.1400 EQUIPO Y MANTENIMIENTO HOSPITALARIO'], ['SA.1500', 'SA.1500 CAPACITACIÓN EN ASPECTOS RELACIONADOS A LA SALUD'], ['SA.1600', 'SA.1600 OTROS']]],
    ['telecomunicaciones', 'TELECOMUNICACIONES (TE)', [['TE.0100', 'TE.0100 PLANIFICACIÓN DE LAS TELECOMUNICACIONES'], ['TE.0200', 'TE.0200 EQUIPOS DE TELECOMUNICACIÓN'], ['TE.0300', 'TE.0300 SISTEMAS DE TRANSMISIÓN Y RECEPCIÓN'], ['TE.0400', 'TE.0400 TELEFONÍA'], ['TE.0500', 'TE.0500 RADIO-TV'], ['TE.0600', 'TE.0600 CONTABILIDAD-AUDITORÍA-TARIFAS DE TELECOMUNICACIÓN'], ['TE.0700', 'TE.0700 ESTUDIOS BÁSICOS O GENERALES'], ['TE.0800', 'TE.0800 SENSORAMIENTO REMOTO'], ['TE.0900', 'TE.0900 COSTOS Y TARIFAS DE TELECOMUNICACIÓN'], ['TE.1000', 'TE.1000 CAPACITACIÓN EN TELECOMUNICACIONES'], ['TE.1100', 'TE.1100 OTROS']]],
    ['transporte', 'TRANSPORTE (TR)', [['TR.0100', 'TR.0100 PLANIFICACIÓN DEL TRANSPORTE'], ['TR.0101', 'TR.0101 MULTIMODAL'], ['TR.0102', 'TR.0102 PLANES REGIONALES'], ['TR.0103', 'TR.0103 TRANSPORTE URBANO'], ['TR.0104', 'TR.0104 TRAFICO'], ['TR.0105', 'TR.0105 ESTUDIOS PEATONALES'], ['TR.0106', 'TR.0106 ENCUESTAS Y CONTEOS'], ['TR.0200', 'TR.0200 MARÍTIMOS'], ['TR.0201', 'TR.0201 OPERACIONES MARÍTIMAS'], ['TR.0202', 'TR.0202 COSTOS Y TARIFAS MARÍTIMAS'], ['TR.203', 'TR.203 ESTUDIOS HIDROGRÁFICOS Y NÁUTICOS'], ['TR.0204', 'TR.0204 INFRAESTRUCTURA MARÍTIMA Y PORTUARIA'], ['TR.0300', 'TR.0300 AÉREO'], ['TR.0301', 'TR..0301 INFRAESTRUCTURA DE AEROPUERTOS'], ['TR.0302', 'TR.0302 EQUIPAMIENTO AEROPORTUARIO'], ['TR.0303', 'TR.0303 COSTOS Y TARIFAS AÉREAS'], ['TR.0400', 'TR.0400 FERROVIARIO'], ['TR.0401', 'TR.0401 OPERACIONES Y CARGA DE PASAJEROS'], ['TR.0402', 'TR.0402 INFRAESTRUCTURA FERROVIARIA'], ['TR.0403', 'TR.0403 COSTOS Y TARIFAS FERROVIARIOS'], ['TR.0500', 'TR.0500 PÚBLICO'], ['TR.0501', 'TR.0501 PLANIFICACIÓN DE TRANSPORTE PÚBLICO'], ['TR.0502', 'TR.0502 TERMINALES DE TRANSPORTE PÚBLICO'], ['TR.0503', 'TR.0503 COSTOS Y TARIFAS DE TRANSPORTE PÚBLICO'], ['TR.0600', 'TR.0600 CARGA'], ['TR.0700', 'TR.0700 INFRAESTRUCTURA VIAL'], ['TR.0701', 'TR.0701 CARRETERAS Y AUTOPISTAS'], ['TR.0702', 'TR.0702 VÍAS URBANAS'], ['TR.0703', 'TR.0703 CAMINOS RURALES'], ['TR.0704', 'TR.0704 PUENTES'], ['TR.0705', 'TR.0705 TÚNELES'], ['TR.0706', 'TR.0706 PAVIMENTOS'], ['TR.0800', 'TR.0800 CAPACITACIÓN EN TRANSPORTE'], ['TR.0900', 'TR.0900 OTROS']]],
    ['turismo', 'TURISMO (TU)', [['TU.0100', 'TU.0100 ESTUDIOS BÁSICOS O GENERALES'], ['TU.0200', 'TU.0200 PLANIFICACIÓN TURÍSTICA'], ['TU.0300', 'TU.0300 HOSPEDERÍA'], ['TU.0400', 'TU.0400 PARQUES NACIONALES'], ['TU.0500', 'TU.0500 CONSERVACIÓN HISTÓRICA CULTURAL'], ['TU.0600', 'TU.0600 SERVICIOS:RESTAURANTES,PARADORES'], ['TU.0700', 'TU.0700 MUSEOS'], ['TU.0800', 'TU.0800 MALECONES'], ['TU.0900', 'TU.0900 CORREDORES Y RUTAS TURÍSTICA'], ['TU.0100', 'TU.0100 TURICENTROS'], ['TU.1100', 'TU.1100 CAPACITACIÓN EN TURISMO'], ['TU.1200', 'TU.1200 ECOTURISMO'], ['TU.1300', 'TU.1300 OTROS']]]
  ];
  F[118] = {
    titulo: 'Inscripción',
    subtitulo: 'Datos de la empresa consultora',
    campos: [
      { tipo: 'texto', nombre: 'nombre_empresa', etiqueta: 'Nombre', max: 150 },
      { tipo: 'texto', nombre: 'siglas_abreviaturas', etiqueta: 'Siglas o abreviatura', max: 30, opcional: true, media: true },
      { tipo: 'lista', nombre: 'nacionalidad', etiqueta: 'País de nacimiento', opciones: PAISES_MUNDO, media: true },
      { tipo: 'texto', nombre: 'direccion_principal', etiqueta: 'Dirección principal', max: 200 },
      { tipo: 'texto', nombre: 'correo_empresa', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { ...TELEFONO, nombre: 'telefono_empresa', etiqueta: 'Teléfono', media: true },
      { tipo: 'texto', nombre: 'fecha_de_constitucion', etiqueta: 'Fecha de constitución', ...FECHA_DMA, media: true },
      { tipo: 'opciones', nombre: 'estado_de_enscripcion', etiqueta: 'Estado de inscripción en el Registro Único de Proveedores del Estado (RUPES)', opciones: [
        { valor: 'inscrito', texto: 'Inscrito', icono: 'ph-check' }, { valor: 'en_proceso', texto: 'En proceso', icono: 'ph-clock' }
      ] },
      { tipo: 'seccion', titulo: 'Representante legal' },
      { tipo: 'texto', nombre: 'nombre_legal', etiqueta: 'Nombre', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
      { ...TELEFONO, nombre: 'telefono_legal', etiqueta: 'Teléfono', media: true },
      { tipo: 'texto', nombre: 'correo_legal', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { tipo: 'seccion', titulo: 'Contacto legal' },
      { tipo: 'texto', nombre: 'nombre_contacto', etiqueta: 'Nombre', max: 100, patron: SOLO_LETRAS, mensaje: 'Usa solo letras' },
      { tipo: 'texto', nombre: 'correo_local', etiqueta: 'Correo electrónico', modo: 'email', media: true },
      { ...TELEFONO, nombre: 'telefono_local', etiqueta: 'Teléfono', media: true },
      { tipo: 'texto', nombre: 'direccion_local', etiqueta: 'Dirección local', max: 200 },
      { tipo: 'seccion', titulo: 'Códigos y campos de especialización' },
      { tipo: 'nota', estilo: 'info', lineas: ['Elige los que correspondan a tu empresa; en cada campo puedes marcar varios'] },
      ...ESPECIALIDADES_FOSEP.map(([nombre, etiqueta, lista]) => ({ tipo: 'opciones', nombre, etiqueta, multiple: true, columna: true, opcional: true, opciones: lista.map(([valor, texto]) => ({ valor, texto })) })),
      { tipo: 'seccion', titulo: 'Experiencia en estudios de preinversión' },
      { tipo: 'nota', estilo: 'info', lineas: ['Cuéntanos tu último estudio desarrollado; en el campo del final puedes escribir hasta 4 más'] },
      { tipo: 'texto', nombre: 'nombre_estudio', etiqueta: 'Nombre del estudio', max: 150 },
      { tipo: 'texto', nombre: 'monto_estudio', etiqueta: 'Monto del estudio (US$)', ...MONTO_AAC, placeholder: '15000.00', mensaje: 'Escribe solo el monto en números, por ejemplo 15000.00', media: true },
      { tipo: 'texto', nombre: 'ubicacion_estudio', etiqueta: 'Ubicación', max: 100, media: true },
      { tipo: 'texto', nombre: 'cliente_estudio', etiqueta: 'Cliente', max: 100 },
      { tipo: 'texto', nombre: 'descripcion_estudio', etiqueta: 'Breve descripción del estudio', max: 500 },
      { tipo: 'texto', nombre: 'otros_estudios', etiqueta: 'Otros estudios', ayuda: 'Hasta 4 más, con los mismos datos de cada uno', max: 1000, opcional: true }
    ],
    pasos: [ENVIAR]
  };

  /* ===== ISBM ===== */
  // 88 (trámite 434) y 89 (trámite 426), leídos el 4 de noviembre de 2026 solo hasta la declaración jurada y la cláusula
  // antisoborno: aceptarlas le toca al ciudadano. El 89 pide además el DUI del docente fallecido.
  const DECLARACION_ISBM = [
    { tipo: 'nota', estilo: 'aviso', titulo: 'Declaración jurada', lineas: [
      'Declaro bajo juramento que la información del formulario y de los documentos anexos es verdadera y cumple los requisitos legales. Asumo la responsabilidad administrativa, civil y penal por cualquier falsedad o alteración',
      'Acepto recibir notificaciones por correo electrónico y por SIMPLE.SV. Si se comprueban irregularidades, la autoridad puede anular de oficio el trámite y aplicar las sanciones que correspondan'
    ] },
    { tipo: 'nota', estilo: 'aviso', titulo: 'Cláusula antisoborno', lineas: [
      'Está prohibido ofrecer, prometer, pedir o entregar, directa o indirectamente, dinero, regalos, beneficios indebidos, favores u otro incentivo a servidores, empleados o funcionarios del ISBM, o a terceros relacionados, para acelerar, cambiar o influir en el resultado del trámite',
      'El ISBM tiene un Sistema de Gestión Antisoborno según la norma ISO 37001. Cualquier intento de soborno o práctica corrupta puede llevar al rechazo, la suspensión o la cancelación del trámite, además de las sanciones administrativas, civiles o penales',
      'Usar la plataforma implica aceptar este compromiso y actuar con integridad, transparencia y apego a la legalidad'
    ] }
  ];
  const ACEPTA_ISBM = { tipo: 'opciones', nombre: 'terminosCondiciones', etiqueta: '¿Aceptas la declaración jurada y la cláusula antisoborno?', marcado: true, opciones: [{ valor: 'si', texto: 'He leído y acepto los términos', icono: 'ph-seal-check' }] };
  const SIGUE_ISBM = { ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['Después de aceptar, el ISBM te pide los datos y los documentos del trámite'] }, ...ENVIAR.campos] };
  F[88] = {
    titulo: 'Declaración jurada',
    subtitulo: 'Ayuda económica por la adquisición de anteojos',
    icono: 'ph-eye',
    campos: [...DECLARACION_ISBM, ACEPTA_ISBM],
    pasos: [SIGUE_ISBM]
  };
  F[89] = {
    titulo: 'Declaración jurada',
    subtitulo: 'Ayuda económica para gastos funerarios',
    icono: 'ph-flower-lotus',
    campos: [
      ...DECLARACION_ISBM,
      { tipo: 'texto', nombre: 'duiDocente', etiqueta: 'DUI del docente fallecido', ...FORMATO_DUI },
      ACEPTA_ISBM
    ],
    pasos: [SIGUE_ISBM]
  };

  /* ===== Alcaldía Santa Ana Oeste ===== */
  // 103 (trámite 353), leído el 4 de noviembre de 2026 solo hasta la nota legal: aceptarla le toca al ciudadano
  F[103] = {
    titulo: 'Nota legal',
    subtitulo: 'Solvencia municipal y pago de impuestos municipales',
    icono: 'ph-bank',
    campos: [
      { tipo: 'nota', estilo: 'aviso', titulo: 'Nota legal', lineas: [
        'Si envías información falsa, cometes el delito de estafa informática (artículo 10 de la Ley Especial contra los Delitos Informáticos y Conexos) y el trámite se elimina automáticamente',
        'La alcaldía puede dar aviso a la Fiscalía General de la República para que determine los efectos legales'
      ] },
      { tipo: 'opciones', nombre: 'confirmacion', etiqueta: '¿Aceptas la nota legal?', marcado: true, opciones: [{ valor: 'acepto', texto: 'He leído y acepto los términos legales', icono: 'ph-handshake' }] }
    ],
    pasos: [{ ...ENVIAR, campos: [{ tipo: 'nota', estilo: 'info', lineas: ['Después de aceptar la nota legal, la alcaldía te pide los datos del trámite'] }, ...ENVIAR.campos] }]
  };

  window.FORMULARIOS_TRAMITES = F;
})();
