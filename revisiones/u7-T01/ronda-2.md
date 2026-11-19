# Ronda 2 — u7-T01

VEREDICTO: VERDE

F-01 está resuelto de verdad. Repetí M6 y M7 en una copia y ahora las detecta el test. Además probé 37 mutaciones nuevas sobre el silencio de logs: todas las que entran en lo que exige CA-9 fallan. Las seis que sobreviven quedan fuera de la letra del criterio y van como AMARILLO. No queda ningún ROJO ni NARANJA.

**Comprobaciones previas:**

- Tarea: el blob `07e599fc…` y el sha256 `01e077e5…` coinciden con `main`.
- Worktree `/Users/aureliano/Desktop/proyecto-u7-T01` en HEAD `1678cfe`. Corrí `npm ci` y compilé `shared-types` y `auth-middleware`.
- `git status --short` está vacío al empezar y al terminar: el worktree queda limpio.
- Todas las mutaciones las hice en una copia aparte, `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/rev-u7-T01-r2/copia`. Al final la comparé con `diff -rq` contra el worktree y es idéntica.

## Alcance de la ronda (punto 3)

- `git diff 7f8fd76..HEAD --name-only` lista solo `apps/progress-service/src/__tests__/trends.test.ts` y `bitacoras/u7-T01.md`.
  - El commit `371d1a9` toca solo el test y el `1678cfe` solo la bitácora.
- El diff de producción entre `main` y HEAD no cambió desde la ronda 1. Comparé el diff sin tests ni bitácora con `shasum`, y da el mismo resultado contra `7f8fd76` y contra HEAD: `6d7d8a69…`. No hay cambios en `k8s/` ni en `shared-types`.
- El cluster, solo con `kubectl get`:
  - Deployment: `progress-service:u7-T01 RollingUpdate`, gen 3 = observada 3.
  - Pod: el mismo `progress-service-5db475b77f-fg6rf` de la ronda 1 (creado a las 15:19:28Z), `ready=true restarts=0`.
  - ConfigMap: `http://identity-service:3100 5000`.
  - Identity, ingestion, trust y backend siguen con los mismos pods.

## Criterios de aceptación, verificados por mí

| #        | Comando que corrí                                                                                     | Resultado                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | los 4 comandos de CA-1                                                                                | pasa: el diff solo toca `trends.ts`, aparecen los `z.infer`, sale «sin enums duplicados» y «tsc shared-types ok»                                          |
| 2 a 7, 9 | `npm test … trend-response trends identity-client --coverage=false --verbose` y los `grep` de cada CA | pasa: 71/71 y `Test Suites: 3 passed`. CA-9 tiene ahora 2 casos de camino feliz, 13 de fallo y un control del fixture                                     |
| 8        | `npm test … server` y `grep`                                                                          | pasa: 14/14 y `server.ts:37 loadTrendConfig(process.env)`                                                                                                 |
| 10       | `grep` de rutas, `wc -l` y la suite completa                                                          | pasa: 4 rutas; `wc -l` da 0; `Tests: 171 passed`, `Test Suites: 9 passed`, en 2,7 s; ningún skip, only ni todo                                            |
| 11       | los 4 servicios, `turbo` y `prettier`                                                                 | pasa: ingestion 206/11, identity 74/12, trust 25/4, backend 18/4 (igual que en `main`); `Tasks: 14 successful`, `0 cached`; prettier limpio sobre el diff |
| 12       | `--coverage`                                                                                          | pasa: All files 100/98,33; `service` en ramas 97,77; `handlers` 100; `trend-response.ts` al 100 %; `jest.config` sin cambios (0)                          |
| 13       | `grep` sobre el diff                                                                                  | pasa: «sin cambios de dependencias»                                                                                                                       |
| 14       | los `grep` estáticos                                                                                  | pasa: solo cambian `configmap` y `deployment`; ningún `FALLO`; el diff se limita a tag y variables de identity                                            |
| 15       | lectura con `kubectl get`                                                                             | verificado en la ronda 1; sin cambios de producción desde entonces                                                                                        |
| 16       | —                                                                                                     | verificado en la ronda 1 con el E2E real; no lo repetí, por las instrucciones y porque la producción no cambió                                            |
| 17       | los 2 comandos                                                                                        | pasa: «no secrets in diff» y «no secrets in diff or tree»; 0 JWT en la bitácora                                                                           |
| 18       | `git diff`, `git log` y `git show`                                                                    | pasa: los 14 archivos permitidos; 6 commits atómicos; ninguno trae el shard `typewriter`                                                                  |

En CA-14 no corrí `kubectl apply --dry-run=server`. El encargo prohíbe cualquier `apply` y en esta ronda solo me autoriza `kubectl get`. Los manifiestos son idénticos byte a byte a los de la ronda 1, donde el servidor los aceptó.

## Mutaciones

Las corrí sobre la copia con `trends identity-client trend-response`. Ninguna dio error de TypeScript, así que todos los fallos son de aserción. Comprobé con los `●` de cada salida que los tests que fallan son los de silencio de logs.

**Detectadas (31):**

- **Las de la ronda 1:**
  - **M7**: JWT en la rama de schema inválido; fallan 2 tests.
  - **M6**: scores en el log; falla 1.
  - **M6b**: timestamps en el log; falla 1. La detecta, de rebote, el patrón numérico del 10.
- **`identity-client.ts`, cada rama**, escribiendo el `Authorization` en el log:
  - en el `catch` de `fetch`, en la rama 401, en la de no-200, en el `catch` del JSON y en la de éxito;
  - con el JWT sin el `Bearer`;
  - con el `sub` decodificado del JWT;
  - con `process.stdout.write` en la rama 401.
- **`handlers/trends.ts`:** el userId o el `Authorization` en cada uno de los 4 tipos de fallo, tanto de identity como de ingestion (8 mutaciones). Así compruebo que los 13 casos de fallo llegan de verdad a su rama.
- **Camino feliz:** userId, `result.trends` en JSON, uploadIds, timestamps, scores con `stdout.write`, y un log del `Authorization` diferido con `setTimeout`.
- **`trend-response.ts`:** el `calc` en la rama `free`, y los uploadIds con `stdout`.
- **`server.ts`:** un middleware que escribe el `Authorization`, otro que escribe todas las cabeceras con `stdout`, y un log de `req.user.userId` después de `requireAuth`.

**Sobreviven (8):** van en F-05. Las dos últimas no son defecto:

- I8 y I10: el segmento del payload y el de la firma del JWT.
- Las direcciones en mayúsculas.
- `slope`.
- `process.stderr.write` con el `Authorization`.
- `categoryName` con `uploadsNeeded`.
- `categoryName`, el tier y `originalUrl` en el log: CA-9 no los pide y no son datos sensibles, así que no son hallazgo.

El detalle está en `mutaciones.txt` y en los `out-*.txt` (rutas abajo).

## Hallazgos

### F-05 · AMARILLO · `trends.test.ts` (`expectSilentLogs`) · huecos residuales del espía, fuera de la letra de CA-9

Agrupo en este hallazgo toda la clase:

- Las cadenas de dirección se comparan distinguiendo mayúsculas, y `IMPROVING` sobrevive.
- Solo se busca el JWT completo: los segmentos del payload (que lleva el `sub` en base64) o de la firma sobreviven.
- No se espía `process.stderr.write`.
- `slope` no se comprueba.

CA-9 enumera el JWT, `Bearer`, el userId, los uploadIds, los scores, las direcciones en minúsculas y `stdout`, y todo eso sí lo cubre el test. Endurecerlo sale barato: comparar sin distinguir mayúsculas, buscar cada segmento del JWT y espiar también `stderr`.

### F-06 · AMARILLO · `trends.test.ts` (`it.each(failures)`) · los escenarios de fallo no afirman el status

Si un fixture deja de llegar a su rama, el test de silencio pasaría sin probar nada. Hoy no ocurre: las 8 mutaciones por tipo de fallo y las 6 por rama del cliente de identity demuestran que cada escenario llega a donde debe. Añadir `expect(res.status)` en cada caso lo dejaría blindado.

### F-02, F-03 y F-04 (de la ronda 1)

Siguen en pie como AMARILLO, sin cambios. F-02 pasó a la candidata C-66 y F-04 a la C-63. F-03 quedó aceptado.

**El fixture no da falsos negativos.** Los scores 71, 83 y 97 no chocan con ningún otro número del cuerpo: los uid usan dígitos del 1 al 6, los timestamps son `2026-11-0nT10…` y `uploadsNeeded` vale poco. La expresión `(^|\D)n(\D|$)` no da falsos positivos con `status=503` ni con `401`. El test de control `toContain('97')` es débil, pero en ese cuerpo no hay otro 97.

## Tareas candidatas (defectos reales fuera de alcance)

- Las de la ronda 1 siguen abiertas: el `isTimeout` y el mapeo fallo → HTTP compartidos (C-63), el mapa de nombres de categoría de `claude-client.ts` y los usuarios E2E `rev-u7t01-*@rev.test`, que siguen en identity.
- La política de logs de progress-service no cubre `stderr` ni fragmentos del JWT. Si se quiere un estándar común, conviene un helper de silencio de logs compartido entre `history.test.ts` y `trends.test.ts`.

## Rutas de transcripciones largas

Todas en `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/`:

- `rev-u7-T01-r2/ca2-9.txt`
- `rev-u7-T01-r2/full.txt`
- `rev-u7-T01-r2/cov.txt`
- `rev-u7-T01-r2/turbo.txt`
- `rev-u7-T01-r2/mutaciones.txt`
- `rev-u7-T01-r2-scripts/mut.js`
- `rev-u7-T01-r2-scripts/gen.js`
- `rev-u7-T01-r2-scripts/muts.json`
- `rev-u7-T01-r2-scripts/out-*.txt`

```
VEREDICTO: VERDE
AMARILLO|apps/progress-service/src/__tests__/trends.test.ts (expectSilentLogs)|huecos residuales del espía fuera de la letra de CA-9: mayúsculas, segmentos del JWT, stderr, slope (F-05); escenarios de fallo sin afirmar el status (F-06)
INFORME: revisiones/u7-T01/ronda-2.md
```
