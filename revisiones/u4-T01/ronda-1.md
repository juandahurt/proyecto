# Ronda 1 — u4-T01

VEREDICTO: NO-VERDE

Hay dos ROJOS. Primero, la comprobación de dueño ocurre después de leer las categorías de la BD. Segundo, CA-17 no imprime lo esperado y la bitácora afirma que sí. El resto de criterios pasa con mi propia ejecución, incluida la lectura de vuelta en kind.

**Verificaciones previas:**

- La tarea en main coincide con lo despachado: blob `8b9356e…` y sha256 `05feb490…`.
- `git diff 87e2618 f7d8121 -- tareas/u4-T01-critique-storage.md` cambia una sola línea: la nota de `subPath: blobs`. Nada más.
- El worktree está en `66d41e4`, rama `tarea/u4-T01`, base `87e2618`.
- `git status` al terminar: limpio. Solo hay artefactos ignorados (`coverage/`, `.turbo/`, `dist/`).

## Criterios de aceptación, verificados por mí

| #   | Criterio                                          | Comando que corrí                                                | Resultado                                                                                                                |
| --- | ------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `UploadDetailSchema` derivado, sin `thumbnailUrl` | los grep de CA-1 + build shared-types + `tsc --noEmit` ingestion | pasa (exit 0; el diff de shared-types solo añade líneas)                                                                 |
| 2   | Tablas, migración, FK, CHECK                      | jest `(database\|upload-repository)`                             | pasa (24/24, 1,08 s)                                                                                                     |
| 3   | `saveCritique` atómico, `getDetail`               | jest `upload-repository`                                         | pasa (ready, fallback, rollback por UNIQUE, null, orden, Z)                                                              |
| 4   | POST HIGH/MEDIUM persiste 5 filas                 | jest `uploads-http`                                              | pasa (lectura SQL de vuelta)                                                                                             |
| 5   | Fallbacks LOW/invalid_schema/timeout              | jest `uploads-http`                                              | pasa (0 filas, `fallback_reason` correcto)                                                                               |
| 6   | 500 «Failed to store critique»                    | jest `uploads-http`                                              | pasa                                                                                                                     |
| 7   | GET 200 del dueño                                 | jest `uploads-http`                                              | pasa                                                                                                                     |
| 8   | 403 a otro usuario y a un tercero                 | jest + cluster                                                   | pasa por la respuesta (ver F-01 sobre el orden)                                                                          |
| 9   | 404 y 401                                         | jest + cluster                                                   | pasa                                                                                                                     |
| 10  | GET de un fallback, sin `categories`              | jest                                                             | pasa                                                                                                                     |
| 11  | Regresiones                                       | suite completa de ingestion; `tsc` y tests de backend            | pasa (111/111 sin skips; backend 18/18; tsc exit 0)                                                                      |
| 12  | Cobertura de service/ y handlers/                 | `--coverage` + script de CA-12                                   | pasa: `coverage ok …`. uploads.ts 92,77 % líneas / 88,88 % ramas; database.ts 100 / 87,5; upload-repository.ts 100 / 100 |
| 13  | Lint y Prettier                                   | `turbo run lint --force`; `prettier --check`                     | pasa (6/6, 0 cacheadas; Prettier limpio)                                                                                 |
| 14  | Manifiestos                                       | los grep de CA-14                                                | pasa (u4-T01, Recreate, 2 subPath, un solo volume, DB_PATH, anthropic-key, pvc intacto)                                  |
| 15  | Imagen construida                                 | `docker build` (todo en caché)                                   | pasa. Id `2edaab9d…` sin cambios; `no latest tag`                                                                        |
| 16  | Persistencia en kind                              | lectura de vuelta, sin modificar el cluster                      | pasa (ver abajo)                                                                                                         |
| 17  | Sin secretos                                      | los dos grep de CA-17                                            | **falla**: no imprime `no secrets in diff or tree`                                                                       |
| 18  | Scope                                             | CA-18 con `main...HEAD`                                          | pasa: `scope respected`; 10 archivos, todos permitidos                                                                   |
| 19  | Rama y commits                                    | `rev-parse`; `log`                                               | pasa (`tarea/u4-T01`, 4 commits)                                                                                         |

**CA-16, cómo lo comprobé sin tocar el cluster** (sin kind load, apply ni rollout):

- **Imagen:** la imagen del árbol actual tiene config digest `fffdc09a…` (`docker save`). Coincide con `crictl inspecti` en el nodo y con el `image` del contenedor que corre (`crictl ps`). El pod es `ingestion-service-6b57f84f8c-wc5n7`: Running, ready, 0 reinicios, arrancó a las 22:16:42Z.
- **Deployment, PVC y ConfigMap:** el deployment muestra `ingestion-service:u4-T01 Recreate` y los mounts `blobs`/`db` con subPath. El PVC está `Bound` y el ConfigMap tiene `DB_PATH=/app/data/db/ingestion.db`.
- **Persistencia tras reinicio:** el upload `10bb3cad…` tiene timestamp `2026-11-17 22:04:24`, anterior al arranque del pod. Sigue en la BD del PVC con status ready y 5 críticas, así que sobrevivió al reinicio.
- **Upload nuevo:** registré dos emails únicos (`revisor-a/b-<ts>@example.com`). Con A hice POST → 202 y luego GET → 200, con las mismas 5 categorías y timestamp con Z.
- **403:** el usuario B recibe 403 `{"data":null,"error":"Forbidden","status":403}` tanto sobre el upload nuevo como sobre `10bb3cad`.
- **Lectura de la BD dentro del pod:** `ls` muestra `ingestion.db`, `-wal` y `-shm`. La consulta devuelve `fk:1`, `uploads:2`, `critiques:10` y las columnas de C5 intactas.
- **Ids raros contra el GET:** todos dan 404 con el body exacto y ningún 500. Probé: UUID en mayúsculas, `../etc/passwd`, `..%2Fetc%2Fpasswd`, UUID con espacio delante y detrás, 5000 caracteres, `' OR '1'='1` y `';DROP TABLE uploads;--`.
- **Sin auth:** 401.
- **Port-forwards:** cerré los míos (13200 y 13100). Queda abierto uno de trust-service en 3300 que ya existía y no es mío.
- **Límite:** no pude repetir el reinicio ni el `node -e` que compara antes y después, porque requieren `rollout restart`, que tengo prohibido. Tampoco hice el GET de `10bb3cad` como su dueño, porque no tengo su token.

**Inyección SQL:** todas las consultas de `database.ts` y `upload-repository.ts` usan sentencias preparadas con `?`. El único SQL no parametrizado es `PRAGMA table_info(uploads)`, que es un literal fijo. Sin hallazgo.

**Migración:** la probé sobre un archivo con el schema viejo en WAL y una fila. Abrí con `createDatabase`, guardé la crítica y volví a abrir tres veces. Resultado: fila y 5 críticas conservadas, columnas sin duplicar, `foreign_keys=1` en cada apertura, `DELETE` del padre rechazado con FK y CHECK de `status` aplicado. `createDatabase` es el único `new Database` en `src/`. El timestamp `2026-01-02 03:04:05` sale como `2026-01-02T03:04:05.000Z`, sin desfase.

**Contrato del 202 de POST:** el diff solo envuelve el body ready en `const body … satisfies UploadResult`. Los tests de u3 no tienen líneas borradas. Sin hallazgo.

## Hallazgos

### F-01 · ROJO · apps/ingestion-service/src/handlers/uploads.ts:229-236 y upload-repository.ts:160-178 · El 403 se decide después de leer las categorías de la BD

La tarea dice: «La comparación va **antes** de leer/serializar categorías». En el código, `getDetail` lanza `categoriesStmt.all(uploadId)` siempre, y el handler compara `detail.userId` después. Lo comprobé con un espía sobre `db.prepare` (`…/scratchpad/probe/order.js`). Durante un GET de un intruso que responde 403, se ejecutan:

```
SELECT upload_id, user_id, timestamp, status, confidence, fallback_rea…
SELECT category_id, category_name, score, feedback FROM category_criti…
```

El body del 403 no filtra nada; eso está bien. El problema es que el `feedback` del otro usuario se carga en memoria para un no dueño, que es justo lo que la especificación prohíbe. Además, la línea 36 de la bitácora afirma «otro dueño -> 403 antes de leer categorías», y eso es falso.

Ningún test detecta este orden, y la clase completa es esa: la prueba de 403 solo mira el body. Hace falta:

- separar la lectura del dueño de la lectura de categorías, o pasar el `requesterId` al repo;
- un test que afirme que en el 403 no se consultan las categorías.

### F-02 · ROJO · CA-17 / bitacoras/u4-T01.md:46-47 · CA-17 falla y su evidencia no corresponde al árbol actual

El segundo comando de CA-17 imprime la línea 47 de la bitácora, que contiene el literal `sk-ant-api03-SECRET`. Ese literal coincide con `sk-ant-api[0-9]+`, así que el comando nunca llega a imprimir `no secrets in diff or tree`. El primer comando, sobre el diff, también la imprime.

La línea 46, añadida en el mismo commit `b42b8a4`, declara que CA-17 imprimió `no secrets…` «re-ejecutado tras el último ajuste». Esa salida no puede haber salido del árbol actual: es evidencia caducada.

No es una clave real; es una clave falsa citada en prosa. Aun así, el criterio no se cumple tal como está escrito. Además, el commit `6dcd972` de la rama todavía contiene ese literal en un test. Con squash desaparece del trunk.

### F-03 · AMARILLO · bitacoras/u4-T01.md:16-29 · El «rojo primero» de los tests HTTP fue un fallo de compilación

El plan pedía ver fallar el 403, porque hoy responde el 404 global y el test debe afirmar el 403 exacto. También pedía ver fallar la aserción de 5 filas tras el POST. `uploads-http` falló al compilar porque faltaba `UploadDetailSchema`, así que esas aserciones nunca se vieron fallar en ejecución. Solo hay rojo real para `database`.

### F-04 · AMARILLO · uploads-http.test.ts (test 404) · `../etc/passwd` solo se prueba codificado

El test usa `..%2Fetc%2Fpasswd`. La forma cruda la normaliza el cliente a otra ruta, la que atiende el 404 global. Yo la verifiqué en el cluster y da 404. Bastaría un comentario que lo explique en el test.

## Tareas candidatas (defectos reales fuera de alcance)

- El patrón de CA-17 marca como secreto cualquier mención de `sk-ant-api<n>` en las bitácoras. Conviene excluir `bitacoras/` y `revisiones/` del barrido o acotar el patrón a valores asignados.
- `ingestion.db` sigue con mtime 22:03 y el WAL ya ocupa 119 KB: no se ve checkpoint. Con más volumen conviene un `wal_checkpoint` periódico o al cerrar.

## Rutas de transcripciones largas

- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/http.txt (salida verbose de `uploads-http`)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/probe/order.js (prueba del orden del 403)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/probe/mig.js (migración repetida, FK y CHECK)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/post.json y get-a.json (cluster)

```
VEREDICTO: NO-VERDE
ROJO|apps/ingestion-service/src/handlers/uploads.ts:229-236|El 403 se decide después de leer las categorías de la BD
ROJO|CA-17 / bitacoras/u4-T01.md:46-47|CA-17 falla y su evidencia no corresponde al árbol actual
INFORME: revisiones/u4-T01/ronda-1.md
```
