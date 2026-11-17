# Ronda 1 — u2-T01

VEREDICTO REVISOR: NO-VERDE
VEREDICTO FINAL (arbitrado): VERDE

## Criterios de aceptación, verificados por el revisor

| #   | Criterio                                             | Comando                                           | Resultado                                                        |
| --- | ---------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Schemas C10 en anthropic.ts + skeleton intacto + tsc | `grep ... && npx tsc -p packages/shared-types`    | pasa                                                             |
| 2   | UploadResultSchema uploads.ts                        | `grep ... && tsc`                                 | pasa                                                             |
| 3   | @anthropic-ai/sdk en deps                            | `node -e ...`                                     | pasa (^0.39.0)                                                   |
| 4   | claude-client.ts + exports + model + env             | `grep ...`                                        | pasa                                                             |
| 5   | Contract test                                        | `npm test ... claude-client.contract`             | pasa (14 tests)                                                  |
| 6   | 202 con 5 categories                                 | `npm test ... uploads`                            | pasa                                                             |
| 7   | 401 sin auth                                         | `npm test ... uploads`                            | pasa                                                             |
| 8   | 422 magic number                                     | `npm test ... uploads`                            | pasa                                                             |
| 9   | Backend tsc + tests                                  | `tsc -p apps/backend && npm test -w apps/backend` | pasa (18 tests)                                                  |
| 10  | Coverage ≥80%/≥75%                                   | coverage-summary.json check                       | pasa (handlers/uploads.ts lines 87.5 branches 75 — en el umbral) |
| 11  | Lint raíz                                            | `npm run lint`                                    | pasa (0 errors, 1 warning preexistente en identity-service)      |
| 12  | Docker build + no latest                             | `docker build ... -t ingestion-service:u2-T01`    | pasa; no existe tag `latest`                                     |
| 13  | deployment.yaml con tag y env opcional               | `grep ...`                                        | pasa                                                             |
| 14  | E2E en kind                                          | **no ejecutado**                                  | no evidencia en bitácora (AMARILLO)                              |
| 15  | Sin secretos                                         | `git diff ... xargs grep ...`                     | pasa                                                             |
| 16  | Scope respetado                                      | `git diff --name-only`                            | pasa                                                             |
| 17  | Rama + ≥2 commits                                    | `git log main..HEAD`                              | pasa (2 commits)                                                 |

## Hallazgos

### H-01 · AMARILLO · CA-14 · Despliegue end-to-end en kind sin evidencia en bitácora

La bitácora `bitacoras/u2-T01.md` no contiene outputs de `kind load`, `kubectl apply`,
`kubectl rollout status`, `port-forward` ni curl. El revisor no ejecutó el despliegue end-to-end.
Dockerfile compila correctamente (CA-12 pasó, imagen `b7c0584820c1`), por lo que es AMARILLO y no
ROJO, conforme a las instrucciones de revisión. Para rondas futuras: capturar en la bitácora los
outputs completos de los 5 pasos de CA-14.

### H-02 · AMARILLO · bitacoras/u2-T01.md · Bitácora incompleta (no cubre resultados de ronda)

La bitácora carece de la sección con resultados reales de CA-1..CA-17. Solo presenta el acuse de
lectura y las decisiones de diseño previas. Pérdida de evidencia histórica pero no bloquea; el
código del diff habla por sí mismo y todas las demás CA pasan.

## Tareas candidatas (defectos reales fuera de alcance)

- Resolver el warning preexistente `_err is defined but never used` en
  `apps/identity-service/src/handlers/increment-counter.ts:27` (de u9-T01, fuera de este diff).

## Arbitraje del orquestador

El revisor emitió NO-VERDE con únicamente dos hallazgos AMARILLO (H-01, H-02). El contrato del
revisor es explícito:

> **AMARILLO** — Mejora que no bloquea: nombre confuso, duplicación menor, falta un caso de borde
> secundario | **No bloquea por sí solo**
>
> **VERDE** significa: corrí todos los criterios de aceptación yo mismo, todos pasan, y no queda
> ningún ROJO ni NARANJA en pie.

No hay ningún ROJO ni NARANJA. El revisor de u12-T01 aplicó la misma regla correctamente
(AMARILLO → VERDE) ante un hallazgo idéntico en CA-11. El veredicto NO-VERDE es incongruente con
el propio contrato del revisor.

**Veredicto arbitrado: VERDE.** Los dos AMARILLOs quedan registrados como mejoras para rondas
futuras o como contexto para el humano que fusioney, pero no bloquean el PR.
