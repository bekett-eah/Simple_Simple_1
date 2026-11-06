/* Diálogo modal accesible (elemento <dialog>) para las simulaciones de desarrollo: Identidad Digital, biometría y
   pasarela simuladas. Todo el texto va con textContent: nada de lo que se muestra se interpreta como HTML. */
export function preguntar({ titulo, mensaje, detalle = [], aceptar = 'Continuar', cancelar = 'Cancelar', etiqueta = 'Simulación de desarrollo' }) {
  return new Promise(resolver => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'app-dialogo';
    dialogo.setAttribute('aria-labelledby', 'app-dialogo-titulo');
    dialogo.setAttribute('aria-describedby', 'app-dialogo-mensaje');
    const crear = (tag, clase, texto) => {
      const nodo = document.createElement(tag);
      if (clase) nodo.className = clase;
      if (texto) nodo.textContent = texto;
      return nodo;
    };
    const cabecera = crear('p', 'app-dialogo-etiqueta', etiqueta);
    const h2 = crear('h2', null, titulo);
    h2.id = 'app-dialogo-titulo';
    const cuerpo = crear('p', null, mensaje);
    cuerpo.id = 'app-dialogo-mensaje';
    const lista = crear('ul', 'app-dialogo-detalle');
    detalle.forEach(linea => lista.append(crear('li', null, linea)));
    const acciones = crear('div', 'app-dialogo-acciones');
    const no = crear('button', 'app-boton app-boton-secundario', cancelar);
    const si = crear('button', 'app-boton app-boton-principal', aceptar);
    [no, si].forEach(b => { b.type = 'button'; });
    acciones.append(no, si);
    dialogo.append(cabecera, h2, cuerpo, ...(detalle.length ? [lista] : []), acciones);

    let respuesta = false;
    no.addEventListener('click', () => dialogo.close());
    si.addEventListener('click', () => { respuesta = true; dialogo.close(); });
    dialogo.addEventListener('close', () => { dialogo.remove(); resolver(respuesta); });
    document.body.append(dialogo);
    dialogo.showModal();
    si.focus();
  });
}
