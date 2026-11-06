# Simple.sv · app móvil

App Android de Simple.sv hecha con Capacitor 8. Empaqueta el frontend web del repositorio (`index.html`,
`nuevoDiseño/` y `src/`) sin duplicarlo, y le agrega inicio de sesión con Identidad Digital, ingreso con biometría y
una capa de pagos modular. Sigue el plan de [Plan_tecnico_app_movil_SIMPLE.md](Plan_tecnico_app_movil_SIMPLE.md).
iOS queda preparado para una fase posterior.

> **Estado:** la app funciona con servicios **simulados** (ambientes de desarrollo y pruebas). Para integrar
> Identidad Digital, la pasarela de pagos y el backend reales faltan su documentación, sus accesos y sus ambientes de
> prueba. Mientras falten, el build de producción se detiene a propósito.

## Requisitos

- Node 22 o superior.
- Android: JDK 21 y el SDK de Android con la plataforma 36. Android Studio los instala; también bastan las herramientas
  de línea de comandos ([APK de pruebas](docs/05-pruebas-seguridad-despliegue.md#apk-de-pruebas)).
- iOS (más adelante): una Mac con Xcode ([docs/06-preparacion-ios.md](docs/06-preparacion-ios.md)).

## Primeros pasos

```bash
cd app
npm ci
npm test                    # pruebas de la app
npm run build && npm run servir
# → http://127.0.0.1:8787 con vista de teléfono, usando los simuladores
npm run android             # build de desarrollo, cap sync y Android Studio
npm run verificar           # pruebas, build de pruebas, cap sync y revisión del paquete
cd android && ./gradlew assembleDebug
# → APK de pruebas en android/app/build/outputs/apk/debug/app-debug.apk
```

| Comando | Qué hace |
|---|---|
| `npm run build` / `build:pruebas` / `build:produccion` | Arma `www/` para cada ambiente |
| `npm run sync` / `sync:pruebas` | Build y `cap sync android` |
| `npm run iconos` | Regenera los íconos y la pantalla de arranque de Android |

`www/` y `android/app/src/main/assets/public/` se generan en cada build: no se editan a mano. Los cambios del
frontend se hacen en el frontend web, que debe seguir funcionando en el navegador.

## Ambientes

| | desarrollo | pruebas | produccion |
|---|---|---|---|
| Identidad, sesión y pagos | Simulados | Simulados | Reales (faltan los datos institucionales) |
| Depuración y mapas de código | Sí | No | No |

La configuración está en `config/<entorno>.json` y nunca lleva secretos: el build rechaza las claves que lo parezcan.
Los secretos de Identidad Digital y de la pasarela viven solo en el backend.

## Estructura

```text
app/
├── config/             configuración de cada ambiente
├── scripts/            build, revisión del paquete, íconos y servidor local
├── src/                capa móvil: núcleo, identidad, sesión, pagos, backend, controladores y pantallas propias
├── tests/              pruebas unitarias (node:test)
├── android/            proyecto Android (generado por Capacitor y personalizado)
└── docs/               documentación
```

## Documentación

1. [Auditoría del repositorio](docs/01-auditoria-repositorio.md): respuestas a las preguntas del plan, inventario y hallazgos.
2. [Arquitectura](docs/02-arquitectura.md): decisiones, build, capa móvil, adaptadores y seguridad del contenedor.
3. [Identidad Digital, sesión y biometría](docs/03-identidad-y-sesion.md).
4. [Pagos](docs/04-pagos.md).
5. [Pruebas, seguridad y despliegue](docs/05-pruebas-seguridad-despliegue.md): resultados, firma y publicación.
6. [Preparación para iOS](docs/06-preparacion-ios.md).
7. [Contrato propuesto del backend](docs/api/contrato-backend.yaml) (OpenAPI 3.1).

## Estado frente a los entregables del plan

| Entregable | Estado |
|---|---|
| 1. Informe de auditoría | Hecho ([01](docs/01-auditoria-repositorio.md)) |
| 2. Inventario de tecnologías, dependencias y APIs | Hecho ([01](docs/01-auditoria-repositorio.md) y [02](docs/02-arquitectura.md)) |
| 3. Diagramas de la arquitectura actual y objetivo | Hecho ([01](docs/01-auditoria-repositorio.md) y [02](docs/02-arquitectura.md)) |
| 4. Proyecto Android configurado | Hecho: el APK de pruebas se compiló en este equipo y pasó la revisión. El flujo de CI también lo compila, pero aún no se ejecutó. |
| 5. App Android funcional con las pantallas reutilizables | Hecho con simuladores y probado en el navegador; falta probar en teléfonos |
| 6. Integración autorizada de Identidad Digital | **Bloqueado** por falta de documentación, registro y ambiente de pruebas. El adaptador está listo. |
| 7. Acceso biométrico seguro | Hecho en la app (Keystore y biometría fuerte); falta el backend real y probarlo en teléfonos |
| 8. Capa modular de pagos | Hecho; sin conectar a la maqueta por la regla de decisión del plan |
| 9. Integración de los métodos de pago aprobados | **Bloqueado** por falta de la pasarela |
| 10. Historial y comprobantes | Parcial: historial de eventos por orden y `comprobanteUrl` en el contrato; faltan la pantalla y el backend |
| 11. Informe de pruebas funcionales y de seguridad | Hecho ([05](docs/05-pruebas-seguridad-despliegue.md)), sin pruebas en teléfonos todavía |
| 12. Documentación para mantenimiento y expansión a iOS | Hecho (este archivo, [02](docs/02-arquitectura.md) y [06](docs/06-preparacion-ios.md)) |

## Antes de abrir un pull request

- `npm run verificar` debe terminar sin problemas. El flujo `.github/workflows/app-movil.yml` lo repite en GitHub y
  además compila el APK de depuración.
- Si se reemplaza una simulación de la maqueta por el servicio real, hay que quitarla de `SIMULACIONES_DE_LA_MAQUETA`
  en `scripts/lib/verificar.mjs`.
- Nunca se versionan claves de firma, `keystore.properties` ni archivos `.env`.
