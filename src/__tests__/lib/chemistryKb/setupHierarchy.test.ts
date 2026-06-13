import { describe, test, expect, vi, beforeEach } from "vitest";
import { generateIndexPageContent } from "@/lib/chemistryKb/indexPage";

// Mock Prisma client
const mockFindFirst = vi.fn();
const mockAggregate = vi.fn();
const mockCreate = vi.fn();
const mockBlockCreate = vi.fn();
const mockPageUpdate = vi.fn();
// setupChemistryKbHierarchy auto-creates (or finds) a "Chemistry KB" teamspace
// when no explicit teamspaceId is passed, so the teamspace / user /
// teamspaceMember models must be mocked too.
const mockTeamspaceFindFirst = vi.fn();
const mockTeamspaceCreate = vi.fn();
const mockUserFindMany = vi.fn();
const mockTeamspaceMemberUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockPageUpdate(...args),
    },
    block: {
      create: (...args: unknown[]) => mockBlockCreate(...args),
    },
    teamspace: {
      findFirst: (...args: unknown[]) => mockTeamspaceFindFirst(...args),
      create: (...args: unknown[]) => mockTeamspaceCreate(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    teamspaceMember: {
      upsert: (...args: unknown[]) => mockTeamspaceMemberUpsert(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  markdownToTiptap: vi.fn(() => ({ type: "doc", content: [] })),
}));

vi.mock("@/lib/agent/wikilinks", () => ({
  processAgentWikilinks: vi.fn(),
}));

// Import after mocks are set up
const { setupChemistryKbHierarchy, CATEGORY_PAGES } = await import(
  "@/lib/chemistryKb/setupHierarchy"
);

const TEST_TENANT_ID = "test-tenant-123";

function makePageId(index: number) {
  return `page-${index}-uuid`;
}

const DEFAULT_TEAMSPACE_ID = "teamspace-default-uuid";

beforeEach(() => {
  vi.clearAllMocks();

  // Default: no existing pages found
  mockFindFirst.mockResolvedValue(null);
  mockAggregate.mockResolvedValue({ _max: { position: null } });
  mockPageUpdate.mockResolvedValue({ id: "page-updated" });

  // Default: the "Chemistry KB" teamspace already exists, so the auto-create
  // path (teamspace.create / user.findMany / teamspaceMember.upsert) is skipped.
  mockTeamspaceFindFirst.mockResolvedValue({ id: DEFAULT_TEAMSPACE_ID });
  mockTeamspaceCreate.mockResolvedValue({ id: DEFAULT_TEAMSPACE_ID });
  mockUserFindMany.mockResolvedValue([]);
  mockTeamspaceMemberUpsert.mockResolvedValue({ id: "member-uuid" });

  let callCount = 0;
  mockCreate.mockImplementation(({ data }) => {
    callCount++;
    return Promise.resolve({
      id: makePageId(callCount),
      tenantId: data.tenantId,
      title: data.title,
      icon: data.icon,
      oneLiner: data.oneLiner,
      parentId: data.parentId,
      position: data.position,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  mockBlockCreate.mockResolvedValue({ id: "block-uuid" });
});

describe("setupChemistryKbHierarchy", () => {
  // 1 root + N category pages + 1 index page. Derived from CATEGORY_PAGES so the
  // count tracks the source (currently 6 categories: experiments, archive,
  // reactionTypes, chemicals, researchers, substrateClasses).
  const EXPECTED_PAGE_COUNT = 1 + CATEGORY_PAGES.length + 1;
  const INDEX_CALL_INDEX = CATEGORY_PAGES.length + 1; // 0-based: after root + categories

  test("creates all pages with correct structure", async () => {
    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    expect(mockCreate).toHaveBeenCalledTimes(EXPECTED_PAGE_COUNT);

    // Verify result contains all page IDs
    expect(result.rootId).toBeDefined();
    expect(result.indexId).toBeDefined();
    expect(result.experimentsId).toBeDefined();
    expect(result.archiveId).toBeDefined();
    expect(result.reactionTypesId).toBeDefined();
    expect(result.chemicalsId).toBeDefined();
    expect(result.researchersId).toBeDefined();
    expect(result.substrateClassesId).toBeDefined();

    // All page IDs should be different (root + categories + index)
    const allIds = [
      result.rootId,
      result.indexId,
      result.experimentsId,
      result.archiveId,
      result.reactionTypesId,
      result.chemicalsId,
      result.researchersId,
      result.substrateClassesId,
    ];
    expect(new Set(allIds).size).toBe(EXPECTED_PAGE_COUNT);
  });

  test("root page is created with null parentId", async () => {
    await setupChemistryKbHierarchy(TEST_TENANT_ID);

    // First create call is the root page
    const rootCreateCall = mockCreate.mock.calls[0][0];
    expect(rootCreateCall.data.title).toBe("Chemistry KB");
    expect(rootCreateCall.data.parentId).toBeNull();
    expect(rootCreateCall.data.tenantId).toBe(TEST_TENANT_ID);
  });

  test("category pages are created with root as parent", async () => {
    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    // Calls 1..CATEGORY_PAGES.length are the category pages (call 0 is root).
    for (let i = 1; i <= CATEGORY_PAGES.length; i++) {
      const call = mockCreate.mock.calls[i][0];
      expect(call.data.parentId).toBe(result.rootId);
      expect(call.data.tenantId).toBe(TEST_TENANT_ID);
    }
  });

  test("index page is created with root as parent", async () => {
    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    // Last create call is the index page
    const indexCall = mockCreate.mock.calls[INDEX_CALL_INDEX][0];
    expect(indexCall.data.title).toBe("Chemistry KB Index");
    expect(indexCall.data.parentId).toBe(result.rootId);
  });

  test("each page gets correct icon", async () => {
    await setupChemistryKbHierarchy(TEST_TENANT_ID);

    const createdPages = mockCreate.mock.calls.map((c) => ({
      title: c[0].data.title,
      icon: c[0].data.icon,
    }));

    expect(createdPages).toContainEqual({
      title: "Chemistry KB",
      icon: "\u{1F4DA}",
    });
    expect(createdPages).toContainEqual({
      title: "Experiments",
      icon: "\u{1F9EA}",
    });
    expect(createdPages).toContainEqual({
      title: "Reaction Types",
      icon: "\u{1F52C}",
    });
    expect(createdPages).toContainEqual({
      title: "Chemicals",
      icon: "\u2697\uFE0F",
    });
    expect(createdPages).toContainEqual({
      title: "Researchers",
      icon: "\u{1F469}\u200D\u{1F52C}",
    });
    expect(createdPages).toContainEqual({
      title: "Substrate Classes",
      icon: "\u{1F9EC}",
    });
    expect(createdPages).toContainEqual({
      title: "Chemistry KB Index",
      icon: "\u{1F4CB}",
    });
  });

  test("each page gets a one_liner summary", async () => {
    await setupChemistryKbHierarchy(TEST_TENANT_ID);

    for (const call of mockCreate.mock.calls) {
      const oneLiner = call[0].data.oneLiner;
      expect(oneLiner).toBeTruthy();
      expect(typeof oneLiner).toBe("string");
      expect(oneLiner.length).toBeGreaterThan(10);
    }
  });

  test("creates a DOCUMENT block for each page", async () => {
    await setupChemistryKbHierarchy(TEST_TENANT_ID);

    expect(mockBlockCreate).toHaveBeenCalledTimes(EXPECTED_PAGE_COUNT);

    for (const call of mockBlockCreate.mock.calls) {
      expect(call[0].data.type).toBe("DOCUMENT");
      expect(call[0].data.tenantId).toBe(TEST_TENANT_ID);
      expect(call[0].data.position).toBe(0);
    }
  });

  test("is idempotent — running twice produces same result", async () => {
    // First run: no pages exist
    const result1 = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    // Reset for second run: all pages now exist
    vi.clearAllMocks();
    mockAggregate.mockResolvedValue({ _max: { position: null } });
    mockBlockCreate.mockResolvedValue({ id: "block-uuid" });
    mockPageUpdate.mockResolvedValue({ id: "page-updated" });
    // Re-establish teamspace mocks wiped by clearAllMocks.
    mockTeamspaceFindFirst.mockResolvedValue({ id: DEFAULT_TEAMSPACE_ID });
    mockTeamspaceCreate.mockResolvedValue({ id: DEFAULT_TEAMSPACE_ID });
    mockUserFindMany.mockResolvedValue([]);
    mockTeamspaceMemberUpsert.mockResolvedValue({ id: "member-uuid" });

    // Simulate all pages already existing
    const existingPages: Record<string, string> = {
      "Chemistry KB": result1.rootId,
      Experiments: result1.experimentsId,
      Archive: result1.archiveId,
      "Reaction Types": result1.reactionTypesId,
      Chemicals: result1.chemicalsId,
      Researchers: result1.researchersId,
      "Substrate Classes": result1.substrateClassesId,
      "Chemistry KB Index": result1.indexId,
    };

    mockFindFirst.mockImplementation(({ where }) => {
      const id = existingPages[where.title as string];
      if (id) {
        return Promise.resolve({ id });
      }
      return Promise.resolve(null);
    });

    const result2 = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    // No new pages should be created
    expect(mockCreate).not.toHaveBeenCalled();

    // Same IDs returned
    expect(result2.rootId).toBe(result1.rootId);
    expect(result2.indexId).toBe(result1.indexId);
    expect(result2.experimentsId).toBe(result1.experimentsId);
    expect(result2.archiveId).toBe(result1.archiveId);
    expect(result2.reactionTypesId).toBe(result1.reactionTypesId);
    expect(result2.chemicalsId).toBe(result1.chemicalsId);
    expect(result2.researchersId).toBe(result1.researchersId);
    expect(result2.substrateClassesId).toBe(result1.substrateClassesId);
  });

  test("creates pages in TEAM space when teamspaceId provided", async () => {
    const teamspaceId = "teamspace-uuid-123";
    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID, {
      teamspaceId,
    });

    // All created pages should have spaceType TEAM and teamspaceId
    for (const call of mockCreate.mock.calls) {
      expect(call[0].data.spaceType).toBe("TEAM");
      expect(call[0].data.teamspaceId).toBe(teamspaceId);
    }

    // Result should include the teamspaceId
    expect(result.teamspaceId).toBe(teamspaceId);
  });

  test("assigns pages to the auto-resolved Chemistry KB teamspace by default", async () => {
    // With no explicit teamspaceId, setup now finds (or creates) a dedicated
    // "Chemistry KB" teamspace and assigns every page to it as TEAM space.
    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    expect(mockTeamspaceFindFirst).toHaveBeenCalled();
    for (const call of mockCreate.mock.calls) {
      expect(call[0].data.spaceType).toBe("TEAM");
      expect(call[0].data.teamspaceId).toBe(DEFAULT_TEAMSPACE_ID);
    }
    expect(result.teamspaceId).toBe(DEFAULT_TEAMSPACE_ID);
  });

  test("creates the Chemistry KB teamspace when it does not yet exist", async () => {
    // Force the not-found branch so the create + member-seeding path runs.
    mockTeamspaceFindFirst.mockResolvedValueOnce(null);
    mockTeamspaceCreate.mockResolvedValueOnce({ id: "newly-created-teamspace" });
    mockUserFindMany.mockResolvedValueOnce([
      { id: "u1", role: "ADMIN" },
      { id: "u2", role: "USER" },
    ]);

    const result = await setupChemistryKbHierarchy(TEST_TENANT_ID);

    expect(mockTeamspaceCreate).toHaveBeenCalledTimes(1);
    // Each active tenant user is added as a member of the new teamspace.
    expect(mockTeamspaceMemberUpsert).toHaveBeenCalledTimes(2);
    expect(result.teamspaceId).toBe("newly-created-teamspace");
  });

  test("CATEGORY_PAGES has the expected category keys", () => {
    expect(CATEGORY_PAGES).toHaveLength(6);
    const keys = CATEGORY_PAGES.map((p) => p.key);
    expect(keys).toEqual([
      "experiments",
      "archive",
      "reactionTypes",
      "chemicals",
      "researchers",
      "substrateClasses",
    ]);
  });
});

describe("generateIndexPageContent", () => {
  test("returns non-empty markdown string", () => {
    const content = generateIndexPageContent();
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(100);
  });

  test("includes section headings", () => {
    const content = generateIndexPageContent();
    expect(content).toContain("# Chemistry KB Index");
    expect(content).toContain("## For Agents: How to Use This KB");
    expect(content).toContain("### 2. Tag-Based Filtering");
    expect(content).toContain("## Tag Taxonomy Quick Reference");
    expect(content).toContain("## Entry Points");
  });

  test("includes wikilinks to all category pages", () => {
    const content = generateIndexPageContent();
    expect(content).toContain("[[Chemistry KB]]");
    expect(content).toContain("[[Experiments]]");
    expect(content).toContain("[[Reaction Types]]");
    expect(content).toContain("[[Chemicals]]");
    expect(content).toContain("[[Researchers]]");
    expect(content).toContain("[[Substrate Classes]]");
  });

  test("includes tag namespace examples", () => {
    const content = generateIndexPageContent();
    expect(content).toContain("`reaction:suzuki-coupling`");
    expect(content).toContain("`researcher:mueller`");
    expect(content).toContain("`cas:14221-01-3`");
    expect(content).toContain("`quality:4`");
    expect(content).toContain("`scale:medium`");
  });

  test("includes contextual retrieval example", () => {
    const content = generateIndexPageContent();
    expect(content).toContain("Contextual Retrieval Example");
    expect(content).toContain("heteroaryl substrates");
  });
});
