# Agent Prompt: ExpTube — SKB Sync Hub & Archive Folder

## Context

The SciSymbioAI platform has adopted a hub-and-spoke sync architecture:

```
SciSymbioLens → ExpTube → ChemELN  (existing bidirectional sync)
                   ↓
                  SKB  (NEW: only ExpTube pushes to SKB)
```

**ExpTube is the sole sender of sync events to SKB.** This is because:
- ExpTube is already the hub — all lifecycle events from SciSymbioLens and ChemELN flow through it
- It has the richest data — AI analysis, video transcripts, procedure steps, conversation summaries
- It has `eln_experiment_id` — the key SKB uses to index experiments
- Single sender = no duplicate events, no dedup needed

## What Needs to Change in ExpTube

### 1. Add Archive Folder UI

ExpTube currently has:
- Active experiments (statuses: active, draft, completed)
- Trashed experiments (`deleted_at IS NOT NULL`)
- One "archived" status used for the Melting Point experiment

**Add a proper Archive feature:**
- Add "Move to Archive" in the experiment context menu (separate from Trash)
- Archived experiments get `status = 'archived'` (but `deleted_at` stays NULL)
- Archived experiments appear in a dedicated Archive section in the UI
- Archived experiments can be restored back to active
- Trash folder remains for actual deletion (30-day auto-purge)

### 2. Send Sync Events to SKB (THE KEY CHANGE)

Add `_propagateToSKB()` calls in the same places where `propagateExperimentDelete`, `propagateExperimentRestore`, `propagateExperimentCreate`, etc. are already called for ChemELN sync.

**Endpoint:**
```
POST {SKB_API_URL}/api/sync/experiments
Authorization: Bearer {SYNC_SERVICE_KEY}
X-Source: exptube
Content-Type: application/json
```

#### On Experiment Create (from any source — Lens, ChemELN, or direct):
```json
{
  "eln_experiment_id": "EXP-2026-0053",
  "action": "create",
  "source": "exptube",
  "fields": {
    "title": "New Experiment Title",
    "summary": "One-line description",
    "researcher": "Dr. Smith",
    "date": "2026-03-26",
    "source_status": "draft"
  }
}
```

**Important:** Always use the `eln_experiment_id` column value (e.g., "EXP-2025-0001"), NOT the ExpTube UUID `id`.

#### On Experiment Trashed (soft-delete):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "delete",
  "source": "exptube",
  "fields": {
    "source_status": "trashed",
    "source_deleted_at": "2026-03-25T12:53:53Z"
  }
}
```
SKB will move the experiment to its Archive folder (not delete it).

#### On Experiment Archived:
```json
{
  "eln_experiment_id": "EXP-2025-0018",
  "action": "archive",
  "source": "exptube",
  "fields": {
    "source_status": "archived"
  }
}
```
SKB will move the experiment to its Archive folder.

#### On Experiment Restored (from trash or archive):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "restore",
  "source": "exptube"
}
```
SKB will move the experiment back to the Experiments folder.

#### On Experiment Updated (title, procedure, etc.):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "update",
  "source": "exptube",
  "fields": {
    "title": "Updated Name",
    "oneLiner": "Updated summary"
  }
}
```

#### On Experiment Permanently Purged:
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "purge",
  "source": "exptube"
}
```
SKB will hard-delete the page and all its blocks.

### 3. Where to Add the Propagation Calls

Add `_propagateToSKB()` alongside existing ChemELN propagation in these locations:
- `propagateExperimentCreate()` — when experiments are created (from Lens or ChemELN)
- `propagateExperimentDelete()` — when experiments are trashed
- `propagateExperimentRestore()` — when experiments are restored
- `propagateExperimentUpdate()` — when experiment title/procedure changes (optional, lower priority)
- Wherever purge is handled
- **NEW:** When archive/restore from archive happens (after Archive UI is added)

The call should be fire-and-forget (don't block the main operation if SKB is unreachable).

### 4. Environment Variables Needed

```
SKB_API_URL=http://localhost:3000  # or production URL
SYNC_SERVICE_KEY=<shared secret>   # same key configured in SKB's .env.local
```

### 5. Anti-Loop Protection

SKB currently uses Option C (no outgoing propagation), so it will never send events back to ExpTube. But as a safety measure:
- If `source === "skb"` in any incoming event to ExpTube, skip re-propagation

### 6. SKB Endpoint Behavior

SKB's sync endpoint is **idempotent**:
- `create` for an existing experiment returns `{ status: "exists" }` (no duplicate)
- `delete`/`archive` for an already-archived experiment returns `{ status: "already_archived" }`
- `restore` for an already-active experiment returns `{ status: "already_active" }`

So it's safe to send events even if you're not sure whether SKB already knows about them.

### 7. Database Reference

Current ExpTube experiment statuses:
- 10 active, 17 draft, 9 completed, 1 archived
- 8 experiments have `deleted_at` set (trashed)
- 1 archived: Melting Point Determination (`eln_experiment_id` → EXP-2025-0018)
- ExpTube uses UUIDs as `id` but has `eln_experiment_id` column — **always use `eln_experiment_id` for SKB**

## Implementation Priority

1. **High:** Send sync events to SKB on create/trash/restore — this is the critical path to keep SKB in sync
2. **Medium:** Add Archive folder UI for consistency
3. **Low:** Send sync events on experiment update — SKB currently has scaffolded KB content, not live procedure data
