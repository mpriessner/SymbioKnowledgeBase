# A70-03 — Deep page duplication (Duplicate copies content, not just the title)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** implemented (pending live verify)
- **Assigned to / currently owned by:** Agent 70 (implement after review)
- **Related / parallel work:** docs/FEATURES.md already advertises "Duplicate — Copy with all content" (false today). [A70-01](2026-07-03-a70-01-trash-restore-surface.md) edits the same sidebar context menu (`SortableSidebarTreeNode.tsx`) — **land A70-01 first**, then this.

## Problem
The sidebar "Duplicate" action produces an empty page. It calls plain
`createPage` with only title "(copy)", parentId, and icon — no blocks, no
cover, no children. Users duplicating a page silently lose everything in it,
and the features doc explicitly promises "Copy with all content".

## Evidence
- `src/components/workspace/SortableSidebarTreeNode.tsx:221-234` — Duplicate
  handler calls `createPage({ title: title + " (copy)", parentId, icon })`.
- No duplicate endpoint exists under `src/app/api/pages/`.
- Page create appends at end of siblings (`pages/route.ts:121-123`,
  nextPosition = max+1); `position` has no unique constraint (ties allowed).
- `docs/FEATURES.md` "Page Operations → Duplicate — Copy with all content".

## Scope
1. New endpoint `POST /api/pages/[id]/duplicate` (tenant-scoped):
   - clones the page row (title + " (copy)", icon, coverImage) and **ALL of
     its blocks in position order — not just the DOCUMENT block**: pages
     created via import/markdown-PUT/mirror hold multiple typed blocks
     (`savePageBlocks` creates one block per top-level node), and the mirror
     serializes all of them (`SyncService.ts:91-105`); cloning only DOCUMENT
     silently loses their content;
   - **attachments are SHARED, not cloned (v1):** copied content keeps
     referencing the original `attachmentId`s (the serving route is
     tenant-scoped by attachment, so they render fine); no FileAttachment
     rows are cloned and `storageUsed` is NOT incremented. Documented
     consequences: deleting the attachment (or purging the original page per
     A70-01) breaks the copy's references; refcounting is follow-up work
     shared with [A70-04](2026-07-03-a70-04-editor-file-image-upload-ui.md);
   - **placement: append at the end of the siblings** (reuse the existing
     nextPosition=max+1 behavior). "Insert directly after the original" would
     require shifting sibling positions and is dropped from v1;
   - `includeChildren: boolean` (default true) clones the subtree recursively,
     cap 200 pages — clear error beyond, nothing persisted;
   - **transaction strategy:** clone all page+block rows inside ONE
     `$transaction`; run the per-page index fan-out (updatePageLinks,
     updateSearchIndex, mirror) AFTER commit, best-effort with logged errors —
     do not hold the txn open across fan-out helpers (timeout risk). If the
     txn itself fails, nothing persists (no partial clones);
   - returns the new root page id.
2. Sidebar Duplicate calls the endpoint, then navigates to the new page and
   refreshes the tree.
3. **Documented v1 limitation (by design):** wikilinks inside copies —
   including links BETWEEN pages of a duplicated subtree — keep pointing at
   the ORIGINAL targets (no `[[...]]` rewriting). Copy-of-child-A linking to
   original-child-B is accepted Notion-like behavior; backlink counts on
   originals grow accordingly.
4. Database-backed pages: v1 duplicates the page WITHOUT its attached
   database, with a toast ("database not copied"); DB cloning is follow-up.

## Acceptance criteria
- AC1: Duplicating a content-rich page yields identical editor content.
- AC2: Child pages are duplicated beneath the copy by default; all wikilinks
  in copies resolve to the ORIGINAL targets (documented limitation).
- AC3: Backlinks/search index include the new copies (post-commit fan-out ran).
- AC4: Cap respected: >200-page subtree → clear error, zero rows persisted.
- AC5: Tenant isolation enforced; duplicating another tenant's page 404s.
- AC6: The copy appears at the end of its sibling list (stable ordering).
- AC7: tsc + vitest green; unit tests for content clone, subtree clone, cap,
  cross-tenant 404.

## Affected files (expected)
- new `src/app/api/pages/[id]/duplicate/route.ts`
- shared `src/lib/pages/duplicatePage.ts`
- `src/components/workspace/SortableSidebarTreeNode.tsx`

## Verification
Unit tests + live check: duplicate a content-rich page with children; open
copy, verify content parity. Playwright screenshot.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- "Position after original" needs sibling reordering the create path doesn't do (`pages/route.ts:121-123`; no unique on position). → Dropped; append-at-end (Scope 1, AC6).
- Internal subtree cross-links resolve to originals and inflate backlinks — must be stated, not implied. → Documented limitation (Scope 3, AC2).
- Transaction-vs-fan-out tension: 200-page clone with per-clone index rebuilds inside one txn risks timeouts; outside risks partial clones. → Rows-in-txn, indexes post-commit best-effort, all-or-nothing rows (Scope 1).
- Sidebar context-menu conflict with A70-01. → Sequenced after A70-01 (Provenance).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** "Clone the DOCUMENT block" drops every non-DOCUMENT block on multi-block pages (import/markdown-PUT/mirror pages hold one block per top-level node). → Clone ALL blocks in position order (Scope 1).
- **(Critical)** Attachments were unaddressed: no FileAttachment clone, no storageUsed accounting, `SetNull` on original-page delete leaves the copy referencing a page-less attachment. → v1 shared-attachment model made explicit with documented consequences; refcounting deferred (Scope 1).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): append-at-end placement, link-limitation documented, txn/fan-out strategy, sequencing.
- 2026-07-03 — Round-2 GLM runtime review: all-blocks clone, shared-attachment semantics. Status: Reviewed — ready to implement.
