# Epic 9: Theming & UI Polish

**Epic ID:** EPIC-09
**Created:** 2026-02-21
**Total Story Points:** 8
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

Epic 9 implements light/dark mode theming with CSS custom properties, theme persistence in localStorage, and the overall Notion-inspired visual aesthetic through a consistent design system. The theming system uses Tailwind 4's dark mode class strategy, toggling the `dark` class on the `<html>` element. All color values are defined as CSS custom properties, enabling a single source of truth for the entire color palette across both themes.

The design system story delivers a set of shared UI primitives (Button, Input, Modal, Dropdown, Toast, Skeleton, Tooltip) that enforce visual consistency across all existing and future components.

This epic covers FR52-54 (theming and visual design).

---

## Business Value

- Light/dark mode is a baseline user expectation for modern productivity tools — its absence is perceived as unfinished
- CSS custom properties enable theming without runtime JavaScript, eliminating the flash-of-wrong-theme problem
- A shared design system reduces visual inconsistency across the application and accelerates future feature development by providing ready-made primitives
- Persisting theme preference in localStorage respects user choice across sessions without requiring server-side storage

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│                                                             │
│  <html class="dark">  ◄── toggled by ThemeToggle           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  globals.css                                          │  │
│  │                                                       │  │
│  │  :root {                                              │  │
│  │    --color-bg-primary: #ffffff;                        │  │
│  │    --color-bg-secondary: #f7f7f5;                     │  │
│  │    --color-text-primary: #37352f;                      │  │
│  │    --color-text-secondary: #787774;                    │  │
│  │    --color-border: #e9e9e7;                            │  │
│  │    --color-accent: #2eaadc;                            │  │
│  │    ...                                                │  │
│  │  }                                                    │  │
│  │                                                       │  │
│  │  .dark {                                              │  │
│  │    --color-bg-primary: #191919;                        │  │
│  │    --color-bg-secondary: #202020;                      │  │
│  │    --color-text-primary: #ffffffcf;                    │  │
│  │    --color-text-secondary: #ffffff71;                  │  │
│  │    --color-border: #ffffff18;                          │  │
│  │    --color-accent: #529cca;                            │  │
│  │    ...                                                │  │
│  │  }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │ ThemeToggle  │    │ localStorage                      │  │
│  │ component    │───▶│ key: "symbio-theme"               │  │
│  │ (sun/moon)   │    │ value: "light" | "dark" | "system"│  │
│  └──────────────┘    └──────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Inline <script> in <head> (layout.tsx)               │  │
│  │  - Reads localStorage before paint                    │  │
│  │  - Applies "dark" class if needed                     │  │
│  │  - Prevents flash of wrong theme (FOWT)               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Design System Components                             │  │
│  │  Button │ Input │ Modal │ Dropdown │ Toast │          │  │
│  │  Skeleton │ Tooltip                                   │  │
│  │  All styled with Tailwind + CSS custom properties     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-09.1: Light/Dark Mode with Theme Persistence — 5 points, High

**Delivers:** `ThemeToggle` component (`components/ui/ThemeToggle.tsx`) with three states: light, dark, system (follows OS preference via `prefers-color-scheme`). Clicking cycles through: light -> dark -> system -> light. CSS custom properties defined in `globals.css` under `:root` (light) and `.dark` (dark) selectors covering: background colors (primary, secondary, tertiary), text colors (primary, secondary, muted), border colors, accent color, hover/active states, shadow values. Tailwind config extended to reference CSS custom properties via `theme.extend.colors`. An inline `<script>` tag in the root `layout.tsx` `<head>` that reads `localStorage.getItem("symbio-theme")` and applies the `dark` class before first paint to prevent FOWT (flash of wrong theme). Theme preference stored under `localStorage` key `"symbio-theme"` with values `"light"`, `"dark"`, or `"system"`. `useTheme` hook (`hooks/useTheme.ts`) providing `theme`, `setTheme`, and `resolvedTheme` (actual applied theme when set to system).

**Depends on:** SKB-01.4 (application shell and global CSS must exist)

---

### SKB-09.2: Notion-Inspired UI Design System — 3 points, Medium

**Delivers:** A set of shared, reusable UI components styled to a Notion-inspired aesthetic, all using Tailwind utility classes and CSS custom properties exclusively. Components delivered:
- `Button` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg; loading state with spinner
- `Input` — text input with label, placeholder, error state, disabled state
- `Modal` — overlay with backdrop blur, header/body/footer slots, close on Escape and backdrop click, focus trap
- `Dropdown` — trigger + menu with items, keyboard navigation (arrow keys, Enter, Escape), portal-rendered
- `Toast` — notification system with success/error/info variants, auto-dismiss (5s), stack from bottom-right, `useToast` hook for imperative usage
- `Skeleton` — loading placeholder with shimmer animation for text lines, cards, and table rows
- `Tooltip` — hover-triggered tooltip with configurable placement (top, right, bottom, left), portal-rendered

Typography scale: consistent heading sizes (h1-h4), body text, small text, all using `font-sans` with system font stack. Spacing system using Tailwind's default 4px grid. Color palette uses the CSS custom properties from SKB-09.1.

**Depends on:** SKB-09.1 (theme system and CSS custom properties must be in place)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 09.1 | ThemeToggle cycles through states; useTheme returns correct values; localStorage is read/written | - | Toggle theme, page updates colors; reload page, theme persists; no FOWT on load |
| 09.2 | Each component renders all variants; Modal traps focus; Dropdown navigates with keyboard; Toast auto-dismisses | - | Button click interactions; Modal open/close; Toast appears and disappears |

---

## Implementation Order

```
09.1 → 09.2 (strictly sequential)

┌────────┐     ┌────────┐
│ 09.1   │────▶│ 09.2   │
│ Theme  │     │ Design │
│ System │     │ System │
└────────┘     └────────┘
```

---

## Shared Constraints

- All UI components use Tailwind utility classes only — no custom CSS classes (exception: the CSS custom property definitions in `globals.css` and the inline theme script)
- All database queries must include `tenant_id` for multi-tenant isolation (not directly applicable to this epic but maintained for consistency)
- TypeScript strict mode — no `any` types allowed
- All color values must reference CSS custom properties, never hardcoded hex/rgb values in component code
- The inline theme script must be minimal (no dependencies, no framework code) to avoid blocking first paint
- Design system components must be fully accessible: keyboard navigable, proper ARIA attributes, focus management
- No external component library (Radix, Headless UI, etc.) — all primitives are built from scratch to maintain bundle control

---

## Files Created/Modified by This Epic

### New Files
- `src/components/ui/ThemeToggle.tsx` — light/dark/system theme toggle
- `src/hooks/useTheme.ts` — theme state management hook
- `src/lib/theme/themeScript.ts` — inline script string for FOWT prevention
- `src/components/ui/Button.tsx` — button component with variants
- `src/components/ui/Input.tsx` — text input component
- `src/components/ui/Modal.tsx` — modal overlay component
- `src/components/ui/Dropdown.tsx` — dropdown menu component
- `src/components/ui/Toast.tsx` — toast notification component
- `src/components/ui/ToastContainer.tsx` — toast stack manager
- `src/hooks/useToast.ts` — imperative toast hook
- `src/components/ui/Skeleton.tsx` — loading skeleton component
- `src/components/ui/Tooltip.tsx` — hover tooltip component
- `src/__tests__/components/ui/ThemeToggle.test.tsx`
- `src/__tests__/hooks/useTheme.test.ts`
- `src/__tests__/components/ui/Button.test.tsx`
- `src/__tests__/components/ui/Modal.test.tsx`
- `src/__tests__/components/ui/Dropdown.test.tsx`
- `src/__tests__/components/ui/Toast.test.tsx`
- `src/__tests__/components/ui/Skeleton.test.tsx`
- `src/__tests__/components/ui/Tooltip.test.tsx`

### Modified Files
- `src/app/globals.css` — add CSS custom property definitions for light and dark themes
- `src/app/layout.tsx` — add inline theme script to `<head>`, add ThemeToggle to layout
- `tailwind.config.ts` — extend theme colors to reference CSS custom properties, set darkMode to "class"

---

**Last Updated:** 2026-02-21