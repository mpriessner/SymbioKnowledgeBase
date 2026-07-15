import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeText, tokenize } from "./normalize";
import { resolveSpacePath } from "./spaces";
import type { AssetDto } from "./assets";

type AokAssetRow = Prisma.AokAssetGetPayload<Record<string, never>>;

export interface SearchResultItem {
  asset: AssetDto;
  space_path: string[];
  directions_text: string | null;
}

const EXACT_RANK = 0;
const PREFIX_RANK = 1;
const ALL_TOKENS_RANK = 2;

/**
 * Kept fully separate from `depthSearch`/`ragSearch`/`/api/agent/search`
 * (their response shapes are pinned by existing tests). `AokKnowledge` does
 * NOT appear in generic kb-query/PageLink traversal in v1 — documented.
 *
 * Normalizes both stored text and the query (Codex-critical), requires every
 * query token to match `name + category`, ranks normalized-exact > prefix >
 * all-tokens-contained, excludes non-active assets. Ranks first against the
 * lean row set, then hydrates site/space only for the winners, preserving
 * rank order.
 */
export async function searchAssets(
  tenantId: string,
  query: string,
  opts: { siteId?: string; limit: number }
): Promise<SearchResultItem[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const normalizedQuery = normalizeText(query);

  const candidates = await prisma.aokAsset.findMany({
    where: {
      tenantId,
      status: "active",
      ...(opts.siteId ? { siteId: opts.siteId } : {}),
    },
  });

  const ranked = candidates
    .map((asset) => {
      const haystack = normalizeText(`${asset.name} ${asset.category}`);
      if (!tokens.every((t) => haystack.includes(t))) return null;

      const nameNormalized = normalizeText(asset.name);
      let rank: number = ALL_TOKENS_RANK;
      if (nameNormalized === normalizedQuery) rank = EXACT_RANK;
      else if (nameNormalized.startsWith(normalizedQuery)) rank = PREFIX_RANK;

      return { asset, rank };
    })
    .filter((row): row is { asset: AokAssetRow; rank: number } => row !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, opts.limit);

  const results: SearchResultItem[] = [];
  for (const { asset } of ranked) {
    const site = await prisma.aokSite.findFirst({ where: { id: asset.siteId, tenantId } });
    const space = asset.spaceId
      ? await prisma.aokSpace.findFirst({ where: { id: asset.spaceId, tenantId } })
      : null;
    const { spacePath, directionsText } = await resolveSpacePath(
      prisma,
      tenantId,
      site?.name ?? "",
      space
    );

    results.push({
      asset: {
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
      },
      space_path: spacePath,
      directions_text: directionsText,
    });
  }

  return results;
}
