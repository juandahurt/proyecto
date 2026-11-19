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

### C-11 — Arreglar el patrón de grep para contar schemas Zod en la plantilla de tareas

**Origen:** F-01 ronda 1 de u8-T01 (AMARILLO). El comando literal del CA-2 fue `grep -E "(A|B|C|D)" ... | sort -u | wc -l` esperando 4, pero el patrón canónico Zod coloca cada nombre en 2 líneas (`export const XSchema = ...` y `export type X = z.infer<typeof XSchema>`), por lo que el conteo real es 8. La intención del CA (los 4 schemas presentes y re-exportados) se cumplió con holgura; el defecto está en la especificación del comando, no en el diff.

**Qué sería:** una enmienda a `tareas/_plantilla.md` (o una convención documentada en `.claude/orquestador.md`) con un patrón que ancle la declaración: `grep -cE "^export const (Register|Login|AuthResponse|JwtPayload)Schema"` o `grep -oE "^export const [A-Z]\w+Schema" | sort -u | wc -l`. Sirve de referencia para cuando el orquestador redacte CAs equivalentes en u1, u9, u11 (que también declaran schemas Zod con infer).

### C-12 — Cablear `JWT_TTL_SECONDS` del ConfigMap al servicio, o removerlo del ConfigMap

**Origen:** F-02 ronda 1 de u8-T01 (AMARILLO). El ConfigMap `k8s/identity/configmap.yaml` define `JWT_TTL_SECONDS: '604800'` y se monta via `envFrom`, pero `apps/identity-service/src/service/jwt.ts` usa la constante literal `TOKEN_TTL_SECONDS = 604800` y nunca lee `process.env.JWT_TTL_SECONDS`. El mismo valor aparece en 4 sitios (configmap, jwt.ts, handlers/auth.ts, schemas/auth.ts como `z.literal(604800)`). Cambiar el ConfigMap no cambia el comportamiento; hay que editar código.

**Qué sería:** una decisión binaria — o (a) quitar `JWT_TTL_SECONDS` del ConfigMap porque el TTL es una constante semántica del contrato (US-8 AC-8.2 exige exactamente 7 días; un ConfigMap editable sugiere falsamente que es configurable); o (b) cablearlo: `const TOKEN_TTL_SECONDS = parseInt(process.env.JWT_TTL_SECONDS ?? '604800', 10)` en jwt.ts + handlers/auth.ts, y quitar la `z.literal(604800)` del schema (relajar a `z.number().int().positive()`). Ambas son defendibles; la decisión depende de si el equipo quiere parametrizarlo a futuro.

### C-13 — Subir `prefer-const` a nivel `error` en la config ESLint compartida

**Origen:** F-03 ronda 1 de u8-T01 (AMARILLO). En `apps/identity-service/src/handlers/auth.ts:15` quedó `let dummyHash = '$2b$10$...'` sin reasignación. ESLint pasó sin flagearlo porque `prefer-const` no está a nivel `error` (o este archivo no está cubierto). No es defecto de u8-T01 pero es higiene preventiva que vale la pena generalizar.

**Qué sería:** editar `eslint.config.js` de la raíz para añadir `'prefer-const': 'error'` (o subirlo si ya existe como `warn`). Trivial, protege contra una clase entera de código con intenciones poco claras.

### C-14 — Simplificar la guarda duplicada de `JWT_SECRET` en `packages/auth-middleware/src/require-auth.ts`

**Origen:** Observación informativa 1 ronda 1 de u8-T02 (AMARILLO leve). El middleware verifica `!process.env.JWT_SECRET` en las líneas 45-47 ANTES de llamar a `verifyToken`, y `verifyToken` lo vuelve a verificar y lanza el error; el `catch` (líneas 57-60) recaptura ese mismo error. Resultado: las líneas 58-59 son inalcanzables por diseño, visibles en el reporte de cobertura (`require-auth.ts` queda en `90% lines / 85.71% branches` — bajo el 100% del resto solo por esa redundancia). Defensa en profundidad, no bug, pero deja un trozo de código muerto que podría confundir a un lector futuro.

**Qué sería:** elegir UNA de las dos guardas — probablemente dejar solo la de `verifyToken` (más atómica y testeada) y quitar el early-return del middleware. Un cambio de 3-4 líneas; cabe en una tarea de 10 minutos. Valor agregado: la cobertura del middleware sube a ~100% sin bajar el floor ni perder seguridad.

### C-15 — Retrofit de `apps/identity-service/src/service/jwt.ts` para usar `@proyecto/auth-middleware`

**Origen:** Tarea candidata enumerada tanto en el alcance declarado de u8-T02 (sección "Fuera", primer bullet) como en el informe del revisor de u8-T02 ronda 1 ("Tareas candidatas", segundo bullet). `identity-service` tiene su propio `verify(token)` local que funcionalmente es equivalente al `verifyToken` del package compartido, pero no lo usa — porque u8-T01 se escribió antes de u8-T02 y el refactor estaba explícitamente fuera de alcance para ambas.

**Qué sería:** reemplazar en `apps/identity-service/src/service/jwt.ts` la implementación local de `verify` por `import { verifyToken } from '@proyecto/auth-middleware'` (y re-export si otros archivos del service lo usan por nombre). La firma (`sign`) se mantiene local — ese es el rol de identity-service como emisor. El valor es la DRY real una vez que u1 y u11 también importen desde el package: tres consumidores de una misma primitiva, un solo sitio donde cambiarla si hay que subir a HS512, rotar claves, o añadir un `kid` header.

### C-16 — Relajar los greps de comando de los CAs que fuerzan carácter de comilla específico

**Origen:** F-01 ronda 1 de u11-T01 (AMARILLO). El CA-5 de u11-T01 corre `grep -E "\"unauthenticated\"" apps/trust-service/src/__tests__/*.ts`. El codificador implementó los tests con comillas simples (`error: 'unauthenticated'`), que es idiomático. El grep no encuentra el literal — pero el criterio sustantivo se cumple (401 con `error: "unauthenticated"` llega del middleware). El revisor pudo arbitrarlo porque la suite entera pasa, pero el comando del CA quedaría como AMARILLO en cualquier futura ronda sobre esta tarea.

**Qué sería:** auditar todos los CAs activos y futuros donde el grep forza comillas dobles o simples alrededor de un literal. Reemplazar con `grep -E "unauthenticated"` (sin forzar la comilla) o con `grep -E "['\"]unauthenticated['\"]"` (aceptando ambas). Aplicable preventivamente a `tareas/_plantilla.md` para que el patrón no se propague.

### C-17 — ESLint `argsIgnorePattern: '^_'` para que `_err` no genere warning

**Origen:** F-01 ronda 1 de u9-T01 (AMARILLO). `apps/identity-service/src/handlers/increment-counter.ts:27` captura el error del try/catch como `_err` (prefijo `_` indica deliberadamente no usado), pero ESLint lo flaggea igual con `@typescript-eslint/no-unused-vars` warning. Exit 0 así que CA-14 pasa, pero es ruido innecesario en el output.

**Qué sería:** en `eslint.config.js` de la raíz, añadir al override de `@typescript-eslint/no-unused-vars`: `{ "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }`. Eliminación de una clase entera de warnings; patrón trivial que estabiliza el lint output.

### C-19 — Decisión arquitectónica: ¿`coverage/**` vive en `.gitignore` o en `eslint.config.js`?

**Origen:** F-02 ronda 1 de u1-T01 (AMARILLO). El codificador modificó `eslint.config.js` para ignorar `coverage/**` + `**/coverage/**`. El revisor correctamente notó que el cambio NO era estrictamente necesario (los `warning` de "Unused eslint-disable directive" sobre `lcov-report/*.js` no rompían CA-15), pero tampoco rompe nada y es defensivo. Queda como decisión de arquitectura del equipo: ¿esto vive en `.gitignore` (ya está allí), en `eslint.config.js`, o en ambos (DRY-en-ambos puede ser deseable para proteger linters diferentes)?

**Qué sería:** una sola decisión del tech lead/humano con un pequeño ADR si corresponde. Deja el cambio puesto por u1-T01 (no lo revertimos) y documéntalo para que futuros codificadores sepan que `coverage/` NO hay que linterarla.

### C-20 — Hygiene de rebase vs confianza en el 3-way merge para olas con tareas intermedias

**Origen:** F-01 ronda 1 de u1-T01 (NARANJA, arbitrado como INVÁLIDO por el orquestador). El revisor dio NO-VERDE pensando que `revisiones/u11-T01/ronda-1.md` se perdería al squash-mergear `tarea/u1-T01` porque el `git diff main..HEAD` lo mostraba como eliminado. El orquestador arbitró: GitHub "Squash and merge" hace una fusión 3-way real que preserva el archivo. Pero el revisor tiene un punto legítimo de hygiene — un rebase antes de entregar habría eliminado la ambigüedad.

**Qué sería:** documentar en el `orquestador.md` (o en una nota a parte en `revisiones/README.md` o similar) la política del equipo: "cuando una ola tiene tareas que se cierran a ritmos distintos, las ramas posteriores NO necesitan rebasarse si el merge es squash vía GitHub; los diffs aparentemente contradictorios son artefacto de merge-base, no defecto". Alternativamente: establecer el patrón "rebasar antes de entregar" como norma blanda. Decisión del equipo.

### C-21 — `uploadId` (PK en BD) vs `stored_filename` (nombre del blob) — relación por fila, no por convención

**Origen:** Observación C-20 del revisor de u1-T01 (renumerada). El `uploadId` lo genera `upload-repository.ts` con `crypto.randomUUID()` server-side (CA-4); el `stored_filename` del blob lo genera el handler con `crypto.randomUUID()` + extensión del tipo detectado (CA-9). Son UUIDs INDEPENDIENTES — nunca coinciden. La fila `uploads` en SQLite es la única relación entre uno y otro. No es defecto pero es deuda de documentación: cualquier operación futura sobre el blob (thumbnail en u2, signed URL en u4, borrado en u13) debe partir de la fila de BD, NO adivinar el filename desde el uploadId.

**Qué sería:** añadir una nota al `apps/ingestion-service/README.md` (cuando exista) explicando la convención. O un comentario en `upload-repository.ts` que documente la relación. O una decisión de arquitectura de usar el MISMO UUID para ambos (simplificación — pero pierde granularidad de rotación del blob storage). Trivial pero importante para las tareas que siguen.

### C-24 — `kubectl port-forward` huérfano a trust-service

**Origen:** Revisor de u3-T01 ronda 1. Hay un `kubectl port-forward svc/trust-service 3300:3300` (PID 4456) abierto desde el 2026-11-16 18:57, de una ola anterior. Misma clase de higiene que C-05.

**Qué sería:** matarlo (`kill 4456`) y cerrar siempre los port-forward al terminar un smoke test. No lo hace el orquestador: es el entorno del humano.

### C-26 — La receta de CA-14 asume un usuario `test@example.com` que ya no existe

**Origen:** Revisor de u3-T01 ronda 2. Las tareas de ola 2 y 3 copian la receta de JWT de u2-T01 con `login` de `test@example.com`; ese usuario ya no está en el cluster (SQLite efímero, ver C-18) y el revisor tuvo que usar `register`.

**Qué sería:** en las próximas plantillas de tarea, usar `register` con un email único por ejecución y `login` solo como alternativa.

### C-27 — Blobs huérfanos en la raíz del PVC `ingestion-blobs`

**Origen:** Hallazgo del codificador en `bitacoras/u4-T01.md`. Hasta u3 el PVC se montaba por su raíz en `/app/data/blobs`; u4-T01 lo monta con `subPath: blobs` y `subPath: db`, así que los 7 blobs antiguos quedan en la raíz del PVC, inaccesibles. La tarea u4-T01 afirmaba por error que se conservarían (corregido como fix de especificación). Sin impacto funcional: ninguna fila de BD los referencia.

**Qué sería:** borrarlos o moverlos a `blobs/` con un Job/`kubectl exec` puntual. Es dato de pruebas en un cluster local; decisión del humano.

### C-28 — Renombrar el PVC `ingestion-blobs` (ahora guarda BD y blobs)

**Origen:** Notas de `tareas/u4-T01-critique-storage.md` y bitácora de u4-T01. El nombre quedó engañoso tras mover la BD al mismo PVC.

**Qué sería:** crear un PVC nuevo (p. ej. `ingestion-data`), migrar datos y borrar el viejo. Obliga a recrear el volumen; solo vale la pena si el nombre confunde de verdad.

### C-30 — `wal_checkpoint` de la BD SQLite sobre el PVC

**Origen:** Candidata del revisor en `revisiones/u4-T01/ronda-1.md`. `ingestion.db` no muestra checkpoint y el archivo WAL ya ocupa ~119 KB en el PVC.

**Qué sería:** un `PRAGMA wal_checkpoint` periódico o al cerrar el proceso. No urge con el volumen del MVP; revisar cuando u5/u6 lean la BD.

### C-31 — Leer cabecera y categorías del detalle en una transacción de lectura

**Origen:** Candidata del revisor en `revisiones/u4-T01/ronda-2.md`. Tras separar la lectura del dueño de la de categorías (F-01), `GET /api/uploads/:uploadId` hace dos consultas fuera de una transacción. Hoy es inocuo porque nada borra ni modifica críticas.

**Qué sería:** envolver ambas lecturas en una transacción de lectura de better-sqlite3 cuando llegue u13 (borrado de historial), para que un borrado concurrente no deje una cabecera sin categorías.

### C-32 — Miniatura redimensionada de verdad

**Origen:** Decisión del humano en u4-T02: `thumbnailUrl` sirve hoy el blob original. Anotada también por el codificador.

**Qué sería:** generar una miniatura real (p. ej. `sharp`). Antes hay que comprobar que el addon nativo funciona en el flujo del `Dockerfile` de ingestion (`node:20-slim` con `python3 make g++`, y el stage runtime copia `node_modules`).

### C-33 — El barrido de secretos de CA-16 depende del nombre de la variable

**Origen:** Candidata del revisor en `revisiones/u4-T02/ronda-1.md` (F-04). El patrón se esquiva renombrando la variable (`JWT_SECRET` → otro nombre).

**Qué sería:** un escáner por valor (gitleaks o trufflehog) en CI, en lugar de grep por nombre. Relacionada con C-29.

### C-34 — CA-15 pasa el valor del Secret por una tubería

**Origen:** Candidata del revisor en `revisiones/u4-T02/ronda-1.md`. `kubectl get secret … -o jsonpath | wc -c` lleva el valor por una tubería, aunque no se muestre.

**Qué sería:** comprobar la existencia y la longitud con `kubectl describe secret` en las plantillas de tarea futuras.

### C-35 — `verify` acepta un `exp` firmado arbitrariamente lejano

**Origen:** Candidata del revisor en `revisiones/u4-T02/ronda-1.md`. Solo es posible con la clave, así que no es explotable hoy.

**Qué sería:** defensa en profundidad: rechazar `exp > now + THUMBNAIL_TTL_SECONDS` en `verifyThumbnailSignature`.

### C-36 — Al borrar un upload (u13) hay que borrar también el blob

**Origen:** Nota del codificador en `bitacoras/u4-T02.md`. Una URL ya emitida seguirá firmada pero dará 404 al desaparecer el blob.

**Qué sería:** incluirlo en el alcance de u13-history-deletion.

### C-37 — `readBlob`: el chequeo `dirname === BLOB_DIR` es redundante con el de nombre

**Origen:** Candidata del revisor en `revisiones/u4-T02/ronda-2.md`. Su mutante sobrevive: con el chequeo de nombre activo, el de `dirname` no cambia ningún resultado (`'.'` da 500 en ambos casos).

**Qué sería:** documentarlo como defensa en profundidad o cubrirlo con un test de `'.'`.

### C-38 — Codificador y revisor comparten scratchpad

**Origen:** Candidata del revisor en `revisiones/u4-T02/ronda-2.md`. En el scratchpad de la sesión aparecieron archivos del otro agente (`thumbnail-url.fixed.ts`, `mut.ts`, `pf-*.pid`), lo que puede contaminar la evidencia.

**Qué sería:** pedirle a cada subagente un subdirectorio propio del scratchpad en el despacho.

### C-39 — El barrido de árbol de la plantilla usa `xargs grep` sin `-r`

**Origen:** Candidata del revisor en `revisiones/u3-T02/ronda-1.md`. En `tareas/_plantilla.md` la línea del barrido de árbol no lleva `-r` en `xargs`, y la del diff sí. En macOS da igual; en GNU, con entrada vacía, `grep` leería de stdin.

**Qué sería:** añadir `xargs -r` en la línea del árbol (en macOS BSD `xargs` ya omite la ejecución sin entrada). Menor.

### C-40 — Paginación o `limit` en `GET /api/uploads`

**Origen:** Candidata del codificador y del revisor en `revisiones/u5-T01/ronda-1.md`. El listado devuelve todos los uploads del usuario sin tope.

**Qué sería:** `limit`/cursor opcionales con un máximo por defecto. Cuidado con u6: la regresión necesita la serie completa o un criterio explícito de ventana.

### C-42 — Endurecer los tests del listado (F-01, F-02 de u5-T01)

**Origen:** AMARILLOS de `revisiones/u5-T01/ronda-1.md`. (F-01) El filtro `user_id` de la segunda consulta de `listByUser` no tiene test que falle si se quita. (F-02) `UploadListSchema.safeParse` descarta claves extra; usar `.strict()` en el test de fuga de campos.

**Qué sería:** dos aserciones adicionales. Sin cambio de código de producción.

### C-44 — Sin tope al tamaño de la respuesta de ingestion en ProgressService

**Origen:** Sonda P8 de `revisiones/u5-T02/ronda-1.md`: se aceptaron 20 MB en 70 ms. Enlaza con C-40 (paginación).

**Qué sería:** límite de bytes al leer el cuerpo y 502 si se supera; mejor junto con paginación en ingestion.

### C-45 — Los Dockerfiles corren como root y llevan devDependencies en el runtime

**Origen:** F-06 de `revisiones/u5-T02/ronda-1.md`. identity, ingestion y progress corren con `uid=0`; `node_modules` incluye jest, ts-jest, eslint, turbo y typescript (162 MB en progress).

**Qué sería:** `USER node` y `npm ci --omit=dev` (o `npm prune --omit=dev`) en la etapa runtime, en los tres servicios, en una tarea de endurecimiento.

### C-47 — La migración de u5-T03 asigna NULL a una fila no parseable y el pod entra en crashloop

**Origen:** informe de `revisiones/u5-T03/ronda-1.md`. Si `strftime` no puede parsear una fila vieja, el `UPDATE` pone NULL, viola `NOT NULL` y `createDatabase` lanza al arrancar. Defecto de **mi** especificación (migración prescrita por la tarea). Hoy no ocurre: todas las filas vienen de `CURRENT_TIMESTAMP`.

**Qué sería:** `WHERE timestamp NOT LIKE '%T%' AND strftime(...) IS NOT NULL`, con un test de fila no parseable.

### C-48 — ingestion-service no atiende SIGTERM

**Origen:** F-01 de `revisiones/u5-T03/ronda-1.md`. Agota los 30 s de gracia y sigue respondiendo durante el apagado; con `Recreate` son unos 30 s de caída extra por despliegue, y permitió que una lectura de verificación saliera del pod viejo.

**Qué sería:** manejador de SIGTERM que cierre el servidor y la BD. Revisar si aplica igual a identity, trust y progress.

### C-49 — Endurecer `toIsoUtc` y los tests de u5-T03 (amarillos F-02, F-03, F-04)

**Origen:** `revisiones/u5-T03/ronda-1.md`. (F-02) la regex de `toIsoUtc` acepta formas híbridas (`...T02:33:19` sin `Z`, `... 02:33:19.123Z`); (F-03) el directorio temporal del caso mezclado se limpia al final del `it` en vez de en `afterEach`; (F-04) el formato `'%Y-%m-%dT%H:%M:%fZ'` está duplicado en `database.ts` y `upload-repository.ts`.

**Qué sería:** una constante compartida, regex estricta por formato y `afterEach` de limpieza. Añadir el filtro redundante `u.status IS NOT NULL` del JOIN de scores a C-42.

### C-50 — Endurecer los tests de ProgressService (amarillos A-01 y A-03 de u5-T02 ronda 2)

**Origen:** `revisiones/u5-T02/ronda-2.md`. (A-01) el espía de logs de `history.test.ts` solo mira `log`, `warn` y `error`: sobreviven `console.info` del userId en el 200 y `console.debug` del JWT en el cliente (y un `process.stdout.write`); (A-03) las redirecciones se prueban solo con 302, sin 301 ni 307.

**Qué sería:** ampliar el espía a `info`, `debug` y `stdout.write`, y parametrizar el test de redirección con 301/302/307. La bitácora de u5-T02 (Ronda 2) afirma «mismo dist» que la ronda 1, imposible tras cambiar `src` (A-02): el informe de la ronda 2 la sustituye.

### C-51 — `prettier --check .` falla en `main` en 5 archivos de WS-T01/WS-T02

**Origen:** `bitacoras/u8-T03.md` (verificado por el orquestador sobre `main`). Fallan `bitacoras/WS-T01.md`, `revisiones/WS-T01/ronda-1.md`, `revisiones/WS-T01/ronda-2.md`, `tareas/WS-T01-scaffold-monorepo.md` y `tareas/WS-T02-endpoint-http-health.md`.

**Qué sería:** `prettier --write` sobre esos 5 archivos (solo documentación) o excluirlos en `.prettierignore`. Mientras tanto los CA de prettier se miden sobre `git diff main...HEAD --name-only`. Plantilla: el CA de CA-4 con `--coverage=false` al filtrar un archivo.

### C-52 — npm 11 en el host no ejecuta install scripts sin `allowScripts`

**Origen:** `revisiones/u8-T03/ronda-1.md`. Un `npm ci` limpio con npm 11.20 deja `better-sqlite3` sin compilar y bcrypt no corre su script de instalación (carga por los prebuilds); hizo falta `npm rebuild better-sqlite3 bcrypt` para correr los tests. El Dockerfile usa npm 10 y no le afecta.

**Qué sería:** documentarlo en el README o declarar `allowScripts`, en una tarea aparte.

### C-53 — La plantilla de CA de imagen debe limpiar también la imagen de la etapa `builder` sin etiqueta

**Origen:** F-02 de `revisiones/u8-T03/ronda-1.md`. `docker rmi <tag>` no borra la imagen final sin etiqueta de la etapa `builder`; queda `99df974139d0` (14:57:28, capa final `npm run build -w apps/identity-service`), casi seguro residuo del codificador de u8-T03. La borra el humano o se autoriza expresamente; el revisor no la tocó.

**Qué sería:** que el CA de build desechable borre por ID tomado del log del build, o construya con `--target`.

### C-54 — `grep -ci bearer` sobre logs no prueba que no se filtre el token

**Origen:** `revisiones/u5-T03/ronda-2.md`. En un servicio que no registra las peticiones, el `grep` siempre da 0; no demuestra nada. Pasó en CA-11 de u5-T03 y en CA-14 de u5-T02.

**Qué sería:** en los CA de despliegue, una lectura con contenido positivo: forzar una ruta que sí escriba en el log y afirmar que no incluye el token, o contar las líneas de log por petición. Actualizar la plantilla.

### C-55 — u13/C9: con u6 sin persistencia no existe `TrendSnapshot` que borrar

**Origen:** decisión de diseño de `tareas/u6-T01-trend-calculation.md`. El motor calcula al leer y no guarda nada; el endpoint C9 (TrustService → ProgressService, borrar `TrendSnapshot`) y FR-13.3 («todos los cálculos de tendencia») quedan satisfechos sin acción en ProgressService.

**Qué sería:** al redactar u13, decidir si C9 desaparece del flujo de borrado (TrustService solo borra en ingestion e identity) o se conserva como no-op. Si u7 introdujera caché o snapshot, esto se reabre.

---

### C-57 — Los CA que hacen grep de `Tests:` ocultan las suites que no compilan

**Origen:** revisor de u6-T01 ronda 1. En el árbol principal, `node_modules` está desactualizado (faltan `multer` y `@anthropic-ai/sdk`): fallan 5 suites de ingestion y Jest aun así imprime `Tests: 111 passed`.

**Qué sería:** añadir `Test Suites:` a los grep de los CA y hacer `npm ci` en el árbol principal. Lo segundo lo decide el humano (es su árbol).

### C-58 — Endurecer los tests de u6-T01 (amarillos F-07 y F-08 de la ronda 2)

**Origen:** revisor de u6-T01 ronda 2. (F-07) La lista cerrada de headers de `trend-service.test.ts` comprueba nombres, no valores: sobrescribir `user-agent`, `accept` o `accept-language` sobrevive. Los valores son idénticos en Node 20 y 26, así que se pueden afirmar por valor. (F-08) Ningún test protege el dominio 0..100 entero de `TrendPointSchema.score`: cambiarlo por `z.number()` sobrevive.

**Qué sería:** afirmar esos headers por valor y añadir un `safeParse` de -1, 101, 1.5 y "5" sobre `TrendPointSchema`. Solo tests; no cambia comportamiento.

### C-59 — El grep de CA-1 es por línea y no ve enums de varias líneas

**Origen:** revisor de u6-T01 ronda 2. Aun corregido, el grep no casaría con un `z.enum([` duplicado cuyos valores van en líneas siguientes (así está escrito el original en `trends.ts:10`). Defecto de la especificación, no de la rama.

**Qué sería:** en la plantilla de tareas, usar `grep -Pzo` multilínea o `grep -rn "z.enum"` y revisar a mano.

### C-60 — Ampliar C-48 (SIGTERM) a identity y trust, y hacer checkpoint de WAL al cerrar

**Origen:** revisor de u14-T01 ronda 1. Medido: el pod viejo agota los 30 s de gracia en cada `Recreate` (identity y trust tampoco atienden SIGTERM), así que cada despliegue deja ~41 s de corte. Además SQLite nunca hace checkpoint al cerrar: `identity.db` y `trust.db` pesan 4096 B (solo cabecera) y todos los datos viven en el `-wal`. Un backup futuro que copie solo el `.db` perdería todo.

**Qué sería:** manejar SIGTERM (cerrar servidor y base, con checkpoint) en identity y trust, junto con ingestion (C-48). Toca `apps/*/src`, por eso es tarea aparte.

### C-61 — Plantillas de CA de infraestructura: puerto 3301, dry-run y aserciones

**Origen:** revisor de u14-T01 ronda 1 (F-01 y F-03, amarillos de especificación). (F-01) El puerto local 3301 lo ocupa el backend local (`apps/backend`, PID 44123): sin port-forward, `curl localhost:3301/health` da 200 y un `trust-health=200` sería un falso verde. (F-03) El `--dry-run=client` de CA-2 no discrimina ninguna mutación y el `grep` no tiene aserción.

**Qué sería:** elegir otro puerto local para trust (p. ej. 3302), o comprobar que el port-forward arrancó; y escribir los CA de manifiestos con aserciones (`grep -q … || echo FALLO`) y `--dry-run=server`. No es defecto del codificador.

### C-62 — `reclaimPolicy: Delete` en la StorageClass `standard` afecta a tres PVC con datos

**Origen:** revisor de u14-T01 ronda 1. Borrar `ingestion-blobs`, `identity-data` o `trust-data` borra los datos. Riesgo conocido y anotado en la tarea; no se cambió.

**Qué sería:** aceptarlo para el MVP local o crear una StorageClass con `Retain`. Decisión del humano si el entorno se vuelve compartido.

### C-63 — Módulo común en progress-service para `isTimeout` y el mapeo fallo → HTTP

**Origen:** revisor de u7-T01 ronda 1 (F-04, amarillo). `identity-client.ts` repite `isTimeout` de `ingestion-client.ts` y `handlers/trends.ts` repite el switch de `history.ts`; era forzoso porque esos archivos estaban fuera de alcance.

**Qué sería:** extraer ambos a un módulo común y que history, trends y los dos clientes lo usen.

### C-64 — `claude-client.ts` tiene su propio mapa de nombres de categoría

**Origen:** revisor de u7-T01 ronda 1. `apps/ingestion-service/src/service/claude-client.ts:72` duplica el mapa de `CATEGORY_NAME_BY_ID`, que ya vive en `packages/shared-types/src/trends.ts` (única fuente según `project.md`).

**Qué sería:** que ingestion importe el mapa de `shared-types`. Si hay que moverlo a `anthropic.ts`, hacerlo en esa tarea.

### C-65 — Usuarios y datos E2E de prueba en identity e ingestion

**Origen:** revisor de u7-T01 ronda 1. Quedan `rev-u7t01-{a,b}-<epoch>@rev.test` (A es `paid` con 5 uploads, B es `free` con 1). Inofensivo; se anota por si el humano quiere un entorno limpio.

### C-66 — `CategoryTrendSchema` no es estricto ni ata `categoryId` a `categoryName`

**Origen:** revisor de u7-T01 ronda 1 (F-02, amarillo). `{status:'locked', slope:3}` valida porque Zod elimina las claves extra, y `{categoryId:'CAT-1', categoryName:'Perspective'}` también. Hoy las fugas de `slope` o `qualifiedCount` solo las cubren los `not.toContain` de los tests.

**Qué sería:** `.strict()` en `CategoryTrendSchema` y `TrendResponseSchema` y comprobar `categoryName === CATEGORY_NAME_BY_ID[categoryId]` en el `refine`. Cambia `shared-types`, así que exige imagen nueva y redespliegue de progress-service: va en una tarea propia o junto al frontend.

### C-67 — Endurecer el espía de logs de `trends.test.ts` y compartirlo con `history.test.ts`

**Origen:** revisor de u7-T01 ronda 2 (F-05 y F-06, amarillos). `expectSilentLogs` distingue mayúsculas en las direcciones (`IMPROVING` sobrevive), busca solo el JWT completo (los segmentos del payload o la firma sobreviven), no espía `process.stderr.write`, no comprueba `slope`, y los escenarios de `it.each(failures)` no afirman el status.

**Qué sería:** comparar sin distinguir mayúsculas, buscar cada segmento del JWT, espiar también `stderr`, añadir `expect(res.status)` por escenario y extraer un helper común de silencio de logs entre `history.test.ts` y `trends.test.ts`. Solo tests; no cambia la imagen.

### C-68 — Pantalla de error de onboarding sin salida (cerrar sesión)

**Origen:** revisor de u0-T01 ronda 1 (F-08, amarillo). Con token válido y trust en 5xx, la guarda solo ofrece Retry y ni `/login` ni `/register` dejan cerrar sesión.

**Qué sería:** añadir «Log out» a la pantalla de error de la guarda, con su test. Se puede hacer en u0-T02 (que ya toca el cascarón).

### C-69 — Proxy de desarrollo de Vite con puertos incrustados e incompleto

**Origen:** revisor de u0-T01 ronda 1 (F-07, amarillo). `vite.config.ts` apunta a `localhost:31xx-34xx` y le faltan `/api/policy` y `/api/history`, que nginx sí enruta.

**Qué sería:** derivar el proxy de dev de variables de entorno o quitarlo; incluir todas las rutas de nginx.

### C-70 — Reproducibilidad del «rojo primero» del frontend y declaración de `collectCoverageFrom`

**Origen:** revisor de u0-T01 ronda 1 (F-09, amarillo). Los cuerpos neutros nunca se commitearon, y `collectCoverageFrom` excluye `src/__tests__/**` sin que la tarea lo declare.

**Qué sería:** commitear el rojo (commit aparte) en las próximas tareas de UI y declarar las exclusiones en la tarea; añadir tests de doble envío en registro y onboarding.

### C-71 — Bundle del frontend de 741 kB, React Router 6.x con avisos moderate, nginx que resuelve upstreams al arrancar, sin rate limiting en login

**Origen:** revisor y codificador de u0-T01 ronda 1. (a) `shared-types` se compila a CJS y arrastra Zod entero: subrutas o salida ESM. (b) Subir a React Router 7. (c) Si falta un Service, el pod del frontend no arranca. (d) identity no limita intentos de login.

**Qué sería:** tareas propias cuando toque endurecer; ninguna bloquea el MVP.

### C-72 — JWT en `localStorage` frente a cookie `HttpOnly`, y sin test E2E con navegador

**Origen:** orquestador, decisión 3 de u0-T01. XSS puede leer el token; la mitigación actual es la CSP de nginx. Sin navegador automatizado, el DOM real no se prueba.

**Qué sería:** decidir si el MVP acepta el riesgo; evaluar Playwright en una tarea de infraestructura de pruebas.

## Cerradas

### C-56 — u7 debe conectar `loadTrendConfig(process.env)` al arranque

**Cerrada por u7-T01 (PR #23, `fdeb2da`):** `createApp` llama a `loadTrendConfig(process.env)` al arrancar, con tests de arranque fallido y de efecto de `TREND_MIN_UPLOADS`; `IDENTITY_URL` es obligatoria.

### C-41 — `uploads.timestamp` con resolución de segundos

**Cerrada por u5-T03 (PR #20, `ec286dc`):** migración idempotente a milisegundos y escritura explícita en `create`. Quedan C-47 (fila no parseable) y C-49 (endurecer `toIsoUtc`).

### C-46 — `npm audit --audit-level=high` falla en main

**Cerrada por u8-T03 (PR #19, `9571612`):** bcrypt 5 → 6 quita `tar` y `node-pre-gyp` del árbol; `audit exit=0` en main. Quedan 6 moderate (`typescript-eslint`, `minimatch`) y C-52. La imagen nueva de identity aún no está desplegada.

### C-18 — SQLite efímero vs PVC persistente en `apps/ingestion-service/`

**Cerrada por u4-T01 (PR #14, `f42af66`):** la BD SQLite vive ahora en el PVC `ingestion-blobs` (`subPath: db`, `DB_PATH=/app/data/db/ingestion.db`). Quedan como residuo C-27 y C-28.

### C-25 — Tipar con `satisfies UploadResult` el body `ready` de `handlers/uploads.ts`

**Cerrada por u4-T01 (PR #14, `f42af66`):** el body `ready` se tipa con `satisfies UploadResult`, simétrico con el de fallback.

### C-22 — `new Anthropic({ apiKey })` sin `maxRetries: 0` contradice C10 «No retry»

**Cerrada por u3-T02 (PR #16, `2fc5fe1`):** el cliente se construye con `maxRetries: 0` y un test fija la opción observando el constructor simulado. El cluster aún corre una imagen anterior; llegará con el siguiente despliegue.

### C-29 — El patrón de secretos de CA-17 marca cualquier mención de `sk-ant-api<n>` en bitácoras

**Cerrada por u3-T02 (PR #16, `2fc5fe1`):** `tareas/_plantilla.md` lleva el CA estándar «Sin secretos»: el barrido del diff no excluye nada y el del árbol excluye `bitacoras/` y `revisiones/`.

### C-23 — Razón de fallback propia para errores de red/5xx (`api_error`)

**Descartada por el humano (ola 9, 2026-11-18):** `fallbackReason: "timeout"` sigue cubriendo red y 5xx. No se toca `shared-types` por esto.

### C-43 — identity y trust guardan su SQLite en un `emptyDir`

**Cerrada por u14-T01 (PR #22, `eb8c014`):** PVC `identity-data` y `trust-data` con `strategy: Recreate`; la persistencia se comprobó por lectura de vuelta tras reiniciar. Identity corre `identity-service:u14-T01` (bcrypt 6). Quedan C-60 (SIGTERM y checkpoint de WAL), C-61 y C-62 (`reclaimPolicy: Delete`).
