# Wireframes — Estudio MVP

> **Upstream references:** [intent] [scope] [backlog]
> **Layout:** Web desktop, fixed sidebar navigation (Q1=A, Q3=A)
> **Screens included:** 4 happy-path screens (Q2=B): Onboarding, Upload, Critique View, Dashboard

---

## Screen 1 — Onboarding (First Launch)

Full-page welcome shown on first session only. No sidebar. Requires one explicit acknowledgment before proceeding.

```
+---------------------------------------------------------------+
| Estudio                                                       |
+---------------------------------------------------------------+
|                                                               |
|  Welcome to Estudio                                           |
|                                                               |
|  Estudio gives you AI critique on your drawings and tracks    |
|  whether you're actually improving category by category.      |
|                                                               |
|  Before your first upload, please acknowledge:                |
|                                                               |
|  [ ] Estudio COMPLEMENTS human critique -- it doesn't         |
|      replace your instructor, community, or mentors.          |
|                                                               |
|  [ ] AI feedback is categorized input, not a verdict.         |
|      Your own judgment and human critique remain primary.     |
|                                                               |
|  [ ] Estudio stores your uploads and critique history.        |
|      Your images are NEVER used to train AI models            |
|      without your explicit, separate consent.                 |
|      You can delete your history at any time in Settings.     |
|                                                               |
|                      [ Get Started ]                          |
|                    (disabled until all checked)               |
|                                                               |
+---------------------------------------------------------------+
```

<!-- Text fallback: Full-page onboarding form. Three required checkboxes: (1) complement not replacement, (2) AI is input not verdict, (3) data policy + deletion option. One "Get Started" button disabled until all three are checked. No navigation shown. -->

**Key behaviors:**
- All 3 checkboxes required before "Get Started" activates
- Shown once per account, on first session only
- Acknowledgment stored server-side so it doesn't repeat

---

## Screen 2 — Upload (Main / Entry Point)

Primary screen for submitting a drawing. This is the most critical screen to get right (Q4=A).

```
+------------------+----------------------------------------------+
| ESTUDIO          | Upload a Drawing                             |
|                  |                                              |
| [E] logo         |  +----------------------------------------+  |
|                  |  |                                        |  |
| > Upload    <--  |  |                                        |  |
|   My History     |  |   Drag and drop your image here        |  |
|   Settings       |  |                                        |  |
|                  |  |        or                              |  |
| ----------       |  |                                        |  |
|                  |  |        [ Browse File ]                 |  |
| Free tier        |  |                                        |  |
| 3 of 10 left     |  +----------------------------------------+  |
|                  |                                              |
| [ Upgrade ]      |  Accepted: JPEG, PNG, WebP | Max: 10 MB     |
|                  |                                              |
|                  |  ------------------------------------------- |
|                  |  Recent uploads                              |
|                  |  [img] hand study 09/24    [View critique]   |
|                  |  [img] gesture 09/18       [View critique]   |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Desktop layout with fixed left sidebar. Sidebar contains: logo, three navigation links (Upload selected/highlighted, My History, Settings), upload counter showing free tier remaining uses, and Upgrade button. Main content: Upload header, large drag-and-drop zone centered, Browse File button inside the zone, format/size info below, horizontal divider, list of recent uploads with thumbnails and View critique links. -->

**Key behaviors:**
- Upload counter always visible in sidebar (free tier awareness)
- When counter reaches 0, the drop zone shows "Upgrade to upload more" instead
- Recent uploads list shows last 3–5, with link to full history
- Upload triggers a loading state → redirect to Critique View

---

## Screen 3 — Critique View

Shown immediately after upload completes. Categorized feedback display.

```
+------------------+----------------------------------------------+
| ESTUDIO          | hand study                    [ < Back ]     |
|                  | Uploaded Sep 24, 2026                        |
|   Upload         |                                              |
| > My History     |  +------------------+                        |
|   Settings       |  | [image thumbnail]|                        |
|                  |  +------------------+                        |
|                  |                                              |
|                  |  AI Critique                                 |
|                  |  ------------------------------------------- |
|                  |                                              |
|                  |  COMPOSITION               [score: 72 / 100] |
|                  |  Focal point is well-placed but the          |
|                  |  negative space on the right feels heavy.    |
|                  |  Consider shifting the subject slightly...   |
|                  |                                              |
|                  |  PROPORTIONS               [score: 58 / 100] |
|                  |  Head-to-body ratio reads ~1:5. Standard     |
|                  |  for a standing adult is closer to 1:7.5.   |
|                  |  The torso appears compressed relative...    |
|                  |                                              |
|                  |  LINE QUALITY              [score: 81 / 100] |
|                  |  Confident strokes overall. Chicken scratch  |
|                  |  in the jaw area suggests hesitation.        |
|                  |  Commit to the stroke from the shoulder...   |
|                  |                                              |
|                  |  Was this critique useful?                   |
|                  |  [ Yes, helpful ]     [ Not useful ]         |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Desktop layout, sidebar unchanged but "My History" now active. Main content: image title and upload date header with Back link. Thumbnail of uploaded image. AI Critique section with horizontal rule. Three category panels stacked vertically: COMPOSITION (72/100), PROPORTIONS (58/100), LINE QUALITY (81/100), each showing a score badge and 2-3 sentences of categorized feedback text. Below all panels: feedback utility prompt with two buttons (Yes helpful / Not useful). -->

**Key behaviors:**
- Categories shown are whatever the AI returned — not hardcoded to these three
- Score is an auxiliary indicator — the textual feedback is primary
- "Was this critique useful?" feeds the monitoring metric (critique ignore rate)
- Low-confidence path: replaces critique panels with "Could not generate a reliable critique for this image" + Retry button

---

## Screen 4 — Dashboard / History

Overview of all uploads over time. The structural differentiator of Estudio.

```
+------------------+----------------------------------------------+
| ESTUDIO          | My History                   [ + Upload ]    |
|                  | 12 critiques | Sep 2026                       |
|   Upload         |                                              |
| > My History     |  +---------+-----------+---------+---------+ |
|   Settings       |  | Image   | Date      | Top Cat.| Score   | |
|                  |  +---------+-----------+---------+---------+ |
|                  |  | [img]   | Sep 24    | Proport.| 58 /100 | |
| ----------       |  +---------+-----------+---------+---------+ |
|                  |  | [img]   | Sep 18    | Composit| 65 /100 | |
| Free tier        |  +---------+-----------+---------+---------+ |
| 3 of 10 left     |  | [img]   | Sep 11    | Line Q. | 71 /100 | |
|                  |  +---------+-----------+---------+---------+ |
| [ Upgrade ]      |  | [img]   | Sep 04    | Proport.| 54 /100 | |
|                  |  +---------+-----------+---------+---------+ |
|                  |  [show more]                                 |
|                  |                                              |
|                  |  =========================================== |
|                  |  PROGRESS TRENDS (unlock with paid plan)     |
|                  |  =========================================== |
|                  |                                              |
|                  |  Proportions    [### ??? locked chart ###]   |
|                  |  Composition    [### ??? locked chart ###]   |
|                  |  Line Quality   [### ??? locked chart ###]   |
|                  |                                              |
|                  |        [ Upgrade to see your trends ]        |
|                  |                                              |
+------------------+----------------------------------------------+
```

<!-- Text fallback: Desktop layout, sidebar with "My History" active. Main content: page header with upload count and date range, plus "+Upload" shortcut button. Table of past uploads: image thumbnail, date, top-scored category (the one with most room to improve), and score. Below table: "show more" pagination link. Separated by a visual divider: PROGRESS TRENDS section with three locked/blurred chart placeholders (one per category), each showing the category name but hiding the chart content behind an upgrade prompt. "Upgrade to see your trends" button. -->

**Key behaviors:**
- Sorted newest first
- "Top category" = the category with the most consistent observations (not necessarily lowest score)
- Trend section is always visible for free users but charts are locked — this is the SH-1 teaser (Should Have, deferred but designed for)
- Clicking any row opens the Critique View for that upload

---

## Assumptions & Open Questions

- Category taxonomy (what categories appear in Critique View and History) is not yet defined — the wireframes use Composition / Proportions / Line Quality as illustrative examples only. [assumption]
- The score display (xx/100) format is illustrative — the actual scoring format will be determined in Functional Design. [assumption]
- The freemium counter ("3 of 10 left") assumes a 10-upload free tier limit, which has not been confirmed in Functional Design. [assumption]
- The trend section teaser (locked charts) is a Should Have (U14) — included in the wireframe as a design placeholder but deferred from the Must Have build scope. [scope]
