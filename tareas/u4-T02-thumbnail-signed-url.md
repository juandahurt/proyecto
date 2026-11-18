# u4-T02 — `thumbnailUrl` firmada de 15 min en `GET /api/uploads/:uploadId` y endpoint que sirve la imagen, en `apps/ingestion-service/`

> **Segunda y última tarea de u4-critique-storage.** u4-T01 (fusionada, `main` @ `f42af66`) dejó persistencia y el detalle con 401/403/404. Esta tarea
> añade la **URL firmada de corta vida** a la imagen (contrato C1: `thumbnailUrl`, «válida 15 minutos») y la ruta que la sirve.
>
> **Decisiones del humano (ya tomadas, no se reabren):**
>
> - La «miniatura» es **el blob original**, sin redimensionar: **no se añade `sharp` ni ninguna dependencia nueva**. El redimensionado queda como candidata futura.
> - Los uploads en `low_confidence` **también** llevan `thumbnailUrl` (el blob existe).
> - El `kubectl apply` / `rollout restart` de esta tarea entra en el CA de despliegue **solo para esta tarea** (no es un permiso general).

**Unidad:** u4-critique-storage (IngestionService — extensión)
**Historias que implementa:** US-4 (el dueño ve su imagen con la crítica; AC-4.1 aislamiento: la URL se emite solo al dueño). AC-4.2 (imágenes nunca a entrenamiento): esta tarea **no añade ninguna salida de red**.
**Depende de:** u4-T01 (fusionada, `main` @ `f42af66` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`packages/shared-types/src/uploads.ts`** (solo este archivo del package; cambio **aditivo**): añadir a `UploadDetailSchema.shape.data` el campo
> `thumbnailUrl: z.string().min(1).optional()`. `UploadResultSchema` (el de `POST`) **no cambia**. El tipo sigue derivándose con `z.infer<>`.
>
> **`apps/ingestion-service/src/service/thumbnail-url.ts`** (archivo nuevo): módulo puro de firma, sin Express ni BD. Exporta:
>
> - `THUMBNAIL_TTL_SECONDS = 900` (constante; no configurable).
> - `signThumbnailUrl({ uploadId, key, nowMs })` → `string` con la forma de **ruta relativa** `/api/uploads/<uploadId>/thumbnail?exp=<unixSegundos>&sig=<hex>`, donde
>   `exp = floor(nowMs/1000) + 900` y `sig` = **HMAC-SHA256** (hex, 64 caracteres) de la cadena `thumbnail:<uploadId>:<exp>` con `key`.
> - `verifyThumbnailSignature({ uploadId, exp, sig, key, nowMs })` → `boolean`. Devuelve `false` (nunca lanza) si: `uploadId` no es UUID; `exp` no es un entero decimal
>   positivo (solo dígitos); `sig` no son exactamente 64 caracteres hex; la firma no coincide; o `floor(nowMs/1000) >= exp` (expirada: en el segundo `exp` ya no vale).
>   La comparación de firmas usa **`crypto.timingSafeEqual`** sobre buffers de igual longitud (comprobar la longitud **antes**, porque `timingSafeEqual` lanza si difieren).
>
> **`apps/ingestion-service/src/service/blob-store.ts`** (modificar, aditivo): añadir `readBlob(storedFilename)` → `Promise<Buffer>` que lee de `BLOB_DIR` (misma resolución que `writeBlob`).
> **Defensa de ruta:** rechazar (lanzar) si `storedFilename` no es un nombre simple (`path.basename(x) !== x`, o contiene `..` o separadores) o si la ruta resuelta queda fuera de `BLOB_DIR`.
> `writeBlob` no cambia.
>
> **`apps/ingestion-service/src/handlers/uploads.ts`** (modificar): en `GET /:uploadId`, **después** de confirmar el dueño y que hay crítica (`status` no nulo), añadir
> `thumbnailUrl: signThumbnailUrl(...)` al `data` de la respuesta 200, **tanto para `ready` como para `low_confidence`** (decisión del humano). En los caminos 404 y 403 **no** hay URL
> ni ningún campo. El body sigue llevando `satisfies UploadDetail`. `POST /` **no cambia**.
>
> **`apps/ingestion-service/src/handlers/thumbnail.ts`** (archivo nuevo): handler `GET /api/uploads/:uploadId/thumbnail?exp=&sig=`, **sin JWT** (una URL firmada va en un `<img>`; la
> autorización se decidió al emitir la URL). Orden fijo de comprobaciones:
>
> 1. `verifyThumbnailSignature(...)` es `false` por **cualquier** motivo (id no UUID, `exp`/`sig` ausentes o mal formados, firma alterada, firma de **otro** `uploadId`, expirada) →
>    **403** `{data:null,error:'Forbidden',status:403}`. Un solo mensaje y un solo código para todos esos casos; **no** se consulta la BD antes de validar la firma.
> 2. Firma válida pero `repo.findById(uploadId)` es `null` → **404** `{data:null,error:'Not Found',status:404}`.
> 3. La fila existe pero el blob no (`ENOENT`) → **404** igual. Cualquier otro error de lectura (incluida la defensa de ruta) → **500** `{data:null,error:'Failed to read file',status:500}`.
> 4. Éxito → **200** con los bytes del blob, `Content-Type` = `mimeType` de la fila (lo detectó el servidor por magic-number en u1, nunca el cliente),
>    `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.
>
> Los logs de este handler **no** incluyen `sig`, la URL completa ni la clave; solo `uploadId` y el motivo genérico.
>
> **`apps/ingestion-service/src/server.ts`** (modificar): registrar la ruta de miniatura **antes** de `app.use('/api/uploads', requireAuth, …)` (si no, `requireAuth` la intercepta).
> `createApp` recibe la clave de firma por `deps.signingKey` o, si no, de `process.env.THUMBNAIL_SIGNING_KEY`; **si falta o tiene menos de 32 caracteres, `createApp` lanza** (falla al
> arrancar, nunca firma con clave vacía). Añadir `deps.now?: () => number` (ms epoch, por defecto `Date.now`) para poder fijar el reloj en tests. Pasar clave y reloj al router de
> uploads y al handler de miniatura. Los demás endpoints siguen **detrás** de `requireAuth`.
>
> **`k8s/ingestion/deployment.yaml`** (modificar): `image: ingestion-service:u4-T02`; añadir env `THUMBNAIL_SIGNING_KEY` desde `secretKeyRef` →
> Secret `thumbnail-signing-key`, key `signing-key`, **sin `optional`** (si el Secret no existe el pod no arranca: falla visible, no firma débil). El resto del manifiesto no cambia.
>
> **El Secret `thumbnail-signing-key` NO se crea en esta tarea ni va al repo:** lo crea el humano con `kubectl create secret generic` **antes** del despacho (ver Notas). El codificador solo
> comprueba que existe (sin leer su valor).
>
> **Tests**: ver Plan de pruebas. Los tests existentes que llaman `createApp()` se ajustan **en su sitio** para inyectar `signingKey` (o fijar la variable de entorno); sin debilitar ninguna aserción.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Redimensionar, recomprimir o generar una miniatura distinta del blob original; `sharp`, `jimp` o **cualquier dependencia nueva** (`package.json` y `package-lock.json` no cambian).
- Cambiar el contrato de `POST /api/uploads`, `resolveCritique`, `claude-client.ts`, `anthropic-error.ts`, `database.ts` (el schema no cambia), `upload-repository.ts`, `magic-number.ts`, `Dockerfile`, `index.ts`.
- Rotación de claves, múltiples claves, revocación de URLs individuales, URL absoluta con host (la URL es una ruta relativa; el cliente antepone su base).
- CDN, `Range`/streaming parcial, cabeceras de caché agresivas (la respuesta es `private, no-store`).
- Listado/historial (u5), tendencias (u6), borrado (u13). Borrar blobs. Renombrar el PVC (C-28), limpiar blobs huérfanos (C-27).
- `maxRetries` del SDK (C-22), razón `api_error` (C-23), el patrón de CA-17 de C-29 (se respeta como está; ver Notas).
- Tocar identity-service, trust-service, backend, `packages/auth-middleware`, `pvc.yaml`, `configmap.yaml`, `service.yaml`.
- Crear, leer o imprimir el valor del Secret. **No** poner la clave en ningún archivo del repo, bitácora, test (usa una constante de prueba claramente falsa, ver Notas) ni log.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data,error,status}`, Jest, cobertura 80%/75%
- `aidlc/spaces/default/memory/project.md` — reglas duras (sin secretos, secretos solo como `Secret` de K8s, tags explícitos, **nunca `latest`**)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u4
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — C1 (`thumbnailUrl`: «URL firmada de corta vida … válida 15 minutos»)
- `bitacoras/u4-T01.md`, `tareas/u4-T01-critique-storage.md`, `revisiones/u4-T01/ronda-1.md`, `revisiones/u4-T01/ronda-2.md` — estado previo y lecciones (orden cabecera → dueño → categorías; sondas de autorización)
- `apps/ingestion-service/src/handlers/uploads.ts`, `src/server.ts`, `src/service/blob-store.ts`, `src/service/upload-repository.ts` (`findById` ya devuelve `storedFilename` y `mimeType`)
- `apps/ingestion-service/src/__tests__/uploads-http.test.ts`, `blob-store.test.ts`, `health.test.ts` (patrón de tests y `makeJwt`)
- `packages/shared-types/src/uploads.ts` (se extiende)
- `k8s/ingestion/deployment.yaml` (se modifica); `k8s/ingestion/configmap.yaml`, `pvc.yaml` (solo lectura)
- `CANDIDATAS.md` — C-27/C-28 (PVC), C-29 (patrón de secretos)

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u4-T02` checada. En un worktree limpio hay que compilar antes los packages:
`npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — `UploadDetailSchema` acepta `thumbnailUrl` opcional; `UploadResultSchema` no lo tiene; `tsc` pasa.

  ```bash
  grep -n "thumbnailUrl" packages/shared-types/src/uploads.ts
  node -e 'const s=require("fs").readFileSync("packages/shared-types/src/uploads.ts","utf8");const i=s.indexOf("export const UploadDetailSchema");if(i<0)throw new Error("no detail");if(s.slice(0,i).includes("thumbnailUrl"))throw new Error("thumbnailUrl en UploadResultSchema");console.log("thumbnailUrl solo en UploadDetailSchema")'
  npm run build -w packages/shared-types 2>&1 | tail -3
  npx tsc --noEmit -p apps/ingestion-service 2>&1 | tail -3
  ```

  Esperado: `thumbnailUrl` aparece solo en el schema de detalle, imprime `thumbnailUrl solo en UploadDetailSchema`, build y `tsc` exit 0.

- [ ] **CA-2** — El módulo de firma es correcto y robusto (unit tests con reloj fijo): firma/verificación felices; `exp = floor(nowMs/1000)+900`; verificación `false` para `uploadId` alterado,
      `exp` alterado, `sig` alterada, firma de otra clave, firma de **otro** `uploadId` con el mismo `exp`, `sig` de longitud ≠ 64, `sig` no hex, `exp` no numérico/negativo/`1e9`/con espacios, `uploadId` no UUID;
      **frontera de expiración**: válida en `exp-1`, inválida en `exp` y en `exp+1`; ninguna entrada hace que lance. Se usa `timingSafeEqual`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=thumbnail-url --no-coverage --verbose 2>&1 | tail -40
  grep -n "timingSafeEqual" apps/ingestion-service/src/service/thumbnail-url.ts
  ! grep -nE "(sig|signature|expected)[A-Za-z]*\s*(===|!==|==|!=)" apps/ingestion-service/src/service/thumbnail-url.ts && echo "sin comparación directa de firmas"
  ```

  Esperado: suite en verde con tests con nombre para cada caso anterior (incluida la frontera `exp-1`/`exp`/`exp+1`), `timingSafeEqual` presente, imprime `sin comparación directa de firmas`.

- [ ] **CA-3** — `GET /api/uploads/:uploadId` del **dueño** devuelve `thumbnailUrl` en `ready` **y** en `low_confidence`; la URL tiene la forma `/api/uploads/<uploadId>/thumbnail?exp=<n>&sig=<64 hex>` con
      `exp` = reloj inyectado + 900; el body completo pasa `UploadDetailSchema.safeParse`. En **403** (otro usuario), **404** (inexistente, id no UUID, sin crítica) y **401** el body **no contiene**
      `thumbnailUrl`, `sig=` ni `exp=` (`JSON.stringify(res.body)`).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage --verbose 2>&1 | grep -E "(thumbnailUrl|thumbnail|firmada|signed)"
  ```

  Esperado: tests en verde para: ready con URL, low_confidence con URL, `exp` exacto con reloj fijo, y ausencia de URL en 403/404/401.

- [ ] **CA-4** — `GET /api/uploads/:uploadId/thumbnail` con firma válida y **sin `Authorization`** → **200**; los bytes son **idénticos** al archivo subido (comparación de buffer / sha256 contra el
      JPEG enviado en el `POST`); `Content-Type` es el MIME detectado por el servidor; `X-Content-Type-Options: nosniff`; `Cache-Control: private, no-store`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=thumbnail --no-coverage --verbose 2>&1 | grep -E "(200|bytes|idénticos|Content-Type|nosniff|no-store|sin JWT|sin Authorization)"
  ```

  Esperado: tests en verde; el flujo es `POST` real → leer `thumbnailUrl` del `GET` de detalle → pedir esa URL **tal cual**, sin cabecera de autenticación.

- [ ] **CA-5** — Toda firma inválida da **403 idéntico** (`{data:null,error:"Forbidden",status:403}`, mismo body byte a byte) y **no consulta la BD**: expirada (reloj avanzado ≥ 900 s), `sig` alterada,
      `exp` alterado conservando `sig`, `sig` de otro `uploadId`, sin `exp`, sin `sig`, `uploadId` no UUID (`abc`, `../etc/passwd`). Un espía sobre `repo.findById` (o `db.prepare`) afirma **0 llamadas** en esos casos.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=thumbnail --no-coverage --verbose 2>&1 | grep -E "(403|Forbidden|expir|alterad|tamper|findById|0 llamadas|no consulta)"
  ```

  Esperado: tests en verde, incluido el espía.

- [ ] **CA-6** — Firma válida pero recurso ausente: upload inexistente → **404**; fila existente con blob borrado de `BLOB_DIR` → **404**; fila con `stored_filename` malicioso (`../secret`, ruta absoluta)
      inyectada por un repo falso → **500** `Failed to read file` y **no se lee fuera de `BLOB_DIR`** (el test crea un archivo señuelo fuera de `BLOB_DIR` y afirma que su contenido **no** aparece en el body).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(thumbnail|blob-store)" --no-coverage --verbose 2>&1 | grep -E "(404|500|Failed to read file|traversal|fuera de|señuelo|\.\./|readBlob)"
  ```

  Esperado: tests en verde, incluidos los de `readBlob` (nombre simple OK; `..`, separadores y absolutas rechazadas).

- [ ] **CA-7** — La clave es obligatoria y el resto de rutas siguen protegidas: `createApp` **lanza** sin clave y con clave de 31 caracteres; `POST /api/uploads` y `GET /api/uploads/:id` sin JWT → **401**
      `{data:null,error:"unauthenticated",status:401}`; `/health` sigue público; la ruta de miniatura es la **única** pública bajo `/api/uploads`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(uploads-http|thumbnail|server|health)" --no-coverage --verbose 2>&1 | grep -E "(signingKey|clave|31|lanza|throws|401|unauthenticated|health)"
  ```

  Esperado: tests en verde.

- [ ] **CA-8** — Los logs no filtran la firma ni la clave: durante los tests de emisión y de servido de miniatura, un espía sobre `console.log/warn/error` afirma que ninguna llamada contiene `sig=`,
      el valor de la clave de prueba ni la URL completa.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(uploads-http|thumbnail)" --no-coverage --verbose 2>&1 | grep -E "(log|console|filtra|leak|no expone)"
  ```

  Esperado: test(s) en verde.

- [ ] **CA-9** — Regresiones: 401/422/413/500 de `POST`, fallbacks de u3, 403/404 del detalle de u4-T01, persistencia; backend compila y sus tests pasan.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -15
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: suite de ingestion completa en verde (sin tests saltados ni debilitados), `tsc` exit 0, backend sin fallos.

- [ ] **CA-10** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches (incluye `thumbnail-url.ts`, `thumbnail.ts` y `blob-store.ts`).

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-11** — Lint y Prettier pasan (sin caché de turbo).

  ```bash
  npx turbo run lint --force 2>&1 | tail -8
  npx prettier --check apps/ingestion-service/src packages/shared-types/src k8s/ingestion tareas/u4-T02-thumbnail-signed-url.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores; Prettier sin archivos pendientes.

- [ ] **CA-12** — **Sin dependencias nuevas** (el Dockerfile compila addons nativos; no se toca su flujo).

  ```bash
  git diff main...HEAD --name-only | grep -E "(^|/)package(-lock)?\.json$" && echo "FAIL: dependencias tocadas" && exit 1 || echo "no dependency changes"
  ```

  Esperado: imprime `no dependency changes`.

- [ ] **CA-13** — Manifiesto: tag `u4-T02` (sin `latest` ni `u4-T01`); `THUMBNAIL_SIGNING_KEY` solo vía `secretKeyRef` (`thumbnail-signing-key` / `signing-key`, **sin** `optional`); la clave no aparece en el ConfigMap ni
      en ningún archivo del repo; `strategy: Recreate`, `subPath` y `anthropic-key` intactos.

  ```bash
  grep -E "image: ingestion-service:u4-T02" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:(u4-T01|latest)" k8s/ingestion/deployment.yaml && echo "old tag absent"
  grep -n -A6 "name: THUMBNAIL_SIGNING_KEY" k8s/ingestion/deployment.yaml
  node -e 'const t=require("fs").readFileSync("k8s/ingestion/deployment.yaml","utf8");const i=t.indexOf("name: THUMBNAIL_SIGNING_KEY");const blk=t.slice(i,i+300).split("\n- name:")[0];if(!/secretKeyRef/.test(blk)||!/name: thumbnail-signing-key/.test(blk)||!/key: signing-key/.test(blk))throw new Error("secretKeyRef mal");if(/optional/.test(blk))throw new Error("optional presente");console.log("secretKeyRef ok, no optional")'
  ! grep -rn "THUMBNAIL_SIGNING_KEY" k8s/ingestion/configmap.yaml && echo "key not in configmap"
  grep -E "type: Recreate" k8s/ingestion/deployment.yaml
  grep -cE "subPath: (blobs|db)" k8s/ingestion/deployment.yaml
  grep -E "name: anthropic-key" k8s/ingestion/deployment.yaml
  ```

  Esperado: nuevo tag, `old tag absent`, `secretKeyRef ok, no optional`, `key not in configmap`, `Recreate`, conteo `2`, `anthropic-key` presente.

- [ ] **CA-14** — Imagen `ingestion-service:u4-T02` construida; sin tag `latest`.

  ```bash
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u4-T02 . 2>&1 | tail -15
  docker image inspect ingestion-service:u4-T02 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `no latest tag`.

- [ ] **CA-15** — **En kind, de punta a punta.** Precondición: el humano ya creó el Secret `thumbnail-signing-key`. Se comprueba **su existencia sin leer su valor**, se despliega, y se verifica con `curl` real: la URL sirve la
      imagen **idéntica** al archivo subido **sin JWT**; una firma alterada y un `exp` alterado dan 403; otro usuario no obtiene URL; y la URL emitida **antes** de un reinicio sigue valiendo **después** (la clave viene del Secret, no
      se regenera). Lectura de vuelta con `kubectl`, no solo códigos de salida.

  ```bash
  kubectl get secret thumbnail-signing-key -o jsonpath='{.data.signing-key}' | wc -c        # > 0, NO imprimir el valor
  kind load docker-image ingestion-service:u4-T02
  kubectl apply -f k8s/ingestion/deployment.yaml
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get deployment ingestion-service -o jsonpath='{range .spec.template.spec.containers[0].env[?(@.name=="THUMBNAIL_SIGNING_KEY")]}{.valueFrom.secretKeyRef.name}/{.valueFrom.secretKeyRef.key}{"\n"}{end}'
  kubectl get configmap ingestion-service-config -o yaml | grep -c THUMBNAIL_SIGNING_KEY     # 0
  # port-forward en segundo plano: ingestion 3200 e identity 3100. Registrar DOS usuarios con emails únicos (register; no asumir test@example.com).
  # POST con un JPEG como usuario A -> UPLOAD_ID. Luego:
  curl -sf http://localhost:3200/api/uploads/$UPLOAD_ID -H "Authorization: Bearer $JWT_A" | tee /tmp/u4t02-detail.json
  THUMB=$(node -e 'console.log(require("/tmp/u4t02-detail.json").data.thumbnailUrl)')
  curl -s -o /tmp/u4t02-img.bin -w "%{http_code} %{content_type}\n" "http://localhost:3200$THUMB"        # 200 image/jpeg, SIN Authorization
  shasum -a 256 /tmp/u4t02-img.bin <ARCHIVO_SUBIDO>                                                      # los dos hashes iguales
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3200${THUMB%?}0"                            # sig alterada -> 403
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3200${THUMB/exp=/exp=1}"                    # exp alterado -> 403
  curl -s -w " %{http_code}\n" http://localhost:3200/api/uploads/$UPLOAD_ID -H "Authorization: Bearer $JWT_B"   # 403 sin thumbnailUrl
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3200/api/uploads                     # 401 (sigue protegido)
  kubectl rollout restart deployment/ingestion-service && kubectl rollout status deployment/ingestion-service --timeout=180s
  # re-abrir el port-forward (el pod cambió) y repetir con la MISMA $THUMB (sigue dentro de los 15 min):
  curl -s -o /tmp/u4t02-img2.bin -w "%{http_code}\n" "http://localhost:3200$THUMB"                       # 200: la clave sobrevivió al reinicio
  shasum -a 256 /tmp/u4t02-img2.bin
  kubectl logs deploy/ingestion-service | grep -c "sig="                                                 # 0: los logs no filtran la firma
  ```

  Esperado: Secret con longitud > 0 (valor no mostrado); imagen `ingestion-service:u4-T02 Recreate`; `secretKeyRef` `thumbnail-signing-key/signing-key`; `0` ocurrencias en el ConfigMap; `200 image/jpeg` sin JWT; hashes iguales
  (también tras el reinicio); `403` para firma alterada, `403` para `exp` alterado, `403` para el usuario B sin `thumbnailUrl` en su body, `401` en el `POST` sin token; `0` líneas con `sig=` en los logs. Cerrar los
  port-forward al terminar. El **solo** `kubectl apply` permitido es el del deployment `ingestion-service`; no `configmap`, no otros servicios.

- [ ] **CA-16** — Sin secretos en el diff ni en el tree (el valor de la clave de producción nunca existió en el repo; la constante de prueba es evidente).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  git diff main...HEAD -- apps k8s packages | grep -E "^\+" | grep -nE "THUMBNAIL_SIGNING_KEY\s*[:=]\s*['\"]?[A-Za-z0-9+/=_-]{16,}" || echo "no signing key literal"
  ```

  Esperado: imprime `no secrets in diff or tree` y `no signing key literal`.

- [ ] **CA-17** — Scope respetado (`main...HEAD`, tres puntos).

  ```bash
  git diff main...HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|apps/trust-service/|packages/auth-middleware/)" && echo "FAIL: scope creep" && exit 1
  git diff main...HEAD --name-only | grep -E "^packages/" | grep -v "^packages/shared-types/src/uploads.ts$" && echo "FAIL: packages fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^k8s/" | grep -vE "^k8s/ingestion/deployment\.yaml$" && echo "FAIL: k8s fuera de alcance" && exit 1
  git diff main...HEAD --name-only | grep -E "^apps/ingestion-service/(Dockerfile|src/index\.ts|src/service/(database|upload-repository|magic-number|claude-client|critique-outcome|anthropic-error)\.ts)$" && echo "FAIL: archivo protegido tocado" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (Permitidos: `shared-types/src/uploads.ts`, `src/service/{thumbnail-url,blob-store}.ts`, `src/handlers/{uploads,thumbnail}.ts`, `src/server.ts`, tests de `src/__tests__/`,
  `deployment.yaml` y `bitacoras/u4-T02.md`.)

- [ ] **CA-18** — Rama `tarea/u4-T02` sobre `main` con ≥ 2 commits legibles.
  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```
  Esperado: rama `tarea/u4-T02`, al menos 2 commits.

---

## Plan de pruebas

**Rojo primero (de ejecución, no de compilación — Lección 13):** antes de implementar, crea los **archivos y exports mínimos vacíos** (`thumbnail-url.ts` con funciones que devuelven un valor trivial incorrecto, `thumbnail.ts` que responde 501)
para que todo compile, y escribe: (a) «`verify` rechaza una firma alterada», (b) «el detalle del dueño trae `thumbnailUrl`», (c) «la URL se sirve sin JWT y los bytes coinciden», (d) «firma expirada → 403 sin consultar la BD».
Córrelos: deben **fallar por la aserción**, no por un error de import. Registra la salida roja en la bitácora y luego pásalos a verde.

- `thumbnail-url.test.ts` (nuevo): CA-2, con `nowMs` fijo; tabla de entradas inválidas; frontera de expiración; ninguna entrada lanza.
- `blob-store.test.ts` (ampliar): `readBlob` leyendo lo que escribió `writeBlob`; rechazo de `..`, separadores, ruta absoluta; `ENOENT` propagado como error distinguible; directorio temporal limpiado en `afterEach`.
- `thumbnail-http.test.ts` (nuevo) y `uploads-http.test.ts` (ampliar): CA-3 a CA-8. **Sondas propias, no solo el body (Lección 12):** espía sobre `repo.findById`/`db.prepare` para probar que una firma inválida no toca la BD;
  espía sobre `console` para los logs; dos y tres usuarios con `makeJwt`; reloj inyectado con `deps.now` (no `jest.useFakeTimers` salvo que sea imprescindible).
- Mantén verdes todos los tests de u4-T01, u3-T01 y anteriores **sin debilitarlos**; los que llaman `createApp()` solo ganan la inyección de `signingKey`.

---

## Notas

- **Antes de despachar (humano):** crear el Secret **sin que su valor pase por el chat ni por el repo**, por ejemplo:
  `kubectl create secret generic thumbnail-signing-key --from-literal=signing-key="$(openssl rand -hex 32)"` (64 caracteres hex). El codificador **no** lo crea, **no** lo lee y **no** imprime su valor en la bitácora, un test ni un log.
- **Clave de prueba:** en los tests usa una constante evidentemente falsa de ≥ 32 caracteres (p. ej. `'test-only-signing-key-0123456789abcdef'`). No cites literales con forma de clave real (`sk-ant-…`) en bitácoras, tests ni comentarios (C-29);
  descríbelos en palabras.
- **Por qué 403 y no 404 en firma inválida:** la firma se valida **antes** de tocar la BD para que quien no tenga una URL emitida no pueda enumerar uploads ni distinguir «no existe» de «firma mala». Un 404 solo es alcanzable con una firma válida (blob o fila
  desaparecidos).
- **Qué ata la firma:** `uploadId` + `exp` + el prefijo `thumbnail:` (separación de dominio). No ata al usuario: la autorización se decide al **emitir** la URL, y quien la tenga puede verla hasta que expire. Es el modelo habitual de URL firmada y lo pide el contrato.
- **Nombre `thumbnailUrl`:** se conserva el del contrato C1 aunque hoy apunte al blob original. Queda como candidata «redimensionar de verdad» (requiere verificar `sharp` en el flujo `node:20-slim` + `python3 make g++` del `Dockerfile`).
- **Despliegue:** el `Recreate` de u4-T01 hace que el pod nuevo reemplace al viejo sin dos pods sobre la misma BD. Si `kubectl rollout status` se atasca por `CreateContainerConfigError`, casi seguro falta el Secret: repórtalo en la bitácora con `kubectl describe pod`
  y **para**; no lo crees tú.
- Archivos que se **modifican en su sitio**: `shared-types/src/uploads.ts`, `blob-store.ts`, `handlers/uploads.ts`, `server.ts`, `deployment.yaml`, los tests existentes. Los **nuevos**: `thumbnail-url.ts`, `handlers/thumbnail.ts` y sus tests. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. `kubectl apply` solo sobre `deployment.yaml` y `rollout restart` solo sobre `ingestion-service`, solo en CA-15. No toques identity, trust ni backend.
- **Bitácora:** `bitacoras/u4-T02.md` con entradas por ronda: hash de la tarea, salida roja inicial, decisiones de estructura (cómo pasaste clave y reloj), lo verificado en kind (comandos y salidas de CA-15), qué queda para u5/u13 y respuestas a hallazgos del
  revisor por identificador. **Registra cada `docker build`, `kind load` y `rollout` con su salida.** Para u13 (borrado): al borrar un upload hay que borrar también el blob; una URL emitida seguirá firmada pero devolverá 404.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u4-T02`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u4-T02`. Imagen Docker: `ingestion-service:u4-T02`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 5** (única tarea despachable: u4-T02; u5 espera a que u4 esté completa — decisión del humano)._
