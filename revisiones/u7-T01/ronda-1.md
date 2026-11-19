# Ronda 1 — u7-T01

VEREDICTO: NO-VERDE

Hay un hallazgo ROJO. El test de silencio de logs (CA-9) no cubre todo lo que exige su criterio: una mutación que escribe en consola el `Bearer <JWT>` completo sigue pasando, y otra que escribe los scores del historial también. Todo lo demás lo corrí yo y pasa, incluido el E2E real en kind.

Tarea verificada: la copia de `main`, blob `07e599f…` y sha256 `01e077e5…`, coinciden. El worktree `/Users/aureliano/Desktop/proyecto-u7-T01` está en HEAD `7f8fd76`. Antes de probar corrí `npm ci` y compilé `shared-types` y `auth-middleware`. Al terminar, `git status --short` sale vacío: el worktree está limpio. Todas las mutaciones las hice en una copia aparte: `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/rev-u7-T01/copia`.

## Criterios de aceptación, verificados por mí

| #   | Criterio                           | Comando                                                                          | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Esquema `TrendResponse` (C3)       | los 4 comandos de CA-1, con `perl`                                               | pasa. El diff solo toca `trends.ts`; el grep muestra los schemas y los `z.infer`; sale «sin enums duplicados» y «tsc shared-types ok». Mutación (un `z.enum(['locked',…])` de varias líneas en otro `.ts`): el comando imprime su ruta.                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Puerta free (AC-7.1)               | `npm test … trend-response trends --verbose \| grep`                             | pasa. 46/46, 2 suites. Mutaciones M1 y M9 detectadas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3   | paid en formato C3 (AC-7.2)        | ídem                                                                             | pasa. Comprobado por valor, orden y nombres, y el cuerpo valida contra el schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | Sin caché                          | `npm test … trends`                                                              | pasa. Contadores 3/3 y cambio de tier en los dos sentidos. M2 y M2b detectadas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | Solo `Authorization`               | `npm test … identity-client trends`                                              | pasa. Revisa `cookie`, `x-forwarded-for` y `x-user-id`, ruta exacta y que `?userId=` se ignora. Si la llamada sigue redirecciones (M12), los tests fallan.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | Fallos de identity                 | ídem                                                                             | pasa. 24 líneas ✓; el contador de ingestion queda en 0 en todos los casos. M3 (tier por defecto `free`, `paid` o «locked con 200»): 10 tests fallan. M11 (llamar a ingestion en paralelo): falla.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Sin JWT, ninguna llamada de salida | `npm test … trends`                                                              | pasa. Los dos contadores en 0, también con token basura y con firma mala.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | C-56, configuración al arrancar    | `npm test … server` y `grep`                                                     | pasa. 14/14, y `server.ts:37 loadTrendConfig(process.env)`. M4: 5 fallan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | Logs limpios                       | `npm test … trends identity-client \| grep log`                                  | **falla**: ver F-01. M5 (`console.info(userId)`) sí la detectan 3 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | Rutas y suite                      | `grep`, `wc -l` y suite completa                                                 | pasa. 4 rutas; `wc -l` da 0; `Tests: 158 passed`, `Test Suites: 9 passed`, en 2,4 s; ningún skip, only ni todo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 11  | Regresiones, lint, build, formato  | los comandos de CA-11                                                            | pasa. Ingestion 206/11, identity 74/12, trust 25/4, backend 18/4. Turbo: `Tasks: 14 successful`, `0 cached`. Prettier limpio sobre el diff.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 12  | Cobertura                          | `npm test … --coverage`                                                          | pasa. All files 100/98,33; `service` en ramas 97,77; `handlers` 100; `trend-response.ts` al 100 %; `jest.config` sin cambios (0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 13  | Sin dependencias nuevas            | `grep` sobre el diff                                                             | pasa: «sin cambios de dependencias».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14  | Manifiestos                        | los comandos de CA-14 y `--dry-run=server`                                       | pasa. Solo cambian `configmap` y `deployment`; ningún `FALLO`; el diff se limita a tag y variables de identity; el servidor acepta (sale `configured`, es la ATENCIÓN 2 ya aceptada).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 15  | Despliegue                         | solo lectura con `kubectl get`                                                   | pasa por lectura. Imagen `progress-service:u7-T01 RollingUpdate`, gen 3 = observada 3, un solo pod `…5db475b77f-fg6rf` con `ready=true restarts=0` y la imagen u7-T01. El pod viejo `…rjrxc` ya no está. ConfigMap: `http://identity-service:3100 5000`. La imagen local (`3bd29c02…`) se creó a las 10:17:16, después del commit de código (10:15:14), y el pod a las 15:19Z. Identity, ingestion, trust y backend conservan nombre y fecha de creación. No verificable sin reproducir: el `docker build` y el `kind load`.                                                                              |
| 16  | E2E real (16b)                     | port-forwards míos a 3101, 3202 y 3402, con los puertos libres comprobados antes | pasa. «A free: locked sin datos» (sin ningún uploadId de A en el cuerpo); `subscribe` 200; «A paid: trend completo categorias con tendencia=5», `scoreHistory` de 5 puntos en orden cronológico, sin `slope`, y valida contra el schema; «B: insufficient_data uploadsNeeded=3»; `?userId=<sub de A>` con el JWT de B da 200, un cuerpo idéntico byte a byte al de B y 0 ids de A; sin token 401; token basura 401. Logs del pod: 1 línea, 0 con `bearer`, userId, uuid o direcciones. Port-forwards cerrados y los tres puertos libres; el PID 4456 (kubectl) y el 82992 (en el 3401) quedaron intactos. |
| 17  | Sin secretos                       | los 2 comandos de CA-17                                                          | pasa: «no secrets in diff» y «no secrets in diff or tree». La bitácora no contiene JWT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 18  | Alcance y commits                  | `git diff --name-only`, `git log` y `git show`                                   | pasa. Los 14 archivos son los permitidos; 4 commits atómicos; ningún commit trae el shard `typewriter`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Hallazgos

### F-01 · ROJO · CA-9 / `apps/progress-service/src/__tests__/trends.test.ts` (describe «silencio de logs») · el test de logs no cubre «cada fallo de CA-6» ni «ningún score del historial»

CA-9 exige que el test afirme el silencio de logs en el camino feliz y en **cada** fallo de CA-6, y que ningún mensaje contenga un `score` del historial. Dos huecos lo impiden:

- **El escenario de fallos solo prueba** 401, 500, no-JSON, timeout de identity, 503 y no-JSON de ingestion. Faltan cuerpo que no valida `LimitsResponseSchema`, tier desconocido, conexión rechazada, redirección, 401, timeout y red de ingestion. Esos tests existen y tienen los espías puestos (vienen del `beforeEach`), pero no llaman a `expectSilentLogs()`.
  - **M7:** añadí `console.warn("[trends] bad limits", authorization)` en la rama `if (!parsed.success)` de `identity-client.ts`. Esa línea escribe en consola el `Bearer <JWT>` completo, y resultado: `Tests: 158 passed`, **sobrevive**.
  - **Control M7b:** la misma línea en el `catch` de `fetch` sí la detecta un test.
- **La aserción de scores busca la clave, no los valores.** Solo comprueba `not.toContain('"score"')`.
  - **M6:** `console.info("[trends] ok " + series.map(p => p.score)…)` en el camino 200 da `158 passed`, **sobrevive**.
  - M6b, con timestamps, también sobrevive. Esto es menor, porque el CA no menciona los timestamps.

Arreglo esperado:

- llamar a `expectSilentLogs()` en todos los tests de fallo de identity y de ingestion, o ampliar `scenarios` a la lista completa de CA-6;
- usar en los fixtures scores reconocibles (por ejemplo 71, 83, 97) y afirmar que no aparecen como números en los logs.

### F-02 · AMARILLO · `packages/shared-types/src/trends.ts` (`CategoryTrendSchema`) · el schema no es estricto ni ata el id al nombre

Lo comprobé con `node` contra `dist`:

- `{status:'locked', slope:3}` valida, porque Zod elimina en silencio las claves extra. Por eso el «valida contra `TrendResponseSchema`» de los tests no detectaría una fuga de `slope` o de `qualifiedCount`; hoy esas fugas solo las cubren los `not.toContain`.
- `{categoryId:'CAT-1', categoryName:'Perspective'}` también valida.

Ninguna de las dos cosas la pedía el CA. Usar `.strict()` y atar el id con `CATEGORY_NAME_BY_ID` dentro del `refine` endurecería el contrato.

### F-03 · AMARILLO · `server.test.ts` · un cambio de más en un test existente, declarado

El test «toma INGESTION_URL del entorno» ahora fija también `IDENTITY_URL`, y el `afterEach` restaura esa variable. Lo que afirma el test no cambia y la bitácora lo declara. Lo acepto como el equivalente en variable de entorno de «añadir `identityUrl`».

### F-04 · AMARILLO · `identity-client.ts`, `handlers/trends.ts` · código duplicado

`isTimeout` repite el de `ingestion-client.ts`, y `sendFailure` repite el switch de `history.ts`. Es forzoso, porque esos dos archivos están fuera de alcance. Va como tarea candidata.

## Mutaciones (en la copia; restauradas comparando con el worktree)

- **Detectadas:**
  - M1, quitar la rama `free`: 7 fallan.
  - M2, memorizar el tier en el módulo: muchos fallan. M2b, memorizarlo por app: 3 fallan.
  - M3, tier por defecto ante error: 10 fallan con `free`, con `paid` y con «locked con 200».
  - M4, constantes en lugar de `loadTrendConfig`: 5 fallan.
  - M5, `console.info(userId)`: 3 fallan.
  - M7b, log del JWT en el `catch`: 1 falla.
  - M9, dejar pasar `stagnating` con free: 4 fallan.
  - M11, llamar a ingestion antes o en paralelo con identity: muchos fallan.
  - M12, `redirect: 'follow'`: 2 fallan.
  - Debilitar el `refine` (R1, sin `direction === status`; R2, sin la regla de `uploadsNeeded`; R3, `trend` permitido en `locked`): 1, 1 y 2 fallan.
  - Enum duplicado para el comando de CA-1: detectado.
- **Sobreviven:** M6 (scores en el log), M6b (timestamps en el log) y M7 (JWT en el log en la rama de schema inválido). Ver F-01.

## Tareas candidatas (defectos reales fuera de alcance)

- Llevar `isTimeout` y el mapeo fallo → HTTP de `history.ts` y `trends.ts` a un módulo común de progress-service.
- `apps/ingestion-service/src/service/claude-client.ts:72` tiene su propio mapa de nombres de categoría; debería usar `CATEGORY_NAME_BY_ID` de `shared-types`, que es la única fuente.
- Los usuarios E2E `rev-u7t01-{a,b}-<epoch>@rev.test` quedan en identity: A es `paid` con 5 uploads y B es `free` con 1.

## Rutas de transcripciones largas

Todas en `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/377a657e-784a-4a3c-a734-92efcebff73e/scratchpad/rev-u7-T01/`:

- `full.txt`
- `CA-23.txt`
- `CA-569.txt`
- `trends-A-free.txt`
- `trends-A-paid.txt`
- `trends-B.txt`
- `trends-B-q.txt`
- `progress-logs.txt`
- `pf-progress.log`
- `pf-identity.log`
- `pf-ingestion.log`

Los JWT están en `jwt-a` y `jwt-b` de esa misma carpeta, sin imprimir; conviene borrarlos.

```
VEREDICTO: NO-VERDE
ROJO|CA-9 apps/progress-service/src/__tests__/trends.test.ts (silencio de logs)|el test de logs no cubre cada fallo de CA-6 ni los valores de score: sobreviven el JWT en el log (M7) y los scores en el log (M6)
INFORME: revisiones/u7-T01/ronda-1.md
```
