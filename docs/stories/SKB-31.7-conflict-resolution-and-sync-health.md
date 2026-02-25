# Story SKB-31.7: Conflict Resolution & Sync Health

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.7
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-31.4 (both sync directions must be active)

---

## User Story

As a SymbioKnowledgeBase administrator, I want the sync system to handle conflicts gracefully when both the database and filesystem change simultaneously, and I want visibility into sync health and errors, So that I can trust the mirror is accurate and quickly diagnose any issues.

---

## Acceptance Criteria

### Conflict Detection
- [ ] A conflict occurs when a page is modified in the DB AND the corresponding `.md` file is modified within the same sync cycle (before either side has propagated)
- [ ] Detection method: compare `updatedAt` timestamps
  - DB side: `Block.updatedAt` / `Page.updatedAt`
  - FS side: file `mtime` (modification time)
  - If both changed since last known sync time -> conflict
- [ ] The `.skb-meta.json` tracks `lastSyncedAt` per file for conflict detection

### Conflict Resolution Strategy
- [ ] Default strategy: **Last-write-wins** (most recent timestamp wins)
- [ ] The losing version is saved as a `.conflict` backup file:
  - Example: `Projects/Alpha.md.conflict.2026-02-25T12-30-00`
  - Contains the full content of the losing version
  - Preserved for manual review
- [ ] `.conflict` files are ignored by the file watcher (not synced back)
- [ ] Conflict backup files older than 7 days are auto-cleaned

### Conflict Backup Format
- [ ] Conflict files include a header comment:
  ```markdown
  <!-- SYNC CONFLICT
  Source: database (or filesystem)
  Original timestamp: 2026-02-25T12:30:00Z
  Conflicted with: filesystem (or database)
  Conflict timestamp: 2026-02-25T12:30:05Z
  Resolution: last-write-wins (filesystem version kept)
  -->

  (original content follows)
  ```

### Sync Health Logging
- [ ] All sync operations are logged with structured logging:
  - `[SYNC] DB->FS: Updated Projects/Alpha.md (page-uuid, 2.3kb, 45ms)`
  - `[SYNC] FS->DB: Updated page-uuid from Projects/Alpha.md (1.8kb, 120ms)`
  - `[SYNC] CONFLICT: Projects/Alpha.md - DB and FS both modified, keeping FS version`
  - `[SYNC] ERROR: Failed to write Projects/Alpha.md - Permission denied`
- [ ] Log level configurable via `SYNC_LOG_LEVEL` env var (debug, info, warn, error)
- [ ] Errors logged at `error` level, conflicts at `warn`, normal ops at `info`

### Sync Health API
- [ ] `GET /api/sync/health` returns sync status:
  ```json
  {
    "status": "healthy",
    "lastSyncAt": "2026-02-25T12:30:00Z",
    "mirrorDir": "data/mirror/",
    "watcherRunning": true,
    "stats": {
      "totalPages": 42,
      "totalFiles": 42,
      "lastDbToFs": "2026-02-25T12:29:55Z",
      "lastFsToDb": "2026-02-25T12:30:00Z",
      "conflictsToday": 0,
      "errorsToday": 1,
      "pendingSync": 0
    }
  }
  ```
- [ ] Status values: `healthy`, `degraded` (errors > 0), `stale` (last sync > 5 minutes)

### Error Recovery
- [ ] Failed DB->FS writes: retry once after 2 seconds, then log and skip
- [ ] Failed FS->DB writes: retry once after 2 seconds, then log and skip
- [ ] Parse errors (invalid Markdown): log the error with file path, skip the file, do not crash
- [ ] Missing mirror directory: auto-create on next sync attempt
- [ ] Corrupt `.skb-meta.json`: regenerate from DB (full re-sync)

### Sync Integrity Check
- [ ] CLI command: `npx tsx scripts/sync-check.ts` verifies mirror integrity
- [ ] Compares all DB pages against filesystem files
- [ ] Reports: missing files, extra files, content mismatches, stale files
- [ ] Supports `--fix` flag to auto-repair discrepancies (re-sync from DB)
- [ ] Example output:
  ```
  Sync integrity check for tenant abc:
  OK: 40/42 pages in sync
  MISSING: 2 files not on disk (Projects/Beta.md, Archive/Old.md)
  EXTRA: 0 files on disk without DB page
  STALE: 0 files with outdated content
  Run with --fix to repair.
  ```

---

## Architecture Overview

```
Conflict Detection:
-------------------

.skb-meta.json tracks per-file sync state:
{
  "fileMap": { ... },
  "syncState": {
    "page-uuid-1": {
      "lastSyncedAt": "2026-02-25T12:00:00Z",
      "dbUpdatedAt": "2026-02-25T12:00:00Z",
      "fsModifiedAt": "2026-02-25T12:00:00Z",
      "checksum": "sha256..."
    }
  }
}

Conflict scenario:
  t=0:   Last sync: DB and FS in agreement
  t=1s:  User edits in browser -> DB updated
  t=1.5s: Agent edits .md file -> FS modified
  t=2s:  DB->FS sync fires -> detects FS also changed!
         -> CONFLICT

Resolution:
  1. Compare timestamps: FS change at 1.5s vs DB change at 1.0s
  2. FS is newer -> FS wins
  3. Save DB version as .conflict file
  4. FS->DB sync propagates FS content to DB
  5. Log conflict event


Error Recovery Flow:
--------------------

Sync operation fails
        |
        v
Retry once after 2 seconds
        |
    +---+---+
    |       |
  SUCCESS  FAIL
    |       |
    v       v
  Continue  Log error, skip
            Add to error count
            Continue with next file
```

---

## Implementation Steps

### Step 1: Add Sync State to Metadata

**File: `src/lib/sync/types.ts`** (modify)

Add `syncState` tracking to `.skb-meta.json` schema.

### Step 2: Implement Conflict Detection

**File: `src/lib/sync/ConflictResolver.ts`** (create)

```typescript
export class ConflictResolver {
  detectConflict(pageId: string, dbUpdatedAt: Date, fsModifiedAt: Date, lastSyncedAt: Date): boolean {
    return dbUpdatedAt > lastSyncedAt && fsModifiedAt > lastSyncedAt;
  }

  resolve(pageId: string, dbContent: string, fsContent: string, dbTime: Date, fsTime: Date): ConflictResolution {
    const winner = fsTime > dbTime ? "filesystem" : "database";
    const loserContent = winner === "filesystem" ? dbContent : fsContent;
    return { winner, loserContent, backupPath: generateConflictPath(...) };
  }
}
```

### Step 3: Implement Sync Health API

**File: `src/app/api/sync/health/route.ts`** (create)

### Step 4: Create Integrity Check Script

**File: `scripts/sync-check.ts`** (create)

### Step 5: Add Structured Logging

**File: `src/lib/sync/SyncLogger.ts`** (create)

### Step 6: Implement Conflict Cleanup Cron

Auto-delete `.conflict` files older than 7 days (run on server startup or via cron).

---

## Testing Requirements

### Unit Tests (8+ cases)

- Conflict detected when both sides change after last sync
- No conflict when only one side changes
- Last-write-wins: newer timestamp wins
- Conflict file created with correct header
- Conflict files older than 7 days cleaned up
- Health status: healthy when no errors
- Health status: degraded when errors > 0
- Health status: stale when last sync > 5 minutes

### Integration Tests (6+ cases)

- Simultaneous DB + FS edit -> conflict file created, winner propagated
- GET /api/sync/health returns correct stats
- Integrity check detects missing file
- Integrity check with --fix repairs missing file
- Parse error in .md -> logged, not crashed, other files unaffected
- Corrupt .skb-meta.json -> full re-sync triggered

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sync/ConflictResolver.ts` | Create | Conflict detection and resolution |
| `src/lib/sync/SyncLogger.ts` | Create | Structured sync logging |
| `src/app/api/sync/health/route.ts` | Create | Sync health API |
| `scripts/sync-check.ts` | Create | Integrity check CLI |
| `src/lib/sync/types.ts` | Modify | Add syncState schema |
| `src/lib/sync/SyncService.ts` | Modify | Integrate conflict resolver |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
