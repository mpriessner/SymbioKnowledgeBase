import { describe, it, expect } from "vitest";
import {
  createBlockSchema,
  updateBlockSchema,
  saveDocumentSchema,
  BlockType,
} from "@/lib/validation/blocks";

describe("Block Validation Schemas", () => {
  describe("BlockType enum", () => {
    it("should accept valid block types", () => {
      expect(BlockType.parse("DOCUMENT")).toBe("DOCUMENT");
      expect(BlockType.parse("PARAGRAPH")).toBe("PARAGRAPH");
      expect(BlockType.parse("HEADING_1")).toBe("HEADING_1");
      expect(BlockType.parse("BULLETED_LIST")).toBe("BULLETED_LIST");
      expect(BlockType.parse("NUMBERED_LIST")).toBe("NUMBERED_LIST");
      expect(BlockType.parse("QUOTE")).toBe("QUOTE");
      expect(BlockType.parse("CODE")).toBe("CODE");
    });

    it("should reject invalid block types", () => {
      expect(() => BlockType.parse("INVALID")).toThrow();
      expect(() => BlockType.parse("")).toThrow();
      expect(() => BlockType.parse("paragraph")).toThrow(); // case-sensitive
    });
  });

  describe("createBlockSchema", () => {
    it("should accept valid create input", () => {
      const input = {
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject missing pageId", () => {
      const input = {
        type: "PARAGRAPH",
        content: {},
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID for pageId", () => {
      const input = {
        pageId: "not-a-uuid",
        type: "PARAGRAPH",
        content: {},
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject negative position", () => {
      const input = {
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: {},
        position: -1,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should default position to 0 when not provided", () => {
      const input = {
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: {},
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.position).toBe(0);
      }
    });

    it("should reject content exceeding 1MB", () => {
      const largeContent = { data: "x".repeat(1_000_001) };
      const input = {
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: largeContent,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("updateBlockSchema", () => {
    it("should accept partial update with only content", () => {
      const input = {
        content: { type: "paragraph", content: [] },
      };
      const result = updateBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept partial update with only type", () => {
      const input = { type: "HEADING_1" };
      const result = updateBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept empty update", () => {
      const result = updateBlockSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("saveDocumentSchema", () => {
    it("should accept valid TipTap document JSON", () => {
      const input = {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello world" }],
            },
          ],
        },
      };
      const result = saveDocumentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject missing content", () => {
      const result = saveDocumentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
