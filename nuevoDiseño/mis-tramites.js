/* Trámites del usuario que se muestran en Mis documentos (mis-tramites.html).
   numero: número del trámite en el catálogo (catalogo-landing.js); de ahí salen nombre, institución, categoría e imagen.
   estado: proceso | finalizado. Solo los finalizados tienen documento para descargar o apostillar.
   apostilla: lista | solicitada (opcional, solo finalizados). Los que la tienen salen en la pestaña Apostillados.
   Los finalizados son los documentos emitidos del portal actual; los que siguen en proceso son de ejemplo.
   A estos se suman las solicitudes hechas por WhatsApp en el navegador (localStorage 'simple-tramites-nuevos',
   las guarda whatsapp.html), con canal: 'whatsapp'. El chat de WhatsApp también usa esta lista para responder
   por los trámites en proceso. */
window.MIS_TRAMITES = [
  { id: '4391207', numero: 64, estado: 'proceso', fecha: '2026-10-20T08:15' },
  { id: '4390118', numero: 74, estado: 'proceso', fecha: '2026-10-19T16:40' },
  { id: '4321586', numero: 73, estado: 'finalizado', fecha: '2026-06-18T14:22' },
  { id: '1906423', numero: 99, estado: 'finalizado', fecha: '2026-03-10T10:41', apostilla: 'lista' },
  { id: '4266755', numero: 100, estado: 'finalizado', fecha: '2026-03-09T09:29', apostilla: 'solicitada' },
  { id: '3857107', numero: 73, estado: 'finalizado', fecha: '2025-12-05T11:31', apostilla: 'lista' },
  { id: '1642966', numero: 99, estado: 'finalizado', fecha: '2025-11-10T13:39' },
  { id: '3370623', numero: 100, estado: 'finalizado', fecha: '2025-07-30T13:14' },
  { id: '3369569', numero: 73, estado: 'finalizado', fecha: '2025-07-30T12:16' },
  { id: '1065244', numero: 99, estado: 'finalizado', fecha: '2024-11-22T13:12' },
  { id: '2648832', numero: 100, estado: 'finalizado', fecha: '2024-11-21T17:38' }
];

// Cómo se muestra cada estado (etiqueta e icono)
window.ESTADOS_TRAMITE = {
  proceso: { texto: 'En proceso', icono: 'ph-hourglass-medium' },
  finalizado: { texto: 'Finalizado', icono: 'ph-check-circle' }
};
