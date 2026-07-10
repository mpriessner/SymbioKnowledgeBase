# W81-A1 — Immutable Source + SourceChunk store (append-only, hashed, chunked, embedded)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 81
- **Created:** 2026-07-10
- **Status:** draft
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
  title, contentSha256 (unique per tenant), rawText (immutable),
  originRef (FileAttachment.id | Page.externalId | url),
  ingestedAt, ingestedBy, correlationId
}
@@unique([tenantId, contentSha256])   // dedup: identical raw text re-ingest is a no-op
```
- **No `updatedAt`, no update path.** The service layer exposes create + read only; there is no `PATCH`. A DB-level guard (a `BEFORE UPDATE` trigger that raises, or a Prisma middleware that rejects `update`/`delete` on `Source`/`SourceChunk` outside an explicit admin migration) enforces the invariant. Corrections happen by ingesting a *new* Source that supersedes the old one at the wiki layer (W81-B1), never by editing the raw row.

**2. `SourceChunk` (append-only, the citation anchor).** Deterministic segmentation of `Source.rawText`.
```
SourceChunk {
  id, tenantId, sourceId,
  chunkIndex (0-based, stable), charStart, charEnd,
  text, textSha256,
  embedding vector(1536)?,   // pgvector; nullable until embed pass runs
  createdAt
}
@@unique([sourceId, chunkIndex])
```
- **Stable chunking:** a deterministic splitter (paragraph/heading-aware, ~500–800 token target with overlap) so the same `rawText` always yields the same chunk boundaries → `chunkIndex` and `charStart/charEnd` are reproducible. `textSha256` is the **durable citation anchor** (survives re-parse; offsets are a re-locatable hint, per research §1).
- **Chunks are never renumbered.** If a chunking-algorithm change is ever needed, it creates a *new* `Source` version, leaving existing chunk IDs (and the citations pointing at them) intact.

**3. Enable pgvector.** Add the `vector` extension to the Dockerized Postgres 18 (`docker-compose.yml` image → `pgvector/pgvector:pg18` or install the extension) + `CREATE EXTENSION vector`. Embeddings via the existing `SUMMARY_LLM`-style config (reuse an embedding provider; W81-D2 formalizes tiering). Embedding is a **separate async pass** — a chunk exists (and is citeable) before it is embedded; embedding backfills for similarity search (W81-B1/W81-D3).

**4. Ingestion entry points.** A `SourceIngestService` (`src/lib/sources/`) with `ingestSource({tenantId, kind, title, rawText, originRef})` → hashes, dedup-checks, inserts `Source`, runs the deterministic chunker, inserts `SourceChunk`s, enqueues embedding. Wired into: `a71-08` document intake (extracted text → Source), `a71-02` experiment sync (narrative → Source), and a71-13's `/api/agent/pages/enrich` (the `rawText` it ingests becomes a Source *before* enrichment, so the concepts it writes can cite it in W81-A2). A thin `POST /api/agent/sources` for direct ingestion.

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
