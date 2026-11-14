# u8-T01 — `apps/identity-service/` con `POST /api/auth/register` y `POST /api/auth/login` (JWT firmado local, bcrypt, SQLite), desplegado en kind

> **Primera tarea de u8-authentication.** Esta tarea entrega el servicio de
> identidad del MVP: un backend independiente en el monorepo que acepta
> registro y login de usuarios, firma JWT con una clave local, persiste el
> hash de la contraseña en SQLite, y queda desplegado en el cluster kind.
>
> Es la unidad que desbloquea u1-image-upload, u9-upload-limits y
> u11-onboarding. Sin un JWT emitido por este servicio, las tres
> unidades siguientes no tienen cómo identificar al usuario.
>
> **El middleware `requireAuth` que validará JWT en _otros_ servicios NO entra
> en esta tarea.** Se entregará en u8-T02 (como `packages/auth-middleware/`) o
> dentro de la primera unidad que proteja endpoints (u1/u9/u11). En u8-T01 el
> helper `verify(token)` de identity-service es lo único que existe de
> verificación — suficiente para los tests de los propios endpoints.

**Unidad:** u8-authentication (IdentityService)
**Historias que implementa:** US-8 (AC-8.1 registro, AC-8.2 login, AC-8.3 mensaje genérico en fallo)
**Depende de:** ninguna (u8 no tiene dependencias en el grafo). Se apoya en el
patrón de scaffolding de `apps/backend/` establecido en WS-T01..WS-T05.

---

## Alcance

**Dentro** (una línea, concreta):

> Nueva app `apps/identity-service/` (Node.js/TypeScript, Express) con tabla
> SQLite `users` (id uuid, email único, password_hash bcrypt), endpoints
> `POST /api/auth/register` (201, Zod validate → bcrypt hash → insert → JWT HS256
> con `JWT_SECRET` desde env), `POST /api/auth/login` (200, Zod validate →
> lookup → bcrypt compare → JWT, 401 genérico en cualquier fallo),
> `GET /health` (shape skeleton), Zod schemas y tipos en
> `packages/shared-types/src/auth.ts`, Dockerfile multi-stage `node:20-slim`
> con build-tools (bcrypt + better-sqlite3 nativos), manifiestos K8s en
> `k8s/identity/` (Deployment, Service, ConfigMap, Secret-plantilla), despliegue
> en kind verificado end-to-end, tests Jest con cobertura ≥80% líneas y ≥75%
> branches sobre `src/service/` y `src/handlers/`.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto o útil):

- Middleware `requireAuth` reusable para otros servicios — u8-T02 o la primera
  unidad consumidora. En esta tarea sólo existe el `verify` local de
  identity-service para sus propios tests.
- Aplicar auth al endpoint `POST /critiques` del backend-skeleton — ese
  endpoint es un stub del Walking Skeleton; lo reemplazará `POST /api/uploads`
  dentro de u1-image-upload. No se retrofiteza.
- `GET /api/users/me/limits` — pertenece a u9-upload-limits.
- `POST /api/users/me/subscribe` — pertenece a u10-mock-payment.
- Endpoints internos `/api/internal/users/:id/tier` y
  `/api/internal/users/:id/reset-counter` — u9 (tier) y u13 (reset).
- Reset de contraseña, verificación de email, cierre de sesión, blacklist de
  JWT — no están en el MVP.
- Rate limiting en los endpoints de auth — fuera del MVP académico.
- Ingress de K8s (routing `/api/auth/*` → identity-service a nivel de cluster) —
  se verifica en esta tarea con `kubectl port-forward` directo al Service, igual
  que WS-T05. El Ingress se arma cuando u1 lo necesite real.
- Cambios a `apps/backend/`, a sus manifiestos `k8s/*.yaml` existentes, a sus
  tests o a su Dockerfile.
- Cambios a `tareas/`, `revisiones/`, `bitacoras/` fuera de los archivos propios
  de esta tarea.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop (para entender el papel del
  codificador, no para alterar la tarea)
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo con `z.infer<>`,
  respuestas HTTP `{data, error, status}`, Jest + ts-jest + supertest, cobertura
  ≥80% líneas y ≥75% branches en `service/` + `handlers/`, imágenes con tag
  explícito (nunca `latest`), bcrypt para contraseñas (implícito por US-8)
- `aidlc/spaces/default/memory/project.md` — reglas duras: NEVER secretos en
  repo, ALWAYS Zod como fuente de validación, ALWAYS `JWT_SECRET` como K8s
  Secret, NEVER `latest` en manifiestos, ALWAYS `/health` + readinessProbe
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` —
  definición de u8-authentication (bcrypt, JWT 7-day TTL, 409 en duplicado)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  contrato C2 de IdentityService con los endpoints, el shape `AuthResponse` y
  los status esperados
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` —
  US-8 completa con AC-8.1, AC-8.2, AC-8.3 (mensaje genérico en fallo)
- `tareas/WS-T04-sqlite-end-to-end.md` — patrón de tarea para backend con DB
  SQLite + handlers + tests + cobertura (plantilla mental, no copiar texto)
- `tareas/WS-T05-dockerfile-k8s-kind.md` — patrón de Dockerfile multi-stage
  con `node:20-slim` + apt build-tools (bcrypt y better-sqlite3 necesitan la
  misma toolchain nativa) y despliegue a kind
- `apps/backend/Dockerfile` — Dockerfile vigente que ya resolvió el fix de
  `better-sqlite3@^12.11.1` en arm64; úsalo como molde
- `apps/backend/package.json` — versión fija `better-sqlite3@^12.11.1` a
  replicar (misma razón: SIGSEGV de prebuild arm64 en Docker)
- `packages/shared-types/src/index.ts` — barrel donde se re-exportan los schemas
- `packages/shared-types/src/anthropic.ts` — ejemplo de un módulo Zod del
  package compartido, para el estilo de los schemas de auth
- `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/configmap.yaml` —
  manifiestos de referencia del backend-skeleton (patrón de readinessProbe,
  ConfigMap, selector)
- `turbo.json` y raíz `package.json` — para registrar el nuevo workspace

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del
clon `/Users/aureliano/Desktop/proyecto` con la rama `tarea/u8-T01` checada.

- [ ] **CA-1** — `apps/identity-service/` existe como workspace del monorepo.
      `package.json` declara deps en: `express`, `better-sqlite3` (fijo
      `^12.11.1`), `bcrypt`, `jsonwebtoken`, `zod`, `@proyecto/shared-types` (como
      dependencia de workspace). Las devDeps incluyen `jest`, `ts-jest`, `supertest`,
      `typescript`, `@types/*` necesarios. El script `test` corre Jest con
      `--coverage`.

  ```bash
  node -e 'const p=require("./apps/identity-service/package.json"); const req=["express","better-sqlite3","bcrypt","jsonwebtoken","zod"]; for(const d of req){ if(!p.dependencies?.[d]) throw new Error("missing dep: "+d); } if(p.dependencies["better-sqlite3"]!=="^12.11.1") throw new Error("better-sqlite3 must be ^12.11.1, got "+p.dependencies["better-sqlite3"]); const sharedKey=Object.keys({...p.dependencies, ...p.devDependencies}).find(k=>k.includes("shared-types")); if(!sharedKey) throw new Error("shared-types workspace dep missing"); const devReq=["jest","ts-jest","supertest","typescript"]; for(const d of devReq){ if(!p.devDependencies?.[d]) throw new Error("missing devDep: "+d); } if(!/jest.*--coverage|coverage/.test(p.scripts?.test||"")) throw new Error("test script must run coverage"); console.log("ok identity-service workspace")'
  ```

  Esperado: imprime `ok identity-service workspace`.

- [ ] **CA-2** — `packages/shared-types/src/auth.ts` publica
      `RegisterRequestSchema`, `LoginRequestSchema`, `AuthResponseSchema`,
      `JwtPayloadSchema` (Zod) y sus tipos derivados vía `z.infer<>`. Están
      re-exportados desde `packages/shared-types/src/index.ts`. `tsc --noEmit`
      del package pasa limpio.

  ```bash
  test -f packages/shared-types/src/auth.ts
  grep -E "(RegisterRequestSchema|LoginRequestSchema|AuthResponseSchema|JwtPayloadSchema)" packages/shared-types/src/auth.ts | sort -u | wc -l | tr -d ' '
  grep -E "export .* from .*auth" packages/shared-types/src/index.ts
  grep -E "z\.infer" packages/shared-types/src/auth.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: los cuatro schemas aparecen (conteo `4` del `wc -l`), el `index.ts`
  los re-exporta, `z.infer` aparece al menos una vez, `tsc` exit 0.

- [ ] **CA-3** — `RegisterRequestSchema` exige `email` tipo email (Zod
      `z.string().email()`) y `password` tipo string de `min(8)`. `LoginRequestSchema`
      exige los mismos campos. Verificación semántica: un `safeParse` directo
      demuestra las cotas.

  ```bash
  node -e '
    const { RegisterRequestSchema, LoginRequestSchema } = require("./packages/shared-types/dist/index.js");
    // Si el package aún no tiene build, importa del fuente vía ts-node o espera a que CA-1 lo tenga compilado.
    const okReg = RegisterRequestSchema.safeParse({ email: "a@b.com", password: "12345678" });
    if (!okReg.success) throw new Error("register valid should pass: " + JSON.stringify(okReg.error.issues));
    const shortPass = RegisterRequestSchema.safeParse({ email: "a@b.com", password: "1234567" });
    if (shortPass.success) throw new Error("register must reject password <8 chars");
    const badEmail = RegisterRequestSchema.safeParse({ email: "not-an-email", password: "12345678" });
    if (badEmail.success) throw new Error("register must reject bad email format");
    const okLogin = LoginRequestSchema.safeParse({ email: "a@b.com", password: "12345678" });
    if (!okLogin.success) throw new Error("login valid should pass");
    console.log("auth schemas semantics ok");
  '
  ```

  Nota: si `packages/shared-types` no tiene build step, usa `ts-node --project
packages/shared-types/tsconfig.json -e` con el import relativo al `src/`. El
  codificador registra en la bitácora cuál variante usó.

  Esperado: imprime `auth schemas semantics ok`.

- [ ] **CA-4** — `apps/identity-service/src/service/database.ts` abre una
      conexión SQLite a una ruta configurable (`process.env.DB_PATH ||
'./data/identity.db'`, `':memory:'` en tests) y crea la tabla `users`
      idempotentemente con schema: `id TEXT PRIMARY KEY`, `email TEXT NOT NULL
UNIQUE`, `password_hash TEXT NOT NULL`, `created_at TEXT NOT NULL DEFAULT
CURRENT_TIMESTAMP`. El `UNIQUE` sobre `email` aparece explícito en el SQL.

  ```bash
  test -f apps/identity-service/src/service/database.ts
  grep -E "CREATE TABLE IF NOT EXISTS users" apps/identity-service/src/service/database.ts
  grep -E "email .*UNIQUE" apps/identity-service/src/service/database.ts
  grep -E "(id|email|password_hash|created_at)" apps/identity-service/src/service/database.ts | head -10
  ```

  Esperado: archivo existe, el `CREATE TABLE` está presente con `IF NOT EXISTS`,
  el `UNIQUE` en `email` está explícito, las cuatro columnas aparecen.

- [ ] **CA-5** — Repositorio
      `apps/identity-service/src/service/user-repository.ts` expone al menos
      `create({ email, passwordHash }): User` y `findByEmail(email: string): User |
null`. El tipo `User` tiene forma `{ id: string, email: string, createdAt:
string }` (no expone `password_hash`). El id es generado por el servidor
      con `crypto.randomUUID()` u otra fuente controlada; NUNCA viene del request.

  ```bash
  test -f apps/identity-service/src/service/user-repository.ts
  grep -E "(create\s*\(|findByEmail\s*\()" apps/identity-service/src/service/user-repository.ts
  grep -E "(randomUUID|uuidv4|generateId)" apps/identity-service/src/service/user-repository.ts
  # Garantía estructural: el tipo User que se exporta no incluye password_hash
  grep -E "export (type|interface) User" apps/identity-service/src/service/user-repository.ts | head -3
  ! grep -E "password_hash|passwordHash" apps/identity-service/src/service/user-repository.ts | grep -E "^\s*export.*User\b"
  ```

  Esperado: ambos métodos declarados, id generado por el servidor, tipo `User`
  exportado sin el campo `password_hash` (la grep negada sale exit 0 porque no
  encuentra la coincidencia prohibida).

- [ ] **CA-6** — `apps/identity-service/src/service/password.ts` con
      `hash(plain: string): Promise<string>` (bcrypt con cost ≥ 10) y
      `compare(plain: string, hash: string): Promise<boolean>`. Un round-trip
      demuestra que el hash no es igual al plain, que empieza por `$2a$`/`$2b$`,
      y que `compare` devuelve `true` para la contraseña correcta y `false` para
      una incorrecta.

  ```bash
  node -e '
    const { hash, compare } = require("./apps/identity-service/dist/service/password.js");
    (async () => {
      const h = await hash("hunter2hunter2");
      if (h === "hunter2hunter2") throw new Error("hash equals plaintext");
      if (!/^\$2[ab]\$\d{2}\$/.test(h)) throw new Error("hash prefix not bcrypt: " + h.slice(0,10));
      const cost = parseInt(h.match(/^\$2[ab]\$(\d{2})\$/)[1], 10);
      if (cost < 10) throw new Error("bcrypt cost must be >=10, got " + cost);
      if (!(await compare("hunter2hunter2", h))) throw new Error("compare true case failed");
      if (await compare("wrong", h)) throw new Error("compare false case leaked");
      console.log("bcrypt roundtrip ok, cost=" + cost);
    })();
  '
  ```

  Nota: si el codificador no compila a `dist/`, sustituye por `npx ts-node
--project apps/identity-service/tsconfig.json -e '<...>'` con el import
  relativo al `src/`. Registra la variante usada en la bitácora.

  Esperado: imprime `bcrypt roundtrip ok, cost=N` con N ≥ 10.

- [ ] **CA-7** — `apps/identity-service/src/service/jwt.ts` con
      `sign(payload: JwtPayload): string` (HS256, exp = 7 días = 604800 s, usa
      `process.env.JWT_SECRET`, lanza si está ausente o vacío) y `verify(token:
string): JwtPayload`. Un round-trip demuestra que `verify(sign({ sub: id })).sub
=== id` y que verificar un token inválido lanza.

  ```bash
  node -e '
    process.env.JWT_SECRET = "a-test-secret-for-ca7-only-32bytes!";
    const { sign, verify } = require("./apps/identity-service/dist/service/jwt.js");
    const t = sign({ sub: "user-123" });
    const d = verify(t);
    if (d.sub !== "user-123") throw new Error("sub mismatch: " + d.sub);
    if (!d.exp || d.exp - Math.floor(Date.now()/1000) < 7*24*3600 - 60) throw new Error("exp not ~7d: " + d.exp);
    let threw = false;
    try { verify(t + "tampered"); } catch { threw = true; }
    if (!threw) throw new Error("tampered token must throw");
    // Nunca sin secret:
    const saved = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
    let threw2 = false;
    try { sign({ sub: "x" }); } catch { threw2 = true; }
    process.env.JWT_SECRET = saved;
    if (!threw2) throw new Error("sign must throw when JWT_SECRET missing");
    console.log("jwt roundtrip ok");
  '
  ```

  Esperado: imprime `jwt roundtrip ok`.

- [ ] **CA-8** — `POST /api/auth/register` con `{email, password}` válido
      responde 201 con body `{data:{token, expiresIn:604800}, error:null,
status:201}`. Lectura de vuelta por herramienta real: `verify(data.token).sub`
      coincide con el id del usuario leído por `repo.findByEmail(email)`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | tail -25
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(register ok|201|register success)"
  ```

  Esperado: al menos un test con esos tokens pasa; la suite de auth corre sin
  skipped y en verde.

- [ ] **CA-9** — `POST /api/auth/register` con un `email` ya registrado responde
      409 con body `{data:null, error:string, status:409}` y NO crea un segundo
      registro (lectura de vuelta por conteo: `SELECT COUNT(*) FROM users WHERE
email = ?` sigue siendo 1 después del intento duplicado).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(duplicate|409|already registered)"
  ```

  Esperado: al menos un test con esos tokens pasa; el test afirma el status 409
  Y el conteo de 1 en la BD.

- [ ] **CA-10** — `POST /api/auth/register` con `password` de menos de 8
      caracteres O `email` con formato inválido responde 422 con body `{data:null,
error:string, status:422}`. El `ZodError` se mapea a 422; el mensaje no filtra
      el stack.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(422|invalid.*payload|password.*8|invalid.*email)"
  ```

  Esperado: al menos dos tests con esos tokens pasan (password corto; email
  inválido).

- [ ] **CA-11** — `POST /api/auth/login` con credenciales válidas responde 200
      con body `{data:{token, expiresIn:604800}, error:null, status:200}`.
      `verify(data.token).sub` coincide con el id del usuario registrado (lectura
      de vuelta por `jwt.verify` en el mismo test).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(login ok|login success|200.*login)"
  ```

  Esperado: al menos un test con esos tokens pasa.

- [ ] **CA-12** — `POST /api/auth/login` con password incorrecto responde 401
      con body `{data:null, error:"invalid credentials", status:401}`. El string
      del campo `error` es LITERALMENTE `"invalid credentials"` (sin detalles sobre
      qué falló).

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(wrong password|incorrect password|401)"
  grep -E "invalid credentials" apps/identity-service/src/__tests__/*.ts | head -5
  ```

  Esperado: al menos un test con esos tokens pasa; la string literal
  `invalid credentials` aparece al menos en el test que afirma el body del 401.

- [ ] **CA-13** — `POST /api/auth/login` con un `email` que no existe responde
      401 con body **idéntico** al de CA-12 (`{data:null, error:"invalid
credentials", status:401}`). AC-8.3 exige "no indication of which field was
      wrong": NO se diferencian los errores. Se verifica que ambos tests afirman
      la misma constante `invalid credentials`.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=auth 2>&1 | grep -E "(unknown email|email.*not.*exist|user.*not.*found|login.*nonexistent)"
  # Verificación cruzada: en el archivo de tests, el 401 de password-incorrecto
  # y el 401 de email-inexistente usan la misma string literal.
  # El revisor cuenta las ocurrencias y afirma simetría.
  node -e '
    const fs=require("fs"), path=require("path");
    const dir="apps/identity-service/src/__tests__";
    const files=fs.readdirSync(dir).filter(f=>/login|auth/.test(f));
    const content=files.map(f=>fs.readFileSync(path.join(dir,f),"utf8")).join("\n");
    const occurrences=(content.match(/invalid credentials/g)||[]).length;
    if(occurrences<2) throw new Error("expected invalid credentials in both wrong-password and unknown-email tests, found "+occurrences);
    console.log("generic 401 message is symmetric, occurrences="+occurrences);
  '
  ```

  Esperado: imprime `generic 401 message is symmetric, occurrences=N` con N ≥ 2.

- [ ] **CA-14** — `GET /health` responde 200 con body `{data:{status:"ok"},
error:null, status:200}` (mismo shape que el backend-skeleton). Tiene test
      supertest dedicado.

  ```bash
  npm test -w apps/identity-service -- --testPathPattern=health 2>&1 | tail -10
  ```

  Esperado: al menos 1 test de health pasa; 0 skipped.

- [ ] **CA-15** — Cobertura: `apps/identity-service/src/service/*.ts` y
      `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches.

  ```bash
  npm test -w apps/identity-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/identity-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok identity-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok identity-service service/ + handlers/`.

- [ ] **CA-16** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0, `turbo` reporta `successful` para el workspace
  `identity-service` incluido.

- [ ] **CA-17** — Dockerfile multi-stage en `apps/identity-service/Dockerfile`
      con base `node:20-slim` (glibc), stage `builder` con
      `apt-get install -y python3 make g++` (toolchain nativa para bcrypt y
      better-sqlite3), stage `runtime` sin las build-tools. La imagen se construye
      desde la raíz del workspace con tag explícito `identity-service:u8-T01` (NO
      `latest`). La construcción no falla y produce un contenedor que arranca.

  ```bash
  grep -E "FROM node:20-slim" apps/identity-service/Dockerfile
  grep -E "python3 make g\+\+" apps/identity-service/Dockerfile
  # El contexto es la raíz del workspace, igual que WS-T05:
  docker build -f apps/identity-service/Dockerfile -t identity-service:u8-T01 . 2>&1 | tail -20
  docker image inspect identity-service:u8-T01 --format '{{.Id}}' | head -1
  # Sanity: no publica ningún tag "latest" accidentalmente
  ! docker image inspect identity-service:latest 2>/dev/null | grep -E '"RepoTags"'
  ```

  Esperado: Dockerfile presente con las cadenas exigidas, `docker build` exit 0
  con el tag `identity-service:u8-T01`, imagen inspeccionable, no existe
  `identity-service:latest`.

- [ ] **CA-18** — Manifiestos K8s en `k8s/identity/` con `deployment.yaml`
      (image `identity-service:u8-T01`, `imagePullPolicy: Never`, `readinessProbe`
      sobre `/health` puerto 3100, env `JWT_SECRET` desde `secretKeyRef`),
      `service.yaml` (ClusterIP puerto 3100), `configmap.yaml` (`PORT=3100`,
      `NODE_ENV=production`, `DB_PATH=/app/data/identity.db`,
      `JWT_TTL_SECONDS=604800`), `secret.yaml.example` (plantilla SIN valor real
      de `JWT_SECRET`).

  ```bash
  for f in k8s/identity/deployment.yaml k8s/identity/service.yaml k8s/identity/configmap.yaml k8s/identity/secret.yaml.example; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
  grep -E "image: identity-service:u8-T01" k8s/identity/deployment.yaml
  grep -E "imagePullPolicy: Never" k8s/identity/deployment.yaml
  grep -E "readinessProbe" k8s/identity/deployment.yaml
  grep -E "path: /health" k8s/identity/deployment.yaml
  grep -E "secretKeyRef" k8s/identity/deployment.yaml
  grep -E "(PORT|NODE_ENV|DB_PATH|JWT_TTL_SECONDS)" k8s/identity/configmap.yaml | sort -u | wc -l | tr -d ' '
  ! grep -E "image:.*:latest" k8s/identity/deployment.yaml
  echo "manifests ok"
  ```

  Esperado: los cuatro archivos existen, el image tag está fijo a `u8-T01`,
  `imagePullPolicy: Never`, `readinessProbe` sobre `/health`, `JWT_SECRET`
  referenciado por `secretKeyRef`, las cuatro claves del ConfigMap aparecen
  (conteo `4`), `latest` ausente. Imprime `manifests ok`.

- [ ] **CA-19** — `JWT_SECRET` NUNCA aparece con valor real en el diff ni en
      el tree. Solo aparece como:
  - identificador en código: `process.env.JWT_SECRET`
  - nombre de variable en el manifest: `name: JWT_SECRET`
  - referencia simbólica: `secretKeyRef.name: jwt-secret` (y `.key: JWT_SECRET`)
  - plantilla sin valor: `secret.yaml.example` con `data: {}` o placeholder
    documentado.

  ```bash
  # No hay literales que parezcan un secreto (>=20 chars continuos alfanuméricos o hex), excepto en __tests__/ donde el secreto de prueba está documentado como no-productivo.
  git diff main..HEAD --name-only | grep -v "__tests__" | xargs -r grep -EH "JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" && echo "FAIL: posible secreto en diff" && exit 1
  # Verificación específica del secret.yaml.example: data debe estar vacío o ser un placeholder evidente
  grep -E "(JWT_SECRET:|data:)" k8s/identity/secret.yaml.example
  ! grep -E "^\s*JWT_SECRET:\s*[A-Za-z0-9+/=_-]{16,}\s*$" k8s/identity/secret.yaml.example
  echo "no real JWT_SECRET value in diff or tree"
  ```

  Esperado: imprime `no real JWT_SECRET value in diff or tree`.

- [ ] **CA-20** — Despliegue end-to-end verificado en kind:
  1. Imagen construida con tag `identity-service:u8-T01` (CA-17).
  2. `kind load docker-image identity-service:u8-T01` ejecutado y la imagen
     aparece dentro del nodo del cluster.
  3. Secret real creado fuera del repo con
     `kubectl create secret generic jwt-secret
--from-literal=JWT_SECRET=$(openssl rand -hex 32)` (o equivalente). El
     comando que se corrió queda registrado en la bitácora para auditoría.
  4. `kubectl apply -f k8s/identity/` aplica Deployment, Service y ConfigMap
     (NO el `secret.yaml.example`).
  5. `kubectl rollout status deployment/identity-service` exit 0.
  6. Pod en estado `Ready` según la `readinessProbe` (no sólo `Running`).
  7. `kubectl port-forward svc/identity-service 3100:3100` levantado en
     background para la verificación.
  8. `POST /api/auth/register` con email+password válidos devuelve 201 y
     JWT verificable con `node -e 'const j=require("jsonwebtoken"); const
d=j.decode(TOKEN); console.log(d.sub, d.exp)'` imprime `sub` (uuid) y
     `exp` ~ `now + 604800`.
  9. Procesos de port-forward matados al final; no quedan residuales.

  ```bash
  # El revisor ejecuta los pasos 1-8 secuencialmente; cada paso con su propio
  # comando. La bitácora del codificador tiene la transcripción literal. Si el
  # revisor no tiene Docker/kind (caso detectado en WS-T05 ronda 1), aplica el
  # fallback: el orquestador corre los pasos y adjunta los outputs al brief del
  # revisor, quien verifica consistencia y shape, idéntico al patrón de
  # WS-T05 ronda 2.
  # Comando atómico de sanity (asumiendo el port-forward activo):
  curl -sf -X POST http://localhost:3100/api/auth/register -H 'Content-Type: application/json' -d '{"email":"ca20@test.local","password":"testpass123"}' | tee /tmp/u8-t01-register.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u8-t01-register.json","utf8")); if(r.status!==201||r.error!==null||!r.data?.token) throw new Error("bad response: "+JSON.stringify(r)); const j=require("jsonwebtoken"); const d=j.decode(r.data.token); if(!d?.sub||!d?.exp) throw new Error("bad jwt: "+JSON.stringify(d)); const dt=d.exp-Math.floor(Date.now()/1000); if(dt<604800-120||dt>604800+120) throw new Error("exp not ~7d: "+dt); console.log("register-in-kind ok, sub="+d.sub+" exp_delta="+dt+"s")'
  ```

  Esperado: imprime `register-in-kind ok, sub=<uuid> exp_delta=~604800s`.

- [ ] **CA-21** — Rama `tarea/u8-T01` sobre `main` con ≥2 commits. El historial
      es legible (schemas → DB + repo → handlers → Dockerfile/K8s + tests, o una
      partición equivalente).

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/u8-T01`, al menos 2 commits sobre `main`.

- [ ] **CA-22** — Ningún secreto en el diff ni en el tree (misma barrera que
      WS-T03 y WS-T04, extendida a `JWT_SECRET`).

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-23** — `GET /health` del `apps/backend/` sigue respondiendo con el
      shape histórico (regresión del skeleton). Ningún archivo bajo `apps/backend/`
      ni `k8s/*.yaml` (los que ya existían) fue modificado.

  ```bash
  git diff main..HEAD --name-only | grep -E "^apps/backend/" && echo "FAIL: apps/backend/ fue tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/identity/" && echo "FAIL: k8s raíz tocado" && exit 1
  # Smoke test del backend skeleton sigue verde (si CA-17/20 dejó un pod del backend corriendo en kind, salta este smoke; si no, levanta el backend local brevemente):
  rm -f /tmp/backend-health.json /tmp/backend.log
  (cd apps/backend && PORT=3201 npm run start > /tmp/backend.log 2>&1 &); sleep 2
  curl -sf http://localhost:3201/health -o /tmp/backend-health.json
  pkill -f "node .*apps/backend" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/backend-health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("backend health broken: "+JSON.stringify(r)); console.log("backend health intact")'
  ```

  Esperado: ninguna salida de "FAIL", imprime `backend health intact`.

> **Si un criterio no tiene comando, la tarea no está lista y no se despacha.**
> Todos los CAs de arriba tienen su comando. Si un comando no produce la salida
> esperada, el revisor levanta un hallazgo ROJO (criterio incumplido).

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- `apps/identity-service/src/__tests__/user-repository.test.ts`:
  - **Round-trip**: `create({email,passwordHash})` devuelve `User` con `id`
    uuid; `findByEmail(email)` devuelve el mismo registro. CA-5.
  - **Email único**: `create` dos veces con el mismo email lanza
    `SqliteError` con código `SQLITE_CONSTRAINT_UNIQUE`. CA-14 defensa en
    profundidad.
  - **`findByEmail` no existente** devuelve `null`.
  - **Init idempotente**: llamar al init del `database` dos veces no falla ni
    duplica la tabla.
- `apps/identity-service/src/__tests__/password.test.ts`:
  - **Hash no es plaintext** y empieza por prefijo bcrypt con cost ≥ 10. CA-6.
  - **`compare` true/false** para contraseña correcta/incorrecta.
- `apps/identity-service/src/__tests__/jwt.test.ts`:
  - **Round-trip `sign`→`verify`** devuelve el mismo `sub`. CA-7.
  - **TTL ~ 7 días**: `d.exp - now ≈ 604800 s` (tolerancia ±60 s). CA-7.
  - **Tampered token** lanza. CA-7.
  - **`JWT_SECRET` ausente** hace lanzar `sign`. CA-7.
- `apps/identity-service/src/__tests__/auth-register.test.ts` (supertest sobre
  un proceso real o `createApp()` en mismo proceso):
  - **201 feliz**: body `{data:{token, expiresIn:604800},error:null,status:201}`;
    `verify(token).sub === findByEmail(email).id`. CA-8.
  - **409 duplicado**: segundo POST con el mismo email → 409; conteo en BD
    sigue 1. CA-9.
  - **422 input inválido**: password corto, email mal formado — dos tests,
    ambos 422 con body `{data:null,error:string,status:422}`. CA-10.
- `apps/identity-service/src/__tests__/auth-login.test.ts`:
  - **200 feliz**: `verify(data.token).sub === user.id`. CA-11.
  - **401 password incorrecto**: body literal
    `{data:null,error:"invalid credentials",status:401}`. CA-12.
  - **401 email inexistente**: body literal **idéntico** al de CA-12
    (asserta la misma constante). CA-13.
- `apps/identity-service/src/__tests__/health.test.ts`:
  - **200 con shape skeleton** vía supertest. CA-14.
- `packages/shared-types/src/__tests__/auth-schema.test.ts` (si el package
  tiene config de Jest; si no, el test de CA-3 cubre semánticamente los
  schemas desde un script Node):
  - **Schemas aceptan payload válido**, rechazan email mal formado, rechazan
    password < 8 chars.

**Rojo primero:** antes de implementar `register` y `login`, el codificador
escribe los tests de supertest que esperan 201 y 200, los corre, los ve fallar
(ruta no registrada, handler ausente), y lo registra en la bitácora. Luego
implementa el flujo `database → repository → password → jwt → handler → wire-up
en server.ts`. Luego vuelve a correr y los ve pasar. El par falla→pasa es la
prueba. Lo mismo para `409`, `401`, `422`: primer rojo, luego verde.

---

## Notas

- **Dónde vive la ruta de la BD:** `process.env.DB_PATH || './data/identity.db'`
  en producción/dev; `':memory:'` en los tests. Cada archivo de tests
  construye su propia instancia de `database` + `repository`; nada de estado
  global. El `/app/data/` es un `emptyDir` dentro del Pod para el MVP
  académico (persistencia real llega cuando el curso introduzca PVCs).
- **Aislamiento del `JWT_SECRET` en tests:** cada archivo de tests que usa
  `sign`/`verify` o el handler real **setea su propio** `process.env.JWT_SECRET
= 'a-test-secret-for-tests-only'` en un `beforeAll` o setup de Jest. Esto
  evita falsos verdes en CI y deja claro que la clave de prod vive sólo en el
  K8s Secret.
- **Mensaje genérico `"invalid credentials"`:** AC-8.3 exige que el 401 NO
  distinga entre "email no existe" y "password incorrecto". Implementalo en el
  handler ejecutando `bcrypt.compare` incluso cuando el usuario no existe
  (contra un hash dummy) para evitar timing side-channels, y devolviendo el
  MISMO body en ambos caminos.
- **Shape de respuesta uniforme:** mantén `{data, error, status}` en los dos
  endpoints — es la regla de `team.md`. En el feliz, `data = { token, expiresIn
}`; en el error, `data = null` y `error = string`. Nunca al revés.
- **Dependencia de workspace a `shared-types`:** en `apps/identity-service/
package.json`, la entrada debe ser `"@proyecto/shared-types": "*"` (o el
  nombre que use el workspace; `grep '"name"' packages/shared-types/package.json`
  para confirmar). Añadir el workspace a la lista de `workspaces` en la raíz
  si aún no incluye `apps/*` por glob (normalmente sí lo hace).
- **Dockerfile:** copia la estrategia de `apps/backend/Dockerfile` casi
  tal cual: `node:20-slim`, `apt-get install -y --no-install-recommends python3
make g++` en el builder, build-tools fuera del runtime, `WORKDIR /app`, copia
  `packages/shared-types` (depende el build de identity-service). El contexto
  de `docker build` es la raíz del workspace, NO `apps/identity-service/`
  (confirmado en WS-T05 lección 5).
- **Ningún `kubectl apply` desde el codificador contra el cluster compartido
  salvo para su propia verificación de CA-20.** No toques namespaces ajenos,
  no borres recursos del `apps/backend/`. Al terminar la verificación,
  **mata el `kubectl port-forward`** y deja el cluster en el mismo estado en
  que lo encontraste (los recursos de `identity-service` SÍ pueden quedar
  desplegados; no se borran).
- **Creación del Secret real:** el `kubectl create secret generic jwt-secret
--from-literal=JWT_SECRET=$(openssl rand -hex 32)` lo corre el codificador
  (o el humano, si el codificador no tiene `kubectl` con acceso al kind). El
  valor **no** entra al repo; `secret.yaml.example` queda como plantilla
  vacía con un comentario explicando el comando.
- **Archivos que se modifican en su sitio:** `packages/shared-types/src/index.ts`
  (añadir el re-export de `./auth`), raíz `package.json` y/o `turbo.json` (sólo
  si el glob de workspaces no incluye ya `apps/*`). Nada de duplicados con
  sufijo. **No toques** `apps/backend/`, los manifiestos existentes en `k8s/`
  (sólo añade `k8s/identity/`), ni `tareas/_plantilla.md`.
- **No fusiones**, no abras el PR tú mismo, no corras `kubectl apply` fuera de
  CA-20, no instales dependencias globales. El destino de la cadena es un PR
  con su evidencia; el humano fusiona.
- **Bitácora:** `bitacoras/u8-T01.md` con una entrada por ronda que describa:
  variante usada en CA-3 y CA-6 (ts-node vs. dist), comandos exactos corridos
  para CA-20, pods observados en kind, y respuestas de cada hallazgo del
  revisor por identificador en las rondas siguientes.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u8-T01`. Base:
`main`. Modelo de aislamiento: rama directa en el clon
`/Users/aureliano/Desktop/proyecto` (no se usan worktrees). Imagen Docker:
`identity-service:u8-T01` (tag explícito, nunca `:latest`). Destino K8s:
cluster local kind. Con esta tarea VERDE y fusionada, u1-image-upload,
u9-upload-limits y u11-onboarding pasan a despachables en la próxima ola._
