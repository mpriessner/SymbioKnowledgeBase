# SKB-50.5: Template Unit Tests

**Story ID:** SKB-50.5
**Epic:** EPIC-50 (Chemistry KB — Graph Interconnectivity)
**Points:** 2
**Priority:** Medium
**Status:** Not Started
**Depends on:** SKB-50.1 (template changes must be done first)

---

## User Story

As a developer, I want unit tests for all chemistry KB template functions, so future template changes don't break wikilinks or graph connectivity.

---

## What This Story Delivers

A comprehensive test suite for the 5 chemistry template functions in `src/lib/chemistryKb/templates.ts`. Tests verify that:
- Template output contains expected `[[wikilinks]]`
- All 5 functions produce valid markdown
- Wikilinks use the correct `[[page title]]` format
- Cross-reference sections are populated when data is provided
- Empty/missing data is handled gracefully

---

## Technical Specification

### Test File

`tests/unit/chemistryKb/templates.test.ts`

### Test Cases

#### `generateExperimentPage()` Tests

1. **Metadata wikilinks** — Output contains `[[Researcher Name]]`, `[[Reaction Type]]`, `[[Substrate Class]]` in the Metadata section (NOT inside a table)
2. **Reagent wikilinks** — Reagents section contains `[[Chemical Name]]` for each reagent
3. **Related experiments** — Related Experiments section uses `[[EXP-YYYY-NNNN: Short Title]]` format
4. **Related pages** — Related Pages section has `[[wikilinks]]`
5. **No table in Metadata** — Metadata section does NOT contain pipe characters (`|`) indicating a table
6. **All required sections present** — Overview, Metadata, Reagents, Procedure, Results sections exist

#### `generateChemicalPage()` Tests

7. **Experiment wikilinks** — "Used in Experiments" section contains `[[EXP-...]]` wikilinks
8. **Reaction type wikilinks** — "Related Reaction Types" contains `[[Reaction Type]]`
9. **Researcher wikilinks** — "Related Researchers" contains `[[Researcher Name]]`
10. **Empty cross-refs** — When no cross-reference data provided, sections show placeholder or are omitted gracefully

#### `generateReactionTypePage()` Tests

11. **Experiment wikilinks** — Representative experiments use full title format
12. **Catalyst wikilinks** — Common catalysts section has `[[Chemical]]` links
13. **Researcher wikilinks** — "Who to Ask" section has `[[Researcher]]` links
14. **Substrate wikilinks** — Substrate classes section has `[[Substrate Class]]` links

#### `generateResearcherPage()` Tests

15. **Experiment wikilinks** — Recent experiments section has `[[EXP-...]]` links
16. **Expertise wikilinks** — Expertise areas section has `[[Reaction Type]]` links

#### `generateSubstrateClassPage()` Tests

17. **Experiment wikilinks** — Representative experiments have `[[EXP-...]]` links
18. **Reaction type wikilinks** — Common reactions section has `[[Reaction Type]]` links
19. **Researcher wikilinks** — "Who Has Experience" section has `[[Researcher]]` links

#### Cross-Cutting Tests

20. **Valid markdown** — All 5 functions produce output that starts with `#` (heading)
21. **No broken wikilink syntax** — No unmatched `[[` or `]]` in any output
22. **Wikilink format consistency** — All wikilinks match the pattern `\[\[.+?\]\]`

### Test Helpers

```typescript
// Helper to extract all wikilinks from markdown
function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[(.+?)\]\]/g) || [];
  return matches.map(m => m.slice(2, -2));
}

// Helper to verify no table syntax in a section
function sectionContainsTable(markdown: string, sectionName: string): boolean {
  const sectionStart = markdown.indexOf(`## ${sectionName}`);
  const nextSection = markdown.indexOf('\n## ', sectionStart + 1);
  const section = markdown.slice(sectionStart, nextSection > 0 ? nextSection : undefined);
  return section.includes('|');
}
```

### Test Data

Create realistic test fixtures:

```typescript
const mockExperimentData: ExperimentPageData = {
  elnId: 'EXP-2026-0042',
  title: 'Suzuki Coupling of 4-Bromopyridine',
  researcher: 'Dr. Anna Mueller',
  reactionType: 'Suzuki Coupling',
  substrateClass: 'Aryl Halides',
  reagents: [
    { name: '4-Bromopyridine', role: 'substrate', amount: '1.0 mmol' },
    { name: 'Pd(PPh3)4', role: 'catalyst', amount: '0.05 mmol' },
  ],
  relatedExperiments: [
    { elnId: 'EXP-2026-0043', description: 'Follow-up', pageTitle: 'EXP-2026-0043: Pd catalyst optimization' },
  ],
  // ... other fields
};
```

---

## Files to Create

- `tests/unit/chemistryKb/templates.test.ts` — All template tests

## Files to Read

- `src/lib/chemistryKb/templates.ts` — Understand current template interfaces and output format

---

## Acceptance Criteria

- [ ] Tests for `generateExperimentPage()` — verify wikilinks for reagents, researcher, reaction type, substrate class, related experiments
- [ ] Tests for `generateChemicalPage()` — verify wikilinks for experiments, reaction types, researchers
- [ ] Tests for `generateReactionTypePage()` — verify wikilinks for experiments, catalysts, researchers, substrates
- [ ] Tests for `generateResearcherPage()` — verify wikilinks for experiments, expertise areas
- [ ] Tests for `generateSubstrateClassPage()` — verify wikilinks for experiments, reactions, researchers
- [ ] All tests pass
- [ ] Tests are self-contained (no database or external dependencies)

---

## Verification Strategy

```bash
npx vitest run tests/unit/chemistryKb/templates.test.ts
```

All tests should pass. No existing tests should break.

---

## Implementation Notes

- These are pure unit tests — no database, no filesystem, no network
- Test the template functions directly with mock data
- Focus on wikilink presence and format, not on exact markdown formatting
- Use `toContain` and regex matchers rather than exact string matching (templates may evolve)
- This story can start as soon as SKB-50.1 is done (doesn't need 50.2 or 50.3, but tests should be written to expect the final format including cross-references)

---

**Last Updated:** 2026-03-23
