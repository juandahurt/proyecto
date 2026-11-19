# u14-T01 — Volumen persistente (PVC) para identity-service y trust-service, y despliegue de identity con bcrypt 6

**Unidad:** u14 — persistencia de identity y trust (infraestructura, C-43; unidad nueva, sin historias)
**Historias que implementa:** ninguna (corrige la pérdida de usuarios, suscripciones y onboarding en cada reinicio; gate de calidad del MVP)
**Depende de:** u8-T03 (bcrypt 6 en `main`, ya fusionada, #19), u12-T01 (trust ya desplegado)

**Decisiones del humano (ola 9, 2026-11-18):**

- **PVC por servicio** (identity y trust), como `ingestion-blobs`. Descartada la opción de aceptar la pérdida de datos.
- **Acepta perder los usuarios, suscripciones y onboarding de prueba** que hoy viven en los `emptyDir`. Al migrar, el pod nuevo arranca con la base vacía. No hay datos que migrar.
- Esta tarea **sí despliega** y **sí toca el cluster**. Los permisos de cluster no se heredan: el orquestador los pide al humano antes de despachar y se los da al codificador **exactos** (ver «Notas»).

> **Contexto.** `k8s/identity/deployment.yaml` y `k8s/trust/deployment.yaml` montan `data-volume` como `emptyDir: {}` en `/app/data`. Cualquier reinicio del pod borra `identity.db` / `trust.db`, mientras que los uploads de ingestion (PVC) conservan `user_id` huérfanos. El pod de identity corre `identity-service:u10-T01` (bcrypt 5): la imagen con bcrypt 6 (código en `main` desde #19) nunca se desplegó porque reiniciar identity destruía los datos. Esta tarea resuelve ambas cosas a la vez.

---

## Alcance

**Dentro** (una línea, concreta):

> Crear un `PersistentVolumeClaim` para identity (`identity-data`) y otro para trust (`trust-data`), montarlos en `/app/data` en lugar del `emptyDir` con `strategy: Recreate`, construir y desplegar la imagen de identity con bcrypt 6 con un tag nuevo, y demostrar con lectura de vuelta que un usuario sobrevive a un reinicio del pod en cada servicio.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Cambiar código de `apps/*/src/`** o `packages/*`. Esta tarea solo toca `k8s/identity/`, `k8s/trust/` y su bitácora. Si algo del código parece mal, anótalo como candidata.
- **Reconstruir o cambiar la imagen de trust.** Sigue siendo `trust-service:u12-T01`; solo cambia su manifiesto. No hagas `docker build` ni `kind load` de trust.
- Tocar ingestion, progress, backend o sus manifiestos. **No reinicies esos pods.**
- C-45 (usuario no-root, `--omit=dev` en el runtime), C-48 (SIGTERM), tocar los Dockerfiles. Los contenedores corren como root, así que el volumen es escribible sin `securityContext` ni `fsGroup`; no los añadas.
- Backups, `VolumeSnapshot`, cambiar la `StorageClass`, o añadir réplicas. SQLite admite un solo escritor: `replicas: 1` y `Recreate`.
- Migrar datos del `emptyDir` viejo (decisión del humano: se pierden).
- Crear o leer Secrets. `jwt-secret` y `thumbnail-signing-key` ya existen; **nunca imprimas sus valores**.
- Borrar el PVC, la imagen sin etiqueta del humano (`99df974139d0`, C-53) ni ejecutar `docker image prune` o `docker system prune`.
- Matar el `kubectl port-forward` del humano a trust (PID 4456, puerto 3300).

---

## Archivos de contexto

Rutas, no contenido pegado:

- `k8s/ingestion/pvc.yaml` y `k8s/ingestion/deployment.yaml` (patrón a seguir: PVC `standard` `ReadWriteOnce`, `strategy: Recreate`, volumen por `claimName`)
- `k8s/identity/deployment.yaml`, `k8s/identity/configmap.yaml` (`DB_PATH=/app/data/identity.db`), `k8s/identity/service.yaml`
- `k8s/trust/deployment.yaml`, `k8s/trust/configmap.yaml` (`DB_PATH=/app/data/trust.db`), `k8s/trust/service.yaml`
- `apps/identity-service/Dockerfile` (solo lectura)
- `tareas/u8-T01-identity-service-register-login.md` (rutas y campos de registro y login), `tareas/u11-T01-trust-service-onboarding.md` y `tareas/u12-T01-data-policy.md` (rutas de onboarding de trust)
- `tareas/u5-T03-timestamp-millis.md` (patrón de CA de imagen: build, `kind load`, comparación del config digest, espera real al rollout)
- `CANDIDATAS.md` (C-43, C-45, C-53)
- `aidlc/spaces/default/memory/project.md` (reglas Forbidden/Mandated)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los va a correr él mismo, uno por uno. Las comillas en `grep --include='*.ts'` son obligatorias en zsh.

- [ ] **CA-1** — Alcance exacto: solo manifiestos y bitácora.

  ```bash
  git diff main...HEAD --name-only | sort
  ```

  Esperado: exactamente `bitacoras/u14-T01.md`, `k8s/identity/deployment.yaml`, `k8s/identity/pvc.yaml`, `k8s/trust/deployment.yaml`, `k8s/trust/pvc.yaml`. Ningún archivo de `apps/`, `packages/`, `package-lock.json` ni Dockerfiles. El shard `audit/typewriter-local-*` no aparece.

- [ ] **CA-2** — Los manifiestos usan PVC, ya no `emptyDir`, con `Recreate` y sin `latest`.

  ```bash
  for s in identity trust; do
    printf '%s\n' "== $s"
    grep -c "emptyDir" k8s/$s/deployment.yaml
    grep -nE "claimName: $s-data|type: Recreate|storageClassName: standard|ReadWriteOnce|replicas: 1" k8s/$s/deployment.yaml k8s/$s/pvc.yaml
    grep -nE "image: " k8s/$s/deployment.yaml
  done
  grep -rnE "image:.*:latest" k8s/ || echo "sin latest"
  kubectl apply --dry-run=client -f k8s/identity/pvc.yaml -f k8s/identity/deployment.yaml -f k8s/trust/pvc.yaml -f k8s/trust/deployment.yaml
  ```

  Esperado: el `grep -c emptyDir` da `0` en ambos; salen `claimName: identity-data` y `claimName: trust-data`, `type: Recreate`, `storageClassName: standard`, `ReadWriteOnce` y `replicas: 1`; las imágenes son `identity-service:u14-T01` y `trust-service:u12-T01` (la de trust no cambia); `sin latest`; el dry-run de cliente termina sin error (no toca el cluster).

- [ ] **CA-3** — La imagen de identity tiene bcrypt 6 y el tag es nuevo (nunca reutiliza `u10-T01`).

  ```bash
  docker build -f apps/identity-service/Dockerfile -t identity-service:u14-T01 .
  docker run --rm --entrypoint sh identity-service:u14-T01 -c 'cd /app/apps/identity-service && node -p "require(\"bcrypt/package.json\").version"'
  docker run --rm --entrypoint sh identity-service:u14-T01 -c 'cd /app && node -p "Object.keys(require(\"./package.json\")).length>0" >/dev/null; ls /app/node_modules | grep -cE "^(tar|node-pre-gyp)$"'
  docker images --filter "dangling=true" --format '{{.ID}} {{.CreatedSince}}'
  ```

  Esperado: el build termina bien; el primer `run` imprime una versión `6.x`; el segundo imprime `0` (ni `tar` ni `node-pre-gyp` en el runtime). Si el comando del segundo `run` no sirve tal cual, **corrígelo y anótalo con «atención»** (el orquestador no lo probó). La lista de imágenes sin etiqueta: **registra el ID nuevo de la etapa `builder` (C-53) en la bitácora y no lo borres** (lo borra el humano); no ejecutes `prune`.

- [ ] **CA-4** — Despliegue verificado por lectura de vuelta: PVC `Bound`, pods nuevos `Ready` con el PVC montado, y la imagen que corre es la que construiste.

  ```bash
  kubectl get pvc identity-data trust-data
  kubectl get pods -l app=identity-service -o jsonpath='{.items[*].spec.volumes[*].persistentVolumeClaim.claimName} {.items[*].status.containerStatuses[0].imageID} {.items[*].status.containerStatuses[0].ready}{"\n"}'
  kubectl get pods -l app=trust-service -o jsonpath='{.items[*].spec.volumes[*].persistentVolumeClaim.claimName} {.items[*].status.containerStatuses[0].ready}{"\n"}'
  docker image inspect identity-service:u14-T01 --format '{{.Id}}'
  docker exec kind-control-plane crictl inspecti identity-service:u14-T01 | grep -E '"id"|imageSpec' | head -3
  kubectl get deploy identity-service trust-service -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.strategy.type}{" "}{.spec.template.spec.containers[0].image}{"\n"}{end}'
  ```

  Esperado: ambos PVC en `Bound`; un solo pod por servicio, `Ready=true`, con `identity-data` / `trust-data`; el `imageID` del pod de identity corresponde al config digest de `docker image inspect` y al de `crictl inspecti` del nodo (misma comparación que u5-T03 CA de imagen; si no coinciden, reconstruye, `kind load` y repite); estrategia `Recreate` e imágenes `identity-service:u14-T01` / `trust-service:u12-T01`. Antes de `apply`, registra en la bitácora el nombre y el `startTime` de los pods viejos; el pod que responde después **debe tener otro nombre y un `startTime` posterior** (Lección 33: no leas del pod viejo apagándose; espera a `rollout status`).

- [ ] **CA-5** — **Persistencia de identity** (lectura de vuelta con la herramienta real): un usuario registrado sobrevive a un reinicio del pod. Antes de esta tarea ese login daba 401 tras reiniciar.

  ```bash
  PW=$(openssl rand -hex 12); EM="pvc-$(openssl rand -hex 4)@u14.test"
  kubectl port-forward svc/identity-service 3101:3100 >/dev/null 2>&1 & PF=$!; sleep 3
  curl -s -o /dev/null -w 'register=%{http_code}\n' -X POST http://localhost:3101/api/auth/register -H 'content-type: application/json' -d "{\"email\":\"$EM\",\"password\":\"$PW\"}"
  curl -s -o /dev/null -w 'login-antes=%{http_code}\n' -X POST http://localhost:3101/api/auth/login -H 'content-type: application/json' -d "{\"email\":\"$EM\",\"password\":\"$PW\"}"
  kill $PF
  OLD=$(kubectl get pod -l app=identity-service -o jsonpath='{.items[0].metadata.name}')
  kubectl rollout restart deploy/identity-service && kubectl rollout status deploy/identity-service --timeout=120s
  NEW=$(kubectl get pod -l app=identity-service -o jsonpath='{.items[0].metadata.name}'); [ "$OLD" != "$NEW" ] && echo "pod cambiado" || echo "ERROR: mismo pod"
  kubectl port-forward svc/identity-service 3101:3100 >/dev/null 2>&1 & PF=$!; sleep 3
  curl -s -o /dev/null -w 'login-despues=%{http_code}\n' -X POST http://localhost:3101/api/auth/login -H 'content-type: application/json' -d "{\"email\":\"$EM\",\"password\":\"$PW\"}"
  kill $PF
  kubectl exec deploy/identity-service -- ls -l /app/data
  ```

  Esperado: `register=201` (o el código real de u8-T01), `login-antes=200`, `pod cambiado`, **`login-despues=200`**, y el `ls` muestra `identity.db` en el volumen. Los campos y rutas son los de `u8-T01`; si difieren, ajústalos y anótalo. **No imprimas el token ni la contraseña** (descarta el cuerpo con `-o /dev/null`; no uses `set -x`). Cierra tu port-forward. Crea el script con `Write` y córrelo con `bash <ruta>` si el hook bloquea heredocs (Lección 29); déjalo en tu scratchpad, no en el repo.

- [ ] **CA-6** — **Persistencia de trust**: el onboarding de un usuario sobrevive a un reinicio del pod de trust.

  ```bash
  # Escribe (rutas y cuerpo según u11-T01) un estado de onboarding para un usuario de prueba, léelo de vuelta,
  # reinicia trust (rollout restart + rollout status), y léelo otra vez.
  kubectl port-forward svc/trust-service 3301:3300 >/dev/null 2>&1 & PF=$!; sleep 3
  # ... escritura + lectura (HTTP) ...
  kill $PF
  kubectl rollout restart deploy/trust-service && kubectl rollout status deploy/trust-service --timeout=120s
  kubectl port-forward svc/trust-service 3301:3300 >/dev/null 2>&1 & PF=$!; sleep 3
  # ... lectura (HTTP): el mismo registro sigue ahí ...
  kill $PF
  kubectl exec deploy/trust-service -- ls -l /app/data
  ```

  Esperado: la lectura posterior al reinicio devuelve el **mismo** registro que la anterior (contenido positivo, no solo un 200 vacío: Lección 34), el pod cambió de nombre y el `ls` muestra `trust.db`. Usa el puerto local **3301**: el 3300 es del humano (PID 4456); **no lo toques**. Si el onboarding de u11 exige un JWT, genera el usuario con identity (ya persistente) y no imprimas el token.

- [ ] **CA-7** — Los servicios `/health` responden tras el despliegue (smoke post-despliegue obligatorio) y nada más se movió.

  ```bash
  kubectl get pods
  kubectl port-forward svc/identity-service 3101:3100 >/dev/null 2>&1 & PF=$!; sleep 3; curl -s -o /dev/null -w 'identity-health=%{http_code}\n' http://localhost:3101/health; kill $PF
  kubectl port-forward svc/trust-service 3301:3300 >/dev/null 2>&1 & PF=$!; sleep 3; curl -s -o /dev/null -w 'trust-health=%{http_code}\n' http://localhost:3301/health; kill $PF
  ```

  Esperado: `identity-health=200`, `trust-health=200`; los pods de **ingestion, progress y backend** son los mismos de antes (mismos nombres, `RESTARTS=0`, mismas edades que el registro previo de la bitácora); identity y trust `1/1 Running`.

- [ ] **CA-8** — Sin regresiones y gate de auditoría.

  ```bash
  npm test -w apps/identity-service 2>&1 | grep -E "Test Suites:|Tests:"
  npm test -w apps/trust-service 2>&1 | grep -E "Test Suites:|Tests:"
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  git diff main...HEAD --name-only | grep -E '\.(md|yaml|yml|json)$' | xargs -r npx prettier --check
  ```

  Esperado: identity 74 tests y trust 25, todas las suites pasan (mira también `Test Suites:`, C-57; compila `shared-types` y `auth-middleware` antes: `npm run build -w packages/shared-types` y `-w packages/auth-middleware`); `audit exit=0`; Prettier sin avisos. No hay tests nuevos porque no hay código nuevo: la prueba de esta tarea son CA-4 a CA-7.

- [ ] **CA-9** — Sin secretos en el diff ni en el árbol (CA estándar).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`. No cites contraseñas, correos de prueba con credenciales ni tokens en la bitácora (descríbelos en palabras); los correos `*.test` sí pueden aparecer, las contraseñas y JWT no.

---

## Plan de pruebas

No hay código nuevo, así que no hay tests unitarios nuevos. La prueba de la tarea son las lecturas de vuelta de CA-4 a CA-7 contra el cluster.

**Rojo primero (de ejecución, sobre el cluster, solo lectura):** antes de cambiar nada, registra en la bitácora la salida de
`kubectl get pod -l app=identity-service -o jsonpath='{.items[0].spec.volumes}'` y la del pod de trust, que muestran `emptyDir`, junto con los nombres y `startTime` de los pods viejos. Ese es el estado «malo» del que parte la tarea; el par falla-pasa se cierra con CA-5 y CA-6 (login y onboarding sobreviven al reinicio, algo imposible con `emptyDir`). **No reinicies los pods antes de aplicar los manifiestos nuevos:** hacerlo solo borraría datos sin aportar evidencia.

El revisor hará mutaciones propias: p. ej., comprobar que el dato sobrevive de verdad (no un caché en memoria) mirando `ls -l /app/data` antes y después, y que `identity.db` no es un archivo recién creado vacío tras el reinicio (el usuario sigue ahí).

---

## Notas

- Archivos que se **modifican en su sitio**: `k8s/identity/deployment.yaml` y `k8s/trust/deployment.yaml`. Archivos **nuevos**: `k8s/identity/pvc.yaml` y `k8s/trust/pvc.yaml` (copia el molde de `k8s/ingestion/pvc.yaml`, nombres `identity-data` y `trust-data`, 1Gi; ajusta etiquetas `app:`). Nada de duplicados con sufijo.
- **Tag nuevo de identity: `identity-service:u14-T01`** (la regla del proyecto prohíbe `latest` y un `apply` con el mismo tag sale «unchanged»). Actualiza `image:` en `k8s/identity/deployment.yaml`.
- **Orden de despliegue:** `kubectl apply` de los PVC primero, luego los deployments. La `StorageClass` `standard` es `local-path` con `WaitForFirstConsumer`: el PVC queda `Pending` hasta que el pod lo reclama; es normal, no es un fallo.
- **`reclaimPolicy: Delete`** en la clase `standard`: borrar el PVC borra los datos. Anótalo en la bitácora como riesgo conocido; no lo cambies.
- **Permisos exactos que el humano da para esta tarea (los de la sesión no se heredan):** `docker build` y `docker run --rm` (solo de `identity-service:u14-T01`), `kind load docker-image identity-service:u14-T01`, `kubectl apply` de **solo** los cuatro archivos de `k8s/identity` y `k8s/trust` nombrados arriba, `kubectl rollout restart` y `rollout status` **solo** de `deploy/identity-service` y `deploy/trust-service`, `kubectl exec` de solo lectura (`ls -l /app/data`) en esos dos deployments, `kubectl port-forward` a `svc/identity-service` (3101) y `svc/trust-service` (3301) cerrándolos al terminar, y registrar usuarios `*.test`. **Cualquier otra cosa denegada: repórtala como no verificable; no la esquives ni se la pidas a otro agente** (Lección 22).
- **Ventana de corte:** con `Recreate`, identity y trust quedan caídos desde que termina el pod viejo hasta que el nuevo está `Ready`. Si alguno no atiende SIGTERM (C-48 lo confirmó solo para ingestion), la espera puede llegar a 30 s: mídela y anótala en la bitácora. Los demás servicios dependen de identity solo para el tier: durante el corte las peticiones que lo consulten fallan; es aceptable en un MVP local.
- Anota en la bitácora cada `docker build`, `kind load`, `apply` y `rollout` con su salida, y marca con «atención» cualquier defecto de esta tarea (los comandos de CA-3 y CA-5/CA-6 no se probaron antes de redactarlos).
- Los usuarios `*.test` creados quedan en la base de identity; no son un problema.

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
