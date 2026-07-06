import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import {
  applySectionUpdates,
  isStaleUpdate,
  FIXED_SECTION_HEADINGS,
  type SectionUpdate,
} from "@/lib/sync/contentMerge";

function buildDoc(markdown: string): JSONContent {
  const { content } = markdownToTiptap(markdown);
  return content;
}

function textOf(node: JSONContent): string {
  return (node.content || [])
    .map((c: JSONContent) => (c.type === "text" ? c.text || "" : ""))
    .join("")
    .trim();
}

function headingIndex(content: JSONContent[], heading: string): number {
  return content.findIndex(
    (n) => n.type === "heading" && textOf(n) === heading
  );
}

/** Heading node + its single following body node (our fixtures use one-paragraph sections). */
function findSection(
  content: JSONContent[],
  heading: string
): { headingNode: JSONContent | undefined; bodyNode: JSONContent | undefined } {
  const idx = headingIndex(content, heading);
  if (idx === -1) return { headingNode: undefined, bodyNode: undefined };
  return { headingNode: content[idx], bodyNode: content[idx + 1] };
}

function bodyText(content: JSONContent[], heading: string): string {
  const { bodyNode } = findSection(content, heading);
  return bodyNode ? textOf(bodyNode) : "";
}

const FULL_SCAFFOLD_MARKDOWN = [
  "# EXP-1: Demo",
  "",
  "## Executive Summary",
  "",
  "Old summary.",
  "",
  "## Notebook Narrative",
  "",
  "Old narrative.",
  "",
  "## ExpTube Analysis",
  "",
  "Old analysis.",
  "",
  "## KB Notes",
  "",
  "User's own notes -- must never change.",
  "",
].join("\n");

describe("contentMerge.applySectionUpdates", () => {
  it("replaces only the targeted section, leaving all others byte-identical", () => {
    const doc = buildDoc(FULL_SCAFFOLD_MARKDOWN);
    const before = doc.content as JSONContent[];

    const execBefore = findSection(before, "Executive Summary");
    const analysisBefore = findSection(before, "ExpTube Analysis");
    const kbNotesBefore = findSection(before, "KB Notes");

    const updates: SectionUpdate[] = [
      { heading: "Notebook Narrative", markdown: "Brand new narrative text." },
    ];
    const { doc: result, appended } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    expect(appended).toEqual([]);

    // Untouched sections are the exact same node objects (reference equality),
    // i.e. byte-identical — never rebuilt, never cloned.
    const execAfter = findSection(after, "Executive Summary");
    expect(execAfter.headingNode).toBe(execBefore.headingNode);
    expect(execAfter.bodyNode).toBe(execBefore.bodyNode);

    const analysisAfter = findSection(after, "ExpTube Analysis");
    expect(analysisAfter.headingNode).toBe(analysisBefore.headingNode);
    expect(analysisAfter.bodyNode).toBe(analysisBefore.bodyNode);

    const kbNotesAfter = findSection(after, "KB Notes");
    expect(kbNotesAfter.headingNode).toBe(kbNotesBefore.headingNode);
    expect(kbNotesAfter.bodyNode).toBe(kbNotesBefore.bodyNode);

    // The targeted section reflects the new content.
    expect(bodyText(after, "Notebook Narrative")).toBe("Brand new narrative text.");
  });

  it("notebook_wiki update with both exec_summary and narrative replaces both, KB Notes untouched", () => {
    const doc = buildDoc(FULL_SCAFFOLD_MARKDOWN);
    const before = doc.content as JSONContent[];
    const kbNotesBefore = findSection(before, "KB Notes");

    const updates: SectionUpdate[] = [
      { heading: "Executive Summary", markdown: "New exec summary." },
      { heading: "Notebook Narrative", markdown: "New narrative body." },
    ];
    const { doc: result, appended } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    expect(appended).toEqual([]);
    expect(bodyText(after, "Executive Summary")).toBe("New exec summary.");
    expect(bodyText(after, "Notebook Narrative")).toBe("New narrative body.");

    const kbNotesAfter = findSection(after, "KB Notes");
    expect(kbNotesAfter.headingNode).toBe(kbNotesBefore.headingNode);
    expect(kbNotesAfter.bodyNode).toBe(kbNotesBefore.bodyNode);
  });

  it("omitting exec_summary leaves the existing Executive Summary section untouched", () => {
    const doc = buildDoc(FULL_SCAFFOLD_MARKDOWN);
    const before = doc.content as JSONContent[];
    const execBefore = findSection(before, "Executive Summary");

    // Route-level behavior: only push a SectionUpdate for Executive Summary
    // when exec_summary was actually provided. Simulate that here directly.
    const updates: SectionUpdate[] = [
      { heading: "Notebook Narrative", markdown: "Only the narrative changed." },
    ];
    const { doc: result } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    const execAfter = findSection(after, "Executive Summary");
    expect(execAfter.headingNode).toBe(execBefore.headingNode);
    expect(execAfter.bodyNode).toBe(execBefore.bodyNode);
    expect(bodyText(after, "Executive Summary")).toBe("Old summary.");
  });

  it("appends the section in the correct fixed position when its heading is absent (fresh scaffold, AC3)", () => {
    const doc = buildDoc(
      ["# EXP-2: Fresh", "", "## KB Notes", "", "Nothing yet.", ""].join("\n")
    );

    const updates: SectionUpdate[] = [
      { heading: "ExpTube Analysis", markdown: "First-ever analysis content." },
    ];
    const { doc: result, appended } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    expect(appended).toEqual(["ExpTube Analysis"]);
    expect(bodyText(after, "ExpTube Analysis")).toBe("First-ever analysis content.");

    // Must land BEFORE KB Notes (fixed order), never after.
    expect(headingIndex(after, "ExpTube Analysis")).toBeLessThan(
      headingIndex(after, "KB Notes")
    );

    // KB Notes itself must be untouched.
    const kbNotesBefore = findSection(doc.content as JSONContent[], "KB Notes");
    const kbNotesAfter = findSection(after, "KB Notes");
    expect(kbNotesAfter.headingNode).toBe(kbNotesBefore.headingNode);
    expect(kbNotesAfter.bodyNode).toBe(kbNotesBefore.bodyNode);
  });

  it("maintains fixed order across multiple appended sections regardless of call order", () => {
    const doc = buildDoc(
      ["# EXP-3: Fresh", "", "## KB Notes", "", "Nothing yet.", ""].join("\n")
    );

    // Deliberately request Notebook Narrative BEFORE Executive Summary —
    // the fixed order must still win in the resulting document.
    const updates: SectionUpdate[] = [
      { heading: "Notebook Narrative", markdown: "Narrative body." },
      { heading: "Executive Summary", markdown: "Summary body." },
    ];
    const { doc: result, appended } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    expect(appended.sort()).toEqual(["Executive Summary", "Notebook Narrative"].sort());

    const order = [
      headingIndex(after, "Executive Summary"),
      headingIndex(after, "Notebook Narrative"),
      headingIndex(after, "KB Notes"),
    ];
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it("falls back to appending (no throw) when an expected heading was renamed/deleted", () => {
    const doc = buildDoc(
      [
        "# EXP-4: Renamed",
        "",
        "## My Custom Notes",
        "",
        "The user renamed the Notebook Narrative heading.",
        "",
        "## KB Notes",
        "",
        "User notes.",
        "",
      ].join("\n")
    );
    const before = doc.content as JSONContent[];
    const customBefore = findSection(before, "My Custom Notes");

    const updates: SectionUpdate[] = [
      { heading: "Notebook Narrative", markdown: "New narrative after rename." },
    ];

    expect(() => applySectionUpdates(doc, updates)).not.toThrow();

    const { doc: result, appended } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    expect(appended).toEqual(["Notebook Narrative"]);
    expect(bodyText(after, "Notebook Narrative")).toBe("New narrative after rename.");

    // The renamed heading and its content survive untouched.
    const customAfter = findSection(after, "My Custom Notes");
    expect(customAfter.headingNode).toBe(customBefore.headingNode);
    expect(customAfter.bodyNode).toBe(customBefore.bodyNode);
  });

  it("strips a redundant leading heading line from the incoming markdown", () => {
    const doc = buildDoc(FULL_SCAFFOLD_MARKDOWN);
    const updates: SectionUpdate[] = [
      {
        heading: "Notebook Narrative",
        markdown: "## Notebook Narrative\n\nBody sent with its own heading line.",
      },
    ];
    const { doc: result } = applySectionUpdates(doc, updates);
    const after = result.content as JSONContent[];

    // Exactly one "Notebook Narrative" heading — the redundant line must not
    // produce a duplicate.
    const occurrences = after.filter(
      (n) => n.type === "heading" && textOf(n) === "Notebook Narrative"
    );
    expect(occurrences).toHaveLength(1);
    expect(bodyText(after, "Notebook Narrative")).toBe(
      "Body sent with its own heading line."
    );
  });

  it("FIXED_SECTION_HEADINGS matches the documented fixed order", () => {
    expect(FIXED_SECTION_HEADINGS).toEqual([
      "Executive Summary",
      "Notebook Narrative",
      "ExpTube Analysis",
      "KB Notes",
    ]);
  });
});

describe("contentMerge.isStaleUpdate", () => {
  it("rejects an update older than the last-applied timestamp", () => {
    expect(
      isStaleUpdate("2026-07-04T10:00:00Z", "2026-07-04T12:00:00Z")
    ).toBe(true);
  });

  it("rejects an update exactly equal to the last-applied timestamp (duplicate retry)", () => {
    expect(
      isStaleUpdate("2026-07-04T12:00:00Z", "2026-07-04T12:00:00Z")
    ).toBe(true);
  });

  it("accepts an update newer than the last-applied timestamp", () => {
    expect(
      isStaleUpdate("2026-07-04T13:00:00Z", "2026-07-04T12:00:00Z")
    ).toBe(false);
  });

  it("accepts any update when there is no prior state", () => {
    expect(isStaleUpdate("2026-07-04T10:00:00Z", null)).toBe(false);
    expect(isStaleUpdate("2026-07-04T10:00:00Z", undefined)).toBe(false);
  });

  it("accepts a Date instance for lastAppliedAt (as read back from Prisma)", () => {
    const last = new Date("2026-07-04T12:00:00Z");
    expect(isStaleUpdate("2026-07-04T11:00:00Z", last)).toBe(true);
    expect(isStaleUpdate("2026-07-04T13:00:00Z", last)).toBe(false);
  });

  it("out-of-order sequence: second, older generated_at is rejected after a first apply", () => {
    // Simulates the DLQ out-of-order-delivery scenario (AC4): the newer
    // update is applied first (becoming lastAppliedAt), then a late retry of
    // an older update arrives and must be rejected.
    const firstAppliedAt = "2026-07-04T12:00:00Z";
    const lateRetryGeneratedAt = "2026-07-04T11:30:00Z";

    expect(isStaleUpdate(firstAppliedAt, null)).toBe(false); // first apply always proceeds
    expect(isStaleUpdate(lateRetryGeneratedAt, firstAppliedAt)).toBe(true); // late retry rejected
  });
});
