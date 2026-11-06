// PKCE (src/identidad/pkce.js) con el vector de prueba de RFC 7636, apéndice B
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aleatorio, base64url, desafioS256, nuevaSolicitud } from '../src/identidad/pkce.js';

test('vector de RFC 7636 (apéndice B)', async () => {
  const verificador = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(await desafioS256(verificador), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const bytes = [116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121];
  assert.equal(base64url(new Uint8Array(bytes)), verificador);
});

test('verificador de 43 caracteres del alfabeto permitido y valores distintos en cada solicitud', async () => {
  assert.match(aleatorio(), /^[A-Za-z0-9_-]{43}$/);
  const a = await nuevaSolicitud();
  const b = await nuevaSolicitud();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.codeVerifier, b.codeVerifier);
  assert.equal(a.codeChallenge, await desafioS256(a.codeVerifier));
});
