/* Datos de quien inició sesión (maqueta: la cuenta de prueba de Identidad Digital, la misma del login y de Mi cuenta).
   Clave: nombre del campo en formularios.js. tramite.html llena con estos datos los campos que piden información
   de la persona que hace el trámite; los de solo lectura quedan bloqueados y los demás se pueden corregir.
   Los datos del registro (nacimiento, vencimiento del DUI, estado familiar, profesión, padres) son inventados para la
   maqueta. La fecha de nacimiento también va por partes para la partida de nacimiento (dia_, mes_, anio_partida).
   El asistente de Indexlogin.html usa telefono y correo_notificaciones para los avisos de trámite finalizado. */
window.CIUDADANO = {
  telefono: '+503 7000-1234',
  telefono_de_contacto: '+503 7000-1234',
  numero_de_documento: '06245097-8',
  dui_inscrito: '06245097-8',
  dui_titular: '06245097-8',
  fecha_de_vencimiento_del_dui: '14/03/2030',
  nombres: 'María Fernanda',
  apellidos: 'López García',
  primer_nombre: 'María',
  segundo_nombre: 'Fernanda',
  primer_apellido: 'López',
  segundo_apellido: 'García',
  nombre_de_solicitante: 'María Fernanda López García',
  fecha_de_nacimiento: '14/03/1992',
  dia_partida: '14',
  mes_partida: '03',
  anio_partida: '1992',
  edad: '34 años',
  genero: 'Femenino',
  estado_familiar: 'Soltera',
  profesion_u_oficio: 'Licenciada en Administración de Empresas',
  nombre_de_la_madre: 'Ana Patricia García de López',
  nombre_del_padre: 'José Roberto López Martínez',
  correo_notificaciones: 'maria.fernanda@example.com',
  confirmar_correo: 'maria.fernanda@example.com',
  correo_de_solicitante: 'maria.fernanda@example.com'
};
