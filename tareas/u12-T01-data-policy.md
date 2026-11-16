# u12-T01 — Extender `apps/trust-service/` con `GET /api/policy` (texto de política de datos estático)

> **Tarea de u12-data-policy.** Extiende `apps/trust-service/` con un endpoint
> estático `GET /api/policy` que devuelve el texto plano de la política de datos
> de Estudio. El texto está hardcodeado en el handler (no hay BD para contenido
> estático). Autenticación requerida (`@proyecto/auth-middleware`).
>
> **Contenido inventado**: el texto de la política se redacta directamente en el
> handler. Debe mencionar explícitamente que las imágenes NO se usan para entrenar
> modelos sin consentimiento separado y explícito (AC-12.2), y que el usuario puede
> borrar su historial en Settings. El humano revisará el texto en un paso posterior.
>
> **Sin cambios al módulo de onboarding**: toda la lógica de onboarding existente
> (`apps/trust-service/src/handlers/onboarding.ts`, `src/service/`) permanece sin
> modificaciones. Esta tarea solo añade un nuevo handler.

**Unidad:** u12-data-policy (TrustService — extensión)
**Historias que implementa:** US-12 (AC-12.1 política accesible en ≤2 clicks — verificada a nivel de endpoint REST; AC-12.2 declaración de no-training con referencia al borrado).
**Depende de:** u11-T01 fusionado (trust-service existente con onboarding, `@proyecto/auth-middleware` ya en Dockerfile).

---

## Alcance

**Dentro** (todo lo que el codificador debe entregar en este diff):

> **`packages/shared-types/src/policy.ts`**: nuevo módulo con `PolicyResponseSchema`
> (Zod): `z.object({ data: z.object({ content: z.string().min(1) }), error: z.null(),
status: z.literal(200) })`. Tipo `PolicyResponse` derivado con `z.infer<>`.
>
> **`packages/shared-types/src/index.ts`**: añadir `export * from "./policy"` al
> barrel (es el único nuevo módulo de shared-types en esta tarea).
>
> **`apps/trust-service/src/handlers/policy.ts`**: nuevo módulo que exporta
> `createPolicyRouter({ policyContent?: string })`. El texto por defecto
> (hardcodeado en el módulo como constante) cumple AC-12.2: menciona que las
> imágenes nunca se usan para entrenar modelos sin consentimiento explícito
> separado, e indica cómo borrar el historial (referencia a Settings). Mínimo
> 3 párrafos / 150 caracteres. Registra `GET /` bajo el prefix `/api/policy`,
> protegido por `requireAuth` de `@proyecto/auth-middleware`. Responde
> `{data:{content:<texto>},error:null,status:200}`.
> `policyContent` inyectable en tests (si se pasa, usa ese; si no, usa el default).
>
> **`apps/trust-service/src/server.ts`**: añadir `policyContent?: string` a
> `AppDeps`. Importar `createPolicyRouter` y registrar
> `app.use("/api/policy", requireAuth, createPolicyRouter({ policyContent: deps?.policyContent }))`.
>
> **`apps/trust-service/Dockerfile`**: solo cambiar el tag. Auth-middleware ya
> está construido desde u11-T01; no añadir nada más.
>
> **`k8s/trust/deployment.yaml`**: actualizar `image:` a `trust-service:u12-T01`.
> Diff limitado a la línea del tag.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Endpoint `DELETE /api/history` (C4) — u13-T01.
- Contenido de política desde base de datos o archivo externo — es estático en el MVP.
- Internacionalización del texto — fuera del MVP.
- Cambios a `apps/ingestion-service/`, `apps/identity-service/`, `apps/backend/`.
- Cambios a `packages/auth-middleware/`.
- Cambios a `k8s/*.yaml` raíz o manifiestos distintos de `k8s/trust/deployment.yaml`.
- Cambios a `apps/trust-service/src/handlers/onboarding.ts` o cualquier archivo en
  `apps/trust-service/src/service/`.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, shape `{data,error,status}`, Jest + ts-jest + supertest, cobertura ≥80%/≥75%, tags explícitos
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u12-data-policy
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — contrato C4 (`GET /api/policy` con response schema)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` — US-12 (AC-12.1, AC-12.2)
- `packages/shared-types/src/index.ts` — barrel donde añadir el nuevo re-export
- `apps/trust-service/src/server.ts` — AppDeps donde registrar la nueva ruta
- `apps/trust-service/src/handlers/onboarding.ts` — patrón de handler con requireAuth inyectado en server.ts
- `apps/trust-service/Dockerfile` — solo cambia el tag; auth-middleware ya está en el builder
- `k8s/trust/deployment.yaml` — manifiesto a actualizar
- `tareas/u11-T01-trust-service-onboarding.md` — molde del patrón que extiendes

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/u12-T01` checada.

- [ ] **CA-1** — `packages/shared-types/src/policy.ts` exporta `PolicyResponseSchema` con
      `data = {content: z.string().min(1)}` y tipo `PolicyResponse` via `z.infer<>`.
      Re-exportado desde `packages/shared-types/src/index.ts`. `tsc --noEmit` del package pasa.

  ```bash
  test -f packages/shared-types/src/policy.ts && echo "file ok"
  grep -E "PolicyResponseSchema" packages/shared-types/src/policy.ts
  grep -E "z\.infer" packages/shared-types/src/policy.ts
  grep -E "export.*from.*['\"].*policy" packages/shared-types/src/index.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: schema presente, re-exportado desde el barrel, `tsc` exit 0.

- [ ] **CA-2** — `apps/trust-service/src/handlers/policy.ts` exporta `createPolicyRouter`.
      El texto de política hardcodeado menciona explícitamente: (a) que las imágenes NO se usan
      para entrenar modelos sin consentimiento explícito y separado, (b) cómo borrar el historial
      (referencia a Settings).

  ```bash
  test -f apps/trust-service/src/handlers/policy.ts && echo "file ok"
  grep -E "createPolicyRouter" apps/trust-service/src/handlers/policy.ts
  grep -iE "(not.*used.*train|train.*without.*consent|no.*training|images.*never.*train|never.*used.*to.*train)" apps/trust-service/src/handlers/policy.ts
  grep -iE "(delete|deletion|Settings|borrar|eliminar)" apps/trust-service/src/handlers/policy.ts
  ```

  Esperado: handler exportado, texto menciona no-training y mecanismo de borrado.

- [ ] **CA-3** — `GET /api/policy` SIN header `Authorization` devuelve
      **401** `{data:null,error:"unauthenticated",status:401}`.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=policy --no-coverage 2>&1 | grep -E "(401|unauthenticated)"
  ```

  Esperado: test de 401 pasa.

- [ ] **CA-4** — `GET /api/policy` con JWT válido devuelve **200** con body
      `{data:{content:<string no vacío ≥50 chars>},error:null,status:200}`.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=policy --no-coverage 2>&1 | grep -E "(200|content.*polic|polic.*content|data\.content)"
  grep -E "content.*length|\.length.*50|toHaveLength|content.*truthy|content\.length" apps/trust-service/src/__tests__/*.ts 2>/dev/null | head -5
  ```

  Esperado: test de 200 pasa; al menos un test verifica que `content` tiene ≥50 chars o no está vacío.

- [ ] **CA-5** — La respuesta cumple `PolicyResponseSchema`: `PolicyResponseSchema.parse(body)` no arroja.
      Al menos un test lo verifica explícitamente.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern=policy --no-coverage 2>&1 | grep -E "(schema|PolicyResponseSchema|parse|safeParse)"
  grep -E "PolicyResponseSchema" apps/trust-service/src/__tests__/*.ts 2>/dev/null | head -5
  ```

  Esperado: al menos un test importa `PolicyResponseSchema` y lo usa para validar.

- [ ] **CA-6** — Los endpoints de u11-T01 (`GET /api/onboarding`, `POST /api/onboarding`, `GET /health`)
      siguen verdes. Regresión de u11.

  ```bash
  npm test -w apps/trust-service -- --testPathPattern="(onboarding|health)" --no-coverage 2>&1 | tail -20
  ```

  Esperado: 0 tests fallan.

- [ ] **CA-7** — Cobertura: `apps/trust-service/src/handlers/*.ts` cumple ≥80% líneas y ≥75% branches
      (incluyendo `policy.ts` nuevo).

  ```bash
  npm test -w apps/trust-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -5
  cat apps/trust-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const bucket="/src/handlers/"; const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } console.log("coverage ok trust-service handlers/")})'
  ```

  Esperado: imprime `coverage ok trust-service handlers/`.

- [ ] **CA-8** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0.

- [ ] **CA-9** — Nueva imagen `trust-service:u12-T01` construida, sin tag `latest`. El Dockerfile
      ya incluye el build de `@proyecto/auth-middleware` (desde u11); verificar que no se rompió.

  ```bash
  grep -E "npm run build -w.*auth-middleware|npm run build -w packages/auth-middleware" apps/trust-service/Dockerfile
  docker build -f apps/trust-service/Dockerfile -t trust-service:u12-T01 . 2>&1 | tail -20
  docker image inspect trust-service:u12-T01 --format '{{.Id}}' | head -1
  ! docker image inspect trust-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: auth-middleware en Dockerfile, build exit 0, `latest` ausente.

- [ ] **CA-10** — `k8s/trust/deployment.yaml` actualizado: `image: trust-service:u12-T01`.
      Diff limitado a la línea del tag.

  ```bash
  grep -E "image: trust-service:u12-T01" k8s/trust/deployment.yaml
  ! grep -E "image: trust-service:u11-T01" k8s/trust/deployment.yaml && echo "old tag absent"
  git diff main..HEAD -- k8s/trust/deployment.yaml | grep -E "^[-+][^-+]" | grep -v "^[-+]$" | tee /tmp/u12-deploy-diff.txt
  node -e 'const l=require("fs").readFileSync("/tmp/u12-deploy-diff.txt","utf8").split("\n").filter(Boolean); const bad=l.filter(x=>!/image: trust-service:(u11-T01|u12-T01)/.test(x)); if(bad.length) throw new Error("manifest changed beyond image tag: "+bad.join("|")); console.log("manifest diff limited to image tag")'
  ```

  Esperado: imprime `manifest diff limited to image tag`.

- [ ] **CA-11** — Despliegue end-to-end en kind: pod Running, `GET /api/policy` con JWT devuelve
      200 con texto de política.

  Pasos previos (el codificador los hace; el revisor los ejecuta para verificar):
  1. `kind load docker-image trust-service:u12-T01`
  2. `kubectl apply -f k8s/trust/deployment.yaml`
  3. `kubectl rollout status deployment/trust-service` exit 0
  4. `kubectl port-forward svc/trust-service 3300:3300` activo en segundo plano
  5. `export JWT_TOKEN=<JWT de identity-service>`

  ```bash
  curl -sf http://localhost:3300/api/policy -H "Authorization: Bearer $JWT_TOKEN" | tee /tmp/u12-policy.json
  node -e '
    const r = JSON.parse(require("fs").readFileSync("/tmp/u12-policy.json","utf8"));
    if (r.status!==200||r.error!==null) throw new Error("bad status: "+JSON.stringify(r));
    if (!r.data||typeof r.data.content!=="string"||r.data.content.length<50)
      throw new Error("content too short or missing: "+JSON.stringify(r.data));
    const lower = r.data.content.toLowerCase();
    if (!lower.includes("train")) throw new Error("content does not mention training");
    console.log("policy ok, content length="+r.data.content.length+" chars");
  '
  ```

  Esperado: imprime `policy ok, content length=<n> chars`.

- [ ] **CA-12** — No hay secretos en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-13** — Scope respetado: `apps/ingestion-service/`, `apps/identity-service/`, `apps/backend/`,
      `packages/auth-middleware/` no tocados. `packages/shared-types/` solo recibió `src/policy.ts`
      (nuevo) y `src/index.ts` (barrel actualizado). `k8s/*.yaml` raíz no tocados.
      `apps/trust-service/src/handlers/onboarding.ts` y `src/service/` no tocados.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/ingestion-service/|apps/identity-service/|apps/backend/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/trust/" && echo "FAIL: k8s raiz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/src/" | grep -vE "(policy\.ts|index\.ts)" && echo "FAIL: shared-types alcance excedido" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/trust-service/src/(handlers/onboarding|service/)" && echo "FAIL: archivos no modificables tocados" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-14** — Rama `tarea/u12-T01` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama `tarea/u12-T01`, al menos 2 commits.

---

## Plan de pruebas

- `apps/trust-service/src/__tests__/policy-http.test.ts`:
  - **401 sin auth** → `{data:null,error:"unauthenticated",status:401}`. CA-3.
  - **200 con JWT válido** → body `{data:{content:<string>},error:null,status:200}`, `content.length >= 50`. CA-4.
  - **schema válido** → `PolicyResponseSchema.parse(response.body)` no arroja. CA-5.
  - **content menciona no-training** → `body.data.content.toLowerCase().includes("train")`. CA-2 / AC-12.2.
  - **content menciona borrado** → `body.data.content.toLowerCase()` incluye `"delete"` o `"settings"`. CA-2 / AC-12.2.

---

## Notas

- **Texto de la política** (guía para el codificador): redactar 3 párrafos en inglés o español:
  1. Qué datos almacena Estudio: imágenes subidas, historiales de crítica.
  2. Declaración de no-training: "Your images and critique history are never used to train AI models
     without your explicit and separate consent."
  3. Cómo borrar: "You can permanently delete all your data at any time from Settings → Delete my history."
     El texto inventado es placeholder; el humano lo refinará si lo considera necesario.
- **Auth en trust-service**: el Dockerfile ya construye `@proyecto/auth-middleware` (desde u11-T01).
  CA-9 verifica la línea; si falta, añadirla y documentarlo en la bitácora.
- **`packages/shared-types/src/index.ts`**: u12 es la única tarea de la ola 2 que añade un nuevo
  módulo al barrel. Si u2-T01 o u10-T01 se fusionan primero y tocan el barrel, habrá un conflicto
  trivial en esta línea al abrir el PR. Registrarlo en la bitácora como riesgo esperado.
- **Cobertura de `src/service/`**: u12 no añade archivos en `service/`; la cobertura del service
  existente (onboarding-repository) no se ve afectada por esta tarea. CA-7 verifica solo `handlers/`.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-11.
- **Bitácora**: `bitacoras/u12-T01.md` con entradas por ronda: texto de política exacto usado, si el
  Dockerfile requirió ajuste, respuestas a hallazgos del revisor por identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u12-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u12-T01`. Imagen Docker: `trust-service:u12-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 2** (u2-T01 + u10-T01 + u12-T01) — despachada en paralelo._
