# WS-T04 — bitacora del codificador

## Acuse de lectura (ronda 1)

- hash de la tarea: b6c9414f922eee0567962aad3010572945daa788 — coincide
- dentro de alcance: SQLite con `better-sqlite3`, schema `critiques`, repositorio `save/getById`, endpoint `POST /critiques` con validacion Zod, mapeo de errores (400/502/500), suite Jest con supertest, cobertura >=80% lineas / >=75% branches en `service/` y `handlers/`
- fuera de alcance: BD en contenedor, ORM, autenticacion, multipart/upload, reintentos, rate limiting, logger estructurado, migraciones versionadas, Dockerfile/K8s, llamada real a Anthropic, cambios a `/health` ni sus tests, cambios a archivos de WS-T01

Criterios de aceptacion: 18 (CA-1 a CA-18), comandos enumerados:

- CA-1: `node -e 'const p=require(...)'` — verifica better-sqlite3 y ausencia de drivers bannidos
- CA-2: `grep` sobre shared-types + `tsc --noEmit` — schemas nuevos presentes y compilan
- CA-3: `grep` — cotas min(1)/max(5000) en CritiqueRequestSchema
- CA-4: `test -f` + `grep` — database.ts existe con CREATE TABLE IF NOT EXISTS
- CA-5: `test -f` + `grep` — critique-repository.ts con save/getById
- CA-6: `test -f` + `grep` — critiques.ts handler y ruta registrada en server.ts
- CA-7: `npm test -w apps/backend -- --testPathPattern=critiques` — >=4 tests pasados
- CA-8: mismo comando + `grep -E "(502|...)"` — test 502 visible y verde
- CA-9: mismo comando + `grep -E "(400|...)"` — test 400 visible y verde
- CA-10: `grep -E "supertest"` + `grep -E "(getById|SELECT)"` — supertest en test de critiques, lectura de vuelta
- CA-11: `npm test -w apps/backend -- --coverage` + script node — coverage ok on service/ + handlers/
- CA-12: smoke test curl `/health` con server levantado en PORT=3101 — health intact
- CA-13: `npm run lint` desde raiz — exit 0
- CA-14: `grep` en .gitignore + `git ls-files` — _.db/_.sqlite excluidos, ningun .db tracked
- CA-15: `git status --short | grep .db` — no db leftover in tree
- CA-16: `git log --oneline main..HEAD` — >=2 commits en rama
- CA-17: `pgrep -f "node .*dist/index"` — no leftover node processes
- CA-18: `git diff main..HEAD | xargs grep` — no secrets en diff ni tree

---

## Ronda 1

### Rojo primero

Escribo los dos archivos de test ANTES de implementar cualquier modulo. Los corro y verifico que fallan porque los modulos no existen.

#### Rojo — critique-repository.test.ts (modulos no existen)

```
$ npm test -w apps/backend -- --testPathPattern=critique-repository 2>&1 | tail -30
FAIL src/__tests__/critique-repository.test.ts
  Test suite failed to run
    Cannot find module '../service/database' or its corresponding type declarations.
    Cannot find module '../service/critique-repository' or its corresponding type declarations.
Test Suites: 1 failed, 1 total
Tests:       0 total
```

#### Rojo — critiques-endpoint.test.ts (modulos no existen, createApp firma incorrecta)

```
$ npm test -w apps/backend -- --testPathPattern=critiques-endpoint 2>&1 | tail -30
FAIL src/__tests__/critiques-endpoint.test.ts
  Test suite failed to run
    Cannot find module '../service/database'
    Cannot find module '../service/critique-repository'
    TS2554: Expected 0 arguments, but got 1.  (createApp sin parametros)
Test Suites: 1 failed, 1 total
Tests:       0 total
```

Rojo verificado. Procedo a implementar en el orden: shared-types → database → repository → handler → wire-up en server.ts.

### Cambios

- `.gitignore`: add *.db, *.sqlite, *.sqlite3, data/ — CA-14
- `apps/backend/package.json`: add better-sqlite3@^13.0.3 and @types/better-sqlite3 — CA-1
- `packages/shared-types/src/anthropic.ts`: add CritiqueRequestSchema (input min 1 max 5000), PersistedCritiqueSchema ({id, input, response, createdAt}) and derived types — CA-2, CA-3
- `packages/shared-types/package.json`: main/types ahora apuntan a dist/ para que `npm run start` funcione; build script real (tsc) — necesario para CA-12
- `apps/backend/src/service/database.ts`: createDatabase(dbPath?) con :memory: para tests — CA-4
- `apps/backend/src/service/critique-repository.ts`: CritiqueRepository con save/getById — CA-5
- `apps/backend/src/handlers/critiques.ts`: createCritiquesRouter(deps) con DI, error mapping 400/502/500 — CA-6, CA-7, CA-8, CA-9
- `apps/backend/src/server.ts`: signature actualizada a createApp(deps?) inyectando client y repo; monta /critiques — CA-6
- `apps/backend/src/__tests__/critique-repository.test.ts`: 3 tests en :memory: — CA-5, CA-10
- `apps/backend/src/__tests__/critiques-endpoint.test.ts`: 5 tests (200/400x2/502/schema) en :memory: — CA-7, CA-8, CA-9, CA-10

Nota sobre CA-12: El problema de `ERR_MODULE_NOT_FOUND` al ejecutar `npm run start` era preexistente a esta tarea (shared-types apuntaba a src/index.ts en lugar de dist/). Se corrigió actualizando packages/shared-types/package.json con main/types apuntando al dist compilado. Esto es necesario para que el smoke test CA-12 funcione.

Camino elegido para CA-7(b): lectura de vuelta vía `repo.getById(res.body.data.id)` en el mismo test (no se expone GET /critiques/:id en esta tarea).

### Verde

```
$ npm test -w apps/backend 2>&1 | tail -15
PASS src/__tests__/critique-repository.test.ts
PASS src/__tests__/critiques-endpoint.test.ts
PASS src/__tests__/anthropic-client.test.ts
PASS src/__tests__/health.test.ts

Test Suites: 4 passed, 4 total
Tests:       18 passed, 18 total
Snapshots:   0 total
Time:        1.607 s
```

```
$ cat apps/backend/coverage/coverage-summary.json | node -e '...'
coverage ok on service/ + handlers/
```

```
$ pgrep -f "node .*dist/index"; test -z "$(pgrep -f 'node .*dist/index')" && echo "no leftover node processes"
no leftover node processes
```

### Resultados por criterio

- CA-1: ok — `ok, better-sqlite3@^13.0.3`
- CA-2: ok — ambos schemas en anthropic.ts, re-export en index.ts, tsc exit 0
- CA-3: ok — `input: z.string().min(1).max(5000)` en anthropic.ts
- CA-4: ok — database.ts existe, CREATE TABLE IF NOT EXISTS critiques con 4 columnas
- CA-5: ok — critique-repository.ts con save() y getById()
- CA-6: ok — critiques.ts handler, router.post('/'), registrado en server.ts con app.use('/critiques', ...)
- CA-7: ok — 5 tests pasados (>= 4), cubre POST 200, lectura de vuelta, POST 400x2, POST 502
- CA-8: ok — test 502 con AnthropicClient scenario "error" visible y verde
- CA-9: ok — tests 400 (body ausente y input vacio) visibles y verdes
- CA-10: ok — supertest importado en critiques-endpoint.test.ts, getById en el mismo archivo
- CA-11: ok — `coverage ok on service/ + handlers/`
- CA-12: ok — `health intact`
- CA-13: ok — lint: `2 successful`
- CA-14: ok — _.db/_.sqlite/data/ en .gitignore, ningun .db tracked
- CA-15: ok — `no db leftover in tree`
- CA-16: ok — rama tarea/WS-T04 con 4 commits sobre main
- CA-17: ok — `no leftover node processes`
- CA-18: ok — matches son solo documentacion .md, cero secretos en codigo

### Candidatas detectadas

Ninguna fuera de alcance detectada.
