/* Ícono y pantalla de arranque de Android a partir de la marca de Simple.sv: las dos barras del favicon de
   index.html. Uso: npm run iconos (después de npx cap add android). Escribe en android/app/src/main/res:
   - Ícono adaptable (Android 8 o superior) como vector, con capa monocromática para los íconos temáticos de Android 13.
   - PNG del ícono para Android 7 (mipmap-*dpi) y de la pantalla de arranque (drawable*, splash.png).
   Quita los íconos de Capacitor que trae la plantilla. */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RES = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const FONDO_ICONO = '#FFFFFF';
const FONDO_ARRANQUE = '#F4F8FE';
// Marca en la caja de 32 × 32 del favicon de index.html
const BARRAS = [
  { x: 0, y: 11, ancho: 32, alto: 7, radio: 3, color: '#0066FF' },
  { x: 0, y: 21, ancho: 24, alto: 7, radio: 3, color: '#1C1E4D' }
];
const CENTRO_MARCA = { x: 16, y: 19.5 };
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Mismos tamaños que la plantilla de Capacitor (vertical; en horizontal se invierten)
const ARRANQUE = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

if (!existsSync(RES)) {
  console.error('No existe android/: ejecuta primero npx cap add android');
  process.exit(1);
}

const n = valor => Number(valor.toFixed(3));

// Barras escaladas y centradas en (cx, cy); ancho: el que ocupa la marca completa
function marca({ cx, cy, ancho }) {
  const escala = ancho / 32;
  return BARRAS.map(b => ({
    x: cx + (b.x - CENTRO_MARCA.x) * escala, y: cy + (b.y - CENTRO_MARCA.y) * escala,
    ancho: b.ancho * escala, alto: b.alto * escala, radio: b.radio * escala, color: b.color
  }));
}

// Rectángulo redondeado como trazo: sirve igual para SVG y para los vectores de Android
function trazo({ x, y, ancho, alto, radio }) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  const arco = (a, b) => `A${n(r)},${n(r)} 0 0 1 ${n(a)},${n(b)}`;
  return `M${n(x + r)},${n(y)} H${n(x + ancho - r)} ${arco(x + ancho, y + r)} V${n(y + alto - r)} ${arco(x + ancho - r, y + alto)} `
    + `H${n(x + r)} ${arco(x, y + alto - r)} V${n(y + r)} ${arco(x + r, y)} Z`;
}

function vector(barras, color) {
  const trazos = barras.map(b => `    <path android:fillColor="${color || b.color}" android:pathData="${trazo(b)}" />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/generar-iconos.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
${trazos}
</vector>
`;
}

function svg({ ancho, alto, fondo, barras }) {
  const trazos = barras.map(b => `<path fill="${b.color}" d="${trazo(b)}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${fondo}${trazos}</svg>`);
}

function escribir(relativa, contenido) {
  const destino = path.join(RES, relativa);
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
}

const png = (relativa, imagen) => sharp(imagen).png({ compressionLevel: 9 }).toFile(path.join(RES, relativa));

// Íconos de la plantilla de Capacitor que este ícono reemplaza
for (const carpeta of readdirSync(RES)) {
  if (carpeta.startsWith('mipmap-')) rmSync(path.join(RES, carpeta, 'ic_launcher_foreground.png'), { force: true });
}
rmSync(path.join(RES, 'drawable-v24'), { recursive: true, force: true });
rmSync(path.join(RES, 'drawable', 'ic_launcher_background.xml'), { force: true });

// Ícono adaptable: lienzo de 108 dp; lo visible es un círculo de 66 dp en el centro
const enLienzo = marca({ cx: 54, cy: 54, ancho: 48 });
escribir('drawable/ic_launcher_foreground.xml', vector(enLienzo));
escribir('drawable/ic_launcher_monochrome.xml', vector(enLienzo, '#FFFFFFFF'));
const adaptable = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/generar-iconos.mjs -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;
escribir('mipmap-anydpi-v26/ic_launcher.xml', adaptable);
escribir('mipmap-anydpi-v26/ic_launcher_round.xml', adaptable);
escribir('values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/generar-iconos.mjs -->
<resources>
    <color name="ic_launcher_background">${FONDO_ICONO}</color>
</resources>
`);

const tareas = [];
// Ícono para Android 7 (48 dp): cuadrado redondeado y versión circular, con un margen como los de Material
for (const [densidad, factor] of Object.entries(DENSIDADES)) {
  const lado = 48 * factor;
  const barras = marca({ cx: lado / 2, cy: lado / 2, ancho: 30 * factor });
  const cuadrado = `<rect x="${2 * factor}" y="${2 * factor}" width="${44 * factor}" height="${44 * factor}" rx="${8 * factor}" fill="${FONDO_ICONO}"/>`;
  const circulo = `<circle cx="${lado / 2}" cy="${lado / 2}" r="${22 * factor}" fill="${FONDO_ICONO}"/>`;
  tareas.push(png(`mipmap-${densidad}/ic_launcher.png`, svg({ ancho: lado, alto: lado, fondo: cuadrado, barras })));
  tareas.push(png(`mipmap-${densidad}/ic_launcher_round.png`, svg({ ancho: lado, alto: lado, fondo: circulo, barras })));
}

// Arranque: la marca al centro sobre el fondo de la app. Android estira la imagen a la pantalla; dos barras lo
// toleran mejor que el logotipo con letras
function arranque(ancho, alto) {
  const fondo = `<rect width="${ancho}" height="${alto}" fill="${FONDO_ARRANQUE}"/>`;
  return svg({ ancho, alto, fondo, barras: marca({ cx: ancho / 2, cy: alto / 2, ancho: Math.min(ancho, alto) * 0.3 }) });
}
for (const [densidad, [ancho, alto]] of Object.entries(ARRANQUE)) {
  tareas.push(png(`drawable-port-${densidad}/splash.png`, arranque(ancho, alto)));
  tareas.push(png(`drawable-land-${densidad}/splash.png`, arranque(alto, ancho)));
}
tareas.push(png('drawable/splash.png', arranque(480, 320)));

await Promise.all(tareas);
console.log(`Íconos y arranque generados en android/app/src/main/res (${tareas.length} PNG y 5 XML)`);
