# Intent Statement — Estudio

## Problem Statement

Self-taught artists who practice regularly receive critique — from AI tools, community peers, or structured course feedback — but no system connects those critiques over time. Each piece of feedback lives in isolation: the artist has no way to determine whether a recurring observation is a real pattern of weakness or a one-off comment. The problem is not the quality of any individual critique (that is already commoditized by the market) but the absence of structured memory across critiques that would reveal whether a category of error is improving, stagnating, or worsening. [Q1]

## Target Customer

**Primary persona: Ana** — self-taught artist, approximately 24 years old, practicing with a structured routine for at least 18 months (structured course, daily/weekly drawing challenge, or self-designed fundamentals plan). She actively seeks external feedback by publishing her work in online communities (Discord servers, r/ArtCrit, r/drawing). She already invests money in her practice (paid subscriptions, courses). She is skeptical of AI in art but open to using it as a complement while waiting for human critique — not as a replacement. [Q2]

**Disqualifying signals (not the target user):**
- Draws occasionally without seeking measurable improvement [Q2]
- Professional artist seeking art direction feedback (not fundamentals) [Q2]
- Someone who wants to generate art with AI [Q2]

**Community veto:** The trust veto is exercised by Ana's practice community (her Discord server, critique group, course peers), not a corporate role. A user may love the product privately but abandon it — or hide that she uses it — if her community stigmatizes it. This is the primary adoption risk, not product quality. [desc]

## Success Metrics

All metrics below are internal projections pending empirical validation with real users. They are design hypotheses, not committed targets. [Q3]

| Metric | Proposed Target | Status |
|---|---|---|
| **North Star:** Active uploads with visible trend history per paying user/month | — | [INTERNO] |
| Upload frequency sustained | ≥3 uploads/month for 2 consecutive months | [INTERNO] |
| Free-to-paid conversion rate | >5% by month 3 | [INTERNO] |
| Categorization consistency | >85% (manually validated sample) | [INTERNO] |
| User agreement with detected trend | >70% | [INTERNO] |
| Critique ignore rate (failure metric) | To be defined — % of generated critiques never opened within N days | [INTERNO] |

## Initiative Trigger

The primary trigger is an **academic semester constraint**: the MVP must be designed, built, and demonstrated running on Kubernetes before module 8 of the course. [Q4]

Supporting context factors (not primary drivers):
- The window for differentiating on "structuring critique over time" is open but closing — Coartist is already moving in this direction. [desc]
- AI vision inference costs dropped to viable freemium territory (~$0.02/analysis with current API pricing). [desc]

The academic deadline is the forcing function. The product must be demonstrably functional — with real accumulated trend data — by the session 16 presentation. [Q4]

## Initial Scope Signal

**Workflow-selected scope:** `feature` — 32 stages, Standard depth, 29 approval gates. [scope]

**User-confirmed product boundary:** An MVP with four functional modules: [Q7]
1. Image ingestion and categorized analysis
2. History storage and trend detection by category
3. Accounts and subscription management (freemium model)
4. Trust and data policy (onboarding, consent, data deletion)

**TBD items resolved for this specification:** [Q8][Q9][Q10]
- **Geography:** No explicit geographic targeting. MVP interface in English.
- **Payments:** Mocked in the MVP. No integration with a real payment provider is in scope. The subscription model and freemium limits are designed around a stub implementation.
- **Trend threshold:** 4 uploads is the configurable default — the system exposes this as a runtime parameter rather than a hardcoded constant, starting with 4.

**Workflow constraint:** Code generation stages are excluded from this workflow. The workflow stops after completing the task plan for each unit (Delivery Planning stage). [desc]

## Assumptions & Open Questions

- "Ana" is a synthetic buyer persona derived from secondary research. No primary user interviews have been conducted. All behavioral claims about Ana are unvalidated. [assumption]
- All success metrics are internal projections with no data baseline. The targets in the Success Metrics table require empirical validation against real users. [assumption]
- Coartist's current feature depth and roadmap velocity are unconfirmed — the competitive gap may close faster than expected. [assumption]
- API pricing increase (~50%) is expected September 1, 2026, affecting the cost model projected in the PRD. [assumption]
- Drawabox's stance on third-party AI tools is unconfirmed — potential risk to the primary community channel. [assumption]
