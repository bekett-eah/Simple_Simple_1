/* Términos y condiciones de Simple.sv (mismo texto que el portal actual).
   Cualquier elemento con [data-terminos] abre la ventana. Se comparte entre todas las páginas del nuevo diseño. */
(() => {
  const TEXTO = `
    <h3>¡Bienvenido(a) a Simple.sv!</h3>
    <p>Nos alegra mucho que utilices este servicio digital del Gobierno de El Salvador. Queremos que tu experiencia en <strong>www.simple.sv</strong> (que llamaremos <em>«Ventanilla»</em> de ahora en adelante) sea clara y sencilla. Por eso, hemos preparado estos Términos y Condiciones de Uso (o simplemente <em>“Términos”</em>) para que sepas cómo funciona todo</p>
    <p>La Ventanilla es de la Secretaría de Innovación de la Presidencia de El Salvador (a quien llamaremos <strong>«la Secretaría»</strong>), ubicada en Casa Presidencial, Alameda Manuel Enrique Araujo, #5500, San Salvador, El Salvador</p>
    <p>Al usar la Ventanilla, sus servicios o sus contenidos, estás aceptando completamente todo lo que dice la versión de estos Términos que esté publicada en el momento en que nos visites</p>
    <p>Es importante que sepas que la Secretaría puede cambiar estos Términos en cualquier momento. Por eso, te recomendamos leerlos cada vez que vayas a usar la Ventanilla. Las nuevas versiones empezarán a aplicarse desde que se publiquen aquí</p>
    <p>Estos Términos son solo aplicables para simple.sv. Si sales de nuestra Ventanilla a otros sitios o servicios, ellos tendrán sus propios términos y condiciones, que no están cubiertos por estos</p>
    <p class="tc-nota"><strong>Recuerda:</strong> las acciones u omisiones relacionadas con los trámites que hagas a través de simple.sv son responsabilidad de cada institución que pone a tu disposición sus trámites de forma digital</p>

    <h4><span>1</span>¿Para qué sirve la Ventanilla?</h4>
    <p>La Ventanilla es tu punto único de acceso para encontrar, de forma centralizada, información, trámites y servicios que ofrecen las distintas instituciones públicas. La información que ves aquí es creada y mantenida por esas instituciones. Nosotros solo te facilitamos el acceso a esa información a través de enlaces, como un servicio para ti. Cuando entres a esos enlaces, podrías estar sujeto(a) a los términos y condiciones de cada institución, además de los nuestros</p>

    <h4><span>2</span>¿Quién es un usuario?</h4>
    <p>Para estos Términos, eres un <strong>«usuario»</strong> si entras a este sitio para informarte o usar la Ventanilla y su contenido, ya sea directamente o a través de una aplicación</p>

    <h4><span>3</span>Condiciones para usar nuestro sitio web</h4>
    <p>Usar la Ventanilla es gratis para ti. Te comprometes a usarla respetando las leyes de El Salvador, las buenas costumbres y el orden público, y a no causar daños a la Secretaría, a otros usuarios o a terceros</p>
    <p>Es posible que algunos trámites disponibles en la Ventanilla tengan costos, los cuales son establecidos por cada institución y son su exclusiva responsabilidad. Simple.sv no recibe ningún tipo de ingresos por los trámites que realices aquí</p>
    <p>Te pedimos que no uses la Ventanilla, su contenido o cualquiera de sus servicios para fines ilegales, prohibidos por estos Términos o por cualquier norma, o que puedan dañar los derechos e intereses de la Secretaría, de otros usuarios o de terceros</p>
    <p>A menos que se indique lo contrario, la información en la Ventanilla se considera pública y es responsabilidad de la institución dueña de esa información. Si su uso o manejo está sujeto a alguna restricción, deberás seguir lo que se indique expresamente en ese caso</p>

    <h4><span>4</span>Tus obligaciones como usuario</h4>
    <ul>
      <li>No dañar, inutilizar o deteriorar los sistemas informáticos que soportan la Ventanilla</li>
      <li>No modificar esos sistemas ni usar versiones alteradas para acceder sin autorización</li>
      <li>No interferir en el acceso y uso del sitio ni incumplir políticas de red asociadas</li>
    </ul>
    <p>La Secretaría podrá tomar las medidas que considere necesarias contra cualquier uso que infrinja estos Términos o viole derechos de terceros</p>
    <p>La Secretaría se reserva el derecho de modificar la presentación, contenidos o servicios del sitio en cualquier momento y sin previo aviso</p>

    <h4><span>5</span>Cookies</h4>
    <p>La Ventanilla utiliza «cookies» para mejorar tu experiencia. Puedes configurar tu navegador para que te avise cuando recibas cookies o para impedir que se instalen</p>

    <h4><span>6</span>Propiedad intelectual</h4>
    <p>Todas las marcas, nombres comerciales u otros signos distintivos que puedan aparecer en este sitio web son propiedad de la Secretaría o de terceros. Usarlos no te otorga ningún derecho</p>

    <h4><span>7</span>Responsabilidad del titular de la Ventanilla</h4>
    <p>La información publicada en la Ventanilla es responsabilidad de la institución que la proporciona. La Secretaría no es responsable por la disponibilidad, fiabilidad o continuidad del servicio</p>
    <p>Tampoco se hace responsable por los tiempos de espera, procesamiento o resolución de trámites, ya que eso corresponde a cada institución pública</p>
    <p>La Secretaría solo proporciona la plataforma tecnológica para facilitar el acceso</p>

    <h4><span>8</span>Enlaces a otros sitios o portales</h4>
    <p>La Ventanilla puede contener enlaces a sitios de terceros. La Secretaría no se responsabiliza por los servicios o contenidos disponibles en ellos</p>

    <h4><span>9</span>Duración y finalización</h4>
    <p>La Ventanilla tiene duración indefinida, pero la Secretaría puede suspender sus servicios total o parcialmente, sin previo aviso</p>

    <h4><span>10</span>Protección de tus datos personales</h4>
    <p>Al brindar tus datos personales, autorizas su tratamiento conforme a la normativa vigente. Serán usados exclusivamente para el fin que fueron proporcionados</p>

    <h4><span>11</span>Retiro y suspensión de los servicios</h4>
    <p>La Secretaría podrá suspender los servicios de la Ventanilla si no cumples estos Términos</p>

    <h4><span>12</span>Legislación aplicable y jurisdicción</h4>
    <p>Cualquier conflicto se resolverá ante los tribunales ordinarios de San Salvador, conforme a la ley salvadoreña</p>

    <h4><span>13</span>¿Cómo reportar contenidos?</h4>
    <p>Si encuentras contenido erróneo o irregular, puedes escribirnos al correo: <a href="mailto:contacto@simple.sv">contacto@simple.sv</a></p>
  `;

  const ESTILOS = `
    .tc-dialogo { width: min(760px, calc(100% - 32px)); max-height: min(86vh, 900px); margin: auto; padding: 0; border: none; border-radius: var(--radius-card, 24px); background: #FFFFFF; color: var(--text-primary, #0E1428); box-shadow: 0 30px 60px rgba(14, 20, 40, 0.25); font-family: var(--font-family, sans-serif); overflow: hidden; }
    .tc-dialogo[open] { display: flex; flex-direction: column; animation: tc-entra 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .tc-dialogo::backdrop { background: rgba(14, 20, 40, 0.55); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
    @keyframes tc-entra { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }
    .tc-cabeza { display: flex; align-items: center; gap: 14px; padding: 20px 20px 20px 24px; background: linear-gradient(135deg, var(--color-navy-deep, #1C1E4D), var(--color-navy-deep, #1C1E4D)); color: #FFFFFF; }
    .tc-cabeza > i { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px; background: #FFFFFF; color: var(--color-navy-deep, #1C1E4D); font-size: 22px; }
    .tc-cabeza h2 { flex: 1; margin: 0; font-size: 20px; font-weight: 800; line-height: 1.2; }
    .tc-cerrar { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 44px; height: 44px; border: none; border-radius: 50%; background: rgba(255, 255, 255, 0.14); color: #FFFFFF; font-size: 20px; cursor: pointer; }
    .tc-cerrar:hover { background: rgba(255, 255, 255, 0.26); }
    .tc-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 28px 24px; font-size: 15px; line-height: 1.6; color: var(--text-secondary, #475569); }
    .tc-cuerpo h3 { margin: 18px 0 8px; color: var(--color-navy-deep, #1C1E4D); font-size: 20px; font-weight: 800; }
    .tc-cuerpo h4 { display: flex; align-items: center; gap: 10px; margin: 26px 0 8px; color: var(--color-navy-deep, #1C1E4D); font-size: 16px; font-weight: 800; }
    .tc-cuerpo h4 span { display: flex; align-items: center; justify-content: center; flex-shrink: 0; min-width: 28px; height: 28px; padding: 0 6px; border-radius: 9px; background: var(--color-blue-soft, #EFF6FF); color: var(--color-navy-deep, #1C1E4D); font-size: 13px; }
    .tc-cuerpo p, .tc-cuerpo ul { margin: 0 0 10px; }
    .tc-cuerpo ul { padding-left: 22px; }
    .tc-cuerpo li { margin-bottom: 4px; }
    .tc-cuerpo p, .tc-cuerpo li { text-align: justify; hyphens: auto; }
    .tc-cuerpo strong { color: var(--text-primary, #0E1428); }
    .tc-cuerpo a { color: var(--color-navy-deep, #1C1E4D); font-weight: 700; }
    .tc-nota { padding: 12px 14px; border-radius: 14px; background: var(--color-blue-soft, #EFF6FF); }
    .tc-pie { display: flex; justify-content: center; padding: 14px 20px; border-top: 1px solid var(--border-subtle, #E2E8F0); }
    .tc-pie button { min-height: 44px; padding: 10px 22px; border: none; border-radius: var(--radius-pill, 9999px); background: var(--color-blue-primary, #0066FF); color: #FFFFFF; font: inherit; font-weight: 700; cursor: pointer; }
    .tc-pie button:hover { background: var(--color-blue-hover, #0052CC); }
    .tc-cerrar:focus-visible, .tc-pie button:focus-visible, .tc-cuerpo a:focus-visible { outline: 3px solid var(--border-focus, #0066FF); outline-offset: 2px; }
    .tc-cerrar:focus-visible { outline-color: #FFFFFF; }
    @media (max-width: 560px) { .tc-cuerpo { padding: 4px 18px 20px; } }
    @media (prefers-reduced-motion: reduce) { .tc-dialogo[open] { animation: none; } }
  `;

  let dialogo = null;

  function crear() {
    const estilo = document.createElement('style');
    estilo.textContent = ESTILOS;
    document.head.appendChild(estilo);

    dialogo = document.createElement('dialog');
    dialogo.className = 'tc-dialogo';
    dialogo.setAttribute('aria-labelledby', 'tc-titulo');
    dialogo.innerHTML = `
      <div class="tc-cabeza">
        <i class="ph ph-scroll" aria-hidden="true"></i>
        <h2 id="tc-titulo">Términos y condiciones</h2>
        <button type="button" class="tc-cerrar" aria-label="Cerrar términos y condiciones"><i class="ph ph-x" aria-hidden="true"></i></button>
      </div>
      <div class="tc-cuerpo" tabindex="0">${TEXTO}</div>
      <div class="tc-pie"><button type="button">Entendido</button></div>`;
    dialogo.querySelectorAll('.tc-cerrar, .tc-pie button').forEach(b => b.addEventListener('click', () => dialogo.close()));
    // Clic fuera de la ventana (en el fondo oscuro) la cierra
    dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });
    document.body.appendChild(dialogo);
  }

  document.addEventListener('click', e => {
    const disparador = e.target.closest('[data-terminos]');
    if (!disparador) return;
    e.preventDefault();
    if (!dialogo) crear();
    dialogo.showModal();
    dialogo.querySelector('.tc-cuerpo').scrollTop = 0;
  });
})();
