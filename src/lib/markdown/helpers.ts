import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "./serializer";
import { markdownToTiptap } from "./deserializer";
import type { JSONContent } from "@tiptap/core";
import type { PageMetadata } from "./types";
import type { BlockType } from "@/lib/validation/blocks";

const TIPTAP_TO_BLOCK_TYPE: Record<string, BlockType> = {
  doc: "DOCUMENT",
  paragraph: "PARAGRAPH",
  heading: "PARAGRAPH", // All headings stored as paragraph with JSON content
  bulletList: "BULLETED_LIST",
  orderedList: "NUMBERED_LIST",
  taskList: "TODO",
  toggle: "TOGGLE",
  codeBlock: "CODE",
  blockquote: "QUOTE",
  callout: "CALLOUT",
  horizontalRule: "DIVIDER",
  image: "IMAGE",
  bookmark: "BOOKMARK",
  table: "TABLE",
};

function mapTiptapTypeToBlockType(tiptapType: string | undefined): BlockType {
  if (!tiptapType) return "PARAGRAPH";
  return TIPTAP_TO_BLOCK_TYPE[tiptapType] || "PARAGRAPH";
}

interface PageWithBlocks {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  blocks: Array<{
    id: string;
    content: unknown;
    position: number;
  }>;
}

/**
 * Convert a page (with blocks) to markdown string.
 */
export function pageToMarkdown(page: PageWithBlocks): string {
  const metadata: PageMetadata = {
    title: page.title,
    icon: page.icon,
    created: page.createdAt.toISOString(),
    updated: page.updatedAt.toISOString(),
    parent: page.parentId,
  };

  // Build TipTap doc from blocks
  const sortedBlocks = [...page.blocks].sort(
    (a, b) => a.position - b.position
  );
  const doc: JSONContent = {
    type: "doc",
    content: sortedBlocks.map(
      (block) => block.content as unknown as JSONContent
    ),
  };

  return tiptapToMarkdown(doc, {
    includeFrontmatter: true,
    metadata,
  });
}

/**
 * Save TipTap JSONContent as blocks for a page.
 * Deletes existing blocks and creates new ones.
 */
export async function savePageBlocks(
  pageId: string,
  tenantId: string,
  content: JSONContent
): Promise<void> {
  const blocks = content.content || [];

  await prisma.$transaction(async (tx) => {
    // Delete existing blocks
    await tx.block.deleteMany({
      where: { pageId, tenantId },
    });

    // Create new blocks
    if (blocks.length > 0) {
      for (let i = 0; i < blocks.length; i++) {
        await tx.block.create({
          data: {
            pageId,
            tenantId,
            type: mapTiptapTypeToBlockType(blocks[i].type),
            content: JSON.parse(JSON.stringify(blocks[i])),
            position: i,
          },
        });
      }
    }
  });
}

/**
 * Fetch a page with its blocks.
 */
export async function fetchPageWithBlocks(
  pageId: string,
  tenantId: string
): Promise<PageWithBlocks | null> {
  return prisma.page.findFirst({
    where: { id: pageId, tenantId },
    include: {
      blocks: {
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Slugify a page title for file naming.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "untitled";
}

export { markdownToTiptap };
