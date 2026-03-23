# Story SKB-44.1: Experiment Page Generator

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-42.3 (Page Templates), SKB-43.2 (Experiment Data Fetcher)

## User Story
As an ingestion pipeline, I want to convert ExperimentData into a complete Markdown page with YAML frontmatter, conditions tables, reagent lists, procedure steps, results, and practical notes, So that each ChemELN experiment becomes a navigable, wikilinked knowledge base page.

## Acceptance Criteria
- [ ] TypeScript module `src/lib/chemeln/generators/experiment.ts` exports `generateExperimentPage(data: ExperimentData): string`
- [ ] Output matches the Experiment page template from SKB-42.3
- [ ] YAML frontmatter includes all required tags: eln:EXP-ID, reaction:TYPE, researcher:NAME, substrate-class:CLASS, scale:VALUE, quality:SCORE
- [ ] Conditions table renders with temperature, pressure, time, solvent (wikilinked chemicals)
- [ ] Reagent list renders each reagent with wikilink to chemical page, role, and amount
- [ ] Products section renders with yield percentage and wikilinked chemical
- [ ] Procedure steps rendered from `actualProcedure` field (numbered list)
- [ ] Falls back to `plannedProcedure` if `actualProcedure` is null
- [ ] Practical notes section extracted from procedure deviations and observations
- [ ] Related experiments section lists experiments with same reaction type
- [ ] Missing/null fields result in omitted sections (not empty sections)
- [ ] Wikilinks use exact page titles from EPIC-42 naming conventions
- [ ] Generated markdown passes `markdownToTiptap()` conversion without errors
- [ ] Quality score computed and included in frontmatter
- [ ] Unit tests cover all section generation with mock data

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ExperimentData (from EPIC-43)                              │
│                                                             │
│  { id, title, objective, experimentType, status,            │
│    createdBy, createdAt, actualProcedure,                   │
│    procedureMetadata, reagents[], products[],               │
│    practicalNotes?, relatedExperiments? }                   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  generateExperimentPage(data: ExperimentData): string       │
│                                                             │
│  1. Build YAML Frontmatter                                  │
│     - title, icon: 🧪, page-type: experiment                │
│     - tags: [eln:EXP-2024-001, reaction:suzuki-coupling,    │
│              researcher:jane-doe, quality:4]                 │
│     - one-liner: "Suzuki coupling of 4-bromoanisole..."     │
│     - created, updated timestamps                           │
│                                                             │
│  2. Build Title & Overview                                  │
│     - # EXP-2024-001: Suzuki Coupling of 4-bromoanisole     │
│     - Objective paragraph                                   │
│     - Reaction type wikilink: [[Suzuki Coupling]]           │
│     - Researcher wikilink: [[Jane Doe]]                     │
│                                                             │
│  3. Build Conditions Table                                  │
│     | Parameter | Value |                                   │
│     |-----------|-------|                                    │
│     | Temperature | 80°C |                                  │
│     | Solvent | [[THF]] |                                    │
│                                                             │
│  4. Build Reagents Section                                  │
│     - [[Palladium Acetate]] — catalyst, 5 mol%              │
│     - [[4-Bromoanisole]] — substrate, 1.0 mmol              │
│                                                             │
│  5. Build Products Section                                  │
│     - [[4-Methoxybiphenyl]] — 85% yield                     │
│                                                             │
│  6. Build Procedure Steps                                   │
│     1. Charge flask with substrate and catalyst              │
│     2. Add solvent under nitrogen atmosphere                 │
│                                                             │
│  7. Build Practical Notes                                   │
│     > **Deviation:** Used 3x more catalyst than planned     │
│     > **Observation:** Color change at 60°C, not 80°C       │
│                                                             │
│  8. Build Related Experiments                               │
│     - [[EXP-2024-005]] — Same reaction type                 │
│     - [[EXP-2024-012]] — Same substrate                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Output: Complete Markdown String                           │
│                                                             │
│  ---                                                        │
│  title: "EXP-2024-001: Suzuki Coupling of 4-bromoanisole"   │
│  icon: 🧪                                                   │
│  page-type: experiment                                      │
│  tags: [eln:EXP-2024-001, reaction:suzuki-coupling, ...]    │
│  ...                                                        │
│  ---                                                        │
│  # EXP-2024-001: Suzuki Coupling of 4-bromoanisole          │
│  ...full page content...                                    │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Shared Generator Utilities

**File: `src/lib/chemeln/generators/utils.ts`**

```typescript
import { ExperimentData, ChemicalData, ReagentData, ProductData } from '../types';

/**
 * Format a chemical name as a wikilink
 * Uses the naming convention from EPIC-42: Title Case chemical names
 */
export function chemicalWikilink(chemical: ChemicalData): string {
  return `[[${toTitleCase(chemical.name)}]]`;
}

/**
 * Format a researcher name as a wikilink
 */
export function researcherWikilink(name: string): string {
  return `[[${toTitleCase(name)}]]`;
}

/**
 * Format a reaction type as a wikilink
 */
export function reactionTypeWikilink(type: string): string {
  return `[[${toTitleCase(type)}]]`;
}

/**
 * Format an experiment ID as a wikilink
 */
export function experimentWikilink(id: string, title: string): string {
  return `[[${id}: ${title}]]`;
}

/**
 * Convert string to Title Case
 */
export function toTitleCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Build YAML frontmatter string from key-value pairs
 */
export function buildFrontmatter(metadata: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`);
    } else if (typeof value === 'string' && value.includes(':')) {
      lines.push(`${key}: "${value}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Build a markdown table from headers and rows
 */
export function buildTable(headers: string[], rows: string[][]): string {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map(row => `| ${row.join(' | ')} |`);
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Compute quality score (1-5) based on yield and data completeness
 */
export function computeQualityScore(data: ExperimentData): number {
  let score = 3; // baseline

  // Yield-based adjustment
  const maxYield = Math.max(...(data.products ?? []).map(p => p.yield ?? 0), 0);
  if (maxYield >= 90) score = 5;
  else if (maxYield >= 70) score = 4;
  else if (maxYield >= 50) score = 3;
  else if (maxYield >= 30) score = 2;
  else if (maxYield > 0) score = 1;

  // Completeness bonus/penalty
  if (!data.actualProcedure) score = Math.max(score - 1, 1);
  if (data.reagents.length === 0) score = Math.max(score - 1, 1);

  return score;
}
```

### Step 2: Implement Experiment Page Generator

**File: `src/lib/chemeln/generators/experiment.ts`**

```typescript
import { ExperimentData } from '../types';
import {
  buildFrontmatter,
  buildTable,
  chemicalWikilink,
  researcherWikilink,
  reactionTypeWikilink,
  experimentWikilink,
  computeQualityScore,
} from './utils';

export interface ExperimentPageContext {
  researcherName: string;
  reactionType: string;
  substrateClass?: string;
  scale?: string;
  relatedExperiments?: Array<{ id: string; title: string }>;
}

export function generateExperimentPage(
  data: ExperimentData,
  context: ExperimentPageContext
): string {
  const sections: string[] = [];
  const qualityScore = computeQualityScore(data);

  // 1. YAML Frontmatter
  const tags: string[] = [
    `eln:${data.id}`,
    `reaction:${context.reactionType.toLowerCase().replace(/\s+/g, '-')}`,
    `researcher:${context.researcherName.toLowerCase().replace(/\s+/g, '-')}`,
    `quality:${qualityScore}`,
  ];
  if (context.substrateClass) {
    tags.push(`substrate-class:${context.substrateClass.toLowerCase().replace(/\s+/g, '-')}`);
  }
  if (context.scale) {
    tags.push(`scale:${context.scale}`);
  }

  const frontmatter = buildFrontmatter({
    title: `${data.id}: ${data.title}`,
    icon: '🧪',
    'page-type': 'experiment',
    tags,
    'one-liner': data.objective ?? data.title,
    created: data.createdAt,
    updated: new Date().toISOString(),
  });
  sections.push(frontmatter);

  // 2. Title & Overview
  sections.push(`# ${data.id}: ${data.title}\n`);

  if (data.objective) {
    sections.push(`${data.objective}\n`);
  }

  sections.push(`**Reaction Type:** ${reactionTypeWikilink(context.reactionType)}`);
  sections.push(`**Researcher:** ${researcherWikilink(context.researcherName)}`);
  sections.push(`**Date:** ${new Date(data.createdAt).toLocaleDateString()}`);
  sections.push(`**Quality Score:** ${'★'.repeat(qualityScore)}${'☆'.repeat(5 - qualityScore)} (${qualityScore}/5)\n`);

  // 3. Conditions Table (if metadata available)
  if (data.procedureMetadata) {
    const meta = data.procedureMetadata as Record<string, string>;
    const conditionRows: string[][] = [];
    if (meta.temperature) conditionRows.push(['Temperature', meta.temperature]);
    if (meta.pressure) conditionRows.push(['Pressure', meta.pressure]);
    if (meta.time) conditionRows.push(['Reaction Time', meta.time]);
    if (meta.solvent) conditionRows.push(['Solvent', chemicalWikilink({ id: '', name: meta.solvent, casNumber: null, molecularFormula: null })]);
    if (meta.atmosphere) conditionRows.push(['Atmosphere', meta.atmosphere]);

    if (conditionRows.length > 0) {
      sections.push('## Conditions\n');
      sections.push(buildTable(['Parameter', 'Value'], conditionRows));
      sections.push('');
    }
  }

  // 4. Reagents
  if (data.reagents.length > 0) {
    sections.push('## Reagents\n');
    for (const reagent of data.reagents) {
      sections.push(`- ${chemicalWikilink(reagent.chemical)} — ${reagent.amount} ${reagent.unit}`);
    }
    sections.push('');
  }

  // 5. Products
  if (data.products.length > 0) {
    sections.push('## Products\n');
    for (const product of data.products) {
      const yieldStr = product.yield !== null ? ` — ${product.yield}% yield` : '';
      sections.push(`- ${chemicalWikilink(product.chemical)}${yieldStr}`);
    }
    sections.push('');
  }

  // 6. Procedure Steps
  const procedure = data.actualProcedure;
  if (procedure && procedure.length > 0) {
    sections.push('## Procedure\n');
    for (const step of procedure) {
      let stepLine = `${step.stepNumber}. ${step.action}`;
      const details: string[] = [];
      if (step.duration) details.push(step.duration);
      if (step.temperature) details.push(step.temperature);
      if (details.length > 0) {
        stepLine += ` (${details.join(', ')})`;
      }
      sections.push(stepLine);
    }
    sections.push('');
  }

  // 7. Practical Notes (from procedure deviations and observations)
  if (data.practicalNotes && data.practicalNotes.length > 0) {
    sections.push('## Practical Notes\n');
    for (const note of data.practicalNotes) {
      sections.push(`> **${note.type}:** ${note.content}`);
      if (note.timestamp) {
        sections.push(`> *— ${context.researcherName}, ${note.timestamp}*`);
      }
      sections.push('');
    }
  }

  // 8. Related Experiments
  if (context.relatedExperiments && context.relatedExperiments.length > 0) {
    sections.push('## Related Experiments\n');
    for (const related of context.relatedExperiments) {
      sections.push(`- ${experimentWikilink(related.id, related.title)}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
```

### Step 3: Add practicalNotes types

**Add to `src/lib/chemeln/types.ts`:**

```typescript
export interface PracticalNote {
  type: 'deviation' | 'observation' | 'tip' | 'warning';
  content: string;
  timestamp?: string;
}

// Update ExperimentData to include:
export interface ExperimentData {
  // ... existing fields ...
  practicalNotes?: PracticalNote[];
  plannedProcedure?: ProcedureStep[];
}
```

## Testing Requirements

### Unit Test: `src/__tests__/lib/chemeln/generators/experiment.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateExperimentPage, ExperimentPageContext } from '@/lib/chemeln/generators/experiment';
import { ExperimentData } from '@/lib/chemeln/types';

const mockExperiment: ExperimentData = {
  id: 'EXP-2024-001',
  title: 'Suzuki Coupling with 4-bromoanisole',
  objective: 'Optimize conditions for Suzuki coupling of aryl bromides',
  experimentType: 'Suzuki Coupling',
  status: 'completed',
  createdBy: 'user-1',
  createdAt: '2026-03-01T10:00:00Z',
  actualProcedure: [
    { stepNumber: 1, action: 'Charge flask with substrate and catalyst', temperature: 'RT' },
    { stepNumber: 2, action: 'Add solvent under nitrogen', duration: '5 min' },
    { stepNumber: 3, action: 'Heat to reflux', temperature: '80°C', duration: '2 hours' },
  ],
  procedureMetadata: { temperature: '80°C', time: '2 hours', solvent: 'THF', atmosphere: 'N₂' },
  reagents: [
    { id: 'r1', chemical: { id: 'c1', name: 'Palladium Acetate', casNumber: '3375-31-3', molecularFormula: null }, amount: 5, unit: 'mol%' },
    { id: 'r2', chemical: { id: 'c2', name: '4-Bromoanisole', casNumber: '104-92-7', molecularFormula: 'C7H7BrO' }, amount: 1.0, unit: 'mmol' },
  ],
  products: [
    { id: 'p1', chemical: { id: 'c3', name: '4-Methoxybiphenyl', casNumber: '613-37-6', molecularFormula: 'C13H12O' }, yield: 85, unit: '%' },
  ],
  practicalNotes: [
    { type: 'deviation', content: 'Used 3x more catalyst due to low reactivity', timestamp: '2026-03-01' },
    { type: 'observation', content: 'Color change observed at 60°C instead of expected 80°C' },
  ],
};

const mockContext: ExperimentPageContext = {
  researcherName: 'Jane Doe',
  reactionType: 'Suzuki Coupling',
  substrateClass: 'aryl-halides',
  scale: 'mmol',
  relatedExperiments: [{ id: 'EXP-2024-005', title: 'Suzuki Coupling optimization' }],
};

describe('generateExperimentPage', () => {
  it('should generate valid frontmatter with all tags', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('---');
    expect(md).toContain('page-type: experiment');
    expect(md).toContain('eln:EXP-2024-001');
    expect(md).toContain('reaction:suzuki-coupling');
    expect(md).toContain('researcher:jane-doe');
    expect(md).toContain('quality:');
  });

  it('should include conditions table', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Conditions');
    expect(md).toContain('Temperature');
    expect(md).toContain('80°C');
    expect(md).toContain('[[Thf]]');
  });

  it('should include wikilinked reagents', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Reagents');
    expect(md).toContain('[[Palladium Acetate]]');
    expect(md).toContain('5 mol%');
  });

  it('should include products with yield', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Products');
    expect(md).toContain('[[4-Methoxybiphenyl]]');
    expect(md).toContain('85% yield');
  });

  it('should include procedure steps', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Procedure');
    expect(md).toContain('1. Charge flask');
    expect(md).toContain('2. Add solvent');
  });

  it('should include practical notes', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Practical Notes');
    expect(md).toContain('**deviation:**');
    expect(md).toContain('3x more catalyst');
  });

  it('should omit sections for missing data', () => {
    const minimalExperiment: ExperimentData = {
      ...mockExperiment,
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
      practicalNotes: undefined,
    };
    const md = generateExperimentPage(minimalExperiment, mockContext);
    expect(md).not.toContain('## Conditions');
    expect(md).not.toContain('## Reagents');
    expect(md).not.toContain('## Products');
    expect(md).not.toContain('## Procedure');
    expect(md).not.toContain('## Practical Notes');
  });

  it('should include related experiments as wikilinks', () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain('## Related Experiments');
    expect(md).toContain('[[EXP-2024-005: Suzuki Coupling optimization]]');
  });
});
```

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/generators/utils.ts` |
| CREATE | `src/lib/chemeln/generators/experiment.ts` |
| MODIFY | `src/lib/chemeln/types.ts` (add PracticalNote, plannedProcedure) |
| CREATE | `src/__tests__/lib/chemeln/generators/experiment.test.ts` |

## Dev Notes

**Template fidelity:** The generator must produce markdown that matches the Experiment page template from SKB-42.3 section-by-section. Any structural deviation will cause consistency issues in the knowledge base.

**Wikilink resolution:** At generation time, wikilinks are written with page titles (e.g., `[[Palladium Acetate]]`). The cross-reference resolver (SKB-44.6) verifies these targets exist. If a chemical appears in an experiment but isn't in the ChemELN chemicals table, the resolver creates a stub page.

**Quality score:** Computed by `computeQualityScore()` utility function. Yield-based (1-5) with adjustments for data completeness. Stored in frontmatter as `quality:N` tag for agent filtering.

**Practical notes extraction:** This generator receives pre-extracted `practicalNotes` (from EPIC-45 extractors). If EPIC-45 is not yet implemented, practical notes will be empty and the section will be omitted.

---

**Last Updated:** 2026-03-21
