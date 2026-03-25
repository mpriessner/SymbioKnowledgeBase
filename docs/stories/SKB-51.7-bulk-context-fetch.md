# Story SKB-51.7: Agent API -- Bulk Context Fetch

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.7
**Story Points:** 3 | **Priority:** High | **Status:** Complete
**Depends On:** SKB-51.2 (Experiment context endpoint must exist)

---

## User Story

As the SciSymbioLens voice agent managing multiple simultaneous experiments, I want to fetch context for 2-3 experiments in a single API call, So that I can efficiently load all active experiment contexts into the Gemini session without multiple round trips.

---

## Acceptance Criteria

1. **Bulk Endpoint**
   - [x] Route: `POST /api/agent/pages/experiment-context/bulk`
   - [x] Auth: Bearer token via `withAgentAuth`
   - [x] Body: experiments array with experimentId + depth, plus maxTotalSize

2. **Token Budgeting**
   - [x] `maxTotalSize` (in characters) enforced across all experiments
   - [x] Budget distributed proportionally: primary experiment gets 60%, others split remaining 40%
   - [x] First experiment in array is "primary" (gets largest budget)
   - [x] If total exceeds budget, lower-priority experiments truncated first
   - [x] Each experiment response includes `allocated` and `used` character counts

3. **Response Shape**
   - [x] Matches specification (experiments array with context/error/allocated/used/truncated, totalSize, maxTotalSize, experimentCount)

4. **Parallel Fetching**
   - [x] All experiment contexts fetched in parallel (`Promise.allSettled`)
   - [x] Individual experiment failure doesn't fail entire request
   - [x] Failed experiments return `{ "experimentId": "...", "error": "not found" }`

5. **Deduplication**
   - [x] Shared chemicals/reaction types across experiments identified in `sharedContext`
   - [x] `sharedContext` section with chemicals, reactionTypes, researchers shared across 2+ experiments

6. **Validation**
   - [x] Max 5 experiments per request
   - [x] 400 if experiments array empty or >5
   - [x] 400 if maxTotalSize > 100,000
   - [x] Each experimentId validated independently

---

## Implementation Status (2026-03-24)

### What's Built
- **Service**: `src/lib/chemistryKb/bulkExperimentContext.ts` (130 lines)
  - `assembleBulkContext()` — parallel fetching with Promise.allSettled
  - Budget allocation: 60% primary, 40% split among secondaries
  - Per-experiment error tracking without cascade failure
  - Truncation detection
- **API Route**: `src/app/api/agent/pages/experiment-context/bulk/route.ts` (63 lines)
  - POST with validation (1-5 experiments, 1000-100000 char budget)
- **Tests**: `src/__tests__/lib/chemistryKb/bulkExperimentContext.test.ts` (150+ lines)

### Completed (2026-03-24)
- **Cross-experiment deduplication**: `extractSharedContext()` identifies chemicals, reaction types, and researchers shared across 2+ experiments
- **`sharedContext` section**: Optional field in response, backward compatible
- **Contract schemas updated**: `SharedContextItemSchema`, `SharedContextSchema` added to `voiceAgentContracts.ts`
- **Tests**: 11 unit tests (bulkExperimentContext), 30 contract tests (voiceAgentContracts) — all passing

---

## Technical Implementation Notes

### Key Files
- `src/app/api/agent/pages/experiment-context/bulk/route.ts` — DONE
- `src/lib/chemistryKb/bulkExperimentContext.ts` — DONE
- `src/__tests__/lib/chemistryKb/bulkExperimentContext.test.ts` — DONE

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

- [x] Bulk endpoint returns multiple experiment contexts
- [x] Token budgeting distributes characters correctly
- [x] Deduplication identifies shared entities in `sharedContext`
- [x] Parallel fetching with individual error handling
- [x] Unit tests for bulkExperimentContext (11 tests)
- [x] Contract tests for SharedContext validation (30 tests total)
- [ ] Performance: <1s for 3 experiments at default depth — untested
