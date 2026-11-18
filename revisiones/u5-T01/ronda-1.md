# Ronda 1 — u5-T01

VEREDICTO: VERDE

Volví a correr yo los 16 criterios de aceptación y pasan todos. Las 6 mutaciones que pediste hacen fallar su test por la aserción, salvo la de mover la ruta, que no puede fallar (F-03). En kind, el digest de config de la imagen y su JS compilado coinciden con el árbol. No queda ningún ROJO ni NARANJA. El worktree queda limpio en `26488bd`, con `git status` vacío. El PID 4456 sigue vivo y no lo toqué.

Preliminares:

- **Tarea:** blob `5e5c6c97…` y sha256 `6959998e…36e2`, los dos coinciden.
- **Base:** el merge-base es `a75e8c2`. `main` avanzó a `1e662ea`, pero solo con `CANDIDATAS.md` y `revisiones/`, así que no afecta a `main...HEAD`.
- **Diff de shared-types:** solo añade líneas.
- **Archivos protegidos:** `database.ts` y los demás protegidos no aparecen en el diff.
- **Manifiesto:** cambian exactamente 2 líneas (solo el tag).

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                                       | Comando que corrí                                       | Resultado                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schemas derivados y aditivos; build y tsc                                      | los 5 comandos del CA                                   | pasa: «cambio solo aditivo», «item schema sin campos internos», build y tsc salen con 0                                                                     |
| 2   | Repo: filtro, orden, desempate, scores, Z, `[]`                                | `npm test … upload-repository --verbose`                | pasa: 8 casos en verde con nombre                                                                                                                           |
| 3   | 2 consultas en 1 transacción con 50 uploads                                    | el mismo test y `grep db.transaction`                   | pasa: el test registra `inTransaction` y espera `[true,true]`                                                                                               |
| 4   | Listado de A, orden, `UploadListSchema`, vacío → `[]`                          | `npm test … uploads-http --verbose`                     | pasa                                                                                                                                                        |
| 5   | Aislamiento con `?userId`, `?user_id` y `?uploadId`; espía; sin fuga de campos | lo mismo                                                | pasa                                                                                                                                                        |
| 6   | 401 (sin token, mal firmado, expirado), 500 con log limpio, detalle intacto    | `--testPathPattern="(uploads-http\|thumbnail\|health)"` | pasa: 115/115 en 2,0 s                                                                                                                                      |
| 7   | Regresiones                                                                    | suite de ingestion; `tsc` y tests de backend            | pasa: ingestion 193/193, backend tsc 0 y 18/18. No hay `skip`, `only` ni `todo`                                                                             |
| 8   | Cobertura de service/ y handlers/                                              | `--coverage` y el script del CA                         | pasa: «coverage ok». `upload-repository.ts` 100/100, `handlers/uploads.ts` 93,61/89,47                                                                      |
| 9   | Lint y Prettier                                                                | `turbo run lint --force` y `prettier --check`           | pasa: 6/6 tareas sin caché, Prettier limpio                                                                                                                 |
| 10  | Sin dependencias nuevas ni `database.ts` tocado                                | comandos del CA                                         | pasa                                                                                                                                                        |
| 11  | Manifiesto: solo el tag                                                        | comandos del CA                                         | pasa: tag `u5-T01`, «old tag absent», `2` líneas, `Recreate`, 2 `subPath`, los 2 Secrets                                                                    |
| 12  | Imagen construida, sin `latest`                                                | `docker image inspect` (no hice build, por los límites) | pasa: Id `72f205f1…`, RepoTags `["ingestion-service:u5-T01"]`, «no latest tag». Se construyó a las 21:15:29, después del último commit de código (21:14:38) |
| 13  | kind de punta a punta                                                          | solo lecturas, detalle abajo                            | pasa                                                                                                                                                        |
| 14  | Sin secretos                                                                   | comandos del CA                                         | pasa: «no secrets in diff or tree»                                                                                                                          |
| 15  | Alcance                                                                        | comandos del CA                                         | pasa: «scope respected»                                                                                                                                     |
| 16  | Rama y commits                                                                 | `rev-parse`, `log` y `show --stat` por commit           | pasa: `tarea/u5-T01`, 4 commits, cada uno solo con los archivos que nombra su mensaje                                                                       |

**Lo que comprobé en CA-13, solo leyendo:**

- **La imagen desplegada es la del árbol:**
  - El config digest es `sha256:eb0a2e85…` en los tres sitios: el `manifest.json` de `docker save`, `crictl inspecti` en `kind-control-plane` y `info.config.image` del contenedor del pod.
  - El `imageRef` del pod es `import-2026-11-18@sha256:c9af9d69…`, el mismo que `repoDigests` de crictl.
  - Saqué de las capas de la imagen los `.js` de `apps/ingestion-service/dist` (13 archivos) y de `packages/shared-types/dist` (7). Son idénticos con `cmp` a mi propia compilación del árbol (`tsc --outDir` al scratchpad) y forman el mismo conjunto de archivos.
- **El deployment está al día:** imagen `ingestion-service:u5-T01`, estrategia `Recreate`, generación igual a la observada, 1 réplica lista y 0 reinicios.
- **Prueba en vivo, con mis propios port-forward (3100 y 3200, ya cerrados):**
  - Registré 2 usuarios con emails únicos `rev-u5t01-{a,b}-<ts>@revisor.test`.
  - Hice 3 POST (2 de A, 1 de B) y los tres dieron 202 `ready`.
  - GET de A: 200 con 2 items, A2 (02:33:19Z) antes que A1 (02:33:17Z), 5 scores cada uno.
  - GET de B: 200 con 1 item, B1.
  - GET de B con `?userId=A&user_id=A`: 200 y solo B1.
  - Sin token, y con un token basura: 401 `unauthenticated`.
  - Ningún cuerpo contiene campos prohibidos ni los ids de usuario.
- **Persistencia, sin reiniciar nada:**
  - Leí la BD del pod en modo solo lectura (`kubectl exec` con `better-sqlite3`, `readonly`).
  - Los 3 uploads del codificador están, con 5 críticas cada uno: `44a00bf4` y `c4072962` de las 02:18:28/30, y `a1352dd7`.
  - Se crearon antes de `restartedAt` (02:19:48Z) y del arranque del pod actual (02:20:19Z), así que sobrevivieron al reinicio.
- **Logs:** `kubectl logs | grep -ci bearer` da 0, y tampoco aparecen mis emails ni mis ids.

**Mutaciones propias**, todas revertidas con `git checkout`. Salidas en el scratchpad, `mut-*.txt`:

- Sin `rowid DESC`: falla «desempate…» por `toEqual`.
- Sin `status IS NOT NULL` (solo en las cabeceras, o en las dos consultas): falla «sin crítica persistida» por `toEqual`.
- Con `(user_id = ? OR 1=1)` en la consulta de cabeceras: fallan el test de «otro usuario» del repo y 3 tests HTTP, todos por la aserción.
  - Un primer intento mío con `perl` cayó en otra sentencia (`countByUserId`) y lo descarté.
  - Lo mantuve parametrizado porque quitar el `?` haría fallar por un error de binding, no por la aserción.
- El handler pasa `req.query.userId ?? token`, o la variante con `user_id`: falla «aislamiento…». Sin el filtro llegan 2 ids de A en vez de B1, así que los datos de A estaban de verdad.
- Las 2 consultas sacadas de la transacción: falla el test de 2 consultas porque `calls` sale `[false,false]`.
- Mover `router.get('/')` después de `/:uploadId`: **no falla nada**. Explicación en F-03.

**Sondas propias**, en un test temporal que ya borré:

- Un espía sobre `db.prepare` envuelve `all`, `get`, `run` e `iterate` de cada sentencia. Con datos de A presentes (`listByUser(A)` devuelve 2), un GET de B con `?userId=A&user_id=A&sub=A` ejecuta exactamente 2 consultas de listado, las dos con `[B]`, y el id de A no aparece en ningún argumento.
- Las claves de cada item son exactamente `confidence, scores, status, timestamp, uploadId`, más `fallbackReason` en `low_confidence`. Las de `scores` son `categoryId, score`. No se cuela feedback, ni nombre de categoría, ni `.jpg`, ni ids, y `UploadListSchema.strict()` pasa.
- Un `sub` con forma de inyección SQL devuelve `items: []`, y `/api/uploads/` con barra final devuelve 200.
- Para comprobar que la sonda detecta algo, la corrí contra la mutación de `req.query.userId` y falla.

Sobre el tiempo de la suite: los 2 s son razonables porque todas las pruebas usan SQLite `:memory:` y un stub de Claude, sin estado externo. El comportamiento externo lo cubre la prueba en kind.

## Hallazgos

### F-01 · AMARILLO · `upload-repository.ts` (`listScoresStmt`) · El filtro `user_id` de la consulta de scores no tiene test

Si quito `u.user_id = ?` solo de la segunda consulta, la suite sigue en verde. No es una fuga, porque los scores se agrupan por los `upload_id` de las cabeceras, que sí están filtradas. Queda como defensa en profundidad y protección del rendimiento sin test. Bastaría con afirmar que la segunda sentencia no devuelve filas de otro usuario.

### F-02 · AMARILLO · `uploads-http.test.ts` · `UploadListSchema.safeParse` no detecta campos de más

Zod, por defecto, quita las claves desconocidas, así que un campo extra pasaría el `safeParse`. Hoy lo cubre el barrido de `FORBIDDEN_KEYS`, pero una clave nueva que no esté en esa lista pasaría. Usar `.strict()` en el test lo cerraría.

### F-03 · AMARILLO · `uploads-http.test.ts` («no se confunde con el detalle») · El test no puede fallar por el orden de rutas

En Express `/:uploadId` no captura `/`, porque el parámetro tiene que tener al menos un carácter. Por eso mover la ruta no es un defecto alcanzable y este test es vacuo frente a esa mutación. En el código la ruta está registrada antes, como pide la tarea. Es informativo y no hay que hacer nada.

## Tareas candidatas (defectos reales fuera de alcance)

- Paginación o `limit` en `GET /api/uploads`: hoy no hay tope y un usuario con miles de uploads recibe la respuesta entera. La sugirió el codificador y la confirmo.
- `timestamp` con resolución de segundos (`CURRENT_TIMESTAMP`). El orden lo salva el desempate por `rowid`, pero u6 (regresión temporal) verá empates. Valorar milisegundos en una tarea con migración. La sugirió el codificador.

## Rutas de transcripciones largas

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T01/` contiene:
  - `ca2-6.txt` y `cov.txt` (suites)
  - `mut-*.txt` (mutaciones)
  - `probe.txt` y `probe-mut.txt` (sondas)
  - `zz-revisor-probe.test.ts` (la sonda, ya fuera del árbol)
  - `e2e.mjs` (script de la prueba en vivo)
  - `img/` (imagen exportada y JS extraído)
  - `own/` (mi compilación)

```
VEREDICTO: VERDE
AMARILLO|upload-repository.ts listScoresStmt|El filtro user_id de la consulta de scores no tiene test (F-01; F-02 y F-03 también son AMARILLO)
INFORME: revisiones/u5-T01/ronda-1.md
```
