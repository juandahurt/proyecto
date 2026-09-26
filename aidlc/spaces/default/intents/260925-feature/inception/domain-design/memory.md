<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-26T00:15:00Z — [Interpretation] Q1=A (4 independent services) was accepted even though this increases complexity for a solo developer. The rationale: the K8s course curriculum explicitly requires multi-service deployments; a monolith would undermine the academic value of the project.
- 2026-09-26T00:15:00Z — [Deviation] The ProgressService cross-schema read (ADR-004 exception) violates strict bounded context isolation. Documented as a conscious deviation with a migration path: if isolation becomes necessary, replace the cross-schema read with an internal API call between services without changing the domain model.
- 2026-09-26T00:15:00Z — [Tradeoff] Single PostgreSQL instance (ADR-004) chosen over 4 separate instances for solo developer simplicity. The schema-level isolation preserves the conceptual bounded context boundaries even if it doesn't enforce them at the infrastructure level.
- 2026-09-26T00:15:00Z — [Open question] The TrustService deletion cascade (cross-context operation) is fragile — if IngestionService's delete call fails partway through, the deletion is incomplete. A formal saga/orchestrator would handle this correctly. Deferred for MVP; flag for NFR Design if eventual consistency is a concern.
