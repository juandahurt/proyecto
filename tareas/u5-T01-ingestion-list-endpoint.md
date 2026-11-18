# u5-T01 — `GET /api/uploads`: listado de uploads del usuario autenticado, en `apps/ingestion-service/`

> **Primera tarea de u5-history-storage.** El contrato C5 asumía «PostgreSQL compartido de solo lectura»; lo construido es SQLite en un PVC `ReadWriteOnce` con un único dueño
> (ingestion). Esta tarea abre el camino que **sí** existe: ingestion expone el listado por HTTP y, en u5-T02, ProgressService lo consume reenviando el JWT del usuario.
>
> **Decisiones del humano (ya tomadas, no se reabren):**
>
> - **Opción A** de HANDOFF-9 §7: acceso por HTTP, no por schema compartido ni por PVC compartido. C5 cambia de «schema compartido» a «HTTP con el JWT del usuario».
> - **Autenticación:** el JWT del usuario. **No hay endpoint `/internal`, ni token de servicio, ni Secret nuevo.** El `userId` sale **solo** del token verificado, nunca de un parámetro.
> - El `kubectl apply` / `rollout restart` de esta tarea entra en el CA de despliegue **solo si el humano lo autoriza para esta tarea** (no es un permiso general).

**Unidad:** u5-history-storage (IngestionService — extensión; ProgressService llega en u5-T02)
**Historias que implementa:** US-5 (historial ordenado en el tiempo por usuario: ID, fecha, scores por categoría, flag de confianza). AC-4.1 (aislamiento): un usuario solo lista lo suyo. AC-4.2: **sin salidas de red nuevas**.
**Depende de:** u4-T02 (fusionada, `main` @ `a9b9e39` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`packages/shared-types/src/uploads.ts`** (solo este archivo del package; cambio **aditivo**): añadir `UploadListItemSchema` y `UploadListSchema` y sus tipos con `z.infer<>`.
> Todo se **deriva** de lo existente, sin copiar campos a mano:
>
> - `UploadListItemSchema = z.object({ uploadId, status, confidence, timestamp, scores, fallbackReason? })`, con `uploadId`, `status`, `confidence` y `fallbackReason` tomados de
>   `UploadResultSchema.shape.data.shape.*`, `timestamp` igual que en `UploadDetailSchema` (`z.string().datetime()`) y
>   `scores: z.array(CategoryCritiqueSchema.pick({ categoryId: true, score: true }))`.
> - `UploadListSchema = z.object({ data: z.object({ items: z.array(UploadListItemSchema) }), error: z.null(), status: z.literal(200) })`.
> - **Los items no llevan** `feedback`, `categoryName`, `thumbnailUrl`, `userId`, `storedFilename`, `mimeType` ni `sizeBytes`. Es un resumen para tendencias, no el detalle.
> - `UploadResultSchema` y `UploadDetailSchema` **no cambian**.
>
> **`apps/ingestion-service/src/service/upload-repository.ts`** (modificar, aditivo): añadir a la interfaz y a la implementación
> `listByUser(userId: string): UploadListRecord[]` (exportar `UploadListRecord`: `uploadId`, `timestamp` ISO con `Z` vía el `toIsoUtc` existente, `status`, `confidence`, `fallbackReason | null`, `scores: {categoryId, score}[]`).
>
> - Devuelve **solo** los uploads con `user_id = ?` **y** `status IS NOT NULL` (los sin crítica persistida no existen para el listado, igual que dan 404 en el detalle, D-4).
> - Orden **más reciente primero**: `ORDER BY timestamp DESC, rowid DESC`. `timestamp` es `CURRENT_TIMESTAMP` (resolución de **segundos**): sin el desempate `rowid DESC` dos uploads del mismo segundo salen en orden indefinido.
> - Los `scores` de cada item van ordenados por `category_id ASC`. Un upload `low_confidence` tiene `scores: []` (0 filas, D-3) y lleva `fallbackReason`; uno `ready` tiene 5 scores y **no** lleva `fallbackReason`.
> - **Sin N+1:** exactamente **dos** consultas (cabeceras del usuario y categorías de esos uploads con `JOIN uploads ... WHERE user_id = ?`), ejecutadas dentro de **una sola** `db.transaction(...)` para que el listado sea una lectura consistente (cierra la parte de lectura de C-31).
> - Todo con `db.prepare` parametrizado; el `userId` jamás se concatena en el SQL.
>
> **`apps/ingestion-service/src/handlers/uploads.ts`** (modificar): `router.get('/', ...)` registrado **antes** de `router.get('/:uploadId', ...)`. Usa **solo** `req.user!.userId`.
> Responde `200 { data: { items }, error: null, status: 200 }` con `satisfies UploadList`; sin uploads → `items: []` (no 404). Cualquier parámetro `userId` de la query **se ignora**. Un error inesperado del repo → `500 { data: null, error: 'Failed to list uploads', status: 500 }` y un log con solo la marca `[uploads] failed to list` (sin `userId`, sin datos).
> `POST /` y `GET /:uploadId` **no cambian**.
>
> **`k8s/ingestion/deployment.yaml`** (modificar): **solo** `image: ingestion-service:u5-T01`. Ninguna otra línea cambia.
>
> **Tests**: ver Plan de pruebas.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- ProgressService, tendencias, regresión, gate de tier (u5-T02, u6, u7). Cualquier cliente HTTP hacia otro servicio.
- Endpoint `/internal/...`, token de servicio, Secret nuevo, cambios en `packages/auth-middleware`.
- **Paginación, filtros por fecha o por estado, `limit`/`offset`** (el MVP lista todo; queda como candidata). Ordenar ascendente: el consumidor reordena si lo necesita.
- Cambiar el schema de la BD: `database.ts` **no se toca** (el índice `idx_uploads_user_id` existente basta). Migraciones.
- `thumbnailUrl` en el listado, borrar uploads o blobs (u13), `wal_checkpoint` (C-30).
- Cambiar `POST /api/uploads`, `GET /:uploadId`, `thumbnail.ts`, `thumbnail-url.ts`, `blob-store.ts`, `claude-client.ts` (C-22 va en otra tarea), `Dockerfile`, `index.ts`.
- Tocar identity-service, trust-service, backend, `pvc.yaml`, `configmap.yaml`, `service.yaml`.
- Actualizar `contract-summary.md` (C5): lo hace el orquestador, no el codificador.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data,error,status}`, Jest, cobertura 80%/75%
- `aidlc/spaces/default/memory/project.md` — reglas duras (sin secretos, **nunca `latest`**, no duplicar tipos de contrato)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u5
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — C1 y C5 (C5 queda **superado** por esta decisión; no lo edites)
- `bitacoras/u4-T01.md`, `bitacoras/u4-T02.md`, `revisiones/u4-T01/ronda-1.md`, `revisiones/u4-T02/ronda-1.md` — estado previo y lecciones (orden de autorización, sondas, mutaciones)
- `tareas/u4-T02-thumbnail-signed-url.md` — molde de formato y de CA de despliegue
- `apps/ingestion-service/src/handlers/uploads.ts`, `src/server.ts`, `src/service/upload-repository.ts`, `src/service/database.ts` (solo lectura)
- `apps/ingestion-service/src/__tests__/uploads-http.test.ts`, `upload-repository.test.ts` (patrón de tests, `makeJwt`, `createDatabase(':memory:')`)
- `packages/shared-types/src/uploads.ts` (se extiende)
- `k8s/ingestion/deployment.yaml` (se modifica)
- `CANDIDATAS.md` — C-30, C-31

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u5-T01` checada. En un worktree limpio hay que compilar antes los packages:
`npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — `UploadListSchema` existe, se deriva de lo existente y no filtra campos internos; `UploadResultSchema`/`UploadDetailSchema` no cambian; `tsc` pasa.

  ```bash
  grep -nE "UploadListItemSchema|UploadListSchema" packages/shared-types/src/uploads.ts
  git diff main...HEAD -- packages/shared-types/src/uploads.ts | grep -E "^-[^-]" && echo "FAIL: líneas existentes modificadas" && exit 1 || echo "cambio solo aditivo"
  node -e 'const s=require("fs").readFileSync("packages/shared-types/src/uploads.ts","utf8");const i=s.indexOf("export const UploadListItemSchema");if(i<0)throw new Error("sin item schema");const blk=s.slice(i);for(const w of ["feedback:","categoryName:","thumbnailUrl:","userId:","storedFilename:"]){if(blk.includes(w))throw new Error("campo prohibido en la lista: "+w)}console.log("item schema sin campos internos")'
  npm run build -w packages/shared-types 2>&1 | tail -3
  npx tsc --noEmit -p apps/ingestion-service 2>&1 | tail -3
  ```

  Esperado: ambos schemas presentes, `cambio solo aditivo`, `item schema sin campos internos`, build y `tsc` exit 0.

- [ ] **CA-2** — El repositorio devuelve lo correcto: solo uploads **del usuario**, solo con crítica persistida (`status` no nulo), 5 `scores` ordenados por `category_id` en `ready`, `scores: []` + `fallbackReason` en `low_confidence`, `timestamp` ISO con `Z`; **orden `timestamp DESC, rowid DESC` con desempate**; `[]` si no hay nada.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=upload-repository --no-coverage --verbose 2>&1 | grep -E "(listByUser|lista|orden|desempate|mismo segundo|otro usuario|sin crítica|low_confidence|vacío)"
  ```

  Esperado: tests en verde con nombre para cada caso. **El caso de desempate** inserta ≥ 3 uploads del mismo usuario con **exactamente el mismo** `timestamp` (se fuerza con `UPDATE uploads SET timestamp = ?` en la BD en memoria) y afirma el orden por `rowid` descendente; y otro caso con timestamps distintos. **Criterio de mutación:** si se quita `rowid DESC` del `ORDER BY`, el test de desempate debe **fallar**; si se quita `status IS NOT NULL`, el de «sin crítica» debe fallar; si se quita `user_id = ?`, el de «otro usuario» debe fallar.

- [ ] **CA-3** — Una sola lectura consistente y sin N+1: `listByUser` hace **exactamente 2** consultas y dentro de **una** transacción, aunque haya 50 uploads.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=upload-repository --no-coverage --verbose 2>&1 | grep -E "(2 consultas|N\+1|transacción|transaction|prepare)"
  grep -n "db.transaction" apps/ingestion-service/src/service/upload-repository.ts
  ```

  Esperado: test en verde que cuenta las ejecuciones de `prepare/all` (espía sobre `db.prepare` o sobre las sentencias) con 50 uploads y afirma 2; `db.transaction` presente en el repo.

- [ ] **CA-4** — `GET /api/uploads` del usuario A devuelve **solo sus** items, en el orden esperado, y el body completo pasa `UploadListSchema.safeParse`; sin uploads → `200` con `items: []`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(GET /api/uploads|listado|lista|items|vacío|UploadListSchema)"
  ```

  Esperado: tests en verde. El flujo es `POST` real (stub HIGH y fallback por mock) con dos usuarios → `GET` de cada uno. Se afirma cantidad, orden (más reciente primero), `status`, 5 scores en `ready` y `scores: []` en fallback.

- [ ] **CA-5** — **Aislamiento y no filtrado.** El usuario B **no ve nada de A** aunque envíe `?userId=<A>`, `?user_id=<A>` o un `uploadId` de A; ante cualquier query el `userId` usado es el del token. El body serializado (`JSON.stringify(res.body)`) **no contiene** `userId`, `user_id`, `storedFilename`, `stored_filename`, `mimeType`, `sizeBytes`, `feedback`, `thumbnailUrl`, `sig=`, ni el `userId` de otro usuario.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(aislamiento|otro usuario|userId|query|no expone|no filtra|prohibid)"
  ```

  Esperado: tests en verde. **Sonda propia, no solo el body (Lección 12):** un espía sobre `db.prepare` o sobre `repo.listByUser` afirma que se llamó **una vez** con el `userId` **del token** (nunca con el de la query). **Criterio de mutación:** si el handler pasa `req.query.userId` al repo, el test debe **fallar**.

- [ ] **CA-6** — Autenticación y errores: sin JWT → `401 {data:null,error:"unauthenticated",status:401}`; JWT mal firmado/expirado → 401; fallo del repo → `500 {data:null,error:"Failed to list uploads",status:500}` y el log no contiene el `userId` ni datos; `GET /:uploadId`, `POST /` y la miniatura **no cambian de comportamiento**.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(uploads-http|thumbnail|health)" --no-coverage --verbose 2>&1 | grep -E "(401|unauthenticated|500|Failed to list|log|thumbnail|health)"
  ```

  Esperado: tests en verde. La ruta `/` no queda atrapada por `/:uploadId`: un test afirma que `GET /api/uploads` **no** responde 404 `Not Found` del detalle.

- [ ] **CA-7** — Regresiones: toda la suite de ingestion y backend en verde, sin tests saltados ni debilitados.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -15
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: ingestion completa en verde, `tsc` exit 0, backend sin fallos.

- [ ] **CA-8** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches.

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-9** — Lint y Prettier pasan (sin caché de turbo).

  ```bash
  npx turbo run lint --force 2>&1 | tail -8
  npx prettier --check apps/ingestion-service/src packages/shared-types/src k8s/ingestion tareas/u5-T01-ingestion-list-endpoint.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores; Prettier sin archivos pendientes.

- [ ] **CA-10** — **Sin dependencias nuevas** y **sin cambios de schema de BD**.

  ```bash
  git diff main...HEAD --name-only | grep -E "(^|/)package(-lock)?\.json$" && echo "FAIL: dependencias tocadas" && exit 1 || echo "no dependency changes"
  git diff main...HEAD --name-only | grep -E "^apps/ingestion-service/src/service/database\.ts$" && echo "FAIL: database.ts tocado" && exit 1 || echo "database.ts intacto"
  ```

  Esperado: imprime `no dependency changes` y `database.ts intacto`.

- [ ] **CA-11** — Manifiesto: **solo cambia el tag** de la imagen (`u5-T01`); sin `latest`; `Recreate`, `subPath`, `anthropic-key` y `thumbnail-signing-key` intactos.

  ```bash
  grep -E "image: ingestion-service:u5-T01" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:(u4-T02|latest)" k8s/ingestion/deployment.yaml && echo "old tag absent"
  git diff main...HEAD -- k8s/ingestion/deployment.yaml | grep -E "^[+-][^+-]" | wc -l
  grep -E "type: Recreate" k8s/ingestion/deployment.yaml
  grep -cE "subPath: (blobs|db)" k8s/ingestion/deployment.yaml
  grep -E "name: (anthropic-key|thumbnail-signing-key)" k8s/ingestion/deployment.yaml
  ```

  Esperado: nuevo tag, `old tag absent`, **`2`** líneas cambiadas (una `-`, una `+`), `Recreate`, conteo `2`, ambos Secrets presentes.

- [ ] **CA-12** — Imagen `ingestion-service:u5-T01` construida; sin tag `latest`.

  ```bash
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u5-T01 . 2>&1 | tail -15
  docker image inspect ingestion-service:u5-T01 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `no latest tag`.

- [ ] **CA-13** — **En kind, de punta a punta** (solo con autorización del humano para esta tarea). Se despliega y se verifica con `curl` real y lectura de vuelta con `kubectl`: dos usuarios con emails únicos, uploads de cada uno, listados aislados, y los datos **sobreviven a un reinicio**.
      Usa un directorio propio del scratchpad (`$WORK`), no `/tmp` directo (C-38). No imprimas el JWT en la bitácora.

  ```bash
  kind load docker-image ingestion-service:u5-T01
  kubectl apply -f k8s/ingestion/deployment.yaml
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  # port-forward en segundo plano: ingestion 3200 e identity 3100. Registrar DOS usuarios con emails únicos.
  # Usuario A: dos POST (JPEG). Usuario B: un POST. Luego:
  curl -s -w " %{http_code}\n" http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_A"        # 200, 2 items, el más reciente primero
  curl -s -w " %{http_code}\n" http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_B"        # 200, 1 item (el de B)
  curl -s -w " %{http_code}\n" "http://localhost:3200/api/uploads?userId=$ID_A" -H "Authorization: Bearer $JWT_B"   # 200, SOLO el item de B
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3200/api/uploads                              # 401
  kubectl rollout restart deployment/ingestion-service && kubectl rollout status deployment/ingestion-service --timeout=180s
  # re-abrir el port-forward y repetir el listado de A:
  curl -s -w " %{http_code}\n" http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_A"        # los mismos 2 items tras el reinicio
  kubectl logs deploy/ingestion-service | grep -ci "bearer"                                              # 0
  ```

  Esperado: imagen `ingestion-service:u5-T01 Recreate`; `200` con 2 items para A (ids que coinciden con los de los `POST`, orden descendente, 5 scores cada uno), `200` con 1 item para B, el `?userId=` de A **no** revela nada, `401` sin token, los mismos 2 items tras el reinicio (persistencia en el PVC) y `0` líneas con `bearer` en los logs. Cerrar los port-forward al terminar (el PID 4456 es del humano: no lo toques). El **solo** `kubectl apply` permitido es el del deployment `ingestion-service`.

- [ ] **CA-14** — Sin secretos en el diff ni en el árbol.

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`. El barrido de **árbol** excluye `bitacoras/` y `revisiones/` (C-29); el del **diff** no excluye nada. No cites literales con forma de clave en bitácoras, tests ni comentarios.

- [ ] **CA-15** — Scope respetado (`main...HEAD`, tres puntos).

  ```bash
  git diff main...HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|apps/trust-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main...HEAD --name-only | grep -E "^packages/" | grep -v "^packages/shared-types/src/uploads.ts$" && echo "FAIL: packages fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^k8s/" | grep -vE "^k8s/ingestion/deployment\.yaml$" && echo "FAIL: k8s fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^apps/ingestion-service/(Dockerfile|src/index\.ts|src/service/(database|magic-number|claude-client|critique-outcome|anthropic-error|blob-store|thumbnail-url)\.ts|src/handlers/thumbnail\.ts)$" && echo "FAIL: archivo protegido tocado" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (Permitidos: `shared-types/src/uploads.ts`, `src/service/upload-repository.ts`, `src/handlers/uploads.ts`, tests de `src/__tests__/`, `deployment.yaml` y `bitacoras/u5-T01.md`.)

- [ ] **CA-16** — Rama `tarea/u5-T01` sobre `main` con ≥ 2 commits legibles, sin `git commit -a` que arrastre archivos ajenos.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  git show --stat --format=%s HEAD | head -15
  ```

  Esperado: rama `tarea/u5-T01`, al menos 2 commits, cada commit solo con archivos de su mensaje.

---

## Plan de pruebas

**Rojo primero (de ejecución, no de compilación — Lección 13):** antes de implementar, crea los **exports mínimos que hagan compilar** (`listByUser` que devuelve `[]`, `router.get('/')` que responde `200` con `items: []`) y escribe: (a) «el listado del usuario trae sus uploads en orden descendente», (b) «el desempate por `rowid` con timestamps idénticos», (c) «B no ve los items de A aunque mande `?userId=A`», (d) «`status` nulo no aparece». Córrelos: deben **fallar por la aserción**, no por un error de import o de tipos. Registra la salida roja en la bitácora y luego pásalos a verde.

- `upload-repository.test.ts` (ampliar): CA-2 y CA-3 sobre `createDatabase(':memory:')`; timestamps forzados con `UPDATE`; espía/contador de consultas.
- `uploads-http.test.ts` (ampliar): CA-4 a CA-6 con `makeJwt` y 2-3 usuarios; espía sobre `repo.listByUser`; espía sobre `console` para el 500.
- **Casos inválidos con entradas realmente válidas salvo en la propiedad probada (Lección 16):** el test de aislamiento debe tener datos de A **realmente presentes** en la BD; si no, pasa aunque falte el filtro.
- Mantén verdes todos los tests de u4-T02 y anteriores **sin debilitarlos**.

---

## Notas

- **Por qué orden descendente:** es lo natural para un historial que se muestra; u6 (regresión) puede invertirlo. Se fija aquí para que u5-T02 no lo adivine.
- **Por qué el JWT y no un token de servicio:** u5–u7 solo se disparan por una petición de usuario, así que reenviar su JWT basta y el aislamiento lo impone el token. Si más adelante hay trabajos sin usuario, se abre una tarea nueva.
- **Qué no se promete:** sin paginación. Un usuario con miles de uploads recibiría un listado enorme; es una candidata futura (se registrará si el revisor la plantea).
- **Despliegue:** el `Recreate` evita dos pods sobre la misma BD. Si `rollout status` se atasca, repórtalo en la bitácora con `kubectl describe pod` y **para**.
- Archivos que se **modifican en su sitio**: `shared-types/src/uploads.ts`, `upload-repository.ts`, `handlers/uploads.ts`, `deployment.yaml`, los tests existentes. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. `kubectl apply` solo sobre `deployment.yaml` y `rollout restart` solo sobre `ingestion-service`, solo en CA-13 y solo con autorización. No toques identity, trust ni backend.
- **Bitácora:** `bitacoras/u5-T01.md` con entradas por ronda: hash de la tarea, salida roja inicial, decisiones de estructura (las dos consultas, la transacción), lo verificado en kind (comandos y salidas de CA-13), qué queda para u5-T02 y respuestas a hallazgos del revisor por identificador. **Registra cada `docker build`, `kind load` y `rollout` con su salida.** Usa `git add <rutas>` explícitas.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u5-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u5-T01`. Imagen Docker: `ingestion-service:u5-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 6** (en paralelo con u3-T02; u5-T02 espera a que esta se fusione)._
