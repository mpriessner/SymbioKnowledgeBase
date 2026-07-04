# A70-11 — Page templates (gallery + "save page as template")

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-42.3-page-templates.md` (chemistry-KB generator templates — machine-side, NOT a user picker; different feature, shared name). Deep-duplication [A70-03](2026-07-03-a70-03-deep-page-duplication.md) provides the clone mechanics this reuses.

## Problem
There is no user-facing template system: the page-creation menu offers only an
empty page or database views. Recurring structures (meeting notes, experiment
write-ups, decision docs) must be rebuilt by hand every time. (The existing
`chemistryKb/templates.ts` is a sync-pipeline generator, not this feature.)

## Evidence
- `src/components/page/PageCreationMenu.tsx` — no template option.
- No Template model/route/component (repo grep).

## Scope
1. Model: either a `isTemplate` flag on Page (Notion-style "templates live in
   the workspace") or a dedicated Template table — decide in review; flag is
   simpler and reuses all page tooling.
2. "Save as template" in the page ⋯ menu (clones page content into template
   storage via the A70-03 clone helper).
3. Template gallery in PageCreationMenu: pick template → new page pre-filled
   from it (deep clone, placeholders untouched).
4. 3–4 built-in seed templates (meeting notes, experiment log, decision record)
   seeded per tenant on first use — NOT auto-seeded in production (respect the
   RUN_SEED gotcha).
5. Manage: rename/delete templates from the gallery.

## Acceptance criteria
- AC1: Save-as-template then create-from-template yields an identical-content
  new page.
- AC2: Templates are tenant-scoped and excluded from search/graph/sidebar tree
  (or grouped under a Templates node — decide in review).
- AC3: tsc + vitest green; clone-fidelity unit test.

## Affected files (expected)
- `prisma/schema.prisma` (+ migration) or Page flag
- `src/components/page/PageCreationMenu.tsx`, page menu component
- new gallery component + API route(s)

## Verification
Unit tests + live create-from-template check.
