## Sources

- [comp] inception/domain-design/components.md
- [units] inception/units-generation/unit-of-work.md
- [dep] inception/units-generation/unit-of-work-dependency.md
- [req] inception/requirements-analysis/requirements.md

---

## Q1. ProgressService → IngestionService: mecanismo de acceso a datos

ProgressService necesita leer los scores de CategoryCritique para calcular tendencias (FR-6). El diseño de dominio documenta esto como una excepción aceptada: ProgressService lee directamente del schema de ingestion en PostgreSQL (cross-schema read, usuario read-only). Sin embargo, esta decisión afecta directamente si hay un contrato formal API entre estos dos servicios o solo una dependencia de esquema.

¿Cómo accede ProgressService a los datos de CategoryCritique de IngestionService?

A. Lectura directa cross-schema en PostgreSQL (usuario read-only sobre el schema `ingestion`) — sin contrato HTTP; solo hay dependencia de esquema. Este es el approach documentado en el Domain Design.
B. API HTTP interno en IngestionService (`GET /api/internal/scores?userId=:id`) — ProgressService consume el endpoint, no toca la base de datos directamente.
C. Ambas opciones son válidas para etapas distintas: cross-schema read para MVP (ya documentado), con plan de migrar a API en el futuro.
X. Other (please specify)

[Answer]: A

---

## Q2. Frontend → Backend: routing y API gateway

¿Cómo enruta el Frontend (u0-frontend) sus llamadas HTTP a los 4 servicios backend dentro del cluster K8s?

A. K8s Ingress como único punto de entrada con routing por path prefix — por ejemplo `/api/upload` → IngestionService, `/api/trends` → ProgressService, `/api/auth` → IdentityService, `/api/trust` → TrustService. Los servicios no necesitan conocer el routing.
B. Llamadas directas del Frontend al ClusterIP de cada servicio (sin Ingress para tráfico interno de la SPA).
C. API Gateway dedicado (Traefik con plugins, Kong, o similar) separado del Ingress de K8s.
X. Other (please specify)

[Answer]: A

---

## Q3. Autenticación en llamadas servicio-a-servicio

Hay tres flujos de comunicación HTTP entre servicios backend:
- ProgressService → IdentityService: obtener tier status del usuario al servir el trend API (u7 → u9)
- TrustService → IngestionService: borrado de uploads, critiques y blobs (u13 cascade)
- TrustService → IdentityService: reset del contador de uploads (u13 cascade)
- TrustService → ProgressService: borrado de TrendSnapshot data (u13 cascade)

¿Cómo se autentican estas llamadas internas?

A. Sin autenticación explícita — todas las llamadas son dentro del cluster K8s (namespace privado); la red es la frontera de seguridad.
B. Forwarding del JWT del usuario original — cada servicio recibe y valida el mismo token del usuario que originó la request.
C. Llamadas de usuario-contexto (como el tier status) usan el JWT del usuario; llamadas administrativas de cascade (borrado) son network-trusted sin token.
D. Service account de K8s o mutual TLS entre pods para todas las llamadas inter-servicio.
X. Other (please specify)

[Answer]: A

---

## Q4. Contrato del endpoint de tier status (ProgressService ↔ IdentityService)

ProgressService (u7) consulta el tier del usuario a IdentityService (u9) en cada request al trend API (FR-7.3: "Tier status is determined by the accounts service at request time"). ¿Qué forma tiene este endpoint?

A. `GET /api/internal/users/{userId}/tier` → responde `{ tier: "free" | "paid", uploadsRemaining: number }` — el mismo endpoint que el Frontend usa para mostrar el límite restante (FR-9.5).
B. `GET /api/users/me/subscription` con el JWT del usuario — ProgressService usa el token para obtener el tier; no hay un endpoint interno separado.
C. Definir en Functional Design — por ahora solo establecer que existe una dependencia en tiempo de request entre u7 y u9.
X. Other (please specify)

[Answer]: A

---

## Q5. Endpoints del cascade de borrado (TrustService → otros servicios)

Cuando el usuario confirma "DELETE" (u13), TrustService coordina el borrado completo en IngestionService, IdentityService y ProgressService. ¿Qué endpoints llama TrustService en cada servicio?

A. Un endpoint DELETE genérico por servicio:
   - `DELETE /api/internal/users/{userId}/data` en IngestionService (borra uploads, critiques, blobs)
   - `DELETE /api/internal/users/{userId}/data` en ProgressService (borra TrendSnapshot)
   - `POST /api/internal/users/{userId}/reset-counter` en IdentityService (reset del contador)
B. Cada servicio expone endpoints más granulares (borrar blobs separado de borrar records, etc.); TrustService llama a cada uno en secuencia.
C. IngestionService provee un endpoint "cascade coordinator" que también llama a ProgressService internamente; TrustService solo llama a IngestionService y a IdentityService.
D. Definir en Functional Design — el cascade es best-effort y sus endpoints exactos dependen de la implementación interna de cada servicio.
X. Other (please specify)

[Answer]: A

---

## Q6. Contrato externo: IngestionService → Anthropic Claude Vision API

IngestionService llama a la Claude Vision API con la imagen subida. Este es el único contrato externo del sistema. ¿Qué aspectos se deben fijar ahora en el Contract Design?

A. Solo la forma del prompt y el schema de respuesta esperada (5 categorías, score 0-100, confidence HIGH/MEDIUM/LOW) — esto es lo que valida el test de contrato (FR-2.1, afirmado en team.md).
B. El schema de respuesta PLUS el comportamiento de error: timeout 30s (configurable, FR-3.3), sin reintentos en timeout, respuesta de fallback al caller si falla.
C. Documentar solo el mecanismo de autenticación (K8s Secret) y el protocolo (HTTPS REST); el schema de respuesta se define en Functional Design al escribir el prompt.
X. Other (please specify)

[Answer]: A

---

## Q7. Política de versioning y cambios breaking

Para el MVP (un solo desarrollador), ¿qué política de versioning aplica a los contratos HTTP?

A. Sin versioning explícito — los contratos son implícitamente "v1" y se cambian coordinando en el mismo repositorio (trunk-based, un solo dev). Los contratos internos no tienen versión en la URL.
B. URL versioning en los endpoints públicos externos (/api/v1/...) pero no en los internos (/api/internal/...).
C. Política semántica implícita: campos nuevos opcionales son safe (no breaking); eliminar campos o cambiar tipos requiere actualizar todos los consumidores en el mismo Bolt.
D. Políticas A y C combinadas: sin versión en URL + regla de compatibilidad hacia adelante para campos.
X. Other (please specify)

[Answer]: A

---

## Assumptions & Open Questions

- La comunicación ProgressService → IngestionService como cross-schema read ya fue validada en Domain Design (aceptada como excepción MVP). Si la respuesta a Q1 cambia esto, afecta a todos los contratos de ProgressService. [assumption]
- Los endpoints de cascade (Q5) son llamadas best-effort: el cascade procede y loguea fallos; solo devuelve error al usuario si TODOS los pasos fallan (definido en unit-of-work.md). [assumption]
- El contrato de la Claude Vision API (Q6) incluye el test de contrato que valida el schema de respuesta, conforme a lo afirmado en team.md. [assumption]

---

## Consolidated Summary Confirmation

Resumen de decisiones antes de generar el artefacto:

- **Q1=A** — ProgressService lee CategoryCritique via cross-schema read en PostgreSQL (usuario read-only en el schema `ingestion`). No hay contrato HTTP entre ProgressService e IngestionService para este acceso.
- **Q2=A** — K8s Ingress como único punto de entrada; routing por path prefix (`/api/upload` → IngestionService, `/api/trends` → ProgressService, `/api/auth` → IdentityService, `/api/trust` → TrustService).
- **Q3=A** — Sin autenticación explícita para llamadas inter-servicio; todas son network-trusted dentro del namespace K8s privado.
- **Q4=A** — Endpoint tier status: `GET /api/internal/users/{userId}/tier` → `{ tier: "free"|"paid", uploadsRemaining: number }` (ProgressService llama a IdentityService en cada request del trend API).
- **Q5=A** — Cascade de borrado: `DELETE /api/internal/users/{userId}/data` en IngestionService y ProgressService; `POST /api/internal/users/{userId}/reset-counter` en IdentityService. Best-effort: procede y loguea fallos.
- **Q6=A** — Contrato externo Claude API: solo el schema de respuesta (5 categorías con scores 0-100 y confidence HIGH/MEDIUM/LOW). Comportamiento de error (timeout 30s, sin retry) se documenta como nota al contrato, no como spec formal.
- **Q7=A** — Sin versioning explícito; contratos implícitamente v1. Cambios se coordinan en el mismo repo (trunk-based, dev único).

- Looks correct
- Request changes

[Answer]: Looks correct
