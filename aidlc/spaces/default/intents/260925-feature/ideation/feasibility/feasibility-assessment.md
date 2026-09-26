# Feasibility Assessment — Estudio

> **Upstream references:** [intent] [bvb]

## Overall Verdict: FEASIBLE with known constraints

Estudio's four-module MVP is technically feasible within the academic semester constraint. The primary risk is operational complexity — Kubernetes is the team's newest technical area — not technical impossibility. No unsolvable blockers exist.

---

## Technical Feasibility by Module

### Module 1 — Image Ingestion & AI Categorization
**Verdict: FEASIBLE**

- Receive uploaded image → validate format → call Claude vision API → store categorized critique.
- Claude Sonnet with vision capability can categorize art critique by diagnostic category (composition, anatomy, color, perspective, line quality). Confirmed: Claude API selected as the vision provider. [Q3]
- **Constraint:** API call costs ~$0.02/image at current pricing (introductory rate until August 31, 2026). Developer needs an Anthropic API key with balance for development and testing.
- **Risk:** If the API consistently fails to categorize certain image types (out-of-domain content, very small images, abstract work), the low-confidence fallback path must be implemented and tested before launch.

### Module 2 — History Storage & Trend Detection
**Verdict: FEASIBLE**

- Store structured feedback per user per category over time.
- Calculate trend per category (improving / stagnating / worsening) once ≥4 uploads exist for that user (configurable default).
- All logic is standard data processing — no novel technical risk.
- **Constraint:** The trend calculation algorithm quality is entirely dependent on categorization consistency from Module 1. If Module 1 produces noisy categories, Module 2 produces noisy trends.

### Module 3 — Accounts & Subscription (Free vs. Paid Tiers)
**Verdict: FEASIBLE (with mock payments)**

- User registration, login, tier enforcement (upload limits for free, trend access for paid).
- Payments are mocked — no real payment provider integration in this scope. Tier system is real; the payment step is stubbed. [intent]
- **Constraint:** The subscription boundary (what's free vs. paid) must be clearly enforced at the API layer, not just the UI, to prevent unauthorized access to trend data.

### Module 4 — Trust & Data Policy
**Verdict: FEASIBLE**

- Onboarding screen with explicit "complement, not replacement" positioning.
- Visible data policy (no training without consent).
- Self-service history deletion endpoint.
- Standard CRUD — no technical complexity.

---

## Infrastructure Feasibility

**Target environment:** Local Kubernetes cluster (minikube, kind, or k3s). No cloud provider. No infrastructure budget. [Q1][Q2]

**Feasibility:** The four modules are independently deployable services well-suited to a local K8s cluster. The semester curriculum (modules 4–5: basic K8s; module 6: CKAD workloads; module 7: CKS security; module 8: production GitOps) maps directly onto the build sequence.

**Key constraint:** Local clusters have resource limits (RAM, CPU). With 4 services + a database running concurrently, a development machine needs at minimum 8GB RAM allocated to the cluster. This is a setup constraint, not a design constraint.

**Skill gap acknowledged:** Kubernetes deployment and operations is the team's newest technical area. [Q5] This is the highest skill-risk component and should be the first thing built (walking skeleton) to surface operational surprises early.

---

## Assumptions & Open Questions

- The Claude API can reliably categorize art critique by diagnostic category at >85% consistency. This assumption must be validated against a test dataset before committing the freemium model. [assumption]
- Local K8s environment has sufficient resources (≥8GB RAM for the cluster). [assumption]
- Developer has or can obtain an Anthropic API key for development. The cost budget for development testing is undefined — this should be clarified before module 4 starts. [assumption]
- The MVP does not require persistent data between local cluster restarts (or a persistent volume strategy is in scope). [assumption]
