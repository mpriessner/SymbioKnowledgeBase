import * as fs from "fs/promises";
import * as path from "path";

export interface ExperimentSyncEntry {
  contentHash: string;
  lastUpdated: string;
  reactionType: string;
  researcher: string;
  skbPageId?: string;
}

export interface EnhancedSyncState {
  version: "1.0";
  lastSyncTimestamp: string;
  experiments: Record<string, ExperimentSyncEntry>;
}

const DEFAULT_ENHANCED_STATE: EnhancedSyncState = {
  version: "1.0",
  lastSyncTimestamp: new Date(0).toISOString(),
  experiments: {},
};

export class EnhancedSyncStateManager {
  private statePath: string;
  private state: EnhancedSyncState;

  constructor(statePath?: string) {
    this.statePath =
      statePath ??
      path.join(process.cwd(), ".sync-state", "chemeln-sync.json");
    this.state = { ...DEFAULT_ENHANCED_STATE, experiments: {} };
  }

  async load(): Promise<EnhancedSyncState> {
    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(raw) as EnhancedSyncState;
      if (parsed.version !== "1.0") {
        console.warn(
          `Unknown sync state version "${parsed.version}" — treating as first sync`,
        );
        this.state = { ...DEFAULT_ENHANCED_STATE, experiments: {} };
      } else {
        this.state = parsed;
      }
    } catch {
      this.state = { ...DEFAULT_ENHANCED_STATE, experiments: {} };
    }
    return this.state;
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${this.statePath}.tmp`;
    await fs.writeFile(
      tempPath,
      JSON.stringify(this.state, null, 2),
      "utf-8",
    );
    await fs.rename(tempPath, this.statePath);
  }

  getState(): EnhancedSyncState {
    return this.state;
  }

  getExperimentEntry(experimentId: string): ExperimentSyncEntry | null {
    return this.state.experiments[experimentId] ?? null;
  }

  setExperimentEntry(
    experimentId: string,
    entry: ExperimentSyncEntry,
  ): void {
    this.state.experiments[experimentId] = entry;
  }

  removeExperimentEntry(experimentId: string): void {
    delete this.state.experiments[experimentId];
  }

  getAllExperimentIds(): string[] {
    return Object.keys(this.state.experiments);
  }

  setLastSyncTimestamp(timestamp: string): void {
    this.state.lastSyncTimestamp = timestamp;
  }

  getLastSyncTimestamp(): string {
    return this.state.lastSyncTimestamp;
  }
}
