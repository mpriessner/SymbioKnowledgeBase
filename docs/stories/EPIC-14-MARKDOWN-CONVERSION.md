# Epic 14: Markdown Conversion Layer

**Epic ID:** EPIC-14
**Created:** 2026-02-22
**Total Story Points:** 21
**Priority:** High
**Status:** Done
**Completed:** 2026-02-27
**Notes:** All 4 stories implemented: TipTap-to-markdown serializer (all block types + frontmatter), markdown-to-TipTap deserializer (remark/unified), API endpoints (single/bulk export, import, format negotiation), export/import UI in settings modal + page header.

---

## Epic Overview

Epic 14 adds a bidirectional markdown serialization/deserialization layer to the knowledge base. The editor internally uses TipTap JSON, but agents and external tools work better with markdown. This layer converts on-the-fly at the API boundary:

- **TipTap JSON → Markdown** (for agent/API reads, export downloads)
- **Markdown → TipTap JSON** (for agent/API writes, markdown imports)
- **Markdown export** (download pages as `.md` files with YAML frontmatter)
- **Markdown import** (upload `.md` files to create pages)

This epic is critical for LLM agent integration — TipTap JSON is ~9x more tokens than equivalent markdown, making it inefficient for AI agent consumption. Markdown is the native language of LLMs.

---

## Business Value

- **LLM agent efficiency**: Markdown uses ~9x fewer tokens than TipTap JSON. For a 2000-word document, this reduces from ~18,000 tokens to ~2,000 tokens — massive cost savings for agent API calls.
- **Portability**: Markdown files are universally readable. Users can export their knowledge base and use it with Obsidian, Notion, VS Code, or any markdown tool.
- **Git-friendly**: Markdown diffs are human-readable. Users can version-control their knowledge base in Git (export → commit → push).
- **Interoperability**: External tools (scripts, automation, AI pipelines) can read/write pages via markdown without understanding TipTap JSON schema.
- **Agent authoring**: LLM agents can generate markdown content (their native format) and the system will convert it to TipTap JSON for storage.
- **Backup/migration**: Markdown export provides a complete, portable backup. Users can migrate away from SymbioKnowledgeBase without lock-in.

---

## Architecture Summary

```
Markdown Conversion Architecture
─────────────────────────────────

Human UI Flow (no change):
  Browser → TipTap Editor → JSON → POST /api/pages/:id/blocks → Save to DB

Agent Read Flow (NEW):
  GET /api/pages/:id?format=markdown
     │
     ▼
  ┌────────────────────────────────────────────────┐
  │ 1. Fetch page blocks from DB (TipTap JSON)     │
  │ 2. Call tiptapToMarkdown(json)                 │
  │ 3. Add YAML frontmatter (title, icon, dates)   │
  │ 4. Return markdown string                      │
  └────────────────────────────────────────────────┘

Agent Write Flow (NEW):
  PUT /api/pages/:id?format=markdown
     │  body: "# Title\n\nContent with [[wikilinks]]..."
     ▼
  ┌────────────────────────────────────────────────┐
  │ 1. Parse YAML frontmatter (extract metadata)   │
  │ 2. Call markdownToTiptap(markdown)             │
  │ 3. Save TipTap JSON to DB                      │
  └────────────────────────────────────────────────┘

Export Flow (NEW):
  GET /api/pages/:id/export
     │
     ▼
  ┌────────────────────────────────────────────────┐
  │ 1. Convert page to markdown with frontmatter   │
  │ 2. Return as downloadable .md file             │
  └────────────────────────────────────────────────┘

Import Flow (NEW):
  POST /api/pages/import
     │  body: FormData with .md file
     ▼
  ┌────────────────────────────────────────────────┐
  │ 1. Parse .md file (frontmatter + content)      │
  │ 2. Convert markdown to TipTap JSON             │
  │ 3. Create page with metadata from frontmatter  │
  └────────────────────────────────────────────────┘

Conversion Layer Functions:
  ┌──────────────────────────────────────────┐
  │  tiptapToMarkdown(json: JSONContent)     │
  │  Returns: string (markdown)              │
  │                                          │
  │  Handles:                                │
  │  - Headings (# ## ###)                   │
  │  - Bold (**), italic (*), strike (~~)    │
  │  - Lists (-, 1., - [ ])                  │
  │  - Code blocks (```lang)                 │
  │  - Blockquotes (>)                       │
  │  - Callouts (> [!type])                  │
  │  - Toggles (details/summary)             │
  │  - Wikilinks ([[Page Name]])             │
  │  - Images (![alt](src))                  │
  │  - Links ([text](url))                   │
  │  - Tables (| col |)                      │
  └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │  markdownToTiptap(md: string)            │
  │  Returns: JSONContent (TipTap)           │
  │                                          │
  │  Uses: remark/unified ecosystem          │
  │  - remark-parse (markdown → AST)         │
  │  - remark-gfm (tables, strikethrough)    │
  │  - remark-wiki-link (wikilinks)          │
  │  - Custom transformer (AST → TipTap)     │
  └──────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-14.1: TipTap JSON to Markdown Serializer — 8 points, Critical

**Delivers:** `tiptapToMarkdown(json: JSONContent): string` function. Handles all block types: paragraphs, headings (# ## ###), bold (\*\*), italic (\*), strikethrough (~~), highlight (==), links ([text](url)), bullet lists (-), numbered lists (1.), todo lists (- [ ] / - [x]), code blocks (\`\`\`lang), blockquotes (>), callouts (> [!type]), toggles (details/summary), images (![alt](src)), dividers (---), tables (| col |), wikilinks ([[Page Name]]). Includes YAML frontmatter generation with page metadata (title, icon, created, updated, parent, tags).

**Depends on:** None (foundational utility)

---

### SKB-14.2: Markdown to TipTap JSON Deserializer — 5 points, Critical

**Delivers:** `markdownToTiptap(md: string): JSONContent` function. Parse standard markdown + extensions (callout syntax `> [!info]`, wikilinks `[[Page Name]]`) into valid TipTap JSON. Use remark/unified ecosystem or prosemirror-markdown. Parse YAML frontmatter for page metadata. Handle edge cases: nested lists, code blocks with language hints, inline code, mixed formatting.

**Depends on:** None (foundational utility)

---

### SKB-14.3: Markdown API Endpoints — 5 points, High

**Delivers:**
- `GET /api/pages/:id?format=markdown` — returns page as markdown string with frontmatter
- `PUT /api/pages/:id?format=markdown` — accepts markdown body, converts to TipTap JSON, saves
- `GET /api/pages/:id/export` — downloads page as `.md` file
- `GET /api/pages/export` — bulk export all pages as zip of `.md` files
- `POST /api/pages/import` — accept `.md` file upload, create page from it
- Content-Type negotiation: `Accept: text/markdown` returns MD, `Accept: application/json` returns JSON (current behavior)

**Depends on:** SKB-14.1 (serializer), SKB-14.2 (deserializer)

---

### SKB-14.4: Export & Import UI — 3 points, Medium

**Delivers:** Settings modal "Export" section: "Export all pages as Markdown" button → downloads zip. "Export current page" in page menu → downloads single `.md` file. Import: drag-and-drop `.md` files onto sidebar or dedicated import dialog. Progress indicator for bulk operations. Confirmation dialog for import (shows file name, estimated page count).

**Depends on:** SKB-14.3 (API endpoints must exist)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 14.1 | Every block type converts correctly; YAML frontmatter generated | Round-trip: JSON → MD → JSON (lossless) | - |
| 14.2 | Every markdown syntax converts correctly; frontmatter parsed | Round-trip: MD → JSON → MD (preserves structure) | - |
| 14.3 | API accepts markdown, saves as JSON; GET returns markdown | Full flow: upload MD → fetch as JSON → fetch as MD | Download .md file, import .md file |
| 14.4 | Export button triggers download; import parses file | - | Export page, re-import it, verify content matches |

---

## Implementation Order

```
14.1 → 14.2 → 14.3 → 14.4 (strictly sequential)

┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│ 14.1   │────▶│ 14.2   │────▶│ 14.3   │────▶│ 14.4   │
│Serializ│     │Deserial│     │  API   │     │  UI    │
│  er    │     │  izer  │     │Endpoints│     │Export/ │
└────────┘     └────────┘     └────────┘     │ Import │
                                              └────────┘
```

**Rationale:**
- 14.1 and 14.2 are independent utilities but must be completed before API work
- 14.3 uses both serializer and deserializer
- 14.4 requires API endpoints to exist

---

## Shared Constraints

- **Round-trip fidelity**: JSON → MD → JSON should preserve structure (not byte-for-byte identical, but semantically equivalent). MD → JSON → MD should preserve markdown syntax (with normalization: `*italic*` → `_italic_` is acceptable).
- **YAML frontmatter format**:
  ```yaml
  ---
  title: Page Title
  icon: 📄
  created: 2026-02-22T10:00:00Z
  updated: 2026-02-22T15:30:00Z
  parent: parent-page-id (optional)
  tags: [tag1, tag2] (optional)
  ---
  ```
- **Wikilink syntax**: `[[Page Name]]` or `[[Page Name|Display Text]]` (Obsidian-compatible)
- **Callout syntax**: `> [!info]`, `> [!warning]`, `> [!error]`, `> [!success]` (Obsidian-compatible)
- **Toggle syntax**: Use HTML `<details>` and `<summary>` tags (markdown doesn't have native toggles)
- **Code block language hints**: ` ```typescript ` → TipTap codeBlock with `language: "typescript"` attribute
- **Image handling**: `![alt](src)` where `src` can be URL or base64 data URI
- **Table syntax**: GitHub-Flavored Markdown tables with `| col1 | col2 |` and alignment hints
- **Line breaks**: Two spaces at end of line → hard break (standard markdown), or `\n\n` → new paragraph
- **Escaping**: Markdown special characters (`#`, `*`, `[`, etc.) in regular text must be escaped in output
- **TypeScript strict mode** — no `any` types allowed
- **Error handling**: Invalid markdown should produce clear error messages, not crash
- **Performance**: Conversion of a 10,000-word document should complete in <500ms

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/markdown/serializer.ts` — TipTap JSON to Markdown converter
- `src/lib/markdown/deserializer.ts` — Markdown to TipTap JSON converter
- `src/lib/markdown/frontmatter.ts` — YAML frontmatter parser/generator
- `src/lib/markdown/types.ts` — Markdown-related TypeScript types
- `src/app/api/pages/[id]/export/route.ts` — Single page markdown export
- `src/app/api/pages/export/route.ts` — Bulk export all pages
- `src/app/api/pages/import/route.ts` — Markdown file import
- `src/components/export/ExportDialog.tsx` — Export UI modal
- `src/components/import/ImportDialog.tsx` — Import UI modal
- `src/__tests__/lib/markdown/serializer.test.ts`
- `src/__tests__/lib/markdown/deserializer.test.ts`
- `src/__tests__/lib/markdown/roundtrip.test.ts` — Round-trip conversion tests
- `src/__tests__/api/pages/export.test.ts`
- `src/__tests__/api/pages/import.test.ts`
- `tests/e2e/markdown-export-import.spec.ts`

### Modified Files
- `src/app/api/pages/[id]/route.ts` — Add `?format=markdown` query param support
- `src/app/api/pages/[id]/blocks/route.ts` — Add markdown format support
- `src/components/page/PageMenu.tsx` — Add "Export as Markdown" option
- `src/app/settings/page.tsx` — Add "Export" section
- `src/types/api.ts` — Add MarkdownPageData type

---

## Security Considerations

1. **Markdown injection**: User-provided markdown could contain malicious HTML. The deserializer must sanitize or escape HTML tags (except whitelisted ones like `<details>`).

2. **Path traversal**: When exporting/importing with file names, validate that file names don't contain `../` or other path traversal attempts.

3. **File size limits**: Limit markdown file uploads to 10MB to prevent memory exhaustion.

4. **Zip bomb protection**: When exporting bulk pages as zip, limit the number of files and total compressed size.

5. **YAML injection**: Frontmatter parsing must be safe against YAML exploits (use `js-yaml` with `safeLoad`, not `load`).

---

**Last Updated:** 2026-02-22
