# SKB-48.4: DB→FS Sync for Databases

**Story ID:** SKB-48.4
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 5
**Priority:** High
**Status:** Not Started
**Depends on:** SKB-48.1 (serializer), SKB-48.7 (metadata extension)

---

## User Story

As a user, when I create or edit a database in the web UI, I want the corresponding Markdown file to update automatically in the mirror directory, so the filesystem always reflects the current state.

---

## What This Story Delivers

Integration between the database API routes and the sync service. When databases or rows are created, updated, or deleted through the app, the `Databases/` directory in the mirror stays in sync.

---

## Technical Specification

### New Functions

```typescript
// src/lib/sync/DatabaseSync.ts

/**
 * Sync a single database to the filesystem.
 * Fetches the database + all rows, serializes to markdown,
 * and writes to Databases/{title}.md.
 */
async function syncDatabaseToFilesystem(
  tenantId: string,
  databaseId: string
): Promise<void>;

/**
 * Remove a database's .md file from the filesystem.
 */
async function deleteDatabaseFile(
  tenantId: string,
  databaseId: string
): Promise<void>;

/**
 * Sync ALL databases for a tenant (used in fullSync).
 */
async function fullDatabaseSync(
  tenantId: string
): Promise<number>;
```

### Sync Triggers

Add sync calls to these existing API routes:

| Route | Event | Sync Action |
|-------|-------|-------------|
| `POST /api/databases` | Database created | `syncDatabaseToFilesystem()` |
| `PUT /api/databases/[id]` | Schema updated | `syncDatabaseToFilesystem()` |
| `PATCH /api/databases/[id]` | View config changed | No sync (view config is UI-only) |
| `DELETE /api/databases/[id]` | Database deleted | `deleteDatabaseFile()` |
| `POST /api/databases/[id]/rows` | Row created | `syncDatabaseToFilesystem()` |
| `PUT /api/databases/[id]/rows/[rowId]` | Row updated | `syncDatabaseToFilesystem()` |
| `DELETE /api/databases/[id]/rows/[rowId]` | Row deleted | `syncDatabaseToFilesystem()` |

### File Naming

- Directory: `data/mirror/{tenantId}/Databases/`
- File name: `{databaseTitle}.md` using existing `fileSlug()` from `src/lib/sync/slug.ts`
- Duplicate titles: append numeric suffix (`Tasks.md`, `Tasks-2.md`)
- On rename: delete old file, write new file

### Integration with fullSync

Extend the existing `fullSync()` in `SyncService.ts` to also call `fullDatabaseSync()` after page sync:

```typescript
export async function fullSync(tenantId: string): Promise<number> {
  const pageCount = await syncPagesToFilesystem(tenantId, pages);
  const dbCount = await fullDatabaseSync(tenantId);  // NEW
  return pageCount + dbCount;
}
```

### Sync Lock Usage

Reuse the existing `syncLock` from `SyncLock.ts`:
1. Acquire lock for database file path before writing
2. Write file atomically
3. Release lock after timeout (same 1-second pattern as pages)

---

## Files to Create

- `src/lib/sync/DatabaseSync.ts` — Database sync orchestration

## Files to Modify

- `src/lib/sync/SyncService.ts` — Call `fullDatabaseSync()` in `fullSync()`
- `src/lib/sync/config.ts` — Add `DATABASES_DIR = "Databases"` constant
- `src/app/api/databases/route.ts` — Hook sync on POST
- `src/app/api/databases/[id]/route.ts` — Hook sync on PUT, DELETE
- `src/app/api/databases/[id]/rows/route.ts` — Hook sync on POST
- `src/app/api/databases/[id]/rows/[rowId]/route.ts` — Hook sync on PUT, DELETE

---

## Acceptance Criteria

- [ ] Database creation → `.md` file appears in `Databases/` with correct content
- [ ] Row CRUD → `.md` file regenerated with updated table
- [ ] Schema change → `.md` file frontmatter updated
- [ ] Database deletion → `.md` file removed
- [ ] Database rename → old file deleted, new file created
- [ ] Sync lock prevents FileWatcher echo
- [ ] Atomic writes (no partial file reads)
- [ ] `.skb-meta.json` updated with database entry
- [ ] `fullSync()` includes databases
- [ ] Duplicate database titles handled with numeric suffix
- [ ] Agent API routes (`/api/agent/databases/`) also trigger sync

---

## Implementation Notes

- Keep sync calls non-blocking (fire-and-forget with error logging). A sync failure should never cause the API response to fail.
- Use `try/catch` around sync calls in API routes and log errors via `console.error`.
- The `Databases/` directory should be created automatically on first database sync.
- Consider debouncing rapid row changes (e.g., bulk import of 50 rows) — don't regenerate the entire file 50 times. A simple debounce of 500ms per database ID would work.
