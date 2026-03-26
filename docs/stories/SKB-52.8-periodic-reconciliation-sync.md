# Story SKB-52.8: Periodic Reconciliation Sync

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.8
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-52.7 (Auto-Ingest — the create action it wires up)

---

## User Story

As a knowledge base administrator,
I want a scheduled sync that discovers all experiments in ExpTube and creates missing KB pages,
So that experiments created before sync was enabled (or missed due to webhook failures) still appear in the knowledge base automatically.

---

## Problem

SKB-52.7 adds real-time `create` via webhooks from ExpTube, but this only works for *future* experiments. Experiments that already exist — like the user's test/titration experiments — won't appear unless someone manually seeds them or triggers a backfill.

**What's missing:** An API endpoint to trigger reconciliation from within the app (admin panel or cron), and the wiring to run it against ExpTube's database.

---

## Architecture Decision: ExpTube as Source

Per the revised sync architecture (SKB-52.12), **ExpTube is the sole source of truth for SKB**:

```
SciSymbioLens → ExpTube → ChemELN  (existing bidirectional sync)
                   ↓
                  SKB  (reconciliation pulls from ExpTube only)
```

Reconciliation queries ExpTube's experiments table (not ChemELN), because:
- ExpTube is the hub — all experiments from all platforms flow through it
- It has `eln_experiment_id` — the key SKB uses for indexing
- It has the richest metadata (AI analysis, video transcripts, procedures)
- Single source = no dedup needed

---

## Solution

1. Add a `POST /api/sync/reconcile` endpoint that pulls all experiments from ExpTube and creates/updates missing SKB pages
2. Add a `GET /api/sync/reconcile` endpoint that returns sync status (last run, counts, errors)
3. Map ExpTube experiment states to SKB folders:
   - `deleted_at IS NOT NULL` → Archive folder
   - `status = 'archived'` → Archive folder
   - Everything else → Experiments folder

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
- [ ] Reconciliation compares ExpTube experiments vs existing SKB pages:
  - **New in ExpTube (active)**: Creates KB page in Experiments folder
  - **New in ExpTube (trashed/archived)**: Creates KB page in Archive folder
  - **Title changed in ExpTube**: Updates title/oneLiner (does NOT overwrite user-added content)
  - **Trashed in ExpTube but active in SKB**: Moves to Archive folder
  - **Restored in ExpTube but archived in SKB**: Moves back to Experiments folder
  - **Only in SKB**: Ignored (user-created pages are fine)
- [ ] Concurrency guard: only one sync runs at a time; second request returns 409
- [ ] Environment variables required: `EXPTUBE_API_URL` or direct DB connection to ExpTube
- [ ] Graceful degradation: if ExpTube is unreachable, returns error without crashing
- [ ] All sync operations are logged with `[sync/reconcile]` prefix and correlation ID

---

## Technical Design

### New Files

| File | Purpose |
|------|--------|
| `src/app/api/sync/reconcile/route.ts` | API endpoint for trigger + status |
| `src/lib/chemistryKb/reconciliationSync.ts` | Orchestrator: fetch from ExpTube, compare with SKB, create/update/move pages |

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
    ├─ Fetch all experiments from ExpTube
    │      (via API or direct DB query)
    │
    ├─ For each experiment:
    │   ├─ experimentLookup.findExperimentByElnId()  ← check if exists in SKB
    │   │
    │   ├─ If missing + active → createExperimentPage() in Experiments folder
    │   ├─ If missing + trashed/archived → createExperimentPage() in Archive folder
    │   ├─ If exists + title changed → update title/oneLiner
    │   ├─ If exists in Experiments but trashed in ExpTube → move to Archive
    │   ├─ If exists in Archive but active in ExpTube → move to Experiments
    │   └─ If unchanged → skip
    │
    └─ Return change summary
```

### Key Decisions

1. **ExpTube only**: Reconciliation pulls from ExpTube, not ChemELN. ExpTube is the hub.
2. **State mapping**: `deleted_at IS NOT NULL` OR `status = 'archived'` → SKB Archive folder. Everything else → Experiments folder.
3. **Never auto-delete from SKB**: If an experiment is permanently purged from ExpTube but has a KB page with user-added content, log a warning but don't delete.
4. **Preserve user content on update**: Only update title and oneLiner. Never regenerate page content — the user may have added notes to the scaffolded sections.
5. **Idempotent**: Running reconciliation twice produces the same result. `findExperimentByElnId` check before create prevents duplicates.

---

## Verification

1. **Backfill existing experiments:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/reconcile?full=true \
     -H "Authorization: Bearer $SYNC_SERVICE_KEY"
   ```
   → Returns 202. After completion, `GET /api/sync/reconcile` shows change summary.

2. **Dry run:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/reconcile?dry-run=true \
     -H "Authorization: Bearer $SYNC_SERVICE_KEY"
   ```
   → Returns what *would* be synced, without writing anything.

3. **State mapping:**
   Trashed experiments in ExpTube → created in SKB Archive folder (not Experiments).

4. **Concurrency guard:**
   Two simultaneous POST requests → first returns 202, second returns 409.

5. **ExpTube unreachable:**
   Stop ExpTube → POST reconcile → returns error, app continues working.

---

## Out of Scope

- Scheduled automatic runs (cron) — can be added later with a UI scheduler
- Entity cascade (chemicals, researchers) — separate story
- Bidirectional content sync (SKB notes → ExpTube) — SKB content stays in SKB
