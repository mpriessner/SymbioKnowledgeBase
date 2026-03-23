import { EnhancedSyncStateManager } from "./enhancedSyncState";
import type { EnhancedSyncState } from "./enhancedSyncState";
import { ChangeDetector } from "./changeDetector";
import type { ChangeSet, ExperimentSnapshot } from "./changeDetector";
import { UpdatePropagator } from "./updatePropagator";
import type { PropagationResult } from "./updatePropagator";
import { NewEntityHandler } from "./newEntityHandler";
import type { EntityHandlerResult } from "./newEntityHandler";
import type { SkbAgentApiWriter } from "./writer";
import type { CrossReferenceResolver } from "./resolver";
import { computeContentHash } from "./contentHasher";
import type { ChemElnClient } from "../client";
import type { ExperimentData } from "../types";
import {
  fetchAndTransformExperiments,
  type ChemElnClient as FetcherClient,
} from "../experimentFetcher";

export interface IncrementalSyncOptions {
  tenantId: string;
  dryRun?: boolean;
  full?: boolean;
  verbose?: boolean;
  experimentId?: string;
  force?: boolean;
}

export interface IncrementalSyncResult {
  changeSet: {
    new: number;
    updated: number;
    deleted: number;
    unchanged: number;
  };
  propagationResult: PropagationResult | null;
  entityResult: EntityHandlerResult | null;
  duration: number;
  nextSyncRecommendation: string;
  status: "success" | "partial_failure" | "failure";
  errors: string[];
}

export interface IncrementalSyncDeps {
  chemElnClient: ChemElnClient;
  writer: SkbAgentApiWriter;
  resolver: CrossReferenceResolver;
  stateManager: EnhancedSyncStateManager;
  parentIds?: Record<string, string>;
}

export class IncrementalSyncRunner {
  private readonly deps: IncrementalSyncDeps;
  private readonly changeDetector: ChangeDetector;

  constructor(deps: IncrementalSyncDeps) {
    this.deps = deps;
    this.changeDetector = new ChangeDetector();
  }

  async runIncrementalSync(
    options: IncrementalSyncOptions,
  ): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // 1. Load enhanced sync state
    const syncState = await this.deps.stateManager.load();

    // 2. Query ChemELN for experiments changed since lastSyncTimestamp
    const dateRange = this.buildDateRange(syncState, options);

    let fetchResult;
    try {
      fetchResult = await fetchAndTransformExperiments(
        this.deps.chemElnClient as unknown as FetcherClient,
        { dateRange },
      );
    } catch (error) {
      return {
        changeSet: { new: 0, updated: 0, deleted: 0, unchanged: 0 },
        propagationResult: null,
        entityResult: null,
        duration: Date.now() - startTime,
        nextSyncRecommendation: "retry immediately",
        status: "failure",
        errors: [`ChemELN fetch failed: ${(error as Error).message}`],
      };
    }

    // Build experiment snapshots for change detection
    const currentExperiments: ExperimentSnapshot[] =
      fetchResult.experiments.map((e) => ({
        id: e.frontmatter.elnId,
        updatedAt: e.frontmatter.date,
        contentHash: computeContentHash(
          e.pageData as unknown as Record<string, unknown>,
        ),
      }));

    // Build ExperimentData for propagation
    const rawExperiments: ExperimentData[] = fetchResult.experiments.map(
      (e) =>
        ({
          id: e.frontmatter.elnId,
          title: e.frontmatter.title,
          experimentType: e.frontmatter.reactionType ?? "unknown",
          status: e.frontmatter.status,
          createdBy: e.frontmatter.researcher,
          createdAt: e.frontmatter.date,
          reagents: [],
          products: [],
          actualProcedure: null,
          procedureMetadata: null,
        }) as ExperimentData,
    );

    // 3. Run change detection
    const changeSet: ChangeSet = this.changeDetector.detectChanges(
      currentExperiments,
      syncState,
    );

    const changeSummary = {
      new: changeSet.new.length,
      updated: changeSet.updated.length,
      deleted: changeSet.deleted.length,
      unchanged: changeSet.unchanged.length,
    };

    if (options.verbose) {
      console.log(
        `  Changes detected: ${changeSummary.new} new, ${changeSummary.updated} updated, ${changeSummary.deleted} deleted, ${changeSummary.unchanged} unchanged`,
      );
    }

    // 4. If dry-run: report what would change and exit
    if (options.dryRun) {
      return {
        changeSet: changeSummary,
        propagationResult: null,
        entityResult: null,
        duration: Date.now() - startTime,
        nextSyncRecommendation: this.recommendNextSync(changeSummary),
        status: "success",
        errors: [],
      };
    }

    // 5. Run update propagation for new/updated/deleted experiments
    let propagationResult: PropagationResult | null = null;
    try {
      const propagator = new UpdatePropagator(
        this.deps.writer,
        this.deps.resolver,
        this.deps.stateManager,
        { parentIds: { experiments: this.deps.parentIds?.experiments } },
      );

      propagationResult = await propagator.propagateChanges(
        changeSet,
        rawExperiments,
      );

      if (propagationResult.errors.length > 0) {
        for (const err of propagationResult.errors) {
          errors.push(
            `Propagation error [${err.operation}] ${err.experimentId}: ${err.message}`,
          );
        }
      }
    } catch (error) {
      errors.push(`Propagation failed: ${(error as Error).message}`);
    }

    // 6. Run new entity handling for any new entities
    let entityResult: EntityHandlerResult | null = null;
    if (propagationResult) {
      try {
        const entityHandler = new NewEntityHandler(
          this.deps.writer,
          this.deps.resolver,
          { parentIds: this.deps.parentIds },
        );

        entityResult = await entityHandler.handleNewEntities(
          propagationResult.affectedEntities,
        );

        if (entityResult.errors.length > 0) {
          for (const err of entityResult.errors) {
            errors.push(
              `Entity error [${err.entityType}] ${err.entityName}: ${err.message}`,
            );
          }
        }
      } catch (error) {
        errors.push(`Entity handling failed: ${(error as Error).message}`);
      }
    }

    // 7. Update sync state with new timestamp and content hashes
    this.deps.stateManager.setLastSyncTimestamp(new Date().toISOString());
    try {
      await this.deps.stateManager.save();
    } catch (error) {
      errors.push(`Failed to save sync state: ${(error as Error).message}`);
    }

    // 8. Return summary report
    const duration = Date.now() - startTime;
    const hasPartialErrors = errors.length > 0;

    return {
      changeSet: changeSummary,
      propagationResult,
      entityResult,
      duration,
      nextSyncRecommendation: this.recommendNextSync(changeSummary),
      status: hasPartialErrors ? "partial_failure" : "success",
      errors,
    };
  }

  private buildDateRange(
    syncState: EnhancedSyncState,
    options: IncrementalSyncOptions,
  ): { start: string; end: string } | undefined {
    if (options.full) {
      return undefined;
    }

    const lastTimestamp = syncState.lastSyncTimestamp;
    const isFirstSync = lastTimestamp === new Date(0).toISOString();

    if (isFirstSync) {
      return undefined;
    }

    const queryTimestamp = this.changeDetector.getQueryTimestamp(syncState);
    return {
      start: queryTimestamp,
      end: new Date().toISOString(),
    };
  }

  private recommendNextSync(changeSummary: {
    new: number;
    updated: number;
    deleted: number;
  }): string {
    const totalChanges =
      changeSummary.new + changeSummary.updated + changeSummary.deleted;

    if (totalChanges === 0) {
      return "No changes detected. Next sync in 30 minutes.";
    }

    if (totalChanges > 50) {
      return "High activity detected. Consider syncing every 5 minutes.";
    }

    if (totalChanges > 10) {
      return "Moderate activity. Next sync in 15 minutes.";
    }

    return "Low activity. Next sync in 30 minutes.";
  }
}
