import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IncrementalSyncRunner,
  type IncrementalSyncDeps,
} from "@/lib/chemEln/sync/incrementalSync";
import { EnhancedSyncStateManager } from "@/lib/chemEln/sync/enhancedSyncState";

/**
 * Data-loss regression: the runner used to stamp lastSyncTimestamp = now()
 * unconditionally, so any experiment that failed to propagate fell outside the
 * next incremental window and was never retried — silently lost. The runner now
 * refuses to advance the cursor past the earliest failing record.
 */

vi.mock("@/lib/chemEln/experimentFetcher", () => ({
  fetchAndTransformExperiments: vi.fn(),
}));

import { fetchAndTransformExperiments } from "@/lib/chemEln/experimentFetcher";
const mockFetch = vi.mocked(fetchAndTransformExperiments);

function fetchResult(
  experiments: Array<{ elnId: string; date: string }>,
) {
  return {
    experiments: experiments.map((e) => ({
      frontmatter: {
        elnId: e.elnId,
        title: `Title ${e.elnId}`,
        reactionType: "Suzuki-Coupling",
        researcher: "user-1",
        date: e.date,
        status: "completed",
      },
      pageData: { id: e.elnId, title: `Title ${e.elnId}` },
    })),
    stats: { total: experiments.length, transformed: experiments.length, skipped: 0, errors: 0 },
  };
}

function makeDeps(
  upsertImpl: (...args: unknown[]) => Promise<unknown>,
): IncrementalSyncDeps {
  const writer = {
    upsertPage: vi.fn(upsertImpl),
    updatePage: vi.fn().mockResolvedValue({ id: "p", title: "t", updatedAt: "x" }),
    searchPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    createPage: vi.fn().mockResolvedValue({ id: "p", title: "t", createdAt: "x" }),
    computeHash: vi.fn().mockReturnValue("h"),
  };
  const resolver = {
    resolveResearcher: vi.fn().mockReturnValue("Dr. Smith"),
    resolveWikilink: vi.fn().mockReturnValue(null),
    buildLookupMap: vi.fn(),
    getChemicalUsages: vi.fn().mockReturnValue([]),
    createStubPage: vi.fn().mockReturnValue("# Stub"),
  };
  const chemElnClient = {
    listExperiments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getExperiment: vi.fn(),
    getChemicals: vi.fn(),
    getResearcher: vi.fn(),
    listResearchers: vi.fn(),
    fetchExperiments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };
  return {
    chemElnClient: chemElnClient as never,
    writer: writer as never,
    resolver: resolver as never,
    stateManager: new EnhancedSyncStateManager("/tmp/test-cursor-state.json"),
    parentIds: { experiments: "exp-folder" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IncrementalSyncRunner — cursor never advances past a failure", () => {
  it("does not advance to now() when a record fails; advances to before the failing record", async () => {
    // Two new experiments; the second (EXP-FAIL, dated 2026-05-10) fails to write.
    mockFetch.mockResolvedValue(
      fetchResult([
        { elnId: "EXP-OK", date: "2026-05-01T00:00:00.000Z" },
        { elnId: "EXP-FAIL", date: "2026-05-10T00:00:00.000Z" },
      ]) as never,
    );

    const deps = makeDeps(async (_md, tag: unknown) => {
      if (typeof tag === "string" && tag.includes("EXP-FAIL")) {
        throw new Error("write failed");
      }
      return { action: "created", pageId: "p", title: "t", contentHash: "h" };
    });

    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: "2026-04-01T00:00:00.000Z",
      experiments: {},
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
    const setCursor = vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

    const result = await runWithStubbedNow(deps, "2026-06-01T00:00:00.000Z");

    expect(result.status).toBe("partial_failure");
    expect(result.errors.some((e) => e.includes("EXP-FAIL"))).toBe(true);

    // Must NOT advance to "now" (2026-06-01); must advance to just before the
    // earliest failing record (2026-05-10), i.e. 1ms earlier.
    expect(setCursor).toHaveBeenCalledTimes(1);
    const stampedTo = setCursor.mock.calls[0][0];
    expect(stampedTo).toBe(new Date(Date.parse("2026-05-10T00:00:00.000Z") - 1).toISOString());
    expect(stampedTo).not.toBe("2026-06-01T00:00:00.000Z");
  });

  it("advances to now() when every record succeeds", async () => {
    mockFetch.mockResolvedValue(
      fetchResult([{ elnId: "EXP-OK", date: "2026-05-01T00:00:00.000Z" }]) as never,
    );

    const deps = makeDeps(async () => ({
      action: "created",
      pageId: "p",
      title: "t",
      contentHash: "h",
    }));

    vi.spyOn(deps.stateManager, "load").mockResolvedValue({
      version: "1.0",
      lastSyncTimestamp: "2026-04-01T00:00:00.000Z",
      experiments: {},
    });
    vi.spyOn(deps.stateManager, "save").mockResolvedValue(undefined);
    const setCursor = vi.spyOn(deps.stateManager, "setLastSyncTimestamp");

    const result = await runWithStubbedNow(deps, "2026-06-01T00:00:00.000Z");

    expect(result.status).toBe("success");
    expect(setCursor).toHaveBeenCalledWith("2026-06-01T00:00:00.000Z");
  });
});

/**
 * Pin Date.now()/new Date() to a fixed instant so the "advance to now" branch is
 * deterministic, run the sync, then restore real time.
 */
async function runWithStubbedNow(
  deps: IncrementalSyncDeps,
  nowIso: string,
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(nowIso));
  try {
    const runner = new IncrementalSyncRunner(deps);
    return await runner.runIncrementalSync({ tenantId: "t" });
  } finally {
    vi.useRealTimers();
  }
}
