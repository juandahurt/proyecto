# Ronda 2 — u6-T01

VEREDICTO: VERDE

Los cinco hallazgos que había que cerrar (F-01 a F-05) están cerrados: mis propias mutaciones ahora hacen fallar los tests. Corrí los 15 criterios de aceptación y todos pasan. Las regresiones dan los mismos números que en main. Quedan dos AMARILLO nuevos, que no bloquean.

**Contexto verificado**

- **Archivo de tarea en main:** blob `05fdda87912a9db3a5c0b6cf552bd50d273cb6f4` y sha256 `13c95fe3…e4af`. Coinciden con los que me diste.
- **Worktree:** `/Users/aureliano/Desktop/proyecto-u6-T01`, en `f0990a1`, con base `c6fbf8c`.
- **Cambios en main desde la base:** entre `c6fbf8c` y `43deb87` solo cambian CANDIDATAS.md, la tarea y ronda-1.md, ningún archivo de código. Por eso sigue valiendo la línea base de la ronda 1: progress 38, ingestion 206, identity 74, trust 25, backend 18.
- **Preparación:** antes de probar corrí `npm ci` y compilé shared-types y auth-middleware. Recompilé shared-types después de cada mutación que lo tocaba y al final.
- **Estado al terminar:** `git status --short` sale vacío. Solo quedan artefactos ignorados (coverage, .turbo, dist, node_modules).

## Criterios de aceptación, verificados por mí

| #   | Comando                                                                             | Resultado                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | diff, grep, grep corregido anclado a `z.enum` (con `--include` entrecomillado), tsc | pasa: el diff lista solo trends.ts e index.ts; salen `sin tipos duplicados` y `tsc shared-types ok`                                                                           |
| 2   | `trend-calculator --verbose`                                                        | pasa: Suites 1/1, Tests 29/29, con FR-6.2, AC-6.1, la serie constante y los casos ±10                                                                                         |
| 3   | grep de bordes                                                                      | pasa: los 4 bordes y el umbral configurable                                                                                                                                   |
| 4   | grep AC/FR                                                                          | pasa: 3 calificados dan `uploadsNeeded` 1, 4 dan 0, AC-6.4, AC-6.3, el LOW defensivo y los dos tests nuevos de `low_confidence` con HIGH y con MEDIUM                         |
| 5   | grep orden/empate                                                                   | pasa                                                                                                                                                                          |
| 6   | `trend-config` y grep de `process.env`                                              | pasa: 13/13 y el grep sale vacío                                                                                                                                              |
| 7   | `trend-service`                                                                     | pasa: 11/11                                                                                                                                                                   |
| 8   | `trend`                                                                             | pasa: Suites 3/3, Tests 53/53, 0,85 s (funciones puras y servidor falso local, el tiempo se explica)                                                                          |
| 9   | rutas, `wc -l` y suite completa                                                     | pasa: `/health`, `/api/trends/history` y el 404; `wc -l` = 0; Suites 6/6, Tests 91/91 (38 + 53), sin skip, only ni todo                                                       |
| 10  | regresiones, turbo y prettier                                                       | pasa: ingestion 206 (11/11 suites), identity 74 (12/12), trust 25 (4/4), backend 18 (4/4); turbo con `--force` da 14/14 correctas y 0 en caché; prettier limpio sobre el diff |
| 11  | `--coverage`                                                                        | pasa: All files 100 % líneas y 97,29 % ramas; service 100/96,66; handlers 100/100; los tres trend-\* al 100 %; jest.config sin cambios                                        |
| 12  | dependencias                                                                        | pasa: no hay cambios de dependencias                                                                                                                                          |
| 13  | kubectl, solo lectura                                                               | pasa: imagen `progress-service:u5-T02`; el mismo pod `progress-service-6bd8bff8f6-rjrxc` con restarts=0; 0 archivos de k8s/                                                   |
| 14  | secretos                                                                            | pasa: salen las dos líneas `no secrets…`                                                                                                                                      |
| 15  | alcance y commits                                                                   | pasa: exactamente los 9 archivos esperados; 9 commits atómicos, cada uno con los archivos que nombra; el shard de auditoría no aparece                                        |

## Hallazgos de la ronda 1, comprobados con mutaciones mías (restauradas con `git checkout`)

- **F-01, cerrado.** Inyecté cada header envolviendo `fetchFn` en trend-service.ts. Con `cookie`, `x-user-id`, `x-forwarded-for`, `x-request-id`, `x-cualquiera` y un `Authorization` alterado cae 1 test en cada caso: Suites 1 fallida, Tests 1 fallido y 52 correctos.
- **F-02, cerrado.**
  - Quitar `item.status === 'ready' &&` hace caer 2 tests.
  - Cambiar `&&` por `||` en esa condición hace caer 3.
  - Probé también `!== 'processing'`: no compila, y solo se veía porque la línea `Tests:` bajó a 13 total (es justo lo que describe C-57). Como el enum solo tiene `ready` y `low_confidence`, esa variante equivale a quitar la condición, que sí se detecta.
- **F-03, cerrado.** Con cada mutación del `refine` cae un test: `&&` → `||` en cualquiera de las dos ramas, cada rama cambiada por `true`, cada rama reducida a solo slope o solo series, y la condición invertida (esta última hace caer 3).
- **F-04, cerrado.** `TrendPointSchema.shape.score === CategoryCritiqueSchema.shape.score` da `true` en el dist. Con `safeParse`, 0, 50 y 100 son válidos; -1, 101, 1.5 y "5" se rechazan.
- **F-05, cerrado.** Inyecté `console.debug` en el calculador y añadí temporalmente un test posterior que comprueba que `console.debug`, `console.log` y `stdout.write` ya no son mocks. Con la versión actual ese test pasa. Como control, con la versión `18d6f7f` falla, así que la restauración en `afterEach` funciona aunque falle una aserción.

**Repetición de las mutaciones de la ronda 1 (ninguna regresión).** Todas siguen haciendo caer tests:

- `>` → `>=` y `<` → `<=`: 1 cada una.
- Quitar `.reverse()`: 18.
- Mínimo fijo en 3: 9. Mínimo fijo en 4: 1.
- Quitar el filtro LOW: 1.
- Contar un item sin score como 0: 2.
- 4 categorías: 4.
- `console.debug` en el calculador: 3. `console.info` en el servicio: 9. `stdout.write` en el servicio: 9. `console.warn` solo en la rama de error: 7.

**El test de headers no es frágil entre versiones de Node.** Capturé los headers crudos que envía fetch en dos entornos:

- En el host: Node v26.13.0 con undici 8.12.2.
- En un contenedor desechable `node:20-slim` que ya estaba en local (`docker run --rm --pull=never --network none`, sin tocar el cluster): v20.20.2 con undici 6.24.1.

Los dos envían el mismo conjunto: host, connection, Authorization, accept, accept-language, sec-fetch-mode, user-agent=`node` y accept-encoding=`gzip, deflate`. Ese conjunto coincide exactamente con la lista cerrada del test.

## Hallazgos

### F-07 · AMARILLO · apps/progress-service/src/**tests**/trend-service.test.ts:96-106 · La lista cerrada comprueba nombres, no valores

Si se sobrescribe un header que fetch ya pone con un valor del cliente, la mutación sobrevive con 53/53. Lo probé con `'user-agent': 'cliente-1'`, `'accept-language': 'es-CO'` y `accept: 'text-html'`.

No bloquea por dos razones. La firma de `getTrends` solo recibe la cadena `authorization`, así que para filtrar headers del cliente habría que cambiar la interfaz. Y todas las clases de header pedidas en F-01 se detectan.

Como los valores son idénticos en Node 20 y 26 (lo verifiqué), se podría afirmar `accept`, `accept-language`, `sec-fetch-mode` y `user-agent` por valor.

### F-08 · AMARILLO · packages/shared-types/src/trends.ts:30 · Ningún test protege el dominio 0..100 de `TrendPointSchema.score`

Cambiar `score: CategoryCritiqueSchema.shape.score` por `z.number()` sobrevive con 53/53 (con el dist recompilado). La derivación es correcta y la verifiqué con `safeParse`, pero si alguien rompe el dominio, ningún test lo detecta.

### F-06 (de la ronda 1) · AMARILLO informativo · sin cambios

Sigue siendo un mutante equivalente. Lo acepto sin acción.

## Tareas candidatas (defectos reales fuera de alcance)

- **El grep de CA-1 no cubre enums escritos en varias líneas.** Aun corregido, es por línea: no casaría con un `z.enum([` duplicado cuyos valores van en líneas siguientes, que es justo como está escrito el enum original en `trends.ts:10`. Es un defecto de la especificación, no de la rama.
- **C-57 se confirma.** Una mutación que no compila hace que la línea `Tests:` muestre «13 passed, 13 total», sin ningún fallo. Los CA deberían hacer grep también de `Test Suites:`.
- **Siguen en pie las de la ronda 1:** conectar `loadTrendConfig(process.env)` al arrancar (u7), el `node_modules` desactualizado del árbol principal y que u13/C9 no tiene `TrendSnapshot` que borrar.

## Rutas de transcripciones largas

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u6-T01-r2/` (full.txt, calc.txt, ca8.txt, ca11.txt, turbo.txt, reg-\*.txt)

**Nota:** no tengo herramienta de escritura de archivos, así que no guardé el informe en disco. Este texto es el contenido de `revisiones/u6-T01/ronda-2.md`.

VEREDICTO: VERDE
AMARILLO|apps/progress-service/src/**tests**/trend-service.test.ts:96-106|La lista cerrada de headers comprueba nombres, no valores (sobrevive sobrescribir user-agent, accept o accept-language)
AMARILLO|packages/shared-types/src/trends.ts:30|Ningún test protege el dominio de TrendPointSchema.score (z.number() sobrevive)
INFORME: revisiones/u6-T01/ronda-2.md
