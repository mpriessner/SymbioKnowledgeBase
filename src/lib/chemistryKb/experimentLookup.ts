/**
 * Reusable experiment page finder by ELN experiment ID.
 * Searches page titles that start with the ELN ID prefix (e.g., "EXP-2025-0001").
 */

import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "./setupHierarchy";

export interface ExperimentPageMatch {
  id: string;
  title: string;
  parentId: string | null;
}

/**
 * Find an experiment page by its ELN ID (searches all pages).
 * Matches pages whose title starts with the experiment ID.
 */
export async function findExperimentByElnId(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const page = await prisma.page.findFirst({
    where: {
      tenantId,
      title: { startsWith: elnExperimentId },
    },
    select: { id: true, title: true, parentId: true },
  });

  return page;
}

/**
 * Find an experiment page that is currently active (under Experiments folder).
 */
export async function findActiveExperiment(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);
  const page = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.experimentsId,
      title: { startsWith: elnExperimentId },
    },
    select: { id: true, title: true, parentId: true },
  });

  return page;
}

/**
 * Find an experiment page that is currently in the Archive folder.
 */
export async function findArchivedExperiment(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);
  const page = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.archiveId,
      title: { startsWith: elnExperimentId },
    },
    select: { id: true, title: true, parentId: true },
  });

  return page;
}
