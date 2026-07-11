import { describe, test, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    enrichJob: {
      create: (...a: unknown[]) => mockCreate(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}));

const {
  createEnrichJob,
  getEnrichJob,
  claimNextQueuedJob,
  completeEnrichJob,
  failEnrichJob,
} = await import("@/lib/agent/enrichment/enrichJob");

beforeEach(() => vi.clearAllMocks());

describe("createEnrichJob", () => {
  test("inserts a QUEUED row and returns id+status", async () => {
    mockCreate.mockResolvedValue({ id: "job-1", status: "QUEUED" });
    const res = await createEnrichJob("t1", {
      rawText: "x",
      sourceName: "s",
    });
    expect(res).toEqual({ id: "job-1", status: "QUEUED" });
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.data.tenantId).toBe("t1");
    expect(arg.data.status).toBe("QUEUED");
  });
});

describe("getEnrichJob — tenant-scoped", () => {
  test("reads a job filtered by tenant", async () => {
    mockFindFirst.mockResolvedValue({ id: "job-1", tenantId: "t1", status: "DONE" });
    const job = await getEnrichJob("t1", "job-1");
    expect(job?.id).toBe("job-1");
    expect(mockFindFirst.mock.calls[0][0]).toEqual({
      where: { id: "job-1", tenantId: "t1" },
    });
  });

  test("a foreign tenant's job returns null (no leak)", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await getEnrichJob("t2", "job-1")).toBeNull();
  });
});

describe("claimNextQueuedJob", () => {
  test("claims the oldest QUEUED job → RUNNING via a guarded update", async () => {
    const tx = {
      enrichJob: {
        findFirst: vi.fn().mockResolvedValue({ id: "job-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: "job-1", status: "RUNNING" }),
      },
    };
    mockTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    const job = await claimNextQueuedJob();
    expect(job).toEqual({ id: "job-1", status: "RUNNING" });
    expect(tx.enrichJob.updateMany.mock.calls[0][0].where).toEqual({
      id: "job-1",
      status: "QUEUED",
    });
  });

  test("returns null when the queue is empty", async () => {
    const tx = {
      enrichJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    mockTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    expect(await claimNextQueuedJob()).toBeNull();
  });

  test("returns null when another worker won the race (count 0)", async () => {
    const tx = {
      enrichJob: {
        findFirst: vi.fn().mockResolvedValue({ id: "job-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn(),
      },
    };
    mockTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    expect(await claimNextQueuedJob()).toBeNull();
  });
});

describe("complete / fail", () => {
  test("completeEnrichJob writes DONE + result", async () => {
    mockUpdate.mockResolvedValue({});
    await completeEnrichJob("job-1", { applied: [] });
    expect(mockUpdate.mock.calls[0][0].data.status).toBe("DONE");
  });

  test("failEnrichJob writes FAILED + truncated error", async () => {
    mockUpdate.mockResolvedValue({});
    await failEnrichJob("job-1", "boom");
    expect(mockUpdate.mock.calls[0][0].data.status).toBe("FAILED");
    expect(mockUpdate.mock.calls[0][0].data.error).toBe("boom");
  });

  test("a vanished job (P2025) is swallowed", async () => {
    mockUpdate.mockRejectedValue({ code: "P2025" });
    await expect(completeEnrichJob("gone", {})).resolves.toBeUndefined();
  });
});
