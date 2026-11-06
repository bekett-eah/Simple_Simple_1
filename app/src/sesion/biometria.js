/* Acceso biométrico (plan, fase 4) con @capgo/capacitor-native-biometric.
   La credencial del dispositivo se cifra con la clave pública de un par RSA de Android Keystore; la privada, la única
   que la descifra, exige biometría fuerte en cada uso (AccessControl.BIOMETRY_CURRENT_SET). Por eso guardar no muestra
   ningún aviso y leer sí: BiometricPrompt se muestra con un CryptoObject, así que la credencial no se puede leer sin
   una huella o un rostro válidos (biometría ligada a criptografía, no solo a un evento). La clave se invalida si
   cambian las huellas o rostros registrados y entonces hay que volver a entrar con Identidad Digital.
   La app nunca ve ni guarda datos biométricos: los maneja el sistema operativo. */
import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric';

export const CLAVE_CREDENCIAL = 'sv.simple.app.credencial-dispositivo';

export class ErrorBiometria extends Error {
  constructor(motivo, mensaje = motivo) {
    super(mensaje);
    this.name = 'ErrorBiometria';
    this.motivo = motivo; // cancelado | invalidada | bloqueada | fallida | no_disponible | desconocido
  }
}

/* Códigos del plugin (BiometricAuthError) → motivos de la app. 21: no hay datos protegidos; en Android también llega
   cuando cambiaron las huellas o rostros, porque el plugin borra la clave invalidada y lo cifrado con ella. */
const MOTIVOS = {
  1: 'no_disponible', 2: 'bloqueada', 3: 'no_disponible', 4: 'bloqueada', 10: 'fallida', 11: 'cancelado',
  14: 'no_disponible', 15: 'cancelado', 16: 'cancelado', 17: 'cancelado', 21: 'invalidada'
};
export const traducirError = error => (error instanceof ErrorBiometria ? error
  : new ErrorBiometria(MOTIVOS[Number(error?.code)] || 'desconocido', error?.message));

export function crearBiometriaNativa({ plugin = NativeBiometric } = {}) {
  return {
    simulada: false,
    async disponibilidad() {
      try {
        const r = await plugin.isAvailable({ useFallback: false });
        // Solo biometría fuerte (clase 3): es la única que puede liberar una clave de Keystore
        return { disponible: Boolean(r.isAvailable && r.strongBiometryIsAvailable), tipo: r.biometryType, codigo: r.errorCode ?? null };
      } catch (error) {
        return { disponible: false, tipo: null, codigo: error?.code ?? null };
      }
    },
    async guardar(valor) {
      try {
        await plugin.setData({ key: CLAVE_CREDENCIAL, value: valor, accessControl: AccessControl.BIOMETRY_CURRENT_SET });
      } catch (error) {
        throw traducirError(error);
      }
    },
    async leer({ titulo, subtitulo, cancelar }) {
      try {
        const { value } = await plugin.getSecureData({ key: CLAVE_CREDENCIAL, title: titulo, subtitle: subtitulo, negativeButtonText: cancelar });
        return value;
      } catch (error) {
        throw traducirError(error);
      }
    },
    async eliminar() {
      try { await plugin.deleteData({ key: CLAVE_CREDENCIAL }); } catch { /* ya no existía */ }
    }
  };
}

/* En el navegador de escritorio (desarrollo) no hay biometría ni Keystore: se simula con un aviso y localStorage.
   NO es seguro y solo existe para probar los flujos fuera del teléfono. Como en el teléfono, solo leer pide la
   huella. confirmar(texto) → Promise<boolean>. */
export function crearBiometriaSimulada({ confirmar, almacen }) {
  const CLAVE = 'simple-app-simulador-biometria';
  const pedir = async texto => { if (!(await confirmar(texto))) throw new ErrorBiometria('cancelado'); };
  return {
    simulada: true,
    async disponibilidad() { return { disponible: true, tipo: 'simulada', codigo: null }; },
    async guardar(valor) { almacen.guardar(CLAVE, valor); },
    async leer({ titulo }) {
      const valor = almacen.leer(CLAVE);
      if (!valor) throw new ErrorBiometria('invalidada');
      await pedir(titulo);
      return valor;
    },
    async eliminar() { almacen.borrar(CLAVE); }
  };
}
