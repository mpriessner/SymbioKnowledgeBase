import type {
  ExpertiseProfile,
  WhoToAskContext,
  WhoToAskResult,
  WhoToAskEntry,
  ActivityStatus,
  ExperimentRef,
} from "./types";
import type { ChemicalUsage } from "../types";

/**
 * Maximum number of recommendations to return.
 */
const MAX_RECOMMENDATIONS = 3;

/**
 * Activity bonus multipliers for ranking.
 */
const ACTIVITY_BONUS: Record<ActivityStatus, number> = {
  active: 1.5,
  occasional: 1.0,
  inactive: 0.5,
};

/**
 * Compute "Who To Ask" recommendations for a reaction type.
 *
 * Finds researchers with this reaction type in their expertise,
 * ranks by (weighted expertise score * activity bonus).
 */
function getReactionTypeRecommendations(
  reactionType: string,
  profiles: ExpertiseProfile[]
): WhoToAskEntry[] {
  const entries: WhoToAskEntry[] = [];

  for (const profile of profiles) {
    const expertise = profile.allExpertise.find(
      (e) => e.reactionType === reactionType
    );
    if (!expertise) continue;

    const bonus = ACTIVITY_BONUS[profile.activityStatus];
    const score = expertise.weightedExpertiseScore * bonus;

    const yieldStr =
      expertise.avgYield !== null
        ? `, avg quality ${expertise.avgQualityScore.toFixed(1)}`
        : "";

    entries.push({
      researcherName: profile.researcherName,
      reason: `${expertise.experimentCount} experiments with ${reactionType}${yieldStr}`,
      score,
      recentExperimentDate: expertise.lastExperimentDate,
      activityStatus: profile.activityStatus,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Compute "Who To Ask" recommendations for a substrate class.
 *
 * Finds researchers who worked with this substrate class,
 * ranks by (experiment count * avg quality score * activity bonus).
 */
function getSubstrateClassRecommendations(
  substrateClass: string,
  experiments: ExperimentRef[],
  profiles: ExpertiseProfile[]
): WhoToAskEntry[] {
  const relevant = experiments.filter((e) =>
    e.substrateClasses.includes(substrateClass)
  );

  const byResearcher = new Map<
    string,
    { count: number; totalQuality: number; latestDate: Date }
  >();

  for (const exp of relevant) {
    const existing = byResearcher.get(exp.researcherName);
    if (existing) {
      existing.count += 1;
      existing.totalQuality += exp.qualityScore;
      if (exp.date > existing.latestDate) {
        existing.latestDate = exp.date;
      }
    } else {
      byResearcher.set(exp.researcherName, {
        count: 1,
        totalQuality: exp.qualityScore,
        latestDate: exp.date,
      });
    }
  }

  const entries: WhoToAskEntry[] = [];

  for (const [name, data] of byResearcher) {
    const profile = profiles.find((p) => p.researcherName === name);
    const activityStatus: ActivityStatus = profile?.activityStatus ?? "inactive";
    const bonus = ACTIVITY_BONUS[activityStatus];
    const avgQuality = data.totalQuality / data.count;
    const score = data.count * avgQuality * bonus;

    entries.push({
      researcherName: name,
      reason: `${data.count} experiments with ${substrateClass}, avg quality ${avgQuality.toFixed(1)}`,
      score,
      recentExperimentDate: data.latestDate,
      activityStatus,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Compute "Who To Ask" recommendations for a chemical.
 *
 * Finds researchers who used this chemical most,
 * ranks by usage count * quality (yield-based).
 */
function getChemicalRecommendations(
  chemicalName: string,
  usages: ChemicalUsage[],
  profiles: ExpertiseProfile[]
): WhoToAskEntry[] {
  const byResearcher = new Map<
    string,
    { count: number; totalYield: number; yieldCount: number }
  >();

  for (const usage of usages) {
    const title = usage.experimentTitle;
    const researcher = findResearcherForExperiment(title, profiles);
    if (!researcher) continue;

    const existing = byResearcher.get(researcher);
    if (existing) {
      existing.count += 1;
      if (usage.yield != null) {
        existing.totalYield += usage.yield;
        existing.yieldCount += 1;
      }
    } else {
      byResearcher.set(researcher, {
        count: 1,
        totalYield: usage.yield ?? 0,
        yieldCount: usage.yield != null ? 1 : 0,
      });
    }
  }

  const entries: WhoToAskEntry[] = [];

  for (const [name, data] of byResearcher) {
    const profile = profiles.find((p) => p.researcherName === name);
    const activityStatus: ActivityStatus = profile?.activityStatus ?? "inactive";
    const bonus = ACTIVITY_BONUS[activityStatus];
    const avgYield = data.yieldCount > 0 ? data.totalYield / data.yieldCount : 0;
    const qualityMultiplier = avgYield > 0 ? avgYield / 100 : 0.5;
    const score = data.count * qualityMultiplier * bonus;

    const yieldStr =
      data.yieldCount > 0 ? `, avg ${avgYield.toFixed(0)}% yield` : "";

    entries.push({
      researcherName: name,
      reason: `${data.count} uses of ${chemicalName}${yieldStr}`,
      score,
      recentExperimentDate: null,
      activityStatus,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Attempt to match an experiment title to a researcher name from profiles.
 *
 * This is a heuristic: in a real system, usages would carry researcher info directly.
 * Here we match by checking if any researcher's top contributions reference the experiment.
 */
function findResearcherForExperiment(
  experimentTitle: string,
  profiles: ExpertiseProfile[]
): string | null {
  for (const profile of profiles) {
    for (const contribution of profile.topContributions) {
      if (contribution.experimentTitle === experimentTitle) {
        return profile.researcherName;
      }
    }
  }
  return null;
}

/**
 * Get "Who To Ask" recommendations based on context type.
 *
 * Supports reaction type, substrate class, and chemical contexts.
 * Returns ranked recommendations (top 3) with reasons and scores.
 *
 * @param context - The query context (reaction, substrate, or chemical)
 * @returns Ranked recommendations with context description
 */
export function getWhoToAsk(context: WhoToAskContext): WhoToAskResult {
  switch (context.type) {
    case "reaction": {
      const recommendations = getReactionTypeRecommendations(
        context.reactionType,
        context.expertiseProfiles
      );
      return {
        recommendations,
        context: `Experts in ${context.reactionType}`,
      };
    }
    case "substrate": {
      const recommendations = getSubstrateClassRecommendations(
        context.substrateClass,
        context.experiments,
        context.expertiseProfiles
      );
      return {
        recommendations,
        context: `Researchers with ${context.substrateClass} experience`,
      };
    }
    case "chemical": {
      const recommendations = getChemicalRecommendations(
        context.chemicalName,
        context.usages,
        context.expertiseProfiles
      );
      return {
        recommendations,
        context: `Researchers who have used ${context.chemicalName}`,
      };
    }
  }
}

/**
 * Generate a markdown "Who To Ask" section from recommendation results.
 *
 * Renders researcher wikilinks with their reason/qualification and activity indicator.
 *
 * @param result - The "Who To Ask" result from getWhoToAsk()
 * @returns Formatted markdown section
 */
export function generateWhoToAskSection(result: WhoToAskResult): string {
  if (result.recommendations.length === 0) {
    return "## Who To Ask\n\n*No researchers with relevant experience found.*\n";
  }

  const lines = ["## Who To Ask\n"];

  for (const entry of result.recommendations) {
    lines.push(
      `**[[${entry.researcherName}]]** — ${entry.reason} (${entry.activityStatus})`
    );
  }

  lines.push("");
  return lines.join("\n");
}
