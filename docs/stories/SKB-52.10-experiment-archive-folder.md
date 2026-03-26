# Story SKB-52.10: Experiment Archive Folder & Sync Integration

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.10
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-52.4 (Incoming Sync Endpoint), SKB-52.7 (Auto-Ingest)
**Supersedes:** SKB-52.3 (Page Soft-Delete & Trash — reverted)

---

## User Story

As a researcher using the Chemistry Knowledge Base,
I want experiments that are trashed or deleted in ChemELN/ExpTube to move to an Archive folder instead of being permanently deleted,
So that institutional knowledge from failed or abandoned experiments is preserved for future reference while keeping the active Experiments list clean.

---

## Problem

Currently, when an experiment is deleted via the sync endpoint (`action: delete`), the KB page is **hard-deleted** — the page, its blocks, and all accumulated knowledge are permanently lost. This is wrong for a knowledge base because:

1. **Negative results have value.** "We tried X and it failed because Y" prevents teams from repeating mistakes.
2. **Cross-experiment patterns require history.** SKB-52.9 (Agent-Driven Knowledge Extraction) needs access to all experiments — including archived ones — to detect patterns like "this failure happened 3 times with substrate X."
3. **Accidental deletes are unrecoverable.** If someone trashes an experiment in ChemELN by mistake, the KB knowledge is gone even after ChemELN restores it.
4. **Active experiments list gets cluttered.** All 38 experiments currently show in a flat list under Experiments, including test/scratch experiments that were trashed in ChemELN.

## Design Decision: Archive, Not Trash

A traditional trash → permanent delete workflow makes sense for ChemELN (where the experiment record is the artifact). But in the KB, the *learnings extracted from that experiment* should never be lost. Therefore:

- **Archive** replaces **Trash** for experiment pages.
- Archived experiments are moved to an "Archive" category folder — visible but clearly separated from active experiments.
- There is no automatic permanent deletion. A manual "Purge" action exists but requires explicit confirmation and is intended for truly empty/useless pages only.
- The AI agent (SKB-52.9) can still search and reference archived experiments.

### Sync Action Mapping

| Source Event | Current KB Behavior | New KB Behavior |
|---|---|---|
| ChemELN/ExpTube **trashes** experiment | Hard-deletes KB page | Moves KB page to Archive folder |
| ChemELN/ExpTube **restores** from trash | No-op (page already gone) | Moves KB page back to Experiments folder |
| ChemELN/ExpTube **permanently deletes** | Hard-deletes KB page | Keeps in Archive (knowledge preservation) |
| User archives in KB directly | Not possible | Moves to Archive folder |
| User restores in KB directly | Not possible | Moves back to Experiments folder |
| User purges in KB directly | Not possible | Permanently deletes (with confirmation) |

---

## Technical Approach

### 1. Create Archive Category Page

Add an "Archive" category page under Chemistry KB root, alongside Experiments, Chemicals, etc.

```
Chemistry KB
├── Experiments (active experiments)
├── Archive (trashed/deleted/abandoned experiments)
├── Chemicals
├── Reaction Types
├── Researchers
└── Substrate Classes
```

**Implementation:**
- Add `archiveId` to `HierarchyResult` in `setupHierarchy.ts`
- Add "Archive" to `CATEGORY_PAGES` array with icon "📦" and appropriate description
- The Archive page should explain its purpose: "Experiments moved here from the active list. Knowledge is preserved for pattern detection and historical reference."

### 2. Archive Action (Move to Archive Folder)

Instead of `prisma.page.delete()`, update the page's `parentId` to point to the Archive category.

```typescript
async function handleArchive(
  elnId: string,
  tenantId: string,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const page = await findActiveExperiment(tenantId, elnId);
  if (!page) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Experiment ${elnId} not found` } } };
  }

  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  // Move to archive folder
  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: hierarchy.archiveId },
    _max: { position: true },
  });

  await prisma.page.update({
    where: { id: page.id },
    data: {
      parentId: hierarchy.archiveId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  console.log(`${logPrefix} Archived: ${page.title} (${page.id})`);
  return { status: 200, body: { status: "archived", id: page.id, title: page.title } };
}
```

### 3. Restore Action (Move Back to Experiments)

Move the page from Archive back to Experiments.

```typescript
async function handleRestore(
  elnId: string,
  tenantId: string,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  // Find in archive
  const page = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.archiveId,
      title: { startsWith: elnId },
    },
    select: { id: true, title: true },
  });

  if (!page) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Archived experiment ${elnId} not found` } } };
  }

  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: hierarchy.experimentsId },
    _max: { position: true },
  });

  await prisma.page.update({
    where: { id: page.id },
    data: {
      parentId: hierarchy.experimentsId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  console.log(`${logPrefix} Restored: ${page.title} (${page.id})`);
  return { status: 200, body: { status: "restored", id: page.id, title: page.title } };
}
```

### 4. Update Sync Endpoint

Modify `src/app/api/sync/experiments/route.ts`:
- `action: "delete"` → calls `handleArchive()` instead of `handleDelete()`
- `action: "restore"` → calls `handleRestore()` instead of returning no-op
- `action: "purge"` → keeps existing hard-delete behavior (for admin-only use)

### 5. Update experimentLookup.ts

Add `findArchivedExperiment()` that searches within the Archive category:

```typescript
export async function findArchivedExperiment(
  tenantId: string,
  elnExperimentId: string
): Promise<ExperimentPageMatch | null> {
  const hierarchy = await setupChemistryKbHierarchy(tenantId);
  return prisma.page.findFirst({
    where: {
      tenantId,
      parentId: hierarchy.archiveId,
      title: { startsWith: elnExperimentId },
    },
    select: { id: true, title: true },
  });
}
```

### 6. UI: Archive/Restore in Context Menu

Add to `PageContextMenu.tsx` for experiment pages under Experiments or Archive:
- **Under Experiments folder:** "Move to Archive" option
- **Under Archive folder:** "Restore to Experiments" option
- **Under Archive folder:** "Purge permanently" option (with confirmation dialog)

### 7. Move Existing Archived Experiments

On first run / migration, move any experiments with `archived` status (e.g., EXP-2025-0018: Melting Point Determination) to the Archive folder automatically.

---

## Advantages Over SKB-52.3 (Reverted Soft-Delete)

SKB-52.3 tried to add `deletedAt`/`deletedBy` columns and filter 20+ queries. That approach:
- Required a Prisma schema migration (which hit the wrong DB)
- Touched 20+ query files with `deletedAt: null` filters
- Was fragile — any missed filter would leak deleted pages

This new approach:
- **No schema changes.** Uses the existing `parentId` field to move pages between folders.
- **No query filters needed.** Archived pages are simply children of a different parent — they naturally disappear from the Experiments tree.
- **Works with existing sidebar.** The Archive folder is just another category page, expandable/collapsible like the rest.
- **Zero risk of breaking existing queries.** Nothing changes about how pages are fetched or displayed.

---

## Acceptance Criteria

- [ ] Archive category page exists under Chemistry KB root
- [ ] `action: "delete"` in sync endpoint moves page to Archive (not hard-delete)
- [ ] `action: "restore"` in sync endpoint moves page back to Experiments
- [ ] `action: "purge"` in sync endpoint still hard-deletes (admin use only)
- [ ] Archived experiments are visible in sidebar under Archive folder
- [ ] Archived experiments are still searchable via agent API and search
- [ ] Context menu shows "Move to Archive" for experiments under Experiments
- [ ] Context menu shows "Restore" and "Purge" for experiments under Archive
- [ ] Existing experiments with `archived` status are moved to Archive on first run
- [ ] Agent API (SKB-52.9) can query archived experiments for pattern detection

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/chemistryKb/setupHierarchy.ts` | Add Archive category to `CATEGORY_PAGES` and `HierarchyResult` |
| `src/app/api/sync/experiments/route.ts` | Replace `handleDelete` with `handleArchive`, implement `handleRestore` |
| `src/lib/chemistryKb/experimentLookup.ts` | Add `findArchivedExperiment()` |
| `src/components/sidebar/PageContextMenu.tsx` | Add Archive/Restore/Purge menu items |
| `src/app/api/pages/[id]/restore/route.ts` | Update stub to actual restore logic |
| `src/app/api/pages/[id]/purge/route.ts` | Update stub to actual purge logic |

---

## Why This Matters

A knowledge base that deletes knowledge defeats its own purpose. The Archive folder preserves institutional knowledge from every experiment — successful or not — while keeping the active Experiments list focused on current work. This is especially critical for SKB-52.9 (Agent-Driven Knowledge Extraction), which needs the full experiment history to detect cross-experiment patterns and prevent teams from repeating past mistakes.
