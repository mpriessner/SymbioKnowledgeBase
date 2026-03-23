import { describe, it, expect } from "vitest";
import {
  generateDiff,
  formatDryRunReport,
  type DryRunReport,
} from "@/lib/chemEln/sync/diff";

describe("generateDiff", () => {
  it("should return empty string for identical content", () => {
    const content = "line 1\nline 2\nline 3";
    expect(generateDiff(content, content)).toBe("");
  });

  it("should detect additions", () => {
    const oldContent = "line 1\nline 2\nline 3";
    const newContent = "line 1\nline 2\nline 2.5\nline 3";
    const diff = generateDiff(oldContent, newContent);

    expect(diff).toContain("+line 2.5");
    expect(diff).toContain("---");
    expect(diff).toContain("+++");
    expect(diff).toContain("@@");
  });

  it("should detect deletions", () => {
    const oldContent = "line 1\nline 2\nline 3";
    const newContent = "line 1\nline 3";
    const diff = generateDiff(oldContent, newContent);

    expect(diff).toContain("-line 2");
  });

  it("should detect modifications (shown as delete + add)", () => {
    const oldContent = "line 1\nold line\nline 3";
    const newContent = "line 1\nnew line\nline 3";
    const diff = generateDiff(oldContent, newContent);

    expect(diff).toContain("-old line");
    expect(diff).toContain("+new line");
  });

  it("should handle completely different content", () => {
    const oldContent = "alpha\nbeta\ngamma";
    const newContent = "delta\nepsilon\nzeta";
    const diff = generateDiff(oldContent, newContent);

    expect(diff).toContain("-alpha");
    expect(diff).toContain("+delta");
    expect(diff.length).toBeGreaterThan(0);
  });

  it("should handle empty old content (all additions)", () => {
    const diff = generateDiff("", "line 1\nline 2");
    expect(diff).toContain("+line 1");
    expect(diff).toContain("+line 2");
  });

  it("should handle empty new content (all deletions)", () => {
    const diff = generateDiff("line 1\nline 2", "");
    expect(diff).toContain("-line 1");
    expect(diff).toContain("-line 2");
  });

  it("should include unified diff headers", () => {
    const diff = generateDiff("old", "new");
    expect(diff).toContain("--- old");
    expect(diff).toContain("+++ new");
  });
});

describe("formatDryRunReport", () => {
  it("should format a report with creates, updates, and skips", () => {
    const report: DryRunReport = {
      pagesToCreate: [
        { type: "experiment", name: "EXP-001", matchTag: "eln:EXP-001" },
        { type: "chemical", name: "THF", matchTag: "cas:109-99-9" },
      ],
      pagesToUpdate: [
        {
          type: "chemical",
          name: "Palladium Acetate",
          matchTag: "cas:3375-31-3",
          diff: "-old line\n+new line",
        },
      ],
      pagesToSkip: [
        { type: "researcher", name: "Dr. Smith", matchTag: "researcher:dr-smith" },
      ],
      summary: { toCreate: 2, toUpdate: 1, toSkip: 1 },
    };

    const output = formatDryRunReport(report);

    expect(output).toContain("DRY RUN");
    expect(output).toContain("To Create: 2 pages");
    expect(output).toContain("To Update: 1 pages");
    expect(output).toContain("To Skip:   1 pages");
    expect(output).toContain("[experiment] EXP-001");
    expect(output).toContain("[chemical] THF");
    expect(output).toContain("[chemical] Palladium Acetate");
  });

  it("should show diffs in verbose mode", () => {
    const report: DryRunReport = {
      pagesToCreate: [],
      pagesToUpdate: [
        {
          type: "chemical",
          name: "THF",
          matchTag: "cas:109-99-9",
          diff: "-old\n+new",
        },
      ],
      pagesToSkip: [],
      summary: { toCreate: 0, toUpdate: 1, toSkip: 0 },
    };

    const output = formatDryRunReport(report, true);
    expect(output).toContain("-old");
    expect(output).toContain("+new");
  });

  it("should hide diffs in non-verbose mode", () => {
    const report: DryRunReport = {
      pagesToCreate: [],
      pagesToUpdate: [
        {
          type: "chemical",
          name: "THF",
          matchTag: "cas:109-99-9",
          diff: "-old\n+new",
        },
      ],
      pagesToSkip: [],
      summary: { toCreate: 0, toUpdate: 1, toSkip: 0 },
    };

    const output = formatDryRunReport(report, false);
    expect(output).toContain("[chemical] THF");
    expect(output).not.toContain("-old");
  });

  it("should handle empty report", () => {
    const report: DryRunReport = {
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToSkip: [],
      summary: { toCreate: 0, toUpdate: 0, toSkip: 0 },
    };

    const output = formatDryRunReport(report);
    expect(output).toContain("To Create: 0 pages");
    expect(output).toContain("To Update: 0 pages");
    expect(output).toContain("To Skip:   0 pages");
  });
});
