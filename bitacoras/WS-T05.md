# WS-T05 — bitácora del codificador

## Acuse de lectura (ronda 1)

- hash de la tarea: `9e7ce6d9a0ab6eff753c91e2b8dafe7fbc3babf5` — coincide con el hash verificado por `git hash-object tareas/WS-T05-dockerfile-k8s-kind.md`
- dentro de alcance: Dockerfile multi-stage + .dockerignore + manifiestos k8s/ (Deployment, Service, ConfigMap) para desplegar `proyecto-backend:v0.1.0` en kind local
- fuera de alcance: Ingress, Secret K8s para Anthropic, PVC, registry externo, Helm/Kustomize, múltiples réplicas, liveness probe separada, cambios a código TypeScript o tests
- criterios de aceptación: 18, comandos enumerados:
  - CA-1: `test -f apps/backend/Dockerfile && grep -c "^FROM " ... && grep "AS builder"`
  - CA-2: `test -f .dockerignore && grep node_modules ... grep db|sqlite ... grep aidlc`
  - CA-3: `ls k8s/ && grep -rl "kind: Deployment" ... Service ... ConfigMap`
  - CA-4: `grep "proyecto-backend:v0.1.0" && grep "imagePullPolicy: Never" && grep -E "image:.*:latest"`
  - CA-5: `grep -A8 "readinessProbe" k8s/*.yaml`
  - CA-6: `grep -E "PORT:|NODE_ENV:" k8s/*.yaml`
  - CA-7: grep de secrets en manifiestos y diff
  - CA-8: `docker build -t proyecto-backend:v0.1.0 -f apps/backend/Dockerfile .`
  - CA-9: `kind load docker-image proyecto-backend:v0.1.0`
  - CA-10: `kubectl apply -f k8s/ && kubectl get deployment,service,configmap`
  - CA-11: `kubectl wait --for=condition=ready pod -l app=proyecto-backend --timeout=120s`
  - CA-12: port-forward + curl /health + validación node
  - CA-13: port-forward + curl POST /critiques + validación node
  - CA-14: `pkill -f "kubectl port-forward"` + verificar sin residuales
  - CA-15: `npm test -w apps/backend` (18 tests, 0 skipped)
  - CA-16: `npm run lint`
  - CA-17: grep de secrets en diff y tree
  - CA-18: `git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD`

## Ronda 1

### Estado previo — rojo por definición (par falla/pasa)

Antes de crear los manifiestos K8s, el Pod no existe. Si se ejecutaran CA-12 y CA-13
ahora, fallarían porque no hay Service ni Pod alguno en el clúster:

```
$ kubectl get pods -l app=proyecto-backend 2>&1
# (Fallo esperado: No resources found / cluster no configurado)
# El Pod "proyecto-backend" no existe aún — CA-12 y CA-13 fallarían.
```

Este es el estado "rojo" documentado. Los CAs pasan después de `kubectl apply` y `kubectl wait`.

### Verificación previa — tests pasan sin cambios

```
$ npm test -w apps/backend 2>&1 | tail -10
PASS src/__tests__/critique-repository.test.ts
PASS src/__tests__/anthropic-client.test.ts
PASS src/__tests__/health.test.ts
PASS src/__tests__/critiques-endpoint.test.ts

Test Suites: 4 passed, 4 total
Tests:       18 passed, 18 total
Snapshots:   0 total
Time:        1.975 s
```

### Cambios — commit 1: Dockerfile + .dockerignore

- `apps/backend/Dockerfile`: multi-stage con `builder` (Node 20 Alpine, instala deps, compila TS) y `runtime` (Node 20 Alpine slim, solo prod deps, CMD node dist/index.js)
- `.dockerignore`: excluye node_modules, .db/.sqlite, aidlc/, dist/, coverage/, .git/

Notas de diseño:

- Build context es la raíz del workspace (permite acceso a packages/shared-types/)
- El stage builder hace `npm ci` dentro del contenedor Linux para compilar better-sqlite3 para Linux
- Se crea /app/data en el runtime stage para SQLite efímera
- DB_PATH se configura via ConfigMap para apuntar a /app/data/critiques.db

### Cambios — commit 2: manifiestos k8s/

- `k8s/configmap.yaml`: ConfigMap con PORT=3000, NODE_ENV=production, DB_PATH=/app/data/critiques.db
- `k8s/deployment.yaml`: Deployment con imagePullPolicy: Never, readinessProbe httpGet /health:3000, envFrom configMapRef
- `k8s/service.yaml`: Service ClusterIP exponiendo puerto 3000

### Verde (a verificar por revisor con Docker/kind disponibles)

CA-8: `docker build -t proyecto-backend:v0.1.0 -f apps/backend/Dockerfile . 2>&1 | tail -5`
Esperado: build sin error, imagen presente.

CA-9: `kind load docker-image proyecto-backend:v0.1.0 2>&1`
Esperado: imagen cargada en kind.

CA-10: `kubectl apply -f k8s/ 2>&1`
Esperado: apply sin errores.

CA-11: `kubectl wait --for=condition=ready pod -l app=proyecto-backend --timeout=120s`
Esperado: pod/... condition met

CA-12: smoke test /health → imprime `health ok: {...}`
CA-13: smoke test POST /critiques → imprime `critiques ok, id=<número>`

Nota: Docker y kubectl no están disponibles en el entorno de ejecución de este
agente (shell sandboxed). Los CAs 8-14 requieren verificación manual con Docker Desktop
o equivalente instalado. Los CAs 1-7 y 15-18 son verificables sin Docker.

### CA-15 verde (re-verificado después de cambios)

```
$ npm test -w apps/backend 2>&1 | tail -10
Tests: 18 passed, 18 total — sin cambios al código TypeScript
```

### CA-16 verde

```
$ npm run lint 2>&1 | tail -6
backend:lint:

 Tasks:    2 successful, 2 total
Cached:    2 cached, 2 total
  Time:    13ms >>> FULL TURBO
```

### CA-17 — nota sobre matches en archivos .md de tareas

El comando CA-17 con `git ls-files | xargs grep -EH "sk-ant-|ANTHROPIC_API_KEY\s*=\s*..."` retorna
matches en archivos `tareas/*.md` y `revisiones/WS-T03/ronda-1.md`. Estos matches son el texto
literal del propio comando de grep escrito en los enunciados de las tareas anteriores (texto de
auditoría, no secretos reales). No hay valores de API key en el código, Dockerfile ni manifiestos.
Este es un comportamiento preexistente a esta tarea — los archivos tareas/*.md contienen el patrón
como texto del comando de auditoría, lo cual no representa un secreto en el repositorio.
El comando `git diff main..HEAD` (solo el diff de esta rama) devuelve `no secrets in diff`.

### CA-18 verde

```
$ git rev-parse --abbrev-ref HEAD && git log --oneline main..HEAD | head -10
tarea/WS-T05
c884363 WS-T05 (2/2): manifiestos K8s para despliegue en kind local
89ce9fa WS-T05 (1/2): Dockerfile multi-stage + .dockerignore para backend
```

2 commits sobre main. Rama correcta.
