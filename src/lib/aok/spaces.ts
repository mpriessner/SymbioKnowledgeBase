import type { AokDb } from "./types";
import type { Prisma } from "@/generated/prisma/client";
import { toNameKey } from "./normalize";
import { isUniqueConstraintError } from "./prismaErrors";

type AokSpaceRow = Prisma.AokSpaceGetPayload<Record<string, never>>;

/**
 * Upsert-by-name space resolution (v1 spaces are flat per site — tree
 * fields exist for future hierarchy, but this always creates/finds a
 * top-level space under `siteId`). Race-safe via the `[tenantId, siteId,
 * nameKey]` unique key, matching `ensureDefaultSite`'s refetch-on-conflict
 * pattern.
 */
export async function resolveOrCreateSpace(
  db: AokDb,
  tenantId: string,
  siteId: string,
  spaceName: string
): Promise<AokSpaceRow> {
  const nameKey = toNameKey(spaceName);
  try {
    return await db.aokSpace.upsert({
      where: { tenantId_siteId_nameKey: { tenantId, siteId, nameKey } },
      update: {},
      create: { tenantId, siteId, name: spaceName, nameKey, kind: "other" },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await db.aokSpace.findFirst({
        where: { tenantId, siteId, nameKey },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * `space_path` = `[site.name, ...space names root→leaf]`. `directions_text`
 * = the nearest ancestor space's non-null `directionsText`, searching from
 * the leaf (the asset's own space) upward. V1 spaces are flat (parentId is
 * always null in practice) but this walks the `parentId` chain generically
 * so it keeps working once AOK-04 introduces real hierarchy — with a
 * visited-set guard against a corrupt/cyclic chain.
 */
export async function resolveSpacePath(
  db: AokDb,
  tenantId: string,
  siteName: string,
  space: AokSpaceRow | null
): Promise<{ spacePath: string[]; directionsText: string | null }> {
  if (!space) return { spacePath: [siteName], directionsText: null };

  const chain: AokSpaceRow[] = [];
  const visited = new Set<string>();
  let current: AokSpaceRow | null = space;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    if (!current.parentId) break;
    current = await db.aokSpace.findFirst({
      where: { id: current.parentId, tenantId },
    });
  }

  const spacePath = [siteName, ...chain.map((s) => s.name)];
  let directionsText: string | null = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].directionsText) {
      directionsText = chain[i].directionsText;
      break;
    }
  }
  return { spacePath, directionsText };
}
