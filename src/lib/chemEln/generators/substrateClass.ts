import type { SubstrateClassAggregation } from "../types";
import {
  buildFrontmatter,
  researcherWikilink,
  experimentWikilink,
} from "./utils";

export function generateSubstrateClassPage(
  data: SubstrateClassAggregation
): string {
  const sections: string[] = [];
  const tag = `substrate-class:${data.name.toLowerCase().replace(/\s+/g, "-")}`;

  sections.push(
    buildFrontmatter({
      title: data.name,
      icon: "\u{1F9EC}",
      "page-type": "substrate-class",
      tags: [tag],
      "one-liner": `Substrate class with ${data.whatWorked.length} successful approaches`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    })
  );

  sections.push(`# ${data.name}\n`);

  // Known Challenges
  if (data.challenges.length > 0) {
    sections.push("## Known Challenges\n");
    for (const challenge of data.challenges) {
      sections.push(`- ${challenge}`);
    }
    sections.push("");
  }

  // What Worked
  if (data.whatWorked.length > 0) {
    sections.push("## What Worked\n");
    for (const item of data.whatWorked) {
      sections.push(
        `- ${item.description} \u2014 ${experimentWikilink(item.experimentId, item.experimentTitle)}`
      );
    }
    sections.push("");
  }

  // Who Has Experience
  if (data.researchers.length > 0) {
    sections.push("## Who Has Experience\n");
    for (const researcher of data.researchers) {
      sections.push(
        `- ${researcherWikilink(researcher.name)} \u2014 ${researcher.experimentCount} experiments`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}
