# Ronda 1 — u11-T01

VEREDICTO: VERDE

> _Informe del revisor sobre la rama `tarea/u11-T01` tras el commit `a5daa4d` (fix CA-2 del orquestador). El revisor trabajó en el main clone `/Users/aureliano/Desktop/proyecto` checkouted a esa rama. Dos archivos modificados tras la revisión no son defecto del codificador: el audit log del framework (hook automático) y `package-lock.json` (producido por `npm install` del bootstrap de la revisión — el orquestador lo commiteó aparte a la rama)._

## Criterios de aceptación, verificados por el revisor

| #   | Criterio                                                      | Comando que corrí                                                                 | Resultado                                                                                                                    |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workspace trust-service con deps                              | `node -e '…package.json validations…'`                                            | OK (`ok trust-service workspace`)                                                                                            |
| 2   | Literales byte-exactos + schema Zod + re-export               | `grep` + `tsc --noEmit` + `node -e '…byte-compare…'` sobre `dist/onboarding.js`   | OK (`onboarding literals byte-exact ok`, 3 `z.literal(true)`, re-export presente, tsc exit 0)                                |
| 3   | SQLite init idempotente con schema correcto                   | `grep` sobre `src/service/database.ts`                                            | OK                                                                                                                           |
| 4   | `hasAck` + `recordAck` UPSERT con `toISOString()`             | `grep` sobre `src/service/onboarding-repository.ts`                               | OK                                                                                                                           |
| 5   | 401 `unauthenticated` en GET y POST sin header                | `npm test` suite onboarding                                                       | 2 tests pasan: `GET … 401 unauthenticated` + `POST … 401 unauthenticated`                                                    |
| 6   | GET 200 `completed:false` fresh                               | `npm test` suite onboarding                                                       | pasa (`200 completed=false for fresh user`)                                                                                  |
| 7   | GET 200 `completed:true` acked                                | `npm test` suite onboarding                                                       | pasa (`200 completed=true for already acknowledged`)                                                                         |
| 8   | POST 200 happy path `{true,true,true}`                        | `npm test` suite onboarding                                                       | pasa (`200 acknowledged=true — happy path`)                                                                                  |
| 9   | POST 422 para los 3 casos de un false                         | `npm test` suite onboarding                                                       | 3 tests pasan (checkbox1/2/3 false, DB unmodified)                                                                           |
| 10  | POST 422 missing field                                        | `npm test` suite onboarding                                                       | pasa (`422 missing checkbox3 field`)                                                                                         |
| 11  | POST idempotente (1 fila tras dos POSTs)                      | `npm test` suite onboarding                                                       | pasa (`idempotent — same user ack twice leaves 1 row`)                                                                       |
| 12  | `GET /health` 200 shape skeleton                              | `npm test` suite health                                                           | 1 test pasa, 0 skipped                                                                                                       |
| 13  | Cobertura ≥80% líneas y ≥75% branches en service/ + handlers/ | `npm test -- --coverage` + parse de `coverage-summary.json`                       | `coverage ok trust-service service/ + handlers/`                                                                             |
| 14  | `npm run lint` pasa con trust-service incluido                | `npm run lint`                                                                    | exit 0, `trust-service` en Packages in scope, `trust-service:lint:` en log                                                   |
| 15  | Dockerfile multi-stage + build exitoso + tag `u11-T01`        | grep + `docker build -f apps/trust-service/Dockerfile -t trust-service:u11-T01 .` | `Successfully tagged trust-service:u11-T01`; no existe `:latest`                                                             |
| 16  | Manifiestos K8s completos y correctos                         | grep sobre `k8s/trust/*.yaml`                                                     | todos los campos presentes, ConfigMap tiene 3 claves, no aparece `:latest`, `manifests ok`                                   |
| 17  | Despliegue end-to-end en kind: GET/POST/GET + DB readback     | `kind load` + `kubectl apply` + `curl` port-forward + `kubectl exec`              | `pre-ack ok`, `post-ack ok`, `after-ack ok`, `db count ok, n=1`; pod Ready=True post port-forward kill                       |
| 18  | Rama `tarea/u11-T01` con ≥2 commits sobre main                | `git rev-parse --abbrev-ref HEAD` + `git log --oneline main..HEAD`                | 4 commits, rama correcta                                                                                                     |
| 19  | Sin secretos en diff ni en tree                               | grep combinado                                                                    | solo matches en texto de auditoría (bitácoras/revisiones citando el regex), consistente con precedentes WS-T03/WS-T05/u8-T01 |
| 20  | Scope respetado                                               | 4 greps sobre diff                                                                | todos ok, `scope respected`                                                                                                  |
| 21  | Regresión skeleton: `/health` del backend intacto             | `npm run start` del backend + curl `/health`                                      | `{"data":{"status":"ok"},"error":null,"status":200}`, `backend health intact`                                                |

## Hallazgos

Ninguno bloqueante. Tres observaciones AMARILLO.

### F-01 · AMARILLO · CA-5 · Desalineación de comillas simples vs. dobles en grep del CA

El comando del CA-5 incluye `grep -E "\"unauthenticated\"" apps/trust-service/src/__tests__/*.ts`. Los tests usan comillas simples (`error: 'unauthenticated'`), así que ese grep específico no devuelve coincidencias. Sin embargo, el criterio sustantivo se cumple: los dos tests (GET y POST) pasan con `expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 })`, y el literal `unauthenticated` aparece en el fuente. Es un defecto de redacción del CA, no de la implementación. No bloquea.

### F-02 · AMARILLO · worktree · `package-lock.json` modificado durante la revisión

`npm install` del bootstrap me ordenado por las instrucciones generó cambios en `package-lock.json`. No es defecto del codificador — es efecto de mi propia revisión. Documentado aquí para que el orquestador decida si quiere revertirlo antes de merge (típicamente no, el lock debe quedar al día). _(Nota del orquestador: commiteado a la rama como `10145d2`, antes de persistir este informe.)_

### F-03 · AMARILLO · worktree · audit log del framework modificado

`aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-2e752e11864f.md` lo escriben los hooks del framework durante la sesión. No es defecto del codificador. Candidata C-01 ya rastreada.

## Tareas candidatas (defectos reales fuera de alcance)

- **C-16** (originalmente C-NN-01 del revisor): El CA-5 del archivo de tarea busca `"unauthenticated"` (con comillas dobles) pero los tests del codificador (y del patrón de u8-T02) usan comillas simples. Recomendación para futuras tareas: usar `grep -E "unauthenticated" tests/*.ts` sin forzar el carácter de comilla, o aceptar ambas variantes con `['"]`. Patrón reutilizable en u1-T01 y u9-T01 también.

## Rutas de transcripciones largas

- Diff completo: `git diff main..HEAD` sobre `/Users/aureliano/Desktop/proyecto`
- Bitácora del codificador: `/Users/aureliano/Desktop/proyecto/bitacoras/u11-T01.md`
- Tests JSON de CA-17: `/tmp/u11-pre.json`, `/tmp/u11-post.json`, `/tmp/u11-after.json`, `/tmp/u11-count.json`
- Logs port-forwards CA-17: `/tmp/identity-pf.log`, `/tmp/trust-pf.log`
- Health backend CA-21: `/tmp/backend-health.json`

---

VEREDICTO: VERDE

_Informe persistido por el orquestador tal cual lo entregó el revisor, con las notas aclaratorias entre paréntesis del propio orquestador marcadas en cursiva. Candidata C-NN-01 renumerada a C-16 (consecutiva en el registro global)._
