# Story SKB-46.3: "Find Similar Experiments" Agent Workflow

**Epic:** Epic 46 - Agent Retrieval & Contextual Navigation
**Story ID:** SKB-46.3
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-46.2 (Contextual Search Tags)

---

## User Story

As an AI agent, I want a documented step-by-step workflow for finding relevant experiments, So that I can answer chemistry questions with specific citations (experiment IDs, researchers, dates, conditions) instead of generic advice.

---

## Acceptance Criteria

1. **Workflow Documentation**
   - [ ] Workflow documented in `/kb/chemistry/agent-workflows/find-similar-experiments.md`
   - [ ] Markdown format with numbered steps, example inputs/outputs, and tool call examples
   - [ ] Clear workflow title: `# Find Similar Experiments Workflow`

2. **Workflow Steps**
   - [ ] **Step 1:** User describes current problem (reaction type, substrate, specific challenge)
   - [ ] **Step 2:** Agent navigates to Chemistry KB Index (`[[Chemistry KB]]`)
   - [ ] **Step 3:** Agent follows wikilink to matching Reaction Type page (e.g., `[[Suzuki-Coupling]]`)
   - [ ] **Step 4:** Agent reads "Key Learnings" section for immediate relevant tips
   - [ ] **Step 5:** Agent uses contextual tags to filter experiments (substrate class, scale, challenge)
   - [ ] **Step 6:** Agent reads top 3 matching experiment pages (sorted by quality_score × relevance)
   - [ ] **Step 7:** Agent extracts practical notes, conditions that worked, and researcher attribution
   - [ ] **Step 8:** Agent composes answer with specific citations: experiment IDs, researchers, dates

3. **Example Input/Output**
   - [ ] **Example 1:** Heteroaryl Suzuki coupling with protodeboronation issue
     - Input: "What conditions work for Suzuki coupling on heteroaryl substrates to avoid protodeboronation?"
     - Expected pages visited: `[[Chemistry KB]]` → `[[Suzuki-Coupling]]` → `[[EXP-2026-0042]]`, `[[EXP-2025-0312]]`, `[[EXP-2025-0289]]`
     - Expected output: "Based on 3 heteroaryl Suzuki coupling experiments, the following conditions minimize protodeboronation: ..."
   - [ ] **Example 2:** Scale-up Grignard reaction
     - Input: "We're scaling up a Grignard reaction from 5mmol to 50mmol — any tips?"
     - Expected pages visited: `[[Chemistry KB]]` → `[[Grignard-Reaction]]` → filter `scale: large` → experiments
     - Expected output: "Dr. Chen has done 4 large-scale Grignard reactions (>10mmol). Key learnings: ..."

4. **Tool Call Examples**
   - [ ] Document MCP server tool calls for each step:
     - `read_page({ path: "/kb/chemistry/index.md" })`
     - `read_page({ path: "/kb/chemistry/reactions/Suzuki-Coupling.md" })`
     - `filter_experiments({ tags: { substrate-class: "heteroaryl", challenge: "protodeboronation" } })`
     - `read_page({ path: "/kb/chemistry/experiments/EXP-2026-0042.md" })`

5. **Relevance Scoring**
   - [ ] Document relevance score calculation: `tag_match_count / total_tags`
     - Exact match: all tags match = 1.0
     - Partial match: 2 out of 4 tags match = 0.5
   - [ ] Document quality score: `(yield/100) × 0.5 + (completeness_score/100) × 0.3 + (recency_score/100) × 0.2`
   - [ ] Final ranking: `quality_score × relevance_score` (descending)

6. **Citation Format**
   - [ ] Document required citation elements:
     - Experiment ID (wikilink): `[[EXP-2026-0042]]`
     - Researcher (wikilink): `[[Dr. Jane Mueller]]`
     - Date: `2026-03-15`
     - Key conditions: "Pd(PPh3)4 (5 mol%), K2CO3, DMF, 80°C, 4h"
     - Yield: "89%"
   - [ ] Example citation: "In [[EXP-2026-0042]], [[Dr. Jane Mueller]] achieved 89% yield using Pd(PPh3)4 (5 mol%), K2CO3 in DMF at 80°C for 4 hours (2026-03-15)."

7. **Error Handling**
   - [ ] Document what to do if:
     - No matching reaction type found → suggest closest match or ask user to clarify
     - No experiments match filters → broaden filter criteria (e.g., remove challenge filter)
     - Experiment page missing data → skip to next experiment, note data gap in answer

---

## Technical Implementation Notes

### Workflow Documentation File

**File: `/kb/chemistry/agent-workflows/find-similar-experiments.md`**

```markdown
---
type: agent-workflow
category: chemistry
title: Find Similar Experiments Workflow
version: 1.0
updated: 2026-03-21
---

# Find Similar Experiments Workflow

This workflow guides AI agents through finding contextually relevant chemistry experiments to answer user questions with specific citations.

## When to Use This Workflow

Use this workflow when a user asks:
- "What conditions work for [reaction type] on [substrate class]?"
- "We're getting [low yield / poor selectivity / etc.] on this [reaction type] — what did others try?"
- "Any tips for [reaction type] at [scale]?"
- "How to avoid [specific challenge] in [reaction type]?"

## Workflow Steps

### Step 1: Parse User Question

Extract key information:
- **Reaction type:** Suzuki coupling, Grignard, Buchwald-Hartwig, etc.
- **Substrate class:** aryl, heteroaryl, vinyl, alkyl (if mentioned)
- **Scale:** small, medium, large (if mentioned)
- **Challenge:** yield, selectivity, protodeboronation, etc. (if mentioned)

**Example:**
- Input: "What conditions work for Suzuki coupling on heteroaryl substrates to avoid protodeboronation?"
- Extracted: `reaction: suzuki-coupling`, `substrate-class: heteroaryl`, `challenge: protodeboronation`

---

### Step 2: Navigate to Chemistry KB Index

**Tool call:**
```json
read_page({ "path": "/kb/chemistry/index.md" })
```

**What to look for:**
- List of all reaction types
- Find the wikilink that matches the user's reaction type
- If exact match not found, look for closest match (e.g., "Suzuki-Miyaura" vs "Suzuki-Coupling")

---

### Step 3: Navigate to Reaction Type Page

**Tool call:**
```json
read_page({ "path": "/kb/chemistry/reactions/Suzuki-Coupling.md" })
```

**What to read:**
- **Overview:** Quick summary of the reaction
- **Key Learnings:** Top-ranked tips (read first 3-5)
- **Experiment list:** Note how many experiments exist

---

### Step 4: Read "Key Learnings" Section

**Purpose:** Get immediate, high-quality tips without reading individual experiments.

**What to extract:**
- Top 3 learnings sorted by quality × recency
- Each learning has: tip text, quality score, experiment ID, researcher

**Example:**
> "Use bulky phosphine ligands to minimize protodeboronation on heteroaryl substrates (Quality: 0.85, [[EXP-2026-0042]], [[Dr. Mueller]])"

---

### Step 5: Filter Experiments by Contextual Tags

**Goal:** Narrow down to the most relevant experiments.

**Filtering logic:**
- Combine tags extracted from user question
- Match experiments with ALL tags (exact match)
- If < 3 results, relax to partial match (2 out of 3 tags)

**Example filter:**
```json
{
  "reaction": "suzuki-coupling",
  "substrate-class": "heteroaryl",
  "challenge": "protodeboronation"
}
```

**Expected result:** List of experiment IDs with relevance scores.

---

### Step 6: Read Top 3 Matching Experiments

**Tool calls:**
```json
read_page({ "path": "/kb/chemistry/experiments/EXP-2026-0042.md" })
read_page({ "path": "/kb/chemistry/experiments/EXP-2025-0312.md" })
read_page({ "path": "/kb/chemistry/experiments/EXP-2025-0289.md" })
```

**What to extract from each experiment:**
- **Conditions:** Catalyst, solvent, temperature, time, additives
- **Yield:** Actual % yield
- **Practical notes:** What worked, what didn't, tips for reproducibility
- **Researcher:** Who did the experiment (for attribution)
- **Date:** When it was done (for recency context)

---

### Step 7: Extract and Synthesize Information

**Create a structured summary:**

1. **Conditions that worked:**
   - Catalyst: Pd(PPh3)4 (5 mol%) — used in 2/3 experiments
   - Solvent: DMF — used in 3/3 experiments
   - Base: K2CO3 or Cs2CO3 — both effective
   - Temperature: 80-90°C
   - Time: 4-6 hours

2. **Key learnings:**
   - Bulky phosphine ligands reduce protodeboronation (EXP-2026-0042)
   - Lower temperature (80°C vs 100°C) improves selectivity (EXP-2025-0312)
   - Degassing is critical — poor yields without it (EXP-2025-0289)

3. **Attribution:**
   - [[Dr. Jane Mueller]] (EXP-2026-0042, 2026-03-15) — 89% yield
   - [[Dr. Wei Chen]] (EXP-2025-0312, 2025-11-08) — 84% yield
   - [[Dr. Anika Patel]] (EXP-2025-0289, 2025-09-22) — 78% yield

---

### Step 8: Compose Answer with Citations

**Format:**

> Based on 3 heteroaryl Suzuki coupling experiments, the following conditions minimize protodeboronation:
>
> **Recommended conditions:**
> - **Catalyst:** Pd(PPh3)4 (5 mol%)
> - **Ligand:** Bulky phosphine (e.g., X-Phos)
> - **Solvent:** DMF
> - **Base:** K2CO3 or Cs2CO3
> - **Temperature:** 80°C (avoid higher temps to reduce protodeboronation)
> - **Time:** 4-6 hours
> - **Degassing:** Critical — poor yields without proper degassing
>
> **Citations:**
> - [[EXP-2026-0042]]: [[Dr. Jane Mueller]] achieved 89% yield using Pd(PPh3)4 (5 mol%), X-Phos, K2CO3 in DMF at 80°C for 4 hours. Key insight: Bulky phosphine ligand significantly reduced protodeboronation. (2026-03-15)
> - [[EXP-2025-0312]]: [[Dr. Wei Chen]] achieved 84% yield at 80°C vs 68% at 100°C, demonstrating the importance of lower temperature for selectivity. (2025-11-08)
> - [[EXP-2025-0289]]: [[Dr. Anika Patel]] noted that degassing was critical — yields dropped from 78% to 45% when degassing was skipped. (2025-09-22)

---

## Relevance Scoring

### Formula

```
relevance_score = tag_match_count / total_tags_in_filter

Examples:
- Experiment has all 3 tags (reaction, substrate-class, challenge) → 3/3 = 1.0
- Experiment has 2 out of 3 tags → 2/3 = 0.67
- Experiment has 1 out of 3 tags → 1/3 = 0.33
```

### Quality Score

```
quality_score = (yield / 100) × 0.5 + (completeness_score / 100) × 0.3 + (recency_score / 100) × 0.2

Where:
- yield: Actual % yield (0-100)
- completeness_score: Based on data completeness (has conditions, notes, structure, etc.)
- recency_score: Based on experiment date (newer = higher score)
```

### Final Ranking

```
ranking_score = quality_score × relevance_score

Sort experiments by ranking_score (descending)
Read top 3 experiments
```

---

## Error Handling

### No Matching Reaction Type

If the reaction type page doesn't exist:
1. Check for alternative names (e.g., "Suzuki-Miyaura" vs "Suzuki")
2. Suggest closest match from Chemistry KB Index
3. Ask user to clarify

**Example:**
> "I couldn't find an exact match for 'Suzuki-Miyaura' in the Chemistry KB. Did you mean [[Suzuki-Coupling]]?"

---

### No Experiments Match Filters

If filtering returns 0 experiments:
1. Try partial match (2 out of 3 tags instead of 3 out of 3)
2. Remove least important filter (challenge < scale < substrate-class)
3. Inform user that results are broader than requested

**Example:**
> "No experiments found with all 3 filters (heteroaryl + medium scale + protodeboronation). Broadening to heteroaryl + protodeboronation — found 5 experiments."

---

### Experiment Page Missing Data

If an experiment page is incomplete:
1. Skip to next experiment
2. Note the data gap in your answer

**Example:**
> "[[EXP-2025-0289]] was relevant but lacked detailed conditions — skipped to [[EXP-2025-0287]] instead."

---

## Example Workflow Execution

### Input

> "What conditions work for Suzuki coupling on heteroaryl substrates to avoid protodeboronation?"

### Execution Log

```
1. Parse question:
   - reaction: suzuki-coupling
   - substrate-class: heteroaryl
   - challenge: protodeboronation

2. read_page("/kb/chemistry/index.md")
   → Found [[Suzuki-Coupling]] link

3. read_page("/kb/chemistry/reactions/Suzuki-Coupling.md")
   → Total experiments: 42
   → Key Learnings: "Use bulky phosphine ligands..." (top tip)

4. Filter experiments:
   - Tags: {reaction: suzuki-coupling, substrate-class: heteroaryl, challenge: protodeboronation}
   - Matched: 5 experiments
   - Top 3 by ranking: EXP-2026-0042 (0.89), EXP-2025-0312 (0.84), EXP-2025-0289 (0.78)

5. read_page("/kb/chemistry/experiments/EXP-2026-0042.md")
   → Extracted: Pd(PPh3)4, DMF, 80°C, 89% yield, Dr. Mueller

6. read_page("/kb/chemistry/experiments/EXP-2025-0312.md")
   → Extracted: Pd(PPh3)4, DMF, 80°C vs 100°C comparison, Dr. Chen

7. read_page("/kb/chemistry/experiments/EXP-2025-0289.md")
   → Extracted: Degassing critical, 78% yield, Dr. Patel

8. Compose answer (see Step 8 format above)
```

---

## Success Metrics

A successful workflow execution includes:
- At least 3 experiments cited
- Specific conditions extracted (catalyst, solvent, temp, time)
- Researcher attribution for each citation
- Dates for recency context
- Practical notes that go beyond just "it worked"

---

*Last updated: 2026-03-21 | This is the PRIMARY workflow for chemistry questions*
```

---

## Test Scenarios

### Integration Test: `tests/agent-workflows/find-similar-experiments.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '@/lib/agent-workflows/execute';

describe('Find Similar Experiments Workflow', () => {
  it('should navigate from question to cited answer', async () => {
    const input = "What conditions work for Suzuki coupling on heteroaryl substrates?";

    const result = await executeWorkflow('find-similar-experiments', { question: input });

    // Verify navigation path
    expect(result.pagesVisited).toContain('/kb/chemistry/index.md');
    expect(result.pagesVisited).toContain('/kb/chemistry/reactions/Suzuki-Coupling.md');
    expect(result.pagesVisited.filter((p) => p.includes('/experiments/')).length).toBeGreaterThanOrEqual(3);

    // Verify output format
    expect(result.answer).toContain('[[EXP-');
    expect(result.answer).toContain('[[Dr.');
    expect(result.answer).toContain('2026-');
    expect(result.answer).toContain('Pd(PPh3)4');
  });
});
```

---

## Dependencies

- **SKB-46.2:** Contextual Search Tags (filtering requires tags)

---

## Dev Notes

### This is the PRIMARY workflow

- All demos should use this workflow
- All agent training should reference this workflow
- All user documentation should link to this workflow

### Future Enhancements

- Add multi-hop workflows (e.g., "Similar experiments" + "Who to ask" combined)
- Add automated relevance tuning based on user feedback
- Add "Explain ranking" feature to show why experiments were ranked in specific order

---

**Last Updated:** 2026-03-21
