# Ronda 2 — u5-T03

VEREDICTO: VERDE

F-01 queda cerrado con evidencia que comprobé yo. La segunda lectura del listado (`list-segunda.txt`, mtime 2026-11-18T20:24:01Z) salió del pod reiniciado `hv7rv`, que arrancó a las 19:13:35Z. Su contenido coincide byte a byte con la primera lectura (19:12:49Z), que es anterior al reinicio (`restartedAt` 19:13:04Z). Todos los criterios pasan con mis propias ejecuciones. No queda ningún ROJO ni NARANJA.

Comprobaciones previas:

- Tarea verificada: blob `1aaffa8d…` y sha256 `e9dfbfc9…`, ambos coinciden.
- Worktree en `75179b4`, limpio antes y después de la revisión.
- El merge-base es `b3156c6`.
- `git diff b3156c6 main -- apps/ingestion-service packages/auth-middleware` sale vacío: lo que avanzó `main` no toca este alcance.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                                                   | Comando que corrí                                                          | Resultado                                                                                                          |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Migración: convierte, idempotente, no toca nada más                        | comando CA-1                                                               | pasa (15/15, 4 tests de u5-T03)                                                                                    |
| 2   | `create` con ms; `toIsoUtc` acepta ambos formatos; basura sin Invalid Date | comando CA-2                                                               | pasa (28/28)                                                                                                       |
| 3   | Orden con el mismo día mezclado; desempate por rowid                       | comando CA-3                                                               | pasa                                                                                                               |
| 4   | Uploads consecutivos y schemas                                             | comando CA-4                                                               | pasa (66/66)                                                                                                       |
| 5   | Regresiones                                                                | suite completa `--verbose`, `tsc` de backend e ingestion, tests de backend | 206/206 en 2,76 s, 0 omitidos (194 en main + 12 nuevos); `tsc` exit 0 en los dos; backend 18/18                    |
| 6   | Cobertura de service/ y handlers/                                          | one-liner literal de CA-6                                                  | `coverage ok`. Mínimos: uploads.ts 93,61/89,47; database.ts 100/87,5; upload-repository.ts 100/100                 |
| 7   | Lint y Prettier                                                            | `turbo run lint --force` (6 tareas, 0 en caché), `prettier --check`        | pasa. Solo 1 aviso en identity, preexistente                                                                       |
| 8   | Sin dependencias nuevas, packages ni schema tocados                        | los 3 greps                                                                | pasa                                                                                                               |
| 9   | Manifiesto                                                                 | comandos de CA-9 y `kubectl get deploy`                                    | tag u5-T03, 2 líneas cambiadas, Recreate, 2 `subPath`, ambos Secrets; en vivo: `ingestion-service:u5-T03 Recreate` |
| 10  | Imagen desde main con u3-T02                                               | `merge-base --is-ancestor 2fc5fe1` y la cadena de digests de abajo         | pasa, sin reconstruir                                                                                              |
| 11  | En kind: BD antes/después, HTTP, reinicio, bearer                          | ver F-01 cerrado                                                           | **pasa**                                                                                                           |
| 12  | Sin secretos                                                               | los 2 greps y un barrido de JWT y `sk-ant` en la bitácora                  | `no secrets in diff or tree`; bitácora limpia                                                                      |
| 13  | Alcance                                                                    | comando CA-13                                                              | `scope respected`                                                                                                  |
| 14  | Commits                                                                    | `git log main..HEAD`                                                       | rama `tarea/u5-T03`, 7 commits, sin cambios desde la ronda 1                                                       |

**La imagen que corre es la del árbol:**

- `docker save ingestion-service:u5-T03` da el índice `3cc0154d…` y la config `afc3e020…`.
- En kind-control-plane, `crictl inspecti` da id `afc3e020…`, y `crictl ps` da `imageRef` `afc3e020…`.
- El imageID del pod es `import-2026-11-18@sha256:b557c19a…`.
- El `dist` sacado de la capa `dfa06220…` es idéntico a un `tsc` mío de HEAD (`diff -r` vacío sin mapas ni `.d.ts`). Contiene `strftime(...,'now')`, `NOT LIKE '%T%'` y `maxRetries: 0`.
- No hay tag `latest` en docker ni en `k8s/`.

**Mutaciones**, sobre una copia en el scratchpad; el worktree no se tocó y la copia se restauró tras cada una:

| Mutación                                                          | Resultado                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Sin migración (`SELECT 1`)                                        | 2 fallan: conversión y caso mezclado                                    |
| Sin `rowid DESC`                                                  | 3 fallan                                                                |
| `create` vuelve al DEFAULT                                        | 2 fallan, entre ellos (a)                                               |
| `create` con `%S` en lugar de `%f`                                | 2 fallan                                                                |
| Migración no idempotente (las filas que ya tienen `T` suman +1 s) | 3 fallan, entre ellos «es idempotente» y «formato nuevo no se modifica» |

**BD del pod**, abierta con `readonly:true`:

- 0 filas con formato viejo y 0 fuera del GLOB estricto o de la regex `…T..:..:..\.\d{3}Z`, sobre 26 filas en total.
- Las 3 primeras filas terminan en `.000Z`.
- `cd009f8e` (rowid 22) tiene `19:12:50.043Z` y `8c449200` (rowid 23) tiene `19:12:50.061Z`, iguales a los del listado, que va en orden inverso de inserción.
- Las filas 24 a 26 (19:34Z, otros usuarios) son posteriores a la ronda 1. Llegaron por el pod nuevo y ya están en formato de milisegundos.

## Hallazgos

### F-01 · ROJO de la ronda 1 · CA-11 · CERRADO

**Línea de tiempo**, con el reloj del host y el del nodo coincidentes (`date -u` 20:25:55Z en los dos):

- `list-primera.txt`: 19:12:49Z.
- `restartedAt` del template: 19:13:04Z (anotación del deploy, generación 18).
- Pod `ingestion-service-8546979569-hv7rv`: `startTime` y `startedAt` a las 19:13:35Z, restarts=0. Es el único pod de ingestion. Los otros 10 ReplicaSets están en 0.
- `pids.txt` del port-forward: 20:23:58Z. `list-segunda.txt`: 20:24:01Z.

Los eventos de kubectl ya caducaron (TTL de 1 h, «No resources found»). La secuencia Killing/Scaled la verifiqué en la ronda 1, y el `restartedAt` y la creación de los RS la confirman ahora. La segunda lectura se hizo 70 minutos después de que el pod nuevo arrancara, y no existía otro pod que pudiera atenderla. `diff list-primera.txt list-segunda.txt` sale vacío. Los dos port-forward (28694 y 28695) están cerrados. El PID 4456 sigue intacto.

**Bearer, mi juicio razonado.** Sin rebajar el estándar, lo doy por demostrado por tres vías independientes:

1. **Lectura real.** `kubectl logs deploy/ingestion-service | grep -ci bearer` da `0`, y lo mismo `eyJ|authorization`. El pod nuevo tiene 1 sola línea de log, la de arranque. Ese pod atendió con JWT el GET de las 20:24 (200 con los items del usuario; sin JWT sería 401) y además los 3 POST autenticados de las filas 24 a 26, a las 19:34Z. Es decir: la misma ruta POST que atendió el pod viejo, servida por la misma imagen y con logs disponibles, no dejó ni una línea. El RS viejo `5f6cfd865d` también llevaba `ingestion-service:u5-T03`, así que es el mismo código.
2. **Estructura.** En ingestion solo hay 5 puntos de log: el arranque, `[uploads] failed to store critique uploadId=…`, `low_confidence uploadId=… reason=…`, `failed to list` y `[thumbnail] failed to read blob uploadId=…`. Ninguno interpola cabeceras. `packages/auth-middleware` no tiene `console`, y el diff no añade ningún log.
3. **Pruebas.** Las pruebas de logs (`uploads-http` líneas 518 y 844, `thumbnail-http` línea 311) espían `console` y afirman que no se filtran ni secretos ni datos.

Los logs perdidos del pod viejo no cambian esta conclusión.

### F-05 · AMARILLO · `bitacoras/u5-T03.md:79-85,107` · La bitácora de la rama dice que el tramo HTTP no se ejecutó

En HEAD, la bitácora sigue afirmando que el tramo HTTP «NO se ejecutó». La línea 82 da `bearer -> 0` sobre un pod que no había atendido peticiones. La evidencia válida está solo en el scratchpad del orquestador (`list-primera.txt` y `list-segunda.txt`). No bloquea, porque la verifiqué yo y queda en este informe. Aun así, conviene añadir una nota a la bitácora antes de fusionar para que la rama no contradiga los hechos.

### F-02..F-04 · AMARILLO · sin cambios respecto a la ronda 1

Siguen como candidata C-49, sin bloquear: regex de `toIsoUtc` más permisiva que el contrato, `rmSync` fuera de un `afterEach` y el formato de `strftime` duplicado como literal.

## Tareas candidatas (defectos reales fuera de alcance)

- Las de la ronda 1 siguen en pie:
  - `npm audit` (C-46).
  - Una fila vieja que `strftime` no pueda leer haría fallar la migración por NOT NULL al arrancar el pod, que entraría en bucle de reinicios.
  - ingestion no atiende SIGTERM.
  - El filtro `u.status IS NOT NULL` del JOIN de scores no tiene test (C-42).
- Nueva: `grep -ci bearer` sobre los logs **no sirve como prueba de no filtrado** en ningún servicio que no registre las peticiones (siempre da 0). Para los CA de despliegue futuros conviene una lectura con contenido positivo: por ejemplo, contar las líneas del log por petición, o forzar una ruta que sí escriba en el log y afirmar que no incluye el token.

## Rutas de transcripciones largas

Todas están en `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/04260630-1fe3-43e8-ba70-c194d70966c8/scratchpad/rev2-u5-T03/`:

- `ing-verbose.txt`: suite completa.
- `cov.txt` y `lint.txt`.
- `pod-logs.txt`: log completo del pod nuevo, una sola línea.
- `mut-*.txt`: una por mutación.
- `img/`: tar de `docker save` y `dist` extraído.
- `copy/`: copia usada para las mutaciones.

Estado al terminar:

- El worktree está limpio (0 cambios) y HEAD sigue en `75179b4`.
- Del cluster solo hice lecturas: get, logs, `exec` en solo lectura y `crictl` de lectura. No hice `kind load`, `apply`, `rollout`, `docker build` ni port-forward.
- No toqué identity, `cred.txt`, el PID 4456, el shard ni las imágenes `identity-service:audit-check`.
- No escribí el archivo del informe porque no tengo herramientas de escritura. Le toca al orquestador guardarlo en la ruta de abajo.

```
VEREDICTO: VERDE
AMARILLO|bitacoras/u5-T03.md:79-85,107|la bitácora de la rama dice que el tramo HTTP de CA-11 no se ejecutó; falta anotar la evidencia válida (list-segunda.txt 20:24:01Z, pod hv7rv)
INFORME: revisiones/u5-T03/ronda-2.md
```
