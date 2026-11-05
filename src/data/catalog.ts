/**
 * Catálogo normalizado para la experiencia ciudadana "Simple es Simple"
 * 8 Trámites prioritarios para la primera versión + categorías por situación de vida
 */

export interface TramiteFrecuente {
  id: string;
  nombreSimple: string;
  nombreOficial: string;
  institucion: string;
  institucionSiglas: string;
  categoriaSituacion: 'documentos' | 'empleo' | 'estudio' | 'vivienda' | 'familia';
  icono: string;
  costoTexto: string;
  costoMonto: number;
  esGratuito: boolean;
  tiempoEntrega: string;
  modalidad: '100% en línea' | 'En línea con cita presencial';
  quienAplica: 'Para mí o para un menor a mi cargo' | 'Solo persona titular' | 'Representante legal';
  descripcionCorta: string;
  requisitosClave: string[];
  nivelWhatsApp: 'verde' | 'amarillo' | 'rojo';
  urlOficial: string;
}

export interface SituacionVida {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  color: string;
  badge: string;
  tramitesRelacionados: string[];
}

export const SITUACIONES_VIDA: SituacionVida[] = [
  {
    id: 'documentos',
    titulo: 'Renovar documentos personales',
    subtitulo: 'Partidas, DUI, constancias de identidad sin filas',
    icono: 'identification-card',
    color: '#0A2540',
    badge: 'Los más pedidos',
    tramitesRelacionados: ['partidas', 'dui', 'migratoria']
  },
  {
    id: 'empleo',
    titulo: 'Papeles para entrar a trabajar',
    subtitulo: 'Solvencia policial y antecedentes penales en minutos',
    icono: 'briefcase',
    color: '#0066FF',
    badge: 'Entrega rápida',
    tramitesRelacionados: ['penales', 'policiales']
  },
  {
    id: 'estudios',
    titulo: 'Estudios, notas y títulos',
    subtitulo: 'Títulos de bachiller, notas oficiales y boleta PAES / AVANZO',
    icono: 'graduation-cap',
    color: '#059669',
    badge: 'Digital oficial',
    tramitesRelacionados: ['titulo', 'notas']
  },
  {
    id: 'vivienda',
    titulo: 'Agua, recibos y mi casa',
    subtitulo: 'Solvencias de ANDA, cambio de nombre de recibo y pagos',
    icono: 'house-line',
    color: '#D97706',
    badge: 'Hogar',
    tramitesRelacionados: ['solvencia-anda', 'titular-anda']
  },
  {
    id: 'familia',
    titulo: 'Trámites para mis hijos y familia',
    subtitulo: 'Pensión alimenticia, certificaciones y protección',
    icono: 'users-three',
    color: '#7C3AED',
    badge: 'Familia',
    tramitesRelacionados: ['partidas']
  }
];

export const TRAMITES_CATALOGO: TramiteFrecuente[] = [
  {
    id: 'penales',
    nombreSimple: 'Antecedentes Penales',
    nombreOficial: 'Emisión de certificación de antecedentes penales',
    institucion: 'Ministerio de Justicia y Seguridad Pública',
    institucionSiglas: 'MJSP',
    categoriaSituacion: 'empleo',
    icono: 'shield-check',
    costoTexto: '$3.00 USD',
    costoMonto: 3.00,
    esGratuito: false,
    tiempoEntrega: 'El mismo día (digital)',
    modalidad: '100% en línea',
    quienAplica: 'Solo persona titular',
    descripcionCorta: 'Comprueba que no tienes registros penales vigentes. Es el documento indispensable solicitado para nuevos empleos.',
    requisitosClave: [
      'Tu número de DUI vigente',
      'Tarjeta de débito o crédito para pagar $3.00',
      'Un correo o teléfono para recibir el aviso'
    ],
    nivelWhatsApp: 'rojo',
    urlOficial: 'https://antecedentes.seguridad.gob.sv/servicios'
  },
  {
    id: 'policiales',
    nombreSimple: 'Solvencia de la Policía',
    nombreOficial: 'Constancia de antecedentes policiales',
    institucion: 'Policía Nacional Civil de El Salvador',
    institucionSiglas: 'PNC',
    categoriaSituacion: 'empleo',
    icono: 'shield-warning',
    costoTexto: '$3.50 USD',
    costoMonto: 3.50,
    esGratuito: false,
    tiempoEntrega: '24 a 48 horas hábiles',
    modalidad: '100% en línea',
    quienAplica: 'Solo persona titular',
    descripcionCorta: 'Constancia oficial de la PNC que certifica que no posees órdenes pendientes ante la corporación policial.',
    requisitosClave: [
      'DUI vigente de la persona solicitante',
      'Pago en línea de $3.50',
      'Foto clara de tu DUI si el sistema lo requiere'
    ],
    nivelWhatsApp: 'rojo',
    urlOficial: 'https://simple.sv/tramite/constancia-de-antecedentes-policiales'
  },
  {
    id: 'partidas',
    nombreSimple: 'Partidas (Nacimiento, Matrimonio o Defunción)',
    nombreOficial: 'Certificación de partidas del Registro del Estado Familiar',
    institucion: 'Registro Nacional de las Personas Naturales',
    institucionSiglas: 'RNPN',
    categoriaSituacion: 'documentos',
    icono: 'scroll',
    costoTexto: 'Gratis o según alcaldía de origen',
    costoMonto: 0,
    esGratuito: true,
    tiempoEntrega: '1 a 3 días hábiles',
    modalidad: '100% en línea',
    quienAplica: 'Para mí o para un menor a mi cargo',
    descripcionCorta: 'Copia certificada con validez legal de tu partida de nacimiento o la de tus hijos menores de edad.',
    requisitosClave: [
      'Número de DUI de quien solicita (adulto responsable)',
      'Datos de la persona de la partida (Nombre completo y fecha)',
      'Municipio donde fue asentada'
    ],
    nivelWhatsApp: 'rojo',
    urlOficial: 'https://simple.sv/tramite/certificacion-de-partidas'
  },
  {
    id: 'migratoria',
    nombreSimple: 'Permiso / Constancia para salir del país',
    nombreOficial: 'Constancia de no restricción migratoria',
    institucion: 'Dirección General de Migración y Extranjería',
    institucionSiglas: 'DGME',
    categoriaSituacion: 'documentos',
    icono: 'airplane-takeoff',
    costoTexto: '$10.00 USD',
    costoMonto: 10.00,
    esGratuito: false,
    tiempoEntrega: 'Inmediata tras validación',
    modalidad: '100% en línea',
    quienAplica: 'Para mí o para un menor a mi cargo',
    descripcionCorta: 'Verifica y certifica que no tienes impedimento legal para viajar fuera del territorio de El Salvador.',
    requisitosClave: [
      'DUI vigente o Pasaporte',
      'Pago de arancel migratorio en pasarela segura',
      'Para menores: autorización de ambos padres'
    ],
    nivelWhatsApp: 'amarillo',
    urlOficial: 'https://simple.sv/tramite/constancia-de-no-restriccion-migratoria'
  },
  {
    id: 'solvencia-anda',
    nombreSimple: 'Solvencia de Agua de ANDA',
    nombreOficial: 'Solvencia de cuenta de agua potable y/o alcantarillados',
    institucion: 'Administración Nacional de Acueductos y Alcantarillados',
    institucionSiglas: 'ANDA',
    categoriaSituacion: 'vivienda',
    icono: 'drop',
    costoTexto: 'Gratuita',
    costoMonto: 0,
    esGratuito: true,
    tiempoEntrega: 'Descarga inmediata',
    modalidad: '100% en línea',
    quienAplica: 'Solo persona titular',
    descripcionCorta: 'Comprueba que tu cuenta de agua no tiene saldos pendientes. Necesaria para trámites de compraventa o alquiler.',
    requisitosClave: [
      'Número de cuenta o NIS del recibo de agua',
      'DUI de quien figura como titular',
      'Cuenta con saldo al día'
    ],
    nivelWhatsApp: 'verde',
    urlOficial: 'https://simple.sv/tramite/solvencia-de-cuenta-de-agua-potable-yo-alcantarillados'
  },
  {
    id: 'titular-anda',
    nombreSimple: 'Cambiar el nombre del recibo de agua',
    nombreOficial: 'Cambio de nombre del titular de la cuenta',
    institucion: 'Administración Nacional de Acueductos y Alcantarillados',
    institucionSiglas: 'ANDA',
    categoriaSituacion: 'vivienda',
    icono: 'arrows-clockwise',
    costoTexto: '$2.26 USD (verificado)',
    costoMonto: 2.26,
    esGratuito: false,
    tiempoEntrega: '3 a 5 días hábiles',
    modalidad: 'En línea con cita presencial',
    quienAplica: 'Para mí o para un menor a mi cargo',
    descripcionCorta: 'Actualiza el nombre que aparece en tu factura cuando compraste una casa o cambiaste de propietario.',
    requisitosClave: [
      'Número de cuenta de ANDA',
      'DUI del nuevo propietario',
      'Escritura o documento de compraventa debidamente registrado'
    ],
    nivelWhatsApp: 'verde',
    urlOficial: 'https://simple.sv/tramite/cambio-de-nombre-del-titular-de-la-cuenta'
  },
  {
    id: 'titulo',
    nombreSimple: 'Título de Bachiller (Copia oficial)',
    nombreOficial: 'Certificación de registro de título de educación media',
    institucion: 'Ministerio de Educación, Ciencia y Tecnología',
    institucionSiglas: 'MINEDUCYT',
    categoriaSituacion: 'estudio',
    icono: 'certificate',
    costoTexto: 'Gratuito',
    costoMonto: 0,
    esGratuito: true,
    tiempoEntrega: '2 a 4 días hábiles',
    modalidad: '100% en línea',
    quienAplica: 'Para mí o para un menor a mi cargo',
    descripcionCorta: 'Certificación con firma electrónica oficial del registro de tu título de bachiller, válida para universidades o empleo.',
    requisitosClave: [
      'Número de DUI de la persona graduada',
      'Nombre del centro educativo o instituto donde te graduaste',
      'Año aproximado de graduación'
    ],
    nivelWhatsApp: 'verde',
    urlOficial: 'https://simple.sv/tramite/certificacion-de-registro-de-titulo-de-educacion-media'
  },
  {
    id: 'notas',
    nombreSimple: 'Certificado de Notas Escolares',
    nombreOficial: 'Certificación de registro de notas de educación básica y media',
    institucion: 'Ministerio de Educación, Ciencia y Tecnología',
    institucionSiglas: 'MINEDUCYT',
    categoriaSituacion: 'estudio',
    icono: 'files',
    costoTexto: 'Gratuito',
    costoMonto: 0,
    esGratuito: true,
    tiempoEntrega: '1 a 3 días hábiles',
    modalidad: '100% en línea',
    quienAplica: 'Para mí o para un menor a mi cargo',
    descripcionCorta: 'Boleta oficial de calificaciones de primaria, secundaria o bachillerato requerida para traslados de colegio o becas.',
    requisitosClave: [
      'NIE (Número de Identificación Estudiantil) o DUI',
      'Nombre de la escuela o colegio',
      'Grado cursado'
    ],
    nivelWhatsApp: 'verde',
    urlOficial: 'https://simple.sv/tramite/certificacion-de-registro-de-notas-de-educacion-basica-y-media'
  }
];
