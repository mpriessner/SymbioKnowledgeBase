import type { ResearcherProfileData } from "../types";
import {
  buildFrontmatter,
  buildTable,
  reactionTypeWikilink,
  experimentWikilink,
} from "./utils";

export function generateResearcherPage(data: ResearcherProfileData): string {
  const sections: string[] = [];
  const tag = `researcher:${data.name.toLowerCase().replace(/\s+/g, "-")}`;

  sections.push(
    buildFrontmatter({
      title: data.name,
      icon: "\u{1F469}\u200D\u{1F52C}",
      "page-type": "researcher",
      tags: [tag],
      "one-liner": `${data.totalExperiments} experiments across ${data.topReactionTypes.length} reaction types`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    })
  );

  sections.push(`# ${data.name}\n`);

  // Expertise Areas
  if (data.topReactionTypes.length > 0) {
    sections.push("## Expertise Areas\n");
    sections.push(
      buildTable(
        ["Reaction Type", "Experiments", "Avg Yield"],
        data.topReactionTypes.map((rt) => [
          reactionTypeWikilink(rt.name),
          String(rt.count),
          `${rt.avgYield.toFixed(1)}%`,
        ])
      )
    );
    sections.push("");
  }

  // Recent Experiments
  if (data.recentExperiments.length > 0) {
    sections.push("## Recent Experiments\n");
    for (const exp of data.recentExperiments.slice(0, 10)) {
      sections.push(
        `- ${experimentWikilink(exp.id, exp.title)} \u2014 ${reactionTypeWikilink(exp.reactionType)}, ${exp.date}`
      );
    }
    sections.push("");
  }

  // Key Contributions
  if (data.keyContributions.length > 0) {
    sections.push("## Key Contributions\n");
    for (const contribution of data.keyContributions) {
      sections.push(`- ${contribution}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
