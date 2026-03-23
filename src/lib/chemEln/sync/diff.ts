export interface DryRunPageCreate {
  type: string;
  name: string;
  matchTag: string;
}

export interface DryRunPageUpdate {
  type: string;
  name: string;
  matchTag: string;
  diff: string;
}

export interface DryRunPageSkip {
  type: string;
  name: string;
  matchTag: string;
}

export interface DryRunReport {
  pagesToCreate: DryRunPageCreate[];
  pagesToUpdate: DryRunPageUpdate[];
  pagesToSkip: DryRunPageSkip[];
  summary: {
    toCreate: number;
    toUpdate: number;
    toSkip: number;
  };
}

export function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const hunks = computeHunks(oldLines, newLines);
  if (hunks.length === 0) {
    return "";
  }

  const output: string[] = [];
  output.push("--- old");
  output.push("+++ new");

  for (const hunk of hunks) {
    output.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    );
    for (const line of hunk.lines) {
      output.push(line);
    }
  }

  return output.join("\n");
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

function computeHunks(oldLines: string[], newLines: string[]): Hunk[] {
  const lcs = computeLCS(oldLines, newLines);

  const changes: Array<{ type: "keep" | "add" | "remove"; line: string }> = [];

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (
      li < lcs.length &&
      oi < oldLines.length &&
      ni < newLines.length &&
      oldLines[oi] === lcs[li] &&
      newLines[ni] === lcs[li]
    ) {
      changes.push({ type: "keep", line: oldLines[oi] });
      oi++;
      ni++;
      li++;
    } else if (
      li < lcs.length &&
      ni < newLines.length &&
      newLines[ni] === lcs[li] &&
      (oi >= oldLines.length || oldLines[oi] !== lcs[li])
    ) {
      changes.push({ type: "remove", line: oldLines[oi] });
      oi++;
    } else if (
      li < lcs.length &&
      oi < oldLines.length &&
      oldLines[oi] === lcs[li] &&
      (ni >= newLines.length || newLines[ni] !== lcs[li])
    ) {
      changes.push({ type: "add", line: newLines[ni] });
      ni++;
    } else {
      if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
        changes.push({ type: "remove", line: oldLines[oi] });
        oi++;
      } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
        changes.push({ type: "add", line: newLines[ni] });
        ni++;
      }
    }
  }

  const CONTEXT = 3;
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;
  let oldPos = 1;
  let newPos = 1;
  let lastChangeIdx = -CONTEXT - 1;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const isChange = change.type !== "keep";

    if (isChange) {
      if (currentHunk === null || i - lastChangeIdx > CONTEXT * 2) {
        if (currentHunk !== null) {
          // Add trailing context to previous hunk
          const trailStart = lastChangeIdx + 1;
          const trailEnd = Math.min(trailStart + CONTEXT, i);
          // Recalculate from tracked positions
          hunks.push(currentHunk);
        }

        currentHunk = {
          oldStart: Math.max(1, oldPos - countBefore(changes, i, CONTEXT)),
          newStart: Math.max(1, newPos - countBefore(changes, i, CONTEXT)),
          oldCount: 0,
          newCount: 0,
          lines: [],
        };

        // Add leading context
        const contextStart = Math.max(0, i - CONTEXT);
        for (let c = contextStart; c < i; c++) {
          if (changes[c].type === "keep") {
            currentHunk.lines.push(` ${changes[c].line}`);
            currentHunk.oldCount++;
            currentHunk.newCount++;
          }
        }
      }

      lastChangeIdx = i;
    }

    if (currentHunk !== null) {
      if (isChange) {
        if (change.type === "remove") {
          currentHunk.lines.push(`-${change.line}`);
          currentHunk.oldCount++;
        } else {
          currentHunk.lines.push(`+${change.line}`);
          currentHunk.newCount++;
        }
      } else if (i - lastChangeIdx <= CONTEXT) {
        currentHunk.lines.push(` ${change.line}`);
        currentHunk.oldCount++;
        currentHunk.newCount++;
      }
    }

    if (change.type === "keep" || change.type === "remove") oldPos++;
    if (change.type === "keep" || change.type === "add") newPos++;
  }

  if (currentHunk !== null) {
    hunks.push(currentHunk);
  }

  return hunks;
}

function countBefore(
  changes: Array<{ type: string }>,
  index: number,
  count: number,
): number {
  let result = 0;
  for (let i = index - 1; i >= 0 && result < count; i--) {
    if (changes[i].type === "keep") {
      result++;
    } else {
      break;
    }
  }
  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // For very large inputs, use a simpler approach
  if (m * n > 10_000_000) {
    return simpleLCS(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function simpleLCS(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter((line) => bSet.has(line));
}

export function formatDryRunReport(
  report: DryRunReport,
  verbose: boolean = false,
): string {
  const lines: string[] = [
    "=".repeat(39),
    "  ChemELN -> SKB Sync Preview (DRY RUN)",
    "=".repeat(39),
    "",
    `  To Create: ${report.summary.toCreate} pages`,
    `  To Update: ${report.summary.toUpdate} pages (content changed)`,
    `  To Skip:   ${report.summary.toSkip} pages (unchanged)`,
    "",
  ];

  if (report.pagesToCreate.length > 0) {
    lines.push("  === Pages To Create ===");
    for (const page of report.pagesToCreate) {
      lines.push(`  - [${page.type}] ${page.name}`);
    }
    lines.push("");
  }

  if (report.pagesToUpdate.length > 0) {
    lines.push("  === Pages To Update ===");
    for (const page of report.pagesToUpdate) {
      lines.push(`  - [${page.type}] ${page.name}`);
      if (verbose && page.diff) {
        const indented = page.diff
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n");
        lines.push(indented);
      }
    }
    lines.push("");
  }

  lines.push("=".repeat(39));
  return lines.join("\n");
}
