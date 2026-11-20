# u0-T05 — Frontend: pantalla de Settings y borrado de historial (confirmación "DELETE")

**Unidad:** u0 — frontend, tarea 5 (T01 base ✅, T02 subida/crítica ✅, T03 historial ✅, T04 tendencias/upgrade ✅). Cierra la parte de interfaz de **u13** (el backend, `DELETE /api/history`, ya está fusionado en u13-T01, PR #28).
**Historias que implementa:** US-13 (AC-13.1, AC-13.2, AC-13.3 — confirmación de dos pasos, borrado y persistencia de la cuenta), parte de US-12 (AC-12.1 — enlace a la política de datos desde Settings; **el contenido de la política no se construye aquí**, ver decisión 1).
**Depende de:** u0-T01 (#24), u0-T02 (#25), u0-T03 (#26), u0-T04 (#27), u13-T01 (#28, `DELETE /api/history` ya desplegado). Todas fusionadas.

**Decisiones del humano:**

- Tarea elegida al abrir la ola 15 (2026-11-20), tras cerrar u13-T01.
- **Sin mockup** (2026-11-20): `refined-mockups/mockups.md` no tiene una pantalla de Settings. Se diseña con `design-system-mapping.md` y las decisiones de abajo.
- **Política de datos: solo un enlace/cascarón por ahora** (2026-11-20). `/policy` pasa a existir como ruta (hoy no existe ninguna), pero con el mismo patrón "coming soon" que tuvieron `/upgrade` y `/history` antes de construirse (u0-T02/T03). **AC-12.1 no queda totalmente cumplido** por esta tarea: el enlace existe y es alcanzable en 1 clic desde Settings, pero no muestra el contenido real de `GET /api/policy`. Se registra como candidata (ver Notas).
- **Tras confirmar el borrado: la pantalla se queda en Settings con un mensaje de éxito** (2026-11-20), sin navegar a `/history` ni a ningún otro lado. El usuario decide a dónde ir después, desde la barra lateral.

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **`ApiClient.request` gana el método `DELETE`.** Hoy el tipo es `'GET' | 'POST'` (`apps/frontend/src/api/client.ts`); se amplía a `'GET' | 'POST' | 'DELETE'`. `DELETE /api/history` envía un body JSON (`{ confirmation: 'DELETE' }`), así que el cliente ya soporta cuerpo JSON en cualquier método (lo decide `RequestOptions.body`, no el verbo); solo falta el literal del método.
2. **`deleteHistory` nuevo en `apps/frontend/src/api/uploads.ts`** (o un archivo `settings.ts` si se prefiere separar; decisión del codificador, documentarla). Llama a `DELETE /api/history` con `{ confirmation: 'DELETE' }`, validado contra `DeleteHistoryRequestSchema` de `shared-types` **al construir el request**, no al leer la respuesta (`204` no tiene cuerpo: no hay nada que validar con Zod en la respuesta).
3. **Confirmación de dos pasos, en la misma pantalla (sin modal separado), US-13 AC-13.1:**
   - Un botón `Delete my history` abre una sección de confirmación (no navega, no es una ruta nueva).
   - La sección muestra una advertencia (`This will permanently delete all your uploaded images and critique history. This cannot be undone.`), un campo de texto con instrucción `Type DELETE to confirm` y un botón `Delete permanently`.
   - El botón **solo se activa** cuando el campo contiene exactamente la cadena `DELETE` (sensible a mayúsculas, sin espacios al inicio/fin; `delete`, `DELETE ` con espacio, o vacío lo mantienen deshabilitado). Se prueba por valor, no por longitud.
   - Un enlace/botón `Cancel` cierra la sección sin llamar a la API y limpia el campo de texto.
4. **Al confirmar:** el botón se deshabilita y cambia a `Deleting…`; llama **una vez** a `deleteHistory()`. Doble clic (o `Enter` + clic) con la petición en vuelo → **una sola** llamada a `fetch` (mismo patrón de doble envío que `Upgrade.tsx`/C-70).
   - `204` → la sección de confirmación se reemplaza por el mensaje `Your history has been deleted.` (AC-13.2); se dispara `useLimits().refresh({ fresh: true })` (AC-13.3: el contador vuelve a reflejar el reset del backend); el campo de texto y el botón de confirmación desaparecen (no se puede repetir la acción sin volver a abrir la sección, y al reabrirla el campo empieza vacío).
   - Error (`400`, `5xx`, red) → mensaje en `role="alert"` (`Could not delete your history — please try again.`); la sección de confirmación sigue visible con el campo tal como estaba, para reintentar sin volver a escribir "DELETE". Un `400` no debería ocurrir en uso normal (el botón ya exige el texto exacto), pero el cliente lo maneja igual que cualquier otro error, sin asumir que nunca llega.
   - `401` → cierra sesión (token borrado, navega a `/login`), igual que el resto de la app.
5. **La pantalla no vuelve a leer `GET /api/uploads` ni `/api/trends`** tras el borrado: sería redundante con la decisión 5 de arriba (no se navega a `/history`). Si el usuario navega allí después por su cuenta, esa pantalla hace su propia lectura fresca (ya construida en u0-T03) y mostrará la lista vacía.
6. **Accesibilidad:** el campo de confirmación tiene una etiqueta asociada (`Type the word DELETE to confirm`, no un placeholder suelto); el botón deshabilitado se anuncia como tal (`aria-disabled` o `disabled` nativo, ambos aceptables si el estado es verificable); el mensaje de éxito y el de error usan `role="status"`/`role="alert"` respectivamente; foco gestionado razonablemente (no se exige mover el foco a un sitio concreto, pero tampoco se pierde — se prueba que algún elemento visible queda enfocable tras cada transición).
7. **Textos de la interfaz en inglés**; el resto, en español.

---

## Alcance

**Dentro** (una línea, concreta):

> `ApiClient` gana el método `DELETE`; `deleteHistory` en el cliente API; pantalla `/settings` real (reemplaza el cascarón) con el enlace a `/policy` (cascarón nuevo) y el flujo completo de confirmación de dos pasos para `DELETE /api/history`; despliegue de la imagen nueva del frontend en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **El contenido real de la política de datos** (`GET /api/policy`): `/policy` es un cascarón "coming soon", no una lectura real. Construirlo es una tarea futura (candidata, ver Notas).
- Cualquier cambio en `apps/trust-service`, `apps/ingestion-service`, `apps/identity-service`, `packages/auth-middleware`: el endpoint `DELETE /api/history` y su cascada ya están fusionados (u13-T01) y funcionando; esta tarea solo los **consume**.
- El contador de subidas y su bloqueo en 0 (C-76/u9-T02): sigue pendiente; esta tarea solo refresca el contador tras el borrado, no lo conecta si no lo estuviera ya.
- El voto «Was this critique useful?» (C-77).
- Edición de perfil, cambio de contraseña, cierre de sesión desde Settings (el "Log out" ya existe en otras pantallas de error; no se duplica aquí a menos que el codificador lo considere trivial — si lo añade, que sea su propio commit y lo documente).
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, `vite.config.ts`, el `ConfigMap` de nginx, el `Dockerfile` ni la CSP.
- Tests end-to-end con navegador, modo oscuro, i18n, animaciones.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-12 líneas 306-323, US-13 líneas 327-355)
- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/design-system-mapping.md` — **sin mockup de pantalla** para Settings, se diseña con esto (`Alert`, `Button` variant `destructive` si existe en los componentes `ui/` del proyecto, o el patrón de color rojo ya usado en otros lados)
- `apps/frontend/src/api/client.ts` (`ApiClient.request`, método a ampliar), `src/api/uploads.ts` (patrón de función de API con `Outcome<T>`)
- `packages/shared-types/src/history.ts` (`DeleteHistoryRequestSchema`, ya fusionado en u13-T01)
- **Forma real del servidor (manda sobre el contrato, Lección 53):** `apps/trust-service/src/handlers/history.ts` (`DELETE /api/history`: `400` confirmación inválida, `204` éxito total o parcial, `500` solo si todo falló)
- `apps/frontend/src/pages/{Settings,Upgrade,History}.tsx` (`Upgrade.tsx` es el molde más cercano: botón de una acción con confirmación, guard de doble envío, `refresh({fresh:true})`), `src/components/ui/` (botones, alert, card disponibles)
- `apps/frontend/src/App.tsx` (ruta `/settings`, ya registrada apuntando al cascarón; añadir `/policy` nueva), `src/components/AppLayout.tsx` (enlace a Settings en la barra lateral, ya existe)
- `apps/frontend/src/lib/limits-context.tsx` (`useLimits().refresh`)
- `k8s/frontend/deployment.yaml`
- `tareas/u0-T04-frontend-trends-upgrade.md` (molde más reciente de CA de UI y despliegue) y `apps/frontend/src/__tests__/helpers.tsx` (`installFetch`, `renderApp`, `fakeJwt`, `LocationProbe`)
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + RTL, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor (si lo hay en esta ronda) o el propio orquestador los corre. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `npm run build -w packages/auth-middleware`. Los `Esperado` de conteos de tests se comparan contra `main`.

- [ ] **CA-1** — **`ApiClient` soporta `DELETE`.**

  ```bash
  npm test -w apps/frontend -- api-client --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -n "'GET' | 'POST'" apps/frontend/src/api/client.ts || echo "metodo DELETE agregado"
  ```

  Esperado: un test nuevo confirma que `request('DELETE', '/api/history', { body: {...} })` serializa el body como JSON, manda `Content-Type: application/json`, `Authorization: Bearer <token>` y usa el verbo `DELETE`; el primer `grep` ya no encuentra la unión vieja (la unión ahora incluye `'DELETE'`).

- [ ] **CA-2** — **`deleteHistory`, por valor.**

  ```bash
  npm test -w apps/frontend -- uploads-api settings --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -rn "DeleteHistoryRequestSchema" apps/frontend/src --include='*.ts' | grep -v __tests__
  ```

  Esperado: `deleteHistory()` llama a `DELETE /api/history` con `{ confirmation: 'DELETE' }` (validado contra `DeleteHistoryRequestSchema`, importado de `shared-types`); `204` se trata como éxito (`ok: true`); cualquier otro status como error (`ok: false`) sin inventar datos.

- [ ] **CA-3** — **Pantalla `/settings`: confirmación de dos pasos, por valor (US-13).**

  ```bash
  npm test -w apps/frontend -- settings --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado:

  - Encabezado `Settings`; botón `Delete my history` que abre la sección de confirmación (no navega: se verifica con `LocationProbe` que `pathname` no cambia).
  - El botón `Delete permanently` está deshabilitado con el campo vacío, con `delete` (minúsculas), con `DELETE ` (espacio al final) y con ` DELETE` (espacio al inicio); se habilita **solo** con exactamente `DELETE`.
  - `Cancel` cierra la sección sin llamar a `fetch` (contador = 0) y, si se reabre después, el campo vuelve a estar vacío.
  - Con el texto correcto, un clic en `Delete permanently` deshabilita el botón (`Deleting…`) y llama **una vez** a `DELETE /api/history`; doble clic en vuelo → sigue siendo una sola llamada.
  - `204` → aparece `Your history has been deleted.` en `role="status"`; el campo de texto y el botón de confirmación ya no están en el DOM; se invocó `refresh({ fresh: true })` del contexto de límites (verificado con un espía del contexto, no con `fetch`).
  - Error (`5xx`/red) → `Could not delete your history — please try again.` en `role="alert"`; la sección de confirmación sigue visible y el campo conserva `DELETE`.
  - `401` → cierra sesión (token borrado, navega a `/login`).

  **Mutación observable:** habilitar el botón con `delete` en minúsculas, o no limpiar el campo al reabrir tras `Cancel`, **hace fallar** su test.

- [ ] **CA-4** — **Enlace a `/policy` y cascarón.**

  ```bash
  npm test -w apps/frontend -- settings routes --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: en `Settings`, un enlace `Data Policy` navega a `/policy`; `/policy` (dentro de `AppLayout`/`RequireOnboarded`) pinta un `h1` y `Coming soon.` (mismo patrón que `/upgrade` antes de u0-T04), sin llamar a `GET /api/policy`.

- [ ] **CA-5** — **Rutas, guardas y accesibilidad.**

  ```bash
  npm test -w apps/frontend -- routes a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin token, `/settings` y `/policy` redirigen a `/login` sin llamar a ninguna API; con onboarding incompleto, a `/onboarding`; con sesión completa se pintan dentro de `AppLayout`. Exactamente un `h1` por pantalla; el campo de confirmación tiene etiqueta asociada; mensajes en `role="status"`/`role="alert"` según corresponda; todo operable con teclado (abrir la sección, escribir, confirmar o cancelar, sin usar el ratón). Los comportamientos de CA-6 de u0-T04 siguen en verde.

- [ ] **CA-6** — **Los demás workspaces no cambian y todos los tests pasan.**

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  for w in ingestion-service identity-service trust-service progress-service backend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  git diff main...HEAD --name-only -- apps/ingestion-service apps/identity-service apps/trust-service apps/progress-service apps/backend | wc -l
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/frontend/src || echo "sin skip, only ni todo"
  ```

  Esperado: frontend sin suites fallidas y **más** tests que `main` (anota el conteo de `main` al redactar: 318); los cinco servicios backend con los mismos tests y suites que `main`; `wc -l` da `0`; `sin skip, only ni todo`.

- [ ] **CA-7** — **Lint, build del monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` sin fallidas; prettier limpio. Sin cambios en `eslint.config.js`, `turbo.json`, `.prettierrc` ni `vite.config.ts`.

- [ ] **CA-8** — **Cobertura sobre los pisos, sin rebajarlos.**

  ```bash
  npm test -w apps/frontend -- --coverage 2>&1 | grep -E "All files|api|auth|pages|components"
  git diff main...HEAD -- apps/frontend/jest.config.js | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' || echo "jest.config sin cambios"
  ```

  Esperado: ≥80% líneas global y ≥75% ramas en `src/api/` y `src/auth/`; `jest.config.js` sin cambios de umbrales.

- [ ] **CA-9** — **Dependencias: ninguna nueva; auditoría en verde.**

  ```bash
  git diff main...HEAD -- apps/frontend/package.json | grep -E '^[-+] +"' || echo "sin cambios en package.json del frontend"
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  ```

  Esperado: `sin cambios en package.json del frontend`; `audit exit=0`.

- [ ] **CA-10** — **Manifiestos: solo cambia el tag.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  git diff main...HEAD -- k8s/frontend | grep -E '^[-+] ' | grep -vE '^(---|\+\+\+)'
  grep -q "image: frontend:u0-T05" k8s/frontend/deployment.yaml || echo "FALLO: tag"
  ! grep -rqE "image: .*:latest" k8s/frontend || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/frontend/
  ```

  Esperado: el único archivo de `k8s/` tocado es `k8s/frontend/deployment.yaml`, único cambio el tag (`frontend:u0-T04` → `frontend:u0-T05`); ningún `FALLO`; el servidor acepta el manifiesto.

- [ ] **CA-11** — **Despliegue en kind y lectura de vuelta (codificador, con autorización del humano para el frontend solamente).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  lsof -i :3500 || echo "3500 libre"
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T05 .
  kind load docker-image frontend:u0-T05
  kubectl apply -f k8s/frontend/
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl port-forward svc/frontend 3503:8080 >$WORK/pf-frontend.log 2>&1 &
  sleep 3
  curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3503/health
  curl -s -o /dev/null -w "spa-settings %{http_code} %{content_type}\n" http://localhost:3503/settings
  curl -s -o /dev/null -w "spa-policy %{http_code} %{content_type}\n" http://localhost:3503/policy
  curl -s -o /dev/null -w "delete-sin-token %{http_code}\n" -X DELETE http://localhost:3503/api/history -H "Content-Type: application/json" -d '{"confirmation":"DELETE"}'
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: **un** pod `ready=true restarts=0` con `frontend:u0-T05`; `health 200`; `spa-settings 200 text/html`; `spa-policy 200 text/html`; `delete-sin-token 401`; los otros 5 pods con el mismo nombre y edad en ambos `pods-*.txt`. Cierra el port-forward (usa el 3503; si usas el 3500 avisa que cortas el del humano).

- [ ] **CA-12** — **Flujo real de borrado a través del proxy (con autorización de port-forward y de registro/subida con usuarios `*.test`).** Si el sistema deniega un permiso, se reporta **no verificable**. **No uses los usuarios demo del humano.** Usa **1-2** subidas, no 10.

  ```bash
  E="u0t05-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"
  curl -s -o /dev/null -w "register %{http_code}\n" -X POST http://localhost:3503/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -X POST http://localhost:3503/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9' > $WORK/ok.jpg
  curl -s -o /dev/null -w "upload %{http_code}\n" -X POST http://localhost:3503/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/ok.jpg;type=image/jpeg"
  curl -s -w " %{http_code}\n" -X DELETE http://localhost:3503/api/history -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"confirmation":"not-delete"}'
  curl -s -o /dev/null -w "delete %{http_code}\n" -X DELETE http://localhost:3503/api/history -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"confirmation":"DELETE"}'
  curl -s -o /dev/null -w "lista-tras-borrado %{http_code}\n" http://localhost:3503/api/uploads -H "Authorization: Bearer $T"
  ```

  Esperado: `register 201`, `upload 202`; confirmación inválida `400`; `delete 204`; `lista-tras-borrado 200` (con `items: []`, aunque esto ya lo verificó u13-T01 — aquí solo se confirma que el frontend puede alcanzar el mismo endpoint por su propio proxy). Cierra el port-forward y deja constancia del email `*.test` creado. Ningún JWT ni contraseña en el informe ni en la bitácora.

- [ ] **CA-13** — **Sin secretos en el diff, el árbol ni el bundle.**

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  grep -rEl "sk-ant-api[0-9]+|JWT_SECRET|ANTHROPIC" apps/frontend/dist 2>/dev/null || echo "bundle sin secretos"
  ```

  Esperado: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos`.

- [ ] **CA-14** — **Alcance exacto y commits atómicos, «rojo primero» commiteado.**

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list --reverse main..HEAD); do git show --name-only --format='%h %s' $c | head -14; done
  ```

  Esperado: solo archivos bajo `apps/frontend/`, `k8s/frontend/deployment.yaml` y `bitacoras/u0-T05.md`. ≥4 commits atómicos en este orden: (1) `ApiClient` con `DELETE` + `deleteHistory`, rojo primero; (2) pantalla `/settings` con la confirmación de dos pasos, rojo primero; (3) cascarón `/policy` y enlace desde Settings; (4) k8s y bitácora. Ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`. Sin `git push`, sin PR.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea** (Jest + RTL + `user-event`, `fetch` falso, sin red real):

- `ApiClient` con el método `DELETE` y `deleteHistory` por valor.
- Confirmación de dos pasos: activación exacta del botón, cancelar y reabrir, éxito con refresco de límites, error con reintento, doble envío, `401`.
- Enlace y cascarón de `/policy`.
- Rutas, guardas y accesibilidad.

**Rojo primero:** el codificador escribe primero el test de `deleteHistory` y el de activación exacta del botón de confirmación, confirma que fallan contra el cascarón actual, y pega la salida roja en la bitácora.

---

## Notas

- Archivos que se **modifican en su sitio**: `apps/frontend/src/api/client.ts`, `apps/frontend/src/api/uploads.ts` (o `settings.ts` nuevo, a decisión del codificador), `apps/frontend/src/pages/Settings.tsx`, `apps/frontend/src/pages/Policy.tsx` (nuevo cascarón), `apps/frontend/src/App.tsx`, `k8s/frontend/deployment.yaml`. Nada de duplicados con sufijo.
- **Permisos de cluster para esta tarea:** `docker build`, `kind load`, `kubectl apply` y `rollout status` sobre **frontend únicamente**, más port-forward de `svc/frontend` (3503 o 3500 avisando). Pregúntalos al humano antes de usarlos.
- **Ronda de revisor:** por decisión del humano (2026-11-20), se salta la ronda de revisor para el resto de esta ola; el propio orquestador verifica tests, diff y despliegue antes de abrir el PR.
- **Candidata nueva para registrar al cerrar esta tarea:** construir la pantalla real de `/policy` que lea `GET /api/policy` y pinte el contenido (US-12, AC-12.1 queda pendiente de verdad hasta entonces).
- No reabre C-76 ni C-77.

---

_Redactada por el orquestador al abrir la ola 15 (u0-T05), sin mockup, con decisiones de alcance de política (cascarón) y de navegación post-borrado (sin salir de Settings) afirmadas por el humano el 2026-11-20._
