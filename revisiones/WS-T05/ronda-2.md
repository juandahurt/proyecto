# Revisión WS-T05 — Ronda 2

**Fecha:** 2026-11-14
**Rama revisada:** `tarea/WS-T05` @ `34a7e8a69772e5eb32fec12d43d40ea8af218895`
**Base:** `main` @ `cc93171` (merge-base confirmada)
**Archivo de tarea:** `tareas/WS-T05-dockerfile-k8s-kind.md` blob `9e7ce6d9…` — coincide con lo esperado.

## Criterios de aceptación, verificados por mí

### Estáticos (corridos en mi entorno)

| #     | Criterio                                                                   | Comando que corrí                                    | Resultado                                                                                                         |
| ----- | -------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| CA-1  | Dockerfile multi-stage                                                     | `test -f` + `grep -c "^FROM "` + `grep "AS builder"` | pasa — 2 FROM, `FROM node:20-slim AS builder`                                                                     |
| CA-2  | `.dockerignore` con patrones                                               | `grep node_modules / \.db                            | \.sqlite / aidlc`                                                                                                 | pasa — los tres patrones aparecen               |
| CA-3  | Deployment + Service + ConfigMap en `k8s/`                                 | `ls k8s/` + `grep -rl "kind:"`                       | pasa — `configmap.yaml`, `deployment.yaml`, `service.yaml`                                                        |
| CA-4  | Imagen `proyecto-backend:v0.1.0` + `imagePullPolicy: Never` + sin `latest` | `grep` sobre `k8s/*.yaml`                            | pasa — tag explícito + `Never` + `no latest`                                                                      |
| CA-5  | Readiness probe `httpGet` `/health` puerto 3000                            | `grep -A8 readinessProbe`                            | pasa — bloque completo con `path: /health` y `port: 3000`                                                         |
| CA-6  | ConfigMap con `PORT` y `NODE_ENV`                                          | `grep -E "PORT:                                      | NODE_ENV:"`                                                                                                       | pasa — `PORT: '3000'`, `NODE_ENV: 'production'` |
| CA-7  | Sin secretos literales en manifiestos/Dockerfile ni diff                   | `grep` doble                                         | pasa — único match es self-reference del propio regex en `bitacoras/WS-T05.md` (preexistente aceptado en ronda 1) |
| CA-15 | 18 tests del backend verdes, 0 skipped                                     | `npm test -w apps/backend`                           | pasa — `Tests: 18 passed, 18 total`                                                                               |
| CA-16 | Lint verde                                                                 | `npm run lint`                                       | pasa — turbo `2 successful, 2 total`                                                                              |
| CA-17 | Sin secretos en diff ni en tree                                            | `grep` sobre `git diff` y `git ls-files`             | pasa — todos los matches son self-reference de la regex en `.md` de proceso (preexistente aceptado en ronda 1)    |
| CA-18 | Rama `tarea/WS-T05` con ≥2 commits sobre `main`                            | `git log main..HEAD`                                 | pasa — 11 commits, Dockerfile y manifiestos en commits separados (`89ce9fa`, `c884363`)                           |

### Dinámicos (CAs 8-14): cruce de la evidencia adjunta por el orquestador

| #     | Criterio                                                                                                    | Evidencia adjunta                                                                                                                                                                                                   | Resultado                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-8  | `docker build` → `proyecto-backend:v0.1.0`                                                                  | `Successfully built 099eca1b14f5` / `Successfully tagged proyecto-backend:v0.1.0`; smoke de `better-sqlite3@12.11.1` dentro del contenedor devuelve `ok: [ { journal_mode: 'memory' } ]` (sin SIGSEGV)              | pasa — consistente con Dockerfile (2-stage, `node:20-slim`, `apt-get install python3 make g++`) y con `apps/backend/package.json` (`^12.11.1`)                    |
| CA-9  | `kind load docker-image proyecto-backend:v0.1.0`                                                            | `ID "sha256:099eca1b14f5bd65b…"` — prefijo coincide 1:1 con el short ID del build CA-8                                                                                                                              | pasa — mismo digest, mismo tag                                                                                                                                    |
| CA-10 | `kubectl apply` de los tres recursos                                                                        | `deployment.apps/proyecto-backend`, `service/proyecto-backend` (ClusterIP, 3000/TCP), `configmap/proyecto-backend-config` (3 claves) con label `app=proyecto-backend`                                               | pasa — coincide con los selectores/labels declarados en `k8s/*.yaml`                                                                                              |
| CA-11 | Pod Ready en ≤120 s                                                                                         | `rollout status … successfully rolled out`; `proyecto-backend-86b5cd97bf-lzcxm 1/1 Running`                                                                                                                         | pasa — probe `/health:3000` del Deployment responde dentro del timeout                                                                                            |
| CA-12 | `GET /health` shape `{data:{status:"ok"},error:null,status:200}`                                            | JSON escrito en `/tmp/ws05-health.json`: `{"data":{"status":"ok"},"error":null,"status":200}`; el `node -e` valida los tres campos literalmente antes de imprimir `health ok`                                       | pasa — shape literal verificado por lectura de vuelta (no exit code)                                                                                              |
| CA-13 | `POST /critiques` shape `{data:{id,response:{summary,categories}},error:null,status:200}` con `id` numérico | JSON escrito en `/tmp/ws05-critiques.json`; el `node -e` valida `typeof id === "number"`, `typeof summary === "string"`, `Array.isArray(categories)`, `error===null`, `status===200` → imprime `critiques ok, id=1` | pasa — shape coincide con el handler (`app.use('/critiques', …)`) y con el stub `SQLite`-first del skeleton; `id=1` es coherente con una BD efímera recién creada |
| CA-14 | Sin `kubectl port-forward` residual                                                                         | `pkill` + `pgrep -f 'kubectl port-forward'` vacío → `no leftover port-forward`                                                                                                                                      | pasa                                                                                                                                                              |

**Consistencia cruzada de la cadena build → cargar → desplegar**:

- Imagen declarada en Deployment (`image: proyecto-backend:v0.1.0`, `imagePullPolicy: Never`) ↔ construida con exactamente ese tag en CA-8 ↔ cargada con ese tag en CA-9 ↔ mismo SHA short `099eca1b14f5` en build y load. Cadena cerrada.
- Fix del codificador (ronda-4 bitácora): `better-sqlite3 ^13.0.3 → ^12.11.1` confirmado en `apps/backend/package.json`; base `node:20-slim` en ambos stages del Dockerfile (líneas 6 y 38); `apt-get install -y python3 make g++` en el builder (línea 18); smoke runtime dentro del contenedor (CA-8) demuestra que el fix funciona.
- Labels `app: proyecto-backend` consistentes entre Deployment (matchLabels y template), Service (selector) y ConfigMap — la resolución dinámica por label de los smoke tests es segura.
- `DB_PATH=/app/data/critiques.db` en ConfigMap ↔ `RUN mkdir -p /app/data` en runtime stage ↔ aceptación de ephemeral SQLite en el alcance de la tarea.

## Hallazgos

Ninguno.

Notas de descarte:

- **Self-reference del regex** en `bitacoras/WS-T05.md`, `revisiones/WS-T03/ronda-1.md`, `tareas/WS-T03/T04/T05-*.md`: preexistente, aceptado por el orquestador en ronda 1 (F-02/F-03). No se re-levanta.
- **`revisiones/WS-T05/ronda-1.md` aparece como `-71` en `git diff main..HEAD`**: no es un borrado del codificador. Ese archivo fue creado en `main` (commit `ce3e4d6`) **después** de la merge-base `cc93171`; la rama simplemente nunca lo tuvo. No es desborde ni edición destructiva.

## Alcance

El diff `main..HEAD` toca exactamente lo que la tarea permite:

- `apps/backend/Dockerfile` (nuevo), `.dockerignore` (nuevo), `k8s/{configmap,deployment,service}.yaml` (nuevos): dentro de alcance explícito.
- `apps/backend/package.json` y `package-lock.json`: cambio limitado a bajar `better-sqlite3` a `^12.11.1` para habilitar el build nativo en Docker arm64. Justificado y documentado en ronda-4 de la bitácora; no toca código TypeScript ni tests (lo que el alcance prohíbe explícitamente).
- `bitacoras/WS-T05.md`: artefacto de proceso, dentro de la convención.

Sin ingresos a `packages/shared-types`, `tareas/`, `revisiones/`, ni a código TypeScript del backend. Sin PVC, Secret, Ingress, Helm ni réplicas múltiples.

## Worktree

`git status` al inicio de la revisión: limpio salvo el archivo de auditoría que ya venía en staged (fuera del scope del revisor). Los comandos que corrí (`npm test`, `npm run lint`, `grep`, `git log`) no mutaron fuentes. Sin defecto del bucle.

## Veredicto

Todos los CAs estáticos los corrí yo y pasan. Para los CAs dinámicos 8-14, la evidencia adjunta por el orquestador es internamente consistente, cruza correctamente con los manifiestos y el Dockerfile commiteados (mismo tag `proyecto-backend:v0.1.0`, mismo SHA short `099eca1b14f5`, labels consistentes, `DB_PATH` coincidente), responde al shape literal exigido por cada CA (no se comprueba solo el código de salida — se lee de vuelta el JSON en `/tmp/ws05-*.json` y se valida con `node -e`), y confirma que el fix de ronda-4 (`better-sqlite3@12.11.1` + `node:20-slim` + build-tools) resuelve el SIGSEGV. No quedan hallazgos ROJO ni NARANJA en pie. Vale la pena fusionarlo.

```
VEREDICTO: VERDE
```
