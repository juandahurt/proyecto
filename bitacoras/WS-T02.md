# WS-T02 — bitacora del codificador

## Acuse de lectura (ronda 1)

- hash de la tarea: 5bc6cf90adb5263ce7952a2ae52f6f69f2bea49e — coincide
- dentro de alcance: servidor Express TypeScript en apps/backend con GET /health que devuelve {data,error,status}, arrancable, con suite Jest+supertest >=80% cobertura de lineas
- fuera de alcance: base de datos, stub Claude, POST /uploads, auth/JWT, Dockerfile/K8s, logger estructurado, CORS, env vars mas alla de PORT, cambios a archivos de WS-T01
- criterios de aceptacion: 9 en total

  - CA-1: node -e '...' — verifica scripts dev/build/start/test y express en dependencies
  - CA-2: npm run build -w apps/backend 2>&1 | tail -3 — compilacion TypeScript sin errores
  - CA-3: arranca servidor, curl -sf http://localhost:3100/health, cleanup proceso
  - CA-4: node -e '...' — verifica estructura {data,error,status} del JSON en /tmp/health.json
  - CA-5: npm test -w apps/backend 2>&1 | tail -10 — 1+ tests, 0 fallidos, 0 skipped
  - CA-6: npm test -w apps/backend -- --coverage ... — cobertura lineas >=80%
  - CA-7: npm run lint 2>&1 | tail -5 — lint sigue pasando en el monorepo
  - CA-8: git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD — rama y commit sobre main
  - CA-9: pgrep -f "node.*backend" — sin procesos colgados

## Ronda 1

### Rojo primero

Antes de implementar el handler, escribo el test, lo corro, y veo que falla porque el servidor no existe.

Primero, verifico el estado actual del package.json del backend (sin express, sin scripts dev/start/test, sin jest):

```
$ cat apps/backend/package.json
{
  "name": "backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "echo 'No build step yet'",
    "lint": "eslint .",
    "test": "echo 'No tests yet'"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

El test se escribira en apps/backend/src/**tests**/health.test.ts. Para poder correrse necesita jest/supertest/ts-jest, pero primero creo el archivo de test y lo intento ejecutar para registrar el fallo.

Proceso:

1. Escribi el test en apps/backend/src/**tests**/health.test.ts
2. Actualice package.json con dependencies (express) y devDependencies (jest/ts-jest/supertest/@types/*)
3. Instale dependencias (npm install)
4. Cree jest.config.js y tsconfig.json
5. Corri el test sin implementar el servidor:

```
$ npm test -w apps/backend 2>&1 | head -40
> backend@0.0.1 test
> jest

FAIL src/__tests__/health.test.ts
  - Test suite failed to run

    src/__tests__/health.test.ts:2:27 - error TS2307: Cannot find module '../server' or its corresponding type declarations.

    2 import { createApp } from '../server';
                                ~~~~~~~~~~~

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        0.768 s
```

ROJO CONFIRMADO: el test falla porque '../server' no existe. Ahora implemento.
