import { describe, it, expect } from "vitest";
import { markdownToTiptap } from "@/lib/markdown/deserializer";

describe("markdownToTiptap", () => {
  it("should convert headings", () => {
    const result = markdownToTiptap("# Title\n\n## Subtitle");
    expect(result.content.type).toBe("doc");
    expect(result.content.content).toBeDefined();
    expect(result.content.content![0].type).toBe("heading");
    expect(result.content.content![0].attrs?.level).toBe(1);
    expect(result.content.content![1].type).toBe("heading");
    expect(result.content.content![1].attrs?.level).toBe(2);
  });

  it("should convert paragraphs", () => {
    const result = markdownToTiptap("Hello world");
    expect(result.content.content![0].type).toBe("paragraph");
    expect(result.content.content![0].content![0].text).toBe(
      "Hello world"
    );
  });

  it("should convert bold text", () => {
    const result = markdownToTiptap("Some **bold** text");
    const para = result.content.content![0];
    expect(para.type).toBe("paragraph");
    const boldNode = para.content!.find(
      (n) => n.marks?.some((m) => m.type === "bold")
    );
    expect(boldNode).toBeDefined();
    expect(boldNode!.text).toBe("bold");
  });

  it("should convert italic text", () => {
    const result = markdownToTiptap("Some *italic* text");
    const para = result.content.content![0];
    const italicNode = para.content!.find(
      (n) => n.marks?.some((m) => m.type === "italic")
    );
    expect(italicNode).toBeDefined();
    expect(italicNode!.text).toBe("italic");
  });

  it("should convert strikethrough", () => {
    const result = markdownToTiptap("~~deleted~~ text");
    const para = result.content.content![0];
    const strikeNode = para.content!.find(
      (n) => n.marks?.some((m) => m.type === "strike")
    );
    expect(strikeNode).toBeDefined();
    expect(strikeNode!.text).toBe("deleted");
  });

  it("should convert inline code", () => {
    const result = markdownToTiptap("use `const x`");
    const para = result.content.content![0];
    const codeNode = para.content!.find(
      (n) => n.marks?.some((m) => m.type === "code")
    );
    expect(codeNode).toBeDefined();
    expect(codeNode!.text).toBe("const x");
  });

  it("should convert links", () => {
    const result = markdownToTiptap(
      "[click here](https://example.com)"
    );
    const para = result.content.content![0];
    const linkNode = para.content!.find(
      (n) => n.marks?.some((m) => m.type === "link")
    );
    expect(linkNode).toBeDefined();
    const linkMark = linkNode!.marks!.find((m) => m.type === "link");
    expect(linkMark!.attrs!.href).toBe("https://example.com");
  });

  it("should convert bullet list", () => {
    const result = markdownToTiptap("- Item 1\n- Item 2");
    const list = result.content.content![0];
    expect(list.type).toBe("bulletList");
    expect(list.content).toHaveLength(2);
    expect(list.content![0].type).toBe("listItem");
  });

  it("should convert ordered list", () => {
    const result = markdownToTiptap("1. First\n2. Second");
    const list = result.content.content![0];
    expect(list.type).toBe("orderedList");
    expect(list.content).toHaveLength(2);
  });

  it("should convert task list", () => {
    const result = markdownToTiptap("- [ ] Todo\n- [x] Done");
    const list = result.content.content![0];
    expect(list.type).toBe("taskList");
    expect(list.content![0].type).toBe("taskItem");
    expect(list.content![0].attrs?.checked).toBe(false);
    expect(list.content![1].attrs?.checked).toBe(true);
  });

  it("should convert code block with language", () => {
    const result = markdownToTiptap(
      "```typescript\nconst x = 1;\n```"
    );
    const codeBlock = result.content.content![0];
    expect(codeBlock.type).toBe("codeBlock");
    expect(codeBlock.attrs?.language).toBe("typescript");
    expect(codeBlock.content![0].text).toBe("const x = 1;");
  });

  it("should convert blockquote", () => {
    const result = markdownToTiptap("> A wise quote");
    const blockquote = result.content.content![0];
    expect(blockquote.type).toBe("blockquote");
  });

  it("should convert horizontal rule", () => {
    const result = markdownToTiptap("---");
    const hr = result.content.content![0];
    expect(hr.type).toBe("horizontalRule");
  });

  it("should convert image", () => {
    const result = markdownToTiptap(
      "![Alt text](https://example.com/img.png)"
    );
    const para = result.content.content![0];
    const img = para.content!.find((n) => n.type === "image");
    expect(img).toBeDefined();
    expect(img!.attrs?.src).toBe("https://example.com/img.png");
    expect(img!.attrs?.alt).toBe("Alt text");
  });

  it("should convert wikilinks", () => {
    const result = markdownToTiptap("See [[Page Name]]");
    const para = result.content.content![0];
    const wikilink = para.content!.find(
      (n) => n.type === "wikilink"
    );
    expect(wikilink).toBeDefined();
    expect(wikilink!.attrs?.pageName).toBe("Page Name");
  });

  it("should convert wikilinks with display text", () => {
    const result = markdownToTiptap("See [[Page Name|custom]]");
    const para = result.content.content![0];
    const wikilink = para.content!.find(
      (n) => n.type === "wikilink"
    );
    expect(wikilink).toBeDefined();
    expect(wikilink!.attrs?.pageName).toBe("Page Name");
    expect(wikilink!.attrs?.displayText).toBe("custom");
  });

  it("should parse frontmatter", () => {
    const md =
      "---\ntitle: My Page\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\n---\n\n# Content";
    const result = markdownToTiptap(md);
    expect(result.metadata.title).toBe("My Page");
    expect(result.content.content![0].type).toBe("heading");
  });

  it("should convert table", () => {
    const md = "| Name | Value |\n| --- | --- |\n| A | 1 |";
    const result = markdownToTiptap(md);
    const table = result.content.content![0];
    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(2); // header + 1 data row
    expect(table.content![0].content![0].type).toBe("tableHeader");
    expect(table.content![1].content![0].type).toBe("tableCell");
  });

  it("should handle empty markdown", () => {
    const result = markdownToTiptap("");
    expect(result.content.type).toBe("doc");
    expect(result.content.content).toEqual([]);
  });
});
