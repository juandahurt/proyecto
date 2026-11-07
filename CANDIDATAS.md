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

---

## Cerradas

_Ninguna por ahora._
