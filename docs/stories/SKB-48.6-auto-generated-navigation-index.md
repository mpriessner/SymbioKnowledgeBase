# SKB-48.6: Auto-Generated Navigation Index

**Story ID:** SKB-48.6
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 5
**Priority:** Medium
**Status:** Not Started
**Depends on:** SKB-48.4 (databases must be in mirror for index to list them)

---

## User Story

As an agent or human browsing the mirror folder, I want a table of contents file at the root that lists all pages and databases, so I can quickly understand the scope and find what I need.

---

## What This Story Delivers

An auto-generated `_index.md` file at the root of each tenant's mirror directory. It provides:
1. A hierarchical list of all pages (with icons, links, and nesting)
2. A list of all databases (with row/column counts and links)
3. Summary statistics (total pages, databases, last sync time)

The file is regenerated after every sync event and is marked as auto-generated so the FileWatcher ignores it.

---

## Technical Specification

### Output Format

```markdown
---
generated: true
type: index
updated: 2026-03-23T14:30:00Z
---

# Knowledge Base Index

> Auto-generated table of contents. Do not edit — changes will be overwritten on next sync.

## Summary

- **Pages:** 47
- **Databases:** 3
- **Last sync:** 2026-03-23T14:30:00Z

## Pages

- 🏗️ [System Architecture](System Architecture/_index.md)
  - [Data Models & Schema](System Architecture/Data Models & Schema.md)
  - [Developer Setup Guide](System Architecture/Developer Setup Guide.md)
- 📝 [Meeting Notes](Meeting Notes/_index.md)
  - [2026-03-20 Standup](Meeting Notes/2026-03-20 Standup.md)
  - [2026-03-18 Planning](Meeting Notes/2026-03-18 Planning.md)
- [Welcome](Welcome.md)
- [Quick Start Guide](Quick Start Guide.md)

## Databases

- ✅ [Tasks](Databases/Tasks.md) — 15 rows, 6 columns
- 👥 [Contacts](Databases/Contacts.md) — 42 rows, 8 columns
- 📚 [Reading List](Databases/Reading List.md) — 7 rows, 4 columns
```

### Function Signature

```typescript
// src/lib/sync/IndexGenerator.ts

/**
 * Generate the _index.md content for a tenant's mirror root.
 * Reads current page tree and database list from .skb-meta.json
 * and the database files themselves.
 */
async function generateIndex(tenantId: string): Promise<string>;

/**
 * Write the _index.md file. Acquires sync lock to prevent
 * FileWatcher from processing it.
 */
async function writeIndex(tenantId: string): Promise<void>;
```

### Generation Logic

1. Read `.skb-meta.json` to get all page entries with file paths
2. Build hierarchical tree from page parent relationships
3. Read database entries from `.skb-meta.json` databases section
4. For each database, read the `.md` file to count rows (or use stored `rowCount`)
5. Render markdown with proper indentation and links
6. Write with sync lock

### FileWatcher Ignore Rule

The FileWatcher must skip `_index.md`:

```typescript
// In FileWatcher.ts, add to the ignore logic:
if (filename === '_index.md') return; // Auto-generated, skip
```

Alternatively, check for `generated: true` in frontmatter, but filename check is simpler and faster.

### Regeneration Triggers

Call `writeIndex(tenantId)` after:
- `fullSync()` completes
- `syncPageToFilesystem()` completes
- `syncDatabaseToFilesystem()` completes
- `deletePageFile()` completes
- `deleteDatabaseFile()` completes

**Debounce:** Since multiple sync operations can happen in quick succession, debounce index regeneration with a 1-second window. Only the last trigger in the window actually writes.

### Page Tree Rendering

- Pages sorted by `position` (same as sidebar)
- Nested pages indented with 2 spaces per level
- Icons shown before title (if present)
- Links use relative paths from mirror root
- Pages with children show their `_index.md` path
- Leaf pages show their `.md` path

### Database Listing

- Sorted alphabetically by title
- Shows icon (if present), title, row count, column count
- Links to the database `.md` file in `Databases/`

---

## Files to Create

- `src/lib/sync/IndexGenerator.ts` — Index generation and writing
- `tests/unit/sync/IndexGenerator.test.ts` — Unit tests

## Files to Modify

- `src/lib/sync/SyncService.ts` — Call `writeIndex()` after sync operations
- `src/lib/sync/DatabaseSync.ts` — Call `writeIndex()` after database sync
- `src/lib/sync/FileWatcher.ts` — Ignore `_index.md` files

---

## Acceptance Criteria

- [ ] `_index.md` generated at tenant mirror root
- [ ] Contains `generated: true` in frontmatter
- [ ] Lists all pages in hierarchical tree with correct nesting
- [ ] Lists all databases with row/column counts
- [ ] Relative links are correct and clickable
- [ ] Icons shown for pages/databases that have them
- [ ] Regenerated after page and database sync events
- [ ] FileWatcher ignores `_index.md` (no sync loop)
- [ ] Debounced — rapid syncs produce only one index write
- [ ] Performance: < 1 second for 500 pages + 20 databases
- [ ] Summary section shows total counts and last sync time

---

## Implementation Notes

- Page hierarchy data is available from `.skb-meta.json` (file paths encode hierarchy) and from the `parent` field in page frontmatter. Using `.skb-meta.json` is faster since it's a single file read.
- For database row counts, reading each `.md` file and counting table rows is expensive. Better to store `rowCount` in `.skb-meta.json` (done in SKB-48.7) or count lines matching the table row pattern.
- The index file should be useful in GitHub (rendered Markdown). Test that the links work when viewed on GitHub.
