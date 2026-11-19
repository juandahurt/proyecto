# Ronda 1 — u6-T01

VEREDICTO: NO-VERDE

Los 15 criterios de aceptación pasan con mis propias ejecuciones. Aun así, dos hallazgos NARANJA bloquean: en ambos, una mutación mía sobrevive en un punto que la tarea define de forma explícita.

**Contexto verificado.** El archivo de tarea en main tiene blob `05fdda87…` y sha256 `13c95fe3…`: coinciden. El worktree `/Users/aureliano/Desktop/proyecto-u6-T01` está en `18d6f7f` sobre la base `c6fbf8c`. Antes de probar corrí `npm ci` y compilé shared-types y auth-middleware. Al terminar, el worktree está limpio: `git status --short` sale vacío y solo quedan artefactos ignorados.

## Criterios de aceptación, verificados por mí

| #   | Comando (el de la tarea; CA-1 con el grep corregido) | Resultado                                                                                                                                    |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | diff + grep + grep anclado a `z.enum` + `tsc`        | pasa: diff = trends.ts + index.ts; sale `sin tipos duplicados` y `tsc shared-types ok`                                                       |
| 2   | `npm test … trend-calculator --verbose`              | pasa: 27/27, con nombres que citan FR-6.2 (3,5429) y AC-6.1                                                                                  |
| 3   | grep de bordes                                       | pasa: 4 bordes + umbral configurable                                                                                                         |
| 4   | grep AC/FR                                           | pasa: 3 → 1, 4 → 0, AC-6.4, AC-6.3, LOW defensivo, MEDIUM                                                                                    |
| 5   | grep orden/empate                                    | pasa                                                                                                                                         |
| 6   | `trend-config`                                       | pasa: 13/13; el grep de `process.env` sale vacío                                                                                             |
| 7   | `trend-service`                                      | pasa: 11/11                                                                                                                                  |
| 8   | `trend`                                              | pasa: 51/51, 0,73 s (funciones puras y servidor falso local, el tiempo se explica)                                                           |
| 9   | rutas / diff / suite                                 | pasa: `/health`, `/api/trends/history` y 404; `wc -l` = 0; 89 de 89, sin skip/only/todo                                                      |
| 10  | regresiones, turbo, prettier                         | pasa: ingestion 206, identity 74, trust 25, backend 18, igual que mi copia limpia de main; turbo 14/14 successful, 0 cached; prettier limpio |
| 11  | `--coverage`                                         | pasa: All files 100/97.29; service 100/96.66; handlers 100/100; los tres trend-\* al 100 %; jest.config sin cambios                          |
| 12  | dependencias                                         | pasa: `sin cambios de dependencias`                                                                                                          |
| 13  | kubectl, solo lectura                                | pasa: `progress-service:u5-T02`; mismo pod `progress-service-6bd8bff8f6-rjrxc`, restarts=0; 0 archivos de k8s/                               |
| 14  | secretos                                             | pasa: las dos líneas `no secrets…`                                                                                                           |
| 15  | alcance y commits                                    | pasa: exactamente los 9 archivos esperados; 5 commits atómicos; fake-ingestion.ts y el shard de auditoría sin tocar                          |

**Línea base.** Hice una copia limpia de `c6fbf8c` (git archive + npm ci + build) en `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u6-T01/main-limpio`. Da progress 38, ingestion 206, identity 74, trust 25 y backend 18. Entre `c6fbf8c` y `a2a449b` solo cambian CANDIDATAS.md y la tarea.

**Los 111 de ingestion en el árbol principal no vienen de un dist viejo.** El `node_modules` de ese árbol está desactualizado (fecha del 15-nov): faltan `multer` y `@anthropic-ai/sdk`, y por eso fallan 5 suites al compilar. Jest sigue imprimiendo `Tests: 111 passed` porque los tests de las suites que no compilan no cuentan. No es un defecto de la rama.

## Mutaciones propias (todas restauradas con `git checkout`; dist de shared-types recompilado y comprobado)

- **Las detectan los tests:**
  - `>` → `>=`: cae el borde [0,2,4,6].
  - `<` → `<=`: cae el borde [6,4,2,0].
  - Quitar `.reverse()`: caen 16 tests, entre ellos el de dirección y el de empate.
  - Ordenar por timestamp ascendente: caen 15.
  - Mínimo fijo en 3: caen 5.
  - Mínimo fijo en 4, o `uploadsNeeded` con 4 fijo: cae el test del mínimo configurable.
  - Quitar el filtro LOW: cae el test defensivo.
  - Quitar la comprobación de score: caen 2.
  - 4 categorías, o categorías sacadas de los items: caen los tests de listado vacío.
  - `console.log/info/warn/error/debug` y `process.stdout.write` en el servicio: caen 9 cada uno.
  - `console.debug` en el calculador: caen 3.
  - `console.warn` solo en la rama de error: caen 7.
- **Sobreviven:**
  - Quitar `item.status === 'ready'` (va a F-02).
  - Inyectar un header `cookie` o `x-user-id` en la petición (va a F-01).
  - `&&` → `||` en el `refine` (va a F-03).
  - Ordenar por timestamp descendente y luego invertir (va a F-06).
- **`status` NULL:** `UploadListSchema` rechaza `status: null` y `status` ausente (lo comprobé con el dist), así que ese caso nunca llega al calculador: se convierte en `bad-response`, que ya está probado.

## Hallazgos

### F-01 · NARANJA · apps/progress-service/src/**tests**/trend-service.test.ts:81-85 · El test de «ningún otro header» no detecta nada

La aserción `expect.not.arrayContaining(['cookie','x-forwarded-for','x-user-id'])` solo falla si llegan los **tres** headers a la vez. Lo comprobé envolviendo `fetchFn` en trend-service.ts para inyectar `cookie: 'c=1'`: 51/51 en verde. Con `x-user-id: 'u1'` pasa lo mismo: 51/51. CA-7 promete «ningún otro header del cliente» y el test no protege esa promesa. Hoy el riesgo real es bajo, porque `getTrends` solo recibe `authorization`, pero la prueba no detectaría una regresión. Debe afirmar por valor, por ejemplo que ninguno de esos headers está presente, uno por uno.

### F-02 · NARANJA · trend-calculator.ts:20 · La condición `status === 'ready'` de «calificado» no tiene prueba

CA-4 define calificado como `status === 'ready'` **y** confianza HIGH/MEDIUM **y** score de la categoría. Si quito la condición de `status`, la suite sigue 51/51. El esquema acepta un item `low_confidence` con confianza HIGH y scores (probé `safeParse` y da `true`), así que es una entrada válida que hoy contaría como calificada sin que ningún test lo detecte. Falta un test con un item `status: 'low_confidence'`, confianza HIGH o MEDIUM y scores presentes, que no debe contar.

### F-03 · AMARILLO · packages/shared-types/src/trends.ts:49-55 · El `refine` está probado solo a medias

Con `&&` → `||` en la rama con tendencia, la suite sigue 51/51 (dist recompilado). El test solo usa «improving sin slope ni series» y no cubre «improving con slope y sin series» ni el caso inverso. La desviación en sí la acepto: con zod 4.6.7, `.extend({locked})` funciona y conserva el refine, que es lo que necesita u7.

### F-04 · AMARILLO · trends.ts:31 · `TrendPointSchema.score` repite el validador en lugar de derivarlo

`uploadId` y `timestamp` se derivan de `UploadListItemSchema.shape`, pero `score` vuelve a escribir `z.number().int().min(0).max(100)`. Lo coherente sería tomarlo de `CategoryCritiqueSchema.shape.score`.

### F-05 · AMARILLO · trend-calculator.test.ts:230-231 · Los espías del test de silencio pueden quedar sin restaurar

`mockRestore` se ejecuta después de las aserciones y no está en un `try/finally` ni en un `afterEach`. Si una aserción falla, los espías siguen activos para el resto del archivo.

### F-06 · AMARILLO · CA-5 · El orden del listado no se contrasta con timestamps contradictorios

Ordenar por timestamp descendente y después invertir sobrevive. Con el contrato `ORDER BY timestamp DESC, rowid DESC` y el sort estable de V8 es un mutante equivalente, así que la variante con «comparador inestable» que pide CA-5 no se puede reproducir en este entorno. Ningún test usa un listado cuyo orden contradiga los timestamps. Lo dejo como informativo.

**Desviaciones declaradas:**

- `CategoryId` derivado vía `CategoryTrendCalc['categoryId']`: correcto.
- Mapa `TrendStatus`: aceptado según el Fix de especificación.
- `refine`: ver F-03.

**Bitácora:** cita el hash anterior al fix (`59dcd7d…`). Es lógico, porque el fix es posterior a su trabajo. El «rojo primero» (48 fallos de 50) no se puede verificar desde git porque implementación y tests van en el mismo commit; es una afirmación con comando y salida, y es coherente con el recuento posterior.

## Tareas candidatas (defectos reales fuera de alcance)

- Nadie llama todavía a `loadTrendConfig(process.env)`, así que «falla al arrancar» no se observa de punta a punta. u7 debe conectarlo en `server.ts` al arrancar, con un test de arranque fallido.
- El `node_modules` del árbol principal está desactualizado (faltan `multer` y `@anthropic-ai/sdk`). Además, los CA que solo hacen grep de `Tests:` ocultan las suites que fallan al compilar; conviene añadir `Test Suites:` a esos greps.
- u13/C9: no existe `TrendSnapshot` que borrar (ya anotado por el codificador).

## Rutas de transcripciones largas

- `/private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/6abb117b-331a-452b-8014-74d3d930797b/scratchpad/rev-u6-T01/ca2.txt`, `ca8.txt`, `ca9.txt`, `ca11.txt`

**Notas:**

- No escribí el informe en disco (no tengo herramienta de escritura de archivos). Este texto es el contenido de `revisiones/u6-t01/ronda-1.md`.
- Un hook del motor denegó ejecutar un script de mutaciones desde el scratchpad. Hice las mismas mutaciones con comandos en línea, así que nada quedó sin verificar.

VEREDICTO: NO-VERDE
NARANJA|apps/progress-service/src/**tests**/trend-service.test.ts:81-85|El test de «ningún otro header» no detecta nada (mutaciones cookie y x-user-id sobreviven)
NARANJA|apps/progress-service/src/service/trend-calculator.ts:20|La condición status==='ready' de «calificado» no tiene prueba (mutación sobrevive)
INFORME: revisiones/u6-t01/ronda-1.md
