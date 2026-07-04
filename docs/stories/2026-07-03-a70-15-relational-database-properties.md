# A70-15 — Relational database properties (relation → rollup/formula → person/files)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; LARGE, phase it)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** depends on column management [A70-14](2026-07-03-a70-14-database-column-management-saved-views.md) landing first. `docs/stories/EPIC-08-DATABASE-TABLE-VIEW.md` baseline.

## Problem
Databases support only 8 flat property types (TITLE/TEXT/NUMBER/SELECT/
MULTI_SELECT/DATE/CHECKBOX/URL). No RELATION, FORMULA, ROLLUP, PERSON, or
FILES — repo-wide grep finds zero traces. Without relations, databases are
disconnected spreadsheets; with them, SKB's knowledge-graph story extends into
structured data (experiments ↔ chemicals ↔ researchers).

## Evidence
- `src/types/database.ts:82-91` — the 8-type union.
- Grep RELATION/FORMULA/ROLLUP/PERSON: no hits outside chemistry sync code.

## Scope (phased — each phase shippable)
1. **Phase 1 RELATION:** property type referencing another database; cell edit
   opens a row picker; store as row-id array; render as chips linking to the
   target row/page; back-relation optional. Graph integration: relation edges
   surfaced in the knowledge graph (flagged type).
2. **Phase 2 ROLLUP + FORMULA:** rollup aggregates over a relation (count, sum,
   min/max, avg); formula with a SMALL sandboxed expression grammar (no eval;
   parse with a tiny tokenizer; numbers/strings/bools, property refs, if/concat/
   arithmetic). Computed server-side on read, cached per row version.
3. **Phase 3 PERSON + FILES:** person = tenant user picker (reuse presence/user
   list); files = reuse attachment backend from [A70-04].

## Acceptance criteria (per phase)
- P1: Two databases linked; deleting a target row cleans the relation cells;
  tenant isolation on the picker.
- P2: Rollup/formula recompute when source cells change; malformed formulas
  error inline, never crash rendering; no arbitrary code execution.
- P3: Person cells notify the assigned user (reuse notification triggers).
- All: tsc + vitest green; property-type unit tests; migrations included.

## Affected files (expected)
- `prisma/schema.prisma`, `src/types/database.ts`, cell renderers/editors under
  `src/components/database/`, rows API, new formula engine lib

## Verification
Phase-gated unit tests + live linked-database demo.
