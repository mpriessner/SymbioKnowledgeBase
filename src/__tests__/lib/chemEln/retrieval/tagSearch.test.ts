import { describe, it, expect } from "vitest";
import {
  searchByTags,
  parseTagQuery,
  type TagSearchQuery,
} from "@/lib/chemEln/retrieval/tagSearch";
import {
  filterByTags,
  matchesTag,
  extractTagsFromFrontmatter,
  type PageWithTags,
} from "@/lib/chemEln/retrieval/tagFilter";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PAGES: PageWithTags[] = [
  {
    id: "exp-001",
    title: "Suzuki coupling of 2-bromopyridine",
    tags: [
      "reaction:suzuki-coupling",
      "substrate-class:heteroaryl",
      "scale:medium",
      "challenge:protodeboronation",
      "quality:4",
      "researcher:mueller",
    ],
    frontmatter: {},
  },
  {
    id: "exp-002",
    title: "Suzuki coupling of bromobenzene",
    tags: [
      "reaction:suzuki-coupling",
      "substrate-class:aryl",
      "scale:large",
      "quality:5",
      "researcher:schmidt",
    ],
    frontmatter: {},
  },
  {
    id: "exp-003",
    title: "Heck reaction with vinyl substrate",
    tags: [
      "reaction:heck",
      "substrate-class:vinyl",
      "scale:small",
      "quality:3",
      "researcher:mueller",
    ],
    frontmatter: {},
  },
  {
    id: "exp-004",
    title: "Large-scale Suzuki coupling pilot",
    tags: [
      "reaction:suzuki-coupling",
      "substrate-class:aryl",
      "scale:pilot",
      "quality:5",
      "challenge:scale-up",
      "researcher:jones",
    ],
    frontmatter: {},
  },
  {
    id: "exp-005",
    title: "Failed alkyl Suzuki",
    tags: [
      "reaction:suzuki-coupling",
      "substrate-class:alkyl",
      "scale:small",
      "quality:1",
      "challenge:yield",
      "researcher:mueller",
    ],
    frontmatter: {},
  },
];

// ---------------------------------------------------------------------------
// matchesTag
// ---------------------------------------------------------------------------

describe("matchesTag", () => {
  it("should match exact tags", () => {
    const tags = ["reaction:suzuki-coupling", "scale:large"];
    expect(matchesTag(tags, "reaction:suzuki-coupling")).toBe(true);
    expect(matchesTag(tags, "scale:large")).toBe(true);
  });

  it("should be case-insensitive", () => {
    const tags = ["reaction:suzuki-coupling"];
    expect(matchesTag(tags, "Reaction:Suzuki-Coupling")).toBe(true);
  });

  it("should not match when tag is absent", () => {
    const tags = ["reaction:heck"];
    expect(matchesTag(tags, "reaction:suzuki-coupling")).toBe(false);
  });

  it("should handle range query quality:4+", () => {
    expect(matchesTag(["quality:5"], "quality:4+")).toBe(true);
    expect(matchesTag(["quality:4"], "quality:4+")).toBe(true);
    expect(matchesTag(["quality:3"], "quality:4+")).toBe(false);
  });

  it("should handle range query quality:1+", () => {
    expect(matchesTag(["quality:1"], "quality:1+")).toBe(true);
    expect(matchesTag(["quality:0"], "quality:1+")).toBe(false);
  });

  it("should not range-match non-numeric tag values", () => {
    expect(matchesTag(["quality:high"], "quality:4+")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterByTags
// ---------------------------------------------------------------------------

describe("filterByTags", () => {
  it("should filter with AND operator", () => {
    const result = filterByTags(
      PAGES,
      ["reaction:suzuki-coupling", "scale:large"],
      "AND"
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("exp-002");
  });

  it("should filter with OR operator", () => {
    const result = filterByTags(
      PAGES,
      ["scale:large", "scale:pilot"],
      "OR"
    );
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("exp-002");
    expect(ids).toContain("exp-004");
  });

  it("should return all pages when tags array is empty", () => {
    const result = filterByTags(PAGES, [], "AND");
    expect(result).toHaveLength(PAGES.length);
  });

  it("should return empty when no pages match AND", () => {
    const result = filterByTags(
      PAGES,
      ["reaction:buchwald", "scale:pilot"],
      "AND"
    );
    expect(result).toHaveLength(0);
  });

  it("should filter using range queries with AND", () => {
    const result = filterByTags(
      PAGES,
      ["reaction:suzuki-coupling", "quality:4+"],
      "AND"
    );
    expect(result).toHaveLength(3);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("exp-001");
    expect(ids).toContain("exp-002");
    expect(ids).toContain("exp-004");
  });
});

// ---------------------------------------------------------------------------
// extractTagsFromFrontmatter
// ---------------------------------------------------------------------------

describe("extractTagsFromFrontmatter", () => {
  it("should extract single-value tag fields", () => {
    const fm = {
      reaction: "suzuki-coupling",
      scale: "medium",
    };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toContain("reaction:suzuki-coupling");
    expect(tags).toContain("scale:medium");
  });

  it("should extract array tag fields", () => {
    const fm = {
      "functional-groups": ["amino", "nitro"],
    };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toContain("functional-groups:amino");
    expect(tags).toContain("functional-groups:nitro");
  });

  it("should extract numeric quality field", () => {
    const fm = { quality: 4 };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toContain("quality:4");
  });

  it("should skip undefined/null values", () => {
    const fm = { reaction: "heck", scale: undefined, challenge: null };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toEqual(["reaction:heck"]);
  });

  it("should ignore non-tag keys", () => {
    const fm = { title: "My Experiment", reaction: "heck" };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toEqual(["reaction:heck"]);
  });

  it("should include existing tags array without duplicates", () => {
    const fm = {
      reaction: "heck",
      tags: ["reaction:heck", "custom:special"],
    };
    const tags = extractTagsFromFrontmatter(fm);
    expect(tags).toContain("reaction:heck");
    expect(tags).toContain("custom:special");
    // No duplicate reaction:heck
    expect(tags.filter((t) => t === "reaction:heck")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseTagQuery
// ---------------------------------------------------------------------------

describe("parseTagQuery", () => {
  it("should parse a single tag", () => {
    const q = parseTagQuery("reaction:suzuki-coupling", "tenant-1");
    expect(q.tags).toEqual(["reaction:suzuki-coupling"]);
    expect(q.operator).toBe("AND");
    expect(q.tenantId).toBe("tenant-1");
  });

  it("should parse AND query", () => {
    const q = parseTagQuery(
      "researcher:mueller AND reaction:suzuki-coupling",
      "t1"
    );
    expect(q.tags).toEqual(["researcher:mueller", "reaction:suzuki-coupling"]);
    expect(q.operator).toBe("AND");
  });

  it("should parse OR query", () => {
    const q = parseTagQuery(
      "reaction:suzuki-coupling OR reaction:heck",
      "t1"
    );
    expect(q.tags).toEqual(["reaction:suzuki-coupling", "reaction:heck"]);
    expect(q.operator).toBe("OR");
  });

  it("should parse range query quality:4+", () => {
    const q = parseTagQuery("scale:large AND quality:4+", "t1");
    expect(q.tags).toEqual(["scale:large", "quality:4+"]);
    expect(q.operator).toBe("AND");
  });

  it("should return empty tags for empty string", () => {
    const q = parseTagQuery("", "t1");
    expect(q.tags).toEqual([]);
    expect(q.operator).toBe("AND");
  });

  it("should default tenantId to empty string", () => {
    const q = parseTagQuery("reaction:heck");
    expect(q.tenantId).toBe("");
  });

  it("should be case-insensitive for AND/OR keywords", () => {
    const q1 = parseTagQuery("a:1 and b:2");
    expect(q1.operator).toBe("AND");
    expect(q1.tags).toEqual(["a:1", "b:2"]);

    const q2 = parseTagQuery("a:1 or b:2");
    expect(q2.operator).toBe("OR");
    expect(q2.tags).toEqual(["a:1", "b:2"]);
  });
});

// ---------------------------------------------------------------------------
// searchByTags
// ---------------------------------------------------------------------------

describe("searchByTags", () => {
  it("should find all Suzuki coupling experiments", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(4);
    results.forEach((r) => {
      expect(r.matchedTags).toContain("reaction:suzuki-coupling");
      expect(r.score).toBeGreaterThan(0);
    });
  });

  it("should find Mueller's Suzuki experiments", () => {
    const query: TagSearchQuery = {
      tags: ["researcher:mueller", "reaction:suzuki-coupling"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.page.id);
    expect(ids).toContain("exp-001");
    expect(ids).toContain("exp-005");
  });

  it("should find experiments with protodeboronation challenge", () => {
    const query: TagSearchQuery = {
      tags: ["challenge:protodeboronation"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(1);
    expect(results[0].page.id).toBe("exp-001");
  });

  it("should find large-scale high-quality experiments", () => {
    const query: TagSearchQuery = {
      tags: ["scale:large", "quality:4+"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(1);
    expect(results[0].page.id).toBe("exp-002");
  });

  it("should rank higher-quality pages with higher score", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling", "quality:4+"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    // exp-002 (quality:5) and exp-004 (quality:5) should rank above exp-001 (quality:4)
    expect(results.length).toBeGreaterThanOrEqual(3);
    const topIds = results.slice(0, 2).map((r) => r.page.id);
    expect(topIds).toContain("exp-002");
    expect(topIds).toContain("exp-004");
  });

  it("should respect limit parameter", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling"],
      operator: "AND",
      tenantId: "t1",
      limit: 2,
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(2);
  });

  it("should respect offset parameter", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling"],
      operator: "AND",
      tenantId: "t1",
      offset: 2,
      limit: 2,
    };
    const all = searchByTags(
      { tags: ["reaction:suzuki-coupling"], operator: "AND", tenantId: "t1" },
      PAGES
    );
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(2);
    expect(results[0].page.id).toBe(all[2].page.id);
  });

  it("should return empty for no matching tags", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:buchwald-hartwig"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(0);
  });

  it("should return empty when tags array is empty", () => {
    const query: TagSearchQuery = {
      tags: [],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(0);
  });

  it("should support OR operator across different reactions", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling", "reaction:heck"],
      operator: "OR",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(5);
  });

  it("should include matchedTags in results", () => {
    const query: TagSearchQuery = {
      tags: ["reaction:suzuki-coupling", "challenge:protodeboronation"],
      operator: "AND",
      tenantId: "t1",
    };
    const results = searchByTags(query, PAGES);
    expect(results).toHaveLength(1);
    expect(results[0].matchedTags).toContain("reaction:suzuki-coupling");
    expect(results[0].matchedTags).toContain("challenge:protodeboronation");
  });
});
