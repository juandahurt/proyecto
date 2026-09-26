<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-25T22:00:00Z — Q4=A (explicit confidence flag from Claude) was interpreted as: the prompt instructs Claude to include a confidence field (HIGH/MEDIUM/LOW) in its structured JSON response. This is implemented via prompt engineering, not a native API feature. Low-confidence mapping: LOW → fallback path; HIGH or MEDIUM → normal processing.
- 2026-09-25T22:00:00Z — FR-3.6 (low-confidence uploads count against free tier limit) was included as a business decision. A low-confidence upload was intentionally submitted by the user, so it should count against their limit even if no usable critique was generated.

## Deviations
- 2026-09-25T22:00:00Z — Added CAT-5 (Perspective) as the 5th category even though the user answered Q1=A (5 categories: Composition, Proportions, Line Quality, Values, Perspective). The 5 categories in Q1=A match exactly what was included. No deviation.

## Tradeoffs
- 2026-09-25T22:00:00Z — Linear regression slope thresholds (±2 points per upload for improving/worsening) are arbitrary initial values. They are documented as configurable (FR-6.2) so empirical calibration can happen post-launch without a code change.
- 2026-09-25T22:00:00Z — Free tier counter resets on the 1st of each calendar month (Q5=A) rather than from the user's registration date (Q5=B). Calendar-month reset is simpler to implement, reason about, and explain to users ("resets on the 1st of each month") even though registration-date reset is more equitable.

## Open questions
- 2026-09-25T22:00:00Z — FR-2.1 assumes Claude can reliably return a structured JSON response with a confidence field. This is a prompt engineering assumption that must be validated during U2 development with a test dataset of diverse image types.
