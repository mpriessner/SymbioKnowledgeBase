# Story SKB-42.1: Page Type Taxonomy & Frontmatter Schemas

**Epic:** EPIC-42 Chemistry Knowledge Base — Information Architecture
**Story ID:** SKB-42.1
**Story Points:** 3
**Priority:** Critical
**Status:** Planned
**Depends On:** None (foundational)

## User Story

As an architect designing the chemistry KB, I want clearly defined page types with standardized frontmatter schemas, So that all subsequent data pipeline stories produce consistent, well-structured pages.

## Acceptance Criteria

- [ ] Define Experiment page frontmatter schema with fields: title, icon (🧪), tags (eln:, reaction:, researcher:, substrate-class:, scale:, challenge:, quality:), eln_id, researcher, date, status, reaction_type, substrate_class, scale_category, quality_score
- [ ] Define Chemical page frontmatter schema with fields: title, icon (⚗️), tags (cas:, chemical), cas_number, molecular_weight, common_synonyms (array)
- [ ] Define ReactionType page frontmatter schema with fields: title, icon (🔬), tags (reaction-type), experiment_count, avg_yield, researcher_count
- [ ] Define Researcher page frontmatter schema with fields: title, icon (👩‍🔬), tags (researcher), email, experiment_count, primary_expertise (array)
- [ ] Define SubstrateClass page frontmatter schema with fields: title, icon (🧬), tags (substrate-class), experiment_count
- [ ] Define tag taxonomy with all namespaced prefixes: eln:, cas:, reaction:, researcher:, substrate-class:, scale:, challenge:, quality:
- [ ] Define allowed values for scale tags: small, medium, large, pilot
- [ ] Define quality_score computation rules: yield-based (>90%=5, >80%=4, >70%=3, >60%=2, <60%=1), adjusted for completeness (has practical notes, has products, has full procedure)
- [ ] Define status values for experiments: planned, in-progress, completed, failed, abandoned
- [ ] Document all schemas in PAGE-TYPE-TAXONOMY.md with complete field definitions, types, examples, and validation rules
- [ ] Include extensibility notes for future page types
- [ ] Schema passes review by lead architect

## Architecture Overview

```
Page Type Taxonomy (5 Types)
─────────────────────────────

┌─────────────┐
│ Experiment  │ ← Core entity (from ChemELN)
│   🧪        │    - Links to chemicals, reaction types, researchers, substrates
└─────────────┘    - Quality-scored
      │            - Attributed to researcher + date
      │
      ├─────────► Chemical (⚗️)          ← What was used
      │           - CAS-indexed
      │           - Practical usage notes
      │
      ├─────────► ReactionType (🔬)      ← What type of chemistry
      │           - Aggregates experiments
      │           - Institutional learnings
      │
      ├─────────► Researcher (👩‍🔬)       ← Who did it
      │           - Expertise areas
      │           - Experiment history
      │
      └─────────► SubstrateClass (🧬)    ← What substrates were involved
                  - Cross-experiment patterns
                  - Substrate-specific challenges

Frontmatter Schema Structure:
─────────────────────────────

Common Fields (all page types):
  title: string             ← Unique within tenant
  icon: emoji               ← Visual identifier
  tags: string[]            ← Namespaced for filtering

Type-Specific Fields:
  Experiment    → eln_id, researcher, date, status, reaction_type, substrate_class, scale_category, quality_score
  Chemical      → cas_number, molecular_weight, common_synonyms
  ReactionType  → experiment_count, avg_yield, researcher_count
  Researcher    → email, experiment_count, primary_expertise
  SubstrateClass → experiment_count

Tag Taxonomy (Namespaced):
──────────────────────────

eln:*               → Links to ChemELN experiment ID (e.g., eln:EXP-2026-0042)
cas:*               → Links to CAS registry number (e.g., cas:14221-01-3)
reaction:*          → Reaction type classification (e.g., reaction:suzuki-coupling)
researcher:*        → Researcher attribution (e.g., researcher:mueller)
substrate-class:*   → Substrate classification (e.g., substrate-class:heteroaryl)
scale:*             → Scale category (small/medium/large/pilot)
challenge:*         → Specific challenge faced (e.g., challenge:protodeboronation)
quality:*           → Quality score (1-5)
```

## Implementation Steps

### 1. Define Experiment Page Schema

Create the most detailed schema first since experiments are the core entity.

```yaml
# Experiment Page Frontmatter Schema

title: string                    # Format: "EXP-YYYY-NNNN: [Short Title]"
                                 # Example: "EXP-2026-0042: Suzuki Coupling of Aryl Bromide"
                                 # Required, must be unique within tenant

icon: string                     # Value: "🧪" (always)
                                 # Required

tags: string[]                   # Namespaced tags for filtering
                                 # Required tags: eln:*, quality:*
                                 # Optional tags: reaction:*, researcher:*, substrate-class:*, scale:*, challenge:*
                                 # Example: ["eln:EXP-2026-0042", "reaction:suzuki-coupling", "quality:4"]

eln_id: string                   # ChemELN experiment identifier
                                 # Format: EXP-YYYY-NNNN
                                 # Required, must match ChemELN database

researcher: string               # Full name of researcher
                                 # Example: "Dr. Anna Mueller"
                                 # Required, should match Researcher page title

date: string                     # Experiment completion date
                                 # Format: ISO 8601 (YYYY-MM-DD)
                                 # Required

status: enum                     # Experiment status
                                 # Values: planned | in-progress | completed | failed | abandoned
                                 # Required

reaction_type: string            # Reaction classification
                                 # Example: "Suzuki Coupling"
                                 # Optional, should match ReactionType page title

substrate_class: string          # Substrate classification
                                 # Example: "Heteroaryl Halides"
                                 # Optional, should match SubstrateClass page title

scale_category: enum             # Scale classification
                                 # Values: small | medium | large | pilot
                                 # Required

quality_score: integer           # Computed quality score
                                 # Range: 1-5
                                 # Computed via yield + completeness algorithm
                                 # Required
```

### 2. Define Chemical Page Schema

```yaml
# Chemical Page Frontmatter Schema

title: string                    # Common chemical name (IUPAC or common usage)
                                 # Example: "Pd(PPh3)4" or "Tetrahydrofuran"
                                 # Required, must be unique (disambiguate with CAS if needed)

icon: string                     # Value: "⚗️" (always)
                                 # Required

tags: string[]                   # Namespaced tags
                                 # Required tags: chemical, cas:*
                                 # Example: ["chemical", "cas:14221-01-3"]

cas_number: string               # CAS registry number
                                 # Format: NNNNN-NN-N (with checksum validation)
                                 # Required, must be unique

molecular_weight: number         # Molecular weight in g/mol
                                 # Optional, useful for stoichiometry calculations

common_synonyms: string[]        # Alternative names for wikilink resolution
                                 # Example: ["THF", "Tetrahydrofuran", "Oxolane"]
                                 # Optional
```

### 3. Define ReactionType, Researcher, SubstrateClass Schemas

Document the remaining three page types with similar detail.

### 4. Define Tag Taxonomy

Create a comprehensive tag namespace specification:

```
Tag Namespace Specification
───────────────────────────

eln:EXP-YYYY-NNNN        → Experiment ID from ChemELN
                           Format: eln:EXP-YYYY-NNNN
                           Used on: Experiment pages only
                           Example: eln:EXP-2026-0042

cas:NNNNN-NN-N           → CAS registry number
                           Format: cas:[CAS number]
                           Used on: Chemical pages only
                           Example: cas:14221-01-3

reaction:slug            → Reaction type classification
                           Format: reaction:[kebab-case-name]
                           Used on: Experiment pages
                           Example: reaction:suzuki-coupling

researcher:slug          → Researcher attribution
                           Format: researcher:[lastname-lowercase]
                           Used on: Experiment pages
                           Example: researcher:mueller

substrate-class:slug     → Substrate classification
                           Format: substrate-class:[kebab-case-name]
                           Used on: Experiment pages
                           Example: substrate-class:heteroaryl

scale:category           → Scale category
                           Format: scale:[small|medium|large|pilot]
                           Used on: Experiment pages
                           Allowed values:
                             - small: <1 mmol
                             - medium: 1-10 mmol
                             - large: 10-100 mmol
                             - pilot: >100 mmol

challenge:slug           → Specific challenge encountered
                           Format: challenge:[kebab-case-description]
                           Used on: Experiment pages
                           Example: challenge:protodeboronation

quality:N                → Quality score
                           Format: quality:[1|2|3|4|5]
                           Used on: Experiment pages
                           Example: quality:4
```

### 5. Define Quality Score Computation

```typescript
/**
 * Quality score algorithm for experiment pages
 */
function computeQualityScore(experiment: Experiment): number {
  // Step 1: Base score from yield
  let baseScore = 1;

  if (experiment.yield >= 90) baseScore = 5;
  else if (experiment.yield >= 80) baseScore = 4;
  else if (experiment.yield >= 70) baseScore = 3;
  else if (experiment.yield >= 60) baseScore = 2;
  else baseScore = 1;

  // Step 2: Completeness adjustments
  let completenessBonus = 0;

  if (experiment.hasPracticalNotes) completenessBonus += 0.5;
  if (experiment.hasProducts && experiment.hasCharacterization) completenessBonus += 0.5;
  if (experiment.hasFullProcedure) completenessBonus += 0.5;

  // Step 3: Combine and clamp
  const finalScore = Math.min(5, Math.max(1, baseScore + completenessBonus));

  return Math.round(finalScore);
}
```

### 6. Document in PAGE-TYPE-TAXONOMY.md

Create the complete documentation file with all schemas, examples, validation rules, and extensibility notes.

## Testing Requirements

### Schema Validation

- [ ] All 5 page types have complete frontmatter schemas documented
- [ ] Each field includes: name, type, format, required/optional, examples
- [ ] Tag taxonomy covers all expected filtering use cases
- [ ] Quality score algorithm is documented with examples

### Example Validation

- [ ] Provide at least 2 complete frontmatter examples per page type
- [ ] Examples cover edge cases (e.g., experiment with no substrate_class)
- [ ] Examples demonstrate correct tag formatting

### Review Validation

- [ ] Schema reviewed by lead architect
- [ ] Schema reviewed by at least one chemist (domain expert)
- [ ] No conflicts with existing SKB tag conventions

## Files to Create/Modify

| File Path | Type | Purpose |
|-----------|------|---------|
| `docs/chemistry-kb/PAGE-TYPE-TAXONOMY.md` | Create | Complete schema documentation |
| `docs/chemistry-kb/examples/experiment-frontmatter.yaml` | Create | Example frontmatter for validation |
| `docs/chemistry-kb/examples/chemical-frontmatter.yaml` | Create | Example frontmatter for validation |

## Dev Notes

### Extensibility Considerations

- Use `schema_version: 1.0` in frontmatter to support future migrations
- Reserve namespace prefixes for future use: method:, equipment:, vendor:, safety:
- Keep frontmatter fields optional where possible (only title, icon, tags, eln_id required for experiments)

### Multi-Tenant Considerations

- CAS numbers must be unique within a tenant (not globally)
- ELN IDs must be unique within a tenant
- Researcher email addresses may be the same across tenants (different institutions)

### Performance Considerations

- Tag queries will be indexed in SKB's database
- Wikilink resolution uses exact title matching (no fuzzy search)
- Quality score is computed once at page creation (not dynamically)

### Known Edge Cases

- **Experiment with no yield** — Use quality:1 and mark as "incomplete"
- **Chemical with multiple CAS numbers** — Use primary CAS, list others in synonyms
- **Researcher with no email** — Make email optional, use researcher name for attribution
- **Substrate class spans multiple experiments** — This is expected; experiment_count aggregates them
