# Ronda 1 — u12-T01

VEREDICTO: VERDE

## Criterios de aceptación, verificados por el revisor

| #   | Criterio                                                          | Comando que corrí                           | Resultado                            |
| --- | ----------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| 1   | shared-types/policy schema + barrel + tsc                         | test -f + grep + tsc --noEmit               | pasa (tsc exit 0)                    |
| 2   | policy.ts exporta router + menciona no-training y Settings/delete | greps CA-2                                  | pasa                                 |
| 3   | 401 unauthenticated                                               | `npm test -- --testPathPattern=policy`      | pasa (test 401 verde)                |
| 4   | 200 con content ≥50 chars                                         | tests policy + grep length                  | pasa                                 |
| 5   | PolicyResponseSchema.parse en test                                | grep en tests                               | pasa (parse + safeParse)             |
| 6   | Regresión u11 (onboarding/health)                                 | tests filtrados                             | pasa (18/18)                         |
| 7   | Cobertura handlers ≥80% líneas, ≥75% branches                     | coverage-summary                            | pasa                                 |
| 8   | lint                                                              | `npm run lint`                              | pasa (6 tareas OK)                   |
| 9   | docker build + sin `latest`                                       | `docker build ... -t trust-service:u12-T01` | pasa (Successfully built; no latest) |
| 10  | manifest diff sólo línea de imagen                                | git diff k8s/trust/deployment.yaml          | pasa (solo `-u11-T01`/`+u12-T01`)    |
| 11  | kind/kubectl/curl end-to-end                                      | **no ejecutado**, sin evidencia en bitácora | sin verificar                        |
| 12  | sin secretos en diff                                              | grep secretos                               | `no secrets in diff or tree`         |
| 13  | scope respetado                                                   | git diff --name-only                        | `scope respected`                    |
| 14  | rama + ≥2 commits                                                 | `git log main..HEAD`                        | pasa (2 commits en `tarea/u12-T01`)  |

## Hallazgos

### H-01 · AMARILLO · CA-11 · Despliegue end-to-end en kind no verificado

La bitácora declara que CA-11 no puede verificarse sin kind activo pero no aporta ni un comando
ejecutado ni output. Dockerfile compila (CA-9 verde), los tests HTTP cubren el camino feliz con
supertest, y los manifiestos están bien formados; por eso no es ROJO. Queda la promesa sin
evidencia: `kind load`, `kubectl apply`, `kubectl rollout status`, `kubectl port-forward`, `curl`.
AMARILLO conforme a las instrucciones de revisión; no bloquea por sí solo.

## Tareas candidatas (defectos reales fuera de alcance)

Ninguna.
