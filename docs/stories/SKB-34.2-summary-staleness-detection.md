# Story SKB-34.2: Summary Staleness Detection & Regeneration

**Epic:** Epic 34 - Agent Sweep Mode (Housekeeping Agent)
**Story ID:** SKB-34.2
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-34.1 (sweep service core), EPIC-33 SKB-33.2 (summary generation service)

---

## User Story

As the sweep agent, I want to detect which pages have outdated summaries and regenerate them efficiently within the sweep budget, so that agent navigation metadata stays accurate as content evolves.

---

## Acceptance Criteria

### Staleness Detection
- [ ] A page's summary is considered **stale** when `Page.updatedAt > Page.summaryUpdatedAt`
- [ ] A page's summary is considered **missing** when `Page.oneLiner IS NULL`
- [ ] A page is **current** when `Page.summaryUpdatedAt >= Page.updatedAt` AND `oneLiner IS NOT NULL`
- [ ] The staleness check is a pure function: `isSummaryStale(page: Page): boolean`

### Change Significance Check
- [ ] Before regenerating, the sweep checks whether the content change was significant:
  - Load current `plainText` from Block
  - Compare against a cached version (or compute hash)
  - If content length changed by < 5% AND page has existing summary → skip (MINOR_CHANGE)
  - This prevents regenerating summaries for pages where only metadata (title, position) changed
- [ ] The significance check is lighter than the full change-ratio in SKB-33.2 (optimized for batch processing)

### Batch Regeneration
- [ ] The sweep processes stale pages sequentially (one at a time, to respect rate limits)
- [ ] Between each LLM call, the sweep respects the rate limiter from EPIC-33 SKB-33.2
- [ ] If the rate limiter is exhausted, the sweep waits for the next available slot (blocking within the sweep, not skipping)
- [ ] If waiting exceeds 60 seconds, skip the page and log: "Rate limit timeout — skipping"

### Skip Criteria
- [ ] Pages skipped when:
  - Content is too short (< 50 characters of plainText) — not enough to summarize
  - Page was updated within the last 5 minutes — may still be actively edited, defer to next sweep
  - Summary was manually set (summaryUpdatedAt > updatedAt) — user override, don't overwrite
- [ ] Each skip is logged with reason in the page log entry

### Integration with SweepService
- [ ] The `SweepService.processPage()` method calls `StalenessDetector.analyze(page)` to determine:
  ```typescript
  interface StalenessAnalysis {
    action: 'REGENERATE' | 'SKIP_CURRENT' | 'SKIP_MINOR_CHANGE' |
            'SKIP_TOO_SHORT' | 'SKIP_RECENTLY_EDITED' | 'SKIP_MANUAL_OVERRIDE';
    reason: string;
  }
  ```
- [ ] If action is REGENERATE → call `SummaryService.generateForPage(pageId)`
- [ ] After regeneration → verify new summary was saved (non-null check)

### Metrics Tracking
- [ ] The sweep result includes a breakdown:
  ```typescript
  summaryMetrics: {
    regenerated: number;       // Summaries successfully regenerated
    skippedCurrent: number;    // Already up to date
    skippedMinorChange: number; // Change too small
    skippedTooShort: number;   // Content too short
    skippedRecentEdit: number; // Still being edited
    skippedManualOverride: number; // Manually set
    failed: number;            // LLM or DB error
  }
  ```

---

## Architecture Overview

```
Staleness Detection Flow:
─────────────────────────

SweepService.processPage(page)
        │
        ▼
StalenessDetector.analyze(page)
        │
        ├── page.oneLiner IS NULL
        │   → { action: 'REGENERATE', reason: 'no_summary' }
        │
        ├── page.updatedAt <= page.summaryUpdatedAt
        │   → { action: 'SKIP_CURRENT', reason: 'summary_up_to_date' }
        │
        ├── page.summaryUpdatedAt > page.updatedAt (manual override)
        │   → { action: 'SKIP_MANUAL_OVERRIDE', reason: 'manually_set' }
        │
        ├── page.updatedAt > (now - 5 minutes)
        │   → { action: 'SKIP_RECENTLY_EDITED', reason: 'may_still_be_editing' }
        │
        ├── page.plainText.length < 50
        │   → { action: 'SKIP_TOO_SHORT', reason: 'content_too_short' }
        │
        ├── contentChangeRatio < 0.05
        │   → { action: 'SKIP_MINOR_CHANGE', reason: 'change_below_threshold' }
        │
        └── (all checks passed)
            → { action: 'REGENERATE', reason: 'content_changed_significantly' }


Batch Processing:
─────────────────

For each stale page (within budget):
  1. StalenessDetector.analyze(page) → action
  2. If REGENERATE:
     a. rateLimiter.waitForSlot(tenantId)   // Block until slot available
     b. SummaryService.generateForPage(pageId)  // LLM call
     c. Verify: reload page, check oneLiner is not null
     d. Log: { action: 'REGENERATE_SUMMARY', durationMs }
  3. If SKIP_*:
     a. Log: { action: 'SKIPPED', reason }
  4. Update lastAgentVisitAt regardless
```

---

## Implementation Steps

### Step 1: Create Staleness Detector

**File: `src/lib/sweep/stalenessDetector.ts`** (create)

```typescript
export interface StalenessAnalysis {
  action: 'REGENERATE' | 'SKIP_CURRENT' | 'SKIP_MINOR_CHANGE' |
          'SKIP_TOO_SHORT' | 'SKIP_RECENTLY_EDITED' | 'SKIP_MANUAL_OVERRIDE';
  reason: string;
}

export function analyzeStaleness(page: PageWithContent): StalenessAnalysis {
  // 1. No summary at all → REGENERATE
  // 2. Summary newer than content → SKIP_MANUAL_OVERRIDE
  // 3. Content up to date → SKIP_CURRENT
  // 4. Recently edited (< 5 min) → SKIP_RECENTLY_EDITED
  // 5. Content too short (< 50 chars) → SKIP_TOO_SHORT
  // 6. Change too small (< 5%) → SKIP_MINOR_CHANGE
  // 7. All passed → REGENERATE
}

export function isSummaryStale(page: { updatedAt: Date; summaryUpdatedAt: Date | null }): boolean {
  if (!page.summaryUpdatedAt) return true;
  return page.updatedAt > page.summaryUpdatedAt;
}
```

### Step 2: Create Summary Metrics Type

**File: `src/lib/sweep/types.ts`** (modify from SKB-34.1)

Add `SummaryMetrics` interface to the existing types file.

### Step 3: Integrate with SweepService

**File: `src/lib/sweep/SweepService.ts`** (modify from SKB-34.1)

In `processPage()`:
```typescript
private async processPage(page: SelectedPage, config: SweepConfig): Promise<PageLogEntry> {
  const startTime = Date.now();
  const analysis = analyzeStaleness(page);

  if (analysis.action === 'REGENERATE' && !config.dryRun) {
    try {
      await this.rateLimiter.waitForSlot(config.tenantId, 60000); // 60s timeout
      await this.summaryService.generateForPage(page.id);
      this.metrics.regenerated++;
    } catch (error) {
      this.metrics.failed++;
      return { pageId: page.id, title: page.title, action: 'ERROR', reason: error.message, durationMs: Date.now() - startTime };
    }
  } else if (analysis.action.startsWith('SKIP')) {
    this.metrics[analysis.action.toLowerCase()]++;
  }

  // Always update lastAgentVisitAt
  if (!config.dryRun) {
    await prisma.page.update({
      where: { id: page.id },
      data: { lastAgentVisitAt: new Date() }
    });
  }

  return {
    pageId: page.id,
    title: page.title,
    action: analysis.action === 'REGENERATE' ? 'REGENERATE_SUMMARY' : 'SKIPPED',
    reason: analysis.reason,
    durationMs: Date.now() - startTime,
  };
}
```

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/lib/sweep/stalenessDetector.test.ts`**

- Page with null oneLiner → REGENERATE (no_summary)
- Page with summaryUpdatedAt > updatedAt → SKIP_MANUAL_OVERRIDE
- Page with summaryUpdatedAt < updatedAt → further analysis
- Page with summaryUpdatedAt === updatedAt → SKIP_CURRENT
- Page updated 2 minutes ago → SKIP_RECENTLY_EDITED
- Page with 30 chars plainText → SKIP_TOO_SHORT
- Page with 200 chars plainText, 3% change → SKIP_MINOR_CHANGE
- Page with 200 chars plainText, 25% change → REGENERATE
- `isSummaryStale` with null summaryUpdatedAt → true
- `isSummaryStale` with older summaryUpdatedAt → true
- `isSummaryStale` with newer summaryUpdatedAt → false

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/sweep-regeneration.test.ts`** (with mocked LLM)

- Sweep with 3 stale pages → all 3 get new summaries
- Sweep with 1 stale + 2 current → 1 regenerated, 2 skipped
- Rate limit hit during sweep → waits and continues
- Sweep metrics match actual processing counts

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sweep/stalenessDetector.ts` | Create | Staleness analysis logic |
| `src/lib/sweep/types.ts` | Modify | Add SummaryMetrics interface |
| `src/lib/sweep/SweepService.ts` | Modify | Integrate staleness detection into processing |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
