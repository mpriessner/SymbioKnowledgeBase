import { prisma } from "@/lib/db";
import type { ExtractedWikilink, ResolvedWikilinks } from "./types";

/**
 * Resolves an array of extracted wikilinks against the pages table.
 * Looks up pages by title within the specified tenant.
 */
export async function resolveWikilinks(
  links: ExtractedWikilink[],
  tenantId: string
): Promise<ResolvedWikilinks> {
  if (links.length === 0) {
    return { resolved: [], unresolved: [] };
  }

  // Single query to find all matching pages by title within tenant.
  // Note: mode "insensitive" is intentionally omitted because it does not
  // work with the `in` filter on the Prisma pg adapter. Case-insensitive
  // matching is handled in the JavaScript lookup map below instead.
  const matchingPages = await prisma.page.findMany({
    where: {
      tenantId,
      title: {
        in: links.map((l) => l.pageName),
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

  // Partition links into resolved and unresolved (first pass: exact match)
  const resolved: ResolvedWikilinks["resolved"] = [];
  const stillUnresolved: ExtractedWikilink[] = [];
  const resolvedNames = new Set<string>();

  for (const link of links) {
    const key = link.pageName.toLowerCase();

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
      stillUnresolved.push(link);
    }
  }

  // Second pass: try startsWith match for remaining unresolved links
  // (handles cases like [[EXP-2026-0042]] matching "EXP-2026-0042: Suzuki Coupling...")
  const unresolved: ResolvedWikilinks["unresolved"] = [];
  if (stillUnresolved.length > 0) {
    const startsWithResults = await Promise.all(
      stillUnresolved.map((link) =>
        prisma.page.findFirst({
          where: {
            tenantId,
            title: { startsWith: link.pageName },
          },
          select: { id: true, title: true },
        }).then((page) => ({ link, page }))
      )
    );

    for (const { link, page } of startsWithResults) {
      if (page) {
        resolved.push({
          pageName: link.pageName,
          pageId: page.id,
          displayText: link.displayText,
        });
      } else {
        unresolved.push({
          pageName: link.pageName,
          displayText: link.displayText,
        });
      }
    }
  }

  return { resolved, unresolved };
}

/**
 * When a new page is created, checks for blocks containing unresolved
 * wikilinks that reference the new page's title. If found, creates the
 * corresponding page_links rows.
 */
export async function resolveUnresolvedLinksForNewPage(
  newPageId: string,
  newPageTitle: string,
  tenantId: string
): Promise<void> {
  // Find all blocks in this tenant that contain text matching the new page title
  const blocksWithPotentialLinks = await prisma.block.findMany({
    where: {
      tenantId,
      content: {
        path: [],
        string_contains: newPageTitle,
      },
    },
    select: {
      id: true,
      pageId: true,
      content: true,
    },
  });

  if (blocksWithPotentialLinks.length === 0) {
    return;
  }

  // For each block, re-extract wikilinks and check if any match the new page
  const { extractWikilinks } = await import("./parser");
  const linksToCreate: Array<{ sourcePageId: string }> = [];
  const seenSourcePages = new Set<string>();

  for (const block of blocksWithPotentialLinks) {
    const extracted = extractWikilinks(
      block.content as unknown as import("./types").TipTapDocument
    );
    const matchingLink = extracted.find(
      (link) => link.pageName.toLowerCase() === newPageTitle.toLowerCase()
    );

    if (matchingLink && !seenSourcePages.has(block.pageId)) {
      seenSourcePages.add(block.pageId);
      linksToCreate.push({ sourcePageId: block.pageId });
    }
  }

  // Batch create page_links rows
  if (linksToCreate.length > 0) {
    await prisma.pageLink.createMany({
      data: linksToCreate.map((link) => ({
        sourcePageId: link.sourcePageId,
        targetPageId: newPageId,
        tenantId,
      })),
      skipDuplicates: true,
    });
  }
}
