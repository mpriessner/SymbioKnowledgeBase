# Story SKB-51.7: Agent API — Bulk Context Fetch

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.7
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-51.2 (Experiment context endpoint must exist)

---

## User Story

As the SciSymbioLens voice agent managing multiple simultaneous experiments, I want to fetch context for 2-3 experiments in a single API call, So that I can efficiently load all active experiment contexts into the Gemini session without multiple round trips.

---

## Acceptance Criteria

1. **Bulk Endpoint**
   - [ ] Route: `POST /api/agent/pages/experiment-context/bulk`
   - [ ] Auth: Bearer token via `withAgentAuth`
   - [ ] Body:
     ```json
     {
       "experiments": [
         { "experimentId": "EXP-2026-0042", "depth": "medium" },
         { "experimentId": "EXP-2026-0043", "depth": "default" },
         { "experimentId": "EXP-2026-0044", "depth": "default" }
       ],
       "maxTotalSize": 45000
     }
     ```

2. **Token Budgeting**
   - [ ] `maxTotalSize` (in characters) enforced across all experiments
   - [ ] Budget distributed proportionally: primary experiment gets 60%, others split remaining 40%
   - [ ] First experiment in array is "primary" (gets largest budget)
   - [ ] If total exceeds budget, lower-priority experiments truncated first
   - [ ] Each experiment response includes `allocated` and `used` character counts

3. **Response Shape**
   ```json
   {
     "experiments": [
       {
         "experimentId": "EXP-2026-0042",
         "context": { /* same shape as SKB-51.2 single response */ },
         "allocated": 27000,
         "used": 24500,
         "truncated": false
       },
       {
         "experimentId": "EXP-2026-0043",
         "context": { /* ... */ },
         "allocated": 9000,
         "used": 8200,
         "truncated": false
       }
     ],
     "totalSize": 35800,
     "maxTotalSize": 45000,
     "experimentCount": 3
   }
   ```

4. **Parallel Fetching**
   - [ ] All experiment contexts fetched in parallel (Promise.all)
   - [ ] Individual experiment failure doesn't fail entire request
   - [ ] Failed experiments return `{ "experimentId": "...", "error": "not found" }`

5. **Deduplication**
   - [ ] Shared chemicals/reaction types across experiments not duplicated
   - [ ] If EXP-0042 and EXP-0043 both use Pd(PPh3)4, chemical info included once
   - [ ] Deduplication section: `sharedContext.chemicals`, `sharedContext.reactionTypes`

6. **Validation**
   - [ ] Max 5 experiments per request
   - [ ] 400 if experiments array empty or >5
   - [ ] 400 if maxTotalSize > 100,000
   - [ ] Each experimentId validated independently

---

## Technical Implementation Notes

### Bulk Assembler
```typescript
// src/lib/chemistryKb/bulkExperimentContext.ts

export async function assembleBulkContext(
  tenantId: string,
  experiments: { experimentId: string; depth: SearchDepth }[],
  maxTotalSize: number
): Promise<BulkContextResponse> {
  // 1. Fetch all contexts in parallel
  // 2. Identify shared entities (chemicals, reaction types)
  // 3. Deduplicate shared entities into sharedContext
  // 4. Apply token budgeting (60/40 split)
  // 5. Truncate if over budget
}
```

### Key Files
- `src/app/api/agent/pages/experiment-context/bulk/route.ts` — CREATE
- `src/lib/chemistryKb/bulkExperimentContext.ts` — CREATE

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Bulk fetch 2 experiments | Both contexts returned |
| Bulk fetch 3 experiments, one not found | 2 contexts + 1 error |
| maxTotalSize exceeded | Lower-priority experiments truncated |
| Shared chemicals deduplicated | Chemical appears in sharedContext once |
| Empty experiments array | 400 error |
| >5 experiments | 400 error |
| maxTotalSize > 100,000 | 400 error |
| Single experiment (degenerate case) | Works like single endpoint |
| All experiments not found | All return errors, no crash |

---

## Definition of Done

- [ ] Bulk endpoint returns multiple experiment contexts
- [ ] Token budgeting distributes characters correctly
- [ ] Deduplication removes shared entities
- [ ] Parallel fetching with individual error handling
- [ ] Unit tests for bulkExperimentContext
- [ ] API route test with mock data
- [ ] Performance: <1s for 3 experiments at default depth
