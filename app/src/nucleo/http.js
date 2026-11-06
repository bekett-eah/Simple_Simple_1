/* Cliente HTTP del backend de la app (docs/api/contrato-backend.yaml).
   - Siempre JSON, sin cookies (credentials: 'omit') y sin seguir redirecciones: el token no puede terminar en otro
     servidor por una redirección.
   - Tiempo máximo por intento.
   - Reintenta solo lo que se puede repetir sin efectos dobles: GET, DELETE y POST con clave de idempotencia
     (Idempotency-Key), ante falla de red, 429 o 5xx, con espera exponencial y Retry-After. */
export class ErrorHttp extends Error {
  constructor(mensaje, { estado = 0, codigo = 'error', datos = null } = {}) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.codigo = codigo;
    this.datos = datos;
  }
}

const esperaPorDefecto = ms => new Promise(resolver => setTimeout(resolver, ms));

function retardo(intento, respuesta) {
  const segundos = Number(respuesta?.headers?.get?.('Retry-After'));
  if (Number.isFinite(segundos) && segundos >= 0) return Math.min(segundos, 10) * 1000;
  return Math.min(4000, 300 * 2 ** intento) * (0.5 + Math.random() / 2);
}

async function leerJson(respuesta) {
  const texto = await respuesta.text();
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

export function crearClienteHttp({ base, fetch = globalThis.fetch.bind(globalThis), esperar = esperaPorDefecto, tiempoMaximo = 15000, reintentos = 2 }) {
  if (!base) throw new Error('Falta la dirección del backend');
  const raiz = base.endsWith('/') ? base : `${base}/`;

  async function pedir(metodo, ruta, { cuerpo, token, claveIdempotencia } = {}) {
    const url = new URL(ruta.replace(/^\//, ''), raiz);
    const repetible = metodo === 'GET' || metodo === 'DELETE' || Boolean(claveIdempotencia);
    const cabeceras = { Accept: 'application/json' };
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (token) cabeceras.Authorization = `Bearer ${token}`;
    if (claveIdempotencia) cabeceras['Idempotency-Key'] = claveIdempotencia;

    for (let intento = 0; ; intento++) {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), tiempoMaximo);
      let respuesta;
      try {
        respuesta = await fetch(url.href, {
          method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
          signal: control.signal, credentials: 'omit', cache: 'no-store', redirect: 'error'
        });
      } catch (error) {
        if (repetible && intento < reintentos) { await esperar(retardo(intento)); continue; }
        throw new ErrorHttp('No hubo respuesta del servidor', { codigo: error?.name === 'AbortError' ? 'tiempo_agotado' : 'sin_red' });
      } finally {
        clearTimeout(reloj);
      }
      const datos = await leerJson(respuesta);
      if (respuesta.ok) return datos;
      if (repetible && intento < reintentos && (respuesta.status === 429 || respuesta.status >= 500)) {
        await esperar(retardo(intento, respuesta));
        continue;
      }
      throw new ErrorHttp(datos?.mensaje || `El servidor respondió ${respuesta.status}`, {
        estado: respuesta.status, codigo: datos?.codigo || `http_${respuesta.status}`, datos
      });
    }
  }

  return {
    get: (ruta, opciones) => pedir('GET', ruta, opciones),
    post: (ruta, opciones) => pedir('POST', ruta, opciones),
    delete: (ruta, opciones) => pedir('DELETE', ruta, opciones)
  };
}
