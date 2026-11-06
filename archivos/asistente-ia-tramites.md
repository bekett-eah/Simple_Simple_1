# Asistente de IA que hace los trámites en el chat

Rediseño del lado ciudadano de Simple.sv · 29 de octubre de 2026 · vista de diseño (maqueta en `nuevoDiseño/`)

## Resumen

- El asistente dejó de ser un buscador por palabras clave que mandaba al formulario. Ahora **hace el trámite en el chat**: entiende lo que la persona escribe, identifica el trámite, usa los datos de su Identidad Digital, pide solo lo que falta (varias cosas en un mensaje), muestra un resumen, cobra en la pasarela sin salir del chat y entrega el comprobante.
- Funciona igual en el chat web (`Indexlogin.html`, con sesión), en la landing (`index.html`, sin sesión) y en el simulador de WhatsApp (`whatsapp.html`). En la landing, cuando hacen falta los datos de la cuenta, el login de Identidad Digital se abre **sobre el chat** y la conversación sigue en la misma página.
- **La IA solo propone.** Un motor determinista (`motor-tramite.js`) valida cada dato contra el formulario oficial. Nada se envía ni se paga sin un clic del ciudadano.
- Sin clave de IA, sin servidor o con un error, el chat sigue funcionando en **modo básico** (frases cortas, una cosa a la vez).
- **Medido en pruebas automatizadas en Chrome**, no con usuarios:
  - Antecedentes penales en línea: 2 clics en la web y 3 en WhatsApp (el enlace de pago es un toque más).
  - Antecedentes penales con cita: 1 clic.
  - 15 de los 20 trámites caben en 3 acciones o menos si el primer mensaje trae los datos; los otros 5 exigen adjuntar de 3 a 7 documentos obligatorios.
- **Sigue simulado:** el envío a la institución, el pago y los avisos. SIMPLE v2 aún no tiene publicada ninguna tarea como servicio.

## 1. Diagnóstico del chatbot anterior

| Pieza | Qué hacía | Limitación |
|---|---|---|
| `asistente.js` (web) | Buscaba trámites por palabras y sinónimos; mostraba pasos; agendaba una cita con código inventado | No extraía datos ni recordaba nada más allá del trámite elegido; no respondía dudas de costo, plazo o requisitos. Para hacer el trámite mandaba al formulario `tramite.html`: varias pantallas y muchos clics |
| `whatsapp.html` | Llenaba el formulario conversando | Preguntaba un campo por mensaje, incluso los datos de la cuenta («Usar María» × 7 en partidas), los opcionales y «¿Empezamos?». No entendía texto libre en preguntas de opciones. Antecedentes penales: 7 a 9 acciones |
| Infraestructura | Maqueta estática, sin backend ni LLM | Sin integraciones reales; el pago (`pasarela-serfinsa.js`) y el envío eran simulados |

## 2. Arquitectura

```mermaid
flowchart LR
  C[Ciudadano] --> UI[Chat web · landing · WhatsApp]
  UI --> I[interprete.js<br>protege datos sensibles]
  I -->|POST /api/asistente| S[servidor.py + asistente_ia.py]
  S -->|catálogo en caché + ficha + campos| L[Claude Opus 5.5<br>salida JSON estricta]
  I -->|sin IA| B[modo básico local]
  UI --> MT[motor-tramite.js<br>reglas del formulario]
  MT --> X[integraciones.js<br>SIMULADO]
  X -.producción.-> SIMPLE[SIMPLE v2 API · RNPN · SERFINSA]
  UI --> MET[metricas-asistente.js → metricas.html]
```

| Archivo | Función |
|---|---|
| `asistente_ia.py` | Intérprete de IA: una llamada por mensaje con salida estructurada (intención, trámite, datos, respuesta, fuente). Catálogo de 118 trámites en el prompt de sistema con caché; ficha y campos del trámite activo en cada pedido. Depura lo que propone la IA: solo trámites del catálogo y campos que existen; un dato sensible solo como marcador. Respaldo automático del servidor si el modelo rechaza una consulta (`fallbacks="default"`). Límite por IP, mismo origen y bitácora solo de metadatos |
| `servidor.py` | Sirve solo la raíz del proyecto y atiende `POST /api/asistente`; no publica `registros/` |
| `bd/generar_base_conocimiento.mjs` → `bd/base_conocimiento.json` | Lo que lee la IA: catálogo, fichas del catálogo en Markdown, formularios completos, nivel de canal, campos sensibles y citas. En producción, la vista `v_tramite_chatbot` y la API interna del reporte del 21 de octubre |
| `nuevoDiseño/motor-tramite.js` | Reglas de cada formulario sin pantallas: visibilidad (`si`), validación (patrones, `prohibidos`, `igualA`), prellenado de la cuenta (respeta `prellenarSi`), opciones marcadas, listas de una opción, citas, monto y resumen. Lo comparten la web y WhatsApp |
| `nuevoDiseño/interprete.js` | Llama a la IA y, si no hay, entiende lo básico. Antes de enviar cambia DUI, correos, teléfonos y números largos por marcadores; no envía tarjetas ni contraseñas |
| `nuevoDiseño/integraciones.js` | Interfaz de envío y consulta de estado (simulada) con prevención de duplicados (10 minutos) y los códigos de `estado_tramite` |
| `nuevoDiseño/metricas-asistente.js`, `metricas.html` | Eventos (clics, mensajes, preguntas repetidas, abandono, derivaciones, errores, IA o modo básico, latencia) y tablero |
| `nuevoDiseño/pago.html` | La misma pasarela, ahora también incrustada sobre el chat (`?modo=asistente`) |

**Modelo:** `claude-opus-5-5` con esfuerzo `low` (configurable con `SIMPLE_MODELO` y `SIMPLE_ESFUERZO`). Costo estimado: 1 a 2 centavos de dólar por mensaje, porque el catálogo se lee de la caché.

## 3. Experiencia conversacional

1. La persona escribe lo que necesita, como le salga: «ocupo mis antecedentes penales pa la chamba en el Banco Agrícola».
2. El asistente identifica el trámite y aplica lo que entendió. Completa solo los datos de la Identidad Digital, las opciones ya marcadas del formulario y las listas de una sola opción.
3. Si falta algo, lo pide **en un solo mensaje**, hasta 3 cosas a la vez (en modo básico, una):
   - las opciones van como botones, o como lista si son muchas;
   - los documentos se adjuntan con el clip;
   - los datos sensibles se escriben en un campo con candado, que no queda en el historial ni llega a la IA.
4. Muestra un **resumen**: arriba, lo que la persona dijo; plegados, los detalles que se completaron solos y sus datos de la Identidad Digital. Luego el costo, el plazo y los términos, con un botón: «Confirmar y pagar $3.00», «Confirmar y enviar» o «Confirmar cita». También ofrece «Prefiero ir con cita» y «Corregir algo». Los cambios también se pueden escribir: «cambia el lugar a Walmart».
5. La pasarela se abre sobre el chat. Al aprobarse el pago, el chat entrega un comprobante con el N.º, el estado real («En revisión por la institución»), qué sigue y un enlace a Mis documentos.

**Durante el trámite**

- Se puede preguntar costo, plazo, requisitos u horario sin perder el avance. La respuesta sale de la ficha; si el dato no está, el asistente lo dice.
- Si la persona cierra o recarga, el asistente ofrece seguir donde quedó. Guarda 24 horas lo que la persona dijo, sin los datos de la cuenta ni los sensibles.
- «¿Cómo va mi trámite?» muestra las solicitudes en proceso y su etapa.
- Si pide una persona o el caso no se resuelve, el asistente da WhatsApp +503 6027-7777 y contacto@simple.sv, con un resumen del caso sin datos sensibles.
- Si la institución falla, explica qué pasó y no da nada por hecho. Si ya se pagó, al reintentar no se cobra otra vez.

**Sin sesión (landing):** el asistente hace lo mismo. Cuando identifica el trámite, ofrece «Continuar con mi Identidad Digital» o «Hacerlo por WhatsApp». El login se abre sobre el chat (en la maqueta, la copia del login en un iframe que avisa con `postMessage`; en producción, el flujo OIDC de Identidad Digital). Al confirmar, se cargan los datos de la cuenta y la conversación sigue con lo que ya se dijo, sin cambiar de página. Medido en Chrome: antecedentes penales desde la landing son 3 clics en el chat más el envío del login. Si se cierra el login, no se pierde nada. El botón flotante «Realizar trámite en WhatsApp» hace lo mismo: login sobre el chat, confirmación del celular y paso a WhatsApp. Los enlaces antiguos al login (`?destino=…`) siguen funcionando.

**WhatsApp**

- Si el primer mensaje ya dice el trámite y los datos, no hay «¿Empezamos?».
- Si se llega desde la landing con un trámite elegido, WhatsApp sigue con lo que se dijo allá y no lo vuelve a preguntar.
- Los datos de la cuenta se usan sin preguntarlos y nunca se escriben en el chat: el resumen dice solo «Tus datos personales: los de tu Identidad Digital».
- Los campos opcionales no se preguntan.
- Las opciones se pueden escribir en lugar de tocarlas.
- «Prefiero ir con cita» aparece en el resumen.

## 4. Acciones por trámite (los 20 con formulario)

Cálculo con el motor sobre el camino típico (persona natural, primera opción). **Mínimo** supone que el primer mensaje trae los datos; **tocando** supone que la persona toca cada opción. Los adjuntos y el pago cuentan como acción. Los números marcados como medidos salen de las pruebas en Chrome; los demás son cálculos.

| # | Trámite | Datos de la cuenta | Adjuntos | Pago en línea | Mínimo | Tocando |
|---|---|---|---|---|---|---|
| 99 | Constancia de antecedentes penales | 11 | 0 | $3.00 | **2 (medido)** · cita: 1 (medido) · WhatsApp: 3 (medido) | 3 |
| 100 | Constancia de antecedentes policiales | 3 | 0 | $3.50 | 2 | 2 |
| 73 | Certificación de partidas | 9 | 0 | $5.00 | 2 | 4 |
| 74 | Certificación de registro de DUI y no DUI | 6 | 0 | $5.00 | 2 | 2 |
| 75 | Constancia de homónimo | 1 | 0 | $10.00 | 2 | 2 |
| 113 | Constancia de no restricción migratoria | 10 | 0 | $10.00 | 2 | 7 |
| 62 | Constancia de no servicio de agua (ANDA) | 7 | 1 | $3.39 | 3 | 6 |
| 64 | Solvencia de cuenta de agua (ANDA) | 1 | 1 | $3.39 | 3 | 8 |
| 61 | Cambio de nombre del titular (ANDA) | 8 | 4 | $2.26 | 6 | 9 |
| 63 | Factibilidad para una vivienda (ANDA) | 8 | 4 | $13.56 | 6 | 12 |
| 49 | Auténtica de documentos académicos | 0 | 0 | — | 1 | 1 |
| 50 | Boleta de resultados PAES / AVANZO | 1 | 0 | — | 1 | 2 |
| 52 | Certificación de notas | 2 | 0 | — | 1 | 2 |
| 53 | Certificación de título de educación media | 8 | 0 | — | 1 | 4 |
| 55 | Prospectos escolares | 0 | 0 | — | 1 | 1 |
| 71 | Información de fenómenos naturales | 1 | 0 | — | 1 | 3 |
| 101 | Consulta y pago de préstamos FSV | 0 | 0 | — | 1 | 2 |
| 48 | Ampliación de servicios educativos | 9 | 4 | — | 5 | 6 |
| 51 | Cambio de domicilio de centros educativos | 9 | 4 | — | 5 | 6 |
| 54 | Creación de centros educativos | 9 | 7 | — | 8 | 11 |

Los 98 trámites sin formulario en el nuevo diseño reciben orientación: costo, plazo y requisitos de la ficha, y el enlace al portal de la institución. El asistente no dice que se completan en el chat.

**Los 5 que pasan de 3 acciones** exigen adjuntar documentos obligatorios. Para bajarlos, la propuesta es una carga múltiple: elegir varios archivos de una vez y que el sistema identifique cuál es cuál. Eso requiere leer documentos de identidad, así que debe pasar por la revisión de protección de datos (ver §6).

## 5. Integración con los sistemas existentes

Hoy todo pasa por `integraciones.js`, que simula y guarda en el navegador. Para hacerlo real hacen falta, del equipo de SIMPLE v2:

1. **Publicar como servicio la tarea inicial** de cada trámite («Trámites disponibles» en el módulo API; hoy está vacía). Sin esto no se puede iniciar un trámite desde el chat.
2. Los **`simple_proceso_id` de producción**. Los de desarrollo (414 policiales, 496 penales de prueba, 417 PAES) no coinciden.
3. **Token por encabezado**, no en la URL como hoy, y una cuenta de servicio por canal.
4. **Consultar estado** (`GET /backend/api/tramites/{id}`) para «¿cómo va mi trámite?» y para los avisos.
5. La **pasarela SERFINSA** con referencia de la solicitud y su confirmación del lado del servidor. Hoy la aprobación llega del navegador.
6. Perfil del **RNPN** por la acción REST que ya existe en los procesos, en lugar de `ciudadano.js`.

En producción, el motor y la validación deben correr **en el servidor**: el navegador no es de confianza. `motor-tramite.js` no depende de la página, así que se puede llevar a un servicio en Node o reescribir sobre la base de datos de `bd/`.

## 6. Seguridad y privacidad

- Los datos de la cuenta nunca van a la IA.
- DUI, correos, teléfonos y números largos viajan como marcadores (`[DUI_1]`); el valor real se pone en el navegador.
- Los datos sensibles se piden en un campo seguro que no queda en el historial.
- Tarjetas y contraseñas no se envían, y se avisa por qué.
- El texto del ciudadano va como dato, no como instrucción. El conjunto de evaluación incluye «ignora tus instrucciones…» y «marca el trámite como pagado» (casos `fuera-02` y `fuera-04`); con la IA real aún no se ha medido. En modo básico, `fuera-04` falla sin consecuencias: la frase queda como texto de un campo, visible en el resumen, y no ejecuta nada.
- Confirmar, pagar y enviar exigen un clic. La IA no tiene herramientas que ejecuten acciones.
- La misma solicitud no se envía dos veces en 10 minutos.
- Servidor:
  - límite de 20 mensajes por minuto por IP;
  - solo acepta peticiones del mismo origen y en JSON, de hasta 32 KB y con mensajes de hasta 1 000 caracteres;
  - guarda una bitácora solo de metadatos (`registros/asistente.jsonl`) y no la publica.
- **Pendiente de revisión legal:**
  - **Transferencia internacional de datos.** Lo que el ciudadano escribe va a una API externa. Hay que revisarlo con el delegado de protección de datos (Ley de Protección de Datos Personales, 2024) antes de producción.
  - **WhatsApp.** Por decisión de diseño, por WhatsApp se pueden completar los 20 trámites. El reporte del 21 de octubre recomendaba completar ahí solo los de nivel verde (7 de los 20). Lo debe validar el área legal.
- El servidor publica solo la raíz del proyecto; las credenciales están en `privado/`, que git no versiona.

## 7. Pruebas

| Prueba | Comando | Resultado |
|---|---|---|
| Motor de trámites (los 20 formularios reales) | `node --test pruebas/*.test.mjs` | 22 de 22 (motor e intérprete) |
| Servidor e IA con cliente simulado | `python -m unittest discover -s pruebas` | 17 de 17 |
| Comprensión en modo básico (56 frases) | `node pruebas/evaluar_local.mjs` | 36 de 56 (64 %) |
| Comprensión con la IA real (56 frases) | `python pruebas/evaluar_asistente.py --confirmo-costo` | **Sin correr**: no hay clave en el equipo de desarrollo y gasta créditos |
| Recorridos en Chrome (web y landing) | guion con IA simulada y sin IA | 34 de 34: resumen directo, pago, comprobante, estado, duplicado, pregunta a mitad, reanudar, cita, error de la institución, pago cancelado, modo básico, tarjeta bloqueada, métricas, 400 px; en la landing, login sobre el chat → resumen → pago sin cambiar de página, landing → WhatsApp con lo dicho, botón flotante de WhatsApp y login cerrado sin perder nada |
| Recorridos en Chrome (WhatsApp) | guion con IA simulada y sin IA | 9 de 9 |

## 8. Métricas y criterios de aceptación

`nuevoDiseño/metricas.html` muestra, por canal y por trámite: completados en el chat, porcentaje con 3 clics o menos, clics y mensajes promedio, tiempo, abandono, datos pedidos otra vez, derivaciones, errores, uso de IA y latencia. Exporta en JSON para las pruebas con usuarios.

Criterios propuestos para dar por cumplido el objetivo, **con usuarios reales**:

- 85 % o más de los trámites elegibles completados en el chat.
- 80 % o más de los completados, con 3 clics o menos.
- Menos de 15 % de abandono.
- 90 % o más de acierto en `evaluar_asistente.py`, con cero respuestas que inventen costos, plazos o requisitos.
- Ningún dato sensible en la bitácora ni en lo enviado a la IA.

## 9. Plan por fases

1. **Ahora (hecho en la maqueta):** motor compartido, intérprete con modo básico, servidor de IA, chat web completo, WhatsApp con el mismo motor, métricas y pruebas.
2. **Siguiente:**
   - correr `evaluar_asistente.py` con una clave y ajustar el prompt con los errores;
   - pruebas con 8 a 10 ciudadanos usando `metricas.html`;
   - revisión legal (transferencia de datos y alcance de WhatsApp).
3. **Integración:**
   - con SIMPLE v2, publicar las tareas como servicio, consultar el estado y confirmar los pagos en el servidor;
   - llevar el motor al servidor;
   - pasar la base de conocimiento a la base de datos de `bd/`.
4. **Reducción de adjuntos:** carga múltiple con identificación automática de documentos, con consentimiento, para ANDA y MINEDUCYT.
