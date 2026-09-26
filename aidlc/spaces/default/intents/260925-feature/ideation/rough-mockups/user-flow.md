# User Flow — Estudio MVP

> **Upstream references:** [intent] [scope] [backlog]

## Primary User Flow (Happy Path)

The core loop for Ana: upload a drawing, get a categorized critique, see it accumulate in her history over time.

```
[First Launch]
     |
     v
[Onboarding Gate] -- (all 3 boxes checked) --> [Get Started]
     |                                               |
     |                                               v
     |                                        [Upload Screen]
     |                                               |
     |                                    (drag image / browse)
     |                                               |
     |                                               v
     |                                    [Processing... (API call)]
     |                                               |
     |                          +-----------+--------+-----------+
     |                          |                               |
     |                          v                               v
     |                 [Critique View]             [Low Confidence Error]
     |                  (success path)               (fallback path)
     |                          |                               |
     |                          v                               v
     |                 [Was this useful?]            [Cannot generate critique]
     |                  (thumbs up/down)             [Reason + Retry]
     |                          |                               |
     |                          v                               |
     |                 [Dashboard / History]  <-----------------+
     |                          |                    (on retry or dismiss)
     +------------------------->+
      (subsequent sessions
       land directly here)
```

<!-- Text fallback: Linear flow starting at First Launch. First-time users go to Onboarding Gate, which requires completing all 3 checkboxes before proceeding. After Get Started, user lands on Upload Screen. After selecting and submitting an image, the system enters a Processing state (calling Claude API). On success: Critique View showing categorized feedback with usefulness prompt. On low-confidence failure: explicit error screen with reason and Retry option. After viewing critique (or dismissing error), user goes to Dashboard/History. On subsequent sessions, the flow starts at Upload Screen (onboarding is skipped). -->

---

## Freemium Gate Flow

The conversion trigger: free tier upload limit reached.

```
[Upload Screen]
     |
     v
[Free Tier Limit Reached]
     |
     v
[Upgrade Prompt in Drop Zone]
"You've used all 10 free uploads this month.
 Upgrade to continue uploading."
     |
     v
[Upgrade / Pricing Page]       [Skip / View History]
     |
     v
[Mock Payment (stub)]
     |
     v
[Paid Tier Activated]
     |
     v
[Upload Screen]
(counter removed, trend charts unlocked in history)
```

<!-- Text fallback: When the free upload counter reaches zero, the drop zone on the Upload screen shows an upgrade message instead of the drag-and-drop area. User can go to an Upgrade page or skip to view their existing history. Mock payment is a single button click that immediately activates paid tier. After activation, user returns to Upload screen with no counter, and the locked trend charts in Dashboard become visible. -->

---

## Data Deletion Flow

Accessible from Settings at any time.

```
[Settings Page]
     |
     v
[My Data section]
"Delete my upload history"
     |
     v
[Confirmation Dialog]
"This will permanently delete all your
 images, critiques, and trend history.
 This cannot be undone."
     |
     +-------------- [Cancel] (back to Settings)
     |
     v
  [Type DELETE to confirm]
     |
     v
[All data deleted / Account remains]
     |
     v
[Upload Screen]
(empty state: "Start fresh with a new upload")
```

<!-- Text fallback: From Settings page, user accesses "Delete my upload history" option. Confirmation dialog explains the permanent and complete nature of the deletion. User must type "DELETE" to confirm. After deletion, account persists but all images, critiques, and trend calculations are removed. User lands on Upload screen in empty state. -->

---

## Error States

| State | Trigger | What user sees | Next action |
|---|---|---|---|
| Low-confidence critique | Claude API returns confidence below threshold | Explicit message: "Couldn't generate a reliable critique for this image" + reason (out of domain, too small, etc.) | Retry upload or dismiss to Dashboard |
| Upload rejected | Wrong format or file too large | Inline error in the drop zone | Correct and re-upload |
| API timeout | Claude API does not respond in time | "Analysis took too long" + retry | Retry (idempotent) |
| Free tier limit | Upload counter at 0 | Upgrade prompt replaces drop zone | Upgrade or view history |
| Session expired | Auth token expired | Redirect to login | Log in and return |

---

## Assumptions & Open Questions

- The onboarding gate fires once per account, not once per session. If the user creates a new account, it fires again. [assumption]
- "Low confidence threshold" for the critique fallback is not yet defined — this is a Functional Design decision. [assumption]
- The Settings / Data Policy page is not included in these rough mockups (Q2=B selected happy path only); it is sketched in the flow but not wireframed. [scope]
