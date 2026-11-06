// Revisión de www antes de empaquetar (scripts/lib/verificar.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { destinoLocal, verificarWww } from '../scripts/lib/verificar.mjs';

const PAGINA_BIEN = '<head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'"><script src="app-movil/app-movil.js"></script></head>';

function carpeta(archivos) {
  const raiz = mkdtempSync(path.join(tmpdir(), 'www-'));
  for (const [nombre, contenido] of Object.entries(archivos)) {
    mkdirSync(path.dirname(path.join(raiz, nombre)), { recursive: true });
    writeFileSync(path.join(raiz, nombre), contenido);
  }
  return raiz;
}

test('una carpeta limpia no tiene errores', () => {
  const raiz = carpeta({ 'index.html': PAGINA_BIEN, 'app-movil/app-movil.js': '', 'a.js': 'const ns = "http://www.w3.org/2000/svg";' });
  assert.deepEqual(verificarWww(raiz).errores, []);
  rmSync(raiz, { recursive: true });
});

test('detecta secretos, terceros, direcciones http, rutas no ASCII y páginas sin protección', () => {
  const raiz = carpeta({
    'index.html': '<head><meta name="csrf-token" content="Ym9ndXM"></head>',
    'b.js': 'const k = "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA"; fetch("http://10.0.2.2:8080/api");',
    'c.css': '@import url("https://fonts.googleapis.com/css2?family=X");',
    'nuevoDiseño/d.png': 'x',
    'login_files/e.js': 'x'
  });
  const { errores } = verificarWww(raiz);
  const tiene = texto => assert.ok(errores.some(e => e.includes(texto)), `falta: ${texto}\n${errores.join('\n')}`);
  tiene('token CSRF');
  tiene('clave de Anthropic');
  tiene('dirección sin cifrar http://10.0.2.2:8080/api');
  tiene('Google Fonts');
  tiene('fuera de ASCII');
  tiene('copia capturada');
  tiene('falta la política de seguridad');
  tiene('falta la capa móvil');
  rmSync(raiz, { recursive: true });
});

test('detecta referencias a archivos que no están en www', () => {
  const pagina = PAGINA_BIEN.replace('app-movil/', '../app-movil/').replace('</head>', '</head><body>'
    + '<img src="img/existe.png"><img src="img/falta.png"><a href="../SIMPLE%20ACTUAL/Mi%20cuenta.html">'
    + '<a href="#arriba"></a><a href="https://login.gob.sv/"></a><a href="tramite.html?n=\' + n + \'"></a><a href="./">');
  const raiz = carpeta({
    'nuevoDiseno/pagina.html': pagina,
    'app-movil/app-movil.js': '',
    'nuevoDiseno/img/existe.png': 'x',
    'nuevoDiseno/index.html': PAGINA_BIEN.replace('app-movil/', '../app-movil/'),
    'nuevoDiseno/estilos.css': '@font-face { src: url("../vendor/falta.woff2") format("woff2"); } .a { background: url(data:image/png;base64,AAAA); }'
  });
  const { errores } = verificarWww(raiz);
  assert.deepEqual(errores.map(e => e.replace(/:\d+:/, ':')).sort(), [
    'nuevoDiseno/estilos.css: apunta a ../vendor/falta.woff2, que no está en www',
    'nuevoDiseno/pagina.html: apunta a ../SIMPLE%20ACTUAL/Mi%20cuenta.html, que no está en www',
    'nuevoDiseno/pagina.html: apunta a img/falta.png, que no está en www'
  ]);
  rmSync(raiz, { recursive: true });
});

test('resuelve las rutas relativas como el WebView', () => {
  assert.equal(destinoLocal('../SIMPLE%20ACTUAL/Identidad%20digital.html', 'nuevoDiseno/a.html'), 'SIMPLE ACTUAL/Identidad digital.html');
  assert.equal(destinoLocal('tramite.html?n=73#pasos', 'nuevoDiseno/a.html'), 'nuevoDiseno/tramite.html');
  assert.equal(destinoLocal('../../../index.html', 'nuevoDiseno/a.html'), 'index.html');
  assert.equal(destinoLocal('nuevoDise%C3%B1o/a.html', 'index.html'), 'nuevoDiseño/a.html');
  for (const ajena of ['https://x.example/a.png', 'data:image/png;base64,AA', 'mailto:a@b.sv', 'tel:+503', '#ancla', '//cdn.example/a.js', 'javascript:void(0)', '']) {
    assert.equal(destinoLocal(ajena, 'index.html'), null, ajena);
  }
});

test('las páginas indicadas pueden no llevar la capa móvil', () => {
  const raiz = carpeta({ 'app-movil/error.html': '<meta http-equiv="Content-Security-Policy" content="x">' });
  assert.deepEqual(verificarWww(raiz, { paginasSinCapa: ['app-movil/error.html'] }).errores, []);
  rmSync(raiz, { recursive: true });
});

test('en producción no pueden ir las simulaciones de la maqueta', () => {
  const raiz = carpeta({ 'index.html': PAGINA_BIEN, 'app-movil/app-movil.js': '', 'nuevoDiseno/pasarela-serfinsa.js': '', 'nuevoDiseno/ciudadano.js': '' });
  assert.deepEqual(verificarWww(raiz).errores, []);
  const { errores } = verificarWww(raiz, { produccion: true });
  assert.equal(errores.length, 2);
  assert.match(errores[0], /^nuevoDiseno\/pasarela-serfinsa\.js: pasarela de pago simulada .*no puede ir en producción$/);
  assert.match(errores[1], /^nuevoDiseno\/ciudadano\.js: datos fijos/);
  rmSync(raiz, { recursive: true });
});
