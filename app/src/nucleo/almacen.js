/* localStorage y sessionStorage en JSON, sin fallar si el almacenamiento no está disponible (igual que el resto del
   frontend). Lo sensible no va aquí: la credencial del dispositivo vive en el Keystore (sesion/biometria.js). */
export function crearAlmacen(storage) {
  return {
    leer(clave, porDefecto = null) {
      try {
        const valor = storage.getItem(clave);
        return valor === null ? porDefecto : JSON.parse(valor);
      } catch {
        return porDefecto;
      }
    },
    guardar(clave, valor) {
      try { storage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
    },
    borrar(clave) {
      try { storage.removeItem(clave); } catch { /* sin almacenamiento */ }
    }
  };
}

// Almacén en memoria con la misma interfaz de Storage (pruebas y navegadores sin almacenamiento)
export function storageEnMemoria() {
  const datos = new Map();
  return {
    getItem: clave => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => { datos.set(clave, String(valor)); },
    removeItem: clave => { datos.delete(clave); },
    clear: () => datos.clear()
  };
}
