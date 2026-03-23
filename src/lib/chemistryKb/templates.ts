import type {
  ExperimentStatus,
  ScaleCategory,
} from "./types";

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------

export interface ExperimentReagent {
  name: string;
  amount: string;
  equivalents: string;
  cas?: string;
  notes?: string;
}

export interface ExperimentCondition {
  parameter: string;
  value: string;
  notes?: string;
}

export interface ExperimentResult {
  yield: string;
  purity?: string;
  characterization?: string;
}

export interface RelatedExperiment {
  elnId: string;
  description: string;
  pageTitle?: string;
}

export interface ExperimentPageData {
  title: string;
  elnId: string;
  researcher: string;
  date: string;
  status: ExperimentStatus;
  reactionType?: string;
  substrateClass?: string;
  scaleCategory: ScaleCategory;
  scaleMmol?: string;
  qualityScore: number;
  tags?: string[];
  summary: string;
  conditions: ExperimentCondition[];
  reagents: ExperimentReagent[];
  procedureSetup: string[];
  procedureReaction: string[];
  procedureWorkup: string[];
  procedurePurification: string[];
  results: ExperimentResult;
  productAppearance?: string;
  practicalNotesWorked?: string[];
  practicalNotesChallenges?: string[];
  practicalNotesRecommendations?: string[];
  substrateInsights?: string[];
  relatedExperiments?: RelatedExperiment[];
  relatedChemicals?: string[];
}

export interface ChemicalPageData {
  name: string;
  casNumber: string;
  molecularFormula?: string;
  molecularWeight?: number;
  commonSynonyms?: string[];
  summary: string;
  appearance?: string;
  meltingPoint?: string;
  storageNotes?: string[];
  handlingNotes?: string[];
  institutionalKnowledge?: string[];
  usedInExperiments?: RelatedExperiment[];
  relatedReactionTypes?: string[];
  relatedResearchers?: string[];
}

export interface ReactionTypePageData {
  name: string;
  experimentCount: number;
  avgYield?: number;
  successRate?: string;
  researcherCount: number;
  summary: string;
  whatWorksWell?: string[];
  commonPitfalls?: string[];
  substrateAdvice?: Array<{ substrateClass: string; advice: string }>;
  whoToAsk?: Array<{ researcher: string; expertise: string }>;
  representativeExperiments?: RelatedExperiment[];
  relatedReactionTypes?: string[];
  commonCatalysts?: string[];
}

export interface ResearcherPageData {
  name: string;
  email?: string;
  experimentCount: number;
  primaryExpertise?: string[];
  summary: string;
  expertiseAreas?: Array<{ area: string; description: string }>;
  recentExperiments?: RelatedExperiment[];
  notableResults?: string[];
  institutionalKnowledge?: string[];
  whenToAsk?: string;
}

export interface SubstrateClassPageData {
  name: string;
  experimentCount: number;
  summary: string;
  commonChallenges?: string[];
  successfulStrategies?: string[];
  reactionAdvice?: Array<{ reactionType: string; advice: string }>;
  whoHasExperience?: Array<{ researcher: string; knowledge: string }>;
  representativeExperiments?: RelatedExperiment[];
  relatedSubstrateClasses?: string[];
  commonReactions?: string[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function yamlStringArray(arr: string[], indent = 2): string {
  const pad = " ".repeat(indent);
  return arr.map((v) => `${pad}- "${v}"`).join("\n");
}

function buildTags(tags: string[]): string {
  return tags.map((t) => `  - ${t}`).join("\n");
}

function qualityStars(score: number): string {
  return "\u2B50".repeat(Math.min(5, Math.max(1, score)));
}

function statusDisplay(status: ExperimentStatus): string {
  const map: Record<ExperimentStatus, string> = {
    completed: "Completed",
    "in-progress": "In Progress",
    planned: "Planned",
    failed: "Failed",
    abandoned: "Abandoned",
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Experiment template
// ---------------------------------------------------------------------------

export function generateExperimentPage(data: ExperimentPageData): string {
  const tags = data.tags ?? [];
  if (!tags.some((t) => t.startsWith("eln:"))) tags.push(`eln:${data.elnId}`);
  if (data.reactionType && !tags.some((t) => t.startsWith("reaction:"))) {
    tags.push(`reaction:${data.reactionType.toLowerCase().replace(/\s+/g, "-")}`);
  }
  if (!tags.some((t) => t.startsWith("researcher:"))) {
    const slug = data.researcher.replace(/^Dr\.\s*/i, "").split(/\s+/).pop()?.toLowerCase() ?? "";
    tags.push(`researcher:${slug}`);
  }
  if (data.substrateClass && !tags.some((t) => t.startsWith("substrate-class:"))) {
    tags.push(`substrate-class:${data.substrateClass.toLowerCase().replace(/\s+/g, "-")}`);
  }
  if (!tags.some((t) => t.startsWith("scale:"))) tags.push(`scale:${data.scaleCategory}`);
  if (!tags.some((t) => t.startsWith("quality:"))) tags.push(`quality:${data.qualityScore}`);

  const conditionLines = data.conditions
    .map((c) => `- **${c.parameter}:** ${c.value}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");

  const reagentLines = data.reagents
    .map(
      (r) =>
        `- [[${r.name}]] — ${r.amount}, ${r.equivalents} eq${r.cas ? ` (CAS: ${r.cas})` : ""}${r.notes ? ` — ${r.notes}` : ""}`
    )
    .join("\n");

  const setup = data.procedureSetup.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const reaction = data.procedureReaction.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const workup = data.procedureWorkup.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const purification = data.procedurePurification.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const practicalWorked = (data.practicalNotesWorked ?? []).map((n) => `- ${n}`).join("\n");
  const practicalChallenges = (data.practicalNotesChallenges ?? []).map((n) => `- ${n}`).join("\n");
  const practicalRecs = (data.practicalNotesRecommendations ?? []).map((n) => `- ${n}`).join("\n");
  const subInsights = (data.substrateInsights ?? []).map((n) => `- ${n}`).join("\n");

  const relatedExp = (data.relatedExperiments ?? [])
    .map((e) => `- [[${e.pageTitle ?? e.elnId}]]: ${e.description}`)
    .join("\n");

  const relatedChems = (data.relatedChemicals ?? []).map((c) => `[[${c}]]`).join(", ");

  return `---
title: "${data.title}"
icon: "🧪"
tags:
${buildTags(tags)}
eln_id: "${data.elnId}"
researcher: "${data.researcher}"
date: "${data.date}"
status: "${data.status}"
${data.reactionType ? `reaction_type: "${data.reactionType}"` : ""}
${data.substrateClass ? `substrate_class: "${data.substrateClass}"` : ""}
scale_category: "${data.scaleCategory}"
quality_score: ${data.qualityScore}
---

# ${data.title}

> One-liner summary: ${data.summary}

## Metadata

**Researcher:** [[${data.researcher}]]
**Date:** ${data.date}
${data.reactionType ? `**Reaction Type:** [[${data.reactionType}]]` : ""}
${data.substrateClass ? `**Substrate Class:** [[${data.substrateClass}]]` : ""}
**Scale:** ${data.scaleMmol ?? "N/A"}
**Status:** ${statusDisplay(data.status)}
**Quality Score:** ${qualityStars(data.qualityScore)} (${data.qualityScore}/5)

## Reaction Conditions

${conditionLines}

## Reagents

${reagentLines}

## Procedure

### Setup
${setup}

### Reaction
${reaction}

### Workup
${workup}

### Purification
${purification}

## Results

**Yield:** ${data.results.yield}
${data.results.purity ? `**Purity:** ${data.results.purity}` : ""}
${data.results.characterization ? `**Characterization:** ${data.results.characterization}` : ""}

${data.productAppearance ? `**Appearance:** ${data.productAppearance}` : ""}

## Practical Notes

### What Worked Well
${practicalWorked || "- No notes yet"}

### Challenges Encountered
${practicalChallenges || "- No challenges noted"}

### Recommendations for Next Time
${practicalRecs || "- No recommendations yet"}

### Substrate-Specific Insights
${subInsights || "- No insights yet"}

## Related Experiments

${relatedExp || "- No related experiments yet"}

## Related Pages

${data.reactionType ? `- Reaction Type: [[${data.reactionType}]]` : ""}
${data.substrateClass ? `- Substrate Class: [[${data.substrateClass}]]` : ""}
${relatedChems ? `- Key Chemicals: ${relatedChems}` : ""}
- Researcher: [[${data.researcher}]]
`;
}

// ---------------------------------------------------------------------------
// Chemical template
// ---------------------------------------------------------------------------

export function generateChemicalPage(data: ChemicalPageData): string {
  const tags = ["chemical", `cas:${data.casNumber}`];

  const synonymsYaml =
    data.commonSynonyms && data.commonSynonyms.length > 0
      ? `common_synonyms:\n${yamlStringArray(data.commonSynonyms)}`
      : "";

  const synonymsDisplay =
    data.commonSynonyms && data.commonSynonyms.length > 0
      ? data.commonSynonyms.join(", ")
      : "";

  const storageNotes = (data.storageNotes ?? []).map((n) => `- ${n}`).join("\n");
  const handlingNotes = (data.handlingNotes ?? []).map((n) => `- ${n}`).join("\n");
  const instKnowledge = (data.institutionalKnowledge ?? []).map((n) => `- ${n}`).join("\n");

  const usedIn = (data.usedInExperiments ?? [])
    .map((e) => `- [[${e.pageTitle ?? e.elnId}]]: ${e.description}`)
    .join("\n");

  const relatedRx = (data.relatedReactionTypes ?? []).map((r) => `[[${r}]]`).join(", ");
  const relatedRes = (data.relatedResearchers ?? []).map((r) => `[[${r}]]`).join(", ");

  return `---
title: "${data.name}"
icon: "⚗️"
tags:
${buildTags(tags)}
cas_number: "${data.casNumber}"
${data.molecularWeight != null ? `molecular_weight: ${data.molecularWeight}` : ""}
${synonymsYaml}
---

# ${data.name}

> One-liner: ${data.summary}

## Properties

**CAS Number:** ${data.casNumber}
${data.molecularFormula ? `**Molecular Formula:** ${data.molecularFormula}` : ""}
${data.molecularWeight != null ? `**Molecular Weight:** ${data.molecularWeight} g/mol` : ""}
${synonymsDisplay ? `**Common Synonyms:** ${synonymsDisplay}` : ""}
${data.appearance ? `**Appearance:** ${data.appearance}` : ""}
${data.meltingPoint ? `**Melting Point:** ${data.meltingPoint}` : ""}

## Practical Usage Notes

### Storage
${storageNotes || "- No storage notes yet"}

### Handling
${handlingNotes || "- No handling notes yet"}

### Institutional Knowledge
${instKnowledge || "- No institutional knowledge yet"}

## Used In Experiments

${usedIn || "- No experiments linked yet"}

## Related Pages

${relatedRx ? `- Reaction Types using this chemical: ${relatedRx}` : ""}
${relatedRes ? `- Who has experience: ${relatedRes}` : ""}
`;
}

// ---------------------------------------------------------------------------
// ReactionType template
// ---------------------------------------------------------------------------

export function generateReactionTypePage(data: ReactionTypePageData): string {
  const tags = ["reaction-type"];

  const whatWorks = (data.whatWorksWell ?? []).map((n) => `- ${n}`).join("\n");
  const pitfalls = (data.commonPitfalls ?? [])
    .map((n) => `- ${n}`)
    .join("\n");
  const subAdvice = (data.substrateAdvice ?? [])
    .map((a) => `- **[[${a.substrateClass}]]**: ${a.advice}`)
    .join("\n");
  const whoToAsk = (data.whoToAsk ?? [])
    .map((w) => `- **[[${w.researcher}]]**: ${w.expertise}`)
    .join("\n");
  const repExps = (data.representativeExperiments ?? [])
    .map((e) => `- [[${e.pageTitle ?? e.elnId}]]: ${e.description}`)
    .join("\n");
  const relatedRx = (data.relatedReactionTypes ?? []).map((r) => `[[${r}]]`).join(", ");
  const catalysts = (data.commonCatalysts ?? []).map((c) => `[[${c}]]`).join(", ");

  return `---
title: "${data.name}"
icon: "🔬"
tags:
${buildTags(tags)}
experiment_count: ${data.experimentCount}
${data.avgYield != null ? `avg_yield: ${data.avgYield}` : ""}
researcher_count: ${data.researcherCount}
---

# ${data.name}

> One-liner: ${data.summary}

## Institutional Experience

**Experiments Performed:** ${data.experimentCount}
${data.avgYield != null ? `**Average Yield:** ${data.avgYield}%` : ""}
${data.successRate ? `**Success Rate:** ${data.successRate}` : ""}
**Researchers with Experience:** ${data.researcherCount}

## Key Learnings

### What Works Well
${whatWorks || "- No learnings documented yet"}

### Common Pitfalls
${pitfalls || "- No pitfalls documented yet"}

### Substrate-Specific Advice
${subAdvice || "- No substrate-specific advice yet"}

## Who to Ask

${whoToAsk || "- No researchers linked yet"}

## Representative Experiments

${repExps || "- No experiments linked yet"}

## Related Pages

${relatedRx ? `- Related Reaction Types: ${relatedRx}` : ""}
${catalysts ? `- Common Catalysts: ${catalysts}` : ""}
`;
}

// ---------------------------------------------------------------------------
// Researcher template
// ---------------------------------------------------------------------------

export function generateResearcherPage(data: ResearcherPageData): string {
  const tags = ["researcher"];
  const expertiseYaml =
    data.primaryExpertise && data.primaryExpertise.length > 0
      ? `primary_expertise:\n${yamlStringArray(data.primaryExpertise)}`
      : "";

  const expertiseAreas = (data.expertiseAreas ?? [])
    .map((a) => `- **[[${a.area}]]**: ${a.description}`)
    .join("\n");
  const recentExps = (data.recentExperiments ?? [])
    .map((e) => `- [[${e.pageTitle ?? e.elnId}]]: ${e.description}`)
    .join("\n");
  const notable = (data.notableResults ?? []).map((n) => `- ${n}`).join("\n");
  const instKnowledge = (data.institutionalKnowledge ?? []).map((n) => `- ${n}`).join("\n");

  return `---
title: "${data.name}"
icon: "👩‍🔬"
tags:
${buildTags(tags)}
${data.email ? `email: "${data.email}"` : ""}
experiment_count: ${data.experimentCount}
${expertiseYaml}
---

# ${data.name}

> One-liner: ${data.summary}

## Expertise Areas

${expertiseAreas || "- No expertise areas documented yet"}

## Recent Experiments

${recentExps || "- No experiments linked yet"}

## Key Contributions

### Notable Results
${notable || "- No notable results yet"}

### Institutional Knowledge
${instKnowledge || "- No institutional knowledge yet"}

## Contact

${data.email ? `- **Email**: ${data.email}` : ""}
${data.whenToAsk ? `- **When to Ask**: ${data.whenToAsk}` : ""}
`;
}

// ---------------------------------------------------------------------------
// SubstrateClass template
// ---------------------------------------------------------------------------

export function generateSubstrateClassPage(data: SubstrateClassPageData): string {
  const tags = ["substrate-class"];

  const challenges = (data.commonChallenges ?? []).map((c) => `- ${c}`).join("\n");
  const strategies = (data.successfulStrategies ?? []).map((s) => `- ${s}`).join("\n");
  const rxAdvice = (data.reactionAdvice ?? [])
    .map((a) => `- **[[${a.reactionType}]]**: ${a.advice}`)
    .join("\n");
  const whoExp = (data.whoHasExperience ?? [])
    .map((w) => `- **[[${w.researcher}]]**: ${w.knowledge}`)
    .join("\n");
  const repExps = (data.representativeExperiments ?? [])
    .map((e) => `- [[${e.pageTitle ?? e.elnId}]]: ${e.description}`)
    .join("\n");
  const relatedSC = (data.relatedSubstrateClasses ?? []).map((s) => `[[${s}]]`).join(", ");
  const commonRx = (data.commonReactions ?? []).map((r) => `[[${r}]]`).join(", ");

  return `---
title: "${data.name}"
icon: "🧬"
tags:
${buildTags(tags)}
experiment_count: ${data.experimentCount}
---

# ${data.name}

> One-liner: ${data.summary}

## Common Challenges

${challenges || "- No challenges documented yet"}

## What Worked

### Successful Strategies
${strategies || "- No strategies documented yet"}

### Reaction-Specific Advice
${rxAdvice || "- No reaction-specific advice yet"}

## Who Has Experience

${whoExp || "- No researchers linked yet"}

## Representative Experiments

${repExps || "- No experiments linked yet"}

## Related Pages

${relatedSC ? `- Related Substrate Classes: ${relatedSC}` : ""}
${commonRx ? `- Common Reactions: ${commonRx}` : ""}
`;
}
