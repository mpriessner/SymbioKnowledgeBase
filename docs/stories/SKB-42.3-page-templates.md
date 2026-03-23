# Story SKB-42.3: Markdown Page Templates

**Epic:** EPIC-42 Chemistry Knowledge Base — Information Architecture
**Story ID:** SKB-42.3
**Story Points:** 3
**Priority:** Critical
**Status:** Planned
**Depends On:** SKB-42.1, SKB-42.2

## User Story

As a page generator service, I want validated Markdown templates for each page type, So that generated pages are consistent, contain all required sections, and render correctly in SKB.

## Acceptance Criteria

- [ ] Create complete Experiment page template with: frontmatter, metadata section, conditions table, reagents list (with wikilinks), procedure steps, results, practical notes, related experiments
- [ ] Create complete Chemical page template with: frontmatter, properties section, practical usage notes, experiments using this chemical (backlinks)
- [ ] Create complete ReactionType page template with: frontmatter, institutional experience summary, key learnings, common pitfalls, who to ask
- [ ] Create complete Researcher page template with: frontmatter, expertise areas, recent experiments, key contributions
- [ ] Create complete SubstrateClass page template with: frontmatter, common challenges, what worked, who has experience
- [ ] All templates include proper YAML frontmatter with all required fields from SKB-42.1
- [ ] All templates include wikilink examples following naming conventions from SKB-42.2
- [ ] All templates pass markdownToTiptap() conversion without errors
- [ ] All templates render correctly in SKB UI (no broken formatting, tables render, lists render)
- [ ] Templates include placeholder content that demonstrates best practices
- [ ] Templates are saved in `docs/chemistry-kb/templates/` directory

## Architecture Overview

```
Template Structure (Common Pattern)
────────────────────────────────────

┌─────────────────────────────┐
│ YAML Frontmatter            │ ← All required fields from SKB-42.1
│ (title, icon, tags, ...)    │   Placeholder values with comments
└─────────────────────────────┘

┌─────────────────────────────┐
│ One-Liner Summary           │ ← Agent-readable quick context
│ (1-2 sentences)             │   Appears at top of every page
└─────────────────────────────┘

┌─────────────────────────────┐
│ Type-Specific Sections      │ ← Depends on page type
│ (varies by type)            │   See individual templates below
└─────────────────────────────┘

┌─────────────────────────────┐
│ Related Pages (Wikilinks)   │ ← Cross-references to other pages
│ (backlinks auto-generated)  │   Uses naming conventions from SKB-42.2
└─────────────────────────────┘

Template Files:
───────────────

experiment-template.md          ← Most detailed (experiments are core entity)
chemical-template.md            ← Practical usage focus
reaction-type-template.md       ← Aggregation + learnings
researcher-template.md          ← Expertise + attribution
substrate-class-template.md    ← Cross-experiment patterns
```

## Implementation Steps

### 1. Create Experiment Page Template (Most Complex)

This is the most detailed template since experiments are the core entity.

**File:** `docs/chemistry-kb/templates/experiment-template.md`

```markdown
---
title: "EXP-YYYY-NNNN: [Short Descriptive Title]"
icon: "🧪"
tags:
  - eln:EXP-YYYY-NNNN
  - reaction:[reaction-type-slug]
  - researcher:[researcher-slug]
  - substrate-class:[substrate-slug]
  - scale:[small|medium|large|pilot]
  - challenge:[challenge-slug]
  - quality:[1-5]
eln_id: "EXP-YYYY-NNNN"
researcher: "Dr. FirstName LastName"
date: "YYYY-MM-DD"
status: "completed"
reaction_type: "Reaction Type Name"
substrate_class: "Substrate Class Name"
scale_category: "medium"
quality_score: 4
---

# EXP-YYYY-NNNN: [Short Descriptive Title]

> One-liner summary: [Brief description of what this experiment achieved and what made it notable]

## Metadata

| Field | Value |
|-------|-------|
| **Researcher** | [[Dr. FirstName LastName]] |
| **Date** | YYYY-MM-DD |
| **Reaction Type** | [[Reaction Type Name]] |
| **Substrate Class** | [[Substrate Class Name]] |
| **Scale** | X.X mmol |
| **Status** | ✅ Completed |
| **Quality Score** | ⭐⭐⭐⭐ (4/5) |

## Reaction Conditions

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Solvent** | [[Solvent Name]] | Volume: X mL |
| **Temperature** | XX °C | Maintained throughout |
| **Time** | X hours | Until TLC showed completion |
| **Atmosphere** | Nitrogen | Schlenk technique |
| **Catalyst** | [[Catalyst Name]] | X mol% |

## Reagents

| Reagent | Amount | Equivalents | CAS | Notes |
|---------|--------|-------------|-----|-------|
| [[Starting Material 1]] | XXX mg | 1.0 eq | XXX-XX-X | Source: [Vendor] |
| [[Reagent 2]] | XXX mg | X.X eq | XXX-XX-X | Freshly prepared |
| [[Catalyst]] | XX mg | X mol% | XXX-XX-X | Stored under argon |
| [[Solvent]] | X mL | - | XXX-XX-X | Anhydrous |

## Procedure

### Setup
1. Flame-dried round-bottom flask under nitrogen
2. Added [[Starting Material 1]] (XXX mg, X.X mmol)
3. Dissolved in [[Solvent]] (X mL)

### Reaction
1. Added [[Catalyst]] (XX mg, X mol%)
2. Heated to XX °C
3. Monitored by TLC (eluent: [system])
4. Reacted for X hours until completion

### Workup
1. Cooled to room temperature
2. Quenched with [quench method]
3. Extracted with [extraction details]
4. Dried over [drying agent]
5. Concentrated under reduced pressure

### Purification
1. Purified by [method] (eluent: [system])
2. Isolated product as [description]

## Results

| Metric | Value |
|--------|-------|
| **Yield** | XX% (XXX mg) |
| **Purity** | >95% (NMR) |
| **Characterization** | ¹H NMR, ¹³C NMR, HRMS |

### Product Characterization

**Appearance:** [Color and physical state]

**¹H NMR (XXX MHz, [solvent]):** δ [peak list]

**¹³C NMR (XXX MHz, [solvent]):** δ [peak list]

**HRMS (ESI):** m/z calculated for [formula]: XXX.XXXX, found: XXX.XXXX

## Practical Notes

### What Worked Well
- [Specific technique or condition that was successful]
- [Another success factor]

### Challenges Encountered
- **[[Challenge Name]]**: [Description of problem and how it was addressed]
- [Another challenge if applicable]

### Recommendations for Next Time
- [Suggestion for improvement]
- [Another recommendation]

### Substrate-Specific Insights
- [Insight about the substrate class used]
- [Another substrate-related observation]

## Related Experiments

- [[EXP-YYYY-NNNN]]: Similar substrate, different conditions
- [[EXP-YYYY-NNNN]]: Same reaction type, different scale

## Related Pages

- Reaction Type: [[Reaction Type Name]]
- Substrate Class: [[Substrate Class Name]]
- Key Chemicals: [[Chemical 1]], [[Chemical 2]], [[Chemical 3]]
- Researcher: [[Dr. FirstName LastName]]
```

### 2. Create Chemical Page Template

**File:** `docs/chemistry-kb/templates/chemical-template.md`

```markdown
---
title: "[Chemical Name]"
icon: "⚗️"
tags:
  - chemical
  - cas:NNNNN-NN-N
cas_number: "NNNNN-NN-N"
molecular_weight: XXX.XX
common_synonyms:
  - "Synonym 1"
  - "Synonym 2"
  - "Abbreviation"
---

# [Chemical Name]

> One-liner: [Brief description of what this chemical is used for in our lab]

## Properties

| Property | Value |
|----------|-------|
| **CAS Number** | XXX-XX-X |
| **Molecular Formula** | CXHYOZ |
| **Molecular Weight** | XXX.XX g/mol |
| **Common Synonyms** | Abbreviation, Synonym 1, Synonym 2 |

## Practical Usage Notes

### Storage
- Store at [temperature] under [conditions]
- Shelf life: [duration]
- Incompatibilities: [list]

### Handling
- [Safety considerations]
- [Special handling requirements]

### Institutional Knowledge
- **Preferred Vendor**: [Vendor name] — better purity for our applications
- **Quality Check**: [How we verify it's good to use]
- **Common Issues**: [Problems we've encountered]

## Used In Experiments

- [[EXP-YYYY-NNNN]]: [Brief context]
- [[EXP-YYYY-NNNN]]: [Brief context]
- [[EXP-YYYY-NNNN]]: [Brief context]

## Related Pages

- Reaction Types using this chemical: [[Reaction Type 1]], [[Reaction Type 2]]
- Who has experience: [[Dr. Researcher 1]], [[Dr. Researcher 2]]
```

### 3. Create ReactionType Page Template

**File:** `docs/chemistry-kb/templates/reaction-type-template.md`

```markdown
---
title: "[Reaction Type Name]"
icon: "🔬"
tags:
  - reaction-type
experiment_count: 0
avg_yield: 0
researcher_count: 0
---

# [Reaction Type Name]

> One-liner: [Brief description of this reaction type and our institutional experience]

## Institutional Experience

| Metric | Value |
|--------|-------|
| **Experiments Performed** | X |
| **Average Yield** | XX% |
| **Success Rate** | XX% |
| **Researchers with Experience** | X |

## Key Learnings

### What Works Well
- [Condition or substrate that consistently gives good results]
- [Another success factor]

### Common Pitfalls
- **[Pitfall Name]**: [Description and how to avoid]
- **[Another Pitfall]**: [Description and how to avoid]

### Substrate-Specific Advice
- **[[Substrate Class 1]]**: [Specific considerations]
- **[[Substrate Class 2]]**: [Specific considerations]

## Who to Ask

- **[[Dr. Researcher 1]]**: Expert in [specific aspect]
- **[[Dr. Researcher 2]]**: Experience with [specific substrates]

## Representative Experiments

- [[EXP-YYYY-NNNN]]: High yield, optimized conditions
- [[EXP-YYYY-NNNN]]: Challenging substrate, good learnings
- [[EXP-YYYY-NNNN]]: Scale-up example

## Related Pages

- Related Reaction Types: [[Related Reaction 1]], [[Related Reaction 2]]
- Common Catalysts: [[Catalyst 1]], [[Catalyst 2]]
```

### 4. Create Researcher Page Template

**File:** `docs/chemistry-kb/templates/researcher-template.md`

```markdown
---
title: "Dr. FirstName LastName"
icon: "👩‍🔬"
tags:
  - researcher
email: "email@institution.edu"
experiment_count: 0
primary_expertise:
  - "Area 1"
  - "Area 2"
---

# Dr. FirstName LastName

> One-liner: [Brief description of researcher's focus and expertise]

## Expertise Areas

- **[[Reaction Type 1]]**: [Level of experience]
- **[[Substrate Class 1]]**: [Specific knowledge]
- **[Technique/Method]**: [What they're known for]

## Recent Experiments

- [[EXP-YYYY-NNNN]]: [Brief description and outcome]
- [[EXP-YYYY-NNNN]]: [Brief description and outcome]
- [[EXP-YYYY-NNNN]]: [Brief description and outcome]

## Key Contributions

### Notable Results
- [Achievement or breakthrough]
- [Another significant result]

### Institutional Knowledge
- [Specific technique or insight they pioneered in the lab]
- [Another contribution]

## Contact

- **Email**: email@institution.edu
- **When to Ask**: [Types of questions they're good for]
```

### 5. Create SubstrateClass Page Template

**File:** `docs/chemistry-kb/templates/substrate-class-template.md`

```markdown
---
title: "[Substrate Class Name]"
icon: "🧬"
tags:
  - substrate-class
experiment_count: 0
---

# [Substrate Class Name]

> One-liner: [Brief description of this substrate class and key challenges]

## Common Challenges

- **[Challenge 1]**: [Description and typical manifestations]
- **[Challenge 2]**: [Description and typical manifestations]

## What Worked

### Successful Strategies
- [Technique or condition that works well for this substrate class]
- [Another successful approach]

### Reaction-Specific Advice
- **[[Reaction Type 1]]**: [Specific considerations for this substrate class]
- **[[Reaction Type 2]]**: [Specific considerations for this substrate class]

## Who Has Experience

- **[[Dr. Researcher 1]]**: [What they know about this substrate class]
- **[[Dr. Researcher 2]]**: [What they know about this substrate class]

## Representative Experiments

- [[EXP-YYYY-NNNN]]: [Why this is a good example]
- [[EXP-YYYY-NNNN]]: [Why this is a good example]

## Related Pages

- Related Substrate Classes: [[Related Class 1]], [[Related Class 2]]
- Common Reactions: [[Reaction Type 1]], [[Reaction Type 2]]
```

### 6. Validate Templates with SKB

Test each template by:
1. Creating a sample page in SKB using the template
2. Verifying frontmatter parses correctly
3. Verifying markdown converts to Tiptap JSON without errors
4. Verifying page renders correctly in SKB UI
5. Verifying wikilinks are recognized and create graph edges

## Testing Requirements

### Template Validation

- [ ] All 5 templates have complete YAML frontmatter
- [ ] All required fields from SKB-42.1 are present
- [ ] All templates include wikilink examples
- [ ] All templates include one-liner summaries

### Markdown Conversion

- [ ] All templates pass markdownToTiptap() without errors
- [ ] Tables render correctly in SKB UI
- [ ] Lists render correctly in SKB UI
- [ ] Blockquotes (one-liner) render correctly
- [ ] Wikilinks are recognized and clickable

### Content Quality

- [ ] Placeholder content demonstrates best practices
- [ ] Templates include comments explaining each section
- [ ] Templates include examples of practical notes (not just theory)
- [ ] Templates are usable by non-experts (clear structure)

## Files to Create/Modify

| File Path | Type | Purpose |
|-----------|------|---------|
| `docs/chemistry-kb/templates/experiment-template.md` | Create | Experiment page template |
| `docs/chemistry-kb/templates/chemical-template.md` | Create | Chemical page template |
| `docs/chemistry-kb/templates/reaction-type-template.md` | Create | Reaction type template |
| `docs/chemistry-kb/templates/researcher-template.md` | Create | Researcher template |
| `docs/chemistry-kb/templates/substrate-class-template.md` | Create | Substrate class template |
| `tests/chemistry-kb/template-validation.test.ts` | Create | Test suite for templates |

## Dev Notes

### Markdown Compatibility

SKB's markdownToTiptap() converter supports:
- Tables (GitHub-flavored markdown)
- Lists (ordered and unordered)
- Blockquotes
- Inline code and code blocks
- Wikilinks `[[Page Name]]`
- Emoji in frontmatter icons

Does NOT support:
- HTML tags
- Complex nested tables
- Footnotes
- Definition lists

### Template Placeholder Conventions

- `YYYY-MM-DD` for dates
- `XXX` for numeric values
- `[Description]` for text to be filled in
- `[[Page Name]]` for wikilinks
- Comments in frontmatter use `#` prefix

### Section Ordering

Keep sections in a consistent order across all page types:
1. One-liner summary (always first)
2. Type-specific metadata/properties
3. Main content sections
4. Related pages (always last)

### Future Template Extensions

Consider adding sections for:
- Safety warnings (for experiments with hazardous materials)
- Cost tracking (reagent costs, time investment)
- Equipment requirements (specialized instruments)
- Literature references (papers that inspired the approach)
