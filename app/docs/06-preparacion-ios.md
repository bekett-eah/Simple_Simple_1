# Preparación para iOS (fase 7)

El plan deja iOS para cuando la versión Android esté estable. Este documento reúne lo que ya sirve, lo que hay que
cambiar y los pasos para agregar la plataforma. El proyecto iOS todavía no existe: `npx cap add ios` necesita una Mac
con Xcode.

## Lo que ya sirve

| Pieza | En iOS |
|---|---|
| Frontend, capa móvil, controladores, sesión, pagos y contrato | El mismo código; la configuración elige los adaptadores igual que en Android |
| Plugins | Todos tienen versión iOS: App, Browser, Filesystem, Network, Share, SplashScreen y biometría |
| Biometría | El plugin guarda la credencial en el Keychain con `.biometryCurrentSet` y `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`. Se libera con Face ID o Touch ID, queda solo en ese iPhone (sin copia en iCloud) y deja de servir si cambian los rostros o huellas registrados o si se quita el código del teléfono. |
| Inicio de sesión | `@capacitor/browser` abre SFSafariViewController. El retorno por `sv.simple.app:/oauth2redirect` llega por `appUrlOpen`, igual que en Android. |
| Esquema propio `capacitor://localhost` | Ya contemplado. Los destinos internos (`rutaInterna`) y los enlaces externos (`esExterno`) comparan con la dirección de la página y no con `URL.origin`, que vale `"null"` en ese esquema. Las pruebas cubren los dos esquemas. |
| Dictado | Oculto en iOS (`app-sin-dictado`) hasta declarar los permisos y probarlo (ver más abajo) |

## Requisitos

- Una Mac con la versión de Xcode que exija la App Store al publicar.
- Membresía del Apple Developer Program **como organización**, a nombre de la institución (pide un número D-U-N-S),
  y acceso a App Store Connect.
- Capacitor 8 usa iOS 15.0 como mínimo en sus plantillas (`IPHONEOS_DEPLOYMENT_TARGET = 15.0`) y Swift Package
  Manager por defecto (CocoaPods solo con `--packagemanager CocoaPods`).
- **Mínimo efectivo: iOS 15.5.** El WKWebView tiene el motor de Safari de cada versión de iOS, y el frontend usa:

| Función | Dónde | Safari / iOS |
|---|---|---|
| Atributo `inert` | Maqueta | 15.5 |
| `:has()`, unidades `dvh`, `<dialog>` | Maqueta y pantallas de la app | 15.4 |
| `Array.prototype.at`, `Object.hasOwn` | Maqueta y app | 15.4 |
| `structuredClone`, `crypto.randomUUID` | App | 15.4 |

  Se recomienda fijar el mínimo en 15.5 (o en 16.0, para tener margen) y agregar `ios15.5` al `target` de esbuild en
  `scripts/construir-web.mjs`, junto a `chrome108`.

## Pasos para agregar la plataforma

```bash
cd app
npm install --save-exact @capacitor/ios@8.6.0
npx cap add ios
npm run build:pruebas && npx cap sync ios
npx cap open ios
```

En Xcode y en `ios/App/App/Info.plist`:

1. Identificador del paquete y equipo de firma de la institución; mínimo de iOS 15.5.
2. `NSFaceIDUsageDescription`, por ejemplo: «Simple.sv usa Face ID para que entres sin volver a escribir tu
   contraseña de Identidad Digital». Sin esta clave, la app se cierra en los iPhone con Face ID.
3. `CFBundleURLTypes` con el esquema `sv.simple.app`, si el inicio de sesión sigue en SFSafariViewController (ver más
   abajo).
4. `PrivacyInfo.xcprivacy` con las razones de uso de las API que lo exigen: Filesystem declara
   `NSPrivacyAccessedAPICategoryFileTimestamp` (razón `C617.1`). Revisar también Capacitor y los demás plugins según
   la guía de Capacitor sobre el manifiesto de privacidad.
5. Ícono de 1024 × 1024 sin transparencia y pantalla de arranque: `scripts/generar-iconos.mjs` hoy genera solo los de
   Android y se puede ampliar.
6. Una revisión del paquete equivalente a `verificar-paquete.mjs` para iOS: sin `NSAllowsArbitraryLoads`, con
   `NSFaceIDUsageDescription`, el esquema igual al `appId` y sin `server.url`.

## Diferencias que hay que resolver

### Origen `capacitor://localhost`

WKWebView no permite servir la app con `https` (ese esquema lo maneja él mismo), así que en iOS el origen es
`capacitor://localhost`.

- **CORS.** El backend debe aceptar `capacitor://localhost` además de `https://localhost` (el contrato ya lo dice).
  El asistente con IA se configura con `SIMPLE_ORIGENES=https://localhost,capacitor://localhost`.
- **Asistente con IA.** `nuevoDiseño/interprete.js` solo llama a la IA si la página es `http:` o `https:`, así que en
  iOS siempre usaría el modo básico. Cuando se configure la IA para la app, esa condición debe aceptar también la
  app, por ejemplo `window.SIMPLE_CONFIG || /^https?:$/.test(location.protocol)`, en `interpretar` y en `modo`.
- **Contexto seguro.** Verificar en un iPhone que `crypto.subtle` (PKCE) y `crypto.randomUUID` estén disponibles con
  ese esquema.

### Inicio de sesión

El flujo actual funciona con SFSafariViewController, pero Apple recomienda **ASWebAuthenticationSession** para
iniciar sesión (RFC 8252, apéndice B.1). El sistema le entrega el retorno solo a esa sesión, así que otra app no
puede interceptarlo, y comparte las cookies de Safari. A cambio, muestra un aviso del sistema («Simple.sv quiere usar
… para iniciar sesión»).

Basta con un adaptador que cumpla la interfaz de `navegador` y `retornos` que ya usa `proveedor-oidc.js`, con un
plugin o unas líneas nativas. SFSafariViewController puede seguir para los pagos y los enlaces externos. Un Universal
Link `https://` es la alternativa al esquema propio; necesita un dominio de la institución con
`apple-app-site-association`.

### Almacenamiento

La guía de almacenamiento de Capacitor advierte que iOS puede borrar `localStorage` del WKWebView, por ejemplo si el
teléfono se queda sin espacio. Ahí viven el identificador del dispositivo, la marca de biometría activada, la solicitud
de inicio de sesión pendiente y las claves de idempotencia de los pagos. Ninguno es un secreto, pero perderlos obliga a
activar de nuevo la biometría y podría generar otra clave para el mismo pago. Por eso:

- Conviene moverlos a `@capacitor/preferences` (UserDefaults; nunca para secretos), que exige declarar la razón
  `CA92.1` en el manifiesto de privacidad.
- El backend no debe permitir dos órdenes abiertas para la misma solicitud, aunque llegue otra clave
  ([04-pagos.md](04-pagos.md)).

### Navegación y pantalla

- iOS no tiene botón Atrás: `manejarBotonAtras` no hace nada ahí. Cada pantalla de la maqueta necesita una forma
  visible de volver. El gesto de deslizar se activa con `webView.allowsBackForwardNavigationGestures = true` en una
  subclase de `CAPBridgeViewController`.
- Áreas seguras (barra de estado, isla dinámica e indicador de inicio): el build quita `viewport-fit=cover` pensando en
  Android. En iOS hay que elegir entre `ios.contentInset` en `capacitor.config.json` o volver a `viewport-fit=cover`
  con `env(safe-area-inset-*)`, y probarlo en un iPhone con isla dinámica.

### Dictado por voz

La maqueta usa `SpeechRecognition` y `getUserMedia` para las ondas del micrófono. En iOS, acceder al micrófono sin
`NSMicrophoneUsageDescription` cierra la app, y el reconocimiento de voz pide `NSSpeechRecognitionUsageDescription`.
Por eso la capa móvil lo oculta en iOS (`src/app-movil.js`). Para ofrecerlo: declarar las dos claves, probarlo en
un iPhone y quitar la condición de plataforma.

### Pagos

- **Apple Pay:** el WKWebView de Capacitor no ofrece Apple Pay en las páginas, porque WebKit lo desactiva cuando la app
  inyecta scripts, y el puente de Capacitor lo hace. Si la página de pago alojada de la pasarela ofrece Apple Pay, en
  SFSafariViewController funciona como en Safari. Un botón propio en la app requiere PassKit con un plugin nativo, un
  identificador de comercio de Apple y que la pasarela procese esos pagos.
- **Compras dentro de la app:** no aplican a servicios que se prestan fuera de la app, como los trámites. Confirmarlo
  con las pautas de revisión vigentes.

## Publicación

- TestFlight: primero pruebas internas y después externas con funcionarios.
- Etiqueta de privacidad en App Store Connect, política de privacidad y declaración de cifrado: la app solo usa el
  cifrado estándar del sistema (HTTPS), lo que normalmente permite `ITSAppUsesNonExemptEncryption = NO`. Confirmarlo.
- Notas para la revisión de Apple con una cuenta de prueba de Identidad Digital, o instrucciones para entrar.
- «Iniciar sesión con Apple» no debería hacer falta: las pautas eximen a las apps que usan un sistema de
  identificación ciudadana del gobierno. Confirmarlo con la versión vigente.

## Pruebas en iPhone

| Equipo | Por qué |
|---|---|
| iPhone SE (Touch ID, pantalla pequeña) con el iOS mínimo | Mínimo soportado y la otra biometría |
| iPhone con Face ID e isla dinámica, con el iOS actual | Áreas seguras, Face ID y su texto de permiso |

Casos: los mismos de Android ([05-pruebas-seguridad-despliegue.md](05-pruebas-seguridad-despliegue.md)), además de
quitar y volver a poner el código del teléfono (la credencial debe dejar de servir), cambiar los rostros registrados,
el aviso de ASWebAuthenticationSession y los permisos de Face ID negados desde Ajustes.
