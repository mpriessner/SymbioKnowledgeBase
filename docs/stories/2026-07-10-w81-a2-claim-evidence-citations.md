# W81-A2 — ClaimEvidence citation model + enrichment-engine integration (claim→chunk, supports/contradicts)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 81
- **Created:** 2026-07-10
- **Status:** Reviewed — awaiting owner approval (Codex + GLM; Gemini skipped)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Depends on **W81-A1** (Source/SourceChunk store) and **a71-13** (the `/api/agent/pages/enrich` enrichment engine). This is the story that resolves the owner's **deferred provenance-granularity decision** (see below). Feeds W81-B1 (contradiction edges) and W81-A3 (drill-back UI). No RLS — thread `tenantId`.

## GRANULARITY DECISION (the deferred owner question, resolved here)
The owner deferred "claim/span-level vs document-level" to story review. **Recommendation, grounded in research + `/story`:**

> **Chunk/paragraph-level citations by default, with the quoted text + its SHA-256 as the durable anchor and char offsets as a re-locatable hint. Reserve sentence/span-level for explicitly high-stakes pages.**

Rationale (research §1): this is the NotebookLM / Perplexity / ReClaim operating point — the **best value-for-effort**. Document-level is near-useless for a "trust me, here's the receipt" wiki (user still has to hunt). Full sentence/char-span-for-everything is fragile: offsets break whenever a source is re-parsed, and sentence segmentation drifts on re-ingest. The durability lesson from every production system: **store the quoted string (and hash) as the source of truth; store chunk_id; store offsets only as a hint** — if re-ingestion shifts offsets, re-find the quote by hash/fuzzy match rather than trusting stale integers. Storing `supports`/`contradicts` relation from day one (eTracer pattern) is what makes the maintenance loop (W81-C) possible — contradiction edges are its trigger signal.

Escalation path (kept open, not built now): a per-page `provenancePrecision: CHUNK | SENTENCE` flag lets high-stakes pages opt into sentence-level anchoring later without a schema change.

## Problem / motivation
W81-A1 gives an immutable, chunked, addressable source corpus. But nothing links a wiki page's *assertions* back to it. a71-13's enrichment engine writes concept pages from raw text and returns a `change_note`, but it does **not** record which source chunk each statement came from — so the owner cannot "question the wiki and pull it from the raw data again." This story adds the claim→evidence layer and wires it into enrichment so citations are captured at authoring time (the only time the model still has the source in context).

## Proposed change
**1. `Claim` + `ClaimEvidence` tables.**
```
Claim {
  id, tenantId, pageId,          // the wiki/concept page this assertion lives on
  text,                          // the atomic assertion (one factual statement)
  claimKey,                      // = sha256(pageId + normalize(text) + documentVersionId)
                                 //   DETERMINISTIC identity → retries collapse (GLM R2)
  anchorTextSha,                 // sha256(normalize(text)); the body anchor is a TEXT match
                                 //   into Block.plainText, NOT a char offset into ephemeral
                                 //   markdown (GLM R2: page is Tiptap JSON, markdown not persisted)
  documentVersionId String,      // FK → DocumentVersion.id (real relation, onDelete: Restrict —
                                 //   pruner must skip versions referenced by claims; GLM R2)
  status: ClaimStatus            // ACTIVE | SUPERSEDED (W81-B1 flips this)
  createdAt
}
@@unique([tenantId, claimKey])   // claim-level idempotency (GLM R2)
ClaimEvidence {
  id, tenantId, claimId, chunkId (→ SourceChunk),
  matchedText,                   // the CANONICAL source substring actually found in the chunk
                                 //   (NOT the model's quote) — this is what gets hashed
  quoteSha256,                   // EXACT/FUZZY = sha256(normalize(matchedText));
                                 //   UNVERIFIED = sentinel sha256(claimId+':'+chunkId+':UNVERIFIED')
                                 //   NOT NULL — a NULL would defeat the unique index (GLM R2)
  chunkCharStart, chunkCharEnd,  // offsets WITHIN SourceChunk.text (hint; A1 offsets are within
                                 //   Source.rawText — DIFFERENT coordinate space, kept distinct)
  relation: EvidenceRelation,    // SUPPORTS | CONTRADICTS
  validationState: EvidenceValidation, // EXACT | FUZZY | UNVERIFIED (see gate below)
  confidence float,
  createdAt
}
// tenant-leading composite indexes (per-query isolation has no RLS backstop):
@@index([tenantId, claimId]); @@index([tenantId, chunkId])
@@unique([claimId, chunkId, quoteSha256])   // idempotent retry; quoteSha256 NOT NULL (sentinel for UNVERIFIED)
```
- A page's body still renders as normal Tiptap; `Claim` rows are a parallel index over the assertions on it. **Body anchoring (GLM R2):** the page is persisted as Tiptap JSON in `Block.content` (there is no durable markdown string to hold char offsets against), so a claim anchors to the body by **`anchorTextSha` re-matched against the block's `plainText`** — the same durable-text-anchor philosophy A1 uses for source chunks, applied to the body. W81-A3 renders `[1]` by locating the claim's text span in `plainText`, re-locating by fuzzy match after any re-save. Char offsets into "rendered markdown" were dropped.

**2. Enrichment-engine integration (the key wiring).** Extend a71-13's `enrich` flow so that when the LLM proposes a `ConceptAction`, it **also returns, per atomic claim, the chunk(s) and exact quote(s) it relied on** from the Source (W81-A1) being ingested. Concretely:
- **Atomic unit revised (GLM R2): `{page, DocumentVersion, Claim, ClaimEvidence, ledger}` commit in one `prisma.$transaction`; `Source`+`SourceChunk` are an idempotent pre-step, not inside that tx.** Rationale: A1 Sources are immutable + dedup-idempotent, so persisting them *before* the page tx cannot corrupt wiki state — an orphan Source is merely unused raw data (GC-able). A live page *without* provenance is the real hazard, so that is what the transaction protects. Order: (1) persist/dedup `Source`+`SourceChunk` → real `SourceChunk.id`s exist; (2) build the prompt referencing chunks by **`chunkIndex`** (a deterministic, prompt-time-stable handle — the LLM's returned `chunkId`-by-UUID problem, GLM R2, is avoided because apply resolves `chunkIndex`→persisted `id` within `(tenantId, sourceId)`); (3) run enrichment; (4) apply page+version+claims+evidence+ledger in one transaction. `dryRun: true` does steps 2–3 only with in-memory chunks, persists nothing, keeps a71-13's `{plan, applied, warnings}` contract.
- **`createDocumentVersion()` is NOT reused inside the tx (GLM R2).** `versioning.ts:99` opens its own `prisma.$transaction` and takes no tx-client — nesting it makes the uncommitted `Page` invisible to its connection → FK violation on `DocumentVersion.pageId` every write. Instead the apply transaction **inlines the version write on its own `tx` client**, re-implementing the three behaviors the helper provides: `computeTextDiff`, `nextVersion = max+1` **with a P2002 retry on `@@unique([pageId, version])`**, and retention pruning **deferred to after commit** (pruning is cleanup, not part of atomicity). **Pruning must skip any `DocumentVersion` referenced by a `Claim.documentVersionId`** (onDelete: Restrict) so the per-version snapshot the field guarantees is never dangled (GLM R2 — the default retention of 100 would otherwise silently delete referenced versions on re-enrich-heavy pages).
- The enrichment prompt is extended (additively to a71-13's ported prompt) to emit a `claims: [{text, evidence: [{chunkId, quotedText, relation, confidence}]}]` array alongside `body_markdown`. **Existing-claim contradiction (fixes AC3, Codex R1):** the prompt is *also* given the **active `Claim` ids + texts** of semantically-near existing concepts (not just their bodies), and a `contradicts` evidence item must name the **existing `claimId`** it disagrees with. A `CONTRADICTS` edge therefore attaches to the *existing* claim it refutes (the W81-B1 trigger), while `SUPPORTS` edges attach to the newly-written claims. New-body claims never carry a `CONTRADICTS` edge pointing at themselves.
- `applyPlan` (a71-13) is extended: **within the same transaction** that writes the page body + `DocumentVersion` + audit + ledger, decompose/persist `Claim` rows and `ClaimEvidence` rows. **Every relation (`claimId`, `chunkId`, `pageId`) is validated to belong to the same `tenantId` inside the transaction** — per-query filters are not enough (no RLS; Codex R1). Reuse the existing `createDocumentVersion()` helper (`src/lib/livingDocs/versioning.ts`) rather than re-implementing max-version+1; if its self-opened transaction prevents a single enclosing transaction, wrap the whole apply in an explicit `prisma.$transaction` and inline the version write. A quote-gate failure, FK error, or version collision **rolls back the whole write** — never a live body without provenance.

**3. The quote-validation gate (anti-hallucination; explicit states).** For each proposed evidence item, search the referenced `SourceChunk.text` for the model's `quotedText`:
- **EXACT** — found verbatim (after deterministic normalization): store the matched source substring as `matchedText`, hash it, record chunk offsets.
- **FUZZY** — found ≥ threshold (length-aware; a short/common quote needs a higher bar): store the **canonical matched source substring** as `matchedText` (never the model's paraphrase), hash *that*, mark `FUZZY`. The hash always anchors into real source text.
- **UNVERIFIED** — not locatable in the chunk: store the `Claim` with an evidence row at **chunk granularity, `matchedText = null`, `validationState = UNVERIFIED`, no hash, no offsets** — a real "this claim points at chunk X but we could not verify an exact span" record. Downstream UI (W81-A3) and contradiction logic (W81-B1) **must treat `UNVERIFIED` as unverified** (visibly flagged, never rendered as a trusted receipt). A fabricated quote is never stored as a hash anchor. `validationState` is the required, machine-checkable trust signal (Codex R1 — a mere `warnings[]` entry is not enough).
- **Normalization is specified, not implied:** Unicode NFC, whitespace-folded, case-preserving; offsets are Unicode code points; a minimum quote length gates FUZZY; repeated occurrences resolve to the first match with a logged ambiguity flag.

**4. Backwards compatibility.** Pages created before this story (or by paths other than enrich) simply have no `Claim` rows yet — the drill-back UI (W81-A3) shows "no captured sources" rather than erroring. A later backfill job can re-derive citations for legacy pages (out of scope here).

## Affected repos & files
**SymbioKnowledgeBase (only):**
- `prisma/schema.prisma` — `Claim`, `ClaimEvidence`, `ClaimStatus`, `EvidenceRelation` (additive migrations).
- `src/lib/agent/enrichment/enrichmentAgent.ts` (from a71-13) — extend the Zod schema + prompt to emit `claims[].evidence[]`.
- `src/lib/agent/enrichment/applyPlan.ts` (from a71-13) — persist Claim/ClaimEvidence; run the quote-validation gate.
- `src/lib/provenance/quoteMatch.ts` — new: normalize + fuzzy-match quote against chunk text, compute offsets/hash.
- If a71-13 is not yet implemented: this story carries a **minimal inline enrichment shim** (documented) so it is not hard-blocked — but the intended path is to extend a71-13.

## Out of scope
- Bitemporal supersession / auto-invalidation on contradiction (W81-B1 consumes the `CONTRADICTS` edges this creates).
- The drill-back read API + UI (W81-A3).
- Backfilling citations for pre-existing pages.
- Sentence-level anchoring (kept behind the `provenancePrecision` escalation flag).

## Async-vs-sync endpoint contract (decided — Codex R1)
Enrichment already risks ~60s (a71-13's 2×30s self-repair). Adding citation extraction pushes worst-case toward ~120s if done as a second pass — beyond a safe synchronous HTTP budget. **Decision: enrichment+citation runs as an async job backed by a durable table (GLM R2 — SKB has NO durable job infra; the only background mechanism, `aggregationRefresh.ts`'s in-process `Map`+`setTimeout`, evaporates on restart and is already flagged multi-worker-broken).** Add an `EnrichJob { id, tenantId, status: QUEUED|RUNNING|DONE|FAILED, request(json), result(json)?, error?, createdAt, updatedAt }` table (to Affected files). `POST /api/agent/pages/enrich` inserts a QUEUED row, returns a **discriminated** `{mode:'async', jobId, status}`; the W81-C1 triage-worker process (or a small dedicated poller) picks up QUEUED jobs — no in-memory queue. `GET /api/agent/pages/enrich/[jobId]` reads the durable row, so a completed job never polls as 404 after a cold start. **`dryRun` returns synchronously but under the same discriminator:** `{mode:'sync', plan, applied:[], warnings}` — so a caller branches on `mode` before parsing, never guesses between two shapes on one route. This is a **contract change to a71-13's planned synchronous response** — hard coordination point: a71-13 adopts the discriminated contract, or W81-A2 ships it as `/v2` leaving a71-13's sync `/enrich` citation-free. Citation extraction is a **second LLM pass over the already-written body** (not inline), so body quality is unaffected and passes parallelize across concepts.

## Backward-compatibility with a71-13 (decided — Codex R1)
`claims` is **optional** in the shared Zod schema so a71-13's existing fixtures/providers still validate, but the `enrich` *endpoint* enforces "citations required" at the service layer for W81-enabled tenants (a per-tenant/workspace `citationsRequired` flag). This is an explicit **schema+API version transition**, documented as such — not called "additive." a71-13's `ConceptAction` schema gains a versioned superset; its self-repair loop must not reject a plan merely for omitting `claims`.

## Migration ordering (decided — Codex R1)
Strict, each migration immutable once a consuming branch builds on it: **A70-rebased tree → a71-13 (`Page.properties`, `IngestLedgerEntry`) → W81-A1 (`Source`/`SourceChunk`, pgvector) → W81-A2 (`Claim`/`ClaimEvidence`)**. The "minimal inline shim" fallback in "Affected files" is **downgraded to a last resort** — it risks a second, conflicting enrichment implementation and migration; prefer waiting on a71-13.

## Acceptance criteria
1. An `enrich` ingestion produces `Claim` rows for the page's atomic assertions and `ClaimEvidence` rows linking each to the exact `SourceChunk`(s) it came from, with `matchedText` (canonical source substring) + `quoteSha256` for EXACT/FUZZY, tagged with `validationState`.
2. The quote gate stores one of three explicit states — EXACT / FUZZY (hash of the *canonical source substring*, never the model's paraphrase) / UNVERIFIED (no hash, chunk-granularity, machine-flagged). No fabricated quote is ever stored as a trusted anchor.
3. A `contradicts` evidence item attaches to the **existing `Claim` id** it refutes (passed into the prompt), producing a `CONTRADICTS` edge on the *old* claim — the W81-B1/C trigger. New-body claims carry only `SUPPORTS` edges.
4. A claim with no locatable span is stored `UNVERIFIED` at chunk-level, never dropped, never fabricated.
5. **Re-anchoring across Source versions:** because A1 Sources are immutable (byte-identical re-ingest returns the same Source; changed text mints a *new* Source + chunk ids), "offset drift" does not occur within a Source. When a *new* Source version supersedes an old one, a re-anchor pass re-finds each citation's `matchedText` by `quoteSha256`/fuzzy search in the new Source's chunks and writes **new** evidence rows (old ones retained, per immutability) — offsets are never trusted across versions. `chunkCharStart/End` are explicitly within-chunk coordinates, distinct from A1's within-`rawText` offsets.
6. The whole apply — Source+chunks, page body, `DocumentVersion`, `Claim`/`ClaimEvidence`, audit, ledger — commits in **one transaction or none**; a quote-gate/FK/version failure leaves no live uncited page. Retolerant to retry via the `@@unique([claimId, chunkId, quoteSha256])` idempotency key.
7. Every relation is validated tenant-consistent **inside the transaction** (a tenant-A evidence row cannot reference a tenant-B claim/chunk/page); negative tests cover nested reads and guessed UUIDs, not just top-level lists.
8. `dryRun: true` persists nothing — no Source, no ledger, no claims — preserving a71-13's dry-run contract.

## Verification plan
- Unit: quote-match/fuzzy threshold; hash stability; hallucinated-quote rejection; contradiction-relation capture; degrade-to-chunk path.
- Integration: ingest source A (creates cited claims) → ingest source B contradicting A → assert a `CONTRADICTS` evidence row exists.
- Manual: enrich a paste, open the page, confirm each line resolves to a real source quote.

## Regression risks
- **Prompt bloat / token budget:** asking the model to emit claims+evidence alongside body enlarges the a71-13 prompt (already ~40k-char, 2-call self-repair). Measure; consider a second pass (extract citations from an already-written body) if inline emission degrades body quality. Flag as design decision.
- **Latency:** citation extraction adds LLM work to an already ~60s worst-case enrich call (a71-13's 2×30s). May force the async-job pattern a71-13 already flags. Coordinate.
- **Hallucinated quotes** are the core risk to the whole "receipt" promise — the validation gate (AC2) is load-bearing, not optional; do not weaken it to "trust the model."
- **Claim decomposition drift:** re-enriching the same page could produce different atomic claims. Acceptable (each version is a snapshot) but note for W81-B time-travel.

## Review
Run through `/story` (Codex + GLM). Explicitly ask review to pressure-test the granularity decision above (is chunk+quote-hash the right default vs sentence-level), the inline-vs-second-pass citation extraction tradeoff, and the fuzzy-match threshold for the anti-hallucination gate.

## Reviewer Feedback / Codex (round 1) — GPT-5.6, high reasoning
Codex (regression lens) raised ~13 critical issues; all folded in above. Summary + resolution:
1. **Decomposition-drift snapshot was false** — claims didn't reference any version. → `Claim.documentVersion` FK to `DocumentVersion.version`.
2. **`DocumentVersion` doesn't capture oneLiner/properties/claims/evidence** → partial rollback; and a71-13 reinvents max-version+1 instead of reusing `createDocumentVersion()` (`versioning.ts`). → Reuse the helper; single transaction wraps page+version+claims+evidence+audit+ledger.
3. **`blockAnchor` not durable** (agent pages are one DOCUMENT block; saves re-mint block ids). → Dropped; anchor by validated body char-span, re-locatable by fuzzy re-match.
4. **Contradiction model couldn't satisfy AC3** — CONTRADICTS must attach to the *existing* claim, but plan attached it to the new body's claim; prompt supplied bodies not Claim ids. → Prompt now passes active Claim ids+texts; `contradicts` names the existing claimId.
5. **Write sequence allowed partially-applied uncited pages.** → All-or-nothing transaction + `@@unique([claimId,chunkId,quoteSha256])` idempotent retry.
6. **A1/ledger ordering broke dry-run + rolling upgrades** (dry-run would persist a Source; a71-13 ledger short-circuits before LLM so old inputs never get Sources). → Source ingest is transactional-at-apply; dryRun persists nothing; the two dedup records unified atomically.
7. **Tenant filtering insufficient** — bare claimId/chunkId links; missing tenant-leading indexes. → In-transaction tenant-consistency checks; `@@index([tenantId, …])`; negative tests for nested reads + guessed UUIDs.
8. **Quote gate had incompatible storage rules; fuzzy-hashing the model quote doesn't anchor.** → Explicit EXACT/FUZZY/UNVERIFIED states; FUZZY hashes the *canonical source substring*; UNVERIFIED is machine-flagged, never a trusted receipt.
9. **AC5 re-ingestion impossible under A1's immutability; offset coordinate-space collision.** → Re-anchoring happens across *Source versions* by hash/fuzzy; within-chunk vs within-rawText offsets kept as distinct fields.
10. **LLM budget understated (~120s); async breaks the sync contract.** → Decided async job contract + second-pass extraction; flagged as a71-13 coordination point.
11. **`claims` not backward-compatible with a71-13** (required breaks fixtures; optional allows uncited writes). → Optional in schema + service-layer `citationsRequired` flag; explicit version transition.
12. **Migration dependency underspecified; inline shim unsafe.** → Strict immutable order A70→a71-13→A1→A2; shim downgraded to last resort.
13. **(A1 defect) blanket append-only trigger breaks embedding backfill + tenant-delete cascade.** → Cross-referenced to W81-A1: immutability must protect `rawText`/chunk `text`+boundaries specifically, NOT block the nullable-`embedding` backfill or delete cascades. (Fix tracked in A1.)

Nice-to-have folded: granularity terminology tightened (it's atomic-claim + exact-span, fallback is chunk-level not "document-level"); deterministic normalization + offset units specified; claim/evidence output bounds to add at impl; copy/trash/purge behavior for claims flagged; source dedup-by-text-hash caveat (identical text, different provenance metadata) noted; regression verification expanded to migration-from-A70, a71-first ledger, dry-run, restore, duplicate/trash/purge, concurrent updates, max-size prompt.

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): folded ~13 critical regressions — contradiction-edge semantics, single-transaction apply, explicit quote-validation states, async job contract, tenant-consistency-in-transaction, migration ordering, cross-referenced A1 immutability-trigger fix.

## Reviewer Feedback / GLM (round 3) — glm-5.2, runtime-breakage lens
GLM verified actual signatures and found 7 runtime bugs the code-level pass missed; all folded in above:
1. **`createDocumentVersion()` cannot compose into the single apply transaction** (`versioning.ts:99` self-opens a tx, no tx-client param → nested FK violation on `DocumentVersion.pageId`; post-commit → violates AC6). → Inline the version write on the apply `tx`, re-implementing diff + `max+1` P2002-retry; defer pruning to post-commit.
2. **`Claim.documentVersion Int` dangled by `pruneOldVersions`** (`versioning.ts:59-76`, retention 100). → Real FK `documentVersionId` with `onDelete: Restrict`; pruner skips claim-referenced versions.
3. **`bodyOffsetStart/End` measured against ephemeral markdown never persisted** (body is Tiptap JSON in `Block.content`). → Anchor by `anchorTextSha` re-matched against `Block.plainText`; dropped markdown char offsets.
4. **`@@unique([claimId,chunkId,quoteSha256])` doesn't dedupe UNVERIFIED** (NULL `quoteSha256` distinct in Postgres). → `quoteSha256` NOT NULL; UNVERIFIED uses a deterministic sentinel hash.
5. **No claim-level idempotency** (retries mint new `Claim.id` UUIDs). → Deterministic `claimKey = sha256(pageId+normalize(text)+documentVersionId)` with `@@unique([tenantId, claimKey])`.
6. **LLM `chunkId` can't map to server-generated `SourceChunk.id`** (uuid at insert; chunks built in-memory pre-insert). → Persist Source+chunks as an idempotent pre-step; prompt references `chunkIndex`; apply resolves `chunkIndex`→persisted id within `(tenantId, sourceId)`.
7. **Async contract assumed durable job infra SKB lacks; two response shapes on one route.** → Durable `EnrichJob` table + worker-poller (no in-memory queue); discriminated `{mode:'async'|'sync', …}` response.

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-10 — Round 1 (Codex GPT-5.6 high): ~13 critical regressions folded (contradiction-edge semantics, single-transaction apply, explicit quote-validation states, async contract, tenant-consistency-in-transaction, migration ordering, A1 immutability-trigger cross-ref).
- 2026-07-10 — Round 3 (GLM-5.2, runtime lens; Gemini skipped per owner pref): 7 signature-verified runtime bugs folded (version-helper transaction composition, pruner-dangled version FK, Tiptap-vs-markdown body anchor, NULL-hash dedup hole, claim idempotency key, chunkIndex↔id mapping, durable EnrichJob table). **Status: Reviewed — awaiting owner approval.** Nothing implemented.
