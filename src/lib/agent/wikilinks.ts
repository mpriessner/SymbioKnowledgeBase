/**
 * Wikilink processing for agent API writes.
 *
 * When an agent creates or updates a page with markdown containing [[wikilinks]],
 * this module extracts those links and syncs PageLink records in the database.
 */

import { prisma } from "@/lib/db";
import { extractWikilinks, extractResolvedPageIds } from "@/lib/wikilinks/parser";
import { resolveWikilinks } from "@/lib/wikilinks/resolver";
import type { TipTapDocument } from "@/lib/wikilinks/types";

/**
 * Process wikilinks after an agent creates or updates a page.
 * Extracts [[wikilinks]] from TipTap content, resolves page titles to IDs,
 * and syncs PageLink records (adds new, removes stale).
 *
 * Self-links (page linking to itself) are filtered out.
 * Duplicate wikilinks produce only one PageLink record.
 * Unresolvable wikilinks are silently ignored.
 */
export async function processAgentWikilinks(
  pageId: string,
  tenantId: string,
  tiptapContent: unknown
): Promise<void> {
  const content = tiptapContent as TipTapDocument | null | undefined;
  if (!content) return;

  try {
    // Extract all target page IDs from wikilink nodes and text-based wikilinks
    const allTargetPageIds = new Set<string>();

    // Already-resolved wikilink nodes (from UI autocomplete)
    const resolvedIds = extractResolvedPageIds(content);
    resolvedIds.forEach((id) => allTargetPageIds.add(id));

    // Text-based [[wikilinks]] that need title resolution
    const textWikilinks = extractWikilinks(content);
    if (textWikilinks.length > 0) {
      const { resolved } = await resolveWikilinks(textWikilinks, tenantId);
      resolved.forEach((link) => allTargetPageIds.add(link.pageId));
    }

    // Filter out self-links
    allTargetPageIds.delete(pageId);

    const newTargetIds = Array.from(allTargetPageIds);

    // Fetch existing PageLink records for this source page
    const existingLinks = await prisma.pageLink.findMany({
      where: { sourcePageId: pageId, tenantId },
      select: { id: true, targetPageId: true },
    });

    const existingTargetIds = new Set(existingLinks.map((l) => l.targetPageId));

    // Compute diff
    const toAdd = newTargetIds.filter((id) => !existingTargetIds.has(id));
    const toRemove = existingLinks.filter(
      (link) => !allTargetPageIds.has(link.targetPageId)
    );

    // Apply diff — insert new links
    if (toAdd.length > 0) {
      await prisma.pageLink.createMany({
        data: toAdd.map((targetId) => ({
          sourcePageId: pageId,
          targetPageId: targetId,
          tenantId,
        })),
        skipDuplicates: true,
      });
    }

    // Apply diff — delete removed links
    if (toRemove.length > 0) {
      await prisma.pageLink.deleteMany({
        where: { id: { in: toRemove.map((l) => l.id) } },
      });
    }
  } catch (error) {
    // Wikilink processing should not fail the write operation
    console.error("Wikilink processing error:", error);
  }
}
