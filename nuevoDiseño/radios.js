/* Radio buttons que se pueden desmarcar: otro clic (o la barra espaciadora) sobre la opción elegida la quita.
   Lo usan tramite.html (preguntas de opciones) y whatsapp.html (hoja de opciones).
   Quitar la opción no se salta la validación: si la pregunta es obligatoria, el formulario la vuelve a pedir
   ("Elige una opción.") y en WhatsApp "Enviar" queda deshabilitado hasta que se elija otra. */
(() => {
  // Se avisa del cambio para que el formulario actualice lo que depende de la respuesta (campos condicionales, pasos, botón Enviar)
  const desmarcar = radio => {
    radio.checked = false;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // El radio que recibe el clic: el mismo input o el de su etiqueta
  const radioDe = nodo => {
    const control = nodo.closest?.('label')?.control || nodo;
    return control.type === 'radio' ? control : null;
  };

  // Clic o toque: cuando llega el clic el navegador ya marcó la opción, así que se anota antes si ya estaba marcada
  let previo = null;
  document.addEventListener('pointerdown', e => {
    const radio = radioDe(e.target);
    previo = radio && { radio, marcado: radio.checked };
  }, true);
  document.addEventListener('click', e => {
    const radio = e.target;
    if (radio.type !== 'radio') return;
    const estaba = previo?.radio === radio && previo.marcado;
    previo = null;
    // Se desmarca cuando el navegador termina con el clic
    if (estaba) setTimeout(() => desmarcar(radio));
  }, true);

  // Barra espaciadora sobre la opción ya elegida: el navegador no hace nada, así que se quita aquí.
  // Las flechas siguen cambiando de opción como siempre.
  document.addEventListener('keydown', e => {
    previo = null;
    const radio = e.target;
    if (e.key !== ' ' || radio.type !== 'radio') return;
    // Con la tecla presionada solo cuenta la primera pulsación
    if (e.repeat) { e.preventDefault(); return; }
    if (!radio.checked) return;
    e.preventDefault();
    desmarcar(radio);
  }, true);
})();
