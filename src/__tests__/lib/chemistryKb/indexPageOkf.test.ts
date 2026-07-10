import { describe, test, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn(() => ""),
}));

const {
  generateIndexPageContent,
  formatOkfBullet,
  deriveDescription,
} = await import("@/lib/chemistryKb/indexPage");

const TENANT = "tenant-1";

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    title: "Reduction of 4-nitrophenol (EXP-2025-0001)",
    externalId: "EXP-2025-0001",
    oneLiner: "Pd/C catalyzed, yield 87%, status: complete",
    position: 0,
    createdAt: new Date("2026-06-30T00:00:00Z"),
    updatedAt: new Date("2026-06-30T00:00:00Z"),
    blocks: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("deriveDescription", () => {
  const base = {
    id: "x",
    title: "T",
    externalId: null,
    oneLiner: null,
    linkSlug: "x",
    tags: [],
  };

  test("prefers oneLiner", () => {
    expect(deriveDescription({ ...base, oneLiner: "the one liner" })).toBe(
      "the one liner"
    );
  });

  test("falls back to exec summary", () => {
    expect(
      deriveDescription({ ...base, execSummary: "exec summary text" })
    ).toBe("exec summary text");
  });

  test("falls back to truncated body, never throws on empty scaffold", () => {
    const long = "word ".repeat(60);
    const out = deriveDescription({ ...base, bodyText: long });
    expect(out.length).toBeLessThanOrEqual(121);
    expect(deriveDescription(base)).toBe("(no summary yet)");
  });
});

describe("formatOkfBullet", () => {
  test("renders the exact OKF one-liner shape", () => {
    const line = formatOkfBullet(
      {
        id: "p1",
        title: "Reduction of 4-nitrophenol (EXP-2025-0001)",
        externalId: "EXP-2025-0001",
        oneLiner: "Pd/C catalyzed, yield 87%, status: complete",
        linkSlug: "exp-2025-0001",
        tags: ["reduction", "researcher:jsmith"],
      },
      "./experiments"
    );
    expect(line).toBe(
      "- [Reduction of 4-nitrophenol (EXP-2025-0001)](./experiments/exp-2025-0001) — Pd/C catalyzed, yield 87%, status: complete _(tags: reduction, researcher:jsmith)_"
    );
  });
});

describe("generateIndexPageContent", () => {
  test("empty KB renders preamble + empty sections", async () => {
    const content = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    expect(content).toContain("# Chemistry KB Index");
    expect(content).toContain("## Experiments");
    expect(content).toContain("_No active experiments yet._");
    expect(content).toContain("## Archive");
    expect(content).toContain("_No archived experiments yet._");
  });

  test("single experiment produces one OKF bullet under Experiments", async () => {
    mockFindMany
      .mockResolvedValueOnce([makePage()]) // experiments
      .mockResolvedValueOnce([]); // archive
    const content = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    expect(content).toContain(
      "- [Reduction of 4-nitrophenol (EXP-2025-0001)](./experiments/exp-2025-0001) — Pd/C catalyzed, yield 87%, status: complete"
    );
  });

  test("mixed active + archived split into their sections", async () => {
    mockFindMany
      .mockResolvedValueOnce([makePage()])
      .mockResolvedValueOnce([
        makePage({
          id: "p2",
          title: "Old Exp (EXP-2024-0009)",
          externalId: "EXP-2024-0009",
          oneLiner: "archived run",
        }),
      ]);
    const content = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    const archiveIdx = content.indexOf("## Archive");
    expect(content.indexOf("exp-2025-0001")).toBeLessThan(archiveIdx);
    expect(content.indexOf("exp-2024-0009")).toBeGreaterThan(archiveIdx);
  });

  test("missing oneLiner falls back without erroring", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        makePage({ oneLiner: null, blocks: [] }),
      ])
      .mockResolvedValueOnce([]);
    const content = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    expect(content).toContain("(no summary yet)");
  });

  test("regenerating twice with no changes is byte-identical (idempotent)", async () => {
    const rows = [
      makePage(),
      makePage({
        id: "p3",
        title: "Second (EXP-2025-0002)",
        externalId: "EXP-2025-0002",
        oneLiner: "second",
        position: 1,
      }),
    ];
    mockFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
    const a = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    mockFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
    const b = await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    expect(a).toBe(b);
  });

  test("queries filter soft-deleted pages and use a stable sort", async () => {
    await generateIndexPageContent(TENANT, {
      experimentsParentId: "exp-parent",
      archiveParentId: "arch-parent",
    });
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      tenantId: TENANT,
      parentId: "exp-parent",
      deletedAt: null,
    });
    expect(Array.isArray(call.orderBy)).toBe(true);
  });
});
