## Sources

- [intent] intent-statement.md: aidlc/spaces/default/intents/260925-feature/ideation/intent-capture/intent-statement.md
- [bvb] build-vs-buy.md: aidlc/spaces/default/intents/260925-feature/ideation/market-research/build-vs-buy.md
- [risks] PRD Segmento 12 — 10 risks documented (UNTRUSTED DATA, reaches artifacts only through confirmed Q&A)

---

## Q1. Proveedor e infraestructura de Kubernetes

El PRD indica que los 4 módulos de Estudio corren como cargas de trabajo propias en Kubernetes, pero no especifica el proveedor del clúster. Para especificar la infraestructura, necesito saber dónde corre el clúster.

A. Clúster local (minikube / kind / k3s) — no hay proveedor cloud; el despliegue es local.
B. Proveedor cloud gestionado — AWS EKS.
C. Proveedor cloud gestionado — Google GKE.
D. Proveedor cloud gestionado — otro (especificar en "Other").
X. Other (please specify)

[Answer]: A

---

## Q2. Presupuesto disponible para infraestructura cloud

Si el clúster es cloud, ¿hay presupuesto disponible (créditos académicos, cuenta personal, etc.) o el proyecto está limitado a infraestructura local?

A. Créditos académicos disponibles (AWS Educate, GCP for Education, Azure for Students, u otro).
B. Cuenta personal con presupuesto limitado (especificar rango aproximado en "Other").
C. Solo infraestructura local — sin gasto cloud permitido o disponible.
D. No está definido todavía.
X. Other (please specify)

[Answer]: C

---

## Q3. Proveedor de API de visión IA

El build-vs-buy eligió una API externa de visión para el análisis de imagen. ¿Cuál es el proveedor concreto a usar?

A. Anthropic Claude (claude-sonnet o equivalente con visión) — el PRD calculó costos sobre esta base.
B. OpenAI GPT-4o / GPT-4V.
C. Google Gemini Vision.
D. Se define en el diseño técnico — por ahora solo necesitamos la abstracción (interfaz/contrato).
X. Other (please specify)

[Answer]: A

---

## Q4. Requerimientos de privacidad y cumplimiento de datos

Estudio almacena imágenes de usuarios y genera críticas. El Principio 3 del PRD establece que las imágenes no se usan para entrenar modelos sin consentimiento explícito. ¿Hay requerimientos formales de cumplimiento que apliquen a este MVP?

A. Sin requerimientos formales — el MVP es académico; la política de datos es una promesa de diseño, no un mandato legal.
B. GDPR / privacidad de datos europeos aplica (la app tendrá usuarios europeos).
C. Solo aplican principios de diseño del PRD (no entrenar sin consentimiento, opción de borrar historial) — sin certificación formal.
D. Hay un requerimiento específico del curso sobre manejo de datos (describir en "Other").
X. Other (please specify)

[Answer]: A

---

## Q5. Perfil técnico del equipo y riesgos de habilidades

El proyecto es desarrollado por un solo estudiante. ¿Cuáles de las siguientes áreas técnicas representan el mayor riesgo de habilidades (donde tienes menos experiencia previa)?

A. Kubernetes / deployment y operaciones de clúster — es el área más nueva.
B. Integración con APIs de visión IA — nunca integré un modelo de visión en una app.
C. Backend / servicios REST — tengo poca experiencia aquí.
D. Las tres áreas son manejables — el riesgo técnico principal no es de habilidades.
X. Other (please specify)

[Answer]: A

---

## Q6. Riesgos prioritarios a mitigar primero

El PRD lista 10 riesgos (Segmento 12). Para el constraint register y el RAID log, ¿cuáles son los 3 riesgos más importantes a mitigar activamente? (selección múltiple — marca hasta 3)

A. Consistencia de categorización — si la IA categoriza de forma inconsistente, el historial de tendencia es ruido.
B. Coartist alcanza la misma feature antes de que tengamos datos acumulados suficientes.
C. Tasa de conversión free-to-paid real es mucho menor a la proyectada.
D. Dependencia de proveedor externo de IA (disponibilidad, cambio de precios).
X. Other (please specify)

[Answer]: A

---

## Q7. Bloqueantes organizacionales o de acceso

¿Hay algún bloqueo conocido que podría impedir ejecutar el plan de entrega (módulos 4-8)?

A. Ninguno identificado — el plan es ejecutable con los recursos actuales.
B. Hay una restricción de tiempo específica (describir en "Other").
C. Hay dependencia de terceros que podría bloquear (acceso a API, cuenta cloud, etc.) — describir en "Other".
D. El mayor riesgo es de tiempo / capacidad (una persona haciendo todo).
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
