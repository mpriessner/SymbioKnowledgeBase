# Agent Prompt: ChemELN — Archive Folder UI

## Context

The SciSymbioAI platform has adopted a hub-and-spoke sync architecture:

```
SciSymbioLens → ExpTube → ChemELN  (existing bidirectional sync)
                   ↓
                  SKB  (NEW: only ExpTube pushes to SKB)
```

**ExpTube is the sole sender of sync events to SKB.** ChemELN does NOT need to push to SKB directly, because all ChemELN lifecycle events already propagate to ExpTube, and ExpTube will forward them to SKB.

## What Needs to Change in ChemELN

### Archive Folder UI Only

ChemELN currently has:
- Active experiments (statuses: draft, in_progress, completed)
- Trashed experiments (`deleted_at IS NOT NULL`, `deleted_by` set)
- One "archived" status (`status = 'archived'`) used for EXP-2025-0018

**Requested change:** Add a proper Archive feature for UI consistency across all platforms:
- Add an "Archive" action to the experiment context menu (separate from "Move to Trash")
- Archived experiments get `status = 'archived'` (but `deleted_at` stays NULL — they're not trashed)
- Archived experiments should appear in a dedicated Archive section/folder in the UI
- Archived experiments can be restored back to active
- The Trash folder remains for actual deletion (30-day auto-purge)

### Archive vs Trash Distinction

| Action | DB State | Auto-purge? | Recoverable? |
|--------|----------|-------------|--------------|
| Archive | `status = 'archived'`, `deleted_at = NULL` | No | Yes, restore anytime |
| Trash | `deleted_at` set | Yes, 30 days | Yes, within 30 days |
| Purge | Row deleted | N/A | No |

### No SKB Sync Needed

ChemELN does NOT need to implement direct sync to SKB. The flow is:
1. User archives/trashes/creates experiment in ChemELN
2. ChemELN propagates to ExpTube (existing bidirectional sync)
3. ExpTube propagates to SKB (ExpTube's responsibility)

This avoids duplicate events — if both ChemELN and ExpTube pushed to SKB, SKB would receive two events for every action.

## Database State Summary

Current ChemELN experiment statuses:
- 19 draft, 7 in_progress, 8 completed, 1 archived
- 8 experiments have `deleted_at` set (trashed): EXP-2026-0038, 0039, 0042, 0043, 0044, 0046, 0048, 0049
- 1 experiment has `status = 'archived'`: EXP-2025-0018

## Implementation Priority

**Medium:** Archive folder UI — nice to have for consistency across all SciSymbioAI platforms. Not blocking any other platform's work.
