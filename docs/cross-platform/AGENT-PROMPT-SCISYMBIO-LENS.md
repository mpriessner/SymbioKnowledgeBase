# Agent Prompt: SciSymbio Lens — Archive Folder UI

## Context

The SciSymbioAI platform has adopted a hub-and-spoke sync architecture:

```
SciSymbioLens → ExpTube → ChemELN  (existing bidirectional sync)
                   ↓
                  SKB  (NEW: only ExpTube pushes to SKB)
```

**ExpTube is the sole sender of sync events to SKB.** SciSymbio Lens does NOT need to push to SKB directly, because all Lens actions already flow through ExpTube, and ExpTube will forward them to SKB.

## What Needs to Change in SciSymbio Lens

### Archive Folder UI Only

Add an Archive feature for consistency across all platforms:
- Add "Move to Archive" action in the experiment context menu (separate from "Move to Trash")
- Archived experiments appear in a dedicated Archive section in the UI
- Archived experiments can be restored back to active
- Trash folder remains for actual deletion (30-day auto-purge)

### Archive vs Trash Distinction

| Action | Behavior | Auto-purge? | Recoverable? |
|--------|----------|-------------|--------------|
| Archive | Preserved indefinitely, hidden from active list | No | Yes, restore anytime |
| Trash | Scheduled for permanent deletion | Yes, 30 days | Yes, within 30 days |
| Purge | Permanently deleted | N/A | No |

### No SKB Sync Needed

SciSymbio Lens does NOT need to implement direct sync to SKB. The flow is:
1. User archives/trashes/creates experiment in Lens
2. Lens propagates to ExpTube (existing sync)
3. ExpTube propagates to SKB (ExpTube's responsibility)

This avoids duplicate events and keeps the architecture simple.

## Implementation Priority

**Medium:** Archive folder UI — nice to have for consistency across all SciSymbioAI platforms. Not blocking any other platform's work.
