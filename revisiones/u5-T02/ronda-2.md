# Ronda 2: u5-T02

VEREDICTO: VERDE

Verifiqué la tarea leyendo el archivo desde main, no desde el worktree. Su blob es `56e16f5f…` y su sha256 `3a3b027f…`, los dos coinciden con el despacho (f10352f). El worktree está en `tarea/u5-T02` @ `34ed447` y el diff lo tomé de `main...HEAD`. Antes de empezar hice un `npm ci` limpio y compilé shared-types y auth-middleware. El host usa Node v26 y la imagen Node 20.

## Respuesta a F-01..F-07 (con mutaciones mías, en una copia del worktree dentro del scratchpad)

- **F-01 está cerrado.** El test «campo de mas en un item y en el envoltorio» afirma 200 y que el body no lleva `userId`, `extra` ni `otro`. Probé tres mutaciones: M1a (`UploadListSchema.strict()`), M1b (devolver los items crudos) y M1c (pasarlos con spread). Las tres hacen fallar ese test por la aserción. Los casos de campo requerido faltante y de enum inválido siguen dando 502.
- **F-02 está cerrado.** El código usa `redirect: 'error'`. Al quitarlo (M2a) o al poner `follow` (M2b) fallan los dos tests de 302: el de otro host y el de otro path del mismo origen. Ambos afirman 502 y 0 peticiones al destino.
- **F-03 está cerrado según lo que pide la especificación.** El espía recorre el camino 200 (con items y vacío) y todos los casos de CA-5, incluidos 302 y puerto cerrado. Estas mutaciones fallan por la aserción: log de items en el 200 (M3a), `console.log` del userId en el 200 (M3b2), JWT en el 401 (M3c), userId en el timeout (M3d), cuerpo en bad-response y en no-JSON (M3e, M3g), URL en upstream (M3f) y `console.warn` del JWT en el cliente (M3h2). Queda un hueco que no bloquea, en A-01.
- **F-04 está cerrado.** Con `INGESTION_TIMEOUT_MS=50` y un ingestion lento la respuesta es 504, y el `afterEach` restaura la variable. Si se ignora la variable (M4), ese test falla.
- **F-05 está cerrado.** Si se quita `status=` (M5a) falla el test de la marca. Si el cliente deja de propagar el status (M5b) fallan 2 tests.
- **F-06 está cerrado.** El Dockerfile ya no instala `python3 make g++`. En `docker history` solo aparecen las capas apt de la base node:20-slim y no hay better-sqlite3 en `/app/node_modules`. El usuario no-root y `--omit=dev` quedan en C-45, como estaba arbitrado.
- **F-07 está cerrado.** `isTimeout` solo acepta `TimeoutError` y lleva un comentario. Si siempre devuelve false (M7a) fallan 3 tests. Si vuelve a aceptar `AbortError` (M7b) no falla ningún test. La especificación lo permite (pide «restringir o documentar»), así que no es un hallazgo.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                   | Comando que corrí                                                               | Resultado                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workspace, tsc, schema reutilizado                         | los 4 de CA-1                                                                   | pasa (tsc exit 0, `sin schemas duplicados`)                                                                                                                                                                                   |
| 2-7 | Feliz, reenvío, 401, mapeo de errores, logs, INGESTION_URL | los greps de cada CA más la suite completa                                      | pasan: 38/38 en 1,3 s, sin tests omitidos ni todo, más las mutaciones de arriba                                                                                                                                               |
| 8   | Cobertura                                                  | comando de CA-8                                                                 | `coverage ok` (cliente 100 % líneas / 90,9 % ramas; handlers 100/100)                                                                                                                                                         |
| 9   | Sin paquetes de registro                                   | los 3 de CA-9                                                                   | pasa; el lockfile solo gana el workspace y su enlace                                                                                                                                                                          |
| 10  | Lint, build y prettier                                     | `turbo lint --force` (7/7, 0 en caché), build (3/3), prettier                   | pasa                                                                                                                                                                                                                          |
| 11  | Regresiones                                                | ingestion 194, identity 72, trust 25, backend 18; grep de alcance               | pasa                                                                                                                                                                                                                          |
| 12  | Manifiestos                                                | los 8 comandos                                                                  | pasa; además `kubectl diff -f k8s/progress/` sale vacío                                                                                                                                                                       |
| 13  | Imagen y smoke                                             | inspect `2ad63a70…`, solo el tag `u5-T02`; smoke de `/health` por mi cuenta: no | Mi evidencia es el contenido de la imagen y el pod en marcha (ver CA-14a). No hice `docker build` porque los límites lo prohíben                                                                                              |
| 14a | Despliegue y lectura de vuelta                             | secret, deployment, pod, svc; `docker save`, `crictl inspecti`, `crictl ps`     | pasa (detalle debajo)                                                                                                                                                                                                         |
| 14b | E2E con usuarios                                           | port-forwards míos y dos usuarios `*.test` nuevos                               | pasa: `items idénticos: true n=2 desc: true`; B ve 1 item, igual que en ingestion; con `?userId=<A>` el body es idéntico y no aparece nada de A; 401 sin token y con token basura; `/health` 200; logs con 0 `bearer` y 0 ids |
| 15  | Sin secretos                                               | CA-15 más una búsqueda de `eyJ` y `sk-ant` en el diff                           | pasa                                                                                                                                                                                                                          |
| 16  | Alcance                                                    | CA-16                                                                           | `scope respected`                                                                                                                                                                                                             |
| 17  | Commits                                                    | log y `show --name-only` por commit                                             | 7 commits; cada uno contiene solo los archivos de su mensaje                                                                                                                                                                  |

**Cadena de la imagen (lección 11).**

- El config digest de `docker save progress-service:u5-T02` es `sha256:e7957bf6…6374e6c`.
- Ese mismo valor aparece como id en `crictl inspecti` dentro de kind-control-plane y como imageRef del contenedor en `crictl ps`.
- El `imageID` del pod es `import-2026-11-18@sha256:143e64d5…`, ya no `92538739…`.
- Los `.js` de `dist` de la imagen son idénticos byte a byte a mi propia compilación de HEAD: 5 de progress-service, 7 de shared-types y 4 de auth-middleware. La dist contiene `redirect: 'error'`.

## Hallazgos

### A-01 · AMARILLO · `src/__tests__/history.test.ts:37-41` · el espía no mira `console.info` ni `console.debug`

Hay dos mutaciones que sobreviven con 38 tests verdes: M3b (`console.info` del userId en el 200) y M3h (`console.debug` del JWT en el cliente). También sobrevive un `process.stdout.write`. CA-6 nombra literalmente `log`, `warn` y `error`, así que se cumple tal como está escrito. Ampliar el espía a `info` y `debug` cuesta una línea.

### A-02 · AMARILLO · `bitacoras/u5-T02.md` (Ronda 2, bloque «BLOQUEADO») · afirmación inexacta

La bitácora dice que la ronda 1 hizo el E2E «sobre el mismo dist (los .js son iguales)». No puede ser: `src` cambió en bb8d822, así que la dist cambió con él. Además registra el hash de la tarea `45ad6e04…`, que es la versión 2c84184 y no la actual `56e16f5f…`. Eso se explica porque el despacho fue anterior a f10352f. Mi E2E de CA-14b sobre la imagen nueva sustituye esa afirmación.

### A-03 · AMARILLO · CA-5 · solo se prueban redirecciones 302

CA-5 nombra 301, 302 y 307. `redirect: 'error'` las cubre todas por igual, pero no hay un test para 301 ni para 307.

No queda ningún ROJO ni NARANJA.

## Tareas candidatas

- Ninguna nueva. La de `npm audit` (cadena de better-sqlite3, ya en main) y C-45 siguen como estaban. Confirmo que esta tarea no añade paquetes de registro.

## Incidente propio, para registrarlo

En mi primer intento de E2E un error de mi script (`require` sobre un archivo sin extensión `.json`) volcó los dos JWT de los usuarios desechables `rev-u5t02-A/B-…@example.test` en la salida de mis herramientas y en `e2e/salida.txt`. Ese intento no hizo ninguna subida. Borré el archivo, corregí el script y en la segunda pasada ningún archivo contiene `eyJ`. Esos tokens caducan a los 7 días, sus usuarios no tienen datos, y no están en el repo ni en el cluster. Las dos pasadas registraron cuatro usuarios `*.test` en identity y la segunda hizo 3 subidas reales a ingestion.

## Estado al terminar

- Mis port-forwards (13100, 13200 y 13400) están cerrados.
- El PID 4456 sigue intacto.
- Los pods están iguales y con 0 reinicios. No toqué ingestion, identity ni trust.
- El worktree sigue limpio (`git status --porcelain` = 0) y en HEAD `34ed447`.
- En main solo aparece modificado el shard typewriter-local, que no toqué.

## Rutas

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/04260630-1fe3-43e8-ba70-c194d70966c8/scratchpad/rev-u5-T02/mut.out` (resultados de las mutaciones)
- `…/rev-u5-T02/mut.js` y `…/rev-u5-T02/mut2.js`
- `…/rev-u5-T02/ca1-full.log`, `…/rev-u5-T02/ca2-8.log` y `…/rev-u5-T02/ca9-17.log`
- `…/rev-u5-T02/e2e.sh` y `…/rev-u5-T02/e2e/salida.txt`

No escribí el informe en `revisiones/` porque mis herramientas son de solo lectura. Este mensaje es el contenido de `revisiones/u5-T02/ronda-2.md`.

```
VEREDICTO: VERDE
AMARILLO|apps/progress-service/src/__tests__/history.test.ts:37|el espía de logs no cubre console.info/debug (M3b, M3h sobreviven)
AMARILLO|bitacoras/u5-T02.md (Ronda 2)|afirma «mismo dist» que la ronda 1, imposible tras cambiar src
AMARILLO|CA-5|redirecciones probadas solo con 302 (faltan 301/307)
INFORME: revisiones/u5-T02/ronda-2.md
```
