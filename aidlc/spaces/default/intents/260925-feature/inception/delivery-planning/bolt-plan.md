## Sources

- [units] inception/units-generation/unit-of-work.md
- [dep] inception/units-generation/unit-of-work-dependency.md
- [contracts] inception/contract-design/contract-summary.md
- [team] aidlc/spaces/default/memory/team.md

---

# Bolt Plan — Estudio MVP

> Un **Bolt** es un ciclo de construcción completo sobre una o varias unidades de trabajo que termina en código funcionando y aprobado. Los Bolts se ejecutan en serie (un Bolt completado y aprobado antes de empezar el siguiente). 13 Bolts en total.
>
> **Estrategia de secuenciación**: Critical-path-first — la ruta más larga de dependencias (u1→u2→u3→u4→u5→u6→u7) se aborda primero porque concentra el mayor riesgo (integración con Claude Vision API) y la mayor cantidad de valor de producto. Las ramas de IdentityService y TrustService se construyen después de haber validado el journey principal.
>
> **Skeleton**: El **walking skeleton** (Bolt 1) es una implementación mínima extremo-a-extremo que toca todas las capas arquitectónicas antes de añadir features. Prueba que el sistema puede desplegarse y comunicarse; no requiere que ninguna funcionalidad real esté operativa.

---

## Bolt 1 — Walking Skeleton 🦴

**Unidades**: u0-frontend + u8-authentication
**Servicios**: Frontend + IdentityService
**¿Walking skeleton?**: Sí. Establece el K8s Ingress routing a los 4 pods, el ciclo register/login en IdentityService, y la React SPA con las pantallas de Upload y Onboarding conectadas a stubs de los servicios backend. Prueba las capas: Browser → HTTPS → K8s Ingress → Pod → PostgreSQL stub → Response.

**Definition of Done:**
- [ ] K8s cluster local desplegado (k3s, minikube o kind)
- [ ] 4 Pods corriendo: Frontend, IngestionService, IdentityService, TrustService (con stubs), ProgressService (stub)
- [ ] K8s Ingress enruta `/api/auth/*` a IdentityService
- [ ] `POST /api/auth/register` y `POST /api/auth/login` devuelven respuestas reales (JWT)
- [ ] React SPA sirve desde el Pod de Frontend; la pantalla de Upload carga sin errores
- [ ] Pantalla de Onboarding carga y está conectada al stub de TrustService
- [ ] `GET /health` en cada servicio responde 200 y el Pod está en estado `Ready`
- [ ] Husky + lint-staged configurados; pre-commit aplica Prettier y ESLint
- [ ] `.env` y secretos en `.gitignore`; `ANTHROPIC_API_KEY` en K8s Secret (vacío/placeholder)
- [ ] 80%+ cobertura de líneas en los módulos implementados; CI verde

**Confidence hypothesis**: Al terminar este Bolt, sabemos que el cluster K8s local puede desplegar los 4 servicios con comunicación HTTP a través del Ingress, y que el ciclo de registro/login con JWT funciona de extremo a extremo. Si algo falla aquí (routing, BD, secrets), lo encontramos antes de construir cualquier feature.

**Expected demo**: `curl -X POST https://localhost/api/auth/register -d '{"email":"test@test.com","password":"abc12345"}'` devuelve `{"token":"...", "expiresIn":604800}`. Browser carga la pantalla de Upload tras el login.

---

## Bolt 2 — Upload de Imagen

**Unidad**: u1-image-upload
**Servicio**: IngestionService
**Ruta crítica**: Sí (paso 1 de 8)

**Definition of Done:**
- [ ] `POST /api/uploads` acepta JPEG, PNG, WebP; rechaza otros formatos con 422
- [ ] Validación de magic number (primeros bytes) además del MIME type
- [ ] Límite de 10 MB aplicado en multer y en el K8s Ingress
- [ ] Nombre de archivo generado por el servidor (UUID); nunca se usa el nombre del cliente
- [ ] Upload ID (UUID) devuelto en `{ uploadId, status: "ready", confidence: "HIGH" }` (stub de critique)
- [ ] Rechaza uploads sin JWT válido con 401
- [ ] Rechaza cuando el limite de uploads es alcanzado con 402 (stub del contador)
- [ ] Tests unitarios: happy path, formato inválido, archivo > 10MB, sin JWT
- [ ] 80%+ líneas, 75%+ ramas en `service/` y `handlers/`

**Confidence hypothesis**: La capa de recepción de imágenes valida correctamente y de forma segura. El servidor controla los nombres de archivo. La integración con el Ingress de K8s para uploads multipart funciona sin truncar el payload.

**Expected demo**: `curl -X POST .../api/uploads -H "Authorization: Bearer <token>" -F "file=@drawing.jpg"` → `{"uploadId":"...", "status":"ready", "confidence":"HIGH"}`.

---

## Bolt 3 — Integración Claude Vision API 🤖

**Unidad**: u2-ai-critique
**Servicio**: IngestionService
**Ruta crítica**: Sí (paso 2 de 8) — **mayor riesgo técnico**

**Nota de desarrollo**: Durante el desarrollo local, se usan stub responses fijas para llamar a Claude. La API real de Anthropic se usa únicamente en el test de contrato del schema de respuesta (C10) y en los smoke tests del cluster. Esto permite construir y testear el parseo sin depender de la API en cada ejecución.

**Definition of Done:**
- [ ] IngestionService llama a Claude Vision API con la imagen subida; prompt en inglés
- [ ] Respuesta parseada: 5 categorías (CAT-1 a CAT-5), scores 0-100, confidence HIGH/MEDIUM/LOW, feedback ≥2 frases por categoría
- [ ] Test de contrato (Zod schema) valida la estructura de respuesta de Claude; se ejecuta en CI
- [ ] Timeout configurado a 30s (configurable); no hay reintentos en timeout
- [ ] Resultado devuelto al caller como `UploadResult` (contrato C1)
- [ ] `ANTHROPIC_API_KEY` leído exclusivamente desde K8s Secret
- [ ] Tests unitarios con mock de Claude (respuesta válida, schema inválido, timeout)
- [ ] 80%+ líneas, 75%+ ramas en `service/` y `handlers/`

**Confidence hypothesis**: El parseo del JSON de Claude funciona correctamente. El test de contrato (C10) fija el schema y se rompe si Claude cambia su respuesta. El timeout de 30s está cableado. El secret de K8s es el único punto de inyección de la clave.

**Expected demo**: Upload de una imagen → respuesta con 5 categorías, scores y feedback. Test de contrato verde en CI.

---

## Bolt 4 — Fallback de Baja Confianza

**Unidad**: u3-low-confidence
**Servicio**: IngestionService
**Ruta crítica**: Sí (paso 3 de 8)

**Definition of Done:**
- [ ] Detecta y enruta 3 casos de baja confianza: confidence=LOW, schema inválido (categorías faltantes o scores fuera de rango), timeout de API (30s)
- [ ] Devuelve `{ status: "low_confidence", confidence: "LOW", fallbackReason: "low_confidence_flag" | "invalid_schema" | "timeout" }` al caller
- [ ] El Upload record se almacena (stub de BD) pero marcado como `low_confidence=true`
- [ ] Los uploads de baja confianza están excluidos del cálculo de tendencias (flag en BD)
- [ ] Tests unitarios: cada uno de los 3 casos de fallback, happy path (no fallback)
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El sistema maneja fallos de la API de Claude de forma degradada y predecible. El usuario recibe información de que la crítica no pudo completarse, en lugar de un error opaco.

**Expected demo**: Upload con imagen que fuerza timeout → respuesta `{ status: "low_confidence", fallbackReason: "timeout" }` dentro de 31 segundos.

---

## Bolt 5 — Almacenamiento de Crítica

**Unidad**: u4-critique-storage
**Servicio**: IngestionService
**Ruta crítica**: Sí (paso 4 de 8) — cierra IngestionService

**Definition of Done:**
- [ ] Upload record persistido en la tabla `uploads` (schema `ingestion`)
- [ ] CategoryCritique records persistidos (uno por categoría, 5 por upload válido; 0 si low_confidence)
- [ ] Imagen blob almacenada en PVC/MinIO; URL firmada (15 min TTL) generada para thumbnails
- [ ] `GET /api/uploads/{uploadId}` devuelve `UploadDetail` (critique + thumbnailUrl + timestamp) al propietario autenticado; 403 para otros usuarios
- [ ] Tests unitarios: almacenamiento exitoso, acceso de propietario, acceso denegado, upload no encontrado
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: Los datos de crítica sobreviven al ciclo completo (upload → Claude → storage → retrieve). La privacidad del propietario está garantizada a nivel de API.

**Expected demo**: Upload de imagen → `GET /api/uploads/{id}` devuelve critique completa + URL de thumbnail válida. Mismo endpoint con otro usuario → 403.

---

## Bolt 6 — Historial de Uploads

**Unidad**: u5-history-storage
**Servicio**: ProgressService
**Ruta crítica**: Sí (paso 5 de 8)

**Definition of Done:**
- [ ] `GET /api/trends` (o endpoint de historial) devuelve lista ordenada por fecha de uploads del usuario autenticado
- [ ] Cada entrada: upload ID, fecha, scores por categoría, confidence flag
- [ ] ProgressService lee de la tabla `category_critiques` del schema `ingestion` con usuario read-only (`progress_reader`)
- [ ] Los uploads de baja confianza aparecen en el historial con confidence flag pero sin scores
- [ ] Tests unitarios: historial vacío, historial con entradas mixtas (válidas + baja confianza)
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: ProgressService puede leer desde el schema de IngestionService de forma read-only. El cross-schema access funciona con el usuario de BD correcto. El historial se muestra cronológicamente.

**Expected demo**: Tras 3 uploads, `GET .../trends` devuelve los 3 con sus scores y fechas ordenadas.

---

## Bolt 7 — Cálculo de Tendencias

**Unidad**: u6-trend-calculation
**Servicio**: ProgressService
**Ruta crítica**: Sí (paso 6 de 8)

**Definition of Done:**
- [ ] Regresión lineal calculada por (usuario, categoría) sobre los scores de uploads cualificados (no low_confidence)
- [ ] Mínimo 4 uploads cualificados por categoría para calcular tendencia
- [ ] Resultado: `improving` (pendiente ≥ +2), `stagnating` (entre -2 y +2), `worsening` (pendiente ≤ -2)
- [ ] Umbrales configurables en runtime (default: ±2 por upload)
- [ ] TrendSnapshot almacenado en schema `progress` para servir sin recalcular
- [ ] Tests unitarios: < 4 uploads (insufficient_data), improving, stagnating, worsening, con y sin uploads de baja confianza mezclados
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El algoritmo de regresión lineal produce tendencias correctas y los umbrales configurables funcionan. El sistema detecta correctamente cuándo hay datos insuficientes.

**Expected demo**: Con 4 uploads cuyos scores aumentan: `{ direction: "improving", scoreHistory: [...] }`.

---

## Bolt 8 — Límite de Uploads por Tier

**Unidad**: u9-upload-limits
**Servicio**: IdentityService
**Desbloqueado por**: Bolt 1 (u8); desbloquea Bolt 9 (u7) y Bolt 13 (u13)

**Definition of Done:**
- [ ] Contador mensual de uploads por usuario en tabla `tier_subscriptions` (schema `identity`)
- [ ] Free tier: límite de 10/mes; reset a 00:00 UTC el día 1 de cada mes
- [ ] `POST /api/uploads` rechaza con 402 cuando el contador llega a 0 (integración con IngestionService)
- [ ] Los uploads de baja confianza cuentan contra el límite
- [ ] `GET /api/users/me/limits` devuelve `{ tier, uploadsRemaining, uploadsLimit, resetDate }` (contrato C2)
- [ ] `GET /api/internal/users/{userId}/tier` devuelve tier y uploadsRemaining (contrato C6, network-trusted)
- [ ] Tests unitarios: primer upload, último upload, upload sobre límite, paid tier sin límite
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El sistema de límites del tier free funciona correctamente. El endpoint interno de tier status (C6) está disponible para ProgressService.

**Expected demo**: 10 uploads en un mismo mes → el undécimo devuelve 402. `GET .../limits` muestra `uploadsRemaining: 0`.

---

## Bolt 9 — API de Tendencias con Gate Freemium

**Unidad**: u7-tier-api
**Servicio**: ProgressService
**Ruta crítica**: Sí (paso 7 de 8) — cierra el freemium journey
**Requiere**: u6 (Bolt 7) + u9 (Bolt 8)

**Definition of Done:**
- [ ] `GET /api/trends` consulta tier del usuario a IdentityService (`GET /api/internal/users/{userId}/tier`) en cada request
- [ ] Paid tier: devuelve `{ tier: "paid", categories: [...] }` con direction + scoreHistory por categoría
- [ ] Free tier con datos: devuelve `{ tier: "free", categories: [{ status: "locked" }] }` — tendencias existen pero no son visibles
- [ ] Free tier sin datos suficientes: `{ status: "insufficient_data" }` independientemente del tier
- [ ] Tests unitarios: paid con datos, free con datos (locked), free sin datos, paid sin datos
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El gate de freemium funciona en tiempo real. Un cambio de tier (Bolt 11) se refleja inmediatamente en la respuesta de trends. La llamada interna a IdentityService (C6) es estable.

**Expected demo**: Usuario free con 4 uploads → `{ status: "locked" }`. Upgrade → `{ status: "improving" }`.

---

## Bolt 10 — Gate de Onboarding

**Unidad**: u11-onboarding
**Servicio**: TrustService

**Definition of Done:**
- [ ] `POST /api/onboarding` almacena acknowledgment de los 3 checkboxes (todos deben ser `true`; rechaza con 422 si alguno es `false`)
- [ ] `GET /api/onboarding` devuelve `{ completed: true | false }`
- [ ] El flujo de upload redirige a onboarding si `completed: false` (gestionado en el Frontend)
- [ ] Acknowledgment almacenado en tabla `onboarding_records` (schema `trust`), server-side; no se vuelve a mostrar tras la primera sesión
- [ ] Tests unitarios: onboarding completado, incompleto (checkbox false), acceso sin JWT
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El gate de onboarding funciona: usuarios nuevos no pueden hacer upload sin haber aceptado los 3 checkboxes. La lógica es server-side y no bypasseable desde el frontend.

**Expected demo**: Primera sesión → pantalla de onboarding obligatoria. Marcar los 3 checkboxes → acceso a Upload. Segunda sesión → sin onboarding.

---

## Bolt 11 — Mock Payment / Upgrade

**Unidad**: u10-mock-payment
**Servicio**: IdentityService
**Requiere**: u9 (Bolt 8)

**Definition of Done:**
- [ ] `POST /api/users/me/subscribe` transiciona al usuario a `tier: "paid"` inmediatamente; sin procesamiento de pago real
- [ ] Respuesta incluye aviso visible de que es un mock de desarrollo
- [ ] `GET /api/users/me/limits` devuelve `{ tier: "paid", uploadsRemaining: null, uploadsLimit: null }`
- [ ] El cambio de tier se refleja inmediatamente en `GET /api/trends` (Bolt 9)
- [ ] Tests unitarios: upgrade desde free tier, llamada desde paid tier (idempotente)
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El flujo de upgrade es funcional aunque sea simulado. El cambio de tier es inmediato y consistent entre IdentityService y ProgressService.

**Expected demo**: `POST /api/users/me/subscribe` → `{ tier: "paid", ... }`. `GET /api/trends` inmediatamente después → datos de tendencias visibles.

---

## Bolt 12 — Política de Datos

**Unidad**: u12-data-policy
**Servicio**: TrustService
**Requiere**: u8 (Bolt 1)

**Definition of Done:**
- [ ] `GET /api/policy` devuelve el contenido de la política en texto plano (incluye: no-AI-training sin consentimiento, enlace a borrado)
- [ ] Accessible desde Settings en ≤2 clicks desde cualquier pantalla
- [ ] Autenticación requerida (JWT)
- [ ] Tests unitarios: respuesta con contenido correcto, sin JWT
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El contenido de la política está disponible y accesible. Sin dependencias de datos dinámicos; es una entrega simple pero necesaria para compliance.

**Expected demo**: `GET /api/policy` → texto de política completo en JSON.

---

## Bolt 13 — Cascade de Borrado de Historial

**Unidad**: u13-history-deletion
**Servicio**: TrustService (coordinador)
**Requiere**: u4 (Bolt 5) + u5 (Bolt 6) + u6 (Bolt 7) + u8 (Bolt 1) + u9 (Bolt 8) — todos disponibles tras Bolt 9

**Definition of Done:**
- [ ] `DELETE /api/history` con `{ confirmation: "DELETE" }` activa el cascade:
  1. IngestionService: `DELETE /api/internal/users/{userId}/data` (uploads, critiques, blobs)
  2. ProgressService: `DELETE /api/internal/users/{userId}/data` (TrendSnapshot)
  3. IdentityService: `POST /api/internal/users/{userId}/reset-counter` (reset a 0)
  4. TrustService: borrado del OnboardingRecord del usuario
- [ ] Best-effort: procede y loguea fallos individuales; sólo devuelve 500 si TODOS los pasos fallan
- [ ] 404 en ProgressService tratado como no-op exitoso (datos ya ausentes)
- [ ] La cuenta del usuario permanece activa (sólo se borran los datos de historial)
- [ ] Sin confirmación textual ("DELETE") → rechaza con 400
- [ ] Tests unitarios: cascade completo, fallo parcial (best-effort), ProgressService 404 (no-op), confirmación incorrecta
- [ ] 80%+ líneas, 75%+ ramas

**Confidence hypothesis**: El cascade de borrado elimina todos los datos del usuario de forma coordinada a través de los 4 servicios. Los fallos parciales no dejan al sistema en un estado inconsistente desde la perspectiva del usuario.

**Expected demo**: `DELETE /api/history` con `{"confirmation":"DELETE"}` → 204. `GET /api/trends` → historial vacío. `GET /api/users/me/limits` → `uploadsRemaining: 10` (reset).
