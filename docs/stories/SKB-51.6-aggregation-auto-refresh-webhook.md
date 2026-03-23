# Story SKB-51.6: Aggregation Auto-Refresh Webhook

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.6
**Story Points:** 3 | **Priority:** Medium | **Status:** Planned
**Depends On:** EPIC-47 (Aggregation refresh infrastructure from incremental sync)

---

## User Story

As the Chemistry KB system, I want aggregation pages (reaction type summaries, researcher profiles, chemical usage stats) to automatically refresh when new learnings are captured or pages are promoted, So that the institutional knowledge stays current without manual intervention.

---

## Acceptance Criteria

1. **Refresh Triggers**
   - [ ] Triggered when: a page is promoted to Team KB (SKB-51.4)
   - [ ] Triggered when: a learning is captured via debrief (SKB-51.4 capture-learning)
   - [ ] Triggered when: a new experiment page is created in Team KB
   - [ ] Triggered when: an existing Team KB page content is updated
   - [ ] NOT triggered for: Private space page edits (unless promoted)

2. **Selective Refresh**
   - [ ] Only refresh aggregation pages affected by the change
   - [ ] If experiment page updated → refresh: parent reaction type, linked chemicals, researcher profile
   - [ ] If chemical page updated → refresh: experiments using that chemical, reaction types
   - [ ] If learning captured → refresh: relevant reaction type best practices section

3. **Debounce**
   - [ ] Multiple rapid changes (e.g., batch promotion) debounced to single refresh
   - [ ] Debounce window: 5 seconds
   - [ ] After debounce, collect all affected aggregation page IDs, refresh once

4. **Refresh Logic**
   - [ ] Reuse existing aggregation refresh from EPIC-47 (`refreshAggregationPages()`)
   - [ ] Add new trigger source: "promotion" and "capture-learning" (in addition to "sync")
   - [ ] Log refresh events: `{ trigger, affectedPages, duration, timestamp }`

5. **Webhook Endpoint** (for external triggers)
   - [ ] Route: `POST /api/agent/pages/refresh-aggregation`
   - [ ] Auth: Bearer token via `withAgentAuth`
   - [ ] Body: `{ "pageIds": ["clx..."], "trigger": "manual" | "promotion" | "capture" | "sync" }`
   - [ ] Response: `{ "refreshed": 3, "duration": 450 }`

---

## Technical Implementation Notes

### Event-Driven Refresh
```typescript
// src/lib/chemistryKb/aggregationRefresh.ts

const pendingRefreshes = new Map<string, Set<string>>(); // tenantId → Set<pageId>
let debounceTimer: NodeJS.Timeout | null = null;

export function scheduleAggregationRefresh(
  tenantId: string,
  affectedPageIds: string[],
  trigger: string
): void {
  const pending = pendingRefreshes.get(tenantId) || new Set();
  affectedPageIds.forEach(id => pending.add(id));
  pendingRefreshes.set(tenantId, pending);

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => executeRefresh(tenantId, trigger), 5000);
}
```

### Integration Points
Hook into existing code:
1. `promotePage()` (SKB-51.4) → call `scheduleAggregationRefresh()`
2. `captureLearning()` (SKB-51.4) → call `scheduleAggregationRefresh()`
3. Page update handler (existing) → call `scheduleAggregationRefresh()` for Team pages

### Key Files
- `src/lib/chemistryKb/aggregationRefresh.ts` — CREATE
- `src/app/api/agent/pages/refresh-aggregation/route.ts` — CREATE
- `src/lib/chemistryKb/promotionService.ts` — MODIFY (add refresh trigger)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Promote page → aggregation refresh | Related aggregation pages refreshed |
| Capture learning → aggregation refresh | Reaction type page refreshed |
| 5 rapid promotions → single refresh | Debounce triggers once after 5s |
| Manual webhook trigger | Specified pages refreshed |
| Refresh with no affected pages | No-op, returns refreshed: 0 |
| Private page edit | No refresh triggered |
| Team page edit | Refresh triggered |

---

## Definition of Done

- [ ] Refresh triggers on promotion and capture-learning
- [ ] Debounce works for rapid successive changes
- [ ] Selective refresh only updates affected aggregation pages
- [ ] Webhook endpoint works for manual triggers
- [ ] Unit tests for scheduleAggregationRefresh
- [ ] Integration test: promote → verify aggregation updated
