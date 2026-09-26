# User Stories — Estudio MVP

> **Actor principal:** Ana — artista autodidacta con rutina de práctica activa
> **Scope:** 13 historias, una por proto-unidad Must Have (U1-U13)
> **Formato de AC:** GWT completo (Given / When / Then)
> **Upstream:** requirements.md, intent-backlog.md, scope-document.md

---

## US-1 — Subida de imagen (U1)

**As** Ana, **I want** to upload a drawing file (JPEG, PNG, or WebP, up to 10MB) to Estudio **so that** it can be analyzed by the AI and added to my critique history.

**Acceptance criteria:**

```
AC-1.1 — Happy path upload
Given: Ana is logged in and has free uploads remaining
When: she drops a valid JPEG file (under 10MB) on the upload zone
Then: the file is accepted and the system starts processing it
And: a progress indicator appears while the AI analysis runs

AC-1.2 — Wrong format rejection
Given: Ana attempts to upload a .pdf file renamed to .jpg
When: the server checks the file's magic number
Then: the upload is rejected with the message "Invalid image format — only JPEG, PNG, and WebP are accepted"
And: no file is stored

AC-1.3 — File too large rejection
Given: Ana attempts to upload a valid JPEG file of 15MB
When: the size is checked
Then: the upload is rejected with the message "File too large — maximum size is 10MB"
```

---

## US-2 — Critique by category (U2)

**As** Ana, **I want** to receive a critique of my drawing broken down into 5 categories (Composition, Proportions, Line Quality, Values, Perspective) with a score and written feedback for each **so that** I know specifically what to work on rather than getting generic AI feedback.

**Acceptance criteria:**

```
AC-2.1 — Full categorized critique
Given: Ana uploads a valid figure drawing
When: the analysis completes
Then: the Critique View shows all 5 categories
And: each category shows an integer score (0-100) and at least 2 sentences of feedback
And: the total response time from upload submission to critique display is under 30 seconds

AC-2.2 — All 5 categories always present
Given: Ana uploads a simple sketch with no perspective elements
When: the critique is generated
Then: the Perspective category still appears in the critique
And: its feedback acknowledges the category's limited relevance rather than omitting it
```

---

## US-3 — Low-confidence fallback (U3)

**As** Ana, **I want** to be clearly told when the AI cannot analyze my image reliably **so that** I don't receive misleading feedback or confuse a failed analysis with a genuine critique.

**Acceptance criteria:**

```
AC-3.1 — Non-image file detected as low-confidence
Note: the upload record is created in the database BEFORE the Claude API call,
so the free tier counter is decremented at upload time regardless of AI outcome.
Given: Ana uploads a photo of her cat (not a drawing)
When: the Claude API returns a structured JSON response with `confidence: LOW`
Then: the system shows "Could not generate a reliable critique for this image"
And: offers a Retry option
And: does NOT display any category scores for this upload

AC-3.2 — Low-confidence upload excluded from trend
Given: Ana has 5 prior qualified uploads in Proportions
And: her most recent upload triggered the low-confidence fallback
When: the Proportions trend is calculated
Then: the low-confidence upload's scores are NOT included in the regression
And: the trend is calculated from the 5 qualified uploads only

AC-3.3 — Low-confidence upload still counts against free tier
Given: Ana is on the free tier with 1 upload remaining
When: she uploads an image that triggers low-confidence fallback
Then: her remaining uploads drop to 0
And: she sees the "No uploads remaining" state on her next visit to the Upload screen
```

---

## US-4 — Private storage of images and critiques (U4)

**As** Ana, **I want** my uploaded images and their critiques to be stored securely and privately in my account **so that** only I can see my work and no one else can access my drawings.

**Acceptance criteria:**

```
AC-4.1 — Image isolation between users
Given: Ana uploads a drawing (upload_id: ABC)
When: another authenticated user (Bob) requests Ana's image URL or upload record
Then: the system returns 403 Forbidden
And: no image bytes are served to Bob

AC-4.2 — No use of images for AI training
Given: Ana is using Estudio
When: any server-side process runs
Then: user images are never transmitted to any model training endpoint
And: the data policy page correctly states that images are not used for training without explicit separate consent
```

---

## US-5 — Upload history (U5)

**As** Ana, **I want** to see a chronological list of all my past uploads with their top feedback categories and scores **so that** I can quickly review my submission history and pick specific critiques to revisit.

**Acceptance criteria:**

```
AC-5.1 — History displays all uploads
Given: Ana has made 8 uploads (7 qualified, 1 low-confidence)
When: she opens My History
Then: all 8 uploads appear, sorted newest first
And: the low-confidence upload shows "Critique unavailable" instead of a category score
And: each qualified upload shows its date and the category with the lowest score (most room to improve)

AC-5.2 — History is always stored at full detail
Given: Ana is on the free tier
When: she opens My History
Then: all her uploads are listed (free tier never restricts history storage — only trend display)
```

---

## US-6 — Per-category trend detection (U6)

**As** Ana (paid tier), **I want** to see whether each feedback category is improving, stagnating, or worsening across my submissions **so that** I can confirm whether my practice is actually addressing my weak points.

**Acceptance criteria:**

```
AC-6.1 — Trend shown after 4+ qualified uploads
Given: Ana has 4 qualified (confidence: HIGH or MEDIUM) uploads in Proportions with scores [54, 58, 65, 72]
When: she opens the Trends section
Then: Proportions shows "Improving" (positive linear regression slope > +2)

AC-6.2 — "Not enough data" before threshold
Given: Ana has only 3 qualified uploads in Composition
When: she opens the Trends section
Then: Composition shows "Not enough data yet — 1 more upload needed to see your trend"
And: no trend direction is displayed

AC-6.4 — Low-confidence as the 4th upload does NOT trigger trend
Given: Ana has 3 qualified uploads in Line Quality
When: her 4th upload in Line Quality triggers the low-confidence fallback
Then: Line Quality still shows "Not enough data yet — 1 more upload needed"
And: the trend threshold requires 4 QUALIFIED (non-low-confidence) uploads

AC-6.3 — Low-confidence uploads excluded
Given: Ana has 4 qualified uploads + 2 low-confidence uploads in Line Quality
When: the trend is calculated
Then: only the 4 qualified scores are used in the regression
```

---

## US-7 — Freemium trend gate (U7)

**As** Ana on the free tier, **I want** to see that trend data exists for my drawings even when it's locked **so that** I understand what I'd gain by upgrading and can make an informed decision.

**Acceptance criteria:**

```
AC-7.1 — Teaser visible on free tier (Should Have — deferred)
Note: US-7 corresponds to SH-1 (Should Have, deferred). The core behavior below
is the tier enforcement that must work regardless of whether the teaser is built.

AC-7.1 — Trend data blocked for free tier
Given: Ana is on the free tier with 6 qualified uploads in Composition
When: the system calculates the trend
Then: the trend API returns a response indicating trend data exists but is not accessible at this tier
And: the UI shows "Upgrade to see your trends" without revealing the actual trend direction or scores

AC-7.2 — Full trend for paid tier
Given: Ana is on the paid tier
When: she opens the Trends section
Then: all per-category trends are displayed with direction and score history
```

---

## US-8 — Account registration and login (U8)

**As** Ana, **I want** to create an account and log in securely **so that** my critique history is private to me and persists across sessions.

**Acceptance criteria:**

```
AC-8.1 — Registration
Given: Ana visits Estudio for the first time
When: she registers with a valid email and a password of at least 8 characters
Then: her account is created and she is logged in automatically
And: her password is stored as a bcrypt hash — never in plaintext

AC-8.2 — Login
Given: Ana has a registered account
When: she logs in with her email and password
Then: she receives a JWT session token valid for 7 days
And: she is redirected to the Upload screen

AC-8.3 — Failed login
Given: Ana enters an incorrect password
When: she submits the login form
Then: she sees "Incorrect email or password" with no indication of which field was wrong
```

---

## US-9 — Free tier upload limit (U9)

**As** Ana on the free tier, **I want** to always see how many uploads I have left this month **so that** I can decide which drawings to submit before the limit resets on the 1st of the month.

**Acceptance criteria:**

```
AC-9.1 — Counter visible at all times
Given: Ana is on the free tier with 3 uploads remaining
When: she is on any screen with the sidebar visible
Then: the sidebar shows "3 of 10 uploads left this month"

AC-9.2 — Upload blocked when counter reaches 0
Given: Ana has 0 uploads remaining
When: she opens the Upload screen
Then: the drop zone is replaced by "You've used all 10 uploads for this month. Resets on the 1st."
And: an Upgrade button is prominently displayed

AC-9.3 — Counter reset on the 1st of the month
Given: Ana had 0 uploads remaining on January 31
When: February 1 arrives (00:00 UTC)
Then: her upload counter resets to 10
And: she can upload without restriction
```

---

## US-10 — Paid tier upgrade (U10)

**As** Ana, **I want** to upgrade to the paid plan **so that** I can see my full trend history and upload without monthly limits.

**Acceptance criteria:**

```
AC-10.1 — Upgrade flow
Given: Ana clicks "Upgrade" from the sidebar or the blocked upload screen
When: she reaches the pricing page
Then: she sees the monthly price ($4.99) and a clear description of what the paid tier unlocks (full trends, no upload limit)

AC-10.2 — Mock payment completes immediately
Given: Ana clicks "Pay" on the pricing page
When: the mock payment is processed
Then: her account transitions immediately to paid tier
And: the upload counter disappears from the sidebar
And: the Trends section becomes fully accessible

AC-10.3 — Development mock visible (any real user testing context)
Given: Estudio is running with real users for testing purposes
When: Ana views the pricing page
Then: a visible notice states "This is a development mock — no real payment is processed"
```

---

## US-11 — Onboarding acknowledgment (U11)

**As** Ana, new to Estudio, **I want** to explicitly acknowledge how the AI feedback works and how my data is handled before I submit my first drawing **so that** I start with the right expectations and can trust the platform.

**Acceptance criteria:**

```
AC-11.1 — Onboarding required before first upload
Given: Ana has just registered a new account
When: she tries to navigate to the Upload screen
Then: she is first shown the Onboarding screen

AC-11.2 — All 3 checkboxes required, with specified copy
Given: Ana is on the Onboarding screen
When: she checks only 2 of the 3 checkboxes
Then: the "Get Started" button remains disabled
And: she cannot proceed to the Upload screen

Note: The exact text of the 3 checkboxes is defined in wireframes.md (Onboarding screen):
(1) "Estudio COMPLEMENTS human critique -- it doesn't replace your instructor, community, or mentors."
(2) "AI feedback is categorized input, not a verdict. My own judgment and human critique remain primary."
(3) "Estudio stores my uploads and critique history. My images are NEVER used to train AI models without my explicit, separate consent. I can delete my history at any time in Settings."
These exact strings are the required copy for the MVP onboarding.

AC-11.3 — Onboarding not repeated after first session
Given: Ana completed onboarding in her first session
When: she logs in for a second session
Then: she lands directly on the Upload screen without seeing onboarding again
```

---

## US-12 — Data policy access (U12)

**As** Ana, **I want** to read exactly what data Estudio stores about me and how it's used **so that** I can decide whether to trust the platform with my artwork.

**Acceptance criteria:**

```
AC-12.1 — Policy accessible at any time
Given: Ana is logged in on any screen
When: she looks for the data policy
Then: she can reach it in no more than 2 clicks from the Settings menu

AC-12.2 — Policy states no-training commitment
Given: Ana reads the data policy
When: she looks for the section about AI training
Then: she finds a clear statement that her images are not used to train AI models without her explicit separate consent
And: the statement specifies how to delete her data (link to US-13)
```

---

## US-13 — Delete my history (U13)

**As** Ana, **I want** to permanently delete all my uploaded images and critique history from Estudio at any time **so that** I maintain full control over my personal data and can leave the platform cleanly.

**Acceptance criteria:**

```
AC-13.1 — Deletion requires two-step confirmation
Given: Ana clicks "Delete my history" in Settings
When: the confirmation dialog appears
Then: she must type the word "DELETE" to confirm
And: the action button only activates after the exact text "DELETE" is entered

AC-13.2 — Deletion is complete and permanent
Given: Ana completes the two-step deletion
When: the system processes the deletion
Then: all her images are removed from blob storage
And: all her critique records and scores are deleted from the database
And: all her trend calculations are deleted
And: her history shows "0 critiques"
And: the deletion cannot be undone

AC-13.3 — Account persists after deletion
Given: Ana's history has been deleted
When: she returns to the Upload screen
Then: her account is still active and she is still logged in
And: her upload counter resets to the free tier default (10/month)
And: she can start uploading again from zero
```

---

## Story Map

| Journey Step | US | Unit | Priority |
|---|---|---|---|
| Registration | US-8 | U8 | Must Have |
| Onboarding gate | US-11 | U11 | Must Have |
| Upload drawing | US-1 | U1 | Must Have |
| AI analysis → categorized critique | US-2 | U2 | Must Have |
| Handle AI uncertainty | US-3 | U3 | Must Have |
| Private storage | US-4 | U4 | Must Have |
| View past uploads | US-5 | U5 | Must Have |
| See improvement trend | US-6 | U6 | Must Have |
| Freemium gate | US-7, US-9 | U7, U9 | Must Have |
| Upgrade to paid | US-10 | U10 | Must Have |
| Data policy | US-12 | U12 | Must Have |
| Delete history | US-13 | U13 | Must Have |

**MVP boundary:** All 13 stories are Must Have. Should Have stories (US-7 teaser SH-1, upload context SH-2) are deferred.

---

## Assumptions & Open Questions

- AC-2.2 (all 5 categories always present) requires prompt engineering work in U2 to ensure Claude always returns all 5 categories even for images where some are less relevant. This must be validated against the test dataset. [assumption]
- AC-3.3 (low-confidence uploads count against free tier) follows FR-3.6. The trade-off was noted in requirements.md Assumptions. [assumption]
- US-7 is documented for the deferred SH-1 (teaser) behavior — but the core tier enforcement (trend blocked for free tier) is Must Have and tested in AC-7.1 and AC-7.2. [assumption]
