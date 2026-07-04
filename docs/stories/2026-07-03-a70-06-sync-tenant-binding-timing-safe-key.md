# A70-06 — Bind the sync service key to a tenant + timing-safe comparison

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; reviewed round 1)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** 2026-06-13 hardening audit stories (`2026-06-13-audit-01-real-auth-on-agent-path.md`, `-05-sync-cors-and-shared-rate-limit.md`) hardened adjacent paths but left this gap. ExpTube is the sole sync hub (Option C one-way sync, `SKB-52.12`); worker contract in `docs/cross-platform/AGENT-PROMPT-EXPTUBE.md`.

## Problem
The experiment-sync ingest endpoint authenticates with ONE global shared secret
and then trusts a client-supplied `X-Tenant-ID` header to decide which tenant's
data to mutate. Any holder of `SYNC_SERVICE_KEY` can create/update/archive/
delete experiment pages in ANY tenant by changing a header. Additionally the
key comparison is a plain `===` (byte-wise early exit — timing side channel);
the agent `skb_` key path does this correctly, this hand-rolled route does not.
The sibling reconcile route has the identical pattern and must be fixed in the
same story.

## Evidence
- `src/app/api/sync/experiments/route.ts:52` — `return token === SYNC_SERVICE_KEY;`
- `src/app/api/sync/experiments/route.ts:58-64` — `resolveTenantId()` returns
  `req.headers.get("X-Tenant-ID") || process.env.DEFAULT_TENANT_ID || null`.
- `src/app/api/sync/reconcile/route.ts:9-26` — identical `authenticateSync` +
  `resolveTenantId` pair (same spoofing hole, same `===`).
- `src/lib/chemistryKb/reconciliationSync.ts:95` — outbound calls keyed on
  `EXPTUBE_API_KEY || SYNC_SERVICE_KEY`.
- No `crypto.timingSafeEqual` anywhere in the repo (grep = 0 hits).
- **Live-caller reality:** ExpTube's worker sends ONLY
  `Authorization: Bearer {SYNC_SERVICE_KEY}` + `X-Source` — NO `X-Tenant-ID`
  (`docs/cross-platform/AGENT-PROMPT-EXPTUBE.md:39-122`). Today it works purely
  via the `DEFAULT_TENANT_ID` fallback. Any change here must keep that flow
  alive.

## Scope
1. Key→tenant binding: introduce `SYNC_SERVICE_KEYS` as a mapping of key →
   tenantId (delimiter must be colon-SAFE: split on LAST colon, or use
   `key@tenantId` / JSON — secrets may contain `:`). Fail fast at boot on
   malformed pairs (a silently dropped pair = that tenant's sync 401s).
   The authenticated key determines the tenant; `X-Tenant-ID` is only honored
   if the key is explicitly marked multi-tenant, otherwise it is rejected when
   it contradicts the binding.
2. **Legacy compatibility (both routes):** the existing single
   `SYNC_SERVICE_KEY` env var remains accepted and is implicitly BOUND to
   `DEFAULT_TENANT_ID` — that binding is what a tenant-header-less request
   resolves to. The "no silent default" rule applies only to NEW mapped keys.
   This resolves the otherwise-fatal conflict: ExpTube's live worker sends no
   tenant header and must keep working unmodified. Retire the legacy var only
   in a later coordinated cutover with the ExpTube deployment.
3. Apply the same auth + tenant-resolution change to
   `src/app/api/sync/reconcile/route.ts` (identical pattern) — one shared
   helper, not two copies. Outbound `reconciliationSync.ts` key usage is
   unaffected but verify env still resolves after any renaming.
4. Length-checked `crypto.timingSafeEqual` for key comparison. When checking
   against a key map: hash-then-compare or constant-shape iteration — do NOT
   early-exit across candidates (leaks which key prefix matched); length
   mismatches must not throw (guard before comparing).
5. Tests: wrong key 401; legacy key + no header → writes land in
   `DEFAULT_TENANT_ID`; mapped key + contradicting header → 403; mapped key +
   no header → bound tenant; malformed `SYNC_SERVICE_KEYS` fails boot.
   NOTE: the route captures env at module load (`route.ts:27`), so tests need
   `vi.resetModules()` + dynamic re-import per case.

## Acceptance criteria
- AC1: A sync key bound to tenant A cannot mutate tenant B regardless of headers.
- AC2: For NEW mapped keys, requests with no resolvable tenant are rejected;
  the legacy `SYNC_SERVICE_KEY` continues to resolve to `DEFAULT_TENANT_ID`
  (documented, warned at boot) so the live ExpTube worker keeps syncing.
- AC3: `/api/sync/reconcile` enforces the same rules via the shared helper.
- AC4: Legacy single-key deployments keep working on BOTH sync routes with a
  logged warning.
- AC5: tsc + vitest green; new route tests per Scope 5.

## Affected files (expected)
- `src/app/api/sync/experiments/route.ts`, `src/app/api/sync/reconcile/route.ts`
- new shared `src/lib/sync/syncAuth.ts` helper
- `src/lib/env.ts` (new var validation), docs for ExpTube deployment

## Verification
Route unit tests with mocked keys (module-reset per case); manual curl matrix
(right/wrong key × present/absent/foreign header) against both sync routes.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** ExpTube's live worker sends NO `X-Tenant-ID` (`AGENT-PROMPT-EXPTUBE.md:39-122`); original AC2 ("reject when no tenant resolvable, no silent default") vs AC3 ("legacy keeps working") were in direct conflict — literal AC2 would 422 every live sync. → Fixed: legacy key is explicitly bound to `DEFAULT_TENANT_ID`; strict resolution applies to new mapped keys only.
- **(Critical)** `/api/sync/reconcile/route.ts:9-26` has the identical auth+tenant pattern and was out of scope; retiring the legacy env var would 401 reconcile. → Fixed: reconcile brought into scope via shared helper; cutover coordinated.
- Colon in secrets breaks `key:tenant` parsing → split-on-last-colon/JSON + fail-fast boot validation. → Fixed (Scope 1).
- Module-load env capture defeats naive route tests → `vi.resetModules()` noted (Scope 5).
- `timingSafeEqual` over a key map: no early-exit across candidates; per-candidate length guard. → Fixed (Scope 4).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** `GET /api/sync/reconcile` (`route.ts:47-74`) returns the module-global `lastResult`/`activeSyncId` (`reconciliationSync.ts:74-75` — process singletons, not tenant-keyed) with no tenant filter: after key→tenant binding, tenant A's key reads tenant B's last-run counts/timing/syncId. → Scope amendment: key reconciliation state per tenant (or filter/deny the GET by the key's bound tenant); the shared auth helper must cover the READ path, not just POST tenant resolution.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): legacy-key→DEFAULT_TENANT_ID binding, reconcile route added to scope, colon-safe parsing, module-reset test note, key-map timing rules.
- 2026-07-03 — Round-2 GLM runtime review: reconcile GET cross-tenant state leak added to scope. Status: Reviewed (draft — not to be implemented yet).
