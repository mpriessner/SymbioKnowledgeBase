# Story SKB-33.4: Frontmatter Integration for Filesystem Mirror

**Epic:** Epic 33 - Agent Navigation Metadata & Page Summaries
**Story ID:** SKB-33.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-33.1 (summary fields), EPIC-31 SKB-31.3 (serializer and mirror must exist)

---

## User Story

As an AI agent browsing the filesystem mirror, I want to see each page's one-liner and summary in the YAML frontmatter of its `.md` file, so that I can quickly assess a page's relevance by reading just the frontmatter — without parsing the full content.

---

## Acceptance Criteria

### Serializer — Frontmatter Output
- [ ] The Markdown serializer includes `oneLiner` and `summary` in YAML frontmatter:
  ```yaml
  ---
  id: "page-uuid"
  title: "API Authentication Guide"
  icon: "🔑"
  oneLiner: "How to authenticate API requests via JWT"
  summary: "Covers JWT setup, token refresh flow, middleware configuration, and error handling for the REST API. Includes examples for client-side and server-side implementations."
  summaryUpdatedAt: "2026-02-27T14:30:00Z"
  parent: "parent-uuid"
  position: 2
  spaceType: "PRIVATE"
  created: "2026-02-20T10:00:00Z"
  updated: "2026-02-27T14:25:00Z"
  ---
  ```
- [ ] If `oneLiner` is null, the field is omitted from frontmatter (not `oneLiner: null`)
- [ ] If `summary` is null, the field is omitted from frontmatter
- [ ] `summaryUpdatedAt` only included if a summary exists
- [ ] Multi-line summaries are properly YAML-escaped (using `>-` folded block scalar or quoted string)
- [ ] Summary text with special YAML characters (`:`, `#`, `"`, `'`) is properly quoted

### Deserializer — Frontmatter Input
- [ ] The Markdown deserializer reads `oneLiner` and `summary` from frontmatter
- [ ] If frontmatter has `oneLiner`/`summary` values, these update the `Page` record in DB
- [ ] If frontmatter does NOT have these fields, the existing DB values are preserved (not nulled out)
- [ ] An agent editing ONLY the frontmatter `oneLiner` (without changing content) triggers a DB update for just that field
- [ ] `summaryUpdatedAt` is set to the current time when summary is updated via frontmatter
- [ ] If an agent sets `summaryUpdatedAt` explicitly in frontmatter, that value is used (agent controls the timestamp)

### New Page Template
- [ ] When a new `.md` file is created (either via the app or by an agent), the frontmatter template includes placeholder comments:
  ```yaml
  ---
  id: ""
  title: "New Page"
  oneLiner: ""
  summary: ""
  ---
  ```
- [ ] Empty string values for oneLiner/summary are treated as null (not stored as empty strings)

### Frontmatter Field Order
- [ ] Fields are always written in a consistent order for diff-friendliness:
  1. `id`
  2. `title`
  3. `icon`
  4. `oneLiner`
  5. `summary`
  6. `summaryUpdatedAt`
  7. `parent`
  8. `position`
  9. `spaceType`
  10. `created`
  11. `updated`

### Edge Cases
- [ ] Summary containing YAML special chars: `"He said: 'hello' # world"` → properly quoted
- [ ] Summary containing newlines: converted to single-line or folded block scalar
- [ ] Very long one-liner (100 chars) → no line wrapping in YAML (stays on one line)
- [ ] Unicode characters in summary → preserved correctly
- [ ] Frontmatter with unknown fields → ignored (not deleted), passed through

---

## Architecture Overview

```
Serialization (DB → .md frontmatter):
──────────────────────────────────────

Page record:
  { title: "API Guide", oneLiner: "JWT auth setup", summary: "Covers JWT..." }
        │
        ▼
buildFrontmatter(page):
  const fm: Record<string, any> = {};
  fm.id = page.id;
  fm.title = page.title;
  if (page.icon) fm.icon = page.icon;
  if (page.oneLiner) fm.oneLiner = page.oneLiner;
  if (page.summary) fm.summary = page.summary;
  if (page.summaryUpdatedAt) fm.summaryUpdatedAt = page.summaryUpdatedAt;
  fm.parent = page.parentId;
  fm.position = page.position;
  fm.spaceType = page.spaceType;
  fm.created = page.createdAt;
  fm.updated = page.updatedAt;
  return yamlStringify(fm);  // Ordered, properly escaped


Deserialization (.md frontmatter → DB):
───────────────────────────────────────

.md file frontmatter:
  ---
  id: "page-uuid"
  title: "API Guide"
  oneLiner: "JWT auth setup — updated by agent"
  summary: "New summary written by agent"
  ---
        │
        ▼
parseFrontmatter(yamlString):
  const data = yamlParse(yamlString);
  return {
    id: data.id,
    title: data.title,
    oneLiner: data.oneLiner || null,    // empty string → null
    summary: data.summary || null,
    summaryUpdatedAt: data.summaryUpdatedAt || new Date(),
    // ... other fields
  };
        │
        ▼
Merge with existing Page record:
  - Only update fields that are present in frontmatter
  - If oneLiner present AND different from DB → update + set summaryUpdatedAt
  - If oneLiner absent → keep existing DB value
  - Same logic for summary
```

---

## Implementation Steps

### Step 1: Extend Frontmatter Builder in Serializer

**File: `src/lib/markdown/serializer.ts`** (modify)

Currently, the serializer builds frontmatter with: id, title, icon, parent, position, spaceType, created, updated.

Add:
```typescript
// After icon field:
if (page.oneLiner) {
  frontmatter.oneLiner = page.oneLiner;
}
if (page.summary) {
  frontmatter.summary = page.summary;
}
if (page.summaryUpdatedAt) {
  frontmatter.summaryUpdatedAt = page.summaryUpdatedAt.toISOString();
}
```

Ensure YAML serialization handles special characters:
- Use `yaml` npm package (or built-in) with `lineWidth: -1` to prevent line wrapping
- Or manually quote values containing `:`, `#`, `'`, `"`

### Step 2: Extend Frontmatter Parser in Deserializer

**File: `src/lib/markdown/deserializer.ts`** (modify)

In the frontmatter parsing section:
```typescript
const parsed = parseFrontmatter(markdown);

// Extract summary fields
const oneLiner = parsed.oneLiner ? String(parsed.oneLiner).trim() : undefined;
const summary = parsed.summary ? String(parsed.summary).trim() : undefined;

// Build page update data — only include fields that are present
const pageUpdate: Partial<PageUpdate> = {};
if (oneLiner !== undefined) {
  pageUpdate.oneLiner = oneLiner || null;  // empty → null
  pageUpdate.summaryUpdatedAt = new Date();
}
if (summary !== undefined) {
  pageUpdate.summary = summary || null;
  pageUpdate.summaryUpdatedAt = new Date();
}
```

### Step 3: Ensure YAML Ordering

**File: `src/lib/markdown/frontmatter.ts`** (create or modify)

```typescript
const FIELD_ORDER = [
  'id', 'title', 'icon', 'oneLiner', 'summary', 'summaryUpdatedAt',
  'parent', 'position', 'spaceType', 'created', 'updated'
];

export function buildOrderedFrontmatter(data: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const key of FIELD_ORDER) {
    if (data[key] !== undefined && data[key] !== null) {
      lines.push(`${key}: ${yamlValue(data[key])}`);
    }
  }
  // Preserve any unknown fields (pass-through)
  for (const key of Object.keys(data)) {
    if (!FIELD_ORDER.includes(key)) {
      lines.push(`${key}: ${yamlValue(data[key])}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function yamlValue(value: any): string {
  if (typeof value === 'string') {
    // Quote if contains special YAML chars
    if (/[:#'"{}[\],&*?|><!%@`]/.test(value) || value.includes('\n')) {
      return JSON.stringify(value);  // JSON double-quoting is valid YAML
    }
    return `"${value}"`;
  }
  return String(value);
}
```

### Step 4: Update FS→DB Sync to Handle Summary Fields

**File: `src/lib/sync/SyncService.ts`** (modify — extends EPIC-31)

In the `onFileChanged` handler:
- Parse frontmatter including oneLiner and summary
- Compare with existing DB values
- Update only changed fields
- Set summaryUpdatedAt when summary fields change

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/lib/markdown/frontmatter.test.ts`**

- Page with oneLiner and summary → both in frontmatter
- Page with null oneLiner → field omitted
- Page with null summary → field omitted
- Summary with colon → properly quoted: `summary: "He said: hello"`
- Summary with quotes → escaped: `summary: "She said \"hello\""`
- Summary with newlines → single line or folded block
- Field order matches specification
- Unknown fields preserved (pass-through)
- Empty string oneLiner → treated as null on deserialize
- Parse frontmatter with oneLiner only → only oneLiner extracted

**File: `src/__tests__/lib/markdown/serializer-frontmatter.test.ts`**

- Serialize page with summaries → .md frontmatter includes them
- Deserialize .md with agent-edited summary → DB updated
- Deserialize .md without summary fields → DB values preserved (not nulled)

### Integration Tests (3+ cases)

- Full round-trip: page with summary → serialize → deserialize → same values
- Agent edits frontmatter summary in .md → FS→DB sync → Page.summary updated in DB
- Existing page with summary, agent removes from frontmatter → DB value preserved (field absent = no change)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/markdown/frontmatter.ts` | Create | Ordered frontmatter builder with YAML escaping |
| `src/lib/markdown/serializer.ts` | Modify | Add oneLiner, summary, summaryUpdatedAt to frontmatter |
| `src/lib/markdown/deserializer.ts` | Modify | Parse oneLiner, summary from frontmatter |
| `src/lib/sync/SyncService.ts` | Modify | Handle summary field changes in FS→DB sync |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
