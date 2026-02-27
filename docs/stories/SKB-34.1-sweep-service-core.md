# Story SKB-34.1: Sweep Service Core — Budget, Page Selection, Logging

**Epic:** Epic 34 - Agent Sweep Mode (Housekeeping Agent)
**Story ID:** SKB-34.1
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** EPIC-33 SKB-33.1 (summary fields on Page model must exist)

---

## User Story

As a SymbioKnowledgeBase administrator, I want to run a housekeeping sweep that intelligently selects pages to process based on staleness and visit history, so that the knowledge base metadata stays healthy within a controlled processing budget.

---

## Acceptance Criteria

### SweepService Class
- [ ] A `SweepService` class that accepts a configuration object:
  ```typescript
  {
    tenantId: string;
    budget: number;         // Max pages to process (1-500)
    dryRun?: boolean;       // Preview without changes
    autoLink?: boolean;     // Auto-create high-confidence links (SKB-34.3)
  }
  ```
- [ ] `sweep()` method executes the full sweep pipeline and returns a `SweepResult`
- [ ] Processing stops when budget is exhausted OR all pages have been processed

### Page Selection Algorithm
- [ ] Pages selected in priority order (highest priority first):
  1. **STALE SUMMARIES** — Pages where `updatedAt > summaryUpdatedAt` (content changed since last summary generation). Ordered by `updatedAt DESC` (most recently edited first).
  2. **NO SUMMARY** — Pages where `oneLiner IS NULL` (never had a summary generated). Ordered by `updatedAt DESC`.
  3. **NEVER VISITED** — Pages where `lastAgentVisitAt IS NULL` (never been swept). Ordered by `createdAt ASC` (oldest first — clear the backlog).
  4. **LEAST RECENTLY VISITED** — All remaining pages, ordered by `lastAgentVisitAt ASC` (oldest sweep first).
- [ ] Selection deduplicates across priority tiers (a page only appears once)
- [ ] Selection respects the budget limit strictly

### Per-Page Processing
- [ ] For each selected page, the sweep:
  1. Loads the page's `plainText` (from Block), title, current `oneLiner`, `summary`, `summaryUpdatedAt`
  2. Determines action needed:
     - **REGENERATE_SUMMARY** — If summary is stale or missing
     - **VISIT_ONLY** — If summary is current (just update lastAgentVisitAt)
  3. Executes the action (or logs intent in dry-run mode)
  4. Updates `Page.lastAgentVisitAt = now()` (even for VISIT_ONLY)
  5. Logs the action and duration

### SweepSession Persistence
- [ ] Each sweep creates a `SweepSession` record in the database:
  ```prisma
  model SweepSession {
    id          String   @id @default(uuid())
    tenantId    String   @map("tenant_id")
    startedAt   DateTime @default(now()) @map("started_at")
    completedAt DateTime? @map("completed_at")
    budget      Int
    status      SweepStatus @default(RUNNING)
    results     Json?    // SweepResult JSON
    createdAt   DateTime @default(now()) @map("created_at")

    tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    @@index([tenantId, startedAt])
    @@map("sweep_sessions")
  }

  enum SweepStatus {
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }
  ```
- [ ] Session status transitions: `RUNNING → COMPLETED` or `RUNNING → FAILED`
- [ ] `results` JSON stores the full `SweepResult` object

### SweepResult Structure
- [ ] The sweep returns a structured result:
  ```typescript
  interface SweepResult {
    sessionId: string;
    tenantId: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    budget: number;
    pagesProcessed: number;
    summariesRegenerated: number;
    summariesSkipped: number;
    visitOnlyPages: number;
    errors: number;
    pageLog: PageLogEntry[];
  }

  interface PageLogEntry {
    pageId: string;
    title: string;
    action: 'REGENERATE_SUMMARY' | 'VISIT_ONLY' | 'SKIPPED' | 'ERROR';
    reason: string;
    durationMs: number;
    error?: string;
  }
  ```

### Progress Reporting
- [ ] The sweep emits progress events that can be consumed by CLI or API:
  ```typescript
  interface SweepProgress {
    current: number;      // Pages processed so far
    total: number;        // Budget (total to process)
    currentPage: string;  // Title of page being processed
    action: string;       // What's happening
  }
  ```
- [ ] Progress callback is optional (for programmatic use without output)

### Error Resilience
- [ ] If processing a single page fails (LLM error, DB error), the error is logged for that page
- [ ] Processing continues with the next page (no abort on individual failure)
- [ ] The `errors` count in SweepResult tracks how many pages failed
- [ ] If the entire sweep fails (e.g., DB connection lost), session status = FAILED

### Budget Enforcement
- [ ] Maximum budget: 500 pages (configurable via `MAX_SWEEP_BUDGET` env var)
- [ ] If requested budget > max, silently cap to max
- [ ] Budget of 0 → no processing, return empty result

---

## Architecture Overview

```
Sweep Execution Pipeline:
─────────────────────────

SweepService.sweep(config)
        │
        ▼
1. Validate budget (1 ≤ budget ≤ MAX_SWEEP_BUDGET)
2. Create SweepSession record (status: RUNNING)
        │
        ▼
3. Select pages to process:
   a. Query tier 1: stale summaries (up to budget)
   b. Query tier 2: no summary (up to remaining budget)
   c. Query tier 3: never visited (up to remaining budget)
   d. Query tier 4: least recently visited (up to remaining budget)
   e. Deduplicate and limit to budget
        │
        ▼
4. Process each page (sequential):
   ┌─────────────────────────────────────────────┐
   │ For page in selectedPages:                   │
   │   a. Load page data (title, plainText, etc.) │
   │   b. Determine action:                       │
   │      - stale/missing summary → REGENERATE    │
   │      - current summary → VISIT_ONLY          │
   │   c. Execute action:                         │
   │      - REGENERATE: call SummaryService       │
   │      - VISIT_ONLY: (no action needed)        │
   │   d. Update lastAgentVisitAt = now()         │
   │   e. Log result for this page                │
   │   f. Emit progress event                     │
   │   g. If error: log, continue                 │
   └─────────────────────────────────────────────┘
        │
        ▼
5. Update SweepSession:
   - status: COMPLETED
   - completedAt: now()
   - results: SweepResult JSON
        │
        ▼
6. Return SweepResult


Page Selection Queries:
───────────────────────

-- Tier 1: Stale summaries
SELECT id, title, updated_at, summary_updated_at
FROM pages
WHERE tenant_id = $1
  AND updated_at > summary_updated_at
ORDER BY updated_at DESC
LIMIT $2;

-- Tier 2: No summary at all
SELECT id, title
FROM pages
WHERE tenant_id = $1
  AND one_liner IS NULL
  AND id NOT IN (tier1_ids)
ORDER BY updated_at DESC
LIMIT $2;

-- Tier 3: Never visited
SELECT id, title
FROM pages
WHERE tenant_id = $1
  AND last_agent_visit_at IS NULL
  AND id NOT IN (tier1_ids, tier2_ids)
ORDER BY created_at ASC
LIMIT $2;

-- Tier 4: Least recently visited
SELECT id, title
FROM pages
WHERE tenant_id = $1
  AND id NOT IN (tier1_ids, tier2_ids, tier3_ids)
ORDER BY last_agent_visit_at ASC
LIMIT $2;
```

---

## Implementation Steps

### Step 1: Add SweepSession Model to Prisma Schema

**File: `prisma/schema.prisma`** (modify)

```prisma
model SweepSession {
  id          String      @id @default(uuid())
  tenantId    String      @map("tenant_id")
  startedAt   DateTime    @default(now()) @map("started_at")
  completedAt DateTime?   @map("completed_at")
  budget      Int
  status      SweepStatus @default(RUNNING)
  results     Json?
  createdAt   DateTime    @default(now()) @map("created_at")

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, startedAt])
  @@map("sweep_sessions")
}

enum SweepStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

Run migration: `npx prisma migrate dev --name add-sweep-sessions`

### Step 2: Create Sweep Types

**File: `src/lib/sweep/types.ts`** (create)

```typescript
export interface SweepConfig {
  tenantId: string;
  budget: number;
  dryRun?: boolean;
  autoLink?: boolean;
  onProgress?: (progress: SweepProgress) => void;
}

export interface SweepResult {
  sessionId: string;
  tenantId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  budget: number;
  pagesProcessed: number;
  summariesRegenerated: number;
  summariesSkipped: number;
  visitOnlyPages: number;
  errors: number;
  pageLog: PageLogEntry[];
}

export interface PageLogEntry { ... }
export interface SweepProgress { ... }
```

### Step 3: Create Page Selection Module

**File: `src/lib/sweep/pageSelection.ts`** (create)

```typescript
export async function selectPagesForSweep(
  tenantId: string,
  budget: number
): Promise<SelectedPage[]> {
  // Query each tier
  // Deduplicate
  // Return up to budget pages with their priority tier labeled
}
```

### Step 4: Create Sweep Configuration

**File: `src/lib/sweep/config.ts`** (create)

```typescript
export const MAX_SWEEP_BUDGET = parseInt(process.env.MAX_SWEEP_BUDGET || '500');
export const DEFAULT_SWEEP_BUDGET = 50;
```

### Step 5: Create SweepService

**File: `src/lib/sweep/SweepService.ts`** (create)

```typescript
export class SweepService {
  async sweep(config: SweepConfig): Promise<SweepResult> {
    // 1. Validate and cap budget
    // 2. Create SweepSession
    // 3. Select pages
    // 4. Process each page
    // 5. Update session
    // 6. Return result
  }

  private async processPage(page: SelectedPage, config: SweepConfig): Promise<PageLogEntry> {
    // Determine action, execute, update lastAgentVisitAt
  }
}
```

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/lib/sweep/pageSelection.test.ts`**

- 5 stale pages, budget 10 → all 5 stale selected first
- 3 stale + 4 no-summary, budget 5 → 3 stale + 2 no-summary
- All pages current, budget 10 → 10 least recently visited
- Budget 0 → empty selection
- Budget exceeds page count → all pages selected
- Deduplication: page in tier 1 not repeated in tier 3

**File: `src/__tests__/lib/sweep/SweepService.test.ts`**

- Sweep with budget 5 → processes exactly 5 pages
- Stale page → REGENERATE_SUMMARY action
- Current page → VISIT_ONLY action
- lastAgentVisitAt updated for all processed pages
- Error on one page → continues with next, error count incremented
- Dry run → no DB updates, actions logged
- SweepSession created with RUNNING, ends with COMPLETED
- Budget > MAX_SWEEP_BUDGET → capped

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/sweep-service.test.ts`**

- Sweep with 10 seeded pages → SweepSession in DB → correct result counts
- Stale pages processed first → summaries regenerated
- SweepSession.results JSON matches returned SweepResult
- Failed page processing → session still COMPLETED with error count

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add SweepSession model and SweepStatus enum |
| `src/lib/sweep/types.ts` | Create | Sweep-related TypeScript types |
| `src/lib/sweep/config.ts` | Create | Sweep configuration |
| `src/lib/sweep/pageSelection.ts` | Create | Page prioritization and selection |
| `src/lib/sweep/SweepService.ts` | Create | Core sweep engine |
| `.env.example` | Modify | Add MAX_SWEEP_BUDGET variable |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
