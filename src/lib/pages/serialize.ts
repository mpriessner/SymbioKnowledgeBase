import type { Page, SpaceType } from "@/types/page";

/**
 * Serializes a Prisma Page record to the API response format.
 * Converts Date objects to ISO strings.
 */
export function serializePage(page: {
  id: string;
  tenantId: string;
  parentId: string | null;
  teamspaceId?: string | null;
  spaceType?: string;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  position: number;
  oneLiner?: string | null;
  summary?: string | null;
  summaryUpdatedAt?: Date | null;
  lastAgentVisitAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Page {
  return {
    id: page.id,
    tenantId: page.tenantId,
    parentId: page.parentId,
    teamspaceId: page.teamspaceId ?? null,
    spaceType: (page.spaceType as SpaceType) ?? "PRIVATE",
    title: page.title,
    icon: page.icon,
    coverUrl: page.coverUrl,
    position: page.position,
    oneLiner: page.oneLiner ?? null,
    summary: page.summary ?? null,
    summaryUpdatedAt: page.summaryUpdatedAt?.toISOString() ?? null,
    lastAgentVisitAt: page.lastAgentVisitAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}
