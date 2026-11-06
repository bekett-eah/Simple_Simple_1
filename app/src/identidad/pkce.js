/* PKCE (RFC 7636) y valores de un solo uso para el inicio de sesión de una app nativa (RFC 8252):
   el verificador queda en el teléfono y al proveedor solo viaja su huella SHA-256 (método S256). */
export function base64url(bytes) {
  let binario = '';
  bytes.forEach(b => { binario += String.fromCharCode(b); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 32 bytes aleatorios → 43 caracteres sin relleno (el mínimo que exige RFC 7636 para el verificador)
export function aleatorio(bytes = 32, cripto = globalThis.crypto) {
  const valores = new Uint8Array(bytes);
  cripto.getRandomValues(valores);
  return base64url(valores);
}

export async function desafioS256(verificador, cripto = globalThis.crypto) {
  const huella = await cripto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64url(new Uint8Array(huella));
}

// Lo que necesita una solicitud de autorización: state (contra CSRF), nonce (lo valida el backend en el id_token) y PKCE
export async function nuevaSolicitud(cripto = globalThis.crypto) {
  const codeVerifier = aleatorio(32, cripto);
  return { state: aleatorio(16, cripto), nonce: aleatorio(16, cripto), codeVerifier, codeChallenge: await desafioS256(codeVerifier, cripto) };
}
