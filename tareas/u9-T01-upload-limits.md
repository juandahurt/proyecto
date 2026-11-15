# u9-T01 — Extender `apps/identity-service/` con tabla `upload_counters`, `GET /api/users/me/limits` y endpoint interno `POST /api/internal/users/:userId/increment-counter` (free tier 10/mes)

> **Primera tarea de u9-upload-limits.** Esta tarea añade la infraestructura
> del contador mensual de uploads sobre el `apps/identity-service/` existente
> (u8-T01 fusionado). Expone el estado del contador al cliente via
> `GET /api/users/me/limits` y permite que un servicio interno (ingestion en
> una tarea posterior) incremente el contador por usuario via
> `POST /api/internal/users/:userId/increment-counter`.
>
> Es una de las tres tareas de la **ola 1** (u1-T01 + u9-T01 + u11-T01), todas
> habilitadas por u8 fusionado.
>
> **El enforcement cross-service (402 en `POST /api/uploads` cuando el contador
> llega a 0) NO entra en esta tarea.** Esa integración (ingestion llama a
> identity internamente para ver y decrementar el contador) la trae una tarea
> posterior, después de que u1-T01 y u9-T01 estén ambos fusionados. Aquí
> esta tarea entrega los **ladrillos** del contador y el endpoint público para
> que el frontend los muestre en el sidebar; el enforcement es un
> **engranaje** que se arma después.
>
> **El reset automático al 1 de cada mes a 00:00 UTC se implementa por
> inferencia, no por cron.** El `year_month` es parte de la PK de la tabla; al
> consultar el contador del mes actual, si no hay fila, se asume 0 (no hay
> que "resetear" nada). Un cron explícito que inserte filas a 0 añade
> complejidad sin beneficio — fuera de alcance.
>
> **El endpoint interno `POST /api/internal/users/:userId/reset-counter`
> definido en C8 NO entra tampoco.** Ese endpoint lo consume u13 (deletion
> cascade) y se entrega cuando llegue u13-T01. En esta tarea sólo se entrega
> el `increment-counter`.

**Unidad:** u9-upload-limits (IdentityService — extensión)
**Historias que implementa:** US-9 parcial (AC-9.1 counter visible via endpoint; AC-9.3 reset del 1 del mes resuelto por diseño de la PK). AC-9.2 (bloqueo en 0) queda para la tarea de integración u1↔u9 posterior.
**Depende de:** u8-T01 fusionado (BD, repositorio de usuarios, `requireAuth` local del propio service NO — este endpoint usa `@proyecto/auth-middleware`). u8-T02 fusionado (`@proyecto/auth-middleware`).

---

## Alcance

**Dentro** (una línea, concreta):

> Extensión de `apps/identity-service/`: nueva tabla SQLite `upload_counters`
> (`user_id TEXT NOT NULL`, `year_month TEXT NOT NULL` en formato `YYYY-MM`,
> `count INTEGER NOT NULL DEFAULT 0`, PRIMARY KEY `(user_id, year_month)`,
> índice sobre `user_id`); nuevo `src/service/upload-counter-repository.ts`
> con `getForMonth(userId, yearMonth): number` y
> `incrementForMonth(userId, yearMonth): number` (atómico via UPSERT); nuevo
> `src/service/clock.ts` con `currentYearMonth(now?: Date): string` y
> `firstDayOfNextMonth(now?: Date): string` (date por defecto `new Date()`);
> nuevo handler `GET /api/users/me/limits` protegido por `requireAuth` de
> `@proyecto/auth-middleware` que responde
> `{data:{tier:"free",uploadsRemaining:number,uploadsLimit:10,resetDate:string},error:null,status:200}`;
> nuevo handler interno `POST /api/internal/users/:userId/increment-counter`
> (SIN auth — perímetro de red del namespace K8s, mismo patrón que C6/C7/C8/C9
> del contract summary) que devuelve `{data:{count:number},error:null,status:200}`
> y valida `userId` como uuid; schemas Zod y tipos en
> `packages/shared-types/src/limits.ts`; Dockerfile sin cambios más allá de
> la nueva imagen tag `identity-service:u9-T01`; manifiestos K8s en
> `k8s/identity/deployment.yaml` actualizados al nuevo tag; despliegue
> end-to-end verificado en kind con un `GET /api/users/me/limits` real y un
> `POST /api/internal/users/:userId/increment-counter` desde dentro del pod;
> tests Jest + supertest con cobertura ≥80% líneas y ≥75% branches sobre
> `src/service/` y `src/handlers/`.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto o útil):

- Enforcement del 402 en `POST /api/uploads` (cross-service) — pertenece a la
  tarea de integración u1↔u9 posterior.
- Endpoint interno `POST /api/internal/users/:userId/reset-counter` — lo
  consume u13 (deletion cascade); entra en u13-T01.
- Endpoint interno `GET /api/internal/users/:userId/tier` (C6) — lo consume
  u7 (progress service) para decidir free/paid; entra con u7-T01. En esta
  tarea no hay tier paid, no hay `mock-payment`; el tier siempre es `"free"`.
- Endpoint `POST /api/users/me/subscribe` (C2) — pertenece a u10-mock-payment.
- Cualquier cron, scheduler o job que "resetee" el contador físicamente. El
  reset es por inferencia: consultar el `year_month` actual; si no hay fila,
  el contador vale 0. AC-9.3 se cumple sin cron.
- Cambios a `apps/backend/`, a `packages/auth-middleware/`, a
  `apps/identity-service/src/service/{jwt,password,user-repository,database}.ts`
  **existentes** (sólo se añaden archivos nuevos; `database.ts` recibe una
  llamada extra al init del nuevo repo pero el schema de `users` NO cambia).
- Retrofit del `apps/identity-service/src/service/jwt.ts` para que use
  `@proyecto/auth-middleware/verifyToken` en lugar de su verify local —
  candidata C-15; no entra aquí.
- Cambios a `k8s/*.yaml` (raíz) o a `k8s/identity/` más allá de actualizar
  el `image:` del deployment al nuevo tag `identity-service:u9-T01`.
- Cambios a `tareas/`, `revisiones/`, `bitacoras/` fuera de los archivos
  propios de esta tarea.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data, error, status}`,
  Jest + ts-jest + supertest, cobertura ≥80%/≥75%, tipos compartidos en
  `@proyecto/shared-types`, imágenes con tag explícito
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` —
  definición de u9-upload-limits (10 uploads/mes, reset 00:00 UTC día 1,
  low-confidence cuenta contra el límite)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  contrato C2 (`GET /api/users/me/limits` con `LimitsResponse`) y C6
  (`/api/internal/users/:userId/tier` — fuera de alcance de esta tarea pero
  el patrón de "endpoint interno sin auth, perímetro de red" sale de ahí)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` —
  US-9 con AC-9.1, AC-9.2, AC-9.3 (lo que entra y lo que NO en esta tarea)
- `aidlc/spaces/default/intents/260925-feature/inception/requirements-analysis/requirements.md` —
  FR-9.1 (10/mes free, reset 1 UTC), FR-9.2 (402 — fuera), FR-9.4
  (paid sin límite — fuera), FR-9.5 (counter visible — endpoint sí entra)
- `tareas/u8-T01-identity-service-register-login.md` — patrón de la propia app
  que extiendes (molde mental, no copiar texto): handler, test, Dockerfile,
  manifiesto
- `tareas/u8-T02-auth-middleware-package.md` — detalles de `requireAuth`
  (401 `"unauthenticated"`, `req.user.userId`)
- `apps/identity-service/src/service/database.ts` — patrón de init SQLite
  idempotente; aquí añades el `CREATE TABLE IF NOT EXISTS upload_counters` de
  modo que el init siga siendo idempotente
- `apps/identity-service/src/service/user-repository.ts` — patrón de
  repositorio tipado
- `apps/identity-service/src/handlers/auth.ts` — patrón de handler Express con
  shape `{data, error, status}` y mapeo de `ZodError` a 422
- `apps/identity-service/src/server.ts` — donde se registran rutas; aquí
  añades `GET /api/users/me/limits` con `requireAuth` y
  `POST /api/internal/users/:userId/increment-counter` sin `requireAuth`
- `apps/identity-service/Dockerfile` — Dockerfile vigente. NO cambia; sólo
  se reusa.
- `packages/auth-middleware/dist/index.d.ts` — API real que importas:
  `requireAuth`. Antes de tests, construye el package con
  `npm run build -w @proyecto/auth-middleware`.
- `packages/shared-types/src/auth.ts` — `JwtPayload` ya publicado; no lo
  redefines.
- `packages/shared-types/src/index.ts` — barrel donde re-exportas el nuevo
  módulo `./limits`
- `k8s/identity/deployment.yaml` — manifiesto a actualizar: sólo el `image:`

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo desde la raíz del
clon `/Users/aureliano/Desktop/proyecto` con la rama `tarea/u9-T01` checada.

- [ ] **CA-1** — `apps/identity-service/package.json` ahora declara también la
      dep en `@proyecto/auth-middleware` (para el `requireAuth` del endpoint
      público). La dep de `@proyecto/shared-types` ya existía; sigue allí. El
      script `test` sigue corriendo Jest con cobertura.

  ```bash
  node -e 'const p=require("./apps/identity-service/package.json"); const deps={...p.dependencies}; if(!deps["@proyecto/shared-types"]) throw new Error("shared-types dep lost"); if(!deps["@proyecto/auth-middleware"]) throw new Error("auth-middleware dep not added"); if(deps["better-sqlite3"]!=="^12.11.1") throw new Error("better-sqlite3 version changed, must stay ^12.11.1"); if(!/jest.*--coverage|coverage/.test(p.scripts?.test||"")) throw new Error("test script must run coverage"); console.log("ok identity-service deps")'
  ```

  Esperado: imprime `ok identity-service deps`.

- [ ] **CA-2** — `packages/shared-types/src/limits.ts` publica
      `LimitsResponseSchema` (Zod) con la forma de `LimitsResponse` del
      contrato C2 (envuelta en `{data, error, status}`):
      `data = {tier: "free" | "paid", uploadsRemaining: number | null,
uploadsLimit: number | null, resetDate: string | null}`. También
      `IncrementCounterResponseSchema` con
      `data = {count: number}`. Tipos derivados con `z.infer<>`. Re-exportados
      desde `packages/shared-types/src/index.ts`. `tsc --noEmit` del package
      pasa limpio.

  ```bash
  test -f packages/shared-types/src/limits.ts
  grep -E "LimitsResponseSchema" packages/shared-types/src/limits.ts
  grep -E "IncrementCounterResponseSchema" packages/shared-types/src/limits.ts
  grep -E "z\.infer" packages/shared-types/src/limits.ts
  grep -E "(uploadsRemaining|uploadsLimit|resetDate)" packages/shared-types/src/limits.ts | sort -u | wc -l | tr -d ' '
  grep -E "export .* from .*limits" packages/shared-types/src/index.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: ambos schemas presentes, los tres campos aparecen, re-exportados
  desde el barrel, `tsc` exit 0.

- [ ] **CA-3** — `apps/identity-service/src/service/database.ts` añade al init
      un `CREATE TABLE IF NOT EXISTS upload_counters` con columnas `user_id
TEXT NOT NULL`, `year_month TEXT NOT NULL`, `count INTEGER NOT NULL DEFAULT
0`, PRIMARY KEY compuesta `(user_id, year_month)`, e índice `CREATE INDEX IF
NOT EXISTS ... ON upload_counters(user_id)`. El init sigue siendo idempotente:
      llamar dos veces no falla ni duplica tablas/índices. La tabla `users`
      existente NO cambia.

  ```bash
  grep -E "CREATE TABLE IF NOT EXISTS upload_counters" apps/identity-service/src/service/database.ts
  grep -E "PRIMARY KEY\s*\(\s*user_id\s*,\s*year_month\s*\)" apps/identity-service/src/service/database.ts
  grep -E "CREATE INDEX IF NOT EXISTS .* ON upload_counters.*user_id" apps/identity-service/src/service/database.ts
  grep -E "CREATE TABLE IF NOT EXISTS users" apps/identity-service/src/service/database.ts
  # El schema de users no debe haberse modificado — hash de la línea CREATE TABLE users debe ser idéntico:
  git show main:apps/identity-service/src/service/database.ts | grep -E "CREATE TABLE IF NOT EXISTS users" | sort > /tmp/old-users.txt
  grep -E "CREATE TABLE IF NOT EXISTS users" apps/identity-service/src/service/database.ts | sort > /tmp/new-users.txt
  diff /tmp/old-users.txt /tmp/new-users.txt
  ```

  Esperado: todos los `grep` encuentran su patrón; `diff` de la línea `users`
  no produce salida (el schema de users no cambió).

- [ ] **CA-4** — `apps/identity-service/src/service/upload-counter-repository.ts`
      expone: - `getForMonth(userId: string, yearMonth: string): number` — `SELECT count
FROM upload_counters WHERE user_id=? AND year_month=?`. Devuelve `0` si no
      hay fila. - `incrementForMonth(userId: string, yearMonth: string): number` —
      UPSERT atómico (`INSERT INTO upload_counters(user_id, year_month, count)
VALUES (?, ?, 1) ON CONFLICT(user_id, year_month) DO UPDATE SET
count = count + 1 RETURNING count`). Devuelve el nuevo count.

  ```bash
  test -f apps/identity-service/src/service/upload-counter-repository.ts
  grep -E "getForMonth\s*\(" apps/identity-service/src/service/upload-counter-repository.ts
  grep -E "incrementForMonth\s*\(" apps/identity-service/src/service/upload-counter-repository.ts
  grep -E "ON CONFLICT.*DO UPDATE.*count\s*=\s*count\s*\+\s*1" apps/identity-service/src/service/upload-counter-repository.ts
  grep -E "RETURNING count" apps/identity-service/src/service/upload-counter-repository.ts
  ```

  Esperado: ambos métodos declarados; UPSERT con `ON CONFLICT ... DO UPDATE
SET count = count + 1 RETURNING count` presente.

- [ ] **CA-5** — `apps/identity-service/src/service/clock.ts` expone: - `currentYearMonth(now?: Date): string` — devuelve `YYYY-MM` en UTC
      (`now.toISOString().slice(0,7)`). Default `new Date()`. - `firstDayOfNextMonth(now?: Date): string` — devuelve `YYYY-MM-DD`
      del primer día del mes siguiente en UTC. Diciembre → enero del año
      siguiente.
      Tests cubren casos borde: diciembre → enero, enero → febrero, bisiesto
      (febrero → marzo).

  ```bash
  test -f apps/identity-service/src/service/clock.ts
  grep -E "export function currentYearMonth|export const currentYearMonth" apps/identity-service/src/service/clock.ts
  grep -E "export function firstDayOfNextMonth|export const firstDayOfNextMonth" apps/identity-service/src/service/clock.ts
  npm test -w apps/identity-service -- --testPathPattern=clock --no-coverage 2>&1 | tail -15
  ```

  Esperado: funciones exportadas; la suite de `clock` pasa con al menos 4
  tests (actual month, diciembre→enero, enero→febrero, bisiesto).

- [ ] **CA-6** — `GET /api/users/me/limits` SIN header `Authorization` responde
      **401** con body literal `{data:null, error:"unauthenticated", status:401}`
      (viene de `@proyecto/auth-middleware`, mismo literal exacto que CA-6 de
      u8-T02).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=limits --no-coverage 2>&1 | grep -E "(no.*auth|401.*unauthenticated|missing.*authorization)"
  grep -E "\"unauthenticated\"" apps/identity-service/src/__tests__/*.ts | head -5
  ```

  Esperado: al menos un test pasa; el literal `"unauthenticated"` aparece en
  los tests de limits.

- [ ] **CA-7** — `GET /api/users/me/limits` con JWT válido y un usuario SIN
      uploads registrados en el mes actual responde **200** con body
      `{data:{tier:"free",uploadsRemaining:10,uploadsLimit:10,resetDate:<string>},error:null,status:200}`.
      El `resetDate` es el primer día del mes siguiente en formato
      `YYYY-MM-DD` (UTC). Lectura de vuelta por herramienta real:
      `firstDayOfNextMonth(new Date())` en el mismo proceso devuelve el mismo
      string.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=limits --no-coverage 2>&1 | grep -E "(limits.*fresh|200.*10 of 10|uploadsRemaining.*10|uploadsLimit.*10)"
  ```

  Esperado: al menos un test pasa; afirma `uploadsRemaining = 10`,
  `uploadsLimit = 10`, `tier = "free"`, y un `resetDate` válido.

- [ ] **CA-8** — Con un usuario que ya tiene `count=3` en `upload_counters`
      para el mes actual, `GET /api/users/me/limits` responde 200 con
      `data.uploadsRemaining = 7` y `data.uploadsLimit = 10`. Si `count=10`,
      `uploadsRemaining = 0`. Si `count=15` (defensive — nunca debería pasar
      pero puede si el enforcement cross-service llega tarde), devuelve
      `uploadsRemaining = 0` (nunca negativo).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=limits --no-coverage 2>&1 | grep -E "(remaining.*7|remaining.*0|clamp|non-negative)"
  ```

  Esperado: al menos un test cubre los tres casos (3, 10, 15) y afirma los
  `uploadsRemaining` correctos (7, 0, 0).

- [ ] **CA-9** — `POST /api/internal/users/:userId/increment-counter` con un
      `userId` uuid válido en el path responde **200** con body
      `{data:{count:1},error:null,status:200}` en la primera invocación para
      ese usuario+mes, y `{data:{count:2},error:null,status:200}` en la
      segunda. El endpoint NO requiere JWT (sin `requireAuth`) — la seguridad
      aquí es el perímetro de red del namespace K8s (mismo patrón que C6/C7/C8
      del contract summary). Lectura de vuelta: `SELECT count FROM
upload_counters WHERE user_id=? AND year_month=?` devuelve el mismo valor.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=increment --no-coverage 2>&1 | grep -E "(increment.*1|increment.*2|200.*count)"
  ```

  Esperado: al menos dos tests pasan (primera llamada devuelve `count=1`;
  segunda llamada devuelve `count=2`).

- [ ] **CA-10** — `POST /api/internal/users/:userId/increment-counter` con
      `:userId` que NO es uuid responde **422** con body
      `{data:null,error:string,status:422}` y NO modifica la BD (lectura de
      vuelta: `SELECT COUNT(*) FROM upload_counters` antes == después). El
      path param se valida con Zod (`z.string().uuid()`).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=increment --no-coverage 2>&1 | grep -E "(422|invalid.*uuid|bad.*user)"
  ```

  Esperado: al menos un test pasa y afirma que la BD no cambió.

- [ ] **CA-11** — El endpoint `/api/internal/*` NO está sujeto a
      `requireAuth`. El test manda `POST /api/internal/users/<uuid>/increment-counter`
      SIN header `Authorization` y recibe 200 (no 401). Esto demuestra la
      decisión de diseño explícita.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=increment --no-coverage 2>&1 | grep -E "(no.*auth.*internal|internal.*no.*jwt|no.*bearer.*200)"
  ```

  Esperado: al menos un test pasa; el test name/descriptor nombra la
  característica.

- [ ] **CA-12** — Los endpoints de u8-T01 (`POST /api/auth/register`, `POST
/api/auth/login`, `GET /health`) siguen verdes y con el mismo shape. No hay
      regresión por la extensión. La suite de u8-T01 (tests existentes) sigue
      pasando sin cambios.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=(auth|health) --no-coverage 2>&1 | tail -20
  ```

  Esperado: 0 tests fallan; los tests de auth y health del original pasan
  completos.

- [ ] **CA-13** — Cobertura: `apps/identity-service/src/service/*.ts` y
      `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches **para todos los
      archivos incluyendo los nuevos** (`upload-counter-repository.ts`,
      `clock.ts`, nuevo handler de limits, nuevo handler interno).

  ```bash
  npm test -w apps/identity-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/identity-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok identity-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok identity-service service/ + handlers/`.

- [ ] **CA-14** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0.

- [ ] **CA-15** — Nueva imagen Docker con tag `identity-service:u9-T01`
      (nunca `latest`) construida desde la raíz. El Dockerfile existente
      sirve sin cambios (sólo requiere construir los packages
      `@proyecto/shared-types` y `@proyecto/auth-middleware` dentro del
      builder). Verifica también que el Dockerfile ya construye
      `auth-middleware` (si no lo hacía, documentalo como ajuste mínimo en la
      bitácora).

  ```bash
  grep -E "FROM node:20-slim" apps/identity-service/Dockerfile
  grep -E "npm run build -w @?proyecto/shared-types|npm run build -w packages/shared-types" apps/identity-service/Dockerfile
  grep -E "npm run build -w @?proyecto/auth-middleware|npm run build -w packages/auth-middleware" apps/identity-service/Dockerfile
  docker build -f apps/identity-service/Dockerfile -t identity-service:u9-T01 . 2>&1 | tail -20
  docker image inspect identity-service:u9-T01 --format '{{.Id}}' | head -1
  ! docker image inspect identity-service:latest 2>/dev/null | grep -E '"RepoTags"'
  ```

  Esperado: `docker build` exit 0, imagen inspeccionable, `latest` ausente.
  El Dockerfile construye `auth-middleware` además de `shared-types`.

- [ ] **CA-16** — `k8s/identity/deployment.yaml` actualizado: `image:
identity-service:u9-T01`. Resto del manifiesto NO cambia (misma
      readinessProbe, mismo Service, mismo ConfigMap, mismo Secret-plantilla).
      Diff limpio en ese archivo — sólo el tag.

  ```bash
  grep -E "image: identity-service:u9-T01" k8s/identity/deployment.yaml
  ! grep -E "image: identity-service:u8-T01" k8s/identity/deployment.yaml
  # El diff del deployment.yaml se limita a la línea del image:
  git diff main..HEAD -- k8s/identity/deployment.yaml | grep -E "^[-+][^-+]" | grep -v "^[-+]$" | tee /tmp/u9-deploy-diff.txt
  node -e 'const l=require("fs").readFileSync("/tmp/u9-deploy-diff.txt","utf8").split("\n").filter(Boolean); const bad=l.filter(x=>!/image: identity-service:(u8-T01|u9-T01)/.test(x)); if(bad.length) throw new Error("manifest changed beyond image tag: "+bad.join("|")); console.log("manifest diff limited to image tag")'
  ```

  Esperado: imprime `manifest diff limited to image tag`.

- [ ] **CA-17** — Despliegue end-to-end verificado en kind:
  1. Imagen construida con tag `identity-service:u9-T01` (CA-15).
  2. `kind load docker-image identity-service:u9-T01` ejecutado.
  3. `kubectl apply -f k8s/identity/deployment.yaml` (el Service y ConfigMap
     no cambiaron; aplicarlos es seguro — idempotente).
  4. `kubectl rollout status deployment/identity-service` exit 0.
  5. Pod nuevo en estado `Ready`. El pod viejo de u8-T01 se termina
     ordenadamente.
  6. `kubectl port-forward svc/identity-service 3100:3100` activo.
  7. Obtener JWT fresco: `POST /api/auth/register` (o `login` si el usuario
     ya existe) devuelve 201/200 con JWT.
  8. `GET /api/users/me/limits` con `Authorization: Bearer <JWT>` devuelve
     200 con body
     `{data:{tier:"free",uploadsRemaining:10,uploadsLimit:10,resetDate:"YYYY-MM-DD"},error:null,status:200}`.
  9. `kubectl exec deploy/identity-service -- curl -sf -X POST
http://localhost:3100/api/internal/users/<uuid-del-usuario>/increment-counter`
     devuelve 200 con `data.count === 1`. Repetirlo devuelve `data.count === 2`.
  10. `GET /api/users/me/limits` ahora devuelve `uploadsRemaining = 8`.
  11. Port-forwards matados; estado final del cluster: nuevo pod corriendo.

  ```bash
  # Comando atómico de sanity que el revisor ejecuta DESPUÉS de port-forward + JWT:
  curl -sf http://localhost:3100/api/users/me/limits -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u9-fresh.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u9-fresh.json","utf8")); if(r.status!==200||r.data?.tier!=="free"||r.data?.uploadsRemaining!==10||r.data?.uploadsLimit!==10||!/^\d{4}-\d{2}-\d{2}$/.test(r.data?.resetDate||"")) throw new Error("bad limits: "+JSON.stringify(r)); console.log("fresh limits ok, resetDate="+r.data.resetDate)'
  # Incrementar 2 veces desde dentro del pod:
  USER_ID=$(node -e 'const j=require("jsonwebtoken"); console.log(j.decode(process.env.JWT_TOKEN).sub)')
  kubectl exec deploy/identity-service -- curl -sf -X POST http://localhost:3100/api/internal/users/$USER_ID/increment-counter | tee /tmp/u9-inc1.json
  kubectl exec deploy/identity-service -- curl -sf -X POST http://localhost:3100/api/internal/users/$USER_ID/increment-counter | tee /tmp/u9-inc2.json
  node -e 'const a=JSON.parse(require("fs").readFileSync("/tmp/u9-inc1.json","utf8")), b=JSON.parse(require("fs").readFileSync("/tmp/u9-inc2.json","utf8")); if(a.data?.count!==1) throw new Error("first inc not 1: "+JSON.stringify(a)); if(b.data?.count!==2) throw new Error("second inc not 2: "+JSON.stringify(b)); console.log("increment-in-kind ok")'
  # Volver a consultar limits:
  curl -sf http://localhost:3100/api/users/me/limits -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u9-after.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u9-after.json","utf8")); if(r.data?.uploadsRemaining!==8) throw new Error("expected remaining=8 after 2 increments, got: "+JSON.stringify(r)); console.log("limits after increment ok, remaining=8")'
  ```

  Nota: si el revisor no tiene Docker/kind, aplica el fallback de HANDOFF-3
  §4 lesson 1 (orquestador corre los pasos, adjunta outputs al brief).

  Esperado: imprime `fresh limits ok, resetDate=<fecha>`,
  `increment-in-kind ok`, y `limits after increment ok, remaining=8`.

- [ ] **CA-18** — Rama `tarea/u9-T01` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/u9-T01`, al menos 2 commits sobre `main`.

- [ ] **CA-19** — Ningún secreto en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-20** — Scope respetado: `apps/backend/`, `apps/ingestion-service/`
      (no existe aún para esta rama; si u1-T01 se fusiona antes, verifica que
      `tarea/u9-T01` no introduce cambios ahí), `packages/auth-middleware/`,
      `k8s/*.yaml` (raíz) **no** fueron tocados. `packages/shared-types/`
      sólo recibió el archivo nuevo `src/limits.ts` y el re-export
      correspondiente en `src/index.ts`; ningún otro archivo del package
      cambió. `apps/identity-service/src/service/{jwt,password,user-repository}.ts`
      **no** fueron tocados.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/backend/|apps/ingestion-service/|apps/trust-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/identity/" && echo "FAIL: k8s raíz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/" | grep -v -E "(src/limits\.ts|src/index\.ts|package\.json)" && echo "FAIL: shared-types alcance excedido" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/identity-service/src/service/(jwt|password|user-repository)\.ts$" && echo "FAIL: service file no modificable fue tocado" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-21** — Regresión del skeleton: `GET /health` del `apps/backend/`
      responde el shape histórico.

  ```bash
  rm -f /tmp/backend-health.json /tmp/backend.log
  (cd apps/backend && PORT=3501 npm run start > /tmp/backend.log 2>&1 &); sleep 2
  curl -sf http://localhost:3501/health -o /tmp/backend-health.json
  pkill -f "node .*apps/backend" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/backend-health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("backend health broken: "+JSON.stringify(r)); console.log("backend health intact")'
  ```

  Esperado: imprime `backend health intact`.

> **Si un criterio no tiene comando, la tarea no está lista y no se despacha.**
> Todos los CAs de arriba tienen su comando. Si un comando no produce la salida
> esperada, el revisor levanta un hallazgo ROJO.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- `apps/identity-service/src/__tests__/clock.test.ts`:
  - **`currentYearMonth`** con `new Date("2026-11-15T00:00:00Z")` → `"2026-11"`.
  - **`firstDayOfNextMonth`**: `2026-11-15` → `"2026-12-01"`.
  - **Rollover diciembre → enero**: `2026-12-15` → `"2027-01-01"`.
  - **Rollover enero → febrero (año bisiesto)**: `2024-01-15` → `"2024-02-01"`.
  - **Rollover febrero → marzo (año bisiesto)**: `2024-02-29` → `"2024-03-01"`.
  - **Rollover febrero → marzo (año no bisiesto)**: `2026-02-28` → `"2026-03-01"`.
    CA-5.
- `apps/identity-service/src/__tests__/upload-counter-repository.test.ts`:
  - **`getForMonth` sin fila** → 0. CA-4.
  - **`incrementForMonth` primera vez** → 1; segunda vez → 2; `getForMonth` lo
    refleja. CA-4.
  - **Dos usuarios independientes**: `incrementForMonth(userA, "2026-11")` no
    afecta a `userB`. CA-4.
  - **Dos meses del mismo usuario**: `incrementForMonth(userA, "2026-11")` y
    `incrementForMonth(userA, "2026-12")` producen dos filas distintas; cada
    `getForMonth` devuelve su propio contador. CA-4.
- `apps/identity-service/src/__tests__/limits-http.test.ts`:
  - **401 sin header** → `{data:null,error:"unauthenticated",status:401}`. CA-6.
  - **200 fresh** con JWT válido, sin filas en `upload_counters`:
    `uploadsRemaining=10`, `uploadsLimit=10`, `tier="free"`, `resetDate`
    válido. CA-7.
  - **200 con count=3**: `uploadsRemaining=7`. CA-8.
  - **200 con count=10**: `uploadsRemaining=0`. CA-8.
  - **200 con count=15** (defensivo): `uploadsRemaining=0` (clamp). CA-8.
- `apps/identity-service/src/__tests__/increment-http.test.ts`:
  - **200 primera invocación**: `data.count=1`; `getForMonth` lo refleja. CA-9.
  - **200 segunda invocación**: `data.count=2`. CA-9.
  - **422 userId no uuid**: body `{data:null,error:string,status:422}`; BD
    inalterada. CA-10.
  - **200 SIN header `Authorization`**: demuestra la decisión de que el
    endpoint interno no exige JWT. CA-11.

**Rojo primero:** antes de implementar el handler de limits, el codificador
escribe el test de CA-6 (401 sin header), lo corre, lo ve fallar, registra en
la bitácora, luego implementa el wire-up de `requireAuth`, lo ve verde.
Mismo patrón para CA-7 (fresh limits): primero el test con los 10, rojo,
luego implementa limits-handler + repo + clock, verde.

---

## Notas

- **Dónde vive el `JWT_SECRET` en tests:** cada archivo de tests que usa
  `requireAuth` setea su propio `process.env.JWT_SECRET
= 'a-test-secret-for-tests-only'` en `beforeAll` y lo restaura en
  `afterAll`. Firma el JWT en el test con `jsonwebtoken.sign({sub:"user-abc"},
process.env.JWT_SECRET, {algorithm:"HS256",expiresIn:"7d"})`.
- **`currentYearMonth` y zonas horarias:** el formato `YYYY-MM` se calcula en
  **UTC** siempre. `Date.prototype.toISOString()` devuelve UTC por contrato;
  tomar `slice(0,7)` da el YYYY-MM UTC. Esto cumple AC-9.3 ("reset 00:00
  UTC on the 1st") sin configuración de timezone adicional.
- **UPSERT con `RETURNING`:** better-sqlite3 soporta `RETURNING` desde
  SQLite 3.35+ (incluido en las versiones actuales del package `^12.11.1`).
  Si el revisor o CI usan una versión más vieja de SQLite por error, el
  codificador lo documenta en la bitácora.
- **Internal endpoint sin auth:** la decisión de NO poner `requireAuth` en
  `/api/internal/*` es deliberada. En el MVP académico desplegado en kind,
  todo vive en el mismo namespace `default`; no hay NetworkPolicy. Pero el
  contrato C6/C7/C8/C9 ya asume este patrón ("Network-trusted; no JWT
  required. Called by <Service> only"). Para producción cloud, esta decisión
  cambiaría — hay que añadir mTLS o un API Gateway interno. No entra aquí.
- **Mock payment / paid tier:** hoy `tier` siempre devuelve `"free"`. Cuando
  u10-mock-payment aterrice, añadirá una columna `tier` a `users` o una tabla
  `subscriptions` y el handler de limits consultará esa información. El
  schema de `LimitsResponse` ya contempla `paid` para forward-compatibility;
  en esta tarea sólo `free` se puede devolver.
- **Coexistencia con u1-T01 y u11-T01 en la misma ola:** los tres servicios
  modifican `packages/shared-types/src/index.ts` añadiendo UNA línea de
  re-export cada uno. Al abrirse el PR después del verde, GitHub puede
  marcar conflicto trivial en esa línea (merge conflict en `index.ts`); lo
  resuelve el humano al fusionar (añadir las tres líneas). Registra en la
  bitácora el riesgo esperado.
- **Dockerfile ajuste mínimo:** si el Dockerfile actual de identity-service
  **no** construye `@proyecto/auth-middleware` (sólo construye
  `@proyecto/shared-types`), añádele la línea del `npm run build -w
@proyecto/auth-middleware` ANTES del build del service. Lo registras en la
  bitácora como ajuste explícito. No toques nada más del Dockerfile.
- **Archivos que se modifican en su sitio:**
  - `apps/identity-service/package.json` (añadir dep `@proyecto/auth-middleware`).
  - `apps/identity-service/src/service/database.ts` (añadir el CREATE TABLE
    nuevo al init; NO tocar el schema de `users`).
  - `apps/identity-service/src/server.ts` (registrar las dos rutas nuevas).
  - `packages/shared-types/src/index.ts` (añadir `export * from "./limits"`).
  - `k8s/identity/deployment.yaml` (sólo el `image:` del Deployment, CA-16).
  - `apps/identity-service/Dockerfile` (SÓLO si falta el build de
    auth-middleware).
    Nada de duplicados con sufijo. **No toques**: `apps/backend/`, otros
    manifiestos K8s, `packages/auth-middleware/`, ningún `.ts` de `service/` de
    identity-service que ya existiera.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-17,
  no instales dependencias globales.
- **Bitácora:** `bitacoras/u9-T01.md` con una entrada por ronda que describa:
  variante usada para construir `@proyecto/auth-middleware` antes de tests,
  si tuviste que modificar el Dockerfile, comandos exactos corridos para
  CA-17, `userId` observado, respuestas a hallazgos del revisor por
  identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u9-T01`. Base:
`main`. Modelo de aislamiento: rama directa en el clon
`/Users/aureliano/Desktop/proyecto`. Imagen Docker: `identity-service:u9-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 1** (u1-T01 + u9-T01 + u11-T01) — despachada en
paralelo con un codificador por tarea._
