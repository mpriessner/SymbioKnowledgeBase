import type { ExperimentStatus, ScaleCategory } from "@/lib/chemistryKb/types";
import { TAG_NAMESPACES } from "@/lib/chemistryKb/types";
import { computeQualityScore } from "@/lib/chemistryKb/qualityScore";
import { formatExperimentTitle } from "@/lib/chemistryKb/naming";
import type { ExperimentPageData, ExperimentReagent } from "@/lib/chemistryKb/templates";
import type { RawExperimentData, RawChemical, TransformedExperiment } from "./fetcherTypes";

const VALID_STATUSES: ExperimentStatus[] = [
  "planned",
  "in-progress",
  "completed",
  "failed",
  "abandoned",
];

export function normalizeStatus(raw: string): ExperimentStatus {
  const lower = raw.toLowerCase().trim();
  if (VALID_STATUSES.includes(lower as ExperimentStatus)) {
    return lower as ExperimentStatus;
  }
  const mapping: Record<string, ExperimentStatus> = {
    "in progress": "in-progress",
    inprogress: "in-progress",
    active: "in-progress",
    done: "completed",
    complete: "completed",
    cancelled: "abandoned",
    canceled: "abandoned",
  };
  return mapping[lower] ?? "planned";
}

export function generateElnId(raw: RawExperimentData): string {
  const date = new Date(raw.date);
  const year = date.getFullYear();
  const idSuffix = raw.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `EXP-${year}-${idSuffix}`;
}

export function generateExperimentTitle(raw: RawExperimentData): string {
  const elnId = generateElnId(raw);
  const shortTitle = raw.title.trim() || "Untitled Experiment";
  return formatExperimentTitle(elnId, shortTitle);
}

export function determineScaleCategory(chemicals: RawChemical[]): ScaleCategory {
  const reagents = chemicals.filter(
    (c) => c.role === "reagent" || c.role === "catalyst"
  );
  if (reagents.length === 0) return "small";

  const maxAmountMmol = reagents.reduce((max, r) => {
    let mmol = r.amount;
    const unit = r.unit.toLowerCase();
    if (unit === "g" && r.molecular_weight && r.molecular_weight > 0) {
      mmol = (r.amount / r.molecular_weight) * 1000;
    } else if (unit === "mg" && r.molecular_weight && r.molecular_weight > 0) {
      mmol = (r.amount / r.molecular_weight);
    } else if (unit === "mol") {
      mmol = r.amount * 1000;
    } else if (unit === "mmol") {
      mmol = r.amount;
    } else if (unit === "ml" || unit === "l") {
      return max;
    }
    return Math.max(max, mmol);
  }, 0);

  if (maxAmountMmol >= 100) return "pilot";
  if (maxAmountMmol >= 10) return "large";
  if (maxAmountMmol >= 1) return "medium";
  return "small";
}

export function extractChemicalWikilinks(chemicals: RawChemical[]): string[] {
  return chemicals
    .map((c) => c.name.trim())
    .filter((name) => name.length > 0);
}

export function generateTags(
  raw: RawExperimentData,
  elnId: string,
  scaleCategory: ScaleCategory,
  qualityScore: number
): string[] {
  const tags: string[] = [];

  tags.push(`${TAG_NAMESPACES.ELN}${elnId}`);

  if (raw.reaction_type) {
    const slug = raw.reaction_type.toLowerCase().replace(/\s+/g, "-");
    tags.push(`${TAG_NAMESPACES.REACTION}${slug}`);
  }

  const researcherSlug = raw.researcher_name
    .split(/\s+/)
    .pop()
    ?.toLowerCase() ?? "";
  if (researcherSlug) {
    tags.push(`${TAG_NAMESPACES.RESEARCHER}${researcherSlug}`);
  }

  tags.push(`${TAG_NAMESPACES.SCALE}${scaleCategory}`);
  tags.push(`${TAG_NAMESPACES.QUALITY}${qualityScore}`);

  if (raw.substrate_class) {
    const slug = raw.substrate_class.toLowerCase().replace(/\s+/g, "-");
    tags.push(`${TAG_NAMESPACES.SUBSTRATE_CLASS}${slug}`);
  }

  const casChemicals = raw.chemicals.filter((c) => c.cas_number);
  for (const chem of casChemicals) {
    tags.push(`${TAG_NAMESPACES.CAS}${chem.cas_number}`);
  }

  return tags;
}

export function parseProcedure(procedure: string | null): {
  setup: string[];
  reaction: string[];
  workup: string[];
  purification: string[];
} {
  if (!procedure || procedure.trim().length === 0) {
    return { setup: [], reaction: [], workup: [], purification: [] };
  }

  const lines = procedure
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sections: Record<string, string[]> = {
    setup: [],
    reaction: [],
    workup: [],
    purification: [],
  };

  let currentSection = "reaction";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("setup:") || lower.startsWith("## setup")) {
      currentSection = "setup";
      continue;
    }
    if (lower.startsWith("reaction:") || lower.startsWith("## reaction")) {
      currentSection = "reaction";
      continue;
    }
    if (lower.startsWith("workup:") || lower.startsWith("## workup") || lower.startsWith("work-up:")) {
      currentSection = "workup";
      continue;
    }
    if (lower.startsWith("purification:") || lower.startsWith("## purification")) {
      currentSection = "purification";
      continue;
    }

    const cleaned = line.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "");
    if (cleaned.length > 0) {
      sections[currentSection].push(cleaned);
    }
  }

  return {
    setup: sections.setup,
    reaction: sections.reaction,
    workup: sections.workup,
    purification: sections.purification,
  };
}

export function formatReagents(chemicals: RawChemical[]): ExperimentReagent[] {
  return chemicals
    .filter((c) => c.role !== "product")
    .map((c) => ({
      name: c.name,
      amount: `${c.amount} ${c.unit}`,
      equivalents: c.role === "catalyst" ? "cat." : "1.0 eq",
      cas: c.cas_number ?? undefined,
      notes: c.role === "solvent" ? "solvent" : undefined,
    }));
}

export function parsePracticalNotes(notes: string | null): {
  worked: string[];
  challenges: string[];
  recommendations: string[];
} {
  if (!notes || notes.trim().length === 0) {
    return { worked: [], challenges: [], recommendations: [] };
  }

  const lines = notes
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result = { worked: [] as string[], challenges: [] as string[], recommendations: [] as string[] };
  let currentSection: keyof typeof result = "worked";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("worked") || lower.includes("success")) {
      currentSection = "worked";
      continue;
    }
    if (lower.includes("challenge") || lower.includes("problem") || lower.includes("issue")) {
      currentSection = "challenges";
      continue;
    }
    if (lower.includes("recommend") || lower.includes("next time") || lower.includes("suggestion")) {
      currentSection = "recommendations";
      continue;
    }

    const cleaned = line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
    if (cleaned.length > 0) {
      result[currentSection].push(cleaned);
    }
  }

  return result;
}

export function transformExperiment(raw: RawExperimentData): TransformedExperiment {
  const elnId = generateElnId(raw);
  const title = generateExperimentTitle(raw);
  const status = normalizeStatus(raw.status);
  const scaleCategory = determineScaleCategory(raw.chemicals);
  const yieldPercent = raw.yield_percent ?? 0;

  const products = raw.chemicals.filter((c) => c.role === "product");
  const procedure = parseProcedure(raw.procedure);
  const hasFullProcedure =
    procedure.setup.length > 0 ||
    procedure.reaction.length > 0 ||
    procedure.workup.length > 0;

  const qualityScore = computeQualityScore({
    yield: yieldPercent,
    hasPracticalNotes: !!raw.practical_notes && raw.practical_notes.trim().length > 0,
    hasProducts: products.length > 0,
    hasCharacterization: !!raw.results && raw.results.trim().length > 0,
    hasFullProcedure,
  });

  const tags = generateTags(raw, elnId, scaleCategory, qualityScore);
  const reagents = formatReagents(raw.chemicals);
  const practicalNotes = parsePracticalNotes(raw.practical_notes);
  const chemicalWikilinks = extractChemicalWikilinks(raw.chemicals);

  const summary = raw.results
    ? raw.results.split(/[.!]/)[0].trim() || `${raw.title} experiment`
    : `${raw.title} experiment`;

  const pageData: ExperimentPageData = {
    title,
    elnId,
    researcher: raw.researcher_name,
    date: raw.date,
    status,
    reactionType: raw.reaction_type ?? undefined,
    substrateClass: raw.substrate_class ?? undefined,
    scaleCategory,
    qualityScore,
    tags,
    summary,
    conditions: [],
    reagents,
    procedureSetup: procedure.setup,
    procedureReaction: procedure.reaction,
    procedureWorkup: procedure.workup,
    procedurePurification: procedure.purification,
    results: {
      yield: `${yieldPercent}%`,
      characterization: raw.results ?? undefined,
    },
    practicalNotesWorked: practicalNotes.worked,
    practicalNotesChallenges: practicalNotes.challenges,
    practicalNotesRecommendations: practicalNotes.recommendations,
    relatedChemicals: chemicalWikilinks,
  };

  return {
    frontmatter: {
      title,
      elnId,
      researcher: raw.researcher_name,
      date: raw.date,
      status,
      reactionType: raw.reaction_type ?? undefined,
      substrateClass: raw.substrate_class ?? undefined,
      scaleCategory,
      qualityScore,
      tags,
    },
    body: {
      summary,
      reagents,
      conditions: [],
      procedureSetup: procedure.setup,
      procedureReaction: procedure.reaction,
      procedureWorkup: procedure.workup,
      procedurePurification: procedure.purification,
      results: {
        yield: `${yieldPercent}%`,
        characterization: raw.results ?? undefined,
      },
      practicalNotesWorked: practicalNotes.worked,
      practicalNotesChallenges: practicalNotes.challenges,
      practicalNotesRecommendations: practicalNotes.recommendations,
      relatedChemicals: chemicalWikilinks,
    },
    pageData,
  };
}
