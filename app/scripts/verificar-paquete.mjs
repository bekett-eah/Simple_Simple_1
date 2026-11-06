/* Revisa el proyecto Android después de cap sync: lo que de verdad entra al APK. Uso: npm run verificar
   (o node scripts/verificar-paquete.mjs [--apk=ruta.apk] para revisar también un APK ya compilado).
   - assets/public es la copia del último build de www y pasa la misma revisión (scripts/lib/verificar.mjs).
   - Sin mapas de código fuera de desarrollo ni configuración de recarga en vivo.
   - Manifiesto: sin copias de seguridad, solo HTTPS, permisos esperados y el esquema de retorno del inicio de sesión.
   - Ningún archivo de firma versionado en git.
   - Con --apk, el APK: index.html, rutas ASCII, sin mapas de código y solo los permisos previstos, porque las librerías
     agregan los suyos al combinar los manifiestos. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listarArchivos, verificarWww } from './lib/verificar.mjs';

const ruta = relativa => fileURLToPath(new URL(`../${relativa}`, import.meta.url));
const ANDROID = ruta('android');
const PRINCIPAL = path.join(ANDROID, 'app/src/main');
const PUBLICO = path.join(PRINCIPAL, 'assets/public');
const PERMISOS = new Set(['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.USE_BIOMETRIC']);
const FIRMA = /(\.jks|\.keystore|\.p12|\.pem|keystore\.properties)$/i;
// cap sync los agrega vacíos, por compatibilidad con plugins de Cordova
const DE_CAPACITOR = new Set(['cordova.js', 'cordova_plugins.js']);

const errores = [];
const fallar = mensaje => errores.push(mensaje);
const leer = relativa => readFileSync(path.join(PRINCIPAL, relativa), 'utf8');

// Permisos que pide un APK, con el aapt2 más reciente del SDK (sdk.dir de android/local.properties o ANDROID_HOME)
function permisosDelApk(apk) {
  const local = path.join(ANDROID, 'local.properties');
  const sdk = (existsSync(local) && readFileSync(local, 'utf8').match(/^sdk\.dir=(.+)$/m)?.[1].trim()) || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const herramientas = sdk ? path.join(sdk, 'build-tools') : '';
  const aapt2 = existsSync(herramientas) && readdirSync(herramientas).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    .map(v => path.join(herramientas, v, 'aapt2')).find(a => existsSync(a));
  if (!aapt2) return null;
  const salida = execFileSync(aapt2, ['dump', 'permissions', apk], { encoding: 'utf8' });
  return { paquete: salida.match(/^package: (\S+)/m)?.[1], pedidos: [...salida.matchAll(/^uses-permission(?:-sdk-23)?: name='([^']+)'/gm)].map(m => m[1]) };
}

if (!existsSync(PUBLICO)) {
  console.error('No existe android/app/src/main/assets/public: ejecuta npm run sync:pruebas (o npx cap add android la primera vez)');
  process.exit(1);
}

// 1. assets/public = www
const www = ruta('www');
const enWww = listarArchivos(www);
const enPublico = new Set(listarArchivos(PUBLICO).filter(a => !DE_CAPACITOR.has(a)));
const distintos = enWww.filter(a => !enPublico.has(a) || statSync(path.join(www, a)).size !== statSync(path.join(PUBLICO, a)).size);
if (distintos.length || enWww.length !== enPublico.size) fallar(`assets/public no coincide con www (${distintos.slice(0, 3).join(', ') || 'archivos de más'}): ejecuta cap sync android`);
const { entorno, version, commit } = JSON.parse(readFileSync(path.join(PUBLICO, 'app-movil/compilacion.json'), 'utf8'));
const revision = verificarWww(PUBLICO, {
  paginasSinCapa: ['nuevoDiseno/login.html', 'SIMPLE ACTUAL/Identidad digital.html', 'app-movil/error.html'],
  produccion: entorno === 'produccion'
});
revision.errores.forEach(e => fallar(`assets/public/${e}`));
if (entorno !== 'desarrollo') {
  [...enPublico].filter(a => a.endsWith('.map')).forEach(a => fallar(`assets/public/${a}: mapa de código fuente en un paquete de ${entorno}`));
}

// 2. Configuración de Capacitor que se empaqueta
const capacitor = JSON.parse(leer('assets/capacitor.config.json'));
if (capacitor.server?.url) fallar(`capacitor.config.json: server.url (${capacitor.server.url}) carga la app desde otro servidor; es solo para recarga en vivo`);
if (capacitor.server?.cleartext) fallar('capacitor.config.json: server.cleartext permite HTTP sin cifrar');
if (capacitor.android?.allowMixedContent) fallar('capacitor.config.json: android.allowMixedContent permite contenido HTTP');
if (capacitor.android?.webContentsDebuggingEnabled) fallar('capacitor.config.json: android.webContentsDebuggingEnabled deja depurar el WebView también en release');

// 3. Manifiesto y recursos
const manifiesto = leer('AndroidManifest.xml');
const atributo = (nombre, valor) => new RegExp(`android:${nombre}="${valor}"`).test(manifiesto);
if (!atributo('allowBackup', 'false')) fallar('AndroidManifest.xml: falta android:allowBackup="false"');
if (!atributo('dataExtractionRules', '@xml/data_extraction_rules')) fallar('AndroidManifest.xml: faltan las reglas de extracción de datos (Android 12 o superior)');
if (!atributo('networkSecurityConfig', '@xml/network_security_config')) fallar('AndroidManifest.xml: falta la configuración de seguridad de red');
if (atributo('usesCleartextTraffic', 'true')) fallar('AndroidManifest.xml: android:usesCleartextTraffic="true" permite HTTP sin cifrar');
if (/android:debuggable=/.test(manifiesto)) fallar('AndroidManifest.xml: android:debuggable lo decide Gradle según el tipo de compilación; no va en el manifiesto');
for (const [, permiso] of manifiesto.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)) {
  if (!PERMISOS.has(permiso)) fallar(`AndroidManifest.xml: permiso no previsto ${permiso}`);
}
if (!/<data android:scheme="@string\/custom_url_scheme"/.test(manifiesto)) fallar('AndroidManifest.xml: falta el filtro del esquema de retorno del inicio de sesión');
const red = leer('res/xml/network_security_config.xml');
if (!/<base-config cleartextTrafficPermitted="false">/.test(red)) fallar('network_security_config.xml: la configuración base debe prohibir HTTP sin cifrar');
if (/src="user"/.test(red.replace(/<debug-overrides>[\s\S]*?<\/debug-overrides>/, ''))) fallar('network_security_config.xml: los certificados del usuario solo se aceptan en depuración');
const esquema = leer('res/values/strings.xml').match(/<string name="custom_url_scheme">([^<]+)</)?.[1];
const { appId } = JSON.parse(readFileSync(ruta('capacitor.config.json'), 'utf8'));
if (esquema !== appId) fallar(`strings.xml: custom_url_scheme (${esquema}) debe ser el appId (${appId})`);
const redireccion = JSON.parse(readFileSync(ruta('config/produccion.json'), 'utf8')).identidad.redireccion;
if (redireccion && !redireccion.startsWith(`${esquema}:/`)) fallar(`config/produccion.json: la redirección ${redireccion} no usa el esquema ${esquema} del manifiesto`);

// 4. Archivos de firma en git
try {
  const versionados = execFileSync('git', ['ls-files', '--', '.'], { cwd: ruta(''), encoding: 'utf8' }).split('\n').filter(a => FIRMA.test(a));
  versionados.forEach(a => fallar(`${a}: archivo de firma versionado en git; sácalo del repositorio y cambia la clave`));
} catch {
  console.warn('  (sin git: no se revisaron los archivos versionados)');
}

// 5. APK compilado, si se indica
const apk = process.argv.find(a => a.startsWith('--apk='))?.slice(6);
if (apk) {
  const entradas = execFileSync('unzip', ['-Z1', apk], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  const publicas = entradas.filter(e => e.startsWith('assets/public/'));
  if (!publicas.includes('assets/public/index.html')) fallar(`${apk}: no trae assets/public/index.html`);
  publicas.filter(e => !/^[\x20-\x7E]+$/.test(e)).forEach(e => fallar(`${apk}: ${e} tiene caracteres fuera de ASCII`));
  if (entorno !== 'desarrollo') publicas.filter(e => e.endsWith('.map')).forEach(e => fallar(`${apk}: ${e} es un mapa de código fuente`));
  // Además de los del manifiesto, androidx.biometric agrega USE_FINGERPRINT (la huella en Android 7 y 8) y androidx.core,
  // un permiso de firma propio para sus receptores no exportados
  const permisos = permisosDelApk(apk);
  if (!permisos) fallar(`${apk}: no se encontró aapt2 para revisar los permisos; define ANDROID_HOME con la ruta del SDK de Android`);
  else {
    const previstos = new Set([...PERMISOS, 'android.permission.USE_FINGERPRINT', `${permisos.paquete}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`]);
    permisos.pedidos.filter(p => !previstos.has(p)).forEach(p => fallar(`${apk}: permiso no previsto ${p} (el informe manifest-merger de android/app/build/outputs/logs dice qué librería lo agrega)`));
  }
  console.log(`  APK: ${publicas.length} archivos web y ${permisos?.pedidos.length ?? '?'} permisos en ${path.basename(apk)}`);
}

console.log(`Paquete Android · ${entorno} · v${version} (${commit}) · ${enPublico.size} archivos web`);
if (errores.length) {
  console.error(`\nLa revisión del paquete encontró ${errores.length} problema(s):\n  - ${errores.join('\n  - ')}`);
  process.exit(1);
}
console.log('  Sin problemas: manifiesto, red, configuración de Capacitor, contenido web y firma.');
