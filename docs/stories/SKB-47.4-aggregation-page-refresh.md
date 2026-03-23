# Story SKB-47.4: Aggregation Page Refresh

**Epic:** Epic 47 - Incremental Sync & Maintenance
**Story ID:** SKB-47.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-47.3 (New Entity Handling)

---

## User Story

As a sync system, I want to recompute aggregation data on Reaction Type pages, Chemical pages, Researcher profiles, and Substrate Class pages after experiments change, So that all computed statistics (avg yields, experiment counts, rankings) stay accurate.

---

## Acceptance Criteria

1. **Aggregation Targets**
   - [ ] **Reaction Type pages:** Experiment count, avg yield, Key Learnings ranking, "Who To Ask" ranking
   - [ ] **Chemical pages:** "Used In" section, usage count
   - [ ] **Researcher pages:** Experiment count, expertise areas, avg yields per reaction type, most recent experiment
   - [ ] **Substrate Class pages:** Experiment count, "What Worked" section (top experiments by quality)

2. **Reaction Type Aggregation**
   - [ ] Recompute after:
     - New experiment of this type added
     - Existing experiment updated (yield changed, researcher changed)
     - Experiment deleted
   - [ ] Calculations:
     - Experiment count: Count all experiments with `reaction_type = X`
     - Avg yield: Mean of all yields for this reaction type
     - Key Learnings ranking: Sort by `quality_score × contribution_score` (descending)
     - "Who To Ask" ranking: Sort researchers by `experiment_count × avg_yield`

3. **Chemical Page Aggregation**
   - [ ] Recompute after:
     - Experiment added/updated/deleted that uses this chemical
   - [ ] Calculations:
     - "Used In" section: List all experiments that use this chemical (as reagent)
     - Usage count: Count of experiments using this chemical
     - Sort experiments by date (most recent first)

4. **Researcher Page Aggregation**
   - [ ] Recompute after:
     - Researcher's experiment added/updated/deleted
   - [ ] Calculations:
     - Total experiments: Count all experiments by this researcher
     - Expertise areas: Top 3 reaction types by experiment count
     - Avg yield per reaction type: Mean yield for each reaction type
     - Most recent experiment: Latest experiment by date
     - Avg yield (all reactions): Mean of all yields

5. **Substrate Class Page Aggregation**
   - [ ] Recompute after:
     - Experiment with this substrate class added/updated/deleted
   - [ ] Calculations:
     - Experiment count: Count experiments with `substrate-class = X`
     - "What Worked" section: Top 10 experiments by `quality_score` (descending)

6. **Batch Updates**
   - [ ] If multiple experiments changed, collect all affected aggregations
   - [ ] Update each aggregation page only once per sync
   - [ ] Example: If 5 Suzuki experiments changed → update Suzuki-Coupling page once with all changes
   - [ ] Track affected aggregations: `Map<pagePath, reason[]>`

7. **Content Hash Comparison**
   - [ ] Before writing aggregation page, calculate new content hash
   - [ ] Compare with current page hash
   - [ ] Only write if hash differs (minimize disk I/O)
   - [ ] Log skipped updates: "Suzuki-Coupling aggregation unchanged — skipping write"

8. **Update Logging**
   - [ ] Log all aggregation updates:
     - "Reaction Type [[Suzuki-Coupling]]: experiment count 42 → 43, avg yield 82% → 83%"
     - "Researcher [[Dr. Mueller]]: total experiments 18 → 19, avg yield 84% unchanged"
   - [ ] Log why aggregation was updated:
     - "Experiment EXP-2026-0042 added"
     - "Experiment EXP-2025-0312 yield changed 78% → 84%"

9. **Edge Cases**
   - [ ] Empty aggregations (e.g., all experiments deleted) → show "No experiments yet" message
   - [ ] Single experiment aggregations → show warning "Limited data (1 experiment)"
   - [ ] Missing data (e.g., experiment has no yield) → exclude from avg yield calculation

---

## Technical Implementation Notes

### Aggregation Refresher

**File: `scripts/sync-chemeln/refresh-aggregations.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ExperimentData } from './chemeln-api';
import { SyncStateManager } from './sync-state-manager';

export class AggregationRefresher {
  private kbDir: string;
  private stateManager: SyncStateManager;
  private affectedAggregations: Map<string, string[]> = new Map();

  constructor(kbDir: string, stateManager: SyncStateManager) {
    this.kbDir = kbDir;
    this.stateManager = stateManager;
  }

  async refreshReactionTypePage(reactionType: string, reason: string): Promise<void> {
    const pagePath = `/kb/chemistry/reactions/${reactionType.replace(/\s+/g, '-')}.md`;
    const reasons = this.affectedAggregations.get(pagePath) || [];
    reasons.push(reason);
    this.affectedAggregations.set(pagePath, reasons);

    // Collect all experiments for this reaction type
    const experimentsDir = path.join(this.kbDir, 'chemistry/experiments');
    const experimentFiles = await fs.readdir(experimentsDir);

    const experiments: ExperimentData[] = [];
    for (const file of experimentFiles) {
      const content = await fs.readFile(path.join(experimentsDir, file), 'utf-8');
      const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (yamlMatch) {
        const frontmatter = yaml.parse(yamlMatch[1]);
        if (frontmatter.reaction_type === reactionType) {
          experiments.push(frontmatter as ExperimentData);
        }
      }
    }

    // Calculate aggregations
    const experimentCount = experiments.length;
    const avgYield =
      experiments.reduce((sum, exp) => sum + (exp.yield || 0), 0) / experimentCount || 0;

    // Re-rank Key Learnings (simplified — full implementation in generate-reaction-type-page)
    const keyLearnings = this.extractKeyLearnings(experiments);

    // Re-rank "Who To Ask"
    const researchers = this.rankResearchers(experiments);

    // Generate updated page
    const newContent = this.generateReactionTypePage(
      reactionType,
      experiments,
      experimentCount,
      avgYield,
      keyLearnings,
      researchers,
    );

    // Write if changed
    await this.writePageIfChanged(pagePath, newContent, reasons);
  }

  async refreshChemicalPage(cas: string, reason: string): Promise<void> {
    const pagePath = `/kb/chemistry/chemicals/${cas.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    const reasons = this.affectedAggregations.get(pagePath) || [];
    reasons.push(reason);
    this.affectedAggregations.set(pagePath, reasons);

    // Collect all experiments using this chemical
    const experimentsDir = path.join(this.kbDir, 'chemistry/experiments');
    const experimentFiles = await fs.readdir(experimentsDir);

    const usedInExperiments: string[] = [];
    for (const file of experimentFiles) {
      const content = await fs.readFile(path.join(experimentsDir, file), 'utf-8');
      if (content.includes(`cas: ${cas}`)) {
        usedInExperiments.push(file.replace('.md', ''));
      }
    }

    // Sort by date (most recent first)
    usedInExperiments.sort().reverse();

    // Generate updated page
    const newContent = this.generateChemicalPage(cas, usedInExperiments);

    // Write if changed
    await this.writePageIfChanged(pagePath, newContent, reasons);
  }

  async refreshResearcherPage(researcher: string, reason: string): Promise<void> {
    const pagePath = `/kb/chemistry/researchers/${researcher.replace(/\s+/g, '-')}.md`;
    const reasons = this.affectedAggregations.get(pagePath) || [];
    reasons.push(reason);
    this.affectedAggregations.set(pagePath, reasons);

    // Collect all experiments by this researcher
    const experimentsDir = path.join(this.kbDir, 'chemistry/experiments');
    const experimentFiles = await fs.readdir(experimentsDir);

    const experiments: ExperimentData[] = [];
    for (const file of experimentFiles) {
      const content = await fs.readFile(path.join(experimentsDir, file), 'utf-8');
      const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (yamlMatch) {
        const frontmatter = yaml.parse(yamlMatch[1]);
        if (frontmatter.researcher === researcher) {
          experiments.push(frontmatter as ExperimentData);
        }
      }
    }

    // Calculate aggregations
    const totalExperiments = experiments.length;
    const avgYield =
      experiments.reduce((sum, exp) => sum + (exp.yield || 0), 0) / totalExperiments || 0;

    // Group by reaction type
    const byReactionType = new Map<string, ExperimentData[]>();
    for (const exp of experiments) {
      const arr = byReactionType.get(exp.reaction_type) || [];
      arr.push(exp);
      byReactionType.set(exp.reaction_type, arr);
    }

    // Top 3 expertise areas
    const expertiseAreas = Array.from(byReactionType.entries())
      .map(([reactionType, exps]) => ({
        reactionType,
        count: exps.length,
        avgYield: exps.reduce((sum, exp) => sum + (exp.yield || 0), 0) / exps.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Most recent experiment
    const mostRecent = experiments.sort((a, b) => b.date.localeCompare(a.date))[0];

    // Generate updated page
    const newContent = this.generateResearcherPage(
      researcher,
      totalExperiments,
      avgYield,
      expertiseAreas,
      mostRecent,
    );

    // Write if changed
    await this.writePageIfChanged(pagePath, newContent, reasons);
  }

  private async writePageIfChanged(
    pagePath: string,
    content: string,
    reasons: string[],
  ): Promise<void> {
    const fullPath = path.join(this.kbDir, pagePath);
    const newHash = this.stateManager.calculateContentHash(content);

    // Check if content changed
    try {
      const existingContent = await fs.readFile(fullPath, 'utf-8');
      const existingHash = this.stateManager.calculateContentHash(existingContent);

      if (existingHash === newHash) {
        console.log(`  Skipping ${pagePath} — aggregation unchanged`);
        return;
      }
    } catch {
      // Page doesn't exist
    }

    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(`  ✓ Updated aggregation ${pagePath}`);
    console.log(`    Reasons: ${reasons.join(', ')}`);
  }

  private extractKeyLearnings(experiments: ExperimentData[]): any[] {
    // Simplified — full implementation would parse practical notes
    return [];
  }

  private rankResearchers(experiments: ExperimentData[]): any[] {
    const byResearcher = new Map<string, ExperimentData[]>();
    for (const exp of experiments) {
      const arr = byResearcher.get(exp.researcher) || [];
      arr.push(exp);
      byResearcher.set(exp.researcher, arr);
    }

    return Array.from(byResearcher.entries())
      .map(([name, exps]) => ({
        name,
        count: exps.length,
        avgYield: exps.reduce((sum, exp) => sum + (exp.yield || 0), 0) / exps.length,
      }))
      .sort((a, b) => b.count * 0.5 + b.avgYield * 0.3 - (a.count * 0.5 + a.avgYield * 0.3));
  }

  private generateReactionTypePage(
    reactionType: string,
    experiments: ExperimentData[],
    count: number,
    avgYield: number,
    keyLearnings: any[],
    researchers: any[],
  ): string {
    // Simplified — full implementation in generate-reaction-type-page.ts
    return `# ${reactionType}\n\nTotal Experiments: ${count}\nAvg Yield: ${avgYield.toFixed(1)}%`;
  }

  private generateChemicalPage(cas: string, usedInExperiments: string[]): string {
    // Simplified
    return `# Chemical ${cas}\n\nUsed In: ${usedInExperiments.length} experiments`;
  }

  private generateResearcherPage(
    name: string,
    total: number,
    avgYield: number,
    expertise: any[],
    mostRecent: ExperimentData,
  ): string {
    // Simplified
    return `# ${name}\n\nTotal: ${total}, Avg Yield: ${avgYield.toFixed(1)}%`;
  }

  getAffectedAggregations(): Map<string, string[]> {
    return this.affectedAggregations;
  }

  reset() {
    this.affectedAggregations.clear();
  }
}
```

---

## Test Scenarios

### Integration Test: `tests/sync-chemeln/refresh-aggregations.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AggregationRefresher } from '@/scripts/sync-chemeln/refresh-aggregations';
import { SyncStateManager } from '@/scripts/sync-chemeln/sync-state-manager';
import fs from 'fs/promises';

describe('AggregationRefresher', () => {
  const testKbDir = '/tmp/test-kb';
  let refresher: AggregationRefresher;

  beforeEach(async () => {
    const stateManager = new SyncStateManager(testKbDir);
    refresher = new AggregationRefresher(testKbDir, stateManager);
    refresher.reset();
  });

  it('should update Reaction Type avg yield when experiment added', async () => {
    // Setup: Create 2 experiments with yields 80%, 90%
    // Add 3rd experiment with yield 70%
    // Verify: Avg yield recalculated to 80%

    await refresher.refreshReactionTypePage('Suzuki-Coupling', 'EXP-2026-0042 added');

    const affected = refresher.getAffectedAggregations();
    expect(affected.has('/kb/chemistry/reactions/Suzuki-Coupling.md')).toBe(true);
  });

  it('should only update aggregation if content changed', async () => {
    // Create aggregation page
    await refresher.refreshReactionTypePage('Suzuki-Coupling', 'Initial');

    // Update again with same data (should skip write)
    refresher.reset();
    await refresher.refreshReactionTypePage('Suzuki-Coupling', 'No change');

    // Verify: No write occurred (check logs or mock fs.writeFile)
  });
});
```

---

## Dependencies

- **SKB-47.3:** New Entity Handling (aggregations depend on entity pages existing)

---

## Dev Notes

### Aggregation Update Frequency

- Full aggregation refresh on every incremental sync
- For large KBs (1000+ experiments), consider:
  - Incremental aggregation updates (add/subtract from running totals instead of recalculating)
  - Lazy aggregation (only update when page is accessed)

### Performance Optimization

- Batch updates: If 10 Suzuki experiments changed, update page once
- Cache aggregation data in sync state (avoid re-scanning all experiments)
- Use database views or materialized aggregations for very large KBs

---

**Last Updated:** 2026-03-21
