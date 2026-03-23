import type { PracticalNotesResult } from "./types";

/**
 * Source experiment attribution for a learning.
 */
export interface LearningSource {
  title: string;
  researcher: string;
  date: string;
}

/**
 * Category of a learning extracted from experiments.
 */
export type LearningCategory = "tip" | "warning" | "technique" | "condition";

/**
 * Confidence level based on how many experiments corroborate a learning.
 */
export type LearningConfidence = "high" | "medium" | "low";

/**
 * A ranked learning extracted and aggregated from experiments.
 */
export interface RankedLearning {
  text: string;
  category: LearningCategory;
  confidence: LearningConfidence;
  sourceExperiments: LearningSource[];
  qualityWeight: number;
}

/**
 * Input: an experiment with practical notes and quality metadata.
 */
export interface ExperimentWithNotes {
  id: string;
  title: string;
  researcher: string;
  date: string;
  qualityScore: number;
  yieldPercent: number | null;
  practicalNotes: PracticalNotesResult;
  conditions?: {
    temperature?: string;
    solvent?: string;
    catalyst?: string;
  };
}

/**
 * Aggregated result for a reaction type page.
 */
export interface ReactionTypeLearnings {
  keyLearnings: RankedLearning[];
  commonPitfalls: RankedLearning[];
  bestConditions: {
    temperature: string | null;
    solvent: string | null;
    catalyst: string | null;
  };
}

/**
 * Internal intermediate learning before deduplication/ranking.
 */
interface RawLearning {
  text: string;
  category: LearningCategory;
  source: LearningSource;
  qualityScore: number;
}

/**
 * Classify a learning text into a category.
 *
 * - "warning": mentions problems, failures, caution
 * - "condition": mentions specific conditions (temperature, solvent, catalyst, time)
 * - "technique": mentions technique/procedure details (TLC, NMR, filtration, etc.)
 * - "tip": everything else (general practical advice)
 */
export function classifyLearning(text: string): LearningCategory {
  const lower = text.toLowerCase();

  const warningKeywords = [
    "caution", "warning", "avoid", "careful", "hazard", "dangerous",
    "failed", "failure", "decomposed", "problem", "loss", "toxic",
    "exotherm", "do not", "don't", "never", "risk",
  ];
  if (warningKeywords.some((kw) => lower.includes(kw))) {
    return "warning";
  }

  const conditionKeywords = [
    "temperature", "solvent", "catalyst", "atmosphere", "pressure",
    "concentration", "equiv", "excess", "mol%", "wt%",
    "room temperature", "reflux", "degassed",
  ];
  // Also match temperature patterns like "80°C" or "50 degrees"
  if (
    conditionKeywords.some((kw) => lower.includes(kw)) ||
    /\d+\s*°c/i.test(text) ||
    /\d+\s*degrees/i.test(text)
  ) {
    return "condition";
  }

  const techniqueKeywords = [
    "tlc", "nmr", "hplc", "monitor", "filtration", "extraction",
    "chromatography", "column", "recrystallization", "workup",
    "work-up", "quench", "cannula", "syringe", "dropwise",
    "stir", "sonicate", "centrifuge",
  ];
  if (techniqueKeywords.some((kw) => lower.includes(kw))) {
    return "technique";
  }

  return "tip";
}

/**
 * Extract raw learnings from a single experiment's practical notes.
 *
 * Sources of learnings:
 * - Tips from practical notes (explicit tips array)
 * - "what_worked" entries
 * - "challenges" entries (become warnings)
 * - High-quality experiment conditions/procedure (quality >= 4)
 * - Overall notes if substantial
 */
function extractRawLearnings(experiment: ExperimentWithNotes): RawLearning[] {
  const learnings: RawLearning[] = [];
  const notes = experiment.practicalNotes;
  const source: LearningSource = {
    title: experiment.title,
    researcher: experiment.researcher,
    date: experiment.date,
  };

  if (!notes.hasData) {
    return learnings;
  }

  // Extract from tips
  for (const tip of notes.tips) {
    if (tip.trim().length === 0) continue;
    learnings.push({
      text: tip.trim(),
      category: classifyLearning(tip),
      source,
      qualityScore: experiment.qualityScore,
    });
  }

  // Extract from whatWorked
  for (const entry of notes.whatWorked) {
    learnings.push({
      text: entry.text,
      category: classifyLearning(entry.text),
      source,
      qualityScore: experiment.qualityScore,
    });
  }

  // Extract from challenges (always categorized as warning)
  for (const entry of notes.challenges) {
    learnings.push({
      text: entry.text,
      category: "warning",
      source,
      qualityScore: experiment.qualityScore,
    });
  }

  // Extract from recommendations
  for (const entry of notes.recommendations) {
    learnings.push({
      text: entry.text,
      category: classifyLearning(entry.text),
      source,
      qualityScore: experiment.qualityScore,
    });
  }

  // High-quality experiments: their overall notes become learnings
  if (experiment.qualityScore >= 4 && notes.overallNotes && notes.overallNotes.length > 20) {
    learnings.push({
      text: notes.overallNotes,
      category: classifyLearning(notes.overallNotes),
      source,
      qualityScore: experiment.qualityScore,
    });
  }

  return learnings;
}

/**
 * Compute word overlap similarity between two texts.
 * Returns a value between 0 and 1 (Jaccard similarity on words).
 */
export function computeTextSimilarity(a: string, b: string): number {
  const normalize = (s: string): Set<string> => {
    const words = s
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2); // ignore very short words
    return new Set(words);
  };

  const wordsA = normalize(a);
  const wordsB = normalize(b);

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersectionCount++;
  }

  const unionSize = new Set([...wordsA, ...wordsB]).size;
  return intersectionCount / unionSize;
}

/**
 * Determine confidence level based on the number of corroborating experiments.
 *
 * - 3+ experiments: "high"
 * - 2 experiments: "medium"
 * - 1 experiment: "low"
 */
function determineConfidence(sourceCount: number): LearningConfidence {
  if (sourceCount >= 3) return "high";
  if (sourceCount >= 2) return "medium";
  return "low";
}

/**
 * Confidence sort order for ranking.
 */
function confidenceOrder(c: LearningConfidence): number {
  switch (c) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

/**
 * Group similar raw learnings together and merge into RankedLearnings.
 * Uses fuzzy text matching (Jaccard similarity > 0.5) to detect duplicates.
 * Keeps the best text (from the highest quality source) and merges sources.
 */
function deduplicateAndMerge(rawLearnings: RawLearning[]): RankedLearning[] {
  const groups: Array<{
    bestText: string;
    category: LearningCategory;
    sources: LearningSource[];
    qualityScores: number[];
  }> = [];

  for (const learning of rawLearnings) {
    let merged = false;

    for (const group of groups) {
      if (computeTextSimilarity(learning.text, group.bestText) > 0.5) {
        // Merge into this group
        const alreadyHasSource = group.sources.some(
          (s) => s.title === learning.source.title
        );
        if (!alreadyHasSource) {
          group.sources.push(learning.source);
        }
        group.qualityScores.push(learning.qualityScore);
        // Keep text from higher-quality source
        if (learning.qualityScore > Math.max(...group.qualityScores.slice(0, -1))) {
          group.bestText = learning.text;
        }
        // Upgrade category to warning if any source is a warning
        if (learning.category === "warning") {
          group.category = "warning";
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      groups.push({
        bestText: learning.text,
        category: learning.category,
        sources: [learning.source],
        qualityScores: [learning.qualityScore],
      });
    }
  }

  return groups.map((group) => {
    const avgQuality =
      group.qualityScores.reduce((sum, q) => sum + q, 0) / group.qualityScores.length;

    return {
      text: group.bestText,
      category: group.category,
      confidence: determineConfidence(group.sources.length),
      sourceExperiments: group.sources,
      qualityWeight: Math.round(avgQuality * 100) / 100,
    };
  });
}

/**
 * Compare two RankedLearnings for sorting.
 * Priority: confidence (high > medium > low), then qualityWeight, then source count.
 */
function compareLearnings(a: RankedLearning, b: RankedLearning): number {
  const confDiff = confidenceOrder(b.confidence) - confidenceOrder(a.confidence);
  if (confDiff !== 0) return confDiff;

  const qualDiff = b.qualityWeight - a.qualityWeight;
  if (Math.abs(qualDiff) > 0.01) return qualDiff;

  return b.sourceExperiments.length - a.sourceExperiments.length;
}

/**
 * Extract key learnings from experiments that share a reaction type.
 *
 * Process:
 * 1. Extract raw learnings from each experiment's practical notes
 * 2. Deduplicate similar learnings (fuzzy text matching)
 * 3. Merge corroborating observations to boost confidence
 * 4. Rank by confidence, then quality weight, then source count
 * 5. Limit to top 10
 *
 * @param experiments - Experiments sharing a reaction type, each with practical notes and quality score
 * @param _reactionType - The reaction type name (for context, currently unused in extraction logic)
 * @returns Top 10 ranked learnings
 */
export function extractKeyLearnings(
  experiments: ExperimentWithNotes[],
  _reactionType: string
): RankedLearning[] {
  // Step 1: Extract all raw learnings
  const allRaw: RawLearning[] = [];
  for (const exp of experiments) {
    allRaw.push(...extractRawLearnings(exp));
  }

  if (allRaw.length === 0) {
    return [];
  }

  // Step 2-3: Deduplicate and merge
  const merged = deduplicateAndMerge(allRaw);

  // Step 4: Rank
  merged.sort(compareLearnings);

  // Step 5: Top 10
  return merged.slice(0, 10);
}

/**
 * Find the most common value in an array of strings, ignoring nulls/undefined.
 */
function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;

  const counts = new Map<string, number>();
  for (const v of values) {
    const normalized = v.trim().toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = val;
    }
  }

  // Return the original-cased version from the first match
  if (best === null) return null;
  return values.find((v) => v.trim().toLowerCase() === best) ?? best;
}

/**
 * Aggregate learnings for a reaction type page.
 *
 * Produces:
 * - keyLearnings: top 10 ranked learnings
 * - commonPitfalls: learnings categorized as "warning"
 * - bestConditions: most common successful conditions from high-quality experiments
 *
 * @param reactionType - The reaction type name
 * @param experiments - All experiments for this reaction type
 * @returns Aggregated learnings, pitfalls, and best conditions
 */
export function aggregateLearningsForReactionType(
  reactionType: string,
  experiments: ExperimentWithNotes[]
): ReactionTypeLearnings {
  const keyLearnings = extractKeyLearnings(experiments, reactionType);

  const commonPitfalls = keyLearnings.filter((l) => l.category === "warning");

  // Extract best conditions from high-quality experiments (quality >= 4)
  const highQuality = experiments.filter((e) => e.qualityScore >= 4);

  const temperatures: string[] = [];
  const solvents: string[] = [];
  const catalysts: string[] = [];

  for (const exp of highQuality) {
    if (exp.conditions?.temperature) temperatures.push(exp.conditions.temperature);
    if (exp.conditions?.solvent) solvents.push(exp.conditions.solvent);
    if (exp.conditions?.catalyst) catalysts.push(exp.conditions.catalyst);
  }

  return {
    keyLearnings,
    commonPitfalls,
    bestConditions: {
      temperature: mostCommon(temperatures),
      solvent: mostCommon(solvents),
      catalyst: mostCommon(catalysts),
    },
  };
}
