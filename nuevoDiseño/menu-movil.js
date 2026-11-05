/* Menú del encabezado en pantallas chicas: el botón de hamburguesa abre y cierra el menú principal (.l2-nav).
   Uso: <button class="l2-menu-toggle" aria-controls="menu-principal" aria-expanded="false"> y <nav class="l2-nav" id="menu-principal">.
   Se cierra al elegir una opción, con Escape, al tocar fuera o al pasar a pantalla grande. */
(() => {
  const boton = document.querySelector('.l2-menu-toggle');
  const menu = document.getElementById('menu-principal');
  if (!boton || !menu) return;
  const icono = boton.querySelector('i');
  const escritorio = window.matchMedia('(min-width: 1000px)');

  function poner(abierto, devolverFoco) {
    menu.classList.toggle('abierto', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    boton.setAttribute('aria-label', abierto ? 'Cerrar el menú' : 'Abrir el menú');
    icono.className = abierto ? 'ph ph-x' : 'ph ph-list';
    if (!abierto && devolverFoco) boton.focus();
  }

  boton.addEventListener('click', () => poner(!menu.classList.contains('abierto')));
  menu.addEventListener('click', e => { if (e.target.closest('a, button')) poner(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('abierto')) poner(false, true); });
  document.addEventListener('click', e => { if (!e.target.closest('.l2-nav, .l2-menu-toggle')) poner(false); });
  escritorio.addEventListener('change', e => { if (e.matches) poner(false); });
})();
