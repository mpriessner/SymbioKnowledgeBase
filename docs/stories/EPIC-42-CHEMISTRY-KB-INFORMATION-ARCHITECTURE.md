# Epic 42: Chemistry Knowledge Base — Information Architecture

**Epic ID:** EPIC-42
**Created:** 2026-03-21
**Total Story Points:** 13
**Priority:** Critical
**Status:** Planned

## Epic Overview

Epic 42 defines the conceptual model, page schemas, naming conventions, templates, and folder hierarchy for the Chemistry Knowledge Base — a subsystem within SymbioKnowledgeBase that organizes institutional chemistry knowledge from ChemELN experiments. This is the foundation that all subsequent epics (43–47) depend on.

The Chemistry KB is NOT a database mirror. It organizes **practical, institutional knowledge** — the tacit know-how that researchers accumulate but rarely document. Chemistry concepts (reaction types, chemicals) provide the structural skeleton; practical insights (what worked, what didn't, who to ask) are the actual value.

### Design Principles

1. **Practical over theoretical** — Focus on "what our lab learned" not "what is a Suzuki coupling"
2. **Attribution everywhere** — Every insight traces to a researcher + experiment + timestamp
3. **Contextual specificity** — Same reaction type can need very different advice depending on substrate, scale, functional groups
4. **Multi-user institutional growth** — More users → more knowledge → smarter AI for everyone
5. **Agent-navigable** — Page hierarchy, tags, one-liners, and wikilinks enable efficient agent traversal

### Key Decisions

- Five page types: Experiment, Chemical, ReactionType, Researcher, SubstrateClass
- Wikilinks as the primary cross-referencing mechanism (creates graph edges automatically)
- Tags for structured filtering (eln:, cas:, reaction:, researcher:, substrate-class:, scale:, challenge:)
- Quality scoring on experiment pages (yield-based + completeness-based)
- Frontmatter metadata enables both agent filtering and UI display

### Why This Matters

Without a solid information architecture, subsequent epics will create inconsistent, hard-to-navigate content. The decisions made here will affect:

- **EPIC-43** (ChemELN Bridge) — Needs to know what frontmatter fields to populate
- **EPIC-44** (Chemical Enrichment) — Needs consistent chemical page schemas
- **EPIC-45** (Aggregation Pages) — Needs to know how to query and group pages
- **EPIC-46** (Agent Context Retrieval) — Needs tag taxonomy and wikilink conventions
- **EPIC-47** (Continuous Sync) — Needs stable page identifiers and update semantics

A well-designed information architecture means:
- Faster agent retrieval (proper tags + hierarchy)
- Better knowledge graph connectivity (clear wikilink conventions)
- Easier maintenance (templates enforce consistency)
- Scalable growth (new page types can extend the taxonomy)

## Business Value

- **Consistency** — Templates ensure every experiment captures the same practical knowledge sections
- **Discoverability** — Tag taxonomy enables contextual agent retrieval (EPIC-46)
- **Graph Connectivity** — Wikilink conventions ensure the knowledge graph connects meaningfully
- **Extensibility** — Well-defined schemas make it easy to add new page types in the future
- **Multi-tenant Ready** — Namespace design supports multiple chemistry labs on the same platform

Without this epic, we would have:
- Inconsistent page structures across different experiment imports
- Broken wikilinks due to unclear naming conventions
- Poor agent retrieval because tags are ad-hoc and unstructured
- Difficulty aggregating insights across experiments (EPIC-45)
- Higher maintenance burden fixing structural issues later

## Architecture Summary

```
Chemistry KB Page Hierarchy
────────────────────────────

Chemistry KB/                          ← Root page (agent entry point)
├── Experiments/                       ← Parent page for all experiments
│   ├── EXP-2026-0042: Suzuki...      ← Individual experiment page
│   ├── EXP-2026-0043: Grignard...
│   └── ...
├── Reaction Types/                    ← Parent page for reaction types
│   ├── Suzuki Coupling                ← Aggregation page (links to experiments)
│   ├── Grignard Reaction
│   └── ...
├── Chemicals/                         ← Parent page for chemicals
│   ├── Pd(PPh3)4                      ← Practical info + usage links
│   ├── THF
│   └── ...
├── Researchers/                       ← Parent page for researcher profiles
│   ├── Dr. Anna Mueller               ← Expertise + experiment history
│   └── ...
└── Substrate Classes/                 ← Parent page for substrate groupings
    ├── Heteroaryl Halides             ← Cross-experiment learnings
    └── ...

Wikilink Graph (example edges):
─────────────────────────────

EXP-2026-0042 ──[[Suzuki Coupling]]──► Suzuki Coupling
EXP-2026-0042 ──[[Pd(PPh3)4]]────────► Pd(PPh3)4
EXP-2026-0042 ──[[Dr. Anna Mueller]]─► Dr. Anna Mueller
EXP-2026-0042 ──[[Heteroaryl Halides]]► Heteroaryl Halides
Suzuki Coupling ──[[EXP-2026-0042]]──► EXP-2026-0042 (backlink)
Pd(PPh3)4 ──[[EXP-2026-0042]]────────► EXP-2026-0042 (backlink)

Tag Taxonomy:
─────────────
eln:EXP-2026-0042          → Links to ChemELN experiment ID
cas:14221-01-3             → Links to CAS registry number
reaction:suzuki-coupling   → Reaction type classification
researcher:mueller         → Researcher attribution
substrate-class:heteroaryl → Substrate classification
scale:medium               → Scale category (small/medium/large)
challenge:protodeboronation → Specific challenge faced
quality:4                  → Quality score (1-5)

Frontmatter Schema Example (Experiment):
─────────────────────────────────────────
---
title: "EXP-2026-0042: Suzuki Coupling of Aryl Bromide"
icon: "🧪"
tags:
  - eln:EXP-2026-0042
  - reaction:suzuki-coupling
  - researcher:mueller
  - substrate-class:heteroaryl
  - scale:medium
  - challenge:protodeboronation
  - quality:4
eln_id: "EXP-2026-0042"
researcher: "Dr. Anna Mueller"
date: "2026-03-15"
status: "completed"
reaction_type: "Suzuki Coupling"
substrate_class: "Heteroaryl Halides"
scale_category: "medium"
quality_score: 4
---
```

## Stories Breakdown

### SKB-42.1: Page Type Taxonomy & Frontmatter Schemas — 3 points, Critical

Define the 5 page types (Experiment, Chemical, ReactionType, Researcher, SubstrateClass) with complete YAML frontmatter schemas for each. Define the tag taxonomy with namespaced prefixes. Define quality_score semantics and computation rules.

**Depends on:** None (foundational)

**Output:** `docs/chemistry-kb/PAGE-TYPE-TAXONOMY.md` with complete schema definitions

### SKB-42.2: Wikilink Naming Conventions & Resolution Rules — 2 points, High

Define how each page type is named for wikilink resolution: experiments by ELN ID + title, chemicals by common name (with CAS in frontmatter), reaction types by common name, researchers by full name. Define synonym/alias handling (e.g., "THF" = "Tetrahydrofuran"). Define disambiguation rules when names collide.

**Depends on:** SKB-42.1

**Output:** `docs/chemistry-kb/NAMING-CONVENTIONS.md` with resolution rules

### SKB-42.3: Markdown Page Templates — 3 points, Critical

Create complete Markdown templates for each page type with all standard sections, placeholder wikilinks, and frontmatter. Templates must pass SKB's markdownToTiptap() conversion. Include: Experiment (metadata, conditions table, reagents, procedure, results, practical notes, related), Chemical (properties, practical notes, used-in), ReactionType (institutional experience, key learnings, common pitfalls, who to ask), Researcher (expertise areas, recent experiments, key contributions), SubstrateClass (challenges, what worked, who has experience).

**Depends on:** SKB-42.1, SKB-42.2

**Output:** 5 template files in `docs/chemistry-kb/templates/`

### SKB-42.4: KB Folder Hierarchy & Parent Pages — 2 points, High

Create the root "Chemistry KB" page and category parent pages (Experiments, Reaction Types, Chemicals, Researchers, Substrate Classes) in SKB via the Agent API. Create the "Chemistry KB Index" page as the agent entry point with navigation guidance.

**Depends on:** SKB-42.3

**Output:** Script `scripts/setup-chemistry-kb-hierarchy.ts` + 6 pages created in SKB

### SKB-42.5: Validation & Round-Trip Testing — 3 points, High

Create 2-3 sample experiment pages, 5 chemical pages, 1 reaction type page, 1 researcher page using the templates. Verify they render correctly in SKB UI. Verify wikilinks resolve and create graph edges. Verify markdown round-trips without data loss. Verify the graph visualization shows the expected interconnected structure.

**Depends on:** SKB-42.4

**Output:** Sample pages in SKB + validation report documenting test results

## Test Coverage Requirements

| Story | Validation Method | Expected Outcome |
|-------|------------------|------------------|
| 42.1 | Schema review — all frontmatter fields documented with types and examples | 5 complete page type schemas + tag taxonomy documented |
| 42.2 | Naming convention test — 10+ sample names resolve correctly | All test cases resolve without ambiguity |
| 42.3 | Templates pass markdownToTiptap() without errors; render correctly in SKB UI | All 5 templates convert and render successfully |
| 42.4 | Parent pages exist in SKB; page tree shows correct hierarchy | 6 pages created; tree API returns expected structure |
| 42.5 | Sample pages render, wikilinks resolve, graph shows edges, round-trip works | 12+ sample pages fully functional in SKB |

## Implementation Order

```
42.1 → 42.2 → 42.3 → 42.4 → 42.5

┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 42.1   │──▶│ 42.2   │──▶│ 42.3   │──▶│ 42.4   │──▶│ 42.5   │
│Taxonomy│   │Naming  │   │Templates│  │Hierarchy│  │Validate│
│& Schema│   │Rules   │   │        │   │& Pages │   │& Test  │
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘

Critical Path: All stories are sequential
Parallelizable: None (each depends on previous)
```

### Why This Order?

1. **42.1 first** — Can't define naming conventions without knowing what fields exist in frontmatter
2. **42.2 next** — Templates need to know how to format wikilinks
3. **42.3 next** — Can't create page hierarchy without templates to instantiate
4. **42.4 next** — Need parent pages before we can test child pages
5. **42.5 last** — Integration test validates the entire system

## Shared Constraints

### Technical Constraints

- All page types must use valid YAML frontmatter parseable by SKB's existing frontmatter parser
- Wikilink names must be unique within a tenant (no two pages with the same title)
- Templates must be valid Markdown that passes the existing markdownToTiptap() conversion
- Tag prefixes must not conflict with existing SKB tag conventions
- Page hierarchy must respect SKB's parent-child relationship model
- Chemical CAS numbers must be valid and unique within the tenant

### Content Constraints

- All content authored in English
- Chemical names follow IUPAC or common usage (whichever is more recognizable)
- Researcher names follow "Dr. FirstName LastName" or "FirstName LastName" format
- ELN IDs follow the ChemELN format: EXP-YYYY-NNNN
- Dates use ISO 8601 format (YYYY-MM-DD)
- Quality scores are integers from 1-5

### Performance Constraints

- Page creation must complete within 5 seconds per page
- Wikilink resolution must not require full-text search (use exact title matching)
- Tag queries must be indexed for fast filtering
- Graph edge creation must be automatic (no manual linking required)

### Business Constraints

- Multi-tenant isolation — one lab cannot see another lab's chemistry KB
- User attribution — all edits traced to a specific researcher
- Audit trail — changes to experiment pages must be versioned
- Data retention — experiment pages cannot be deleted (only archived)

## Files Created/Modified by This Epic

### New Files

**Documentation:**
- `docs/chemistry-kb/PAGE-TYPE-TAXONOMY.md` — Schema definitions for all 5 page types
- `docs/chemistry-kb/NAMING-CONVENTIONS.md` — Wikilink resolution rules and disambiguation
- `docs/chemistry-kb/README.md` — Overview of chemistry KB architecture

**Templates:**
- `docs/chemistry-kb/templates/experiment-template.md` — Experiment page template
- `docs/chemistry-kb/templates/chemical-template.md` — Chemical page template
- `docs/chemistry-kb/templates/reaction-type-template.md` — Reaction type template
- `docs/chemistry-kb/templates/researcher-template.md` — Researcher profile template
- `docs/chemistry-kb/templates/substrate-class-template.md` — Substrate class template

**Scripts:**
- `scripts/setup-chemistry-kb-hierarchy.ts` — Creates parent pages and hierarchy

**Tests:**
- `tests/chemistry-kb/page-rendering.test.ts` — Validates templates render correctly
- `tests/chemistry-kb/wikilink-resolution.test.ts` — Validates naming conventions
- `tests/chemistry-kb/round-trip.test.ts` — Validates markdown conversion

### Modified Files

None (this epic is purely additive)

### Pages Created in SKB (by Story 42.4)

- Chemistry KB (root page)
- Chemistry KB/Experiments (parent page)
- Chemistry KB/Reaction Types (parent page)
- Chemistry KB/Chemicals (parent page)
- Chemistry KB/Researchers (parent page)
- Chemistry KB/Substrate Classes (parent page)

### Sample Pages Created in SKB (by Story 42.5)

- 3 experiment pages
- 5 chemical pages
- 1 reaction type page
- 1 researcher page
- 1 substrate class page

## Risk Assessment

### High Risk

- **Wikilink naming collisions** — If two chemicals share a common name, disambiguation is required
  - Mitigation: Define clear disambiguation rules in SKB-42.2 (append CAS number)
- **Template rendering failures** — Markdown templates might not convert cleanly to Tiptap
  - Mitigation: Test templates early in SKB-42.3 with real markdownToTiptap() calls

### Medium Risk

- **Tag taxonomy evolution** — Future page types might need new tag namespaces
  - Mitigation: Keep taxonomy extensible; document versioning strategy
- **Performance degradation** — Large chemistry KBs (10,000+ experiments) might slow down tag queries
  - Mitigation: Ensure tag queries use indexed fields; monitor performance in SKB-42.5

### Low Risk

- **Researcher name changes** — If a researcher changes their name, wikilinks might break
  - Mitigation: Use stable researcher IDs in frontmatter; display name is just metadata
- **CAS number errors** — ChemELN might provide incorrect CAS numbers
  - Mitigation: Validate CAS checksums in EPIC-44 (Chemical Enrichment)

## Success Metrics

### For SKB-42.1

- All 5 page types have complete frontmatter schemas
- Tag taxonomy covers all expected use cases (filtering by reaction type, researcher, substrate, scale, challenge)
- Quality score algorithm is documented and testable

### For SKB-42.2

- 100% of test wikilinks resolve to the correct page
- Synonym handling works for common abbreviations (THF, DMF, DMSO)
- Disambiguation rules handle edge cases (same chemical name, different CAS)

### For SKB-42.3

- All 5 templates pass markdownToTiptap() conversion without errors
- Templates render correctly in SKB UI (no broken formatting)
- Templates contain all required sections for each page type

### For SKB-42.4

- Page tree API returns expected hierarchy (6 pages total)
- Parent-child relationships are correct
- "Chemistry KB Index" page provides clear navigation for agents

### For SKB-42.5

- 12+ sample pages render correctly in SKB UI
- Wikilinks create visible graph edges in graph visualization
- Round-trip markdown conversion preserves all content
- No schema validation errors or rendering failures

## Future Considerations

### Potential New Page Types

- **AnalyticalMethod** — NMR, HPLC, LCMS techniques and tips
- **SafetyIncident** — Near-misses and lessons learned
- **Equipment** — Specific instruments and their quirks
- **Vendor** — Preferred suppliers for specific reagents

### Schema Evolution

- Version frontmatter schemas (e.g., `schema_version: 1.0`)
- Support migration scripts for schema changes
- Backward compatibility for older experiment pages

### Agent Enhancements

- Natural language query → tag filter translation
- Contextual retrieval based on current experiment context
- Proactive suggestions ("researchers working on similar substrates")

**Last Updated:** 2026-03-21
