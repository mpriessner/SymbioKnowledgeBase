import { describe, it, expect } from "vitest";
import {
  generateFrontmatter,
  parseFrontmatter,
} from "@/lib/markdown/frontmatter";

describe("generateFrontmatter", () => {
  it("should generate basic frontmatter", () => {
    const result = generateFrontmatter({
      title: "Test Page",
      created: "2026-02-22T10:00:00Z",
      updated: "2026-02-22T15:00:00Z",
    });

    expect(result).toContain("---");
    expect(result).toContain("title: Test Page");
    expect(result).toContain("created: 2026-02-22T10:00:00Z");
    expect(result).toContain("updated: 2026-02-22T15:00:00Z");
  });

  it("should include optional fields", () => {
    const result = generateFrontmatter({
      title: "Test",
      icon: "📝",
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
      parent: "parent-id",
      tags: ["tag1", "tag2"],
    });

    expect(result).toContain("icon: 📝");
    expect(result).toContain("parent: parent-id");
    expect(result).toContain("tags: [tag1, tag2]");
  });

  it("should escape special YAML characters in title", () => {
    const result = generateFrontmatter({
      title: 'Page: "special" title',
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
    });

    expect(result).toContain('title: "Page');
  });
});

describe("parseFrontmatter", () => {
  it("should parse frontmatter from markdown", () => {
    const md =
      "---\ntitle: Test Page\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\n---\n\n# Content";
    const { metadata, content } = parseFrontmatter(md);

    expect(metadata.title).toBe("Test Page");
    expect(metadata.created).toBe("2026-01-01T00:00:00Z");
    expect(content.trim()).toBe("# Content");
  });

  it("should return empty metadata when no frontmatter", () => {
    const md = "# Just Content\n\nParagraph";
    const { metadata, content } = parseFrontmatter(md);

    expect(metadata).toEqual({});
    expect(content).toBe(md);
  });

  it("should parse tags array", () => {
    const md =
      "---\ntitle: Test\ntags: [tag1, tag2, tag3]\n---\n\nContent";
    const { metadata } = parseFrontmatter(md);

    expect(metadata.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("should handle quoted strings", () => {
    const md =
      '---\ntitle: "Page: special"\ncreated: 2026-01-01T00:00:00Z\n---\n\nContent';
    const { metadata } = parseFrontmatter(md);

    expect(metadata.title).toBe("Page: special");
  });
});
