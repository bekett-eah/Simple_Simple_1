# Auditoría del repositorio (fase 1)

- **Repositorio:** `Simple_Simple_1`, rama `feature/app-movil` creada desde `main` (`9bdbf36`, 6 de noviembre de 2026).
- **Método:** lectura del código, ejecución de las pruebas existentes, build de la app y recorrido en un navegador con
  la vista de un teléfono (412 × 915). No se consultaron servicios en producción ni se abrió ningún secreto: del
  archivo de credenciales solo se revisó su estructura.
- **Ramas:** `Eliam`, `Malena` y `Roberto` apuntan a `ce7456c`, que ya está en `main`; no tienen trabajo propio.

## Resumen

Simple.sv es hoy **una maqueta navegable de frontend estático**: HTML, CSS y JavaScript sin framework ni paso de
compilación. **No existe un backend de trámites, sesiones ni pagos.** El inicio de sesión, la presentación de
solicitudes y el pago son simulaciones que viven en el navegador. El único servicio de servidor es el intérprete con
IA del asistente (`POST /api/asistente`).

Consecuencias para el plan:

- La app puede empaquetar la maqueta tal cual (fase 2), y así se hizo: ver [02-arquitectura.md](02-arquitectura.md).
- Las fases 3 (Identidad Digital) y 5 (pagos) **no pueden integrarse con servicios reales** porque no hay
  servicios, documentación ni ambientes de prueba. Siguiendo la regla de decisión del plan, quedaron diseñadas e
  implementadas detrás de interfaces, con simuladores para desarrollo y pruebas. El build de producción se detiene
  mientras falten los datos institucionales (`config/produccion.json`).

## Respuestas a las preguntas del plan (§14)

### 1. ¿Dónde está implementado el frontend?

| Ruta | Qué es | Evidencia |
|---|---|---|
| `index.html` | Punto de entrada: portada pública con el catálogo, el buscador y el asistente. Si hay sesión de la maqueta, pasa a `nuevoDiseño/Indexlogin.html`. | `index.html:271` |
| `nuevoDiseño/` | El rediseño: 9 páginas (`Indexlogin`, `tramite`, `mis-tramites`, `contactanos`, `correo`, `whatsapp`, `pago`, `login` e `index`) y 20 scripts. Destacan `motor-tramite.js` (formularios y validación), `interprete.js` y `asistente.js` (asistente), `integraciones.js` (integraciones simuladas) y `pasarela-serfinsa.js` (pasarela simulada). | 163 archivos versionados |
| `src/` | Tokens de diseño (`styles/simple-light-vibrant.css`), marca (`assets/brand/`) y datos del catálogo (`data/catalogo-landing.js`). | 6 archivos |
| `SIMPLE ACTUAL/` | Copia capturada del portal de Identidad Digital («Mi cuenta»): `Identidad digital.html` y 36 recursos. No es código propio. | 37 archivos |

Los recursos de terceros se cargan desde CDN: Google Fonts (`index.html:13`) y los íconos de Phosphor desde jsDelivr
con SRI (`index.html:15`).

### 2. ¿Existe un backend y qué responsabilidades tiene?

Solo `servidor.py`, pensado para probar en la red local (`python3 servidor.py [puerto] [dirección]`):

- Sirve la carpeta como `python3 -m http.server`, con soporte de `Range` para los videos en Safari. No sirve la
  bitácora (`registros/`).
- Atiende `POST /api/asistente` con `asistente_ia.py`, que llama a la API de Anthropic (modelo `claude-opus-5-5`)
  con el paquete `anthropic` (`requirements.txt`). Controles: mismo origen, `Content-Type` JSON, cuerpo de 32 KB como
  máximo, 20 peticiones por minuto por IP (`asistente_ia.py:32`) y bitácora solo de metadatos. Sin el paquete o sin
  credenciales responde 503 y el navegador sigue con su intérprete local.

No hay configuración de despliegue en el repositorio (ni Dockerfile, ni Procfile, ni flujos de CI). `bd/` no es una
base de datos en funcionamiento: tiene un esquema PostgreSQL propuesto (`bd/esquema_tramites.sql`, 16 tablas, entre
ellas `accion`, `estado_tramite` y `suscripcion_whatsapp`), una semilla y la base de conocimiento JSON del asistente,
generada con `bd/generar_base_conocimiento.mjs`.

### 3. ¿Qué APIs consume la aplicación?

En todo el frontend hay **una sola llamada de red**: `fetch` a `/api/asistente` (`nuevoDiseño/interprete.js:87`),
con ruta relativa. Lo demás está simulado:

- `integraciones.js` documenta la interfaz que tendría la integración real con SIMPLE v2: presentar la solicitud
  con la tarea inicial publicada como servicio y consultar con `GET /backend/api/tramites/{id}`. También deja
  constancia de que la API actual de SIMPLE recibe el token **en la URL** (`nuevoDiseño/integraciones.js:6`).
- El pago va por una pasarela «SERFINSA» simulada (`pago.html`, `pasarela-serfinsa.js`).

Del lado del servidor, `asistente_ia.py` consume la API de Anthropic.

### 4. ¿Dónde y cómo se almacenan los datos?

| Dónde | Qué |
|---|---|
| `localStorage` y `sessionStorage` del navegador | `simple-sesion` (marca de sesión de la maqueta), `simple-tramites-nuevos` (solicitudes creadas en este navegador) y el estado del asistente: pago simulado, borradores, pendientes, métricas y conversación (`simple-asistente-*`) |
| Archivos versionados | Catálogo y base de conocimiento (`bd/`, `src/data/`), perfil fijo de la cuenta de prueba (`nuevoDiseño/ciudadano.js`) |
| Servidor | `registros/asistente.jsonl`: metadatos de cada consulta a la IA, sin los textos del ciudadano (excluido de git) |

No hay base de datos, ni cifrado en reposo, ni separación por usuario.

### 5. ¿Cómo se implementa actualmente la autenticación?

No hay autenticación. `nuevoDiseño/login.html` es una **copia capturada de login.gob.sv**: Tailwind, Alpine y jQuery
de `login_files/` (`login.html:7`, `:8` y `:16`), un `csrf-token` fijo de aquella sesión (`login.html:13`) y restos
de una extensión del navegador (`login.html:580`). Al «ingresar», `irADestino()` (`login.html:591`) guarda
`simple-sesion=1` en `localStorage` y redirige según una lista de destinos permitidos. `sesion.js` solo lee esa marca
y la borra al cerrar sesión. Los datos del perfil son fijos y ficticios (`ciudadano.js`).

### 6. ¿Dónde está integrado el proveedor de pagos?

No está integrado. `pago.html` y `tramite.html` muestran un formulario de tarjeta con datos de prueba
(`pasarela-serfinsa.js:89`). Al pagar, generan la autorización y la referencia **al azar en el navegador**
(`pago.html:336`, `:424` y `:425`; `tramite.html:1378`) y devuelven «aprobado» al chat **por parámetros de la
dirección** (`pago.html:444`). Para una integración real, esto es justamente lo que el plan prohíbe: el pago se da por
hecho por una respuesta del dispositivo, el formulario de tarjeta lo dibuja Simple.sv (eso lo dejaría dentro del
alcance de PCI DSS) y no hay orden, idempotencia ni conciliación. Detalle en [04-pagos.md](04-pagos.md).

### 7. ¿Qué partes pueden reutilizarse en Android?

Todo el frontend, sin bifurcarlo: el build de la app (`app/scripts/construir-web.mjs`) copia `index.html`,
`nuevoDiseño/` y `src/` y les aplica transformaciones mecánicas. Se reutilizan el motor de trámites y formularios,
el asistente y su intérprete local, el catálogo, los estilos y las imágenes (optimizadas: de 63,9 MB a 12,5 MB).
Las dos copias capturadas (`login.html` y `SIMPLE ACTUAL/Identidad digital.html`) no se empaquetan; en su lugar
quedan redirecciones a pantallas propias de la app.

### 8. ¿Qué cambios son indispensables para Capacitor?

| Problema en el WebView | Solución (en la copia de la app, sin tocar la web) |
|---|---|
| La carpeta `nuevoDiseño` está en disco como NFD y el HTML la nombra en NFC: dentro del APK no se encontraría | Se renombra a `nuevoDiseno` en rutas y contenido |
| Fuentes e íconos por CDN: sin red no cargan y filtran el uso a terceros | Fontsource (Manrope, Roboto) y Phosphor locales, en `vendor/` |
| Copias de sitios oficiales con tokens, analítica (`G-RDRWHWWLM9`, `SIMPLE ACTUAL/Identidad digital.html:63`) y scripts ajenos | Se excluyen y se reemplazan por pantallas propias |
| `viewport-fit=cover` dibuja bajo la barra de estado | Se quita; las barras del sistema las maneja el plugin SystemBars |
| `/api/asistente` relativo no existe dentro de la app, y el servidor rechazaba otros orígenes | Dirección configurable (`SIMPLE_CONFIG`), CORS opcional con `SIMPLE_ORIGENES` en `asistente_ia.py` y `servidor.py:51` |
| Enlaces externos y `target=_blank` | Se abren en el navegador del sistema (plugin Browser) |
| Descarga del calendario con un `<a download>` suelto (`pasos-tramite.js:127`) | Se guarda en caché y se comparte (plugins Filesystem y Share) |
| El dictado usa `SpeechRecognition` (`asistente.js:1338`), que el WebView no tiene | Se oculta el micrófono (`app-sin-dictado`); a futuro, un plugin nativo |
| Botón Atrás de Android | Cierra diálogos y menús, vuelve en el historial o minimiza la app |
| Sin política de seguridad de contenido | CSP en cada página, limitada a la app y a los orígenes configurados |

El único cambio en el frontend web es una línea en `interprete.js`: la dirección del asistente puede venir de la
configuración de la app y, si es `null`, se usa solo el modo básico.

### 9. ¿Qué accesos y documentación institucional hacen falta?

**Identidad Digital** (responsable del servicio): documentación para integradores, protocolo admitido (sin asumir
OIDC), registro del cliente y su identificador, direcciones de retorno permitidas (la app propone
`sv.simple.app:/oauth2redirect`), alcances o atributos, ambientes de prueba y producción, reglas de expiración y
revocación, y soporte e incidentes.

**Pagos** (pasarela y adquirente): proveedor confirmado (la maqueta nombra a SERFINSA), documentación y ambiente
sandbox, página de pago alojada o SDK de tokenización, notificaciones firmadas y su verificación, reembolsos y
conciliación, y si admiten Google Pay en El Salvador (identificador de comercio).

**SIMPLE v2 y backend:** documentación de la API REST, ambientes, un mecanismo de autenticación que no ponga el token
en la URL, quién opera el backend de la app (ver [api/contrato-backend.yaml](api/contrato-backend.yaml)) y dónde se
aloja el asistente.

**Publicación:** dueño del identificador `sv.simple.app` (provisional) y de la cuenta de Google Play; custodia de la
clave de firma (Play App Signing); política de privacidad y formulario de seguridad de datos; autorización para usar
el escudo y la marca de gobierno; validación legal de la protección de datos personales.

## Inventario de tecnologías y dependencias

| Componente | Tecnología | Dependencias |
|---|---|---|
| Frontend web | HTML, CSS y JavaScript sin compilar | Google Fonts (Manrope, Roboto) y Phosphor 2.1.2 por CDN |
| Servidor local | Python 3 (`http.server`) | Biblioteca estándar |
| Asistente con IA | Python 3 | `anthropic>=2.3.0` |
| Herramientas de datos | Node (`bd/*.mjs`), Python (`scrapper/`) | `scrapper/requirements_simple_sv.txt` |
| Pruebas | `node:test` (25 pruebas), `unittest` (20 pruebas) | — |
| App móvil (nuevo) | Capacitor 8.6, esbuild, sharp | Ver `app/package.json` (versiones exactas; `npm audit`: 0 vulnerabilidades) |

## Diagrama actual de componentes y flujo de datos

```text
Navegador ──► index.html, nuevoDiseño/*.html, src/            (archivos estáticos)
   │            │
   │            ├── localStorage: sesión de la maqueta, solicitudes, pago simulado
   │            ├── CDN: Google Fonts, jsDelivr (Phosphor)
   │            └── fetch POST /api/asistente ──► servidor.py ──► asistente_ia.py ──► API de Anthropic
   │                                                              └── registros/asistente.jsonl (metadatos)
   └── login.html y SIMPLE ACTUAL/: copias capturadas de sitios oficiales (no hablan con ellos)
```

## Mapa actual del flujo de autenticación

```text
«Iniciar sesión» ──► nuevoDiseño/login.html (copia de login.gob.sv)
                       └── irADestino(): localStorage simple-sesion = 1 ──► destino de la lista blanca
Cada página: sesion.js lee simple-sesion ──► muestra el perfil fijo de ciudadano.js
«Cerrar sesión»: borra simple-sesion
```

## Mapa actual del flujo de pagos

```text
Trámite con costo ──► modal de pago (tramite.html o pago.html, pasarela-serfinsa.js)
   └── formulario de tarjeta en Simple.sv ──► «Pagar» ──► autorización y referencia al azar (Math.random)
        └── ?pago=aprobado&aut=…&ref=… ──► el chat o el trámite lo dan por pagado
```

## Hallazgos

| # | Hallazgo | Gravedad | Recomendación |
|---|---|---|---|
| 1 | `archivos/credenciales admin simple.md` está versionado desde el commit inicial (`680539f`). Por su nombre, guarda credenciales de administración, y tiene datos personales, entre ellos un DUI. | Alta | Sacarlo del repositorio, purgar el historial (`git filter-repo`) y cambiar cualquier credencial relacionada. No se reproduce aquí su contenido. |
| 2 | Pago dado por hecho en el navegador (respuesta al azar y parámetros de la dirección). | Alta si se usara en producción | El estado lo decide el backend con la notificación verificada de la pasarela ([04-pagos.md](04-pagos.md)). |
| 3 | Formulario de tarjeta dibujado por Simple.sv. | Alta para la integración real | Página de pago alojada por la pasarela o su SDK de tokenización. |
| 4 | Copias capturadas de login.gob.sv y del portal de Identidad Digital, con un token CSRF, analítica de Google y restos de una extensión. | Media | No publicarlas ni empaquetarlas (la app ya las excluye). Evaluar quitarlas también de la web. |
| 5 | La API actual de SIMPLE recibe el token en la URL (según `integraciones.js`). | Media | Usar un encabezado `Authorization` en la integración. |
| 6 | DUI completo a la vista en el modal de pago y en el perfil (datos ficticios). | Media | Enmascararlo (la app usa `*****097-8`). |
| 7 | `scrapper/.venv/` versionado: 861 archivos (unos 13 MB) de un entorno virtual de Windows, más `scraper.log`. | Baja | Quitarlo del repositorio y agregar `.venv/` al `.gitignore`. |
| 8 | `node --test pruebas/` falla en Node 24 porque pasa la carpeta como si fuera un archivo. | Baja | Usar `node --test pruebas/*.test.mjs`. |
| 9 | `/api/asistente` rechazaba cualquier otro origen y no atendía `OPTIONS`, así que la app no podía usarlo. | Resuelto | `SIMPLE_ORIGENES`, `Vary: Origin` y respuesta 204 a la consulta previa, con 3 pruebas nuevas. Por defecto no cambia nada. |

## Riesgos y brechas para Android

- Sin backend ni proveedores confirmados, la app solo puede llegar al ambiente de pruebas con servicios simulados.
- El frontend usa manejadores en línea con valores interpolados, por eso la CSP necesita `'unsafe-inline'` en
  `script-src`. Para quitarlo hay que mover esos manejadores a `addEventListener`.
- El dictado por voz no está disponible en el WebView.
- La sesión de la maqueta es una marca en `localStorage`: la app la sincroniza con su sesión real, pero las pantallas
  de la maqueta siguen mostrando el perfil fijo de `ciudadano.js`.
- Falta probar en dispositivos físicos: no hay JDK ni SDK de Android en el equipo donde se hizo este trabajo (el flujo
  de CI compila el APK).

## Recomendación de arquitectura

Capacitor empaqueta la misma maqueta, transformada en el build. Encima van una capa móvil propia y pantallas para
identidad, biometría y cuenta, más un backend intermedio (BFF) que sea el único que hable con Identidad Digital, con
la pasarela y con SIMPLE v2. Detalle en [02-arquitectura.md](02-arquitectura.md).
