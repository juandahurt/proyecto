# u3-T02 — Cerrar C-22 (`maxRetries: 0` en el cliente de Claude) y C-29 (CA estándar de secretos en la plantilla)

> **Tarea pequeña de mantenimiento**, en paralelo con u5-T01. Cierra dos candidatas que el humano decidió resolver ahora (HANDOFF-9 §7.4).
> No cambia ningún contrato HTTP ni ningún schema.
>
> **Decisiones del humano (ya tomadas, no se reabren):**
>
> - **C-22: sí.** C10 `ErrorBehavior` dice «No retry»; el SDK reintenta 2 veces por defecto. Se fija `maxRetries: 0`.
> - **C-29: sí**, por la vía de poner el CA estándar de secretos en `tareas/_plantilla.md` con el barrido de árbol que excluye `bitacoras/` y `revisiones/`.
> - **C-23 (razón `api_error`) queda fuera**: sigue como candidata con decisión pendiente.
> - **Esta tarea NO despliega nada.** No hay `kubectl apply`, `kind load` ni `rollout`. El manifiesto no cambia. El código de C-22 llegará al cluster con el siguiente despliegue.

**Unidad:** u3-low-confidence (mantenimiento sobre `claude-client.ts` de u2/u3)
**Historias que implementa:** FR-3.3 / C10 «No retry» (la espera máxima antes del fallback es el timeout de 30 s, no 3 × 30 s).
**Depende de:** u4-T02 (fusionada, `main` @ `a9b9e39` o posterior).

---

## Alcance

**Dentro** (todo lo que el codificador entrega en este diff):

> **`apps/ingestion-service/src/service/claude-client.ts`** (modificar, una línea de código): `new Anthropic({ apiKey })` pasa a `new Anthropic({ apiKey, maxRetries: 0 })`.
> Actualizar el comentario de la función si menciona reintentos; sin cambiar nada más (modelo, prompt, timeout, mapeo de errores, stub).
>
> **`apps/ingestion-service/src/__tests__/claude-client.real.test.ts`** (modificar, aditivo): añadir un test que fije la opción **observando los argumentos que recibe el constructor simulado** del SDK:
> el mock ya es `jest.fn()` (`Ctor`), así que se lee `(Anthropic as unknown as jest.Mock).mock.calls` y se afirma que la última llamada recibió un objeto con `maxRetries === 0` **y** `apiKey` igual a la clave de prueba.
> Como `mockReset()` del `beforeEach` solo limpia `mockCreate`, el test debe **limpiar las llamadas del constructor** (`(Anthropic as unknown as jest.Mock).mockClear()`) antes de invocar a `callClaudeVision`, o el índice sería frágil.
>
> **`tareas/_plantilla.md`** (modificar, aditivo): añadir a la sección «Criterios de aceptación» un **CA estándar «Sin secretos»** (con su comando y su «Esperado») y una nota breve, copiando la forma ya validada de `tareas/u4-T02-thumbnail-signed-url.md` CA-16:
>
> - el barrido del **diff** (`git diff main...HEAD --name-only | xargs …`) **no excluye nada**;
> - el barrido del **árbol** (`git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs …`) **excluye `bitacoras/` y `revisiones/`**;
> - una nota que dice: «no cites literales con forma de clave en bitácoras, tests ni comentarios; descríbelos en palabras (C-29)».
>
> No se toca ningún otro párrafo de la plantilla.

**Fuera** (el codificador rechaza aunque lo vea roto o útil):

- C-23 (`api_error`), cambios en `shared-types`, en `critique-outcome.ts` o en `anthropic-error.ts`.
- Cambiar el timeout, el modelo, el prompt, el stub o la lógica de errores de `claude-client.ts`.
- Editar tareas ya redactadas (`tareas/u*-T0*.md`): **solo** `_plantilla.md`. (Las tareas nuevas ya llevan el barrido corregido.)
- C-33 (escáner de secretos por valor), C-34, C-38.
- Manifiestos de K8s, `Dockerfile`, `package.json`, `package-lock.json`, cualquier otro servicio.
- Desplegar: **no** `kind load`, **no** `kubectl apply`, **no** `rollout`.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `.claude/orquestador.md` y `.claude/agents/codificador.md` — contratos del loop
- `aidlc/spaces/default/memory/project.md` — reglas duras (sin secretos)
- `apps/ingestion-service/src/service/claude-client.ts` (se modifica; línea de `new Anthropic`)
- `apps/ingestion-service/src/__tests__/claude-client.real.test.ts` (se amplía; ver `Ctor` en el `jest.mock`)
- `apps/ingestion-service/src/__tests__/claude-client.contract.test.ts` (no se toca; debe seguir verde)
- `tareas/_plantilla.md` (se modifica) y `tareas/u4-T02-thumbnail-signed-url.md` (CA-16 es el molde)
- `CANDIDATAS.md` — C-22 y C-29

---

## Criterios de aceptación

Cada uno con su comando. El revisor los corre desde la raíz del worktree con `tarea/u3-T02` checada. En un worktree limpio hay que compilar antes los packages:
`npm run build -w packages/shared-types && npm run build -w packages/auth-middleware`.

- [ ] **CA-1** — El cliente se construye con `maxRetries: 0` y no cambió nada más del archivo.

  ```bash
  grep -n "maxRetries" apps/ingestion-service/src/service/claude-client.ts
  git diff main...HEAD -- apps/ingestion-service/src/service/claude-client.ts | grep -E "^[+-][^+-]"
  ```

  Esperado: `maxRetries: 0` aparece en la línea del `new Anthropic(...)`; el diff del archivo son **a lo sumo 2–4 líneas** (la del constructor y, si procede, su comentario). Cualquier cambio de timeout, modelo o prompt es un fallo.

- [ ] **CA-2** — Un test fija la opción observando los argumentos del constructor, y **falla si se quita**.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=claude-client.real --no-coverage --verbose 2>&1 | grep -E "(maxRetries|retries|reintent|constructor)"
  ```

  Esperado: test en verde cuyo nombre menciona `maxRetries`/reintentos. **Criterio de mutación (lo ejecuta el revisor):** si se borra `maxRetries: 0` del constructor, ese test debe **fallar por la aserción** (no por compilación); si se cambia por `maxRetries: 2`, también debe fallar. Además el test afirma que el constructor recibió la `apiKey` de prueba (no solo `maxRetries`).

- [ ] **CA-3** — El test no depende del orden de ejecución ni de llamadas ajenas: pasa solo y con todo el archivo, y con `--runInBand`.

  ```bash
  npm test -w apps/ingestion-service -- --testPathPattern=claude-client.real --no-coverage -t "maxRetries" 2>&1 | tail -8
  npm test -w apps/ingestion-service -- --testPathPattern=claude-client --no-coverage --runInBand 2>&1 | tail -8
  ```

  Esperado: ambos en verde (el primero corriendo **solo** ese test, lo que prueba que limpia las llamadas del constructor).

- [ ] **CA-4** — Regresiones: toda la suite de ingestion y backend en verde, sin tests saltados ni debilitados; el test de contrato de la respuesta de Claude sigue verde.

  ```bash
  npm test -w apps/ingestion-service -- --no-coverage 2>&1 | tail -15
  npx tsc --noEmit -p apps/ingestion-service 2>&1 | tail -3
  npx tsc --noEmit -p apps/backend 2>&1 | tail -3
  ```

  Esperado: ingestion completa en verde (incluido `claude-client.contract.test.ts`), `tsc` exit 0 en ambos.

- [ ] **CA-5** — Cobertura por archivo de `src/service/` y `src/handlers/` ≥ 80% líneas y ≥ 75% branches.

  ```bash
  npm test -w apps/ingestion-service -- --coverage --coverageReporters=json-summary 2>&1 | tail -8
  cat apps/ingestion-service/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); for (const bucket of ["/src/service/","/src/handlers/"]) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok ingestion-service service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok ingestion-service service/ + handlers/`.

- [ ] **CA-6** — La plantilla lleva el CA estándar de secretos con la exclusión correcta; es ejecutable tal cual y **pasa en el árbol actual**.

  ```bash
  grep -n "bitacoras|revisiones" tareas/_plantilla.md
  grep -nE "no cites literales|C-29" tareas/_plantilla.md
  node -e 'const t=require("fs").readFileSync("tareas/_plantilla.md","utf8");const m=t.match(/git ls-files \| grep -vE "\^\(bitacoras\|revisiones\)\/"[^\n]*/);if(!m)throw new Error("sin barrido de árbol con exclusión");const d=t.match(/git diff main\.\.\.HEAD --name-only \| xargs[^\n]*/);if(!d)throw new Error("sin barrido de diff");if(/bitacoras|revisiones/.test(d[0]))throw new Error("el barrido del diff NO debe excluir nada");console.log("plantilla: árbol excluye bitacoras/revisiones, diff no excluye nada")'
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: las dos primeras líneas muestran las coincidencias en la plantilla; imprime `plantilla: árbol excluye bitacoras/revisiones, diff no excluye nada`; imprime `no secrets in diff or tree` (la plantilla nueva **no** introduce un falso positivo en el barrido del árbol).

- [ ] **CA-7** — Lint y Prettier pasan (sin caché de turbo).

  ```bash
  npx turbo run lint --force 2>&1 | tail -8
  npx prettier --check apps/ingestion-service/src tareas/_plantilla.md tareas/u3-T02-max-retries-secret-scan.md 2>&1 | tail -5
  ```

  Esperado: exit 0, 0 errores; Prettier sin archivos pendientes.

- [ ] **CA-8** — **Sin dependencias nuevas**, sin cambios de manifiesto, sin despliegue.

  ```bash
  git diff main...HEAD --name-only | grep -E "(^|/)package(-lock)?\.json$" && echo "FAIL: dependencias tocadas" && exit 1 || echo "no dependency changes"
  git diff main...HEAD --name-only | grep -E "^k8s/" && echo "FAIL: k8s tocado" && exit 1 || echo "k8s intacto"
  kubectl get deployment ingestion-service -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
  ```

  Esperado: imprime `no dependency changes` y `k8s intacto`; la imagen del cluster **sigue** siendo la que tenía al empezar (la bitácora registra cuál era: esta tarea no la cambia).

- [ ] **CA-9** — Sin secretos en el diff ni en el árbol.

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  ```

  Esperado: imprime `no secrets in diff`. La clave de prueba del test es evidentemente falsa; no cites literales con forma de clave en bitácoras, tests ni comentarios.

- [ ] **CA-10** — Scope respetado (`main...HEAD`, tres puntos).

  ```bash
  git diff main...HEAD --name-only | grep -vE "^(apps/ingestion-service/src/service/claude-client\.ts|apps/ingestion-service/src/__tests__/claude-client\.real\.test\.ts|tareas/_plantilla\.md|bitacoras/u3-T02\.md)$" && echo "FAIL: archivo fuera de alcance" && exit 1
  echo "scope respected"
  ```

  Esperado: imprime `scope respected` (solo esos cuatro archivos; `tareas/u3-T02-max-retries-secret-scan.md` ya está en `main`).

- [ ] **CA-11** — Rama `tarea/u3-T02` sobre `main` con ≥ 2 commits legibles (uno por candidata), sin `git commit -a`.

  ```bash
  git rev-parse --abbrev-ref HEAD
  git log --oneline main..HEAD | head -10
  git show --stat --format=%s HEAD | head -10
  ```

  Esperado: rama `tarea/u3-T02`, al menos 2 commits (C-22 y C-29 por separado), cada uno solo con los archivos de su mensaje.

---

## Plan de pruebas

**Rojo primero (de ejecución, no de compilación — Lección 13):** escribe **primero** el test de `maxRetries` y córrelo **antes** de tocar `claude-client.ts`: debe fallar por la aserción (`maxRetries` recibido `undefined`, esperado `0`), no por un error de tipos ni de import. Registra la salida roja en la bitácora, aplica la línea y pásalo a verde.

- `claude-client.real.test.ts` (ampliar): un test con nombre que contenga `maxRetries`; aserción sobre el objeto de opciones **y** sobre `apiKey`; `mockClear()` del constructor antes de la llamada; la clave de prueba existente (`test-key-not-real`).
- No añadas tests que dependan de la red ni de `ANTHROPIC_API_KEY` reales.

---

## Notas

- **Por qué no hay despliegue:** el cluster no tiene `ANTHROPIC_API_KEY`, así que la rama real del cliente **nunca se ejecuta allí**; no hay nada que verificar en kind. El cambio se valida con el SDK simulado, y llegará a la imagen cuando se despliegue la siguiente tarea de ingestion.
- **Por qué solo la plantilla y no las tareas viejas:** las tareas ya redactadas no se reescriben (son historia de lo que se despachó). Las nuevas (u4-T02, u5-T01) ya llevan el barrido de árbol corregido.
- **Candidatas que esta tarea cierra:** C-22 y C-29. El orquestador las marca cerradas en `CANDIDATAS.md`; **no las edites tú**.
- Archivos que se **modifican en su sitio**: `claude-client.ts`, `claude-client.real.test.ts`, `tareas/_plantilla.md`. Nada de duplicados con sufijo.
- **No fusiones**, no abras el PR, no hagas push. No toques el cluster para escribir en él.
- **Bitácora:** `bitacoras/u3-T02.md` con: hash de la tarea, salida roja inicial del test, la imagen que corría en el cluster al empezar (solo lectura), la mutación que probaste tú mismo (qué borraste y qué falló) y respuestas a hallazgos del revisor por identificador. Usa `git add <rutas>` explícitas y un subdirectorio propio del scratchpad (C-38).

---

_Tarea redactada por el orquestador. Rama destino: `tarea/u3-T02`. Base: `main`.
Worktree: `/Users/aureliano/Desktop/proyecto-u3-T02`. Sin imagen Docker nueva ni despliegue.
Pertenece a la **ola 6** (en paralelo con u5-T01; ficheros disjuntos: `claude-client.ts` vs `handlers/uploads.ts`/`upload-repository.ts`)._
