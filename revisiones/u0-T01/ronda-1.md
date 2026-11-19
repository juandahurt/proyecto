# Ronda 1 — u0-T01

VEREDICTO: NO-VERDE

Hay dos hallazgos ROJO y tres NARANJA. El código se comporta bien en todas mis sondas, y todos los CA dan su salida esperada salvo el CA-7: su suite de consola no cubre las ramas de error. Además, la evidencia de CA-12 en la bitácora no pudo salir del HEAD actual.

Tarea verificada: blob `709b7df…`, sha256 `435a203f…`, main @ `0fa42cc`. Worktree `/Users/aureliano/Desktop/proyecto-u0-T01` @ `57c9fa4`, y sigue limpio al terminar (`git status --porcelain` = 0 líneas). Antes de probar corrí `npm ci` (Node 26.13) y compilé shared-types y auth-middleware.

## Criterios de aceptación, verificados por mí

| #   | Comando                                                  | Resultado                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | build Vite + 4 grep                                      | pasa: exit 0, `index.html ok`, sin schemas ni copy duplicados, imports desde `@proyecto/shared-types`; el copy está en `dist/assets/index-DJQ4U4P0.js`                                                                                                                                               |
| 2   | `npm test -- login`                                      | pasa: 1/1 suites, 11/11 tests                                                                                                                                                                                                                                                                        |
| 3   | `npm test -- register`                                   | pasa: 1/1, 7/7                                                                                                                                                                                                                                                                                       |
| 4   | `npm test -- onboarding`                                 | pasa: 1/1, 14/14                                                                                                                                                                                                                                                                                     |
| 5   | `npm test -- routes guard`                               | pasa: 1/1, 19/19                                                                                                                                                                                                                                                                                     |
| 6   | `npm test -- auth-store api-client`                      | pasa: 2/2, 29/29                                                                                                                                                                                                                                                                                     |
| 7   | api-client + grep de hosts                               | **falla** (F-01): las líneas salen, pero el test de consola no cubre las ramas de error que el CA exige                                                                                                                                                                                              |
| 8   | `npm test -- a11y`                                       | pasa: 1/1, 6/6                                                                                                                                                                                                                                                                                       |
| 9   | suite completa + 5 workspaces + `wc -l`                  | pasa: frontend 7/7 suites y 86/86 tests en 2,85 s; sin skip, only ni todo. ingestion 206/11, identity 74/12, trust 25/4, progress 171/9, backend 18/4; `wc -l` = 0                                                                                                                                   |
| 10  | `turbo run lint build --force` + prettier                | pasa: 16 successful, 0 cached, prettier limpio; eslint, turbo y prettierrc sin cambios. Comprobé con `--debug` que ESLint sí recorre los `.tsx`                                                                                                                                                      |
| 11  | `--coverage` + umbrales                                  | pasa: líneas globales 100 %; ramas en api 97,61 % y en auth 83,33 %; los umbrales nacen en `497faca`, único commit del archivo                                                                                                                                                                       |
| 12  | dependencias y audit                                     | pasa: solo las dependencias permitidas, `audit exit=0`, sin latest ni comodines, raíz sin cambios. `npm ls react`: solo 18.3.1. Lockfile: 197 añadidos, 0 quitados, 0 versiones cambiadas                                                                                                            |
| 13  | 7 asserts + `--dry-run=server`                           | pasa: ningún FALLO; ConfigMap y Service `unchanged`, así que lo desplegado coincide con el diff                                                                                                                                                                                                      |
| 14  | grep del Dockerfile                                      | pasa: dos FROM con tag fijo, EXPOSE 8080, sin latest ni secretos                                                                                                                                                                                                                                     |
| 15  | lectura del cluster                                      | pasa por lectura: imagen `frontend:u0-T01`, RollingUpdate, ready=true, 0 restarts, ClusterIP 8080; los 5 pods conservan nombre y 0 restarts. El bundle servido es **byte a byte** el de mi build de HEAD (`cmp` igual). El build, el `kind load` y el apply **no son verificables** con mis permisos |
| 16  | flujo HTTP real (email `u0t01-rev1-1795115507@rev.test`) | pasa: register 201, duplicado 409, login 200, clave mala 401; onboarding false, luego 422, `POST` 200 y true; limits 200, trends 200 con `tier: free`. `AuthResponseSchema` valida las respuestas reales; el JWT real trae `exp` numérico de 7 días. Ningún JWT ni contraseña impreso                |
| 17  | 3 escaneos de secretos                                   | pasa: `no secrets in diff`, `no secrets in diff or tree`, `bundle sin secretos`                                                                                                                                                                                                                      |
| 18  | alcance y commits                                        | pasa: nada fuera del alcance, 7 commits atómicos, ninguno toca el shard de auditoría                                                                                                                                                                                                                 |

Sondas de nginx por el port-forward 3500 (lo abrí con el puerto libre y lo cerré al final; queda libre):

- Las cabeceras de seguridad están en `/`, `/api/*` proxeado, `/assets`, `/health` y el 404 JSON.
- `/api/*` lleva `no-store`; `index.html` lleva `no-cache`.
- Un cuerpo de 1,2 MB a `/api/auth/login` o `/api/onboarding` da 413.
- `/api/otra` da 404 JSON, `/api/authx` da el 404 con envoltorio de identity, `/login/` da 200 y no hay 3xx.
- Los logs de nginx no contienen `Bearer`.
- No subí nada a `/api/uploads`.

## Mutaciones (en una copia propia, no en el worktree)

**Mueren (21):**

- M01 mensaje distinto según el código.
- M02 `Get Started` habilitado con 2 marcados.
- M03 `console.error(token)` en el cliente.
- M08 la guarda pinta Upload mientras carga.
- M09 un 401 no borra el token.
- M10 token expirado aceptado.
- M11 sin `redirect: 'error'`.
- M14 token en la URL.
- M15 el cliente ignora `auth:false`.
- M16 espacio extra en la etiqueta de onboarding.
- M17 botón de login sin `disabled`.
- M18 un 422 navega.
- M19 logout no borra.
- M20 `credentials: 'include'`.
- M21 otro texto para el 409.
- M22 onboarding optimista.
- M23 login sin validación en el cliente.
- M24 `checkbox3:false`.
- M25 sin `aria-disabled`.
- M26 `completed` true por defecto.
- M27 sin foco inicial.

**Sobreviven (6):** M04 a M07 (F-01) y M12 y M13 (F-03).

**Sondas extra en la copia (todas verdes):**

- `setItem` que lanza durante el login.
- Login 200 con `data:null`, cuerpo vacío, token numérico, token vacío o HTML: mensaje genérico, sin token y el botón vuelve a activarse.
- Doble envío en registro y en onboarding: 1 POST.
- `GET onboarding` con `data:null`: Retry, sin colgarse.
- Un login nuevo después de un 401.
- Sin sumideros de HTML (`dangerouslySetInnerHTML`, `innerHTML`, `eval`).

## Hallazgos

### F-01 · ROJO · CA-7 · `__tests__/login.test.tsx`, `register.test.tsx`, `onboarding.test.tsx` · faltan espías de consola en las ramas de error

El CA-7 exige espiar la consola «en login, registro, onboarding y en cada error». Hoy se espía solo en el éxito de login y registro, en el 422 de onboarding y en el cliente. Las mutaciones que escriben en la consola desde la pantalla sobreviven con 86/86 verde:

- M04: `console.error(email, password)` en el 401 del login.
- M05: `console.warn(email, password)` en el 409 del registro.
- M06: `console.error(email)` en el 500 o error de red del login.
- M07: `console.error(api)` en el 5xx de onboarding.

Hay que cubrir toda la clase: login 401/500/red, registro 409/500/red y onboarding 5xx/red, afirmando `callCount()===0`. El código actual no escribe en la consola (mi sonda P7 lo confirma): falta la prueba que el CA promete.

### F-02 · ROJO · `bitacoras/u0-T01.md:228-271` y sección CA-1..CA-14 · evidencia que no pudo salir del HEAD actual

- El bloque de CA-12 muestra `"@proyecto/shared-types": "*"`, y el grep de comodines lo encuentra en la línea 270. Esa salida es anterior a `88a1255` (hoy está `0.0.1`) y no se volvió a correr.
- Las salidas van fuera de bloques de código y prettier las reescribió: las líneas `+` del diff aparecen como `- ` (se leen como borrados) y la salida de CA-1 quedó reindentada.
- «routes guard» y «auth-store api-client» son títulos vacíos.
- `### CA-1` y `### CA-14` salen duplicados, y hay un bloque de CA-14 metido en el sitio de CA-11.

Arreglo: volver a correr los CA después del último commit y pegar las salidas literales en bloques de código.

### F-03 · NARANJA · `src/api/endpoints.ts:32,42` · que login y registro no envían `Authorization` no está probado donde importa

Si se quita `auth:false` en `loginRequest` o `registerRequest`, la suite sigue verde (M12, M13). La razón: los tests de pantalla corren sin token, y los de endpoint usan `setup(null)`. Falta un test de endpoint con token presente que afirme que no se envía la cabecera y que un 401 de login no llama a `onUnauthorized`.

### F-04 · NARANJA · `src/pages/credentials.ts:17` · literal incrustado que duplica el contrato

El mensaje `'Password must be at least 8 characters.'` copia a mano el `min(8)` de `RegisterRequestSchema` y `LoginRequestSchema`. Además, cualquier fallo que no sea del email se traduce a ese mensaje. Si el schema cambia, el texto mentirá. Debe derivarse del schema (el `minimum` del issue o su mensaje).

### F-05 · NARANJA · `k8s/frontend/configmap.yaml:70-74` · un 404 de asset se cachea un año como `immutable`

Lo comprobé en vivo: `curl -D - :3500/assets/nope.js` da `404` con `Cache-Control: public, max-age=31536000, immutable`, porque el `add_header … always` también se aplica a los errores. Con `maxSurge` del RollingUpdate, un cliente que pida un hash todavía ausente queda con el 404 cacheado. El `Cache-Control` largo debe ir solo en los 200 (sin `always`, o con un `error_page` que lleve `no-store`).

### F-06 · AMARILLO · `configmap.yaml:62,77` · `/api` y `/favicon.ico` devuelven `index.html`

Los dos dan 200 `text/html`. Los prefijos sin barra final también dejan pasar cosas como `/api/authx`, que hoy acaba en un 404 inocuo de identity.

### F-07 · AMARILLO · `apps/frontend/vite.config.ts:20-26` · proxy de desarrollo con `localhost:31xx-34xx` incrustados

Está fuera del alcance del grep de CA-7 y le faltan `/api/policy` y `/api/history`, que nginx sí enruta.

### F-08 · AMARILLO · `src/auth/guards.tsx:14-28` · la pantalla de error de onboarding no tiene salida

Solo ofrece Retry. Con token y trust en 5xx, ni `/login` ni `/register` permiten cerrar sesión o cambiar de cuenta (sonda P8).

### F-09 · AMARILLO · varios

- El rojo primero de la bitácora no se puede reproducir desde git: los cuerpos neutros nunca se commitearon. Mis mutaciones lo compensan.
- `collectCoverageFrom` excluye también `src/__tests__/**`; es razonable, pero no está declarado en la tarea.
- No hay test de doble envío en registro ni en onboarding (el comportamiento es correcto: P3 y P4).

## Límite declarado

No hay navegador automatizado, así que el DOM real en un navegador no está probado (ni la CSP con `style-src 'self'` ni el render visual). Lo cubren RTL, el humo HTTP de CA-16 y la comparación byte a byte del bundle servido. Es una limitación, no un hallazgo.

## Tareas candidatas (fuera de alcance)

- nginx resuelve los 4 upstreams al arrancar: si falta un Service, el pod del frontend no arranca.
- Bundle de 741 kB porque shared-types se compila a CJS: subrutas o salida ESM (ya anotada por el codificador).
- React Router 6.x tiene avisos `moderate`: subir a la 7.
- identity no limita intentos de login (no hay rate limiting).
- `turbo test` de los servicios depende de compilar antes `auth-middleware`.

## Rutas de transcripciones largas

Todas en el scratchpad `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/rev-u0-T01/`:

- `ca-login.txt`, `ca-register.txt`, `ca-onboarding.txt`, `ca-5.txt`, `ca-6.txt`, `ca-8.txt`, `ca9-front.txt`
- Mutaciones: `mutate.sh`
- Sondas: `copy/apps/frontend/src/__tests__/zz-probes.test.tsx`
- Port-forward: `pf-frontend.log`

```
VEREDICTO: NO-VERDE
ROJO|CA-7 · __tests__/{login,register,onboarding}.test.tsx|faltan espías de consola en las ramas de error (M04-M07 sobreviven)
ROJO|bitacoras/u0-T01.md:228-271|evidencia de CA-12 anterior al HEAD y salidas reescritas por prettier
NARANJA|src/api/endpoints.ts:32,42|que login y registro no envían Authorization no está probado (M12, M13 sobreviven)
NARANJA|src/pages/credentials.ts:17|literal "8" que duplica el min(8) del schema compartido
NARANJA|k8s/frontend/configmap.yaml:72|un 404 de /assets se cachea un año como immutable
INFORME: revisiones/u0-T01/ronda-1.md
```
