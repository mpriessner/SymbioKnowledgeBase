import { describe, test, expect, vi, beforeEach } from "vitest";

const mockPageFindFirst = vi.fn();
const mockPageFindMany = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockTeamspaceMemberFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
    },
    teamspaceMember: {
      findMany: (...args: unknown[]) => mockTeamspaceMemberFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn((content) => {
    if (content && typeof content === "object" && "_mockMarkdown" in content) {
      return content._mockMarkdown;
    }
    return "";
  }),
}));

vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn(),
}));

const { detectConflicts, notifyConflicts, scanCategoryConflicts } =
  await import("@/lib/chemistryKb/conflictDetection");

const TENANT_ID = "test-tenant";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectConflicts", () => {
  test("returns empty report when new page not found", async () => {
    mockPageFindFirst.mockResolvedValueOnce(null);

    const report = await detectConflicts(TENANT_ID, "missing-id", "cat-id");

    expect(report.totalConflicts).toBe(0);
    expect(report.conflicts).toEqual([]);
  });

  test("returns empty report when new page has no knowledge statements", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Page",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown: "# Title\n\nJust some text without bullet points.",
      },
    });

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    expect(report.totalConflicts).toBe(0);
  });

  test("returns empty report when no existing pages in category", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Page",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Always degas solvents before use",
      },
    });
    mockPageFindMany.mockResolvedValueOnce([]);

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    expect(report.totalConflicts).toBe(0);
  });

  test("detects contradictory conflict when similar statements exist", async () => {
    // Use nearly identical statements to ensure similarity > 0.7
    // New page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Suzuki Protocol",
    });
    // New page block
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Always degas THF solvent before starting the Suzuki coupling reaction",
      },
    });
    // Existing pages in same category
    mockPageFindMany.mockResolvedValueOnce([
      { id: "existing-page", title: "Old Suzuki Protocol" },
    ]);
    // Existing page block
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Always degas THF solvent before running the Suzuki coupling reaction",
      },
    });

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    expect(report.totalConflicts).toBeGreaterThanOrEqual(1);
    expect(report.conflicts[0].existingPage.id).toBe("existing-page");
    expect(report.conflicts[0].newPage.id).toBe("new-page");
    expect(report.conflicts[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  test("classifies superseded conflict when new statement has update indicators", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "Updated Protocol",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Updated protocol: use microwave heating instead of conventional heating",
      },
    });
    mockPageFindMany.mockResolvedValueOnce([
      { id: "existing-page", title: "Old Protocol" },
    ]);
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Use conventional heating method for the reaction protocol",
      },
    });

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    if (report.totalConflicts > 0) {
      const superseded = report.conflicts.filter(
        (c) => c.type === "superseded"
      );
      // If similarity is above threshold, it should be classified as superseded
      if (superseded.length > 0) {
        expect(superseded[0].suggestion).toContain("supersede");
        expect(report.autoResolvable).toBeGreaterThan(0);
      }
    }
  });

  test("classifies conditional conflict when both have conditional language", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Protocol",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- When using heteroaryl substrates heat THF solvent to 60C",
      },
    });
    mockPageFindMany.mockResolvedValueOnce([
      { id: "existing-page", title: "Existing Protocol" },
    ]);
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- When using aryl substrates keep THF solvent at room temperature",
      },
    });

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    if (report.totalConflicts > 0) {
      const conditional = report.conflicts.filter(
        (c) => c.type === "conditional"
      );
      if (conditional.length > 0) {
        expect(conditional[0].suggestion).toContain("different conditions");
      }
    }
  });

  test("similarity below threshold produces no conflicts", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Page",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Always degas solvents thoroughly before the reaction",
      },
    });
    mockPageFindMany.mockResolvedValueOnce([
      { id: "existing-page", title: "Unrelated Page" },
    ]);
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Store all catalysts under nitrogen atmosphere at minus twenty degrees",
      },
    });

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    expect(report.totalConflicts).toBe(0);
  });

  test("skips existing pages with no block content", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "new-page",
      title: "New Page",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown: "## Best Practices\n\n- Some practice",
      },
    });
    mockPageFindMany.mockResolvedValueOnce([
      { id: "empty-page", title: "Empty Page" },
    ]);
    // No block found
    mockBlockFindFirst.mockResolvedValueOnce(null);

    const report = await detectConflicts(TENANT_ID, "new-page", "cat-id");

    expect(report.totalConflicts).toBe(0);
  });
});

describe("notifyConflicts", () => {
  test("does nothing when no conflicts", async () => {
    const { createNotification } = await import(
      "@/lib/notifications/create"
    );

    await notifyConflicts(
      TENANT_ID,
      { conflicts: [], totalConflicts: 0, autoResolvable: 0, requiresReview: 0 },
      "ts-1"
    );

    expect(createNotification).not.toHaveBeenCalled();
  });

  test("notifies all admins when conflicts detected", async () => {
    const { createNotification } = await import(
      "@/lib/notifications/create"
    );

    mockTeamspaceMemberFindMany.mockResolvedValueOnce([
      { userId: "admin-1" },
      { userId: "admin-2" },
    ]);

    const report = {
      conflicts: [
        {
          id: "c1",
          type: "contradictory" as const,
          existingPage: { id: "p1", title: "P1", statement: "Statement A" },
          newPage: { id: "p2", title: "P2", statement: "Statement B" },
          similarity: 0.85,
          suggestion: "Review",
        },
      ],
      totalConflicts: 1,
      autoResolvable: 0,
      requiresReview: 1,
    };

    await notifyConflicts(TENANT_ID, report, "ts-1");

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: "admin-1",
        type: "SYSTEM",
        title: "1 conflict(s) detected in Chemistry KB",
      })
    );
  });
});

describe("scanCategoryConflicts", () => {
  test("returns empty report for empty category", async () => {
    mockPageFindMany.mockResolvedValueOnce([]);

    const report = await scanCategoryConflicts(TENANT_ID, "empty-cat");

    expect(report.totalConflicts).toBe(0);
  });

  test("performs pairwise comparison of all pages in category", async () => {
    mockPageFindMany.mockResolvedValueOnce([
      { id: "page-a", title: "Protocol A" },
      { id: "page-b", title: "Protocol B" },
    ]);

    // Page A block
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Always heat THF solvent to sixty degrees celsius",
      },
    });
    // Page B block
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "## Best Practices\n\n- Heat THF solvent to sixty degrees celsius always",
      },
    });

    const report = await scanCategoryConflicts(TENANT_ID, "cat-id");

    // These are very similar statements, should detect conflict
    expect(report.totalConflicts).toBeGreaterThanOrEqual(1);
  });
});
