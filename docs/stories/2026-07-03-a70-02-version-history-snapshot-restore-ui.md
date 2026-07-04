# A70-02 — Page version history: snapshot on save, real restore, history UI

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** in-progress → implemented (pending live verify) — 2026-07-04
- **Assigned to / currently owned by:** Agent 70 (implement after review)
- **Related / parallel work:** `stories/5.1-document-version-model.md` (model shipped), `stories/5.4-version-history-api.md` (API shipped), `stories/5.6-version-diff-visualization.md` (not started — this story delivers it). Autosave flush fix `d94a4aa`. Machine sync also writes versions (`sync/experiments/route.ts:493`) — concurrency below.

## Problem
Version history is a fully built backend that no user action ever feeds and no
UI ever reads. Editing a page in the editor creates zero version snapshots
(the only writer is machine sync), and the restore endpoint is a silent no-op:
it records a new `DocumentVersion` row but never writes the restored content
back to the page. There is no history panel, diff view, or restore button.

## Evidence
- Engine + routes exist: `src/lib/livingDocs/versioning.ts`,
  `src/app/api/pages/[id]/history/route.ts`, `.../history/[version]/route.ts`,
  `.../history/compare/route.ts`, model `prisma/schema.prisma:486` with
  `@@unique([pageId, version])` at `:504`.
- No snapshot on user save: `PUT /api/pages/[id]/blocks`
  (`src/app/api/pages/[id]/blocks/route.ts:66-227`) never calls
  `createDocumentVersion`.
- Restore no-op: `restoreDocumentVersion` (`versioning.ts:113-131`) only calls
  `createDocumentVersion` — never touches the DOCUMENT block, link index,
  search index, or mirror.
- Two distinct version sequences: `Block.version` (`schema.prisma:244`) is the
  editor's optimistic-concurrency token (409 check at `blocks/route.ts:132-146`);
  `DocumentVersion.version` is the history sequence. They must not be mixed.
- Tenancy: latest-version lookup (`versioning.ts:31-35`) filters pageId only;
  the SAME unfiltered pattern exists inline in `purge/route.ts:60-63`.
- No UI: repo-wide grep shows no component fetching `/history`.

## Scope
1. **Snapshot on save (coalesced, race-safe):** in the blocks PUT route, after
   a successful content write, create a MANUAL version. Coalesce: skip if the
   latest MANUAL version is younger than N minutes (default 10, env-tunable)
   AND from the same user; always snapshot on large plainText delta.
   PlainText for comparison is EXTRACTED FROM THE SAVED CONTENT (the route
   writes only content+version — `block.plainText` is stale).
   **Concurrency:** `createDocumentVersion` is lock-free read-latest-then-
   insert; per-save snapshots race with machine sync on
   `@@unique([pageId, version])` → wrap in a transaction and retry once on
   P2002 (recompute next version). Fire-and-forget from the route, but log
   failures — never fail the save.
2. **First-edit baseline:** if a page has no versions, snapshot the PREVIOUS
   content before overwriting (v1 = pre-edit state). Same race-safe path.
3. **Real restore:** write the version's content back to the DOCUMENT block
   **via the same upsert-in-place path as the blocks PUT** (update content +
   increment `Block.version` on the SAME block row), then fan out
   (updatePageLinks + updateSearchIndex + filesystem mirror). Then record the
   restore snapshot.
   **Forbidden implementation:** do NOT route restore through
   `savePageBlocks` (`src/lib/markdown/helpers.ts:84-104`) — it deleteMany's
   and recreates blocks, resetting `version` to the `@default(0)` and minting
   a new `block.id`, which breaks every open editor's concurrency token and
   orphans the search index keyed on the old block id.
   **Response contract:** keep the existing fields unchanged
   (`history/[version]/route.ts:119-126` returns DocumentVersion numbers —
   existing consumers keep working); ADD a new `block_version` field carrying
   the updated `Block.version` for the editor's concurrency token. No
   repurposing of the existing `version` field.
3b. **Restore vs autosave race (client-side protocol — required):**
   `useAutoSave` parks newer content in `pendingRef` while a save is
   in-flight and flushes it when the save settles
   (`src/hooks/useAutoSave.ts:81-99`); `useBlockEditor` sends
   `versionRef.current` as `expectedVersion` (`useBlockEditor.ts:122-168`).
   Without protocol, a restore is silently UNDONE: the parked pre-restore
   edit flushes with the fresh `block_version` token and overwrites the
   restored content. Therefore the history panel must, BEFORE calling
   restore: (1) suspend autosave and CLEAR any pending/parked content,
   (2) let any in-flight save settle (or mark its result stale so its
   onSuccess does NOT flush pendingRef). After restore: apply the restored
   content into the editor, set `versionRef = block_version`, resume
   autosave. Server-side, the restore write is version-checked against the
   block version read in the same transaction, so a save landing mid-restore
   causes a retry loop (max 2) rather than a blind clobber; any autosave
   arriving after restore with a stale token gets the normal 409 and its
   content is DISCARDED (the user explicitly chose to revert).
4. **Tenant filters:** add tenantId to the latest-version lookup
   (`versioning.ts:31`) AND to the identical inline lookup in
   `purge/route.ts:60-63`.
5. **History UI:** "Page history" in the page ⋯ menu → panel: version list
   (relative time, change type, word count), read-only preview, text diff vs
   current (reuse `computeTextDiff`), Restore with confirmation; after
   restore, update the editor's content + concurrency token from
   `block_version` (or force-reload the page).
6. **Retention:** keep last N versions per page (default 100, env-tunable);
   prune oldest inside the same transaction as version creation.

## Out of scope
- Block-level history, named checkpoints, side-by-side rich-text diff.

## Acceptance criteria
- AC1: Editing then autosave produces a version; rapid edits within the window
  don't spam versions; concurrent editor+sync writes never lose a snapshot to
  a unique-constraint race (test with induced P2002).
- AC2: Restore changes the page content (editor shows it after the panel
  applies/reloads) and links/search/mirror reflect it.
- AC3: History panel lists versions, shows a diff, restores with confirm.
- AC4: A concurrent editor with a stale token gets the normal 409 after a
  restore (Block.version bumped).
- AC5: No cross-tenant access via history/restore/purge paths (both tenant
  filters added).
- AC6: Existing history API consumers unchanged (`version` field semantics
  untouched; `block_version` additive).
- AC7: tsc + vitest green; unit tests for coalescing (content-derived
  plainText), baseline snapshot, P2002 retry, restore write-back + token bump,
  retention pruning.

## Affected files (expected)
- `src/app/api/pages/[id]/blocks/route.ts` (snapshot hook)
- `src/lib/livingDocs/versioning.ts` (txn+retry, restore write-back, tenant
  filter, retention)
- `src/app/api/pages/[id]/history/[version]/route.ts` (additive
  `block_version`)
- `src/app/api/pages/[id]/purge/route.ts` (tenant filter on version lookup)
- new `src/components/page/PageHistoryPanel.tsx` + `usePageHistory.ts`
- page ⋯ menu component

## Verification
Unit tests + live check: edit → history shows version; restore → editor shows
old content; diff renders; concurrent-save 409 behavior. Playwright screenshots.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Restore endpoint returns `DocumentVersion.version`, a different sequence from the editor's `Block.version` token — wiring the editor to it would be a contract change. → Additive `block_version` field; existing field untouched (Scope 3, AC6).
- **(Critical)** Per-save snapshots race machine sync on `@@unique([pageId,version])` via lock-free read-then-insert; fire-and-forget hides P2002 and silently loses snapshots. → Transaction + one retry, logged failures (Scope 1, AC1).
- Restore must reproduce the full save fan-out AND bump Block.version for AC4; coalescing must derive plainText from content (block.plainText is stale after content-only writes). → Scope 1/3.
- Tenant filter missing in BOTH `versioning.ts:31` and inline in `purge/route.ts:60-63`. → Scope 4, AC5.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** Restore silently undone by the autosave `pendingRef` flush (`useAutoSave.ts:81-99` + `useBlockEditor.ts:122-168`): parked pre-restore edits flush with the fresh `block_version` token and overwrite the restored content — the exact scenario restore exists for. → Client restore protocol added (Scope 3b): suspend autosave, clear pending, settle in-flight, then restore; post-restore stale saves 409 and are discarded.
- **(Critical)** Restore ↔ concurrent in-flight autosave ordering was unspecified (blind write vs 409). → Server restore is version-checked with a bounded retry; the user's explicit revert wins (Scope 3b).
- **(Critical)** `savePageBlocks` (`helpers.ts:84-104`) is the nearby "write content back" helper but deleteMany+creates blocks (version→0, new block.id) — would break every editor token and orphan the search index. → Explicitly forbidden; restore uses the in-place upsert path (Scope 3).

## Implementation notes (2026-07-04, Agent 70)
Implemented per spec. AC status (unit-verified; live verify pending):
- AC1 ✅ snapshot-on-save + coalescing + P2002 retry — unit tests in
  `src/__tests__/lib/livingDocs/versioning.test.ts`.
- AC2 ✅ real restore writes content back to the DOCUMENT block in place + fans
  out links/search/mirror — unit-verified.
- AC3 ✅ history panel (`PageHistoryPanel.tsx`) lists versions, previews, diffs
  vs current, restores with confirm — pending live/Playwright verify.
- AC4 ✅ restore bumps `Block.version` (returned as additive `block_version`),
  so a stale editor 409s — unit-verified token bump.
- AC5 ✅ tenant filters added (`versioning.ts` latest lookups + `purge/route.ts`).
- AC6 ✅ existing history response fields unchanged; `block_version` additive.
- AC7 ✅ tsc clean (my files); 12 new unit tests green.

Diff view deviation: the panel computes the "vs current" diff CLIENT-SIDE via
`computeTextDiff(selectedVersion.plain_text, currentLiveContent)` (current text
extracted from the blocks cache with a small client-safe TipTap walker) rather
than the server `/history/compare` endpoint — because `compare` diffs two
STORED versions and "current" is the live block, not a version, and the
server-side `extractPlainText` pulls in prisma so it can't run in the browser.
This still "reuses `computeTextDiff`" and gives a true vs-live diff.

Client restore protocol (Scope 3b) wired via a new
`EditorCoordinationProvider` registry (workspace layout): the editor registers
an autosave controller keyed by pageId; the panel suspends autosave, clears
pending/parked content, waits for the in-flight save to settle, calls restore,
then applies content + sets the version ref from `block_version` and resumes.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): additive block_version contract, P2002-safe snapshot transaction, content-derived plainText, dual tenant-filter fix, retention moved into the txn.
- 2026-07-03 — Round-2 GLM runtime review: restore-vs-autosave client protocol, version-checked restore write, savePageBlocks forbidden. Status: Reviewed — ready to implement.
