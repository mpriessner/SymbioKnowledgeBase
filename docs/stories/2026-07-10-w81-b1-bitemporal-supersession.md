# W81-B1 — Bitemporal claim edges + contradiction-driven supersession ("conclusions move as data moves")

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 81
- **Created:** 2026-07-10
- **Status:** Reviewed — awaiting owner approval (Codex + GLM; Gemini skipped)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Depends on **W81-A2** (`CONTRADICTS` evidence edges are the trigger). Modeled directly on **Zep/Graphiti** (arXiv:2501.13956) — the single most reusable prior art; it runs on Postgres, no Neo4j needed. Feeds W81-B2 (time-travel) and W81-C (the updater acts on the `stale`/`contested` marks this produces). No RLS — thread `tenantId`.

## Problem / motivation
The owner's core requirement: raw data is immutable, but **the conclusions drawn from it change as the data underneath moves** — old conclusions should be superseded (not deleted) when newer sources contradict them, and the wiki should "keep the active knowledge up to date to the best of its knowledge." SKB's `DocumentVersion` captures *that a page changed* but has no notion of *which claim was invalidated by which newer fact, and when it became false in the world vs. when the system learned it*. Without a temporal model, the wiki can't reason about "this was true then, this is true now" or drive an automated update loop.

Research (§2) identifies the exact mechanism: a **bitemporal knowledge graph** (Zep/Graphiti). Each fact carries four timestamps; on new-source ingest the system finds semantically-related existing facts, LLM-checks for contradiction, and **invalidates the superseded fact by setting its `t_invalid` to the new fact's `t_valid`** — nothing deleted, old fact stays queryable but marked expired, newer information prioritized. That is precisely "conclusions move as data moves."

## Proposed change
**1. Four timestamps on every claim (bitemporal).** Extend `Claim` (W81-A2) with:
```
Claim {
  ...existing (id, tenantId, pageId, text, blockAnchor, status)...
  tValid      timestamptz,   // when the asserted fact became TRUE in the world
  tInvalid    timestamptz?,  // when it stopped being true (null = still valid)
  txCreated   timestamptz,   // when the SYSTEM recorded it (ingest time)
  txExpired   timestamptz?,  // when the system marked it superseded (null = live)
  supersededByClaimId String?,
  supersedeReason String?
}
```
- `tValid` sourced from the source's event date. **Migration/source path made concrete (Codex R1):** A1's `Source` today has only `ingestedAt` — so this story adds `Source.eventDate DateTime?` + `Source.datePrecision (EXACT|APPROX|UNKNOWN)` (a `~approx` marker cannot live in a bare `DateTime`), parsed from the filename/doc metadata (reuse `llm-wiki-builder`'s `timeline.py` convention). `Claim.tValid` falls back to `Source.eventDate` → else `txCreated` when unknown, with `datePrecision` carried onto the claim so the temporal-safety rule (§2) can treat approximate dates conservatively. `txCreated`/`txExpired` use **DB-generated** timestamps (`now()` inside the tx), not app clocks. **Backfill:** adding non-null `tValid`/`txCreated` to A2 claims already written requires a defaulting backfill (`tValid := txCreated := createdAt` for legacy rows) and updates to every A2 `Claim.create` fixture/caller — this is NOT silently additive; it's an explicit compatibility step listed in Affected files.

**2. Contradiction-driven supersession loop — INLINE path is deterministic-only (revised, Codex R1).** On each enrichment ingest (after W81-A2 writes claims + `CONTRADICTS` edges), B1's inline path performs **only high-precision, deterministic supersession**; everything ambiguous or embedding-based is deferred to W81-C1's triage queue (which owns candidate flagging — B1 has no finding store of its own, Codex R1). Concretely:
- **No pgvector in the inline path (Codex R1):** A1 embeds `SourceChunk`, not `Claim`; there is no claim vector. Inline B1 matches on an **exact scoped key**, not similarity. Semantic/embedding candidates are C1's job.
- **Scoped-key collision — `validPeriod` is NOT in the key (GLM R2 fix).** GLM caught that putting `validPeriod` in the collision key makes the future-effective path unreachable (same-key-to-collide contradicts different-period-to-supersede). So the **collision key is `(subject, relation, scope{experimentId, runId, method, units})`** — no period; a collision is same key + different object. `validPeriod`/`tValid` are then compared *separately* by the temporal rule below. Extraction confidence + scope persisted. Negation/modality/ranges/aliases the deterministic extractor can't resolve with high confidence are **not** auto-superseded — they become a C1 `CONTRADICTION_CANDIDATE`.
- **Trust gate (Codex R1):** a `CONTRADICTS` edge may drive supersession only if its `ClaimEvidence.validationState ∈ {EXACT, FUZZY}` and confidence ≥ threshold. An `UNVERIFIED` (hallucinated/unlocatable) quote **never** supersedes — enforced, per A2's rule.
- **Temporal safety + effective status (Codex R1 + GLM R2 fix):** supersession requires `newer.tValid > older.tValid` (**strict** — GLM: non-strict + `tValid` fallback to `txCreated=now()` lets unknown-date claims supersede on sub-second ingest order). A **historical late-arrival** (dated earlier, ingested today) does **not** auto-supersede — flagged, not applied. When either claim's `datePrecision = UNKNOWN`, B1 does **not** auto-supersede at all (defers to C1). **Status is derived, not flipped early (GLM R2):** a `Claim` is *effectively active* when `tInvalid IS NULL OR tInvalid > now()`. For a **future-effective** newer fact, the older claim keeps `status = ACTIVE` and only gets `tInvalid := newer.tValid` set (future) — it is not marked `SUPERSEDED`/`txExpired` until that valid-time passes (a lightweight scheduled flip, or the derived-status view, handles the transition). `txExpired`/`status=SUPERSEDED` are set *now* only when `newer.tValid ≤ now()`. A DB check enforces `tInvalid > older.tValid` so intervals can't invert.
- **On a confirmed present-effective supersession:** a **conditional** transition `UPDATE Claim SET status=SUPERSEDED, tInvalid=newer.tValid, txExpired=now(), supersededByClaimId=newer.id WHERE id=older.id AND status='ACTIVE' AND tInvalid IS NULL` (two concurrent jobs can't both win — Codex R1). **Locks acquired in sorted `scopedKey` order (GLM R2)** to prevent cross-key deadlock when one ingest touches multiple overlapping claims. Never UPDATE-in-place the fact text; never delete. Record a `ClaimSupersession` row with a **unique key** `(oldClaimId, newClaimId, reason)` for idempotency.
- **Concurrency + tenant + soft-delete:** the worker derives `tenantId` from the `EnrichJob` row (not `withAgentAuth`); every retrieval/join/FK is tenant-consistency-checked **inside the transaction**; soft-deleted pages/claims (`deletedAt`) are excluded so a trashed claim can neither supersede nor be marked contested.

**3. Page-level staleness marks — OWNED BY W81-C1, not B1 (revised, Codex R1).** To avoid two writers racing on `Page.properties.knowledgeStatus` (Codex flagged B1 and C1 both claiming it), **C1 is the single owner of the `contested`/`stale`/`fresh` mark.** B1's inline supersession instead emits a durable signal C1 consumes (or, when C1 isn't yet built, B1 enqueues a minimal `pendingContested` marker). When it does write status, the update is an **atomic `jsonb_set`** (never a read-modify-write of the whole `properties` object, which Prisma JSON writes would clobber — Codex R1), and it must **not** naively bump `Page.updatedAt` in a way that trips `pageTree.ts`'s `updatedAt > summaryUpdatedAt` stale-summary heuristic. **`contested` false-positive guard (Codex R1):** because a71-13 does complete-body replacement, if the new claim already renders in the updated body the page is *not* contested — the condition is "an ACTIVE claim was superseded by a source not reflected in the current body," verified against the body, and there is an explicit transition back to `fresh` after re-synthesis/approval so the mark can't become permanent.

**4. No destructive writes.** All supersession is additive (flip flags, set timestamps, insert). The immutable-source guarantee (W81-A1) plus supersede-not-delete here means the full history — what was believed, from what source, when it became false — is always reconstructable (basis for W81-B2 time-travel).

## Affected repos & files
**SymbioKnowledgeBase (only):**
- `prisma/schema.prisma` — bitemporal columns on `Claim`; `ClaimSupersession` table; `Page.properties.knowledgeStatus` usage (additive migrations).
- `src/lib/knowledge/supersession.ts` — new: similarity retrieval + structural `(subject,relation)` collision check + supersede transaction.
- `src/lib/agent/enrichment/applyPlan.ts` — call supersession after claim persistence.
- `src/lib/knowledge/subjectRelation.ts` — new: cheap deterministic extraction of `(subject, relation, object)` triples from a claim for collision detection.

## Out of scope
- The expensive contradiction *resolution* + page re-synthesis (W81-C2) — B1 marks, does not rewrite.
- The time-travel query surface (W81-B2).
- The background worker scheduling (W81-C1) — B1's supersession runs inline on ingest; the worker later re-scans historically.

## Acceptance criteria
1. Every `Claim` carries four timestamps; `tValid` derives from the source event date (with `~approx` fallback), `txCreated` = ingest time.
2. Ingesting a source that contradicts an existing active claim (same subject+relation, different object) sets the older claim `SUPERSEDED` with `tInvalid = newer.tValid`, `txExpired = now()`, `supersededByClaimId` set — and the older claim is **not deleted** and remains queryable.
3. The structural `(subject,relation)` collision check runs **without an LLM call** and correctly supersedes on a clear collision; ambiguous cases are flagged (not auto-superseded) for W81-C escalation.
4. A page whose superseded claim is not reflected in its body is marked `contested`.
5. Every supersession writes a traceable `ClaimSupersession` audit row.
6. All retrieval + writes are `tenantId`-scoped; cross-tenant claims never participate in a supersession.

## Verification plan
- Unit: `(subject,relation)` extraction + collision; supersede transaction sets exactly the right fields; newer-wins ordering; ambiguous → flag-not-supersede.
- Integration: seed "yield was 72%" (source A, dated May) → ingest "yield was 87%" (source B, dated June) → assert A superseded by B, both rows present, page `contested`.
- Property: no code path deletes or UPDATE-in-places a Claim's `text`.

## Regression risks
- **Over-eager supersession** from a naive `(subject,relation)` extractor could wrongly invalidate correct claims — keep the deterministic check conservative (high precision), route anything ambiguous to human/frontier review rather than auto-superseding. This is the key correctness risk.
- **Embedding dependency:** similarity retrieval needs W81-A1 embeddings present; degrade to `CONTRADICTS`-edge-only + exact `(subject,relation)` match when embeddings are missing.
- **Temporal skew:** `~approx` source dates make `tValid` fuzzy; supersession on overlapping-but-uncertain valid-times could misorder. Prefer `txCreated` (ingest order) as a tiebreaker when `tValid` is approximate.
- **Ingest latency:** inline similarity + collision adds work per ingest; keep the LLM out of B1's path (structural only) — expensive checks are W81-C's job.

## Review
Run through `/story` (Codex + GLM). Ask review to stress the false-supersession risk (precision of the deterministic collision check), the `tValid` approximate-date tiebreaker, and whether supersession should ever be inline vs always deferred to the W81-C worker.

## Lifecycle: duplicate / restore / purge (added — Codex R1)
- **Purge must not violate "never delete."** `Claim.pageId` FK uses `onDelete: Restrict`; a hard-purge route must **archive** a page's claims (retain the belief history detached from the page, or block the purge) rather than cascade-delete them. Cascade would erase superseded history — a direct violation of the invariant. Flagged as an owner decision with "archive" recommended.
- **Restore** (`versioning.ts` restore snapshots only content/plainText) does not restore `knowledgeStatus` or the ACTIVE claim set — document that restoring an old body does **not** silently reactivate that version's claims; claim state is time-modelled, not snapshot-restored.
- **Duplicate** (`duplicatePage.ts`) copies neither properties nor claims today; a duplicated concept starts with **no claims and `fresh`** status (not a contested copy with no underlying contested claim). Explicit.

## Reviewer Feedback / Codex (round 1) — GPT-5.6, high reasoning
Codex raised ~11 critical issues; folded above. Headlines + resolution:
1. **Temporal ordering unsafe** (historical late-arrival auto-superseding current facts; `tInvalid` could precede `tValid`; future-effective). → `newer.tValid ≥ older.tValid` precondition; late-arrivals flagged not applied; DB check `tInvalid ≥ older.tValid`.
2. **Temporal fields had no source/migration path** (A1 Source has no event date; `~approx` ≠ DateTime; legacy A2 backfill). → Add `Source.eventDate`+`datePrecision`; backfill legacy claims; DB-generated tx timestamps; explicit fixture updates.
3. **Deterministic collision too imprecise for destructive change.** → Scoped key `(subject,relation,scope,validPeriod)`; persisted extraction confidence; ambiguous → C1 candidate, not auto-supersede.
4. **B1 didn't honor A2's UNVERIFIED rule.** → Trust gate: only `EXACT|FUZZY` + confidence-threshold evidence can supersede.
5. **pgvector over Claim not modeled** (A1 embeds SourceChunk, not Claim). → Inline path is exact-scoped-key only; embedding candidates deferred to C1.
6. **Concurrent enrichment → contradictory supersession chains.** → Conditional `WHERE status='ACTIVE'` transition; per-`(tenant,scopedKey)` serialization; unique `ClaimSupersession` key.
7. **Tenant isolation not structural** (vector filter-after-LIMIT; worker auth; soft-delete). → In-tx tenant-consistency checks; worker derives tenant from EnrichJob row; exclude `deletedAt`.
8. **`Page.properties` lost-update + invisibility.** → Atomic `jsonb_set`; single owner (C1) for `knowledgeStatus`; serializer/API contract change noted.
9. **A70 duplicate/version/purge undefined; purge could cascade-delete claims.** → Lifecycle section above; `onDelete: Restrict` + archive-not-delete.
10. **contested condition underspecified / false positives / never clears.** → Body-verified condition; explicit transition back to `fresh`.
11. **Refresh ordering/durability** (supersession vs a71-13 index fan-out; in-process Map scheduler). → Supersession commits before refresh enqueue; durability inherits a71-13/C1's advisory-lock resolution (flagged).

Nice-to-have folded: regression corpus (unchanged/omitted claims across versions, late arrival, future-effective, concurrent jobs, retry-after-crash, deleted pages, UNVERIFIED); extractor precision measured on a hard negative corpus (qualifiers/aliases/units/ranges/negation/modality); read-path indexes (tenant/status/temporal, supersession-chain, contested JSON expression index); deliberate existing-test updates; stable audit/idempotency + telemetry.

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): folded ~11 criticals — inline path is deterministic-scoped-key-only (no vector), temporal-safety preconditions, UNVERIFIED trust gate, single-owner contested via C1, atomic jsonb_set, lifecycle (duplicate/restore/purge) archive-not-delete, temporal-field source+backfill path.

## Reviewer Feedback / GLM (round 3) — glm-5.2, runtime lens (Gemini skipped per owner pref)
GLM found 6 runtime bugs; folded above:
1. **`validPeriod` in the collision key makes future-effective supersession unreachable.** → Dropped `validPeriod` from the key; periods compared separately by the temporal rule.
2. **Conditional UPDATE flips to SUPERSEDED/`txExpired=now()` immediately — no "ACTIVE until future tInvalid" state.** → Derived effective-status (`tInvalid IS NULL OR tInvalid > now()`); future-effective keeps older ACTIVE with future `tInvalid`, flipped later by a scheduled pass.
3. **`Claim.documentVersionId onDelete: Restrict` + `pruneOldVersions.deleteMany` (`versioning.ts:65-74`, called every save) FK-violates and rolls back user saves once a cited page passes 100 versions — and the "skip claim-referenced versions" fix was in no Affected-files list.** → Added to Affected files (below): `pruneOldVersions` must exclude versions referenced by any `Claim.documentVersionId`.
4. **Per-`(tenant,scopedKey)` serialization deadlocks on concurrent multi-claim ingests with overlapping keys (no lock ordering).** → Acquire locks in sorted `scopedKey` order.
5. **"Atomic `jsonb_set`, don't bump `updatedAt`" only achievable via `$executeRaw`; Prisma-update fallback clobbers `properties` + trips the stale-summary sweep.** → Specify `$executeRaw` with `jsonb_set` and no `updatedAt` bump (also applies to C1's contested write).
6. **Non-strict `≥` with `tValid`→`txCreated=now()` fallback lets unknown-date claims supersede on sub-second ingest order.** → Strict `>`; `datePrecision=UNKNOWN` never auto-supersedes (defers to C1).

## Affected repos & files (updated — GLM R2)
- `src/lib/livingDocs/versioning.ts` — `pruneOldVersions` must **skip `DocumentVersion` rows referenced by any `Claim.documentVersionId`** (else `onDelete: Restrict` FK-violates and rolls back every save past the 100-version retention limit). This is shared with A2 and MUST land with whichever story adds `Claim.documentVersionId`.
- Contested `knowledgeStatus` writes use `prisma.$executeRaw` with `jsonb_set(properties, …)` and do **not** touch `updatedAt` (avoid the `pageTree.ts` stale-summary heuristic). (Owned by C1; B1 defers.)
- A scheduled/derived-status mechanism to flip future-effective claims to `SUPERSEDED` when their `tInvalid` passes (small pg_cron job or a computed `effectiveStatus` read helper).

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): ~11 criticals folded (deterministic-only inline path, temporal safety, scoped-key precision, UNVERIFIED trust gate, single-owner contested, lifecycle archive-not-delete).
- 2026-07-10 — Round 3 (GLM-5.2 runtime; Gemini skipped): 6 runtime bugs folded (validPeriod-out-of-key, derived effective-status for future-effective, pruneOldVersions FK fix into Affected files, sorted-scopedKey lock ordering, $executeRaw jsonb_set, strict-`>` + UNKNOWN-defers). **Status: Reviewed — awaiting owner approval.** Nothing implemented.
