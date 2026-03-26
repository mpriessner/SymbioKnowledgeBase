# Agent Prompt: SciSymbio Lens — Archive Folder & SKB Sync Integration

## Context

The SciSymbioAI Knowledge Base (SKB) has implemented a one-way sync architecture (Option C):
- **All three platforms (ChemELN, ExpTube, SciSymbio Lens) push experiment events TO SKB**
- **SKB never pushes lifecycle changes back**
- Trashed and archived experiments appear in SKB's **Archive folder** (not deleted)

SciSymbio Lens is the primary UI through which users create experiments that get mirrored to ChemELN and ExpTube. Since all three platforms mirror each other, experiments created in the Lens already exist in ChemELN and ExpTube — and through those, in SKB.

## What Needs to Change in SciSymbio Lens

### 1. Add an Archive Folder

SciSymbio Lens should have an Archive section consistent with the other platforms:
- **Archive action:** Add "Move to Archive" in the experiment context menu
- **Archive folder/section:** Show archived experiments in a separate UI section
- **Restore from archive:** Allow restoring archived experiments back to active
- **Trash remains separate:** Trash = scheduled for permanent deletion. Archive = preserved indefinitely.

### 2. Archive vs Trash Distinction

| Action | What happens | Recoverable? | SKB behavior |
|--------|-------------|--------------|--------------|
| Archive | `status = 'archived'`, experiment preserved | Yes, restore anytime | → SKB Archive folder |
| Trash | `deleted_at` set, 30-day auto-purge | Yes, within 30 days | → SKB Archive folder |
| Purge | Permanently deleted | No | → Hard-deleted from SKB |

**Key insight:** Both Archive and Trash map to SKB's Archive folder. The difference is:
- Archive = intentional long-term preservation
- Trash = temporary before permanent deletion

### 3. Sync Events to SKB

Since SciSymbio Lens mirrors to ChemELN and ExpTube, and those in turn can sync to SKB, you have two options:

**Option A (Recommended):** Let the sync flow through ChemELN/ExpTube
- Lens → ChemELN (existing mirror) → ChemELN sends sync to SKB
- No direct Lens→SKB connection needed
- Simpler, no new integration

**Option B:** Direct Lens→SKB sync
- Send events directly to SKB alongside the ChemELN/ExpTube mirror
- Use `source: "scisymbio"` to identify events from the Lens
- Same payload format as ChemELN (see AGENT-PROMPT-CHEMELN.md)

If using Option B:

```
POST {SKB_API_URL}/api/sync/experiments
Authorization: Bearer {SYNC_SERVICE_KEY}
X-Source: scisymbio
Content-Type: application/json

{
  "eln_experiment_id": "EXP-2026-0053",
  "action": "create",
  "source": "scisymbio",
  "fields": {
    "title": "Experiment Title",
    "source_status": "draft"
  }
}
```

SKB's sync endpoint is idempotent — if ChemELN already created the page, the Lens event will return `{ status: "exists" }` without duplicating.

### 4. Environment Variables (Option B only)

```
SKB_API_URL=http://localhost:3000
SYNC_SERVICE_KEY=<shared secret>
```

### 5. Anti-Loop Protection

- If `source === "skb"` in any incoming event, skip re-propagation
- SKB currently uses Option C (no outgoing propagation), so this is defensive only

## Implementation Priority

1. **High:** Add Archive folder UI for consistency across all platforms
2. **Medium:** Decide on Option A vs B for SKB sync
3. **Low:** Direct sync integration (if Option B chosen)
