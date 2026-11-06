/* Cliente del backend de la app según la propuesta de contrato (docs/api/contrato-backend.yaml). El contrato debe
   acordarse con el equipo que opere el backend (hoy no existe: ver docs/01-auditoria-repositorio.md).
   http: nucleo/http.js. Las respuestas usan los mismos nombres que backend-simulado.js. */
const segmento = valor => encodeURIComponent(String(valor));

export function crearBackendHttp({ http }) {
  return {
    // Sesiones (fases 3 y 4)
    crearSesion: ({ proveedor, code, codeVerifier, nonce, redirectUri, dispositivo }) =>
      http.post('v1/sesiones', { cuerpo: { proveedor, code, codeVerifier, nonce, redirectUri, dispositivo } }),
    renovarSesion: ({ refreshToken, dispositivoId }) =>
      http.post('v1/sesiones/renovacion', { cuerpo: { refreshToken, dispositivoId } }),
    cerrarSesion: ({ token }) => http.delete('v1/sesiones/actual', { token }),
    registrarDispositivo: ({ token, dispositivo }) => http.post('v1/dispositivos', { token, cuerpo: dispositivo }),
    sesionConDispositivo: ({ credencial, dispositivoId }) =>
      http.post('v1/sesiones/dispositivo', { cuerpo: { credencial, dispositivoId } }),
    desvincularDispositivo: ({ token, dispositivoId }) => http.delete(`v1/dispositivos/${segmento(dispositivoId)}`, { token }),

    // Pagos (fase 5)
    crearOrdenPago: ({ token, solicitudId, claveIdempotencia }) =>
      http.post('v1/ordenes-pago', { token, claveIdempotencia, cuerpo: { solicitudId } }),
    iniciarPago: ({ token, ordenId, metodo, claveIdempotencia }) =>
      http.post(`v1/ordenes-pago/${segmento(ordenId)}/intentos`, { token, claveIdempotencia, cuerpo: { metodo } }),
    consultarOrden: ({ token, ordenId }) => http.get(`v1/ordenes-pago/${segmento(ordenId)}`, { token })
  };
}
