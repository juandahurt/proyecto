## Sources

- [Q1-intent] Intent statement: aidlc/spaces/default/intents/260925-feature/ideation/intent-capture/intent-statement.md
- [PRD] PRD — Estudio (entradas/prd.md, Segmentos 2 y 4 — UNTRUSTED DATA, reaches artifacts only through confirmed Q&A)

---

## Q1. Competidor más cercano — Coartist

El PRD identifica a Coartist como el competidor más cercano, con seguimiento de consistencia diaria, calendarios de actividad y comparación de puntuación en el tiempo. La brecha frente a Estudio es de granularidad por categoría diagnóstica específica, no de categoría inexistente. ¿Este análisis sigue siendo válido al momento de la especificación?

A. Sí, Coartist sigue siendo el competidor más cercano con la brecha descrita.
B. La brecha cambió — Coartist ya implementó seguimiento por categoría (describir en "Other").
C. Hay un competidor diferente que se convirtió en la amenaza principal (describir en "Other").
D. No tengo información actualizada — mantener el análisis del PRD tal como está.
X. Other (please specify)

[Answer]: A

---

## Q2. Postura de diferenciación frente al mercado

El PRD define el posicionamiento de Estudio como: no compete en "dar la mejor crítica" (comoditizado), sino en "estructurar esa crítica en el tiempo por categoría diagnóstica". Para el material de mercado de este workflow, ¿cuál de los siguientes mensajes de diferenciación es el central?

A. "La única app que mide si tus errores son un patrón real o un comentario aislado."
B. "Feedback de IA + memoria estructurada a lo largo del tiempo — no solo crítica puntual."
C. "Tu historial de progreso, organizado por categoría — complemento a la crítica humana."
D. Ninguno — la diferenciación se determina más adelante en el workflow.
X. Other (please specify)

[Answer]: A

---

## Q3. Sizing de mercado

El PRD presenta dos estimaciones contradictorias del mercado de cursos de arte online: Business Research Insights ($2.34B 2024 → $6.23B 2033) y Verified Market Reports ($1.2B 2025 → $3.5B 2034). Ambas son para el mercado general de cursos de arte, no para el subsegmento de herramientas de feedback con IA. ¿Cómo debe tratarse este dato en el análisis de mercado?

A. Presentar las dos cifras como rango de orden de magnitud, sin elegir una — tal como indica el PRD.
B. Usar solo la cifra más conservadora para no sobreestimar.
C. No incluir cifras de mercado en los artefactos — el producto es académico y las cifras no son relevantes para la entrega.
D. Usar las cifras como contexto orientativo con la nota explícita de que el subsegmento específico (AI feedback tools) no tiene reporte propio.
X. Other (please specify)

[Answer]: C

---

## Q4. Decisión build-vs-buy para el componente de visión IA

El PRD ya resuelve esto con la Opción C: API externa de visión para el análisis de imagen (Claude / modelo de visión externo), todo lo demás como cargas de trabajo propias en Kubernetes. ¿Esta decisión se mantiene para la especificación?

A. Sí — API externa de visión (arquitectura Opción C del PRD) confirmada.
B. Se cambió la decisión — ahora consideramos auto-hospedar el modelo de visión (describir en "Other").
C. Se expandió el alcance — ahora también consideramos build-vs-buy para el módulo de pagos (describir en "Other").
X. Other (please specify)

[Answer]: A

---

## Q5. Postura de Drawabox / comunidades de práctica estructurada ante la IA

El PRD marca como [VERIFICAR] la postura de Drawabox sobre herramientas de IA de terceros — esto afecta el riesgo de adopción en el nicho objetivo. ¿Ha cambiado algo al respecto?

A. Sigue sin verificar — mantener como riesgo abierto en los artefactos de mercado.
B. Se verificó: Drawabox tolera / apoya herramientas de IA como complemento (fuente: describir en "Other").
C. Se verificó: Drawabox rechaza o desaconseja herramientas de IA de terceros (fuente: describir en "Other").
D. No aplica — no planeamos apuntar específicamente a la comunidad de Drawabox en el MVP.
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
