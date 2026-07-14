import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { notFoundError } from "./errors";
import { verifyActiveAsset } from "./tenant";
import { buildAssetCard, type AssetCard } from "./assets";
import { anchorToDto } from "./dto";

export interface MintAnchorInput {
  asset_id?: string;
  type?: string;
}

/**
 * Race-free anchor minting: the id (and its derived payload) are generated
 * service-side and persisted in a single insert — no create-then-update, no
 * separate "reserve the payload" step. Omitted `asset_id` mints an unbound
 * blank sticker for pre-printed rolls.
 */
export async function mintAnchor(tenantId: string, input: MintAnchorInput) {
  return prisma.$transaction(async (tx) => {
    if (input.asset_id) {
      // Anchor mint against a non-active asset is a rejected child write.
      await verifyActiveAsset(tx, tenantId, input.asset_id);
    }

    const id = randomUUID();
    const payload = `scs://a/${id}`;

    const anchor = await tx.aokAnchor.create({
      data: {
        id,
        tenantId,
        assetId: input.asset_id ?? null,
        type: input.type ?? "qr",
        payload,
        status: "active",
      },
    });

    return anchorToDto(anchor);
  });
}

/** Rebinding an already-bound anchor is allowed (rebind = spec-pack lifecycle). */
export async function bindAnchor(tenantId: string, anchorId: string, assetId: string) {
  return prisma.$transaction(async (tx) => {
    const anchor = await tx.aokAnchor.findFirst({ where: { id: anchorId, tenantId } });
    if (!anchor) throw notFoundError("code");

    // Throws retiredAssetError (409) if the asset exists but is not active,
    // or notFoundError (404) if it doesn't belong to this tenant at all.
    await verifyActiveAsset(tx, tenantId, assetId);

    const result = await tx.aokAnchor.updateMany({
      where: { id: anchorId, tenantId },
      data: { assetId },
    });
    if (result.count === 0) throw notFoundError("code");

    const updated = await tx.aokAnchor.findFirst({ where: { id: anchorId, tenantId } });
    if (!updated) throw notFoundError("code");
    return anchorToDto(updated);
  });
}

export type ResolveResult =
  | { ok: true; bound: false; anchor_id: string }
  | ({ ok: true; bound: true; anchor_id: string } & AssetCard)
  | { ok: false; error: string; status: number };

/**
 * GET /anchors/resolve — the one route with an intentionally asymmetric
 * status contract: unknown payload is a real 404, but a retired target is a
 * 200 with `ok:false` (the anchor itself resolved fine; the *asset* it points
 * to is unavailable). Queries `{ payload, tenantId }` per the tenant-safety
 * rules — never trust a bare payload lookup across tenants.
 */
export async function resolveAnchor(tenantId: string, payload: string): Promise<ResolveResult> {
  return prisma.$transaction(async (tx) => {
    const anchor = await tx.aokAnchor.findFirst({ where: { payload, tenantId } });
    if (!anchor) {
      return { ok: false, error: "This code is not bound to any object.", status: 404 };
    }

    if (!anchor.assetId) {
      return { ok: true, bound: false, anchor_id: anchor.id };
    }

    const asset = await tx.aokAsset.findFirst({ where: { id: anchor.assetId, tenantId } });
    if (!asset || asset.status !== "active") {
      return { ok: false, error: "This object was retired.", status: 200 };
    }

    const card = await buildAssetCard(tx, tenantId, asset);
    return { ok: true, bound: true, anchor_id: anchor.id, ...card };
  });
}
