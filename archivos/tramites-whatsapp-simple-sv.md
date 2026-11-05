# Trámites de Simple.sv y mensajería por WhatsApp / correo

Documento de trabajo para el rediseño de Simple.sv. Fecha: 17 de octubre de 2026.

> **Advertencia.** Esto no es asesoría legal. No encontré ninguna ley salvadoreña que prohíba a un sistema nacional enviar mensajes por WhatsApp. Lo que sí existe son reglas de protección de datos personales y reglas propias de WhatsApp que limitan **qué se puede enviar**. La clasificación de abajo es un criterio de riesgo propuesto, no una lista oficial de prohibiciones. Debe validarla el área legal o el delegado de protección de datos antes de implementarse.

---

## 1. Resumen

- El canal (WhatsApp o correo) **no está prohibido** por lo que pude verificar. Instituciones públicas ya lo usan para orientación y consultas (Alcaldía de San Salvador Centro, CEPA, ISTU).
- Lo que condiciona el diseño es: **consentimiento previo**, **datos sensibles**, **datos de menores**, **transferencia internacional de datos** (WhatsApp procesa mensajes fuera del país) y las políticas de WhatsApp Business.
- Propuesta: WhatsApp y correo solo para **avisos de avance**, con opt-in explícito y revocable. Todo documento y todo dato personal se consulta **dentro de simple.sv**, con sesión iniciada.
- Esta lista afina la tabla en tres colores del mensaje anterior; algunos trámites cambiaron de nivel al revisarlos uno por uno.

Conteo de la clasificación: ✅ 69 · ⚠️ 29 · ⛔ 22 (total 120 filas). Tu scraper reporta 118; la lista pegada tiene 120 filas, así que conviene revisar duplicados contra el JSON.

---

## 2. Marco legal verificado

| Tema | Qué encontré | Efecto en el diseño |
|---|---|---|
| Ley para la Protección de Datos Personales | Aprobada el 12 de noviembre de 2024; aplica a personas naturales y jurídicas, públicas y privadas. | Toda notificación que lleve datos personales cae bajo esta ley. |
| Consentimiento | El tratamiento debe basarse en consentimiento informado y para una finalidad específica. Usar los datos para otra finalidad es infracción grave. | El opt-in debe decir exactamente qué mensajes se enviarán. |
| Datos sensibles | Requieren consentimiento expreso y por escrito del titular. | No enviar contenido sensible por WhatsApp. |
| Menores | Usar datos de niños, niñas y adolescentes sin consentimiento de padres, representantes o tutores es infracción muy grave. | Trámites de o para menores: consentimiento del adulto responsable. |
| Transferencias internacionales | Transferir a países sin protección mínima es infracción muy grave. | Revisar con un abogado cómo encaja WhatsApp (Meta). |
| Retiro del consentimiento | Una reforma de septiembre fijó 5 días hábiles para atender solicitudes de retiro. | Opción de baja fácil y registrada. |
| Registros públicos | La ley excluye datos de registros públicos (por ejemplo, estado familiar, DUI). | No significa que se puedan enviar por WhatsApp; consultar con legal. |
| Ley de Procedimientos Administrativos | Faculta a las instituciones a usar tecnologías de la información. | **No verifiqué** si un mensaje de WhatsApp vale como notificación legal. Asumir que no. |
| Quién supervisa | La Agencia de Ciberseguridad del Estado (ACE) y un delegado de protección de datos por institución. | Pedirles criterio escrito. |

---

## 3. Reglas de WhatsApp Business que condicionan el diseño

1. **Opt-in explícito.** Solo se puede escribir primero a quien dio consentimiento claro; una casilla premarcada no sirve. Conviene opt-in separado por tipo de mensaje (avisos del trámite vs. otros).
2. **Opt-out visible.** Cada mensaje debe permitir darse de baja, y las bajas se respetan de inmediato en todos los sistemas.
3. **Plantillas.** Fuera de la ventana de 24 horas solo se pueden enviar plantillas aprobadas por Meta. La categoría (utility, marketing, authentication) debe coincidir con el contenido; Meta puede recategorizar.
4. **Ventana de 24 horas.** Cuando la persona escribe, se abre una ventana de 24 horas para responder libremente.
5. **Datos prohibidos.** No compartir ni pedir números completos de tarjeta, cuentas financieras, números de documento de identidad u otros identificadores sensibles. Tampoco usar WhatsApp para pedir o enviar información de salud si la regulación aplicable lo prohíbe.
6. **Transparencia.** La persona debe entender que habla con una institución (o un asistente automatizado).
7. **Costos.** Meta cobra por mensaje entregado según categoría y país. Según reportes, desde el 1 de octubre de 2026 también se cobran los mensajes de servicio y las plantillas utility enviadas dentro de la ventana. Verifica las tarifas vigentes para El Salvador en la página de precios de Meta.
8. **Cuenta en riesgo.** Escribir sin opt-in o ignorar bajas es de las causas más comunes de restricción o suspensión del número.

---

## 4. Niveles de la clasificación

| Nivel | Qué puede decir el mensaje | Dónde se ve el detalle |
|---|---|---|
| ✅ **Verde** | Nombre del trámite, estado, fecha de cita, costo, enlace a simple.sv. | Portal. |
| ⚠️ **Amarillo** | Estado general ("en revisión", "listo") y enlace. Sin resultado, sin datos personales, sin documentos adjuntos. | Portal con sesión. |
| ⛔ **Rojo** | Solo un aviso genérico ("tienes una actualización en simple.sv"), **sin nombrar el trámite**. | Portal con sesión; documentos solo ahí. |

**Reglas para todos los niveles**

- Nunca adjuntar el documento oficial. Se descarga dentro de simple.sv.
- Nunca pedir DUI completo, datos de tarjeta u otros identificadores por el chat.
- El enlace no debe llevar datos personales en la URL.
- Resoluciones con efecto legal (aprobación, rechazo, prevención): notificar por el medio oficial dentro del portal; WhatsApp solo avisa.
- Trámites de o para menores: opt-in del padre, madre o tutor.
- El mismo criterio aplica al correo: sin adjuntos sensibles, con enlace al portal.

**Ejemplos de mensaje**

- ✅ "Simple.sv: recibimos tu solicitud de Solvencia de ANDA. Puedes ver el avance aquí: [enlace]. Responde BAJA para no recibir más avisos."
- ⚠️ "Simple.sv: tu solicitud está en revisión. Ingresa para ver el detalle: [enlace]. Responde BAJA para no recibir más avisos."
- ⛔ "Simple.sv: tienes una actualización pendiente. Ingresa a tu cuenta para verla: [enlace]. Responde BAJA para no recibir más avisos."

---

## 5. Clasificación trámite por trámite

Los números son de esta lista, no de la lista original.

### Seguridad e identidad

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 1 | Constancia de antecedentes penales (MJSP) | ⛔ | Dato de antecedentes. |
| 2 | Constancia de antecedentes policiales (PNC) | ⛔ | Ídem. |
| 3 | Certificación de partidas (RNPN) | ⛔ | Datos de filiación y estado familiar. |
| 4 | Certificación de registro de DUI y no DUI (RNPN) | ⛔ | Identificador. |
| 5 | Constancia de homónimo (RNPN) | ⛔ | Identificador. |
| 6 | Constancia de no restricción migratoria | ⚠️ | |

### Viceministerio de Transporte

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 7 | Apostillado de certificación de licencia de conducir | ⚠️ | Documento personal. |
| 8 | Apostillado de constancia de récord de licencia | ⚠️ | Documento personal. |
| 9 | Autorización de fianza moral | ✅ | |
| 10 | Autorización de realización de emisión de gases | ✅ | |
| 11 | Constancia de capacidad | ✅ | |
| 12 | Constancia de modificación a la capacidad | ✅ | |
| 13 | Constancia para exención de IVA | ✅ | |
| 14 | Modificación física de vehículo de transporte de carga | ✅ | |
| 15 | Permiso especial por peso/dimensiones | ✅ | |
| 16 | Permiso especial de materiales peligrosos | ✅ | |
| 17 | Registro de transportista de carga | ✅ | |
| 18 | Renovación de registro de transportistas | ✅ | |
| 19 | Certificación de tarifario | ✅ | |

### Educación (MINEDUCYT y ENA)

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 20 | Certificación de registro de título de educación media | ⚠️ | |
| 21 | Certificación de notas de educación básica y media | ⚠️ | Puede ser de menores. |
| 22 | Boleta de resultados PAES / AVANZO | ⚠️ | Suele ser de menores: opt-in del tutor. |
| 23 | Auténtica de documentos académicos | ⚠️ | |
| 24 | Ampliación de servicios educativos | ✅ | Trámite institucional. |
| 25 | Prospectos escolares | ✅ | |
| 26 | Cambio de domicilio de centros educativos | ✅ | |
| 27 | Creación, nominación y funcionamiento de centros | ✅ | |
| 28 | Constancia de estudios (ENA) | ⚠️ | |
| 29 | Certificación de notas graduados (ENA) | ⚠️ | |
| 30 | Reingreso carrera de agrónomo (ENA) | ⚠️ | |

### Servicios básicos y vivienda

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 31 | Solvencia de cuenta de agua/alcantarillado (ANDA) | ✅ | |
| 32 | Cambio de nombre del titular de la cuenta (ANDA) | ⚠️ | Anexa identidad y propiedad. |
| 33 | Constancia de no servicio (ANDA) | ✅ | |
| 34 | Factibilidad para una vivienda (ANDA) | ✅ | |
| 35 | Consulta y pago de préstamos (FSV) | ⚠️ | Dato financiero. |
| 36 | Estado de cuenta del FEC (FONAVIPO) | ⚠️ | Dato financiero. |
| 37 | Certificado de inscripción de desarrollador parcelario | ✅ | |

### Salud, pensiones y previsión social

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 38 | Constancia de pensionado (ISP) | ⛔ | |
| 39 | Constancia de cotizante no pensionado (ISP) | ⛔ | |
| 40 | Constancia de número de afiliación (ISP) | ⛔ | |
| 41 | Constancia de beneficiario inscrito (ISP) | ⛔ | |
| 42 | Constancia de afiliación y beneficio (ISP) | ⛔ | |
| 43 | Solvencia patronal de régimen salud (ISSS) | ⚠️ | |
| 44 | Constancia de no inscrito como patrono (ISSS) | ⚠️ | |
| 45 | Otorgamiento de cita médica (ISRI) | ⛔ | Salud. |
| 46 | Constancia médica (ISRI) | ⛔ | Salud. |
| 47 | Constancia de horarios de atención en rehabilitación (ISRI) | ⛔ | Revela atención en salud. |
| 48 | Reembolsos por gastos médico-hospitalarios (ISBM) | ⛔ | Salud y finanzas. |
| 49 | Ayuda económica por anteojos (ISBM) | ⛔ | Salud. |
| 50 | Ayuda económica por gastos funerarios (ISBM) | ⛔ | Familia y fallecimiento. |
| 51 | Constancia de pensión de veteranos y excombatientes (INABVE) | ⛔ | |
| 52 | Ingreso a programas de rehabilitación (FONAT) | ⛔ | Salud. |
| 53 | Historial de pago de seguros voluntarios (CME-MINED) | ⚠️ | Dato financiero. |

### Legal, familia, niñez y ética

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 54 | Fijación de cuota alimenticia (PGR) | ⛔ | Derecho de familia y menores. |
| 55 | Solvencia de pensión alimenticia (PGR) | ⛔ | Ídem. |
| 56 | Autorización y renovación de CAPI (CONAPINA) | ⚠️ | Trámite institucional; los anexos pueden incluir datos de niños. |
| 57 | Registro de proyectos de primera infancia, niñez y adolescencia | ⚠️ | Ídem. |
| 58 | Acreditación de programas y registro de miembros de REA | ⚠️ | Ídem. |
| 59 | Solvencia IAIP | ✅ | |
| 60 | Constancia del Tribunal de Ética Gubernamental | ⚠️ | |
| 61 | Constancia de cierre de casos (Defensoría del Consumidor) | ⚠️ | |

### Energía, hidrocarburos y minas (DGEHM)

Todos ✅ (trámites empresariales): certificación de registros (62), autorizaciones de comercialización, exportación, reexportación e importación de cilindros, válvulas, reguladores y accesorios de GLP (63 a 70) y transferencias de funcionamiento de estaciones de servicio, tanques, plantas, depósitos, fábricas y talleres (71 a 78).

### Aviación civil, CEPA y marítimo

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 79 | Extensión de permiso de piloto estudiante (AAC) | ⚠️ | Dato personal. |
| 80 | Extensión de permiso de aprendiz técnico de mantenimiento (AAC) | ⚠️ | Dato personal. |
| 81 a 95 | Certificaciones, anotaciones e inscripciones registrales de aeronaves (expedientes, tarifas, fianzas, pólizas, hipotecas, arrendamientos, poderes, gravámenes, propiedad, modificaciones, cancelaciones) y constancias de registro aeronáutico | ✅ | Registro de aeronaves, trámites empresariales. |
| 96 | Servicio VIP en el Aeropuerto Internacional | ✅ | |
| 97 | Servicio extraordinario en el Puerto de Acajutla | ✅ | |
| 98 | Carnet de identificación para empresas de CEPA | ⚠️ | Datos de empleados. |
| 99 | Autorización y registro de agentes marítimos (AMP) | ✅ | |

### Agricultura, ganadería y medio ambiente

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 100 | Matrícula de fierro para herrar ganado (MAG) | ✅ | |
| 101 | Nota de exoneración de visado de importación de productos agrícolas | ✅ | |
| 102 | Nota de exoneración de visado de importación de alimentos para animales | ✅ | |
| 103 | Notificación de asamblea general (MAG) | ✅ | |
| 104 | Permiso de incubación de huevos de tortuga marina (MARN) | ✅ | |
| 105 | Información gratuita de fenómenos naturales (MARN) | ✅ | |
| 106 | Certificación técnica para fines judiciales y de seguros (MARN) | ⚠️ | Uso judicial. |
| 107 | Información LIDAR para investigación científica (MARN) | ✅ | |

### Créditos, comercio, imprenta y otros

| # | Trámite | Nivel | Nota |
|---|---|---|---|
| 108 | Solicitud de crédito (FOSOFAMILIA) | ⚠️ | Dato financiero. |
| 109 | Solvencia y pago de impuestos municipales (Alcaldía Santa Ana Oeste) | ⚠️ | Dato financiero. |
| 110 | Publicación en Diario Oficial (Imprenta Nacional) | ✅ | |
| 111 | Constancia de publicación en Diario Oficial | ✅ | |
| 112 | Homónimos para registros de armas de fuego (MDN) | ⛔ | Armas. |
| 113 | Devolución de armas de fuego (MDN) | ⛔ | Armas. |
| 114 | Certificación de inscripción de federaciones deportivas (INDES) | ✅ | |
| 115 | Estado de cuenta (CORSAIN) | ⚠️ | Dato financiero. |
| 116 | Capacitación o consulta sobre derecho de competencia | ✅ | |
| 117 | Constancia de competencia (MOP) | ✅ | |
| 118 | Inscripción en registro de consultores (FOSEP) | ✅ | |
| 119 | Fondo Especial de Contribuciones (FEC) | ⚠️ | Dato financiero. |
| 120 | Registro de organizaciones y sociedades | ✅ | |

---

## 6. Diseño del consentimiento (para el rediseño)

1. Casilla **opcional y desmarcada**: "Quiero recibir avisos de mi trámite por WhatsApp / correo".
2. Texto claro: qué avisos se envían, por qué canal, que no incluyen documentos ni datos sensibles, y quién es el responsable.
3. Opt-in **separado** del consentimiento para tratar los datos del trámite.
4. Registrar fecha, hora, canal y texto aceptado.
5. Baja en un clic desde el portal y respondiendo "BAJA" en el chat; aplicarla de inmediato.
6. Para menores: el adulto responsable acepta y queda registrado.
7. El aviso por WhatsApp o correo nunca es la única notificación: lo oficial vive en el portal.

---

## 7. Pendientes de validación legal

- [ ] Origen de la supuesta prohibición: ¿ley, reglamento o política interna de ACE o de Innovación?
- [ ] Si la transferencia a Meta (WhatsApp) cumple con la ley de datos, y qué cláusulas o autorizaciones requiere.
- [ ] Si un mensaje de WhatsApp o correo puede valer como notificación en los términos de la Ley de Procedimientos Administrativos.
- [ ] Qué datos de los trámites rojos y amarillos cada institución considera sensibles.
- [ ] Criterio del delegado de protección de datos de cada institución participante.
- [ ] Tarifas vigentes de WhatsApp Business para El Salvador.

---

## 8. Fuentes

- [El Salvador: multas por infringir la Ley de Protección de Datos](https://www.elsalvador.com/?p=1182019)
- [Leyes de protección de datos y de ciberseguridad aprobadas](https://www.elsalvador.com/?p=1180943)
- [Puntos clave de las leyes de protección de datos y ciberseguridad](https://www.elsalvador.com/noticias/nacional/puntos-claves-de-las-nuevas-leyes-proteccion-datos-personales-y-ciberseguridad/1181041/2024/)
- [Reforma a la Ley de Protección de Datos Personales](https://www.elsalvador.com/?p=1293875)
- [Obligaciones del sector privado en protección de datos](https://diario.elmundo.sv/politica/que-obligaciones-se-mantienen-para-las-empresas-privadas-en-materia-de-proteccion-de-datos-personales)
- [ECIJA: Ley de protección de datos en El Salvador](https://www.ecija.com/actualidad-insights/ley-de-proteccion-de-datos-en-el-salvador/)
- [Normas de gobierno digital y procedimientos administrativos en El Salvador (UCR)](https://revistas.ucr.ac.cr/index.php/rRDMCP/article/download/3837/4837/20620)
- [Chatbot de WhatsApp de la Alcaldía de San Salvador Centro](https://www.elsalvador.com/?p=1281897)
- [WhatsApp de CEPA para el aeropuerto](https://www.elsalvador.com/?p=1277839)
- [Política de mensajería de WhatsApp Business (resumen)](https://learn.rasayel.io/en/books/whatsapp/whatsapp-business/whatsapp-business-messaging-policy)
- [Reglas de contenido de WhatsApp Business](https://botnation.ai/en/support/what-are-metas-rules-regarding-the-content-of-whatsapp-business-messages/)
- [Precios de WhatsApp Business Platform (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Cambio de precios del 1 de octubre de 2026](https://yournotify.com/blog/whatsapp-pricing-update-2026/)
