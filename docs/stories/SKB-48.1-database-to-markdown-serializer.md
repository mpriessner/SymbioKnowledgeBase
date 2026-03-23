# SKB-48.1: Database-to-Markdown Serializer

**Story ID:** SKB-48.1
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 5
**Priority:** High
**Status:** Not Started
**Depends on:** Nothing (foundational)

---

## User Story

As an agent or developer, I want databases to be represented as readable Markdown files so that I can browse structured data without needing the web UI or API.

---

## What This Story Delivers

A function `databaseToMarkdown()` that takes a Database model (with its schema/columns) and an array of DbRows, and produces a complete `.md` string containing:

1. **YAML frontmatter** — Database metadata + full column schema with types and options
2. **Markdown pipe table** — All rows with correctly formatted, typed cell values

---

## Technical Specification

### Function Signature

```typescript
// src/lib/sync/DatabaseSerializer.ts

interface DatabaseSerializeInput {
  id: string;
  title: string;
  icon: string | null;
  pageId: string;
  defaultView: string;
  columns: Column[];
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseRowInput {
  id: string;
  properties: Record<string, PropertyValue>;
  createdAt: Date;
}

function databaseToMarkdown(
  database: DatabaseSerializeInput,
  rows: DatabaseRowInput[]
): string;
```

### Frontmatter Format

```yaml
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
      - Done
  - id: col-tags
    name: Tags
    type: MULTI_SELECT
    options:
      - frontend
      - backend
  - id: col-due
    name: Due Date
    type: DATE
  - id: col-done
    name: Done
    type: CHECKBOX
created: 2026-03-01T10:05:00Z
updated: 2026-03-23T14:30:00Z
---
```

### Markdown Table Format

```markdown
| Title | Status | Due Date | Done |
|-------|--------|----------|------|
| Build feature | In Progress | 2026-03-30 | false |
| Fix bug | Done | 2026-03-15 | true |
```

### Serialization Rules by Property Type

| Type | Value | Markdown Cell |
|------|-------|---------------|
| TITLE | `"Build feature"` | `Build feature` |
| TEXT | `"Some text"` | `Some text` |
| NUMBER | `42.5` | `42.5` |
| SELECT | `"In Progress"` | `In Progress` |
| MULTI_SELECT | `["frontend", "backend"]` | `frontend, backend` |
| DATE | `"2026-03-30"` | `2026-03-30` |
| CHECKBOX | `true` | `true` |
| URL | `"https://example.com"` | `https://example.com` |
| null/undefined | — | `—` |

### Special Character Handling

- Pipe `|` in cell values must be escaped as `\|`
- Newlines in TEXT values replaced with space (table cells are single-line)
- YAML special characters in frontmatter values must be quoted

### Column Order

Table columns follow the order defined in `database.schema.columns`. The TITLE column is always first regardless of its position in the schema.

### Row Order

Rows ordered by `createdAt ASC` (same as API default).

---

## Files to Create

- `src/lib/sync/DatabaseSerializer.ts` — Main serializer function
- `tests/unit/sync/DatabaseSerializer.test.ts` — Unit tests

## Files to Modify

None (this is a standalone utility).

---

## Acceptance Criteria

- [ ] Produces valid YAML frontmatter with all column definitions
- [ ] Produces properly aligned Markdown pipe table
- [ ] All 8 property types serialize correctly
- [ ] Empty/null values render as `—` (em-dash)
- [ ] Pipe characters in values are escaped
- [ ] Output is deterministic (same input → same output)
- [ ] Empty database (schema only, no rows) produces headers-only table
- [ ] TITLE column always appears first in table
- [ ] Unit tests for each property type
- [ ] Unit tests for edge cases (empty DB, special chars, long values)

---

## Implementation Notes

- Use the existing `escapeYamlString()` from `src/lib/markdown/frontmatter.ts` for simple values
- For nested YAML (column arrays with options), consider using the `yaml` npm package since the hand-rolled YAML generator in frontmatter.ts only handles flat key-value pairs
- Reuse `Column` and `PropertyValue` types from `src/types/database.ts`
- Keep the serializer stateless and pure (no DB access, no side effects)
