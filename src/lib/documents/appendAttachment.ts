import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { extractPlainText } from "@/lib/search/indexer";
import type { TipTapDocument, TipTapNode } from "@/lib/wikilinks/types";

interface DocumentAttachment {
  attachmentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** Add a visible, downloadable attachment card to a document page body. */
export async function appendDocumentAttachment(
  tenantId: string,
  pageId: string,
  attachment: DocumentAttachment
): Promise<void> {
  const block = await prisma.block.findFirst({
    where: { pageId, tenantId, type: "DOCUMENT" },
  });
  const url = `/api/attachments/${attachment.attachmentId}`;
  const nodes: TipTapNode[] = [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: `Attachment: ${attachment.fileName}` }],
    },
    {
      type: "fileAttachment",
      attrs: {
        attachmentId: attachment.attachmentId,
        name: attachment.fileName,
        size: attachment.fileSize,
        mimeType: attachment.mimeType,
        url,
      },
    },
  ];

  const existing = block?.content as unknown as TipTapDocument | undefined;
  const content: TipTapDocument = {
    type: "doc",
    content: [...(existing?.content ?? []), ...nodes],
  };
  const data = {
    content: content as unknown as Prisma.InputJsonValue,
    plainText: extractPlainText(content),
  };

  if (block) {
    await prisma.block.update({ where: { id: block.id }, data });
  } else {
    await prisma.block.create({
      data: {
        tenantId,
        pageId,
        type: "DOCUMENT",
        position: 0,
        ...data,
      },
    });
  }
}
