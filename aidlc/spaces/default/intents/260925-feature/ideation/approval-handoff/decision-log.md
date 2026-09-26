# Decision Log — Estudio IDEATION

> All decisions made and formally approved during the IDEATION phase. These are the constraints and commitments that INCEPTION elaborates upon.

---

## DEC-01 — Primary Input Document

**Decision:** Use `entradas/prd.md` as the sole document input for this workflow. `entradas/pvb.md` was read for context but not registered as a source. The PRD consolidates the PVB and four other research documents.

**Stage:** Intent Capture | **Rationale:** The PRD is the final, comprehensive synthesis of all upstream research. Registering both would create redundant sourcing. The PRD hierarchy is unambiguous.

---

## DEC-02 — Product Problem Statement

**Decision:** Estudio solves the lack of structured memory about artistic progress — not the lack of quality AI critique. The critique quality problem is already commoditized by the market.

**Stage:** Intent Capture | **Rationale:** Positioning on critique quality is a losing proposition against free tools. The defensible position is data accumulation and pattern detection over time.

---

## DEC-03 — Primary Target User

**Decision:** Ana — self-taught artist with active structured practice routine (≥18 months), seeking community critique, already investing in her practice. Synthetic persona; no real primary research has been conducted.

**Stage:** Intent Capture | **Rationale:** Defined from secondary research in the PRD. To be validated with real users post-MVP (A-03 in RAID log).

---

## DEC-04 — Success Metrics Are Unvalidated Assumptions

**Decision:** The PRD's KPIs (North Star, upload frequency, conversion rate, categorization consistency, trend agreement) are documented as internal projections [INTERNO], not commitments. They are design hypotheses.

**Stage:** Intent Capture | **Rationale:** No primary user data exists to validate these numbers. Committing to them as targets would anchor decisions on unverifiable projections.

---

## DEC-05 — Primary Initiative Driver

**Decision:** The primary trigger for building Estudio now is the academic semester deadline — the MVP must be demonstrable by session 16 of the Kubernetes course.

**Stage:** Intent Capture | **Rationale:** The competitive window and cost viability are context factors; the forcing function is the academic calendar.

---

## DEC-06 — TBD Resolution: Geography

**Decision:** No explicit geographic targeting. MVP interface is in English.

**Stage:** Intent Capture | **Rationale:** The team works in Spanish but the product serves a broad audience; English is the standard for English-language art communities (Drawabox, r/ArtCrit, etc.) which are the primary target channels.

---

## DEC-07 — TBD Resolution: Payments

**Decision:** Payment provider integration is mocked in the MVP. The subscription tier system (free/paid boundaries) is real and enforced; the payment transaction is a stub.

**Stage:** Intent Capture | **Rationale:** Integrating a real payment provider adds complexity and compliance scope that does not contribute to validating the core product hypothesis (categorization consistency + trend detection).

---

## DEC-08 — TBD Resolution: Trend Threshold

**Decision:** The minimum number of uploads required to calculate a trend is 4, implemented as a configurable runtime parameter with a default of 4.

**Stage:** Intent Capture | **Rationale:** 4 is the PRD's proposed value, treated as a starting point, not a validated threshold. Configurable because the optimal value is empirical.

---

## DEC-09 — Competitive Position

**Decision:** Estudio does not compete on critique quality. The central differentiation message is: "The only app that measures whether your mistakes are a real pattern or an isolated comment."

**Stage:** Market Research | **Rationale:** Coartist is the closest competitor. The gap is granularity of per-category trend tracking, not the existence of the tracking concept. Competing on critique quality is a losing position (commoditized by free tools).

---

## DEC-10 — No Market Sizing in Artifacts

**Decision:** Market size figures are excluded from all artifacts. The product is an academic MVP; the specific subsegment (AI-powered art feedback tools) has no independent market report.

**Stage:** Market Research | **Rationale:** Using contested market-size figures from the PRD would introduce false precision into academic artifacts.

---

## DEC-11 — AI Vision: External API (Opción C)

**Decision:** Use an external AI vision API (Anthropic Claude Sonnet with vision capability) for image analysis and categorization. All other logic runs as own workloads on Kubernetes.

**Stage:** Market Research (Build-vs-Buy) + Feasibility | **Rationale:** Self-hosting a vision model at MVP scale adds complexity without improving categorization consistency. ~$0.02/analysis is viable for the freemium model.

---

## DEC-12 — Deployment: Local Kubernetes

**Decision:** The deployment target is a local Kubernetes cluster (minikube / kind / k3s). No cloud provider. No infrastructure budget.

**Stage:** Feasibility | **Rationale:** The project is academic; the course provides K8s infrastructure as a local cluster. No cloud credentials or budget are available.

---

## DEC-13 — Compliance: Design Principles Only

**Decision:** No formal regulatory certification (GDPR, HIPAA, PCI) is required for the MVP. Compliance posture is design-principle-based: no training without consent, visible data policy, self-service deletion.

**Stage:** Feasibility | **Rationale:** Academic MVP. The Principles from the PRD (especially Principle 3) are enforced as design constraints, not certification requirements.

---

## DEC-14 — Skill Risk: K8s + Prompt Engineering

**Decision:** Kubernetes operations and AI prompt engineering for consistent categorization are the two critical skill gaps. Both are addressed through the course structure and explicit validation steps.

**Stage:** Team Formation | **Rationale:** K8s is the newest skill (course provides onboarding). Prompt engineering is a non-standard skill for backend profiles that directly affects the North Star quality metric.

---

## DEC-15 — Stack: Node.js / TypeScript + React

**Decision:** Backend in Node.js / TypeScript. Frontend in React. Local K8s for deployment.

**Stage:** Team Formation | **Rationale:** The developer has some experience with this stack. TypeScript adds type safety relevant to the multi-service architecture.

---

## DEC-16 — Capacity: ~5h/week, Should Have Deferred

**Decision:** Available capacity is ~5 hours/week → ~50 hours total across modules 4–8. The Should Have items (U14: trend teaser, U15: upload context) are formally deferred. The priority is delivering the 13 Must Have units cleanly.

**Stage:** Team Formation | **Rationale:** Honest capacity assessment. Over-promising on Should Have items would risk the Must Have delivery.

---

## DEC-17 — History Deletion: Elevated to Must Have

**Decision:** Self-service history deletion (U13) is elevated from Should Have to Must Have. Users must be able to act on the data policy, not just read it.

**Stage:** Scope Definition | **Rationale:** A visible data policy without an actionable deletion mechanism is a trust design failure. Principle 3 requires verifiable enforcement.

---

## DEC-18 — Intent Backlog: Sub-Capability Granularity

**Decision:** The intent backlog is defined at the sub-capability level within each module, producing 15 proto-units (13 Must Have + 2 Should Have).

**Stage:** Scope Definition | **Rationale:** Module-level granularity (4 units) is too coarse for construction planning. Sub-capability granularity gives the architect and developer clear, independently testable work boundaries.

---

## DEC-19 — Won't Do (Explicit)

The following are explicitly out of scope and will not be reconsidered during INCEPTION without a formal scope change:
- Real payment provider integration
- Social/community sharing features
- AI art generation (any form)
- Self-hosted AI vision model
- Real-time human support channel
- Per-record (upload-by-upload) deletion — only full account history deletion is supported

**Stage:** Scope Definition | **Rationale:** All confirmed via Q5 of Scope Definition.

---

## DEC-20 — Definition of Done: Session 16

**Decision:** The initiative is demonstrably delivered when the full end-to-end flow runs on the local Kubernetes cluster: upload → AI categorized critique → trend visible for a paid user, with at least 4 prior uploads in that category.

**Stage:** Approval & Handoff | **Rationale:** Concrete, observable, testable by a third-party reviewer (course instructor). Does not require live users — the developer can generate test data during development.

---

## Open Decisions Carried to INCEPTION

These are unresolved items that INCEPTION must close before construction can begin:

| Open Decision | Stage That Resolves It |
|---|---|
| Diagnostic category taxonomy (composition, proportions, line quality, color, etc.) | Requirements Analysis |
| Free tier upload limit (number per period) | Requirements Analysis / Functional Design |
| Trend calculation algorithm (linear regression, moving average, etc.) | Functional Design |
| Low-confidence threshold for the fallback path | Functional Design |
| Local K8s resource requirements (RAM, CPU) validation | Infrastructure Design |
| Cost budget for Claude API development/testing | Requirements Analysis (constraint) |
