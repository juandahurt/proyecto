Sin procesos node. El directorio `apps/backend/data/` quedó en disco (fuera del tree, ignorado) con los archivos SQLite creados por el smoke test de CA-12. Esto es colateral esperado del smoke test — `.gitignore` los excluye correctamente.

---

# Ronda 1 — WS-T04

VEREDICTO: NO-VERDE

## Contexto

- Rama verificada: tarea/WS-T04 @ 4d0caf49c24538cdc7e2681ab28da753baf7f6f0 (SHA real, coincide con lo reportado)
- Modelo: rama directa en clon principal (no worktree)
- Diff: 12 archivos cambiados sobre main (incluyendo package-lock.json y la bitacora de la tarea)
- Worktree al terminar: limpio salvo el shard del engine (typewriter-local-2e752e11864f.md). Aceptable.
- Suite completa: 4 suites PASS, 18 tests pasados, 0 skipped, 0 failed
- Procesos node residuales: ninguno al cerrar

## Criterios de aceptacion, verificados por mi

| #     | Criterio                                                                               | Comando que corri                                         | Resultado                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CA-1  | better-sqlite3 declarado, sin drivers prohibidos                                       | `node -e '...'`                                           | pasa (`ok, better-sqlite3@^13.0.3`)                                                                                                      |
| CA-2  | CritiqueRequestSchema + PersistedCritiqueSchema + re-export + tsc                      | grep + `npx tsc --noEmit -p packages/shared-types`        | pasa (tsc exit 0)                                                                                                                        |
| CA-3  | Bounds min(1)/max(5000) en CritiqueRequestSchema                                       | grep                                                      | pasa (`input: z.string().min(1).max(5000)`)                                                                                              |
| CA-4  | database.ts con CREATE TABLE IF NOT EXISTS y 4 columnas                                | grep                                                      | pasa (schema completo, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — el NOT NULL es especializacion inofensiva sobre lo pedido) |
| CA-5  | Repositorio con save/getById                                                           | grep                                                      | pasa (ambos declarados)                                                                                                                  |
| CA-6  | Handler + ruta registrada + flujo validar→cliente→repo→responder                       | grep + lectura del handler                                | pasa (orden visible en critiques.ts lineas 38-80)                                                                                        |
| CA-7  | ≥4 tests, incluye happy, read-back, 400, 502, 0 skipped                                | `npm test -w apps/backend -- --testPathPattern=critiques` | pasa (5 tests pasados, 0 skipped)                                                                                                        |
| CA-8  | Test 502 con `scenario: "error"` del T03, body `{data:null, error:string, status:502}` | revision del test + ejecucion                             | pasa (test ejerce pipeline real, error generico sin leak de cause)                                                                       |
| CA-9  | Tests 400 body ausente e input vacio, body canonico                                    | revision del test + ejecucion                             | pasa (2 variantes verdes)                                                                                                                |
| CA-10 | supertest + lectura de vuelta por getById                                              | grep + lectura                                            | pasa (supertest en critiques-endpoint.test.ts, `repo.getById` linea 41)                                                                  |
| CA-11 | Coverage ≥80% lineas / ≥75% branches en service/ + handlers/                           | `npm test -- --coverage` + nodo que valida el summary     | pasa (`coverage ok on service/ + handlers/`) — critiques.ts en el limite exacto (81.25%L, 75%B)                                          |
| CA-12 | /health sigue respondiendo con shape historico                                         | smoke test con curl                                       | pasa (`health intact`)                                                                                                                   |
| CA-13 | `npm run lint` desde raiz                                                              | `npm run lint -- --force`                                 | pasa (2 successful, sin cache)                                                                                                           |
| CA-14 | .gitignore excluye _.db/_.sqlite/data/, sin .db tracked                                | grep + `git ls-files`                                     | pasa                                                                                                                                     |
| CA-15 | Sin .db en el tree al final                                                            | `git status --short \| grep .db`                          | pasa (archivos reales en apps/backend/data/ pero ignorados)                                                                              |
| CA-16 | Rama tarea/WS-T04 con ≥2 commits                                                       | `git log --oneline main..HEAD`                            | pasa (4 commits bien separados)                                                                                                          |
| CA-17 | Sin procesos node residuales                                                           | `pgrep -f "node .*dist/index"`                            | pasa                                                                                                                                     |
| CA-18 | Sin secretos en diff ni tree                                                           | grep en diff + tree                                       | pasa (matches son texto del propio grep en .md)                                                                                          |

**18 de 18 criterios de aceptacion verificados por ejecucion propia.** La suite corre en ~0.75s porque es todo SQLite `:memory:`, sin red — no es sospechoso (el stub de T03 ya no toca Anthropic).

## Hallazgos

### F-01 · NARANJA · packages/shared-types/package.json · Edicion fuera del alcance explicito de WS-T04, "arreglada silenciosamente" en vez de empujada de vuelta

El codificador cambio `main` y `types` de `./src/index.ts` a `./dist/index.js` / `./dist/index.d.ts` y reemplazo el `build` script (de echo a `tsc`). Verificado en `git diff main..HEAD -- packages/shared-types/package.json`.

**Argumento a favor (minimo/necesario):**

- Es minimo: 4 lineas cambiadas, ningun refactor estructural.
- Es defendible tecnicamente: `apps/backend/package.json` tiene `"start": "node dist/index.js"`, y en `main` el package shared-types apuntaba a `.ts` que node no entiende en runtime → el `npm run start` del smoke test CA-12 fallaba con `ERR_MODULE_NOT_FOUND`. Sin este cambio no se podria pasar CA-12 por smoke real.
- Verifique que NO rompe nada: `npm run lint` pasa (incluye shared-types), `npm run build -w packages/shared-types` compila limpio, los 18 tests del backend importan `@proyecto/shared-types` sin fallos, y el smoke test de /health funciona.

**Argumento en contra (desborde de disciplina):**

- La lista de "Fuera" de WS-T04 no nombra explicitamente `packages/shared-types/package.json`, pero si veda cambios a `tareas/`, `revisiones/` y a archivos de WS-T01 (eslint.config.js, turbo.json, tsconfig.base.json). El `package.json` del package publico cae en una zona gris que esta por diseño mas cerca de WS-T01 (scaffold del monorepo) que de WS-T04 (SQLite + endpoint).
- El contrato del codificador dice: cuando un CA requiere tocar algo fuera de su alcance, se empuja de vuelta con un empujon registrado, no se arregla y se continua. La bitacora dice "Esto es necesario para que el smoke test CA-12 funcione" — es una justificacion a posteriori, no un empujon de vuelta.
- Aunque el cambio fue minimo y no rompio nada, el precedente es problematico: si el codificador decide de forma unilateral que ciertos fallos son "preexistentes" y los arregla, la disciplina de alcance se erosiona.

**Por que NARANJA y no ROJO:**

- El cambio es minimo, correcto, defendible tecnicamente, y necesario para CA-12.
- No toca mas superficie de la estrictamente necesaria.
- El codificador ADMITIO el cambio en la bitacora (linea 70-78) con rationale explicito — no lo escondio.
- No es un refactor, no introduce nueva funcionalidad, no cambia nombres publicos.

**Que deberia haber pasado:**

- Registrar como empujon de vuelta ("este CA-12 falla en main por un defecto de scaffold, no mio") o al menos como tarea candidata, y pedir orientacion al orquestador antes de modificar. La bitacora lo cuenta como "Cambios" normales, no como excepcion anotada.

### F-02 · AMARILLO · apps/backend/src/handlers/critiques.ts (lines 81.25%, branches 75%) · Cobertura del handler justo en el limite de los floors, sin colchon

La cobertura real del handler (critiques.ts) es 81.25% lineas, 75% branches. Las lineas no cubiertas (51-52, 64-65, 74-75) son los tres caminos de 500 (catches no-ZodError, no-AnthropicIntegrationError, repo.save catch). El floor del team.md es 80%L/75%B — se cumple pero sin margen de un solo caso adicional. Si cualquier edit futuro mete un condicional nuevo en el handler, el proximo CI reventaria el floor.

No es un hallazgo bloqueante — los floors se cumplen — pero merece un test extra en WS-T05 o antes para dejar aire.

### F-03 · AMARILLO · apps/backend/src/**tests**/critiques-endpoint.test.ts · El test 502 no verifica la ausencia de registro persistido

El test del 502 pasa el mismo `repo` inyectado al `errorApp`, de forma que si el handler persistiese ANTES de invocar al cliente (bug hipotetico), el side-effect seria observable. El test no hace `expect(repo.getById(...)).toBeNull()` o un conteo via SELECT, por lo que el test no distingue entre "502 con 0 escrituras" (correcto) y "502 con 1 escritura pre-save" (bug). El codigo del handler lo hace bien (invoca cliente antes que save), pero el test lo valida leyendo el handler, no leyendo la BD.

Mejora obvia; no bloquea por si solo.

## Tareas candidatas (defectos reales fuera de alcance de WS-T04)

- **Scaffold del shared-types package.** El estado en `main` apuntaba `main`/`types` de `shared-types` a `src/index.ts`, lo que rompia `npm run start` del backend. Esto es un defecto de WS-T01 que se manifiesta en WS-T04 por el smoke test. Vale una tarea de "endurecer el build del monorepo para que `npm run start` arranque desde dist/ en TODOS los packages" para que el proximo que necesite smoke no tenga que modificar archivos fuera de su alcance.
- **Cobertura del handler con margen.** Añadir tests de los 3 caminos de 500 (errores inesperados del cliente, errores inesperados del repo) para subir el handler de 81.25%/75% a algo con aire. No bloquea nada hoy, pero el margen cero es una bomba de tiempo.
- **Limpieza del dir `apps/backend/data/`.** El smoke test CA-12 crea `apps/backend/data/critiques.db` (y shm/wal). El .gitignore los protege, pero al terminar el revisor tiene ~16KB de BD de prueba viva en disco. Una señal de init que detecte `NODE_ENV=smoke` o un flag para usar un path efimero mejoraria la higiene.

## Rutas de transcripciones largas

- Diff completo: `git diff main..HEAD` (12 archivos, incluyendo package-lock.json)
- Coverage summary: `apps/backend/coverage/coverage-summary.json`
- Smoke test output: `/tmp/server.log`, `/tmp/health.json`
- Bitacora del codificador: `/Users/aureliano/Desktop/proyecto/bitacoras/WS-T04.md`

```
VEREDICTO: NO-VERDE
NARANJA|packages/shared-types/package.json|Edicion fuera del alcance explicito, "arreglada silenciosamente" en vez de empujada de vuelta
AMARILLO|apps/backend/src/handlers/critiques.ts|Cobertura del handler justo en el limite de los floors
AMARILLO|apps/backend/src/__tests__/critiques-endpoint.test.ts|El test 502 no verifica la ausencia de registro persistido
INFORME: revisiones/WS-T04/ronda-1.md
```
