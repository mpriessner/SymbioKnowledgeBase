# W81-A1 — Immutable Source + SourceChunk store (append-only, hashed, chunked, embedded)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 81
- **Created:** 2026-07-10
- **Status:** Reviewed (Codex; GLM pending) — awaiting owner approval
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Foundation for the whole W81 batch (see `2026-07-10-W81-EPIC-INDEX.md`). Consumes `a71-08` (document intake) and `a71-02` (experiment content sync) as source producers. Distinct from `FileAttachment` (which stores file *bytes* + metadata) — this story adds the *parsed, chunked, immutable text corpus* that citations anchor to. Rebase against current `main` (uncommitted A70 tree); thread `tenantId` (no RLS).

## Problem / motivation
The owner wants a two-layer system where the wiki's conclusions are mutable but the **raw input data is never modified**, and every wiki claim can be traced back to "pull it from the raw data again." SKB today has no first-class immutable source corpus: `FileAttachment` stores bytes + a `checksum` but not parsed/chunked text; `a71-13`'s ingest ledger stores only a `sha256` of raw input (dedup, no retrievable content); experiment sync writes narratives directly into pages with no preserved, addressable source unit. There is nothing a citation can point *at*.

Research (2024–2026) is unambiguous that durable provenance requires an **append-only source layer segmented into stable, addressable chunks** (event-sourcing pattern; NotebookLM segments docs into ~hundreds-of-token passages, each independently referenceable). Without this, claim-level citations (W81-A2), contradiction detection (W81-B1), and the triage worker (W81-C1) have no substrate.

## Proposed change
Add two immutable, append-only tables and a parsing/chunking/embedding pipeline. **Immutability is enforced in code + DB constraints, not just convention** — the owner's requirement is that raw data cannot be modified.

**1. `Source` (append-only).** One row per ingested raw artifact (a transcript, a pasted note, an uploaded PDF's extracted text, a synced experiment narrative).
```
Source {
  id, tenantId,
  kind: SourceKind  // DOCUMENT | TRANSCRIPT | NOTE | EXPERIMENT_SYNC | URL
  title, contentSha256, chunkerVersion, rawText (immutable, stored VERBATIM),
  ingestedAt, ingestedBy, correlationId
}
@@unique([tenantId, contentSha256, chunkerVersion])   // Codex R1: version in the key so a
                                                       // re-chunk mints a NEW Source (impossible if
                                                       // unique on text alone); id is (tenantId,id)
SourceOrigin {                 // Codex R1: same text, different provenance must NOT collapse
  id, tenantId, sourceId, originRef, kind, title, ingestedAt, ingestedBy
}                              // one Source (immutable content) ← N ingestion occurrences
```
- **No `updatedAt`, no update path.** The service exposes create + read only. **Immutability is a DB `BEFORE UPDATE OR DELETE` trigger — NOT Prisma middleware (Codex R1: Prisma 7 removed `$use`).** A `$extends` query guard gives friendly app-layer errors (defense-in-depth) but can't cover raw SQL / migrations / FK cascades, and embedding writes need raw SQL anyway (pgvector is `Unsupported("vector")`). **The trigger is scoped to protect `rawText` (Source) and `text`/`charStart`/`charEnd`/`chunkIndex` (SourceChunk) ONLY** — it must NOT block (a) the nullable-`embedding` async backfill `UPDATE`, nor (b) `ON DELETE CASCADE` from tenant deletion (Codex R1: a blanket trigger breaks both). Corrections = ingest a *new* Source, superseded at the wiki layer (W81-B1).
- **`rawText` is stored verbatim, no normalization** (Codex R1) — so char offsets into it are always valid. Any NFC/whitespace normalization happens only at compare-time in A2's quote match, never before storage.

**2. `SourceChunk` (append-only, the citation anchor).** Deterministic segmentation of `Source.rawText`.
```
SourceChunk {
  id, tenantId, sourceId,
  chunkIndex (0-based, stable), charStart, charEnd,   // Unicode CODE-POINT offsets into rawText
  text, textSha256,                                    // fingerprint, NOT a unique id (Codex R1)
  embedding Unsupported("vector(1536)")?,              // pgvector; nullable until embed pass
  createdAt
}
@@unique([sourceId, chunkIndex])   // chunk IDENTITY = (sourceId, chunkIndex), never textSha256
// tenant-consistent composite FK (Codex R1, no RLS): (tenantId, sourceId) → Source(tenantId, id)
@@index([tenantId, sourceId])
```
- **Deterministic chunking — fully specified (Codex R1):** pinned tokenizer + `chunkerVersion` (recorded on the Source), paragraph/heading-aware, ~500–800 token target, documented overlap size, hard-split behavior, trimming rule, and **half-open `[charStart, charEnd)` offsets in Unicode code points** (JS `slice()` uses UTF-16 units — the impl must map code points→UTF-16 so astral chars/emoji don't corrupt offsets; A2 requires code-point offsets). Same `rawText` + same `chunkerVersion` → byte-identical boundaries. Each chunk's `text` must be exactly recoverable as `rawText`'s `[charStart, charEnd)` slice.
- **`textSha256` is a content fingerprint, not an identifier** — repeated paragraphs/overlap legitimately produce identical text+hash; unique identity is `(sourceId, chunkIndex)`.

**3. Enable pgvector — ordered, backed-up, non-rollback-safe (Codex R1).** Migration order: (1) deploy a pgvector-capable image (`pgvector/pgvector:pg18`, PG18-matched) **before** any `CREATE EXTENSION IF NOT EXISTS vector`; (2) create tables; (3) create indexes. **Back up + test a copy of the `pgdata` volume before container recreation** (`/docker-entrypoint-initdb.d` does NOT initialize an existing volume). Rolling back to plain `postgres:18` after vector columns exist is **not** a safe rollback (old image lacks the extension lib). Non-Compose environments must also install pgvector server files — changing `docker-compose.yml` only fixes local Docker. The healthcheck proving connections ≠ proof `vector` is installed. Embeddings via the existing `SUMMARY_LLM`-style config; embedding writes use **raw SQL** (Unsupported column).
- **Durable embedding backfill (Codex R1):** NOT an in-process promise/timer (lost on restart → permanent-null embeddings). An **idempotent sweep over `embedding IS NULL`** (same bounded-run pattern as W81-C1) with retry/error semantics; a chunk is citeable before it is embedded.

**4. Ingestion entry points + the integration contract with as-built a71-13 (Codex R1).** A `SourceIngestService` (`src/lib/sources/`): `ingestSource(...)` → hash, dedup on `(tenantId, contentSha256, chunkerVersion)`, insert `Source` (+ a `SourceOrigin` occurrence row), chunk, insert `SourceChunk`s, schedule embedding. Wired into `a71-08` intake, `a71-02` sync, and a71-13's `/enrich`. **Critical reconciliation with the CODE AS BUILT:**
- **`Source` existence must NEVER be an enrichment short-circuit.** `Source` = "raw content preserved"; the a71-13 `IngestLedgerEntry` = "enrichment completed" — different states. The enrichment short-circuit stays the **ledger** check (`enrich.ts:102`). If Source-create succeeds but enrichment fails, a retry **reuses the Source and still runs enrichment** (Codex R1 — using Source as the short-circuit would silently drop the retry).
- **`dryRun` persists nothing** (Codex R1): a71-13's `dryRun` returns after planning with zero writes (`enrich.ts:160`). A1 must chunk **in memory** for a dry run and persist Source/chunks + schedule embedding **only on a real (non-dry) apply**.
- **Source is an idempotent PRE-STEP, not inside a71-13's page-apply.** As-built a71-13 apply is **not** atomic (page/block/properties/wikilink/version/audit are separate; ledger written after — `applyPlan.ts:328`). So A1 tolerates the *current* non-atomic behavior: an orphan Source (content preserved, enrichment later) is harmless and GC-able; a page without provenance is the hazard A2's later transactional rewrite addresses. A1 does not assume A2's transaction exists yet.
- **Legacy ledger-only inputs** (ledger rows written before A1, no Source) need an explicit **backfill/reconciliation sweep** that creates Sources for them, else re-submitting old content never builds the corpus citations need.
- **Concurrent-ingest race is NOT solved by a unique Source** (Codex R1): two identical requests both miss the ledger, both call the LLM, both mutate pages; the unique Source only makes them share a Source, it doesn't elect one enrichment owner. A1 documents this as inherited from a71-13; the durable claim-before-LLM fix lands with A2's `EnrichJob` serialization (flagged, not silently assumed fixed here).
- **Validate `originRef` ownership** in the service — a bare polymorphic string could otherwise record another tenant's file/page id even under scoped Source queries.

## Affected repos & files
**SymbioKnowledgeBase (only):**
- `prisma/schema.prisma` — new `Source`, `SourceChunk` models + `SourceKind` enum; `vector` column (additive migrations).
- `prisma/migrations/*` — enable `vector` extension; create tables; append-only guard trigger.
- `docker-compose.yml` — Postgres image with pgvector.
- `src/lib/sources/ingestService.ts`, `src/lib/sources/chunker.ts`, `src/lib/sources/embed.ts` — new.
- `src/app/api/agent/sources/route.ts` — new (create/list).
- Wire points: `a71-08` intake, `a71-02` sync, `a71-13` enrich (thread Source creation before enrichment).

## Out of scope
- The claim→chunk citations themselves (W81-A2).
- Re-chunking / re-embedding strategy changes (noted; would spawn a new Source version).
- Bitemporal supersession (W81-B1).

## Acceptance criteria
1. Ingesting a raw artifact creates one `Source` (immutable) + N deterministic `SourceChunk`s; re-ingesting byte-identical text is a no-op (dedup on `contentSha256`), returns the existing Source id.
2. `Source.rawText` and `SourceChunk.text` **cannot be updated or deleted** via the service layer or Prisma client; an attempted `update`/`delete` is rejected (DB trigger or middleware), proven by a test.
3. Chunking is deterministic: same `rawText` → identical `chunkIndex`, `charStart/charEnd`, `textSha256` across runs.
4. `SourceChunk.textSha256` uniquely + durably identifies a chunk's content independent of its offsets.
5. pgvector extension is enabled; chunks embed via an async pass; a chunk is queryable/citeable before it is embedded (nullable embedding).
6. Every query in the service (dedup lookup, chunk read) filters by `tenantId`; a cross-tenant `contentSha256` collision does not surface another tenant's Source.

## Verification plan
- Unit: chunker determinism (snapshot boundaries), hash stability, dedup no-op, immutability guard rejects update/delete.
- Integration: ingest a real transcript → assert Source + chunks + embedding backfill; re-ingest → no new rows.
- Manual: `curl POST /api/agent/sources` with a `skb_live_` key; `SELECT count(*) FROM source_chunks WHERE source_id=…`.

## Regression risks
- **pgvector image swap** could disrupt the existing Postgres 18 container/data volume — migrate on a copy first; confirm `pgvector/pgvector:pg18` matches PG18 and the data volume survives. Flag as an ops decision.
- **Embedding cost/latency** on bulk backfill (679 transcripts) — batch + rate-limit; embedding is async and off the ingest hot path.
- **Immutability trigger** must not block legitimate schema migrations — scope the guard to `UPDATE`/`DELETE` on row data, allow DDL.
- **Storage growth** — raw text duplicated between `FileAttachment` and `Source` for uploaded docs. Accept (raw text is the point) but note; could later store `Source.rawText` as a pointer for very large files.

## Review
Run through `/story` (Codex + GLM). Key questions for review: pgvector-on-PG18 image path safety; whether the append-only guard should be a DB trigger vs Prisma middleware vs both; chunk size/overlap defaults; whether Source should carry a `supersededBySourceId` now or defer to W81-B1.

## Acceptance criteria (added/updated — Codex R1)
A1.8. Dedup key is `(tenantId, contentSha256, chunkerVersion)`; a chunker-version change on identical text mints a NEW Source (byte-stable re-chunk is possible). Same text + different provenance is preserved as multiple `SourceOrigin` rows on one Source, never collapsed away.
A1.9. The immutability trigger rejects `UPDATE` of `rawText`/chunk text+boundaries and `DELETE` of those rows, but PERMITS the nullable-`embedding` backfill `UPDATE` and `ON DELETE CASCADE` from tenant deletion (proven by tests for both).
A1.10. `Source` existence is never used as an enrichment short-circuit; a failed-enrichment retry reuses the Source and still runs enrichment (test: create Source, fail enrichment, retry → enrichment runs, ledger written once).
A1.11. `dryRun: true` persists no Source/chunks and schedules no embedding (chunk-in-memory only).
A1.12. Each chunk's `text` equals `rawText`'s `[charStart, charEnd)` code-point slice; astral/emoji + CRLF/LF regression tests pass; repeated identical paragraphs get distinct `(sourceId, chunkIndex)` despite equal `textSha256`.
A1.13. Embedding backfill is a durable idempotent sweep over `embedding IS NULL` (survives restart), not an in-process promise.

## Reviewer Feedback / Codex (round 1) — GPT-5.6, high reasoning (reviewed against the AS-BUILT a71-13)
11 criticals folded above:
1. **pgvector image swap safety** (backup pgdata, deploy image before CREATE EXTENSION, non-Compose envs, no safe rollback, healthcheck≠vector). → Ordered migration + backup + warnings in §3.
2. **`Source` dedup ≠ ledger dedup** — Source-as-short-circuit drops retries; legacy ledger-only inputs have no Source. → §4: ledger stays the short-circuit; backfill sweep for legacy rows.
3. **Source-before-enrichment violates dryRun**, and A2 self-contradicts (Source in vs out of the apply tx). → §4 dryRun persists nothing; **A2 AC6 fixed** (Source is a pre-step, not in the tx).
4. **Unique Source doesn't fix a71-13's concurrent-ingest race.** → Documented as inherited; durable claim lands with A2 `EnrichJob`.
5. **As-built a71-13 apply is NOT atomic** — Source-first can orphan/partial. → §4 tolerates current non-atomic behavior; orphan Source harmless.
6. **Prisma 7 removed `$use` middleware.** → DB trigger authoritative; `$extends` defense-in-depth; embedding writes via raw SQL (Unsupported vector).
7. **Tenant-consistent FKs** — composite `(tenantId, sourceId) → Source(tenantId, id)` + tenant-leading indexes; validate `originRef` ownership.
8. **`contentSha256` uniqueness blocks re-chunk + collapses provenance.** → Key includes `chunkerVersion`; `SourceOrigin` occurrences preserve provenance.
9. **Chunker determinism underspecified; UTF-16 vs code-point.** → Pinned tokenizer+version, half-open code-point offsets, verbatim `rawText` storage.
10. **`textSha256` not a unique identity.** → Fingerprint only; identity is `(sourceId, chunkIndex)`.
11. **Embedding enqueue has no durable substrate.** → Idempotent `embedding IS NULL` sweep.

Nice-to-have folded: reuse a71-13's exact SHA-256 impl (`ingestLedger.ts:14`) so Source/ledger hashes can't drift; DB checks (`chunkIndex>=0`, half-open bounds, `charStart<=charEnd`, `vector(1536)` dim); ordered extension→tables→indexes migration tested on fresh + copied PG18 volume; regression corpus (astral Unicode, CRLF/LF, repeated paragraphs, overlap, concurrent identical requests, legacy ledger-only, failed-then-retry, dry-run zero-writes, embedding backfill through trigger, tenant-delete cascade).

## Revision History
- 2026-07-10 — Initial draft (Agent 81).
- 2026-07-11 — Round 1 (Codex GPT-5.6 high, vs as-built a71-13): 11 criticals folded — chunkerVersion in dedup key + SourceOrigin for provenance, DB-trigger (not Prisma-middleware) immutability scoped to allow embedding backfill + tenant cascade, ledger-stays-short-circuit + legacy backfill, verbatim rawText + code-point offsets, durable embedding sweep, tenant-consistent composite FKs. **Also fixed a contradiction in already-reviewed A2 (Source pre-step vs in-tx).** GLM runtime review pending.
