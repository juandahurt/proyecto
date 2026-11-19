## Sources

- [units] inception/units-generation/unit-of-work.md
- [dep] inception/units-generation/unit-of-work-dependency.md
- [comp] inception/domain-design/components.md
- [req] inception/requirements-analysis/requirements.md

---

# Contract Summary — Estudio MVP

> Defines every formal boundary in the system: what data crosses it, in what shape, via what protocol, and what happens when things go wrong. Derived from the 14-unit DAG (unit-of-work-dependency.md) and the 5-component catalogue (components.md).

## Routing Architecture

All Frontend → Backend traffic enters the cluster through one K8s Ingress controller using path-prefix routing. Backend services do not know the Ingress rules; they only see requests on their own path prefix.

```
Browser → HTTPS → K8s Ingress
  /api/uploads/*    → IngestionService  (Pod)
  /api/auth/*       → IdentityService   (Pod)
  /api/users/*      → IdentityService   (Pod)
  /api/trends/*     → ProgressService   (Pod)
  /api/onboarding/* → TrustService      (Pod)
  /api/policy/*     → TrustService      (Pod)
  /api/history/*    → TrustService      (Pod)
```

Internal service-to-service calls use the K8s ClusterIP DNS name of each service directly (e.g. `http://identity-service/api/internal/...`). No auth is applied to internal calls — the K8s namespace network boundary is the security perimeter.

---

## Contracts Table

| # | Provider | Consumer | Mechanism | Owner | Units |
|---|---|---|---|---|---|
| C1 | IngestionService | Frontend | REST HTTP (K8s Ingress) | IngestionService | u1, u4 |
| C2 | IdentityService | Frontend | REST HTTP (K8s Ingress) | IdentityService | u8, u9, u10 |
| C3 | ProgressService | Frontend | REST HTTP (K8s Ingress) | ProgressService | u7 |
| C4 | TrustService | Frontend | REST HTTP (K8s Ingress) | TrustService | u11, u12, u13 |
| C5 | IngestionService | ProgressService | PostgreSQL shared schema (read-only) | IngestionService | u6 |
| C6 | IdentityService | ProgressService | REST HTTP (internal) | IdentityService | u7, u9 |
| C7 | IngestionService | TrustService | REST HTTP (internal) | IngestionService | u13 |
| C8 | IdentityService | TrustService | REST HTTP (internal) | IdentityService | u13 |
| C9 | ProgressService | TrustService | REST HTTP (internal) | ProgressService | u13 |
| C10 | Anthropic Claude Vision API | IngestionService | HTTPS REST (external, outbound) | External | u2, u3 |

---

## C1: IngestionService — Frontend API

Owner: IngestionService. All endpoints require a valid JWT in `Authorization: Bearer <token>`.

```yaml
# OpenAPI snippet — IngestionService user-facing endpoints
openapi: "3.0.0"
info:
  title: IngestionService
  version: "1"
paths:
  /api/uploads:
    post:
      summary: Upload an image for critique
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: JPEG, PNG, or WebP; max 10 MB; magic-number validated server-side
      responses:
        "202":
          description: Upload accepted; critique processing is synchronous in MVP
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UploadResult"
        "401":
          description: Missing or invalid JWT
        "402":
          description: Free tier upload limit reached
        "413":
          description: File exceeds 10 MB
        "422":
          description: Invalid image format (magic-number check failed or unsupported MIME type)

  /api/uploads/{uploadId}:
    get:
      summary: Get critique for a specific upload (authenticated owner only)
      security:
        - bearerAuth: []
      parameters:
        - name: uploadId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UploadDetail"
        "401":
          description: Missing or invalid JWT
        "403":
          description: Upload belongs to a different user
        "404":
          description: Upload not found

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    UploadResult:
      type: object
      required: [uploadId, status, confidence]
      properties:
        uploadId:
          type: string
          format: uuid
        status:
          type: string
          enum: [ready, low_confidence]
        confidence:
          type: string
          enum: [HIGH, MEDIUM, LOW]
        categories:
          description: Present only when confidence is HIGH or MEDIUM
          type: array
          items:
            $ref: "#/components/schemas/CategoryCritique"
        fallbackReason:
          description: Present only when status is low_confidence
          type: string
          enum: [low_confidence_flag, invalid_schema, timeout]
    CategoryCritique:
      type: object
      required: [categoryId, categoryName, score, feedback]
      properties:
        categoryId:
          type: string
          enum: [CAT-1, CAT-2, CAT-3, CAT-4, CAT-5]
        categoryName:
          type: string
          enum: [Composition, Proportions, "Line Quality", "Values (Shading)", Perspective]
        score:
          type: integer
          minimum: 0
          maximum: 100
        feedback:
          type: string
          minLength: 1
    UploadDetail:
      allOf:
        - $ref: "#/components/schemas/UploadResult"
        - type: object
          properties:
            thumbnailUrl:
              type: string
              description: Short-lived signed URL to the image thumbnail; valid for 15 minutes
            timestamp:
              type: string
              format: date-time
```

---

## C2: IdentityService — Frontend API

Owner: IdentityService.

```yaml
# OpenAPI snippet — IdentityService user-facing endpoints
openapi: "3.0.0"
info:
  title: IdentityService
  version: "1"
paths:
  /api/auth/register:
    post:
      summary: Register a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
      responses:
        "201":
          description: User created; returns JWT
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "409":
          description: Email already registered

  /api/auth/login:
    post:
      summary: Authenticate and get a JWT
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          description: Invalid credentials

  /api/users/me/limits:
    get:
      summary: Get current upload limits for the authenticated user
      security:
        - bearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LimitsResponse"

  /api/users/me/subscribe:
    post:
      summary: Mock paid tier upgrade (no real payment)
      security:
        - bearerAuth: []
      responses:
        "200":
          description: User is now on paid tier
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LimitsResponse"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    AuthResponse:
      type: object
      required: [token, expiresIn]
      properties:
        token:
          type: string
          description: JWT; 7-day TTL (configurable)
        expiresIn:
          type: integer
          description: TTL in seconds
    LimitsResponse:
      type: object
      required: [tier, uploadsRemaining, uploadsLimit, resetDate]
      properties:
        tier:
          type: string
          enum: [free, paid]
        uploadsRemaining:
          type: integer
          description: Null for paid tier (no limit)
          nullable: true
        uploadsLimit:
          type: integer
          description: 10 for free tier; null for paid
          nullable: true
        resetDate:
          type: string
          format: date
          description: 1st of next month UTC; null for paid tier
          nullable: true
```

---

## C3: ProgressService — Frontend API

Owner: ProgressService. Tier-gated: free tier returns locked signal, paid tier returns full trend data (FR-7).

```yaml
# OpenAPI snippet — ProgressService user-facing endpoints
openapi: "3.0.0"
info:
  title: ProgressService
  version: "1"
paths:
  /api/trends:
    get:
      summary: Get trend data for the authenticated user (tier-gated)
      security:
        - bearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TrendResponse"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    TrendResponse:
      type: object
      required: [tier, categories]
      properties:
        tier:
          type: string
          enum: [free, paid]
        categories:
          type: array
          items:
            $ref: "#/components/schemas/CategoryTrend"
    CategoryTrend:
      type: object
      required: [categoryId, categoryName, status]
      properties:
        categoryId:
          type: string
          enum: [CAT-1, CAT-2, CAT-3, CAT-4, CAT-5]
        categoryName:
          type: string
        status:
          type: string
          enum: [locked, insufficient_data, improving, stagnating, worsening]
          description: >
            locked: free tier, trend exists but is gated.
            insufficient_data: fewer than 4 qualified uploads.
            improving/stagnating/worsening: paid tier full result.
        trend:
          description: Present only for paid tier when status is improving/stagnating/worsening
          type: object
          properties:
            direction:
              type: string
              enum: [improving, stagnating, worsening]
            scoreHistory:
              type: array
              items:
                type: object
                properties:
                  uploadId:
                    type: string
                    format: uuid
                  score:
                    type: integer
                  timestamp:
                    type: string
                    format: date-time
```

---

## C4: TrustService — Frontend API

Owner: TrustService.

> **CORREGIDO (u0-T01, ola 10).** La implementación de trust (u11-T01) responde `GET /api/onboarding` con `200 {data:{completed},error:null,status:200}` y `POST /api/onboarding` con `200` y el mismo envoltorio (`422` si falta algún checkbox), no `{completed}` plano ni `204`. Manda el handler; el YAML de abajo se conserva como historia.

```yaml
# OpenAPI snippet — TrustService user-facing endpoints
openapi: "3.0.0"
info:
  title: TrustService
  version: "1"
paths:
  /api/onboarding:
    get:
      summary: Check if the user has completed onboarding
      security:
        - bearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  completed:
                    type: boolean
    post:
      summary: Record onboarding acknowledgment (3 checkboxes confirmed)
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [checkbox1, checkbox2, checkbox3]
              properties:
                checkbox1:
                  type: boolean
                  description: "Estudio complements human critique, not replaces it"
                checkbox2:
                  type: boolean
                  description: "AI feedback is categorized input, not a verdict"
                checkbox3:
                  type: boolean
                  description: "Images are not used to train AI without explicit consent, and can be deleted"
      responses:
        "204":
          description: Onboarding acknowledged; stored server-side
        "422":
          description: Not all 3 checkboxes are true

  /api/policy:
    get:
      summary: Retrieve the data policy content
      security:
        - bearerAuth: []
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  content:
                    type: string
                    description: Plain-language policy text

  /api/history:
    delete:
      summary: Two-step permanent deletion of all user history
      description: >
        Deletes all images, critique records, trend data, and resets upload counter.
        Deletion is permanent. User account is preserved.
        Best-effort cascade: proceeds and logs failures; returns error only if ALL steps fail.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [confirmation]
              properties:
                confirmation:
                  type: string
                  enum: ["DELETE"]
                  description: Must be the literal string "DELETE" to confirm
      responses:
        "204":
          description: Deletion complete (or best-effort complete)
        "400":
          description: Confirmation string was not "DELETE"
        "500":
          description: All cascade steps failed

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## C5: ProgressService → IngestionService — Shared Schema (read-only)

> **SUPERADO (decisión del humano, ola 6, u5-T01).** El MVP no usa PostgreSQL: la BD es SQLite en un PVC `ReadWriteOnce` con un único dueño (ingestion), así que no hay schema compartido ni usuario de solo lectura. C5 pasa a ser un **contrato HTTP**: ProgressService llama a `GET /api/uploads` de ingestion **reenviando el JWT del usuario** (sin endpoint interno, sin token de servicio, sin Secret nuevo). El body es `UploadListSchema` en `packages/shared-types/src/uploads.ts` (items con `uploadId`, `timestamp`, `status`, `confidence`, `scores[{categoryId, score}]` y `fallbackReason?`; orden más reciente primero, sin paginación). Las columnas de abajo siguen siendo la fuente de esos campos y no se renombran. El texto original se conserva como historia.

This boundary is a **PostgreSQL schema dependency**, not an HTTP API. ProgressService has a read-only database user on the `ingestion` schema. There is no HTTP contract here. This is the accepted MVP exception from the Domain Design stage.

```yaml
# shared-schema — IngestionService ingestion schema (subset exposed to ProgressService)
schema: ingestion
consumer: ProgressService
access: READ-ONLY
tables:
  uploads:
    description: One row per uploaded image
    columns:
      upload_id:    { type: uuid, primary_key: true }
      user_id:      { type: uuid, not_null: true }
      timestamp:    { type: timestamptz, not_null: true }
      confidence:   { type: enum("HIGH","MEDIUM","LOW"), not_null: true }
  category_critiques:
    description: One row per (upload, category)
    columns:
      critique_id:  { type: uuid, primary_key: true }
      upload_id:    { type: uuid, fk: uploads.upload_id }
      category_id:  { type: enum("CAT-1","CAT-2","CAT-3","CAT-4","CAT-5") }
      score:        { type: smallint, nullable: true, description: "NULL when confidence=LOW" }
breaking_change_policy: >
  ProgressService reads only the columns listed above.
  Adding new columns to these tables is non-breaking.
  Removing or renaming upload_id, user_id, timestamp, confidence, category_id, or score is breaking and requires updating ProgressService in the same Bolt.
```

---

## C6: IdentityService → ProgressService — Tier Status (internal)

Used by ProgressService (u7) to determine tier before returning trend data. Called on every trend API request; no caching.

> **SUPERADO (decisión de diseño del orquestador, ola 10, u7-T01; el humano puede objetarla).** No se construye el endpoint interno `/api/internal/users/{userId}/tier`: exigiría tocar y reiniciar identity y publicaría el tier de cualquier `userId` sin autenticación (no hay `NetworkPolicy`). C6 pasa a ser un **contrato HTTP con el JWT del usuario**: ProgressService llama a `GET /api/users/me/limits` de identity **reenviando solo `Authorization`** y valida el cuerpo con `LimitsResponseSchema` (`packages/shared-types/src/limits.ts`; `tier` es `free` o `paid`). Sigue sin caché: una llamada por cada petición a `/api/trends`. Si identity falla, ProgressService no devuelve datos de tendencia (401/504/502), nunca asume un tier. El texto original se conserva como historia.

```yaml
# OpenAPI snippet — IdentityService internal endpoint
openapi: "3.0.0"
info:
  title: IdentityService — Internal
  version: "1"
paths:
  /api/internal/users/{userId}/tier:
    get:
      summary: Get tier status for a user (internal call from ProgressService)
      description: Network-trusted; no JWT required. Called by ProgressService only.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                required: [tier, uploadsRemaining]
                properties:
                  tier:
                    type: string
                    enum: [free, paid]
                  uploadsRemaining:
                    type: integer
                    nullable: true
                    description: Number remaining this month; null for paid tier
        "404":
          description: User not found
```

---

## C7: IngestionService → TrustService — Delete User Data (internal)

Called by TrustService (u13) as part of the deletion cascade. Best-effort: IngestionService deletes all uploads, critiques, and blobs for the user.

```yaml
# OpenAPI snippet — IngestionService internal endpoint
openapi: "3.0.0"
info:
  title: IngestionService — Internal
  version: "1"
paths:
  /api/internal/users/{userId}/data:
    delete:
      summary: Delete all uploads, critiques, and image blobs for a user
      description: >
        Network-trusted; no JWT required. Called by TrustService only.
        Best-effort: proceeds on partial failures, logs them, returns 204.
        Returns 500 only if the entire operation fails.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: All data deleted (or best-effort deletion completed)
        "500":
          description: Complete failure — could not delete any data
```

---

## C8: IdentityService → TrustService — Reset Upload Counter (internal)

Called by TrustService (u13) after all data is deleted. Resets the monthly upload counter to 0.

```yaml
# OpenAPI snippet — IdentityService internal endpoint
openapi: "3.0.0"
info:
  title: IdentityService — Internal (counter reset)
  version: "1"
paths:
  /api/internal/users/{userId}/reset-counter:
    post:
      summary: Reset the monthly upload counter to 0
      description: Network-trusted; no JWT required. Called by TrustService only.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: Counter reset to 0
        "404":
          description: User not found
```

---

## C9: ProgressService → TrustService — Delete Trend Data (internal)

Called by TrustService (u13) to clear TrendSnapshot data for the user.

```yaml
# OpenAPI snippet — ProgressService internal endpoint
openapi: "3.0.0"
info:
  title: ProgressService — Internal
  version: "1"
paths:
  /api/internal/users/{userId}/data:
    delete:
      summary: Delete all TrendSnapshot data for a user
      description: Network-trusted; no JWT required. Called by TrustService only.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: Trend data deleted
        "404":
          description: No data found for this user (idempotent — still 204 is acceptable)
```

---

## C10: Anthropic Claude Vision API — External

Outbound-only from IngestionService. The contract defines the structured JSON schema that the prompt must elicit and that the contract test (team.md) validates.

```yaml
# OpenAPI snippet — Anthropic Claude Vision API contract (response schema)
# This is the shape IngestionService requests via the Claude API prompt.
# The contract test validates that actual Claude responses conform to this schema.
openapi: "3.0.0"
info:
  title: Claude Vision API — Contract Schema
  version: "1"
components:
  schemas:
    ClaudeRequest:
      description: >
        Prompt must instruct Claude to return JSON with this exact shape.
        Prompt language: English (FR-2.4).
        Auth: ANTHROPIC_API_KEY from K8s Secret (FR-2.5, NFR-6).
      type: object
      properties:
        model:
          type: string
          description: Claude model ID (e.g. claude-3-5-sonnet-20241022)
        max_tokens:
          type: integer
        messages:
          type: array
    ClaudeResponse:
      description: >
        Expected JSON structure returned by Claude. Contract test validates this schema.
        Deviations from this schema trigger the low-confidence fallback (FR-3.2).
      type: object
      required: [confidence, categories]
      properties:
        confidence:
          type: string
          enum: [HIGH, MEDIUM, LOW]
          description: Overall confidence in the critique quality
        categories:
          type: array
          minItems: 5
          maxItems: 5
          items:
            type: object
            required: [id, name, score, feedback]
            properties:
              id:
                type: string
                enum: [CAT-1, CAT-2, CAT-3, CAT-4, CAT-5]
              name:
                type: string
                enum: [Composition, Proportions, "Line Quality", "Values (Shading)", Perspective]
              score:
                type: integer
                minimum: 0
                maximum: 100
                description: Score outside 0-100 triggers low-confidence fallback (FR-3.2)
              feedback:
                type: string
                minLength: 2
                description: At least 2 sentences of feedback per category (FR-2.1)
    ErrorBehavior:
      description: >
        Timeout: 30 seconds (configurable at runtime, FR-3.3).
        On timeout: low-confidence fallback path (FR-3.3). No retry.
        On invalid schema: low-confidence fallback path (FR-3.2).
        On API error (5xx): low-confidence fallback path. No retry.
```

---

## Contract Ownership Rules

1. **Each service owns and maintains its own API specs** (C1 owned by IngestionService, C2 owned by IdentityService, etc.). The schema definition in this document is the source of truth; each service must conform to it at Code Generation time.

2. **IngestionService owns the shared schema** (C5). ProgressService is read-only and must not assume schema fields beyond those listed in C5.

3. **Additive changes are non-breaking** across all contracts: adding optional fields to response objects, adding new endpoints, adding new enum values that consumers can ignore. Producers may do this in any Bolt without coordination.

4. **Breaking changes** (removing a field, changing a type, changing an enum that consumers depend on, removing an endpoint) require updating both provider and consumer in the same Bolt. Since this is a monorepo with a single developer, coordination happens within the same git branch. The `packages/shared-types` package owns all TypeScript interfaces derived from these contracts (team.md mandate).

5. **No URL versioning** in MVP. Contracts are implicitly v1. If a breaking change is needed, update the spec, update all consumers in the same Bolt, and update this document.

6. **The Claude Vision API contract test** (affirmed in team.md) validates that actual Claude API responses conform to the `ClaudeResponse` schema in C10. This test must pass in CI.

---

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| None. | All contracts are fully specified for Code Generation. | — |
