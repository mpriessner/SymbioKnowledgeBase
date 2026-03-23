# Story SKB-45.3: Key Learnings Extraction & Ranking

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.3
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-45.2 (quality scores required for ranking)

---

## User Story

As a researcher planning an experiment, I want to see ranked "Key Learnings" aggregated from all experiments of a reaction type, So that I can learn from institutional experience and avoid common pitfalls.

---

## Acceptance Criteria

- [ ] Extract actionable learnings from each experiment's practical notes
- [ ] Identify learnings that are specific (mention substrates/conditions) vs. general tips
- [ ] Compute learning rank = `quality_score × recency_factor × specificity_score`
- [ ] Recency factor: last 6mo=1.0, 6-12mo=0.8, 1-2yr=0.6, older=0.4
- [ ] Specificity score: specific tip (mentions substrate/condition)=1.0, general=0.7
- [ ] Aggregate top learnings on reaction type pages (max 10 per page)
- [ ] Each learning attributed with: researcher wikilink + experiment wikilink + date
- [ ] Star rating (⭐) for top 3 highest-scoring learnings per reaction type
- [ ] Section titled "Key Learnings" with clear formatting
- [ ] Handle pages with no learnings gracefully (display message)
- [ ] Learnings deduplicated (similar learnings merged)
- [ ] TypeScript strict mode — no `any` types
- [ ] All functions have JSDoc comments

---

## Architecture Overview

```
Key Learnings Extraction & Ranking
───────────────────────────────────

┌─────────────────────────────────────────────────┐
│  Experiment Pages (all experiments for          │
│  reaction type "Suzuki Coupling")                │
│                                                   │
│  EXP-2024-156: quality_score=4.5, date=2026-03   │
│    Practical notes tips:                          │
│    - "Use 10% excess substrate for heteroaryl..." │
│    - "Monitor color change at 50°C"               │
│                                                   │
│  EXP-2024-089: quality_score=4.0, date=2026-01   │
│    Practical notes tips:                          │
│    - "TLC monitoring at 2h recommended"           │
│                                                   │
│  EXP-2023-234: quality_score=3.0, date=2023-11   │
│    Practical notes tips:                          │
│    - "Use 10% excess substrate" (duplicate!)      │
└─────────────────────────────────────────────────┘
                      │
                      │ Aggregation
                      ▼
┌─────────────────────────────────────────────────┐
│  src/lib/chemeln/enrichment/                     │
│  key-learnings.ts                                 │
│                                                   │
│  extractLearnings(practicalNotes)                 │
│    └─ Parse tips from practical notes            │
│                                                   │
│  computeLearningScore(learning, quality, date)    │
│    ├─ recencyFactor(date)                        │
│    ├─ specificityScore(learning)                 │
│    └─ quality × recency × specificity            │
│                                                   │
│  deduplicateLearnings(learnings)                  │
│    └─ Merge similar learnings (fuzzy match)      │
│                                                   │
│  aggregateKeyLearnings(experiments)               │
│    ├─ Extract from all experiments               │
│    ├─ Score and rank                             │
│    ├─ Deduplicate                                │
│    └─ Return top 10                              │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  Reaction Type Page: "Suzuki Coupling"           │
│                                                   │
│  ## Key Learnings                                │
│                                                   │
│  ⭐⭐⭐ **Use 10% excess substrate for           │
│  heteroaryl couplings with electron-poor         │
│  partners**                                       │
│  — [[Dr. Anna Mueller]] • [[EXP-2024-156]] •     │
│     Mar 2026 • Quality: 4.5/5                    │
│                                                   │
│  ⭐⭐ **Monitor solution color change at 50°C    │
│  as indicator of reaction initiation**            │
│  — [[Dr. Anna Mueller]] • [[EXP-2024-156]] •     │
│     Mar 2026 • Quality: 4.5/5                    │
│                                                   │
│  ⭐ **TLC monitoring recommended at 2h mark**    │
│  — [[Dr. James Chen]] • [[EXP-2024-089]] •       │
│     Jan 2026 • Quality: 4.0/5                    │
└─────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Learning Types

**File: `src/lib/chemeln/enrichment/types.ts`** (modify)

```typescript
/**
 * A single learning extracted from an experiment.
 */
export interface Learning {
  text: string; // The learning text
  experimentId: string; // ChemELN experiment ID
  experimentTitle: string; // e.g., "EXP-2024-156"
  researcherName: string; // e.g., "Dr. Anna Mueller"
  date: Date; // Experiment date
  qualityScore: number; // 1.0-5.0
}

/**
 * A ranked learning with computed score.
 */
export interface RankedLearning extends Learning {
  rank: number; // Computed rank score
  recencyFactor: number; // 0.4-1.0
  specificityScore: number; // 0.7 or 1.0
  stars: number; // 1-3 stars for display
}
```

---

### Step 2: Implement Learning Extraction

**File: `src/lib/chemeln/enrichment/key-learnings.ts`** (create)

```typescript
import type { Learning, RankedLearning, PracticalNotes } from './types';

/**
 * Compute recency factor based on experiment date.
 *
 * - Last 6 months: 1.0
 * - 6-12 months: 0.8
 * - 1-2 years: 0.6
 * - Older than 2 years: 0.4
 *
 * @param date - Experiment date
 * @returns Recency factor (0.4-1.0)
 */
export function computeRecencyFactor(date: Date): number {
  const now = new Date();
  const ageMonths = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (ageMonths <= 6) return 1.0;
  if (ageMonths <= 12) return 0.8;
  if (ageMonths <= 24) return 0.6;
  return 0.4;
}

/**
 * Compute specificity score for a learning.
 *
 * Specific learnings mention:
 * - Substrate names or classes (heteroaryl, alkyl, aryl)
 * - Specific conditions (temperature, solvent, catalyst)
 * - Specific observations (color, TLC, NMR)
 *
 * General learnings are vague tips ("stir well", "monitor carefully")
 *
 * @param learningText - The learning text
 * @returns Specificity score (0.7=general, 1.0=specific)
 */
export function computeSpecificityScore(learningText: string): number {
  const lower = learningText.toLowerCase();

  // Keywords indicating specific learning
  const specificKeywords = [
    // Substrate classes
    'heteroaryl',
    'aryl',
    'alkyl',
    'vinyl',
    'electron-poor',
    'electron-rich',
    // Conditions
    '°c',
    'celsius',
    'solvent',
    'catalyst',
    'base',
    'ligand',
    'excess',
    '%',
    // Observations
    'color',
    'tlc',
    'nmr',
    'hplc',
    'purity',
    'yield',
    'time',
    'hour',
    'minute',
  ];

  const hasSpecificKeyword = specificKeywords.some((keyword) => lower.includes(keyword));

  return hasSpecificKeyword ? 1.0 : 0.7;
}

/**
 * Extract learnings from practical notes.
 *
 * @param practicalNotes - Parsed practical notes
 * @param experiment - Experiment metadata
 * @returns Array of learnings
 */
export function extractLearnings(
  practicalNotes: PracticalNotes,
  experiment: {
    id: string;
    title: string;
    researcherName: string;
    date: Date;
    qualityScore: number;
  }
): Learning[] {
  if (!practicalNotes.hasData) {
    return [];
  }

  const learnings: Learning[] = [];

  // Extract from tips array
  for (const tip of practicalNotes.tips) {
    learnings.push({
      text: tip,
      experimentId: experiment.id,
      experimentTitle: experiment.title,
      researcherName: experiment.researcherName,
      date: experiment.date,
      qualityScore: experiment.qualityScore,
    });
  }

  // Extract from overall notes (if substantial)
  if (practicalNotes.overallNotes && practicalNotes.overallNotes.length > 20) {
    learnings.push({
      text: practicalNotes.overallNotes,
      experimentId: experiment.id,
      experimentTitle: experiment.title,
      researcherName: experiment.researcherName,
      date: experiment.date,
      qualityScore: experiment.qualityScore,
    });
  }

  return learnings;
}

/**
 * Compute rank score for a learning.
 *
 * Rank = quality_score × recency_factor × specificity_score
 *
 * @param learning - Learning to rank
 * @returns Rank score
 */
export function computeLearningRank(learning: Learning): number {
  const recencyFactor = computeRecencyFactor(learning.date);
  const specificityScore = computeSpecificityScore(learning.text);

  return learning.qualityScore * recencyFactor * specificityScore;
}

/**
 * Check if two learnings are similar (for deduplication).
 *
 * Simple fuzzy matching: same if >70% words overlap.
 *
 * @param a - First learning
 * @param b - Second learning
 * @returns True if similar, false otherwise
 */
function areSimilarLearnings(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  const similarity = intersection.size / union.size;

  return similarity > 0.7;
}

/**
 * Deduplicate learnings by merging similar ones.
 *
 * Keeps the highest-ranked learning from each duplicate group.
 *
 * @param rankedLearnings - Learnings to deduplicate (sorted by rank)
 * @returns Deduplicated learnings
 */
export function deduplicateLearnings(rankedLearnings: RankedLearning[]): RankedLearning[] {
  const deduplicated: RankedLearning[] = [];
  const seen = new Set<string>();

  for (const learning of rankedLearnings) {
    let isDuplicate = false;

    for (const seenText of seen) {
      if (areSimilarLearnings(learning.text, seenText)) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(learning);
      seen.add(learning.text);
    }
  }

  return deduplicated;
}

/**
 * Assign star ratings to top learnings.
 *
 * Top 3 get stars: 1st=3 stars, 2nd=2 stars, 3rd=1 star.
 *
 * @param learnings - Ranked learnings
 * @returns Learnings with star ratings
 */
function assignStarRatings(learnings: RankedLearning[]): RankedLearning[] {
  return learnings.map((learning, index) => ({
    ...learning,
    stars: index === 0 ? 3 : index === 1 ? 2 : index === 2 ? 1 : 0,
  }));
}

/**
 * Aggregate key learnings from multiple experiments.
 *
 * Process:
 * 1. Extract learnings from all experiments
 * 2. Compute rank for each learning
 * 3. Sort by rank (descending)
 * 4. Deduplicate similar learnings
 * 5. Take top 10
 * 6. Assign star ratings (top 3)
 *
 * @param experiments - Experiments with practical notes
 * @returns Top 10 ranked learnings
 */
export function aggregateKeyLearnings(
  experiments: Array<{
    id: string;
    title: string;
    researcherName: string;
    date: Date;
    qualityScore: number;
    practicalNotes: PracticalNotes;
  }>
): RankedLearning[] {
  // Step 1: Extract all learnings
  const allLearnings: Learning[] = [];
  for (const exp of experiments) {
    const learnings = extractLearnings(exp.practicalNotes, {
      id: exp.id,
      title: exp.title,
      researcherName: exp.researcherName,
      date: exp.date,
      qualityScore: exp.qualityScore,
    });
    allLearnings.push(...learnings);
  }

  // Step 2: Compute rank and enrich
  const rankedLearnings: RankedLearning[] = allLearnings.map((learning) => ({
    ...learning,
    rank: computeLearningRank(learning),
    recencyFactor: computeRecencyFactor(learning.date),
    specificityScore: computeSpecificityScore(learning.text),
    stars: 0,
  }));

  // Step 3: Sort by rank
  rankedLearnings.sort((a, b) => b.rank - a.rank);

  // Step 4: Deduplicate
  const deduplicated = deduplicateLearnings(rankedLearnings);

  // Step 5: Take top 10
  const top10 = deduplicated.slice(0, 10);

  // Step 6: Assign star ratings
  const withStars = assignStarRatings(top10);

  return withStars;
}

/**
 * Format key learnings section for markdown.
 *
 * @param learnings - Ranked learnings
 * @returns Markdown section
 */
export function formatKeyLearnings(learnings: RankedLearning[]): string {
  if (learnings.length === 0) {
    return '## Key Learnings\n\n*No key learnings available yet. Be the first to contribute!*\n';
  }

  const lines = ['## Key Learnings\n'];

  for (const learning of learnings) {
    // Star rating
    const stars = learning.stars > 0 ? '⭐'.repeat(learning.stars) + ' ' : '';

    // Learning text
    lines.push(`${stars}**${learning.text}**`);

    // Attribution
    const dateStr = learning.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
    lines.push(
      `— [[${learning.researcherName}]] • [[${learning.experimentTitle}]] • ${dateStr} • Quality: ${learning.qualityScore.toFixed(1)}/5\n`
    );
  }

  return lines.join('\n');
}
```

---

### Step 3: Integration with Reaction Type Sync

**File: `src/lib/chemeln/sync/reaction-type-sync.ts`** (modify)

```typescript
import { aggregateKeyLearnings, formatKeyLearnings } from '../enrichment/key-learnings';
import { parseActualProcedure } from '../enrichment/practical-notes';

async function generateReactionTypePageContent(
  reactionType: string,
  experiments: ChemELNExperiment[],
  tenantId: string
): Promise<string> {
  const sections: string[] = [];

  // ... existing sections (overview, statistics, etc.)

  // Prepare experiment data for aggregation
  const experimentsWithNotes = experiments.map((exp) => ({
    id: exp.id,
    title: `EXP-${exp.id}`,
    researcherName: exp.researcher_name || 'Unknown Researcher',
    date: new Date(exp.created_at),
    qualityScore: exp.quality_score || 3.0,
    practicalNotes: parseActualProcedure(exp.actual_procedure),
  }));

  // Generate key learnings section
  const keyLearnings = aggregateKeyLearnings(experimentsWithNotes);
  const learningsSection = formatKeyLearnings(keyLearnings);
  sections.push(learningsSection);

  // ... remaining sections

  return sections.join('\n\n');
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/enrichment/key-learnings.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeRecencyFactor,
  computeSpecificityScore,
  extractLearnings,
  computeLearningRank,
  deduplicateLearnings,
  aggregateKeyLearnings,
  formatKeyLearnings,
} from '@/lib/chemeln/enrichment/key-learnings';

describe('computeRecencyFactor', () => {
  it('should compute recency for recent experiments', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 3); // 3 months ago
    expect(computeRecencyFactor(recent)).toBe(1.0);
  });

  it('should compute recency for 6-12 month old experiments', () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 9); // 9 months ago
    expect(computeRecencyFactor(old)).toBe(0.8);
  });

  it('should compute recency for 1-2 year old experiments', () => {
    const older = new Date();
    older.setFullYear(older.getFullYear() - 1.5); // 1.5 years ago
    expect(computeRecencyFactor(older)).toBe(0.6);
  });

  it('should compute recency for very old experiments', () => {
    const veryOld = new Date();
    veryOld.setFullYear(veryOld.getFullYear() - 3); // 3 years ago
    expect(computeRecencyFactor(veryOld)).toBe(0.4);
  });
});

describe('computeSpecificityScore', () => {
  it('should score specific learnings as 1.0', () => {
    expect(computeSpecificityScore('Use 10% excess substrate for heteroaryl couplings')).toBe(1.0);
    expect(computeSpecificityScore('Monitor TLC at 2h mark')).toBe(1.0);
    expect(computeSpecificityScore('Heat to 80°C for electron-poor substrates')).toBe(1.0);
  });

  it('should score general learnings as 0.7', () => {
    expect(computeSpecificityScore('Stir well')).toBe(0.7);
    expect(computeSpecificityScore('Monitor carefully')).toBe(0.7);
    expect(computeSpecificityScore('Use excess reagent')).toBe(0.7);
  });
});

describe('extractLearnings', () => {
  it('should extract learnings from tips', () => {
    const practicalNotes = {
      hasData: true,
      deviations: [],
      tips: ['Tip 1', 'Tip 2'],
      overallNotes: undefined,
    };

    const experiment = {
      id: 'EXP-123',
      title: 'EXP-2024-123',
      researcherName: 'Dr. Test',
      date: new Date('2024-03-15'),
      qualityScore: 4.5,
    };

    const learnings = extractLearnings(practicalNotes as any, experiment);
    expect(learnings).toHaveLength(2);
    expect(learnings[0].text).toBe('Tip 1');
  });

  it('should extract learnings from overall notes', () => {
    const practicalNotes = {
      hasData: true,
      deviations: [],
      tips: [],
      overallNotes: 'This is a substantial overall note with many details',
    };

    const experiment = {
      id: 'EXP-123',
      title: 'EXP-2024-123',
      researcherName: 'Dr. Test',
      date: new Date('2024-03-15'),
      qualityScore: 4.5,
    };

    const learnings = extractLearnings(practicalNotes as any, experiment);
    expect(learnings).toHaveLength(1);
    expect(learnings[0].text).toContain('substantial');
  });
});

describe('deduplicateLearnings', () => {
  it('should remove similar learnings', () => {
    const learnings = [
      {
        text: 'Use 10% excess substrate for heteroaryl couplings',
        rank: 5.0,
        stars: 0,
      },
      {
        text: 'Use 10% excess substrate for heteroaryl reactions',
        rank: 4.0,
        stars: 0,
      },
      {
        text: 'Monitor TLC carefully',
        rank: 3.0,
        stars: 0,
      },
    ];

    const deduplicated = deduplicateLearnings(learnings as any);
    expect(deduplicated).toHaveLength(2); // First two are similar
  });
});

describe('formatKeyLearnings', () => {
  it('should format learnings with stars', () => {
    const learnings = [
      {
        text: 'Top learning',
        experimentTitle: 'EXP-2024-123',
        researcherName: 'Dr. Test',
        date: new Date('2024-03-15'),
        qualityScore: 4.5,
        rank: 5.0,
        recencyFactor: 1.0,
        specificityScore: 1.0,
        stars: 3,
      },
      {
        text: 'Second learning',
        experimentTitle: 'EXP-2024-124',
        researcherName: 'Dr. Test',
        date: new Date('2024-03-15'),
        qualityScore: 4.0,
        rank: 4.0,
        recencyFactor: 1.0,
        specificityScore: 1.0,
        stars: 2,
      },
    ];

    const markdown = formatKeyLearnings(learnings as any);
    expect(markdown).toContain('⭐⭐⭐');
    expect(markdown).toContain('⭐⭐');
    expect(markdown).toContain('[[Dr. Test]]');
    expect(markdown).toContain('[[EXP-2024-123]]');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/lib/chemeln/enrichment/types.ts` (add Learning, RankedLearning types) |
| CREATE | `src/lib/chemeln/enrichment/key-learnings.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/key-learnings.test.ts` |
| MODIFY | `src/lib/chemeln/sync/reaction-type-sync.ts` (add Key Learnings section) |

---

## Dev Notes

### Ranking Algorithm Rationale

The formula `quality × recency × specificity` balances three factors:

- **Quality** (1-5): High-quality experiments are more trustworthy
- **Recency** (0.4-1.0): Recent experiments reflect current best practices
- **Specificity** (0.7-1.0): Specific tips are more actionable

Example ranks:
- Excellent recent specific tip: `5.0 × 1.0 × 1.0 = 5.0`
- Good old general tip: `4.0 × 0.4 × 0.7 = 1.12`
- Poor recent specific tip: `2.0 × 1.0 × 1.0 = 2.0`

### Deduplication Challenge

Simple word overlap may miss semantic similarity. Future improvement: use embeddings for similarity matching.

### Star Rating Philosophy

Stars highlight the VERY BEST learnings. Not every learning gets stars — only top 3 per reaction type.

---

**Last Updated:** 2026-03-21
