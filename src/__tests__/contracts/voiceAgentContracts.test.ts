import { describe, test, expect } from "vitest";
import {
  ExperimentContextResponseSchema,
  BulkContextResponseSchema,
  BulkContextRequestSchema,
  DepthSearchResponseSchema,
  CaptureLearningRequestSchema,
  CaptureLearningResponseSchema,
  PromotePageRequestSchema,
  PromotePageResponseSchema,
  ConflictReportSchema,
  RefreshRequestSchema,
  RefreshResponseSchema,
} from "@/lib/contracts/voiceAgentContracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockExperimentContext() {
  return {
    experiment: {
      id: "EXP-2026-0042",
      title: "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
      oneLiner: "Standard Suzuki coupling with Pd catalyst",
      procedures: "1. Add reagent\n2. Heat to 80°C",
      chemicals: [
        { name: "Pd(PPh3)4", safety: "Air-sensitive", handling: "Store under N2" },
      ],
      reactionType: {
        name: "Suzuki Coupling",
        bestPractices: "Always degas solvents",
      },
      researcher: {
        name: "Dr. Anna Mueller",
        expertise: "Cross-coupling reactions",
      },
    },
    institutionalKnowledge: {
      bestPractices: ["Always degas solvents", "Use fresh catalyst"],
      commonPitfalls: ["Old THF gives 10-15% yield drop"],
      relatedExperiments: [
        { id: "EXP-2026-0043", title: "Follow-up", outcome: "87% yield" },
      ],
      tips: ["Dr. Mueller recommends 80°C for heteroaryl substrates"],
    },
    contextSize: 1500,
    depth: "medium" as const,
    truncated: false,
  };
}

// ─── ExperimentContextResponseSchema ─────────────────────────────────────────

describe("ExperimentContextResponseSchema", () => {
  test("validates a complete experiment context", () => {
    const result = ExperimentContextResponseSchema.safeParse(
      buildMockExperimentContext()
    );
    expect(result.success).toBe(true);
  });

  test("validates minimal experiment context (default depth)", () => {
    const minimal = {
      experiment: {
        id: "EXP-001",
        title: "Test Experiment",
        oneLiner: null,
        chemicals: [],
      },
      institutionalKnowledge: {
        bestPractices: [],
        commonPitfalls: [],
        relatedExperiments: [],
        tips: [],
      },
      contextSize: 100,
      depth: "default",
      truncated: false,
    };

    const result = ExperimentContextResponseSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  test("rejects missing required fields", () => {
    const invalid = {
      experiment: { id: "test" },
    };
    const result = ExperimentContextResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test("rejects invalid depth enum", () => {
    const ctx = buildMockExperimentContext();
    (ctx as Record<string, unknown>).depth = "ultra";
    const result = ExperimentContextResponseSchema.safeParse(ctx);
    expect(result.success).toBe(false);
  });

  test("allows optional fields to be absent", () => {
    const ctx = buildMockExperimentContext();
    delete (ctx.experiment as Record<string, unknown>).procedures;
    delete (ctx.experiment as Record<string, unknown>).reactionType;
    delete (ctx.experiment as Record<string, unknown>).researcher;

    const result = ExperimentContextResponseSchema.safeParse(ctx);
    expect(result.success).toBe(true);
  });
});

// ─── BulkContextResponseSchema ───────────────────────────────────────────────

describe("BulkContextResponseSchema", () => {
  test("validates bulk response with mixed results", () => {
    const response = {
      experiments: [
        {
          experimentId: "EXP-001",
          context: buildMockExperimentContext(),
          allocated: 27000,
          used: 24500,
          truncated: false,
        },
        {
          experimentId: "EXP-002",
          error: "not found",
          allocated: 9000,
          used: 0,
          truncated: false,
        },
      ],
      totalSize: 24500,
      maxTotalSize: 45000,
      experimentCount: 2,
    };

    const result = BulkContextResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  test("validates bulk request schema", () => {
    const request = {
      experiments: [
        { experimentId: "EXP-001", depth: "medium" },
        { experimentId: "EXP-002" },
      ],
      maxTotalSize: 45000,
    };

    const result = BulkContextRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  test("rejects empty experiments array", () => {
    const result = BulkContextRequestSchema.safeParse({
      experiments: [],
      maxTotalSize: 45000,
    });
    expect(result.success).toBe(false);
  });

  test("rejects >5 experiments", () => {
    const result = BulkContextRequestSchema.safeParse({
      experiments: Array(6).fill({ experimentId: "EXP", depth: "default" }),
      maxTotalSize: 45000,
    });
    expect(result.success).toBe(false);
  });

  test("rejects maxTotalSize > 100000", () => {
    const result = BulkContextRequestSchema.safeParse({
      experiments: [{ experimentId: "EXP" }],
      maxTotalSize: 200000,
    });
    expect(result.success).toBe(false);
  });
});

// ─── DepthSearchResponseSchema ───────────────────────────────────────────────

describe("DepthSearchResponseSchema", () => {
  test("validates search response", () => {
    const response = {
      results: [
        {
          pageId: "page-1",
          title: "Suzuki Coupling",
          oneLiner: "Standard protocol",
          score: 1.0,
          category: "experiments",
          space: "team",
          snippet: "...relevant text...",
          linkedPages: ["Chemical A", "Researcher B"],
        },
      ],
      totalCount: 1,
      depth: "medium",
      scope: "all",
      searchTimeMs: 150,
    };

    const result = DepthSearchResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  test("validates empty search response", () => {
    const response = {
      results: [],
      totalCount: 0,
      depth: "default",
      scope: "team",
      searchTimeMs: 5,
    };

    const result = DepthSearchResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  test("rejects invalid scope", () => {
    const response = {
      results: [],
      totalCount: 0,
      depth: "default",
      scope: "invalid",
      searchTimeMs: 0,
    };
    const result = DepthSearchResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});

// ─── CaptureLearningSchema ───────────────────────────────────────────────────

describe("CaptureLearningSchema", () => {
  test("validates capture learning request", () => {
    const request = {
      experimentId: "EXP-2026-0042",
      learnings: [
        {
          type: "best_practice",
          content: "Always degas solvents",
          confidence: "high",
          promoteTo: "team",
        },
        {
          type: "pitfall",
          content: "Old THF gives yield drop",
          confidence: "medium",
          promoteTo: null,
        },
      ],
      debriefSummary: "Successful run",
    };

    const result = CaptureLearningRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  test("validates capture learning response", () => {
    const response = {
      captured: 2,
      promoted: 1,
      conflictsDetected: 0,
      pageUpdates: [{ pageId: "page-1", action: "appended" }],
    };

    const result = CaptureLearningResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  test("rejects empty learnings array", () => {
    const result = CaptureLearningRequestSchema.safeParse({
      experimentId: "EXP-001",
      learnings: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid learning type", () => {
    const result = CaptureLearningRequestSchema.safeParse({
      experimentId: "EXP-001",
      learnings: [
        { type: "invalid_type", content: "Test", confidence: "high" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── PromotePageSchema ───────────────────────────────────────────────────────

describe("PromotePageSchema", () => {
  test("validates promotion request", () => {
    const request = {
      sourcePageId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      targetCategoryId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      promotionType: "copy",
      sections: ["all"],
      reviewRequired: true,
    };

    const result = PromotePageRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  test("validates promotion response", () => {
    const response = {
      promotedPageId: "new-page-id",
      action: "copied",
      sectionsPromoted: ["all"],
      duplicateWarning: "Similar page exists",
      reviewStatus: "pending_review",
    };

    const result = PromotePageResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  test("rejects invalid promotion type", () => {
    const result = PromotePageRequestSchema.safeParse({
      sourcePageId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      targetCategoryId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      promotionType: "link",
      sections: ["all"],
    });
    expect(result.success).toBe(false);
  });
});

// ─── ConflictReportSchema ────────────────────────────────────────────────────

describe("ConflictReportSchema", () => {
  test("validates conflict report", () => {
    const report = {
      conflicts: [
        {
          id: "conflict-1",
          type: "contradictory",
          existingPage: { id: "p1", title: "Old", statement: "Use THF at RT" },
          newPage: { id: "p2", title: "New", statement: "Heat THF to 60C" },
          similarity: 0.82,
          suggestion: "Review both statements",
        },
      ],
      totalConflicts: 1,
      autoResolvable: 0,
      requiresReview: 1,
    };

    const result = ConflictReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  test("validates empty conflict report", () => {
    const result = ConflictReportSchema.safeParse({
      conflicts: [],
      totalConflicts: 0,
      autoResolvable: 0,
      requiresReview: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ─── RefreshSchema ───────────────────────────────────────────────────────────

describe("RefreshSchema", () => {
  test("validates refresh request", () => {
    const result = RefreshRequestSchema.safeParse({
      pageIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      trigger: "promotion",
    });
    expect(result.success).toBe(true);
  });

  test("validates refresh response", () => {
    const result = RefreshResponseSchema.safeParse({
      refreshed: 3,
      duration: 450,
      pageIds: ["p1", "p2", "p3"],
    });
    expect(result.success).toBe(true);
  });
});

// ─── Snapshot Tests ──────────────────────────────────────────────────────────

describe("Contract Snapshots", () => {
  test("ExperimentContextResponseSchema shape matches snapshot", () => {
    const shape = ExperimentContextResponseSchema.shape;
    const keys = Object.keys(shape).sort();
    expect(keys).toMatchSnapshot();
  });

  test("DepthSearchResponseSchema shape matches snapshot", () => {
    const shape = DepthSearchResponseSchema.shape;
    const keys = Object.keys(shape).sort();
    expect(keys).toMatchSnapshot();
  });

  test("CaptureLearningRequestSchema shape matches snapshot", () => {
    const shape = CaptureLearningRequestSchema.shape;
    const keys = Object.keys(shape).sort();
    expect(keys).toMatchSnapshot();
  });

  test("BulkContextResponseSchema shape matches snapshot", () => {
    const shape = BulkContextResponseSchema.shape;
    const keys = Object.keys(shape).sort();
    expect(keys).toMatchSnapshot();
  });
});
