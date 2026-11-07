# WS-T04 — Base de datos SQLite + endpoint `POST /critiques` que cierra las cuatro capas del skeleton

> **Cuarta tarea del Walking Skeleton (Bolt 1).** Es la que cierra la hipótesis
> del skeleton: una petición HTTP real entra, se invoca el stub de Claude, el
> resultado se persiste en una base de datos local, y el cliente recibe la
> respuesta con su `id` de persistencia. Es el momento en que las cuatro
> capas (HTTP, servicio Claude, BD, respuesta) se tocan por primera vez
> extremo a extremo.

**Unidad:** Bolt 1 — Walking Skeleton (preparando u1-image-upload, u2-ai-critique, u4-critique-storage)
**Historias que implementa:** ninguna todavía — habilita la hipótesis completa del skeleton (4 de 4 capas)
**Depende de:** WS-T01 (monorepo), WS-T02 (backend arrancable), WS-T03 (stub cliente)

---

## Alcance

**Dentro** (una línea, concreta):

> Driver SQLite (`better-sqlite3`) con schema `critiques`, módulo de repositorio con `save/getById`, nuevo endpoint `POST /critiques` que valida input con Zod, invoca `AnthropicClient.critique`, persiste, y responde `{data:{id, response}, error:null, status:200}`, con suite Jest que cubre repositorio, endpoint end-to-end (supertest), caminos de error (stub fallando → 502; input inválido → 400), y cobertura ≥80% líneas / ≥75% branches en `src/service/` y `src/handlers/`.

**Fuera** (rechazar aunque se vea roto):

- Base de datos en contenedor aparte (Postgres, MySQL, Mongo) — el skeleton usa SQLite local, decisión afirmada por el humano
- ORM (Prisma, TypeORM, Drizzle, Knex) — una sola tabla, un repositorio a mano, nada de abstracciones
- Autenticación o identidad del usuario en el endpoint — u8-authentication
- Validación de imágenes, multipart, upload de archivos — u1-image-upload
- Reintentos, idempotencia, deduplicación — producción, no skeleton
- Rate limiting, control de cuotas, validación de talla del body — u9-upload-limits
- Logger estructurado o trazas — observability-setup o cuando haya más de dos endpoints
- Migraciones versionadas tipo flyway/alembic — un `CREATE TABLE IF NOT EXISTS` en el init alcanza para el skeleton
- Transacciones complejas o modelo relacional de múltiples tablas — una sola tabla
- Dockerfile y manifiestos Kubernetes — WS-T05
- Llamada real a `api.anthropic.com` — se habilita cuando entre u2-ai-critique
- Cambios a `apps/backend/src/handlers/health.ts` ni a los tests de `/health` ni al `/health` existente
- Cambios a archivos de WS-T01 (`eslint.config.js`, `turbo.json`, `tsconfig.base.json`) ni a `tareas/` ni a `revisiones/`

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/memory/team.md` — reglas afirmadas: respuestas HTTP `{ data, error, status }`, errores de Anthropic envueltos en `AnthropicIntegrationError`, Zod autoritativo con `z.infer<>`, Jest + ts-jest, coverage ≥80% líneas / ≥75% branches en `service/` y `handlers/`, nada de `latest` en imágenes
- `aidlc/spaces/default/memory/project.md` — reglas duras: NEVER secretos en repo, ALWAYS zod para validación en runtime, NEVER almacenar nombre de archivo del usuario sin control del servidor
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — catálogo de unidades (u4-critique-storage es la unidad futura que este skeleton allana)
- `tareas/WS-T03-stub-claude-client.md` — contrato del stub (qué devuelve, qué rechaza, scenario de error)
- `packages/shared-types/src/anthropic.ts` — `CritiqueResponseSchema` y tipo `CritiqueResponse` ya existentes
- `packages/shared-types/src/index.ts` — re-export point del package
- `apps/backend/src/service/anthropic-client.ts` — cliente a inyectar en el handler
- `apps/backend/src/service/anthropic-error.ts` — tipo de error a reconocer
- `apps/backend/src/server.ts` — factory `createApp` donde registrar el nuevo router
- `apps/backend/jest.config.js` — threshold a mantener sobre `src/service/` y `src/handlers/`

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/WS-T04` checada.

- [ ] **CA-1** — `better-sqlite3` está declarado como dependencia de `apps/backend`; ningún otro driver de BD aparece

  ```bash
  node -e 'const p=require("./apps/backend/package.json"); if(!p.dependencies?.["better-sqlite3"])throw new Error("better-sqlite3 missing"); for (const banned of ["pg","mysql2","mongodb","prisma","@prisma/client","drizzle-orm","knex","typeorm"]) { if (p.dependencies?.[banned]||p.devDependencies?.[banned]) throw new Error("banned dep present: "+banned); } console.log("ok, better-sqlite3@"+p.dependencies["better-sqlite3"])'
  ```

  Esperado: imprime `ok, better-sqlite3@<versión>`. Ningún otro driver instalado.

- [ ] **CA-2** — `packages/shared-types` publica `CritiqueRequestSchema` y `PersistedCritiqueSchema` (y sus tipos derivados) con re-export desde el `index.ts`

  ```bash
  grep -E "(CritiqueRequestSchema|PersistedCritiqueSchema)" packages/shared-types/src/anthropic.ts
  grep -E "export .* from .*anthropic" packages/shared-types/src/index.ts
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: ambos schemas presentes en `anthropic.ts` (o en un archivo nuevo re-exportado), `index.ts` los expone, `tsc` exit 0.

- [ ] **CA-3** — `CritiqueRequestSchema` valida `{ input: string(min 1, max 5000) }`; rechaza string vacío y string de >5000 caracteres (lectura de vuelta por safeParse)

  ```bash
  grep -E "input.*z\.string\(\)" packages/shared-types/src/anthropic.ts
  # Verificación semántica ocurre en los tests; aquí sólo verifico que el bound está explícito:
  grep -E "(max\(\s*5000|min\(\s*1)" packages/shared-types/src/anthropic.ts
  ```

  Esperado: aparecen las dos cotas (`min(1)` y `max(5000)`) sobre el schema de request. Los tests de contrato (CA-9) hacen la validación semántica real.

- [ ] **CA-4** — Módulo de base de datos `apps/backend/src/service/database.ts` abre una conexión SQLite a una ruta configurable y crea la tabla `critiques` si no existe (schema: id INTEGER PK autoincrement, input TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)

  ```bash
  test -f apps/backend/src/service/database.ts
  grep -E "CREATE TABLE IF NOT EXISTS critiques" apps/backend/src/service/database.ts
  grep -E "(id|input|response_json|created_at)" apps/backend/src/service/database.ts | head -10
  ```

  Esperado: archivo existe, tabla se crea en el init del módulo, las cuatro columnas aparecen.

- [ ] **CA-5** — Repositorio `apps/backend/src/service/critique-repository.ts` expone al menos `save(input: string, response: CritiqueResponse): { id: number }` y `getById(id: number): PersistedCritique | null`

  ```bash
  test -f apps/backend/src/service/critique-repository.ts
  grep -E "(save\s*\(|getById\s*\()" apps/backend/src/service/critique-repository.ts
  ```

  Esperado: ambos métodos declarados en la clase o en los exports del módulo.

- [ ] **CA-6** — Handler `apps/backend/src/handlers/critiques.ts` expone `POST /critiques` registrado en `server.ts`. El flujo: valida body con `CritiqueRequestSchema` → llama `client.critique(body.input)` → persiste con `repo.save(...)` → responde `{ data: { id, response }, error: null, status: 200 }`

  ```bash
  test -f apps/backend/src/handlers/critiques.ts
  grep -E "(POST|post|router\.post|app\.post).*(critiques|/critiques)" apps/backend/src/handlers/critiques.ts apps/backend/src/server.ts
  grep -E "CritiqueRequestSchema" apps/backend/src/handlers/critiques.ts
  ```

  Esperado: ruta registrada, schema de request usado para validar, patrón visible.

- [ ] **CA-7** — El endpoint responde HTTP 200 con el shape correcto en el camino feliz, y la respuesta persistida se puede leer de vuelta por `/critiques/:id` (**GET**). Si decides no exponer el GET en esta tarea, la lectura de vuelta la hace el test directamente contra el repositorio en el mismo proceso. El camino elegido se registra en la bitácora.

  ```bash
  npm test -w apps/backend -- --testPathPattern=critiques 2>&1 | tail -20
  ```

  Esperado: al menos **4 tests pasados** cubriendo: (a) POST 200 con body `{data:{id, response:{summary, categories}},error:null,status:200}`, (b) lectura de vuelta del registro persistido (vía GET o repositorio directo en el test), (c) input inválido → 400, (d) stub con `scenario: "error"` → 502. 0 skipped.

- [ ] **CA-8** — Camino de error del stub mapea a HTTP 502 con body `{ data: null, error: string, status: 502 }` (regla de team.md de envolver errores de Anthropic). El test de ese caso construye el handler con un `AnthropicClient` en `scenario: "error"` y asserta el status y la forma del body

  ```bash
  npm test -w apps/backend -- --testPathPattern=critiques 2>&1 | grep -E "(502|AnthropicIntegrationError|error scenario|anthropic error)"
  ```

  Esperado: aparece al menos un test con esos tokens en su nombre o en una aserción, y todos los tests del archivo pasan en verde.

- [ ] **CA-9** — Camino de input inválido mapea a HTTP 400 con body `{ data: null, error: string, status: 400 }`. Al menos dos variantes probadas: body ausente y body con `input` vacío

  ```bash
  npm test -w apps/backend -- --testPathPattern=critiques 2>&1 | grep -E "(400|invalid input|bad request|CritiqueRequestSchema)"
  ```

  Esperado: aparece al menos un test con esos tokens, suite completa en verde.

- [ ] **CA-10** — El test end-to-end de CA-7(a) usa supertest en un proceso real y lee de vuelta el `id` devuelto del body desde la BD en el mismo test (lectura de vuelta por herramienta real, no por código de salida del handler)

  ```bash
  grep -E "supertest" apps/backend/src/__tests__/*.ts | grep -i critique
  grep -E "(getById|SELECT)" apps/backend/src/__tests__/*.ts | head -3
  ```

  Esperado: supertest importado en el test de critiques, y alguna forma de leer el registro de la BD (vía repo o SQL directo) aparece en el mismo archivo de tests.

- [ ] **CA-11** — Cobertura: `apps/backend/src/service/*.ts` y `src/handlers/*.ts` cumplen ≥80% líneas y ≥75% branches

  ```bash
  npm test -w apps/backend -- --coverage --coverageReporters=text --coverageReporters=json-summary 2>&1 | tail -15
  cat apps/backend/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d); const buckets=["/src/service/","/src/handlers/"]; for (const bucket of buckets) { const keys=Object.keys(s).filter(k=>k.includes(bucket)); if(!keys.length) throw new Error("no files in "+bucket); for(const k of keys){ const f=s[k]; if(f.lines.pct<80) throw new Error(k+" lines "+f.lines.pct+"% < 80%"); if(f.branches.total>0 && f.branches.pct<75) throw new Error(k+" branches "+f.branches.pct+"% < 75%"); } } console.log("coverage ok on service/ + handlers/")})'
  ```

  Esperado: imprime `coverage ok on service/ + handlers/`.

- [ ] **CA-12** — `GET /health` sigue respondiendo con el shape histórico (no se rompió WS-T02)

  ```bash
  rm -f /tmp/health.json /tmp/server.log
  (cd apps/backend && PORT=3101 npm run start > /tmp/server.log 2>&1 &); sleep 2
  curl -sf http://localhost:3101/health -o /tmp/health.json
  pkill -f "node .*dist/index" 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("health response broken: "+JSON.stringify(r)); console.log("health intact")'
  ```

  Esperado: imprime `health intact`.

- [ ] **CA-13** — `npm run lint` desde la raíz pasa

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0, `turbo` reporta `successful`.

- [ ] **CA-14** — `.gitignore` excluye archivos `*.db`, `*.sqlite` y el directorio de datos por defecto para que ningún archivo binario de SQLite entre al repositorio

  ```bash
  grep -E "(\*\.db|\*\.sqlite|data/)" .gitignore
  # Verificación dura: ningún .db tracked
  ! git ls-files | grep -E "\.(db|sqlite|sqlite3)$"
  ```

  Esperado: patrones presentes, y ningún archivo de BD tracked (negación exit 0).

- [ ] **CA-15** — El archivo de BD por defecto (`./data/critiques.db` o el nombre que el codificador elija) no quedó commiteado y tampoco quedó modificando el tree al terminar los tests

  ```bash
  git status --short | grep -E "\.(db|sqlite|sqlite3)$" && echo "FAIL: db file in working tree" && exit 1
  echo "no db leftover in tree"
  ```

  Esperado: imprime `no db leftover in tree`.

- [ ] **CA-16** — Rama `tarea/WS-T04` sobre `main` con ≥2 commits (es una tarea amplia: schema + repo + handler + tests; probablemente requiere separarlos en commits para que el PR se lea)

  ```bash
  git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/WS-T04`, al menos 2 commits sobre `main`.

- [ ] **CA-17** — No hay procesos de node ni servers residuales del smoke test de CA-12

  ```bash
  pgrep -f "node .*dist/index" 2>&1; test -z "$(pgrep -f 'node .*dist/index')" && echo "no leftover node processes"
  ```

  Esperado: imprime `no leftover node processes`.

- [ ] **CA-18** — Ningún secreto ni credencial entra al diff ni al tree (misma barrera que WS-T03)
  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff or tree"
  ```
  Esperado: imprime `no secrets in diff or tree`.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- `apps/backend/src/__tests__/critique-repository.test.ts`:
  - **Round-trip**: `save(input, response)` devuelve un `id`; `getById(id)` devuelve el registro con `input`, `response` (ya parseado desde JSON), y `createdAt`. CA-5 + CA-10.
  - **Null para id inexistente**: `getById(99999)` devuelve `null`.
  - **Init idempotente**: llamar al init del `database` dos veces no falla ni duplica la tabla.
- `apps/backend/src/__tests__/critiques-endpoint.test.ts`:
  - **POST 200 feliz**: `POST /critiques { input: "una imagen" }` → 200 con body `{data:{id, response:{summary, categories}},error:null,status:200}`. El test lee de vuelta el registro por `repo.getById(data.id)` y verifica igualdad semántica con `response`. CA-7(a) + CA-7(b) + CA-10.
  - **POST 400 body ausente**: `POST /critiques` sin body → 400 con body `{data:null,error:"...",status:400}`. CA-9.
  - **POST 400 input vacío**: `POST /critiques { input: "" }` → 400. CA-9.
  - **POST 502 stub error**: handler construido con `new AnthropicClient({ scenario: "error" })` → el POST responde 502 con body `{data:null,error:"...",status:502}`. CA-8.
  - **Integración con schema**: la respuesta del handler pasa `CritiqueResponseSchema.parse(body.data.response)` sin lanzar.
- `apps/backend/src/__tests__/health.test.ts`: sin cambios, debe seguir pasando. CA-12 lo confirma por supertest o por smoke test con curl.

**Rojo primero:** antes de crear `database.ts`, `critique-repository.ts` y `critiques.ts`, el codificador escribe los dos archivos de tests, los corre, los ve fallar (módulos y ruta no existen aún), lo registra en la bitácora. Luego implementa en el orden `database → repository → handler → wire-up en server.ts`. Luego vuelve a correr y los ve pasar. El par falla-pasa es la prueba.

---

## Notas

- **Dónde vive la ruta de la BD:** `process.env.DB_PATH || './data/critiques.db'` para producción/dev. En los tests, usa `':memory:'` (SQLite tiene este modo nativo, abre una BD efímera en RAM; `better-sqlite3` lo soporta pasando ese literal como path). El test crea una nueva instancia de `database` y `repository` por archivo, no comparte estado entre archivos. Esto evita archivos `.db` residuales y conflictos de concurrencia.
- **Inyección de dependencias en el handler:** el handler no construye el cliente ni el repositorio por dentro; los recibe por constructor (o por closure del factory del router). Esto es lo que permite al test construir el handler con `new AnthropicClient({ scenario: "error" })` para CA-8 sin tocar nada global. Pattern: `function createCritiquesRouter(deps: { client: AnthropicClient; repo: CritiqueRepository }): Router`.
- **Serialización del response en la BD:** la columna `response_json` guarda `JSON.stringify(response)`. El repositorio hace `JSON.parse` al leer. Simple, sin ORM.
- **Shape de `PersistedCritique`:** `{ id: number; input: string; response: CritiqueResponse; createdAt: string }`. Es el tipo que devuelve `getById` y el que podrías exponer en un futuro GET.
- **Mapeo de errores en el handler:**
  - `ZodError` en el parse del body → 400 con el mensaje de validación (no filtres el stack; sanitiza).
  - `AnthropicIntegrationError` del cliente → 502 con mensaje genérico `"anthropic integration error"` (nada de leaked internals).
  - Error inesperado del repositorio (p. ej., falla de disk) → 500.
- **Nada de kubectl, helm, docker, push ni merge.**
- **Tamaño del PR:** este es el PR más grande del skeleton (BD + endpoint + tests). Divide tus commits lógicamente para que el humano pueda leer el diff en pasos: (1) deps + schema, (2) database + repository + sus tests, (3) handler + tests end-to-end, (4) wire-up en server.ts + bitácora. El criterio CA-16 exige ≥2 commits por esta razón.
- **PID cleanup:** el smoke test de CA-12 levanta un server; mátalo tú mismo antes de terminar (CA-17 lo verifica).
- **No toques el `/health`** ni sus tests. Añade rutas, no las reemplaces.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/WS-T04`. Base: `main`. Modelo de aislamiento: rama directa en el clon `/Users/aureliano/Desktop/proyecto` (no se usan worktrees; cada tarea empuja su rama a `origin` y se abre un PR en GitHub). Este es el cierre end-to-end del Walking Skeleton: después de este merge, WS-T05 solo empaca en Docker + K8s._
