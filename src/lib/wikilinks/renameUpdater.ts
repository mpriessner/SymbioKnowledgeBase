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
 * Best-effort re-link of incoming wikilinks when a trashed page is restored.
 *
 * At trash time `markWikilinksAsDeleted` DELETED the incoming `pageLink` rows
 * and nulled the `pageId` attr on every wikilink node that pointed at the page
 * (while KEEPING the `pageName` attr). Because the rows are gone, the
 * `pageLink.targetPageId`-driven discovery used by `updateWikilinksOnRename`
 * cannot find those sources on restore. The only remaining signal is the
 * content itself, so this does a TENANT-WIDE scan for wikilink nodes whose
 * `pageId` is null and whose `pageName` still matches the restored title, and
 * re-points them at the restored page.
 *
 * Returns the ids of source pages whose blocks changed so the caller can
 * rebuild their `pageLink` rows (kept out of this module to avoid a circular
 * import on the link indexer).
 *
 * Documented limitation: mentions whose text was edited away from the exact
 * title, or a colliding title shared by another page, are not re-linked.
 */
export async function relinkIncomingWikilinks(
  restoredPageId: string,
  title: string,
  tenantId: string
): Promise<{ relinkedBlockCount: number; affectedPageIds: string[] }> {
  const blocks = await prisma.block.findMany({
    where: { tenantId },
    select: {
      id: true,
      pageId: true,
      content: true,
    },
  });

  const affected = new Set<string>();
  let relinkedBlockCount = 0;

  for (const block of blocks) {
    const content = block.content as unknown as TipTapDocument;
    if (!content || !content.content) continue;

    const wasUpdated = relinkNodesByPageName(
      content.content,
      title,
      restoredPageId
    );

    if (wasUpdated) {
      await prisma.block.update({
        where: { id: block.id },
        data: { content: JSON.parse(JSON.stringify(content)) },
      });
      relinkedBlockCount++;
      affected.add(block.pageId);
    }
  }

  return { relinkedBlockCount, affectedPageIds: Array.from(affected) };
}

/**
 * Re-points broken (pageId null) wikilink nodes whose pageName matches the
 * restored title back at the restored page id.
 */
function relinkNodesByPageName(
  nodes: TipTapNode[],
  title: string,
  restoredPageId: string
): boolean {
  let updated = false;

  for (const node of nodes) {
    if (
      node.type === "wikilink" &&
      node.attrs &&
      node.attrs["pageId"] == null &&
      node.attrs["pageName"] === title
    ) {
      node.attrs["pageId"] = restoredPageId;
      updated = true;
    }

    if (node.content) {
      const childUpdated = relinkNodesByPageName(
        node.content,
        title,
        restoredPageId
      );
      if (childUpdated) updated = true;
    }
  }

  return updated;
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
