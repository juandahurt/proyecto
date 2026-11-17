# u4-T01 — Persistir críticas en SQLite (sobre PVC) y `GET /api/uploads/:uploadId` con control de dueño en `apps/ingestion-service/`

> **Primera de dos tareas de u4-critique-storage** (decisión del humano: dos tareas). u4-T01 hace la
> **persistencia** de la crítica y el **endpoint de detalle** con 401/403/404. La **miniatura y la URL firmada
> de 15 min (`thumbnailUrl`) son de u4-T02, no de esta tarea.**
>
> Hoy, `POST /api/uploads` crea la fila en `uploads` y responde la crítica, pero **no guarda nada de la crítica**
> (la columna `confidence` queda siempre `NULL`, no existe `category_critiques`). Además, la BD SQLite vive en el
> filesystem **efímero** del pod (solo `/app/data/blobs` está en el PVC): al reiniciar, se pierden los registros
> (candidata C-18). Decisión del humano: **mover la BD al PVC**.

**Unidad:** u4-critique-storage (IngestionService — extensión)
**Historias que implementa:** US-4 (AC-4.1 aislamiento entre usuarios: 403 a otro usuario y ningún dato servido). AC-4.2 (no
entrenamiento) no tiene código: no se envía nada a ningún endpoint de entrenamiento y esta tarea no añade ninguna salida de red.
**Depende de:** u2-T01, u3-T01 (fusionados; `main` @ `d6476ce` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`packages/shared-types/src/uploads.ts`** (solo este archivo del package; cambio **aditivo**): exportar
> `UploadDetailSchema` = `{data: <data de UploadResultSchema> extendido con timestamp: string ISO-8601 con zona (z.string().datetime()),
error: null, status: 200}` y el tipo `UploadDetail` con `z.infer<>`. Derivar de `UploadResultSchema.shape.data` (`.extend`), no
> copiar campos. **No** incluir `thumbnailUrl` (u4-T02). `UploadResultSchema` y todo lo existente quedan intactos.
>
> **`apps/ingestion-service/src/service/database.ts`** (modificar): (a) tabla nueva `category_critiques` (`critique_id` TEXT PK,
> `upload_id` TEXT NOT NULL con FK a `uploads(upload_id)`, `category_id` TEXT NOT NULL con CHECK en CAT-1..CAT-5,
> `category_name` TEXT NOT NULL, `score` INTEGER con CHECK 0..100 (nullable por C5), `feedback` TEXT NOT NULL) con
> `UNIQUE(upload_id, category_id)` e índice por `upload_id`; (b) columnas nuevas en `uploads`: `status` TEXT (`ready` |
> `low_confidence`, nullable) y `fallback_reason` TEXT (nullable); (c) **migración idempotente** para una BD que ya exista con el
> schema viejo: detectar columnas con `PRAGMA table_info(uploads)` y hacer `ALTER TABLE … ADD COLUMN` solo si faltan, conservando las
> filas existentes; (d) `PRAGMA foreign_keys = ON` en cada conexión. Mantener `CREATE TABLE IF NOT EXISTS`. Las columnas de C5
> (`upload_id`, `user_id`, `timestamp`, `confidence`, `category_id`, `score`) **no se renombran ni se eliminan** (cambio rompiente
> para ProgressService); las nuevas son aditivas.
>
> **`apps/ingestion-service/src/service/upload-repository.ts`** (modificar): añadir al contrato `UploadRepository`
> `saveCritique(uploadId, outcome)` y `getDetail(uploadId)`. `saveCritique` recibe el `CritiqueOutcome` de u3 (importar el tipo de
> `critique-outcome.ts`) y, **dentro de una sola transacción** de better-sqlite3: `ready` → `UPDATE uploads SET confidence, status='ready'`
>
> - `INSERT` de **5** filas en `category_critiques`; `fallback` → `UPDATE uploads SET confidence='LOW', status='low_confidence',
fallback_reason=<reason>` y **ninguna** fila en `category_critiques` (**decisión D-3**: no hay críticas que guardar; ProgressService
>   excluye por `status`/`confidence`; AC-3.1 «no category scores»). `critique_id` se genera en el servidor con `crypto.randomUUID()`.
>   `getDetail` devuelve `null` si el upload no existe, y si existe devuelve `{uploadId, userId, timestamp, status, confidence,
fallbackReason, categories}` con `categories` ordenadas por `category_id` ASC. `timestamp` sale en ISO-8601 UTC con `Z` (SQLite
>   guarda `YYYY-MM-DD HH:MM:SS` sin zona; convertir). Un upload sin crítica persistida tiene `status` y `confidence` en `null`.
>
> **`apps/ingestion-service/src/handlers/uploads.ts`** (modificar): (1) en `POST /`, tras `resolveCritique`, llamar a
> `repo.saveCritique(...)` **antes** de responder; si `saveCritique` lanza → `500 {data:null,error:'Failed to store critique',status:500}`
> (el upload ya quedó registrado; es el comportamiento aceptado). Las respuestas 202 (ready y fallback) **no cambian**. Aprovecha para
> añadir `satisfies UploadResult` al body `ready` (cierra la candidata C-25). (2) Nuevo `GET /:uploadId`, bajo el mismo `requireAuth`:
>
> - `uploadId` que no sea UUID válido → **404** `{data:null,error:'Not Found',status:404}` (no se revela nada del formato).
> - No existe → **404** igual.
> - Existe y `userId` ≠ `req.user.userId` → **403** `{data:null,error:'Forbidden',status:403}` **sin ningún campo del upload ni de la
>   crítica** (AC-4.1). La comparación va **antes** de leer/serializar categorías.
> - Existe, es del usuario, pero `status` es `null` (análisis no completado) → **404** `{data:null,error:'Not Found',status:404}`
>   (**decisión D-4**).
> - Existe, es del usuario y tiene crítica → **200** `{data:{uploadId,status,confidence,categories?,fallbackReason?,timestamp},error:null,status:200}`;
>   `ready` incluye las 5 `categories` (`categoryId`, `categoryName`, `score`, `feedback`), `low_confidence` incluye `fallbackReason` y **no
>   la clave `categories`**. El body lleva `satisfies UploadDetail`.
>
> **`k8s/ingestion/deployment.yaml`** (modificar): `image: ingestion-service:u4-T01`; `strategy: type: Recreate` (RWO + SQLite en WAL:
> nunca dos pods abriendo la misma BD durante un rollout); montar el **mismo PVC `ingestion-blobs`** con **dos `volumeMounts` con `subPath`**:
> `subPath: blobs` → `/app/data/blobs` (**fix de especificación, ronda 1:** esto NO conserva los blobs previos; el PVC estaba montado por su raíz, así que los 7 blobs viejos quedan en la raíz del PVC, fuera del subdirectorio `blobs`. Sin impacto funcional: la BD anterior era efímera y no los referenciaba; ver candidata C-27) y `subPath: db` → `/app/data/db`. Un solo `volume` en `spec.volumes`.
>
> **`k8s/ingestion/configmap.yaml`** (modificar): `DB_PATH: '/app/data/db/ingestion.db'`.
>
> **Tests**: ver Plan de pruebas. Se amplían `upload-repository.test.ts`, `uploads-http.test.ts` y (si aplica) `database.test.ts` en su sitio.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Miniatura, `thumbnailUrl`, URL firmada, secreto de firma, dependencias de imagen (`sharp` etc.) — **u4-T02**.
- Endpoint que sirva los bytes de la imagen, o cualquier ruta nueva distinta de `GET /api/uploads/:uploadId`.
- Listado/historial de uploads — u5. Tendencias — u6. Borrado de historial — u13.
- Migrar a PostgreSQL; renombrar el PVC `ingestion-blobs` (su nombre queda engañoso; no se toca) o cambiar `pvc.yaml`.
- Tocar el contador de uploads / identity-service (u9) o hacer llamadas entre servicios.
- Cambiar el contrato de `POST /api/uploads` (las respuestas 202 de ready y fallback quedan **idénticas**), `resolveCritique`,
  `claude-client.ts` o `anthropic-error.ts`.
- Reintentos/`maxRetries` del SDK (C-22) y la razón `api_error` (C-23).
- Cualquier otro archivo de `packages/` distinto de `shared-types/src/uploads.ts`; `apps/backend/`, `apps/identity-service/`,
  `apps/trust-service/`, `packages/auth-middleware/`, `Dockerfile`, `server.ts`, `index.ts`, `magic-number.ts`, `blob-store.ts`.
- Dejar de guardar el blob o cambiar el orden actual (blob → fila en BD → Claude).

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data,error,status}`, Jest, cobertura 80%/75%, tipos en `shared-types`
- `aidlc/spaces/default/memory/project.md` — reglas duras (sin secretos, tags explícitos, **nunca `latest`**, tipos derivados de Zod)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u4
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` — US-4 (AC-4.1, AC-4.2)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — C1 (`GET /api/uploads/{uploadId}`, `UploadDetail`) y **C5** (columnas que ProgressService lee: no romper)
- `bitacoras/u3-T01.md` y `tareas/u3-T01-low-confidence.md` — estado previo (`resolveCritique`, `CritiqueOutcome`, decisiones D-1/D-2)
- `apps/ingestion-service/src/handlers/uploads.ts`, `src/service/upload-repository.ts`, `src/service/database.ts`, `src/service/critique-outcome.ts`
- `apps/ingestion-service/src/__tests__/uploads-http.test.ts`, `upload-repository.test.ts`, `database.test.ts`
- `packages/shared-types/src/uploads.ts` (se extiende) y `anthropic.ts` (solo lectura)
- `packages/auth-middleware/src/require-auth.ts` — `req.user.userId`; para los tests de dueño, el mismo `makeJwt` que ya usa `uploads-http.test.ts`
- `k8s/ingestion/deployment.yaml`, `k8s/ingestion/configmap.yaml`, `k8s/ingestion/pvc.yaml` (solo lectura)
- `CANDIDATAS.md` — C-18 (SQLite efímero) y C-25 (`satisfies` en body ready), que esta tarea resuelve

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u4-T01` checada. En un worktree limpio hay que
compilar antes los packages: `npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — `UploadDetailSchema` existe en `shared-types`, derivado de `UploadResultSchema`, con `timestamp` datetime y **sin** `thumbnailUrl`;
      `UploadResultSchema` sigue exportado sin cambios; `tsc` pasa.

  ```bash
  grep -E "UploadDetailSchema" packages/shared-types/src/uploads.ts
  grep -E "UploadResultSchema\.shape\.data|\.extend\(" packages/shared-types/src/uploads.ts
  grep -E "datetime\(\)" packages/shared-types/src/uploads.ts
  grep -E "z\.infer<typeof UploadDetailSchema>" packages/shared-types/src/uploads.ts
  ! grep -E "thumbnailUrl" packages/shared-types/src/uploads.ts && echo "no thumbnailUrl"
  npm run build -w packages/shared-types 2>&1 | tail -3
  npx tsc --noEmit -p apps/ingestion-service 2>&1 | tail -3
  ```

  Esperado: esquema y tipo presentes, `no thumbnailUrl`, build y `tsc` exit 0.

- [ ] **CA-2** — La BD crea `category_critiques` y las columnas nuevas; es idempotente; **migra una BD con el schema viejo conservando filas**; las FK
      están activas y los CHECK rechazan `CAT-9` y score 101.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(database|upload-repository)" --no-coverage --verbose 2>&1 | tail -40
  ```

  Esperado: suite en verde; hay tests con nombre para: tablas/columnas creadas, llamar `createDatabase` dos veces sobre el mismo archivo, upgrade desde schema
  viejo (archivo temporal creado con el `CREATE TABLE` anterior + 1 fila que sigue legible tras abrir con `createDatabase`), FK (insertar crítica con
  `upload_id` inexistente falla) y CHECK (`CAT-9`, score 101 fallan).

- [ ] **CA-3** — `saveCritique` es atómico: `ready` persiste el UPDATE y 5 filas; `fallback` persiste solo el UPDATE (0 filas) con `fallback_reason`; si
      falla a mitad (p. ej. violación de `UNIQUE(upload_id, category_id)` en la 5.ª fila) **no queda ninguna fila ni el UPDATE** (rollback). Lectura de vuelta con
      SQL directo sobre la misma conexión (`db.prepare('SELECT …')`), no solo con la API del repo.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=upload-repository --no-coverage --verbose 2>&1 | grep -E "(saveCritique|rollback|atomic|transac|getDetail)"
  ```

  Esperado: los tests de `saveCritique` (ready, fallback, rollback) y `getDetail` (null si no existe, orden por `category_id`, timestamp ISO con `Z`) en verde.

- [ ] **CA-4** — `POST /api/uploads` (HIGH y MEDIUM) **persiste**: tras responder 202, la fila de `uploads` tiene `status='ready'` y `confidence` correcto, y hay
      **exactamente 5** filas en `category_critiques` con los mismos `score`/`feedback` que devolvió la respuesta. La respuesta 202 es idéntica a la de u3.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(persist|category_critiques|status.*ready|MEDIUM)"
  ```

  Esperado: tests en verde; leen de vuelta con SQL directo contra la BD `:memory:` real inyectada.

- [ ] **CA-5** — `POST /api/uploads` en fallback (LOW, `invalid_schema` y timeout) deja la fila con `status='low_confidence'`, `confidence='LOW'`,
      `fallback_reason` correcto y **0 filas** en `category_critiques` para ese upload; el 202 sigue sin `categories`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(fallback_reason|low_confidence|0 filas|sin categor)"
  ```

  Esperado: tests de los tres fallbacks en verde, con lectura SQL de vuelta.

- [ ] **CA-6** — Si `saveCritique` lanza, `POST` responde **500** `{data:null,error:"Failed to store critique",status:500}` y el log no expone buffer ni claves.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(Failed to store critique|saveCritique.*throw|store critique)"
  ```

  Esperado: test en verde (repo inyectado cuyo `saveCritique` lanza).

- [ ] **CA-7** — `GET /api/uploads/:uploadId` del **dueño** devuelve **200** con el body exacto de `UploadDetailSchema` (`safeParse` OK): `ready` con 5
      `categories` ordenadas CAT-1..CAT-5 e iguales a las del `POST`; `timestamp` ISO con `Z`; sin `thumbnailUrl`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(GET.*200|owner|dueño|UploadDetail)"
  ```

  Esperado: test(s) del GET 200 en verde.

- [ ] **CA-8** — **AC-4.1**: `GET` de un upload de **otro usuario** → **403** `{data:null,error:"Forbidden",status:403}`. El test afirma que el body
      completo (`JSON.stringify(res.body)`) **no contiene** el `uploadId`, ningún `feedback` ni ningún `score`, y que con un tercer usuario el resultado es el mismo.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(403|Forbidden|otro usuario|another user)"
  ```

  Esperado: tests en verde.

- [ ] **CA-9** — 404 y 401: UUID inexistente → 404; id que no es UUID (`abc`, `../etc/passwd`) → 404 (nunca 500); upload propio sin crítica persistida
      (`status` NULL) → 404; sin `Authorization` → **401** `{data:null,error:"unauthenticated",status:401}`; el 401 se comprueba también en el GET.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(404|401|unauthenticated|Not Found)"
  ```

  Esperado: tests en verde.

- [ ] **CA-10** — `GET` del dueño sobre un upload en fallback → **200** con `status:"low_confidence"`, `confidence:"LOW"`, `fallbackReason` y **sin la clave
      `categories`** (`not.toHaveProperty('data.categories')`).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(GET.*low_confidence|GET.*fallback)"
  ```

  Esperado: test en verde.

- [ ] **CA-11** — Regresiones: 401/422/413 en `POST`, los fallbacks de u3 (sus 202 sin cambios), el 500 por error ajeno; `apps/backend` compila y sus tests pasan.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -15
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: suite de ingestion completa en verde (sin tests saltados), `tsc` exit 0, backend sin fallos.

- [ ] **CA-12** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches (incluye `database.ts` y `upload-repository.ts` con la migración).

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-13** — Lint y Prettier pasan (sin caché de turbo).

  ```bash
  npx turbo run lint --force 2>&1 | tail -8
  npx prettier --check apps/ingestion-service/src packages/shared-types/src k8s/ingestion tareas/u4-T01-critique-storage.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores; Prettier sin archivos pendientes.

- [ ] **CA-14** — Manifiestos: tag `u4-T01` (sin `latest` ni `u3-T01`), `strategy: Recreate`, un solo `volume` con el PVC `ingestion-blobs` y **dos** `volumeMounts` con
      `subPath` (`blobs` → `/app/data/blobs`, `db` → `/app/data/db`), `DB_PATH` en el ConfigMap; `pvc.yaml` y `anthropic-key` intactos.

  ```bash
  grep -E "image: ingestion-service:u4-T01" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:(u3-T01|latest)" k8s/ingestion/deployment.yaml && echo "old tag absent"
  grep -E "type: Recreate" k8s/ingestion/deployment.yaml
  grep -cE "subPath: (blobs|db)" k8s/ingestion/deployment.yaml
  grep -E "mountPath: /app/data/(blobs|db)" k8s/ingestion/deployment.yaml
  grep -E "DB_PATH: '/app/data/db/ingestion.db'" k8s/ingestion/configmap.yaml
  grep -E "anthropic-key" k8s/ingestion/deployment.yaml
  git diff main..HEAD --name-only | grep -E "^k8s/ingestion/pvc.yaml$" && echo "FAIL: pvc tocado" && exit 1 || echo "pvc untouched"
  ```

  Esperado: nuevo tag, tag viejo ausente, `Recreate`, conteo `2`, dos `mountPath`, `DB_PATH` nuevo, `anthropic-key` presente, `pvc untouched`.

- [ ] **CA-15** — Imagen `ingestion-service:u4-T01` construida; sin tag `latest`.

  ```bash
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u4-T01 . 2>&1 | tail -15
  docker image inspect ingestion-service:u4-T01 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `no latest tag`.

- [ ] **CA-16** — **Persistencia real en kind**: tras desplegar, un upload creado **antes** de un reinicio del pod sigue siendo legible **después** del reinicio; otro
      usuario recibe 403 sobre él; la BD y los blobs están en el PVC. Lectura de vuelta con `kubectl`, no solo códigos de salida.

  ```bash
  kind load docker-image ingestion-service:u4-T01
  kubectl apply -f k8s/ingestion/configmap.yaml -f k8s/ingestion/deployment.yaml
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get pvc ingestion-blobs -o jsonpath='{.status.phase}{"\n"}'
  # port-forward en segundo plano: ingestion 3200 e identity 3100. Registrar DOS usuarios con emails únicos (register; no asumir test@example.com).
  # POST con JPEG como usuario A -> guarda UPLOAD_ID. Antes de reiniciar:
  curl -sf http://localhost:3200/api/uploads/$UPLOAD_ID -H "Authorization: Bearer $JWT_A" | tee /tmp/u4-before.json
  kubectl rollout restart deployment/ingestion-service && kubectl rollout status deployment/ingestion-service --timeout=180s
  # re-abrir el port-forward (el pod cambió) y repetir el GET:
  curl -sf http://localhost:3200/api/uploads/$UPLOAD_ID -H "Authorization: Bearer $JWT_A" | tee /tmp/u4-after.json
  curl -s -o /tmp/u4-b.json -w "%{http_code}\n" http://localhost:3200/api/uploads/$UPLOAD_ID -H "Authorization: Bearer $JWT_B"
  kubectl exec deploy/ingestion-service -- ls /app/data/db /app/data/blobs
  kubectl exec deploy/ingestion-service -- node -e 'const D=require("better-sqlite3");const db=new D("/app/data/db/ingestion.db",{readonly:true});console.log(JSON.stringify({uploads:db.prepare("SELECT COUNT(*) n FROM uploads").get().n,critiques:db.prepare("SELECT COUNT(*) n FROM category_critiques").get().n}))'
  node -e 'const a=require("/tmp/u4-before.json"),b=require("/tmp/u4-after.json");if(JSON.stringify(a)!==JSON.stringify(b))throw new Error("GET cambió tras reinicio");if(b.status!==200||b.data.categories.length!==5)throw new Error("bad detail");console.log("persisted across restart")'
  ```

  Esperado: imagen `ingestion-service:u4-T01 Recreate`, PVC `Bound`, código `403` para el usuario B, `ingestion.db` listado en `/app/data/db`, conteos `uploads≥1` y `critiques≥5`, e
  imprime `persisted across restart`. Cerrar los port-forward al terminar. El fallback (LOW) no se ejercita en el cluster (no hay API key): lo cubren CA-5 y CA-10.

- [ ] **CA-17** — Sin secretos en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-18** — Scope respetado (usa `main...HEAD`, tres puntos, porque `main` puede avanzar con informes del orquestador).

  ```bash
  git diff main...HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|apps/trust-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main...HEAD --name-only | grep -E "^packages/" | grep -v "^packages/shared-types/src/uploads.ts$" && echo "FAIL: packages fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^k8s/" | grep -vE "^k8s/ingestion/(deployment|configmap)\.yaml$" && echo "FAIL: k8s fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^apps/ingestion-service/(Dockerfile|src/(server|index)\.ts|src/service/(magic-number|blob-store|claude-client|critique-outcome|anthropic-error)\.ts)$" && echo "FAIL: archivo protegido tocado" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (Permitidos: `shared-types/src/uploads.ts`, `src/service/{database,upload-repository}.ts`, `src/handlers/uploads.ts`, tests de
  `src/__tests__/`, los dos manifiestos y `bitacoras/u4-T01.md`.)

- [ ] **CA-19** — Rama `tarea/u4-T01` sobre `main` con ≥ 2 commits legibles.
  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```
  Esperado: rama `tarea/u4-T01`, al menos 2 commits.

---

## Plan de pruebas

**Rojo primero:** antes de tocar código, escribe (a) el test HTTP «tras `POST` hay 5 filas en `category_critiques`», (b) el test «`GET` de otro usuario → 403» y
(c) el test de upgrade de schema viejo. Córrelos contra el código actual: deben fallar (hoy no existe la tabla, ni la ruta `GET` — responde el 404 del fallback global
— ni las columnas nuevas). Registra la salida roja en la bitácora y luego pásalos a verde. Para el 403, ojo: el 404 global de hoy **no** es un 403; el test debe afirmar el
403 exacto.

- `database.test.ts` / `upload-repository.test.ts` (BD `:memory:` o archivo temporal; limpia los temporales en `afterEach`):
  - Tablas y columnas creadas; idempotencia (abrir dos veces); upgrade desde schema viejo conservando la fila; FK activa; CHECK de `category_id` y `score`.
  - `saveCritique` ready (UPDATE + 5 filas), fallback (UPDATE + 0 filas), rollback ante falla a mitad; `getDetail` (null, orden, timestamp ISO con `Z`, upload sin crítica).
  - Lectura de vuelta con SQL directo, no solo con el repo.
- `uploads-http.test.ts` (ampliar; `makeJwt` para dos/tres usuarios): CA-4 a CA-10. Los de 403 y 404 afirman el body completo. Tests de `GET` con repo real (`:memory:`) e inyectado
  donde se necesite forzar un fallo. Mantén todos los tests existentes de `POST` verdes sin debilitarlos.
- Test de integración mínimo de «POST → GET»: el body de `categories` del `GET` es igual al del `POST`.

---

## Notas

- **Decisiones D-3 y D-4** fijadas en el Alcance: sin filas en `category_critiques` para fallbacks; un upload sin crítica persistida da 404 al dueño. Si el codificador cree que alguna
  es incorrecta, **no la cambia**: lo reporta en la bitácora y el orquestador lo registra.
- **ProgressService (C5):** debe excluir uploads con `status='low_confidence'` (o `confidence='LOW'`). Se anota en la bitácora como dependencia para u5/u6; u4 no lo implementa.
- **403 vs 404:** AC-4.1 exige 403 para el upload de otro usuario aunque eso confirme que el id existe; está aceptado en el contrato C1. No «mejorarlo» a 404.
- **Timestamps:** `uploads.timestamp` guarda UTC sin zona; el detalle expone ISO-8601 con `Z`. No cambiar el `DEFAULT CURRENT_TIMESTAMP` de la columna.
- **SQLite en el PVC:** `journal_mode = WAL` crea archivos `-wal`/`-shm` junto a la BD; por eso el montaje del directorio `/app/data/db`, no del archivo. `Recreate` evita dos pods sobre la misma BD.
  Un PVC `ReadWriteOnce` con `storageClassName: standard` en kind es local y suficiente para el MVP. Si `kubectl rollout status` se atasca, repórtalo en la bitácora con la salida de
  `kubectl describe pod`; no rediseñes el almacenamiento.
- **`ingestion-blobs`** es ahora el PVC de blobs **y** BD. El nombre no se cambia en esta tarea (renombrar obligaría a borrar/recrear el PVC); queda como candidata.
- Archivos que se modifican en su sitio: `uploads.ts` (shared-types), `database.ts`, `upload-repository.ts`, `handlers/uploads.ts`, los tests existentes, `deployment.yaml`, `configmap.yaml`.
  Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. El `kubectl apply` y el `rollout restart` solo en CA-16 y solo sobre el deployment `ingestion-service`; no toques identity, trust ni backend.
  Los pods de identity y trust siguen con imágenes de ola 1.
- **Bitácora:** `bitacoras/u4-T01.md` con entradas por ronda: hash de la tarea, salida roja inicial, cómo hiciste la migración, qué se verificó en kind (comandos y salidas de CA-16),
  qué queda para u4-T02 y para u5/u6, y respuestas a hallazgos del revisor por identificador. **Incluye en la bitácora cada `docker build`, `kind load` y `rollout` que hagas, con su salida.**

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u4-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u4-T01`. Imagen Docker: `ingestion-service:u4-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 4** (única tarea despachable: u4-T01; u4-T02 depende de ella)._
