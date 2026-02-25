# Epic 26: Markdown Filesystem Mirror — Bidirectional Sync

**Epic ID:** EPIC-26
**Created:** 2026-02-25
**Total Story Points:** 40
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 26 introduces a **Markdown filesystem mirror** — a persistent, bidirectional synchronization between the PostgreSQL database (ProseMirror JSON) and a physical folder structure of `.md` files on disk. Every page in SymbioKnowledgeBase gets a corresponding Markdown file in a directory hierarchy that mirrors the page tree. Changes flow in both directions:

- **Editor → Filesystem:** When a user edits a page in the browser, the corresponding `.md` file is regenerated automatically.
- **Filesystem → Database:** When an agent (or human) edits a `.md` file directly, the changes are parsed and written back to the database, and the editor reflects them.

This gives agents a **native, browsable file system** — they can `ls`, `cat`, `grep`, create, edit, and delete `.md` files, and those changes appear in the app instantly. Files (images, PDFs, etc.) placed in a page's folder become attachments linked with relative paths.

### Why This Matters

1. **Agent-first:** LLMs read and write Markdown natively. A folder of `.md` files is the simplest possible interface for an agent to navigate, understand, and modify a knowledge base — no JSON parsing, no API calls needed.
2. **Git-friendly:** The entire knowledge base becomes a git repository. Version history, diffs, branches, PRs — all work naturally on Markdown files.
3. **Portable:** The folder IS the backup. Copy it anywhere. Open it in VS Code, Obsidian, or any text editor.
4. **File co-location:** Attachments (images, PDFs) live next to the page that references them. Relative paths (`./assets/diagram.png`) mean links never break when browsing the file tree.

### What Already Exists

The codebase has strong foundations:
- **Markdown serializer** (`src/lib/markdown/serializer.ts`, 364 lines) — Converts ProseMirror JSON → Markdown, handles 27 block types including callouts, toggles, bookmarks, wikilinks
- **Markdown deserializer** (`src/lib/markdown/deserializer.ts`, 384 lines) — Converts Markdown → ProseMirror JSON using unified + remark-parse + remark-gfm
- **Bulk ZIP export** (`GET /api/pages/export`) — Already generates folder hierarchy with `.md` files
- **Single file import** (`POST /api/pages/import`) — Parses `.md` with frontmatter and creates pages
- **FileAttachment model** (`prisma/schema.prisma:526-552`) — Schema exists but no storage backend is wired

### What This Epic Adds

1. **Persistent mirror directory** on disk (e.g., `data/mirror/`) that stays in sync with the DB
2. **Live DB→Filesystem sync** — every save triggers `.md` regeneration
3. **Live Filesystem→DB sync** — file watcher detects `.md` changes and updates the DB
4. **File attachments** co-located with pages, linked by relative paths
5. **Agent MCP tools** for browsing and manipulating the filesystem mirror
6. **Conflict resolution** when both sides change simultaneously
7. **Round-trip test suite** ensuring JSON↔Markdown conversion is deterministic

**Out of scope:**
- Git integration (auto-commit on change) — future enhancement
- Real-time collaborative editing via filesystem (websocket sync is out of scope)
- Cloud storage backends (S3, GCS) — local filesystem only for now

**Dependencies:**
- TipTap editor with block content (done)
- Markdown serializer/deserializer (done)
- Page hierarchy with parentId (done)
- FileAttachment model in Prisma (schema exists)

---

## Business Value

- **10x Agent Productivity:** Agents can read/write entire knowledge bases through the file system — the simplest possible interface. No API authentication, no JSON parsing, no pagination.
- **Developer Experience:** Developers can edit pages in VS Code, grep across all content, and use standard Unix tools.
- **Backup & Portability:** The mirror directory IS a complete backup. Copy it to another machine, open it in Obsidian, or push it to GitHub.
- **Auditability:** Git history on the mirror directory gives line-by-line change tracking for free.
- **Offline Access:** The mirror directory is readable without the server running.

---

## Architecture Summary

```
Bidirectional Sync Architecture:
─────────────────────────────────

                 ┌─────────────────────┐
                 │   Browser Editor    │
                 │   (TipTap/React)    │
                 └────────┬────────────┘
                          │ editor.getJSON()
                          ▼
                 ┌─────────────────────┐
                 │   Next.js API       │
                 │   PUT /api/pages/   │
                 │   {id}/blocks       │
                 └────────┬────────────┘
                          │ prisma.block.update()
                          ▼
              ┌──────────────────────────┐
              │     PostgreSQL           │
              │  Block.content (Json)    │ ◄── Source of truth
              │  Page (title, parent,    │     for structured data
              │        position, etc.)   │
              └────────────┬─────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            │            ▼
    ┌─────────────┐        │   ┌─────────────────┐
    │ DB→FS Sync  │        │   │  FS→DB Sync     │
    │ (on save)   │        │   │  (file watcher)  │
    │             │        │   │                  │
    │ serialize() │        │   │ deserialize()    │
    │ JSON → MD   │        │   │ MD → JSON        │
    └──────┬──────┘        │   └────────┬─────────┘
           │               │            │
           ▼               │            ▲
    ┌──────────────────────┴────────────┴──┐
    │         Filesystem Mirror            │
    │         data/mirror/                 │
    │                                      │
    │  tenant-abc/                         │
    │  ├── Welcome.md                      │
    │  ├── Welcome/                        │
    │  │   └── assets/                     │
    │  │       └── screenshot.png          │
    │  ├── Projects/                       │
    │  │   ├── _index.md                   │
    │  │   ├── Project Alpha.md            │
    │  │   └── Project Alpha/              │
    │  │       └── assets/                 │
    │  │           └── architecture.pdf    │
    │  ├── Daily Journal/                  │
    │  │   ├── _index.md                   │
    │  │   ├── 2026-02-25.md               │
    │  │   └── 2026-02-24.md               │
    │  └── .skb-meta.json                  │ ◄── Sync metadata
    └──────────────────────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │   Agent / CLI /      │
    │   VS Code / Git      │
    │                      │
    │   - Read .md files   │
    │   - Edit .md files   │
    │   - Create new .md   │
    │   - Place attachments│
    │   - git commit/push  │
    └──────────────────────┘


Folder Structure Rules:
───────────────────────

Rule 1: Leaf page (no children)
  → Single .md file at parent level
  Example: "Welcome.md"

Rule 2: Page WITH children
  → Folder named after page + _index.md inside
  Example: "Projects/_index.md" (the Projects page)
           "Projects/Project Alpha.md" (child page)

Rule 3: Attachments
  → Inside a folder named after the page + /assets/
  Example: "Welcome/assets/screenshot.png"
  Referenced: ![Screenshot](./Welcome/assets/screenshot.png)

Rule 4: Multi-tenant
  → Each tenant gets its own root folder
  Example: data/mirror/tenant-abc/
           data/mirror/tenant-def/


Markdown File Format:
─────────────────────

---
id: "page-uuid-here"
title: "Welcome to SymbioKnowledgeBase"
icon: "🏗"
parent: "parent-uuid-or-null"
position: 0
spaceType: "PRIVATE"
created: "2026-02-25T10:00:00Z"
updated: "2026-02-25T12:30:00Z"
---

# Welcome to SymbioKnowledgeBase

Your **AI-agent-first** knowledge management platform.

---

## Quick Start

1. Create pages and organize them
2. Use [[wikilinks]] to connect knowledge
3. Let agents browse your files

> [!info] Getting Started
> Check the documentation for setup instructions.

<details>
<summary>Advanced Configuration</summary>

Configure your workspace settings...

</details>


Sync Event Flow:
────────────────

USER EDITS IN BROWSER:
  1. Editor saves → PUT /api/pages/{id}/blocks
  2. API updates Block.content in PostgreSQL
  3. After successful DB write → SyncService.onPageSaved(pageId)
  4. SyncService reads page + blocks from DB
  5. SyncService serializes to Markdown (using existing serializer)
  6. SyncService writes .md file to disk (with file lock)
  7. File watcher ignores this write (sync lock prevents echo)

AGENT EDITS .MD FILE:
  1. Agent writes to data/mirror/tenant-abc/Welcome.md
  2. File watcher (chokidar) detects change
  3. SyncService reads the .md file
  4. SyncService checks sync lock — not locked by DB→FS, so proceed
  5. SyncService deserializes Markdown → ProseMirror JSON
  6. SyncService writes Block.content to PostgreSQL
  7. DB→FS sync is suppressed for this write (sync lock)
  8. If editor is open, React Query cache invalidation → editor reloads

AGENT CREATES NEW .MD FILE:
  1. Agent creates data/mirror/tenant-abc/Projects/New Page.md
  2. File watcher detects new file
  3. SyncService parses frontmatter — no "id" field → new page
  4. SyncService creates Page record in DB (title from filename or frontmatter)
  5. SyncService creates Block with deserialized content
  6. SyncService updates the .md file frontmatter with the new page ID
  7. Page appears in sidebar
```

---

## Stories Breakdown

### SKB-26.1: Round-Trip Fidelity & Format Specification — 3 points, High

**Delivers:** A documented specification of the Markdown format covering all 12 TipTap extensions, YAML frontmatter schema, and a comprehensive round-trip test suite that proves JSON→Markdown→JSON conversion is lossless for every supported block type.

**Depends on:** Nothing (first story — foundational)

---

### SKB-26.2: Filesystem Mirror — Initial Sync & Folder Structure — 8 points, High

**Delivers:** A CLI command and API endpoint that generates the full filesystem mirror from the database. Defines the folder structure rules, page naming conventions, slug generation, and the `.skb-meta.json` metadata file. Running the command produces a complete, browsable folder of `.md` files.

**Depends on:** SKB-26.1 (serialization must be deterministic first)

---

### SKB-26.3: DB-to-Filesystem Live Sync — 5 points, High

**Delivers:** Automatic `.md` file regeneration whenever a page is saved, renamed, moved, or deleted through the editor/API. Uses a sync lock to prevent the file watcher from echoing changes back.

**Depends on:** SKB-26.2 (mirror structure must exist)

---

### SKB-26.4: Filesystem-to-DB Live Sync — 8 points, High

**Delivers:** A file watcher (chokidar) that detects changes to `.md` files and propagates them to the database. Handles file creation (new pages), modification (content updates), deletion (page removal), and rename/move (title/parent changes).

**Depends on:** SKB-26.3 (sync lock mechanism must exist)

---

### SKB-26.5: File Attachments & Relative Linking — 5 points, Medium

**Delivers:** Attachments (images, PDFs, etc.) stored in per-page `assets/` folders alongside `.md` files. Relative path linking in Markdown (`![](./assets/image.png)`). Automatic link updating when pages are moved. Wires the existing `FileAttachment` model to local filesystem storage.

**Depends on:** SKB-26.3 (sync must be active to handle attachment references)

---

### SKB-26.6: Agent Filesystem API & MCP Tools — 8 points, High

**Delivers:** An MCP server with tools for agents to browse, read, write, search, and manipulate the filesystem mirror programmatically. Includes tools for listing pages, reading content, creating/editing pages, searching across all files, and resolving wikilinks.

**Depends on:** SKB-26.4 (filesystem must be fully synced both ways)

---

### SKB-26.7: Conflict Resolution & Sync Health — 3 points, Medium

**Delivers:** Conflict detection when both the DB and filesystem change simultaneously, last-write-wins strategy with `.conflict` backup files, sync health logging, error recovery, and a health-check endpoint.

**Depends on:** SKB-26.4 (both sync directions must be active)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 26.1 | Round-trip for each of 27 block types; frontmatter serialization/deserialization | Full document round-trip with mixed content; edge cases (empty pages, huge pages) | N/A |
| 26.2 | Folder structure generation; slug naming; parent→folder mapping | Full DB export → verify folder structure matches page tree | CLI command produces correct mirror |
| 26.3 | Sync lock mechanism; file write debouncing | Save page → .md file updates; rename page → file moves; delete page → file deleted | Edit in browser → verify .md changes |
| 26.4 | File watcher event handling; .md parsing; new file detection | Edit .md → DB updates; create .md → page appears; delete .md → page removed | Agent edits file → browser shows change |
| 26.5 | Relative path generation; link updating on move | Place image in assets/ → referenced in page; move page → links update | Upload image → visible in editor and .md |
| 26.6 | MCP tool parameter validation; response formatting | Browse → read → edit → verify round-trip via MCP tools | Agent creates page via MCP → visible in app |
| 26.7 | Conflict detection logic; .conflict file creation | Simultaneous edit → conflict file created; sync recovers | Stress test: rapid edits from both sides |

---

## Implementation Order

```
26.1 → 26.2 → 26.3 → 26.4 → 26.5
                 │              │
                 └──────┬───────┘
                        ▼
                      26.6 → 26.7

┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 26.1   │──▶│ 26.2   │──▶│ 26.3   │──▶│ 26.4   │──▶│ 26.5   │
│Round-  │   │Initial │   │DB→FS   │   │FS→DB   │   │Attach- │
│Trip    │   │Mirror  │   │Sync    │   │Sync    │   │ments   │
└────────┘   └────────┘   └───┬────┘   └───┬────┘   └────────┘
                              │            │
                              └──────┬─────┘
                                     ▼
                              ┌────────┐   ┌────────┐
                              │ 26.6   │──▶│ 26.7   │
                              │MCP     │   │Conflict│
                              │Tools   │   │Resolve │
                              └────────┘   └────────┘
```

---

## Shared Constraints

- **Multi-Tenant Isolation:** Each tenant gets its own mirror root directory. No cross-tenant file access.
- **Atomic Writes:** File writes use temp file + rename to avoid partial reads.
- **Sync Lock:** A per-file lock mechanism prevents infinite sync loops (DB changes trigger FS write, which triggers FS watcher, which would trigger DB write without the lock).
- **Debouncing:** Rapid edits debounce to a single filesystem write (500ms default).
- **Error Resilience:** Sync failures are logged but never crash the server. Failed syncs retry with exponential backoff.
- **Performance:** Initial sync of 1,000 pages should complete in < 10 seconds. Live sync latency should be < 500ms.
- **Encoding:** All `.md` files are UTF-8. Filenames use URL-safe slugs.
- **Existing Code:** Maximize reuse of existing serializer, deserializer, and import/export logic.
- **TypeScript Strict:** No `any` types.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/sync/SyncService.ts` — Core bidirectional sync engine
- `src/lib/sync/FileWatcher.ts` — Chokidar-based file watcher
- `src/lib/sync/SyncLock.ts` — Per-file sync lock to prevent echo loops
- `src/lib/sync/FolderStructure.ts` — Page tree → folder mapping logic
- `src/lib/sync/slug.ts` — Filename slug generation (title → safe filename)
- `src/lib/sync/types.ts` — Sync-related TypeScript types
- `src/lib/sync/config.ts` — Mirror directory configuration
- `src/app/api/sync/route.ts` — Sync status / trigger API
- `src/app/api/sync/health/route.ts` — Sync health check endpoint
- `src/mcp/server.ts` — MCP server for agent filesystem tools
- `src/mcp/tools/` — Individual MCP tool definitions
- `scripts/sync-mirror.ts` — CLI command for initial/full sync
- `docs/MARKDOWN-FORMAT-SPEC.md` — Format specification document
- Tests for every component

### Modified Files
- `src/lib/markdown/serializer.ts` — Fix any round-trip gaps
- `src/lib/markdown/deserializer.ts` — Fix any round-trip gaps
- `src/app/api/pages/[id]/blocks/route.ts` — Hook into sync service on save
- `src/app/api/pages/[id]/route.ts` — Hook into sync on rename/move/delete
- `prisma/schema.prisma` — Add SyncState model if needed
- `package.json` — Add chokidar, nanoid dependencies

---

**Last Updated:** 2026-02-25
