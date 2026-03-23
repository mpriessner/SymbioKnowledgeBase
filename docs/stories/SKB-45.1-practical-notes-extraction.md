# Story SKB-45.1: Practical Notes Extraction from Procedure Data

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** Epic 42 (ChemELN sync pipeline foundation)

---

## User Story

As a researcher browsing an experiment page, I want to see the practical notes extracted from ExpTube's video analysis (deviations from planned procedure, observations, tips), So that I can learn from the actual execution of the experiment without watching the full video.

---

## Acceptance Criteria

- [ ] Parse `actual_procedure` JSONB from ChemELN experiments table
- [ ] Extract structured steps with: step_number, planned_action, actual_action, timestamp, deviation, observation
- [ ] Extract overall_notes and tips array from JSONB root
- [ ] Generate "Practical Notes" section in experiment page markdown
- [ ] Section includes: "Deviations from Planned Procedure" subsection with formatted steps
- [ ] Section includes: "Key Takeaways" subsection with overall notes + tips as bullet list
- [ ] Include video timestamp references formatted as `MM:SS` with link to ExpTube entry
- [ ] Include source attribution: ExpTube entry ID and video URL
- [ ] Handle missing `actual_procedure` gracefully: display "No practical notes available" message
- [ ] Handle malformed JSONB gracefully: log warning, skip invalid fields, render what's parseable
- [ ] Truncate long practical notes at 2000 chars with "... [see full video]" link
- [ ] TypeScript strict mode — no `any` types
- [ ] All functions have JSDoc comments

---

## Architecture Overview

```
Practical Notes Extraction Flow
────────────────────────────────

┌────────────────────────────────────────────────┐
│  ChemELN Database                               │
│                                                  │
│  experiments.actual_procedure JSONB:             │
│  {                                               │
│    "exptube_entry_id": "ET-2024-0156",          │
│    "video_url": "https://...",                   │
│    "steps": [...],                               │
│    "overall_notes": "...",                       │
│    "tips": [...]                                 │
│  }                                               │
└────────────────────────────────────────────────┘
                    │
                    │ ChemELN Sync Pipeline
                    ▼
┌────────────────────────────────────────────────┐
│  src/lib/chemeln/enrichment/                    │
│  practical-notes.ts                              │
│                                                  │
│  parseActualProcedure(jsonb)                     │
│    ├─ Validate JSONB structure                  │
│    ├─ Extract steps array                       │
│    ├─ Extract overall_notes                     │
│    └─ Extract tips array                        │
│                                                  │
│  formatPracticalNotes(parsed)                    │
│    ├─ Generate "Deviations" subsection          │
│    ├─ Generate "Key Takeaways" subsection       │
│    ├─ Add source attribution                    │
│    └─ Truncate if > 2000 chars                  │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  SKB Experiment Page (markdown)                 │
│                                                  │
│  ## Practical Notes                             │
│                                                  │
│  ### Deviations from Planned Procedure          │
│  - **Step 1 (00:03:45)**: Used 10% excess...    │
│    - *Reason*: To ensure complete conversion    │
│    - *Observation*: White solid dissolved...    │
│                                                  │
│  ### Key Takeaways                              │
│  > Heteroaryl substrate required excess...      │
│  - Use 10% excess substrate for...              │
│                                                  │
│  ---                                             │
│  *Source: ExpTube entry [ET-2024-0156](...)*    │
└────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define ActualProcedure Type

**File: `src/lib/chemeln/enrichment/types.ts`** (create)

```typescript
/**
 * Structure of a single procedure step from ExpTube analysis.
 */
export interface ProcedureStep {
  step_number: number;
  planned_action?: string;
  actual_action?: string;
  timestamp?: string; // Format: "MM:SS" or "HH:MM:SS"
  deviation?: string; // Why actual differed from planned
  observation?: string; // What was observed during this step
}

/**
 * Full actual_procedure JSONB structure from ChemELN.
 */
export interface ActualProcedure {
  exptube_entry_id?: string;
  video_url?: string;
  steps?: ProcedureStep[];
  overall_notes?: string;
  tips?: string[];
}

/**
 * Parsed practical notes ready for rendering.
 */
export interface PracticalNotes {
  hasData: boolean;
  deviations: FormattedDeviation[];
  overallNotes?: string;
  tips: string[];
  source?: {
    entryId: string;
    videoUrl: string;
  };
}

/**
 * Formatted deviation for display.
 */
export interface FormattedDeviation {
  stepNumber: number;
  timestamp?: string;
  deviation: string;
  reason?: string;
  observation?: string;
}
```

---

### Step 2: Implement Parser

**File: `src/lib/chemeln/enrichment/practical-notes.ts`** (create)

```typescript
import type { ActualProcedure, PracticalNotes, FormattedDeviation } from './types';

/**
 * Parse actual_procedure JSONB from ChemELN.
 *
 * Handles missing fields gracefully. Logs warnings for malformed data.
 *
 * @param jsonbData - Raw JSONB data from ChemELN experiments.actual_procedure
 * @returns Parsed practical notes structure
 */
export function parseActualProcedure(jsonbData: unknown): PracticalNotes {
  // Handle null/undefined
  if (!jsonbData || typeof jsonbData !== 'object') {
    return {
      hasData: false,
      deviations: [],
      tips: [],
    };
  }

  const data = jsonbData as Record<string, unknown>;
  const parsed: PracticalNotes = {
    hasData: false,
    deviations: [],
    tips: [],
  };

  // Extract source information
  if (typeof data.exptube_entry_id === 'string' && typeof data.video_url === 'string') {
    parsed.source = {
      entryId: data.exptube_entry_id,
      videoUrl: data.video_url,
    };
  }

  // Extract overall notes
  if (typeof data.overall_notes === 'string' && data.overall_notes.trim().length > 0) {
    parsed.overallNotes = data.overall_notes.trim();
    parsed.hasData = true;
  }

  // Extract tips
  if (Array.isArray(data.tips)) {
    parsed.tips = data.tips
      .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0)
      .map((tip) => tip.trim());
    if (parsed.tips.length > 0) {
      parsed.hasData = true;
    }
  }

  // Extract and format deviations from steps
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (!step || typeof step !== 'object') continue;

      const s = step as Record<string, unknown>;

      // Only include steps with deviations or observations
      if (!s.deviation && !s.observation) continue;

      const deviation: FormattedDeviation = {
        stepNumber: typeof s.step_number === 'number' ? s.step_number : 0,
        timestamp: typeof s.timestamp === 'string' ? s.timestamp : undefined,
        deviation: '',
        reason: typeof s.deviation === 'string' ? s.deviation.trim() : undefined,
        observation: typeof s.observation === 'string' ? s.observation.trim() : undefined,
      };

      // Build deviation description
      if (typeof s.actual_action === 'string' && typeof s.planned_action === 'string') {
        deviation.deviation = `${s.actual_action} (planned: ${s.planned_action})`;
      } else if (typeof s.actual_action === 'string') {
        deviation.deviation = s.actual_action;
      } else if (typeof s.deviation === 'string') {
        deviation.deviation = s.deviation;
      }

      if (deviation.deviation || deviation.reason || deviation.observation) {
        parsed.deviations.push(deviation);
        parsed.hasData = true;
      }
    }
  }

  return parsed;
}

/**
 * Format practical notes as markdown section.
 *
 * Generates "Practical Notes" section with deviations and key takeaways.
 * Truncates at 2000 chars with link to full video.
 *
 * @param notes - Parsed practical notes
 * @param maxLength - Maximum section length (default: 2000)
 * @returns Markdown string
 */
export function formatPracticalNotes(notes: PracticalNotes, maxLength = 2000): string {
  if (!notes.hasData) {
    return '## Practical Notes\n\n*No practical notes available for this experiment.*\n';
  }

  const sections: string[] = ['## Practical Notes\n'];

  // Deviations subsection
  if (notes.deviations.length > 0) {
    sections.push('### Deviations from Planned Procedure\n');

    for (const dev of notes.deviations) {
      const timestamp = dev.timestamp ? ` (${dev.timestamp})` : '';
      sections.push(`- **Step ${dev.stepNumber}${timestamp}**: ${dev.deviation}`);

      if (dev.reason) {
        sections.push(`  - *Reason*: ${dev.reason}`);
      }

      if (dev.observation) {
        sections.push(`  - *Observation*: ${dev.observation}`);
      }

      sections.push(''); // Blank line between steps
    }
  }

  // Key takeaways subsection
  if (notes.overallNotes || notes.tips.length > 0) {
    sections.push('### Key Takeaways\n');

    if (notes.overallNotes) {
      sections.push(`> **${notes.overallNotes}**\n`);
    }

    if (notes.tips.length > 0) {
      for (const tip of notes.tips) {
        sections.push(`- ${tip}`);
      }
      sections.push(''); // Blank line
    }
  }

  // Source attribution
  if (notes.source) {
    sections.push('---');
    sections.push(
      `*Source: ExpTube entry [${notes.source.entryId}](${notes.source.videoUrl}) • Video recorded: ${new Date().toISOString().split('T')[0]}*\n`
    );
  }

  let markdown = sections.join('\n');

  // Truncate if too long
  if (markdown.length > maxLength && notes.source) {
    markdown = markdown.substring(0, maxLength);
    const lastNewline = markdown.lastIndexOf('\n');
    if (lastNewline > 0) {
      markdown = markdown.substring(0, lastNewline);
    }
    markdown += `\n\n... [see full video](${notes.source.videoUrl})\n`;
  }

  return markdown;
}

/**
 * Extract practical notes section for an experiment.
 *
 * Main entry point for enrichment pipeline.
 *
 * @param actualProcedureJson - Raw JSONB from ChemELN
 * @returns Markdown section to append to experiment page
 */
export function extractPracticalNotes(actualProcedureJson: unknown): string {
  const parsed = parseActualProcedure(actualProcedureJson);
  return formatPracticalNotes(parsed);
}
```

---

### Step 3: Integration with Sync Pipeline

**File: `src/lib/chemeln/sync/experiment-sync.ts`** (modify)

```typescript
import { extractPracticalNotes } from '../enrichment/practical-notes';

// In generateExperimentPageContent function:

async function generateExperimentPageContent(experiment: ChemELNExperiment): Promise<string> {
  const sections: string[] = [];

  // ... existing sections (overview, procedure, results, etc.)

  // Add practical notes section
  const practicalNotes = extractPracticalNotes(experiment.actual_procedure);
  sections.push(practicalNotes);

  // ... remaining sections

  return sections.join('\n\n');
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/enrichment/practical-notes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseActualProcedure, formatPracticalNotes, extractPracticalNotes } from '@/lib/chemeln/enrichment/practical-notes';

describe('parseActualProcedure', () => {
  it('should parse complete actual_procedure JSONB', () => {
    const jsonb = {
      exptube_entry_id: 'ET-2024-0156',
      video_url: 'https://exptube.internal/videos/ET-2024-0156',
      steps: [
        {
          step_number: 1,
          planned_action: 'Add 500 mg substrate',
          actual_action: 'Add 550 mg substrate',
          timestamp: '00:03:45',
          deviation: 'Used 10% excess',
          observation: 'Dissolved completely',
        },
      ],
      overall_notes: 'Heteroaryl substrate required excess',
      tips: ['Use 10% excess for this substrate class'],
    };

    const result = parseActualProcedure(jsonb);

    expect(result.hasData).toBe(true);
    expect(result.source?.entryId).toBe('ET-2024-0156');
    expect(result.deviations).toHaveLength(1);
    expect(result.deviations[0].stepNumber).toBe(1);
    expect(result.overallNotes).toBe('Heteroaryl substrate required excess');
    expect(result.tips).toHaveLength(1);
  });

  it('should handle missing actual_procedure', () => {
    const result = parseActualProcedure(null);
    expect(result.hasData).toBe(false);
    expect(result.deviations).toHaveLength(0);
  });

  it('should handle malformed JSONB gracefully', () => {
    const jsonb = {
      steps: [
        { step_number: 'invalid' }, // Invalid step_number type
        { step_number: 2, deviation: 123 }, // Invalid deviation type
      ],
      tips: ['Valid tip', null, 123], // Mixed types
    };

    const result = parseActualProcedure(jsonb);
    expect(result.tips).toHaveLength(1);
    expect(result.tips[0]).toBe('Valid tip');
  });

  it('should skip steps without deviations or observations', () => {
    const jsonb = {
      steps: [
        { step_number: 1, planned_action: 'Heat', actual_action: 'Heat' }, // No deviation
        { step_number: 2, deviation: 'Extended time' }, // Has deviation
      ],
    };

    const result = parseActualProcedure(jsonb);
    expect(result.deviations).toHaveLength(1);
    expect(result.deviations[0].stepNumber).toBe(2);
  });
});

describe('formatPracticalNotes', () => {
  it('should format complete practical notes', () => {
    const notes = {
      hasData: true,
      deviations: [
        {
          stepNumber: 1,
          timestamp: '00:03:45',
          deviation: 'Add 550 mg substrate (planned: 500 mg)',
          reason: 'Used 10% excess',
          observation: 'Dissolved completely',
        },
      ],
      overallNotes: 'Heteroaryl substrate required excess',
      tips: ['Use 10% excess'],
      source: {
        entryId: 'ET-2024-0156',
        videoUrl: 'https://exptube.internal/videos/ET-2024-0156',
      },
    };

    const markdown = formatPracticalNotes(notes);

    expect(markdown).toContain('## Practical Notes');
    expect(markdown).toContain('### Deviations from Planned Procedure');
    expect(markdown).toContain('**Step 1 (00:03:45)**');
    expect(markdown).toContain('*Reason*: Used 10% excess');
    expect(markdown).toContain('### Key Takeaways');
    expect(markdown).toContain('> **Heteroaryl substrate required excess**');
    expect(markdown).toContain('Source: ExpTube entry [ET-2024-0156]');
  });

  it('should handle empty notes', () => {
    const notes = {
      hasData: false,
      deviations: [],
      tips: [],
    };

    const markdown = formatPracticalNotes(notes);
    expect(markdown).toContain('No practical notes available');
  });

  it('should truncate long notes with link', () => {
    const longNotes = {
      hasData: true,
      deviations: Array(50).fill({
        stepNumber: 1,
        deviation: 'Very long deviation text that repeats many times',
      }),
      tips: [],
      source: {
        entryId: 'ET-2024-0156',
        videoUrl: 'https://exptube.internal/videos/ET-2024-0156',
      },
    };

    const markdown = formatPracticalNotes(longNotes, 500);
    expect(markdown.length).toBeLessThanOrEqual(600); // Allow some buffer
    expect(markdown).toContain('... [see full video]');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/enrichment/types.ts` |
| CREATE | `src/lib/chemeln/enrichment/practical-notes.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/practical-notes.test.ts` |
| MODIFY | `src/lib/chemeln/sync/experiment-sync.ts` (add practical notes section) |

---

## Dev Notes

### Expected actual_procedure Structure

The `actual_procedure` JSONB in ChemELN is populated by ExpTube's video analysis pipeline. Structure varies by ExpTube version:

- **V1 (2023)**: Simple `steps` array with `deviation` text only
- **V2 (2024)**: Added `timestamp`, `observation`, `overall_notes`
- **V3 (2025)**: Added `tips` array extracted by LLM

Parser must handle all versions gracefully.

### Timestamp Formats

ExpTube records timestamps in three formats:
- `MM:SS` (minutes:seconds) — most common
- `HH:MM:SS` (hours:minutes:seconds) — for long reactions
- `SS` (seconds only) — rare, early version

Parser accepts all formats without validation.

### Truncation Strategy

If practical notes exceed 2000 chars:
1. Truncate at last complete newline before limit
2. Append "... [see full video](url)" link
3. Ensure source attribution is preserved

### Integration Points

- Called by `experiment-sync.ts` during page generation
- Output inserted as markdown section (not TipTap JSON blocks)
- Section appears after "Results" section, before "Analysis" section

---

**Last Updated:** 2026-03-21
