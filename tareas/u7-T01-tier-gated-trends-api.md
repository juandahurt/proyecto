# u7-T01 — API de tendencias con puerta de tier (`GET /api/trends`) y arranque con configuración validada

**Unidad:** u7 — tier-api (ProgressService)
**Historias que implementa:** US-7 (AC-7.1, AC-7.2), con FR-7 y la parte de interfaz de AC-6.2 (`uploadsNeeded`).
**Depende de:** u6-T01 (motor de tendencias), u10-T01 (tier `paid` en identity) y u14-T01 (persistencia de identity). Las tres fusionadas en `main`.

**Decisiones del humano:** u7 se redacta y se despacha con su visto bueno (ola 10). Los permisos de cluster **no se heredan**: el orquestador los pide aparte, con lista exacta, antes de despachar (ver Notas).

**Decisiones de diseño del orquestador** (no estaban en la unidad; el humano puede objetarlas):

1. **El tier se obtiene de `GET /api/users/me/limits` de identity, reenviando solo `Authorization`. No se crea el endpoint interno C6.** C6 (`GET /api/internal/users/{userId}/tier`) no existe y exigiría tocar identity: imagen nueva, reinicio con ~41 s de corte (C-60) y una ruta **sin autenticación** que revela el tier de cualquier `userId` a cualquier pod (no hay `NetworkPolicy`). `/me/limits` ya existe, ya devuelve el tier real (u10) y se valida con `LimitsResponseSchema` de `shared-types`. Es el mismo razonamiento por el que C5 quedó superado; el orquestador anota «C6 superado» en `contract-summary.md`. Consecuencia: **identity no se toca ni se reinicia en esta tarea.**
2. **Si identity no responde, no se devuelve ningún dato de tendencia, ni `locked`.** El handoff proponía «fail-closed: `locked`», pero eso le diría a un usuario `paid` que está bloqueado, información falsa. Se responde con error y sin cuerpo de datos: identity `401` → `401`; timeout → `504`; cualquier otro fallo (red, 5xx, redirección, cuerpo inválido, `tier` fuera de `free|paid`) → `502`. Nunca se asume `paid` ni `free`. Mismo patrón y mensajes que `/api/trends/history`.
3. **La respuesta sigue el contrato C3 (`TrendResponse`), no `CategoryTrendCalcSchema.extend({locked})`.** C3 define `categoryName`, `status` (`locked | insufficient_data | improving | stagnating | worsening`) y `trend: { direction, scoreHistory[] }`. Se construye **a partir de** `CategoryTrendCalcSchema` (u6). Añade un campo opcional **`uploadsNeeded`** (solo con `insufficient_data`), que C3 no tenía y que la interfaz necesita para AC-6.2 («faltan N uploads»). `slope` **no** se expone.
4. **La puerta es de datos, no de presentación.** Con tier `free`, toda categoría cuyo cálculo sea `improving`, `stagnating` o `worsening` sale como `locked` **sin `trend`** (también `stagnating`: revelaría la dirección). `insufficient_data` se queda como está (no hay tendencia que bloquear). Con `paid` se devuelve todo.
5. **Sin caché ni snapshot: cada petición llama a identity y a ingestion** (C3/C4). Si algún día se añade caché, se reabre C-55.
6. **Identity se consulta primero y ante fallo no se llama a ingestion.** Evita trabajo inútil y hace trivial «sin datos parciales».
7. **C-56:** `createApp` carga `loadTrendConfig(process.env)` al arrancar (falla rápido si es inválida) y exige `IDENTITY_URL`. Sin esto, los `TREND_*` serían configuración muerta.

---

## Alcance

**Dentro** (una línea, concreta):

> Un esquema Zod `TrendResponse` (C3) en `shared-types`, un cliente de identity que lee el tier, una función pura que arma la respuesta aplicando la puerta de tier, la ruta `GET /api/trends` detrás de `requireAuth`, la carga de configuración de tendencias y de `IDENTITY_URL` al arrancar, y el despliegue de progress-service en kind con un tag nuevo.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Cualquier cambio en identity, ingestion, trust o backend**, incluido el endpoint C6 (`/api/internal/users/:userId/tier`). No se construye ni se reinicia ninguna de esas imágenes.
- Caché, snapshot, tabla o cualquier persistencia en progress-service; endpoint de borrado C9 y todo lo de u13.
- Paginación o tope del listado (C-40, C-44).
- Cambiar `ingestion-client.ts`, `trend-calculator.ts`, `trend-config.ts`, `trend-service.ts` ni `handlers/history.ts` (se reutilizan tal cual; si algo no encaja, se anota como ATENCIÓN en la bitácora, no se modifica).
- Ingress, `NetworkPolicy`, Secrets nuevos y cualquier manifiesto fuera de `k8s/progress/`.
- Texto de interfaz («Upgrade to see your trends», «Not enough data yet…»): es del frontend (u0). Aquí solo se devuelven datos.
- Exponer `slope` o `qualifiedCount` al cliente.
- Endurecer tests de u5 o u6 (C-50, C-58) y dependencias nuevas.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` (C3 `TrendResponse`, C6 y su sección «superado»)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-7: AC-7.1, AC-7.2; US-6: AC-6.2)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` (u7)
- `packages/shared-types/src/trends.ts` (`CategoryTrendCalcSchema`, `TrendDirectionSchema`, `TrendPointSchema`), `limits.ts` (`LimitsResponseSchema`) y `anthropic.ts` (`CategoryIdSchema`, `CategoryNameSchema`)
- `apps/progress-service/src/service/ingestion-client.ts` (molde del cliente HTTP: `redirect: 'error'`, `AbortSignal.timeout`, resultado discriminado, nunca lanza)
- `apps/progress-service/src/service/trend-service.ts`, `trend-config.ts`, `trend-calculator.ts`
- `apps/progress-service/src/handlers/history.ts` (molde del handler y de los mensajes de error) y `server.ts`
- `apps/progress-service/src/__tests__/fake-ingestion.ts` (molde del servidor falso), `history.test.ts` y `server.test.ts`
- `apps/identity-service/src/handlers/limits.ts` (forma real de la respuesta de `/api/users/me/limits`)
- `k8s/progress/configmap.yaml` y `k8s/progress/deployment.yaml`
- `tareas/u6-T01-trend-calculation.md` (molde de servicio) y `tareas/u14-T01-pvc-identity-trust.md` (molde de CA de infraestructura, con su bloque «Fix de especificación»)
- `aidlc/spaces/default/memory/project.md` (Zod autoritativo, `shared-types` única fuente, cobertura)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los va a correr él mismo, uno por uno. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `-w packages/auth-middleware`, y **otra vez `shared-types` tras tocarlo**.

- [ ] **CA-1** — Esquema `TrendResponse` (C3) derivado de Zod, sin enums duplicados.

  ```bash
  git diff main...HEAD --name-only -- packages/shared-types
  grep -nE "TrendResponseSchema|CategoryTrendSchema|export type .* = z\.infer" packages/shared-types/src/trends.ts
  grep -rlPz "z\.enum\(\[[^\]]*'locked'" apps packages --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist | grep -v "packages/shared-types/src/trends.ts" || echo "sin enums duplicados"
  npx tsc --noEmit -p packages/shared-types && echo "tsc shared-types ok"
  ```

  Esperado: el diff lista solo `packages/shared-types/src/trends.ts` (y `index.ts` solo si hace falta reexportar); el `grep` muestra los schemas Zod y los tipos con `z.infer<>`; `sin enums duplicados` (el `-Pz` ve enums de varias líneas, C-59); `tsc shared-types ok`. Forma: `{ data: { tier: 'free'|'paid', categories: CategoryTrend[] }, error: null, status: 200 }`; `CategoryTrend` = `categoryId` (`CAT-1..5`), `categoryName` (`CategoryNameSchema`), `status` (`locked|insufficient_data|improving|stagnating|worsening`), `uploadsNeeded` opcional (entero ≥ 0, solo con `insufficient_data`), `trend` opcional `{ direction: 'improving'|'stagnating'|'worsening', scoreHistory: { uploadId, score, timestamp }[] }`. Un `refine` exige: `trend` presente **si y solo si** `status` es `improving|stagnating|worsening` y `trend.direction === status`; `locked` e `insufficient_data` **sin** `trend`; `uploadsNeeded` ausente salvo en `insufficient_data`. El mapa `CAT-n → categoryName` también vive aquí, tipado con `z.infer`, no en el servicio.

- [ ] **CA-2** — Puerta de tier: con `free`, ningún dato de tendencia sale del servicio (AC-7.1).

  ```bash
  npm test -w apps/progress-service -- trend-response trends --coverage=false --verbose 2>&1 | grep -iE "free|locked|AC-7.1|direcci|puerta"
  ```

  Esperado: contra el servidor falso, usuario `free` con 6 uploads calificados (tendencias `improving`, `stagnating` y `worsening` repartidas entre categorías) → las 5 categorías con `status: 'locked'`, **sin `trend`**, sin `uploadsNeeded`; y el **cuerpo serializado completo** no contiene las cadenas `improving`, `stagnating`, `worsening`, `scoreHistory`, `slope` ni ningún `score` o `uploadId` del historial. Una categoría con `insufficient_data` en `free` sale `insufficient_data` con su `uploadsNeeded`. **Mutación observable** (el revisor la hace en una copia): quitar la rama de bloqueo (devolver el resultado del cálculo tal cual para `free`) **hace fallar** esos tests.

- [ ] **CA-3** — Con `paid` sale todo, en el formato C3 (AC-7.2).

  ```bash
  npm test -w apps/progress-service -- trend-response trends --coverage=false --verbose 2>&1 | grep -iE "paid|AC-7.2|scoreHistory|categoryName|uploadsNeeded"
  ```

  Esperado: `tier: 'paid'`; las 5 categorías en orden `CAT-1..CAT-5` con su `categoryName` (`Composition`, `Proportions`, `Line Quality`, `Values (Shading)`, `Perspective`); las que tienen tendencia traen `trend.direction === status` y `scoreHistory` **cronológico (más antiguo primero)** con los puntos exactos del cálculo; las `insufficient_data` traen `uploadsNeeded` y no `trend`; el cuerpo valida contra `TrendResponseSchema`; `slope` no aparece. Valores comprobados **por valor**, no solo «no lanza».

- [ ] **CA-4** — El tier se consulta en **cada** petición y sin caché (C3/C4).

  ```bash
  npm test -w apps/progress-service -- trends --coverage=false --verbose 2>&1 | grep -iE "cada petici|sin cach|cambia de tier|contador"
  ```

  Esperado: el servidor falso de identity cuenta peticiones: tres `GET /api/trends` seguidos → **3** llamadas a identity y **3** a ingestion; si entre dos peticiones el falso cambia de `free` a `paid`, la segunda respuesta ya trae `trend`. **Mutación observable:** memorizar el tier (módulo, `Map` o variable) **hace fallar** el test de cambio de tier.

- [ ] **CA-5** — Solo `Authorization` hacia ambos upstreams; nunca el `userId`; sin seguir redirecciones.

  ```bash
  npm test -w apps/progress-service -- identity-client trends --coverage=false --verbose 2>&1 | grep -iE "Authorization|header|redirec|userId|ruta"
  ```

  Esperado: la petición a identity es `GET /api/users/me/limits` con el `Authorization` idéntico al recibido y **ningún otro header del cliente** (ni `Cookie`, ni `X-Forwarded-*`); lo mismo hacia ingestion; el `userId` no aparece en ninguna URL, query ni header de salida (un `?userId=` del cliente se ignora); una respuesta `3xx` de identity se trata como error de upstream (`redirect: 'error'`, el falso registra que no hubo segunda petición). **AC-4.2:** no hay otra salida de red.

- [ ] **CA-6** — Fallos de identity: sin datos y sin llamar a ingestion (decisión 2 y 6).

  ```bash
  npm test -w apps/progress-service -- identity-client trends --coverage=false --verbose 2>&1 | grep -iE "identity|502|504|401|fail|sin datos"
  ```

  Esperado: identity `401` → `401 {data:null,error:'unauthenticated',status:401}`; timeout → `504` `Upstream timeout`; `500`/`503`, conexión rechazada, redirección, cuerpo no JSON, cuerpo que no valida `LimitsResponseSchema` y `tier` distinto de `free|paid` → `502`. En **todos**: el cuerpo no trae `tier` ni `categories`, y el contador de peticiones del falso de ingestion es `0`. Con identity `paid` y fallo de ingestion (`401`, `5xx`, red, timeout, cuerpo inválido) → los mismos códigos que `/api/trends/history`, sin `categories` parciales. **Mutación observable:** usar `'free'` o `'paid'` como valor por defecto ante error **hace fallar** el test.

- [ ] **CA-7** — Autenticación: sin JWT válido no se hace ninguna llamada de salida.

  ```bash
  npm test -w apps/progress-service -- trends --coverage=false --verbose 2>&1 | grep -iE "sin token|basura|401|no llama"
  ```

  Esperado: sin `Authorization` y con token basura → `401`, y los contadores de peticiones de **ambos** falsos en `0` (el test mira el contador, no solo el body — Lección 12).

- [ ] **CA-8** — C-56: `createApp` carga la configuración de tendencias y falla al arrancar si es inválida; `IDENTITY_URL` es obligatoria.

  ```bash
  npm test -w apps/progress-service -- server --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -n "loadTrendConfig" apps/progress-service/src/server.ts
  ```

  Esperado: pruebas de que `createApp` lanza con mensaje que **nombra la variable** (sin eco de valores) cuando `TREND_MIN_UPLOADS`, `TREND_SLOPE_IMPROVING` o `TREND_SLOPE_WORSENING` son inválidas y cuando falta `IDENTITY_URL`; con `TREND_MIN_UPLOADS=2` en el entorno, 2 uploads calificados ya dan tendencia (se prueba **por su efecto** a través de `GET /api/trends`); el `grep` muestra la llamada `loadTrendConfig(process.env)` en `server.ts`. **Mutación observable:** borrar esa llamada **hace fallar** el test de arranque fallido y el del efecto de `TREND_MIN_UPLOADS`. `IDENTITY_TIMEOUT_MS` sigue el patrón de `INGESTION_TIMEOUT_MS` (valor por defecto 5000, inválido → por defecto) y se prueba **por su efecto** (un identity lento con el valor en 50 → `504`).

- [ ] **CA-9** — Los logs no contienen credenciales, ids ni datos de tendencia.

  ```bash
  npm test -w apps/progress-service -- trends identity-client --coverage=false --verbose 2>&1 | grep -iE "log|consola|silencio|bearer"
  ```

  Esperado: un test espía `console.log`, `info`, `warn`, `error`, `debug` y `process.stdout.write` en el camino feliz (`free` y `paid`) y en cada fallo de CA-6, y afirma que **ningún** mensaje contiene el JWT, `Bearer`, el `userId`, ningún `uploadId`, ningún `score` del historial ni las cadenas `improving|stagnating|worsening`. Los mensajes de fallo siguen el estilo de `history.ts` (`[trends] upstream timeout`). **Mutación observable:** añadir `console.info(userId)` en el handler **hace fallar** el test.

- [ ] **CA-10** — Rutas: solo se añade `GET /api/trends`; los tests existentes siguen verdes, sin tocarse salvo lo indicado.

  ```bash
  grep -nE "app\.(get|post|put|delete|use)\(" apps/progress-service/src/server.ts
  git diff main...HEAD --name-only -- apps/progress-service/src/service/ingestion-client.ts apps/progress-service/src/service/trend-calculator.ts apps/progress-service/src/service/trend-config.ts apps/progress-service/src/service/trend-service.ts apps/progress-service/src/handlers/history.ts | wc -l
  npm test -w apps/progress-service -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  ```

  Esperado: `/health`, `/api/trends/history`, `/api/trends` y el 404; el `wc -l` da `0`; la suite entera pasa (los 91 de `main` más los nuevos) con `Test Suites:` **sin fallidas** (C-57), sin omitidos ni `todo`. **Único cambio permitido en un test existente:** en `server.test.ts`, la aserción de que `GET /api/trends` da `404` (hoy es `res2`) deja de ser cierta; se sustituye por otra ruta inexistente (p. ej. `/api/trends/otra`) y se dice en la bitácora. Los `createApp({ ingestionUrl })` de `history.test.ts` y `server.test.ts` ahora necesitan `identityUrl`: se añade en su sitio, sin cambiar lo que afirman.

- [ ] **CA-11** — Regresiones, lint, build y formato.

  ```bash
  npm test -w apps/ingestion-service 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/identity-service 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/trust-service 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/backend 2>&1 | grep -E "Tests:|Test Suites:"
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | xargs npx prettier --check
  ```

  Esperado: cada servicio con los mismos tests y suites que en `main` (compara contra `main`; al redactar: ingestion 206, identity 74, trust 25, backend 18); `turbo` termina con `Failed: 0` y `0 cached`; prettier limpio sobre el diff. (`prettier --check .` global falla en `main` por C-51 y no cuenta.)

- [ ] **CA-12** — Cobertura de progress-service sobre los pisos (≥ 80 % líneas globales, ≥ 75 % ramas en `service/` y `handlers/`), sin rebajarlos.

  ```bash
  npm test -w apps/progress-service -- --coverage 2>&1 | grep -E "All files|service|handlers|identity|trend"
  git diff main...HEAD --name-only -- apps/progress-service/jest.config.js | wc -l
  ```

  Esperado: ningún valor bajo los pisos; `trend-response.ts` con 100 % de líneas y ramas (es una función pura); `jest.config` sin cambios (`0`).

- [ ] **CA-13** — Sin dependencias nuevas.

  ```bash
  git diff main...HEAD --name-only | grep -E "package(-lock)?\.json" || echo "sin cambios de dependencias"
  ```

  Esperado: imprime `sin cambios de dependencias`.

- [ ] **CA-14** — Manifiestos: solo cambian el tag y las dos variables de identity, y el servidor los acepta.

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  grep -q "image: progress-service:u7-T01" k8s/progress/deployment.yaml || echo "FALLO: tag"
  ! grep -qE "image: progress-service:(latest|u5-T02)" k8s/progress/deployment.yaml || echo "FALLO: tag viejo o latest"
  grep -q "IDENTITY_URL: 'http://identity-service:3100'" k8s/progress/configmap.yaml || echo "FALLO: IDENTITY_URL"
  grep -q "IDENTITY_TIMEOUT_MS: '5000'" k8s/progress/configmap.yaml || echo "FALLO: IDENTITY_TIMEOUT_MS"
  git diff main...HEAD -- k8s/progress | grep -E '^[-+][^-+]' | grep -vE "image: progress-service:(u5-T02|u7-T01)|IDENTITY_(URL|TIMEOUT_MS)" || echo "diff limitado a tag y variables de identity"
  kubectl apply --dry-run=server -f k8s/progress/
  ```

  Esperado: solo `k8s/progress/configmap.yaml` y `k8s/progress/deployment.yaml`; ningún `FALLO`; `diff limitado a tag y variables de identity`; `--dry-run=server` acepta ambos (C-61: `--dry-run=client` no discrimina nada y no cuenta). Este CA **no modifica** el cluster.

- [ ] **CA-15** — Despliegue en kind y lectura de vuelta (**CA-15a, codificador, con autorización del humano para progress-service solamente**).

  ```bash
  kubectl get pods -l app=progress-service -o jsonpath='{.items[0].metadata.name} {.items[0].metadata.creationTimestamp}{"\n"}' | tee $WORK/pod-antes.txt
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  docker build -f apps/progress-service/Dockerfile -t progress-service:u7-T01 .
  kind load docker-image progress-service:u7-T01
  kubectl apply -f k8s/progress/
  kubectl rollout status deployment/progress-service --timeout=180s
  kubectl get deployment progress-service -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get pods -l app=progress-service -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get configmap progress-service-config -o jsonpath='{.data.IDENTITY_URL} {.data.IDENTITY_TIMEOUT_MS}{"\n"}'
  lsof -i :3401 || echo "3401 libre"
  kubectl port-forward svc/progress-service 3401:3400 >$WORK/pf-progress.log 2>&1 &
  sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3401/health
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3401/api/trends
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3401/api/trends -H "Authorization: Bearer basura"
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: imagen `progress-service:u7-T01 RollingUpdate`; un solo pod de progress, `ready=true restarts=0` con `image=progress-service:u7-T01` y **nombre distinto** del anterior (anótalo en la bitácora); el ConfigMap trae `http://identity-service:3100 5000`; el puerto 3401 estaba libre (L45: si lo ocupa otro proceso el `curl` da un falso verde; confirma que el port-forward arrancó mirando `$WORK/pf-progress.log`); `/health` `200`; `/api/trends` sin token `401` y con token basura `401`. **Identity, ingestion, trust y backend con el mismo nombre de pod y la misma edad** en `pods-antes.txt` y `pods-despues.txt` (no se tocan). Cierra el port-forward al terminar. El **solo** `kubectl apply` permitido es `-f k8s/progress/`. Registra en la bitácora cada `docker build`, `kind load`, `apply` y `rollout` con su salida.

- [ ] **CA-16** — E2E con usuarios reales (**CA-16b, revisor o humano; solo con autorización de port-forward a identity, ingestion y progress y de registro de usuarios `*.test`**). Si el sistema deniega un permiso, se reporta **no verificable** y no se esquiva (L22).

  ```bash
  # Puertos locales: identity 3101, ingestion 3202, progress 3401 (comprueba `lsof -i :<puerto>` antes, L45; 3300 es del humano y 3301 lo ocupa el backend local).
  # Registrar con emails únicos *.test: A (free, 5 uploads), B (free, 1 upload). Subir JPEG como en bitacoras/u5-T02.md. NO imprimas los JWT.
  curl -s -w " %{http_code}\n" http://localhost:3401/api/trends -H "Authorization: Bearer $JWT_A" | tee $WORK/trends-A-free.txt
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8").replace(/ \d+\n?$/,"");const j=JSON.parse(t);const c=j.data.categories;const raw=JSON.stringify(j);const ok=j.data.tier==="free"&&c.length===5&&c.every(x=>(x.status==="locked"||x.status==="insufficient_data")&&!("trend" in x))&&!/improving|stagnating|worsening|scoreHistory|slope/.test(raw);console.log("A free:",ok?"locked sin datos":"FALLO");process.exit(ok?0:1)' $WORK/trends-A-free.txt
  curl -s -X POST http://localhost:3101/api/users/me/subscribe -H "Authorization: Bearer $JWT_A" -o /dev/null -w "%{http_code}\n"
  curl -s -w " %{http_code}\n" http://localhost:3401/api/trends -H "Authorization: Bearer $JWT_A" | tee $WORK/trends-A-paid.txt
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8").replace(/ \d+\n?$/,"");const j=JSON.parse(t);const c=j.data.categories;const withTrend=c.filter(x=>x.trend);const ok=j.data.tier==="paid"&&c.length===5&&withTrend.length>=1&&withTrend.every(x=>x.trend.direction===x.status&&x.trend.scoreHistory.length>=4)&&c.every(x=>x.status!=="locked");console.log("A paid:",ok?"trend completo":"FALLO","categorias con tendencia="+withTrend.length);process.exit(ok?0:1)' $WORK/trends-A-paid.txt
  curl -s -w " %{http_code}\n" http://localhost:3401/api/trends -H "Authorization: Bearer $JWT_B" | tee $WORK/trends-B.txt
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8").replace(/ \d+\n?$/,"");const j=JSON.parse(t);const ok=j.data.tier==="free"&&j.data.categories.every(x=>x.status==="insufficient_data"&&x.uploadsNeeded===3&&!("trend" in x));console.log("B:",ok?"insufficient_data uploadsNeeded=3":"FALLO");process.exit(ok?0:1)' $WORK/trends-B.txt
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3401/api/trends?userId=ID_DE_A" -H "Authorization: Bearer $JWT_B"
  ```

  Esperado: `A free: locked sin datos`; `POST /subscribe` `200`; `A paid: trend completo` con al menos una categoría con tendencia (el stub de Claude siempre devuelve `HIGH`, así que A tiene 5 uploads calificados) y `scoreHistory` de ≥ 4 puntos; `B: insufficient_data uploadsNeeded=3`; el último `curl` da `200` y la respuesta es la de B (el `?userId=` se ignora). La puerta se prueba con un **cambio real de tier en identity** (el mismo usuario, antes y después de `subscribe`), no con un falso. Cierra los port-forward (el PID 4456 es del humano: no lo toques).

- [ ] **CA-17** — Sin secretos en el diff ni en el árbol (CA estándar).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`. Los tests usan una constante evidentemente falsa de JWT (como los de u5-T02 y u6-T01); no se citan literales con forma de clave (C-29) y la bitácora no imprime JWT.

- [ ] **CA-18** — Alcance exacto y commits atómicos.

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list main..HEAD); do git show --name-only --format='%h %s' $c | head -10; done
  ```

  Esperado: exactamente `packages/shared-types/src/trends.ts` (y `index.ts` solo si hizo falta), `apps/progress-service/src/service/identity-client.ts`, `apps/progress-service/src/service/trend-response.ts`, `apps/progress-service/src/handlers/trends.ts`, `apps/progress-service/src/server.ts`, `apps/progress-service/src/__tests__/{identity-client,trend-response,trends,server,history}.test.ts`, el servidor falso de identity (`__tests__/fake-identity.ts`, nuevo) y, solo si hace falta, `fake-ingestion.ts` ampliado **en su sitio**, `k8s/progress/configmap.yaml`, `k8s/progress/deployment.yaml` y `bitacoras/u7-T01.md`. Cada commit contiene solo los archivos que nombra su mensaje; ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`; ≥ 2 commits.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- **`trend-response` (puro):** `free` con las tres direcciones → todo `locked` sin `trend`; `free` con `insufficient_data` intacto; `paid` con las cuatro situaciones y el orden `CAT-1..5`; `categoryName` correcto; `scoreHistory` cronológico y sin `slope`; la salida valida contra `TrendResponseSchema`; el `refine` rechaza `trend` en `locked`, `uploadsNeeded` fuera de `insufficient_data` y `direction !== status`.
- **`identity-client`:** `200` válido para `free` y `paid`; `401`; `5xx`; red; timeout; redirección; cuerpo no JSON; cuerpo que no valida; `tier` desconocido; solo `Authorization` por valor; ruta exacta.
- **`trends` (HTTP, supertest + falsos de identity e ingestion):** AC-7.1 y AC-7.2 de punta a punta; sin caché y cambio de tier; fallos de identity y de ingestion con contadores; auth sin token y con basura con contadores en `0`; `?userId=` ignorado; silencio de logs (CA-9).
- **`server`:** arranque fallido por `TREND_*` inválidos y por `IDENTITY_URL` ausente; `TREND_MIN_UPLOADS` y `IDENTITY_TIMEOUT_MS` por su efecto.
- Cada prueba de rechazo o de borde afirma por **valor** y no solo «no lanza»; las de orden y de auth miran **contadores de peticiones**, no solo el body.

**Rojo primero (de ejecución, no de compilación — Lección 13):** crea primero `identity-client.ts`, `trend-response.ts` y `handlers/trends.ts` con la firma correcta y un cuerpo neutro (p. ej. el handler devuelve `200` con `categories: []`), escribe los tests y registra que **fallan por aserción**; después implementa. Para infraestructura, antes de aplicar registra la lectura del estado «malo»: imagen actual `progress-service:u5-T02` y `/api/trends` respondiendo `404`. Registra las salidas en la bitácora. El par falla-pasa es la prueba.

---

## Notas

- Archivos que se **modifican en su sitio**: `packages/shared-types/src/trends.ts`, `apps/progress-service/src/server.ts`, `__tests__/server.test.ts`, `__tests__/history.test.ts` (solo añadir `identityUrl`), `k8s/progress/configmap.yaml`, `k8s/progress/deployment.yaml`. Nada de duplicados con sufijo.
- **Bitácora nueva:** `bitacoras/u7-T01.md`: hash de la tarea, nombre y edad de **todos** los pods antes y después, estado «malo» inicial, salida roja inicial, las siete decisiones de diseño, cada `docker build`/`kind load`/`apply`/`rollout` con su salida y cualquier **ATENCIÓN** sobre un defecto de la tarea. Anota también que C-40/C-44 siguen abiertas y que C-55 sigue abierta (no hay snapshot).
- **Forma real de `/api/users/me/limits`** (identity): `{ data: { tier, uploadsRemaining, uploadsLimit, resetDate }, error: null, status: 200 }`, validada con `LimitsResponseSchema`. Para `paid` los tres campos son `null`.
- **El listado de ingestion ya viene más reciente primero**, y `calculateTrends` ya lo invierte: `scoreHistory` es `series` sin tocar. No reordenes por `timestamp`.
- **`trend-service.ts` no sirve tal cual** para esta tarea, porque `getTrends` lee solo ingestion y esta tarea necesita el tier primero. No lo cambies: compón `fetchLimits` (nuevo) + `getTrends` (existente) en el handler.
- **Hacia identity, `fetch` con `redirect: 'error'`**, `AbortSignal.timeout` y un resultado discriminado que nunca lanza (L28 y molde de `ingestion-client.ts`).
- **Permisos de cluster** (los da el humano **tarea por tarea**; el orquestador los pide con lista exacta antes de despachar y se los pasa al subagente): _codificador (CA-15a):_ `docker build` de `progress-service:u7-T01`, `kind load docker-image progress-service:u7-T01`, `kubectl apply -f k8s/progress/`, `kubectl rollout status` y `kubectl port-forward svc/progress-service 3401:3400`. _Revisor (CA-16b):_ port-forward a identity (3101), ingestion (3202) y progress (3401), registrar usuarios `*.test` y `POST /api/users/me/subscribe` sobre ellos; **solo lectura** con `kubectl`. Ninguno reinicia ni escala identity, ingestion o trust. Cualquier denegación se reporta como «no verificable».
- Los secretos nuevos no hacen falta: reutiliza `jwt-secret` (ya montado). **No** hace falta `anthropic-key`.
- `npm test` ya lleva `--coverage`; para quitarlo se pasa `--coverage=false`. Vigila **`Test Suites:`** además de `Tests:` (C-57).
- No hagas push, no abras PR, no fusiones. `git add <rutas explícitas>` (nunca `-a`) y un subdirectorio propio del scratchpad para `$WORK`.

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
