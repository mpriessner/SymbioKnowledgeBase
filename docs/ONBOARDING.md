# SymbioKnowledgeBase (SKB) — New Engineer Onboarding

> **Provenance:** Generated 2026-07-11 by Claude Code (session `85_Agent`, Fable Task Brief 03) from the actual config files (`package.json`, `docker-compose.yml`, `prisma/schema.prisma`), source code, the graphify report, live Docker state, and git history. Owner: Martin Priessner (martin.priessner@scisymbio.ai).
> ⚠️ **The root `README.md` is stale and actively misleading** (says Next.js 14, lists dead NextAuth vars). Trust this doc, the repo `CLAUDE.md`, and the actual config files instead.

## What SKB is

An AI-agent-first, multi-tenant knowledge graph for lab teams: a Notion-style editor UI for humans plus a REST Agent API that voice assistants and chatbots use to query, create, and sweep structured knowledge. Search runs on PostgreSQL full-text search plus wikilink graph traversal — no vector database. Consumers: SciSymbioLens Android/iOS (via `skb_` API keys), the voice companion's `search_knowledge_base` tool, agent-nexus, and browser users.

## Day-one setup (verified against the actual files)

1. **Stack:** Next.js **16** (Turbopack), React **19**, TypeScript, Prisma **7** + PrismaPg against PostgreSQL 18 in Docker, Tiptap editor, Vitest. App on **:3000**, its Postgres on **:5432** (`docker-compose.yml`: `app` + healthchecked `db` services).
2. Copy `.env.example` → `.env.local` and fill: `DATABASE_URL`, `DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The Supabase values point at **ExpTube's** Kong, not anything SKB-owned (Gotcha 1) — and check the live port first (Gotcha 3).
3. `npm run db:generate` → `npm run db:migrate` → `npm run db:seed`. Seeding creates the default tenant (`Default Workspace`) and an admin user (`admin@symbio.local` / `changeme`, bcrypt-hashed). Extra seeds in `scripts/`: chemistry KB, demo experiments, agent personas.
4. `npm run dev` (binds 0.0.0.0, Turbopack). `npm run db:studio` for Prisma Studio; `npm run reset-demo` to reset demo data.
5. **Get an Agent API key:** log in, then `POST /api/settings/api-keys` (session-authed). Keys look like `skb_live_` + 32 hex chars, are stored only as bcrypt hash + 15-char prefix, and the plaintext is returned **once** — capture it immediately.
6. Verification loop (from repo CLAUDE.md): `npx tsc --noEmit`, `npx vitest run`, `npx prisma validate`; DB-integration suites self-skip when `DATABASE_URL` is unset.

## The files to read first

The graphify god nodes (`graphify-out/GRAPH_REPORT.md`, 2 166 nodes / 2 450 edges) are dominated by generic patterns (`GET()`, `update()`), so this list blends graph rank with architectural weight:

1. `src/lib/tenantContext.ts` — `getTenantContext()`: API key → Supabase session → 401. The front door for session-facing routes. Note the fail-closed dev bypass (only `NODE_ENV!==production` **and** `ALLOW_DEV_AUTH=true`).
2. `src/lib/agent/auth.ts` — `withAgentAuth()`: the *other*, stricter front door for `/api/agent/*` (API-key-only, rate-limited 100 req/window, per-method scopes).
3. `src/lib/agent/kbQuery.ts` — `executeKbQuery()` (1 150 lines): intent → entity → route → traverse → synthesize. The primary AI query pipeline.
4. `src/lib/search/searchRouter.ts` — auto-selects RAG vs agentic search (routing moved here out of kbQuery.ts).
5. `src/lib/search/ragSearch.ts` — FTS + wikilink-following (Story 53.3).
6. `src/lib/search/agenticSearch.ts` — hierarchy-guided deterministic traversal (Story 53.4).
7. `prisma/schema.prisma` — 16 models, all tenant-scoped; `Block.searchVector` is an `Unsupported("tsvector")` maintained by a DB trigger.
8. `src/lib/db.ts` — the Prisma client wiring (note the import path — Gotcha 2).
9. `src/lib/sweep/SweepService.ts` — budget-controlled page processor (`MAX_SWEEP_BUDGET`, pluggable `PageProcessor`).
10. `src/lib/agent/markdown.ts` — `tiptapToMarkdown()`, the bridge between the editor's block JSON and everything agent-facing (13-edge god node).

Also notable from the graph: `CrossReferenceResolver` (wikilink resolution), `SkbAgentApiWriter` (agent write path), `transformExperiment()` (ExpTube/ChemELN sync shape).

## Gotchas that will bite you

1. **Auth is ExpTube's Supabase, not SKB's.** SKB's own Supabase stack (port band 5435x) is unused for auth. Login problems are usually ExpTube-side (Kong container down, Tailscale Serve mapping stale) — check there before debugging SKB.
2. **Never import `@prisma/client`.** The client is generated to `src/generated/prisma` and imported as `@/generated/prisma/client` everywhere. Run `npx prisma generate` after schema changes.
3. **The Kong port drifts — verify, don't trust.** SKB's `docker-compose.yml` bakes `:54341` defaults in three places, but the live container has been observed bound on `:54381` (same Kong, direct bind vs. Tailscale Serve mapping — see `ExpTube/docs/adr/0003-kong-port-54341.md`). Check with `docker ps | grep kong` before overriding envs.
4. **Tenant isolation is per-query filters only — no RLS.** Every query must thread `tenantId`; dropping it silently leaks cross-tenant data. There is no database-level safety net.
5. **Two auth front doors with different strictness.** `getTenantContext()` accepts key *or* session (with dev bypass); `withAgentAuth()` is key-only with no bypass. When adding an endpoint, pick deliberately — don't assume parity.
6. **`searchVector` is trigger-maintained.** If FTS looks stale after bulk writes that bypassed the normal app path, suspect the trigger, not Prisma.

## Where things stand (as of 2026-07-11)

Merged to main since 2026-06-19: the **A70 finish-track** (trash/restore, version history, page duplication, attachments UI, workspace settings). Still on unmerged branches: the **A71 sync-mesh** batch (content sync with ExpTube et al.) and the entire **W81 Wiki+Brain epic** (planning specs only, committed as docs so worktrees can see them). A CI-triage story flags a lost-implementation regression at `d6896fd` that has not been re-fixed on main. Check branch state before implementing anything in those areas — parallel work is likely in flight.

## Further reading

- `CLAUDE.md` (repo root) — authoritative; overrides the stale README
- `docs/stories/` — epic/story history (EPIC-19 auth migration, EPIC-53/54 search, A70/A71/W81)
- `___IDEAS/adr/0001-auth-via-exptube-supabase.md` — why auth routes through ExpTube
- `graphify-out/GRAPH_REPORT.md` — dependency communities and god nodes
