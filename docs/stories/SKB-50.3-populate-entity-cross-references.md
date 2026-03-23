# SKB-50.3: Populate Entity Cross-References During Sync

**Story ID:** SKB-50.3
**Epic:** EPIC-50 (Chemistry KB — Graph Interconnectivity)
**Points:** 8
**Priority:** High
**Status:** Not Started
**Depends on:** SKB-50.1, SKB-50.2

---

## User Story

As a knowledge base user, I want entity pages (chemicals, reaction types, researchers, substrate classes) to show their connections to other entities, so I can discover which chemicals are used in which reaction types, which researchers work on what, and how everything connects.

---

## What This Story Delivers

Currently, entity pages are created with mostly empty "Related" sections. The templates support cross-reference fields (e.g., `relatedReactionTypes`, `relatedResearchers`), but the sync script doesn't populate them from experiment data.

This story adds a cross-reference aggregation step to the chemistry KB sync that:
1. Reads all experiment data after experiment pages are synced
2. Aggregates which chemicals, researchers, reaction types, and substrate classes appear together
3. Passes this aggregated data to entity page templates so they generate proper `[[wikilinks]]`

---

## Problem

Entity pages currently look like:

```markdown
# Pd(PPh3)4

## Overview
Tetrakis(triphenylphosphine)palladium(0)...

## Used in Experiments
(empty)

## Related Reaction Types
(empty)

## Related Researchers
(empty)
```

The data to fill these sections IS available from experiments — we just don't aggregate and pass it.

---

## Technical Specification

### Cross-Reference Aggregation

After all experiment pages are synced, build aggregation maps:

```typescript
interface CrossReferenceData {
  // Chemical → what it connects to
  chemicalExperiments: Map<string, string[]>;      // chemical name → [experiment page titles]
  chemicalReactionTypes: Map<string, string[]>;     // chemical name → [reaction type names]
  chemicalResearchers: Map<string, string[]>;       // chemical name → [researcher names]

  // Reaction Type → what it connects to
  reactionExperiments: Map<string, string[]>;       // reaction type → [experiment page titles]
  reactionCatalysts: Map<string, string[]>;         // reaction type → [catalyst chemical names]
  reactionResearchers: Map<string, string[]>;       // reaction type → [researcher names]
  reactionSubstrates: Map<string, string[]>;        // reaction type → [substrate class names]

  // Researcher → what they connect to
  researcherExperiments: Map<string, string[]>;     // researcher → [experiment page titles]
  researcherReactionTypes: Map<string, string[]>;   // researcher → [reaction type names]

  // Substrate Class → what it connects to
  substrateExperiments: Map<string, string[]>;      // substrate → [experiment page titles]
  substrateReactionTypes: Map<string, string[]>;    // substrate → [reaction type names]
  substrateResearchers: Map<string, string[]>;      // substrate → [researcher names]
}
```

### Aggregation Logic

```typescript
function aggregateCrossReferences(experiments: ExperimentPageData[]): CrossReferenceData {
  // For each experiment:
  //   - Extract: chemicals (from reagents), reaction type, researcher, substrate class
  //   - Build experiment page title: `${elnId}: ${shortTitle}`
  //   - Add to all relevant maps
  //
  // Example: Experiment "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine"
  //   researcher: "Dr. Anna Mueller"
  //   reactionType: "Suzuki Coupling"
  //   chemicals: ["4-Bromopyridine", "Pd(PPh3)4", "K2CO3"]
  //   substrateClass: "Aryl Halides"
  //
  // Results in:
  //   chemicalExperiments["Pd(PPh3)4"] += ["EXP-2026-0042: Suzuki Coupling..."]
  //   chemicalReactionTypes["Pd(PPh3)4"] += ["Suzuki Coupling"]
  //   chemicalResearchers["Pd(PPh3)4"] += ["Dr. Anna Mueller"]
  //   reactionExperiments["Suzuki Coupling"] += ["EXP-2026-0042: ..."]
  //   reactionCatalysts["Suzuki Coupling"] += ["Pd(PPh3)4"]
  //   ... etc
}
```

### Template Updates

Each entity template function needs to accept and render the aggregated data:

#### `generateChemicalPage(data, crossRefs)`
```markdown
## Used in Experiments
- [[EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine]]
- [[EXP-2026-0045: Heck Reaction with Pd(PPh3)4]]

## Related Reaction Types
- [[Suzuki Coupling]]
- [[Heck Reaction]]

## Related Researchers
- [[Dr. Anna Mueller]]
- [[Dr. James Chen]]
```

#### `generateReactionTypePage(data, crossRefs)`
```markdown
## Representative Experiments
- [[EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine]]

## Common Catalysts
- [[Pd(PPh3)4]]
- [[Pd(dppf)Cl2]]

## Who to Ask
- [[Dr. Anna Mueller]] — 5 experiments
- [[Dr. James Chen]] — 2 experiments

## Substrate Classes
- [[Aryl Halides]]
```

#### `generateResearcherPage(data, crossRefs)`
```markdown
## Recent Experiments
- [[EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine]]
- [[EXP-2026-0045: Heck Reaction with Pd(PPh3)4]]

## Expertise Areas
- [[Suzuki Coupling]] — 3 experiments
- [[Heck Reaction]] — 2 experiments
```

#### `generateSubstrateClassPage(data, crossRefs)`
```markdown
## Representative Experiments
- [[EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine]]

## Common Reactions
- [[Suzuki Coupling]]

## Who Has Experience
- [[Dr. Anna Mueller]]
```

### Sync Orchestrator Changes

The sync orchestrator needs to be updated to:
1. Sync all experiment pages first (as currently done)
2. **NEW:** Call `aggregateCrossReferences()` with all experiment data
3. Pass cross-reference data to entity page sync functions
4. Entity page templates now receive and render this data

---

## Files to Modify

- `src/lib/chemistryKb/templates.ts` — Update all 4 entity template functions to accept and render cross-reference data
- `src/lib/chemEln/sync/orchestrator.ts` (or equivalent) — Add aggregation step between experiment sync and entity sync
- `src/lib/chemEln/sync/writer.ts` (or equivalent) — Pass cross-reference data to entity templates

## Files to Create

- None (aggregation logic goes in orchestrator or a new helper within the sync directory)

---

## Acceptance Criteria

- [ ] Chemical pages list experiments they appear in (as `[[wikilinks]]`)
- [ ] Chemical pages list reaction types where they're used (as `[[wikilinks]]`)
- [ ] Chemical pages list researchers who use them (as `[[wikilinks]]`)
- [ ] Reaction Type pages list representative experiments with full title wikilinks
- [ ] Reaction Type pages list common catalysts as `[[wikilinks]]`
- [ ] Reaction Type pages list researchers and substrate classes
- [ ] Researcher pages list their recent experiments as `[[wikilinks]]`
- [ ] Researcher pages list their expertise areas (reaction types) as `[[wikilinks]]`
- [ ] Substrate Class pages list associated reaction types and researchers
- [ ] All cross-reference data generated from experiment data (not hardcoded)
- [ ] De-duplicated: each entity appears once in a list, not multiple times

---

## Verification Strategy

1. Run chemistry sync with updated templates
2. Open a chemical page (e.g., Pd(PPh3)4) — verify "Used in Experiments", "Related Reaction Types", "Related Researchers" sections are populated with clickable wikilinks
3. Open a reaction type page — verify experiments, catalysts, researchers listed
4. Check `PageLink` table — entity pages should now have edges to experiments, other entities
5. View knowledge graph — should show a rich web of connections instead of isolated nodes

---

## Implementation Notes

- This is the largest story (8 points) because it touches the sync orchestrator and all 4 entity templates
- The aggregation is purely derived from experiment data — no new data sources needed
- Lists should be de-duplicated and sorted (alphabetically for names, chronologically for experiments)
- Limit experiment lists to a reasonable number (e.g., 10 most recent) to avoid huge pages
- If an experiment references a chemical/researcher/etc. that doesn't have its own page yet, still include the wikilink — it will be unresolved but signals the connection exists

---

**Last Updated:** 2026-03-23
