# Chemistry KB Page Type Taxonomy

**Schema Version:** 1.0
**Story:** SKB-42.1

## Overview

The Chemistry Knowledge Base uses five distinct page types, each with a standardized frontmatter schema. All pages share common base fields and use namespaced tags for filtering and cross-referencing.

## Common Base Fields

All page types include the following fields:

| Field  | Type     | Required | Description                      |
|--------|----------|----------|----------------------------------|
| title  | string   | Yes      | Unique page title within tenant  |
| icon   | string   | Yes      | Emoji icon for visual identity   |
| tags   | string[] | Yes      | Namespaced tags for filtering    |

## Page Types

### 1. Experiment (core entity)

**Icon:** `🧪`
**Source:** ChemELN

| Field            | Type             | Required | Description                                    |
|------------------|------------------|----------|------------------------------------------------|
| eln_id           | string           | Yes      | ChemELN experiment ID. Format: `EXP-YYYY-NNNN` |
| researcher       | string           | Yes      | Full name of researcher                         |
| date             | string           | Yes      | Experiment date (ISO 8601: `YYYY-MM-DD`)        |
| status           | ExperimentStatus | Yes      | `planned` / `in-progress` / `completed` / `failed` / `abandoned` |
| reaction_type    | string           | No       | Reaction classification (matches ReactionType page title) |
| substrate_class  | string           | No       | Substrate classification (matches SubstrateClass page title) |
| scale_category   | ScaleCategory    | Yes      | `small` / `medium` / `large` / `pilot`          |
| quality_score    | number (1-5)     | Yes      | Computed quality score                           |

**Required tags:** `eln:*`, `quality:*`
**Optional tags:** `reaction:*`, `researcher:*`, `substrate-class:*`, `scale:*`, `challenge:*`

### 2. Chemical

**Icon:** `⚗️`

| Field            | Type     | Required | Description                             |
|------------------|----------|----------|-----------------------------------------|
| cas_number       | string   | Yes      | CAS registry number (`NNNNN-NN-N`)      |
| molecular_weight | number   | No       | Molecular weight in g/mol               |
| common_synonyms  | string[] | No       | Alternative names for wikilink resolution |

**Required tags:** `chemical`, `cas:*`

### 3. ReactionType

**Icon:** `🔬`

| Field            | Type   | Required | Description                     |
|------------------|--------|----------|---------------------------------|
| experiment_count | number | Yes      | Number of linked experiments    |
| avg_yield        | number | No       | Average yield across experiments |
| researcher_count | number | Yes      | Number of contributing researchers |

**Required tags:** `reaction-type`

### 4. Researcher

**Icon:** `👩‍🔬`

| Field             | Type     | Required | Description                  |
|-------------------|----------|----------|------------------------------|
| email             | string   | No       | Researcher email address     |
| experiment_count  | number   | Yes      | Number of experiments        |
| primary_expertise | string[] | No       | Areas of expertise           |

**Required tags:** `researcher`

### 5. SubstrateClass

**Icon:** `🧬`

| Field            | Type   | Required | Description                  |
|------------------|--------|----------|------------------------------|
| experiment_count | number | Yes      | Number of linked experiments |

**Required tags:** `substrate-class`

## Tag Taxonomy

All tags use namespaced prefixes for consistent filtering:

| Namespace           | Format                               | Used On          | Example                          |
|---------------------|--------------------------------------|------------------|----------------------------------|
| `eln:`              | `eln:EXP-YYYY-NNNN`                 | Experiment       | `eln:EXP-2026-0042`             |
| `cas:`              | `cas:[CAS number]`                  | Chemical         | `cas:14221-01-3`                |
| `reaction:`         | `reaction:[kebab-case-name]`        | Experiment       | `reaction:suzuki-coupling`      |
| `researcher:`       | `researcher:[lastname-lowercase]`   | Experiment       | `researcher:mueller`            |
| `substrate-class:`  | `substrate-class:[kebab-case-name]` | Experiment       | `substrate-class:heteroaryl`    |
| `scale:`            | `scale:[category]`                  | Experiment       | `scale:medium`                  |
| `challenge:`        | `challenge:[kebab-case-description]`| Experiment       | `challenge:protodeboronation`   |
| `quality:`          | `quality:[1-5]`                     | Experiment       | `quality:4`                     |

### Scale Categories

| Value    | Description    |
|----------|----------------|
| `small`  | < 1 mmol       |
| `medium` | 1 - 10 mmol    |
| `large`  | 10 - 100 mmol  |
| `pilot`  | > 100 mmol     |

## Quality Score Computation

Quality scores range from 1-5 and are computed from experiment yield and documentation completeness.

### Step 1: Base Score (from yield)

| Yield   | Base Score |
|---------|------------|
| >= 90%  | 5          |
| >= 80%  | 4          |
| >= 70%  | 3          |
| >= 60%  | 2          |
| < 60%   | 1          |

### Step 2: Completeness Bonuses

| Condition                             | Bonus |
|---------------------------------------|-------|
| Has practical notes                   | +0.5  |
| Has products AND characterization     | +0.5  |
| Has full procedure                    | +0.5  |

### Step 3: Final Score

`finalScore = clamp(round(baseScore + completenessBonus), 1, 5)`

**Example:** An experiment with 72% yield (base 3), practical notes (+0.5), and full procedure (+0.5) = round(4.0) = **4**.

## Validation Rules

- `eln_id` must match format `EXP-YYYY-NNNN`
- `cas_number` must match format `NNNNN-NN-N` (CAS checksum validation)
- `quality_score` must be an integer between 1 and 5
- `date` must be ISO 8601 format (`YYYY-MM-DD`)
- `title` must be unique within tenant
- `cas_number` must be unique within tenant
- Namespaced tags must not have empty values (e.g., `eln:` alone is invalid)

## Extensibility

### Reserved Namespace Prefixes

The following prefixes are reserved for future page types:

- `method:` - Analytical method classification
- `equipment:` - Equipment/instrument tags
- `vendor:` - Chemical vendor/supplier
- `safety:` - Safety classification tags

### Schema Versioning

All frontmatter should include awareness of `schema_version: 1.0` for future migration support. When schemas evolve, version numbers allow automated migration of existing pages.

## Known Edge Cases

- **Experiment with no yield:** Use `quality:1` and mark status as appropriate
- **Chemical with multiple CAS numbers:** Use primary CAS in `cas_number`, list others in `common_synonyms`
- **Researcher with no email:** `email` is optional
- **SubstrateClass spanning multiple experiments:** Expected; `experiment_count` aggregates across experiments
