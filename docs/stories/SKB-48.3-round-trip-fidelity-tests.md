# SKB-48.3: Round-Trip Fidelity Tests

**Story ID:** SKB-48.3
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 3
**Priority:** High
**Status:** Not Started
**Depends on:** SKB-48.1, SKB-48.2

---

## User Story

As a developer, I need confidence that converting a database to Markdown and back produces identical data, so that the sync doesn't silently corrupt structured data.

---

## What This Story Delivers

A comprehensive test suite that takes database data, serializes it to Markdown, deserializes it back, and asserts exact equality. Covers every property type, edge cases, and stress scenarios.

---

## Test Cases

### Per-Type Round-Trip Tests

1. **TITLE** — `"Project Alpha"` → MD → `"Project Alpha"`
2. **TEXT** — `"Line one with special chars: <>&\""` → MD → exact match
3. **NUMBER** — `42`, `0`, `-3.14`, `1000000` → MD → exact match
4. **SELECT** — `"In Progress"` (from options) → MD → exact match
5. **MULTI_SELECT** — `["frontend", "backend"]` → MD → exact match
6. **MULTI_SELECT (single)** — `["frontend"]` → MD → `["frontend"]` (not string)
7. **DATE** — `"2026-03-30"` → MD → `"2026-03-30"`
8. **CHECKBOX** — `true` / `false` → MD → exact match
9. **URL** — `"https://example.com/path?q=1&r=2"` → MD → exact match

### Combined Tests

10. **All 8 types in one database** — Single database with one column of each type, 5 rows → round-trip → exact match
11. **Multiple SELECT columns** — Two SELECT columns with different options → round-trip → correct options preserved
12. **Multiple MULTI_SELECT columns** — Two MULTI_SELECT columns → round-trip → values mapped to correct columns

### Edge Cases

13. **Empty database** — Schema with columns but zero rows → round-trip → empty table preserved, schema intact
14. **Single row** — One row with all types → round-trip → exact match
15. **100 rows** — Performance + correctness at scale
16. **Null values** — Rows with some properties null → `—` → null → exact match
17. **All null row** — Row with only TITLE filled, everything else null → round-trip
18. **Pipe in text** — TEXT value `"A | B"` → escaped in table → `"A | B"` after round-trip
19. **Comma in SELECT option** — SELECT option `"Red, Blue"` → round-trip (tests escaping convention)
20. **Long text** — TEXT value of 1000+ characters → single table cell → round-trip
21. **Unicode** — Column names and values with emoji, CJK, accented chars → round-trip
22. **Column name with special chars** — Column named `"Due Date (UTC)"` → round-trip
23. **URL with special chars** — `"https://example.com/path?a=1&b=foo%20bar"` → round-trip

### Schema Preservation

24. **Column order preserved** — Columns in specific order → round-trip → same order
25. **Column IDs preserved** — Column `id` fields survive round-trip
26. **Options order preserved** — SELECT options `["Low", "Medium", "High"]` → same order after round-trip
27. **Database metadata preserved** — id, title, icon, page_id, default_view → exact match

---

## Files to Create

- `tests/unit/sync/DatabaseRoundTrip.test.ts`

## Files to Modify

None.

---

## Acceptance Criteria

- [ ] All 27 test cases pass
- [ ] Tests use strict deep equality (not loose comparison)
- [ ] Test helper creates database fixtures programmatically (not hardcoded strings)
- [ ] Performance: 100-row round-trip completes in < 500ms
- [ ] Any failing test clearly identifies which property/row/column failed
