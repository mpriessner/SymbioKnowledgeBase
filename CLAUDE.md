# CLAUDE.md — SymbioKnowledgeBase (SKB)

AI-agent-first knowledge management platform. This file orients you fast; read
it before working in this repo.

## Stack

- **Next.js 16** (App Router, Turbopack) + React + TypeScript
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter; client generated to
  `src/generated/prisma/` (imported as `@/generated/prisma/client`)
- **PostgreSQL** (Postgres 18 in Docker)
- **Supabase** for authentication (`@supabase/ssr`)
- **Vitest** (unit/integration) + **Playwright** (e2e)

## Auth (important)

Authentication is provided by **Supabase**, NOT NextAuth — any lingering
`NEXTAUTH_*` references are dead. SKB authenticates against **ExpTube's local
Supabase** (Kong on `localhost:54341`), not its own stack. The required runtime
vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; a
missing/placeholder value silently degrades auth, so `src/lib/env.ts` fails fast
at boot in production (imported for its side effect in `src/app/layout.tsx`).

## Subsystems

- **Agent API** (`src/app/api/...`, `src/lib/agent/`): API-key-only (`skb_`
  keys) endpoints for programmatic access; scopes (`read`/`write`) are enforced
  per HTTP method. Mutations are audit-logged to the `AuditLog` table via
  `src/lib/agent/audit.ts`.
- **Sync subsystem** (`src/lib/sync/`, `src/lib/chemEln/`): mirrors/reconciles
  experiment data into the knowledge base.
- **Health/readiness**: `/api/health` is pure liveness (no DB); `/api/ready`
  checks the DB (and Supabase when configured) and returns 503 when not ready.
  Both are public/unauthenticated.

## Running tests

```bash
npx vitest run        # no DB needed — DB-guarded suites self-skip
```

DB integration suites use `describe.skipIf(!DATABASE_URL)`, so they skip cleanly
when `DATABASE_URL` is unset and run when a Postgres + `DATABASE_URL` is present
(this is what CI provides). Some suites additionally need a running server
(`TEST_BASE_URL`).

## Verification

```bash
npx tsc --noEmit      # typecheck
npx vitest run        # tests
npx prisma validate   # schema
npx eslint .          # lint (carries pre-existing no-unused-vars debt)
```

CI lives in `.github/workflows/ci.yml`: tsc / vitest / prisma validate are
blocking; eslint is reported but non-blocking until the lint debt is cleared.

## Gotchas

- **Tenant isolation is per-query**, not enforced by a global DB policy — every
  query that touches tenant-scoped data must filter by `tenantId`. Dropping the
  filter leaks across tenants.
- **Prisma `Json` fields**: `Record<string, unknown>` is structurally wider than
  Prisma's `InputJsonValue`; cast when writing JSON columns.
- **Do NOT auto-seed production.** The Docker entrypoints seed only when
  `RUN_SEED=true` AND `NODE_ENV` is not production.
- **No automated off-host backup** is wired up. `scripts/backup.sh` (pg_dump)
  exists; `docker-compose.prod.yml` has a commented backup stanza + cron example.
- **Stale exploration docs** live in `docs/archive/`.

## In progress

A security/ops hardening pass is underway on branch
`harden/skb-audit-2026-06-13` (worktree `SKB-harden/`), driven by
`SKB_HARDENING_PLAN_2026-06-13.md`. Multiple agents edit disjoint file sets
concurrently — scope your changes and only judge tsc errors in files you own.
