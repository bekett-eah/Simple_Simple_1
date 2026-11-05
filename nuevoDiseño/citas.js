/* Trámites que se pueden hacer en persona con cita en la institución.
   El asistente de Indexlogin.html ofrece agendarla desde el chat. El formulario del trámite (formularios.js) conserva
   su propia opción de cita: un trámite que se agregue aquí también debe tenerla en su formulario.
   Clave: número del trámite en el catálogo.
   - sedes:   [{ nombre, detalle, horario }]; horario es opcional, para una sede que atiende en otro horario.
   - horario: { desde, hasta, cada } en horas 'HH:MM' y minutos por cita; se atiende de lunes a viernes.
              El asistente lo muestra como horario de atención y ofrece citas dentro de él.
   - llevar:  lo que la persona debe presentar (el pago, si tiene costo, lo agrega el asistente).
   Sedes, horario y requisitos son contenido de ejemplo, no oficial: reemplazar con los datos de cada institución. */
window.CITAS_TRAMITES = {
  99: {
    sedes: [
      { nombre: 'San Salvador', detalle: 'Oficina central' },
      { nombre: 'Santa Ana', detalle: 'Oficina regional de occidente' },
      { nombre: 'San Miguel', detalle: 'Oficina regional de oriente' }
    ],
    horario: { desde: '08:00', hasta: '15:00', cada: 30 },
    llevar: ['Tu DUI vigente, en original']
  }
};
