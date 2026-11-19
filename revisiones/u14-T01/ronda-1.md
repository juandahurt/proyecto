# Ronda 1 — u14-T01

VEREDICTO: VERDE

Corrí yo los 9 CA con los comandos ya corregidos; todos pasan. Comprobé la persistencia solo con lecturas: el `.db` existía antes que el pod actual, el volumen es el PVC y los datos del codificador siguen ahí. No hay ningún ROJO ni NARANJA. Quedan tres AMARILLO, que no bloquean.

Verifiqué la tarea en main: git blob `5fd8b39b…` y sha256 `00af4601…`, los dos coinciden. El worktree `tarea/u14-T01` está en `e13076e`, base `63e4867`, y queda limpio después de mi revisión (0 líneas en `git status`). No modifiqué el cluster. Lo único que escribí fueron los datos de prueba permitidos (un usuario `rev-44ebee06@u14.test` y su onboarding).

## Criterios de aceptación, verificados por mí

| #   | Criterio                                | Comando que corrí                                                             | Resultado                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Alcance: 5 archivos                     | `git diff main...HEAD --name-only \| sort`                                    | pasa: exactamente los 5, sin el shard de audit                                                                                                                                                                                                                                                                                                                                 |
| 2   | PVC, sin emptyDir, Recreate, sin latest | bloque CA-2 tal cual                                                          | pasa: emptyDir=0/0, claimName identity-data y trust-data, Recreate, standard, RWO, replicas: 1, `u14-T01` / `u12-T01`, «sin latest»; dry-run «unchanged» (el cluster coincide con el repo)                                                                                                                                                                                     |
| 3   | bcrypt 6, tag nuevo                     | `docker run --rm` versión + `ls\|grep -c` + `find` corregidos (no hice build) | pasa: `6.0.0` (resuelve en `/app/node_modules/bcrypt`), `0`, `find` vacío; Id `sha256:f3158465…`. Sin etiqueta: 43 antes, 44 ahora, la única nueva es `41ac98dff23b`, y `99df974139d0` sigue intacta                                                                                                                                                                           |
| 4   | Despliegue por lectura de vuelta        | cadena de digests corregida                                                   | pasa: PVC Bound; 1 pod por servicio, Ready, con su claimName. La A `f3158465…` coincide en las tres: `docker image inspect`, `ctr content get` del índice `92fabb39…` (manifiesto único A) y `ctr images ls` (tag → A). crictl id `9c52354e…` solo registrado. Recreate. Trust: el índice `a1b554…` → `cc206ab9…` = `trust-service:u12-T01` (import del 16-nov, no se recargó) |
| 5   | Persistencia identity                   | lecturas + sonda propia (`rev-u14-T01/sonda.sh`)                              | pasa: `identity.db` Birth 14:30:37Z < startTime del pod 14:36:31Z. Registro de usuario nuevo 201, login 200, contraseña errónea 401. Registrar de nuevo `pvc-2019a724@u14.test` y `trust-9c279568@u14.test` da **409**, así que los usuarios del codificador siguen en la base                                                                                                 |
| 6   | Persistencia trust                      | sonda propia en 3301                                                          | pasa: `trust.db` Birth 14:30:37Z < startTime 14:37:33Z. El `-wal` tiene mtime 14:37:03, el POST del codificador justo antes de su reinicio, y sigue en el volumen. Con mi usuario: GET `completed:false`, POST incompleto 422 y sigue false, POST completo 200, GET `completed:true`, sin token 401                                                                            |
| 7   | /health y nada más se movió             | `kubectl get pods`, health en 3101/3301                                       | pasa: los dos health dan 200. ingestion `hv7rv`, progress `rjrxc` y backend `lzcxm` tienen el mismo nombre y `startTime` que en la bitácora, con RESTARTS=0 (ver AMARILLO-01 sobre 3301)                                                                                                                                                                                       |
| 8   | Regresión y auditoría                   | builds + `npm test` ×2 + audit + prettier                                     | pasa: identity 12/12 suites y 74/74 tests (3,4 s), trust 4/4 y 25/25 (1,6 s), ninguna omitida. Son suites unitarias sin estado externo, así que esos tiempos son plausibles. audit exit=0; Prettier limpio                                                                                                                                                                     |
| 9   | Sin secretos                            | bloque CA-9 tal cual                                                          | pasa: «no secrets in diff» y «no secrets in diff or tree»                                                                                                                                                                                                                                                                                                                      |

**Volumen montado:** en los dos pods, `spec.volumes` es un `persistentVolumeClaim`, no un `emptyDir`. El PV es hostPath `/var/local-path-provisioner/pvc-…_default_{identity,trust}-data`, con el directorio creado a las 14:30:37 dentro del nodo.

**Manifiestos:** no hay secretos en claro (JWT_SECRET va por `secretKeyRef`). `readinessProbe`, `resources`, etiquetas e `imagePullPolicy: Never` no cambian, y `Never` es coherente con kind. Los PVC son copia exacta del de ingestion salvo el nombre y la etiqueta `app`. El tag de identity no es `latest` ni `u10-T01`.

**Rojo previo:** sigue visible por lectura. Los RS viejos `identity-service-79b47959b9` (u10-T01) y `trust-service-bcdbcc85c` tienen `{"emptyDir":{}}`, con `creationTimestamp` igual al que anotó la bitácora.

**Ventana de corte (eventos y RS):** `restartedAt` 09:36:01 y RS nuevo 14:36:31Z; `restartedAt` 09:37:03 y RS nuevo 14:37:33Z. Son 30 s de gracia en Recreate, porque el contenedor no atiende SIGTERM, más unos 10 s de readiness. Cuadra con los ~41 s de la bitácora. El `apply` inicial también da 30 s (RS creados 14:30:33).

**Port-forwards:** solo queda el PID 4456 del humano (3300). Los dos míos los cerré, y el codificador no dejó ninguno huérfano.

## Mutaciones (copias en scratchpad, `--dry-run=client`)

Archivos: `rev-u14-T01/mutaciones.sh` y `.out`.

| Mutante              | CA que lo detecta                                                        | Comportamiento                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quitar `Recreate`    | CA-2 (falta `type: Recreate`) y CA-4 (strategy)                          | Con RWO en kind de un solo nodo el rolling update **no** se bloquea: los dos pods comparten nodo, así que habría dos escritores SQLite durante un momento. Ningún CA lo detecta por comportamiento; solo la lectura del manifiesto |
| `replicas: 2`        | CA-2 (falta la línea `replicas: 1` del deployment) y CA-4 (dos pods)     |                                                                                                                                                                                                                                    |
| `emptyDir`           | CA-2 (`emptyDir=1`, falta claimName), CA-4 (claimName vacío) y CA-5/CA-6 | El login de después daría 401                                                                                                                                                                                                      |
| `claimName` distinto | CA-2 (falta la línea)                                                    | En vivo el pod quedaría Pending y fallaría el `rollout status`                                                                                                                                                                     |
| `latest` o `u10-T01` | CA-2 (imprime la imagen y se pierde «sin latest») y CA-4 (crictl/ctr)    |                                                                                                                                                                                                                                    |
| Otra StorageClass    | CA-2 (falta la línea)                                                    | En vivo fallaría, porque el spec del PVC es inmutable                                                                                                                                                                              |

Ningún mutante sobrevive a CA-2 leído con atención. En cambio, el dry-run de cliente pasa en los siete: no discrimina nada.

## Hallazgos

### F-01 · AMARILLO · CA-7 (especificación) · el puerto 3301 está ocupado por el backend local

El PID 44123 es `node dist/index.js` de `apps/backend` (`npm run start` desde el 14-nov) y escucha en `*:3301`. Sin port-forward, `curl localhost:3301/health` responde `{"data":{"status":"ok"}…}` 200 y `/api/onboarding` da 404. Lo comprobé: con el port-forward activo, sus binds específicos (127.0.0.1 y [::1]) ganan, así que CA-6 y CA-7 sí llegaron a trust. Pero si el port-forward no llegara a arrancar, `trust-health=200` daría un falso verde. CA-6 no tiene ese problema porque `/api/onboarding` da 404 en el backend. Ni la bitácora ni la tarea lo mencionan. No es un defecto del codificador.

### F-02 · AMARILLO · bitacoras/u14-T01.md · faltan evidencias menores

- Al CA-8 le falta el resultado de Prettier (yo lo corrí y está limpio).
- El acuse cita el hash anterior al fix (`d5665a7…`). Es correcto para cuando lo leyó, pero no dice que la ronda se rigió por esa versión.
- CA-7 no registra el `startTime` de los pods intactos después del cambio (lo verifiqué yo).

### F-03 · AMARILLO · CA-2 (especificación) · el dry-run de cliente no discrimina

Con `--dry-run=client`, ninguna mutación falla, ni siquiera el cambio de StorageClass sobre un PVC inmutable. CA-2 es un grep sin aserción y depende de que alguien lea la salida. Mejora posible: aserciones con `grep -q … || echo FALLO` y `--dry-run=server`.

## Tareas candidatas (defectos reales fuera de alcance)

- **Ampliar C-48 (SIGTERM) a identity y trust.** Medido: el pod viejo agota los 30 s de gracia en cada Recreate, así que cada despliegue deja ~41 s de corte. Además SQLite nunca hace checkpoint al cerrar: `identity.db` y `trust.db` pesan 4096 B (solo cabecera) y todos los datos viven en `-wal`. Un backup futuro que copie solo el `.db` perdería todo.
- **Puerto 3301 en conflicto con el backend local** (F-01). Elegir otro puerto local para trust en las CA, o documentar ese proceso.
- **CA-2 con aserciones y `--dry-run=server`** (F-03).
- **`reclaimPolicy: Delete` en `standard`.** Ya está anotado como riesgo. Ahora afecta a tres PVC con datos (ingestion-blobs, identity-data, trust-data).

## Rutas de transcripciones largas

- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u14-T01/sonda.sh
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u14-T01/sonda-3301.out
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u14-T01/mutaciones.sh
- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u14-T01/mutaciones.out

**Auditoría de los scripts del codificador** (`cod-u14-T01/ca5.sh` y `ca6.sh`): no imprimen ni contraseña ni token (el token solo se guarda en una variable y se lee con `python3 -I`). Sí imprimen los correos `*.test`, que están permitidos, y los cuerpos de onboarding, que no contienen secretos. Cierran sus port-forwards con `kill`. Contienen `rollout restart`, por eso no los ejecuté.

No escribí el archivo del informe (no tengo herramientas de escritura): el contenido de arriba es el que va en `revisiones/u14-T01/ronda-1.md`.

```
VEREDICTO: VERDE
AMARILLO|CA-7 (especificación)|el puerto 3301 está ocupado por el backend local (PID 44123); trust-health=200 no discrimina sin port-forward
AMARILLO|bitacoras/u14-T01.md|faltan el resultado de Prettier de CA-8, la nota del hash anterior al fix y el startTime de los pods intactos después del cambio
AMARILLO|CA-2 (especificación)|el dry-run de cliente no discrimina ninguna mutación; el grep no tiene aserción
INFORME: revisiones/u14-T01/ronda-1.md
```
