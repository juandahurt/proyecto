# Team Assessment — Estudio

> **Upstream references:** [scope] [backlog] [feas]

## Team Composition

| Role | Person | Capacity | Status |
|---|---|---|---|
| Developer / PM / Designer / DevOps | Juan Hurtado | ~5 h/week | Solo — all roles |

This is a solo student project. There is no team to form — one person covers every role. [Q3] [Q4]

---

## Capacity Analysis

**Available capacity:** ~5 hours/week across modules 4–8. [Q3]

**Estimated timeline:** Modules 4–8 span approximately 10–12 weeks → **~50–60 total hours** for the entire MVP build.

**Must Have scope:** 13 proto-units (U1–U13). [backlog]

**Rough per-unit budget:** ~4 hours per proto-unit. This is tight, particularly for:
- U2 (Claude API integration + categorization) — first integration with external AI API; may require more debugging time
- U6 (trend calculation) — algorithm design + validation against test data
- K8s deployment configuration — new skill area (TEAM-02 from constraint-register)

**Verdict: HIGH CAPACITY RISK.** The Should Have items (U14 teaser, U15 context selection) are effectively out of scope given this capacity constraint. The priority is delivering the 13 Must Have units cleanly within the semester deadline.

---

## Risk Assessment

| Risk | Impact on Delivery | Mitigation |
|---|---|---|
| ~4h/unit budget may not hold for K8s-heavy units | Schedule slip on modules 4–5 cascades into everything | Start with the infrastructure skeleton first; surface K8s issues before building business logic |
| No external support for debugging (Q4=D) | Blocking issues could consume entire weekly budget | Budget explicit "stuck time" as part of each unit; use community forums as async fallback |
| Solo developer covers all roles | No peer review; blind spots in any single role go unchecked | The AI-DLC workflow's review stages compensate for lack of human peer review |
| K8s is the newest technical area (TEAM-02) | Risk of underestimating deployment complexity | Complete K8s lab exercises from course before attempting production service deployment |

---

## Should Have Scope Adjustment

Given ~50h total capacity, the two Should Have units (U14: trend teaser, U15: upload context) are formally deferred. If any Must Have unit comes in under budget, the priority order for using surplus time is:

1. U15 (upload context) — reduces R-01 (categorization consistency risk)
2. U14 (teaser) — improves conversion trigger

**No new scope is added** — this is a deferral from Should Have, not a change to Must Have.

---

## Assumptions & Open Questions

- ~5 h/week is an honest estimate, not a best-case estimate. If actual capacity is higher, the Should Have items may become feasible. [assumption]
- The K8s course modules (4–8) provide structured learning for the deployment area — the course itself is the onboarding for the skill gap. [assumption]
- No peer review is available, but the AI-DLC workflow's review stages (reviewer sub-agents at each gate) serve as a substitute quality layer. [assumption]
