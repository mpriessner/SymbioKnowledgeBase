# Story SKB-44.2: Entity Page Generators

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-42.3 (Page Templates), SKB-43.3 (Chemical Dedup), SKB-43.4 (Reaction Classification), SKB-43.5 (Researcher Identity)

## User Story
As an ingestion pipeline, I want to generate Chemical, ReactionType, Researcher, and SubstrateClass pages from extracted ChemELN data, So that entity pages provide aggregated institutional knowledge with cross-references, "Key Learnings", and "Who To Ask" sections.

## Acceptance Criteria
- [ ] Four generator functions exported from respective modules:
  - `generateChemicalPage(data: ChemicalData, usages: ChemicalUsage[]): string`
  - `generateReactionTypePage(data: ReactionTypeAggregation): string`
  - `generateResearcherPage(data: ResearcherProfile): string`
  - `generateSubstrateClassPage(data: SubstrateClassAggregation): string`
- [ ] Chemical pages include: CAS, molecular formula, molecular weight, practical notes, "Used In" section with experiment wikilinks (role + amount)
- [ ] Reaction type pages include: aggregate stats (count, avg yield, researcher count), "Key Learnings" (ranked, attributed), "Common Pitfalls", "Who To Ask" (top 3 researchers)
- [ ] Researcher pages include: expertise areas (top reaction types by count, avg yield), recent experiments list (last 10), key contributions
- [ ] Substrate class pages include: challenges section, "What Worked" with experiment links, "Who Has Experience"
- [ ] All pages have valid YAML frontmatter with appropriate tags
- [ ] All pages use wikilinks for cross-referencing
- [ ] Missing/optional data results in omitted sections (not empty ones)
- [ ] Unit tests for each generator with mock aggregated data
- [ ] Generated markdown passes markdownToTiptap() conversion

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│  Entity Data (from EPIC-43 extractors + aggregation)             │
│                                                                   │
│  ChemicalData + ChemicalUsage[]                                  │
│    { id, name, cas, formula, weight, usages: [{expId, role}] }   │
│                                                                   │
│  ReactionTypeAggregation                                          │
│    { name, experimentCount, avgYield, researchers[],              │
│      keyLearnings[], commonPitfalls[], topResearchers[] }        │
│                                                                   │
│  ResearcherProfile                                                │
│    { name, email, expertiseAreas[], recentExperiments[],          │
│      totalExperiments, topReactionTypes[] }                      │
│                                                                   │
│  SubstrateClassAggregation                                        │
│    { name, challenges[], whatWorked[], researchers[] }            │
└───────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┬─────────────┐
              ▼            ▼            ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Chemical  │ │Reaction  │ │Researcher│ │Substrate │
        │Page Gen  │ │Type Gen  │ │Page Gen  │ │Class Gen │
        └──────────┘ └──────────┘ └──────────┘ └──────────┘
              │            │            │             │
              ▼            ▼            ▼             ▼
        ┌──────────────────────────────────────────────────┐
        │  Markdown Pages with Frontmatter + Wikilinks     │
        └──────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Define Aggregation Types

**File: `src/lib/chemeln/types.ts` (additions)**

```typescript
export interface ChemicalUsage {
  experimentId: string;
  experimentTitle: string;
  role: 'reagent' | 'product' | 'catalyst' | 'solvent';
  amount: number;
  unit: string;
  yield?: number; // for products only
}

export interface KeyLearning {
  content: string;
  researcherName: string;
  experimentId: string;
  date: string;
  qualityScore: number;
}

export interface ReactionTypeAggregation {
  name: string;
  experimentCount: number;
  avgYield: number;
  researcherCount: number;
  experiments: Array<{ id: string; title: string; yield: number; researcher: string; date: string }>;
  keyLearnings: KeyLearning[];
  commonPitfalls: string[];
  topResearchers: Array<{ name: string; experimentCount: number; avgYield: number }>;
}

export interface ResearcherProfile {
  name: string;
  email?: string;
  totalExperiments: number;
  topReactionTypes: Array<{ name: string; count: number; avgYield: number }>;
  recentExperiments: Array<{ id: string; title: string; date: string; reactionType: string }>;
  keyContributions: string[];
}

export interface SubstrateClassAggregation {
  name: string;
  challenges: string[];
  whatWorked: Array<{ description: string; experimentId: string; experimentTitle: string }>;
  researchers: Array<{ name: string; experimentCount: number }>;
}
```

### Step 2: Implement Chemical Page Generator

**File: `src/lib/chemeln/generators/chemical.ts`**

```typescript
import { ChemicalData, ChemicalUsage } from '../types';
import { buildFrontmatter, experimentWikilink } from './utils';

export function generateChemicalPage(
  data: ChemicalData,
  usages: ChemicalUsage[]
): string {
  const sections: string[] = [];

  // Frontmatter
  const tags: string[] = ['chemical'];
  if (data.casNumber) tags.push(`cas:${data.casNumber}`);

  sections.push(buildFrontmatter({
    title: data.name,
    icon: '⚗️',
    'page-type': 'chemical',
    tags,
    'one-liner': `${data.name}${data.casNumber ? ` (CAS: ${data.casNumber})` : ''}`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }));

  // Title
  sections.push(`# ${data.name}\n`);

  // Properties
  sections.push('## Properties\n');
  if (data.casNumber) sections.push(`- **CAS Number:** ${data.casNumber}`);
  if (data.molecularFormula) sections.push(`- **Molecular Formula:** ${data.molecularFormula}`);
  sections.push('');

  // Used In
  if (usages.length > 0) {
    sections.push('## Used In\n');
    const grouped: Record<string, ChemicalUsage[]> = {};
    for (const usage of usages) {
      const key = usage.role;
      (grouped[key] ??= []).push(usage);
    }

    for (const [role, items] of Object.entries(grouped)) {
      sections.push(`### As ${role.charAt(0).toUpperCase() + role.slice(1)}\n`);
      for (const item of items) {
        const yieldStr = item.yield ? ` → ${item.yield}% yield` : '';
        sections.push(`- ${experimentWikilink(item.experimentId, item.experimentTitle)} — ${item.amount} ${item.unit}${yieldStr}`);
      }
      sections.push('');
    }
  }

  // Practical Notes placeholder
  sections.push('## Practical Notes\n');
  sections.push('*No practical notes yet. These will be populated from experiment observations.*\n');

  return sections.join('\n');
}
```

### Step 3: Implement Reaction Type Page Generator

**File: `src/lib/chemeln/generators/reaction-type.ts`**

```typescript
import { ReactionTypeAggregation } from '../types';
import { buildFrontmatter, researcherWikilink, experimentWikilink, buildTable } from './utils';

export function generateReactionTypePage(data: ReactionTypeAggregation): string {
  const sections: string[] = [];
  const tag = `reaction:${data.name.toLowerCase().replace(/\s+/g, '-')}`;

  sections.push(buildFrontmatter({
    title: data.name,
    icon: '🔬',
    'page-type': 'reaction-type',
    tags: [tag],
    'one-liner': `${data.experimentCount} experiments, ${data.avgYield.toFixed(0)}% avg yield, ${data.researcherCount} researchers`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }));

  sections.push(`# ${data.name}\n`);

  // Stats summary
  sections.push('## Institutional Experience\n');
  sections.push(`Our lab has performed **${data.experimentCount} experiments** with this reaction type.`);
  sections.push(`Average yield: **${data.avgYield.toFixed(1)}%** across ${data.researcherCount} researchers.\n`);

  // Key Learnings (ranked, attributed)
  if (data.keyLearnings.length > 0) {
    sections.push('## Key Learnings\n');
    const sorted = [...data.keyLearnings].sort((a, b) => b.qualityScore - a.qualityScore);
    for (let i = 0; i < sorted.length; i++) {
      const learning = sorted[i];
      sections.push(`${i + 1}. ${learning.content}`);
      sections.push(`   *— ${researcherWikilink(learning.researcherName)}, ${experimentWikilink(learning.experimentId, '')}, ${learning.date}*\n`);
    }
  }

  // Common Pitfalls
  if (data.commonPitfalls.length > 0) {
    sections.push('## Common Pitfalls\n');
    for (const pitfall of data.commonPitfalls) {
      sections.push(`- ⚠️ ${pitfall}`);
    }
    sections.push('');
  }

  // Who To Ask
  if (data.topResearchers.length > 0) {
    sections.push('## Who To Ask\n');
    sections.push(buildTable(
      ['Researcher', 'Experiments', 'Avg Yield'],
      data.topResearchers.map(r => [
        researcherWikilink(r.name),
        String(r.experimentCount),
        `${r.avgYield.toFixed(1)}%`,
      ])
    ));
    sections.push('');
  }

  // Recent Experiments
  if (data.experiments.length > 0) {
    sections.push('## Recent Experiments\n');
    const recent = data.experiments.slice(0, 15);
    for (const exp of recent) {
      sections.push(`- ${experimentWikilink(exp.id, exp.title)} — ${exp.yield}% yield, ${researcherWikilink(exp.researcher)}, ${exp.date}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
```

### Step 4: Implement Researcher Page Generator

**File: `src/lib/chemeln/generators/researcher.ts`**

```typescript
import { ResearcherProfile } from '../types';
import { buildFrontmatter, reactionTypeWikilink, experimentWikilink, buildTable } from './utils';

export function generateResearcherPage(data: ResearcherProfile): string {
  const sections: string[] = [];
  const tag = `researcher:${data.name.toLowerCase().replace(/\s+/g, '-')}`;

  sections.push(buildFrontmatter({
    title: data.name,
    icon: '👩‍🔬',
    'page-type': 'researcher',
    tags: [tag],
    'one-liner': `${data.totalExperiments} experiments across ${data.topReactionTypes.length} reaction types`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }));

  sections.push(`# ${data.name}\n`);

  // Expertise Areas
  if (data.topReactionTypes.length > 0) {
    sections.push('## Expertise Areas\n');
    sections.push(buildTable(
      ['Reaction Type', 'Experiments', 'Avg Yield'],
      data.topReactionTypes.map(rt => [
        reactionTypeWikilink(rt.name),
        String(rt.count),
        `${rt.avgYield.toFixed(1)}%`,
      ])
    ));
    sections.push('');
  }

  // Recent Experiments
  if (data.recentExperiments.length > 0) {
    sections.push('## Recent Experiments\n');
    for (const exp of data.recentExperiments.slice(0, 10)) {
      sections.push(`- ${experimentWikilink(exp.id, exp.title)} — ${reactionTypeWikilink(exp.reactionType)}, ${exp.date}`);
    }
    sections.push('');
  }

  // Key Contributions
  if (data.keyContributions.length > 0) {
    sections.push('## Key Contributions\n');
    for (const contribution of data.keyContributions) {
      sections.push(`- ${contribution}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
```

### Step 5: Implement Substrate Class Page Generator

**File: `src/lib/chemeln/generators/substrate-class.ts`**

```typescript
import { SubstrateClassAggregation } from '../types';
import { buildFrontmatter, researcherWikilink, experimentWikilink } from './utils';

export function generateSubstrateClassPage(data: SubstrateClassAggregation): string {
  const sections: string[] = [];
  const tag = `substrate-class:${data.name.toLowerCase().replace(/\s+/g, '-')}`;

  sections.push(buildFrontmatter({
    title: data.name,
    icon: '🧬',
    'page-type': 'substrate-class',
    tags: [tag],
    'one-liner': `Substrate class with ${data.whatWorked.length} successful approaches`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }));

  sections.push(`# ${data.name}\n`);

  // Challenges
  if (data.challenges.length > 0) {
    sections.push('## Known Challenges\n');
    for (const challenge of data.challenges) {
      sections.push(`- ⚠️ ${challenge}`);
    }
    sections.push('');
  }

  // What Worked
  if (data.whatWorked.length > 0) {
    sections.push('## What Worked\n');
    for (const item of data.whatWorked) {
      sections.push(`- ✅ ${item.description} — ${experimentWikilink(item.experimentId, item.experimentTitle)}`);
    }
    sections.push('');
  }

  // Who Has Experience
  if (data.researchers.length > 0) {
    sections.push('## Who Has Experience\n');
    for (const researcher of data.researchers) {
      sections.push(`- ${researcherWikilink(researcher.name)} — ${researcher.experimentCount} experiments`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
```

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/generators/entity-generators.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateChemicalPage } from '@/lib/chemeln/generators/chemical';
import { generateReactionTypePage } from '@/lib/chemeln/generators/reaction-type';
import { generateResearcherPage } from '@/lib/chemeln/generators/researcher';
import { generateSubstrateClassPage } from '@/lib/chemeln/generators/substrate-class';

describe('Chemical Page Generator', () => {
  it('should include CAS number and formula', () => {
    const md = generateChemicalPage(
      { id: 'c1', name: 'Palladium Acetate', casNumber: '3375-31-3', molecularFormula: 'C4H6O4Pd' },
      [{ experimentId: 'EXP-001', experimentTitle: 'Test', role: 'catalyst', amount: 5, unit: 'mol%' }]
    );
    expect(md).toContain('cas:3375-31-3');
    expect(md).toContain('C4H6O4Pd');
    expect(md).toContain('## Used In');
    expect(md).toContain('As Catalyst');
  });

  it('should group usages by role', () => {
    const md = generateChemicalPage(
      { id: 'c1', name: 'THF', casNumber: '109-99-9', molecularFormula: 'C4H8O' },
      [
        { experimentId: 'EXP-001', experimentTitle: 'Test 1', role: 'solvent', amount: 10, unit: 'mL' },
        { experimentId: 'EXP-002', experimentTitle: 'Test 2', role: 'solvent', amount: 20, unit: 'mL' },
      ]
    );
    expect(md).toContain('As Solvent');
    expect(md).toContain('[[EXP-001: Test 1]]');
    expect(md).toContain('[[EXP-002: Test 2]]');
  });
});

describe('Reaction Type Page Generator', () => {
  it('should include aggregate stats and key learnings', () => {
    const md = generateReactionTypePage({
      name: 'Suzuki Coupling',
      experimentCount: 25,
      avgYield: 78.5,
      researcherCount: 3,
      experiments: [{ id: 'EXP-001', title: 'Test', yield: 85, researcher: 'Jane Doe', date: '2026-03-01' }],
      keyLearnings: [{ content: 'Use fresh catalyst', researcherName: 'Jane Doe', experimentId: 'EXP-001', date: '2026-03-01', qualityScore: 5 }],
      commonPitfalls: ['Catalyst deactivation in air'],
      topResearchers: [{ name: 'Jane Doe', experimentCount: 15, avgYield: 82.3 }],
    });
    expect(md).toContain('reaction:suzuki-coupling');
    expect(md).toContain('25 experiments');
    expect(md).toContain('78.5%');
    expect(md).toContain('Use fresh catalyst');
    expect(md).toContain('## Who To Ask');
    expect(md).toContain('[[Jane Doe]]');
  });
});

describe('Researcher Page Generator', () => {
  it('should include expertise and recent experiments', () => {
    const md = generateResearcherPage({
      name: 'Jane Doe',
      email: 'jane@lab.org',
      totalExperiments: 45,
      topReactionTypes: [{ name: 'Suzuki Coupling', count: 15, avgYield: 82.3 }],
      recentExperiments: [{ id: 'EXP-001', title: 'Test', date: '2026-03-01', reactionType: 'Suzuki Coupling' }],
      keyContributions: ['Pioneered microwave-assisted Suzuki protocol'],
    });
    expect(md).toContain('researcher:jane-doe');
    expect(md).toContain('## Expertise Areas');
    expect(md).toContain('[[Suzuki Coupling]]');
    expect(md).toContain('## Key Contributions');
  });
});

describe('Substrate Class Page Generator', () => {
  it('should include challenges and what worked', () => {
    const md = generateSubstrateClassPage({
      name: 'Aryl Halides',
      challenges: ['Electron-poor substrates require higher catalyst loading'],
      whatWorked: [{ description: 'Use Pd(dppf)Cl2 for electron-poor substrates', experimentId: 'EXP-001', experimentTitle: 'Test' }],
      researchers: [{ name: 'Jane Doe', experimentCount: 10 }],
    });
    expect(md).toContain('substrate-class:aryl-halides');
    expect(md).toContain('## Known Challenges');
    expect(md).toContain('## What Worked');
    expect(md).toContain('## Who Has Experience');
  });
});
```

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/generators/chemical.ts` |
| CREATE | `src/lib/chemeln/generators/reaction-type.ts` |
| CREATE | `src/lib/chemeln/generators/researcher.ts` |
| CREATE | `src/lib/chemeln/generators/substrate-class.ts` |
| MODIFY | `src/lib/chemeln/types.ts` (add aggregation types) |
| CREATE | `src/__tests__/lib/chemeln/generators/entity-generators.test.ts` |

## Dev Notes

**Aggregation data:** The generators expect pre-aggregated data. The aggregation logic (e.g., computing average yield across experiments for a reaction type) is handled by EPIC-45 extractors and EPIC-44.4 orchestrator. Generators are pure template functions — data in, markdown out.

**"Key Learnings" ranking:** Key learnings are sorted by quality score (descending). Higher quality experiments (higher yield + more complete data) produce higher-ranked learnings. This ensures the most reliable advice appears first.

**"Who To Ask" section:** Top 3 researchers by experiment count for that reaction type. This is a critical feature for the demo — an agent can immediately suggest "Talk to Jane Doe about Suzuki Couplings, she has 15 experiments with 82% avg yield."

**Cross-references update in Pass 3:** After initial generation (Pass 1), entity pages may not have complete cross-references. Pass 3 of the batch orchestrator (SKB-44.4) updates chemical "Used In" sections and reaction type "Key Learnings" with data from all experiments.

---

**Last Updated:** 2026-03-21
