/* Sesión de la maqueta: la marca login.html al entrar y "Cerrar sesión" la borra.
   Con sesión, el encabezado del index muestra la foto del usuario; sin ella, no. */
(() => {
  const CLAVE = 'simple-sesion';
  const activa = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; } };
  if (activa()) document.documentElement.dataset.sesion = '1';
  document.addEventListener('click', e => {
    const enlace = e.target.closest('a.l2-menu-item');
    if (enlace && enlace.querySelector('.ph-sign-out')) { try { localStorage.removeItem(CLAVE); } catch (err) {} }
  });
})();
