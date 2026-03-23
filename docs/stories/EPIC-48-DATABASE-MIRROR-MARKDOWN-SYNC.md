# Epic 48: Database Mirror — Markdown Filesystem Sync for Databases

**Epic ID:** EPIC-48
**Created:** 2026-03-23
**Total Story Points:** 42
**Priority:** High
**Status:** Not Started
**Dependencies:** EPIC-31 (Markdown Filesystem Mirror must be functional)

---

## Epic Overview

Epic 48 extends the existing Markdown filesystem mirror (EPIC-31) to include **database content**. Currently, only pages (documents) are synced to the mirror directory. Databases — which contain structured data in rows and columns (like Notion tables) — exist only in PostgreSQL and are invisible to agents browsing the filesystem.

This epic adds bidirectional sync for databases as Markdown files. Each database becomes a single `.md` file containing YAML frontmatter (with the full column schema) and a Markdown table (with all row data). Both humans and agents can read, edit, and create databases by working with these files.

### Why This Matters

1. **Complete mirror:** Right now, an agent browsing the filesystem sees pages but not databases. That's like reading a book with chapters missing. The mirror should represent the *entire* knowledge base.
2. **Agent authoring:** An agent should be able to create a new database by writing a single `.md` file — defining columns in frontmatter and rows in a Markdown table. The sync service picks it up and creates the DB records.
3. **Human readability:** A Markdown table is instantly readable in any text editor, GitHub, or Obsidian. No JSON parsing needed.
4. **Single format:** By using the same `.md` + YAML frontmatter pattern that pages already use, the mirror stays consistent and predictable.

### What Already Exists

- **Filesystem mirror** (EPIC-31) — Bidirectional sync for pages with atomic writes, sync locks, conflict detection, file watcher
- **Database models** — `Database` (schema JSON, viewConfig) and `DbRow` (properties JSON) in Prisma
- **Property type system** — 8 types (TITLE, TEXT, NUMBER, SELECT, MULTI_SELECT, DATE, CHECKBOX, URL) with Zod validation
- **Property validators** (`src/lib/database/propertyValidators.ts`) — Type-safe validation against column schema
- **Markdown table serializer** — TipTap inline tables already serialize to Markdown pipe tables
- **Database API** — Full CRUD for databases and rows at `/api/databases/` and `/api/agent/databases/`
- **Sync infrastructure** — SyncService, FileWatcher, SyncLock, FolderStructure, conflict detection, `.skb-meta.json`

### What This Epic Adds

1. **Database→Markdown serializer** — Converts a Database + its DbRows into a single `.md` file with column schema in frontmatter and row data as a Markdown table
2. **Markdown→Database deserializer** — Parses a database `.md` file back into structured column definitions and typed row properties
3. **DB→FS sync for databases** — When a database or its rows change in the app, the corresponding `.md` file is regenerated
4. **FS→DB sync for databases** — When an agent or human edits a database `.md` file, changes are parsed, validated, and written to PostgreSQL
5. **Auto-generated `_index.md`** — A root-level table of contents listing all pages and databases for easy navigation
6. **Tests** — Round-trip fidelity tests, sync integration tests

### File Format

A database file uses the same `.md` + YAML frontmatter pattern as pages:

```markdown
---
id: e5f6a7b8-...
type: database
title: Tasks
page_id: a1b2c3d4-...
icon: ✅
default_view: table
columns:
  - id: col-title
    name: Title
    type: TITLE
  - id: col-status
    name: Status
    type: SELECT
    options:
      - Not Started
      - In Progress
      - In Review
      - Done
  - id: col-assignee
    name: Assignee
    type: TEXT
  - id: col-priority
    name: Priority
    type: SELECT
    options:
      - Low
      - Medium
      - High
      - Critical
  - id: col-tags
    name: Tags
    type: MULTI_SELECT
    options:
      - frontend
      - backend
      - agent
      - infra
  - id: col-due
    name: Due Date
    type: DATE
  - id: col-done
    name: Done
    type: CHECKBOX
created: 2026-03-01T10:05:00Z
updated: 2026-03-23T14:30:00Z
---

| Title | Status | Assignee | Priority | Tags | Due Date | Done |
|-------|--------|----------|----------|------|----------|------|
| Markdown mirror for databases | In Progress | Martin | High | agent, backend | 2026-03-30 | false |
| Fix dark mode graph colors | Done | Martin | Medium | frontend | 2026-03-15 | true |
| Add agent sweep scheduling | In Review | — | Medium | agent, infra | 2026-03-25 | false |
| Real-time presence indicators | Not Started | — | Low | frontend | 2026-04-10 | false |
```

**Key design decisions:**

- `type: database` in frontmatter distinguishes database files from page files
- Column definitions include `id`, `name`, `type`, and `options` — everything needed to reconstruct the Database schema
- The Markdown table uses column *names* as headers (human-readable), not column IDs
- MULTI_SELECT values use comma-space separation: `agent, infra`
- CHECKBOX renders as `true`/`false`
- Empty cells use `—` (em-dash) to distinguish from empty string
- Row order in the table matches `createdAt ASC` (same as API)
- Each row's linked `pageId` is NOT in the table (it's an implementation detail). The sync service manages page creation/linking automatically.

### Folder Structure

```
data/mirror/{tenant}/
  _index.md                          ← NEW: auto-generated navigation TOC
  .skb-meta.json                     ← MODIFIED: extended with database entries
  System Architecture/
    _index.md
    Data Models.md
  Meeting Notes/
    _index.md
    2026-03-20 Standup.md
  Databases/                         ← NEW: database files live here
    Tasks.md
    Contacts.md
    Reading List.md
```

**Out of scope:**
- Row-level page content in database files (rows auto-create pages, but their content stays as separate page files in the normal mirror)
- View configuration sync (board grouping, calendar date column, etc. — UI-only settings)
- Database deletion via filesystem (too destructive — agent should use API)
- Git integration

---

## Business Value

- **Complete agent interface:** Agents can now read, create, and modify ALL knowledge base content through the filesystem — not just documents but structured data too.
- **Human accessibility:** Anyone can open a database as a Markdown table in any text editor, without needing the web UI running.
- **Single source format:** Everything is `.md`. One format to learn, one format to parse, one format to version-control.
- **Agent database creation:** An agent can bootstrap an entire project structure — pages for docs, databases for tracking — just by writing `.md` files.

---

## Architecture Summary

```
Database Sync Flow (DB→FS):
────────────────────────────

User creates/edits row in web UI
        │
        ▼
API route updates Database/DbRow in PostgreSQL
        │
        ▼
SyncService.syncDatabaseToFilesystem(tenantId, databaseId)
        │
        ▼
1. Fetch Database + all DbRows from DB
2. Fetch Database's parent Page (for title, icon)
3. Serialize:
   a. Build YAML frontmatter from Database.schema + metadata
   b. Build Markdown table from DbRows using column definitions
   c. Combine into single .md string
4. Acquire sync lock for file path
5. Atomic write to Databases/{title}.md
6. Update .skb-meta.json with database entry
7. Release sync lock after timeout


Database Sync Flow (FS→DB):
────────────────────────────

Agent writes/edits Databases/Tasks.md
        │
        ▼
FileWatcher detects change in Databases/ directory
        │
        ▼
1. Check sync lock — skip if locked (echo prevention)
2. Read .md file
3. Parse YAML frontmatter:
   a. Extract column definitions (types, options)
   b. Extract database metadata (id, title, page_id)
4. Parse Markdown table:
   a. Match column headers to frontmatter column names
   b. For each row, parse cell values by column type:
      - SELECT: validate against options
      - MULTI_SELECT: split on ", " and validate each
      - NUMBER: parseFloat
      - CHECKBOX: parse "true"/"false"
      - DATE: validate ISO format
      - URL: validate URL format
      - TEXT/TITLE: use as-is
5. Diff against current DB state:
   a. New rows (in file but not DB) → create DbRow + auto-create Page
   b. Modified rows (properties differ) → update DbRow
   c. Deleted rows (in DB but not file) → delete DbRow
   d. Schema changes (columns added/removed/retyped) → update Database.schema
6. Validate all changes against property validators
7. Apply changes in a single transaction
8. Suppress DB→FS echo via sync lock


New Database Creation (FS→DB):
──────────────────────────────

Agent creates Databases/Projects.md with frontmatter + table
        │
        ▼
FileWatcher detects new file in Databases/
        │
        ▼
1. Parse frontmatter — no "id" field → new database
2. Validate column schema (at least 1 TITLE column, valid types)
3. Create Page record (for the database to attach to)
4. Create Database record with schema from frontmatter
5. Parse Markdown table rows
6. For each row: create DbRow + auto-create linked Page
7. Update .md file with generated IDs in frontmatter
8. Update .skb-meta.json
```

---

## Stories Breakdown

### SKB-48.1: Database-to-Markdown Serializer — 5 points, High

**Delivers:** A function `databaseToMarkdown(database, rows, columns)` that takes a Database model with its rows and produces a complete `.md` string with YAML frontmatter (column schema, metadata) and a Markdown pipe table (all rows, typed values). Handles all 8 property types correctly. Uses em-dash for empty cells. Comma-separates MULTI_SELECT. Renders CHECKBOX as true/false.

**Acceptance criteria:**
- Produces valid YAML frontmatter with all column definitions including options
- Produces aligned Markdown pipe table with correct headers
- All 8 property types serialize correctly
- Empty/null values render as `—`
- Output is deterministic (same input → same output)
- Handles edge cases: empty database (headers only, no rows), special characters in values, very long text values

**Depends on:** Nothing (foundational)

---

### SKB-48.2: Markdown-to-Database Deserializer — 8 points, High

**Delivers:** A function `markdownToDatabase(markdown)` that parses a database `.md` file and returns structured data: column definitions, row properties (typed), and metadata. Validates all values against column types. Reports parse errors with line numbers.

**Acceptance criteria:**
- Parses YAML frontmatter into DatabaseSchema (columns with types and options)
- Parses Markdown table into array of typed RowProperties
- Maps table column headers to frontmatter column definitions by name
- Correctly deserializes all 8 property types:
  - TITLE/TEXT: string as-is
  - NUMBER: parseFloat, error if NaN
  - SELECT: validate against options list, error if invalid
  - MULTI_SELECT: split on `, ` (comma-space), validate each against options
  - DATE: validate ISO date format
  - CHECKBOX: parse `true`/`false`, error if other
  - URL: validate URL format
- Em-dash `—` and empty cells parsed as null
- Returns parse errors with row/column context (not just "invalid")
- Handles tables with extra whitespace, uneven padding

**Depends on:** SKB-48.1 (serializer defines the format that deserializer must parse)

---

### SKB-48.3: Round-Trip Fidelity Tests — 3 points, High

**Delivers:** A comprehensive test suite proving database→markdown→database conversion is lossless. Tests every property type, edge cases (empty databases, special characters, very long values, maximum column count), and ensures the format specification is correct.

**Acceptance criteria:**
- Round-trip test for each of 8 property types individually
- Round-trip test for a database with all 8 types combined
- Edge case: empty database (schema only, no rows)
- Edge case: database with 100+ rows
- Edge case: column names with special characters
- Edge case: SELECT options with commas (requires escaping convention)
- Edge case: TEXT values containing pipe characters `|` (Markdown table delimiter)
- Edge case: MULTI_SELECT with single value (no comma)
- All tests pass with exact equality (not just structural)

**Depends on:** SKB-48.1, SKB-48.2

---

### SKB-48.4: DB→FS Sync for Databases — 5 points, High

**Delivers:** When a database or its rows are created, updated, or deleted through the web UI or API, the corresponding `.md` file in `Databases/` is regenerated automatically. Integrates with existing SyncService and sync lock infrastructure.

**Acceptance criteria:**
- Database creation → new `.md` file appears in `Databases/`
- Row create/update/delete → `.md` file is regenerated with current data
- Database schema change (column add/remove/rename) → `.md` file updates
- Uses existing sync lock to prevent file watcher echo
- Uses existing atomic write pattern
- Updates `.skb-meta.json` with database entries (new section alongside pages)
- File is named `{Database Title}.md` using existing `fileSlug()` logic
- Duplicate database titles get numeric suffix
- Database deletion → `.md` file removed

**Depends on:** SKB-48.1, existing SyncService infrastructure

---

### SKB-48.5: FS→DB Sync for Databases — 8 points, High

**Delivers:** The FileWatcher detects changes to `.md` files in the `Databases/` directory and syncs them back to PostgreSQL. Handles edits (row changes, new rows, deleted rows, schema changes) and new database creation.

**Acceptance criteria:**
- Edit existing database file → changed rows update in DB
- Add new rows to table → new DbRow + linked Page created
- Remove rows from table → DbRow deleted from DB
- Change column schema in frontmatter → Database.schema updated
- Create new `.md` file in Databases/ (no `id` in frontmatter) → creates Database + Page + all rows
- All property values validated against column types before DB write
- Invalid values logged as errors, valid rows still processed
- Sync lock prevents echo when DB→FS sync writes
- Uses single Prisma transaction for consistency
- Debounced (reuses existing FS_DEBOUNCE_MS)
- Row matching strategy: match by TITLE column value (primary) or by row position (fallback) when no IDs available

**Depends on:** SKB-48.2, SKB-48.4 (needs both serializer and DB→FS sync working)

---

### SKB-48.6: Auto-Generated Navigation Index — 5 points, Medium

**Delivers:** An auto-generated `_index.md` file at the root of each tenant's mirror directory. Lists all pages (with hierarchy) and all databases (with row/column counts). Regenerated on every sync event. Serves as a table of contents for both humans browsing the folder and agents discovering content.

**Acceptance criteria:**
- Generated at `data/mirror/{tenant}/_index.md`
- Contains `generated: true` in frontmatter (so FileWatcher ignores it)
- Lists all pages in hierarchical tree format with icons and links
- Lists all databases with title, row count, and column count
- Relative links to actual files (clickable in GitHub/editors)
- Regenerated after any page or database sync
- Does not trigger FS→DB sync (FileWatcher skips files with `generated: true`)
- Performance: generation completes in < 1 second for 500 pages + 20 databases

**Depends on:** SKB-48.4 (databases must be in the mirror for the index to list them)

---

### SKB-48.7: Extend .skb-meta.json for Databases — 3 points, Medium

**Delivers:** The sync metadata file (`.skb-meta.json`) extended to track database files alongside page files. Includes database ID, file path, content hash, and last sync timestamp. Used by conflict detection and incremental sync.

**Acceptance criteria:**
- New `databases` section in SyncMetadata type: `Record<databaseId, SyncDatabaseEntry>`
- SyncDatabaseEntry: `{ id, filePath, contentHash, lastSynced, rowCount }`
- Updated on every database sync (both directions)
- Conflict detection works for database files (same pattern as pages)
- Backward compatible: existing page metadata untouched
- `.skb-meta.json` version bumped to 2

**Depends on:** SKB-48.4

---

### SKB-48.8: Integration Tests & Edge Case Handling — 5 points, Medium

**Delivers:** End-to-end integration tests for the full database sync lifecycle. Tests the complete flow: create database in UI → file appears → edit file → DB updates → verify round-trip. Handles edge cases gracefully.

**Acceptance criteria:**
- Test: create database via API → verify `.md` file content is correct
- Test: edit database `.md` file → verify DB rows updated
- Test: create new database `.md` file → verify Database + rows created in DB
- Test: delete rows from `.md` → verify DbRows deleted
- Test: add column to frontmatter schema → verify Database.schema updated
- Test: simultaneous DB and FS edit → conflict backup created
- Test: invalid property values in `.md` → error logged, valid rows still sync
- Test: database with 200 rows → sync completes in < 5 seconds
- Test: agent creates database from scratch (no id) → full lifecycle works
- Edge case: pipe `|` in cell values (must be escaped as `\|`)
- Edge case: newlines in TEXT values (must be escaped or truncated in table)

**Depends on:** All previous stories

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 48.1 | Each property type serialization; empty database; special chars; deterministic output | Full database with all types → valid markdown | N/A |
| 48.2 | Each property type deserialization; validation errors; malformed tables; edge cases | Parse → validate → reconstruct database | N/A |
| 48.3 | Round-trip for each type; combined types; edge cases; large databases | Serialize → deserialize → compare equality | N/A |
| 48.4 | Sync triggers on CRUD; file naming; metadata updates; sync lock usage | Create DB via API → file appears with correct content | N/A |
| 48.5 | File change detection; row diffing; schema changes; transaction safety | Edit file → verify DB state; create file → verify new DB | N/A |
| 48.6 | Index generation format; page tree rendering; database listing | Full mirror → index contains all content with correct links | N/A |
| 48.7 | Metadata schema extension; backward compatibility; hash computation | Metadata persists through sync cycles | N/A |
| 48.8 | N/A | Full lifecycle tests; concurrent edits; error recovery; performance | Agent creates + edits database via filesystem |

---

## Implementation Order

```
┌────────┐   ┌────────┐   ┌────────┐
│ 48.1   │──▶│ 48.2   │──▶│ 48.3   │
│Serialize│   │Deserial│   │Round-  │
│DB→MD   │   │MD→DB   │   │Trip    │
└───┬────┘   └───┬────┘   └────────┘
    │            │
    ▼            │
┌────────┐       │
│ 48.7   │       │
│Meta    │       │
│Extend  │       │
└───┬────┘       │
    │            │
    ▼            ▼
┌────────┐   ┌────────┐   ┌────────┐
│ 48.4   │──▶│ 48.5   │──▶│ 48.8   │
│DB→FS   │   │FS→DB   │   │Integr. │
│Sync    │   │Sync    │   │Tests   │
└───┬────┘   └────────┘   └────────┘
    │
    ▼
┌────────┐
│ 48.6   │
│Nav     │
│Index   │
└────────┘

Parallelization:
- 48.1 is the foundation (start here)
- 48.2 can start after 48.1 (needs format spec)
- 48.7 can start in parallel with 48.2 (independent metadata work)
- 48.3 needs both 48.1 and 48.2
- 48.4 needs 48.1 and 48.7
- 48.5 needs 48.2 and 48.4
- 48.6 needs 48.4
- 48.8 needs everything else
```

---

## Shared Constraints

- **Backward compatible:** Existing page sync must continue working without any changes. Database sync is purely additive.
- **Same patterns:** Reuse SyncLock, atomic writes, conflict detection, debouncing, `.skb-meta.json` — don't reinvent.
- **YAML frontmatter:** Use the existing `generateFrontmatter`/`parseFrontmatter` pattern but extended for database-specific fields. Note: the current hand-rolled YAML parser will need enhancement to handle nested structures (column arrays with options). Consider using a proper YAML library (e.g., `yaml` npm package) for database frontmatter only.
- **Property validation:** Reuse existing `validateProperties()` from `propertyValidators.ts`. Don't duplicate validation logic.
- **Multi-tenant isolation:** Database files scoped to tenant directory, same as pages.
- **Atomic transactions:** FS→DB sync must use Prisma transactions. Partial row creation is not acceptable.
- **Performance:** Sync of a 200-row database should complete in < 2 seconds. Index generation < 1 second for 500 pages.
- **Error resilience:** Invalid rows should be logged and skipped, not abort the entire sync.
- **TypeScript strict:** No `any` types.
- **No breaking changes:** Database API routes, web UI, and existing sync behavior must continue working unchanged.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/sync/DatabaseSerializer.ts` — Database + rows → Markdown string
- `src/lib/sync/DatabaseDeserializer.ts` — Markdown string → Database schema + typed rows
- `src/lib/sync/DatabaseSync.ts` — DB↔FS sync orchestration for databases
- `src/lib/sync/IndexGenerator.ts` — Auto-generated `_index.md` builder
- `tests/unit/sync/DatabaseSerializer.test.ts` — Serializer unit tests
- `tests/unit/sync/DatabaseDeserializer.test.ts` — Deserializer unit tests
- `tests/unit/sync/DatabaseRoundTrip.test.ts` — Round-trip fidelity tests
- `tests/integration/sync/DatabaseSync.test.ts` — Integration tests
- `tests/integration/sync/IndexGenerator.test.ts` — Index generation tests

### Modified Files
- `src/lib/sync/SyncService.ts` — Add database sync calls alongside page sync
- `src/lib/sync/FileWatcher.ts` — Handle files in `Databases/` directory
- `src/lib/sync/types.ts` — Add SyncDatabaseEntry type, bump metadata version
- `src/lib/sync/config.ts` — Add DATABASES_DIR constant
- `src/lib/markdown/frontmatter.ts` — Extend for nested YAML (column arrays) or extract to separate database frontmatter module
- `src/app/api/databases/route.ts` — Hook into sync after database create
- `src/app/api/databases/[id]/route.ts` — Hook into sync after database update/delete
- `src/app/api/databases/[id]/rows/route.ts` — Hook into sync after row create
- `src/app/api/databases/[id]/rows/[rowId]/route.ts` — Hook into sync after row update/delete
- `package.json` — Add `yaml` dependency (if using proper YAML library for nested frontmatter)

---

**Last Updated:** 2026-03-23
