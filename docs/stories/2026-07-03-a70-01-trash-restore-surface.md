# A70-01 — Trash & Restore surface (fix the delete data trap)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** implemented (pending live verify)
- **Assigned to / currently owned by:** Agent 70 (implement after review)
- **Related / parallel work:** Chemistry archive flow (`SKB-52.10`) owns `pages/[id]/archive|restore|purge` — those routes are archive-folder-gated and must NOT be reused or regressed. [A70-03](2026-07-03-a70-03-deep-page-duplication.md) edits the same sidebar context menu — land A70-01 FIRST.

## Problem
Deleting a page is an unrecoverable data trap from the user's perspective.
Delete soft-deletes (stamps `deletedAt`, keeps the row) but there is no Trash
surface: the trash API is a dead stub that always returns `[]`, no UI lists
deleted pages, and no restore path exists for normal pages. Notion and
Obsidian both treat delete as recoverable. Worse, the bulk-delete modal tells
the user pages will be "permanently deleted", and several read surfaces
(graph, backlinks) don't even filter deleted pages out.

## Evidence
- Soft delete: `src/app/api/pages/[id]/route.ts:307-315` sets
  `deletedAt`/`deletedBy`; also runs `markWikilinksAsDeleted`
  (`src/lib/wikilinks/renameUpdater.ts`): deletes incoming `pageLink` rows AND
  rewrites linking pages' content setting wikilink `attrs.pageId = null`.
- Dead stub: `src/app/api/pages/trash/route.ts:8-18` always returns `[]`.
- **Existing restore/purge are archive-only:** `restore/route.ts:33-40` 400s
  unless `page.parentId === hierarchy.archiveId`; `purge/route.ts:37-44`
  gates identically. Trash pages keep their original parentId → both routes
  REJECT them. Archive (moves parentId, no deletedAt) and trash (deletedAt,
  parentId unchanged) are two independent mechanisms.
- **deletedAt filtering is inconsistent:** present in tree
  (`pages/tree/route.ts:43`), page list (`pages/route.ts:48`), search
  (`search/route.ts:88`). MISSING in graph builder
  (`src/lib/graph/builder.ts:27` global, `:155` local, block aggregation at
  `:45`/`:168`) and backlinks (`pages/[id]/backlinks/route.ts:37`).
- Misleading copy: `src/components/pages/BulkActionBar.tsx:127`.

## Scope
1. Fix `GET /api/pages/trash`: return the tenant's soft-deleted pages (id,
   title, icon, deletedAt, parent title), newest first, paginated.
2. **New dedicated endpoints** `POST /api/pages/[id]/trash-restore` and
   `DELETE /api/pages/[id]/trash-purge` (names final at impl): operate on
   `deletedAt`-trashed pages only. Do NOT modify the archive-gated
   `restore`/`purge` routes — chemistry flow untouched.
3. Trash restore semantics: clear `deletedAt/deletedBy`; restore to original
   parent if alive, else workspace root; rebuild the page's own outgoing
   links + search index; **re-link incoming wikilinks best-effort** via a
   TENANT-WIDE CONTENT SCAN for wikilink nodes with `pageId: null` whose
   `pageName` matches the restored title, re-point them, then rebuild those
   pages' pageLink rows. NOTE (from round-2 review): the renameUpdater
   machinery canNOT be "reused in reverse" — it discovers sources via
   `pageLink.targetPageId` rows (`renameUpdater.ts:28-36`) which
   `markWikilinksAsDeleted` DELETED at trash time (`:189-194`); the content
   scan is the only viable mechanism (`nullifyPageIdInNodes` keeps `pageName`
   populated, so the scan works). Documented limitation: edited mentions or
   colliding titles are not re-linked.
4. Trash purge: permanently delete page + blocks + attachments after confirm.
   **Attachments do NOT cascade:** `FileAttachment.pageId` is
   `onDelete: SetNull` (`schema.prisma:559`), unlike Block/PageLink
   (Cascade) — a bare `page.delete` leaves attachment rows, on-disk bytes,
   and `Tenant.storageUsed` untouched. Purge must explicitly delete the
   page's FileAttachment rows, remove their stored files, and decrement
   `storageUsed` via the shared accounting helper defined in
   [A70-04](2026-07-03-a70-04-editor-file-image-upload-ui.md). (The existing
   archive `purge/route.ts:58-86` has this same leak — fixing it there is a
   noted follow-up, not this story.)
5. Trash UI: sidebar footer "Trash" entry → panel listing deleted pages with
   Restore / Delete forever (confirm) / empty state.
6. **Close the read-surface holes (required impl, not verification):** add
   deletedAt filters to `buildGlobalGraph`, `buildLocalGraph` (incl. block
   plainText aggregation), and the backlinks route; verify QuickSwitcher
   recents + any remaining list surfaces.
7. **Prevent resurrection (BOTH write routes):** `PUT /api/pages/[id]/blocks`
   (`:100-110` page check) AND the page-metadata `PUT /api/pages/[id]`
   (`route.ts:156-159` — its findFirst has NO deletedAt filter despite the
   comment claiming "not trashed") must reject writes to a trashed page
   (404/410). Without the second guard an open editor can still rename,
   re-parent, or re-cover a trashed page, propagating into wikilinks
   (`updateWikilinksOnRename` runs inside that txn at `:235-242`), tree, and
   mirror.
8. Fix BulkActionBar copy ("moved to Trash").
9. Exclude archive-folder pages from the Trash list (separate feature).

## Out of scope
- Auto-purge retention policy (follow-up), trash for database rows,
  modifying the chemistry archive routes.

## Acceptance criteria
- AC1: Delete → appears in Trash; restore → back in tree with content and its
  own outgoing links/search intact; incoming links re-linked where pageName
  still matches (limitation documented).
- AC2: Deleted pages excluded from sidebar, search, GRAPH (global+local),
  BACKLINKS, and quick switcher — with the graph/backlinks filters added in
  this story.
- AC3: Delete forever removes page + blocks permanently after confirmation.
- AC4: All new queries tenant-filtered; cross-tenant restore/purge 404s.
- AC5: Bulk delete flows into Trash with corrected copy.
- AC6: Chemistry archive restore/purge behavior unchanged (existing tests
  stay green).
- AC7: BOTH editor content saves AND page-metadata writes (rename/re-parent/
  cover) to a trashed page are rejected; no resurrection.
- AC9: Purge removes the page's attachment rows + stored files and decrements
  storageUsed (verified in test).
- AC8: tsc + vitest green; new unit tests for trash list/restore/purge and
  the graph/backlinks deletedAt filters.

## Affected files (expected)
- `src/app/api/pages/trash/route.ts` (rewrite stub)
- new `src/app/api/pages/[id]/trash-restore/route.ts`, `.../trash-purge/route.ts`
- `src/lib/graph/builder.ts`, `src/app/api/pages/[id]/backlinks/route.ts`
- `src/app/api/pages/[id]/blocks/route.ts` (trashed-page guard)
- `src/components/workspace/Sidebar.tsx`, new `TrashDialog` component
- `src/components/pages/BulkActionBar.tsx`
- `src/lib/wikilinks/renameUpdater.ts` (re-link helper)

## Verification
Unit tests + live browser: delete → trash → restore → content + links checked;
delete forever → gone; archive flow regression-checked. Playwright screenshots.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Existing restore/purge routes are archive-folder-gated (`restore/route.ts:33-40`, `purge/route.ts:37-44`) and would 400 on trash pages; reuse plan unworkable and branching risks the chemistry flow. → Dedicated trash endpoints (Scope 2), archive routes untouched (AC6).
- **(Critical)** AC2 was false today: graph builder (`builder.ts:27,155,45,168`) and backlinks (`backlinks/route.ts:37`) lack deletedAt filters — implementation work, not verification. → Scope 6.
- **(Critical)** Delete runs `markWikilinksAsDeleted` (deletes incoming pageLinks + nulls pageId in other pages' content) — restore cannot trivially make links "intact". → Best-effort re-link by pageName + documented limitation (Scope 3, AC1).
- blocks PUT lacks a deletedAt guard → open editors resurrect trashed pages. → Scope 7, AC7.
- QuickSwitcher recents source unverified. → folded into Scope 6.
- Sidebar context-menu conflict with A70-03. → sequencing note in Provenance.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** Resurrection guard was incomplete: page-metadata `PUT /api/pages/[id]` (`route.ts:156-159`) has no deletedAt filter — rename/re-parent/cover still mutate a trashed page and propagate via `updateWikilinksOnRename` (`:235-242`). → Guard extended to both write routes (Scope 7, AC7).
- **(Critical)** "Reuse renameUpdater in reverse" is impossible: it walks `pageLink.targetPageId` rows that `markWikilinksAsDeleted` deleted at trash time (`renameUpdater.ts:28-36` vs `:189-194`). → Prose corrected to the tenant-wide `pageId:null` + pageName content scan (Scope 3).
- **(Critical)** `FileAttachment.pageId` is `onDelete: SetNull` (`schema.prisma:559`) — purge would leak attachment rows, bytes, and storageUsed (existing archive purge already has this leak). → Explicit attachment deletion + accounting in purge (Scope 4, AC9).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): dedicated trash endpoints, graph/backlinks filter work moved into scope, backlink-restore semantics defined, resurrection guard, sequencing vs A70-03.
- 2026-07-03 — Round-2 GLM runtime review: metadata-PUT resurrection guard, corrected re-link mechanism, attachment purge accounting. Status: Reviewed — ready to implement.
