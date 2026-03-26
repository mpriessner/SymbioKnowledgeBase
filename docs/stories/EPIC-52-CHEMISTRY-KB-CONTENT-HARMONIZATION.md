# EPIC-52: Chemistry KB Content Harmonization & Cross-Platform Sync

**Status:** In Progress
**Supersedes:** EPIC-43, EPIC-44, EPIC-45, EPIC-47 (all deprioritized)

## Overview

Populate the Chemistry KB with realistic content mirroring all 18 ChemELN experiments, add cross-platform sync (incoming/outgoing), and enable automatic experiment ingestion from external platforms.

## Stories

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| SKB-52.1 | Fix Content Population | 3 | Complete |
| SKB-52.2 | Mirror ChemELN Experiments | 5 | Complete |
| SKB-52.3 | Page Soft-Delete & Trash | 5 | Reverted — needs re-implementation with proper DB migration |
| SKB-52.4 | Incoming Sync Endpoint | 3 | Complete (actions: delete, restore, update, purge) |
| SKB-52.5 | Outgoing Sync to ExpTube | 3 | Complete |
| SKB-52.6 | Story Docs & Epic Cleanup | 1 | In Progress |
| SKB-52.7 | Auto-Ingest New Experiments | 3 | Complete — `create` action added to sync endpoint |
| SKB-52.8 | Periodic Reconciliation Sync | 3 | Planned |
| SKB-52.9 | Agent-Driven Knowledge Extraction | 8 | Future — extract learnings from raw data into KB |
| SKB-52.10 | Experiment Archive Folder & Sync Integration | 5 | Planned — supersedes SKB-52.3 |
| SKB-52.11 | Configurable Category Sorting | 3 | Planned |

**Total Points:** 42

## Status Notes

### SKB-52.3 Reverted (2026-03-25)
The soft-delete implementation added `deletedAt`/`deletedBy` to the Prisma schema and `deletedAt: null` filters to 20+ query files. However, the Prisma migration was applied to the wrong database (Supabase local on port 54352) while the app connects to a separate PostgreSQL instance (port 5432/symbio). This caused Prisma to SELECT non-existent columns, producing P2022 errors on every page query. The schema changes and all query filters were reverted. The stub endpoints remain:
- `GET /api/pages/trash` → returns `[]`
- `POST /api/pages/[id]/restore` → returns 404 "Soft-delete not yet active"
- `DELETE /api/pages/[id]/purge` → returns 404 "Soft-delete not yet active"

Re-implementation requires running the migration against the correct database (`localhost:5432/symbio`).

### Seeding Fix (2026-03-25)
The seed script was initially run against port 54352 (wrong DB). Fixed by creating a temporary API endpoint that executed the seed logic through the app's own Prisma client (which reads DATABASE_URL from `.env.local`).

### Reseed with Real ChemELN Data (2026-03-26)
Deleted all 70 fabricated sample pages (fake experiments, chemicals, researchers, reaction types, substrate classes) and replaced them with 18 scaffolded experiment pages matching the actual ChemELN experiments (EXP-2025-0001 through EXP-2025-0018). Each page has the real title, objective, project, and status from ChemELN, plus empty institutional knowledge sections ready for agent-driven extraction (SKB-52.9). Category pages (Experiments, Chemicals, Reaction Types, Researchers, Substrate Classes) remain as organizational structure. Total pages: 72.

### Full Resync from Live Databases (2026-03-26)
Replaced all 18 seed-data-only experiment pages with 38 pages reflecting every experiment actually present in the ChemELN (35) and ExpTube (3 unique) databases. This includes all user-created experiments (Titration 2/3/5/6, Test 1/4/6/b/c, Acid titration, Gene Knockout Verification, etc.) and ExpTube-native experiments (Buffer Optimization, HeLa Cell Maintenance, BRCA1 Protein Expression Study). Used temporary API endpoint to read both external databases and populate SKB through its own Prisma client.

### SKB-52.10 & SKB-52.11 Planned (2026-03-26)
- **SKB-52.10 (Archive Folder)**: Supersedes the reverted SKB-52.3. Instead of soft-delete with `deletedAt` columns (which required schema migration and 20+ query filter changes), uses a simpler approach: move pages to an Archive category folder via `parentId` update. No schema changes, no query filters, zero risk of breaking existing queries. Sync mapping: `delete` → archive, `restore` → move back, `purge` → hard delete.
- **SKB-52.11 (Category Sorting)**: Adds sort options (ELN number, alphabetical, last edited, date created, manual) to the three-dot context menu on parent pages. Client-side persistence via localStorage. Default: newest ELN first for Experiments/Archive, alphabetical for other categories.

## Key Changes

### Content (SKB-52.1 + 52.2)
- Fixed 6 section-name mismatches in `experimentContext.ts` (headings didn't match templates)
- Fixed `extractSection` heading-level break condition
- Fixed seed script to update `oneLiner` in force-update path
- Added all 18 ChemELN experiments (EXP-2025-0001 through EXP-2025-0018)
- Added 35 chemicals, 4 researchers, 6 reaction types, 3 substrate classes
- Updated seed script to iterate all arrays instead of individual constants

### Sync (SKB-52.4 + 52.5)
- Added `POST /api/sync/experiments` incoming endpoint (auth via SYNC_SERVICE_KEY)
- Supports actions: delete, restore, update, purge
- Anti-loop: receiving endpoint never re-propagates
- Added outgoing sync service (`experimentSyncService.ts`)
- Fire-and-forget with DLQ for failed propagations
- Anti-loop: skips when source is 'exptube' or 'chemeln'

### Auto-Ingestion (SKB-52.7 + 52.8 — Planned)
- SKB-52.7: Add `create` action to sync endpoint — real-time page creation when experiments are created in ChemELN/ExpTube
- SKB-52.8: Periodic reconciliation sync — backfill missing experiments, create entity pages, handle webhook gaps

## Files Created/Modified

| File | Action | Status |
|------|--------|--------|
| `src/lib/chemistryKb/experimentContext.ts` | Fixed section-name patterns | Done |
| `src/lib/chemistryKb/sampleData.ts` | Expanded to 21 experiments, 35 chemicals | Done |
| `scripts/seed-chemistry-kb.ts` | Fixed oneLiner update, iterate all arrays | Done |
| `src/app/api/sync/experiments/route.ts` | Incoming sync (delete/restore/update/purge) | Done |
| `src/lib/chemistryKb/experimentLookup.ts` | ELN ID lookup | Done |
| `src/lib/chemistryKb/experimentSyncService.ts` | Outgoing sync to ExpTube | Done |
| `src/lib/chemistryKb/syncDeadLetterQueue.ts` | DLQ for failed syncs | Done |
| `src/app/api/pages/[id]/restore/route.ts` | Stub — returns 404 | Done (stub) |
| `src/app/api/pages/[id]/purge/route.ts` | Stub — returns 404 | Done (stub) |
| `src/app/api/pages/trash/route.ts` | Stub — returns [] | Done (stub) |

## Env Vars Required

| Variable | Purpose |
|----------|---------|
| `SYNC_SERVICE_KEY` | Auth for incoming sync endpoint |
| `EXPTUBE_API_URL` | ExpTube base URL for outgoing sync |
| `EXPTUBE_SERVICE_ROLE_KEY` | Auth key for ExpTube API |
| `CHEMELN_BASE_URL` | ChemELN API base URL (for reconciliation sync) |
| `CHEMELN_API_KEY` | ChemELN API key (for reconciliation sync) |
