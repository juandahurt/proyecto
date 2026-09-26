# RAID Log — Estudio

> **Upstream references:** [intent] [bvb]
> **Legend:** Probability: H=High M=Medium L=Low | Impact: H=High M=Medium L=Low

---

## Risks

| ID | Risk | Probability | Impact | Priority | Mitigation |
|---|---|---|---|---|---|
| R-01 | **Categorization inconsistency** — AI produces different categories for similar images, making the trend history unreliable noise | M | H | **CRITICAL** [Q6] | Validate against a manual test dataset (50–100 labeled images) before committing to the freemium model; define and enforce a >85% consistency threshold; implement low-confidence fallback path |
| R-02 | **Claude API pricing increase** — introductory rate expires August 31, 2026; costs may rise ~50% | H (confirmed) | M | HIGH | Recalculate tier economics before pricing decision; build cost-monitoring into the system from day 1 |
| R-03 | **External API dependency failure** — Claude API outage or deprecation disrupts the core product | M | H | HIGH | Abstract the vision API call behind a service interface so the provider can be swapped; monitor API availability; implement clear user-facing error for low-confidence or failed analyses |
| R-04 | **K8s operational complexity exceeds team skill** — deployment and networking issues consume more time than planned | M | M | MEDIUM [Q5] | Start with the walking skeleton (thin end-to-end slice) in module 4 to surface K8s issues early; use k3s (lightest footprint) for local development |
| R-05 | **Coartist adds per-category trend tracking** before Estudio has accumulated enough user data to differentiate | M | H | MEDIUM | Execute on the semester deadline; the differentiation is data accumulation, not technology — first-mover advantage matters |
| R-06 | **Anti-AI community backlash** — users abandon or hide usage due to community stigma | M | H | MEDIUM | Enforce "complement, not replacement" positioning in the product itself (onboarding gate, no language implying AI superiority over human critique) |
| R-07 | **Developer API key costs exceed informal budget** during development and testing | L | M | LOW | Estimate testing call volume before building; use a low-resolution test image set to minimize tokens; set a spending cap on the API key |
| R-08 | **Local K8s resource exhaustion** — development machine can't run all 4 services concurrently | L | M | LOW | Profile resource requirements before module 4; fall back to k3s or reduce replica count if needed |
| R-09 | **Free-to-paid conversion rate far below projection** | M | H | MEDIUM (post-MVP) | Monitor from day 1; the 5% target is unvalidated [INTERNO]; have a pricing/trigger adjustment plan ready |
| R-10 | **Drawabox stance on third-party AI tools** — if Drawabox officially discourages the tool, the primary adoption community is lost | L | H | LOW (unverifiable now) | Do not build Drawabox integration in the MVP; position as community-agnostic supplement |

---

## Assumptions

| ID | Assumption | Owner | Validation Method | Status |
|---|---|---|---|---|
| A-01 | Claude Sonnet with vision can categorize art critique by diagnostic category at >85% consistency on drawings of varied quality | Juan Hurtado | Manual test set of 50–100 labeled images before module 6 | Unvalidated |
| A-02 | 4 uploads is a sufficient threshold to detect a meaningful trend (not pure noise) | Juan Hurtado | Empirical: measure trend confidence at 4 vs. 8 vs. 12 uploads with early test data | Unvalidated |
| A-03 | "Ana" (ICP) actually exists — self-taught artists with structured practice and community critique-seeking behavior are a real addressable segment | Juan Hurtado | Post-MVP user research with real users | Unvalidated (synthetic persona) |
| A-04 | Local K8s cluster (minikube/kind/k3s) is sufficient to demonstrate production-readiness for the course evaluation | Juan Hurtado | Confirm with instructor requirements before module 4 | Unvalidated |
| A-05 | The developer can fund Claude API usage for development and testing from personal budget | Juan Hurtado | Estimate token costs for test suite before module 4 starts | Unvalidated |
| A-06 | A mocked payment system is acceptable for the course demonstration at session 16 | Juan Hurtado | Confirm with instructor before module 6 | Unvalidated |

---

## Issues

| ID | Issue | Severity | Status | Action |
|---|---|---|---|---|
| I-01 | Instructor's specific K8s requirements for session 16 are unknown — may create late design constraints | Medium | Open | Clarify with instructor before module 4 starts |
| I-02 | Drawabox's official position on third-party AI tools is unverified — adoption risk for the primary target community | Medium | Open | Monitor; do not count on Drawabox community as a launch channel |
| I-03 | Developer API key spending budget for development/testing is undefined | Medium | Open | Estimate before module 4 |

---

## Dependencies

| ID | Dependency | Type | Owner | Risk if Unavailable |
|---|---|---|---|---|
| D-01 | Anthropic Claude API (vision capability) | External | Anthropic | Entire Module 1 is blocked; no alternative in scope |
| D-02 | Local K8s runtime (minikube / kind / k3s) | Infrastructure | Juan Hurtado | Cannot deploy or test any module |
| D-03 | Course K8s modules 4–8 | Academic | Instructor | Build sequence is aligned to course progression; external block would affect timing |

---

## Assumptions & Open Questions

- None additional beyond those listed in the Assumptions section above.
