# Initiative Brief — Estudio

**Phase:** IDEATION complete → ready for INCEPTION
**Date:** September 25, 2026

---

## What Estudio Is

A web platform that gives AI-powered technical critique on drawings and paintings, and measures whether that critique translates into real improvement over time — by accumulating, categorizing, and connecting feedback across successive uploads for each user.

**Core differentiation:** "The only app that tells you whether your mistakes are a real recurring pattern or a one-off comment."

---

## Problem Solved

Self-taught artists who practice regularly receive critique (from AI tools, communities, structured courses) but no system connects those critiques over time. Each piece of feedback lives in isolation — the artist cannot distinguish a real pattern of weakness from a single observation. Estudio provides the missing memory layer.

The problem is not "generate a critique" (commoditized). The problem is **structured memory and pattern detection across critiques over time**.

---

## Target User

**Ana** — self-taught artist with an active practice routine (≥18 months), seeking feedback in online communities (Discord, Reddit art groups), already paying for at least one practice tool. Skeptical of AI in art but open to using it as a complement while waiting for human critique. Not a professional artist. Not a hobbyist. An active learner.

---

## What Gets Built (Must Have Scope)

13 proto-units across 4 modules:

| Module | Capabilities |
|---|---|
| M1 — Image Ingestion & Analysis | Upload + validation (U1); Claude vision API + categorized critique (U2); low-confidence fallback (U3); critique storage (U4) |
| M2 — History & Trends | Structured history by category (U5); trend calculation ≥4 uploads (U6); trend API with tier enforcement (U7) |
| M3 — Accounts & Subscription | Authentication (U8); free tier limits (U9); mock payment + upgrade flow (U10) |
| M4 — Trust & Data | Onboarding gate (U11); data policy display (U12); self-service history deletion (U13) |

**Should Have (deferred):** Trend teaser for free users (U14), upload context confirmation (U15). Deferred due to ~50h total capacity constraint.

---

## What Is Explicitly Out of Scope

- Real payment provider integration (mocked in MVP)
- Social / community sharing features
- AI art generation
- Self-hosted AI vision model
- Real-time human support channel
- Mobile-first design (desktop web, then responsive if time allows)

---

## Technical Foundation

| Decision | Value |
|---|---|
| Stack | Node.js / TypeScript (backend) + React (frontend) |
| Deployment | Local Kubernetes cluster (minikube / kind / k3s) |
| AI Vision | Anthropic Claude API (Sonnet with vision, ~$0.02/image) |
| Payments | Mocked stub — no real provider in MVP |
| Trend threshold | 4 uploads minimum, configurable parameter |
| Interface language | English |

---

## Team & Capacity

- **Developer:** Juan Hurtado (solo — all roles)
- **Capacity:** ~5 h/week → ~50 h total across modules 4–8
- **Skill risk:** Kubernetes operations (newest area; mitigated by course progression)
- **No external support** available

---

## Definition of Done — Session 16

The initiative is demonstrably delivered when: **the full end-to-end flow runs on the local Kubernetes cluster — upload → AI categorized critique → trend visible for a paid user.**

Concrete: Ana uploads a drawing, receives a categorized critique, and the Dashboard shows her a trend (improved / stagnant / worsening) for at least one category based on at least 4 prior uploads.

---

## Risks to Watch

| Risk | Priority | Current Status |
|---|---|---|
| Categorization consistency (R-01) | CRITICAL | Unvalidated — requires test dataset before freemium launch |
| K8s operational complexity | HIGH | Mitigated by course structure; start with skeleton in module 4 |
| Claude API pricing increase (Aug 31, 2026) | HIGH | Confirmed — recalculate economics before pricing decision |
| Coartist feature convergence | MEDIUM | Execution race — deliver before they invest further |
| Capacity: 5h/week may not hold | HIGH | No buffer; Should Have items already deferred |

---

## INCEPTION Entry Criteria

All IDEATION artifacts approved. No open blockers. Ready to begin:
1. Requirements Analysis — define the full functional requirements and acceptance criteria for all 13 Must Have units
2. User Stories — write INVEST stories from Ana's perspective
3. Domain Design — define the component model and bounded contexts
4. Units Generation — convert proto-units into buildable work units
5. Delivery Planning — sequence the units into the course module timeline

---

## Assumptions Carried Forward to INCEPTION

- Category taxonomy (composition, proportions, line quality, color, etc.) is not yet defined — **highest priority open decision for Requirements Analysis**
- Free tier upload limit per period is not yet defined
- Trend calculation algorithm is not yet specified
- TypeScript proficiency level is assumed adequate; if not, minor schedule impact
- Local K8s resource requirements are untested on the developer's machine
