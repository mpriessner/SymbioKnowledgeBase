import * as fs from "fs/promises";
import * as path from "path";

export interface SyncState {
  lastSyncTimestamp: string | null;
  pageHashes: Record<string, string>;
  lastSyncResults: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    timestamp: string;
  } | null;
}

const DEFAULT_STATE: SyncState = {
  lastSyncTimestamp: null,
  pageHashes: {},
  lastSyncResults: null,
};

export class SyncStateManager {
  private statePath: string;
  private state: SyncState;

  constructor(statePath?: string) {
    this.statePath =
      statePath ?? path.join(process.cwd(), "data", "sync-state.json");
    this.state = { ...DEFAULT_STATE, pageHashes: {} };
  }

  async load(): Promise<SyncState> {
    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      this.state = JSON.parse(raw) as SyncState;
    } catch {
      this.state = { ...DEFAULT_STATE, pageHashes: {} };
    }
    return this.state;
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.statePath,
      JSON.stringify(this.state, null, 2),
      "utf-8",
    );
  }

  getPageHash(tag: string): string | null {
    return this.state.pageHashes[tag] ?? null;
  }

  setPageHash(tag: string, hash: string): void {
    this.state.pageHashes[tag] = hash;
  }

  isPageChanged(tag: string, newHash: string): boolean {
    const existingHash = this.getPageHash(tag);
    return existingHash !== newHash;
  }

  getLastSyncTime(): Date | null {
    return this.state.lastSyncTimestamp
      ? new Date(this.state.lastSyncTimestamp)
      : null;
  }

  getLastSyncTimestamp(): string | null {
    return this.state.lastSyncTimestamp;
  }

  updateResults(results: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  }): void {
    const now = new Date().toISOString();
    this.state.lastSyncTimestamp = now;
    this.state.lastSyncResults = {
      ...results,
      timestamp: now,
    };
  }

  getState(): SyncState {
    return this.state;
  }
}
