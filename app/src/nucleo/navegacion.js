/* Comportamientos de navegación que un WebView no resuelve como un navegador (plan, fase 2):
   - Botón Atrás de Android: primero cierra lo que esté abierto (diálogo, asistente, menú) y después vuelve.
   - Enlaces a otros sitios (portales de las instituciones, login.gob.sv): en el navegador del sistema (Custom Tabs),
     con la barra de dirección visible, en vez de cargarse dentro de la app.
   - Descargas generadas en la página (la cita en .ics): el WebView no descarga blob:, así que se guardan en la
     caché de la app y se ofrecen con el menú de compartir (calendario, correo, archivos). */

// Lo que el botón Atrás debe cerrar antes de salir de la página
function cerrarLoAbierto(documento) {
  const dialogos = [...documento.querySelectorAll('dialog[open]')];
  const dialogo = dialogos[dialogos.length - 1];
  if (dialogo) {
    // requestClose respeta a la página si cancela el cierre (por ejemplo, un pago que se está procesando)
    if (typeof dialogo.requestClose === 'function') dialogo.requestClose();
    else if (dialogo.dispatchEvent(new Event('cancel', { cancelable: true }))) dialogo.close();
    return true;
  }
  // El asistente y el menú del encabezado se cierran con Escape (asistente.js, menu-movil.js)
  if (documento.querySelector('#asistente.open, .l2-nav.abierto')) {
    documento.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
  return false;
}

export function manejarBotonAtras({ App, documento = document, historial = history }) {
  App.addListener('backButton', ({ canGoBack }) => {
    if (cerrarLoAbierto(documento)) return;
    if (canGoBack) historial.back();
    else App.minimizeApp(); // en la primera pantalla, como Android 12+: la app pasa a segundo plano, no se cierra
  });
}

/* pagina: la dirección de la página actual. Se usa la dirección y no location.origin porque en iOS las páginas de la
   app tienen un esquema propio (capacitor://localhost) y, para esos esquemas, URL.origin vale "null". */
export function esExterno(href, pagina) {
  try {
    const url = new URL(href, pagina);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== new URL(pagina).origin;
  } catch {
    return false;
  }
}

/* abrirExterno(url): Browser.open. Solo https: un enlace http se intenta como https (todos los sitios del
   gobierno a los que enlaza el frontend lo tienen). mailto: y tel: siguen su camino: Capacitor abre la app que
   corresponda. */
export function abrirEnlacesExternos({ abrirExterno, documento = document, ventana = window }) {
  const pagina = () => ventana.location.href;
  const abrir = href => {
    const url = new URL(href, pagina());
    url.protocol = 'https:';
    abrirExterno(url.href);
  };
  documento.addEventListener('click', evento => {
    const enlace = evento.target.closest?.('a[href]');
    if (!enlace || evento.defaultPrevented || !esExterno(enlace.href, pagina())) return;
    evento.preventDefault();
    abrir(enlace.href);
  }, true);
  const abrirOriginal = ventana.open.bind(ventana);
  ventana.open = (url, ...resto) => {
    if (url && esExterno(String(url), pagina())) { abrir(String(url)); return null; }
    return abrirOriginal(url, ...resto);
  };
}

const enBase64 = blob => new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(String(lector.result).split(',')[1]);
  lector.onerror = () => rechazar(lector.error);
  lector.readAsDataURL(blob);
});

/* Filesystem y Share: plugins de Capacitor. Se intercepta el clic (también el programático de un <a> que no está en
   la página, como hace pasos-tramite.js) en enlaces con download y dirección blob:. */
export function manejarDescargas({ Filesystem, Directory, Share, avisar = () => {} }) {
  async function compartir(href, nombre) {
    // La lectura empieza antes de que la página revoque la dirección blob: (pasos-tramite.js la revoca en 1 s)
    const blob = await (await fetch(href)).blob();
    const archivo = nombre.replace(/[^\w.-]+/g, '-').slice(0, 80) || 'archivo';
    const { uri } = await Filesystem.writeFile({ path: `descargas/${archivo}`, data: await enBase64(blob), directory: Directory.Cache, recursive: true });
    await Share.share({ title: archivo, files: [uri] });
  }
  const descargable = enlace => enlace?.hasAttribute?.('download') && enlace.href.startsWith('blob:');
  const atender = enlace => {
    compartir(enlace.href, enlace.getAttribute('download') || 'archivo').catch(error => {
      // Cerrar el menú de compartir sin elegir nada no es un error
      if (!/cancel/i.test(String(error?.message))) avisar('No se pudo guardar el archivo. Intenta de nuevo.');
    });
  };
  const clicOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click() {
    if (descargable(this)) { atender(this); return; }
    clicOriginal.call(this);
  };
  document.addEventListener('click', evento => {
    const enlace = evento.target.closest?.('a[download]');
    if (!descargable(enlace)) return;
    evento.preventDefault();
    atender(enlace);
  }, true);
}
