/**
 * Shared content extraction utilities for KB search.
 * Extracted from kbQuery.ts for reuse by ragSearch and agenticSearch.
 */

import type { QueryIntent } from "@/lib/agent/kbQuery";

/**
 * Extract a named section from markdown by heading.
 * The sectionName is a regex pattern matched against heading text.
 */
export function extractSection(markdown: string, sectionName: string): string {
  const lines = markdown.split("\n");
  let capturing = false;
  const captured: string[] = [];
  const pattern = new RegExp(`^#{2,3}\\s+.*${sectionName}`, "i");

  for (const line of lines) {
    if (pattern.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^#{2,3}\s+/.test(line)) break;
      captured.push(line);
    }
  }

  return captured.join("\n").trim();
}

/**
 * Truncate text to maxLen, avoiding mid-sentence cuts when possible.
 */
export function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // Try to break at a sentence boundary
  const truncated = text.slice(0, maxLen);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf(".\n"),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? ")
  );

  if (lastSentenceEnd > maxLen * 0.6) {
    return truncated.slice(0, lastSentenceEnd + 1);
  }

  return truncated.slice(0, maxLen - 3) + "...";
}

/**
 * Extract intent-relevant content from a page's markdown.
 */
export function extractRelevantContent(
  markdown: string,
  oneLiner: string | null,
  intent: QueryIntent,
  maxLen: number = 300
): string {
  switch (intent) {
    case "safety": {
      const safety =
        extractSection(markdown, "Safety|Hazard") ||
        extractSection(markdown, "Handling") ||
        extractSection(markdown, "Institutional Knowledge");
      if (safety) return smartTruncate(safety, maxLen);
      break;
    }
    case "properties": {
      const props =
        extractSection(markdown, "Properties") ||
        extractSection(markdown, "Practical Usage");
      if (props) return smartTruncate(props, maxLen);
      break;
    }
    case "procedure": {
      const proc =
        extractSection(markdown, "Procedure|Steps|Protocol") ||
        extractSection(markdown, "Setup|Preparation");
      if (proc) return smartTruncate(proc, maxLen);
      break;
    }
    case "expertise": {
      const exp =
        extractSection(markdown, "Expertise|Specialization") ||
        extractSection(markdown, "Key Contributions");
      if (exp) return smartTruncate(exp, maxLen);
      break;
    }
    case "reaction": {
      const rx =
        extractSection(markdown, "Key Learnings|What Works") ||
        extractSection(markdown, "Institutional Experience");
      if (rx) return smartTruncate(rx, maxLen);
      break;
    }
    case "related": {
      const rel =
        extractSection(markdown, "Results|Observations") ||
        extractSection(markdown, "What Worked|Practical Notes");
      if (rel) return smartTruncate(rel, maxLen);
      break;
    }
  }

  // Fallback: use oneLiner or first paragraph
  if (oneLiner) return oneLiner;

  const firstPara = markdown
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"))
    .slice(0, 3)
    .join(" ")
    .trim();

  return smartTruncate(firstPara, maxLen);
}
