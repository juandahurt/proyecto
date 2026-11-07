# Tareas candidatas

Trabajo real que salió del alcance de alguna tarea y que **no se hizo** en esa tarea. No se mete al diff en curso; vive aquí hasta que se convierta en su propia tarea o se descarte explícitamente.

## Abiertas

### C-01 — Shard de auditoría `typewriter-local-*` aparece como M persistente en el árbol

**Origen:** Revisor en `revisiones/WS-T02/ronda-1.md`, sección "Tareas candidatas". El árbol tiene `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-2e752e11864f.md` modificado antes y después de la ronda. No lo tocó ni el codificador (su diff contra `main` no lo incluye) ni el revisor (herramientas de solo lectura). Es un shard escrito por el engine de AI-DLC.

**Por qué es candidata y no hallazgo:** No es un defecto de WS-T02 ni de ningún código del producto. Es higiene del repo.

**Decisión pendiente del humano:** una de tres — (a) commitear el shard a `main` (política actual del framework), (b) descartar con `git checkout --`, (c) añadir patrón `**/audit/typewriter-local-*.md` al `.gitignore` del repo. El CLAUDE.md ya ignora otros archivos per-clone de AI-DLC bajo `.aidlc-sessions/`, pero los shards de auditoría se commitean por diseño.

### C-02 — Fortalecer el test del fallback 404 con lectura de vuelta del body

**Origen:** Observación O-03 del revisor en `revisiones/WS-T02/ronda-1.md`. El test de 404 verifica el status code pero no lee de vuelta el payload `{data:null,error:"Not Found",status:404}` que emite el fallback. CA-4 solo exige la convención para `/health`, así que no es incumplimiento, pero es exactamente la clase "código de salida como prueba" que el revisor flagea por contrato.

**Qué sería:** una tarea mínima que amplía el test de 404 para asertar el payload completo, no solo el `res.status`. Trivial; cabe en 15 minutos.

### C-03 — Extender el branches threshold cuando exista `src/service/`

**Origen:** Observación O-02 del revisor. `team.md` promete ≥75% branches en `service/` y `handlers/`, pero el `jest.config.js` actual solo aplica el threshold a `./src/handlers/`. En WS-T02 no existe `src/service/`, así que no hay violación hoy. Hay que extender el threshold cuando el primer servicio entre al backend (probablemente en WS-T03 o U02).

**Qué sería:** ajustar `coverageThreshold` en `apps/backend/jest.config.js` para cubrir también `./src/service/` cuando se introduzca ese módulo.

### C-04 — Reevaluar la exclusión de `src/index.ts` del coverage cuando contenga lógica

**Origen:** Observación O-01 del revisor. `src/index.ts` está en `coveragePathIgnorePatterns` porque hoy solo llama a `app.listen`. Si entra parseo de config, validación de env, o cualquier rama lógica, hay que volver a meterlo en el conteo.

**Qué sería:** una revisión del `collectCoverageFrom` en el momento en que `index.ts` deje de ser un entry point trivial.

### C-05 — Matar el `node dist/index.js` residual de WS-T02 en el entorno del codificador

**Origen:** Hallazgo F-01 del revisor en `revisiones/WS-T03/ronda-1.md`. En la máquina del codificador quedó corriendo `node dist/index.js` (PID 75454, cwd en `apps/backend`), residual del smoke test de WS-T02. El comando literal de CA-13 no lo captura porque la línea de comando no contiene el literal "backend", así que CA-13 pasa — pero el proceso existe. No es defecto de WS-T03; es higiene del ambiente.

**Qué sería:** `pkill -f "node dist/index.js"` o equivalente, y cerrar bien el server al final de cualquier smoke test futuro.

### C-06 — Afinar el `pgrep` de CA-X en futuras tareas para capturar binarios compilados

**Origen:** Observación del revisor en ronda 1 de WS-T03. El criterio de "sin procesos node colgados" usa `pgrep -f "node.*backend"`, que no matchea `node dist/index.js`. Un comando más robusto sería `pgrep -f "(node|ts-node).*(backend|apps/backend|dist)"`.

**Qué sería:** actualizar el CA-9 de WS-T02 (y análogos en tareas futuras) para cerrar el falso-negativo. Pequeña mejora del contrato de las tareas, no urgente.

### C-07 — Endurecer el scaffold de `packages/shared-types` para que `npm run start` arranque sin arreglos manuales

**Origen:** F-01 ronda 1 de WS-T04, arbitrado por el orquestador en `revisiones/WS-T04/arbitraje-ronda-1.md`. En `main` (estado postWS-T01), `packages/shared-types/package.json` apuntaba `main`/`types` a `./src/index.ts`, lo que rompe `npm run start` del backend desde que hay cualquier import del package. El codificador de WS-T04 lo corrigió en su diff (cambio mínimo: `main` → `./dist/index.js`, `types` → `./dist/index.d.ts`, `build` → `tsc`). El fix quedó aceptado por arbitraje, pero la raíz del problema es un defecto de WS-T01.

**Qué sería:** una tarea de "endurecer el build del monorepo" — revisar todos los packages workspace (`shared-types` hoy, más los que vengan) y afirmar la convención `main`/`types` apunta a `dist/`, con un CI gate que arranque `npm run start` en modo smoke para cualquier app que dependa de un workspace package. Convierte lo que pasó en una regla ejecutable, no un acuerdo.

### C-08 — Reforzar la disciplina del empujón de vuelta cuando un CA topa con un bloqueo preexistente

**Origen:** F-01 ronda 1 de WS-T04, aspecto de proceso. El codificador detectó que CA-12 fallaría por un defecto preexistente y, en vez de empujar de vuelta pidiendo autorización al orquestador, aplicó la corrección mínima y la registró en la bitácora. El cambio fue correcto, pero el procedimiento no.

**Qué sería:** añadir un preámbulo estándar al template de tarea (`tareas/_plantilla.md`) con la cláusula: _«Si un CA tope con un bloqueo preexistente que no pertenece al alcance de esta tarea, para y empuja de vuelta; no lo arregles por tu cuenta aunque te parezca obvio.»_ Y en los despachos del orquestador, un recordatorio explícito. Es un ajuste de proceso, no de código.

### C-09 — Añadir tests de camino 500 al handler `critiques` para subir el margen de cobertura

**Origen:** F-02 ronda 1 de WS-T04 (AMARILLO diferido por arbitraje). El handler `apps/backend/src/handlers/critiques.ts` cumple los floors del team.md (81.25% líneas / 75% branches) **exactamente en el límite**. Si un edit futuro mete un condicional, la próxima corrida de CI reventaría el floor. Las líneas no cubiertas son los 3 catches de 500 (no-ZodError, no-AnthropicIntegrationError, repo.save catch).

**Qué sería:** tres tests nuevos en `critiques-endpoint.test.ts` que inyecten clientes/repos de prueba que lanzan errores inesperados (no `AnthropicIntegrationError`, no `ZodError`) y verifiquen 500. Tarea chica, debería caber en 20 min.

### C-10 — Fortalecer el test 502 con aserción de ausencia de persistencia en BD

**Origen:** F-03 ronda 1 de WS-T04 (AMARILLO diferido por arbitraje). El test del 502 no lee de vuelta la BD para confirmar que el handler no persistió el registro antes de llamar al cliente. El código del handler lo hace bien, pero el test no lo demuestra; un refactor que invierta el orden pasaría el test actual.

**Qué sería:** una línea en el test del 502: `expect(repo.getById(1)).toBeNull()` (o un conteo via SELECT). Trivial, cabe en 5 min, cierra una clase entera de regresión futura.

---

## Cerradas

_Ninguna por ahora._
