# Agent Prompt: ChemELN — Archive Folder & SKB Sync Integration

## Context

The SciSymbioAI Knowledge Base (SKB) has implemented a one-way sync architecture (Option C):
- **ChemELN, ExpTube, and SciSymbio Lens push experiment events TO SKB**
- **SKB never pushes lifecycle changes back**
- When experiments are **trashed** (`deleted_at IS NOT NULL`) or **archived** (`status = 'archived'`) in ChemELN, SKB moves them to an **Archive folder** instead of deleting them
- SKB preserves all institutional knowledge — even from trashed experiments

## What Needs to Change in ChemELN

### 1. Add an Archive Folder (alongside existing Trash)

ChemELN currently has:
- Active experiments (various statuses: draft, in_progress, completed)
- Trashed experiments (`deleted_at IS NOT NULL`, `deleted_by` set)
- One "archived" status (`status = 'archived'`) used for EXP-2025-0018

**Requested change:** Add a proper Archive feature:
- Add an "Archive" action to the experiment context menu (separate from "Move to Trash")
- Archived experiments get `status = 'archived'` (but `deleted_at` stays NULL — they're not trashed)
- Archived experiments should appear in a dedicated Archive section/folder in the UI
- Archived experiments can be restored back to active
- The Trash folder remains for actual deletion (30-day auto-purge)

### 2. Send Sync Events to SKB

When an experiment's lifecycle changes, ChemELN should POST to SKB's sync endpoint:

```
POST {SKB_API_URL}/api/sync/experiments
Authorization: Bearer {SYNC_SERVICE_KEY}
X-Source: chemeln
Content-Type: application/json
```

#### On Experiment Create:
```json
{
  "eln_experiment_id": "EXP-2026-0053",
  "action": "create",
  "source": "chemeln",
  "fields": {
    "title": "New Experiment Title",
    "summary": "One-line description",
    "researcher": "Dr. Smith",
    "date": "2026-03-26",
    "status": "draft",
    "source_status": "draft"
  }
}
```

#### On Experiment Trashed (soft-delete):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "delete",
  "source": "chemeln",
  "fields": {
    "source_status": "trashed",
    "source_deleted_at": "2026-03-25T15:48:32Z"
  }
}
```

#### On Experiment Archived:
```json
{
  "eln_experiment_id": "EXP-2025-0018",
  "action": "archive",
  "source": "chemeln",
  "fields": {
    "source_status": "archived"
  }
}
```

#### On Experiment Restored (from trash or archive):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "restore",
  "source": "chemeln"
}
```

#### On Experiment Updated (title, procedure, etc.):
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "update",
  "source": "chemeln",
  "fields": {
    "title": "Updated Title"
  }
}
```

#### On Experiment Permanently Purged:
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "purge",
  "source": "chemeln"
}
```

### 3. Environment Variables Needed

```
SKB_API_URL=http://localhost:3000  # or production URL
SYNC_SERVICE_KEY=<shared secret>  # same key configured in SKB's .env.local
```

### 4. Anti-Loop Protection

If ChemELN receives sync events FROM SKB (unlikely with Option C, but as safety):
- Check the `source` field in incoming payloads
- If `source === "skb"`, skip re-propagation to avoid infinite loops

### 5. Database State Summary

Current ChemELN experiment statuses:
- 19 draft, 7 in_progress, 8 completed, 1 archived
- 8 experiments have `deleted_at` set (trashed): EXP-2026-0038, 0039, 0042, 0043, 0044, 0046, 0048, 0049
- 1 experiment has `status = 'archived'`: EXP-2025-0018

All of these are already correctly reflected in SKB (trashed → Archive, archived → Archive, active → Experiments).

## Implementation Priority

1. **High:** Send sync events on experiment create/trash/restore — this ensures SKB stays up to date
2. **Medium:** Add Archive folder UI — nice to have for consistency but not blocking SKB
3. **Low:** Send sync events on experiment update — SKB currently has scaffolded content, not live procedure data
