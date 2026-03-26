# Epic 45: Practical Knowledge Enrichment & Multi-User Attribution

**Epic ID:** EPIC-45
**Created:** 2026-03-21
**Status:** Deprioritized (2026-03-25) — Superseded by EPIC-52
**Total Story Points:** 20
**Priority:** High
**Status:** Planned

---

## Epic Overview

Epic 45 transforms the Chemistry KB from a structured mirror of ChemELN data into a genuine **institutional knowledge repository**. It does this by:

1. **Extracting practical insights** from ExpTube's AI-analyzed video data (actual_procedure steps, deviations, observations) and surfacing them prominently on experiment pages
2. **Computing quality scores** so agents can rank experiments by reliability
3. **Extracting and ranking "Key Learnings"** on reaction type pages — the most valuable aggregated knowledge
4. **Building researcher expertise profiles** that enable "who to ask" recommendations
5. **Ensuring multi-tenant isolation** so each institution's knowledge stays separate

This is what makes the KB valuable beyond a database. A database tells you WHAT happened; the KB tells you WHAT TO DO NEXT based on institutional experience.

**Key insight:** The `actual_procedure` JSONB field in ChemELN experiments already contains rich data pushed by ExpTube — structured steps with timestamps, deviation notes, observations. This epic extracts the practical gold from that data.

**Current state:** The Chemistry KB (Epic 42-44) successfully syncs ChemELN data (experiments, reactions, substrates, researchers) and creates structured pages with proper relationships. However, the practical knowledge embedded in ExpTube's video analysis (`actual_procedure` JSONB) is not yet surfaced, experiments lack quality indicators, and there's no "who to ask" functionality.

**Target state:** Every experiment page displays extracted practical notes prominently. Reaction type pages show ranked "Key Learnings" from high-quality experiments. Researcher profiles include computed expertise areas. Agents can query "who's the expert on Suzuki couplings?" and get a ranked list. Multi-tenant isolation is verified and enforced.

---

## Business Value

- **Institutional memory capture**: The practical notes, deviations, and observations from ExpTube video analysis become discoverable and searchable — preventing knowledge loss when researchers leave
- **Quality-driven decision making**: Quality scores enable agents and humans to prioritize learning from successful experiments with high yields and complete data
- **Accelerated onboarding**: New researchers can find "Key Learnings" aggregated from years of institutional experience, reducing trial-and-error
- **Expert discovery**: "Who to ask" sections surface the right experts for specific reaction types or substrates, enabling collaboration
- **Multi-tenant security**: Each institution's knowledge stays isolated, enabling SaaS deployment with confidence
- **Agent-friendly knowledge retrieval**: LLM agents can query quality scores and expertise profiles to provide better recommendations

---

## Architecture Summary

```
Practical Knowledge Enrichment Pipeline
────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│  ChemELN Database                                        │
│                                                           │
│  experiments table:                                       │
│    - actual_procedure JSONB (from ExpTube)               │
│      {                                                    │
│        "steps": [                                         │
│          {                                                │
│            "step_number": 1,                              │
│            "action": "Add substrate",                     │
│            "timestamp": "00:03:45",                       │
│            "deviation": "Used 10% excess vs. planned",    │
│            "observation": "Solution turned yellow"        │
│          }                                                │
│        ]                                                  │
│      }                                                    │
│    - yield_percent DECIMAL                               │
│    - status VARCHAR (completed, failed, in_progress)     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Sync Pipeline (Epic 42)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  SKB Database (pages + blocks)                           │
│                                                           │
│  Experiment page frontmatter:                            │
│    - chemeln_id: string                                  │
│    - yield_percent: number                               │
│    - status: string                                      │
│    - quality_score: number (1-5, computed by 45.2)       │
│                                                           │
│  Experiment page blocks:                                 │
│    - "Practical Notes" section (generated by 45.1)       │
│      - Deviations from planned procedure                 │
│      - Key observations with video timestamps            │
│      - Tips and learnings                                │
│      - Source attribution: ExpTube entry ID              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Enrichment (45.1, 45.2, 45.3)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Aggregation Pages (Reaction Types, Substrate Classes)  │
│                                                           │
│  "Key Learnings" section (45.3):                         │
│    ⭐⭐⭐ "Use 10% excess substrate for heteroaryl        │
│           couplings with electron-poor partners"         │
│         — [[Dr. Anna Mueller]] • [[EXP-2024-156]]        │
│           • Mar 2026 • Quality: 4.5/5                    │
│                                                           │
│    ⭐⭐ "Monitor solution color change at 50°C"          │
│         — [[Dr. James Chen]] • [[EXP-2024-089]]          │
│           • Jan 2026 • Quality: 4.0/5                    │
│                                                           │
│  "Who To Ask" section (45.5):                            │
│    1. [[Dr. Anna Mueller]] — 12 experiments,             │
│       avg 86% yield (most recent: Mar 2026)              │
│    2. [[Dr. James Chen]] — 8 experiments,                │
│       avg 82% yield (most recent: Feb 2026)              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Profile Computation (45.4)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Researcher Profile Pages                                │
│                                                           │
│  # Dr. Anna Mueller                                      │
│                                                           │
│  ## Expertise Profile (computed)                         │
│  - Primary areas: Suzuki coupling (12 exp),              │
│    Buchwald-Hartwig (8 exp), Negishi coupling (5 exp)    │
│  - Avg yields: Suzuki 86%, Buchwald 84%, Negishi 88%    │
│  - Key contributions:                                    │
│    • Optimized heteroaryl Suzuki protocol (4.5/5)       │
│    • Developed low-temp Buchwald method (4.0/5)         │
│                                                           │
│  ## Recent Experiments                                   │
│  (linked by wikilinks)                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-45.1: Practical Notes Extraction from Procedure Data — 5 points, Critical

**Delivers:** Parsing of `actual_procedure` JSONB from ChemELN experiments. Extraction of deviation notes (where actual differed from planned), observations, and tips embedded in procedure steps. Extraction of video timestamp references for source linking. Formatting as the "Practical Notes" section on experiment pages. Graceful handling of missing/empty actual_procedure. Source attribution (which ExpTube entry provided the data).

**Depends on:** Epic 42 (ChemELN sync pipeline foundation)

---

### SKB-45.2: Quality Scoring Model — 3 points, High

**Delivers:** Per-experiment quality score (1-5 scale) computed as: base score from yield (>90%=5, >80%=4, >70%=3, >60%=2, <60%=1), no yield data = 3 (neutral), adjust +0.5 for: has practical notes, has full procedure, has products with purity data, adjust -0.5 for: status=failed, no reagent data. Clamped to 1-5 range, rounded to nearest 0.5. Stored in frontmatter `quality_score` field. Used for ranking in aggregation pages.

**Depends on:** SKB-45.1 (practical notes must be extracted first)

---

### SKB-45.3: Key Learnings Extraction & Ranking — 5 points, Critical

**Delivers:** Extraction of actionable learnings from each experiment's practical notes. Ranking algorithm: `quality_score × recency_factor × specificity_score` where recency_factor (last 6mo=1.0, 6-12mo=0.8, 1-2yr=0.6, older=0.4) and specificity_score (specific tip with substrate/condition=1.0, general=0.7). Aggregation of top learnings on reaction type pages. Attribution: researcher wikilink + experiment wikilink + date. Star rating (⭐) for top 3 highest-scoring learnings per reaction type.

**Depends on:** SKB-45.2 (quality scores required for ranking)

---

### SKB-45.4: Researcher Expertise Computation — 3 points, High

**Delivers:** Count of experiments per reaction type per researcher. Identification of primary expertise areas (top 3 reaction types by count). Computation of avg yield per reaction type per researcher. Identification of key contributions (practical tips from high-quality experiments). Ranking of researchers by experience for each reaction type. Population of researcher profile pages with computed data.

**Depends on:** SKB-45.2 (quality scores needed for contribution ranking)

---

### SKB-45.5: "Who To Ask" Sections — 2 points, Medium

**Delivers:** Ranked lists on reaction type pages (researchers with experiment count, avg yield, most recent date). Ranked lists on substrate class pages (researchers with relevant substrate experience). Format: `[[Dr. Anna Mueller]] — 6 experiments, avg 84% yield (most recent: Mar 2026)`. Enable agent to suggest: "Talk to Dr. Mueller about heteroaryl Suzuki couplings."

**Depends on:** SKB-45.4 (expertise profiles must be computed)

---

### SKB-45.6: Multi-Tenant Isolation Verification — 2 points, Medium

**Delivers:** Verification that sync pipeline respects tenant boundaries (each institution's ChemELN maps to their SKB tenant only). Configuration via `CHEMELN_TENANT_ID` env var linking ChemELN instance to SKB tenant. Test suite with simulated multi-tenant scenario. Verification of no cross-tenant data leakage in page creation, search, or graph queries.

**Depends on:** Epic 42 (sync pipeline), SKB-45.1-45.5 (all enrichment features)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 45.1 | Parse actual_procedure JSONB; extract deviations/observations; handle missing data | Create experiment with actual_procedure, verify Practical Notes section rendered | Sync ChemELN experiment, verify notes appear on page |
| 45.2 | Quality score calculation for all scenarios; clamping; rounding | Compute scores for batch of experiments, verify database updates | Experiment page shows correct quality score |
| 45.3 | Extract learnings from notes text; ranking algorithm; specificity scoring | Generate Key Learnings for reaction type, verify ordering | Reaction type page shows ranked learnings with stars |
| 45.4 | Count experiments per researcher/reaction; avg yield computation | Build expertise profiles for all researchers, verify data | Researcher page shows computed expertise |
| 45.5 | Format "Who To Ask" sections; ranking by experience/yield | Generate sections for reaction types and substrate classes | Agent query returns correct expert recommendations |
| 45.6 | Tenant ID filtering in all queries; config parsing | Multi-tenant sync scenario, verify isolation | Cross-tenant queries return empty results |

---

## Implementation Order

```
45.1 → 45.2 → 45.3 → 45.4 → 45.5 → 45.6

┌────────┐
│ 45.1   │ Parse actual_procedure, extract notes
│ Notes  │
└────────┘
     │
     ▼
┌────────┐
│ 45.2   │ Compute quality scores
│Quality │
└────────┘
     │
     ├──────────────┐
     ▼              ▼
┌────────┐    ┌────────┐
│ 45.3   │    │ 45.4   │ Parallel: learnings + expertise
│Learning│    │Experts │
└────────┘    └────────┘
     │              │
     └──────┬───────┘
            ▼
       ┌────────┐
       │ 45.5   │ "Who To Ask" sections
       │WhoToAsk│
       └────────┘
            │
            ▼
       ┌────────┐
       │ 45.6   │ Multi-tenant verification (final)
       │Tenant  │
       └────────┘
```

**Rationale:**
- **45.1 first**: Practical notes are the foundation — all other features depend on this data
- **45.2 next**: Quality scores are required by 45.3 and 45.4 for ranking
- **45.3 and 45.4 parallel**: Both consume quality scores but don't depend on each other
- **45.5 after 45.4**: "Who To Ask" needs expertise profiles to be computed
- **45.6 last**: Integration testing across all features to ensure tenant isolation

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- TypeScript strict mode — no `any` types allowed
- All page content generated via `PageContentGenerator` utility (Epic 42 pattern)
- JSONB parsing must handle malformed data gracefully (log warning, skip field)
- Quality scores stored as `DECIMAL(3,1)` in database (1.0 to 5.0 with 0.5 increments)
- Ranking algorithms must be deterministic (same input → same output) for testability
- All researcher names formatted as wikilinks: `[[Dr. FirstName LastName]]`
- All experiment references formatted as wikilinks: `[[EXP-YYYY-NNN]]`
- Video timestamps formatted as `MM:SS` with link to ExpTube entry if available
- Enrichment runs during sync pipeline (not separate batch job) to keep data fresh
- Practical notes section max length: 2000 chars (truncate with "... [see full video]" link)
- Key learnings: max 10 per reaction type page (top-ranked only)
- "Who To Ask" lists: max 5 researchers per page
- All text content must be sanitized to prevent XSS (use DOMPurify on client)
- Sync pipeline must be idempotent (re-running doesn't duplicate content)
- All wikilinks must be validated (target page exists or will be created)

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/chemeln/enrichment/practical-notes.ts` — Parse actual_procedure, extract notes
- `src/lib/chemeln/enrichment/quality-score.ts` — Compute quality scores
- `src/lib/chemeln/enrichment/key-learnings.ts` — Extract and rank learnings
- `src/lib/chemeln/enrichment/researcher-expertise.ts` — Build expertise profiles
- `src/lib/chemeln/enrichment/who-to-ask.ts` — Generate "Who To Ask" sections
- `src/lib/chemeln/enrichment/tenant-isolation.ts` — Multi-tenant utilities
- `src/lib/chemeln/enrichment/types.ts` — Shared types for enrichment
- `src/__tests__/lib/chemeln/enrichment/practical-notes.test.ts`
- `src/__tests__/lib/chemeln/enrichment/quality-score.test.ts`
- `src/__tests__/lib/chemeln/enrichment/key-learnings.test.ts`
- `src/__tests__/lib/chemeln/enrichment/researcher-expertise.test.ts`
- `src/__tests__/lib/chemeln/enrichment/who-to-ask.test.ts`
- `src/__tests__/lib/chemeln/enrichment/tenant-isolation.test.ts`
- `tests/e2e/chemeln-enrichment.spec.ts` — E2E tests for enrichment pipeline

### Modified Files
- `src/lib/chemeln/sync/experiment-sync.ts` — Call enrichment modules during sync
- `src/lib/chemeln/sync/researcher-sync.ts` — Add expertise profile generation
- `src/lib/chemeln/sync/reaction-type-sync.ts` — Add Key Learnings and Who To Ask sections
- `src/lib/chemeln/sync/substrate-class-sync.ts` — Add Who To Ask sections
- `prisma/schema.prisma` — Add `quality_score` field to experiment pages metadata
- `src/lib/chemeln/types.ts` — Add ActualProcedure, QualityScore, KeyLearning types
- `.env.example` — Add `CHEMELN_TENANT_ID` example

---

## Example: actual_procedure JSONB Structure

**ChemELN `experiments.actual_procedure` field:**

```json
{
  "exptube_entry_id": "ET-2024-0156",
  "video_url": "https://exptube.internal/videos/ET-2024-0156",
  "steps": [
    {
      "step_number": 1,
      "planned_action": "Add 1.0 equiv substrate (500 mg)",
      "actual_action": "Add 1.1 equiv substrate (550 mg)",
      "timestamp": "00:03:45",
      "deviation": "Used 10% excess to ensure complete conversion",
      "observation": "White solid dissolved completely within 2 minutes"
    },
    {
      "step_number": 2,
      "planned_action": "Heat to 80°C",
      "actual_action": "Heat to 75°C",
      "timestamp": "00:08:12",
      "deviation": "Reduced temperature due to color change indicating early reaction start",
      "observation": "Solution turned deep yellow at 50°C, continued to orange at 75°C"
    },
    {
      "step_number": 3,
      "planned_action": "Stir for 2 hours",
      "actual_action": "Stir for 2.5 hours",
      "timestamp": "00:10:30",
      "deviation": "Extended reaction time for complete conversion (TLC monitoring)",
      "observation": "TLC showed starting material still present at 2h mark"
    }
  ],
  "overall_notes": "Heteroaryl substrate required excess and lower temperature than expected. Monitor color change as early indicator.",
  "tips": [
    "Use 10% excess substrate for heteroaryl couplings with electron-poor partners",
    "Monitor solution color change at 50°C as indicator of reaction initiation",
    "TLC monitoring recommended at 2h mark for this substrate class"
  ]
}
```

**SKB Experiment Page "Practical Notes" Section (generated by 45.1):**

```markdown
## Practical Notes

### Deviations from Planned Procedure

- **Step 1 (00:03:45)**: Used 10% excess substrate (550 mg vs. planned 500 mg)
  - *Reason*: To ensure complete conversion
  - *Observation*: White solid dissolved completely within 2 minutes

- **Step 2 (00:08:12)**: Heated to 75°C instead of planned 80°C
  - *Reason*: Reduced temperature due to color change indicating early reaction start
  - *Observation*: Solution turned deep yellow at 50°C, continued to orange at 75°C

- **Step 3 (00:10:30)**: Extended stirring to 2.5 hours (planned: 2 hours)
  - *Reason*: Extended reaction time for complete conversion (TLC monitoring)
  - *Observation*: TLC showed starting material still present at 2h mark

### Key Takeaways

> **Heteroaryl substrate required excess and lower temperature than expected. Monitor color change as early indicator.**

- Use 10% excess substrate for heteroaryl couplings with electron-poor partners
- Monitor solution color change at 50°C as indicator of reaction initiation
- TLC monitoring recommended at 2h mark for this substrate class

---
*Source: ExpTube entry [ET-2024-0156](https://exptube.internal/videos/ET-2024-0156) • Video recorded: 2024-03-15*
```

---

**Last Updated:** 2026-03-21
