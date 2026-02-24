import { prisma } from "@/lib/db";

/**
 * Generate a unique "Untitled" page title for a tenant.
 * 
 * If no existing "Untitled" pages exist, returns "Untitled".
 * Otherwise, finds the next available number: "Untitled 2", "Untitled 3", etc.
 * 
 * Note: Treats bare "Untitled" as equivalent to "Untitled 1" for gap-filling purposes.
 */
export async function generateUniqueUntitledTitle(
  tenantId: string
): Promise<string> {
  // Find existing "Untitled" and "Untitled N" pages for this tenant
  const existingUntitled = await prisma.page.findMany({
    where: {
      tenantId,
      OR: [
        { title: "Untitled" },
        { title: { startsWith: "Untitled " } },
      ],
    },
    select: { title: true },
  });

  return computeNextUntitledTitle(existingUntitled.map((p) => p.title));
}

/**
 * Pure function to compute the next unique "Untitled" title.
 * Exported for testing purposes.
 */
export function computeNextUntitledTitle(existingTitles: string[]): string {
  if (existingTitles.length === 0) {
    return "Untitled";
  }

  const usedNumbers = new Set<number>();

  for (const title of existingTitles) {
    if (title === "Untitled") {
      usedNumbers.add(1); // Treat bare "Untitled" as using slot 1
    } else {
      const match = title.match(/^Untitled (\d+)$/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
  }

  // Find the next available number starting from 1
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  // First page is "Untitled", subsequent are "Untitled 2", "Untitled 3", etc.
  return nextNumber === 1 ? "Untitled" : `Untitled ${nextNumber}`;
}
