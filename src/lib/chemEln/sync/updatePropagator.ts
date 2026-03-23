import type { ChangeSet, ExperimentSnapshot } from "./changeDetector";
import type {
  EnhancedSyncState,
  ExperimentSyncEntry,
} from "./enhancedSyncState";
import { EnhancedSyncStateManager } from "./enhancedSyncState";
import type { SkbAgentApiWriter } from "./writer";
import type { CrossReferenceResolver } from "./resolver";
import type { ExperimentData } from "../types";
import {
  generateExperimentPage,
  type ExperimentPageContext,
} from "../generators/experiment";

export interface AffectedEntities {
  chemicals: string[];
  reactionTypes: string[];
  researchers: string[];
}

export interface PropagationError {
  experimentId: string;
  operation: "create" | "update" | "archive";
  message: string;
}

export interface PropagationResult {
  experimentsCreated: number;
  experimentsUpdated: number;
  experimentsArchived: number;
  affectedEntities: AffectedEntities;
  errors: PropagationError[];
}

export interface UpdatePropagatorConfig {
  parentIds?: {
    experiments?: string;
  };
}

export class UpdatePropagator {
  private readonly writer: SkbAgentApiWriter;
  private readonly resolver: CrossReferenceResolver;
  private readonly stateManager: EnhancedSyncStateManager;
  private readonly config: UpdatePropagatorConfig;

  constructor(
    writer: SkbAgentApiWriter,
    resolver: CrossReferenceResolver,
    stateManager: EnhancedSyncStateManager,
    config?: UpdatePropagatorConfig,
  ) {
    this.writer = writer;
    this.resolver = resolver;
    this.stateManager = stateManager;
    this.config = config ?? {};
  }

  async propagateChanges(
    changeSet: ChangeSet,
    rawExperiments: ExperimentData[],
  ): Promise<PropagationResult> {
    const result: PropagationResult = {
      experimentsCreated: 0,
      experimentsUpdated: 0,
      experimentsArchived: 0,
      affectedEntities: { chemicals: [], reactionTypes: [], researchers: [] },
      errors: [],
    };

    const experimentMap = new Map<string, ExperimentData>();
    for (const exp of rawExperiments) {
      experimentMap.set(exp.id, exp);
    }

    const allAffected: AffectedEntities = {
      chemicals: [],
      reactionTypes: [],
      researchers: [],
    };

    for (const snapshot of changeSet.new) {
      const experiment = experimentMap.get(snapshot.id);
      if (!experiment) {
        result.errors.push({
          experimentId: snapshot.id,
          operation: "create",
          message: `Experiment data not found in rawExperiments for id ${snapshot.id}`,
        });
        continue;
      }

      try {
        await this.handleNewExperiment(experiment, snapshot);
        result.experimentsCreated++;
        const affected = getAffectedEntities(experiment);
        mergeAffected(allAffected, affected);
      } catch (error) {
        result.errors.push({
          experimentId: snapshot.id,
          operation: "create",
          message: (error as Error).message,
        });
      }
    }

    for (const snapshot of changeSet.updated) {
      const experiment = experimentMap.get(snapshot.id);
      if (!experiment) {
        result.errors.push({
          experimentId: snapshot.id,
          operation: "update",
          message: `Experiment data not found in rawExperiments for id ${snapshot.id}`,
        });
        continue;
      }

      try {
        const affected = this.getAffectedEntitiesForUpdate(experiment);
        const wasUpdated = await this.handleUpdatedExperiment(
          experiment,
          snapshot,
        );
        if (wasUpdated) {
          result.experimentsUpdated++;
        }
        mergeAffected(allAffected, affected);
      } catch (error) {
        result.errors.push({
          experimentId: snapshot.id,
          operation: "update",
          message: (error as Error).message,
        });
      }
    }

    for (const experimentId of changeSet.deleted) {
      try {
        const oldEntry = this.stateManager.getExperimentEntry(experimentId);
        await this.handleDeletedExperiment(experimentId);
        result.experimentsArchived++;
        if (oldEntry) {
          const affected: AffectedEntities = {
            chemicals: [],
            reactionTypes: oldEntry.reactionType ? [oldEntry.reactionType] : [],
            researchers: oldEntry.researcher ? [oldEntry.researcher] : [],
          };
          mergeAffected(allAffected, affected);
        }
      } catch (error) {
        result.errors.push({
          experimentId,
          operation: "archive",
          message: (error as Error).message,
        });
      }
    }

    result.affectedEntities = deduplicateAffected(allAffected);
    return result;
  }

  private async handleNewExperiment(
    experiment: ExperimentData,
    snapshot: ExperimentSnapshot,
  ): Promise<void> {
    const context = this.buildPageContext(experiment);
    const markdown = generateExperimentPage(experiment, context);
    const tag = `eln:${experiment.id}`;

    const upsertResult = await this.writer.upsertPage(markdown, tag, {
      parentId: this.config.parentIds?.experiments,
    });

    const entry: ExperimentSyncEntry = {
      contentHash: snapshot.contentHash,
      lastUpdated: snapshot.updatedAt,
      reactionType: experiment.experimentType,
      researcher: this.resolver.resolveResearcher(experiment.createdBy),
      skbPageId: upsertResult.pageId,
    };
    this.stateManager.setExperimentEntry(experiment.id, entry);
  }

  private async handleUpdatedExperiment(
    experiment: ExperimentData,
    snapshot: ExperimentSnapshot,
  ): Promise<boolean> {
    const context = this.buildPageContext(experiment);
    const markdown = generateExperimentPage(experiment, context);
    const newContentHash = this.writer.computeHash(markdown);
    const tag = `eln:${experiment.id}`;

    const existingEntry = this.stateManager.getExperimentEntry(experiment.id);

    if (existingEntry && existingEntry.contentHash === newContentHash) {
      return false;
    }

    const upsertResult = await this.writer.upsertPage(markdown, tag, {
      parentId: this.config.parentIds?.experiments,
    });

    const entry: ExperimentSyncEntry = {
      contentHash: snapshot.contentHash,
      lastUpdated: snapshot.updatedAt,
      reactionType: experiment.experimentType,
      researcher: this.resolver.resolveResearcher(experiment.createdBy),
      skbPageId: upsertResult.pageId,
    };
    this.stateManager.setExperimentEntry(experiment.id, entry);

    return true;
  }

  private async handleDeletedExperiment(
    experimentId: string,
  ): Promise<void> {
    const entry = this.stateManager.getExperimentEntry(experimentId);
    const tag = `eln:${experimentId}`;

    if (entry?.skbPageId) {
      const existingPages = await this.writer.searchPages(`tag:${tag}`);
      if (existingPages.length > 0) {
        const page = await this.writer.getPage(existingPages[0].id);
        if (page) {
          const archivedMarkdown = this.addArchivedTag(page.markdown);
          await this.writer.updatePage(existingPages[0].id, archivedMarkdown);
        }
      }
    }

    this.stateManager.removeExperimentEntry(experimentId);
  }

  private addArchivedTag(markdown: string): string {
    if (markdown.startsWith("---")) {
      const endIdx = markdown.indexOf("---", 3);
      if (endIdx !== -1) {
        const frontmatter = markdown.slice(0, endIdx);
        const rest = markdown.slice(endIdx);

        if (frontmatter.includes("tags:")) {
          const updatedFrontmatter = frontmatter.replace(
            /tags:\s*\[([^\]]*)\]/,
            (match, existing: string) => {
              const tags = existing
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean);
              if (!tags.includes("archived")) {
                tags.push("archived");
              }
              return `tags: [${tags.join(", ")}]`;
            },
          );
          return updatedFrontmatter + rest;
        }

        return frontmatter + "tags: [archived]\n" + rest;
      }
    }

    return `---\ntags: [archived]\n---\n${markdown}`;
  }

  private buildPageContext(experiment: ExperimentData): ExperimentPageContext {
    return {
      researcherName: this.resolver.resolveResearcher(experiment.createdBy),
      reactionType: experiment.experimentType,
    };
  }

  private getAffectedEntitiesForUpdate(
    experiment: ExperimentData,
  ): AffectedEntities {
    const affected = getAffectedEntities(experiment);

    const oldEntry = this.stateManager.getExperimentEntry(experiment.id);
    if (oldEntry) {
      if (
        oldEntry.reactionType &&
        oldEntry.reactionType !== experiment.experimentType
      ) {
        if (!affected.reactionTypes.includes(oldEntry.reactionType)) {
          affected.reactionTypes.push(oldEntry.reactionType);
        }
      }
      const newResearcher = this.resolver.resolveResearcher(
        experiment.createdBy,
      );
      if (oldEntry.researcher && oldEntry.researcher !== newResearcher) {
        if (!affected.researchers.includes(oldEntry.researcher)) {
          affected.researchers.push(oldEntry.researcher);
        }
      }
    }

    return affected;
  }
}

export function getAffectedEntities(
  experiment: ExperimentData,
): AffectedEntities {
  const chemicals: string[] = [];

  for (const reagent of experiment.reagents) {
    const identifier =
      reagent.chemical.casNumber ?? reagent.chemical.name;
    if (!chemicals.includes(identifier)) {
      chemicals.push(identifier);
    }
  }

  for (const product of experiment.products) {
    const identifier =
      product.chemical.casNumber ?? product.chemical.name;
    if (!chemicals.includes(identifier)) {
      chemicals.push(identifier);
    }
  }

  const reactionTypes: string[] = [];
  if (experiment.experimentType) {
    reactionTypes.push(experiment.experimentType);
  }

  const researchers: string[] = [];
  if (experiment.createdBy) {
    researchers.push(experiment.createdBy);
  }

  return { chemicals, reactionTypes, researchers };
}

function mergeAffected(
  target: AffectedEntities,
  source: AffectedEntities,
): void {
  for (const chemical of source.chemicals) {
    if (!target.chemicals.includes(chemical)) {
      target.chemicals.push(chemical);
    }
  }
  for (const rt of source.reactionTypes) {
    if (!target.reactionTypes.includes(rt)) {
      target.reactionTypes.push(rt);
    }
  }
  for (const researcher of source.researchers) {
    if (!target.researchers.includes(researcher)) {
      target.researchers.push(researcher);
    }
  }
}

function deduplicateAffected(
  affected: AffectedEntities,
): AffectedEntities {
  return {
    chemicals: Array.from(new Set(affected.chemicals)),
    reactionTypes: Array.from(new Set(affected.reactionTypes)),
    researchers: Array.from(new Set(affected.researchers)),
  };
}
