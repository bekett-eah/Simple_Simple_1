/* Construye app/www, el contenido web que Capacitor empaqueta en la app.
   Uso: node scripts/construir-web.mjs --entorno=desarrollo|pruebas|produccion

   1. Valida la configuración del ambiente (config/<entorno>.json).
   2. Copia el frontend del repositorio (index.html, nuevoDiseño/ y src/) sin tocar los originales: la web y la app
      comparten el mismo código. No se copian las copias capturadas del login y de "Mi cuenta" de Identidad Digital
      (llevan scripts, tokens y la analítica del sitio oficial): en su lugar quedan redirecciones a pantallas propias.
   3. Adapta la copia: carpeta en ASCII, fuentes e íconos locales, viewport sin cover, política de seguridad y la capa
      móvil (src/app-movil.js, empaquetada con esbuild) al inicio de cada página.
   4. Optimiza las imágenes y revisa el resultado (scripts/lib/verificar.mjs). */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as configuracion from './lib/configuracion.mjs';
import { optimizar } from './lib/imagenes.mjs';
import {
  CARPETA_APP, CARPETA_ORIGINAL, ajustarViewport, fuentesDeFontsource, inyectarCapaMovil, paginaDeRedireccion,
  phosphorSoloWoff2, politicaDeSeguridad, prefijoDe, renombrarCarpeta, vendorizarRecursos
} from './lib/transformar.mjs';
import { verificarWww } from './lib/verificar.mjs';

const RAIZ_APP = new URL('../', import.meta.url);
const ruta = relativa => fileURLToPath(new URL(relativa, RAIZ_APP));
const REPO = ruta('../');
const WWW = ruta('www');
const MODULOS = ruta('node_modules');

// Lo que se copia del repositorio. excluir: rutas relativas a la carpeta de origen.
const ORIGENES = [
  { origen: 'index.html' },
  {
    origen: CARPETA_ORIGINAL,
    destino: CARPETA_APP,
    excluir: [
      /^login\.html$/,          // copia capturada del login oficial: la reemplaza app-movil/inicio-sesion.html
      /^login_files\//,
      /^Captura de pantalla/,   // captura de referencia del diseño; ninguna página la usa
      /^index\.html$/           // redirección antigua a ../index.html; en la app no hace falta
    ]
  },
  { origen: 'src' }
];
// Páginas que en la app redirigen a una pantalla propia (las originales no se copian)
const REDIRECCIONES = {
  [`${CARPETA_APP}/login.html`]: '../app-movil/inicio-sesion.html',
  'SIMPLE ACTUAL/Identidad digital.html': '../app-movil/mi-cuenta.html'
};
const PAGINA_ERROR = 'app-movil/error.html';
const FUENTES = [
  { paquete: '@fontsource/manrope', carpeta: 'manrope', pesos: [400, 500, 600, 700, 800] },
  { paquete: '@fontsource/roboto', carpeta: 'roboto', pesos: [400, 500] }
];

function argumento(nombre, porDefecto) {
  const encontrado = process.argv.find(a => a.startsWith(`--${nombre}=`));
  return encontrado ? encontrado.split('=')[1] : porDefecto;
}

function commitActual() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'sin-git';
  }
}

// Archivos de una carpeta, con rutas relativas en NFC (macOS puede devolverlas descompuestas)
function archivosDe(carpeta) {
  return readdirSync(carpeta, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile() && e.name !== '.DS_Store')
    .map(e => path.relative(carpeta, path.join(e.parentPath, e.name)).split(path.sep).join('/').normalize('NFC'));
}

function escribir(destino, contenido) {
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
}

function copiarFrontend({ csp }) {
  let copiados = 0;
  for (const { origen, destino = origen, excluir = [] } of ORIGENES) {
    const desde = path.join(REPO, origen);
    const lista = statSync(desde).isDirectory() ? archivosDe(desde) : [''];
    for (const relativo of lista) {
      if (excluir.some(patron => patron.test(relativo))) continue;
      const salida = relativo ? `${destino}/${relativo}` : destino;
      const archivoOrigen = relativo ? path.join(desde, relativo) : desde;
      const archivoDestino = path.join(WWW, salida);
      const extension = path.extname(salida).toLowerCase();
      if (['.html', '.js', '.css'].includes(extension)) {
        let texto = renombrarCarpeta(readFileSync(archivoOrigen, 'utf8'));
        if (extension === '.html') {
          const prefijo = prefijoDe(salida);
          texto = inyectarCapaMovil(vendorizarRecursos(ajustarViewport(texto), prefijo), { prefijo, csp });
        }
        escribir(archivoDestino, texto);
      } else {
        mkdirSync(path.dirname(archivoDestino), { recursive: true });
        copyFileSync(archivoOrigen, archivoDestino);
      }
      copiados++;
    }
  }
  return copiados;
}

function copiarRecursosDeTerceros() {
  // Fuentes (latin y latin-ext, woff2) con su licencia
  const reglas = [];
  for (const { paquete, carpeta, pesos } of FUENTES) {
    const base = path.join(MODULOS, paquete);
    for (const peso of pesos) {
      const { css, archivos } = fuentesDeFontsource(readFileSync(path.join(base, `${peso}.css`), 'utf8'), { carpeta });
      reglas.push(css);
      archivos.forEach(a => escribir(path.join(WWW, 'vendor/fuentes', carpeta, a), readFileSync(path.join(base, 'files', a))));
    }
    copyFileSync(path.join(base, 'LICENSE'), path.join(WWW, 'vendor/fuentes', carpeta, 'LICENSE'));
  }
  escribir(path.join(WWW, 'vendor/fuentes/fuentes.css'), `/* Generado por scripts/construir-web.mjs desde Fontsource (licencia SIL OFL 1.1) */\n${reglas.join('\n')}\n`);

  // Íconos de Phosphor (licencia MIT)
  const phosphor = path.join(MODULOS, '@phosphor-icons/web');
  const destino = path.join(WWW, 'vendor/phosphor/regular');
  escribir(path.join(destino, 'style.css'), phosphorSoloWoff2(readFileSync(path.join(phosphor, 'src/regular/style.css'), 'utf8')));
  copyFileSync(path.join(phosphor, 'src/regular/Phosphor.woff2'), path.join(destino, 'Phosphor.woff2'));
  copyFileSync(path.join(phosphor, 'LICENSE'), path.join(destino, 'LICENSE'));
}

async function construirCapaMovil({ entorno, config, csp }) {
  const paquete = JSON.parse(readFileSync(ruta('package.json'), 'utf8'));
  const compilacion = { version: paquete.version, commit: commitActual(), fecha: new Date().toISOString() };
  await esbuild.build({
    entryPoints: [ruta('src/app-movil.js')],
    outfile: path.join(WWW, 'app-movil/app-movil.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome108'],
    minify: entorno !== 'desarrollo',
    sourcemap: entorno === 'desarrollo' ? 'linked' : false,
    legalComments: 'eof',
    define: { __CONFIG_APP__: JSON.stringify({ ...config, compilacion }) },
    logLevel: 'warning'
  });
  copyFileSync(ruta('src/app-movil.css'), path.join(WWW, 'app-movil/app-movil.css'));

  // Pantallas propias de la app (inicio de sesión, biometría, desbloqueo, Mi cuenta)
  const pantallas = ruta('src/pantallas');
  for (const archivo of readdirSync(pantallas)) {
    const destino = path.join(WWW, 'app-movil', archivo);
    if (archivo.endsWith('.html')) {
      const html = readFileSync(path.join(pantallas, archivo), 'utf8');
      escribir(destino, `app-movil/${archivo}` === PAGINA_ERROR
        ? html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`)
        : inyectarCapaMovil(html, { prefijo: '../', csp }));
    } else {
      copyFileSync(path.join(pantallas, archivo), destino);
    }
  }
  return compilacion;
}

async function optimizarImagenes() {
  const cache = ruta('.cache/imagenes');
  let antes = 0, despues = 0;
  const imagenes = archivosDe(WWW).filter(a => /\.(png|jpe?g)$/i.test(a));
  for (const archivo of imagenes) {
    // El avatar se ve a 40 px; el resto, como mucho al ancho de una tarjeta en pantallas de alta densidad
    const anchoMaximo = /usuario-avatar\.png$/.test(archivo) ? 192 : 960;
    const r = await optimizar(path.join(WWW, archivo), { anchoMaximo, cache });
    if (r) { antes += r.antes; despues += r.despues; }
  }
  return { imagenes: imagenes.length, antes, despues };
}

const mb = bytes => `${(bytes / 1048576).toFixed(1)} MB`;

async function principal() {
  const entorno = argumento('entorno', 'desarrollo');
  const { appId } = JSON.parse(readFileSync(ruta('capacitor.config.json'), 'utf8'));
  const config = configuracion.cargar(entorno, { raiz: RAIZ_APP, appId });
  const csp = politicaDeSeguridad(configuracion.origenesDeConexion(config));

  rmSync(WWW, { recursive: true, force: true });
  mkdirSync(WWW, { recursive: true });
  const copiados = copiarFrontend({ csp });
  Object.entries(REDIRECCIONES).forEach(([pagina, destino]) => escribir(path.join(WWW, pagina), paginaDeRedireccion({ destino, csp })));
  copiarRecursosDeTerceros();
  const compilacion = await construirCapaMovil({ entorno, config, csp });
  // Para scripts/verificar-paquete.mjs: de qué ambiente es el paquete
  escribir(path.join(WWW, 'app-movil/compilacion.json'), `${JSON.stringify({ entorno, ...compilacion }, null, 2)}\n`);
  const imagenes = await optimizarImagenes();

  const revision = verificarWww(WWW, { paginasSinCapa: [...Object.keys(REDIRECCIONES), PAGINA_ERROR], produccion: entorno === 'produccion' });
  console.log(`Simple.sv app · ${entorno} · v${compilacion.version} (${compilacion.commit})`);
  console.log(`  ${copiados} archivos del frontend copiados a www/`);
  console.log(`  ${imagenes.imagenes} imágenes: ${mb(imagenes.antes)} → ${mb(imagenes.despues)}`);
  console.log(`  www/: ${revision.archivos} archivos, ${mb(revision.total)}`);
  if (revision.errores.length) {
    console.error(`\nLa revisión de www/ encontró ${revision.errores.length} problema(s):\n  - ${revision.errores.join('\n  - ')}`);
    process.exit(1);
  }
}

principal().catch(error => {
  console.error(error.message);
  process.exit(1);
});
