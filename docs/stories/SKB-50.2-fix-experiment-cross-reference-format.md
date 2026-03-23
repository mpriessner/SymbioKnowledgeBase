# SKB-50.2: Fix Experiment Cross-Reference Format

**Story ID:** SKB-50.2
**Epic:** EPIC-50 (Chemistry KB — Graph Interconnectivity)
**Points:** 3
**Priority:** High
**Status:** Not Started
**Depends on:** SKB-50.1

---

## User Story

As a knowledge base user, I want experiment cross-references (e.g., "Related Experiments") to be clickable wikilinks that resolve correctly, so I can navigate between related experiments and the graph shows these connections.

---

## What This Story Delivers

Related experiment references currently use short ELN IDs like `[[EXP-2026-0042]]`, but page titles are `"EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine"`. The wikilink resolver does case-insensitive **title matching**, so `[[EXP-2026-0042]]` won't match the full title. These links silently fail to resolve, creating no `PageLink` records.

This story changes all experiment references to use full page titles.

---

## Problem

### In Experiment Pages

The `Related Experiments` section currently renders:
```markdown
- [[EXP-2026-0043]]: Follow-up optimization
```

The wikilink resolver (`src/lib/chemistryKb/wikilinkResolver.ts`) tries to match `EXP-2026-0043` against page titles but finds none (the actual title is `EXP-2026-0043: Pd catalyst optimization`).

### In Entity Pages

Reaction Type, Researcher, and Substrate Class templates also reference experiments using short ELN IDs:
```markdown
- [[EXP-2026-0042]] — Suzuki coupling with Pd(PPh3)4
```

Same problem — these don't resolve.

---

## Technical Specification

### Fix 1: Experiment Template — Related Experiments

In `src/lib/chemistryKb/templates.ts`, `generateExperimentPage()`:

The `relatedExperiments` field uses the `RelatedExperiment` interface which has both `elnId` and `description`. Change the wikilink format from:

```typescript
// Before
`- [[${exp.elnId}]]: ${exp.description}`
```

To:

```typescript
// After — use full page title format
`- [[${exp.elnId}: ${exp.shortTitle}]]`
```

Where `shortTitle` is derived from the experiment's page title (strip the `EXP-YYYY-NNNN: ` prefix to get the descriptive part, then recombine).

### Fix 2: Experiment Transformer

In `src/lib/chemEln/experimentTransformer.ts`, `transformExperiment()`:

The `relatedExperiments` array needs to include the full page title of the related experiment, not just the ELN ID. This requires looking up the related experiment's title during transformation.

Update the `RelatedExperiment` interface:
```typescript
interface RelatedExperiment {
  elnId: string;
  description: string;
  pageTitle: string;  // NEW: full page title for wikilink
}
```

### Fix 3: Entity Templates

Update all entity templates that reference experiments:

- `generateReactionTypePage()` — `representativeExperiments` section
- `generateResearcherPage()` — `recentExperiments` section
- `generateSubstrateClassPage()` — `representativeExperiments` section

Change from `[[EXP-YYYY-NNNN]]` to `[[EXP-YYYY-NNNN: Short Title]]`.

---

## Files to Modify

- `src/lib/chemistryKb/templates.ts` — Update all 4 template functions that reference experiments
- `src/lib/chemEln/experimentTransformer.ts` — Include full page title in `RelatedExperiment`

## Files to Verify

- `src/lib/chemistryKb/wikilinkResolver.ts` — Confirm full title matches resolve correctly

---

## Acceptance Criteria

- [ ] `RelatedExperiment` references use `[[EXP-YYYY-NNNN: Short Title]]` format
- [ ] Wikilink resolver matches full experiment titles
- [ ] `PageLink` records created for experiment cross-references
- [ ] All templates updated: experiment, reaction type, researcher, substrate class
- [ ] No broken wikilinks in experiment pages (all resolve to existing pages)

---

## Verification Strategy

1. After template changes, regenerate a few experiment pages
2. Check that wikilinks in "Related Experiments" section use full titles
3. Verify `PageLink` records exist for experiment↔experiment connections
4. Check entity pages — experiment references should also use full titles

---

## Implementation Notes

- The `RelatedExperiment` interface change is additive (new field), so it's backward compatible
- If a related experiment's page doesn't exist yet (e.g., it hasn't been synced), the wikilink will be unresolved — that's expected and handled by the resolver's "unresolved link" styling
- The transformer needs access to experiment page titles — this may require a lookup map built during sync

---

**Last Updated:** 2026-03-23
