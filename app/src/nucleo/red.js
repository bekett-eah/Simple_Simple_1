/* Aviso de "sin conexión" (plan, fase 6: pérdida de conexión). Las páginas están dentro de la app y se siguen
   viendo; lo que necesita internet (asistente con IA, portales, pagos) avisa o sigue en modo básico. */
export function vigilarConexion({ Network, documento = document }) {
  const aviso = documento.createElement('div');
  aviso.className = 'app-sin-conexion';
  aviso.setAttribute('role', 'status');
  aviso.hidden = true;
  aviso.textContent = 'Sin conexión a internet. Puedes seguir viendo la app; lo que necesite internet funcionará al volver la conexión.';
  documento.body.prepend(aviso);
  const mostrar = conectado => {
    aviso.hidden = conectado;
    documento.documentElement.classList.toggle('app-sin-red', !conectado);
  };
  Network.getStatus().then(estado => mostrar(estado.connected)).catch(() => {});
  Network.addListener('networkStatusChange', estado => mostrar(estado.connected));
}
