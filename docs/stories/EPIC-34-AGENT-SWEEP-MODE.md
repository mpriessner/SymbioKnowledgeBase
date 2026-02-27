# Epic 34: Agent Sweep Mode (Housekeeping Agent)

**Epic ID:** EPIC-34
**Created:** 2026-02-27
**Total Story Points:** 16
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

Epic 34 introduces **Agent Sweep Mode** — a background housekeeping process that autonomously navigates the knowledge base, updates stale summaries, discovers missing links, and maintains metadata health. The user can trigger a sweep manually ("start agent clean mode") with a configurable budget (how many pages to process), or schedule it to run automatically during idle periods.

### Why This Matters

Knowledge bases decay. Pages get edited but summaries don't update. New content creates implicit connections that aren't captured as wikilinks. Page descriptions become outdated. Over time, the agent navigation metadata (EPIC-33) drifts from reality. Sweep Mode fixes this by:

1. **Keeping summaries fresh** — Finds pages where content changed since the last summary generation and regenerates them.
2. **Discovering missing links** — Scans page content for mentions of other page titles that aren't linked, suggesting (or auto-creating) wikilinks.
3. **Tracking coverage** — Logs when each page was last visited by the sweep agent, ensuring no page is neglected for too long.
4. **Budget-controlled** — The user specifies how many pages to process per sweep, controlling LLM costs and processing time.

### What Already Exists

- **Page summaries** (EPIC-33) — `oneLiner`, `summary`, `summaryUpdatedAt` fields on Page model.
- **`lastAgentVisitAt`** (EPIC-33) — Timestamp field for tracking agent visits.
- **Summary generation service** (EPIC-33 SKB-33.2) — LLM-based summary generation with change detection.
- **Wikilink indexing** (`src/lib/wikilinks/indexer.ts`) — Extracts and indexes wikilinks from content.
- **Wikilink resolver** (`src/lib/wikilinks/resolver.ts`) — Resolves page names to page IDs (case-insensitive).
- **plainText field** (`Block.plainText`) — Denormalized text content for analysis.

### What This Epic Adds

1. **Sweep service** — Core engine that selects pages, processes them, and tracks progress.
2. **Page prioritization** — Smart selection: stale summaries first, then least-recently-visited, then by link density.
3. **Link discovery** — Content analysis to find unlinked page references and suggest new connections.
4. **CLI command** — `npx skb agent:sweep --budget 50` for manual sweeps with progress output.
5. **API endpoint** — Trigger and monitor sweeps programmatically.
6. **Sweep history** — Structured logging of what was processed, what changed, what was skipped.

**Out of scope:**
- Autonomous daemon/sleep mode (mentioned for future — noted in EPIC-34.4 as future enhancement)
- Content quality assessment or rewriting
- Cross-tenant sweep operations
- Real-time streaming of sweep progress to UI

**Future consideration — Sleep Mode / Daemon:**
The user has expressed interest in a "sleep mode" where the agent runs sweeps automatically when the tool is idle. This would be implemented as an optional daemon process that monitors user activity and triggers sweeps during quiet periods. The sweep service built in this epic is designed to be called by any scheduler — CLI, API, cron, or a future daemon. We document this as a future enhancement in SKB-34.4 without implementing it now.

**Dependencies:**
- EPIC-33 (Page summaries and summary generation service must exist)
- Wikilink indexing/resolver (done)
- plainText field on Block (done)

---

## Business Value

- **Knowledge base health:** Summaries stay accurate and current without manual maintenance.
- **Link density improvement:** Automatic discovery of implicit connections strengthens the knowledge graph.
- **Agent effectiveness:** Agents navigating via summaries can trust that information is current.
- **Controlled costs:** Budget-based execution prevents runaway LLM spending.
- **Visibility:** Sweep logs and history provide insight into knowledge base health over time.

---

## Architecture Summary

```
Sweep Execution Flow:
─────────────────────

npx skb agent:sweep --budget 50 --dry-run
        │
        ▼
1. Initialize SweepService with budget and options
2. Create SweepSession record (id, startedAt, budget, status: RUNNING)
        │
        ▼
3. Select pages to process (up to budget):
   Priority order:
   a. STALE SUMMARIES: pages where updatedAt > summaryUpdatedAt
      (content changed since last summary)
   b. NEVER VISITED: pages where lastAgentVisitAt IS NULL
      (never been swept)
   c. LEAST RECENTLY VISITED: ORDER BY lastAgentVisitAt ASC
      (oldest sweep first)
   d. HIGH LINK DENSITY: pages with many incoming/outgoing links
      (more connected = more impact from fresh summaries)
        │
        ▼
4. For each selected page (within budget):
   a. Load page content (blocks + plainText)
   b. Check summary staleness:
      - If updatedAt > summaryUpdatedAt → regenerate summary
      - If summary is null → generate fresh
      - If summary exists and current → skip regeneration
   c. Scan for unlinked references:
      - Extract all page titles from the knowledge base
      - Search this page's plainText for mentions of other page titles
      - Filter out already-linked pages
      - Store suggestions in SweepSuggestion log
   d. Update lastAgentVisitAt = now()
   e. Log action taken for this page
        │
        ▼
5. Update SweepSession:
   - status: COMPLETED
   - completedAt: now()
   - pagesProcessed, summariesRegenerated, linksDiscovered, pagesSkipped
        │
        ▼
6. Print summary report:
   "Sweep complete: 50 pages processed, 12 summaries regenerated,
    8 link suggestions found, 30 pages current (skipped regen)."


Page Selection Algorithm:
─────────────────────────

function selectPagesForSweep(budget: number, tenantId: string): Page[] {
  const selected: Page[] = [];
  let remaining = budget;

  // Priority 1: Stale summaries (content newer than summary)
  const stale = await prisma.page.findMany({
    where: {
      tenantId,
      OR: [
        { summaryUpdatedAt: null },
        { updatedAt: { gt: prisma.raw('summary_updated_at') } }
      ]
    },
    orderBy: { updatedAt: 'desc' },  // Most recently edited first
    take: remaining
  });
  selected.push(...stale);
  remaining -= stale.length;

  if (remaining <= 0) return selected;

  // Priority 2: Never visited by sweep agent
  const neverVisited = await prisma.page.findMany({
    where: {
      tenantId,
      lastAgentVisitAt: null,
      id: { notIn: selected.map(p => p.id) }
    },
    take: remaining
  });
  selected.push(...neverVisited);
  remaining -= neverVisited.length;

  if (remaining <= 0) return selected;

  // Priority 3: Least recently visited
  const leastRecent = await prisma.page.findMany({
    where: {
      tenantId,
      id: { notIn: selected.map(p => p.id) }
    },
    orderBy: { lastAgentVisitAt: 'asc' },
    take: remaining
  });
  selected.push(...leastRecent);

  return selected;
}


Link Discovery Algorithm:
─────────────────────────

function discoverUnlinkedReferences(page: Page, allPages: Page[]): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const plainText = page.blocks[0]?.plainText?.toLowerCase() || '';
  const existingLinks = page.sourceLinks.map(l => l.targetPageId);

  for (const otherPage of allPages) {
    if (otherPage.id === page.id) continue;
    if (existingLinks.includes(otherPage.id)) continue;

    const titleLower = otherPage.title.toLowerCase();
    if (titleLower.length < 3) continue;  // Skip very short titles

    if (plainText.includes(titleLower)) {
      suggestions.push({
        sourcePageId: page.id,
        targetPageId: otherPage.id,
        targetTitle: otherPage.title,
        confidence: calculateConfidence(plainText, titleLower),
        context: extractContext(plainText, titleLower, 50)
      });
    }
  }

  return suggestions;
}


Sweep Session Log:
──────────────────

{
  "sessionId": "sweep-20260227-143000",
  "tenantId": "tenant-abc",
  "startedAt": "2026-02-27T14:30:00Z",
  "completedAt": "2026-02-27T14:32:15Z",
  "budget": 50,
  "status": "COMPLETED",
  "results": {
    "pagesProcessed": 50,
    "summariesRegenerated": 12,
    "summariesSkipped": 38,
    "linkSuggestionsFound": 8,
    "errors": 0
  },
  "pageLog": [
    {
      "pageId": "uuid-1",
      "title": "API Guide",
      "action": "SUMMARY_REGENERATED",
      "reason": "content_newer_than_summary",
      "durationMs": 1200
    },
    {
      "pageId": "uuid-2",
      "title": "Setup",
      "action": "SKIPPED",
      "reason": "summary_current",
      "durationMs": 15
    },
    {
      "pageId": "uuid-3",
      "title": "Architecture",
      "action": "LINKS_DISCOVERED",
      "reason": "2_unlinked_references_found",
      "suggestions": ["Database Schema", "API Gateway"],
      "durationMs": 450
    }
  ]
}
```

---

## Stories Breakdown

### SKB-34.1: Sweep Service Core — Budget, Page Selection, Logging — 5 points, High

**Delivers:** The core `SweepService` class with configurable budget, smart page selection algorithm (stale-first, then never-visited, then least-recent), per-page processing pipeline, `lastAgentVisitAt` tracking, structured session logging, and progress reporting. Includes a `SweepSession` model for persisting sweep history.

**Depends on:** EPIC-33 SKB-33.1 (summary fields on Page model must exist)

---

### SKB-34.2: Summary Staleness Detection & Regeneration — 3 points, High

**Delivers:** Integration between the sweep service and EPIC-33's summary generation service. Detects stale summaries (content updated after summary), generates fresh summaries within the sweep budget, and skips pages with minor changes (below threshold). Batch processing with rate limiting to avoid overwhelming the LLM provider.

**Depends on:** SKB-34.1, EPIC-33 SKB-33.2 (summary generation service must exist)

---

### SKB-34.3: Link Discovery & Connection Suggestions — 5 points, Medium

**Delivers:** Content analysis that finds mentions of other page titles in a page's text that aren't linked as wikilinks. Generates `LinkSuggestion` records with confidence scores, surrounding context, and the suggested target page. Optionally auto-creates wikilinks above a confidence threshold. Provides a report of all suggestions for human review.

**Depends on:** SKB-34.1 (sweep service core must exist)

---

### SKB-34.4: Sweep CLI Command & Scheduling — 3 points, Medium

**Delivers:** CLI command `npx skb agent:sweep` with flags for `--budget`, `--tenant`, `--dry-run`, `--auto-link` (auto-create high-confidence links). API endpoint `POST /api/agent/sweep` for programmatic triggers. `GET /api/agent/sweep/history` for viewing past sweeps. Documentation note about future daemon/sleep mode and cron scheduling.

**Depends on:** SKB-34.1, SKB-34.2, SKB-34.3 (all sweep functionality must exist)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 34.1 | Page selection priority order; budget enforcement; session logging; progress calculation | Select 50 pages from 200-page KB → correct priority order; lastAgentVisitAt updated; session persisted | N/A |
| 34.2 | Staleness detection logic; skip criteria; rate limiting | Stale page gets new summary; current page is skipped; batch of 20 regenerated in order | N/A |
| 34.3 | Title matching algorithm; confidence scoring; context extraction; short title filtering | Discover unlinked "API Gateway" mention in page text; don't suggest already-linked pages; respect title length minimum | N/A |
| 34.4 | CLI argument parsing; dry-run mode; output formatting | CLI sweep with budget 10 → processes 10 pages; dry-run → no DB writes; API trigger → sweep runs | N/A |

---

## Implementation Order

```
                              EPIC-33 (prerequisite)
                                     │
                                     ▼
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 34.1   │──▶│ 34.2   │   │ 34.3   │──▶│ 34.4   │
│Sweep   │   │Stale   │   │Link    │   │CLI &   │
│Core    │   │Summary │   │Discover│   │Schedule│
└────────┘   └────────┘   └────────┘   └────────┘
     │                         ▲
     └─────────────────────────┘
     (34.3 also depends on 34.1)

34.1 is the foundation.
34.2 and 34.3 can be worked in parallel (both depend on 34.1).
34.4 depends on all three (wraps everything in CLI/API).
```

---

## Shared Constraints

- **Budget Hard Limit:** Maximum budget per sweep: 500 pages (configurable via `MAX_SWEEP_BUDGET` env var). Prevents accidental runaway processing.
- **Rate Limiting:** LLM calls rate-limited to 10 requests/minute by default (configurable). Prevents API throttling.
- **Tenant Isolation:** Sweeps operate on a single tenant at a time. No cross-tenant data access.
- **Non-Destructive:** Sweep never deletes pages, removes links, or modifies page content. It only updates summaries and suggests links.
- **Idempotent:** Running the same sweep twice produces the same result (minus time-sensitive fields). Safe to re-run.
- **Error Resilience:** Individual page failures are logged but don't abort the sweep. Processing continues with the next page.
- **Graceful Shutdown:** Sweep can be interrupted (Ctrl+C). Partial results are saved. Unprocessed pages remain for the next sweep.
- **Cost Tracking:** Each sweep session logs the number of LLM calls made. Combined with EPIC-33's cost tracking for total spend visibility.
- **TypeScript Strict:** No `any` types.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/sweep/SweepService.ts` — Core sweep engine with budget, selection, and processing
- `src/lib/sweep/pageSelection.ts` — Page prioritization and selection algorithm
- `src/lib/sweep/linkDiscovery.ts` — Unlinked reference detection and confidence scoring
- `src/lib/sweep/types.ts` — Sweep-related TypeScript types (SweepSession, SweepResult, LinkSuggestion)
- `src/lib/sweep/config.ts` — Sweep configuration (budget limits, rate limits, thresholds)
- `src/app/api/agent/sweep/route.ts` — POST trigger sweep, GET sweep status
- `src/app/api/agent/sweep/history/route.ts` — GET sweep history
- `scripts/agent-sweep.ts` — CLI command for manual sweeps
- Tests for all components

### Modified Files
- `prisma/schema.prisma` — Add SweepSession model (id, tenantId, startedAt, completedAt, budget, status, results JSON)
- `package.json` — Add sweep CLI script to scripts section
- `.env.example` — Add MAX_SWEEP_BUDGET, SWEEP_RATE_LIMIT variables

---

**Last Updated:** 2026-02-27
