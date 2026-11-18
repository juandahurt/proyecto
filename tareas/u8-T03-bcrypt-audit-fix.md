# u8-T03 — Quitar `tar` y `node-pre-gyp` de identity-service (bcrypt 5 → 6) para que `npm audit --audit-level=high` pase

**Unidad:** u8 — identity-service (hardening de dependencias, C-46)
**Historias que implementa:** ninguna (gate de merge de `project.md`: «NEVER hacer merge a `main` si … `npm audit --audit-level=high` fallan»)
**Depende de:** ninguna

**Decisión del humano (ola 7):** esta tarea va **antes** de los PRs pendientes (u5-T03 y siguientes); estos se rebasan después. **No se despliega nada en el cluster**: identity guarda su SQLite en un `emptyDir` (C-43) y reiniciarlo borra usuarios y suscripciones.

> **Corrección del orquestador (Lección 21).** Los informes de la ola 7 y la primera redacción de C-46 decían que la cadena venía de `better-sqlite3`. Es falso. El árbol real es
> `identity-service → bcrypt@5.1.1 → @mapbox/node-pre-gyp@1.0.11 → tar@6.2.1`
> (comprobado con `npm ls tar @mapbox/node-pre-gyp --all` y `npm audit --json`). `better-sqlite3` (backend, identity, ingestion, trust) no interviene.

---

## Alcance

**Dentro** (una línea, concreta):

> Subir `bcrypt` a `^6.0.0` y `@types/bcrypt` a `^6.0.0` en `apps/identity-service/package.json`, regenerar `package-lock.json` y demostrar que el hash de contraseñas sigue siendo compatible; con eso `tar` y `@mapbox/node-pre-gyp` desaparecen del árbol y el audit de severidad high/critical sale en 0.

**Fuera** (lo que el codificador debe rechazar aunque lo vea roto):

- **Desplegar** nada: ni `docker build` con el tag del manifiesto, ni `kind load`, ni `kubectl apply`, ni `rollout`. No toques `k8s/`. El pod de identity sigue con `identity-service:u10-T01` (la imagen nueva se desplegará en otra tarea, con decisión del humano sobre C-43).
- Las 6 vulnerabilidades **moderate** (`@typescript-eslint/*`, `minimatch`): no bloquean el gate. No ejecutes `npm audit fix` a ciegas ni subas `typescript-eslint`.
- Añadir `overrides` para forzar `tar` 7 sobre `node-pre-gyp` (rompe su API; la solución es quitar la dependencia, no parchearla).
- Cambiar `BCRYPT_ROUNDS`, la firma de `hashPassword`/`comparePassword`, o cualquier código de `apps/identity-service/src/` que no sea el test nuevo.
- C-45 (usuario no-root, `--omit=dev`), C-43 (`emptyDir`), C-48 (SIGTERM), tocar el Dockerfile.
- Tocar otros workspaces, `packages/*`, o cualquier otra dependencia.

---

## Archivos de contexto

Rutas, no contenido pegado:

- `apps/identity-service/package.json`, `apps/identity-service/src/service/password.ts`, `apps/identity-service/src/__tests__/password.test.ts`
- `apps/identity-service/Dockerfile` (solo lectura; builder con `python3 make g++`)
- `package-lock.json`
- `CANDIDATAS.md` (C-46)
- `tareas/u5-T02-progress-service-history.md` (CA-13: patrón de build y smoke con `JWT_SECRET` generado al vuelo)
- `aidlc/spaces/default/memory/project.md` (reglas Forbidden/Mandated)

---

## Criterios de aceptación

Cada uno con **su comando**. El revisor los va a correr él mismo, uno por uno.

- [ ] **CA-1** — El audit de severidad high/critical pasa, y la causa raíz (no un parche) desapareció del árbol.

  ```bash
  npm audit --audit-level=high >/dev/null 2>&1; echo "audit exit=$?"
  npm ls tar @mapbox/node-pre-gyp --all 2>&1 | tail -3
  npm ls bcrypt @types/bcrypt 2>&1 | grep -E "bcrypt@"
  ```

  Esperado: `audit exit=0`; `npm ls tar @mapbox/node-pre-gyp` imprime `(empty)`; bcrypt y `@types/bcrypt` aparecen en `6.x`. **Antes** del cambio el primer comando da `audit exit=1`: regístralo en la bitácora como el rojo inicial.

- [ ] **CA-2** — El único cambio de manifiesto es `bcrypt` y `@types/bcrypt` en identity-service.

  ```bash
  git diff main...HEAD -- apps/identity-service/package.json | grep -E '^[+-] ' | grep -vE '^(\+\+\+|---)'
  git diff main...HEAD --name-only -- 'apps/*/package.json' 'packages/*/package.json' package.json
  ```

  Esperado: exactamente 4 líneas (`-`/`+` de `"bcrypt"` y `-`/`+` de `"@types/bcrypt"`), con `^6.0.0`; y la segunda lista solo `apps/identity-service/package.json`.

- [ ] **CA-3** — El lockfile no cambia la versión de ningún otro paquete que se conserve.

  ```bash
  git show main:package-lock.json > "$WORK/lock-main.json"
  node -e '
  const a=require(process.argv[1]).packages,b=require("./package-lock.json").packages;
  const changed=Object.keys(a).filter(k=>b[k]&&a[k].version!==b[k].version);
  const removed=Object.keys(a).filter(k=>!b[k]);
  const added=Object.keys(b).filter(k=>!a[k]);
  console.log("changed:",JSON.stringify(changed));
  console.log("removed:",removed.length,JSON.stringify(removed.filter(k=>/tar$|node-pre-gyp$/.test(k))));
  console.log("added:",JSON.stringify(added));
  ' "$WORK/lock-main.json"
  ```

  Esperado: `changed` contiene **solo** `node_modules/bcrypt` y `node_modules/@types/bcrypt` (más, si npm lo exige, la entrada del workspace `apps/identity-service`, que cambia por los rangos); `removed` incluye `node_modules/tar` y `node_modules/@mapbox/node-pre-gyp`; `added` contiene `node-addon-api` y `node-gyp-build` y nada con aspecto de paquete nuevo de otro origen. `$WORK` es un subdirectorio propio del scratchpad. Si `changed` trae otra cosa (p. ej. `typescript-eslint`), el lockfile se regeneró de más: deshacer y repetir con `npm install bcrypt@^6.0.0 -D @types/bcrypt@^6.0.0 -w apps/identity-service` partiendo del lockfile de `main`.

- [ ] **CA-4** — Compatibilidad de hashes: un hash generado con bcrypt **5** (el que hay hoy en producción) se verifica con bcrypt **6**.

  ```bash
  npm test -w apps/identity-service -- password 2>&1 | tail -15
  grep -nE "COMPAT|compat" apps/identity-service/src/__tests__/password.test.ts | head
  ```

  Esperado: el test nuevo «hash de bcrypt 5 se verifica con la versión actual» pasa; usa una constante con un hash `$2b$10$…` **generado por el codificador con bcrypt 5.1.1 antes de subir la versión** y una contraseña evidentemente falsa (p. ej. `'clave-solo-para-tests'`). Además: contraseña distinta → `false`. Los tests existentes de `password.test.ts` siguen verdes sin tocarlos.

- [ ] **CA-5** — Regresiones: nada más se rompe.

  ```bash
  npm test -w apps/identity-service 2>&1 | tail -8
  npm test -w apps/ingestion-service 2>&1 | tail -5
  npm test -w apps/trust-service 2>&1 | tail -5
  npm test -w apps/backend 2>&1 | tail -5
  npx turbo run lint build --force 2>&1 | tail -6
  npx prettier --check . 2>&1 | tail -3
  ```

  Esperado: identity ≥ 72 tests (72 + el nuevo), ingestion 206 o más, trust 25, backend 18, todos verdes y sin omitidos; `turbo` termina con `Failed: 0` y `0 cached`; prettier limpio. (Los conteos son los de `main` al redactar: si `main` cambió, compara contra `main`, no contra estas cifras.)

- [ ] **CA-6** — La cobertura de identity no baja del piso (≥80 % líneas globales; ≥75 % ramas en `service/` y `handlers/`).

  ```bash
  npm test -w apps/identity-service -- --coverage 2>&1 | grep -E "All files|service|handlers"
  ```

  Esperado: ninguna cifra por debajo del piso ni por debajo de la de `main` en `service/password.ts`. No se rebaja ningún umbral.

- [ ] **CA-7** — Lectura de vuelta con la herramienta real: la imagen de identity **construida con el lockfile nuevo** carga bcrypt 6 y hace un round-trip, y el servicio arranca.

  ```bash
  docker build --no-cache -f apps/identity-service/Dockerfile -t identity-service:audit-check .; echo "build exit=$?"
  docker image inspect identity-service:audit-check --format '{{.RepoTags}}'
  docker run --rm --entrypoint node identity-service:audit-check -e 'const b=require("bcrypt");b.hash("x-solo-test",10).then(h=>b.compare("x-solo-test",h)).then(r=>console.log("round-trip:",r,"bcrypt:",require("bcrypt/package.json").version))'
  docker run --rm --entrypoint sh identity-service:audit-check -c 'ls node_modules/tar node_modules/@mapbox 2>&1 | head -2'
  ```

  Más el smoke de `/health` con el patrón de CA-13 de `tareas/u5-T02-progress-service-history.md` (`JWT_SECRET` generado al vuelo con `openssl rand -hex 16`, contenedor desechable). Esperado: `build exit=0`; el tag es `identity-service:audit-check` (**nunca** `latest` ni `u10-T01`); `round-trip: true bcrypt: 6.x`; el `ls` dice `No such file or directory` para `tar` y `@mapbox`; `/health` responde `200`. Al terminar: `docker rmi identity-service:audit-check` y comprobar que no queda contenedor. **No** uses `kind load`.

- [ ] **CA-8** — El cluster no se tocó.

  ```bash
  kubectl get deployment identity-service -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
  kubectl get pods -l app=identity-service -o jsonpath='{.items[0].metadata.name} restarts={.items[0].status.containerStatuses[0].restartCount}{"\n"}'
  git diff main...HEAD --name-only | grep -c '^k8s/' || true
  ```

  Esperado: `identity-service:u10-T01`; el mismo pod que al empezar (anota el nombre antes en la bitácora) con `restarts=0`; `0` archivos de `k8s/` en el diff.

- [ ] **CA-9** — Alcance exacto y ningún tag `latest`.

  ```bash
  git diff main...HEAD --name-only | sort
  git ls-files k8s apps | xargs -r grep -nE 'image:.*:latest|FROM .*:latest' 2>/dev/null || echo "no latest tag"
  ```

  Esperado: exactamente `apps/identity-service/package.json`, `apps/identity-service/src/__tests__/password.test.ts`, `bitacoras/u8-T03.md` y `package-lock.json`; imprime `no latest tag`.

- [ ] **CA-10** — Sin secretos en el diff ni en el árbol (CA estándar).

  ```bash
  git diff main...HEAD --name-only | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff"
  git ls-files | grep -vE "^(bitacoras|revisiones)/" | xargs -r grep -EH "sk-ant-api[0-9]+|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-|JWT_SECRET\s*=\s*['\"]?[A-Za-z0-9+/=_-]{16,}" 2>/dev/null | grep -v "process\.env\." | grep -v "secretKeyRef" | grep -v "name: anthropic-key" || echo "no secrets in diff or tree"
  ```

  Esperado: imprime `no secrets in diff` y `no secrets in diff or tree`. El hash `$2b$` del test de compatibilidad no es un secreto (la contraseña es una constante falsa), pero no pegues JWT ni valores de Secrets en la bitácora. No cites literales con forma de clave (C-29).

- [ ] **CA-11** — Commits atómicos con rutas explícitas.

  ```bash
  git log --oneline main..HEAD
  for c in $(git rev-list main..HEAD); do git show --name-only --format='%h %s' $c | head -6; done
  ```

  Esperado: cada commit contiene solo los archivos que nombra su mensaje; ninguno incluye el shard `aidlc/spaces/default/intents/260925-feature/audit/typewriter-local-*.md`.

### Fix de especificación (ronda 1, errores del orquestador)

El codificador encontró ocho desviaciones; seis eran defectos míos. Esta es la lectura vigente de los criterios:

- **CA-3:** `node-addon-api` **sí** puede aparecer en `changed` (bcrypt 6 pide otra versión de esa transitiva, ya presente en el lockfile). `changed` admite exactamente `node_modules/bcrypt`, `node_modules/@types/bcrypt` y `node_modules/node-addon-api` (más, si npm lo exige, la entrada del workspace); `added` admite `node_modules/node-gyp-build`.
- **CA-4:** el comando literal sale con exit 1 por el umbral global de cobertura al filtrar un solo archivo (3,61 % < 80 %). Usar `npm test -w apps/identity-service -- password --coverage=false`. La cobertura la mide CA-6.
- **CA-5, prettier:** `npx prettier --check .` falla **en `main`** en 5 archivos ajenos a la tarea (`bitacoras/WS-T01.md`, `revisiones/WS-T01/ronda-1.md`, `revisiones/WS-T01/ronda-2.md`, `tareas/WS-T01-scaffold-monorepo.md`, `tareas/WS-T02-endpoint-http-health.md`). El criterio vigente es sobre lo que toca la rama: `git diff main...HEAD --name-only | xargs npx prettier --check`, que debe salir limpio. Va como candidata C-51.
- **CA-5, conteos:** los de la tarea estaban desactualizados (ingestion da 194 en `main`, no 206). El criterio es «igual que `main`, más los tests nuevos»; identity: los de `main` + 2.
- **Instalación:** `-D` es global en npm y no se puede mezclar con bcrypt en una sola línea. Vale hacerlo en dos comandos (`npm install bcrypt@^6.0.0 -w apps/identity-service` y `npm install @types/bcrypt@^6.0.0 -D -w apps/identity-service`), siempre que el manifiesto quede como pide CA-2.
- **Nombres y smoke:** las funciones de `password.ts` se llaman `hash` y `compare` (no `hashPassword`/`comparePassword`). El smoke de CA-7 se adapta a identity: puerto 3100, sin `INGESTION_URL`.

---

## Plan de pruebas

- **Test de compatibilidad de hashes** (único test nuevo, en `password.test.ts`): constante con un hash generado con bcrypt 5.1.1 → `comparePassword(clave, hash)` es `true`; contraseña distinta → `false`.
- **Criterio de mutación observable:** cambiar un carácter del hash de la constante o la contraseña esperada **hace fallar** el test; el revisor lo comprueba en una copia.
- **Rojo primero:** (1) `npm audit --audit-level=high` da `exit=1` y `npm ls tar` muestra la cadena por `bcrypt@5.1.1` (registra la salida). (2) **Antes** de subir la versión, genera el hash con bcrypt 5.1.1 (`node -e` con `require('bcrypt')` desde el workspace) y confirma que el test nuevo pasa contra la 5.x; **después** de subir, debe seguir pasando. El par rojo-verde de esta tarea es el audit; el test de compatibilidad es la red que demuestra que el cambio de versión no rompe los usuarios ya registrados.

---

## Notas

- Archivos que se **modifican en su sitio**: `apps/identity-service/package.json`, `package-lock.json`, `apps/identity-service/src/__tests__/password.test.ts`. Nada de duplicados con sufijo. Bitácora nueva: `bitacoras/u8-T03.md` (hash de la tarea, rojo inicial, el hash de bcrypt 5 generado, qué se verificó, nombre del pod de identity antes y después).
- `bcrypt@6` usa `node-gyp-build` (prebuilds incluidos en el paquete) y exige Node ≥ 18; la imagen usa `node:20-slim`, el host Node 26. El builder del Dockerfile conserva `python3 make g++`: no lo toques (si la compilación nativa fallara por falta de prebuild, repórtalo con «atención» en vez de cambiar el Dockerfile).
- `npm audit` sigue mostrando 6 moderate (`typescript-eslint`, `minimatch`) tras esta tarea: es lo esperado. Si el revisor lo ve, no es hallazgo; va como candidata aparte.
- Para repetir el audit en un árbol limpio: `npm ci` y compilar antes `packages/shared-types` y `packages/auth-middleware` (`npm run build -w …`).
- No hagas push, no abras PR, no fusiones. Usa un subdirectorio propio del scratchpad para `$WORK` (C-38).

---

_Creado con ❤️ por Luis Felipe Ariza Vesga._
