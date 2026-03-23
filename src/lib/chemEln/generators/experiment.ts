import type { ExperimentData } from "../types";
import {
  buildFrontmatter,
  buildTable,
  chemicalWikilink,
  researcherWikilink,
  reactionTypeWikilink,
  experimentWikilink,
  computeQualityScore,
} from "./utils";

export interface ExperimentPageContext {
  researcherName: string;
  reactionType: string;
  substrateClass?: string;
  scale?: string;
  relatedExperiments?: Array<{ id: string; title: string }>;
}

export function generateExperimentPage(
  data: ExperimentData,
  context: ExperimentPageContext
): string {
  const sections: string[] = [];
  const qualityScore = computeQualityScore(data);

  // 1. YAML Frontmatter
  const tags: string[] = [
    `eln:${data.id}`,
    `reaction:${context.reactionType.toLowerCase().replace(/\s+/g, "-")}`,
    `researcher:${context.researcherName.toLowerCase().replace(/\s+/g, "-")}`,
    `quality:${qualityScore}`,
  ];
  if (context.substrateClass) {
    tags.push(
      `substrate-class:${context.substrateClass.toLowerCase().replace(/\s+/g, "-")}`
    );
  }
  if (context.scale) {
    tags.push(`scale:${context.scale}`);
  }

  const frontmatter = buildFrontmatter({
    title: `${data.id}: ${data.title}`,
    icon: "\u{1F9EA}",
    "page-type": "experiment",
    tags,
    "one-liner": generateOneLiner(data),
    created: data.createdAt,
    updated: new Date().toISOString(),
  });
  sections.push(frontmatter);

  // 2. Title & Overview
  sections.push(`# ${data.id}: ${data.title}\n`);

  if (data.objective) {
    sections.push(`${data.objective}\n`);
  }

  sections.push(
    `**Reaction Type:** ${reactionTypeWikilink(context.reactionType)}`
  );
  sections.push(
    `**Researcher:** ${researcherWikilink(context.researcherName)}`
  );
  sections.push(
    `**Date:** ${new Date(data.createdAt).toLocaleDateString()}`
  );
  sections.push(
    `**Quality Score:** ${"\u2605".repeat(qualityScore)}${"\u2606".repeat(5 - qualityScore)} (${qualityScore}/5)\n`
  );

  // 3. Conditions Table
  if (data.procedureMetadata) {
    const meta = data.procedureMetadata;
    const conditionRows: string[][] = [];
    if (meta.temperature) conditionRows.push(["Temperature", meta.temperature]);
    if (meta.pressure) conditionRows.push(["Pressure", meta.pressure]);
    if (meta.time) conditionRows.push(["Reaction Time", meta.time]);
    if (meta.solvent) {
      conditionRows.push([
        "Solvent",
        chemicalWikilink({
          id: "",
          name: meta.solvent,
          casNumber: null,
          molecularFormula: null,
        }),
      ]);
    }
    if (meta.atmosphere) conditionRows.push(["Atmosphere", meta.atmosphere]);

    if (conditionRows.length > 0) {
      sections.push("## Conditions\n");
      sections.push(buildTable(["Parameter", "Value"], conditionRows));
      sections.push("");
    }
  }

  // 4. Reagents
  if (data.reagents.length > 0) {
    sections.push("## Reagents\n");
    for (const reagent of data.reagents) {
      const rolePart = reagent.role ? ` (${reagent.role})` : "";
      sections.push(
        `- ${chemicalWikilink(reagent.chemical)}${rolePart} \u2014 ${reagent.amount} ${reagent.unit}`
      );
    }
    sections.push("");
  }

  // 5. Products
  if (data.products.length > 0) {
    sections.push("## Products\n");
    for (const product of data.products) {
      const yieldStr =
        product.yield !== null ? ` \u2014 ${product.yield}% yield` : "";
      sections.push(`- ${chemicalWikilink(product.chemical)}${yieldStr}`);
    }
    sections.push("");
  }

  // 6. Procedure Steps (actual, falling back to planned)
  const procedure = data.actualProcedure ?? data.plannedProcedure;
  if (procedure && procedure.length > 0) {
    sections.push("## Procedure\n");
    for (const step of procedure) {
      let stepLine = `${step.stepNumber}. ${step.action}`;
      const details: string[] = [];
      if (step.duration) details.push(step.duration);
      if (step.temperature) details.push(step.temperature);
      if (details.length > 0) {
        stepLine += ` (${details.join(", ")})`;
      }
      sections.push(stepLine);
    }
    sections.push("");
  }

  // 7. Practical Notes
  if (data.practicalNotes && data.practicalNotes.length > 0) {
    sections.push("## Practical Notes\n");
    for (const note of data.practicalNotes) {
      const typeLabel =
        note.type.charAt(0).toUpperCase() + note.type.slice(1);
      sections.push(`> **${typeLabel}:** ${note.content}`);
      if (note.timestamp) {
        sections.push(
          `> *\u2014 ${context.researcherName}, ${note.timestamp}*`
        );
      }
      sections.push("");
    }
  }

  // 8. Related Experiments
  const related = data.relatedExperiments ?? context.relatedExperiments;
  if (related && related.length > 0) {
    sections.push("## Related Experiments\n");
    for (const exp of related) {
      sections.push(`- ${experimentWikilink(exp.id, exp.title)}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function generateOneLiner(data: ExperimentData): string {
  if (data.objective) {
    return data.objective;
  }
  return data.title;
}
