# Story SKB-14.2: Markdown to TipTap JSON Deserializer

**Epic:** Epic 14 - Markdown Conversion Layer
**Story ID:** SKB-14.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** None (foundational utility)

---

## User Story

As an LLM agent (or external tool), I want to create/update pages by sending markdown content, So that I can author content in my native format without understanding TipTap's JSON schema.

---

## Acceptance Criteria

- [ ] `markdownToTiptap(md: string): JSONContent` function converts markdown to TipTap JSON
- [ ] Handles standard markdown: headings, paragraphs, bold, italic, strikethrough, links, lists, code blocks, blockquotes, tables
- [ ] Handles extensions: wikilinks `[[Page Name]]`, callouts `> [!type]`, highlights `==text==`, todo lists `- [ ]`
- [ ] Parses YAML frontmatter using `js-yaml` library (safeLoad for security)
- [ ] Returns metadata object separate from content JSON
- [ ] Handles edge cases: nested lists, mixed formatting, code blocks with language hints, inline code
- [ ] Sanitizes HTML tags (whitelist: `<details>`, `<summary>`, `<mark>` only)
- [ ] Round-trip test: MD → JSON → MD preserves structure
- [ ] TypeScript strict mode — no `any` types
- [ ] Performance: 10,000-word markdown converts in <500ms

---

## Implementation Notes

Use **remark/unified** ecosystem:
- `remark-parse`: Markdown → AST
- `remark-gfm`: Tables, strikethrough, task lists
- Custom plugin for wikilinks: `[[...]]`
- Custom plugin for callouts: `> [!type]`
- Custom transformer: AST → TipTap JSON

**File: `src/lib/markdown/deserializer.ts`**

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { load as loadYaml } from 'js-yaml';
import type { JSONContent } from '@tiptap/core';
import type { PageMetadata } from './types';
import { parseFrontmatter } from './frontmatter';

export interface DeserializeResult {
  content: JSONContent;
  metadata: Partial<PageMetadata>;
}

export function markdownToTiptap(markdown: string): DeserializeResult {
  // 1. Parse frontmatter
  const { metadata, content } = parseFrontmatter(markdown);

  // 2. Parse markdown to AST
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(wikilinkPlugin)
    .use(calloutPlugin);

  const ast = processor.parse(content);

  // 3. Convert AST to TipTap JSON
  const tiptapJson = astToTiptap(ast);

  return { content: tiptapJson, metadata };
}

// AST to TipTap conversion logic (traverse remark AST)
function astToTiptap(node: any): JSONContent {
  // Implementation details omitted for brevity
  // Maps remark node types to TipTap node types
}
```

---

## Testing Requirements

```typescript
// Unit tests for every markdown syntax
describe('markdownToTiptap', () => {
  it('should convert headings', () => {
    const md = '# Title\n\n## Subtitle';
    const result = markdownToTiptap(md);
    expect(result.content.content[0].type).toBe('heading');
    expect(result.content.content[0].attrs.level).toBe(1);
  });

  it('should convert wikilinks', () => {
    const md = '[[Page Name]]';
    const result = markdownToTiptap(md);
    const wikilink = result.content.content[0].content[0];
    expect(wikilink.type).toBe('wikilink');
    expect(wikilink.attrs.pageName).toBe('Page Name');
  });

  // ... tests for all syntax types
});
```

---

## Files to Create

- `src/lib/markdown/deserializer.ts`
- `src/lib/markdown/plugins/wikilink.ts`
- `src/lib/markdown/plugins/callout.ts`
- `src/__tests__/lib/markdown/deserializer.test.ts`

---

**Last Updated:** 2026-02-22
