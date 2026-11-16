# u2-T01 — Extender `apps/ingestion-service/` con cliente Claude Vision (stub extendido): crítica categorizada en 5 categorías, schema C10

> **Tarea de u2-ai-critique.** Extiende `apps/ingestion-service/` para que
> `POST /api/uploads` llame a un cliente Claude Vision y devuelva la crítica
> categorizada completa: 5 categorías (Composition, Proportions, Line Quality,
> Values (Shading), Perspective), score 0-100, feedback por categoría, y campo
> `confidence` (HIGH/MEDIUM/LOW). Contrato C10.
>
> **Sin `ANTHROPIC_API_KEY` disponible en el cluster.** El cliente se implementa
> como **stub extendido**: si la variable de entorno `ANTHROPIC_API_KEY` no está
> presente, devuelve datos ficticios pero schema-válidos (5 categories, confidence
> HIGH, scores y feedback inventados). Si la key está presente, llama a
> `claude-3-5-sonnet-20241022` con el prompt correcto. Esto permite que el
> despliegue funcione ahora y que la clave real active la integración real sin
> cambios de código.
>
> **El fallback de LOW confidence (u3) NO entra en esta tarea.** Si el cliente
> stub devuelve HIGH, el handler lo devuelve tal cual. u3 lo interceptará en su
> propia tarea.
>
> **El decremento del contador de uploads (integración u1↔u9) tampoco entra.**
> El handler existente no llama a identity-service; sigue igual por ahora.
>
> **`apps/backend/` usa `CritiqueResponseSchema` del walking skeleton — NO
> se elimina.** Solo se añaden los schemas C10 nuevos en `anthropic.ts`. Los
> schemas del backend existentes quedan intactos para no romper `apps/backend/`.

**Unidad:** u2-ai-critique (IngestionService — extensión)
**Historias que implementa:** US-2 (AC-2.1 estructura de 5 categorías en la respuesta; AC-2.2 las 5 categorías siempre presentes, garantizado por el stub).
**Depende de:** u1-T01 fusionado (`apps/ingestion-service/` existente con `POST /api/uploads`).

---

## Alcance

**Dentro** (todo lo que el codificador debe entregar en este diff):

> **`packages/shared-types/src/anthropic.ts`**: AÑADIR (no reemplazar) los schemas
> C10: `ClaudeVisionCategorySchema` (id enum CAT-1..CAT-5, name enum Composition |
> Proportions | "Line Quality" | "Values (Shading)" | Perspective, score integer
> 0-100, feedback string ≥1 char) y `ClaudeVisionResponseSchema` (confidence:
> HIGH|MEDIUM|LOW, categories array minItems 5 maxItems 5); tipos derivados con
> `z.infer<>`. Los schemas del walking skeleton (`CritiqueResponseSchema`,
> `CritiqueRequestSchema`, `PersistedCritiqueSchema`) permanecen sin cambios.
>
> **`packages/shared-types/src/uploads.ts`**: REEMPLAZAR `UploadIdResponseSchema`
> con `UploadResultSchema` que incluye `data = {uploadId: uuid, status:
"ready"|"low_confidence", confidence: "HIGH"|"MEDIUM"|"LOW", categories: array
opcional de CategoryCritiqueSchema: {categoryId: CAT-1..5 enum, categoryName:
enum, score integer 0-100, feedback string ≥1}, fallbackReason: opcional enum
"low_confidence_flag"|"invalid_schema"|"timeout"}` y la envoltura uniforme
> `{error: null, status: 202}`. Tipo `UploadResult` derivado con `z.infer<>`.
>
> **`apps/ingestion-service/package.json`**: añadir `"@anthropic-ai/sdk": "^0.39.0"`
> (o la última versión estable disponible en npm) como dependencia de producción.
>
> **`apps/ingestion-service/src/service/claude-client.ts`**: nuevo módulo que exporta
> `callClaudeVision(imageBuffer: Buffer): Promise<ClaudeVisionResponse>`. Si
> `process.env.ANTHROPIC_API_KEY` no está definido, devuelve stub hardcodeado:
> confidence "HIGH", las 5 categories con ids CAT-1..CAT-5, nombres correctos,
> scores plausibles (ej. 72, 68, 75, 60, 55), y al menos 2 frases de feedback
> por categoría (texto inventado en inglés). Si la key está definida, llama a
> `claude-3-5-sonnet-20241022` vía `@anthropic-ai/sdk` con timeout de 30 000 ms
> (`AbortSignal.timeout(30_000)` o equivalente del SDK), instruyendo a Claude a
> devolver JSON con el schema exacto de C10.
>
> **`apps/ingestion-service/src/__tests__/claude-client.contract.test.ts`**:
> contract test que llama `callClaudeVision(Buffer.from([0xFF,0xD8,0xFF,0xE0]))` sin
> `ANTHROPIC_API_KEY` (stub path) y valida el resultado con
> `ClaudeVisionResponseSchema.safeParse()`. Falla si parse falla.
>
> **`apps/ingestion-service/src/handlers/uploads.ts`**: actualizar el handler
> para que, después de guardar el blob, llame a `claudeClient(buffer)` e incluya
> el resultado en la respuesta 202: `{data: {uploadId, status:"ready", confidence,
categories}, error:null, status:202}`. La función `claudeClient` se inyecta via
> `AppDeps` en `server.ts` (tipo `(buf: Buffer) => Promise<ClaudeVisionResponse>`).
>
> **`apps/ingestion-service/src/server.ts`**: añadir `claudeClient?` a `AppDeps`.
> En tests se inyecta una función stub. En producción se importa `callClaudeVision`.
>
> **`apps/ingestion-service/Dockerfile`**: solo cambiar el tag. No añadir nada más
> (auth-middleware ya está en el Dockerfile; `@anthropic-ai/sdk` se instala via
> `npm ci` al estar en `package.json`).
>
> **`k8s/ingestion/deployment.yaml`**: actualizar `image:` a
> `ingestion-service:u2-T01` y añadir en el contenedor un bloque `env:` con
> `ANTHROPIC_API_KEY` referenciando `secretKeyRef.name: anthropic-key`,
> `secretKeyRef.key: api-key`, con `optional: true` (pod arranca sin el secret).

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Low-confidence fallback (detectar `confidence: LOW`, schema inválido, timeout) — u3-T01.
- Persistencia de CategoryCritique en BD (`category_critiques` table) — u4-T01.
- Decremento del contador de uploads al subir (integración u1↔u9) — tarea futura de integración.
- Endpoint `GET /api/uploads/:uploadId` (C1 UploadDetail) — u4-T01.
- Eliminar o modificar `CritiqueResponseSchema`, `CritiqueRequestSchema`, `PersistedCritiqueSchema` del walking skeleton en `anthropic.ts` — rompe `apps/backend/`.
- Cambios a `apps/backend/`, `apps/identity-service/`, `apps/trust-service/`.
- Cambios a `packages/auth-middleware/`.
- Cambios a `k8s/*.yaml` raíz o manifiestos distintos de `k8s/ingestion/deployment.yaml`.
- Cambios a `apps/ingestion-service/src/service/{database,magic-number,blob-store,upload-repository}.ts` existentes.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, shape `{data,error,status}`, Jest + ts-jest + supertest, cobertura ≥80%/≥75%, tipos compartidos en `@proyecto/shared-types`, tags explícitos
- `aidlc/spaces/default/memory/project.md` — reglas duras (nunca secretos en repo, validar magic-number, UUID server-side)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u2-ai-critique
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — contratos C1 (UploadResult shape) y C10 (ClaudeVisionResponse schema exacto)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` — US-2 (AC-2.1, AC-2.2)
- `packages/shared-types/src/anthropic.ts` — schemas del walking skeleton que deben permanecer; AÑADIR los nuevos encima o debajo
- `packages/shared-types/src/uploads.ts` — schema upload que se actualiza
- `packages/shared-types/src/index.ts` — barrel (anthropic y uploads ya re-exportados; NO tocar el barrel)
- `apps/ingestion-service/src/handlers/uploads.ts` — handler que se extiende
- `apps/ingestion-service/src/server.ts` — AppDeps donde se inyecta claudeClient
- `apps/ingestion-service/src/service/blob-store.ts` — no cambia; el handler ya lo llama antes de llegar a Claude
- `apps/ingestion-service/Dockerfile` — solo cambia el tag
- `k8s/ingestion/deployment.yaml` — manifiesto a actualizar
- `tareas/u1-T01-ingestion-service-upload.md` — molde mental del handler existente

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/u2-T01` checada.

- [ ] **CA-1** — `packages/shared-types/src/anthropic.ts` exporta `ClaudeVisionResponseSchema` y
      `ClaudeVisionCategorySchema` con el schema exacto de C10 (confidence HIGH|MEDIUM|LOW, categories
      5 items con id CAT-1..5, name enum, score 0-100, feedback string). Los schemas del walking
      skeleton (`CritiqueResponseSchema`, `CritiqueRequestSchema`, `PersistedCritiqueSchema`) siguen
      exportados sin cambios. `tsc --noEmit` del package pasa.

  ```bash
  grep -E "ClaudeVisionResponseSchema" packages/shared-types/src/anthropic.ts
  grep -E "ClaudeVisionCategorySchema" packages/shared-types/src/anthropic.ts
  grep -E "CritiqueResponseSchema" packages/shared-types/src/anthropic.ts
  grep -E "CAT-[1-5]" packages/shared-types/src/anthropic.ts
  grep -E "HIGH.*MEDIUM.*LOW|confidence" packages/shared-types/src/anthropic.ts | head -3
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: ambos conjuntos de schemas presentes, `tsc` exit 0.

- [ ] **CA-2** — `packages/shared-types/src/uploads.ts` exporta `UploadResultSchema` con campos
      `uploadId` (uuid), `status` (ready|low_confidence), `confidence` (HIGH|MEDIUM|LOW), `categories`
      (array opcional de objetos con `categoryId` CAT-1..5, `categoryName` enum, `score` integer 0-100,
      `feedback` string), `fallbackReason` (opcional). `tsc --noEmit` pasa.

  ```bash
  grep -E "UploadResultSchema" packages/shared-types/src/uploads.ts
  grep -E "ready.*low_confidence|low_confidence.*ready" packages/shared-types/src/uploads.ts
  grep -E "HIGH.*MEDIUM.*LOW|confidence" packages/shared-types/src/uploads.ts | head -3
  grep -E "categoryId|categoryName" packages/shared-types/src/uploads.ts
  grep -E "z\.infer" packages/shared-types/src/uploads.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: schema presente con todos los campos, `tsc` exit 0.

- [ ] **CA-3** — `apps/ingestion-service/package.json` declara `@anthropic-ai/sdk` en dependencies.

  ```bash
  node -e 'const p=require("./apps/ingestion-service/package.json"); if(!p.dependencies["@anthropic-ai/sdk"]) throw new Error("@anthropic-ai/sdk not in deps"); console.log("anthropic sdk dep ok:", p.dependencies["@anthropic-ai/sdk"])'
  ```

  Esperado: imprime `anthropic sdk dep ok: <versión>`.

- [ ] **CA-4** — `apps/ingestion-service/src/service/claude-client.ts` existe, exporta `callClaudeVision`,
      referencia `process.env.ANTHROPIC_API_KEY` y el modelo `claude-3-5-sonnet-20241022`.

  ```bash
  test -f apps/ingestion-service/src/service/claude-client.ts && echo "file ok"
  grep -E "export.*callClaudeVision|export function callClaudeVision|export const callClaudeVision" apps/ingestion-service/src/service/claude-client.ts
  grep -E "ANTHROPIC_API_KEY" apps/ingestion-service/src/service/claude-client.ts
  grep -E "claude-3-5-sonnet-20241022" apps/ingestion-service/src/service/claude-client.ts
  ```

  Esperado: archivo presente, función exportada, referencia a la env var y al model ID.

- [ ] **CA-5** — Contract test pasa: `callClaudeVision` sin `ANTHROPIC_API_KEY` (stub path) devuelve
      un objeto válido según `ClaudeVisionResponseSchema`: confidence válido, exactamente 5 categories,
      ids correctos, scores en rango 0-100, feedback no vacío.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=claude-client.contract --no-coverage 2>&1 | tail -15
  ```

  Esperado: suite pasa, 0 failures. El test valida schema con `safeParse` o `parse`.

- [ ] **CA-6** — `POST /api/uploads` con imagen JPEG válida y JWT válido devuelve **202** con body
      `{data:{uploadId:<uuid>,status:"ready",confidence:"HIGH",categories:[<5 objetos>]},error:null,status:202}`.
      Cada objeto de `categories` tiene `categoryId` (CAT-1..CAT-5), `categoryName`, `score` (0-100 integer),
      `feedback` (string no vacío).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(ready|categories|CA-6|202.*critique|5 categ)"
  grep -E "status.*ready|confidence.*HIGH|categories.*length" apps/ingestion-service/src/__tests__/uploads*.ts 2>/dev/null | head -10
  ```

  Esperado: al menos un test afirma `status:"ready"`, `confidence:"HIGH"`, y 5 categories.

- [ ] **CA-7** — `POST /api/uploads` sin header `Authorization` sigue devolviendo **401**
      `{data:null,error:"unauthenticated",status:401}`. Regresión u1-T01.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(401|unauthenticated)"
  ```

  Esperado: test de 401 pasa.

- [ ] **CA-8** — `POST /api/uploads` con archivo cuyo magic number no es JPEG/PNG/WebP sigue devolviendo
      **422**. Regresión u1-T01.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(422|magic|invalid.*format|format.*invalid)"
  ```

  Esperado: test de 422 pasa.

- [ ] **CA-9** — `apps/backend/` sigue compilando y sus tests siguen verdes (los schemas del walking
      skeleton en `anthropic.ts` no se rompieron).

  ```bash
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: `tsc` exit 0, 0 tests fallan en backend.

- [ ] **CA-10** — Cobertura: `apps/ingestion-service/src/service/*.ts` y `src/handlers/*.ts` cumplen
      ≥80% líneas y ≥75% branches (incluyendo `claude-client.ts`).

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -5
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-11** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0.

- [ ] **CA-12** — Nueva imagen `ingestion-service:u2-T01` construida, sin tag `latest`.

  ```bash
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u2-T01 . 2>&1 | tail -20
  docker image inspect ingestion-service:u2-T01 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `latest` ausente.

- [ ] **CA-13** — `k8s/ingestion/deployment.yaml` actualizado: `image: ingestion-service:u2-T01` y bloque
      `env:` con `ANTHROPIC_API_KEY` referenciando secret `anthropic-key` / key `api-key` con
      `optional: true`. El tag anterior `ingestion-service:u1-T01` no aparece.

  ```bash
  grep -E "image: ingestion-service:u2-T01" k8s/ingestion/deployment.yaml
  grep -E "ANTHROPIC_API_KEY" k8s/ingestion/deployment.yaml
  grep -E "optional: true" k8s/ingestion/deployment.yaml
  grep -E "anthropic-key" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:u1-T01" k8s/ingestion/deployment.yaml && echo "old tag absent"
  ```

  Esperado: nuevo tag, env var opcional referenciando el secret.

- [ ] **CA-14** — Despliegue end-to-end en kind: pod Running, `POST /api/uploads` con imagen JPEG devuelve
      202 con 5 categories en body.

  Pasos previos (el codificador los hace; el revisor los ejecuta para verificar):
  1. `kind load docker-image ingestion-service:u2-T01`
  2. `kubectl apply -f k8s/ingestion/deployment.yaml`
  3. `kubectl rollout status deployment/ingestion-service` exit 0
  4. `kubectl port-forward svc/ingestion-service 3200:3200` activo en segundo plano
  5. JWT de identity-service: `export JWT_TOKEN=$(curl -sf -X POST http://localhost:3100/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"testpass123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")`
     (si el usuario no existe: usar `register` con status 201 en vez de `login`)

  ```bash
  # Crear imagen JPEG mínima válida si no hay una a mano:
  python3 -c "open('/tmp/test-image.jpg','wb').write(bytes([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00]))"
  curl -sf -X POST http://localhost:3200/api/uploads \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -F "file=@/tmp/test-image.jpg" | tee /tmp/u2-upload.json
  node -e '
    const r = JSON.parse(require("fs").readFileSync("/tmp/u2-upload.json","utf8"));
    if (r.status!==202||r.error!==null) throw new Error("bad status: "+JSON.stringify(r));
    if (!r.data.uploadId) throw new Error("no uploadId");
    if (r.data.status!=="ready") throw new Error("expected ready, got: "+r.data.status);
    if (!Array.isArray(r.data.categories)||r.data.categories.length!==5) throw new Error("expected 5 categories: "+JSON.stringify(r.data.categories));
    const ids=r.data.categories.map(c=>c.categoryId).sort().join(",");
    if(ids!=="CAT-1,CAT-2,CAT-3,CAT-4,CAT-5") throw new Error("wrong ids: "+ids);
    console.log("upload+critique ok, uploadId="+r.data.uploadId+" confidence="+r.data.confidence);
  '
  ```

  Esperado: imprime `upload+critique ok, uploadId=<uuid> confidence=HIGH`.

- [ ] **CA-15** — No hay secretos en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\.ANTHROPIC_API_KEY" | grep -v "process\.env\.JWT_SECRET" | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\.ANTHROPIC_API_KEY" | grep -v "process\.env\.JWT_SECRET" | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-16** — Scope respetado: `apps/identity-service/`, `apps/trust-service/`, `apps/backend/`,
      `packages/auth-middleware/` no fueron tocados. `packages/shared-types/` solo recibió
      actualizaciones en `src/anthropic.ts` y `src/uploads.ts`; `src/index.ts` no cambió. Los manifiestos
      `k8s/*.yaml` raíz no cambiaron. Ningún archivo existente en `src/service/` del ingestion distinto
      de `claude-client.ts` (nuevo) fue modificado.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/identity-service/|apps/trust-service/|apps/backend/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/ingestion/" && echo "FAIL: k8s raiz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/src/" | grep -vE "(anthropic\.ts|uploads\.ts)" && echo "FAIL: shared-types alcance excedido" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/ingestion-service/src/service/(database|magic-number|blob-store|upload-repository)\.ts$" && echo "FAIL: service files no modificables tocados" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-17** — Rama `tarea/u2-T01` sobre `main` con ≥2 commits legibles.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama `tarea/u2-T01`, al menos 2 commits.

---

## Plan de pruebas

- `apps/ingestion-service/src/__tests__/claude-client.contract.test.ts`:
  - **schema válido sin API key**: llama `callClaudeVision(minimalJpegBuffer)` sin `ANTHROPIC_API_KEY`,
    valida con `ClaudeVisionResponseSchema.safeParse()` — `.success === true`. CA-5.
  - **5 categories**: afirma `response.categories.length === 5`. CA-5.
  - **IDs correctos**: ids son exactamente `["CAT-1","CAT-2","CAT-3","CAT-4","CAT-5"]` (sort). CA-5.
  - **scores en rango**: cada `score >= 0 && score <= 100`. CA-5.
  - **feedback no vacío**: cada `feedback.length > 0`. CA-5.

- Extensión/reescritura de `apps/ingestion-service/src/__tests__/uploads*.test.ts`:
  - Inyectar `claudeClient` stub via `AppDeps` que devuelve respuesta válida.
  - **202 con 5 categories**: `POST /api/uploads` con JPEG válido → `data.status = "ready"`,
    `data.confidence = "HIGH"`, `data.categories.length = 5`, cada category tiene `categoryId`,
    `categoryName`, `score`, `feedback`. CA-6.
  - **401 sin auth** sigue → regresión CA-7.
  - **422 magic number inválido** sigue → regresión CA-8.

---

## Notas

- **Sin ANTHROPIC_API_KEY**: el stub devuelve siempre `confidence: "HIGH"` con scores ficticios.
  Cuando el usuario añada la key como K8s Secret `anthropic-key` (key: `api-key`) y reinicie el pod,
  la misma imagen Docker llamará a Claude real sin reconstruir. El Secret se crea con:
  `kubectl create secret generic anthropic-key --from-literal=api-key=<tu-key>`.
- **Modelo**: `claude-3-5-sonnet-20241022`. Este string debe aparecer literalmente en el código.
- **Timeout**: 30 000 ms (FR-3.3). Implementar en la llamada real con `AbortSignal.timeout(30_000)`
  o el timeout nativo del SDK. En el stub no aplica.
- **Prompt engineering**: el prompt al modelo real debe instruir a devolver JSON con el schema C10 exacto.
  Una estrategia válida: system prompt con la estructura JSON explícita, user message con el attachment
  de imagen en base64. El codificador elige la implementación; el contrato es el schema C10.
- **`apps/backend/` backward compat**: `CritiqueResponseSchema` del walking skeleton usa `score 0-10`
  y campos distintos a los de C10. No conflictan porque son schemas distintos con nombres distintos.
  Verificar con `npx tsc --noEmit -p apps/backend` antes de cerrar (CA-9).
- **Inyección de claudeClient**: añadir `claudeClient?: (buf: Buffer) => Promise<ClaudeVisionResponse>`
  a `AppDeps` en `server.ts`. En tests, inyectar un stub que devuelva datos fijos. En producción,
  importar `callClaudeVision` directamente. Esto evita que los tests de uploads llamen a la red.
- **`@anthropic-ai/sdk` versión**: instalar la versión estable más reciente. Si hay conflicto con peer
  deps, documentarlo en la bitácora y resolverlo con `--legacy-peer-deps` si es necesario.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-14.
- **Bitácora**: `bitacoras/u2-T01.md` con entradas por ronda: versión de `@anthropic-ai/sdk` instalada,
  si el Dockerfile requirió cambios adicionales, el prompt enviado a Claude si implementaste la rama real,
  respuestas a hallazgos del revisor por identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u2-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u2-T01`. Imagen Docker: `ingestion-service:u2-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 2** (u2-T01 + u10-T01 + u12-T01) — despachada en paralelo._
