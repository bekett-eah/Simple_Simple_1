# Identidad Digital, sesión y biometría (fases 3 y 4)

## Estado

- **No hay integración real con Identidad Digital.** Faltan la documentación para integradores, el registro de la app
  como cliente y un ambiente de pruebas. La regla de decisión del plan prohíbe integrarse sin ellos
  ([01-auditoria-repositorio.md](01-auditoria-repositorio.md), pregunta 9).
- **No se da por hecho que el proveedor use OIDC.** `src/identidad/proveedor-oidc.js` es la hipótesis del plan. Solo
  se activa con `identidad.proveedor = "oidc"` y los datos que entregue el proveedor (`emisor`, `clienteId`), y no
  tiene direcciones fijas en el código. Si el proveedor usa otro mecanismo (OAuth 2.0 sin OIDC, SAML o un servicio
  propio), se escribe otro adaptador con la misma interfaz (`iniciar`, `completar` y `haySolicitudPendiente`) y el
  resto de la app no cambia.
- **Desarrollo y pruebas** usan `proveedor-simulado.js`: un diálogo con la cuenta de prueba de la maqueta que siempre
  se presenta como simulación. Genera `state`, `nonce` y PKCE igual que el proveedor real. La validación del build
  impide usarlo en producción.

## Reglas del plan y cómo se cumplen

| Regla del plan | Cómo se cumple |
|---|---|
| No almacenar contraseñas de Identidad Digital | La persona escribe su contraseña en el sitio del proveedor, en el navegador del sistema (Custom Tabs). La app no la ve. |
| No almacenar tokens de larga duración sin protección | Los tokens de la app viven en `sessionStorage` y mueren con el proceso. La única credencial duradera, la del dispositivo, solo existe cifrada con una clave del Keystore que exige biometría. |
| No guardar plantillas biométricas | La huella y el rostro los maneja Android. La app solo sabe si se pudo descifrar la credencial. |
| No asumir OIDC ni inventar endpoints | Adaptador intercambiable; el endpoint de autorización sale del documento de descubrimiento del emisor configurado. |
| Los tokens del proveedor no llegan al teléfono | El backend canjea el código y se queda con los tokens de Identidad Digital. La app recibe solo su propia sesión. |

## Primer ingreso (hipótesis OIDC)

Sigue las recomendaciones para apps nativas de RFC 8252: código de autorización con PKCE en el navegador del sistema,
nunca en un WebView.

```text
App (inicio-sesion.html)              Custom Tabs              Identidad Digital          Backend de la app
 1. GET {emisor}/.well-known/openid-configuration ───────────────► documento de descubrimiento
 2. state, nonce y PKCE (S256); guarda la solicitud (10 minutos)
 3. abre authorization_endpoint ───► la persona inicia sesión
 4. ◄──── sv.simple.app:/oauth2redirect?code=…&state=…&iss=…
 5. valida state, iss y error
 6. POST /v1/sesiones { code, codeVerifier, nonce, redirectUri, dispositivo } ─────────► canjea el código y
                                                                                         valida el id_token
 7. ◄──────────────────────────────────────────────── accessToken, refreshToken y usuario (sesión de la app)
 8. ofrece activar la biometría
```

**Solicitud de autorización.** Lleva `response_type=code`, `client_id`, `redirect_uri`, `scope` (por defecto
`openid`), `state` y `nonce` (16 bytes aleatorios cada uno), `code_challenge` y `code_challenge_method=S256`. El
verificador PKCE tiene 32 bytes aleatorios, o sea 43 caracteres, el mínimo de RFC 7636.

**Descubrimiento.** El `issuer` del documento debe ser idéntico al emisor configurado y el endpoint de autorización
debe usar HTTPS (RFC 8414, sección 3.3). La petición va sin cookies y sin seguir redirecciones. Sale del WebView con
origen `https://localhost`, así que el proveedor tiene que permitir CORS en ese documento. Es habitual, pero hay que
confirmarlo; si no, el backend puede entregar la dirección de autorización. El origen del emisor se agrega solo al
`connect-src` de la CSP.

**Solicitud pendiente.** `state`, `nonce`, el verificador y la hora se guardan en `localStorage`
(`simple-app-oidc-pendiente`), porque Android puede terminar el proceso de la app mientras la persona está en el
navegador. Vence a los 10 minutos y se borra cuando se usa, cuando la persona cancela y cuando el navegador no abre.

**Retorno.**
- Si la app seguía viva, llega por el evento `appUrlOpen`.
- Si Android la reinició, la capa móvil detecta con `App.getLaunchUrl()` que hay un retorno sin procesar y lleva a
  `inicio-sesion.html`, que completa el ingreso. Se anota la dirección procesada para no usarla dos veces.
- La dirección debe empezar con la redirección configurada, el `state` debe coincidir y, si llega `iss`, debe ser el
  emisor esperado (RFC 9207).
- `error=access_denied` cuenta como cancelación, igual que cerrar el navegador sin volver. En ese caso se espera
  1,5 s, porque al volver por el enlace Android también cierra el navegador.

**Canje en el backend.** El backend presenta el código en el endpoint de tokens con el verificador y la misma
`redirect_uri`, como cliente público o confidencial según lo que admita el proveedor. Valida el `id_token`: firma
con las claves publicadas por el emisor (JWKS), `iss`, `aud`, `exp`, `iat` y que el `nonce` sea el recibido.
Después crea o vincula a la persona y emite la sesión de la app. Así, los tokens del proveedor y un eventual secreto
de cliente nunca llegan al teléfono, y la sesión se puede revocar desde un solo lugar.

**Dirección de retorno.** `sv.simple.app:/oauth2redirect` usa un esquema privado con el identificador de la app
invertido (RFC 8252, sección 7.1). Está declarada en el manifiesto con `@string/custom_url_scheme`, y
`verificar-paquete.mjs` comprueba que coincida con el `appId`. Otra app podría registrar el mismo esquema: PKCE
impide que use un código interceptado (RFC 8252, sección 8.1). La alternativa más fuerte es un App Link
`https://` verificado con `assetlinks.json`, que necesita un dominio de la institución; se decide con Identidad
Digital.

## Sesión de la app (`src/sesion/sesion.js`)

- **La fuente de verdad es el backend.** El teléfono guarda en `sessionStorage` (`simple-app-sesion`) los tokens que
  el backend le entrega: `accessToken` (15 minutos en el simulador), `refreshToken` de un solo uso, el vencimiento y
  los datos visibles de la persona, con el documento enmascarado.
- **Renovación.** Se renueva 60 s antes del vencimiento (`segundosRenovacionAnticipada`). Si el backend rechaza la
  renovación (400 o 401), la sesión termina y se pide entrar de nuevo. Reutilizar un `refreshToken` revoca la
  sesión: así se detecta un robo (contrato, `POST /v1/sesiones/renovacion`).
- **Cerrar sesión.** Primero se cierra en el teléfono y después se pide al backend que revoque los tokens; si no
  responde, la sesión queda cerrada en el teléfono igual. La credencial biométrica se conserva para el próximo
  ingreso, y la huella no se vuelve a pedir hasta reabrir la app.
- **Marca de la maqueta.** Las páginas de la maqueta muestran la vista con sesión según `simple-sesion` en
  `localStorage`. La capa móvil la alinea con la sesión real al cargar cada página.
- **Bloqueo por inactividad.** Al pasar a segundo plano (`pause`) se anota la hora. Si la app vuelve (`resume`)
  después de 5 minutos o más (`minutosInactividad`), se cierra la sesión del proceso y se pide la huella, o
  Identidad Digital si no hay biometría.
- **Al reabrir la app** (proceso nuevo), `sessionStorage` está vacío: con biometría activada se pasa por el
  desbloqueo; sin ella se entra a la portada sin sesión.
- **Destinos.** `?volver=`, `?siguiente=` y `?destino=` solo aceptan rutas del mismo origen
  (`src/nucleo/destinos.js`), para evitar redirecciones abiertas.

## Ingreso con biometría

**Activación** (`biometria.html`, después del primer ingreso o desde Mi cuenta):

1. Solo se ofrece con **biometría fuerte** (clase 3), la única que puede liberar una clave del Keystore:
   `isAvailable({ useFallback: false })` debe devolver `strongBiometryIsAvailable`. El PIN del teléfono no sirve como
   respaldo; la alternativa siempre visible es Identidad Digital.
2. El backend entrega una **credencial del dispositivo**: aleatoria, revocable y con vencimiento (30 días en el
   simulador). El backend guarda solo su hash.
3. La app la guarda con `setData` y `AccessControl.BIOMETRY_CURRENT_SET`, cifrada con la clave pública de un par RSA
   (OAEP con SHA-256) del Android Keystore. La clave privada, la única que la descifra, exige biometría fuerte en cada
   uso y se libera con BiometricPrompt y un `CryptoObject`: la biometría está ligada a la criptografía y no es un
   simple evento de la interfaz.
4. Guardar no pide la huella, así que la app lee la credencial una vez. La persona confirma con su huella o su rostro
   y se comprueba que funciona, como pide el plan. Si no confirma, la credencial se borra y el backend la revoca.
5. Si la persona elige «Ahora no», no se le vuelve a ofrecer en ese teléfono (puede activarla desde Mi cuenta).

**Desbloqueo** (`desbloqueo.html`): `getSecureData` muestra el aviso del sistema («Ingresa a Simple.sv», con el botón
«Usar Identidad Digital»). Con la credencial liberada se pide una sesión nueva (`POST /v1/sesiones/dispositivo`).

| Situación | Qué hace la app |
|---|---|
| La persona cancela | No borra nada; puede reintentar o usar Identidad Digital |
| Demasiados intentos (bloqueo temporal o permanente) | Lo informa y ofrece Identidad Digital |
| Cambiaron las huellas o rostros del teléfono | Android invalida la clave; el plugin la borra junto con lo cifrado y responde con el código 21. La app olvida la biometría y pide Identidad Digital. Así se cubre el caso de alguien que conoce el PIN y agrega su propia huella. |
| El backend revocó o venció la credencial (401 o 403) | Se borra del teléfono y se pide Identidad Digital |
| Desactivar la biometría (Mi cuenta) | Se borra la credencial y el backend desvincula el dispositivo |
| Desvincular el dispositivo (Mi cuenta) | El backend olvida el dispositivo, se borra la credencial y se cierra la sesión |

En el navegador de escritorio no hay Keystore. Ahí la biometría se simula con un diálogo y `localStorage` solo para
probar los flujos; no es segura y en producción el navegador no ofrece biometría.

## Qué se guarda y dónde

| Dato | Dónde | Cuánto dura | Protección |
|---|---|---|---|
| Contraseña de Identidad Digital | En ninguna parte | — | La escribe la persona en el sitio del proveedor |
| Tokens de Identidad Digital (`id_token`, `access_token`) | Solo en el backend | Lo que defina el backend | No llegan al teléfono |
| Solicitud pendiente (`state`, `nonce`, verificador PKCE) | `localStorage`: `simple-app-oidc-pendiente` | 10 minutos como máximo; se borra al usarla | Almacenamiento privado de la app |
| `accessToken` y `refreshToken` de la app | `sessionStorage`: `simple-app-sesion` | Hasta cerrar la app o hasta el bloqueo por inactividad | Memoria del proceso |
| Credencial del dispositivo | Android Keystore (cifrada) | Hasta que venza, se revoque o cambie la biometría | Clave que exige biometría fuerte en cada uso |
| Biometría activada (sí o no) | `localStorage`: `simple-app-biometria` | Hasta desactivarla | No es secreto |
| Identificador del dispositivo | `localStorage`: `simple-app-dispositivo` | Hasta desinstalar | UUID aleatorio; no identifica el hardware |
| Marca de la maqueta | `localStorage`: `simple-sesion` | Igual que la sesión | No es secreto |

`allowBackup="false"` y `dataExtractionRules` impiden que estos datos salgan en una copia de seguridad en la nube o
pasen a otro teléfono.

## Amenazas consideradas

| Amenaza | Mitigación |
|---|---|
| Otra app registra el mismo esquema e intercepta el código | PKCE S256; a futuro, un App Link verificado |
| Respuesta inyectada o CSRF en el retorno | `state` de un solo uso; la dirección debe ser la configurada |
| Mezcla de proveedores | `issuer` del descubrimiento y `iss` del retorno (RFC 9207) |
| Repetición de un `id_token` | `nonce`, que valida el backend |
| Suplantación del inicio de sesión dentro de la app | Custom Tabs muestra el dominio real del proveedor y la app no puede leer lo que se escribe |
| Robo del `refreshToken` | Un solo uso con detección de reutilización, atado al dispositivo y solo en la memoria del proceso |
| Teléfono perdido o robado | La credencial exige biometría y se puede revocar en el backend. Falta definir con la institución un canal para desvincular sin el teléfono. |
| Teléfono desatendido con la sesión abierta | Bloqueo tras 5 minutos en segundo plano |
| Copia de seguridad o traspaso a otro teléfono | `allowBackup="false"` y `dataExtractionRules` |
| Redirecciones abiertas con `?volver=` y similares | Solo rutas internas |

## Qué hay que confirmar con Identidad Digital

1. Protocolo que admite (OIDC, OAuth 2.0, SAML u otro) y, si es OIDC, su documento de descubrimiento.
2. Registro de la app: tipo de cliente (público con PKCE o confidencial a través del backend), `client_id` y
   direcciones de retorno permitidas (esquema privado o App Link).
3. Alcances y atributos que entrega (nombre, documento, correo) y la base legal para tratarlos.
4. Ambiente de pruebas y cuentas de prueba.
5. Duración de la sesión del proveedor, cierre de sesión (`end_session_endpoint`) y revocación.
6. Si admite `prompt=login`, `max_age` o `acr_values`, para pedir de nuevo la identidad antes de operaciones sensibles.
7. CORS en el documento de descubrimiento.
8. Requisitos propios para apps móviles, y soporte e incidentes.

## Cómo activar el proveedor real

1. Completar en `config/produccion.json` `identidad.emisor`, `identidad.clienteId` y, si hace falta, `alcances`.
   También `backend.url`. El build de producción falla mientras falten.
2. Implementar en el backend `POST /v1/sesiones` según el contrato (canje del código y validación del `id_token`).
3. Si el proveedor no usa OIDC, escribir el adaptador correspondiente y elegirlo en `app-movil.js`.
4. Probar en el ambiente de pruebas del proveedor: ingreso, cancelación, cierre de la app durante el ingreso, cambio
   de huellas, revocación y bloqueo por inactividad (ver [05-pruebas-seguridad-despliegue.md](05-pruebas-seguridad-despliegue.md)).
