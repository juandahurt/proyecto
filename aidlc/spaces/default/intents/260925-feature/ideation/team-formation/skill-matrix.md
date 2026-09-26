# Skill Matrix — Estudio

> **Upstream references:** [feas] [backlog]

## Team Member: Juan Hurtado

| Skill Area | Proficiency | Notes | Risk |
|---|---|---|---|
| Backend REST API | Some experience | Node.js / TypeScript confirmed stack [Q2]; not expert-level but workable foundation [Q1] | Medium — Node.js/TS adds type safety; TypeScript learning curve if not already familiar |
| Frontend web | Some experience | React or similar [Q2]; some web knowledge [Q1] | Medium — MVP frontend is basic (upload form, history view, trend display); complexity is manageable |
| Database (relational/document) | Some experience | Some knowledge [Q1]; exact DB choice TBD in architecture | Low — standard CRUD; the ORM / schema design is the main risk, not the DB operation itself |
| External API integration | Unknown / New | First integration with a vision AI API (Claude); no prior experience stated | Medium-High — prompt engineering for consistent categorization is non-trivial; validation against test dataset required |
| Kubernetes (deployment, networking) | New | Explicitly flagged as the newest skill area [Q1][feas]; course modules 4–8 provide structured onboarding | HIGH — highest skill-risk component; start early, surface issues in modules 4–5 |
| DevOps / CI-CD / GitOps | New | Course module 8 covers this; no prior experience assumed | Medium — GitOps pipeline is a module 8 deliverable; the course provides the learning path |
| AI Prompt Engineering | Unknown | Required for consistent categorization in U2; not a standard skill listed in Q1 | Medium-High — a poorly engineered prompt is R-01 (categorization inconsistency) in practice |

## Critical Skill Gap: Kubernetes Operations

The single highest-risk skill is Kubernetes deployment and operations. Mitigations: [feas]
- The course itself (modules 4–8) is the structured onboarding for this skill.
- Use k3s (lightest local K8s runtime) to minimize operational overhead.
- Build the walking skeleton first — a single-service K8s deployment — before adding all 13 proto-units.

## Critical Skill Gap: AI Prompt Engineering for Consistent Categorization

The value of the entire product depends on consistent, reproducible categorization. This requires disciplined prompt design that the standard backend engineering skill set does not automatically provide. Mitigations:
- Define the category taxonomy before building U2 (Requirements Analysis stage).
- Validate prompt output against 50–100 manually labeled test images before committing the freemium model.
- Treat categorization consistency as a first-class quality metric from day 1.

## Assumptions & Open Questions

- TypeScript proficiency (vs. JavaScript-only) has not been confirmed. If Juan is JavaScript-only, the TypeScript learning curve adds minor time to all backend units. [assumption]
- React proficiency level is unknown; the MVP frontend is simple enough that minimal React is sufficient. [assumption]
