# u5-T03 — `uploads.timestamp` con milisegundos: migración idempotente y orden consistente, en `apps/ingestion-service/`

> **Cierra C-41.** `uploads.timestamp` es `CURRENT_TIMESTAMP` (segundos, formato `YYYY-MM-DD HH:MM:SS`). El listado de u5-T01 se salva con el desempate `rowid DESC`, pero u6 (regresión temporal) verá empates.
> Esta tarea guarda milisegundos y deja **todas** las filas, viejas y nuevas, en un único formato ordenable como texto.
>
> **Decisiones del humano (ya tomadas, no se reabren):**
>
> - **C-41 se resuelve ahora**, antes de u6 (el humano aprobó hacerlo antes de u6).
> - El `kubectl apply` / `rollout restart` de esta tarea entra en el CA de despliegue **solo si el humano lo autoriza para esta tarea**.
>
> **Trampa de diseño que esta tarea debe resolver (verificada leyendo `database.ts`, lección 8):** SQLite **no puede cambiar el `DEFAULT`** de una columna existente, y la BD del PVC ya tiene filas en formato viejo.
> Si solo se escribieran milisegundos en las filas nuevas, el formato viejo (`2026-11-18 02:33:19`, con **espacio**) y el nuevo (`2026-11-18T02:33:19.123Z`, con **`T`**) quedarían mezclados, y como el espacio (0x20) es menor que `T`, **toda fila vieja de un día ordenaría antes que cualquier fila nueva del mismo día aunque fuera posterior**. Por eso hay migración **y** escritura explícita.

**Unidad:** u5-history-storage (IngestionService — extensión)
**Historias que implementa:** US-5 (historial cronológico) y la base de US-6 (tendencia temporal sin empates).
**Depende de:** u5-T01 (fusionada, `main` @ `2840754` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`apps/ingestion-service/src/service/database.ts`** (modificar, aditivo): tras crear/migrar el schema, ejecutar una **migración idempotente** de las filas con formato viejo, dentro de una transacción:
> `UPDATE uploads SET timestamp = strftime('%Y-%m-%dT%H:%M:%fZ', timestamp) WHERE timestamp NOT LIKE '%T%'`.
> Debe poder correr N veces sin cambiar nada tras la primera, y **no tocar ninguna otra columna ni tabla**. **No** se cambia el `DEFAULT` del `CREATE TABLE` (no se puede en BDs existentes; ver trampa).
>
> **`apps/ingestion-service/src/service/upload-repository.ts`** (modificar):
>
> - `INSERT` de `create` pasa a fijar `timestamp` **explícitamente** con `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (milisegundos, UTC, sufijo `Z`), no a depender del `DEFAULT`.
> - `toIsoUtc` acepta **ambos** formatos (`YYYY-MM-DD HH:MM:SS` y `YYYY-MM-DDTHH:MM:SS.mmmZ`) y devuelve siempre ISO-8601 con `Z` **y milisegundos preservados**. Un valor que no sea ninguno de los dos **no** debe devolver `Invalid Date`/lanzar `RangeError`: se trata como el error que ya trataba el handler (los handlers existentes no cambian).
> - El orden de `listByUser` sigue siendo `timestamp DESC, rowid DESC` (el desempate se mantiene: dos filas pueden compartir milisegundo).
>
> **`k8s/ingestion/deployment.yaml`** (modificar): **solo** `image: ingestion-service:u5-T03`. Ninguna otra línea cambia.
>
> **Tests**: ver Plan de pruebas.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Cambiar el `DEFAULT` del `CREATE TABLE`, recrear la tabla, renombrar o eliminar columnas (el contrato C5 y las columnas de u4 no se tocan).
- Paginación (C-40), endurecer tests de u5-T01 (C-42), `wal_checkpoint` (C-30).
- Cambiar `handlers/uploads.ts`, `thumbnail.ts`, `blob-store.ts`, `thumbnail-url.ts`, `claude-client.ts`, `server.ts`, `index.ts`, `Dockerfile`, `shared-types` (el `z.string().datetime()` ya acepta milisegundos).
- Tocar identity-service, trust-service, backend, `pvc.yaml`, `configmap.yaml`, `service.yaml`.
- Dependencias nuevas.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` y `project.md` — reglas duras (sin secretos, nunca `latest`, cobertura 80%/75%)
- `bitacoras/u5-T01.md`, `revisiones/u5-T01/ronda-1.md` — estado previo, lecciones y la candidata C-41
- `tareas/u5-T01-ingestion-list-endpoint.md` — molde de formato y del CA de despliegue
- `apps/ingestion-service/src/service/database.ts`, `src/service/upload-repository.ts` (`toIsoUtc`, `create`, `listByUser`)
- `apps/ingestion-service/src/__tests__/database.test.ts`, `upload-repository.test.ts`, `uploads-http.test.ts`
- `k8s/ingestion/deployment.yaml` (se modifica)
- `CANDIDATAS.md` — C-30, C-40, C-41

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u5-T03` checada. En un worktree limpio hay que compilar antes los packages:
`npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — La migración convierte las filas viejas, conserva el instante, es idempotente y no toca nada más.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=database --no-coverage --verbose 2>&1 | grep -E "(migra|idempot|formato viejo|milisegundos|T00|no toca|instante)"
  ```

  Esperado: tests en verde. El test crea una BD con **filas en formato viejo** insertadas por SQL directo (`'2026-11-18 02:33:19'`), abre la BD con `createDatabase` y afirma: el valor pasa a `2026-11-18T02:33:19.000Z`; **abrir una segunda vez** no cambia ningún valor; las columnas `status`, `confidence`, `stored_filename`, `user_id` y las filas de `category_critiques` quedan idénticas; una fila ya en formato nuevo (con `.123Z`) **no** se modifica. **Criterio de mutación:** si se borra el `WHERE timestamp NOT LIKE '%T%'`, el test de «ya en formato nuevo» y el de idempotencia deben **fallar**; si se borra la migración entera, el de conversión debe fallar.

- [ ] **CA-2** — `create` escribe milisegundos explícitos y `toIsoUtc` entiende ambos formatos sin `Invalid Date`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=upload-repository --no-coverage --verbose 2>&1 | grep -E "(milisegundo|toIsoUtc|ambos formatos|\.\d{3}Z|Invalid Date|explícit)"
  ```

  Esperado: tests en verde: (a) el `timestamp` crudo guardado por `create` cumple `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`; (b) `getDetailHeader`/`listByUser` devuelven ISO con `Z` y **milisegundos** para una fila nueva; (c) una fila en formato viejo insertada por SQL directo (sin migrar) también produce ISO válido con `.000Z`; (d) un valor basura no devuelve `Invalid Date` (comportamiento definido y probado). **Criterio de mutación:** si `create` vuelve a depender del `DEFAULT`, el test (a) debe **fallar**.

- [ ] **CA-3** — **El orden ya no depende del azar ni del formato**: con filas viejas y nuevas **mezcladas el mismo día**, `listByUser` devuelve el orden cronológico correcto.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=upload-repository --no-coverage --verbose 2>&1 | grep -E "(mezcl|mismo día|orden|desempate|rowid)"
  ```

  Esperado: tests en verde. Caso clave: una fila **vieja a las 23:00:00** y una **nueva a las 10:00:00.500** del mismo día, y una **nueva a las 23:00:00.250**; tras `createDatabase` (que migra) el orden es 23:00:00.250 > 23:00:00.000 > 10:00:00.500. Además, dos filas con el **mismo** milisegundo conservan el desempate por `rowid DESC`.
  **Criterio de mutación:** si se **omite la migración** (se deja el formato viejo), el caso mezclado debe **fallar** (demuestra que la trampa es real); si se quita `rowid DESC`, el de mismo milisegundo debe fallar.

- [ ] **CA-4** — Dos uploads consecutivos reciben timestamps **distintos y crecientes** a nivel de milisegundo, y el endpoint de detalle y el de listado lo reflejan y siguen pasando sus schemas.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern="(uploads-http|upload-repository)" --no-coverage --verbose 2>&1 | grep -E "(creciente|consecutiv|UploadDetailSchema|UploadListSchema|milisegundo)"
  ```

  Esperado: tests en verde. El test usa un reloj controlado cuando sea posible; si no, afirma `t2 >= t1` y que el orden del listado coincide con el orden de inserción. El body de detalle y de listado pasa `UploadDetailSchema.safeParse`/`UploadListSchema.safeParse` con timestamps con milisegundos.

- [ ] **CA-5** — Regresiones: toda la suite de ingestion y backend en verde, sin tests saltados ni debilitados; las aserciones de u4/u5 que comparaban timestamps siguen en pie (se ajustan **solo** para aceptar milisegundos, sin debilitarlas).

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -15
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: ingestion completa en verde, `tsc` exit 0, backend sin fallos.

- [ ] **CA-6** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches.

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-7** — Lint y Prettier pasan (sin caché de turbo).

  ```bash
  npx turbo run lint --force 2>&1 | tail -8
  npx prettier --check apps/ingestion-service/src k8s/ingestion tareas/u5-T03-timestamp-millis.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores; Prettier sin archivos pendientes.

- [ ] **CA-8** — Sin dependencias nuevas, sin cambio de contrato y sin tocar archivos protegidos.

  ```bash
  git diff main...HEAD --name-only | grep -E "(^|/)package(-lock)?\.json$" && echo "FAIL: dependencias tocadas" && exit 1 || echo "no dependency changes"
  git diff main...HEAD --name-only | grep -E "^packages/" && echo "FAIL: packages tocados" && exit 1 || echo "packages intactos"
  git diff main...HEAD -- apps/ingestion-service/src/service/database.ts | grep -E "^[+-].*(CREATE TABLE|DEFAULT CURRENT_TIMESTAMP|DROP |RENAME)" && echo "FAIL: schema alterado" && exit 1 || echo "schema sin alterar"
  ```

  Esperado: imprime `no dependency changes`, `packages intactos` y `schema sin alterar`.

- [ ] **CA-9** — Manifiesto: **solo cambia el tag** de la imagen (`u5-T03`); sin `latest`; `Recreate`, `subPath` y ambos Secrets intactos.

  ```bash
  grep -E "image: ingestion-service:u5-T03" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:(u5-T01|latest)" k8s/ingestion/deployment.yaml && echo "old tag absent"
  git diff main...HEAD -- k8s/ingestion/deployment.yaml | grep -E "^[+-][^+-]" | wc -l
  grep -E "type: Recreate" k8s/ingestion/deployment.yaml
  grep -cE "subPath: (blobs|db)" k8s/ingestion/deployment.yaml
  grep -E "name: (anthropic-key|thumbnail-signing-key)" k8s/ingestion/deployment.yaml
  ```

  Esperado: nuevo tag, `old tag absent`, **`2`** líneas cambiadas, `Recreate`, conteo `2`, ambos Secrets presentes.

- [ ] **CA-10** — Imagen `ingestion-service:u5-T03` construida **desde el `main` actual** (incluye `maxRetries: 0` de u3-T02); sin `latest`.

  ```bash
  git log --oneline main -1
  git merge-base --is-ancestor 2fc5fe1 HEAD && echo "u3-T02 incluida"
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u5-T03 . 2>&1 | tail -15
  docker image inspect ingestion-service:u5-T03 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: imprime `u3-T02 incluida`, build exit 0, imagen inspeccionable, `no latest tag`. Si el worktree no contiene `2fc5fe1`, el codificador hace `git rebase main` antes de construir.

- [ ] **CA-11** — **En kind, con datos reales preexistentes** (solo con autorización del humano para esta tarea). El PVC ya tiene filas en formato viejo: se comprueba **antes y después** de desplegar, con lectura de vuelta de la BD del pod en modo solo lectura.
      Usa un directorio propio del scratchpad (`$WORK`) (C-38); no imprimas JWT en la bitácora; emails únicos.

  ```bash
  # ANTES (imagen u5-T01): contar filas viejas y guardar ids+orden del listado de un usuario existente o nuevo
  kubectl exec deploy/ingestion-service -- node -e 'const D=require("better-sqlite3");const db=new D("/app/data/db/ingestion.db",{readonly:true});console.log(db.prepare("SELECT COUNT(*) n FROM uploads WHERE timestamp NOT LIKE \"%T%\"").get(), db.prepare("SELECT COUNT(*) n FROM uploads").get())'
  kind load docker-image ingestion-service:u5-T03
  kubectl apply -f k8s/ingestion/deployment.yaml
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  # DESPUÉS: 0 filas viejas; mismo total; los instantes de las filas viejas terminan en .000Z
  kubectl exec deploy/ingestion-service -- node -e 'const D=require("better-sqlite3");const db=new D("/app/data/db/ingestion.db",{readonly:true});console.log(db.prepare("SELECT COUNT(*) n FROM uploads WHERE timestamp NOT LIKE \"%T%\"").get(), db.prepare("SELECT COUNT(*) n FROM uploads").get(), db.prepare("SELECT timestamp FROM uploads ORDER BY rowid LIMIT 3").all())'
  # port-forward en segundo plano (ingestion 3200, identity 3100); registrar un usuario NUEVO con email único; DOS POST seguidos:
  curl -s -w " %{http_code}\n" http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT"          # 200: 2 items, el último POST primero, timestamps con milisegundos
  kubectl rollout restart deployment/ingestion-service && kubectl rollout status deployment/ingestion-service --timeout=180s
  # re-abrir el port-forward y repetir el listado: idéntico (la migración no se repite ni altera nada)
  kubectl logs deploy/ingestion-service | grep -ci "bearer"                                              # 0
  ```

  Esperado: el conteo de filas **viejas** antes es `n>0` (si fuera 0, el codificador lo registra y **crea** una fila vieja con SQL desde una prueba local, no en el cluster); después `0`, mismo total de filas; las filas viejas ahora acaban en `.000Z`; imagen `ingestion-service:u5-T03 Recreate`; el listado del usuario nuevo trae los 2 uploads en orden inverso de inserción con timestamps `…T..:..:..\.\d{3}Z`; idéntico tras el `rollout restart`; `0` líneas con `bearer`. Cerrar los port-forward al terminar (el PID 4456 es del humano). El **solo** `kubectl apply` permitido es el del deployment `ingestion-service`. **No escribas en la BD del pod**: solo lecturas con `readonly:true`.

- [ ] **CA-12** — Sin secretos en el diff ni en el árbol.

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-13** — Scope respetado (`main...HEAD`, tres puntos).

  ```bash
  git diff main...HEAD --name-only | grep -vE "^(apps/ingestion-service/src/service/(database|upload-repository)\.ts|apps/ingestion-service/src/__tests__/.*\.test\.ts|k8s/ingestion/deployment\.yaml|bitacoras/u5-T03\.md)$" && echo "FAIL: archivo fuera de alcance" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (`tareas/u5-T03-timestamp-millis.md` ya está en `main`.)

- [ ] **CA-14** — Rama `tarea/u5-T03` sobre `main` con ≥ 2 commits legibles, sin `git commit -a`.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  git show --stat --format=%s HEAD | head -10
  ```

  Esperado: rama `tarea/u5-T03`, al menos 2 commits, cada uno solo con los archivos de su mensaje.

---

## Plan de pruebas

**Rojo primero (de ejecución, no de compilación — Lección 13):** escribe **primero** (a) «la migración convierte `2026-11-18 02:33:19` en `2026-11-18T02:33:19.000Z`», (b) «el caso mezclado del mismo día ordena mal sin migración» y (c) «`create` guarda milisegundos». Córrelos **antes** de tocar el código: deben fallar por la aserción (valor recibido distinto del esperado), no por error de import o tipos. Registra la salida roja en la bitácora y luego pásalos a verde.

- `database.test.ts` (ampliar): CA-1 con BD en archivo temporal (`os.tmpdir()`), limpiada en `afterEach`; abrir dos veces.
- `upload-repository.test.ts` (ampliar): CA-2 a CA-4; filas viejas por SQL directo; casos mezclados; valor basura.
- `uploads-http.test.ts` (ampliar solo lo necesario): schemas con milisegundos.
- **Casos inválidos con entradas realmente válidas salvo en la propiedad probada (Lección 16):** el caso mezclado debe contener filas viejas **y** nuevas realmente presentes; si no, pasa aunque falte la migración.
- Mantén verdes todos los tests de u4 y u5 **sin debilitarlos**.

---

## Notas

- **Por qué migrar y además escribir explícito:** la migración arregla lo existente; la escritura explícita arregla lo futuro sin depender de un `DEFAULT` que SQLite no puede cambiar en una BD ya creada.
- **Por qué `T` y `Z` en el almacenamiento:** que el texto ordene igual que el tiempo. Mientras todas las filas tengan el mismo formato, `ORDER BY timestamp` es cronológico.
- **Riesgo operativo:** la migración se ejecuta al arrancar el pod sobre datos reales del PVC. Es un `UPDATE` de una columna; el CA-11 lee antes y después para demostrarlo.
- **Esta imagen también lleva `maxRetries: 0` (u3-T02)**, porque se construye desde `main`. No es parte del diff de esta tarea.
- Archivos que se **modifican en su sitio**: `database.ts`, `upload-repository.ts`, `deployment.yaml`, los tests existentes. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. `kubectl apply` solo sobre `deployment.yaml` y `rollout restart` solo sobre `ingestion-service`, solo en CA-11 y solo con autorización. No toques identity, trust ni backend.
- **Bitácora:** `bitacoras/u5-T03.md` con: hash de la tarea, salida roja inicial, decisiones (migración, `toIsoUtc`), lo verificado en kind (comandos y salidas de CA-11, antes y después), y respuestas a hallazgos del revisor por identificador. **Registra cada `docker build`, `kind load` y `rollout` con su salida.** Usa `git add <rutas>` explícitas.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u5-T03`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u5-T03`. Imagen Docker: `ingestion-service:u5-T03`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 7** (en paralelo con u5-T02: ficheros disjuntos; u6 espera a ambas)._
