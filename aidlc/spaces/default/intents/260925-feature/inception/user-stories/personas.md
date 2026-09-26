# Personas — Estudio MVP

> **Upstream references:** intent-statement.md, scope-document.md

## Primary Persona: Ana

**Name:** Ana (representative name for the ICP)
**Role in system:** End user — primary actor in all 13 user stories
**Age:** ~24 years old (representative)

### Goals
1. Confirm whether her drawing practice is producing real improvement, not just accumulation of hours
2. Get structured feedback on specific technical areas rather than generic AI commentary
3. Maintain control over her personal data (drawings are her work)

### Pain Points
1. Each critique she receives — from AI tools, Discord communities, course feedback — lives in isolation; she cannot see if the same issue is a recurring pattern
2. "Each time they tell me something different" — no memory across sessions
3. She's skeptical of AI in art but willing to use it as a complement while waiting for human critique

### Technical Profile
- Uses web browser on desktop for most creative work
- Already pays for at least one practice tool (Skillshare, Domestika, or similar)
- Comfortable with basic web apps; no developer background

### Trust Sensitivity
The trust veto is held by Ana's practice community (Discord server, critique group), not Ana alone. She may privately like the product but avoid using it if her community stigmatizes AI tools. The "complement, not replacement" onboarding is the primary mitigation.

### What Ana is NOT
- A professional artist seeking art direction feedback
- Someone who draws occasionally without seeking measurable improvement
- Someone looking to generate AI art

---

## Out-of-Scope Personas (Not Supported in MVP)

| Persona | Reason out of scope |
|---|---|
| Operator / DevOps admin | No operator-facing UI in MVP. Operations are managed via K8s cluster directly. |
| Community moderator | No community features in scope. |
| Course instructor | No instructor-facing features. Course completion verified in-person at session 16. |
