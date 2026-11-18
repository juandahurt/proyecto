# u6-T01 — Motor de cálculo de tendencias por categoría (regresión lineal, sin endpoint)

**Unidad:** u6 — trend-calculation (ProgressService)
**Historias que implementa:** US-6 (FR-6.1 a FR-6.5)
**Depende de:** u5-T01, u5-T02, u5-T03 (todas fusionadas en `main`)

**Decisiones del humano (ola 8):** u6 se redacta **sin paginación**: el cálculo consume el listado completo de `GET /api/uploads` (C-40 y C-44 aceptados para el MVP; se documentan en la bitácora, no se resuelven aquí).

**Decisiones de diseño del orquestador** (no estaban en la unidad; el humano puede objetarlas):

1. **Sin endpoint HTTP nuevo.** Esta tarea entrega el motor (función pura + servicio que lee el historial). La ruta `/api/trends` con la puerta de tier la entrega **u7**. Un endpoint sin puerta expondría datos de pago (FR-7). Consecuencia: no hay despliegue ni lectura de vuelta en el cluster.
2. **`x` = posición ordinal (0, 1, 2…) del upload calificado en orden cronológico**, no el instante. FR-6.2 dice «timestamp como x» pero fija los umbrales «por upload»; con milisegundos como `x` los ±2 no tendrían sentido. Comprobado con el ejemplo de FR-6.2: `[54, 58, 61, 65, 68, 72]` da pendiente 3,54 (la unidad dice «~3,6»; ambas > 2, mismo resultado). El timestamp solo sirve para el orden, y ese orden es **el del listado invertido** (el listado llega más reciente primero con desempate `rowid DESC`); **no se reordena por timestamp** (empates de milisegundos romperían el desempate).
3. **Se calcula al leer, sin guardar nada** (FR-6.3 «recalcular tras cada upload» queda cubierto). Consecuencia para **u13/C9**: no existe `TrendSnapshot` que borrar; queda anotado como candidata.

---

## Alcance

**Dentro** (una línea, concreta):

> Un esquema Zod compartido para el resultado de tendencia por categoría, una función pura `calculateTrends` (regresión lineal por categoría con mínimo de 4 uploads calificados y umbrales configurables), una carga de configuración por variables de entorno, y un servicio `getTrends` que lee el historial con el cliente de ingestion de u5-T02 y devuelve las 5 categorías.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Cualquier ruta HTTP nueva** (`/api/trends`, `/api/trends/calculation`, etc.), la puerta de tier y la llamada a IdentityService: son de u7.
- Persistencia (tabla, caché, `TrendSnapshot`), endpoint de borrado C9 y todo lo de u13.
- Paginación, `limit` o tope de tamaño en `GET /api/uploads` (C-40, C-44).
- Cambiar `ingestion-client.ts`, `history.ts`, `server.ts` o los manifiestos `k8s/`; construir imágenes, `kind load`, `apply`, `rollout`.
- Endurecer los tests de u5-T02 (C-50) y cualquier cambio en ingestion, identity o trust.
- Dependencias nuevas (la regresión se escribe a mano, sin librerías).
- Texto para la interfaz («Not enough data yet…»): es de la capa de presentación; aquí solo se devuelve `uploadsNeeded`.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/intents/260925-feature/inception/requirements-analysis/requirements.md` (FR-6.1 a FR-6.5, FR-3.5)
- `aidlc/spaces/default/intents/260925-feature/inception/user-stories/stories.md` (US-6: AC-6.1 a AC-6.4)
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` (u6, u7)
- `aidlc/spaces/default/intents/260925-feature/inception/contract-design/contract-summary.md` (C3 `CategoryTrend`, C5 superado)
- `packages/shared-types/src/uploads.ts` (`UploadListItemSchema`, `UploadListSchema`) y `anthropic.ts` (`CategoryIdSchema`)
- `apps/progress-service/src/service/ingestion-client.ts`, `handlers/history.ts` y `__tests__/fake-ingestion.ts` (molde del servidor falso)
- `tareas/u5-T02-progress-service-history.md` (molde de servicio y de CA de manifiesto)
- `aidlc/spaces/default/memory/project.md` (Zod autoritativo, `shared-types` única fuente, cobertura)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los va a correr él mismo, uno por uno. `$WORK` es un subdirectorio propio del scratchpad (C-38).

- [ ] **CA-1** — Esquema compartido derivado de Zod, sin duplicados.

  ```bash
  git diff main...HEAD --name-only -- packages/shared-types
  grep -nE "TrendDirectionSchema|CategoryTrendCalcSchema|export type .* = z\.infer" packages/shared-types/src/trends.ts
  grep -rnE "z\.enum\(\['improving'|'stagnating'|insufficient_data" apps packages --include=*.ts | grep -v "packages/shared-types/src/trends.ts" | grep -v "__tests__" || echo "sin tipos duplicados"
  npx tsc --noEmit -p packages/shared-types && echo "tsc shared-types ok"
  ```

  Esperado: el diff lista solo `packages/shared-types/src/trends.ts` e `index.ts` (que lo reexporta); el `grep` muestra los schemas Zod y tipos con `z.infer<>`; `sin tipos duplicados`; `tsc shared-types ok`. Forma mínima del resultado por categoría: `categoryId` (`CAT-1..5`), `status` (`insufficient_data | improving | stagnating | worsening`), `qualifiedCount`, `uploadsNeeded` (entero ≥ 0, `0` cuando hay suficientes) y, **solo** cuando hay tendencia, `slope` y `series` (`uploadId`, `score`, `timestamp`, en orden cronológico). `locked` **no** va aquí: es de u7.

- [ ] **CA-2** — Los ejemplos de la historia dan lo que dice la historia (regresión correcta).

  ```bash
  npm test -w apps/progress-service -- trend-calculator --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:"
  ```

  Esperado: pasan, con nombres que citan el criterio: FR-6.2 `[54,58,61,65,68,72]` → `improving` con pendiente ≈ 3,54; AC-6.1 `[54,58,65,72]` → `improving`; serie constante `[10,10,10,10]` → pendiente `0`, `stagnating`; `[0,10,20,30]` → `improving` (10); `[30,20,10,0]` → `worsening` (−10). La pendiente se calcula como `(n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)` con aritmética entera hasta la división final, para que los bordes sean exactos.

- [ ] **CA-3** — Bordes de los umbrales (por defecto +2 / −2) exactos y sin ambigüedad.

  ```bash
  npm test -w apps/progress-service -- trend-calculator --coverage=false --verbose 2>&1 | grep -iE "borde|umbral|exactamente|threshold"
  ```

  Esperado: pruebas con `[0,2,4,6]` (pendiente exactamente 2) → `stagnating`; `[6,4,2,0]` (exactamente −2) → `stagnating`; `[0,2,4,7]` (2,3) → `improving`; `[7,4,2,0]` (−2,3) → `worsening`. **Mutación observable** (el revisor la hace en una copia): cambiar `>` por `>=` o `<` por `<=` en la clasificación **hace fallar** esos tests.

- [ ] **CA-4** — Mínimo de 4 uploads calificados por categoría (FR-6.1, FR-6.5, AC-6.2) y exclusión de baja confianza (FR-6.4, AC-6.3, AC-6.4).

  ```bash
  npm test -w apps/progress-service -- trend-calculator --coverage=false --verbose 2>&1 | grep -iE "AC-6|FR-6|calificad|baja confianza|insuficiente"
  ```

  Esperado: 3 calificados → `insufficient_data`, `uploadsNeeded: 1`, **sin** `slope` ni `series`; 4 → se calcula; 3 calificados + un 4.º `low_confidence` → sigue `insufficient_data` con `uploadsNeeded: 1` (AC-6.4); 4 calificados + 2 `low_confidence` → `series` con exactamente los 4 calificados (AC-6.3). «Calificado» = `status === 'ready'` **y** `confidence` `HIGH` o `MEDIUM` **y** el item trae score de esa categoría. El umbral mínimo y los umbrales de pendiente son configurables (CA-6); los tests pasan el mínimo como parámetro y comprueban también el valor `2`.

- [ ] **CA-5** — Cada categoría es independiente, siempre salen las 5 y en orden, y el orden cronológico es el del listado invertido.

  ```bash
  npm test -w apps/progress-service -- trend-calculator --coverage=false --verbose 2>&1 | grep -iE "independ|cinco|orden|cronol|empate"
  ```

  Esperado: con CAT-1 con 4 calificados y CAT-2 con 3, CAT-1 tiene tendencia y CAT-2 `insufficient_data`; listado vacío → 5 entradas `insufficient_data` con `qualifiedCount: 0` y `uploadsNeeded: 4`; el resultado va siempre en orden `CAT-1..CAT-5`; `series` es el listado **invertido** (el más antiguo primero), también con timestamps **iguales** (empate de milisegundos): no se reordena por timestamp. **Mutación observable:** no invertir el listado (o reordenar por timestamp con comparador inestable) **hace fallar** el test de dirección y el de empate.

- [ ] **CA-6** — Configuración por entorno con valores por defecto y falla al arrancar si es inválida.

  ```bash
  npm test -w apps/progress-service -- trend-config --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:"
  grep -rn "process\.env" apps/progress-service/src/service/trend-*.ts | grep -v "__tests__" | cut -c1-140
  ```

  Esperado: sin variables → mínimo `4`, umbral de mejora `+2`, umbral de empeoramiento `−2`. Variables: `TREND_MIN_UPLOADS`, `TREND_SLOPE_IMPROVING`, `TREND_SLOPE_WORSENING`. La función de carga recibe el objeto de entorno por parámetro (los tests no tocan `process.env`). Inválidos → lanza con mensaje que **nombra la variable** (sin eco de valores raros): no numérico o vacío, mínimo `< 2` o no entero (la regresión necesita 2 puntos), `TREND_SLOPE_IMPROVING < TREND_SLOPE_WORSENING`. El `grep` solo muestra lecturas en el módulo de configuración, no en el calculador.

- [ ] **CA-7** — El servicio lee el historial de ingestion reenviando solo `Authorization` y propaga los errores sin inventar tendencias.

  ```bash
  npm test -w apps/progress-service -- trend-service --coverage=false --verbose 2>&1 | grep -E "✓|✕|Tests:"
  ```

  Esperado: contra el servidor falso (`__tests__/fake-ingestion.ts`): 200 con items → 5 categorías calculadas; la petición lleva `Authorization` idéntico y **ningún otro header** del cliente; ingestion `401` → resultado `unauthenticated`; 5xx / red / redirección → error de upstream; timeout → `timeout`; cuerpo inválido → `bad-response` (se reutiliza el resultado discriminado de `fetchUploadList`, **sin cambiarlo**). En cualquier fallo no hay tendencias parciales.

- [ ] **CA-8** — Silencio: ni el calculador ni el servicio escriben nada en consola.

  ```bash
  npm test -w apps/progress-service -- trend --coverage=false --verbose 2>&1 | grep -iE "consola|silencio|log"
  ```

  Esperado: un test espía **`console.log`, `info`, `warn`, `error`, `debug` y `process.stdout.write`** (los cinco más stdout, para no repetir C-50) y afirma que no se llamó en el camino feliz, con tendencia, con `insufficient_data` y en cada error de CA-7. **Mutación observable:** añadir un `console.info(userId)` o un `stdout.write` en el servicio **hace fallar** el test.

- [ ] **CA-9** — Ninguna ruta HTTP nueva y los tests existentes siguen verdes sin tocarse.

  ```bash
  grep -nE "app\.(get|post|put|delete|use)\(" apps/progress-service/src/server.ts
  git diff main...HEAD --name-only -- apps/progress-service/src/server.ts apps/progress-service/src/handlers apps/progress-service/src/service/ingestion-client.ts | wc -l
  npm test -w apps/progress-service -- --coverage=false 2>&1 | grep -E "Tests:|Suites:"
  ```

  Esperado: solo `/health`, `/api/trends/history` y el 404; el `wc -l` da `0`; la suite de progress-service pasa entera (los 38 de `main` más los nuevos), sin omitidos ni `todo`.

- [ ] **CA-10** — Regresiones, lint, build y formato de lo que toca la rama.

  ```bash
  npm test -w apps/ingestion-service 2>&1 | grep -E "Tests:"
  npm test -w apps/identity-service 2>&1 | grep -E "Tests:"
  npm test -w apps/trust-service 2>&1 | grep -E "Tests:"
  npm test -w apps/backend 2>&1 | grep -E "Tests:"
  npx turbo run lint build --force 2>&1 | tail -6
  git diff main...HEAD --name-only | xargs npx prettier --check
  ```

  Esperado: cada servicio con los mismos tests que en `main` (ingestion 206, identity 74, trust 25, backend 18 al redactar; si `main` cambió, compara contra `main`); `turbo` termina con `Failed: 0` y `0 cached`; prettier limpio sobre el diff. (`prettier --check .` global falla en `main` por C-51 y no cuenta.)

- [ ] **CA-11** — Cobertura de progress-service sobre los pisos (≥ 80 % líneas globales, ≥ 75 % ramas en `service/` y `handlers/`), sin rebajarlos.

  ```bash
  npm test -w apps/progress-service -- --coverage 2>&1 | grep -E "All files|service|handlers|trend"
  ```

  Esperado: ningún valor bajo los pisos; `trend-calculator.ts` con 100 % de líneas y ramas (es una función pura); `jest.config` sin cambios.

- [ ] **CA-12** — Sin dependencias nuevas.

  ```bash
  git diff main...HEAD --name-only | grep -E "package(-lock)?\.json" || echo "sin cambios de dependencias"
  ```

  Esperado: imprime `sin cambios de dependencias`.

- [ ] **CA-13** — El cluster y la imagen desplegada no se tocaron.

  ```bash
  kubectl get deployment progress-service -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
  kubectl get pods -l app=progress-service -o jsonpath='{.items[0].metadata.name} restarts={.items[0].status.containerStatuses[0].restartCount}{"\n"}'
  git diff main...HEAD --name-only | grep -c '^k8s/' || true
  ```

  Esperado: `progress-service:u5-T02`; el mismo pod que al empezar (anótalo antes en la bitácora) con `restarts=0`; `0` archivos de `k8s/`. No hay `docker build`, `kind load` ni `apply`.

- [ ] **CA-14** — Sin secretos en el diff ni en el árbol (CA estándar).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`. Los tests usan una constante evidentemente falsa de JWT (como los de u5-T02) y no se citan literales con forma de clave (C-29).

- [ ] **CA-15** — Alcance exacto y commits atómicos.

  ```bash
  git diff main...HEAD --name-only | sort
  git log --oneline main..HEAD
  for c in $(git rev-list main..HEAD); do git show --name-only --format='%h %s' $c | head -8; done
  ```

  Esperado: exactamente `packages/shared-types/src/trends.ts`, `packages/shared-types/src/index.ts`, `apps/progress-service/src/service/trend-calculator.ts`, `apps/progress-service/src/service/trend-config.ts`, `apps/progress-service/src/service/trend-service.ts`, `apps/progress-service/src/__tests__/trend-calculator.test.ts`, `…/trend-config.test.ts`, `…/trend-service.test.ts` y `bitacoras/u6-T01.md` (y `…/fake-ingestion.ts` **solo** si hace falta ampliarlo en su sitio, sin duplicados). Cada commit contiene solo los archivos que nombra su mensaje; ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**, no después:

- **Calculador (puro):** los ejemplos de FR-6.2 y AC-6.1; serie constante, creciente y decreciente; los cuatro bordes de CA-3; mínimo 3/4; baja confianza como 4.º; 4 + 2 baja; categorías independientes; listado vacío; orden invertido y empate de milisegundos; item `ready` sin score de una categoría (no cuenta para esa categoría); `slope` y `series` ausentes en `insufficient_data`; el resultado valida contra `CategoryTrendCalcSchema`.
- **Configuración:** valores por defecto, lectura de las tres variables, y cada rechazo de CA-6 (mensaje con el nombre de la variable).
- **Servicio:** historial real contra el servidor falso, reenvío de solo `Authorization`, cada tipo de error de ingestion y el silencio de consola de CA-8.
- Cada prueba de rechazo o de borde afirma por **valor** y no solo «no lanza»; las de dirección comprueban `status` y signo de `slope`.

**Rojo primero (de ejecución, no de compilación — Lección 13):** crea primero `trend-calculator.ts`, `trend-config.ts` y `trend-service.ts` con la firma correcta y un cuerpo que devuelva un valor neutro, escribe los tests y registra que **fallan por aserción**; después implementa. Registra la salida roja en la bitácora. El par falla-pasa es la prueba.

---

## Fix de especificación (ronda 1, 2026-11-18)

Errores del orquestador detectados por el codificador (ver `bitacoras/u6-T01.md`, ATENCIÓN-1 y ATENCIÓN-2):

- **CA-1, segundo `grep`:** estaba mal escrito. Casaba con cualquier aparición del literal `insufficient_data` o `'stagnating'` fuera de `trends.ts`, no solo con enums duplicados. El comando correcto está anclado a `z.enum` y entrecomilla `--include` (en zsh sin comillas falla):
  `grep -rnE "z\.enum\(\[[^]]*'(improving|stagnating|insufficient_data)'" apps packages --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist | grep -v "packages/shared-types/src/trends.ts" | grep -v "__tests__" || echo "sin tipos duplicados"`
  El mapa `TrendStatus` que el codificador exportó desde `trends.ts` no es obligatorio ni defecto: se acepta, pero ya no hace falta para que el criterio pase.
- **CA-4, `uploadsNeeded`:** la fórmula es `max(0, mínimo − calificados)`, con el mínimo configurable (por defecto 4). El «1» del ejemplo es el caso de 3 calificados con mínimo 4.

## Notas

- Archivos que se **modifican en su sitio**: `packages/shared-types/src/index.ts` (solo la reexportación). Nada de duplicados con sufijo. Bitácora nueva: `bitacoras/u6-T01.md` (hash de la tarea, nombre del pod de progress-service antes y después, salida roja inicial, las tres decisiones de diseño de arriba, y que C-40/C-44 siguen abiertas).
- **El listado ya viene ordenado más reciente primero**, con desempate `ORDER BY timestamp DESC, rowid DESC` (C5 superado, sin paginación). El motor lo invierte; no confíes en `timestamp` para ordenar.
- `scores` viene vacío en `low_confidence`; en `ready` trae las 5 categorías en orden de `categoryId`. Un item `status: 'ready'` con `confidence: 'LOW'` no debería existir: trátalo como **no calificado** (defensivo) y deja un test.
- Los umbrales por defecto son **valores iniciales** (el PRD los marca como asunción a calibrar): por eso son configurables.
- Para u7: `locked` se añade allí; u7 construye `TrendResponse` a partir de `CategoryTrendCalcSchema`. Para u13: este diseño no persiste nada, así que el endpoint C9 de borrado de `TrendSnapshot` no tiene qué borrar; el codificador lo anota en la bitácora (el orquestador lo registra como candidata).
- **Compila los paquetes compartidos antes de probar, y otra vez tras tocar `shared-types`.** Los tests de progress-service importan `@proyecto/shared-types` desde su `dist` (ignorado por git). En un worktree limpio: `npm ci`, `npm run build -w packages/shared-types`, `npm run build -w packages/auth-middleware`. Sin ese paso la suite entera falla al compilar (`Tests: 0 total`), y como u6 **añade** `trends.ts`, hay que repetir `npm run build -w packages/shared-types` después de crearlo y antes de correr los tests de progress-service. Con eso, la base de `main` da 38 tests.
- `npm test` ya lleva `--coverage`; para quitarlo se pasa `--coverage=false` (los CA lo usan donde no miden cobertura).
- No hagas push, no abras PR, no fusiones. Usa `git add <rutas explícitas>` (nunca `-a`) y un subdirectorio propio del scratchpad para `$WORK`.

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
