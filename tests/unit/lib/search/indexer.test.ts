import { describe, it, expect } from "vitest";
import { extractPlainText } from "@/lib/search/indexer";
import type { TipTapDocument } from "@/lib/wikilinks/types";

describe("extractPlainText", () => {
  it("should return empty string for null input", () => {
    expect(extractPlainText(null)).toBe("");
  });

  it("should return empty string for undefined input", () => {
    expect(extractPlainText(undefined)).toBe("");
  });

  it("should extract text from a simple paragraph", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hello world");
  });

  it("should extract text from multiple paragraphs", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("First paragraph Second paragraph");
  });

  it("should include wikilink page names in extracted text", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-1",
                pageName: "Installation Guide",
                displayText: null,
              },
            },
            { type: "text", text: " for details" },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe(
      "See Installation Guide for details"
    );
  });

  it("should include wikilink display text and page name", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-1",
                pageName: "Installation Guide",
                displayText: "setup docs",
              },
            },
          ],
        },
      ],
    };
    const result = extractPlainText(doc);
    expect(result).toContain("setup docs");
    expect(result).toContain("Installation Guide");
  });

  it("should extract text from nested structures (blockquotes, lists)", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted text" }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "List item" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Quoted text List item");
  });

  it("should collapse multiple whitespace characters", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "  Multiple   spaces  " }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Multiple spaces");
  });

  it("should handle document with no text content", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "horizontalRule",
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("");
  });
});
