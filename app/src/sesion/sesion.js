/* Sesión de la app (plan, fases 3 y 4). La fuente de verdad es el backend: aquí solo se guardan los tokens que él
   entrega y se piden de nuevo cuando vencen.
   - Token de acceso y de renovación: en sessionStorage, que muere con el proceso de la app. La app tiene varias
     páginas y cada navegación recarga el JavaScript, así que la memoria de una página no alcanza.
   - Credencial del dispositivo (para entrar con biometría): solo si la persona activa la biometría, cifrada en
     Keystore y ligada a la huella o el rostro (sesion/biometria.js). Nunca se guardan contraseñas de Identidad Digital.
   - 'simple-sesion' en localStorage: la marca que usan las páginas de la maqueta web (nuevoDiseño/sesion.js) para
     mostrar la vista con sesión. Aquí se mantiene al día con la sesión real.
   - Bloqueo por inactividad: al volver de segundo plano después de N minutos hay que desbloquear de nuevo. */
import { ErrorBiometria } from './biometria.js';

export const CLAVES = {
  sesion: 'simple-app-sesion',
  segundoPlano: 'simple-app-segundo-plano',
  marcaMaqueta: 'simple-sesion',
  biometria: 'simple-app-biometria',
  dispositivo: 'simple-app-dispositivo'
};

export class ErrorSesion extends Error {
  constructor(motivo, mensaje = motivo) {
    super(mensaje);
    this.name = 'ErrorSesion';
    this.motivo = motivo; // sin_sesion | expirada | credencial_revocada | biometria_cambiada
  }
}

const TEXTOS_BIOMETRIA = {
  activar: { titulo: 'Activa el ingreso con biometría', subtitulo: 'Confirma con tu huella o tu rostro', cancelar: 'Cancelar' },
  desbloquear: { titulo: 'Ingresa a Simple.sv', subtitulo: 'Usa tu huella o tu rostro', cancelar: 'Usar Identidad Digital' }
};

/* backend: backend/backend-http.js o backend/backend-simulado.js. biometria: sesion/biometria.js.
   almacenSesion / almacenLocal: nucleo/almacen.js sobre sessionStorage / localStorage.
   marca: { poner(), quitar() } de la marca de la maqueta. */
export function crearGestorSesion({ backend, biometria, almacenSesion, almacenLocal, marca, plataforma = 'web', config, ahora = Date.now, nuevoId = () => globalThis.crypto.randomUUID() }) {
  const anticipacion = (config.segundosRenovacionAnticipada ?? 60) * 1000;
  const limiteInactividad = (config.minutosInactividad ?? 5) * 60 * 1000;

  const leer = () => almacenSesion.leer(CLAVES.sesion);
  const usuarioDe = s => (s ? { ...s.usuario } : null);

  function dispositivo() {
    let id = almacenLocal.leer(CLAVES.dispositivo);
    if (!id) { id = nuevoId(); almacenLocal.guardar(CLAVES.dispositivo, id); }
    return { id, plataforma };
  }

  function guardar(respuesta, usuario) {
    const sesion = {
      accessToken: respuesta.accessToken,
      refreshToken: respuesta.refreshToken,
      expiraEn: ahora() + respuesta.expiraEnSegundos * 1000,
      usuario: respuesta.usuario || usuario
    };
    almacenSesion.guardar(CLAVES.sesion, sesion);
    almacenSesion.borrar(CLAVES.segundoPlano);
    marca.poner();
    return usuarioDe(sesion);
  }

  // Quita la sesión de este proceso (tokens y marca). La credencial biométrica queda para el próximo ingreso.
  function limpiar() {
    almacenSesion.borrar(CLAVES.sesion);
    almacenSesion.borrar(CLAVES.segundoPlano);
    marca.quitar();
  }

  async function olvidarBiometria() {
    await biometria.eliminar();
    almacenLocal.borrar(CLAVES.biometria);
  }

  // Token de acceso vigente; lo renueva si está por vencer. Si el backend ya no acepta la renovación, termina la sesión.
  async function obtenerToken() {
    const sesion = leer();
    if (!sesion) throw new ErrorSesion('sin_sesion', 'No hay sesión iniciada');
    if (sesion.expiraEn - ahora() > anticipacion) return sesion.accessToken;
    try {
      const respuesta = await backend.renovarSesion({ refreshToken: sesion.refreshToken, dispositivoId: dispositivo().id });
      guardar(respuesta, sesion.usuario);
      return respuesta.accessToken;
    } catch (error) {
      if (error?.estado === 400 || error?.estado === 401) {
        limpiar();
        throw new ErrorSesion('expirada', 'La sesión venció; vuelve a ingresar');
      }
      throw error;
    }
  }

  // Cerrar sesión: el backend revoca los tokens (si no responde, igual se cierran en el teléfono)
  async function cerrar() {
    const sesion = leer();
    limpiar();
    if (sesion) await backend.cerrarSesion({ token: sesion.accessToken }).catch(() => {});
  }

  return {
    dispositivo,
    cerrar,
    actual: () => usuarioDe(leer()),
    haySesion: () => Boolean(leer()?.refreshToken),
    biometriaActiva: () => almacenLocal.leer(CLAVES.biometria) === true,
    obtenerToken,

    // Primer ingreso: el backend canjea el resultado del proveedor de identidad por una sesión de la app
    async iniciar(resultadoIdentidad) {
      const respuesta = await backend.crearSesion({ ...resultadoIdentidad, dispositivo: dispositivo() });
      return guardar(respuesta);
    },

    async biometriaDisponible() {
      return (await biometria.disponibilidad()).disponible;
    },

    /* El backend entrega una credencial para este dispositivo (revocable y con vencimiento) y se guarda protegida
       por biometría. Guardarla no pide la huella (se cifra con la clave pública); se lee una vez para que la persona
       confirme y para comprobar que funciona (plan, fase 4). Si no se confirma, se borra y el backend la revoca. */
    async activarBiometria() {
      const token = await obtenerToken();
      const { credencial } = await backend.registrarDispositivo({ token, dispositivo: dispositivo() });
      try {
        await biometria.guardar(credencial);
        if (await biometria.leer(TEXTOS_BIOMETRIA.activar) !== credencial) throw new ErrorBiometria('fallida');
      } catch (error) {
        await biometria.eliminar();
        await backend.desvincularDispositivo({ token, dispositivoId: dispositivo().id }).catch(() => {});
        throw error;
      }
      almacenLocal.guardar(CLAVES.biometria, true);
    },

    async desactivarBiometria() {
      const token = await obtenerToken().catch(() => null);
      await olvidarBiometria();
      if (token) await backend.desvincularDispositivo({ token, dispositivoId: dispositivo().id }).catch(() => {});
    },

    /* Ingreso posterior: la biometría libera la credencial y el backend la cambia por una sesión nueva. Si la
       biometría del teléfono cambió o el backend revocó la credencial, se borra y hay que entrar con Identidad Digital. */
    async desbloquear() {
      let credencial;
      try {
        credencial = await biometria.leer(TEXTOS_BIOMETRIA.desbloquear);
      } catch (error) {
        if (error instanceof ErrorBiometria && error.motivo === 'invalidada') {
          await olvidarBiometria();
          throw new ErrorSesion('biometria_cambiada', 'La biometría del teléfono cambió; vuelve a ingresar con Identidad Digital');
        }
        throw error;
      }
      try {
        return guardar(await backend.sesionConDispositivo({ credencial, dispositivoId: dispositivo().id }));
      } catch (error) {
        if (error?.estado === 401 || error?.estado === 403) {
          await olvidarBiometria();
          throw new ErrorSesion('credencial_revocada', 'Este dispositivo ya no está autorizado; vuelve a ingresar con Identidad Digital');
        }
        throw error;
      }
    },

    // Desvincular: además de cerrar la sesión, el backend olvida este dispositivo y se borra la credencial biométrica
    async desvincular() {
      const token = await obtenerToken().catch(() => null);
      if (token) await backend.desvincularDispositivo({ token, dispositivoId: dispositivo().id }).catch(() => {});
      await olvidarBiometria();
      await cerrar();
    },

    // Bloqueo por inactividad: se anota cuándo pasó a segundo plano y al volver se decide si hay que desbloquear
    pasarASegundoPlano() {
      if (leer()) almacenSesion.guardar(CLAVES.segundoPlano, ahora());
    },
    volverAlFrente() {
      const desde = almacenSesion.leer(CLAVES.segundoPlano);
      almacenSesion.borrar(CLAVES.segundoPlano);
      if (!leer() || desde === null || ahora() - desde < limiteInactividad) return false;
      limpiar();
      return true;
    },

    // Al cargar cada página: sin sesión en este proceso, la marca de la maqueta no puede quedar puesta
    sincronizarMarca() {
      if (leer()) marca.poner();
      else marca.quitar();
    }
  };
}
