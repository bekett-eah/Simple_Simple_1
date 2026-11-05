-- Esquema para guardar el paso a paso de cada trámite de Simple.sv (PostgreSQL 14+).
-- El chatbot (web y WhatsApp) y la página de formulario consultan estas tablas en lugar de tener los pasos en el código.
-- Se carga desde: catálogo de 118 trámites, primer paso copiado del portal y, cuando esté disponible,
-- la exportación de cada proceso de SIMPLE (backend/procesos/{id}/export) o su API REST.

BEGIN;

CREATE TYPE nivel_whatsapp AS ENUM ('verde', 'amarillo', 'rojo');

CREATE TABLE institucion (
  id               serial PRIMARY KEY,
  nombre           text NOT NULL UNIQUE,
  siglas           text,
  sitio_ventanilla text                       -- p. ej. rnpn.ventanilla.simple.sv
);

CREATE TABLE categoria (
  id     text PRIMARY KEY,                    -- empleo | documentos | vivienda | estudio | otros
  nombre text NOT NULL
);

CREATE TABLE tramite (
  numero            int PRIMARY KEY,          -- número del catálogo (1 a 118)
  nombre            text NOT NULL,
  descripcion       text,
  institucion_id    int NOT NULL REFERENCES institucion(id),
  dependencia       text,
  categoria_id      text REFERENCES categoria(id),
  costo             text,
  tiempo            text,
  modalidad         text,
  publico           text,
  enlace_simple     text,
  enlace_tramite    text,
  imagen            text,
  simple_proceso_id int,                      -- id del proceso en SIMPLE (backend/procesos/{id})
  activo            boolean NOT NULL DEFAULT true,
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

-- Qué se puede hacer por WhatsApp en cada trámite
CREATE TABLE tramite_canal (
  tramite_numero           int PRIMARY KEY REFERENCES tramite(numero) ON DELETE CASCADE,
  nivel_whatsapp           nivel_whatsapp NOT NULL DEFAULT 'amarillo',
  es_judicial              boolean NOT NULL DEFAULT false,   -- solo avisos de estado; nunca documentos
  permite_tramite_completo boolean GENERATED ALWAYS AS (nivel_whatsapp = 'verde' AND NOT es_judicial) STORED,
  nota                     text
);

-- Flujo del proceso: tareas (etapas) y conexiones
CREATE TABLE tarea (
  id              serial PRIMARY KEY,
  tramite_numero  int NOT NULL REFERENCES tramite(numero) ON DELETE CASCADE,
  identificador   text NOT NULL,              -- p. ej. ingreso_solicitud
  nombre          text NOT NULL,
  orden           int NOT NULL,
  es_inicial      boolean NOT NULL DEFAULT false,
  es_final        boolean NOT NULL DEFAULT false,
  responsable     text NOT NULL DEFAULT 'ciudadano' CHECK (responsable IN ('ciudadano', 'funcionario', 'sistema')),
  simple_tarea_id int,
  UNIQUE (tramite_numero, identificador)
);

CREATE TABLE conexion (
  id               serial PRIMARY KEY,
  tarea_origen_id  int NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
  tarea_destino_id int REFERENCES tarea(id) ON DELETE CASCADE,   -- NULL = fin del flujo
  tipo             text NOT NULL CHECK (tipo IN ('secuencial', 'evaluacion', 'paralelo', 'union')),
  condicion        text                                           -- p. ej. @@decision_revision == 'Aprobar'
);

-- Pantallas de cada tarea y sus campos
CREATE TABLE paso (
  id             serial PRIMARY KEY,
  tarea_id       int NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
  orden          int NOT NULL,
  numero_visible text,                        -- p. ej. 1.1
  titulo         text NOT NULL,
  subtitulo      text,
  modo           text NOT NULL DEFAULT 'edicion' CHECK (modo IN ('edicion', 'visualizacion')),
  UNIQUE (tarea_id, orden)
);

CREATE TABLE campo (
  id            serial PRIMARY KEY,
  paso_id       int NOT NULL REFERENCES paso(id) ON DELETE CASCADE,
  orden         int NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('nota', 'seccion', 'opciones', 'lista', 'texto', 'archivo', 'documento', 'oculto')),
  nombre        text,                         -- variable en SIMPLE (sin @@)
  etiqueta      text,
  ayuda         text,
  placeholder   text,
  valor_inicial text,                         -- opción ya marcada (p. ej. ANDA: cambio_nombre)
  obligatorio   boolean NOT NULL DEFAULT true,
  multiple      boolean NOT NULL DEFAULT false,
  solo_lectura  boolean NOT NULL DEFAULT false,
  modo_teclado  text CHECK (modo_teclado IN ('numeric', 'email')),
  estilo_nota   text CHECK (estilo_nota IN ('info', 'aviso', 'requisitos')),
  contenido     jsonb,                        -- líneas de una nota, sugerencias de autocompletado
  dato_sensible boolean NOT NULL DEFAULT false, -- nunca pedirlo por WhatsApp (documentos de identidad, archivos)
  UNIQUE (paso_id, orden)
);

CREATE TABLE campo_opcion (
  id       serial PRIMARY KEY,
  campo_id int NOT NULL REFERENCES campo(id) ON DELETE CASCADE,
  orden    int NOT NULL,
  valor    text NOT NULL,
  texto    text NOT NULL,
  detalle  text,
  icono    text,
  UNIQUE (campo_id, orden)
);

-- Cuándo se muestra un campo: si el campo controlador tiene (o no tiene) cierto valor
CREATE TABLE regla_visibilidad (
  campo_id          int PRIMARY KEY REFERENCES campo(id) ON DELETE CASCADE,
  campo_controlador text NOT NULL,
  operador          text NOT NULL CHECK (operador IN ('=', '!=')),
  valor             text NOT NULL
);

CREATE TABLE regla_validacion (
  id       serial PRIMARY KEY,
  campo_id int NOT NULL REFERENCES campo(id) ON DELETE CASCADE,
  tipo     text NOT NULL CHECK (tipo IN ('patron', 'longitud_maxima', 'correo', 'igual_a', 'formato_archivo')),
  valor    text NOT NULL,
  mensaje  text
);

CREATE TABLE documento_requerido (
  id                           serial PRIMARY KEY,
  tramite_numero               int NOT NULL REFERENCES tramite(numero) ON DELETE CASCADE,
  nombre                       text NOT NULL,
  descripcion                  text,
  formatos                     text,
  obligatorio                  boolean NOT NULL DEFAULT true,
  se_puede_enviar_por_whatsapp boolean NOT NULL DEFAULT false
);

-- Acciones de SIMPLE: integraciones REST, pagos, correos, generación de documentos, redirecciones
CREATE TABLE accion (
  id                    serial PRIMARY KEY,
  tramite_numero        int NOT NULL REFERENCES tramite(numero) ON DELETE CASCADE,
  tarea_id              int REFERENCES tarea(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  tipo                  text NOT NULL CHECK (tipo IN ('rest', 'variable', 'enviar_correo', 'generar_documento', 'pago', 'redirect', 'soap', 'otro')),
  momento               text CHECK (momento IN ('antes', 'despues')),
  automatizable_por_bot boolean NOT NULL DEFAULT false
);

-- Estados de un trámite para avisar avances (web y WhatsApp)
CREATE TABLE estado_tramite (
  codigo             text PRIMARY KEY,
  nombre             text NOT NULL,
  mensaje_ciudadano  text NOT NULL,
  plantilla_whatsapp text                     -- nombre de la plantilla aprobada por Meta
);

-- Consentimiento para avisos por WhatsApp
CREATE TABLE suscripcion_whatsapp (
  id                 serial PRIMARY KEY,
  usuario_id_digital text NOT NULL,           -- identificador del usuario en Identidad Digital (no el DUI)
  telefono           text NOT NULL CHECK (telefono ~ '^\+503[67][0-9]{7}$'),
  tramite_numero     int NOT NULL REFERENCES tramite(numero),
  simple_tramite_id  int,                     -- trámite iniciado en SIMPLE
  consentimiento     text NOT NULL,           -- texto exacto que aceptó
  aceptado_en        timestamptz NOT NULL DEFAULT now(),
  baja_en            timestamptz
);

-- Registro de cada carga o actualización
CREATE TABLE sincronizacion (
  id             serial PRIMARY KEY,
  tramite_numero int REFERENCES tramite(numero),
  origen         text NOT NULL CHECK (origen IN ('catalogo', 'portal', 'api', 'exportacion', 'manual')),
  version_simple text,
  hash_contenido text,
  ejecutada_en   timestamptz NOT NULL DEFAULT now(),
  resultado      text NOT NULL CHECK (resultado IN ('ok', 'sin_cambios', 'error')),
  detalle        text
);

CREATE INDEX ON tramite (categoria_id);
CREATE INDEX ON tarea (tramite_numero);
CREATE INDEX ON campo (paso_id);
CREATE INDEX ON suscripcion_whatsapp (tramite_numero) WHERE baja_en IS NULL;

-- Lo que consulta el chatbot para decidir a dónde llevar al ciudadano
CREATE VIEW v_tramite_chatbot AS
SELECT t.numero, t.nombre, i.nombre AS institucion, t.categoria_id, t.costo, t.tiempo, t.enlace_tramite,
       c.nivel_whatsapp, c.es_judicial, c.permite_tramite_completo,
       EXISTS (SELECT 1 FROM tarea ta WHERE ta.tramite_numero = t.numero) AS tiene_formulario
FROM tramite t
JOIN institucion i ON i.id = t.institucion_id
LEFT JOIN tramite_canal c ON c.tramite_numero = t.numero
WHERE t.activo;

COMMIT;
