# Landing page: Simple.sv (index 2)

Estado: borrador de planificación. Pendiente de confirmar las decisiones abiertas al final.

## Objetivo

Que un ciudadano sin experiencia digital encuentre su trámite, entienda cuánto cuesta y cuánto tarda, y sepa qué hacer en el siguiente paso sin ayuda externa.

## Estructura de la página

1. **Encabezado**: logo, enlaces de navegación, botón "Iniciar sesión" y botón "Buscar trámite".
2. **Hero**: titular "Tus trámites de gobierno, fáciles, rápidos y sin filas", texto corto y buscador.
3. **Carrusel de situaciones de vida**: imágenes de la carpeta `imagenes landing` rotando de forma automática. Cada slide muestra una imagen y, debajo, la situación ("¿Vas a entrar a un nuevo trabajo?") con un botón que lleva al catálogo filtrado.
4. **Catálogo de trámites**: tarjetas con las pestañas de categoría que ya existen.
5. **Cómo funciona**: tres pasos (Dinos qué necesitas, Revisa los requisitos, Recibe tu documento).
6. **Chatbot lateral** y **login**, descritos abajo.

## Carrusel

- Se mantienen las flechas, el contador "1 / 5" y los puntos de navegación.
- Cada imagen debe tener texto alternativo que describa la situación.
- Pausa al pasar el cursor o al tocar la pantalla, para que el ciudadano pueda leer con calma.

## Tarjetas de trámites

Fusión de los datos de la versión actual y de la tarjeta de referencia:

- Icono y, en lo posible, una imagen relacionada con el trámite.
- Badge de costo (verde si es gratuito).
- Nombre del trámite y, en texto pequeño, la institución.
- Descripción de una línea.
- Tiempo de entrega con icono de reloj.
- Botón "Ver requisitos" que abre la lista de requisitos del trámite, no un `alert()`.

Los datos de cada trámite deben salir del catálogo de 118 trámites, no escribirse a mano. Pendiente: verificar costos. Hay una diferencia entre el carrusel y la tarjeta de cambio de titular de ANDA ($2.26), y el permiso de salida ($10.00) no tiene fuente confirmada.

## Buscador

- Se mantiene en el hero, con el mismo texto de ayuda.
- Debe entender frases simples, por ejemplo "quiero trabajar" o "necesito partida de nacimiento", y no solo palabras exactas.
- Si no hay coincidencias, muestra las categorías en lugar de una pantalla vacía.

## Paleta de colores

Se mantiene la paleta blanca actual del `index.html`: fondo blanco, azul primario para acciones y textos oscuros para leer. Se toma de Diseño_2.md la estructura de tarjetas (radio de 24 px, sin sombras pesadas), no el fondo negro. Motivo: el contraste del tema oscuro dificulta la lectura para público general.

## Chatbot lateral

- Un botón flotante abre un panel lateral (no un modal centrado).
- Al abrirse, se presenta como asistente de Simple.sv y da una bienvenida corta: quién es, qué puede hacer y que no reemplaza a la institución.
- Después de la bienvenida ofrece cuatro opciones rápidas (trabajo, partidas o DUI, agua, título de bachiller) y un campo de texto libre.
- Pendiente de configurar: respuestas guiadas paso a paso y redirección al trámite elegido.

## Login

- Botón "Iniciar sesión" en el encabezado.
- Pendiente de definir: ¿identidad digital del gobierno o cuenta propia de Simple? Esto cambia el formulario y el flujo de recuperación de contraseña.

## Decisiones abiertas

1. ¿Index 2 con la paleta oscura de Diseño_2 o la blanca actual? Recomendado: blanca.
2. ¿Los requisitos se muestran dentro de la landing o en una pantalla propia?
3. ¿El login es identidad digital del gobierno o una cuenta de Simple?

## Pendientes de insumos

- Carpeta `catalogo_118_tramites_simple_sv`.
- Imágenes de la carpeta `imagenes landing` (cinco slides).
- Archivo `src/styles/simple-light-vibrant.css`.
