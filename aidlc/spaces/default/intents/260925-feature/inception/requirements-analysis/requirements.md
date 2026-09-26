# Requirements — Estudio MVP

> **Upstream references:** scope-document.md, intent-backlog.md, decision-log.md, constraint-register.md
> **Depth:** Standard | **Test strategy:** Standard (80% line, 75% branch on service/handlers)

---

## Diagnostic Category Taxonomy (Cross-cutting)

All requirements referencing "categories" or "categorization" use this fixed set of 5 diagnostic categories: [Q1]

| ID | Category | Description |
|---|---|---|
| CAT-1 | Composition | Balance, focal point, rule of thirds, negative space, visual weight |
| CAT-2 | Proportions | Relative sizes between elements, head-to-body ratio, foreshortening |
| CAT-3 | Line Quality | Stroke confidence, consistency, chicken scratch vs. committed lines, contour control |
| CAT-4 | Values (Shading) | Light/shadow logic, value range, contrast, form following light |
| CAT-5 | Perspective | Vanishing points, horizon line, ellipses in perspective, overlapping |

The category set is fixed for the MVP. It cannot be extended dynamically by the AI in a single response. Every uploaded image receives a score (0-100) and textual feedback for each of the 5 categories. If a category is not clearly present in the image (e.g., no perspective elements in a flat portrait sketch), the AI must still provide an assessment — it may note low relevance but must not omit the category.

---

## Functional Requirements

### FR-1 — Image Upload (U1)

**The system shall accept image uploads from authenticated users.**

| # | Requirement | Priority |
|---|---|---|
| FR-1.1 | Accept JPEG, PNG, and WebP formats only. Reject all other MIME types with a clear error message. | Must |
| FR-1.2 | Enforce a maximum file size of 10 MB. Reject oversized files with a clear error message. | Must |
| FR-1.3 | Validate the image file's magic number (first bytes) server-side to confirm it is a real image, not a renamed file. | Must |
| FR-1.4 | Generate the storage filename server-side using a UUID or equivalent. Never use the user-supplied original filename for storage. | Must |
| FR-1.5 | Only authenticated users (valid session token) may upload images. Unauthenticated upload attempts return 401. | Must |

**Acceptance criteria (FR-1.3):**
```
Given: a file with a .jpg extension but PNG/PDF/binary content in its header bytes
When: the upload endpoint receives the file
Then: the system returns a 422 error with the message "Invalid image format"
And: the file is NOT stored
```

---

### FR-2 — AI Critique Generation (U2)

**The system shall call the Anthropic Claude API with the uploaded image and return a categorized critique.**

| # | Requirement | Priority |
|---|---|---|
| FR-2.1 | The Claude prompt MUST instruct the AI to return a structured JSON response containing: a score (0-100) and textual feedback (min 2 sentences) for each of the 5 categories, plus an explicit confidence field (HIGH / MEDIUM / LOW). | Must |
| FR-2.2 | Every call must include all 5 categories (CAT-1 through CAT-5) in the structured response. A response missing any category is treated as low confidence. | Must |
| FR-2.3 | Scores must be integers in the range 0-100. A score outside this range is treated as low confidence. | Must |
| FR-2.4 | The prompt must be written in English (the interface language). | Must |
| FR-2.5 | The Anthropic API key must be retrieved from a Kubernetes Secret at runtime, never from environment variables embedded in the container image. | Must |

**Acceptance criteria (FR-2.1):**
```
Given: a valid JPEG image of a figure drawing
When: the upload is processed
Then: the critique response includes a numeric score and minimum 2 sentences of feedback for each of Composition, Proportions, Line Quality, Values, and Perspective
And: the response includes a confidence field with value HIGH, MEDIUM, or LOW
```

---

### FR-3 — Low-Confidence Fallback (U3)

**The system shall detect low-confidence critique results and handle them explicitly without presenting them as normal critiques.**

| # | Requirement | Priority |
|---|---|---|
| FR-3.1 | Trigger the low-confidence fallback when the AI response's confidence field is LOW. | Must |
| FR-3.2 | Trigger the low-confidence fallback when the response schema is invalid (missing categories, malformed JSON, scores out of range). | Must |
| FR-3.3 | Trigger the low-confidence fallback when the Claude API call times out (timeout threshold: configurable, default 30 seconds). | Must |
| FR-3.4 | On fallback: display a message stating the critique could not be generated for this image, with the specific reason. Offer a retry option. | Must |
| FR-3.5 | Low-confidence uploads MUST NOT be included in trend calculations (U6). The upload record is stored but flagged as `confidence: low`. | Must |
| FR-3.6 | A low-confidence upload still counts against the free tier upload limit. | Must |

**Acceptance criteria (FR-3.5):**
```
Given: a user uploads an image that triggers low-confidence fallback
When: the system calculates the trend for any category
Then: this upload's scores are excluded from the linear regression calculation
And: the upload appears in the history list with a "Critique unavailable" label
```

---

### FR-4 — Critique Storage (U4)

**The system shall store the uploaded image, the generated critique, and per-category scores per user upload.**

| # | Requirement | Priority |
|---|---|---|
| FR-4.1 | Store per upload: image (blob), user_id, timestamp, confidence flag, and for each category: score (integer), feedback text, category_id. | Must |
| FR-4.2 | Images are private to the uploading user. No other user may access another user's images. | Must |
| FR-4.3 | Images are never used to train or fine-tune AI models without explicit separate consent from the user. | Must |
| FR-4.4 | Low-confidence uploads are stored with all fields but with `confidence: low` flag and no category scores (NULL). | Must |

---

### FR-5 — History Storage (U5)

**The system shall maintain a time-ordered history of all uploads per user, indexed by category.**

| # | Requirement | Priority |
|---|---|---|
| FR-5.1 | Store all upload records for each user, ordered by timestamp descending. | Must |
| FR-5.2 | Each record includes: upload_id, timestamp, per-category scores, confidence flag. | Must |
| FR-5.3 | History is maintained indefinitely until the user explicitly deletes it (FR-9). | Must |
| FR-5.4 | Free tier users have their full history stored; only the DISPLAY of trend data is tier-gated, not the storage. | Must |

---

### FR-6 — Trend Calculation (U6)

**The system shall calculate a trend direction (improving / stagnating / worsening) per category for each user.**

| # | Requirement | Priority |
|---|---|---|
| FR-6.1 | Require a minimum of 4 qualified uploads (confidence: HIGH or MEDIUM) in a category before any trend is shown. This threshold is a configurable runtime parameter with a default of 4. | Must |
| FR-6.2 | Calculate trend using simple linear regression: fit a line to the score series (timestamp as x, score as y). A positive slope (> +2 points per upload) = improving; negative slope (< -2) = worsening; flat slope (between -2 and +2) = stagnating. The slope thresholds are configurable. | Must |
| FR-6.3 | Recalculate trend after each new qualified upload for that user + category. | Must |
| FR-6.4 | Low-confidence uploads are excluded from trend calculations. | Must |
| FR-6.5 | Categories with fewer than 4 qualified uploads display "Not enough data yet" — never a calculated trend. | Must |

**Acceptance criteria (FR-6.2):**
```
Given: a user with 6 qualified uploads in the Proportions category
  with scores [54, 58, 61, 65, 68, 72] in chronological order
When: the system calculates the Proportions trend
Then: the trend is displayed as "Improving" (slope ~ +3.6 per upload > +2 threshold)
```

---

### FR-7 — Trend API with Tier Enforcement (U7)

**The system shall expose trend data through a tier-gated API.**

| # | Requirement | Priority |
|---|---|---|
| FR-7.1 | Free tier users: the trend API returns a response indicating trend data exists but is locked, with no per-category trend values. | Must |
| FR-7.2 | Paid tier users: the trend API returns the full trend direction and score history per category. | Must |
| FR-7.3 | Tier status is determined by the accounts service (U9) at request time — not cached on the client. | Must |

---

### FR-8 — User Authentication (U8)

**The system shall provide user registration and login with session management.**

| # | Requirement | Priority |
|---|---|---|
| FR-8.1 | Support email + password registration. Password must be at least 8 characters. Passwords are hashed (bcrypt or equivalent) — never stored in plaintext. | Must |
| FR-8.2 | Issue a JWT session token on successful login. All upload and history endpoints require a valid JWT. | Must |
| FR-8.3 | Token expiration: 7 days (configurable). | Must |

---

### FR-9 — Free Tier Upload Limit (U9)

**The system shall enforce a monthly upload limit for free tier users.**

| # | Requirement | Priority |
|---|---|---|
| FR-9.1 | Free tier limit: 10 uploads per calendar month (resets on the 1st of each month). [Q2][Q5] | Must |
| FR-9.2 | When the free tier counter reaches 0, the upload endpoint returns a 402 with an upgrade prompt. The drop zone shows the upgrade message. | Must |
| FR-9.3 | Low-confidence uploads count against the free tier limit. | Must |
| FR-9.4 | Paid tier users have no upload limit per month. | Must |
| FR-9.5 | The remaining upload count for free tier users is always visible in the UI (sidebar). | Must |

---

### FR-10 — Mock Payment and Upgrade Flow (U10)

**The system shall support a mocked paid tier upgrade.**

| # | Requirement | Priority |
|---|---|---|
| FR-10.1 | Present a pricing page showing the monthly price ($4.99) and what the paid tier unlocks (full trend history, no upload limit). | Must |
| FR-10.2 | The "Pay" action immediately transitions the user to paid tier without real payment processing. This is a mock. | Must |
| FR-10.3 | The UI must clearly indicate this is a development mock payment (required for any real user testing scenario). | Must |
| FR-10.4 | Paid tier status persists across sessions until the end of the current billing period (for the mock: it persists indefinitely unless manually reset). | Must |

---

### FR-11 — Onboarding Gate (U11)

**The system shall require explicit acknowledgment before the first upload.**

| # | Requirement | Priority |
|---|---|---|
| FR-11.1 | Display the onboarding screen on the user's first session after registration, before any upload is allowed. | Must |
| FR-11.2 | Three checkboxes must all be checked before the "Get Started" button activates. The checkboxes state: (1) Estudio complements human critique, not replaces it; (2) AI feedback is categorized input, not a verdict; (3) Images are not used to train AI without explicit separate consent, and can be deleted at any time. | Must |
| FR-11.3 | Acknowledgment is stored server-side per user. The onboarding screen is never shown again after the first session. | Must |

**Acceptance criteria (FR-11.2):**
```
Given: a newly registered user on their first session
When: they check only 2 of the 3 checkboxes
Then: the "Get Started" button remains disabled
And: the user cannot proceed to the upload screen
```

---

### FR-12 — Data Policy (U12)

**The system shall provide a visible and accessible data policy.**

| # | Requirement | Priority |
|---|---|---|
| FR-12.1 | The data policy page is accessible from the app at all times (settings menu or persistent link). | Must |
| FR-12.2 | The policy must state in plain language: (a) what data is stored (images, critiques, scores); (b) that images are not used to train AI models without explicit separate consent; (c) how to delete data (link to history deletion). | Must |
| FR-12.3 | The policy must not require the user to accept additional terms beyond the onboarding gate. | Must |

---

### FR-13 — Self-Service History Deletion (U13)

**The system shall allow users to permanently delete their upload history.**

| # | Requirement | Priority |
|---|---|---|
| FR-13.1 | Provide a "Delete my history" action in the settings. | Must |
| FR-13.2 | Require an explicit two-step confirmation before deletion: a confirmation dialog followed by the user typing "DELETE". | Must |
| FR-13.3 | Deletion is complete and permanent: all images (blob storage), all critique records, all trend calculations, and all history entries are deleted. The user account itself is preserved. | Must |
| FR-13.4 | Deletion is irreversible. No soft-delete or recycle bin. | Must |
| FR-13.5 | Partial deletion (deleting specific uploads) is NOT supported in the MVP. | Must |
| FR-13.6 | After deletion, the user's free tier counter resets. | Must |

**Acceptance criteria (FR-13.3):**
```
Given: a user with 15 uploads and calculated trends
When: the user confirms "DELETE" and the deletion is processed
Then: all images, critique records, and trend data are removed from storage
And: the user's history shows "0 critiques"
And: the user account remains active with a valid session
```

---

## Non-Functional Requirements

| ID | Requirement | Target | Category |
|---|---|---|---|
| NFR-1 | Categorization consistency across similar images | > 85% (manually validated sample) | Quality |
| NFR-2 | Claude API response time | < 30 seconds (configurable timeout) | Performance |
| NFR-3 | Upload endpoint response time (excluding AI processing) | < 2 seconds | Performance |
| NFR-4 | Line coverage (overall) | ≥ 80% in CI | Quality |
| NFR-5 | Branch coverage (service/ and handlers/) | ≥ 75% in CI | Quality |
| NFR-6 | Anthropic API key storage | K8s Secret — never in source code or image | Security |
| NFR-7 | Image upload validation | Magic number + MIME type check, server-generated filename | Security |
| NFR-8 | Password storage | bcrypt hash — never plaintext | Security |
| NFR-9 | Dependency scanning | `npm audit --audit-level=high` in GitHub Actions CI | Security |
| NFR-10 | K8s image tags | No `:latest` — all manifests must use explicit version tags | Reliability |

---

## Traceability

| FR | Unit | Scope-doc ref | Backlog ref |
|---|---|---|---|
| FR-1 | U1 | MH-1 | U1 |
| FR-2, FR-3 | U2, U3 | MH-2, MH-3 | U2, U3 |
| FR-4 | U4 | MH-4 | U4 |
| FR-5 | U5 | MH-5 | U5 |
| FR-6 | U6 | MH-6 | U6 |
| FR-7 | U7 | MH-7 | U7 |
| FR-8 | U8 | MH-8 | U8 |
| FR-9 | U9 | MH-9 | U9 |
| FR-10 | U10 | MH-10 | U10 |
| FR-11 | U11 | MH-11 | U11 |
| FR-12 | U12 | MH-12 | U12 |
| FR-13 | U13 | MH-13 | U13 |

---

## Assumptions & Open Questions

- FR-2.1 assumes Claude can reliably return a structured JSON response with a confidence field when the prompt instructs it to. This must be validated during U2 development with the test dataset. [assumption]
- The slope thresholds for trend classification (±2 points per upload) are initial values — they may need empirical calibration once real data is available. [assumption]
- NFR-1 (>85% consistency) is the most critical product quality metric and must be validated against a manually labeled test dataset before the freemium launch. [assumption]
- FR-3.6 (low-confidence uploads count against free tier) is a design decision that penalizes the user for images the system could not process. This may affect user trust if the fallback rate is high. [assumption]
