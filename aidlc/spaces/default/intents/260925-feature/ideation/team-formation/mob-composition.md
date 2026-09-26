# Mob Composition — Estudio

> **Upstream references:** [scope] [feas]

## Team Topology: Solo Developer

This project has a team of one. Mob programming, pair programming, and any multi-person topology are not applicable. [Q4]

| Role | Owner | Notes |
|---|---|---|
| Product Manager | Juan Hurtado | Scope decisions, backlog priorities |
| Developer (full-stack) | Juan Hurtado | Backend (Node.js/TS), frontend (React), K8s deployment |
| DevOps / Platform | Juan Hurtado | K8s cluster setup, GitOps pipeline, secrets management |
| QA | Juan Hurtado | Manual testing, test suite authoring |
| Designer | Juan Hurtado | UI design (MVP level — functional, not polished) |

## AI-DLC as a Force Multiplier

Since there is no team to review, debate, or catch blind spots, the AI-DLC workflow's built-in review mechanisms are the primary quality layer:
- Each stage has a reviewer sub-agent that independently checks artifacts before approval.
- The structured Q&A at each stage forces explicit decisions rather than implicit assumptions.
- The learnings ritual captures deviations and tradeoffs so they are not forgotten between sessions.

## Work Style Recommendation

Given the 5 h/week constraint and no external support:
- Work in time-boxed sessions of 2–3 hours rather than scattered 30-minute windows.
- Complete one proto-unit per session where possible (most units are sized at ~4h).
- Commit working code to the local K8s cluster at the end of each session — never leave a unit half-deployed.

## Assumptions & Open Questions

- None — the team composition is unambiguous and confirmed. [assumption]
