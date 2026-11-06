// Enlaces que salen de la app (src/nucleo/navegacion.js): Android usa https://localhost e iOS, capacitor://localhost
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esExterno } from '../src/nucleo/navegacion.js';

test('solo los enlaces http(s) a otro origen salen de la app, también con el esquema propio de iOS', () => {
  for (const pagina of ['https://localhost/nuevoDiseno/tramite.html?n=7', 'capacitor://localhost/nuevoDiseno/tramite.html?n=7']) {
    assert.equal(esExterno('https://www.gob.sv/tramites', pagina), true, pagina);
    assert.equal(esExterno('http://www.gob.sv/', pagina), true, pagina);
    assert.equal(esExterno(new URL('/index.html', pagina).href, pagina), false, pagina);
    for (const interno of ['Indexlogin.html#ayuda', '../index.html', 'mailto:info@gob.sv', 'tel:+50322223333', 'javascript:void(0)', 'blob:https://localhost/1']) {
      assert.equal(esExterno(interno, pagina), false, `${interno} en ${pagina}`);
    }
  }
});
