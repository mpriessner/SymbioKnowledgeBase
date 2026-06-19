# Audit Remediation Index — SymbioKnowledgeBase (2026-06-13)

Source audit: `/Users/mpriessner/windsurf_repos/audit-2026-06-13/symbioknowledgebase-AUDIT.md` (findings S1–S16).
Roadmap: `/Users/mpriessner/windsurf_repos/audit-2026-06-13/README.md` (Phases 0–4).

These 7 stories cover **every confirmed finding (S1–S16)**. All 16 findings were re-read against source on 2026-06-13 and **confirmed to still reproduce** — none was already resolved. Each story was drafted, then hardened with a 3-reviewer chain (Codex regression / Gemini integration / Kimi runtime); Codex and Kimi hit usage limits part-way and those lenses were performed as full-depth self-fallback (Opus 4.8) — see each story's Reviewer Feedback for the live-vs-fallback tag per reviewer.

## Story table (recommended execution order)

| # | Story file | Findings | Phase | Depends on | Status |
|---|---|---|---|---|---|
| 01 | `2026-06-13-audit-01-real-auth-on-agent-path.md` | S1, S2, S7, S11 | 1 (Critical) | none (HARD: migrate Gateway/sync callers to a real credential **before** deleting the mock) | Reviewed — awaiting approval |
| 02 | `2026-06-13-audit-02-purge-committed-secrets.md` | S3, S9 | 0 (Quick win) | none | Reviewed — awaiting approval |
| 03 | `2026-06-13-audit-03-ssrf-and-middleware-bearer-passthrough.md` | S5 | 1 | none (coordinate `middleware.ts` merge with 01) | Reviewed — awaiting approval |
| 04 | `2026-06-13-audit-04-least-privilege-user-provisioning.md` | S4 | 1 | 01 (recommended after) | Reviewed — awaiting approval |
| 05 | `2026-06-13-audit-05-sync-cors-and-shared-rate-limit.md` | S6, S8 | 1–2 | 01 (rate-limit key) | Reviewed — awaiting approval |
| 06 | `2026-06-13-audit-06-structured-audit-and-safe-sql.md` | S15, S12 | 2–3 | 01 (audits the real auth path) | Reviewed — awaiting approval |
| 07 | `2026-06-13-audit-07-dead-stack-removal-and-hygiene.md` | S10, S16, S14, S13 | 4 (Hygiene) | none (do after 01–06 to avoid churn) | Reviewed — awaiting approval |

**Suggested sequence:** 02 (quick win, independent) → 01 (the cliff; gated by the Gateway-credential cutover) → 03 → 04 → 05 → 06 → 07. 02 can land immediately; 01 is the highest-leverage but carries the live-cutover constraint; 03–06 are independent hardening once 01's auth shape is settled; 07 is anytime but cheapest last.

## Findings-coverage checklist (all confirmed reproducing; none pre-resolved)

| Finding | Severity | Confirmed at | Story |
|---|---|---|---|
| S1 — agent API accepts any non-`skb_` bearer as default-tenant read+write | CRITICAL | `src/lib/agent/auth.ts:58-69` ✔ | 01 |
| S2 — "Supabase not configured" → ADMIN everyone | CRITICAL | `src/lib/supabase/middleware.ts:43-48`, `src/lib/tenantContext.ts:118-126` ✔ | 01 |
| S3 — default prod secrets committed in `docker-compose.yml` | HIGH | `docker-compose.yml:9-10,14-15,19,25,43` ✔ (prod compose already correct) | 02 |
| S4 — every new user auto-provisioned ADMIN into shared tenant | HIGH | `src/lib/auth/ensureUserExists.ts:24-43` ✔ | 04 |
| S5 — unauth SSRF via og-metadata + middleware bearer-passthrough | HIGH | `src/app/api/og-metadata/route.ts:33`, `src/middleware.ts:27-33` ✔ | 03 |
| S6 — wildcard CORS on data-mutating sync endpoints | MEDIUM | `sync/reconcile/route.ts:134`, `sync/experiments/route.ts:61-65,130` ✔ | 05 |
| S7 — no JWT verification on the agent path; auth TODO shipped | MEDIUM | `src/lib/agent/auth.ts:26-27,62` ✔ | 01 |
| S8 — in-memory rate limiter, multi-instance-bypassable, mock-shared | MEDIUM | `src/lib/agent/ratelimit.ts:1-23`, `auth.ts:77` ✔ | 05 |
| S9 — hardcoded DB creds + demo JWT in scripts/tests | MEDIUM | `seed-demo-experiments.ts:28`, `seed-agent-personas.ts:24`, `fix-env.js:40`, `tests/e2e/global-setup.ts:23` ✔ | 02 |
| S10 — dead own Supabase stack + 2nd Postgres in repo | MEDIUM | `supabase/config.toml:5-17` ✔ (only e2e probe references 54351) | 07 |
| S11 — all API keys granted fixed read+write; no least-privilege | LOW | `src/lib/agent/auth.ts:162,182` ✔ (`ApiKey.scopes` column EXISTS at schema:291, unused) | 01 |
| S12 — `$queryRawUnsafe` + string-concat in search (latent SQLi) | LOW | `search/query.ts:47,64-108,189-249`, `depthSearch.ts:207-231`, `ragSearch.ts:75-98` ✔ | 06 |
| S13 — "AI/semantic" branding but search is FTS-only | LOW | `prisma/schema.prisma:240`, `README.md` ✔ (no pgvector/embedding column) | 07 (doc fix) |
| S14 — dev binds `0.0.0.0`, no access control | LOW | `package.json:6` ✔ | 07 |
| S15 — security events logged via console, no structured audit | NIT | `apiAuth.ts:82-86`, `auth/callback/route.ts`, `agent/auth.ts` ✔ (`AuditLog` model EXISTS at schema:564, logger console-only) | 06 |
| S16 — stale exploration/BMAD artifacts + 89KB demo seed | NIT | root `*EXPLORATION*.md`, `_bmad*`, `prisma/seed-demo.ts` (89,719 B) ✔ | 07 |

**Coverage: 16 / 16 confirmed findings assigned. 0 already-resolved. 0 deferred/uncovered.**

## Notable ground-truth discoveries (sharpen the fixes vs the audit's estimates)

- **S11 is smaller than "M":** the `ApiKey.scopes String[]` column already exists in the Prisma schema (`:291`) — it's just ignored by `agent/auth.ts` which hardcodes `["read","write"]`. The fix is "read the column + persist on creation + backfill", not a schema design.
- **S15 is schema-ready:** the `AuditLog` model already exists (`:564-576`) with exactly the fields the console-only `logAgentAction` needs. BUT `AuditLog.userId`/`tenantId` are **foreign keys** to User/Tenant (not just NOT NULL) — so auditing *anonymous* rejections requires nullable columns or a non-FK sink (else the write silently FK-violates; the logger swallows the error). Captured in Story 06.
- **S2's `env.ts` is not wired in:** `src/lib/env.ts` exists but is imported only by its own test — extending it to hard-fail needs RUNTIME-only wiring (a build-vs-runtime split; `next build` does not set `DATABASE_URL`). Captured in Story 01.
- **S3's prod compose is already correct:** `docker-compose.prod.yml` has no `:-default` secret fallbacks; S3 is specifically the **dev** `docker-compose.yml`. `Dockerfile.prod` separately lacks the `NEXT_PUBLIC_*` ARGs (bakes empty client values) — flagged in Story 02.
- **The replacement auth mechanism (S1/S7) is decided:** `@supabase/supabase-js@2.97.0` `auth.getUser(jwt?: string)` (verified in installed `auth-js` `GoTrueClient.d.ts:284`) validates an ExpTube-issued JWT server-side; `getClaims` offers a no-network local-verify alternative. So the agent path can verify real JWTs with the existing dependency — no new crypto lib. Story 01 also keeps the working `skb_` API-key path. The hard constraint is operational: migrate the Gateway + `src/lib/chemEln/sync/writer.ts` to a real credential before deleting the mock.

## NEEDS USER INPUT (consolidated — see each story for context)

1. **(Story 01)** Should per-end-user identity flow from iOS through the Gateway (forward the user's Supabase JWT), or is a single Gateway service `skb_` key acceptable for the agent path? *Assumption: default the Gateway to an `skb_` service key (lowest-risk, already works); JWT path is implemented and ready if per-user attribution is wanted.*
2. **(Story 01)** Is `DEFAULT_TENANT_ID` actually set in the running deployment? *Assumption: yes; the replacement resolves tenant from the authenticated principal regardless.*
3. **(Story 02)** History scrub of the committed secrets, or rotation-only? *Assumption: rotation-only (history rewrite out of scope, destructive).*
4. **(Story 02)** Is the live ExpTube Supabase stack still on the public demo JWT secret? *Assumption: treat as compromised → plan a coordinated rotation (invalidates tokens across all 4 apps).*
5. **(Story 02)** Should a local-dev `docker compose build` still work with the public demo Supabase URL (keep URL defaulted, require only the secrets), or must every build supply real Supabase values? *Assumption: keep the non-secret URL defaulted; require only secrets.*
6. **(Story 03)** SSRF guard: is DNS-time validation + `redirect:"error"` sufficient, or is IP-pinning (anti DNS-rebind) warranted for a bookmark-preview feature? *Assumption: DNS-time + no-redirects is sufficient.*
7. **(Story 04 — HEADLINE)** Confirm the tenant model: keep the **single shared KB** and make new users MEMBER-not-ADMIN (default, preserves the voice demo + sync visibility), or move to **true per-user personal tenants** (isolation, but the shared chemistry KB becomes invisible to new users without a separate read-through/overlay feature)? *Assumption: MEMBER-in-shared-tenant by default; personal-tenant behind a flag.*
8. **(Story 04)** Do you want a follow-up that demotes *existing* over-privileged users from ADMIN to MEMBER? *Assumption: no — deferred to avoid locking out the real operator.*
9. **(Story 05)** Is the SKB deployment single-instance or horizontally scaled? *Assumption: single-instance → harden the in-memory limiter + document; defer a shared store unless Redis is present.*
10. **(Story 06)** Audit-write volume: audit every agent request incl. read successes, or rejections + mutations only (sample/async successes)? *Assumption: audit all rejections + mutations fully; success-auditing is fire-and-forget/sampled to protect `kb-query` latency.*
11. **(Story 06)** For anonymous-rejection audit rows: make `AuditLog.userId`/`tenantId` nullable (migration), or route auth-rejections through a separate non-FK `SecurityEvent` sink? *Assumption: nullable columns (smallest change); decide per preference.*
12. **(Story 07 — HEADLINE)** Dev bind: keep `0.0.0.0` (relying on Story 01 auth + Tailscale ACL) so the documented phone/Tailscale device-testing flow keeps working, or default to `127.0.0.1` with an opt-in `dev:lan` script? *Assumption: default `127.0.0.1` + add `dev:lan`.*
13. **(Story 07)** Delete or archive `_bmad/` (1.9 MB) + the exploration reports? *Assumption: archive to `docs/archive/` (reversible), not delete.*
14. **(Story 07)** Is the full 89 KB demo seed needed for the current AstraZeneca demo? *Assumption: keep it runnable (relocate/extract data, don't delete) and update `prisma.config.ts` accordingly.*
15. **(Story 07)** Remove the dormant cloud-auth branch + `cloud-client.ts` now, or leave dormant? *Assumption: leave dormant (it's imported at module-load by the login page; removing destabilizes login) — out of scope this round.*

## Cross-story coordination notes

- **`src/middleware.ts`** is touched by Story 01 (gate the dev/ADMIN fallback) and Story 03 (do NOT delete the bearer-passthrough — wrap routes instead). Land one, rebase the other; different blocks, no logical conflict.
- **`src/lib/agent/auth.ts`** is touched by Story 01 (verification + scopes) and Story 05 (rate-limit key). Story 01 first; Story 05's keying assumes the mock is gone.
- **`ensureUserExists` / tenant placement** (Story 04) interacts with Story 01's JWT path: a JWT-authenticated user is routed through `ensureUserExists`, so the Story 04 role/tenant decision governs what a real JWT user gets. Story 01 first, Story 04 close behind.
- **`AuditLog` schema** (Story 06) may need a nullable-columns migration; sequence it with any other migration work (Story 01's `ApiKey.scopes` backfill).
