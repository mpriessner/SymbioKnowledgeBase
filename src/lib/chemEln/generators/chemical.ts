import type { ChemicalData, ChemicalUsage } from "../types";
import { buildFrontmatter, experimentWikilink } from "./utils";

export function generateChemicalPage(
  data: ChemicalData,
  usages: ChemicalUsage[]
): string {
  const sections: string[] = [];

  const tags: string[] = ["chemical"];
  if (data.casNumber) tags.push(`cas:${data.casNumber}`);

  sections.push(
    buildFrontmatter({
      title: data.name,
      icon: "\u2697\uFE0F",
      "page-type": "chemical",
      tags,
      "one-liner": `${data.name}${data.casNumber ? ` (CAS: ${data.casNumber})` : ""}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    })
  );

  sections.push(`# ${data.name}\n`);

  // Properties
  const props: string[] = [];
  if (data.casNumber) props.push(`- **CAS Number:** ${data.casNumber}`);
  if (data.molecularFormula)
    props.push(`- **Molecular Formula:** ${data.molecularFormula}`);
  if (data.molecularWeight != null)
    props.push(`- **Molecular Weight:** ${data.molecularWeight} g/mol`);
  if (data.synonyms && data.synonyms.length > 0)
    props.push(`- **Synonyms:** ${data.synonyms.join(", ")}`);

  if (props.length > 0) {
    sections.push("## Properties\n");
    sections.push(props.join("\n"));
    sections.push("");
  }

  // Used In (grouped by role)
  if (usages.length > 0) {
    sections.push("## Used In\n");
    const grouped: Record<string, ChemicalUsage[]> = {};
    for (const usage of usages) {
      (grouped[usage.role] ??= []).push(usage);
    }

    for (const [role, items] of Object.entries(grouped)) {
      sections.push(
        `### As ${role.charAt(0).toUpperCase() + role.slice(1)}\n`
      );
      for (const item of items) {
        const yieldStr = item.yield != null ? ` \u2192 ${item.yield}% yield` : "";
        sections.push(
          `- ${experimentWikilink(item.experimentId, item.experimentTitle)} \u2014 ${item.amount} ${item.unit}${yieldStr}`
        );
      }
      sections.push("");
    }
  }

  return sections.join("\n");
}
