// Destinos después de iniciar sesión (src/nucleo/destinos.js): la misma lista blanca de nuevoDiseño/login.html
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoTrasIniciarSesion, rutaInterna } from '../src/nucleo/destinos.js';

test('los destinos de la maqueta llevan a las mismas páginas', () => {
  const casos = {
    '': '../nuevoDiseno/Indexlogin.html',
    '?destino=tramites': '../nuevoDiseno/Indexlogin.html',
    '?destino=documentos': '../nuevoDiseno/mis-tramites.html',
    '?destino=whatsapp': '../nuevoDiseno/whatsapp.html?hola=1',
    '?destino=inicio': '../nuevoDiseno/../index.html',
    '?destino=cuenta': '../nuevoDiseno/../app-movil/mi-cuenta.html',
    '?destino=tramite&n=73': '../nuevoDiseno/tramite.html?n=73',
    '?destino=pago&n=99': '../nuevoDiseno/tramite.html?continuar=1&n=99',
    '?destino=cita&n=99': '../nuevoDiseno/Indexlogin.html?cita=99',
    '?destino=asistente&n=5': '../nuevoDiseno/Indexlogin.html?asistente=5',
    '?destino=inicio&n=5': '../nuevoDiseno/../index.html?asistente=5',
    '?destino=documentos&tramite=4321586': '../nuevoDiseno/mis-tramites.html?tramite=4321586'
  };
  for (const [busqueda, esperado] of Object.entries(casos)) assert.equal(destinoTrasIniciarSesion(busqueda), esperado, busqueda);
});

test('un parámetro manipulado no lleva a otra página', () => {
  assert.equal(destinoTrasIniciarSesion('?destino=tramite&n=../../evil'), '../nuevoDiseno/Indexlogin.html');
  assert.equal(destinoTrasIniciarSesion('?destino=https://evil.example'), '../nuevoDiseno/Indexlogin.html');
  assert.equal(destinoTrasIniciarSesion('?destino=__proto__'), '../nuevoDiseno/Indexlogin.html');
  assert.equal(destinoTrasIniciarSesion('?destino=documentos&tramite=1;alert(1)'), '../nuevoDiseno/mis-tramites.html');
});

test('solo se vuelve a páginas de la propia app, en Android y con el esquema propio de iOS', () => {
  for (const pagina of ['https://localhost/app-movil/desbloqueo.html?volver=x', 'capacitor://localhost/app-movil/desbloqueo.html?volver=x']) {
    assert.equal(rutaInterna('/nuevoDiseno/tramite.html?n=73', pagina), '/nuevoDiseno/tramite.html?n=73', pagina);
    assert.equal(rutaInterna('/index.html', pagina), '/index.html', pagina);
    assert.equal(rutaInterna('/app-movil/mi-cuenta.html', pagina), '/app-movil/mi-cuenta.html', pagina);
    for (const malo of ['https://evil.example/index.html', '//evil.example/index.html', '/\\evil.example/index.html',
      'capacitor://evil.example/index.html', 'javascript:alert(1)', '/../etc/passwd', '/nuevoDiseno/../../x.html',
      '/vendor/fuentes/fuentes.css', 'index.html', null, undefined, 42]) {
      assert.equal(rutaInterna(malo, pagina), null, `${String(malo)} en ${pagina}`);
    }
  }
  assert.equal(rutaInterna('/index.html', 'null'), null, 'sin una dirección válida no se acepta nada');
});
