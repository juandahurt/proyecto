# Ronda 2 — u3-T01

VEREDICTO: VERDE

Los 17 criterios pasan con mis propias ejecuciones. F-01 (NARANJA) está resuelto y el compilador lo hace cumplir. F-02, F-03 y F-04 están cubiertos por tests que corrí. No queda ningún ROJO ni NARANJA. Quedan dos AMARILLO, que no bloquean.

**Contexto comprobado:**

- **Tarea:** `git hash-object` da `79ceb476…`, coincide con el blob indicado.
- **Rama:** `tarea/u3-T01`, HEAD `c1fb542`, merge-base `72a501f`. Son 3 commits.
- **Main avanzó a `228ac4f`**, pero desde la base solo cambiaron `CANDIDATAS.md` y `revisiones/u3-T01/ronda-1.md`. Por eso esos dos archivos aparecen en `git diff main..HEAD`. Con `main...HEAD` no aparecen, así que no son desborde.
- **Paquetes:** antes de empezar recompilé `packages/shared-types` y `packages/auth-middleware`, cuyo `dist` está ignorado por git.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                          | Comando que corrí                                                                                                                        | Resultado                                                                                                                              |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AIE + kinds + tsc                                 | greps de CA-1; `npx tsc --noEmit -p apps/ingestion-service`                                                                              | pasa, exit 0                                                                                                                           |
| 2   | resolveCritique                                   | `npm test -w apps/ingestion-service -- --testPathPattern=critique-outcome --no-coverage --verbose`                                       | pasa, 12/12, 0,98 s                                                                                                                    |
| 3   | rama real del SDK + `CLAUDE_TIMEOUT_MS`           | ídem con `claude-client.real`                                                                                                            | pasa, 17/17 (antes 16; +InternalServerError), 0,93 s                                                                                   |
| 4   | LOW → 202 `low_confidence` sin `categories`       | ídem con `uploads-http`                                                                                                                  | pasa                                                                                                                                   |
| 5   | invalid_schema ×2, timeout, network, bad-response | ídem                                                                                                                                     | pasa, los 5                                                                                                                            |
| 6   | MEDIUM y HIGH → ready; error ajeno → 500          | ídem                                                                                                                                     | pasa (ahora también afirma `body.status === 500`)                                                                                      |
| 7   | registro en BD también en fallback                | ídem                                                                                                                                     | pasa, 17/17 en la suite, 1,29 s                                                                                                        |
| 8   | 401/422/413 + backend                             | ídem; `npx tsc --noEmit -p apps/backend`; `npm test -w apps/backend -- --no-coverage`                                                    | pasa: tsc exit 0, backend 18/18                                                                                                        |
| 9   | cobertura ≥80% líneas / ≥75% ramas por archivo    | comando de CA-9                                                                                                                          | pasa, imprime `coverage ok …`. 89 tests en 9 suites. uploads.ts 89,09/77,77; claude-client, critique-outcome y anthropic-error 100/100 |
| 10  | lint + Prettier                                   | `npx turbo run lint --force` (0 cached de 6, exit 0); `npm run lint`; `npm run lint -w apps/ingestion-service`; `npx prettier --check …` | pasa. Prettier sin pendientes                                                                                                          |
| 11  | `packages/` intacto                               | comando de CA-11                                                                                                                         | pasa: `packages untouched`                                                                                                             |
| 12  | manifiestos                                       | greps de CA-12                                                                                                                           | pasa: tag `u3-T01`, tag viejo ausente, `'30000'`, `anthropic-key` intacto                                                              |
| 13  | imagen construida, sin `latest`                   | `docker build …`; `docker image inspect`                                                                                                 | pasa, detalle debajo                                                                                                                   |
| 14  | kind: imagen, ConfigMap, Ready y camino feliz     | lectura de vuelta con `kubectl`/`crictl`, `kubectl exec`; port-forwards a 3200/3100, register, POST                                      | pasa, detalle debajo                                                                                                                   |
| 15  | sin secretos                                      | comandos de CA-15                                                                                                                        | pasa: `no secrets in diff or tree`                                                                                                     |
| 16  | alcance                                           | comandos de CA-16 + lista del diff de tres puntos                                                                                        | pasa: `scope respected`                                                                                                                |
| 17  | rama y commits                                    | `git rev-parse`; `git log main..HEAD`                                                                                                    | pasa: `tarea/u3-T01`, 3 commits legibles                                                                                               |

**CA-13, la imagen:** el build salió entero de caché sobre el árbol actual, con id `sha256:74b5f630…`, igual antes y después. La imagen se creó a las 15:20:18 −05:00, después del commit c1fb542 (15:19:55).

**CA-14, todo leído de vuelta del cluster, sin modificarlo:**

- **Deployment:** imagen `ingestion-service:u3-T01`, generation 5 = observedGeneration, `restartedAt` 15:20:20.
- **ConfigMap y pod:** el ConfigMap da `30000` y `printenv` en el pod también.
- **Pod:** `tq4kd`, creado a las 20:20:21Z, `ready=true`.
- **Imagen que corre de verdad:** el `crictl inspecti` del nodo da `7b29928b…`, igual al Config de `docker save ingestion-service:u3-T01` del árbol actual.
- **Marcador de ronda 2:** el `dist/handlers/uploads.js` del pod contiene `const body = {` y `res.status(202).json(body)`. Ese código no existía en `0738512`.
- **Camino feliz:** el usuario de la receta (`test@example.com`) no existe, así que registré `revisor-u3-r2@example.com` (201). El POST devolvió 202 `ready` HIGH con 5 categorías y sin `fallbackReason`; el check dio `happy path ok`.
- **Limpieza:** no hice `kind load`, `apply` ni rollout. Cerré mis dos port-forwards.

Tiempos: suites de ~1 s, unitarias o en SQLite en memoria, sin estado externo; el tiempo cuadra. No hay `skip`, `only`, `todo` ni `xit` en `apps/ingestion-service/src`.

## Verificación de los hallazgos de la ronda 1

- **F-01, resuelto:**
  - **Tipo derivado:** `critique-outcome.ts:9` es ahora `FallbackReason = NonNullable<UploadResult['data']['fallbackReason']>`.
  - **Body tipado:** el body de fallback en `handlers/uploads.ts:162-171` lleva `satisfies UploadResult`.
  - **Sonda de tipos propia:** la escribí en el scratchpad, sin tocar el worktree, y ya la borré. `FallbackReason` es exactamente igual a las 3 razones de C1. `satisfies` rechaza `status:'lowconfidence'` (TS2820) y `FallbackReason` rechaza `'api_error'` (TS2322).
  - **Barrido** con `grep -rnE "low_confidence|invalid_schema|'timeout'|'LOW'|'ready'|…"` en `src/service` y `src/handlers`. Todos los literales de contrato que quedan los comprueba el compilador contra tipos `z.infer`: los `reason` del tipo de retorno, `parsed.data.confidence === 'LOW'` y el body tipado. Los `kind` de `AnthropicIntegrationError` son locales por diseño. La única excepción es el body `ready` (ver F-06).
- **F-02, cubierto:** el mock expone `InternalServerError` con `status = 500`, y el test «kind network — InternalServerError (5xx) del SDK» pasa. Se conserva el caso genérico.
- **F-03, cubierto:** se añadió `expect(res.body.status).toBe(500)` y el test pasa.
- **F-04, cubierto:** el test espía `console.warn`, exige 1 llamada con 1 argumento exacto `[uploads] low_confidence uploadId=<id> reason=low_confidence_flag`, e inyecta `secretRaw`. Pasa.

## Warning de lint que reporta el codificador

No es del diff, y la atribución a ingestion-service no se sostiene. Con `npx turbo run lint --force` ingestion-service sale limpio, y `npm run lint -w apps/ingestion-service` da exit 0 sin salida de ESLint. El único warning es `apps/identity-service/src/handlers/increment-counter.ts:27:14 '_err' is defined but never used` (0 errores). identity-service no aparece en `git diff main...HEAD`; viene de u9 en main.

## Hallazgos

### F-05 · AMARILLO · bitacoras/u3-T01.md («Verde (ronda 2)») · La reconstrucción y el rollout de la ronda 2 no constan en la bitácora

La sección de ronda 2 no registra `docker build`, el id de imagen, `rollout restart/status` ni la lectura de vuelta con `kubectl`. Sin embargo, el cluster muestra una imagen y un pod nuevos posteriores a c1fb542, y el orquestador lo afirma. Lo verifiqué yo, así que no bloquea, pero la afirmación no tiene comando ni salida en la bitácora.

### F-06 · AMARILLO · apps/ingestion-service/src/handlers/uploads.ts:186-195 · El body `ready` sigue sin `satisfies UploadResult`

Es código heredado de main (líneas 160-163 de main) y el diff no lo toca, así que no cuenta como defecto del diff. Queda asimétrico con el body de fallback: `status:'ready'` no lo comprueba el compilador.

## Tareas candidatas (defectos reales fuera de alcance)

- Tipar con `satisfies UploadResult` el body `ready` de `handlers/uploads.ts` (F-06).
- Quitar el warning `_err` sin usar en `apps/identity-service/src/handlers/increment-counter.ts:27`.
- Siguen en pie las de la ronda 1: `maxRetries: 0` en el SDK (C10 «No retry»), la razón `api_error` y el port-forward huérfano `svc/trust-service 3300` (PID 4456, de una ola anterior; sigue vivo).
- La receta de CA-14 asume un usuario `test@example.com` que ya no existe en el cluster. Conviene usar `register` por defecto.

## Estado del worktree

`git status --short` sale vacío al terminar. Solo hay artefactos ignorados: `.turbo`, `coverage`, `dist`, `node_modules`. En el cluster solo añadí datos: un usuario `revisor-u3-r2@example.com` y un upload `95882dfb-…`.

## Rutas de transcripciones largas

- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2-critique-outcome.txt
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2-claude-client.real.txt
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2-uploads-http.txt
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2-lint.txt
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/u3-r2-upload.json

```
VEREDICTO: VERDE
AMARILLO|bitacoras/u3-T01.md (Verde ronda 2)|Rebuild y rollout de la ronda 2 sin comando ni salida en la bitácora (verificado por el revisor)
AMARILLO|apps/ingestion-service/src/handlers/uploads.ts:186|Body ready heredado sin satisfies UploadResult (fuera del diff, candidata)
INFORME: revisiones/u3-T01/ronda-2.md
```
