# u1-T01 — `apps/ingestion-service/` con `POST /api/uploads` (multipart JPEG/PNG/WebP, 10 MB, magic-number, filename server-side, blob en PVC), auth via `@proyecto/auth-middleware`, desplegado en kind

> **Primera tarea de u1-image-upload.** Esta tarea entrega el servicio de
> ingesta del MVP: un backend independiente en el monorepo que acepta la
> subida de imágenes autenticadas, valida formato por magic-number, genera
> el nombre de archivo en el servidor, persiste el blob en un `PersistentVolume`
> del cluster kind y crea el registro de upload en SQLite. Queda desplegado
> end-to-end y verificado con un POST real contra el pod.
>
> Es una de las tres tareas de la **ola 1** (u1-T01 + u9-T01 + u11-T01), todas
> habilitadas por u8 (identity-service + auth-middleware ya fusionados). Nadie
> toca el worktree del otro: cada tarea va en su propia rama.
>
> **El procesamiento de la crítica con Claude NO entra en esta tarea.** La
> respuesta del endpoint se limita al `uploadId` creado; el campo `categories`
> y el estado real (`ready`/`low_confidence`) los añade u2-T01 cuando la
> integración con la API de Claude llegue. Aquí el `status` es `pending`.
>
> **El enforcement del límite de 10 uploads/mes tampoco entra aquí.** Esa
> comprobación cross-service (POST /api/uploads → identity-service para ver
> el contador → 402 si llega a 0) la trae una tarea posterior que integre
> u1 con u9. En esta tarea, el endpoint acepta todas las subidas de usuarios
> autenticados.

**Unidad:** u1-image-upload (IngestionService)
**Historias que implementa:** US-1 (AC-1.1 happy path, AC-1.2 magic-number rechaza wrong format, AC-1.3 10 MB rechazo)
**Depende de:** u8-T01 + u8-T02 (fusionados). Consumen `@proyecto/auth-middleware` (`requireAuth`, `verifyToken`) y el `JwtPayload` de `@proyecto/shared-types`.

---

## Alcance

**Dentro** (una línea, concreta):

> Nueva app `apps/ingestion-service/` (Node.js/TypeScript, Express, puerto 3200) con tabla SQLite `uploads` (upload_id uuid PK, user_id uuid, timestamp
> timestamptz, confidence TEXT nullable, stored_filename TEXT, mime_type TEXT,
> size_bytes INT), endpoint `POST /api/uploads` protegido por `requireAuth` de
> `@proyecto/auth-middleware` que acepta `multipart/form-data` (campo `file`,
> JPEG/PNG/WebP), valida tamaño ≤ 10 MB (middleware `multer` + guard explícito),
> valida magic-number (primeros bytes del buffer) para CADA uno de los 3
> formatos, rechaza con 413 / 422 según el fallo, genera `stored_filename` con
> `crypto.randomUUID()` + extensión del tipo real detectado, escribe el blob a
> `/app/data/blobs/<uuid>.<ext>`, inserta el registro de upload, y responde 202
> con `{data:{uploadId}, error:null, status:202}`; `GET /health` (shape
> skeleton); Dockerfile multi-stage `node:20-slim` + build-tools (better-sqlite3
> nativo); manifiestos K8s en `k8s/ingestion/` incluyendo `pvc.yaml` sobre el
> storageClass `standard` (local-path-provisioner) del cluster kind; despliegue
> end-to-end verificado con un `POST /api/uploads` real desde `kubectl
port-forward` usando un JWT firmado por identity-service en pie; tests Jest +
> supertest con cobertura ≥80% líneas y ≥75% branches sobre `src/service/` y
> `src/handlers/`.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto o útil):

- Procesamiento de la crítica con Claude Vision — pertenece a u2-ai-critique.
  En esta tarea el campo `categories` NO aparece en la respuesta; el campo
  `confidence` queda NULL en la BD.
- Low-confidence fallback — pertenece a u3-low-confidence.
- Endpoint `GET /api/uploads/{uploadId}` — pertenece a u4-critique-storage
  (necesita el blob storage + thumbnail signed URL, fuera de esta tarea).
- Enforcement del contador de uploads (402 cuando llega a 0) — pertenece a
  una tarea posterior que integre u1 con u9. En esta tarea cualquier usuario
  autenticado puede subir.
- Llamadas a `/api/internal/users/:userId/increment-counter` — también
  pertenecen a esa tarea de integración futura.
- Endpoint interno `DELETE /api/internal/users/:userId/data` — pertenece a
  u13-history-deletion.
- Ingress de K8s (routing `/api/uploads/*` → ingestion-service a nivel de
  cluster) — se verifica en esta tarea con `kubectl port-forward` directo al
  Service, mismo patrón que u8-T01. El Ingress se arma en una tarea aparte.
- Cambios a `apps/backend/`, a `apps/identity-service/`, a sus manifiestos
  `k8s/*.yaml` existentes, `k8s/identity/`, a `packages/shared-types/`
  (esta tarea sólo importa) o a `packages/auth-middleware/` (idem).
- Cambios a `tareas/`, `revisiones/`, `bitacoras/` fuera de los archivos
  propios de esta tarea.
- Thumbnail generation, signed URLs, image resizing — fuera del MVP.
- Rate limiting en el endpoint de upload — fuera del MVP académico.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop (para entender el papel del
  codificador, no para alterar la tarea)
- `.claude/agents/codificador.md` — tu contrato
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo con `z.infer<>`,
  respuestas HTTP `{data, error, status}`, Jest + ts-jest + supertest,
  cobertura ≥80% líneas y ≥75% branches en `service/` + `handlers/`, imágenes
  con tag explícito (nunca `latest`), tipos compartidos solo en
  `@proyecto/shared-types`, Zod como fuente autoritativa de validación
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables: NEVER
  nombres de archivo del cliente para almacenamiento, ALWAYS magic-number
  server-side (no sólo Content-Type), ALWAYS límite de tamaño configurado en
  middleware de Express, ALWAYS Zod como fuente de validación, NEVER `latest`
  en manifiestos, ALWAYS `/health` + readinessProbe
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` —
  definición de u1-image-upload (JPEG/PNG/WebP, 10 MB, magic-number, filename
  server-side, requires auth)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  contrato C1 de IngestionService: `POST /api/uploads` con `multipart/form-data`,
  responses 202 / 401 / 402 / 413 / 422 (de esos, en esta tarea cubres 202 /
  401 / 413 / 422 — 402 queda fuera por cross-service)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` —
  US-1 con AC-1.1, AC-1.2, AC-1.3 (textos de los errores)
- `aidlc/spaces/default/intents/260925-feature/inception/requirements-analysis/requirements.md` —
  FR-1.1..FR-1.5 (formatos, tamaño, magic-number, filename server-side,
  autenticación), NFR-3 (<2 s excluyendo IA), NFR-7 (magic-number + MIME +
  server-generated filename)
- `tareas/u8-T01-identity-service-register-login.md` — patrón de app nueva en
  monorepo (Dockerfile multi-stage, k8s/<service>/, despliegue a kind). NO
  copiar texto — es referencia mental del molde.
- `tareas/u8-T02-auth-middleware-package.md` — detalles de `requireAuth`
  (401 `"unauthenticated"`, 500 `"server misconfiguration"`, `req.user.userId`).
- `apps/identity-service/Dockerfile` — Dockerfile vigente que ya resolvió el
  fix de `better-sqlite3@^12.11.1` en arm64; úsalo como molde
- `apps/identity-service/package.json` — versión fija `better-sqlite3@^12.11.1`
  a replicar (misma razón: SIGSEGV de prebuild arm64 en Docker)
- `apps/identity-service/src/service/database.ts` — patrón de inicialización
  idempotente de SQLite
- `apps/identity-service/src/service/user-repository.ts` — patrón de repositorio
  tipado con `randomUUID` server-side
- `apps/identity-service/src/handlers/auth.ts` — patrón de handler Express con
  shape `{data, error, status}` y mapeo de `ZodError` a 422
- `apps/identity-service/src/server.ts` — patrón de `createApp()` para tests
- `packages/auth-middleware/dist/index.d.ts` — API real que importas:
  `requireAuth`, `verifyToken`, `JwtPayload`. Si no existe dist, el workspace
  resuelve por `main` después de `npm run build -w @proyecto/auth-middleware`
- `packages/shared-types/src/auth.ts` — `JwtPayload` ya publicado (no
  redefinas)
- `packages/shared-types/src/index.ts` — barrel donde se añaden los schemas
  nuevos que esta tarea publique (ver abajo)
- `k8s/identity/deployment.yaml`, `k8s/identity/service.yaml`,
  `k8s/identity/configmap.yaml` — manifiestos de referencia (patrón de
  readinessProbe, env desde ConfigMap, Service ClusterIP)
- `turbo.json` y raíz `package.json` — para registrar el nuevo workspace

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del
clon `/Users/aureliano/Desktop/proyecto` con la rama `tarea/u1-T01` checada.

- [ ] **CA-1** — `apps/ingestion-service/` existe como workspace del monorepo.
      `package.json` declara deps en: `express`, `better-sqlite3` (fijo
      `^12.11.1`), `multer`, `zod`, `@proyecto/shared-types`,
      `@proyecto/auth-middleware`. Las devDeps incluyen `jest`, `ts-jest`,
      `supertest`, `typescript`, `@types/express`, `@types/multer`, `@types/supertest`.
      El script `test` corre Jest con `--coverage`.

  ```bash
  node -e 'const p=require("./apps/ingestion-service/package.json"); const req=["express","better-sqlite3","multer","zod"]; for(const d of req){ if(!p.dependencies?.[d]) throw new Error("missing dep: "+d); } if(p.dependencies["better-sqlite3"]!=="^12.11.1") throw new Error("better-sqlite3 must be ^12.11.1, got "+p.dependencies["better-sqlite3"]); const ws=Object.keys(p.dependencies).filter(k=>k.startsWith("@proyecto/")); if(!ws.includes("@proyecto/shared-types")) throw new Error("@proyecto/shared-types dep missing"); if(!ws.includes("@proyecto/auth-middleware")) throw new Error("@proyecto/auth-middleware dep missing"); const devReq=["jest","ts-jest","supertest","typescript","@types/express","@types/multer","@types/supertest"]; for(const d of devReq){ if(!p.devDependencies?.[d]) throw new Error("missing devDep: "+d); } if(!/jest.*--coverage|coverage/.test(p.scripts?.test||"")) throw new Error("test script must run coverage"); console.log("ok ingestion-service workspace")'
  ```

  Esperado: imprime `ok ingestion-service workspace`.

- [ ] **CA-2** — `packages/shared-types/src/uploads.ts` publica
      `UploadIdResponseSchema` (Zod) con la forma del body `202` del endpoint
      (`{data: {uploadId: string(uuid)}, error: null, status: literal(202)}`) y
      el tipo `UploadIdResponse = z.infer<typeof UploadIdResponseSchema>`. Está
      re-exportado desde `packages/shared-types/src/index.ts`. `tsc --noEmit`
      del package pasa limpio. Esta es la ÚNICA modificación permitida a
      `packages/shared-types/` en esta tarea.

  ```bash
  test -f packages/shared-types/src/uploads.ts
  grep -E "UploadIdResponseSchema" packages/shared-types/src/uploads.ts
  grep -E "z\.infer" packages/shared-types/src/uploads.ts
  grep -E "export .* from .*uploads" packages/shared-types/src/index.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: schema presente con su `z.infer`, re-exportado desde el barrel,
  `tsc` exit 0 sin salida de error.

- [ ] **CA-3** — `apps/ingestion-service/src/service/database.ts` abre SQLite
      a `process.env.DB_PATH || './data/ingestion.db'` (`:memory:` en tests) y
      crea la tabla `uploads` idempotentemente con schema: `upload_id TEXT
PRIMARY KEY`, `user_id TEXT NOT NULL`, `timestamp TEXT NOT NULL DEFAULT
CURRENT_TIMESTAMP`, `confidence TEXT`, `stored_filename TEXT NOT NULL`,
      `mime_type TEXT NOT NULL`, `size_bytes INTEGER NOT NULL`. Índice sobre
      `user_id` para que las queries por dueño sean eficientes.

  ```bash
  test -f apps/ingestion-service/src/service/database.ts
  grep -E "CREATE TABLE IF NOT EXISTS uploads" apps/ingestion-service/src/service/database.ts
  grep -E "(upload_id|user_id|timestamp|confidence|stored_filename|mime_type|size_bytes)" apps/ingestion-service/src/service/database.ts | sort -u | wc -l | tr -d ' '
  grep -E "CREATE INDEX .* ON uploads.*user_id" apps/ingestion-service/src/service/database.ts
  ```

  Esperado: archivo existe, `CREATE TABLE IF NOT EXISTS uploads` presente, al
  menos las 7 columnas aparecen (`wc -l` ≥ 7), índice sobre `user_id` presente.

- [ ] **CA-4** — `apps/ingestion-service/src/service/upload-repository.ts`
      expone al menos `create({userId, storedFilename, mimeType, sizeBytes}):
Upload` que genera `uploadId` server-side con `crypto.randomUUID()` (NUNCA
      viene del request). El tipo `Upload` exportado tiene forma `{uploadId:
string, userId: string, timestamp: string, storedFilename: string, mimeType:
string, sizeBytes: number, confidence: string | null}` (nullable porque u2
      lo setea más tarde).

  ```bash
  test -f apps/ingestion-service/src/service/upload-repository.ts
  grep -E "create\s*\(" apps/ingestion-service/src/service/upload-repository.ts
  grep -E "(randomUUID|uuidv4)" apps/ingestion-service/src/service/upload-repository.ts
  grep -E "export (type|interface) Upload" apps/ingestion-service/src/service/upload-repository.ts | head -3
  ```

  Esperado: método `create` declarado, id generado por el servidor, tipo
  `Upload` exportado.

- [ ] **CA-5** — `apps/ingestion-service/src/service/magic-number.ts` expone
      `detectImageKind(buffer: Buffer): "jpeg" | "png" | "webp" | null`.
      Reglas: - `jpeg`: bytes `FF D8 FF` en posición 0..2. - `png`: bytes `89 50 4E 47 0D 0A 1A 0A` en posición 0..7 (firma PNG estándar). - `webp`: bytes `52 49 46 46` (`"RIFF"`) en 0..3 **Y** `57 45 42 50`
      (`"WEBP"`) en 8..11. - Cualquier otra combinación: `null`.
      Esta función NO lee el Content-Type; opera sobre el buffer de bytes real.

  ```bash
  test -f apps/ingestion-service/src/service/magic-number.ts
  grep -E "export (function|const) detectImageKind" apps/ingestion-service/src/service/magic-number.ts
  grep -E "(0xff|0xFF).*0xd8|0xD8" apps/ingestion-service/src/service/magic-number.ts
  grep -E "(0x89|89).*(0x50|50).*(0x4e|4E)" apps/ingestion-service/src/service/magic-number.ts
  grep -E "RIFF" apps/ingestion-service/src/service/magic-number.ts
  grep -E "WEBP" apps/ingestion-service/src/service/magic-number.ts
  ```

  Esperado: función exportada, firmas de los 3 formatos presentes en el
  código fuente.

- [ ] **CA-6** — Test unit de `detectImageKind` con buffers sintéticos: - Un buffer `FF D8 FF E0 ...` detecta `jpeg`. - Un buffer con la firma PNG completa detecta `png`. - Un buffer con `RIFF` + 4 bytes + `WEBP` detecta `webp`. - Un buffer `25 50 44 46 ...` (firma de PDF) devuelve `null`. - Un buffer vacío (longitud 0) devuelve `null` sin lanzar.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=magic-number --no-coverage 2>&1 | tail -15
  ```

  Esperado: suite de `magic-number` pasa en verde, 0 skipped, al menos 5
  tests.

- [ ] **CA-7** — `apps/ingestion-service/src/service/blob-store.ts` expone
      `writeBlob(storedFilename: string, buffer: Buffer): Promise<string>` que
      escribe `buffer` a `${BLOB_DIR}/${storedFilename}` y devuelve la ruta
      absoluta escrita. `BLOB_DIR` sale de `process.env.BLOB_DIR ||
'./data/blobs'`. Crea el directorio si no existe (`mkdir -p`). NUNCA usa un
      path del cliente ni concatena strings del request.

  ```bash
  test -f apps/ingestion-service/src/service/blob-store.ts
  grep -E "export (function|const|async function) writeBlob" apps/ingestion-service/src/service/blob-store.ts
  grep -E "mkdir.*recursive.*true" apps/ingestion-service/src/service/blob-store.ts
  grep -E "BLOB_DIR" apps/ingestion-service/src/service/blob-store.ts
  # Sanity: el cliente no influye en el path más allá del nombre generado por el servidor
  ! grep -E "path\.join\([^,]*req\." apps/ingestion-service/src/service/blob-store.ts
  echo "blob-store shape ok"
  ```

  Esperado: imprime `blob-store shape ok`.

- [ ] **CA-8** — `POST /api/uploads` SIN header `Authorization` responde
      **401** con body literal `{data:null, error:"unauthenticated", status:401}`
      (viene de `@proyecto/auth-middleware`, mismo literal exacto que CA-6 de
      u8-T02).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(no.*auth|missing.*authorization|401.*unauthenticated|no.*token)"
  grep -E "\"unauthenticated\"" apps/ingestion-service/src/__tests__/*.ts | head -3
  ```

  Esperado: al menos un test pasa y el literal `"unauthenticated"` aparece en
  el archivo de tests.

- [ ] **CA-9** — `POST /api/uploads` con JWT válido y un buffer JPEG válido
      (los primeros bytes son `FF D8 FF E0 ...`, contenido mínimo que pase el
      detector) responde **202** con body `{data:{uploadId:string(uuid)},
error:null, status:202}`. Lectura de vuelta por herramienta real:
      `SELECT COUNT(*) FROM uploads WHERE user_id = ?` con el `sub` del JWT
      devuelve 1. El `stored_filename` persistido NO coincide con el nombre que
      el cliente pasó en el campo `filename` del multipart (filename
      server-side).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(happy path|202|upload.*created|uploadId)"
  ```

  Esperado: al menos un test con esos tokens pasa; el test afirma el 202, el
  `uploadId` uuid en el body, y que el `stored_filename` difiere del `filename`
  cliente.

- [ ] **CA-10** — `POST /api/uploads` con JWT válido y un buffer de 10 MB + 1
      byte responde **413** con body `{data:null, error:string, status:413}`.
      El error es `multer` (`LIMIT_FILE_SIZE`) traducido por el handler. NO se
      escribe nada al blob store ni a la BD (lectura de vuelta: `SELECT
COUNT(*) FROM uploads` sigue igual tras el 413).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(too large|LIMIT_FILE_SIZE|413|10.?MB|10 MB)"
  ```

  Esperado: al menos un test pasa; el test afirma el 413 y que la BD no
  cambió (conteo antes == conteo después).

- [ ] **CA-11** — `POST /api/uploads` con JWT válido y un buffer de 10 bytes
      cuyos primeros bytes son `25 50 44 46 ...` (PDF renombrado a `.jpg` con
      `Content-Type: image/jpeg` del cliente) responde **422** con body
      `{data:null, error:"Invalid image format", status:422}`. El literal
      `"Invalid image format"` del campo `error` es exacto (AC-1.2). NO se
      escribe nada al blob store ni a la BD.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(422|Invalid image format|magic.*number|wrong.*format)"
  grep -E "\"Invalid image format\"" apps/ingestion-service/src/__tests__/*.ts | head -3
  ```

  Esperado: al menos un test pasa; el literal exacto `Invalid image format`
  aparece en los tests.

- [ ] **CA-12** — `POST /api/uploads` con JWT válido pero SIN campo `file` en
      el multipart (o con un campo multipart distinto) responde **422** con
      body `{data:null, error:string, status:422}`. El test cubre que el
      handler no explota si `req.file` es `undefined`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -E "(no.*file|file.*required|422.*missing|missing.*file)"
  ```

  Esperado: al menos un test pasa.

- [ ] **CA-13** — `GET /health` responde 200 con body `{data:{status:"ok"},
error:null, status:200}` (mismo shape que identity-service y backend). Tiene
      test supertest dedicado.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=health --no-coverage 2>&1 | tail -10
  ```

  Esperado: al menos 1 test de health pasa; 0 skipped.

- [ ] **CA-14** — Cobertura: `apps/ingestion-service/src/service/*.ts` y
      `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches.

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-15** — `npm run lint` desde la raíz pasa, con `ingestion-service`
      incluido entre los workspaces.

  ```bash
  npm run lint 2>&1 | tail -5
  npm run lint 2>&1 | grep -E "(ingestion-service|apps/ingestion-service)" | head -3
  ```

  Esperado: exit 0; `turbo` reporta `successful`; `ingestion-service` aparece
  entre los workspaces lintados.

- [ ] **CA-16** — Dockerfile multi-stage en `apps/ingestion-service/Dockerfile`
      con base `node:20-slim` (glibc), stage `builder` con
      `apt-get install -y python3 make g++` (toolchain nativa para
      better-sqlite3), stage `runtime` sin las build-tools. Construye
      `@proyecto/shared-types` y `@proyecto/auth-middleware` antes del build
      del service (los necesita compilados como deps de workspace). La imagen
      se construye desde la raíz del workspace con tag explícito
      `ingestion-service:u1-T01` (NO `latest`).

  ```bash
  grep -E "FROM node:20-slim" apps/ingestion-service/Dockerfile
  grep -E "python3 make g\+\+" apps/ingestion-service/Dockerfile
  grep -E "npm run build -w @?proyecto/shared-types|npm run build -w packages/shared-types" apps/ingestion-service/Dockerfile
  grep -E "npm run build -w @?proyecto/auth-middleware|npm run build -w packages/auth-middleware" apps/ingestion-service/Dockerfile
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u1-T01 . 2>&1 | tail -20
  docker image inspect ingestion-service:u1-T01 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -E '"RepoTags"'
  ```

  Esperado: Dockerfile presente con las cadenas exigidas, `docker build` exit
  0, imagen inspeccionable, no existe `ingestion-service:latest`.

- [ ] **CA-17** — Manifiestos K8s en `k8s/ingestion/`: - `pvc.yaml` — `PersistentVolumeClaim` nombre `ingestion-blobs`,
      `accessModes: [ReadWriteOnce]`, `storageClassName: standard`,
      `resources.requests.storage: 1Gi`. - `deployment.yaml` — `image: ingestion-service:u1-T01`,
      `imagePullPolicy: Never`, `readinessProbe` sobre `/health` puerto 3200,
      env `JWT_SECRET` desde `secretKeyRef` (el mismo Secret `jwt-secret` que
      usa identity-service — ambos servicios tienen que validar con el mismo
      secret), `volumeMounts` apuntando a `/app/data/blobs` montando el PVC
      `ingestion-blobs`. - `service.yaml` — ClusterIP puerto 3200. - `configmap.yaml` — `PORT=3200`, `NODE_ENV=production`,
      `DB_PATH=/app/data/ingestion.db`, `BLOB_DIR=/app/data/blobs`,
      `MAX_UPLOAD_BYTES=10485760` (10 × 1024 × 1024).

  ```bash
  for f in k8s/ingestion/pvc.yaml k8s/ingestion/deployment.yaml k8s/ingestion/service.yaml k8s/ingestion/configmap.yaml; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
  grep -E "storageClassName: standard" k8s/ingestion/pvc.yaml
  grep -E "ReadWriteOnce" k8s/ingestion/pvc.yaml
  grep -E "storage: 1Gi" k8s/ingestion/pvc.yaml
  grep -E "image: ingestion-service:u1-T01" k8s/ingestion/deployment.yaml
  grep -E "imagePullPolicy: Never" k8s/ingestion/deployment.yaml
  grep -E "readinessProbe" k8s/ingestion/deployment.yaml
  grep -E "path: /health" k8s/ingestion/deployment.yaml
  grep -E "secretKeyRef" k8s/ingestion/deployment.yaml
  grep -E "name: jwt-secret" k8s/ingestion/deployment.yaml
  grep -E "mountPath: /app/data/blobs" k8s/ingestion/deployment.yaml
  grep -E "claimName: ingestion-blobs" k8s/ingestion/deployment.yaml
  grep -E "(PORT|NODE_ENV|DB_PATH|BLOB_DIR|MAX_UPLOAD_BYTES)" k8s/ingestion/configmap.yaml | sort -u | wc -l | tr -d ' '
  ! grep -E "image:.*:latest" k8s/ingestion/deployment.yaml
  echo "manifests ok"
  ```

  Esperado: los cuatro archivos existen con los campos exigidos; el ConfigMap
  tiene las 5 claves (conteo `5`); no aparece `latest`; imprime `manifests ok`.

- [ ] **CA-18** — Despliegue end-to-end verificado en kind, tomando ventaja
      de que identity-service **ya está corriendo** (`kubectl get pods -n
default` muestra `identity-service-*` listo):
  1. Imagen construida con tag `ingestion-service:u1-T01` (CA-16).
  2. `kind load docker-image ingestion-service:u1-T01` y la imagen aparece
     dentro del nodo del cluster.
  3. `kubectl apply -f k8s/ingestion/pvc.yaml` crea el PVC. Como el provisioner
     es `WaitForFirstConsumer`, el PVC queda `Pending` hasta que un Pod lo
     consuma — eso es normal; NO lo trates como error.
  4. `kubectl apply -f k8s/ingestion/{configmap,service,deployment}.yaml`
     aplica los otros tres manifiestos. El Secret `jwt-secret` ya existe (de
     u8-T01); NO se recrea.
  5. `kubectl rollout status deployment/ingestion-service` exit 0.
  6. Pod en estado `Ready` según la `readinessProbe` (no sólo `Running`).
  7. PVC pasa a `Bound` una vez el Pod arranca.
  8. `kubectl port-forward svc/identity-service 3100:3100` levantado en
     background; obtiene JWT con `POST /api/auth/register` (o `POST
/api/auth/login` si el usuario de pruebas ya existe).
  9. `kubectl port-forward svc/ingestion-service 3200:3200` levantado en
     background. `POST /api/uploads` con `-F file=@<ruta a test.jpg>` y
     `Authorization: Bearer <JWT>` devuelve 202 con `data.uploadId` uuid.
  10. Verificación de lectura por herramienta real:
      `kubectl exec deploy/ingestion-service -- ls /app/data/blobs` muestra el
      archivo con el nombre uuid+extensión. `kubectl exec
deploy/ingestion-service -- node -e 'const db=require("better-sqlite3")("/app/data/ingestion.db"); console.log(db.prepare("SELECT COUNT(*) AS n FROM uploads").get())'`
      imprime `{ n: 1 }`.
  11. Port-forwards matados al final; no quedan residuales.

  ```bash
  # Comando atómico de sanity que el revisor ejecuta DESPUÉS de los pasos 1-9:
  # (asume ambos port-forwards activos y JWT en $JWT_TOKEN)
  # Crea un archivo JPEG mínimo de 3 bytes de firma + 100 bytes aleatorios para
  # pasar el detector de magic-number.
  printf '\xff\xd8\xff\xe0' > /tmp/u1-mini.jpg
  dd if=/dev/urandom bs=1 count=100 >> /tmp/u1-mini.jpg 2>/dev/null
  # Obtener JWT fresco:
  JWT_TOKEN=$(curl -sf -X POST http://localhost:3100/api/auth/register -H 'Content-Type: application/json' -d '{"email":"u1ca18@test.local","password":"testpass123"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const r=JSON.parse(d); if(!r.data?.token){ const l=require("child_process").execSync("curl -sf -X POST http://localhost:3100/api/auth/login -H \"Content-Type: application/json\" -d \x27{\\\"email\\\":\\\"u1ca18@test.local\\\",\\\"password\\\":\\\"testpass123\\\"}\x27"); console.log(JSON.parse(l.toString()).data.token); } else { console.log(r.data.token); }})')
  # POST /api/uploads:
  curl -sf -X POST http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_TOKEN" -F "file=@/tmp/u1-mini.jpg" | tee /tmp/u1-t01-upload.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u1-t01-upload.json","utf8")); if(r.status!==202||r.error!==null||!r.data?.uploadId) throw new Error("bad: "+JSON.stringify(r)); if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.data.uploadId)) throw new Error("uploadId not uuid: "+r.data.uploadId); console.log("upload-in-kind ok, uploadId="+r.data.uploadId)'
  # Verificación en el pod:
  kubectl exec deploy/ingestion-service -- ls /app/data/blobs | tee /tmp/u1-ls.txt
  kubectl exec deploy/ingestion-service -- node -e 'const db=require("better-sqlite3")("/app/data/ingestion.db"); console.log(JSON.stringify(db.prepare("SELECT COUNT(*) AS n FROM uploads").get()))' | tee /tmp/u1-count.json
  node -e 'const n=JSON.parse(require("fs").readFileSync("/tmp/u1-count.json","utf8")).n; if(n<1) throw new Error("no rows in uploads"); console.log("uploads row count = "+n)'
  ```

  Nota: si el revisor no tiene Docker/kind (caso detectado en WS-T05 ronda 1),
  aplica el fallback: el orquestador corre los pasos y adjunta los outputs
  literales al brief del revisor, quien verifica consistencia y shape.

  Esperado: imprime `upload-in-kind ok, uploadId=<uuid>` y
  `uploads row count = N` con N ≥ 1; `ls /app/data/blobs` muestra un archivo.

- [ ] **CA-19** — Rama `tarea/u1-T01` sobre `main` con ≥2 commits legibles
      (ej. scaffolding + schemas, DB + repo + service helpers, handler + tests,
      Dockerfile + K8s, o una partición equivalente).

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/u1-T01`, al menos 2 commits sobre `main`.

- [ ] **CA-20** — Ningún secreto en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" | grep -v "process.env.JWT_SECRET" | grep -v "name: JWT_SECRET" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-21** — `apps/backend/`, `apps/identity-service/`, `k8s/*.yaml`
      (los de la raíz), `k8s/identity/`, `packages/auth-middleware/` **no**
      fueron tocados. `packages/shared-types/` sólo recibió el archivo nuevo
      `src/uploads.ts` y el re-export correspondiente en `src/index.ts` (CA-2);
      ningún otro archivo del package cambió.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/[a-z-]+\.yaml$" | grep -v "k8s/ingestion/" && echo "FAIL: k8s raíz tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/identity/" && echo "FAIL: k8s/identity/ tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^packages/shared-types/" | grep -v -E "(src/uploads\.ts|src/index\.ts|package\.json)" && echo "FAIL: shared-types alcance excedido" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`.

- [ ] **CA-22** — Regresión del skeleton: `GET /health` del `apps/backend/`
      responde el shape histórico.

  ```bash
  rm -f /tmp/backend-health.json /tmp/backend.log
  (cd apps/backend && PORT=3401 npm run start > /tmp/backend.log 2>&1 &); sleep 2
  curl -sf http://localhost:3401/health -o /tmp/backend-health.json
  pkill -f "node .*apps/backend" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/backend-health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("backend health broken: "+JSON.stringify(r)); console.log("backend health intact")'
  ```

  Esperado: imprime `backend health intact`.

> **Si un criterio no tiene comando, la tarea no está lista y no se despacha.**
> Todos los CAs de arriba tienen su comando. Si un comando no produce la salida
> esperada, el revisor levanta un hallazgo ROJO (criterio incumplido).

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- `apps/ingestion-service/src/__tests__/magic-number.test.ts`:
  - **JPEG**: `Buffer.from([0xff,0xd8,0xff,0xe0, ...])` → `"jpeg"`. CA-5, CA-6.
  - **PNG**: `Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, ...])` → `"png"`.
  - **WebP**: buffer con `"RIFF"` + 4 bytes + `"WEBP"` → `"webp"`.
  - **PDF (negativo)**: `Buffer.from([0x25,0x50,0x44,0x46, ...])` → `null`.
  - **Buffer vacío**: `Buffer.alloc(0)` → `null` (defensivo).
  - **Buffer corto que empieza por `RIFF` pero sin `WEBP` en 8..11** → `null`
    (no basta con el prefijo RIFF; debe confirmar WEBP).
- `apps/ingestion-service/src/__tests__/upload-repository.test.ts`:
  - **Round-trip**: `create({...})` devuelve `Upload` con `uploadId` uuid
    server-side; lookup posterior con `SELECT` devuelve el mismo registro.
  - **Init idempotente**: llamar al init del `database` dos veces no falla.
- `apps/ingestion-service/src/__tests__/blob-store.test.ts`:
  - **Round-trip**: `writeBlob("abc.jpg", Buffer.from("hello"))` crea el archivo
    en `BLOB_DIR` configurado (tmpdir en tests); `fs.readFileSync` devuelve el
    mismo contenido.
  - **`mkdir -p`**: si `BLOB_DIR` no existe, se crea.
- `apps/ingestion-service/src/__tests__/uploads-http.test.ts` (supertest sobre
  `createApp()`):
  - **401 sin header** → `{data:null,error:"unauthenticated",status:401}`. CA-8.
  - **202 feliz** con JPEG válido mínimo + JWT firmado en el test con el mismo
    `JWT_SECRET` seteado en `beforeAll`:
    - Body `{data:{uploadId:uuid},error:null,status:202}`.
    - La BD tiene exactamente 1 fila para ese `user_id`.
    - `stored_filename` ≠ el `filename` que envió el cliente. CA-9.
  - **413 archivo > 10 MB** con `Buffer.alloc(10*1024*1024 + 1)` — `multer`
    corta antes de que magic-number lo vea. CA-10.
  - **422 PDF renombrado** (buffer `25 50 44 46 ...` con `filename="trap.jpg"`,
    `Content-Type: image/jpeg`) → `{data:null,error:"Invalid image format",
status:422}`. BD inalterada. CA-11.
  - **422 sin campo `file`** (POST con otro campo multipart distinto a `file`).
    CA-12.
- `apps/ingestion-service/src/__tests__/health.test.ts`:
  - **200 shape skeleton** vía supertest. CA-13.

**Rojo primero:** antes de implementar el handler, el codificador escribe el
test de CA-8 (401 sin header), lo corre, lo ve fallar, registra en la
bitácora, luego implementa el wire-up de `requireAuth` y lo ve verde. Mismo
patrón para CA-9 (happy path): primero el test con 202, rojo, luego multer +
magic + repo, verde.

---

## Notas

- **Dónde vive la ruta de la BD y del blob store:**
  - Dev/tests: `./data/ingestion.db` y `./data/blobs/` (relativos al cwd del
    workspace). En tests Jest, cada archivo construye `:memory:` para SQLite y
    un `fs.mkdtempSync(path.join(os.tmpdir(), "ingestion-"))` para `BLOB_DIR`.
  - Producción (K8s): `/app/data/ingestion.db` y `/app/data/blobs/`. El
    `blobs/` monta el PVC `ingestion-blobs`. La base SQLite vive en el
    sistema de archivos efímero del contenedor para esta tarea (persistencia
    real de la DB llega cuando se migre a PostgreSQL en una tarea aparte).
- **PVC y local-path-provisioner:** `kubectl get storageclass` muestra
  `standard (default) rancher.io/local-path`. El modo es `WaitForFirstConsumer`:
  el PVC se queda `Pending` hasta que un Pod lo consuma. Es correcto. No
  intentes "despertar" el PVC con comandos extra; sólo asegura que el
  Deployment hace referencia al claim.
- **Mismo `jwt-secret` Secret que identity-service:** la deuda implícita del
  MVP es que ambos servicios (el emisor y el verificador) comparten el mismo
  secret HS256. En un deployment productivo se migra a RS256 con rotación;
  aquí es aceptable. El Secret ya existe en el cluster desde u8-T01 (CA-20);
  esta tarea NO lo recrea.
- **Shape de la respuesta `202`:** el contrato C1 define `UploadResult` con
  `categories` y `confidence`. En esta tarea, el `status` interno es
  `pending` (la IA llega en u2), por lo que el body de 202 es
  `{data: {uploadId: <uuid>}, error: null, status: 202}`. Cuando u2-T01
  aterrice, extenderá el body con `categories`, `confidence` y `status:
"ready" | "low_confidence"`. Esto está documentado como deuda de forma
  explícita para que el revisor no lo marque como desviación de C1.
- **Magic-number sobre el buffer, no sobre el stream:** `multer` con
  `memoryStorage()` deja el archivo completo en `req.file.buffer`. Sobre ese
  buffer corre `detectImageKind`. NO uses la configuración de `destination`
  (disco) porque mezclaría la lógica de validación con el store, y
  complicaría el rechazo limpio (ver siguiente nota).
- **Orden del rechazo:** validas magic-number **antes** de escribir al blob
  store. El flujo es: multer recibe → en memory → detect → si null → 422
  (buffer se descarta, nada escrito a disco). Si pasa → generar
  `stored_filename` con `randomUUID()` + extensión del tipo detectado (NO del
  cliente) → `writeBlob` → `repo.create` → responder 202. Si `writeBlob` falla,
  responde 500 y NO insertas en la BD (no quedan registros huérfanos sin
  blob).
- **Extensión del `stored_filename`:** `.jpg` para jpeg, `.png` para png,
  `.webp` para webp. El cliente nunca proporciona la extensión; el servidor
  la escoge según el tipo real detectado.
- **`MAX_UPLOAD_BYTES`:** `10485760` (10 × 1024 × 1024 = 10 MiB). Sí, 10 MB
  del PRD se interpretan como MiB en la implementación; el revisor lo acepta
  si el ConfigMap y el middleware comparten el mismo valor. Si el humano
  prefiere SI (10_000_000), es cambio de una línea en ambos sitios — queda
  como decisión final del humano al revisar, no es defecto del codificador.
- **Aislamiento del `JWT_SECRET` en tests:** cada archivo de tests que usa
  `requireAuth` o firma un JWT para el happy path **setea su propio**
  `process.env.JWT_SECRET = 'a-test-secret-for-tests-only'` en `beforeAll` y
  lo restaura en `afterAll`. Firma el JWT en el test con
  `jsonwebtoken.sign({sub:"user-abc"}, process.env.JWT_SECRET,
{algorithm:"HS256",expiresIn:"7d"})`. Nada de secretos reales.
- **Build de `@proyecto/auth-middleware` en el workspace del codificador:**
  el package expone `main: dist/index.js` + `types: dist/index.d.ts`, así que
  el service lo consume desde `dist`. Antes de correr tests o `tsc`, el
  codificador corre `npm run build -w @proyecto/auth-middleware` (y lo
  mismo para `@proyecto/shared-types`) desde la raíz. Lo registra en la
  bitácora.
- **Dependencia de workspace a `shared-types` y `auth-middleware`:** usa
  `"@proyecto/shared-types": "*"` y `"@proyecto/auth-middleware": "*"` en
  `apps/ingestion-service/package.json`.
- **Dockerfile:** copia la estrategia del `apps/identity-service/Dockerfile`
  casi tal cual: `node:20-slim`, `apt-get install -y --no-install-recommends
python3 make g++` en el builder, build-tools fuera del runtime, copia
  `packages/shared-types/`, `packages/auth-middleware/` y construye ambos
  **antes** del build del service. El contexto de `docker build` es la raíz
  del workspace.
- **Ningún `kubectl apply` desde el codificador contra el cluster compartido
  salvo para su propia verificación de CA-18.** No toques namespaces ajenos;
  no borres recursos del `apps/backend/` ni del `apps/identity-service/`. Al
  terminar la verificación, mata el `kubectl port-forward` y deja el cluster
  en el mismo estado en que lo encontraste (los recursos de
  `ingestion-service` SÍ pueden quedar desplegados; no se borran).
- **Archivos que se modifican en su sitio:** `packages/shared-types/src/index.ts`
  (añadir el re-export de `./uploads`), raíz `package.json` y/o `turbo.json`
  sólo si el glob de workspaces no incluye ya `apps/*` (ya lo incluye: no
  deberías tocarlo). Nada de duplicados con sufijo. **No toques**
  `apps/backend/`, `apps/identity-service/`, `packages/auth-middleware/`,
  `k8s/identity/`, ni los manifiestos de `k8s/` de la raíz.
- **No fusiones**, no abras el PR tú mismo, no corras `kubectl apply` fuera
  de CA-18, no instales dependencias globales.
- **Bitácora:** `bitacoras/u1-T01.md` con una entrada por ronda que describa:
  variante usada para construir `@proyecto/auth-middleware` y
  `@proyecto/shared-types` antes de tests, comandos exactos corridos para
  CA-18, el nombre del JPEG mínimo usado en el E2E, el `uploadId` observado,
  pods observados en kind, y respuestas a los hallazgos del revisor por
  identificador en las rondas siguientes.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u1-T01`. Base:
`main`. Modelo de aislamiento: rama directa en el clon
`/Users/aureliano/Desktop/proyecto` (no se usan worktrees). Imagen Docker:
`ingestion-service:u1-T01` (tag explícito, nunca `:latest`). Destino K8s:
cluster local kind. Pertenece a la **ola 1** (u1-T01 + u9-T01 + u11-T01) —
despachada en paralelo con un codificador por tarea._
