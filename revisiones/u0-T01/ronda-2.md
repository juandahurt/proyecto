# Ronda 2 — u0-T01

VEREDICTO: NO-VERDE

Los cinco hallazgos de la ronda 1 están resueltos de verdad: M04-M07, M12 y M13 ahora mueren, el mínimo de contraseña sale del schema, el 404 de `/assets` ya no se cachea y `/api` da el 404 JSON. Todos los CA dan su salida esperada. **Pero el CA-7 enmendado no se cumple.** El fix de la ronda 2 exige espiar la consola en las ramas de error «además del éxito», y el éxito del onboarding no tiene espía: un `console.error` del JWT en esa rama deja la suite en 102/102 verde. Mi barrido de la clase encontró además otras 8 ramas sin espía.

Lo que revisé:

- Tarea: blob `9790b5f…` y sha256 `be31fe46…`, coinciden; main @ `1c4072e`.
- Worktree @ `6ddff78`: limpio antes y después de la revisión (`git status --porcelain` da 0 líneas).
- Antes de probar: `npm ci` (Node 26.13) y build de shared-types y auth-middleware.
- Las mutaciones las hice en una copia en `$WORK/copy`, nunca en el worktree.

## Criterios de aceptación, verificados por mí

| #   | Comando que corrí                                        | Resultado                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | build Vite + 5 grep                                      | pasa: exit 0, `index.html ok`, sin duplicados, 4 imports de `@proyecto/shared-types`; el copy está en `dist/assets/index-C_oqQIdP.js`                                                                                                           |
| 2   | `npm test -- login`                                      | pasa: 1/1 suites, 14/14 tests                                                                                                                                                                                                                   |
| 3   | `npm test -- register`                                   | pasa: 1/1, 10/10                                                                                                                                                                                                                                |
| 4   | `npm test -- onboarding`                                 | pasa: 1/1, 17/17                                                                                                                                                                                                                                |
| 5   | `npm test -- routes guard`                               | pasa: 1/1, 19/19                                                                                                                                                                                                                                |
| 6   | `npm test -- auth-store api-client`                      | pasa: 2/2, 30/30                                                                                                                                                                                                                                |
| 7   | api-client + grep de hosts                               | las líneas salen y dice «sin hosts ni puertos», pero **falla** el CA-7 enmendado (F-10)                                                                                                                                                         |
| 8   | `npm test -- a11y`                                       | pasa: 1/1, 6/6                                                                                                                                                                                                                                  |
| 9   | suite completa + 5 workspaces + `wc -l`                  | pasa: frontend 8/8 suites y 102/102 tests en 3,17 s; sin skip, only ni todo. ingestion 206/11, identity 74/12, trust 25/4, progress 171/9, backend 18/4 (igual que main); `wc -l` = 0                                                           |
| 10  | `turbo run lint build --force` + prettier                | pasa: 16 successful, 0 cached; prettier limpio; eslint, turbo y prettierrc sin cambios                                                                                                                                                          |
| 11  | `--coverage` + umbrales                                  | pasa: líneas globales 97,95 %; ramas en api 97,61 % y en auth 83,33 %; el umbral nace en `497faca`, único commit del archivo                                                                                                                    |
| 12  | dependencias y audit                                     | pasa: `"@proyecto/shared-types": "0.0.1"`, `audit exit=0`, sin latest ni comodines, raíz sin cambios                                                                                                                                            |
| 13  | 7 asserts + `--dry-run=server`                           | pasa: ningún FALLO, `image: frontend:u0-T01-r2`. ConfigMap y Service salen `unchanged`; el Deployment sale `configured`, pero `kubectl diff` sale vacío                                                                                         |
| 14  | grep del Dockerfile                                      | pasa: dos FROM con tag fijo, EXPOSE 8080, sin latest ni secretos                                                                                                                                                                                |
| 15  | lectura del cluster                                      | pasa por lectura (detalle debajo de la tabla). El build, el `kind load` y el apply **no son verificables** con mis permisos                                                                                                                     |
| 16  | flujo HTTP real (email `u0t01-rev2-1795118138@rev.test`) | pasa: register 201, duplicado 409, login 200, clave mala 401; onboarding false, luego 422, `POST` 200 y true; limits 200; trends 200 con `tier:"free"`. `AuthResponseSchema` valida las dos respuestas reales. Ningún JWT ni contraseña impreso |
| 17  | 3 escaneos de secretos + grep de JWT en la bitácora      | pasa: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos`; 0 JWT en la bitácora                                                                                                                                           |
| 18  | alcance y commits                                        | pasa: 10 commits; los 3 de la ronda 2 son atómicos y tocan solo tests + `credentials.ts`, `k8s/frontend/{configmap,deployment}.yaml` y la bitácora; ninguno toca el shard typewriter                                                            |

Detalle de CA-15:

- Pod `frontend-5d65669f45-4wslf`: `ready=true`, 0 restarts, imagen `frontend:u0-T01-r2`, estrategia RollingUpdate.
- Service `ClusterIP 8080`.
- Los otros 5 pods conservan el nombre y 0 restarts, igual que en los listados de antes y después de la bitácora.
- El bundle y el `index.html` servidos son byte a byte los de mi build de HEAD (`cmp` igual).
- Lo desplegado coincide con el repo: el ConfigMap da `unchanged`.

Las sondas de nginx, por el port-forward 3500 (estaba libre y lo cerré al terminar):

- **F-05:** `/assets/nope.js` da 404 sin `Cache-Control`, con CSP, XCTO, XFO y Referrer-Policy. El asset real da 200 con `immutable`, y el 304 lo conserva.
- **Otros errores bajo `/assets/`:** `POST /assets/x` da 404, `POST` al asset da 405, `/assets/` da 404 y `/assets/<js>/extra` da 404. Ninguno lleva `immutable` y todos llevan las cabeceras de seguridad.
- **F-06:** `GET /api`, `/api/`, `/api?x=1` y `POST /api` dan 404 `application/json`, con `no-store` y las cabeceras de seguridad.
- **Rutas proxeadas:** `/api/auth/*`, `/api/users/me/limits`, `/api/policy`, `/api/history`, `/api/onboarding`, `/api/trends` y `/api/uploads` siguen llegando a su servicio (401/404/422 con envoltorio).
- **Logs de nginx:** 0 coincidencias de `Bearer` o `eyJ`.
- No subí nada al endpoint de subida.

## Mutaciones (copia propia; script en `$WORK/mutate.sh`)

**Las de la ronda 1 ahora mueren (6/6):**

- M04 `console.error(email,password)` en el 401 del login.
- M05 `console.warn` en el 409 del registro.
- M06 `console.error(email)` en el 5xx o error de red del login.
- M07 `console.error(api)` en el 5xx o error de red de onboarding.
- M12 y M13: quitar `auth:false` en login y en registro.

**Mutaciones nuevas que mueren:**

- N01 `console.log(JWT)` en el éxito del login.
- N02 `console.debug(Bearer …)` en el éxito del registro.
- N05 `console.log(text)` de la respuesta en el cliente.
- N06 `console.info(headers)` con el Bearer.
- N07 `console.error(body)` en el catch de red.
- N09 `console.debug(payload)` del token decodificado.
- N12 `console.log` en `signIn`.
- N18 `console.trace`.
- N20 `console.warn(token)` en la guarda.

**Mutaciones de F-04 y de regresión que mueren:**

- F04a: volver a poner el literal `8`.
- F04c: que el fallback traduzca al mensaje de mínimo.
- R01: otro texto para el 401 (AC-8.3).
- R02: otro texto para el 409.

**Sobreviven con 102/102 verde (F-10 y F-11):**

- N16 y N17: `console.log(out)` y `console.error(localStorage.getItem('estudio.token'))` en el **éxito del onboarding**.
- N03: `console.log(password)` en el rechazo en el cliente del login.
- N04: `console.info(email)` en el rechazo en el cliente del registro.
- N08: `console.error(password)` en el rechazo en el cliente del registro.
- N10: `console.warn(token)` cuando el token está expirado (`readToken`).
- N11: `console.error(token)` en el catch de `saveToken`.
- N13: `console.log(JWT)` en `logout`.
- N14: `console.error(out)` en el error de `GET /api/onboarding` (AuthContext).
- N15: `console.log(api)` en el 401 de onboarding.

**Otras supervivientes, que no cuento como hallazgo:**

- N19 `process.stderr.write(password)`: no es un canal del navegador, y el CA-7 enumera los métodos de `console`.
- F04b: quitar `code==='too_small'` es equivalente, porque en Zod solo `too_small` trae `minimum`.

**F-04, comprobado en la copia:** cambié `min(8)` a `min(10)` en shared-types y recompilé.

- El mensaje pasa a `Password must be at least 10 characters.` tanto en login como en registro.
- Fallan 2 tests que fijan el `8` del contrato. Es una alarma deseable, no un defecto.

**`afterEach(jest.restoreAllMocks)`:** no oculta nada.

- `jest.setup.ts` no crea espías globales.
- Las mutaciones de consola siguen muriendo.

## Hallazgos

### F-10 · ROJO · CA-7 (fix ronda 2, «además del éxito») · `src/__tests__/onboarding.test.tsx` · el éxito del onboarding no tiene espía de consola

El único espía de onboarding fuera de las ramas de error es el del test «no escribe en la consola…», y ese usa un 422. El camino 200/204, que navega a `/upload`, no se espía. N17, que escribe el JWT en la consola al terminar el onboarding, sobrevive con 102/102. El código actual no escribe en la consola: lo que falta es la prueba que el CA promete. El login y el registro sí tienen espía en su éxito (N01 y N02 mueren).

### F-11 · NARANJA · `Login.tsx`/`Register.tsx` (rechazo en el cliente), `auth/token-store.ts`, `auth/AuthContext.tsx` (`logout`, error de `GET onboarding`), `Onboarding.tsx` (401) · misma clase que F-01, 8 ramas sin espía

Sobreviven N03, N04, N08, N10, N11, N13, N14 y N15 (detalle en la lista de supervivientes). La más afilada es N08: el CA-3 dice «la contraseña **nunca** aparece… en la consola», y en el rechazo en el cliente del registro no hay prueba que lo sostenga. La pongo en NARANJA y no en ROJO porque el fix de la ronda 2 enumeró las ramas de servidor y esas sí están cubiertas. Pero el texto base del CA-7 dice «en cada error», así que el orquestador puede subirla.

Reconozco el fallo de la ronda 1: mi barrido de clase de F-01 no incluyó estas ramas, y por eso aparecen ahora y no entonces. Arreglo sugerido: un espía de consola en un `beforeEach`/`afterEach` global de `helpers.tsx` que afirme `callCount()===0` en cada test, salvo que el test lo desactive. Eso cubre la clase entera de una vez.

### F-12 · AMARILLO · `k8s/frontend/configmap.yaml:81` · un 416 lleva `immutable`

`Range: bytes=999999999-` sobre un asset real da `416` con `Cache-Control: public, max-age=31536000, immutable`. El fix pedía `immutable` «solo en respuestas 200». El riesgo práctico es nulo: los navegadores no cachean un 416 y hace falta un Range forjado. El 304 y el 206 llevan `immutable` y está bien.

### F-13 · AMARILLO · bitácora `bitacoras/u0-T01.md` · F-02 resuelto en lo sustancial; quedan restos de forma

Lo resuelto: la evidencia de la ronda 2 es fresca y coincide con mi ejecución (bundle `C_oqQIdP`, 102/102, cobertura idéntica, CA-12 con `0.0.1`). Va dentro de bloques de código.

Lo que queda:

- La sección de la ronda 1 (líneas 88-303) conserva los títulos duplicados y vacíos. La línea 457 la declara sustituida, pero no la marca.
- `### Salidas de los CA…` (línea 638) es un título vacío.
- En CA-15 los comandos están parafraseados (`-o jsonpath=image,strategy`, `...`).
- CA-11 usa el comando antiguo de `wc -l`, no el `git log --diff-filter=A` del fix.

### F-14 · AMARILLO · `src/pages/credentials.ts:31` · texto nuevo como literal suelto

`'Enter a valid email and password.'` no es una constante exportada, a diferencia de `GENERIC_ERROR`. Con los schemas reales no se puede alcanzar desde la UI. Es copy de la interfaz, no un valor del contrato duplicado, así que no le aplico la regla 8.

## Límite declarado

No hay navegador automatizado: ni el DOM real ni la CSP (`style-src 'self'`) se prueban en un navegador. Lo cubren RTL, el flujo HTTP de CA-16 y el `cmp` byte a byte del bundle servido. Es una limitación, no un hallazgo.

## Tareas candidatas (defectos reales fuera de alcance)

- nginx devuelve `400 Bad Request` para rutas por encima de la raíz (`/assets/../../etc/passwd`, `/nope/../../x`) **sin** CSP, XCTO ni XFO, porque es una respuesta de nivel servidor. Haría falta un `error_page 400` con un location que incluya `security-headers.inc`, o las cabeceras a nivel `server`. Ya existía en la ronda 1.
- Siguen en pie las candidatas de la ronda 1 y C-68 a C-72.

## Rutas de transcripciones largas

Todas en `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/rev-u0-T01-r2/`:

- Ejecución de los CA: `ca9-front.txt`, `ca-6.txt`, `ca10.txt`, `ca11.txt`.
- Mutaciones y sondas: `mutate.sh`, `probe-headers.sh`, `ca16.sh`.
- Cluster: `pf-frontend.log`, `nginx.log`, `served.js`, `served-index.html`.

```
VEREDICTO: NO-VERDE
ROJO|CA-7 · apps/frontend/src/__tests__/onboarding.test.tsx|el éxito del onboarding no tiene espía de consola (N16/N17 sobreviven: JWT a console.error con 102/102 verde)
NARANJA|Login.tsx/Register.tsx rechazo en cliente, token-store.ts, AuthContext.tsx, Onboarding.tsx 401|8 ramas más sin espía de consola (N03,N04,N08,N10,N11,N13,N14,N15); N08 deja sin prueba el «nunca en la consola» de CA-3
INFORME: revisiones/u0-T01/ronda-2.md
```
