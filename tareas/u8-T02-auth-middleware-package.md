# u8-T02 — `packages/auth-middleware/` con `requireAuth` y `verifyToken` para que u1 / u9 / u11 gates de JWT

> **Segunda tarea de u8-authentication.** u8-T01 entregó register + login + JWT
> en `apps/identity-service/`. Esta tarea entrega **el otro lado** del contrato:
> un middleware Express reusable que los próximos tres servicios (u1
> ingestion-service, u11 trust-service, y los endpoints protegidos que u9 añada
> a identity-service) van a usar para validar el JWT que viene en
> `Authorization: Bearer <token>`.
>
> Sin este package, la ola paralela u1-T01 + u9-T01 + u11-T01 no es
> verdaderamente paralela: cada tarea tendría que escribir su propio
> `verify` local, duplicando ~20 LOC y bloqueándose entre sí si queremos
> coherencia. Este package **DRY** el gate y habilita la ola.
>
> Es intencionalmente una tarea chica: no crea servicios, no toca Docker, no
> toca K8s. Solo entrega una librería tipada con sus tests. `identity-service`
> y `backend` existentes NO se refactoran — cuando lo necesiten en el futuro,
> es otra tarea candidata.

**Unidad:** u8-authentication (biblioteca de soporte, no un service)
**Historias que implementa:** ninguna directamente; habilita la gate HTTP que US-1, US-5, US-7, US-9, US-11, US-12, US-13 requieren (todas sus ACs implican endpoint autenticado).
**Depende de:** u8-T01 (ya fusionado — `packages/shared-types/src/auth.ts` publica `JwtPayloadSchema` que este package consume).

---

## Alcance

**Dentro** (una línea, concreta):

> Nuevo package `packages/auth-middleware/` (TypeScript puro, sin dependencias de runtime Express más allá del peer) que exporta `requireAuth` (middleware Express que valida `Authorization: Bearer <token>` usando `JWT_SECRET` del env y setea `req.user = { userId }` en éxito, o responde 401 genérico en fallo), `verifyToken(token: string): JwtPayload` (helper puro), augmentación de tipos sobre `Express.Request` (para que `req.user` quede tipado en consumidores), index barrel, suite Jest con happy-path + 4 caminos de fallo (header ausente, malformado, token manipulado, `JWT_SECRET` ausente), cobertura ≥80% líneas y ≥75% branches sobre `src/`, lint verde.

**Fuera** (rechazar aunque se vea útil):

- Retrofit del `apps/identity-service/` para que use este package en lugar de
  su `src/service/jwt.ts` local. Ese refactor es higiene posterior (candidata),
  no u8-T02. El `jwt.ts` de identity-service sigue siendo autoritativo para
  **firmar** tokens; este package sólo **verifica**.
- Protección de endpoints en `apps/backend/` (`POST /critiques` del skeleton).
  El skeleton se reemplaza por u1 — no se retrofitea.
- Cualquier nuevo endpoint, service, app o manifiesto K8s. Esta tarea no
  despliega nada.
- Un sistema de revocación de tokens, blacklist, refresh tokens, o logout —
  JWT stateless, 7-day TTL, como en u8-T01.
- Soporte para múltiples algoritmos de firma. HS256 es lo que u8-T01 firma;
  este package verifica HS256. Punto.
- Soporte para extraer el token de cookies o del body. Solo header
  `Authorization: Bearer <token>` (contrato C1/C2/C3/C4 usa `bearerAuth`).
- Cambios a `packages/shared-types/` más allá de **leer** los exports de
  u8-T01. Si falta un export que necesitas, documéntalo como candidata y
  trabájalo en una tarea aparte — no inflés `shared-types/` desde aquí.
- Mock del `JWT_SECRET` en tests productivos. Cada test que usa `requireAuth`
  o `verifyToken` setea su propio `process.env.JWT_SECRET` en el `beforeAll`,
  nunca uno global de CI ni valor por defecto.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — tu papel y el sellado.
- `.claude/agents/codificador.md` — tu contrato como codificador.
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo con `z.infer<>`,
  `{data, error, status}` como shape de respuesta HTTP, Jest + ts-jest,
  cobertura ≥80%/≥75%, `packages/shared-types` como fuente única de contratos.
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables: NEVER
  secretos en repo, ALWAYS Zod como fuente de validación, NEVER duplicar
  tipos TypeScript entre servicios (el package de auth-middleware **importa**
  de shared-types, no redefine).
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  contratos C1/C2/C3/C4: los endpoints protegidos usan `bearerAuth` con JWT
  y responden 401 cuando el token falta o es inválido.
- `tareas/u8-T01-identity-service-register-login.md` — tarea hermana, para ver
  el patrón de los schemas (`JwtPayloadSchema` en `packages/shared-types/src/auth.ts`)
  y la convención `"invalid credentials"` del 401 de login.
- `packages/shared-types/src/auth.ts` — ya publica `JwtPayloadSchema` y el
  tipo `JwtPayload`; este package los consume (no los redefine).
- `packages/shared-types/package.json` — para ver el `"name"` real del
  workspace (`@proyecto/shared-types` o similar) y declarar la dep.
- `apps/identity-service/src/service/jwt.ts` — ya existe un `verify` local; léelo
  para entender el patrón de decode + validate schema + throw. No lo copies:
  escribe el tuyo; usa el suyo como referencia de patrón (manejo de
  `JsonWebTokenError`, `TokenExpiredError`).
- `apps/identity-service/src/handlers/auth.ts` — para ver el shape literal
  del 401 (`{data:null, error:"...", status:401}`) y cómo se construye.
- `apps/identity-service/jest.config.js` — plantilla de configuración Jest
  con thresholds; adaptar para `packages/auth-middleware/`.
- `turbo.json` — para ver cómo se declaran las tareas de build/test/lint en
  el monorepo.
- `eslint.config.js` (raíz) — config compartida; el package no define la
  suya.

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo desde la raíz del
clon `/Users/aureliano/Desktop/proyecto` con la rama `tarea/u8-T02` checada.

- [ ] **CA-1** — `packages/auth-middleware/` existe como workspace. `package.json`
      declara: `jsonwebtoken` como `dependencies`, `@proyecto/shared-types`
      (nombre real del workspace de u8-T01) como `dependencies` también,
      `express` como `peerDependencies` (el consumidor trae su Express), `zod`
      como `dependencies` (si lo necesita internamente). Las devDeps incluyen
      `jest`, `ts-jest`, `typescript`, `@types/express`, `@types/jsonwebtoken`.
      El script `test` corre Jest con cobertura.

  ```bash
  node -e 'const p=require("./packages/auth-middleware/package.json"); const deps={...(p.dependencies||{})}; const peer={...(p.peerDependencies||{})}; const dev={...(p.devDependencies||{})}; if(!deps.jsonwebtoken) throw new Error("jsonwebtoken missing from dependencies"); const sharedKey=Object.keys(deps).find(k=>k.includes("shared-types")); if(!sharedKey) throw new Error("shared-types workspace dep missing"); if(!peer.express) throw new Error("express should be peerDependency, not dependency"); if(deps.express) throw new Error("express leaked to runtime deps"); const devReq=["jest","ts-jest","typescript","@types/express","@types/jsonwebtoken"]; for(const d of devReq){ if(!dev[d]) throw new Error("missing devDep: "+d); } if(!/jest.*--coverage|coverage/.test(p.scripts?.test||"")) throw new Error("test script must run coverage"); console.log("ok auth-middleware workspace")'
  ```

  Esperado: imprime `ok auth-middleware workspace`.

- [ ] **CA-2** — `packages/auth-middleware/src/verify-token.ts` exporta
      `verifyToken(token: string): JwtPayload`. Lee `process.env.JWT_SECRET` y
      lanza (`Error` con mensaje `"JWT_SECRET missing from environment"`) si es
      ausente o cadena vacía. Usa `jsonwebtoken.verify` con algoritmo HS256
      forzado (NO acepta `alg: "none"`). Devuelve el payload tipado como
      `JwtPayload` importado de `@proyecto/shared-types` (no lo redefine).

  ```bash
  test -f packages/auth-middleware/src/verify-token.ts
  grep -E "export function verifyToken|export const verifyToken" packages/auth-middleware/src/verify-token.ts
  grep -E "import .*JwtPayload.* from .*shared-types" packages/auth-middleware/src/verify-token.ts
  grep -E "algorithms:.*HS256|algorithm.*HS256" packages/auth-middleware/src/verify-token.ts
  ! grep -E "process\.env\.JWT_SECRET\s*\|\|" packages/auth-middleware/src/verify-token.ts  # no fallback silente
  echo "verify-token shape ok"
  ```

  Esperado: imprime `verify-token shape ok`. La función está declarada, el
  tipo viene de shared-types, el algoritmo está forzado a HS256, y no hay
  fallback silente para `JWT_SECRET`.

- [ ] **CA-3** — `packages/auth-middleware/src/require-auth.ts` exporta
      `requireAuth` como `RequestHandler` de Express. En éxito: setea
      `req.user = { userId: payload.sub }` y llama `next()`. En fallo: responde
      **401** con body literal `{data: null, error: "unauthenticated", status: 401}`
      — mismo shape que el `{data, error, status}` del team.md, con el string
      `"unauthenticated"` (NO `"invalid credentials"`, que es el de u8-T01/login:
      son errores distintos semánticamente — login == credenciales malas;
      middleware == no hay sesión válida).

  ```bash
  test -f packages/auth-middleware/src/require-auth.ts
  grep -E "export const requireAuth|export function requireAuth" packages/auth-middleware/src/require-auth.ts
  grep -E "\"unauthenticated\"|'unauthenticated'" packages/auth-middleware/src/require-auth.ts
  grep -E "req\.user\s*=" packages/auth-middleware/src/require-auth.ts
  grep -E "(401|res\.status\(401\))" packages/auth-middleware/src/require-auth.ts
  echo "require-auth shape ok"
  ```

  Esperado: imprime `require-auth shape ok`.

- [ ] **CA-4** — `packages/auth-middleware/src/express-augment.ts` (o un
      `.d.ts` equivalente) declara la augmentación de tipos sobre
      `Express.Request`: `declare global { namespace Express { interface Request
{ user?: { userId: string } } } }`. El barrel `src/index.ts` re-exporta
      este módulo (o lo importa como side-effect) para que los consumidores tipados
      obtengan `req.user` automáticamente sin importar el `.d.ts`.

  ```bash
  grep -rE "namespace Express|declare module .express." packages/auth-middleware/src/ | head -3
  grep -E "user\?:\s*\{\s*userId" packages/auth-middleware/src/*.ts packages/auth-middleware/src/*.d.ts 2>/dev/null | head -3
  grep -E "(export \*|import)" packages/auth-middleware/src/index.ts
  echo "augment shape ok"
  ```

  Esperado: imprime `augment shape ok`; la augmentación está presente y el
  barrel lo expone.

- [ ] **CA-5** — `packages/auth-middleware/src/index.ts` es barrel y re-exporta
      `requireAuth`, `verifyToken` y la augmentación de tipos. `tsc --noEmit -p
packages/auth-middleware` pasa limpio.

  ```bash
  test -f packages/auth-middleware/src/index.ts
  grep -E "(requireAuth|verifyToken)" packages/auth-middleware/src/index.ts
  npx tsc --noEmit -p packages/auth-middleware 2>&1 | tail -3
  ```

  Esperado: ambos símbolos re-exportados, `tsc` exit 0 sin salida.

- [ ] **CA-6** — Test: `requireAuth` responde 401 con body
      `{data:null, error:"unauthenticated", status:401}` cuando el header
      `Authorization` NO está presente.

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=require-auth --no-coverage 2>&1 | grep -E "(no.*header|missing.*authorization|unauthenticated.*no.*header|401)"
  ```

  Esperado: al menos un test con esos tokens pasa; la suite completa en
  verde.

- [ ] **CA-7** — Test: `requireAuth` responde 401 con el MISMO body literal
      cuando el header existe pero NO empieza por `Bearer ` (malformado).

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=require-auth --no-coverage 2>&1 | grep -E "(malformed|not.*bearer|wrong scheme|401)"
  ```

  Esperado: al menos un test pasa.

- [ ] **CA-8** — Test: `requireAuth` responde 401 con el MISMO body literal
      cuando el token está manipulado (firma inválida). El test genera un JWT
      válido con `jsonwebtoken.sign`, le altera un carácter del body/signature,
      lo pasa en el header, y asserta 401.

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=require-auth --no-coverage 2>&1 | grep -E "(tampered|invalid.*signature|bad.*token|401)"
  ```

  Esperado: al menos un test pasa.

- [ ] **CA-9** — Test: `requireAuth` responde 401 con el MISMO body literal
      cuando el token está expirado. El test usa `jsonwebtoken.sign` con
      `expiresIn: -1` (o un `exp` en el pasado) y asserta 401.

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=require-auth --no-coverage 2>&1 | grep -E "(expired|TokenExpired|401)"
  ```

  Esperado: al menos un test pasa.

- [ ] **CA-10** — Test: cuando `process.env.JWT_SECRET` NO está seteado,
      `verifyToken` lanza con mensaje `"JWT_SECRET missing from environment"`.
      Y cuando `requireAuth` encuentra el mismo escenario, responde **500** (NO
      401 — el token podría ser válido; es error de servidor) con body
      `{data:null, error:"server misconfiguration", status:500}`. Esto evita
      que un JWT_SECRET faltante en producción se vea como "credenciales malas"
      en los logs.

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=(require-auth|verify-token) --no-coverage 2>&1 | grep -E "(JWT_SECRET missing|server misconfiguration|500)"
  ```

  Esperado: tests pasan y afirman la rama 500 distinta de la rama 401.

- [ ] **CA-11** — Test: con `JWT_SECRET` seteado y un token válido firmado
      por el **mismo** secret con `sub = "user-abc"`, `requireAuth` llama
      `next()` (no `res.status`), y en el handler siguiente `req.user.userId
=== "user-abc"`. Lectura de vuelta: un pequeño Express app de test con
      `requireAuth` encadenado a un handler que `res.json({userId: req.user?.userId})`.
      Supertest asserta que el response body tiene `userId: "user-abc"`.

  ```bash
  npm test -w packages/auth-middleware -- --testPathPattern=require-auth --no-coverage 2>&1 | grep -E "(valid token|happy path|req\.user|user-abc|next\(\))"
  ```

  Esperado: al menos un test pasa; la suite completa de `require-auth` va en
  verde con 0 skipped.

- [ ] **CA-12** — Simetría del 401: el body del 401 en TODAS las variantes
      (header ausente, malformado, tampered, expirado) es la misma constante
      literal `{data:null, error:"unauthenticated", status:401}`. El revisor
      verifica la simetría contando ocurrencias.

  ```bash
  node -e '
    const fs=require("fs"), path=require("path");
    const dir="packages/auth-middleware/src/__tests__";
    const files=fs.readdirSync(dir).filter(f=>f.endsWith(".ts"));
    const content=files.map(f=>fs.readFileSync(path.join(dir,f),"utf8")).join("\n");
    const occurrences=(content.match(/"unauthenticated"/g)||[]).concat(content.match(/'"'"'unauthenticated'"'"'/g)||[]).length;
    if(occurrences<4) throw new Error("expected >= 4 occurrences of \"unauthenticated\" across 401 tests (header absent + malformed + tampered + expired), found "+occurrences);
    console.log("401 message symmetric, occurrences="+occurrences);
  '
  ```

  Esperado: imprime `401 message symmetric, occurrences=N` con N ≥ 4.

- [ ] **CA-13** — Cobertura: `packages/auth-middleware/src/**/*.ts` cumple
      ≥80% líneas y ≥75% branches.

  ```bash
  npm test -w packages/auth-middleware -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat packages/auth-middleware/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const keys=Object.keys(s).filter(k=>k.includes("packages/auth-middleware/src/")); if(!keys.length) throw new Error("no files covered"); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } console.log("coverage ok auth-middleware")})'
  ```

  Esperado: imprime `coverage ok auth-middleware`.

- [ ] **CA-14** — `npm run lint` desde la raíz pasa, con `auth-middleware`
      incluido entre los workspaces.

  ```bash
  npm run lint 2>&1 | tail -5
  npm run lint 2>&1 | grep -E "(auth-middleware|packages/auth-middleware)" | head -3
  ```

  Esperado: exit 0, `turbo` reporta `successful`; `auth-middleware` aparece
  entre los workspaces lintados.

- [ ] **CA-15** — Rama `tarea/u8-T02` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama `tarea/u8-T02`, ≥ 2 commits.

- [ ] **CA-16** — Ningún secreto en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-17** — `apps/backend/`, `apps/identity-service/`, `k8s/**/*.yaml`
      existentes, y `packages/shared-types/` **no** fueron tocados (fuera de
      alcance). El único cambio en `shared-types` permitido es **cero** —
      esta tarea importa, no modifica.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|k8s/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/" && echo "FAIL: shared-types tocado — usa candidata si necesitas algo" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-18** — El `GET /health` del `apps/backend/` (del skeleton) sigue
      intacto, para confirmar regresión cero a nivel repositorio.

  ```bash
  rm -f /tmp/health.json /tmp/server.log
  (cd apps/backend && PORT=3301 npm run start > /tmp/server.log 2>&1 &); sleep 2
  curl -sf http://localhost:3301/health -o /tmp/health.json
  pkill -f "node .*apps/backend" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("backend health broken: "+JSON.stringify(r)); console.log("backend health intact")'
  ```

  Esperado: imprime `backend health intact`.

> Si un comando no produce la salida esperada, el revisor levanta un hallazgo
> ROJO (criterio incumplido).

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- `packages/auth-middleware/src/__tests__/verify-token.test.ts`:
  - **Round-trip HS256**: firma un token con `jsonwebtoken.sign(payload,
secret, {algorithm:"HS256",expiresIn:"7d"})`, llama `verifyToken` y
    asserta que `payload.sub` sobrevive. CA-2.
  - **`JWT_SECRET` ausente** → lanza con el mensaje literal. CA-10.
  - **Algoritmo forzado**: un token firmado con `alg: "none"` NO verifica
    (sanity check de seguridad; `jsonwebtoken` lo rechaza si se restringe el
    array de algoritmos). Documenta el `algorithms:["HS256"]`.
- `packages/auth-middleware/src/__tests__/require-auth.test.ts`:
  - **Header ausente** → 401 `{data:null,error:"unauthenticated",status:401}`
    y `next` NO se llamó. CA-6.
  - **Header con scheme incorrecto** (ej. `Basic ...`) → 401 mismo body. CA-7.
  - **Header con token tampered** → 401 mismo body. CA-8.
  - **Token expirado** → 401 mismo body. CA-9.
  - **`JWT_SECRET` ausente** → 500 con `"server misconfiguration"`. CA-10.
  - **Token válido** → `next()` llamado + `req.user.userId === "user-abc"`
    - supertest ve `{userId:"user-abc"}` en el response de un handler
      encadenado. CA-11.
  - (Estructura del test: un `function makeApp()` que arma un
    `express().use(requireAuth).get("/me",(req,res)=>res.json({userId:req.user?.userId}))`
    y supertest golpea `/me` con distintos headers.)

**Rojo primero:** antes de implementar `require-auth.ts`, el codificador
escribe el test de CA-6 (sin header), lo corre, lo ve fallar (el handler no
existe o el middleware no devuelve 401), lo registra en la bitácora. Luego
implementa, luego verde. Mismo patrón para CA-11 (happy path).

---

## Notas

- **Cómo probar la happy-path sin acoplar al identity-service:** el test
  **firma su propio JWT** con `jsonwebtoken.sign(payload, secret)` usando el
  mismo secret que luego setea en `process.env.JWT_SECRET`. No importas nada
  de `apps/identity-service/`. Esto mantiene el package desacoplado y
  testeable en aislamiento.
- **Peer dep de Express:** el consumidor (identity-service, ingestion-service,
  trust-service) provee su propio Express. El package publica tipos y la
  augmentación, pero NO embute Express en su runtime. Esto evita conflictos
  de versión en el monorepo.
- **Augmentación de tipos y strictness:** si `tsconfig.json` del package
  usa `strict: true`, la asignación `req.user = { userId: ... }` requiere que
  el tipo de `Request.user` sea `{ userId: string }` **opcional** (`?:`) para
  que exista el narrowing en handlers posteriores. Déjalo opcional.
- **401 vs 500 en `JWT_SECRET` ausente:** CA-10 distingue intencionalmente
  entre "credenciales malas" (401) y "el server no tiene cómo verificar"
  (500). Es una decisión de observabilidad: en un dashboard, 401 == "mi
  frontend tiene algún bug / token caducado"; 500 == "mi deployment está
  mal configurado". Mezclarlos envenena las alertas.
- **No hagas `npm install` con `--force` ni flags raros.** Si al añadir el
  workspace nuevo el `package-lock.json` se vuelve raro, registra el síntoma
  en la bitácora; no lo escondas.
- **No cambies `packages/shared-types/`.** Si crees que necesitas añadir un
  export a `shared-types/src/auth.ts`, registra una candidata y detente. El
  revisor marcará ROJO si tocas shared-types fuera de este scope.
- **Archivos que se modifican en su sitio:** raíz `package.json` y/o
  `turbo.json` si el glob de workspaces no incluye ya `packages/*`
  (normalmente sí lo hace — verifica primero). Nada de duplicados con
  sufijo.
- **No fusiones, no pushes la rama, no corras `kubectl` ni `docker`.** Esta
  tarea no despliega nada. El destino de la cadena es un PR con su evidencia.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u8-T02`. Base:
`main`. Modelo de aislamiento: rama directa en el clon
`/Users/aureliano/Desktop/proyecto`. Con esta tarea VERDE y fusionada,
u1-T01 + u9-T01 + u11-T01 pasan a despachables **en paralelo verdadero**
(la ola que cubre el entregable «≥1 ola de ≥2 tareas en paralelo» del
módulo 6)._
