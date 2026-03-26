# Epic 44: SKB Ingestion Pipeline — Page Generation & Writing

**Epic ID:** EPIC-44
**Created:** 2026-03-21
**Status:** Deprioritized (2026-03-25) — Superseded by EPIC-52
**Total Story Points:** 23
**Priority:** Critical
**Status:** Planned
**Dependencies:** EPIC-42 (Templates), EPIC-43 (ChemELN Data Extraction)

---

## Epic Overview

Epic 44 transforms the intermediate ChemELN data structures (from EPIC-43) into complete, interconnected SymbioKnowledgeBase pages. This epic covers:

1. **Page Generation** — Convert `ExperimentData`, `ChemicalData`, `ReactionTypeData`, `ResearcherData`, and `SubstrateClassData` into full Markdown pages with proper YAML frontmatter, wikilinks, and sections using the templates from EPIC-42
2. **SKB Agent API Integration** — Write generated pages to SymbioKnowledgeBase via the Agent API (from EPIC-15), handling authentication, rate limiting, and error recovery
3. **Batch Orchestration** — Three-pass ingestion strategy ensuring wikilinks resolve correctly and entity pages include aggregated cross-references
4. **Idempotent Upserts** — Match existing pages by tag (eln:X, cas:X) or title, skip unchanged pages using content hashes
5. **Dry-Run Mode** — Preview all changes with diffs before committing

This epic is the **core pipeline** that brings ChemELN data into SymbioKnowledgeBase, enabling researchers to discover institutional knowledge, find experts, and learn from past experiments.

**Dependencies:**
- EPIC-42 (Markdown Templates) — must have all 5 page templates defined
- EPIC-43 (Data Extraction) — must have `ExperimentData`, `ChemicalData`, etc. data structures
- EPIC-15 (Agent API) — must have `POST /api/agent/pages` and `PUT /api/agent/pages/:id` endpoints

---

## Business Value

- **Knowledge Discovery:** Researchers can discover institutional experience that would otherwise be siloed in ChemELN — "Who has tried this reaction? What challenges did they face?"
- **Expertise Mapping:** Automatically identify who to ask about specific reaction types, substrate classes, or challenges
- **Pattern Recognition:** Surface "Key Learnings" from hundreds of experiments, attributed to researchers, enabling knowledge transfer
- **Reproducibility:** Practical notes from actual procedures (deviations, observations) captured and searchable
- **Cross-Linking:** Wikilinks enable traversal from experiment → chemical → other experiments using that chemical → researchers with expertise
- **Incremental Sync:** Changes in ChemELN automatically sync to SKB without manual copying
- **Data Quality:** Validation during generation ensures only clean, well-structured data enters the knowledge base

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SKB Ingestion Pipeline Architecture                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  INPUT: ChemELN Database (EPIC-43 Extractors)                       ││
│  │                                                                      ││
│  │  extractExperiments() → ExperimentData[]                            ││
│  │  extractChemicals() → ChemicalData[]                                ││
│  │  extractReactionTypes() → ReactionTypeData[]                        ││
│  │  extractResearchers() → ResearcherData[]                            ││
│  │  extractSubstrateClasses() → SubstrateClassData[]                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  PAGE GENERATORS (EPIC-44.1, 44.2)                                  ││
│  │                                                                      ││
│  │  generateExperimentPage(data) → Markdown                            ││
│  │    - YAML frontmatter (tags: eln:, reaction:, researcher:, etc.)    ││
│  │    - Conditions table (wikilinked chemicals)                        ││
│  │    - Reagent list (roles, amounts)                                  ││
│  │    - Procedure steps                                                ││
│  │    - Results section (yield, purity)                                ││
│  │    - Practical notes (deviations, observations)                     ││
│  │    - Related experiments section                                    ││
│  │                                                                      ││
│  │  generateChemicalPage(data) → Markdown                              ││
│  │    - CAS, properties, practical notes                               ││
│  │    - "Used In" section (experiment wikilinks with role/amount)      ││
│  │                                                                      ││
│  │  generateReactionTypePage(data) → Markdown                          ││
│  │    - Aggregate stats (count, avg yield, researcher count)           ││
│  │    - "Key Learnings" (ranked, attributed)                           ││
│  │    - "Common Pitfalls", "Who To Ask"                                ││
│  │                                                                      ││
│  │  generateResearcherPage(data) → Markdown                            ││
│  │    - Expertise areas (top reaction types by count, avg yield)       ││
│  │    - Recent experiments list                                        ││
│  │                                                                      ││
│  │  generateSubstrateClassPage(data) → Markdown                        ││
│  │    - Challenges, "What Worked", "Who Has Experience"                ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  CROSS-REFERENCE RESOLVER (EPIC-44.6)                               ││
│  │                                                                      ││
│  │  buildLookupMap() → Map<name, pageId>                               ││
│  │    - All chemicals, reaction types, researchers                     ││
│  │                                                                      ││
│  │  createStubPages(missing) → StubPage[]                              ││
│  │    - For chemicals mentioned in experiments but not in              ││
│  │      ChemELN chemicals table                                        ││
│  │    - Tag: needs-enrichment                                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  BATCH INGESTION ORCHESTRATOR (EPIC-44.4)                           ││
│  │                                                                      ││
│  │  Pass 1: Entity Pages                                               ││
│  │    - Create/update chemicals, reaction types, researchers,          ││
│  │      substrate classes                                              ││
│  │    - Establishes wikilink targets                                   ││
│  │                                                                      ││
│  │  Pass 2: Experiment Pages                                           ││
│  │    - Create/update experiments                                      ││
│  │    - Wikilinks to entities now resolve                              ││
│  │                                                                      ││
│  │  Pass 3: Aggregation Update                                         ││
│  │    - Update entity pages with cross-references                      ││
│  │    - Chemical "Used In" sections                                    ││
│  │    - Reaction type "Key Learnings" from experiment notes            ││
│  │    - Researcher contributions                                       ││
│  │                                                                      ││
│  │  Idempotent Upsert Logic:                                           ││
│  │    1. Search for existing page by tag match or exact title          ││
│  │    2. Compute content hash (MD5 of markdown body)                   ││
│  │    3. Skip if hash matches existing                                 ││
│  │    4. Update if hash differs                                        ││
│  │                                                                      ││
│  │  Error Isolation:                                                   ││
│  │    - One failed page doesn't stop the batch                         ││
│  │    - Track partial progress for resume                              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  SKB AGENT API WRITER (EPIC-44.3)                                   ││
│  │                                                                      ││
│  │  Authentication: API key auth                                        ││
│  │  CREATE: POST /api/agent/pages { markdown, parent_id }             ││
│  │  UPDATE: PUT /api/agent/pages/:id { markdown }                     ││
│  │  SEARCH: GET /api/agent/pages?q=tag:eln:EXP-2024-001               ││
│  │                                                                      ││
│  │  Rate Limiting: 10 API calls/second                                 ││
│  │  Error Handling: 429 → backoff, 500 → retry, 404 → skip            ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  SYNC STATE MANAGEMENT (EPIC-44.5)                                  ││
│  │                                                                      ││
│  │  Dry-Run Mode:                                                       ││
│  │    - Generate all pages                                             ││
│  │    - Diff against existing                                          ││
│  │    - Report: created/updated/skipped counts                         ││
│  │    - Show content diffs for updates                                 ││
│  │    - No writes to SKB                                               ││
│  │                                                                      ││
│  │  Sync State Persistence:                                            ││
│  │    - Last sync timestamp                                            ││
│  │    - Per-page content hashes                                        ││
│  │    - Sync results (created/updated/failed)                          ││
│  │    - Stored in: sync-state.json or SKB database table               ││
│  │                                                                      ││
│  │  CLI: npx tsx scripts/sync-chemeln.ts                              ││
│  │    --dry-run      Preview changes without writing                   ││
│  │    --full         Full sync (all pages)                             ││
│  │    --incremental  Only changed pages since last sync                ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                           │                                               │
│                           ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  OUTPUT: SymbioKnowledgeBase Pages                                   ││
│  │                                                                      ││
│  │  Created/Updated:                                                    ││
│  │    - 500+ Experiment pages (eln:EXP-YYYY-NNNN)                      ││
│  │    - 150+ Chemical pages (cas:XXXXX)                                ││
│  │    - 20+ Reaction Type pages (reaction:suzuki-coupling)             ││
│  │    - 10+ Researcher pages                                           ││
│  │    - 5+ Substrate Class pages (substrate-class:aryl-halides)        ││
│  │                                                                      ││
│  │  Skipped:                                                            ││
│  │    - Pages with unchanged content hashes                            ││
│  │                                                                      ││
│  │  Failed:                                                             ││
│  │    - Pages with validation errors                                   ││
│  │    - API errors (logged for manual review)                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘

Three-Pass Strategy:
─────────────────────

Pass 1: Entities (Order matters!)
  1. Chemicals
  2. Reaction Types
  3. Researchers
  4. Substrate Classes

Pass 2: Experiments
  - All wikilinks to entities now resolve

Pass 3: Aggregation
  - Update chemical pages with "Used In" experiments
  - Update reaction type pages with "Key Learnings" from experiment notes
  - Update researcher pages with recent experiments
```

---

## Stories Breakdown

### SKB-44.1: Experiment Page Generator — 5 points, Critical

**Delivers:** Convert `ExperimentData` (from EPIC-43) → full Markdown page using experiment template (from EPIC-42). Includes:
- YAML frontmatter with all tags (eln:, reaction:, researcher:, substrate-class:, scale:, challenge:, quality:)
- Conditions table with wikilinked chemicals (temp, pressure, time, solvent)
- Reagent list with roles and amounts (wikilinked)
- Procedure steps (from `actual_procedure` or `planned_procedure`)
- Results section with yield/purity
- Practical notes section (from procedure deviations and observations)
- Related experiments section (same reaction type or same chemicals)

Must handle missing fields gracefully (omit sections rather than show empty). Wikilinks must use exact page titles as defined in EPIC-42 naming conventions.

---

### SKB-44.2: Entity Page Generators — 5 points, Critical

**Delivers:** Four page generators for entity types:

**Chemical Page Generator:**
- CAS number, molecular formula, molecular weight, properties from ChemELN chemicals table
- Practical notes placeholder section
- "Used In" section listing experiment wikilinks with role (reagent/product/catalyst) and amount

**Reaction Type Page Generator:**
- Aggregate stats (total experiments, avg yield, researcher count)
- "Institutional Experience" summary
- "Key Learnings" ranked list (extracted from experiment practical notes, attributed to researcher + date)
- "Common Pitfalls" section
- "Who To Ask" section (top 3 researchers by experiment count)

**Researcher Page Generator:**
- Expertise areas (top reaction types by experiment count, avg yield)
- Recent experiments list (last 10)
- Key contributions section

**Substrate Class Page Generator:**
- Challenges section (from experiments tagged with this substrate class)
- "What Worked" section with experiment links
- "Who Has Experience" section

---

### SKB-44.3: SKB Agent API Writer Client — 3 points, High

**Delivers:** TypeScript client for SKB Agent API:
- Authenticate with API key (stored in `.env`)
- Create pages: `POST /api/agent/pages` with markdown format
- Update pages: `PUT /api/agent/pages/:id` with markdown format
- Set parent page relationships
- Search existing pages by tag or title for upsert matching
- Error handling:
  - 429 rate limit → exponential backoff (2s, 4s, 8s, max 30s)
  - 500 server error → retry 3 times
  - 404 not found → skip (log warning)
- Respect rate limits (max 10 calls/second with token bucket)

All API calls use markdown format (not TipTap JSON).

---

### SKB-44.4: Batch Ingestion Orchestrator — 5 points, Critical

**Delivers:** Orchestrate three-pass ingestion:

**Pass 1: Entities** (in order)
1. Chemicals
2. Reaction Types
3. Researchers
4. Substrate Classes

**Pass 2: Experiments**
- All wikilinks to entities now resolve

**Pass 3: Aggregation Updates**
- Update chemical pages with "Used In" experiments
- Update reaction type pages with "Key Learnings"
- Update researcher pages with recent experiments

**Idempotent Upsert Logic:**
1. Search for existing page by tag match (e.g., `eln:EXP-2024-001` for experiments, `cas:107-06-2` for chemicals) or exact title match
2. Compute content hash (MD5 of markdown body, excluding frontmatter timestamps)
3. If existing page found and hash matches → skip (no write)
4. If existing page found and hash differs → update
5. If no existing page → create

**Error Isolation:**
- One failed page doesn't stop the batch
- Track partial progress in memory
- Resume from last successful page if interrupted

**Progress Reporting:**
- Real-time counts: created/updated/skipped/failed
- ETA based on average page write time

---

### SKB-44.5: Dry-Run Mode & Sync State — 3 points, High

**Delivers:**

**Dry-Run Mode:**
- Generate all pages (Pass 1, 2, 3)
- Diff against existing pages
- Report what would change (created/updated/skipped counts)
- Show content diffs for updates (side-by-side or unified diff)
- No writes to SKB

**Sync State Persistence:**
- Store last sync timestamp
- Per-page content hashes (for change detection)
- Sync results (created/updated/failed counts)
- Storage: `sync-state.json` in project root or SKB database table (`chemeln_sync_state`)

**CLI Command:**
```bash
npx tsx scripts/sync-chemeln.ts [options]

Options:
  --dry-run       Preview changes without writing (default: false)
  --full          Full sync all pages (ignore hashes) (default: false)
  --incremental   Only sync changed pages since last sync (default: true)
  --verbose       Show detailed logs
```

**Diff Output:**
```
=== Sync Summary ===
To Create: 50 pages
To Update: 10 pages (content changed)
To Skip: 440 pages (unchanged)

=== Pages To Create ===
- EXP-2024-001: Suzuki Coupling with 4-bromoanisole
- EXP-2024-002: Heck Reaction optimization
...

=== Pages To Update ===
- Palladium acetate [cas:3375-31-3]
  Diff:
  + Used In: [[EXP-2024-001]] (catalyst, 5 mol%)
```

---

### SKB-44.6: Cross-Reference Resolver & Stub Pages — 2 points, Medium

**Delivers:**

**Lookup Map Builder:**
- Before generation, build `Map<name, pageId>` for all target page names:
  - Chemicals (by CAS and common name)
  - Reaction types (by normalized name)
  - Researchers (by name)
- Used to resolve wikilinks during generation

**Stub Page Creator:**
- For any wikilink target that won't have a full page generated (e.g., a chemical mentioned in an experiment but not in ChemELN's chemicals table):
  - Create a stub page with minimal content:
    ```markdown
    ---
    tags: [needs-enrichment, chemical]
    ---
    # [Chemical Name]

    This page was auto-generated and needs enrichment.

    ## Used In
    - [[EXP-2024-001]] (reagent)
    ```
- Tag: `needs-enrichment` for manual review

**Edge Case Handling:**
- Chemicals with special characters in names (e.g., "N,N-dimethylformamide" → "N,N-Dimethylformamide")
- Very long page titles (truncate to 255 chars, append hash)
- Duplicate names (append CAS number to disambiguate)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 44.1 | Template rendering with all fields populated; missing fields omitted; wikilinks formatted correctly | Full experiment data → markdown → TipTap round-trip preserves structure | Generate 10 experiment pages, verify in SKB UI all sections render |
| 44.2 | Each generator with mock data; "Key Learnings" extraction and ranking; stats calculations correct | All entity generators → markdown → verify frontmatter YAML valid | Generate all entity pages, verify cross-references link correctly |
| 44.3 | API client retry logic; rate limiting token bucket; error handling for 429/500/404 | Write 100 pages via API, verify rate limiting works; upsert existing page updates correctly | Full sync creates all pages, incremental sync skips unchanged |
| 44.4 | Idempotent upsert logic: hash matching skips writes; three-pass ordering correct | Run full sync twice, second run skips all pages (unchanged hashes) | Interrupted sync resumes from last successful page |
| 44.5 | Dry-run mode produces correct diff; sync state persists and loads | CLI `--dry-run` shows diffs, `--full` ignores hashes | Full workflow: dry-run → review diffs → full sync → verify results |
| 44.6 | Lookup map builder handles duplicates; stub page generation for missing refs | Stub pages created for chemicals not in ChemELN table; wikilinks resolve | Generate pages with missing refs, verify stubs created and linked |

---

## Implementation Order

```
44.6 → 44.3 → 44.2 → 44.1 → 44.4 → 44.5

┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 44.6   │──▶│ 44.3   │──▶│ 44.2   │──▶│ 44.1   │──▶│ 44.4   │──▶│ 44.5   │
│ Lookup │   │ API    │   │ Entity │   │ Expt   │   │ Batch  │   │ Dry-   │
│ & Stub │   │ Writer │   │ Gen    │   │ Gen    │   │ Orch   │   │ Run    │
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘

Rationale:
- 44.6 first: Provides lookup map needed by generators
- 44.3 next: API writer needed to write generated pages
- 44.2 before 44.1: Entity pages must exist before experiments can link to them
- 44.4 integrates all generators + API writer
- 44.5 last: Dry-run mode wraps orchestrator
```

---

## Shared Constraints

- **TypeScript Strict Mode:** No `any` types; all data structures fully typed
- **Markdown Fidelity:** All pages must pass `markdownToTiptap()` conversion without errors
- **Wikilink Format:** Must use exact page titles as defined in EPIC-42 naming conventions (no manual slugification)
- **Parent Page Relationships:** All experiments under "Experiments/" parent, all chemicals under "Chemicals/" parent, etc.
- **Content Hash:** MD5 of markdown body (excluding YAML frontmatter `created_at`/`updated_at` timestamps)
- **Rate Limiting:** Max 10 API calls/second to SKB Agent API (enforced by client-side token bucket)
- **Error Logging:** All failed pages logged to `sync-errors.log` with full error details
- **Validation:** All generated markdown must have valid YAML frontmatter (parse with `gray-matter`)
- **Idempotency:** Running sync twice with no ChemELN changes should skip all pages (unchanged hashes)
- **Performance:** Sync 500 pages in <5 minutes (assuming 10 calls/sec rate limit)

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/chemeln/generators/experiment.ts` — Experiment page generator
- `src/lib/chemeln/generators/chemical.ts` — Chemical page generator
- `src/lib/chemeln/generators/reaction-type.ts` — Reaction type page generator
- `src/lib/chemeln/generators/researcher.ts` — Researcher page generator
- `src/lib/chemeln/generators/substrate-class.ts` — Substrate class page generator
- `src/lib/chemeln/generators/utils.ts` — Shared template utilities (frontmatter formatting, wikilink helpers)
- `src/lib/chemeln/sync/writer.ts` — SKB Agent API writer client
- `src/lib/chemeln/sync/orchestrator.ts` — Batch ingestion orchestrator (three-pass)
- `src/lib/chemeln/sync/state.ts` — Sync state management (persistence, change detection)
- `src/lib/chemeln/sync/resolver.ts` — Cross-reference resolver and stub page creator
- `scripts/sync-chemeln.ts` — CLI entry point (`npx tsx scripts/sync-chemeln.ts`)
- `src/__tests__/lib/chemeln/generators/experiment.test.ts`
- `src/__tests__/lib/chemeln/generators/chemical.test.ts`
- `src/__tests__/lib/chemeln/generators/reaction-type.test.ts`
- `src/__tests__/lib/chemeln/sync/writer.test.ts`
- `src/__tests__/lib/chemeln/sync/orchestrator.test.ts`
- `src/__tests__/lib/chemeln/sync/state.test.ts`
- `src/__tests__/lib/chemeln/sync/resolver.test.ts`

### Modified Files
- `.env.example` — Add `SKB_AGENT_API_KEY`, `SKB_AGENT_API_URL`
- `package.json` — Add `gray-matter`, `diff` dependencies

---

## Database Schema Changes

**Optional: ChemELN Sync State Table (in SymbioKnowledgeBase)**

```prisma
model ChemElnSyncState {
  id             String   @id @default(uuid())
  tenantId       String   @map("tenant_id")
  pageId         String   @map("page_id")
  chemElnId      String?  @map("chemeln_id") // EXP-2024-001, CAS:107-06-2, etc.
  contentHash    String   @map("content_hash") // MD5 of markdown body
  lastSyncedAt   DateTime @map("last_synced_at")
  syncStatus     String   @map("sync_status") // created, updated, skipped, failed
  errorMessage   String?  @map("error_message")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([tenantId, chemElnId])
  @@index([tenantId, lastSyncedAt])
  @@map("chemeln_sync_state")
}
```

**Alternative:** Use `sync-state.json` file in project root (simpler for MVP).

---

**Last Updated:** 2026-03-21
