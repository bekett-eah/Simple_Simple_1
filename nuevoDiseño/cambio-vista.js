/* Cambio entre Trámites y Mis documentos: las dos cards del banner (modulos.css), siempre en el mismo orden.
   Al tocar la card quieta, crece en su lugar mientras la actual se encoge: la que crece toma el degradado azul animado
   con el título y el texto de la otra vista, y la que se encoge pasa a azul oscuro, como card quieta.
   Lo de abajo se desvanece y después se abre la otra vista.
   Al entrar (la URL llega con #vista), las cards ya se ven como terminó el cambio: solo aparece lo de abajo.
   Uso: <a class="l2-vista" href="..." data-cambio-vista data-vista-titulo="..." data-vista-texto="..."> y, en el banner,
   data-transicion-banner, data-transicion-icono, data-vista-corto y data-vista-flecha (cómo es su card quieta).
   Se carga en <head> sin defer, como transicion-vistas.js, para ocultar lo de abajo desde el primer pintado. */
(() => {
  const MARCA = '#vista';
  const DURACION = 620;
  const CURVA = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raiz = document.documentElement;
  const entrando = location.hash === MARCA;
  let animaciones = [];
  let navegando = false;

  if (entrando && !sinMovimiento) {
    raiz.classList.add('cv-entrando');
    // Respaldo: si algo falla, el contenido no se queda oculto
    setTimeout(() => raiz.classList.remove('cv-entrando'), 1500);
  }

  function animar(el, cuadros, opciones) {
    const a = el.animate(cuadros, opciones);
    animaciones.push(a);
    return a;
  }

  // Alto que tendría un elemento con ese ancho, sin estirarse (se mide una copia invisible)
  function altoNatural(el, ancho) {
    const copia = el.cloneNode(true);
    Object.assign(copia.style, { position: 'absolute', top: '0px', left: '-10000px', width: `${ancho}px`, height: 'auto', visibility: 'hidden' });
    document.body.append(copia);
    const alto = copia.offsetHeight;
    copia.remove();
    return alto;
  }

  // Lo que acompaña a las cards: lo que va debajo en la misma sección y lo marcado con [data-transicion-contenido]
  function contenido(grupo) {
    return [...grupo.parentElement.children].filter(n => n !== grupo)
      .concat([...document.querySelectorAll('[data-transicion-contenido]')]);
  }

  function sinIds(capa) {
    capa.removeAttribute('id');
    capa.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    return capa;
  }

  // La vista actual como card quieta: la card quieta con el icono, el nombre y la flecha que indica el banner
  function comoQuieta(banner, quieta) {
    const capa = document.createElement('div');
    capa.className = quieta.className;
    capa.innerHTML = quieta.innerHTML;
    capa.querySelector('.l2-vista-icono i').className = `ph ${banner.dataset.transicionIcono}`;
    capa.querySelector('.l2-vista-texto strong').textContent = banner.dataset.transicionBanner || '';
    capa.querySelector('.l2-vista-texto small').textContent = banner.dataset.vistaCorto || '';
    capa.querySelector('.l2-vista-flecha').className = `ph ${banner.dataset.vistaFlecha} l2-vista-flecha`;
    return sinIds(capa);
  }

  // La otra vista como banner: una copia del banner con su título y su texto
  function comoBanner(banner, enlace) {
    const capa = sinIds(banner.cloneNode(true));
    capa.removeAttribute('data-transicion-banner');
    capa.classList.remove('l2-en-pausa');
    capa.querySelector('h1').textContent = enlace.dataset.vistaTitulo || '';
    capa.querySelector('.l2-banner-texto p').textContent = enlace.dataset.vistaTexto || '';
    return capa;
  }

  // Las líneas de una capa ya tienen su tamaño final, pegadas a un lado: no se estiran mientras la card cambia
  function fijarLineas(capa, { ancho, alto }, lado) {
    const borde = 2 * parseFloat(getComputedStyle(capa).borderTopWidth || 0);
    Object.assign(capa.querySelector('svg').style,
      { inset: 'auto', top: '0px', [lado]: '0px', width: `${ancho - borde}px`, height: `${alto - borde}px` });
  }

  function salir(enlace) {
    const grupo = enlace.closest('.l2-vistas');
    const actual = grupo && grupo.querySelector('.l2-catalog-intro');
    if (!actual || !actual.animate) { location.href = enlace.href; return; }
    const ra = actual.getBoundingClientRect();
    const rq = enlace.getBoundingClientRect();
    const estiloEnlace = getComputedStyle(enlace);
    const sombraBanner = getComputedStyle(actual).boxShadow;
    const salientes = [...actual.children, ...enlace.children];
    const quieta = comoQuieta(actual, enlace);
    const banner = comoBanner(actual, enlace);

    // Tamaños finales: la card tocada queda del tamaño de la actual y la actual, del de la quieta.
    // Lado a lado cambian los anchos y comparten el alto (el de la más alta); una encima de otra, cambian los altos.
    const ladoALado = actual.offsetTop === enlace.offsetTop;
    let hasta;
    if (ladoALado) {
      const alto = Math.max(altoNatural(banner, ra.width), altoNatural(quieta, rq.width));
      hasta = { actual: { ancho: rq.width, alto }, enlace: { ancho: ra.width, alto } };
    } else {
      hasta = { actual: { ancho: ra.width, alto: altoNatural(quieta, ra.width) }, enlace: { ancho: rq.width, alto: altoNatural(banner, rq.width) } };
    }
    const tamano = ({ ancho, alto }) => ladoALado
      ? { flexGrow: 0, flexShrink: 0, flexBasis: `${ancho}px`, height: `${alto}px` }
      : { flexGrow: 0, flexShrink: 0, flexBasis: `${alto}px` };

    actual.append(quieta);
    enlace.append(banner);
    const sombraQuieta = getComputedStyle(quieta).boxShadow;
    [quieta, banner].forEach(capa => { capa.classList.add('cv-capa'); capa.setAttribute('aria-hidden', 'true'); });
    // Lado a lado, las líneas de la card quieta van a la derecha (donde brillan) y las del banner, al lado que no se mueve
    const primeroEsEnlace = grupo.firstElementChild === enlace;
    fijarLineas(quieta, hasta.actual, ladoALado ? 'right' : 'left');
    fijarLineas(banner, hasta.enlace, ladoALado && !primeroEsEnlace ? 'right' : 'left');
    // La otra vista se abre arriba del todo
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });

    // Las dos cards cambian de tamaño en su lugar
    const opciones = { duration: DURACION, easing: CURVA, fill: 'forwards' };
    animar(actual, [{ ...tamano({ ancho: ra.width, alto: ra.height }), boxShadow: sombraBanner },
      { ...tamano(hasta.actual), boxShadow: sombraQuieta }], opciones);
    animar(enlace, [{ ...tamano({ ancho: rq.width, alto: rq.height }), boxShadow: estiloEnlace.boxShadow, transform: estiloEnlace.transform, borderWidth: estiloEnlace.borderTopWidth },
      { ...tamano(hasta.enlace), boxShadow: sombraBanner, transform: 'none', borderWidth: '0px' }], opciones);
    // Lo que muestran ahora se va; encima se enciende su nuevo aspecto (azul oscuro o el degradado azul)
    // y, cuando ya casi tienen su tamaño, aparecen sus líneas, su texto y su icono
    salientes.forEach(el => animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }));
    [quieta, banner].forEach(capa => {
      animar(capa, [{ opacity: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], { duration: DURACION, fill: 'forwards' });
      [...capa.children].forEach(el => animar(el,
        el.tagName.toLowerCase() === 'svg'
          ? [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 0, transform: 'translateY(8px)', offset: 0.55 }, { opacity: 1, transform: 'none' }],
        { duration: DURACION, easing: 'ease-out', fill: 'forwards' }));
    });
    contenido(grupo).forEach((el, i) => animar(el,
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px)' }],
      { duration: 260, delay: i * 30, easing: 'ease-in', fill: 'forwards' }));

    setTimeout(() => { location.href = enlace.href.split('#')[0] + MARCA; }, DURACION + 40);
  }

  function entrar() {
    history.replaceState(null, '', location.pathname + location.search);
    if (sinMovimiento) return;
    const grupo = document.querySelector('.l2-vistas');
    raiz.classList.remove('cv-entrando');
    if (!grupo || !grupo.animate) return;
    contenido(grupo).forEach((el, i) => animar(el,
      [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: 80 + i * 60, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }));
  }

  // Al volver con el botón Atrás, el navegador puede restaurar la página a mitad del cambio
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    animaciones.forEach(a => a.cancel());
    animaciones = [];
    document.querySelectorAll('.cv-capa').forEach(c => c.remove());
    raiz.classList.remove('cv-entrando');
    navegando = false;
  });

  document.addEventListener('click', e => {
    const enlace = e.target.closest('a[data-cambio-vista]');
    if (!enlace || sinMovimiento || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (navegando) return;
    navegando = true;
    salir(enlace);
  });

  if (entrando) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entrar);
    else entrar();
  }
})();
