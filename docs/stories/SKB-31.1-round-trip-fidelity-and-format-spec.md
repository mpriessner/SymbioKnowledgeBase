# Story SKB-31.1: Round-Trip Fidelity & Format Specification

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.1
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** None (foundational story)

---

## User Story

As a developer building the filesystem mirror, I need a documented Markdown format specification and a comprehensive round-trip test suite, So that I can guarantee JSON→Markdown→JSON conversion is deterministic and lossless for every supported block type before building the sync system.

---

## Acceptance Criteria

### Format Specification Document
- [ ] Create `docs/MARKDOWN-FORMAT-SPEC.md` documenting the exact Markdown syntax for every block type
- [ ] Specification covers all 27 ProseMirror node types handled by the serializer
- [ ] Each block type entry includes: ProseMirror JSON example, resulting Markdown, and any edge cases
- [ ] Custom block conventions are clearly defined:
  - **Callouts:** GitHub Alerts syntax `> [!TYPE] Title\n> Content` (info, warning, success, error)
  - **Toggles:** HTML `<details><summary>Title</summary>Content</details>`
  - **Bookmarks:** Custom syntax `<!-- bookmark: {"url":"...","title":"...","description":"..."} -->`
  - **Wikilinks:** `[[Page Name]]` or `[[Page Name|Display Text]]`
  - **Task lists:** GFM `- [ ] unchecked` / `- [x] checked`
  - **Code blocks:** Fenced with language ` ```python\ncode\n``` `
  - **Images:** Standard `![alt](url)` with optional title
- [ ] YAML frontmatter schema is defined:
  ```yaml
  ---
  id: "uuid"           # Page ID (required for sync, omitted for new pages)
  title: "Page Title"  # Page title
  icon: "🏗"           # Emoji icon (optional)
  parent: "uuid"       # Parent page ID (null for root pages)
  position: 0          # Sort position among siblings
  spaceType: "PRIVATE" # PRIVATE | TEAM | AGENT
  teamspaceId: "uuid"  # Teamspace ID (optional)
  created: "ISO-8601"  # Creation timestamp
  updated: "ISO-8601"  # Last update timestamp
  ---
  ```

### Round-Trip Audit
- [ ] Audit existing serializer (`src/lib/markdown/serializer.ts`) for gaps where information is lost
- [ ] Audit existing deserializer (`src/lib/markdown/deserializer.ts`) for gaps where parsing fails
- [ ] Document any lossy conversions and fix them or document as known limitations
- [ ] Known areas to investigate:
  - Callout emoji + variant preservation
  - Toggle `isOpen` state preservation
  - Bookmark all attributes (url, title, description, favicon, image)
  - Wikilink `pageId` vs `pageName` preservation
  - Heading `id` attribute preservation
  - Code block language attribute
  - Image dimensions and alignment
  - Table alignment attributes
  - Nested list depth > 3 levels
  - Mixed content (bold + italic + code in same paragraph)
  - Empty paragraphs and whitespace

### Round-Trip Test Suite
- [ ] Create `src/__tests__/lib/markdown/round-trip.test.ts`
- [ ] Test each block type individually (27+ test cases):
  - Paragraph with plain text
  - Paragraph with inline marks (bold, italic, strikethrough, code, highlight)
  - Paragraph with links (external URLs)
  - Paragraph with wikilinks (with and without display text)
  - Heading levels 1, 2, 3
  - Bullet list (nested 1, 2, 3 levels)
  - Ordered list (nested)
  - Task list (checked and unchecked items)
  - Blockquote (simple and nested)
  - Code block (with and without language)
  - Callout (each variant: info, warning, success, error)
  - Toggle (open and closed states)
  - Horizontal rule
  - Image (with alt text and title)
  - Bookmark (with all attributes)
  - Table (with alignment)
- [ ] Test composite documents (multiple block types in one document)
- [ ] Test edge cases:
  - Empty document
  - Document with only frontmatter
  - Very long paragraphs (> 1000 characters)
  - Special characters in text (quotes, backslashes, brackets, pipes)
  - Unicode/emoji in content
  - Consecutive headings with no content between them
- [ ] All tests pass: `JSON → Markdown → JSON` produces structurally identical output
- [ ] "Structurally identical" means: semantically equivalent after normalizing whitespace and optional attributes

### Fix Identified Gaps
- [ ] Fix any serializer bugs found during audit
- [ ] Fix any deserializer bugs found during audit
- [ ] If a block type cannot be round-tripped perfectly, document the limitation in the spec with a workaround

---

## Architecture Overview

```
Round-Trip Test Flow:
─────────────────────

Input JSON (ProseMirror) ──serialize()──▶ Markdown String ──deserialize()──▶ Output JSON

assert(deepEqual(normalize(input), normalize(output)))

Normalization:
  - Strip undefined/null optional attributes
  - Sort attribute keys
  - Normalize whitespace in text nodes
  - Ignore marks order (bold+italic = italic+bold)

Example Round-Trip (Callout):
─────────────────────────────

Input JSON:
{
  "type": "callout",
  "attrs": { "variant": "info", "emoji": "💡" },
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "This is important" }] }
  ]
}

     ↓ serialize()

Markdown:
> [!info] 💡
> This is important

     ↓ deserialize()

Output JSON:
{
  "type": "callout",
  "attrs": { "variant": "info", "emoji": "💡" },
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "This is important" }] }
  ]
}

✅ Input ≡ Output (structurally identical)
```

---

## Implementation Steps

### Step 1: Create Format Specification Document

**File: `docs/MARKDOWN-FORMAT-SPEC.md`** (create)

Document every block type with input JSON and output Markdown examples. This becomes the reference for all sync code.

### Step 2: Build Round-Trip Test Infrastructure

**File: `src/__tests__/lib/markdown/round-trip.test.ts`** (create)

```typescript
import { tiptapToMarkdown } from "@/lib/markdown/serializer";
import { markdownToTiptap } from "@/lib/markdown/deserializer";

function roundTrip(json: JSONContent): JSONContent {
  const markdown = tiptapToMarkdown(json);
  const result = markdownToTiptap(markdown);
  return result;
}

function normalize(json: JSONContent): JSONContent {
  // Strip undefined attrs, sort keys, normalize whitespace
}

function expectRoundTrip(input: JSONContent) {
  const output = roundTrip(input);
  expect(normalize(output)).toEqual(normalize(input));
}

describe("Round-trip: JSON → Markdown → JSON", () => {
  test("paragraph with plain text", () => {
    expectRoundTrip({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] }
      ]
    });
  });

  test("heading level 2", () => { /* ... */ });
  test("callout with info variant", () => { /* ... */ });
  // ... 27+ tests
});
```

### Step 3: Run Tests and Identify Gaps

Run the test suite, document every failure, and categorize:
- **Fixable:** Serializer/deserializer bug → fix it
- **Limitation:** Fundamentally cannot round-trip (e.g., some attribute has no Markdown representation) → document and add workaround (e.g., store in HTML comment)

### Step 4: Fix Serializer/Deserializer Gaps

**Files: `src/lib/markdown/serializer.ts`, `src/lib/markdown/deserializer.ts`** (modify)

Fix each identified gap. Potential fixes:
- Bookmark attributes: serialize as HTML comment with JSON payload
- Toggle `isOpen` state: add attribute to `<details open>` tag
- Wikilink `pageId`: store in frontmatter `links` section or HTML comment

### Step 5: Verify All Tests Pass

Re-run the full test suite. All 27+ block types must round-trip successfully.

---

## Testing Requirements

### Unit Tests (30+ cases)

**File: `src/__tests__/lib/markdown/round-trip.test.ts`**

- 27 individual block type round-trips (see acceptance criteria above)
- 3+ composite document round-trips
- 5+ edge case round-trips

### Validation Tests

**File: `src/__tests__/lib/markdown/frontmatter.test.ts`**

- Frontmatter serializes all required fields
- Frontmatter deserializes back to identical metadata
- Missing optional fields handled gracefully
- Invalid frontmatter produces helpful error

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/MARKDOWN-FORMAT-SPEC.md` | Create | Complete format specification |
| `src/__tests__/lib/markdown/round-trip.test.ts` | Create | Round-trip test suite |
| `src/__tests__/lib/markdown/frontmatter.test.ts` | Create | Frontmatter tests |
| `src/lib/markdown/serializer.ts` | Modify | Fix round-trip gaps |
| `src/lib/markdown/deserializer.ts` | Modify | Fix round-trip gaps |

---

**Last Updated:** 2026-02-25
