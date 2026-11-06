/* Optimiza las imágenes de la copia del frontend para la app: las de los trámites llegan a medir 3380 px y pesan
   63 MB en total, pero en el teléfono se muestran a menos de 400 px de ancho. Se reducen y se recomprimen
   conservando nombre y formato (así no cambia ninguna referencia); si el resultado no pesa menos, queda el original.
   Los resultados se guardan en .cache/imagenes para no recalcularlos en cada build. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const VERSION = 1; // cambiarla invalida la caché si cambian los parámetros

function codificar(imagen, extension) {
  if (extension === '.png') return imagen.png({ compressionLevel: 9, palette: true, quality: 85, effort: 8 });
  return imagen.jpeg({ quality: 78, mozjpeg: true, progressive: true });
}

/* Optimiza un archivo en su lugar. anchoMaximo en píxeles. Devuelve { antes, despues } en bytes. */
export async function optimizar(ruta, { anchoMaximo, cache }) {
  const extension = path.extname(ruta).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(extension)) return null;
  const original = readFileSync(ruta);
  const huella = createHash('sha256').update(original).update(`${VERSION}|${anchoMaximo}`).digest('hex').slice(0, 32);
  const enCache = path.join(cache, `${huella}${extension}`);
  let resultado;
  if (existsSync(enCache)) {
    resultado = readFileSync(enCache);
  } else {
    const imagen = sharp(original, { failOn: 'error' }).rotate().resize({ width: anchoMaximo, height: anchoMaximo, fit: 'inside', withoutEnlargement: true });
    resultado = await codificar(imagen, extension).toBuffer();
    if (resultado.length >= original.length) resultado = original;
    mkdirSync(cache, { recursive: true });
    writeFileSync(enCache, resultado);
  }
  if (resultado !== original) writeFileSync(ruta, resultado);
  return { antes: original.length, despues: resultado.length };
}
