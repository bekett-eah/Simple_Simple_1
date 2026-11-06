/* Pasarelas que puede usar el servicio de pagos. Cada una solo sabe llevar a la persona a pagar; el resultado
   siempre se confirma con el backend (servicio-pagos.js).
   - redireccion: página de pago alojada por el proveedor, abierta en el navegador del sistema (Custom Tabs). Los
     datos de la tarjeta los recibe el proveedor, nunca la app ni el backend de la app (alcance PCI DSS reducido).
   - simulada: para desarrollo; representa a la pasarela avisando al backend simulado del resultado.
   Google Pay se agregará como otra pasarela cuando se confirme que el proveedor actual lo admite en El Salvador
   (docs/04-pagos.md). */
export function crearPasarelaRedireccion({ navegador }) {
  return {
    ejecutar(intento) {
      if (intento.tipo !== 'redireccion' || !String(intento.url).startsWith('https://')) {
        return Promise.reject(new Error('El backend no entregó una página de pago válida'));
      }
      // Termina cuando la persona cierra la página de pago o el proveedor la devuelve a la app
      return new Promise(resolver => {
        const quitar = navegador.alCerrar(() => { quitar(); resolver(); });
        navegador.abrir(intento.url).catch(() => { quitar(); resolver(); });
      });
    }
  };
}

// confirmar(orden) → Promise<boolean>: aprobar o rechazar el pago simulado
export function crearPasarelaSimulada({ backend, confirmar }) {
  return {
    async ejecutar(intento, { orden }) {
      const aprobado = await confirmar(orden);
      await backend.simularRespuestaPasarela({ intentoId: intento.id, aprobado });
    }
  };
}
