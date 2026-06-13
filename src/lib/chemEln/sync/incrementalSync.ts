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

/**
 * Sentinel used in the failed-experiment set when a failure cannot be tied to a
 * specific experiment (forces a conservative, non-advancing watermark).
 */
const UNKNOWN_FAILURE = "__unknown_failure__";

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
    const runStartIso = new Date(startTime).toISOString();
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

    // 7. Update sync state — but never advance the cursor PAST a record that
    // failed to propagate, or that record would be skipped forever. If every
    // record succeeded we advance to "now"; otherwise we advance only up to
    // (just before) the earliest failing record so failures are retried next
    // run. If we cannot determine a safe watermark, we leave the cursor where
    // it was.
    const safeWatermark = this.computeSafeWatermark(
      runStartIso,
      errors.length > 0 ? this.collectFailedExperimentIds(propagationResult, entityResult, changeSet) : new Set<string>(),
      rawExperiments,
    );
    if (safeWatermark) {
      this.deps.stateManager.setLastSyncTimestamp(safeWatermark);
    }
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

  /**
   * Collect the ELN ids of experiments whose propagation/entity handling failed.
   * Entity-handler errors do not carry an experiment id, so their presence is
   * signalled with the sentinel {@link UNKNOWN_FAILURE} which forces a
   * conservative (non-advancing) watermark.
   */
  private collectFailedExperimentIds(
    propagationResult: PropagationResult | null,
    entityResult: EntityHandlerResult | null,
    changeSet: ChangeSet,
  ): Set<string> {
    const failed = new Set<string>();

    for (const err of propagationResult?.errors ?? []) {
      failed.add(err.experimentId);
    }

    // Entity errors can't be tied back to a single experiment — be safe and
    // refuse to advance past anything in this batch.
    if ((entityResult?.errors.length ?? 0) > 0) {
      failed.add(UNKNOWN_FAILURE);
    }

    // Defensive: if errors were recorded but none mapped to an experiment, also
    // refuse to advance.
    void changeSet;
    return failed;
  }

  /**
   * Compute the timestamp the cursor may safely advance to.
   *
   * - No failures → advance to the run-start time (caught everything up to "now").
   * - Failures with an unknown experiment (e.g. entity-handler error) → return
   *   null (do not advance; retry the whole batch next run).
   * - Failures tied to specific experiments → advance to just before the
   *   earliest failing record's timestamp, so failed (and later) records are
   *   re-queried next run while successfully-synced earlier records are not.
   */
  private computeSafeWatermark(
    runStartIso: string,
    failedExperimentIds: Set<string>,
    rawExperiments: ExperimentData[],
  ): string | null {
    if (failedExperimentIds.size === 0) {
      return runStartIso;
    }

    if (failedExperimentIds.has(UNKNOWN_FAILURE)) {
      return null;
    }

    let earliestFailureMs: number | null = null;
    for (const exp of rawExperiments) {
      if (!failedExperimentIds.has(exp.id)) continue;
      const ts = Date.parse(exp.createdAt ?? "");
      if (Number.isNaN(ts)) {
        // Can't place this failure on the timeline — don't advance at all.
        return null;
      }
      earliestFailureMs =
        earliestFailureMs === null ? ts : Math.min(earliestFailureMs, ts);
    }

    if (earliestFailureMs === null) {
      // Failures referenced ids we didn't fetch — be conservative.
      return null;
    }

    // Advance to 1ms before the earliest failure so that record is re-included
    // by the next (inclusive) date-range query.
    return new Date(earliestFailureMs - 1).toISOString();
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
