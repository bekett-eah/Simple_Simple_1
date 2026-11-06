# Levantamiento del administrador de SimpleSV

Herramientas de la fase de levantamiento técnico ([PLAN_LEVANTAMIENTO.md](PLAN_LEVANTAMIENTO.md)). Todo es de **solo lectura** y apunta únicamente a `https://simple-dev.egob.sv/backend`.

## Preparar

```bash
cd levantamiento
npm install
```

## 1. Abrir Chrome para el levantamiento

Se usa un perfil aparte, con depuración remota solo en esta computadora (`127.0.0.1:9222`):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$TMPDIR/chrome-levantamiento" \
  --no-first-run --no-default-browser-check \
  https://simple-dev.egob.sv/backend/login
```

## 2. Iniciar sesión a mano

Con el usuario de pruebas, en esa ventana. Las credenciales no se escriben en ningún archivo ni en los reportes.

## 3. Capturar

```bash
node inspect-admin.mjs
```

Espera a que la ventana llegue al administrador (hasta 30 minutos) y documenta la pantalla abierta. Después, para una ruta del inventario ya revisada:

```bash
node inspect-admin.mjs --ruta /backend/ruta-aprobada --nombre modulo-x
```

Las rutas cuyo nombre parece una acción (eliminar, publicar, crear, editar, exportar, iniciar…) no se abren salvo que se agregue `--aprobada` después de revisarlas.

## Salida

`salida/<nombre>.json` y `salida/<nombre>.md`. La carpeta está fuera de git: se revisa y se retira cualquier dato sensible antes de compartir.

## Qué hace y qué no

Lee el título, la ruta y el idioma; los encabezados; los enlaces del mismo origen (marcando los que parecen acciones de escritura); los botones; la estructura de formularios y tablas; los scripts y hojas de estilo; los indicios de tecnología, y las solicitudes del mismo origen al cargar la pantalla (método, ruta, tipo y estado).

No hace clic ni envía formularios, no recorre enlaces y no lee valores de campos ni el contenido de las tablas. Tampoco guarda cookies, tokens, almacenamiento local, cabeceras, cuerpos HTTP ni parámetros de consulta. DUI, NIT, correos y teléfonos se ocultan en los textos.
