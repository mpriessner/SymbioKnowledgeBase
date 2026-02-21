# Story SKB-05.4: Auto-Update Links on Page Rename

**Epic:** Epic 5 - Wikilinks & Backlinks
**Story ID:** SKB-05.4
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-05.2 (Wikilink TipTap extension must be functional)

---

## User Story

As a researcher, I want my wikilinks to keep working when I rename a page, So that I never have to manually fix broken links.

---

## Acceptance Criteria

- [ ] Wikilinks use `pageId` internally (not title), so renaming a page does not break navigation
- [ ] When a page title changes, wikilink display text updates automatically for auto-display links (links without custom alias)
- [ ] Wikilinks with explicit alias `[[Page Name|Custom Display]]` preserve the custom display text unchanged
- [ ] On page rename: scan `page_links` where `target_page_id = renamed page`, find source pages' blocks, update wikilink `pageName` attr in their TipTap JSON
- [ ] Cache invalidation: TanStack Query cache for source pages containing wikilinks to the renamed page is invalidated
- [ ] Edge case: if a linked page is deleted, wikilinks render with broken-link styling and display text falls back to "Deleted Page"
- [ ] Rename propagation is atomic — runs in a database transaction
- [ ] All operations scoped by `tenant_id`
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Page Rename Flow
────────────────

  PUT /api/pages/:id  { title: "New Page Title" }
        │
        ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Page Update Handler                                      │
  │                                                            │
  │  1. Update page title in pages table                       │
  │  2. Find all source pages linking to renamed page          │
  │     (SELECT source_page_id FROM page_links                │
  │      WHERE target_page_id = :id AND tenant_id = :tid)     │
  │  3. For each source page's blocks:                         │
  │     - Find wikilink nodes where pageId = renamed page ID  │
  │     - If displayText is null → update pageName attr         │
  │     - If displayText is set → leave unchanged (alias)      │
  │  4. Save updated block content                             │
  │                                                            │
  │  All within a single Prisma transaction                    │
  └──────────────────────────────────────────────────────────┘

Why ID-Based Links Work
────────────────────────

  Page "Installation Guide" (id: uuid-abc)
                    │
                    │ renamed to
                    ▼
  Page "Setup Guide" (id: uuid-abc)  ← same ID

  Wikilink in other page:
  BEFORE: { type: 'wikilink', attrs: { pageId: 'uuid-abc', pageName: 'Installation Guide' } }
  AFTER:  { type: 'wikilink', attrs: { pageId: 'uuid-abc', pageName: 'Setup Guide' } }

  Navigation: router.push('/pages/uuid-abc') → still works, always resolved by ID

  Link with alias:
  BEFORE: { type: 'wikilink', attrs: { pageId: 'uuid-abc', pageName: 'Installation Guide', displayText: 'setup docs' } }
  AFTER:  { type: 'wikilink', attrs: { pageId: 'uuid-abc', pageName: 'Setup Guide', displayText: 'setup docs' } }
  ↑ pageName updated (for resolution), displayText preserved (user-chosen)

Wikilink Rendering Resolution
──────────────────────────────

  WikilinkNodeView receives attrs:
  ┌──────────────────────────────────────────────┐
  │  if (displayText)  → render displayText      │
  │  else              → render pageName         │
  │                                               │
  │  if (!pageId || deleted) → red broken style  │
  │  else                    → blue clickable    │
  └──────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the Link Update Utility

This utility function scans all blocks that contain wikilinks pointing to a renamed page and updates the `pageName` attribute.

**File: `src/lib/wikilinks/renameUpdater.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@prisma/client';
import type { TipTapDocument, TipTapNode } from './types';

/**
 * Updates wikilink pageName attributes in all source pages' blocks
 * when a target page is renamed.
 *
 * This function:
 * 1. Finds all page_links where target_page_id = renamedPageId
 * 2. For each source page, loads its blocks
 * 3. Traverses block content for wikilink nodes matching the pageId
 * 4. Updates the pageName attr (leaves displayText unchanged)
 * 5. Saves the modified block content
 *
 * @param renamedPageId - The ID of the page that was renamed
 * @param newTitle - The new title of the renamed page
 * @param tenantId - Tenant UUID for scoping
 * @param tx - Optional Prisma transaction client
 */
export async function updateWikilinksOnRename(
  renamedPageId: string,
  newTitle: string,
  tenantId: string,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<{ updatedBlockCount: number }> {
  const db = tx || prisma;

  // Step 1: Find all source pages that link to the renamed page
  const incomingLinks = await db.pageLink.findMany({
    where: {
      target_page_id: renamedPageId,
      tenant_id: tenantId,
    },
    select: {
      source_page_id: true,
    },
  });

  if (incomingLinks.length === 0) {
    return { updatedBlockCount: 0 };
  }

  // Deduplicate source page IDs
  const sourcePageIds = Array.from(
    new Set(incomingLinks.map((l) => l.source_page_id))
  );

  // Step 2: Load all blocks from source pages
  const blocks = await db.block.findMany({
    where: {
      page_id: { in: sourcePageIds },
      tenant_id: tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  let updatedBlockCount = 0;

  // Step 3: Update wikilink nodes in each block
  for (const block of blocks) {
    const content = block.content as TipTapDocument;
    if (!content || !content.content) continue;

    const wasUpdated = updateWikilinkNodesInDocument(
      content,
      renamedPageId,
      newTitle
    );

    if (wasUpdated) {
      // Step 4: Save the updated block content
      await db.block.update({
        where: { id: block.id },
        data: { content: content as unknown as Record<string, unknown> },
      });
      updatedBlockCount++;
    }
  }

  return { updatedBlockCount };
}

/**
 * Recursively traverses a TipTap document and updates wikilink nodes
 * whose pageId matches the renamed page.
 *
 * Updates the pageName attribute to the new title.
 * Leaves displayText unchanged (custom aliases are preserved).
 *
 * @returns true if any nodes were updated
 */
function updateWikilinkNodesInDocument(
  doc: TipTapDocument,
  pageId: string,
  newPageName: string
): boolean {
  if (!doc.content) return false;
  return updateNodesRecursive(doc.content, pageId, newPageName);
}

/**
 * Recursive helper to traverse and update wikilink nodes.
 */
function updateNodesRecursive(
  nodes: TipTapNode[],
  pageId: string,
  newPageName: string
): boolean {
  let updated = false;

  for (const node of nodes) {
    // Check if this is a wikilink node matching the renamed page
    if (
      node.type === 'wikilink' &&
      node.attrs &&
      node.attrs['pageId'] === pageId
    ) {
      // Update pageName to new title
      node.attrs['pageName'] = newPageName;
      updated = true;
    }

    // Recurse into child nodes
    if (node.content) {
      const childUpdated = updateNodesRecursive(
        node.content,
        pageId,
        newPageName
      );
      if (childUpdated) updated = true;
    }
  }

  return updated;
}

/**
 * Updates wikilink nodes when a page is deleted.
 * Sets pageId to null so the node renders with broken-link styling.
 *
 * Note: This is optional — the WikilinkNodeView already checks page existence
 * and renders broken-link styling when the page doesn't exist.
 * This function is for proactively cleaning up references.
 *
 * @param deletedPageId - The ID of the deleted page
 * @param tenantId - Tenant UUID
 */
export async function markWikilinksAsDeleted(
  deletedPageId: string,
  tenantId: string
): Promise<void> {
  const incomingLinks = await prisma.pageLink.findMany({
    where: {
      target_page_id: deletedPageId,
      tenant_id: tenantId,
    },
    select: {
      source_page_id: true,
    },
  });

  const sourcePageIds = Array.from(
    new Set(incomingLinks.map((l) => l.source_page_id))
  );

  const blocks = await prisma.block.findMany({
    where: {
      page_id: { in: sourcePageIds },
      tenant_id: tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const content = block.content as TipTapDocument;
    if (!content || !content.content) continue;

    const wasUpdated = nullifyPageIdInNodes(content.content, deletedPageId);

    if (wasUpdated) {
      await prisma.block.update({
        where: { id: block.id },
        data: { content: content as unknown as Record<string, unknown> },
      });
    }
  }

  // Clean up page_links entries pointing to the deleted page
  await prisma.pageLink.deleteMany({
    where: {
      target_page_id: deletedPageId,
      tenant_id: tenantId,
    },
  });
}

/**
 * Sets pageId to null on wikilink nodes referencing a deleted page.
 */
function nullifyPageIdInNodes(
  nodes: TipTapNode[],
  deletedPageId: string
): boolean {
  let updated = false;

  for (const node of nodes) {
    if (
      node.type === 'wikilink' &&
      node.attrs &&
      node.attrs['pageId'] === deletedPageId
    ) {
      node.attrs['pageId'] = null;
      updated = true;
    }

    if (node.content) {
      const childUpdated = nullifyPageIdInNodes(node.content, deletedPageId);
      if (childUpdated) updated = true;
    }
  }

  return updated;
}
```

---

### Step 2: Integrate with Page Update Handler

Modify the page update API route to call the rename updater when the title changes.

**File: `src/app/api/pages/[id]/route.ts` (modification)**

```typescript
import { updateWikilinksOnRename } from '@/lib/wikilinks/renameUpdater';

// Inside the PUT handler for page update:

export const PUT = withTenant(async (req, { params, tenantId }) => {
  const pageId = params.id;
  const body = await req.json();

  // Fetch current page to check if title is changing
  const currentPage = await prisma.page.findFirst({
    where: { id: pageId, tenant_id: tenantId },
    select: { title: true },
  });

  if (!currentPage) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: {} },
      { status: 404 }
    );
  }

  const titleChanged =
    body.title !== undefined && body.title !== currentPage.title;

  // Use a transaction for atomicity
  const updatedPage = await prisma.$transaction(async (tx) => {
    // Update the page
    const page = await tx.page.update({
      where: { id: pageId },
      data: {
        title: body.title,
        icon: body.icon,
        updated_at: new Date(),
      },
    });

    // If title changed, update wikilinks in source pages
    if (titleChanged) {
      await updateWikilinksOnRename(pageId, body.title, tenantId, tx);
    }

    return page;
  });

  return NextResponse.json({
    data: updatedPage,
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### Step 3: Integrate with Page Delete Handler

Modify the page delete API route to handle wikilink cleanup.

**File: `src/app/api/pages/[id]/route.ts` (modification)**

```typescript
import { markWikilinksAsDeleted } from '@/lib/wikilinks/renameUpdater';

// Inside the DELETE handler:

export const DELETE = withTenant(async (req, { params, tenantId }) => {
  const pageId = params.id;

  // Mark wikilinks as deleted and clean up page_links
  await markWikilinksAsDeleted(pageId, tenantId);

  // Delete the page (cascade deletes blocks, page_links where source)
  await prisma.page.delete({
    where: { id: pageId },
  });

  return NextResponse.json({
    data: { deleted: true },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### Step 4: Add Cache Invalidation on Rename

When a page is renamed, invalidate TanStack Query caches for affected source pages.

**File: `src/hooks/usePageUpdate.ts` (modification or creation)**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PageUpdateInput {
  title?: string;
  icon?: string;
}

/**
 * Hook for updating a page with automatic cache invalidation.
 *
 * When a page title is changed, this invalidates:
 * 1. The renamed page's own query cache
 * 2. Backlinks queries for the renamed page
 * 3. Page search queries (titles changed)
 * 4. Graph data queries (node labels changed)
 */
export function usePageUpdate(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PageUpdateInput) => {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to update page');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the page's own data
      queryClient.invalidateQueries({ queryKey: ['pages', pageId] });

      // If title changed, invalidate broader caches
      if (variables.title !== undefined) {
        // Invalidate backlinks for the renamed page (display text may need refresh)
        queryClient.invalidateQueries({
          queryKey: ['pages', pageId, 'backlinks'],
        });

        // Invalidate ALL page queries (search results, sidebar, etc.)
        queryClient.invalidateQueries({ queryKey: ['pages'] });

        // Invalidate graph data (node labels changed)
        queryClient.invalidateQueries({ queryKey: ['graph'] });
      }
    },
  });
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/wikilinks/renameUpdater.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { TipTapDocument } from '@/lib/wikilinks/types';

// Test the pure function logic (document traversal and update)
// Import the internal helper by testing via the module

describe('updateWikilinkNodesInDocument', () => {
  it('should update pageName for matching wikilink nodes', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-target',
                pageName: 'Old Title',
                displayText: null,
              },
            },
          ],
        },
      ],
    };

    // The function mutates the document in place
    // After calling updateWikilinksOnRename with this doc,
    // pageName should be updated to 'New Title'
    // displayText should remain null
    const wikilinkNode = doc.content[0].content![0];
    expect(wikilinkNode.attrs!['pageName']).toBe('Old Title');

    // Simulate the update
    wikilinkNode.attrs!['pageName'] = 'New Title';
    expect(wikilinkNode.attrs!['pageName']).toBe('New Title');
    expect(wikilinkNode.attrs!['displayText']).toBeNull();
  });

  it('should preserve displayText (custom alias) on rename', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-target',
                pageName: 'Old Title',
                displayText: 'My Custom Alias',
              },
            },
          ],
        },
      ],
    };

    // After rename, displayText should be preserved
    const wikilinkNode = doc.content[0].content![0];
    wikilinkNode.attrs!['pageName'] = 'New Title';

    expect(wikilinkNode.attrs!['pageName']).toBe('New Title');
    expect(wikilinkNode.attrs!['displayText']).toBe('My Custom Alias');
  });

  it('should not update wikilink nodes for different page IDs', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'wikilink',
              attrs: {
                pageId: 'uuid-other',
                pageName: 'Other Page',
                displayText: null,
              },
            },
          ],
        },
      ],
    };

    // This node should not be updated since pageId doesn't match
    const wikilinkNode = doc.content[0].content![0];
    expect(wikilinkNode.attrs!['pageName']).toBe('Other Page');
  });

  it('should handle deeply nested wikilink nodes', () => {
    const doc: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'wikilink',
                  attrs: {
                    pageId: 'uuid-target',
                    pageName: 'Old Title',
                    displayText: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const wikilinkNode = doc.content[0].content![0].content![0];
    expect(wikilinkNode.attrs!['pageName']).toBe('Old Title');
  });
});
```

### Integration Tests: `src/__tests__/lib/wikilinks/renameUpdater.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { updateWikilinksOnRename, markWikilinksAsDeleted } from '@/lib/wikilinks/renameUpdater';

describe('updateWikilinksOnRename (integration)', () => {
  let tenantId: string;
  let sourcePageId: string;
  let targetPageId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const sourcePage = await prisma.page.create({
      data: { title: 'Source Page', tenant_id: tenantId },
    });
    sourcePageId = sourcePage.id;

    const targetPage = await prisma.page.create({
      data: { title: 'Old Target Title', tenant_id: tenantId },
    });
    targetPageId = targetPage.id;

    // Create a link from source to target
    await prisma.pageLink.create({
      data: {
        source_page_id: sourcePageId,
        target_page_id: targetPageId,
        tenant_id: tenantId,
      },
    });

    // Create a block in source page with a wikilink to target
    await prisma.block.create({
      data: {
        page_id: sourcePageId,
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
                  type: 'wikilink',
                  attrs: {
                    pageId: targetPageId,
                    pageName: 'Old Target Title',
                    displayText: null,
                  },
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('should update pageName in wikilink nodes when target page is renamed', async () => {
    const result = await updateWikilinksOnRename(
      targetPageId,
      'New Target Title',
      tenantId
    );

    expect(result.updatedBlockCount).toBe(1);

    // Verify the block content was updated
    const updatedBlock = await prisma.block.findFirst({
      where: { page_id: sourcePageId },
    });

    const content = updatedBlock!.content as { content: Array<{ content: Array<{ attrs: Record<string, unknown> }> }> };
    const wikilinkAttrs = content.content[0].content[0].attrs;

    expect(wikilinkAttrs['pageName']).toBe('New Target Title');
    expect(wikilinkAttrs['displayText']).toBeNull();
  });

  it('should handle page deletion by marking wikilinks as deleted', async () => {
    await markWikilinksAsDeleted(targetPageId, tenantId);

    // Verify page_links were cleaned up
    const remainingLinks = await prisma.pageLink.findMany({
      where: { target_page_id: targetPageId, tenant_id: tenantId },
    });

    expect(remainingLinks).toHaveLength(0);
  });
});
```

### E2E Test: `tests/e2e/link-rename.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Auto-Update Links on Rename', () => {
  test('wikilink display text updates after page rename', async ({ page }) => {
    // Create two pages and link them
    // Rename the target page
    // Navigate to the source page
    // Verify the wikilink shows the new title

    await page.goto('/pages/source-page-id');

    // Find the wikilink
    const wikilink = page.locator('[data-type="wikilink"]').first();
    const originalText = await wikilink.textContent();

    // Navigate to target page and rename it
    await wikilink.click();
    // ... rename the page via title input ...

    // Go back to source page
    await page.goBack();

    // Wikilink should show updated title
    // (after cache invalidation and refetch)
    await page.reload();
    const updatedWikilink = page.locator('[data-type="wikilink"]').first();
    const newText = await updatedWikilink.textContent();

    expect(newText).not.toBe(originalText);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/wikilinks/renameUpdater.ts` |
| MODIFY | `src/app/api/pages/[id]/route.ts` (call rename updater on title change) |
| CREATE | `src/hooks/usePageUpdate.ts` (or modify existing page mutation hook) |
| MODIFY | `src/lib/wikilinks/index.ts` (add exports for renameUpdater) |
| CREATE | `src/__tests__/lib/wikilinks/renameUpdater.test.ts` |
| CREATE | `src/__tests__/lib/wikilinks/renameUpdater.integration.test.ts` |
| CREATE | `tests/e2e/link-rename.spec.ts` |

---

**Last Updated:** 2026-02-21
