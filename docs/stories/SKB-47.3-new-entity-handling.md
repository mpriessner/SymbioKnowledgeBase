# Story SKB-47.3: New Entity Handling

**Epic:** Epic 47 - Incremental Sync & Maintenance
**Story ID:** SKB-47.3
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-47.2 (Experiment Update Propagation)

---

## User Story

As a sync system, I want to create new entity pages (Chemical, Reaction Type, Researcher) when they first appear in experiments, So that all wikilinks work and the KB stays complete as new data arrives.

---

## Acceptance Criteria

1. **New Chemical Detection**
   - [ ] Detect when a new CAS number appears in experiment reagents
   - [ ] Check if Chemical page already exists: `/kb/chemistry/chemicals/[CAS].md`
   - [ ] If not exists → create Chemical page with:
     - Chemical name (from reagent data)
     - CAS number
     - "Used In" section (initially just this experiment)
     - Placeholder for structure, properties (to be filled later)
   - [ ] Add wikilink to Chemical in experiment's reagent section

2. **New Reaction Type Detection**
   - [ ] Detect when a new reaction type appears in experiment metadata
   - [ ] Check if Reaction Type page already exists: `/kb/chemistry/reactions/[type].md`
   - [ ] If not exists → create Reaction Type page with:
     - Reaction name
     - Placeholder overview (to be filled manually or from ChemELN)
     - Experiments section (initially just this experiment)
     - "Key Learnings" section (empty initially)
     - "Who To Ask" section (just the first researcher)
   - [ ] Add Reaction Type to Chemistry KB Index

3. **New Researcher Detection**
   - [ ] Detect when a new researcher appears in experiment metadata
   - [ ] Check if Researcher profile exists: `/kb/chemistry/researchers/[name].md`
   - [ ] If not exists → create Researcher profile with:
     - Name
     - Total experiments: 1 (this experiment)
     - Expertise areas: [this reaction type]
     - Most recent experiment: this experiment
     - Avg yield: yield of this experiment
   - [ ] Add Researcher to Researcher Directory

4. **Atomic Page Creation**
   - [ ] Create pages BEFORE referencing them in other pages (avoid broken wikilinks)
   - [ ] Order of creation:
     1. Chemical pages (referenced by experiment pages)
     2. Reaction Type pages (referenced by experiment pages and index)
     3. Researcher pages (referenced by experiment pages and reaction type pages)
     4. Experiment pages (reference all of the above)
   - [ ] If page creation fails → queue for retry, don't proceed with referencing pages

5. **Retry Queue**
   - [ ] If page creation fails (e.g., filesystem error):
     - Add to retry queue: `.sync-state/retry-queue.json`
     - Log error
     - Don't fail entire sync
   - [ ] On next sync, attempt to create queued pages before processing new changes
   - [ ] Max retries: 3 per page
   - [ ] After 3 failures, log critical error and notify admin

6. **Wikilink Consistency**
   - [ ] All entity references use wikilink format: `[[Entity Name]]`
   - [ ] Entity names normalized: spaces → hyphens, special chars removed
   - [ ] Wikilink targets verified: page exists before creating wikilink
   - [ ] Broken link detection: Scan all pages after sync, log any broken wikilinks

7. **Index Updates**
   - [ ] When new Reaction Type created → update Chemistry KB Index with link
   - [ ] When new Researcher created → update Researcher Directory with link
   - [ ] When new Chemical created → update Chemical Index (if exists)
   - [ ] Index updates batched: if 10 new reaction types, update index once with all 10

8. **Edge Cases**
   - [ ] Duplicate CAS numbers (same chemical, different names) → merge into single Chemical page, use canonical name
   - [ ] Missing CAS numbers → use chemical name as fallback identifier
   - [ ] Special characters in names → sanitize for filesystem (replace `/`, `\`, `:`, etc.)

---

## Technical Implementation Notes

### New Entity Creator

**File: `scripts/sync-chemeln/create-entity-pages.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ExperimentData } from './chemeln-api';

export class EntityPageCreator {
  private kbDir: string;
  private retryQueue: Set<{ type: string; id: string; data: any }> = new Set();

  constructor(kbDir: string) {
    this.kbDir = kbDir;
  }

  async createChemicalPageIfNeeded(
    cas: string,
    chemicalName: string,
    experimentId: string,
  ): Promise<boolean> {
    const pagePath = path.join(
      this.kbDir,
      'chemistry/chemicals',
      `${this.sanitizeFilename(cas)}.md`,
    );

    // Check if page exists
    try {
      await fs.access(pagePath);
      console.log(`  Chemical page already exists: ${cas}`);
      return false; // Page already exists
    } catch {
      // Page doesn't exist — create it
    }

    const content = `---
type: chemical
cas: ${cas}
name: ${chemicalName}
updated: ${new Date().toISOString().split('T')[0]}
---

# ${chemicalName}

**CAS Number:** ${cas}

## Used In

- [[${experimentId}]]

## Properties

*Properties to be added from ChemELN or chemical databases*

## Safety Information

*Safety information to be added*

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;

    try {
      await fs.mkdir(path.dirname(pagePath), { recursive: true });
      await fs.writeFile(pagePath, content, 'utf-8');
      console.log(`  ✓ Created Chemical page: ${cas}`);
      return true;
    } catch (err) {
      console.error(`  ✗ Failed to create Chemical page: ${cas}`, err);
      this.retryQueue.add({ type: 'chemical', id: cas, data: { chemicalName, experimentId } });
      return false;
    }
  }

  async createReactionTypePageIfNeeded(
    reactionType: string,
    experimentId: string,
    researcher: string,
  ): Promise<boolean> {
    const pagePath = path.join(
      this.kbDir,
      'chemistry/reactions',
      `${this.sanitizeFilename(reactionType)}.md`,
    );

    try {
      await fs.access(pagePath);
      console.log(`  Reaction Type page already exists: ${reactionType}`);
      return false;
    } catch {
      // Page doesn't exist
    }

    const content = `---
type: reaction-type
reaction: ${reactionType.toLowerCase().replace(/\s+/g, '-')}
updated: ${new Date().toISOString().split('T')[0]}
---

# ${reactionType}

## Overview

*Overview to be added from ChemELN or manually*

## Key Learnings

*Key learnings to be added as more experiments are synced*

## Who To Ask

- [[${researcher}]] — 1 experiment

## Experiments

- [[${experimentId}]]

**Total Experiments:** 1

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;

    try {
      await fs.mkdir(path.dirname(pagePath), { recursive: true });
      await fs.writeFile(pagePath, content, 'utf-8');
      console.log(`  ✓ Created Reaction Type page: ${reactionType}`);
      return true;
    } catch (err) {
      console.error(`  ✗ Failed to create Reaction Type page: ${reactionType}`, err);
      this.retryQueue.add({ type: 'reaction-type', id: reactionType, data: { experimentId, researcher } });
      return false;
    }
  }

  async createResearcherPageIfNeeded(
    researcher: string,
    experimentId: string,
    reactionType: string,
    yield_: number,
  ): Promise<boolean> {
    const pagePath = path.join(
      this.kbDir,
      'chemistry/researchers',
      `${this.sanitizeFilename(researcher)}.md`,
    );

    try {
      await fs.access(pagePath);
      console.log(`  Researcher page already exists: ${researcher}`);
      return false;
    } catch {
      // Page doesn't exist
    }

    const content = `---
type: researcher
name: ${researcher}
updated: ${new Date().toISOString().split('T')[0]}
---

# ${researcher}

## Expertise Summary

- **Total Experiments:** 1
- **Specialization:** ${reactionType}
- **Avg Yield (All Reactions):** ${yield_}%

## Expertise by Reaction Type

1. **${reactionType}:** 1 experiment, avg yield ${yield_}%

## Recent Experiments

- [[${experimentId}]] (${new Date().toISOString().split('T')[0]})

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;

    try {
      await fs.mkdir(path.dirname(pagePath), { recursive: true });
      await fs.writeFile(pagePath, content, 'utf-8');
      console.log(`  ✓ Created Researcher page: ${researcher}`);
      return true;
    } catch (err) {
      console.error(`  ✗ Failed to create Researcher page: ${researcher}`, err);
      this.retryQueue.add({ type: 'researcher', id: researcher, data: { experimentId, reactionType, yield_ } });
      return false;
    }
  }

  async processNewExperiment(exp: ExperimentData): Promise<void> {
    console.log(`Processing new experiment: ${exp.id}`);

    // 1. Create Chemical pages (before experiment page references them)
    for (const reagent of exp.reagents) {
      if (reagent.cas) {
        await this.createChemicalPageIfNeeded(reagent.cas, reagent.chemical_name, exp.id);
      }
    }

    // 2. Create Reaction Type page (before experiment page references it)
    await this.createReactionTypePageIfNeeded(exp.reaction_type, exp.id, exp.researcher);

    // 3. Create Researcher page (before reaction type page references it)
    await this.createResearcherPageIfNeeded(
      exp.researcher,
      exp.id,
      exp.reaction_type,
      exp.yield || 0,
    );
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[\/\\:*?"<>|]/g, '-') // Replace invalid filesystem chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Remove duplicate hyphens
      .trim();
  }

  async processRetryQueue(): Promise<void> {
    if (this.retryQueue.size === 0) return;

    console.log(`Processing retry queue: ${this.retryQueue.size} items`);

    for (const item of this.retryQueue) {
      if (item.type === 'chemical') {
        const success = await this.createChemicalPageIfNeeded(
          item.id,
          item.data.chemicalName,
          item.data.experimentId,
        );
        if (success) this.retryQueue.delete(item);
      } else if (item.type === 'reaction-type') {
        const success = await this.createReactionTypePageIfNeeded(
          item.id,
          item.data.experimentId,
          item.data.researcher,
        );
        if (success) this.retryQueue.delete(item);
      } else if (item.type === 'researcher') {
        const success = await this.createResearcherPageIfNeeded(
          item.id,
          item.data.experimentId,
          item.data.reactionType,
          item.data.yield_,
        );
        if (success) this.retryQueue.delete(item);
      }
    }

    console.log(`Retry queue after processing: ${this.retryQueue.size} items remaining`);
  }
}
```

---

## Test Scenarios

### Integration Test: `tests/sync-chemeln/create-entity-pages.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EntityPageCreator } from '@/scripts/sync-chemeln/create-entity-pages';
import fs from 'fs/promises';
import path from 'path';

describe('EntityPageCreator', () => {
  const testKbDir = '/tmp/test-kb';
  let creator: EntityPageCreator;

  beforeEach(async () => {
    await fs.mkdir(path.join(testKbDir, 'chemistry/chemicals'), { recursive: true });
    creator = new EntityPageCreator(testKbDir);
  });

  it('should create Chemical page for new CAS number', async () => {
    const created = await creator.createChemicalPageIfNeeded(
      '1111-11-1',
      'Test Chemical A',
      'EXP-2026-0042',
    );

    expect(created).toBe(true);

    const content = await fs.readFile(
      path.join(testKbDir, 'chemistry/chemicals/1111-11-1.md'),
      'utf-8',
    );
    expect(content).toContain('# Test Chemical A');
    expect(content).toContain('CAS Number:** 1111-11-1');
    expect(content).toContain('[[EXP-2026-0042]]');
  });

  it('should not recreate existing Chemical page', async () => {
    await creator.createChemicalPageIfNeeded('1111-11-1', 'Test Chemical A', 'EXP-2026-0042');
    const created = await creator.createChemicalPageIfNeeded(
      '1111-11-1',
      'Test Chemical A',
      'EXP-2026-0043',
    );

    expect(created).toBe(false);
  });

  it('should create Reaction Type page for new reaction', async () => {
    const created = await creator.createReactionTypePageIfNeeded(
      'Suzuki-Coupling',
      'EXP-2026-0042',
      'Dr. Mueller',
    );

    expect(created).toBe(true);

    const content = await fs.readFile(
      path.join(testKbDir, 'chemistry/reactions/Suzuki-Coupling.md'),
      'utf-8',
    );
    expect(content).toContain('# Suzuki-Coupling');
    expect(content).toContain('[[Dr. Mueller]]');
    expect(content).toContain('[[EXP-2026-0042]]');
  });
});
```

---

## Dependencies

- **SKB-47.2:** Experiment Update Propagation (new entities appear during experiment sync)

---

## Dev Notes

### Entity Creation Order

1. Chemicals (no dependencies)
2. Reaction Types (no dependencies)
3. Researchers (no dependencies)
4. Experiments (depend on all of the above)

### Retry Strategy

- Retry queue persisted to disk: `.sync-state/retry-queue.json`
- Process retry queue BEFORE processing new changes
- Max 3 retries per page (avoid infinite retry loops)

---

**Last Updated:** 2026-03-21
