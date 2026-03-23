import type { ReactionTypeAggregation } from "../types";
import {
  buildFrontmatter,
  buildTable,
  researcherWikilink,
  experimentWikilink,
} from "./utils";

export function generateReactionTypePage(
  data: ReactionTypeAggregation
): string {
  const sections: string[] = [];
  const tag = `reaction:${data.name.toLowerCase().replace(/\s+/g, "-")}`;

  sections.push(
    buildFrontmatter({
      title: data.name,
      icon: "\u{1F52C}",
      "page-type": "reaction-type",
      tags: [tag],
      "one-liner": `${data.experimentCount} experiments, ${data.avgYield.toFixed(0)}% avg yield, ${data.researcherCount} researchers`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    })
  );

  sections.push(`# ${data.name}\n`);

  // Institutional Experience
  sections.push("## Institutional Experience\n");
  sections.push(
    `Our lab has performed **${data.experimentCount} experiments** with this reaction type.`
  );
  sections.push(
    `Average yield: **${data.avgYield.toFixed(1)}%** across ${data.researcherCount} researchers.\n`
  );

  // Key Learnings (ranked by qualityScore)
  if (data.keyLearnings.length > 0) {
    sections.push("## Key Learnings\n");
    const sorted = [...data.keyLearnings].sort(
      (a, b) => b.qualityScore - a.qualityScore
    );
    for (let i = 0; i < sorted.length; i++) {
      const learning = sorted[i];
      sections.push(`${i + 1}. ${learning.content}`);
      sections.push(
        `   *\u2014 ${researcherWikilink(learning.researcherName)}, ${experimentWikilink(learning.experimentId, "")}, ${learning.date}*\n`
      );
    }
  }

  // Common Pitfalls
  if (data.commonPitfalls.length > 0) {
    sections.push("## Common Pitfalls\n");
    for (const pitfall of data.commonPitfalls) {
      sections.push(`- ${pitfall}`);
    }
    sections.push("");
  }

  // Who To Ask
  if (data.topResearchers.length > 0) {
    sections.push("## Who To Ask\n");
    sections.push(
      buildTable(
        ["Researcher", "Experiments", "Avg Yield"],
        data.topResearchers.map((r) => [
          researcherWikilink(r.name),
          String(r.experimentCount),
          `${r.avgYield.toFixed(1)}%`,
        ])
      )
    );
    sections.push("");
  }

  // Recent Experiments
  if (data.experiments.length > 0) {
    sections.push("## Recent Experiments\n");
    const recent = data.experiments.slice(0, 15);
    for (const exp of recent) {
      sections.push(
        `- ${experimentWikilink(exp.id, exp.title)} \u2014 ${exp.yield}% yield, ${researcherWikilink(exp.researcher)}, ${exp.date}`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}
