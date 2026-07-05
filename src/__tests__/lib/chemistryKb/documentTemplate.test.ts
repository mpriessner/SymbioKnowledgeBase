import { describe, it, expect } from "vitest";
import { renderDocumentTemplate } from "@/lib/chemistryKb/documentTemplate";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { extractPlainText } from "@/lib/search/indexer";
import type { TipTapDocument } from "@/lib/wikilinks/types";

describe("renderDocumentTemplate (a71-08)", () => {
  it("renders the standard sections for an upload", () => {
    const md = renderDocumentTemplate({
      title: "Safety Data Sheet",
      source: "upload",
      sourceDetail: "sds-toluene.pdf",
      addedBy: "user-123",
      addedAt: new Date("2026-07-05T00:00:00.000Z"),
      tags: ["safety", "toluene"],
    });

    expect(md).toContain("# Safety Data Sheet");
    expect(md).toContain("**Source:** upload: sds-toluene.pdf");
    expect(md).toContain("**Added by:** user-123");
    expect(md).toContain("**Added:** 2026-07-05T00:00:00.000Z");
    expect(md).toContain("**Tags:** safety, toluene");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Notes");
  });

  it("renders a link source line for source: url", () => {
    const md = renderDocumentTemplate({
      title: "Vendor Spec Sheet",
      source: "url",
      sourceDetail: "https://vendor.example.com/spec.pdf",
      addedBy: "user-1",
    });

    expect(md).toContain("**Source:** link: https://vendor.example.com/spec.pdf");
  });

  it("renders a drive source line for source: drive (a71-12 reuse)", () => {
    const md = renderDocumentTemplate({
      title: "Shared Protocol",
      source: "drive",
      sourceDetail: "1a2b3c-drive-file-id",
      addedBy: "user-1",
    });

    expect(md).toContain("**Source:** drive: 1a2b3c-drive-file-id");
  });

  it("omits the tags line content when no tags are given", () => {
    const md = renderDocumentTemplate({
      title: "Untitled Doc",
      source: "upload",
      sourceDetail: "file.pdf",
      addedBy: "user-1",
    });
    expect(md).toContain("**Tags:** ");
  });

  it("appends a Snapshot section only when a snapshot is provided", () => {
    const withoutSnapshot = renderDocumentTemplate({
      title: "Link only",
      source: "url",
      sourceDetail: "https://example.com/a",
      addedBy: "user-1",
    });
    expect(withoutSnapshot).not.toContain("## Snapshot");

    const withSnapshot = renderDocumentTemplate({
      title: "Link with snapshot",
      source: "url",
      sourceDetail: "https://example.com/b",
      addedBy: "user-1",
      snapshot: "Fetched page text content.",
    });
    expect(withSnapshot).toContain("## Snapshot");
    expect(withSnapshot).toContain("Fetched page text content.");
  });

  it("produces a body whose plain text is searchable via the standard extraction pipeline", () => {
    // Regression guard for the search-indexing requirement (Round 2 finding
    // 1): whatever creates the document body must produce plainText that
    // contains the template's real content, not just the title.
    const md = renderDocumentTemplate({
      title: "Reagent Handling Guide",
      source: "url",
      sourceDetail: "https://example.com/guide",
      addedBy: "user-1",
      snapshot: "Store away from heat and open flame.",
    });
    const tiptap = markdownToTiptap(md) as TipTapDocument;
    const plainText = extractPlainText(tiptap);

    expect(plainText).toContain("Reagent Handling Guide");
    expect(plainText).toContain("Store away from heat and open flame");
  });
});
