# Ronda 1 — u8-T01

VEREDICTO: VERDE

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                                | Comando que corrí (abreviado)                                                   | Resultado                                                                                    |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Workspace `apps/identity-service/` con deps y scripts                   | `node -e '...package.json checks...'`                                           | pasa (`ok identity-service workspace`)                                                       |
| 2   | 4 schemas Zod + re-export + `tsc --noEmit`                              | grep + `tsc -p packages/shared-types`                                           | pasa con desviación documentada (ver F-01)                                                   |
| 3   | `safeParse` acepta válido y rechaza email/password malos                | `node -e '...'` desde `dist/index.js`                                           | pasa (`auth schemas semantics ok`)                                                           |
| 4   | `CREATE TABLE IF NOT EXISTS users` con `email UNIQUE`                   | grep sobre `service/database.ts`                                                | pasa                                                                                         |
| 5   | `create`/`findByEmail` + id servidor + `User` sin password_hash         | grep sobre `user-repository.ts`                                                 | pasa                                                                                         |
| 6   | bcrypt roundtrip con cost ≥ 10                                          | `node -e '...dist/service/password.js...'`                                      | pasa (`cost=10`)                                                                             |
| 7   | JWT sign/verify roundtrip + lanza sin secret + tampered                 | `node -e '...dist/service/jwt.js...'`                                           | pasa (`jwt roundtrip ok`)                                                                    |
| 8   | 201 register + `verify(token).sub === findByEmail(email).id`            | `npm test -- --testPathPattern=auth`                                            | pasa (2 tests CA-8)                                                                          |
| 9   | 409 duplicado + `SELECT COUNT(*)=1`                                     | mismo run                                                                       | pasa (2 tests CA-9)                                                                          |
| 10  | 422 password corto + email inválido                                     | mismo run                                                                       | pasa (2 tests CA-10)                                                                         |
| 11  | 200 login + sub match tras verify                                       | mismo run                                                                       | pasa (2 tests CA-11)                                                                         |
| 12  | 401 `"invalid credentials"` literal con password mala                   | mismo run                                                                       | pasa                                                                                         |
| 13  | 401 idéntico con email inexistente — simetría de la constante           | `node -e '...occurrences...'`                                                   | pasa (`occurrences=4`)                                                                       |
| 14  | `GET /health` shape skeleton completo                                   | `npm test -- --testPathPattern=health`                                          | pasa (1 test)                                                                                |
| 15  | Cobertura ≥80% líneas y ≥75% branches en `service/` + `handlers/`       | `npm test -- --coverage` + parser json-summary                                  | pasa (`coverage ok`)                                                                         |
| 16  | `npm run lint`                                                          | `npm run lint`                                                                  | pasa (exit 0, `3 successful`)                                                                |
| 17  | Dockerfile multi-stage + `docker build`                                 | `docker build -f apps/identity-service/Dockerfile -t identity-service:u8-T01 .` | pasa (`Successfully tagged`, sin `latest`)                                                   |
| 18  | 4 manifiestos K8s con tag fijo, probe, secretKeyRef, 4 claves configmap | greps + `test -f`                                                               | pasa (`manifests ok`)                                                                        |
| 19  | Sin `JWT_SECRET` real en diff ni tree                                   | greps                                                                           | pasa (`no real JWT_SECRET value`)                                                            |
| 20  | Despliegue kind end-to-end: curl `/api/auth/register` → decode JWT      | port-forward + curl + `jwt.decode`                                              | pasa (`register-in-kind ok, sub=a656f6fb-..., exp_delta=604800s`)                            |
| 21  | Rama `tarea/u8-T01` con ≥2 commits legibles                             | `git log --oneline main..HEAD`                                                  | pasa (3 commits)                                                                             |
| 22  | Sin `sk-ant-*` ni `ANTHROPIC_API_KEY=...` ni `JWT_SECRET=...` reales    | grep en diff + ls-files                                                         | pasa (único match = texto de auditoría citando el regex, igual que precedente WS-T03/WS-T05) |
| 23  | `apps/backend/` y `k8s/*.yaml` raíz intactos + backend health intacto   | diffs + `npm run start` + curl                                                  | pasa (`backend health intact`)                                                               |

Los 23 CAs pasan por su propio comando. Los tests de supertest leen de vuelta el estado real (`jwt.verify`, `repo.findByEmail`, `SELECT COUNT(*) FROM users`), no solo el código de salida — regla §6 cumplida. La suite completa (`6 passed, 27 tests`) corre en ~2.4s con BD en memoria: tiempos consistentes con tests reales que ejecutan bcrypt (cada hash cuesta ~70-120ms a cost=10), lo que explica los tiempos de 58-144ms por test y descarta la señal de "suite que termina en milisegundos sospechosos" de regla §7.

El despliegue en kind lo verifiqué yo mismo re-ejecutando el curl contra el pod corriendo (que el codificador dejó desplegado): el 201 vino del pod real del cluster, el JWT decodificado tiene `sub=a656f6fb-7489-4c81-8b30-1858a154c187` y `exp_delta=604800s`. Puerto 3100 cerrado al final (`no port-forward left`).

Alcance: los 26 archivos del diff caen enteramente dentro de `apps/identity-service/`, `k8s/identity/`, `packages/shared-types/src/auth.ts`+`index.ts`, `bitacoras/u8-T01.md`, `package-lock.json`. Ningún archivo fuera de alcance tocado. `apps/backend/` y `k8s/*.yaml` raíz verificados intactos por CA-23.

"Rojo primero" documentado en bitácora líneas 38-58 con transcripción literal del fallo 404 esperado antes de implementar los handlers.

## Hallazgos

### F-01 · AMARILLO · CA-2 · El comando literal da `wc -l == 8`, no `4` como espera el texto del CA

El comando literal de CA-2:

```
grep -E "(RegisterRequestSchema|LoginRequestSchema|AuthResponseSchema|JwtPayloadSchema)" packages/shared-types/src/auth.ts | sort -u | wc -l
```

cuenta 8 líneas únicas, no 4. Esto es porque el patrón canónico Zod coloca cada nombre en 2 líneas: la declaración `export const XxxSchema = ...` y el tipo derivado `export type Xxx = z.infer<typeof XxxSchema>`. Los 4 schemas están presentes y `tsc --noEmit` pasa limpio.

Mi veredicto: **el comando del CA está mal especificado por el orquestador, no es un defecto del codificador**. La intención del CA (los 4 schemas presentes y re-exportados) se cumple con holgura — verificable con `grep -E "^export const (Register|Login|AuthResponse|JwtPayload)Schema" | wc -l` que sí da 4. El codificador documentó la desviación explícitamente en la bitácora (líneas 302-303) antes de que yo mirara.

AMARILLO porque no bloquea la tarea; es defecto de especificación del CA. Candidato para corrección del texto del CA en futuras tareas (usar un grep que ancle `^export const`), no para rechazar esta ronda.

### F-02 · AMARILLO · k8s/identity/configmap.yaml:11 y apps/identity-service/src/service/jwt.ts:5 · `JWT_TTL_SECONDS` del ConfigMap no se consume

El ConfigMap define `JWT_TTL_SECONDS: '604800'` y lo monta vía `envFrom`, pero `jwt.ts` usa `const TOKEN_TTL_SECONDS = 604800` literal y nunca lee `process.env.JWT_TTL_SECONDS`. El mismo valor aparece 4 veces: configmap, jwt.ts, handlers/auth.ts (`const TOKEN_TTL_SECONDS = 604800`), y schemas/auth.ts (`z.literal(604800)`). Cambiar el TTL en el ConfigMap no cambia el comportamiento del servicio — hay que editar código.

No sube a NARANJA porque (a) el valor es una constante semántica fija del contrato (AC-8.x exige exactamente 7 días), no un punto de decisión parametrizable, y (b) el `z.literal(604800)` del schema es por diseño de asserción. Pero deja una trampa para quien algún día quiera ajustar el TTL. Candidato para o bien eliminar `JWT_TTL_SECONDS` del ConfigMap, o bien cablearlo de verdad en jwt.ts como `parseInt(process.env.JWT_TTL_SECONDS ?? '604800', 10)`.

### F-03 · AMARILLO · apps/identity-service/src/handlers/auth.ts:15 · `dummyHash` declarado `let` sin reasignación

Línea 15: `let dummyHash = '$2b$10$...'`. No se reasigna en ningún sitio. Debería ser `const`. ESLint no lo flagea presumiblemente por configuración (`prefer-const` no está en error-level, o este archivo está ignorado) — no es blocker pero es señal de que la regla no está puesta a nivel error. Trivial.

## Tareas candidatas (defectos reales fuera de alcance)

- Afirmar en la plantilla de tareas un patrón de grep para contar schemas Zod que resista el patrón canónico `export const X = ...` + `export type X = z.infer<typeof X>` (ver F-01). Posibles redacciones: `grep -cE "^export const (Register|Login|AuthResponse|JwtPayload)Schema"` o `grep -oE "export const [A-Z]\w+Schema" | sort -u | wc -l`.
- Cablear `JWT_TTL_SECONDS` del ConfigMap al servicio, o removerlo del ConfigMap (ver F-02). No bloquea u8-T01 porque el valor de 604800 es correcto hoy, pero deja la coordinación implícita entre 4 sitios.
- Subir `prefer-const` a nivel `error` en la config ESLint compartida (ver F-03). Trivial y preventivo.

## Rutas de transcripciones largas

- Salida literal de `npm test -- --testPathPattern=auth` (11 tests): ver `bitacoras/u8-T01.md` líneas 152-173; yo verifiqué re-ejecutando con el mismo resultado (11 passed, tiempo 1.66s).
- Salida literal de `npm test -- --coverage` (27 tests + 6 suites): ver `bitacoras/u8-T01.md` líneas 196-202; yo verifiqué re-ejecutando (27 passed, Time 2.444s).
- Docker build + kind rollout + port-forward: ver `bitacoras/u8-T01.md` líneas 252-266; yo verifiqué que el pod sigue `1/1 Running` tras 24m, re-ejecuté el port-forward y el curl, y el JWT decodificado desde el pod real me dio `sub=a656f6fb-7489-4c81-8b30-1858a154c187 exp_delta=604800s`.

Archivos clave inspeccionados:

- `/Users/aureliano/Desktop/proyecto/apps/identity-service/src/handlers/auth.ts` (constante literal `'invalid credentials'` + bcrypt siempre ejecutado contra dummy — AC-8.3 bien resuelto)
- `/Users/aureliano/Desktop/proyecto/apps/identity-service/src/__tests__/auth-login.test.ts` (CA-12 y CA-13 asertan ambos la misma string literal en líneas 72 y 85)
- `/Users/aureliano/Desktop/proyecto/apps/identity-service/src/__tests__/auth-register.test.ts` (CA-8 línea 53 lee de vuelta con `repo.findByEmail`; CA-9 línea 79 lee de vuelta con `SELECT COUNT(*)`)
- `/Users/aureliano/Desktop/proyecto/k8s/identity/deployment.yaml` (readinessProbe `/health`:3100, `imagePullPolicy: Never`, `JWT_SECRET` desde `secretKeyRef`)
- `/Users/aureliano/Desktop/proyecto/k8s/identity/secret.yaml.example` (plantilla con `data: {}` y comentario explicando el comando real)

Estado del worktree al terminar: limpio salvo por `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-2e752e11864f.md` que es el log automático del engine (lo modifica el runtime del propio orquestador, no la revisión). Port-forward matado. Pod del cluster intacto.

```
VEREDICTO: VERDE
AMARILLO|CA-2|El comando literal del CA cuenta 8 líneas en vez de 4 por el patrón Zod `export const` + `export type` (defecto de especificación, no del diff)
INFORME: revisiones/u8-T01/ronda-1.md
```
