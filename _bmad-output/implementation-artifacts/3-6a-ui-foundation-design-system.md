---
id: "3.6a"
title: "UI Foundation & Design System Setup"
status: review
depends_on: []
touches:
  - frontend/src/lib/content-type-icons.ts
  - frontend/src/lib/toast.ts
  - frontend/src/components/ui/card.tsx
  - frontend/src/components/ui/error-boundary.tsx
  - frontend/src/index.css
  - frontend/src/components/SaveRow.tsx
  - frontend/src/App.tsx
  - frontend/test/components/ui/button.test.tsx
  - frontend/test/components/ui/dialog.test.tsx
  - frontend/test/components/ui/badge.test.tsx
  - frontend/test/components/ui/skeleton.test.tsx
  - frontend/test/components/ui/card.test.tsx
  - frontend/test/components/ui/error-boundary.test.tsx
  - frontend/test/components/ui/toast.test.tsx
  - frontend/test/components/AppLayout.test.tsx
  - frontend/test/components/NavRail.test.tsx
  - frontend/test/components/EmptyState.test.tsx
  - frontend/test/lib/content-type-icons.test.ts
  - frontend/src/components/ThemeToggle.tsx
  - frontend/test/components/ThemeToggle.test.tsx
risk: low
---

# Story 3.6a: UI Foundation & Design System Setup

## Story

As a developer starting the frontend stories,
I want design system decisions locked down and a reusable component foundation in place,
so that Stories 3.7-3.9 can focus on feature logic rather than library choices and styling debates.

## Status: Partially Complete

The Quetzal frontend redesign (PR #273, merged to main) delivered the majority of this story's intent. This story formalizes what was built, closes remaining gaps, and adds the test coverage required by the project's 80% gate.

### What Already Exists (DO NOT RECREATE)

| Component / Feature                        | Location                                                                                                                                    | Status |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Tailwind CSS + design tokens               | `frontend/src/index.css`, `tailwind.config.js`                                                                                              | Done   |
| Light + dark mode themes                   | `frontend/src/index.css` (CSS variables)                                                                                                    | Done   |
| 13 shadcn/Radix UI primitives              | `frontend/src/components/ui/` (button, badge, dialog, input, label, scroll-area, select, separator, sheet, skeleton, sonner, tabs, tooltip) | Done   |
| AppLayout (responsive wrapper)             | `frontend/src/components/AppLayout.tsx`                                                                                                     | Done   |
| NavRail (desktop rail + mobile bottom nav) | `frontend/src/components/NavRail.tsx`                                                                                                       | Done   |
| SaveModal (paste-and-go URL capture)       | `frontend/src/components/SaveModal.tsx`                                                                                                     | Done   |
| DetailPanel (slide-in sheet)               | `frontend/src/components/DetailPanel.tsx`                                                                                                   | Done   |
| SaveRow (list item with type icon)         | `frontend/src/components/SaveRow.tsx`                                                                                                       | Done   |
| EmptyState (library/projects/search)       | `frontend/src/components/EmptyState.tsx`                                                                                                    | Done   |
| Sonner toast (mounted, styled)             | `frontend/src/components/ui/sonner.tsx`                                                                                                     | Done   |
| `cn()` utility                             | `frontend/src/lib/utils.ts`                                                                                                                 | Done   |
| `useIsMobile()` hook                       | `frontend/src/hooks/use-mobile.tsx`                                                                                                         | Done   |
| Inter font + typography scale              | `frontend/src/index.css`                                                                                                                    | Done   |
| Lucide icons (28+ used)                    | Various components                                                                                                                          | Done   |
| Clerk auth integration                     | `frontend/src/main.tsx`, `api/`                                                                                                             | Done   |
| React Query setup                          | `frontend/src/App.tsx`                                                                                                                      | Done   |
| Routing (5 pages)                          | `frontend/src/App.tsx`                                                                                                                      | Done   |

### What Remains (THIS STORY'S SCOPE)

1. **Extract content-type icon mapping** to shared module
2. **Create Card component** (shadcn pattern)
3. **Improve ErrorBoundary** with design-system styling and retry
4. **Create toast helper** with typed variants (success/error/info/undo)
5. **Align color tokens** with UX spec dual-accent palette (Indigo Ink + Quetzal Green)
6. **Wire up dark mode toggle** (`next-themes` already installed, CSS variables already exist)
7. **Add component tests** for all UI primitives and layout components

## Acceptance Criteria

1. **AC1: Dual-accent color palette** — CSS custom properties updated to implement the UX spec dual-accent system: Indigo Ink (`hsl(239, 84%, 57%)`) as UI accent for interactive elements, Quetzal Green (`hsl(162, 83%, 34%)`) reserved for brand moments (save confirmation, success states, logo). Both light and dark mode tokens defined. Existing `--accent` and `--brand` variables repurposed to match spec.

2. **AC2: Toast helper with typed variants** — A `toast` helper module (`frontend/src/lib/toast.ts`) wrapping Sonner's `toast()` with typed functions: `showToast.success(message)`, `showToast.error(message)`, `showToast.info(message)`, `showToast.undo(message, onUndo)`. Success uses Quetzal Green glow. Errors persist until dismissed. Info auto-dismisses at 5s. Undo shows action button that calls the provided callback.

3. **AC3: Content-type icon mapping extracted** — Content-type-to-icon mapping extracted from `SaveRow.tsx` into `frontend/src/lib/content-type-icons.ts` as an exported `CONTENT_TYPE_ICONS` constant. Mapping covers all types from UX spec: `video`, `podcast`, `article`, `github_repo`, `repository`, `newsletter`, `tool`, `reddit`, `linkedin`, `course`, `documentation`, `other`. Each maps to a Lucide icon component. Also exports `type ContentType = keyof typeof CONTENT_TYPE_ICONS` for type-safe usage in filters and components. `SaveRow.tsx` refactored to import from the shared module.

4. **AC4: Card component created** — A `Card` component added at `frontend/src/components/ui/card.tsx` following shadcn conventions (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter). General-purpose primitive for project cards, settings panels, and detail views in Stories 3.7-3.9. Note: saves list uses SaveRow (ultra-compact list per UX spec), not Card.

5. **AC5: ErrorBoundary with design-system styling** — ErrorBoundary component extracted to `frontend/src/components/ui/error-boundary.tsx` as a reusable, styled component. Renders a centered error message with destructive color, a "Try again" button (calls `this.setState({ hasError: false })`), and an optional `onError` callback prop. Replaces the inline class component in `App.tsx`.

6. **AC6: Dark mode toggle** — `next-themes` `ThemeProvider` wired into `App.tsx` with `attribute="class"` (matching existing Tailwind `darkMode: ["class"]` config), `defaultTheme="system"`, and `storageKey="alh-theme"`. A `ThemeToggle` button (Sun/Moon icon from Lucide) added to NavRail. Respects `prefers-color-scheme` by default with manual override persisted to localStorage.

7. **AC7: Component test coverage** — Component tests written for existing primitives (Button, Dialog, Badge, Skeleton, AppLayout, NavRail, EmptyState) and new components created in this story (Card, ErrorBoundary, toast helper, content-type icons, ThemeToggle). Tests include keyboard navigation and ARIA assertions where applicable (Dialog focus trap, Button keyboard activation, ErrorBoundary retry via keyboard). Tests use Vitest + Testing Library. Coverage meets 80% threshold for touched files.

## Tasks / Subtasks

- [x] Task 1: Align color tokens with UX spec dual-accent palette (AC: 1)
  - [x] 1.1 Update `--accent` in `index.css` to Indigo Ink hsl values for both light/dark
  - [x] 1.2 Ensure `--brand` maps to Quetzal Green (already close, verify exact values)
  - [x] 1.3 Add `--accent-soft` for indigo hover/selected states
  - [x] 1.4 Verify button variants use accent (indigo) not brand (quetzal) for primary
  - [x] 1.5 Verify destructive stays red, success uses brand/quetzal

- [x] Task 2: Extract content-type icon mapping (AC: 3)
  - [x] 2.1 Create `frontend/src/lib/content-type-icons.ts` with `CONTENT_TYPE_ICONS` map
  - [x] 2.2 Include all types: video, podcast, article, github_repo, repository, newsletter, tool, reddit, linkedin, course, documentation, other
  - [x] 2.3 Export `type ContentType = keyof typeof CONTENT_TYPE_ICONS` for type-safe usage
  - [x] 2.4 Add `getContentTypeIcon(type: string)` function returning icon component + fallback
  - [x] 2.5 Refactor `SaveRow.tsx` to import from shared module (delete inline `TYPE_ICONS`)
  - [x] 2.6 Write test: all known types resolve, unknown type returns fallback (Link2)

- [x] Task 3: Create Card component (AC: 4)
  - [x] 3.1 Add `frontend/src/components/ui/card.tsx` with shadcn Card pattern
  - [x] 3.2 Exports: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
  - [x] 3.3 Write test: renders with children, header/content/footer compose correctly

- [x] Task 4: Improve ErrorBoundary (AC: 5)
  - [x] 4.1 Create `frontend/src/components/ui/error-boundary.tsx` as styled reusable component
  - [x] 4.2 Style with design tokens: destructive color, centered layout, "Try again" button
  - [x] 4.3 Add `onError` callback prop for error reporting
  - [x] 4.4 Replace inline ErrorBoundary in `App.tsx` with new component
  - [x] 4.5 Write test: catches thrown error, shows message, retry resets state

- [x] Task 5: Create toast helper (AC: 2)
  - [x] 5.1 Create `frontend/src/lib/toast.ts` wrapping Sonner
  - [x] 5.2 Implement `showToast.success()` with Quetzal Green styling
  - [x] 5.3 Implement `showToast.error()` that persists until dismissed
  - [x] 5.4 Implement `showToast.info()` with 5s auto-dismiss
  - [x] 5.5 Implement `showToast.undo(message, onUndo)` with action button
  - [x] 5.6 Refactor `SaveModal.tsx` to use `showToast.success()` instead of raw `toast()`
  - [x] 5.7 Write test: each variant calls sonner with correct options

- [x] Task 6: Wire up dark mode toggle (AC: 6)
  - [x] 6.1 Add `<ThemeProvider attribute="class" defaultTheme="system" storageKey="alh-theme">` in `App.tsx`
  - [x] 6.2 Create `frontend/src/components/ThemeToggle.tsx` — Sun/Moon icon button using `useTheme()` from next-themes
  - [x] 6.3 Add ThemeToggle to NavRail (bottom of rail on desktop, end of bottom nav on mobile)
  - [x] 6.4 Write test: toggles between light/dark/system, icon changes accordingly

- [x] Task 7: Tests for existing components (AC: 7)
  - [x] 7.1 `frontend/test/components/ui/button.test.tsx` — renders all variants, click handler fires, disabled state, keyboard activation
  - [x] 7.2 `frontend/test/components/ui/dialog.test.tsx` — opens/closes, ESC dismisses, focus management
  - [x] 7.3 `frontend/test/components/ui/badge.test.tsx` — renders all variants including project status badges
  - [x] 7.4 `frontend/test/components/ui/skeleton.test.tsx` — renders with pulse animation class
  - [x] 7.5 `frontend/test/components/AppLayout.test.tsx` — renders NavRail + main content area
  - [x] 7.6 `frontend/test/components/NavRail.test.tsx` — renders nav items, active state, responsive behavior
  - [x] 7.7 `frontend/test/components/EmptyState.test.tsx` — renders each variant (library, projects, search)

## Dev Notes

### Architecture Compliance

- **Component library:** shadcn/ui (copy-paste pattern) + Radix UI + Tailwind CSS. This is locked — do not introduce another component library.
- **Icons:** Lucide React. Do not add a second icon library.
- **Toast:** Sonner. The `showToast` helper wraps it; do not replace Sonner.
- **State:** React Query for server state, React Context for app state (via `useApp()`). No Redux, Zustand, or Jotai.
- **Styling:** Tailwind utility classes + CSS custom properties in `index.css`. No CSS modules, styled-components, or emotion.

### UX Spec Alignment — Dual-Accent Color System

The UX spec (`_bmad-output/planning-artifacts/ux-design-specification.md` Section 8) defines a dual-accent system:

- **Indigo Ink** (`hsl(239, 84%, 57%)`) — UI accent for buttons, links, selected states, interactive elements
- **Quetzal Green** (`hsl(162, 83%, 34%)`) — Brand accent used surgically: save confirmation toast, success states, logo mark only

Current implementation uses Quetzal Green as the primary/accent color for everything (buttons, nav active states). Task 1 corrects this to match the spec: interactive elements use Indigo, brand moments use Quetzal Green.

**Important:** The `--accent` variable cascades through every component using `bg-accent`, `text-accent`, `ring-accent`, etc. After changing tokens, run the app and verify both light and dark mode visually — button colors, nav active states, focus rings, hover states all shift from green to indigo.

**Quetzal Green usage rules (from UX spec):**

- Save confirmation toast (primary brand moment)
- Success states (project created, tutorial completed)
- Logo mark
- **Never** buttons, backgrounds, borders, hover states, navigation

### Content-Type Icon Mapping (Full Spec)

From epic plan + UX spec, the complete mapping:

| Content Type                 | Lucide Icon     | Notes                      |
| ---------------------------- | --------------- | -------------------------- |
| `video`                      | `Video`         | YouTube, Vimeo, etc.       |
| `podcast`                    | `Podcast`       | Audio content              |
| `article`                    | `FileText`      | Blog posts, articles       |
| `github_repo` / `repository` | `Github`        | GitHub repos               |
| `newsletter`                 | `Mail`          | Email newsletters          |
| `tool`                       | `Wrench`        | Developer tools            |
| `reddit`                     | `MessageSquare` | Reddit posts/threads       |
| `linkedin`                   | `Linkedin`      | LinkedIn posts             |
| `course`                     | `GraduationCap` | Online courses             |
| `documentation`              | `BookOpen`      | API docs, guides           |
| `other`                      | `Link2`         | Fallback for unknown types |

### Testing Approach

- **Framework:** Vitest + @testing-library/react + @testing-library/user-event (already installed)
- **Test location:** `frontend/test/` (matches existing pattern from `App.test.tsx`, `api/client.test.ts`)
- **Coverage:** 80% threshold enforced. Focus on behavior, not implementation details.
- **Mocking:** For toast tests, mock `sonner` module. For ErrorBoundary, use a component that throws.
- **Accessibility assertions:** Use `screen.getByRole()`, verify `aria-*` attributes, test keyboard interactions with `userEvent.keyboard()`.

### File Structure (After Story Completion)

```
frontend/src/
├── components/
│   ├── ui/
│   │   ├── badge.tsx          (existing)
│   │   ├── button.tsx         (existing)
│   │   ├── card.tsx           (NEW)
│   │   ├── dialog.tsx         (existing)
│   │   ├── error-boundary.tsx (NEW — replaces inline in App.tsx)
│   │   ├── input.tsx          (existing)
│   │   ├── label.tsx          (existing)
│   │   ├── scroll-area.tsx    (existing)
│   │   ├── select.tsx         (existing)
│   │   ├── separator.tsx      (existing)
│   │   ├── sheet.tsx          (existing)
│   │   ├── skeleton.tsx       (existing)
│   │   ├── sonner.tsx         (existing)
│   │   ├── tabs.tsx           (existing)
│   │   └── tooltip.tsx        (existing)
│   ├── AppLayout.tsx          (existing)
│   ├── DetailPanel.tsx        (existing)
│   ├── EmptyState.tsx         (existing)
│   ├── NavRail.tsx            (existing, MODIFIED — add ThemeToggle)
│   ├── SaveModal.tsx          (existing, refactored to use showToast)
│   ├── SaveRow.tsx            (existing, refactored to use CONTENT_TYPE_ICONS)
│   └── ThemeToggle.tsx        (NEW)
├── lib/
│   ├── content-type-icons.ts  (NEW)
│   ├── toast.ts               (NEW)
│   ├── mock-data.ts           (existing)
│   ├── store.tsx              (existing)
│   ├── types.ts               (existing)
│   └── utils.ts               (existing)
├── index.css                  (MODIFIED — dual-accent tokens)
└── App.tsx                    (MODIFIED — use new ErrorBoundary + ThemeProvider)

frontend/test/
├── components/
│   ├── ui/
│   │   ├── button.test.tsx    (NEW)
│   │   ├── dialog.test.tsx    (NEW)
│   │   ├── badge.test.tsx     (NEW)
│   │   ├── skeleton.test.tsx  (NEW)
│   │   ├── card.test.tsx      (NEW)
│   │   ├── error-boundary.test.tsx (NEW)
│   │   └── toast.test.tsx     (NEW)
│   ├── AppLayout.test.tsx     (NEW)
│   ├── NavRail.test.tsx       (NEW)
│   ├── EmptyState.test.tsx    (NEW)
│   └── ThemeToggle.test.tsx   (NEW)
├── lib/
│   └── content-type-icons.test.ts (NEW)
├── api/
│   ├── client.test.ts         (existing)
│   └── hooks.test.ts          (existing)
└── App.test.tsx               (existing)
```

### Project Structure Notes

- All new components follow existing shadcn/Radix patterns (forwardRef, cn() for className merging, CVA for variants)
- Test files mirror source tree under `frontend/test/` (established convention)
- No new dependencies needed — all libraries already installed
- Color token changes in `index.css` will cascade through all components using `--accent` / `--brand` variables
- `next-themes` is already installed — Task 6 wires it up with `ThemeProvider` and a toggle button

### Card vs SaveRow — UX Spec Tension

The original epic plan (Story 3.7 AC6) calls for "card grid on desktop, single-column list on mobile." However, the UX spec (Section E) explicitly chose **Direction C (Ultra-Compact List)** and **dropped Direction A (card grid)** as "too generic." The SaveRow component already implements the chosen direction. The Card component is still included here as a general-purpose shadcn primitive (useful for project cards, settings panels, etc.) but **Story 3.7 should use SaveRow for the saves list, not Card**. The dev agent for 3.7 should reference the UX spec, not the older epic plan, for layout decisions.

### Dark Mode — Implementation Notes

UX spec (Section 8) specifies: "`prefers-color-scheme` default, manual toggle override, localStorage persistence." This is exactly what `next-themes` provides out of the box. The `attribute="class"` setting matches Tailwind's `darkMode: ["class"]` config. The toggle cycles: system → light → dark. No additional dark mode CSS work needed — all dark mode tokens already exist in `index.css`.

### Out of Scope — Agent-Friendly Web Surface

The UX spec (Section D) defines agent-friendly features: `llms.txt`, `llms-full.txt`, `?format=md` query param on guides, JSON-LD structured data, semantic HTML, and `GET /openapi.json`. These are backend/infra/content concerns, not UI foundation. They should be tracked as a separate future story (likely in a Guides/Documentation epic or as part of Epic 3.2 agent-native patterns).

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#8-Component-System] — Component tier list, shadcn inventory, custom component specs
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual-Design-Tokens] — Dual-accent palette, typography, spacing
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Quetzal-Green-Usage-Rules] — Brand color restrictions
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button-Hierarchy] — Button variant → color mapping
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#E-Design-Direction-Reference] — Direction C chosen (ultra-compact list), Direction A (card grid) dropped
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#D-Agent-Friendly-Web-Surface] — llms.txt, JSON-LD, ?format=md (out of scope, noted for future)
- [Source: docs/progress/epic-3-stories-and-plan.md#Story-3.6a] — Original AC definitions, file list, test requirements
- [Source: frontend/src/components/SaveRow.tsx] — Inline TYPE_ICONS to extract
- [Source: frontend/src/App.tsx] — Inline ErrorBoundary to extract
- [Source: frontend/src/components/ui/sonner.tsx] — Current toast wrapper

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- All 7 tasks completed with TDD approach
- Color tokens: --primary/--accent → Indigo Ink, --brand → Quetzal Green, light + dark modes
- Content-type icons: shared module with 12 types, SaveRow refactored
- Card component: 6 exports following shadcn conventions
- ErrorBoundary: extracted from App.tsx, design tokens, retry, onError callback
- Toast helper: success/error/info/undo variants, SaveModal refactored
- Dark mode: ThemeProvider in App.tsx, ThemeToggle in NavRail
- 79 tests across 15 files, all passing. Coverage: 99.51%. Lint + type-check clean.

### Change Log

- 2026-03-11: Story created. Recognized existing Quetzal redesign (PR #273) as partial completion. Scoped remaining work to gap closure: dual-accent palette alignment, content-type icon extraction, Card component, ErrorBoundary upgrade, toast helper, dark mode toggle, and comprehensive component test coverage.
- 2026-03-11: Elicitation rounds — Persona focus group (practical toast/icon feedback), Critique & Refine (removed redundant AC1, merged AC8 into tests, restructured tasks). Added dark mode toggle (AC6/Task 6). Added Card vs SaveRow UX spec tension note. Noted agent-friendly web surface as out-of-scope future work.
- 2026-03-11: Implementation completed — all 7 tasks, all 7 ACs satisfied.

### File List

- frontend/src/index.css (MODIFIED)
- frontend/src/App.tsx (MODIFIED)
- frontend/src/components/SaveRow.tsx (MODIFIED)
- frontend/src/components/SaveModal.tsx (MODIFIED)
- frontend/src/components/NavRail.tsx (MODIFIED)
- frontend/src/lib/content-type-icons.ts (NEW)
- frontend/src/lib/toast.ts (NEW)
- frontend/src/components/ui/card.tsx (NEW)
- frontend/src/components/ui/error-boundary.tsx (NEW)
- frontend/src/components/ThemeToggle.tsx (NEW)
- frontend/test/lib/content-type-icons.test.ts (NEW)
- frontend/test/components/ui/card.test.tsx (NEW)
- frontend/test/components/ui/error-boundary.test.tsx (NEW)
- frontend/test/components/ui/toast.test.tsx (NEW)
- frontend/test/components/ui/button.test.tsx (NEW)
- frontend/test/components/ui/dialog.test.tsx (NEW)
- frontend/test/components/ui/badge.test.tsx (NEW)
- frontend/test/components/ui/skeleton.test.tsx (NEW)
- frontend/test/components/AppLayout.test.tsx (NEW)
- frontend/test/components/NavRail.test.tsx (NEW)
- frontend/test/components/EmptyState.test.tsx (NEW)
- frontend/test/components/ThemeToggle.test.tsx (NEW)
