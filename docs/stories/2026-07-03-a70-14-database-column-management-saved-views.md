# A70-14 — Database column management UI + multiple saved views with persisted filters

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `EPIC-27-DATABASE-VIEWS-FULL-CRUD.md`, `SKB-08.x`, `SKB-21.x` view types. The disabled "+" saved-view button in `src/components/database/ViewSwitcher.tsx:66-73` is this story's UI anchor. Relational property types split to [A70-15](2026-07-03-a70-15-relational-database-properties.md).

## Problem
Two structural gaps keep SKB databases far from Notion databases even though
all six view types work: (1) users cannot add/rename/retype/reorder/delete
COLUMNS after creation — the backend accepts full schema updates but no UI
calls it, so the header row is frozen forever; (2) filters/sorts live only in
URL params and are lost, and each database has exactly one view config — no
multiple named saved views, which is the core Notion database concept.

## Evidence
- Backend ready, UI absent: `PUT /api/databases/[id]` accepts schema
  (`src/app/api/databases/[id]/route.ts:60-131`); no client call site.
- Client-only filters: `src/hooks/useTableFilters.ts:45-58,101-123`; rows API
  returns all rows `orderBy createdAt`.
- Single view: model stores one `defaultView` + one `viewConfig`; Table view
  saves no config (`src/components/database/DatabaseViewContainer.tsx:41-43`);
  disabled add-view button `src/components/database/ViewSwitcher.tsx:66-73`.

## Scope
1. **Column management UI:** header-row menu per column (rename, change type
   with safe coercion warnings, delete with confirm) + "add column" button +
   drag-reorder; wire to the existing PUT schema endpoint; handle row-value
   migration for type changes (server side, documented rules).
2. **Saved views:** new `DatabaseView` table (id, databaseId, tenantId, name,
   type, config JSON incl. filters/sorts/visible columns, position) with CRUD
   API; ViewSwitcher lists views, enables the "+" button, rename/delete/
   duplicate view; per-view filter/sort persisted in config (keep URL params as
   transient overrides).
3. Migration: the existing `viewConfig` is ONE object keyed by view TYPE
   (`src/types/database.ts:33-57` — board/calendar/gallery/timeline/list
   sections in a single blob; **there is NO `table` section**, yet
   `defaultView` defaults to `"table"`, `schema.prisma:322`). The migration
   must FAN OUT that blob into one `DatabaseView` row per configured view
   type AND **unconditionally create a row for the `defaultView` type with
   empty config when that type has no section** — otherwise (round-2 finding)
   the common case (`viewConfig: null`, `defaultView: "table"`, see
   `databases/route.ts:57`) migrates to ZERO views, and a configured
   database with `defaultView: "table"` gets rows but none marked default.
   Invariant after migration: every database has ≥1 view and exactly one
   default.
4. Dual-source ownership during transition: `PATCH /api/databases/[id]`
   (`src/app/api/databases/[id]/route.ts:144-205`) already persists
   `defaultView`+`viewConfig` and is read by BoardView/ListView and their
   tests. Rule: the new `DatabaseView` table is CANONICAL; the legacy fields
   become a read-only mirror of the default view (written by the new view API,
   ignored on PATCH with a deprecation warning) for one release, and the view
   components + tests migrate to the view API within THIS story — no
   split-brain window where both sources accept writes.
   **Mirror semantics (round-2):** the legacy `viewConfig` blob is
   multi-type-keyed while the default view is singular — the mirror MERGES
   the default view's config into ITS OWN type's section only, leaving other
   type sections untouched (never overwrite the whole blob), so legacy
   readers of non-default sections keep working during the window.

## Acceptance criteria
- AC1: Add/rename/retype/reorder/delete columns from the table header, changes
  persist and all six view types render the new schema.
- AC2: Create "My board" (BOARD, filtered Status=Active); reload → filter and
  view survive; another user in the tenant sees the same views.
- AC3: Type change with incompatible values follows the documented coercion
  rule (e.g. text→number: non-numeric becomes empty, warned upfront).
- AC4: Tenant isolation on the new table; tests for view CRUD + column ops.
- AC5: tsc + vitest green; migration included.

## Affected files (expected)
- `prisma/schema.prisma` + migration (DatabaseView)
- new `src/app/api/databases/[id]/views/*`
- `src/components/database/ViewSwitcher.tsx`, `DatabaseViewContainer.tsx`,
  table header components, `useTableFilters.ts`

## Verification
Unit tests + live multi-view walk-through with screenshots; migration test on
a database with config for ≥3 view types (all survive as rows).

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Existing `viewConfig` is one blob keyed by view type (`database.ts:33-57`); "seed one view per database" would drop config for all other types. → Migration rewritten as fan-out (Scope 3).
- **(Critical)** `PATCH /api/databases/[id]` (`route.ts:144-205`) is a competing config source read by BoardView/ListView + tests; ownership during the transition window was undefined. → Canonical-table rule + same-story component migration added (Scope 4).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** `ViewConfig` has no `table` section while `defaultView` defaults to `"table"` — fan-out of the common null-config case yields ZERO views, and configured cases get no default row. → Unconditional default-type row + ≥1-view invariant (Scope 3).
- Legacy-mirror write semantics were undefined for a multi-type blob vs a singular default view. → Merge-into-own-section-only rule (Scope 4).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback): viewConfig fan-out migration, dual-source ownership rule.
- 2026-07-03 — Round-2 GLM runtime review: default-type row guarantee, mirror merge semantics. Status: Reviewed (draft — not to be implemented yet).
