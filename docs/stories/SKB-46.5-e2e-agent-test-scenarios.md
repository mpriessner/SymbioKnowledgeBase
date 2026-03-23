# Story SKB-46.5: End-to-End Agent Test Scenarios

**Epic:** Epic 46 - Agent Retrieval & Contextual Navigation
**Story ID:** SKB-46.5
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-46.4 ("Who Has Experience" workflow — both workflows tested together)

---

## User Story

As a KB developer, I want comprehensive end-to-end test scenarios that validate the full agent navigation experience, So that I can verify workflows work as designed from question to citation-backed answer.

---

## Acceptance Criteria

1. **Test Scenario Format**
   - [ ] Each scenario documented with:
     - Input question (user query)
     - Expected navigation path (which pages agent visits, in order)
     - Expected tags filtered (if applicable)
     - Expected experiments cited (minimum count)
     - Expected output structure (format requirements)
   - [ ] Scenarios stored in `tests/agent-workflows/test-scenarios.ts`

2. **Scenario 1: Heteroaryl Suzuki Coupling with Protodeboronation**
   - [ ] **Input:** "What conditions work for Suzuki coupling on heteroaryl substrates to avoid protodeboronation?"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Suzuki-Coupling]]` → filter experiments → read top 3 experiments
   - [ ] **Expected tags:** `reaction: suzuki-coupling`, `substrate-class: heteroaryl`, `challenge: protodeboronation`
   - [ ] **Expected citations:** At least 3 experiments with specific conditions, yields, researchers, dates
   - [ ] **Expected output:** Bulleted list of recommended conditions with citations

3. **Scenario 2: Grignard Scale-Up Expertise**
   - [ ] **Input:** "Who in our lab has done Grignard reactions at scale?"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Grignard-Reaction]]` → "Who To Ask" → read researcher profiles
   - [ ] **Expected tags:** `reaction: grignard-reaction`, `scale: large` or `scale: pilot`
   - [ ] **Expected output:** Ranked list of researchers with experiment count, avg yield, most recent work

4. **Scenario 3: Low Yield Amination Troubleshooting**
   - [ ] **Input:** "We're getting low yields on this amination — what did others try?"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Buchwald-Hartwig-Amination]]` → filter by `challenge: yield` → read experiments
   - [ ] **Expected citations:** At least 2 experiments with practical notes about yield improvement
   - [ ] **Expected output:** Specific troubleshooting tips (e.g., "degassing improved yield from X to Y")

5. **Scenario 4: Safety Precautions for Pd(PPh3)4**
   - [ ] **Input:** "What safety precautions for handling Pd(PPh3)4?"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Pd(PPh3)4]]` (Chemical page) → read safety notes
   - [ ] **Expected output:** Safety information (air-sensitive, storage conditions, handling tips)
   - [ ] **Fallback:** If Chemical page lacks safety data, check experiments that use it

6. **Scenario 5: Suzuki Coupling Trend Analysis**
   - [ ] **Input:** "Compare our Suzuki coupling results over the last 6 months"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Suzuki-Coupling]]` → `[[Recent Experiments]]` → filter by date
   - [ ] **Expected output:** Trend analysis (avg yield over time, common challenges, improvement patterns)

7. **Scenario 6: Pyridine Substrate Buchwald-Hartwig**
   - [ ] **Input:** "I need to do a Buchwald-Hartwig on a pyridine substrate — any tips?"
   - [ ] **Expected path:** `[[Chemistry KB]]` → `[[Buchwald-Hartwig-Amination]]` → filter `substrate-class: heteroaryl` → experiments
   - [ ] **Expected citations:** At least 2 experiments with pyridine-containing substrates
   - [ ] **Expected output:** Specific tips for heteroaryl amination (ligand choice, base, conditions)

8. **Test Harness**
   - [ ] MCP mock server that simulates KB page reads
   - [ ] Workflow executor that runs scenarios and captures tool calls
   - [ ] Assertion engine that validates:
     - Navigation path matches expected
     - Tags filtered correctly
     - Output contains required citations
     - Output format matches specification

9. **Validation Metrics**
   - [ ] **Navigation accuracy:** Did agent visit expected pages?
   - [ ] **Citation quality:** Did agent cite experiment IDs, researchers, dates?
   - [ ] **Relevance:** Did filtered experiments match user's context?
   - [ ] **Completeness:** Did answer include all required elements?

---

## Technical Implementation Notes

### Test Scenarios File

**File: `tests/agent-workflows/test-scenarios.ts`**

```typescript
export interface TestScenario {
  id: string;
  name: string;
  input: string;
  expectedNavigation: {
    pages: string[];
    tagsFiltered?: Record<string, string | string[]>;
    minExperimentsCited: number;
  };
  expectedOutput: {
    mustContain: string[];
    format: 'bulleted-list' | 'ranked-list' | 'paragraph' | 'table';
  };
}

export const TEST_SCENARIOS: TestScenario[] = [
  // Scenario 1: Heteroaryl Suzuki Coupling
  {
    id: 'suzuki-heteroaryl-protodeboronation',
    name: 'Suzuki Coupling on Heteroaryl Substrates with Protodeboronation',
    input: 'What conditions work for Suzuki coupling on heteroaryl substrates to avoid protodeboronation?',
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/reactions/Suzuki-Coupling.md',
        '/kb/chemistry/experiments/EXP-2026-0042.md',
        '/kb/chemistry/experiments/EXP-2025-0312.md',
        '/kb/chemistry/experiments/EXP-2025-0289.md',
      ],
      tagsFiltered: {
        reaction: 'suzuki-coupling',
        'substrate-class': 'heteroaryl',
        challenge: 'protodeboronation',
      },
      minExperimentsCited: 3,
    },
    expectedOutput: {
      mustContain: [
        '[[EXP-',
        '[[Dr.',
        'Pd(PPh3)4',
        '2026-',
        'yield',
        'Recommended conditions',
      ],
      format: 'bulleted-list',
    },
  },

  // Scenario 2: Grignard Scale-Up
  {
    id: 'grignard-scale-up-expertise',
    name: 'Grignard Reactions at Scale — Find Expert',
    input: 'Who in our lab has done Grignard reactions at scale?',
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/reactions/Grignard-Reaction.md',
        '/kb/chemistry/researchers/Dr-Wei-Chen.md',
        '/kb/chemistry/researchers/Dr-Anika-Patel.md',
      ],
      tagsFiltered: {
        reaction: 'grignard-reaction',
        scale: ['large', 'pilot'],
      },
      minExperimentsCited: 0, // This is an expertise query, not experiment query
    },
    expectedOutput: {
      mustContain: [
        '[[Dr.',
        'Experiments:',
        'Avg Yield:',
        'Most Recent:',
        'Key Tip:',
      ],
      format: 'ranked-list',
    },
  },

  // Scenario 3: Low Yield Troubleshooting
  {
    id: 'amination-low-yield-troubleshooting',
    name: 'Low Yield Amination Troubleshooting',
    input: "We're getting low yields on this amination — what did others try?",
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/reactions/Buchwald-Hartwig-Amination.md',
      ],
      tagsFiltered: {
        reaction: 'buchwald-hartwig-amination',
        challenge: 'yield',
      },
      minExperimentsCited: 2,
    },
    expectedOutput: {
      mustContain: [
        '[[EXP-',
        'yield',
        'improved from',
        'practical note',
      ],
      format: 'bulleted-list',
    },
  },

  // Scenario 4: Safety Precautions
  {
    id: 'pd-pph3-4-safety',
    name: 'Safety Precautions for Pd(PPh3)4',
    input: 'What safety precautions for handling Pd(PPh3)4?',
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/chemicals/Pd-PPh3-4.md',
      ],
      minExperimentsCited: 0,
    },
    expectedOutput: {
      mustContain: ['air-sensitive', 'storage', 'handling'],
      format: 'paragraph',
    },
  },

  // Scenario 5: Trend Analysis
  {
    id: 'suzuki-coupling-trend-analysis',
    name: 'Suzuki Coupling Results Over Last 6 Months',
    input: 'Compare our Suzuki coupling results over the last 6 months',
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/reactions/Suzuki-Coupling.md',
        '/kb/chemistry/recent-experiments.md',
      ],
      minExperimentsCited: 5,
    },
    expectedOutput: {
      mustContain: ['avg yield', 'trend', 'improvement', 'last 6 months'],
      format: 'paragraph',
    },
  },

  // Scenario 6: Pyridine Substrate Tips
  {
    id: 'buchwald-hartwig-pyridine',
    name: 'Buchwald-Hartwig on Pyridine Substrate',
    input: 'I need to do a Buchwald-Hartwig on a pyridine substrate — any tips?',
    expectedNavigation: {
      pages: [
        '/kb/chemistry/index.md',
        '/kb/chemistry/reactions/Buchwald-Hartwig-Amination.md',
      ],
      tagsFiltered: {
        reaction: 'buchwald-hartwig-amination',
        'substrate-class': 'heteroaryl',
      },
      minExperimentsCited: 2,
    },
    expectedOutput: {
      mustContain: ['[[EXP-', 'ligand', 'base', 'pyridine'],
      format: 'bulleted-list',
    },
  },
];
```

---

### Test Harness

**File: `tests/agent-workflows/mcp-mock.ts`**

```typescript
import { readFileSync } from 'fs';
import path from 'path';

export class MCPMockServer {
  private kbDir: string;
  private toolCalls: Array<{ tool: string; args: any }> = [];

  constructor(kbDir: string) {
    this.kbDir = kbDir;
  }

  readPage(args: { path: string }): string {
    this.toolCalls.push({ tool: 'read_page', args });
    const fullPath = path.join(this.kbDir, args.path);
    try {
      return readFileSync(fullPath, 'utf-8');
    } catch (err) {
      throw new Error(`Page not found: ${args.path}`);
    }
  }

  filterExperiments(args: { tags: Record<string, string | string[]> }): string[] {
    this.toolCalls.push({ tool: 'filter_experiments', args });

    // Scan all experiment pages, return matching IDs
    const experimentsDir = path.join(this.kbDir, 'chemistry/experiments');
    const files = readdirSync(experimentsDir);
    const matching = [];

    for (const file of files) {
      const content = readFileSync(path.join(experimentsDir, file), 'utf-8');
      const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (!yamlMatch) continue;

      const frontmatter = yaml.parse(yamlMatch[1]);
      const tags = frontmatter.tags || {};

      // Check if all filter tags match
      let matches = true;
      for (const [key, value] of Object.entries(args.tags)) {
        if (Array.isArray(value)) {
          if (!value.includes(tags[key])) matches = false;
        } else {
          if (tags[key] !== value) matches = false;
        }
      }

      if (matches) matching.push(file.replace('.md', ''));
    }

    return matching;
  }

  getToolCalls(): Array<{ tool: string; args: any }> {
    return this.toolCalls;
  }

  reset() {
    this.toolCalls = [];
  }
}
```

---

### E2E Test Suite

**File: `tests/agent-workflows/e2e-scenarios.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TEST_SCENARIOS } from './test-scenarios';
import { MCPMockServer } from './mcp-mock';
import { executeWorkflow } from '@/lib/agent-workflows/execute';

describe('E2E Agent Workflow Scenarios', () => {
  let mockServer: MCPMockServer;

  beforeEach(() => {
    mockServer = new MCPMockServer('/path/to/test-kb');
    mockServer.reset();
  });

  for (const scenario of TEST_SCENARIOS) {
    it(`should execute: ${scenario.name}`, async () => {
      const result = await executeWorkflow('auto-detect', {
        question: scenario.input,
        mcpServer: mockServer,
      });

      // Validate navigation path
      const toolCalls = mockServer.getToolCalls();
      const pagesVisited = toolCalls
        .filter((call) => call.tool === 'read_page')
        .map((call) => call.args.path);

      for (const expectedPage of scenario.expectedNavigation.pages) {
        expect(pagesVisited).toContain(expectedPage);
      }

      // Validate tag filtering
      if (scenario.expectedNavigation.tagsFiltered) {
        const filterCalls = toolCalls.filter((call) => call.tool === 'filter_experiments');
        expect(filterCalls.length).toBeGreaterThan(0);

        const filterArgs = filterCalls[0].args.tags;
        for (const [key, value] of Object.entries(scenario.expectedNavigation.tagsFiltered)) {
          expect(filterArgs[key]).toEqual(value);
        }
      }

      // Validate citations
      if (scenario.expectedNavigation.minExperimentsCited > 0) {
        const expMatches = result.answer.match(/\[\[EXP-\d{4}-\d{4}\]\]/g) || [];
        expect(expMatches.length).toBeGreaterThanOrEqual(
          scenario.expectedNavigation.minExperimentsCited,
        );
      }

      // Validate output contains required elements
      for (const mustContain of scenario.expectedOutput.mustContain) {
        expect(result.answer).toContain(mustContain);
      }
    });
  }
});
```

---

## Test Scenarios

### Validation Metrics

For each test scenario, measure:

1. **Navigation Accuracy:** % of expected pages visited
2. **Citation Quality:** % of citations with all required elements (ID, researcher, date)
3. **Relevance:** % of cited experiments matching user's tags
4. **Completeness:** % of required output elements present

**Pass criteria:** All 4 metrics >= 90% for each scenario.

---

## Dependencies

- **SKB-46.4:** "Who Has Experience" workflow (both workflows tested)

---

## Dev Notes

### Test Data Setup

- Create a small test KB with ~20 experiments covering all scenarios
- Use realistic data (actual reaction types, plausible yields, coherent practical notes)
- Include edge cases (missing data, ambiguous queries, no matches)

### Continuous Testing

- Run E2E scenarios on every sync to validate KB structure
- Add new scenarios as new query patterns emerge
- Track scenario pass rate over time (aim for 100%)

---

**Last Updated:** 2026-03-21
