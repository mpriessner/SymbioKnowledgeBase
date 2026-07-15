/**
 * Transactional tenant-relationship verification (Codex-critical).
 *
 * Every supplied relationship ID (site_id/space_id/asset_id/parent_id/
 * replaced_by/anchor asset_id) must be verified to belong to the caller's
 * tenant inside the same transaction as the write. Tenant filtering alone on
 * the *owning* row is not enough — every foreign-keyed id supplied by the
 * caller has to be re-checked here, or a caller could attach their write to
 * another tenant's row by guessing/enumerating its id.
 */
import type { AokDb } from "./types";
import { notFoundError, retiredAssetError } from "./errors";

export async function verifySite(db: AokDb, tenantId: string, siteId: string) {
  const site = await db.aokSite.findFirst({ where: { id: siteId, tenantId } });
  if (!site) throw notFoundError("site");
  return site;
}

export async function verifySpace(db: AokDb, tenantId: string, spaceId: string) {
  const space = await db.aokSpace.findFirst({ where: { id: spaceId, tenantId } });
  if (!space) throw notFoundError("space");
  return space;
}

export async function verifyAsset(db: AokDb, tenantId: string, assetId: string) {
  const asset = await db.aokAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw notFoundError("object");
  return asset;
}

/**
 * Verify an asset belongs to the tenant AND is currently active. Used to
 * reject child writes (knowledge/count/visit/anchor mint or bind) against a
 * retired/replaced/deleted asset.
 */
export async function verifyActiveAsset(
  db: AokDb,
  tenantId: string,
  assetId: string
) {
  const asset = await verifyAsset(db, tenantId, assetId);
  if (asset.status !== "active") throw retiredAssetError();
  return asset;
}
