# Ronda 1 — u9-T01

VEREDICTO: VERDE (con 1 AMARILLO preexistente documentado)

**Rama:** `tarea/u9-T01`
**HEAD SHA:** `f0ef380c7f30040d8d0098b3a6db53e84cc053ad`
**Worktree:** `/Users/aureliano/Desktop/proyecto-u9-T01`

> _Nota: la rama incluye el commit `70c5810` (WIP rescatado por el orquestador tras un corte de sesión en el primer intento paralelo) + commits del codificador que continuaron desde ahí. El codificador reportó un bug del WIP corregido: faltaba `export * from './limits'` en el barrel de shared-types. El revisor verificó el fix y toda la suite consistente con el estado actual de la rama._

## Criterios de aceptación, verificados por el revisor

| #     | Criterio                                             | Comando (abreviado)                                                      | Resultado                                                                                                 |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| CA-1  | deps identity-service                                | `node -e '…package.json…'`                                               | `ok identity-service deps`                                                                                |
| CA-2  | schemas Zod en `limits.ts` + re-export + tsc         | grep + `npx tsc --noEmit -p packages/shared-types`                       | ambos schemas, 3 campos, re-export, tsc exit 0                                                            |
| CA-3  | tabla `upload_counters` + users sin tocar            | grep + diff vs main                                                      | PK compuesta, índice, diff users vacío                                                                    |
| CA-4  | repo con UPSERT `RETURNING count`                    | grep                                                                     | `ON CONFLICT…DO UPDATE SET count=count+1 RETURNING count` presente                                        |
| CA-5  | clock con rollovers                                  | `npm test -w apps/identity-service -- --testPathPattern=clock`           | 10 tests pasan (incluye dic→ene, ene→feb, bisiesto, no bisiesto)                                          |
| CA-6  | 401 `unauthenticated` sin header                     | `npm test … limits`                                                      | pasa + literal `'unauthenticated'` en test                                                                |
| CA-7  | 200 fresh (uploadsRemaining=10)                      | `npm test … limits`                                                      | pasa                                                                                                      |
| CA-8  | count=3/10/15 → remaining=7/0/0 clamp                | `npm test … limits`                                                      | 3 tests pasan                                                                                             |
| CA-9  | increment 200 count=1 y count=2                      | `npm test … increment`                                                   | pasa                                                                                                      |
| CA-10 | 422 bad uuid + BD inalterada                         | `npm test … increment`                                                   | pasa                                                                                                      |
| CA-11 | internal endpoint sin JWT → 200                      | `npm test … increment`                                                   | pasa                                                                                                      |
| CA-12 | regresión u8 (auth+health)                           | `npm test … (auth\|health)`                                              | 12 tests pasan; health en pod retorna `{"data":{"status":"ok"}…}`                                         |
| CA-13 | cobertura ≥80%/≥75%                                  | `npm test --coverage` + node check                                       | `coverage ok identity-service service/ + handlers/`                                                       |
| CA-14 | `npm run lint` exit 0                                | `npm run lint -- --force`                                                | 0 errors, 1 warning, exit 0 (AMARILLO documentado)                                                        |
| CA-15 | docker build `identity-service:u9-T01`, sin `latest` | `docker build … + inspect`                                               | `Successfully tagged identity-service:u9-T01`, sin `:latest`                                              |
| CA-16 | manifiesto K8s solo cambia `image:`                  | `git diff + node check`                                                  | `manifest diff limited to image tag`                                                                      |
| CA-17 | end-to-end en kind                                   | `kind load + kubectl apply + register + curl limits + exec node inc × 2` | `fresh limits ok, resetDate=2026-12-01`; `increment-in-kind ok`; `limits after increment ok, remaining=8` |
| CA-18 | rama + ≥2 commits                                    | `git log main..HEAD`                                                     | 3 commits sobre main (WIP + fix + bitácora)                                                               |
| CA-19 | sin secretos reales                                  | `git diff + grep`                                                        | sin secretos en diff (matches del tree son texto de auditoría preexistente)                               |
| CA-20 | scope respetado                                      | `git diff --name-only + greps`                                           | `scope respected`                                                                                         |
| CA-21 | health del backend sigue verde                       | `cd apps/backend && npm run start + curl /health`                        | `backend health intact`                                                                                   |

## Hallazgos

### F-01 · AMARILLO · `apps/identity-service/src/handlers/increment-counter.ts:27` · lint warning `_err` definido pero no usado

ESLint emite 1 warning (`@typescript-eslint/no-unused-vars` para `_err` en catch), 0 errors, exit 0.

```
/apps/identity-service/src/handlers/increment-counter.ts
  27:14  warning  '_err' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
```

Según la instrucción explícita de esta ronda: WARN sin bloqueo (exit 0) => AMARILLO, no ROJO. CA-14 cumple su criterio (exit 0). Mitigación trivial: añadir `argsIgnorePattern: '^_'` al override de ESLint, o renombrar el parámetro omitiéndolo. _(Orquestador: se registra como candidata C-17 para que un fix global a `eslint.config.js` elimine esta clase de warning.)_

## Observaciones (no son hallazgos)

- **Warning de instalación nativa**: el `npm install` emitió 15 vulnerabilidades (1 critical, 1 high, 6 moderate, 7 low) heredadas del lockfile preexistente; no se introducen por esta tarea. Fuera de alcance del CA.
- **CA-17 workaround correcto**: `curl` no está en `node:20-slim`; usé `kubectl exec deploy/identity-service -- node -e "…http.request…"` según indicaciones del orquestador. Resultados `{data:{count:1}…}` y `{data:{count:2}…}` consistentes con el CA.
- **"Borrado" aparente de `revisiones/u11-T01/ronda-1.md`** en `git diff main..HEAD`: artefacto de que `main` avanzó con `7390a23` tras el `4bf9527` que es el merge-base. NO es desborde del codificador — el `git diff 4bf9527..HEAD --stat` muestra 17 archivos, todos dentro del alcance. _(Orquestador: mismo malentendido que motivó el arbitraje de F-01 en u1-T01; cerrado como esperado, no es defecto.)_
- **Nota sobre bitácora**: la bitácora reporta SHA final `0e02db6`, pero el HEAD real es `f0ef380` (commit adicional con la bitácora completa). Coherente con el flujo.
- **Dockerfile ampliado** para construir `@proyecto/auth-middleware` (ajuste mínimo documentado en la bitácora, previsto por la tarea en nota explícita).

## Tareas candidatas (renumeradas por el orquestador)

- **C-17** _(originalmente C-16 del revisor — conflicto con C-16 ya usada por u11-T01 F-01)_: Configurar ESLint para que trate `_`-prefixed args como intencionalmente ignorados (`"argsIgnorePattern": "^_"`) para evitar warnings no accionables en todos los `catch (_err)` y `(_req, _res, next)`. Precedente ya existe en revisiones previas de u11-T01/u8-T01.

## Rutas de transcripciones

- Bitácora codificador: `/Users/aureliano/Desktop/proyecto-u9-T01/bitacoras/u9-T01.md`
- Tarea: `/Users/aureliano/Desktop/proyecto-u9-T01/tareas/u9-T01-upload-limits.md`
- Coverage summary: `/Users/aureliano/Desktop/proyecto-u9-T01/apps/identity-service/coverage/coverage-summary.json`
- Evidencia end-to-end (CA-17): `/tmp/u9-fresh.json`, `/tmp/u9-inc1.json`, `/tmp/u9-inc2.json`, `/tmp/u9-after.json`
- Diff deployment.yaml: `/tmp/u9-deploy-diff.txt`

---

**Resumen del revisor**: 21/21 CAs verificados por mí mismo con comandos frescos. Los 3 tipos de evidencia que exigen "lectura de vuelta por herramienta real" (CA-7 `resetDate`, CA-9 count SQL, CA-17 end-to-end en kind) pasan. El único hallazgo en pie es el AMARILLO (`_err` warning) que el prompt mismo autoriza como AMARILLO por ser WARN con exit 0. No hay ROJO ni NARANJA. Alcance respetado. Sin secretos reales. Cobertura verde. Despliegue end-to-end funcional en kind con contador que incrementa y limits que refleja el valor.

```
VEREDICTO: VERDE
AMARILLO|apps/identity-service/src/handlers/increment-counter.ts:27|lint warning _err no-unused-vars (no bloqueante, exit 0)
INFORME: revisiones/u9-T01/ronda-1.md
```
