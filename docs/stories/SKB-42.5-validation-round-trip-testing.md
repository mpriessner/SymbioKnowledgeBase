# Story SKB-42.5: Validation & Round-Trip Testing

**Epic:** EPIC-42 Chemistry Knowledge Base — Information Architecture
**Story ID:** SKB-42.5
**Story Points:** 3
**Priority:** High
**Status:** Planned
**Depends On:** SKB-42.4

## User Story

As a quality assurance step, I want to validate the entire information architecture with real sample data, So that we catch schema issues, rendering problems, and broken wikilinks before building the data pipeline.

## Acceptance Criteria

- [ ] Create 3 sample experiment pages using the experiment template
- [ ] Create 5 sample chemical pages using the chemical template
- [ ] Create 1 sample reaction type page using the reaction type template
- [ ] Create 1 sample researcher page using the researcher template
- [ ] Create 1 sample substrate class page using the substrate class template
- [ ] Verify all 11 sample pages render correctly in SKB UI (no broken formatting)
- [ ] Verify all wikilinks resolve to the correct pages
- [ ] Verify wikilinks create visible graph edges in graph visualization
- [ ] Verify page tree API returns correct hierarchy (7 parent pages + 11 sample pages = 18 total)
- [ ] Verify agent API returns correct markdown when querying sample pages
- [ ] Verify markdown round-trips without data loss (create → read → update → read)
- [ ] Document any schema issues, rendering problems, or broken wikilinks found
- [ ] Create validation report with screenshots and test results

## Architecture Overview

```
Sample Page Network (11 Pages)
───────────────────────────────

Researchers:
  Dr. Anna Mueller (👩‍🔬)

Chemicals:
  Pd(PPh3)4 (⚗️)
  Tetrahydrofuran (⚗️) [synonyms: THF]
  4-Bromopyridine (⚗️)
  Potassium carbonate (⚗️)
  Phenylboronic acid (⚗️)

Substrate Classes:
  Heteroaryl Halides (🧬)

Reaction Types:
  Suzuki Coupling (🔬)

Experiments:
  EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine (🧪) [quality:4]
  EXP-2026-0043: Optimization of Suzuki Conditions (🧪) [quality:3]
  EXP-2026-0044: Scale-Up to 10 mmol (🧪) [quality:5]

Wikilink Graph Edges:
─────────────────────

EXP-2026-0042 ──[[Suzuki Coupling]]──► Suzuki Coupling
EXP-2026-0042 ──[[Pd(PPh3)4]]────────► Pd(PPh3)4
EXP-2026-0042 ──[[THF]]──────────────► Tetrahydrofuran (synonym resolution)
EXP-2026-0042 ──[[4-Bromopyridine]]─► 4-Bromopyridine
EXP-2026-0042 ──[[Dr. Anna Mueller]]─► Dr. Anna Mueller
EXP-2026-0042 ──[[Heteroaryl Halides]]► Heteroaryl Halides

EXP-2026-0043 ──[[Suzuki Coupling]]──► Suzuki Coupling
EXP-2026-0043 ──[[Pd(PPh3)4]]────────► Pd(PPh3)4
EXP-2026-0043 ──[[THF]]──────────────► Tetrahydrofuran
EXP-2026-0043 ──[[Dr. Anna Mueller]]─► Dr. Anna Mueller
EXP-2026-0043 ──[[EXP-2026-0042]]───► EXP-2026-0042 (related experiment)

EXP-2026-0044 ──[[Suzuki Coupling]]──► Suzuki Coupling
EXP-2026-0044 ──[[Pd(PPh3)4]]────────► Pd(PPh3)4
EXP-2026-0044 ──[[Dr. Anna Mueller]]─► Dr. Anna Mueller
EXP-2026-0044 ──[[EXP-2026-0042]]───► EXP-2026-0042 (related experiment)

Suzuki Coupling ──[[EXP-2026-0042]]──► EXP-2026-0042 (backlink)
Suzuki Coupling ──[[EXP-2026-0043]]──► EXP-2026-0043 (backlink)
Suzuki Coupling ──[[EXP-2026-0044]]──► EXP-2026-0044 (backlink)

Pd(PPh3)4 ──[[EXP-2026-0042]]────────► EXP-2026-0042 (backlink)
Pd(PPh3)4 ──[[EXP-2026-0043]]────────► EXP-2026-0043 (backlink)
Pd(PPh3)4 ──[[EXP-2026-0044]]────────► EXP-2026-0044 (backlink)

Expected Graph Visualization:
─────────────────────────────

         [Dr. Anna Mueller]
               │
               │ authored
               ▼
      ┌─────────────────────┐
      │ EXP-2026-0042       │
      │ EXP-2026-0043       │◄───── related to
      │ EXP-2026-0044       │
      └─────────────────────┘
               │
               │ used
               ▼
      ┌─────────────────────┐
      │ Pd(PPh3)4           │
      │ Tetrahydrofuran     │
      │ 4-Bromopyridine     │
      └─────────────────────┘
               │
               │ type
               ▼
      [Suzuki Coupling]
               │
               │ substrate-class
               ▼
      [Heteroaryl Halides]
```

## Implementation Steps

### 1. Create Sample Researcher Page

**Page:** Dr. Anna Mueller

Use the researcher template to create a realistic researcher page with:
- Email address
- Expertise areas (Suzuki couplings, heteroaryl substrates)
- Links to the 3 experiment pages (will be created next)

### 2. Create Sample Chemical Pages

**Pages:** Pd(PPh3)4, Tetrahydrofuran, 4-Bromopyridine, Potassium carbonate, Phenylboronic acid

Use the chemical template to create realistic chemical pages with:
- CAS numbers (real CAS numbers for validation)
- Molecular weights
- Common synonyms (especially for Tetrahydrofuran → THF)
- Practical usage notes
- Storage conditions

**Key test case:** Verify that `[[THF]]` wikilink resolves to "Tetrahydrofuran" page via synonym matching.

### 3. Create Sample Substrate Class Page

**Page:** Heteroaryl Halides

Use the substrate class template to create a realistic substrate class page with:
- Common challenges (protodeboronation, low reactivity)
- What worked (specific conditions)
- Links to the 3 experiment pages

### 4. Create Sample Reaction Type Page

**Page:** Suzuki Coupling

Use the reaction type template to create a realistic reaction type page with:
- Institutional experience stats (3 experiments, avg yield ~85%, 1 researcher)
- Key learnings (what works well with heteroaryl substrates)
- Common pitfalls (protodeboronation, moisture sensitivity)
- Links to the 3 experiment pages
- Link to Dr. Anna Mueller as expert

### 5. Create Sample Experiment Pages

**Pages:**
- EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine (quality:4)
- EXP-2026-0043: Optimization of Suzuki Conditions (quality:3)
- EXP-2026-0044: Scale-Up to 10 mmol (quality:5)

Use the experiment template to create realistic experiment pages with:
- Complete frontmatter (all required fields from SKB-42.1)
- Realistic reaction conditions (temperature, solvent, time)
- Complete reagents table with wikilinks to chemicals
- Realistic procedure steps
- Results section with yield and characterization data
- Practical notes section with insights
- Wikilinks to: chemicals, reaction type, researcher, substrate class, related experiments

**Key test cases:**
- EXP-2026-0042 uses `[[THF]]` (tests synonym resolution)
- EXP-2026-0043 links to `[[EXP-2026-0042]]` as related experiment (tests experiment-to-experiment wikilinks)
- EXP-2026-0044 tests scale:large tag and high quality_score

### 6. Verify Rendering in SKB UI

For each sample page:
1. Open in SKB UI
2. Take screenshot
3. Check that:
   - Frontmatter icon displays correctly
   - One-liner summary renders as blockquote
   - Tables render correctly (especially reagents table in experiments)
   - Lists render correctly
   - Wikilinks are blue and clickable
   - No broken formatting or layout issues

### 7. Verify Wikilink Resolution

For each wikilink in sample pages:
1. Click the wikilink in SKB UI
2. Verify it navigates to the correct page
3. Check the graph visualization to see if the edge appears

**Specific test cases:**
- `[[THF]]` in EXP-2026-0042 → should navigate to "Tetrahydrofuran"
- `[[Dr. Anna Mueller]]` → should navigate to researcher page
- `[[Suzuki Coupling]]` → should navigate to reaction type page
- `[[EXP-2026-0042]]` in EXP-2026-0043 → should navigate to experiment page

### 8. Verify Graph Visualization

1. Open the graph view in SKB UI
2. Verify that sample pages appear as nodes
3. Verify that wikilinks appear as edges between nodes
4. Take screenshot of graph showing the expected structure

Expected graph should show:
- Dr. Anna Mueller connected to 3 experiment pages
- Each experiment connected to multiple chemicals
- All experiments connected to Suzuki Coupling reaction type
- Experiments connected to Heteroaryl Halides substrate class

### 9. Verify Page Tree API

Query the page tree API and verify:
- Root "Chemistry KB" page exists
- 5 category parent pages exist under root
- 11 sample pages exist under appropriate parent pages
- Total of 18 pages (7 parent + 11 sample + "Chemistry KB Index")

```bash
curl -X GET "http://localhost:3000/api/pages/tree?root=chemistry-kb"
```

Expected structure:
```
Chemistry KB/
├── Chemistry KB Index
├── Experiments/
│   ├── EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine
│   ├── EXP-2026-0043: Optimization of Suzuki Conditions
│   └── EXP-2026-0044: Scale-Up to 10 mmol
├── Reaction Types/
│   └── Suzuki Coupling
├── Chemicals/
│   ├── Pd(PPh3)4
│   ├── Tetrahydrofuran
│   ├── 4-Bromopyridine
│   ├── Potassium carbonate
│   └── Phenylboronic acid
├── Researchers/
│   └── Dr. Anna Mueller
└── Substrate Classes/
    └── Heteroaryl Halides
```

### 10. Verify Agent API Markdown Retrieval

Query the agent API for each sample page and verify:
- Markdown is returned correctly
- Frontmatter is included
- Wikilinks are preserved
- Tables are preserved
- No data loss

```bash
curl -X GET "http://localhost:3000/api/agent/pages/EXP-2026-0042"
```

### 11. Verify Markdown Round-Trip

For one sample experiment page (EXP-2026-0042):
1. Retrieve markdown via agent API
2. Modify one section (e.g., add a new practical note)
3. Update the page via agent API
4. Retrieve markdown again
5. Verify the modification persisted correctly
6. Verify no other data was lost in the round-trip

### 12. Document Issues Found

Create a validation report documenting:
- Any schema issues (missing fields, incorrect types)
- Any rendering problems (broken tables, formatting issues)
- Any broken wikilinks (failed to resolve)
- Any graph visualization issues (missing nodes/edges)
- Any API issues (incorrect responses, errors)

## Testing Requirements

### Sample Page Creation

- [ ] All 11 sample pages created successfully
- [ ] All pages use correct templates
- [ ] All pages have realistic content (not just placeholders)
- [ ] All frontmatter fields are populated correctly

### Rendering Validation

- [ ] All sample pages render correctly in SKB UI
- [ ] Tables render correctly (especially in experiment pages)
- [ ] Lists render correctly
- [ ] Blockquotes (one-liners) render correctly
- [ ] Icons display correctly in page headers
- [ ] No broken formatting or layout issues

### Wikilink Validation

- [ ] All wikilinks resolve to the correct pages
- [ ] Synonym resolution works (`[[THF]]` → "Tetrahydrofuran")
- [ ] Experiment-to-experiment wikilinks work
- [ ] Wikilinks are clickable in SKB UI
- [ ] Graph visualization shows all edges

### API Validation

- [ ] Page tree API returns correct hierarchy
- [ ] Agent API returns correct markdown
- [ ] Frontmatter is preserved in API responses
- [ ] Wikilinks are preserved in markdown
- [ ] Tables are preserved in markdown

### Round-Trip Validation

- [ ] Markdown round-trips without data loss
- [ ] Modifications persist correctly
- [ ] Frontmatter is preserved after update
- [ ] Wikilinks are preserved after update

## Files to Create/Modify

| File Path | Type | Purpose |
|-----------|------|---------|
| `scripts/create-sample-pages.ts` | Create | Script to create all sample pages |
| `tests/chemistry-kb/sample-pages-validation.test.ts` | Create | Automated tests for sample pages |
| `docs/chemistry-kb/VALIDATION-REPORT.md` | Create | Validation report with test results |
| `docs/chemistry-kb/screenshots/` | Create | Screenshots of rendered pages |

## Dev Notes

### Realistic Sample Data

Use realistic chemistry data for sample pages:
- Real CAS numbers (e.g., Pd(PPh3)4 = 14221-01-3, THF = 109-99-9)
- Realistic reaction conditions (temperature, solvent, time)
- Realistic yields (70-95%)
- Realistic characterization data (NMR peaks, HRMS values)

This makes the validation more meaningful and catches edge cases.

### Sample Page Script

Create a script that generates all sample pages programmatically:

```typescript
import { agentApi } from '../lib/agent-api';

async function createSamplePages() {
  // Create researcher first (needed for experiments)
  const researcher = await createResearcher();

  // Create chemicals (needed for experiments)
  const chemicals = await createChemicals();

  // Create substrate class (needed for experiments)
  const substrateClass = await createSubstrateClass();

  // Create reaction type (needed for experiments)
  const reactionType = await createReactionType();

  // Create experiments (reference all above)
  const experiments = await createExperiments({
    researcher,
    chemicals,
    substrateClass,
    reactionType,
  });

  console.log('✓ Created all sample pages');
}
```

### Validation Checklist

Use a structured checklist for validation:

```yaml
Rendering Validation:
  - [ ] Experiment pages render correctly
  - [ ] Chemical pages render correctly
  - [ ] Reaction type page renders correctly
  - [ ] Researcher page renders correctly
  - [ ] Substrate class page renders correctly

Wikilink Validation:
  - [ ] THF → Tetrahydrofuran (synonym)
  - [ ] Pd(PPh3)4 → Pd(PPh3)4 (exact)
  - [ ] Dr. Anna Mueller → Dr. Anna Mueller (exact)
  - [ ] Suzuki Coupling → Suzuki Coupling (exact)
  - [ ] EXP-2026-0042 → EXP-2026-0042 (experiment-to-experiment)

Graph Validation:
  - [ ] All nodes appear in graph
  - [ ] All edges appear in graph
  - [ ] Graph layout is readable
```

### Known Issues to Watch For

Based on typical markdown rendering issues:
- **Tables with pipes in content** — Chemical names like `Pd(PPh3)4` might break table parsing
- **Special characters in wikilinks** — Parentheses in `[[Pd(PPh3)4]]` might break link parsing
- **Case sensitivity** — `[[thf]]` vs `[[THF]]` should both work
- **Emoji in frontmatter** — Make sure icons render correctly in UI

### Validation Report Template

```markdown
# Chemistry KB Validation Report

**Date:** 2026-03-21
**Tester:** [Name]
**Environment:** [Dev/Staging/Production]

## Summary

- Total pages created: 18
- Pages validated: 18
- Issues found: X
- Issues resolved: Y

## Rendering Validation

### Experiment Pages (3)
- [x] EXP-2026-0042 renders correctly
- [x] EXP-2026-0043 renders correctly
- [x] EXP-2026-0044 renders correctly

[Screenshots]

### Chemical Pages (5)
- [x] Pd(PPh3)4 renders correctly
- [x] Tetrahydrofuran renders correctly
- [x] 4-Bromopyridine renders correctly
- [x] Potassium carbonate renders correctly
- [x] Phenylboronic acid renders correctly

[Screenshots]

## Wikilink Validation

| Wikilink | Expected Target | Result |
|----------|----------------|--------|
| [[THF]] | Tetrahydrofuran | ✅ Pass |
| [[Pd(PPh3)4]] | Pd(PPh3)4 | ✅ Pass |
| [[Dr. Anna Mueller]] | Dr. Anna Mueller | ✅ Pass |

## Issues Found

### Issue 1: [Description]
- **Severity:** High/Medium/Low
- **Location:** [Page/Component]
- **Resolution:** [How it was fixed]

## Conclusion

[Overall assessment of the information architecture]
```

## Success Criteria

- All 11 sample pages created and rendering correctly
- All wikilinks resolve correctly (including synonym matching)
- Graph visualization shows expected structure
- Page tree API returns correct hierarchy
- Markdown round-trips without data loss
- Validation report documents all findings
- No critical issues blocking EPIC-43 (ChemELN Bridge)
