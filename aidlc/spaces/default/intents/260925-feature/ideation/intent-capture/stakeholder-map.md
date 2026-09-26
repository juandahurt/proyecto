# Stakeholder Map — Estudio

## Key Stakeholders

| Stakeholder | Role | Authority Level | Primary Interest | Source |
|---|---|---|---|---|
| Juan Hurtado | Developer / Student / Solo PM | **Decision maker** — final authority on scope, priorities, and design | Delivering a functional, deployable MVP by module 8; academic demonstration at session 16 | [Q6] |
| Course Instructor | Academic reviewer | **Evaluator** — approves or grades against academic criteria; does not own product decisions | Technical rigor, Kubernetes deployment correctness, appropriate AI use, professional documentation | [Q6] |
| Ana (ICP — synthetic) | Primary end user | **No decision power** — but holds the adoption veto through her practice community | Accurate, honest trend measurement; data privacy; not being stigmatized by her community for using an AI tool | [Q2] |
| Ana's practice community | Trust veto holder | **Indirect veto** — stigmatization by the community causes user abandonment regardless of product quality | Clarity that the product complements, not replaces, human critique; no perception of AI art-theft or deception | [desc] |

## Decision-Makers vs. Influencers

**Decision-makers (binding authority):**
- **Juan Hurtado** — sole authority on scope, feature prioritization, architectural choices, and delivery sequence. [Q6]
- **Course Instructor** — binding authority on academic criteria and grading outcomes. Does not determine product features but can create constraints (e.g., specific Kubernetes configurations required by the course). [Q6]

**Influencers (no binding authority, but shape adoption):**
- **Ana's practice community** — exercises the trust veto. A negative community signal (e.g., "this is just another AI art scraper") can prevent adoption before the product is evaluated on its merits. [desc]
- **Competitive landscape (Coartist, ArtKritic, etc.)** — not stakeholders but market signals that influence scope prioritization and urgency. [desc]

## Communication Requirements

| Communication | Audience | Format | Timing | Source |
|---|---|---|---|---|
| MVP build progress | Juan Hurtado (self) | Internal development tracking | Ongoing through modules 4–8 | [Q6] |
| Academic deliverable: deployed MVP | Course Instructor | Live demonstration on Kubernetes cluster | Module 8 deployment | [Q4][Q6] |
| Full product demonstration with trend data | Course Instructor + audience | Session 16 presentation — running system with real accumulated data | Session 16 (end of course) | [Q4][Q6] |
| Post-MVP user validation | Real users (Ana archetype) | Qualitative interviews or usage observations | Post-MVP, after first real users onboard | [Q3][desc] |

## Assumptions & Open Questions

- Ana is a synthetic persona; no real end users have been identified or interviewed yet. All of Ana's stated interests and pain points are research-derived projections. [assumption]
- The course instructor's specific technical requirements for the Kubernetes demonstration are Unknown (open question) [assumption] — these may create late constraints on infrastructure design.
- No formal reporting cadence to any external stakeholder is required during development. [Q6]
