import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncScheduler } from "@/lib/chemEln/sync/scheduler";
import type { IncrementalSyncDeps, IncrementalSyncOptions } from "@/lib/chemEln/sync/incrementalSync";

// Mock the IncrementalSyncRunner so we don't need real deps
vi.mock("@/lib/chemEln/sync/incrementalSync", () => {
  class MockIncrementalSyncRunner {
    async runIncrementalSync() {
      return {
        changeSet: { new: 0, updated: 0, deleted: 0, unchanged: 0 },
        propagationResult: null,
        entityResult: null,
        duration: 100,
        nextSyncRecommendation: "normal",
        status: "success" as const,
        errors: [],
      };
    }
  }
  return {
    IncrementalSyncRunner: MockIncrementalSyncRunner,
  };
});

describe("SyncScheduler", () => {
  let scheduler: SyncScheduler;
  const mockDeps = {} as IncrementalSyncDeps;
  const mockOptions: IncrementalSyncOptions = { tenantId: "test-tenant" };

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SyncScheduler(mockDeps, mockOptions);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it("should report not running before schedule is called", () => {
    const status = scheduler.getStatus();
    expect(status.running).toBe(false);
    expect(status.lastRun).toBeNull();
    expect(status.lastResult).toBeNull();
    expect(status.nextRun).toBeNull();
    expect(status.runCount).toBe(0);
    expect(status.consecutiveErrors).toBe(0);
  });

  it("should set running to true after schedule is called", () => {
    scheduler.schedule(60_000);
    const status = scheduler.getStatus();
    expect(status.running).toBe(true);
  });

  it("should set nextRun after schedule is called", () => {
    const before = Date.now();
    scheduler.schedule(60_000);
    const status = scheduler.getStatus();
    expect(status.nextRun).not.toBeNull();
    expect(status.nextRun!.getTime()).toBeGreaterThanOrEqual(before + 60_000);
  });

  it("should throw if schedule is called while already running", () => {
    scheduler.schedule(60_000);
    expect(() => scheduler.schedule(30_000)).toThrow(
      "Scheduler is already running"
    );
  });

  it("should set running to false after stop", () => {
    scheduler.schedule(60_000);
    scheduler.stop();
    const status = scheduler.getStatus();
    expect(status.running).toBe(false);
    expect(status.nextRun).toBeNull();
  });

  it("should allow re-scheduling after stop", () => {
    scheduler.schedule(60_000);
    scheduler.stop();
    // Should not throw
    scheduler.schedule(30_000);
    expect(scheduler.getStatus().running).toBe(true);
  });

  it("should increment runCount after sync executes", async () => {
    scheduler.schedule(60_000);
    // Let the immediate executeSync run
    await vi.advanceTimersByTimeAsync(0);
    const status = scheduler.getStatus();
    expect(status.runCount).toBe(1);
    expect(status.lastRun).not.toBeNull();
  });

  it("should update lastResult after sync executes", async () => {
    scheduler.schedule(60_000);
    await vi.advanceTimersByTimeAsync(0);
    const status = scheduler.getStatus();
    expect(status.lastResult).not.toBeNull();
    expect(status.lastResult!.status).toBe("success");
  });
});
