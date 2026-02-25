import { describe, it, expect } from "vitest";
import { markdownToTiptap, tiptapToMarkdown } from "@/lib/agent/markdown";
import { extractWikilinks } from "@/lib/wikilinks/parser";
import type { TipTapDocument } from "@/lib/wikilinks/types";

/**
 * Tests for agent wikilink processing.
 *
 * These tests verify:
 * - Wikilinks survive markdown → TipTap → markdown round-trip
 * - Wikilinks are correctly extracted from agent-created TipTap content
 * - Edge cases: duplicates, display text, self-links, empty content
 */

describe("Agent Wikilink Extraction from Markdown", () => {
  it("should extract single [[Page Name]] from converted markdown", () => {
    const md = "See [[System Architecture]] for details";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("System Architecture");
  });

  it("should extract multiple wikilinks from converted markdown", () => {
    const md = "Links: [[Page A]] and [[Page B]] and [[Page C]]";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.pageName)).toEqual([
      "Page A",
      "Page B",
      "Page C",
    ]);
  });

  it("should extract wikilink with display text [[Page|display]]", () => {
    const md = "See [[API Reference|API docs]] for more";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("API Reference");
    expect(links[0].displayText).toBe("API docs");
  });

  it("should deduplicate wikilinks (case-insensitive)", () => {
    const md = "See [[Page A]] and [[page a]] again";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("Page A");
  });

  it("should handle markdown with no wikilinks", () => {
    const md = "# Just a Heading\n\nPlain text without links.";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(0);
  });

  it("should handle empty markdown", () => {
    const md = "";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(0);
  });

  it("should extract wikilinks from multi-line markdown", () => {
    const md = [
      "# Architecture",
      "See [[System Design]] for overview.",
      "Check [[API Reference]] for endpoints.",
      "Visit [[Data Models]] for schema info.",
    ].join("\n");
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.pageName)).toEqual([
      "System Design",
      "API Reference",
      "Data Models",
    ]);
  });

  it("should extract wikilinks from headings", () => {
    const md = "## See [[Important Page]]";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("Important Page");
  });
});

describe("Wikilink Round-Trip Fidelity", () => {
  it("should preserve [[wikilinks]] through markdown → tiptap → markdown", () => {
    const original = "See [[System Architecture]] for details";
    const tiptap = markdownToTiptap(original);
    const roundTripped = tiptapToMarkdown(tiptap);
    expect(roundTripped).toContain("[[System Architecture]]");
  });

  it("should preserve [[Page|Display]] through round-trip", () => {
    const original = "See [[API Reference|API docs]] here";
    const tiptap = markdownToTiptap(original);
    const roundTripped = tiptapToMarkdown(tiptap);
    expect(roundTripped).toContain("[[API Reference|API docs]]");
  });

  it("should preserve multiple wikilinks through round-trip", () => {
    const original = "Links: [[Page A]] and [[Page B]]";
    const tiptap = markdownToTiptap(original);
    const roundTripped = tiptapToMarkdown(tiptap);
    expect(roundTripped).toContain("[[Page A]]");
    expect(roundTripped).toContain("[[Page B]]");
  });
});

describe("Edge Cases", () => {
  it("should handle wikilink adjacent to formatting", () => {
    const md = "**Bold** [[Link Page]] *italic*";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("Link Page");
  });

  it("should handle unresolvable wikilinks without error", () => {
    const md = "See [[NonExistent Page]] and [[Another Missing]]";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    // Extraction works even if pages don't exist in DB
    expect(links).toHaveLength(2);
    expect(links[0].pageName).toBe("NonExistent Page");
    expect(links[1].pageName).toBe("Another Missing");
  });

  it("should handle content with both wikilinks and regular links", () => {
    const md = "See [[Wiki Page]] and [Regular Link](https://example.com)";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("Wiki Page");
  });

  it("should return null for null tiptap content", () => {
    const links = extractWikilinks(null);
    expect(links).toEqual([]);
  });

  it("should return null for undefined tiptap content", () => {
    const links = extractWikilinks(undefined);
    expect(links).toEqual([]);
  });
});
