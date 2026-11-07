# WS-T03 — Stub del cliente de la API de Anthropic en `apps/backend`

> **Tercera tarea del Walking Skeleton (Bolt 1).** Monta el módulo cliente de la API
> de Anthropic con **una respuesta stub estática** y el schema Zod que esa respuesta
> cumple. Es el eslabón que valida que el proyecto tiene un lugar definido y tipado
> para la futura llamada real, con el envoltorio de error que exige el equipo, y sin
> tocar la red todavía.

**Unidad:** Bolt 1 — Walking Skeleton (preparando u2-ai-critique)
**Historias que implementa:** ninguna todavía — habilita la hipótesis del skeleton (capa 3 de 4)
**Depende de:** WS-T01 (monorepo scaffolding), WS-T02 (backend arrancable)

---

## Alcance

**Dentro** (una línea, concreta):

> Módulo `AnthropicClient` en `apps/backend/src/service/` con método `critique(input)` que devuelve una respuesta stub estática validada contra un schema Zod publicado en `packages/shared-types`, más el tipo de error `AnthropicIntegrationError` y pruebas Jest (unidad + contrato de schema) que fijan ambos caminos.

**Fuera** (rechazar aunque se vea roto):

- Llamada real a `api.anthropic.com` — se habilita cuando entre u2-ai-critique
- Endpoint HTTP que consuma el cliente (p. ej. `POST /critique`) — WS-T04 u otra tarea
- Persistencia en base de datos — WS-T04
- Autenticación, JWT, bcrypt — u8-authentication
- Validación de input del usuario (multipart, imágenes) — u1-image-upload
- Reintentos, backoff, timeouts, circuit breaker — se suman cuando haya red real
- Rate limiting, control de cuotas — producción, no skeleton
- Logger estructurado (pino, winston) — se añade cuando haya más de dos módulos de servicio
- Cambios a `apps/backend/src/handlers/health.ts`, `server.ts`, `index.ts` ni al jest.config, salvo lo mínimo para que Jest encuentre los nuevos tests y que `coverageThreshold` cubra también `src/service/`
- Cambios a archivos de WS-T01 (`eslint.config.js`, `turbo.json`, `tsconfig.base.json`) ni a `tareas/` ni a `revisiones/`
- Instalar librerías HTTP (`axios`, `node-fetch`, `undici`, `@anthropic-ai/sdk`) — el stub no toca la red

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/memory/team.md` — reglas afirmadas: respuestas HTTP `{ data, error, status }`, errores de Anthropic envueltos en `AnthropicIntegrationError`, Zod como **fuente autoritativa** de schemas de runtime con tipos derivados por `z.infer<>`, Jest + ts-jest, coverage ≥80% líneas global, ≥75% branches en `service/` y `handlers/`
- `aidlc/spaces/default/memory/project.md` — reglas duras: NEVER incluir la clave de API en el código ni en archivos commiteados; ALWAYS almacenar la clave como `Secret` de Kubernetes
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — catálogo de unidades (u2-ai-critique es la unidad futura que consumirá este cliente)
- `tareas/WS-T01-scaffold-monorepo.md` — contexto del scaffold del monorepo
- `tareas/WS-T02-endpoint-http-health.md` — contexto del backend arrancable
- `packages/shared-types/src/index.ts` — placeholder actual del package; esta tarea lo reemplaza con el primer schema real
- `packages/shared-types/package.json` — package a extender con `zod` como dependencia y a exportar el schema
- `apps/backend/jest.config.js` — a extender para incluir `src/service/` en coverage thresholds
- `apps/backend/package.json` — a extender con la dependencia workspace de `@proyecto/shared-types` si aún no está, y con `zod` (vía workspace de shared-types o directa, se decide en implementación)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/WS-T03` checada.

- [ ] **CA-1** — El package `@proyecto/shared-types` exporta un schema Zod `CritiqueResponseSchema` y el tipo derivado `CritiqueResponse` (vía `z.infer<typeof CritiqueResponseSchema>`)

  ```bash
  node -e 'const m=require("./packages/shared-types/src/index.ts");' 2>&1 || true
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -5
  grep -E "(CritiqueResponseSchema|CritiqueResponse)" packages/shared-types/src/anthropic.ts 2>&1 | head -10
  ```

  Esperado: el archivo `packages/shared-types/src/anthropic.ts` existe, define y exporta `CritiqueResponseSchema` (schema Zod) y `CritiqueResponse` (tipo). `tsc --noEmit` del package no reporta errores.

- [ ] **CA-2** — `packages/shared-types/src/index.ts` re-exporta el schema y el tipo (no son privados del archivo `anthropic.ts`)

  ```bash
  grep -E "export .* from .*anthropic" packages/shared-types/src/index.ts
  ```

  Esperado: al menos una línea `export * from './anthropic'` (o re-export nominal equivalente de `CritiqueResponseSchema` y `CritiqueResponse`).

- [ ] **CA-3** — El schema fija los campos mínimos necesarios para el skeleton: `summary` (string no vacío) y `categories` (array no vacío de objetos con `name` string, `score` número 0–10, `comment` string)

  ```bash
  node -e 'const {z} = require("./node_modules/zod"); const {CritiqueResponseSchema} = require("./packages/shared-types/src/anthropic.ts");' 2>&1 || true
  # Verificación semántica se hace en el test de contrato (CA-7). Aquí se verifica solo que el archivo contiene las claves esperadas:
  node -e 'const s=require("fs").readFileSync("packages/shared-types/src/anthropic.ts","utf8"); for (const k of ["summary","categories","name","score","comment"]) { if (!s.includes(k)) throw new Error("schema missing key: "+k); } console.log("ok")'
  ```

  Esperado: imprime `ok`. (La validación semántica real la hace el test de contrato en CA-7.)

- [ ] **CA-4** — El cliente `AnthropicClient` existe en `apps/backend/src/service/anthropic-client.ts` y expone `critique(input: string): Promise<CritiqueResponse>`. **No importa ni usa `axios`, `node-fetch`, `undici`, `fetch` global, `https`, ni `@anthropic-ai/sdk`.**

  ```bash
  test -f apps/backend/src/service/anthropic-client.ts
  grep -E "class AnthropicClient" apps/backend/src/service/anthropic-client.ts
  grep -E "critique\s*\(" apps/backend/src/service/anthropic-client.ts
  # Verificación dura: el archivo no importa clientes HTTP ni el SDK oficial
  ! grep -E "require\(['\"](axios|node-fetch|undici|https|@anthropic-ai/sdk)['\"]\)|from\s+['\"](axios|node-fetch|undici|https|@anthropic-ai/sdk)['\"]|\\bfetch\\s*\\(" apps/backend/src/service/anthropic-client.ts
  ```

  Esperado: el archivo existe, define la clase y el método, y el último comando (negación) termina con exit 0, lo que significa que **no** se encontraron importaciones de red.

- [ ] **CA-5** — El tipo de error `AnthropicIntegrationError` existe en `apps/backend/src/service/anthropic-error.ts`, extiende `Error`, y expone propiedades `cause?: unknown` y `kind: string` (categoría de la falla, p. ej. `"stub-error" | "network" | "timeout" | "bad-response"`)

  ```bash
  test -f apps/backend/src/service/anthropic-error.ts
  grep -E "class AnthropicIntegrationError extends Error" apps/backend/src/service/anthropic-error.ts
  grep -E "(kind|cause)" apps/backend/src/service/anthropic-error.ts | head -5
  ```

  Esperado: archivo existe, clase extiende `Error`, propiedades `kind` y `cause` presentes.

- [ ] **CA-6** — Camino feliz: `critique("cualquier texto")` resuelve con una `CritiqueResponse` que valida el schema y que tiene `categories.length >= 1`

  ```bash
  npm test -w apps/backend -- --testPathPattern=anthropic-client 2>&1 | tail -15
  ```

  Esperado: Jest reporta al menos **3 tests passed**, 0 failed, 0 skipped. Uno de ellos cubre el camino feliz y asserta que la salida parsea con `CritiqueResponseSchema.parse(...)`.

- [ ] **CA-7** — Test de contrato: el schema Zod rechaza una respuesta malformada (la _clase_ de prueba que tiene que existir y pasar)

  ```bash
  npm test -w apps/backend -- --testPathPattern=anthropic-client 2>&1 | grep -E "(rechaza|rejects|invalid|contract)"
  ```

  Esperado: aparece al menos un test con `rechaza`, `rejects`, `invalid` o `contract` en su nombre, dentro del archivo del cliente.

- [ ] **CA-8** — Camino de error: cuando el cliente se construye con la opción `scenario: "error"` (o equivalente documentado en el código), `critique(...)` rechaza con una instancia de `AnthropicIntegrationError`, no con un `Error` genérico

  ```bash
  npm test -w apps/backend -- --testPathPattern=anthropic-client 2>&1 | grep -E "(AnthropicIntegrationError|error path|error scenario)"
  ```

  Esperado: aparece al menos un test con esos tokens en su nombre, y la suite completa termina en verde.

- [ ] **CA-9** — Cobertura: los módulos `apps/backend/src/service/*.ts` cubren ≥80% líneas y ≥75% branches (regla afirmada del equipo). El `jest.config.js` tiene threshold explícito para `./src/service/`, no solo para `./src/handlers/`.

  ```bash
  grep -E "src/service" apps/backend/jest.config.js
  npm test -w apps/backend -- --coverage --coverageReporters=text --coverageReporters=json-summary 2>&1 | tail -15
  cat apps/backend/coverage/coverage-summary.json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d);const keys=Object.keys(s).filter(k=>k.includes("/src/service/"));if(!keys.length)throw new Error("no service/ files in coverage summary");for(const k of keys){const f=s[k];if(f.lines.pct<80)throw new Error(k+" lines "+f.lines.pct+"% < 80%");if(f.branches.pct<75&&f.branches.total>0)throw new Error(k+" branches "+f.branches.pct+"% < 75%");}console.log("service coverage ok")})'
  ```

  Esperado: imprime `service coverage ok`. El threshold del jest.config incluye literal `src/service`.

- [ ] **CA-10** — `npm run lint` desde la raíz pasa (no se rompió lo de WS-T01/WS-T02)

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0, `turbo` reporta `successful` en los packages.

- [ ] **CA-11** — El workspace `packages/shared-types` compila limpio con `zod` como dependencia declarada (no vía dependencia transitiva de otro package)

  ```bash
  node -e 'const p=require("./packages/shared-types/package.json"); if(!(p.dependencies?.zod||p.peerDependencies?.zod))throw new Error("zod not declared in shared-types"); console.log("zod:",(p.dependencies?.zod||p.peerDependencies?.zod))'
  npx tsc --noEmit -p packages/shared-types 2>&1 | tail -3
  ```

  Esperado: imprime la versión de zod y `tsc` termina sin errores.

- [ ] **CA-12** — Rama `tarea/WS-T03` sobre `main` (lectura de vuelta con la herramienta real)

  ```bash
  git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD | head -5
  ```

  Esperado: rama actual `tarea/WS-T03`, al menos un commit sobre `main`.

- [ ] **CA-13** — No hay procesos de node colgados del test en la máquina al final

  ```bash
  pgrep -f "node.*backend" 2>&1; test -z "$(pgrep -f 'node.*backend')" && echo "no leftover processes"
  ```

  Esperado: imprime `no leftover processes`.

- [ ] **CA-14** — La clave `ANTHROPIC_API_KEY` (ni ninguna otra credencial) **no aparece** en ningún archivo del diff ni en ningún archivo tracked del repo
  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff or tree"
  ```
  Esperado: imprime `no secrets in diff or tree`. Referenciar `process.env.ANTHROPIC_API_KEY` es aceptable; hard-codear el valor no.

---

## Plan de pruebas

Qué pruebas se escriben **en esta tarea**:

- `apps/backend/src/__tests__/anthropic-client.test.ts` con al menos:
  - **Camino feliz**: nueva instancia por defecto (scenario `"success"` o equivalente), `await client.critique("foto cualquiera")` devuelve un objeto que pasa `CritiqueResponseSchema.parse(...)` y tiene `categories.length >= 1`. CA-6.
  - **Contrato del schema (rechaza)**: `CritiqueResponseSchema.safeParse({ summary: "", categories: [] })` devuelve `{ success: false }`; `.parse({ summary: 123 })` lanza `ZodError`. CA-7.
  - **Camino de error**: instancia con `scenario: "error"`, `critique(...)` rechaza; el rejection es `instanceof AnthropicIntegrationError` y su `kind` es `"stub-error"` (o el nombre que el codificador documente). CA-8.
  - Opcional: `AnthropicIntegrationError` preserva `cause` cuando se construye con una. Cubre branches del error.

**Rojo primero:** antes de escribir el cliente, el codificador escribe los tres tests (camino feliz + contrato + error), los corre, los ve fallar (módulos no existen aún), lo registra en la bitácora. Luego crea los archivos. Luego vuelve a correr y los ve pasar. El par falla-pasa es la prueba.

---

## Notas

- **Dónde vive el schema:** `packages/shared-types/src/anthropic.ts`. Ese package es la fuente autoritativa de contratos compartidos entre servicios (regla dura del proyecto). No dupliques el schema en `apps/backend/`. Importa de `@proyecto/shared-types`.
- **Dónde vive el stub:** `apps/backend/src/service/anthropic-client.ts`. Esto estrena la carpeta `src/service/`, que es la que `team.md` nombra para las reglas de coverage (≥75% branches). Ajustar `apps/backend/jest.config.js` para incluir `src/service/` en `coverageThreshold` **es parte de esta tarea**, no una tarea posterior.
- **Qué devuelve el stub:** una respuesta fija, por ejemplo:
  ```ts
  {
    summary: "Composición equilibrada con alto contraste.",
    categories: [
      { name: "composition", score: 8.5, comment: "Regla de tercios bien aplicada." },
      { name: "color",       score: 7.2, comment: "Paleta armónica y saturación coherente." },
      { name: "lighting",    score: 6.8, comment: "Luz principal clara, sombras un poco duras." }
    ]
  }
  ```
  El codificador puede ajustar los textos y los valores con tal de que validen el schema. La **forma** es lo que importa; es un contrato del Walking Skeleton para que el futuro reemplazo del stub por el cliente real no rompa a los consumidores.
- **Scenario para error:** el constructor del cliente acepta una opción como `new AnthropicClient({ scenario: "success" | "error" })`. Por defecto, `"success"`. En `"error"`, `critique` lanza `AnthropicIntegrationError` con `kind: "stub-error"`. Esto es solo para el test; cuando entre el cliente real, la misma superficie podrá inyectar un transporte real o un transporte de prueba.
- **Zod como dependencia:** `zod` se declara en `packages/shared-types/package.json` (es su schema) y el backend lo recibe por transitiva al importar el package. Verificable con `npm ls zod`.
- **Convención `{data, error, status}`** NO aplica aquí porque esta tarea no expone un endpoint HTTP. Aplica solo cuando el cliente se envuelva en un handler, en WS-T04 o posterior.
- **Credenciales:** la clave de Anthropic **no se usa, no se referencia, no se lee** en esta tarea. El stub no habla con la red. Única referencia tolerable es un comentario que diga que en el futuro se leerá `process.env.ANTHROPIC_API_KEY` (y aún así es mejor no escribirlo).
- **Nada de kubectl, helm, docker, push ni merge.**
- **PID cleanup:** no debería levantar servers, pero si por cualquier razón se lanza algo, el codificador se encarga de matarlo.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/WS-T03`. Base: `main`. Modelo de aislamiento: rama directa en el clon `/Users/aureliano/Desktop/proyecto` (no se usan worktrees; cada tarea empuja su rama a `origin` y se abre un PR en GitHub)._
