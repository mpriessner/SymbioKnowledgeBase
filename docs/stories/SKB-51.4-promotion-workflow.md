# Story SKB-51.4: Promotion Workflow (Private -> Team)

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.4
**Story Points:** 5 | **Priority:** Low | **Status:** Deprioritized (2026-03-24)
**Depends On:** SKB-51.1 (Chemistry KB must be in Team space)

---

## User Story

As a researcher, I want to promote validated learnings from my private experiment notes to the shared Chemistry KB, So that institutional knowledge grows over time and other researchers benefit from my findings.

---

## Acceptance Criteria

1. **Promotion API Endpoint**
   - [x] Route: `POST /api/agent/pages/promote`
   - [x] Auth: Bearer token via `withAgentAuth`
   - [x] Body schema validated (sourcePageId, targetCategoryId, promotionType, sections, reviewRequired)

2. **Copy Promotion** (default)
   - [x] Creates a new page in the target Team category
   - [x] Copies selected sections from source page content
   - [x] Adds attribution: "Contributed by {researcher} from {experiment}"
   - [x] Source page remains in Private space unchanged
   - [x] New page gets tag: `promoted-from:{sourcePageId}`

3. **Move Promotion**
   - [x] Moves entire page from Private to Team space
   - [x] Updates `spaceType` to TEAM, sets `teamspaceId`
   - [x] Updates parent to target category page
   - [x] Leaves redirect stub in Private space
   - [ ] Tests for move mode — **GAP: no dedicated tests for move operation**

4. **Section Selection**
   - [x] `sections: ["bestPractices"]` — Only promotes best practices sections
   - [x] `sections: ["procedures"]` — Only promotes procedure sections
   - [x] `sections: ["all"]` — Promotes entire page content

5. **Review Workflow** (when `reviewRequired: true`)
   - [x] Promoted page created with `status: "pending_review"` metadata tag
   - [x] Notification sent to Chemistry KB admins via `createNotification()`
   - [x] Page visible in Team space but marked with review banner
   - [ ] Admin approve/reject workflow — **PARTIAL: notification exists, but no resolve endpoint**

6. **Validation**
   - [x] Source page must exist and belong to requesting user's tenant
   - [x] Target category must be a Chemistry KB category page
   - [x] Target category must be in Team space
   - [x] Duplicate detection: warn if page with similar title already exists

7. **Capture Learning Integration**
   - [x] Endpoint: `POST /api/agent/pages/capture-learning`
   - [x] Accepts structured learnings from voice agent debrief
   - [x] Each learning can specify `promoteTo: "team"` for automatic promotion
   - [ ] Integration with conflict detection (SKB-51.5) during capture — **NOT WIRED**
   - [ ] Integration with aggregation refresh (SKB-51.6) after capture — **NOT WIRED**

---

## Implementation Status (2026-03-24)

### What's Built
- **Service**: `src/lib/chemistryKb/promotionService.ts` (472 lines)
  - `promotePage()` — handles both copy and move modes
  - `captureLearning()` — captures learnings from voice debrief
  - Section extraction, duplicate detection, redirect stubs, admin notifications
- **API Routes**:
  - `src/app/api/agent/pages/promote/route.ts` (68 lines) — POST with validation
  - `src/app/api/agent/pages/capture-learning/route.ts` — POST endpoint
- **Tests**: `src/__tests__/lib/chemistryKb/promotionService.test.ts` (150+ lines)

### Remaining Gaps
1. Move mode tests (move page, verify stub)
2. Wire `captureLearning()` -> `detectConflicts()` (SKB-51.5)
3. Wire `promotePage()` / `captureLearning()` -> `scheduleAggregationRefresh()` (SKB-51.6)
4. Admin approve/reject resolution endpoint

---

## Technical Implementation Notes

### Key Files
- `src/app/api/agent/pages/promote/route.ts` — DONE
- `src/app/api/agent/pages/capture-learning/route.ts` — DONE
- `src/lib/chemistryKb/promotionService.ts` — DONE
- `src/__tests__/lib/chemistryKb/promotionService.test.ts` — DONE (partial)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Copy promotion with all sections | New page in Team space, source unchanged |
| Copy promotion with bestPractices only | Only best practices section copied |
| Move promotion | Page moved to Team, redirect stub in Private |
| Promotion with review required | Page created with pending_review tag |
| Promotion to non-Team category | 400 error |
| Promotion of non-existent page | 404 error |
| Duplicate title detection | Warning in response, promotion still proceeds |
| Capture learning with promoteTo=team | Learning appended to existing Team page |
| Capture learning without promotion | Learning saved to Private experiment page only |
| Cross-tenant promotion attempt | 404 (tenant isolation) |
| Admin approves reviewed page | pending_review tag removed |
| Admin rejects reviewed page | Page moved back to Private |

---

## Definition of Done

- [x] Copy and move promotion work correctly
- [x] Section selection extracts correct content
- [x] Review workflow creates notifications for admins
- [x] Capture learning endpoint works with voice agent debrief
- [x] Duplicate detection warns but doesn't block
- [x] Unit tests for promotionService
- [ ] API route tests for both endpoints
- [x] Tenant isolation verified
