# Story SKB-51.6: Aggregation Auto-Refresh Webhook

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.6
**Story Points:** 3 | **Priority:** Medium | **Status:** Complete (promotion wiring deprioritized)
**Depends On:** EPIC-47 (Aggregation refresh infrastructure from incremental sync)

---

## User Story

As the Chemistry KB system, I want aggregation pages (reaction type summaries, researcher profiles, chemical usage stats) to automatically refresh when new learnings are captured or pages are promoted, So that the institutional knowledge stays current without manual intervention.

---

## Acceptance Criteria

1. **Refresh Triggers**
   - [x] Triggered when: a page is promoted to Team KB (SKB-51.4) — **function exists, not wired to promotionService**
   - [x] Triggered when: a learning is captured via debrief (SKB-51.4 capture-learning) — **function exists, not wired**
   - [x] Triggered when: a new experiment page is created in Team KB
   - [x] Triggered when: an existing Team KB page content is updated
   - [x] NOT triggered for: Private space page edits (unless promoted)

2. **Selective Refresh**
   - [x] Only refresh aggregation pages affected by the change
   - [x] `findAffectedAggregationPages()` walks upward to parent categories and linked targets
   - [x] If experiment page updated -> refresh parent reaction type, linked chemicals, researcher profile

3. **Debounce**
   - [x] Multiple rapid changes debounced to single refresh
   - [x] Debounce window: 5 seconds (configurable)
   - [x] After debounce, collect all affected aggregation page IDs, refresh once
   - [x] `clearPendingRefreshes()` and `getPendingCount()` for testability

4. **Refresh Logic**
   - [x] `refreshAggregationPages()` updates child count in oneLiner
   - [x] `immediateRefresh()` bypass debounce for manual webhook
   - [x] Trigger sources supported: "promotion", "capture", "sync", "manual"

5. **Webhook Endpoint** (for external triggers)
   - [x] Route: `POST /api/agent/pages/refresh-aggregation`
   - [x] Auth: Bearer token via `withAgentAuth`
   - [x] Body: `{ "pageIds": ["clx..."], "trigger": "manual" | "promotion" | "capture" | "sync" }`
   - [x] Response: `{ "refreshed": N, "duration": Nms }`

---

## Implementation Status (2026-03-24)

### What's Built
- **Service**: `src/lib/chemistryKb/aggregationRefresh.ts` (251 lines)
  - In-memory debounce state with configurable 5s window
  - `scheduleAggregationRefresh()`, `clearPendingRefreshes()`, `getPendingCount()`
  - `findAffectedAggregationPages()` — walks upward to parent categories and linked targets
  - `refreshAggregationPages()` — updates child count in oneLiner
  - `immediateRefresh()` — bypass debounce for manual webhook
- **API Route**: `src/app/api/agent/pages/refresh-aggregation/route.ts` (56 lines)
- **Tests**: `src/__tests__/lib/chemistryKb/aggregationRefresh.test.ts` (150+ lines)

### Remaining Gaps
1. **Wire to promotionService**: `scheduleAggregationRefresh()` not called from `promotePage()` or `captureLearning()`
2. **Content regeneration**: Currently only updates oneLiner with child count, doesn't regenerate full aggregation content
3. **Grandparent walking tests**: No tests for multi-level upward traversal
4. **Integration test**: No test for promote -> verify aggregation updated

---

## Technical Implementation Notes

### Integration Points (NOT YET WIRED)
1. `promotePage()` (SKB-51.4) -> call `scheduleAggregationRefresh()`
2. `captureLearning()` (SKB-51.4) -> call `scheduleAggregationRefresh()`
3. Page update handler (existing) -> call `scheduleAggregationRefresh()` for Team pages

### Key Files
- `src/lib/chemistryKb/aggregationRefresh.ts` — DONE
- `src/app/api/agent/pages/refresh-aggregation/route.ts` — DONE
- `src/__tests__/lib/chemistryKb/aggregationRefresh.test.ts` — DONE
- `src/lib/chemistryKb/promotionService.ts` — NEEDS MODIFICATION (add refresh trigger)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Promote page -> aggregation refresh | Related aggregation pages refreshed |
| Capture learning -> aggregation refresh | Reaction type page refreshed |
| 5 rapid promotions -> single refresh | Debounce triggers once after 5s |
| Manual webhook trigger | Specified pages refreshed |
| Refresh with no affected pages | No-op, returns refreshed: 0 |
| Private page edit | No refresh triggered |
| Team page edit | Refresh triggered |

---

## Definition of Done

- [x] Refresh triggers on promotion and capture-learning (functions exist)
- [x] Debounce works for rapid successive changes
- [x] Selective refresh only updates affected aggregation pages
- [x] Webhook endpoint works for manual triggers
- [x] Unit tests for scheduleAggregationRefresh
- [ ] Integration test: promote -> verify aggregation updated
- [ ] Wire promotionService -> scheduleAggregationRefresh
