# Epic 47: Incremental Sync & Maintenance

**Epic ID:** EPIC-47
**Created:** 2026-03-21
**Total Story Points:** 16
**Priority:** Medium
**Status:** Planned

---

## Epic Overview

Epic 47 enables ongoing synchronization so the Chemistry KB stays current as new experiments are added to ChemELN. This epic handles change detection, update propagation, aggregation refresh, and scheduling. Without incremental sync, the KB would require manual re-syncs and quickly become stale. This epic makes the KB a living system that grows automatically with each new experiment.

The initial sync (Epic 45) is a one-time operation that imports all historical ChemELN data. Incremental sync is the mechanism that keeps the KB up-to-date going forward. It detects changes in ChemELN (new experiments, updated experiments, deleted/archived experiments), propagates those changes to the KB pages, updates aggregation pages (Reaction Types, Chemical pages, Researcher profiles), and runs on a schedule (every 15 minutes suggested) or via webhook triggers.

Key challenges: avoiding full re-syncs (expensive), handling cascading updates (experiment change affects multiple pages), detecting deletions (experiments archived in ChemELN), minimizing API calls (only update pages whose content actually changed), and ensuring consistency (no broken wikilinks, no stale data).

---

## Business Value

- Chemistry KB stays current without manual intervention — new experiments appear automatically
- Researchers see up-to-date information (recent experiments, current yields, latest learnings)
- Efficient sync minimizes ChemELN API load and KB write operations (only changed pages updated)
- Webhook-triggered sync enables near-real-time updates (< 1 minute latency from ChemELN save to KB visibility)
- Aggregation updates ensure Reaction Type pages, Researcher profiles, and Chemical pages reflect latest data
- Deletion handling prevents broken wikilinks and maintains KB integrity
- Scheduled sync provides fallback if webhooks fail or are not available
- Reduces manual maintenance burden on KB administrators

---

## Architecture Summary

```
Incremental Sync Architecture
══════════════════════════════

Sync State Tracking
───────────────────

File: .sync-state/chemeln-sync.json
{
  "lastSyncTimestamp": "2026-03-21T14:30:00Z",
  "experiments": {
    "EXP-2026-0042": {
      "contentHash": "sha256:abc123...",
      "lastUpdated": "2026-03-21T14:25:00Z"
    },
    "EXP-2026-0043": { ... }
  }
}

Change Detection
────────────────

ChemELN API Query:
  GET /api/experiments?updated_at_gt=2026-03-21T14:30:00Z
  (+ 1 minute buffer for clock skew)

  Returns:
  {
    "experiments": [
      { "id": "EXP-2026-0044", "updated_at": "2026-03-21T14:35:00Z", ... },
      { "id": "EXP-2026-0042", "updated_at": "2026-03-21T14:32:00Z", ... }
    ]
  }

  Classification:
  - NEW: ID not in sync state
  - UPDATED: ID in sync state, updated_at changed
  - DELETED: ID in sync state, missing from ChemELN or status=archived

Update Propagation
──────────────────

When experiment EXP-2026-0042 is updated:

1. Re-generate experiment page
   → /kb/chemistry/experiments/EXP-2026-0042.md
   → Calculate new content hash

2. Check if reagents changed
   → Update affected Chemical pages' "Used In" sections
   → Example: [[Pd(PPh3)4]] → update "Used In" list

3. Check if reaction type changed
   → Update OLD Reaction Type page (remove from list)
   → Update NEW Reaction Type page (add to list)
   → Example: move from [[Suzuki-Coupling]] to [[Negishi-Coupling]]

4. Check if researcher changed
   → Update OLD Researcher profile (remove from list, recalc avg yield)
   → Update NEW Researcher profile (add to list, recalc avg yield)

5. Re-compute quality score
   → May affect ranking on Reaction Type page

6. Hash comparison
   → Only write page if content hash changed
   → Minimize disk I/O and git churn

Aggregation Refresh
───────────────────

Affected pages when experiments change:

Reaction Type Pages:
  - Experiment count
  - Avg yield
  - Key Learnings (re-rank by quality + recency)
  - "Who To Ask" (re-rank by expertise)

Chemical Pages:
  - "Used In" section (experiment list)
  - Usage count

Researcher Pages:
  - Experiment count
  - Expertise areas (reaction types)
  - Avg yields per reaction type
  - Most recent experiments

Substrate Class Pages:
  - Experiment count
  - "What Worked" section (top experiments)

Only update if computed content differs from current.

Sync Triggers
─────────────

Option 1: Scheduled (cron)
  */15 * * * * npx tsx scripts/sync-chemeln.ts --incremental
  (every 15 minutes)

Option 2: Webhook (on-demand)
  ChemELN POST /api/webhooks/experiment-saved
    → Triggers: POST http://kb.company.com/api/sync/chemeln/trigger
    → Runs incremental sync immediately
    → < 1 minute latency

Option 3: Manual (CLI)
  npx tsx scripts/sync-chemeln.ts --incremental
  npx tsx scripts/sync-chemeln.ts --experiment EXP-2026-0042
  (single experiment sync for testing)

Consistency Guarantees
──────────────────────

1. Atomic updates: Use transactions or write-then-rename
2. No broken wikilinks: Create new entity pages before referencing
3. No stale data: Update all affected pages in same sync run
4. Idempotent: Running sync twice produces same result
5. Rollback-safe: Keep previous version if new sync fails
```

---

## Stories Breakdown

### SKB-47.1: Change Detection via Timestamps — 3 points, High

**Delivers:** Track last sync timestamp per experiment in `.sync-state/chemeln-sync.json`. Query ChemELN API: `GET /api/experiments?updated_at_gt=LAST_SYNC_TIMESTAMP` (add 1-minute buffer for clock skew). Detect new experiments (ID not in sync state). Detect updated experiments (ID in sync state, updated_at timestamp changed). Detect deleted experiments (ID in sync state but missing from ChemELN API response or status=archived). Return change set: `{ new: ExperimentData[], updated: ExperimentData[], deleted: string[] }`. Store content hash (SHA-256 of page content) in sync state for each experiment to detect actual content changes vs. metadata-only changes.

**Depends on:** EPIC-45 (Chemistry KB Data Model — initial sync structure must exist)

---

### SKB-47.2: Experiment Update Propagation — 5 points, Critical

**Delivers:** When an experiment is updated in ChemELN: (1) Re-generate the experiment page (new content hash), (2) Check if reagents changed → update affected Chemical pages' "Used In" sections, (3) Check if reaction type changed → update BOTH old and new Reaction Type aggregation pages, (4) Check if researcher changed → update both old and new Researcher profile pages, (5) Re-compute quality score, (6) Minimize API calls: only update pages whose content actually changed (hash comparison). Handle cascading updates without infinite loops (track visited pages). Transactional update: if any step fails, rollback changes.

**Depends on:** SKB-47.1 (Change Detection)

---

### SKB-47.3: New Entity Handling — 3 points, High

**Delivers:** When a new chemical appears (new CAS number in reagents) → create Chemical page `/kb/chemistry/chemicals/[CAS].md`, add to relevant experiments' reagent sections and reaction types' common reagents. When a new reaction type appears → create Reaction Type page `/kb/chemistry/reactions/[type].md`, add to Chemistry KB Index. When a new researcher appears → create Researcher profile page `/kb/chemistry/researchers/[name].md`. Handle atomically: if page creation fails, queue for retry; don't leave broken wikilinks. Create pages BEFORE referencing them in other pages.

**Depends on:** SKB-47.2 (Experiment Update Propagation)

---

### SKB-47.4: Aggregation Page Refresh — 3 points, Medium

**Delivers:** After any experiment changes, recompute aggregation data on: Reaction Type pages (experiment count, avg yield, Key Learnings ranking, "Who To Ask"), Chemical pages ("Used In" section, usage count), Researcher pages (experiment count, expertise areas, avg yields), Substrate Class pages (experiment count, "What Worked" section). Only update pages where the computed content actually changed (hash comparison). Batch updates: if multiple experiments changed, collect all affected aggregations and update once. Log which aggregations were updated and why.

**Depends on:** SKB-47.3 (New Entity Handling)

---

### SKB-47.5: Sync CLI & Scheduling — 2 points, Medium

**Delivers:** CLI commands: `npx tsx scripts/sync-chemeln.ts` (full sync), `npx tsx scripts/sync-chemeln.ts --incremental` (changes since last sync), `npx tsx scripts/sync-chemeln.ts --dry-run` (preview without writing), `npx tsx scripts/sync-chemeln.ts --experiment EXP-2026-0042` (sync single experiment). Optional: webhook endpoint `POST /api/sync/chemeln/trigger` that ChemELN can call on experiment save (triggers incremental sync). Optional: cron configuration for periodic sync (suggest: every 15 minutes for incremental). Logging: log all sync operations (experiments synced, pages updated, errors) to `logs/sync-chemeln.log`. Exit codes: 0 = success, 1 = partial failure, 2 = total failure.

**Depends on:** SKB-47.4 (Aggregation Page Refresh)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 47.1 | Timestamp parsing, clock skew buffer, change classification (new/updated/deleted) | Query ChemELN API with timestamp filter → correct experiments returned | Full change detection: add experiment in ChemELN → sync detects as NEW |
| 47.2 | Content hash calculation, reagent change detection, reaction type change detection | Update experiment in ChemELN → all affected pages updated (Chemical, Reaction Type, Researcher) | Update experiment → verify cascading updates → no broken links |
| 47.3 | New entity detection, page creation logic, wikilink validation | New chemical in experiment → Chemical page created → wikilinks valid | Add experiment with new chemical → Chemical page appears → experiment references it |
| 47.4 | Aggregation calculation: experiment count, avg yield, ranking logic | Change experiment → Reaction Type page re-ranked, Researcher avg yield updated | Update 3 experiments → verify all affected aggregations updated once |
| 47.5 | CLI argument parsing, dry-run mode, exit codes | - | Run incremental sync via CLI → logs show correct operations → exit code 0 |

---

## Implementation Order

```
47.1 → 47.2 → 47.3 → 47.4 → 47.5 (sequential)

47.1  Change Detection via Timestamps (foundation)
  │
  └──▶ 47.2  Experiment Update Propagation (core logic)
         │
         └──▶ 47.3  New Entity Handling
                │
                └──▶ 47.4  Aggregation Page Refresh
                       │
                       └──▶ 47.5  Sync CLI & Scheduling (interface)
```

---

## Shared Constraints

- Sync state file: `.sync-state/chemeln-sync.json` (JSON, version-controlled, human-readable)
- Content hash algorithm: SHA-256 of normalized page content (strip timestamps for consistency)
- Clock skew buffer: 1 minute (query `updated_at > last_sync_timestamp - 60s`)
- ChemELN API rate limit: 100 requests/minute (batch queries where possible)
- Sync timeout: 10 minutes (fail if sync takes longer)
- Retry policy: Exponential backoff for ChemELN API errors (3 retries max)
- Atomic writes: Write to temp file, then rename (avoid partial writes)
- Logging format: JSON lines (`{"timestamp": "...", "level": "info", "message": "...", "context": {...}}`)
- Aggregation batch size: Update max 50 aggregation pages per sync (defer rest to next run)
- Webhook endpoint auth: Bearer token (configured in ChemELN admin)
- Cron schedule: `*/15 * * * *` (every 15 minutes) for incremental sync
- Dry-run mode: Print all operations but don't write any files

---

## Files Created/Modified by This Epic

### New Files
- `.sync-state/chemeln-sync.json` — Sync state tracking (last timestamp, content hashes)
- `scripts/sync-chemeln/detect-changes.ts` — Change detection logic
- `scripts/sync-chemeln/propagate-updates.ts` — Cascading update handler
- `scripts/sync-chemeln/create-entity-pages.ts` — New entity page creation
- `scripts/sync-chemeln/refresh-aggregations.ts` — Aggregation page recomputation
- `scripts/sync-chemeln/sync-state-manager.ts` — Sync state read/write utilities
- `scripts/sync-chemeln/hash-utils.ts` — Content hash calculation
- `src/app/api/sync/chemeln/trigger/route.ts` — Webhook endpoint (optional)
- `logs/sync-chemeln.log` — Sync operation logs
- `tests/sync-chemeln/detect-changes.test.ts` — Change detection tests
- `tests/sync-chemeln/propagate-updates.test.ts` — Cascading update tests
- `tests/sync-chemeln/refresh-aggregations.test.ts` — Aggregation refresh tests
- `tests/sync-chemeln/e2e-incremental-sync.test.ts` — E2E sync test
- `docs/chemistry-kb/incremental-sync-design.md` — Sync design documentation

### Modified Files
- `scripts/sync-chemeln.ts` — Add --incremental, --dry-run, --experiment flags
- `scripts/sync-chemeln/sync-experiments.ts` — Use change detection instead of full re-sync
- `scripts/sync-chemeln/generate-experiment-page.ts` — Return content hash
- `scripts/sync-chemeln/generate-reaction-type-page.ts` — Return content hash
- `scripts/sync-chemeln/generate-chemical-page.ts` — Return content hash
- `scripts/sync-chemeln/generate-researcher-page.ts` — Return content hash
- `README.md` — Add incremental sync documentation and webhook setup guide
- `.gitignore` — Add `logs/sync-chemeln.log` (ignore log file)

---

**Last Updated:** 2026-03-21
