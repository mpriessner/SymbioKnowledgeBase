# Repo Hygiene Notes (audit-07)

**Story:** `docs/stories/2026-06-13-audit-07-dead-stack-removal-and-hygiene.md`
(findings S10, S16, S14, S13)

What this round changed, and the decisions taken.

## S10 — dead own-Supabase stack

- `supabase/config.toml` is annotated **ABANDONED** (not deleted — reversible).
  Auth is delegated to ExpTube's Supabase on `localhost:54341`; data lives in the
  Prisma Postgres on `:5432`. Nothing in `src/` connects to the 54351-54357 ports
  it declares; running `supabase start` here only collides with the sibling
  stacks (ET_ELN 54331 / ExpTube 54341 / SciSymbioLens 54321).
- `scripts/migrate-users-to-supabase.ts` (dead — referenced only by its own usage
  comment) was deleted.
- `tests/e2e/global-setup.ts` no longer probes the dead `54351` port (repointed to
  the live `54341` and sourced from env in audit-02).
- `scripts/fix-env.js` now notes that the local `supabase status` reflects the
  abandoned stack, and points operators at the real auth stack.
- `.bmad-core` was a **stale gitlink** (mode 160000 submodule reference with NO
  `.gitmodules` entry and an empty working tree) — removed from the index.

## S16 — stale scratch + giant seed

- Root exploration reports (`EXPLORATION_SUMMARY.md`, `README_EXPLORATION.md`,
  `SIDEBAR_EXPLORATION_REPORT.md`, `CODEBASE_EXPLORATION_FINDINGS.md`) and the
  `_bmad/` + `_bmad-output/` scaffolding were `git mv`'d into `docs/archive/`
  (reversible; no code imports them).
- **`prisma/seed-demo.ts` (~127 KB) deliberately LEFT IN PLACE and runnable.**
  NEEDS-USER-INPUT (audit-07 #14): is the full demo seed needed for the active
  AstraZeneca demo? Until answered, trimming/relocating it is **deferred** —
  `prisma.config.ts` chains `seed.ts && seed-demo.ts`, so moving it would risk the
  live demo + `prisma db seed` for a hygiene-only win. Recommended follow-up once
  the demo dependency is confirmed: extract the bulky fixture data to a data file,
  or relocate to `prisma/seeds/demo-full.ts` and de-chain it from the default seed
  (updating `prisma.config.ts`).

## S14 — dev network bind

- The committed `dev` script already binds localhost (`next dev --turbopack`, no
  `-H 0.0.0.0`) in this checkout, so S14 did not reproduce. Added an explicit
  opt-in `dev:lan` (`next dev --turbopack -H 0.0.0.0`) for the documented
  phone/Tailscale device-testing flow. Prod must still front with the
  Gateway/reverse proxy (or a Tailscale ACL/firewall) and not publish `:3000` raw.

## S13 — search branding

- `README.md` now states retrieval is PostgreSQL full-text search (FTS) with
  heuristic ranking — keyword/lexical, NOT vector/embedding semantic similarity.
  The genuine AI **chat** assistant and the force-graph **visualization** are
  described accurately and unchanged. Adding real pgvector/embeddings is a
  separate feature epic, out of scope.

## Explicitly OUT OF SCOPE this round

- The dormant cloud-auth branch + `src/lib/supabase/cloud-client.ts` — imported at
  module-load by `src/app/(auth)/login/page.tsx`, so deleting it is a build break;
  the cloud branch only activates when `NEXT_PUBLIC_SUPABASE_CLOUD_URL` is set
  (unset → runtime-dead but code-live). Left dormant; revisit with login E2E.
- Git history scrubbing of the archived/removed files (history retains them).
