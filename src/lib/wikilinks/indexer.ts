import { prisma } from "@/lib/db";
import { extractWikilinks, extractResolvedPageIds } from "./parser";
import { resolveWikilinks } from "./resolver";
import type { TipTapDocument } from "./types";

/**
 * Updates the page_links index for a given page based on its current block content.
 *
 * Uses a diff-based approach: inserts new links, deletes removed links.
 *
 * @param pageId - The source page ID whose links are being updated
 * @param tenantId - Tenant UUID for scoping
 * @param blockContents - Array of TipTap JSON documents from the page's blocks
 * @param tx - Optional Prisma transaction client
 */
export async function updatePageLinks(
  pageId: string,
  tenantId: string,
  blockContents: TipTapDocument[],
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
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
      sourcePageId: pageId,
      tenantId,
    },
    select: {
      id: true,
      targetPageId: true,
    },
  });

  const existingTargetIds = new Set(existingLinks.map((l) => l.targetPageId));

  // Step 3: Compute diff
  const toAdd = newTargetIds.filter((id) => !existingTargetIds.has(id));
  const toRemove = existingLinks.filter(
    (link) => !allTargetPageIds.has(link.targetPageId)
  );

  // Step 4: Apply diff — insert new links
  if (toAdd.length > 0) {
    await db.pageLink.createMany({
      data: toAdd.map((targetId) => ({
        sourcePageId: pageId,
        targetPageId: targetId,
        tenantId,
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
 */
export async function rebuildPageLinks(
  pageId: string,
  tenantId: string
): Promise<void> {
  const blocks = await prisma.block.findMany({
    where: {
      pageId,
      tenantId,
    },
    select: {
      content: true,
    },
  });

  const blockContents = blocks.map((b) => b.content as TipTapDocument);

  // Delete all existing links for this page
  await prisma.pageLink.deleteMany({
    where: {
      sourcePageId: pageId,
      tenantId,
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
        sourcePageId: pageId,
        targetPageId: targetId,
        tenantId,
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * Rebuilds the page_links index for ALL pages in a tenant.
 */
export async function rebuildAllPageLinks(tenantId: string): Promise<void> {
  await prisma.pageLink.deleteMany({
    where: { tenantId },
  });

  const pages = await prisma.page.findMany({
    where: { tenantId },
    select: { id: true },
  });

  for (const page of pages) {
    await rebuildPageLinks(page.id, tenantId);
  }
}
