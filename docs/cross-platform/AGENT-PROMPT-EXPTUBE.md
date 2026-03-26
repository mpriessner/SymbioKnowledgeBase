# Agent Prompt: ExpTube — Archive Folder & SKB Sync Integration

## Context

The SciSymbioAI Knowledge Base (SKB) has implemented a one-way sync architecture (Option C):
- **ChemELN, ExpTube, and SciSymbio Lens push experiment events TO SKB**
- **SKB never pushes lifecycle changes back**
- When experiments are **trashed** (`deleted_at IS NOT NULL`) or **archived** (`status = 'archived'`) in ExpTube, SKB moves them to an **Archive folder** instead of deleting them

## What Needs to Change in ExpTube

### 1. Add an Archive Folder (alongside existing Trash)

ExpTube currently has:
- Active experiments (statuses: active, draft, completed)
- Trashed experiments (`deleted_at IS NOT NULL`)
- One "archived" status used for the Melting Point experiment

**Requested change:** Add a proper Archive feature:
- Add an "Archive" action to the experiment context menu (separate from "Move to Trash")
- Archived experiments get `status = 'archived'` (but `deleted_at` stays NULL)
- Archived experiments should appear in a dedicated Archive section in the UI
- Archived experiments can be restored back to active
- The Trash folder remains for actual deletion (30-day auto-purge)

### 2. Send Sync Events to SKB

When an experiment's lifecycle changes, ExpTube should POST to SKB's sync endpoint:

```
POST {SKB_API_URL}/api/sync/experiments
Authorization: Bearer {SYNC_SERVICE_KEY}
X-Source: exptube
Content-Type: application/json
```

#### On Experiment Create:
```json
{
  "eln_experiment_id": "{eln_experiment_id from experiments table}",
  "action": "create",
  "source": "exptube",
  "fields": {
    "title": "Experiment Name",
    "summary": "Description",
    "source_status": "active"
  }
}
```

**Important:** ExpTube uses UUID `id` but has an `eln_experiment_id` column that maps to ChemELN IDs. Always use the `eln_experiment_id` value when communicating with SKB, since SKB indexes by ELN ID (e.g., "EXP-2025-0001").

#### On Experiment Trashed:
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

#### On Experiment Restored:
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "restore",
  "source": "exptube"
}
```

#### On Experiment Updated:
```json
{
  "eln_experiment_id": "EXP-2026-0038",
  "action": "update",
  "source": "exptube",
  "fields": {
    "title": "Updated Name"
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

### 3. Environment Variables Needed

```
SKB_API_URL=http://localhost:3000
SYNC_SERVICE_KEY=<shared secret>
```

### 4. Anti-Loop Protection

If ExpTube receives sync events FROM SKB (unlikely with Option C, but as safety):
- Check the `source` field
- If `source === "skb"`, skip re-propagation

### 5. Database State Summary

Current ExpTube experiment statuses:
- 10 active, 17 draft, 9 completed, 1 archived
- 8 experiments have `deleted_at` set (trashed)
- 1 experiment archived: Melting Point Determination (`eln_experiment_id` maps to EXP-2025-0018)
- ExpTube uses UUIDs as primary keys but has `eln_experiment_id` column linking to ChemELN IDs

### 6. Key Difference from ChemELN

ExpTube's `experiments` table uses:
- `name` (not `title`) for the experiment name
- `id` is a UUID (not ELN-style like "EXP-2025-0001")
- `eln_experiment_id` column links to ChemELN — **use this for SKB sync**

## Implementation Priority

1. **High:** Send sync events on experiment create/trash/restore
2. **Medium:** Add Archive folder UI
3. **Low:** Send sync events on experiment update
