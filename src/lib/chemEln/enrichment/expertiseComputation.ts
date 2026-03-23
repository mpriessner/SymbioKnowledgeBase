import type {
  ExpertiseProfile,
  ReactionTypeExpertise,
  KeyContribution,
  ActivityStatus,
  ResearcherWithExperiments,
  ExpertiseExperimentInput,
} from "./types";

/**
 * Number of days thresholds for activity status classification.
 */
const ACTIVE_DAYS_THRESHOLD = 90;
const OCCASIONAL_DAYS_THRESHOLD = 365;

/**
 * Number of primary expertise areas to select.
 */
const PRIMARY_EXPERTISE_COUNT = 3;

/**
 * Number of top contributions to include.
 */
const TOP_CONTRIBUTIONS_COUNT = 5;

/**
 * Group experiments by reaction type and compute per-type expertise stats.
 *
 * @param experiments - All experiments by the researcher
 * @returns Expertise stats per reaction type, sorted by weighted expertise score descending
 */
function computeReactionTypeExpertise(
  experiments: ExpertiseExperimentInput[]
): ReactionTypeExpertise[] {
  const byType = new Map<string, ExpertiseExperimentInput[]>();

  for (const exp of experiments) {
    const group = byType.get(exp.reactionType);
    if (group) {
      group.push(exp);
    } else {
      byType.set(exp.reactionType, [exp]);
    }
  }

  const expertise: ReactionTypeExpertise[] = [];

  for (const [reactionType, exps] of byType) {
    const yieldsWithData = exps
      .filter((e) => e.yieldPercent !== null)
      .map((e) => e.yieldPercent as number);

    const avgYield =
      yieldsWithData.length > 0
        ? yieldsWithData.reduce((sum, y) => sum + y, 0) / yieldsWithData.length
        : null;

    const avgQualityScore =
      exps.reduce((sum, e) => sum + e.qualityScore, 0) / exps.length;

    const highQualityCount = exps.filter((e) => e.qualityScore >= 4.0).length;

    const dates = exps.map((e) => e.date.getTime());
    const firstExperimentDate = new Date(Math.min(...dates));
    const lastExperimentDate = new Date(Math.max(...dates));

    const weightedExpertiseScore = exps.length * avgQualityScore;

    expertise.push({
      reactionType,
      experimentCount: exps.length,
      avgQualityScore,
      avgYield,
      highQualityCount,
      firstExperimentDate,
      lastExperimentDate,
      weightedExpertiseScore,
    });
  }

  expertise.sort((a, b) => b.weightedExpertiseScore - a.weightedExpertiseScore);

  return expertise;
}

/**
 * Compute the raw contribution score for a researcher.
 * Defined as the sum of quality scores across all experiments.
 *
 * @param experiments - All experiments by the researcher
 * @returns Raw contribution score (not yet normalized)
 */
function computeRawContributionScore(
  experiments: ExpertiseExperimentInput[]
): number {
  return experiments.reduce((sum, e) => sum + e.qualityScore, 0);
}

/**
 * Determine the activity status based on the most recent experiment date.
 *
 * @param experiments - All experiments by the researcher
 * @param referenceDate - The date to compare against (defaults to now)
 * @returns Activity status: "active", "occasional", or "inactive"
 */
function computeActivityStatus(
  experiments: ExpertiseExperimentInput[],
  referenceDate?: Date
): ActivityStatus {
  if (experiments.length === 0) {
    return "inactive";
  }

  const now = referenceDate ?? new Date();
  const mostRecentDate = new Date(
    Math.max(...experiments.map((e) => e.date.getTime()))
  );
  const daysSinceLastExperiment = Math.floor(
    (now.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastExperiment <= ACTIVE_DAYS_THRESHOLD) {
    return "active";
  }
  if (daysSinceLastExperiment <= OCCASIONAL_DAYS_THRESHOLD) {
    return "occasional";
  }
  return "inactive";
}

/**
 * Identify the top contributions (highest quality experiments).
 *
 * @param experiments - All experiments by the researcher
 * @returns Top 5 experiments by quality score
 */
function identifyTopContributions(
  experiments: ExpertiseExperimentInput[]
): KeyContribution[] {
  const sorted = [...experiments].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );

  return sorted.slice(0, TOP_CONTRIBUTIONS_COUNT).map((exp) => {
    let title = `${exp.reactionType} optimization`;
    if (exp.practicalNotes && exp.practicalNotes.length > 0) {
      const firstSentence = exp.practicalNotes.split(".")[0];
      if (firstSentence.length > 10 && firstSentence.length < 80) {
        title = firstSentence;
      }
    }

    return {
      title,
      experimentId: exp.id,
      experimentTitle: exp.title,
      date: exp.date,
      qualityScore: exp.qualityScore,
      reactionType: exp.reactionType,
    };
  });
}

/**
 * Compute the full expertise profile for a single researcher.
 *
 * @param researcher - Researcher with their associated experiments
 * @param referenceDate - Optional reference date for activity status computation
 * @returns Complete expertise profile
 */
export function computeResearcherExpertise(
  researcher: ResearcherWithExperiments,
  referenceDate?: Date
): ExpertiseProfile {
  const { researcherId, researcherName, experiments } = researcher;

  if (experiments.length === 0) {
    return {
      researcherId,
      researcherName,
      totalExperiments: 0,
      primaryExpertise: [],
      allExpertise: [],
      contributionScore: 0,
      activityStatus: "inactive",
      topContributions: [],
    };
  }

  const allExpertise = computeReactionTypeExpertise(experiments);
  const primaryExpertise = allExpertise.slice(0, PRIMARY_EXPERTISE_COUNT);
  const contributionScore = computeRawContributionScore(experiments);
  const activityStatus = computeActivityStatus(experiments, referenceDate);
  const topContributions = identifyTopContributions(experiments);

  return {
    researcherId,
    researcherName,
    totalExperiments: experiments.length,
    primaryExpertise,
    allExpertise,
    contributionScore,
    activityStatus,
    topContributions,
  };
}

/**
 * Compute expertise profiles for all researchers, with contribution scores
 * normalized to a 0-100 scale relative to the most active researcher.
 *
 * @param researchers - All researchers with their experiments
 * @param referenceDate - Optional reference date for activity status computation
 * @returns Expertise profiles sorted by contribution score descending
 */
export function computeAllExpertise(
  researchers: ResearcherWithExperiments[],
  referenceDate?: Date
): ExpertiseProfile[] {
  const profiles = researchers.map((r) =>
    computeResearcherExpertise(r, referenceDate)
  );

  const maxScore = Math.max(...profiles.map((p) => p.contributionScore), 0);

  if (maxScore > 0) {
    for (const profile of profiles) {
      profile.contributionScore = Math.round(
        (profile.contributionScore / maxScore) * 100
      );
    }
  }

  profiles.sort((a, b) => b.contributionScore - a.contributionScore);

  return profiles;
}
