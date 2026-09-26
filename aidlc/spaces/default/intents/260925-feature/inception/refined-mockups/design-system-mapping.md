# Design System Mapping — Estudio MVP

> **Stack:** Tailwind CSS v3 + shadcn/ui (React + TypeScript)
> Maps UI elements in mockups.md to specific shadcn/ui components.

## shadcn/ui Component Mapping

| UI Element | shadcn/ui Component | Notes |
|---|---|---|
| Page layout card | `Card`, `CardContent`, `CardHeader` | Onboarding full-page card |
| Navigation sidebar | `Sheet` (desktop) or custom `nav` | Fixed left panel; no shadcn standard sidebar — custom CSS |
| Checkboxes | `Checkbox` + `Label` | Onboarding gate; controlled state |
| Primary button | `Button` variant `default` | "Get Started", "Upgrade", "Browse file" |
| Disabled button | `Button` with `disabled` prop | "Get Started" before all checkboxes checked |
| Drop zone | Custom div with Tailwind states | No shadcn equivalent; use `react-dropzone` library |
| Progress indicator | `Progress` | Upload in-progress state |
| Score badge | `Badge` | Color variants: `destructive` (<50), `warning` (50-74), `default` (≥75) |
| Table (history) | `Table`, `TableRow`, `TableCell` | History table in Dashboard |
| Tooltip | `Tooltip`, `TooltipContent` | "Focus area" column tooltip |
| Separator | `Separator` | Between sections in Critique View |
| Avatar/thumbnail | Custom `img` with `AspectRatio` | Upload thumbnails in history and critique view |
| Alert | `Alert`, `AlertDescription` | Low-confidence error message (3B) |
| Navigation link | `Button` variant `ghost` or `Link` | Sidebar navigation items |

## Color Tokens (Tailwind)

| Purpose | Token | Hex approx. |
|---|---|---|
| Primary action | `blue-600` | #2563EB |
| Primary hover | `blue-700` | #1D4ED8 |
| Score: good (≥75) | `green-600` | #16A34A |
| Score: medium (50-74) | `yellow-600` | #CA8A04 |
| Score: needs work (<50) | `red-600` | #DC2626 |
| Deferred badge | `orange-500` | #F97316 |
| Background | `gray-50` | #F9FAFB |
| Surface (cards) | `white` | #FFFFFF |
| Border | `gray-200` | #E5E7EB |
| Text primary | `gray-900` | #111827 |
| Text secondary | `gray-500` | #6B7280 |

## Typography (Tailwind)

| Element | Class |
|---|---|
| Page heading | `text-2xl font-semibold text-gray-900` |
| Section heading | `text-lg font-medium text-gray-900` |
| Category label | `text-sm font-semibold text-gray-700 uppercase tracking-wide` |
| Body text | `text-sm text-gray-600` |
| Caption | `text-xs text-gray-400` |

## Spacing

- Sidebar width: `w-64` (256px)
- Main content horizontal padding: `px-8`
- Card internal padding: `p-6`
- Section gap: `gap-6`

## Assumptions & Open Questions

- `react-dropzone` is the recommended library for the file drop zone — this adds a dependency to be declared in Functional Design. [assumption]
- The `Badge` warning variant may require a custom Tailwind plugin if shadcn/ui does not ship a `warning` color by default. [assumption]
- The sidebar component will be custom-built rather than using a shadcn/ui preset, as shadcn does not ship a fixed-width sidebar component. [assumption]
