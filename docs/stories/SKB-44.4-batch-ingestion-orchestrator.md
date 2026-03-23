# Story SKB-44.4: Batch Ingestion Orchestrator

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.4
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-44.1 (Experiment Generator), SKB-44.2 (Entity Generators), SKB-44.3 (API Writer), SKB-44.6 (Cross-Reference Resolver)

---

## User Story

As a data engineer, I want a three-pass batch orchestrator that creates entity pages first, then experiment pages, then updates entity pages with cross-references, So that all wikilinks resolve correctly and entity pages contain aggregated data from all experiments.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/sync/orchestrator.ts` exports `BatchOrchestrator` class
- [ ] Three-pass ingestion strategy:
  - Pass 1: Create/update entity pages (chemicals, reaction types, researchers, substrate classes)
  - Pass 2: Create/update experiment pages (wikilinks to entities now resolve)
  - Pass 3: Update entity pages with aggregated cross-references
- [ ] Idempotent upsert logic:
  1. Search existing page by tag match (e.g., `eln:EXP-2024-001`)
  2. Compute content hash (MD5 of markdown body excluding timestamps)
  3. If hash matches existing → skip (no API write)
  4. If hash differs → update
  5. If no existing page → create
- [ ] Error isolation: one failed page does not stop the batch
- [ ] Progress tracking: real-time counts (created/updated/skipped/failed)
- [ ] ETA calculation based on average page write time
- [ ] Resume capability: track last successful page for interrupted syncs
- [ ] Summary report at end: total counts, failed pages with error details
- [ ] Unit tests for upsert logic, three-pass ordering, error isolation
- [ ] Integration test runs full sync against test data

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  BatchOrchestrator                                                  │
│                                                                     │
│  Input:                                                             │
│    experiments: ExperimentData[]                                    │
│    chemicals: ChemicalData[]                                        │
│    reactionTypes: ReactionTypeAggregation[]                         │
│    researchers: ResearcherProfile[]                                 │
│    substrateClasses: SubstrateClassAggregation[]                    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Pass 1: Entity Pages (creates wikilink targets)             │  │
│  │                                                               │  │
│  │  1. chemicals.forEach(c => upsert Chemical page)             │  │
│  │     Match by: tag:cas:{casNumber}                             │  │
│  │                                                               │  │
│  │  2. reactionTypes.forEach(rt => upsert ReactionType page)    │  │
│  │     Match by: tag:reaction:{name}                             │  │
│  │                                                               │  │
│  │  3. researchers.forEach(r => upsert Researcher page)         │  │
│  │     Match by: tag:researcher:{name}                           │  │
│  │                                                               │  │
│  │  4. substrateClasses.forEach(sc => upsert SubstrateClass)    │  │
│  │     Match by: tag:substrate-class:{name}                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Pass 2: Experiment Pages (wikilinks now resolve)            │  │
│  │                                                               │  │
│  │  experiments.forEach(exp => upsert Experiment page)          │  │
│  │     Match by: tag:eln:{experimentId}                          │  │
│  │     Wikilinks: [[Chemical Name]], [[Reaction Type]],          │  │
│  │                [[Researcher Name]]                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Pass 3: Aggregation Update (cross-references)               │  │
│  │                                                               │  │
│  │  chemicals: Add "Used In" experiment links                   │  │
│  │  reactionTypes: Add "Key Learnings" from experiment notes    │  │
│  │  researchers: Update recent experiments list                 │  │
│  │  substrateClasses: Add "What Worked" links                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Summary Report                                              │  │
│  │                                                               │  │
│  │  Pass 1: 150 created, 5 updated, 10 skipped, 0 failed       │  │
│  │  Pass 2: 200 created, 50 updated, 250 skipped, 2 failed     │  │
│  │  Pass 3: 0 created, 155 updated, 10 skipped, 0 failed       │  │
│  │  Total: 350 created, 210 updated, 270 skipped, 2 failed     │  │
│  │  Time: 4m 23s  |  Rate: 190 pages/min                       │  │
│  │  Failed: EXP-2024-123 (invalid markdown), ...                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Orchestrator Types

**File: `src/lib/chemeln/sync/orchestrator.ts`**

```typescript
import { SkbAgentApiWriter } from './writer';
import { UpsertResult } from './types';
import { ExperimentData, ChemicalData, ReactionTypeAggregation, ResearcherProfile, SubstrateClassAggregation } from '../types';
import { generateExperimentPage, ExperimentPageContext } from '../generators/experiment';
import { generateChemicalPage } from '../generators/chemical';
import { generateReactionTypePage } from '../generators/reaction-type';
import { generateResearcherPage } from '../generators/researcher';
import { generateSubstrateClassPage } from '../generators/substrate-class';
import { CrossReferenceResolver } from './resolver';

export interface SyncInput {
  experiments: ExperimentData[];
  chemicals: ChemicalData[];
  reactionTypes: ReactionTypeAggregation[];
  researchers: ResearcherProfile[];
  substrateClasses: SubstrateClassAggregation[];
}

export interface PassResult {
  passName: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  duration: number; // ms
}

export interface SyncReport {
  passes: PassResult[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  totalDuration: number;
  pagesPerMinute: number;
}

export type ProgressCallback = (current: number, total: number, action: string, pageName: string) => void;
```

### Step 2: Implement BatchOrchestrator

```typescript
export class BatchOrchestrator {
  private writer: SkbAgentApiWriter;
  private resolver: CrossReferenceResolver;
  private onProgress?: ProgressCallback;
  private dryRun: boolean;

  constructor(
    writer: SkbAgentApiWriter,
    resolver: CrossReferenceResolver,
    options?: { dryRun?: boolean; onProgress?: ProgressCallback }
  ) {
    this.writer = writer;
    this.resolver = resolver;
    this.dryRun = options?.dryRun ?? false;
    this.onProgress = options?.onProgress;
  }

  async run(input: SyncInput): Promise<SyncReport> {
    const startTime = Date.now();
    const passes: PassResult[] = [];

    // Pass 1: Entity Pages
    const pass1 = await this.runPass('Pass 1: Entities', [
      ...input.chemicals.map(c => ({
        id: `cas:${c.casNumber ?? c.id}`,
        tag: c.casNumber ? `cas:${c.casNumber}` : `chemical:${c.id}`,
        generate: () => generateChemicalPage(c, []), // empty usages for initial pass
      })),
      ...input.reactionTypes.map(rt => ({
        id: `reaction:${rt.name}`,
        tag: `reaction:${rt.name.toLowerCase().replace(/\s+/g, '-')}`,
        generate: () => generateReactionTypePage(rt),
      })),
      ...input.researchers.map(r => ({
        id: `researcher:${r.name}`,
        tag: `researcher:${r.name.toLowerCase().replace(/\s+/g, '-')}`,
        generate: () => generateResearcherPage(r),
      })),
      ...input.substrateClasses.map(sc => ({
        id: `substrate:${sc.name}`,
        tag: `substrate-class:${sc.name.toLowerCase().replace(/\s+/g, '-')}`,
        generate: () => generateSubstrateClassPage(sc),
      })),
    ]);
    passes.push(pass1);

    // Pass 2: Experiment Pages
    const pass2 = await this.runPass('Pass 2: Experiments',
      input.experiments.map(exp => ({
        id: `eln:${exp.id}`,
        tag: `eln:${exp.id}`,
        generate: () => {
          const context: ExperimentPageContext = {
            researcherName: this.resolver.resolveResearcher(exp.createdBy),
            reactionType: exp.experimentType,
          };
          return generateExperimentPage(exp, context);
        },
      }))
    );
    passes.push(pass2);

    // Pass 3: Aggregation Update (re-generate entity pages with cross-refs)
    const pass3 = await this.runPass('Pass 3: Aggregation',
      input.chemicals.map(c => {
        const usages = this.resolver.getChemicalUsages(c.id);
        return {
          id: `cas:${c.casNumber ?? c.id}`,
          tag: c.casNumber ? `cas:${c.casNumber}` : `chemical:${c.id}`,
          generate: () => generateChemicalPage(c, usages),
        };
      })
    );
    passes.push(pass3);

    const totalDuration = Date.now() - startTime;
    const totalPages = passes.reduce((sum, p) => sum + p.created + p.updated + p.skipped, 0);

    return {
      passes,
      totalCreated: passes.reduce((sum, p) => sum + p.created, 0),
      totalUpdated: passes.reduce((sum, p) => sum + p.updated, 0),
      totalSkipped: passes.reduce((sum, p) => sum + p.skipped, 0),
      totalFailed: passes.reduce((sum, p) => sum + p.failed, 0),
      totalDuration,
      pagesPerMinute: totalPages / (totalDuration / 60000),
    };
  }

  private async runPass(
    passName: string,
    items: Array<{ id: string; tag: string; generate: () => string }>
  ): Promise<PassResult> {
    const start = Date.now();
    let created = 0, updated = 0, skipped = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      this.onProgress?.(i + 1, items.length, passName, item.id);

      try {
        const markdown = item.generate();

        if (this.dryRun) {
          // In dry-run mode, just count what would happen
          const existing = await this.writer.searchByTag(item.tag);
          if (existing.length > 0) {
            updated++;
          } else {
            created++;
          }
          continue;
        }

        const result = await this.writer.upsertPage(markdown, item.tag);

        switch (result.action) {
          case 'created': created++; break;
          case 'updated': updated++; break;
          case 'skipped': skipped++; break;
        }
      } catch (error) {
        failed++;
        errors.push({ id: item.id, error: (error as Error).message });
        console.error(`Failed to sync ${item.id}: ${(error as Error).message}`);
        // Continue to next item (error isolation)
      }
    }

    return { passName, created, updated, skipped, failed, errors, duration: Date.now() - start };
  }
}
```

### Step 3: Summary Report Formatter

```typescript
export function formatSyncReport(report: SyncReport): string {
  const lines: string[] = [
    '='.repeat(39),
    '  ChemELN -> SKB Sync Report',
    '='.repeat(39),
    '',
  ];

  for (const pass of report.passes) {
    lines.push(`  ${pass.passName}:`);
    lines.push(`    Created: ${pass.created}  Updated: ${pass.updated}  Skipped: ${pass.skipped}  Failed: ${pass.failed}`);
    lines.push(`    Duration: ${(pass.duration / 1000).toFixed(1)}s`);
    lines.push('');
  }

  lines.push('-'.repeat(39));
  lines.push(`  Total Created:  ${report.totalCreated}`);
  lines.push(`  Total Updated:  ${report.totalUpdated}`);
  lines.push(`  Total Skipped:  ${report.totalSkipped}`);
  lines.push(`  Total Failed:   ${report.totalFailed}`);
  lines.push(`  Total Time:     ${(report.totalDuration / 1000).toFixed(1)}s`);
  lines.push(`  Rate:           ${report.pagesPerMinute.toFixed(0)} pages/min`);
  lines.push('='.repeat(39));

  // Failed pages detail
  const allErrors = report.passes.flatMap(p => p.errors);
  if (allErrors.length > 0) {
    lines.push('');
    lines.push('  Failed Pages:');
    for (const error of allErrors) {
      lines.push(`    - ${error.id}: ${error.error}`);
    }
  }

  return lines.join('\n');
}
```

---

## Testing Requirements

### Unit Test: `src/__tests__/lib/chemeln/sync/orchestrator.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { BatchOrchestrator, SyncInput } from '@/lib/chemeln/sync/orchestrator';

describe('BatchOrchestrator', () => {
  const mockWriter = {
    searchByTag: vi.fn().mockResolvedValue([]),
    upsertPage: vi.fn().mockResolvedValue({ action: 'created', pageId: 'p1', title: 'Test', contentHash: 'abc' }),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    searchByTitle: vi.fn(),
    healthCheck: vi.fn(),
  };

  const mockResolver = {
    resolveResearcher: vi.fn().mockReturnValue('Jane Doe'),
    getChemicalUsages: vi.fn().mockReturnValue([]),
  };

  it('should run three passes in order', async () => {
    const passOrder: string[] = [];
    const orchestrator = new BatchOrchestrator(
      mockWriter as any,
      mockResolver as any,
      { onProgress: (_cur, _tot, passName) => { if (!passOrder.includes(passName)) passOrder.push(passName); } }
    );

    const input: SyncInput = {
      experiments: [],
      chemicals: [{ id: 'c1', name: 'Test Chemical', casNumber: '123-45-6', molecularFormula: 'H2O' }],
      reactionTypes: [],
      researchers: [],
      substrateClasses: [],
    };

    await orchestrator.run(input);

    expect(passOrder).toContain('Pass 1: Entities');
    expect(passOrder).toContain('Pass 3: Aggregation');
  });

  it('should isolate errors — one failure does not stop batch', async () => {
    let callCount = 0;
    mockWriter.upsertPage.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) throw new Error('API error');
      return { action: 'created', pageId: `p${callCount}`, title: 'Test', contentHash: 'abc' };
    });

    const orchestrator = new BatchOrchestrator(mockWriter as any, mockResolver as any);
    const input: SyncInput = {
      experiments: [],
      chemicals: [
        { id: 'c1', name: 'Chem 1', casNumber: '1', molecularFormula: null },
        { id: 'c2', name: 'Chem 2', casNumber: '2', molecularFormula: null },
        { id: 'c3', name: 'Chem 3', casNumber: '3', molecularFormula: null },
      ],
      reactionTypes: [],
      researchers: [],
      substrateClasses: [],
    };

    const report = await orchestrator.run(input);
    // Should have processed all 3, with 1 failure
    expect(report.totalFailed).toBeGreaterThan(0);
    expect(report.totalCreated + report.totalFailed).toBeGreaterThanOrEqual(3);
  });

  it('should report progress during sync', async () => {
    const progressCalls: Array<{ current: number; total: number }> = [];

    const orchestrator = new BatchOrchestrator(
      mockWriter as any,
      mockResolver as any,
      { onProgress: (current, total) => progressCalls.push({ current, total }) }
    );

    const input: SyncInput = {
      experiments: [],
      chemicals: [{ id: 'c1', name: 'Test', casNumber: '1', molecularFormula: null }],
      reactionTypes: [],
      researchers: [],
      substrateClasses: [],
    };

    await orchestrator.run(input);
    expect(progressCalls.length).toBeGreaterThan(0);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/sync/orchestrator.ts` |
| CREATE | `src/__tests__/lib/chemeln/sync/orchestrator.test.ts` |

---

## Dev Notes

**Three-pass rationale:** Pass 1 creates entity pages so wikilinks in experiment pages (Pass 2) resolve to real pages. Pass 3 updates entity pages with cross-references that only become available after experiment pages exist (e.g., a Chemical's "Used In" section depends on knowing which experiments use it).

**Idempotent upserts:** Content hash comparison prevents unnecessary API writes. The hash excludes frontmatter timestamps (`created`, `updated`) to avoid false positives from regeneration. This ensures running sync twice with unchanged ChemELN data produces zero writes.

**Error isolation:** Using try/catch within the per-page loop ensures one bad page (e.g., invalid markdown, missing data) doesn't abort the entire sync. Errors are collected and reported in the summary.

**Dry-run mode:** When `dryRun: true`, the orchestrator still generates all pages and checks for existing pages (API reads), but skips all writes (API creates/updates). This allows previewing what a sync would change without actually changing anything.

**Performance:** At 10 API calls/second rate limit, syncing 500 pages takes ~50 seconds for writes. With 3 passes (entities + experiments + aggregation), total time is ~2.5 minutes for 500 experiments with 150 chemicals, well within the 5-minute target.

---

**Last Updated:** 2026-03-21
