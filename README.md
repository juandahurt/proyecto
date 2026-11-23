# Estudio

MVP académico: una app para subir un dibujo, recibir una crítica de Claude Vision en 5
categorías, ver el historial de subidas y las tendencias de progreso. Monorepo con
Turborepo, backend en microservicios sobre Kubernetes local (kind) y frontend en React.

Este README resume el **estado actual** del proyecto (qué existe, cómo se construyó y
qué falta). El detalle de decisiones, hallazgos y lecciones vive en `aidlc/`, en
`tareas/`, `bitacoras/`, `revisiones/` y `CANDIDATAS.md`.

---

## Qué hace hoy

1. **Registro / login** → JWT (bcrypt), onboarding de 3 checkboxes.
2. **Sube una imagen** (JPEG/PNG/WebP, ≤10 MiB) → validación de magic number y tamaño en
   el servidor, nombre de archivo generado por el servidor, almacenaje en un PVC.
3. **Crítica de Claude Vision** en 5 categorías (composición, proporciones, calidad de
   línea, sombreado, perspectiva); si la confianza es baja, un fallback `202
low_confidence` sin categorías.
4. **Detalle de la subida** con control de dueño (403/404) y miniatura firmada (URL
   válida 15 minutos).
5. **Historial** (`/history`): tabla con miniatura, fecha, "Focus area" (categoría más
   débil) y score, paginación de cliente ("Show all"), enlace al detalle.
6. **Tendencias**: el motor y la API (`GET /api/trends`, con puerta de tier) ya existen
   en el backend; la pantalla de frontend está pendiente (u0-T04).
7. **Tier `paid` (mock)** y política de datos. El **tope de 10 subidas/mes del tier
   `free` no está conectado todavía**: el contador de uso siempre muestra "10 of 10"
   (ver "Pendiente" más abajo).

**Entorno: exclusivamente Kubernetes local (kind).** No hay despliegue en la nube. No
existe una clave real de la API de Anthropic en el cluster: el cliente usa un stub que
siempre devuelve confianza `HIGH`; los caminos de fallback se prueban con mocks.

---

## Arquitectura

```
apps/
├── identity-service     Registro, login, JWT, límites de tier (lectura)
├── ingestion-service     Subida, validación, llamada a Claude, listado y detalle
├── trust-service         Onboarding, política de datos
├── progress-service       Tendencias (tier-gated)
├── backend                Walking skeleton original (u1)
└── frontend                React 18 + Vite + Tailwind, servido por nginx

packages/
├── shared-types           Única fuente de contratos HTTP (schemas Zod; tipos con z.infer<>)
└── auth-middleware         Verificación de JWT compartida entre servicios

k8s/                       Manifiestos por servicio (Deployment, Service, ConfigMap, PVC)
```

Cada servicio backend expone `/health` con readiness probe. Los contratos HTTP se
definen una sola vez en `packages/shared-types` (Zod es la fuente autoritativa; los
tipos TypeScript se derivan con `z.infer<>`), para que ningún servicio duplique un tipo
compartido.

---

## Cómo se construyó

El proyecto sigue un flujo de **loop de agentes con cuatro papeles sellados**:
codificador implementa, revisor juzga, el orquestador arbitra, el humano fusiona. Cada
unidad de trabajo es una tarea (`tareas/<unidad>-T0N-*.md`) con criterios de aceptación
ejecutables; el codificador la implementa en su propio worktree de git, el revisor la
audita de forma adversarial y deja un informe con veredicto VERDE/NO-VERDE
(`revisiones/<tarea>/ronda-N.md`), y el humano decide si fusiona. El contrato completo
vive en `.claude/orquestador.md`.

- **Pull requests fusionados:** 26 (ver historial de `main`).
- **Tareas redactadas:** 27 (`tareas/`, una por unidad de trabajo).
- **Candidatas abiertas:** ver `CANDIDATAS.md` (hallazgos y mejoras que quedaron fuera
  del alcance de alguna tarea, sin convertirse todavía en su propia tarea).

No todas las tareas fusionadas tuvieron una ronda de revisor en verde: algunas se
fusionaron por decisión explícita del humano con el veredicto que tenían en ese momento
(ver el título de cada PR y `revisiones/<tarea>/`, que lo dice sin rodeos cuando aplica).

---

## Desarrollo local

- **Requisitos:** Node 20, Docker, un cluster `kind` local (contexto `kind-kind`), `npm`,
  `turbo`.
- **Build de paquetes compartidos** (su `dist/` está en `.gitignore`):
  ```bash
  npm ci
  npm run build -w packages/shared-types
  npm run build -w packages/auth-middleware
  ```
- **Tests por servicio:** `npm test -w apps/<servicio>`.
- **Lint y build del monorepo:** `npx turbo run lint build`.
- **Despliegue:** build de imagen Docker → `kind load docker-image` → `kubectl apply -f
k8s/<servicio>/` → verificar `/health` y que el pod esté `Ready`. Ninguna imagen usa el
  tag `latest`; los secretos (`jwt-secret`, `thumbnail-signing-key`) se crean como
  `Secret` de Kubernetes, nunca en el repositorio.

---

## Convenciones del equipo

Trunk-based development, ramas de feature cortas fusionadas por squash a `main`. Reglas
completas (cobertura mínima, estilo, seguridad, despliegue) en
`aidlc/spaces/default/memory/{org,team,project}.md`.
