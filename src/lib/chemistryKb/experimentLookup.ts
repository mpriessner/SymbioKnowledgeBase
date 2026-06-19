/**
 * Reusable experiment page finder by ELN experiment ID.
 *
 * Lookup is keyed on the exact `Page.externalId` (the ELN experiment id) so that
 * `EXP-1` never matches `EXP-12`. A title-prefix match is kept only as a fallback
 * for legacy rows created before `externalId` was populated.
 */

import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "./setupHierarchy";

export interface ExperimentPageMatch {
  id: string;
  title: string;
  parentId: string | null;
}

const PAGE_SELECT = { id: true, title: true, parentId: true } as const;

/**
 * Build a title-prefix fallback that only matches legacy rows lacking an
 * externalId. We require the title to be exactly the ELN id or start with
 * "<elnId>:" / "<elnId> " so `EXP-1` cannot accidentally swallow `EXP-12`.
 */
function legacyTitleWhere(elnExperimentId: string) {
  return {
    externalId: null,
    OR: [
      { title: elnExperimentId },
      { title: { startsWith: `${elnExperimentId}:` } },
      { title: { startsWith: `${elnExperimentId} ` } },
    ],
  };
}

/**
 * Find an experiment page by its ELN ID (searches all pages).
 * Prefers an exact externalId match; falls back to a constrained title match
 * for legacy rows.
 */
export async function findExperimentByElnId(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const byExternalId = await prisma.page.findFirst({
    where: { tenantId, externalId: elnExperimentId },
    select: PAGE_SELECT,
  });
  if (byExternalId) return byExternalId;

  return prisma.page.findFirst({
    where: { tenantId, ...legacyTitleWhere(elnExperimentId) },
    select: PAGE_SELECT,
  });
}

/**
 * Find an experiment page that is currently active (under Experiments folder).
 */
export async function findActiveExperiment(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  const byExternalId = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.experimentsId,
      externalId: elnExperimentId,
    },
    select: PAGE_SELECT,
  });
  if (byExternalId) return byExternalId;

  return prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.experimentsId,
      ...legacyTitleWhere(elnExperimentId),
    },
    select: PAGE_SELECT,
  });
}

/**
 * Find an experiment page that is currently in the Archive folder.
 */
export async function findArchivedExperiment(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  const byExternalId = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.archiveId,
      externalId: elnExperimentId,
    },
    select: PAGE_SELECT,
  });
  if (byExternalId) return byExternalId;

  return prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.archiveId,
      ...legacyTitleWhere(elnExperimentId),
    },
    select: PAGE_SELECT,
  });
}
