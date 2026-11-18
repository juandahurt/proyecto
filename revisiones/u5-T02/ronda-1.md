# Ronda 1 — u5-T02

VEREDICTO: NO-VERDE

Base: worktree `/Users/aureliano/Desktop/proyecto-u5-T02`, rama `tarea/u5-T02` @ `430d584`, diff `main...HEAD`. Los CA se corrieron con los comandos del archivo de la tarea de main (blob `fd5f28f1…`, sha256 `8fef4068…`; comprobé los dos hashes). Antes de correrlos hice `npm ci` y compilé shared-types y auth-middleware. Node del host: v26; la imagen usa Node v20.20.2.

## Criterios de aceptación (los corrí yo)

| #   | Criterio                                             | Comando que corrí                                                                                 | Resultado                                                                                                    |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Workspace, tsc, reutiliza UploadListSchema           | los 4 comandos de CA-1 (tsc sin tail: exit 0)                                                     | pasa                                                                                                         |
| 2   | 200, mismos items, mismo orden                       | grep de CA-2; suite completa con 34 tests verdes en 1,7 s                                         | pasa                                                                                                         |
| 3   | Authorization tal cual, sin query ni otras cabeceras | grep de CA-3 + mutaciones b/c                                                                     | pasa                                                                                                         |
| 4   | 401 sin JWT, mal firmado o expirado, y 0 peticiones  | grep de CA-4 + mutación d                                                                         | pasa                                                                                                         |
| 5   | Mapeo de errores aguas arriba                        | grep de CA-5 + mutaciones e/f + sonda P1                                                          | **falla** en «item con campo de más» (F-01)                                                                  |
| 6   | Errores sin excepciones; logs sin datos              | grep de CA-6 + mutaciones g                                                                       | pasa en los casos probados; hay un hueco (F-03)                                                              |
| 7   | INGESTION_URL obligatoria                            | grep de CA-7 + mutaciones h2/h3                                                                   | pasa                                                                                                         |
| 8   | Cobertura ≥80/75                                     | comando de CA-8                                                                                   | pasa (client 100/92,3; handlers 100/100)                                                                     |
| 9   | Sin paquetes nuevos de registro                      | los 3 comandos de CA-9 (versión de main)                                                          | pasa (0 URLs de registro añadidas; jsonwebtoken y @types/jsonwebtoken con las mismas versiones que identity) |
| 10  | lint, build y prettier                               | `turbo lint --force` (7 tareas, incluida progress-service), build (3 tareas), prettier            | pasa                                                                                                         |
| 11  | Regresiones                                          | ingestion 194, identity 72, trust 25, backend 18                                                  | pasa                                                                                                         |
| 12  | Manifiestos                                          | los 8 comandos de CA-12                                                                           | pasa                                                                                                         |
| 13  | Imagen y smoke                                       | inspect, «no latest tag», `docker run` con secreto desechable → `/health 200`, contenedor borrado | pasa. No hice `docker build` (me lo prohíben los límites); verifiqué la imagen por su contenido              |
| 14  | kind de punta a punta                                | solo lectura, más E2E propio (ver abajo)                                                          | pasa                                                                                                         |
| 15  | Sin secretos                                         | comandos de CA-15                                                                                 | pasa                                                                                                         |
| 16  | Alcance                                              | comando de CA-16                                                                                  | pasa                                                                                                         |
| 17  | ≥3 commits legibles                                  | rev-list + `show --name-only` por commit                                                          | pasa (3 commits; cada uno contiene solo los archivos de su mensaje)                                          |

**CA-14, cadena de evidencia del despliegue:**

- El config digest de `docker save` es `sha256:239be03b…`. Coincide con el id que da `crictl inspecti` en kind-control-plane y con el `imageRef` del contenedor en ejecución.
- El `imageID` del pod es `import-2026-11-18@sha256:92538739…`, igual que el repoDigest del nodo.
- Los 5 `.js` de `dist` de la imagen son byte a byte iguales a una compilación mía de HEAD.
- `src` no cambia entre 426a270 y 430d584.

**E2E propio** (port-forwards míos a 3400, 3200 y 3100; emails únicos `*.test`):

- Health de los tres servicios: 200.
- Usuario A con 2 uploads: `items idénticos: true n=2 desc: true`.
- Usuario B: 200 con 1 item, idéntico al de ingestion. Con `?userId=<A>` sigue devolviendo 200 y solo su item; ningún id de A aparece.
- Sin token y con token basura: 401. `/health`: 200.
- En los logs del pod: 0 líneas con `bearer` y 0 con ids (el log tiene 1 sola línea).
- Port-forwards cerrados; el PID 4456 no se tocó. Ingestion no se reinició durante la prueba.

## Hallazgos

### F-01 · ROJO · CA-5 / Plan de pruebas · un item con un campo de más no da 502 y no hay test

CA-5 pide 502 `Bad upstream response` para un «item con campo de más/menos». El plan promete el caso «item con campo de más/menos» partiendo de una respuesta válida. Hay tests para el campo que falta (`timestamp`) y para un valor fuera de enum, pero **no para el campo de más**.

Lo probé con una sonda P1: un item válido más `userId: "u-interno-xyz"` devuelve **200** y el campo desaparece (`UploadListItemSchema` es un `z.object` no estricto y lo descarta). Con un campo de más en el envoltorio (P2) también da 200.

Es en parte una contradicción de la especificación: pide «`UploadListSchema.safeParse`, no se redefine» y a la vez 502 por campo de más. El codificador no la anotó con «atención». Hay dos salidas, y la decide el orquestador:

- (a) Fijar en la especificación que el campo de más se descarta (es más seguro: no deja pasar campos internos) y exigir un test que lo pruebe (200 sin el campo).
- (b) Derivar un esquema estricto para los items sin redefinir el esquema.

### F-02 · NARANJA · `src/service/ingestion-client.ts:36-40` · `fetch` sigue redirecciones

`fetch` se llama sin opción `redirect`, así que por defecto es `follow`.

- **P3:** ingestion responde 302 a otro host. Progress sigue la redirección y devuelve **200 con el cuerpo de ese host** como si viniera de ingestion. En Node 20 de la imagen (lo probé con `docker run … node`) el `Authorization` no llega al otro host porque undici lo quita, pero la salida de red ya no se limita a ingestion. Eso rompe AC-4.2: «la única salida de red es hacia ingestion».
- **P4:** con una redirección al mismo origen, el JWT llega a `/api/otra`.

Propuesta: `redirect: 'error'` o `'manual'`, tratar el resultado como `upstream`, y añadir un test con un 302.

### F-03 · NARANJA · `history.test.ts` (test de logs) · la ausencia de filtraciones solo se comprueba en errores

La mutación g5 añade `console.log('[history] ok', req.user?.userId, JSON.stringify(result.items))` en el camino 200 y **sobrevive (34 verdes)**. El alcance dice que los logs **nunca** llevan el JWT ni el userId. Además, el test de logs no ejercita 403, 404, 503, el campo faltante ni el `status≠200`, aunque CA-6 dice «todos los casos de CA-5».

Lo que sí funciona: las mutaciones g1–g4 (JWT, userId en error y en bad-response, URL en el log) fallan por la aserción.

### F-04 · NARANJA · `server.test.ts`, «usa INGESTION_TIMEOUT_MS del entorno si es valido» · el test no comprueba lo que dice su nombre

Solo afirma que no lanza. La mutación que ignora la variable y usa siempre `DEFAULT_TIMEOUT_MS` **sobrevive**. Se puede probar de verdad con `INGESTION_TIMEOUT_MS=50` y un falso lento: debe dar 504. Si el test falla, además deja la variable de entorno puesta.

### F-05 · AMARILLO · `src/handlers/history.ts` · la marca de log no lleva el status

El alcance pide `[history] upstream error status=<n>`, pero el log es `[history] upstream error` a secas: no se distingue un 500 de una conexión rechazada. El cliente no propaga el código.

### F-06 · AMARILLO · `apps/progress-service/Dockerfile` · se copió de identity lo que no aplica

- La etapa builder instala `python3 make g++`, que solo hacía falta para SQLite (no hay better-sqlite3 en la imagen).
- La imagen corre como **root** (`uid=0`).
- El runtime lleva las devDependencies: jest, ts-jest, eslint, turbo, typescript; `node_modules` ocupa 162 MB.

El root y las devDependencies vienen del molde de identity: lo dejo como tarea candidata. La toolchain de apt sí es de esta tarea.

### F-07 · AMARILLO · `ingestion-client.ts`, `isTimeout` · cualquier `AbortError` cuenta como timeout

Hoy es correcto, porque la única señal es `AbortSignal.timeout`. Si mañana se añade otra señal de cancelación, se clasificará mal. Bastaría un comentario o restringirlo a `TimeoutError`.

### Lo que sí se sostiene

- **Mutaciones** (todas fallan por la aserción, no por compilación, salvo h1, que rompe tsc; repetí la idea con h2, que compila y falla por la aserción):
  - (a) reverse, filter, sort y slice;
  - (b) `?userId=` fijo y reenvío de `originalUrl`;
  - (c) copiar todas las cabeceras (el test ve la Cookie) y una cabecera extra;
  - (d) quitar `requireAuth`: 401 esperado, 502 recibido;
  - (e) 504↔502, upstream→200, quitar `status!==200`, 404 como 401;
  - (f) quitar el esquema o validar solo `data`;
  - (g1–g4) logs con datos;
  - (h2/h3) URL por defecto y mensaje con valores.
- **Sondas:**
  - P6: cuerpo cortado tras el timeout → 504 en 56 ms.
  - P7: barra final o `//` → `/api/uploads` correcto.
  - P9: `bearer` en minúscula → 401 y 0 peticiones a ingestion.
- La suite real tarda 1,5–1,9 s, sin `sleep` largos.
- El worktree quedó limpio al final (`git status --porcelain` = 0).

## Tareas candidatas (fuera de alcance)

- El cuerpo de la respuesta de ingestion no tiene tope: P8 aceptó 20 MB en 70 ms (enlaza con C-40).
- Todos los Dockerfiles (identity, ingestion y progress) corren como root y meten las devDependencies en el runtime. Haría falta `USER node` más `npm ci --omit=dev` o `npm prune`.

## Rutas de transcripciones

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/full.log`
- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/e2e/salida.txt`
- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/mut.sh`
- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/e2e.sh`
- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/my.sha` y `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u5-T02/img.sha`

```
VEREDICTO: NO-VERDE
ROJO|CA-5 / Plan de pruebas|item con campo de más no da 502 (se descarta en silencio) y no hay test
NARANJA|apps/progress-service/src/service/ingestion-client.ts:36|fetch sigue redirecciones (redirect: follow): sale de ingestion, rompe AC-4.2
NARANJA|apps/progress-service/src/__tests__/history.test.ts (logs)|la ausencia de filtraciones solo se comprueba en errores; la mutación con log de userId e items en 200 sobrevive
NARANJA|apps/progress-service/src/__tests__/server.test.ts|el test de INGESTION_TIMEOUT_MS no afirma su efecto; la mutación sobrevive
AMARILLO|apps/progress-service/src/handlers/history.ts|la marca de log no lleva status=<n>
AMARILLO|apps/progress-service/Dockerfile|toolchain apt innecesaria; root y devDependencies en el runtime (molde)
AMARILLO|apps/progress-service/src/service/ingestion-client.ts:17|isTimeout trata cualquier AbortError como timeout
INFORME: revisiones/u5-T02/ronda-1.md
```
