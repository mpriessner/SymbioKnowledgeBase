# Epic 3: Page Management & Navigation

**Epic ID:** EPIC-03
**Created:** 2026-02-21
**Total Story Points:** ~21
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 3 implements the core page system — CRUD operations, hierarchical nesting, sidebar navigation, breadcrumbs, page icons, and drag-and-drop reordering. This is the backbone of SymbioKnowledgeBase: blocks, wikilinks, search, and the knowledge graph all build upon the page model delivered here.

Every page operation is tenant-scoped via the middleware from Epic 2. The API follows the standard `{ data, meta }` / `{ error, meta }` envelope. Pages support infinite nesting through a `parent_id` self-reference in the `pages` table, and a `position` integer field for manual ordering within siblings.

This epic covers FR1-7 (Page Management), FR30-33 (REST API page endpoints), and FR38 (pagination).

---

## Business Value

- Delivers the fundamental data structure that all content lives within — without pages, there is no editor, no wikilinks, no graph
- Hierarchical nesting enables users to organize knowledge in a familiar tree structure (like Notion)
- Sidebar navigation provides the primary means of moving between pages
- Breadcrumbs give users spatial awareness in deeply nested page trees
- Icons and cover images make the workspace visually distinctive and scannable

---

## Architecture Summary

```
Sidebar (PageTree)                    Main Content Area
┌──────────────────┐                 ┌────────────────────────────────┐
│ 📄 Getting Started│                 │ Breadcrumb: Home > Guide > ... │
│ ▼ 📁 User Guide   │   onClick       │                                │
│   📄 Installation │ ──────────────▶ │ 📄 Installation                │
│   📄 Configuration│                 │ ─────────────────────          │
│ ▼ 📁 API Docs     │                 │ [Editor Placeholder]           │
│   📄 REST API     │                 │ (Epic 4 provides editor)       │
│                    │                 │                                │
│ [+ New Page]       │                 │ [Cover Image Area]             │
└──────────────────┘                 └────────────────────────────────┘
        │                                        │
        │ Drag-and-drop                          │ Page data
        │ reordering                             │
        ▼                                        ▼
┌──────────────────────────────────────────────────────────────┐
│  API Layer (Next.js API Routes)                              │
│                                                              │
│  POST   /api/pages          — Create page                   │
│  GET    /api/pages          — List pages (tree structure)    │
│  GET    /api/pages/:id      — Get single page               │
│  PUT    /api/pages/:id      — Update page (title, parent,   │
│                                icon, cover, position)        │
│  DELETE /api/pages/:id      — Soft-delete page + children   │
│                                                              │
│  All routes wrapped with withTenant() from Epic 2            │
│  All inputs validated with Zod schemas                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL 18 — pages table                                 │
│                                                              │
│  id          UUID PRIMARY KEY                                │
│  tenant_id   UUID NOT NULL → tenants(id)                     │
│  parent_id   UUID → pages(id) (self-reference, nullable)     │
│  title       VARCHAR(500) NOT NULL DEFAULT 'Untitled'        │
│  icon        VARCHAR(50)  (emoji)                            │
│  cover_url   TEXT          (image URL)                        │
│  position    INTEGER NOT NULL DEFAULT 0                      │
│  created_at  TIMESTAMPTZ                                     │
│  updated_at  TIMESTAMPTZ                                     │
│                                                              │
│  INDEX: (tenant_id, parent_id, position)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-03.1: Page CRUD API and Basic Page View — 5 points, Critical

**Delivers:** Full REST API for page operations: `POST /api/pages` (create with title, optional parent_id), `GET /api/pages` (list all pages for tenant as flat list with parent_id for tree construction), `GET /api/pages/:id` (single page with children list), `PUT /api/pages/:id` (update title, parent_id), `DELETE /api/pages/:id` (soft-delete). All endpoints wrapped with `withTenant()`, all inputs validated with Zod schemas. Basic page view component (`src/app/(workspace)/pages/[id]/page.tsx`) that fetches page data and displays title with a placeholder area for the editor (Epic 4).

**Depends on:** SKB-02.2 (tenant isolation middleware must be functional)

---

### SKB-03.2: Page Hierarchy and Nested Pages — 3 points, High

**Delivers:** `parent_id` support in page creation and update endpoints. Nested page creation (creating a page with a specified parent). Moving a page between parents via `PUT /api/pages/:id` with new `parent_id`. Recursive child fetching utility (`lib/pages/getPageTree.ts`) that builds a nested tree structure from flat page records for the sidebar. Validation: cannot set a page as its own parent or create circular references.

**Depends on:** SKB-03.1 (page CRUD must exist)

---

### SKB-03.3: Sidebar Page Tree — 5 points, High

**Delivers:** `PageTree` component in the workspace sidebar that renders pages as a recursive tree. Each node shows page icon (or default icon) and title. Expand/collapse toggles for pages with children. Active page highlighting based on current URL. "New Page" button at the bottom that creates a root-level page. "New Subpage" option on hover/context of each page node. Page tree data fetched via `GET /api/pages` on workspace load, cached with TanStack Query.

**Depends on:** SKB-03.2 (hierarchy support needed for tree rendering)

---

### SKB-03.4: Breadcrumb Navigation — 2 points, Medium

**Delivers:** `Breadcrumb` component that displays the full ancestry path of the current page (e.g., "Home > User Guide > Installation"). Each breadcrumb segment is clickable and navigates to that ancestor page. Ancestry computed from the page tree data already fetched for the sidebar (no additional API call). Truncation with "..." for paths deeper than 4 levels, with hover to expand.

**Depends on:** SKB-03.2 (page hierarchy needed to compute ancestry path)

---

### SKB-03.5: Page Icons and Cover Images — 3 points, Medium

**Delivers:** Emoji icon picker component (searchable grid of common emojis) that appears when clicking the page icon area. Icon saved to `pages.icon` field via `PUT /api/pages/:id`. Cover image URL input — user provides a URL which is stored in `pages.cover_url` and rendered as a banner at the top of the page view. Icons displayed in sidebar page tree nodes alongside titles. Remove icon/cover actions.

**Depends on:** SKB-03.1 (page update endpoint must exist)

---

### SKB-03.6: Page Drag-and-Drop Reordering — 3 points, Medium

**Delivers:** Drag-and-drop functionality in the sidebar page tree allowing users to reorder pages within the same parent (updating `position` field) and move pages between parents (updating `parent_id` and `position`). Uses a lightweight DnD library (e.g., dnd-kit). Drop indicators show valid drop targets. API endpoint `PATCH /api/pages/:id/reorder` that accepts `{ parent_id, position }` and reorders siblings. Optimistic UI update with rollback on failure.

**Depends on:** SKB-03.3 (sidebar page tree must be rendered)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 03.1 | Zod schema validation (valid/invalid inputs), API response envelope shape | CRUD cycle: create → read → update → delete, tenant isolation (user A cannot see user B's pages) | Create page → see it in page view → edit title → delete |
| 03.2 | Circular reference detection, `getPageTree()` builds correct nested structure from flat list | Create parent → create child → move child to new parent → verify tree | Nested page creation from UI |
| 03.3 | `PageTree` renders correct nesting, expand/collapse state management | - | Expand/collapse tree nodes, click page to navigate, create new page from sidebar |
| 03.4 | Breadcrumb renders correct ancestry, truncation at 4+ levels | - | Navigate to deeply nested page → verify breadcrumb → click ancestor segment |
| 03.5 | Icon picker filters emojis by search term | Icon and cover_url saved and returned by API | Set icon → see in sidebar, set cover → see on page |
| 03.6 | Position reordering logic (insert at position N, shift siblings) | Reorder API updates positions correctly, cross-parent move updates both parent_id and position | Drag page to new position → verify order persisted on reload |

---

## Implementation Order

```
03.1 → 03.2 → 03.3 → 03.4 (sequential core path)
                  │
                  └──▶ 03.6 (after sidebar tree exists)

03.1 → 03.5 (can start in parallel with 03.2+)

Timeline visualization:
  03.1  Page CRUD API
    │
    ├──▶ 03.2  Page Hierarchy
    │     │
    │     ├──▶ 03.3  Sidebar Page Tree
    │     │     │
    │     │     └──▶ 03.6  Drag-and-Drop Reordering
    │     │
    │     └──▶ 03.4  Breadcrumb Navigation
    │
    └──▶ 03.5  Page Icons and Cover Images (parallel)
```

---

## Shared Constraints

- All API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- All database queries include `tenant_id` — enforced by `withTenant()` wrapper
- All input validated with Zod schemas — invalid input returns 400 with descriptive error
- Page titles have a maximum length of 500 characters
- Soft-delete pattern: `deleted_at` timestamp rather than row removal (enables future trash/restore feature)
- Deleting a parent page soft-deletes all descendants recursively
- TypeScript strict mode — all component props typed, no `any`
- TanStack Query used for all client-side data fetching with appropriate cache keys

---

## Files Created/Modified by This Epic

### New Files
- `src/app/api/pages/route.ts` — List and create pages
- `src/app/api/pages/[id]/route.ts` — Get, update, delete single page
- `src/app/api/pages/[id]/reorder/route.ts` — Reorder/move page
- `src/lib/pages/getPageTree.ts` — Build nested tree from flat page records
- `src/lib/pages/validation.ts` — Zod schemas for page input
- `src/components/workspace/PageTree.tsx` — Recursive sidebar tree component
- `src/components/workspace/PageTreeNode.tsx` — Individual tree node component
- `src/components/workspace/Breadcrumb.tsx` — Breadcrumb navigation component
- `src/components/workspace/EmojiPicker.tsx` — Emoji icon picker component
- `src/components/workspace/PageHeader.tsx` — Page header with icon, cover, title
- `src/components/workspace/CoverImage.tsx` — Cover image display component
- `src/hooks/usePages.ts` — TanStack Query hooks for page data
- `src/hooks/usePageTree.ts` — TanStack Query hook for tree data
- `src/types/page.ts` — Page-related TypeScript types

### Modified Files
- `src/app/(workspace)/pages/[id]/page.tsx` — Replace placeholder with actual page view
- `src/app/(workspace)/layout.tsx` — Integrate sidebar PageTree component
- `src/app/(workspace)/settings/page.tsx` — No changes (but depends on same layout)

---

**Last Updated:** 2026-02-21
