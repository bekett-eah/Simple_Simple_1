/* Backend simulado para desarrollo y pruebas: implementa en el teléfono el mismo contrato que backend-http.js
   (docs/api/contrato-backend.yaml), con sus reglas (renovación de un solo uso, credenciales revocables,
   idempotencia, estados de pago), para que la app se pueda usar y probar sin el backend real. También sirve de
   especificación ejecutable del contrato (tests/sesion.test.mjs y tests/pagos.test.mjs).
   Guarda su estado en localStorage porque la app recarga el JavaScript en cada página. No es seguro ni pretende
   serlo: la validación del build impide usarlo en producción. */
import { ErrorHttp } from '../nucleo/http.js';
import { transicionValida } from '../pagos/estados.js';

const CLAVE = 'simple-app-simulador-backend';
const VIDA_ACCESO = 15 * 60;            // segundos
const VIDA_CREDENCIAL = 30 * 24 * 3600; // segundos
const VIDA_ORDEN = 30 * 60;             // segundos

const vacio = () => ({ sesiones: {}, renovaciones: {}, dispositivos: {}, ordenes: {}, idempotencia: {}, intentos: {} });
const rechazo = (estado, codigo, mensaje) => new ErrorHttp(mensaje, { estado, codigo, datos: { codigo, mensaje } });

// "$10.00 *(Modalidad única)*" → 1000 centavos; sin monto → null (el trámite no tiene costo o no está indicado)
export function centavosDe(costo) {
  const monto = String(costo || '').match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (!monto) return null;
  const [enteros, decimales = ''] = monto[1].replace(/,/g, '').split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/* usuario: la cuenta de prueba de la maqueta (nuevoDiseño/ciudadano.js). tramiteDe(solicitudId) → { numero, nombre,
   costo } o null: el simulador busca el trámite de la solicitud como lo haría el backend real. */
export function crearBackendSimulado({ almacen, usuario, tramiteDe, ahora = Date.now, nuevoId = () => globalThis.crypto.randomUUID(), latencia = () => Promise.resolve() }) {
  const leer = () => ({ ...vacio(), ...almacen.leer(CLAVE, {}) });
  // Cada operación lee, cambia y guarda el estado completo
  async function operar(funcion) {
    await latencia();
    const estado = leer();
    const resultado = funcion(estado);
    almacen.guardar(CLAVE, estado);
    return structuredClone(resultado);
  }
  const segundos = () => Math.floor(ahora() / 1000);

  function emitir(estado, dispositivoId) {
    const accessToken = `acc-${nuevoId()}`;
    const refreshToken = `ren-${nuevoId()}`;
    estado.sesiones[accessToken] = { dispositivoId, vence: segundos() + VIDA_ACCESO };
    estado.renovaciones[refreshToken] = { dispositivoId, accessToken };
    return { accessToken, refreshToken, expiraEnSegundos: VIDA_ACCESO, usuario };
  }

  function autorizar(estado, token) {
    const sesion = estado.sesiones[token];
    if (!sesion || sesion.vence <= segundos()) throw rechazo(401, 'token_invalido', 'La sesión no es válida');
    return sesion;
  }

  function vistaDeOrden(orden) {
    const { claveIdempotencia, ...publica } = orden;
    return publica;
  }

  return {
    simulado: true,

    crearSesion: ({ proveedor, code, codeVerifier, nonce, dispositivo }) => operar(estado => {
      if (proveedor !== 'simulado' || !String(code).startsWith('simulado-') || !codeVerifier || !nonce || !dispositivo?.id) {
        throw rechazo(400, 'solicitud_invalida', 'Faltan datos del inicio de sesión');
      }
      return emitir(estado, dispositivo.id);
    }),

    // La renovación es de un solo uso: reutilizarla revoca la sesión (detección de robo del token)
    renovarSesion: ({ refreshToken, dispositivoId }) => operar(estado => {
      const renovacion = estado.renovaciones[refreshToken];
      if (!renovacion || renovacion.dispositivoId !== dispositivoId) throw rechazo(401, 'renovacion_invalida', 'Vuelve a iniciar sesión');
      delete estado.renovaciones[refreshToken];
      delete estado.sesiones[renovacion.accessToken];
      return emitir(estado, dispositivoId);
    }),

    cerrarSesion: ({ token }) => operar(estado => {
      delete estado.sesiones[token];
      Object.entries(estado.renovaciones).forEach(([clave, r]) => { if (r.accessToken === token) delete estado.renovaciones[clave]; });
      return null;
    }),

    registrarDispositivo: ({ token, dispositivo }) => operar(estado => {
      const sesion = autorizar(estado, token);
      if (dispositivo?.id !== sesion.dispositivoId) throw rechazo(403, 'dispositivo_distinto', 'El dispositivo no coincide con la sesión');
      const credencial = `cred-${nuevoId()}`;
      estado.dispositivos[dispositivo.id] = { credencial, vence: segundos() + VIDA_CREDENCIAL, plataforma: dispositivo.plataforma };
      return { credencial, expiraEnSegundos: VIDA_CREDENCIAL };
    }),

    sesionConDispositivo: ({ credencial, dispositivoId }) => operar(estado => {
      const registro = estado.dispositivos[dispositivoId];
      if (!registro || registro.credencial !== credencial || registro.vence <= segundos()) {
        throw rechazo(401, 'credencial_invalida', 'Este dispositivo no está autorizado');
      }
      return emitir(estado, dispositivoId);
    }),

    desvincularDispositivo: ({ token, dispositivoId }) => operar(estado => {
      autorizar(estado, token);
      delete estado.dispositivos[dispositivoId];
      return null;
    }),

    /* La misma clave de idempotencia devuelve la misma orden; el monto lo calcula el backend a partir del trámite.
       Tampoco hay dos órdenes vigentes para una solicitud: con otra clave (el teléfono perdió la suya o el pago ya se
       aprobó) se devuelve la que existe. Solo una orden vencida o reembolsada deja crear otra. */
    crearOrdenPago: ({ token, solicitudId, claveIdempotencia }) => operar(estado => {
      autorizar(estado, token);
      if (!claveIdempotencia) throw rechazo(400, 'falta_idempotencia', 'Falta la clave de idempotencia');
      const existente = estado.idempotencia[claveIdempotencia];
      if (existente) {
        if (estado.ordenes[existente].solicitudId !== solicitudId) throw rechazo(422, 'idempotencia_reutilizada', 'La clave ya se usó para otra solicitud');
        return vistaDeOrden(estado.ordenes[existente]);
      }
      const vigente = Object.values(estado.ordenes).find(o => o.solicitudId === solicitudId && o.estado !== 'expirado' && o.estado !== 'reembolsado');
      if (vigente) {
        estado.idempotencia[claveIdempotencia] = vigente.id;
        return vistaDeOrden(vigente);
      }
      const tramite = tramiteDe(solicitudId);
      const centavos = tramite ? centavosDe(tramite.costo) : null;
      if (!centavos) throw rechazo(422, 'sin_costo', 'La solicitud no tiene un pago pendiente');
      const orden = {
        id: `ord-${nuevoId()}`, solicitudId, claveIdempotencia, concepto: tramite.nombre,
        monto: { centavos, moneda: 'USD' }, estado: 'pendiente', metodos: ['tarjeta'],
        creadaEn: new Date(ahora()).toISOString(), expiraEn: new Date(ahora() + VIDA_ORDEN * 1000).toISOString(), historial: []
      };
      estado.ordenes[orden.id] = orden;
      estado.idempotencia[claveIdempotencia] = orden.id;
      return vistaDeOrden(orden);
    }),

    iniciarPago: ({ token, ordenId, metodo, claveIdempotencia }) => operar(estado => {
      autorizar(estado, token);
      const orden = estado.ordenes[ordenId];
      if (!orden) throw rechazo(404, 'orden_inexistente', 'No existe la orden');
      if (estado.intentos[claveIdempotencia]) return { id: claveIdempotencia, tipo: 'simulada', ordenId };
      if (!orden.metodos.includes(metodo)) throw rechazo(422, 'metodo_no_disponible', 'Método no disponible');
      if (!transicionValida(orden.estado, 'procesando')) throw rechazo(409, 'estado_invalido', `La orden está ${orden.estado}`);
      orden.estado = 'procesando';
      orden.historial.push({ estado: 'procesando', en: new Date(ahora()).toISOString() });
      estado.intentos[claveIdempotencia] = { ordenId, metodo };
      return { id: claveIdempotencia, tipo: 'simulada', ordenId };
    }),

    consultarOrden: ({ token, ordenId }) => operar(estado => {
      autorizar(estado, token);
      const orden = estado.ordenes[ordenId];
      if (!orden) throw rechazo(404, 'orden_inexistente', 'No existe la orden');
      return vistaDeOrden(orden);
    }),

    // Lo que en el sistema real llega al backend como notificación firmada de la pasarela (nunca desde la app)
    simularRespuestaPasarela: ({ intentoId, aprobado }) => operar(estado => {
      const intento = estado.intentos[intentoId];
      const orden = intento && estado.ordenes[intento.ordenId];
      if (!orden) throw rechazo(404, 'intento_inexistente', 'No existe el intento');
      const nuevo = aprobado ? 'aprobado' : 'rechazado';
      if (transicionValida(orden.estado, nuevo)) {
        orden.estado = nuevo;
        orden.historial.push({ estado: nuevo, en: new Date(ahora()).toISOString(), ...(aprobado ? { autorizacion: nuevoId().slice(0, 6).toUpperCase() } : {}) });
      }
      return null;
    })
  };
}
