# Interaction Spec — Estudio MVP

> Behavioral specifications for interactive components. Supplements mockups.md.

## Drop Zone (Upload Screen 2A)

| Interaction | Behavior |
|---|---|
| Hover | Border changes to `blue-400`; background to `blue-50` |
| Drag enter | Border changes to `blue-600` dashed; "Drop to upload" text replaces copy |
| Drag leave | Returns to default state |
| Drop valid file | Triggers upload immediately; drop zone shows progress ring |
| Drop invalid type | Inline error below zone: "Only JPEG, PNG, and WebP files are accepted" |
| Drop oversized file | Inline error: "File too large — maximum 10 MB" |
| Browse file click | Opens OS file picker filtered to image types |
| Upload in progress | Drop zone replaced by progress indicator; Back navigation disabled |
| Upload complete | Redirect to Critique View (Screen 3A or 3B based on confidence) |

## Category Panels (Critique View 3A)

| Interaction | Behavior |
|---|---|
| Hover | Subtle `gray-50` background on the panel row |
| Score badge | Non-interactive; color-coded: ≥75 green, 50-74 yellow, <50 red |
| Panel body | Static text; no expand/collapse in MVP |

## History Table (Dashboard 4)

| Interaction | Behavior |
|---|---|
| Row click | Navigates to Critique View for that upload |
| Row hover | Row background `gray-50` |
| "Show all" click | Loads additional rows (pagination); no separate page |
| Focus area column | Tooltip on hover: "The category with the most room to improve in this upload" |

## Onboarding Checkboxes

| Interaction | Behavior |
|---|---|
| Checkbox click | Toggles checked state; re-evaluates button disabled state |
| All 3 checked | "Get Started" button activates (primary blue, hover effect) |
| Any unchecked | "Get Started" remains `disabled`; cursor not-allowed |

## Navigation (Sidebar)

| Item | Target |
|---|---|
| Upload | Upload screen (2A or 2B based on counter) |
| My History | Dashboard (4) |
| Settings | Settings screen (not wireframed in MVP; renders data policy + delete action) |

## Utility Vote (Critique View)

| Interaction | Behavior |
|---|---|
| "Yes" click | Button turns green; "No" dims; vote stored per upload |
| "No" click | Button turns red; "Yes" dims; vote stored per upload |
| Second click same | No toggle; vote is permanent per upload |
| Already voted | Buttons show current vote state on page load |

## Error States

| Context | Error display |
|---|---|
| Invalid file type/size | Inline below drop zone; red `text-sm`; no toast |
| API timeout (>30s) | Critique View shows 3B (low-confidence) with "Analysis timed out" reason |
| Network error during upload | Inline error in drop zone: "Upload failed — check your connection and try again" |
| Login failure | Inline error below password field: "Incorrect email or password" |
| Duplicate email on register | Inline error below email field: "An account with this email already exists" |

## Transitions

| Transition | Duration | Easing |
|---|---|---|
| Page-to-page navigation | 150ms | ease-in-out |
| Drop zone state changes | 100ms | ease |
| Score badge appearance in Critique View | 200ms staggered (50ms per category) | ease-out |
| "Get Started" button enable | 100ms | ease |
