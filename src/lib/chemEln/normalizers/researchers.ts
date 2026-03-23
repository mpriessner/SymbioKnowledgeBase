import type {
  ChemElnExperiment,
  ClassifiedExperiment,
  ResearcherProfile,
} from "../types";

interface ResearcherAccumulator {
  key: string;
  name: string;
  email: string | null;
  experiments: { id: string; title: string; date: string }[];
  reactionTypeCounts: Map<string, number>;
}

function resolveResearcherKey(experiment: ChemElnExperiment): string {
  const email = experiment.researcher?.email?.trim();
  if (email) {
    return email.toLowerCase();
  }
  const name = experiment.researcher?.name?.trim();
  if (name) {
    return `name:${name.toLowerCase()}`;
  }
  return "unknown";
}

function computePrimaryExpertise(
  reactionTypeCounts: Map<string, number>
): string[] {
  return Array.from(reactionTypeCounts.entries())
    .filter(([type]) => type !== "Unclassified")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reactionType]) => reactionType);
}

function buildRecentExperiments(
  experiments: { id: string; title: string; date: string }[],
  classificationMap: Map<string, string>
): { title: string; date: string; reactionType: string }[] {
  return [...experiments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((exp) => ({
      title: exp.title,
      date: exp.date,
      reactionType: classificationMap.get(exp.id) ?? "Unclassified",
    }));
}

export function extractResearchers(
  experiments: ChemElnExperiment[],
  classifications?: ClassifiedExperiment[]
): ResearcherProfile[] {
  const explicitClassifications = new Map<string, string>(
    (classifications ?? []).map((c) => [c.experimentId, c.reactionType])
  );

  const resolvedReactionTypes = new Map<string, string>();
  for (const exp of experiments) {
    resolvedReactionTypes.set(
      exp.id,
      explicitClassifications.get(exp.id) ?? exp.reaction_type ?? "Unclassified"
    );
  }

  const researcherMap = new Map<string, ResearcherAccumulator>();

  for (const exp of experiments) {
    const key = resolveResearcherKey(exp);
    const name = exp.researcher?.name?.trim() || "Unknown Researcher";
    const email = exp.researcher?.email?.trim() || null;

    if (!researcherMap.has(key)) {
      researcherMap.set(key, {
        key,
        name,
        email,
        experiments: [],
        reactionTypeCounts: new Map(),
      });
    }

    const accumulator = researcherMap.get(key)!;

    if (email && !accumulator.email) {
      accumulator.email = email;
    }
    if (name !== "Unknown Researcher" && accumulator.name === "Unknown Researcher") {
      accumulator.name = name;
    }

    accumulator.experiments.push({
      id: exp.id,
      title: exp.title,
      date: exp.date,
    });

    const reactionType = resolvedReactionTypes.get(exp.id) ?? "Unclassified";
    const currentCount = accumulator.reactionTypeCounts.get(reactionType) ?? 0;
    accumulator.reactionTypeCounts.set(reactionType, currentCount + 1);
  }

  const profiles: ResearcherProfile[] = [];

  for (const [, acc] of researcherMap) {
    profiles.push({
      userId: acc.key,
      name: acc.name,
      email: acc.email,
      totalExperiments: acc.experiments.length,
      experimentsByReactionType: Object.fromEntries(acc.reactionTypeCounts),
      primaryExpertise: computePrimaryExpertise(acc.reactionTypeCounts),
      recentExperiments: buildRecentExperiments(
        acc.experiments,
        resolvedReactionTypes
      ),
    });
  }

  return profiles.sort((a, b) => b.totalExperiments - a.totalExperiments);
}

export function getResearcherById(
  profiles: ResearcherProfile[],
  userId: string
): ResearcherProfile | null {
  return profiles.find((p) => p.userId === userId) ?? null;
}

export function getResearchersByExpertise(
  profiles: ResearcherProfile[],
  reactionType: string
): ResearcherProfile[] {
  return profiles.filter((p) => p.primaryExpertise.includes(reactionType));
}
