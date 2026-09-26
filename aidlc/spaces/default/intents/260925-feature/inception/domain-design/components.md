# Component Catalogue — Estudio MVP

> **Upstream references:** requirements.md, intent-backlog.md, decision-log.md
> **Scope:** Logical components only — deployment topology decided in Units Generation.

---

## Machine-Readable Component Catalogue

```yaml
components:
  - name: IngestionService
    kind: service
    owns:
      - ImageBlob        # binary blob storage (only component that reads/writes image bytes)
      - Upload           # aggregate: upload record with status and metadata
      - CategoryCritique # entity: one row per (upload, category) with score and feedback
    responsibilities:
      - Accept and validate image uploads (format, size, magic number)
      - Call Claude Vision API with the uploaded image
      - Parse and validate the structured AI response (5 categories, confidence flag)
      - Detect and route low-confidence responses to the fallback path
      - Store Upload record and CategoryCritique records in ingestion schema
      - Serve upload detail (thumbnail + critique) to authenticated owner only
    external_integrations:
      - name: Anthropic Claude Vision API
        protocol: HTTPS REST
        direction: outbound
        purpose: Image categorization and critique generation
    depends_on: []

  - name: ProgressService
    kind: service
    owns:
      - TrendSnapshot    # value object: computed trend direction per (user, category)
    responsibilities:
      - Query CategoryCritique scores from the shared database (ingestion schema, read access)
      - Calculate linear regression per (user_id, category_id) over qualified uploads
      - Return trend data (improving/stagnating/worsening + score series) for paid tier
      - Return locked trend signal (exists but not visible) for free tier
      - Re-calculate after each new qualified upload (triggered by IngestionService event or API call)
    external_integrations: []
    depends_on:
      - IngestionService  # reads CategoryCritique data via shared DB or internal API

  - name: IdentityService
    kind: service
    owns:
      - UserAccount       # aggregate: user credentials and profile
      - TierSubscription  # aggregate: tier status, upload counter, period
    responsibilities:
      - User registration (email + bcrypt-hashed password)
      - Session management (JWT issuance and validation)
      - Upload quota tracking (increment counter; enforce monthly limit)
      - Tier management (free vs. paid; mock payment upgrade)
      - Expose tier status to other services for enforcement decisions
    external_integrations: []
    depends_on: []

  - name: TrustService
    kind: service
    owns:
      - OnboardingRecord  # aggregate: per-user acknowledgment of 3 onboarding checkboxes
    responsibilities:
      - Record and verify onboarding acknowledgment (must complete before first upload)
      - Serve data policy content
      - Coordinate full history deletion cascade:
          calls IngestionService to delete all Upload + CategoryCritique + ImageBlob records for the user
          resets upload counter in IdentityService
          deletes OnboardingRecord for the user
    external_integrations: []
    depends_on:
      - IngestionService  # deletion cascade: delete Upload records and blobs
      - IdentityService   # deletion cascade: reset upload counter

  - name: Frontend
    kind: ui
    owns: []              # presentation only; no persistence
    responsibilities:
      - Serve the React SPA to the browser
      - Render all 4 screens (Onboarding, Upload, Critique View, Dashboard) + error states
      - Mediate all user interactions with the 4 backend services via REST HTTP
    external_integrations: []
    depends_on:
      - IngestionService
      - ProgressService
      - IdentityService
      - TrustService
```

---

## Component Diagram

```
+-----------------------------------------------------------+
| K8s Cluster (local: k3s / minikube / kind)                |
|                                                           |
|  +----------+                                             |
|  | Frontend |  (React SPA, served as static + Node.js)    |
|  +----+-----+                                             |
|       | REST HTTP (via K8s Ingress routing)               |
|       |                                                   |
|  +----+--------------------+----+----------+-----------+  |
|  |                         |    |          |           |  |
|  v                         v    v          v           v  |
|  +-----------------+  +----------+  +----------+  +------+|
|  | IngestionService|  | Progress |  | Identity |  |Trust ||
|  |                 |  | Service  |  | Service  |  |Svc   ||
|  | [Upload]        |  |          |  |[User]    |  |[Onb] ||
|  | [Critique]      |  |[Trend]   |  |[Tier]    |  |      ||
|  | [ImageBlob]     |  |          |  |          |  |      ||
|  +---+---+---------+  +----+-----+  +----------+  +--+---+|
|      |   |                 |  reads scores           |     |
|      |   |                 |  from ingestion schema  |     |
|      |   |                 |  (shared PostgreSQL)    |     |
|      |   +----------------------------+              |     |
|      |       blob read/write          |deletion      |     |
|      v                                |cascade       |     |
|  +-------+  +-----------------------+ |  v           |     |
|  | Blob  |  | PostgreSQL            | |  |           |     |
|  | Stor. |  | (single instance,     | |  |           |     |
|  | (MinIO|  | 4 schemas:            +-+  |           |     |
|  | /PVC) |  | ingestion / progress      |           |     |
|  +-------+  | identity / trust)    <----+           |     |
|             +-----------------------+               |     |
+-----------------------------------------------------------+

EXTERNAL:
  IngestionService --> [Anthropic Claude Vision API] (HTTPS, outbound only)
```

<!-- Text fallback: Five internal components inside a K8s cluster box. Frontend at the top communicates with all four backend services (IngestionService, ProgressService, IdentityService, TrustService) via HTTP REST through a K8s Ingress router. IngestionService owns a blob store (MinIO or a persistent volume) and the ingestion schema in a shared PostgreSQL instance. ProgressService reads from the ingestion schema for trend calculations. All four services share one PostgreSQL instance with four isolated schemas. IngestionService makes outbound calls to the Anthropic Claude Vision API. TrustService coordinates deletion cascades across IngestionService (blobs + records) and IdentityService (counter reset). -->

---

## Bounded Context Summary

| Context | Service | Core Aggregate | External API |
|---|---|---|---|
| Image Analysis | IngestionService | Upload + CategoryCritique | Anthropic Claude Vision API |
| Progress Tracking | ProgressService | TrendSnapshot (computed) | None |
| Identity & Access | IdentityService | UserAccount + TierSubscription | None |
| Trust & Policy | TrustService | OnboardingRecord | None |
| Presentation | Frontend | None (presentation layer) | None |

---

## Key Design Rules

1. **ImageBlob is owned exclusively by IngestionService.** No other component reads or writes image bytes. The frontend displays thumbnails via signed URLs issued by IngestionService, not by direct blob access. This enforces the privacy boundary from FR-4.2.

2. **ProgressService reads, never writes, CategoryCritique data.** The trend calculation is a read-only analytical operation on IngestionService's data. This is a Customer-Supplier relationship: IngestionService is upstream, ProgressService is downstream. The interface is a read-only database view or internal API.

3. **TrustService coordinates deletion but does not own the data it deletes.** History deletion requires a cross-context operation (OnboardingRecord + Upload records + blobs + counter). TrustService owns the orchestration, not the data. This is an intentional design smell accepted for MVP simplicity: the alternative (domain events + sagas) is too complex for the current capacity.

4. **Single PostgreSQL instance, four schemas.** Each service owns exactly one schema. No cross-schema foreign keys. Services access only their own schema in application code. The ProgressService exception (reading the ingestion schema) is the only cross-schema read allowed, and it is read-only.

---

## Assumptions & Open Questions

- The shared PostgreSQL instance is an MVP simplification. In a production system, each bounded context would own its own database instance to enforce true isolation. [assumption]
- The ProgressService reads directly from the ingestion schema (shared DB, cross-schema read). This violates strict bounded context isolation but is justified by the solo developer's capacity constraint (~5h/week). If this becomes a bottleneck, it can be replaced with a dedicated API call without changing the domain model. [assumption]
- Blob storage in the local K8s cluster uses a Persistent Volume Claim (PVC) or MinIO — this decision is deferred to Infrastructure Design. [assumption]
- The "signed URL" mechanism for thumbnail display assumes the IngestionService generates short-lived signed URLs. The implementation is deferred to Functional Design. [assumption]
