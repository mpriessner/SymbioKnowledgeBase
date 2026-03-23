# SKB-48.2: Markdown-to-Database Deserializer

**Story ID:** SKB-48.2
**Epic:** EPIC-48 (Database Mirror — Markdown Filesystem Sync)
**Points:** 8
**Priority:** High
**Status:** Not Started
**Depends on:** SKB-48.1 (serializer defines the format)

---

## User Story

As a sync service, I need to parse a database `.md` file back into structured column definitions and typed row properties so that filesystem changes can be written to the database.

---

## What This Story Delivers

A function `markdownToDatabase()` that parses a database `.md` file and returns:
1. Database metadata (id, title, icon, page_id)
2. Column definitions (same structure as Database.schema)
3. Typed row properties (validated against column types)
4. Parse errors (with row/column context)

---

## Technical Specification

### Function Signature

```typescript
// src/lib/sync/DatabaseDeserializer.ts

interface ParsedDatabase {
  metadata: {
    id?: string;           // undefined for new databases
    title: string;
    icon?: string | null;
    pageId?: string;
    defaultView?: string;
  };
  columns: Column[];
  rows: ParsedRow[];
  errors: ParseError[];
}

interface ParsedRow {
  rowIndex: number;        // 0-based position in table
  properties: Record<string, PropertyValue>;
}

interface ParseError {
  type: "warning" | "error";
  row?: number;            // 1-based row in table (undefined for schema errors)
  column?: string;         // Column name
  message: string;
}

function markdownToDatabase(markdown: string): ParsedDatabase;
```

### Parsing Pipeline

1. **Split frontmatter from body** — Same `---` delimiter pattern as pages
2. **Parse YAML frontmatter** — Extract metadata and column definitions
   - Must handle nested YAML: `columns` is an array of objects with optional `options` arrays
   - Validate: at least one column, exactly one TITLE type
3. **Parse Markdown table** — Extract header row and data rows
   - Split on `|` delimiter (respecting `\|` escapes)
   - Trim whitespace from cells
   - Skip separator row (`|---|---|`)
4. **Map headers to columns** — Match table header names to column definitions by `name`
   - Error if header doesn't match any column
   - Error if column is in schema but missing from table headers
5. **Deserialize cell values** — For each cell, parse according to column type:

### Deserialization Rules by Type

| Type | Markdown Cell | Parsed Value |
|------|---------------|-------------|
| TITLE | `Build feature` | `{type: "TITLE", value: "Build feature"}` |
| TEXT | `Some text` | `{type: "TEXT", value: "Some text"}` |
| NUMBER | `42.5` | `{type: "NUMBER", value: 42.5}` |
| SELECT | `In Progress` | `{type: "SELECT", value: "In Progress"}` |
| MULTI_SELECT | `frontend, backend` | `{type: "MULTI_SELECT", value: ["frontend", "backend"]}` |
| DATE | `2026-03-30` | `{type: "DATE", value: "2026-03-30"}` |
| CHECKBOX | `true` | `{type: "CHECKBOX", value: true}` |
| URL | `https://example.com` | `{type: "URL", value: "https://example.com"}` |
| `—` or empty | — | null (skip property) |

### Validation Rules

- **SELECT**: value must exist in column's `options` array → error if not
- **MULTI_SELECT**: each value must exist in column's `options` → error per invalid value
- **NUMBER**: must parse as finite number → error if NaN/Infinity
- **CHECKBOX**: must be exactly `true` or `false` (case-insensitive) → error otherwise
- **DATE**: must match ISO date pattern (`YYYY-MM-DD` or full ISO 8601) → error otherwise
- **URL**: must be parseable by `new URL()` → error otherwise
- **TITLE**: must not be empty for existing rows → warning if empty

### Error Handling Strategy

- Parse errors are **collected, not thrown**
- Each error includes row number, column name, and descriptive message
- Rows with errors in non-critical columns are still returned (with the errored property omitted)
- Rows with TITLE errors are returned with a warning
- Schema-level errors (missing TITLE column, invalid type) prevent parsing entirely

---

## Files to Create

- `src/lib/sync/DatabaseDeserializer.ts` — Main deserializer function
- `tests/unit/sync/DatabaseDeserializer.test.ts` — Unit tests

## Files to Modify

- `src/lib/markdown/frontmatter.ts` — May need to extend `parseFrontmatter()` for nested YAML, OR create a separate `parseDatabaseFrontmatter()` that uses a proper YAML parser for the complex column definitions

---

## Acceptance Criteria

- [ ] Parses YAML frontmatter into column definitions with types and options
- [ ] Parses Markdown table into array of typed row properties
- [ ] All 8 property types deserialize correctly
- [ ] SELECT/MULTI_SELECT values validated against options
- [ ] Em-dash `—` and empty cells parsed as null
- [ ] Escaped pipes `\|` in cell values handled correctly
- [ ] Parse errors include row number and column name
- [ ] Invalid rows don't abort parsing of valid rows
- [ ] Missing `id` in frontmatter indicates new database (not an error)
- [ ] Unit tests for each property type individually
- [ ] Unit tests for validation error cases
- [ ] Unit tests for malformed tables (missing columns, extra columns, uneven rows)

---

## Implementation Notes

- The hand-rolled YAML parser in `frontmatter.ts` cannot handle nested arrays/objects. For database frontmatter, use the `yaml` npm package (or `js-yaml`) to parse the full frontmatter YAML. Keep the simple parser for pages (backward compat).
- Reuse `Column`, `PropertyValue`, and `PropertyType` types from `src/types/database.ts`
- Reuse validation logic patterns from `src/lib/database/propertyValidators.ts` but don't call `validateProperties()` directly — it expects column IDs as keys, but the deserializer works with column names. Map names→IDs before calling validators, or inline the validation.
- The Markdown table parser should handle tables produced by any Markdown editor (variable padding, missing trailing pipe, etc.) — not just our exact serializer output.
