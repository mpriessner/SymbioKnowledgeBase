# SKB-48.8: Integration Tests & Edge Case Handling

**Story ID:** SKB-48.8
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 5
**Priority:** Medium
**Status:** Not Started
**Depends on:** All previous stories (SKB-48.1 through SKB-48.7)

---

## User Story

As a developer, I need end-to-end integration tests that prove the full database sync lifecycle works correctly, including edge cases and error recovery, before we ship this feature.

---

## What This Story Delivers

A comprehensive integration test suite that tests the complete database mirror workflow end-to-end — not just individual functions but the full pipeline from API to filesystem and back.

---

## Test Scenarios

### Lifecycle Tests

1. **Create database via API → verify file**
   - POST `/api/databases` with schema
   - POST rows
   - Assert: `Databases/{title}.md` exists with correct frontmatter and table

2. **Edit database file → verify DB**
   - Modify a row's STATUS value in the `.md` file
   - Wait for FileWatcher to process
   - Assert: DbRow.properties updated in PostgreSQL

3. **Add rows via file → verify DB**
   - Append new rows to the Markdown table
   - Wait for FileWatcher
   - Assert: new DbRow records created, linked Pages created

4. **Remove rows via file → verify DB**
   - Remove rows from the Markdown table
   - Wait for FileWatcher
   - Assert: DbRow records deleted

5. **Create new database via file → verify DB**
   - Write new `.md` file in `Databases/` with schema frontmatter and table
   - No `id` in frontmatter
   - Wait for FileWatcher
   - Assert: Database + Page + DbRows created
   - Assert: file rewritten with generated IDs

6. **Full round-trip**
   - Create database via API → file appears
   - Edit file → DB updates
   - Edit via API → file updates
   - Assert: final DB state matches final file state

### Schema Change Tests

7. **Add column via file**
   - Add new column to frontmatter schema + add column to table headers
   - Assert: Database.schema updated, new column present

8. **Remove column via file**
   - Remove column from frontmatter + remove from table
   - Assert: Database.schema updated, column removed
   - Existing row properties for that column cleaned up

9. **Rename column via file**
   - Change column name in frontmatter + table header
   - Assert: column name updated, row data preserved

10. **Add SELECT option via file**
    - Add new option to a SELECT column in frontmatter
    - Use the new option in a row
    - Assert: schema updated, row valid

### Conflict & Error Tests

11. **Simultaneous edit**
    - Edit database via API AND via file at the same time
    - Assert: conflict backup file created
    - Assert: one version wins (last-write-wins)

12. **Invalid property value**
    - Write invalid SELECT value (not in options) in `.md` file
    - Assert: error logged with row/column context
    - Assert: other valid rows still synced

13. **Malformed Markdown table**
    - Write table with uneven columns
    - Assert: error logged, no crash, no data corruption

14. **Empty database file**
    - Write `.md` with schema but no table rows
    - Assert: Database created with empty rows (or all rows deleted if editing existing)

### Performance Tests

15. **200-row database**
    - Create database with 200 rows via API
    - Assert: file generated in < 2 seconds
    - Edit file (change 1 row)
    - Assert: sync completes in < 2 seconds

16. **Concurrent database syncs**
    - Trigger sync for 5 databases simultaneously
    - Assert: all complete without deadlocks or corruption

### Navigation Index Tests

17. **Index includes databases**
    - Create pages and databases
    - Trigger full sync
    - Assert: `_index.md` lists both pages (hierarchical) and databases (with counts)

18. **Index updates on change**
    - Create new database
    - Assert: `_index.md` regenerated with new database listed

### Metadata Tests

19. **v1 → v2 migration**
    - Start with v1 `.skb-meta.json` (pages only)
    - Trigger database sync
    - Assert: metadata migrated to v2, pages untouched, databases section added

20. **Metadata consistency**
    - Create, edit, and delete databases
    - Assert: `.skb-meta.json` accurately reflects current state after each operation

---

## Files to Create

- `tests/integration/sync/DatabaseSync.test.ts` — Lifecycle and round-trip tests
- `tests/integration/sync/DatabaseSyncEdgeCases.test.ts` — Error and edge case tests
- `tests/integration/sync/IndexGenerator.test.ts` — Navigation index tests

## Files to Modify

None (tests only).

---

## Acceptance Criteria

- [ ] All 20 test scenarios pass
- [ ] Tests use real Prisma client (not mocked) against test database
- [ ] Tests use real filesystem (temp directory, cleaned up after)
- [ ] Tests properly wait for FileWatcher debounce (not flaky timing)
- [ ] Performance tests have explicit time assertions
- [ ] Test setup/teardown is clean (no leftover files or DB records)
- [ ] Tests can run in parallel without interfering with each other (unique tenant IDs)
- [ ] CI-compatible (no hardcoded paths, no manual steps)

---

## Implementation Notes

- Use Vitest (project's test runner) with `beforeEach`/`afterEach` for setup/teardown
- Create a temp mirror directory per test using `fs.mkdtemp()`
- Use unique tenant IDs per test to avoid cross-test interference
- For FileWatcher tests, start the watcher pointed at the temp directory, make changes, and wait for debounce + processing (use a short timeout like 1 second)
- Consider a helper `waitForSync(predicate, timeoutMs)` that polls until a condition is met (e.g., file exists, DB row updated)
- Clean up: delete temp directory AND delete test DB records in `afterEach`
