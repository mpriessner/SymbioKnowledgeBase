# Epic 11: Sidebar Restructure & Home Page Dashboard

**Epic ID:** EPIC-11
**Created:** 2026-02-22
**Total Story Points:** 21
**Priority:** High
**Status:** Done

---

## Epic Overview

Epic 11 transforms the sidebar from a flat page list into a Notion-style multi-section layout and introduces a dedicated home page dashboard. The sidebar now features a hierarchical structure with workspace branding, top navigation links with active state highlighting, a creation dropdown menu, a recents section showing the 5 most recently visited pages, and a private pages section with the existing drag-and-drop tree. The home page provides a centralized dashboard with a time-based greeting, recently visited pages in a horizontal carousel, quick action buttons, and a comprehensive list of all pages sorted by last update time.

This epic also includes critical bug fixes to the drag-and-drop sidebar tree to enable reparenting pages into collapsed parent nodes, and a hydration fix to prevent client-server mismatches when detecting the user's operating system for keyboard shortcut display.

The home page serves as the default landing page for authenticated users, providing immediate access to recent work and common actions without requiring navigation through the page tree.

This epic covers FR07-09 (sidebar navigation, recent pages tracking, home dashboard).

---

## Business Value

- Notion-style sidebar structure improves discoverability and reduces cognitive load by organizing navigation into clear sections
- Recent pages tracking accelerates access to active work — users can return to their last 5 pages with a single click
- Home page dashboard provides a "control center" that reduces time to first action for users starting their session
- Active link highlighting improves spatial awareness within the application
- Keyboard shortcut hints (⌘K for search) educate users about power-user features
- DnD reparenting fix removes a major usability frustration where pages couldn't be moved into collapsed parents
- Hydration fix eliminates console warnings and potential UI inconsistencies between server and client rendering

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar Component Hierarchy                                     │
│                                                                  │
│  <Sidebar>                                                       │
│    ├─ Workspace Header (fixed)                                  │
│    │    ├─ <WorkspaceDropdown>                                  │
│    │    │    └─ Dropdown menu (Settings, Log out)               │
│    │    ├─ Collapse button                                      │
│    │    └─ Creation dropdown (Page, Database, AI Meeting)       │
│    │                                                             │
│    ├─ Top Navigation (fixed)                                    │
│    │    ├─ Search bar (triggers Cmd+K)                          │
│    │    ├─ Home link (active state via usePathname)             │
│    │    └─ Graph link (active state via usePathname)            │
│    │                                                             │
│    ├─ Scrollable Content                                        │
│    │    ├─ Recents Section                                      │
│    │    │    └─ useRecentPages() → up to 5 pages               │
│    │    │                                                        │
│    │    └─ Private Section                                      │
│    │         └─ <DndSidebarTree> (existing tree with DnD)       │
│    │                                                             │
│    └─ Footer (fixed)                                            │
│         └─ Settings button → opens <SettingsModal>              │
│                                                                  │
│  <SettingsModal> (portal via createPortal)                      │
│    └─ Full-screen modal with left nav and content area          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Home Page (/home route)                                         │
│                                                                  │
│  <HomePage>                                                      │
│    ├─ Greeting: "Good {morning|afternoon|evening}"              │
│    │    (client-side only, uses current time)                   │
│    │                                                             │
│    ├─ Recently Visited Section                                  │
│    │    └─ useRecentPages() → horizontal scroll cards           │
│    │         (emoji, title, relative time: "2h ago")            │
│    │                                                             │
│    ├─ Quick Actions Grid                                        │
│    │    ├─ New Page (navigates to /pages)                       │
│    │    ├─ Search (dispatches Cmd+K event)                      │
│    │    └─ View Graph (navigates to /graph)                     │
│    │                                                             │
│    └─ All Pages List                                            │
│         └─ usePages({ sortBy: "updatedAt", order: "desc" })     │
│              (emoji, title, formatted date)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  State Management                                                │
│                                                                  │
│  useRecentPages() Hook                                           │
│    ├─ localStorage: "symbio-recent-pages" (max 5 entries)       │
│    ├─ { id, title, icon, visitedAt: timestamp }                 │
│    ├─ addRecentPage(page) → adds to front, deduplicates         │
│    └─ recentPages → sorted by visitedAt desc                    │
│                                                                  │
│  usePathname() (Next.js)                                         │
│    └─ Returns current route → used for active link styling      │
│                                                                  │
│  Platform Detection (hydration-safe)                             │
│    ├─ useEffect(() => setIsMac(navigator.platform))             │
│    └─ Displays "⌘K" vs "Ctrl+K" after mount                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DnD Sidebar Tree Fix                                            │
│                                                                  │
│  Problem: Cannot drop onto collapsed parent nodes               │
│    - SortableContext requires all draggable item IDs            │
│    - Previously: flattenTreeIds() excluded collapsed children   │
│                                                                  │
│  Solution: flattenTreeIds() now includes ALL descendant IDs     │
│    - Expanded parent: render children, recurse                  │
│    - Collapsed parent: don't render, but still include IDs      │
│    - getAllDescendantIds() helper for collapsed branches        │
│                                                                  │
│  Drop Zone Detection (for parent nodes)                         │
│    - Before: 25% top / 50% middle / 25% bottom                  │
│    - After: 20% top / 60% middle / 20% bottom                   │
│    - Wider middle zone makes "child" drops easier to target     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-11.1: Sidebar Restructure — 8 points, High

**Delivers:** Restructured `Sidebar.tsx` with five distinct sections: (1) Workspace header with `WorkspaceDropdown` showing workspace name, settings button, and log out button, plus collapse/expand toggle and creation dropdown button (Page, Database, AI Meeting Notes); (2) Top navigation with Search bar (dispatches Cmd+K event, shows OS-specific keyboard shortcut), Home link (navigates to /home), and Graph link (navigates to /graph), both with active state highlighting via `usePathname()`; (3) Recents section label with up to 5 pages from `useRecentPages()` hook; (4) Private section label above the existing `<DndSidebarTree>`; (5) Settings footer button that opens `<SettingsModal>`. Creation dropdown closes on outside click (ref-based detection). Platform detection moved to `useEffect` to prevent hydration mismatch. Active link styling uses `bg-[var(--sidebar-active)]` and `font-medium`. Fragment wrapper around sidebar and modal for proper portal rendering.

**Depends on:** SKB-09.1 (CSS custom properties), SKB-11.2 (WorkspaceDropdown component)

---

### SKB-11.2: Workspace Dropdown — 3 points, Medium

**Delivers:** `WorkspaceDropdown.tsx` component with toggle button showing workspace name ("SymbioKnowledgeBase") and chevron icon that rotates when open. Dropdown menu contains: (1) Current workspace section with checkmark icon; (2) Settings button that calls `onOpenSettings()` prop; (3) Divider; (4) Log out button that calls `signOut({ callbackUrl: "/login" })` from next-auth/react. Dropdown closes on outside click (ref-based detection with `mousedown` listener) and Escape key. Menu is absolutely positioned below trigger, full width with `min-w-[240px]`, with shadow and border. Uses `aria-label`, `aria-expanded`, and `role="menu"` for accessibility.

**Depends on:** None (standalone component)

---

### SKB-11.3: Home Page Dashboard — 8 points, High

**Delivers:** `/home` route page (`src/app/(workspace)/home/page.tsx`) marked as `"use client"`. Shows: (1) Time-based greeting "Good {morning|afternoon|evening}" calculated via `getTimeOfDay()` helper (morning: 0-11, afternoon: 12-17, evening: 18-23); (2) Recently visited section with horizontal scrollable carousel (`overflow-x-auto`) showing cards with emoji, title, and relative time via `getRelativeTime()` helper (formats as "5m ago", "3h ago", "2d ago", "just now"); (3) Quick actions grid (1 column on mobile, 3 columns on desktop) with three cards: New Page (navigates to `/pages` to create new page), Search (dispatches synthetic `KeyboardEvent` with `key: "k"`, `metaKey: true` to trigger global QuickSwitcher), View Graph (navigates to `/graph`); (4) All pages list showing all pages sorted by `updatedAt` descending, with emoji, title, and formatted date (`toLocaleDateString()`). Uses `useRecentPages()` and `usePages({ sortBy: "updatedAt", order: "desc" })` hooks. Empty states for no recent pages and no pages at all. Loading skeleton for all pages list.

**Depends on:** SKB-11.4 (useRecentPages hook)

---

### SKB-11.4: DnD Sidebar Reparenting Fix — 2 points, High

**Delivers:** Fix for `DndSidebarTree.tsx` to enable dropping pages into collapsed parent nodes. Modified `flattenTreeIds()` to always include ALL descendant IDs via new `getAllDescendantIds()` helper function, even when parent is collapsed. This ensures `SortableContext` has all IDs registered as sortable items, allowing drag-and-drop to work with collapsed parents. Also improved drop zone detection in `handleDragOver()`: parent nodes now use 20/60/20 split (20% before, 60% child, 20% after) instead of 25/50/25, making the "child" drop zone wider and easier to target. Leaf nodes still use 25/50/25 split. No visual changes, purely functional fix.

**Depends on:** SKB-04.3 (existing DndSidebarTree component)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 11.1 | Sidebar renders all sections; active link highlighting; creation menu toggle; recents list display; isMac state hydration | - | Click Home/Graph links, verify active state; click Settings, modal opens; keyboard shortcut displays correctly; creation menu opens/closes |
| 11.2 | WorkspaceDropdown renders; toggle opens/closes menu; outside click closes; Escape key closes; onOpenSettings called | - | Click dropdown, click Settings, verify callback; click outside, verify closes |
| 11.3 | HomePage renders greeting (mocked time); recentPages displayed; quick actions navigate correctly; all pages sorted by updatedAt desc | - | Load /home, verify greeting changes by time; click recent page card, navigate; click New Page, create and navigate; click Search, QuickSwitcher opens |
| 11.4 | flattenTreeIds includes all descendant IDs even for collapsed nodes; getAllDescendantIds returns full tree IDs; drop zone calculation correct for parent vs leaf | DndSidebarTree drag-and-drop integration | Drag page onto collapsed parent, verify reparents correctly; drag onto expanded parent, verify drops as child |

---

## Implementation Order

```
11.2 → 11.1 → 11.4 (parallel with 11.3)
                      ↘
                        11.3

┌────────┐     ┌────────┐     ┌────────┐
│ 11.2   │────▶│ 11.1   │────▶│ 11.4   │
│Dropdown│     │Sidebar │     │DnD Fix │
└────────┘     └────────┘     └────────┘
                                   │
                                   ▼
                              ┌────────┐
                              │ 11.3   │
                              │  Home  │
                              └────────┘
```

---

## Shared Constraints

- All UI components use Tailwind utility classes only — no custom CSS classes
- All database queries must include `tenant_id` for multi-tenant isolation
- TypeScript strict mode — no `any` types allowed
- All navigation must use Next.js `useRouter()` for client-side routing
- All keyboard shortcuts must be dispatched as synthetic events to maintain global handler compatibility
- Platform detection (Mac vs Windows/Linux) must occur in `useEffect` to prevent hydration mismatches
- Recent pages must be stored in localStorage with max capacity of 5 entries
- All modals must use `createPortal(content, document.body)` for proper z-index layering
- Body scroll must be prevented when modals are open (`document.body.style.overflow = "hidden"`)
- All dropdowns must close on outside click (ref-based detection) and Escape key
- Active navigation links must use consistent styling: `bg-[var(--sidebar-active)]` and `font-medium`

---

## Files Created/Modified by This Epic

### New Files
- `src/hooks/useRecentPages.ts` — recent pages tracking hook
- `src/components/workspace/WorkspaceDropdown.tsx` — workspace menu dropdown
- `src/app/(workspace)/home/page.tsx` — home page dashboard

### Modified Files
- `src/components/workspace/Sidebar.tsx` — restructured into multi-section layout
- `src/components/workspace/DndSidebarTree.tsx` — fixed flattenTreeIds to include all descendant IDs
- `src/app/(workspace)/layout.tsx` — added QueryProvider wrapper (SessionProvider integration)
- `src/components/providers/QueryProvider.tsx` — merged SessionProvider into QueryProvider

---

**Last Updated:** 2026-02-22
