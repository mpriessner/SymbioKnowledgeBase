import { describe, it, expect } from "vitest";
import { tiptapToMarkdown } from "@/lib/markdown/serializer";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import type { JSONContent } from "@tiptap/core";

/**
 * Round-trip test helper: JSON → Markdown → JSON
 * Verifies that the structure survives a full serialization cycle.
 */
function roundTrip(json: JSONContent): JSONContent {
  const md = tiptapToMarkdown(json, { includeFrontmatter: false });
  const result = markdownToTiptap(md);
  return result.content;
}

/**
 * Normalize JSON for comparison: remove undefined values and
 * properties that are expected to differ between input/output.
 */
function normalize(json: JSONContent): unknown {
  return JSON.parse(JSON.stringify(json));
}

describe("Round-trip fidelity: JSON → Markdown → JSON", () => {
  // ── Block-level nodes ──────────────────────────────────────

  describe("headings", () => {
    it("h1 round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Title" }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(normalize(output)).toEqual(normalize(input));
    });

    it("h2 and h3 round-trip", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Subtitle" }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Section" }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(normalize(output)).toEqual(normalize(input));
    });

    it("h1–h6 all round-trip", () => {
      for (let level = 1; level <= 6; level++) {
        const input: JSONContent = {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level },
              content: [{ type: "text", text: `Level ${level}` }],
            },
          ],
        };
        const output = roundTrip(input);
        expect(output.content![0].attrs?.level).toBe(level);
        expect(output.content![0].content![0].text).toBe(`Level ${level}`);
      }
    });
  });

  describe("paragraphs", () => {
    it("simple paragraph round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(normalize(output)).toEqual(normalize(input));
    });

    it("multiple paragraphs round-trip", () => {
      const input: JSONContent = {
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
      const output = roundTrip(input);
      expect(output.content).toHaveLength(2);
      expect(output.content![0].content![0].text).toBe("First paragraph");
      expect(output.content![1].content![0].text).toBe("Second paragraph");
    });
  });

  describe("bullet list", () => {
    it("simple bullet list round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 2" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("bulletList");
      expect(output.content![0].content).toHaveLength(2);
      expect(output.content![0].content![0].type).toBe("listItem");
    });
  });

  describe("ordered list", () => {
    it("ordered list round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Second" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("orderedList");
      expect(output.content![0].content).toHaveLength(2);
    });
  });

  describe("task list", () => {
    it("task list with checked and unchecked items round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Todo" }],
                  },
                ],
              },
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Done" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("taskList");
      expect(output.content![0].content![0].attrs?.checked).toBe(false);
      expect(output.content![0].content![1].attrs?.checked).toBe(true);
    });
  });

  describe("code block", () => {
    it("code block with language round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "typescript" },
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("codeBlock");
      expect(output.content![0].attrs?.language).toBe("typescript");
      expect(output.content![0].content![0].text).toBe("const x = 1;");
    });

    it("code block without language round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "" },
            content: [{ type: "text", text: "plain code" }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("codeBlock");
      expect(output.content![0].content![0].text).toBe("plain code");
    });

    it("multi-line code block round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "python" },
            content: [
              {
                type: "text",
                text: "def hello():\n    print('world')",
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].content![0].text).toBe(
        "def hello():\n    print('world')"
      );
    });
  });

  describe("blockquote", () => {
    it("simple blockquote round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "A wise quote" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("blockquote");
      expect(output.content![0].content![0].type).toBe("paragraph");
      expect(output.content![0].content![0].content![0].text).toBe(
        "A wise quote"
      );
    });
  });

  describe("callout", () => {
    it("callout with title and no body round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { type: "info", title: "Note" },
            content: [{ type: "paragraph", content: [] }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("callout");
      expect(output.content![0].attrs?.type).toBe("info");
      expect(output.content![0].attrs?.title).toBe("Note");
    });

    it("callout with body content round-trips", () => {
      const md = "> [!warning] Caution\n> Be careful here.";
      const result = markdownToTiptap(md);
      expect(result.content.content![0].type).toBe("callout");
      expect(result.content.content![0].attrs?.type).toBe("warning");

      // Re-serialize and check it still parses as callout
      const md2 = tiptapToMarkdown(result.content, {
        includeFrontmatter: false,
      });
      expect(md2).toContain("[!warning]");
      const result2 = markdownToTiptap(md2);
      expect(result2.content.content![0].type).toBe("callout");
      expect(result2.content.content![0].attrs?.type).toBe("warning");
    });
  });

  describe("toggle (details/summary)", () => {
    it("toggle with content round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "toggle",
            attrs: { title: "Click to expand" },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Hidden content" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("toggle");
      expect(output.content![0].attrs?.title).toBe("Click to expand");
      expect(output.content![0].content).toBeDefined();
      expect(output.content![0].content!.length).toBeGreaterThan(0);
      // Content should contain "Hidden content"
      const text = JSON.stringify(output.content![0].content);
      expect(text).toContain("Hidden content");
    });

    it("toggle without content round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "toggle",
            attrs: { title: "Empty Toggle" },
            content: [{ type: "paragraph", content: [] }],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("toggle");
      expect(output.content![0].attrs?.title).toBe("Empty Toggle");
    });
  });

  describe("horizontal rule", () => {
    it("horizontal rule round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Before" }],
          },
          { type: "horizontalRule" },
          {
            type: "paragraph",
            content: [{ type: "text", text: "After" }],
          },
        ],
      };
      const output = roundTrip(input);
      const types = output.content!.map((n) => n.type);
      expect(types).toContain("horizontalRule");
    });
  });

  describe("image", () => {
    it("image round-trips preserving src and alt", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.com/img.png", alt: "Photo" },
          },
        ],
      };
      const md = tiptapToMarkdown(input, { includeFrontmatter: false });
      expect(md).toContain("![Photo](https://example.com/img.png)");

      const result = markdownToTiptap(md);
      // Image may be wrapped in paragraph by remark — find it
      const findImage = (nodes: JSONContent[]): JSONContent | undefined => {
        for (const n of nodes) {
          if (n.type === "image") return n;
          if (n.content) {
            const found = findImage(n.content);
            if (found) return found;
          }
        }
        return undefined;
      };
      const img = findImage(result.content.content || []);
      expect(img).toBeDefined();
      expect(img!.attrs?.src).toBe("https://example.com/img.png");
      expect(img!.attrs?.alt).toBe("Photo");
    });
  });

  describe("table", () => {
    it("table round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Name" }],
                      },
                    ],
                  },
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Value" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "A" }],
                      },
                    ],
                  },
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "1" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      expect(output.content![0].type).toBe("table");
      expect(output.content![0].content).toHaveLength(2);
      // Header row
      expect(output.content![0].content![0].content![0].type).toBe(
        "tableHeader"
      );
      // Data row
      expect(output.content![0].content![1].content![0].type).toBe(
        "tableCell"
      );
    });
  });

  // ── Inline marks ───────────────────────────────────────────

  describe("inline marks", () => {
    it("bold round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Some " },
              { type: "text", text: "bold", marks: [{ type: "bold" }] },
              { type: "text", text: " text" },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const boldNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "bold")
      );
      expect(boldNode).toBeDefined();
      expect(boldNode!.text).toBe("bold");
    });

    it("italic round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "emphasis",
                marks: [{ type: "italic" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const italicNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "italic")
      );
      expect(italicNode).toBeDefined();
      expect(italicNode!.text).toBe("emphasis");
    });

    it("strikethrough round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "deleted",
                marks: [{ type: "strike" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const strikeNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "strike")
      );
      expect(strikeNode).toBeDefined();
      expect(strikeNode!.text).toBe("deleted");
    });

    it("inline code round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "const x",
                marks: [{ type: "code" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const codeNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "code")
      );
      expect(codeNode).toBeDefined();
      expect(codeNode!.text).toBe("const x");
    });

    it("link round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "click",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://example.com" },
                  },
                ],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const linkNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "link")
      );
      expect(linkNode).toBeDefined();
      expect(linkNode!.text).toBe("click");
      const linkMark = linkNode!.marks!.find((m) => m.type === "link");
      expect(linkMark!.attrs!.href).toBe("https://example.com");
    });

    it("highlight round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "some " },
              {
                type: "text",
                text: "important",
                marks: [{ type: "highlight" }],
              },
              { type: "text", text: " text" },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const highlightNode = output.content![0].content!.find((n) =>
        n.marks?.some((m) => m.type === "highlight")
      );
      expect(highlightNode).toBeDefined();
      expect(highlightNode!.text).toBe("important");
    });

    it("nested bold + italic round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "both",
                marks: [{ type: "bold" }, { type: "italic" }],
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const node = output.content![0].content![0];
      expect(node.text).toBe("both");
      const markTypes = node.marks!.map((m) => m.type).sort();
      expect(markTypes).toContain("bold");
      expect(markTypes).toContain("italic");
    });
  });

  // ── Wikilinks ──────────────────────────────────────────────

  describe("wikilinks", () => {
    it("wikilink without display text round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "See " },
              {
                type: "wikilink",
                attrs: { pageName: "Other Page", displayText: null },
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const wikilink = output.content![0].content!.find(
        (n) => n.type === "wikilink"
      );
      expect(wikilink).toBeDefined();
      expect(wikilink!.attrs?.pageName).toBe("Other Page");
    });

    it("wikilink with display text round-trips", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "wikilink",
                attrs: {
                  pageName: "Target Page",
                  displayText: "custom label",
                },
              },
            ],
          },
        ],
      };
      const output = roundTrip(input);
      const wikilink = output.content![0].content!.find(
        (n) => n.type === "wikilink"
      );
      expect(wikilink).toBeDefined();
      expect(wikilink!.attrs?.pageName).toBe("Target Page");
      expect(wikilink!.attrs?.displayText).toBe("custom label");
    });
  });

  // ── Frontmatter ────────────────────────────────────────────

  describe("frontmatter round-trip", () => {
    it("full metadata round-trips through frontmatter", () => {
      const json: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content" }],
          },
        ],
      };
      const md = tiptapToMarkdown(json, {
        includeFrontmatter: true,
        metadata: {
          id: "abc-123",
          title: "Test Page",
          icon: "🚀",
          parent: "parent-456",
          position: 3,
          spaceType: "PRIVATE",
          created: "2026-02-25T10:00:00Z",
          updated: "2026-02-25T12:00:00Z",
          tags: ["tag1", "tag2"],
        },
      });

      const result = markdownToTiptap(md);
      expect(result.metadata.id).toBe("abc-123");
      expect(result.metadata.title).toBe("Test Page");
      expect(result.metadata.icon).toBe("🚀");
      expect(result.metadata.parent).toBe("parent-456");
      expect(result.metadata.position).toBe(3);
      expect(result.metadata.spaceType).toBe("PRIVATE");
      expect(result.metadata.created).toBe("2026-02-25T10:00:00Z");
      expect(result.metadata.updated).toBe("2026-02-25T12:00:00Z");
      expect(result.metadata.tags).toEqual(["tag1", "tag2"]);
    });

    it("metadata with special characters in title round-trips", () => {
      const json: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content" }],
          },
        ],
      };
      const md = tiptapToMarkdown(json, {
        includeFrontmatter: true,
        metadata: {
          title: 'Page with "quotes" & colons: yes',
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
        },
      });

      const result = markdownToTiptap(md);
      expect(result.metadata.title).toBe(
        'Page with "quotes" & colons: yes'
      );
    });
  });

  // ── Mixed content ──────────────────────────────────────────

  describe("mixed document", () => {
    it("complex document structure survives round-trip", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Project Overview" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "This is a " },
              { type: "text", text: "bold", marks: [{ type: "bold" }] },
              { type: "text", text: " introduction with " },
              {
                type: "wikilink",
                attrs: { pageName: "References", displayText: null },
              },
              { type: "text", text: "." },
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
                    content: [{ type: "text", text: "Point one" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Point two" }],
                  },
                ],
              },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: "js" },
            content: [
              { type: "text", text: 'console.log("hello");' },
            ],
          },
          { type: "horizontalRule" },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Summary" }],
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Feature" }],
                      },
                    ],
                  },
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Status" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Auth" }],
                      },
                    ],
                  },
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Done" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const output = roundTrip(input);
      const types = output.content!.map((n) => n.type);

      // Verify structure is preserved
      expect(types).toContain("heading");
      expect(types).toContain("paragraph");
      expect(types).toContain("bulletList");
      expect(types).toContain("codeBlock");
      expect(types).toContain("horizontalRule");
      expect(types).toContain("table");

      // Verify wikilink survived
      const paraWithLink = output.content!.find(
        (n) =>
          n.type === "paragraph" &&
          n.content?.some((c) => c.type === "wikilink")
      );
      expect(paraWithLink).toBeDefined();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty document round-trips", () => {
      const input: JSONContent = { type: "doc", content: [] };
      const output = roundTrip(input);
      expect(output.type).toBe("doc");
      expect(output.content || []).toEqual([]);
    });

    it("document with only whitespace round-trips gracefully", () => {
      const result = markdownToTiptap("   \n\n   ");
      expect(result.content.type).toBe("doc");
    });
  });

  // ── Known lossy conversions (documented) ───────────────────

  describe("known lossy conversions", () => {
    it("bookmark degrades to link (documented limitation)", () => {
      const input: JSONContent = {
        type: "doc",
        content: [
          {
            type: "bookmark",
            attrs: {
              url: "https://example.com",
              title: "Example",
              description: "A great site",
            },
          },
        ],
      };
      const md = tiptapToMarkdown(input, { includeFrontmatter: false });
      // Bookmark serializes as link + blockquote
      expect(md).toContain("[Example](https://example.com)");
      // It will deserialize as paragraph with link + blockquote, not bookmark
      const output = markdownToTiptap(md);
      // Verify it doesn't crash — the content is preserved, just not as bookmark type
      expect(output.content.content!.length).toBeGreaterThan(0);
    });
  });
});
