# Story: Structured audit logging for auth outcomes + safe SQL composition in search

**ID:** 2026-06-13-audit-06-structured-audit-and-safe-sql
**Status:** Reviewed — awaiting approval
**Audit findings covered:** S15, S12
**Phase / Priority:** Phase 2–3 (data-integrity / structural debt; roadmap items #25-adjacent)
**Depends on:** Story 01 (audit logging is most valuable once the auth paths are the real ones; the audit logger will record outcomes from the rewritten `withAgentAuth`). Recommended after Story 01.

## Goal
Two latent-risk hardening fixes, grouped because both are "make an existing-but-half-wired safety mechanism real":
- **S15:** route auth outcomes (success + 401/403) and key usage through the existing `logAgentAction` audit logger with principal + IP, and persist them — the `AuditLog` Prisma model already exists but the logger only `console.log`s. Replace scattered `console.error` on auth/rejection paths with structured, queryable audit rows.
- **S12:** convert the search SQL from `$queryRawUnsafe` + string-concatenated `${whereClause}`/`${scopeWhere}` to Prisma's tagged `Prisma.sql`/`$queryRaw` composition, removing the cosmetic `query.replace(/[<>]/g,"")` "sanitization" so a future edit that interpolates a user value cannot silently open SQLi.

## Context
**Broken state (confirmed against source 2026-06-13):**

1. **S15 — console-only security logging:**
   - `src/lib/agent/audit.ts:10-27`: `logAgentAction` only `console.log`s; its own TODO (`:7`) says "Add AuditLog model to Prisma schema and persist to DB." **But the `AuditLog` model already exists** — `prisma/schema.prisma:564-576` (`tenantId`, `userId`, `apiKeyId?`, `action`, `resource`, `resourceId?`, `details Json?`, `createdAt`) and `ApiKey` even has a back-relation `auditLogs AuditLog[]` (`:299`). So persistence is schema-ready and unused.
   - `src/lib/apiAuth.ts:82-86`: `lastUsedAt` failure → `console.error` only.
   - `src/app/auth/callback/route.ts`: multiple OAuth-exchange failures → `console.error` (`:126,147,188,201,242`).
   - `src/lib/agent/auth.ts`: auth rejections return `errorResponse(...401)` with no audit row.
   - The logger is **not called on auth/rejection paths** — only (per its doc) intended for mutations.

2. **S12 — `$queryRawUnsafe` + string concatenation in search (no live injection, latent):**
   - `src/lib/search/query.ts:47` — `const sanitizedQuery = query.replace(/[<>]/g, "").trim();` (cosmetic; not SQL sanitization).
   - `src/lib/search/query.ts:64-108` (keyword ILIKE path) and `:189-249` (FTS path) — build `searchSql`/`countSql` strings with interpolated `${whereClause}` (assembled from `whereConditions`, including scope/contentType fragments derived from constrained enums) and pass user input correctly as `$1/$2/$paramIndex` placeholders to `prisma.$queryRawUnsafe(searchSql, ...params)`.
   - Also cited: `src/lib/search/depthSearch.ts:207-231`, `src/lib/search/ragSearch.ts:75-98` — same `$queryRawUnsafe` + interpolated-fragment pattern.
   - **No injection today** (user values are parameterized; interpolated fragments are constant/enum-derived). The risk is purely that the pattern invites a future maintainer to append a `category`/`scope` value into the string.

**Why it matters / failure scenario:** (S15) After an incident (e.g. the SSRF probe from Story 03, or a brute-force on API keys), there is no queryable trail of failed/succeeded auth — IR relies on grepping stdout, which in a container is ephemeral. (S12) One edit like `whereConditions.push(\`p.category = '${userCategory}'\`)` opens SQLi with zero type-system complaint, because the file already uses `$queryRawUnsafe`.

**Affected files:** `src/lib/agent/audit.ts` (persist), `src/lib/agent/auth.ts` (call logger on outcomes), `src/lib/apiAuth.ts`, `src/app/auth/callback/route.ts` (route through logger), `src/lib/search/query.ts`, `src/lib/search/depthSearch.ts`, `src/lib/search/ragSearch.ts` (SQL composition). Tests in `src/__tests__/`.

## Acceptance Criteria
- [ ] `logAgentAction` writes a row to the `AuditLog` table (via `prisma.auditLog.create`) in addition to (or instead of) `console.log`, using the existing model fields. Failure to persist must not fail the request (keep the existing try/catch swallow at `audit.ts:23-26`).
- [ ] **A 401/403 rejection from an *anonymous* caller actually PERSISTS a queryable row** — verified against the real/migrated schema, not just "create was called". (Because `AuditLog.userId`/`tenantId` are FKs to User/Tenant, a sentinel principal would FK-violate and silently no-op; the chosen fix — nullable columns or a separate `SecurityEvent` sink — must make the write succeed. See Implementation step 2.) S15's "no queryable trail of failed auth" no longer holds — and is provably persisted.
- [ ] Agent auth outcomes are audited: a successful agent-auth and a 401/403 rejection each produce a persisted, queryable record capturing principal (tenantId/userId/apiKeyId when known, NULL/sink for anonymous), action (`auth.success`/`auth.reject`), resource (route path/method), and client IP (from `x-forwarded-for`/request).
- [ ] **Read-path latency is not regressed:** auth-*success* on the hot `kb-query` read path does NOT add a synchronous blocking DB write per request (Gemini). Either fire-and-forget the success audit (don't `await` it in the request critical path), or sample/disable success-auditing — rejections + mutations are audited fully. The live voice query latency budget is preserved.
- [ ] API-key `lastUsedAt`-update failures and OAuth-exchange failures are recorded through the structured logger (or at minimum a consistent structured log), not bare `console.error`. (Persisting OAuth failures may use the same `AuditLog` with a synthetic action; acceptable.)
- [ ] Sensitive fields remain redacted: the existing `sanitizeDetails` (`audit.ts:32-52`) redaction is preserved/extended; no raw token/secret is written to `AuditLog.details`.
- [ ] Search SQL no longer uses `$queryRawUnsafe` with concatenated WHERE fragments: `query.ts`, `depthSearch.ts`, `ragSearch.ts` use `Prisma.sql`/`$queryRaw` tagged-template composition (e.g. `Prisma.join`, `Prisma.sql\`...\``), so any interpolated value is a bound parameter. The cosmetic `replace(/[<>]/g,"")` is removed or replaced with a clear comment that FTS query text is bound, not sanitized. S12's "fragile tomorrow" pattern is gone.
- [ ] Search behavior is unchanged: existing search tests (FTS + keyword fallback + depth + rag) pass with identical results. Add a regression test that a query containing SQL metacharacters (`'; DROP TABLE pages; --`) returns safely (no error, no injection) on each search path.
- [ ] `npm test` green.

## Implementation Plan
1. **Persist `logAgentAction` (`audit.ts`).** Inside the existing try, after the `console.log`, add `await prisma.auditLog.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, apiKeyId: ctx.apiKeyId ?? null, action, resource, resourceId: resourceId ?? null, details: sanitized as Prisma.InputJsonValue } })`. Keep the catch swallow. Verification: unit test (mock prisma) asserts `create` called with redacted details; a thrown create does not propagate.
2. **Audit auth outcomes (`auth.ts`).** In `withAgentAuth`, after a successful `ctx` resolution log the success (see latency note below); in the catch (`:70-74`) and the scope-reject branches (`:101-119`) log `auth.reject` with whatever principal is known. Add client IP via a small helper reading `x-forwarded-for`.
   - **CRITICAL — FK constraint, not just NOT NULL (Gemini MUST-FIX):** `AuditLog.userId` and `tenantId` are **foreign keys** to `User`/`Tenant` (`schema.prisma:577-578` — `user User @relation(fields:[userId]...)`, non-optional), not merely non-null columns. Inserting a sentinel like `userId: "anonymous"` **violates the FK** → and because `logAgentAction` swallows errors (`audit.ts:23-26`), the row **silently never persists**, defeating the "audit rejections" AC entirely. The sentinel approach in the original draft is **wrong**. Two valid fixes:
     - **(Preferred) Make `AuditLog.userId` + `tenantId` nullable** via a Prisma migration (`userId String?`, `tenantId String?`, relations optional), so pre-auth/anonymous rejections can be persisted with NULL principal. This is a small additive migration.
     - **(Alternative) Route auth *rejections* through a separate structured logger** (a dedicated `SecurityEvent` table with no User FK, or structured `console` JSON shipped to a log sink) and reserve `AuditLog` for authenticated mutations only. Choose this if you don't want to touch `AuditLog`'s shape.
   - Decide one; the AC ("a 401/403 rejection produces a queryable row") is only met if the write actually succeeds — so a plan that writes a User-FK row for an anonymous caller fails the AC.
   - Verification: a test that an **anonymous** rejection actually persists a queryable row (not just that `create` was called — assert it didn't throw an FK error against a real/migrated schema).
3. **Route key/OAuth failures through the logger (`apiAuth.ts:82-86`, `auth/callback/route.ts`).** Replace bare `console.error` with a structured call (audit row or a consistent structured logger). For OAuth (no `AgentContext`), use a minimal structured log or an `AuditLog` row with sentinel principal + `action: "oauth.exchange_failed"`. Verification: tests assert the structured path is hit.
4. **Safe SQL composition (`query.ts`, `depthSearch.ts`, `ragSearch.ts`).**
   - Import `Prisma` from the generated client. Rebuild the dynamic WHERE using `Prisma.sql` fragments and `Prisma.join`, so scope/contentType conditions are composed as parameterized fragments rather than string concatenation; pass the whole thing to `prisma.$queryRaw\`...\`` (tagged) or `$queryRaw(Prisma.sql\`...\`)`.
   - Where a fragment is genuinely a constant SQL keyword (e.g. `space_type = 'PRIVATE'`), keep it as a literal `Prisma.sql` fragment (still safe). The point is that any *value* becomes a bound param.
   - Remove `replace(/[<>]/g,"")` (`query.ts:47`) — FTS text is passed to `plainto_tsquery(...)` as a bound param, which is injection-safe; replace with a comment.
   - **Test-coverage gap (Gemini MUST-FIX):** the existing `src/__tests__/lib/search/depthSearch.test.ts` mocks `prisma.block.findMany` (`:5,16-17`), but the implementation uses `prisma.$queryRawUnsafe` (`depthSearch.ts:207`) — so **the current tests do NOT exercise the raw-SQL path being refactored** and will not catch a CTE/pagination regression. This story must add tests that actually run the composed SQL: either an integration test against a real Postgres (preferred — only way to validate the multi-CTE `paramIndex`→`Prisma.sql` conversion and `ts_headline`/`plainto_tsquery` behavior), or a test that asserts the exact `Prisma.sql` `.text`/`.values` output. Do NOT rely on the existing mocked tests as the regression guard — they pass regardless of the SQL.
   - Verification: integration equality tests (same rows pre/post refactor) on a real DB for each search path; the SQL-metacharacter regression test on each path; assert pagination (LIMIT/OFFSET) is unchanged.

## Risks & Open Questions
- **`AuditLog` write volume:** auditing *every* agent request (incl. success) on the live voice-query path could be high-volume and add a DB write per request. Mitigation/`NEEDS USER INPUT:` audit only rejections + mutations (not every read success), or audit all? Assumption: **audit all auth rejections + all mutations; for auth *successes*, log only at info level / sample**, to avoid a write per `kb-query`. Final policy is a product/ops call.
- Non-null `AuditLog.userId`/`tenantId` for anonymous rejections — sentinel vs nullable-migration (step 2). Sentinel chosen by default; flag if the team prefers nullable columns.
- **SQL rewrite is behavior-sensitive:** `Prisma.sql` composition of CTEs (`query.ts:189-226` has a multi-CTE query with `$${paramIndex}` LIMIT/OFFSET) is fiddly; the `paramIndex` arithmetic must be replaced correctly or pagination breaks. Mitigation: port one search path at a time, each guarded by its existing tests; keep result-equality tests strict.
- `depthSearch.ts`/`ragSearch.ts` may have additional dynamic fragments not fully quoted in the audit; re-read them fully before editing (the audit cites line ranges, not the whole file).

## Out of Scope
- The auth mechanism itself (Story 01) — this story instruments it.
- Adding pgvector/semantic search (Story 07 covers the branding/doc side of S13; the SQL here stays FTS).
- A log-shipping/monitoring pipeline beyond writing `AuditLog` rows.

## Reviewer Feedback

### Reviewer Feedback / Codex (regression) — FALLBACK: self (Opus 4.8); reason: Codex CLI hit its usage limit.
Regression review (full depth against actual files):
1. **`logAgentAction(ctx, …)` signature takes an `AgentContext` (`audit.ts:10`)** — auditing auth *rejections* (where no `ctx` exists yet) doesn't fit the current signature. Either overload it to accept a partial principal, or add a separate `logAuthEvent` helper. Folded into step 2 (the FK/sink decision also covers this).
2. **`logAgentAction` is currently called only on mutation paths** (its doc `:5` "Only logs mutations") — confirm via grep where it's invoked before adding it to the hot read path; threading it into `withAgentAuth` is new wiring, not a modification of existing call sites. No existing caller breaks.
3. **The search refactor touches 4 files with subtly different patterns** — `query.ts` has both an ILIKE keyword path (`:64-108`) and the FTS CTE path (`:189-249`); `depthSearch.ts:207` and `ragSearch.ts:75-98` each have their own. Port one at a time, each behind its own (new, real-SQL) test. A single sweeping rewrite risks a silent row-set change in one path. Folded.
4. **`Prisma.InputJsonValue` import** for the `details` field write — ensure the generated-client path (`@/generated/prisma/client`, per the codebase's custom output) is used, not `@prisma/client`. Minor; folded as a note.
No regression beyond the signature/threading concerns; the FK issue (Gemini) is the real correctness bug.

### Reviewer Feedback / Gemini (integration) — live (gemini-3.1-pro-preview, plan mode; after a quota retry)
Integration breakage:
1. **AuditLog FK constraint failure:** `prisma/schema.prisma:575/577` defines a mandatory `AuditLog.user` relation. Inserting a sentinel `userId: "anonymous"` triggers a Postgres FK violation; since `logAgentAction` swallows errors, the rejection audit rows **silently fail to persist**, defeating the AC. Must make `userId` nullable (migration) or use a non-FK sink.
2. **Latency on high-volume read paths:** adding `await logAgentAction(...)` to `withAgentAuth` means a synchronous `audit_logs` INSERT for **every** agent request incl. `kb-query` reads — a significant perf regression for a latency-sensitive KB.
3. **Search SQL parameter mapping risk:** the manual `paramIndex` (`query.ts:189-226`, `depthSearch.ts:207-231`) refactor must wrap SQL fragments (e.g. `scopeWhere`) in `Prisma.sql`/`Prisma.raw`, not interpolate them as string *parameters*, or you get syntax errors / wrong results.
4. **Inaccurate test coverage:** `src/__tests__/lib/search/depthSearch.test.ts:116-130` mocks `prisma.block.findMany`, but the impl uses `$queryRawUnsafe` — the existing tests **do not exercise the SQL path** and won't catch a CTE regression.

**Disposition:** Items 1 (FK→nullable/sink) and 2 (fire-and-forget/sample success audits) folded as MUST-FIX into AC + step 2. Item 3 reinforced in step 4. Item 4 → the test strategy now mandates real-SQL integration tests and explicitly disclaims the existing mocked tests as a guard.

### Reviewer Feedback / Kimi (runtime) — FALLBACK: self (Opus 4.8); reason: Kimi CLI returned HTTP 429 usage-limit.
Runtime breakage / missed bugs:
1. **The FK violation (Gemini item 1) is a *silent* runtime failure** — confirmed by reading `audit.ts:23-26`: the `catch` logs to console and returns, so a failed `auditLog.create` produces no thrown error and no row. In production this means "we added audit logging" while zero rejection rows ever land. This is the worst kind of bug (looks done, isn't). The nullable-column migration is the clean fix. Reinforced as the headline issue.
2. **Fire-and-forget audit writes have their own runtime caveat:** if you `void logAgentAction(...)` without awaiting, an unhandled promise rejection could surface in strict runtimes — keep the internal try/catch (it already swallows), so the floating promise never rejects. Safe given the existing swallow. Folded.
3. **`Prisma.sql` composition + `$queryRaw` is injection-safe**, but `Prisma.raw(userValue)` is NOT — the refactor must use `Prisma.raw` ONLY for constant SQL keywords (e.g. `'PRIVATE'` scope literal), never for any value derived from input. The whole point of S12 is to remove `Unsafe`; reintroducing `Prisma.raw` on a dynamic value would re-open the exact hole. Folded as an explicit guard in step 4.
4. **`ts_headline`/`plainto_tsquery` with a bound parameter behaves identically** to the current `$queryRawUnsafe` with `$1` — the FTS text was already a bound param, so removing the cosmetic `replace(/[<>]/g,"")` doesn't change tsquery parsing (Postgres `plainto_tsquery` sanitizes operators itself). No behavior change for legitimate queries. Confirmed.
5. **Race/ordering:** auditing after the handler runs vs before — for mutations, audit AFTER the mutation succeeds (so you don't log writes that then failed), matching the cross-repo "derive success from terminal state" theme. For auth, log at the decision point. Folded as a note.
The runtime-critical finding is item 1 (silent FK no-op) — already elevated; item 3 (no `Prisma.raw` on values) prevents re-opening S12.

## Revision History
- 2026-06-13 — Initial draft
- 2026-06-13 — Reviewed (Gemini live; Codex + Kimi self-fallback due to usage-limit/429). Folded MUST-FIX: the `AuditLog.userId/tenantId` **FK** (not just NOT NULL) means a sentinel principal silently FK-violates → make columns nullable or use a non-FK security-event sink, and PROVE persistence for anonymous rejections; fire-and-forget/sample success-audits to protect `kb-query` latency; `Prisma.sql` refactor must never use `Prisma.raw` on a value (would re-open S12); existing mocked search tests do NOT cover the raw-SQL path → add real-SQL integration tests. Status → Reviewed — awaiting approval.
