import { describe, it, expect } from "vitest";
import { tiptapToMarkdown } from "@/lib/markdown/serializer";
import type { JSONContent } from "@tiptap/core";

describe("tiptapToMarkdown", () => {
  it("should convert heading", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe("# Title\n");
  });

  it("should convert h2 and h3", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("## Subtitle");
    expect(md).toContain("### Section");
  });

  it("should convert bold text", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe("Some **bold** text\n");
  });

  it("should convert italic text", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("*emphasis*");
  });

  it("should convert strikethrough", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("~~deleted~~");
  });

  it("should convert inline code", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("`const x`");
  });

  it("should convert links", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click here",
              marks: [
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("[click here](https://example.com)");
  });

  it("should convert bullet list", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("- Item 1");
    expect(md).toContain("- Item 2");
  });

  it("should convert ordered list", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
  });

  it("should convert task list", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("- [ ] Todo");
    expect(md).toContain("- [x] Done");
  });

  it("should convert code block with language", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("```typescript");
    expect(md).toContain("const x = 1;");
    expect(md).toContain("```");
  });

  it("should convert blockquote", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("> A wise quote");
  });

  it("should convert wikilink", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: { pageName: "Other Page", displayText: null },
            },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("[[Other Page]]");
  });

  it("should convert wikilink with display text", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "wikilink",
              attrs: {
                pageName: "Other Page",
                displayText: "custom label",
              },
            },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("[[Other Page|custom label]]");
  });

  it("should convert horizontal rule", () => {
    const json: JSONContent = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("---");
  });

  it("should convert image", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://example.com/img.png", alt: "My image" },
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("![My image](https://example.com/img.png)");
  });

  it("should include frontmatter when metadata provided", () => {
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
        title: "Test Page",
        created: "2026-02-22T10:00:00Z",
        updated: "2026-02-22T15:00:00Z",
      },
    });

    expect(md).toContain("---");
    expect(md).toContain("title: Test Page");
    expect(md).toContain("created: 2026-02-22T10:00:00Z");
  });

  it("should handle empty doc", () => {
    const json: JSONContent = { type: "doc", content: [] };
    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe("\n");
  });

  it("should handle null/undefined content gracefully", () => {
    const json: JSONContent = { type: "doc" };
    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toBe("\n");
  });

  it("should convert highlight mark", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "important",
              marks: [{ type: "highlight" }],
            },
          ],
        },
      ],
    };

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("==important==");
  });

  it("should convert table", () => {
    const json: JSONContent = {
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

    const md = tiptapToMarkdown(json, { includeFrontmatter: false });
    expect(md).toContain("| Name | Value |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| A | 1 |");
  });
});
