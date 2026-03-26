# Story SKB-52.11: Configurable Category Sorting

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.11
**Story Points:** 3 | **Priority:** Medium | **Status:** Planned
**Depends On:** None (independent of other stories)

---

## User Story

As a researcher browsing the Chemistry Knowledge Base,
I want to sort experiment pages within a category folder by different criteria (ELN number, alphabetical, last edited, status),
So that I can quickly find the experiment I'm looking for without scrolling through an unsorted list.

---

## Problem

The Experiments folder now contains 38 pages. They are displayed in insertion order (the `position` field set at creation time), which means:
- New experiments appear at the bottom, not the top
- There's no way to sort by ELN number, name, or date
- Finding a specific experiment requires scrolling or using search (Cmd+K)
- The problem will get worse as more experiments are created

The same issue applies to other category folders (Chemicals, Reaction Types, Researchers, Substrate Classes, Archive) as they grow.

---

## Design

### Sort Options

Available on any category page (parent page with children) via the three-dot menu:

| Sort Option | Description | Sort Key |
|---|---|---|
| **ELN Number (newest first)** | Default for Experiments. Sorts by the numeric portion of the ELN ID descending. | Parse number from title prefix, descending |
| **ELN Number (oldest first)** | Ascending variant. | Parse number from title prefix, ascending |
| **Alphabetical (A→Z)** | Sort by page title ascending. | `title ASC` |
| **Alphabetical (Z→A)** | Sort by page title descending. | `title DESC` |
| **Last Edited** | Most recently updated pages first. | `updatedAt DESC` |
| **Date Created** | Most recently created pages first. | `createdAt DESC` |
| **Manual** | Current behavior — drag-and-drop order. | `position ASC` |

### UI: Three-Dot Menu Extension

Add a "Sort by" submenu to the existing `PageContextMenu` that appears when clicking the three-dot icon on a **parent** page (a page with children):

```
┌──────────────────────┐
│ Rename               │
│ Duplicate            │
│ Copy link            │
│ Add to favorites     │
│ ──────────────────── │
│ Sort children by   ▸ │  ← New submenu
│   ✓ ELN # (newest)   │
│     ELN # (oldest)    │
│     Alphabetical A→Z  │
│     Alphabetical Z→A  │
│     Last edited       │
│     Date created      │
│     Manual (drag)     │
│ ──────────────────── │
│ Delete               │
└──────────────────────┘
```

The current sort preference is indicated with a checkmark.

### Persistence: Client-Side (localStorage)

Sort preferences are stored per-folder in localStorage:

```typescript
// Key format: `skb-sort-${pageId}`
// Value: SortPreference object
interface SortPreference {
  field: "eln_number" | "title" | "updatedAt" | "createdAt" | "position";
  direction: "asc" | "desc";
}

// Example
localStorage.setItem(
  "skb-sort-8e44cd57-c384-4353-a0ac-f86ba54bfcea",
  JSON.stringify({ field: "eln_number", direction: "desc" })
);
```

**Why client-side:** Sort preference is a personal UI preference, not shared state. Using localStorage avoids schema changes and API complexity. If multi-user sort preferences are needed later, this can be promoted to a user settings table.

### Default Sort Per Category

| Category | Default Sort |
|---|---|
| Experiments | ELN Number (newest first) |
| Archive | ELN Number (newest first) |
| Chemicals | Alphabetical (A→Z) |
| Reaction Types | Alphabetical (A→Z) |
| Researchers | Alphabetical (A→Z) |
| Substrate Classes | Alphabetical (A→Z) |

---

## Technical Approach

### 1. Sort Hook: `useCategorySortPreference()`

New hook in `src/hooks/useCategorySortPreference.ts`:

```typescript
const DEFAULT_SORTS: Record<string, SortPreference> = {
  experiments: { field: "eln_number", direction: "desc" },
  archive: { field: "eln_number", direction: "desc" },
  chemicals: { field: "title", direction: "asc" },
  reactionTypes: { field: "title", direction: "asc" },
  researchers: { field: "title", direction: "asc" },
  substrateClasses: { field: "title", direction: "asc" },
};

export function useCategorySortPreference(pageId: string, categoryKey?: string) {
  const [sortPref, setSortPref] = useState<SortPreference>(() => {
    const stored = localStorage.getItem(`skb-sort-${pageId}`);
    if (stored) return JSON.parse(stored);
    if (categoryKey && DEFAULT_SORTS[categoryKey]) return DEFAULT_SORTS[categoryKey];
    return { field: "position", direction: "asc" };
  });

  const updateSort = (pref: SortPreference) => {
    setSortPref(pref);
    localStorage.setItem(`skb-sort-${pageId}`, JSON.stringify(pref));
  };

  return { sortPref, updateSort };
}
```

### 2. Sort Function: `sortPageTreeNodes()`

New utility in `src/lib/pages/sortPages.ts`:

```typescript
export function sortPageTreeNodes(
  nodes: PageTreeNode[],
  pref: SortPreference
): PageTreeNode[] {
  const sorted = [...nodes];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (pref.field) {
      case "eln_number":
        cmp = extractElnNumber(a.title) - extractElnNumber(b.title);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "updatedAt":
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "position":
        cmp = a.position - b.position;
        break;
    }
    return pref.direction === "desc" ? -cmp : cmp;
  });

  return sorted;
}

function extractElnNumber(title: string): number {
  // Matches EXP-2025-0001, ELN-2026-0042, etc.
  const match = title.match(/(?:EXP|ELN)-(\d{4})-(\d{4})/);
  if (!match) return 0;
  // Combine year and sequence for proper ordering
  return parseInt(match[1]) * 10000 + parseInt(match[2]);
}
```

### 3. Apply Sort in Sidebar Tree

In `DndSidebarTree.tsx` or `SortableSidebarTreeNode.tsx`, apply the sort when rendering children:

```typescript
// When rendering children of a node:
const sortedChildren = useMemo(() => {
  if (!node.children.length) return node.children;
  return sortPageTreeNodes(node.children, sortPref);
}, [node.children, sortPref]);
```

**Important:** When sort is set to anything other than "Manual", drag-and-drop reordering should be **disabled** for that folder's children (since the sort would immediately override any manual reorder). Show a tooltip: "Switch to Manual sort to enable drag-and-drop reordering."

### 4. Extend Context Menu

In `PageContextMenu.tsx`, add the "Sort children by" submenu. Only show it when the page has children (is a parent/category page):

```typescript
{hasChildren && (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>Sort children by</DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      {SORT_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.key}
          onClick={() => updateSort(option.pref)}
        >
          {sortPref.field === option.pref.field &&
           sortPref.direction === option.pref.direction && "✓ "}
          {option.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuSubContent>
  </DropdownMenuSub>
)}
```

### 5. Apply Default Sort on Resync

When the debug-resync or reconciliation endpoint creates experiment pages, set the `position` field based on ELN number descending (newest first) so the default view is correct even before the user sets a sort preference.

---

## Acceptance Criteria

- [ ] Three-dot menu on parent pages shows "Sort children by" submenu
- [ ] All 7 sort options are available (ELN # desc/asc, alpha A-Z/Z-A, last edited, date created, manual)
- [ ] Selected sort option is indicated with a checkmark
- [ ] Sort preference persists across page reloads (localStorage)
- [ ] Default sort for Experiments/Archive is ELN Number (newest first)
- [ ] Default sort for Chemicals/Reaction Types/Researchers/Substrate Classes is Alphabetical (A→Z)
- [ ] Drag-and-drop reordering is disabled when sort is not "Manual"
- [ ] Sort applies to sidebar tree rendering in real-time
- [ ] ELN number sort correctly handles mixed prefixes (EXP-2025-0001, ELN-2026-0042)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useCategorySortPreference.ts` | **NEW** — Sort preference hook with localStorage persistence |
| `src/lib/pages/sortPages.ts` | **NEW** — Sort utility functions with ELN number extraction |
| `src/components/sidebar/PageContextMenu.tsx` | Add "Sort children by" submenu |
| `src/components/workspace/DndSidebarTree.tsx` | Apply sort preference when rendering children |
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Disable drag when non-manual sort active |

---

## Out of Scope

- Server-side sort preferences (multi-user shared sort) — can be added later if needed
- Sort indicators in the page content area (this is sidebar-only)
- Filtering (e.g., show only completed experiments) — separate feature
- Sort for non-Chemistry-KB pages (could generalize later but scope to Chemistry KB for now)

---

## Why This Matters

With 38+ experiments and growing, an unsorted flat list becomes unusable. Researchers typically want to see the latest experiments first (ELN number descending) or find a specific one alphabetically. The sort feature turns the sidebar from a scroll-and-hunt experience into quick navigation, which becomes increasingly important as the reconciliation sync (SKB-52.8) adds more experiments automatically.
