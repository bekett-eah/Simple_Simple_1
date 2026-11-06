# Pagos (fase 5)

## Estado

- **La maqueta simula el pago en el navegador** y la app la empaqueta así para desarrollo y pruebas, con la etiqueta
  del ambiente a la vista.
- **El flujo seguro está implementado** detrás de interfaces (`src/pagos/`) y probado contra el backend simulado
  (10 pruebas), pero **no está conectado** a `pago.html` ni al modal de pago de `tramite.html`. La regla de decisión del
  plan prohíbe tocar los flujos de pago sin conocer los servicios actuales, documentar la integración y tener
  ambientes de prueba.
- **No se puede publicar por error.** En producción, la revisión de `www` (`scripts/lib/verificar.mjs`) falla mientras
  estén la pasarela simulada (`pasarela-serfinsa.js`), la integración simulada con SIMPLE v2 (`integraciones.js`) o
  los datos fijos de la cuenta de prueba (`ciudadano.js`).

## Auditoría del flujo actual (actividades del plan)

| Actividad | Resultado en el repositorio |
|---|---|
| 1. Proveedor actual | La maqueta nombra a SERFINSA y replica su pantalla (`pasarela-serfinsa.js`). El repositorio no dice qué pasarela usa SIMPLE en producción ni bajo qué contrato. |
| 2. Flujo hasta el comprobante | Trámite → modal de pago → formulario de tarjeta → «Pagar» → «aprobado» con autorización y referencia al azar → comprobante en el mismo modal → `INTEGRACIONES.presentar({ …, pago })` guarda la solicitud en este navegador (`tramite.html:1434`). Desde el chat, `pago.html` devuelve el resultado por parámetros de la dirección (`pago.html:444`). |
| 3. Dónde se crea la orden | No hay orden. El monto lo calcula el navegador con el catálogo (`tramite.html:1269`); en `pago.html` puede venir del chat (`pago.html:333`). |
| 4. Dónde se procesa | En ninguna parte: `Math.random` en el navegador (`pago.html:336`, `tramite.html:1378`). |
| 5. Notificaciones del proveedor | No hay. |
| 6. Actualización del trámite | `localStorage` (`simple-tramites-nuevos`), en el mismo navegador. |
| 7. Reembolsos, pendientes, rechazos y conciliación | No existen. |
| 8. Google Pay u otros métodos en El Salvador | Sin información: hay que preguntarlo a la pasarela y al adquirente. |

## Reglas del plan y cómo se cumplen

| Regla | Cómo se cumple |
|---|---|
| No marcar un trámite como pagado por una respuesta visual del dispositivo | El estado lo cambia solo el backend, con la notificación autenticada de la pasarela o consultándola. La app pregunta al backend (`GET /v1/ordenes-pago/{id}`) hasta llegar a un estado final; lo que muestre la página de pago no cuenta. |
| El backend calcula o valida el importe | La app envía solo `solicitudId`; el backend calcula el monto con el trámite de la solicitud. |
| Orden de pago única y sin pagos duplicados | `Idempotency-Key` por solicitud para la orden y por intento para cada cobro. Además, una solicitud nunca tiene dos órdenes vigentes, aunque llegue otra clave: así, una solicitud ya pagada no se puede volver a cobrar. |
| No almacenar números de tarjeta ni códigos de seguridad | La tarjeta se escribe en la página alojada por la pasarela, fuera de la app y del backend. |
| No colocar claves privadas del proveedor en el frontend | La app no tiene claves: el backend crea el cobro. La configuración rechaza claves que parezcan secretos y la revisión de `www` busca claves conocidas. |
| Verificar notificaciones; validar importe, moneda, orden y estado | Responsabilidad del backend (ver más abajo). |
| Estados claros | `src/pagos/estados.js`: pendiente, verificando el pago, aprobado, rechazado, vencido y reembolsado. |
| Registro auditable | Historial de eventos en cada orden (`historial`); la bitácora completa vive en el backend. |

## Flujo propuesto

```text
App                                   Backend de la app                          Pasarela
 1. POST /v1/ordenes-pago { solicitudId }
    Idempotency-Key (de la solicitud) ──► calcula el monto; crea la orden
                                          o devuelve la que ya existe
 2. ◄── orden: monto en centavos, concepto, métodos, vencimiento
 3. muestra el monto; la persona elige el método
 4. POST /v1/ordenes-pago/{id}/intentos { metodo }
    Idempotency-Key (del intento) ──────► crea el cobro ─────────────────────────► página de pago alojada
 5. ◄── intento: tipo redireccion, url https
 6. abre la url en Custom Tabs ─────────────────────────────────────────────────► la persona paga ahí
 7.                                       ◄── notificación firmada ───────────── resultado
                                          verifica firma, monto, moneda y orden;
                                          cambia el estado y avisa a SIMPLE v2
 8. al cerrarse la página: GET /v1/ordenes-pago/{id} cada 2 s, hasta 2 minutos
 9. aprobado → comprobante; rechazado → puede intentar de nuevo;
    sin respuesta final → «Verificando el pago» (se consulta más tarde)
```

**Idempotencia.** La clave de la orden es la misma para todos los reintentos de una solicitud: doble toque, recarga o
que Android cierre la app a mitad del pago. Por eso se guarda en `localStorage` (`simple-app-claves-pago`) y se olvida
cuando el pago queda aprobado o vencido. Cada intento de cobro tiene su propia clave. Ante una falla de red, un 429 o
un 5xx, el cliente HTTP repite el mismo intento (con espera exponencial y `Retry-After`) y nunca crea un segundo cobro.
Un POST sin clave nunca se repite.

**Montos.** En centavos (enteros), en dólares, y se muestran con `Intl.NumberFormat('es-SV')`. Nunca se usan
decimales de punto flotante.

**Estados** (`src/pagos/estados.js`):

| De | Puede pasar a |
|---|---|
| pendiente | procesando, expirado |
| procesando | aprobado, rechazado, pendiente (la persona abandonó la página), expirado |
| rechazado | procesando (otro intento, con otra tarjeta o método), expirado |
| aprobado | reembolsado |
| expirado, reembolsado | — |

La app deja de consultar en aprobado, rechazado, expirado y reembolsado. En el simulador, una orden vence a los
30 minutos.

**Retorno desde la página de pago.** La dirección a la que la pasarela devuelve a la persona se acuerda con ella:
puede ser una página `https` que diga «vuelve a la app» o un App Link. En cualquier caso, la app no confía en los
parámetros del retorno: consulta al backend.

## Lo que le toca al backend

- **Notificaciones de la pasarela:** verificar la firma, procesar cada evento una sola vez (puede llegar repetido o
  fuera de orden) y comprobar que el monto, la moneda, la orden y el comercio coincidan. Lo que no cuadre se registra
  y no cambia el estado.
- **Una orden vigente por solicitud:** con otra clave de idempotencia, devolver la orden pendiente, procesando,
  rechazada o aprobada que ya existe. La clave puede perderse si se borran los datos de la app o si iOS libera
  espacio, y la app olvida la clave cuando el pago se aprueba. Solo una orden vencida o reembolsada deja crear otra.
  El simulador ya aplica esta regla.
- **Consulta activa:** si la notificación no llega, preguntar a la pasarela por el cobro antes de vencer la orden.
- **Conciliación diaria** con el reporte de liquidación de la pasarela, y trazabilidad de cada orden
  (solicitud → orden → intentos → eventos → comprobante).
- **Reembolsos** (estado `reembolsado`) y **comprobante** vinculado al trámite (`comprobanteUrl`).
- **Actualizar el trámite en SIMPLE v2** cuando el pago queda aprobado. La interfaz simulada actual
  (`INTEGRACIONES.presentar`) ya recibe `{ total, autorizacion, referencia }`.
- **Bitácora auditable** sin datos de tarjeta.

## PCI DSS

Con una página de pago alojada por la pasarela, los datos de la tarjeta no pasan por la app ni por el backend. Así el
alcance de PCI DSS para Simple.sv es el menor posible; el cuestionario que corresponde (normalmente SAQ A) lo confirma
el adquirente. Dibujar el formulario de tarjeta en la app, como la propuesta de diseño de la maqueta, ampliaría ese
alcance y no se recomienda. Si se quiere un formulario propio, debe ser con los campos alojados o el SDK de
tokenización de la pasarela.

## Otros métodos

- **Google Pay:** solo si la pasarela y el adquirente lo admiten en El Salvador. Si la página alojada lo ofrece,
  funciona dentro de Custom Tabs, que es Chrome. Si se quiere un botón propio en la app, se integra la API de
  Google Pay para Android con un plugin nativo: el token cifrado va al backend y de ahí a la pasarela. Requiere
  registrar el comercio en la consola de Google Pay y Wallet. Se agregaría como otra pasarela en `pasarelas.js` y
  otro valor de `metodos` en el contrato.
- **Apple Pay:** ver [06-preparacion-ios.md](06-preparacion-ios.md).
- **Políticas de las tiendas:** el cobro de trámites paga un servicio que se presta fuera de la app, así que no
  debería usar la facturación de Google Play ni las compras dentro de la app de Apple. Hay que confirmarlo con las
  políticas vigentes de cada tienda antes de publicar.

## Cómo conectarlo a la maqueta (cuando se cumpla la regla de decisión)

1. Confirmar el proveedor y conseguir su documentación, el ambiente de pruebas y las tarjetas de prueba.
2. Implementar en el backend las órdenes, los intentos, las notificaciones y la conciliación
   ([api/contrato-backend.yaml](api/contrato-backend.yaml)).
3. En `pago.html` y en el modal de `tramite.html`, cambiar el pago simulado por el servicio de la app:

   ```js
   const { pagos } = window.SIMPLE_APP;
   const orden = await pagos.prepararOrden({ solicitudId });     // monto y concepto vienen del backend
   const final = await pagos.pagar({ orden, metodo: 'tarjeta' }); // abre la página de pago y espera la confirmación
   // final.estado: aprobado | rechazado | expirado, o procesando si la confirmación tarda
   ```

4. Quitar `pasarela-serfinsa.js` y la autorización al azar, y sacarlos de `SIMULACIONES_DE_LA_MAQUETA` en
   `scripts/lib/verificar.mjs`.
5. Probar en el ambiente de pruebas: aprobado, rechazado, 3-D Secure (si aplica), cancelar, cerrar la página, que
   Android cierre la app durante el pago, doble toque, sin red, notificación tardía o repetida, y orden vencida.

## Pendientes con la pasarela y la institución

- Proveedor confirmado, contrato y responsables técnicos.
- Página de pago alojada o SDK de tokenización, y reglas para la dirección de retorno.
- Esquema de firma de las notificaciones, reintentos y direcciones IP de origen.
- 3-D Secure, reembolsos (totales y parciales), contracargos y reporte de conciliación.
- Si cada institución recibe el dinero en su propia cuenta (varios comercios) o hay una cuenta central.
- Comprobante o factura electrónica, si corresponde.
- Google Pay y otras billeteras: si los admite, y con qué identificador de comercio.
