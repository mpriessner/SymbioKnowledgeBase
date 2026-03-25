# Story SKB-51.2: Experiment Context Endpoint

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.2
**Story Points:** 5 | **Priority:** High | **Status:** Mostly Complete
**Depends On:** SKB-51.1 (Chemistry KB must be in Team space)

---

## User Story

As the SciSymbioLens voice agent, I want to fetch pre-assembled context for a specific experiment from the Chemistry KB, So that I can inject relevant procedures, chemicals, best practices, and institutional knowledge into the Gemini system prompt before the researcher starts working.

---

## Acceptance Criteria

1. **New API Endpoint**
   - [x] Route: `GET /api/agent/pages/experiment-context`
   - [x] Auth: Bearer token via `withAgentAuth` middleware
   - [x] Query params:
     - `experimentId` (required) — e.g., "EXP-2026-0042"
     - `depth` (optional) — `"default"` | `"medium"` | `"deep"` (default: `"default"`)
     - `include` (optional) — **NOT IMPLEMENTED: parsed but not used; selective field filtering missing**

2. **Default Depth Response** (titles + one-liners only)
   - [x] Returns experiment title, one-liner, reaction type name
   - [x] Returns chemical names and safety one-liners
   - [x] Returns researcher name and expertise summary
   - [x] Target size: <1,500 characters (enforced via MAX_SIZES)
   - [ ] Response time: <200ms — **UNTESTED: no perf benchmarks**

3. **Medium Depth Response** (full pages + 1-hop neighbors)
   - [x] Everything from default PLUS:
   - [x] Full experiment procedures (markdown content)
   - [x] Chemical handling instructions and storage notes
   - [x] Reaction type best practices section
   - [ ] 1-hop related experiments (same reaction type, same researcher) — **GAP: only at deep depth, not medium**
   - [x] Target size: <8,000 characters (enforced via MAX_SIZES)
   - [ ] Response time: <500ms — **UNTESTED**

4. **Deep Depth Response** (full graph traversal)
   - [x] Everything from medium PLUS:
   - [ ] All experiments using same chemicals — **NOT IMPLEMENTED: only fetches by same reaction type**
   - [x] Cross-referenced institutional knowledge from related substrate classes
   - [ ] Historical yield data and trend analysis — **NOT IMPLEMENTED**
   - [x] Common pitfalls from failed experiments of same type (partial: limited to 3 related experiments)
   - [x] Target size: <20,000 characters (enforced via MAX_SIZES)
   - [ ] Response time: <2,000ms — **UNTESTED**

5. **Response Shape**
   - [x] Matches contract specification (experiment, institutionalKnowledge, contextSize, depth, truncated)

6. **Error Handling**
   - [x] 400 if `experimentId` missing
   - [x] 404 if experiment not found in tenant's KB
   - [x] 400 if invalid `depth` value
   - [x] Response includes `contextSize` (character count) for client-side budgeting

---

## Implementation Status (2026-03-24)

### What's Built
- **Endpoint**: `src/app/api/agent/pages/experiment-context/route.ts` (73 lines)
- **Core logic**: `src/lib/chemistryKb/experimentContext.ts` (376 lines)
  - `assembleExperimentContext()` with all 3 depth levels
  - Size budgeting with smart truncation
  - `findExperimentPage()`, `getPageMarkdown()`, `extractSection()`, `extractBulletPoints()`
  - `getLinkedPagesByCategory()` for wikilink-based traversal
- **Tests**: `src/__tests__/lib/chemistryKb/experimentContext.test.ts` (306 lines, 8+ test cases)

### Remaining Gaps
1. **`include` query parameter**: Not wired up (parsed but ignored)
2. **Related experiments at medium depth**: Currently only at deep depth
3. **Chemical-based experiment lookup**: Deep depth only finds by reaction type, not by shared chemicals
4. **Yield data extraction**: No historical yield/trend parsing
5. **Performance benchmarks**: No tests for response time targets
6. **Integration tests**: All tests mock Prisma

---

## Technical Implementation Notes

### Route File
```
src/app/api/agent/pages/experiment-context/route.ts
```

### Core Logic: `assembleExperimentContext()`
```typescript
// src/lib/chemistryKb/experimentContext.ts

export interface ExperimentContext {
  experiment: {
    id: string;
    title: string;
    oneLiner: string;
    procedures?: string;
    chemicals: ChemicalContext[];
    reactionType?: ReactionTypeContext;
    researcher?: ResearcherContext;
  };
  institutionalKnowledge: {
    bestPractices: string[];
    commonPitfalls: string[];
    relatedExperiments: RelatedExperiment[];
    tips: string[];
  };
  contextSize: number;
  depth: "default" | "medium" | "deep";
  truncated: boolean;
}

export async function assembleExperimentContext(
  tenantId: string,
  experimentId: string,
  depth: "default" | "medium" | "deep" = "default",
  include?: string[]
): Promise<ExperimentContext> {
  // 1. Find experiment page by tag: "experiment:{experimentId}"
  // 2. Based on depth, fetch related pages via wikilinks and tags
  // 3. Extract institutional knowledge sections from page content
  // 4. Assemble and truncate to target size
}
```

### Key Files
- `src/app/api/agent/pages/experiment-context/route.ts` — DONE
- `src/lib/chemistryKb/experimentContext.ts` — DONE (partial gaps)
- `src/__tests__/lib/chemistryKb/experimentContext.test.ts` — DONE

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| GET with valid experimentId, default depth | Returns titles + one-liners, <1500 chars |
| GET with valid experimentId, medium depth | Returns full procedures + chemicals, <8000 chars |
| GET with valid experimentId, deep depth | Returns full graph traversal, <20000 chars |
| GET with include=procedures,chemicals | Only requested sections included |
| GET with missing experimentId | 400 error |
| GET with non-existent experimentId | 404 error |
| GET with invalid depth value | 400 error |
| Experiment with no linked chemicals | Empty chemicals array, no error |
| Experiment in different tenant | 404 (tenant isolation) |
| Response truncation at depth boundary | `truncated: true`, `contextSize` accurate |

---

## Definition of Done

- [x] Endpoint returns correct data for all three depth levels
- [x] Response shape matches contract in EPIC-51
- [ ] Tenant isolation verified (cross-tenant returns 404) — unit tests only, no integration test
- [ ] Performance: default <200ms, medium <500ms, deep <2000ms — untested
- [x] Unit tests for `assembleExperimentContext()`
- [ ] API route test with mock data
- [x] contextSize accurately reflects character count
