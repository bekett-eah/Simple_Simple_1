# Plan técnico: evolución de SIMPLE a aplicación móvil

**Proyecto:** SIMPLE / aplicación de trámites ciudadanos\
**Repositorio:** https://github.com/bekett-eah/Simple_Simple_1\
**Punto de partida:** aplicación existente desarrollada con tecnologías
web (HTML, CSS y JavaScript)\
**Plataforma inicial:** Android\
**Plataforma futura:** iOS

------------------------------------------------------------------------

## 1. Objetivo general

Transformar la aplicación web existente en una aplicación móvil segura y
multiplataforma, comenzando por Android, reutilizando la mayor cantidad
posible del código actual.

La aplicación móvil deberá permitir que el ciudadano:

1.  Acceda por primera vez mediante Identidad Digital de El Salvador,
    sujeto a la documentación y autorización del proveedor.
2.  Active voluntariamente el acceso biométrico del dispositivo para
    facilitar ingresos posteriores.
3.  Consulte y realice trámites desde la aplicación.
4.  Pague los trámites mediante los métodos actuales y, después de
    verificar compatibilidad, incorpore opciones de billetera digital
    como Google Pay.
5.  Consulte el estado de sus trámites, pagos y comprobantes.

**Principio rector:** no reemplazar el sistema actual hasta conocer su
arquitectura, dependencias, integraciones y responsabilidades. La
aplicación móvil no debe convertirse en la fuente de verdad de trámites
ni pagos; esas confirmaciones deben provenir del backend y de los
proveedores correspondientes.

## 2. Información conocida y pendientes

### Información confirmada por el usuario

-   La aplicación actual tiene el código en un repositorio GitHub.
-   Identidad prevista: Identidad Digital del Gobierno de El Salvador.
-   La pasarela de pago actual es un proveedor distinto de los
    mencionados inicialmente; su nombre todavía no está identificado.
-   El usuario aún no sabe si existe un backend propio o dónde se
    encuentra.
-   Se iniciará con Android y se busca preparar una evolución posterior
    a iOS.

### Hallazgos preliminares del repositorio

Repositorio:
[Simple_Simple_1](https://github.com/bekett-eah/Simple_Simple_1)

En la inspección inicial se identificaron, entre otros, estos elementos:

-   `index.html`
-   `servidor.py`
-   `asistente_ia.py`
-   `requirements.txt`
-   `SIMPLE ACTUAL/`
-   `archivos/`
-   `bd/`
-   `nuevoDiseño/`
-   `pruebas/`
-   `scrapper/`
-   `src/`

La estructura sugiere una aplicación web y componentes auxiliares en
Python. La descripción preliminar de `servidor.py` apunta a un servidor
de pruebas/local y a una ruta `POST /api/asistente`; esto no demuestra
que exista un backend completo de producción para usuarios, trámites o
pagos.

**Importante:** estos son hallazgos preliminares, no una auditoría
exhaustiva. Es necesario inspeccionar el contenido completo de los
archivos y carpetas relevantes para confirmar tecnologías, endpoints,
almacenamiento, autenticación y proveedor de pagos.

## 3. Arquitectura objetivo propuesta

La arquitectura definitiva dependerá de la auditoría. Como hipótesis
inicial se propone:

``` text
┌──────────────────────────────────────────┐
│             Aplicación Android           │
│       HTML + CSS + JavaScript             │
│              Capacitor                   │
└─────────────────────┬────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
┌─────────▼──────────┐  ┌─────────▼──────────┐
│ Módulo de identidad│  │   Módulo de pagos  │
│ Identidad Digital  │  │ Pasarela existente │
│ Biometría local    │  │ Wallet compatible  │
└─────────┬──────────┘  └─────────┬──────────┘
          │                       │
          └───────────┬───────────┘
                      │
           ┌──────────▼───────────┐
           │ Capa de integración  │
           │ APIs y autorización  │
           └──────────┬───────────┘
                      │
           ┌──────────▼───────────┐
           │ Servicios existentes │
           │ Backend, trámites,   │
           │ datos y proveedores  │
           └──────────────────────┘
```

### Tecnologías candidatas

  -----------------------------------------------------------------------
  Componente              Propuesta inicial       Condición
  ----------------------- ----------------------- -----------------------
  Aplicación móvil        Capacitor               Confirmar
                                                  compatibilidad del
                                                  frontend

  Android                 Android Studio / Gradle Configurar proyecto
                                                  nativo

  Biometría               Android BiometricPrompt Integración mediante
                                                  plugin nativo
                                                  compatible

  Protección de claves    Android Keystore        No almacenar secretos
                                                  en texto plano

  Identidad               Proveedor oficial de    Obtener documentación y
                          Identidad Digital       autorización

  Pagos                   Pasarela actual +       Identificar proveedor y
                          evaluación de Google    compatibilidad
                          Pay                     

  Backend                 Backend existente o     Determinarlo durante la
                          capa API por definir    auditoría

  iOS                     Capacitor y capacidades Fase posterior
                          nativas equivalentes    
  -----------------------------------------------------------------------

Capacitor es una opción inicial porque permite empaquetar una aplicación
web en aplicaciones móviles y acceder a capacidades nativas mediante
plugins. No debe darse por confirmada hasta probar el código real.

## 4. Fase 1: auditoría técnica del repositorio

### Objetivo

Entender cómo funciona la aplicación actual antes de modificarla o
empaquetarla.

### Actividades

1.  Revisar la estructura completa del repositorio y sus ramas
    relevantes.
2.  Identificar la versión y tecnologías utilizadas.
3.  Revisar HTML, CSS, JavaScript y librerías externas.
4.  Identificar puntos de entrada y navegación.
5.  Localizar llamadas `fetch`, `XMLHttpRequest`, clientes HTTP y URLs
    de servicios.
6.  Identificar endpoints, métodos HTTP, formatos de respuesta y
    mecanismos de autorización.
7.  Revisar `servidor.py`, `asistente_ia.py` y `requirements.txt`.
8.  Inspeccionar `bd/` para identificar esquemas, migraciones o archivos
    de datos.
9.  Buscar referencias a autenticación, sesiones, tokens, pagos y
    comprobantes.
10. Revisar configuración de despliegue y variables de entorno, sin
    revelar ni copiar secretos.
11. Identificar recursos, dependencias o funciones que puedan fallar
    dentro de un WebView.
12. Ejecutar la aplicación en un entorno de pruebas, si se cuenta con
    instrucciones y dependencias suficientes.

### Archivos y carpetas prioritarios

  -----------------------------------------------------------------------
  Ruta                                Preguntas que debe responder la
                                      auditoría
  ----------------------------------- -----------------------------------
  `index.html`                        ¿Es el punto de entrada? ¿Qué
                                      lógica y servicios invoca?

  `SIMPLE ACTUAL/`                    ¿Qué flujos de la aplicación
                                      anterior deben conservarse?

  `nuevoDiseño/`                      ¿Qué pantallas y flujos están
                                      implementados?

  `src/`                              ¿Dónde está la lógica reutilizable
                                      y la integración con servicios?

  `bd/`                               ¿Existe una base de datos o solo
                                      archivos auxiliares?

  `servidor.py`                       ¿Qué rutas expone y para qué
                                      entorno está diseñado?

  `asistente_ia.py`                   ¿Qué servicios externos consume?

  `requirements.txt`                  ¿Qué dependencias de Python
                                      requiere el servidor?

  `pruebas/`                          ¿Qué pruebas y escenarios existen?
  -----------------------------------------------------------------------

### Entregables

-   Inventario de tecnologías y dependencias.
-   Diagrama de componentes y flujo de datos.
-   Inventario de APIs y endpoints encontrados.
-   Identificación del backend y almacenamiento, si existen.
-   Mapa del flujo de autenticación.
-   Mapa del flujo de pagos.
-   Lista de riesgos y brechas para Android.
-   Recomendación de arquitectura definitiva.

### Criterio de salida

No iniciar la integración real de identidad o pagos hasta identificar
los componentes actuales, sus responsables y los ambientes de prueba
disponibles.

## 5. Fase 2: conversión y adaptación para Android

### Objetivo

Obtener una primera versión instalable de la aplicación actual en
Android, sin cambiar innecesariamente la lógica de negocio.

### Actividades

1.  Crear una rama de trabajo específica para la migración móvil.
2.  Verificar que el frontend pueda ejecutarse como aplicación web
    independiente.
3.  Identificar y resolver dependencias incompatibles con WebView.
4.  Configurar Capacitor.
5.  Crear el proyecto Android.
6.  Configurar identificador de aplicación, nombre, iconos y recursos.
7.  Adaptar diseño responsive y navegación para pantallas móviles.
8.  Revisar teclado, formularios, carga de archivos, enlaces externos y
    permisos.
9.  Configurar dominios permitidos y comunicación segura.
10. Generar una versión de desarrollo para pruebas en dispositivos
    físicos.

### Entregable

Primera aplicación Android instalable que permita navegar por las
funciones existentes que sean compatibles.

### Criterios de aceptación

-   La aplicación se instala y abre en dispositivos Android de prueba.
-   Las pantallas principales se visualizan correctamente.
-   La navegación no depende de comportamientos exclusivos de
    escritorio.
-   Las llamadas a servicios funcionan en el ambiente de pruebas.
-   No se incluyen secretos ni credenciales dentro del paquete móvil.

## 6. Fase 3: integración con Identidad Digital de El Salvador

### Objetivo

Permitir que el ciudadano realice su primera autenticación con Identidad
Digital y que la aplicación reciba una identidad validada mediante el
mecanismo oficial.

### Requisitos previos

Solicitar al responsable del servicio:

-   Documentación oficial para integradores.
-   Proceso de autorización de aplicaciones.
-   Identificadores y configuración del cliente para pruebas.
-   URLs de los ambientes de pruebas y producción.
-   Protocolo y flujo admitidos.
-   Alcances o atributos de identidad que se pueden solicitar.
-   Reglas de expiración, cierre y revocación.
-   Procedimiento de soporte y gestión de incidentes.

### Diseño técnico propuesto

Si el proveedor lo admite, utilizar OpenID Connect sobre OAuth 2.0 con
Authorization Code y PKCE para aplicaciones móviles.

Flujo conceptual:

1.  El ciudadano selecciona "Ingresar con Identidad Digital".
2.  La aplicación inicia el flujo oficial de autenticación.
3.  El proveedor autentica al ciudadano.
4.  La aplicación recibe el resultado mediante el mecanismo autorizado.
5.  El backend valida los tokens, emisor, audiencia, firma, expiración y
    demás parámetros.
6.  El backend establece o vincula la sesión de la aplicación.
7.  La aplicación obtiene únicamente los datos y permisos necesarios.

No se debe asumir que el proveedor utiliza OIDC ni inventar endpoints.
Si su mecanismo oficial es diferente, se debe adaptar la arquitectura a
su documentación.

### Entregable

Autenticación inicial integrada y validada en un ambiente autorizado de
pruebas.

## 7. Fase 4: acceso biométrico y gestión de sesiones

### Objetivo

Permitir que el ciudadano habilite voluntariamente huella o
reconocimiento facial compatible para facilitar los ingresos
posteriores.

### Flujo propuesto

**Primer ingreso:**

1.  El ciudadano se autentica mediante Identidad Digital.
2.  El backend valida la identidad y crea una sesión.
3.  La aplicación pregunta si desea habilitar acceso biométrico.
4.  Si acepta, se crea o habilita un mecanismo criptográfico protegido
    por el dispositivo.
5.  Se comprueba que el acceso biométrico funciona.

**Ingresos posteriores:**

1.  El ciudadano abre la aplicación.
2.  La aplicación solicita autenticación biométrica.
3.  La biometría autoriza el uso de una clave o credencial protegida por
    Android Keystore.
4.  La aplicación realiza la operación segura de renovación o
    recuperación de sesión definida por el backend.
5.  El backend valida la sesión y devuelve una autorización vigente.

### Requisitos de seguridad

-   No almacenar contraseñas de Identidad Digital.
-   No almacenar tokens de larga duración sin protección.
-   No guardar plantillas biométricas; la biometría permanece bajo
    control del sistema operativo.
-   Proteger claves mediante Android Keystore.
-   Definir expiración y revocación de sesiones.
-   Permitir cerrar sesión y desvincular un dispositivo.
-   Solicitar reautenticación cuando la sesión, el riesgo o las reglas
    del proveedor lo requieran.
-   Implementar recuperación cuando cambie la biometría, se pierda el
    dispositivo o se reinstale la aplicación.

### Entregable

Acceso biométrico funcional, voluntario y sujeto a controles de sesión
del backend.

## 8. Fase 5: auditoría y modernización de pagos

### Objetivo

Conservar los métodos actuales y mejorar la experiencia de pago mediante
una integración modular.

### Actividades de auditoría

1.  Identificar el proveedor de pagos actual.
2.  Revisar el flujo desde la selección del trámite hasta el
    comprobante.
3.  Identificar dónde se crea la orden de pago.
4.  Identificar dónde se procesa el pago.
5.  Revisar cómo se reciben y verifican las notificaciones del
    proveedor.
6.  Determinar cómo se actualiza el estado del trámite.
7.  Revisar reembolsos, pagos pendientes, rechazos y conciliación.
8.  Confirmar si el proveedor admite Google Pay u otros métodos
    digitales en El Salvador.

### Arquitectura de pagos propuesta

La aplicación debe utilizar una capa de integración para no depender
directamente de un único proveedor.

``` text
Aplicación móvil
       |
       v
Backend de pagos
       |
       v
Servicio de órdenes de pago
       |
       +------ Pasarela actual
       |
       +------ Google Pay (si es compatible)
       |
       +------ Otros métodos autorizados
       |
       v
Confirmación verificada
       |
       v
Actualización del trámite
       |
       v
Comprobante e historial
```

### Flujo de pago propuesto

1.  El ciudadano selecciona el trámite.
2.  El backend calcula o valida el importe.
3.  El backend genera una orden de pago única.
4.  La aplicación muestra los métodos disponibles.
5.  El ciudadano selecciona el método y autoriza la operación.
6.  El proveedor procesa el pago.
7.  El backend verifica el resultado mediante una respuesta autenticada
    o consulta al proveedor.
8.  Se actualiza el estado del pago y del trámite de forma controlada.
9.  Se genera o habilita el comprobante.

### Mejoras funcionales

-   Reducir pantallas y campos innecesarios.
-   Incorporar métodos compatibles con billeteras digitales.
-   Evitar solicitar nuevamente datos que el proveedor pueda gestionar
    de forma segura.
-   Mostrar estados claros: pendiente, aprobado, rechazado, reembolsado.
-   Prevenir pagos duplicados mediante claves de idempotencia.
-   Mantener historial de operaciones.
-   Generar comprobantes vinculados al trámite.
-   Implementar conciliación y trazabilidad.

### Requisitos de seguridad

-   No almacenar números completos de tarjetas ni códigos de seguridad.
-   No colocar claves privadas del proveedor en el frontend.
-   Verificar las notificaciones de pago en el backend.
-   Validar importe, moneda, identificador de orden y estado.
-   No marcar un trámite como pagado por una respuesta visual del
    dispositivo.
-   Registrar eventos y resultados de forma auditable.
-   Cumplir los requisitos aplicables de PCI DSS y del proveedor.

### Entregable

Módulo de pagos modernizado, con los métodos aprobados por el proveedor
y confirmación verificable en backend.

## 9. Fase 6: pruebas, seguridad y despliegue

### Pruebas funcionales

-   Instalación y actualización.
-   Navegación y visualización.
-   Autenticación inicial.
-   Acceso biométrico.
-   Expiración y revocación de sesión.
-   Inicio y finalización de trámites.
-   Pagos aprobados, rechazados y pendientes.
-   Reintentos y prevención de duplicados.
-   Comprobantes e historial.
-   Pérdida de conexión y recuperación.

### Pruebas de seguridad

-   Almacenamiento local de credenciales.
-   Protección de claves.
-   Validación de tokens.
-   Seguridad de APIs.
-   Autorización por usuario.
-   Protección de información personal.
-   Validación de notificaciones de pago.
-   Análisis de dependencias.
-   Pruebas de manipulación del cliente.

### Despliegue

1.  Ambiente de desarrollo.
2.  Ambiente de integración y pruebas.
3.  Piloto controlado.
4.  Corrección de incidencias.
5.  Preparación de publicación.
6.  Monitoreo y soporte.

### Entregable

Versión Android candidata a producción, acompañada de resultados de
pruebas y documentación operativa.

## 10. Fase 7: preparación de iOS

Una vez estabilizada la versión Android:

-   Revisar compatibilidad del frontend con iOS.
-   Configurar el proyecto iOS de Capacitor.
-   Implementar autenticación biométrica mediante las capacidades
    nativas de Apple.
-   Revisar almacenamiento seguro y gestión de sesiones.
-   Adaptar pagos según los proveedores y reglas aplicables.
-   Ejecutar pruebas en dispositivos iPhone.
-   Preparar distribución y publicación.

La lógica de negocio y las APIs deben mantenerse compartidas siempre que
sea viable. Las integraciones nativas de biometría y almacenamiento
seguro pueden requerir implementaciones específicas por plataforma.

## 11. Riesgos y decisiones pendientes

  -----------------------------------------------------------------------
  Riesgo o pendiente                  Acción necesaria
  ----------------------------------- -----------------------------------
  No se conoce el backend real        Identificar servicios, responsables
                                      y despliegues

  No se conoce la base de datos       Revisar `bd/` y configuración del
                                      sistema

  No se conoce la pasarela            Identificar proveedor y
                                      documentación

  Integración de Identidad Digital no Solicitar documentación y
  confirmada                          autorización

  Compatibilidad del frontend no      Ejecutar pruebas con Capacitor
  comprobada                          

  Sesiones actuales desconocidas      Auditar autenticación y expiración

  Requisitos legales y de privacidad  Validar con responsables
                                      institucionales

  Integración de wallet incierta      Confirmar compatibilidad regional y
                                      del adquirente
  -----------------------------------------------------------------------

## 12. Entregables generales del proyecto

1.  Informe de auditoría del repositorio.
2.  Inventario de tecnologías, dependencias y APIs.
3.  Diagrama de arquitectura actual y objetivo.
4.  Proyecto Android configurado.
5.  Aplicación Android funcional con las pantallas reutilizables.
6.  Integración autorizada de Identidad Digital.
7.  Acceso biométrico seguro.
8.  Capa modular de pagos.
9.  Integración de métodos de pago aprobados.
10. Historial y comprobantes.
11. Informe de pruebas funcionales y de seguridad.
12. Documentación para mantenimiento y futura expansión a iOS.

## 13. Orden de ejecución recomendado

  -----------------------------------------------------------------------
  Prioridad               Trabajo                 Dependencia
  ----------------------- ----------------------- -----------------------
  P0                      Obtener y auditar el    Repositorio
                          código completo         

  P0                      Identificar backend,    Auditoría
                          APIs y almacenamiento   

  P0                      Identificar pasarela y  Código y documentación
                          flujo de pago           del proveedor

  P0                      Obtener documentación   Responsable del
                          de Identidad Digital    servicio

  P1                      Probar compatibilidad   Auditoría frontend
                          con Capacitor           

  P1                      Construir primera       Configuración móvil
                          versión Android         

  P1                      Integrar autenticación  Acceso autorizado
                          oficial                 

  P2                      Implementar biometría   Sesiones y backend

  P2                      Modernizar pagos        Proveedor identificado

  P2                      Pruebas integrales y    Módulos integrados
                          piloto                  

  P3                      Adaptar a iOS           Android estabilizado
  -----------------------------------------------------------------------

## 14. Siguiente paso inmediato

El siguiente paso es completar la auditoría del repositorio
`Simple_Simple_1`.

Se recomienda descargar el repositorio como ZIP desde GitHub y
adjuntarlo para inspeccionar los archivos completos. Antes de
compartirlo, excluir:

-   Archivos `.env`.
-   Contraseñas y tokens.
-   Claves privadas.
-   Certificados privados.
-   Credenciales de producción.
-   Copias de bases de datos con información personal real.

Con el código disponible se deberá producir un informe que responda, con
evidencia:

1.  ¿Dónde está implementado el frontend?
2.  ¿Existe un backend y qué responsabilidades tiene?
3.  ¿Qué APIs consume la aplicación?
4.  ¿Dónde y cómo se almacenan los datos?
5.  ¿Cómo se implementa actualmente la autenticación?
6.  ¿Dónde está integrado el proveedor de pagos?
7.  ¿Qué partes pueden reutilizarse en Android?
8.  ¿Qué cambios son indispensables para Capacitor?
9.  ¿Qué accesos y documentación institucional hacen falta?

**Regla de decisión:** no modificar los flujos productivos de
autenticación ni pagos hasta tener identificados los servicios actuales,
documentados los mecanismos de integración y disponibles los ambientes
de prueba.

------------------------------------------------------------------------

## Referencias técnicas

-   [Repositorio SIMPLE](https://github.com/bekett-eah/Simple_Simple_1)
-   [Capacitor](https://capacitorjs.com/)
-   [Android
    BiometricPrompt](https://developer.android.com/identity/sign-in/biometric-auth)
-   [Android
    Keystore](https://developer.android.com/privacy-and-security/keystore)
-   [Google Pay API para
    Android](https://developers.google.com/pay/api/android/overview)
-   [OpenID Connect](https://openid.net/developers/how-connect-works/)
-   [OAuth 2.0 para aplicaciones nativas (RFC
    8252)](https://datatracker.ietf.org/doc/html/rfc8252)
