# Scope Document — Estudio MVP

> **Upstream references:** [intent] [feas] [cons]

## Product Boundary Statement

Estudio is a web platform that provides AI-powered technical critique on drawings and paintings and measures whether that feedback translates into real improvement over time — by accumulating and categorizing critique per user and detecting trends across successive uploads.

**What Estudio is:** A structured progress-memory layer on top of existing AI critique. [intent]
**What Estudio is not:** A source of critique quality superior to human feedback. A social platform. An AI art generator. [intent]

---

## MoSCoW Scope Definition

### Must Have — Blocking for MVP

| # | Capability | Module | Rationale |
|---|---|---|---|
| MH-1 | Image upload + format validation | M1 — Ingestion | Entry point for all user value |
| MH-2 | Claude vision API integration producing categorized critique | M1 — Ingestion | Core product differentiator |
| MH-3 | Low-confidence detection + explicit fallback (no silent bad critique) | M1 — Ingestion | Principle 5 (AI does not act autonomously on uncertain output); bad data corrupts the trend |
| MH-4 | Categorized critique storage per upload per user | M1 — Ingestion | Required for trend calculation |
| MH-5 | Structured history by diagnostic category per user | M2 — History | The data layer that makes trends possible |
| MH-6 | Trend calculation per category (improving / stagnating / worsening) — requires ≥4 uploads, configurable default | M2 — Trends | The North Star differentiator |
| MH-7 | Trend history API with tier enforcement (free = limited, paid = full trend access) | M2 — Trends | Required for the freemium model to have a real paywall |
| MH-8 | User registration + authentication | M3 — Accounts | Required for any per-user history |
| MH-9 | Free tier upload limit enforcement | M3 — Accounts | Freemium model requires a ceiling |
| MH-10 | Mock payment + paid tier upgrade flow | M3 — Accounts | Tier system must be demonstrable; payments are stubbed per prior decision |
| MH-11 | Onboarding screen with explicit "complement, not replacement" acknowledgment | M4 — Trust | Principle 1; required before first upload |
| MH-12 | Visible data policy (no training without consent) | M4 — Trust | Principle 3; trust prerequisite |
| MH-13 | Self-service history deletion (images + critiques) | M4 — Trust | **Elevated from Should Have** — directly tied to Principle 3; users must be able to act on the data policy, not just read it [Q3] |

### Should Have — Include if time permits

| # | Capability | Module | Priority within Should Have |
|---|---|---|---|
| SH-1 | Teaser of locked trend as conversion trigger (show trend exists, blur/block details) | M2 / M3 | High — primary free-to-paid conversion mechanism |
| SH-2 | Upload context confirmation (medium, subject matter, exercise type) | M1 | Medium — improves categorization accuracy for structured-practice users |

### Could Have — Future consideration

| # | Capability | Notes |
|---|---|---|
| CH-1 | Integration / reference to structured curricula (e.g. Drawabox exercises) | Requires knowing Drawabox's API policy — currently unverified [feas] |
| CH-2 | Aggregated learning across users (what patterns predict improvement) | Requires user volume to be meaningful; not buildable this semester |
| CH-3 | Anonymous peer comparison (how does my trend compare to other users at the same stage) | Requires user volume |

### Won't Have — Explicitly out of scope

| # | Capability | Reason |
|---|---|---|
| WH-1 | Human support channel in real time | Decided explicitly — out of MVP scope [Q5] |
| WH-2 | AI art generation (create / edit artwork with AI) | Explicit ICP disqualifier — not the use case [Q5] |
| WH-3 | Social / sharing features (posting work to community from the app) | No backing research; not the problem being solved [Q5] |
| WH-4 | Self-hosted AI vision model | Out of scope (Opción C architecture) [feas] |
| WH-5 | Real payment provider integration | Mocked in the MVP; post-MVP decision [intent] |

---

## Scope Boundary Diagram

```
+----------------------------------------------------------+
| IN SCOPE (Must Have)                                     |
|                                                          |
|  [Upload] --> [Claude API] --> [Categorized Critique]    |
|       |                              |                   |
|       v                              v                   |
|  [Storage]  ---------> [Trend Engine] --> [Tier Gate]   |
|       |                                        |         |
|       v                                        v         |
|  [Auth/Accounts]              [Free | Paid Upgrade]     |
|       |                                                  |
|       v                                                  |
|  [Onboarding Gate + Data Policy + History Deletion]      |
+----------------------------------------------------------+

OUT OF SCOPE: Real payments | Social features | AI art gen | Self-hosted model
```

---

## Build Sequence

Aligned to academic course progression (K8s modules 4–8): [Q2]

| Course Module | Build Focus |
|---|---|
| Module 4–5 (K8s basics, CKA) | K8s cluster setup; API gateway; service skeleton; basic auth (MH-8); image ingestion endpoint stub (MH-1) |
| Module 6 (CKAD) | Full Module 1 (MH-1 through MH-4); Module 2 (MH-5, MH-6, MH-7); Claude API integration live |
| Module 7 (CKS) | Module 3 (MH-8 through MH-10); Module 4 (MH-11, MH-12, MH-13); Secrets management for Claude API key |
| Module 8 (Production) | GitOps pipeline; full integration test; Should Have if time allows |
| Session 16 | Live demo with real trend data accumulated during development |

---

## Assumptions & Open Questions

- MH-13 (history deletion) was elevated from Should Have to Must Have because a visible data policy without an actionable deletion mechanism is a design promise without teeth. [Q3]
- SH-1 (teaser) is deprioritized relative to completing the Must Have cleanly — if time runs short, it is the first thing to cut. [assumption]
- The course instructor's specific expectations for what constitutes a "production-ready" K8s deployment at session 16 may affect the Must Have list (e.g., if observability is required). [assumption] [feas]
