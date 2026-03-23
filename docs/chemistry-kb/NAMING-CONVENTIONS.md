# Naming Conventions for Chemistry Knowledge Base Pages

This document defines the naming conventions for all page types in the Chemistry Knowledge Base, along with wikilink resolution rules, synonym handling, and disambiguation strategies.

## Page Type Naming Rules

### Experiment Pages

**Format:** `EXP-YYYY-NNNN: [Short Title]`

| Rule | Detail |
|------|--------|
| Prefix | ELN ID (e.g., `EXP-2026-0042`) |
| Separator | Colon followed by a space (`: `) |
| Short title | Describes reaction + substrate |
| Short title max length | 60 characters |
| Total max length | 80 characters |

**Examples:**
- `EXP-2026-0042: Suzuki Coupling of Aryl Bromide`
- `EXP-2026-0101: Buchwald-Hartwig Amination of Chloropyridine`
- `EXP-2025-0003: Grignard Reaction with Ketone Substrate`

**Wikilink shorthand:** `[[EXP-2026-0042]]` resolves to the full title via prefix match.

### Chemical Pages

**Format:** `[Common Name]` or `[IUPAC Name]`

| Rule | Detail |
|------|--------|
| Title | Most recognizable name (prefer common over IUPAC) |
| Special characters | Parentheses, brackets, hyphens preserved as written |
| CAS number | Required in frontmatter (`cas_number` field) |
| Synonyms | Listed in frontmatter (`common_synonyms` field, max 10) |
| Disambiguation | Append CAS in parentheses if title collision: `Ethanol (64-17-5)` |

**Examples:**
- `Pd(PPh3)4` (common abbreviation)
- `Tetrahydrofuran` (common name, synonyms: THF, Oxolane)
- `4-Bromopyridine` (IUPAC-style)
- `Ethanol (64-17-5)` (disambiguated with CAS)

**Frontmatter example:**
```yaml
title: "Tetrahydrofuran"
icon: "&#x2697;&#xFE0F;"
cas_number: "109-99-9"
common_synonyms:
  - "THF"
  - "Oxolane"
  - "1,4-Epoxybutane"
  - "Tetramethylene oxide"
tags:
  - chemical
  - cas:109-99-9
```

### ReactionType Pages

**Format:** `[Common Reaction Name]`

| Rule | Detail |
|------|--------|
| Title | Established chemistry nomenclature |
| Named reactions | Include discoverer name (e.g., "Suzuki" not "cross-coupling") |
| Multi-person names | Hyphenate: `Buchwald-Hartwig` |

**Examples:**
- `Suzuki Coupling`
- `Grignard Reaction`
- `Buchwald-Hartwig Amination`
- `Heck Reaction`

### Researcher Pages

**Format:** `Dr. FirstName LastName` or `FirstName LastName`

| Rule | Detail |
|------|--------|
| Honorific | Include `Dr.` if PhD, MD, or equivalent |
| First name | Full first name (not initials) |
| Middle name | Omit middle names/initials |
| Email | In frontmatter for deduplication |

**Examples:**
- `Dr. Anna Mueller`
- `Sarah Chen`
- `Dr. James Rodriguez`

### SubstrateClass Pages

**Format:** `[Descriptive Class Name]`

| Rule | Detail |
|------|--------|
| Number | Plural form preferred |
| Terminology | Standard chemistry terminology |
| Specificity | Descriptive and specific |

**Examples:**
- `Heteroaryl Halides`
- `Electron-Deficient Arenes`
- `Alkyl Boronic Acids`

## Wikilink Resolution Algorithm

Resolution follows a two-step process, both case-insensitive:

```
Step 1: Exact title match (case-insensitive)
  [[Tetrahydrofuran]] -> finds page titled "Tetrahydrofuran"
  [[suzuki coupling]]  -> finds page titled "Suzuki Coupling"

Step 2: Synonym match (case-insensitive)
  [[THF]]  -> finds page where common_synonyms contains "THF"
  [[thf]]  -> same result (case-insensitive)
  [[EtOH]] -> finds "Ethanol" if "EtOH" is in its synonyms

Step 3: No match
  Returns null. UI may prompt to create a new page.
```

### Case Sensitivity

All wikilink matching is **case-insensitive**:
- `[[THF]]` = `[[thf]]` = `[[Thf]]`
- `[[Suzuki Coupling]]` = `[[suzuki coupling]]`

Page titles **preserve original case** as entered. Only the matching is case-insensitive.

### Synonym Resolution

Synonyms are stored in the `common_synonyms` frontmatter field on Chemical pages. When a wikilink does not match any page title, the resolver searches all pages' `common_synonyms` arrays for a case-insensitive match.

**Common chemical synonyms:**

| Synonym | Resolves To |
|---------|-------------|
| THF | Tetrahydrofuran |
| DMF | N,N-Dimethylformamide |
| DMSO | Dimethyl Sulfoxide |
| DCM | Dichloromethane |
| EtOH | Ethanol |
| MeOH | Methanol |

**Limits:** Maximum 10 synonyms per page to maintain resolution performance.

## Disambiguation Strategy

When two pages share the same common name, append a disambiguator in parentheses.

### By Page Type

| Page Type | Disambiguator | Example |
|-----------|---------------|---------|
| Chemical | CAS number | `Ethanol (64-17-5)` |
| Researcher | Institution (future) | `John Smith (MIT)` |
| ReactionType | Year/variant (future) | `Suzuki Coupling (2005 protocol)` |

### Collision Detection

Before creating a new page, check if the title already exists within the tenant. If a collision is found:

1. The existing page retains its title if it is the only one.
2. If a second page with the same base name is created, both pages should be disambiguated (e.g., append CAS numbers for chemicals).

### Ambiguous Wikilinks

If a wikilink matches multiple pages (e.g., `[[Ethanol]]` when both `Ethanol (64-17-5)` and `Ethanol (denatured)` exist), the resolver returns `null` and the UI should present disambiguation options.

## Special Characters

Chemical names frequently contain special characters. All of the following are valid in page titles and wikilinks:

- Parentheses: `Pd(PPh3)4`
- Brackets: `[1,1'-Biphenyl]-4-ol`
- Hyphens: `4-Bromopyridine`, `Buchwald-Hartwig`
- Commas: `N,N-Dimethylformamide`
- Periods: `Dr. Anna Mueller`
- Primes: `1,1'-Bi-2-naphthol`
- Greek letters: use spelled-out form where possible

## Edge Cases

1. **Partial ELN ID match:** `[[EXP-2026-0042]]` should resolve to `EXP-2026-0042: Suzuki Coupling of Aryl Bromide` (prefix match on experiment pages).
2. **Very long IUPAC names:** If the IUPAC name exceeds 80 characters, use the common name as the page title and place the IUPAC name in frontmatter.
3. **Regional name variations:** Use the most internationally recognized name. List regional variants as synonyms (e.g., "adrenaline" as synonym for "Epinephrine").
4. **Name changes for researchers:** Update the page title. Old wikilinks referencing the previous name should be updated via the rename propagation system.
