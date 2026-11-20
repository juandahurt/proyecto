# u0-T02 — Frontend: subida de imagen, contador de tier y vista de crítica (más C-75 y C-68)

**Unidad:** u0 — frontend (`kind: ui`), tarea 2 de 4 (T01 base ✅, T03 historial, T04 tendencias y upgrade).
**Historias que implementa:** US-1 (subida), US-2 (crítica en 5 categorías), US-3 (baja confianza, AC-3.1 a AC-3.3), US-9 (AC-9.1 contador visible y AC-9.2 estado en 0), en su parte de interfaz.
**Depende de:** u0-T01 (fusionada, #24), u1/u2/u3/u4 (ingestion) y u9/u10 (identity). Todas fusionadas y desplegadas.

**Decisiones del humano:**

- Frontend con React + Vite, pantallas del MVP y plan en 4 tareas (ola 10). El humano **no tiene mockups** y delegó el diseño: se usan los de AI-DLC (ver Archivos de contexto).
- **Esta tarea es solo frontend** (2026-11-19). El backend **no** cuenta las subidas ni bloquea en 0 (**C-76**, hallazgo del orquestador): `uploadsRemaining` es siempre 10 y el estado de 0 es inalcanzable en la práctica. El humano decidió no resolverlo aquí. Consecuencia para esta tarea: el contador se prueba con falsos (fetch inyectado) y el flujo real solo comprueba que el valor que devuelve el servidor se pinta; **no** se afirma que baje de 10 a 9.

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **Dos rutas nuevas, ambas dentro de `RequireOnboarded` y `AppLayout`:** `/upload` (pantallas 2A y 2B) y `/uploads/:uploadId` (pantallas 3A y 3B). Una tercera, `/upgrade`, es solo un cascarón «coming soon» (el botón «Upgrade» de 2A, 2B y la barra lateral no puede apuntar a un 404; el contenido llega en T04).
2. **La subida navega a `/uploads/:uploadId` con el `uploadId` de la respuesta `202`, y la vista de crítica siempre lee `GET /api/uploads/:uploadId`.** El `202` no trae fecha ni miniatura; el detalle sí (`timestamp`, `thumbnailUrl` firmada de 15 min). Un solo camino de lectura sirve también a T03 (clic en una fila del historial). El `status` (`ready` o `low_confidence`) decide 3A o 3B.
3. **`ApiClient` gana un cuerpo `FormData`.** Para multipart **no** se fija `Content-Type` (el navegador añade el `boundary`); se mantienen `Authorization` solo con `auth`, `credentials: 'omit'`, `redirect: 'error'` y `cache: 'no-store'`. El campo se llama `file` (lo exige multer).
4. **El contador sale de `GET /api/users/me/limits`** mediante un contexto en `AppLayout` (`useLimits()` con `limits`, `status` y `refresh()`), de modo que la barra lateral y la pantalla de subida comparten el dato. Se vuelve a leer al entrar en `/upload` y tras cada subida aceptada. **Si la lectura falla, la barra lateral dice que no está disponible y la subida sigue habilitada** (el servidor es la autoridad; fallar cerrado dejaría a un usuario sin poder subir por un fallo de lectura).
5. **La validación del cliente es solo UX.** Tipos `image/jpeg`, `image/png`, `image/webp` y 10 MiB (`10 * 1024 * 1024` bytes, igual que `MAX_UPLOAD_BYTES` del servidor). El servidor valida magic number, tamaño y nombre; la SPA **nunca** manda ni muestra el nombre del archivo del usuario.
6. **Se muestra una sola imagen por subida** (`multiple: false`) y **no hay vista previa local** (nada de `URL.createObjectURL`/`blob:`): la CSP de nginx ya permite `img-src 'self' data: blob:`, pero no hace falta ampliar superficie.
7. **La miniatura solo se pinta si `thumbnailUrl` empieza por `/api/uploads/`** (ruta relativa firmada). Cualquier otro valor (`https://…`, `javascript:`, vacío) no se renderiza como `<img>`.
8. **Fechas en UTC y en inglés** (`Sep 24, 2026`), con `Intl.DateTimeFormat('en-US', { timeZone: 'UTC' })`, para que no dependan de la zona de quien corre los tests.
9. **Diferencias respecto a los mockups, a propósito** (todas con candidata): sin voto «Was this critique useful?» (no hay API, **C-77**); «Recent uploads» sin miniatura ni nombre (el listado no los trae, **C-78**); sin animación escalonada de los badges (decoración); el enlace «← Back» de 3A/3B va a `/upload` (el historial es T03).
10. **Textos de la interfaz en inglés**, tal como los mockups y las historias. El resto, en español.

---

## Alcance

**Dentro** (una línea, concreta):

> En `apps/frontend`: primero el espía de consola global de los tests (C-75) y «Log out» en la pantalla de error de la guarda (C-68); luego la pantalla de subida con `react-dropzone`, el contador de tier y el estado en 0, la vista de crítica (3A) y de baja confianza (3B), «Recent uploads», el cascarón `/upgrade`, y el despliegue de la imagen nueva en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Cualquier cambio en el backend** (`apps/identity-service`, `ingestion-service`, `trust-service`, `progress-service`, `backend`), en `packages/auth-middleware` y en `packages/shared-types` (se **importa**; si falta algo, ATENCIÓN en la bitácora). En particular, **no arregles el contador** (C-76) ni añadas el voto (C-77).
- Historial, tabla y detalle desde el historial: T03. Tendencias y flujo de upgrade/`subscribe`: T04. Pantalla de Settings y de política de datos.
- Vista previa local de la imagen, varias imágenes a la vez, recorte, y cualquier edición del archivo en el cliente.
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, `vite.config.ts` (C-69), el `ConfigMap` de nginx, el `Dockerfile` ni la CSP. Si algo exige tocarlos, ATENCIÓN en la bitácora y para.
- Timeouts del lado del cliente (`AbortController`): nginx ya corta a los 60 s y el cliente lo trata como error del servidor.
- Tests end-to-end con navegador (C-72), modo oscuro, i18n, animaciones y cualquier pulido que no esté en el spec de interacción.
- Los hallazgos C-69, C-71, C-73 y C-74 de u0-T01.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/mockups.md` (pantallas 2A, 2B, 3A y 3B), `design-system-mapping.md` (colores del badge, tipografía, espaciado), `interaction-spec.md` (Drop Zone, Category Panels, Error States) y `accessibility-checklist.md`
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-1 a US-3 y US-9)
- `packages/shared-types/src/uploads.ts` (`UploadResultSchema`, `UploadDetailSchema`, `UploadListSchema`, `CategoryCritiqueSchema`), `limits.ts` (`LimitsResponseSchema`) y `anthropic.ts` (`CATEGORY_NAME_BY_ID`)
- **Formas reales de los servidores (mandan sobre el contrato, Lección 53):** `apps/ingestion-service/src/handlers/uploads.ts` (`POST` → `202`; `413` con envoltorio por multer, `422` «Invalid image format»/«Missing required field: file»; `GET /api/uploads`; `GET /api/uploads/:id` → `200`, `404`, `403`), `apps/ingestion-service/src/handlers/thumbnail.ts` y `apps/identity-service/src/handlers/limits.ts` (`resetDate` es `YYYY-MM-DD`; paid devuelve `null` en los tres campos numéricos y de fecha)
- `apps/frontend/src/api/client.ts`, `endpoints.ts`, `src/auth/AuthContext.tsx`, `src/auth/guards.tsx`, `src/components/AppLayout.tsx`, `src/pages/Onboarding.tsx` y `src/__tests__/helpers.tsx` (lo que se extiende)
- `k8s/frontend/` (`deployment.yaml` y `configmap.yaml`: el `client_max_body_size 11m` de `/api/uploads`, el `proxy_read_timeout 60s` y la CSP ya cubren esta tarea)
- `tareas/u0-T01-frontend-base-auth-onboarding.md` (molde de CA de UI y despliegue) y `revisiones/u0-T01/ronda-2.md` (las mutaciones N03…N17 de C-75)
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + RTL, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, límite de tamaño en el borde, sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci`, `npm run build -w packages/shared-types` y `npm run build -w packages/auth-middleware`. En macOS el `grep` no tiene `-P`; usa `perl -0ne` para varias líneas y **prueba tu comando con una mutación del propio comando** (L51). Los `Esperado` de conteos de tests se comparan contra `main`.

- [ ] **CA-1** — **C-75: espía de consola global, por construcción.** Vive en `jest.setup.ts` (que corre en **todos** los archivos de test, importen o no `helpers.tsx`).

  ```bash
  ls apps/frontend/src/__tests__/console-guard.ts
  grep -n "console-guard" apps/frontend/jest.setup.ts
  grep -rn "spyOn(console" apps/frontend/src | grep -v "console-guard" || echo "sin espias locales de consola"
  grep -rn "spyConsole" apps/frontend/src || echo "spyConsole eliminado"
  npm test -w apps/frontend -- console-guard --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: existe el módulo con `installConsoleGuard()`, `assertConsoleSilent()` y `allowConsole(reason)`; `jest.setup.ts` lo instala; **ningún** otro archivo hace `spyOn(console…)` y `spyConsole` ya no existe (los tests que lo usaban pasan a la guarda global). El guardián cubre `log`, `info`, `warn`, `error`, `debug`, `trace`, `dir` y `table`; un `afterEach` global llama a `assertConsoleSilent()` **antes** de restaurar los espías y **falla el test** si hubo alguna llamada, mostrando el método y los argumentos. `allowConsole(reason)` exige una razón no vacía (lanza si va vacía) y solo desactiva la guarda para ese test; `grep -rn "allowConsole(" apps/frontend/src --include='*.tsx' --include='*.ts' | grep -v console-guard` debe estar **vacío salvo justificación escrita en la bitácora** (por defecto, cero usos). `console-guard.test.ts` prueba **por valor**: tras `console.error('x')` la guarda lanza y nombra `error`; sin llamadas no lanza; `allowConsole('')` lanza; el espía de un test **no** contamina al siguiente. **Si un test existente deja de pasar porque escribía en la consola** (p. ej. avisos de `act` o de React Router), se corrige la causa; no se silencia.

- [ ] **CA-2** — **C-75, mutaciones observables.** Con la guarda instalada, cada una de estas mutaciones del **código de producción** hace fallar ≥ 1 test (el revisor las aplica una a una en una copia, corre `npm test -w apps/frontend -- --coverage=false`, y las revierte):

  | #   | Mutación                                                                          |
  | --- | --------------------------------------------------------------------------------- |
  | N03 | `console.log(password)` en el rechazo en el cliente del login                     |
  | N04 | `console.info(email)` en el rechazo en el cliente del registro                    |
  | N08 | `console.error(password)` en el rechazo en el cliente del registro                |
  | N10 | `console.warn(token)` cuando el token está expirado (`readToken`)                 |
  | N11 | `console.error(token)` en el `catch` de `saveToken`                               |
  | N13 | `console.log(<JWT>)` en `logout`                                                  |
  | N14 | `console.error(out)` en el error de `GET /api/onboarding` (`AuthContext`)         |
  | N15 | `console.log(api)` en el `401` de onboarding                                      |
  | N16 | `console.log(out)` en el **éxito** del onboarding                                 |
  | N17 | `console.error(localStorage.getItem('estudio.token'))` en el éxito del onboarding |
  | M01 | `console.log(token)` al aceptar la subida (`202`) en la pantalla de subida        |
  | M02 | `console.error(file.name)` al rechazar un archivo en el cliente                   |
  | M03 | `console.warn(thumbnailUrl)` al pintar la crítica                                 |
  | M04 | `console.error(limits)` cuando falla la lectura de `limits`                       |

  Esperado: las 14 hacen fallar la suite (`Tests: … failed`); sobre el código sin mutar la suite está en verde. La bitácora trae la salida de **cada** mutación pegada dentro de bloques de código. **No** se enumeran ramas: la guarda es global, así que cualquier rama nueva queda cubierta (Lección 52).

- [ ] **CA-3** — **C-68 y doble envío.** «Log out» en la pantalla de error de la guarda, y tests de doble envío que dejó C-70.

  ```bash
  npm test -w apps/frontend -- guard routes onboarding register --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: con token válido y `GET /api/onboarding` en `5xx` (y también por red) la pantalla «We could not load your account status» ofrece **Retry** y **Log out**; «Log out» borra `estudio.token` y termina en `/login` **sin** más llamadas a la API (contador de `fetch`); «Retry» vuelve a consultar. En registro y en onboarding, dos clics seguidos (o `Enter` + clic) con la petición en vuelo producen **una sola** llamada a `fetch`. **Mutación observable:** quitar el botón «Log out» o quitar el guard de doble envío **hace fallar** su test.

- [ ] **CA-4** — **Cliente HTTP multipart y endpoints de subida.**

  ```bash
  npm test -w apps/frontend -- api-client uploads-api --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  grep -rn "@proyecto/shared-types" apps/frontend/src/api --include='*.ts' | cut -c1-140
  grep -rnE "z\.object|z\.enum" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ || echo "sin schemas duplicados"
  ```

  Esperado: `uploadImage` envía `POST /api/uploads` con un `FormData` cuyo **único** campo es `file`; **no** fija `Content-Type` (el test lo mira por valor en `init.headers`); lleva `Authorization: Bearer <token>`; `credentials: 'omit'` y `redirect: 'error'`; la ruta es relativa. Las respuestas se validan con `UploadResultSchema`, `UploadDetailSchema`, `UploadListSchema` y `LimitsResponseSchema` **importados** de `shared-types` (el segundo `grep` los muestra; el tercero no encuentra schemas propios). Una respuesta que no cumple el schema se trata como error del servidor, no como éxito. Un `401` en cualquiera de las cuatro llamadas borra el token y navega a `/login`. Un `413` **sin cuerpo JSON** (así responde nginx, en HTML o vacío) se mapea igual que un `413` con envoltorio. **Mutación observable:** añadir `Content-Type: multipart/form-data` a mano **hace fallar** el test (rompería el `boundary`).

- [ ] **CA-5** — **Drop zone (pantalla 2A, spec «Drop Zone»).**

  ```bash
  npm test -w apps/frontend -- upload dropzone --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, por valor y con `userEvent.upload` / eventos de arrastre sobre `react-dropzone`:
  - Archivo válido (JPEG, PNG y WebP, de ≤ 10 MiB) → **una** llamada a `POST /api/uploads` y, al `202`, navegación a `/uploads/<uploadId>` (la ubicación actual).
  - Tipo no permitido (p. ej. `image/gif`, `application/pdf`) → texto exacto `Only JPEG, PNG, and WebP files are accepted` en `role="alert"` y **cero** `fetch`.
  - Archivo de 10 MiB + 1 byte → `File too large — maximum 10 MB` y cero `fetch`; el de exactamente 10 MiB **sí** se envía.
  - Dos archivos a la vez → texto exacto `Please upload one image at a time` en `role="alert"` y cero `fetch` (no se sube «el primero»).
  - Durante la petición: la zona se sustituye por un indicador de progreso (`role="status"`), no hay segundo envío aunque se suelte otro archivo (contador de `fetch` = 1) y los enlaces de la barra lateral siguen operables.
  - Errores del servidor (todos en `role="alert"`, **sin** navegar y **sin** guardar nada): `413` → `File too large — maximum 10 MB`; `422` → `That file doesn't look like a valid image`; `5xx` → `Upload failed — please try again`; error de red → `Upload failed — check your connection and try again`. Tras cualquier error la zona vuelve a estar disponible para reintentar.
  - «Browse file» es un `button` operable con teclado (`Tab` + `Enter`/`Space`) que abre el selector filtrado a imágenes (`accept`).
  - Estado de arrastre: al arrastrar sobre la zona el texto pasa a `Drop to upload`; al salir vuelve al original.
  - Un `401` al subir cierra la sesión (token borrado, `/login`).

  **Mutación observable:** subir un archivo de 10 MiB + 1 byte sin el chequeo de tamaño, o mapear el `422` al mensaje del `5xx`, **hace fallar** su test. El nombre del archivo del usuario **no** aparece nunca en el DOM, en la URL, en `localStorage` ni en la consola (el test construye un archivo con un nombre reconocible y busca esa cadena en `document.body.innerHTML`, la ubicación y `localStorage`).

- [ ] **CA-6** — **Contador de tier y estado en 0 (US-9, pantallas 2A/2B).**

  ```bash
  npm test -w apps/frontend -- limits usage-counter upload --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/users/me/limits` falso:
  - `free` con `uploadsRemaining: 7, uploadsLimit: 10` → en la barra lateral **exactamente** `7 of 10 uploads left this month` y un enlace «Upgrade» a `/upgrade`; visible en `/upload` **y** en `/uploads/:id` (AC-9.1: «any screen with the sidebar visible»).
  - `paid` (`null` en los tres campos) → sin contador y sin enlace «Upgrade»; se muestra la etiqueta `Paid`.
  - `free` con `uploadsRemaining: 0` → en `/upload` **no hay** zona de arrastre ni `input[type=file]` (`queryByRole`/`container.querySelector` vacíos); en su lugar el texto `You've used all 10 uploads for this month. Resets on <fecha>.` (con la fecha de `resetDate` como `<Month> <D>` en inglés y sin cero a la izquierda, p. ej. `Resets on October 1 (UTC).` para `2026-10-01`) y un botón `Upgrade for unlimited uploads` que navega a `/upgrade`. La región del aviso lleva `aria-live="polite"` y **el foco no se mueve** a ella.
  - Falla `limits` (`5xx` o red) → la barra lateral muestra `Upload count unavailable`, **la zona de arrastre sigue activa** y no se escribe nada en la consola.
  - Tras una subida aceptada (`202`) se vuelve a leer `limits` (contador de llamadas a `GET /api/users/me/limits`: una al entrar y una tras la subida).
  - Una respuesta de `limits` que no cumple `LimitsResponseSchema` se trata como «no disponible».

  **Mutación observable:** pintar la zona de arrastre con `uploadsRemaining: 0` **hace fallar** su test; que `paid` muestre «Upgrade» **hace fallar** el suyo.

- [ ] **CA-7** — **Vista de crítica normal (3A, US-2).**

  ```bash
  npm test -w apps/frontend -- critique score-badge --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/uploads/:id` falso (`status: 'ready'`, 5 categorías):
  - Un solo `h1`; la fecha de `timestamp` en UTC (`Sep 24, 2026` para `2026-09-24T…Z`); la sección «AI Critique».
  - Las 5 categorías en el **orden de `categoryId`** (CAT-1…CAT-5), con el nombre de `categoryName` en mayúsculas, el `feedback` por valor y el badge `72 / 100` (formato `<score> / 100`).
  - Color del badge por umbral, probado en los bordes: `49` → rojo, `50` → amarillo, `74` → amarillo, `75` → verde, `0` y `100` también. El color se expone con una clase y con un texto accesible (no solo color): `aria-label="Score 72 out of 100"`.
  - Miniatura: si `thumbnailUrl` es `/api/uploads/<id>/thumbnail?exp=…&sig=…` se renderiza `<img>` con ese `src` **tal cual** y `alt` descriptivo; con `https://example.test/x.png`, `javascript:alert(1)` o cadena vacía **no** hay `<img>`. Sin `thumbnailUrl` no hay `<img>` y la página no se rompe.
  - Enlace «← Back» a `/upload`.
  - **No** hay botones «Yes/No» de utilidad (C-77): `queryByText('Was this critique useful?')` es `null`.

  **Mutación observable:** ordenar por score en lugar de por `categoryId`, o pintar `thumbnailUrl` sin comprobar el prefijo, **hace fallar** su test.

- [ ] **CA-8** — **Vista de baja confianza (3B, US-3) y errores de carga.**

  ```bash
  npm test -w apps/frontend -- critique-low critique-errors --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado:
  - `status: 'low_confidence'` (con cualquiera de los tres `fallbackReason`) → encabezado `Critique Unavailable`, el texto `Estudio couldn't generate a reliable critique for this image.`, las tres razones de la lista del mockup, el aviso `This upload counted toward your monthly limit. It will not appear in your trends.` y un botón/enlace `Try another image` que navega a `/upload`. **No** se pinta ninguna categoría ni score.
  - Con `fallbackReason: 'timeout'` se añade `Analysis timed out` (spec de interacción); con los otros dos no.
  - `404` y `403` → **el mismo** mensaje `We couldn't find that critique.` con enlace a `/upload` (no se distingue «no existe» de «no es tuyo»); `5xx` y red → `We could not load this critique. Please try again.` con botón `Retry` que vuelve a pedir (contador de `fetch`); `401` → sesión cerrada.
  - Mientras carga se muestra un estado `role="status"`, no la crítica vacía.
  - Un `uploadId` que no es un UUID no llega a hacer `fetch` y muestra el mensaje de no encontrado.

  **Mutación observable:** mostrar las categorías en 3B, o diferenciar el mensaje de `403` y `404`, **hace fallar** su test.

- [ ] **CA-9** — **«Recent uploads» (2A/2B).**

  ```bash
  npm test -w apps/frontend -- recent-uploads upload --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/uploads` falso: hasta **5** filas, la más reciente primero (el orden que devuelve el servidor), cada una con la fecha en UTC, la etiqueta `Low confidence` si `status` es `low_confidence` y `Ready` si no, y un enlace `View` a `/uploads/<uploadId>`; lista vacía → `No uploads yet`; error de la lectura → la lista no aparece y **no** bloquea la zona de arrastre; la lista se recarga tras una subida aceptada. No hay miniaturas ni nombres (C-78).

- [ ] **CA-10** — **Rutas, guardas y cascarón `/upgrade`.**

  ```bash
  npm test -w apps/frontend -- routes guard --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin token, `/uploads/<uuid>` y `/upgrade` redirigen a `/login` **sin llamar a ninguna API**; con token y onboarding incompleto, a `/onboarding`; con onboarding completo se pintan dentro de `AppLayout`; `/upgrade` muestra un `h1` y `Coming soon.`; un `uploadId` que no es UUID cae en la pantalla de no encontrado de la crítica, no en un 404 global. Los comportamientos de CA-5 de u0-T01 siguen en verde (no se debilita ningún test existente).

- [ ] **CA-11** — **Accesibilidad verificable (checklist WCAG 2.1 AA del spec).**

  ```bash
  npm test -w apps/frontend -- a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: cada pantalla nueva tiene exactamente un `h1`; los errores de subida, de crítica y de contador se anuncian con `role="alert"` (o `role="status"`/`aria-live="polite"` para estados informativos); la zona de arrastre tiene nombre accesible y el `input` está asociado a una etiqueta; los badges llevan texto accesible; el orden de tabulación en `/upload` es barra lateral → zona → «Browse file» → lista; todo operable con teclado; en la vista de crítica el foco inicial queda en el encabezado (o en el primer control) y se prueba. **El estado `aria-live` del contador en 0 no roba el foco** (CA-6).

- [ ] **CA-12** — **Los demás workspaces no cambian y todos los tests pasan.**

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  npm run build -w packages/auth-middleware >/dev/null 2>&1
  for w in ingestion-service identity-service trust-service progress-service backend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  git diff main...HEAD --name-only -- apps/ingestion-service apps/identity-service apps/trust-service apps/progress-service apps/backend packages | wc -l
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/frontend/src || echo "sin skip, only ni todo"
  ```

  Esperado: frontend sin suites fallidas (`Test Suites:` **y** `Tests:`, C-57) y **más** tests que `main` (en `main`: 102); los otros cinco con los mismos tests y suites que en `main` (al redactar: ingestion 206/11, identity 74/12, trust 25/4, progress 171/9, backend 18/4; compara contra `main`); el `wc -l` da `0`; `sin skip, only ni todo`.

- [ ] **CA-13** — **Lint, build de todo el monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` con `0 cached` y sin fallidas; prettier limpio sobre el diff (`prettier --check .` global falla en `main` por C-51 y no cuenta). Sin cambios en `eslint.config.js`, `turbo.json`, `.prettierrc` ni `vite.config.ts`.

- [ ] **CA-14** — **Cobertura sobre los pisos, sin rebajarlos.**

  ```bash
  npm test -w apps/frontend -- --coverage 2>&1 | grep -E "All files|api|auth|pages|components"
  git diff main...HEAD -- apps/frontend/jest.config.js | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' || echo "jest.config sin cambios"
  grep -n -A10 coverageThreshold apps/frontend/jest.config.js
  ```

  Esperado: ≥ 80 % de líneas globales y ≥ 75 % de ramas en `src/api/` y `src/auth/` (el equivalente de `service/` y `handlers/`); el `diff` de `jest.config.js` es **vacío** (no se tocan umbrales; las exclusiones de `collectCoverageFrom` siguen siendo solo `src/main.tsx`, `src/**/*.d.ts` y `src/__tests__/**`, **declaradas aquí** por C-70). La salida muestra los pisos intactos.

- [ ] **CA-15** — **Dependencias nuevas acotadas, auditoría en verde y versiones fijadas.**

  ```bash
  git diff main...HEAD -- apps/frontend/package.json | grep -E '^[-+] +"' | sort
  git diff main...HEAD --name-only | grep -E "package(-lock)?\.json"
  git diff main...HEAD -- package-lock.json | grep -E '^\+ +"node_modules/' | sort
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  git diff main...HEAD -- apps/frontend/package.json | grep -E '"(latest|next|\*)"' | grep -v '@proyecto/' || echo "sin latest ni comodines"
  git diff main...HEAD -- package.json | grep -E '^[-+] ' | grep -vE "^(---|\+\+\+)" || echo "package.json raiz sin cambios"
  ```

  Esperado: **una** dependencia directa nueva, `react-dropzone` **fijada a `20.1.4` sin `^`** (la 20.2.0 y la 20.2.1 se publicaron hace menos de dos semanas: no se usan; el codificador comprueba con `npm view react-dropzone time --json` que la 20.1.4 existe y sigue disponible, y si no, elige la más reciente con más de 14 días y lo justifica). Sus transitivas (`attr-accept`, `file-selector` y lo que arrastren) son las únicas entradas nuevas del lockfile, cada una **justificada en la bitácora**. Los únicos `package*.json` tocados son `apps/frontend/package.json` y `package-lock.json`. **`audit exit=0`** (si la dependencia lo rompe, se cambia de versión o de librería; no se baja el umbral). `sin latest ni comodines` y `package.json raiz sin cambios`.

- [ ] **CA-16** — **Manifiestos: solo cambia el tag.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  git diff main...HEAD -- k8s/frontend | grep -E '^[-+] ' | grep -vE '^(---|\+\+\+)'
  grep -q "image: frontend:u0-T02" k8s/frontend/deployment.yaml || echo "FALLO: tag"
  ! grep -rqE "image: .*:latest" k8s/frontend || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/frontend/
  ```

  Esperado: el único archivo de `k8s/` es `k8s/frontend/deployment.yaml` y el único cambio es `image: frontend:u0-T01-r2` → `image: frontend:u0-T02`; **ningún** `FALLO`; el servidor acepta los tres manifiestos (`--dry-run=server`; `--dry-run=client` no discrimina, C-61). El ConfigMap **no** cambia: si el codificador cree que debe cambiar (p. ej. un límite de tamaño o la CSP), ATENCIÓN en la bitácora y para. **Tag nuevo siempre**: nunca `latest` ni reutilizar `u0-T01-r2` (L11).

- [ ] **CA-17** — **Despliegue en kind y lectura de vuelta (CA-17a, codificador, con autorización del humano para el frontend solamente).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  kubectl get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'   # estado inicial: frontend:u0-T01-r2
  lsof -i :3500 || echo "3500 libre"
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T02 .
  kind load docker-image frontend:u0-T02
  kubectl apply -f k8s/frontend/
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl port-forward svc/frontend 3500:8080 >$WORK/pf-frontend.log 2>&1 &
  sleep 3
  curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3500/health
  curl -s -o /dev/null -w "spa-upload %{http_code} %{content_type}\n" http://localhost:3500/upload
  curl -s -o /dev/null -w "spa-critique %{http_code} %{content_type}\n" http://localhost:3500/uploads/00000000-0000-4000-8000-000000000000
  curl -sI http://localhost:3500/ | grep -iE "x-content-type-options|content-security-policy|x-frame-options"
  for p in /api/uploads /api/users/me/limits /api/trends /api/onboarding; do curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3500$p; done
  JS=$(curl -s http://localhost:3500/ | grep -oE '/assets/[^"]+\.js' | head -1); curl -s http://localhost:3500$JS | grep -c "Only JPEG, PNG, and WebP files are accepted"
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: imagen inicial `frontend:u0-T01-r2`; el 3500 estaba libre (L45: confirma que el port-forward arrancó mirando `$WORK/pf-frontend.log`); imagen final `frontend:u0-T02 RollingUpdate`; **un** pod `ready=true restarts=0` con esa imagen; `health 200`; `spa-upload 200 text/html` y `spa-critique 200 text/html` (la recarga de una ruta del cliente funciona); las tres cabeceras de seguridad; `/api/uploads`, `/api/users/me/limits`, `/api/trends` y `/api/onboarding` dan **401** (la petición llegó al servicio correcto); el `grep -c` del bundle da ≥ `1` (el copy nuevo llegó al build). **Los otros 5 pods con el mismo nombre y la misma edad** en `pods-antes.txt` y `pods-despues.txt`. Cierra el port-forward al terminar. La bitácora registra cada `docker build`, `kind load`, `apply` y `rollout` con su salida.

- [ ] **CA-18** — **Flujo real de subida a través del proxy (CA-18b, revisor o humano; solo con autorización de port-forward a `svc/frontend` y de registro y subida con usuarios `*.test`).** Si el sistema deniega un permiso, se reporta **no verificable** y no se esquiva (L22). **Límite honesto:** sin navegador automatizado esta tarea **no prueba el DOM real**; lo cubren RTL (CA-3 a CA-11) y este flujo HTTP. **No uses los usuarios demo del humano** (`demo-nuevo-…` y `demo-hecho-…`).

  ```bash
  # Puerto 3500 (lsof -i :3500 antes; 3300 es del humano, 3301 y 3401 los ocupan procesos ajenos). NO imprimas ningún JWT.
  E="u0t02-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"; E2="u0t02b-$(date +%s)@rev.test"
  curl -s -o /dev/null -w "register %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  curl -s -o /dev/null -w "register2 %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E2\",\"password\":\"$P\"}"
  curl -s -o $WORK/login2.json -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E2\",\"password\":\"$P\"}"
  T2=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login2.json)
  printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9' > $WORK/ok.jpg
  printf 'not an image' > $WORK/fake.jpg
  dd if=/dev/zero of=$WORK/big-multer.jpg bs=1048576 count=10 2>/dev/null; printf '\xff\xd8\xff' | dd of=$WORK/big-multer.jpg conv=notrunc 2>/dev/null; dd if=/dev/zero bs=1024 count=512 2>/dev/null >> $WORK/big-multer.jpg
  dd if=/dev/zero of=$WORK/big-nginx.jpg bs=1048576 count=12 2>/dev/null
  curl -s -w " %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  curl -s -o $WORK/up.json -w "upload-ok %{http_code}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/ok.jpg;type=image/jpeg"
  ID=$(node -e 'console.log(require(process.argv[1]).data.uploadId)' $WORK/up.json)
  node -e 'const d=require(process.argv[1]).data; console.log(d.status, d.confidence, (d.categories||[]).length)' $WORK/up.json
  curl -s -o $WORK/detail.json -w "detalle %{http_code}\n" http://localhost:3500/api/uploads/$ID -H "Authorization: Bearer $T"
  URL=$(node -e 'console.log(require(process.argv[1]).data.thumbnailUrl)' $WORK/detail.json); printf '%s\n' "${URL%%\?*}"
  curl -s -o /dev/null -w "miniatura %{http_code} %{content_type}\n" "http://localhost:3500$URL"
  curl -s -o /dev/null -w "detalle-ajeno %{http_code}\n" http://localhost:3500/api/uploads/$ID -H "Authorization: Bearer $T2"
  curl -s -o /dev/null -w "lista %{http_code}\n" http://localhost:3500/api/uploads -H "Authorization: Bearer $T"
  curl -s -w " %{http_code}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/fake.jpg;type=image/jpeg"
  curl -s -w " %{http_code}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/big-multer.jpg;type=image/jpeg"
  curl -s -o /dev/null -w "nginx-413 %{http_code} %{content_type}\n" -X POST http://localhost:3500/api/uploads -H "Authorization: Bearer $T" -F "file=@$WORK/big-nginx.jpg;type=image/jpeg"
  curl -s -o /dev/null -w "sin-token %{http_code}\n" -X POST http://localhost:3500/api/uploads -F "file=@$WORK/ok.jpg;type=image/jpeg"
  curl -s -w " %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  ```

  Esperado: `register 201` y `register2 201`; `limits` inicial `free`, `uploadsRemaining` `10`, `uploadsLimit` `10`, `resetDate` `YYYY-MM-DD`; `upload-ok 202` y la línea de `node` imprime `ready HIGH 5` (el cliente de Claude es un stub); `detalle 200`; la ruta de la miniatura imprime `/api/uploads/<uuid>/thumbnail` (sin `exp`/`sig` en el informe); `miniatura 200 image/jpeg`; `detalle-ajeno 403`; `lista 200`; subida falsa → `{"data":null,"error":"Invalid image format","status":422} 422`; la de 10,5 MiB → `{"data":null,"error":"File too large. Maximum upload size is 10 MB.","status":413} 413` (multer, tras pasar el borde de 11 MiB); la de 12 MiB → `nginx-413 413 text/html…` (**responde nginx, sin envoltorio**: por eso el cliente trata el `413` sin JSON, CA-4); `sin-token 401`. El `limits` final **se registra tal cual**: hoy sigue en `10` por **C-76**; eso **no** es un fallo de esta tarea, pero el informe debe decirlo con esas palabras. Cierra el port-forward y deja constancia de los emails `*.test` creados y de cuántas subidas se hicieron (las imágenes quedan en el PVC `ingestion-blobs`; que sean pocas). Ningún JWT, contraseña, `exp` ni `sig` en el informe ni en la bitácora.

- [ ] **CA-19** — **Sin secretos en el diff, el árbol ni el bundle** (CA estándar, ampliado).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  grep -rEl "sk-ant-api[0-9]+|JWT_SECRET|ANTHROPIC" apps/frontend/dist 2>/dev/null || echo "bundle sin secretos"
  grep -rnE "localhost|127\.0\.0\.1|:3[0-9]{3}" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ || echo "sin hosts ni puertos en el codigo"
  ```

  Esperado: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos` y `sin hosts ni puertos en el codigo`. Los tests usan el JWT evidentemente falso de `helpers.tsx` y contraseñas obviamente falsas; no citan literales con forma de clave (C-29).

- [ ] **CA-20** — **Alcance exacto, commits atómicos y «rojo primero» commiteado (C-70).**

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list --reverse main..HEAD); do git show --name-only --format='%h %s' $c | head -14; done
  ```

  Esperado: solo archivos bajo `apps/frontend/`, `k8s/frontend/deployment.yaml`, `package-lock.json` y `bitacoras/u0-T02.md`. ≥ 6 commits atómicos, cada uno con solo lo que nombra su mensaje, en este orden: (1) guarda de consola global (C-75) con sus tests; (2) C-68 y dobles envíos; (3) **«rojo»**: los tests de subida, contador y crítica con cuerpos neutros, **commiteados aunque fallen**, con la salida roja en la bitácora; (4) implementación de la subida y del contador; (5) vista de crítica, lista y `/upgrade`; (6) k8s y bitácora. Ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`. Sin `git push`, sin PR.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea** (Jest + React Testing Library + `user-event`; `fetch` falso inyectado, sin red real):

- **`console-guard`:** la guarda lanza por valor, nombra el método, exige razón, no contamina entre tests.
- **`api-client` y `uploads-api`:** `FormData` sin `Content-Type`, campo `file`, `Authorization`, schemas de `shared-types`, `401`, `413` sin JSON.
- **`upload` y `dropzone`:** cada rama de CA-5 con asserts **por valor** (contador de `fetch`, ubicación, texto exacto, nombre de archivo ausente del DOM).
- **`limits` y `usage-counter`:** las cinco ramas de CA-6, con el contador de llamadas a `limits`.
- **`critique`, `critique-low`, `critique-errors`, `score-badge`:** CA-7 y CA-8, con los bordes 49/50/74/75 y los valores peligrosos de `thumbnailUrl`.
- **`recent-uploads`, `routes`/`guard`, `a11y`:** CA-9 a CA-11.
- **Las 14 mutaciones de CA-2** se aplican **una vez** al final, con la salida de cada una pegada en la bitácora.

**Rojo primero (de ejecución, no de compilación — L13):** crea los módulos con la firma correcta y cuerpos neutros (el cliente devuelve siempre `{ok:false}`, las pantallas se pintan vacías), escribe los tests y registra que **fallan por aserción**; **commitea ese rojo** (CA-20) y después implementa. Para C-75 el rojo es: **antes** de instalar la guarda, aplica N08 y N16 en una copia y corre la suite: **sobreviven** (102/102 en verde); registra esa salida. **Después** de instalarla, las 10 mutaciones N03…N17 fallan (CA-2); registra ambas salidas. M01…M04 solo se pueden aplicar cuando el código que mutan ya existe. Para infraestructura, antes de aplicar registra la lectura del estado inicial (`frontend:u0-T01-r2`).

---

## Fix de especificación (pre-revisión, 2026-11-19)

Error del orquestador detectado por el codificador (ver `bitacoras/u0-T02.md`, ATENCIÓN 3):

- **CA-7, miniatura con cadena vacía:** pedí que `thumbnailUrl: ''` diera «sin `<img>` y la crítica sigue viva». `UploadDetailSchema` define `thumbnailUrl: z.string().min(1).optional()`, así que una respuesta con `''` **no cumple el schema** y, según CA-4, se trata como error del servidor. **Manda el schema:** con `''` la pantalla muestra `We could not load this critique. Please try again.` (CA-8) y no hay `<img>`. Se mantiene sin cambios: **sin** `thumbnailUrl` (ausente) no hay `<img>` y la crítica se pinta; con `https://…` o `javascript:` (cadenas no vacías que sí cumplen el schema) no hay `<img>` y la crítica se pinta. Cambiar el schema queda fuera de alcance. El test del codificador ya fija esto.
- **ATENCIÓN 2 del codificador (lockfile):** `npm` resolvió `file-selector` 5.0.3 (publicada 2026-11-15, 4 días antes); el codificador dejó 5.0.2 (2026-10-31) editando `version`, `resolved` e `integrity` a mano. El `integrity` se comprobó contra el registro (`npm view file-selector@5.0.2 dist.integrity`) y coincide. **Aceptado.** El revisor no debe tratarlo como defecto salvo que `npm ci` falle.
- **ATENCIÓN 1 del codificador (engines):** `react-dropzone`, `attr-accept` y `file-selector` declaran `engines.node >= 22` y el `Dockerfile` construye con `node:20-slim` (fuera de alcance). El build termina bien; se anota como candidata (C-79), no se resuelve aquí.

## Fix de especificación (ronda 2, 2026-11-19)

Hallazgos de la ronda 1 (`revisiones/u0-T02/ronda-1.md`, NO-VERDE) y mi arbitraje. Entran en la ronda 2: F-01, F-02, F-03, F-05 y F-06. F-04 no cambia código (comprobación visual del humano).

- **Tag de la imagen de la ronda 2: `frontend:u0-T02-r2`** (F-03 y F-05 cambian código de producción: la imagen cambia y nunca se reutiliza `u0-T02`, L11). `k8s/frontend/deployment.yaml` pasa a `image: frontend:u0-T02-r2`. En CA-16 y CA-17 donde dice `frontend:u0-T02` léase `frontend:u0-T02-r2`; la imagen inicial que se lee antes de aplicar es `frontend:u0-T02`.
- **F-03 (ROJO, defecto de código; mi CA-8 no probaba el rol):** el estado «no encontrado» de la crítica (404, 403 y `uploadId` que no es UUID) se anuncia con `role="alert"` (como el error de carga 5xx). El test de `a11y` cubre **los tres** casos y comprueba `closest('[role=alert],[role=status],[aria-live]')` sobre el mensaje. **Mutación observable:** quitar el rol **hace fallar** ese test.
- **F-01 (NARANJA, hueco de mi CA-1/CA-2: «por construcción» no incluía el alias):** la guarda se instala **una vez al cargar `jest.setup.ts`** (nivel de módulo, antes de que se importe cualquier archivo de test o de producción), y `beforeEach`/`afterEach` solo **reinician el contador y comprueban**; no sustituyen ni restauran `console` por test. Así `const dbg = console.error` a nivel de módulo o `const { error } = console` quedan ya apuntando a la guarda. Se añaden dos mutaciones a CA-2: **M05** `const dbg = console.error;` a nivel de módulo en `pages/Upload.tsx` y `dbg(localStorage.getItem('estudio.token'))` en `onFile`; **M06** `const { error: logError } = console;` a nivel de módulo en `lib/limits-context.tsx` y `logError(limits)` cuando falla la lectura. **Ambas hacen fallar la suite** (CA-2 pasa a 16 mutaciones). Una llamada diferida (`setTimeout`) que ocurre después de acabar el test debe seguir detectándose y **atribuirse al test que la provocó** si es posible; si no, queda documentado en la bitácora.
- **F-02 (NARANJA, tests que sobreviven a la mutación; mi CA-5 enumeraba ramas, Lección 52):** la clase es «el nombre del archivo del usuario no sale del `File`». Se arregla con un **helper único** `expectFileNameAbsent(name)` que comprueba en **cada estado terminal** de la subida (éxito, rechazo del cliente por tipo, por tamaño y por dos archivos, `413`, `422`, `5xx` y error de red) que el nombre no está en: la ubicación **completa** (`pathname` + `search` + `hash`: `LocationProbe` de `helpers.tsx` debe exponer las tres, no solo `pathname`; no se usa `window.location.href`, que no cambia bajo `MemoryRouter`), `document.body.innerHTML`, `localStorage` ni `sessionStorage`. Mutaciones que **deben** hacer fallar la suite: P01 (`?n=${file.name}`), P03 (`#${file.name}`) y P02 (`setError(msg + file.name)`).
- **F-02 (fecha UTC):** el test de fecha usa **dos** instantes, `…T00:00:30Z` y `…T23:59:30Z`, y comprueba que el día mostrado es el de UTC en ambos (juntos distinguen las zonas UTC+ y UTC−). Lo mismo para `formatResetDate` (fecha `YYYY-MM-DD` → `October 1`). **Mutación observable:** quitar `timeZone: 'UTC'` de `lib/format-date.ts` **hace fallar** el test, y el codificador lo demuestra con `TZ=Pacific/Kiritimati` y con `TZ=Pacific/Pago_Pago` (las dos salidas en la bitácora).
- **F-02 (segundo envío durante la subida):** el test dispara **dos** eventos de selección de archivo de forma **síncrona dentro de un solo `act()`** sobre el `input` real de la zona (como el de `register`), de modo que ejercite el guard `busy` y no el desmontaje de la zona. **Mutación observable (P04):** quitar el guard `busy` de `Upload.tsx` **hace fallar** el test (`fetch` llamado 2 veces).
- **F-05 (AMARILLO, defecto de código real y barato; entra por estar ya en la ronda):** `refresh()` de `lib/limits-context.tsx` no puede reutilizar una lectura en vuelo cuando se invoca tras una subida aceptada: la lectura **posterior al `202`** descarta/ignora el resultado de la anterior (contador de generación) y el contexto termina con el dato de la **segunda**. Test: la lectura de entrada se resuelve **después** de aceptar la subida y devolviendo un valor viejo; el contexto muestra el valor de la lectura posterior al `202`. **Mutación observable:** reutilizar la lectura en vuelo **hace fallar** el test.
- **F-06 (AMARILLO, bitácora):** se **reescribe la sección «Mutaciones observables»** de `bitacoras/u0-T02.md`: una entrada por mutación, cada una con su campo `mutacion:` lleno (archivo, línea y el código mutado, pegado dentro de un bloque de código) y la salida de la suite; sin bloques vacíos ni partidos. CA-12 de la bitácora compara los otros 5 workspaces contra una corrida propia sobre `main` (no contra las cifras de la tarea) y la salida va pegada. Toda evidencia, otra vez, del HEAD final.
- **F-04 (AMARILLO, sin cambio de código):** las regiones `aria-live` que aparecen ya con texto pueden no anunciarse en algunos lectores de pantalla; jsdom no lo puede probar. Se anota en el PR para la comprobación visual del humano.
- **CA-2** pasa a **16** mutaciones (las 14 más M05 y M06) y CA-12 cuenta los tests nuevos. Fuera de la ronda 2: C-80 (test intermitente de trust) y C-81 (exportar `MAX_UPLOAD_BYTES` desde `shared-types`).

### Fix de especificación (post-ronda 2, 2026-11-19)

- **F-02, segundo envío (error del orquestador):** pedí «dos eventos de selección síncronos dentro de un solo `act()`». `react-dropzone` 20.x **aborta la lectura anterior** cuando llega otra sin esperar, así que dos selecciones realmente síncronas nunca llegan a `onFile` dos veces: el criterio era imposible al pie de la letra. **Se acepta la solución del codificador:** soltar el primer archivo, esperar ~20 ms **sin que React repinte** y soltar el segundo, todo dentro de un solo `act()`, de modo que se ejercite el guard `busy` y no el desmontaje de la zona. La mutación P04 (quitar el guard) **debe seguir haciendo fallar** el test. El revisor no lo trata como defecto.

## Fix de especificación (ronda 3, 2026-11-20)

Hallazgos de la ronda 2 (`revisiones/u0-T02/ronda-2.md`, NO-VERDE) y mi arbitraje. Entran en la ronda 3: F-07, F-08, F-09 y F-10. **Ningún fix toca código de producción** (`src/**` fuera de `src/__tests__/`): la imagen `frontend:u0-T02-r2` ya desplegada sigue siendo la entregada y **no hay despliegue nuevo** en esta ronda.

- **F-07 (NARANJA, error mío: CA-1 enumeraba 8 métodos, Lección 52):** la guarda sustituye **todas las propiedades de `console` que son funciones** (`Object.getOwnPropertyNames(console)` filtrado por `typeof === 'function'`, calculado al cargar `jest.setup.ts`), no una lista fija; así cubre `assert`, `group`, `groupCollapsed`, `count`, `countReset`, `dirxml`, `time`, `timeLog`, `timeEnd`, `table`, `trace` y lo que traiga la versión de Node. `console-guard.test.ts` recorre **esa misma lista de propiedades** y comprueba **por valor** que invocar cada una (con un argumento) hace que `assertConsoleSilent()` lance y nombre el método; un método añadido a `console` después queda cubierto sin tocar el test. Mutaciones nuevas de CA-2 (pasa a **20**): **M07** `console.assert(false, token)`, **M08** `console.group(token)`, **M09** `console.count(token)`, **M10** `console.dirxml(token)`, todas en el `202` de `Upload.tsx`; las cuatro **hacen fallar la suite**.
  - **Documentación falsa, a corregir:** una llamada diferida que dispara **después** de que el entorno de Jest se desmonta (p. ej. un `setTimeout` de 1 s) **se pierde en silencio**; el comentario de `jest.setup.ts` y la ATENCIÓN 2 de la bitácora decían que «falla el test siguiente». Se **corrige la afirmación** y se documenta el límite (no se intenta resolver: es una propiedad de Jest).
  - **Rechazado, a candidata C-82:** `process.stdout.write`/`process.stderr.write` (código de Node, no del navegador) y `Object.getPrototypeOf(console).error.call(…)` (rebuscado). No se tocan en esta ronda.
- **F-08 (NARANJA, hueco del test y de mi CA-8):** `findByRole('status')` encontraba el `LoadingScreen` de la guarda de onboarding, no el «Loading critique…» de `Critique.tsx`. El test **espera primero a que la guarda deje pasar** (el `LoadingScreen` desaparece), **mantiene pendiente** `GET /api/uploads/:id` con una promesa diferida, y comprueba `getByText('Loading critique…')` y que su `closest('[role=status]')` existe **dentro del contenido de la crítica** (no el de la guarda); después resuelve la promesa y comprueba que el estado de carga desaparece. **Mutaciones observables:** quitar `role="status"` del bloque de carga de `Critique.tsx`, y borrar el bloque entero, **hacen fallar** el test (el codificador las aplica y pega las salidas). Regla de clase: toda consulta `ByRole('status')` de la suite lleva **texto o nombre** que la distinga del `LoadingScreen` de la guarda; el codificador barre `src/__tests__` y lo deja dicho en la bitácora.
- **F-09 (AMARILLO, entra por barato):** `jest.setup.ts` fija `process.env.TZ = 'Pacific/Pago_Pago'` (UTC−11) **antes de cualquier uso de `Date`**, para que la mutación «quitar `timeZone: 'UTC'`» **falle también cuando el CI corre en TZ=UTC**; no se toca `jest.config.js` (CA-14). Con esa zona, quitar `timeZone` de `formatDate` **o** de `formatResetDate` hace fallar la suite. La bitácora lo demuestra **sin** exportar `TZ` en el entorno (corrida en `TZ=UTC` explícito). Toda la suite sigue en verde con esa zona.
- **F-10 (AMARILLO, entra por barato):** `expectFileNameAbsent` comprueba además `document.title` y el **estado de la navegación** (`location.state`; `LocationProbe` lo expone serializado). **Mutaciones observables:** poner el nombre en `document.title` y en `navigate(…, { state })` **hacen fallar** la suite.
- **CA-2** pasa a **20** mutaciones (las 16 + M07 a M10). **CA-12** cuenta los tests nuevos. **CA-20** añade que `git diff fe9d3af HEAD --name-only -- apps/frontend k8s package-lock.json | grep -vE '__tests__/|jest\.setup\.ts'` esté **vacío** (nada de producción cambió desde `fe9d3af`), y CA-17 se comprueba por lectura (el bundle servido sigue siendo `index-Bn-yc1Pp.js`, byte a byte igual al build del HEAD).
- Fuera de la ronda 3: C-82 y los de siempre (C-76 a C-81).

### Fix de especificación (post-ronda 3, 2026-11-20)

- **F-09, mecanismo (error del orquestador):** pedí fijar `process.env.TZ = 'Pacific/Pago_Pago'` en `jest.setup.ts`. En el entorno de Jest `process` es una copia y asignarlo **no cambia** la zona de ICU (el codificador lo comprobó con una sonda): el mecanismo era inviable. **Se acepta la solución del codificador:** `jest.setup.ts` envuelve `Intl.DateTimeFormat` para que, **sin `timeZone` explícito**, use `Pacific/Pago_Pago` (UTC−11). El criterio observable no cambia: con `TZ=UTC` explícito, quitar `timeZone: 'UTC'` de `formatDate` o de `formatResetDate` **hace fallar** la suite. **Límite conocido y aceptado (ATENCIÓN 1 del codificador):** `new Date().getTimezoneOffset()` no cambia, así que un `toLocale*String` sin `timeZone` en producción no quedaría cubierto; hoy el código no lo usa. El revisor no lo trata como defecto de esta ronda.
- **F-07, exclusiones de la guarda (aceptadas):** `constructor` y lo heredado de `Object.prototype`, el constructor `Console`, los internos con `_` y `getBuffer` (lo llama el ejecutor de Jest al terminar el test; sustituirlo rompería su salida). Quedan documentadas en el código y en la bitácora.

## Notas

- **Archivos que se modifican en su sitio:** `apps/frontend/jest.setup.ts`, `src/__tests__/helpers.tsx` (se quita `spyConsole`), `src/api/client.ts`, `src/api/endpoints.ts` (o un `uploads.ts` nuevo para los endpoints de subida), `src/auth/guards.tsx`, `src/components/AppLayout.tsx`, `src/pages/Upload.tsx`, `src/App.tsx`, `k8s/frontend/deployment.yaml`, `package-lock.json` y `apps/frontend/package.json`. Todo lo demás es nuevo. Nada de duplicados con sufijo.
- **Archivos nuevos esperados** (nombres orientativos): `components/DropZone.tsx`, `components/UsageCounter.tsx`, `components/UpgradePrompt.tsx`, `components/ScoreBadge.tsx`, `components/RecentUploads.tsx`, `components/ui/badge.tsx`, `pages/Critique.tsx`, `pages/Upgrade.tsx`, `lib/limits-context.tsx`, `lib/format-date.ts`.
- **Bitácora nueva `bitacoras/u0-T02.md`:** hash de la tarea, nombre y edad de **todos** los pods antes y después, estado inicial, la salida roja inicial (C-75 y el resto), las diez decisiones de diseño, la justificación de `react-dropzone` y de cada transitiva, `npm audit`, cada `docker build`/`kind load`/`apply`/`rollout` con su salida, la salida de las 14 mutaciones y cualquier **ATENCIÓN**. **Toda evidencia sale del HEAD final y va pegada dentro de bloques de código** (L55: Prettier reescribe el texto suelto).
- **Formas reales de las APIs:** envoltorio `{data, error, status}`; `POST /api/uploads` responde `202` (no `201`) tanto en `ready` como en `low_confidence`; `GET /api/uploads/:id` responde `200`, `404` (id no UUID o inexistente) o `403` (de otro usuario); nginx responde `413` **sin envoltorio** por encima de 11 MiB; `limits` de `paid` trae `uploadsRemaining`, `uploadsLimit` y `resetDate` en `null`.
- **Diseño visual:** `design-system-mapping.md` (`blue-600` primario, `gray-50` fondo, `gray-200` bordes; badge verde `green-600` ≥ 75, amarillo `yellow-600` 50–74, rojo `red-600` < 50; categoría `text-sm font-semibold text-gray-700 uppercase tracking-wide`). Tailwind **v3**; los componentes `Badge` y `Progress` se escriben a mano en `src/components/ui/` (no se ejecuta el CLI de shadcn).
- **C-76 en el PR:** el cuerpo del PR dice sin rodeos que **el contador no baja en el servidor** y que el estado en 0 solo se probó con falsos, por decisión del humano.
- **Qué debe mirar el humano en el PR** (el revisor no puede abrir un navegador): `kubectl port-forward svc/frontend 3500:8080` y abrir `http://localhost:3500` con un usuario demo con onboarding hecho: ver la barra lateral con el contador (`10 of 10 uploads left this month`), arrastrar una imagen (y una de otro tipo, y una de más de 10 MB), ver la crítica con los 5 badges de colores y la miniatura, volver, ver «Recent uploads», cerrar sesión desde la pantalla de error del onboarding apagando trust (opcional). Es el único chequeo visual de la tarea.
- **Candidatas que el orquestador ya registró** (no las resuelvas aquí): C-76 (el contador no se incrementa), C-77 (voto sin API), C-78 (listado sin miniatura ni nombre).
- **Permisos de cluster** (los da el humano **tarea por tarea**; el orquestador los pide con lista exacta antes de despachar y se los pasa al subagente): _codificador (CA-17a):_ `docker build` de `frontend:u0-T02`, `kind load docker-image frontend:u0-T02`, `kubectl apply -f k8s/frontend/`, `kubectl rollout status deployment/frontend` y `kubectl port-forward svc/frontend 3500:8080`. **Un rollout del frontend corta el port-forward abierto del humano en el 3500** (L57). _Revisor (CA-18b):_ ese port-forward, registrar usuarios `*.test` y hacer **pocas** subidas (≤ 4) a través del proxy; **solo lectura** con `kubectl`. Ninguno toca ni reinicia identity, ingestion, trust, progress o backend. Cualquier denegación se reporta como «no verificable».
- No hagas push, no abras PR, no fusiones. `git add <rutas explícitas>` (nunca `-a`) y un subdirectorio propio del scratchpad para `$WORK`.

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
