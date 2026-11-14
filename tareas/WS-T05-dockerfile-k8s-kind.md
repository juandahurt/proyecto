# WS-T05 — Dockerfile multi-stage + manifiestos K8s para despliegue en kind

> **Quinta tarea del Walking Skeleton.** Empaca el backend en una imagen Docker
> multi-stage y la despliega en un clúster kind local, cerrando la hipótesis
> completa del skeleton: una petición HTTP llega al Pod, invoca el stub de
> Claude, persiste en SQLite efímero, y responde al cliente — todo dentro de
> Kubernetes.

**Unidad:** Bolt 1 — Walking Skeleton (u0-frontend)
**Historias que implementa:** ninguna todavía — cierra la capa de despliegue del skeleton
**Depende de:** WS-T04 (endpoint `POST /critiques` end-to-end en main)

---

## Alcance

**Dentro** (una línea, concreta):

> `apps/backend/Dockerfile` multi-stage (stage `builder`: instala deps + compila TypeScript; stage `runtime`: copia artefactos y prod deps, expone puerto 3000); `.dockerignore` en la raíz del workspace que excluye ruido del contexto de build; directorio `k8s/` con tres manifiestos YAML (Deployment, Service ClusterIP, ConfigMap); imagen taggeada `proyecto-backend:v0.1.0` (nunca `latest`) con `imagePullPolicy: Never`; cargada en el clúster kind por defecto con `kind load docker-image`; manifiestos aplicados con `kubectl apply -f k8s/`; Pod que alcanza estado `Ready` via readiness probe en `GET /health`; y smoke test por `kubectl port-forward` que verifica shape de `/health` y `POST /critiques`.

**Fuera** (rechazar aunque se vea roto):

- Ingress controller ni reglas de Ingress — el acceso es por `kubectl port-forward`
- `Secret` de Kubernetes para la clave de Anthropic — el stub no usa red
- Volumen persistente (PVC) para SQLite — BD efímera en el contenedor; pérdida al reiniciar el Pod es aceptable para el skeleton
- Registry externo (Docker Hub, ECR, ghcr.io) — carga directa con `kind load`
- Helm, Kustomize, Skaffold ni otro gestor de manifiestos — YAML directo
- Múltiples réplicas, HPA, PodDisruptionBudget — un solo Pod
- Liveness probe separada de la readiness probe — una única probe basta
- Cambios a código TypeScript del backend o sus tests
- Cambios a `packages/shared-types`, a `tareas/` ni a `revisiones/`

---

## Archivos de contexto

Rutas, no contenido pegado:

- `aidlc/spaces/default/memory/team.md` — reglas afirmadas: imágenes Docker con tag explícito (nunca `latest`), secretos en K8s Secret nunca en texto claro, smoke test post-despliegue obligatorio antes de declarar éxito
- `aidlc/spaces/default/memory/project.md` — `## Forbidden` / `## Mandated`: NEVER `latest` en manifiestos commiteados; ALWAYS verificar Pod `Ready` y `/health` antes de declarar despliegue exitoso; NEVER clave Anthropic en ficheros commiteados
- `apps/backend/src/index.ts` — entry point del backend (el CMD del runtime stage lo llama)
- `apps/backend/package.json` — scripts del package; el `start` que el CMD del runtime stage invoca
- `apps/backend/jest.config.js` — no cambiar; solo verificar que los tests siguen pasando

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los corre él mismo, desde la raíz del clon
`/Users/aureliano/Desktop/proyecto` con la rama `tarea/WS-T05` checada.

**Prerequisito del revisor**: tener un clúster kind en ejecución. Para crearlo: `kind create cluster`. Para listar: `kind get clusters`. Para verificar que el contexto kubectl apunta al kind: `kubectl config current-context` (debe devolver `kind-kind`).

- [ ] **CA-1** — `apps/backend/Dockerfile` existe y contiene al menos dos etapas (`FROM … AS builder` y una segunda `FROM …` de runtime)

  ```bash
  test -f apps/backend/Dockerfile
  grep -c "^FROM " apps/backend/Dockerfile
  grep "AS builder" apps/backend/Dockerfile
  ```

  Esperado: archivo existe, el `grep -c` imprime ≥2, `AS builder` aparece en la primera etapa.

- [ ] **CA-2** — `.dockerignore` existe en la raíz del workspace (el contexto de build es `.`) y excluye `node_modules`, archivos `.db`/`.sqlite`, y el directorio `aidlc/`

  ```bash
  test -f .dockerignore
  grep "node_modules" .dockerignore
  grep -E "\.(db|sqlite)" .dockerignore
  grep "aidlc" .dockerignore
  ```

  Esperado: `.dockerignore` existe y todos los patrones aparecen.

- [ ] **CA-3** — `k8s/` contiene al menos un Deployment, un Service y un ConfigMap (pueden estar en archivos separados o en un único YAML multi-documento)

  ```bash
  ls k8s/
  grep -rl "kind: Deployment" k8s/
  grep -rl "kind: Service" k8s/
  grep -rl "kind: ConfigMap" k8s/
  ```

  Esperado: los tres `kind:` aparecen en archivos dentro de `k8s/`.

- [ ] **CA-4** — El Deployment referencia la imagen `proyecto-backend:v0.1.0` (tag explícito) con `imagePullPolicy: Never`; `latest` está ausente

  ```bash
  grep "proyecto-backend:v0.1.0" k8s/*.yaml
  grep "imagePullPolicy: Never" k8s/*.yaml
  grep -E "image:.*:latest" k8s/*.yaml && echo "FAIL: latest encontrado" && exit 1 || echo "no latest"
  ```

  Esperado: imagen con tag explícito presente, `imagePullPolicy: Never` presente, imprime `no latest`.

- [ ] **CA-5** — Readiness probe en el Deployment usa `httpGet` con `path: /health` y el puerto del contenedor (3000)

  ```bash
  grep -A8 "readinessProbe" k8s/*.yaml
  ```

  Esperado: bloque `readinessProbe` con `httpGet`, `path: /health`, y `port: 3000` (o el nombre del containerPort correspondiente).

- [ ] **CA-6** — ConfigMap define al menos las claves `PORT` y `NODE_ENV`

  ```bash
  grep -E "PORT:|NODE_ENV:" k8s/*.yaml
  ```

  Esperado: ambas claves aparecen en el ConfigMap.

- [ ] **CA-7** — Ningún manifiesto en `k8s/` ni el Dockerfile contienen secretos en texto claro; el diff de la rama tampoco los incluye

  ```bash
  grep -EH "(sk-ant-|password\s*=\s*['\"]?[^'\"\s]+|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+)" k8s/*.yaml apps/backend/Dockerfile 2>&1 | grep -v "process.env" || echo "no secrets in manifests"
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff"
  ```

  Esperado: ambas líneas imprimen `no secrets …`.

- [ ] **CA-8** — `docker build` termina en exit 0 con la imagen `proyecto-backend:v0.1.0` construida desde la raíz del workspace

  ```bash
  docker build -t proyecto-backend:v0.1.0 -f apps/backend/Dockerfile . 2>&1 | tail -5
  docker images proyecto-backend:v0.1.0 --format "{{.Repository}}:{{.Tag}}"
  ```

  Esperado: build sin error, `docker images` imprime `proyecto-backend:v0.1.0`.

- [ ] **CA-9** — La imagen se carga en el clúster kind por defecto con `kind load docker-image`

  ```bash
  kind load docker-image proyecto-backend:v0.1.0 2>&1
  ```

  Esperado: `kind load` termina sin error (imprime algo como `Image: "proyecto-backend:v0.1.0" with ID "sha256:…" not yet present on node "kind-control-plane", loading…` y al final `Loaded`).

- [ ] **CA-10** — `kubectl apply -f k8s/` aplica los recursos sin errores y los tres aparecen en el clúster

  ```bash
  kubectl apply -f k8s/ 2>&1
  kubectl get deployment,service,configmap --show-labels 2>&1 | grep "proyecto-backend"
  ```

  Esperado: `apply` sin errores, los tres recursos con el label `app=proyecto-backend` aparecen listados.

- [ ] **CA-11** — El Pod alcanza estado `Ready` según la readiness probe (máximo 120 s)

  ```bash
  kubectl wait --for=condition=ready pod -l app=proyecto-backend --timeout=120s 2>&1
  kubectl get pods -l app=proyecto-backend
  ```

  Esperado: mensaje `pod/… condition met`; Pod en estado `Running` con `READY 1/1`.

- [ ] **CA-12** — Smoke test `GET /health` via `kubectl port-forward` responde `{data:{status:"ok"},error:null,status:200}` (lectura de vuelta con shape real)

  ```bash
  rm -f /tmp/ws05-health.json /tmp/ws05-pf.pid
  kubectl port-forward svc/$(kubectl get svc -l app=proyecto-backend -o jsonpath='{.items[0].metadata.name}') 3101:3000 >/tmp/ws05-pf.log 2>&1 &
  echo $! > /tmp/ws05-pf.pid
  sleep 3
  curl -sf http://localhost:3101/health -o /tmp/ws05-health.json
  kill $(cat /tmp/ws05-pf.pid) 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/ws05-health.json","utf8")); if(r.data?.status!=="ok"||r.error!==null||r.status!==200) throw new Error("health broken: "+JSON.stringify(r)); console.log("health ok: "+JSON.stringify(r))'
  ```

  Esperado: imprime `health ok: {…}`.

- [ ] **CA-13** — Smoke test `POST /critiques` via port-forward responde shape `{data:{id,response:{summary,categories}},error:null,status:200}` con `id` numérico (lectura de vuelta, no código de salida)

  ```bash
  rm -f /tmp/ws05-critiques.json /tmp/ws05-pf2.pid
  kubectl port-forward svc/$(kubectl get svc -l app=proyecto-backend -o jsonpath='{.items[0].metadata.name}') 3102:3000 >/tmp/ws05-pf2.log 2>&1 &
  echo $! > /tmp/ws05-pf2.pid
  sleep 3
  curl -sf -X POST http://localhost:3102/critiques \
    -H "Content-Type: application/json" \
    -d '{"input":"una foto de prueba end-to-end skeleton"}' \
    -o /tmp/ws05-critiques.json
  kill $(cat /tmp/ws05-pf2.pid) 2>/dev/null; sleep 1
  node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/ws05-critiques.json","utf8")); if(r.error!==null||r.status!==200||typeof r.data?.id!=="number"||typeof r.data?.response?.summary!=="string"||!Array.isArray(r.data?.response?.categories)) throw new Error("critiques broken: "+JSON.stringify(r)); console.log("critiques ok, id="+r.data.id)'
  ```

  Esperado: imprime `critiques ok, id=<número>`.

- [ ] **CA-14** — No quedan procesos `kubectl port-forward` residuales del smoke test

  ```bash
  pkill -f "kubectl port-forward" 2>/dev/null; sleep 1
  test -z "$(pgrep -f 'kubectl port-forward')" && echo "no leftover port-forward" || echo "FAIL: port-forward residual"
  ```

  Esperado: imprime `no leftover port-forward`.

- [ ] **CA-15** — Los tests existentes del backend siguen pasando íntegramente (18 tests, 0 skipped)

  ```bash
  npm test -w apps/backend 2>&1 | tail -10
  ```

  Esperado: suite completa verde, el resumen muestra los mismos tests que WS-T04 (18 aprox.), 0 skipped.

- [ ] **CA-16** — `npm run lint` desde la raíz pasa

  ```bash
  npm run lint 2>&1 | tail -5
  ```

  Esperado: exit 0, turbo reporta `successful`.

- [ ] **CA-17** — Ningún secreto ni credencial entra al diff ni al tree

  ```bash
  git diff main..HEAD --name-only | xargs -r grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 || true
  git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?[^'\"\s]+" 2>&1 | grep -v "process.env.ANTHROPIC_API_KEY" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff or tree`.

- [ ] **CA-18** — Rama `tarea/WS-T05` sobre `main` con ≥2 commits (Dockerfile + manifiestos merecen commits separados)

  ```bash
  git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD | head -10
  ```

  Esperado: rama actual `tarea/WS-T05`, al menos 2 commits sobre `main`.

---

## Plan de pruebas

No hay tests Jest nuevos en esta tarea (es infraestructura, no lógica de negocio). Los smoke tests de CA-12 y CA-13 son la evidencia de correctitud del despliegue. Los tests existentes deben seguir pasando:

```bash
npm test -w apps/backend 2>&1 | tail -10
```

**El par falla/pasa de esta tarea es el smoke test:** antes de aplicar los manifiestos el Pod no existe y CA-12/CA-13 fallarían; después de `kubectl apply` y del `kubectl wait`, pasan. El codificador documenta ese par en la bitácora.

---

## Notas

- **Build context es la raíz del workspace**: el `docker build` se corre desde `/Users/aureliano/Desktop/proyecto`, no desde `apps/backend/`. Esto permite al Dockerfile acceder a `packages/shared-types/`. Comando completo: `docker build -t proyecto-backend:v0.1.0 -f apps/backend/Dockerfile .`

- **Multi-stage y dependencias nativas**: el stage `builder` instala todo con `npm ci` dentro del contenedor Linux — así `better-sqlite3` compila su binario nativo para Linux, correcto para los nodos kind (también Linux). No copies `node_modules` del host (macOS); se compilan dentro.

- **imagePullPolicy: Never es obligatorio**: sin él, el nodo kind intentará hacer pull de Docker Hub y fallará con `ImagePullBackOff`. El campo va en la spec del contenedor del Deployment.

- **SQLite efímera**: `DB_PATH=/app/data/critiques.db` dentro del contenedor. Crea el directorio en el Dockerfile (`RUN mkdir -p /app/data`). La BD se pierde al reiniciar el Pod — aceptable para el skeleton.

- **Labels consistentes**: el `selector.matchLabels` del Deployment, el `selector` del Service, y el `metadata.labels` del podTemplate deben coincidir. Ejemplo: `app: proyecto-backend`. Las queries de CA-10, CA-11, CA-12, CA-13 y CA-14 asumen ese label.

- **Puertos del smoke test**: CA-12 usa el host port `3101` y CA-13 usa `3102` para evitar conflictos con cualquier server local corriendo en el 3000.

- **Nombre del Service**: CA-12 y CA-13 lo resuelven dinámicamente con `kubectl get svc -l app=proyecto-backend -o jsonpath='{.items[0].metadata.name}'`. El codificador puede elegir cualquier nombre, siempre que el label esté en el Service.

- **Nada de kubectl apply en main, nada de docker push, nada de merge.** Esta tarea despliega en el clúster kind local como parte del smoke test; no afecta ningún entorno compartido.

- **Disciplina del alcance**: si un CA topa con un bloqueo preexistente que no pertenece al alcance de esta tarea, para y empuja de vuelta al orquestador; no lo arregles por tu cuenta aunque parezca trivial.

---

_Tarea redactada por el orquestador. Rama destino: `tarea/WS-T05`. Base: `main`. Modelo de aislamiento: rama directa en el clon `/Users/aureliano/Desktop/proyecto` (sin worktrees). Esta tarea cierra el Walking Skeleton completo: HTTP → stub Claude → SQLite → respuesta, corriendo en un Pod de Kubernetes local._
