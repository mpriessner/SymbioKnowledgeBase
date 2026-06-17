/**
 * Shared category detection utilities for the Chemistry KB search.
 */

import { prisma } from "@/lib/db";

const CATEGORY_TITLES = new Set([
  "Experiments",
  "Chemicals",
  "Reaction Types",
  "Researchers",
  "Substrate Classes",
]);

/**
 * Determine a page's category from its parent page title.
 * Walks up the hierarchy until a known category is found.
 */
export async function getPageCategory(
  pageId: string,
  parentId: string | null,
  tenantId: string,
  categoryCache: Map<string, string | null>
): Promise<string | null> {
  if (!parentId) return null;
  if (categoryCache.has(parentId)) return categoryCache.get(parentId)!;

  const parent = await prisma.page.findFirst({
    where: { id: parentId, tenantId },
    select: { title: true, parentId: true },
  });

  if (!parent) {
    categoryCache.set(parentId, null);
    return null;
  }

  if (CATEGORY_TITLES.has(parent.title)) {
    const cat = parent.title.toLowerCase().replace(/\s+/g, "_");
    categoryCache.set(parentId, cat);
    return cat;
  }

  // Recurse up if needed (grandchild of category)
  const parentCategory = await getPageCategory(
    parentId,
    parent.parentId,
    tenantId,
    categoryCache
  );
  categoryCache.set(parentId, parentCategory);
  return parentCategory;
}

/**
 * Normalize a category string to its canonical form.
 */
const CATEGORY_MAP: Record<string, string> = {
  experiments: "experiments",
  chemicals: "chemicals",
  reactiontypes: "reaction_types",
  reaction_types: "reaction_types",
  researchers: "researchers",
  substrateclasses: "substrate_classes",
  substrate_classes: "substrate_classes",
};

export function normalizeCategory(category: string): string {
  return CATEGORY_MAP[category.toLowerCase()] ?? category.toLowerCase();
}

/**
 * Get category page IDs for a tenant.
 */
export async function getCategoryPageIds(
  tenantId: string
): Promise<Map<string, string>> {
  const catPages = await prisma.page.findMany({
    where: {
      tenantId,
      title: { in: [...CATEGORY_TITLES] },
    },
    select: { id: true, title: true },
  });

  const map = new Map<string, string>();
  for (const p of catPages) {
    map.set(p.title, p.id);
  }
  return map;
}
