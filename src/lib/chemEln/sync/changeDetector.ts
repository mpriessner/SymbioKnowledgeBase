import type { EnhancedSyncState } from "./enhancedSyncState";

export interface ExperimentSnapshot {
  id: string;
  updatedAt: string;
  contentHash: string;
}

export interface ChangeSet {
  new: ExperimentSnapshot[];
  updated: ExperimentSnapshot[];
  deleted: string[];
  unchanged: string[];
}

export const CLOCK_SKEW_BUFFER_MS = 60_000;

export class ChangeDetector {
  detectChanges(
    currentExperiments: ExperimentSnapshot[],
    syncState: EnhancedSyncState,
  ): ChangeSet {
    const changeSet: ChangeSet = {
      new: [],
      updated: [],
      deleted: [],
      unchanged: [],
    };

    const currentIds = new Set<string>();

    for (const experiment of currentExperiments) {
      currentIds.add(experiment.id);

      const entry = syncState.experiments[experiment.id];

      if (!entry) {
        changeSet.new.push(experiment);
      } else if (entry.contentHash !== experiment.contentHash) {
        changeSet.updated.push(experiment);
      } else {
        changeSet.unchanged.push(experiment.id);
      }
    }

    for (const experimentId of Object.keys(syncState.experiments)) {
      if (!currentIds.has(experimentId)) {
        changeSet.deleted.push(experimentId);
      }
    }

    return changeSet;
  }

  getQueryTimestamp(syncState: EnhancedSyncState): string {
    const lastSync = new Date(syncState.lastSyncTimestamp);
    const adjusted = new Date(lastSync.getTime() - CLOCK_SKEW_BUFFER_MS);
    return adjusted.toISOString();
  }
}
