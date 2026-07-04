# A70-04 — Editor file & image upload UI (drag-drop, paste, serving, FILE block rendering)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** implemented (pending live verify) — 2026-07-04
- **Assigned to / currently owned by:** Agent 70 (implement after review)
- **Related / parallel work:** `EPIC-32-FILE-ATTACHMENTS-AND-LOCAL-DRAG-AND-DROP.md` (32.1 done, 32.2/32.3 not started — this story delivers them); root-level `stories/1.1–1.6` superseded (local storage shipped instead of Supabase buckets); `SKB-31.5` mirror asset linking.

## Problem
The attachment backend is half built: model, tenant-scoped upload/list API and
local storage exist, but (a) **no HTTP route serves the stored bytes back** —
the upload API returns a filesystem-mirror-relative path, useless as a browser
URL; (b) the editor has zero upload UI (no drag-drop, no paste, slash-menu
"Image" uses `window.prompt` for a URL); (c) the editor cannot render a FILE
block; (d) the markdown serializer would silently DROP an unknown attachment
node, so the filesystem mirror (which runs on every save) would erase it.

## Evidence
- Backend: `prisma/schema.prisma:540` (`FileAttachment`, fileSize BigInt at
  :545; `Tenant.storageQuota/storageUsed` BigInt at :104-105),
  `src/app/api/pages/[id]/attachments/route.ts` (list/upload; has a
  `MAX_FILE_SIZE` guard; POST returns a `markdown: ![name](path)` field even
  for NON-images), `src/lib/sync/attachments.ts` (`storeAttachment` returns
  `relativePath = ./<dir>/assets/<file>` at :95-99 — mirror-relative, NOT a
  URL; never updates `storageUsed`).
- **No byte-serving route:** grep of `src/app/api` — only list/upload +
  openapi reference attachments; nothing maps attachmentId → storagePath →
  response stream.
- No FILE rendering: no attachment node in `src/components/editor`; image
  slash entry uses `window.prompt` (`src/lib/editor/blockTypeRegistry.ts`).
- Serializer data-loss trap: `src/lib/markdown/serializer.ts:186` default case
  serializes children only → a leaf `fileAttachment` node becomes an empty
  string on every mirror write (`syncPageToFilesystem` runs on each save) and
  on export. An `image` case already exists at `serializer.ts:145`.

## Scope
1. **Attachment serving route (prerequisite for everything else):**
   `GET /api/attachments/[id]` — tenant-scoped lookup (attachment →
   tenantId check via session), stream bytes from `storagePath` with correct
   `Content-Type`, `Content-Disposition` (inline for images, attachment
   otherwise), 404 on cross-tenant/missing. All editor nodes reference THIS
   URL, never the mirror-relative path.
2. **TipTap nodes:** extend image handling for uploaded images (src = serving
   URL) and add a `fileAttachment` leaf node (attachmentId, name, size,
   mimeType) rendered as a compact card (icon, filename, size, download link).
3. **Upload paths:** drag-drop onto the editor at drop position; paste image
   from clipboard; slash-menu "Image" and new "File" entries open a file
   picker (keep "Embed from URL" as secondary for images). The UI decides
   node type from the upload response's mimeType — do NOT trust the response
   `markdown` field (it renders image syntax for every file type).
4. **Upload flow (no persisted placeholders):** upload FIRST, insert the node
   only on success. Progress is shown via a transient UI overlay/toast tied
   to the upload promise — NOT via a placeholder node in the document.
   Rationale (round-2 review): a placeholder node persists through the
   autosave unmount-flush (`useAutoSave.ts:161-178`) when the user navigates
   mid-upload; the success swap then targets an unmounted editor, leaving a
   permanent broken node plus an orphaned attachment. With upload-first, a
   navigation mid-upload at worst orphans the uploaded FILE (row + bytes,
   accounted in storageUsed) — acceptable v1; attachment GC is follow-up.
   Failure → toast only. Reuse the route's existing `MAX_FILE_SIZE` (no
   second client cap that disagrees).
5. **Markdown/mirror round-trip (mandatory, ships WITH the node):**
   serializer case for `fileAttachment` (link form
   `[name](attachment-url)` or fenced marker preserving attachmentId) +
   deserializer inverse; extend the existing round-trip suites
   (`__tests__/lib/markdown/roundtrip.test.ts`, `serializer.test.ts`,
   `deserializer.test.ts`) with fileAttachment fixtures. A missing case fails
   SILENTLY (default case drops the node), so tests are the guard.
6. **Quota (BigInt-correct, SINGLE shared owner):** create ONE accounting
   helper in `src/lib/sync/attachments.ts` (e.g.
   `adjustStorageUsed(tenantId, +/-bytes)` using atomic `{ increment }`) and
   route ALL attachment create/delete paths through it — this story's
   upload/delete, A70-01's trash-purge, and any future path. Round-2 review
   flagged that three stories touch attachment lifecycle independently;
   without a single owner `storageUsed` drifts negative/positive and defeats
   the quota check. Upload path checks `storageUsed + fileSize >
   storageQuota` in BigInt. Keep minimal — no quota UI beyond the error toast.
7. **Mirror reality note:** the FileWatcher (`src/lib/sync/FileWatcher.ts:36`)
   is currently DEAD CODE — `startFileWatcher()` is never called, so the
   mirror is write-only (DB→FS) at runtime. The serializer round-trip support
   (Scope 5) is still mandatory (export/import uses it, and the watcher may
   be wired later), but AC5's mirror check verifies the WRITTEN file content,
   not a read-back cycle.

## Out of scope
- Supabase Storage buckets, lightbox gallery, resize handles, PDF preview,
  attachment garbage collection for orphaned files (follow-up).

## Acceptance criteria
- AC1: Dropping a PNG uploads it and it renders inline after save + reload,
  served through the tenant-scoped route (direct URL from another tenant's
  session 404s).
- AC2: Pasting a screenshot works identically.
- AC3: Dropping a PDF yields a file card whose download works.
- AC4: Slash-menu Image no longer uses `window.prompt`; URL-embed still
  possible.
- AC5: Round-trip: page with an image + a file attachment → markdown → back,
  both survive; filesystem mirror write does not erase them (regression test).
- AC6: Upload over quota or over MAX_FILE_SIZE is rejected cleanly; no stuck
  placeholder; storageUsed increments/decrements correctly (BigInt).
- AC7: tsc + vitest green; serializer/deserializer + quota unit tests.

## Affected files (expected)
- new `src/app/api/attachments/[id]/route.ts` (serving)
- new `src/components/editor/extensions/fileAttachment.ts` + upload hook
- `src/lib/editor/blockTypeRegistry.ts`, editor setup
- `src/lib/markdown/serializer.ts` + deserializer + round-trip tests
- `src/app/api/pages/[id]/attachments/route.ts` (quota; keep MAX_FILE_SIZE)
- `src/lib/sync/attachments.ts` (storageUsed accounting)

## Verification
Unit tests + live browser: drop image → visible after reload; PDF card
downloads; export contains working links; mirror file inspected for the
attachment markers. Playwright screenshots.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** No HTTP route serves attachment bytes; `storeAttachment` returns a mirror-relative path (`attachments.ts:95-99`) that 404s as an img src — AC1/AC2 impossible as drafted. → Serving route added as Scope 1 prerequisite.
- **(Critical)** Serializer default case (`serializer.ts:186`) silently drops leaf nodes → every mirror write erases attachments if the case is forgotten. → Round-trip support + tests made mandatory (Scope 5, AC5).
- Upload route returns image-markdown for every file type — UI must key off mimeType. → Scope 3.
- Quota fields are BigInt; must increment on upload AND decrement on delete, atomically. → Scope 6, AC6.
- Existing MAX_FILE_SIZE guard — reuse, don't duplicate. → Scope 4.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** Placeholder-node flow breaks on navigate-mid-upload: the autosave unmount flush (`useAutoSave.ts:161-178`) persists the placeholder, the success swap targets an unmounted editor → permanent broken node + orphaned attachment. → Upload-first flow, no placeholder nodes in the document (Scope 4).
- **(Critical, cross-story)** Three stories (A70-01 purge, A70-03 duplicate, this one) touch attachment lifecycle with no shared storageUsed owner → drift defeats the quota. → Single accounting helper mandated (Scope 6).
- FileWatcher is dead code (never started) — mirror is write-only today; AC5 adjusted to verify written file content. → Scope 7 note.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): byte-serving route added as prerequisite, serializer round-trip mandatory with tests, mimeType-driven node choice, BigInt quota accounting.
- 2026-07-03 — Round-2 GLM runtime review: upload-first (no placeholder nodes), shared storage accounting helper, FileWatcher reality note. Status: Reviewed — ready to implement.
- 2026-07-04 — Implemented (Agent 70). Serving route, fileAttachment node + card, drag-drop/paste/slash upload (upload-first), image URL dialog (window.prompt removed), markdown round-trip for fileAttachment, shared `adjustStorageUsed`/`wouldExceedQuota` quota accounting, BigInt quota enforcement on upload. tsc clean; full vitest green (2280 passed). Live browser verify still pending.
