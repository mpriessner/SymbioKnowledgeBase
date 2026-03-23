import type {
  IncrementalSyncOptions,
  IncrementalSyncResult,
} from "./incrementalSync";
import { IncrementalSyncRunner } from "./incrementalSync";
import type { IncrementalSyncDeps } from "./incrementalSync";

export interface SchedulerStatus {
  running: boolean;
  lastRun: Date | null;
  lastResult: IncrementalSyncResult | null;
  nextRun: Date | null;
  runCount: number;
  consecutiveErrors: number;
}

export class SyncScheduler {
  private readonly runner: IncrementalSyncRunner;
  private readonly options: IncrementalSyncOptions;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isSyncInProgress = false;
  private lastRun: Date | null = null;
  private lastResult: IncrementalSyncResult | null = null;
  private nextRun: Date | null = null;
  private runCount = 0;
  private consecutiveErrors = 0;
  private intervalMs = 0;

  constructor(deps: IncrementalSyncDeps, options: IncrementalSyncOptions) {
    this.runner = new IncrementalSyncRunner(deps);
    this.options = options;
  }

  schedule(intervalMs: number): void {
    if (this.isRunning) {
      throw new Error("Scheduler is already running. Call stop() first.");
    }

    this.intervalMs = intervalMs;
    this.isRunning = true;
    this.nextRun = new Date(Date.now() + intervalMs);

    // Run immediately on first schedule
    void this.executeSync();

    this.intervalId = setInterval(() => {
      void this.executeSync();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.nextRun = null;
  }

  getStatus(): SchedulerStatus {
    return {
      running: this.isRunning,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      nextRun: this.nextRun,
      runCount: this.runCount,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  private async executeSync(): Promise<void> {
    // Prevent concurrent runs
    if (this.isSyncInProgress) {
      console.log(
        "[SyncScheduler] Skipping run — previous sync still in progress",
      );
      return;
    }

    this.isSyncInProgress = true;
    this.lastRun = new Date();

    try {
      const result = await this.runner.runIncrementalSync(this.options);
      this.lastResult = result;
      this.runCount++;

      if (result.status === "failure") {
        this.consecutiveErrors++;
        console.error(
          `[SyncScheduler] Sync failed (${this.consecutiveErrors} consecutive errors):`,
          result.errors,
        );
      } else {
        this.consecutiveErrors = 0;
        if (result.status === "partial_failure") {
          console.warn(
            "[SyncScheduler] Sync completed with errors:",
            result.errors,
          );
        }
      }
    } catch (error) {
      this.consecutiveErrors++;
      console.error(
        `[SyncScheduler] Unexpected error (${this.consecutiveErrors} consecutive):`,
        (error as Error).message,
      );
    } finally {
      this.isSyncInProgress = false;
      if (this.isRunning) {
        this.nextRun = new Date(Date.now() + this.intervalMs);
      }
    }
  }
}
