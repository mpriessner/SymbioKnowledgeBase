# SKB-48.7: Extend .skb-meta.json for Databases

**Story ID:** SKB-48.7
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 3
**Priority:** Medium
**Status:** Not Started
**Depends on:** SKB-48.1 (serializer must exist to compute content hashes)

---

## User Story

As the sync service, I need to track database files in the metadata file alongside pages, so I can detect changes, prevent redundant writes, and handle conflicts.

---

## What This Story Delivers

An extension of the `.skb-meta.json` format to include a `databases` section with the same tracking capabilities as pages: file path, content hash, last sync timestamp, and row count.

---

## Technical Specification

### Current .skb-meta.json Format (v1)

```json
{
  "version": 1,
  "tenantId": "00000000-...",
  "lastFullSync": "2026-03-23T10:00:00Z",
  "pages": {
    "page-uuid-1": {
      "id": "page-uuid-1",
      "filePath": "Welcome.md",
      "contentHash": "a1b2c3d4...",
      "lastSynced": "2026-03-23T10:00:00Z"
    }
  }
}
```

### New Format (v2)

```json
{
  "version": 2,
  "tenantId": "00000000-...",
  "lastFullSync": "2026-03-23T14:30:00Z",
  "pages": {
    "page-uuid-1": {
      "id": "page-uuid-1",
      "filePath": "Welcome.md",
      "contentHash": "a1b2c3d4...",
      "lastSynced": "2026-03-23T10:00:00Z"
    }
  },
  "databases": {
    "db-uuid-1": {
      "id": "db-uuid-1",
      "filePath": "Databases/Tasks.md",
      "contentHash": "e5f6a7b8...",
      "lastSynced": "2026-03-23T14:30:00Z",
      "rowCount": 15
    }
  }
}
```

### Type Definitions

```typescript
// src/lib/sync/types.ts

interface SyncDatabaseEntry {
  id: string;           // Database UUID
  filePath: string;     // Relative to tenant root (e.g., "Databases/Tasks.md")
  contentHash: string;  // MD5 hash of file content
  lastSynced: string;   // ISO 8601
  rowCount: number;     // For index generation without re-reading file
}

interface SyncMetadata {
  version: 2;           // Bumped from 1
  tenantId: string;
  lastFullSync: string;
  pages: Record<string, SyncPageEntry>;
  databases: Record<string, SyncDatabaseEntry>;  // NEW
}
```

### Migration (v1 → v2)

When reading a v1 metadata file:
1. Check `version` field
2. If `1` (or missing): add empty `databases: {}` and set `version: 2`
3. Write back immediately
4. No data loss — pages section untouched

```typescript
function migrateMetadata(meta: SyncMetadata): SyncMetadata {
  if (!meta.version || meta.version < 2) {
    return {
      ...meta,
      version: 2,
      databases: meta.databases || {},
    };
  }
  return meta;
}
```

### Conflict Detection

Reuse the same pattern as pages:

```typescript
async function hasDatabaseFileChanged(
  tenantId: string,
  databaseId: string
): Promise<boolean> {
  // Read metadata entry for database
  // Compute current file MD5
  // Compare to stored hash
}
```

---

## Files to Create

None.

## Files to Modify

- `src/lib/sync/types.ts` — Add `SyncDatabaseEntry`, update `SyncMetadata` to v2
- `src/lib/sync/SyncService.ts` — Add migration logic in `readSyncMetadata()`
- `src/lib/sync/conflict.ts` — Add `hasDatabaseFileChanged()` function (or make existing function generic)

---

## Acceptance Criteria

- [ ] `SyncDatabaseEntry` type defined with id, filePath, contentHash, lastSynced, rowCount
- [ ] `SyncMetadata` version bumped to 2 with `databases` section
- [ ] Reading v1 metadata auto-migrates to v2 without data loss
- [ ] Conflict detection works for database files
- [ ] Pages section completely untouched by migration
- [ ] Existing sync functionality unaffected (backward compatible)
- [ ] Unit tests for migration logic
- [ ] Unit tests for database conflict detection
