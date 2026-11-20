# u0-T03 — Frontend: historial de subidas (tabla, Focus area y miniatura)

**Unidad:** u0 — frontend (`kind: ui`), tarea 3 de 4 (T01 base ✅, T02 subida/crítica ✅, T04 tendencias y upgrade).
**Historias que implementa:** US-4 (detalle con control de dueño, ya expuesto por `/uploads/:id`), US-5 (historial), en su parte de interfaz.
**Depende de:** u0-T01 (#24), u0-T02 (#25), u5 (`GET /api/uploads`, ya desplegado). Todas fusionadas.

**Decisiones del humano:**

- Tarea elegida tras cerrar la ola 11 (2026-11-20): historial de frontend, antes que u9-T02 (contador) y u13 (borrado).
- **C-78 se resuelve ampliando el backend** (2026-11-20): el listado `GET /api/uploads` gana `thumbnailUrl` por item, igual que ya hace `GET /api/uploads/:uploadId`. Esta tarea **sí** toca `apps/ingestion-service` y `packages/shared-types`, a diferencia de u0-T02 que fue solo frontend.

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **`thumbnailUrl` en el listado se firma igual que en el detalle** (`signThumbnailUrl({ uploadId, key, nowMs })`, mismo TTL de 15 min, misma ruta `/api/uploads/<id>/thumbnail?exp=&sig=`), para **todo** item sin distinguir `ready` de `low_confidence` (el detalle ya lo hace así; no hay motivo para que el listado sea más estricto). `UploadListItemSchema` gana el campo `thumbnailUrl: z.string().min(1).optional()` (opcional por si el blob no existiera, aunque hoy siempre se firma).
2. **Sin paginación en el servidor.** `GET /api/uploads` sigue devolviendo todo el historial del usuario (C-40/C-44, aceptadas sin cambios); la paginación de «Show all» es **solo del cliente**: la tabla pinta como máximo 10 filas y un enlace `Show all <n>` las muestra todas sin volver a pedir al servidor.
3. **Ruta de la tabla: `/history`**, dentro de `RequireOnboarded`/`AppLayout` (ya existe como cascarón «coming soon»; esta tarea lo reemplaza). El bloque «PROGRESS TRENDS» del mockup (pantalla 4) queda **fuera**, para T04: se pinta un marcador visible `Progress trends — coming in a future update` sin gráficos ni botón de upgrade real (el botón «Upgrade» de la barra lateral ya funciona desde u0-T02).
4. **Clic en una fila navega a `/uploads/:uploadId` pasando `state: { from: 'history' }`** (React Router `state`, no query string, para no exponerlo en la URL). `Critique.tsx` lee ese estado: si `from === 'history'` el enlace «← Back» apunta a `/history`; si no, a `/upload` (comportamiento actual de u0-T02, que se conserva para el flujo de subida).
5. **Focus area = la categoría con el score más bajo** de ese upload (`scores`, ya viene en el listado); empate → la de `categoryId` más bajo (CAT-1 antes que CAT-2…). Se pinta con `CATEGORY_NAME_BY_ID` (ya existe en `shared-types/anthropic.ts`, igual que en `Critique.tsx`) y un `title`/tooltip accesible con el texto exacto del mockup: `The category with the most room to improve in this upload.` Para `low_confidence` (sin `scores`) la celda muestra `—` y el tooltip no se pinta.
6. **Miniatura en la tabla:** igual regla de seguridad que en la crítica (u0-T02, decisión 7): solo se renderiza `<img>` si `thumbnailUrl` empieza por `/api/uploads/`; si no, o si falta, una celda vacía con `alt` descriptivo ausente (sin icono de "broken image").
7. **Fecha, en inglés y UTC**, mismo formato que el resto del frontend (`Intl.DateTimeFormat('en-US', { timeZone: 'UTC' })`, `Sep 24, 2026`).
8. **Score de la tabla = el score de la categoría de Focus area** (el mockup tiene una sola columna «Score», no cinco); se pinta con el mismo `ScoreBadge` que la crítica (`<score> / 100`, mismos umbrales de color). Para `low_confidence` la celda muestra `Low confidence` en vez de un badge (igual etiqueta que ya usa «Recent uploads» en u0-T02).
9. **Lista vacía:** mismo patrón que «Recent uploads» (`No uploads yet`), con un enlace a `/upload`.
10. **Textos de la interfaz en inglés**; el resto, en español.

---

## Alcance

**Dentro** (una línea, concreta):

> Backend: `thumbnailUrl` firmada en cada item de `GET /api/uploads` (ingestion + `shared-types`). Frontend: pantalla `/history` con tabla (miniatura, fecha, Focus area con tooltip, score), paginación de cliente «Show all», enlace de vuelta desde la crítica cuando se llega por el historial, marcador de «Progress trends» deferido, y despliegue de ambas imágenes nuevas en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- Gráficos o datos reales de tendencias (`GET /api/trends`, `GET /api/trends/history`): T04.
- Flujo de upgrade/`subscribe`, pantalla `/upgrade`: ya existe su cascarón, no se toca.
- El contador de subidas y su bloqueo en 0 (C-76): sigue pendiente de u9-T02; esta tarea no lo toca.
- El voto «Was this critique useful?» (C-77): sin API, sigue sin pintarse.
- Borrado de historial (u13): no se añade ningún botón de borrar fila ni de borrar cuenta.
- Paginación real en el servidor, filtros, orden por columna, búsqueda.
- Cualquier cambio en `identity-service`, `trust-service`, `progress-service`, `backend`, `packages/auth-middleware`.
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, `vite.config.ts`, el `ConfigMap` de nginx, el `Dockerfile` ni la CSP.
- Tests end-to-end con navegador, modo oscuro, i18n, animaciones.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/mockups.md` (pantalla 4, líneas ~201-239: tabla, «Focus area», tooltip, «Show all», bloque «PROGRESS TRENDS» deferido)
- `packages/shared-types/src/uploads.ts` (`UploadListItemSchema`, `UploadListSchema`, a extender) y `anthropic.ts` (`CATEGORY_NAME_BY_ID`, `CategoryIdSchema`)
- `apps/ingestion-service/src/handlers/uploads.ts` (handler `GET /` líneas ~235-255, y `GET /:uploadId` líneas ~262-294 como patrón de `signThumbnailUrl`), `apps/ingestion-service/src/service/thumbnail-url.ts` (`signThumbnailUrl`, `verifyThumbnailSignature`), `apps/ingestion-service/src/handlers/thumbnail.ts` (no se toca, solo referencia)
- `apps/ingestion-service/src/__tests__/` (tests existentes de `GET /api/uploads` y del detalle, para extenderlos sin romper los actuales)
- `apps/frontend/src/pages/History.tsx` (hoy un cascarón `ComingSoon`, a reemplazar), `apps/frontend/src/pages/Critique.tsx` (enlace «← Back», líneas ~120-155), `apps/frontend/src/components/{RecentUploads,ScoreBadge}.tsx` (patrón a reutilizar: miniatura, etiqueta `Low confidence`/`Ready`, lista vacía)
- `apps/frontend/src/api/{client,endpoints,uploads}.ts`, `src/lib/format-date.ts`
- `apps/frontend/src/App.tsx` (ruta `/history`, ya registrada apuntando al cascarón)
- `k8s/ingestion/deployment.yaml` y `k8s/frontend/deployment.yaml` (tags a actualizar)
- `tareas/u0-T02-frontend-upload-critique.md` (molde de CA de UI, despliegue y flujo por proxy) y `apps/frontend/src/__tests__/helpers.tsx` (`installFetch`, `renderApp`, `LocationProbe`)
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + RTL, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `npm run build -w packages/auth-middleware`. Los `Esperado` de conteos de tests se comparan contra `main`.

- [ ] **CA-1** — **`thumbnailUrl` en `UploadListItemSchema` (shared-types).**

  ```bash
  grep -n -A3 "export const UploadListItemSchema" packages/shared-types/src/uploads.ts
  npm run build -w packages/shared-types 2>&1 | tail -5
  ```

  Esperado: el schema incluye `thumbnailUrl: z.string().min(1).optional()`; el build pasa sin errores de tipos en los paquetes que lo importan.

- [ ] **CA-2** — **Ingestion firma `thumbnailUrl` en `GET /api/uploads`, rojo primero.**

  ```bash
  npm test -w apps/ingestion-service -- uploads --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -n "signThumbnailUrl" apps/ingestion-service/src/handlers/uploads.ts
  ```

  Esperado: el handler `GET /` llama a `signThumbnailUrl({ uploadId, key: signingKey, nowMs: now() })` para **cada** item, igual que el handler de detalle; un test nuevo comprueba que la respuesta de `GET /api/uploads` trae `thumbnailUrl` con el prefijo `/api/uploads/<uploadId>/thumbnail?` para un item `ready` y para uno `low_confidence`. La bitácora pega la salida roja del test antes del fix (commit separado) y la verde después.

  **Mutación observable:** devolver el item sin `thumbnailUrl` hace fallar el test nuevo.

- [ ] **CA-3** — **El listado sigue cumpliendo `UploadListSchema` y los tests existentes de ingestion no retroceden.**

  ```bash
  npm test -w apps/ingestion-service -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  npm test -w apps/ingestion-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  git diff main...HEAD --name-only -- apps/identity-service apps/trust-service apps/progress-service apps/backend | wc -l
  ```

  Esperado: **más** tests que en `main` (anota el conteo de `main` al redactar y compáralo), ninguna suite fallida; cobertura ≥80% líneas global y ≥75% ramas en `service/` y `handlers/` de ingestion, sin bajar los umbrales existentes; `wc -l` da `0` (ningún otro servicio backend cambia).

- [ ] **CA-4** — **Cliente HTTP y schema del frontend validan el campo nuevo.**

  ```bash
  npm test -w apps/frontend -- uploads-api history --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -rn "UploadListSchema\|UploadListItemSchema" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__
  ```

  Esperado: la lectura de `GET /api/uploads` sigue validando con `UploadListSchema` importado de `shared-types` (sin schema propio); un item sin `thumbnailUrl` (campo opcional) no rompe la validación.

- [ ] **CA-5** — **Tabla de historial, por valor (US-5, pantalla 4).**

  ```bash
  npm test -w apps/frontend -- history --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/uploads` falso (≥3 items, mezcla de `ready` y `low_confidence`, orden como lo da el servidor — más reciente primero):

  - Encabezado `My History`; tabla con columnas en este orden: imagen, fecha (UTC, `Sep 24, 2026`), `Focus area`, `Score`.
  - Para un item `ready`: `Focus area` muestra el nombre en mayúsculas de la categoría con el score **más bajo** de `scores` (empate → `categoryId` más bajo); `Score` pinta el `ScoreBadge` de esa misma categoría (`<score> / 100`, mismo color por umbral que en la crítica).
  - Para un item `low_confidence`: `Focus area` muestra `—` sin tooltip; `Score` muestra la etiqueta `Low confidence` (sin badge numérico).
  - Miniatura: `thumbnailUrl` con prefijo `/api/uploads/` → `<img>` con ese `src` tal cual; cualquier otro valor o ausente → sin `<img>` en esa celda (ni siquiera un marcador roto).
  - Tooltip de `Focus area` (solo en items `ready`): atributo accesible (`title` o equivalente) con el texto exacto `The category with the most room to improve in this upload.`
  - Clic en una fila (o `Enter` sobre ella si es accesible por teclado) navega a `/uploads/<uploadId>` con `state: { from: 'history' }` (se verifica con `LocationProbe` y `location-state`).
  - Lista vacía (`items: []`) → texto `No uploads yet` y un enlace a `/upload`; sin tabla.
  - Error de la lectura (`5xx` o red) → mensaje en `role="alert"` (p. ej. `We could not load your history. Please try again.`), sin tabla rota; un `401` cierra la sesión.

  **Mutación observable:** calcular `Focus area` por el score más **alto**, o pintar la miniatura sin comprobar el prefijo, **hace fallar** su test.

- [ ] **CA-6** — **Paginación de cliente «Show all».**

  ```bash
  npm test -w apps/frontend -- history-pagination --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con 12 items falsos devueltos en **una sola** respuesta de `GET /api/uploads`: la tabla pinta inicialmente **10** filas y un enlace `Show all 12`; al activarlo se pintan las 12 sin una segunda llamada a `fetch` (contador = 1); con ≤10 items no aparece el enlace.

  **Mutación observable:** pintar las 12 filas desde el inicio (sin el límite de 10) **hace fallar** su test.

- [ ] **CA-7** — **Marcador de tendencias deferido y enlace de vuelta desde la crítica.**

  ```bash
  npm test -w apps/frontend -- history critique --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado:

  - Debajo de la tabla, el texto `Progress trends — coming in a future update`, visible y sin gráficos ni placeholders de categoría (eso es T04).
  - En `Critique.tsx`: al llegar navegando desde `/history` (con `state: { from: 'history' }`), el enlace «← Back» apunta a `/history`; al llegar desde `/upload` (sin ese estado, el camino de u0-T02), sigue apuntando a `/upload`. Se prueba con `LocationProbe` y navegación directa con y sin el estado.

  **Mutación observable:** que «← Back» ignore el estado y siempre vaya a `/upload` **hace fallar** el test de este CA.

- [ ] **CA-8** — **Rutas, guardas y accesibilidad de `/history`.**

  ```bash
  npm test -w apps/frontend -- routes a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin token, `/history` redirige a `/login` sin llamar a ninguna API; con onboarding incompleto, a `/onboarding`; con sesión completa se pinta dentro de `AppLayout`. Exactamente un `h1`; errores en `role="alert"`; la tabla es navegable por teclado (fila enfocable con `Tab`, activable con `Enter`); el enlace `Show all` es un control real (`button` o `a`), no un `div` con `onClick`. Los comportamientos de CA-10 de u0-T02 siguen en verde.

- [ ] **CA-9** — **Los demás workspaces no cambian salvo ingestion, y todos los tests pasan.**

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  for w in identity-service trust-service progress-service backend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/frontend/src apps/ingestion-service/src || echo "sin skip, only ni todo"
  ```

  Esperado: frontend sin suites fallidas y **más** tests que `main` (anota el conteo de `main` al redactar); los otros cuatro servicios con los mismos tests y suites que en `main`; `sin skip, only ni todo`.

- [ ] **CA-10** — **Lint, build de todo el monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` sin fallidas; prettier limpio sobre el diff. Sin cambios en `eslint.config.js`, `turbo.json`, `.prettierrc` ni `vite.config.ts`.

- [ ] **CA-11** — **Cobertura sobre los pisos, sin rebajarlos (frontend e ingestion).**

  ```bash
  npm test -w apps/frontend -- --coverage 2>&1 | grep -E "All files|api|auth|pages|components"
  npm test -w apps/ingestion-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  git diff main...HEAD -- apps/frontend/jest.config.js apps/ingestion-service/jest.config.js | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' || echo "jest.config sin cambios"
  ```

  Esperado: ≥80% líneas global y ≥75% ramas en `src/api/`/`src/auth/` (frontend) y `service/`/`handlers/` (ingestion); ningún `jest.config.js` cambia sus umbrales.

- [ ] **CA-12** — **Manifiestos: solo cambia el tag, en ambos servicios.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  git diff main...HEAD -- k8s/ingestion k8s/frontend | grep -E '^[-+] ' | grep -vE '^(---|\+\+\+)'
  grep -q "image: ingestion-service:u0-T03" k8s/ingestion/deployment.yaml || echo "FALLO: tag ingestion"
  grep -q "image: frontend:u0-T03" k8s/frontend/deployment.yaml || echo "FALLO: tag frontend"
  ! grep -rqE "image: .*:latest" k8s/ingestion k8s/frontend || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/ingestion/ -f k8s/frontend/
  ```

  Esperado: los únicos archivos tocados en `k8s/` son los dos `deployment.yaml`, y el único cambio en cada uno es el tag de imagen (`ingestion-service:u5-T03` → `ingestion-service:u0-T03`, `frontend:u0-T02-r2` → `frontend:u0-T03`); ningún `FALLO`; el servidor acepta los manifiestos. Los `ConfigMap` no cambian: si el codificador cree que alguno debe cambiar, ATENCIÓN en la bitácora y para.

- [ ] **CA-13** — **Despliegue en kind y lectura de vuelta (codificador, con autorización del humano para ingestion y frontend).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  lsof -i :3500 || echo "3500 libre"
  docker build -f apps/ingestion-service/Dockerfile -t ingestion-service:u0-T03 .
  kind load docker-image ingestion-service:u0-T03
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T03 .
  kind load docker-image frontend:u0-T03
  kubectl apply -f k8s/ingestion/ -f k8s/frontend/
  kubectl rollout status deployment/ingestion-service --timeout=180s
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get pods -l app=ingestion-service -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl port-forward svc/frontend 3500:8080 >$WORK/pf-frontend.log 2>&1 &
  sleep 3
  curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3500/health
  curl -s -o /dev/null -w "spa-history %{http_code} %{content_type}\n" http://localhost:3500/history
  for p in /api/uploads /api/users/me/limits /api/onboarding; do curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3500$p; done
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: ambos despliegues terminan con **un** pod `ready=true restarts=0` en la imagen nueva (`ingestion-service:u0-T03`, `frontend:u0-T03`); `health 200`; `spa-history 200 text/html`; las tres rutas de API dan `401` (sin token); los otros 4 pods (identity, trust, progress, backend) mismo nombre y edad en ambos `pods-*.txt`. Cierra el port-forward al terminar (corta el del humano: avísale antes). La bitácora registra cada `docker build`, `kind load`, `apply` y `rollout` con su salida.

- [ ] **CA-14** — **Flujo real de historial a través del proxy (revisor o humano; con autorización de port-forward y de registro/subida con usuarios `*.test`).** Si el sistema deniega un permiso, se reporta **no verificable**. **No uses los usuarios demo del humano.**

  ```bash
  E="u0t03-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"
  curl -s -o /dev/null -w "register %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9' > $WORK/ok.jpg
  curl -s -o /dev/null -w "upload %{http_code}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/ok.jpg;type=image/jpeg"
  curl -s -o $WORK/list.json -w "lista %{http_code}\n" http://localhost:3500/api/uploads -H "Authorization: Bearer $T"
  node -e 'const it=require(process.argv[1]).data.items[0]; console.log(typeof it.thumbnailUrl, (it.thumbnailUrl||"").split("?")[0])' $WORK/list.json
  URL=$(node -e 'console.log(require(process.argv[1]).data.items[0].thumbnailUrl)' $WORK/list.json)
  curl -s -o /dev/null -w "miniatura %{http_code} %{content_type}\n" "http://localhost:3500$URL"
  ```

  Esperado: `register 201`, `upload 202`, `lista 200`; el item trae `thumbnailUrl` tipo `string` con el prefijo `/api/uploads/<uuid>/thumbnail`; `miniatura 200 image/jpeg`. Cierra el port-forward y deja constancia del email `*.test` creado y de cuántas subidas se hicieron. Ningún JWT ni contraseña en el informe ni en la bitácora.

- [ ] **CA-15** — **Sin secretos en el diff, el árbol ni el bundle.**

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  grep -rEl "sk-ant-api[0-9]+|JWT_SECRET|ANTHROPIC" apps/frontend/dist 2>/dev/null || echo "bundle sin secretos"
  ```

  Esperado: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos`.

- [ ] **CA-16** — **Alcance exacto y commits atómicos, «rojo primero» commiteado.**

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list --reverse main..HEAD); do git show --name-only --format='%h %s' $c | head -14; done
  ```

  Esperado: solo archivos bajo `apps/frontend/`, `apps/ingestion-service/`, `packages/shared-types/`, `k8s/ingestion/deployment.yaml`, `k8s/frontend/deployment.yaml`, `package-lock.json` (si aplica) y `bitacoras/u0-T03.md`. ≥5 commits atómicos en este orden: (1) `thumbnailUrl` en `shared-types` y en ingestion, con el rojo de su test pegado en la bitácora; (2) tabla de historial con tests, rojo primero; (3) paginación de cliente; (4) marcador de tendencias y fix del enlace «← Back»; (5) k8s y bitácora. Ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`. Sin `git push`, sin PR.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- **Backend (ingestion, Jest):** `GET /api/uploads` devuelve `thumbnailUrl` firmado por item, para `ready` y para `low_confidence`. Rojo primero: el test se escribe y se corre contra el handler sin tocar, se pega la salida roja, luego se implementa el fix.
- **Frontend (Jest + RTL + `user-event`, `fetch` falso, sin red real):** tabla de historial por valor (orden, columnas, Focus area con empate, miniatura con guardia de prefijo, tooltip, navegación con `state`), paginación de cliente, lista vacía, errores, marcador de tendencias, fix del enlace «← Back» en la crítica, rutas y accesibilidad.

**Rojo primero:** antes de cualquier arreglo, el codificador reproduce el fallo (tanto el de ingestion como el primer test de la tabla de historial) y lo registra con la salida pegada en la bitácora. El par falla-pasa es la prueba.

---

## Notas

- Archivos que se **modifican en su sitio**: `packages/shared-types/src/uploads.ts`, `apps/ingestion-service/src/handlers/uploads.ts` (+ tests), `apps/frontend/src/pages/History.tsx`, `apps/frontend/src/pages/Critique.tsx`, `apps/frontend/src/App.tsx` (si la ruta necesita ajuste), componentes nuevos bajo `apps/frontend/src/components/` (p. ej. una tabla de historial reutilizando `ScoreBadge`), `k8s/ingestion/deployment.yaml`, `k8s/frontend/deployment.yaml`. Nada de duplicados con sufijo.
- **Permisos de cluster para esta tarea:** `docker build`, `kind load`, `kubectl apply` y `rollout status` sobre **ingestion-service y frontend únicamente** (ningún otro deployment), más el port-forward de `svc/frontend` en el 3500 o el 3503 de los agentes. Un rollout del frontend corta el port-forward del humano: avísale antes. Pregunta estos permisos al humano antes de que el codificador los use (§7/§13 del handoff); no se heredan de la ola anterior.
- **No reabre C-76 ni C-77.** El contador sigue en 10 siempre y el voto de utilidad sigue sin API; esta tarea no los toca aunque se vean en pantalla.
- Reutiliza `ScoreBadge` y el patrón de miniatura/etiqueta de `RecentUploads.tsx` en vez de reimplementarlos: evita que la tabla de historial y «Recent uploads» diverjan en el mismo cálculo de color o de prefijo seguro.
- Si al implementar aparece que `repo.listByUser` no trae lo necesario para firmar (p. ej. falta `uploadId` en el tipo interno), es un defecto de esta especificación: ATENCIÓN en la bitácora y ajusta con un bloque «Fix de especificación» antes de seguir.

---

_Redactada por el orquestador al abrir la ola 12 (u0-T03), tras decisión del humano de 2026-11-20 de resolver C-78 con cambio de backend._
