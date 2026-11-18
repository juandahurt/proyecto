# Ronda 1 — u5-T03

VEREDICTO: NO-VERDE

El código está bien: ejecuté todos los criterios y todas las mutaciones que pediste, y pasan. El único bloqueo es CA-11. La segunda lectura del listado se tomó contra el pod viejo mientras este se apagaba, no después del reinicio. La causa es la evidencia, no el diff, y se arregla volviendo a capturarla.

Tarea verificada: blob `1aaffa8d…` y sha256 `e9dfbfc9…`, ambos coinciden. Worktree en `75179b4`, rama `tarea/u5-T03`. El merge-base es `b3156c6`. Que `main` haya avanzado hasta `2c84184` no afecta a este alcance.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                                              | Comando que corrí                                                              | Resultado                                                                                       |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Migración: convierte, conserva el instante, idempotente, no toca nada más             | comando CA-1                                                                   | pasa (4 tests de u5-T03; 15/15 en total)                                                        |
| 2   | `create` con ms explícitos; `toIsoUtc` acepta ambos formatos; basura sin Invalid Date | comando CA-2                                                                   | pasa (28/28)                                                                                    |
| 3   | Orden con el mismo día mezclado, y desempate por rowid                                | comando CA-3                                                                   | pasa                                                                                            |
| 4   | Uploads consecutivos, schemas de detalle y listado                                    | comando CA-4                                                                   | pasa (66/66). Afirma `>=`, que la tarea permite                                                 |
| 5   | Regresiones                                                                           | ingestion `--verbose`, `tsc` de backend e ingestion, tests de backend          | pasa: 206/206 en 2,6 s, 0 omitidos; `tsc` exit 0; backend 18/18                                 |
| 6   | Cobertura de service/ y handlers/                                                     | one-liner literal de CA-6                                                      | `coverage ok`. Mínimos: uploads.ts 93,61/89,47; database.ts 100/87,5; upload-repository 100/100 |
| 7   | Lint y Prettier                                                                       | `turbo run lint --force` (exit 0, 0 en caché), `prettier --check`              | pasa. Solo 1 aviso en identity, preexistente                                                    |
| 8   | Sin dependencias nuevas, sin tocar packages ni schema                                 | los 3 greps de CA-8                                                            | pasa                                                                                            |
| 9   | Manifiesto                                                                            | comandos de CA-9                                                               | pasa: tag u5-T03, 2 líneas cambiadas, Recreate, 2 `subPath`, ambos Secrets                      |
| 10  | Imagen construida desde main con u3-T02                                               | `merge-base --is-ancestor 2fc5fe1` y la cadena de digests de abajo             | pasa (sin reconstruir: lo prohíbe el límite)                                                    |
| 11  | En kind: antes/después en BD, HTTP, reinicio, bearer                                  | lectura de BD en solo lectura con `kubectl exec`, eventos, ficheros del humano | **falla en parte** (F-01)                                                                       |
| 12  | Sin secretos                                                                          | los 2 greps de CA-12, con el árbol excluyendo bitacoras/ y revisiones/         | `no secrets in diff or tree`                                                                    |
| 13  | Alcance                                                                               | comando CA-13                                                                  | `scope respected`                                                                               |
| 14  | Commits                                                                               | log y `show --name-only` de cada commit                                        | pasa: 7 commits, cada uno toca solo los archivos que nombra su mensaje                          |

**Imagen que corre == árbol (Lección 11):**

- `docker save ingestion-service:u5-T03` da config `sha256:afc3e020…`.
- `crictl inspecti` en kind-control-plane da id `afc3e020…`.
- El imageID del pod es `import-2026-11-18@sha256:b557c19a…`, un índice cuyo manifiesto es `3cc0154d…`, que apunta a la config `afc3e020…`. Coincide con `crictl inspect` del contenedor.
- La capa `dist` extraída del tar es idéntica a un `npm run build` fresco de HEAD (diff -r vacío sin mapas). Contiene el `strftime(...,'now')`, el `NOT LIKE '%T%'` y `maxRetries: 0`.
- No existe tag `latest` en docker ni en `k8s/`.

**Mutaciones propias**, sobre una copia en el scratchpad; el worktree no se tocó:

| Mutación                                              | Resultado                            |
| ----------------------------------------------------- | ------------------------------------ |
| Sin migración (`SELECT 1`)                            | 2 fallan: conversión y caso mezclado |
| Sin `rowid DESC`                                      | 3 fallan                             |
| `rowid ASC`                                           | 3 fallan                             |
| Sin `status IS NOT NULL` en headers                   | 1 falla                              |
| `create` vuelve al DEFAULT                            | 2 fallan, entre ellos (a)            |
| `create` con `%S` en lugar de `%f`                    | 2 fallan                             |
| Migración no idempotente (segunda apertura suma +1 s) | falla «es idempotente»               |
| Migración que también escribe `status`                | 2 fallan                             |
| Migración que también escribe `confidence`            | 1 falla                              |
| `DELETE category_critiques`                           | 1 falla: «no toca»                   |
| Migración con `%S`                                    | 2 fallan                             |
| `toIsoUtc` con la lógica vieja                        | 33 fallan                            |
| `toIsoUtc` sin ms                                     | 1 falla                              |
| `toIsoUtc` solo con `T`                               | 5 fallan                             |
| Basura devuelve `'Invalid Date'`                      | 1 falla                              |
| Basura lanza RangeError                               | 1 falla                              |

Sobreviven dos:

- Quitar el WHERE de la migración. Es lo esperado: la ronda 1 lo retiró de CA-1.
- Quitar `u.status IS NOT NULL` del JOIN de scores. Es código de u5-T01, fuera de alcance; va como candidata.

El «rojo primero» se reproduce: los tests de `0bdac77` contra el código base `b3156c6` dan 6 fallos por aserción y 37 en verde. Coincide con la bitácora.

**npm audit --audit-level=high:** exit 1, con `tar` critical y `@mapbox/node-pre-gyp` high, ambas transitivas. El diff no toca `package*.json`, así que lo mismo pasa en `main`. No es hallazgo de este diff, pero la regla de `project.md` («NEVER merge si npm audit high falla») bloquea cualquier merge del repo. Va como candidata.

## Hallazgos

### F-01 · ROJO · CA-11 (tramo HTTP tras el reinicio y bearer) · La segunda lectura no salió del pod reiniciado

Línea de tiempo, con el reloj del host y del nodo verificados y coincidentes (`date -u` en ambos):

- `list-primera.txt`, mtime 19:12:49Z.
- `restartedAt` 19:13:04Z. Eventos: `Killing ingestion-service-5f6cfd865d-btxk5` y `Scaled down 5f6cfd865d`, ambos a las 19:13:04Z.
- **`list-segunda.txt`, mtime 19:13:19Z.**
- `Scaled up 8546979569` y `startTime` del pod `hv7rv` a las 19:13:35Z; Ready a las 19:13:46Z. El `terminationGracePeriodSeconds` es 30.

La segunda lectura se sirvió desde el pod viejo durante su apagado, 16 s antes de que existiera el pod nuevo. `e2e.sh segunda` no espera a que termine el `rollout status`. Por tanto, el diff vacío entre las dos lecturas no demuestra «idéntico tras el rollout restart».

El `grep -ci bearer = 0` tampoco prueba nada: el pod actual tiene 1 línea de log y nunca atendió los POST/GET con JWT. Los logs del pod que sí los atendió ya no existen.

Lo que sí verifiqué yo, sobre el pod reiniciado (BD en `readonly:true`):

- 0 filas con formato viejo, 0 filas fuera del GLOB estricto `…T..:..:..\.\d{3}Z`, total 23.
- Las 3 primeras filas en `.000Z`.
- `cd009f8e` → `19:12:50.043Z` y `8c449200` → `19:12:50.061Z`, iguales a los del listado. El orden por rowid es el inverso del listado.

La idempotencia de la migración sobre datos reales queda demostrada a nivel de BD. El tramo HTTP posterior al reinicio no lo puedo verificar: hace falta login en identity y no tengo autorización. No lo esquivé.

**Para cerrarlo:** repetir `e2e.sh segunda` _después_ de que `kubectl rollout status` termine, comprobar que el pod que responde es el nuevo, y hacer el `grep bearer` sobre los logs del pod que atendió los POST antes de reiniciarlo.

### F-02 · AMARILLO · `upload-repository.ts` (`toIsoUtc`) · La regex acepta más de lo especificado

`/^(…)[ T](…)(?:\.(\d{3}))?Z?$/` también acepta formas híbridas: `2026-11-18T02:33:19` sin `Z`, o `2026-11-18 02:33:19.123Z`. No rompe nada y nunca da Invalid Date, pero el contrato decía «ambos formatos».

### F-03 · AMARILLO · `upload-repository.test.ts` (caso mezclado) · El directorio temporal no se limpia si la aserción falla

`fs.rmSync` está al final del `it` en lugar de en un `afterEach`.

### F-04 · AMARILLO · `database.ts` y `upload-repository.ts` · El formato `'%Y-%m-%dT%H:%M:%fZ'` está duplicado

Aparece como literal en dos archivos. La especificación lo dicta, así que no es NARANJA. Una constante compartida evitaría que una regresión escriba un formato y migre a otro.

## Tareas candidatas (defectos reales fuera de alcance)

- **npm audit high/critical en main** (`tar` y `@mapbox/node-pre-gyp`, transitivas). Bloquea el gate de merge de `project.md` para todo el repo.
- **Defecto de especificación en la migración prescrita.** Si una fila vieja no es parseable por `strftime`, el `UPDATE` asigna NULL y viola el NOT NULL. `createDatabase` lanza al arrancar y el pod entra en crashloop. Lo comprobé en `:memory:`: «NOT NULL constraint failed». La transacción revierte bien. Hoy no ocurre, porque todas las filas vienen de `CURRENT_TIMESTAMP`.
- **ingestion no atiende SIGTERM.** Agota los 30 s de gracia y sigue respondiendo durante el apagado, que fue lo que permitió F-01. Con `Recreate` son unos 30 s de caída extra por despliegue.
- **El filtro `u.status IS NOT NULL` del JOIN de scores en `listByUser` es redundante o no tiene test** (mutación sobreviviente). Encaja en C-42.

## Rutas de transcripciones largas

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/04260630-1fe3-43e8-ba70-c194d70966c8/scratchpad/rev-u5-T03/ing-verbose.txt` (suite completa)
- `…/rev-u5-T03/mut-*.txt` (una por mutación) y `…/rev-u5-T03/rojo.txt` (rojo reproducido)
- `…/rev-u5-T03/img/` (tar de `docker save` y `dist` extraído); la copia mutada está en `…/rev-u5-T03/copy/`

Estado del worktree al terminar: limpio. Solo hay cachés ignorados (`coverage/`, `.turbo/`, `dist/` de packages). HEAD sigue en `75179b4`. No modifiqué el cluster (solo get, logs, events, `exec` de lectura en solo lectura y `crictl`/`ctr` de lectura). No toqué el PID 4456, el shard de audit ni `cred.txt`, que no leí.

```
VEREDICTO: NO-VERDE
ROJO|CA-11 (tramo HTTP tras rollout restart y grep bearer)|list-segunda.txt (19:13:19Z) servido por el pod viejo en apagado antes del pod nuevo (19:13:35Z); bearer=0 sobre un pod que no atendió las peticiones
INFORME: revisiones/u5-T03/ronda-1.md
```
