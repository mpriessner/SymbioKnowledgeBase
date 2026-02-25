# Story SKB-31.3: DB-to-Filesystem Live Sync

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-31.2 (mirror structure must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want my Markdown mirror files to update automatically whenever I save, rename, move, or delete a page in the browser, So that the filesystem mirror always reflects the latest state of my knowledge base without manual re-syncing.

---

## Acceptance Criteria

### Content Save → File Update
- [ ] When a page's content is saved (PUT /api/pages/{id}/blocks), the corresponding `.md` file is regenerated
- [ ] Regeneration happens asynchronously (does not block the API response)
- [ ] Regeneration is debounced: rapid saves within 500ms produce only one file write
- [ ] The `.md` file content matches what a fresh `tiptapToMarkdown()` would produce
- [ ] Frontmatter `updated` timestamp reflects the save time

### Page Rename → File Rename
- [ ] When a page title changes (PUT /api/pages/{id}), the `.md` file is renamed
- [ ] If the page is a folder (`_index.md`), the entire folder is renamed
- [ ] The `.skb-meta.json` fileMap is updated with the new path
- [ ] Wikilinks in OTHER files that reference this page are NOT updated (that's handled by the DB-level wikilink system)

### Page Move → File Move
- [ ] When a page's parentId changes, the `.md` file moves to the new parent folder
- [ ] If the page has children, the entire folder subtree moves
- [ ] Promotion/demotion logic applies:
  - Old parent loses its last child → demote from `_index.md` to `Parent.md`
  - New parent gains its first child → promote from `Parent.md` to `Parent/_index.md`

### Page Delete → File Delete
- [ ] When a page is deleted (DELETE /api/pages/{id}), the `.md` file is removed
- [ ] If the page has children (shouldn't happen, but defensively): delete entire folder
- [ ] Orphaned empty folders are cleaned up

### Page Create → File Create
- [ ] When a new page is created (POST /api/pages), a new `.md` file is generated
- [ ] File is placed in the correct folder based on parentId
- [ ] Frontmatter includes the new page's ID

### Sync Lock
- [ ] A per-file lock mechanism prevents the file watcher (SKB-31.4) from echoing back DB-triggered writes
- [ ] Lock is acquired before writing, held for 1 second after write completes
- [ ] Lock implementation: in-memory Set of file paths currently being written by DB→FS sync

### Error Handling
- [ ] If file write fails: log error, do not crash the server, retry once after 2 seconds
- [ ] If mirror directory doesn't exist: auto-create it
- [ ] If sync is disabled (MIRROR_SYNC_ENABLED=false): skip all filesystem writes

---

## Architecture Overview

```
DB→FS Sync Flow:
─────────────────

API Route (save/rename/move/delete)
        │
        ▼
Database updated (Prisma)
        │
        ▼
SyncService.onPageEvent(event) called
        │
        ├── event.type === "content_saved"
        │   → Debounce 500ms → regenerate .md file
        │
        ├── event.type === "renamed"
        │   → Rename file/folder on disk
        │   → Update .skb-meta.json
        │
        ├── event.type === "moved"
        │   → Move file/folder to new parent
        │   → Handle promotion/demotion
        │   → Update .skb-meta.json
        │
        ├── event.type === "deleted"
        │   → Delete file/folder
        │   → Clean up empty folders
        │   → Update .skb-meta.json
        │
        └── event.type === "created"
            → Create new .md file
            → Handle parent promotion if needed
            → Update .skb-meta.json

Sync Lock Mechanism:
────────────────────

const syncLock = new Set<string>();  // Set of file paths being written

function writeWithLock(filePath: string, content: string):
  syncLock.add(filePath)         // Lock
  fs.writeFileSync(filePath)     // Write
  setTimeout(() =>               // Hold lock 1s after write
    syncLock.delete(filePath),
    1000
  )

function isLockedByDbSync(filePath: string): boolean:
  return syncLock.has(filePath)  // File watcher checks this
```

---

## Implementation Steps

### Step 1: Create SyncService

**File: `src/lib/sync/SyncService.ts`** (create)

```typescript
export type SyncEvent =
  | { type: "content_saved"; pageId: string; tenantId: string }
  | { type: "renamed"; pageId: string; tenantId: string; oldTitle: string; newTitle: string }
  | { type: "moved"; pageId: string; tenantId: string; oldParentId: string | null; newParentId: string | null }
  | { type: "deleted"; pageId: string; tenantId: string }
  | { type: "created"; pageId: string; tenantId: string };

export class SyncService {
  private syncLock: SyncLock;
  private debounceTimers: Map<string, NodeJS.Timeout>;

  async onPageEvent(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case "content_saved":
        this.debouncedRegenerate(event.pageId, event.tenantId);
        break;
      case "renamed":
        await this.handleRename(event);
        break;
      case "moved":
        await this.handleMove(event);
        break;
      case "deleted":
        await this.handleDelete(event);
        break;
      case "created":
        await this.handleCreate(event);
        break;
    }
  }
}
```

### Step 2: Create SyncLock

**File: `src/lib/sync/SyncLock.ts`** (create)

```typescript
export class SyncLock {
  private locks = new Set<string>();
  private lockDuration = 1000; // 1 second

  acquire(filePath: string): void {
    this.locks.add(filePath);
  }

  release(filePath: string): void {
    this.locks.delete(filePath);
  }

  releaseAfterDelay(filePath: string): void {
    setTimeout(() => this.release(filePath), this.lockDuration);
  }

  isLocked(filePath: string): boolean {
    return this.locks.has(filePath);
  }
}
```

### Step 3: Hook Into API Routes

**File: `src/app/api/pages/[id]/blocks/route.ts`** (modify)

After successful block save, emit sync event:

```typescript
// After prisma.block.update():
syncService.onPageEvent({
  type: "content_saved",
  pageId,
  tenantId: ctx.tenantId,
});
```

**File: `src/app/api/pages/[id]/route.ts`** (modify)

After rename/move/delete, emit appropriate events.

### Step 4: Implement File Operations

Atomic writes, renames, moves, and deletes with proper error handling and sync lock management.

---

## Testing Requirements

### Unit Tests (10+ cases)

- Content save triggers debounced file regeneration
- Rename updates filename on disk
- Move relocates file to new folder
- Delete removes file
- Create generates new file
- Sync lock prevents echo within 1 second
- Debounce: 3 rapid saves produce 1 file write

### Integration Tests (6+ cases)

- Save page via API → .md file updated on disk
- Rename page → file renamed
- Move page to different parent → file moves, promotion/demotion works
- Delete page → file removed, empty folder cleaned
- Create page → new .md file appears

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sync/SyncService.ts` | Create | Core sync event handler |
| `src/lib/sync/SyncLock.ts` | Create | Per-file lock mechanism |
| `src/app/api/pages/[id]/blocks/route.ts` | Modify | Emit content_saved event |
| `src/app/api/pages/[id]/route.ts` | Modify | Emit rename/move/delete events |
| `src/app/api/pages/route.ts` | Modify | Emit created event |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
