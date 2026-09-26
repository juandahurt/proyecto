# Accessibility Checklist — Estudio MVP

> **Target:** WCAG 2.1 AA (all screens)
> **Status:** Design-time requirements — verified during Build and Test.

## 1. Keyboard Navigation

| Requirement | Screen | Status |
|---|---|---|
| All interactive elements reachable via Tab | All | Design requirement |
| Tab order follows visual reading order (left-to-right, top-to-bottom) | All | Design requirement |
| Sidebar navigation items navigable with arrow keys | All | Design requirement |
| Drop zone activatable with Space/Enter when focused | Upload (2A) | Design requirement |
| "Browse file" button standard keyboard-activatable | Upload (2A) | Design requirement |
| Table rows navigable with arrow keys | Dashboard (4) | Design requirement |
| Checkboxes activatable with Space when focused | Onboarding (1) | Design requirement |
| Modal/dialog (confirmation) traps focus | Delete confirmation | Design requirement |

## 2. Screen Reader (ARIA)

| Requirement | Screen | ARIA implementation |
|---|---|---|
| Upload counter announced on change | Upload sidebar | `aria-live="polite"` on counter element |
| Drop zone role and state | Upload (2A) | `role="region"` + `aria-label="Image upload area"` |
| Drag-and-drop state change | Upload (2A) | `aria-label` updates on drag enter/leave |
| Score badges include text alternative | Critique View (3A) | `aria-label="72 out of 100"` on score badges |
| Low-confidence alert announced | Critique View (3B) | `role="alert"` or `aria-live="assertive"` |
| Table headers labelled | Dashboard (4) | `<th scope="col">` on all column headers |
| "Focus area" tooltip accessible | Dashboard (4) | `aria-describedby` linking tooltip content |
| Disabled "Get Started" accessible | Onboarding (1) | `aria-disabled="true"` + `aria-describedby` explaining requirement |
| Images have meaningful alt text | All thumbnails | `alt="Drawing uploaded on [date]"` |

## 3. Color and Contrast

| Requirement | WCAG criterion | Notes |
|---|---|---|
| Text on white background ≥ 4.5:1 | 1.4.3 AA | Primary text `gray-900` on `white` — passes |
| Secondary text `gray-500` on white ≥ 4.5:1 | 1.4.3 AA | #6B7280 on white = 4.6:1 — passes |
| Score badge text on colored background ≥ 3:1 (large text) | 1.4.3 AA | Verify green/yellow/red badge text contrast |
| Score badge text ≥ 4.5:1 (small text) | 1.4.3 AA | Badges use `text-sm` — must verify each color |
| Focus indicator visible (not color-only) | 1.4.1, 2.4.7 | shadcn/ui default focus ring: `ring-2 ring-blue-500` |
| Error states not conveyed by color alone | 1.4.1 | Error messages include icon + text, not just red color |

## 4. Focus Management

| Requirement | Trigger | Expected behavior |
|---|---|---|
| After upload completes | Upload → Critique View | Focus moves to Critique View heading |
| After "Back" navigation | Critique View → History | Focus moves to the row in the history table for the critique just viewed |
| On modal open (delete confirmation) | Settings → Delete confirm | Focus trapped inside modal; first focus on heading |
| On modal close (cancel) | Modal → Settings | Focus returns to "Delete my history" button |

## 5. Forms

| Requirement | Form | Implementation |
|---|---|---|
| Labels associated with inputs | Register/Login (not wireframed in MVP) | `<label for>` or `aria-labelledby` |
| Error messages linked to field | Register/Login, Upload | `aria-describedby` linking error text to input |
| Required fields indicated | Register/Login | `aria-required="true"` + visual indicator |
| Password input type | Register/Login | `<input type="password">` |

## 6. Images and Media

| Requirement | Application |
|---|---|
| All decorative images have `alt=""` | Logo graphic |
| All functional images have descriptive alt | Uploaded drawing thumbnails |
| AI critique text is plain text | Critique View — no image-only content |

## Known Gaps at Design Time

| Gap | Priority | Resolution |
|---|---|---|
| Delete confirmation dialog is not wireframed | Medium | Spec in Functional Design; must include focus trap |
| Settings screen not wireframed | Medium | Spec in Functional Design; must include accessible data policy link |
| Color contrast of score badges (green/yellow/red) not verified | High | Verify against shadcn/ui Badge color values before coding |
| Mobile keyboard behavior (not primary target) | Low | Responsive considerations deferred to Build and Test |
