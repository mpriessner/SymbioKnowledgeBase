import { describe, it, expect } from "vitest";
import { updateWikilinkNodesInDocument } from "@/lib/wikilinks/renameUpdater";
import type { TipTapDocument } from "@/lib/wikilinks/types";

describe("updateWikilinkNodesInDocument", () => {
  it("should update pageName for matching wikilink nodes", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-target",
                pageName: "Old Title",
                displayText: null,
              },
            },
          ],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(true);
    const wikilinkNode = doc.content[0].content![0];
    expect(wikilinkNode.attrs!["pageName"]).toBe("New Title");
    expect(wikilinkNode.attrs!["displayText"]).toBeNull();
  });

  it("should preserve displayText (custom alias) on rename", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-target",
                pageName: "Old Title",
                displayText: "My Custom Alias",
              },
            },
          ],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(true);
    const wikilinkNode = doc.content[0].content![0];
    expect(wikilinkNode.attrs!["pageName"]).toBe("New Title");
    expect(wikilinkNode.attrs!["displayText"]).toBe("My Custom Alias");
  });

  it("should not update wikilink nodes for different page IDs", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-other",
                pageName: "Other Page",
                displayText: null,
              },
            },
          ],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(false);
    const wikilinkNode = doc.content[0].content![0];
    expect(wikilinkNode.attrs!["pageName"]).toBe("Other Page");
  });

  it("should handle deeply nested wikilink nodes", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "wikilink",
                  attrs: {
                    pageId: "uuid-target",
                    pageName: "Old Title",
                    displayText: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(true);
    const wikilinkNode = doc.content[0].content![0].content![0];
    expect(wikilinkNode.attrs!["pageName"]).toBe("New Title");
  });

  it("should update multiple wikilinks in the same document", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-target",
                pageName: "Old Title",
                displayText: null,
              },
            },
            { type: "text", text: " and " },
            {
              type: "wikilink",
              attrs: {
                pageId: "uuid-target",
                pageName: "Old Title",
                displayText: "custom",
              },
            },
          ],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(true);
    const first = doc.content[0].content![0];
    const second = doc.content[0].content![2];
    expect(first.attrs!["pageName"]).toBe("New Title");
    expect(second.attrs!["pageName"]).toBe("New Title");
    expect(second.attrs!["displayText"]).toBe("custom");
  });

  it("should return false for documents with no wikilinks", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Just plain text" }],
        },
      ],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(false);
  });

  it("should return false for empty documents", () => {
    const doc: TipTapDocument = {
      type: "doc",
      content: [],
    };

    const wasUpdated = updateWikilinkNodesInDocument(
      doc,
      "uuid-target",
      "New Title"
    );

    expect(wasUpdated).toBe(false);
  });
});
