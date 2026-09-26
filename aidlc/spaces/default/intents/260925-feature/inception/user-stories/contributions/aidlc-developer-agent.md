**Collaborator:** aidlc-developer-agent

## Contribution

### OBS-1 — AC-3.1 no especifica el contrato de respuesta del modelo para activar el fallback

AC-3.1 dice "cuando Claude's confidence flag returns LOW" pero no define dónde ni cómo llega ese flag al backend. FR-2.1 y FR-3.1/3.2/3.3 sí detallan los triggers (campo `confidence: LOW`, JSON malformado, timeout), pero la historia no los refleja. Un desarrollador que lea solo la historia y no los requisitos no sabe si el flag viene en el body de la respuesta HTTP, en un header, o es inferido internamente. Para que US-3 sea implementable sin abrir requirements.md, los ACs deben referenciar el esquema JSON que el servicio de análisis emite. Además, AC-3.1 omite el trigger de timeout (FR-3.3) y el de schema inválido (FR-3.2), lo que deja dos caminos de fallback sin cobertura de AC en la historia.

### OBS-2 — AC-4.1 es suficiente como test de seguridad de aislamiento, pero requiere una fixture de usuario secundario que no existe en ninguna historia

AC-4.1 ("Bob requests Ana's image URL") es derivable como test de autorización: dado `upload_id: ABC` propiedad de `user_A`, una petición autenticada como `user_B` debe retornar 403. El AC es técnicamente preciso y ejecutable. Sin embargo, ninguna historia previa establece que el sistema de pruebas disponga de dos usuarios simultáneos. US-8 solo cubre registro de un usuario. El test que implementa AC-4.1 necesitará crear dos usuarios (setup de fixture), obtener dos JWTs, y hacer la petición cruzada. Si la capa de tests de integración no tiene helpers para multi-user setup, este AC añade complejidad de infraestructura de testing que no está en ningún plan de unidad. Recomendación: anotar en la historia que AC-4.1 requiere fixture de dos usuarios autenticados.

### OBS-3 — US-3 (fallback de baja confianza) carece de especificación suficiente para implementarse sin diseño adicional

US-3 no dice quién toma la decisión de marcar un upload como low-confidence: ¿el servicio de análisis (U2/U3) antes de persistir, o el servicio de almacenamiento (U4) al leer la respuesta? FR-3.1–3.3 enumeran los triggers pero no el flujo de control. En concreto: cuando la API de Claude expira (FR-3.3), ¿el registro de upload se crea con `confidence: low` y `scores: NULL` (FR-4.4), o no se crea hasta que haya respuesta? Si el registro no existe, AC-3.2 (excluido del trend) es trivial; si existe, necesita un campo de estado. AC-3.3 ("el upload cuenta contra el free tier") implica que el registro debe crearse incluso en timeout, lo que exige que U3 y U4 se coordinen en una transacción o flujo definido. Esto requiere una decisión de diseño de flujo antes de codificar U3.

### OBS-4 — Dependencia no documentada en el story map: US-6 y US-7 dependen de US-3 (flag de confianza)

El story map muestra US-6 (trend) y US-7 (freemium gate) como historias independientes de US-3 (fallback). En implementación, el servicio de trend (U6) consume el campo `confidence` que produce U3. Si U3 no está integrado, U6 no puede excluir correctamente los uploads low-confidence (FR-6.4). La dependencia es transitiva: US-6 → US-3 → US-2. El story map agrupa "Handle AI uncertainty" como paso separado pero no dibuja la arista de dato entre U3 y U6. En Node.js/TS esto se traduce en que el repositorio de trends debe filtrar por `confidence IN ('HIGH', 'MEDIUM')` antes de la regresión, algo que solo es testeable una vez que U3 persiste el flag correctamente.

### OBS-5 — AC-9.3 (reset del contador el día 1) no especifica la zona horaria, lo que hace el comportamiento indeterminado en producción

AC-9.3 dice "cuando February 1 arrives" sin anclar la zona horaria. Para un backend Node.js con UTC, el reset ocurre a las 00:00 UTC. Para un usuario en UTC-5, eso es las 19:00 del 31 de enero. FR-9.1 tampoco menciona zona horaria. El criterio de aceptación no puede verificarse sin saber en qué TZ se evalúa la condición. En un test automatizado, un reloj simulado en UTC pasará; en producción, los usuarios en zonas negativas recibirán el reset horas antes de la medianoche local. Recomendación: fijar explícitamente "resets at 00:00 UTC on the 1st" en AC-9.3 y en FR-9.1.

## Positions

AGREE: US-1 — Los tres ACs cubren el happy path y los dos rechazos (formato y tamaño). AC-1.2 especifica explícitamente la validación por magic number, que es implementable directamente con una librería como `file-type` en Node.js.

AGREE: US-2 — AC-2.1 fija el SLO de 30 segundos end-to-end y AC-2.2 cubre el caso de categoría irrelevante. Ambos son derivables como tests de integración sin ambiguedad.

OBJECT: US-3 — Los ACs no especifican el flujo de control entre el servicio de análisis y el de persistencia cuando ocurre un timeout (FR-3.3). No es implementable sin una decisión de diseño previa que defina si el registro se crea antes o después de recibir respuesta del modelo.

AGREE: US-4 / AC-4.1 — El AC es suficiente para derivar un test de autorización (petición cruzada de usuario B sobre recurso de usuario A). La precondición de fixture de dos usuarios es una consideración de implementación de test, no una falla del AC.

AGREE: US-5 — Los ACs distinguen correctamente entre uploads qualified y low-confidence en la vista de historial.

AGREE: US-6 — Los ACs especifican el algoritmo (regresión lineal con umbral ±2) y el threshold de mínimo de datos (4 uploads). Son implementables directamente.

OBJECT: US-7 — AC-7.1 tiene un duplicado de identificador (dos ítems llamados "AC-7.1"): uno marcado como "Should Have — deferred" y otro como el comportamiento Must Have real. Esto generará confusión al mapear tests a ACs. Se debe renumerar el AC del teaser como AC-7.0 o eliminarlo del documento de Must Have.

AGREE: US-8 — Los tres ACs son precisos. AC-8.1 especifica bcrypt y AC-8.2 especifica JWT con expiración de 7 días, lo cual es directamente implementable con `bcryptjs` y `jsonwebtoken` en Node.js/TS.

OBJECT: US-9 / AC-9.3 — Zona horaria no especificada. El comportamiento del reset es indeterminado sin anclar UTC explícitamente.

AGREE: US-10 — El mock de pago es implementable como un endpoint que simplemente persiste `tier: 'paid'` en la base de datos. AC-10.3 (aviso visible de mock) es un requisito de UI directamente verificable.

AGREE: US-11 — Los tres ACs son implementables. El flag de onboarding completado es un campo booleano en el registro de usuario, verificado en middleware antes de redirigir al upload.

AGREE: US-12 — AC-12.1 (accesible en 2 clicks) es un criterio de navegación UI verificable. AC-12.2 especifica el contenido mínimo requerido de la política.

AGREE: US-13 — AC-13.2 especifica la deleción completa con granularidad suficiente (blob storage, critique records, trends). La irreversibilidad (AC-13.2 "cannot be undone") es implementable como hard delete sin soft-delete flag.
