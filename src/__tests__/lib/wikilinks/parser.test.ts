import { describe, it, expect } from "vitest";
import {
  extractWikilinks,
  extractWikilinkNodes,
  extractResolvedPageIds,
} from "@/lib/wikilinks/parser";
import type { TipTapDocument } from "@/lib/wikilinks/types";

describe("extractWikilinks", () => {
  it("should return empty array for null input", () => {
    expect(extractWikilinks(null)).toEqual([]);
  });

  it("should return empty array for undefined input", () => {
    expect(extractWikilinks(undefined)).toEqual([]);
  });

  it("should return empty array for document with no wikilinks", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractWikilinks(doc)).toEqual([]);
  });

  it("should extract a single [[Page Name]] wikilink", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "See [[Installation Guide]] for details",
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe("Installation Guide");
    expect(result[0].displayText).toBeUndefined();
  });

  it("should extract [[Page Name|Display Text]] with alias", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "See [[Installation Guide|setup docs]]",
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe("Installation Guide");
    expect(result[0].displayText).toBe("setup docs");
  });

  it("should extract multiple wikilinks from a single text node", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "See [[Page A]] and [[Page B|display]] for info",
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(2);
    expect(result[0].pageName).toBe("Page A");
    expect(result[1].pageName).toBe("Page B");
    expect(result[1].displayText).toBe("display");
  });

  it("should deduplicate wikilinks to the same page (case-insensitive)", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "[[Page A]] and [[page a]] again" },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe("Page A");
  });

  it("should traverse nested nodes (blockquotes, lists)", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quote: [[Deep Page]]" }],
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
                  content: [{ type: "text", text: "[[List Page]]" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.pageName)).toEqual(["Deep Page", "List Page"]);
  });

  it("should extract wikilink TipTap nodes", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-123",
                pageName: "Linked Page",
                displayText: undefined,
              },
            },
          ],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe("Linked Page");
  });

  it("should ignore empty wikilink brackets", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Empty [[]] here" }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(0);
  });

  it("should trim whitespace from page names", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "[[  Spaced Name  ]]" }],
        },
      ],
    };
    const result = extractWikilinks(doc);
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe("Spaced Name");
  });
});

describe("extractWikilinkNodes", () => {
  it("should extract wikilink nodes with pageId", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-456",
                pageName: "My Page",
                displayText: "Custom",
              },
            },
          ],
        },
      ],
    };
    const result = extractWikilinkNodes(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pageId: "uuid-456",
      pageName: "My Page",
      displayText: "Custom",
    });
  });
});

describe("extractResolvedPageIds", () => {
  it("should return unique page IDs from wikilink nodes", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: { pageId: "id-1", pageName: "Page 1" },
            },
            {
              type: "wikilink",
              attrs: { pageId: "id-2", pageName: "Page 2" },
            },
            {
              type: "wikilink",
              attrs: { pageId: "id-1", pageName: "Page 1" },
            },
          ],
        },
      ],
    };
    const result = extractResolvedPageIds(doc);
    expect(result).toHaveLength(2);
    expect(result).toContain("id-1");
    expect(result).toContain("id-2");
  });
});
