## Sources

- [comp] inception/domain-design/components.md
- [backlog] ideation/scope-definition/intent-backlog.md
- [dec-log] ideation/approval-handoff/decision-log.md

---

## Q1. ¿Hay proto-units que deben agruparse en una sola unidad de construcción?

Los 13 proto-units pueden construirse individualmente o algunos pueden agruparse porque son demasiado pequeños para ser unidades independientes. ¿Cómo quieres agruparlos?

A. 13 unidades individuales — construir cada proto-unit por separado, como están definidos en el backlog.
B. Agrupar por afinidad dentro del mismo servicio: M1 se construye como 2 unidades (ingesta+análisis / fallback+almacenamiento); M2 como 2 (historial / tendencias); M3 como 2 (auth+límites / upgrade); M4 como 1 (todo el módulo de confianza). Total: 7 unidades.
C. Agrupar por servicio: 4 unidades (una por servicio: IngestionService, ProgressService, IdentityService, TrustService) + 1 Frontend. Total: 5 unidades.
D. La granularidad del backlog (13 proto-units) es correcta — no agrupar.
X. Other (please specify)

[Answer]: A

---

## Q2. ¿El Frontend es una unidad de construcción independiente o es parte del esqueleto inicial?

A. Unidad independiente — el Frontend se construye como un Bolt separado después de que los servicios backend estén funcionales.
B. Parte del walking skeleton — el Frontend existe desde el primer Bolt como una capa thin conectada a los stubs de los servicios.
C. Se construye de forma incremental — las pantallas del Frontend se añaden a medida que se completan los servicios que las sustentan.
D. Sin opinión — el arquitecto de entrega lo decide en Delivery Planning.
X. Other (please specify)

[Answer]: B

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
