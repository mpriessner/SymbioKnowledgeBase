# Fullscreen Layout Investigation (Feb 24, 2026)

## Goal
Make workspace pages (home, page view, graph, settings, etc.) expand fluidly with the viewport, without fixed column widths or excessive gutters. Avoid flex overflow that pushes the sidebar off-screen.

## Symptoms Observed
- Content appeared “boxed” with large empty space on the right even when the sidebar was collapsed.
- After some fixes, the sidebar was pushed off-screen (flex overflow).
- After rebalancing, the content felt narrow again.

## Changes Attempted (Chronological)
1. **Removed max-width wrappers on workspace pages**
   - Files:
     - `src/app/(workspace)/home/page.tsx`
     - `src/app/(workspace)/inbox/page.tsx`
     - `src/app/(workspace)/settings/page.tsx`
     - `src/app/(workspace)/databases/[id]/page.tsx`
     - `src/components/workspace/Breadcrumbs.tsx`
     - `src/components/workspace/CoverImageManager.tsx`
   - Goal: stop `max-w-*` from constraining width.

2. **Forced editor content to be full-width**
   - Files:
     - `src/components/editor/BlockEditor.tsx`
     - `src/components/shared/SharedPageContent.tsx`
     - `src/components/editor/editor.css`
   - Added `w-full` and `!max-w-none` on editor content.
   - Added `.tiptap` width rules in CSS.

3. **Moved overlay components out of the flex container**
   - File: `src/app/(workspace)/layout.tsx`
   - Quick Switcher / Enhanced Search / AI Chat moved outside the flex layout to prevent width calculations from being affected.

4. **Introduced a shared responsive padding token**
   - File: `src/app/globals.css`
     - Added `--content-padding: clamp(16px, 2.5vw, 32px)`
     - Added `.content-pad` helper
   - Applied to:
     - `src/app/(workspace)/home/page.tsx`
     - `src/components/workspace/Breadcrumbs.tsx`
     - `src/components/workspace/PageHeader.tsx`
     - `src/components/workspace/CoverImageManager.tsx`
     - `src/app/(workspace)/pages/[id]/page.tsx`
     - `src/components/editor/BlockEditor.tsx`
     - `src/app/(workspace)/settings/page.tsx`
     - `src/app/(workspace)/databases/[id]/page.tsx`
     - `src/app/(workspace)/inbox/page.tsx`

5. **Forced `.prose` to expand**
   - File: `src/app/globals.css`
   - Added:
     - `.prose { width: 100%; max-width: 100% !important; }`
     - `.prose > * { max-width: 100% !important; }`
   - Goal: override Tailwind Typography’s `max-width: 65ch`.

6. **Removed `w-full` from main flex item and removed width forcing**
   - File: `src/app/(workspace)/layout.tsx`
     - Removed `w-full` from `<main>`, leaving `flex-1 min-w-0`
   - File: `src/app/globals.css`
     - Removed `.workspace-main` and child `width: 100%` rules
   - Goal: avoid flex overflow that pushes the sidebar off-screen.

## Current State (as of this doc)
- `main` is `flex-1 min-w-0 overflow-y-auto` without `w-full`.
- `content-pad` is in use instead of hardcoded `px-16` / `px-8`.
- `.prose` is globally overridden to allow full width.
- TipTap editor has `w-full !max-w-none` and `content-pad`.

## Likely Remaining Causes
1. **Tailwind Typography still constraining width**
   - Even with `.prose` overrides, verify in DevTools whether the editor root is actually `.prose` or a nested container still inherits `max-width: 65ch`.
   - Check computed styles on `.ProseMirror` and `.tiptap`.

2. **Padding vs. “full width” expectations**
   - The UI now uses responsive padding (`clamp(16px, 2.5vw, 32px)`), not edge-to-edge.
   - If the desired behavior is true full-bleed content, padding should be removed or toggled off.

3. **Page layout expecting a “Full Width” mode**
   - No explicit “Full Width” or “Focus Mode” toggle exists.
   - Typical behavior would:
     - Collapse sidebar
     - Reduce padding to near-zero
     - Remove typography column width

## Suggested Next Steps
1. Inspect computed styles on a page:
   - `.prose`, `.tiptap`, `.ProseMirror` and parent containers.
   - Confirm `max-width` is actually none/100%.
2. If still constrained:
   - Remove `prose` class from editor content entirely.
   - Replace with a minimal typography layer to avoid hard max-width.
3. Add a “Full Width” toggle:
   - Apply a class to `<body>` or `<main>` to remove padding and collapse sidebar.
4. Verify there are no hidden `max-width` or `mx-auto` wrappers on workspace pages.

## Files Touched During Investigation
- `src/app/(workspace)/layout.tsx`
- `src/app/globals.css`
- `src/app/(workspace)/home/page.tsx`
- `src/app/(workspace)/inbox/page.tsx`
- `src/app/(workspace)/settings/page.tsx`
- `src/app/(workspace)/databases/[id]/page.tsx`
- `src/app/(workspace)/pages/[id]/page.tsx`
- `src/components/workspace/Breadcrumbs.tsx`
- `src/components/workspace/PageHeader.tsx`
- `src/components/workspace/CoverImageManager.tsx`
- `src/components/editor/BlockEditor.tsx`
- `src/components/shared/SharedPageContent.tsx`
- `src/components/editor/editor.css`

---

## Claude Code Investigation (Feb 24, 2026 - Session 2)

### Deep Dive Findings via Playwright DOM Inspection

Used Playwright browser automation to measure computed styles on every element from `.tiptap` up to `<body>`. Key findings:

**No CSS max-width constraints exist anywhere in the chain.** Every element from body to tiptap has `max-width: none`. The `.prose` overrides in `globals.css` and `editor.css` successfully neutralize Tailwind Typography's `max-width: 65ch`.

**The actual width breakdown at 1280px viewport (right sidebar open):**
- Left sidebar (aside): 352px (from localStorage, flex-shrink-0)
- Main area: 928px (flex-1)
- Right sidebar: 280px (fixed w-[280px])
- Content area: 640px (928 - 280 - scrollbar)
- Text width: 576px (640 - 64px padding)

**The actual width breakdown at 1280px viewport (right sidebar closed):**
- Left sidebar: 352px
- Main area: 928px
- Content area: 919px (no right sidebar)
- Text width: 855px (919 - 64px padding)

**Root cause was the right sidebar (280px) eating content space.**

### Changes Attempted (commits 6b7c86c and 2ae356b, REVERTED)

#### Commit 6b7c86c: Default right sidebar to closed
- File: `src/app/(workspace)/pages/[id]/page.tsx`
- Added localStorage persistence key `symbio-right-sidebar`
- Changed `showRightSidebar` default from `true` to `false`
- Added `toggleRightSidebar` callback with localStorage save
- **Result**: Worked in Playwright (content went from 640px to 919px), but user still saw narrow layout due to browser caching old JavaScript.

#### Commit 2ae356b: Viewport-relative responsive sizing
- File: `src/components/workspace/Sidebar.tsx`
  - Added `maxWidth: '30vw'` to left sidebar inline style
  - Effect: At 1024px viewport, sidebar capped at 307px instead of 352px
- File: `src/app/(workspace)/pages/[id]/page.tsx`
  - Changed right sidebar breakpoint from `lg` (1024px) to `xl` (1280px)
  - Changed right sidebar width from fixed `w-[280px]` to `w-[min(280px,20vw)]`
  - Updated toggle button positioning to use inline style with `min(280px, 20vw)`
- **Result**: User reported content appeared even smaller. Reverted.

### Measurements at Various Viewport Widths (with commit 2ae356b)

| Viewport | Left Sidebar | Content Width | Padding | Right Sidebar | Content % |
|----------|-------------|---------------|---------|---------------|-----------|
| 1024px   | 306px (30vw cap) | 709px | 25.6px | hidden | 70% |
| 1100px   | 329px (30vw cap) | 762px | 27.5px | hidden | 70% |
| 1280px   | 352px | 919px | 32px | closed default | 72% |
| 1440px   | 352px | 1079px | 32px | closed default | 76% |
| 1920px   | 352px | 1559px | 32px | closed default | 82% |

### Key Layout Architecture (unchanged)
- Outer container: `flex h-screen w-screen overflow-hidden`
- Left sidebar: `flex-shrink-0`, width via inline style from `useSidebarWidth()` hook
  - Saved in localStorage as `symbio-sidebar-width` (default: 256px, min: 200px, max: 600px)
  - User had manually resized to 352px
- Main: `flex-1 min-w-0 flex flex-col` (grows to fill remaining space)
- Content area: `flex-1 min-w-0 overflow-y-auto`
- Content padding: `clamp(16px, 2.5vw, 32px)` via `--content-padding` CSS variable
- Editor: `.tiptap` / `.ProseMirror` with `width: 100%; max-width: none !important`

### Possible Root Causes Still to Investigate
1. **Browser cache**: User may not have been loading new JavaScript after Docker rebuilds. Hard refresh (Cmd+Shift+R) needed.
2. **The Tailwind arbitrary value `w-[min(280px,20vw)]` may not have been generated** by Tailwind JIT. CSS `min()` inside brackets might need verification.
3. **The `max-width: 30vw` on sidebar may have made it feel like content shrunk** when in fact it was the sidebar that got smaller (visual perception issue).

### Recommendation for Future Attempts
- Verify the user is actually seeing updated code (check Network tab for cache status)
- Consider using dev server (port 3001) instead of Docker for faster iteration
- Use browser DevTools to measure live rather than relying on Docker rebuilds
- A "Full Width" toggle mode that collapses sidebar + removes right panel might be the UX solution
