# WS-T02 — Endpoint HTTP mínimo `/health` en `apps/backend`

> **Segunda tarea del Walking Skeleton (Bolt 1).** Pone en pie el primer endpoint HTTP del
> backend. Es el eslabón que valida que el scaffold de WS-T01 no era adorno: hay un proceso
> Node que arranca, responde JSON en forma `{data, error, status}` y tiene cobertura de test
> propia.

**Unidad:** Bolt 1 — Walking Skeleton (preparando u1-image-upload, u2-ai-critique, u8-authentication)
**Historias que implementa:** ninguna todavía — habilita a US-1, US-8
**Depende de:** WS-T01 (scaffolding del monorepo)

---

## Alcance

**Dentro** (una línea, concreta):

> Servidor Express sobre TypeScript en `apps/backend`, con `GET /health` que devuelve `{"data":{"status":"ok"},"error":null,"status":200}`, arrancable con `npm run dev`, y suite Jest + supertest que lo cubre al 80%+ de líneas.

**Fuera** (rechazar aunque se vea roto):

- Base de datos — WS-T04
- Stub de la API de Claude — WS-T03
- Endpoint `POST /uploads` o cualquier ruta distinta de `/health`
- Autenticación, JWT, bcrypt — u8-authentication (otra unidad)
- Dockerfile y manifiestos K8s — WS-T05
- Logger estructurado (pino, winston) — se añade cuando haya más de dos rutas
- Middleware de CORS — el frontend aún no existe, no urge
- Configuración de environment variables más allá de `PORT` — no hay secretos todavía
- Renombrar archivos de WS-T01 (`eslint.config.js`, `turbo.json`, etc.) ni cambiar reglas de lint

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/memory/team.md` — reglas afirmadas: Jest con ts-jest, coverage ≥80% líneas / ≥75% branches en `service/` y `handlers/`, respuestas HTTP `{ data, error, status }`, errores de Anthropic envueltos en `AnthropicIntegrationError` (no aplica aún — sin Claude), Zod como fuente autoritativa (no aplica aún — sin validación de input)
- `aidlc/spaces/default/memory/project.md` — reglas duras
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — catálogo de unidades
- `tareas/WS-T01-scaffold-monorepo.md` — tarea previa (monorepo scaffold, el contexto donde esto encaja)
- `apps/backend/package.json` (worktree) — ya existe con nombre `backend`, scripts a extender

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del worktree
`/Users/aureliano/Desktop/wt-WS-T02`.

- [ ] **CA-1** — `apps/backend/package.json` tiene scripts `dev`, `build`, `start`, `test` y Express como dependencia
  ```bash
  node -e 'const p=require("./apps/backend/package.json");for(const s of ["dev","build","start","test"]){if(!p.scripts||!p.scripts[s])throw new Error("missing script: "+s);}if(!(p.dependencies?.express))throw new Error("express not in dependencies");console.log("ok")'
  ```
  Esperado: imprime `ok`, exit 0.

- [ ] **CA-2** — TypeScript compila cleanly en `apps/backend`
  ```bash
  npm run build -w apps/backend 2>&1 | tail -3
  ```
  Esperado: exit 0, sin errores `TS....`. El `dist/` resultante existe.

- [ ] **CA-3** — El servidor arranca en un puerto configurable y responde al `/health` con la lectura de vuelta por `curl` (herramienta real, no exit code del programa)
  ```bash
  rm -f /tmp/health.json /tmp/server.log
  (cd apps/backend && PORT=3100 npm run start > /tmp/server.log 2>&1 &) ; sleep 2
  curl -sf http://localhost:3100/health -o /tmp/health.json
  pkill -f "node.*backend" 2>/dev/null; sleep 1
  test -s /tmp/health.json && cat /tmp/health.json
  ```
  Esperado: `/tmp/health.json` existe, no vacío, `curl` devuelve HTTP 200 (`-f` falla si no), y el contenido es JSON válido.

- [ ] **CA-4** — La respuesta de `/health` cumple la convención `{ data, error, status }` de team.md
  ```bash
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/health.json","utf8"));for(const k of ["data","error","status"]){if(!(k in r))throw new Error("missing key: "+k);}if(r.error!==null)throw new Error("error should be null on success");if(r.status!==200)throw new Error("status should be 200");if(!(r.data&&r.data.status==="ok"))throw new Error("data.status should be \"ok\"");console.log("ok")'
  ```
  Esperado: imprime `ok`, exit 0.

- [ ] **CA-5** — Suite Jest con ≥1 test que cubre `/health` vía supertest (no solo verifica el exit code del server)
  ```bash
  npm test -w apps/backend 2>&1 | tail -10
  ```
  Esperado: `Tests: N passed`, al menos 1 test, 0 fallidos, 0 skipped. **Un test skipped es un hallazgo ROJO per contrato del revisor.**

- [ ] **CA-6** — Cobertura ≥80% líneas en `apps/backend`
  ```bash
  npm test -w apps/backend -- --coverage --coverageReporters=text --coverageReporters=json-summary 2>&1 | tail -20
  cat apps/backend/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d).total;if(s.lines.pct<80)throw new Error("line coverage "+s.lines.pct+"% < 80%");console.log("lines:",s.lines.pct+"%")})'
  ```
  Esperado: `lines: NN%` ≥ 80.

- [ ] **CA-7** — `npm run lint` desde la raíz sigue pasando (no se rompió lo de WS-T01)
  ```bash
  npm run lint 2>&1 | tail -5
  ```
  Esperado: exit 0, `turbo` reporta `successful` en los packages.

- [ ] **CA-8** — Rama `tarea/WS-T02` sobre `tarea/WS-T01` (lectura de vuelta con la herramienta real)
  ```bash
  git rev-parse --abbrev-ref HEAD && git log --oneline tarea/WS-T01..HEAD | head -5
  ```
  Esperado: rama actual `tarea/WS-T02`, al menos un commit sobre `tarea/WS-T01`.

- [ ] **CA-9** — No hay procesos de node colgados del test en la máquina al final
  ```bash
  pgrep -f "node.*backend" 2>&1; test -z "$(pgrep -f 'node.*backend')" && echo "no leftover processes"
  ```
  Esperado: imprime `no leftover processes`. Si el server del CA-3 queda corriendo, el revisor mata manualmente antes de dar VERDE — el codificador debe hacer su propio cleanup.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- `apps/backend/src/__tests__/health.test.ts` (o equivalente) — test con supertest que:
  - GET `/health` → 200
  - Body: `{data: {status: "ok"}, error: null, status: 200}`
  - El Content-Type header es `application/json`
- Al menos **una prueba negativa**: GET `/unknown-route` → 404 (handler de fallback). Si no existe handler de fallback, agregarlo; es parte de la higiene del endpoint.

**Rojo primero:** antes de montar la ruta, el codificador escribe el test, lo corre, lo ve fallar (el server no existe), lo registra en la bitácora. Luego implementa. Luego vuelve a correr el test y lo ve pasar. El par falla-pasa es la prueba.

---

## Notas

- **Archivos que se modifican en su sitio:** `apps/backend/package.json` (extender scripts y deps), `apps/backend/src/index.ts` (reemplazar el placeholder de WS-T01). Nada de `apps/backend/src/index_nuevo.ts`.
- **Estructura propuesta** (el codificador puede optar por otra si cumple los CAs):
  - `apps/backend/src/server.ts` — crea la app Express y la retorna (para tests con supertest)
  - `apps/backend/src/index.ts` — llama a `server()` y escucha en `PORT`
  - `apps/backend/src/handlers/health.ts` — el handler de `/health`
  - `apps/backend/src/__tests__/health.test.ts` — tests con supertest
- **Convención `{data, error, status}` es obligatoria** para toda respuesta HTTP del backend por team.md.
- **tsconfig**: si `apps/backend` no tiene `tsconfig.json`, créalo extendiendo del root (o standalone con `target: ES2022`, `module: commonjs`, `outDir: dist`, `strict: true`). Asegúrate de que `tsc` no entra a `node_modules/`.
- **Jest con ts-jest**: configurar en `apps/backend/jest.config.js` o en `package.json`. Asegúrate de que `--coverage` toma solo `src/**/*.ts` (no cuenta el placeholder de `shared-types`).
- **Nada de kubectl, helm, docker, push ni merge.**
- **PID cleanup**: el codificador es responsable de que no queden procesos `node` suyos al terminar.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/WS-T02`. Worktree destino: `../wt-WS-T02`. Base: `tarea/WS-T01`._
