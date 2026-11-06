# WS-T01 — Scaffold del monorepo Turborepo (base del Walking Skeleton)

> **Primera tarea del Walking Skeleton (Bolt 1).** Monta la base del monorepo sobre la que
> se desplegarán el backend, el frontend y los tipos compartidos. No incluye código de
> aplicación: solo el andamio y el pre-commit.

**Unidad:** Bolt 1 — Walking Skeleton (atraviesa u0-frontend + u8-authentication en próximas tareas)
**Historias que implementa:** ninguna todavía — habilita a US-1 y US-11
**Depende de:** ninguna

---

## Alcance

**Dentro** (una línea, concreta):

> Monorepo Turborepo con `apps/backend` y `packages/shared-types` vacíos pero instalables, Prettier + ESLint TypeScript + husky + lint-staged configurados para correr pre-commit sobre archivos modificados.

**Fuera** (rechazar aunque se vea roto):

- Código de aplicación (endpoint HTTP, lógica, modelos) — eso va en WS-T02 y siguientes
- Dockerfile y manifiestos Kubernetes — WS-T05
- Stub de la API de Claude — WS-T03
- Dependencia de Zod, Jest, Prisma o cualquier runtime de backend — se añaden cuando haya qué probar
- Scaffolding de `apps/frontend` (React) — es otra tarea, no bloquea al backend
- Configuración de GitHub Actions / CI — se hace cuando exista la primera suite de tests
- Renombrar archivos existentes del tree o tocar `aidlc/`, `.claude/`, `.aidlc-rule-details/`

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/memory/team.md` — reglas afirmadas: Turborepo, trunk-based, Prettier, ESLint TS, husky + lint-staged pre-commit, naming (`camelCase`, `PascalCase`, `kebab-case`), monorepo con `packages/shared-types` como fuente autoritativa
- `aidlc/spaces/default/memory/project.md` — reglas duras: nunca secretos en repo, nunca `latest` en imágenes Docker, `.env` en `.gitignore`, no duplicar tipos entre servicios
- `aidlc/spaces/default/intents/260925-feature/inception/units-generation/unit-of-work.md` — catálogo de unidades que van a vivir en el monorepo (u0-u13)
- `tareas/_plantilla.md` — formato de este archivo
- `.gitignore` — el existente ya excluye `aidlc/.aidlc-sessions/` y otros; añadir `node_modules/`, `dist/`, `.turbo/`, `*.log`

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del worktree.

- [ ] **CA-1** — `package.json` en la raíz con workspaces `apps/*` y `packages/*`, `name` igual a `proyecto` (o kebab del producto), `private: true`
  ```bash
  node -e 'const p=require("./package.json");const ws=p.workspaces||[];if(!p.private)throw new Error("no private");if(!ws.includes("apps/*"))throw new Error("missing apps/* workspace");if(!ws.includes("packages/*"))throw new Error("missing packages/* workspace");console.log("ok")'
  ```
  Esperado: imprime `ok`, exit 0.

- [ ] **CA-2** — `turbo.json` en la raíz con tasks `lint`, `build`, `test` declarados
  ```bash
  node -e 'const t=require("./turbo.json");const tasks=t.tasks||t.pipeline||{};for(const k of ["lint","build","test"]){if(!(k in tasks))throw new Error("missing task: "+k);}console.log("ok")'
  ```
  Esperado: imprime `ok`, exit 0.

- [ ] **CA-3** — `apps/backend/package.json` y `packages/shared-types/package.json` existen como workspaces (con `name` distinto cada uno)
  ```bash
  node -e 'const b=require("./apps/backend/package.json");const s=require("./packages/shared-types/package.json");if(!b.name||!s.name||b.name===s.name)throw new Error("workspace names missing or duplicated");console.log(b.name,s.name)'
  ```
  Esperado: imprime los dos nombres, exit 0.

- [ ] **CA-4** — Instalación limpia funciona
  ```bash
  rm -rf node_modules apps/*/node_modules packages/*/node_modules && npm install --loglevel=error 2>&1 | tail -5
  ```
  Esperado: termina sin error, exit 0, no imprime `ERR!` ni warnings críticos.

- [ ] **CA-5** — Prettier configurado (`.prettierrc` en la raíz) y `npm run format:check` pasa sobre el tree actual
  ```bash
  test -f .prettierrc && npm run format:check 2>&1 | tail -3
  ```
  Esperado: exit 0. Script `format:check` en `package.json` raíz debe ejecutar `prettier --check .` (o equivalente turbo).

- [ ] **CA-6** — ESLint configurado con `@typescript-eslint/parser` y `npm run lint` pasa sobre el tree actual
  ```bash
  npm run lint 2>&1 | tail -5
  ```
  Esperado: exit 0. Config puede ser `.eslintrc.json`, `.eslintrc.cjs` o `eslint.config.js`; debe incluir `@typescript-eslint` como parser.

- [ ] **CA-7** — husky instalado y hook pre-commit presente que invoca lint-staged
  ```bash
  test -x .husky/pre-commit && grep -q 'lint-staged\|npx.*lint-staged' .husky/pre-commit && node -e 'const p=require("./package.json");if(!p["lint-staged"])throw new Error("no lint-staged config in package.json");console.log(Object.keys(p["lint-staged"]).length,"globs")'
  ```
  Esperado: hook existe, es ejecutable, contiene referencia a `lint-staged`, y `package.json` tiene sección `lint-staged` con al menos 1 glob.

- [ ] **CA-8** — `.gitignore` excluye `node_modules/`, `dist/`, `.turbo/` y cualquier `.env*` (menos ejemplos)
  ```bash
  for p in node_modules dist .turbo .env; do grep -qE "(^|/)$p(/|$)" .gitignore || { echo "missing in .gitignore: $p"; exit 1; }; done && echo "ok"
  ```
  Esperado: imprime `ok`, exit 0.

- [ ] **CA-9** — Rama `tarea/WS-T01` construida sobre `main` (reproducible — lectura de vuelta con herramienta real)
  ```bash
  git -C . rev-parse --abbrev-ref HEAD && git -C . log --oneline main..HEAD | head -10
  ```
  Esperado: rama actual es `tarea/WS-T01`, hay al menos un commit sobre `main`.

---

## Plan de pruebas

**No hay tests de aplicación en esta tarea** (no hay código de aplicación). Las pruebas son los
criterios de aceptación ejecutados arriba.

**Rojo primero (la forma que aplica aquí):** el codificador corre primero `npm run lint` en un
tree sin configurar y registra el fallo (no existe, o config vacía). Después configura. Después
corre el mismo comando y registra que pasa. El par falla-pasa queda en la bitácora.

Jest y la suite de unit tests entran en WS-T02 cuando exista el primer endpoint con qué probar.

---

## Notas

- **Archivos que se modifican en su sitio:** `.gitignore` existente (agregar líneas al final, no reescribir), el repo raíz. Nada de `package_v2.json` ni duplicados con sufijo.
- **Versiones fijas:** usar rangos `^` para dependencias de desarrollo (prettier, eslint, husky, lint-staged, turbo) está bien; evitar `latest`. No importan versiones concretas aún: no hay app todavía.
- **Node:** asumir Node 20 LTS. Si el codificador quiere pinnear con `engines` en `package.json`, perfecto; no es un criterio obligatorio.
- **Sin cambios en `aidlc/`, `.claude/`, `.aidlc-rule-details/`, `entradas/`, `gen_*.py`:** son del AI-DLC y del curso, fuera del alcance del monorepo de aplicación.
- **No ejecutar scripts contra clústeres:** nada de `kubectl`, `helm` o Docker aquí. Solo `npm`/`node` locales.
- **Commits:** mantener la rama limpia. Un commit atómico está bien; varios pequeños también. El revisor no juzga el estilo de commit, solo el resultado.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/WS-T01`. Worktree destino: `../wt-WS-T01`._
