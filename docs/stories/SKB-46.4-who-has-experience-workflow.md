# Story SKB-46.4: "Who Has Experience" Agent Workflow

**Epic:** Epic 46 - Agent Retrieval & Contextual Navigation
**Story ID:** SKB-46.4
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-46.3 ("Find Similar Experiments" workflow as foundation)

---

## User Story

As an AI agent, I want a documented workflow for finding human experts, So that I can connect users with researchers who have relevant experience (experiment count, avg yield, recent work) instead of just showing experiment data.

---

## Acceptance Criteria

1. **Workflow Documentation**
   - [ ] Workflow documented in `/kb/chemistry/agent-workflows/who-has-experience.md`
   - [ ] Markdown format with numbered steps and example I/O
   - [ ] Clear workflow title: `# Who Has Experience Workflow`

2. **Workflow Steps**
   - [ ] **Step 1:** User asks about expertise for specific reaction or substrate
   - [ ] **Step 2:** Agent navigates to Reaction Type page → "Who To Ask" section
   - [ ] **Step 3:** Cross-references with Researcher profile pages for deeper context
   - [ ] **Step 4:** Returns ranked researchers with: name, experiment count, avg yield, most recent experiment (ID + date), specific tips they contributed
   - [ ] **Step 5:** Compose answer: "Dr. Mueller has done 6 heteroaryl Suzuki couplings with 84% avg yield. Her most recent was [[EXP-2026-0042]] last week."

3. **Example Inputs/Outputs**
   - [ ] **Example 1:** Find Suzuki coupling expert
     - Input: "Who in our lab has done Suzuki coupling on heteroaryl substrates?"
     - Output: Ranked list of 3 researchers with stats
   - [ ] **Example 2:** Find scale-up expert
     - Input: "Who has experience scaling up Grignard reactions?"
     - Output: Researcher with large-scale experience highlighted

4. **Researcher Ranking**
   - [ ] Document ranking criteria:
     - Primary: Experiment count for reaction type (more experiments = higher rank)
     - Secondary: Avg yield (higher avg = higher rank)
     - Tertiary: Recency (most recent experiment date)
   - [ ] Ranking formula: `experiment_count × 0.5 + (avg_yield / 100) × 0.3 + recency_score × 0.2`

5. **Researcher Profile Cross-Reference**
   - [ ] Document what to extract from Researcher profile pages:
     - Total experiments (all reactions)
     - Expertise areas (top 3 reaction types by experiment count)
     - Avg yield per reaction type
     - Most recent experiment (ID, date, yield)
     - Specific tips contributed (from "Key Learnings" attributions)

6. **Output Format**
   - [ ] Ranked list format:
     ```
     1. [[Dr. Jane Mueller]]
        - Experiments: 6 heteroaryl Suzuki couplings (18 total)
        - Avg Yield: 84%
        - Most Recent: [[EXP-2026-0042]] (2026-03-15, 89% yield)
        - Key Tip: "Use bulky phosphine ligands to minimize protodeboronation"

     2. [[Dr. Wei Chen]]
        - Experiments: 4 heteroaryl Suzuki couplings (15 total)
        - Avg Yield: 81%
        - Most Recent: [[EXP-2025-0312]] (2025-11-08, 84% yield)
        - Key Tip: "Lower temperature improves selectivity"
     ```

7. **Error Handling**
   - [ ] If "Who To Ask" section missing → scan all experiments for researchers
   - [ ] If no researchers found → suggest broadening search (e.g., remove substrate filter)
   - [ ] If researcher profile missing → use data from experiments only

---

## Technical Implementation Notes

### Workflow Documentation File

**File: `/kb/chemistry/agent-workflows/who-has-experience.md`**

```markdown
---
type: agent-workflow
category: chemistry
title: Who Has Experience Workflow
version: 1.0
updated: 2026-03-21
---

# Who Has Experience Workflow

This workflow guides AI agents through finding human experts for specific chemistry reactions or substrates.

## When to Use This Workflow

Use this workflow when a user asks:
- "Who in our lab has done [reaction type]?"
- "Who has experience with [substrate class]?"
- "Who should I talk to about [specific challenge]?"
- "Who's done [reaction type] at [scale]?"

## Workflow Steps

### Step 1: Parse User Question

Extract key information:
- **Reaction type:** Suzuki coupling, Grignard, etc.
- **Substrate class:** heteroaryl, aryl, etc. (if mentioned)
- **Scale:** small, medium, large (if mentioned)
- **Challenge:** yield, protodeboronation, etc. (if mentioned)

**Example:**
- Input: "Who in our lab has done Suzuki coupling on heteroaryl substrates?"
- Extracted: `reaction: suzuki-coupling`, `substrate-class: heteroaryl`

---

### Step 2: Navigate to Reaction Type Page

**Tool call:**
```json
read_page({ "path": "/kb/chemistry/reactions/Suzuki-Coupling.md" })
```

**What to look for:**
- **"Who To Ask" section:** List of researchers ranked by expertise
- If filters specified (substrate-class, scale), scan for matching experiments and their researchers

---

### Step 3: Extract Researcher Data from "Who To Ask"

**What to extract:**
- Researcher name (wikilink)
- Experiment count for this reaction type
- Avg yield for this reaction type
- Most recent experiment (ID, date)

**Example:**
> **Who To Ask:**
> - [[Dr. Jane Mueller]] — 6 experiments, avg yield 84%, most recent: [[EXP-2026-0042]] (2026-03-15)
> - [[Dr. Wei Chen]] — 4 experiments, avg yield 81%, most recent: [[EXP-2025-0312]] (2025-11-08)

---

### Step 4: Cross-Reference with Researcher Profiles

**Tool calls:**
```json
read_page({ "path": "/kb/chemistry/researchers/Dr-Jane-Mueller.md" })
read_page({ "path": "/kb/chemistry/researchers/Dr-Wei-Chen.md" })
```

**What to extract:**
- **Total experiments:** Across all reaction types
- **Expertise areas:** Top 3 reaction types by experiment count
- **Specific tips:** Look for "Key Learnings" attributions on Reaction Type pages
- **Recent work:** Most recent experiment (last 30 days)

**Example Researcher Profile:**
```markdown
# Dr. Jane Mueller

## Expertise Summary

- **Total Experiments:** 18
- **Specialization:** Suzuki coupling, Buchwald-Hartwig amination
- **Avg Yield (All Reactions):** 82%

## Expertise by Reaction Type

1. **Suzuki-Coupling:** 6 experiments, avg yield 84%
2. **Buchwald-Hartwig-Amination:** 5 experiments, avg yield 79%
3. **Grignard-Reaction:** 3 experiments, avg yield 85%

## Recent Experiments

- [[EXP-2026-0042]] — Suzuki coupling on 2-bromopyridine (89% yield, 2026-03-15)
- [[EXP-2026-0038]] — Buchwald-Hartwig on chloropyrimidine (81% yield, 2026-03-10)
```

---

### Step 5: Filter by Context (if specified)

If user specified substrate class, scale, or challenge:

1. Read experiments from "Who To Ask" researchers
2. Filter by tags
3. Re-rank researchers based on matching experiments only

**Example:**
- User asks: "Who has done heteroaryl Suzuki couplings?"
- Filter Dr. Mueller's experiments for `substrate-class: heteroaryl`
- Dr. Mueller: 4 out of 6 Suzuki experiments are heteroaryl → rank higher
- Dr. Chen: 2 out of 4 Suzuki experiments are heteroaryl → rank lower

---

### Step 6: Rank Researchers

**Ranking formula:**
```
expertise_score = (experiment_count × 0.5) + (avg_yield × 0.3) + (recency_score × 0.2)

Where:
- experiment_count: Number of matching experiments (for this reaction + context)
- avg_yield: Average yield across matching experiments (0-100)
- recency_score: Based on most recent experiment date (0-100, where 100 = today)
```

**Example calculation:**
- Dr. Mueller: (6 × 0.5) + (84 × 0.3) + (95 × 0.2) = 3.0 + 25.2 + 19.0 = 47.2
- Dr. Chen: (4 × 0.5) + (81 × 0.3) + (65 × 0.2) = 2.0 + 24.3 + 13.0 = 39.3

Sort descending: Dr. Mueller > Dr. Chen

---

### Step 7: Compose Answer

**Format:**

> Based on the Chemistry KB, here are the researchers with expertise in Suzuki coupling on heteroaryl substrates:
>
> **1. [[Dr. Jane Mueller]]**
> - **Experiments:** 6 heteroaryl Suzuki couplings (18 total experiments)
> - **Avg Yield:** 84%
> - **Most Recent:** [[EXP-2026-0042]] (2026-03-15, 89% yield)
> - **Key Tip:** "Use bulky phosphine ligands to minimize protodeboronation on heteroaryl substrates"
> - **Overall Expertise:** Suzuki coupling specialist, also experienced in Buchwald-Hartwig amination
>
> **2. [[Dr. Wei Chen]]**
> - **Experiments:** 4 heteroaryl Suzuki couplings (15 total experiments)
> - **Avg Yield:** 81%
> - **Most Recent:** [[EXP-2025-0312]] (2025-11-08, 84% yield)
> - **Key Tip:** "Lower temperature (80°C vs 100°C) improves selectivity on heteroaryl substrates"
> - **Overall Expertise:** Grignard reaction specialist, also experienced in Suzuki coupling
>
> **Recommendation:** Dr. Mueller has the most recent and extensive experience with this specific substrate class. Consider reaching out to her for detailed advice.

---

## Error Handling

### "Who To Ask" Section Missing

If Reaction Type page doesn't have "Who To Ask":
1. Scan all experiments for that reaction type
2. Extract researchers from experiment metadata
3. Compute stats manually (experiment count, avg yield)
4. Rank and return

---

### No Researchers Found

If filtering returns 0 researchers:
1. Broaden search (remove substrate/scale/challenge filter)
2. Suggest closest match

**Example:**
> "No researchers found with heteroaryl + large-scale Suzuki coupling experience. Broadening to all heteroaryl Suzuki couplings — found 2 researchers."

---

### Researcher Profile Missing

If a researcher profile page doesn't exist:
1. Use data from experiments only
2. Note in output that profile is incomplete

**Example:**
> "Dr. Patel has done 3 Suzuki couplings (avg yield 78%), but detailed profile not available."

---

## Example Workflow Execution

### Input

> "Who in our lab has done Grignard reactions at scale?"

### Execution Log

```
1. Parse question:
   - reaction: grignard-reaction
   - scale: large (implied by "at scale")

2. read_page("/kb/chemistry/reactions/Grignard-Reaction.md")
   → Found "Who To Ask" section
   → Researchers: Dr. Chen, Dr. Patel, Dr. Mueller

3. read_page("/kb/chemistry/researchers/Dr-Wei-Chen.md")
   → Total experiments: 15
   → Grignard experiments: 8 (avg yield 83%)
   → Most recent: EXP-2026-0041 (2026-03-14)

4. Filter Dr. Chen's Grignard experiments by scale:
   → 4 out of 8 are "large" or "pilot" scale
   → Avg yield (large-scale): 81%

5. Repeat for Dr. Patel, Dr. Mueller

6. Rank:
   - Dr. Chen: 4 large-scale Grignard (81% avg) → expertise_score: 42.5
   - Dr. Patel: 2 large-scale Grignard (78% avg) → expertise_score: 35.2
   - Dr. Mueller: 1 large-scale Grignard (85% avg) → expertise_score: 30.5

7. Compose answer (see Step 7 format)
```

---

## Success Metrics

A successful workflow execution includes:
- At least 1 researcher cited (3 preferred)
- Experiment count, avg yield, most recent experiment for each researcher
- Key tips or insights from their work
- Clear recommendation if one researcher stands out

---

*Last updated: 2026-03-21 | Use this workflow to connect users with human experts*
```

---

## Test Scenarios

### Integration Test: `tests/agent-workflows/who-has-experience.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '@/lib/agent-workflows/execute';

describe('Who Has Experience Workflow', () => {
  it('should return ranked researchers with stats', async () => {
    const input = "Who in our lab has done Suzuki coupling on heteroaryl substrates?";

    const result = await executeWorkflow('who-has-experience', { question: input });

    // Verify navigation path
    expect(result.pagesVisited).toContain('/kb/chemistry/reactions/Suzuki-Coupling.md');
    expect(result.pagesVisited.some((p) => p.includes('/researchers/'))).toBe(true);

    // Verify output format
    expect(result.answer).toContain('[[Dr.');
    expect(result.answer).toContain('Experiments:');
    expect(result.answer).toContain('Avg Yield:');
    expect(result.answer).toContain('Most Recent:');
  });
});
```

---

## Dependencies

- **SKB-46.3:** "Find Similar Experiments" workflow (foundation for understanding KB structure)

---

## Dev Notes

### Ranking vs. Filtering

- Use "Who To Ask" section as starting point (pre-ranked)
- Apply contextual filters (substrate, scale, challenge) to re-rank
- Don't filter OUT researchers — just adjust their ranking based on matching experiments

### Future Enhancements

- Add "collaboration history" (who has worked together on similar problems)
- Add "availability" indicator (who's actively working on similar projects)
- Add "mentorship matching" (connect junior researchers with experts)

---

**Last Updated:** 2026-03-21
