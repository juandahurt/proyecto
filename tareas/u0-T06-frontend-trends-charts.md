# u0-T06 — Frontend: gráfico de línea en tendencias por categoría

**Unidad:** u0 — frontend (`kind: ui`), tarea 6.
**Historias que implementa:** parte de la interfaz de `GET /api/trends` (ya fusionada en u7, pintada por u0-T04 como lista de texto).
**Depende de:** u0-T04 (#27, fusionada, pantalla `/trends` actual).

**Decisiones del humano:**

- Pedida en la ola 17 (2026-11-21): el humano quiere un **gráfico real** de la evolución de
  cada categoría en `/trends`, no solo la lista de texto `62 → 68 → 74` que dejó u0-T04.
- **Librería: `recharts`** (2026-11-21, elegida explícitamente por el humano sobre Chart.js
  y SVG a mano). Es la primera dependencia de charting del frontend — revierte parcialmente
  la decisión de u0-T04 de "cero dependencias nuevas, evita C-79"; se verificó que
  `recharts` declara `engines.node >= 18`, compatible con la imagen `node:20-slim` del
  Dockerfile (a diferencia de `react-dropzone`, que exige Node ≥22 — **C-79**, sin relación
  con esta tarea, no se toca aquí).
- **Sigue el mismo flujo establecido del proyecto**: tarea → worktree → codificador →
  verificación del orquestador (**sin ronda de revisor**, por decisión vigente desde la ola
  13 — confirmar de nuevo con el humano antes de fusionar) → PR.

**Decisiones de diseño del orquestador** (el humano puede objetarlas):

1. **Solo se toca `CategoryCard`** en `src/pages/Trends.tsx` (y lo que haga falta en
   `src/components/` si el codificador decide extraer un componente de gráfico propio,
   p. ej. `TrendChart.tsx`). El resto de la pantalla (badges, estados `locked` /
   `insufficient_data`, errores, carga) **no cambia de comportamiento**, solo de quién pinta
   la serie cuando hay tendencia real.
2. **El gráfico reemplaza el texto `62 → 68 → 74`**, no lo complementa — evita duplicar la
   misma información dos veces en la misma tarjeta. Se usa `<LineChart>` de `recharts` con
   un único `<Line>` (serie de `trend.scoreHistory`, eje X = orden cronológico/índice o
   fecha legible de `timestamp`, eje Y = `score`), sin leyenda (una sola serie por tarjeta
   no la necesita), con `<Tooltip>` para ver el valor exacto de cada punto al pasar el
   mouse/foco.
3. **Solo se pinta el gráfico cuando `category.status` es `improving`, `stagnating` o
   `worsening`** (hay `trend.scoreHistory`) — igual que la condición actual del texto que
   reemplaza. `locked` e `insufficient_data` no cambian en nada.
4. **Color de la línea según dirección**, reutilizando los mismos tokens que ya usa
   `DIRECTION_CLASS` (verde `improving`, gris `stagnating`, rojo `worsening`) traducidos a
   un valor hex/css que `recharts` pueda tomar como `stroke` (p. ej. las variables de
   Tailwind ya usadas: `green-600`/`gray-500`/`red-600` del `design-system-mapping.md`).
5. **Accesibilidad:** el SVG que genera `recharts` no sustituye la información textual — se
   añade un texto accesible (p. ej. `aria-label` en el contenedor del gráfico, o un
   `<caption>`/`sr-only` cercano) con el mismo contenido que antes (`62 → 68 → 74`), para que
   un lector de pantalla no pierda la serie solo porque ahora se pinta con SVG. El gráfico en
   sí puede llevar `aria-hidden="true"` sobre el SVG si el texto accesible ya cubre el dato.
6. **Tests:** como `recharts` renderiza SVG con tamaños que dependen de `ResizeObserver` /
   `getBoundingClientRect` (no disponibles en `jsdom`), el codificador decide el mock mínimo
   necesario (p. ej. `ResponsiveContainer` con alto/ancho fijos en vez de depender de medición
   real, o un mock de `ResizeObserver` en el setup de Jest) para que los tests existentes y
   los nuevos corran sin flakiness. Se documenta la decisión en la bitácora.
7. **Responsive:** el gráfico usa `<ResponsiveContainer>` para adaptarse al ancho de la
   tarjeta (misma grilla `sm:grid-cols-2` que ya existe); altura fija razonable (p. ej.
   160–200px) para que las tarjetas no cambien de tamaño entre sí.
8. **Textos de la interfaz en inglés**; el resto, en español.

---

## Alcance

**Dentro** (una línea, concreta):

> Añadir `recharts` como dependencia del frontend; reemplazar la lista de texto
> `scoreHistory` en `/trends` por un `<LineChart>` (una serie por categoría con tendencia
> real), con tooltip, color por dirección y accesibilidad equivalente; despliegue de la
> imagen nueva del frontend en kind.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- Cualquier cambio en `GET /api/trends`, `TrendResponseSchema`/`CategoryTrendSchema` o el
  motor de cálculo de tendencias (`progress-service`): son de u6/u7, fusionados y fuera de
  alcance.
- Cualquier otra pantalla (`/upload`, `/history`, `/upgrade`, `/settings`, `/policy`): no se
  tocan.
- Gráficos en pantallas distintas a `/trends` (p. ej. un sparkline en `/history`): fuera de
  alcance, candidata aparte si el humano lo quiere después.
- Otra librería de charting adicional, animaciones personalizadas más allá de las que trae
  `recharts` por defecto, modo oscuro.
- C-79 (Node ≥22 de `react-dropzone`): no se toca aquí.
- Cambiar `eslint.config.js`, `turbo.json`, `.prettierrc` de la raíz, `vite.config.ts`, el
  `ConfigMap` de nginx, la CSP.
- Tests end-to-end con navegador real.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `packages/shared-types/src/trends.ts` (`CategoryTrendSchema`, `TrendPointSchema`:
  `scoreHistory` es `{ uploadId, score, timestamp }[]`, cronológico)
- `apps/frontend/src/pages/Trends.tsx` (componente `CategoryCard`, la línea a reemplazar es
  `category.trend.scoreHistory.map((p) => p.score).join(' → ')`)
- `apps/frontend/src/pages/Trends.test.tsx` (o el archivo de test equivalente, buscar por
  `trends` — ver CA-2 de `tareas/u0-T04-frontend-trends-upgrade.md`) y
  `apps/frontend/src/__tests__/helpers.tsx` (`installFetch`, `renderApp`)
  - u0-T04 por completo (`tareas/u0-T04-frontend-trends-upgrade.md`): molde de CA, decisión
    original de "sin librería de gráficos" que esta tarea revierte parcialmente.
- `aidlc/spaces/default/intents/260925-feature/inception/refined-mockups/design-system-mapping.md`
  (colores: `green-600`, `gray-500`, `red-600`)
- `apps/frontend/package.json`, `apps/frontend/jest.config.js`, `apps/frontend/jest.setup.*`
  (si existe, para el mock de `ResizeObserver`)
- `k8s/frontend/deployment.yaml`
- `aidlc/spaces/default/memory/team.md` y `project.md` (Jest + RTL, cobertura, `npm audit`,
  sin `latest`)

---

## Criterios de aceptación

Cada uno con **su comando**. `$WORK` es un subdirectorio propio del scratchpad (C-38). Antes
de probar: `npm ci`, `npm run build -w packages/shared-types`.

- [ ] **CA-1** — **`recharts` instalado, única dependencia nueva.**

  ```bash
  git diff main...HEAD -- apps/frontend/package.json | grep -E '^[-+] +"'
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  ```

  Esperado: el único paquete de producción agregado es `recharts` (más sus `@types/*` si
  hacen falta, en `devDependencies`); `audit exit=0`.

- [ ] **CA-2** — **El gráfico reemplaza el texto, solo para categorías con tendencia real.**

  ```bash
  npm test -w apps/frontend -- trends --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado, con `GET /api/trends` falso (una categoría de cada `status`):

  - `improving`/`stagnating`/`worsening` con `scoreHistory` de 3 puntos → ya **no** aparece
    el texto literal `62 → 68 → 74`; en su lugar hay un gráfico SVG (query por rol/role del
    contenedor de `recharts`, o por el `aria-label`/texto accesible de CA-4).
  - `locked` e `insufficient_data` siguen exactamente igual que antes (sin gráfico, mismos
    textos/badges de u0-T04).

  **Mutación observable:** pintar el gráfico también para `insufficient_data`, o no
  pintarlo para `worsening`, **hace fallar** su test.

- [ ] **CA-3** — **Color por dirección.**

  ```bash
  npm test -w apps/frontend -- trends --coverage=false --verbose 2>&1 | grep -iE "stroke|color"
  ```

  Esperado: el test verifica que la línea de una categoría `improving` usa el tono verde
  (`green-600` o su valor hex equivalente), `worsening` el rojo (`red-600`), `stagnating` el
  gris (`gray-500`) — no los tres el mismo color.

- [ ] **CA-4** — **Accesibilidad: la serie sigue siendo legible sin ver el SVG.**

  ```bash
  npm test -w apps/frontend -- trends a11y --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:|Test Suites:"
  ```

  Esperado: existe un texto accesible (visible u `sr-only`) con el mismo contenido que el
  texto que reemplaza (p. ej. `62 → 68 → 74` o equivalente con unidades), localizable por
  `getByText`/`aria-label` sin depender del SVG; ningún `h1` duplicado; errores y estados de
  carga de u0-T04 (CA-3, CA-6) siguen en verde.

- [ ] **CA-5** — **Tests estables en `jsdom` (sin flakiness por medición de layout).**

  ```bash
  for i in 1 2 3; do npm test -w apps/frontend -- trends --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"; done
  ```

  Esperado: los tres conteos son idénticos y en verde (ninguna falla intermitente por
  `ResizeObserver`/dimensiones 0 de `recharts` en `jsdom`).

- [ ] **CA-6** — **Los demás workspaces y pantallas no cambian.**

  ```bash
  npm test -w apps/frontend -- --coverage=false 2>&1 | grep -E "Tests:|Test Suites:"
  for w in ingestion-service identity-service trust-service progress-service backend; do printf '%s\n' "== $w"; npm test -w apps/$w 2>&1 | grep -E "Tests:|Test Suites:"; done
  git diff main...HEAD --name-only -- apps/ingestion-service apps/identity-service apps/trust-service apps/progress-service apps/backend packages/shared-types | wc -l
  grep -rnE "\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(" apps/frontend/src || echo "sin skip, only ni todo"
  ```

  Esperado: frontend sin suites fallidas y **más** tests que `main` (anota el conteo de
  `main` al redactar: 336 tests, 28 suites — HANDOFF-16 §5); los cinco servicios backend y
  `shared-types` sin tocar (`wc -l` da `0`); `sin skip, only ni todo`.

- [ ] **CA-7** — **Lint, build del monorepo y formato.**

  ```bash
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | grep -v 'Dockerfile$' | xargs npx prettier --check
  ```

  Esperado: `Tasks: <n> successful, <n> total` sin fallidas; prettier limpio sobre el diff.
  Sin cambios en `eslint.config.js`, `turbo.json`, `.prettierrc` ni `vite.config.ts`.

- [ ] **CA-8** — **Manifiestos: solo cambia el tag.**

  ```bash
  git diff main...HEAD --name-only | grep '^k8s/' | sort
  git diff main...HEAD -- k8s/frontend | grep -E '^[-+] ' | grep -vE '^(---|\+\+\+)'
  grep -q "image: frontend:u0-T06" k8s/frontend/deployment.yaml || echo "FALLO: tag"
  ! grep -rqE "image: .*:latest" k8s/frontend || echo "FALLO: latest"
  kubectl apply --dry-run=server -f k8s/frontend/
  ```

  Esperado: el único archivo de `k8s/` tocado es `k8s/frontend/deployment.yaml`, único
  cambio el tag (`frontend:u0-T05` → `frontend:u0-T06`, ver C-57/nota de HANDOFF-16 §14: el
  pod sigue en `u0-T05` sin el cambio 402 de u9-T02 — este despliegue también lo incluirá);
  ningún `FALLO`; el servidor acepta el manifiesto.

- [ ] **CA-9** — **Despliegue en kind y lectura de vuelta (codificador, con autorización del
      humano para el frontend solamente).**

  ```bash
  kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$5}' | tee $WORK/pods-antes.txt
  lsof -i :3500 || echo "3500 libre"
  docker build -f apps/frontend/Dockerfile -t frontend:u0-T06 .
  kind load docker-image frontend:u0-T06
  kubectl apply -f k8s/frontend/
  kubectl rollout status deployment/frontend --timeout=180s
  kubectl get pods -l app=frontend -o jsonpath='{range .items[*]}{.metadata.name} ready={.status.containerStatuses[0].ready} restarts={.status.containerStatuses[0].restartCount} image={.spec.containers[0].image}{"\n"}{end}'
  ```

  Esperado: rollout completo, un solo pod `Running` con `image=frontend:u0-T06`, `ready=true`,
  `restarts=0`. El codificador **no** deja un `port-forward` abierto al terminar (ver puertos
  en uso en HANDOFF-16 §3, pedir el puerto exacto antes de abrir uno).

- [ ] **CA-10** — Sin secretos en el diff ni en el árbol (CA estándar).
  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```
  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`.

> **Sin ronda de revisor (vigente desde la ola 13):** el codificador es el único control de
> calidad antes de que el orquestador verifique. Debe correr cada CA con su comando real, no
> narrarlo.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- Prueba por valor del gráfico: categorías `improving`/`stagnating`/`worsening` pintan un
  gráfico con el color y los datos correctos; `locked`/`insufficient_data` no pintan nada
  nuevo.
- Prueba negativa: el texto `scoreHistory` plano ya no aparece donde antes había tendencia
  real (evita que el codificador deje el texto Y el gráfico a la vez).
- Prueba de accesibilidad: el contenido de la serie sigue siendo recuperable por texto.
- Prueba de estabilidad: la misma suite corrida varias veces no es intermitente.

**Rojo primero:** el codificador reproduce el fallo (el texto de `scoreHistory` sigue
presente, o el gráfico no se renderiza) antes de instalar `recharts`, y lo registra en la
bitácora.

---

## Notas

- Archivos que se **modifican en su sitio**: `apps/frontend/src/pages/Trends.tsx`,
  `apps/frontend/package.json`, `apps/frontend/package-lock.json` (o el lockfile raíz, según
  cómo esté configurado el workspace), `k8s/frontend/deployment.yaml`, y el o los archivos de
  test de `/trends`. Si el codificador extrae un componente de gráfico reusable, lo crea como
  `apps/frontend/src/components/TrendChart.tsx` (nombre sugerido, no obligatorio) — no
  duplica `CategoryCard` ni `Trends.tsx` con sufijos.
- Esta tarea revierte **parcialmente** la decisión de diseño 1 de u0-T04 ("sin librería de
  gráficos"). No es un fix de especificación de u0-T04 (esa tarea está cerrada y fusionada
  correctamente según lo decidido entonces) — es una decisión nueva del humano en esta ola.
- `recharts` usa SVG, no canvas: no debería chocar con la CSP existente (verificar en CA-7 si
  el build/lint no se queja; si la CSP bloquea algo, es un hallazgo a reportar, no a
  silenciar).

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
