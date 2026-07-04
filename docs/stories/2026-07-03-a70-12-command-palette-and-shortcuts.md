# A70-12 — Action command palette + real keyboard-shortcut set with help overlay

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-06.4-quick-switcher.md` (Cmd+K navigation — this story extends it), `SKB-13.x` enhanced search.

## Problem
Cmd+K only navigates to pages and Cmd+Shift+F only opens search — there are no
action commands (create page, toggle theme, move page, open settings, copy
link...) and effectively no other global shortcuts. `useHotkeys` exists but is
barely used, and nothing tells the user what shortcuts exist. Notion/Obsidian
users expect a command palette and a discoverable shortcut map.

## Evidence
- `src/components/search/QuickSwitcher.tsx:28-40` (navigation only);
  `src/components/search/EnhancedSearchWrapper.tsx:21`.
- `src/hooks/useHotkeys.ts` capable, underused. No help overlay component.

## Scope
1. Extend the Cmd+K palette with an actions mode (type ">" prefix or a tab):
   registry-driven commands — New page, New database view, Toggle dark mode,
   Open settings, Open trash, Copy page link, Move page (opens picker),
   Duplicate page, Toggle graph sidebar. Registry designed so features can
   append commands.
2. Global shortcuts: Cmd+N (new page), Cmd+Shift+H (toggle theme — pick
   non-conflicting), Cmd+\\ (toggle sidebar), "?"/Cmd+/ (help overlay). Respect
   focus context (don't fire inside editor text where they conflict).
3. Help overlay: a "Keyboard shortcuts" modal listing all registered shortcuts,
   opened via Cmd+/ and from Settings.

## Acceptance criteria
- AC1: ">" in Cmd+K lists and executes at least 8 actions.
- AC2: Shortcuts work globally without breaking editor typing; no browser-
  default clashes on Chrome/Safari macOS.
- AC3: Help overlay reflects the actual registry (single source of truth).
- AC4: tsc + vitest green; registry unit tests.

## Affected files (expected)
- `src/components/search/QuickSwitcher.tsx` (actions mode)
- new `src/lib/commands/registry.ts`, help overlay component
- `src/hooks/useHotkeys.ts` consumers

## Verification
Unit tests for registry + live keyboard walk-through.
