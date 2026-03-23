# Story SKB-51.5: Conflict Detection in Institutional Knowledge

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.5
**Story Points:** 5 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-51.4 (Promotion workflow must exist)

---

## User Story

As a Chemistry KB admin, I want the system to detect when newly promoted knowledge conflicts with existing institutional knowledge, So that contradictory best practices don't coexist in the shared KB and researchers always get consistent guidance.

---

## Acceptance Criteria

1. **Conflict Detection Service**
   - [ ] Automatic detection when content is promoted to Team KB (via SKB-51.4)
   - [ ] Detects conflicts within same reaction type, chemical, or substrate class
   - [ ] Conflict types:
     - **Contradictory**: "Use THF at RT" vs "THF must be heated to 60°C"
     - **Superseded**: Newer procedure replaces older one
     - **Conditional**: Both valid but under different conditions

2. **Detection Algorithm**
   - [ ] Step 1: Find existing pages in same category with overlapping tags
   - [ ] Step 2: Extract knowledge statements from both pages (bullet points in Best Practices / Institutional Knowledge sections)
   - [ ] Step 3: Compare statements using text similarity (cosine similarity on TF-IDF vectors)
   - [ ] Similarity threshold: >0.7 triggers conflict check
   - [ ] Step 4: Flag pairs that have high similarity but opposing sentiment/values

3. **Conflict Report**
   - [ ] Generated as part of promotion response (SKB-51.4)
   - [ ] Report structure:
     ```json
     {
       "conflicts": [{
         "type": "contradictory",
         "existingPage": { "id": "...", "title": "...", "statement": "Use THF at room temperature" },
         "newStatement": "THF must be heated to 60°C for this substrate",
         "similarity": 0.82,
         "suggestion": "These may apply to different substrate classes. Consider adding conditions."
       }],
       "totalConflicts": 1,
       "autoResolvable": 0,
       "requiresReview": 1
     }
     ```

4. **Conflict Resolution UI Support**
   - [ ] API endpoint: `GET /api/agent/pages/conflicts` — lists all unresolved conflicts
   - [ ] API endpoint: `POST /api/agent/pages/conflicts/:id/resolve`
   - [ ] Resolution actions:
     - `"keep_both"` — Both are valid (add conditions to distinguish)
     - `"keep_existing"` — Reject new statement
     - `"keep_new"` — Replace existing with new
     - `"merge"` — Combine into a single, more nuanced statement

5. **Notification**
   - [ ] When conflict detected, notify Chemistry KB admins
   - [ ] Notification includes: conflicting statements, pages involved, suggested resolution
   - [ ] Unresolved conflicts visible in Chemistry KB index page

---

## Technical Implementation Notes

### Conflict Detection Service
```typescript
// src/lib/chemistryKb/conflictDetection.ts

export interface ConflictReport {
  conflicts: Conflict[];
  totalConflicts: number;
  autoResolvable: number;
  requiresReview: number;
}

export interface Conflict {
  id: string;
  type: "contradictory" | "superseded" | "conditional";
  existingPage: { id: string; title: string; statement: string };
  newStatement: string;
  similarity: number;
  suggestion: string;
  status: "unresolved" | "resolved";
  resolution?: string;
}

export async function detectConflicts(
  tenantId: string,
  newPageId: string,
  targetCategoryId: string
): Promise<ConflictReport> {
  // 1. Get new page's knowledge statements
  // 2. Find existing pages in same category
  // 3. Extract their knowledge statements
  // 4. Pairwise similarity comparison
  // 5. Flag conflicts above threshold
}
```

### Text Similarity (Lightweight)
Use simple TF-IDF + cosine similarity (no external ML dependencies):
```typescript
function cosineSimilarity(a: string, b: string): number {
  // Tokenize, build TF-IDF vectors, compute cosine
  // Pure TypeScript, no external deps
}
```

### Storage
Conflicts stored as metadata tags on pages:
- `conflict:{conflictId}` on both pages
- Conflict details stored in a JSON field or separate table

### Key Files
- `src/lib/chemistryKb/conflictDetection.ts` — CREATE
- `src/lib/chemistryKb/textSimilarity.ts` — CREATE
- `src/app/api/agent/pages/conflicts/route.ts` — CREATE
- `src/app/api/agent/pages/conflicts/[id]/resolve/route.ts` — CREATE

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

- [ ] Conflict detection runs automatically during promotion
- [ ] All three conflict types correctly identified
- [ ] Resolution API works for all four actions
- [ ] Text similarity correctly identifies related statements
- [ ] Unit tests for conflictDetection, textSimilarity
- [ ] API route tests for conflict listing and resolution
- [ ] Notifications sent to admins on conflict detection
