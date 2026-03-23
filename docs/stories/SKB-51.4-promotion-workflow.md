# Story SKB-51.4: Promotion Workflow (Private → Team)

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.4
**Story Points:** 5 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-51.1 (Chemistry KB must be in Team space)

---

## User Story

As a researcher, I want to promote validated learnings from my private experiment notes to the shared Chemistry KB, So that institutional knowledge grows over time and other researchers benefit from my findings.

---

## Acceptance Criteria

1. **Promotion API Endpoint**
   - [ ] Route: `POST /api/agent/pages/promote`
   - [ ] Auth: Bearer token via `withAgentAuth`
   - [ ] Body:
     ```json
     {
       "sourcePageId": "clx...",
       "targetCategoryId": "clx...",
       "promotionType": "copy" | "move",
       "sections": ["bestPractices", "procedures", "all"],
       "reviewRequired": true
     }
     ```

2. **Copy Promotion** (default)
   - [ ] Creates a new page in the target Team category
   - [ ] Copies selected sections from source page content
   - [ ] Adds attribution: "Contributed by {researcher} from {experiment}"
   - [ ] Source page remains in Private space unchanged
   - [ ] New page gets tag: `promoted-from:{sourcePageId}`

3. **Move Promotion**
   - [ ] Moves entire page from Private to Team space
   - [ ] Updates `spaceType` to TEAM, sets `teamspaceId`
   - [ ] Updates parent to target category page
   - [ ] Leaves redirect stub in Private space: "This page has been promoted to Chemistry KB"

4. **Section Selection**
   - [ ] `sections: ["bestPractices"]` — Only promotes "Best Practices" / "Institutional Knowledge" sections
   - [ ] `sections: ["procedures"]` — Only promotes "Procedures" / "Experimental Steps" sections
   - [ ] `sections: ["all"]` — Promotes entire page content

5. **Review Workflow** (when `reviewRequired: true`)
   - [ ] Promoted page created with `status: "pending_review"` metadata tag
   - [ ] Notification sent to Chemistry KB admins (teamspace ADMIN role)
   - [ ] Page visible in Team space but marked with review banner
   - [ ] Admin can approve (removes tag) or reject (moves back to Private)

6. **Validation**
   - [ ] Source page must exist and belong to requesting user's tenant
   - [ ] Target category must be a Chemistry KB category page (Experiments, Chemicals, etc.)
   - [ ] Target category must be in Team space
   - [ ] Duplicate detection: warn if page with similar title already exists in target
   - [ ] Content validation: promoted content must have required frontmatter fields

7. **Capture Learning Integration**
   - [ ] Additional endpoint: `POST /api/agent/pages/capture-learning`
   - [ ] Accepts structured learnings from voice agent debrief
   - [ ] Each learning can specify `promoteTo: "team"` for automatic promotion
   - [ ] Auto-promoted learnings appended to relevant existing pages (not new pages)
   - [ ] Body:
     ```json
     {
       "experimentId": "EXP-2026-0042",
       "learnings": [{
         "type": "best_practice",
         "content": "Use freshly opened THF for optimal results",
         "confidence": "high",
         "promoteTo": "team"
       }],
       "debriefSummary": "Experiment completed successfully with 87% yield."
     }
     ```

---

## Technical Implementation Notes

### Promotion Service
```typescript
// src/lib/chemistryKb/promotionService.ts

export interface PromotionRequest {
  sourcePageId: string;
  targetCategoryId: string;
  promotionType: "copy" | "move";
  sections: string[];
  reviewRequired: boolean;
}

export interface PromotionResult {
  promotedPageId: string;
  action: "copied" | "moved";
  sectionsPromoted: string[];
  duplicateWarning?: string;
  reviewStatus: "approved" | "pending_review";
}

export async function promotePage(
  tenantId: string,
  request: PromotionRequest
): Promise<PromotionResult> {
  // 1. Validate source page exists and user has access
  // 2. Validate target is a Chemistry KB category in Team space
  // 3. Check for duplicates (title similarity search)
  // 4. Extract selected sections from source content
  // 5. Create/move page in target category
  // 6. Add attribution and tags
  // 7. If reviewRequired, add pending_review tag and notify admins
}
```

### Content Section Extraction
```typescript
function extractSections(tiptapContent: any, sections: string[]): any {
  // Parse TipTap JSON, find heading nodes matching section names
  // Return subset of content containing only selected sections
  // Preserve formatting, wikilinks, and structure
}
```

### Key Files
- `src/app/api/agent/pages/promote/route.ts` — CREATE
- `src/app/api/agent/pages/capture-learning/route.ts` — CREATE
- `src/lib/chemistryKb/promotionService.ts` — CREATE
- `src/lib/chemistryKb/contentExtractor.ts` — MODIFY (add section extraction)

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

- [ ] Copy and move promotion work correctly
- [ ] Section selection extracts correct content
- [ ] Review workflow creates notifications for admins
- [ ] Capture learning endpoint works with voice agent debrief
- [ ] Duplicate detection warns but doesn't block
- [ ] Unit tests for promotionService
- [ ] API route tests for both endpoints
- [ ] Tenant isolation verified
