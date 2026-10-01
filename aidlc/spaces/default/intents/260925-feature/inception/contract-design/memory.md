<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-26T14:45:00Z — ProgressService → IngestionService boundary treated as a schema dependency (cross-schema read, read-only user) rather than an HTTP contract; this matches the Domain Design decision and means no C1-style OpenAPI spec is needed for that edge — only a shared-schema block that pins the columns ProgressService may read.
- 2026-09-26T14:45:00Z — Internal service-to-service calls (tier status, deletion cascade) use network-trusted calls without auth tokens; framed as K8s namespace security boundary being the perimeter. This is the simplest approach for a local K8s MVP with a single developer.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-26T14:45:00Z — Defined 10 contracts: 4 Frontend→Backend user-facing APIs, 4 service-to-service internal APIs, 1 shared-schema dependency, and 1 external (Claude API). Chose to write individual OpenAPI snippets per service rather than one consolidated spec; easier for a solo dev to match each file to the unit it implements.
- 2026-09-26T14:45:00Z — Claude Vision API contract (C10) specifies only the response schema and error behavior, not the full prompt text; prompt engineering belongs in Code Generation / Functional Design. This keeps the contract testable (the contract test validates schema shape) without over-specifying behavior that may need iteration.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
