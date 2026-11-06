# Pruebas, seguridad y despliegue (fase 6)

## Resumen

| Qué | Resultado (6 de noviembre de 2026) |
|---|---|
| Pruebas de la app (`npm test`) | 70 de 70 |
| Pruebas del repositorio: frontend (`node --test pruebas/*.test.mjs`) y asistente (`unittest`) | 26 de 26 y 20 de 20 |
| Build de pruebas, `cap sync android` y revisión del paquete (`npm run verificar`) | Sin problemas: 189 archivos web, 14,2 MB |
| `npm audit` | 0 vulnerabilidades |
| Recorrido completo en el navegador, con vista de teléfono | Hecho (ver abajo) |
| APK de depuración del ambiente de pruebas | Compilado en este equipo (20,1 MB); la revisión del APK no encontró problemas ([APK de pruebas](#apk-de-pruebas)) |
| Instalación y pruebas en un teléfono | **Pendiente** |

## Pruebas automatizadas

`npm test` ejecuta `node --test tests/*.test.mjs`, sin dependencias de prueba adicionales.

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `biometria.test.mjs` | 6 | Uso del plugin (biometría actual, sin PIN), traducción de códigos (21 = la biometría cambió), simulador |
| `configuracion.test.mjs` | 7 | Ambientes: secretos, HTTPS, simuladores prohibidos en producción, orígenes de la CSP |
| `destinos.test.mjs` | 3 | Redirecciones abiertas en `?volver=`, `?siguiente=` y `?destino=`, también con el esquema de iOS |
| `http.test.mjs` | 7 | Reintentos solo idempotentes, `Retry-After`, tiempo máximo, sin cookies ni redirecciones |
| `navegacion.test.mjs` | 1 | Qué enlaces se abren en el navegador del sistema, en Android y con el esquema de iOS |
| `pagos.test.mjs` | 10 | Monto calculado por el backend, idempotencia, una orden vigente por solicitud, transiciones, confirmación consultando al backend |
| `pkce.test.mjs` | 2 | Vector de prueba de RFC 7636 y longitudes |
| `proveedor-oidc.test.mjs` | 8 | `state`, `iss`, cancelación, vencimiento, descubrimiento y retorno tras cerrarse la app |
| `sesion.test.mjs` | 11 | Renovación de un solo uso, biometría (activación confirmada, cambio, revocación), cierre, desvincular e inactividad |
| `transformar.test.mjs` | 9 | Rutas ASCII, recursos locales, CSP y capa móvil en cada página |
| `verificar.test.mjs` | 6 | Secretos, terceros, `http://`, referencias rotas y simulaciones prohibidas en producción |

`backend-simulado.js` implementa el contrato con sus reglas, así que las pruebas de sesión y de pagos también sirven
de especificación ejecutable del backend.

Las pruebas del repositorio cubren los cambios que la app necesitó en la web: CORS opcional del asistente
(`SIMPLE_ORIGENES`, consulta previa y origen ajeno rechazado, en `pruebas/test_asistente_ia.py`) y el modo básico del
intérprete cuando la app no configura la IA (`pruebas/interprete.test.mjs`).

## Revisión del paquete

**Al construir** (`scripts/lib/verificar.mjs`), el build falla si `www` tiene:
- rutas fuera de ASCII o copias capturadas de sitios oficiales;
- posibles secretos: claves privadas, de Anthropic, AWS o Google, un token CSRF o un token en una URL;
- recursos de terceros o direcciones `http://`;
- páginas sin CSP o sin capa móvil, o referencias a archivos que no están;
- en producción, además, las simulaciones de la maqueta (pasarela, integración con SIMPLE v2 y datos fijos de la
  cuenta de prueba).

**Después de `cap sync`** (`scripts/verificar-paquete.mjs`), revisa lo que entra al APK:
- que `assets/public` sea igual a `www`, y otra vez todo lo anterior;
- que no haya mapas de código fuera de desarrollo;
- `capacitor.config.json`: sin `server.url`, `cleartext`, `allowMixedContent` ni `webContentsDebuggingEnabled`;
- el manifiesto: `allowBackup="false"`, `dataExtractionRules`, `networkSecurityConfig`, sin `usesCleartextTraffic` ni
  `debuggable`, solo los permisos previstos (`INTERNET`, `ACCESS_NETWORK_STATE`, `USE_BIOMETRIC`) y el filtro del
  esquema de retorno;
- la red: HTTP prohibido y certificados del usuario solo en depuración;
- que el esquema de retorno coincida con el `appId` y con la redirección de producción;
- que no haya archivos de firma versionados en git;
- con `--apk=<archivo>`, también el APK compilado: `index.html`, rutas ASCII, sin mapas de código y solo los permisos
  previstos. Al combinar los manifiestos, dos librerías agregan uno cada una: `androidx.biometric`, `USE_FINGERPRINT`
  (la huella en Android 7 y 8), y `androidx.core`, un permiso de firma propio para sus receptores no exportados. Los
  lee con `aapt2`, del SDK que indiquen `sdk.dir` o `ANDROID_HOME`.

## Recorrido en el navegador

Se hizo con Playwright a 412 × 915 sobre el build de desarrollo (`npm run servir`), que usa los simuladores. Se
comprobó:

- La portada carga sin errores en la consola, sin peticiones a terceros, con las fuentes y los íconos locales y sin
  imágenes rotas.
- El enlace de inicio de sesión de la maqueta lleva a la pantalla propia y conserva el destino.
- Identidad simulada → sesión → oferta de biometría → activación → vuelta al trámite de origen.
- Los tokens quedan en `sessionStorage`; en `localStorage`, solo la marca de la maqueta y el identificador del
  dispositivo.
- Mi cuenta muestra el documento enmascarado.
- Cerrar sesión borra los tokens y la marca, conserva la biometría y no pide la huella enseguida.
- Al reabrir (con `sessionStorage` vacío) aparece el desbloqueo y pide la huella sin tocar nada. Cancelar no borra
  nada y desbloquear restaura la sesión.
- `pago.html` funciona sin errores.

Después se cambió la activación de la biometría, que ahora pide confirmarla con una lectura, y se repitió esa parte
del recorrido:

- Cancelar la confirmación deja la biometría sin activar, borra la credencial, hace que el backend olvide el
  dispositivo, conserva la sesión y muestra «No se activó. Puedes hacerlo después en Mi cuenta.».
- Confirmarla activa la biometría y vuelve al trámite de origen (`tramite.html?n=51`).
- Al reabrir desde `mis-tramites.html`, el desbloqueo devuelve a esa misma página con la sesión restaurada.
- No hubo errores ni advertencias en la consola.

## Pruebas en dispositivos (pendientes)

**Matriz mínima propuesta:**

| Equipo | Por qué |
|---|---|
| Gama baja con Android 8 o 9 y 2 o 3 GB de RAM | Rendimiento y cierre del proceso en segundo plano |
| Samsung con Android 13 o 14 (One UI) | El fabricante más común; huella y rostro |
| Xiaomi o Motorola de gama media | Ahorro de batería agresivo; WebView desactualizado |
| Pixel con Android 16 | Versión de destino (`targetSdk` 36), ícono monocromo y pantalla de borde a borde |
| Teléfono sin biometría o con desbloqueo facial débil (clase 2) | No debe ofrecerse la biometría |

**Casos:**

- Instalación limpia, actualización y reinstalación (sin copia de seguridad, la biometría se vuelve a activar).
- Ingreso, cancelación y error del proveedor. Con la opción de desarrollador «No conservar actividades», cerrar la
  app durante el ingreso y durante el pago.
- Biometría: activar, cancelar la confirmación, desbloquear, demasiados intentos, agregar o quitar una huella,
  desactivar y desvincular.
- Bloqueo tras 5 minutos en segundo plano; botón Atrás en cada pantalla y con diálogos abiertos.
- Sin red y red intermitente; enlaces externos; descarga del calendario.
- WebView anterior a la 108: debe mostrar `app-movil/error.html`.
- Accesibilidad: TalkBack, texto al 200 %, contraste y orientación horizontal.

## Seguridad

| Área (OWASP MASVS) | Control | Estado |
|---|---|---|
| Almacenamiento | Tokens en `sessionStorage`; credencial solo en el Keystore; sin copia de seguridad ni traspaso | Hecho |
| Criptografía | PKCE S256 con `crypto.getRandomValues`; clave RSA del Keystore ligada a la biometría | Hecho |
| Autenticación | Navegador del sistema, `state`, `nonce`, `iss`; renovación de un solo uso; credencial revocable; bloqueo por inactividad | Hecho en la app; falta el backend |
| Red | Solo HTTPS y certificados del sistema; sin cookies; sin seguir redirecciones; CORS solo para orígenes declarados | Hecho. No se fijan certificados (pinning): una rotación dejaría la app sin servicio. Se puede revisar con la institución. |
| Plataforma | CSP por página; enlaces externos fuera del WebView; `FileProvider` limitado; solo los permisos previstos (3 propios y 2 de AndroidX, ninguno requiere autorización de la persona); destinos internos validados | Hecho. La CSP aún necesita `'unsafe-inline'` en `script-src` por la maqueta. |
| Código | Dependencias fijadas, `npm audit` en 0, acciones de CI fijadas por commit, wrapper y distribución de Gradle verificados, sin mapas de código en release | Hecho. R8 (`minifyEnabled`) sigue apagado hasta probarlo en un dispositivo. |
| Resiliencia | Integridad del dispositivo con Play Integrity, validada en el backend | Opcional, para más adelante |
| Privacidad | Sin analítica ni seguimiento; documento enmascarado; el asistente registra solo metadatos | Hecho. Falta la política de privacidad. |

**Antes de producción** hay que resolver los hallazgos del repositorio
([01-auditoria-repositorio.md](01-auditoria-repositorio.md)), sobre todo sacar `archivos/credenciales admin simple.md`
y purgarlo del historial.

## Integración continua

`.github/workflows/app-movil.yml` corre en cada cambio de la app o del frontend (pull request, y push a `main` y
`feature/app-movil`). Ejecuta las pruebas del repositorio y de la app, el build de pruebas, `cap sync` y la revisión
del paquete. Después valida el wrapper de Gradle, compila el APK de depuración, lo revisa y lo publica como artefacto
por 14 días.

No usa secretos: el APK de depuración se firma con una clave que Gradle genera en el runner. Los permisos son de solo
lectura y las acciones están fijadas por commit. **Todavía no se ejecutó:** la rama no está en GitHub.

## APK de pruebas

Es el APK de depuración del ambiente de pruebas, con identidad, sesión y pagos simulados. Se compila con Android Studio
o solo con el JDK 21 y las herramientas de línea de comandos del SDK de Android (plataforma 36, build tools 35 y
`platform-tools`):

```bash
cd app
npm run verificar                         # pruebas, build de pruebas, cap sync y revisión
cd android && ./gradlew assembleDebug     # con JAVA_HOME (JDK 21) y ANDROID_HOME (SDK) definidos
cd .. && node scripts/verificar-paquete.mjs --apk=android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk   # teléfono con la depuración USB activada
```

- La primera compilación tarda más (unos 12 minutos en este equipo), porque descarga Gradle y las dependencias.
  `gradle-wrapper.properties` fija la suma SHA-256 de la distribución de Gradle. El `gradle-wrapper.jar` del proyecto
  es el oficial de la 8.14.3; en CI lo comprueba `wrapper-validation`.
- Como es de depuración, el WebView se puede inspeccionar desde `chrome://inspect` con el teléfono conectado. No es una
  versión para distribuir.
- Se firma con la clave de depuración del equipo que lo compila (`~/.android/debug.keystore`). El APK de CI o de otro
  equipo tiene otra firma: para pasar de uno a otro hay que desinstalar la app, y eso borra sus datos y obliga a
  activar de nuevo la biometría.

## Firma y publicación en Google Play

**Firma.** Se usa Play App Signing: Google guarda la clave de firma de la app y el equipo firma cada envío con una
**clave de subida** propia, que se puede cambiar si se pierde o se filtra.

```bash
keytool -genkeypair -v -keystore simple-sv-subida.jks -alias subida -keyalg RSA -keysize 4096 -validity 9125
```

El almacén y sus contraseñas van al gestor de secretos de la institución, nunca al repositorio: `.gitignore` excluye
`*.jks`, `*.keystore`, `*.p12`, `*.pem` y `keystore.properties`, y `verificar-paquete.mjs` falla si alguno está
versionado. `android/app/build.gradle` lee `android/keystore.properties`:

```properties
storeFile=../ruta/a/simple-sv-subida.jks
storePassword=…
keyAlias=subida
keyPassword=…
```

**Versiones.** `versionName` sale de `app/package.json` (`npm version minor`, por ejemplo). `versionCode`, en
`android/app/build.gradle`, debe subir en cada envío a Google Play.

**Compilar una versión de producción:**

```bash
cd app
npm ci
npm run build:produccion          # falla mientras falten los datos institucionales o queden simulaciones
npx cap sync android
node scripts/verificar-paquete.mjs
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

**Antes del primer envío:**

- Cuenta de desarrollador de la organización; Google Play pide acreditar la autorización para publicar en nombre de
  la institución.
- Identificador definitivo: `sv.simple.app` es provisional y no se puede cambiar después de publicar.
- Política de privacidad pública, formulario de seguridad de datos y clasificación de contenido.
- Acceso para la revisión de Google, porque el ingreso exige Identidad Digital: una cuenta de prueba o instrucciones.
- Requisito anual de nivel de API de Google Play (hoy `targetSdk` 36).
- Publicar en etapas: prueba interna, prueba cerrada con funcionarios, producción con lanzamiento gradual.
- Decidir el reporte de fallos y el monitoreo. Si se agrega un servicio externo, hay que reflejarlo en la política de
  privacidad y en el formulario de seguridad de datos.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de la app |
| `npm run build` / `build:pruebas` / `build:produccion` | Arma `www/` para cada ambiente |
| `npm run servir` | Sirve `www/` en `http://127.0.0.1:8787`, para probar en el navegador |
| `npm run sync` / `sync:pruebas` | Build y `cap sync android` |
| `npm run android` | Build de desarrollo y abre Android Studio |
| `npm run verificar` | Pruebas, build de pruebas, `cap sync` y revisión del paquete |
| `npm run iconos` | Regenera los íconos y la pantalla de arranque de Android |
