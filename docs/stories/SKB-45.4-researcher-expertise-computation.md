# Story SKB-45.4: Researcher Expertise Computation

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.4
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-45.2 (quality scores needed for contribution ranking)

---

## User Story

As a researcher or agent, I want to see computed expertise profiles for each researcher (primary reaction types, average yields, key contributions), So that I can identify who has deep experience in specific areas.

---

## Acceptance Criteria

- [ ] Count experiments per reaction type per researcher
- [ ] Identify primary expertise areas (top 3 reaction types by experiment count)
- [ ] Compute average yield per reaction type per researcher
- [ ] Identify key contributions (practical tips from high-quality experiments, score >= 4.0)
- [ ] Rank researchers by experience for each reaction type (count + avg yield)
- [ ] Generate "Expertise Profile" section on researcher profile pages
- [ ] Include: primary areas list, average yields table, key contributions with wikilinks
- [ ] Handle researchers with no experiments gracefully
- [ ] TypeScript strict mode — no `any` types
- [ ] All functions have JSDoc comments

---

## Architecture Overview

```
Researcher Expertise Computation
─────────────────────────────────

┌──────────────────────────────────────────────────┐
│  All Experiments by Dr. Anna Mueller              │
│                                                    │
│  Suzuki Coupling: 12 experiments                  │
│    - Yields: [86, 92, 78, 88, ...]               │
│    - Avg: 86%                                     │
│    - High-quality (>=4.0): 8 experiments          │
│                                                    │
│  Buchwald-Hartwig: 8 experiments                  │
│    - Yields: [84, 90, 82, ...]                   │
│    - Avg: 84%                                     │
│    - High-quality: 5 experiments                  │
│                                                    │
│  Negishi Coupling: 5 experiments                  │
│    - Yields: [88, 92, 85, ...]                   │
│    - Avg: 88%                                     │
│    - High-quality: 4 experiments                  │
└──────────────────────────────────────────────────┘
                      │
                      │ Aggregation
                      ▼
┌──────────────────────────────────────────────────┐
│  src/lib/chemeln/enrichment/                      │
│  researcher-expertise.ts                           │
│                                                    │
│  computeExpertiseProfile(researcher, experiments)  │
│    ├─ countByReactionType()                       │
│    ├─ computeAvgYields()                          │
│    ├─ identifyKeyContributions()                  │
│    └─ rankPrimaryAreas()                          │
│                                                    │
│  formatExpertiseProfile(profile)                   │
│    └─ Generate markdown section                   │
└──────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Researcher Profile Page: Dr. Anna Mueller        │
│                                                    │
│  ## Expertise Profile                             │
│                                                    │
│  ### Primary Areas                                │
│  1. **Suzuki Coupling** — 12 experiments,         │
│     avg 86% yield                                 │
│  2. **Buchwald-Hartwig** — 8 experiments,         │
│     avg 84% yield                                 │
│  3. **Negishi Coupling** — 5 experiments,         │
│     avg 88% yield                                 │
│                                                    │
│  ### Key Contributions                            │
│  - Optimized heteroaryl Suzuki protocol (4.5/5)   │
│    [[EXP-2024-156]] • Mar 2026                    │
│  - Developed low-temp Buchwald method (4.0/5)     │
│    [[EXP-2024-089]] • Jan 2026                    │
└──────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Expertise Types

**File: `src/lib/chemeln/enrichment/types.ts`** (modify)

```typescript
/**
 * Expertise in a single reaction type.
 */
export interface ReactionTypeExpertise {
  reactionType: string;
  experimentCount: number;
  avgYield: number | null; // null if no yield data
  highQualityCount: number; // Experiments with quality_score >= 4.0
}

/**
 * A key contribution from a researcher.
 */
export interface KeyContribution {
  title: string; // Short description
  experimentId: string;
  experimentTitle: string;
  date: Date;
  qualityScore: number;
}

/**
 * Complete expertise profile for a researcher.
 */
export interface ExpertiseProfile {
  researcherId: string;
  researcherName: string;
  totalExperiments: number;
  primaryAreas: ReactionTypeExpertise[]; // Top 3 by count
  allAreas: ReactionTypeExpertise[]; // All reaction types
  keyContributions: KeyContribution[]; // Top contributions
}
```

---

### Step 2: Implement Expertise Computation

**File: `src/lib/chemeln/enrichment/researcher-expertise.ts`** (create)

```typescript
import type {
  ExpertiseProfile,
  ReactionTypeExpertise,
  KeyContribution,
} from './types';

interface ExperimentData {
  id: string;
  title: string;
  reactionType: string;
  yieldPercent: number | null;
  qualityScore: number;
  date: Date;
  practicalNotes?: string; // For extracting contribution title
}

/**
 * Count experiments and compute stats per reaction type.
 *
 * @param experiments - All experiments by the researcher
 * @returns Expertise per reaction type
 */
function computeReactionTypeExpertise(
  experiments: ExperimentData[]
): ReactionTypeExpertise[] {
  const byType = new Map<string, ExperimentData[]>();

  // Group by reaction type
  for (const exp of experiments) {
    if (!byType.has(exp.reactionType)) {
      byType.set(exp.reactionType, []);
    }
    byType.get(exp.reactionType)!.push(exp);
  }

  // Compute stats for each type
  const expertise: ReactionTypeExpertise[] = [];
  for (const [reactionType, exps] of byType) {
    const yieldsWithData = exps
      .filter((e) => e.yieldPercent !== null)
      .map((e) => e.yieldPercent!);

    const avgYield =
      yieldsWithData.length > 0
        ? yieldsWithData.reduce((sum, y) => sum + y, 0) / yieldsWithData.length
        : null;

    const highQualityCount = exps.filter((e) => e.qualityScore >= 4.0).length;

    expertise.push({
      reactionType,
      experimentCount: exps.length,
      avgYield,
      highQualityCount,
    });
  }

  // Sort by experiment count (descending)
  expertise.sort((a, b) => b.experimentCount - a.experimentCount);

  return expertise;
}

/**
 * Identify key contributions from high-quality experiments.
 *
 * Contributions are experiments with quality_score >= 4.0 and practical notes.
 * Title extracted from practical notes' overall_notes or first tip.
 *
 * @param experiments - All experiments by the researcher
 * @returns Top 5 key contributions
 */
function identifyKeyContributions(
  experiments: ExperimentData[]
): KeyContribution[] {
  const highQuality = experiments
    .filter((exp) => exp.qualityScore >= 4.0 && exp.practicalNotes)
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const contributions: KeyContribution[] = [];

  for (const exp of highQuality.slice(0, 5)) {
    // Extract title from practical notes (simplified)
    let title = `${exp.reactionType} optimization`;
    if (exp.practicalNotes && exp.practicalNotes.length > 0) {
      // Use first sentence or first 50 chars
      const firstSentence = exp.practicalNotes.split('.')[0];
      if (firstSentence.length > 10 && firstSentence.length < 80) {
        title = firstSentence;
      }
    }

    contributions.push({
      title,
      experimentId: exp.id,
      experimentTitle: exp.title,
      date: exp.date,
      qualityScore: exp.qualityScore,
    });
  }

  return contributions;
}

/**
 * Compute complete expertise profile for a researcher.
 *
 * @param researcherId - Researcher ID
 * @param researcherName - Researcher name
 * @param experiments - All experiments by the researcher
 * @returns Expertise profile
 */
export function computeExpertiseProfile(
  researcherId: string,
  researcherName: string,
  experiments: ExperimentData[]
): ExpertiseProfile {
  const allAreas = computeReactionTypeExpertise(experiments);
  const primaryAreas = allAreas.slice(0, 3); // Top 3
  const keyContributions = identifyKeyContributions(experiments);

  return {
    researcherId,
    researcherName,
    totalExperiments: experiments.length,
    primaryAreas,
    allAreas,
    keyContributions,
  };
}

/**
 * Format expertise profile as markdown section.
 *
 * @param profile - Expertise profile
 * @returns Markdown section
 */
export function formatExpertiseProfile(profile: ExpertiseProfile): string {
  if (profile.totalExperiments === 0) {
    return '## Expertise Profile\n\n*No experiments recorded yet.*\n';
  }

  const lines = ['## Expertise Profile\n'];

  // Primary areas
  lines.push('### Primary Areas\n');
  for (let i = 0; i < profile.primaryAreas.length; i++) {
    const area = profile.primaryAreas[i];
    const yieldStr = area.avgYield !== null ? `, avg ${Math.round(area.avgYield)}% yield` : '';
    lines.push(
      `${i + 1}. **${area.reactionType}** — ${area.experimentCount} experiments${yieldStr}`
    );
  }
  lines.push(''); // Blank line

  // Key contributions
  if (profile.keyContributions.length > 0) {
    lines.push('### Key Contributions\n');
    for (const contrib of profile.keyContributions) {
      const dateStr = contrib.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      lines.push(
        `- ${contrib.title} (${contrib.qualityScore.toFixed(1)}/5) — [[${contrib.experimentTitle}]] • ${dateStr}`
      );
    }
    lines.push(''); // Blank line
  }

  return lines.join('\n');
}

/**
 * Rank researchers by expertise for a specific reaction type.
 *
 * Ranking criteria:
 * 1. Experiment count (primary)
 * 2. Average yield (secondary)
 * 3. High-quality experiment count (tertiary)
 *
 * @param reactionType - Reaction type to rank for
 * @param profiles - All researcher expertise profiles
 * @returns Ranked list of researchers
 */
export function rankResearchersByExpertise(
  reactionType: string,
  profiles: ExpertiseProfile[]
): Array<{
  researcherName: string;
  experimentCount: number;
  avgYield: number | null;
  highQualityCount: number;
}> {
  const withExpertise = profiles
    .map((profile) => {
      const area = profile.allAreas.find((a) => a.reactionType === reactionType);
      if (!area) return null;

      return {
        researcherName: profile.researcherName,
        experimentCount: area.experimentCount,
        avgYield: area.avgYield,
        highQualityCount: area.highQualityCount,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Sort by: count DESC, avgYield DESC, highQualityCount DESC
  withExpertise.sort((a, b) => {
    if (a.experimentCount !== b.experimentCount) {
      return b.experimentCount - a.experimentCount;
    }
    if (a.avgYield !== null && b.avgYield !== null) {
      return b.avgYield - a.avgYield;
    }
    return b.highQualityCount - a.highQualityCount;
  });

  return withExpertise;
}
```

---

### Step 3: Integration with Researcher Sync

**File: `src/lib/chemeln/sync/researcher-sync.ts`** (modify)

```typescript
import { computeExpertiseProfile, formatExpertiseProfile } from '../enrichment/researcher-expertise';

async function generateResearcherPageContent(
  researcher: ChemELNResearcher,
  tenantId: string
): Promise<string> {
  const sections: string[] = [];

  // ... existing sections (overview, contact, etc.)

  // Fetch all experiments by this researcher
  const experiments = await fetchExperimentsByResearcher(researcher.id, tenantId);

  // Compute expertise profile
  const expertiseProfile = computeExpertiseProfile(
    researcher.id,
    researcher.name,
    experiments.map((exp) => ({
      id: exp.id,
      title: `EXP-${exp.id}`,
      reactionType: exp.reaction_type,
      yieldPercent: exp.yield_percent,
      qualityScore: exp.quality_score || 3.0,
      date: new Date(exp.created_at),
      practicalNotes: exp.practical_notes_text, // From SKB-45.1
    }))
  );

  // Add expertise section
  const expertiseSection = formatExpertiseProfile(expertiseProfile);
  sections.push(expertiseSection);

  // ... remaining sections

  return sections.join('\n\n');
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/enrichment/researcher-expertise.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeExpertiseProfile,
  rankResearchersByExpertise,
  formatExpertiseProfile,
} from '@/lib/chemeln/enrichment/researcher-expertise';

describe('computeExpertiseProfile', () => {
  it('should compute profile with primary areas', () => {
    const experiments = [
      {
        id: 'exp-1',
        title: 'EXP-2024-001',
        reactionType: 'Suzuki Coupling',
        yieldPercent: 86,
        qualityScore: 4.5,
        date: new Date('2024-03-15'),
      },
      {
        id: 'exp-2',
        title: 'EXP-2024-002',
        reactionType: 'Suzuki Coupling',
        yieldPercent: 92,
        qualityScore: 5.0,
        date: new Date('2024-03-16'),
      },
      {
        id: 'exp-3',
        title: 'EXP-2024-003',
        reactionType: 'Buchwald-Hartwig',
        yieldPercent: 84,
        qualityScore: 4.0,
        date: new Date('2024-03-17'),
      },
    ];

    const profile = computeExpertiseProfile('r-1', 'Dr. Test', experiments as any);

    expect(profile.totalExperiments).toBe(3);
    expect(profile.primaryAreas).toHaveLength(2);
    expect(profile.primaryAreas[0].reactionType).toBe('Suzuki Coupling');
    expect(profile.primaryAreas[0].experimentCount).toBe(2);
    expect(profile.primaryAreas[0].avgYield).toBeCloseTo(89, 0);
  });

  it('should handle researchers with no experiments', () => {
    const profile = computeExpertiseProfile('r-1', 'Dr. Empty', []);
    expect(profile.totalExperiments).toBe(0);
    expect(profile.primaryAreas).toHaveLength(0);
  });

  it('should identify key contributions', () => {
    const experiments = [
      {
        id: 'exp-1',
        title: 'EXP-2024-001',
        reactionType: 'Suzuki Coupling',
        yieldPercent: 92,
        qualityScore: 4.5,
        date: new Date('2024-03-15'),
        practicalNotes: 'Optimized protocol for heteroaryl substrates',
      },
      {
        id: 'exp-2',
        title: 'EXP-2024-002',
        reactionType: 'Suzuki Coupling',
        yieldPercent: 70,
        qualityScore: 3.0,
        date: new Date('2024-03-16'),
      },
    ];

    const profile = computeExpertiseProfile('r-1', 'Dr. Test', experiments as any);

    expect(profile.keyContributions).toHaveLength(1);
    expect(profile.keyContributions[0].experimentId).toBe('exp-1');
    expect(profile.keyContributions[0].qualityScore).toBe(4.5);
  });
});

describe('rankResearchersByExpertise', () => {
  it('should rank researchers by experiment count', () => {
    const profiles = [
      {
        researcherId: 'r-1',
        researcherName: 'Dr. A',
        totalExperiments: 10,
        primaryAreas: [],
        allAreas: [
          {
            reactionType: 'Suzuki Coupling',
            experimentCount: 12,
            avgYield: 86,
            highQualityCount: 8,
          },
        ],
        keyContributions: [],
      },
      {
        researcherId: 'r-2',
        researcherName: 'Dr. B',
        totalExperiments: 5,
        primaryAreas: [],
        allAreas: [
          {
            reactionType: 'Suzuki Coupling',
            experimentCount: 5,
            avgYield: 90,
            highQualityCount: 3,
          },
        ],
        keyContributions: [],
      },
    ];

    const ranked = rankResearchersByExpertise('Suzuki Coupling', profiles as any);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].researcherName).toBe('Dr. A'); // More experiments
    expect(ranked[0].experimentCount).toBe(12);
  });
});

describe('formatExpertiseProfile', () => {
  it('should format complete profile', () => {
    const profile = {
      researcherId: 'r-1',
      researcherName: 'Dr. Test',
      totalExperiments: 3,
      primaryAreas: [
        {
          reactionType: 'Suzuki Coupling',
          experimentCount: 2,
          avgYield: 89,
          highQualityCount: 2,
        },
      ],
      allAreas: [],
      keyContributions: [
        {
          title: 'Optimized protocol',
          experimentId: 'exp-1',
          experimentTitle: 'EXP-2024-001',
          date: new Date('2024-03-15'),
          qualityScore: 4.5,
        },
      ],
    };

    const markdown = formatExpertiseProfile(profile as any);

    expect(markdown).toContain('## Expertise Profile');
    expect(markdown).toContain('### Primary Areas');
    expect(markdown).toContain('**Suzuki Coupling**');
    expect(markdown).toContain('2 experiments, avg 89% yield');
    expect(markdown).toContain('### Key Contributions');
    expect(markdown).toContain('Optimized protocol (4.5/5)');
  });

  it('should handle empty profile', () => {
    const profile = {
      researcherId: 'r-1',
      researcherName: 'Dr. Empty',
      totalExperiments: 0,
      primaryAreas: [],
      allAreas: [],
      keyContributions: [],
    };

    const markdown = formatExpertiseProfile(profile as any);
    expect(markdown).toContain('No experiments recorded yet');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/lib/chemeln/enrichment/types.ts` (add expertise types) |
| CREATE | `src/lib/chemeln/enrichment/researcher-expertise.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/researcher-expertise.test.ts` |
| MODIFY | `src/lib/chemeln/sync/researcher-sync.ts` (add expertise profile generation) |

---

## Dev Notes

### Expertise Ranking Philosophy

Expertise is NOT just experiment count. High-quality experiments count more. A researcher with 5 excellent experiments (avg 92% yield, quality 4.5) has more valuable expertise than one with 10 mediocre experiments (avg 70%, quality 3.0).

### Key Contributions Extraction

Extracting meaningful titles from practical notes is challenging. Current approach uses first sentence or defaults to "{reaction type} optimization". Future: use LLM to generate concise summaries.

### Integration with "Who To Ask"

Story 45.5 will use `rankResearchersByExpertise()` to generate "Who To Ask" sections on reaction type pages.

---

**Last Updated:** 2026-03-21
