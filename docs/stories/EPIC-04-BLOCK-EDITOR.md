# Epic 4: Block Editor

**Epic ID:** EPIC-04
**Created:** 2026-02-21
**Total Story Points:** ~26
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 4 integrates TipTap 3 as the core block editor for SymbioKnowledgeBase. It delivers all block types required by the PRD: paragraph, H1-H3, bulleted list, numbered list, to-do, toggle, quote, divider, callout, code block (with syntax highlighting via lowlight), image, and bookmark. Beyond block types, this epic also delivers the slash command menu, drag-and-drop block reordering, rich text formatting (bold, italic, strikethrough, inline code, hyperlinks), block type conversion, and undo/redo.

Block content is stored as JSONB in PostgreSQL via the `blocks` table, with each block belonging to a page. Auto-save with debounce ensures content is persisted without user intervention. The editor mounts within the page view delivered by Epic 3.

This epic covers FR8-14 (Block Editor) and FR34 (REST API block endpoints).

---

## Business Value

- The editor is the core interaction surface — users spend 90%+ of their time here
- Block-based architecture enables structured content that can be individually addressed by the API (critical for AI agents)
- Slash command menu provides discoverability of all block types without memorizing syntax
- Auto-save eliminates data loss anxiety
- Code block syntax highlighting serves developer-focused users
- Rich formatting and multiple block types match the capability baseline set by Notion/Obsidian

---

## Architecture Summary

```
Page View (from Epic 3)
┌────────────────────────────────────────────────────────────┐
│  PageHeader (icon, cover, title)                           │
│  ──────────────────────────────────────────                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  TipTap 3 Editor                                      │ │
│  │                                                        │ │
│  │  ┌─ Block (paragraph) ──────────────── [⋮ drag] ──┐  │ │
│  │  │  This is a paragraph with **bold** and _italic_ │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  ┌─ Block (heading H2) ────────────── [⋮ drag] ──┐   │ │
│  │  │  ## Section Title                               │   │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  ┌─ Block (code) ─────────────────── [⋮ drag] ──┐    │ │
│  │  │  ```typescript                                 │    │ │
│  │  │  const x = 42;                                 │    │ │
│  │  │  ```                                           │    │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  / ← Slash command triggers menu:                     │ │
│  │  ┌──────────────────────┐                              │ │
│  │  │ 📝 Paragraph          │                              │ │
│  │  │ H1 Heading 1          │                              │ │
│  │  │ H2 Heading 2          │                              │ │
│  │  │ • Bulleted List        │                              │ │
│  │  │ ☐ To-do List           │                              │ │
│  │  │ 💻 Code Block          │                              │ │
│  │  │ ...                    │                              │ │
│  │  └──────────────────────┘                              │ │
│  │                                                        │ │
│  │  [Formatting Toolbar: B I S ⌨ 🔗 ]                    │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
         │                              │
         │  Auto-save (debounced)       │  Manual save (Ctrl+S)
         ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│  API Layer                                                  │
│                                                              │
│  GET    /api/pages/:id/blocks  — Load all blocks for page   │
│  PUT    /api/pages/:id/blocks  — Save full editor content   │
│                                   (JSONB document)           │
│  POST   /api/pages/:id/blocks  — Create individual block    │
│                                   (for AI agent use)         │
│  PATCH  /api/blocks/:id        — Update single block        │
│  DELETE /api/blocks/:id        — Delete single block        │
│                                                              │
│  All routes wrapped with withTenant()                       │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│  PostgreSQL 18 — blocks table                               │
│                                                              │
│  id          UUID PRIMARY KEY                                │
│  tenant_id   UUID NOT NULL → tenants(id)                     │
│  page_id     UUID NOT NULL → pages(id)                       │
│  type        VARCHAR(50) NOT NULL                            │
│  content     JSONB NOT NULL  (TipTap document fragment)      │
│  position    INTEGER NOT NULL DEFAULT 0                      │
│  created_at  TIMESTAMPTZ                                     │
│  updated_at  TIMESTAMPTZ                                     │
│                                                              │
│  INDEX: (tenant_id, page_id, position)                       │
│                                                              │
│  Note: Editor saves the entire TipTap document as a single  │
│  JSONB payload for web UI. Individual block CRUD endpoints   │
│  are primarily for AI agent access.                          │
└────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-04.1: TipTap Editor Integration with Basic Blocks — 8 points, Critical

**Delivers:** TipTap 3 editor mounted inside the page view component from Epic 3. Basic block type extensions configured: paragraph, heading (H1-H3), bulleted list, numbered list, blockquote, and horizontal rule (divider). Editor loads content from `GET /api/pages/:id/blocks` on page load. Auto-save with 1-second debounce saves editor content via `PUT /api/pages/:id/blocks` as JSONB. Manual save via Ctrl+S. Loading and saving states indicated in UI. API endpoints for block CRUD: `GET /api/pages/:id/blocks`, `PUT /api/pages/:id/blocks`, `POST /api/pages/:id/blocks`, `PATCH /api/blocks/:id`, `DELETE /api/blocks/:id`.

**Depends on:** SKB-03.1 (page view component must exist to mount the editor in)

---

### SKB-04.2: Slash Command Menu — 3 points, High

**Delivers:** Typing "/" at the start of a block or after a space opens a floating menu listing all available block types. The menu filters results as the user continues typing after "/" (e.g., "/hea" filters to headings). Selecting a menu item converts the current block to that type and dismisses the menu. Menu is navigable with arrow keys and Enter. Escape dismisses the menu. Implemented as a TipTap suggestion extension.

**Depends on:** SKB-04.1 (editor must be mounted with base extensions)

---

### SKB-04.3: Rich Text Formatting — 3 points, High

**Delivers:** Inline formatting marks: bold (`Ctrl+B`), italic (`Ctrl+I`), strikethrough (`Ctrl+Shift+S`), inline code (`Ctrl+E`), hyperlink (`Ctrl+K` opens link input). Floating toolbar appears on text selection showing formatting options with active-state indicators. Markdown shortcuts supported (e.g., `**bold**`, `_italic_`, `` `code` ``). All formatting persisted as part of the JSONB block content.

**Depends on:** SKB-04.1 (editor must be mounted)

---

### SKB-04.4: Block Drag-and-Drop Reordering — 3 points, High

**Delivers:** Drag handle (six-dot icon) appears on the left side of each block on hover. Dragging a block reorders it within the page. Drop indicator line shows the insertion point. Position changes are reflected in the TipTap document structure and saved via the standard auto-save flow. Works with all block types including nested lists.

**Depends on:** SKB-04.1 (editor must be mounted with blocks rendered)

---

### SKB-04.5: Advanced Block Types — 5 points, High

**Delivers:** Six additional block type extensions for TipTap:
1. **To-do list** — Checkbox items with checked/unchecked state, clicking toggles state.
2. **Toggle** — Collapsible block with a triangle indicator; content hidden/shown on click.
3. **Callout** — Highlighted box with configurable icon and background color (info, warning, success, error variants).
4. **Code block** — Multi-line code editor with syntax highlighting via the lowlight library. Language selector dropdown. Copy button.
5. **Image block** — Accepts image URL or file upload (stored as URL). Renders image with optional caption. Resize handles.
6. **Bookmark block** — Accepts a URL, fetches Open Graph metadata (title, description, favicon) and renders a rich preview card.

All block types accessible via the slash command menu (from SKB-04.2 if completed, otherwise directly insertable).

**Depends on:** SKB-04.1 (editor must be mounted)

---

### SKB-04.6: Block Type Conversion and Undo/Redo — 4 points, Medium

**Delivers:** Block type conversion: users can change a block's type while preserving its text content (e.g., paragraph to H2, bulleted list to numbered list, paragraph to quote). Conversion available via slash command menu (typing "/" in an existing block) and via a block action menu (click the drag handle to open a menu with "Turn into" submenu). Undo (`Ctrl+Z`) and redo (`Ctrl+Shift+Z`) via TipTap's built-in History extension. Block deletion via backspace at start of empty block or via block action menu "Delete" option.

**Depends on:** SKB-04.1 (editor must be mounted)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 04.1 | TipTap editor initializes with correct extensions, JSONB serialization/deserialization round-trip, debounce timer fires correctly | Block content saved and loaded from DB, auto-save persists changes, API returns correct JSONB structure | Type in editor → navigate away → return → content preserved |
| 04.2 | Slash menu filters block types by query, keyboard navigation selects correct item | - | Type "/" → see menu → type "hea" → select Heading 1 → block converts |
| 04.3 | Each formatting mark toggles correctly, markdown shortcuts produce correct marks | - | Select text → click Bold → text is bold → Ctrl+Z → bold removed |
| 04.4 | Drag-and-drop reorders TipTap document nodes correctly | Position changes persisted via auto-save | Drag block to new position → reload → order preserved |
| 04.5 | Each block type renders correctly, to-do checkbox toggles, toggle collapses, code block applies syntax highlighting | Image upload URL stored correctly, bookmark fetches OG metadata | Insert each block type via slash menu → verify rendering |
| 04.6 | Type conversion preserves text content, undo/redo stack works for all operations | - | Convert paragraph to H2 → undo → paragraph restored |

---

## Implementation Order

```
04.1  TipTap Editor Integration (foundation — all other stories depend on this)
  │
  ├──▶ 04.2  Slash Command Menu
  │
  ├──▶ 04.3  Rich Text Formatting
  │
  ├──▶ 04.4  Block Drag-and-Drop
  │
  ├──▶ 04.5  Advanced Block Types
  │
  └──▶ 04.6  Block Type Conversion and Undo/Redo

Stories 04.2 through 04.5 can be developed in parallel after 04.1.
Story 04.6 can also start after 04.1 but benefits from 04.2 (slash menu for conversion).
```

---

## Shared Constraints

- All block content stored as JSONB using TipTap's native document format — no custom serialization
- Auto-save debounce set to 1000ms — saves only when user stops typing for 1 second
- Maximum document size: 1MB JSONB per page (validated server-side)
- All API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- All database queries include `tenant_id` — enforced by `withTenant()` wrapper
- TipTap extensions must be tree-shakeable — only import the extensions actually used
- Image uploads stored as URLs (external hosting or future file storage service) — not base64 in JSONB
- Code block syntax highlighting uses lowlight with a curated set of languages (JavaScript, TypeScript, Python, Go, Rust, SQL, JSON, HTML, CSS, Bash, Markdown)
- TypeScript strict mode — all TipTap extension configurations fully typed
- Keyboard shortcuts must not conflict with browser defaults

---

## Files Created/Modified by This Epic

### New Files
- `src/components/editor/BlockEditor.tsx` — Main TipTap editor component
- `src/components/editor/SlashCommandMenu.tsx` — Slash command floating menu
- `src/components/editor/FormattingToolbar.tsx` — Floating formatting toolbar
- `src/components/editor/DragHandle.tsx` — Block drag handle component
- `src/components/editor/BlockActionMenu.tsx` — Block context menu (turn into, delete)
- `src/components/editor/extensions/todo.ts` — To-do list TipTap extension
- `src/components/editor/extensions/toggle.ts` — Toggle/collapsible TipTap extension
- `src/components/editor/extensions/callout.ts` — Callout block TipTap extension
- `src/components/editor/extensions/codeBlock.ts` — Code block with lowlight extension
- `src/components/editor/extensions/imageBlock.ts` — Image block TipTap extension
- `src/components/editor/extensions/bookmark.ts` — Bookmark block TipTap extension
- `src/components/editor/extensions/slashCommand.ts` — Slash command suggestion extension
- `src/app/api/pages/[id]/blocks/route.ts` — Block CRUD endpoints for a page
- `src/app/api/blocks/[id]/route.ts` — Single block update/delete endpoints
- `src/lib/editor/blockTypes.ts` — Block type definitions and metadata
- `src/lib/editor/autoSave.ts` — Debounced auto-save logic
- `src/hooks/useEditor.ts` — TanStack Query hooks for editor data
- `src/hooks/useAutoSave.ts` — Auto-save hook with debounce
- `src/types/editor.ts` — Editor-related TypeScript types

### Modified Files
- `src/app/(workspace)/pages/[id]/page.tsx` — Mount BlockEditor component in page view
- `package.json` — Add TipTap 3 extensions, lowlight, dnd-kit dependencies

---

**Last Updated:** 2026-02-21
