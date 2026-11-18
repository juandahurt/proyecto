# Ronda 1 — u3-T02

VEREDICTO: VERDE

Verifiqué la tarea antes de empezar: git blob `99349d0916df40a211c7fcb812bbf77c71c39237` y sha256 `1eefc201…f4331c`, los dos coinciden. Worktree en `tarea/u3-T02` @ `27c85ab`, merge-base = `main` @ `a75e8c2`. Compilé shared-types y auth-middleware antes de correr nada. El worktree quedó **limpio** al terminar (`git status --short` vacío) y no hice ningún `stash` propio.

## Criterios de aceptación, verificados por mí

| #   | Criterio                                       | Comando que corrí                                   | Resultado                                                                                                                                                                      |
| --- | ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `maxRetries: 0` en el constructor, diff mínimo | los dos de CA-1                                     | pasa: línea 112 `new Anthropic({ apiKey, maxRetries: 0 })`. Diff de 3 líneas: 1 quitada, la del constructor más 1 de comentario añadidas. No cambian timeout, modelo ni prompt |
| 2   | Test que fija la opción y falla si se quita    | grep `--verbose` de CA-2 y mis mutaciones (abajo)   | pasa: `✓ construye el cliente con maxRetries 0 (…) y la apiKey de prueba`                                                                                                      |
| 3   | Independiente del orden                        | `-t "maxRetries"` solo; `claude-client --runInBand` | pasa: 1 passed y 17 skipped (los 17 son el filtro `-t`, es lo esperado; 0,65 s). 2 suites, 32 passed                                                                           |
| 4   | Regresiones y tsc                              | suite completa ingestion, `tsc` ingestion y backend | pasa: 11 suites, 178 passed, 0 skipped, incluido el contract test. Ningún `.skip`/`.only`/`xit` en `src`. `tsc` exit 0 en los dos                                              |
| 5   | Cobertura por archivo en service/ y handlers/  | comando de CA-5                                     | pasa: `coverage ok ingestion-service service/ + handlers/`. claude-client.ts al 100/100                                                                                        |
| 6   | Plantilla con el CA de secretos                | los 4 comandos de CA-6                              | pasa: coincidencias en las líneas 66 y 69, `plantilla: árbol excluye bitacoras/revisiones, diff no excluye nada`, `no secrets in diff or tree`                                 |
| 7   | Lint y Prettier                                | `turbo run lint --force`, `prettier --check …`      | pasa: 6/6, 0 cached, exit 0 (1 warning ya existente en identity-service, 0 errores). Prettier: todos los archivos conformes                                                    |
| 8   | Sin dependencias, k8s ni despliegue            | CA-8 (lectura con kubectl)                          | pasa: `no dependency changes`, `k8s intacto`, imagen `ingestion-service:u4-T02` (la misma que registra la bitácora); generation y observedGeneration 13/13                     |
| 9   | Sin secretos en el diff                        | CA-9                                                | pasa: `no secrets in diff`                                                                                                                                                     |
| 10  | Alcance                                        | CA-10                                               | pasa: `scope respected`. Exactamente los 4 archivos permitidos                                                                                                                 |
| 11  | Rama y commits                                 | CA-11                                               | pasa: `tarea/u3-T02`, 3 commits (C-22, C-29 y bitácora), cada uno solo con los archivos de su mensaje                                                                          |

En CA-8 y CA-10 corrí la misma tubería sin el `exit 1` final para no cerrar mi shell. Como el grep no devolvió nada, el resultado es el mismo.

### Mutaciones propias (Lección 16), todas restauradas con `git checkout --`

- **M1**, borrar `maxRetries: 0` (queda `new Anthropic({ apiKey })`): `✕`, falla la aserción con `Expected: 0 / Received: undefined`. No es un error de compilación.
- **M2**, `maxRetries: 2`: `✕`, `Expected: 0 / Received: 2`.
- **M3**, cambiar la `apiKey` pasada al constructor: `✕`, `Expected: "test-key-not-real" / Received: "otra"`. Confirma que también se comprueba la apiKey.
- **M4**, quitar `Ctor.mockClear()` del test: `✕` con el archivo completo, `Expected number of calls: 1 / Received: 2`. El `mockClear` es necesario de verdad y la aserción `toHaveBeenCalledTimes(1)` detecta si falta.

### C-29: la plantilla se ejecuta tal cual

Saqué las 2 líneas `git …` del bloque CA-N de `_plantilla.md` a un script de mi scratchpad y las corrí con zsh y con bash. Con el árbol limpio imprimen `no secrets in diff` y `no secrets in diff or tree`. Luego metí un literal falso con forma de clave, generado al vuelo y nunca guardado:

- en `bitacoras/u3-T02.md`, que está en el diff: el barrido del **diff lo detecta**; el del árbol no, como debe ser;
- en `claude-client.real.test.ts`: lo detectan **los dos** barridos;
- en `revisiones/WS-T01/arbitraje-ronda-1.md`, rastreado y fuera del diff: no lo detecta ninguno, así que el árbol excluye `revisiones/`.

El barrido del diff no excluye nada y el del árbol excluye `bitacoras/` y `revisiones/`. Lo comprobé ejecutándolo, no solo leyéndolo. Restauré los tres archivos.

## Hallazgos

### F-01 · AMARILLO · tareas/\_plantilla.md:48,52 · Líneas en blanco añadidas en CA-1/CA-2 sin documentar en la bitácora

El diff añade 4 líneas en blanco alrededor de los bloques de código de CA-1 y CA-2, que la tarea dice no tocar («No se toca ningún otro párrafo»). Las mete el hook lint-staged, que corre Prettier, y son obligatorias: `git show main:tareas/_plantilla.md | npx prettier --stdin-filepath tareas/_plantilla.md` produce justo esas dos inserciones. Es decir, la plantilla de `main` no pasa Prettier y CA-7 no podría pasar sin ellas. Solo cambian espacios en blanco, así que no lo considero desborde. Pero la bitácora no lo menciona, y debería.

### F-02 · AMARILLO · tareas/\_plantilla.md:62-69 · Formato distinto entre bloques

El bloque CA-N nuevo no lleva líneas en blanco alrededor del bloque de código, y los CA-1/CA-2 reformateados sí. Prettier acepta las dos formas, así que es solo estético.

### Observación (defecto de especificación del orquestador, no del codificador)

El grep de CA-6 `grep -nE "no cites literales|C-29"` distingue mayúsculas. La nota de la plantilla dice «No cites…», así que solo coincide por «C-29». No cuenta contra el codificador, y él mismo lo anotó en la bitácora. Del mismo modo, el primer grep de CA-6 (`grep -n "bitacoras|revisiones"`, sin `-E`) busca la cadena literal con la barra. Coincide porque la regex de la plantilla contiene esa cadena tal cual, no porque compruebe las dos palabras por separado.

### Evidencia de la bitácora

Lo que afirma la bitácora (178 tests, 32 en runInBand, líneas 66/69, imagen u4-T02, mutaciones M1/M2) coincide con mis propias ejecuciones contra el diff actual. No encontré evidencia que no pudiera haber salido de este diff.

## Tareas candidatas (defectos reales fuera de alcance)

- La línea del barrido de árbol de la plantilla usa `xargs grep` sin `-r`, mientras que la del diff sí lo lleva. En macOS da igual, pero en GNU sin entrada ejecutaría `grep` sobre stdin. Copia el molde de u4-T02, así que se resolvería en las tareas futuras. Es menor.

## Rutas de transcripciones largas

- /private/tmp/claude-501/-Users-aureliano-Desktop-proyecto/9b73aba0-3b95-41f0-b3d7-ce3d7e308465/scratchpad/rev-u3-T02/plantilla-can.sh (las 2 líneas extraídas de la plantilla y ejecutadas tal cual)

```
VEREDICTO: VERDE
AMARILLO|tareas/_plantilla.md:48,52|Líneas en blanco de Prettier en CA-1/CA-2 no documentadas en la bitácora
AMARILLO|tareas/_plantilla.md:62-69|CA-N sin líneas en blanco, a diferencia de CA-1/CA-2
INFORME: revisiones/u3-T02/ronda-1.md
```
