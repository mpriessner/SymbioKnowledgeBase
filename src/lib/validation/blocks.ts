import { z } from "zod";

// Block types supported by the editor
export const BlockType = z.enum([
  "DOCUMENT",
  "PARAGRAPH",
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "BULLETED_LIST",
  "NUMBERED_LIST",
  "TODO",
  "TOGGLE",
  "CODE",
  "QUOTE",
  "CALLOUT",
  "DIVIDER",
  "IMAGE",
  "BOOKMARK",
  "TABLE",
]);

export type BlockType = z.infer<typeof BlockType>;

// Maximum content size: 1MB when serialized
const MAX_CONTENT_SIZE = 1_000_000;

// Validate that JSON content is an object and does not exceed size limit
const jsonContent = z
  .unknown()
  .refine(
    (val): val is Record<string, unknown> =>
      typeof val === "object" && val !== null && !Array.isArray(val),
    { message: "Content must be a JSON object" }
  )
  .refine(
    (val) => {
      if (typeof val !== "object" || val === null) return true; // skip if first refine already fails
      return JSON.stringify(val).length <= MAX_CONTENT_SIZE;
    },
    { message: `Block content must not exceed ${MAX_CONTENT_SIZE} bytes` }
  );

// Schema for creating a new block
export const createBlockSchema = z.object({
  pageId: z.string().uuid("Invalid page ID"),
  type: BlockType,
  content: jsonContent,
  position: z.number().int().min(0).default(0),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;

// Schema for updating an existing block
export const updateBlockSchema = z.object({
  type: BlockType.optional(),
  content: jsonContent.optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

// Schema for saving the full TipTap document for a page
export const saveDocumentSchema = z.object({
  content: jsonContent,
});

export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;
