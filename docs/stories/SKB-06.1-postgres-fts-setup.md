# Story SKB-06.1: PostgreSQL Full-Text Search Setup

**Epic:** Epic 6 - Search & Navigation
**Story ID:** SKB-06.1
**Story Points:** 3 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-04.1 (Block CRUD — block content must exist to be indexed)

---

## User Story

As a system, I want block content indexed for full-text search, So that users and AI agents can find information across the knowledge base.

---

## Acceptance Criteria

- [ ] `search_vector` tsvector column added to `blocks` table
- [ ] GIN index on `search_vector` column for fast full-text lookups
- [ ] PostgreSQL trigger or application-level update: on block content change, extract plain text from TipTap JSON, update tsvector
- [ ] `lib/search/indexer.ts`: `extractPlainText(tiptapJson)` function that traverses TipTap JSON and extracts all text content
- [ ] `lib/search/indexer.ts`: `updateSearchIndex(blockId, text)` function that updates the `search_vector` column
- [ ] `lib/search/query.ts`: `searchBlocks(query, tenantId, limit, offset)` function using `ts_rank` for relevance and `ts_headline` for snippets
- [ ] Search queries scoped by `tenant_id`
- [ ] `reindexAllBlocks(tenantId)` function for bulk reindexing
- [ ] Prisma migration for `search_vector` column, GIN index, and trigger
- [ ] TypeScript strict mode — all types fully defined

---

## Architecture Overview

```
Block Save → Search Index Update
─────────────────────────────────

  Block content saved (TipTap JSON)
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  indexer.ts: extractPlainText(tiptapJson)             │
  │                                                        │
  │  Input (TipTap JSON):                                  │
  │  {                                                     │
  │    type: 'doc',                                        │
  │    content: [{                                         │
  │      type: 'paragraph',                                │
  │      content: [                                        │
  │        { type: 'text', text: 'PostgreSQL is a...' },  │
  │        { type: 'wikilink', attrs: {                   │
  │            pageName: 'Database Setup' } }             │
  │      ]                                                 │
  │    }]                                                  │
  │  }                                                     │
  │                                                        │
  │  Output (plain text):                                  │
  │  "PostgreSQL is a... Database Setup"                   │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  PostgreSQL: UPDATE blocks SET search_vector =        │
  │    to_tsvector('english', :plainText)                 │
  │    WHERE id = :blockId                                │
  └──────────────────────────────────────────────────────┘

Search Query Flow
─────────────────

  query.ts: searchBlocks('postgresql setup', tenantId, 20, 0)
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  PostgreSQL Full-Text Search                          │
  │                                                        │
  │  SELECT                                                │
  │    b.id AS block_id,                                   │
  │    b.page_id,                                          │
  │    p.title AS page_title,                              │
  │    p.icon AS page_icon,                                │
  │    ts_rank(b.search_vector,                            │
  │      plainto_tsquery('english', 'postgresql setup')    │
  │    ) AS rank,                                          │
  │    ts_headline('english', b.plain_text,                │
  │      plainto_tsquery('english', 'postgresql setup'),   │
  │      'StartSel=<mark>, StopSel=</mark>,                │
  │       MaxWords=35, MinWords=15'                        │
  │    ) AS snippet                                        │
  │  FROM blocks b                                         │
  │  JOIN pages p ON p.id = b.page_id                      │
  │  WHERE b.search_vector @@ plainto_tsquery(             │
  │    'english', 'postgresql setup'                       │
  │  )                                                     │
  │  AND b.tenant_id = :tenantId                           │
  │  ORDER BY rank DESC                                    │
  │  LIMIT 20 OFFSET 0                                     │
  │                                                        │
  │  GIN Index on search_vector → fast lookup              │
  └──────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the Prisma Migration

Add the `search_vector` tsvector column, `plain_text` column (for ts_headline), GIN index, and update trigger to the blocks table.

**File: `prisma/migrations/XXXXXX_add_search_vector/migration.sql`**

```sql
-- Add plain_text column for storing extracted text (used by ts_headline)
ALTER TABLE blocks ADD COLUMN plain_text TEXT NOT NULL DEFAULT '';

-- Add search_vector column for full-text search
ALTER TABLE blocks ADD COLUMN search_vector tsvector;

-- Create GIN index for fast full-text search lookups
CREATE INDEX idx_blocks_search_vector ON blocks USING GIN (search_vector);

-- Create a function that updates search_vector from plain_text
CREATE OR REPLACE FUNCTION blocks_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.plain_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires on INSERT or UPDATE of plain_text
CREATE TRIGGER trigger_blocks_search_vector_update
  BEFORE INSERT OR UPDATE OF plain_text ON blocks
  FOR EACH ROW
  EXECUTE FUNCTION blocks_search_vector_update();

-- Composite index for tenant-scoped search
CREATE INDEX idx_blocks_tenant_search ON blocks (tenant_id)
  WHERE search_vector IS NOT NULL;
```

---

### Step 2: Update Prisma Schema

Add the new columns to the Prisma schema.

**File: `prisma/schema.prisma` (modification)**

```prisma
model Block {
  id            String   @id @default(uuid())
  page_id       String
  tenant_id     String
  type          String
  content       Json
  sort_order    Int
  plain_text    String   @default("")
  search_vector Unsupported("tsvector")?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  page   Page   @relation(fields: [page_id], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, page_id])
  @@index([tenant_id])
}
```

**Note:** The `search_vector` column uses Prisma's `Unsupported` type because tsvector is not a native Prisma type. The trigger handles its population automatically from `plain_text`.

---

### Step 3: Implement the Plain Text Extractor

Extracts all plain text from a TipTap JSON document for search indexing.

**File: `src/lib/search/indexer.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { TipTapDocument, TipTapNode } from '@/lib/wikilinks/types';

/**
 * Extracts plain text from a TipTap JSON document.
 *
 * Traverses all nodes and concatenates text content, including:
 * - Regular text nodes
 * - Wikilink node pageName/displayText (so linked page names are searchable)
 * - Code block content
 *
 * Adds spaces between blocks for readability.
 *
 * @param tiptapJson - The TipTap JSON document
 * @returns Plain text string suitable for full-text indexing
 */
export function extractPlainText(
  tiptapJson: TipTapDocument | null | undefined
): string {
  if (!tiptapJson || !tiptapJson.content) {
    return '';
  }

  const parts: string[] = [];
  extractTextFromNodes(tiptapJson.content, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Recursively extracts text content from TipTap nodes.
 */
function extractTextFromNodes(nodes: TipTapNode[], parts: string[]): void {
  for (const node of nodes) {
    // Text nodes: direct text content
    if (node.type === 'text' && node.text) {
      parts.push(node.text);
    }

    // Wikilink nodes: extract page name and display text
    if (node.type === 'wikilink' && node.attrs) {
      const displayText = node.attrs['displayText'] as string | undefined;
      const pageName = node.attrs['pageName'] as string | undefined;
      if (displayText) {
        parts.push(displayText);
      }
      if (pageName) {
        parts.push(pageName);
      }
    }

    // Recurse into child nodes
    if (node.content) {
      extractTextFromNodes(node.content, parts);
    }
  }
}

/**
 * Updates the search index for a single block.
 *
 * Extracts plain text from the block's TipTap JSON content,
 * then updates the plain_text column. The PostgreSQL trigger
 * automatically updates the search_vector from plain_text.
 *
 * @param blockId - The block ID to update
 * @param tiptapJson - The block's TipTap JSON content
 */
export async function updateSearchIndex(
  blockId: string,
  tiptapJson: TipTapDocument
): Promise<void> {
  const plainText = extractPlainText(tiptapJson);

  await prisma.block.update({
    where: { id: blockId },
    data: { plain_text: plainText },
  });
}

/**
 * Updates the search index for all blocks of a specific page.
 *
 * Called after block saves to ensure the search index is current.
 *
 * @param pageId - The page whose blocks should be reindexed
 * @param tenantId - Tenant UUID for scoping
 */
export async function updateSearchIndexForPage(
  pageId: string,
  tenantId: string
): Promise<void> {
  const blocks = await prisma.block.findMany({
    where: {
      page_id: pageId,
      tenant_id: tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const tiptapJson = block.content as TipTapDocument;
    const plainText = extractPlainText(tiptapJson);

    await prisma.block.update({
      where: { id: block.id },
      data: { plain_text: plainText },
    });
  }
}

/**
 * Reindexes all blocks for a given tenant.
 * Useful for initial migration or data repair.
 *
 * @param tenantId - Tenant UUID
 */
export async function reindexAllBlocks(tenantId: string): Promise<{
  blocksProcessed: number;
}> {
  const blocks = await prisma.block.findMany({
    where: { tenant_id: tenantId },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const tiptapJson = block.content as TipTapDocument;
    const plainText = extractPlainText(tiptapJson);

    await prisma.block.update({
      where: { id: block.id },
      data: { plain_text: plainText },
    });
  }

  return { blocksProcessed: blocks.length };
}
```

---

### Step 4: Implement the Search Query Builder

Builds and executes full-text search queries using PostgreSQL FTS features.

**File: `src/lib/search/query.ts`**

```typescript
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  blockId: string;
  snippet: string;
  rank: number;
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
}

/**
 * Searches blocks using PostgreSQL full-text search.
 *
 * Uses plainto_tsquery to parse the search term (handles spaces, stopwords).
 * Uses ts_rank for relevance scoring.
 * Uses ts_headline to generate snippets with highlighted matching terms.
 *
 * Results are grouped by page — if multiple blocks in the same page match,
 * only the highest-ranked block is returned.
 *
 * @param query - The search query string
 * @param tenantId - Tenant UUID for scoping
 * @param limit - Maximum number of results (default 20)
 * @param offset - Offset for pagination (default 0)
 * @returns Search results with snippets and relevance scores
 */
export async function searchBlocks(
  query: string,
  tenantId: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  // Sanitize the query — plainto_tsquery handles most injection prevention,
  // but we still strip dangerous characters
  const sanitizedQuery = query
    .replace(/[<>]/g, '')
    .trim();

  if (sanitizedQuery.length === 0) {
    return { results: [], total: 0 };
  }

  // Execute the search using raw SQL for access to ts_rank and ts_headline
  const results = await prisma.$queryRaw<
    Array<{
      page_id: string;
      page_title: string;
      page_icon: string | null;
      block_id: string;
      snippet: string;
      rank: number;
    }>
  >`
    SELECT DISTINCT ON (b.page_id)
      b.page_id,
      p.title AS page_title,
      p.icon AS page_icon,
      b.id AS block_id,
      ts_headline(
        'english',
        b.plain_text,
        plainto_tsquery('english', ${sanitizedQuery}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
      ) AS snippet,
      ts_rank(b.search_vector, plainto_tsquery('english', ${sanitizedQuery})) AS rank
    FROM blocks b
    JOIN pages p ON p.id = b.page_id
    WHERE b.search_vector @@ plainto_tsquery('english', ${sanitizedQuery})
      AND b.tenant_id = ${tenantId}::uuid
    ORDER BY b.page_id, rank DESC
  `;

  // Sort by rank (DISTINCT ON loses the overall ordering)
  const sorted = results.sort((a, b) => b.rank - a.rank);

  // Apply pagination
  const total = sorted.length;
  const paginated = sorted.slice(offset, offset + limit);

  return {
    results: paginated.map((r) => ({
      pageId: r.page_id,
      pageTitle: r.page_title,
      pageIcon: r.page_icon,
      blockId: r.block_id,
      snippet: r.snippet,
      rank: r.rank,
    })),
    total,
  };
}

/**
 * Searches pages by title only (no block content).
 * Used for quick page title matching (autocomplete, quick switcher).
 *
 * @param query - The search query string
 * @param tenantId - Tenant UUID
 * @param limit - Maximum results (default 10)
 */
export async function searchPagesByTitle(
  query: string,
  tenantId: string,
  limit: number = 10
): Promise<Array<{ id: string; title: string; icon: string | null }>> {
  const sanitizedQuery = query.replace(/[<>]/g, '').trim();

  if (sanitizedQuery.length === 0) {
    return [];
  }

  return prisma.page.findMany({
    where: {
      tenant_id: tenantId,
      title: {
        contains: sanitizedQuery,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      title: true,
      icon: true,
    },
    take: limit,
    orderBy: {
      updated_at: 'desc',
    },
  });
}
```

---

### Step 5: Integrate Search Indexing with Block Save

Modify the block save handler to update the search index after saving.

**File: `src/app/api/pages/[id]/blocks/route.ts` (modification)**

```typescript
import { updateSearchIndex } from '@/lib/search/indexer';
import type { TipTapDocument } from '@/lib/wikilinks/types';

// Inside the PUT handler, after saving block content:

// ... existing block save logic ...

// Update search index for each saved block
for (const block of savedBlocks) {
  await updateSearchIndex(block.id, block.content as TipTapDocument);
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/search/indexer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractPlainText } from '@/lib/search/indexer';
import type { TipTapDocument } from '@/lib/wikilinks/types';

describe('extractPlainText', () => {
  it('should return empty string for null input', () => {
    expect(extractPlainText(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(extractPlainText(undefined)).toBe('');
  });

  it('should extract text from a simple paragraph', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('Hello world');
  });

  it('should extract text from multiple paragraphs', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('First paragraph Second paragraph');
  });

  it('should include wikilink page names in extracted text', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-1',
                pageName: 'Installation Guide',
                displayText: null,
              },
            },
            { type: 'text', text: ' for details' },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe(
      'See Installation Guide for details'
    );
  });

  it('should include wikilink display text and page name', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-1',
                pageName: 'Installation Guide',
                displayText: 'setup docs',
              },
            },
          ],
        },
      ],
    };
    const result = extractPlainText(doc);
    expect(result).toContain('setup docs');
    expect(result).toContain('Installation Guide');
  });

  it('should extract text from nested structures (blockquotes, lists)', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Quoted text' }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'List item' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('Quoted text List item');
  });

  it('should collapse multiple whitespace characters', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '  Multiple   spaces  ' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('Multiple spaces');
  });

  it('should handle document with no text content', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'horizontalRule',
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('');
  });
});
```

### Integration Tests: `src/__tests__/lib/search/query.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { searchBlocks } from '@/lib/search/query';
import { updateSearchIndex } from '@/lib/search/indexer';

describe('searchBlocks (integration)', () => {
  let tenantId: string;
  let pageId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const page = await prisma.page.create({
      data: { title: 'PostgreSQL Setup Guide', tenant_id: tenantId },
    });
    pageId = page.id;

    // Create a block with searchable content
    const block = await prisma.block.create({
      data: {
        page_id: pageId,
        tenant_id: tenantId,
        type: 'paragraph',
        sort_order: 0,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'PostgreSQL is a powerful open-source relational database',
                },
              ],
            },
          ],
        },
        plain_text:
          'PostgreSQL is a powerful open-source relational database',
      },
    });
  });

  it('should find blocks matching the search query', async () => {
    const results = await searchBlocks('postgresql database', tenantId);

    expect(results.total).toBeGreaterThan(0);
    expect(results.results[0].pageId).toBe(pageId);
    expect(results.results[0].pageTitle).toBe('PostgreSQL Setup Guide');
    expect(results.results[0].rank).toBeGreaterThan(0);
  });

  it('should return snippets with highlighted terms', async () => {
    const results = await searchBlocks('postgresql', tenantId);

    expect(results.results[0].snippet).toContain('<mark>');
    expect(results.results[0].snippet).toContain('</mark>');
  });

  it('should return empty results for non-matching query', async () => {
    const results = await searchBlocks('nonexistentterm12345', tenantId);
    expect(results.total).toBe(0);
    expect(results.results).toHaveLength(0);
  });

  it('should enforce tenant isolation', async () => {
    const otherTenant = await prisma.tenant.create({ data: { name: 'Other' } });
    const results = await searchBlocks('postgresql', otherTenant.id);
    expect(results.total).toBe(0);
  });

  it('should handle empty query gracefully', async () => {
    const results = await searchBlocks('', tenantId);
    expect(results.total).toBe(0);
  });

  it('should respect limit and offset', async () => {
    const results = await searchBlocks('postgresql', tenantId, 1, 0);
    expect(results.results.length).toBeLessThanOrEqual(1);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `prisma/migrations/XXXXXX_add_search_vector/migration.sql` |
| MODIFY | `prisma/schema.prisma` (add plain_text and search_vector columns to Block model) |
| CREATE | `src/lib/search/indexer.ts` |
| CREATE | `src/lib/search/query.ts` |
| MODIFY | `src/app/api/pages/[id]/blocks/route.ts` (call updateSearchIndex after block save) |
| CREATE | `src/__tests__/lib/search/indexer.test.ts` |
| CREATE | `src/__tests__/lib/search/query.test.ts` |

---

**Last Updated:** 2026-02-21
