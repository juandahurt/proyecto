# u0-T01 — Frontend base: login, registro, onboarding y rutas protegidas, servido por nginx en kind

**Unidad:** u0 — frontend (`kind: ui`), tarea 1 de 4 (T02 subida y crítica, T03 historial, T04 tendencias y upgrade).
**Historias que implementa:** US-8 (AC-8.1, AC-8.2, AC-8.3) y US-11 (AC-11.1, AC-11.2, AC-11.3), en su parte de interfaz.
**Depende de:** u8-T01 (identity: registro y login), u11-T01 (trust: onboarding). Ambas fusionadas y desplegadas.

**Decisiones del humano (ola 10):** el frontend entra en el alcance; **React + Vite**; pantallas del MVP: login/registro, subida con crítica, historial y tendencias. El humano **no tiene mockups** y delegó el diseño al orquestador: los mockups que existen son los de la etapa refined-mockups de AI-DLC (ver Archivos de contexto). Plan en 4 tareas aprobado.

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **nginx como proxy inverso dentro del pod del frontend.** No hay Ingress en el cluster. Un único origen (`/` sirve la SPA, `/api/*` se proxea por ClusterIP DNS) evita CORS y es lo que describe `contract-summary.md` (tabla de rutas `/api/uploads|auth|users|trends|onboarding|policy`). Se accede con `kubectl port-forward svc/frontend 3500:8080`. La SPA llama siempre a rutas **relativas** (`/api/...`); nunca a `localhost:<puerto>`.
2. **Imagen `nginxinc/nginx-unprivileged` con tag fijo (`1.27-alpine`), escucha en 8080, sin root.** Cumple «nunca `latest`» y no repite C-45 (contenedores como root).
3. **El JWT vive en `localStorage`** (clave `estudio.token`). AC-8.2/AC-8.3 piden sesión de 7 días que sobreviva a recargas; guardarlo solo en memoria la perdería. Riesgo conocido: XSS lo puede leer. Mitigación en esta tarea: CSP estricta en nginx y ninguna inyección de HTML. Se registra como candidata, no se rediseña ahora.
4. **Textos de la interfaz en inglés**, tal como están en los mockups y en las historias (AC-8.3: «Incorrect email or password»; AC-11.2: los tres textos exactos). El resto de artefactos del proyecto va en español.
5. **Login/registro no tienen mockup:** se diseñan con el mismo sistema (Tailwind v3 + shadcn/ui, `Card` centrada como Onboarding). Una pantalla `/login` y una `/register`, con enlace entre ellas.
6. **Enrutado y guardas:** sin token → `/login`. Con token → se consulta `GET /api/onboarding` (trust): `completed: false` → `/onboarding`; `true` → `/upload`. Cualquier `401` de cualquier llamada borra el token y vuelve a `/login`.
7. **Esta tarea solo entrega el cascarón** de `/upload` (layout con barra lateral: logo, enlaces Upload / My History / Settings, botón «Log out»; el contenido de Upload, el contador de tier, History y Settings son «coming soon»). El contenido llega en T02 y T03.

---

## Alcance

**Dentro** (una línea, concreta):

> El workspace `apps/frontend` (React 18 + Vite + TypeScript + Tailwind v3 + componentes estilo shadcn/ui) con login, registro, onboarding y rutas protegidas, su suite de tests (Jest + React Testing Library), y su despliegue en kind detrás de nginx con proxy a identity, ingestion, progress y trust.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- Subida de imágenes, `react-dropzone`, crítica (3A/3B), contador de tier (2A/2B): T02.
- Historial, detalle y miniaturas: T03. Tendencias y flujo de upgrade/`subscribe`: T04.
- Pantalla de Settings y de política de datos (`/api/policy`): el enlace existe y muestra «coming soon».
- Cambios en identity, ingestion, trust, progress o backend, en `packages/auth-middleware` y en `packages/shared-types` (se **importa**; si falta algo, ATENCIÓN en la bitácora, no se modifica).
- Ingress, `NetworkPolicy`, Secrets nuevos, HTTPS/TLS y cualquier manifiesto fuera de `k8s/frontend/`.
- Cambiar `eslint.config.js`, `turbo.json` o `.prettierrc` de la raíz (si algo no pasa, ATENCIÓN).
- Tests end-to-end con navegador (Playwright/Cypress): no se añaden; ver CA-16.
- Modo oscuro, i18n, animaciones y cualquier pulido que no esté en el spec de interacción.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/mockups.md` (Pantalla 1 Onboarding; layout con barra lateral de 2A), `design-system-mapping.md` (componentes, tokens de color, tipografía, espaciado), `interaction-spec.md` (checkboxes de onboarding) y `accessibility-checklist.md`
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-8: AC-8.1 a AC-8.3; US-11: AC-11.1 a AC-11.3)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` (tabla de rutas; C2 auth y limits; C4 onboarding: `GET` → `{completed}`, `POST` → `204` o `422`)
- `packages/shared-types/src/auth.ts` (`RegisterRequestSchema`, `LoginRequestSchema`, `AuthResponseSchema`) y `onboarding.ts` (`ONBOARDING_CHECKBOXES`, `OnboardingAckRequestSchema`)
- `apps/identity-service/src/handlers/auth.ts` y `apps/trust-service/src/handlers/onboarding.ts` (forma real de las respuestas y de los errores)
- `apps/progress-service/Dockerfile`, `apps/progress-service/package.json`, `apps/progress-service/jest.config.js` y `tsconfig.json` (moldes de Dockerfile multi-etapa, workspace y Jest)
- `k8s/progress/` (molde de manifiestos: `Deployment`, `Service`, `ConfigMap`, readinessProbe, recursos)
- `tareas/u14-T01-pvc-identity-trust.md` y `tareas/u7-T01-tier-gated-trends-api.md` (moldes de CA de infraestructura y despliegue, con sus bloques «Fix de especificación»)
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + React Testing Library, Prettier, ESLint, Zod autoritativo, `shared-types` única fuente, cobertura, `npm audit`, límite de tamaño en el borde, sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los va a correr él mismo, uno por uno. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes de probar: `npm ci` y `npm run build -w packages/shared-types`. Comandos con `grep` en macOS: sin `-P`; usa `perl -0ne` para patrones de varias líneas (lección de u7).

- [ ] **CA-1** — El workspace compila con Vite y **importa** los contratos de `shared-types` (nada duplicado).

  ```bash
  npm run build -w apps/frontend 2>&1 | tail -8
  test -f apps/frontend/dist/index.html && echo "index.html ok"
  grep -rn "z\.string()\.email()" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ || echo "sin schemas de auth duplicados"
  grep -rln "COMPLEMENTS human critique\|NEVER used to train" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ || echo "sin copy de onboarding duplicado"
  grep -rn "@proyecto/shared-types" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ | cut -c1-120
  grep -rl "COMPLEMENTS human critique" apps/frontend/dist | head -2
  ```

  Esperado: build exit 0; `index.html ok`; `sin schemas de auth duplicados`; `sin copy de onboarding duplicado` (los tres textos salen de `ONBOARDING_CHECKBOXES`); el cuarto comando muestra los imports desde `@proyecto/shared-types`; el último lista al menos un `.js` del bundle (el copy llegó al build). **Trampa conocida:** `shared-types` se compila a CommonJS y Vite no lo transforma por defecto si es un paquete enlazado: si el build falla o el bundle rompe en el navegador, ajusta `build.commonjsOptions` en `vite.config.ts` (o equivalente) y anótalo como ATENCIÓN; **no** copies los schemas.

- [ ] **CA-2** — Login (AC-8.2, AC-8.3).

  ```bash
  npm test -w apps/frontend -- login --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: con respuesta `200` del falso (`{data:{token,expiresIn:604800},error:null,status:200}`) guarda el token en `localStorage['estudio.token']` y navega; con `401` muestra **exactamente** `Incorrect email or password` (mismo texto sea cual sea el campo erróneo) en un elemento `role="alert"`, y no guarda token; email inválido o contraseña de menos de 8 caracteres se rechazan **en el cliente** con `LoginRequestSchema` y **sin llamar** a `fetch` (el test mira el contador de llamadas); el botón queda deshabilitado mientras la petición está en vuelo (sin doble envío); error de red/5xx → mensaje genérico, sin token. El cuerpo enviado es `{email,password}` por valor, a `POST /api/auth/login`. **Mutación observable:** mostrar un mensaje distinto según el código **hace fallar** el test de AC-8.3.

- [ ] **CA-3** — Registro (AC-8.1).

  ```bash
  npm test -w apps/frontend -- register --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: `201` con token → guarda el token y navega (queda con sesión iniciada: AC-8.1 «logged in automatically»); `409` → mensaje `An account with that email already exists` en `role="alert"`; contraseña de 7 caracteres e email inválido → rechazo en el cliente con `RegisterRequestSchema` y **sin** `fetch`; `POST /api/auth/register` con `{email,password}` por valor; enlaces cruzados entre `/login` y `/register`. La contraseña **nunca** aparece en la URL, en `localStorage` ni en la consola.

- [ ] **CA-4** — Onboarding con el copy exacto y el botón bloqueado (AC-11.2).

  ```bash
  npm test -w apps/frontend -- onboarding --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: se renderizan 3 checkboxes con etiqueta **byte a byte** igual a `ONBOARDING_CHECKBOXES` (el test las compara contra la constante importada, no contra copias); con 0, 1 y 2 marcados `Get Started` está `disabled` y `aria-disabled="true"`; con los 3, activo; al pulsar envía `POST /api/onboarding` con `{checkbox1:true,checkbox2:true,checkbox3:true}` y el `Authorization` del usuario, y al recibir `200` (envoltorio) navega a `/upload`; `422` y `5xx` muestran un error en `role="alert"` y **no** navegan. Marcar y desmarcar vuelve a deshabilitar el botón. **Mutación observable:** habilitar el botón con 2 marcados **hace fallar** el test.

- [ ] **CA-5** — Rutas y guardas (AC-11.1, AC-11.3, decisión 6).

  ```bash
  npm test -w apps/frontend -- routes guard --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: sin token, `/upload`, `/onboarding` y `/` redirigen a `/login` **sin llamar a ninguna API**; con token y `GET /api/onboarding` → `{completed:false}`, ir a `/upload` termina en `/onboarding` (AC-11.1); con `{completed:true}` se aterriza en `/upload` y no se muestra el onboarding (AC-11.3); en `/onboarding` con `completed:true` se redirige a `/upload`; con token y estando en `/login` o `/register` se redirige según el estado de onboarding; ruta desconocida → pantalla 404. Mientras se consulta onboarding se muestra un estado de carga, no el contenido protegido (el test comprueba que `Upload` no se pinta antes de la respuesta).

- [ ] **CA-6** — Manejo del token y del `401`.

  ```bash
  npm test -w apps/frontend -- auth-store api-client --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: cualquier `401` de `GET/POST /api/onboarding` (o de cualquier llamada hecha con el cliente) borra `estudio.token` y navega a `/login`; «Log out» borra el token y navega a `/login`; un token **expirado** (claim `exp` en el pasado, decodificado sin verificar firma) se trata como ausente al arrancar y se borra; un `localStorage` que lanza (modo privado) no rompe la app: se comporta como sin sesión; el token **nunca** va en la URL ni en una cabecera distinta de `Authorization: Bearer <token>`.

- [ ] **CA-7** — Cliente HTTP: rutas relativas, solo `Authorization`, silencio de consola.

  ```bash
  npm test -w apps/frontend -- api-client --coverage=false --verbose 2>&1 | grep -iE "relativa|authorization|consola|silencio|redirect"
  grep -rnE "localhost|127\.0\.0\.1|:3[0-9]{3}" apps/frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__ || echo "sin hosts ni puertos en el código"
  ```

  Esperado: todas las peticiones van a rutas que empiezan por `/api/`; la única cabecera de credenciales es `Authorization` y solo en las llamadas autenticadas (login y registro no la envían); `redirect: 'error'` o equivalente (un `3xx` es un fallo, no se sigue); un test espía `console.log/info/warn/error/debug` en login, registro, onboarding y en cada error, y afirma que **no** se llamó ni con el JWT, ni con el `Bearer`, ni con la contraseña, ni con el email; el `grep` no encuentra hosts ni puertos. **Mutación observable:** `console.error(token)` en el cliente **hace fallar** el test.

- [ ] **CA-8** — Accesibilidad básica verificable (checklist WCAG 2.1 AA del spec).

  ```bash
  npm test -w apps/frontend -- a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: cada `input` tiene `label` asociado (`getByLabelText` los encuentra); los errores se anuncian en un elemento `role="alert"`; el estado deshabilitado de `Get Started` expone `aria-disabled`; el foco inicial de cada pantalla está en su primer control; los controles son operables con teclado (`userEvent.tab()` y `userEvent.keyboard`) incluido marcar un checkbox con la barra espaciadora; cada pantalla tiene exactamente un `h1`.

- [ ] **CA-9** — Los demás workspaces no cambian y todos los tests pasan.

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  npm run build -w packages/auth-middleware >/dev/null 2>&1
  for w in ingestion-service identity-service trust-service progress-service backend; do echo "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  git diff main...HEAD --name-only -- apps/ingestion-service apps/identity-service apps/trust-service apps/progress-service apps/backend packages | wc -l
  ```

  Esperado: frontend sin suites fallidas (`Test Suites:` **y** `Tests:`, C-57), sin `skip`, `only` ni `todo`; los otros cinco con los mismos tests y suites que en `main` (al redactar: ingestion 206/11, identity 74/12, trust 25/4, progress 171/9, backend 18/4; compara contra `main`); el `wc -l` da `0`.

- [ ] **CA-10** — Lint, build de todo el monorepo y formato.

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` con `0 cached` y sin fallidas (el frontend suma tareas); prettier limpio sobre el diff (`prettier --check .` global falla en `main` por C-51 y no cuenta). Sin cambios en `eslint.config.js`, `turbo.json` ni `.prettierrc` (si hicieron falta, ATENCIÓN y se justifican en la bitácora).

- [ ] **CA-11** — Cobertura sobre los pisos, sin rebajarlos.

  ```bash
  npm test -w apps/frontend -- --coverage 2>&1 | grep -E "All files|api|auth|pages|components"
  grep -n -A8 coverageThreshold apps/frontend/jest.config.*
  ```

git log --diff-filter=A --format=%h --name-only main..HEAD -- 'apps/frontend/jest.config.*' | head -3

````

Esperado: ≥ 80 % de líneas globales y ≥ 75 % de ramas en `src/api/` y `src/auth/` (el equivalente de `service/` y `handlers/` en esta app); la cobertura se mide sobre `src/**` excluyendo solo `main.tsx` y archivos `*.d.ts` (el `collectCoverageFrom` lo declara explícito); el `jest.config` **nace** en esta tarea con esos pisos en `coverageThreshold` (los dos comandos de arriba lo muestran: el umbral está en el commit que crea el archivo) y nada los baja después.

- [ ] **CA-12** — Dependencias nuevas acotadas, auditoría en verde y versiones fijadas por lockfile.

```bash
git diff main...HEAD -- apps/frontend/package.json | grep -E '^\+ +"' | sort
git diff main...HEAD --name-only | grep -E "package(-lock)?\.json"
npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
git diff main...HEAD -- apps/frontend/package.json | grep -E '"(latest|next|\*)"' | grep -v '@proyecto/' || echo "sin latest ni comodines"
git diff main...HEAD -- package.json | grep -E '^[-+] ' | grep -vE "^(---|\+\+\+)" || echo "package.json raiz sin cambios"
````

Esperado: solo las dependencias del frontend (React, Vite y su plugin, React Router, Tailwind v3 con PostCSS y Autoprefixer, `class-variance-authority`, `clsx`, `tailwind-merge`, Radix `checkbox`/`label`/`slot`, Jest con `jest-environment-jsdom`, React Testing Library con `jest-dom` y `user-event`, `ts-jest` y los `@types/*`); ninguna otra, y cada una **justificada en la bitácora**. Los únicos `package*.json` tocados son `apps/frontend/package.json` y `package-lock.json`. **`audit exit=0`** (regla del proyecto: `npm audit --audit-level=high` en rojo bloquea el merge; si una dependencia lo rompe, se cambia de versión o de librería, no se baja el umbral). Sin `latest`, `next` ni `*`. El `package.json` de la raíz no cambia.

- [ ] **CA-13** — Manifiestos de `k8s/frontend/`: aserciones y servidor, sin tocar el cluster.

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  grep -q "image: frontend:u0-T01" k8s/frontend/deployment.yaml || echo "FALLO: tag"
  ! grep -rqE "image: .*:latest" k8s/frontend || echo "FALLO: latest"
  grep -q "path: /health" k8s/frontend/deployment.yaml || echo "FALLO: readinessProbe"
  grep -q "readinessProbe" k8s/frontend/deployment.yaml || echo "FALLO: sin readinessProbe"
  grep -qE "proxy_pass +http://(identity-service:3100|ingestion-service:3200|progress-service:3400|trust-service:3300)" k8s/frontend/configmap.yaml || echo "FALLO: proxy"
  grep -qE "client_max_body_size" k8s/frontend/configmap.yaml || echo "FALLO: sin limite de tamano en el borde"
  grep -qE "Content-Security-Policy|X-Content-Type-Options" k8s/frontend/configmap.yaml || echo "FALLO: sin cabeceras de seguridad"
  kubectl apply --dry-run=server -f k8s/frontend/
  ```

  Esperado: solo archivos bajo `k8s/frontend/` (`configmap.yaml` con `nginx.conf`, `deployment.yaml`, `service.yaml`); **ningún** `FALLO`; el servidor acepta los tres (`--dry-run=server`; `--dry-run=client` no discrimina nada y no cuenta, C-61). El `Deployment` usa `strategy: RollingUpdate`, `imagePullPolicy: Never`, recursos acotados, `securityContext` con `runAsNonRoot: true`, y monta el ConfigMap en `/etc/nginx/conf.d/default.conf`. El `Service` es `ClusterIP`, puerto `8080`. **`client_max_body_size`** limita el tamaño en el borde (regla del proyecto: límite en multer **y** en el borde): `11m` para `/api/uploads` (10 MB de imagen más sobrecarga multipart) y un valor pequeño (`1m`) para el resto. nginx no sigue redirecciones de los upstreams (`proxy_redirect off`) y no cachea `/api/` (`proxy_no_cache`/`add_header Cache-Control "no-store"`). La CSP no permite `unsafe-eval` ni orígenes externos; `unsafe-inline` solo en `style-src` si Tailwind lo exige, y se anota.

- [ ] **CA-14** — Dockerfile del frontend: multi-etapa, tag fijo, sin root.

  ```bash
  grep -nE "^FROM " apps/frontend/Dockerfile
  grep -nE "^USER |EXPOSE" apps/frontend/Dockerfile
  grep -nE "^FROM .*:latest" apps/frontend/Dockerfile || echo "sin latest"
  grep -nE "ANTHROPIC|JWT_SECRET|ENV .*(KEY|SECRET|TOKEN)" apps/frontend/Dockerfile || echo "sin secretos en el Dockerfile"
  ```

  Esperado: dos `FROM` (etapa de build con `node:20-slim` y etapa final `nginxinc/nginx-unprivileged:1.27-alpine`, ambas con tag explícito); la etapa final no corre como root (la imagen base usa el usuario `nginx` (uid 101); si el Dockerfile añade `USER`, es uno no-root) y expone `8080`; `sin latest`; `sin secretos en el Dockerfile`. El contexto de build es la raíz del repo (como los otros servicios) y el `Dockerfile` copia solo `apps/frontend`, `packages/shared-types`, `package*.json` y `turbo.json`.

- [ ] **CA-15** — Despliegue en kind y lectura de vuelta (**CA-15a, codificador, con autorización del humano para frontend solamente**).

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  kubectl get deploy frontend 2>&1 | head -2          # estado «malo» inicial: no existe
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T01 .
  kind load docker-image frontend:u0-T01
  kubectl apply -f k8s/frontend/
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.strategy.type}{"\n"}'
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  kubectl get svc frontend -o jsonpath='{.spec.type} {.spec.ports[0].port}{"\n"}'
  lsof -i :3500 || echo "3500 libre"
  kubectl port-forward svc/frontend 3500:8080 >$WORK/pf-frontend.log 2>&1 &
  sleep 3
  curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3500/health
  curl -s http://localhost:3500/ | grep -c '<div id="root">'
  curl -s -o /dev/null -w "spa-fallback %{http_code} %{content_type}\n" http://localhost:3500/login
  curl -sI http://localhost:3500/ | grep -iE "x-content-type-options|content-security-policy|x-frame-options"
  curl -s -o /dev/null -w "trends %{http_code}\n" http://localhost:3500/api/trends
  curl -s -o /dev/null -w "uploads %{http_code}\n" http://localhost:3500/api/uploads
  curl -s -o /dev/null -w "onboarding %{http_code}\n" http://localhost:3500/api/onboarding
  curl -s -o /dev/null -w "auth-body-invalido %{http_code}\n" -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d '{}'
  curl -s -o /dev/null -w "ruta-api-desconocida %{http_code}\n" http://localhost:3500/api/otra
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-despues.txt
  ```

  Esperado: antes, `kubectl get deploy frontend` da `NotFound`; imagen `frontend:u0-T01 RollingUpdate`; un solo pod `ready=true restarts=0` con esa imagen; `Service` `ClusterIP 8080`; el puerto 3500 estaba libre (L45: si lo ocupa otro proceso un `curl` da falso verde: confirma que el port-forward arrancó mirando `$WORK/pf-frontend.log`); `health 200`; `1` coincidencia de `<div id="root">`; `spa-fallback 200 text/html` (la recarga de `/login` funciona); las tres cabeceras de seguridad presentes; **`trends 401`, `uploads 401`, `onboarding 401`** (la petición llegó hasta el servicio correcto, no la contestó nginx); `auth-body-invalido` es un `4xx` de identity (no `502` ni `404` de nginx); `ruta-api-desconocida` es el `404` con envoltorio `{data,error,status}` de algún servicio, o un `404` de nginx, **nunca** el `index.html`. **Los otros 5 pods con el mismo nombre y la misma edad** en `pods-antes.txt` y `pods-despues.txt`. Cierra el port-forward al terminar. Registra en la bitácora cada `docker build`, `kind load`, `apply` y `rollout` con su salida.

- [ ] **CA-16** — Flujo real a través del proxy (**CA-16b, revisor o humano; solo con autorización de port-forward a `svc/frontend` y de registro de usuarios `*.test`**). Si el sistema deniega un permiso, se reporta **no verificable** y no se esquiva (L22). **Límite honesto:** sin navegador automatizado, esta tarea **no prueba el DOM real en un navegador**; lo cubren RTL (CA-2 a CA-8) y este flujo HTTP. La comprobación visual la hace el humano (ver Notas).

  ```bash
  # Puerto local 3500 (comprueba `lsof -i :3500` antes; 3300 es del humano, 3301 y 3401 los ocupan procesos ajenos). NO imprimas el JWT.
  E="u0t01-$(date +%s)@rev.test"; P="$(openssl rand -hex 8)"
  curl -s -o $WORK/reg.json -w "register %{http_code}\n" -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o $WORK/login.json -w "login %{http_code}\n" -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"$P\"}"
  curl -s -o /dev/null -w "login-mala-clave %{http_code}\n" -X POST http://localhost:3500/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$E\",\"password\":\"${P}x\"}"
  T=$(node -e 'console.log(require(process.argv[1]).data.token)' $WORK/login.json)
  curl -s -w " %{http_code}\n" http://localhost:3500/api/onboarding -H "Authorization: Bearer $T"
  curl -s -o /dev/null -w "onboarding-422 %{http_code}\n" -X POST http://localhost:3500/api/onboarding -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"checkbox1":true,"checkbox2":true,"checkbox3":false}'
  curl -s -o /dev/null -w "onboarding-204 %{http_code}\n" -X POST http://localhost:3500/api/onboarding -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"checkbox1":true,"checkbox2":true,"checkbox3":true}'
  curl -s -w " %{http_code}\n" http://localhost:3500/api/onboarding -H "Authorization: Bearer $T"
  curl -s -o /dev/null -w "limits %{http_code}\n" http://localhost:3500/api/users/me/limits -H "Authorization: Bearer $T"
  curl -s -o /dev/null -w "trends %{http_code}\n" http://localhost:3500/api/trends -H "Authorization: Bearer $T"
  ```

  Esperado: `register 201`; `login 200`; `login-mala-clave 401`; `GET /api/onboarding` → `{"data":{"completed":false},…}` y luego `{"data":{"completed":true},…}` (tras el `POST`), con `200`; `onboarding-422 422`; `onboarding-204` imprime **`200`** (el nombre de la etiqueta es histórico); `limits 200`; `trends 200` con `tier: "free"`. El límite de tamaño del borde se comprueba de forma estática en CA-13; esta tarea **no** sube archivos. Cierra el port-forward y deja constancia del email `*.test` creado. Ningún JWT ni contraseña en el informe ni en la bitácora.

- [ ] **CA-17** — Sin secretos en el diff, el árbol ni el bundle (CA estándar, ampliado).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  grep -rEl "sk-ant-api[0-9]+|JWT_SECRET|ANTHROPIC" apps/frontend/dist 2>/dev/null || echo "bundle sin secretos"
  ```

  Esperado: imprime `no secrets in diff`, `no secrets in diff or tree` y `bundle sin secretos`. Los tests usan un JWT evidentemente falso construido en el test (cabecera y payload en base64 sin firma real) y no citan literales con forma de clave (C-29). Las contraseñas de los tests son constantes obviamente falsas. La bitácora no imprime JWT.

- [ ] **CA-18** — Alcance exacto y commits atómicos.

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list main..HEAD); do git show --name-only --format='%h %s' $c | head -12; done
  ```

  Esperado: solo archivos bajo `apps/frontend/` (código, configuración de Vite, Tailwind, PostCSS, TypeScript, Jest, `Dockerfile`, `.dockerignore` si hace falta y los tests), `k8s/frontend/{configmap,deployment,service}.yaml`, `package-lock.json` y `bitacoras/u0-T01.md`. Cada commit contiene solo los archivos que nombra su mensaje (p. ej. «esqueleto Vite», «auth», «onboarding», «k8s y Dockerfile», «bitácora»); ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`; ≥ 4 commits.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después (Jest + React Testing Library + `user-event`; `fetch` falso inyectado, sin red real):

- **`api-client`:** rutas relativas, cabeceras por valor, `Authorization` solo en llamadas autenticadas, `redirect` de error, mapeo de `401`, silencio de consola.
- **`auth-store`:** guardar/leer/borrar token, token expirado, `localStorage` que lanza.
- **Pantallas `Login`, `Register`, `Onboarding`:** cada rama de CA-2, CA-3 y CA-4 con asserts **por valor** (cuerpo enviado, texto exacto, estado `disabled`), y el contador de llamadas a `fetch` en los rechazos del cliente.
- **Rutas y guardas:** cada combinación token/onboarding de CA-5 con un `fetch` falso que cuenta llamadas; estado de carga.
- **`a11y`:** etiquetas, `role="alert"`, foco, teclado, un `h1` por pantalla.
- Los asserts de rechazo y de navegación miran **contadores y la ubicación actual**, no solo que «no lanza».

**Rojo primero (de ejecución, no de compilación — Lección 13):** crea primero los módulos con la firma correcta y cuerpos neutros (p. ej. el cliente devuelve siempre `{ok:false}` y las pantallas se renderizan vacías), escribe los tests y registra que **fallan por aserción**; después implementa. Para infraestructura, antes de aplicar registra la lectura del estado «malo»: `kubectl get deploy frontend` → `NotFound`. Registra las salidas en la bitácora.

---

## Fix de especificación (ronda 1, 2026-11-19)

Errores del orquestador detectados por el codificador (ver `bitacoras/u0-T01.md`, ATENCIÓN 1 a 5):

- **Forma de onboarding (CA-4, CA-16 y Notas):** copié del contrato C4 `GET` → `{completed}` y `POST` → `204`; el handler real de trust (`handlers/onboarding.ts`) responde `GET` `200 {data:{completed},error:null,status:200}` y `POST` `200` con el mismo envoltorio (`422` si falta algún checkbox). **Manda el handler.** El cliente del frontend acepta también la forma antigua (defensivo); no es obligatorio. El contrato `contract-summary.md` (C4) queda desactualizado: el orquestador lo anota.
- **CA-9:** hay que compilar también `packages/auth-middleware` antes de correr los otros workspaces (`npm run build -w packages/auth-middleware`); el comando ya lo incluye.
- **CA-10:** `prettier` no tiene parser para Dockerfile; el comando excluye `Dockerfile`.
- **CA-11:** el `jest.config` nace en esta tarea, así que `wc -l` no puede dar `0`; la comprobación pasa a ser que el umbral existe y está en el commit que lo crea.
- **CA-12:** el comodín `*` de la dependencia de workspace `@proyecto/shared-types` no es un `latest`; el codificador la fijó en `0.0.1` (npm la sigue enlazando como workspace). Se acepta; el `grep` ignora `@proyecto/`.

## Fix de especificación (ronda 2, 2026-11-19)

Hallazgos de la ronda 1 que entran en la ronda 2 (ver `revisiones/u0-T01/ronda-1.md`): F-01 a F-05 y la parte `/api` de F-06. Cambios a los criterios:

- **Tag de la imagen de la ronda 2: `frontend:u0-T01-r2`** (F-04 cambia código y F-05 cambia el ConfigMap, así que la imagen cambia: nunca se reutiliza `u0-T01`, L11). `k8s/frontend/deployment.yaml` pasa a `image: frontend:u0-T01-r2`. En CA-14 y CA-15 donde dice `frontend:u0-T01` léase `frontend:u0-T01-r2`.
- **CA-7 (F-01):** el espía de consola afirma `callCount() === 0` en **cada rama de error**: login `401`/`5xx`/red, registro `409`/`5xx`/red y onboarding `422`/`5xx`/red, además del éxito. **Mutación observable:** `console.error(email, password)` en el `401` del login, `console.warn` en el `409` del registro y `console.error(api)` en el `5xx` de onboarding **hacen fallar** esos tests.
- **CA-2 y CA-3 (F-03):** un test de endpoint **con token presente** afirma que `loginRequest` y `registerRequest` **no** envían `Authorization`, y que un `401` de login **no** llama a `onUnauthorized`. **Mutación observable:** quitar `auth:false` en cualquiera de las dos **hace fallar** el test.
- **CA-3 (F-04):** el mensaje del mínimo de contraseña se **deriva del schema compartido** (el `minimum` del issue de Zod o el mensaje del schema), sin el literal `8` escrito a mano en `src/pages/credentials.ts`; y un fallo que no sea del campo contraseña no se traduce a ese mensaje.
- **CA-13 y CA-15 (F-05 y F-06):** el `Cache-Control: public, max-age=31536000, immutable` va **solo en respuestas 200** de `/assets/` (sin `always` o con un `error_page` que lleve `no-store`). Comprobación nueva en vivo: `curl -sI http://localhost:3500/assets/nope.js` da `404` **sin** `immutable` ni `max-age=31536000`. `GET /api` (sin barra final) **no** devuelve `index.html`: da el `404` JSON o el de nginx. `/favicon.ico` queda fuera.
- **Bitácora (F-02):** se **vuelven a correr** todos los CA tras el último commit y se pegan las salidas **literales dentro de bloques de código** (con ```), una sección por CA, sin títulos vacíos ni duplicados. Prettier no reescribe el contenido de un bloque de código. La salida de CA-12 debe mostrar `"@proyecto/shared-types": "0.0.1"`.
- Fuera de la ronda 2 (candidatas C-68 a C-72): F-07, F-08, F-09 y el resto.

## Notas

- **Archivos que se modifican en su sitio:** solo `package-lock.json` (nuevo contenido de dependencias). Todo lo demás es nuevo. Nada de duplicados con sufijo.
- **Bitácora nueva `bitacoras/u0-T01.md`:** hash de la tarea, nombre y edad de **todos** los pods antes y después, estado «malo» inicial, salida roja inicial, las siete decisiones de diseño, la justificación de cada dependencia nueva, el resultado de `npm audit`, cada `docker build`/`kind load`/`apply`/`rollout` con su salida y cualquier **ATENCIÓN** (en especial la trampa de CommonJS de CA-1).
- **Formas reales de las APIs:** envoltorio `{data, error, status}` en identity/ingestion/progress; el `POST` y el `GET` de `/api/onboarding` de trust responden `200` con el envoltorio (ver el «Fix de especificación»). Identity responde `401` en login erróneo y `409` en registro duplicado.
- **Diseño visual:** sigue `design-system-mapping.md`: tokens (`blue-600` primario, `gray-50` fondo, `gray-200` bordes), tipografía y espaciado (barra lateral `w-64`, `px-8`, `p-6`). El logo es el texto «Estudio» con la «E» en un recuadro, como en los mockups; no inventes imágenes.
- **Tailwind v3, no v4** (el mapeo de diseño asume v3). Los componentes estilo shadcn/ui se escriben a mano en `src/components/ui/` (no se ejecuta el CLI de shadcn: no hay red garantizada y genera archivos que no controlamos); basta `Button`, `Card`, `Checkbox`, `Input`, `Label` y `Alert`.
- **Qué debe mirar el humano en el PR** (el revisor no puede abrir un navegador): `kubectl port-forward svc/frontend 3500:8080` y abrir `http://localhost:3500`: registrarse, ver el onboarding con los tres textos y el botón bloqueado, marcar los tres, entrar al cascarón de Upload, cerrar sesión, iniciar sesión de nuevo y comprobar que **no** vuelve a ver el onboarding. Es el único chequeo visual de esta tarea.
- **Candidatas que el orquestador registrará** (no las resuelvas aquí): JWT en `localStorage` frente a cookie `HttpOnly` (decisión 3); la ausencia de un test E2E con navegador; que identity, ingestion, trust y progress no atienden SIGTERM (C-60) y por tanto el proxy verá cortes de ~41 s cuando se reinicien.
- **Permisos de cluster** (los da el humano **tarea por tarea**; el orquestador los pide con lista exacta antes de despachar y se los pasa al subagente): _codificador (CA-15a):_ `docker build` de `frontend:u0-T01`, `kind load docker-image frontend:u0-T01`, `kubectl apply -f k8s/frontend/`, `kubectl rollout status deployment/frontend` y `kubectl port-forward svc/frontend 3500:8080`. _Revisor (CA-16b):_ ese port-forward y registrar usuarios `*.test` a través del proxy; **solo lectura** con `kubectl`. Ninguno toca ni reinicia identity, ingestion, trust, progress o backend. Cualquier denegación se reporta como «no verificable».
- No hagas push, no abras PR, no fusiones. `git add <rutas explícitas>` (nunca `-a`) y un subdirectorio propio del scratchpad para `$WORK`.

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
