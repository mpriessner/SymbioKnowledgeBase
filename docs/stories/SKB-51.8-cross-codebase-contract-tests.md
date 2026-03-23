# Story SKB-51.8: Cross-Codebase API Contract Tests

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.8
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-51.2 (Experiment context endpoint), SKB-51.3 (Search depth API)

---

## User Story

As a developer working across SKB and SciSymbioLens codebases, I want contract tests that verify the API schemas match between what SKB serves and what SSL expects, So that cross-codebase changes don't silently break the integration.

---

## Acceptance Criteria

1. **Contract Schema Files**
   - [ ] Shared contract definitions in `src/lib/contracts/voiceAgentContracts.ts`
   - [ ] Zod schemas for all cross-codebase API endpoints:
     - `ExperimentContextResponseSchema`
     - `BulkContextResponseSchema`
     - `DepthSearchResponseSchema`
     - `CaptureLearningRequestSchema`
     - `CaptureLearningResponseSchema`
     - `PromotePageRequestSchema`
   - [ ] Schemas exported for use in both route handlers and tests

2. **Contract Tests**
   - [ ] Test file: `src/__tests__/contracts/voiceAgentContracts.test.ts`
   - [ ] Each API endpoint tested against its Zod schema
   - [ ] Tests use real Prisma mock data (not hardcoded JSON)
   - [ ] Tests verify:
     - Required fields present
     - Field types correct
     - Enum values valid
     - Nested objects match schema
     - Optional fields handled

3. **Snapshot Contracts**
   - [ ] JSON schema snapshots generated from Zod schemas
   - [ ] Stored in `src/lib/contracts/snapshots/`
   - [ ] CI fails if snapshot changes without explicit update
   - [ ] Snapshot files:
     - `experiment-context.schema.json`
     - `bulk-context.schema.json`
     - `depth-search.schema.json`
     - `capture-learning.schema.json`

4. **Route Handler Validation**
   - [ ] All new API routes (SKB-51.2, 49.3, 49.4, 49.6, 49.7) validate responses against contract schemas before sending
   - [ ] In development mode: throw error if response doesn't match schema
   - [ ] In production mode: log warning but send response anyway

5. **Documentation**
   - [ ] Contract schemas auto-generate OpenAPI-compatible documentation
   - [ ] Available at: `GET /api/agent/docs/contracts` (JSON)
   - [ ] Lists all voice agent API endpoints with request/response schemas

---

## Technical Implementation Notes

### Zod Contract Definitions
```typescript
// src/lib/contracts/voiceAgentContracts.ts

import { z } from "zod";

export const ChemicalContextSchema = z.object({
  name: z.string(),
  safety: z.string().optional(),
  handling: z.string().optional(),
});

export const ExperimentContextResponseSchema = z.object({
  experiment: z.object({
    id: z.string(),
    title: z.string(),
    oneLiner: z.string(),
    procedures: z.string().optional(),
    chemicals: z.array(ChemicalContextSchema),
    reactionType: z.object({
      name: z.string(),
      bestPractices: z.string().optional(),
    }).optional(),
    researcher: z.object({
      name: z.string(),
      expertise: z.string().optional(),
    }).optional(),
  }),
  institutionalKnowledge: z.object({
    bestPractices: z.array(z.string()),
    commonPitfalls: z.array(z.string()),
    relatedExperiments: z.array(z.object({
      id: z.string(),
      title: z.string(),
      outcome: z.string().optional(),
    })),
    tips: z.array(z.string()),
  }),
  contextSize: z.number(),
  depth: z.enum(["default", "medium", "deep"]),
  truncated: z.boolean(),
});

// ... more schemas
```

### Contract Test Pattern
```typescript
// src/__tests__/contracts/voiceAgentContracts.test.ts

describe("Voice Agent API Contracts", () => {
  it("experiment context response matches schema", () => {
    const mockResponse = buildMockExperimentContext();
    const result = ExperimentContextResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(true);
  });

  it("rejects response with missing required fields", () => {
    const invalid = { experiment: { id: "test" } }; // missing fields
    const result = ExperimentContextResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

### Key Files
- `src/lib/contracts/voiceAgentContracts.ts` — CREATE
- `src/__tests__/contracts/voiceAgentContracts.test.ts` — CREATE
- `src/lib/contracts/snapshots/` — CREATE (directory + JSON files)
- `src/app/api/agent/docs/contracts/route.ts` — CREATE

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Valid experiment context response | Passes schema validation |
| Response missing required field | Fails validation with clear error |
| Invalid enum value for depth | Fails validation |
| Snapshot unchanged | CI passes |
| Snapshot changed without update | CI fails with diff |
| Contracts docs endpoint | Returns JSON with all schemas |
| Route handler with invalid response (dev) | Throws error |
| Route handler with invalid response (prod) | Logs warning, sends anyway |

---

## Definition of Done

- [ ] All Zod contract schemas defined and exported
- [ ] Contract tests pass for all voice agent API endpoints
- [ ] JSON schema snapshots generated and committed
- [ ] Route handlers validate against contracts in dev mode
- [ ] Documentation endpoint returns contract schemas
- [ ] CI integration for snapshot comparison
