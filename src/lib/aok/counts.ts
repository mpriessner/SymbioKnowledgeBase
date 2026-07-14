import { prisma } from "@/lib/db";
import { notFoundError } from "./errors";
import { verifyActiveAsset } from "./tenant";
import { countLineToDto } from "./dto";

export interface AddCountInput {
  qty: number;
  unit?: string;
}

function extractExpectedQty(attributes: unknown): number | null {
  if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
    const value = (attributes as Record<string, unknown>).expected_qty;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export async function addCount(tenantId: string, assetId: string, input: AddCountInput) {
  return prisma.$transaction(async (tx) => {
    const asset = await verifyActiveAsset(tx, tenantId, assetId);
    // Snapshot expected_qty from attributes at count time; nulls otherwise.
    const expectedQty = extractExpectedQty(asset.attributes);
    const delta = expectedQty !== null ? input.qty - expectedQty : null;

    const countLine = await tx.aokCountLine.create({
      data: {
        tenantId,
        assetId,
        countedQty: input.qty,
        unit: input.unit ?? null,
        expectedQty,
        delta,
      },
    });

    return countLineToDto(countLine);
  });
}

export async function deleteCountLine(tenantId: string, id: string): Promise<void> {
  const result = await prisma.aokCountLine.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) throw notFoundError("count");
}
