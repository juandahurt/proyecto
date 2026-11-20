# u13-T01 — Borrado permanente del historial (backend, cascada best-effort)

**Unidad:** u13 — borrado de historial, tarea 1 (backend; la UI de confirmación en Settings queda para una tarea de frontend futura, fuera de esta).
**Historias que implementa:** US-13 (AC-13.1 parcialmente — la confirmación de texto "DELETE" la valida el servidor; el diálogo de dos pasos es UI, fuera de esta tarea), AC-13.2, AC-13.3.
**Depende de:** u8 (identity/JWT), u9-T01 (contador), u11 (onboarding/trust), u12 (política), u5 (listado/detalle de ingestion). Todas fusionadas y desplegadas. **No depende de u9-T02** (C-76, contador conectado): esta tarea resetea el contador exista o no el bloqueo en 0.

**Decisiones del humano:**

- Tarea elegida al abrir la ola 14 (2026-11-20), tras cerrar u0-T04.
- Alcance **solo backend** (igual que decidió el humano para u9-T02 en su momento): la pantalla de Settings con el diálogo de dos pasos ("type DELETE to confirm") queda para una tarea de frontend futura. Esta tarea construye el endpoint público real y la cascada; se prueba por HTTP directo, no desde el navegador.

**Decisiones de diseño del orquestador** (el humano puede objetarlas; el contrato público ya estaba fijado desde `contract-design`, ola de Inception — no es nuevo):

1. **El contrato público ya existe en `contract-design/contract-summary.md` (líneas 459-486) y no se renegocia:** `DELETE /api/history` en **trust-service**, protegido por `requireAuth`, body `{ "confirmation": "DELETE" }` (literal exacto, sin variantes de mayúsculas ni espacios). `400` si el campo falta o no es exactamente `"DELETE"`. `204` si la cascada completó (total o parcialmente). `500` solo si **todos** los pasos de la cascada fallaron.
2. **Orden de la cascada**, según el propio contrato (C7 "as part of the deletion cascade", C8 "after all data is deleted"): (a) `DELETE {ingestionUrl}/api/internal/users/{userId}/data` (C7), (b) `POST {identityUrl}/api/internal/users/{userId}/reset-counter` (C8). **Best-effort real:** el paso (b) se intenta aunque (a) haya fallado; el fallo de uno no cancela al otro. `500` solo si **ambos** pasos fallan (error de red, timeout, o cualquier status que no sea el `204` esperado de cada uno).
3. **C9 (ProgressService) se omite en esta tarea.** `progress-service` no persiste ningún `TrendSnapshot` (C-55: calcula todo al vuelo desde `GET /api/uploads` de ingestion, sin tabla propia); no hay nada que borrar ahí. Construir el endpoint `DELETE /api/internal/users/{userId}/data` de progress sería código muerto hoy. Se deja como candidata (**C-83**, registrada en `CANDIDATAS.md`) para el día en que progress persista algo.
4. **`apps/ingestion-service`: `DELETE /api/internal/users/:userId/data`.** Network-trusted (sin JWT, igual que `increment-counter`), en una transacción SQLite borra todas las filas de `category_critiques` y `uploads` de ese `userId`; después, **best-effort y fuera de la transacción**, borra cada blob (`storedFilename`) con `fs.promises.unlink`, ignorando `ENOENT` y registrando (sin datos del usuario) cualquier otro error de borrado de archivo sin abortar el resto. Responde `204` si la transacción de BD tuvo éxito (los blobs son limpieza, no afectan el veredicto); `500` solo si la transacción de BD falla. Usuario sin uploads → `204` igual (operación idempotente).
5. **`apps/identity-service`: `POST /api/internal/users/:userId/reset-counter`.** Network-trusted. Pone a `0` el contador del **mes actual** (`currentYearMonth()`, la única fila que importa para `GET /api/users/me/limits`); no toca meses anteriores (no hay necesidad: `getForMonth` solo lee el mes en curso). `204` si el usuario existe en `users` (reutiliza la comprobación que ya hace el repositorio de autenticación; si no, `404`, aunque hoy nadie más que trust-service llama a este endpoint y siempre con un `userId` real). Usuario sin contador en el mes (nunca subió) → `204` igual (operación idempotente: `INSERT ... ON CONFLICT DO UPDATE SET count = 0`, o equivalente).
6. **`apps/trust-service` orquesta, no persiste nada propio.** No hay tabla de "historial borrado"; es una operación sin estado, sin cola de reintentos (MVP). Los clientes HTTP hacia ingestion e identity siguen el mismo patrón que `progress-service/src/service/{identity,ingestion}-client.ts` (resultado discriminado `{ok, kind}`, `AbortSignal.timeout`, `redirect: 'error'`, sin reenviar `Authorization` — son endpoints internos sin JWT). Timeouts configurables por `ConfigMap` (`INGESTION_TIMEOUT_MS`, `IDENTITY_TIMEOUT_MS`, default `5000`).
7. **`shared-types`:** `DeleteHistoryRequestSchema` (`{ confirmation: z.literal('DELETE') }`) en un archivo nuevo `packages/shared-types/src/history.ts`, exportado desde `index.ts`. No hace falta un schema de respuesta: `204` no tiene cuerpo.
8. **Logs sin datos del usuario:** ningún log de los tres servicios imprime `userId`, nombres de archivo del usuario, ni contenido de la crítica; como mucho un conteo (p. ej. "deleted N uploads for a user").

---

## Alcance

**Dentro** (una línea, concreta):

> `packages/shared-types` (`DeleteHistoryRequestSchema`); `ingestion-service` (`DELETE /api/internal/users/:userId/data`, borrado transaccional de BD + blobs best-effort); `identity-service` (`POST /api/internal/users/:userId/reset-counter`, resetea el mes en curso); `trust-service` (`DELETE /api/history`, validación de confirmación, orquestación best-effort de los dos pasos); despliegue de las tres imágenes nuevas en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Cualquier pantalla de frontend.** `Settings.tsx` sigue siendo el cascarón "coming soon"; el diálogo de confirmación de dos pasos con el texto "DELETE" es una tarea de frontend futura. Esta tarea se prueba solo por HTTP.
- `progress-service` (C9 omitido, decisión 3 arriba).
- El contador de subidas conectado (C-76, u9-T02): sigue sin bloquear en 0; esta tarea solo **resetea** el contador a 0 para el mes en curso, exista o no el bloqueo.
- Cualquier cola de reintentos, job asíncrono o tabla de auditoría de borrados: la cascada es síncrona, de una sola pasada, sin estado persistido en trust-service.
- Borrar la cuenta del usuario (`users`, `onboarding_ack`, sesiones): AC-13.3 exige que la cuenta siga activa.
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, el `ConfigMap` de nginx, el `Dockerfile` de ningún servicio ni la CSP.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` (líneas 459-486: `DELETE /api/history`; líneas 577-669: C7, C8, C9)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-13, líneas 327-355)
- `apps/progress-service/src/service/{identity-client,ingestion-client}.ts` (patrón de cliente HTTP interno a replicar en trust-service: resultado discriminado, `AbortSignal.timeout`, `redirect: 'error'`) y `src/handlers/trends.ts` (patrón de handler que orquesta dos llamadas)
- `apps/identity-service/src/handlers/increment-counter.ts` y `src/service/upload-counter-repository.ts` (patrón de endpoint interno sin JWT y del repositorio del contador; `clock.ts` para `currentYearMonth()`), `src/server.ts` (dónde se registra `/api/internal`)
- `apps/ingestion-service/src/service/upload-repository.ts` (schema de `uploads`/`category_critiques`, **sin** `ON DELETE CASCADE`: hay que borrar ambas tablas explícitamente, en ese orden, dentro de una transacción) y `src/service/blob-store.ts` (`BLOB_DIR`, nombres de archivo seguros), `src/server.ts`
- `apps/trust-service/src/server.ts`, `src/handlers/{onboarding,policy}.ts` (patrón de router con `requireAuth`), `src/service/database.ts` (trust no tiene tabla propia que tocar aquí)
- `packages/shared-types/src/{limits,uploads}.ts` (patrón de schema con envoltorio uniforme) e `index.ts` (dónde exportar el nuevo módulo)
- `k8s/{trust,ingestion,identity}/{deployment,configmap}.yaml`
- `tareas/u0-T03-frontend-history.md` (molde más reciente de CA con despliegue multi-servicio) y los hallazgos **C-55**, **C-36**, **C-60** de `CANDIDATAS.md`
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, sin `latest`, sin secretos)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `npm run build -w packages/auth-middleware`. Los `Esperado` de conteos de tests se comparan contra `main`.

- [ ] **CA-1** — **`DeleteHistoryRequestSchema` en shared-types.**

  ```bash
  grep -n -A4 "export const DeleteHistoryRequestSchema" packages/shared-types/src/history.ts
  grep -n "history" packages/shared-types/src/index.ts
  npm run build -w packages/shared-types 2>&1 | tail -5
  ```

  Esperado: el schema exige `confirmation: z.literal('DELETE')`; se exporta desde `index.ts`; build sin errores.

- [ ] **CA-2** — **Ingestion: `DELETE /api/internal/users/:userId/data`, rojo primero.**

  ```bash
  npm test -w apps/ingestion-service -- delete-user --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, por valor: un usuario con 2 uploads (uno `ready` con categorías, otro `low_confidence`) → `204`; tras el borrado, `repo.listByUser(userId)` y `repo.findById(uploadId)` de ambos devuelven vacío/null; las filas de `category_critiques` de esos uploads ya no existen (consulta directa a la tabla en el test); los blobs correspondientes ya no existen en `BLOB_DIR` (se comprueba con `fs.existsSync`). Un usuario sin uploads → `204` (idempotente). Un `userId` que no es UUID → **sigue respondiendo `204`** (network-trusted: no hay nada que borrar, no es un error) — decide y documenta en la bitácora si en cambio prefieres validarlo con 422 igual que `increment-counter`; cualquiera de las dos es aceptable **siempre que quede escrito y probado**.

  **Mutación observable:** omitir el borrado de `category_critiques` (dejar las filas huérfanas) o no intentar borrar el blob **hace fallar** su test.

- [ ] **CA-3** — **Ingestion: un fallo de archivo no aborta el borrado de BD.**

  ```bash
  npm test -w apps/ingestion-service -- delete-user-blob-failure --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: con `readBlob`/`unlink` falso que lanza para uno de los dos archivos del usuario (simulando un blob ya ausente o un error de permisos), la respuesta sigue siendo `204`, las filas de BD de **ambos** uploads quedan borradas, y el segundo blob (el que no falla) sí se borra. El log no imprime el `userId` ni la ruta completa del archivo.

- [ ] **CA-4** — **Identity: `POST /api/internal/users/:userId/reset-counter`, rojo primero.**

  ```bash
  npm test -w apps/identity-service -- reset-counter --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, por valor: un usuario con `count: 7` en el mes en curso → `204`; `counterRepo.getForMonth(userId, currentYearMonth())` devuelve `0` después. Un usuario sin fila de contador (nunca subió) → `204` igual, y tras el reset `getForMonth` sigue dando `0` (no crea un conteo negativo ni lanza). El mes anterior (si existiera una fila con otro `yearMonth`) **no se toca** (se prueba con dos filas, una del mes actual y otra de un mes anterior con `count: 3`; solo la del mes actual cambia).

  **Mutación observable:** resetear incondicionalmente todas las filas del usuario (en vez de solo el mes en curso) **hace fallar** el test de la fila del mes anterior.

- [ ] **CA-5** — **Trust: `DELETE /api/history`, validación de confirmación.**

  ```bash
  npm test -w apps/trust-service -- delete-history --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin `Authorization` → `401`; con token válido y body `{}` o `{"confirmation":"delete"}` (minúsculas) o `{"confirmation":"DELETE "}` (con espacio) → `400`, **sin** llamar a ingestion ni a identity (contador de `fetch` falso = 0); con `{"confirmation":"DELETE"}` exacto → procede a la cascada.

  **Mutación observable:** aceptar `"delete"` (case-insensitive) o aceptar sin body **hace fallar** su test.

- [ ] **CA-6** — **Trust: cascada best-effort, las tres combinaciones.**

  ```bash
  npm test -w apps/trust-service -- delete-history-cascade --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con los dos clientes HTTP falsos (`fetchFn` inyectado):

  - Ambos pasos responden `204`/`204` → trust responde `204`; se llamó a ingestion **antes** que a identity (orden observable con un espía que registra el orden de llamadas).
  - Ingestion falla (red o `500`) pero identity responde `204` → trust **igual llama a identity** (no cancela la cascada) y responde `204` (best-effort: al menos uno tuvo éxito).
  - Identity falla pero ingestion responde `204` → trust responde `204`.
  - **Ambos** fallan → trust responde `500`.
  - Ninguna llamada reenvía `Authorization` del usuario a los endpoints internos (se verifica por valor en los headers del `fetchFn` falso).

  **Mutación observable:** cancelar la llamada a identity cuando ingestion falla, o responder `204` cuando ambos fallan, **hace fallar** su test.

- [ ] **CA-7** — **Logs sin datos del usuario.**

  ```bash
  grep -rn "console\.\(log\|warn\|error\)" apps/trust-service/src/handlers apps/ingestion-service/src/handlers apps/identity-service/src/handlers --include='*.ts' | grep -v __tests__
  ```

  Esperado: ningún `console.*` de los handlers tocados en esta tarea interpola `userId`, `storedFilename` ni contenido del usuario (revisa cada línea que imprime el `grep`; un conteo numérico o un literal fijo está bien).

- [ ] **CA-8** — **Los demás workspaces no cambian y todos los tests pasan.**

  ```bash
  npm test -w apps/trust-service -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/ingestion-service -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/identity-service -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  for w in progress-service backend frontend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/trust-service/src apps/ingestion-service/src apps/identity-service/src || echo "sin skip, only ni todo"
  ```

  Esperado: trust, ingestion e identity sin suites fallidas y **más** tests que `main` (anota el conteo de `main` al redactar: trust 25, ingestion 207, identity 74); progress/backend/frontend con los mismos tests y suites que `main`; `sin skip, only ni todo`.

- [ ] **CA-9** — **Cobertura sobre los pisos, sin rebajarlos.**

  ```bash
  npm test -w apps/trust-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  npm test -w apps/ingestion-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  npm test -w apps/identity-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  ```

  Esperado: ≥80% líneas global y ≥75% ramas en `service/` y `handlers/` de los tres servicios tocados.

- [ ] **CA-10** — **Lint, build del monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  ```

  Esperado: `Tasks: <n> successful, <n> total` sin fallidas; prettier limpio; `audit exit=0`.

- [ ] **CA-11** — **Manifiestos: tags nuevos y ConfigMap de trust ampliado.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  grep -q "image: trust-service:u13-T01" k8s/trust/deployment.yaml || echo "FALLO: tag trust"
  grep -q "image: ingestion-service:u13-T01" k8s/ingestion/deployment.yaml || echo "FALLO: tag ingestion"
  grep -q "image: identity-service:u13-T01" k8s/identity/deployment.yaml || echo "FALLO: tag identity"
  grep -q "INGESTION_URL" k8s/trust/configmap.yaml || echo "FALLO: falta INGESTION_URL en trust"
  grep -q "IDENTITY_URL" k8s/trust/configmap.yaml || echo "FALLO: falta IDENTITY_URL en trust"
  ! grep -rqE "image: .*:latest" k8s/trust k8s/ingestion k8s/identity || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/trust/ -f k8s/ingestion/ -f k8s/identity/
  ```

  Esperado: ningún `FALLO`; el servidor acepta los manifiestos. Los únicos archivos tocados son los `deployment.yaml` de los tres servicios y el `configmap.yaml` de trust.

- [ ] **CA-12** — **Despliegue en kind y lectura de vuelta (codificador, con autorización del humano para trust, ingestion e identity; los tres con ~41s de corte por reinicio, C-60).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  docker build -f apps/trust-service/Dockerfile -t trust-service:u13-T01 .
  kind load docker-image trust-service:u13-T01
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u13-T01 .
  kind load docker-image ingestion-service:u13-T01
  docker build -f apps/identity-service/Dockerfile -t identity-service:u13-T01 .
  kind load docker-image identity-service:u13-T01
  kubectl apply -f k8s/trust/ -f k8s/ingestion/ -f k8s/identity/
  kubectl rollout status deployment/trust-service --timeout=180s
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl rollout status deployment/identity-service --timeout=180s
  kubectl get pods -l app=trust-service -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get pods -l app=ingestion-service -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get pods -l app=identity-service -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: los tres pods con `ready=true restarts=0` y sus imágenes `:u13-T01`; `frontend` y `progress-service` con el mismo nombre y edad en ambos `pods-*.txt` (sin reiniciarse, aunque el corte de los tres servicios tocados puede verse en sus propios timestamps). La bitácora registra cada `docker build`, `kind load`, `apply` y `rollout` con su salida.

- [ ] **CA-13** — **Flujo real de borrado a través del proxy (revisor o humano; con autorización de port-forward de lectura a `svc/frontend` y de registro/subida con usuarios `*.test`).** Si el sistema deniega un permiso, se reporta **no verificable**. **No uses los usuarios demo del humano.** Usa **pocas** subidas (1-2), no 10.

  ```bash
  E="u13-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"
  curl -s -o /dev/null -w "register %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9' > $WORK/ok.jpg
  curl -s -o /dev/null -w "upload %{http_code}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/ok.jpg;type=image/jpeg"
  curl -s -w " %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  curl -s -w " %{http_code}\n" -X DELETE http://localhost:3500/api/history -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"confirmation":"nope"}'
  curl -s -o /dev/null -w "delete %{http_code}\n" -X DELETE http://localhost:3500/api/history -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"confirmation":"DELETE"}'
  curl -s -o /dev/null -w "lista-tras-borrado %{http_code}\n" http://localhost:3500/api/uploads -H "Authorization: Bearer $T"
  curl -s -w " %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  curl -s -o /dev/null -w "login-sigue-activo %{http_code}\n" -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  ```

  Esperado: `register 201`, `upload 202`; `limits` inicial con `uploadsRemaining: 9`; la confirmación inválida da `400`; `delete 204`; `lista-tras-borrado 200` con `items: []` (comprobar el cuerpo, no solo el status); `limits` final con `uploadsRemaining: 10` (AC-13.3); `login-sigue-activo 201` falla por supuesto si reintenta registro — usa login, no register, y espera `200` (la cuenta sigue activa, AC-13.3). Cierra el port-forward y deja constancia del email `*.test` creado. Ningún JWT ni contraseña en el informe ni en la bitácora.

- [ ] **CA-14** — **Sin secretos en el diff, el árbol ni el bundle.**

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: `no secrets in diff`, `no secrets in diff or tree`.

- [ ] **CA-15** — **Alcance exacto y commits atómicos, «rojo primero» commiteado.**

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list --reverse main..HEAD); do git show --name-only --format='%h %s' $c | head -14; done
  ```

  Esperado: solo archivos bajo `packages/shared-types/`, `apps/ingestion-service/`, `apps/identity-service/`, `apps/trust-service/`, `k8s/{trust,ingestion,identity}/` y `bitacoras/u13-T01.md`. ≥5 commits atómicos en este orden: (1) `DeleteHistoryRequestSchema`; (2) ingestion `DELETE /api/internal/users/:userId/data`, rojo primero; (3) identity `POST /api/internal/users/:userId/reset-counter`, rojo primero; (4) trust `DELETE /api/history` con la cascada, rojo primero; (5) k8s y bitácora. Ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`. Sin `git push`, sin PR.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- **Ingestion:** borrado transaccional de BD (ambas tablas) + blobs best-effort, usuario sin uploads, fallo parcial de blob no aborta la BD.
- **Identity:** reset del contador del mes en curso únicamente, usuario sin contador, mes anterior intacto.
- **Trust:** validación de confirmación, orden de la cascada, las cuatro combinaciones de éxito/fallo de los dos pasos, sin reenviar `Authorization` a los internos.

**Rojo primero:** cada uno de los tres endpoints nuevos se prueba contra el código sin implementar (404 del router, o la función que no existe), con la salida roja pegada en la bitácora antes del commit de implementación.

---

## Notas

- Archivos que se **modifican en su sitio**: `packages/shared-types/src/history.ts` (nuevo) e `index.ts`; `apps/ingestion-service/src/handlers/delete-user-data.ts` (nuevo) + `src/service/upload-repository.ts` (método nuevo) + `src/server.ts`; `apps/identity-service/src/handlers/reset-counter.ts` (nuevo) + `src/service/upload-counter-repository.ts` (método nuevo) + `src/server.ts`; `apps/trust-service/src/handlers/history.ts` (nuevo) + `src/service/{ingestion-client,identity-client}.ts` (nuevos) + `src/server.ts`; `k8s/{trust,ingestion,identity}/deployment.yaml`, `k8s/trust/configmap.yaml`. Nada de duplicados con sufijo.
- **Permisos de cluster para esta tarea:** `docker build`, `kind load`, `kubectl apply` y `rollout status` sobre **trust-service, ingestion-service e identity-service únicamente**. Port-forward de lectura a `svc/frontend` para CA-13. Los tres reinicios tienen ~41s de corte cada uno (C-60, `strategy: Recreate`, no atienden SIGTERM); encadénalos, no los hagas en paralelo con otro trabajo sobre el mismo cluster. Pregúntalos al humano antes de usarlos; no se heredan de la ola anterior.
- **No reabre C-76** (el contador conectado/bloqueo en 0 sigue siendo u9-T02): esta tarea resetea el contador, no lo conecta si no estuviera ya contando.
- Si al implementar aparece que `users` (identity) no tiene un chequeo de existencia reutilizable para decidir `204` vs `404` en `reset-counter`, usa `204` siempre (operación idempotente, red interna de confianza) y dilo en la bitácora: no es necesario inventar una consulta nueva solo para distinguir ambos casos.

---

_Redactada por el orquestador al abrir la ola 14 (u13-T01), reutilizando el contrato público ya fijado en Inception (`DELETE /api/history`, C7, C8). C9 (progress) se omite y queda como C-83 en `CANDIDATAS.md`._
