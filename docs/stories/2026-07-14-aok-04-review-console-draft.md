# AOK-04 (DRAFT) — Site Console: review queue, QR sheets, catalog import

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 93 (session `93_New_Feature_other_usecases`)
- **Created:** 2026-07-14
- **Status:** future-backlog — owner decision 2026-07-21: keep for later, do NOT implement now (not reviewed, not scheduled)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** depends on AOK-01 (backend — DONE, on main, hardware-verified 2026-07-16/17). Strategy: `~/windsurf_repos/NEW-PRODUCTS-ASSESSMENT-2026-07-14.md` §4.3 step 5. Siblings: Android AOK-03 (procedure playback, draft), ExpTube AOK-05 (procedure generation, draft).

## Goal
A manager (the buyer persona) can review everything captured through the glasses before workers see it, print QR anchor sheets, and bulk-import an inventory catalog — inside SKB's existing web UI, auth'd via the usual ExpTube Supabase session.

## Sketch
1. **Review queue page**: list `AokKnowledge` (and later procedures) by `reviewStatus`; inline edit text/kind; approve/reject. **Flip AOK-01's default** `reviewStatus` from `approved` → `pending` in the same change that ships this queue (v1 shipped `approved`-by-default deliberately so the demo works without a console; the flip + queue must land together or captures go dark).
2. **Asset detail page**: card + knowledge + visits + counts + anchor(s) with reprint button.
3. **QR sheet generator**: N blank pre-minted anchors (status `unbound`) rendered as a printable grid (AOK-01 already returns `qr_png_base64`); bind-on-first-scan flow already specced in AOK-02's unbound-anchor path.
4. **Catalog CSV/XLSX import**: bulk-create `class:"inventory_item"` assets with `expected_qty`/`reorder_at` attributes; per-row error report.
5. **Coverage stat**: assets per site, % with knowledge, % counted in last N days.

## Open questions
- Where in SKB's navigation this lives (new top-level section vs. under an existing space).
- Roles: reuse TenantMember owner/admin as "reviewer" or introduce a reviewer role? (Tenant has roles; no RLS — every query tenant-scoped.)
- Does the reviewer edit create a new version or edit in place? (Spec pack wants re-versioning; SKB has no versioning primitive for these tables yet.)

## Out of scope
Multi-site org hierarchy above Tenant; approval for counts/visits (append-only, no gate needed); offline bundle endpoint.
