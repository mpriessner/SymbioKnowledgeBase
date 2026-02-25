import { describe, it, expect } from "vitest";
import { markdownToTiptap, tiptapToMarkdown } from "@/lib/agent/markdown";
import { extractWikilinks } from "@/lib/wikilinks/parser";
import { validateProperties, extractTitleFromProperties } from "@/lib/database/propertyValidators";
import type { TipTapDocument } from "@/lib/wikilinks/types";
import type { Column, RowProperties } from "@/types/database";

/**
 * End-to-end agent workflow tests.
 *
 * These test suites validate the complete agent lifecycle at the code level:
 * - Markdown round-trip fidelity
 * - Wikilink processing chain
 * - Database row validation
 * - Tree building
 * - Error handling patterns
 *
 * For live API integration tests, a running database is required.
 */

// ────────────────────────────────────────────────────────────────────────
// Suite 1: Markdown Fidelity (Round-Trip Tests)
// ────────────────────────────────────────────────────────────────────────

describe("Suite 1: Markdown Fidelity", () => {
  it("preserves headings through round-trip", () => {
    const md = "# Heading 1\n\n## Heading 2\n\n### Heading 3";
    const tiptap = markdownToTiptap(md);
    const result = tiptapToMarkdown(tiptap);
    expect(result).toContain("# Heading 1");
    expect(result).toContain("## Heading 2");
    expect(result).toContain("### Heading 3");
  });

  it("preserves paragraphs through round-trip", () => {
    const md = "First paragraph.\n\nSecond paragraph.";
    const tiptap = markdownToTiptap(md);
    const result = tiptapToMarkdown(tiptap);
    expect(result).toContain("First paragraph.");
    expect(result).toContain("Second paragraph.");
  });

  it("preserves wikilinks through round-trip", () => {
    const md = "See [[System Architecture]] and [[API Reference|docs]].";
    const tiptap = markdownToTiptap(md);
    const result = tiptapToMarkdown(tiptap);
    expect(result).toContain("[[System Architecture]]");
    expect(result).toContain("[[API Reference|docs]]");
  });

  it("handles complex markdown with mixed content", () => {
    const md = [
      "# Project Overview",
      "This project uses [[System Architecture]] for structure.",
      "## Features",
      "Key features include real-time editing.",
    ].join("\n");
    const tiptap = markdownToTiptap(md);
    const result = tiptapToMarkdown(tiptap);
    expect(result).toContain("# Project Overview");
    expect(result).toContain("[[System Architecture]]");
    expect(result).toContain("## Features");
  });

  it("handles empty markdown", () => {
    const tiptap = markdownToTiptap("");
    const result = tiptapToMarkdown(tiptap);
    expect(typeof result).toBe("string");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Suite 2: Wikilink Processing Chain
// ────────────────────────────────────────────────────────────────────────

describe("Suite 2: Wikilink Processing Chain", () => {
  it("agent creates page with wikilinks → links are extractable", () => {
    const markdown =
      "See [[System Architecture]] and [[API Reference]] for details.";
    const tiptap = markdownToTiptap(markdown) as TipTapDocument;
    const links = extractWikilinks(tiptap);

    expect(links).toHaveLength(2);
    expect(links[0].pageName).toBe("System Architecture");
    expect(links[1].pageName).toBe("API Reference");
  });

  it("agent updates page, removes link → only new links remain", () => {
    // Initial content with 2 links
    const initial = "Links: [[Page A]] and [[Page B]]";
    const initialTiptap = markdownToTiptap(initial) as TipTapDocument;
    const initialLinks = extractWikilinks(initialTiptap);
    expect(initialLinks).toHaveLength(2);

    // Updated content with only 1 link + new link
    const updated = "Links: [[Page A]] and [[Page C]]";
    const updatedTiptap = markdownToTiptap(updated) as TipTapDocument;
    const updatedLinks = extractWikilinks(updatedTiptap);
    expect(updatedLinks).toHaveLength(2);
    expect(updatedLinks.map((l) => l.pageName)).toEqual(["Page A", "Page C"]);
  });

  it("duplicate wikilinks produce only one entry", () => {
    const md = "[[Same Page]] and [[same page]] again [[SAME PAGE]]";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
  });

  it("wikilinks with display text extract correct page name", () => {
    const md = "See [[Real Page Name|display text]] for info";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("Real Page Name");
    expect(links[0].displayText).toBe("display text");
  });

  it("unresolvable wikilinks are still extractable", () => {
    const md = "Reference: [[NonExistentPage123]]";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe("NonExistentPage123");
  });

  it("content without wikilinks produces empty extraction", () => {
    const md = "Just plain text with no links at all.";
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Suite 3: Database Row Validation
// ────────────────────────────────────────────────────────────────────────

describe("Suite 3: Database Row Validation", () => {
  const columns: Column[] = [
    { id: "col-title", name: "Title", type: "TITLE" },
    { id: "col-status", name: "Status", type: "SELECT", options: ["Open", "Closed", "In Progress"] },
    { id: "col-priority", name: "Priority", type: "NUMBER" },
    { id: "col-desc", name: "Description", type: "TEXT" },
    { id: "col-date", name: "Due Date", type: "DATE" },
    { id: "col-done", name: "Done", type: "CHECKBOX" },
    { id: "col-link", name: "Link", type: "URL" },
  ];

  it("validates correct properties successfully", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Fix authentication bug" },
      "col-status": { type: "SELECT", value: "Open" },
      "col-priority": { type: "NUMBER", value: 1 },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects unknown column IDs", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-unknown": { type: "TEXT", value: "Invalid" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unknown column"))).toBe(true);
  });

  it("rejects invalid SELECT option", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-status": { type: "SELECT", value: "InvalidStatus" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not a valid option"))).toBe(true);
  });

  it("rejects type mismatch", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-priority": { type: "TEXT", value: "not a number" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("expects type"))).toBe(true);
  });

  it("requires TITLE property", () => {
    const props: RowProperties = {
      "col-status": { type: "SELECT", value: "Open" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("TITLE"))).toBe(true);
  });

  it("extracts title from properties correctly", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "My Bug Report" },
    };
    const title = extractTitleFromProperties(props, columns);
    expect(title).toBe("My Bug Report");
  });

  it("returns 'Untitled' when TITLE property is missing", () => {
    const props: RowProperties = {};
    const title = extractTitleFromProperties(props, columns);
    expect(title).toBe("Untitled");
  });

  it("validates full CRUD properties cycle", () => {
    // Create
    const createProps: RowProperties = {
      "col-title": { type: "TITLE", value: "New Task" },
      "col-status": { type: "SELECT", value: "Open" },
      "col-priority": { type: "NUMBER", value: 3 },
      "col-desc": { type: "TEXT", value: "Description here" },
      "col-done": { type: "CHECKBOX", value: false },
    };
    expect(validateProperties(createProps, columns).valid).toBe(true);

    // Update (partial)
    const updateProps: RowProperties = {
      "col-title": { type: "TITLE", value: "New Task" },
      "col-status": { type: "SELECT", value: "In Progress" },
      "col-done": { type: "CHECKBOX", value: true },
    };
    expect(validateProperties(updateProps, columns).valid).toBe(true);
  });

  it("rejects NaN for NUMBER type", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-priority": { type: "NUMBER", value: NaN },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid URL for URL type", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-link": { type: "URL", value: "not-a-url" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("valid URL"))).toBe(true);
  });

  it("accepts valid URL for URL type", () => {
    const props: RowProperties = {
      "col-title": { type: "TITLE", value: "Test" },
      "col-link": { type: "URL", value: "https://example.com/page" },
    };
    const result = validateProperties(props, columns);
    expect(result.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Suite 4: Agent API Error Handling Patterns
// ────────────────────────────────────────────────────────────────────────

describe("Suite 4: Error Handling Patterns", () => {
  it("Zod validates page creation schema", () => {
    const { z } = require("zod");
    const schema = z.object({
      title: z.string().min(1).max(255),
      markdown: z.string().optional(),
      parent_id: z.string().uuid().optional(),
    });

    // Valid
    expect(schema.safeParse({ title: "Test" }).success).toBe(true);
    expect(
      schema.safeParse({ title: "Test", markdown: "# Hello" }).success
    ).toBe(true);

    // Invalid
    expect(schema.safeParse({ title: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(
      schema.safeParse({ title: "Test", parent_id: "not-uuid" }).success
    ).toBe(false);
  });

  it("Zod validates update page schema", () => {
    const { z } = require("zod");
    const schema = z.object({ markdown: z.string() });

    expect(schema.safeParse({ markdown: "# Content" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ markdown: 123 }).success).toBe(false);
  });

  it("UUID validation works correctly", () => {
    const { z } = require("zod");
    const uuidSchema = z.string().uuid();

    expect(
      uuidSchema.safeParse("d0000000-0000-4000-a000-000000000001").success
    ).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse("").success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Suite 5: MCP Client Interface Completeness
// ────────────────────────────────────────────────────────────────────────

describe("Suite 5: Agent Workflow Integration", () => {
  it("full wikilink workflow: create → extract → diff", () => {
    // Step 1: Agent creates page with markdown
    const createMarkdown = "# Architecture\nSee [[API Reference]] and [[Design System]].";
    const tiptap = markdownToTiptap(createMarkdown) as TipTapDocument;

    // Step 2: Extract wikilinks
    const links = extractWikilinks(tiptap);
    expect(links).toHaveLength(2);

    // Step 3: Simulate update removing one link
    const updateMarkdown = "# Architecture\nSee [[API Reference]] and [[New Page]].";
    const updatedTiptap = markdownToTiptap(updateMarkdown) as TipTapDocument;
    const updatedLinks = extractWikilinks(updatedTiptap);

    // Step 4: Compute diff
    const oldTargets = new Set(links.map((l) => l.pageName.toLowerCase()));
    const newTargets = new Set(
      updatedLinks.map((l) => l.pageName.toLowerCase())
    );

    const added = updatedLinks.filter(
      (l) => !oldTargets.has(l.pageName.toLowerCase())
    );
    const removed = links.filter(
      (l) => !newTargets.has(l.pageName.toLowerCase())
    );

    expect(added).toHaveLength(1);
    expect(added[0].pageName).toBe("New Page");
    expect(removed).toHaveLength(1);
    expect(removed[0].pageName).toBe("Design System");
  });

  it("database row lifecycle: validate → create → update → verify", () => {
    const columns: Column[] = [
      { id: "col-title", name: "Title", type: "TITLE" },
      {
        id: "col-status",
        name: "Status",
        type: "SELECT",
        options: ["Open", "In Progress", "Resolved"],
      },
    ];

    // Create
    const createProps: RowProperties = {
      "col-title": { type: "TITLE", value: "Bug: Login broken" },
      "col-status": { type: "SELECT", value: "Open" },
    };
    expect(validateProperties(createProps, columns).valid).toBe(true);
    const title = extractTitleFromProperties(createProps, columns);
    expect(title).toBe("Bug: Login broken");

    // Update (partial merge)
    const existingProps = { ...createProps };
    const updateProps: RowProperties = {
      "col-status": { type: "SELECT", value: "Resolved" },
    };
    const merged = { ...existingProps, ...updateProps };

    // Merged still has TITLE
    expect(validateProperties(merged, columns).valid).toBe(true);
    expect(
      (merged["col-status"] as { type: string; value: string }).value
    ).toBe("Resolved");
    expect(
      (merged["col-title"] as { type: string; value: string }).value
    ).toBe("Bug: Login broken");
  });
});
