/* Error del inicio de sesión. motivo: cancelado | vencida | retorno | state | emisor | proveedor | descubrimiento */
export class ErrorIdentidad extends Error {
  constructor(motivo, mensaje = motivo) {
    super(mensaje);
    this.name = 'ErrorIdentidad';
    this.motivo = motivo;
  }
}
