# Ronda 1 — u4-T02

VEREDICTO: NO-VERDE

El código y el despliegue se sostienen: todas las sondas de firma y autorización dan el resultado correcto, y la imagen que corre en kind es la del árbol en 5a1e174. Lo que impide el VERDE es un NARANJA (F-01): 13 de los tests de CA-2 pasan aunque se borren las validaciones que dicen probar.

Comprobaciones previas:

- Tarea en main: blob `1ff72bae…` y sha256 `fe86ad7e…`, ambos coinciden.
- Worktree en `5a1e174`, rama `tarea/u4-T02`, 6 commits sobre `cb44c0d`.
- El worktree quedó limpio después de la revisión (`git status` vacío).
- Mis port-forward (PID 36383 y 36384, puertos 13200 y 13100) están cerrados. El ajeno (PID 4456, trust-service, 3300) sigue intacto.
- No toqué el cluster ni el shard `typewriter-local-*`.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                             | Comando que corrí                                                             | Resultado                                                                                                                                                                                  |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | schema + tsc                                         | build de shared-types y auth-middleware, grep, node, `tsc --noEmit`           | pasa: `thumbnailUrl solo en UploadDetailSchema`, tsc exit 0                                                                                                                                |
| 2   | módulo de firma                                      | jest `thumbnail-url`, grep `timingSafeEqual`, `! grep` de comparación directa | pasa (26/26 y `sin comparación directa de firmas`), pero ver **F-01**                                                                                                                      |
| 3   | `thumbnailUrl` solo al dueño                         | el comando de la tarea (solo `uploads-http`)                                  | pasa en sustancia: el comando muestra 1 test; los de low_confidence, exp exacto y 403/404/401 están en `thumbnail-http.test.ts` y pasan (F-02)                                             |
| 4   | 200 sin JWT, bytes idénticos y cabeceras             | jest `thumbnail`                                                              | pasa                                                                                                                                                                                       |
| 5   | 403 idéntico y espía con 0 llamadas a `findById`     | jest `thumbnail`                                                              | pasa                                                                                                                                                                                       |
| 6   | 404 (fila o blob ausente), 500, señuelo y `readBlob` | jest `(thumbnail\|blob-store)`                                                | pasa (63/63)                                                                                                                                                                               |
| 7   | clave obligatoria (31 lanza, 32 no) y 401            | jest `(uploads-http\|thumbnail\|server\|health)`                              | pasa (79/79)                                                                                                                                                                               |
| 8   | los logs no filtran                                  | jest `(uploads-http\|thumbnail)`                                              | pasa                                                                                                                                                                                       |
| 9   | regresiones                                          | suite completa de ingestion y backend                                         | pasa: 11 suites / 170 tests en 2.3 s, 0 saltados, ningún `.skip`/`.only`; backend tsc exit 0 y 18/18                                                                                       |
| 10  | cobertura                                            | `--coverage` y script de umbrales                                             | pasa: `coverage ok …` (thumbnail-url 96/92.85, thumbnail 100/100, blob-store 93.75/81.81, uploads 92.85/88.88)                                                                             |
| 11  | lint y prettier                                      | `turbo run lint --force` y `prettier --check`                                 | pasa: 6/6, 0 errores (1 warning previa de identity), Prettier limpio                                                                                                                       |
| 12  | sin dependencias nuevas                              | `git diff --name-only`                                                        | pasa: `no dependency changes`                                                                                                                                                              |
| 13  | manifiesto                                           | los 8 comandos de la tarea                                                    | pasa: tag u4-T02, `old tag absent`, `secretKeyRef ok, no optional`, `key not in configmap`, Recreate, `2`, anthropic-key presente                                                          |
| 14  | imagen                                               | `docker image inspect` y comprobación de `latest`                             | pasa parcialmente: el `docker build` me lo **denegó el clasificador de permisos** (iba a re-etiquetar la imagen). Lo sustituí por la equivalencia de contenido descrita debajo de la tabla |
| 15  | kind de punta a punta                                | solo lectura con kubectl y crictl, y sondas HTTP propias                      | pasa en todo lo verificable. El reinicio no lo repetí (prohibido por el brief); la evidencia del codificador cuadra con la cronología, ver debajo                                          |
| 16  | sin secretos                                         | los 3 comandos, versión de main                                               | pasa: `no secrets in diff or tree` y `no signing key literal`                                                                                                                              |
| 17  | alcance                                              | el comando de la tarea                                                        | pasa: `scope respected`, 13 archivos, todos permitidos                                                                                                                                     |
| 18  | rama y commits                                       | `rev-parse` y `git log`                                                       | pasa: `tarea/u4-T02`, 6 commits                                                                                                                                                            |

### CA-14: equivalencia de contenido en lugar del rebuild

- La imagen existente es `sha256:8de093a6…`, sin tag `latest`.
- Compilé el árbol en 5a1e174 con el tsconfig exacto (en el scratchpad). Los 13 `.js` de `/app/apps/ingestion-service/dist` en la imagen tienen el mismo sha256 que mi compilación, uno a uno.

### Evidencia de despliegue (Lección 11)

- El config digest es el mismo en tres sitios: `docker save` (`manifest.json` Config), `crictl inspecti` en el nodo kind y el `imageRef` del contenedor en ejecución. Los tres dan `sha256:932a545b…`. En el nodo hay una sola imagen `u4-T02`.
- Cronología:
  - build: 00:55:24Z
  - ReplicaSet rev 10 (el apply): 00:57:20Z
  - URL de la bitácora emitida: 00:58:28Z (exp − 900)
  - rev 11 (el restart): 00:59:04Z
  - último commit de código: 00:54:49Z, antes del build

  Es coherente con un único build y con que la URL se emitió antes del reinicio.

### Estado leído del cluster (solo lectura)

- Deployment: `ingestion-service:u4-T02 Recreate`.
- Variable de entorno: `thumbnail-signing-key/signing-key`, `optional` vacío.
- ConfigMap: `0` apariciones de `THUMBNAIL_SIGNING_KEY`.
- Secret: `signing-key: 64 bytes` vía `kubectl describe`. Nunca leí ni decodifiqué el valor.
- Logs del pod: 0 líneas con `sig=` y 0 con `exp=` o `thumbnail?`.

### Sondas propias en kind

Port-forward propio en 13200/13100. Registré dos usuarios con emails `rev-u4t02-<uuid>@example.test` (201/201). El POST de A, un JPEG de 3000 bytes con nombre de cliente `../../evil name.jpg`, dio 202 ready.

- Detalle de A: 200, `exp − now = 900`.
- La miniatura sin JWT da 200 `image/jpeg` con `nosniff` y `private, no-store`, y los bytes son idénticos (`Buffer.equals`). HEAD también da 200.
- **403 con el body idéntico byte a byte** en todos estos casos:
  - uploadId de B con exp/sig de A
  - uploadId de A en mayúsculas
  - `exp` con cero a la izquierda, con `+`, con espacio, o enorme
  - `exp=…&exp=…` y `sig=…&sig=…` duplicados (llegan como array y se tratan como cadena vacía)
  - `exp[]=` y `sig[x]=`
  - sig de 65 caracteres y sig vacía
  - sig alterada y exp alterado
  - `..%2f..%2fetc%2fpasswd` como uploadId
  - uploadId inexistente con la sig de A (se rechaza en la firma y no llega a la BD: no hay 404)
- B pide el detalle de A: 403 `{"data":null,"error":"Forbidden","status":403}`, sin thumbnail/sig/exp.
- Sin JWT, todo da 401 `unauthenticated`: el detalle, el POST, `/thumbnailx`, `/thumbnail/x`, `/api/uploads`, `/<id>/categories`, `/x/y`, y también POST y DELETE sobre la URL de miniatura. **Solo `GET /:id/thumbnail` es público.**
- Script: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/e2e/probe.mjs`

### Lectura del código

- `verify`, en este orden:
  1. UUID
  2. `exp` solo dígitos
  3. `sig` de 64 hex
  4. `exp` entero seguro y mayor que 0
  5. comprobación de longitud
  6. `timingSafeEqual`
  7. `floor(now/1000) < exp`

  La frontera es correcta (en el segundo `exp` ya no vale), y el `try/catch` hace que nunca lance.

- El handler verifica la firma antes de `findById`. Distingue ENOENT (404) de cualquier otro error (500), y en el log de 500 solo va `uploadId`.
- `readBlob` rechaza nombres vacíos, con `..`, con `/` o `\`, y los que cumplen `basename ≠ x`; además exige `dirname(resolve) === BLOB_DIR`.
- La ruta de miniatura se registra antes de `requireAuth`.
- `createApp` lanza si la clave tiene menos de 32 caracteres, también con `''`.

## Hallazgos

### F-01 · NARANJA · apps/ingestion-service/src/\_\_tests\_\_/thumbnail-url.test.ts (`exp inválido` ×9, `uploadId no UUID` ×4) · Tests que pasan sin probar la propiedad que nombran

Los casos de `exp` y `uploadId` mal formados reutilizan la `sig` de `base`, firmada sobre el `exp`/`uploadId` correctos. Por eso devuelven `false` por discrepancia de firma, no por la validación de formato.

Mutación, en una copia en el scratchpad:

- Borré las líneas `UUID_RE.test(uploadId)`, `EXP_RE.test(exp)` y `expNum <= 0` de `thumbnail-url.ts`.
- Corrí el test del codificador contra esa copia: **26 passed, 26 total**.

Sin esas líneas, `exp=' 1700000900'` firmado de verdad sería aceptado (`Number(' …')` lo convierte). Mi sonda contra el código real, con HMAC calculado sobre la cadena rara, lo rechaza correctamente, así que **el código está bien y es la prueba la que está hueca**. CA-2 exige estos casos como tests con nombre.

Arreglo: en los `it.each` de `exp` y `uploadId` inválidos, pasar `sig = HMAC(KEY, 'thumbnail:<id>:<exp raro>')`, de modo que solo la validación de formato pueda rechazar.

Barrido de la clase: los casos HTTP `uploadId no UUID` usan `sig='a'×64`, pero ahí la propiedad afirmada (403 sin consultar la BD) se cumple igual, así que no cuentan. Los casos `sig corta/larga/no hex` quedan cubiertos por la comprobación de longitud.

Rutas de la mutación:

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/mut/`
- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/probe/verify-probe.ts`

### F-02 · AMARILLO · CA-3 (comando) · El comando solo corre `uploads-http`

Con ese comando sale un único test (ready con URL). Los tests de low_confidence, `exp` exacto y 403/404/401 sin URL viven en `thumbnail-http.test.ts`, que el comando no corre; los ejecuté aparte y pasan. Es un desajuste entre la especificación y el sitio donde están los tests, no un defecto del código.

### F-03 · AMARILLO · thumbnail-url.ts:7 (`SIG_RE /i`), :6 (`UUID_RE /i`) · Firma maleable en mayúsculas

La sig en mayúsculas da 200 en kind. No es explotable (hace falta la firma válida) y la especificación dice "64 hex", pero hay dos codificaciones válidas para la misma URL. Basta con aceptar solo minúsculas.

### F-04 · AMARILLO · commits 8198752, 4285d67 y 50aacd0 · Código moldeado para pasar los grep

El helper `isStr` evita el `! grep` de CA-2, y el renombre `JWT_SECRET → TEST_JWT_VALUE` evita el regex de CA-16. En los dos casos el contenido es inocuo: un `typeof` y un valor de prueba evidente. Aun así, enseña que esos CAs se esquivan por nombre (ver candidatas). Además, 8198752 mete `deployment.yaml` bajo un mensaje que no lo menciona (A-1, ya reconocido).

## Tareas candidatas (defectos reales fuera de alcance)

- El barrido de secretos de CA-16 depende del nombre de la variable y se esquiva renombrando. Conviene un escáner por valor (gitleaks/trufflehog) en CI.
- El comando de CA-15 `kubectl get secret … jsonpath | wc -c` pasa el valor por una tubería. Es mejor `kubectl describe secret`, que da la longitud sin mostrar el valor.
- Defensa en profundidad en `verify`: rechazar `exp > now + TTL`. Hoy un `exp` enorme firmado se acepta; solo es posible con la clave, así que no es explotable.

## Rutas de transcripciones largas

- Sondas e2e: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/e2e/probe.mjs`
- Sumas de dist (árbol frente a imagen): `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/8cd6ef3d-9d56-4060-858b-2acbc029d114/scratchpad/tree.sums` e `image.sums`

Nota para el orquestador: no tengo herramientas de escritura, así que este texto es el informe; guárdalo en `revisiones/u4-T02/ronda-1.md`. Hay dos partes que no pude ejecutar yo:

- El `docker build` de CA-14, por la denegación del clasificador. Lo sustituí por la equivalencia de contenido.
- El reinicio de CA-15, prohibido por el brief. Lo sostiene solo la cronología del cluster.

```
VEREDICTO: NO-VERDE
NARANJA|apps/ingestion-service/src/__tests__/thumbnail-url.test.ts (exp inválido / uploadId no UUID)|13 tests de CA-2 pasan con las validaciones de formato borradas (mutación sobrevive)
INFORME: revisiones/u4-T02/ronda-1.md
```
