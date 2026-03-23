import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IncrementalSyncRunner,
  type IncrementalSyncDeps,
  type IncrementalSyncOptions,
} from "@/lib/chemEln/sync/incrementalSync";
import { SyncScheduler } from "@/lib/chemEln/sync/scheduler";
import { EnhancedSyncStateManager } from "@/lib/chemEln/sync/enhancedSyncState";
import type { EnhancedSyncState } from "@/lib/chemEln/sync/enhancedSyncState";

vi.mock("@/lib/chemEln/experimentFetcher", () => ({
  fetchAndTransformExperiments: vi.fn(),
}));

import { fetchAndTransformExperiments } from "@/lib/chemEln/experimentFetcher";

const mockFetch = vi.mocked(fetchAndTransformExperiments);

function createMockWriter() {
  return {
    upsertPage: vi.fn().mockResolvedValue({
      action: "created" as const,
      pageId: "page-123",
      title: "Test Page",
      contentHash: "abc123",
    }),
    updatePage: vi.fn().mockResolvedValue({
      id: "page-123",
      title: "Test Page",
      updatedAt: "2026-03-21T12:00:00.000Z",
    }),
    searchPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    createPage: vi.fn().mockResolvedValue({
      id: "page-123",
      title: "Test Page",
      createdAt: "2026-03-21T12:00:00.000Z",
    }),
    computeHash: vi.fn().mockReturnValue("hash-new"),
  };
}

function createMockChemElnClient() {
  return {
    listExperiments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getExperiment: vi.fn(),
    getChemicals: vi.fn(),
    getResearcher: vi.fn(),
    listResearchers: vi.fn(),
    fetchExperiments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };
}

function createMockResolver() {
  return {
    resolveResearcher: vi.fn().mockReturnValue("Dr. Smith"),
    resolveWikilink: vi.fn().mockReturnValue(null),
    buildLookupMap: vi.fn(),
    getChemicalUsages: vi.fn().mockReturnValue([]),
    createStubPage: vi.fn().mockReturnValue("# Stub"),
  };
}

function makeFetchResult(experiments: Array<{
  elnId: string;
  title?: string;
  reactionType?: string;
  researcher?: string;
  date?: string;
  status?: string;
}> = []) {
  return {
    experiments: experiments.map((e) => ({
      frontmatter: {
        elnId: e.elnId,
        title: e.title ?? "Test Experiment",
        reactionType: e.reactionType ?? "Suzuki-Coupling",
        researcher: e.researcher ?? "user-1",
        date: e.date ?? "2026-03-21",
        status: e.status ?? "completed",
      },
      pageData: {
        id: e.elnId,
        title: e.title ?? "Test Experiment",
      },
    })),
    stats: {
      total: experiments.length,
      transformed: experiments.length,
      skipped: 0,
      errors: 0,
    },
  };
}

function createDeps(overrides: Partial<IncrementalSyncDeps> = {}): IncrementalSyncDeps {
  return {
    chemElnClient: createMockChemElnClient() as any,
    writer: createMockWriter() as any,
    resolver: createMockResolver() as any,
    stateManager: new EnhancedSyncStateManager("/tmp/test-sync-state.json"),
    ...overrides,
  };
}

const defaultOptions: IncrementalSyncOptions = {
  tenantId: "test-tenant",
};

describe("IncrementalSyncRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(makeFetchResult() as any);
  });

  describe("runIncrementalSync", () => {
    it("should complete a sync with no changes when ChemELN returns empty", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync(defaultOptions);

      expect(result.status).toBe("success");
      expect(result.changeSet.new).toBe(0);
      expect(result.changeSet.updated).toBe(0);
      expect(result.changeSet.deleted).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect new experiments", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
      vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

      mockFetch.mockResolvedValue(
        makeFetchResult([
          { elnId: "EXP-001", title: "New Experiment" },
        ]) as any,
      );

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync(defaultOptions);

      expect(result.changeSet.new).toBe(1);
      expect(result.propagationResult).not.toBeNull();
      expect(deps.stateManager.setLastSyncTimestamp).toHaveBeenCalled();
    });

    it("should detect deleted experiments", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {
          "EXP-OLD": {
            contentHash: "old-hash",
            lastUpdated: "2026-03-20T10:00:00.000Z",
            reactionType: "Grignard",
            researcher: "Dr. Smith",
            skbPageId: "page-old",
          },
        },
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
      vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

      mockFetch.mockResolvedValue(makeFetchResult() as any);

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync(defaultOptions);

      expect(result.changeSet.deleted).toBe(1);
    });

    it("should return failure status when ChemELN fetch fails", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: new Date(0).toISOString(),
        experiments: {},
      });

      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync(defaultOptions);

      expect(result.status).toBe("failure");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Connection refused");
    });

    it("should use full date range when --full is specified", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

      const runner = new IncrementalSyncRunner(deps);
      await runner.runIncrementalSync({ ...defaultOptions, full: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ dateRange: undefined }),
      );
    });

    it("should use date range with clock skew buffer for incremental sync", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

      const runner = new IncrementalSyncRunner(deps);
      await runner.runIncrementalSync(defaultOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String),
          }),
        }),
      );
    });

    it("should save sync state after successful sync", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: new Date(0).toISOString(),
        experiments: {},
      });
      const saveSpy = vi
        .spyOn(deps.stateManager, "save")
        .mockResolvedValue(undefined);
      vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

      const runner = new IncrementalSyncRunner(deps);
      await runner.runIncrementalSync(defaultOptions);

      expect(saveSpy).toHaveBeenCalled();
      expect(deps.stateManager.setLastSyncTimestamp).toHaveBeenCalled();
    });
  });

  describe("dry-run mode", () => {
    it("should not write anything in dry-run mode", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });

      mockFetch.mockResolvedValue(
        makeFetchResult([
          { elnId: "EXP-001", title: "New Experiment" },
        ]) as any,
      );

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync({
        ...defaultOptions,
        dryRun: true,
      });

      expect(result.status).toBe("success");
      expect(result.changeSet.new).toBe(1);
      expect(result.propagationResult).toBeNull();
      expect(result.entityResult).toBeNull();
      expect((deps.writer as any).upsertPage).not.toHaveBeenCalled();
    });

    it("should not save sync state in dry-run mode", async () => {
      const deps = createDeps();
      const saveSpy = vi.spyOn(deps.stateManager, "save");
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: new Date(0).toISOString(),
        experiments: {},
      });

      const runner = new IncrementalSyncRunner(deps);
      await runner.runIncrementalSync({
        ...defaultOptions,
        dryRun: true,
      });

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("full sync mode", () => {
    it("should fetch all experiments without date filter", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {
          "EXP-OLD": {
            contentHash: "old-hash",
            lastUpdated: "2026-03-20T10:00:00.000Z",
            reactionType: "Grignard",
            researcher: "Dr. Smith",
          },
        },
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

      mockFetch.mockResolvedValue(
        makeFetchResult([
          { elnId: "EXP-001" },
          { elnId: "EXP-002" },
        ]) as any,
      );

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync({
        ...defaultOptions,
        full: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        { dateRange: undefined },
      );
      expect(result.changeSet.new).toBe(2);
      expect(result.changeSet.deleted).toBe(1);
    });
  });

  describe("next sync recommendation", () => {
    it("should recommend 30 minutes when no changes", async () => {
      const deps = createDeps();
      vi.spyOn(deps.stateManager, "load").mockResolvedValue({
        version: "1.0",
        lastSyncTimestamp: "2026-03-21T12:00:00.000Z",
        experiments: {},
      });
      vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

      const runner = new IncrementalSyncRunner(deps);
      const result = await runner.runIncrementalSync(defaultOptions);

      expect(result.nextSyncRecommendation).toContain("30 minutes");
    });
  });
});

describe("SyncScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(makeFetchResult() as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start and stop scheduling", () => {
    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: new Date(0).toISOString(),
      experiments: {},
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(60000);

    const status = scheduler.getStatus();
    expect(status.running).toBe(true);
    expect(status.nextRun).not.toBeNull();

    scheduler.stop();

    const stoppedStatus = scheduler.getStatus();
    expect(stoppedStatus.running).toBe(false);
    expect(stoppedStatus.nextRun).toBeNull();
  });

  it("should throw if schedule called while already running", () => {
    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: new Date(0).toISOString(),
      experiments: {},
    });

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(60000);

    expect(() => scheduler.schedule(60000)).toThrow(
      "Scheduler is already running",
    );

    scheduler.stop();
  });

  it("should prevent concurrent runs", async () => {
    let resolveSync: () => void;
    const syncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });

    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockImplementation(async () => {
      await syncPromise;
      return {
        version: "1.0" as const,
        lastSyncTimestamp: new Date(0).toISOString(),
        experiments: {},
      };
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(1000);

    // First run starts (blocked on syncPromise)
    // Advance timer to trigger second run attempt
    vi.advanceTimersByTime(1000);

    // The second run should be skipped because first is still in progress
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping run"),
    );

    // Stop before resolving to avoid infinite timer loop
    scheduler.stop();

    // Resolve the blocked sync
    resolveSync!();
    // Let microtasks flush
    await Promise.resolve();

    consoleSpy.mockRestore();
  });

  it("should track run count", async () => {
    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: new Date(0).toISOString(),
      experiments: {},
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
    vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(60000);

    // Let the immediate first run's microtasks settle
    await vi.advanceTimersByTimeAsync(0);

    const status = scheduler.getStatus();
    expect(status.runCount).toBe(1);

    scheduler.stop();
  });

  it("should track consecutive errors", async () => {
    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: new Date(0).toISOString(),
      experiments: {},
    });

    mockFetch.mockRejectedValue(new Error("Connection refused"));

    vi.spyOn(console, "error").mockImplementation(() => {});

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(60000);

    // Let the immediate first run's microtasks settle
    await vi.advanceTimersByTimeAsync(0);

    const status = scheduler.getStatus();
    expect(status.consecutiveErrors).toBe(1);

    scheduler.stop();
    vi.mocked(console.error).mockRestore();
  });

  it("should reset consecutive errors on success", async () => {
    const deps = createDeps();
    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: new Date(0).toISOString(),
      experiments: {},
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
    vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

    // First call fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error("Temporary error"))
      .mockResolvedValueOnce(makeFetchResult() as any);

    vi.spyOn(console, "error").mockImplementation(() => {});

    const scheduler = new SyncScheduler(deps, defaultOptions);
    scheduler.schedule(1000);

    // First run (fails)
    await vi.advanceTimersByTimeAsync(0);

    expect(scheduler.getStatus().consecutiveErrors).toBe(1);

    // Second run (succeeds)
    await vi.advanceTimersByTimeAsync(1000);

    expect(scheduler.getStatus().consecutiveErrors).toBe(0);

    scheduler.stop();
    vi.mocked(console.error).mockRestore();
  });
});
