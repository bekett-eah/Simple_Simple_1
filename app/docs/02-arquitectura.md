# Arquitectura de la app móvil

## Decisión

**Capacitor 8** empaqueta el frontend web que ya existe, sin bifurcarlo, y le agrega lo que una app de gobierno
necesita y una página web no puede hacer bien: ingreso con biometría ligado al Keystore de Android, inicio de sesión
en el navegador del sistema (Custom Tabs), botón Atrás, archivos y enlaces externos. iOS se agrega después con el
mismo código (ver [06-preparacion-ios.md](06-preparacion-ios.md)).

Alternativas descartadas:

| Opción | Por qué no |
|---|---|
| PWA o Trusted Web Activity | Exige un sitio publicado con HTTPS (hoy no lo hay) y no permite guardar una credencial protegida por la biometría en el Keystore. |
| React Native o Flutter | Obligaría a reescribir el frontend entero, que es justamente lo que se quiere reutilizar. |
| Copiar el frontend dentro de `app/` | Duplicaría el código y se desincronizaría. El build copia y transforma en cada compilación. |
| Cargar la web desde un servidor (`server.url`) | Sin red no abre, depende de un hosting que no existe y debilita la integridad del paquete. Solo sirve para recarga en vivo en desarrollo. |

## Vista general

```text
Teléfono Android (iOS después)
┌──────────────────────────────────────────────────────────────────────┐
│ WebView · https://localhost (archivos del APK)                       │
│   Maqueta web (index.html, nuevoDiseno/, src/), copiada en el build  │
│   + capa móvil  app-movil/app-movil.js (al inicio de cada página)     │
│   + pantallas propias: inicio de sesión, biometría, desbloqueo,       │
│     Mi cuenta                                                         │
│ Plugins: App · Browser (Custom Tabs) · Filesystem · Network · Share   │
│          SplashScreen · biometría (@capgo, Android Keystore)          │
└────────────────┬──────────────────────────────────┬──────────────────┘
                 │ fetch HTTPS, sin cookies (CORS)   │ Custom Tabs
                 ▼                                   ▼
      Backend de la app (BFF)          Identidad Digital: la persona inicia
      · sesiones y dispositivos          sesión en el sitio del proveedor
      · órdenes de pago                     │ sv.simple.app:/oauth2redirect
      · asistente con IA                    ▼ (vuelve a la app con el código)
          ├──► Identidad Digital: canje del código y validación de tokens
          ├──► Pasarela de pagos: cobro y notificaciones firmadas
          └──► SIMPLE v2: trámites y estados
```

El backend intermedio (BFF) todavía no existe. Su contrato propuesto está en
[api/contrato-backend.yaml](api/contrato-backend.yaml). Mientras tanto, desarrollo y pruebas usan
`backend-simulado.js`, que aplica las mismas reglas en el teléfono.

## Cómo se arma el paquete

`npm run build` (o `build:pruebas`, `build:produccion`) ejecuta `scripts/construir-web.mjs`:

1. **Valida la configuración** del ambiente (`config/<entorno>.json`, `scripts/lib/configuracion.mjs`). Rechaza las
   claves que parecen secretos y las direcciones sin HTTPS, y en producción no admite simuladores ni depuración.
2. **Copia el frontend** del repositorio sin tocar los originales: `index.html`, `nuevoDiseño/` (como `nuevoDiseno/`)
   y `src/`. No copia las copias capturadas del login ni de «Mi cuenta» de Identidad Digital; en su lugar escribe
   redirecciones a `app-movil/inicio-sesion.html` y `app-movil/mi-cuenta.html`, que conservan los parámetros.
3. **Transforma la copia** (`scripts/lib/transformar.mjs`): renombra la carpeta a ASCII, cambia Google Fonts y
   jsDelivr por `vendor/`, quita `viewport-fit=cover`, inserta la CSP e inyecta la capa móvil justo después de
   `<meta charset>`, antes que cualquier otro script.
4. **Agrega recursos propios:** fuentes de Fontsource (latin y latin-ext, woff2) y Phosphor, con sus licencias; la capa
   móvil empaquetada con esbuild (IIFE, Chrome 108 o superior; sin mapas de código fuera de desarrollo); las pantallas
   propias y `compilacion.json` (ambiente, versión, commit y fecha).
5. **Optimiza las imágenes** con sharp: máximo 960 px de ancho (192 px el avatar) y caché en `.cache/imagenes`. Hoy
   pasan de 63,9 MB a 12,5 MB.
6. **Revisa `www/`** (`scripts/lib/verificar.mjs`) y falla si encuentra algún problema: rutas fuera de ASCII, copias
   capturadas, posibles secretos (claves privadas, de Anthropic, AWS o Google, un token CSRF o un token en una URL),
   recursos de terceros, direcciones `http://`, páginas sin CSP o sin capa móvil, y referencias a archivos que no
   están (247 referencias locales revisadas).

Después, `npx cap sync android` copia `www/` al proyecto Android y `scripts/verificar-paquete.mjs` revisa lo que
entra al APK (ver [05-pruebas-seguridad-despliegue.md](05-pruebas-seguridad-despliegue.md)).

## Capa móvil (`src/app-movil.js`)

Corre en todas las páginas, antes que los scripts de la maqueta.

**Al cargar:**
- Publica `window.SIMPLE_CONFIG` (ambiente y dirección del asistente) y `window.SIMPLE_APP` (sesión, identidad,
  pagos, diálogo, cerrar sesión).
- Agrega a `<html>` las clases `app-movil`, `app-android` o `app-web`, y `app-sin-dictado` cuando no hay
  reconocimiento de voz.
- Alinea la marca de sesión de la maqueta (`simple-sesion`) con la sesión real.
- Decide adónde llevar a la persona: si quedó a medias un inicio de sesión y Android cerró la app, va a completarlo;
  si abre la app sin sesión y con biometría activada, va al desbloqueo.

**Con el DOM listo:**
- Muestra la etiqueta del ambiente fuera de producción.
- Intercepta «Cerrar sesión» del menú de la maqueta para cerrar también la sesión real.
- Vigila la conexión.
- Solo en Android: botón Atrás, enlaces externos en el navegador del sistema, descargas y bloqueo por inactividad
  (eventos `pause` y `resume`).
- Ejecuta el controlador de la pantalla propia (`src/controladores/`).

## Puertos y adaptadores

La configuración del ambiente elige cada pieza; el resto del código no sabe si habla con un servicio real o con un
simulador.

| Puerto | Producción | Desarrollo y pruebas |
|---|---|---|
| Backend | `backend/backend-http.js`, según el contrato | `backend/backend-simulado.js`: mismas reglas, estado en `localStorage` |
| Identidad | `identidad/proveedor-oidc.js`: código de autorización con PKCE en Custom Tabs (hipótesis por confirmar) | `identidad/proveedor-simulado.js`: diálogo con la cuenta de prueba |
| Biometría | `sesion/biometria.js` nativa: `@capgo/capacitor-native-biometric` con Keystore | En el teléfono, la misma nativa. En el navegador, un diálogo que la simula (en producción, el navegador no ofrece biometría) |
| Pasarela | `pagos/pasarelas.js`: página de pago alojada, abierta en Custom Tabs | Pasarela simulada que avisa al backend simulado |

Sobre esos puertos trabajan `sesion/sesion.js` (sesión, renovación, biometría, inactividad, desvincular) y
`pagos/servicio-pagos.js` (órdenes, idempotencia, confirmación consultando al backend). Detalle en
[03-identidad-y-sesion.md](03-identidad-y-sesion.md) y [04-pagos.md](04-pagos.md).

## Configuración por ambiente

| | desarrollo | pruebas | produccion |
|---|---|---|---|
| Backend | simulado | simulado | `http` (falta `backend.url`) |
| Identidad | simulada | simulada | `oidc` (faltan `emisor` y `clienteId`) |
| Pagos | simulados | simulados | backend |
| Depuración y mapas de código | sí | no | no |
| Asistente con IA | `null` (modo básico) | `null` | `null` |

- Ningún archivo de configuración lleva secretos: la app no tiene ninguno. Los secretos de Identidad Digital y de la
  pasarela viven solo en el backend.
- `SIMPLE_ASISTENTE_URL` define la dirección del asistente sin editar los archivos; también tiene que ser HTTPS.
- El build de producción falla a propósito mientras falten los datos institucionales.

## Seguridad del contenedor

- **CSP por página:** `default-src 'self'`; `connect-src` limitado a la app y a los orígenes configurados; sin
  `object`, `worker` ni `base` ajenos. `script-src` necesita `'unsafe-inline'` por los manejadores en línea de la
  maqueta; quitarlo es una mejora pendiente.
- **Red:** solo HTTPS (`network_security_config.xml`) y solo las autoridades de certificación del sistema; las del
  usuario se aceptan únicamente en depuración. `allowMixedContent: false`. `CapacitorHttp` desactivado, para que las
  peticiones sigan las reglas del navegador (CORS y CSP).
- **Datos:** `allowBackup="false"` y `dataExtractionRules` (sin copia en la nube ni traspaso a otro teléfono).
  `FileProvider` limitado a `cache/descargas/`.
- **Permisos:** `INTERNET`, `USE_BIOMETRIC` y `ACCESS_NETWORK_STATE` (este último lo agrega el plugin Network).
- **WebView:** versión 108 o superior (`minWebViewVersion`); con una más antigua se muestra `app-movil/error.html`.

## Estructura de `app/`

```text
app/
├── capacitor.config.json      appId sv.simple.app (provisional), esquema https, página de error
├── config/                    desarrollo.json, pruebas.json, produccion.json
├── scripts/                   construir-web, verificar-paquete, generar-iconos, servir-www y lib/
├── src/
│   ├── app-movil.js, .css     capa móvil (punto de entrada de esbuild)
│   ├── nucleo/                almacén, cliente HTTP, destinos, navegación, red
│   ├── identidad/             PKCE, proveedor OIDC, proveedor simulado
│   ├── sesion/                biometría, gestor de sesión
│   ├── pagos/                 estados, servicio, pasarelas
│   ├── backend/               HTTP (contrato) y simulado
│   ├── ui/                    diálogo accesible
│   ├── controladores/         lógica de las pantallas propias
│   └── pantallas/             HTML y CSS de las pantallas propias
├── tests/                     pruebas unitarias (node:test)
├── android/                   proyecto Android (generado por Capacitor y personalizado)
└── docs/                      esta documentación
```

## Dependencias de la app

| Paquete | Versión | Uso | Licencia |
|---|---|---|---|
| `@capacitor/core`, `android`, `cli` | 8.6.0 | Contenedor nativo | MIT |
| `@capacitor/app` | 8.1.2 | Botón Atrás, `pause` y `resume`, enlaces de retorno | MIT |
| `@capacitor/browser` | 8.0.5 | Custom Tabs: Identidad Digital, pasarela y enlaces externos | MIT |
| `@capacitor/filesystem`, `share` | 8.1.5, 8.0.3 | Descargas (calendario `.ics`) | MIT |
| `@capacitor/network` | 8.0.1 | Aviso sin conexión | MIT |
| `@capacitor/splash-screen` | 8.0.2 | Pantalla de arranque | MIT |
| `@capgo/capacitor-native-biometric` | 8.9.1 | BiometricPrompt con clave del Keystore que se invalida si cambian las huellas o los rostros | MPL-2.0 |
| `esbuild` | 0.28.2 | Empaqueta la capa móvil | MIT |
| `sharp` | 0.35.5 | Imágenes e íconos | Apache-2.0 |
| `@fontsource/manrope`, `roboto` | 5.3.0 | Fuentes locales | OFL-1.1 |
| `@phosphor-icons/web` | 2.1.2 | Íconos locales | MIT |

Las versiones están fijadas sin rangos y `npm audit` reporta 0 vulnerabilidades. Se descartó `@capacitor/assets`
porque arrastraba 4 vulnerabilidades moderadas; los íconos los genera `scripts/generar-iconos.mjs` con sharp.
