# Story SKB-43.4: Reaction Type Classification

**Epic:** Epic 43 - ChemELN Data Extraction & Transformation
**Story ID:** SKB-43.4
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-43.2 (experiment data must be fetched)

---

## User Story

As a data normalization service, I want to classify experiments into reaction types, So that I can group similar experiments and identify researcher expertise areas.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/normalizers/reactions.ts` exports `classifyReactions()` function
- [ ] Primary classification from `experiment_type` field in ChemELN database
- [ ] Keyword-based fallback classification from experiment title and objective fields
- [ ] Lookup table of approximately 30 common reaction types (Suzuki, Grignard, Aldol, Wittig, Buchwald-Hartwig, Heck, Sonogashira, Friedel-Crafts, Diels-Alder, hydrogenation, oxidation, reduction, esterification, amidation, etc.)
- [ ] Unknown types categorized as "Unclassified"
- [ ] Output `ReactionTypeStats[]` grouping experiments by reaction type with counts
- [ ] Each experiment assigned exactly one reaction type (no multi-classification)
- [ ] Unit tests verify lookup table matching, keyword extraction, fallback logic
- [ ] Integration test classifies real experiments from ChemELN

---

## Architecture Overview

```
Input: ExperimentData[]
    │
    │ For each experiment:
    │   1. Check experiment_type field
    │   2. If null/empty → keyword search in title + objective
    │   3. Match against reaction type lookup table
    │   4. If no match → "Unclassified"
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Reaction Type Lookup Table                         │
│  {                                                  │
│    'Suzuki': ['suzuki', 'suzuki-miyaura', 'cross-  │
│      coupling'],                                    │
│    'Grignard': ['grignard', 'magnesium'],           │
│    'Aldol': ['aldol', 'aldol condensation'],        │
│    'Wittig': ['wittig', 'phosphonium ylide'],       │
│    'Buchwald-Hartwig': ['buchwald', 'hartwig',      │
│      'amination'],                                  │
│    'Heck': ['heck', 'heck reaction'],               │
│    'Sonogashira': ['sonogashira', 'alkyne coupling'],│
│    'Hydrogenation': ['hydrogenation', 'H2',         │
│      'reduction'],                                  │
│    'Oxidation': ['oxidation', 'oxidize'],           │
│    'Esterification': ['esterification', 'ester'],   │
│    ... (30 total reaction types)                    │
│  }                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ Classify each experiment
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Classified Experiments                             │
│  [                                                  │
│    {                                                │
│      experimentId: 'exp-1',                         │
│      reactionType: 'Suzuki',                        │
│      confidence: 'high', // from experiment_type    │
│    },                                               │
│    {                                                │
│      experimentId: 'exp-2',                         │
│      reactionType: 'Grignard',                      │
│      confidence: 'medium', // from keyword match    │
│    },                                               │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ Group by reaction type
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  ReactionTypeStats[]                                │
│  [                                                  │
│    {                                                │
│      reactionType: 'Suzuki',                        │
│      experimentCount: 15,                           │
│      experimentIds: ['exp-1', 'exp-5', ...],        │
│    },                                               │
│    {                                                │
│      reactionType: 'Grignard',                      │
│      experimentCount: 8,                            │
│      experimentIds: ['exp-2', 'exp-9', ...],        │
│    },                                               │
│    {                                                │
│      reactionType: 'Unclassified',                  │
│      experimentCount: 3,                            │
│      experimentIds: ['exp-12', ...],                │
│    },                                               │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
```

**Why single classification:** Some experiments could theoretically belong to multiple categories (e.g., "Oxidative Suzuki coupling"), but we enforce single classification to simplify grouping and avoid ambiguity. We prioritize the most specific reaction type.

**Confidence levels:**
- **High:** Matched from `experiment_type` field (researcher explicitly classified it)
- **Medium:** Matched from title/objective keywords (inferred by our system)
- **Low:** Defaulted to "Unclassified" (no match found)

---

## Implementation Steps

### Step 1: Define Reaction Type Lookup Table

Create a comprehensive lookup table of common organic chemistry reactions.

**File: `src/lib/chemeln/normalizers/reactions.ts`**

```typescript
const REACTION_TYPE_KEYWORDS: Record<string, string[]> = {
  'Suzuki': ['suzuki', 'suzuki-miyaura', 'cross-coupling', 'pd-catalyzed coupling'],
  'Grignard': ['grignard', 'magnesium', 'mg', 'organometallic'],
  'Aldol': ['aldol', 'aldol condensation', 'enolate'],
  'Wittig': ['wittig', 'phosphonium', 'ylide'],
  'Buchwald-Hartwig': ['buchwald', 'hartwig', 'amination', 'c-n coupling'],
  'Heck': ['heck', 'heck reaction', 'mizoroki-heck'],
  'Sonogashira': ['sonogashira', 'alkyne coupling', 'pd/cu coupling'],
  'Friedel-Crafts Acylation': ['friedel-crafts acylation', 'acylation', 'alcl3'],
  'Friedel-Crafts Alkylation': ['friedel-crafts alkylation', 'alkylation'],
  'Diels-Alder': ['diels-alder', 'cycloaddition', '4+2 cycloaddition'],
  'Hydrogenation': ['hydrogenation', 'h2', 'reduction', 'catalytic reduction'],
  'Oxidation': ['oxidation', 'oxidize', 'ox', 'pcc', 'jones', 'swern'],
  'Reduction': ['reduction', 'reduce', 'lialh4', 'nabh4', 'borohydride'],
  'Esterification': ['esterification', 'ester', 'ester formation'],
  'Amidation': ['amidation', 'amide', 'peptide coupling'],
  'Hydrolysis': ['hydrolysis', 'hydrolyze', 'saponification'],
  'Nitration': ['nitration', 'nitro', 'hno3'],
  'Halogenation': ['halogenation', 'bromination', 'chlorination', 'iodination'],
  'Dehydration': ['dehydration', 'eliminate', 'elimination'],
  'Substitution': ['substitution', 'sn1', 'sn2', 'nucleophilic substitution'],
  'Addition': ['addition', 'michael addition', 'conjugate addition'],
  'Cyclization': ['cyclization', 'ring closure', 'macrocyclization'],
  'Deprotection': ['deprotection', 'deprotect', 'boc removal', 'fmoc removal'],
  'Protection': ['protection', 'protect', 'boc', 'fmoc'],
  'Methylation': ['methylation', 'methyl', 'dimethyl sulfate'],
  'Acetylation': ['acetylation', 'acetyl', 'acetic anhydride'],
  'Silylation': ['silylation', 'tms', 'trimethylsilyl'],
  'Coupling': ['coupling', 'peptide coupling', 'edc', 'dcc'],
  'Rearrangement': ['rearrangement', 'claisen', 'cope', 'beckmann'],
  'Polymerization': ['polymerization', 'polymer', 'radical polymerization'],
};
```

**Coverage:** This lookup table covers the most common reaction types in organic synthesis. It can be extended based on actual ChemELN data patterns.

---

### Step 2: Define Output Types

Add reaction type statistics type to `src/lib/chemeln/types.ts`.

**Add to `src/lib/chemeln/types.ts`:**

```typescript
export interface ReactionTypeStats {
  reactionType: string;
  experimentCount: number;
  experimentIds: string[];
}

export interface ClassifiedExperiment {
  experimentId: string;
  reactionType: string;
  confidence: 'high' | 'medium' | 'low';
}
```

---

### Step 3: Implement Classification Logic

Create the main classification function.

**Add to `src/lib/chemeln/normalizers/reactions.ts`:**

```typescript
import { ExperimentData, ClassifiedExperiment } from '../types';

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function classifyExperiment(experiment: ExperimentData): ClassifiedExperiment {
  // Primary: Use experiment_type field if present
  if (experiment.experimentType && experiment.experimentType !== 'Unknown') {
    const normalizedType = normalizeText(experiment.experimentType);

    for (const [reactionType, keywords] of Object.entries(REACTION_TYPE_KEYWORDS)) {
      if (keywords.some(keyword => normalizedType.includes(keyword))) {
        return {
          experimentId: experiment.id,
          reactionType,
          confidence: 'high',
        };
      }
    }
  }

  // Fallback: Search title and objective for keywords
  const searchText = normalizeText(
    `${experiment.title} ${experiment.objective ?? ''}`
  );

  for (const [reactionType, keywords] of Object.entries(REACTION_TYPE_KEYWORDS)) {
    if (keywords.some(keyword => searchText.includes(keyword))) {
      return {
        experimentId: experiment.id,
        reactionType,
        confidence: 'medium',
      };
    }
  }

  // No match found
  return {
    experimentId: experiment.id,
    reactionType: 'Unclassified',
    confidence: 'low',
  };
}
```

**Classification priority:**
1. Check `experiment_type` field (high confidence)
2. Search title + objective for keywords (medium confidence)
3. Default to "Unclassified" (low confidence)

**Keyword matching:**
- Case-insensitive substring matching
- "suzuki" matches "Suzuki coupling", "Pd-catalyzed Suzuki reaction", etc.
- First match wins (order matters: more specific reactions should be listed first)

---

### Step 4: Aggregate into ReactionTypeStats

Create a function to group experiments by reaction type.

**Add to `src/lib/chemeln/normalizers/reactions.ts`:**

```typescript
import { ReactionTypeStats } from '../types';

export function classifyReactions(experiments: ExperimentData[]): ReactionTypeStats[] {
  const classified = experiments.map(classifyExperiment);

  const statsMap = new Map<string, string[]>();

  for (const exp of classified) {
    if (!statsMap.has(exp.reactionType)) {
      statsMap.set(exp.reactionType, []);
    }
    statsMap.get(exp.reactionType)!.push(exp.experimentId);
  }

  const stats: ReactionTypeStats[] = Array.from(statsMap.entries()).map(
    ([reactionType, experimentIds]) => ({
      reactionType,
      experimentCount: experimentIds.length,
      experimentIds,
    })
  );

  // Sort by experiment count (most common reactions first)
  return stats.sort((a, b) => b.experimentCount - a.experimentCount);
}
```

---

### Step 5: Add Individual Experiment Classification

Export a helper to classify a single experiment (useful for on-demand classification).

**Add to `src/lib/chemeln/normalizers/reactions.ts`:**

```typescript
export function classifySingleExperiment(
  experiment: ExperimentData
): ClassifiedExperiment {
  return classifyExperiment(experiment);
}
```

---

### Step 6: Export Public API

Update `src/lib/chemeln/index.ts` to expose the classifier.

**Add to `src/lib/chemeln/index.ts`:**

```typescript
export { classifyReactions, classifySingleExperiment } from './normalizers/reactions';
export type { ReactionTypeStats, ClassifiedExperiment } from './types';
```

---

## Testing Requirements

### Unit Test: `tests/unit/chemeln/normalizers/reactions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { classifyReactions, classifySingleExperiment } from '@/lib/chemeln/normalizers/reactions';
import { ExperimentData } from '@/lib/chemeln/types';

describe('Reaction Type Classification', () => {
  it('should classify experiment from experiment_type field', () => {
    const experiment: ExperimentData = {
      id: 'exp-1',
      title: 'Test Experiment',
      objective: null,
      experimentType: 'Suzuki-Miyaura Cross-Coupling',
      status: 'completed',
      createdBy: 'user-1',
      createdAt: '2026-03-21T10:00:00Z',
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
    };

    const classified = classifySingleExperiment(experiment);

    expect(classified.reactionType).toBe('Suzuki');
    expect(classified.confidence).toBe('high');
  });

  it('should classify experiment from title keywords', () => {
    const experiment: ExperimentData = {
      id: 'exp-2',
      title: 'Grignard Reaction with Magnesium',
      objective: 'Synthesize organometallic reagent',
      experimentType: 'Unknown',
      status: 'completed',
      createdBy: 'user-1',
      createdAt: '2026-03-21T10:00:00Z',
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
    };

    const classified = classifySingleExperiment(experiment);

    expect(classified.reactionType).toBe('Grignard');
    expect(classified.confidence).toBe('medium');
  });

  it('should default to Unclassified for unknown reactions', () => {
    const experiment: ExperimentData = {
      id: 'exp-3',
      title: 'Novel Reaction Pathway',
      objective: 'Explore new chemistry',
      experimentType: 'Unknown',
      status: 'completed',
      createdBy: 'user-1',
      createdAt: '2026-03-21T10:00:00Z',
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
    };

    const classified = classifySingleExperiment(experiment);

    expect(classified.reactionType).toBe('Unclassified');
    expect(classified.confidence).toBe('low');
  });

  it('should group experiments by reaction type', () => {
    const experiments: ExperimentData[] = [
      {
        id: 'exp-1',
        title: 'Suzuki Coupling',
        experimentType: 'Suzuki',
        // ... other fields
      } as ExperimentData,
      {
        id: 'exp-2',
        title: 'Another Suzuki Reaction',
        experimentType: 'Suzuki',
        // ... other fields
      } as ExperimentData,
      {
        id: 'exp-3',
        title: 'Grignard Reaction',
        experimentType: 'Grignard',
        // ... other fields
      } as ExperimentData,
    ];

    const stats = classifyReactions(experiments);

    const suzukiStats = stats.find(s => s.reactionType === 'Suzuki');
    const grignardStats = stats.find(s => s.reactionType === 'Grignard');

    expect(suzukiStats?.experimentCount).toBe(2);
    expect(grignardStats?.experimentCount).toBe(1);
  });

  it('should sort stats by experiment count descending', () => {
    const experiments: ExperimentData[] = [
      { id: 'exp-1', experimentType: 'Suzuki' } as ExperimentData,
      { id: 'exp-2', experimentType: 'Grignard' } as ExperimentData,
      { id: 'exp-3', experimentType: 'Grignard' } as ExperimentData,
      { id: 'exp-4', experimentType: 'Grignard' } as ExperimentData,
    ];

    const stats = classifyReactions(experiments);

    expect(stats[0].reactionType).toBe('Grignard');
    expect(stats[0].experimentCount).toBe(3);
    expect(stats[1].reactionType).toBe('Suzuki');
    expect(stats[1].experimentCount).toBe(1);
  });
});
```

### Integration Test: `tests/integration/chemeln/normalizers/reactions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { fetchExperiments } from '@/lib/chemeln';
import { classifyReactions } from '@/lib/chemeln/normalizers/reactions';

describe('Reaction Type Classification (Integration)', () => {
  it('should classify all experiments from ChemELN', async () => {
    const experiments = await fetchExperiments();
    const stats = classifyReactions(experiments);

    expect(Array.isArray(stats)).toBe(true);
    expect(stats.length).toBeGreaterThan(0);

    // Verify all experiments are accounted for
    const totalClassified = stats.reduce((sum, s) => sum + s.experimentCount, 0);
    expect(totalClassified).toBe(experiments.length);

    // Verify no undefined reaction types
    stats.forEach(s => {
      expect(s.reactionType).toBeDefined();
      expect(s.experimentCount).toBeGreaterThan(0);
    });
  }, 20000);
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/lib/chemeln/types.ts` (add ReactionTypeStats, ClassifiedExperiment) |
| CREATE | `src/lib/chemeln/normalizers/reactions.ts` |
| MODIFY | `src/lib/chemeln/index.ts` (export classifyReactions) |
| CREATE | `tests/unit/chemeln/normalizers/reactions.test.ts` |
| CREATE | `tests/integration/chemeln/normalizers/reactions.test.ts` |

---

## Dev Notes

**Keyword ambiguity:** Some keywords overlap (e.g., "reduction" appears in both Hydrogenation and Reduction). The lookup table order determines priority — more specific reactions should be listed first to avoid false positives.

**Future enhancement - Machine learning:** The keyword-based approach is simple but limited. A future improvement could use a small language model (e.g., DistilBERT fine-tuned on chemistry papers) to classify reaction types with higher accuracy.

**Unclassified category:** The "Unclassified" category captures novel or poorly-documented experiments. Periodically review these experiments to identify missing reaction types and extend the lookup table.

**ChemELN schema dependency:** This classifier assumes ChemELN's `experiment_type` field exists. If the schema changes, the fallback keyword search ensures graceful degradation.

---

**Last Updated:** 2026-03-21
