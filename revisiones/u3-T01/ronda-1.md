# Ronda 1 — u3-T01

VEREDICTO: NO-VERDE

Los 17 criterios de aceptación pasan con mis propias ejecuciones. Queda en pie un solo hallazgo NARANJA: el tipo del enum de contrato `fallbackReason` está escrito a mano en lugar de derivarse del schema Zod compartido.

Contexto comprobado: tarea con blob `79ceb476…` (coincide con `git hash-object`). Worktree `/Users/aureliano/Desktop/proyecto-u3-T01`, rama `tarea/u3-T01`, HEAD `0738512`, merge-base `72a501f` (= main). Antes de empezar compilé `packages/shared-types` y `packages/auth-middleware`. Ya existía un `dist` de una corrida anterior, así que no puedo confirmar ni descartar la nota del codificador de que en limpio hace falta compilarlos.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                              | Comando que corrí                                                                                                                                                                                  | Resultado                                                                                                                    |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | AnthropicIntegrationError + kinds + tsc               | greps de CA-1; `npx tsc --noEmit -p apps/ingestion-service`                                                                                                                                        | pasa (exit 0)                                                                                                                |
| 2   | resolveCritique, ≥8 casos                             | `npm test -w apps/ingestion-service -- --testPathPattern=critique-outcome --no-coverage --verbose`                                                                                                 | pasa, 12/12                                                                                                                  |
| 3   | rama real con SDK mockeado, kinds + CLAUDE_TIMEOUT_MS | `... --testPathPattern=claude-client.real ...`                                                                                                                                                     | pasa, 16/16 (valor válido, ausente, abc, 0, -5 y 1.5, vía spy en `AbortSignal.timeout`)                                      |
| 4   | LOW → 202 low_confidence sin `categories`             | `... --testPathPattern=uploads-http --verbose`                                                                                                                                                     | pasa (`not.toHaveProperty('data.categories')` + `UploadResultSchema.safeParse`)                                              |
| 5   | invalid_schema ×2, timeout, network, bad-response     | ídem                                                                                                                                                                                               | pasa, los 5 en verde                                                                                                         |
| 6   | MEDIUM ready, HIGH ready, no-AIE → 500                | ídem                                                                                                                                                                                               | pasa                                                                                                                         |
| 7   | registro en BD también en fallback                    | ídem                                                                                                                                                                                               | pasa: `countByUserId` = 1 y `findById` no es null, contra SQLite `:memory:` real                                             |
| 8   | regresiones 401/422/413 + backend                     | ídem; `npx tsc --noEmit -p apps/backend`; `npm test -w apps/backend -- --no-coverage`                                                                                                              | pasa: tsc exit 0, backend 18/18                                                                                              |
| 9   | cobertura por archivo ≥80% líneas y ≥75% ramas        | comando de CA-9                                                                                                                                                                                    | pasa: `coverage ok …`; uploads.ts 88.88/77.77; claude-client, critique-outcome y anthropic-error 100/100; 87 tests, 9 suites |
| 10  | lint + prettier                                       | `npm run lint`; repetido con `npx turbo run lint --force` porque el primero salió de caché («FULL TURBO», 21 ms); `npm run lint -w apps/ingestion-service`; `npx prettier --check …`               | pasa: exit 0 sin caché, 0 cached de 6; Prettier limpio                                                                       |
| 11  | packages/ intacto                                     | comando de CA-11                                                                                                                                                                                   | pasa: `packages untouched`                                                                                                   |
| 12  | manifiestos                                           | greps de CA-12                                                                                                                                                                                     | pasa: tag `u3-T01`, tag viejo ausente, `CLAUDE_TIMEOUT_MS: '30000'`, `anthropic-key` intacto                                 |
| 13  | imagen construida, sin latest                         | `docker build …`; `docker image inspect`                                                                                                                                                           | pasa: id `c25d2e4049ff` (toda la build salió de caché con el árbol actual, mismo id que la bitácora); `no latest tag`        |
| 14  | kind: Ready, imagen, ConfigMap y camino feliz         | lectura de vuelta con `kubectl get deployment/configmap/pods`, `crictl inspecti` en el nodo, `kubectl exec printenv` y grep en `dist`; port-forward 3200/3100, register, POST con JPEG, check node | pasa (detalle debajo)                                                                                                        |
| 15  | sin secretos                                          | comandos de CA-15                                                                                                                                                                                  | pasa: `no secrets in diff or tree`                                                                                           |
| 16  | alcance                                               | comandos de CA-16 + lista blanca completa del diff                                                                                                                                                 | pasa: `scope respected`; solo hay archivos permitidos                                                                        |
| 17  | rama y commits                                        | `git rev-parse`; `git log main..HEAD`                                                                                                                                                              | pasa: `tarea/u3-T01`, 2 commits legibles                                                                                     |

Detalle de CA-14, todo leído de vuelta del cluster:

- **Imagen del deployment:** `ingestion-service:u3-T01`.
- **ConfigMap:** `CLAUDE_TIMEOUT_MS` vale `30000`, y `printenv` en el pod también da `30000`.
- **Pod:** `ready=true`.
- **Imagen que corre de verdad:** el digest de config en kind es `sha256:17ab610b…`, el mismo que el Config de `docker save ingestion-service:u3-T01`. El `dist/handlers/uploads.js` del pod contiene `low_confidence`.
- **Camino feliz:** el POST devolvió 202 `ready` HIGH con 5 categorías, y el check dio `happy path ok`.
- **Cluster:** no hice `kind load` ni `apply` porque el cluster ya tenía exactamente esta imagen. No lo modifiqué.
- **Port-forwards:** cerré los dos que abrí.

Tiempos: las suites tardan 0,6–2,3 s. Son unitarias o en memoria y no dependen de estado externo, así que el tiempo cuadra. No hay `skip`, `only` ni `todo` en `apps/ingestion-service/src`.

## Hallazgos

### F-01 · NARANJA · apps/ingestion-service/src/service/critique-outcome.ts:4 (+ :30,:31,:37,:39; handlers/uploads.ts:161-169) · El enum de contrato `fallbackReason` está duplicado a mano y no se deriva de Zod

- **Qué pasa:** `export type FallbackReason = 'low_confidence_flag' | 'invalid_schema' | 'timeout';` copia literalmente `UploadResultSchema.data.fallbackReason` de `packages/shared-types/src/uploads.ts`.
- **Reglas que rompe:** dos reglas afirmadas en `project.md`: «NEVER duplicar tipos TypeScript de contratos entre servicios» y «ALWAYS … tipos derivados de Zod mediante `z.infer<>`». Además, por la invariante 8, los valores visibles para el usuario (`'invalid_schema'`, `'timeout'`, `'low_confidence_flag'`) aparecen como literales en puntos de decisión sin conexión con su fuente.
- **En el handler:** el body de fallback (`status:'low_confidence'`, `confidence:'LOW'`, `fallbackReason`) es un objeto sin tipo. Si C1 cambia, `tsc` no se queja; solo lo detectaría el `safeParse` de los tests.
- **Arreglo esperado:** derivar el tipo, p. ej. `type FallbackReason = NonNullable<UploadResult['data']['fallbackReason']>`, y tipar el body de fallback contra `UploadResult` (`satisfies` o anotación). Así los literales que quedan los comprueba el compilador contra el contrato.
- **Barrido:** son todas las apariciones en `src/service` y `src/handlers` (`grep -rnE "low_confidence|invalid_schema|'timeout'|'LOW'"`). `AnthropicErrorKind` no es contrato: es una clase de error local por diseño, así que está bien.

### F-02 · AMARILLO · src/**tests**/claude-client.real.test.ts («kind network — 5xx / error genérico del SDK») · El caso 5xx no simula un error 5xx del SDK

El test usa `new Error('500 Internal Server Error')`. El mock no expone `APIError`/`InternalServerError` con `status: 500`. Pasa porque todo lo que no es timeout cae en `network`, pero no ejercita la clase real que lanza el SDK ante un 5xx.

### F-03 · AMARILLO · src/**tests**/uploads-http.test.ts («claudeClient error → 500») · No comprueba `body.status === 500`

CA-6 exige el body `{data:null,error:"Failed to analyze image",status:500}`, y el test no afirma el campo `status` del body. Es un test previo que la tarea pedía mantener. Añadir la aserción costaría una línea.

### F-04 · AMARILLO · handlers/uploads.ts:158 · Nada impide por test que el log se amplíe

La regla de log («solo `uploadId` y `reason`; nunca buffer, key ni texto crudo») se cumple leyendo el código. Ningún test espía `console.warn` para fijarlo.

## Evidencia y bitácora

- **Rojo primero:** la bitácora lo registra con 7 ✕ y 9 ✓, y es coherente con el diff.
- **Clases del SDK:** documentadas, y las contrasté contra `node_modules/@anthropic-ai/sdk/core.js` (v0.39.0, líneas 322-335): `APIUserAbortError` al abortar la señal y `APIConnectionTimeoutError` para el timeout interno.
- **Respuesta vs. BD:** la bitácora explica qué queda solo en la respuesta y qué espera a u4/u6.
- **D-1:** está documentada en un comentario y en la bitácora.
- **Edad de la evidencia:** el id de imagen de la bitácora (`c25d2e40…`) coincide con mi build del árbol actual. No encontré evidencia imposible para este diff.
- **Worktree:** sigue limpio después de la revisión; `git status --short` no muestra nada y solo hay artefactos ignorados (coverage, .turbo, dist).

## Tareas candidatas (defectos reales fuera de alcance)

- **Reintentos del SDK:** `claude-client.ts` crea `new Anthropic({ apiKey })` sin `maxRetries: 0`. El SDK 0.39 reintenta por defecto 2 veces ante errores de conexión, 5xx y timeouts (`core.js:134`), lo que contradice C10 «No retry». El código viene de u2, y la tarea u3 deja los reintentos fuera de alcance.
- **Razón `fallbackReason` propia para red/5xx:** por ejemplo `api_error`. El codificador ya lo señaló en la bitácora: `timeout` para un 5xx es semánticamente amplio.
- **Proceso huérfano:** hay un `kubectl port-forward svc/trust-service 3300:3300` (PID 4456) abierto desde el 2026-11-16 18:57. Es de una ola anterior, no de esta tarea ni mío.

## Rutas de transcripciones largas

- Respuesta del camino feliz de CA-14: /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/u3-upload.json
- Informe destino (lo escribe el orquestador): revisiones/u3-T01/ronda-1.md

```
VEREDICTO: NO-VERDE
NARANJA|apps/ingestion-service/src/service/critique-outcome.ts:4|Enum de contrato fallbackReason duplicado a mano en vez de derivado de UploadResultSchema; body de fallback sin tipar contra UploadResult
INFORME: revisiones/u3-T01/ronda-1.md
```
