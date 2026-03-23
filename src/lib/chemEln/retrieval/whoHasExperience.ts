import type {
  ExpertiseProfile,
  ActivityStatus,
  ExperimentRef,
} from "../enrichment/types";
import type { ChemicalUsage } from "../types";

export interface ExperienceQuery {
  topic: string;
  topicType: "reaction" | "substrate" | "chemical" | "technique";
  minExperiments?: number;
  includeInactive?: boolean;
}

export interface RelevantExperiment {
  title: string;
  date: Date;
  yield: number | null;
}

export interface ExperienceResult {
  researcherName: string;
  email?: string;
  expertiseScore: number;
  experimentCount: number;
  avgQuality: number;
  recentExperiment?: { title: string; date: Date; yield: number | null };
  activityStatus: ActivityStatus;
  relevantExperiments: RelevantExperiment[];
}

export interface ExperienceDataSources {
  profiles: ExpertiseProfile[];
  experiments: ExperimentRef[];
  chemicalUsages?: ChemicalUsage[];
  researcherEmails?: Record<string, string>;
  referenceDate?: Date;
}

const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const ACTIVITY_BONUS: Record<ActivityStatus, number> = {
  active: 1.5,
  occasional: 1.0,
  inactive: 0.5,
};

function computeRecencyBonus(experimentDate: Date, referenceDate: Date): number {
  const elapsed = referenceDate.getTime() - experimentDate.getTime();
  if (elapsed <= SIX_MONTHS_MS) return 1.5;
  if (elapsed <= ONE_YEAR_MS) return 1.0;
  return 0.7;
}

function matchReaction(
  query: ExperienceQuery,
  dataSources: ExperienceDataSources
): ExperienceResult[] {
  const topicLower = query.topic.toLowerCase();
  const results: ExperienceResult[] = [];
  const refDate = dataSources.referenceDate ?? new Date();

  for (const profile of dataSources.profiles) {
    const expertise = profile.allExpertise.find(
      (e) => e.reactionType.toLowerCase() === topicLower
    );
    if (!expertise) continue;

    const relevantExps = dataSources.experiments.filter(
      (e) =>
        e.researcherName === profile.researcherName &&
        e.reactionType.toLowerCase() === topicLower
    );

    const relevantExperiments: RelevantExperiment[] = relevantExps.map((e) => ({
      title: e.experimentId,
      date: e.date,
      yield: e.yieldPercent,
    }));

    const mostRecent =
      relevantExps.length > 0
        ? relevantExps.reduce((latest, e) =>
            e.date > latest.date ? e : latest
          )
        : null;

    const recencyBonus = mostRecent
      ? computeRecencyBonus(mostRecent.date, refDate)
      : 0.7;

    const activityBonus = ACTIVITY_BONUS[profile.activityStatus];
    const expertiseScore =
      expertise.weightedExpertiseScore * activityBonus * recencyBonus;

    results.push({
      researcherName: profile.researcherName,
      email: dataSources.researcherEmails?.[profile.researcherName],
      expertiseScore,
      experimentCount: expertise.experimentCount,
      avgQuality: expertise.avgQualityScore,
      recentExperiment: mostRecent
        ? {
            title: mostRecent.experimentId,
            date: mostRecent.date,
            yield: mostRecent.yieldPercent,
          }
        : undefined,
      activityStatus: profile.activityStatus,
      relevantExperiments,
    });
  }

  return results;
}

function matchSubstrate(
  query: ExperienceQuery,
  dataSources: ExperienceDataSources
): ExperienceResult[] {
  const topicLower = query.topic.toLowerCase();
  const refDate = dataSources.referenceDate ?? new Date();

  const byResearcher = new Map<
    string,
    { exps: ExperimentRef[]; totalQuality: number }
  >();

  for (const exp of dataSources.experiments) {
    const hasSubstrate = exp.substrateClasses.some(
      (sc) => sc.toLowerCase() === topicLower
    );
    if (!hasSubstrate) continue;

    const existing = byResearcher.get(exp.researcherName);
    if (existing) {
      existing.exps.push(exp);
      existing.totalQuality += exp.qualityScore;
    } else {
      byResearcher.set(exp.researcherName, {
        exps: [exp],
        totalQuality: exp.qualityScore,
      });
    }
  }

  const results: ExperienceResult[] = [];

  Array.from(byResearcher.entries()).forEach(([name, data]) => {
    const profile = dataSources.profiles.find((p) => p.researcherName === name);
    const activityStatus: ActivityStatus =
      profile?.activityStatus ?? "inactive";

    const relevantExperiments: RelevantExperiment[] = data.exps.map((e) => ({
      title: e.experimentId,
      date: e.date,
      yield: e.yieldPercent,
    }));

    const mostRecent = data.exps.reduce((latest, e) =>
      e.date > latest.date ? e : latest
    );

    const recencyBonus = computeRecencyBonus(mostRecent.date, refDate);
    const activityBonus = ACTIVITY_BONUS[activityStatus];
    const avgQuality = data.totalQuality / data.exps.length;
    const expertiseScore =
      data.exps.length * avgQuality * activityBonus * recencyBonus;

    results.push({
      researcherName: name,
      email: dataSources.researcherEmails?.[name],
      expertiseScore,
      experimentCount: data.exps.length,
      avgQuality,
      recentExperiment: {
        title: mostRecent.experimentId,
        date: mostRecent.date,
        yield: mostRecent.yieldPercent,
      },
      activityStatus,
      relevantExperiments,
    });
  });

  return results;
}

function matchChemical(
  query: ExperienceQuery,
  dataSources: ExperienceDataSources
): ExperienceResult[] {
  const topicLower = query.topic.toLowerCase();
  const refDate = dataSources.referenceDate ?? new Date();
  const usages = dataSources.chemicalUsages ?? [];

  const byResearcher = new Map<
    string,
    {
      titles: Set<string>;
      totalYield: number;
      yieldCount: number;
      latestDate: Date | null;
    }
  >();

  for (const usage of usages) {
    if (usage.experimentTitle.toLowerCase().includes(topicLower)) {
      continue;
    }
  }

  const profilesByContribution = new Map<
    string,
    { experiments: { title: string; date: Date; yield: number | null }[] }
  >();

  for (const profile of dataSources.profiles) {
    for (const contribution of profile.topContributions) {
      if (
        contribution.title.toLowerCase().includes(topicLower) ||
        contribution.experimentTitle.toLowerCase().includes(topicLower)
      ) {
        const existing = profilesByContribution.get(profile.researcherName);
        const entry = {
          title: contribution.experimentTitle,
          date: contribution.date,
          yield: null as number | null,
        };
        if (existing) {
          existing.experiments.push(entry);
        } else {
          profilesByContribution.set(profile.researcherName, {
            experiments: [entry],
          });
        }
      }
    }
  }

  for (const exp of dataSources.experiments) {
    const expIdLower = exp.experimentId.toLowerCase();

    for (const usage of usages) {
      if (
        usage.experimentTitle.toLowerCase() === expIdLower ||
        usage.experimentId.toLowerCase() === expIdLower
      ) {
        const existing = byResearcher.get(exp.researcherName);
        if (existing) {
          existing.titles.add(exp.experimentId);
          if (usage.yield != null) {
            existing.totalYield += usage.yield;
            existing.yieldCount += 1;
          }
          if (!existing.latestDate || exp.date > existing.latestDate) {
            existing.latestDate = exp.date;
          }
        } else {
          byResearcher.set(exp.researcherName, {
            titles: new Set([exp.experimentId]),
            totalYield: usage.yield ?? 0,
            yieldCount: usage.yield != null ? 1 : 0,
            latestDate: exp.date,
          });
        }
      }
    }
  }

  const results: ExperienceResult[] = [];

  Array.from(byResearcher.entries()).forEach(([name, data]) => {
    const profile = dataSources.profiles.find((p) => p.researcherName === name);
    const activityStatus: ActivityStatus =
      profile?.activityStatus ?? "inactive";
    const activityBonus = ACTIVITY_BONUS[activityStatus];

    const recencyBonus = data.latestDate
      ? computeRecencyBonus(data.latestDate, refDate)
      : 0.7;

    const titlesArray = Array.from(data.titles);
    const avgQuality =
      data.yieldCount > 0 ? data.totalYield / data.yieldCount / 20 : 2.5;
    const expertiseScore =
      titlesArray.length * avgQuality * activityBonus * recencyBonus;

    const relevantExperiments: RelevantExperiment[] = titlesArray.map(
      (title: string) => {
        const exp = dataSources.experiments.find(
          (e) => e.experimentId === title
        );
        return {
          title,
          date: exp?.date ?? new Date(),
          yield: exp?.yieldPercent ?? null,
        };
      }
    );

    results.push({
      researcherName: name,
      email: dataSources.researcherEmails?.[name],
      expertiseScore,
      experimentCount: titlesArray.length,
      avgQuality,
      recentExperiment: data.latestDate
        ? {
            title: titlesArray[titlesArray.length - 1],
            date: data.latestDate,
            yield: null as number | null,
          }
        : undefined,
      activityStatus,
      relevantExperiments,
    });
  });

  return results;
}

function matchTechnique(
  query: ExperienceQuery,
  dataSources: ExperienceDataSources
): ExperienceResult[] {
  const topicLower = query.topic.toLowerCase();
  const keywords = topicLower.split(/\s+/).filter((k) => k.length > 2);
  const refDate = dataSources.referenceDate ?? new Date();

  const byResearcher = new Map<
    string,
    { exps: ExperimentRef[]; totalQuality: number }
  >();

  for (const exp of dataSources.experiments) {
    const searchText = [
      exp.experimentId,
      exp.reactionType,
      ...exp.substrateClasses,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesAnyKeyword = keywords.some((kw) => searchText.includes(kw));
    if (!matchesAnyKeyword) continue;

    const existing = byResearcher.get(exp.researcherName);
    if (existing) {
      existing.exps.push(exp);
      existing.totalQuality += exp.qualityScore;
    } else {
      byResearcher.set(exp.researcherName, {
        exps: [exp],
        totalQuality: exp.qualityScore,
      });
    }
  }

  for (const profile of dataSources.profiles) {
    for (const contribution of profile.topContributions) {
      const searchText = [
        contribution.title,
        contribution.experimentTitle,
        contribution.reactionType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesAnyKeyword = keywords.some((kw) => searchText.includes(kw));
      if (!matchesAnyKeyword) continue;

      const existing = byResearcher.get(profile.researcherName);
      if (existing) {
        const alreadyHas = existing.exps.some(
          (e) => e.experimentId === contribution.experimentId
        );
        if (!alreadyHas) {
          existing.exps.push({
            experimentId: contribution.experimentId,
            researcherName: profile.researcherName,
            reactionType: contribution.reactionType,
            substrateClasses: [],
            date: contribution.date,
            qualityScore: contribution.qualityScore,
            yieldPercent: null,
          });
          existing.totalQuality += contribution.qualityScore;
        }
      } else {
        byResearcher.set(profile.researcherName, {
          exps: [
            {
              experimentId: contribution.experimentId,
              researcherName: profile.researcherName,
              reactionType: contribution.reactionType,
              substrateClasses: [],
              date: contribution.date,
              qualityScore: contribution.qualityScore,
              yieldPercent: null,
            },
          ],
          totalQuality: contribution.qualityScore,
        });
      }
    }
  }

  const results: ExperienceResult[] = [];

  Array.from(byResearcher.entries()).forEach(([name, data]) => {
    const profile = dataSources.profiles.find((p) => p.researcherName === name);
    const activityStatus: ActivityStatus =
      profile?.activityStatus ?? "inactive";
    const activityBonus = ACTIVITY_BONUS[activityStatus];

    const mostRecent = data.exps.reduce((latest, e) =>
      e.date > latest.date ? e : latest
    );

    const recencyBonus = computeRecencyBonus(mostRecent.date, refDate);
    const avgQuality = data.totalQuality / data.exps.length;
    const expertiseScore =
      data.exps.length * avgQuality * activityBonus * recencyBonus;

    const relevantExperiments: RelevantExperiment[] = data.exps.map((e) => ({
      title: e.experimentId,
      date: e.date,
      yield: e.yieldPercent,
    }));

    results.push({
      researcherName: name,
      email: dataSources.researcherEmails?.[name],
      expertiseScore,
      experimentCount: data.exps.length,
      avgQuality,
      recentExperiment: {
        title: mostRecent.experimentId,
        date: mostRecent.date,
        yield: mostRecent.yieldPercent,
      },
      activityStatus,
      relevantExperiments,
    });
  });

  return results;
}

export function findWhoHasExperience(
  query: ExperienceQuery,
  dataSources: ExperienceDataSources
): ExperienceResult[] {
  let results: ExperienceResult[];

  switch (query.topicType) {
    case "reaction":
      results = matchReaction(query, dataSources);
      break;
    case "substrate":
      results = matchSubstrate(query, dataSources);
      break;
    case "chemical":
      results = matchChemical(query, dataSources);
      break;
    case "technique":
      results = matchTechnique(query, dataSources);
      break;
  }

  if (!query.includeInactive) {
    results = results.filter((r) => r.activityStatus !== "inactive");
  }

  if (query.minExperiments !== undefined) {
    results = results.filter((r) => r.experimentCount >= query.minExperiments!);
  }

  results.sort((a, b) => b.expertiseScore - a.expertiseScore);

  return results;
}

export function formatExperienceResultsForAgent(
  results: ExperienceResult[],
  query: ExperienceQuery
): string {
  if (results.length === 0) {
    return `No researchers found with experience in "${query.topic}" (${query.topicType}). Consider broadening your search or removing filters.`;
  }

  const lines: string[] = [];
  lines.push(`## Who Has Experience: ${query.topic}\n`);
  lines.push(
    `Found ${results.length} researcher(s) with ${query.topicType} experience:\n`
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. [[${r.researcherName}]]`);
    lines.push("");
    lines.push(`- **Expertise Score:** ${r.expertiseScore.toFixed(1)}`);
    lines.push(`- **Experiments:** ${r.experimentCount}`);
    lines.push(`- **Avg Quality:** ${r.avgQuality.toFixed(1)}`);
    lines.push(`- **Status:** ${r.activityStatus}`);

    if (r.email) {
      lines.push(`- **Email:** ${r.email}`);
    }

    if (r.recentExperiment) {
      const dateStr = r.recentExperiment.date.toISOString().slice(0, 10);
      const yieldStr =
        r.recentExperiment.yield != null
          ? `, ${r.recentExperiment.yield}% yield`
          : "";
      lines.push(
        `- **Most Recent:** [[${r.recentExperiment.title}]] (${dateStr}${yieldStr})`
      );
    }

    if (r.relevantExperiments.length > 0) {
      lines.push(`- **Relevant Experiments:**`);
      for (const exp of r.relevantExperiments.slice(0, 5)) {
        const dateStr = exp.date.toISOString().slice(0, 10);
        const yieldStr =
          exp.yield != null ? `, ${exp.yield}% yield` : "";
        lines.push(`  - [[${exp.title}]] (${dateStr}${yieldStr})`);
      }
    }

    lines.push("");
  }

  const topResearcher = results[0];
  lines.push("---\n");
  lines.push(
    `**Recommendation:** Consider reaching out to [[${topResearcher.researcherName}]] who has ${topResearcher.activityStatus === "active" ? "recent" : ""} experience with ${query.topic} (${topResearcher.experimentCount} experiment${topResearcher.experimentCount !== 1 ? "s" : ""}).`
  );

  return lines.join("\n");
}
