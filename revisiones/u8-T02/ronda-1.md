# Ronda 1 — u8-T02

VEREDICTO: VERDE

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                               | Comando que corrí                                                           | Resultado                                                                                                                                                 |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workspace `packages/auth-middleware/` con deps correctas               | `node -e 'const p=require("./packages/auth-middleware/package.json"); ...'` | pasa (`ok auth-middleware workspace`)                                                                                                                     |
| 2   | `verifyToken` HS256 forzado, sin fallback de secret                    | `test -f ... && grep ...`                                                   | pasa (`verify-token shape ok`)                                                                                                                            |
| 3   | `requireAuth` responde 401 literal `unauthenticated`, setea `req.user` | `test -f ... && grep ...`                                                   | pasa (`require-auth shape ok`)                                                                                                                            |
| 4   | Augmentación Express.Request.user                                      | `grep -rE "namespace Express..." ...`                                       | pasa (`augment shape ok`)                                                                                                                                 |
| 5   | Barrel re-exporta ambos + `tsc --noEmit` limpio                        | `npx tsc --noEmit -p packages/auth-middleware`                              | pasa (exit 0, sin salida)                                                                                                                                 |
| 6   | 401 cuando header ausente                                              | `npm test ... grep "(no.*header\|401)"`                                     | pasa (test `no header Authorization → 401 unauthenticated`)                                                                                               |
| 7   | 401 cuando header malformado                                           | `npm test ... grep "(malformed\|401)"`                                      | pasa (tests `Basic ...` y `Token ...`)                                                                                                                    |
| 8   | 401 cuando token tampered                                              | `npm test ... grep "(tampered\|401)"`                                       | pasa (test `tampered token (bad signature)`)                                                                                                              |
| 9   | 401 cuando token expirado                                              | `npm test ... grep "(expired\|401)"`                                        | pasa (test `expired token (TokenExpired)`)                                                                                                                |
| 10  | 500 cuando `JWT_SECRET` ausente, distinto de 401                       | `npm test ... grep "(JWT_SECRET missing\|500)"`                             | pasa (test asserta `res.status===500` y `error:"server misconfiguration"`, literal, no cualquier 5xx)                                                     |
| 11  | Happy path: `next()` + `req.user.userId` legible                       | `npm test ... grep "(valid token\|user-abc)"`                               | pasa (handler encadenado hace `res.json({userId:req.user?.userId})`; supertest afirma `{userId:"user-abc"}` — lectura de vuelta real, no solo status 200) |
| 12  | Simetría 401 ≥4 ocurrencias de `"unauthenticated"`                     | `node -e '... occurrences...'`                                              | pasa (`occurrences=5`)                                                                                                                                    |
| 13  | Cobertura ≥80% líneas / ≥75% branches                                  | `npm test ... --coverage` + script de verificación                          | pasa (`coverage ok auth-middleware`; global: 92.85% lines, 87.5% branches; verify-token 100/100; require-auth 90/85.71)                                   |
| 14  | `npm run lint` verde incluyendo auth-middleware                        | `npm run lint`                                                              | pasa (4 successful, 0 errors; `@proyecto/auth-middleware:lint` en workspaces)                                                                             |
| 15  | Rama `tarea/u8-T02` con ≥2 commits                                     | `git log --oneline main..HEAD`                                              | pasa (2 commits: implementación + bitácora)                                                                                                               |
| 16  | Sin secretos en diff ni tree                                           | `git diff ... xargs grep ...` + `git ls-files ...`                          | pasa (matches del tree son texto de auditoría de tareas previas, precedente ya aceptado en WS-T03/WS-T05/u8-T01; diff de esta tarea limpio)               |
| 17  | Sin cambios fuera de scope (apps/, k8s/, shared-types/)                | `git diff main..HEAD --name-only \| grep ...`                               | pasa (`scope respected`; diff solo en `packages/auth-middleware/`, `package-lock.json`, `bitacoras/u8-T02.md`)                                            |
| 18  | `GET /health` del backend intacto                                      | `curl http://localhost:3301/health` + verificación JSON                     | pasa (`backend health intact`; body `{"data":{"status":"ok"},"error":null,"status":200}`)                                                                 |

## Hallazgos

Ninguno ROJO ni NARANJA. Observaciones informativas que NO bloquean (y no me toca escribir en el código):

### Observación informativa 1 (AMARILLO leve) · `packages/auth-middleware/src/require-auth.ts:45-47` · Guarda de `JWT_SECRET` redundante

El middleware verifica `!process.env.JWT_SECRET` ANTES de llamar a `verifyToken`, y `verifyToken` lo vuelve a verificar y lanza el error. El `catch` (línea 57-60) recaptura ese mismo error. La rama de la línea 58-59 nunca se ejecuta (es la línea descubierta en el reporte de cobertura: `90% lines, 85.71% branches` en `require-auth.ts` precisamente por las uncovered 58-59). No es un defecto — es defensa en profundidad y está dentro de los floors de cobertura. Lo anoto por limpieza, pero no bloquea nada.

### Observación informativa 2 · Simetría 401 vs 500 verificada en semántica

El test de CA-10 (`JWT_SECRET ausente → 500 server misconfiguration (no 401)`) distingue explícitamente 500 del body literal 401 — el aserto es `expect(res.status).toBe(500)` + `expect(res.body).toEqual({data:null,error:"server misconfiguration",status:500})`. Cumple la regla §6 (lectura de vuelta, no solo código de salida). Lo que la tarea pidió explícitamente — evitar que un `JWT_SECRET` faltante se vea como "credenciales malas" en logs — queda demostrado.

### Observación informativa 3 · Rojo-primero visible en bitácora

La bitácora línea 44-62 muestra el comando corrido ANTES de implementar `require-auth.ts`, con salida `TS2307: Cannot find module '../require-auth'` y 0 tests ejecutados. Cumple el requisito de "rojo primero" del plan de pruebas.

## Tareas candidatas (defectos reales fuera de alcance)

- La guarda duplicada de `JWT_SECRET` en `require-auth.ts` (líneas 45-47 vs recaptura en 57-59) podría simplificarse en una tarea posterior de higiene. Dejar la rama inalcanzable detectada en cobertura (`require-auth.ts:58-59`) bajo el radar. No es defecto funcional.
- Retrofit de `apps/identity-service/src/service/jwt.ts` para que use `@proyecto/auth-middleware`, cuando el equipo decida. La tarea actual lo marca explícitamente como fuera de alcance.

## Rutas de transcripciones largas

- Suite require-auth completa: 7/7 pasan, 0 skipped — ejecutada 4× durante la revisión.
- Suite verify-token completa: 6/6 pasan, 0 skipped.
- Cobertura detallada: `/Users/aureliano/Desktop/proyecto/packages/auth-middleware/coverage/coverage-summary.json` (regenerado por mi `npm test --coverage`).
- Bitácora del codificador: `/Users/aureliano/Desktop/proyecto/bitacoras/u8-T02.md`.
- Archivos revisados: `/Users/aureliano/Desktop/proyecto/packages/auth-middleware/src/{verify-token,require-auth,express-augment,index}.ts`, `/Users/aureliano/Desktop/proyecto/packages/auth-middleware/src/__tests__/{verify-token,require-auth}.test.ts`.

## Nota sobre worktree

Tras correr lint/test/tsc/curl, `git status` muestra una modificación en `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-2e752e11864f.md` — es un shard de audit del orquestador, ajeno al diff del codificador y no provocado por mis comandos de verificación del package. No es defecto del codificador.

## Verificación de los puntos específicos del despacho

- **CA-2 `algorithms: ["HS256"]`** → presente en `verify-token.ts:22`. No hay aceptación de `alg: "none"` ni `HS512`. Test dedicado en `verify-token.test.ts:34-43` demuestra que un token con `alg: "none"` es rechazado. Seguridad confirmada.
- **CA-3 body literal** → el shape es exactamente `{data: null, error: "unauthenticated", status: 401}` (ver `require-auth.ts:5-9` constante `UNAUTHENTICATED_BODY`). Cumple regla team.md del `{data, error, status}`.
- **CA-10 distinción semántica** → el test aserta específicamente `500` y el literal `"server misconfiguration"`, no 4xx/5xx genérico. La separación observabilidad-dashboard que la tarea reclamaba queda demostrada en código.
- **CA-11 lectura de vuelta** → sí, el handler `/me` llama `res.json({userId: req.user?.userId})` y el aserto supertest es `expect(res.body).toEqual({userId: 'user-abc'})`. Lee el estado de `req.user` vía respuesta real, no por código de salida.
- **CA-12 simetría** → 5 ocurrencias de `"unauthenticated"` en los tests (uno por cada uno de los 4 caminos 401 + la cadena en el error de distinción con el 500). Supera el umbral ≥4.
- **CA-17 scope** → 11 archivos tocados, todos en `packages/auth-middleware/`, `package-lock.json`, `bitacoras/u8-T02.md`. Cero en `apps/`, `k8s/`, `packages/shared-types/`. Scope respetado.

```
VEREDICTO: VERDE
—|—|—
INFORME: revisiones/u8-T02/ronda-1.md
```
