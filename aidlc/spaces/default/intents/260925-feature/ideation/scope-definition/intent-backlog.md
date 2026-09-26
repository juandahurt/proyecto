# Intent Backlog — Estudio MVP

> **Granularity:** Sub-capability level within each module (Q4=B). [Q4]
> **Upstream references:** [intent] [feas] [cons]

## Backlog Summary

| Module | Proto-Units | Priority |
|---|---|---|
| M1 — Image Ingestion & Analysis | U1, U2, U3, U4 | Must Have |
| M2 — History & Trend Detection | U5, U6, U7 | Must Have |
| M3 — Accounts & Subscription | U8, U9, U10 | Must Have |
| M4 — Trust & Data | U11, U12, U13 | Must Have |
| Should Have additions | U14, U15 | Should Have |

**Total Must Have proto-units: 13**

---

## Module 1 — Image Ingestion & Analysis

### U1 — Image Upload & Validation
**Priority:** Must Have | **Scope-doc ref:** MH-1

Accept image uploads from authenticated users. Validate format (JPEG, PNG, WebP), size limits, and that the file is a real image (not a document or binary). Reject out-of-domain files clearly.

**Key behaviors:**
- Accepted formats: JPEG, PNG, WebP
- Max file size: TBD (to be defined in functional design)
- Clear rejection message for invalid files
- Does NOT analyze the image — hands off to U2

**Dependencies:** U8 (auth — only authenticated users upload)

---

### U2 — Claude Vision API Integration & Categorized Critique
**Priority:** Must Have | **Scope-doc ref:** MH-2, MH-3

Call the Claude API (Sonnet with vision) with the uploaded image. Receive and parse a critique structured by diagnostic category (minimum: composition, proportions/anatomy, line quality, value/shading, color — category list to be finalized in functional design). Score confidence. If confidence is below threshold, route to U3.

**Key behaviors:**
- Exactly one API call per upload
- Critique MUST be structured by category — free-text blob is not acceptable
- Confidence must be explicitly assessed, not inferred from response quality
- Cost: ~$0.02/call at current pricing

**Dependencies:** U1 (image must be validated before API call)

---

### U3 — Low-Confidence Fallback Path
**Priority:** Must Have | **Scope-doc ref:** MH-3

When the Claude API cannot categorize with sufficient confidence: do NOT present a low-confidence critique as a normal critique. Display an explicit "could not generate a reliable critique for this image" message. Offer retry. Do NOT include this upload in trend calculations.

**Key behaviors:**
- Threshold for "low confidence" to be defined in functional design
- Message must explain WHY (e.g., image is too abstract, too small, out of domain)
- Retry option available
- Image is stored but flagged as unanalyzed for trend purposes

**Dependencies:** U2 (confidence comes from the API call)

---

### U4 — Critique Storage per Upload
**Priority:** Must Have | **Scope-doc ref:** MH-4

Store the categorized critique, the uploaded image (user-visible, not used for training), and the per-category scores linked to the user account and timestamp.

**Key behaviors:**
- Each upload creates one record: image + critique + categories + scores + timestamp + user_id + confidence_flag
- Images are private to the uploading user (no other user can see them)
- Low-confidence uploads are stored but flagged (excluded from trend calculations in U6)
- Storage is the input for U5 (history) and the subject of U13 (deletion)

**Dependencies:** U1, U2, U8

---

## Module 2 — History & Trend Detection

### U5 — Structured History Storage by Category
**Priority:** Must Have | **Scope-doc ref:** MH-5

Maintain a time-ordered history of all uploads per user, with scores per diagnostic category per upload. This is the data foundation for trend detection.

**Key behaviors:**
- History is indexed by user_id + category + timestamp
- Low-confidence uploads are stored in history but excluded from trend calculation inputs
- Free tier users: full history stored (the tier limits VIEWING trend, not storage)
- History is the data subject for U13 (deletion)

**Dependencies:** U4

---

### U6 — Trend Calculation Engine
**Priority:** Must Have | **Scope-doc ref:** MH-6

For each category where the user has ≥4 qualified (non-low-confidence) uploads, calculate the trend direction: improving / stagnating / worsening. The threshold (4) is a configurable runtime parameter with this default.

**Key behaviors:**
- Trend calculated independently per category
- Minimum 4 qualified uploads required per category before any trend is shown (configurable)
- A category with <4 qualified uploads shows "not enough data yet" — not a trend
- Trend direction is determined by a simple linear regression or moving average (algorithm to be specified in functional design)
- Re-calculated after each new upload

**Dependencies:** U5

---

### U7 — Trend History API with Tier Enforcement
**Priority:** Must Have | **Scope-doc ref:** MH-7

Expose the trend data through an API that enforces the freemium tier boundary: free users see a teaser (trend exists but is not detailed); paid users see the full trend history per category.

**Key behaviors:**
- Free tier: response indicates "trend data available — upgrade to see details" — no category-level trend values exposed
- Paid tier: full trend per category, with direction and history of scores
- Tier status comes from U9 (accounts)
- This is where SH-1 (teaser) plugs in if implemented

**Dependencies:** U6, U9

---

## Module 3 — Accounts & Subscription

### U8 — User Authentication
**Priority:** Must Have | **Scope-doc ref:** MH-8

User registration (email + password), login, and session management. Every API endpoint that accesses user data or uploads requires an authenticated session.

**Key behaviors:**
- Registration: email + password (no OAuth in MVP)
- Login: returns a session token (JWT or equivalent)
- All upload and history endpoints require valid session
- Password reset: TBD (may be cut from MVP if time-constrained)

**Dependencies:** None (base capability)

---

### U9 — Free Tier Upload Limit Enforcement
**Priority:** Must Have | **Scope-doc ref:** MH-9

Track the number of uploads per user per billing period. When the free tier limit is reached, reject new upload attempts with a clear message and an upgrade prompt.

**Key behaviors:**
- Upload limit per period: TBD in functional design (e.g., 10 uploads/month)
- Counter resets at the start of each period
- Rejection message must reference the upgrade path (U10), not just say "limit reached"
- Paid users bypass this counter

**Dependencies:** U8, U10 (paid users bypass; limit must know user's tier)

---

### U10 — Mock Payment + Paid Tier Upgrade Flow
**Priority:** Must Have | **Scope-doc ref:** MH-10

Present the upgrade flow (pricing page + "pay" button). The payment step is mocked — clicking "pay" transitions the user to paid tier without real payment processing. The tier boundary (what changes for paid users) is real and enforced; only the transaction is stubbed.

**Key behaviors:**
- Upgrade UI shows price ($4.99/month) and what the paid tier unlocks (full trend access)
- "Pay" button is a mock — immediately transitions user to paid status
- A clearly visible "this is a development mock" notice in the UI (optional for course demo; required for any real user testing)
- The tier state is persisted per user

**Dependencies:** U8 (authenticated user required to upgrade)

---

## Module 4 — Trust & Data

### U11 — Onboarding Gate
**Priority:** Must Have | **Scope-doc ref:** MH-11

Display the onboarding screen on first launch. Require explicit acknowledgment (one tap/click on a clear confirmation) before the first upload is allowed. Onboarding must communicate: (1) Estudio is a complement to human critique, not a replacement; (2) AI feedback is categorized feedback, not a verdict; (3) Value accumulates over time, not from one upload.

**Key behaviors:**
- Must be ONE explicit acknowledgment action (a checkbox or button) — not dismissable by swiping past
- Shown once per account, on first session
- Acknowledgment is stored so it does not repeat on subsequent sessions

**Dependencies:** U8

---

### U12 — Data Policy Display & Consent
**Priority:** Must Have | **Scope-doc ref:** MH-12

Provide a visible, accessible data policy page that states clearly: (1) images are not used to train models without explicit separate consent; (2) what data is stored (images, critiques, scores); (3) how to delete data (links to U13).

**Key behaviors:**
- Accessible from the app at any time (settings menu or footer)
- Written in plain language — no legalese-only version in the MVP
- No default consent to training — the policy must explicitly state the opt-in nature of any future training consent

**Dependencies:** None (static content + U13 link)

---

### U13 — Self-Service History Deletion
**Priority:** Must Have | **Scope-doc ref:** MH-13 (elevated from Should Have)

Allow the user to permanently delete their upload history: all images, all critiques, all scores, all trend calculations. The deletion must be irreversible and complete.

**Key behaviors:**
- Deletion requires explicit confirmation (e.g., type "DELETE" or a two-step confirm)
- All related data is deleted: images (blob storage) + critique records (database) + trend calculations
- Deletion is permanent and immediate — no soft delete / recycle bin in the MVP
- After deletion, the user account still exists (they can upload again from zero)
- Partial deletion (delete specific uploads) is Not Supported in the MVP — all or nothing

**Dependencies:** U4, U5, U8

---

## Should Have (Not in Must Have scope)

### U14 — Trend Teaser for Free Users
**Priority:** Should Have | **Scope-doc ref:** SH-1

Show free users that trend data exists but is locked — "Your composition has been trending in the past 4 uploads. Upgrade to see the full breakdown." Specific trend values are not exposed.

**Dependencies:** U6, U7, U10

---

### U15 — Upload Context Confirmation
**Priority:** Should Have | **Scope-doc ref:** SH-2

Before (or immediately after) uploading, ask the user: what kind of exercise is this? (gesture drawing, figure study, still life, landscape, etc.) Include this context in the Claude API prompt to improve categorization relevance.

**Dependencies:** U1, U2

---

## Dependency Order (Build Sequence)

```
U8 (Auth)
  └─> U1 (Upload) ──> U2 (Claude API) ──> U3 (Fallback)
                              └─> U4 (Storage)
                                     └─> U5 (History)
                                            └─> U6 (Trends)
                                                   └─> U7 (Tier API)
U9 (Limits) ──> U10 (Upgrade) ──────────────────────────────────┘
U11 (Onboarding) ──> U12 (Policy) ──> U13 (Deletion)
```

**MH-1 → MH-13 are all blocking dependencies for the full MVP.**

## Assumptions & Open Questions

- Category taxonomy (composition, anatomy, color, perspective, line quality, etc.) is not yet finalized — this is a functional design decision that will affect U2 and U6. [assumption]
- Free tier upload limit (number/period) is not yet defined — this is a product and economics decision for functional design. [assumption]
- U15 (upload context) is the Should Have most likely to improve categorization consistency — if R-01 (categorization risk) materializes, elevating U15 to Must Have should be the first response. [assumption]
