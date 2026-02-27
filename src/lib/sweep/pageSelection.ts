import { prisma } from "@/lib/db";

export interface SelectedPage {
  id: string;
  title: string;
  updatedAt: Date;
  summaryUpdatedAt: Date | null;
  lastAgentVisitAt: Date | null;
  oneLiner: string | null;
  summary: string | null;
}

const SELECT_FIELDS = {
  id: true,
  title: true,
  updatedAt: true,
  summaryUpdatedAt: true,
  lastAgentVisitAt: true,
  oneLiner: true,
  summary: true,
} as const;

/**
 * Selects pages to process in priority order:
 *  1. Stale summaries (no summary, or content updated after summary)
 *  2. Never visited by sweep agent
 *  3. Least recently visited
 */
export async function selectPagesForSweep(
  budget: number,
  tenantId: string
): Promise<SelectedPage[]> {
  const selected: SelectedPage[] = [];
  let remaining = budget;

  // Priority 1a: Pages with no summary at all
  const noSummary = await prisma.page.findMany({
    where: { tenantId, summaryUpdatedAt: null },
    select: SELECT_FIELDS,
    orderBy: { updatedAt: "desc" },
    take: remaining,
  });
  selected.push(...noSummary);
  remaining -= noSummary.length;

  if (remaining <= 0) return selected;

  // Priority 1b: Stale summaries (content updated after summary)
  // Use raw SQL for cross-column comparison
  const staleRows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      updated_at: Date;
      summary_updated_at: Date | null;
      last_agent_visit_at: Date | null;
      one_liner: string | null;
      summary: string | null;
    }>
  >(
    `SELECT id, title, updated_at, summary_updated_at, last_agent_visit_at, one_liner, summary
     FROM pages
     WHERE tenant_id = $1
       AND summary_updated_at IS NOT NULL
       AND updated_at > summary_updated_at
     ORDER BY updated_at DESC
     LIMIT $2`,
    tenantId,
    remaining
  );

  const stale: SelectedPage[] = staleRows
    .filter((r) => !selected.some((s) => s.id === r.id))
    .map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updated_at,
      summaryUpdatedAt: r.summary_updated_at,
      lastAgentVisitAt: r.last_agent_visit_at,
      oneLiner: r.one_liner,
      summary: r.summary,
    }));

  selected.push(...stale);
  remaining -= stale.length;

  if (remaining <= 0) return selected;

  const excludeIds = selected.map((p) => p.id);

  // Priority 2: Never visited by sweep agent
  const neverVisited = await prisma.page.findMany({
    where: {
      tenantId,
      lastAgentVisitAt: null,
      id: { notIn: excludeIds },
    },
    select: SELECT_FIELDS,
    take: remaining,
  });
  selected.push(...neverVisited);
  remaining -= neverVisited.length;

  if (remaining <= 0) return selected;

  const excludeIds2 = selected.map((p) => p.id);

  // Priority 3: Least recently visited
  const leastRecent = await prisma.page.findMany({
    where: {
      tenantId,
      id: { notIn: excludeIds2 },
    },
    select: SELECT_FIELDS,
    orderBy: { lastAgentVisitAt: "asc" },
    take: remaining,
  });
  selected.push(...leastRecent);

  return selected;
}
