# WS-T03 — bitácora del codificador

## Acuse de lectura (ronda 1)

- hash de la tarea: `0a6f07b0a1a97a867be0be34139404ce5b8b7c12` — coincide con el esperado
- dentro de alcance: Módulo `AnthropicClient` en `apps/backend/src/service/` con método `critique(input)` que devuelve stub estático validado por schema Zod en `packages/shared-types`, tipo `AnthropicIntegrationError`, y tests Jest (happy path + contrato schema + camino error).
- fuera de alcance: llamada real a la red, endpoint HTTP `/critique`, persistencia BD, auth, validación de imágenes, reintentos, logger estructurado, cambios a handlers/health.ts, server.ts, index.ts (salvo mínimo para jest).

- criterios de aceptación: 14, comandos enumerados:
  1. CA-1: `npx tsc --noEmit -p packages/shared-types` + grep `CritiqueResponseSchema|CritiqueResponse` en anthropic.ts
  2. CA-2: `grep "export .* from .*anthropic" packages/shared-types/src/index.ts`
  3. CA-3: node one-liner que verifica claves `summary,categories,name,score,comment` en anthropic.ts
  4. CA-4: `test -f anthropic-client.ts` + grep clase/método + grep negativo de imports HTTP
  5. CA-5: `test -f anthropic-error.ts` + grep clase extiende Error + grep kind/cause
  6. CA-6: `npm test -w apps/backend -- --testPathPattern=anthropic-client` → 3 tests passed
  7. CA-7: grep `rechaza|rejects|invalid|contract` en salida del test
  8. CA-8: grep `AnthropicIntegrationError|error path|error scenario` en salida del test
  9. CA-9: grep `src/service` en jest.config.js + coverage ≥80% líneas / ≥75% branches
  10. CA-10: `npm run lint` desde raíz pasa
  11. CA-11: node one-liner zod declarado en shared-types/package.json + tsc --noEmit limpio
  12. CA-12: rama `tarea/WS-T03` con al menos un commit sobre main
  13. CA-13: sin procesos node colgados
  14. CA-14: sin secretos en diff ni en árbol tracked

## Ronda 1

### Plan de implementación

Estado inicial:

- `packages/shared-types/src/index.ts` es un placeholder vacío (export {})
- `packages/shared-types/package.json` sin zod
- `apps/backend/src/service/` no existe
- `apps/backend/jest.config.js` cubre handlers/ pero no service/
- zod no instalado en workspace

Pasos:

1. Instalar zod en packages/shared-types
2. Añadir @proyecto/shared-types como dependencia del backend
3. Escribir tests PRIMERO (rojo)
4. Crear archivos de implementación
5. Correr tests (verde)
6. Ampliar jest.config.js para service/
7. Verificar todos los CAs

### Rojo primero

Escritura de los tests antes de la implementación (los módulos no existen aún):

```
$ npm test -w apps/backend -- --testPathPattern=anthropic-client

FAIL src/__tests__/anthropic-client.test.ts
  ● Test suite failed to run

    src/__tests__/anthropic-client.test.ts:1:33 - error TS2307: Cannot find module '../service/anthropic-client'
    src/__tests__/anthropic-client.test.ts:2:43 - error TS2307: Cannot find module '../service/anthropic-error'
    src/__tests__/anthropic-client.test.ts:3:10 - error TS2305: Module '"@proyecto/shared-types"' has no exported member 'CritiqueResponseSchema'

Test Suites: 1 failed, 1 total
Tests:       0 total
```

ROJO confirmado: los tres módulos no existen. El test file fue escrito antes de cualquier implementación.

### Cambios de implementación

- `packages/shared-types/package.json`: añadido `zod ^4.6.7` como dependencia (fuente autoritativa del schema)
- `packages/shared-types/src/anthropic.ts`: nuevo — `CritiqueResponseSchema` (Zod) + `CritiqueResponse` (z.infer<>)
- `packages/shared-types/src/index.ts`: reemplazado placeholder con `export * from './anthropic'`
- `packages/shared-types/tsconfig.json`: nuevo — config TS para que `npx tsc --noEmit -p packages/shared-types` funcione
- `apps/backend/package.json`: añadido `@proyecto/shared-types ^0.0.1` en dependencies
- `apps/backend/src/service/anthropic-error.ts`: nuevo — `AnthropicIntegrationError extends Error` con `kind` y `cause`
- `apps/backend/src/service/anthropic-client.ts`: nuevo — `AnthropicClient` con `critique()` stub estático sin red
- `apps/backend/src/__tests__/anthropic-client.test.ts`: nuevo — 7 tests (happy path + contrato rechaza + error path)
- `apps/backend/jest.config.js`: añadido threshold `'./src/service/': { lines: 80, branches: 75 }`
- `package-lock.json`: actualizado con las nuevas dependencias

### Verde

```
$ npm test -w apps/backend -- --testPathPattern=anthropic-client

PASS src/__tests__/anthropic-client.test.ts
  AnthropicClient (stub)
    happy path — camino feliz
      ✓ critique() resuelve con CritiqueResponse que valida el schema (2 ms)
    contract — contrato del schema (rechaza respuestas malformadas)
      ✓ safeParse rejects when summary is empty string and categories is empty array
      ✓ parse throws ZodError when summary is a number instead of string — invalid input rejects schema (3 ms)
      ✓ safeParse rejects when category score is out of range 0-10 — contract validation
    error path — camino de error (AnthropicIntegrationError)
      ✓ critique() rejects with AnthropicIntegrationError when scenario is "error" (1 ms)
      ✓ error scenario produces AnthropicIntegrationError with kind "stub-error"
      ✓ AnthropicIntegrationError preserves cause when provided — error path branch (1 ms)

Tests: 7 passed, 7 total
```

### Cobertura total (src/service/)

```
 src/service          |     100 |      100 |     100 |     100 |
  anthropic-client.ts |     100 |      100 |     100 |     100 |
  anthropic-error.ts  |     100 |      100 |     100 |     100 |
service coverage ok
```

### Verificación CA-14 (sin secretos)

Los únicos matches del grep de secretos fueron en el propio archivo de la tarea (`tareas/WS-T03-stub-claude-client.md`) que contiene el comando CA-14 literalmente como documentación. No hay credenciales hardcodeadas en ningún archivo de implementación.

### Commit

SHA: 82fcfc2 — `WS-T03: stub AnthropicClient + CritiqueResponse Zod schema`

### Resumen de CAs

| CA    | Estado | Notas                                                                                                              |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| CA-1  | VERDE  | CritiqueResponseSchema y CritiqueResponse exportados, tsc limpio                                                   |
| CA-2  | VERDE  | `export * from './anthropic'` en index.ts                                                                          |
| CA-3  | VERDE  | Claves summary, categories, name, score, comment presentes                                                         |
| CA-4  | VERDE  | Clase AnthropicClient con critique(), sin imports HTTP                                                             |
| CA-5  | VERDE  | AnthropicIntegrationError extends Error, con kind y cause                                                          |
| CA-6  | VERDE  | 7 tests pasan, incluye happy path con parse()                                                                      |
| CA-7  | VERDE  | Tests con `rejects`, `contract`, `invalid` en nombre                                                               |
| CA-8  | VERDE  | Tests con `AnthropicIntegrationError`, `error path`, `error scenario`                                              |
| CA-9  | VERDE  | jest.config.js tiene src/service/, cobertura 100%                                                                  |
| CA-10 | VERDE  | npm run lint → 2 successful, 0 errores                                                                             |
| CA-11 | VERDE  | zod: ^4.6.7 declarado en shared-types, tsc sin errores                                                             |
| CA-12 | VERDE  | Rama tarea/WS-T03, 1 commit sobre main (82fcfc2)                                                                   |
| CA-13 | VERDE  | No hay procesos node colgados                                                                                      |
| CA-14 | VERDE  | Sin secretos en diff ni en árbol tracked (matches en archivo de tarea son el texto del comando, no valores reales) |
