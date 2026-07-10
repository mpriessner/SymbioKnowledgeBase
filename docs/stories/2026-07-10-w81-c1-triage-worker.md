# W81-C1 — Staleness/contradiction triage worker (24/7 local Ollama 7B, structural + embedding)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 81
- **Created:** 2026-07-10
- **Status:** Reviewed — awaiting owner approval (Codex + GLM; Gemini skipped)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** The "sleeping updater" cheap tier. Depends on **W81-B1** (bitemporal claims + supersession primitives it reuses). Produces the flagged work-list that **W81-C2** (frontier re-synthesis) and **W81-C3** (human approval) consume. Model tiering formalized in **W81-D2**. No RLS — thread `tenantId`.

## Problem / motivation
The owner wants "an open-source model working 24/7 on cleaning up the wikis and flagging which ones need updating… going through a lot of data locally on the server… and just when it finds something urgent to be updated, we activate the very expensive model." This is the cheap-triage tier of a two-tier maintenance loop: a continuously-running local model that does the **cheap, embarrassingly-parallel** work (staleness flagging, source-to-concept tagging, dedup, contradiction *candidate* surfacing) and escalates only genuine hard cases upward.

Research (§4, §5) validates this precisely: **staleness detection should be structural, not embedding-similarity-based** (arXiv:2606.26511) — a `(subject, relation)` collision with a newer differing object supersedes the older, cheaply and deterministically, no frontier model needed. A 7B-class local model (Llama-3.x-8B / Qwen-2.5-7B via Ollama) reliably handles tagging, dedup, and contradiction-candidate flagging; RouteLLM-class economics show routing ~85% of work to the cheap tier lands near **half** the frontier-everywhere cost. This story builds *only* the cheap tier + the flagging; it never calls a frontier model and never rewrites a page.

## Proposed change
**1. Deployment: a bounded, externally-scheduled sweep — NOT a `while(true)` daemon (revised, Codex R1).** SKB has **no durable worker infrastructure** (the only background mechanism is `aggregationRefresh.ts`'s non-durable in-process `Map`+`setTimeout`), and the Next.js app has no persistent process. So C1 follows the **existing bounded-run convention** (`scripts/agent-sweep.ts` already does externally-scheduled, budgeted per-tenant runs) invoked by cron/pg_cron on a cadence — each run is **time/row-budgeted and exits**, never an unbounded loop. The durable `EnrichJob`-style queue (from A2) and a new `TriageRun` row carry state across runs.
- **Per-pass keyset cursors (Codex R1):** a single `lastScannedClaimId` is wrong — Claim ids are UUIDs (not chronological) and the four passes traverse different domains (claims, sources, pages, pairs). Each pass keeps its own keyset watermark `(txCreated|createdAt, id)` plus a per-run high-water mark, so rows inserted mid-scan are picked up next run and a resume never skips or double-counts.
- **Crash consistency (Codex R1):** cursor advances **after** findings for that batch commit, in the same transaction as the finding writes, so a crash re-does a bounded batch rather than losing or duplicating it.

**2. Four cheap passes (all local-7B or pure-deterministic, no frontier):**
- **(a) Structural staleness** — for every ACTIVE claim, extract the scoped key (reuse W81-B1's `subjectRelation.ts`) and detect collisions with newer claims/sources not yet reflected on the page. Deterministic. **Emits a `STALE` finding and (as the single owner) sets `Page.properties.knowledgeStatus=contested` via atomic `jsonb_set`** — see §3 on why this is C1's job, not B1's.
- **(b) Source-to-concept tagging** — when new `Source`s arrive (W81-A1), the 7B model tags **which existing concept pages each new source is relevant to** (classification, not synthesis), upserting `SourceRelevance { tenantId, sourceId, pageId, score, modelDigest, taggedAt }` **unique on `(tenantId, sourceId, pageId)`** (idempotent re-run — Codex R1). The owner's "tag the new sources that need to be considered" — the hand-off list to the expensive model.
- **(c) Dedup / near-duplicate** — embedding near-duplicate detection across concept pages (pgvector), flags `possible-duplicate` **canonicalized** pairs `(min(id),max(id))` so `(A,B)` and `(B,A)` can't become two findings (Codex R1). Never auto-merges.
- **(d) Contradiction candidates** — embedding-retrieve semantically-near claim pairs, cheap-model asks only "do these disagree? yes/no/maybe" — surfaces canonicalized candidates; does **not** resolve them. (This is where B1's deferred ambiguous cases land.)

**3. Output = findings + two durable inferred-knowledge writes; NEVER a wiki-page BODY (reframed, Codex R1).** The earlier "only populates a queue" claim was internally contradictory — marking a page `contested` and writing `SourceRelevance` are durable writes. The accurate boundary: **C1 never edits a page's body/blocks.** It owns three durable outputs: `TriageFinding`, `SourceRelevance`, and (as sole owner) the `knowledgeStatus` mark. `TriageFinding { tenantId, kind, pageId?, claimId?, sourceId?, severity, evidence(json ≤ cap), fingerprint, status: OPEN|ESCALATED|DEFERRED|DISMISSED|RESOLVED, modelDigest, createdAt }` with a **unique `fingerprint`** (`sha256(kind + canonical participants + scopedKey)`) so a re-scan can't recreate an existing OPEN/ESCALATED finding indefinitely (Codex R1). `DEFERRED` is a real state for Ollama-down deferred work (Codex R1). Every FK (`pageId`/`sourceId`/`claimId`) is tenant-consistency-checked in-transaction; `onDelete` semantics are explicit (`SetNull` on page/source purge, retaining the finding's display evidence). Soft-deleted pages/blocks (`deletedAt`) are excluded from every scan.

**4. "Urgent" gate + at-most-once escalation (owner's constraint; Codex R1).** Only findings past a configurable severity/confidence threshold are marked `ESCALATED` (threshold/cadence in W81-D2 config). But `ESCALATED` ≠ C2 running: C2 consumes via an **atomic lease/claim** (`UPDATE ... WHERE status='ESCALATED' RETURNING`) with one finding → one frontier job, so duplicate triage output can't fan into duplicate expensive-model calls.

**5. Local model integration (pinned + resilient, Codex R1).** Ollama reached by a **service name** (`OLLAMA_BASE_URL`, e.g. `http://ollama:11434` in Compose, or `host.docker.internal` in dev) via the OpenAI-compatible path. Model **pinned by digest**, not a mutable tag — the resolved model digest is recorded on every finding/relevance row so a model change is auditable and selectively recomputable; readiness checks the *configured model is loaded*, not merely port reachability. If Ollama is unreachable, deterministic pass (a) + embedding pass (c) still run; model passes (b)+(d) write `DEFERRED` work items (not silently skipped, not blocking the cursor) retried next run — the 24/7 promise survives Ollama restarts.

**6. Weekly health-check digest** (Slite pattern) — a scheduled rollup of OPEN findings per tenant (contradictions, orphans, stale, duplicates) surfaced as a notification/report, so the owner sees KB health without opening the queue.

## Affected repos & files
**SymbioKnowledgeBase (only):**
- `prisma/schema.prisma` — `TriageRun`, `TriageFinding`, `SourceRelevance` tables + enums (additive migrations).
- `src/workers/triageWorker.ts` — new: the long-running loop + cursor.
- `src/lib/triage/staleness.ts`, `tagging.ts`, `dedup.ts`, `contradictionCandidates.ts` — new: the four passes.
- `src/lib/llm/ollamaClient.ts` — new: local-model client (OpenAI-compatible) with reachability fallback.
- `src/lib/triage/healthCheck.ts` — new: weekly digest.
- `docker-compose.yml` / run scripts — the worker service + optional Ollama service.
- `src/app/api/agent/triage/findings/route.ts` — new: list/read the queue (consumed by C2/C3).

## Out of scope
- Frontier re-synthesis of flagged pages (W81-C2).
- Human approval UI / applying changes (W81-C3).
- Auto-merging duplicates or auto-resolving contradictions — the worker only flags.
- The model-tier config surface (W81-D2 owns it; C1 reads it).

## Acceptance criteria
1. A background worker scans a tenant's wiki on a cadence, is idempotent + resumable via a cursor, and never blocks the request path.
2. Structural staleness (a) detects `(subject,relation)` collisions with **no LLM call** and marks affected pages `contested`.
3. Source-to-concept tagging (b) writes `SourceRelevance` rows linking each new Source to the concept pages it's relevant to, tagged by the local model.
4. Every pass emits `TriageFinding` rows; the worker **never writes to a wiki/concept page body** (flag-only).
5. Only findings above the configured severity threshold are marked `ESCALATED`; the rest wait — verifiable by config change altering escalation volume.
6. Ollama-down: deterministic + embedding passes still run; model-dependent passes degrade to deferred, worker does not crash.
7. All scans + writes are `tenantId`-scoped; the worker never reads or tags across tenants.

## Verification plan
- Unit: cursor resume; staleness collision detection; severity gating; Ollama-down fallback; per-tenant isolation.
- Integration (local Ollama): ingest a contradicting source → worker flags a CONTRADICTION_CANDIDATE + marks page contested + ESCALATES if high severity.
- Manual: run the worker against seeded data, inspect `TriageFinding` queue via the API, confirm no page bodies changed.
- Cost check: measure cheap-tier token volume vs the (mocked) frontier escalation volume — confirm escalation rate is a small fraction (target <30%).

## Regression risks
- **Runaway escalation** (too-low threshold) would defeat the cost goal by sending everything to the frontier — threshold must default conservative and be measured; log escalation rate. This is the primary economic risk.
- **7B false positives** on tagging/contradiction candidates create review noise — candidates are advisory (flag, human/frontier confirms); keep the cheap model's role to recall-over-precision surfacing, not decisions.
- **Worker + Next.js sharing the DB** — heavy scan queries could contend with request traffic; batch + rate-limit, run off-peak cadence, use read paths that don't lock.
- **Multi-worker/multi-tenant concurrency** — two worker instances scanning the same tenant; guard with a per-tenant advisory lock (`pg_advisory_lock`), same limitation a71-04/a71-13 flag for regeneration.
- **Local model drift/unavailability** on the owner's server — the resilient-fallback (AC6) is load-bearing; the 24/7 promise must survive Ollama restarts.

## Review
Run through `/story` (Codex + GLM). Ask review to pressure-test the escalation-threshold economics (how to keep frontier volume low without missing urgent updates), the flag-only boundary (worker must never write page bodies), and whether the four passes should be one worker or separate schedulable jobs.

## DB contention, locking & cross-writer safety (added — Codex R1)
- **"Separate process" ≠ "never blocks the request path."** The worker shares the same small prod DB (docker-compose.prod.yml: ~1GB/2CPU, 20-conn app pool) and adds a second Prisma pool. Mandatory guardrails: bounded batch sizes, a small worker pool, per-tenant + global concurrency budgets, `statement_timeout` on scan queries, pauses between batches, indexed keyset queries — and **no DB transaction or checked-out connection held during an Ollama call**.
- **Advisory lock must use a pinned connection.** `pg_advisory_lock` is session-scoped; issued through the pooled Prisma client it can attach to a returned pool connection. Use a **dedicated pinned `pg` connection with `pg_try_advisory_lock`** (non-blocking) + `finally` release, or short **job leases** instead. A per-tenant lock only prevents worker/worker overlap — it does **not** serialize C1 against B1's request-path supersession, source ingest, a page editor, or C2. Therefore every C1 output **rechecks its precondition atomically at commit** (claim still `ACTIVE`, page version unchanged) so C1 can't emit a STALE finding for a claim B1 just superseded, or mark contested a page a newer version already reflects.
- **`contested` side effect:** a Prisma `properties` update bumps `Page.updatedAt`, which `pageTree.ts:13` reads as `updatedAt > summaryUpdatedAt` → stale-summary work + mirror churn + "recently updated" reordering. Write `knowledgeStatus` without tripping that heuristic (dedicated timestamp or guarded update).

## Reviewer Feedback / Codex (round 1) — GPT-5.6, high reasoning
Codex raised ~14 critical issues; folded above. Headlines + resolution:
1. **No worker infra / Next.js has no persistent process.** → Bounded, cron-scheduled `agent-sweep`-style budgeted run, not a `while(true)` daemon.
2. **`lastScannedClaimId` not a valid cursor** (UUIDs; 4 domains). → Per-pass keyset watermarks `(txCreated,id)` + run high-water mark.
3. **Crash consistency/idempotency absent; no finding fingerprint.** → Cursor advances in the finding-write tx; unique `fingerprint`; `SourceRelevance` upsert key; canonicalized pairs.
4. **Ollama-down fallback conflicts with cursor; no deferred state.** → `DEFERRED` status; model passes defer without advancing past undone work.
5. **Advisory lock unsafe with Prisma pool** (session-scoped). → Pinned `pg` connection + `pg_try_advisory_lock` + `finally`, or job leases.
6. **Per-tenant lock doesn't serialize vs B1/ingest/editor/C2.** → Atomic precondition recheck at commit.
7. **"Separate process doesn't block" false** (shared 1GB/2CPU DB, 20-conn pool). → Batch/timeout/budget guardrails; no tx/connection held across Ollama calls.
8. **Tenant isolation not enforceable** (`SourceRelevance` missing `tenantId`; FK cross-tenant; pair participants in json). → `tenantId` on all rows; in-tx tenant-consistency checks.
9. **Delete `onDelete` semantics unspecified.** → `SetNull` on page/source purge, retain finding display evidence.
10. **"flag-only" internally contradictory** (writes `knowledgeStatus` + `SourceRelevance`). → Reframed: never writes page **bodies**; owns findings + relevance + the single `knowledgeStatus` mark.
11. **`Page.properties` doesn't exist yet; C1 can't compile pre-migration.** → Strict migration order (a71-13 → A1 → B1 → C1) restated.
12. **contested bumps `updatedAt` → false stale-summary work** (`pageTree.ts:13`). → Guarded status write.
13. **contested JSON overwrite + dual ownership (C1 vs B1).** → Atomic `jsonb_set`; C1 is the single owner (B1 defers).
14. **Escalation not at-most-once** (`ESCALATED` ≠ C2 running). → Atomic lease; one finding → one frontier job.

Nice-to-have folded: durable/idempotent weekly digest + recipient model (`Notification` needs `userId`); worker observability (heartbeat, cursor-stall liveness, vector latency); cap + version model-derived data (size limit, model digest, prompt/schema version); load/failure integration tests (two workers, death between output+cursor, Ollama timeout/missing-model/malformed JSON, request traffic during scans, cross-tenant ids in jobs); finding lifecycle/retention (RESOLVED/SUPERSEDED/EXPIRED + retention); reuse `scripts/agent-sweep.ts` budgeted-run shape.

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): folded ~14 criticals — bounded scheduled run (no daemon), per-pass keyset cursors, finding fingerprint + DEFERRED state, pinned-connection advisory lock + atomic precondition recheck, DB-contention guardrails, tenant-consistency, flag-only reframed to "never writes page bodies," single-owner contested via atomic jsonb_set, at-most-once escalation lease.

## Additional load-bearing constraints (GLM R2 — runtime)
- **Every `Page.properties` writer must use `jsonb_set` on its own subkey — not just C1.** A `jsonb_set` write and a full-column Prisma JSON write racing still lose data if the full-column write lands second. "Single owner of `knowledgeStatus`" is only enforceable if a71-13 (and any other `properties` writer) also writes via `jsonb_set` on *their* subkeys. This is a **cross-story invariant** to record in a71-13 and the epic index, not a C1-local fix.
- **`statement_timeout` must be `SET LOCAL` inside a transaction**, never a bare `SET` — SKB has no PgBouncer, so a bare `SET` on a pooled connection leaks the worker's aggressive timeout onto later request-path queries on the same recycled connection and kills user queries.
- **Advisory lock + work + unlock must share ONE connection.** Under `@prisma/adapter-pg` those are separate pooled checkouts, so `pg_try_advisory_lock`→work→`pg_advisory_unlock` issued as ordinary Prisma calls land on different connections and the lock is a silent no-op (two worker runs overlap). Use a dedicated raw `pg.Client` (or one interactive `$transaction` bound to a single connection) for the whole locked section.
- **Finding `fingerprint` uniqueness must be scoped to non-terminal statuses.** A global unique `fingerprint` P2002s (and silently drops) a *recurred* condition after it was `DISMISSED`/`RESOLVED`. Use a **partial unique index** on `fingerprint WHERE status IN (OPEN,ESCALATED,DEFERRED)`, or a reopen-on-conflict upsert, so a regression can be re-flagged.
- **Precondition recheck needs `SELECT … FOR UPDATE`, not SELECT-then-INSERT.** Otherwise B1's `ACTIVE→SUPERSEDED` flip commits in the TOCTOU gap and C1 emits a STALE finding for a just-superseded claim. Lock the claim row in the same tx that writes the finding.
- **Embedding passes (c)/(d) can't be keyset-resumed by similarity** (pgvector `<->` has no stable order). Resume them by the **scanned anchor-entity keyset** (`(createdAt,id)` over the claims/pages being examined) — the per-anchor vector search runs inside each batch; the watermark is over the entities, never the neighbor ordering. (AC1's "resumable" is thereby satisfiable for all four passes.)
- **DEFERRED resurrection is bounded** (backoff + `nextAttemptAt` + max retries) to avoid a per-tenant retry storm while Ollama is down; on success the DEFERRED item transitions to its real finding/relevance row; resurrection is processed before fresh model work each run.
- **Budget exit is cooperative, not a hard wall-clock kill** (mirror `agent-sweep.ts:146-155`): finish and commit the current batch (keeping the cursor-advance-in-same-tx invariant), release the advisory lock, `$disconnect`, *then* exit — never truncate mid-batch.
- **Worker gets its own small `connection_limit`** and a dedicated worker service in `docker-compose.prod.yml` (none exists today; app pool is `connection_limit=20` against a 1GB/2CPU DB). A second full 20-conn pool + a sustained pinned lock would starve the request path — cap the worker pool small (e.g. 2–4).

## Reviewer Feedback / GLM (round 3) — glm-5.2, runtime lens (Gemini skipped per owner pref)
GLM found 9 runtime bugs; all folded into the constraints above:
1. `Page.properties` lost-update both directions — single-owner unenforceable unless every writer uses `jsonb_set`.
2. `SET statement_timeout` leaks onto request-path via recycled pooled connections → `SET LOCAL` in a tx.
3. Advisory lock/work/unlock split across pooled connections is a no-op under `@prisma/adapter-pg` → one shared connection.
4. Global `fingerprint` uniqueness blocks re-detection after DISMISS/RESOLVE → partial unique index on non-terminal statuses / reopen-on-conflict.
5. Precondition recheck is SELECT-then-INSERT TOCTOU → `SELECT … FOR UPDATE`.
6. Embedding passes can't be keyset-resumed by similarity → resume by scanned anchor-entity keyset.
7. DEFERRED resurrection unspecified → bounded backoff + nextAttemptAt + status transition.
8. Hard wall-clock exit truncates unlock/disconnect + breaks cursor-in-tx invariant → cooperative finish-batch-then-exit.
9. Prod has no worker service + `connection_limit=20`; worker doubles the pool → explicit small worker connection_limit + dedicated service.

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): ~14 criticals folded (bounded scheduled run, per-pass keyset cursors, finding fingerprint + DEFERRED, pinned-connection advisory lock, DB-contention guardrails, flag-only reframe, single-owner contested, at-most-once escalation).
- 2026-07-10 — Round 3 (GLM-5.2 runtime; Gemini skipped): 9 runtime bugs folded (jsonb_set-for-all-writers cross-story invariant, SET LOCAL timeout, single-connection advisory lock, partial-unique fingerprint, FOR UPDATE precondition, entity-keyset resume for vector passes, bounded DEFERRED resurrection, cooperative budget exit, dedicated small worker pool). **Status: Reviewed — awaiting owner approval.** Nothing implemented.
