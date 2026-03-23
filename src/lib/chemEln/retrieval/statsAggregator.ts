import type { KbStats } from "./indexPage";

export interface AggregatorInput {
  experiments: Array<{
    id: string;
    title: string;
    date: string;
    reactionType: string;
    researcher: string;
  }>;
  chemicals: Array<{ name: string }>;
  reactionTypes: Array<{ name: string }>;
  researchers: Array<{ name: string }>;
}

export function aggregateKbStats(data: AggregatorInput): KbStats {
  const totalExperiments = data.experiments.length;
  const totalChemicals = data.chemicals.length;
  const totalResearchers = data.researchers.length;

  // Count experiments per reaction type
  const reactionCountMap = new Map<string, number>();
  for (const rt of data.reactionTypes) {
    reactionCountMap.set(rt.name, 0);
  }
  for (const exp of data.experiments) {
    const current = reactionCountMap.get(exp.reactionType) ?? 0;
    reactionCountMap.set(exp.reactionType, current + 1);
  }
  const reactionTypes = Array.from(reactionCountMap.entries())
    .map(([name, experimentCount]) => ({ name, experimentCount }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get recent experiments (last 30 days, or top 5 if fewer)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const sortedExperiments = [...data.experiments].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  let recentExperiments = sortedExperiments.filter(
    (exp) => exp.date >= thirtyDaysAgoStr
  );
  if (recentExperiments.length === 0) {
    recentExperiments = sortedExperiments.slice(0, 5);
  } else {
    recentExperiments = recentExperiments.slice(0, 5);
  }

  const recentExperimentSummaries = recentExperiments.map((exp) => ({
    title: exp.title,
    date: exp.date,
    reactionType: exp.reactionType,
  }));

  // Rank researchers by experiment count
  const researcherCountMap = new Map<string, number>();
  for (const exp of data.experiments) {
    const current = researcherCountMap.get(exp.researcher) ?? 0;
    researcherCountMap.set(exp.researcher, current + 1);
  }
  const topResearchers = Array.from(researcherCountMap.entries())
    .map(([name, experimentCount]) => ({ name, experimentCount }))
    .sort((a, b) => b.experimentCount - a.experimentCount);

  return {
    totalExperiments,
    totalChemicals,
    totalResearchers,
    reactionTypes,
    recentExperiments: recentExperimentSummaries,
    topResearchers,
  };
}
