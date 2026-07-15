import { prisma } from "@/lib/db";
import { notFoundError } from "./errors";
import { verifyActiveAsset } from "./tenant";
import { knowledgeToDto } from "./dto";

export interface AddKnowledgeInput {
  text: string;
  kind?: string;
}

export async function addKnowledge(
  tenantId: string,
  assetId: string,
  input: AddKnowledgeInput
) {
  return prisma.$transaction(async (tx) => {
    await verifyActiveAsset(tx, tenantId, assetId);
    const knowledge = await tx.aokKnowledge.create({
      data: {
        tenantId,
        assetId,
        kind: input.kind ?? "gotcha",
        text: input.text,
      },
    });
    return knowledgeToDto(knowledge);
  });
}

export async function deleteKnowledge(tenantId: string, id: string): Promise<void> {
  const result = await prisma.aokKnowledge.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) throw notFoundError("note");
}
