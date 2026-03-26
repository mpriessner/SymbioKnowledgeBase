# Story SKB-52.12: Option C — One-Way Sync with Archive Mapping

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.12
**Story Points:** 3 | **Priority:** High | **Status:** Done
**Depends On:** SKB-52.10 (Archive Folder), SKB-52.4 (Incoming Sync Endpoint)

---

## User Story

As a researcher using the SciSymbioAI platform,
I want the Knowledge Base to receive all experiment data from ChemELN, ExpTube, and SciSymbio Lens without pushing changes back,
So that the KB serves as a curated knowledge layer that preserves all institutional knowledge — including from trashed or archived experiments — without risk of accidentally affecting source systems.

---

## Design: Option C — One-Way Push + Local-Only Actions

### Sync Direction

```
ChemELN ──┐
ExpTube  ──┼──► SKB (Knowledge Base)
SciSymbio ─┘        │
                     ├── Archive locally (no push back)
                     ├── Restore locally (no push back)
                     └── Annotate, organize, enrich (KB-only)
```

### Mapping Rules

| Source State | SKB State |
|---|---|
| `status = active/draft/in_progress/completed` | Experiments folder |
| `status = archived` | Archive folder |
| `deleted_at IS NOT NULL` (trashed/soft-deleted) | Archive folder |
| `status = trashed` | Archive folder |
| Permanently purged in source | Hard-deleted from SKB (via purge action) |

### Key Principle

**SKB never pushes experiment lifecycle changes upstream.** Archive/restore in SKB is local-only. This means:
- Archiving a page in SKB does NOT trash it in ChemELN
- Restoring a page in SKB does NOT undelete it in ChemELN
- The KB has autonomy over its own organization
- No risk of cascading deletes

---

## Changes Made

### 1. Sync Endpoint Updated (`src/app/api/sync/experiments/route.ts`)
- Added `"archive"` action (maps to same handler as `"delete"`)
- `handleCreate()` now checks `fields.source_status` and `fields.source_deleted_at` to determine target folder
- New experiments with `source_status=archived/trashed` or `source_deleted_at` set go directly to Archive

### 2. Outgoing Sync Disabled (`src/lib/chemistryKb/experimentSyncService.ts`)
- `propagateExperimentEvent()` is now a no-op
- Logs the intent but does not make HTTP calls
- File kept as interface contract for future selective propagation

### 3. Data Migration
- Moved 8 trashed experiments (ChemELN `deleted_at IS NOT NULL`) from Experiments → Archive
- Moved 1 archived experiment (EXP-2025-0018, `status=archived`) from Experiments → Archive
- Archive folder now has 9 experiments, Experiments folder has 29

---

## Verification

- Archive folder shows 9 experiments in sidebar tree
- Experiments folder reduced from 38 to 29
- Sync endpoint accepts `archive` action alongside `delete`
- New experiments with `source_status=archived` are created in Archive folder
- No outgoing HTTP calls from SKB to ExpTube/ChemELN
