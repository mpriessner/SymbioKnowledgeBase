# A70 Improvement Audit — Index (2026-07-03)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** done (audit + review + finish-track implemented & live-verified 2026-07-04; improvement stories remain drafts awaiting owner go)
- **Assigned to / currently owned by:** Agent 70
- **Related / parallel work:** 2026-06-13 hardening audit (`AUDIT-REMEDIATION-INDEX-2026-06-13.md`) — merged; this audit is the product/feature-completeness follow-up.

Full-codebase audit by three parallel exploration passes (unfinished work,
Notion/Obsidian parity, code quality) with key claims verified by hand.
Baseline at audit time: tsc clean, 2 241 vitest passing, 184 eslint errors
(non-blocking CI debt).

**Review status (2026-07-03):** all 22 stories passed the /story review loop
(Gemini skipped per owner preference). Round 1 — regression lens — ran as a
Claude Opus fallback because the Codex CLI install is broken (missing native
binary; reinstall recommended: `npm i -g @openai/codex`). Round 2 — GLM 5.2
runtime lens — covered the 5 finish-track stories plus A70-06..09/14/16/17.
Raw critiques + revisions are appended inside each story. Finish-track
stories are `Reviewed — ready to implement`; improvement stories remain
drafts awaiting the owner's go.

## Finish-track — ALL IMPLEMENTED & LIVE-VERIFIED (2026-07-04, uncommitted)

Final state: tsc clean · vitest 2 311 passed / 38 DB-gated skips (baseline
2 241; +70 new tests, 0 regressions) · eslint 192 errors (baseline 184; every
error in touched files is fixed or pre-existing byte-identical at HEAD —
remainder is A70-22 debt). Live E2E against the running app (Postgres :5432 +
ExpTube Supabase :54381): snapshot-on-save + history panel + REAL restore
(content reverts, additive block_version); duplicate carries full content;
delete → Trash → restore round-trip + purge (incl. attachment cleanup);
workspace rename persists + sidebar updates; attachment upload 201 + new
serving route streams the PNG back. Screenshots in the session job dir.

**Environment notes discovered during verification (not caused by this work):**
(1) `.env.local`'s Supabase URL points at :54341 but ExpTube's Kong now
listens on :54381 — login was broken until overridden at process start; update
`.env.local` (agent-blocked file). (2) The dev Postgres volume had drifted
behind `prisma/schema.prisma` — fixed via `prisma db push` (additive).
(3) The Codex CLI install is broken (missing native binary) — `npm i -g
@openai/codex` to restore it.



| # | Story | Why |
|---|---|---|
| A70-01 | [Trash & Restore surface](2026-07-03-a70-01-trash-restore-surface.md) | Delete is a data trap: soft-delete + dead trash stub + no UI |
| A70-02 | [Version history: snapshot, real restore, UI](2026-07-03-a70-02-version-history-snapshot-restore-ui.md) | Backend built; no snapshots on edit; restore is a no-op; no UI |
| A70-03 | [Deep page duplication](2026-07-03-a70-03-deep-page-duplication.md) | Duplicate creates an EMPTY page |
| A70-04 | [Editor file & image upload UI](2026-07-03-a70-04-editor-file-image-upload-ui.md) | Attachment backend built; zero editor UI (EPIC-32 32.2/32.3) |
| A70-05 | [Workspace settings quick wins](2026-07-03-a70-05-workspace-settings-quick-wins.md) | Hard-coded disabled workspace name; placeholder General page |

## Improvement stories (review only — NOT to be implemented yet)

### Security / robustness
| # | Story | Severity |
|---|---|---|
| A70-06 | [Sync key tenant binding + timing-safe compare](2026-07-03-a70-06-sync-tenant-binding-timing-safe-key.md) | High |
| A70-07 | [Cross-tenant lookup fix + isolation tests](2026-07-03-a70-07-cross-tenant-lookup-fix-isolation-tests.md) | Medium-high |
| A70-08 | [API hardening: validation, errors, rate limiter](2026-07-03-a70-08-api-hardening-validation-errors-ratelimit.md) | Medium |
| A70-09 | [Bound unbounded search/graph queries](2026-07-03-a70-09-bounded-search-graph-queries.md) | Medium |

### Notion/Obsidian parity
| # | Story | Size |
|---|---|---|
| A70-10 | [Page comments](2026-07-03-a70-10-page-comments.md) | M |
| A70-11 | [Page templates](2026-07-03-a70-11-page-templates.md) | M |
| A70-12 | [Command palette + shortcuts](2026-07-03-a70-12-command-palette-and-shortcuts.md) | M |
| A70-13 | [Unlinked mentions panel](2026-07-03-a70-13-unlinked-mentions-panel.md) | M |
| A70-14 | [DB column management + saved views](2026-07-03-a70-14-database-column-management-saved-views.md) | L |
| A70-15 | [Relational DB properties](2026-07-03-a70-15-relational-database-properties.md) | XL (phased) |
| A70-16 | [Inline database block](2026-07-03-a70-16-inline-database-block.md) | L |
| A70-17 | [Notion/Obsidian import + PDF/HTML export](2026-07-03-a70-17-notion-obsidian-import-rich-export.md) | L |
| A70-18 | [Richer human search](2026-07-03-a70-18-richer-human-search.md) | M |
| A70-19 | [External member invitations](2026-07-03-a70-19-external-member-invitations.md) | M |
| A70-20 | [Account security: 2FA/passkeys/emails](2026-07-03-a70-20-account-security-mfa.md) | M |
| A70-21 | [Living-docs subscriptions](2026-07-03-a70-21-living-docs-subscriptions.md) | XL (phased) |
| A70-22 | [Lint + test debt](2026-07-03-a70-22-lint-and-test-debt.md) | M |

## Confirmed healthy (no stories needed)
Publish-to-web, FTS search, wikilinks + rename propagation, backlinks panel,
2D/3D graph, favorites, breadcrumbs, recently-visited, drag-nest, all six DB
view types (data-backed), notifications/inbox, AI meeting notes + transcription,
Ask-AI page generation, presence indicators, agent `skb_` auth stack, audit
logging, chemEln/chemistryKb tenancy discipline.

## Doc hygiene noted
Several epic Status headers are stale (EPIC-16 "Planned" but shipped; EPIC-35
"Draft" but shipped). Housekeeping, fixed alongside this audit.
