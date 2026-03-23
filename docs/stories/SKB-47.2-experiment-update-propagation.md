# Story SKB-47.2: Experiment Update Propagation

**Epic:** Epic 47 - Incremental Sync & Maintenance
**Story ID:** SKB-47.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-47.1 (Change Detection)

---

## User Story

As a sync system, I want to propagate experiment updates to all affected KB pages (Chemical pages, Reaction Type pages, Researcher profiles), So that the KB stays consistent when experiments change in ChemELN.

---

## Acceptance Criteria

1. **Update Propagation Workflow**
   - [ ] When experiment is updated:
     1. Re-generate experiment page (new content hash)
     2. Check if reagents changed → update affected Chemical pages
     3. Check if reaction type changed → update old AND new Reaction Type pages
     4. Check if researcher changed → update old AND new Researcher profiles
     5. Re-compute quality score
     6. Only write pages if content hash changed

2. **Reagent Change Detection**
   - [ ] Compare `old_experiment.reagents` vs `new_experiment.reagents`
   - [ ] Detect changes:
     - Reagent added (new CAS number)
     - Reagent removed (CAS no longer in list)
     - Reagent amount/role changed
   - [ ] Update affected Chemical pages:
     - Add experiment to "Used In" section if reagent added
     - Remove experiment from "Used In" section if reagent removed
     - Update usage count

3. **Reaction Type Change Detection**
   - [ ] Compare `old_experiment.reaction_type` vs `new_experiment.reaction_type`
   - [ ] If changed:
     - Update OLD Reaction Type page: remove experiment from list, recompute avg yield
     - Update NEW Reaction Type page: add experiment to list, recompute avg yield
     - Update both "Key Learnings" sections (re-rank)
     - Update both "Who To Ask" sections (re-rank researchers)

4. **Researcher Change Detection**
   - [ ] Compare `old_experiment.researcher` vs `new_experiment.researcher`
   - [ ] If changed:
     - Update OLD Researcher profile: remove experiment, recompute avg yields, update expertise areas
     - Update NEW Researcher profile: add experiment, recompute avg yields, update expertise areas

5. **Quality Score Recomputation**
   - [ ] Formula: `(yield / 100) × 0.5 + (completeness_score / 100) × 0.3 + (recency_score / 100) × 0.2`
   - [ ] Recalculate on every update (yield may have changed)
   - [ ] Update ranking on Reaction Type pages if quality score changed significantly (> 5% delta)

6. **Content Hash Comparison**
   - [ ] Before writing any page, calculate new content hash
   - [ ] Compare with sync state `contentHash`
   - [ ] Only write if hash differs (minimize disk I/O and git churn)
   - [ ] Update sync state with new hash

7. **Cascading Update Tracking**
   - [ ] Track which pages need updates: `Set<string>` of page paths
   - [ ] Avoid infinite loops: Don't re-update pages already visited in this sync run
   - [ ] Log all cascading updates: "Experiment EXP-2026-0042 changed → updating Chemical [[Pd(PPh3)4]], Reaction Type [[Suzuki-Coupling]], Researcher [[Dr. Mueller]]"

8. **Transactional Updates**
   - [ ] If any update fails (e.g., ChemELN API error during re-fetch):
     - Rollback all changes (restore pages from backup)
     - Don't update sync state
     - Log error and return failure status
   - [ ] If all updates succeed:
     - Commit all page writes
     - Update sync state
     - Return success status

9. **Batch Updates**
   - [ ] If multiple experiments changed, collect all affected pages
   - [ ] Update each affected page only once (e.g., if 3 experiments use Pd(PPh3)4, update Chemical page once with all 3 changes)
   - [ ] Order of updates: Experiments → Chemicals → Reaction Types → Researchers → Index

---

## Technical Implementation Notes

### Update Propagation Handler

**File: `scripts/sync-chemeln/propagate-updates.ts`**

```typescript
import { SyncStateManager } from './sync-state-manager';
import { ExperimentData } from './chemeln-api';
import { generateExperimentPage } from './generate-experiment-page';
import { generateChemicalPage } from './generate-chemical-page';
import { generateReactionTypePage } from './generate-reaction-type-page';
import { generateResearcherPage } from './generate-researcher-page';

export class UpdatePropagator {
  private affectedPages: Set<string> = new Set();
  private stateManager: SyncStateManager;
  private kbDir: string;

  constructor(stateManager: SyncStateManager, kbDir: string) {
    this.stateManager = stateManager;
    this.kbDir = kbDir;
  }

  async propagateExperimentUpdate(
    oldExp: ExperimentData | null,
    newExp: ExperimentData,
  ): Promise<void> {
    console.log(`Propagating update for ${newExp.id}`);

    // 1. Re-generate experiment page
    const expPageContent = await generateExperimentPage(newExp, this.kbDir);
    const expPagePath = `/kb/chemistry/experiments/${newExp.id}.md`;
    await this.writePageIfChanged(expPagePath, expPageContent);

    if (!oldExp) {
      // New experiment — no cascading updates needed beyond experiment page
      return;
    }

    // 2. Detect reagent changes
    await this.propagateReagentChanges(oldExp, newExp);

    // 3. Detect reaction type change
    if (oldExp.reaction_type !== newExp.reaction_type) {
      await this.propagateReactionTypeChange(oldExp, newExp);
    }

    // 4. Detect researcher change
    if (oldExp.researcher !== newExp.researcher) {
      await this.propagateResearcherChange(oldExp, newExp);
    }

    // 5. Update quality score (affects ranking on Reaction Type page)
    await this.updateReactionTypeRanking(newExp);

    console.log(`Affected pages: ${Array.from(this.affectedPages).join(', ')}`);
  }

  private async propagateReagentChanges(oldExp: ExperimentData, newExp: ExperimentData) {
    const oldReagents = new Set(oldExp.reagents.map((r) => r.cas));
    const newReagents = new Set(newExp.reagents.map((r) => r.cas));

    // Detect added reagents
    for (const cas of newReagents) {
      if (!oldReagents.has(cas)) {
        console.log(`  Reagent added: ${cas} — updating Chemical page`);
        await this.updateChemicalPage(cas, 'add', newExp);
      }
    }

    // Detect removed reagents
    for (const cas of oldReagents) {
      if (!newReagents.has(cas)) {
        console.log(`  Reagent removed: ${cas} — updating Chemical page`);
        await this.updateChemicalPage(cas, 'remove', oldExp);
      }
    }
  }

  private async propagateReactionTypeChange(oldExp: ExperimentData, newExp: ExperimentData) {
    console.log(
      `  Reaction type changed: ${oldExp.reaction_type} → ${newExp.reaction_type}`,
    );

    // Update old reaction type page (remove experiment)
    await this.updateReactionTypePage(oldExp.reaction_type, 'remove', oldExp);

    // Update new reaction type page (add experiment)
    await this.updateReactionTypePage(newExp.reaction_type, 'add', newExp);
  }

  private async propagateResearcherChange(oldExp: ExperimentData, newExp: ExperimentData) {
    console.log(`  Researcher changed: ${oldExp.researcher} → ${newExp.researcher}`);

    // Update old researcher profile (remove experiment)
    await this.updateResearcherPage(oldExp.researcher, 'remove', oldExp);

    // Update new researcher profile (add experiment)
    await this.updateResearcherPage(newExp.researcher, 'add', newExp);
  }

  private async updateChemicalPage(
    cas: string,
    action: 'add' | 'remove',
    exp: ExperimentData,
  ) {
    const pagePath = `/kb/chemistry/chemicals/${cas.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    if (this.affectedPages.has(pagePath)) {
      console.log(`  Skipping ${pagePath} — already updated in this sync`);
      return;
    }

    // Re-generate Chemical page
    const content = await generateChemicalPage(cas, this.kbDir);
    await this.writePageIfChanged(pagePath, content);
    this.affectedPages.add(pagePath);
  }

  private async updateReactionTypePage(
    reactionType: string,
    action: 'add' | 'remove',
    exp: ExperimentData,
  ) {
    const pagePath = `/kb/chemistry/reactions/${reactionType.replace(/\s+/g, '-')}.md`;
    if (this.affectedPages.has(pagePath)) {
      console.log(`  Skipping ${pagePath} — already updated in this sync`);
      return;
    }

    // Re-generate Reaction Type page (aggregates all experiments of this type)
    const content = await generateReactionTypePage(reactionType, this.kbDir);
    await this.writePageIfChanged(pagePath, content);
    this.affectedPages.add(pagePath);
  }

  private async updateResearcherPage(
    researcher: string,
    action: 'add' | 'remove',
    exp: ExperimentData,
  ) {
    const pagePath = `/kb/chemistry/researchers/${researcher.replace(/\s+/g, '-')}.md`;
    if (this.affectedPages.has(pagePath)) {
      console.log(`  Skipping ${pagePath} — already updated in this sync`);
      return;
    }

    // Re-generate Researcher page
    const content = await generateResearcherPage(researcher, this.kbDir);
    await this.writePageIfChanged(pagePath, content);
    this.affectedPages.add(pagePath);
  }

  private async updateReactionTypeRanking(exp: ExperimentData) {
    // Quality score may have changed — re-rank experiments on Reaction Type page
    const reactionType = exp.reaction_type;
    const pagePath = `/kb/chemistry/reactions/${reactionType.replace(/\s+/g, '-')}.md`;

    // Re-generate page (will re-compute rankings)
    await this.updateReactionTypePage(reactionType, 'add', exp);
  }

  private async writePageIfChanged(pagePath: string, content: string): Promise<boolean> {
    const fullPath = path.join(this.kbDir, pagePath);
    const newHash = this.stateManager.calculateContentHash(content);

    // Check if page exists and hash matches
    try {
      const existingContent = await fs.readFile(fullPath, 'utf-8');
      const existingHash = this.stateManager.calculateContentHash(existingContent);

      if (existingHash === newHash) {
        console.log(`  Skipping ${pagePath} — content unchanged`);
        return false;
      }
    } catch (err) {
      // Page doesn't exist — write it
    }

    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(`  ✓ Updated ${pagePath}`);
    return true;
  }

  getAffectedPages(): string[] {
    return Array.from(this.affectedPages);
  }

  reset() {
    this.affectedPages.clear();
  }
}
```

---

## Test Scenarios

### Integration Test: `tests/sync-chemeln/propagate-updates.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UpdatePropagator } from '@/scripts/sync-chemeln/propagate-updates';
import { SyncStateManager } from '@/scripts/sync-chemeln/sync-state-manager';
import fs from 'fs/promises';

describe('UpdatePropagator', () => {
  let propagator: UpdatePropagator;
  const testKbDir = '/tmp/test-kb';

  beforeEach(async () => {
    const stateManager = new SyncStateManager(testKbDir);
    propagator = new UpdatePropagator(stateManager, testKbDir);
    propagator.reset();
  });

  it('should update Chemical page when reagent added', async () => {
    const oldExp = {
      id: 'EXP-2026-0042',
      reaction_type: 'Suzuki-Coupling',
      researcher: 'Dr. Mueller',
      reagents: [{ cas: '1111-11-1', chemical_name: 'A', role: 'substrate', amount: 5, amount_unit: 'mmol' }],
    };

    const newExp = {
      ...oldExp,
      reagents: [
        ...oldExp.reagents,
        { cas: '2222-22-2', chemical_name: 'B', role: 'catalyst', amount: 0.5, amount_unit: 'mmol' },
      ],
    };

    await propagator.propagateExperimentUpdate(oldExp, newExp);

    const affected = propagator.getAffectedPages();
    expect(affected.some((p) => p.includes('chemicals/2222-22-2'))).toBe(true);
  });

  it('should update both Reaction Type pages when reaction type changes', async () => {
    const oldExp = {
      id: 'EXP-2026-0042',
      reaction_type: 'Suzuki-Coupling',
      researcher: 'Dr. Mueller',
      reagents: [],
    };

    const newExp = {
      ...oldExp,
      reaction_type: 'Negishi-Coupling',
    };

    await propagator.propagateExperimentUpdate(oldExp, newExp);

    const affected = propagator.getAffectedPages();
    expect(affected.some((p) => p.includes('reactions/Suzuki-Coupling'))).toBe(true);
    expect(affected.some((p) => p.includes('reactions/Negishi-Coupling'))).toBe(true);
  });
});
```

---

## Dependencies

- **SKB-47.1:** Change Detection (must detect which experiments changed)

---

## Dev Notes

### Cascading Update Complexity

- Worst case: 1 experiment update → 10+ page updates (experiment, 5 chemicals, 2 reaction types, 2 researchers)
- Use `affectedPages` set to avoid duplicate updates
- Log all cascading updates for debugging

### Performance Optimization

- Batch updates: If 100 experiments changed, collect all affected pages and update once
- Use content hash comparison to skip unchanged pages
- Consider parallel writes (write 10 pages at once) if I/O is bottleneck

---

**Last Updated:** 2026-03-21
