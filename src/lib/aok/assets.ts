import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { AokDb } from "./types";
import { notFoundError } from "./errors";
import { verifySite } from "./tenant";
import { ensureDefaultSite } from "./sites";
import { resolveOrCreateSpace, resolveSpacePath } from "./spaces";
import { knowledgeToCardDto, visitToCardDto, anchorToCardDto } from "./dto";

type AokAssetRow = Prisma.AokAssetGetPayload<Record<string, never>>;
type AokSpaceRow = Prisma.AokSpaceGetPayload<Record<string, never>>;

export interface AssetDto {
  id: string;
  name: string;
  category: string;
  class: string;
  criticality: string;
  status: string;
  attributes: Record<string, unknown>;
  site_id: string;
  space_id: string | null;
  space_path: string[];
  directions_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCard {
  asset: AssetDto;
  knowledge: ReturnType<typeof knowledgeToCardDto>[];
  last_visits: ReturnType<typeof visitToCardDto>[];
  anchors: ReturnType<typeof anchorToCardDto>[];
}

export interface CreateAssetInput {
  name: string;
  category: string;
  class?: string;
  criticality?: string;
  space_name?: string;
  site_id?: string;
  attributes?: Record<string, unknown>;
}

export interface PatchAssetInput {
  status?: string;
  name?: string;
  category?: string;
  attributes?: Record<string, unknown>;
  space_name?: string;
}

async function toAssetDto(
  db: AokDb,
  tenantId: string,
  asset: AokAssetRow,
  siteName?: string,
  space?: AokSpaceRow | null
): Promise<AssetDto> {
  const resolvedSiteName =
    siteName ?? (await db.aokSite.findFirst({ where: { id: asset.siteId } }))?.name ?? "";
  const resolvedSpace =
    space !== undefined
      ? space
      : asset.spaceId
        ? await db.aokSpace.findFirst({ where: { id: asset.spaceId } })
        : null;
  const { spacePath, directionsText } = await resolveSpacePath(
    db,
    tenantId,
    resolvedSiteName,
    resolvedSpace
  );

  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    class: asset.class,
    criticality: asset.criticality,
    status: asset.status,
    attributes: (asset.attributes ?? {}) as Record<string, unknown>,
    site_id: asset.siteId,
    space_id: asset.spaceId,
    space_path: spacePath,
    directions_text: directionsText,
    created_at: asset.createdAt.toISOString(),
    updated_at: asset.updatedAt.toISOString(),
  };
}

export async function createAsset(
  tenantId: string,
  input: CreateAssetInput
): Promise<AssetDto> {
  return prisma.$transaction(async (tx) => {
    const site = input.site_id
      ? await verifySite(tx, tenantId, input.site_id)
      : await ensureDefaultSite(tx, tenantId);

    const space = input.space_name
      ? await resolveOrCreateSpace(tx, tenantId, site.id, input.space_name)
      : null;

    const asset = await tx.aokAsset.create({
      data: {
        tenantId,
        siteId: site.id,
        spaceId: space?.id ?? null,
        class: input.class ?? "facility_asset",
        name: input.name,
        category: input.category,
        criticality: input.criticality ?? "low",
        attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
        status: "active",
      },
    });

    return toAssetDto(tx, tenantId, asset, site.name, space);
  });
}

/** Core card-assembly logic, reused by both `getAssetCard` (by id) and anchor resolve (asset already fetched). */
export async function buildAssetCard(
  db: AokDb,
  tenantId: string,
  asset: AokAssetRow
): Promise<AssetCard> {
  const [knowledgeRows, visitRows, anchorRows] = await Promise.all([
    db.aokKnowledge.findMany({
      where: { assetId: asset.id, tenantId, reviewStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.aokVisit.findMany({
      where: { assetId: asset.id, tenantId },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.aokAnchor.findMany({ where: { assetId: asset.id, tenantId } }),
  ]);

  const assetDto = await toAssetDto(db, tenantId, asset);

  return {
    asset: assetDto,
    knowledge: knowledgeRows.map(knowledgeToCardDto),
    last_visits: visitRows.map(visitToCardDto),
    anchors: anchorRows.map(anchorToCardDto),
  };
}

export async function getAssetCard(
  tenantId: string,
  assetId: string
): Promise<AssetCard> {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.aokAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw notFoundError("object");
    return buildAssetCard(tx, tenantId, asset);
  });
}

export async function patchAsset(
  tenantId: string,
  assetId: string,
  input: PatchAssetInput
): Promise<AssetDto> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aokAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!existing) throw notFoundError("object");

    let spaceId = existing.spaceId;
    if (input.space_name !== undefined) {
      const space = await resolveOrCreateSpace(tx, tenantId, existing.siteId, input.space_name);
      spaceId = space.id;
    }

    // `attributes` is a shallow merge onto the existing JSON, not a replace.
    const mergedAttributes = input.attributes
      ? { ...((existing.attributes ?? {}) as Record<string, unknown>), ...input.attributes }
      : undefined;

    // Unchecked variant: the FK scalar (spaceId) is only exposed directly
    // here — the "checked" mutation-input type expects a nested
    // `space: {connect:...}` instead of the raw scalar.
    const data: Prisma.AokAssetUncheckedUpdateManyInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (mergedAttributes !== undefined) data.attributes = mergedAttributes as Prisma.InputJsonValue;
    if (input.space_name !== undefined) data.spaceId = spaceId;

    // Tenant-safety rule 1: never a bare update({where:{id}}) after a
    // separate read — the final write is always predicated on {id, tenantId}.
    const result = await tx.aokAsset.updateMany({
      where: { id: assetId, tenantId },
      data,
    });
    if (result.count === 0) throw notFoundError("object");

    const updated = await tx.aokAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!updated) throw notFoundError("object");
    return toAssetDto(tx, tenantId, updated);
  });
}
