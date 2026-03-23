# Story SKB-46.2: Contextual Search Tags

**Epic:** Epic 46 - Agent Retrieval & Contextual Navigation
**Story ID:** SKB-46.2
**Story Points:** 3 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-46.1 (Chemistry KB Index)

---

## User Story

As an AI agent, I want structured tags on experiment pages (substrate class, scale, challenge, functional groups), So that I can filter experiments by context and find the RIGHT experiments for a user's specific problem, not just any experiments of the same reaction type.

---

## Acceptance Criteria

1. **Tag Taxonomy Definition**
   - [ ] `substrate-class`: aryl, heteroaryl, vinyl, alkyl, allylic, benzylic, neopentyl
   - [ ] `scale`: small (<1mmol), medium (1-10mmol), large (>10mmol), pilot (>100mmol)
   - [ ] `challenge`: yield, selectivity, purification, scale-up, stability, reproducibility, side-reaction, protodeboronation
   - [ ] `functional-groups`: amino, hydroxyl, nitro, ester, halogen, cyano, carbonyl, carboxyl, sulfonate, phosphonate
   - [ ] All tags lowercase with hyphens (kebab-case)

2. **Tag Storage in Frontmatter**
   - [ ] Experiment pages have YAML frontmatter with tags:
     ```yaml
     tags:
       reaction: suzuki-coupling
       substrate-class: heteroaryl
       scale: medium
       challenge: protodeboronation
       functional-groups: [amino, nitro]
     ```
   - [ ] Tags are arrays for multi-value fields (functional-groups)
   - [ ] Tags are strings for single-value fields (substrate-class, scale, challenge)

3. **Tag Classification Logic**
   - [ ] **Substrate class:** Extract from reagent roles + chemical names
     - If reagent role = "substrate" or "electrophile", check chemical name for aryl/heteroaryl/vinyl/alkyl patterns
     - Patterns: "phenyl", "benzyl" → aryl; "pyridine", "pyrimidine" → heteroaryl; "vinyl" → vinyl; "alkyl", "methyl", "ethyl" → alkyl
   - [ ] **Scale:** Extract from reagent amounts
     - Sum total reagent amounts (mmol), assign bucket: <1 = small, 1-10 = medium, >10 = large, >100 = pilot
   - [ ] **Challenge:** Extract from practical notes keywords
     - Keywords: "low yield" → yield; "poor selectivity" → selectivity; "purification difficult" → purification; "scale-up issue" → scale-up; "unstable" → stability; "not reproducible" → reproducibility; "side reaction" → side-reaction; "protodeboronation" → protodeboronation
   - [ ] **Functional groups:** Extract from substrate structure description
     - Keywords in reagent names or structure field: "amino", "hydroxyl", "nitro", "ester", "chloro/bromo/iodo" → halogen, "cyano", "carbonyl", "carboxyl", "sulfonate", "phosphonate"

4. **Tag Rendering on Experiment Pages**
   - [ ] Tags rendered as clickable badges below experiment title
   - [ ] Badge styling: `bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium mr-1 mb-1` (Tailwind)
   - [ ] Color scheme:
     - `reaction`: blue-100/blue-800
     - `substrate-class`: green-100/green-800
     - `scale`: yellow-100/yellow-800
     - `challenge`: red-100/red-800
     - `functional-groups`: purple-100/purple-800
   - [ ] Tags displayed in order: reaction, substrate-class, scale, challenge, functional-groups

5. **Tag Population During Sync**
   - [ ] Tags extracted and added to frontmatter during `generate-experiment-page.ts`
   - [ ] Classification functions: `classifySubstrateClass()`, `classifyScale()`, `classifyChallenge()`, `classifyFunctionalGroups()`
   - [ ] Tags deterministic: same input → same tags (no randomness)
   - [ ] If classification fails, omit tag (don't add null/undefined)

6. **Tag Index**
   - [ ] Generate `/kb/chemistry/tags/index.md` with all tags and their definitions
   - [ ] For each tag category, list all possible values with descriptions
   - [ ] Show example experiments per tag value (top 3 by quality score)

7. **Validation**
   - [ ] Zod schema for tag validation: `tagSchema` validates all tag values against taxonomy
   - [ ] Tags must be from predefined taxonomy (no arbitrary tags)
   - [ ] Warn if unknown tag value detected during sync

---

## Technical Implementation Notes

### Tag Taxonomy File

**File: `scripts/sync-chemeln/tag-taxonomy.ts`**

```typescript
export const TAG_TAXONOMY = {
  'substrate-class': [
    'aryl',
    'heteroaryl',
    'vinyl',
    'alkyl',
    'allylic',
    'benzylic',
    'neopentyl',
  ],
  scale: ['small', 'medium', 'large', 'pilot'],
  challenge: [
    'yield',
    'selectivity',
    'purification',
    'scale-up',
    'stability',
    'reproducibility',
    'side-reaction',
    'protodeboronation',
  ],
  'functional-groups': [
    'amino',
    'hydroxyl',
    'nitro',
    'ester',
    'halogen',
    'cyano',
    'carbonyl',
    'carboxyl',
    'sulfonate',
    'phosphonate',
  ],
} as const;

export type SubstrateClass = (typeof TAG_TAXONOMY)['substrate-class'][number];
export type Scale = (typeof TAG_TAXONOMY)['scale'][number];
export type Challenge = (typeof TAG_TAXONOMY)['challenge'][number];
export type FunctionalGroup = (typeof TAG_TAXONOMY)['functional-groups'][number];

export interface ExperimentTags {
  reaction: string;
  'substrate-class'?: SubstrateClass;
  scale?: Scale;
  challenge?: Challenge;
  'functional-groups'?: FunctionalGroup[];
}
```

---

### Tag Classification Functions

**File: `scripts/sync-chemeln/classify-tags.ts`**

```typescript
import { ExperimentData } from './types';
import { SubstrateClass, Scale, Challenge, FunctionalGroup } from './tag-taxonomy';

export function classifySubstrateClass(experiment: ExperimentData): SubstrateClass | undefined {
  const substrate = experiment.reagents.find((r) => r.role === 'substrate' || r.role === 'electrophile');
  if (!substrate) return undefined;

  const name = substrate.chemical_name.toLowerCase();

  // Heteroaryl patterns
  if (
    name.includes('pyridine') ||
    name.includes('pyrimidine') ||
    name.includes('pyrazine') ||
    name.includes('thiophene') ||
    name.includes('furan')
  ) {
    return 'heteroaryl';
  }

  // Aryl patterns
  if (
    name.includes('phenyl') ||
    name.includes('benzyl') ||
    name.includes('naphthalene') ||
    name.includes('bromobenzene') ||
    name.includes('iodobenzene')
  ) {
    return 'aryl';
  }

  // Vinyl patterns
  if (name.includes('vinyl') || name.includes('acryl')) {
    return 'vinyl';
  }

  // Allylic patterns
  if (name.includes('allyl')) {
    return 'allylic';
  }

  // Benzylic patterns
  if (name.includes('benzyl')) {
    return 'benzylic';
  }

  // Alkyl fallback
  if (
    name.includes('alkyl') ||
    name.includes('methyl') ||
    name.includes('ethyl') ||
    name.includes('propyl') ||
    name.includes('butyl')
  ) {
    return 'alkyl';
  }

  return undefined;
}

export function classifyScale(experiment: ExperimentData): Scale | undefined {
  // Sum total amounts (convert to mmol)
  const totalMmol = experiment.reagents.reduce((sum, r) => {
    if (r.amount_unit === 'mmol') return sum + r.amount;
    if (r.amount_unit === 'mol') return sum + r.amount * 1000;
    return sum; // Skip if unit unknown
  }, 0);

  if (totalMmol === 0) return undefined;
  if (totalMmol < 1) return 'small';
  if (totalMmol <= 10) return 'medium';
  if (totalMmol <= 100) return 'large';
  return 'pilot';
}

export function classifyChallenge(experiment: ExperimentData): Challenge | undefined {
  const notes = experiment.practical_notes?.toLowerCase() || '';

  if (notes.includes('low yield') || notes.includes('poor yield')) return 'yield';
  if (notes.includes('poor selectivity') || notes.includes('byproduct')) return 'selectivity';
  if (notes.includes('purification difficult') || notes.includes('hard to purify'))
    return 'purification';
  if (notes.includes('scale-up') || notes.includes('scaling issue')) return 'scale-up';
  if (notes.includes('unstable') || notes.includes('decomposition')) return 'stability';
  if (notes.includes('not reproducible') || notes.includes('variable results'))
    return 'reproducibility';
  if (notes.includes('side reaction') || notes.includes('competing reaction')) return 'side-reaction';
  if (notes.includes('protodeboronation')) return 'protodeboronation';

  return undefined;
}

export function classifyFunctionalGroups(experiment: ExperimentData): FunctionalGroup[] {
  const groups = new Set<FunctionalGroup>();
  const substrate = experiment.reagents.find((r) => r.role === 'substrate' || r.role === 'electrophile');
  if (!substrate) return [];

  const name = substrate.chemical_name.toLowerCase();

  if (name.includes('amino') || name.includes('aniline')) groups.add('amino');
  if (name.includes('hydroxyl') || name.includes('phenol')) groups.add('hydroxyl');
  if (name.includes('nitro')) groups.add('nitro');
  if (name.includes('ester') || name.includes('acetate')) groups.add('ester');
  if (name.includes('chloro') || name.includes('bromo') || name.includes('iodo')) groups.add('halogen');
  if (name.includes('cyano') || name.includes('nitrile')) groups.add('cyano');
  if (name.includes('carbonyl') || name.includes('ketone') || name.includes('aldehyde'))
    groups.add('carbonyl');
  if (name.includes('carboxyl') || name.includes('carboxylic')) groups.add('carboxyl');
  if (name.includes('sulfonate')) groups.add('sulfonate');
  if (name.includes('phosphonate')) groups.add('phosphonate');

  return Array.from(groups);
}

export function classifyExperimentTags(experiment: ExperimentData): ExperimentTags {
  return {
    reaction: experiment.reaction_type.toLowerCase().replace(/\s+/g, '-'),
    'substrate-class': classifySubstrateClass(experiment),
    scale: classifyScale(experiment),
    challenge: classifyChallenge(experiment),
    'functional-groups': classifyFunctionalGroups(experiment),
  };
}
```

---

### Tag Rendering Component

**File: `src/components/chemistry/ExperimentTags.tsx`**

```typescript
import React from 'react';
import { ExperimentTags } from '@/types/chemistry';

const TAG_COLORS = {
  reaction: 'bg-blue-100 text-blue-800',
  'substrate-class': 'bg-green-100 text-green-800',
  scale: 'bg-yellow-100 text-yellow-800',
  challenge: 'bg-red-100 text-red-800',
  'functional-groups': 'bg-purple-100 text-purple-800',
};

interface Props {
  tags: ExperimentTags;
}

export function ExperimentTagBadges({ tags }: Props) {
  return (
    <div className="flex flex-wrap gap-1 my-3">
      {tags.reaction && (
        <span className={`${TAG_COLORS.reaction} px-2 py-1 rounded-full text-xs font-medium`}>
          {tags.reaction}
        </span>
      )}
      {tags['substrate-class'] && (
        <span className={`${TAG_COLORS['substrate-class']} px-2 py-1 rounded-full text-xs font-medium`}>
          {tags['substrate-class']}
        </span>
      )}
      {tags.scale && (
        <span className={`${TAG_COLORS.scale} px-2 py-1 rounded-full text-xs font-medium`}>
          {tags.scale}
        </span>
      )}
      {tags.challenge && (
        <span className={`${TAG_COLORS.challenge} px-2 py-1 rounded-full text-xs font-medium`}>
          {tags.challenge}
        </span>
      )}
      {tags['functional-groups']?.map((fg) => (
        <span
          key={fg}
          className={`${TAG_COLORS['functional-groups']} px-2 py-1 rounded-full text-xs font-medium`}
        >
          {fg}
        </span>
      ))}
    </div>
  );
}
```

---

## Test Scenarios

### Unit Tests: `tests/sync-chemeln/classify-tags.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { classifySubstrateClass, classifyScale, classifyChallenge, classifyFunctionalGroups } from '@/scripts/sync-chemeln/classify-tags';

describe('classifySubstrateClass', () => {
  it('should classify heteroaryl substrates', () => {
    const experiment = {
      reagents: [{ role: 'substrate', chemical_name: '2-bromopyridine', amount: 5, amount_unit: 'mmol' }],
    };
    expect(classifySubstrateClass(experiment)).toBe('heteroaryl');
  });

  it('should classify aryl substrates', () => {
    const experiment = {
      reagents: [{ role: 'substrate', chemical_name: 'bromobenzene', amount: 5, amount_unit: 'mmol' }],
    };
    expect(classifySubstrateClass(experiment)).toBe('aryl');
  });
});

describe('classifyScale', () => {
  it('should classify small scale (<1mmol)', () => {
    const experiment = {
      reagents: [{ amount: 0.5, amount_unit: 'mmol' }],
    };
    expect(classifyScale(experiment)).toBe('small');
  });

  it('should classify medium scale (1-10mmol)', () => {
    const experiment = {
      reagents: [{ amount: 5, amount_unit: 'mmol' }],
    };
    expect(classifyScale(experiment)).toBe('medium');
  });
});

describe('classifyChallenge', () => {
  it('should detect yield challenge', () => {
    const experiment = {
      practical_notes: 'Low yield observed, possibly due to competing side reaction.',
    };
    expect(classifyChallenge(experiment)).toBe('yield');
  });

  it('should detect protodeboronation challenge', () => {
    const experiment = {
      practical_notes: 'Protodeboronation was a significant issue.',
    };
    expect(classifyChallenge(experiment)).toBe('protodeboronation');
  });
});
```

---

## Dependencies

- **SKB-46.1:** Chemistry KB Index (tag filtering requires index as starting point)

---

## Dev Notes

### Tag Classification Heuristics

- Substrate class: Pattern matching on chemical names (not perfect, but good enough for MVP)
- Scale: Sum of reagent amounts (assumes all amounts are for the same experiment batch)
- Challenge: Keyword matching in practical notes (expand keywords as patterns emerge)
- Functional groups: Pattern matching on substrate name (consider adding SMILES parsing in future)

### Future Enhancements

- Use ChemELN structure data (SMILES, InChI) for more accurate functional group detection
- Machine learning classifier for substrate class (train on labeled experiments)
- Allow manual tag overrides in experiment frontmatter

---

**Last Updated:** 2026-03-21
