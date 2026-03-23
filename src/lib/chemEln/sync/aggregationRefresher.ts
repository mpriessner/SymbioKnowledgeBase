import type { AffectedEntities } from "./updatePropagator";
import type { SkbAgentApiWriter } from "./writer";
import type { CrossReferenceResolver } from "./resolver";
import type {
  ExperimentData,
  ChemicalData,
  ChemicalUsage,
  ReactionTypeAggregation,
  ResearcherProfileData,
  KeyLearning,
} from "../types";
import type { ExpertiseProfile } from "../enrichment/types";
import {
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
} from "../generators";
import { extractKeyLearnings } from "../enrichment/keyLearnings";
import type { ExperimentWithNotes } from "../enrichment/keyLearnings";
import { getWhoToAsk } from "../enrichment/whoToAsk";
import { computeResearcherExpertise } from "../enrichment/expertiseComputation";
import type {
  ResearcherWithExperiments,
  ExpertiseExperimentInput,
} from "../enrichment/types";

export interface RefreshResult {
  refreshed: {
    chemicals: string[];
    reactionTypes: string[];
    researchers: string[];
  };
  skipped: string[];
  errors: RefreshError[];
}

export interface RefreshError {
  entityName: string;
  entityType: "chemical" | "reaction-type" | "researcher";
  message: string;
}

export interface AggregationRefresherConfig {
  parentIds?: Record<string, string>;
}

export class AggregationRefresher {
  private readonly writer: SkbAgentApiWriter;
  private readonly resolver: CrossReferenceResolver;
  private readonly config: AggregationRefresherConfig;

  constructor(
    writer: SkbAgentApiWriter,
    resolver: CrossReferenceResolver,
    config?: AggregationRefresherConfig,
  ) {
    this.writer = writer;
    this.resolver = resolver;
    this.config = config ?? {};
  }

  async refreshAffectedEntities(
    affectedEntities: AffectedEntities,
    allExperiments: ExperimentData[],
    allProfiles: ExpertiseProfile[],
  ): Promise<RefreshResult> {
    const deduplicated = deduplicateAffectedEntities(affectedEntities);

    const result: RefreshResult = {
      refreshed: {
        chemicals: [],
        reactionTypes: [],
        researchers: [],
      },
      skipped: [],
      errors: [],
    };

    // Process in order: chemicals -> reaction types -> researchers
    for (const chemicalId of deduplicated.chemicals) {
      try {
        const wasRefreshed = await this.refreshChemical(
          chemicalId,
          allExperiments,
        );
        if (wasRefreshed) {
          result.refreshed.chemicals.push(chemicalId);
        } else {
          result.skipped.push(`chemical:${chemicalId}`);
        }
      } catch (error) {
        result.errors.push({
          entityName: chemicalId,
          entityType: "chemical",
          message: (error as Error).message,
        });
      }
    }

    for (const reactionType of deduplicated.reactionTypes) {
      try {
        const wasRefreshed = await this.refreshReactionType(
          reactionType,
          allExperiments,
          allProfiles,
        );
        if (wasRefreshed) {
          result.refreshed.reactionTypes.push(reactionType);
        } else {
          result.skipped.push(`reaction-type:${reactionType}`);
        }
      } catch (error) {
        result.errors.push({
          entityName: reactionType,
          entityType: "reaction-type",
          message: (error as Error).message,
        });
      }
    }

    for (const researcher of deduplicated.researchers) {
      try {
        const wasRefreshed = await this.refreshResearcher(
          researcher,
          allExperiments,
          allProfiles,
        );
        if (wasRefreshed) {
          result.refreshed.researchers.push(researcher);
        } else {
          result.skipped.push(`researcher:${researcher}`);
        }
      } catch (error) {
        result.errors.push({
          entityName: researcher,
          entityType: "researcher",
          message: (error as Error).message,
        });
      }
    }

    return result;
  }

  private async refreshChemical(
    chemicalId: string,
    allExperiments: ExperimentData[],
  ): Promise<boolean> {
    const usages = this.aggregateChemicalUsages(chemicalId, allExperiments);

    const chemicalData = this.buildChemicalData(chemicalId, allExperiments);

    const markdown = generateChemicalPage(chemicalData, usages);
    const matchTag = chemicalData.casNumber
      ? `cas:${chemicalData.casNumber}`
      : `chemical:${chemicalId.toLowerCase().replace(/\s+/g, "-")}`;

    const upsertResult = await this.writer.upsertPage(markdown, matchTag, {
      parentId: this.config.parentIds?.chemicals,
    });

    return upsertResult.action !== "skipped";
  }

  private async refreshReactionType(
    reactionType: string,
    allExperiments: ExperimentData[],
    allProfiles: ExpertiseProfile[],
  ): Promise<boolean> {
    const experiments = allExperiments.filter(
      (e) => e.experimentType === reactionType,
    );

    const experimentCount = experiments.length;
    const yieldsWithData = experiments
      .flatMap((e) => e.products)
      .filter((p) => p.yield !== null)
      .map((p) => p.yield as number);
    const avgYield =
      yieldsWithData.length > 0
        ? yieldsWithData.reduce((sum, y) => sum + y, 0) / yieldsWithData.length
        : 0;

    const researcherSet = new Set(experiments.map((e) => e.createdBy));

    const experimentWithNotes: ExperimentWithNotes[] = experiments.map(
      (exp) => ({
        id: exp.id,
        title: exp.title,
        researcher: this.resolver.resolveResearcher(exp.createdBy),
        date: exp.createdAt.split("T")[0],
        qualityScore: this.computeQualityScore(exp),
        yieldPercent: this.getExperimentYield(exp),
        practicalNotes: {
          hasData: (exp.practicalNotes ?? []).length > 0,
          whatWorked: [],
          challenges: [],
          recommendations: [],
          timingTips: [],
          safetyNotes: [],
          deviations: [],
          tips: (exp.practicalNotes ?? [])
            .filter((n) => n.type === "tip")
            .map((n) => n.content),
          overallNotes: undefined,
        },
      }),
    );

    const keyLearningsResult = extractKeyLearnings(
      experimentWithNotes,
      reactionType,
    );

    const keyLearnings: KeyLearning[] = keyLearningsResult.map((rl) => ({
      content: rl.text,
      researcherName:
        rl.sourceExperiments[0]?.researcher ?? "Unknown",
      experimentId: "",
      date: rl.sourceExperiments[0]?.date ?? "",
      qualityScore: rl.qualityWeight,
    }));

    const whoToAskResult = getWhoToAsk({
      type: "reaction",
      reactionType,
      expertiseProfiles: allProfiles,
    });

    const topResearchers = whoToAskResult.recommendations.map((rec) => {
      const researcherExps = experiments.filter(
        (e) =>
          this.resolver.resolveResearcher(e.createdBy) === rec.researcherName,
      );
      const researcherYields = researcherExps
        .flatMap((e) => e.products)
        .filter((p) => p.yield !== null)
        .map((p) => p.yield as number);
      const researcherAvgYield =
        researcherYields.length > 0
          ? researcherYields.reduce((s, y) => s + y, 0) /
            researcherYields.length
          : 0;

      return {
        name: rec.researcherName,
        experimentCount: researcherExps.length,
        avgYield: researcherAvgYield,
      };
    });

    const aggregation: ReactionTypeAggregation = {
      name: reactionType,
      experimentCount,
      avgYield,
      researcherCount: researcherSet.size,
      experiments: experiments
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((exp) => ({
          id: exp.id,
          title: exp.title,
          yield: this.getExperimentYield(exp) ?? 0,
          researcher: this.resolver.resolveResearcher(exp.createdBy),
          date: exp.createdAt.split("T")[0],
        })),
      keyLearnings,
      commonPitfalls: keyLearningsResult
        .filter((l) => l.category === "warning")
        .map((l) => l.text),
      topResearchers,
    };

    const markdown = generateReactionTypePage(aggregation);
    const matchTag = `reaction:${reactionType.toLowerCase().replace(/\s+/g, "-")}`;

    const upsertResult = await this.writer.upsertPage(markdown, matchTag, {
      parentId: this.config.parentIds?.["reaction-types"],
    });

    return upsertResult.action !== "skipped";
  }

  private async refreshResearcher(
    researcherId: string,
    allExperiments: ExperimentData[],
    allProfiles: ExpertiseProfile[],
  ): Promise<boolean> {
    const researcherName = this.resolver.resolveResearcher(researcherId);
    const experiments = allExperiments.filter(
      (e) => e.createdBy === researcherId,
    );

    const totalExperiments = experiments.length;

    // Group by reaction type
    const byReactionType = new Map<string, ExperimentData[]>();
    for (const exp of experiments) {
      const group = byReactionType.get(exp.experimentType) ?? [];
      group.push(exp);
      byReactionType.set(exp.experimentType, group);
    }

    const topReactionTypes = Array.from(byReactionType.entries())
      .map(([name, exps]) => {
        const yields = exps
          .flatMap((e) => e.products)
          .filter((p) => p.yield !== null)
          .map((p) => p.yield as number);
        const avgYield =
          yields.length > 0
            ? yields.reduce((s, y) => s + y, 0) / yields.length
            : 0;
        return { name, count: exps.length, avgYield };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const recentExperiments = [...experiments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map((exp) => ({
        id: exp.id,
        title: exp.title,
        date: exp.createdAt.split("T")[0],
        reactionType: exp.experimentType,
      }));

    const existingProfile = allProfiles.find(
      (p) => p.researcherName === researcherName || p.researcherId === researcherId,
    );

    const keyContributions: string[] = existingProfile
      ? existingProfile.topContributions.map((c) => c.title)
      : [];

    const profileData: ResearcherProfileData = {
      name: researcherName,
      totalExperiments,
      topReactionTypes,
      recentExperiments,
      keyContributions,
    };

    const markdown = generateResearcherPage(profileData);
    const matchTag = `researcher:${researcherName.toLowerCase().replace(/\s+/g, "-")}`;

    const upsertResult = await this.writer.upsertPage(markdown, matchTag, {
      parentId: this.config.parentIds?.researchers,
    });

    return upsertResult.action !== "skipped";
  }

  private aggregateChemicalUsages(
    chemicalId: string,
    allExperiments: ExperimentData[],
  ): ChemicalUsage[] {
    const usages: ChemicalUsage[] = [];

    for (const exp of allExperiments) {
      for (const reagent of exp.reagents) {
        const identifier =
          reagent.chemical.casNumber ?? reagent.chemical.name;
        if (identifier === chemicalId || reagent.chemical.name === chemicalId) {
          usages.push({
            experimentId: exp.id,
            experimentTitle: exp.title,
            role: (reagent.role as ChemicalUsage["role"]) ?? "reagent",
            amount: reagent.amount,
            unit: reagent.unit,
          });
        }
      }

      for (const product of exp.products) {
        const identifier =
          product.chemical.casNumber ?? product.chemical.name;
        if (identifier === chemicalId || product.chemical.name === chemicalId) {
          usages.push({
            experimentId: exp.id,
            experimentTitle: exp.title,
            role: "product",
            amount: 0,
            unit: product.unit,
            yield: product.yield ?? undefined,
          });
        }
      }
    }

    // Sort by experiment date (most recent first) using experiment ID as proxy
    usages.sort((a, b) => b.experimentId.localeCompare(a.experimentId));

    return usages;
  }

  private buildChemicalData(
    chemicalId: string,
    allExperiments: ExperimentData[],
  ): ChemicalData {
    for (const exp of allExperiments) {
      for (const reagent of exp.reagents) {
        const identifier =
          reagent.chemical.casNumber ?? reagent.chemical.name;
        if (identifier === chemicalId || reagent.chemical.name === chemicalId) {
          return {
            id: reagent.chemical.id,
            name: reagent.chemical.name,
            casNumber: reagent.chemical.casNumber ?? undefined,
            molecularFormula: reagent.chemical.molecularFormula ?? undefined,
          };
        }
      }
      for (const product of exp.products) {
        const identifier =
          product.chemical.casNumber ?? product.chemical.name;
        if (identifier === chemicalId || product.chemical.name === chemicalId) {
          return {
            id: product.chemical.id,
            name: product.chemical.name,
            casNumber: product.chemical.casNumber ?? undefined,
            molecularFormula: product.chemical.molecularFormula ?? undefined,
          };
        }
      }
    }

    return {
      id: chemicalId,
      name: chemicalId,
    };
  }

  private computeQualityScore(exp: ExperimentData): number {
    let score = 3;
    const yld = this.getExperimentYield(exp);
    if (yld !== null) {
      if (yld >= 90) score = 5;
      else if (yld >= 70) score = 4;
      else if (yld >= 50) score = 3;
      else score = 2;
    }
    if ((exp.practicalNotes ?? []).length > 0) score += 0.5;
    return Math.min(score, 5);
  }

  private getExperimentYield(exp: ExperimentData): number | null {
    const yields = exp.products
      .filter((p) => p.yield !== null)
      .map((p) => p.yield as number);
    if (yields.length === 0) return null;
    return yields.reduce((sum, y) => sum + y, 0) / yields.length;
  }
}

export function deduplicateAffectedEntities(
  affected: AffectedEntities,
): AffectedEntities {
  return {
    chemicals: Array.from(new Set(affected.chemicals)),
    reactionTypes: Array.from(new Set(affected.reactionTypes)),
    researchers: Array.from(new Set(affected.researchers)),
  };
}
