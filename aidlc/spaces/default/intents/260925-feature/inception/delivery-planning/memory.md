<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-02T00:00:00Z — Critical-path-first y risk-first convergen en este proyecto: la ruta crítica del DAG (u1→u2→...→u7) pasa exactamente por la integración con Claude Vision API (el mayor riesgo técnico). No fue necesario elegir entre las dos heurísticas.
- 2026-10-02T00:00:00Z — El walking skeleton (Bolt 1) agrupa u0-frontend + u8-authentication excepcionalmente porque ambas son sin dependencias y juntas forman el mínimo viable arquitectónico para que cualquier otra unidad pueda testearse de extremo a extremo.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-02T00:00:00Z — Una unidad por Bolt (Q2=A) da máxima granularidad (13 Bolts). El coste es que el journey completo no está disponible hasta el Bolt 9; el beneficio es que cada Bolt es aprobable y reversible de forma independiente.
- 2026-10-02T00:00:00Z — Stub responses de Claude para desarrollo local (Q3=A) hace los tests unitarios deterministas y elimina la dependencia de la API real en el ciclo de dev; solo el test de contrato requiere la API real.
- 2026-10-02T00:00:00Z — Los Bolts B10-B12 podrían ordenarse de forma arbitraria (sus dependencias están satisfechas tras B1/B8); se priorizó onboarding (B10) por ser un gate de usuario antes del primer upload.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
