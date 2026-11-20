# u9-T02 — Enforcement cross-service del contador de subidas: `ingestion-service` consulta y actualiza `identity-service` (C-76)

> **Segunda tarea de u9-upload-limits.** u9-T01 (fusionada) entregó los
> ladrillos en `identity-service`: la tabla `upload_counters`, el endpoint
> público `GET /api/users/me/limits` y el endpoint interno
> `POST /api/internal/users/:userId/increment-counter`. Desde entonces
> nadie los llama: el contador siempre muestra `uploadsRemaining: 10` sin
> importar cuántas subidas reales haga el usuario (candidata C-76,
> abierta desde HANDOFF-13).
>
> Esta tarea cierra el ciclo completo en `ingestion-service`:
>
> 1. **Antes** de procesar una subida, pregunta a identity cuánto le queda al
>    usuario. Si `uploadsRemaining <= 0`, rechaza con **402** sin escribir
>    blob ni llamar a Claude.
> 2. **Después** de una crítica exitosa con confianza alta (`status: "ready"`),
>    incrementa el contador en identity. **Una subida `low_confidence`
>    (fallback 202) NO incrementa el contador** — decisión explícita del
>    humano en esta ola: solo las críticas útiles consumen cupo.
>
> El patrón de cliente HTTP interno (`fetchFn` inyectable, `AbortSignal.timeout`,
> resultado discriminado que nunca lanza) ya existe tres veces en el repo
> (`progress-service/src/service/identity-client.ts` para `fetchLimits`,
> `trust-service/src/service/identity-client.ts` para `resetCounter`,
> `trust-service/src/service/ingestion-client.ts`). Aquí se reutiliza el
> mismo molde, no se inventa uno nuevo.

**Unidad:** u9-upload-limits (IngestionService — integración cross-service)
**Historias que implementa:** US-9 completa (AC-9.2: bloqueo en 0 — la única
pieza de US-9 que quedaba pendiente tras u9-T01).
**Depende de:** u9-T01 fusionado (endpoint público y endpoint interno de
identity ya existen y están desplegados). u1-T01 fusionado (`POST /api/uploads`
existente en `apps/ingestion-service/src/handlers/uploads.ts`).

---

## Alcance

**Dentro** (una línea, concreta):

> Nuevo `apps/ingestion-service/src/service/identity-client.ts` con dos
> funciones — `fetchLimits(params): Promise<LimitsResult>` (GET
> `{IDENTITY_URL}/api/users/me/limits` reenviando solo la cabecera
> `Authorization` del request original, timeout `IDENTITY_TIMEOUT_MS`,
> resultado discriminado `{ok:true, uploadsRemaining:number|null}` /
> `{ok:false, kind:'unauthenticated'|'upstream'|'bad-response'|'timeout'}`,
> igual de forma que `progress-service/src/service/identity-client.ts`) e
> `incrementCounter(params): Promise<{ok:boolean}>` (POST
> `{IDENTITY_URL}/api/internal/users/{userId}/increment-counter`, SIN
> `Authorization` — perímetro de red, mismo patrón que `resetCounter` de
> trust-service); modificación de
> `apps/ingestion-service/src/handlers/uploads.ts` en `POST /` para: (a) justo
> después de `requireAuth` y ANTES de tocar `multer`/el blob, llamar a
> `fetchLimits`; si `ok && uploadsRemaining !== null && uploadsRemaining <= 0`
> responder **402** `{data:null, error:"Upload limit reached", status:402}`
> sin leer el body multipart; si `fetchLimits` falla por red/timeout, dejar
> pasar la subida (fail-open: nunca bloquear por un identity caído — decisión
> de diseño, documentada en Notas) pero loguear sin userId ni token; (b)
> cuando `outcome.kind !== 'fallback'` (crítica `ready`, no `low_confidence`),
> DESPUÉS de responder con 202 al cliente, llamar a `incrementCounter` en
> segundo plano (no bloquea la respuesta HTTP, pero el test lo espera con
> `await` inyectando una promesa controlable — ver Plan de pruebas); nuevas
> variables `IDENTITY_URL` e `IDENTITY_TIMEOUT_MS` en
> `k8s/ingestion/configmap.yaml` (mismos valores que ya usan progress-service
> y trust-service: `http://identity-service:3100` y `5000`) y lectura
> equivalente en `createApp`/`server.ts` (lanza al arrancar si falta
> `IDENTITY_URL`, mismo patrón que `progress-service/src/server.ts`); ajuste
> en `apps/frontend/src/pages/Upload.tsx`: `serverMessage` mapea `status===402`
> a un mensaje específico ("You've reached your free plan limit for this
> month") en vez de caer en el genérico `MSG_FAILED`, y el componente muestra
> el `UpgradePrompt` ya existente debajo del error cuando `out.status===402`
> (reutiliza el componente de u0-T04, no crea uno nuevo); nueva imagen
> `ingestion-service:u9-T02`; manifiesto actualizado; despliegue end-to-end
> verificado en kind con un usuario real bajando de 10 a 9 tras una subida
> `ready`, y bloqueado en 402 al llegar a 0; tests Jest + supertest con
> cobertura ≥80% líneas y ≥75% branches sobre `src/service/` y
> `src/handlers/`; tests React Testing Library para el nuevo mapeo 402 en
> `Upload.tsx`.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto o útil):

- Cambios a `identity-service`: el endpoint `GET /api/users/me/limits` y
  `POST /api/internal/users/:userId/increment-counter` YA EXISTEN desde
  u9-T01 y no se tocan en esta tarea (ni su schema, ni su lógica de clamp a
  0, ni sus tests). Si algo ahí estuviera roto, es una tarea aparte.
- Contar las subidas `low_confidence` contra el límite. Decisión explícita
  del humano en esta ola: solo las críticas `ready` incrementan. Si el
  codificador encuentra que esto contradice lo que dice
  `unit-of-work.md` o `requirements.md` sobre "low-confidence cuenta contra
  el límite", es un **fix de especificación documentado**, no una
  reinterpretación silenciosa: anota en la bitácora que esta tarea
  deliberadamente restringe el alcance de FR-9.1 a solo críticas `ready`, por
  decisión del humano de 2026-11-20, y sigue con ese comportamiento.
- Usar el código `422` o `403` para el bloqueo en 0 — se fijó `402` por
  decisión del humano en esta ola. No renegociar el código HTTP.
- Bloquear la subida si `fetchLimits` falla por red/timeout (fail-closed).
  Esta tarea es fail-open por diseño: un identity caído no debe tumbar el
  flujo de upload completo. Si el revisor interno (tú, orquestador, sin
  ronda de revisor en esta sesión) no está de acuerdo con fail-open, se
  levanta como hallazgo al humano, no se cambia unilateralmente.
- Cualquier UI nueva de "upgrade" — se reutiliza `UpgradePrompt` de u0-T04
  tal cual existe. No se crea un modal, banner o página nueva.
- Un cron o job que resetee el contador — sigue resuelto por diseño desde
  u9-T01 (inferencia sobre `year_month`) y por `resetCounter` desde u13-T01
  (borrado de historial). No hay nada que añadir aquí.
- Cambios a `apps/trust-service/`, `apps/progress-service/`,
  `apps/identity-service/`, `packages/auth-middleware/`.
- Cambios a `k8s/*.yaml` (raíz) o a cualquier manifiesto de
  `k8s/identity/`, `k8s/trust/`, `k8s/progress/`.
- Cambios a `tareas/`, `revisiones/`, `bitacoras/` fuera de los archivos
  propios de esta tarea.
- Subir más de 2-3 archivos reales con usuarios `*.test` durante las pruebas
  E2E manuales — basta con bajar el contador de 10 a 9 u 8 para demostrar el
  decremento; para probar el bloqueo en 0 se autoriza (ver pregunta de
  permisos) usar una variable de entorno de prueba que baje el límite a un
  número pequeño en el pod de identity solo durante la verificación, sin
  tocar el código de producción ni commitear ese valor.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` — contrato del loop; **sin ronda de revisor en
  esta sesión** (decisión del humano, 2026-11-20): el orquestador es el único
  control de calidad antes del PR.
- `.claude/agents/codificador.md` — tu contrato. Corre tú mismo cada CA con
  su comando real; no hay revisor detrás que lo repita.
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data, error,
status}`, Jest + ts-jest + supertest, RTL + Jest en frontend, cobertura
  ≥80%/≥75%, tipos compartidos en `@proyecto/shared-types`, imágenes con tag
  explícito.
- `aidlc/spaces/default/memory/project.md` — reglas duras aplicables (nunca
  `latest`, no duplicar tipos de `shared-types`, etc.)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` —
  definición de u9-upload-limits.
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` —
  C2 (`GET /api/users/me/limits`), C6 (patrón de endpoint interno sin auth).
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` —
  US-9, AC-9.2 (bloqueo en 0 — lo que esta tarea completa).
- `aidlc/spaces/default/intents/260925-feature/inception/requirements-analysis/requirements.md` —
  FR-9.1, FR-9.2 (402 — ya decidido para esta tarea), FR-9.5.
- `tareas/u9-T01-upload-limits.md` — la tarea anterior: contrato exacto de
  los dos endpoints de identity que este consume, sin modificarlos.
- `tareas/u13-T01-delete-history.md` — patrón de cliente HTTP interno
  `trust→identity`/`trust→ingestion` más reciente (fail-handling, logging sin
  PII, orden de operaciones).
- `apps/progress-service/src/service/identity-client.ts` — **molde directo**
  de `fetchLimits`: mismo tipo de retorno, mismo manejo de timeout/401/
  bad-response. Copia el patrón, no el archivo.
- `apps/progress-service/src/server.ts` — patrón de lectura de `IDENTITY_URL`
  / `IDENTITY_TIMEOUT_MS` al arrancar (`readTimeout`, falla si falta la URL).
- `apps/trust-service/src/service/identity-client.ts` — molde de
  `resetCounter` (POST interno sin Authorization, timeout, resultado
  discriminado) para construir `incrementCounter`.
- `apps/ingestion-service/src/handlers/uploads.ts` — handler que se modifica;
  **leer entero antes de tocarlo**: el orden actual es
  multer → magic-number → blob → BD → Claude → persistir crítica → responder.
  El nuevo check de límite se inserta ANTES de multer; el incremento se
  inserta DESPUÉS de responder 202 en la rama `ready`.
- `apps/ingestion-service/src/server.ts` — donde se registra `IDENTITY_URL`
  y se inyecta el nuevo cliente al router de uploads.
- `packages/shared-types/src/limits.ts` — `LimitsResponseSchema` ya publicado
  desde u9-T01; se reusa, no se redefine.
- `k8s/ingestion/configmap.yaml` — añade `IDENTITY_URL` e
  `IDENTITY_TIMEOUT_MS` (mismos valores que `k8s/progress/configmap.yaml`).
- `k8s/ingestion/deployment.yaml` — manifiesto a actualizar: solo el `image:`.
- `apps/frontend/src/pages/Upload.tsx` — `serverMessage` a extender con el
  caso `402`; componente a extender con `UpgradePrompt`.
- `apps/frontend/src/components/UpgradePrompt.tsx` — componente existente de
  u0-T04, reusar tal cual.
- `apps/frontend/src/api/client.ts` — `classify()` ya bucketiza cualquier
  4xx≠401 como `'client'`; el 402 cae ahí sin cambios en el cliente HTTP. Solo
  cambia el mapeo a mensaje en `Upload.tsx`.

---

## Criterios de aceptación

Cada uno con **su comando**. Sin ronda de revisor en esta sesión: el
orquestador corre cada uno él mismo desde la raíz antes de fusionar a PR.

- [ ] **CA-1** — `apps/ingestion-service/src/service/identity-client.ts`
      expone `fetchLimits` e `incrementCounter`, ambos tipados, ninguno lanza
      (todo fallo es un resultado discriminado).

  ```bash
  test -f apps/ingestion-service/src/service/identity-client.ts
  grep -E "export (async )?function fetchLimits|export const fetchLimits" apps/ingestion-service/src/service/identity-client.ts
  grep -E "export (async )?function incrementCounter|export const incrementCounter" apps/ingestion-service/src/service/identity-client.ts
  grep -E "try\s*\{" apps/ingestion-service/src/service/identity-client.ts | wc -l | tr -d ' '
  ```

  Esperado: archivo existe, ambas funciones exportadas, al menos 2 bloques
  `try` (uno por función, para no dejar que un fetch lance sin capturar).

- [ ] **CA-2** — `fetchLimits` reenvía SOLO la cabecera `Authorization` tal
      cual (sin agregar query ni otras cabeceras), usa
      `redirect: 'error'` y `AbortSignal.timeout(timeoutMs)`.

  ```bash
  grep -E "redirect:\s*['\"]error['\"]" apps/ingestion-service/src/service/identity-client.ts
  grep -E "AbortSignal\.timeout" apps/ingestion-service/src/service/identity-client.ts
  grep -E "Authorization:\s*authorization" apps/ingestion-service/src/service/identity-client.ts
  npm test -w apps/ingestion-service -- --testPathPattern=identity-client --no-coverage 2>&1 | tail -20
  ```

  Esperado: los tres patrones presentes; la suite de `identity-client` pasa
  con casos: 200 con `uploadsRemaining`, 401, timeout, red caída, status
  inesperado (p.ej. 500).

- [ ] **CA-3** — `incrementCounter` llama
      `POST {baseUrl}/api/internal/users/{userId}/increment-counter` SIN
      cabecera `Authorization`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=identity-client --no-coverage 2>&1 | grep -iE "increment"
  grep -n "incrementCounter" -A 15 apps/ingestion-service/src/service/identity-client.ts | grep -E "headers"
  ```

  Esperado: al menos un test de `incrementCounter` pasa; el bloque de la
  función no construye un objeto `headers` con `Authorization`.

- [ ] **CA-4** — `POST /api/uploads` con un usuario cuyo `GET .../limits`
      devuelve `uploadsRemaining: 0` responde **402** con body
      `{data:null, error:"Upload limit reached", status:402}` ANTES de que se
      escriba ningún blob (lectura de vuelta: el directorio de blobs no gana
      un archivo nuevo tras la llamada — en el test, el stub de `writeBlob`
      nunca se invoca).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -iE "(402|limit reached|uploadsRemaining.*0)"
  ```

  Esperado: al menos un test pasa y afirma explícitamente que el mock de
  escritura de blob NO fue llamado (`expect(writeBlobMock).not.toHaveBeenCalled()`
  o equivalente) cuando el límite está en 0.

- [ ] **CA-5** — Con `uploadsRemaining: 7` (o cualquier valor > 0), la subida
      sigue su flujo normal sin cambios de comportamiento observable para el
      cliente (202 `ready` o `low_confidence` según corresponda).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | tail -30
  ```

  Esperado: 0 tests fallan; los tests existentes de u1-T01/u3-T01 (ready,
  low_confidence, 413, 422, 500) siguen verdes sin modificación de sus
  aserciones.

- [ ] **CA-6** — Cuando `fetchLimits` falla (timeout, red caída o respuesta
      inesperada de identity), la subida **NO se bloquea** (fail-open): sigue
      su flujo normal como si `uploadsRemaining` fuera desconocido.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -iE "(identity.*down|fail.open|limits.*unavailable|identity.*timeout)"
  ```

  Esperado: al menos un test pasa simulando `fetchLimits` fallido y afirma
  que la subida se procesa igual (202, no 402, no 500 por culpa de identity).

- [ ] **CA-7** — Una subida con `outcome.kind !== 'fallback'` (crítica
      `ready`) dispara `incrementCounter` para ese `userId`. Una subida
      `low_confidence` (`outcome.kind === 'fallback'`) NO lo dispara.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -iE "(increment.*ready|increment.*not.*called|low_confidence.*increment)"
  ```

  Esperado: al menos dos tests pasan — uno afirma que `incrementCounter` fue
  llamado con el `userId` correcto tras una crítica `ready`; otro afirma que
  NO fue llamado tras una crítica `low_confidence`.

- [ ] **CA-8** — Un fallo de `incrementCounter` (red caída, timeout, status
      inesperado) NO afecta la respuesta HTTP ya enviada al cliente ni hace
      fallar el request. Se loguea sin `userId` ni token.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads --no-coverage 2>&1 | grep -iE "(increment.*fail|increment.*error|increment.*does not)"
  grep -n "console\." apps/ingestion-service/src/handlers/uploads.ts | grep -iE "increment"
  ```

  Esperado: al menos un test pasa afirmando que la respuesta 202 ya se envió
  (o el status code del response en el test) independientemente del
  resultado de `incrementCounter`; si hay un log, no interpola `userId` ni
  cabeceras.

- [ ] **CA-9** — `apps/ingestion-service/src/server.ts` lee `IDENTITY_URL` e
      `IDENTITY_TIMEOUT_MS` del entorno y lanza al arrancar si falta
      `IDENTITY_URL` (mismo patrón que `progress-service/src/server.ts`).

  ```bash
  grep -E "IDENTITY_URL" apps/ingestion-service/src/server.ts
  grep -E "IDENTITY_TIMEOUT_MS" apps/ingestion-service/src/server.ts
  npm test -w apps/ingestion-service -- --testPathPattern=server --no-coverage 2>&1 | grep -iE "identity.*url.*required|missing.*identity"
  ```

  Esperado: ambas variables leídas; un test afirma que `createApp()` sin
  `IDENTITY_URL` lanza.

- [ ] **CA-10** — Los endpoints existentes de `ingestion-service`
      (`POST/GET /api/uploads`, `GET /api/uploads/:id`, `GET
    /api/uploads/:id/thumbnail`, `DELETE /api/internal/users/:userId/data`)
      siguen verdes sin regresión.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -25
  ```

  Esperado: 0 tests fallan en la suite completa del servicio.

- [ ] **CA-11** — Cobertura: `apps/ingestion-service/src/service/*.ts` y
      `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches incluyendo los
      archivos nuevos/modificados.

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-12** — `apps/frontend/src/pages/Upload.tsx`: `serverMessage`
      mapea `status === 402` a un mensaje distinto de `MSG_FAILED` y
      distinto de `MSG_TOO_LARGE`/`MSG_INVALID_IMAGE`; el componente muestra
      `UpgradePrompt` cuando el error activo viene de un 402.

  ```bash
  grep -E "402" apps/frontend/src/pages/Upload.tsx
  npm test -w apps/frontend -- --testPathPattern=Upload --watchAll=false 2>&1 | tail -30
  ```

  Esperado: el literal `402` aparece en el archivo; la suite de `Upload`
  pasa incluyendo un nuevo caso que simula 402 y afirma el mensaje
  específico y la presencia de `UpgradePrompt` en el DOM renderizado.

- [ ] **CA-13** — Cobertura de frontend: `src/api/` y `src/auth/` se
      mantienen en los floors existentes (≥96%/≥86% de ramas respectivamente,
      sin bajar respecto al cierre de HANDOFF-15); el global de líneas sigue
      ≥80%.

  ```bash
  npm test -w apps/frontend -- --coverage --coverageReporters=json-summary --watchAll=false 2>&1 | tail -10
  cat apps/frontend/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const t=s.total; if(t.lines.pct<80) throw new Error("global lines "+t.lines.pct+"% < 80%"); console.log("coverage ok frontend global "+t.lines.pct+"%")})'
  ```

  Esperado: imprime `coverage ok frontend global <pct>%` con `pct >= 80`.

- [ ] **CA-14** — `npm run lint` desde la raíz pasa.

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0.

- [ ] **CA-15** — Nueva imagen `ingestion-service:u9-T02` (nunca `latest`)
      construida desde la raíz; `k8s/ingestion/configmap.yaml` con
      `IDENTITY_URL: 'http://identity-service:3100'` e
      `IDENTITY_TIMEOUT_MS: '5000'`; `k8s/ingestion/deployment.yaml` con
      `image: ingestion-service:u9-T02` y sin otro cambio.

  ```bash
  grep -E "IDENTITY_URL: 'http://identity-service:3100'" k8s/ingestion/configmap.yaml
  grep -E "IDENTITY_TIMEOUT_MS: '5000'" k8s/ingestion/configmap.yaml
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u9-T02 . 2>&1 | tail -20
  docker image inspect ingestion-service:u9-T02 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -E '"RepoTags"'
  grep -E "image: ingestion-service:u9-T02" k8s/ingestion/deployment.yaml
  git diff main..HEAD -- k8s/ingestion/deployment.yaml | grep -E "^[-+][^-+]" | grep -v "^[-+]$" | tee /tmp/u9t02-deploy-diff.txt
  node -e 'const l=require("fs").readFileSync("/tmp/u9t02-deploy-diff.txt","utf8").split("\n").filter(Boolean); const bad=l.filter(x=>!/image: ingestion-service:(u13-T01|u9-T02)/.test(x)); if(bad.length) throw new Error("manifest changed beyond image tag: "+bad.join("|")); console.log("manifest diff limited to image tag")'
  ```

  Esperado: variables presentes, `docker build` exit 0, imagen inspeccionable,
  `latest` ausente, `manifest diff limited to image tag`.

- [ ] **CA-16** — Despliegue end-to-end verificado en kind:
  1. Imagen construida (CA-15), `kind load docker-image ingestion-service:u9-T02`.
  2. `kubectl apply -f k8s/ingestion/configmap.yaml -f k8s/ingestion/deployment.yaml`.
  3. `kubectl rollout status deployment/ingestion-service` exit 0, pod `Ready`.
  4. Usuario `*.test` fresco: `GET /api/users/me/limits` → `uploadsRemaining: 10`.
  5. Una subida real (`ready`, no `low_confidence`) vía `POST /api/uploads`.
  6. `GET /api/users/me/limits` inmediatamente después → `uploadsRemaining: 9`
     (lectura de vuelta real, no narrada).
  7. (Opcional, con permiso del humano) bajar el límite a un número pequeño
     vía variable de entorno de prueba, agotarlo, y confirmar `POST
/api/uploads` → **402**.

  ```bash
  kubectl get pods -l app=ingestion-service
  kubectl rollout status deployment/ingestion-service --timeout=90s
  # pega aquí, en la bitácora, los curls reales con sus respuestas (10 -> 9)
  ```

  Esperado: pod `1/1 Ready`; `uploadsRemaining` decrementa de 10 a 9 tras una
  subida `ready` real en el cluster, verificado con `curl` real, no narrado.

- [ ] **CA-17** — Sin secretos en el diff ni en el árbol (CA estándar).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`.

> **Si un criterio no tiene comando, la tarea no está lista y no se despacha.**
> El orquestador corre cada uno él mismo antes de fusionar (sin ronda de
> revisor en esta sesión).

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- `identity-client.test.ts`: `fetchLimits` con 200/`uploadsRemaining` válido,
  401, timeout, red caída, status inesperado; `incrementCounter` con 200,
  fallo de red, timeout. Cada caso afirma el resultado discriminado exacto,
  no solo "no lanza".
- `uploads.test.ts` (extensión de la suite existente): subida bloqueada en
  402 cuando el límite está en 0 (afirmando que `writeBlob` no se llamó);
  subida normal cuando el límite es > 0; subida que sigue su curso cuando
  `fetchLimits` falla (fail-open); `incrementCounter` llamado tras `ready`,
  NO llamado tras `low_confidence`; fallo de `incrementCounter` no afecta la
  respuesta ya enviada.
- `server.test.ts`: `createApp()` lanza sin `IDENTITY_URL`.
- `Upload.test.tsx` (extensión): nuevo caso 402 → mensaje específico +
  `UpgradePrompt` visible.

**Rojo primero:** antes de cualquier arreglo, el codificador reproduce el
fallo (p.ej. "el test de 402 falla porque hoy `POST /api/uploads` no conoce
el límite") y lo registra en la bitácora. El par falla-pasa es la prueba.

---

## Notas

- Archivos que se **modifican en su sitio**:
  `apps/ingestion-service/src/handlers/uploads.ts`,
  `apps/ingestion-service/src/server.ts`,
  `k8s/ingestion/configmap.yaml`, `k8s/ingestion/deployment.yaml`,
  `apps/frontend/src/pages/Upload.tsx`. Nuevo:
  `apps/ingestion-service/src/service/identity-client.ts` (y sus tests).
  Nada de duplicados con sufijo.
- **Fail-open es una decisión de diseño explícita de esta tarea**: si
  identity-service está caído, `ingestion-service` sigue aceptando subidas
  sin conocer el límite, en vez de tumbar el flujo completo del producto por
  un servicio secundario caído. Esto es consistente con que el contador es
  una feature de negocio (monetización), no una garantía de seguridad.
- **Orden exacto del check de límite**: se inserta ANTES del middleware de
  `multer` (antes de leer el body multipart), para no gastar ancho de banda
  ni procesar un archivo que de todos modos se va a rechazar. Esto implica
  mover la llamada a `fetchLimits` al middleware que ya envuelve
  `upload.single('file')`, o a uno nuevo que corra justo antes.
- **402 fuera del bucket "client" especial en el frontend**: `classify()` en
  `apps/frontend/src/api/client.ts` NO cambia — un 402 ya cae en `'client'`
  igual que 413/422. Solo el mapeo de mensaje en `Upload.tsx` distingue el
  caso. No toques `client.ts`.
- **El reinicio de `ingestion-service` deja el servicio caído ~41s (C-60)**,
  sin cambios en esta tarea. Avisa al humano antes del rollout si hay
  tráfico de prueba en curso.
- Si `unit-of-work.md` o `requirements.md` dicen literalmente que
  `low_confidence` cuenta contra el límite, documenta el fix de
  especificación en la bitácora citando esta nota — no lo implementes así.

---

_Creado por el orquestador, ola 16, 2026-11-20._
