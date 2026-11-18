# Ronda 2 — u4-T02

VEREDICTO: VERDE

Los cuatro hallazgos de la ronda 1 están cerrados y los comprobé ejecutando yo, no leyendo. Corrí CA-1..CA-18 desde la raíz del worktree y todos pasan, con dos excepciones que no pude ejecutar tal cual: CA-14 (no reconstruí la imagen) y la parte del reinicio de CA-15 (el brief prohíbe tocar el cluster). Las cubrí con evidencia equivalente, descrita en la tabla. No queda ningún ROJO ni NARANJA. Solo queda un AMARILLO nuevo (F-05), que no bloquea.

**Comprobaciones previas**

- Tarea en main: blob `480778e8…` y sha256 `0fc91694…`, ambos coinciden.
- Worktree en `f2b86ec`, rama `tarea/u4-T02`, base `cb44c0d`.
- Main avanzó hasta `b8017a4`, pero solo en `CANDIDATAS.md`, `revisiones/` y `tareas/`, que la rama no toca. No hay conflicto.
- Al terminar, el worktree está limpio (`git status` vacío).
- Mis port-forward (PID 41283 y 41281, puertos 13200 y 13100) están cerrados. El ajeno (PID 4456) sigue intacto.
- No modifiqué el cluster. El shard `typewriter-local-*` sigue con la modificación que ya tenía al empezar.

## Criterios de aceptación, verificados por mí

| #   | Criterio                               | Comando que corrí                                                        | Resultado                                                                                                                                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | schema y tsc                           | build de shared-types y auth-middleware, grep, `node -e`, `tsc --noEmit` | pasa: `thumbnailUrl solo en UploadDetailSchema`, build y tsc con exit 0                                                                                                         |
| 2   | módulo de firma                        | jest `thumbnail-url`, grep, `! grep`                                     | pasa: 32/32, `timingSafeEqual` en la línea 50, `sin comparación directa de firmas`                                                                                              |
| 3   | URL solo para el dueño                 | el comando vigente `(uploads-http\|thumbnail)`                           | pasa: 84/84. Incluye ready con `exp = reloj + 900`, low_confidence, y 403/404/401 sin URL                                                                                       |
| 4   | 200 sin JWT, bytes y cabeceras         | jest `thumbnail`                                                         | pasa                                                                                                                                                                            |
| 5   | 403 idéntico y 0 llamadas a `findById` | jest `thumbnail`                                                         | pasa, ahora también con la sig en mayúsculas                                                                                                                                    |
| 6   | 404, 500, señuelo y `readBlob`         | jest `(thumbnail\|blob-store)`                                           | pasa: 70/70                                                                                                                                                                     |
| 7   | clave obligatoria y 401                | jest `(uploads-http\|thumbnail\|server\|health)`                         | pasa: 86/86                                                                                                                                                                     |
| 8   | los logs no filtran                    | jest `(uploads-http\|thumbnail)`                                         | pasa                                                                                                                                                                            |
| 9   | regresiones                            | suite completa de ingestion y backend                                    | pasa: 11 suites / 177 tests en 2,3 s con SQLite en memoria, ningún `.skip`/`.only`/`.todo`. Backend: tsc exit 0 y 18/18                                                         |
| 10  | cobertura                              | `--coverage` y script de umbrales                                        | pasa: `coverage ok …`. Líneas/ramas: thumbnail.ts 100/100, thumbnail-url.ts 96/92,85, blob-store.ts 93,75/81,81, uploads.ts 92,85/88,88                                         |
| 11  | lint y prettier                        | `turbo run lint --force`, `prettier --check`                             | pasa: 6/6 tareas, 0 errores (1 warning previa en identity). Prettier limpio, también sobre la tarea de main                                                                     |
| 12  | sin dependencias nuevas                | `git diff --name-only`                                                   | pasa: `no dependency changes`                                                                                                                                                   |
| 13  | manifiesto                             | los 8 comandos                                                           | pasa: tag `u4-T02`, `old tag absent`, `secretKeyRef ok, no optional`, `key not in configmap`, `Recreate`, conteo `2`, `anthropic-key` presente                                  |
| 14  | imagen                                 | `docker image inspect`, comprobación de `latest`                         | pasa por equivalencia de contenido; no reconstruí la imagen para no re-etiquetarla. Imagen `sha256:5f980849…` (la que reportó el codificador), sin tag `latest`. Detalle debajo |
| 15  | kind de punta a punta                  | solo lectura con kubectl y crictl, y sondas HTTP propias                 | pasa en todo lo que puedo verificar. El reinicio no lo repetí (prohibido); la cronología cuadra, detalle debajo                                                                 |
| 16  | sin secretos (versión de main)         | los 3 comandos                                                           | pasa: `no secrets in diff or tree`, `no signing key literal`                                                                                                                    |
| 17  | alcance                                | el comando de la tarea                                                   | pasa: `scope respected` (13 archivos, todos permitidos)                                                                                                                         |
| 18  | rama y commits                         | `rev-parse`, `git log`                                                   | pasa: `tarea/u4-T02`, 9 commits                                                                                                                                                 |

### Evidencia de despliegue (Lección 11)

- **Imagen que corre.** El config digest `sha256:6640daf8…` es el mismo en tres sitios: el `Config` de `docker save`, el `id` de `crictl inspecti` en el nodo, y el `imageId` del contenedor en ejecución `e62f4c39…`. El `imageRef` es `import-2026-11-18@sha256:1617ebb2…`. El Id de docker, `5f980849…`, es el índice de containerd, distinto del config digest, y coincide con lo que reportó el codificador.
- **Contenido.** Compilé el árbol en f2b86ec con su tsconfig, con la salida en el scratchpad. Los 13 `.js` del `dist` de la imagen, extraídos de la capa `3ed17ed8…`, tienen el mismo sha256 que mi compilación, uno a uno. En la imagen, `SIG_RE = /^[0-9a-f]{64}$/`.
- **Cronología.**
  - commit de código 2d7e837: 01:17:06Z
  - build de la imagen: 01:17:30Z
  - ReplicaSet rev 12: 01:19:41Z
  - ReplicaSet rev 13: 01:21:25Z, el pod actual, con 0 reinicios

  Es coherente con load → restart → restart de CA-15.

- **Estado leído del cluster.**
  - Secret `thumbnail-signing-key`: `signing-key: 64 bytes`, vía `kubectl describe`. Nunca leí ni decodifiqué el valor.
  - Variable de entorno: `thumbnail-signing-key/signing-key`, `optional` vacío.
  - ConfigMap: 0 apariciones de `THUMBNAIL_SIGNING_KEY`.
  - Logs del pod después de mis sondas: 0 líneas con `sig=`, 0 con `exp=`, 0 con `thumbnail?`.

### Sondas propias en kind (13200 y 13100, emails únicos)

- Registro de los dos usuarios: 201/201. POST de A: 202 ready.
- Detalle de A: 200, `exp − now = 900`.
- Miniatura sin JWT: 200 `image/jpeg`, `nosniff`, `private, no-store`, bytes idénticos. HEAD también da 200.
- **403 con el body idéntico byte a byte** en todos estos casos:
  - sig en MAYÚSCULAS (en la ronda 1 daba 200)
  - uploadId de B con exp/sig de A
  - uploadId en mayúsculas
  - `exp` con 0 a la izquierda, con `+`, con espacio, o enorme
  - `exp` o `sig` duplicados, `exp[]=`, `sig[x]=`
  - sig de 65 caracteres y sig vacía
  - sig alterada y exp alterado
  - traversal `..%2f`
  - uploadId inexistente
- B pide el detalle de A: 403, sin thumbnail/sig/exp.
- Sin JWT, todo da 401 `unauthenticated`: el detalle, el POST, `/thumbnailx`, `/thumbnail/x`, `/api/uploads`, `/categories`, `/x/y`, y también POST y DELETE sobre la URL de miniatura. Solo `GET /:id/thumbnail` es público.

## Estado de los hallazgos de la ronda 1

- **F-01 · RESUELTO.**
  - Mutación completa: quité `UUID_RE.test`, `EXP_RE.test` y `expNum <= 0`. Contra los tests de HEAD, **11 failed / 21 passed**.
  - Mutaciones de una sola línea:
    - sin UUID_RE: 6 fallos
    - sin EXP_RE: 5 fallos
    - sin `expNum <= 0`: sobrevive. Es un mutante equivalente: tras `EXP_RE`, solo llega `'0'` y la expiración lo rechaza con cualquier reloj ≥ 0.
  - Los casos de formato usan `signedFor(id, exp)`, el HMAC real de la cadena rara. El test de «sanidad» prueba que esa firma coincide con la del módulo.
  - **Barrido HTTP y blob-store**: corrí 7 mutantes de la suite completa (177 tests) sobre una copia de `src`:
    - verify en mayúsculas (`/i`): 2 fallos, el unitario y el HTTP
    - `findById` antes de verify: 11 fallos
    - sin la rama ENOENT: 1 fallo
    - miniatura detrás de `requireAuth`: 14 fallos
    - `readBlob` sin ninguna defensa: 9 fallos
    - `readBlob` sin el chequeo de nombre: 2 fallos (el chequeo de `dirname` cubre el resto)
    - `readBlob` sin el chequeo de `dirname`: sobrevive, porque es redundante con el chequeo de nombre (`'.'` da 500 en los dos casos)

    No encontré tests huecos en `thumbnail-http`, `blob-store` ni `uploads-http`.

- **F-02 · RESUELTO.** El comando vigente de CA-3 corre `thumbnail-http.test.ts` (3 suites, 84 tests).
- **F-03 · RESUELTO.** En el código, `SIG_RE` no lleva `/i` y se quitó el `toLowerCase()`. La sig en mayúsculas da 403 en el test unitario, en el HTTP (0 llamadas a `findById`) y en mi sonda en kind.
- **F-04 · CERRADO.** Cada commit nuevo toca solo lo que dice su mensaje: 2d7e837 solo `thumbnail-url.ts`, 276e02a solo los dos tests, f2b86ec solo la bitácora. Lo de `isStr` y el renombre de la constante ya está registrado como candidata en main.

## Hallazgos

### F-05 · AMARILLO · thumbnail-url.test.ts (filas `exp` `"-5"`, `"1e9"`, `""`, `"0"`, `"abc"`, `"1700000900.5"`) · Seis filas sobreviven a la mutación de formato

Con la mutación completa, estas filas siguen pasando: las rechazan la expiración o `isSafeInteger`, no la validación de formato. Por qué no bloquea:

- La clase está cubierta por las otras filas que sí mueren (`17000009e2`, `1.7000009e9`, los espacios, `+`).
- Para `-5`, `0` y `''`, aislar la validación de formato exigiría un reloj negativo.
- La bitácora lo declara.

Solo `"1e9"`, que la CA nombra expresamente, podría hacerse significativa con `nowMs` anterior a 1e9 s.

## Tareas candidatas (defectos reales fuera de alcance)

- `readBlob`: el chequeo `dirname === BLOB_DIR` es redundante con el chequeo de nombre (su mutante sobrevive). Conviene documentarlo como defensa en profundidad o cubrirlo con un test de `'.'`.
- Proceso del bucle: en el scratchpad de esta sesión aparecieron archivos de otro agente (`thumbnail-url.fixed.ts`, `mut.ts`, `pf-*.pid`, entre 20:16 y 20:21). Si codificador y revisor comparten scratchpad, se puede contaminar la evidencia. Conviene aislarlos.

## Rutas de transcripciones largas

- Mutantes: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/mut2/` (unitarios) y `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/mut3/` (suite completa, A..G)
- Sumas de dist: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/r2img/tree.sums` y `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/r2img/image.sums`
- Sondas: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/e2e/probe.mjs`

Nota para el orquestador: no tengo herramientas de escritura, así que este texto es el informe; guárdalo en `revisiones/u4-T02/ronda-2.md`.

```
VEREDICTO: VERDE
AMARILLO|apps/ingestion-service/src/__tests__/thumbnail-url.test.ts (filas exp -5/1e9/''/0/abc/.5)|6 filas sobreviven a la mutación de formato (las rechaza la expiración o isSafeInteger); la clase está cubierta por otras filas
INFORME: revisiones/u4-T02/ronda-2.md
```
