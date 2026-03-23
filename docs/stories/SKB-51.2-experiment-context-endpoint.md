# Story SKB-51.2: Experiment Context Endpoint

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.2
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-51.1 (Chemistry KB must be in Team space)

---

## User Story

As the SciSymbioLens voice agent, I want to fetch pre-assembled context for a specific experiment from the Chemistry KB, So that I can inject relevant procedures, chemicals, best practices, and institutional knowledge into the Gemini system prompt before the researcher starts working.

---

## Acceptance Criteria

1. **New API Endpoint**
   - [ ] Route: `GET /api/agent/pages/experiment-context`
   - [ ] Auth: Bearer token via `withAgentAuth` middleware
   - [ ] Query params:
     - `experimentId` (required) — e.g., "EXP-2026-0042"
     - `depth` (optional) — `"default"` | `"medium"` | `"deep"` (default: `"default"`)
     - `include` (optional) — comma-separated: `"procedures,chemicals,bestPractices,relatedExperiments"`

2. **Default Depth Response** (titles + one-liners only)
   - [ ] Returns experiment title, one-liner, reaction type name
   - [ ] Returns chemical names and safety one-liners
   - [ ] Returns researcher name and expertise summary
   - [ ] Target size: <1,500 characters
   - [ ] Response time: <200ms

3. **Medium Depth Response** (full pages + 1-hop neighbors)
   - [ ] Everything from default PLUS:
   - [ ] Full experiment procedures (markdown content)
   - [ ] Chemical handling instructions and storage notes
   - [ ] Reaction type best practices section
   - [ ] 1-hop related experiments (same reaction type, same researcher)
   - [ ] Target size: <8,000 characters
   - [ ] Response time: <500ms

4. **Deep Depth Response** (full graph traversal)
   - [ ] Everything from medium PLUS:
   - [ ] All experiments using same chemicals
   - [ ] Cross-referenced institutional knowledge from related substrate classes
   - [ ] Historical yield data and trend analysis
   - [ ] Common pitfalls from failed experiments of same type
   - [ ] Target size: <20,000 characters
   - [ ] Response time: <2,000ms

5. **Response Shape**
   ```json
   {
     "experiment": {
       "id": "EXP-2026-0042",
       "title": "Suzuki Coupling — 4-Bromopyridine + Phenylboronic acid",
       "oneLiner": "Standard Suzuki coupling...",
       "procedures": "## Steps\n1. Charge flask...",
       "chemicals": [
         { "name": "Pd(PPh3)4", "safety": "Air-sensitive", "handling": "Use Schlenk line..." }
       ],
       "reactionType": { "name": "Suzuki Coupling", "bestPractices": "..." },
       "researcher": { "name": "Dr. Anna Mueller", "expertise": "Cross-coupling" }
     },
     "institutionalKnowledge": {
       "bestPractices": ["Always degas solvents...", "..."],
       "commonPitfalls": ["Old THF gives 10-15% yield drop", "..."],
       "relatedExperiments": [
         { "id": "EXP-2026-0043", "title": "...", "outcome": "85% yield" }
       ],
       "tips": ["Dr. Mueller recommends..."]
     },
     "contextSize": 3200,
     "depth": "medium",
     "truncated": false
   }
   ```

6. **Error Handling**
   - [ ] 400 if `experimentId` missing
   - [ ] 404 if experiment not found in tenant's KB
   - [ ] 400 if invalid `depth` value
   - [ ] Response includes `contextSize` (character count) for client-side budgeting

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

### Page Content Extraction
Experiment pages store content as TipTap JSON in DOCUMENT blocks. The function needs to:
1. Fetch the block content
2. Convert TipTap JSON → markdown (for system prompt injection)
3. Extract specific sections (## Procedures, ## Institutional Knowledge, etc.)

### Wikilink-Based Graph Traversal
- Experiment pages wikilink to chemicals, reaction types, researchers
- Use existing `PageLink` model to traverse 1-hop (medium) or full graph (deep)
- Query: `SELECT * FROM "PageLink" WHERE "sourcePageId" = $1 OR "targetPageId" = $1`

### Key Files
- `src/app/api/agent/pages/experiment-context/route.ts` — CREATE
- `src/lib/chemistryKb/experimentContext.ts` — CREATE
- `src/lib/chemistryKb/contentExtractor.ts` — CREATE (extracts sections from TipTap content)

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

- [ ] Endpoint returns correct data for all three depth levels
- [ ] Response shape matches contract in EPIC-51
- [ ] Tenant isolation verified (cross-tenant returns 404)
- [ ] Performance: default <200ms, medium <500ms, deep <2000ms
- [ ] Unit tests for `assembleExperimentContext()`
- [ ] API route test with mock data
- [ ] contextSize accurately reflects character count
