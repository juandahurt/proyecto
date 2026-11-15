# u11-T01 — `apps/trust-service/` con `GET /api/onboarding` y `POST /api/onboarding` (3 checkboxes de copy literal exacto, auth via `@proyecto/auth-middleware`), desplegado en kind

> **Primera tarea de u11-onboarding.** Esta tarea entrega el servicio de
> confianza del MVP: un backend independiente en el monorepo que persiste la
> aceptación del onboarding por usuario y la expone a un consumidor
> autenticado. El frontend (u0 — fuera de esta ola) lo usará para gatear la
> pantalla de upload en la primera sesión.
>
> Es una de las tres tareas de la **ola 1** (u1-T01 + u9-T01 + u11-T01), todas
> habilitadas por u8 fusionado.
>
> **El copy de los 3 checkboxes es literal, byte-por-byte, del texto de
> `stories.md` AC-11.2** (confirmado explícitamente por el humano; es el
> "required copy for the MVP onboarding"). Los descriptores más cortos del
> contrato C4 NO son la fuente autoritativa; eran un resumen operativo del
> contrato, no copy final. El revisor va a verificar los literales con
> comparación de cadenas exacta.
>
> **El gating de la pantalla de upload desde el frontend NO entra aquí.** El
> frontend consume `GET /api/onboarding` y decide si redirige al usuario; esa
> integración frontend llega en u0-frontend (fuera de ola). Aquí
> entregamos el endpoint y la persistencia.
>
> **No hay endpoints internos.** El contrato C4 sólo define
> `/api/onboarding`, `/api/policy`, `/api/history` sobre TrustService. Esta
> tarea cubre `/api/onboarding` (GET + POST). `/api/policy` es u12-T01 y
> `/api/history DELETE` es u13-T01; ambos fuera de esta tarea.

**Unidad:** u11-onboarding (TrustService)
**Historias que implementa:** US-11 (AC-11.1 required before first upload del lado backend, AC-11.2 los 3 checkboxes con copy literal, AC-11.3 persistencia server-side para que no vuelva a mostrarse)
**Depende de:** u8-T01 + u8-T02 (fusionados). Consume `@proyecto/auth-middleware` (`requireAuth`) y `JwtPayload` de `@proyecto/shared-types`.

---

## Alcance

**Dentro** (una línea, concreta):

> Nueva app `apps/trust-service/` (Node.js/TypeScript, Express, puerto 3300)
> con tabla SQLite `onboarding_ack` (`user_id TEXT PRIMARY KEY`,
> `acknowledged_at TEXT NOT NULL` en ISO 8601 UTC); nuevo módulo de constantes
> en `packages/shared-types/src/onboarding.ts` que exporta
> `ONBOARDING_CHECKBOX_1`, `ONBOARDING_CHECKBOX_2`, `ONBOARDING_CHECKBOX_3`
> con los **literales exactos** de `stories.md` AC-11.2, el array
> `ONBOARDING_CHECKBOXES` ordenado y el schema Zod
> `OnboardingAckRequestSchema` que exige los tres campos booleanos todos
> `true`; handler `GET /api/onboarding` protegido por `requireAuth` que
> responde `{data:{completed:boolean},error:null,status:200}` según haya o no
> fila para el `userId`; handler `POST /api/onboarding` protegido por
> `requireAuth` que valida con Zod, hace UPSERT (`ON CONFLICT(user_id) DO
UPDATE SET acknowledged_at = excluded.acknowledged_at`) y responde
> `{data:{acknowledged:true},error:null,status:200}` en éxito o
> `{data:null,error:string,status:422}` si cualquier checkbox falta o es
> `false`; `GET /health` con shape skeleton; Dockerfile multi-stage
> `node:20-slim` + build-tools (better-sqlite3 nativo); manifiestos K8s en
> `k8s/trust/` con image tag `trust-service:u11-T01`; despliegue end-to-end
> verificado en kind con `GET` + `POST` reales desde `kubectl port-forward`
> usando un JWT firmado por identity-service en pie; tests Jest + supertest
> con cobertura ≥80% líneas y ≥75% branches sobre `src/service/` y
> `src/handlers/`.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto o útil):

- Frontend React o cualquier pantalla de usuario — pertenece a u0-frontend.
- Redirect / gating del Upload screen a nivel servidor — no tiene sentido:
  es decisión del frontend según `GET /api/onboarding`.
- Endpoint `GET /api/policy` — pertenece a u12-data-policy (u12-T01).
- Endpoint `DELETE /api/history` — pertenece a u13-history-deletion
  (u13-T01), y requiere endpoints internos de ingestion/identity/progress.
- Endpoints internos `DELETE /api/internal/users/:userId/*` — pertenecen a
  u13-T01 también.
- Un flag "soft reset" para volver a mostrar el onboarding — no está en el
  MVP (una vez acknowledged, nunca más).
- Guardar el estado individual de cada checkbox (3 booleanos) en la BD. El
  diseño del POST exige los 3 en `true` para persistir; no hay persistencia
  parcial. Se persiste el **evento** de acknowledgment, no el estado
  temporal de cada checkbox.
- Cambios a `apps/backend/`, `apps/identity-service/`,
  `apps/ingestion-service/` (si llegó por u1-T01 en paralelo),
  `packages/auth-middleware/`, `k8s/*.yaml` (raíz), `k8s/identity/`,
  `k8s/ingestion/`.
- Cambios a `packages/shared-types/` más allá del archivo nuevo
  `src/onboarding.ts` + el re-export en `src/index.ts`.
- Cambios a `tareas/`, `revisiones/`, `bitacoras/` fuera de los archivos
  propios de esta tarea.
- Rate limiting en `/api/onboarding` — fuera del MVP académico.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo con `z.infer<>`,
  respuestas HTTP `{data, error, status}`, Jest + ts-jest + supertest,
  cobertura ≥80%/≥75%, imágenes con tag explícito, tipos compartidos solo en
  `@proyecto/shared-types`
- `aidlc/spaces/default/memory/project.md` — reglas duras: NEVER secretos en
  repo, ALWAYS Zod como fuente de validación, NEVER `latest` en manifiestos,
  ALWAYS `/health` + readinessProbe
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` —
  definición de u11-onboarding (3 checkboxes, stored server-side, no mostrar
  tras primera sesión)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  contrato C4 de TrustService: `GET /api/onboarding` → `{completed:boolean}`;
  `POST /api/onboarding` con `{checkbox1,checkbox2,checkbox3}` booleanos. El
  C4 define el status `204` en éxito para POST; **en esta tarea devolvemos
  200 con body `{data:{acknowledged:true},error:null,status:200}` para
  mantener el shape uniforme `{data,error,status}` que team.md manda — ver
  Notas**
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` —
  US-11 con AC-11.1, AC-11.2 (nota con los 3 strings LITERALES — es la fuente
  autoritativa del copy), AC-11.3
- `aidlc/spaces/default/intents/260925-feature/inception/requirements-analysis/requirements.md` —
  FR-11.1, FR-11.2 (3 checkboxes todos marcados), FR-11.3 (acknowledgment
  server-side, no reaparece)
- `tareas/u8-T01-identity-service-register-login.md` — patrón de app nueva
  (molde mental). Dockerfile, k8s/<service>/, despliegue a kind.
- `tareas/u8-T02-auth-middleware-package.md` — detalles de `requireAuth`
  (401 `"unauthenticated"`, `req.user.userId`).
- `apps/identity-service/Dockerfile` — molde de Dockerfile que ya resolvió el
  fix de `better-sqlite3@^12.11.1` en arm64
- `apps/identity-service/package.json` — versión fija `better-sqlite3@^12.11.1`
- `apps/identity-service/src/service/database.ts` — patrón de init SQLite
  idempotente
- `apps/identity-service/src/service/user-repository.ts` — patrón de
  repositorio tipado
- `apps/identity-service/src/handlers/auth.ts` — patrón de handler con shape
  `{data, error, status}` y mapeo de `ZodError` a 422
- `apps/identity-service/src/server.ts` — patrón de `createApp()`
- `packages/auth-middleware/dist/index.d.ts` — API real que importas
- `packages/shared-types/src/auth.ts` — `JwtPayload` ya publicado
- `packages/shared-types/src/index.ts` — barrel donde re-exportas el módulo
  nuevo `./onboarding`
- `k8s/identity/deployment.yaml` — manifiesto de referencia para el patrón
  (readinessProbe, env desde ConfigMap, Secret-plantilla, Service ClusterIP)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo desde la raíz del
clon `/Users/aureliano/Desktop/proyecto` con la rama `tarea/u11-T01` checada.

- [ ] **CA-1** — `apps/trust-service/` existe como workspace del monorepo.
      `package.json` declara deps en: `express`, `better-sqlite3` (fijo
      `^12.11.1`), `zod`, `@proyecto/shared-types`, `@proyecto/auth-middleware`.
      Las devDeps incluyen `jest`, `ts-jest`, `supertest`, `typescript`,
      `@types/express`, `@types/supertest`. El script `test` corre Jest con
      `--coverage`.

  ```bash
  node -e 'const p=require("./apps/trust-service/package.json"); const req=["express","better-sqlite3","zod"]; for(const d of req){ if(!p.dependencies?.[d]) throw new Error("missing dep: "+d); } if(p.dependencies["better-sqlite3"]!=="^12.11.1") throw new Error("better-sqlite3 must be ^12.11.1, got "+p.dependencies["better-sqlite3"]); const ws=Object.keys(p.dependencies).filter(k=>k.startsWith("@proyecto/")); if(!ws.includes("@proyecto/shared-types")) throw new Error("@proyecto/shared-types dep missing"); if(!ws.includes("@proyecto/auth-middleware")) throw new Error("@proyecto/auth-middleware dep missing"); const devReq=["jest","ts-jest","supertest","typescript","@types/express","@types/supertest"]; for(const d of devReq){ if(!p.devDependencies?.[d]) throw new Error("missing devDep: "+d); } if(!/jest.*--coverage|coverage/.test(p.scripts?.test||"")) throw new Error("test script must run coverage"); console.log("ok trust-service workspace")'
  ```

  Esperado: imprime `ok trust-service workspace`.

- [ ] **CA-2** — `packages/shared-types/src/onboarding.ts` publica las
      constantes `ONBOARDING_CHECKBOX_1`, `ONBOARDING_CHECKBOX_2`,
      `ONBOARDING_CHECKBOX_3` con los literales EXACTOS (byte-por-byte) de
      `stories.md` AC-11.2: 1. `"Estudio COMPLEMENTS human critique -- it doesn't replace your instructor, community, or mentors."` 2. `"AI feedback is categorized input, not a verdict. My own judgment and human critique remain primary."` 3. `"Estudio stores my uploads and critique history. My images are NEVER used to train AI models without my explicit, separate consent. I can delete my history at any time in Settings."`

      También exporta `ONBOARDING_CHECKBOXES: readonly string[]` con los tres
      en orden, y `OnboardingAckRequestSchema` (Zod) con forma
      `{checkbox1: z.literal(true), checkbox2: z.literal(true), checkbox3:

z.literal(true)}`y tipo derivado`OnboardingAckRequest`. Está re-exportado
      desde `packages/shared-types/src/index.ts`. `tsc --noEmit` del package
pasa limpio.

```bash
test -f packages/shared-types/src/onboarding.ts
grep -E "ONBOARDING_CHECKBOX_1" packages/shared-types/src/onboarding.ts
grep -E "ONBOARDING_CHECKBOX_2" packages/shared-types/src/onboarding.ts
grep -E "ONBOARDING_CHECKBOX_3" packages/shared-types/src/onboarding.ts
grep -E "ONBOARDING_CHECKBOXES" packages/shared-types/src/onboarding.ts
grep -E "OnboardingAckRequestSchema" packages/shared-types/src/onboarding.ts
grep -E "z\.literal\(true\)" packages/shared-types/src/onboarding.ts | wc -l | tr -d ' '
grep -E "export .* from .*onboarding" packages/shared-types/src/index.ts
npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
# Verificación byte-por-byte de los tres literales:
node -e '
  const path=require("path");
  // Si el package tiene build, importa de dist; si no, usa ts-node o lee el fuente.
  const mod = require("./packages/shared-types/dist/onboarding.js");
  const expected1 = "Estudio COMPLEMENTS human critique -- it doesn" + String.fromCharCode(39) + "t replace your instructor, community, or mentors.";
  const expected2 = "AI feedback is categorized input, not a verdict. My own judgment and human critique remain primary.";
  const expected3 = "Estudio stores my uploads and critique history. My images are NEVER used to train AI models without my explicit, separate consent. I can delete my history at any time in Settings.";
  const got1 = mod.ONBOARDING_CHECKBOX_1;
  const got2 = mod.ONBOARDING_CHECKBOX_2;
  const got3 = mod.ONBOARDING_CHECKBOX_3;
  if (got1 !== expected1) throw new Error("CHECKBOX_1 mismatch:\nEXPECTED: "+JSON.stringify(expected1)+"\nGOT:      "+JSON.stringify(got1));
  if (got2 !== expected2) throw new Error("CHECKBOX_2 mismatch:\nEXPECTED: "+JSON.stringify(expected2)+"\nGOT:      "+JSON.stringify(got2));
  if (got3 !== expected3) throw new Error("CHECKBOX_3 mismatch:\nEXPECTED: "+JSON.stringify(expected3)+"\nGOT:      "+JSON.stringify(got3));
  if (!Array.isArray(mod.ONBOARDING_CHECKBOXES) || mod.ONBOARDING_CHECKBOXES.length !== 3) throw new Error("ONBOARDING_CHECKBOXES must have 3 items");
  if (mod.ONBOARDING_CHECKBOXES[0] !== got1 || mod.ONBOARDING_CHECKBOXES[1] !== got2 || mod.ONBOARDING_CHECKBOXES[2] !== got3) throw new Error("ONBOARDING_CHECKBOXES order mismatch");
  console.log("onboarding literals byte-exact ok");
'
```

Nota: si el package aún no tiene `dist/`, usa `npx ts-node --project
packages/shared-types/tsconfig.json -e '<...>'` con import relativo al
`src/`. Variante en la bitácora.

Esperado: todos los `grep` pasan, el conteo de `z.literal(true)` es `3`, el
re-export en el barrel aparece, `tsc` exit 0, imprime
`onboarding literals byte-exact ok`.

- [ ] **CA-3** — `apps/trust-service/src/service/database.ts` abre SQLite a
      `process.env.DB_PATH || './data/trust.db'` (`:memory:` en tests) y crea
      la tabla `onboarding_ack` idempotentemente con schema: `user_id TEXT
PRIMARY KEY`, `acknowledged_at TEXT NOT NULL`.

  ```bash
  test -f apps/trust-service/src/service/database.ts
  grep -E "CREATE TABLE IF NOT EXISTS onboarding_ack" apps/trust-service/src/service/database.ts
  grep -E "user_id TEXT PRIMARY KEY" apps/trust-service/src/service/database.ts
  grep -E "acknowledged_at TEXT NOT NULL" apps/trust-service/src/service/database.ts
  ```

  Esperado: todos los `grep` encuentran su patrón.

- [ ] **CA-4** — `apps/trust-service/src/service/onboarding-repository.ts`
      expone: - `hasAck(userId: string): boolean` — `SELECT 1 FROM onboarding_ack
WHERE user_id = ?`. Devuelve `true` si hay fila. - `recordAck(userId: string, timestamp?: string): void` — UPSERT
      (`INSERT INTO onboarding_ack(user_id, acknowledged_at) VALUES (?, ?)
ON CONFLICT(user_id) DO UPDATE SET acknowledged_at = excluded.acknowledged_at`).
      Si `timestamp` no se pasa, usa `new Date().toISOString()`.

  ```bash
  test -f apps/trust-service/src/service/onboarding-repository.ts
  grep -E "hasAck\s*\(" apps/trust-service/src/service/onboarding-repository.ts
  grep -E "recordAck\s*\(" apps/trust-service/src/service/onboarding-repository.ts
  grep -E "ON CONFLICT\(user_id\) DO UPDATE" apps/trust-service/src/service/onboarding-repository.ts
  grep -E "toISOString\(\)" apps/trust-service/src/service/onboarding-repository.ts
  ```

  Esperado: todos los `grep` encuentran su patrón.

- [ ] **CA-5** — `GET /api/onboarding` SIN header `Authorization` responde
      **401** con body literal `{data:null, error:"unauthenticated",
status:401}` (viene de `@proyecto/auth-middleware`, mismo literal que
      u8-T02). `POST /api/onboarding` tiene el mismo comportamiento sin
      header.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(no.*auth|401.*unauthenticated|missing.*authorization)"
  grep -E "\"unauthenticated\"" apps/trust-service/src/__tests__/*.ts | head -5
  ```

  Esperado: al menos dos tests pasan (uno para GET, uno para POST) y el
  literal `"unauthenticated"` aparece en los tests.

- [ ] **CA-6** — `GET /api/onboarding` con JWT válido y SIN registro previo
      para ese `userId` responde **200** con body
      `{data:{completed:false},error:null,status:200}`. Lectura de vuelta por
      herramienta real: `SELECT COUNT(*) FROM onboarding_ack WHERE user_id =
?` devuelve 0.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(fresh user|completed.*false|not.*acked|200.*false)"
  ```

  Esperado: al menos un test pasa y afirma `completed: false`.

- [ ] **CA-7** — `GET /api/onboarding` con JWT válido y UN registro previo
      para ese `userId` responde **200** con
      `{data:{completed:true},error:null,status:200}`.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(acked|completed.*true|200.*true|already acknowledged)"
  ```

  Esperado: al menos un test pasa y afirma `completed: true`.

- [ ] **CA-8** — `POST /api/onboarding` con JWT válido y body
      `{"checkbox1":true,"checkbox2":true,"checkbox3":true}` responde **200**
      con body `{data:{acknowledged:true},error:null,status:200}`. Lectura de
      vuelta: `SELECT COUNT(*) FROM onboarding_ack WHERE user_id = ?`
      devuelve 1; `acknowledged_at` parseable como ISO 8601.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(happy path|200.*acknowledged|three.*true|acknowledged.*true)"
  ```

  Esperado: al menos un test pasa y afirma el body.

- [ ] **CA-9** — `POST /api/onboarding` con uno o más checkboxes en `false`
      responde **422** con body `{data:null,error:string,status:422}`. BD
      inalterada (`SELECT COUNT(*) FROM onboarding_ack WHERE user_id = ?`
      sigue en 0). Al menos tres sub-tests: `{true,true,false}`,
      `{false,true,true}`, `{true,false,true}`.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(422|not all checked|checkbox.*false|missing.*check)"
  ```

  Esperado: al menos tres tests (uno por posición del `false`) pasan y
  afirman 422 + BD inalterada.

- [ ] **CA-10** — `POST /api/onboarding` con body que omite uno o más campos
      (`{"checkbox1":true,"checkbox2":true}` sin `checkbox3`) responde
      **422** con body `{data:null,error:string,status:422}`. El `ZodError`
      no se filtra en el mensaje (no stack).

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(422.*missing|field.*required|missing.*checkbox)"
  ```

  Esperado: al menos un test pasa.

- [ ] **CA-11** — `POST /api/onboarding` idempotente: dos llamadas con el
      mismo JWT y mismo body `{true,true,true}` devuelven 200 ambas y la BD
      sigue teniendo exactamente 1 fila para ese `userId`. El
      `acknowledged_at` de la segunda llamada **puede** actualizarse (UPSERT)
      o no — ambas opciones son aceptables.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=onboarding --no-coverage 2>&1 | grep -E "(idempotent|twice|same user.*ack|upsert)"
  ```

  Esperado: al menos un test pasa; afirma exactamente 1 fila en la BD tras
  las dos POSTs.

- [ ] **CA-12** — `GET /health` responde 200 con body `{data:{status:"ok"},
error:null, status:200}` (shape skeleton consistente con backend e
      identity-service). Tiene test supertest dedicado.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=health --no-coverage 2>&1 | tail -10
  ```

  Esperado: al menos 1 test de health pasa; 0 skipped.

- [ ] **CA-13** — Cobertura: `apps/trust-service/src/service/*.ts` y
      `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches.

  ```bash
  npm test -w apps/trust-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/trust-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok trust-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok trust-service service/ + handlers/`.

- [ ] **CA-14** — `npm run lint` desde la raíz pasa, con `trust-service`
      incluido.

  ```bash
  npm run lint 2>&1 | tail -5
  npm run lint 2>&1 | grep -E "(trust-service|apps/trust-service)" | head -3
  ```

  Esperado: exit 0; `trust-service` aparece entre los workspaces lintados.

- [ ] **CA-15** — Dockerfile multi-stage en `apps/trust-service/Dockerfile`
      con base `node:20-slim`, stage `builder` con `apt-get install -y
python3 make g++`, stage `runtime` sin las build-tools. Construye
      `@proyecto/shared-types` y `@proyecto/auth-middleware` ANTES del build
      del service. Imagen con tag `trust-service:u11-T01` (NO `latest`).

  ```bash
  grep -E "FROM node:20-slim" apps/trust-service/Dockerfile
  grep -E "python3 make g\+\+" apps/trust-service/Dockerfile
  grep -E "npm run build -w @?proyecto/shared-types|npm run build -w packages/shared-types" apps/trust-service/Dockerfile
  grep -E "npm run build -w @?proyecto/auth-middleware|npm run build -w packages/auth-middleware" apps/trust-service/Dockerfile
  docker build -f apps/trust-service/Dockerfile -t trust-service:u11-T01 . 2>&1 | tail -20
  docker image inspect trust-service:u11-T01 --format '{{.Id}}' | head -1
  ! docker image inspect trust-service:latest 2>/dev/null | grep -E '"RepoTags"'
  ```

  Esperado: `docker build` exit 0, imagen inspeccionable, no existe
  `trust-service:latest`.

- [ ] **CA-16** — Manifiestos K8s en `k8s/trust/` con: - `deployment.yaml` — `image: trust-service:u11-T01`,
      `imagePullPolicy: Never`, `readinessProbe` sobre `/health` puerto 3300,
      env `JWT_SECRET` desde `secretKeyRef` del Secret `jwt-secret`
      (el mismo que usan identity e ingestion). - `service.yaml` — ClusterIP puerto 3300. - `configmap.yaml` — `PORT=3300`, `NODE_ENV=production`,
      `DB_PATH=/app/data/trust.db`.

  ```bash
  for f in k8s/trust/deployment.yaml k8s/trust/service.yaml k8s/trust/configmap.yaml; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
  grep -E "image: trust-service:u11-T01" k8s/trust/deployment.yaml
  grep -E "imagePullPolicy: Never" k8s/trust/deployment.yaml
  grep -E "readinessProbe" k8s/trust/deployment.yaml
  grep -E "path: /health" k8s/trust/deployment.yaml
  grep -E "secretKeyRef" k8s/trust/deployment.yaml
  grep -E "name: jwt-secret" k8s/trust/deployment.yaml
  grep -E "(PORT|NODE_ENV|DB_PATH)" k8s/trust/configmap.yaml | sort -u | wc -l | tr -d ' '
  ! grep -E "image:.*:latest" k8s/trust/deployment.yaml
  echo "manifests ok"
  ```

  Esperado: los tres archivos existen con los campos exigidos; el ConfigMap
  tiene las 3 claves (conteo `3`); no aparece `latest`; imprime `manifests ok`.

- [ ] **CA-17** — Despliegue end-to-end verificado en kind, aprovechando que
      identity-service ya está corriendo:
  1. Imagen construida con tag `trust-service:u11-T01` (CA-15).
  2. `kind load docker-image trust-service:u11-T01`.
  3. `kubectl apply -f k8s/trust/` aplica los tres manifiestos. El Secret
     `jwt-secret` ya existe (de u8-T01); NO se recrea.
  4. `kubectl rollout status deployment/trust-service` exit 0.
  5. Pod en `Ready` según readinessProbe.
  6. `kubectl port-forward svc/identity-service 3100:3100` levantado.
     `POST /api/auth/register` (o login) para obtener JWT.
  7. `kubectl port-forward svc/trust-service 3300:3300` levantado.
  8. `GET /api/onboarding` con `Authorization: Bearer <JWT>` devuelve
     `{data:{completed:false},error:null,status:200}`.
  9. `POST /api/onboarding` con body
     `{"checkbox1":true,"checkbox2":true,"checkbox3":true}` devuelve
     `{data:{acknowledged:true},error:null,status:200}`.
  10. `GET /api/onboarding` ahora devuelve `{data:{completed:true},...}`.
  11. Lectura de vuelta en el pod: `kubectl exec deploy/trust-service -- node
-e 'const db=require("better-sqlite3")("/app/data/trust.db");
console.log(db.prepare("SELECT COUNT(*) FROM onboarding_ack").get())'`
      imprime `{ 'COUNT(*)': 1 }`.
  12. Port-forwards matados; nuevo pod sigue en Ready.

  ```bash
  # Comando atómico del happy path (port-forwards activos + $JWT_TOKEN disponible):
  curl -sf http://localhost:3300/api/onboarding -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u11-pre.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u11-pre.json","utf8")); if(r.status!==200||r.data?.completed!==false) throw new Error("expected fresh=false: "+JSON.stringify(r)); console.log("pre-ack ok")'
  curl -sf -X POST http://localhost:3300/api/onboarding -H "Authorization: Bearer $JWT_TOKEN" -H 'Content-Type: application/json' -d '{"checkbox1":true,"checkbox2":true,"checkbox3":true}' | tee /tmp/u11-post.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u11-post.json","utf8")); if(r.status!==200||r.data?.acknowledged!==true) throw new Error("expected ack=true: "+JSON.stringify(r)); console.log("post-ack ok")'
  curl -sf http://localhost:3300/api/onboarding -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u11-after.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u11-after.json","utf8")); if(r.status!==200||r.data?.completed!==true) throw new Error("expected completed=true after ack: "+JSON.stringify(r)); console.log("after-ack ok")'
  kubectl exec deploy/trust-service -- node -e 'const db=require("better-sqlite3")("/app/data/trust.db"); console.log(JSON.stringify(db.prepare("SELECT COUNT(*) AS n FROM onboarding_ack").get()))' | tee /tmp/u11-count.json
  node -e 'const n=JSON.parse(require("fs").readFileSync("/tmp/u11-count.json","utf8")).n; if(n!==1) throw new Error("expected 1 row in onboarding_ack, got "+n); console.log("db count ok, n=1")'
  ```

  Nota: si el revisor no tiene Docker/kind, aplica el fallback de HANDOFF-3
  §4 lesson 1.

  Esperado: imprime `pre-ack ok`, `post-ack ok`, `after-ack ok`, y
  `db count ok, n=1`.

- [ ] **CA-18** — Rama `tarea/u11-T01` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/u11-T01`, ≥ 2 commits sobre `main`.

- [ ] **CA-19** — Ningún secreto en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-20** — Scope respetado: `apps/backend/`, `apps/identity-service/`,
      `apps/ingestion-service/` (si llega por u1-T01 en paralelo),
      `packages/auth-middleware/`, `k8s/*.yaml` (raíz), `k8s/identity/`,
      `k8s/ingestion/` **no** fueron tocados. `packages/shared-types/`
      sólo recibió `src/onboarding.ts` nuevo y el re-export en `src/index.ts`.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|apps/ingestion-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/trust/" && echo "FAIL: k8s raíz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/(identity|ingestion)/" && echo "FAIL: k8s/identity o k8s/ingestion tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/" | grep -v -E "(src/onboarding\.ts|src/index\.ts|package\.json)" && echo "FAIL: shared-types alcance excedido" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-21** — Regresión del skeleton: `GET /health` del `apps/backend/`
      responde el shape histórico.

  ```bash
  rm -f /tmp/backend-health.json /tmp/backend.log
  (cd apps/backend && PORT=3601 npm run start > /tmp/backend.log 2>&1 &); sleep 2
  curl -sf http://localhost:3601/health -o /tmp/backend-health.json
  pkill -f "node .*apps/backend" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/backend-health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("backend health broken: "+JSON.stringify(r)); console.log("backend health intact")'
  ```

  Esperado: imprime `backend health intact`.

> **Si un criterio no tiene comando, la tarea no está lista y no se despacha.**
> Todos los CAs tienen su comando. Si un comando no produce la salida
> esperada, el revisor levanta un hallazgo ROJO.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- `packages/shared-types/src/__tests__/onboarding-literals.test.ts` (o
  equivalente dentro del propio trust-service si shared-types no corre Jest):
  - **Byte-exactitud** de `ONBOARDING_CHECKBOX_1`, `_2`, `_3` contra
    literales esperados (los tres strings de stories.md AC-11.2). CA-2.
  - **`ONBOARDING_CHECKBOXES.length === 3`** y orden preservado.
- `apps/trust-service/src/__tests__/onboarding-repository.test.ts`:
  - **`hasAck` sin fila** → `false`.
  - **`recordAck` + `hasAck`** → `true`; `SELECT COUNT(*)` devuelve 1.
  - **`recordAck` dos veces** → `SELECT COUNT(*)` sigue en 1 (UPSERT).
- `apps/trust-service/src/__tests__/onboarding-http.test.ts` (supertest):
  - **GET 401 sin header** → `{data:null,error:"unauthenticated",status:401}`.
    CA-5.
  - **POST 401 sin header** → mismo literal. CA-5.
  - **GET 200 fresh** → `{data:{completed:false},...}`. CA-6.
  - **GET 200 acked** (pre-insert con repo) → `{data:{completed:true},...}`.
    CA-7.
  - **POST 200 happy path** con `{true,true,true}`. BD: 1 fila. CA-8.
  - **POST 422 con checkbox1=false**: BD inalterada. CA-9.
  - **POST 422 con checkbox2=false**. CA-9.
  - **POST 422 con checkbox3=false**. CA-9.
  - **POST 422 falta campo checkbox3**. CA-10.
  - **POST idempotente** (dos POSTs con `{true,true,true}`): 1 sola fila. CA-11.
- `apps/trust-service/src/__tests__/health.test.ts`:
  - **200 shape skeleton**. CA-12.

**Rojo primero:** antes de implementar el handler de POST, el codificador
escribe el test de CA-8 (happy path con los 3 `true`), lo corre, lo ve
fallar, registra en la bitácora, luego implementa el wire-up
(`requireAuth`, Zod validate, repo UPSERT), lo ve verde. Mismo patrón para
CA-6 (fresh GET) y CA-5 (401).

---

## Notas

- **Decisión sobre el status `204` del contrato C4:** el contrato C4 define
  `POST /api/onboarding` → 204 en éxito. Esta tarea responde **200** con body
  `{data:{acknowledged:true},error:null,status:200}` para mantener el shape
  uniforme `{data, error, status}` que `team.md` manda sobre toda la API del
  backend. Es una desviación consciente y documentada: 204 = "sin body", lo
  que rompe la uniformidad; el equipo lo preferiría consistente. Si el
  humano prefiere la variante C4 estricta, es cambio de dos líneas (status
  code + body vacío). No es defecto; es decisión. El revisor NO debe marcar
  esto como ROJO sin leer esta nota.
- **Copy literal exacto (AC-11.2):** los tres strings vienen de `stories.md`
  AC-11.2, verificados por el humano como "required copy for the MVP
  onboarding". **No alteres mayúsculas, puntuación, dos guiones en el
  primero**:
  1. `Estudio COMPLEMENTS human critique -- it doesn't replace your instructor, community, or mentors.`
  2. `AI feedback is categorized input, not a verdict. My own judgment and human critique remain primary.`
  3. `Estudio stores my uploads and critique history. My images are NEVER used to train AI models without my explicit, separate consent. I can delete my history at any time in Settings.`
     Los `--` del primer checkbox son dos guiones simples, NO un en-dash (`–`)
     ni em-dash (`—`). Los apóstrofes son `'` (0x27), no `’` (U+2019). Los
     acentos NO existen en estos textos — todo ASCII. El revisor verifica con
     comparación de cadenas estricta (CA-2).
- **Perímetro de seguridad del endpoint:** los dos endpoints exigen
  `requireAuth`. NO hay versión "internal" sin auth en esta tarea.
- **Aislamiento del `JWT_SECRET` en tests:** cada archivo de tests que usa
  `requireAuth` setea su propio `process.env.JWT_SECRET
= 'a-test-secret-for-tests-only'` en `beforeAll`. Firma el JWT con
  `jsonwebtoken.sign({sub:"user-abc"}, process.env.JWT_SECRET,
{algorithm:"HS256",expiresIn:"7d"})`.
- **Mismo `jwt-secret` Secret que identity-service e ingestion-service:**
  igual que u1-T01 explica, los tres services comparten el mismo secret
  HS256 en el cluster. El Secret ya existe desde u8-T01; NO lo recrees.
- **Build de `@proyecto/auth-middleware` y `@proyecto/shared-types`:** antes
  de correr tests o `tsc`, el codificador corre `npm run build -w
@proyecto/shared-types` y `npm run build -w @proyecto/auth-middleware`
  desde la raíz. En el Dockerfile ambos se construyen en el builder antes
  del build del service.
- **Coexistencia con u1-T01 y u9-T01 en la misma ola:** los tres servicios
  modifican `packages/shared-types/src/index.ts` añadiendo UNA línea de
  re-export cada uno. Al abrirse el PR después del verde, GitHub puede
  marcar conflicto trivial en esa línea; lo resuelve el humano al fusionar.
  Registra el riesgo esperado en la bitácora.
- **Dockerfile:** el contexto es la raíz del workspace. Copia `packages/shared-types/`,
  `packages/auth-middleware/`, construye ambos, y luego construye el service.
- **Ningún `kubectl apply` desde el codificador contra el cluster compartido
  salvo para su propia verificación de CA-17.** No toques namespaces ajenos
  ni recursos de otros services. Al terminar, mata port-forwards y deja el
  cluster como lo encontraste (los recursos de `trust-service` SÍ pueden
  quedar desplegados).
- **Archivos que se modifican en su sitio:** `packages/shared-types/src/index.ts`
  (añadir `export * from "./onboarding"`), raíz `package.json`/`turbo.json`
  sólo si falta el glob (no debería). Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-17,
  no instales dependencias globales.
- **Bitácora:** `bitacoras/u11-T01.md` con una entrada por ronda que
  describa: variante para los tests de literales (ts-node vs. dist),
  comandos exactos corridos para CA-17, `userId` observado, respuestas a
  hallazgos del revisor por identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u11-T01`. Base:
`main`. Modelo de aislamiento: rama directa en el clon
`/Users/aureliano/Desktop/proyecto`. Imagen Docker: `trust-service:u11-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 1** (u1-T01 + u9-T01 + u11-T01) — despachada en
paralelo con un codificador por tarea._
