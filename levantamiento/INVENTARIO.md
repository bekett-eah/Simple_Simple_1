# Inventario del administrador de SimpleSV · Fases A y B (primer y segundo nivel)

**Entorno:** `https://simple-dev.egob.sv/backend` · **Fecha:** 6 de noviembre de 2026 · **Perfil:** usuario de pruebas con acceso de administrador
**Método:** capturas de solo lectura con [inspect-admin.mjs](inspect-admin.mjs) (GET, sin clics ni envíos). El detalle de cada pantalla está en `salida/`, fuera de git.

Se capturaron 28 pantallas: el inicio, los 8 módulos del menú y 19 pantallas de segundo nivel. En las de detalle se usó como muestra el primer proceso o registro de cada lista. Todas respondieron con la sesión activa, y la salida no contiene DUI, correos, tokens, parámetros de consulta ni valores de campos.

Leyenda: ✔ capturada · ○ pendiente · ⚠ posible escritura (se abre solo con aprobación) · ✖ nunca se abre

## 1. Mapa de navegación

```
/backend ······································ Inicio: tablero de widgets                          ✔
├── procesos ·································· Modelador de Procesos                               ✔
│   ├── procesos/{id}/historial ··············· Historial de un proceso                             ✔
│   ├── agente/proceso/{id} ··················· Editor de un proceso                                ⚠
│   └── procesos/{id}/export ·················· Exportar (descarga)                                 ⚠
├── seguimiento ······························· Seguimiento de procesos                             ✔
│   └── seguimiento/index_proceso/{id} ········ Trámites de un proceso                              ✔
│       ├── seguimiento/ver/{id} ·············· Seguimiento de un trámite (datos de ciudadanos)     ○
│       └── seguimiento/reset_proc_cont/{id} ·· Reiniciar contador del proceso                      ⚠ GET que escribe
├── v2/reportes ······························· Gestión: reportes por proceso                       ✔
│   └── v2/reportes/listar/{id} ··············· Reportes de un proceso                              ✔
│       └── v2/reportes/create/{id} ··········· Nuevo reporte (formulario)                          ⚠
├── auditoria ································· Auditoría                                           ✔
│   └── auditoria/ver_detalles/{id} ··········· Detalle de un registro                              ✔
├── api ······································· Documentación de la API                             ✔
│   ├── api/token ····························· Código de acceso                                    ⚠
│   ├── api/tramites_obtener · _estado · _listar · _listarporproceso                                ✔
│   ├── api/procesos_obtener · _listar · _disponibles                                               ✔
│   └── api/tramites_recurso · api/procesos_recurso ·· Descripción de los recursos                  ○
├── notificaciones ···························· Notificaciones a usuarios backend                   ✔
├── configuracion ····························· Información del sitio                               ✔
│   ├── configuracion/modelador ··············· Conector del modelador                              ✔
│   │   └── configuracion/modelador/{id} ······ "Seleccionar" conector                              ⚠ GET que escribe
│   ├── configuracion/categorias ·············· Categorías                                          ✔  (crear: categorias/editar ⚠)
│   ├── configuracion/estilo ·················· Estilos del portal                                  ✔
│   ├── configuracion/dias_festivos ··········· Días festivos                                       ✔  (crear: dias_festivos/form ⚠)
│   ├── configuracion/usuarios ················ Usuarios (funcionarios)                             ✔  (crear o editar: usuario_editar ⚠)
│   ├── configuracion/grupos_usuarios ········· Grupos de usuarios                                  ✔  (grupo_usuarios_editar ⚠)
│   ├── configuracion/backend_usuarios ········ Usuarios del backend                                ✔  (backend_usuario_editar ⚠)
│   ├── configuracion/openids ················· Proveedor OIDC                                      ✔  (openids/edit ⚠)
│   └── configuracion/signature/edit ·········· Firma electrónica certificada                       ⚠
├── cuentas ··································· Mi cuenta: cambiar contraseña                       ✔
└── salir ····································· Cerrar sesión                                       ✖
Ayuda: /ayuda/simple/backend/widgets.html · /ayuda/simple/backend/seguimiento-de-procesos.html
```

## 2. Fichas por pantalla

### Inicio · `/backend`
- Es un tablero de widgets de gestión. Cada widget tiene un formulario de configuración: `nombre` y `config[proceso_id]` (lista de 29 procesos).
- "Nuevo widget" ofrece 4 tipos: Trámite por etapas, Trámites realizados, Carga de usuarios por etapa y Carga de grupos de usuarios por etapa.
- Crear (`GET gestion/widget_create/{tipo}`) y eliminar (`GET gestion/widget_remove/{id}`) se hacen con enlaces GET.

### Modelador de Procesos · `/backend/procesos`
- Listado con vista de lista o de tarjetas, 20 por página y búsqueda GET por `process_search` y `categoria_id`.
- Acciones por proceso:
  - Editar (`agente/proceso/{id}`)
  - Historial
  - Exportar
  - Menú "Más acciones"
- Selección múltiple y "Desactivar (n)": `POST procesos/desactivar_masivo`, con `descripcion` obligatoria.
- Importar: `POST procesos/import` (archivo).
- Nuevo proceso: `POST procesos` con:
  - Nombre del proceso (obligatorio)
  - Categoría
  - Código del proceso
  - Descripción del servicio
  - Ícono
- Tabla de procesos desactivados, con "Activar" en cada fila.
- **Historial** (`procesos/{id}/historial`): el título es el nombre del proceso. Tabla con Usuario, Fecha (ordenable) y Descripción.

### Seguimiento · `/backend/seguimiento`
- Tabla de procesos (29) con "Ver seguimiento" y el menú "Operaciones".
- **Trámites de un proceso** (`seguimiento/index_proceso/{id}`):
  - **Filtros (GET):**
    - Buscar sin filtro, por ID (`query_tramite_id`), por referencia (`query_ref`) o por nombre (`query_name`).
    - Estado: Cualquiera, En curso o Completado.
    - Fecha de creación y de último cambio, cada una con rango desde/hasta.
  - **Tabla:** ID, Asignado a, Ref., Nombre, Estado, Etapa actual, Fecha de creación y Fecha de último cambio.
  - **Acciones por fila:** Seguimiento (`seguimiento/ver/{id}`), Borrar y Documento fallido.
  - El menú "Operaciones" incluye "Reiniciar contador de proceso", que es un `GET seguimiento/reset_proc_cont/{id}` que escribe.

### Gestión · `/backend/v2/reportes`
- Tabla de procesos (29) con "Ver reportes".
- **Reportes de un proceso** (`v2/reportes/listar/{id}`): "Reportes definidos para «proceso»", con tabla Reporte y "Nuevo reporte" (`v2/reportes/create/{id}`).

### Auditoría · `/backend/auditoria`
- Tabla con Fecha, Proceso, Operación, Usuario y Motivo (25 por página) y "Ver detalles".
- **Detalle** (`auditoria/ver_detalles/{id}`): el título es "Auditoría de «operación» en fecha «fecha»" y hay una sección "Proceso". El contenido no es una tabla y no se capturó.

### API · `/backend/api`
- **Portada:** Autorización, Llamadas a la API, Parámetros comunes (3 parámetros) y Formatos de los datos.
- **Cada endpoint** tiene las secciones Request HTTP, Parámetros y Response HTTP, y tablas con Nombre del parámetro, Valor y Descripción.

  | Endpoint | Parámetros |
  |---|---|
  | `tramites_obtener` | 2 |
  | `tramites_estado` | 2 |
  | `tramites_listar` | 4 y 5 |
  | `tramites_listarporproceso` | 5 y 5 |
  | `procesos_obtener` | 2 |
  | `procesos_listar` | 4 |
- **`procesos_disponibles`:** "Trámites disponibles como servicios", con Nombre del proceso, Tarea, Descripción y Url.
- **Detalle de copia:** la página de `tramites_estado` se titula "Tramites: obtener".

### Notificaciones · `/backend/notificaciones`
- Tabla con Historial, Fecha de creación y Mensajes. Está vacía.

### Configuración · `/backend/configuracion`
- **Información del sitio:** `POST configuracion` con:
  - Nombre, Siglas y Nombre largo
  - Mensaje de bienvenida (HTML)
  - Contacto (correo y enlace)
  - Favicon y logos
  - Descarga masiva
  - Token de prueba y Token de producción

  Ningún campo está marcado como obligatorio en el HTML.
- **Modelador:** tabla de conectores con Conector, Vista previa, Actual en uso y Acciones (5). "Seleccionar" cambia el conector en uso con un `GET configuracion/modelador/{id}`.
- **Categorías:** tabla con Nombre y Descripción (vacía) y "Crear categoría".
- **Estilos:** `POST configuracion/estilo` con campos de color para:
  - el botón de iniciar sesión y su texto (normal y al pasar el mouse);
  - el encabezado y el pie de las tarjetas;
  - los botones de trámite.

  Tiene una vista previa en tres tablas (Iniciar sesión, Tarjeta trámites, Sección trámites), un botón "Confirmar" y el aviso "Favor seleccionar todos los campos".
- **Días festivos:** búsqueda (`search`) y "Crear día festivo".
- **Usuarios** (por sus columnas, parecen los funcionarios que atienden trámites):
  - Tabla con Usuario, Email, Nombres, Apellidos, Pertenece a, ¿Fuera de oficina? y Acciones.
  - Búsqueda por correo.
  - Nuevo, Editar y Eliminar. Eliminar es `POST usuario_editar/{id}` con `_method`.
- **Grupos de usuarios:** tabla con ID, Nombre, Usuarios y Acciones. Nuevo, Editar y Eliminar.
- **Usuarios backend:**
  - Tabla con E-mail, Usuario, Nombre, Apellidos, **Rol** y Acciones.
  - Búsqueda por correo.
  - Eliminar aparece en todas las filas menos una.
- **Proveedor OIDC:** tabla con Nombre y Acciones (1). Nuevo y Editar (`openids/edit/{id}`); Eliminar es `POST openids/eliminar/{id}`.

### Mi cuenta · `/backend/cuentas`
- "Cambiar contraseña": `POST cuentas` con Contraseña y Confirmar contraseña.

## 3. Acciones de escritura observadas

| Acción | Método y ruta | Nota |
|---|---|---|
| Crear widget | `GET gestion/widget_create/{tipo}` | **Escribe con GET** |
| Eliminar widget | `GET gestion/widget_remove/{id}` | **Borra con GET** |
| Reiniciar contador de un proceso | `GET seguimiento/reset_proc_cont/{id}` | **Escribe con GET** |
| Elegir el conector del modelador | `GET configuracion/modelador/{id}` | **Escribe con GET** |
| Cerrar sesión | `GET salir` | |
| Configurar widget | `POST gestion/widget_config_form/{id}` | |
| Crear, importar y desactivar procesos | `POST procesos` · `procesos/import` · `procesos/desactivar_masivo` | |
| Guardar sitio, estilos y contraseña | `POST configuracion` · `configuracion/estilo` · `cuentas` | |
| Eliminar usuario, grupo o usuario backend | `POST …_editar/{id}` con `_method` | probablemente DELETE simulado |
| Eliminar proveedor OIDC | `POST configuracion/openids/eliminar/{id}` | |
| Código de acceso de la API | `api/token` | no se abrió |
| Exportar proceso | `GET procesos/{id}/export` | descarga |

Para la reconstrucción: lo que hoy escribe con GET debe pasar a POST, PUT o DELETE con token CSRF y confirmación.

## 4. Modelo que se deja ver

- **Proceso:** es el centro del sistema (29 en el entorno). Tiene categoría, código, ícono, historial de cambios, estado activo o desactivado (la desactivación exige motivo), importación y exportación.
- **Trámite:** es una instancia de un proceso. Tiene ID, referencia, nombre, estado (en curso o completado), etapa actual, persona asignada y fechas.
- **Usuarios en tres niveles:**
  - **Funcionarios** (`usuarios`): pertenecen a grupos y tienen la marca "fuera de oficina".
  - **Grupos de usuarios.**
  - **Usuarios del backend:** tienen **rol**. Los valores no se leyeron.
- **Gestión:** reportes por proceso (módulo v2) y widgets del tablero.
- **Auditoría:** cada operación sobre los procesos queda registrada con usuario y motivo.
- **Integración:** una API por código de acceso, con trámites y procesos de solo consulta y "trámites disponibles como servicios". Hay tokens de prueba y de producción en Configuración y un proveedor OIDC.

## 5. Tecnología

**Confirmada en el frontend:**
- jQuery 3.6.0 (desde code.jquery.com)
- jQuery UI 1.12.1
- Bootstrap 4.6.0
- DataTables 1.10.18
- Moment.js 2.29.1
- Lodash 4.17.21
- Select2, Axios y Material Icons

**Arquitectura observada:**
- Páginas generadas en el servidor: un solo documento por pantalla, sin llamadas XHR ni fetch al cargar.
- Un paquete común `/js/backend.js` y 4 hojas de estilo propias.
- reCAPTCHA y Google Maps se cargan en todas las pantallas.
- Cloudflare delante del sitio (`/cdn-cgi/`).

**Indicios:**
- **Laravel** (fuerte): `csrf-token`, `_token`, 21 formularios con `_method` para simular PUT o DELETE, y lodash, axios y jQuery globales como en el `bootstrap.js` por defecto.
- **Derivado de SIMPLE (Chile):** la ayuda está en `/ayuda/simple/backend/…`, el login es `login/claveunica` y los nombres de rutas siguen ese patrón (`seguimiento/index_proceso`, `api/tramites_obtener`).

**Desconocido:** la versión del framework, la base de datos, las APIs internas y el detalle de roles y permisos.

## 6. Preguntas para el equipo técnico

1. ¿SimpleSV es un fork de SIMPLE (Chile)? ¿De qué versión? Su documentación pública aceleraría la especificación.
2. ¿Los usuarios del backend entran solo por Clave Única u OIDC, o también con contraseña local? "Mi cuenta" permite cambiarla.
3. ¿Qué roles existen para los usuarios del backend y qué permite cada uno?
4. ¿Cómo funciona el código de acceso de la API (formato, vigencia, rotación)? ¿Para qué son los tokens de prueba y de producción de Configuración?
5. ¿Qué es `agente/proceso/{id}`, el editor de procesos?
6. ¿Qué hacen "Borrar" y "Documento fallido" en el seguimiento de un trámite?

## 7. Siguiente paso propuesto

Estas capturas necesitan aprobación:

1. **Formularios de creación, por GET y sin guardar:**
   - `usuario_editar`, `backend_usuario_editar` y `grupo_usuarios_editar`
   - `categorias/editar`, `dias_festivos/form` y `openids/edit`
   - `v2/reportes/create/{id}`

   Con ellos se documentan campos, tipos y obligatoriedad.
2. **Recursos de la API:** `api/tramites_recurso` y `api/procesos_recurso`.
3. **Contenido de la documentación de la API** (tablas de parámetros y ejemplos de request y response) para los contratos de la Fase D. Antes hay que ampliar el script con un filtro de secretos.

Quedan fuera por ahora:
- `seguimiento/ver/{id}`, porque muestra datos de ciudadanos.
- El editor de procesos y la firma electrónica.
