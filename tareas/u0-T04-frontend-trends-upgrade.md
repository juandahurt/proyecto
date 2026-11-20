# u0-T04 — Frontend: tendencias por categoría y flujo de upgrade (mock)

**Unidad:** u0 — frontend (`kind: ui`), tarea 4 de 4 (T01 base ✅, T02 subida/crítica ✅, T03 historial ✅).
**Historias que implementa:** parte de interfaz de la API de tendencias (`GET /api/trends`, ya fusionada en u7) y del tier `paid` mock (`POST /api/users/me/subscribe`, ya fusionado en u10).
**Depende de:** u0-T01 (#24), u0-T02 (#25), u0-T03 (#26), u6/u7 (motor y API de tendencias) y u10 (subscribe). Todas fusionadas y desplegadas.

**Decisiones del humano:**

- Tarea elegida al abrir la ola 13 (2026-11-20), tras cerrar u0-T03.
- **Sin mockup** (2026-11-20): las pantallas 5 (tendencias) y 6 (upgrade) no existen en `refined-mockups/mockups.md`. Se diseñan con `design-system-mapping.md` y las decisiones de abajo.
- **Visualización de tendencias: sin librería de gráficos** (2026-11-20). Cada categoría se pinta con un badge de dirección (texto + color) y el `scoreHistory` como una lista de puntuaciones en orden cronológico (p. ej. `62 → 68 → 74`), sin SVG ni canvas. Cero dependencias nuevas (evita repetir C-79).
- **Flujo de upgrade: un solo clic** (2026-11-20). El botón `Upgrade to Paid` llama directamente a `POST /api/users/me/subscribe`; al `200` se muestra una confirmación en la misma pantalla y se refresca el contador de tier (`useLimits().refresh({ fresh: true })`) para que toda la app (barra lateral, `/upload`) refleje `paid` sin recargar. Sin formulario de pago (el tier paid es un mock, u10).

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **Ruta `/trends` nueva**, dentro de `RequireOnboarded`/`AppLayout`; **`/upgrade` deja de ser un cascarón** y pasa a tener el flujo real. Ambas quedaban como «coming soon» desde u0-T01/u0-T02.
2. **`/trends` reemplaza el bloque «PROGRESS TRENDS» deferido de `/history`** (el marcador de u0-T03 queda, pero ahora enlaza a `/trends` en vez de ser un texto suelto sin destino). El enlace de la barra lateral a «Progress Trends» (si no existe aún, créalo) apunta a `/trends`.
3. **Lectura única de `GET /api/trends`** al entrar en `/trends`, sin caché ni refresco automático (igual de simple que `/history`). Las 5 categorías se pintan en el orden `CAT-1`..`CAT-5`, con `categoryName` igual que en la crítica y el historial.
4. **Por `status` de cada categoría (`CategoryTrendStatusSchema`):**
   - `locked` (tier `free`): la categoría se pinta con el nombre y un candado/etiqueta `Locked` y un botón/enlace `Upgrade to see trends` que navega a `/upgrade`. Ninguna dirección ni historial se renderiza (el servidor ya no los manda para `free`, pero el cliente tampoco debe asumir que vendrían).
   - `insufficient_data`: etiqueta `Not enough data yet` y el texto `<uploadsNeeded> more upload(s) needed` (singular/plural correcto: `1 more upload needed` vs `2 more uploads needed`).
   - `improving` / `stagnating` / `worsening`: badge con el texto literal `Improving`, `Stagnating` o `Worsening` (color verde/gris/rojo respectivamente, de `design-system-mapping.md`: verde `green-600`, rojo `red-600`; `stagnating` usa `gray-500` por no tener un token propio) y la lista de `trend.scoreHistory` como `<score1> → <score2> → … → <scoreN>` en el orden que llega (cronológico, ya lo garantiza el servidor).
5. **Tier `paid` sin categorías bloqueadas**: con `tier: 'paid'` en la respuesta, ninguna categoría puede salir `locked` (lo garantiza el servidor); si una llegara así de todos modos, se pinta igual que `locked` (el cliente no inventa datos) y se dejaría constancia en una candidata, no se parchea aquí.
6. **Errores de `GET /api/trends`:** `401` cierra sesión; `502`/`504` (upstream) y red → mensaje `We could not load your trends. Please try again.` con `Retry` (igual patrón que la crítica en u0-T02/T03); mientras carga, un estado `role="status"`.
7. **`/upgrade`:**
   - Con tier ya `paid` (leído de `useLimits()`): la pantalla no ofrece el botón, muestra `You're already on the Paid plan.` y un enlace de vuelta (`/upload`).
   - Con tier `free`: encabezado, una línea descriptiva (`Unlimited uploads and full access to progress trends.`) y el botón `Upgrade to Paid`.
   - Al hacer clic: el botón se deshabilita y muestra un estado de carga (`Upgrading…`), llama a `POST /api/users/me/subscribe` con el token de auth; al `200` reemplaza el contenido por `You're now on the Paid plan!` con un enlace `Continue` a `/upload`, y dispara `refresh({ fresh: true })` del contexto de límites.
   - Error (`401`, `5xx`, red): mensaje en `role="alert"` (`Upgrade failed — please try again.`) y el botón vuelve a estar disponible; `401` cierra sesión.
   - Doble clic durante la petición en vuelo: **una sola** llamada a `fetch` (mismo patrón de doble envío que u0-T02/C-70).
8. **`SubscribeResponseSchema` en `shared-types`.** Hoy no existe un schema dedicado para `POST /api/users/me/subscribe`; el handler de identity responde con la misma forma que `LimitsResponseSchema.shape.data` (`tier`, `uploadsRemaining`, `uploadsLimit`, `resetDate`), envuelta igual. Se añade `SubscribeResponseSchema` en `packages/shared-types/src/limits.ts` (reutilizando `LimitsResponseSchema.shape.data`, sin copiar el schema) y el cliente del frontend lo usa para validar la respuesta, en vez de reutilizar `LimitsResponseSchema` a ciegas (aunque hoy coincidan, son contratos de endpoints distintos y no deben acoplarse).
9. **Textos de la interfaz en inglés**; el resto, en español.

---

## Alcance

**Dentro** (una línea, concreta):

> `shared-types`: `SubscribeResponseSchema`. Frontend: pantalla `/trends` (lectura de `GET /api/trends`, badges de dirección, puerta de tier `locked`, estado `insufficient_data`), pantalla `/upgrade` real (botón de un clic a `POST /api/users/me/subscribe`, confirmación, refresco del contador), enlaces desde `/history` y la barra lateral, y despliegue de la imagen nueva del frontend en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- Cualquier cambio en el **cálculo** de tendencias (`apps/progress-service/src/service/trend-*.ts`) o en el contrato `TrendResponseSchema`/`CategoryTrendSchema` ya existentes: son de u6/u7 y están fusionados.
- Cualquier cambio en `identity-service` (el endpoint `subscribe` ya existe y funciona; esta tarea solo lo **consume**), `trust-service`, `ingestion-service`, `backend`, `packages/auth-middleware`.
- Gráficos, canvas, SVG de datos, librerías de charting.
- Un flujo de pago real, formulario de tarjeta, downgrade de `paid` a `free`.
- El contador de subidas y su bloqueo en 0 (C-76): sigue pendiente de u9-T02.
- El voto «Was this critique useful?» (C-77), borrado de historial (u13).
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, `vite.config.ts`, el `ConfigMap` de nginx, el `Dockerfile` ni la CSP.
- Tests end-to-end con navegador, modo oscuro, i18n, animaciones.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/design-system-mapping.md` (colores, tipografía, componentes) — **sin mockup de pantalla** para tendencias/upgrade, se diseña con esto.
- `packages/shared-types/src/trends.ts` (`TrendResponseSchema`, `CategoryTrendSchema`, `CategoryTrendStatusSchema`, `CATEGORY_NAME_BY_ID`) y `limits.ts` (`LimitsResponseSchema`, a extender con `SubscribeResponseSchema`)
- **Formas reales de los servidores (mandan sobre el contrato, Lección 53):** `apps/progress-service/src/handlers/trends.ts` y `src/service/trend-response.ts` (`GET /api/trends`: `401`, `502`, `504`, `200`), `apps/identity-service/src/handlers/subscribe.ts` (`POST /api/users/me/subscribe`: `200` siempre que el token sea válido, sin cuerpo de entrada)
- `apps/frontend/src/components/{UsageCounter,UpgradePrompt,ScoreBadge,AppLayout}.tsx`, `src/lib/limits-context.tsx` (`useLimits`, `refresh({ fresh })`), `src/pages/{History,Critique,Upgrade}.tsx`, `src/api/{client,endpoints,uploads}.ts`
- `apps/frontend/src/App.tsx` (rutas `/trends` y `/upgrade`, esta última ya registrada apuntando al cascarón)
- `k8s/frontend/deployment.yaml`
- `tareas/u0-T03-frontend-history.md` (molde más reciente de CA de UI y despliegue) y `apps/frontend/src/__tests__/helpers.tsx` (`installFetch`, `renderApp`, `fakeJwt`, `LocationProbe`)
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + RTL, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `npm run build -w packages/auth-middleware`. Los `Esperado` de conteos de tests se comparan contra `main`.

- [ ] **CA-1** — **`SubscribeResponseSchema` en shared-types, derivado sin copiar.**

  ```bash
  grep -n -B2 -A6 "export const SubscribeResponseSchema" packages/shared-types/src/limits.ts
  npm run build -w packages/shared-types 2>&1 | tail -5
  ```

  Esperado: el schema reutiliza `LimitsResponseSchema.shape.data` (p. ej. `LimitsResponseSchema.shape.data.extend({})` o equivalente que no repita los campos a mano) envuelto en `{ data, error: null, status: literal(200) }`; build sin errores de tipos.

- [ ] **CA-2** — **Pantalla `/trends`: lectura y puerta de tier, por valor.**

  ```bash
  npm test -w apps/frontend -- trends --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/trends` falso (5 categorías, una de cada `status` posible: `locked`, `insufficient_data`, `improving`, `stagnating`, `worsening`):

  - Encabezado `Progress Trends`; las 5 categorías en orden `CAT-1`..`CAT-5` con `categoryName` en mayúsculas.
  - `locked` → etiqueta `Locked`, sin badge de dirección ni lista de scores, enlace `Upgrade to see trends` a `/upgrade`.
  - `insufficient_data` con `uploadsNeeded: 1` → texto exacto `1 more upload needed`; con `uploadsNeeded: 3` → `3 more uploads needed` (singular/plural probado en ambos bordes).
  - `improving` con `scoreHistory` de 3 puntos (`62`, `68`, `74`) → badge `Improving` (verde) y texto `62 → 68 → 74` en ese orden exacto.
  - `stagnating` y `worsening` → badges `Stagnating` (gris) y `Worsening` (rojo) respectivamente.
  - Ningún dato de `locked` ni `insufficient_data` se infiere de categorías vecinas (cada categoría se pinta solo con lo que trae la suya).

  **Mutación observable:** invertir el orden de `scoreHistory` al pintarlo, o mostrar `Upgrade to see trends` para una categoría que no es `locked`, **hace fallar** su test.

- [ ] **CA-3** — **Errores y estado de carga de `/trends`.**

  ```bash
  npm test -w apps/frontend -- trends-errors --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: mientras carga, `role="status"` (no la lista vacía); `502`/`504`/red → `We could not load your trends. Please try again.` en `role="alert"` con `Retry` que vuelve a pedir (contador de `fetch`); `401` cierra sesión (token borrado, navega a `/login`).

- [ ] **CA-4** — **Flujo de upgrade de un clic, por valor.**

  ```bash
  npm test -w apps/frontend -- upgrade --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `limits` falso de tier `free`:

  - Pantalla `/upgrade` muestra el botón `Upgrade to Paid`; un clic lo deshabilita y cambia su texto a `Upgrading…`; llama **una vez** a `POST /api/users/me/subscribe` con `Authorization: Bearer <token>`.
  - Respuesta `200` validada con `SubscribeResponseSchema` → se pinta `You're now on the Paid plan!` con un enlace `Continue` a `/upload`; se invoca `refresh({ fresh: true })` del contexto de límites (se verifica con un espía/mock del contexto, no inspeccionando `fetch` de nuevo).
  - Con `limits` falso de tier `paid` desde el inicio: **no** aparece el botón; se pinta `You're already on the Paid plan.` y un enlace a `/upload`.
  - Error (`5xx`, red) → `Upgrade failed — please try again.` en `role="alert"`, el botón vuelve a estar habilitado y con su texto original; `401` cierra sesión.
  - Dos clics seguidos (o `Enter` + clic) con la petición en vuelo → **una sola** llamada a `fetch` (contador).

  **Mutación observable:** no refrescar `limits` tras el `200`, o permitir una segunda llamada en doble clic, **hace fallar** su test.

- [ ] **CA-5** — **Enlaces desde `/history` y la barra lateral a las rutas reales.**

  ```bash
  npm test -w apps/frontend -- history applayout --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: el marcador de «Progress trends» de `/history` (u0-T03) ahora es un enlace/botón que navega a `/trends` (ya no es solo texto); el enlace `Upgrade` de `UsageCounter` sigue yendo a `/upgrade` (sin regresión).

- [ ] **CA-6** — **Rutas, guardas y accesibilidad de `/trends` y `/upgrade`.**

  ```bash
  npm test -w apps/frontend -- routes a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin token, ambas rutas redirigen a `/login` sin llamar a ninguna API; con onboarding incompleto, a `/onboarding`; con sesión completa se pintan dentro de `AppLayout`. Exactamente un `h1` por pantalla; errores en `role="alert"`, estados informativos en `role="status"`/`aria-live="polite"`; todo operable con teclado (el botón de upgrade y los enlaces de tendencias). Los comportamientos de CA-8 de u0-T03 siguen en verde.

- [ ] **CA-7** — **Los demás workspaces no cambian y todos los tests pasan.**

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  for w in ingestion-service identity-service trust-service progress-service backend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  git diff main...HEAD --name-only -- apps/ingestion-service apps/identity-service apps/trust-service apps/progress-service apps/backend | wc -l
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/frontend/src || echo "sin skip, only ni todo"
  ```

  Esperado: frontend sin suites fallidas y **más** tests que `main` (anota el conteo de `main` al redactar); los cinco servicios backend con los mismos tests y suites que en `main`; `wc -l` da `0`; `sin skip, only ni todo`.

- [ ] **CA-8** — **Lint, build del monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` sin fallidas; prettier limpio sobre el diff. Sin cambios en `eslint.config.js`, `turbo.json`, `.prettierrc` ni `vite.config.ts`.

- [ ] **CA-9** — **Cobertura sobre los pisos, sin rebajarlos.**

  ```bash
  npm test -w apps/frontend -- --coverage 2>&1 | grep -E "All files|api|auth|pages|components"
  git diff main...HEAD -- apps/frontend/jest.config.js | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' || echo "jest.config sin cambios"
  ```

  Esperado: ≥80% líneas global y ≥75% ramas en `src/api/` y `src/auth/`; `jest.config.js` sin cambios de umbrales.

- [ ] **CA-10** — **Dependencias: ninguna nueva.**

  ```bash
  git diff main...HEAD -- apps/frontend/package.json | grep -E '^[-+] +"' || echo "sin cambios en package.json del frontend"
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  ```

  Esperado: `sin cambios en package.json del frontend` (la decisión de diseño 1 fue explícitamente no agregar ninguna librería de gráficos); `audit exit=0`.

- [ ] **CA-11** — **Manifiestos: solo cambia el tag.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  git diff main...HEAD -- k8s/frontend | grep -E '^[-+] ' | grep -vE '^(---|\+\+\+)'
  grep -q "image: frontend:u0-T04" k8s/frontend/deployment.yaml || echo "FALLO: tag"
  ! grep -rqE "image: .*:latest" k8s/frontend || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/frontend/
  ```

  Esperado: el único archivo de `k8s/` tocado es `k8s/frontend/deployment.yaml`, único cambio el tag (`frontend:u0-T03` → `frontend:u0-T04`); ningún `FALLO`; el servidor acepta el manifiesto.

- [ ] **CA-12** — **Despliegue en kind y lectura de vuelta (codificador, con autorización del humano para el frontend solamente).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  lsof -i :3500 || echo "3500 libre"
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T04 .
  kind load docker-image frontend:u0-T04
  kubectl apply -f k8s/frontend/
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl port-forward svc/frontend 3500:8080 >$WORK/pf-frontend.log 2>&1 &
  sleep 3
  curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3500/health
  curl -s -o /dev/null -w "spa-trends %{http_code} %{content_type}\n" http://localhost:3500/trends
  curl -s -o /dev/null -w "spa-upgrade %{http_code} %{content_type}\n" http://localhost:3500/upgrade
  for p in /api/trends /api/users/me/subscribe; do curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3500$p; done
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: **un** pod `ready=true restarts=0` con `frontend:u0-T04`; `health 200`; `spa-trends 200 text/html`; `spa-upgrade 200 text/html`; `/api/trends` con `GET` sin token da `401`; `/api/users/me/subscribe` con `POST` sin token da `401` (si `curl` por defecto hace `GET`, ajusta a `-X POST`); los otros 5 pods con el mismo nombre y edad en `pods-antes.txt` y `pods-despues.txt`. Cierra el port-forward (avisa al humano si cortaste el suyo).

- [ ] **CA-13** — **Flujo real de tendencias y upgrade a través del proxy (revisor o humano; con autorización de port-forward y de registro/subida con usuarios `*.test`).** Si el sistema deniega un permiso, se reporta **no verificable**. **No uses los usuarios demo del humano.**

  ```bash
  E="u0t04-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"
  curl -s -o /dev/null -w "register %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  curl -s -o $WORK/trends.json -w "trends %{http_code}\n" http://localhost:3500/api/trends -H "Authorization: Bearer $T"
  node -e 'const d=require(process.argv[1]).data; console.log(d.tier, d.categories.map(c=>c.status).join(","))' $WORK/trends.json
  curl -s -o $WORK/sub.json -w "subscribe %{http_code}\n" -X POST http://localhost:3500/api/users/me/subscribe -H "Authorization: Bearer $T"
  node -e 'console.log(require(process.argv[1]).data.tier)' $WORK/sub.json
  curl -s -w " %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  ```

  Esperado: `register 201`; `trends 200` con `tier free` y las 5 categorías en `insufficient_data` (el usuario nuevo no subió nada: el cálculo de datos insuficientes se decide antes que la puerta de tier, así que no salen `locked`); `subscribe 200`; la línea de `node` imprime `paid`; `limits` final confirma `tier":"paid"` y los tres campos numéricos/fecha en `null`. Cierra el port-forward y deja constancia del email `*.test` creado. Ningún JWT ni contraseña en el informe ni en la bitácora.

- [ ] **CA-14** — **Sin secretos en el diff, el árbol ni el bundle.**

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  grep -rEl "sk-ant-api[0-9]+|JWT_SECRET|ANTHROPIC" apps/frontend/dist 2>/dev/null || echo "bundle sin secretos"
  ```

  Esperado: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos`.

- [ ] **CA-15** — **Alcance exacto y commits atómicos, «rojo primero» commiteado.**

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list --reverse main..HEAD); do git show --name-only --format='%h %s' $c | head -14; done
  ```

  Esperado: solo archivos bajo `apps/frontend/`, `packages/shared-types/`, `k8s/frontend/deployment.yaml` y `bitacoras/u0-T04.md`. ≥4 commits atómicos en este orden: (1) `SubscribeResponseSchema`; (2) pantalla `/trends` con tests, rojo primero; (3) flujo `/upgrade` con tests, rojo primero, y fix de los enlaces desde `/history`/barra lateral; (4) k8s y bitácora. Ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`. Sin `git push`, sin PR.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea** (Jest + RTL + `user-event`, `fetch` falso, sin red real):

- `GET /api/trends`: las 5 combinaciones de `status` por valor, puerta de tier, singular/plural de `uploadsNeeded`, orden del `scoreHistory`, errores y `401`.
- `POST /api/users/me/subscribe`: un clic exitoso con refresco del contexto de límites, tier ya `paid`, error, doble clic.
- Enlaces desde `/history` y la barra lateral a las rutas reales.
- Rutas, guardas y accesibilidad de ambas pantallas nuevas.

**Rojo primero:** antes de cualquier implementación, el codificador escribe el test de la combinación de `status` y del flujo de upgrade exitoso, confirma que fallan contra el cascarón actual, y pega la salida roja en la bitácora.

---

## Notas

- Archivos que se **modifican en su sitio**: `packages/shared-types/src/limits.ts`, `apps/frontend/src/pages/{Trends,Upgrade,History}.tsx` (crea `Trends.tsx` si no existe), `apps/frontend/src/App.tsx`, `apps/frontend/src/components/AppLayout.tsx` (enlace a `/trends` si no existe ya un lugar para él), `k8s/frontend/deployment.yaml`. Nada de duplicados con sufijo.
- **Permisos de cluster para esta tarea:** `docker build`, `kind load`, `kubectl apply` y `rollout status` sobre **frontend únicamente**. Port-forward de `svc/frontend` en el 3500 o el 3503. Pregúntalos al humano antes de que el codificador los use; no se heredan de la ola anterior.
- **No reabre C-76 ni C-77.** El contador de subidas y el voto de utilidad siguen pendientes.
- **Orden real de la puerta de tier (verificado en `trend-response.ts` al redactar esta tarea):** el cálculo de `insufficient_data` se comprueba **antes** que el tier. Para `free`, una categoría sale `insufficient_data` si todavía no hay suficientes subidas calificadas, y solo sale `locked` cuando **sí** hay una dirección calculada (`improving`/`stagnating`/`worsening`) pero el tier la oculta. Es decir: un usuario `free` recién registrado (CA-13) verá las 5 categorías en `insufficient_data`, no `locked`. El CA-2 ya usa ambos casos por separado (uno `locked` con una categoría que simula tener dirección calculada, otro `insufficient_data`); si al implementar encuentras que el código real difiere de esto, ATENCIÓN en la bitácora y ajusta con un bloque «Fix de especificación».

---

_Redactada por el orquestador al abrir la ola 13 (u0-T04), sin mockup, con decisiones de visualización (sin gráficos) y de flujo de upgrade (un clic) afirmadas por el humano el 2026-11-20._
