import type { AokDb } from "./types";
import { toNameKey } from "./normalize";
import { isUniqueConstraintError } from "./prismaErrors";

const DEFAULT_SITE_NAME = "Default Site";

/**
 * Lazily-created default site on first asset without `site_id`. Upsert on
 * the `[tenantId, nameKey]` unique key; on a concurrent-insert race (P2002)
 * refetch instead of erroring — race-safe per the story's spec.
 */
export async function ensureDefaultSite(db: AokDb, tenantId: string) {
  const nameKey = toNameKey(DEFAULT_SITE_NAME);
  try {
    return await db.aokSite.upsert({
      where: { tenantId_nameKey: { tenantId, nameKey } },
      update: {},
      create: { tenantId, name: DEFAULT_SITE_NAME, nameKey, type: "other" },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await db.aokSite.findFirst({ where: { tenantId, nameKey } });
      if (existing) return existing;
    }
    throw err;
  }
}
