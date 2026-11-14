## Revisor — WS-T05 ronda 1

### Resultado por CA

| CA    | Estado              | Notas                                                                                                                                                             |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-1  | VERDE               | Dockerfile existe, 2 FROMs, `AS builder` presente                                                                                                                 |
| CA-2  | VERDE               | `.dockerignore` presente con `node_modules`, `*.db`/`*.sqlite`, `aidlc/`                                                                                          |
| CA-3  | VERDE               | `k8s/{deployment,service,configmap}.yaml` presentes con los 3 `kind:`                                                                                             |
| CA-4  | VERDE               | `proyecto-backend:v0.1.0` + `imagePullPolicy: Never`; no `latest`                                                                                                 |
| CA-5  | VERDE               | `readinessProbe` con `httpGet` sobre `path: /health` y `port: 3000`                                                                                               |
| CA-6  | VERDE               | `PORT: '3000'`, `NODE_ENV: 'production'` presentes en ConfigMap                                                                                                   |
| CA-7  | VERDE (con NARANJA) | No hay secretos reales; el segundo grep imprime 1 línea de bitácora (self-reference del propio regex), no imprime `no secrets in diff` como esperaba el enunciado |
| CA-8  | N.D.                | Docker no instalado en el entorno (NARANJA)                                                                                                                       |
| CA-9  | N.D.                | `kind` instalado pero sin Docker/cluster (NARANJA)                                                                                                                |
| CA-10 | N.D.                | kubectl no instalado (NARANJA)                                                                                                                                    |
| CA-11 | N.D.                | kubectl no instalado (NARANJA)                                                                                                                                    |
| CA-12 | N.D.                | kubectl no instalado (NARANJA)                                                                                                                                    |
| CA-13 | N.D.                | kubectl no instalado (NARANJA)                                                                                                                                    |
| CA-14 | N.D.                | kubectl no instalado (NARANJA)                                                                                                                                    |
| CA-15 | VERDE               | `Tests: 18 passed, 18 total` — 0 skipped                                                                                                                          |
| CA-16 | VERDE               | turbo `2 successful, 2 total`                                                                                                                                     |
| CA-17 | VERDE (con NARANJA) | No hay secretos reales en diff/tree; self-reference en bitácora y en tareas/*.md preexistentes                                                                    |
| CA-18 | VERDE               | rama `tarea/WS-T05`, 3 commits sobre `main` (≥2)                                                                                                                  |

### Hallazgos

**F-01 [NARANJA]** — CAs 8-14 no verificables en este entorno (Docker + kubectl + cluster kind)
Evidencia: `which docker` → `docker not found`; `which kubectl` → `kubectl not found`; `kind get clusters` → `ERROR: failed to list clusters: ... "docker": executable file not found in $PATH`.
La nota de la tarea anticipa este caso y pide reportar NARANJA por CA. Los CAs 8-14 constituyen el núcleo del smoke test de la tarea (la lectura-de-vuelta que prueba que el despliegue funciona end-to-end). La evidencia del codificador en la bitácora reconoce que no pudo correrlos tampoco. **El VERDE de la tarea depende de que esto se verifique por alguien con el entorno; la ronda 1 no lo demuestra.**

**F-02 [NARANJA]** — CA-7 segundo comando no imprime `no secrets in diff`
Evidencia:

```
$ git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff"
bitacoras/WS-T05.md:El comando CA-17 con `git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*..."` retorna
```

No hay secreto real: la línea matchea porque la propia bitácora cita el regex del comando. No hay cadenas `sk-ant-xxxx` ni asignaciones literales. Formalmente el CA pide que imprima `no secrets in diff`, pero la causa del match es texto de auditoría. Es NARANJA porque merece ajuste (al patrón del comando del enunciado o al texto de la bitácora), pero no es riesgo material.

**F-03 [NARANJA]** — CA-17 mismo defecto de self-reference, ya documentado pero sigue violando el output esperado
Evidencia:

```
$ git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff or tree"
bitacoras/WS-T05.md:...
revisiones/WS-T03/ronda-1.md:| 14  | Sin secretos en diff ni en tree ... |
tareas/WS-T03-stub-claude-client.md:...
tareas/WS-T04-sqlite-end-to-end.md:...
tareas/WS-T05-dockerfile-k8s-kind.md:...
```

El codificador documenta el issue en la bitácora (sección "CA-17 — nota sobre matches en archivos .md de tareas") y reconoce que es preexistente. No hay secretos reales; la clase ya se había observado en revisiones previas. Se agrupa con F-02 como una sola clase.

**F-04 [AMARILLO]** — Nota de la bitácora dice "2 commits sobre main"; el log muestra 3
Evidencia: la bitácora línea 134 afirma "2 commits sobre main" pero `git log --oneline main..HEAD | wc -l` imprime `3` (el tercero es `2a50aa3 WS-T05: bitácora actualizada con verificaciones CA-16/17/18`). CA-18 pide ≥2, así que cumple; solo es un desfase menor entre la bitácora y el estado actual.

**F-05 [AMARILLO]** — Worktree sucio antes y después del review
Evidencia: `git status --short` muestra modificaciones en `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-2e752e11864f.md` y `package-lock.json`. Esto estaba presente al inicio de la sesión (snapshot del env) y no fue causado por el revisor. Se reporta como observación: el bucle debería limpiar estos restos antes del handoff.

### Tareas candidatas (defectos reales fuera de alcance)

- Ajustar los patrones de los comandos CA-7/CA-17 (en el template de tareas) para que no hagan match con su propio texto en archivos de bitácora, revisiones o enunciados. P. ej., limitar el scope a archivos no-`.md` o filtrar matches donde el valor esté dentro de backticks/placeholders.

### Veredicto

**NO-VERDE**

NARANJA|CA-8 a CA-14|Smoke test completo del despliegue (Docker build + kind load + kubectl apply + wait Ready + /health + POST /critiques + cleanup port-forward) no verificado en esta ronda — Docker/kubectl no disponibles en el entorno del agente revisor
NARANJA|CA-7, CA-17|Comandos de secretos imprimen self-references de su propio regex (no son secretos reales) y no emiten el mensaje esperado
