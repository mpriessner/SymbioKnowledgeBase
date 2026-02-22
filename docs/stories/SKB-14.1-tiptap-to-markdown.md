# Story SKB-14.1: TipTap JSON to Markdown Serializer

**Epic:** Epic 14 - Markdown Conversion Layer
**Story ID:** SKB-14.1
**Story Points:** 8 | **Priority:** Critical | **Status:** Planned
**Depends On:** None (foundational utility)

---

## User Story

As an LLM agent (or external tool), I want to read page content as markdown instead of TipTap JSON, So that I can consume content efficiently (9x fewer tokens) in my native format.

---

## Acceptance Criteria

### Core Block Types

- [ ] **Paragraph**: Convert to plain text with newline separators
- [ ] **Heading 1/2/3**: Convert to `#`, `##`, `###` with proper spacing
- [ ] **Bold**: Convert to `**text**`
- [ ] **Italic**: Convert to `*text*`
- [ ] **Strikethrough**: Convert to `~~text~~`
- [ ] **Highlight**: Convert to `==text==` (Obsidian syntax)
- [ ] **Code (inline)**: Convert to `` `code` ``
- [ ] **Link**: Convert to `[text](url)`
- [ ] **Hard break**: Convert to `\n` or two spaces + newline

### List Types

- [ ] **Bullet list**: Convert to `- item` with proper indentation for nested lists
- [ ] **Numbered list**: Convert to `1. item` with proper indentation
- [ ] **Todo list**: Convert to `- [ ] item` (unchecked) or `- [x] item` (checked)
- [ ] **Nested lists**: Indent nested items with 2 spaces per level

### Advanced Block Types

- [ ] **Code block**: Convert to ` ```language\ncode\n``` ` with language hint
- [ ] **Blockquote**: Convert to `> text` with proper nesting
- [ ] **Callout**: Convert to `> [!type] Title\n> Content` (Obsidian syntax)
- [ ] **Toggle**: Convert to `<details><summary>Title</summary>\nContent\n</details>`
- [ ] **Horizontal rule**: Convert to `---`
- [ ] **Image**: Convert to `![alt](src)` with proper URL encoding
- [ ] **Bookmark**: Convert to link with title and description in blockquote
- [ ] **Table**: Convert to GitHub-Flavored Markdown table with alignment

### Special Features

- [ ] **Wikilink**: Convert to `[[Page Name]]` or `[[Page Name|Display Text]]`
- [ ] **YAML frontmatter**: Generate with page metadata (title, icon, created, updated, parent, tags)
- [ ] **Escaping**: Escape markdown special characters in text content (`#`, `*`, `[`, `]`, `\`, etc.)
- [ ] **Whitespace normalization**: Remove trailing whitespace, collapse multiple blank lines to max 2

### Quality & Performance

- [ ] TypeScript strict mode — no `any` types
- [ ] Handles empty/null nodes gracefully (returns empty string, not error)
- [ ] Handles malformed TipTap JSON (missing required fields) with fallback
- [ ] Performance: 10,000-word document converts in <500ms
- [ ] Round-trip test: JSON → MD → JSON preserves structure (semantic equivalence)
- [ ] Comprehensive unit tests for every block/mark type

---

## Architecture Overview

```
TipTap JSON to Markdown Serializer
───────────────────────────────────

Input (TipTap JSON):
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Title" }] },
    { "type": "paragraph", "content": [
      { "type": "text", "text": "Some " },
      { "type": "text", "marks": [{ "type": "bold" }], "text": "bold" },
      { "type": "text", "text": " text" }
    ]},
    { "type": "wikilink", "attrs": { "pageName": "Other Page", "displayText": null } }
  ]
}

Serializer Flow:
  ┌──────────────────────────────────────────────┐
  │ 1. Generate YAML frontmatter (if metadata)   │
  │    ---                                       │
  │    title: Page Title                         │
  │    created: 2026-02-22T...                   │
  │    ---                                       │
  └────────────────┬─────────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────────┐
  │ 2. Traverse TipTap JSON AST                  │
  │    - Visit each node recursively             │
  │    - Track context (indentation, list depth) │
  └────────────────┬─────────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────────┐
  │ 3. Convert nodes to markdown                 │
  │    - heading → "# text"                      │
  │    - paragraph → "text\n\n"                  │
  │    - bulletList → "- item"                   │
  │    - codeBlock → "```lang\ncode\n```"        │
  └────────────────┬─────────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────────┐
  │ 4. Handle marks (bold, italic, etc.)         │
  │    - Wrap text with markdown syntax          │
  │    - Escape special characters               │
  └────────────────┬─────────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────────┐
  │ 5. Join fragments into final markdown        │
  │    - Normalize whitespace                    │
  │    - Collapse excessive blank lines          │
  └────────────────┬─────────────────────────────┘
                   │
                   ▼
Output (Markdown):
---
title: Page Title
created: 2026-02-22T10:00:00Z
---

# Title

Some **bold** text

[[Other Page]]
```

---

## Implementation Steps

### Step 1: Create Type Definitions

**File: `src/lib/markdown/types.ts`**

```typescript
import type { JSONContent } from '@tiptap/core';

/**
 * Page metadata for YAML frontmatter.
 */
export interface PageMetadata {
  title: string;
  icon?: string | null;
  created: string; // ISO 8601
  updated: string; // ISO 8601
  parent?: string | null; // Parent page ID
  tags?: string[];
}

/**
 * Serialization context passed through recursive conversion.
 */
export interface SerializationContext {
  /** Current indentation level (for nested lists) */
  indent: number;
  /** Whether we're inside a list */
  inList: boolean;
  /** List type (bullet, ordered, todo) */
  listType?: 'bullet' | 'ordered' | 'todo';
  /** Current list item index (for ordered lists) */
  listIndex?: number;
}

/**
 * Options for tiptapToMarkdown function.
 */
export interface SerializerOptions {
  /** Include YAML frontmatter */
  includeFrontmatter?: boolean;
  /** Page metadata for frontmatter */
  metadata?: PageMetadata;
  /** Escape special markdown characters */
  escapeText?: boolean;
}
```

---

### Step 2: Create Frontmatter Generator

**File: `src/lib/markdown/frontmatter.ts`**

```typescript
import type { PageMetadata } from './types';

/**
 * Generates YAML frontmatter from page metadata.
 *
 * Output format:
 * ---
 * title: Page Title
 * icon: 📄
 * created: 2026-02-22T10:00:00Z
 * updated: 2026-02-22T15:30:00Z
 * parent: parent-page-id
 * tags: [tag1, tag2]
 * ---
 */
export function generateFrontmatter(metadata: PageMetadata): string {
  const lines: string[] = ['---'];

  // Title (required)
  lines.push(`title: ${escapeYamlString(metadata.title)}`);

  // Icon (optional)
  if (metadata.icon) {
    lines.push(`icon: ${metadata.icon}`);
  }

  // Timestamps
  lines.push(`created: ${metadata.created}`);
  lines.push(`updated: ${metadata.updated}`);

  // Parent (optional)
  if (metadata.parent) {
    lines.push(`parent: ${metadata.parent}`);
  }

  // Tags (optional)
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`tags: [${metadata.tags.map(escapeYamlString).join(', ')}]`);
  }

  lines.push('---');
  return lines.join('\n') + '\n\n';
}

/**
 * Parses YAML frontmatter from markdown string.
 *
 * Returns the metadata object and the content without frontmatter.
 */
export function parseFrontmatter(markdown: string): {
  metadata: Partial<PageMetadata>;
  content: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: markdown };
  }

  const yamlContent = match[1];
  const content = markdown.slice(match[0].length);

  // Simple YAML parser (for safety, use js-yaml in production)
  const metadata: Partial<PageMetadata> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'title':
        metadata.title = unescapeYamlString(value);
        break;
      case 'icon':
        metadata.icon = value;
        break;
      case 'created':
        metadata.created = value;
        break;
      case 'updated':
        metadata.updated = value;
        break;
      case 'parent':
        metadata.parent = value;
        break;
      case 'tags':
        // Parse array: [tag1, tag2]
        const tagsMatch = value.match(/\[(.*?)\]/);
        if (tagsMatch) {
          metadata.tags = tagsMatch[1]
            .split(',')
            .map((t) => unescapeYamlString(t.trim()));
        }
        break;
    }
  }

  return { metadata, content };
}

function escapeYamlString(str: string): string {
  // Quote if contains special characters
  if (/[:\[\]{}#&*!|>'"%@`]/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function unescapeYamlString(str: string): string {
  if (str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1).replace(/\\"/g, '"');
  }
  return str;
}
```

---

### Step 3: Create Main Serializer

**File: `src/lib/markdown/serializer.ts`**

```typescript
import type { JSONContent } from '@tiptap/core';
import type { SerializerOptions, SerializationContext } from './types';
import { generateFrontmatter } from './frontmatter';

const DEFAULT_OPTIONS: SerializerOptions = {
  includeFrontmatter: true,
  escapeText: true,
};

/**
 * Converts TipTap JSON to Markdown.
 *
 * Handles all block types, marks, and special features (wikilinks, callouts).
 * Optionally includes YAML frontmatter with page metadata.
 */
export function tiptapToMarkdown(
  json: JSONContent,
  options: SerializerOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let markdown = '';

  // Add frontmatter if metadata provided
  if (opts.includeFrontmatter && opts.metadata) {
    markdown += generateFrontmatter(opts.metadata);
  }

  // Convert content
  const context: SerializationContext = {
    indent: 0,
    inList: false,
  };

  markdown += serializeNode(json, context, opts);

  // Normalize whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  markdown = markdown.replace(/[ \t]+\n/g, '\n'); // Remove trailing whitespace

  return markdown.trim() + '\n';
}

/**
 * Recursively serialize a TipTap node to markdown.
 */
function serializeNode(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!node) return '';

  const { type, content, attrs, marks } = node;

  switch (type) {
    case 'doc':
      return serializeChildren(content, context, options);

    case 'paragraph':
      const paragraphContent = serializeChildren(content, context, options);
      return paragraphContent ? paragraphContent + '\n\n' : '';

    case 'heading':
      const level = (attrs?.level as number) || 1;
      const headingText = serializeChildren(content, context, options);
      return '#'.repeat(level) + ' ' + headingText + '\n\n';

    case 'bulletList':
      return serializeList(content, { ...context, listType: 'bullet' }, options);

    case 'orderedList':
      return serializeList(content, { ...context, listType: 'ordered', listIndex: 1 }, options);

    case 'taskList':
      return serializeList(content, { ...context, listType: 'todo' }, options);

    case 'listItem':
      return serializeListItem(node, context, options);

    case 'taskItem':
      return serializeTaskItem(node, context, options);

    case 'codeBlock':
      const language = (attrs?.language as string) || '';
      const code = serializeChildren(content, context, options);
      return '```' + language + '\n' + code + '\n```\n\n';

    case 'blockquote':
      const quoteLines = serializeChildren(content, context, options)
        .trim()
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n');
      return quoteLines + '\n\n';

    case 'callout':
      const calloutType = (attrs?.type as string) || 'info';
      const calloutTitle = (attrs?.title as string) || '';
      const calloutContent = serializeChildren(content, context, options).trim();
      let callout = `> [!${calloutType}]`;
      if (calloutTitle) callout += ' ' + calloutTitle;
      callout += '\n';
      callout += calloutContent.split('\n').map((line) => '> ' + line).join('\n');
      return callout + '\n\n';

    case 'toggle':
      const toggleTitle = (attrs?.title as string) || 'Toggle';
      const toggleContent = serializeChildren(content, context, options).trim();
      return `<details>\n<summary>${toggleTitle}</summary>\n\n${toggleContent}\n</details>\n\n`;

    case 'horizontalRule':
      return '---\n\n';

    case 'image':
      const src = (attrs?.src as string) || '';
      const alt = (attrs?.alt as string) || '';
      return `![${alt}](${src})\n\n`;

    case 'wikilink':
      const pageName = (attrs?.pageName as string) || '';
      const displayText = (attrs?.displayText as string) || null;
      return displayText ? `[[${pageName}|${displayText}]]` : `[[${pageName}]]`;

    case 'bookmark':
      const url = (attrs?.url as string) || '';
      const title = (attrs?.title as string) || url;
      const description = (attrs?.description as string) || '';
      let bookmark = `[${title}](${url})`;
      if (description) {
        bookmark += `\n\n> ${description}`;
      }
      return bookmark + '\n\n';

    case 'table':
      return serializeTable(node, context, options);

    case 'text':
      let text = node.text || '';
      // Apply marks
      if (marks && marks.length > 0) {
        text = applyMarks(text, marks, options);
      }
      return text;

    case 'hardBreak':
      return '\n';

    default:
      // Unknown node type — serialize children
      return serializeChildren(content, context, options);
  }
}

/**
 * Serialize child nodes.
 */
function serializeChildren(
  content: JSONContent[] | undefined,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!content || content.length === 0) return '';
  return content.map((child) => serializeNode(child, context, options)).join('');
}

/**
 * Serialize a list (bullet, ordered, or todo).
 */
function serializeList(
  items: JSONContent[] | undefined,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!items || items.length === 0) return '';

  const listContext = { ...context, inList: true, indent: context.indent + 1 };
  let listIndex = context.listIndex || 1;

  return items
    .map((item) => {
      const itemMarkdown = serializeNode(item, { ...listContext, listIndex }, options);
      listIndex++;
      return itemMarkdown;
    })
    .join('') + '\n';
}

/**
 * Serialize a list item.
 */
function serializeListItem(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const indent = '  '.repeat(Math.max(0, context.indent - 1));
  const bullet = context.listType === 'ordered' ? `${context.listIndex}.` : '-';
  const itemContent = serializeChildren(node.content, context, options).trim();

  return `${indent}${bullet} ${itemContent}\n`;
}

/**
 * Serialize a task item (todo list).
 */
function serializeTaskItem(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const indent = '  '.repeat(Math.max(0, context.indent - 1));
  const checked = node.attrs?.checked === true;
  const checkbox = checked ? '[x]' : '[ ]';
  const itemContent = serializeChildren(node.content, context, options).trim();

  return `${indent}- ${checkbox} ${itemContent}\n`;
}

/**
 * Serialize a table.
 */
function serializeTable(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const rows = node.content || [];
  if (rows.length === 0) return '';

  // First row is header
  const headerRow = rows[0];
  const headerCells = (headerRow.content || [])
    .map((cell) => serializeChildren(cell.content, context, options).trim())
    .join(' | ');

  // Separator row
  const colCount = headerRow.content?.length || 0;
  const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |';

  // Data rows
  const dataRows = rows.slice(1).map((row) => {
    const cells = (row.content || [])
      .map((cell) => serializeChildren(cell.content, context, options).trim())
      .join(' | ');
    return '| ' + cells + ' |';
  });

  return ['| ' + headerCells + ' |', separator, ...dataRows].join('\n') + '\n\n';
}

/**
 * Apply marks (bold, italic, etc.) to text.
 */
function applyMarks(
  text: string,
  marks: { type: string; attrs?: Record<string, any> }[],
  options: SerializerOptions
): string {
  // Escape text first (if enabled)
  if (options.escapeText) {
    text = escapeMarkdown(text);
  }

  // Apply marks in reverse order (innermost first)
  for (const mark of marks.reverse()) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`;
        break;
      case 'italic':
        text = `*${text}*`;
        break;
      case 'strike':
        text = `~~${text}~~`;
        break;
      case 'code':
        text = `\`${text}\``;
        break;
      case 'link':
        const href = mark.attrs?.href || '';
        text = `[${text}](${href})`;
        break;
      case 'highlight':
        text = `==${text}==`;
        break;
    }
  }

  return text;
}

/**
 * Escape markdown special characters.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/markdown/serializer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { tiptapToMarkdown } from '@/lib/markdown/serializer';
import type { JSONContent } from '@tiptap/core';

describe('tiptapToMarkdown', () => {
  it('should convert heading', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe('# Title\n');
  });

  it('should convert bold text', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' text' },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe('Some **bold** text\n');
  });

  it('should convert bullet list', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
  });

  it('should convert code block with language', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain('```typescript');
    expect(md).toContain('const x = 1;');
  });

  it('should convert wikilink', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'wikilink', attrs: { pageName: 'Other Page', displayText: null } },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain('[[Other Page]]');
  });

  it('should include frontmatter when metadata provided', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }],
    };

    const md = tiptapToMarkdown(json, {
      includeFrontmatter: true,
      metadata: {
        title: 'Test Page',
        created: '2026-02-22T10:00:00Z',
        updated: '2026-02-22T15:00:00Z',
      },
    });

    expect(md).toContain('---');
    expect(md).toContain('title: Test Page');
    expect(md).toContain('created: 2026-02-22T10:00:00Z');
  });
});
```

### Round-Trip Tests: `src/__tests__/lib/markdown/roundtrip.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { tiptapToMarkdown } from '@/lib/markdown/serializer';
import { markdownToTiptap } from '@/lib/markdown/deserializer';
import type { JSONContent } from '@tiptap/core';

describe('Round-trip conversion', () => {
  it('should preserve structure: JSON → MD → JSON', () => {
    const original: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph' }] },
      ],
    };

    const markdown = tiptapToMarkdown(original, { includeFrontmatter: false });
    const restored = markdownToTiptap(markdown);

    expect(restored.type).toBe('doc');
    expect(restored.content).toHaveLength(2);
    expect(restored.content![0].type).toBe('heading');
    expect(restored.content![1].type).toBe('paragraph');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/markdown/types.ts` |
| CREATE | `src/lib/markdown/frontmatter.ts` |
| CREATE | `src/lib/markdown/serializer.ts` |
| CREATE | `src/__tests__/lib/markdown/serializer.test.ts` |
| CREATE | `src/__tests__/lib/markdown/frontmatter.test.ts` |
| CREATE | `src/__tests__/lib/markdown/roundtrip.test.ts` |

---

## Dev Notes

### Challenges

1. **Mark nesting**: Multiple marks on the same text (e.g., bold + italic) require careful ordering. Use reverse order application to preserve nesting.

2. **Escaping**: Markdown special characters (`*`, `[`, `#`) in regular text must be escaped, but not when inside code blocks or already marked.

3. **Whitespace handling**: TipTap can have multiple consecutive paragraphs with empty content. These should collapse to a single blank line in markdown.

4. **List indentation**: Nested lists require proper indentation (2 spaces per level). Track context during traversal.

5. **Table complexity**: Tables with merged cells or complex formatting may not round-trip perfectly. Limit to simple tables initially.

### Libraries Used

- None — pure TypeScript implementation for full control

### Performance Optimization

- Avoid string concatenation in loops (use array.join())
- Memoize frequently-called functions (e.g., indent string generation)
- For very large documents, consider streaming serialization

---

**Last Updated:** 2026-02-22
