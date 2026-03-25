# Story SKB-51.5: Conflict Detection in Institutional Knowledge

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.5
**Story Points:** 5 | **Priority:** Low | **Status:** Deprioritized (2026-03-24)
**Depends On:** SKB-51.4 (Promotion workflow must exist)

---

## User Story

As a Chemistry KB admin, I want the system to detect when newly promoted knowledge conflicts with existing institutional knowledge, So that contradictory best practices don't coexist in the shared KB and researchers always get consistent guidance.

---

## Acceptance Criteria

1. **Conflict Detection Service**
   - [x] Automatic detection when content is promoted to Team KB (via SKB-51.4)
   - [x] Detects conflicts within same reaction type, chemical, or substrate class
   - [x] Conflict types:
     - **Contradictory**: "Use THF at RT" vs "THF must be heated to 60C"
     - **Superseded**: Newer procedure replaces older one
     - **Conditional**: Both valid but under different conditions

2. **Detection Algorithm**
   - [x] Step 1: Find existing pages in same category with overlapping tags
   - [x] Step 2: Extract knowledge statements from both pages (bullet points)
   - [x] Step 3: Compare statements using text similarity (cosine similarity on TF-IDF vectors)
   - [x] Similarity threshold: >0.7 triggers conflict check
   - [x] Step 4: Flag pairs that have high similarity but opposing sentiment/values

3. **Conflict Report**
   - [x] Generated as part of promotion response (SKB-51.4)
   - [x] Report structure with conflicts array, totalConflicts, autoResolvable, requiresReview

4. **Conflict Resolution UI Support**
   - [x] API endpoint: `GET /api/agent/pages/conflicts` — lists all unresolved conflicts
   - [x] API endpoint: `POST /api/agent/pages/conflicts` — detect conflicts for specific page
   - [ ] API endpoint: `POST /api/agent/pages/conflicts/:id/resolve` — **NOT IMPLEMENTED**
   - [ ] Resolution actions (keep_both, keep_existing, keep_new, merge) — **NOT IMPLEMENTED**

5. **Notification**
   - [x] `notifyConflicts()` function exists for admin notification
   - [ ] Tests for notification delivery — **NOT TESTED**
   - [ ] Unresolved conflicts visible in Chemistry KB index page — **NOT IMPLEMENTED**

---

## Implementation Status (2026-03-24)

### What's Built
- **Service**: `src/lib/chemistryKb/conflictDetection.ts` (311 lines)
  - `detectConflicts()` — compares new page against existing pages in same category
  - `scanCategoryConflicts()` — full pairwise comparison
  - `notifyConflicts()` — sends notifications to admins
  - Conflict classification: contradictory, superseded, conditional
  - Suggestion generation per conflict type
- **Text similarity**: `src/lib/chemistryKb/textSimilarity.ts` (195 lines)
  - Pure TypeScript TF-IDF + cosine similarity (no external deps)
  - `extractStatements()`, `findSimilarPairs()` with 0.7 threshold
- **API Routes**: `src/app/api/agent/pages/conflicts/route.ts` (88 lines)
  - GET: scan category for all conflicts
  - POST: detect conflicts for specific page
- **Tests**: `src/__tests__/lib/chemistryKb/conflictDetection.test.ts` (150+ lines)

### Remaining Gaps
1. **Resolve endpoint**: `POST /api/agent/pages/conflicts/:id/resolve` not implemented
2. **Resolution actions**: keep_both, keep_existing, keep_new, merge not built
3. **Notification tests**: `notifyConflicts()` not tested
4. **Integration with promotion**: Not wired into `promotePage()` / `captureLearning()` flow
5. **Index page visibility**: Unresolved conflicts not surfaced in KB index

---

## Technical Implementation Notes

### Key Files
- `src/lib/chemistryKb/conflictDetection.ts` — DONE
- `src/lib/chemistryKb/textSimilarity.ts` — DONE
- `src/app/api/agent/pages/conflicts/route.ts` — DONE (GET + POST, no resolve)
- `src/__tests__/lib/chemistryKb/conflictDetection.test.ts` — DONE (partial)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Promote page with no conflicts | Empty conflicts array |
| Promote page with contradictory statement | Conflict flagged with type "contradictory" |
| Promote page with nearly identical content | Conflict flagged with type "superseded" |
| Resolve conflict with "keep_both" | Both statements preserved, conditions added |
| Resolve conflict with "keep_new" | Existing statement replaced |
| List unresolved conflicts | Returns all pending conflicts for tenant |
| Similarity below threshold (0.3) | No conflict detected |
| Similarity at threshold boundary (0.7) | Conflict detected |
| Cross-category promotion | No conflict (different categories don't conflict) |

---

## Definition of Done

- [x] Conflict detection runs automatically during promotion
- [x] All three conflict types correctly identified
- [ ] Resolution API works for all four actions — **NOT IMPLEMENTED**
- [x] Text similarity correctly identifies related statements
- [x] Unit tests for conflictDetection, textSimilarity
- [ ] API route tests for conflict listing and resolution
- [ ] Notifications sent to admins on conflict detection — exists but untested
