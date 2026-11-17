# Ronda 2 — u4-T01

VEREDICTO: VERDE

Los dos ROJOS de la ronda 1 están resueltos y lo comprobé con mis propias ejecuciones. Los 19 criterios pasan. No queda ningún ROJO ni NARANJA, solo dos AMARILLOS que no bloquean.

**Verificaciones previas**

- La tarea en main tiene blob `8b9356e5…`, igual que el archivo en disco, así que no cambió.
- Worktree en `4007d2a`, rama `tarea/u4-T01`, merge-base `87e2618`, 6 commits.
- Al terminar, `git status` está limpio; solo quedan artefactos ignorados (`coverage/`, `.turbo/`, `dist/`).
- Entre `66d41e4` y HEAD cambian 4 archivos: `handlers/uploads.ts`, `upload-repository.ts`, `uploads-http.test.ts` y la bitácora.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                          | Comando que corrí                                                      | Resultado                                                                                                        |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `UploadDetailSchema` derivado, sin `thumbnailUrl` | greps de CA-1, build de shared-types y auth-middleware, `tsc --noEmit` | pasa: `tsc` termina en 0 y el diff de shared-types no borra ninguna línea                                        |
| 2   | Tablas, migración, FK, CHECK                      | jest `(database\|upload-repository)`                                   | pasa (24/24)                                                                                                     |
| 3   | `saveCritique` atómico, `getDetail`               | jest `upload-repository`                                               | pasa: ready, fallback, rollback, null, orden y Z                                                                 |
| 4   | POST HIGH/MEDIUM persiste 5 filas                 | jest `uploads-http`                                                    | pasa                                                                                                             |
| 5   | Los tres fallbacks dejan 0 filas                  | jest `uploads-http`                                                    | pasa                                                                                                             |
| 6   | 500 «Failed to store critique»                    | jest `uploads-http`                                                    | pasa                                                                                                             |
| 7   | GET 200 del dueño                                 | jest `uploads-http`                                                    | pasa                                                                                                             |
| 8   | 403 para otro usuario y para un tercero           | jest y cluster                                                         | pasa                                                                                                             |
| 9   | 404 y 401                                         | jest y cluster                                                         | pasa (ahora incluye `../etc/passwd` sin codificar)                                                               |
| 10  | GET de un fallback sin `categories`               | jest                                                                   | pasa                                                                                                             |
| 11  | Regresiones                                       | suite completa de ingestion, `tsc` de backend y tests de backend       | pasa: 112/112 en 9 suites, ninguna saltada, 2,4 s; backend 18/18; `tsc` de ingestion y de backend terminan en 0  |
| 12  | Cobertura                                         | `--coverage` y el script de CA-12                                      | pasa: `coverage ok …`; uploads.ts 92,77/88,88, database.ts 100/87,5, upload-repository.ts 100/100                |
| 13  | Lint y Prettier                                   | `turbo run lint --force`, `prettier --check`                           | pasa: 6/6, ninguna tarea en caché, Prettier limpio. El único aviso es de identity-service, fuera del diff        |
| 14  | Manifiestos                                       | greps de CA-14                                                         | pasa: tag u4-T01, Recreate, 2 subPath, un solo PVC, DB_PATH, anthropic-key, `pvc untouched`                      |
| 15  | Imagen                                            | `docker build`                                                         | pasa: 27/27 pasos desde caché, id `c3079b7e…` sin cambios, `no latest tag`. La imagen contiene `getDetailHeader` |
| 16  | Persistencia en kind                              | solo lectura de vuelta (detalle abajo)                                 | pasa                                                                                                             |
| 17  | Sin secretos                                      | los dos comandos tal cual                                              | pasa: imprime `no secrets in diff or tree`                                                                       |
| 18  | Alcance                                           | CA-18 con `main...HEAD`                                                | pasa: `scope respected`; los 10 archivos están permitidos                                                        |
| 19  | Rama y commits                                    | `rev-parse`, `log`                                                     | pasa: `tarea/u4-T01`, 6 commits                                                                                  |

**CA-16 en kind.** No hice `kind load`, `apply` ni `rollout`; solo lectura.

- **Imagen del pod:** el config digest de `docker save` de la imagen del árbol actual es `c6835190…`. Coincide con `crictl inspecti` en el nodo y con la imagen del contenedor que corre (`crictl ps`).
- **Pod:** `ingestion-service-f7988b-m5dzq`, ready, 0 reinicios, arrancó a las 22:27:52Z. La imagen se creó a las 22:27:16Z.
- **Código en el pod:** `grep getDetailHeader` dentro del pod da 1, así que corre el código de la ronda 2.
- **Recursos:** el deployment es `ingestion-service:u4-T01 Recreate`, el PVC está `Bound` y el ConfigMap tiene `DB_PATH=/app/data/db/ingestion.db`.
- **Persistencia tras reinicio:** en la BD del PVC hay dos uploads anteriores al arranque del pod (`10bb3cad…` de las 22:04:24 y `aa18ec4e…` de las 22:21:41), los dos `ready` con 5 críticas cada uno. Sobrevivieron al reinicio.
- **Upload nuevo:** registré dos usuarios con email único (`revisor-r2-a/b-<ts>@example.com`). Con A, el POST dio 202 (`2af049c6…`) y el GET 200: mismas categorías que el POST, CAT-1..CAT-5, timestamp con Z y sin `thumbnailUrl`.
- **Otros códigos:** el usuario B recibe 403 con el body exacto; sin auth, 401.
- **BD dentro del pod:** `ls` muestra `ingestion.db`, `-wal` y `-shm`. Los conteos son `uploads:3` y `critiques:15`.
- **Port-forwards:** cerré los míos (13200 y 13100). Sigue abierto el de trust en 3300, que ya existía y no es mío.
- **Límite:** no repetí el `rollout restart` ni el `node -e` que compara antes y después, porque los tengo prohibidos. La persistencia la demuestran las filas anteriores al arranque del pod.

## Hallazgos de la ronda 1, re-verificados

**F-01 (ROJO): cerrado.**

- **Sonda propia:** compilé el árbol actual en el scratchpad y le puse un espía sobre `db.prepare`. Para el intruso, tanto en un upload ready como en uno low_confidence, solo se ejecuta `SELECT upload_id, user_id, … FROM uploads`. No hay ningún SELECT sobre `category_critiques`.
- **Camino del dueño:** compilé también el código de `66d41e4` y comparé los bodies del dueño (ready con categorías desordenadas al guardar, y low_confidence con `timeout`). Son idénticos entre la ronda 1 y la ronda 2. El único cambio es que el dueño de un low_confidence ya no consulta categorías.
- **El test detecta la regresión:** trabajé en una copia fuera del worktree (`…/scratchpad/r2/mut`).
  - Mutación 1: volver a llamar `repo.getDetail` antes del dueño. El test F-01 falla en la línea 601.
  - Mutación 2: restaurar el handler y el repo de `66d41e4`. Falla 1 de 29.
  - Sin mutación, el test pasa.
- **Sin pase vacío:** el test exige `executed.length > 0` y, para el dueño, que sí aparezca el SELECT de categorías, así que no puede pasar sin ejecutar nada.

**F-02 (ROJO): cerrado.**

- Los dos comandos de CA-17, corridos tal cual, imprimen `no secrets in diff or tree`.
- `grep -nEi "sk-ant|sk-[a-z0-9]{6,}|api[_-]?key\s*[:=]|secret"` sobre la bitácora solo encuentra la línea 185, que es la propia salida de CA-17.
- La afirmación caducada se borró, y la de «antes de leer categorías» quedó marcada como falsa en ronda 1.

**F-03 (AMARILLO): resuelto en lo que era posible.** Hay un rojo de ejecución real para F-01, que yo mismo reproduje. Para el 403 y las 5 filas, el codificador explica por qué no hay rojo retroactivo: el código previo ni compilaba con esos tests. La explicación es aceptable.

**F-04 (AMARILLO): cerrado.** Hay un comentario explicativo y se añadió la forma `../etc/passwd` sin codificar; el test pasa.

## Hallazgos nuevos

### F-05 · AMARILLO · bitacoras/u4-T01.md:45 · Encabezado sin contenido

Al limpiar F-02 quedó la línea «CA-1/CA-14/CA-17 (salida fresca):» sin ninguna salida debajo. Ya no afirma nada falso, pero es un residuo engañoso. Conviene borrarla.

### F-06 · AMARILLO · upload-repository.ts:201 · `getDetail` solo se usa en tests

Producción usa `getDetailHeader` y `getCategories`. `getDetail` sigue en el contrato que pide la tarea, así que es correcto mantenerlo. Aun así conviene un comentario que avise de que no debe usarse en caminos con control de dueño.

## Tareas candidatas (defectos reales fuera de alcance)

- La cabecera y las categorías se leen en dos consultas fuera de una transacción. Hoy no importa porque nada borra ni modifica críticas. Cuando llegue u13 (borrado), conviene leerlas en una transacción de lectura.
- Mi propio `revisiones/u4-T01/ronda-1.md` en main contiene el literal `sk-ant-api03-SECRET`. Un CA-17 corrido sobre el árbol de main lo detectaría. Es un caso más de C-29, que ya está registrada.

## Rutas de transcripciones largas

- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2/full.txt (suite completa)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2/http.txt (uploads-http con `--verbose`)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2/order2.js, old.txt y new.txt (sonda del orden de SQL y comparación entre rondas)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2/mut/ (copia mutada para las mutaciones)
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/d781633d-4e3c-455b-9e29-f979a197beba/scratchpad/r2/post.json y get-a.json (cluster)

```
VEREDICTO: VERDE
AMARILLO|bitacoras/u4-T01.md:45|Encabezado «salida fresca» sin contenido
AMARILLO|apps/ingestion-service/src/service/upload-repository.ts:201|getDetail solo se usa en tests
INFORME: revisiones/u4-T01/ronda-2.md
```
