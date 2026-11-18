# u5-T02 — ProgressService: servicio nuevo con `GET /api/trends/history` (proxy autenticado al listado de ingestion), en `apps/progress-service/`

> **Segunda y última tarea de u5-history-storage.** u5-T01 (fusionada, `main` @ `2840754`) dejó en ingestion `GET /api/uploads`, que lista los uploads del usuario del token.
> Esta tarea crea **ProgressService**, un servicio **nuevo y sin base de datos**, que expone el historial al frontend llamando a ese endpoint **reenviando el JWT del usuario**.
>
> **Decisiones del humano (ya tomadas, no se reabren):**
>
> - **C5 es HTTP con el JWT del usuario** (opción A de HANDOFF-9 §7): sin endpoint `/internal`, sin token de servicio, sin Secret nuevo, sin PVC, sin BD.
> - El `kubectl apply` / `kind load` de esta tarea entra en el CA de despliegue **solo si el humano lo autoriza para esta tarea**.
>
> **Decisiones de diseño del orquestador (verificadas contra `contract-summary.md`, lección 8):**
>
> - El Ingress del contrato enruta **`/api/trends/*` → ProgressService** y **`/api/history/*` → TrustService** (borrado, u13). Por eso el historial de ProgressService **no** puede ser `/api/history`: va en **`GET /api/trends/history`**. u6 añadirá `GET /api/trends` en este mismo servicio.
> - Puerto **3400** (identity 3100, ingestion 3200, trust 3300). Nombre del Service y del Deployment: `progress-service`.

**Unidad:** u5-history-storage (ProgressService — servicio nuevo)
**Historias que implementa:** US-5 (AC-5.1: todos los uploads, más reciente primero; el flag de confianza permite al frontend mostrar «Critique unavailable» en los `low_confidence`). AC-4.1 (aislamiento por usuario): lo impone el token reenviado. AC-4.2: **la única salida de red es hacia ingestion, dentro del cluster**.
**Depende de:** u5-T01 (fusionada, `main` @ `2840754` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff). Mira `apps/identity-service/` como molde de estructura, `Dockerfile`, `jest.config.js`, `tsconfig.json` y manifiestos; **no copies** lo que no aplica (sin SQLite, sin volumen de datos):

> **`apps/progress-service/`** (workspace nuevo; `apps/*` ya está en `workspaces`):
>
> - `package.json` (`name: "progress-service"`; mismos scripts que identity: `dev`, `build`, `start`, `test`, `lint`). Dependencias **solo** las que ya usa el monorepo, **con las mismas versiones**: `@proyecto/auth-middleware`, `@proyecto/shared-types`, `express`, `zod`, y las mismas de desarrollo (`jest`, `ts-jest`, `supertest`, `typescript`, `ts-node`, `@types/*`). **Sin** `better-sqlite3`, `axios`, `node-fetch` ni ningún cliente HTTP: Node 20 trae `fetch` global.
> - `tsconfig.json` y `jest.config.js` iguales a los de identity (cobertura sobre `src/service/**` y `src/handlers/**`).
> - `src/index.ts`: lee `PORT` (por defecto 3400) y escucha.
> - `src/server.ts`: `createApp(deps?)` con `deps.fetchFn?` (por defecto `fetch`), `deps.ingestionUrl?` (por defecto `process.env.INGESTION_URL`) y `deps.timeoutMs?` (por defecto `INGESTION_TIMEOUT_MS`, 5000). **Si falta `INGESTION_URL` y no se inyecta, `createApp` lanza** (falla al arrancar). Rutas: `GET /health` (público) y `GET /api/trends/history` detrás de `requireAuth` de `@proyecto/auth-middleware`. Fallback 404 `{data:null,error:'Not Found',status:404}`.
> - `src/service/ingestion-client.ts`: `fetchUploadList({ authorization, fetchFn, baseUrl, timeoutMs })` → `GET ${baseUrl}/api/uploads` con **solo** la cabecera `Authorization` recibida (valor tal cual), `AbortSignal.timeout(timeoutMs)`, **sin query params, sin cuerpo y sin ninguna otra cabecera del cliente**. Valida el cuerpo con `UploadListSchema.safeParse` (de `shared-types`; **no se redefine**). Devuelve un resultado discriminado (`ok` con `items`, o `error` con `kind`: `unauthenticated | upstream | bad-response | timeout`) y **nunca lanza** por errores de red o de formato.
> - `src/handlers/history.ts`: `GET /api/trends/history`:
>   - Toma `req.headers.authorization` (ya validado por `requireAuth`) y llama al cliente.
>   - **200** → `{ data: { items }, error: null, status: 200 }` con `satisfies UploadList`, con los items **tal como los validó el schema, sin reordenar ni filtrar** (el orden «más reciente primero» lo fija ingestion).
>   - `unauthenticated` (ingestion respondió 401) → **401** `{data:null,error:'unauthenticated',status:401}`.
>   - `timeout` → **504** `{data:null,error:'Upstream timeout',status:504}`.
>   - `upstream` (ingestion respondió 5xx o 403/404/otro 4xx inesperado, o error de red/conexión) → **502** `{data:null,error:'Upstream unavailable',status:502}`.
>   - `bad-response` (cuerpo que no es JSON o no pasa `UploadListSchema`) → **502** `{data:null,error:'Bad upstream response',status:502}`.
>   - Cualquier query string del cliente (`?userId=`, etc.) **se ignora**: no se reenvía ni cambia nada.
> - `src/handlers/health.ts`: `GET /health` → 200 como en los otros servicios.
> - **Logs:** solo marcas del tipo `[history] upstream timeout` / `[history] upstream error status=<n>`. **Nunca** el JWT, el `userId`, la URL con datos, ni el cuerpo.
> - `Dockerfile` (mismo patrón de dos etapas que identity; construye `shared-types`, `auth-middleware` y `progress-service`; `EXPOSE 3400`; **sin** `mkdir /app/data`; sin SQLite).
>
> **`k8s/progress/`** (nuevo): `configmap.yaml` (`PORT: '3400'`, `NODE_ENV: 'production'`, `INGESTION_URL: 'http://ingestion-service:3200'`, `INGESTION_TIMEOUT_MS: '5000'`), `deployment.yaml` y `service.yaml` (ClusterIP 3400). El Deployment: `image: progress-service:u5-T02` (tag explícito), `imagePullPolicy: Never`, `JWT_SECRET` por `secretKeyRef` → Secret **existente** `jwt-secret`/`JWT_SECRET` (sin `optional`), `readinessProbe` en `/health`, `resources` como identity, **sin volúmenes**, `strategy: RollingUpdate` (el servicio no tiene estado).
>
> **`package-lock.json`** (modificar): solo lo que `npm install` añada por el workspace nuevo. **Ningún paquete de registro nuevo** (ver CA-9).
>
> **Tests**: ver Plan de pruebas.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- Tendencias, regresión, `GET /api/trends`, gate de tier, llamada a identity (u6, u7). Cualquier cálculo sobre los scores: este endpoint **solo transmite**.
- Borrado de historial (u13), cliente de TrustService (C9), cualquier otra ruta.
- Paginación, filtros, caché, reintentos o _circuit breaker_ (un intento, un timeout).
- Token de servicio, `/internal`, Secret nuevo, BD, PVC, volumen.
- Cambiar ingestion, identity, trust, backend, `packages/*` (si hace falta algo de `shared-types`, el codificador **para** y lo registra con «atención»; `UploadListSchema` ya existe).
- Ingress, `configmap` de otros servicios, `jwt-secret` (no se crea ni se lee su valor).
- Actualizar `CANDIDATAS.md` o `contract-summary.md`.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/team.md` y `project.md` — reglas duras (Zod autoritativo, `{data,error,status}`, sin secretos, nunca `latest`, `/health` con readinessProbe, no duplicar tipos)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` — enrutado del Ingress (líneas ~20-26), C3 y C5 (**superado por HTTP**: léelo)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — definición de u5
- `bitacoras/u5-T01.md`, `revisiones/u5-T01/ronda-1.md` — qué devuelve ingestion y lecciones
- `packages/shared-types/src/uploads.ts` (`UploadListSchema`, `UploadList`), `packages/auth-middleware/src/` (`requireAuth`, `verify-token.ts`)
- `apps/identity-service/` (`Dockerfile`, `package.json`, `tsconfig.json`, `jest.config.js`, `src/server.ts`, `src/index.ts`, `src/handlers/health.ts`, `src/__tests__/`) — **molde**
- `apps/ingestion-service/src/handlers/uploads.ts` (el contrato de `GET /`), `src/__tests__/uploads-http.test.ts` (patrón de `makeJwt`)
- `k8s/identity/` (`deployment.yaml`, `configmap.yaml`, `service.yaml`) — molde de manifiestos; `k8s/ingestion/service.yaml` (host y puerto: `ingestion-service:3200`)
- `tareas/u5-T01-ingestion-list-endpoint.md` — molde de formato y del CA de despliegue
- `.dockerignore` (raíz)

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u5-T02` checada. En un worktree limpio hay que correr `npm ci` y compilar antes los packages:
`npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — El servicio compila, es un workspace y **reutiliza** el schema de `shared-types` sin redefinirlo.

  ```bash
  npm ls --workspaces 2>&1 | grep -E "progress-service"
  npx tsc --noEmit -p apps/progress-service 2>&1 | tail -3
  grep -rn "UploadListSchema" apps/progress-service/src | head -5
  ! grep -rnE "z\.object\(\{[^}]*(uploadId|scores)" apps/progress-service/src && echo "sin schemas duplicados"
  ```

  Esperado: aparece `progress-service`, `tsc` exit 0, `UploadListSchema` importado desde `@proyecto/shared-types`, imprime `sin schemas duplicados`.

- [ ] **CA-2** — Camino feliz: con un JWT válido, `GET /api/trends/history` devuelve **200** con **exactamente** los items que devolvió ingestion, **en el mismo orden**, y el body pasa `UploadListSchema.safeParse`. Un `low_confidence` conserva `scores: []` y `fallbackReason`.

  ```bash
  npm test -w apps/progress-service -- --testPathPattern=history --no-coverage --verbose 2>&1 | grep -E "(200|items|orden|UploadListSchema|low_confidence|vacío|sin reordenar)"
  ```

  Esperado: tests en verde. Se usa un **servidor HTTP real local** (`http.createServer` en puerto efímero) como «ingestion falso», no solo un `fetch` simulado; casos: 3 items `ready`, mezcla `ready`+`low_confidence`, y `items: []` (→ 200 con `items: []`).
  **Criterio de mutación:** si el handler reordena (`.reverse()`/`.sort()`) o filtra items, el test de orden debe **fallar**.

- [ ] **CA-3** — **El JWT se reenvía tal cual y nada más.** El servidor falso registra los headers recibidos: `Authorization` es **idéntico** al del cliente; **no** llegan `Cookie`, `X-Forwarded-*`, ni otras cabeceras del cliente; la ruta pedida es **exactamente** `/api/uploads` **sin query string** aunque el cliente mande `?userId=<otro>&limit=1`; el método es `GET` y no hay cuerpo.

  ```bash
  npm test -w apps/progress-service -- --testPathPattern=history --no-coverage --verbose 2>&1 | grep -E "(Authorization|reenv|Cookie|query|userId|sin query|cabeceras)"
  ```

  Esperado: tests en verde.
  **Criterio de mutación (lo ejecuta el revisor):** si se cambia el cliente para reenviar `req.url`/`req.query`, o para añadir `userId` a la URL, o para copiar todas las cabeceras, el test correspondiente debe **fallar por la aserción**.

- [ ] **CA-4** — Autenticación en el servicio: sin JWT → `401 {data:null,error:"unauthenticated",status:401}`; JWT mal firmado y JWT expirado → 401; **en esos casos ingestion NO recibe ninguna petición** (contador del servidor falso en 0).

  ```bash
  npm test -w apps/progress-service -- --testPathPattern="(history|server|health)" --no-coverage --verbose 2>&1 | grep -E "(401|unauthenticated|expirado|mal firmado|0 peticiones|no llama|health)"
  ```

  Esperado: tests en verde; `/health` sigue público y `GET /api/trends/history` es la única ruta de datos.

- [ ] **CA-5** — Mapeo de errores aguas arriba, con cuerpo **exacto** y sin filtrar detalles: ingestion responde 401 → **401**; 500/503 → **502 `Upstream unavailable`**; 403/404 inesperados → **502**; conexión rechazada (puerto cerrado) → **502**; lento más que el timeout → **504 `Upstream timeout`**; cuerpo no JSON, JSON con campo requerido faltante o de tipo/enum inválido, o `status` distinto de 200 → **502 `Bad upstream response`**; una **redirección** (301/302/307) de ingestion, a otro host o al mismo origen → **502 `Upstream unavailable`** y **ninguna petición llega al destino de la redirección**.

  ```bash
  npm test -w apps/progress-service -- --testPathPattern="(history|ingestion-client)" --no-coverage --verbose 2>&1 | grep -E "(502|504|Upstream|Bad upstream|timeout|rechazad|no JSON|campo)"
  ```

  Esperado: tests en verde, cada uno afirmando **código y body completo**, y que el body de error **no contiene** el cuerpo de ingestion, su URL, ni el JWT. El timeout se prueba con `deps.timeoutMs` pequeño (p. ej. 50 ms) contra un servidor que tarda más, **sin `sleep` largos** (la suite completa < 15 s).

  **Fix de especificación (ronda 1, arbitrado por el orquestador).** Mi redacción original pedía a la vez «`UploadListSchema` no se redefine» y «502 por campo de más»: se contradicen. Se decide: **un campo de más (en un item o en el envoltorio) se DESCARTA sin error** (lo hace el schema; es lo más seguro porque no deja pasar campos internos): el handler responde **200** y el body **no contiene** el campo. El caso «campo de más» pasa de «502» a «200 sin el campo» y debe tener su test (parte de una respuesta válida y añade `userId` de ingestion en un item y otro campo en el envoltorio). Se **mantiene** el 502 para campo requerido faltante o de tipo/enum inválido. Además, por los hallazgos de la ronda 1:
  - **Redirecciones (F-02):** el cliente llama a `fetch` con `redirect: 'error'` (o `'manual'`) y trata el resultado como `upstream` (502). Test con un 302 a otro host y a otro path del mismo origen, afirmando 502 **y 0 peticiones al destino**. La única salida de red del servicio es hacia `INGESTION_URL` (AC-4.2).
  - **Logs (F-03):** el espía de `console` se aplica a **todos** los casos de CA-5 **y también al camino 200**; ninguna llamada contiene el JWT, el `userId`, un `uploadId` ni el cuerpo de ingestion. Criterio de mutación: añadir un `console.log` con `userId` o con los items en el camino 200 debe **hacer fallar** el test.
  - **Timeout por entorno (F-04):** `INGESTION_TIMEOUT_MS` se prueba por su **efecto**: con la variable en `50` y un ingestion falso lento → **504**; el test restaura la variable en `afterEach` aunque falle. Criterio de mutación: si se ignora la variable y se usa siempre el valor por defecto, ese test debe **fallar**.
  - **Marca de log (F-05):** `[history] upstream error status=<n>` cuando ingestion respondió un status; `[history] upstream error` solo si no hubo respuesta (red). El cliente propaga el status en su resultado.
  - **`isTimeout` (F-07):** se restringe a `TimeoutError` (la única señal que existe es `AbortSignal.timeout`) o se documenta en un comentario por qué `AbortError` también cuenta.
  - **Dockerfile (F-06):** se **quita** `python3 make g++` de la etapa builder **solo si** el `docker build` y el smoke de CA-13 siguen pasando (el lockfile lista workspaces con SQLite; si `npm ci` lo exige, se deja y se **registra por qué** en la bitácora con «atención»). El usuario no-root y `--omit=dev` quedan **fuera** (C-45: afecta a todos los servicios).

- [ ] **CA-6** — **Los errores no escapan como excepciones ni cuelgan al cliente**, y los logs no filtran datos: un espía sobre `console.log/warn/error` afirma que, en todos los casos de CA-5, **ninguna** llamada contiene el JWT, el `userId` del token, un `uploadId` ni el cuerpo de ingestion.

  ```bash
  npm test -w apps/progress-service -- --testPathPattern="(history|ingestion-client)" --no-coverage --verbose 2>&1 | grep -E "(log|console|filtra|leak|no expone|nunca lanza|no lanza)"
  ```

  Esperado: tests en verde; un test afirma que `fetchUploadList` **nunca lanza** (todas las rutas devuelven un resultado discriminado).

- [ ] **CA-7** — `INGESTION_URL` es obligatoria: `createApp` **lanza** si falta (y no se inyectó), con mensaje que nombra la variable y **sin** valores.

  ```bash
  npm test -w apps/progress-service -- --testPathPattern=server --no-coverage --verbose 2>&1 | grep -E "(INGESTION_URL|lanza|throws|obligatori)"
  ```

  Esperado: test en verde.

- [ ] **CA-8** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches.

  ```bash
  npm test -w apps/progress-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -10
  cat apps/progress-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok progress-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok progress-service service/ + handlers/`.

- [ ] **CA-9** — **Sin dependencias nuevas de terceros.** El lockfile solo gana el workspace nuevo; no entra ningún paquete de registro que no estuviera ya.

  ```bash
  git diff main...HEAD -- package-lock.json | grep -E '^\+' | grep -E '"resolved"' | grep -v '"resolved": "apps/' && echo "FAIL: paquete de registro nuevo en el lockfile" && exit 1 || echo "sin paquetes nuevos en el lockfile"
  node -e 'const a=require("./apps/progress-service/package.json");const i=require("./apps/identity-service/package.json");const known={...i.dependencies,...i.devDependencies,"@proyecto/shared-types":"*"};for(const[k,v]of Object.entries({...a.dependencies,...a.devDependencies})){if(!(k in known))throw new Error("dependencia que identity no usa: "+k);if(known[k]!==v)throw new Error("versión distinta de "+k+": "+v+" vs "+known[k])}console.log("dependencias solo conocidas, mismas versiones")'
  npm ls better-sqlite3 -w apps/progress-service 2>&1 | grep -E "better-sqlite3" && echo "FAIL: SQLite en progress" && exit 1 || echo "sin SQLite"
  ```

  (Fix de especificación, ronda 1: npm registra el propio workspace como enlace, `"resolved": "apps/progress-service"`; ese enlace no es un paquete de registro y se excluye.) Esperado: imprime `sin paquetes nuevos en el lockfile`, `dependencias solo conocidas, mismas versiones` y `sin SQLite`.

- [ ] **CA-10** — Lint y Prettier pasan (sin caché de turbo) y turbo ve el workspace nuevo.

  ```bash
  npx turbo run lint --force 2>&1 | tail -10
  npx turbo run build --force --filter=progress-service 2>&1 | tail -6
  npx prettier --check apps/progress-service k8s/progress tareas/u5-T02-progress-service-history.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores (7 tareas de lint, o las que correspondan con el workspace nuevo), build exit 0; Prettier sin archivos pendientes.

- [ ] **CA-11** — Regresiones: nada de lo existente cambia.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -6
  npm test -w apps/identity-service -- --no-coverage 2>&1 | tail -6
  npm test -w apps/trust-service -- --no-coverage 2>&1 | tail -6
  npm test -w apps/backend -- --no-coverage 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -E "^(apps/(ingestion|identity|trust)-service/|apps/backend/|packages/)" && echo "FAIL: scope creep" && exit 1 || echo "sin cambios en otros servicios ni packages"
  ```

  Esperado: todas en verde y `sin cambios en otros servicios ni packages`.

- [ ] **CA-12** — Manifiestos: tag explícito (`progress-service:u5-T02`, sin `latest`), `imagePullPolicy: Never`, `JWT_SECRET` solo por `secretKeyRef` (`jwt-secret`/`JWT_SECRET`, **sin `optional`**), `readinessProbe` en `/health`, **sin volúmenes** ni `PVC`, `INGESTION_URL` apunta al Service de ingestion; ningún secreto en claro.

  ```bash
  grep -E "image: progress-service:u5-T02" k8s/progress/deployment.yaml
  ! grep -E "image: .*:latest" k8s/progress/deployment.yaml && echo "no latest"
  grep -E "imagePullPolicy: Never" k8s/progress/deployment.yaml
  node -e 'const t=require("fs").readFileSync("k8s/progress/deployment.yaml","utf8");const i=t.indexOf("name: JWT_SECRET");const blk=t.slice(i,i+260);if(!/secretKeyRef/.test(blk)||!/name: jwt-secret/.test(blk)||!/key: JWT_SECRET/.test(blk))throw new Error("secretKeyRef mal");if(/optional/.test(blk))throw new Error("optional presente");console.log("JWT_SECRET: secretKeyRef ok, no optional")'
  grep -nE "readinessProbe|path: /health|port: 3400" k8s/progress/deployment.yaml
  ! grep -nE "volumes:|persistentVolumeClaim|emptyDir|volumeMounts" k8s/progress/deployment.yaml && echo "sin volúmenes"
  grep -n "INGESTION_URL" k8s/progress/configmap.yaml
  grep -nE "port: 3400|name: progress-service" k8s/progress/service.yaml
  ```

  Esperado: nuevo tag, `no latest`, `Never`, `JWT_SECRET: secretKeyRef ok, no optional`, readiness en `/health` puerto 3400, `sin volúmenes`, `INGESTION_URL` con `http://ingestion-service:3200`, Service en 3400.

- [ ] **CA-13** — Imagen `progress-service:u5-T02` construida; sin `latest`; y **arranca** (smoke local sin cluster).

  ```bash
  docker build -f apps/progress-service/Dockerfile -t progress-service:u5-T02 . 2>&1 | tail -15
  docker image inspect progress-service:u5-T02 --format '{{.Id}}' | head -1
  ! docker image inspect progress-service:latest 2>/dev/null | grep -qE '"RepoTags".*latest' && echo "no latest tag"
  SMOKE_SECRET=$(openssl rand -hex 16)
  docker run --rm -e INGESTION_URL=http://localhost:1 -e "JWT_SECRET=${SMOKE_SECRET}" -p 3499:3400 -d --name ps-smoke-u5t02 progress-service:u5-T02
  sleep 3; curl -s -w " %{http_code}\n" http://localhost:3499/health; docker rm -f ps-smoke-u5t02
  ```

  Esperado: build exit 0, imagen inspeccionable, `no latest tag`, `/health` responde `200`, el contenedor de prueba se elimina al terminar. (El `JWT_SECRET` del smoke se genera al vuelo, es desechable y **no** es el del cluster; no lo escribas en la bitácora.)

- [ ] **CA-14** — **En kind, de punta a punta** (solo con autorización del humano para esta tarea). Se despliega el servicio nuevo y se verifica con `curl` real y lectura de vuelta con `kubectl`: el historial que sirve ProgressService es **idéntico** al que sirve ingestion, está aislado por usuario y exige JWT.
      Usa un directorio propio del scratchpad (`$WORK`) (C-38); no imprimas JWT en la bitácora; emails únicos.

  ```bash
  kubectl get secret jwt-secret -o jsonpath='{.metadata.name}{"\n"}'                       # solo existencia; NO leer el valor
  kind load docker-image progress-service:u5-T02
  kubectl apply -f k8s/progress/
  kubectl rollout status deployment/progress-service --timeout=180s
  kubectl get deployment progress-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get pods -l app=progress-service -o jsonpath='{.items[0].status.containerStatuses[0].ready}{"\n"}'
  kubectl get svc progress-service -o jsonpath='{.spec.ports[0].port}{"\n"}'
  # port-forward en segundo plano: progress 3400, ingestion 3200, identity 3100. Registrar DOS usuarios con emails únicos.
  # Usuario A: dos POST (JPEG) a ingestion. Usuario B: un POST. Luego:
  curl -s http://localhost:3200/api/uploads -H "Authorization: Bearer $JWT_A" > $WORK/ing-A.json
  curl -s -w " %{http_code}\n" http://localhost:3400/api/trends/history -H "Authorization: Bearer $JWT_A" | tee $WORK/prog-A.json
  node -e 'const a=require(process.argv[1]),b=require(process.argv[2]);const same=JSON.stringify(a.data.items)===JSON.stringify(b.data.items);console.log("items idénticos:",same,"n="+b.data.items.length);process.exit(same?0:1)' $WORK/ing-A.json $WORK/prog-A.json
  curl -s -w " %{http_code}\n" http://localhost:3400/api/trends/history -H "Authorization: Bearer $JWT_B"                         # 200, SOLO el item de B
  curl -s -w " %{http_code}\n" "http://localhost:3400/api/trends/history?userId=$ID_A" -H "Authorization: Bearer $JWT_B"          # 200, SOLO el item de B
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3400/api/trends/history                                               # 401
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3400/api/trends/history -H "Authorization: Bearer basura"             # 401
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3400/health                                                           # 200
  kubectl logs deploy/progress-service | grep -ci "bearer"                                                                        # 0
  kubectl logs deploy/progress-service | grep -cE "$ID_A|$UPLOAD_ID"                                                              # 0
  ```

  Esperado: Secret `jwt-secret` existe (valor no mostrado); imagen `progress-service:u5-T02 RollingUpdate`; pod `true`; Service puerto `3400`; **`items idénticos: true n=2`** (orden descendente); `200` para B con **1** item aunque mande `?userId=`; `401` sin token y con token basura; `/health` `200`; `0` líneas con `bearer` y `0` con ids en los logs.
  Cerrar los port-forward al terminar (el PID 4456 es del humano: no lo toques). El **solo** `kubectl apply` permitido es `-f k8s/progress/`. **No** escales ni reinicies ingestion (los casos 502/504 se prueban en tests con el servidor falso).

  **Fix de especificación (ronda 2, error del orquestador): CA-14 se parte en dos.** Mezclaba el despliegue con el E2E de usuarios, que son autorizaciones distintas.
  - **CA-14a (codificador, autorizado por el humano para progress-service):** de `kubectl get secret` a `kubectl get svc`, más la lectura de vuelta de imagen (config digest de `docker save` == `crictl inspecti` en `kind-control-plane` == `imageRef` del pod, y `imageID` distinto del de la ronda 1), `/health` `200`, `401` sin token y con token basura, y `grep -ci bearer` de los logs `0`. No requiere usuarios.
  - **CA-14b (revisor o humano, solo con autorización de port-forward a identity y registro de usuarios `*.test`):** las líneas que usan `$JWT_A`, `$JWT_B` y `$ID_A` (`items idénticos: true n=2`, aislamiento de B, `?userId=` ignorado, `0` ids en los logs). Si el sistema deniega el permiso, se reporta como **no verificable** y no se esquiva.

- [ ] **CA-15** — Sin secretos en el diff ni en el árbol.

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || true
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`. El secreto de los **tests** es una constante evidentemente falsa (p. ej. `'a-test-secret-for-tests-only'`, como en ingestion); no cites literales con forma de clave en bitácoras ni comentarios.

- [ ] **CA-16** — Scope respetado (`main...HEAD`, tres puntos).

  ```bash
  git diff main...HEAD --name-only | grep -vE "^(apps/progress-service/|k8s/progress/|package-lock\.json$|bitacoras/u5-T02\.md$)" && echo "FAIL: archivo fuera de alcance" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected`. (`tareas/u5-T02-progress-service-history.md` ya está en `main`.) Si `package.json` raíz o `turbo.json` necesitaran cambios, el codificador **para** y lo registra con «atención».

- [ ] **CA-17** — Rama `tarea/u5-T02` sobre `main` con ≥ 3 commits legibles (p. ej. cliente, handler+servidor, Dockerfile+manifiestos+bitácora), sin `git commit -a`.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  git show --stat --format=%s HEAD | head -10
  ```

  Esperado: rama `tarea/u5-T02`, al menos 3 commits, cada uno solo con los archivos de su mensaje.

---

## Plan de pruebas

**Rojo primero (de ejecución, no de compilación — Lección 13):** crea los **archivos y exports mínimos** (`fetchUploadList` que devuelve un error fijo, el handler que responde 501) para que todo compile, y escribe: (a) «200 con los mismos items y el mismo orden que ingestion», (b) «el `Authorization` llega idéntico y sin query», (c) «ingestion 500 → 502 `Upstream unavailable`», (d) «sin JWT → 401 y ingestion recibe 0 peticiones». Córrelos: deben **fallar por la aserción**, no por import o tipos. Registra la salida roja en la bitácora y luego pásalos a verde.

- `ingestion-client.test.ts` (nuevo): el cliente contra un servidor HTTP efímero real; todos los resultados discriminados; **nunca lanza**; timeout con `timeoutMs` pequeño.
- `history.test.ts` (nuevo, con `supertest` sobre `createApp({ ingestionUrl, timeoutMs })`): CA-2 a CA-6 con `makeJwt` (como en ingestion: el `JWT_SECRET` de pruebas se fija en el test) y un «ingestion falso» configurable por caso (200 válido, 401, 403, 404, 500, cuerpo basura, JSON incompleto, lento, puerto cerrado).
- `server.test.ts` (nuevo): CA-7, `/health` público, 404 de rutas desconocidas.
- **Sondas propias, no solo el body (Lección 12):** el servidor falso cuenta peticiones y guarda cabeceras y ruta; un espía sobre `console` para los logs. En 401 el contador debe ser 0.
- **Casos inválidos con entradas realmente válidas salvo en la propiedad probada (Lección 16):** el caso «item con campo de más/menos» parte de una respuesta válida y cambia **una** propiedad; el de «query ignorada» manda un `?userId=` real de otro usuario.
- Sin `sleep` largos: la suite entera debe correr en pocos segundos.

---

## Notas

- **Por qué no `/api/history`:** el contrato enruta ese prefijo a TrustService (borrado, u13). `/api/trends/history` queda bajo el prefijo de ProgressService y u6 colgará `GET /api/trends` del mismo router.
- **Por qué reenviar el JWT:** u5–u7 solo se disparan por una petición de usuario, así que el token basta y el aislamiento lo impone ingestion (`req.user.userId`). ProgressService **no** interpreta el `userId` ni lo pone en ninguna URL.
- **Por qué `requireAuth` también aquí:** rechaza lo no autenticado **antes** de llamar a ingestion (sin tráfico inútil) y comparte `JWT_SECRET` con identity/ingestion.
- **Qué no se promete:** sin paginación (C-40) ni tope: si ingestion devuelve miles de items, ProgressService los transmite. El listado de ingestion no incluye `thumbnailUrl` ni `feedback`; para eso está `GET /api/uploads/:id`.
- **Despliegue:** `RollingUpdate` está bien: el servicio no tiene estado. Si `rollout status` se atasca (p. ej. `CreateContainerConfigError`, casi seguro falta `jwt-secret`), repórtalo en la bitácora con `kubectl describe pod` y **para**; no crees el Secret.
- Archivos **nuevos**: todo bajo `apps/progress-service/` y `k8s/progress/`. Se modifica **solo** `package-lock.json` por el workspace. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. `kind load` y `kubectl apply -f k8s/progress/` solo en CA-14 y solo con autorización. No toques ingestion, identity, trust ni backend.
- **Bitácora:** `bitacoras/u5-T02.md` con: hash de la tarea, salida roja inicial, decisiones de estructura (cliente discriminado, dónde se valida), lo verificado en kind (comandos y salidas de CA-14), qué queda para u6/u7 y respuestas a hallazgos del revisor por identificador. **Registra cada `docker build`, `kind load` y `apply` con su salida.** Usa `git add <rutas>` explícitas y un subdirectorio propio del scratchpad.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u5-T02`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u5-T02`. Imagen Docker: `progress-service:u5-T02`
(tag explícito, nunca `:latest`). Destino K8s: cluster local kind.
Pertenece a la **ola 7** (en paralelo con u5-T03: ficheros disjuntos; u6 espera a ambas)._
