# Story SKB-05.1: Wikilink Parser and Page Link Index

**Epic:** Epic 5 - Wikilinks & Backlinks
**Story ID:** SKB-05.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-04.1 (Block Editor CRUD — block content must be saveable in JSONB format)

---

## User Story

As a system, I want to extract wikilinks from block content and maintain a link index, So that backlinks and graph features can work.

---

## Acceptance Criteria

- [ ] `lib/wikilinks/parser.ts` exports `extractWikilinks(tiptapJson)` returning `[{pageName, displayText?, position}]`
- [ ] Parser handles `[[Page Name]]` syntax (pageName extracted, displayText is undefined)
- [ ] Parser handles `[[Page Name|Display Text]]` syntax (both pageName and displayText extracted)
- [ ] Parser regex: `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/` correctly matches all wikilink patterns
- [ ] Parser traverses nested TipTap JSON nodes recursively (paragraphs, list items, blockquotes, etc.)
- [ ] `lib/wikilinks/resolver.ts` exports `resolveWikilinks(links, tenantId)` that looks up page IDs by title within tenant
- [ ] Resolver returns `{ resolved: [{pageName, pageId, displayText}], unresolved: [{pageName, displayText}] }`
- [ ] `lib/wikilinks/indexer.ts` exports `updatePageLinks(pageId, tenantId, targetPageIds)` that upserts `page_links` rows
- [ ] Indexer uses diff-based approach: inserts new links, deletes removed links (avoids full delete-and-reinsert)
- [ ] Indexer runs inside the same database transaction as block save
- [ ] Called after every block save: extract links -> resolve -> update index
- [ ] Unresolved links (page doesn't exist yet) stored with `target_page_id = null` or in a separate `unresolved_links` tracking mechanism
- [ ] When a new page is created, unresolved links matching its title are resolved and `page_links` rows created
- [ ] Duplicate links to the same target page are deduplicated (only one `page_links` row per source-target pair)
- [ ] Self-links (page linking to itself) are allowed and indexed
- [ ] All queries scoped by `tenant_id`
- [ ] TypeScript strict mode — all types fully defined, no `any`

---

## Architecture Overview

```
Block Save Flow (triggered on auto-save or manual save)
─────────────────────────────────────────────────────

  PUT /api/pages/[id]/blocks
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │  Block Save Handler (route.ts)                   │
  │                                                   │
  │  1. Validate & save block content to DB           │
  │  2. Extract wikilinks from saved content          │
  │  3. Resolve wikilinks to page IDs                 │
  │  4. Update page_links index                       │
  │                                                   │
  │  All within a single Prisma transaction           │
  └─────────────────┬───────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────┐
  │  parser.ts: extractWikilinks(tiptapJson)         │
  │                                                   │
  │  Input: TipTap JSON document                      │
  │  {                                                │
  │    type: 'doc',                                   │
  │    content: [{                                    │
  │      type: 'paragraph',                           │
  │      content: [{                                  │
  │        type: 'text',                              │
  │        text: 'See [[Installation Guide]]'         │
  │      }]                                           │
  │    }]                                             │
  │  }                                                │
  │                                                   │
  │  Output: [                                        │
  │    { pageName: 'Installation Guide',              │
  │      displayText: undefined,                      │
  │      position: { blockIndex: 0, offset: 4 } }    │
  │  ]                                                │
  │                                                   │
  │  Also handles TipTap wikilink nodes:              │
  │  { type: 'wikilink', attrs: { pageId, pageName }} │
  └─────────────────┬───────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────┐
  │  resolver.ts: resolveWikilinks(links, tenantId)  │
  │                                                   │
  │  Input: [{ pageName, displayText }]               │
  │                                                   │
  │  Query: SELECT id, title FROM pages               │
  │         WHERE title IN (...) AND tenant_id = ?    │
  │                                                   │
  │  Output: {                                        │
  │    resolved: [{ pageName, pageId, displayText }], │
  │    unresolved: [{ pageName, displayText }]        │
  │  }                                                │
  └─────────────────┬───────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────┐
  │  indexer.ts: updatePageLinks(                    │
  │    pageId, tenantId, targetPageIds               │
  │  )                                               │
  │                                                   │
  │  1. Fetch existing page_links for source page     │
  │  2. Compute diff:                                 │
  │     - toAdd = targetPageIds - existingIds         │
  │     - toRemove = existingIds - targetPageIds      │
  │  3. INSERT new page_links rows                    │
  │  4. DELETE stale page_links rows                  │
  │                                                   │
  │  page_links table:                                │
  │  ┌──────────────────────────────────────┐        │
  │  │ id │ source_page_id │ target_page_id │        │
  │  │    │ tenant_id      │ created_at     │        │
  │  └──────────────────────────────────────┘        │
  └─────────────────────────────────────────────────┘

New Page Creation Flow (resolves pending links)
───────────────────────────────────────────────

  POST /api/pages
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │  1. Create new page                               │
  │  2. Check for unresolved wikilinks matching title  │
  │  3. Resolve them → create page_links rows          │
  └─────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Wikilink Types

Create the shared TypeScript types used across all wikilink modules.

**File: `src/lib/wikilinks/types.ts`**

```typescript
/**
 * A wikilink extracted from TipTap block content.
 * Can be either a raw text wikilink ([[Page Name]]) or
 * a TipTap wikilink node ({ type: 'wikilink', attrs: {...} }).
 */
export interface ExtractedWikilink {
  /** The page name/title referenced by the wikilink */
  pageName: string;
  /** Optional display text (from [[Page|Display]] syntax) */
  displayText?: string;
  /** Position within the document for context extraction */
  position: {
    /** Index of the block containing this wikilink */
    blockIndex: number;
    /** Character offset within the block's text content */
    offset: number;
  };
}

/**
 * A wikilink extracted from a TipTap wikilink node
 * (already has a pageId from previous resolution).
 */
export interface ExtractedWikilinkNode {
  /** The resolved page ID (UUID) */
  pageId: string;
  /** The page name stored in the node */
  pageName: string;
  /** Optional custom display text */
  displayText?: string;
}

/**
 * Result of resolving wikilinks against the pages table.
 */
export interface ResolvedWikilinks {
  /** Wikilinks that matched an existing page */
  resolved: Array<{
    pageName: string;
    pageId: string;
    displayText?: string;
  }>;
  /** Wikilinks that did not match any existing page */
  unresolved: Array<{
    pageName: string;
    displayText?: string;
  }>;
}

/**
 * Represents a TipTap JSON node (simplified for traversal).
 */
export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

/**
 * A TipTap document (the root node).
 */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}
```

---

### Step 2: Implement the Wikilink Parser

The parser traverses TipTap JSON content and extracts wikilinks from two sources:
1. Raw text content containing `[[Page Name]]` or `[[Page Name|Display Text]]` patterns
2. TipTap wikilink nodes (type: 'wikilink') that were previously inserted via autocomplete

**File: `src/lib/wikilinks/parser.ts`**

```typescript
import type {
  ExtractedWikilink,
  ExtractedWikilinkNode,
  TipTapNode,
  TipTapDocument,
} from './types';

/**
 * Regex to match wikilink syntax in raw text.
 * Matches: [[Page Name]] and [[Page Name|Display Text]]
 *
 * Capture groups:
 *   1: pageName — everything between [[ and ]] or [[  and |
 *   2: displayText — everything between | and ]] (optional)
 *
 * Does not match:
 *   - Empty wikilinks: [[]]
 *   - Nested brackets: [[Page [[inner]]]]
 *   - Wikilinks with only whitespace: [[   ]]
 */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extracts all wikilinks from a TipTap JSON document.
 *
 * Handles two types of wikilinks:
 * 1. Raw text wikilinks: [[Page Name]] or [[Page Name|Display]]
 *    Found by regex-matching text nodes in the document tree.
 * 2. Wikilink nodes: { type: 'wikilink', attrs: { pageId, pageName, displayText } }
 *    Found by traversing the document tree for nodes of type 'wikilink'.
 *
 * @param tiptapJson - The TipTap JSON document (or null/undefined)
 * @returns Array of extracted wikilinks with positions
 */
export function extractWikilinks(
  tiptapJson: TipTapDocument | null | undefined
): ExtractedWikilink[] {
  if (!tiptapJson || !tiptapJson.content) {
    return [];
  }

  const wikilinks: ExtractedWikilink[] = [];
  const seen = new Set<string>(); // Track unique pageName values for dedup

  traverseNodes(tiptapJson.content, 0, wikilinks, seen);

  return wikilinks;
}

/**
 * Extracts wikilink nodes (type: 'wikilink') that already have resolved pageIds.
 * These are links inserted via the autocomplete UI that store pageId in attrs.
 *
 * @param tiptapJson - The TipTap JSON document
 * @returns Array of wikilink nodes with their pageId, pageName, and displayText
 */
export function extractWikilinkNodes(
  tiptapJson: TipTapDocument | null | undefined
): ExtractedWikilinkNode[] {
  if (!tiptapJson || !tiptapJson.content) {
    return [];
  }

  const nodes: ExtractedWikilinkNode[] = [];
  traverseForWikilinkNodes(tiptapJson.content, nodes);
  return nodes;
}

/**
 * Extracts all target page IDs from a TipTap document.
 * Combines both resolved wikilink nodes (have pageId) and text-based wikilinks
 * that need resolution. Returns only the already-resolved page IDs.
 *
 * For a complete extraction including unresolved links, use
 * extractWikilinks() + resolveWikilinks() pipeline.
 *
 * @param tiptapJson - The TipTap JSON document
 * @returns Array of unique page IDs referenced by wikilink nodes
 */
export function extractResolvedPageIds(
  tiptapJson: TipTapDocument | null | undefined
): string[] {
  const nodes = extractWikilinkNodes(tiptapJson);
  const uniqueIds = new Set(nodes.map((n) => n.pageId));
  return Array.from(uniqueIds);
}

/**
 * Recursively traverses TipTap nodes, extracting wikilinks from text content.
 */
function traverseNodes(
  nodes: TipTapNode[],
  blockIndex: number,
  results: ExtractedWikilink[],
  seen: Set<string>
): void {
  for (const node of nodes) {
    // Check for wikilink nodes (inserted via autocomplete)
    if (node.type === 'wikilink' && node.attrs) {
      const pageName = node.attrs['pageName'] as string | undefined;
      if (pageName && !seen.has(pageName.toLowerCase())) {
        seen.add(pageName.toLowerCase());
        results.push({
          pageName,
          displayText: (node.attrs['displayText'] as string | undefined) || undefined,
          position: { blockIndex, offset: 0 },
        });
      }
      return; // Wikilink nodes don't have child content
    }

    // Check text nodes for raw [[wikilink]] syntax
    if (node.type === 'text' && node.text) {
      let match: RegExpExecArray | null;
      // Reset regex state for each text node
      WIKILINK_REGEX.lastIndex = 0;

      while ((match = WIKILINK_REGEX.exec(node.text)) !== null) {
        const pageName = match[1].trim();
        const displayText = match[2]?.trim() || undefined;

        if (pageName && !seen.has(pageName.toLowerCase())) {
          seen.add(pageName.toLowerCase());
          results.push({
            pageName,
            displayText,
            position: { blockIndex, offset: match.index },
          });
        }
      }
    }

    // Recurse into child nodes
    if (node.content && node.content.length > 0) {
      traverseNodes(
        node.content,
        node.type === 'doc' ? blockIndex : blockIndex,
        results,
        seen
      );
    }
  }
}

/**
 * Traverses the document tree to find wikilink nodes with resolved page IDs.
 */
function traverseForWikilinkNodes(
  nodes: TipTapNode[],
  results: ExtractedWikilinkNode[]
): void {
  for (const node of nodes) {
    if (node.type === 'wikilink' && node.attrs) {
      const pageId = node.attrs['pageId'] as string | undefined;
      const pageName = node.attrs['pageName'] as string | undefined;

      if (pageId && pageName) {
        results.push({
          pageId,
          pageName,
          displayText: (node.attrs['displayText'] as string | undefined) || undefined,
        });
      }
    }

    if (node.content) {
      traverseForWikilinkNodes(node.content, results);
    }
  }
}
```

---

### Step 3: Implement the Wikilink Resolver

The resolver takes extracted wikilink page names and looks up their corresponding page IDs in the database, scoped by tenant.

**File: `src/lib/wikilinks/resolver.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { ExtractedWikilink, ResolvedWikilinks } from './types';

/**
 * Resolves an array of extracted wikilinks against the pages table.
 * Looks up pages by title within the specified tenant.
 *
 * Uses a single IN query to resolve all page names at once,
 * then partitions results into resolved and unresolved groups.
 *
 * @param links - Extracted wikilinks with pageName
 * @param tenantId - Tenant UUID for scoping the lookup
 * @returns Object with resolved (have pageId) and unresolved (no matching page) arrays
 */
export async function resolveWikilinks(
  links: ExtractedWikilink[],
  tenantId: string
): Promise<ResolvedWikilinks> {
  if (links.length === 0) {
    return { resolved: [], unresolved: [] };
  }

  // Collect unique page names (case-insensitive dedup)
  const uniqueNames = Array.from(
    new Set(links.map((l) => l.pageName.toLowerCase()))
  );

  // Single query to find all matching pages by title within tenant
  const matchingPages = await prisma.page.findMany({
    where: {
      tenant_id: tenantId,
      title: {
        in: links.map((l) => l.pageName),
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  // Build a lookup map: lowercase title -> page record
  const pageByTitle = new Map<string, { id: string; title: string }>();
  for (const page of matchingPages) {
    pageByTitle.set(page.title.toLowerCase(), page);
  }

  // Partition links into resolved and unresolved
  const resolved: ResolvedWikilinks['resolved'] = [];
  const unresolved: ResolvedWikilinks['unresolved'] = [];
  const resolvedNames = new Set<string>();

  for (const link of links) {
    const key = link.pageName.toLowerCase();

    // Skip duplicates (same page name already processed)
    if (resolvedNames.has(key)) {
      continue;
    }
    resolvedNames.add(key);

    const matchedPage = pageByTitle.get(key);
    if (matchedPage) {
      resolved.push({
        pageName: link.pageName,
        pageId: matchedPage.id,
        displayText: link.displayText,
      });
    } else {
      unresolved.push({
        pageName: link.pageName,
        displayText: link.displayText,
      });
    }
  }

  return { resolved, unresolved };
}

/**
 * When a new page is created, checks for any blocks containing unresolved
 * wikilinks that reference the new page's title. If found, creates the
 * corresponding page_links rows.
 *
 * This function should be called from the page creation handler.
 *
 * @param newPageId - The ID of the newly created page
 * @param newPageTitle - The title of the newly created page
 * @param tenantId - Tenant UUID
 */
export async function resolveUnresolvedLinksForNewPage(
  newPageId: string,
  newPageTitle: string,
  tenantId: string
): Promise<void> {
  // Find all blocks in this tenant that contain text matching the new page title
  // wrapped in [[ ]] syntax. This uses a simple LIKE query on the JSONB content.
  // For production scale, consider a dedicated unresolved_links table.
  const blocksWithPotentialLinks = await prisma.block.findMany({
    where: {
      tenant_id: tenantId,
      // Search for the page title in serialized content
      // This is a broad match; the parser will do precise extraction
      content: {
        path: [],
        string_contains: newPageTitle,
      },
    },
    select: {
      id: true,
      page_id: true,
      content: true,
    },
  });

  if (blocksWithPotentialLinks.length === 0) {
    return;
  }

  // For each block, re-extract wikilinks and check if any match the new page
  const { extractWikilinks } = await import('./parser');
  const linksToCreate: Array<{ source_page_id: string }> = [];
  const seenSourcePages = new Set<string>();

  for (const block of blocksWithPotentialLinks) {
    const extracted = extractWikilinks(
      block.content as import('./types').TipTapDocument
    );
    const matchingLink = extracted.find(
      (link) => link.pageName.toLowerCase() === newPageTitle.toLowerCase()
    );

    if (matchingLink && !seenSourcePages.has(block.page_id)) {
      seenSourcePages.add(block.page_id);
      linksToCreate.push({ source_page_id: block.page_id });
    }
  }

  // Batch create page_links rows
  if (linksToCreate.length > 0) {
    await prisma.pageLink.createMany({
      data: linksToCreate.map((link) => ({
        source_page_id: link.source_page_id,
        target_page_id: newPageId,
        tenant_id: tenantId,
      })),
      skipDuplicates: true,
    });
  }
}
```

---

### Step 4: Implement the Page Link Indexer

The indexer maintains the `page_links` table using a diff-based approach to minimize database writes.

**File: `src/lib/wikilinks/indexer.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@prisma/client';
import { extractWikilinks, extractResolvedPageIds } from './parser';
import { resolveWikilinks } from './resolver';
import type { TipTapDocument } from './types';

/**
 * Updates the page_links index for a given page based on its current block content.
 *
 * This function:
 * 1. Extracts all wikilinks from the page's blocks (both text-based and node-based)
 * 2. Resolves text-based wikilinks to page IDs
 * 3. Computes a diff against existing page_links rows
 * 4. Inserts new links and deletes removed links
 *
 * Should be called within the same transaction as the block save.
 *
 * @param pageId - The source page ID whose links are being updated
 * @param tenantId - Tenant UUID for scoping
 * @param blockContents - Array of TipTap JSON documents from the page's blocks
 * @param tx - Optional Prisma transaction client (for transactional consistency)
 */
export async function updatePageLinks(
  pageId: string,
  tenantId: string,
  blockContents: TipTapDocument[],
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  const db = tx || prisma;

  // Step 1: Extract all target page IDs from block content
  const allTargetPageIds = new Set<string>();

  for (const content of blockContents) {
    // Extract wikilink nodes that already have resolved pageIds
    const resolvedIds = extractResolvedPageIds(content);
    resolvedIds.forEach((id) => allTargetPageIds.add(id));

    // Extract text-based wikilinks that need resolution
    const textWikilinks = extractWikilinks(content);
    if (textWikilinks.length > 0) {
      const { resolved } = await resolveWikilinks(textWikilinks, tenantId);
      resolved.forEach((link) => allTargetPageIds.add(link.pageId));
    }
  }

  const newTargetIds = Array.from(allTargetPageIds);

  // Step 2: Fetch existing page_links for this source page
  const existingLinks = await db.pageLink.findMany({
    where: {
      source_page_id: pageId,
      tenant_id: tenantId,
    },
    select: {
      id: true,
      target_page_id: true,
    },
  });

  const existingTargetIds = new Set(existingLinks.map((l) => l.target_page_id));

  // Step 3: Compute diff
  const toAdd = newTargetIds.filter((id) => !existingTargetIds.has(id));
  const toRemove = existingLinks.filter(
    (link) => !allTargetPageIds.has(link.target_page_id)
  );

  // Step 4: Apply diff — insert new links
  if (toAdd.length > 0) {
    await db.pageLink.createMany({
      data: toAdd.map((targetId) => ({
        source_page_id: pageId,
        target_page_id: targetId,
        tenant_id: tenantId,
      })),
      skipDuplicates: true,
    });
  }

  // Step 5: Apply diff — delete removed links
  if (toRemove.length > 0) {
    await db.pageLink.deleteMany({
      where: {
        id: {
          in: toRemove.map((l) => l.id),
        },
      },
    });
  }
}

/**
 * Rebuilds the entire page_links index for a specific page.
 * Useful for data repair or migration scenarios.
 *
 * Deletes all existing links for the page and re-creates them from scratch.
 *
 * @param pageId - The page to rebuild links for
 * @param tenantId - Tenant UUID
 */
export async function rebuildPageLinks(
  pageId: string,
  tenantId: string
): Promise<void> {
  // Fetch all blocks for this page
  const blocks = await prisma.block.findMany({
    where: {
      page_id: pageId,
      tenant_id: tenantId,
    },
    select: {
      content: true,
    },
  });

  const blockContents = blocks.map(
    (b) => b.content as TipTapDocument
  );

  // Delete all existing links for this page
  await prisma.pageLink.deleteMany({
    where: {
      source_page_id: pageId,
      tenant_id: tenantId,
    },
  });

  // Re-extract and create all links
  const allTargetPageIds = new Set<string>();

  for (const content of blockContents) {
    const resolvedIds = extractResolvedPageIds(content);
    resolvedIds.forEach((id) => allTargetPageIds.add(id));

    const textWikilinks = extractWikilinks(content);
    if (textWikilinks.length > 0) {
      const { resolved } = await resolveWikilinks(textWikilinks, tenantId);
      resolved.forEach((link) => allTargetPageIds.add(link.pageId));
    }
  }

  if (allTargetPageIds.size > 0) {
    await prisma.pageLink.createMany({
      data: Array.from(allTargetPageIds).map((targetId) => ({
        source_page_id: pageId,
        target_page_id: targetId,
        tenant_id: tenantId,
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * Rebuilds the page_links index for ALL pages in a tenant.
 * Useful for initial migration or data repair.
 *
 * @param tenantId - Tenant UUID
 */
export async function rebuildAllPageLinks(tenantId: string): Promise<void> {
  // Delete all existing links for this tenant
  await prisma.pageLink.deleteMany({
    where: { tenant_id: tenantId },
  });

  // Fetch all pages
  const pages = await prisma.page.findMany({
    where: { tenant_id: tenantId },
    select: { id: true },
  });

  // Rebuild links for each page
  for (const page of pages) {
    await rebuildPageLinks(page.id, tenantId);
  }
}
```

---

### Step 5: Integrate Indexer with Block Save Handler

Modify the block save API route to call the wikilink indexer after saving block content.

**File: `src/app/api/pages/[id]/blocks/route.ts` (modification)**

Add the following after the block content is saved within the transaction:

```typescript
import { updatePageLinks } from '@/lib/wikilinks/indexer';
import type { TipTapDocument } from '@/lib/wikilinks/types';

// Inside the PUT handler, after saving blocks within the transaction:

// ... existing block save logic ...

// After blocks are saved, update the wikilink index
const savedBlocks = await tx.block.findMany({
  where: {
    page_id: pageId,
    tenant_id: tenantId,
  },
  select: { content: true },
});

const blockContents = savedBlocks.map(
  (b) => b.content as TipTapDocument
);

await updatePageLinks(pageId, tenantId, blockContents, tx);
```

---

### Step 6: Integrate Resolver with Page Creation

Modify the page creation API route to resolve pending wikilinks when a new page is created.

**File: `src/app/api/pages/route.ts` (modification)**

Add the following after a new page is created:

```typescript
import { resolveUnresolvedLinksForNewPage } from '@/lib/wikilinks/resolver';

// Inside the POST handler, after the page is created:

// ... existing page creation logic ...

// Resolve any unresolved wikilinks that reference this new page
await resolveUnresolvedLinksForNewPage(
  newPage.id,
  newPage.title,
  tenantId
);
```

---

### Step 7: Export Barrel File

Create an index file for clean imports.

**File: `src/lib/wikilinks/index.ts`**

```typescript
export { extractWikilinks, extractWikilinkNodes, extractResolvedPageIds } from './parser';
export { resolveWikilinks, resolveUnresolvedLinksForNewPage } from './resolver';
export { updatePageLinks, rebuildPageLinks, rebuildAllPageLinks } from './indexer';
export type {
  ExtractedWikilink,
  ExtractedWikilinkNode,
  ResolvedWikilinks,
  TipTapNode,
  TipTapDocument,
} from './types';
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/wikilinks/parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractWikilinks, extractWikilinkNodes, extractResolvedPageIds } from '@/lib/wikilinks/parser';
import type { TipTapDocument } from '@/lib/wikilinks/types';

describe('extractWikilinks', () => {
  it('should return empty array for null input', () => {
    expect(extractWikilinks(null)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(extractWikilinks(undefined)).toEqual([]);
  });

  it('should return empty array for document with no wikilinks', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractWikilinks(doc)).toEqual([]);
  });

  it('should extract a single [[Page Name]] wikilink', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'See [[Installation Guide]] for details' }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('Installation Guide');
    expect(result[0].displayText).toBeUndefined();
  });

  it('should extract [[Page Name|Display Text]] with alias', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'See [[Installation Guide|setup docs]]' }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('Installation Guide');
    expect(result[0].displayText).toBe('setup docs');
  });

  it('should extract multiple wikilinks from a single text node', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'See [[Page A]] and [[Page B|display]] for info',
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(2);
    expect(result[0].pageName).toBe('Page A');
    expect(result[1].pageName).toBe('Page B');
    expect(result[1].displayText).toBe('display');
  });

  it('should deduplicate wikilinks to the same page (case-insensitive)', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '[[Page A]] and [[page a]] again' },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('Page A');
  });

  it('should traverse nested nodes (blockquotes, lists)', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Quote: [[Deep Page]]' }],
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
                  content: [{ type: 'text', text: '[[List Page]]' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.pageName)).toEqual(['Deep Page', 'List Page']);
  });

  it('should extract wikilink TipTap nodes', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-123',
                pageName: 'Linked Page',
                displayText: undefined,
              },
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('Linked Page');
  });

  it('should ignore empty wikilink brackets', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Empty [[]] here' }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(0);
  });

  it('should trim whitespace from page names', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '[[  Spaced Name  ]]' }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('Spaced Name');
  });
});

describe('extractWikilinkNodes', () => {
  it('should extract wikilink nodes with pageId', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-456',
                pageName: 'My Page',
                displayText: 'Custom',
              },
            },
          ],
        },
      ],
    };
    const result = extractWikilinkNodes(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pageId: 'uuid-456',
      pageName: 'My Page',
      displayText: 'Custom',
    });
  });
});

describe('extractResolvedPageIds', () => {
  it('should return unique page IDs from wikilink nodes', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: { pageId: 'id-1', pageName: 'Page 1' },
            },
            {
              type: 'wikilink',
              attrs: { pageId: 'id-2', pageName: 'Page 2' },
            },
            {
              type: 'wikilink',
              attrs: { pageId: 'id-1', pageName: 'Page 1' },
            },
          ],
        },
      ],
    };
    const result = extractResolvedPageIds(doc);
    expect(result).toHaveLength(2);
    expect(result).toContain('id-1');
    expect(result).toContain('id-2');
  });
});
```

### Integration Tests: `src/__tests__/lib/wikilinks/indexer.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { updatePageLinks, rebuildPageLinks } from '@/lib/wikilinks/indexer';
import type { TipTapDocument } from '@/lib/wikilinks/types';

// These tests require a test database with seeded data.
// Run with: TEST_DATABASE_URL=... vitest run

describe('updatePageLinks (integration)', () => {
  let tenantId: string;
  let sourcePageId: string;
  let targetPageId: string;

  beforeEach(async () => {
    // Create test tenant and pages
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant' },
    });
    tenantId = tenant.id;

    const sourcePage = await prisma.page.create({
      data: { title: 'Source Page', tenant_id: tenantId },
    });
    sourcePageId = sourcePage.id;

    const targetPage = await prisma.page.create({
      data: { title: 'Target Page', tenant_id: tenantId },
    });
    targetPageId = targetPage.id;
  });

  it('should create page_links for wikilink nodes in block content', async () => {
    const blockContent: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: targetPageId,
                pageName: 'Target Page',
              },
            },
          ],
        },
      ],
    };

    await updatePageLinks(sourcePageId, tenantId, [blockContent]);

    const links = await prisma.pageLink.findMany({
      where: {
        source_page_id: sourcePageId,
        tenant_id: tenantId,
      },
    });

    expect(links).toHaveLength(1);
    expect(links[0].target_page_id).toBe(targetPageId);
  });

  it('should remove stale links when wikilinks are removed from content', async () => {
    // First, create a link
    await prisma.pageLink.create({
      data: {
        source_page_id: sourcePageId,
        target_page_id: targetPageId,
        tenant_id: tenantId,
      },
    });

    // Then update with empty content (no wikilinks)
    const emptyContent: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'No links here' }],
        },
      ],
    };

    await updatePageLinks(sourcePageId, tenantId, [emptyContent]);

    const links = await prisma.pageLink.findMany({
      where: {
        source_page_id: sourcePageId,
        tenant_id: tenantId,
      },
    });

    expect(links).toHaveLength(0);
  });

  it('should not create duplicate links', async () => {
    const blockContent: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: { pageId: targetPageId, pageName: 'Target Page' },
            },
            {
              type: 'wikilink',
              attrs: { pageId: targetPageId, pageName: 'Target Page' },
            },
          ],
        },
      ],
    };

    await updatePageLinks(sourcePageId, tenantId, [blockContent]);

    const links = await prisma.pageLink.findMany({
      where: {
        source_page_id: sourcePageId,
        tenant_id: tenantId,
      },
    });

    expect(links).toHaveLength(1);
  });
});
```

### Manual Verification Checklist

```bash
# 1. Create two pages via API
curl -X POST /api/pages -d '{"title": "Page A"}' -H 'Content-Type: application/json'
curl -X POST /api/pages -d '{"title": "Page B"}' -H 'Content-Type: application/json'

# 2. Add a block to Page A with a wikilink to Page B
# Block content should contain [[Page B]]
# Expected: page_links row created (source=PageA, target=PageB)

# 3. Remove the wikilink from Page A
# Expected: page_links row deleted

# 4. Create a wikilink to a non-existent page, then create that page
# Expected: page_links row created when the target page is created
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/wikilinks/types.ts` |
| CREATE | `src/lib/wikilinks/parser.ts` |
| CREATE | `src/lib/wikilinks/resolver.ts` |
| CREATE | `src/lib/wikilinks/indexer.ts` |
| CREATE | `src/lib/wikilinks/index.ts` |
| MODIFY | `src/app/api/pages/[id]/blocks/route.ts` (call indexer after block save) |
| MODIFY | `src/app/api/pages/route.ts` (resolve unresolved links on page creation) |
| CREATE | `src/__tests__/lib/wikilinks/parser.test.ts` |
| CREATE | `src/__tests__/lib/wikilinks/indexer.test.ts` |

---

**Last Updated:** 2026-02-21
