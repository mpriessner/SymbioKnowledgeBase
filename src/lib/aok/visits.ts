import { prisma } from "@/lib/db";
import { notFoundError } from "./errors";
import { verifyActiveAsset } from "./tenant";
import { visitToDto } from "./dto";

export interface AddVisitInput {
  reason: string;
  outcome: string;
  notes?: string;
}

export async function addVisit(tenantId: string, assetId: string, input: AddVisitInput) {
  return prisma.$transaction(async (tx) => {
    await verifyActiveAsset(tx, tenantId, assetId);
    const visit = await tx.aokVisit.create({
      data: {
        tenantId,
        assetId,
        reason: input.reason,
        outcome: input.outcome,
        notes: input.notes ?? null,
      },
    });
    return visitToDto(visit);
  });
}

export async function deleteVisit(tenantId: string, id: string): Promise<void> {
  const result = await prisma.aokVisit.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) throw notFoundError("visit");
}
