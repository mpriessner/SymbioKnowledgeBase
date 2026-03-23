/**
 * Cross-Codebase API Contract Schemas
 *
 * Zod schemas that define the shared API contract between
 * SymbioKnowledgeBase (server) and SciSymbioLens (client).
 *
 * These schemas are used:
 * 1. In tests to validate response shapes
 * 2. For snapshot testing to catch breaking changes
 * 3. As documentation for the API integration
 */

import { z } from "zod";

// ─── Shared Enums ────────────────────────────────────────────────────────────

export const SearchDepthSchema = z.enum(["default", "medium", "deep"]);
export const SearchScopeSchema = z.enum(["private", "team", "all"]);
export const LearningTypeSchema = z.enum([
  "best_practice",
  "pitfall",
  "optimization",
  "observation",
]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

// ─── Experiment Context ──────────────────────────────────────────────────────

export const ChemicalContextSchema = z.object({
  name: z.string(),
  safety: z.string().optional(),
  handling: z.string().optional(),
});

export const ReactionTypeContextSchema = z.object({
  name: z.string(),
  bestPractices: z.string().optional(),
});

export const ResearcherContextSchema = z.object({
  name: z.string(),
  expertise: z.string().optional(),
});

export const RelatedExperimentSchema = z.object({
  id: z.string(),
  title: z.string(),
  outcome: z.string().optional(),
});

export const InstitutionalKnowledgeSchema = z.object({
  bestPractices: z.array(z.string()),
  commonPitfalls: z.array(z.string()),
  relatedExperiments: z.array(RelatedExperimentSchema),
  tips: z.array(z.string()),
});

export const ExperimentContextResponseSchema = z.object({
  experiment: z.object({
    id: z.string(),
    title: z.string(),
    oneLiner: z.string().nullable(),
    procedures: z.string().optional(),
    chemicals: z.array(ChemicalContextSchema),
    reactionType: ReactionTypeContextSchema.optional(),
    researcher: ResearcherContextSchema.optional(),
  }),
  institutionalKnowledge: InstitutionalKnowledgeSchema,
  contextSize: z.number(),
  depth: SearchDepthSchema,
  truncated: z.boolean(),
});

// ─── Bulk Context ────────────────────────────────────────────────────────────

export const BulkExperimentItemSchema = z.object({
  experimentId: z.string(),
  context: ExperimentContextResponseSchema.optional(),
  error: z.string().optional(),
  allocated: z.number(),
  used: z.number(),
  truncated: z.boolean(),
});

export const BulkContextRequestSchema = z.object({
  experiments: z
    .array(
      z.object({
        experimentId: z.string().min(1),
        depth: SearchDepthSchema.default("default"),
      })
    )
    .min(1)
    .max(5),
  maxTotalSize: z.number().int().min(1000).max(100000).default(45000),
});

export const BulkContextResponseSchema = z.object({
  experiments: z.array(BulkExperimentItemSchema),
  totalSize: z.number(),
  maxTotalSize: z.number(),
  experimentCount: z.number(),
});

// ─── Depth Search ────────────────────────────────────────────────────────────

export const DepthSearchResultItemSchema = z.object({
  pageId: z.string(),
  title: z.string(),
  oneLiner: z.string().nullable(),
  snippet: z.string().optional(),
  score: z.number(),
  category: z.string().nullable(),
  space: z.string(),
  linkedPages: z.array(z.string()).optional(),
  relatedPages: z.array(z.string()).optional(),
  institutionalKnowledge: z.array(z.string()).optional(),
});

export const DepthSearchResponseSchema = z.object({
  results: z.array(DepthSearchResultItemSchema),
  totalCount: z.number(),
  depth: SearchDepthSchema,
  scope: SearchScopeSchema,
  searchTimeMs: z.number(),
});

// ─── Capture Learning ────────────────────────────────────────────────────────

export const LearningItemSchema = z.object({
  type: LearningTypeSchema,
  content: z.string().min(1),
  confidence: ConfidenceSchema,
  promoteTo: z.enum(["team"]).nullable().optional(),
});

export const CaptureLearningRequestSchema = z.object({
  experimentId: z.string().min(1),
  learnings: z.array(LearningItemSchema).min(1),
  debriefSummary: z.string().optional(),
});

export const CaptureLearningResponseSchema = z.object({
  captured: z.number(),
  promoted: z.number(),
  conflictsDetected: z.number(),
  pageUpdates: z.array(
    z.object({
      pageId: z.string(),
      action: z.enum(["appended", "created"]),
    })
  ),
});

// ─── Promotion ───────────────────────────────────────────────────────────────

export const PromotePageRequestSchema = z.object({
  sourcePageId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  promotionType: z.enum(["copy", "move"]),
  sections: z.array(z.string()).min(1),
  reviewRequired: z.boolean().default(false),
});

export const PromotePageResponseSchema = z.object({
  promotedPageId: z.string(),
  action: z.enum(["copied", "moved"]),
  sectionsPromoted: z.array(z.string()),
  duplicateWarning: z.string().optional(),
  reviewStatus: z.enum(["approved", "pending_review"]),
});

// ─── Conflict Detection ──────────────────────────────────────────────────────

export const ConflictSchema = z.object({
  id: z.string(),
  type: z.enum(["contradictory", "superseded", "conditional"]),
  existingPage: z.object({
    id: z.string(),
    title: z.string(),
    statement: z.string(),
  }),
  newPage: z.object({
    id: z.string(),
    title: z.string(),
    statement: z.string(),
  }),
  similarity: z.number(),
  suggestion: z.string(),
});

export const ConflictReportSchema = z.object({
  conflicts: z.array(ConflictSchema),
  totalConflicts: z.number(),
  autoResolvable: z.number(),
  requiresReview: z.number(),
});

// ─── Aggregation Refresh ─────────────────────────────────────────────────────

export const RefreshRequestSchema = z.object({
  pageIds: z.array(z.string().uuid()).min(1),
  trigger: z.enum(["manual", "promotion", "capture", "sync"]).default("manual"),
});

export const RefreshResponseSchema = z.object({
  refreshed: z.number(),
  duration: z.number(),
  pageIds: z.array(z.string()),
});
