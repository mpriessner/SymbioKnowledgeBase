# Story SKB-31.4: Filesystem-to-DB Live Sync

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.4
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-31.3 (sync lock mechanism must exist)

---

## User Story

As an AI agent or developer, I want to edit `.md` files directly in the filesystem mirror and have those changes automatically reflected in the database and browser, So that I can manipulate the knowledge base using standard file tools without going through the web API.

---

## Acceptance Criteria

### File Watcher
- [ ] A file watcher (chokidar) monitors the mirror directory for changes
- [ ] Watcher starts as part of the Next.js server or as a separate process (`scripts/watch-mirror.ts`)
- [ ] Watcher detects: file add, file change, file unlink (delete), directory unlink
- [ ] Watcher ignores: `.skb-meta.json`, `assets/` directories, `.git/`, temp files (`.tmp`, `.swp`, `~`)
- [ ] Watcher uses `awaitWriteFinish: { stabilityThreshold: 300 }` to avoid partial reads

### File Modified -> DB Update
- [ ] When a `.md` file is modified:
  1. Check sync lock -- if locked by DB->FS sync, ignore
  2. Read file content
  3. Parse frontmatter to extract page `id`
  4. Deserialize Markdown body -> ProseMirror JSON (existing deserializer)
  5. Update `Block.content` in the database
  6. Update `Page.updatedAt` timestamp
  7. If title in frontmatter differs from DB: update `Page.title`
- [ ] Changes debounced: rapid saves within 300ms produce one DB write
- [ ] After DB update, React Query cache invalidation triggers editor reload

### New File Created -> New Page
- [ ] When a new `.md` file appears:
  1. Check sync lock -- if locked, ignore
  2. Parse frontmatter -- if `id` matches existing page, treat as update
  3. If no `id`: create new Page record
  4. Determine parentId from folder position (file in `Projects/` -> parent is Projects page)
  5. Title from frontmatter or filename
  6. After creation: write page `id` back into file frontmatter
  7. Update `.skb-meta.json` fileMap
- [ ] New page appears in sidebar on next client fetch

### File Deleted -> Page Deleted
- [ ] When a `.md` file is deleted:
  1. Check sync lock -- if locked, ignore
  2. Look up page ID from `.skb-meta.json` fileMap
  3. Delete page from database
  4. Update `.skb-meta.json`
- [ ] Deleting `_index.md`: deletes parent page, moves children to root (configurable)
- [ ] Deleting a folder: deletes the page and all descendants

### File Renamed/Moved -> Page Renamed/Moved
- [ ] Chokidar emits rename as unlink + add -- watcher correlates within 500ms window
- [ ] On rename: update `Page.title`
- [ ] On move to different folder: update `Page.parentId`
- [ ] Handle promotion/demotion (leaf -> folder and vice versa)

### Sync Lock Integration
- [ ] Before writing to DB, acquire reverse lock so DB->FS sync does not echo back
- [ ] Lock held for 1 second after DB write completes
- [ ] Same SyncLock instance from SKB-31.3 used bidirectionally

### Configuration
- [ ] `MIRROR_WATCH_ENABLED` env var (default: true if MIRROR_DIR is set)
- [ ] Can run as part of server or standalone via `scripts/watch-mirror.ts`

---

## Architecture Overview

```
FS->DB Sync Flow:
-----------------

chokidar watches data/mirror/{tenant}/
        |
        +-- Event: "change" on Projects/Alpha.md
        |   |
        |   v
        |   syncLock.isLocked("Projects/Alpha.md")?
        |   +-- YES -> ignore (written by DB->FS sync)
        |   +-- NO -> continue
        |       |
        |       v
        |   Read file, parse frontmatter + body
        |   markdownToTiptap() -> ProseMirror JSON
        |       |
        |       v
        |   Acquire reverse lock
        |   prisma.block.update({ content: json })
        |   Release lock after 1s
        |
        +-- Event: "add" on Projects/New Page.md
        |   |
        |   v
        |   No "id" in frontmatter -> CREATE new page
        |   Parent from folder path -> "Projects" page
        |   prisma.page.create + prisma.block.create
        |   Write page ID back into frontmatter
        |
        +-- Event: "unlink" on Projects/Old.md
            |
            v
            Look up page ID from .skb-meta.json
            prisma.page.delete
            Update .skb-meta.json


Rename Detection (500ms window):
--------------------------------
  1. unlink: "Projects/Old Name.md"     t=0ms
  2. add:    "Projects/New Name.md"     t=50ms
  -> Same parent, within window -> RENAME
  -> Update Page.title, update fileMap
```

---

## Implementation Steps

### Step 1: Create FileWatcher Module

**File: `src/lib/sync/FileWatcher.ts`** (create)

- Chokidar watcher with ignore patterns
- Event handlers for change, add, unlink, unlinkDir
- Rename detection via buffered unlink+add correlation

### Step 2: Implement Change Handler

- Parse `.md` file, check sync lock, deserialize, update DB

### Step 3: Implement Add Handler

- New file -> check frontmatter ID -> create or update page
- Write ID back into frontmatter after creation

### Step 4: Implement Unlink Handler with Rename Detection

- Buffer unlink events for 500ms, correlate with add events
- Unmatched unlinks -> page deletion

### Step 5: Create Watch Script

**File: `scripts/watch-mirror.ts`** (create)

Standalone process that starts the file watcher.

### Step 6: Add chokidar Dependency

```bash
npm install chokidar
```

---

## Testing Requirements

### Unit Tests (12+ cases)

- File change -> DB block updated
- New file without ID -> page created, ID written back
- New file with existing ID -> treated as update
- File deleted -> page removed from DB
- Rename: unlink + add within 500ms -> title updated
- Rename: unlink + add after 500ms -> delete + create
- Sync-locked files -> ignored
- Invalid Markdown -> logged, not crashed
- File in subfolder -> correct parent assignment
- `_index.md` change -> parent page updated

### Integration Tests (8+ cases)

- Write `.md` to disk -> page appears in DB
- Modify `.md` -> block content updated
- Delete `.md` -> page removed
- Rename `.md` -> title updated
- Move `.md` to subfolder -> parentId updated
- Bidirectional: browser edit -> .md updates -> .md edit -> browser updates
- Sync lock: DB write -> no echo from watcher

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sync/FileWatcher.ts` | Create | Chokidar file watcher |
| `scripts/watch-mirror.ts` | Create | Standalone watcher process |
| `src/lib/sync/SyncService.ts` | Modify | Add FS->DB sync methods |
| `src/lib/sync/SyncLock.ts` | Modify | Bidirectional lock support |
| `package.json` | Modify | Add chokidar dependency |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
