/* "Requisitos, detalles y leyes asociadas" de un trámite, copiados del portal simple.sv: un solo desplegable, cerrado al entrar,
   con cada ley como sub desplegable (se abre una a la vez, como en el portal). Lo usan tramite.html y tramite-publico.html;
   los datos van en la clave informacion de cada trámite en formularios.js. */
(() => {
  const CSS = `
    .l2-info { min-width: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-card); background: var(--bg-subtle); }
    .l2-info > summary { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 14px 18px; border-radius: var(--radius-card); cursor: pointer; list-style: none; }
    .l2-info > summary::-webkit-details-marker { display: none; }
    .l2-info > summary:focus-visible, .l2-ley > summary:focus-visible { outline: 3px solid var(--border-focus); outline-offset: 2px; }
    .l2-info-icono { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 12px; background: #FFFFFF; color: var(--color-blue-primary); font-size: 18px; }
    .l2-info-titulo { flex: 1; min-width: 0; display: grid; }
    .l2-info-titulo strong { color: var(--color-blue-primary); font-size: 17px; font-weight: 800; line-height: 1.3; }
    .l2-info-titulo small { color: var(--text-muted); font-size: 13px; font-weight: 600; }
    .l2-info-caret { flex-shrink: 0; color: var(--color-blue-primary); font-size: 20px; transition: transform 0.2s ease; }
    .l2-info[open] > summary .l2-info-caret { transform: rotate(180deg); }
    .l2-info-cuerpo { display: grid; gap: 22px; padding: 4px 18px 20px; }
    .l2-info-cuerpo h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: var(--color-blue-primary); font-size: 15px; font-weight: 800; }
    .l2-info-cuerpo h4 i { font-size: 18px; }
    .l2-info-cuerpo ul { display: grid; gap: 8px; margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; }
    .l2-info-subtitulo { margin: 0 0 8px; color: var(--text-primary); font-size: 14px; font-weight: 700; }
    .l2-info-cuerpo li { text-align: justify; }
    .l2-info-cuerpo li strong { color: var(--text-primary); font-weight: 700; }
    .l2-info-importante { display: grid; gap: 8px; margin-top: 12px; padding: 14px 16px; border-left: 4px solid var(--color-blue-primary); border-radius: 12px; background: #FFFFFF; color: var(--text-secondary); font-size: 14px; }
    .l2-info-importante p { margin: 0; text-align: justify; }
    .l2-info-importante strong { color: var(--text-primary); font-weight: 800; }
    .l2-ley { border: 1px solid var(--border-subtle); border-radius: 12px; background: #FFFFFF; overflow: hidden; }
    .l2-ley + .l2-ley { margin-top: 8px; }
    .l2-ley > summary { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 11px 14px; color: var(--color-blue-primary); font-size: 14px; font-weight: 700; line-height: 1.4; cursor: pointer; list-style: none; }
    .l2-ley > summary::-webkit-details-marker { display: none; }
    .l2-ley > summary i { flex-shrink: 0; margin-top: 2px; transition: transform 0.2s ease; }
    .l2-ley[open] > summary i { transform: rotate(90deg); }
    .l2-ley > p { margin: 0; padding: 0 14px 14px 38px; color: var(--text-secondary); font-size: 14px; }
    @media (prefers-reduced-motion: reduce) { .l2-info-caret, .l2-ley > summary i { transition: none; } }
  `;

  const el = (tag, clase, texto) => {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  };
  const icono = nombre => {
    const i = el('i', `ph ${nombre}`);
    i.setAttribute('aria-hidden', 'true');
    return i;
  };
  const encabezado = (nombre, texto) => {
    const h = el('h4');
    h.append(icono(nombre), texto);
    return h;
  };
  // "Vigencia: texto" → "Vigencia:" en negrita y el resto normal
  const conEtiqueta = texto => {
    const li = el('li');
    const corte = texto.indexOf(': ');
    if (corte > 0 && corte < 60) li.append(el('strong', '', texto.slice(0, corte + 1)), ` ${texto.slice(corte + 2)}`);
    else li.append(texto);
    return li;
  };

  let numeroDeLista = 0;

  /* informacion: la clave informacion del trámite en formularios.js; destino: donde se agrega el desplegable.
     Sin informacion no se pinta nada. */
  window.pintarInformacionTramite = (informacion, destino) => {
    if (!informacion || !destino || destino.querySelector('.l2-info')) return;
    if (!document.getElementById('estilos-info-tramite')) {
      const estilos = el('style', '', CSS);
      estilos.id = 'estilos-info-tramite';
      document.head.append(estilos);
    }

    const info = el('details', 'l2-info');
    info.id = 'info-tramite';
    const resumen = el('summary');
    const cajaIcono = el('span', 'l2-info-icono');
    cajaIcono.append(icono('ph-list-checks'));
    const titulo = el('span', 'l2-info-titulo');
    titulo.append(el('strong', '', 'Requisitos, detalles y leyes'), el('small', '', 'Lo que debes saber antes de empezar'));
    resumen.append(cajaIcono, titulo, icono('ph-caret-down l2-info-caret'));
    const cuerpo = el('div', 'l2-info-cuerpo');

    const { requisitos, detalles, leyes } = informacion;
    if (requisitos) {
      const seccion = el('section');
      seccion.append(encabezado('ph-clipboard-text', 'Requisitos'));
      if (requisitos.titulo) seccion.append(el('p', 'l2-info-subtitulo', `${requisitos.titulo}:`));
      if (requisitos.lista?.length) {
        const ul = el('ul');
        requisitos.lista.forEach(t => ul.append(conEtiqueta(t)));
        seccion.append(ul);
      }
      if (requisitos.importante) {
        const caja = el('div', 'l2-info-importante');
        caja.append(el('strong', '', requisitos.importante.titulo));
        requisitos.importante.parrafos.forEach(t => caja.append(el('p', '', t)));
        seccion.append(caja);
      }
      cuerpo.append(seccion);
    }
    if (detalles?.length) {
      const seccion = el('section');
      const ul = el('ul');
      detalles.forEach(t => ul.append(conEtiqueta(t)));
      seccion.append(encabezado('ph-info', 'Detalles'), ul);
      cuerpo.append(seccion);
    }
    if (leyes?.length) {
      const seccion = el('section');
      seccion.append(encabezado('ph-gavel', 'Leyes asociadas'));
      // El mismo name hace que al abrir una ley se cierre la anterior
      const grupo = `leyes-${++numeroDeLista}`;
      leyes.forEach(([nombre, articulos]) => {
        const ley = el('details', 'l2-ley');
        ley.name = grupo;
        const cab = el('summary');
        cab.append(icono('ph-caret-right'), nombre);
        ley.append(cab, el('p', '', articulos));
        seccion.append(ley);
      });
      cuerpo.append(seccion);
    }

    info.append(resumen, cuerpo);
    destino.append(info);
  };
})();
