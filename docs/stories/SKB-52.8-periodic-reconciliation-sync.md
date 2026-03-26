# Story SKB-52.8: Periodic Reconciliation Sync

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.8
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-52.7 (Auto-Ingest — the create action it wires up)

---

## User Story

As a knowledge base administrator,
I want a scheduled sync that discovers all experiments in ChemELN and creates missing KB pages,
So that experiments created before sync was enabled (or missed due to webhook failures) still appear in the knowledge base automatically.

---

## Problem

SKB-52.7 adds real-time `create` via webhooks, but this only works for *future* experiments. Experiments that already exist in ChemELN — like the user's "Titration 6" and "Test 6" — won't appear unless someone manually seeds them or triggers a backfill.

The infrastructure for this already exists:
- `IncrementalSyncRunner` fetches from ChemELN, detects new/changed/deleted experiments, and propagates changes
- `SyncScheduler` runs the sync on an interval
- `scripts/sync-chemeln.ts` is a CLI tool with `--full`, `--incremental`, `--schedule` modes
- `UpdatePropagator` creates/updates pages via the Agent API

**What's missing:** An API endpoint to trigger the sync from within the app (admin panel or cron), and the wiring to run it against the correct database with proper credentials.

---

## Solution

1. Add a `POST /api/sync/reconcile` endpoint that triggers the existing `IncrementalSyncRunner`
2. Add a `GET /api/sync/reconcile` endpoint that returns sync status (last run, counts, errors)
3. Wire the sync runner to use Prisma directly (not the Agent API writer) for page creation, since we're running inside the Next.js process with direct DB access

---

## Acceptance Criteria

- [ ] `POST /api/sync/reconcile` triggers a reconciliation sync
  - Auth: same `SYNC_SERVICE_KEY` bearer token as `/api/sync/experiments`
  - Optional query params: `?full=true` (re-sync everything), `?dry-run=true` (preview only)
  - Returns immediately with `{ status: "started", syncId: "..." }` (HTTP 202)
  - Sync runs asynchronously; results stored in memory for status polling
- [ ] `GET /api/sync/reconcile` returns current/last sync status
  - Auth: same `SYNC_SERVICE_KEY` bearer token
  - Returns: `{ lastRun, status, changeSet, duration, errors, nextScheduled }`
- [ ] Reconciliation compares ChemELN experiments vs existing SKB pages:
  - **New in ChemELN**: Creates KB page (same template as SKB-52.7 `create` action)
  - **Updated in ChemELN**: Updates title/oneLiner if changed (does NOT overwrite user-added content)
  - **Deleted from ChemELN**: Logs warning but does NOT auto-delete from SKB (institutional knowledge may exist)
  - **Only in SKB**: Ignored (user-created pages are fine)
- [ ] Entity reconciliation: creates missing Chemical, Reaction Type, and Researcher pages for any entities referenced by newly synced experiments
- [ ] Concurrency guard: only one sync runs at a time; second request returns 409 with current sync status
- [ ] Environment variables required: `CHEMELN_BASE_URL`, `CHEMELN_API_KEY` (existing)
- [ ] Graceful degradation: if ChemELN is unreachable, returns error without crashing the app
- [ ] All sync operations are logged with `[sync/reconcile]` prefix and correlation ID

---

## Technical Design

### New Files

| File | Purpose |
|------|--------|
| `src/app/api/sync/reconcile/route.ts` | API endpoint for trigger + status |
| `src/lib/chemistryKb/reconciliationSync.ts` | Orchestrator that bridges `IncrementalSyncRunner` with direct Prisma writes |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/sync/experiments/route.ts` | Extract shared `createExperimentPage()` helper for reuse by both `create` action and reconciliation |

### Architecture

```
POST /api/sync/reconcile
    │
    ▼
reconciliationSync.ts
    │
    ├─ ChemElnClient.listExperiments()     ← fetch all from ChemELN
    │      (uses existing client.ts)
    │
    ├─ experimentLookup.findExperimentByElnId()  ← check what exists in SKB
    │      (for each ChemELN experiment)
    │
    ├─ For missing: createExperimentPage()  ← same as SKB-52.7 create action
    │      (shared helper, direct Prisma write)
    │
    ├─ For changed: update title/oneLiner   ← minimal update, preserve content
    │      (Prisma page.update)
    │
    └─ For new entities: create entity pages
           (chemicals, reaction types, researchers)
           Using existing templates + findOrCreate pattern from seed script
```

### Key Decisions

1. **Direct Prisma, not Agent API**: The existing `IncrementalSyncRunner` uses `SkbAgentApiWriter` which calls HTTP endpoints. Since the reconciliation runs inside the Next.js process, we use Prisma directly — simpler, faster, no auth issues.

2. **Never auto-delete**: If an experiment is deleted from ChemELN but has a KB page with user-added content (tips, notes), we must not destroy that knowledge. Log it, but don't delete.

3. **Preserve user content on update**: When ChemELN updates an experiment title, we update the SKB page title and oneLiner. We do NOT regenerate the full page content because the user may have added their own notes to the scaffolded sections.

4. **Entity cascade**: When creating a new experiment page that references "Dr. James Chen" or "Acid-Base Titration", create those entity pages if they don't exist yet. This uses the same `findOrCreatePage` + template pattern as the seed script.

5. **Reuse IncrementalSyncRunner for change detection only**: The existing `ChangeDetector` and `EnhancedSyncStateManager` are used to determine what's new/changed. But instead of the `UpdatePropagator` (which uses the Agent API writer), we use direct Prisma writes.

---

## Verification

1. **Backfill existing experiments:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/reconcile?full=true \
     -H "Authorization: Bearer $SYNC_SERVICE_KEY"
   ```
   → Returns 202. After completion, `GET /api/sync/reconcile` shows:
   ```json
   {
     "lastRun": "2026-03-26T...",
     "status": "success",
     "changeSet": { "new": 12, "updated": 0, "deleted": 0, "unchanged": 6 },
     "entitiesCreated": { "chemicals": 5, "reactionTypes": 2, "researchers": 1 },
     "duration": 3200
   }
   ```
   User's "Titration 6" and "Test 6" now appear in the sidebar under Chemistry KB > Experiments.

2. **Dry run:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/reconcile?dry-run=true \
     -H "Authorization: Bearer $SYNC_SERVICE_KEY"
   ```
   → Returns what *would* be synced, without writing anything.

3. **Concurrency guard:**
   Two simultaneous POST requests → first returns 202, second returns 409.

4. **ChemELN unreachable:**
   Stop ChemELN → POST reconcile → returns 500 with `{ error: "ChemELN unreachable" }`, app continues working.

5. **Incremental (default):**
   Run once (full), then again without `?full=true` → second run finds 0 new (all already synced).

---

## Out of Scope

- Scheduled automatic runs (cron) — the CLI script `scripts/sync-chemeln.ts --schedule 15` already handles this; adding a UI scheduler is a separate story
- UI admin panel for triggering sync — this story provides the API; a UI can be built later
- Bidirectional content sync (SKB notes → ChemELN) — SKB content stays in SKB
- Soft-delete integration — deferred until SKB-52.3 is re-implemented with proper migration

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| ChemELN API changes data format | `experimentTransformer.ts` normalizes; add defensive parsing |
| Large number of experiments (100+) | Batch page creation, progress tracking via status endpoint |
| Duplicate pages from race condition (webhook + reconcile) | `findExperimentByElnId` check before create (idempotent) |
| ChemELN credentials not configured | Return clear error message; don't crash app |
