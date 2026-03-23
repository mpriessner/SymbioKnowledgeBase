# Story SKB-45.2: Quality Scoring Model

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.2
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-45.1 (practical notes must be extracted first)

---

## User Story

As a researcher or AI agent evaluating experiments, I want each experiment to have a computed quality score (1-5 scale), So that I can prioritize learning from high-quality experiments with complete data and successful outcomes.

---

## Acceptance Criteria

- [ ] Compute quality score for each experiment during sync pipeline
- [ ] Base score derived from yield_percent: >90%=5, >80%=4, >70%=3, >60%=2, <60%=1
- [ ] No yield data defaults to base score of 3 (neutral)
- [ ] Adjust +0.5 for: has practical notes, has full procedure, has products with purity data
- [ ] Adjust -0.5 for: status=failed, no reagent data
- [ ] Clamp final score to 1.0-5.0 range
- [ ] Round to nearest 0.5 (valid scores: 1.0, 1.5, 2.0, ..., 5.0)
- [ ] Store in experiment page frontmatter as `quality_score` field
- [ ] Update database schema to include `quality_score DECIMAL(3,1)` in page metadata
- [ ] Quality score visible on experiment pages (badge or star rating)
- [ ] Scoring algorithm documented in code comments
- [ ] TypeScript strict mode — no `any` types
- [ ] All functions have JSDoc comments

---

## Architecture Overview

```
Quality Scoring Pipeline
─────────────────────────

┌────────────────────────────────────────────────┐
│  ChemELN Experiment Data                        │
│  - yield_percent: 86.5                          │
│  - status: 'completed'                          │
│  - actual_procedure: {...} (JSONB)              │
│  - procedure_text: 'Full procedure...'          │
│  - reagents: [...] (array)                      │
│  - products: [{purity: 98.2}, ...] (array)      │
└────────────────────────────────────────────────┘
                    │
                    │ Sync Pipeline
                    ▼
┌────────────────────────────────────────────────┐
│  src/lib/chemeln/enrichment/                    │
│  quality-score.ts                                │
│                                                  │
│  computeQualityScore(experiment)                 │
│    ├─ baseScore = yieldToScore(yield_percent)   │
│    ├─ adjustments = computeAdjustments(...)     │
│    ├─ finalScore = baseScore + adjustments      │
│    ├─ clamp(finalScore, 1.0, 5.0)               │
│    └─ round(finalScore, 0.5)                    │
│                                                  │
│  yieldToScore(yield)                             │
│    └─ >90%=5, >80%=4, >70%=3, >60%=2, else=1   │
│                                                  │
│  computeAdjustments(experiment)                  │
│    ├─ +0.5 if hasPracticalNotes                 │
│    ├─ +0.5 if hasFullProcedure                  │
│    ├─ +0.5 if hasProductPurity                  │
│    ├─ -0.5 if status='failed'                   │
│    └─ -0.5 if noReagentData                     │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  SKB Experiment Page                            │
│                                                  │
│  Frontmatter:                                    │
│    quality_score: 4.5                           │
│                                                  │
│  Display:                                        │
│    Quality: ⭐⭐⭐⭐ (4.5/5)                      │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  Used by:                                       │
│  - SKB-45.3: Ranking key learnings              │
│  - SKB-45.4: Computing researcher expertise     │
│  - Agent queries: "Show high-quality experiments"│
└────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Extend Database Schema

**File: `prisma/schema.prisma`** (modify)

```prisma
model Page {
  // ... existing fields

  // Chemistry KB metadata (stored in page metadata JSONB)
  // Add to metadata JSON structure:
  // {
  //   "chemeln_id": string,
  //   "yield_percent": number,
  //   "status": string,
  //   "quality_score": number  // <-- NEW: 1.0 to 5.0, step 0.5
  // }
}
```

Run migration:
```bash
# No schema change needed — quality_score stored in existing metadata JSONB
# No migration required
```

---

### Step 2: Implement Quality Scoring Algorithm

**File: `src/lib/chemeln/enrichment/quality-score.ts`** (create)

```typescript
import type { ChemELNExperiment } from '../types';

/**
 * Quality score scale: 1.0 (lowest) to 5.0 (highest), increments of 0.5
 */
export type QualityScore = number; // 1.0 | 1.5 | 2.0 | ... | 5.0

/**
 * Convert yield percentage to base quality score.
 *
 * Scoring:
 * - >90%: 5 (excellent)
 * - >80%: 4 (good)
 * - >70%: 3 (acceptable)
 * - >60%: 2 (poor)
 * - ≤60%: 1 (very poor)
 * - null/undefined: 3 (neutral, no yield data)
 *
 * @param yieldPercent - Yield percentage (0-100) or null
 * @returns Base quality score (1-5)
 */
export function yieldToScore(yieldPercent: number | null | undefined): number {
  if (yieldPercent === null || yieldPercent === undefined) {
    return 3; // Neutral score when yield is unknown
  }

  if (yieldPercent > 90) return 5;
  if (yieldPercent > 80) return 4;
  if (yieldPercent > 70) return 3;
  if (yieldPercent > 60) return 2;
  return 1;
}

/**
 * Check if experiment has practical notes.
 *
 * @param actualProcedure - actual_procedure JSONB
 * @returns True if has notes, false otherwise
 */
function hasPracticalNotes(actualProcedure: unknown): boolean {
  if (!actualProcedure || typeof actualProcedure !== 'object') return false;

  const data = actualProcedure as Record<string, unknown>;

  // Has notes if: overall_notes, tips, or steps with deviations
  if (typeof data.overall_notes === 'string' && data.overall_notes.trim().length > 0) {
    return true;
  }

  if (Array.isArray(data.tips) && data.tips.length > 0) {
    return true;
  }

  if (Array.isArray(data.steps)) {
    return data.steps.some((step) => {
      if (!step || typeof step !== 'object') return false;
      const s = step as Record<string, unknown>;
      return (
        (typeof s.deviation === 'string' && s.deviation.trim().length > 0) ||
        (typeof s.observation === 'string' && s.observation.trim().length > 0)
      );
    });
  }

  return false;
}

/**
 * Check if experiment has full procedure text.
 *
 * @param procedureText - Procedure text field
 * @returns True if has substantial procedure (>100 chars), false otherwise
 */
function hasFullProcedure(procedureText: string | null | undefined): boolean {
  if (!procedureText || typeof procedureText !== 'string') return false;
  return procedureText.trim().length > 100;
}

/**
 * Check if experiment has products with purity data.
 *
 * @param products - Products array
 * @returns True if any product has purity data, false otherwise
 */
function hasProductPurity(products: unknown): boolean {
  if (!Array.isArray(products)) return false;

  return products.some((product) => {
    if (!product || typeof product !== 'object') return false;
    const p = product as Record<string, unknown>;
    return typeof p.purity === 'number' && p.purity > 0;
  });
}

/**
 * Check if experiment has reagent data.
 *
 * @param reagents - Reagents array
 * @returns True if has reagents, false otherwise
 */
function hasReagentData(reagents: unknown): boolean {
  if (!Array.isArray(reagents)) return false;
  return reagents.length > 0;
}

/**
 * Compute quality score adjustments based on data completeness and status.
 *
 * Adjustments:
 * - +0.5: Has practical notes (deviations/observations)
 * - +0.5: Has full procedure text (>100 chars)
 * - +0.5: Has products with purity data
 * - -0.5: Status is 'failed'
 * - -0.5: No reagent data
 *
 * @param experiment - ChemELN experiment data
 * @returns Total adjustment value
 */
export function computeAdjustments(experiment: ChemELNExperiment): number {
  let adjustment = 0;

  // Positive adjustments (data completeness)
  if (hasPracticalNotes(experiment.actual_procedure)) {
    adjustment += 0.5;
  }

  if (hasFullProcedure(experiment.procedure_text)) {
    adjustment += 0.5;
  }

  if (hasProductPurity(experiment.products)) {
    adjustment += 0.5;
  }

  // Negative adjustments (quality issues)
  if (experiment.status === 'failed') {
    adjustment -= 0.5;
  }

  if (!hasReagentData(experiment.reagents)) {
    adjustment -= 0.5;
  }

  return adjustment;
}

/**
 * Round value to nearest step.
 *
 * @param value - Value to round
 * @param step - Step size (e.g., 0.5)
 * @returns Rounded value
 */
function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Clamp value to range.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute quality score for an experiment.
 *
 * Algorithm:
 * 1. Base score from yield percentage (1-5)
 * 2. Apply adjustments for data completeness (+/-0.5 each)
 * 3. Clamp to 1.0-5.0 range
 * 4. Round to nearest 0.5
 *
 * @param experiment - ChemELN experiment data
 * @returns Quality score (1.0 to 5.0, step 0.5)
 */
export function computeQualityScore(experiment: ChemELNExperiment): QualityScore {
  // Step 1: Base score from yield
  const baseScore = yieldToScore(experiment.yield_percent);

  // Step 2: Compute adjustments
  const adjustments = computeAdjustments(experiment);

  // Step 3: Combine
  const rawScore = baseScore + adjustments;

  // Step 4: Clamp to valid range
  const clamped = clamp(rawScore, 1.0, 5.0);

  // Step 5: Round to nearest 0.5
  const rounded = roundToNearest(clamped, 0.5);

  return rounded;
}

/**
 * Format quality score for display.
 *
 * @param score - Quality score (1.0-5.0)
 * @returns Formatted string (e.g., "⭐⭐⭐⭐ (4.5/5)")
 */
export function formatQualityScore(score: QualityScore): string {
  const fullStars = Math.floor(score);
  const hasHalfStar = score % 1 !== 0;

  let stars = '⭐'.repeat(fullStars);
  if (hasHalfStar) {
    stars += '½';
  }

  return `${stars} (${score.toFixed(1)}/5)`;
}
```

---

### Step 3: Extend Experiment Type

**File: `src/lib/chemeln/types.ts`** (modify)

```typescript
export interface ChemELNExperiment {
  // ... existing fields

  yield_percent?: number | null;
  status?: 'completed' | 'failed' | 'in_progress' | null;
  actual_procedure?: unknown; // JSONB
  procedure_text?: string | null;
  reagents?: unknown[]; // Array of reagent objects
  products?: unknown[]; // Array of product objects with purity
}
```

---

### Step 4: Integration with Sync Pipeline

**File: `src/lib/chemeln/sync/experiment-sync.ts`** (modify)

```typescript
import { computeQualityScore } from '../enrichment/quality-score';

async function syncExperiment(experiment: ChemELNExperiment, tenantId: string): Promise<void> {
  // Compute quality score
  const qualityScore = computeQualityScore(experiment);

  // Create or update page
  await prisma.page.upsert({
    where: {
      tenant_id_path: {
        tenant_id: tenantId,
        path: `/experiments/${experiment.id}`,
      },
    },
    update: {
      metadata: {
        chemeln_id: experiment.id,
        yield_percent: experiment.yield_percent,
        status: experiment.status,
        quality_score: qualityScore, // <-- NEW
      },
      // ... other fields
    },
    create: {
      // ... same fields as update
    },
  });
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/chemeln/enrichment/quality-score.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computeQualityScore, yieldToScore, computeAdjustments, formatQualityScore } from '@/lib/chemeln/enrichment/quality-score';

describe('yieldToScore', () => {
  it('should score yields correctly', () => {
    expect(yieldToScore(95)).toBe(5);
    expect(yieldToScore(85)).toBe(4);
    expect(yieldToScore(75)).toBe(3);
    expect(yieldToScore(65)).toBe(2);
    expect(yieldToScore(55)).toBe(1);
  });

  it('should return neutral score for missing yield', () => {
    expect(yieldToScore(null)).toBe(3);
    expect(yieldToScore(undefined)).toBe(3);
  });
});

describe('computeAdjustments', () => {
  it('should apply positive adjustments', () => {
    const experiment = {
      actual_procedure: { overall_notes: 'Test notes' },
      procedure_text: 'A'.repeat(150),
      products: [{ purity: 98.5 }],
      reagents: [{ name: 'Reagent 1' }],
      status: 'completed',
    };

    const adjustment = computeAdjustments(experiment as any);
    expect(adjustment).toBe(1.5); // +0.5 + 0.5 + 0.5
  });

  it('should apply negative adjustments', () => {
    const experiment = {
      actual_procedure: null,
      procedure_text: '',
      products: [],
      reagents: [],
      status: 'failed',
    };

    const adjustment = computeAdjustments(experiment as any);
    expect(adjustment).toBe(-1.0); // -0.5 - 0.5
  });

  it('should apply mixed adjustments', () => {
    const experiment = {
      actual_procedure: { tips: ['Tip 1'] },
      procedure_text: '',
      products: [],
      reagents: [{ name: 'Reagent 1' }],
      status: 'completed',
    };

    const adjustment = computeAdjustments(experiment as any);
    expect(adjustment).toBe(0.5); // +0.5 (practical notes)
  });
});

describe('computeQualityScore', () => {
  it('should compute score for excellent experiment', () => {
    const experiment = {
      yield_percent: 92,
      actual_procedure: { overall_notes: 'Notes' },
      procedure_text: 'A'.repeat(150),
      products: [{ purity: 99 }],
      reagents: [{ name: 'Reagent 1' }],
      status: 'completed',
    };

    const score = computeQualityScore(experiment as any);
    expect(score).toBe(5.0); // Base 5 + 1.5 = 6.5 → clamped to 5.0
  });

  it('should compute score for poor experiment', () => {
    const experiment = {
      yield_percent: 50,
      actual_procedure: null,
      procedure_text: '',
      products: [],
      reagents: [],
      status: 'failed',
    };

    const score = computeQualityScore(experiment as any);
    expect(score).toBe(1.0); // Base 1 - 1.0 = 0 → clamped to 1.0
  });

  it('should compute score for average experiment', () => {
    const experiment = {
      yield_percent: 75,
      actual_procedure: null,
      procedure_text: 'Short procedure',
      products: [],
      reagents: [{ name: 'Reagent 1' }],
      status: 'completed',
    };

    const score = computeQualityScore(experiment as any);
    expect(score).toBe(3.0); // Base 3 + 0 = 3.0
  });

  it('should round to nearest 0.5', () => {
    const experiment = {
      yield_percent: 85, // Base score 4
      actual_procedure: { tips: ['Tip'] }, // +0.5
      procedure_text: '',
      products: [],
      reagents: [],
      status: 'failed', // -0.5
    };

    const score = computeQualityScore(experiment as any);
    expect(score).toBe(4.0); // 4 + 0.5 - 0.5 = 4.0
  });
});

describe('formatQualityScore', () => {
  it('should format integer scores', () => {
    expect(formatQualityScore(5.0)).toBe('⭐⭐⭐⭐⭐ (5.0/5)');
    expect(formatQualityScore(3.0)).toBe('⭐⭐⭐ (3.0/5)');
    expect(formatQualityScore(1.0)).toBe('⭐ (1.0/5)');
  });

  it('should format half scores', () => {
    expect(formatQualityScore(4.5)).toBe('⭐⭐⭐⭐½ (4.5/5)');
    expect(formatQualityScore(2.5)).toBe('⭐⭐½ (2.5/5)');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/enrichment/quality-score.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/quality-score.test.ts` |
| MODIFY | `src/lib/chemeln/types.ts` (add yield_percent, status, etc. to ChemELNExperiment) |
| MODIFY | `src/lib/chemeln/sync/experiment-sync.ts` (compute and store quality_score) |

---

## Dev Notes

### Scoring Philosophy

Quality score is NOT just yield percentage. It combines:
- **Outcome** (yield): Did the experiment work?
- **Documentation** (practical notes, procedure): Is it reproducible?
- **Verification** (purity data, reagents): Is it trustworthy?

A high-yield experiment with no documentation gets penalized. A failed experiment with excellent notes still scores low but higher than a failed experiment with no notes.

### Edge Cases

- **No yield data**: Common for exploratory experiments. Neutral score (3.0) prevents penalizing early-stage work.
- **Failed experiments with good notes**: Score 1.5-2.5. Still valuable for learning what NOT to do.
- **In-progress experiments**: Treated same as completed (status doesn't affect score unless 'failed').

### Display Recommendations

- **Experiment page**: Show badge "Quality: ⭐⭐⭐⭐ (4.5/5)"
- **Experiment lists**: Sort by quality_score DESC by default
- **Search results**: Include quality_score in ranking algorithm
- **Agent queries**: "Show me high-quality Suzuki coupling experiments" → filter quality_score >= 4.0

### Future Enhancements

- Machine learning model to predict quality from early indicators
- Time-weighted quality (recent experiments weighted higher)
- Peer review scores (if researchers rate each other's experiments)

---

**Last Updated:** 2026-03-21
