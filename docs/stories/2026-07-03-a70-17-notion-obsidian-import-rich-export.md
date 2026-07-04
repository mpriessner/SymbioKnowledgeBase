# A70-17 — Notion/Obsidian vault import (zip) + PDF/HTML export

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-14.x` markdown conversion (works, single file), `EPIC-31` filesystem mirror (front-matter conventions to reuse), CSV import exists.

## Problem
Migration into SKB is effectively impossible in bulk: import accepts a single
markdown file (plus CSV→database), no zip/folder handling, so a Notion export
or an Obsidian vault can't be brought in. Export is markdown-only (the
`?format=` param is effectively ignored) with no per-page export action in the
page UI — no PDF/HTML for sharing outside the tool.

## Evidence *(paths corrected in round-1 review)*
- Import route: `src/app/api/pages/import/route.ts` (single .md);
  `src/lib/import/csv-import.ts` (CSV→database).
- Bulk export: `src/app/api/pages/export/route.ts` (whole-workspace zip; only
  zip honored).
- Per-page markdown export ALREADY EXISTS:
  `src/app/api/pages/[id]/export/route.ts` — the real gap is (a) no UI button
  invoking it and (b) no HTML/PDF formats. Do NOT build a duplicate MD route;
  reuse this one.

## Scope
1. **Zip import:** accept a .zip (Notion export or Obsidian vault): unzip
   server-side with limits (max entries/size, path-traversal guard), rebuild
   the folder hierarchy as page tree, convert each .md via the existing
   markdownToTiptap, remap internal links, import image assets through the
   attachment backend, report a summary (created/skipped/failed) — dry-run
   mode first.
   **Link resolution is the importer's own two-pass job (round-2):** there is
   NO "later auto-links" mechanism in the codebase — `processAgentWikilinks`
   runs only when a SOURCE page is written and "unresolvable wikilinks are
   silently ignored" (`src/lib/agent/wikilinks.ts:20,22-86`), and the
   existing import route never calls it (`pages/import/route.ts:46-55`).
   Therefore: pass 1 creates ALL pages (recording zip-internal identity —
   file path / Notion hash — → new page id), pass 2 rewrites links using
   THAT mapping and only then persists content + runs link indexing. Links
   must be remapped by zip-internal identity, NOT by title — Notion exports
   routinely contain duplicate titles, and title-based resolution
   (`resolveWikilinks`) would bind them ambiguously. Genuinely unresolvable
   links stay as plain wikilink TEXT and are reported in the summary (no
   claim of later auto-linking).
2. **HTML export:** per-page "Export → HTML" (self-contained, inline styles,
   images embedded or bundled) reusing the publish-page renderer.
3. **PDF export:** server-side print of the HTML export (playwright/chromium is
   already a dev dep — decide runtime strategy in review; if too heavy, ship
   HTML first and mark PDF follow-up).
4. Per-page export action in the page ⋯ menu (MD / HTML / PDF).

## Acceptance criteria
- AC1: A real Notion zip export (nested pages + images) imports with hierarchy,
  working internal links, and visible images; failures listed per file.
- AC2: An Obsidian vault folder-zip imports with wikilinks resolved to the
  CORRECT pages via zip-internal identity (duplicate-title fixture included);
  unresolved links remain as plain wikilink text and are listed in the import
  summary.
- AC3: Zip bombs / traversal names rejected; import is tenant-scoped and
  size-capped.
- AC4: HTML export of a rich page opens standalone in a browser with images.
- AC5: tsc + vitest green; importer unit tests with fixture zips.

## Affected files (expected)
- `src/app/api/pages/import/route.ts` (+ new zip pipeline lib)
- `src/app/api/pages/[id]/export/route.ts` (add formats), bulk export route,
  page ⋯ menu component

## Verification
Fixture-driven unit tests + live import of a sample vault.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical, factual)** Wrong paths in draft: import is `pages/import/route.ts` (not `api/import/`); `api/export/route.ts` doesn't exist; and a per-page MD export route ALREADY exists (`pages/[id]/export/route.ts`) — draft claimed none did. → Evidence + affected files corrected; scope reuses the existing route instead of duplicating it.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** AC2's "later auto-links" mechanism does not exist: `processAgentWikilinks` fires only on source-page writes and silently drops unresolvables (`wikilinks.ts:20`); the import route never calls it. → Two-pass import with importer-owned link resolution (Scope 1); AC2 rewritten.
- **(Critical)** Title-based resolution vs id-based remap disagree at runtime; duplicate Notion titles bind ambiguously. → Remap by zip-internal identity, duplicate-title fixture required (Scope 1, AC2).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback): corrected route paths; acknowledged existing per-page MD export.
- 2026-07-03 — Round-2 GLM runtime review: two-pass link resolution owned by the importer, identity-based remap. Status: Reviewed (draft — not to be implemented yet).
