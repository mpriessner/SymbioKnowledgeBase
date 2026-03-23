# Epic 43: ChemELN Data Extraction & Transformation

**Epic ID:** EPIC-43
**Created:** 2026-03-21
**Total Story Points:** 16
**Priority:** Critical
**Status:** Planned

---

## Epic Overview

Epic 43 delivers a read-only TypeScript service that connects to ChemELN's Supabase database, fetches experiment data with all related entities (reagents, products, procedures, chemical references), and transforms it into structured intermediate TypeScript types. This data serves as the foundation for generating chemistry knowledge base pages in Epic 44.

ChemELN is a separate Supabase project (ET_ELN) running on a distinct instance (typically port 54331). The extraction service performs strictly read-only operations (SELECT queries only) and handles the complex relational structure of experiment data, including JSONB procedure steps pushed by ExpTube's AI video analysis system.

This epic delivers no user-facing features — it creates the data pipeline and normalization layer that Epic 44's page generator consumes. The intermediate types are designed to be serializable to JSON for caching and to gracefully handle ChemELN schema evolution.

---

## Business Value

- **Unlocks automated chemistry knowledge documentation:** Without this extraction layer, experiment data remains siloed in ChemELN's database, inaccessible to the knowledge base generation pipeline
- **Enables researcher expertise mapping:** By extracting and normalizing experiment authorship, reaction types, and chemical usage patterns, we can automatically identify researcher specialties and build expertise graphs
- **Provides chemical inventory intelligence:** Deduplication and normalization of chemical records reveals usage patterns, identifies synonyms, and supports procurement optimization
- **Future-proofs against ChemELN changes:** The intermediate type layer isolates Epic 44's page generator from ChemELN's schema, allowing independent evolution

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  ChemELN Supabase (ET_ELN)                                      │
│  Port: 54331 (typical)                                          │
│                                                                 │
│  Tables:                                                        │
│  - experiments (id, title, experiment_type, created_by, ...)   │
│  - reagents (experiment_id, chemical_id, amount, ...)          │
│  - products (experiment_id, chemical_id, yield, ...)           │
│  - chemicals (id, name, cas_number, molecular_formula, ...)    │
│  - auth.users (id, email, raw_user_meta_data -> name)          │
│  - actual_procedure JSONB (steps pushed by ExpTube AI)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SELECT queries (read-only)
                              │ CHEMELN_SUPABASE_URL
                              │ CHEMELN_SERVICE_ROLE_KEY
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ChemELN Reader Client (src/lib/chemeln/client.ts)             │
│  - Supabase client with service role auth                      │
│  - Connection health check                                     │
│  - Pagination support                                          │
│  - Error handling for connection failures                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Experiment Data Fetcher (src/lib/chemeln/fetcher.ts)          │
│  - Fetch experiments with .select() joins                      │
│  - Fetch reagents[], products[], actual_procedure JSONB        │
│  - Date range filtering, status filtering                      │
│  - Transform into ExperimentData[]                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Normalizers (parallel)                                         │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Chemical Dedup      │  │  Reaction Classifier │            │
│  │  (normalizers/       │  │  (normalizers/       │            │
│  │   chemicals.ts)      │  │   reactions.ts)      │            │
│  │                      │  │                      │            │
│  │  - Match by CAS      │  │  - Extract from      │            │
│  │  - Normalize names   │  │    experiment_type   │            │
│  │  - Build synonym     │  │  - Keyword fallback  │            │
│  │    registry          │  │  - Lookup table      │            │
│  │  - Merge duplicates  │  │    (~30 types)       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                 │
│  ┌──────────────────────┐                                      │
│  │  Researcher Extractor│                                      │
│  │  (normalizers/       │                                      │
│  │   researchers.ts)    │                                      │
│  │                      │                                      │
│  │  - Lookup by UUID    │                                      │
│  │  - Extract name/email│                                      │
│  │  - Compute expertise │                                      │
│  │  - Count experiments │                                      │
│  └──────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Intermediate Types (src/lib/chemeln/types.ts)                 │
│  - ExperimentData                                               │
│  - ChemicalRecord                                               │
│  - ReactionTypeStats                                            │
│  - ResearcherProfile                                            │
│  - All serializable to JSON for caching                        │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Reader Client authenticates with ChemELN Supabase using service role key
2. Fetcher queries experiments with joined reagents/products/chemicals
3. Fetcher extracts `actual_procedure` JSONB (AI-analyzed steps from ExpTube)
4. Normalizers process the raw data in parallel:
   - Chemical Dedup merges entries by CAS number, builds synonym registry
   - Reaction Classifier categorizes experiments into ~30 reaction types
   - Researcher Extractor maps UUIDs to names/emails, computes expertise
5. Output: Intermediate TypeScript types ready for page generation (Epic 44)

---

## Stories Breakdown

### SKB-43.1: ChemELN Reader Client — 3 points, Critical

**Delivers:** TypeScript module (`src/lib/chemeln/client.ts`) that creates a Supabase client authenticated with ChemELN's service role key. Configuration loaded from environment variables (`CHEMELN_SUPABASE_URL`, `CHEMELN_SERVICE_ROLE_KEY`). Connection health check function. Pagination support (limit/offset). Error handling for connection failures, invalid credentials, network timeouts. **Read-only operations only** (SELECT queries).

**Depends on:** Nothing (first story)

---

### SKB-43.2: Experiment Data Fetcher with Relations — 4 points, Critical

**Delivers:** Fetcher module (`src/lib/chemeln/fetcher.ts`) that queries experiments table with Supabase `.select()` joins to fetch reagents, products, and chemical reference data. Extracts `actual_procedure` JSONB field (structured steps from ExpTube AI). Fetches `procedure_metadata`. Handles null/missing fields gracefully (optional fields defaulted). Transforms raw Supabase rows into `ExperimentData[]` intermediate type. Supports filtering by date range, experiment status, experiment ID. Complete TypeScript interface definitions for all types.

**Depends on:** SKB-43.1 (reader client must exist)

---

### SKB-43.3: Chemical Deduplication & Normalization — 3 points, High

**Delivers:** Normalizer module (`src/lib/chemeln/normalizers/chemicals.ts`) that deduplicates chemicals across experiments. Primary matching by CAS number (if present). Normalizes names: trim whitespace, consistent casing, remove special characters. Builds synonym registry (e.g., THF → Tetrahydrofuran, DCM → Dichloromethane). Merges duplicate entries from different experiments. Output: `ChemicalRecord[]` with unique CAS numbers, normalized names, synonym arrays, and usage counts (number of experiments using each chemical).

**Depends on:** SKB-43.2 (experiment data must be fetched)

---

### SKB-43.4: Reaction Type Classification — 3 points, High

**Delivers:** Classifier module (`src/lib/chemeln/normalizers/reactions.ts`) that categorizes experiments into reaction types. Primary classification from `experiment_type` field in ChemELN database. Keyword-based fallback classification from experiment title/objective fields. Lookup table of approximately 30 common reaction types: Suzuki coupling, Grignard reaction, Aldol condensation, Wittig reaction, Buchwald-Hartwig amination, Heck reaction, Sonogashira coupling, Friedel-Crafts acylation/alkylation, Diels-Alder cycloaddition, hydrogenation, oxidation, reduction, esterification, amidation, etc. Unknown types → "Unclassified" category. Output: `ReactionTypeStats[]` grouping experiments by reaction type with counts.

**Depends on:** SKB-43.2 (experiment data must be fetched)

---

### SKB-43.5: Researcher Identity Extraction — 3 points, High

**Delivers:** Extractor module (`src/lib/chemeln/normalizers/researchers.ts`) that resolves experiment authors. Looks up user by `created_by` UUID in ChemELN's `auth.users` table. Extracts name from `raw_user_meta_data` JSONB field, email from `email` column. Handles missing user data gracefully (deleted users → "Unknown Researcher"). Builds `ResearcherProfile[]` registry with: name, email, experiment counts grouped by reaction type, primary expertise areas (top 3 reaction types by count). Computes total experiments per researcher.

**Depends on:** SKB-43.2 and SKB-43.4 (needs experiment data and reaction classifications)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 43.1 | Supabase client creation, env var loading | Connection health check against test DB | Pagination works with real data |
| 43.2 | ExperimentData type validation, null handling | Fetch experiments with joins | Date range filter returns correct subset |
| 43.3 | CAS number matching, name normalization | Deduplicate across multiple experiments | Synonym registry contains expected entries |
| 43.4 | Reaction type lookup, keyword extraction | Classify batch of experiments | All experiments categorized (no undefined) |
| 43.5 | User lookup by UUID, missing data handling | Build researcher registry | Expertise areas match actual experiment distribution |

---

## Implementation Order

```
43.1 (Client) → 43.2 (Fetcher) → { 43.3 (Chemicals)
                                   43.4 (Reactions)   } (parallel)
                                   43.5 (Researchers)
                                        │
                                        └─ Depends on 43.4 for reaction types
```

**Critical path:** 43.1 → 43.2 → 43.4 → 43.5

**Parallel after 43.2:** Stories 43.3 and 43.4 can be implemented in parallel since they both consume `ExperimentData[]` but produce independent outputs.

---

## Shared Constraints

- **TypeScript strict mode** — No `any` types allowed. All nullable fields explicitly typed with `| null`.
- **Read-only operations** — All ChemELN queries must be SELECT only. No INSERT, UPDATE, DELETE, or DDL.
- **Graceful offline operation** — If ChemELN Supabase is unavailable, functions must return empty arrays or cached data, not crash.
- **Intermediate types are serializable** — All types (`ExperimentData`, `ChemicalRecord`, etc.) must serialize to JSON without loss (no functions, Map, Set, Date objects — use ISO strings for dates).
- **ChemELN schema evolution tolerance** — Unknown fields in ChemELN responses are ignored. Missing optional fields default to null or empty arrays. No hard crashes on schema mismatches.
- **Environment variables required** — `CHEMELN_SUPABASE_URL` and `CHEMELN_SERVICE_ROLE_KEY` must be documented in `.env.example` with comments explaining they point to the separate ChemELN project.
- **No markdown generation** — This epic produces TypeScript types only. Markdown page generation is Epic 44.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/chemeln/client.ts` — Supabase reader client with service role auth
- `src/lib/chemeln/fetcher.ts` — Experiment data fetcher with relational joins
- `src/lib/chemeln/types.ts` — Intermediate TypeScript types (ExperimentData, ChemicalRecord, ReactionTypeStats, ResearcherProfile)
- `src/lib/chemeln/normalizers/chemicals.ts` — Chemical deduplication and normalization
- `src/lib/chemeln/normalizers/reactions.ts` — Reaction type classification
- `src/lib/chemeln/normalizers/researchers.ts` — Researcher identity extraction and expertise mapping
- `src/lib/chemeln/config.ts` — Configuration loader (environment variables)
- `tests/unit/chemeln/client.test.ts` — Client tests
- `tests/unit/chemeln/fetcher.test.ts` — Fetcher tests
- `tests/unit/chemeln/normalizers/chemicals.test.ts` — Chemical normalizer tests
- `tests/unit/chemeln/normalizers/reactions.test.ts` — Reaction classifier tests
- `tests/unit/chemeln/normalizers/researchers.test.ts` — Researcher extractor tests
- `tests/integration/chemeln/e2e.test.ts` — End-to-end extraction test with real ChemELN data

### Modified Files
- `.env.example` — Add `CHEMELN_SUPABASE_URL` and `CHEMELN_SERVICE_ROLE_KEY` with documentation
- `package.json` — Add `@supabase/supabase-js` dependency if not already present

---

**Last Updated:** 2026-03-21
