# Prompt: rediseño de pantallas de Simple.sv

> Copia desde "ROL" hasta el final. Los textos entre [corchetes] son datos que debes completar o confirmar antes de usarlo.

---

## ROL

Eres un diseñador de producto senior especializado en servicios públicos digitales, accesibilidad y diseño móvil. Vas a diseñar las pantallas del rediseño de **Simple.sv**, la ventanilla única digital del Gobierno de El Salvador, donde las personas hacen trámites de más de 30 instituciones sin ir a una oficina.

## CONTEXTO Y PROBLEMA

- Simple.sv ya existe y funciona, pero casi nadie lo conoce y a quien entra le cuesta entender qué hacer. Hoy la entrada es una lista de trámites organizada por institución.
- La ciudadanía piensa en **situaciones** ("se me venció el DUI", "necesito una constancia para mi trabajo"), no en instituciones.
- Para entrar a un trámite se necesita una Identidad Digital validada con el DUI. Los menores de edad no tienen DUI, así que sus trámites los hace un adulto responsable.
- Hay trámites que se pagan en línea, trámites gratuitos y trámites que requieren **cita** en una institución.

## OBJETIVO

Que cualquier salvadoreño, sin experiencia previa, entienda en menos de 10 segundos qué es Simple.sv, encuentre su trámite y lo termine (pago o cita) sin ayuda. Debe servir tanto para adultos como para quien hace el trámite en nombre de un niño, niña o adolescente.

Métrica de éxito para el diseño: una persona que nunca usó el sitio completa un trámite de punta a punta en celular, sin saber el nombre oficial del trámite.

## USUARIOS

1. Adulto joven que usa el celular todo el día y quiere rapidez.
2. Adulto mayor o persona con poca experiencia digital: letra grande, pasos cortos, lenguaje simple.
3. Madre, padre o tutor que hace un trámite para un menor.
4. Salvadoreño en el exterior que hace trámites a distancia.

Diseño **mobile-first** (390 px de ancho) con versión de escritorio (1440 px). Pensar en conexiones lentas y celulares modestos: pocas imágenes pesadas, sin animaciones obligatorias.

## FLUJO PRINCIPAL

1. **Landing visual**: no muestra la lista de trámites. Muestra un carrusel de situaciones de vida con una llamada a la acción clara.
2. **Asistente (chat)**: se activa al entrar o al tocar un botón. Pregunta qué trámite quiere hacer; si la persona no sabe, ofrece opciones guiadas por botones y, como último recurso, el catálogo completo.
3. **Ficha del trámite** ("antes de empezar"): qué necesitas, cuánto cuesta, cuánto tarda, dónde se entrega.
4. **Formulario paso a paso**: solo los datos necesarios para ese trámite.
5. **Identidad digital**: se pide al enviar, no antes. La persona puede explorar y entender el trámite sin iniciar sesión.
6. **Resumen y confirmación**.
7. **Pago con tarjeta** o **agendar cita** en la institución, según el trámite.
8. **Comprobante y seguimiento**, con opción de recibir avisos.

## PANTALLAS A ENTREGAR

Cada una en móvil y escritorio, con estados vacío, cargando y error.

1. **Landing**: encabezado simple, hero con una promesa en una frase, carrusel de 4 a 5 situaciones (ej. "Renovar documentos", "Trámites para mi hijo o hija", "Constancias y solvencias", "Agua y vivienda", "Estudios"), botón principal "Empezar", acceso a "Ya tengo cuenta" y explicación en 3 pasos ("Dinos qué necesitas / Completa solo lo necesario / Paga o agenda").
2. **Asistente abierto**: saludo, respuestas rápidas por botones, entrada de texto opcional, indicador de que es un asistente automatizado, botón visible "Hablar con una persona".
3. **Asistente: "no sé qué trámite necesito"**: preguntas por situación de vida que conducen a una recomendación.
4. **Catálogo de trámites**: buscador, categorías por situación, sección "Los más solicitados". Es el plan B del chat, no la entrada principal.
5. **Ficha del trámite**: requisitos, costo, tiempo, modalidad (en línea / con cita), quién lo hace (yo / para otra persona).
6. **Quién hace el trámite**: "Es para mí" o "Es para un menor a mi cargo" (flujo de representante).
7. **Formulario paso a paso**: una pregunta o grupo corto por pantalla, barra de progreso, guardar y continuar después, ayuda contextual en cada campo.
8. **Inicio de sesión / Identidad Digital**: explica qué es y por qué se pide, con camino para quien no la tiene.
9. **Resumen y confirmación**: revisar y editar antes de enviar.
10. **Pago con tarjeta**: monto desglosado, métodos, mensajes de error claros, sin pedir datos de tarjeta fuera de la pasarela de pago.
11. **Agendar cita**: elegir institución o sede, fecha y hora, qué llevar, recordatorio.
12. **Confirmación y comprobante**: número de trámite, descarga, qué sigue.
13. **Seguimiento del trámite**: línea de tiempo con estados (recibido, en revisión, listo, entregado).
14. **Preferencias de avisos**: activar o desactivar WhatsApp y correo, baja en un clic.
15. **Errores y casos especiales**: el asistente no entiende, trámite no disponible, sesión vencida, pago rechazado, sin conexión.

## TRÁMITES PARA LA PRIMERA VERSIÓN

Usa estos 8 como contenido de ejemplo en las pantallas. Son los de uso más común para el público general:

1. Constancia de antecedentes penales
2. Constancia de antecedentes policiales
3. Certificación de partidas (nacimiento, matrimonio, etc.)
4. Constancia de no restricción migratoria
5. Solvencia de cuenta de agua (ANDA)
6. Cambio de titular de cuenta de agua (ANDA)
7. Certificación de registro de título de educación media
8. Certificación de notas de educación básica y media

**Importante:** los requisitos, costos y tiempos de cada trámite son **contenido de ejemplo, no oficial**. El único dato verificado es el costo del cambio de titular de ANDA ($2.26, según una nota de prensa; confirmar con la institución). Todo lo demás debe verse como texto de relleno marcado como ejemplo. Define la ficha de cada trámite como un componente con campos: nombre simple, nombre oficial, institución, requisitos, datos que se piden, costo, tiempo, modalidad, dónde se entrega. [Reemplazar con los datos reales cuando termine el levantamiento de procesos.]

## COMPORTAMIENTO DEL ASISTENTE

- Responde desde un **catálogo verificado** de trámites; no inventa requisitos, costos ni plazos.
- Guía con **botones de respuesta rápida** además del texto libre.
- Cuando identifica el trámite, lo **redirige** a su ficha con un botón; no hace el trámite dentro del chat.
- **No pide datos personales dentro del chat** (ni DUI completo, ni tarjeta). Los datos se piden en el formulario seguro.
- Nunca da asesoría legal; orienta e informa.
- Si no entiende dos veces seguidas, ofrece hablar con una persona.
- Tono cercano y respetuoso, español salvadoreño neutro, frases cortas.

## MENSAJERÍA POR WHATSAPP Y CORREO

Solo con consentimiento previo, **opcional**, desmarcado por defecto y revocable en cualquier momento. Sirve para avisos de avance, nunca para entregar documentos ni datos personales. Hay tres niveles de detalle según el trámite:

- **Verde**: el aviso puede nombrar el trámite, su estado y la fecha de cita.
- **Amarillo**: solo estado general y enlace al portal.
- **Rojo** (salud, antecedentes, pensiones, familia, menores, armas): aviso genérico sin nombrar el trámite, por ejemplo "tienes una actualización en simple.sv".

Diseña la pantalla de consentimiento y los ejemplos de mensaje con esta lógica. Toda resolución oficial se consulta dentro del portal. Para trámites de menores, el consentimiento lo da el adulto responsable.

## DIRECCIÓN VISUAL

- Transmite **confianza institucional y calidez**: moderno, limpio, humano. Nada de aspecto burocrático.
- Usa identidad visual propia de Simple. **No copies logos, escudos ni marcas de otras instituciones**; deja espacios para logos como marcadores. [Indicar colores y tipografía de marca, si existen.]
- Colores y tipografías como **variables parametrizadas** para poder cambiarlos sin rediseñar.
- Ilustraciones o fotografías de personas salvadoreñas en situaciones cotidianas (familia, trabajo, estudio); deben cargar rápido.
- Botones grandes y un solo botón principal por pantalla.
- El carrusel debe verse bien sin autoplay obligatorio, con controles claros y accesibles.

## ACCESIBILIDAD Y LENGUAJE

- Contraste mínimo WCAG AA, texto base de 16 px o más y objetivos táctiles de 44 px o más.
- Lenguaje claro: evita "certificación", "apostillado" o "solvencia" sin explicarlos con una frase corta.
- Cada término técnico puede abrir una explicación breve.
- Navegable con teclado y lector de pantalla; no depender solo del color para dar información.
- Opcional a futuro: lectura en voz alta de la ficha del trámite.

## QUÉ NO HACER

- No mostrar la lista completa de trámites como primera pantalla.
- No pedir inicio de sesión antes de que la persona entienda el trámite.
- No usar un chat de texto libre sin respuestas rápidas.
- No diseñar una interfaz "infantil" para menores: los menores no hacen trámites solos; lo hace un adulto responsable.
- No cargar la landing con animaciones pesadas.
- No mostrar datos personales en notificaciones ni en las URL.

## ENTREGABLES

1. Las 15 pantallas en móvil y escritorio.
2. Un flujo completo conectado: landing → asistente → ficha → formulario → pago o cita → comprobante.
3. Un sistema de diseño breve: colores, tipografía, botones, tarjetas, campos de formulario, burbujas de chat, línea de tiempo, alertas.
4. El flujo alternativo del trámite para un menor.
5. Notas para el desarrollo: qué datos pide cada pantalla y qué estados tiene.

## SKILLS Y RECURSOS DE LA CARPETA DE DESCARGAS

[Pega aquí los nombres y las instrucciones clave de las skills que quieras aplicar al diseño. Aún no he revisado esos archivos.]

## REFERENCIAS

- Estructura que funciona en dui.sv: selector por tipo de trámite, requisitos y costo por caso, sedes, horarios y asistente virtual. Mejorar: más visual y con el asistente al inicio, no al final.
- Ideas de otros países: Tina (Argentina) y Boti (Buenos Aires) como asistentes por WhatsApp con respaldo humano; LifeSG (Singapur) para agrupar por momentos de vida; Bürokratt (Estonia) para avisos proactivos.
