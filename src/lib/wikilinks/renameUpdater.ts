import { prisma } from "@/lib/db";
import type { TipTapDocument, TipTapNode } from "./types";

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Updates wikilink pageName attributes in all source pages' blocks
 * when a target page is renamed.
 *
 * This function:
 * 1. Finds all page_links where targetPageId = renamedPageId
 * 2. For each source page, loads its blocks
 * 3. Traverses block content for wikilink nodes matching the pageId
 * 4. Updates the pageName attr (leaves displayText unchanged)
 * 5. Saves the modified block content
 */
export async function updateWikilinksOnRename(
  renamedPageId: string,
  newTitle: string,
  tenantId: string,
  tx?: TransactionClient
): Promise<{ updatedBlockCount: number }> {
  const db = tx || prisma;

  // Step 1: Find all source pages that link to the renamed page
  const incomingLinks = await db.pageLink.findMany({
    where: {
      targetPageId: renamedPageId,
      tenantId,
    },
    select: {
      sourcePageId: true,
    },
  });

  if (incomingLinks.length === 0) {
    return { updatedBlockCount: 0 };
  }

  // Deduplicate source page IDs
  const sourcePageIds = Array.from(
    new Set(incomingLinks.map((l) => l.sourcePageId))
  );

  // Step 2: Load all blocks from source pages
  const blocks = await db.block.findMany({
    where: {
      pageId: { in: sourcePageIds },
      tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  let updatedBlockCount = 0;

  // Step 3: Update wikilink nodes in each block
  for (const block of blocks) {
    const content = block.content as unknown as TipTapDocument;
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
        data: { content: JSON.parse(JSON.stringify(content)) },
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
export function updateWikilinkNodesInDocument(
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
      node.type === "wikilink" &&
      node.attrs &&
      node.attrs["pageId"] === pageId
    ) {
      // Update pageName to new title
      node.attrs["pageName"] = newPageName;
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
 */
export async function markWikilinksAsDeleted(
  deletedPageId: string,
  tenantId: string
): Promise<void> {
  const incomingLinks = await prisma.pageLink.findMany({
    where: {
      targetPageId: deletedPageId,
      tenantId,
    },
    select: {
      sourcePageId: true,
    },
  });

  const sourcePageIds = Array.from(
    new Set(incomingLinks.map((l) => l.sourcePageId))
  );

  if (sourcePageIds.length === 0) return;

  const blocks = await prisma.block.findMany({
    where: {
      pageId: { in: sourcePageIds },
      tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const content = block.content as unknown as TipTapDocument;
    if (!content || !content.content) continue;

    const wasUpdated = nullifyPageIdInNodes(content.content, deletedPageId);

    if (wasUpdated) {
      await prisma.block.update({
        where: { id: block.id },
        data: { content: JSON.parse(JSON.stringify(content)) },
      });
    }
  }

  // Clean up page_links entries pointing to the deleted page
  await prisma.pageLink.deleteMany({
    where: {
      targetPageId: deletedPageId,
      tenantId,
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
      node.type === "wikilink" &&
      node.attrs &&
      node.attrs["pageId"] === deletedPageId
    ) {
      node.attrs["pageId"] = null;
      updated = true;
    }

    if (node.content) {
      const childUpdated = nullifyPageIdInNodes(node.content, deletedPageId);
      if (childUpdated) updated = true;
    }
  }

  return updated;
}
