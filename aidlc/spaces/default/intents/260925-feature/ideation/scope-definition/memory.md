<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-25T21:00:00Z — Q3=B elevated "self-service history deletion" from Should Have to Must Have. Interpreted this as: a data policy that doesn't include an actionable deletion path is a trust violation, not just a missing feature. Applied immediately in scope-document.md (MH-13) and intent-backlog.md (U13).
- 2026-09-25T21:00:00Z — Q4=B (granularity by capability) was interpreted as: define 13 proto-units at the functional capability level, not at the implementation task level. Module 3 (accounts) was not further sub-divided because auth + limits + payment are small enough to remain atomic.

## Deviations
- 2026-09-25T21:00:00Z — Added U15 (upload context) to the backlog as a Should Have even though the user only selected U14 (teaser) as the priority Should Have. Rationale: Q&A explicitly mentioned context selection as a Should Have item (SH-2); not including it would silently drop an item the user had reviewed and not rejected.

## Tradeoffs
- 2026-09-25T21:00:00Z — Kept partial deletion (delete specific uploads) as "Not Supported" in the MVP for U13. A full account deletion is much simpler to implement and reason about than per-record deletion; adding per-record deletion creates cascade complexity without adding proportional trust value in the MVP.

## Open questions
- 2026-09-25T21:00:00Z — Category taxonomy for U2 (composition, anatomy, color, etc.) is not yet defined. This is the most impactful open decision — the whole trend calculation depends on a stable, consistent category set. Flag for Requirements Analysis.
