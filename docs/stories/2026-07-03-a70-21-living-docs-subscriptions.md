# A70-21 — Living documents: generalize subscriptions & change propagation

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; LARGE)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** root `stories/5.2-document-subscription-system.md`, `5.3-change-propagation-engine.md`, `5.5-external-url-monitoring.md` (this consolidates them); chemistry-specific propagation already exists (`src/lib/chemEln/sync/updatePropagator.ts`); version history [A70-02](2026-07-03-a70-02-version-history-snapshot-restore-ui.md) is the substrate.

## Problem
The `DocumentSubscription` model (MIRROR/NOTIFY/SUGGEST modes) exists but the
only propagation engine is chemistry-ELN-specific. The envisioned product
feature — subscribe a page to a source (another page, an external URL) and get
mirrored updates / notifications / AI-suggested edits — has no general engine,
no subscription UI, and no external URL monitoring.

## Evidence
- Model only: `prisma/schema.prisma:513`; engine chemistry-only:
  `src/lib/chemEln/sync/updatePropagator.ts`, `incrementalSync.ts`.
- No user-facing subscribe flow or URL monitor job (repo grep).

## Scope (phased)
1. **P1 page→page:** "Subscribe this page to changes of [[X]]" — NOTIFY mode
   (notification on source save, reusing triggers) and MIRROR mode for a marked
   section (source-of-truth block replicated read-only into subscribers on
   save; loop-guard).
2. **P2 external URL:** store URL + content hash; a sweep-style CLI/cron
   (mirroring `SKB-34.4` pattern) fetches with the existing SSRF guard, diffs,
   NOTIFY on change; no auto-mirroring of external HTML in v1.
3. **P3 SUGGEST:** LLM-drafted update suggestion queued in inbox (builds on P1
   infra + AI plumbing already used by summaries).

## Acceptance criteria
- P1: Editing source page notifies subscribers / updates mirrored section
  without infinite loops; unsubscribe works; tenant-scoped.
- P2: URL change detected on next sweep run; SSRF guard enforced; failures
  logged, not thrown into user flows.
- All: tsc + vitest green; propagation unit tests.

## Affected files (expected)
- new `src/lib/livingDocs/propagation.ts`, subscription API + UI entry in page
  menu, sweep CLI extension

## Verification
Unit tests + live two-page mirror demo.
