# Constraint Register — Estudio

> **Upstream references:** [intent] [bvb]

## Infrastructure Constraints

| ID | Constraint | Type | Impact | Source |
|---|---|---|---|---|
| INF-01 | Deployment target is a local Kubernetes cluster (minikube/kind/k3s) — no cloud provider, no managed services | Hard | No cloud-native managed services (no RDS, no S3, no ALB) — all storage and networking must be configured as K8s primitives | [Q1][Q2] |
| INF-02 | No cloud infrastructure budget | Hard | All infrastructure components must run locally. External services (Claude API) are the only paid dependency | [Q2] |
| INF-03 | Development machine must support ≥8GB RAM allocated to local cluster | Soft | Must validate before module 4; if machine is underpowered, reduce service count or use lightweight distro (k3s preferred) | [Q1] |

## API & External Service Constraints

| ID | Constraint | Type | Impact | Source |
|---|---|---|---|---|
| API-01 | AI vision analysis uses Anthropic Claude API — external dependency, not self-hosted | Hard | Availability, latency, and pricing are outside the team's control | [Q3] |
| API-02 | Claude introductory API pricing (~$0.02/image) expires August 31, 2026 — price may increase ~50% | Hard | Must recalculate freemium economics before finalizing tier limits if launch extends past August 2026 | [bvb] |
| API-03 | Developer API key with spending budget required for development and testing | Hard | Without a funded API key, Module 1 cannot be tested end-to-end | [Q3][Q2] |
| API-04 | Payments are mocked in the MVP — no real payment provider integration | Hard (scope) | The free/paid tier boundary is enforced in code; the payment step is a stub. No real revenue in the MVP | [intent] |

## Team & Capacity Constraints

| ID | Constraint | Type | Impact | Source |
|---|---|---|---|---|
| TEAM-01 | Solo developer — no parallel execution possible | Hard | All four modules are built sequentially by one person | [Q7] |
| TEAM-02 | Kubernetes operations is the team's newest technical area | Soft | K8s deployment issues may create schedule risk in modules 4–5; mitigate by starting with the walking skeleton | [Q5] |
| TEAM-03 | Semester deadline — MVP must be demonstrable by session 16 | Hard | No feature additions permitted that threaten the session 16 delivery date | [intent] |

## Product & Design Constraints (Non-Negotiable Principles)

| ID | Constraint | Type | Impact | Source |
|---|---|---|---|---|
| PROD-01 | User images must NOT be used to train or fine-tune models without explicit separate consent | Hard | No training pipeline may reference user-uploaded images by default | [intent] |
| PROD-02 | Free tier limits quantity of uploads, never quality of categorization model | Hard | The same Claude model must serve both free and paid tiers | [intent] |
| PROD-03 | AI never acts autonomously on user content — paradigm is Assistant, not Agent | Hard | No automated modification, deletion, or republication of user images or critiques | [intent] |
| PROD-04 | Onboarding must include explicit "complement, not replacement" acknowledgment before first upload | Hard | A single explicit tap/click confirmation is required in the onboarding flow | [intent] |

## Compliance Constraints

| ID | Constraint | Type | Impact | Source |
|---|---|---|---|---|
| COMP-01 | No formal regulatory certification required (GDPR, HIPAA, PCI) — academic MVP | Hard (scoping) | Compliance posture is design-principle-based, not certification-based | [Q4] |
| COMP-02 | Self-service data deletion must be available to users | Hard (design) | Users must be able to delete their upload history at any time; the deletion must cascade to stored images and critiques | [intent] |

## Assumptions & Open Questions

- Local K8s persistent volume strategy (data persistence between restarts) is not yet defined. [assumption]
- PROD-02 (same model for free and paid) is unverified — Claude API does not distinguish callers by tier. The tier enforcement is entirely the application's responsibility. [assumption]
