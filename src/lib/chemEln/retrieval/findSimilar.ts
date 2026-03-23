import type { ScaleCategory } from "../../chemistryKb/types";

export interface SimilarityQuery {
  reactionType?: string;
  substrateClass?: string;
  chemicals?: string[];
  researcher?: string;
  scaleCategory?: ScaleCategory;
  minQuality?: number;
  limit?: number;
}

export interface ExperimentEntry {
  experimentTitle: string;
  reactionType?: string;
  substrateClass?: string;
  chemicals: string[];
  researcher: string;
  scaleCategory?: ScaleCategory;
  qualityScore: number;
  yield?: number;
  date: string;
}

export interface SimilarExperimentResult {
  experimentTitle: string;
  score: number;
  matchReasons: string[];
  reactionType?: string;
  yield?: number;
  qualityScore: number;
  researcher: string;
  date: string;
}

export interface ExperimentRef {
  experimentTitle: string;
  reactionType?: string;
  substrateClass?: string;
  chemicals: string[];
  researcher: string;
  scaleCategory?: ScaleCategory;
  qualityScore: number;
  yield?: number;
  date: string;
}

function scoreExperiment(
  experiment: ExperimentEntry,
  query: SimilarityQuery
): { score: number; matchReasons: string[] } {
  let score = 0;
  const matchReasons: string[] = [];

  if (
    query.reactionType &&
    experiment.reactionType &&
    experiment.reactionType.toLowerCase() === query.reactionType.toLowerCase()
  ) {
    score += 3;
    matchReasons.push(`Same reaction type: ${experiment.reactionType}`);
  }

  if (
    query.substrateClass &&
    experiment.substrateClass &&
    experiment.substrateClass.toLowerCase() ===
      query.substrateClass.toLowerCase()
  ) {
    score += 2;
    matchReasons.push(`Same substrate class: ${experiment.substrateClass}`);
  }

  if (query.chemicals && query.chemicals.length > 0) {
    const experimentChemicalsLower = experiment.chemicals.map((c) =>
      c.toLowerCase()
    );
    let chemicalMatches = 0;
    for (const qChem of query.chemicals) {
      if (experimentChemicalsLower.includes(qChem.toLowerCase())) {
        chemicalMatches++;
        matchReasons.push(`Uses chemical: ${qChem}`);
      }
    }
    const cappedMatches = Math.min(chemicalMatches, 5);
    score += cappedMatches;
  }

  if (
    query.researcher &&
    experiment.researcher.toLowerCase() === query.researcher.toLowerCase()
  ) {
    score += 1;
    matchReasons.push(`Same researcher: ${experiment.researcher}`);
  }

  if (
    query.scaleCategory &&
    experiment.scaleCategory &&
    experiment.scaleCategory === query.scaleCategory
  ) {
    score += 1;
    matchReasons.push(`Same scale category: ${experiment.scaleCategory}`);
  }

  score += experiment.qualityScore * 0.5;

  return { score, matchReasons };
}

export function findSimilarExperiments(
  query: SimilarityQuery,
  experiments: ExperimentEntry[]
): SimilarExperimentResult[] {
  const limit = query.limit ?? 10;

  let filtered = experiments;
  if (query.minQuality !== undefined) {
    filtered = filtered.filter((e) => e.qualityScore >= query.minQuality!);
  }

  const scored = filtered.map((experiment) => {
    const { score, matchReasons } = scoreExperiment(experiment, query);
    return {
      experimentTitle: experiment.experimentTitle,
      score,
      matchReasons,
      reactionType: experiment.reactionType,
      yield: experiment.yield,
      qualityScore: experiment.qualityScore,
      researcher: experiment.researcher,
      date: experiment.date,
    } satisfies SimilarExperimentResult;
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export function buildSimilarityContext(
  experiment: ExperimentRef
): SimilarityQuery {
  const query: SimilarityQuery = {};

  if (experiment.reactionType) {
    query.reactionType = experiment.reactionType;
  }
  if (experiment.substrateClass) {
    query.substrateClass = experiment.substrateClass;
  }
  if (experiment.chemicals.length > 0) {
    query.chemicals = [...experiment.chemicals];
  }
  if (experiment.researcher) {
    query.researcher = experiment.researcher;
  }
  if (experiment.scaleCategory) {
    query.scaleCategory = experiment.scaleCategory;
  }

  return query;
}

export function formatSimilarExperimentsForAgent(
  results: SimilarExperimentResult[]
): string {
  if (results.length === 0) {
    return "No similar experiments found.";
  }

  const lines: string[] = [];
  lines.push("## Similar Experiments\n");
  lines.push(`Found ${results.length} similar experiment(s):\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. [[${r.experimentTitle}]]`);
    lines.push("");
    lines.push(`- **Score:** ${r.score.toFixed(1)}`);
    if (r.reactionType) {
      lines.push(`- **Reaction Type:** ${r.reactionType}`);
    }
    if (r.yield !== undefined) {
      lines.push(`- **Yield:** ${r.yield}%`);
    }
    lines.push(`- **Quality:** ${r.qualityScore}/5`);
    lines.push(`- **Researcher:** [[${r.researcher}]]`);
    lines.push(`- **Date:** ${r.date}`);
    if (r.matchReasons.length > 0) {
      lines.push(`- **Match Reasons:**`);
      for (const reason of r.matchReasons) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
