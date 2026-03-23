# Story SKB-42.2: Wikilink Naming Conventions & Resolution Rules

**Epic:** EPIC-42 Chemistry Knowledge Base — Information Architecture
**Story ID:** SKB-42.2
**Story Points:** 2
**Priority:** High
**Status:** Planned
**Depends On:** SKB-42.1

## User Story

As a page generator, I want clear naming conventions for all page types, So that wikilinks resolve unambiguously and the knowledge graph connects correctly.

## Acceptance Criteria

- [ ] Define Experiment page naming: "EXP-YYYY-NNNN: [Short Title]" (e.g., "EXP-2026-0042: Suzuki Coupling of Aryl Bromide")
- [ ] Define Chemical page naming: Common name as title (e.g., "Pd(PPh3)4"), CAS number in frontmatter for deduplication
- [ ] Define ReactionType page naming: Common reaction name (e.g., "Suzuki Coupling")
- [ ] Define Researcher page naming: "Dr. FirstName LastName" or "FirstName LastName"
- [ ] Define SubstrateClass page naming: Descriptive class name (e.g., "Heteroaryl Halides")
- [ ] Define synonym/alias handling: "THF" wikilink should resolve to "Tetrahydrofuran" page (use alias list in frontmatter common_synonyms field)
- [ ] Define disambiguation strategy: If two chemicals share a common name, append CAS number: "Ethanol (64-17-5)"
- [ ] Define wikilink case sensitivity rules: Case-insensitive matching for all page types
- [ ] Create 10+ test cases covering all naming scenarios
- [ ] Document all rules in NAMING-CONVENTIONS.md with examples and edge cases

## Architecture Overview

```
Wikilink Resolution Flow
─────────────────────────

User writes:                     SKB resolves to:
────────────                     ────────────────

[[Suzuki Coupling]]         ──► "Suzuki Coupling" (ReactionType page)
[[EXP-2026-0042]]           ──► "EXP-2026-0042: Suzuki Coupling..." (Experiment page)
[[Pd(PPh3)4]]               ──► "Pd(PPh3)4" (Chemical page)
[[THF]]                     ──► "Tetrahydrofuran" (Chemical page via synonym)
[[Dr. Anna Mueller]]        ──► "Dr. Anna Mueller" (Researcher page)
[[Heteroaryl Halides]]      ──► "Heteroaryl Halides" (SubstrateClass page)

Naming Conventions by Page Type:
─────────────────────────────────

Experiment:       EXP-YYYY-NNNN: [Short Title]
                  ↳ ELN ID prefix ensures uniqueness
                  ↳ Short title provides context in wikilinks
                  ↳ Max length: 80 characters

Chemical:         [Common Name] or [IUPAC Name]
                  ↳ Use most recognizable name
                  ↳ CAS in frontmatter for deduplication
                  ↳ Synonyms in frontmatter for resolution
                  ↳ Disambiguate with CAS if needed: "Ethanol (64-17-5)"

ReactionType:     [Common Reaction Name]
                  ↳ Use established chemistry nomenclature
                  ↳ Example: "Suzuki Coupling" not "Suzuki-Miyaura"

Researcher:       Dr. FirstName LastName  OR  FirstName LastName
                  ↳ Include "Dr." if PhD/MD
                  ↳ Use full first name (not initials)
                  ↳ Email in frontmatter for deduplication

SubstrateClass:   [Descriptive Class Name]
                  ↳ Use standard chemistry terminology
                  ↳ Plural form preferred: "Heteroaryl Halides" not "Heteroaryl Halide"

Synonym Resolution (Chemical Example):
───────────────────────────────────────

Page: "Tetrahydrofuran"
Frontmatter:
  common_synonyms: ["THF", "Oxolane", "1,4-Epoxybutane"]

Wikilinks that resolve to this page:
  [[Tetrahydrofuran]]   ← Exact title match
  [[THF]]               ← Synonym match
  [[Oxolane]]           ← Synonym match
  [[thf]]               ← Case-insensitive synonym match

Disambiguation (Chemical Collision):
────────────────────────────────────

Two chemicals named "Ethanol":
  Page 1: "Ethanol (64-17-5)"       ← Ethanol for chemistry
  Page 2: "Ethanol (denatured)"     ← Ethanol for cleaning

Wikilink resolution:
  [[Ethanol]]           → Requires disambiguation (SKB shows options)
  [[Ethanol (64-17-5)]] → Resolves to Page 1
  [[EtOH]]              → Resolves to Page 1 (if in synonyms)
```

## Implementation Steps

### 1. Define Core Naming Rules

Create the primary naming convention for each page type with format specifications, length limits, and examples.

**Experiment Pages:**
```
Format:   EXP-YYYY-NNNN: [Short Title]
Example:  EXP-2026-0042: Suzuki Coupling of Aryl Bromide
Rules:    - ELN ID is required prefix
          - Colon + space separator
          - Short title max 60 chars
          - Title describes reaction + substrate
          - Total length max 80 chars
```

**Chemical Pages:**
```
Format:   [Common Name] or [IUPAC Name]
Example:  Pd(PPh3)4, Tetrahydrofuran, 4-Bromopyridine
Rules:    - Use most recognizable name (common over IUPAC)
          - Include parentheses, brackets as written
          - CAS number in frontmatter (required)
          - Disambiguate with CAS if collision: "Ethanol (64-17-5)"
```

**ReactionType Pages:**
```
Format:   [Common Reaction Name]
Example:  Suzuki Coupling, Grignard Reaction, Buchwald-Hartwig Amination
Rules:    - Use established chemistry nomenclature
          - Include named reactions (e.g., "Suzuki" not "cross-coupling")
          - Hyphenate multi-person names: "Buchwald-Hartwig"
```

**Researcher Pages:**
```
Format:   Dr. FirstName LastName  OR  FirstName LastName
Example:  Dr. Anna Mueller, Sarah Chen
Rules:    - Include "Dr." if PhD/MD/equivalent
          - Full first name (not initials)
          - No middle names/initials
          - Email in frontmatter for deduplication
```

**SubstrateClass Pages:**
```
Format:   [Descriptive Class Name]
Example:  Heteroaryl Halides, Electron-Deficient Arenes, Alkyl Boronic Acids
Rules:    - Use plural form
          - Standard chemistry terminology
          - Descriptive and specific
```

### 2. Implement Synonym Resolution

Define how SKB resolves wikilinks when the exact title doesn't match.

**Resolution Algorithm:**
```typescript
function resolveWikilink(linkText: string, tenantId: string): Page | null {
  // Step 1: Exact title match (case-insensitive)
  const exactMatch = findPageByTitle(linkText, tenantId, caseInsensitive: true);
  if (exactMatch) return exactMatch;

  // Step 2: Synonym match (search common_synonyms field)
  const synonymMatch = findPageBySynonym(linkText, tenantId, caseInsensitive: true);
  if (synonymMatch) return synonymMatch;

  // Step 3: No match found
  return null;
}
```

**Synonym Configuration (Chemical Example):**
```yaml
---
title: "Tetrahydrofuran"
icon: "⚗️"
tags:
  - chemical
  - cas:109-99-9
cas_number: "109-99-9"
common_synonyms:
  - "THF"
  - "Oxolane"
  - "1,4-Epoxybutane"
  - "Tetramethylene oxide"
---
```

All of these wikilinks resolve to "Tetrahydrofuran":
- `[[Tetrahydrofuran]]` (exact)
- `[[THF]]` (synonym)
- `[[thf]]` (case-insensitive synonym)
- `[[Oxolane]]` (synonym)

### 3. Define Disambiguation Rules

When two pages have the same title, append a disambiguator in parentheses.

**Disambiguation Strategy:**
- Chemicals: Append CAS number `"Ethanol (64-17-5)"`
- Researchers: Append institution `"John Smith (MIT)"` (future use)
- Reactions: Append year/variant `"Suzuki Coupling (2005 protocol)"` (future use)

**Collision Detection:**
Before creating a new page, check if the title already exists. If so, append disambiguator.

### 4. Define Case Sensitivity Rules

All wikilink matching is case-insensitive:
- `[[THF]]` = `[[thf]]` = `[[Thf]]`
- `[[Suzuki Coupling]]` = `[[suzuki coupling]]`

But page titles preserve original case:
- Page title: "Tetrahydrofuran" (capital T)
- Wikilink: `[[thf]]` (lowercase) → resolves correctly

### 5. Create Test Cases

Define 10+ test cases covering edge cases:

```
Test Case 1: Exact match (experiment)
  Wikilink: [[EXP-2026-0042]]
  Expected: "EXP-2026-0042: Suzuki Coupling of Aryl Bromide"

Test Case 2: Synonym match (chemical)
  Wikilink: [[THF]]
  Expected: "Tetrahydrofuran"

Test Case 3: Case-insensitive match (reaction)
  Wikilink: [[suzuki coupling]]
  Expected: "Suzuki Coupling"

Test Case 4: Disambiguation (chemical collision)
  Wikilink: [[Ethanol (64-17-5)]]
  Expected: "Ethanol (64-17-5)"

Test Case 5: Researcher with title
  Wikilink: [[Dr. Anna Mueller]]
  Expected: "Dr. Anna Mueller"

Test Case 6: Researcher without title
  Wikilink: [[Sarah Chen]]
  Expected: "Sarah Chen"

Test Case 7: Substrate class plural
  Wikilink: [[Heteroaryl Halides]]
  Expected: "Heteroaryl Halides"

Test Case 8: Chemical with special characters
  Wikilink: [[Pd(PPh3)4]]
  Expected: "Pd(PPh3)4"

Test Case 9: No match (create new page)
  Wikilink: [[Unknown Chemical]]
  Expected: null (or create-page prompt)

Test Case 10: Multiple synonyms
  Wikilink: [[DMF]]
  Expected: "N,N-Dimethylformamide"
```

### 6. Document in NAMING-CONVENTIONS.md

Create comprehensive documentation with all rules, examples, edge cases, and resolution algorithm.

## Testing Requirements

### Naming Convention Validation

- [ ] All 5 page types have clear naming rules with format specs
- [ ] 10+ test cases pass resolution algorithm
- [ ] Synonym handling works for common chemical abbreviations (THF, DMF, DMSO, DCM, EtOH, MeOH)
- [ ] Disambiguation strategy handles collisions correctly

### Edge Case Coverage

- [ ] Chemical names with special characters resolve correctly (parentheses, brackets, hyphens)
- [ ] Multi-word reaction names resolve correctly ("Buchwald-Hartwig Amination")
- [ ] Researcher names with special characters (accents, hyphens) resolve correctly
- [ ] Case-insensitive matching works for all page types

### Integration Testing

- [ ] Wikilinks in experiment templates resolve to correct pages
- [ ] Backlinks are created correctly in graph
- [ ] Graph visualization shows expected edges

## Files to Create/Modify

| File Path | Type | Purpose |
|-----------|------|---------|
| `docs/chemistry-kb/NAMING-CONVENTIONS.md` | Create | Complete naming rules documentation |
| `tests/chemistry-kb/wikilink-resolution.test.ts` | Create | Test suite for resolution algorithm |
| `docs/chemistry-kb/examples/wikilink-test-cases.yaml` | Create | 10+ test cases for validation |

## Dev Notes

### SKB Wikilink Resolution

SKB's existing wikilink resolution logic may need extension to support synonyms:
- Current: Exact title match only
- Needed: Check `common_synonyms` frontmatter field

Proposed change:
```typescript
// In SKB's wikilink resolver
if (!exactMatch && page.frontmatter.common_synonyms) {
  const synonyms = page.frontmatter.common_synonyms;
  if (synonyms.some(s => s.toLowerCase() === linkText.toLowerCase())) {
    return page;
  }
}
```

### Performance Considerations

- Synonym lookup requires scanning frontmatter (slower than exact match)
- Consider indexing `common_synonyms` field for faster resolution
- Limit synonyms to 10 per page to avoid performance degradation

### Chemical Name Challenges

- IUPAC names can be extremely long (>100 chars)
- Common names vary by region (e.g., "adrenaline" vs "epinephrine")
- Use CAS number as ground truth for deduplication

### Researcher Name Challenges

- Researchers may change names (marriage, etc.)
- Consider using stable IDs (ORCID) in future versions
- For now, use email in frontmatter for deduplication

### Future Enhancements

- Support fuzzy matching for typos (e.g., "Suzuki Cupling" → "Suzuki Coupling")
- Auto-suggest wikilinks based on partial match
- Validate chemical names against PubChem/ChemSpider APIs
