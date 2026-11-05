/* Pasarela de pago SERFINSA (simulada): réplica de la pantalla real, que es de una empresa externa y no se puede modificar.
   Va arriba del todo en el modal de pago (#pasarela de tramite.html y pago.html); más abajo, con el scroll del modal, queda
   la propuesta de diseño de Simple.sv (encabezado azul, tarjeta y formulario) para plantear que se adopte.
   Los datos son de prueba y de solo lectura: pagar simula el cobro con el mismo flujo del modal, sin cobrar nada.
   Uso: PasarelaSerfinsa.montar(dialogo, { alPagar, alCerrar }); PasarelaSerfinsa.datos({ total, concepto, dui, titular });
   PasarelaSerfinsa.mostrar(true | false) (solo se ve en la vista de la tarjeta). */
(() => {
  const CSS = `
    .l2-sf { position: relative; display: flex; flex-direction: column; min-height: min(94dvh, 920px); padding: 22px 24px 16px; background: #F5F6F8; color: #777777; font-family: var(--font-family); text-align: center; }
    .l2-sf[hidden], .l2-sf-propuesta[hidden] { display: none; }
    .l2-sf-cerrar { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; border-radius: 50%; background: transparent; color: #777777; font-size: 20px; cursor: pointer; }
    .l2-sf-cerrar:hover { background: rgba(0, 0, 0, 0.06); }
    .l2-sf-cerrar:focus-visible, .l2-sf-pagar:focus-visible, .l2-sf-ver:focus-visible, .l2-sf-input:focus-visible { outline: 3px solid var(--border-focus); outline-offset: 2px; }
    .l2-sf-escudo { display: block; width: 121px; max-width: 100%; height: auto; margin: 0 auto; }
    .l2-sf hr { width: 100%; max-width: 340px; margin: 14px auto; border: 0; border-top: 1px solid #D9DADC; }
    .l2-sf h2 { margin: 0; color: #777777; font-size: 25px; font-weight: 300; letter-spacing: 0.2em; line-height: 1.3; text-transform: uppercase; }
    .l2-sf h2:focus { outline: none; }
    .l2-sf-form { width: 100%; max-width: 340px; margin: 0 auto; text-align: left; }
    .l2-sf-concepto { margin: 4px 0 0; color: #6B6B6B; font-size: 14px; font-weight: 700; line-height: 1.35; text-align: center; }
    .l2-sf-monto { margin: 4px 0 14px; color: #6B6B6B; font-size: 22px; font-weight: 700; text-align: center; }
    .l2-sf-fila { display: flex; gap: 12px; }
    .l2-sf-c { min-width: 0; margin-bottom: 14px; }
    .l2-sf-c-tarjeta { flex: 1; }
    .l2-sf-c-cvv { flex: 0 0 34%; }
    .l2-sf-c-mitad { flex: 1; }
    .l2-sf label { display: flex; align-items: center; gap: 6px; min-height: 22px; margin-bottom: 2px; color: #777777; font-size: 14px; }
    .l2-sf label i { font-size: 15px; }
    .l2-sf-marcas { display: inline-flex; align-items: center; gap: 6px; margin-left: 2px; }
    .l2-sf-marcas svg { display: block; height: 20px; width: auto; }
    /* Las mismas marcas en la tarjeta de la propuesta de Simple.sv, sobre una pastilla blanca para que se lean */
    .l2-tarjeta-marcas { display: inline-flex; align-items: center; padding: 5px 9px; border-radius: 999px; background: #FFFFFF; }
    .l2-tarjeta-marcas .l2-sf-marcas { margin: 0; gap: 7px; }
    .l2-tarjeta-marcas .l2-sf-marcas svg { height: 16px; }
    .l2-sf-input { display: block; width: 100%; height: 40px; padding: 0 10px; border: 1px solid #C8C9CC; border-radius: 10px; background: #FFFFFF; color: #555555; font: inherit; font-size: 15px; }
    .l2-sf-input:disabled { opacity: 1; -webkit-text-fill-color: #555555; }
    .l2-sf-pagar { display: block; width: 66%; min-height: 46px; margin: 18px auto 0; border: 1px solid #C8C9CC; border-radius: 999px; background: #777777; color: #FFFFFF; font: inherit; font-size: 17px; letter-spacing: 0.04em; cursor: pointer; }
    .l2-sf-pagar:hover { background: #666666; }
    .l2-sf-pie { margin: 22px 0 0; color: #7A7A7A; font-size: 12px; line-height: 1.4; }
    .l2-sf-prueba { margin: 10px auto 0; max-width: 340px; color: #8A8A8A; font-size: 12px; line-height: 1.4; }
    .l2-sf-ver { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; margin: auto auto 0; padding: 0 16px; border: 0; border-radius: 999px; background: none; color: var(--color-blue-primary); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
    .l2-sf-ver:hover { background: rgba(0, 102, 255, 0.08); }
    .l2-sf-ver i { font-size: 16px; animation: l2-sf-baja 1.6s ease-in-out infinite; }
    @keyframes l2-sf-baja { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
    .l2-sf-espacio { flex: 1; min-height: 12px; }
    .l2-sf-propuesta { display: flex; align-items: center; gap: 10px; padding: 12px 24px; border-top: 1px solid var(--border-subtle); background: var(--color-blue-soft); color: var(--color-blue-primary); font-size: 14px; font-weight: 800; }
    .l2-sf-propuesta i { flex-shrink: 0; font-size: 20px; }
    .l2-sf-propuesta small { display: block; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
    @media (max-width: 479px) {
      .l2-sf { padding: 20px 18px 12px; }
      .l2-sf-propuesta { padding: 12px 18px; }
      .l2-sf h2 { font-size: 22px; }
    }
    @media (prefers-reduced-motion: reduce) { .l2-sf-ver i { animation: none; } }
  `;

  // Escudo de El Salvador, tal como lo muestra la pantalla real de SERFINSA
  const ESCUDO = '<img class="l2-sf-escudo" src="img/escudo-el-salvador.png" width="121" height="100" alt="Escudo de El Salvador">';

  const MARCAS = `<span class="l2-sf-marcas" aria-hidden="true">
    <svg viewBox="0 0 48 20"><text x="0" y="16" font-family="Arial, sans-serif" font-size="18" font-weight="800" font-style="italic" fill="#1A1F71">VISA</text></svg>
    <svg viewBox="0 0 32 20"><circle cx="11" cy="10" r="9" fill="#EB001B"/><circle cx="21" cy="10" r="9" fill="#F79E1B"/><path d="M16 2.6a9 9 0 0 1 0 14.8 9 9 0 0 1 0-14.8Z" fill="#FF5F00"/></svg>
    <svg viewBox="0 0 44 28"><rect width="44" height="28" rx="3" fill="#00447C"/><path d="M5 0h13l-6 28H0Z" fill="#E21836"/><path d="M33 0h8a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H27Z" fill="#007B84"/><text x="22" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF">UnionPay</text></svg>
  </span>`;

  let raiz = null;

  function montar(dialogo, { alPagar, alCerrar }) {
    if (!document.getElementById('estilos-pasarela-serfinsa')) {
      const estilos = document.createElement('style');
      estilos.id = 'estilos-pasarela-serfinsa';
      estilos.textContent = CSS;
      document.head.append(estilos);
    }
    const sf = document.createElement('section');
    sf.className = 'l2-sf';
    sf.setAttribute('aria-label', 'Sección de pago de SERFINSA');
    sf.innerHTML = `
      <button class="l2-sf-cerrar" type="button" aria-label="Cerrar el pago"><i class="ph ph-x" aria-hidden="true"></i></button>
      ${ESCUDO}
      <hr>
      <h2 tabindex="-1">Sección de pago</h2>
      <hr>
      <div class="l2-sf-form">
        <p class="l2-sf-concepto"></p>
        <p class="l2-sf-monto"></p>
        <div class="l2-sf-fila">
          <div class="l2-sf-c l2-sf-c-tarjeta">
            <label for="sf-tarjeta">Tarjeta ${MARCAS}</label>
            <input class="l2-sf-input" id="sf-tarjeta" value="4111 1111 1111 1111" readonly>
          </div>
          <div class="l2-sf-c l2-sf-c-cvv">
            <label for="sf-cvv">CVV <i class="ph ph-question" aria-hidden="true" title="Los 3 dígitos que van al reverso de la tarjeta"></i></label>
            <input class="l2-sf-input" id="sf-cvv" value="123" readonly>
          </div>
        </div>
        <div class="l2-sf-c">
          <label for="sf-nombre">Nombre en la Tarjeta</label>
          <input class="l2-sf-input" id="sf-nombre" readonly>
        </div>
        <label id="sf-vence-etiqueta">Vencimiento</label>
        <div class="l2-sf-fila" role="group" aria-labelledby="sf-vence-etiqueta">
          <div class="l2-sf-c l2-sf-c-mitad"><select class="l2-sf-input" id="sf-mes" aria-label="Mes de vencimiento" disabled><option>12</option></select></div>
          <div class="l2-sf-c l2-sf-c-mitad"><select class="l2-sf-input" id="sf-anio" aria-label="Año de vencimiento" disabled><option>2030</option></select></div>
        </div>
        <button class="l2-sf-pagar" type="button">PAGAR</button>
      </div>
      <p class="l2-sf-pie">© 2020 Servicios Financieros S.A de C.V<br>Powered by SERFINSA</p>
      <p class="l2-sf-prueba">Pago de prueba: la tarjeta es de prueba y no se cobra nada</p>
      <span class="l2-sf-espacio"></span>
      <button class="l2-sf-ver" type="button">Ver la propuesta de diseño de Simple.sv<i class="ph ph-caret-down" aria-hidden="true"></i></button>`;

    const propuesta = document.createElement('div');
    propuesta.className = 'l2-sf-propuesta';
    propuesta.id = 'sf-propuesta';
    propuesta.innerHTML = '<i class="ph ph-sparkle" aria-hidden="true"></i><span>Propuesta de diseño de Simple.sv<small>Así se vería el pago dentro de Simple.sv</small></span>';

    // En la tarjeta de la propuesta, además de VISA, las demás marcas que acepta SERFINSA
    const red = dialogo.querySelector('.l2-tarjeta-red');
    if (red) {
      const marcas = document.createElement('span');
      marcas.className = 'l2-tarjeta-marcas';
      marcas.innerHTML = MARCAS;
      red.replaceWith(marcas);
    }

    dialogo.prepend(sf, propuesta);
    sf.querySelector('.l2-sf-pagar').addEventListener('click', alPagar);
    sf.querySelector('.l2-sf-cerrar').addEventListener('click', alCerrar);
    sf.querySelector('.l2-sf-ver').addEventListener('click', () => {
      const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      propuesta.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
    });
    raiz = { sf, propuesta };
  }

  function datos({ total, concepto, dui, titular }) {
    if (!raiz) return;
    raiz.sf.querySelector('.l2-sf-concepto').textContent = `Pago de ${concepto}${dui ? ` del DUI:${dui}` : ''}`;
    raiz.sf.querySelector('.l2-sf-monto').textContent = total;
    raiz.sf.querySelector('#sf-nombre').value = titular || '';
  }

  // Solo se ve en la vista de la tarjeta; al procesar y aprobar el modal muestra únicamente el diseño de Simple.sv
  function mostrar(visible) {
    if (!raiz) return;
    raiz.sf.hidden = !visible;
    raiz.propuesta.hidden = !visible;
  }

  window.PasarelaSerfinsa = { montar, datos, mostrar };
})();
