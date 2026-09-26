# Unit of Work — Estudio MVP

> **Source:** intent-backlog.md (proto-units U1-U13), domain-design/components.md
> **Total units:** 14 (13 backend/logic + 1 UI walking skeleton)
> **Granularity:** One unit per proto-unit (Q1=A); Frontend as walking skeleton (Q2=B)

---

## Machine-Readable Unit Catalogue

```yaml
units:
  - name: u0-frontend
    kind: ui
    description: >
      React SPA walking skeleton — thin connected layer with all 4 service stubs.
      Built in Bolt 1. Provides the Upload screen, Onboarding screen, and basic
      routing so integration problems surface immediately.
    service: Frontend
    depends_on: []
    proto_unit: "walking-skeleton"
    stories: [US-1, US-11]

  - name: u1-image-upload
    kind: service
    description: >
      Upload endpoint: accept JPEG/PNG/WebP, enforce 10MB limit, validate magic number,
      generate server-side filename, return upload ID. Requires authenticated session.
    service: IngestionService
    depends_on: [u0-frontend, u8-authentication]
    proto_unit: U1
    stories: [US-1]

  - name: u2-ai-critique
    kind: service
    description: >
      Call Claude Vision API with the uploaded image. Parse structured JSON response
      with 5 categories (Composition, Proportions, Line Quality, Values, Perspective),
      scores (0-100), feedback text, and confidence field (HIGH/MEDIUM/LOW).
    service: IngestionService
    depends_on: [u1-image-upload]
    proto_unit: U2
    stories: [US-2]

  - name: u3-low-confidence
    kind: service
    description: >
      Detect and route low-confidence AI responses: LOW confidence flag, invalid
      schema (missing categories, out-of-range scores), or API timeout (30s default).
      Return explicit fallback response to the caller. Upload record is stored but
      flagged; excluded from trend calculation.
    service: IngestionService
    depends_on: [u2-ai-critique]
    proto_unit: U3
    stories: [US-3]

  - name: u4-critique-storage
    kind: service
    description: >
      Persist Upload record and CategoryCritique records (one per category per upload)
      in the ingestion schema. Image blob stored in blob store (PVC/MinIO).
      Serve upload detail (thumbnail signed URL + critique) to authenticated owner only.
    service: IngestionService
    depends_on: [u2-ai-critique, u3-low-confidence, u8-authentication]
    proto_unit: U4
    stories: [US-4]

  - name: u5-history-storage
    kind: service
    description: >
      Expose the time-ordered history of qualified and low-confidence uploads per user.
      Read from ingestion schema (read-only user). Serve list endpoint with upload ID,
      date, per-category scores, and confidence flag.
    service: ProgressService
    depends_on: [u4-critique-storage]
    proto_unit: U5
    stories: [US-5]

  - name: u6-trend-calculation
    kind: service
    description: >
      Calculate trend direction (improving/stagnating/worsening) per (user, category)
      using linear regression over qualified upload scores. Require minimum 4 qualified
      uploads per category. Configurable slope thresholds (default: +2/-2 per upload).
    service: ProgressService
    depends_on: [u5-history-storage]
    proto_unit: U6
    stories: [US-6]

  - name: u7-tier-api
    kind: service
    description: >
      Tier-gated trend API: free tier returns locked signal (trend exists, no values);
      paid tier returns full trend direction and score series per category.
      Tier status pulled from IdentityService at request time.
    service: ProgressService
    depends_on: [u6-trend-calculation, u9-upload-limits]
    proto_unit: U7
    stories: [US-7]

  - name: u8-authentication
    kind: service
    description: >
      User registration (email + bcrypt password, 8+ chars) and login (JWT, 7-day TTL).
      All backend endpoints validate JWT. Duplicate email registration returns 409.
    service: IdentityService
    depends_on: []
    proto_unit: U8
    stories: [US-8]

  - name: u9-upload-limits
    kind: service
    description: >
      Track monthly upload counter per user (free tier: 10/month, resets 00:00 UTC on
      the 1st). Enforce limit: return 402 when counter reaches 0. Low-confidence
      uploads count against the limit.
    service: IdentityService
    depends_on: [u8-authentication]
    proto_unit: U9
    stories: [US-9]

  - name: u10-mock-payment
    kind: service
    description: >
      Pricing page and mock upgrade flow. Single "Pay" action transitions user to paid
      tier immediately with no real payment processing. Display development mock notice.
    service: IdentityService
    depends_on: [u9-upload-limits]
    proto_unit: U10
    stories: [US-10]

  - name: u11-onboarding
    kind: service
    description: >
      Store and verify per-user onboarding acknowledgment (3 checkboxes with exact copy).
      Gate the upload flow: redirect first-session users to onboarding before Upload screen.
      Acknowledgment stored server-side; not shown again after first session.
    service: TrustService
    depends_on: [u8-authentication]
    proto_unit: U11
    stories: [US-11]

  - name: u12-data-policy
    kind: service
    description: >
      Serve data policy content (plain language, states no-AI-training without consent,
      links to deletion). Accessible from Settings at any time (≤2 clicks).
      Static content — no functional dependency on u11. Both u11 and u12 are deployed
      as part of TrustService, but u12 can be built and tested independently.
    service: TrustService
    depends_on: [u8-authentication]
    proto_unit: U12
    stories: [US-12]

  - name: u13-history-deletion
    kind: service
    description: >
      Two-step deletion cascade: user types "DELETE" to confirm; system deletes all
      images (blobs), critique records, trend data, and resets upload counter.
      Deletion is permanent (no soft-delete). Best-effort cascade: proceed and log
      failures; return user-visible error only if all steps fail.
      TrustService calls ProgressService to clear TrendSnapshot data — does NOT
      write directly to the progress schema. This inter-service call is part of
      the deletion cascade.
    service: TrustService
    depends_on: [u4-critique-storage, u5-history-storage, u6-trend-calculation, u8-authentication, u9-upload-limits]
    proto_unit: U13
    stories: [US-13]
```

---

## Unit Summary Table

| Unit ID | Name | Service | Proto | Stories | Key Dependencies |
|---|---|---|---|---|---|
| u0-frontend | Frontend Walking Skeleton | Frontend | WS | US-1, US-11 | none |
| u1-image-upload | Image Upload & Validation | IngestionService | U1 | US-1 | u0, u8 |
| u2-ai-critique | AI Critique Generation | IngestionService | U2 | US-2 | u1 |
| u3-low-confidence | Low-Confidence Fallback | IngestionService | U3 | US-3 | u2 |
| u4-critique-storage | Critique Storage | IngestionService | U4 | US-4 | u2, u3, u8 |
| u5-history-storage | History Storage & Retrieval | ProgressService | U5 | US-5 | u4 |
| u6-trend-calculation | Trend Calculation Engine | ProgressService | U6 | US-6 | u5 |
| u7-tier-api | Tier-Gated Trend API | ProgressService | U7 | US-7 | u6, u9 |
| u8-authentication | User Authentication | IdentityService | U8 | US-8 | none |
| u9-upload-limits | Free Tier Upload Limits | IdentityService | U9 | US-9 | u8 |
| u10-mock-payment | Mock Payment & Upgrade | IdentityService | U10 | US-10 | u9 |
| u11-onboarding | Onboarding Gate | TrustService | U11 | US-11 | u8 |
| u12-data-policy | Data Policy Display | TrustService | U12 | US-12 | u8 (auth only) |
| u13-history-deletion | Self-Service History Deletion | TrustService | U13 | US-13 | u4, u5, u6, u8, u9 |

---

## Walking Skeleton Note

**u0-frontend** (Bolt 1) is the walking skeleton. It establishes:
- K8s Ingress routing to all 4 backend service endpoints
- React SPA serving from the Frontend deployment
- The Upload screen (thin, connected to u1 stubs)
- The Onboarding screen (thin, connected to u11 stubs)
- End-to-end request flow: Browser → Ingress → Service → DB stub → Response

Purpose: surface K8s integration problems during Bolt 1 before u1-u13 business logic units are built in subsequent Bolts.

---

## Assumptions & Open Questions

- u7 depends on u9 for tier status at request time. The inter-service communication (ProgressService calls IdentityService) is deferred to Functional Design; for the dependency graph, u7 cannot be completed before u9 has a working tier status API. [assumption]
- u13 deletion cascade is best-effort (proceed and log failures). This was accepted at the Domain Design gate (R-01 from the architecture review). [assumption]
- The Frontend (u0) is the walking skeleton but also grows with each subsequent Bolt — it is not "done" at Bolt 1. Each backend unit adds UI screens. The unit definition covers the initial skeleton; screen increments are tracked in Delivery Planning. [assumption]
