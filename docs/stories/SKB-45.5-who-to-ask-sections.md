# Story SKB-45.5: "Who To Ask" Sections

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.5
**Story Points:** 2 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-45.4 (expertise profiles must be computed)

---

## User Story

As a researcher planning an experiment or an AI agent answering "who should I talk to" questions, I want to see ranked "Who To Ask" sections on reaction type and substrate class pages, So that I can quickly identify the experts with relevant experience.

---

## Acceptance Criteria

- [ ] Generate "Who To Ask" sections on reaction type pages
- [ ] Generate "Who To Ask" sections on substrate class pages
- [ ] List format: ranked by expertise (experiment count + avg yield)
- [ ] Each entry shows: researcher wikilink, experiment count, avg yield, most recent experiment date
- [ ] Max 5 researchers per "Who To Ask" section
- [ ] Format: `[[Dr. Anna Mueller]] — 6 experiments, avg 84% yield (most recent: Mar 2026)`
- [ ] Enable agent queries like: "Who's the expert on Suzuki couplings?"
- [ ] Handle pages with no researchers gracefully (display message)
- [ ] TypeScript strict mode — no `any` types
- [ ] All functions have JSDoc comments

---

## Architecture Overview

```
"Who To Ask" Section Generation
────────────────────────────────

┌────────────────────────────────────────────────┐
│  Reaction Type: Suzuki Coupling                 │
│                                                  │
│  Researcher expertise profiles:                  │
│  - Dr. Anna Mueller: 12 exp, avg 86%            │
│  - Dr. James Chen: 8 exp, avg 82%               │
│  - Dr. Sarah Lee: 5 exp, avg 88%                │
│  - Dr. Tom Brown: 3 exp, avg 75%                │
└────────────────────────────────────────────────┘
                    │
                    │ Ranking (45.4)
                    ▼
┌────────────────────────────────────────────────┐
│  src/lib/chemeln/enrichment/                    │
│  who-to-ask.ts                                   │
│                                                  │
│  generateWhoToAskSection(reactionType, profiles) │
│    ├─ rankResearchersByExpertise()             │
│    ├─ Fetch most recent experiment date        │
│    ├─ Format entries                            │
│    └─ Take top 5                                │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  Reaction Type Page                             │
│                                                  │
│  ## Who To Ask                                  │
│                                                  │
│  1. [[Dr. Anna Mueller]] — 12 experiments,      │
│     avg 86% yield (most recent: Mar 2026)       │
│  2. [[Dr. Sarah Lee]] — 5 experiments,          │
│     avg 88% yield (most recent: Feb 2026)       │
│  3. [[Dr. James Chen]] — 8 experiments,         │
│     avg 82% yield (most recent: Jan 2026)       │
└────────────────────────────────────────────────┘
                    │
                    │ Agent Query
                    ▼
┌────────────────────────────────────────────────┐
│  Agent: "Who should I ask about Suzuki          │
│          couplings with heteroaryl substrates?" │
│                                                  │
│  Response: "Talk to Dr. Anna Mueller. She has   │
│             12 experiments with avg 86% yield,  │
│             most recently in Mar 2026."         │
└────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Implement "Who To Ask" Generation

**File: `src/lib/chemeln/enrichment/who-to-ask.ts`** (create)

```typescript
import type { ExpertiseProfile } from './types';
import { rankResearchersByExpertise } from './researcher-expertise';

/**
 * Expert entry for "Who To Ask" section.
 */
export interface WhoToAskEntry {
  researcherName: string;
  experimentCount: number;
  avgYield: number | null;
  mostRecentDate: Date | null;
}

/**
 * Get most recent experiment date for a researcher in a reaction type.
 *
 * @param researcherId - Researcher ID
 * @param reactionType - Reaction type
 * @param experiments - All experiments
 * @returns Most recent date or null
 */
function getMostRecentExperimentDate(
  researcherId: string,
  reactionType: string,
  experiments: Array<{
    researcherId: string;
    reactionType: string;
    date: Date;
  }>
): Date | null {
  const relevantExperiments = experiments.filter(
    (exp) => exp.researcherId === researcherId && exp.reactionType === reactionType
  );

  if (relevantExperiments.length === 0) return null;

  const dates = relevantExperiments.map((exp) => exp.date);
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Generate "Who To Ask" section for a reaction type.
 *
 * Returns top 5 researchers ranked by expertise.
 *
 * @param reactionType - Reaction type
 * @param profiles - All researcher expertise profiles
 * @param experiments - All experiments (for recent dates)
 * @returns "Who To Ask" entries
 */
export function generateWhoToAsk(
  reactionType: string,
  profiles: ExpertiseProfile[],
  experiments: Array<{
    researcherId: string;
    reactionType: string;
    date: Date;
  }>
): WhoToAskEntry[] {
  // Rank researchers by expertise
  const ranked = rankResearchersByExpertise(reactionType, profiles);

  // Take top 5
  const top5 = ranked.slice(0, 5);

  // Enrich with most recent date
  const entries: WhoToAskEntry[] = top5.map((r) => {
    const researcherId = profiles.find((p) => p.researcherName === r.researcherName)?.researcherId;
    const mostRecentDate = researcherId
      ? getMostRecentExperimentDate(researcherId, reactionType, experiments)
      : null;

    return {
      researcherName: r.researcherName,
      experimentCount: r.experimentCount,
      avgYield: r.avgYield,
      mostRecentDate,
    };
  });

  return entries;
}

/**
 * Format "Who To Ask" section as markdown.
 *
 * @param reactionType - Reaction type name
 * @param entries - Expert entries
 * @returns Markdown section
 */
export function formatWhoToAsk(reactionType: string, entries: WhoToAskEntry[]): string {
  if (entries.length === 0) {
    return '## Who To Ask\n\n*No researchers with experience in this reaction type yet.*\n';
  }

  const lines = ['## Who To Ask\n'];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const yieldStr = entry.avgYield !== null ? `, avg ${Math.round(entry.avgYield)}% yield` : '';
    const dateStr = entry.mostRecentDate
      ? entry.mostRecentDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        })
      : 'date unknown';

    lines.push(
      `${i + 1}. [[${entry.researcherName}]] — ${entry.experimentCount} experiments${yieldStr} (most recent: ${dateStr})`
    );
  }

  lines.push(''); // Blank line

  return lines.join('\n');
}

/**
 * Generate "Who To Ask" for substrate class.
 *
 * Similar to reaction type, but filters by substrate class instead.
 *
 * @param substrateClass - Substrate class
 * @param profiles - All researcher expertise profiles
 * @param experiments - All experiments with substrate data
 * @returns "Who To Ask" entries
 */
export function generateWhoToAskForSubstrate(
  substrateClass: string,
  profiles: ExpertiseProfile[],
  experiments: Array<{
    researcherId: string;
    substrateClass: string;
    date: Date;
  }>
): WhoToAskEntry[] {
  // Count experiments per researcher for this substrate class
  const countsByResearcher = new Map<string, number>();
  const yieldsByResearcher = new Map<string, number[]>();

  for (const exp of experiments.filter((e) => e.substrateClass === substrateClass)) {
    countsByResearcher.set(
      exp.researcherId,
      (countsByResearcher.get(exp.researcherId) || 0) + 1
    );

    // Note: Would need yield data in experiment object
    // Simplified here — assumes yield is available
  }

  // Build entries
  const entries: WhoToAskEntry[] = [];
  for (const profile of profiles) {
    const count = countsByResearcher.get(profile.researcherId) || 0;
    if (count === 0) continue;

    const recentExperiments = experiments.filter(
      (exp) => exp.researcherId === profile.researcherId && exp.substrateClass === substrateClass
    );
    const mostRecentDate =
      recentExperiments.length > 0
        ? new Date(Math.max(...recentExperiments.map((e) => e.date.getTime())))
        : null;

    entries.push({
      researcherName: profile.researcherName,
      experimentCount: count,
      avgYield: null, // Would need to compute from experiment yields
      mostRecentDate,
    });
  }

  // Sort by count
  entries.sort((a, b) => b.experimentCount - a.experimentCount);

  return entries.slice(0, 5);
}
```

---

### Step 2: Integration with Reaction Type Sync

**File: `src/lib/chemeln/sync/reaction-type-sync.ts`** (modify)

```typescript
import { generateWhoToAsk, formatWhoToAsk } from '../enrichment/who-to-ask';

async function generateReactionTypePageContent(
  reactionType: string,
  experiments: ChemELNExperiment[],
  tenantId: string
): Promise<string> {
  const sections: string[] = [];

  // ... existing sections (Key Learnings, etc.)

  // Compute expertise profiles for all researchers
  const researcherIds = [...new Set(experiments.map((exp) => exp.researcher_id))];
  const profiles = await Promise.all(
    researcherIds.map(async (researcherId) => {
      const researcher = await fetchResearcher(researcherId, tenantId);
      const researcherExperiments = await fetchExperimentsByResearcher(researcherId, tenantId);
      return computeExpertiseProfile(researcherId, researcher.name, researcherExperiments);
    })
  );

  // Generate "Who To Ask" section
  const whoToAskEntries = generateWhoToAsk(
    reactionType,
    profiles,
    experiments.map((exp) => ({
      researcherId: exp.researcher_id,
      reactionType: exp.reaction_type,
      date: new Date(exp.created_at),
    }))
  );
  const whoToAskSection = formatWhoToAsk(reactionType, whoToAskEntries);
  sections.push(whoToAskSection);

  // ... remaining sections

  return sections.join('\n\n');
}
```

---

### Step 3: Integration with Substrate Class Sync

**File: `src/lib/chemeln/sync/substrate-class-sync.ts`** (modify)

```typescript
import { generateWhoToAskForSubstrate, formatWhoToAsk } from '../enrichment/who-to-ask';

async function generateSubstrateClassPageContent(
  substrateClass: string,
  experiments: ChemELNExperiment[],
  tenantId: string
): Promise<string> {
  const sections: string[] = [];

  // ... existing sections

  // Compute profiles (same as reaction type)
  const researcherIds = [...new Set(experiments.map((exp) => exp.researcher_id))];
  const profiles = await Promise.all(
    researcherIds.map(async (researcherId) => {
      const researcher = await fetchResearcher(researcherId, tenantId);
      const researcherExperiments = await fetchExperimentsByResearcher(researcherId, tenantId);
      return computeExpertiseProfile(researcherId, researcher.name, researcherExperiments);
    })
  );

  // Generate "Who To Ask" for substrate class
  const whoToAskEntries = generateWhoToAskForSubstrate(
    substrateClass,
    profiles,
    experiments.map((exp) => ({
      researcherId: exp.researcher_id,
      substrateClass: exp.substrate_class, // Assumes this field exists
      date: new Date(exp.created_at),
    }))
  );
  const whoToAskSection = formatWhoToAsk(substrateClass, whoToAskEntries);
  sections.push(whoToAskSection);

  return sections.join('\n\n');
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/enrichment/who-to-ask.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateWhoToAsk, formatWhoToAsk } from '@/lib/chemeln/enrichment/who-to-ask';

describe('generateWhoToAsk', () => {
  it('should generate ranked list of experts', () => {
    const profiles = [
      {
        researcherId: 'r-1',
        researcherName: 'Dr. A',
        totalExperiments: 12,
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

    const experiments = [
      {
        researcherId: 'r-1',
        reactionType: 'Suzuki Coupling',
        date: new Date('2024-03-15'),
      },
      {
        researcherId: 'r-2',
        reactionType: 'Suzuki Coupling',
        date: new Date('2024-02-10'),
      },
    ];

    const entries = generateWhoToAsk('Suzuki Coupling', profiles as any, experiments);

    expect(entries).toHaveLength(2);
    expect(entries[0].researcherName).toBe('Dr. A'); // More experiments
    expect(entries[0].experimentCount).toBe(12);
    expect(entries[0].avgYield).toBe(86);
    expect(entries[0].mostRecentDate).toEqual(new Date('2024-03-15'));
  });

  it('should handle reaction type with no researchers', () => {
    const entries = generateWhoToAsk('Nonexistent Reaction', [], []);
    expect(entries).toHaveLength(0);
  });

  it('should limit to top 5 researchers', () => {
    const profiles = Array(10)
      .fill(null)
      .map((_, i) => ({
        researcherId: `r-${i}`,
        researcherName: `Dr. ${i}`,
        totalExperiments: 10 - i,
        primaryAreas: [],
        allAreas: [
          {
            reactionType: 'Test Reaction',
            experimentCount: 10 - i,
            avgYield: 80,
            highQualityCount: 5,
          },
        ],
        keyContributions: [],
      }));

    const experiments = profiles.map((p) => ({
      researcherId: p.researcherId,
      reactionType: 'Test Reaction',
      date: new Date(),
    }));

    const entries = generateWhoToAsk('Test Reaction', profiles as any, experiments);

    expect(entries).toHaveLength(5); // Max 5
  });
});

describe('formatWhoToAsk', () => {
  it('should format entries correctly', () => {
    const entries = [
      {
        researcherName: 'Dr. Anna Mueller',
        experimentCount: 12,
        avgYield: 86,
        mostRecentDate: new Date('2026-03-15'),
      },
      {
        researcherName: 'Dr. James Chen',
        experimentCount: 8,
        avgYield: 82,
        mostRecentDate: new Date('2026-01-20'),
      },
    ];

    const markdown = formatWhoToAsk('Suzuki Coupling', entries as any);

    expect(markdown).toContain('## Who To Ask');
    expect(markdown).toContain('1. [[Dr. Anna Mueller]]');
    expect(markdown).toContain('12 experiments, avg 86% yield');
    expect(markdown).toContain('most recent: Mar 2026');
    expect(markdown).toContain('2. [[Dr. James Chen]]');
  });

  it('should handle empty entries', () => {
    const markdown = formatWhoToAsk('Empty Reaction', []);
    expect(markdown).toContain('No researchers with experience');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/enrichment/who-to-ask.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/who-to-ask.test.ts` |
| MODIFY | `src/lib/chemeln/sync/reaction-type-sync.ts` (add "Who To Ask" section) |
| MODIFY | `src/lib/chemeln/sync/substrate-class-sync.ts` (add "Who To Ask" section) |

---

## Dev Notes

### Agent Integration

The "Who To Ask" section enables agent queries like:

**Query:** "Who's the expert on Suzuki couplings with heteroaryl substrates?"

**Agent reasoning:**
1. Parse query → extract reaction type ("Suzuki coupling") and substrate class ("heteroaryl")
2. Fetch reaction type page: `/reactions/suzuki-coupling`
3. Read "Who To Ask" section
4. Return top-ranked researcher with context

**Response:** "Talk to Dr. Anna Mueller. She has 12 Suzuki coupling experiments with an average yield of 86%, most recently in Mar 2026. She's contributed optimized protocols for heteroaryl substrates."

### Ranking vs. Alphabetical

"Who To Ask" is NOT alphabetical — it's ranked by expertise. A researcher with fewer experiments but higher yields may rank above one with more experiments but lower yields.

### Future Enhancements

- **Collaborative filtering**: "Researchers who worked with Dr. Mueller also worked with..."
- **Specialty matching**: Rank higher if researcher's key contributions mention the specific substrate
- **Availability indicators**: Mark researchers as "currently active" vs. "alumni"

---

**Last Updated:** 2026-03-21
