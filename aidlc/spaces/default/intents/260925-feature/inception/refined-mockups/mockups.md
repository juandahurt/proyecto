# Refined Mockups — Estudio MVP

> **Base:** ideation/rough-mockups/wireframes.md (4 pantallas base)
> **Additions:** Error states, zero-counter state, low-confidence state — as variants
> **Design system:** Tailwind CSS + shadcn/ui
> **Accessibility:** WCAG 2.1 AA target

---

## Screen 1 — Onboarding (First Launch)

Unchanged from rough mockups. Single-column full-page centered card.

**shadcn/ui components:** `Card`, `Checkbox`, `Button` (disabled state)

```
+--------------------------------------------------------------+
| [Estudio logo]                                               |
+--------------------------------------------------------------+
|                                                              |
|  Welcome to Estudio                 [Card — centered]        |
|                                                              |
|  Track whether your practice is actually improving.          |
|                                                              |
|  Before your first upload:                                   |
|                                                              |
|  [Checkbox 1] Estudio COMPLEMENTS human critique --          |
|               it doesn't replace instructors or mentors.    |
|                                                              |
|  [Checkbox 2] AI feedback is categorized input, not a        |
|               verdict. Human critique remains primary.       |
|                                                              |
|  [Checkbox 3] My images are NEVER used to train AI           |
|               without my explicit separate consent.          |
|               I can delete my history in Settings.           |
|                                                              |
|             [ Get Started ]  (disabled until all checked)    |
|                                                              |
+--------------------------------------------------------------+
```

<!-- Text fallback: Full-page centered Card. Logo at top. Welcome heading. Three labeled Checkbox components — all must be checked before Button activates. Button shows disabled visual state until all three are checked. -->

**State: All boxes unchecked (entry state)**
- `Button` has `disabled` prop; visual: gray background, no hover effect
- Aria: `aria-disabled="true"`, `aria-describedby="onboarding-instructions"`

**State: All boxes checked (ready)**
- `Button` becomes active; primary color (Tailwind `blue-600`)

---

## Screen 2A — Upload (Normal State, Free Tier)

Sidebar layout. Drop zone active. Counter visible.

**shadcn/ui components:** `Sheet` (sidebar), `Progress`, `Badge`, `Button`, `Separator`, `ScrollArea`

```
+------------------+----------------------------------------------+
| [E] Estudio      | Upload a Drawing                             |
|                  |                                              |
| > Upload    ←    |  +----------------------------------------+  |
|   My History     |  |                                        |  |
|   Settings       |  |   Drag your image here, or             |  |
|                  |  |                                        |  |
| ---------------  |  |        [ Browse file ]                 |  |
|                  |  |                                        |  |
| Free             |  |   JPEG / PNG / WebP  |  Max 10 MB     |  |
| 7 of 10          |  +----------------------------------------+  |
| uploads left     |                                              |
| this month       |  Recent uploads                              |
|                  |  [thumb] hand study    Sep 24  [View ->]     |
| [Upgrade ->]     |  [thumb] gesture 09/18         [View ->]     |
|                  |  [thumb] figure 09/11          [View ->]     |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Two-column layout. Left sidebar with logo, navigation links (Upload selected), upload counter showing "7 of 10 uploads left this month" with an Upgrade link. Right main area: Upload heading, large drop zone with "Browse file" button and format/size caption, horizontal separator, scrollable list of recent uploads each with thumbnail, date, and View link. -->

---

## Screen 2B — Upload (Zero-Counter State)

[ADDRESSES Rough Mockup reviewer finding R-02]

Drop zone is replaced by an upgrade prompt. No file input available.

```
+------------------+----------------------------------------------+
| [E] Estudio      | Upload a Drawing                             |
|                  |                                              |
| > Upload    ←    |  +----------------------------------------+  |
|   My History     |  |                                        |  |
|   Settings       |  |   You've used all 10 uploads for        |  |
|                  |  |   September. Resets October 1 (UTC).    |  |
| ---------------  |  |                                        |  |
|                  |  |   [ Upgrade for unlimited uploads ]     |  |
| Free             |  |   or wait until October 1              |  |
| 0 of 10          |  |                                        |  |
| uploads left     |  +----------------------------------------+  |
|                  |                                              |
| [Upgrade ->]     |  Recent uploads                              |
|                  |  [thumb] hand study    Sep 24  [View ->]     |
|                  |  [thumb] gesture 09/18         [View ->]     |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Same layout as 2A but the drop zone is replaced by an upgrade prompt card. The counter in the sidebar shows "0 of 10". The upgrade prompt states the reset date (UTC) and offers an Upgrade button and a text option to wait. The Recent uploads list remains accessible. -->

**Accessibility note (WCAG 2.1 AA):** The upgrade prompt is announced via `aria-live="polite"` when the counter reaches 0. Focus does not shift to the prompt automatically.

---

## Screen 3A — Critique View (Normal State)

Post-upload result. All 5 categories shown.

**shadcn/ui components:** `Badge` (score), `Separator`, `Accordion` (categories), `AspectRatio` (thumbnail), `Button` (utility voting)

```
+------------------+----------------------------------------------+
| [E] Estudio      | hand study                   [ <- Back ]     |
|                  | Sep 24, 2026                                 |
|   Upload         |                                              |
| > My History     |  [image thumbnail — 300px wide]              |
|   Settings       |                                              |
|                  |  AI Critique                                 |
|                  |  -----------------------------------------   |
|                  |                                              |
|                  |  COMPOSITION                  [72 / 100]     |
|                  |  Your focal point is well-placed but the     |
|                  |  negative space on the right reads heavy.    |
|                  |  Consider shifting the subject slightly      |
|                  |  left to balance the visual weight.          |
|                  |                                              |
|                  |  PROPORTIONS                  [58 / 100]     |
|                  |  Head-to-body ratio reads ~1:5. Adult        |
|                  |  standing figure standard is ~1:7.5.         |
|                  |  The torso appears compressed relative...    |
|                  |                                              |
|                  |  LINE QUALITY                 [81 / 100]     |
|                  |  Confident strokes overall. Chicken-scratch  |
|                  |  in the jaw area suggests hesitation.        |
|                  |  Commit to the stroke from the shoulder.     |
|                  |                                              |
|                  |  VALUES (SHADING)             [64 / 100]     |
|                  |  Value range is narrow — the darkest shadow  |
|                  |  sits at about 40% gray. Push the darks to  |
|                  |  full black to increase form definition.     |
|                  |                                              |
|                  |  PERSPECTIVE                  [77 / 100]     |
|                  |  Ellipses in the cup are solid. The chair    |
|                  |  legs converge too quickly for a 2-point     |
|                  |  perspective setup at this view angle.       |
|                  |                                              |
|                  |  Was this critique useful?                   |
|                  |  [ Yes ] [ No ]                              |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Two-column layout. Left sidebar with "My History" active. Right main: page header with drawing title and date, back link. Image thumbnail. "AI Critique" section with horizontal rule. Five stacked category panels: COMPOSITION (72/100), PROPORTIONS (58/100), LINE QUALITY (81/100), VALUES SHADING (64/100), PERSPECTIVE (77/100), each with a score badge and 2-4 sentences of feedback. Below all panels: "Was this critique useful?" with Yes and No buttons. -->

---

## Screen 3B — Critique View (Low-Confidence Error State)

[ADDRESSES US-3 gap — visible error state for unanalyzable images]

```
+------------------+----------------------------------------------+
| [E] Estudio      | Uploaded image                [ <- Back ]    |
|                  | Sep 24, 2026                                 |
|   Upload         |                                              |
| > My History     |  [image thumbnail — 300px wide]              |
|   Settings       |                                              |
|                  |  Critique Unavailable                        |
|                  |  -----------------------------------------   |
|                  |                                              |
|                  |  Estudio couldn't generate a reliable        |
|                  |  critique for this image.                    |
|                  |                                              |
|                  |  Possible reasons:                           |
|                  |  - The image may not be a drawing or sketch  |
|                  |  - The image resolution is too low           |
|                  |  - The content is outside the expected range |
|                  |    (abstract art, digital paintings, etc.)   |
|                  |                                              |
|                  |  This upload counted toward your monthly     |
|                  |  limit. It will not appear in your trends.   |
|                  |                                              |
|                  |              [ Try another image ]           |
|                  |                                              |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Same layout as 3A but the critique section shows "Critique Unavailable" heading, an explanation paragraph with a bulleted list of possible reasons, a note that the upload counted toward the monthly limit, and a "Try another image" button (links back to Upload screen). -->

---

## Screen 4 — Dashboard / History (Revised Labels)

[ADDRESSES Rough Mockup reviewer findings R-01 (column label) and R-03 (teaser deferred callout)]

```
+------------------+----------------------------------------------+
| [E] Estudio      | My History              [ + Upload ]         |
|                  | 12 critiques  |  Sep 2026                    |
|   Upload         |                                              |
| > My History     |  +--------+----------+------------+--------+ |
|   Settings       |  | Image  | Date     | Focus area | Score  | |
|                  |  | (thumb)|          | (lowest)   |(lowest)| |
| ---------------  |  +--------+----------+------------+--------+ |
|                  |  | [img]  | Sep 24   | Proportions| 58/100 | |
| Free             |  +--------+----------+------------+--------+ |
| 7 of 10 left     |  | [img]  | Sep 18   | Composition| 65/100 | |
|                  |  +--------+----------+------------+--------+ |
| [Upgrade ->]     |  | [img]  | Sep 11   | Values     | 62/100 | |
|                  |  +--------+----------+------------+--------+ |
|                  |  | [img]  | Sep 04   | Proportions| 54/100 | |
|                  |  +--------+----------+------------+--------+ |
|                  |  [Show all 12]                               |
|                  |                                              |
|                  |  +----------------------------------------+ |
|                  |  | PROGRESS TRENDS            [DEFERRED]  | |
|                  |  | (Not included in MVP build)             | |
|                  |  |                                        | |
|                  |  | Proportions  [locked chart placeholder] | |
|                  |  | Composition  [locked chart placeholder] | |
|                  |  | Line Quality [locked chart placeholder] | |
|                  |  |                                        | |
|                  |  |  [ Upgrade to unlock your trends ]     | |
|                  |  +----------------------------------------+ |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Two-column layout. Left sidebar with free-tier counter. Right main: "My History" heading, upload count and date range, "+Upload" shortcut. Table with four columns: Image thumbnail, Date, Focus area (category with lowest score — renamed from "Top Cat." in rough mockups), and Score. "Show all 12" pagination link. Below table: PROGRESS TRENDS section with a visible [DEFERRED] badge in the header and a "(Not included in MVP build)" note, three locked chart placeholders per category, and an upgrade button. The deferred badge is in red/orange to make the placeholder status immediately visible. -->

**Column "Focus area" definition:** The category with the lowest score in that upload (most room to improve). Tooltip on hover: "The category with the most room to improve in this upload."

---

## Assumptions & Open Questions

- Thumbnail aspect ratio and dimensions are defined as constraints in the interaction-spec.md. [assumption]
- The "Was this critique useful?" vote (Yes/No) stores a boolean flag per upload. The API endpoint for this vote is not yet defined — it will be specified in Functional Design. [assumption]
- WCAG 2.1 AA compliance requires keyboard navigation testing for the sidebar, drop zone, and table — this must be validated during Build and Test. [assumption]
