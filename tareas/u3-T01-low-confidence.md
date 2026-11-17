# u3-T01 — Fallback de baja confianza en `apps/ingestion-service/`: LOW confidence, schema inválido y timeout devuelven 202 `low_confidence` explícito

> **Tarea de u3-low-confidence.** Hoy, si Claude devuelve `confidence: "LOW"` el handler responde
> `status:"ready"` con las 5 categorías (engaña al usuario), y si Claude falla (timeout, error de red,
> JSON/schema inválido) el handler responde **500 genérico**. u3 reemplaza ambos comportamientos por una
> respuesta de fallback explícita: **202** con `status:"low_confidence"`, `confidence:"LOW"`,
> `fallbackReason` y **sin** `categories`. Contrato C1 (`UploadResult`) y C10 (`ErrorBehavior`).
>
> **El schema compartido YA está listo.** u2-T01 dejó en `packages/shared-types/src/uploads.ts`
> `status: ready|low_confidence`, `categories` opcional y `fallbackReason:
low_confidence_flag|invalid_schema|timeout`. **u3 NO modifica `packages/shared-types/`.**
>
> **Sin `ANTHROPIC_API_KEY` en el cluster.** El stub de producción devuelve siempre HIGH; el fallback se
> prueba inyectando clientes controlados (tests) y simulando el SDK con `jest.mock('@anthropic-ai/sdk')`.

**Unidad:** u3-low-confidence (IngestionService — extensión)
**Historias que implementa:** US-3 (AC-3.1 LOW → sin scores y con indicación de fallback; AC-3.2 y AC-3.3
se cumplen por construcción: ver Notas).
**Depende de:** u2-T01 fusionado (`claude-client.ts`, `ClaudeVisionResponseSchema`, `UploadResultSchema`).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`apps/ingestion-service/src/service/anthropic-error.ts`** (nuevo): clase
> `AnthropicIntegrationError extends Error` (requerida por `team.md`), con `kind: 'timeout' | 'network' |
'bad-response'` y `cause?: unknown`. Mismo patrón que `apps/backend/src/service/anthropic-error.ts`
> (no se importa del backend; cada servicio tiene su copia, es una clase de error, no un contrato).
>
> **`apps/ingestion-service/src/service/claude-client.ts`** (modificar en su sitio): (a) el timeout se lee de
> `process.env.CLAUDE_TIMEOUT_MS` (entero > 0; ausente o inválido → 30 000), evaluado **en cada llamada**;
> (b) la rama real envuelve todo fallo en `AnthropicIntegrationError`: timeout/abort →
> `kind:'timeout'`; cualquier otro error del SDK/red/5xx → `kind:'network'`; sin bloque de texto, JSON no
> parseable o `ClaudeVisionResponseSchema.safeParse` fallido → `kind:'bad-response'`. El stub no cambia.
>
> **`apps/ingestion-service/src/service/critique-outcome.ts`** (nuevo): exporta
> `resolveCritique(claudeClient, buffer): Promise<CritiqueOutcome>` donde
> `CritiqueOutcome = {kind:'ready', critique: ClaudeVisionResponse} | {kind:'fallback', reason:
'low_confidence_flag'|'invalid_schema'|'timeout'}`. Reglas, en este orden:
>
> 1. `claudeClient` lanza `AnthropicIntegrationError` `timeout` → fallback `timeout`; `network` →
>    fallback `timeout` (**decisión D-1**: el enum C1 solo tiene 3 razones; un 5xx/red cae en la misma
>    familia «servicio no disponible»; el codificador lo documenta en un comentario y en la bitácora);
>    `bad-response` → fallback `invalid_schema`.
> 2. `claudeClient` lanza **cualquier otro error** (no `AnthropicIntegrationError`) → se **re-lanza**
>    (es un bug, no una baja confianza; el handler lo traduce al 500 existente).
> 3. Si resuelve, se **re-valida** el resultado con `ClaudeVisionResponseSchema.safeParse` (protege contra
>    clientes inyectados o cambios futuros; cubre categorías faltantes y scores fuera de 0-100) →
>    fallo → fallback `invalid_schema`.
> 4. Si `confidence === 'LOW'` → fallback `low_confidence_flag`. (El schema se valida **antes** que LOW.)
> 5. `HIGH` o `MEDIUM` → `ready`.
>
> **`apps/ingestion-service/src/handlers/uploads.ts`** (modificar en su sitio): reemplazar el bloque
> `try { claudeClient } catch → 500` por `resolveCritique`. `ready` → respuesta 202 actual sin cambios.
> `fallback` → `res.status(202).json({data:{uploadId, status:'low_confidence', confidence:'LOW',
fallbackReason: reason}, error:null, status:202})` — **sin la clave `categories`** (**decisión D-2**:
> `confidence` es `"LOW"` en las tres razones). Error no-`AnthropicIntegrationError` → 500
> `{data:null,error:'Failed to analyze image',status:500}` como hoy. Loguear con `console.warn` (si
> `npm run lint` lo rechaza, usar el mecanismo de log ya existente en el servicio) solo `uploadId` y
> `reason`; **nunca** buffer, API key ni texto crudo de Claude. El upload sigue registrándose en BD **antes**
> de llamar a Claude (no cambiar ese orden).
>
> **`k8s/ingestion/configmap.yaml`**: añadir `CLAUDE_TIMEOUT_MS: '30000'` (FR-3.3: configurable en runtime).
>
> **`k8s/ingestion/deployment.yaml`**: `image: ingestion-service:u3-T01` (tag explícito).
>
> **Tests**: ver Plan de pruebas. `apps/ingestion-service/src/__tests__/uploads-http.test.ts` y
> `claude-client.contract.test.ts` se amplían en su sitio; nuevos `critique-outcome.test.ts` y
> `claude-client.real.test.ts`.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Cualquier cambio a `packages/shared-types/` (el schema ya cubre u3). Si crees que falta algo, repórtalo
  en la bitácora; no lo toques.
- Persistir el flag de baja confianza en BD / columnas nuevas / `category_critiques` — u4-T01. En u3 el
  flag vive **solo en la respuesta**. No modificar `upload-repository.ts` ni `database.ts`.
- Excluir uploads LOW del cálculo de tendencias (AC-3.2) — u6; depende de la persistencia de u4.
- Decremento/consulta del contador de uploads (AC-3.3) — ya es de u9; u3 no llama a identity-service.
- Botón/mensaje «Retry» y el texto «Could not generate a reliable critique…» — son de frontend; el
  backend solo expone `status` + `fallbackReason`. No se añade campo `message`.
- Reintentos automáticos contra Claude (C10: «No retry»).
- Añadir valores nuevos a `fallbackReason` (ver D-1).
- Cambios a `apps/backend/`, `apps/identity-service/`, `apps/trust-service/`, `packages/auth-middleware/`,
  `k8s/*.yaml` raíz, `Dockerfile`, y a `magic-number.ts`, `blob-store.ts`, `upload-repository.ts`,
  `database.ts`.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` — Zod autoritativo, `{data,error,status}`, `AnthropicIntegrationError`, Jest, cobertura 80%/75%
- `aidlc/spaces/default/memory/project.md` — reglas duras (sin secretos, tags explícitos)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u3
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` — US-3 (AC-3.1..3.3)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — C1 `UploadResult` y C10 `ErrorBehavior`
- `bitacoras/u2-T01.md` y `tareas/u2-T01-ai-critique-stub.md` — estado previo del cliente y handler
- `apps/ingestion-service/src/service/claude-client.ts` — se modifica
- `apps/ingestion-service/src/handlers/uploads.ts` — se modifica
- `apps/ingestion-service/src/server.ts` — **solo lectura** (la inyección `claudeClient` ya existe)
- `apps/ingestion-service/src/__tests__/uploads-http.test.ts` y `claude-client.contract.test.ts` — se amplían
- `apps/backend/src/service/anthropic-error.ts` — patrón de la clase de error
- `packages/shared-types/src/uploads.ts` y `anthropic.ts` — **solo lectura**
- `k8s/ingestion/deployment.yaml`, `k8s/ingestion/configmap.yaml` — se modifican

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u3-T01` checada.

- [ ] **CA-1** — `AnthropicIntegrationError` existe en ingestion con `kind` (`timeout|network|bad-response`) y `cause`.

  ```bash
  grep -E "class AnthropicIntegrationError extends Error" apps/ingestion-service/src/service/anthropic-error.ts
  grep -E "timeout.*network.*bad-response|'timeout'.*'network'.*'bad-response'" apps/ingestion-service/src/service/anthropic-error.ts
  npx tsc --noEmit -p apps/ingestion-service 2>&1 | tail -3
  ```

  Esperado: clase y los tres `kind` presentes; `tsc` exit 0.

- [ ] **CA-2** — `resolveCritique` clasifica correctamente las cinco reglas (LOW, schema inválido por categorías
      faltantes, schema inválido por score fuera de rango, timeout/network, error ajeno re-lanzado, HIGH y MEDIUM → ready).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=critique-outcome --no-coverage 2>&1 | tail -30
  ```

  Esperado: suite pasa, 0 failures; la salida verbose lista un test por cada caso anterior (≥ 8 tests).

- [ ] **CA-3** — La rama real de `callClaudeVision` (SDK simulado con `jest.mock`) lanza `AnthropicIntegrationError` con el
      `kind` correcto: timeout → `timeout`; error de conexión/5xx → `network`; sin bloque de texto, JSON no parseable y schema
      inválido → `bad-response`; respuesta válida → resultado parseado. `CLAUDE_TIMEOUT_MS` se respeta (valor válido, ausente,
      `abc`, `0` y negativo → 30 000 salvo el válido).

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=claude-client.real --no-coverage 2>&1 | tail -30
  ```

  Esperado: suite pasa, 0 failures; hay tests con nombre para cada `kind` y para el parseo de `CLAUDE_TIMEOUT_MS`.

- [ ] **CA-4** — `POST /api/uploads` con cliente que devuelve `confidence:"LOW"` → **202**, `data.status:"low_confidence"`,
      `data.confidence:"LOW"`, `data.fallbackReason:"low_confidence_flag"`, y el body **no contiene la clave `categories`**
      (se afirma con `not.toHaveProperty('data.categories')`, no con `undefined`). El body cumple `UploadResultSchema.parse`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage 2>&1 | grep -E "(low_confidence_flag|LOW|fallback)"
  ```

  Esperado: el/los tests de LOW aparecen en verde.

- [ ] **CA-5** — `POST /api/uploads` con cliente que devuelve schema inválido (a) <5 categorías y (b) score 150 → **202**
      `low_confidence` con `fallbackReason:"invalid_schema"`; con cliente que lanza `AnthropicIntegrationError('timeout')` →
      `fallbackReason:"timeout"`; con `AnthropicIntegrationError('network')` → `fallbackReason:"timeout"`;
      con `AnthropicIntegrationError('bad-response')` → `fallbackReason:"invalid_schema"`. Ninguno incluye `categories`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage 2>&1 | grep -E "(invalid_schema|timeout|network|bad-response)"
  ```

  Esperado: los cinco tests aparecen en verde.

- [ ] **CA-6** — `confidence:"MEDIUM"` válido → **202** `status:"ready"` con 5 `categories` (no es fallback). Un error que **no** es
      `AnthropicIntegrationError` sigue dando **500** `{data:null,error:"Failed to analyze image",status:500}`. Regresión de HIGH → ready.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage 2>&1 | grep -E "(MEDIUM|ready|Failed to analyze|500)"
  ```

  Esperado: tests de MEDIUM, HIGH y 500 en verde.

- [ ] **CA-7** — El upload se registra en BD **también** en el fallback (el registro se crea antes de llamar a Claude): tras un
      upload con cliente LOW, `repo.countByUserId(userId)` es 1 y `repo.findById(<uploadId de la respuesta>)` no es null.
      Lectura de vuelta contra el repositorio real (SQLite en memoria o temporal), no un mock.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage 2>&1 | grep -E "(countByUserId|findById|persist|registrad|stored)"
  ```

  Esperado: el test que lee de vuelta con `repo` aparece en verde.

- [ ] **CA-8** — Regresiones: 401 sin `Authorization`, 422 por magic-number inválido, 413 por tamaño y 422 sin campo `file`
      siguen pasando; `apps/backend/` compila y sus tests siguen verdes.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=uploads-http --no-coverage 2>&1 | grep -E "(401|422|413)"
  npx tsc --noEmit -p apps/backend 2>&1 | tail -5
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -10
  ```

  Esperado: tests 401/422/413 en verde; `tsc` exit 0; 0 fallos en backend.

- [ ] **CA-9** — Suite completa de ingestion verde y cobertura: cada archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y
      ≥ 75% branches (incluye `claude-client.ts`, `critique-outcome.ts`, `anthropic-error.ts`).

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } for (const n of ["critique-outcome","anthropic-error","claude-client"]) { if(!Object.keys(s).some(k=>k.includes(n))) throw new Error(n+" missing from coverage"); } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-10** — `npm run lint` desde la raíz pasa y el código está formateado con Prettier.

  ```bash
  npm run lint 2>&1 | tail -5
  npx prettier --check apps/ingestion-service/src tareas/u3-T01-low-confidence.md k8s/ingestion 2>&1 | tail -5
  ```

  Esperado: lint exit 0; Prettier sin archivos pendientes.

- [ ] **CA-11** — `packages/shared-types/` no cambió (el schema ya cubría u3).

  ```bash
  git diff main..HEAD --name-only | grep -E "^packages/" && echo "FAIL: packages tocado" && exit 1 || echo "packages untouched"
  ```

  Esperado: imprime `packages untouched`.

- [ ] **CA-12** — Manifiestos: tag `u3-T01` sin `latest` ni el tag viejo, y `CLAUDE_TIMEOUT_MS` en el ConfigMap.

  ```bash
  grep -E "image: ingestion-service:u3-T01" k8s/ingestion/deployment.yaml
  ! grep -E "image: ingestion-service:(u2-T01|latest)" k8s/ingestion/deployment.yaml && echo "old tag absent"
  grep -E "CLAUDE_TIMEOUT_MS: '30000'" k8s/ingestion/configmap.yaml
  grep -E "anthropic-key" k8s/ingestion/deployment.yaml
  ```

  Esperado: nuevo tag, tag viejo ausente, variable en el ConfigMap, referencia al Secret intacta.

- [ ] **CA-13** — Imagen `ingestion-service:u3-T01` construida; sin tag `latest`.

  ```bash
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u3-T01 . 2>&1 | tail -15
  docker image inspect ingestion-service:u3-T01 --format '{{.Id}}' | head -1
  ! docker image inspect ingestion-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  ```

  Esperado: build exit 0, imagen inspeccionable, `latest` ausente.

- [ ] **CA-14** — Despliegue en kind y regresión end-to-end del camino feliz: pod `Ready` con la imagen nueva, el ConfigMap lleva la
      variable, y `POST /api/uploads` con JPEG válido sigue devolviendo 202 `ready` con 5 categorías (stub HIGH). Con la lectura de
      vuelta con `kubectl`, no solo códigos de salida.

  ```bash
  kind load docker-image ingestion-service:u3-T01
  kubectl apply -f k8s/ingestion/configmap.yaml -f k8s/ingestion/deployment.yaml
  kubectl rollout status deployment/ingestion-service --timeout=120s
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
  kubectl get configmap ingestion-service-config -o jsonpath='{.data.CLAUDE_TIMEOUT_MS}{"\n"}'
  kubectl get pods -l app=ingestion-service -o jsonpath='{.items[*].status.containerStatuses[0].ready}{"\n"}'
  # port-forward en segundo plano a 3200 y a identity-service 3100; JWT como en u2-T01 CA-14 (register si el usuario no existe)
  curl -sf -X POST http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_TOKEN" -F "file=@/tmp/test-image.jpg" | tee /tmp/u3-upload.json
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/u3-upload.json","utf8")); if(r.status!==202||r.data.status!=="ready"||r.data.categories.length!==5) throw new Error(JSON.stringify(r)); console.log("happy path ok")'
  ```

  Esperado: imagen `ingestion-service:u3-T01`, `30000`, `true`, y `happy path ok`. Cerrar los port-forward al terminar. **El
  camino de fallback no se puede ejercitar en el cluster (no hay API key); lo cubren CA-3 a CA-7 y la bitácora lo declara.**

- [ ] **CA-15** — Sin secretos en el diff ni en el tree.

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-16** — Scope respetado.

  ```bash
  git diff main..HEAD --name-only | grep -E "^(apps/backend/|apps/identity-service/|apps/trust-service/|packages/)" && echo "FAIL: scope creep" && exit 1
  git diff main..HEAD --name-only | grep -E "^k8s/" | grep -vE "^k8s/ingestion/(deployment|configmap)\.yaml$" && echo "FAIL: k8s fuera de alcance" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/ingestion-service/(Dockerfile|src/service/(database|magic-number|blob-store|upload-repository)\.ts)$" && echo "FAIL: archivo protegido tocado" && exit 1
  git diff main..HEAD --name-only | grep -E "^apps/ingestion-service/src/(server|index)\.ts$" && echo "FAIL: server/index tocado" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (Archivos permitidos: `src/service/{anthropic-error,critique-outcome,claude-client}.ts`,
  `src/handlers/uploads.ts`, tests de `src/__tests__/`, los dos manifiestos y `bitacoras/u3-T01.md`.)

- [ ] **CA-17** — Rama `tarea/u3-T01` sobre `main` con ≥ 2 commits legibles.
  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  ```
  Esperado: rama `tarea/u3-T01`, al menos 2 commits.

---

## Plan de pruebas

**Rojo primero:** antes de tocar código, escribe el test HTTP «cliente devuelve LOW» y el test «cliente lanza
`AnthropicIntegrationError('timeout')`» y córrelos contra el código actual. Deben fallar (hoy: 202 `ready` con categorías, y 500).
Registra la salida roja en la bitácora y después pásalos a verde.

- `critique-outcome.test.ts` (unitario, sin red):
  - HIGH válido → `ready`; MEDIUM válido → `ready`.
  - `LOW` válido → fallback `low_confidence_flag`.
  - Resultado con 4 categorías → `invalid_schema`; con score 101 → `invalid_schema`; con score -1 → `invalid_schema`.
  - Resultado inválido **y** `LOW` → `invalid_schema` (orden de reglas).
  - `AnthropicIntegrationError` `timeout` / `network` → `timeout`; `bad-response` → `invalid_schema`.
  - `Error` genérico → se re-lanza (la promesa rechaza con ese mismo error).
- `claude-client.real.test.ts` (`jest.mock('@anthropic-ai/sdk')`; `ANTHROPIC_API_KEY='test-key-not-real'` solo dentro del test, restaurado en `afterEach`):
  - Un test por `kind` (`timeout`, `network`, `bad-response` ×3: sin texto, JSON roto, schema inválido) + camino válido.
  - `CLAUDE_TIMEOUT_MS` válido se pasa como timeout efectivo; ausente / `abc` / `0` / `-5` → 30 000. Verifica el valor observando la
    opción que recibe el mock del SDK o con `jest.spyOn(AbortSignal, 'timeout')`, no solo que «no falla».
- `uploads-http.test.ts` (ampliar): los casos de CA-4 a CA-7; cada fallback afirma `not.toHaveProperty('data.categories')` y
  `UploadResultSchema.safeParse(res.body).success === true`. Mantén el test existente de `Error` genérico → 500.
- `claude-client.contract.test.ts`: sin cambios de comportamiento (stub sigue válido); ampliar solo si aplica.

---

## Notas

- **AC-3.2 y AC-3.3 «por construcción»:** AC-3.3 ya se cumple porque el registro de `uploads` se crea antes de llamar a Claude y u9
  cuenta por registros; AC-3.2 depende de que u4/u6 lean el flag. u3 no los implementa ni los verifica end-to-end; la bitácora debe decir
  qué queda como flag **solo en la respuesta** (u3) y qué espera a BD (u4: columna/estado persistido).
- **Decisiones D-1 y D-2** están fijadas en el Alcance. Si el codificador cree que D-1 es incorrecta (p. ej. quiere una cuarta razón
  `api_error`), **no la implementa**: lo reporta en la bitácora y el orquestador lo registra en `CANDIDATAS.md`.
- **Clasificación de errores del SDK** (`@anthropic-ai/sdk` ^0.39): antes de escribirla, lee `node_modules/@anthropic-ai/sdk` y decide cómo
  distinguir timeout/abort (`APIConnectionTimeoutError`, `APIUserAbortError`, `DOMException` `TimeoutError`/`AbortError`) del resto. Anota en
  la bitácora las clases que usaste. Pasa `signal: AbortSignal.timeout(timeoutMs)` como hoy.
- Los fallbacks son **202**, no 4xx/5xx: el upload se aceptó y registró; lo que falló es el análisis.
- Archivos que se modifican en su sitio: `claude-client.ts`, `handlers/uploads.ts`, `uploads-http.test.ts`, `claude-client.contract.test.ts`,
  `k8s/ingestion/deployment.yaml`, `k8s/ingestion/configmap.yaml`. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no corras `kubectl apply` fuera de CA-14. Los pods de identity y trust siguen con imágenes de ola 1: no
  los toques.
- **Bitácora:** `bitacoras/u3-T01.md` con entradas por ronda: hash de la tarea, salida roja inicial, clases del SDK usadas, cómo
  clasificaste el timeout, qué queda en respuesta vs. BD, y respuestas a hallazgos del revisor por identificador.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u3-T01`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u3-T01`. Imagen Docker: `ingestion-service:u3-T01`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 3** (única tarea despachable: u3)._
