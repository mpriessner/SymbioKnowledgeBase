import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock functions
const mockPageFindFirst = vi.fn();
const mockPageFindMany = vi.fn();
const mockPageCreate = vi.fn();
const mockPageUpdate = vi.fn();
const mockPageAggregate = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockBlockCreate = vi.fn();
const mockBlockUpdate = vi.fn();
const mockPageLinkFindMany = vi.fn();
const mockTeamspaceMemberFindMany = vi.fn();
const mockUserFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
      create: (...args: unknown[]) => mockPageCreate(...args),
      update: (...args: unknown[]) => mockPageUpdate(...args),
      aggregate: (...args: unknown[]) => mockPageAggregate(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
      create: (...args: unknown[]) => mockBlockCreate(...args),
      update: (...args: unknown[]) => mockBlockUpdate(...args),
    },
    pageLink: {
      findMany: (...args: unknown[]) => mockPageLinkFindMany(...args),
    },
    teamspaceMember: {
      findMany: (...args: unknown[]) => mockTeamspaceMemberFindMany(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
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
  markdownToTiptap: vi.fn((md) => ({ _mockMarkdown: md })),
}));

vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn(),
}));

const { promotePage, captureLearning } = await import(
  "@/lib/chemistryKb/promotionService"
);

const TENANT_ID = "test-tenant";
const USER_ID = "test-user";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── promotePage ────────────────────────────────────────────────────────────

describe("promotePage", () => {
  const baseRequest = {
    sourcePageId: "source-page-id",
    targetCategoryId: "target-cat-id",
    promotionType: "copy" as const,
    sections: ["all"],
    reviewRequired: false,
  };

  test("throws when source page not found", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    await expect(
      promotePage(TENANT_ID, USER_ID, baseRequest)
    ).rejects.toThrow("Source page not found");
  });

  test("throws when target category not in TEAM space", async () => {
    // First call: source page found
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment",
      icon: "🧪",
      oneLiner: "Test experiment",
      spaceType: "PRIVATE",
    });
    // Second call: target category NOT found (not TEAM)
    mockPageFindFirst.mockResolvedValueOnce(null);

    await expect(
      promotePage(TENANT_ID, USER_ID, baseRequest)
    ).rejects.toThrow("Target category must be a Team space page");
  });

  test("copy mode creates new page in target category", async () => {
    // Source page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment",
      icon: "🧪",
      oneLiner: "Test experiment",
      spaceType: "PRIVATE",
    });
    // Target category (TEAM)
    mockPageFindFirst.mockResolvedValueOnce({
      id: "target-cat-id",
      title: "Experiments",
      teamspaceId: "ts-1",
    });
    // Duplicate check — no duplicate
    mockPageFindFirst.mockResolvedValueOnce(null);
    // Source block content
    mockBlockFindFirst.mockResolvedValueOnce({
      content: { _mockMarkdown: "# Experiment\n\nSome content here" },
    });
    // User lookup
    mockUserFindFirst.mockResolvedValueOnce({
      name: "Dr. Smith",
      email: "smith@lab.org",
    });
    // Aggregate for position
    mockPageAggregate.mockResolvedValueOnce({ _max: { position: 2 } });
    // Create page
    mockPageCreate.mockResolvedValueOnce({ id: "new-page-id" });
    // Create block
    mockBlockCreate.mockResolvedValueOnce({});

    const result = await promotePage(TENANT_ID, USER_ID, baseRequest);

    expect(result.action).toBe("copied");
    expect(result.promotedPageId).toBe("new-page-id");
    expect(result.sectionsPromoted).toEqual(["all"]);
    expect(result.reviewStatus).toBe("approved");

    // Verify page was created with TEAM spaceType
    expect(mockPageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spaceType: "TEAM",
          teamspaceId: "ts-1",
          parentId: "target-cat-id",
          position: 3,
        }),
      })
    );
  });

  test("move mode updates source page and creates redirect stub", async () => {
    const moveRequest = { ...baseRequest, promotionType: "move" as const };

    // Source page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment",
      icon: "🧪",
      oneLiner: "Test",
      spaceType: "PRIVATE",
    });
    // Target category
    mockPageFindFirst.mockResolvedValueOnce({
      id: "target-cat-id",
      title: "Experiments",
      teamspaceId: "ts-1",
    });
    // Duplicate check
    mockPageFindFirst.mockResolvedValueOnce(null);
    // Source block (for extractSections — move still calls it but sections=["all"])
    mockBlockFindFirst.mockResolvedValueOnce({
      content: { _mockMarkdown: "Content" },
    });
    // User lookup
    mockUserFindFirst.mockResolvedValueOnce({ name: "Dr. Smith", email: "smith@lab.org" });
    // page.update for move
    mockPageUpdate.mockResolvedValueOnce({});
    // stub page create
    mockPageCreate.mockResolvedValueOnce({ id: "stub-page-id" });
    // stub block create
    mockBlockCreate.mockResolvedValueOnce({});

    const result = await promotePage(TENANT_ID, USER_ID, moveRequest);

    expect(result.action).toBe("moved");
    expect(result.promotedPageId).toBe("source-page-id");

    // Verify page was moved to TEAM space
    expect(mockPageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "source-page-id" },
        data: expect.objectContaining({
          spaceType: "TEAM",
          teamspaceId: "ts-1",
          parentId: "target-cat-id",
        }),
      })
    );

    // Verify redirect stub was created
    expect(mockPageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "My Experiment (moved)",
          icon: "↗️",
          spaceType: "PRIVATE",
        }),
      })
    );
  });

  test("returns duplicate warning when similar page exists", async () => {
    // Source page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment: Run 2",
      icon: "🧪",
      oneLiner: "Test",
      spaceType: "PRIVATE",
    });
    // Target category
    mockPageFindFirst.mockResolvedValueOnce({
      id: "target-cat-id",
      title: "Experiments",
      teamspaceId: "ts-1",
    });
    // Duplicate check — found a similar page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "existing-id",
      title: "My Experiment: Run 1",
    });
    // Block content
    mockBlockFindFirst.mockResolvedValueOnce({
      content: { _mockMarkdown: "content" },
    });
    // User
    mockUserFindFirst.mockResolvedValueOnce({ name: "Dr. Smith", email: "s@l.org" });
    // Aggregate + create
    mockPageAggregate.mockResolvedValueOnce({ _max: { position: 0 } });
    mockPageCreate.mockResolvedValueOnce({ id: "new-page-id" });
    mockBlockCreate.mockResolvedValueOnce({});

    const result = await promotePage(TENANT_ID, USER_ID, baseRequest);

    expect(result.duplicateWarning).toContain("My Experiment: Run 1");
  });

  test("notifies admins when reviewRequired is true", async () => {
    const reviewRequest = { ...baseRequest, reviewRequired: true };
    const { createNotification } = await import(
      "@/lib/notifications/create"
    );

    // Source page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment",
      icon: "🧪",
      oneLiner: "Test",
      spaceType: "PRIVATE",
    });
    // Target category
    mockPageFindFirst.mockResolvedValueOnce({
      id: "target-cat-id",
      title: "Experiments",
      teamspaceId: "ts-1",
    });
    // Duplicate check
    mockPageFindFirst.mockResolvedValueOnce(null);
    // Block
    mockBlockFindFirst.mockResolvedValueOnce({
      content: { _mockMarkdown: "content" },
    });
    // User
    mockUserFindFirst.mockResolvedValueOnce({ name: "Dr. Smith", email: "s@l.org" });
    // Aggregate + create
    mockPageAggregate.mockResolvedValueOnce({ _max: { position: 0 } });
    mockPageCreate.mockResolvedValueOnce({ id: "new-page-id" });
    mockBlockCreate.mockResolvedValueOnce({});
    // Admins
    mockTeamspaceMemberFindMany.mockResolvedValueOnce([
      { userId: "admin-1" },
      { userId: "admin-2" },
    ]);

    const result = await promotePage(TENANT_ID, USER_ID, reviewRequest);

    expect(result.reviewStatus).toBe("pending_review");
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  test("section extraction filters content correctly", async () => {
    // Source page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "source-page-id",
      title: "My Experiment",
      icon: "🧪",
      oneLiner: "Test",
      spaceType: "PRIVATE",
    });
    // Target category
    mockPageFindFirst.mockResolvedValueOnce({
      id: "target-cat-id",
      title: "Experiments",
      teamspaceId: "ts-1",
    });
    // Duplicate check
    mockPageFindFirst.mockResolvedValueOnce(null);
    // Block with multi-section content
    mockBlockFindFirst.mockResolvedValueOnce({
      content: {
        _mockMarkdown:
          "# Experiment\n\n## Procedures\n\n1. Step one\n2. Step two\n\n## Results\n\nYield: 87%\n\n## Notes\n\nSome notes",
      },
    });
    // User
    mockUserFindFirst.mockResolvedValueOnce({ name: "Dr. Smith", email: "s@l.org" });
    // Aggregate + create
    mockPageAggregate.mockResolvedValueOnce({ _max: { position: 0 } });
    mockPageCreate.mockResolvedValueOnce({ id: "new-page-id" });
    mockBlockCreate.mockResolvedValueOnce({});

    const request = { ...baseRequest, sections: ["Procedures", "Results"] };
    await promotePage(TENANT_ID, USER_ID, request);

    // Verify the block was created with filtered content
    const blockCreateCall = mockBlockCreate.mock.calls[0][0];
    const content = blockCreateCall.data.content;
    // The markdownToTiptap mock returns { _mockMarkdown: ... }
    expect(content._mockMarkdown).toContain("Procedures");
    expect(content._mockMarkdown).toContain("Step one");
    expect(content._mockMarkdown).toContain("Results");
    expect(content._mockMarkdown).toContain("87%");
    expect(content._mockMarkdown).not.toContain("Some notes");
  });
});

// ─── captureLearning ────────────────────────────────────────────────────────

describe("captureLearning", () => {
  const baseRequest = {
    experimentId: "EXP-2026-0042",
    learnings: [
      {
        type: "best_practice" as const,
        content: "Always degas solvents",
        confidence: "high" as const,
        promoteTo: null,
      },
      {
        type: "pitfall" as const,
        content: "Old THF gives 10% yield drop",
        confidence: "medium" as const,
        promoteTo: null,
      },
    ],
  };

  test("throws when experiment not found", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    await expect(
      captureLearning(TENANT_ID, USER_ID, baseRequest)
    ).rejects.toThrow('Experiment "EXP-2026-0042" not found');
  });

  test("appends learnings to experiment page", async () => {
    // Experiment page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "exp-page-id",
      title: "EXP-2026-0042: Suzuki Coupling",
      parentId: "exp-parent",
    });
    // Experiment block
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "block-1",
      content: { _mockMarkdown: "# Experiment\n\nOriginal content" },
    });

    const result = await captureLearning(TENANT_ID, USER_ID, baseRequest);

    expect(result.captured).toBe(2);
    expect(result.promoted).toBe(0);
    expect(result.pageUpdates).toEqual([
      { pageId: "exp-page-id", action: "appended" },
    ]);

    // Verify block was updated with appended learnings
    expect(mockBlockUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockBlockUpdate.mock.calls[0][0];
    const updatedContent = updateCall.data.content._mockMarkdown;
    expect(updatedContent).toContain("Original content");
    expect(updatedContent).toContain("Best Practices");
    expect(updatedContent).toContain("Always degas solvents");
    expect(updatedContent).toContain("Common Pitfalls");
    expect(updatedContent).toContain("Old THF gives 10% yield drop");
  });

  test("includes debrief summary when provided", async () => {
    const requestWithSummary = {
      ...baseRequest,
      debriefSummary: "Successful run with minor yield issues",
    };

    mockPageFindFirst.mockResolvedValueOnce({
      id: "exp-page-id",
      title: "EXP-2026-0042",
      parentId: "exp-parent",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "block-1",
      content: { _mockMarkdown: "# Experiment" },
    });

    await captureLearning(TENANT_ID, USER_ID, requestWithSummary);

    const updateCall = mockBlockUpdate.mock.calls[0][0];
    const content = updateCall.data.content._mockMarkdown;
    expect(content).toContain("Successful run with minor yield issues");
  });

  test("promotes high-confidence learnings to team KB", async () => {
    const promoteRequest = {
      experimentId: "EXP-2026-0042",
      learnings: [
        {
          type: "best_practice" as const,
          content: "Degas all solvents",
          confidence: "high" as const,
          promoteTo: "team" as const,
        },
        {
          type: "pitfall" as const,
          content: "Low confidence note",
          confidence: "low" as const,
          promoteTo: "team" as const,
        },
      ],
    };

    // Experiment page
    mockPageFindFirst.mockResolvedValueOnce({
      id: "exp-page-id",
      title: "EXP-2026-0042",
      parentId: "exp-parent",
    });
    // Experiment block
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "block-1",
      content: { _mockMarkdown: "# Experiment" },
    });
    // Page links from experiment → reaction type page
    mockPageLinkFindMany.mockResolvedValueOnce([
      {
        targetPage: {
          id: "rt-page-id",
          title: "Suzuki Coupling",
          spaceType: "TEAM",
          parentId: "rt-parent-id",
        },
      },
    ]);
    // Parent pages lookup for category detection
    mockPageFindMany.mockResolvedValueOnce([
      { id: "rt-parent-id", title: "Reaction Types" },
    ]);
    // The reaction type block
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "rt-block-1",
      content: { _mockMarkdown: "# Suzuki Coupling\n\nExisting content" },
    });
    // User for attribution
    mockUserFindFirst.mockResolvedValueOnce({ name: "Dr. Smith" });

    const result = await captureLearning(TENANT_ID, USER_ID, promoteRequest);

    expect(result.captured).toBe(2);
    // Only high-confidence promoteTo=team gets promoted (low confidence filtered out)
    expect(result.promoted).toBe(1);
  });

  test("adds confidence tag to non-high confidence learnings", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "exp-page-id",
      title: "EXP-2026-0042",
      parentId: "exp-parent",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "block-1",
      content: { _mockMarkdown: "# Experiment" },
    });

    await captureLearning(TENANT_ID, USER_ID, baseRequest);

    const content = mockBlockUpdate.mock.calls[0][0].data.content._mockMarkdown;
    // High confidence: no tag
    expect(content).toContain("- Always degas solvents\n");
    // Medium confidence: has tag
    expect(content).toContain("*(medium confidence)*");
  });

  test("returns zero promoted when no learnings marked for promotion", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "exp-page-id",
      title: "EXP-2026-0042",
      parentId: "exp-parent",
    });
    mockBlockFindFirst.mockResolvedValueOnce({
      id: "block-1",
      content: { _mockMarkdown: "content" },
    });

    const result = await captureLearning(TENANT_ID, USER_ID, baseRequest);

    expect(result.promoted).toBe(0);
    expect(result.conflictsDetected).toBe(0);
  });
});
