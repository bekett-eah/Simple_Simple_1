# Plan de levantamiento técnico y reconstrucción funcional – SimpleSV

**Entorno:** `https://simple-dev.egob.sv/backend`  
**Alcance declarado:** administrador completo, mediante usuario de pruebas.  
**Modalidad inicial:** inspección autenticada de solo lectura.  
**Estado:** acceso público verificado; las pantallas administrativas requieren iniciar sesión.

## 1. Objetivo

Documentar el comportamiento observable del administrador de SimpleSV y construir, a partir de esa evidencia, una implementación independiente. La reconstrucción no copiará código fuente privado ni intentará eludir controles de acceso. Reproducirá los flujos que estén dentro del alcance autorizado, utilizando una arquitectura propia y conectándose únicamente a servicios cuyo uso haya sido autorizado.

## 2. Hallazgo inicial

La dirección `/backend` redirige a `/backend/login`. La página presenta el título “Ventanilla Ciudadana SV – Autenticación” y el mensaje “Bienvenido al Portal de Configuración de GOBSV”. Por tanto, la navegación interna y el reconocimiento de módulos deben ejecutarse después del inicio de sesión manual con el usuario de pruebas.

Este hallazgo no permite determinar todavía el framework, el backend, la base de datos ni el catálogo de APIs.

## 3. Fases de trabajo

### Fase A – Descubrimiento de la interfaz

1. Iniciar sesión manualmente en el navegador de prueba.
2. Registrar la pantalla inicial: URL, título, encabezados, navegación, enlaces y acciones visibles.
3. Identificar módulos y submódulos por perfil.
4. Crear un mapa de rutas y asociar cada ruta con un módulo.
5. Tomar capturas solo cuando la pantalla contenga datos ficticios o esté debidamente anonimizada.

**Entregable:** inventario de pantallas y mapa de navegación.

### Fase B – Inspección funcional por módulo

Para cada módulo se documentará:

- Propósito y perfiles que pueden acceder.
- Lista, detalle y estados de los registros.
- Columnas, filtros, búsqueda, ordenamiento y paginación.
- Formularios, campos, tipos, obligatoriedad y validaciones visibles.
- Acciones, confirmaciones, mensajes de éxito y error.
- Dependencias entre módulos y reglas observables.

La primera pasada será de lectura. Las operaciones que cambien información se probarán más adelante, únicamente con datos ficticios y dentro de la autorización específica para esas pruebas.

**Entregable:** ficha funcional por módulo y casos de prueba.

### Fase C – Identificación técnica

Se recopilarán indicios del DOM, atributos, nombres de scripts y hojas de estilo, rutas estáticas y solicitudes de red. Se documentarán las solicitudes observadas mediante método, ruta, tipo de recurso y estado HTTP, sin almacenar cookies, tokens, cabeceras de autorización ni cuerpos de solicitudes/respuestas.

La tecnología detectada se clasificará como:

- Confirmada: respaldada por evidencia técnica directa y verificable.
- Indicio: nombre de recurso, marcador DOM o patrón compatible.
- Desconocida: no hay evidencia suficiente.

**Entregable:** informe de frontend, mapa de comunicaciones observadas y preguntas pendientes sobre backend.

### Fase D – Especificación de la reconstrucción

Antes de programar se prepararán:

- Catálogo de módulos y rutas.
- Modelo de roles y permisos observados.
- Especificación de pantallas y componentes.
- Flujos de usuario y estados.
- Contratos de API autorizados o contratos propuestos para un backend propio.
- Matriz de pruebas de equivalencia funcional.

**Entregable:** especificación funcional y arquitectura objetivo.

### Fase E – Implementación independiente

Construir el administrador por módulos, separando interfaz, lógica de negocio y servicios. El código será propio. La integración con el backend existente solo se realizará cuando exista autorización y documentación suficiente; de lo contrario, se utilizará un backend propio o un entorno simulado.

### Fase F – Integración y validación

Integrar el administrador con el frontend ciudadano existente a través de APIs documentadas y autorizadas. Comparar flujos con el sistema de referencia y ejecutar pruebas de regresión con datos ficticios.

## 4. Primera extracción: alcance exacto

El archivo `inspect-admin.mjs` realiza una primera captura de la pantalla administrativa que quede abierta después del inicio de sesión manual.

Recopila:

- Título, URL e idioma.
- Encabezados visibles.
- Enlaces internos del mismo origen.
- Etiquetas y estado deshabilitado de botones.
- Estructura de formularios y metadatos de campos, sin leer valores.
- Rutas de scripts y hojas de estilo.
- Indicios de tecnologías a partir de marcadores DOM y recursos.
- Solicitudes del mismo origen observadas al recargar la pantalla: método, ruta, tipo y estado HTTP.

No hace crawling recursivo ni pulsa botones. No envía formularios, no ejecuta operaciones CRUD y no intenta descubrir rutas restringidas. Las rutas que salgan del inventario se revisarán y aprobarán antes de inspeccionarlas individualmente.

## 5. Criterios de seguridad y privacidad

1. Utilizar únicamente el entorno `simple-dev` y el usuario de pruebas autorizado.
2. Introducir las credenciales manualmente; nunca guardarlas en el repositorio ni en los reportes.
3. No exportar cookies, tokens, almacenamiento local, contraseñas, cuerpos HTTP ni parámetros de consulta.
4. No capturar ni compartir información personal o institucional real.
5. No realizar pagos, publicaciones, notificaciones ni cambios de estado durante el reconocimiento.
6. No automatizar acciones de escritura hasta que se acuerden casos de prueba con datos ficticios.
7. No conectar la versión reconstruida a producción sin autorización técnica y aprobación de seguridad.

## 6. Criterios para dar por terminado el levantamiento

- Cada módulo visible tiene una ficha e identificación de sus rutas.
- Las pantallas principales tienen inventario estructural.
- Los formularios tienen campos y validaciones documentados.
- Las acciones se clasifican como lectura o escritura.
- Las comunicaciones observadas están documentadas sin secretos.
- Se separan claramente los hechos confirmados de las hipótesis.
- Las dudas de backend, autenticación, permisos y datos quedan registradas para validación técnica.

## 7. Siguiente acción

Ejecutar el script de primera extracción desde una computadora con Node.js, iniciar sesión manualmente y compartir `levantamiento-inicial.json` y `levantamiento-inicial.md`, previa revisión para retirar datos sensibles. Con esos resultados se construirá el mapa de módulos y se elegirá la primera ruta administrativa para inspección detallada.
