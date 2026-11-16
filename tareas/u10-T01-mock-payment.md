# u10-T01 — Extender `apps/identity-service/` con tabla `subscriptions`, `POST /api/users/me/subscribe` y `GET /api/users/me/limits` actualizado para tier real

> **Tarea de u10-mock-payment.** Extiende `apps/identity-service/` para que un
> usuario pueda "pagar" (sin pago real) y pasar a tier `paid`. Añade tabla
> `subscriptions`, endpoint `POST /api/users/me/subscribe` que hace el flip
> de free → paid inmediatamente, y actualiza `GET /api/users/me/limits` para
> que devuelva `{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null}`
> una vez que el usuario está en paid.
>
> **Sin pago real.** El endpoint acepta la petición y actualiza el tier
> directamente. AC-10.3 (notice de mock en la pricing page) es UI — la parte
> de backend cumple el contrato C2 devolviendo `LimitsResponse` con `tier:"paid"`.
>
> **Tabla `subscriptions`, no columna en `users`.** Consistente con la separación
> de concerns de u9. `subscriptions` tiene una fila por usuario: si no hay fila,
> el tier es `"free"` (inferencia por ausencia, mismo patrón que `upload_counters`).

**Unidad:** u10-mock-payment (IdentityService — extensión)
**Historias que implementa:** US-10 (AC-10.2 mock payment completes immediately — sí; AC-10.1 y AC-10.3 son UI — fuera del alcance backend).
**Depende de:** u9-T01 fusionado (tabla `upload_counters`, handler `GET /api/users/me/limits` que hoy devuelve siempre `tier:"free"`).

---

## Alcance

**Dentro** (todo lo que el codificador debe entregar en este diff):

> **`apps/identity-service/src/service/database.ts`**: añadir al init
> `CREATE TABLE IF NOT EXISTS subscriptions` con columnas `user_id TEXT NOT NULL PRIMARY KEY`,
> `tier TEXT NOT NULL DEFAULT "free"`, `upgraded_at TEXT` (ISO 8601 UTC, nullable).
> El init sigue siendo idempotente. Tablas `users` y `upload_counters` NO cambian.
>
> **`apps/identity-service/src/service/subscription-repository.ts`**: nuevo módulo con:
> `getTier(userId: string): "free" | "paid"` — devuelve `"free"` si no hay fila.
> `upgradeToPaid(userId: string, now?: Date): void` — UPSERT atómico con
> `INSERT INTO subscriptions(user_id, tier, upgraded_at) VALUES (?, "paid", ?)
ON CONFLICT(user_id) DO UPDATE SET tier = "paid", upgraded_at = excluded.upgraded_at`.
> `upgraded_at` = `now.toISOString()` (UTC por contrato de `Date.prototype.toISOString()`).
> Default `now = new Date()`. Idempotente: segunda llamada no falla.
>
> **`apps/identity-service/src/handlers/subscribe.ts`**: nuevo handler que exporta
> `createSubscribeRouter({ counterRepo, subscriptionRepo })`. Registra
> `POST /api/users/me/subscribe` protegido por `requireAuth` de
> `@proyecto/auth-middleware`. Llama `subscriptionRepo.upgradeToPaid(userId)`.
> Devuelve `{data:{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null},error:null,status:200}`.
>
> **`apps/identity-service/src/handlers/limits.ts`**: actualizar para consultar
> `subscriptionRepo.getTier(userId)`. Si `tier === "paid"` devolver
> `{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null}`.
> Si `tier === "free"`, misma lógica actual (calcular uploadsRemaining desde
> `upload_counters`). Firma del router actualizada a
> `createLimitsRouter({ counterRepo, subscriptionRepo })`.
>
> **`apps/identity-service/src/server.ts`**: añadir `SubscriptionRepository` a
> `AppDeps`, instanciarlo en producción, pasarlo a `createLimitsRouter` y
> registrar `app.use('/api/users', createSubscribeRouter(...))` para la ruta
> `POST /api/users/me/subscribe` (bajo el mismo prefix `/api/users` que limits).
>
> **`apps/identity-service/Dockerfile`**: solo cambiar el tag. No añadir nada más.
>
> **`k8s/identity/deployment.yaml`**: actualizar `image:` a
> `identity-service:u10-T01`. Diff limitado a la línea del tag.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Endpoint `GET /api/internal/users/:userId/tier` (C6) — pertenece a u7-T01 cuando llegue ProgressService.
- Endpoint `POST /api/internal/users/:userId/reset-counter` (C8) — pertenece a u13-T01.
- Downgrade de paid a free — no hay requisito de downgrade en el MVP.
- Cobro real, integración con pasarela de pago.
- Cambios a `apps/ingestion-service/`, `apps/trust-service/`, `apps/backend/`, `packages/auth-middleware/`.
- Cambios a `packages/shared-types/` (el schema de `limits.ts` ya tiene `tier: "free"|"paid"`).
- Cambios a `k8s/*.yaml` raíz o manifiestos distintos de `k8s/identity/deployment.yaml`.
- Cambios a `apps/identity-service/src/service/{jwt,password,user-repository,clock,upload-counter-repository}.ts`
  existentes.
- AC-10.1 (pricing page UI) y AC-10.3 (mock notice visual) — deferred to frontend.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, shape `{data,error,status}`, Jest + ts-jest + supertest, cobertura ≥80%/≥75%, tipos compartidos en `@proyecto/shared-types`, tags explícitos
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u10-mock-payment
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — contrato C2 (`POST /api/users/me/subscribe`, `GET /api/users/me/limits` con LimitsResponse)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` — US-10 (AC-10.1, AC-10.2, AC-10.3)
- `packages/shared-types/src/limits.ts` — LimitsResponseSchema que ya tiene `tier: "free"|"paid"` y campos nullable
- `packages/shared-types/src/index.ts` — barrel (limits ya re-exportado)
- `apps/identity-service/src/service/database.ts` — patrón de init idempotente; añadir tabla subscriptions
- `apps/identity-service/src/service/upload-counter-repository.ts` — patrón de repositorio con UPSERT; modelar subscriptionRepo igual
- `apps/identity-service/src/handlers/limits.ts` — handler que se actualiza para consultar tier real
- `apps/identity-service/src/server.ts` — AppDeps donde se añade subscriptionRepo y la nueva ruta
- `apps/identity-service/Dockerfile` — solo cambia el tag
- `k8s/identity/deployment.yaml` — manifiesto a actualizar
- `tareas/u9-T01-upload-limits.md` — molde del patrón que extiendes

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/u10-T01` checada.

- [ ] **CA-1** — `apps/identity-service/src/service/database.ts` añade
      `CREATE TABLE IF NOT EXISTS subscriptions` con `user_id TEXT NOT NULL PRIMARY KEY`,
      `tier TEXT NOT NULL DEFAULT "free"`, `upgraded_at TEXT`. Init idempotente.
      Tablas `users` y `upload_counters` sin cambios.

  ```bash
  grep -E "CREATE TABLE IF NOT EXISTS subscriptions" apps/identity-service/src/service/database.ts
  grep -E "user_id TEXT NOT NULL PRIMARY KEY" apps/identity-service/src/service/database.ts
  grep -E "upgraded_at" apps/identity-service/src/service/database.ts
  git show main:apps/identity-service/src/service/database.ts | grep -E "CREATE TABLE IF NOT EXISTS (users|upload_counters)" | sort > /tmp/db-old.txt
  grep -E "CREATE TABLE IF NOT EXISTS (users|upload_counters)" apps/identity-service/src/service/database.ts | sort > /tmp/db-new.txt
  diff /tmp/db-old.txt /tmp/db-new.txt
  ```

  Esperado: tabla subscriptions presente, `diff` de users/upload_counters limpio.

- [ ] **CA-2** — `apps/identity-service/src/service/subscription-repository.ts` exporta
      `getTier(userId: string): "free" | "paid"` y `upgradeToPaid(userId: string, now?: Date): void`.
      UPSERT usa `ON CONFLICT(user_id) DO UPDATE`. `getTier` devuelve `"free"` si no hay fila.

  ```bash
  test -f apps/identity-service/src/service/subscription-repository.ts && echo "file ok"
  grep -E "getTier\s*\(" apps/identity-service/src/service/subscription-repository.ts
  grep -E "upgradeToPaid\s*\(" apps/identity-service/src/service/subscription-repository.ts
  grep -E "ON CONFLICT.*user_id.*DO UPDATE" apps/identity-service/src/service/subscription-repository.ts
  ```

  Esperado: ambas funciones exportadas, UPSERT con ON CONFLICT presente.

- [ ] **CA-3** — `GET /api/users/me/limits` con JWT de un usuario sin fila en `subscriptions`
      devuelve `{data:{tier:"free",uploadsRemaining:10,uploadsLimit:10,resetDate:<string>},error:null,status:200}`.
      Regresión de u9-T01.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=limits --no-coverage 2>&1 | grep -E "(tier.*free|uploadsRemaining.*10|200.*free)"
  ```

  Esperado: test de free tier pasa.

- [ ] **CA-4** — `POST /api/users/me/subscribe` sin header `Authorization` devuelve
      **401** `{data:null,error:"unauthenticated",status:401}`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=subscribe --no-coverage 2>&1 | grep -E "(401|unauthenticated)"
  ```

  Esperado: test de 401 pasa.

- [ ] **CA-5** — `POST /api/users/me/subscribe` con JWT válido devuelve **200** con body
      `{data:{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null},error:null,status:200}`.
      Lectura de vuelta: `SELECT tier FROM subscriptions WHERE user_id = ?` devuelve `"paid"`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=subscribe --no-coverage 2>&1 | grep -E "(tier.*paid|200.*paid|upgradesTo.*paid)"
  ```

  Esperado: test de upgrade pasa; afirma `tier:"paid"` y `uploadsRemaining:null`.

- [ ] **CA-6** — Después de `POST /api/users/me/subscribe`, `GET /api/users/me/limits` devuelve
      `{data:{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null},error:null,status:200}`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=subscribe --no-coverage 2>&1 | grep -E "(limits.*paid|paid.*limits|after.*upgrade|after.*subscribe)"
  ```

  Esperado: al menos un test afirma que después del subscribe, /limits devuelve `tier:"paid"`.

- [ ] **CA-7** — `POST /api/users/me/subscribe` llamado dos veces sobre el mismo usuario no falla
      (idempotente). Responde 200 ambas veces con `tier:"paid"`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=subscribe --no-coverage 2>&1 | grep -E "(idempotent|twice|second.*subscribe|200.*twice|second.*call)"
  ```

  Esperado: test de idempotencia pasa.

- [ ] **CA-8** — Los endpoints de u8-T01 y u9-T01 (`POST /api/auth/register`, `POST /api/auth/login`,
      `GET /api/users/me/limits` free, `POST /api/internal/users/:userId/increment-counter`) siguen
      verdes. No hay regresión.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern="(auth|limits|increment)" --no-coverage 2>&1 | tail -20
  ```

  Esperado: 0 tests fallan.

- [ ] **CA-9** — Cobertura: `apps/identity-service/src/service/*.ts` y `src/handlers/*.ts` cumplen
      ≥80% líneas y ≥75% branches (incluyendo `subscription-repository.ts` y `subscribe.ts` nuevos).

  ```bash
  npm test -w apps/identity-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -5
  cat apps/identity-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok identity-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok identity-service service/ + handlers/`.

- [ ] **CA-10** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0.

- [ ] **CA-11** — Nueva imagen `identity-service:u10-T01` construida, sin tag `latest`.

  ```bash
  docker build -f apps/identity-service/Dockerfile -t identity-service:u10-T01 . 2>&1 | tail -20
  docker image inspect identity-service:u10-T01 --format '{{.Id}}' | head -1
  ! docker image inspect identity-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `latest` ausente.

- [ ] **CA-12** — `k8s/identity/deployment.yaml` actualizado: `image: identity-service:u10-T01`.
      Diff limitado a la línea del tag.

  ```bash
  grep -E "image: identity-service:u10-T01" k8s/identity/deployment.yaml
  ! grep -E "image: identity-service:u9-T01" k8s/identity/deployment.yaml && echo "old tag absent"
  git diff main..HEAD -- k8s/identity/deployment.yaml | grep -E "^[-+][^-+]" | grep -v "^[-+]$" | tee /tmp/u10-deploy-diff.txt
  node -e 'const l=require("fs").readFileSync("/tmp/u10-deploy-diff.txt","utf8").split("\n").filter(Boolean); const bad=l.filter(x=>!/image: identity-service:(u9-T01|u10-T01)/.test(x)); if(bad.length) throw new Error("manifest changed beyond image tag: "+bad.join("|")); console.log("manifest diff limited to image tag")'
  ```

  Esperado: imprime `manifest diff limited to image tag`.

- [ ] **CA-13** — Despliegue end-to-end en kind: pod Running, upgrade mock funciona.

  Pasos previos (el codificador los hace; el revisor los ejecuta para verificar):
  1. `kind load docker-image identity-service:u10-T01`
  2. `kubectl apply -f k8s/identity/deployment.yaml`
  3. `kubectl rollout status deployment/identity-service` exit 0
  4. `kubectl port-forward svc/identity-service 3100:3100` activo en segundo plano
  5. `export JWT_TOKEN=<JWT de register/login>`

  ```bash
  # Verificar estado antes del subscribe:
  curl -sf http://localhost:3100/api/users/me/limits -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u10-before.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u10-before.json","utf8")); if(r.data.tier!=="free") throw new Error("expected free before subscribe, got: "+r.data.tier); console.log("before: tier=free ok")'
  # Subscribe:
  curl -sf -X POST http://localhost:3100/api/users/me/subscribe \
    -H "Authorization: Bearer $JWT_TOKEN" -H "Content-Type: application/json" | tee /tmp/u10-subscribe.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u10-subscribe.json","utf8")); if(r.status!==200||r.data.tier!=="paid") throw new Error("subscribe failed: "+JSON.stringify(r)); console.log("subscribe ok, tier=paid")'
  # Verificar límites después del subscribe:
  curl -sf http://localhost:3100/api/users/me/limits -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u10-after.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u10-after.json","utf8")); if(r.data.tier!=="paid"||r.data.uploadsRemaining!==null) throw new Error("after subscribe limits wrong: "+JSON.stringify(r)); console.log("after subscribe: tier=paid, uploadsRemaining=null ok")'
  ```

  Esperado: imprime `before: tier=free ok`, `subscribe ok, tier=paid`, `after subscribe: tier=paid, uploadsRemaining=null ok`.

- [ ] **CA-14** — No hay secretos en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-15** — Scope respetado: `apps/ingestion-service/`, `apps/trust-service/`, `apps/backend/`,
      `packages/auth-middleware/`, `packages/shared-types/` no tocados. `k8s/*.yaml` raíz no tocados.
      `apps/identity-service/src/service/{jwt,password,user-repository,clock,upload-counter-repository}.ts`
      no tocados.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/ingestion-service/|apps/trust-service/|apps/backend/|packages/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/identity/" && echo "FAIL: k8s raiz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/identity-service/src/service/(jwt|password|user-repository|clock|upload-counter-repository)\.ts$" && echo "FAIL: service files no modificables tocados" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-16** — Rama `tarea/u10-T01` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama `tarea/u10-T01`, al menos 2 commits.

---

## Plan de pruebas

- `apps/identity-service/src/__tests__/subscription-repository.test.ts`:
  - **getTier sin fila** → `"free"`. CA-2.
  - **upgradeToPaid** → fila insertada con `tier = "paid"`. CA-2.
  - **getTier después de upgradeToPaid** → `"paid"`. CA-2.
  - **upgradeToPaid idempotente** → segunda llamada no falla, `tier` sigue `"paid"`. CA-7.

- `apps/identity-service/src/__tests__/subscribe-http.test.ts`:
  - **401 sin auth**. CA-4.
  - **200 upgrade** → `{data:{tier:"paid",uploadsRemaining:null,uploadsLimit:null,resetDate:null},error:null,status:200}`. CA-5.
  - **GET /limits después de subscribe** → `tier:"paid"`. CA-6.
  - **200 idempotente** → segundo `POST /api/users/me/subscribe` devuelve 200 con `tier:"paid"`. CA-7.

- Regresión de suites existentes `limits-http`, `auth`, `increment`. CA-3, CA-8.

---

## Notas

- **`subscriptions` vs columna en `users`**: tabla separada para separación de concerns y forward-compatibility
  (historial de pagos, fecha de expiración, etc. en el futuro). `upload_counters` tomó la misma decisión.
- **UPSERT de upgradeToPaid**: `INSERT INTO subscriptions(user_id, tier, upgraded_at) VALUES (?, "paid", ?)
ON CONFLICT(user_id) DO UPDATE SET tier = "paid", upgraded_at = excluded.upgraded_at`. Idempotente.
- **LimitsResponse para paid**: `uploadsRemaining: null`, `uploadsLimit: null`, `resetDate: null`. El schema
  Zod en `limits.ts` ya define estos campos como nullable. Verificar que el handler los devuelva como
  `null` JSON (no `undefined`) — el serializer de Express omite `undefined` pero incluye `null`.
- **`GET /api/internal/users/:userId/tier` (C6)**: NO entra en esta tarea. Cuando llegue u7-T01
  (ProgressService consulta el tier), ese endpoint se añadirá como extensión de identity-service.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-13.
- **Bitácora**: `bitacoras/u10-T01.md` con entradas por ronda: confirmación del patrón de UPSERT elegido,
  respuestas a hallazgos del revisor por identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u10-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u10-T01`. Imagen Docker: `identity-service:u10-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 2** (u2-T01 + u10-T01 + u12-T01) — despachada en paralelo._
