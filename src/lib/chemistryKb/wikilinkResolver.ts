import { prisma } from "@/lib/db";

export interface ChemistryWikilinkResult {
  pageId: string;
  pageTitle: string;
  matchType: "exact" | "synonym";
}

/**
 * Resolves a chemistry wikilink using a two-step process:
 *   1. Exact title match (case-insensitive) via the pages table
 *   2. Synonym match — searches frontmatter `common_synonyms` across all blocks
 *
 * Returns null if no match is found.
 */
export async function resolveChemistryWikilink(
  linkText: string,
  tenantId: string
): Promise<ChemistryWikilinkResult | null> {
  if (!linkText || linkText.trim().length === 0) {
    return null;
  }

  const normalizedText = linkText.trim();

  // Step 1: Exact title match (case-insensitive)
  const exactMatch = await prisma.page.findFirst({
    where: {
      tenantId,
      title: {
        equals: normalizedText,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (exactMatch) {
    return {
      pageId: exactMatch.id,
      pageTitle: exactMatch.title,
      matchType: "exact",
    };
  }

  // Step 2: Synonym match — look for pages whose frontmatter block
  // contains common_synonyms with the link text.
  // Frontmatter is stored in the first block (position 0) of type FRONTMATTER
  // or as a JSON content field. We search blocks for the synonym text
  // and then verify against the structured frontmatter.
  const blocksWithSynonym = await prisma.block.findMany({
    where: {
      tenantId,
      content: {
        path: ["common_synonyms"],
        array_contains: [normalizedText],
      },
    },
    select: {
      pageId: true,
      content: true,
    },
  });

  if (blocksWithSynonym.length > 0) {
    // Return the first match. If multiple pages claim the same synonym,
    // this is a data quality issue that should be flagged separately.
    const page = await prisma.page.findUnique({
      where: { id: blocksWithSynonym[0].pageId },
      select: { id: true, title: true },
    });

    if (page) {
      return {
        pageId: page.id,
        pageTitle: page.title,
        matchType: "synonym",
      };
    }
  }

  // Step 2b: Case-insensitive synonym match fallback.
  // array_contains is case-sensitive in Postgres JSON, so we do a text search
  // and then verify programmatically.
  const candidateBlocks = await prisma.block.findMany({
    where: {
      tenantId,
      content: {
        path: ["common_synonyms"],
        not: { equals: undefined },
      },
    },
    select: {
      pageId: true,
      content: true,
    },
  });

  const lowerText = normalizedText.toLowerCase();

  for (const block of candidateBlocks) {
    const content = block.content as Record<string, unknown> | null;
    if (!content) continue;

    const synonyms = content["common_synonyms"];
    if (!Array.isArray(synonyms)) continue;

    const match = synonyms.some(
      (s: unknown) => typeof s === "string" && s.toLowerCase() === lowerText
    );

    if (match) {
      const page = await prisma.page.findUnique({
        where: { id: block.pageId },
        select: { id: true, title: true },
      });

      if (page) {
        return {
          pageId: page.id,
          pageTitle: page.title,
          matchType: "synonym",
        };
      }
    }
  }

  // Step 3: No match
  return null;
}
