# Story SKB-46.1: Chemistry KB Index Page

**Epic:** Epic 46 - Agent Retrieval & Contextual Navigation
**Story ID:** SKB-46.1
**Story Points:** 2 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-45 (Chemistry KB Data Model — reaction types and experiments must be synced)

---

## User Story

As an AI agent, I want a single entry point for all chemistry questions, So that I can efficiently navigate to the right reaction type, experiments, or researchers without guessing URLs or searching blindly.

---

## Acceptance Criteria

1. **Index Page Location**
   - [ ] Page created at `/kb/chemistry/index.md`
   - [ ] Accessible via wikilink: `[[Chemistry KB]]`
   - [ ] Page title: `# Chemistry KB Index`

2. **Reaction Types Section**
   - [ ] List all reaction types with wikilinks: `[[Suzuki-Coupling]]`, `[[Grignard-Reaction]]`, etc.
   - [ ] Show experiment count per reaction type: `Suzuki-Coupling (42 experiments)`
   - [ ] Alphabetically sorted
   - [ ] Data pulled from sync state or aggregated from reaction type pages

3. **Recent Experiments Section**
   - [ ] Link to "Recent Experiments" page: `[[Recent Experiments]]`
   - [ ] Description: "Experiments added in the last 30 days"
   - [ ] Optional: Show top 5 most recent experiments inline with dates

4. **Researcher Directory**
   - [ ] Link to "Researcher Directory" page: `[[Researcher Directory]]`
   - [ ] Description: "Find who has expertise in specific reactions or substrates"

5. **Quick Stats**
   - [ ] Total experiments: `Total Experiments: 237`
   - [ ] Total chemicals: `Total Chemicals: 142`
   - [ ] Total researchers: `Total Researchers: 18`
   - [ ] Stats calculated from sync state or aggregated from KB pages

6. **Agent Navigation Guide**
   - [ ] Section titled: `## How Agents Should Use This KB`
   - [ ] Step-by-step instructions:
     1. "Start with the reaction type you're interested in"
     2. "Read the Key Learnings section for quick tips"
     3. "Use contextual tags to filter experiments (substrate class, scale, challenge)"
     4. "Read top matching experiments for detailed conditions and practical notes"
     5. "Check the 'Who To Ask' section to find human experts"
   - [ ] Clear, numbered list format

7. **Page Metadata**
   - [ ] Frontmatter YAML with: `type: index`, `category: chemistry`, `updated: YYYY-MM-DD`
   - [ ] No experiment-specific tags (this is a meta page)

8. **Formatting**
   - [ ] Wikilinks for all internal navigation
   - [ ] Markdown tables for stats if needed
   - [ ] Clean, scannable layout (headings, bullet points, short paragraphs)

---

## Technical Implementation Notes

### File Structure

**File: `/kb/chemistry/index.md`**

```markdown
---
type: index
category: chemistry
title: Chemistry KB Index
updated: 2026-03-21
---

# Chemistry KB Index

Welcome to the Chemistry Knowledge Base. This KB contains experiment data, reaction learnings, chemical information, and researcher expertise from our ChemELN system.

## Quick Stats

- **Total Experiments:** 237
- **Total Chemicals:** 142
- **Total Researchers:** 18
- **Last Updated:** 2026-03-21

---

## Reaction Types

Browse experiments by reaction type:

- [[Suzuki-Coupling]] (42 experiments)
- [[Grignard-Reaction]] (28 experiments)
- [[Buchwald-Hartwig-Amination]] (31 experiments)
- [[Negishi-Coupling]] (18 experiments)
- [[Heck-Reaction]] (15 experiments)
- [[Sonogashira-Coupling]] (12 experiments)
- [[Stille-Coupling]] (9 experiments)

[View all reaction types →](/kb/chemistry/reactions/)

---

## Recent Experiments

[[Recent Experiments]] — Experiments added in the last 30 days

Latest:
- [[EXP-2026-0042]] — Suzuki coupling on 2-bromopyridine (Dr. Mueller, 2026-03-15)
- [[EXP-2026-0041]] — Grignard with hindered substrate (Dr. Chen, 2026-03-14)
- [[EXP-2026-0040]] — Buchwald-Hartwig on chloropyrimidine (Dr. Patel, 2026-03-13)

---

## Researcher Directory

[[Researcher Directory]] — Find who has expertise in specific reactions or substrates

Top contributors:
- [[Dr. Jane Mueller]] (18 experiments, Suzuki coupling expert)
- [[Dr. Wei Chen]] (15 experiments, Grignard expert)
- [[Dr. Anika Patel]] (12 experiments, Buchwald-Hartwig expert)

---

## How Agents Should Use This KB

When answering chemistry questions, follow this navigation pattern:

1. **Start with the reaction type** — Click the relevant reaction link above (e.g., [[Suzuki-Coupling]])
2. **Read Key Learnings** — The reaction type page has a "Key Learnings" section with ranked tips
3. **Filter by context** — Use tags to find experiments matching substrate class, scale, or challenge
4. **Read top experiments** — Focus on the 3-5 most relevant experiments (sorted by quality × relevance)
5. **Extract citations** — Always cite: experiment ID, researcher, date, and specific conditions
6. **Check "Who To Ask"** — If more context is needed, the reaction type page lists human experts

**Example workflow:**
- User asks: "What conditions work for Suzuki coupling on heteroaryl substrates?"
- Navigate to [[Suzuki-Coupling]]
- Filter for `substrate-class: heteroaryl`
- Read top 3 experiments: [[EXP-2026-0042]], [[EXP-2025-0312]], [[EXP-2025-0289]]
- Answer with specific conditions, yields, and researcher attribution

---

## Navigation Tips

- **All reaction types:** Browse `/kb/chemistry/reactions/`
- **All chemicals:** Browse `/kb/chemistry/chemicals/`
- **All researchers:** Browse `/kb/chemistry/researchers/`
- **Search by tag:** Use the tag filter on reaction type pages
- **Recent work:** Check [[Recent Experiments]] for latest learnings

---

*Last updated: 2026-03-21 | Data synced from ChemELN*
```

---

### Data Aggregation Script

**File: `scripts/sync-chemeln/generate-index-page.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface ReactionTypeSummary {
  name: string;
  experimentCount: number;
}

export async function generateIndexPage(kbDir: string): Promise<void> {
  // Collect reaction types
  const reactionTypeFiles = await glob(`${kbDir}/chemistry/reactions/*.md`);
  const reactionTypes: ReactionTypeSummary[] = [];

  for (const file of reactionTypeFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const nameMatch = content.match(/^# (.+)$/m);
    const expCountMatch = content.match(/Total Experiments: (\d+)/);

    if (nameMatch && expCountMatch) {
      reactionTypes.push({
        name: nameMatch[1],
        experimentCount: parseInt(expCountMatch[1], 10),
      });
    }
  }

  reactionTypes.sort((a, b) => a.name.localeCompare(b.name));

  // Collect stats
  const experimentFiles = await glob(`${kbDir}/chemistry/experiments/*.md`);
  const chemicalFiles = await glob(`${kbDir}/chemistry/chemicals/*.md`);
  const researcherFiles = await glob(`${kbDir}/chemistry/researchers/*.md`);

  const totalExperiments = experimentFiles.length;
  const totalChemicals = chemicalFiles.length;
  const totalResearchers = researcherFiles.length;

  // Get recent experiments (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentExperiments = [];
  for (const file of experimentFiles.slice(0, 50)) {
    // Check first 50 for performance
    const content = await fs.readFile(file, 'utf-8');
    const dateMatch = content.match(/date: (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const expDate = new Date(dateMatch[1]);
      if (expDate >= thirtyDaysAgo) {
        const idMatch = content.match(/experiment_id: (.+)$/m);
        const researcherMatch = content.match(/researcher: \[\[(.+?)\]\]/);
        if (idMatch && researcherMatch) {
          recentExperiments.push({
            id: idMatch[1],
            date: dateMatch[1],
            researcher: researcherMatch[1],
          });
        }
      }
    }
  }

  recentExperiments.sort((a, b) => b.date.localeCompare(a.date));
  const top3Recent = recentExperiments.slice(0, 3);

  // Generate index page content
  const reactionTypesList = reactionTypes
    .map((rt) => `- [[${rt.name}]] (${rt.experimentCount} experiments)`)
    .join('\n');

  const recentExpList = top3Recent
    .map((exp) => `- [[${exp.id}]] (${exp.researcher}, ${exp.date})`)
    .join('\n');

  const indexContent = `---
type: index
category: chemistry
title: Chemistry KB Index
updated: ${new Date().toISOString().split('T')[0]}
---

# Chemistry KB Index

Welcome to the Chemistry Knowledge Base. This KB contains experiment data, reaction learnings, chemical information, and researcher expertise from our ChemELN system.

## Quick Stats

- **Total Experiments:** ${totalExperiments}
- **Total Chemicals:** ${totalChemicals}
- **Total Researchers:** ${totalResearchers}
- **Last Updated:** ${new Date().toISOString().split('T')[0]}

---

## Reaction Types

Browse experiments by reaction type:

${reactionTypesList}

[View all reaction types →](/kb/chemistry/reactions/)

---

## Recent Experiments

[[Recent Experiments]] — Experiments added in the last 30 days

Latest:
${recentExpList}

---

## Researcher Directory

[[Researcher Directory]] — Find who has expertise in specific reactions or substrates

---

## How Agents Should Use This KB

When answering chemistry questions, follow this navigation pattern:

1. **Start with the reaction type** — Click the relevant reaction link above
2. **Read Key Learnings** — The reaction type page has ranked tips
3. **Filter by context** — Use tags to find experiments matching substrate class, scale, or challenge
4. **Read top experiments** — Focus on the 3-5 most relevant experiments (sorted by quality × relevance)
5. **Extract citations** — Always cite: experiment ID, researcher, date, and specific conditions
6. **Check "Who To Ask"** — If more context is needed, the reaction type page lists human experts

**Example workflow:**
- User asks: "What conditions work for Suzuki coupling on heteroaryl substrates?"
- Navigate to [[Suzuki-Coupling]]
- Filter for \`substrate-class: heteroaryl\`
- Read top 3 experiments
- Answer with specific conditions, yields, and researcher attribution

---

*Last updated: ${new Date().toISOString().split('T')[0]} | Data synced from ChemELN*
`;

  const indexPath = path.join(kbDir, 'chemistry', 'index.md');
  await fs.writeFile(indexPath, indexContent, 'utf-8');
  console.log(`✓ Generated Chemistry KB Index: ${indexPath}`);
}
```

---

## Test Scenarios

### Unit Tests: `tests/sync-chemeln/generate-index-page.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateIndexPage } from '@/scripts/sync-chemeln/generate-index-page';
import fs from 'fs/promises';
import path from 'path';

describe('Generate Index Page', () => {
  const testKbDir = '/tmp/test-kb';

  beforeEach(async () => {
    // Setup test directory with sample reaction types
    await fs.mkdir(path.join(testKbDir, 'chemistry/reactions'), { recursive: true });
    await fs.writeFile(
      path.join(testKbDir, 'chemistry/reactions/Suzuki-Coupling.md'),
      '# Suzuki-Coupling\n\nTotal Experiments: 42\n',
    );
  });

  it('should generate index page with correct stats', async () => {
    await generateIndexPage(testKbDir);

    const indexPath = path.join(testKbDir, 'chemistry/index.md');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('# Chemistry KB Index');
    expect(content).toContain('[[Suzuki-Coupling]] (42 experiments)');
    expect(content).toContain('Total Experiments:');
  });

  it('should sort reaction types alphabetically', async () => {
    await fs.writeFile(
      path.join(testKbDir, 'chemistry/reactions/Grignard-Reaction.md'),
      '# Grignard-Reaction\n\nTotal Experiments: 28\n',
    );

    await generateIndexPage(testKbDir);

    const content = await fs.readFile(path.join(testKbDir, 'chemistry/index.md'), 'utf-8');
    const grignardPos = content.indexOf('Grignard-Reaction');
    const suzukiPos = content.indexOf('Suzuki-Coupling');

    expect(grignardPos).toBeLessThan(suzukiPos);
  });
});
```

---

## Dependencies

- **EPIC-45:** Chemistry KB Data Model (reaction types, experiments, researchers must be synced)

---

## Dev Notes

### Performance Considerations

- Index generation scans all reaction type files, experiment files, chemical files, and researcher files
- For large KBs (1000+ experiments), consider caching stats in sync state file instead of re-scanning
- Recent experiments query limited to first 50 files (sorted by filename, which includes date)

### Update Frequency

- Regenerate index page on every full sync
- For incremental syncs, only regenerate if:
  - New reaction type added
  - New researcher added
  - Experiment count changed significantly (> 5% delta)

### Navigation Patterns

- Index page is the PRIMARY entry point for agents
- All agent workflows should start here
- Use wikilinks consistently: `[[Page Name]]` not `/kb/chemistry/page.md`

---

**Last Updated:** 2026-03-21
