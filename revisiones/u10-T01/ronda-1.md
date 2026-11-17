# Ronda 1 — u10-T01

VEREDICTO: VERDE

## Criterios de aceptación, verificados por el revisor

| #   | Criterio                                                      | Comando que corrí                        | Resultado                                                                        |
| --- | ------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Tabla subscriptions + users/upload_counters sin cambios       | grep + diff vs main                      | pasa                                                                             |
| 2   | subscription-repository.ts con getTier, upgradeToPaid, UPSERT | grep                                     | pasa                                                                             |
| 3   | GET /limits free                                              | jest limits                              | pasa (free + uploadsRemaining=10)                                                |
| 4   | POST subscribe 401 sin auth                                   | jest subscribe                           | pasa                                                                             |
| 5   | POST subscribe 200 → tier:paid + SELECT readback              | jest subscribe                           | pasa                                                                             |
| 6   | GET /limits tras subscribe → paid                             | jest subscribe                           | pasa                                                                             |
| 7   | Idempotencia                                                  | jest subscribe                           | pasa (dos tests)                                                                 |
| 8   | Regresión u8/u9                                               | jest auth+limits+increment               | pasa (72/72 total)                                                               |
| 9   | Cobertura service/ + handlers/ ≥80/75                         | script coverage-summary                  | pasa                                                                             |
| 10  | Lint                                                          | `npm run lint`                           | exit 0 (0 errors, 1 warning preexistente en increment-counter.ts fuera del diff) |
| 11  | docker build identity-service:u10-T01, sin latest             | docker build + inspect                   | sha256:7c78b5d476…; latest ausente                                               |
| 12  | k8s/identity/deployment.yaml diff limitado al tag             | git diff + node check                    | pasa                                                                             |
| 13  | E2E kind: before=free, subscribe=paid, after=paid             | curl + node asserts (artefactos en /tmp) | pasa (artefactos /tmp/u10-{before,subscribe,after}.json)                         |
| 14  | No secretos                                                   | grep sk-ant/API_KEY/JWT_SECRET           | `no secrets in diff or tree`                                                     |
| 15  | Scope respetado                                               | git diff name-only                       | ningún archivo fuera del scope                                                   |
| 16  | Rama tarea/u10-T01 ≥2 commits                                 | git log                                  | 3 commits legibles                                                               |

## Hallazgos

Ninguno de severidad ROJO/NARANJA/AMARILLO.

Observaciones no bloqueantes:

- Warning de ESLint en `apps/identity-service/src/handlers/increment-counter.ts:27` (`_err` no
  usado) es preexistente de u9-T01, fuera del alcance de este diff.
- Worktree limpio al final de la revisión, cadena de evidencia intacta.
- Shape `{data,error,status}` correcto tanto en 200 como en 401 en tests y artefactos de CA-13.
- Zod/`z.infer<>` y tipos compartidos: el diff no toca `packages/shared-types/` ni duplica tipos;
  `LimitsResponseSchema` existente ya cubre `tier: "free"|"paid"` con nullables.
- UPSERT con `ON CONFLICT(user_id) DO UPDATE` presente y verificado como idempotente por dos tests.

## Tareas candidatas (defectos reales fuera de alcance)

Ninguna.
