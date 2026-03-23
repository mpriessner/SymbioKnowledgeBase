# Story SKB-43.5: Researcher Identity Extraction

**Epic:** Epic 43 - ChemELN Data Extraction & Transformation
**Story ID:** SKB-43.5
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-43.2 (experiment data must be fetched), SKB-43.4 (reaction classifications needed for expertise mapping)

---

## User Story

As a data normalization service, I want to extract researcher identities and compute their expertise areas based on experiment history, So that I can build researcher profiles for the knowledge base.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/normalizers/researchers.ts` exports `extractResearchers()` function
- [ ] Look up user by `created_by` UUID in ChemELN's `auth.users` table
- [ ] Extract name from `raw_user_meta_data` JSONB field (path: `raw_user_meta_data.name`)
- [ ] Extract email from `auth.users.email` column
- [ ] Handle missing user data gracefully (deleted users → "Unknown Researcher")
- [ ] Build `ResearcherProfile[]` registry with: name, email, experiment counts grouped by reaction type
- [ ] Compute primary expertise areas (top 3 reaction types by experiment count)
- [ ] Compute total experiments per researcher
- [ ] Output sorted by total experiment count (most active researchers first)
- [ ] Unit tests verify user lookup, missing data handling, expertise computation
- [ ] Integration test builds researcher profiles from real ChemELN data

---

## Architecture Overview

```
Input: ExperimentData[] + ReactionTypeStats[]
    │
    │ Extract unique created_by UUIDs
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  ChemELN auth.users Table                           │
│  {                                                  │
│    id: 'uuid-1',                                    │
│    email: 'alice@lab.org',                          │
│    raw_user_meta_data: {                            │
│      name: 'Alice Johnson',                         │
│      department: 'Organic Chemistry',               │
│    },                                               │
│  }                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ SELECT id, email, raw_user_meta_data
    │ FROM auth.users
    │ WHERE id IN (created_by UUIDs)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  User Lookup Map                                    │
│  {                                                  │
│    'uuid-1': {                                      │
│      name: 'Alice Johnson',                         │
│      email: 'alice@lab.org',                        │
│    },                                               │
│    'uuid-2': {                                      │
│      name: 'Bob Smith',                             │
│      email: 'bob@lab.org',                          │
│    },                                               │
│  }                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ Group experiments by researcher
    │ Count experiments per reaction type
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  ResearcherProfile[]                                │
│  [                                                  │
│    {                                                │
│      userId: 'uuid-1',                              │
│      name: 'Alice Johnson',                         │
│      email: 'alice@lab.org',                        │
│      totalExperiments: 42,                          │
│      experimentsByReactionType: {                   │
│        'Suzuki': 15,                                │
│        'Grignard': 12,                              │
│        'Hydrogenation': 8,                          │
│        'Oxidation': 5,                              │
│        'Wittig': 2,                                 │
│      },                                             │
│      primaryExpertise: ['Suzuki', 'Grignard',       │
│        'Hydrogenation'], // Top 3                   │
│    },                                               │
│    {                                                │
│      userId: 'uuid-2',                              │
│      name: 'Bob Smith',                             │
│      email: 'bob@lab.org',                          │
│      totalExperiments: 28,                          │
│      experimentsByReactionType: {                   │
│        'Diels-Alder': 18,                           │
│        'Aldol': 7,                                  │
│        'Esterification': 3,                         │
│      },                                             │
│      primaryExpertise: ['Diels-Alder', 'Aldol',     │
│        'Esterification'],                           │
│    },                                               │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
```

**Why `raw_user_meta_data`:** Supabase stores custom user profile data in the `raw_user_meta_data` JSONB column. ChemELN populates this with the user's display name during registration.

**Why top 3 expertise areas:** Most researchers specialize in 2-4 reaction types. Limiting to top 3 avoids diluting expertise signals with rarely-used reactions.

---

## Implementation Steps

### Step 1: Define ResearcherProfile Type

Add the output type to `src/lib/chemeln/types.ts`.

**Add to `src/lib/chemeln/types.ts`:**

```typescript
export interface ResearcherProfile {
  userId: string;
  name: string;
  email: string;
  totalExperiments: number;
  experimentsByReactionType: Record<string, number>;
  primaryExpertise: string[]; // Top 3 reaction types
}
```

---

### Step 2: Implement User Lookup

Create a function to fetch user data from ChemELN's auth.users table.

**File: `src/lib/chemeln/normalizers/researchers.ts`**

```typescript
import { getChemELNClient } from '../client';

interface UserData {
  id: string;
  email: string;
  name: string;
}

async function lookupUsers(userIds: string[]): Promise<Map<string, UserData>> {
  const client = getChemELNClient();

  const { data, error } = await client
    .from('users')
    .select('id, email, raw_user_meta_data')
    .in('id', userIds);

  if (error) {
    console.warn('Failed to fetch user data:', error.message);
    return new Map();
  }

  const userMap = new Map<string, UserData>();

  for (const user of data ?? []) {
    userMap.set(user.id, {
      id: user.id,
      email: user.email ?? 'unknown@example.com',
      name: user.raw_user_meta_data?.name ?? 'Unknown Researcher',
    });
  }

  return userMap;
}
```

**Null handling:**
- If `raw_user_meta_data.name` is missing → "Unknown Researcher"
- If `email` is missing → "unknown@example.com"
- If entire user is missing from auth.users (deleted account) → caught by `userMap.get()` returning `undefined` in next step

---

### Step 3: Group Experiments by Researcher

Create a function to aggregate experiments per researcher.

**Add to `src/lib/chemeln/normalizers/researchers.ts`:**

```typescript
import { ExperimentData, ClassifiedExperiment } from '../types';

interface ResearcherExperiments {
  userId: string;
  experimentIds: string[];
  reactionTypeCounts: Map<string, number>;
}

function groupExperimentsByResearcher(
  experiments: ExperimentData[],
  classifications: ClassifiedExperiment[]
): Map<string, ResearcherExperiments> {
  const researcherMap = new Map<string, ResearcherExperiments>();

  // Build classification lookup
  const classificationMap = new Map(
    classifications.map(c => [c.experimentId, c.reactionType])
  );

  for (const exp of experiments) {
    const userId = exp.createdBy;

    if (!researcherMap.has(userId)) {
      researcherMap.set(userId, {
        userId,
        experimentIds: [],
        reactionTypeCounts: new Map(),
      });
    }

    const researcher = researcherMap.get(userId)!;
    researcher.experimentIds.push(exp.id);

    // Count reaction types
    const reactionType = classificationMap.get(exp.id) ?? 'Unclassified';
    const currentCount = researcher.reactionTypeCounts.get(reactionType) ?? 0;
    researcher.reactionTypeCounts.set(reactionType, currentCount + 1);
  }

  return researcherMap;
}
```

---

### Step 4: Compute Primary Expertise

Create a function to determine top 3 reaction types per researcher.

**Add to `src/lib/chemeln/normalizers/researchers.ts`:**

```typescript
function computePrimaryExpertise(
  reactionTypeCounts: Map<string, number>
): string[] {
  const sorted = Array.from(reactionTypeCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([reactionType]) => reactionType);

  return sorted.slice(0, 3); // Top 3
}
```

---

### Step 5: Build ResearcherProfile Objects

Create the main extraction function.

**Add to `src/lib/chemeln/normalizers/researchers.ts`:**

```typescript
import { ResearcherProfile } from '../types';

export async function extractResearchers(
  experiments: ExperimentData[],
  classifications: ClassifiedExperiment[]
): Promise<ResearcherProfile[]> {
  const researcherExps = groupExperimentsByResearcher(experiments, classifications);

  // Get unique user IDs
  const userIds = Array.from(researcherExps.keys());

  // Lookup user data
  const userData = await lookupUsers(userIds);

  const profiles: ResearcherProfile[] = [];

  for (const [userId, expData] of researcherExps.entries()) {
    const user = userData.get(userId) ?? {
      id: userId,
      name: 'Unknown Researcher',
      email: 'unknown@example.com',
    };

    profiles.push({
      userId,
      name: user.name,
      email: user.email,
      totalExperiments: expData.experimentIds.length,
      experimentsByReactionType: Object.fromEntries(expData.reactionTypeCounts),
      primaryExpertise: computePrimaryExpertise(expData.reactionTypeCounts),
    });
  }

  // Sort by total experiments descending (most active researchers first)
  return profiles.sort((a, b) => b.totalExperiments - a.totalExperiments);
}
```

**Output structure:**
- `experimentsByReactionType`: Full breakdown (e.g., `{ Suzuki: 15, Grignard: 12, ... }`)
- `primaryExpertise`: Top 3 only (e.g., `['Suzuki', 'Grignard', 'Hydrogenation']`)
- Sorted by total experiment count (most prolific researchers first)

---

### Step 6: Add Convenience Functions

Add helpers for specific queries.

**Add to `src/lib/chemeln/normalizers/researchers.ts`:**

```typescript
export function getResearcherById(
  profiles: ResearcherProfile[],
  userId: string
): ResearcherProfile | null {
  return profiles.find(p => p.userId === userId) ?? null;
}

export function getResearchersByExpertise(
  profiles: ResearcherProfile[],
  reactionType: string
): ResearcherProfile[] {
  return profiles.filter(p => p.primaryExpertise.includes(reactionType));
}
```

---

### Step 7: Export Public API

Update `src/lib/chemeln/index.ts` to expose researcher functions.

**Add to `src/lib/chemeln/index.ts`:**

```typescript
export {
  extractResearchers,
  getResearcherById,
  getResearchersByExpertise,
} from './normalizers/researchers';

export type { ResearcherProfile } from './types';
```

---

## Testing Requirements

### Unit Test: `tests/unit/chemeln/normalizers/researchers.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractResearchers } from '@/lib/chemeln/normalizers/researchers';
import { ExperimentData, ClassifiedExperiment } from '@/lib/chemeln/types';

// Mock user lookup
vi.mock('@/lib/chemeln/client', () => ({
  getChemELNClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          data: [
            {
              id: 'user-1',
              email: 'alice@lab.org',
              raw_user_meta_data: { name: 'Alice Johnson' },
            },
            {
              id: 'user-2',
              email: 'bob@lab.org',
              raw_user_meta_data: { name: 'Bob Smith' },
            },
          ],
          error: null,
        }),
      }),
    }),
  }),
}));

describe('Researcher Identity Extraction', () => {
  it('should extract researcher profiles with expertise', async () => {
    const experiments: ExperimentData[] = [
      {
        id: 'exp-1',
        createdBy: 'user-1',
        // ... other fields
      } as ExperimentData,
      {
        id: 'exp-2',
        createdBy: 'user-1',
        // ... other fields
      } as ExperimentData,
      {
        id: 'exp-3',
        createdBy: 'user-2',
        // ... other fields
      } as ExperimentData,
    ];

    const classifications: ClassifiedExperiment[] = [
      { experimentId: 'exp-1', reactionType: 'Suzuki', confidence: 'high' },
      { experimentId: 'exp-2', reactionType: 'Suzuki', confidence: 'high' },
      { experimentId: 'exp-3', reactionType: 'Grignard', confidence: 'high' },
    ];

    const profiles = await extractResearchers(experiments, classifications);

    expect(profiles).toHaveLength(2);

    const alice = profiles.find(p => p.userId === 'user-1');
    expect(alice?.name).toBe('Alice Johnson');
    expect(alice?.email).toBe('alice@lab.org');
    expect(alice?.totalExperiments).toBe(2);
    expect(alice?.experimentsByReactionType['Suzuki']).toBe(2);
    expect(alice?.primaryExpertise).toContain('Suzuki');

    const bob = profiles.find(p => p.userId === 'user-2');
    expect(bob?.name).toBe('Bob Smith');
    expect(bob?.totalExperiments).toBe(1);
    expect(bob?.experimentsByReactionType['Grignard']).toBe(1);
  });

  it('should handle missing user data gracefully', async () => {
    // Override mock to return empty data
    vi.mocked(getChemELNClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({
          in: () => ({ data: [], error: null }),
        }),
      }),
    } as any);

    const experiments: ExperimentData[] = [
      {
        id: 'exp-1',
        createdBy: 'deleted-user',
        // ... other fields
      } as ExperimentData,
    ];

    const classifications: ClassifiedExperiment[] = [
      { experimentId: 'exp-1', reactionType: 'Suzuki', confidence: 'high' },
    ];

    const profiles = await extractResearchers(experiments, classifications);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Unknown Researcher');
    expect(profiles[0].email).toBe('unknown@example.com');
  });

  it('should compute primary expertise as top 3 reaction types', async () => {
    const experiments: ExperimentData[] = [
      { id: 'e1', createdBy: 'user-1' } as ExperimentData,
      { id: 'e2', createdBy: 'user-1' } as ExperimentData,
      { id: 'e3', createdBy: 'user-1' } as ExperimentData,
      { id: 'e4', createdBy: 'user-1' } as ExperimentData,
      { id: 'e5', createdBy: 'user-1' } as ExperimentData,
    ];

    const classifications: ClassifiedExperiment[] = [
      { experimentId: 'e1', reactionType: 'Suzuki', confidence: 'high' },
      { experimentId: 'e2', reactionType: 'Suzuki', confidence: 'high' },
      { experimentId: 'e3', reactionType: 'Grignard', confidence: 'high' },
      { experimentId: 'e4', reactionType: 'Grignard', confidence: 'high' },
      { experimentId: 'e5', reactionType: 'Aldol', confidence: 'high' },
    ];

    const profiles = await extractResearchers(experiments, classifications);

    expect(profiles[0].primaryExpertise).toHaveLength(3);
    expect(profiles[0].primaryExpertise).toEqual(['Suzuki', 'Grignard', 'Aldol']);
  });
});
```

### Integration Test: `tests/integration/chemeln/normalizers/researchers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { fetchExperiments } from '@/lib/chemeln';
import { classifyReactions } from '@/lib/chemeln/normalizers/reactions';
import { extractResearchers } from '@/lib/chemeln/normalizers/researchers';

describe('Researcher Extraction (Integration)', () => {
  it('should extract researcher profiles from real ChemELN data', async () => {
    const experiments = await fetchExperiments();
    const stats = classifyReactions(experiments);

    // Build classification list
    const classifications = experiments.map(exp => {
      const reactionType =
        stats.find(s => s.experimentIds.includes(exp.id))?.reactionType ??
        'Unclassified';
      return {
        experimentId: exp.id,
        reactionType,
        confidence: 'high' as const,
      };
    });

    const profiles = await extractResearchers(experiments, classifications);

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);

    // Verify all profiles have required fields
    profiles.forEach(p => {
      expect(p.userId).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.email).toBeDefined();
      expect(p.totalExperiments).toBeGreaterThan(0);
      expect(p.primaryExpertise.length).toBeLessThanOrEqual(3);
    });

    // Verify sorted by total experiments
    for (let i = 1; i < profiles.length; i++) {
      expect(profiles[i - 1].totalExperiments).toBeGreaterThanOrEqual(
        profiles[i].totalExperiments
      );
    }
  }, 25000);
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/lib/chemeln/types.ts` (add ResearcherProfile type) |
| CREATE | `src/lib/chemeln/normalizers/researchers.ts` |
| MODIFY | `src/lib/chemeln/index.ts` (export extractResearchers) |
| CREATE | `tests/unit/chemeln/normalizers/researchers.test.ts` |
| CREATE | `tests/integration/chemeln/normalizers/researchers.test.ts` |

---

## Dev Notes

**ChemELN auth schema dependency:** This extractor assumes ChemELN uses Supabase's default `auth.users` table with the `raw_user_meta_data` JSONB column. If ChemELN has customized the auth schema, this will need adjustment.

**Deleted users:** If a user account is deleted from ChemELN, their experiments remain (via `created_by` UUID), but the user lookup returns no data. We handle this gracefully by defaulting to "Unknown Researcher".

**Privacy consideration:** Email addresses are sensitive data. In a production deployment, consider whether to expose researcher emails in the knowledge base or use a privacy-preserving identifier (e.g., hashed email, display name only).

**Expertise threshold:** The "top 3" expertise cutoff is arbitrary. For researchers with very diverse experiment portfolios (e.g., 10 experiments evenly distributed across 10 reaction types), the top 3 may not be meaningful. Consider adding a minimum threshold (e.g., "at least 3 experiments in a reaction type to qualify as expertise").

---

**Last Updated:** 2026-03-21
