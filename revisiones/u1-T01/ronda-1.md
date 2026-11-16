# Ronda 1 — u1-T01

VEREDICTO DEL REVISOR: NO-VERDE
VEREDICTO TRAS ARBITRAJE DEL ORQUESTADOR: **VERDE**

> _El revisor dio NO-VERDE basándose en F-01 (NARANJA, archivo aparentemente borrado en diff). El orquestador arbitra ese hallazgo como INVÁLIDO por malentendido sobre squash-merge. F-02 AMARILLO permanece como observación no-bloqueante. Resultado efectivo: VERDE. Ver sección "Arbitraje del orquestador" al final._

**Rama**: `tarea/u1-T01` · **HEAD SHA**: `48bba1f98a00436cb23251f3afe4a0cbba9f4f9f` · **Base**: `main` (merge-base `4bf9527`)

## Criterios de aceptación, verificados por el revisor

| #     | Criterio                                                | Comando que corrí                                                                                              | Resultado                                                                                                                                 |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CA-1  | workspace y deps                                        | `node -e '...package.json checks...'`                                                                          | **OK** `ok ingestion-service workspace`                                                                                                   |
| CA-2  | shared-types/uploads.ts + Zod + tsc                     | `test -f ...`, `grep`, `npx tsc --noEmit -p packages/shared-types`                                             | **OK** schema + `z.infer` + re-export, tsc exit 0                                                                                         |
| CA-3  | database.ts con tabla + índice                          | `grep CREATE TABLE IF NOT EXISTS uploads`, 8 columnas, `CREATE INDEX idx_uploads_user_id ON uploads (user_id)` | **OK**                                                                                                                                    |
| CA-4  | upload-repository.ts con create+randomUUID              | `grep create`, `grep randomUUID`, `grep "export (type\|interface) Upload"`                                     | **OK**                                                                                                                                    |
| CA-5  | magic-number.ts con 3 firmas                            | `grep detectImageKind`, firmas FF D8 FF, PNG, RIFF, WEBP                                                       | **OK**                                                                                                                                    |
| CA-6  | tests magic-number ≥5                                   | `npm test -w apps/ingestion-service -- --testPathPattern=magic-number --no-coverage`                           | **OK** 9 passed, 0 skipped                                                                                                                |
| CA-7  | blob-store.ts shape                                     | `grep writeBlob`, `mkdir recursive`, `BLOB_DIR`, no `req.*` en path                                            | **OK** `blob-store shape ok`                                                                                                              |
| CA-8  | 401 sin header                                          | `npm test` uploads suite                                                                                       | **OK** 2 tests 401 passed; literal `"unauthenticated"` en assert                                                                          |
| CA-9  | 202 happy path + DB readback + stored_filename ≠ client | `npm test` uploads suite                                                                                       | **OK** happy path verde con assert sobre `countByUserId`, `storedFilename` ≠ client                                                       |
| CA-10 | 413 > 10 MB sin escritura a BD                          | `npm test` uploads suite                                                                                       | **OK** test con `countBefore == countAfter`                                                                                               |
| CA-11 | 422 PDF renombrado con literal exacto                   | `npm test` + `grep "Invalid image format"` en handler y test                                                   | **OK** literal exacto en assert (línea 164 test, línea 100 handler)                                                                       |
| CA-12 | 422 sin campo file                                      | `npm test` uploads suite                                                                                       | **OK** 2 tests cubren `req.file undefined`                                                                                                |
| CA-13 | GET /health 200 shape                                   | `npm test -w apps/ingestion-service -- --testPathPattern=health`                                               | **OK** 2 passed, 0 skipped                                                                                                                |
| CA-14 | cobertura ≥80% L / ≥75% B                               | `npm test -- --coverage` + validador node                                                                      | **OK** `coverage ok ingestion-service service/ + handlers/`                                                                               |
| CA-15 | npm run lint                                            | `npm run lint`                                                                                                 | **OK** 5 successful, `ingestion-service` en scope (ver F-02)                                                                              |
| CA-16 | Dockerfile + build + tag + no latest                    | `grep` + `docker build` + `inspect`                                                                            | **OK** `sha256:22011c40...`, no `:latest`                                                                                                 |
| CA-17 | manifiestos K8s completos                               | 13 greps + conteo claves                                                                                       | **OK** `manifests ok`, ConfigMap=5 claves                                                                                                 |
| CA-18 | despliegue e2e en kind                                  | `kind load` + `kubectl apply` + `rollout restart` + `port-forward` + `curl POST` + `kubectl exec` readback     | **OK** `upload-in-kind ok, uploadId=c8f438b5-c9eb-4643-b6af-e28674aecf7e`, `uploads row count = 1`, blob `00b902cb-....jpg` creado en PVC |
| CA-19 | rama + ≥2 commits                                       | `git rev-parse --abbrev-ref HEAD` + `git log main..HEAD`                                                       | **OK** 2 commits sobre main                                                                                                               |
| CA-20 | sin secretos                                            | `git ls-files \| xargs grep -EH ...`                                                                           | **OK** sólo matches de texto de auditoría (patrón precedente WS-T03/u8-T01)                                                               |
| CA-21 | scope respetado                                         | 4 greps sobre diff                                                                                             | **OK por su comando literal** pero ver F-01 (arbitrado) y F-02                                                                            |
| CA-22 | backend /health regresión                               | `npm run start` + `curl /health`                                                                               | **OK** `backend health intact`                                                                                                            |

## Hallazgos del revisor

### F-01 · NARANJA · `revisiones/u11-T01/ronda-1.md` · El diff contra `main` muestra un archivo de otra tarea borrado — es artefacto de merge-base, no scope creep deliberado

El comando `git diff main..HEAD --name-only` lista `revisiones/u11-T01/ronda-1.md` como eliminado. Investigación del revisor:

- `git log --all -- revisiones/u11-T01/ronda-1.md` → único commit `7390a23` ("u11-T01: revisor ronda 1 (VERDE)").
- `git merge-base main tarea/u1-T01` → `4bf9527` (commit base de la ola 1).
- `git log main --oneline | head` muestra que `7390a23` está en `main` **después** del merge-base.
- `git diff 4bf9527..HEAD --name-only` NO incluye `revisiones/u11-T01/ronda-1.md`.

Conclusión del revisor: la rama `tarea/u1-T01` se separó antes de que u11-T01 fusionara `7390a23` a main. El codificador no borró deliberadamente nada. Pero esto distorsiona la lectura del diff y las pruebas futuras de CA-21 (los comandos literales no capturan este caso porque no coincide con los patrones `apps/backend/`, `k8s/*.yaml`, etc.). El bloque "Fuera" de la tarea sí prohíbe tocar `revisiones/`; el codificador debería haber rebasado la rama contra `main` antes de entregar, o al menos registrado en la bitácora que el diff aparente contiene un artefacto de rama no actualizada. No bloquea por sí solo, pero el merge a main va a perder `revisiones/u11-T01/ronda-1.md` si se squash-mergea tal cual.

**Recomendación del revisor**: rebasar `tarea/u1-T01` sobre `main` antes de merge, o resolverlo en el PR con un commit de merge de main que restaure `revisiones/u11-T01/ronda-1.md`.

### F-02 · AMARILLO · `eslint.config.js` (raíz) · Cambio a infra compartida añadiendo `coverage/**` a `ignores` — no documentado, no estrictamente necesario

El codificador modificó `eslint.config.js` (commit `4f5c4f6`) añadiendo:

```
'coverage/**',
'**/coverage/**',
```

Al array `ignores`. Evidencia de su efecto real:

- **CON** el parche: `npx turbo run lint --force` → `Tasks: 6 successful, 6 total` (limpio).
- **SIN** el parche (reverti temporalmente): `npx turbo run lint --force` → también `Tasks: 6 successful, 6 total`, pero `ingestion-service:lint` emite 3 `warning` ("Unused eslint-disable directive") sobre `apps/ingestion-service/coverage/lcov-report/*.js`.

CA-15 pasa en ambos casos (son warnings, no errors; turbo retorna exit 0). El comando CA-15 (`npm run lint 2>&1 | tail -5`) imprime "5 successful, 5 total" con o sin el parche. Por tanto:

1. El cambio NO era estrictamente necesario para que CA-15 pase.
2. El cambio es defensivo y razonable (afecta a cualquier workspace que corra `--coverage` en CI/local).
3. `coverage/` ya está en `.gitignore` (añadido por WS-T02); añadirlo también a eslint es consistente.
4. **No está justificado en la bitácora** — el codificador reportó CA-15 verde sin explicar por qué tocó `eslint.config.js`.
5. `eslint.config.js` NO aparece explícitamente en la lista "Fuera" de la tarea, pero sí lo hace el principio general: "cambios a `apps/backend/`, a `apps/identity-service/`, a sus manifiestos `k8s/*.yaml` existentes… (esta tarea sólo importa)" — se infiere que otras infras compartidas deberían dejarse quietas.

Dado el criterio explícito del orquestador ("si no rompe nada y es justificable como fix necesario para que CA-15 pase, puede ser AMARILLO"), y que **no es necesario** pero **no rompe nada**, mi juicio es **AMARILLO**: aceptable pero debería documentarse en la bitácora y ser una decisión consciente del orquestador para rondas futuras.

## Tareas candidatas identificadas por el revisor (renumeradas por el orquestador)

- **C-18** _(originalmente C-17 del revisor)_: SQLite efímero vs PVC persistente en ingestion-service — la tarea documenta explícitamente que `/app/data/ingestion.db` NO monta PVC. En CA-18 se ve el síntoma: hay 4 blobs en `/app/data/blobs` (persistidos del PVC) pero sólo 1 fila en la DB (COUNT=1). Después de cada restart, los blobs quedan huérfanos. Está documentado como deuda consciente ("persistencia real de la DB llega cuando se migre a PostgreSQL en una tarea aparte"). Candidata abierta para una tarea posterior.
- **C-19** _(originalmente C-18 del revisor)_: El codificador modificó `eslint.config.js` sin justificación en la bitácora. Sugerencia: mover `coverage/**` al `.gitignore` global del proyecto si se considera la decisión correcta, o escalar la decisión al orquestador. No acción en esta tarea.
- **C-20** _(originalmente C-19 del revisor)_: Rama `tarea/u1-T01` no rebasada contra `main` después del merge de u11-T01. Candidata para proceso: definir cuándo rebasar olas paralelas (p.ej. antes de dispatch del revisor, para eliminar artefactos de diff como F-01). Hygiene de rebase para olas que ya tienen una tarea verde intermedia.
- **C-21** _(originalmente C-20 del revisor)_: El `uploadId` (PK en BD) y el `stored_filename` (nombre del blob) son UUIDs INDEPENDIENTES (generados por repo y handler respectivamente). Es consistente con CA-4 y CA-9 (ambos dicen "server-side"), pero asocia uploadId a stored_filename sólo por la fila de BD. No es defecto en esta tarea; cualquier futura operación sobre blobs (p.ej. thumbnail, retrieve) debe usar la fila como fuente autoritativa. Candidata para documentación de arquitectura.

## Rutas de transcripciones largas

- Tarea: `/Users/aureliano/Desktop/proyecto-u1-T01/tareas/u1-T01-ingestion-service-upload.md`
- Bitácora del codificador: `/Users/aureliano/Desktop/proyecto-u1-T01/bitacoras/u1-T01.md`
- Resultados CA-18: `/tmp/u1-t01-upload-rev.json`, `/tmp/u1-count-rev.json`, `/tmp/u1-ls-rev.txt`
- Diff lint SIN patch vs CON patch: documentado inline en F-02

## Resumen del revisor

- 22/22 CAs pasan por su comando literal.
- 0 ROJO, 1 NARANJA (F-01), 1 AMARILLO (F-02).
- F-01 es un artefacto de merge-base, no un acto deliberado del codificador, pero sí distorsiona la auditoría y debería resolverse antes de merge para no perder `revisiones/u11-T01/ronda-1.md`.
- F-02 es un cambio a infraestructura compartida razonable pero sin justificación — pedir documentación o reversión al codificador.
- Worktree limpio al terminar; port-forwards matados.

---

## Arbitraje del orquestador

> El orquestador recibe el veredicto NO-VERDE del revisor y arbitra los hallazgos por identificador, según el contrato §3.

### F-01 · NARANJA · `revisiones/u11-T01/ronda-1.md` aparentemente borrado → **ARBITRADO: INVÁLIDO**

El hallazgo se basa en un malentendido sobre cómo funciona el "squash-merge" de GitHub. Explicación:

1. `git diff main..HEAD --name-only` muestra la proyección de los cambios de la rama **asumiendo** que main se mantuvo estático. Como la rama divergió en `4bf9527` y main avanzó a `7390a23` después, el diff compara `4bf9527 + cambios_rama` vs `7390a23`, y el archivo `revisiones/u11-T01/ronda-1.md` aparece como "falta en la rama".

2. **GitHub "Squash and merge" NO aplica ese diff tal cual**. Hace una fusión 3-way real:
   - Base: merge-base = `4bf9527` (donde divergieron).
   - Ours (main): `7390a23`, que añadió `revisiones/u11-T01/ronda-1.md`.
   - Theirs (rama): `48bba1f`, que no tocó ese archivo.
   - Regla del merge: si uno de los lados añadió un archivo y el otro no lo tocó, **el archivo queda** en el resultado.
   - El commit squashed se aplica sobre main actual (`7390a23+`), no sobre el merge-base.

3. Verificación (que el orquestador puede corroborar): `git merge-tree 4bf9527 main tarea/u1-T01 | grep "revisiones/u11-T01/ronda-1.md"` → ninguna coincidencia (nada que resolver sobre ese archivo). `git merge --squash tarea/u1-T01 --no-commit` dejaría el archivo intacto en el índice.

4. El revisor confundió "lo que muestra `git diff main..HEAD`" con "lo que se perderá al hacer squash-merge". Son cosas distintas.

**Decisión**: F-01 se cierra como **INVÁLIDO**. El archivo `revisiones/u11-T01/ronda-1.md` se conservará al fusionar el PR de u1-T01 vía GitHub. No se requiere rebase ni acción correctiva del codificador. Se abre la candidata **C-20** para documentar esta hygiene de proceso ("rebasar ola intermedia" vs "confiar en 3-way merge de GitHub") en un documento del equipo, para que futuras rondas no vuelvan a disparar este NARANJA.

### F-02 · AMARILLO · `eslint.config.js` modificado → **ARBITRADO: PERMANECE AMARILLO, SE ACEPTA**

La modificación es razonable (defensiva, consistente con `.gitignore`, no rompe nada). El revisor correctamente indica que no era estrictamente necesaria para CA-15, pero también correctamente la clasifica como AMARILLO (observación, no bloqueo). La bitácora no la justifica, pero el codificador la reportó en su entrega al orquestador.

**Decisión**: F-02 se mantiene como AMARILLO documentada. El cambio queda en el diff (no se revierte). Se abre la candidata **C-19** para auditar si `coverage/**` debería vivir en `.gitignore` global o en `eslint.config.js`, decisión de arquitectura del equipo, no de esta tarea.

### Veredicto arbitrado

Tras el arbitraje:

- 0 ROJO
- 0 NARANJA en pie (F-01 invalidado)
- 1 AMARILLO (F-02 aceptada como observación)

**VEREDICTO FINAL: VERDE**. La tarea u1-T01 queda lista para abrir pull request. El codificador no necesita ronda 2.

### Candidatas abiertas tras esta tarea

Total global: C-01 .. C-21 = 21 candidatas.

---

```
VEREDICTO DEL REVISOR: NO-VERDE
VEREDICTO TRAS ARBITRAJE: VERDE
INFORME: revisiones/u1-T01/ronda-1.md
```
