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
  solo mientras se cumpla (por ejemplo, la persona inscrita en una partida, salvo en la de defunción). */
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
      { tipo: 'nota', estilo: 'info', titulo: '¡Hola!', lineas: costo },
      { tipo: 'nota', estilo: 'aviso', titulo: terminosTitulo, lineas: terminos },
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

  // PNC: en Simple.sv el trámite está en mantenimiento (octubre de 2026) y solo se copió su primer paso;
  // la revisión y el pago son los del nuevo diseño
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
    pasos: [PAGO]
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
  // (no se aceptó en el portal: el paso que sigue es la etapa de pago). La ubicación en el mapa del portal no se copió.
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
  // de un centro educativo son el mismo trámite; se elige cuál en el cuarto paso. Copiado hasta los documentos del centro:
  // el portal no dice cuántos pasos quedan y, como no tiene pago, el "Siguiente" que sigue podría enviar la solicitud.
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
    ] }
  ];
  F[48] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'ampliacion' }, pasos: PASOS_MINEDUCYT_CENTROS };
  F[51] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'cambio_domicilio' }, pasos: PASOS_MINEDUCYT_CENTROS };
  F[54] = { ...MINEDUCYT_CENTROS, preseleccion: { tipo_tramite: 'creacion' }, pasos: PASOS_MINEDUCYT_CENTROS };

  F[49] = {
    titulo: 'Auténtica de documentos académicos',
    subtitulo: 'Lee la nota y confirma que estás de acuerdo con los requisitos',
    campos: [
      { tipo: 'nota', estilo: 'aviso', titulo: 'Importante', lineas: ['Los títulos de bachiller emitidos por el Ministerio de Educación, Ciencia y Tecnología a partir del año 2008 ya se encuentran debidamente autenticados en el Ministerio de Relaciones Exteriores de El Salvador y no requieren de documentos académicos adicionales'] },
      { tipo: 'opciones', nombre: 'declara_g3', etiqueta: '¿Estás de acuerdo con los requisitos del trámite?', multiple: true, marcado: true, opciones: [{ valor: 'si_g3', texto: 'Sí, estoy de acuerdo', icono: 'ph-handshake' }] }
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
    // Sin NIE, el portal busca a la persona por su nombre y el año de la prueba. Copiado hasta ahí: con esos datos ya puede
    // buscar la boleta, y el "Siguiente" que sigue podría terminar el trámite
    pasos: [
      { si: 'pregunta_nie_personal=no', titulo: 'Ingreso de datos', subtitulo: 'Te buscamos por tu nombre y el año en que hiciste la prueba', campos: [
        { tipo: 'texto', nombre: 'nombre_de_solicitante', etiqueta: 'Nombre completo', soloLectura: true },
        { tipo: 'texto', nombre: 'anio_prueba', etiqueta: 'Año en que hiciste la prueba', placeholder: 'Año', max: 4, patron: '[0-9]{4}', modo: 'numeric', mensaje: 'Escribe el año con 4 números' }
      ] }
    ]
  };

  F[52] = {
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
    ]
  };

  window.FORMULARIOS_TRAMITES = F;
})();
