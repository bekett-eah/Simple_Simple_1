/* Sirve app/www en http://127.0.0.1:8787 para probar la app en un navegador de escritorio (sin plugins nativos:
   la biometría y la identidad se simulan con diálogos). Uso: npm run servir [-- --puerto=8787] */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WWW = fileURLToPath(new URL('../www/', import.meta.url));
const PUERTO = Number(process.argv.find(a => a.startsWith('--puerto='))?.split('=')[1] || 8787);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

createServer((peticion, respuesta) => {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(peticion.url, 'http://localhost').pathname);
  } catch {
    respuesta.writeHead(400).end();
    return;
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(WWW, path.normalize(ruta));
  // Nada fuera de www
  if (!archivo.startsWith(WWW)) { respuesta.writeHead(403).end(); return; }
  let datos;
  try { datos = statSync(archivo); } catch { datos = null; }
  if (!datos?.isFile()) { respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); return; }
  respuesta.writeHead(200, {
    'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
    'Content-Length': datos.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  createReadStream(archivo).pipe(respuesta);
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sirviendo app/www en http://127.0.0.1:${PUERTO}/ (Ctrl + C para detener)`));
