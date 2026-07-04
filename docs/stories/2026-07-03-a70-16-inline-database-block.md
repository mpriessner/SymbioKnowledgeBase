# A70-16 — Inline database block (embed databases inside page content)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** benefits from saved views [A70-14](2026-07-03-a70-14-database-column-management-saved-views.md) (an embed shows a chosen view). Markdown mirror `EPIC-48` serializers must learn the new node.

## Problem
Databases are 1:1 with a page (creating a second is rejected) and always render
above page content or on a dedicated route. You cannot embed a database in the
middle of a document, have several on one page, or reuse one across pages —
Notion's "linked database" pattern.

## Evidence
- Second DB rejected: `src/app/api/databases/route.ts:39-49`.
- Fixed placement: `src/components/page/PageContent.tsx:95-110` (renders
  `dbData?.data?.[0]` only); no `DatabaseBlock` node type anywhere.
- **Blocking invariant:** `Database.pageId` is a NON-nullable FK with
  `onDelete: Cascade` and is not unique (`prisma/schema.prisma:317-337`, the
  cascade at :329) — deleting the owning page today destroys the database.
- **Blocking serializer gap:** the markdown serializer's `default` case emits
  children only (`src/lib/markdown/serializer.ts:186-188`), so an unknown
  `databaseEmbed` node round-trips to EMPTY and the filesystem-mirror
  FileWatcher can then delete it from the DB copy.

## Scope
0. **Precondition A — ownership migration:** make `Database.pageId` nullable
   with `onDelete: SetNull` (or introduce an explicit ownership model) so a
   database can outlive the page that created it. Without this, deleting the
   owning page cascades and destroys a database embedded in other pages —
   violating AC2 and the delete-semantics rule below.
   **Known null-crash sites that MUST be fixed in the same change (round-2):**
   the mirror sync reads the page relation unconditionally —
   `database.page.title`/`.icon` at `src/lib/sync/DatabaseSync.ts:153-154`
   and `:259` (fired on every row edit / database PUT via the
   fire-and-forget at `databases/[id]/route.ts:112`), and
   `handleDatabaseFileChange` does `tx.page.update({ where: { id:
   database.pageId } })` at `:514` (Prisma rejects null id). These throw on
   the FIRST sync after a page delete nulls `pageId` — guaranteed crash
   sites, not hypothetical. Audit for further non-null assumptions beyond
   these.
0b. **Precondition B — serializer + deserializer support:** teach
   `tiptapToMarkdown`/`markdownToTiptap` the `databaseEmbed` node BEFORE the
   node ships. **Marker form (revised in round-2):** a code fence like
   ```` ```skb-database: <id> ```` COLLIDES with the code-block parser — the
   serializer emits the identical shape for codeBlock
   (`serializer.ts:99-103`) and remark classifies any fence as `code` before
   node-type dispatch (`deserializer.ts:22`; only wikilinks/highlights are
   intercepted PRE-remark at `:51-74`), so the embed would round-trip into a
   code block. Use an HTML-comment marker (`<!-- skb-database: <id> -->`)
   plus the same pre-remark interception mechanism wikilinks use. This is
   mandatory, not polish: the mirror's write path would otherwise mangle
   embeds.
1. TipTap `databaseEmbed` node (attrs: databaseId, viewId optional) with a
   node view rendering the existing `DatabaseViewContainer` inline (read/write).
2. Slash-menu entries: "Database — inline (new)" and "Linked view of database…"
   (picker of existing tenant databases).
3. Lift the one-database-per-page restriction for embed-created databases
   (decide: keep page-attached databases as-is, embeds reference by id).
4. Markdown/mirror round-trip: serialize as the HTML-comment marker from
   Precondition B (`<!-- skb-database: <id> -->`) so export/import and the
   filesystem mirror don't lose the reference.
5. Delete semantics: deleting an embed node never deletes the database; a
   database with zero references shows in a "unattached databases" list (or
   simply remains reachable via /databases route).

## Acceptance criteria
- AC1: Insert two different database embeds in one page; both render, filter,
  and edit rows independently.
- AC2: The same database embedded in two pages shows consistent data.
- AC3: Export→import round-trip preserves the embed reference.
- AC4: Tenant isolation on the picker and render path.
- AC5: tsc + vitest green; serializer + node tests.

## Affected files (expected)
- new `src/components/editor/extensions/databaseEmbed.tsx`
- `src/lib/editor/blockTypeRegistry.ts` (corrected path), slash menu
- `src/app/api/databases/route.ts` (restriction change)
- `prisma/schema.prisma` + migration (nullable pageId / SetNull)
- `src/lib/markdown/serializer.ts` + deserializer

## Verification
Unit tests + live embed walk-through; round-trip test: page with embed →
markdown → back, embed reference intact; delete owning page → embedded
database survives.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** `Database.pageId` non-nullable + `onDelete: Cascade` (`schema.prisma:329`): deleting the owning page destroys databases embedded elsewhere — contradicted AC2 and the delete-semantics rule. → Added Precondition A (nullable + SetNull migration).
- **(Critical)** Markdown serializer `default` case (`serializer.ts:186-188`) silently drops unknown nodes; mirror FileWatcher could then delete the embed. → Serializer/deserializer support elevated to Precondition B.
- Path fix: registry lives at `src/lib/editor/blockTypeRegistry.ts`, not `src/components/editor/`. → Fixed.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** The SetNull migration itself creates guaranteed crash sites: `database.page.title`/`.icon` read unconditionally (`DatabaseSync.ts:153-154`, `:259`) and `tx.page.update({where:{id: database.pageId}})` (`:514`) throw on the first sync after a page delete nulls pageId. → Enumerated as mandatory same-change fixes (Precondition A).
- **(Critical)** The fenced ```` ```skb-database ```` placeholder is parsed by remark as a code block (serializer emits the identical shape for codeBlock at `serializer.ts:99-103`; only wikilinks/highlights intercept pre-remark) — embeds would round-trip into code blocks. → HTML-comment marker + pre-remark interception (Precondition B, Scope 4).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback): cascade-delete ownership migration + serializer support promoted to blocking preconditions; registry path corrected.
- 2026-07-03 — Round-2 GLM runtime review: null-crash sites enumerated, marker syntax changed to HTML comment. Status: Reviewed (draft — not to be implemented yet).
