import type { ChemicalRef, ExperimentData } from "../types";

export function chemicalWikilink(chemical: ChemicalRef): string {
  return `[[${toTitleCase(chemical.name)}]]`;
}

export function researcherWikilink(name: string): string {
  return `[[${toTitleCase(name)}]]`;
}

export function reactionTypeWikilink(type: string): string {
  return `[[${toTitleCase(type)}]]`;
}

export function experimentWikilink(id: string, title: string): string {
  return `[[${id}: ${title}]]`;
}

export function toTitleCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function buildFrontmatter(
  metadata: Record<string, unknown>
): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else if (typeof value === "string" && value.includes(":")) {
      lines.push(`${key}: "${value}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export function buildTable(
  headers: string[],
  rows: string[][]
): string {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const dataLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separatorLine, ...dataLines].join("\n");
}

export function computeQualityScore(data: ExperimentData): number {
  let score = 3;

  const maxYield = Math.max(
    ...(data.products ?? []).map((p) => p.yield ?? 0),
    0
  );
  if (maxYield >= 90) score = 5;
  else if (maxYield >= 70) score = 4;
  else if (maxYield >= 50) score = 3;
  else if (maxYield >= 30) score = 2;
  else if (maxYield > 0) score = 1;

  if (!data.actualProcedure || data.actualProcedure.length === 0) {
    score = Math.max(score - 1, 1);
  }
  if (data.reagents.length === 0) {
    score = Math.max(score - 1, 1);
  }

  return score;
}
