import { prisma } from "@/lib/db";
import type { TipTapDocument, TipTapNode } from "@/lib/wikilinks/types";

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
    return "";
  }

  const parts: string[] = [];
  extractTextFromNodes(tiptapJson.content, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Recursively extracts text content from TipTap nodes.
 */
function extractTextFromNodes(nodes: TipTapNode[], parts: string[]): void {
  for (const node of nodes) {
    // Text nodes: direct text content
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }

    // Wikilink nodes: extract page name and display text
    if (node.type === "wikilink" && node.attrs) {
      const displayText = node.attrs["displayText"] as string | undefined;
      const pageName = node.attrs["pageName"] as string | undefined;
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
    data: { plainText },
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
      pageId,
      tenantId,
    },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const tiptapJson = block.content as unknown as TipTapDocument;
    const plainText = extractPlainText(tiptapJson);

    await prisma.block.update({
      where: { id: block.id },
      data: { plainText },
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
    where: { tenantId },
    select: {
      id: true,
      content: true,
    },
  });

  for (const block of blocks) {
    const tiptapJson = block.content as unknown as TipTapDocument;
    const plainText = extractPlainText(tiptapJson);

    await prisma.block.update({
      where: { id: block.id },
      data: { plainText },
    });
  }

  return { blocksProcessed: blocks.length };
}
