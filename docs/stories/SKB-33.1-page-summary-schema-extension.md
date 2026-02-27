# Story SKB-33.1: Page Summary Schema Extension

**Epic:** Epic 33 - Agent Navigation Metadata & Page Summaries
**Story ID:** SKB-33.1
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** Nothing (foundational story)

---

## User Story

As a SymbioKnowledgeBase developer, I want the Page model to have `oneLiner`, `summary`, `summaryUpdatedAt`, and `lastAgentVisitAt` fields, so that every page can store machine-readable navigation metadata for agents and enriched UI displays for users.

---

## Acceptance Criteria

### Schema Migration
- [ ] Prisma migration adds the following fields to the `Page` model:
  ```
  oneLiner         String?   @map("one_liner")       // Max ~100 chars
  summary          String?   @map("summary")         // Max ~500 chars
  summaryUpdatedAt DateTime? @map("summary_updated_at")
  lastAgentVisitAt DateTime? @map("last_agent_visit_at")
  ```
- [ ] Migration runs cleanly on existing database (all new fields are nullable)
- [ ] No data loss — existing pages get `null` for all new fields

### TypeScript Types
- [ ] `Page` interface in `src/types/page.ts` includes all four new fields
- [ ] Types are consistent between Prisma generated types and manual type definitions

### API — Read Summaries
- [ ] `GET /api/pages/{id}` response includes `oneLiner`, `summary`, `summaryUpdatedAt`
- [ ] `GET /api/pages/{id}/backlinks` response includes `oneLiner` for each backlink source page
- [ ] `GET /api/pages/{id}/links` (forward links) response includes `oneLiner` for each target page
- [ ] All list endpoints that return Page data include `oneLiner` (sidebar, search, etc.)

### API — Update Summaries
- [ ] `GET /api/pages/{id}/summary` returns `{ oneLiner, summary, summaryUpdatedAt }`
- [ ] `PUT /api/pages/{id}/summary` accepts `{ oneLiner?: string, summary?: string }`
- [ ] `PUT` validates:
  - `oneLiner` max length: 100 characters
  - `summary` max length: 500 characters
  - Both fields are optional (can update one without the other)
- [ ] `PUT` sets `summaryUpdatedAt = now()` on successful update
- [ ] Returns 400 for validation errors with descriptive messages

### UI — "About This Page" Section
- [ ] A new section appears below the page content area (above or near the existing BacklinksPanel)
- [ ] Section titled "About This Page" with a collapsible header
- [ ] Displays:
  - **One-liner:** Text or "No one-liner set" placeholder
  - **Summary:** Text or "No summary set" placeholder
  - **Last updated:** Relative timestamp (e.g., "2 hours ago") or "Never"
- [ ] **Edit mode:** Click "Edit" button → inline text inputs for both fields
  - One-liner: single-line input, max 100 chars with character counter
  - Summary: multi-line textarea, max 500 chars with character counter
  - Save button → `PUT /api/pages/{id}/summary`
  - Cancel button → revert to display mode
- [ ] **Regenerate button:** Placeholder button "Regenerate with AI" (disabled until SKB-33.2 implements the generation service)
- [ ] Loading state while fetching summary data
- [ ] Error handling for failed saves

### Graph Tooltip Enhancement
- [ ] Graph node tooltips in `GraphView.tsx` show the page's `oneLiner` below the title
- [ ] If `oneLiner` is null, tooltip shows only the title (existing behavior)
- [ ] Tooltip format: `Title\nOne-liner text` with the one-liner in a slightly smaller/lighter font

---

## Architecture Overview

```
Schema Change:
──────────────

model Page {
  // ... existing fields ...

  oneLiner         String?   @map("one_liner")
  summary          String?   @map("summary")
  summaryUpdatedAt DateTime? @map("summary_updated_at")
  lastAgentVisitAt DateTime? @map("last_agent_visit_at")

  // ... existing relations ...
}


API Endpoints:
──────────────

GET /api/pages/{id}/summary
  → { oneLiner: string | null, summary: string | null, summaryUpdatedAt: string | null }

PUT /api/pages/{id}/summary
  Body: { oneLiner?: string, summary?: string }
  → { oneLiner, summary, summaryUpdatedAt }
  Validates: oneLiner <= 100 chars, summary <= 500 chars


Backlinks/Links API Enhancement:
────────────────────────────────

GET /api/pages/{id}/backlinks
  Before: [{ pageId, pageTitle, pageIcon }]
  After:  [{ pageId, pageTitle, pageIcon, oneLiner }]

GET /api/pages/{id}/links
  Before: [{ pageId, pageTitle, pageIcon }]
  After:  [{ pageId, pageTitle, pageIcon, oneLiner }]


UI Component:
─────────────

┌─────────────────────────────────────────────┐
│ ▼ About This Page                    [Edit] │
│                                             │
│ One-liner: How to authenticate API via JWT  │
│                                             │
│ Summary: Covers JWT setup, token refresh    │
│ flow, middleware config, and error handling. │
│ Includes client-side and server-side        │
│ examples.                                   │
│                                             │
│ Last updated: 2 hours ago                   │
│ [🔄 Regenerate with AI]                     │
└─────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Add Fields to Prisma Schema

**File: `prisma/schema.prisma`** (modify)

Add to the `Page` model (after `generalAccess` field):

```prisma
oneLiner         String?   @map("one_liner")
summary          String?   @map("summary")
summaryUpdatedAt DateTime? @map("summary_updated_at")
lastAgentVisitAt DateTime? @map("last_agent_visit_at")
```

### Step 2: Run Prisma Migration

```bash
npx prisma migrate dev --name add-page-summaries
```

### Step 3: Update TypeScript Types

**File: `src/types/page.ts`** (modify)

Add fields to the `Page` interface:
```typescript
oneLiner: string | null;
summary: string | null;
summaryUpdatedAt: string | null;
lastAgentVisitAt: string | null;
```

### Step 4: Create Summary API Endpoints

**File: `src/app/api/pages/[id]/summary/route.ts`** (create)

```typescript
// GET — Read page summary
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Authenticate + resolve tenant
  // 2. Fetch page by ID (select only summary fields)
  // 3. Return { oneLiner, summary, summaryUpdatedAt }
}

// PUT — Update page summary
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Authenticate + resolve tenant
  // 2. Parse body: { oneLiner?, summary? }
  // 3. Validate lengths (oneLiner <= 100, summary <= 500)
  // 4. Update page with summary fields + summaryUpdatedAt = now()
  // 5. Return updated summary data
}
```

### Step 5: Modify Existing API Endpoints to Include oneLiner

**File: `src/app/api/pages/[id]/backlinks/route.ts`** (modify)

- Add `oneLiner` to the Prisma select for source pages
- Include in response objects

**File: `src/app/api/pages/[id]/links/route.ts`** (modify — or create if GET endpoint doesn't exist yet for forward links)

- Add `oneLiner` to the Prisma select for target pages
- Include in response objects

### Step 6: Create "About This Page" UI Component

**File: `src/components/page/PageAboutSection.tsx`** (create)

```typescript
interface PageAboutSectionProps {
  pageId: string;
}

export function PageAboutSection({ pageId }: PageAboutSectionProps) {
  // Fetch summary via usePageSummary hook
  // Display mode: show one-liner, summary, last updated
  // Edit mode: inline inputs with character counters
  // Regenerate button (disabled placeholder until SKB-33.2)
}
```

### Step 7: Create usePageSummary Hook

**File: `src/hooks/usePageSummary.ts`** (create)

```typescript
export function usePageSummary(pageId: string) {
  // GET /api/pages/{id}/summary via React Query
  // Stale time: 30s
  // Return: { oneLiner, summary, summaryUpdatedAt, isLoading, error }
}

export function useUpdatePageSummary(pageId: string) {
  // PUT /api/pages/{id}/summary via React Query mutation
  // Invalidates page summary cache on success
}
```

### Step 8: Modify GraphView Tooltip

**File: `src/components/graph/GraphView.tsx`** (modify)

- In the node tooltip rendering, add `oneLiner` below the title
- Fetch one-liners as part of graph data (modify graph API or include in node data)

### Step 9: Integrate PageAboutSection into Page Layout

**File: `src/components/workspace/PageContent.tsx` or equivalent** (modify)

- Add `<PageAboutSection pageId={pageId} />` below the editor, above/near BacklinksPanel

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/app/api/pages/summary.test.ts`**

- GET returns null fields for page without summary
- PUT with valid oneLiner → updates correctly, sets summaryUpdatedAt
- PUT with valid summary → updates correctly
- PUT with both fields → both updated
- PUT with oneLiner > 100 chars → 400 error
- PUT with summary > 500 chars → 400 error
- PUT with empty body → no changes, no error
- GET after PUT → returns updated values

**File: `src/__tests__/components/page/PageAboutSection.test.tsx`**

- Renders one-liner and summary when present
- Shows placeholder when fields are null
- Edit mode: shows inputs with character counters
- Save button calls PUT API
- Cancel button reverts to display mode

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/page-summary.test.ts`**

- Migration adds fields without affecting existing pages
- Backlinks API includes oneLiner for source pages
- Forward links API includes oneLiner for target pages
- Full flow: PUT summary → GET backlinks on another page → new summary visible

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add 4 fields to Page model |
| `src/types/page.ts` | Modify | Add summary fields to Page interface |
| `src/app/api/pages/[id]/summary/route.ts` | Create | Summary GET/PUT endpoints |
| `src/app/api/pages/[id]/backlinks/route.ts` | Modify | Include oneLiner in response |
| `src/app/api/pages/[id]/links/route.ts` | Modify | Include oneLiner in response |
| `src/components/page/PageAboutSection.tsx` | Create | About This Page UI section |
| `src/hooks/usePageSummary.ts` | Create | React hook for summary data |
| `src/components/graph/GraphView.tsx` | Modify | Add oneLiner to graph tooltips |
| Page layout component | Modify | Integrate PageAboutSection |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
