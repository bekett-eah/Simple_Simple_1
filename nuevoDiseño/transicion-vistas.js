/* Transición entre vistas (Trámites, Mis documentos, el trámite y Contáctanos).
   Al salir, el banner [data-transicion-banner] crece hasta cubrir la pantalla y muestra el nombre del destino.
   Al entrar (la URL llega con #transicion), la pantalla azul se encoge hasta el banner de la vista nueva.
   Uso: <a href="..." data-transicion="Nombre destino" data-transicion-icono="ph-icono">.
   Con data-transicion-rapida la animación dura la mitad (se usa al entrar a un trámite).
   Se carga en <head> sin defer para tapar la página desde el primer pintado. */
(() => {
  const MARCA = '#transicion';
  const MARCA_RAPIDA = '#transicion-rapida';
  const VELOCIDAD_RAPIDA = 0.5;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raiz = document.documentElement;
  const entrando = location.hash === MARCA || location.hash === MARCA_RAPIDA;
  // t: multiplicador de tiempo (1 = normal, 0.5 = el doble de rápida)
  let t = location.hash === MARCA_RAPIDA ? VELOCIDAD_RAPIDA : 1;
  let animaciones = [];
  let navegando = false;

  const estilos = document.createElement('style');
  estilos.textContent = `
    html.tv-entrando::after { content: ''; position: fixed; inset: 0; z-index: 9998; background: linear-gradient(135deg, var(--color-navy-deep, #1C1E4D), var(--color-navy-deep, #1C1E4D)); }
    .tv-portal { position: fixed !important; z-index: 9999; margin: 0 !important; overflow: hidden; pointer-events: none; }
    .tv-etiqueta { position: absolute; left: 50%; top: 50%; z-index: 3; display: flex; align-items: center; gap: 14px; color: #FFFFFF; font-family: var(--font-family, sans-serif); width: max-content; max-width: min(88vw, 900px); font-size: clamp(26px, 4vw, 44px); font-weight: 800; line-height: 1.15; text-align: center; justify-content: center; transform: translate(-50%, -50%); text-shadow: 0 2px 24px rgba(10, 42, 140, 0.6); }
    .tv-etiqueta i { display: flex; align-items: center; justify-content: center; width: 1.6em; height: 1.6em; border-radius: 0.45em; background: #FFFFFF; color: var(--color-navy-deep, #1C1E4D); font-size: 0.8em; text-shadow: none; }
  `;
  document.head.appendChild(estilos);
  if (entrando && !sinMovimiento) raiz.classList.add('tv-entrando');

  const enPx = r => ({ top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  const PANTALLA = { top: '0px', left: '0px', width: '100vw', height: '100vh' };

  // Copia del banner (con sus líneas animadas) que se estira sobre la página
  function crearPortal(banner, posicion, texto, icono) {
    const portal = banner.cloneNode(true);
    portal.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    portal.removeAttribute('id');
    portal.removeAttribute('data-transicion-banner');
    portal.classList.add('tv-portal');
    portal.setAttribute('aria-hidden', 'true');
    Object.assign(portal.style, posicion);
    const etiqueta = document.createElement('div');
    etiqueta.className = 'tv-etiqueta';
    if (icono) {
      const i = document.createElement('i');
      i.className = `ph ${icono}`;
      etiqueta.append(i);
    }
    etiqueta.append(texto || '');
    portal.append(etiqueta);
    document.body.append(portal);
    const piezas = [...portal.children].filter(n => n !== etiqueta && n.tagName.toLowerCase() !== 'svg');
    return { portal, etiqueta, piezas };
  }

  // Todo lo que acompaña al banner: hermanos dentro de su contenedor y lo marcado con [data-transicion-contenido].
  // Si el banner va junto a la card de la otra vista (.l2-vistas, modulos.css), esa card también se mueve.
  function contenidoDe(banner) {
    const grupo = banner.closest('.l2-vistas');
    const base = grupo || banner;
    return [...base.parentElement.children].filter(n => n !== base)
      .concat(grupo ? [...grupo.children].filter(n => n !== banner) : [])
      .concat([...document.querySelectorAll('[data-transicion-contenido]')]);
  }

  function animar(el, cuadros, opciones) {
    const a = el.animate(cuadros, opciones);
    animaciones.push(a);
    return a;
  }

  function salir(destino, texto, icono, rapida) {
    t = rapida ? VELOCIDAD_RAPIDA : 1;
    const banner = document.querySelector('[data-transicion-banner]');
    if (!banner || !banner.animate) { location.href = destino; return; }
    const r = banner.getBoundingClientRect();
    const radio = getComputedStyle(banner).borderRadius;
    const { portal, etiqueta, piezas } = crearPortal(banner, enPx(r), texto, icono);
    const DURACION = 700 * t;

    animar(portal, [{ ...enPx(r), borderRadius: radio }, { ...PANTALLA, borderRadius: '0px' }],
      { duration: DURACION, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'forwards' });
    piezas.forEach(p => animar(p, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 * t, fill: 'forwards' }));
    animar(etiqueta, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }],
      { duration: 320 * t, delay: 380 * t, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
    contenidoDe(banner).forEach((el, i) => animar(el,
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px) scale(0.98)' }],
      { duration: 350 * t, delay: i * 40 * t, easing: 'ease-in', fill: 'forwards' }));

    setTimeout(() => { location.href = destino.split('#')[0] + (rapida ? MARCA_RAPIDA : MARCA); }, DURACION + 80 * t);
  }

  async function entrar() {
    history.replaceState(null, '', location.pathname + location.search);
    if (sinMovimiento) return;
    const banner = document.querySelector('[data-transicion-banner]');
    if (!banner || !banner.animate) { raiz.classList.remove('tv-entrando'); return; }
    // Espera la fuente para medir el banner con su alto final (máx. 300 ms)
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 300))]);

    const r = banner.getBoundingClientRect();
    const radio = getComputedStyle(banner).borderRadius;
    const { portal, etiqueta, piezas } = crearPortal(banner, PANTALLA, banner.dataset.transicionBanner, banner.dataset.transicionIcono);
    raiz.classList.remove('tv-entrando');

    animar(etiqueta, [{ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(0.94)' }],
      { duration: 260 * t, delay: 160 * t, easing: 'ease-in', fill: 'both' });
    piezas.forEach(p => animar(p, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320 * t, delay: 620 * t, easing: 'ease-out', fill: 'both' }));
    const encoge = animar(portal, [{ ...PANTALLA, borderRadius: '0px' }, { ...enPx(r), borderRadius: radio }],
      { duration: 760 * t, delay: 200 * t, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
    contenidoDe(banner).forEach((el, i) => animar(el,
      [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
      { duration: 450 * t, delay: (620 + i * 70) * t, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }));

    // Respaldo por si la promesa de la animación no llega a resolverse
    const quitar = () => portal.remove();
    encoge.finished.then(quitar, quitar);
    setTimeout(quitar, (200 + 760) * t + 300);
  }

  // Al volver con el botón Atrás, el navegador puede restaurar la página a mitad de la salida
  function limpiar() {
    animaciones.forEach(a => a.cancel());
    animaciones = [];
    document.querySelectorAll('.tv-portal').forEach(p => p.remove());
    raiz.classList.remove('tv-entrando');
    navegando = false;
  }
  window.addEventListener('pageshow', e => { if (e.persisted) limpiar(); });

  document.addEventListener('click', e => {
    const enlace = e.target.closest('a[data-transicion]');
    if (!enlace || sinMovimiento || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || enlace.target === '_blank') return;
    e.preventDefault();
    if (navegando) return;
    navegando = true;
    salir(enlace.href, enlace.dataset.transicion, enlace.dataset.transicionIcono, 'transicionRapida' in enlace.dataset);
  });

  if (entrando) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entrar);
    else entrar();
  }
})();
