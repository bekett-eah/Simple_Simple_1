// Transformaciones del build sobre la copia del frontend (scripts/lib/transformar.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajustarViewport, fuentesDeFontsource, inyectarCapaMovil, paginaDeRedireccion, phosphorSoloWoff2,
  politicaDeSeguridad, prefijoDe, renombrarCarpeta, vendorizarRecursos
} from '../scripts/lib/transformar.mjs';

test('la carpeta del rediseño pasa a ASCII en sus tres escrituras (NFC, NFD y codificada)', () => {
  const nfc = 'nuevoDiseño'.normalize('NFC');
  const nfd = 'nuevoDiseño'.normalize('NFD');
  const texto = `<a href="${nfc}/tramite.html"></a><img src="${nfd}/img/a.png"><a href="${encodeURI(nfc)}/pago.html">`;
  assert.equal(renombrarCarpeta(texto), '<a href="nuevoDiseno/tramite.html"></a><img src="nuevoDiseno/img/a.png"><a href="nuevoDiseno/pago.html">');
  // Sin barra no es una ruta: no se toca (p. ej. un texto que menciona la carpeta)
  assert.equal(renombrarCarpeta(`carpeta ${nfc}`), `carpeta ${nfc}`);
});

test('quita viewport-fit=cover y conserva el resto del viewport', () => {
  const html = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
  assert.equal(ajustarViewport(html), '<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  const sinCover = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  assert.equal(ajustarViewport(sinCover), sinCover);
});

test('Google Fonts y Phosphor pasan a archivos locales, sin preconnect ni integridad del CDN', () => {
  const html = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/regular/style.css" integrity="sha384-abc" crossorigin="anonymous">`;
  const salida = vendorizarRecursos(html, '../');
  assert.ok(!salida.includes('googleapis') && !salida.includes('gstatic') && !salida.includes('jsdelivr') && !salida.includes('integrity'));
  assert.ok(salida.includes('<link rel="stylesheet" href="../vendor/fuentes/fuentes.css">'));
  assert.ok(salida.includes('<link rel="stylesheet" href="../vendor/phosphor/regular/style.css">'));
});

test('la política y la capa móvil van justo después del charset, antes que cualquier script', () => {
  const html = '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <script src="otro.js"></script>\n</head>';
  const salida = inyectarCapaMovil(html, { prefijo: '../', csp: "default-src 'self'" });
  const posicion = texto => salida.indexOf(texto);
  assert.ok(posicion('<meta charset="UTF-8">') < posicion('Content-Security-Policy'));
  assert.ok(posicion('Content-Security-Policy') < posicion('../app-movil/app-movil.js'));
  assert.ok(posicion('../app-movil/app-movil.js') < posicion('otro.js'));
  assert.throws(() => inyectarCapaMovil('<p>sin head</p>', { prefijo: '', csp: '' }));
});

test('prefijo relativo según la profundidad de la página', () => {
  assert.equal(prefijoDe('index.html'), '');
  assert.equal(prefijoDe('nuevoDiseno/tramite.html'), '../');
  assert.equal(prefijoDe('SIMPLE ACTUAL/Identidad digital.html'), '../');
});

test('la política limita todo a la app y a los orígenes configurados', () => {
  const csp = politicaDeSeguridad(['https://api.ejemplo.gob.sv']);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self' blob: https:\/\/api\.ejemplo\.gob\.sv/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.doesNotMatch(csp, /\*/);
});

test('la redirección conserva los parámetros del enlace original', () => {
  const html = paginaDeRedireccion({ destino: '../app-movil/inicio-sesion.html', csp: "default-src 'self'" });
  assert.match(html, /location\.replace\("\.\.\/app-movil\/inicio-sesion\.html" \+ location\.search \+ location\.hash\)/);
  assert.match(html, /Content-Security-Policy/);
});

test('fuentes: solo latin y latin-ext en woff2', () => {
  const css = ['cyrillic', 'latin-ext', 'latin'].map(s => `/* x */\n@font-face {\n  font-family: 'Manrope';\n  font-weight: 400;\n  src: url(./files/manrope-${s}-400-normal.woff2) format('woff2'), url(./files/manrope-${s}-400-normal.woff) format('woff');\n  unicode-range: U+0000-00FF;\n}`).join('\n');
  const { css: salida, archivos } = fuentesDeFontsource(css, { carpeta: 'manrope' });
  assert.deepEqual(archivos, ['manrope-latin-ext-400-normal.woff2', 'manrope-latin-400-normal.woff2']);
  assert.ok(!salida.includes('cyrillic') && !salida.includes('.woff)'));
  assert.ok(salida.includes("src: url(./manrope/manrope-latin-400-normal.woff2) format('woff2');"));
});

test('Phosphor queda solo con woff2', () => {
  const css = '@font-face {\n  font-family: "Phosphor";\n  src:\n    url("./Phosphor.woff2") format("woff2"),\n    url("./Phosphor.woff") format("woff");\n}';
  assert.equal(phosphorSoloWoff2(css), '@font-face {\n  font-family: "Phosphor";\n  src: url("./Phosphor.woff2") format("woff2");\n}');
});
