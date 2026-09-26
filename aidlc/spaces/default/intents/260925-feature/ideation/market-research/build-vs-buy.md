# Build vs. Buy Assessment — Estudio

> **Upstream reference:** Decisions are grounded in the product scope and modules defined in `ideation/intent-capture/intent-statement.md`. [Q1-intent]

## Decision Summary

| Component | Decision | Rationale |
|---|---|---|
| AI Vision (image analysis & categorization) | **BUY** — external API | Consistency of categorization is the North Star quality gate; self-hosting a vision model adds complexity without improving consistency at MVP scale |
| History & trend detection logic | **BUILD** | Core proprietary value layer — the structured memory over time is what differentiates Estudio |
| Accounts & subscription management | **BUILD** | Standard CRUD service; payments are mocked in MVP (see below) |
| API gateway & orchestration | **BUILD** | Own Kubernetes workloads; no off-the-shelf API gateway needed at MVP scale |
| Payment integration | **MOCK** — stub only for MVP | Payment provider integration is explicitly out of MVP scope; the subscription tier system is designed but not connected to a real payment provider |
| Data storage & image persistence | **BUILD** | Own database and blob storage on Kubernetes |

[Q4] [Q1-intent]

## AI Vision Component — BUY Rationale

**Decision:** Use an external AI vision API (Claude / equivalent model with vision capability) for image analysis and diagnostic categorization.

**Why not build (self-host)?**
- Self-hosting a vision model capable of consistent art critique categorization would require significant GPU infrastructure and fine-tuning effort — out of scope for a semester MVP on Kubernetes.
- Consistency of categorization is a non-negotiable product quality requirement. External APIs with state-of-the-art models provide better out-of-the-box consistency than a self-hosted model without extensive fine-tuning data.
- The cost (~$0.02/analysis) is viable for the freemium model as designed.

**Risk:** External API dependency. Mitigation: abstract the external call behind a service interface so the API provider can be changed without rewriting the trend detection logic. [Q4] [Q1-intent]

**Pricing risk:** The introductory API pricing window closes August 31, 2026. Costs may increase ~50% after that date. The gross margin calculation in the PRD should be recalculated before finalizing pricing. [Q4]

## Payment Integration — MOCK Decision

**Decision:** Payments are mocked in the MVP. The subscription tier system (free vs. paid) is fully designed and enforced in product logic, but no real payment provider (Stripe, MercadoPago, or equivalent) is integrated in this scope.

**Implication for design:** The accounts & subscription module must be designed with a clear payment provider abstraction boundary, so a real provider can be plugged in post-MVP without redesigning the tier enforcement logic. [Q4] [Q1-intent]

## What is NOT a Build-vs-Buy Question for this MVP

- **Community features / social layer:** Explicitly out of scope (Won't Have in PRD). No buy decision needed.
- **AI art generation:** Out of scope by ICP definition. Not evaluated.
- **Observability / monitoring:** Will be addressed in the Operations phase; not a MVP build-vs-buy question.

## Assumptions & Open Questions

- The choice of external AI vision provider (Claude API vs. alternatives) is not yet finalized — this is an architectural decision for the Functional Design or NFR Design stages. [assumption]
- Payment provider selection remains TBD post-MVP; the abstraction boundary must be designed now to avoid rework. [assumption]
