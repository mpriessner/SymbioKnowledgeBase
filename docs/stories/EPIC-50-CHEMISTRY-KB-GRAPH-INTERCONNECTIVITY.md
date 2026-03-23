# Epic 50: Chemistry KB — Graph Interconnectivity (Phase 1)

**Epic ID:** EPIC-50
**Created:** 2026-03-23
**Total Story Points:** 21
**Priority:** High
**Status:** Not Started
**Dependencies:** EPIC-42 (Chemistry KB structure must exist), EPIC-31 (Markdown mirror)

---

## Epic Overview

The Chemistry KB currently mirrors ChemELN data as pages but has **sparse graph connectivity**. Experiments have wikilinks to chemicals and researchers, but several important connections are broken or missing entirely. This results in a knowledge graph that barely lights up — you see isolated nodes instead of a rich web of interconnected knowledge.

This epic fixes the broken links and adds the missing ones so the graph becomes genuinely useful for both humans and agents navigating chemistry knowledge.

### What's Broken

1. **Experiment → Reaction Type**: The experiment template generates `[[Suzuki Coupling]]` as a wikilink in the Metadata table AND in Related Pages. However, when the markdown is converted to TipTap JSON and stored, the wikilinks inside markdown tables may not survive the round-trip. The mirrored `.md` files show plain text like `**Reaction Type:** Suzuki Coupling` instead of `**Reaction Type:** [[Suzuki Coupling]]`. The wikilink node is lost during deserialization because the markdown parser treats table cell content as inline text, not as containing wikilink syntax.

2. **Experiment → Experiment cross-links**: The template has a "Related Experiments" section, and the transformer populates `relatedExperiments` with `[[EXP-YYYY-NNNN]]` links. But the current mirrored pages show plain text like `- EXP-2026-0043: Follow-up optimization` without the `[[]]` wikilink syntax, meaning no PageLink records are created for experiment cross-references.

### What's Missing

3. **Reaction Type → Experiments**: The Reaction Type page template has a "Representative Experiments" section with `[[EXP-YYYY-NNNN]]` references, but these use the ELN ID format, not the full page title. The wikilink resolver does case-insensitive title matching, so `[[EXP-2026-0042]]` won't match a page titled `"EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine"`. These links silently fail to resolve.

4. **Reaction Type → Chemicals**: The template supports `commonCatalysts` as wikilinks (`[[Pd(PPh3)4]]`), but the sync script doesn't populate this field from aggregated experiment data.

5. **Chemical → Reaction Types / Researchers**: The chemical template supports `relatedReactionTypes` and `relatedResearchers` as wikilinks, but the sync script doesn't populate these from experiment data.

6. **Substrate Class → Reaction Types / Researchers**: Same issue — template supports cross-links, but sync doesn't populate them.

### Root Cause Analysis

The problems fall into two categories:

**A. Template/Serialization issues (Stories 50.1, 50.2):**
- Wikilinks inside markdown tables may not survive the TipTap round-trip
- Related experiment references use short ELN IDs instead of full page titles

**B. Data population issues (Stories 50.3, 50.4):**
- The sync script creates entity pages (chemicals, reaction types, researchers, substrate classes) with mostly empty "Related" sections
- Cross-reference data IS available from experiments but isn't aggregated and passed to entity page templates

### What This Epic Fixes

1. **Fix wikilink persistence** — Ensure `[[wikilinks]]` in experiment pages survive the TipTap round-trip (may require fixes in the markdown deserializer's table cell handling, or restructuring the template to avoid wikilinks inside tables)
2. **Fix experiment cross-references** — Use full page titles in `[[EXP-YYYY-NNNN: Title]]` format so the wikilink resolver can match them
3. **Populate entity cross-references** — During sync, aggregate experiment data to populate chemical, reaction type, researcher, and substrate class pages with proper wikilinks to each other
4. **Rebuild PageLinks** — After fixing templates, run `rebuildAllPageLinks()` to create correct PageLink records from the fixed wikilinks

---

## Business Value

- **Rich knowledge graph**: Instead of isolated nodes, the graph shows the full web of connections — which experiments used which chemicals, which researchers work on which reaction types, which substrate classes are associated with which challenges
- **Agent navigation**: An agent can traverse from a chemical → experiments that use it → the reaction type → other experiments → researchers with expertise. This is the core value of a knowledge base.
- **Human discovery**: Clicking through the graph reveals non-obvious connections ("Dr. Mueller's experiments with Pd(PPh3)4 consistently give higher yields — maybe she has a better catalyst handling protocol")

---

## Stories Breakdown

### SKB-50.1: Fix Wikilink Persistence in Experiment Pages — 5 points, High

**Problem:** Wikilinks like `[[Suzuki Coupling]]` and `[[Dr. Anna Mueller]]` inside markdown table cells are lost during the markdown → TipTap → markdown round-trip. The mirrored pages show plain text.

**Root cause investigation needed:** Check whether:
a) The markdown deserializer (`markdownToTiptap`) strips wikilinks from table cells
b) The TipTap table extension doesn't support wikilink nodes inside table cells
c) The wikilink pre-processor regex doesn't run inside table cell content

**Likely fix:** Restructure the experiment template's Metadata section from a markdown table to a definition list or headed paragraphs. Tables are fragile for inline nodes. Replace:

```markdown
| **Reaction Type** | [[Suzuki Coupling]] |
```

With:

```markdown
**Reaction Type:** [[Suzuki Coupling]]
```

This format is already used in the mirrored pages and wikilinks in regular paragraphs DO survive the round-trip (the Reagents section already uses `[[chemical]]` in list items successfully).

**Acceptance criteria:**
- [ ] Experiment pages contain working `[[wikilinks]]` for: researcher, reaction type, substrate class
- [ ] Chemical names in Reagents section remain as `[[wikilinks]]`
- [ ] Related Experiments section uses `[[full title]]` wikilinks
- [ ] Related Pages section has working wikilinks
- [ ] After sync, PageLink records are created for all wikilinks
- [ ] Existing experiment data is not lost (only template format changes)

**Depends on:** Nothing

---

### SKB-50.2: Fix Experiment Cross-Reference Format — 3 points, High

**Problem:** Related experiment references use `[[EXP-2026-0042]]` (short ELN ID) but page titles are `"EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine"`. The wikilink resolver can't match partial titles.

**Fix:** Change the template and transformer to use full page titles in related experiment links:
- `[[EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine]]` instead of `[[EXP-2026-0042]]`
- The `RelatedExperiment` interface already has `elnId` and `description` — combine them into the wikilink
- Also update Reaction Type, Researcher, and Substrate Class templates where they reference experiments

**Acceptance criteria:**
- [ ] `RelatedExperiment` references use `[[EXP-YYYY-NNNN: Short Title]]` format
- [ ] Wikilink resolver matches full experiment titles
- [ ] PageLink records created for experiment cross-references
- [ ] All templates updated: experiment, reaction type, researcher, substrate class

**Depends on:** SKB-50.1

---

### SKB-50.3: Populate Entity Cross-References During Sync — 8 points, High

**Problem:** Entity pages (chemicals, reaction types, researchers, substrate classes) are created with empty "Related" sections because the sync script doesn't aggregate cross-reference data from experiments.

**Fix:** During the chemistry KB sync, after all experiment pages are created/updated:
1. Aggregate which chemicals appear in which experiments and reaction types
2. Aggregate which researchers work on which reaction types and with which chemicals
3. Aggregate which substrate classes are associated with which reaction types
4. Pass this aggregated data to entity page templates so they generate proper wikilinks

**Data to aggregate:**

| Entity | Cross-references to populate |
|--------|------------------------------|
| Chemical | `usedInExperiments` (which experiments use it), `relatedReactionTypes` (in which reaction types), `relatedResearchers` (who uses it) |
| Reaction Type | `representativeExperiments` (experiments of this type), `commonCatalysts` (chemicals used as catalysts), `whoToAsk` (researchers), `substrateAdvice` (substrate classes) |
| Researcher | `recentExperiments` (their experiments), `expertiseAreas` (reaction types they work on) |
| Substrate Class | `representativeExperiments`, `commonReactions` (reaction types), `whoHasExperience` (researchers) |

**Acceptance criteria:**
- [ ] Chemical pages list experiments they appear in (as wikilinks)
- [ ] Chemical pages list reaction types where they're used
- [ ] Reaction Type pages list representative experiments with full title wikilinks
- [ ] Reaction Type pages list common catalysts as wikilinks
- [ ] Researcher pages list their recent experiments
- [ ] Substrate Class pages list associated reaction types and researchers
- [ ] All cross-reference data generated from experiment data (not hardcoded)

**Depends on:** SKB-50.1, SKB-50.2

---

### SKB-50.4: Rebuild PageLinks & Verify Graph — 3 points, Medium

**Problem:** After fixing templates, existing PageLink records are stale. Need to rebuild the index and verify the graph is now richly connected.

**Fix:**
1. Add a `--rebuild-links` flag to the chemistry sync script
2. After sync, call `rebuildAllPageLinks(tenantId)` to regenerate all PageLink records from current page content
3. Verify graph connectivity by logging node/edge counts

**Acceptance criteria:**
- [ ] `--rebuild-links` flag triggers full PageLink rebuild after sync
- [ ] Log output shows: "Rebuilt X page links across Y pages"
- [ ] Graph API returns edges for: experiment↔chemical, experiment↔reaction type, experiment↔researcher, experiment↔substrate class, reaction type↔chemical, reaction type↔researcher
- [ ] Knowledge graph visualization shows connected clusters instead of isolated nodes

**Depends on:** SKB-50.3

---

### SKB-50.5: Template Unit Tests — 2 points, Medium

**Problem:** No tests exist for chemistry templates. Changes to templates risk breaking the sync.

**Fix:** Add unit tests that verify:
- Template output contains expected wikilinks
- All 5 template functions produce valid markdown
- Wikilinks use correct `[[page title]]` format
- Cross-reference sections are populated when data is provided

**Acceptance criteria:**
- [ ] Tests for `generateExperimentPage()` — verify wikilinks for reagents, researcher, reaction type, substrate class, related experiments
- [ ] Tests for `generateChemicalPage()` — verify wikilinks for experiments, reaction types, researchers
- [ ] Tests for `generateReactionTypePage()` — verify wikilinks for experiments, catalysts, researchers, substrates
- [ ] Tests for `generateResearcherPage()` — verify wikilinks for experiments, expertise areas
- [ ] Tests for `generateSubstrateClassPage()` — verify wikilinks for experiments, reactions, researchers
- [ ] All tests pass

**Depends on:** SKB-50.1 (template changes must be done first)

---

## Implementation Order

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 50.1   │──▶│ 50.2   │──▶│ 50.3   │──▶│ 50.4   │
│Fix Wiki │   │Fix Exp │   │Populate│   │Rebuild │
│Persist  │   │CrossRef│   │Entity  │   │Links   │
└───┬────┘   └────────┘   │CrossRef│   └────────┘
    │                      └────────┘
    │
    ▼
┌────────┐
│ 50.5   │
│Template│
│Tests   │
└────────┘

50.1 is the foundation — must be done first.
50.2 depends on 50.1 (same template changes).
50.3 depends on 50.1 + 50.2 (needs correct wikilink format).
50.4 depends on 50.3 (rebuild after all template fixes).
50.5 can start after 50.1 (tests the new template output).
```

---

## Shared Constraints

- **No data loss:** Template changes must preserve all existing experiment content. Only the format of metadata presentation changes (table → paragraphs), not the data itself.
- **Idempotent sync:** Running the sync script multiple times produces the same result.
- **Backward compatible:** Changes to templates don't break the markdown serializer/deserializer.
- **Existing tests must pass:** 1678 tests currently pass. That number must not decrease.
- **TypeScript strict:** No `any` types.

---

## Files Created/Modified by This Epic

### New Files
- `tests/unit/chemistryKb/templates.test.ts` — Template unit tests

### Modified Files
- `src/lib/chemistryKb/templates.ts` — Fix experiment template Metadata section, update Related Experiments format
- `src/lib/chemEln/experimentTransformer.ts` — Use full page titles in related experiment references
- `src/lib/chemEln/sync/orchestrator.ts` or equivalent — Add cross-reference aggregation logic
- `src/lib/chemEln/sync/writer.ts` or equivalent — Pass aggregated cross-references to entity templates
- `scripts/sync-chemeln.ts` — Add `--rebuild-links` flag

---

**Last Updated:** 2026-03-23
