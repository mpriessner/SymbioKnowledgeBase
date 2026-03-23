# Story SKB-43.2: Experiment Data Fetcher with Relations

**Epic:** Epic 43 - ChemELN Data Extraction & Transformation
**Story ID:** SKB-43.2
**Story Points:** 4 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-43.1 (ChemELN reader client must exist)

---

## User Story

As a data extraction service, I want to fetch experiment data with all related reagents, products, and procedures from ChemELN, So that I can transform it into a structured intermediate format for knowledge base generation.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/fetcher.ts` exports `fetchExperiments()` function
- [ ] Fetch experiments with Supabase `.select()` joins to include reagents, products, chemical references
- [ ] Extract `actual_procedure` JSONB field (structured steps pushed by ExpTube AI)
- [ ] Extract `procedure_metadata` field
- [ ] Handle null/missing fields gracefully (optional fields default to null or empty arrays)
- [ ] Transform raw Supabase rows into `ExperimentData[]` intermediate type
- [ ] Support filtering by date range (created_at >= start AND created_at <= end)
- [ ] Support filtering by experiment status (draft, active, completed, archived)
- [ ] Support filtering by experiment ID (single experiment fetch)
- [ ] Complete TypeScript interfaces defined in `src/lib/chemeln/types.ts` for all data structures
- [ ] Unit tests verify type transformations, null handling, filter logic
- [ ] Integration test fetches real experiment data from ChemELN

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  ChemELN Database Schema                            │
│                                                     │
│  experiments {                                      │
│    id: uuid                                         │
│    title: text                                      │
│    objective: text                                  │
│    experiment_type: text                            │
│    status: text                                     │
│    created_by: uuid → auth.users.id                 │
│    created_at: timestamp                            │
│    actual_procedure: jsonb (from ExpTube AI)        │
│    procedure_metadata: jsonb                        │
│  }                                                  │
│                                                     │
│  reagents {                                         │
│    id: uuid                                         │
│    experiment_id: uuid → experiments.id             │
│    chemical_id: uuid → chemicals.id                 │
│    amount: numeric                                  │
│    unit: text                                       │
│  }                                                  │
│                                                     │
│  products {                                         │
│    id: uuid                                         │
│    experiment_id: uuid → experiments.id             │
│    chemical_id: uuid → chemicals.id                 │
│    yield: numeric                                   │
│    unit: text                                       │
│  }                                                  │
│                                                     │
│  chemicals {                                        │
│    id: uuid                                         │
│    name: text                                       │
│    cas_number: text (nullable)                      │
│    molecular_formula: text                          │
│  }                                                  │
└─────────────────────────────────────────────────────┘
              │
              │ SELECT with joins
              ▼
┌─────────────────────────────────────────────────────┐
│  fetchExperiments(filters?)                         │
│                                                     │
│  const { data, error } = await client               │
│    .from('experiments')                             │
│    .select(`                                        │
│      *,                                             │
│      reagents (                                     │
│        id, amount, unit,                            │
│        chemical:chemicals (*)                       │
│      ),                                             │
│      products (                                     │
│        id, yield, unit,                             │
│        chemical:chemicals (*)                       │
│      )                                              │
│    `)                                               │
│    .applyFilters(filters);                         │
└─────────────────────────────────────────────────────┘
              │
              │ Transform
              ▼
┌─────────────────────────────────────────────────────┐
│  ExperimentData[] (Intermediate Type)               │
│                                                     │
│  {                                                  │
│    id: string                                       │
│    title: string                                    │
│    objective: string | null                         │
│    experimentType: string                           │
│    status: string                                   │
│    createdBy: string (UUID)                         │
│    createdAt: string (ISO)                          │
│    actualProcedure: ProcedureStep[] | null          │
│    procedureMetadata: Record<string, unknown> | null│
│    reagents: ReagentData[]                          │
│    products: ProductData[]                          │
│  }                                                  │
└─────────────────────────────────────────────────────┘
```

**Why joined queries:** Supabase's `.select()` syntax allows fetching related data in a single query, avoiding N+1 query problems. Instead of fetching experiments, then looping to fetch reagents/products, we get everything in one round-trip.

**Why `actual_procedure` JSONB:** ExpTube (AI video analysis tool) pushes structured procedure steps to ChemELN as JSONB. This field contains the AI-extracted step-by-step protocol from lab videos.

---

## Implementation Steps

### Step 1: Define Intermediate TypeScript Types

Create `src/lib/chemeln/types.ts` with all data structures.

**File: `src/lib/chemeln/types.ts`**

```typescript
export interface ProcedureStep {
  stepNumber: number;
  action: string;
  duration?: string;
  temperature?: string;
  equipment?: string[];
}

export interface ChemicalData {
  id: string;
  name: string;
  casNumber: string | null;
  molecularFormula: string | null;
}

export interface ReagentData {
  id: string;
  chemical: ChemicalData;
  amount: number;
  unit: string;
}

export interface ProductData {
  id: string;
  chemical: ChemicalData;
  yield: number | null;
  unit: string;
}

export interface ExperimentData {
  id: string;
  title: string;
  objective: string | null;
  experimentType: string;
  status: string;
  createdBy: string; // UUID
  createdAt: string; // ISO 8601 timestamp
  actualProcedure: ProcedureStep[] | null;
  procedureMetadata: Record<string, unknown> | null;
  reagents: ReagentData[];
  products: ProductData[];
}

export interface FetchExperimentsFilters {
  dateRange?: {
    start: string; // ISO 8601
    end: string;   // ISO 8601
  };
  status?: string;
  experimentId?: string;
}
```

**Type decisions:**
- All IDs are `string` (UUIDs stringify for JSON serialization)
- Timestamps are `string` (ISO 8601) not `Date` objects (serializable)
- Nullable fields explicitly typed with `| null` (strict mode)
- `procedureMetadata` is `Record<string, unknown>` (arbitrary JSON, no schema)

---

### Step 2: Implement Raw Data Transformation

Create helper functions to transform Supabase rows into intermediate types.

**Add to `src/lib/chemeln/fetcher.ts`:**

```typescript
import { ExperimentData, ChemicalData, ReagentData, ProductData } from './types';

function transformChemical(raw: any): ChemicalData {
  return {
    id: raw.id,
    name: raw.name ?? 'Unknown Chemical',
    casNumber: raw.cas_number ?? null,
    molecularFormula: raw.molecular_formula ?? null,
  };
}

function transformReagent(raw: any): ReagentData {
  return {
    id: raw.id,
    chemical: transformChemical(raw.chemical),
    amount: raw.amount ?? 0,
    unit: raw.unit ?? 'g',
  };
}

function transformProduct(raw: any): ProductData {
  return {
    id: raw.id,
    chemical: transformChemical(raw.chemical),
    yield: raw.yield ?? null,
    unit: raw.unit ?? 'g',
  };
}

function transformExperiment(raw: any): ExperimentData {
  return {
    id: raw.id,
    title: raw.title ?? 'Untitled Experiment',
    objective: raw.objective ?? null,
    experimentType: raw.experiment_type ?? 'Unknown',
    status: raw.status ?? 'draft',
    createdBy: raw.created_by,
    createdAt: new Date(raw.created_at).toISOString(),
    actualProcedure: raw.actual_procedure ?? null,
    procedureMetadata: raw.procedure_metadata ?? null,
    reagents: (raw.reagents ?? []).map(transformReagent),
    products: (raw.products ?? []).map(transformProduct),
  };
}
```

**Null handling:**
- `??` operator provides defaults for missing fields
- Chemical names default to "Unknown Chemical" if missing
- Empty arrays (`[]`) for missing reagents/products
- `null` for missing optional fields (objective, yields, metadata)

---

### Step 3: Implement fetchExperiments with Filters

Create the main fetcher function with filtering support.

**Add to `src/lib/chemeln/fetcher.ts`:**

```typescript
import { getChemELNClient } from './client';
import { FetchExperimentsFilters } from './types';

export async function fetchExperiments(
  filters?: FetchExperimentsFilters
): Promise<ExperimentData[]> {
  const client = getChemELNClient();

  let query = client
    .from('experiments')
    .select(`
      *,
      reagents (
        id,
        amount,
        unit,
        chemical:chemicals (
          id,
          name,
          cas_number,
          molecular_formula
        )
      ),
      products (
        id,
        yield,
        unit,
        chemical:chemicals (
          id,
          name,
          cas_number,
          molecular_formula
        )
      )
    `);

  // Apply filters
  if (filters?.experimentId) {
    query = query.eq('id', filters.experimentId);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.dateRange) {
    query = query
      .gte('created_at', filters.dateRange.start)
      .lte('created_at', filters.dateRange.end);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch experiments: ${error.message}`);
  }

  return (data ?? []).map(transformExperiment);
}
```

**Filter logic:**
- `experimentId` → `.eq('id', ...)` (exact match)
- `status` → `.eq('status', ...)` (exact match: draft, active, completed, archived)
- `dateRange` → `.gte('created_at', start).lte('created_at', end)` (inclusive range)

---

### Step 4: Add Convenience Functions

Add single-experiment fetch and status-specific helpers.

**Add to `src/lib/chemeln/fetcher.ts`:**

```typescript
export async function fetchExperimentById(
  experimentId: string
): Promise<ExperimentData | null> {
  const results = await fetchExperiments({ experimentId });
  return results[0] ?? null;
}

export async function fetchCompletedExperiments(): Promise<ExperimentData[]> {
  return fetchExperiments({ status: 'completed' });
}

export async function fetchExperimentsByDateRange(
  start: string,
  end: string
): Promise<ExperimentData[]> {
  return fetchExperiments({ dateRange: { start, end } });
}
```

---

### Step 5: Export Public API

Update `src/lib/chemeln/index.ts` to expose fetcher functions.

**Add to `src/lib/chemeln/index.ts`:**

```typescript
export {
  fetchExperiments,
  fetchExperimentById,
  fetchCompletedExperiments,
  fetchExperimentsByDateRange,
} from './fetcher';

export type {
  ExperimentData,
  ChemicalData,
  ReagentData,
  ProductData,
  ProcedureStep,
  FetchExperimentsFilters,
} from './types';
```

---

## Testing Requirements

### Unit Test: `tests/unit/chemeln/fetcher.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { transformChemical, transformReagent, transformExperiment } from '@/lib/chemeln/fetcher';

describe('Experiment Data Transformation', () => {
  it('should transform raw chemical data with null handling', () => {
    const raw = {
      id: '123',
      name: 'Sodium Chloride',
      cas_number: '7647-14-5',
      molecular_formula: 'NaCl',
    };

    const transformed = transformChemical(raw);

    expect(transformed.id).toBe('123');
    expect(transformed.name).toBe('Sodium Chloride');
    expect(transformed.casNumber).toBe('7647-14-5');
    expect(transformed.molecularFormula).toBe('NaCl');
  });

  it('should handle missing chemical name with default', () => {
    const raw = { id: '123', name: null };

    const transformed = transformChemical(raw);

    expect(transformed.name).toBe('Unknown Chemical');
  });

  it('should transform experiment with nested reagents and products', () => {
    const raw = {
      id: 'exp-1',
      title: 'Test Experiment',
      experiment_type: 'Suzuki Coupling',
      status: 'completed',
      created_by: 'user-1',
      created_at: '2026-03-21T10:00:00Z',
      reagents: [
        {
          id: 'r1',
          amount: 5,
          unit: 'g',
          chemical: { id: 'c1', name: 'Reagent A', cas_number: '123-45-6' },
        },
      ],
      products: [
        {
          id: 'p1',
          yield: 80,
          unit: '%',
          chemical: { id: 'c2', name: 'Product B', cas_number: '789-01-2' },
        },
      ],
    };

    const transformed = transformExperiment(raw);

    expect(transformed.id).toBe('exp-1');
    expect(transformed.title).toBe('Test Experiment');
    expect(transformed.experimentType).toBe('Suzuki Coupling');
    expect(transformed.reagents).toHaveLength(1);
    expect(transformed.reagents[0].chemical.name).toBe('Reagent A');
    expect(transformed.products).toHaveLength(1);
    expect(transformed.products[0].yield).toBe(80);
  });
});
```

### Integration Test: `tests/integration/chemeln/fetcher.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { fetchExperiments, fetchExperimentById } from '@/lib/chemeln';

describe('Experiment Fetcher (Integration)', () => {
  it('should fetch all experiments with reagents and products', async () => {
    const experiments = await fetchExperiments();

    expect(Array.isArray(experiments)).toBe(true);
    if (experiments.length > 0) {
      const first = experiments[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('reagents');
      expect(first).toHaveProperty('products');
    }
  }, 15000);

  it('should fetch completed experiments only', async () => {
    const experiments = await fetchExperiments({ status: 'completed' });

    experiments.forEach(exp => {
      expect(exp.status).toBe('completed');
    });
  }, 15000);

  it('should fetch experiment by ID', async () => {
    const allExperiments = await fetchExperiments();
    if (allExperiments.length === 0) return; // No data to test

    const testId = allExperiments[0].id;
    const experiment = await fetchExperimentById(testId);

    expect(experiment).not.toBeNull();
    expect(experiment?.id).toBe(testId);
  }, 15000);
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/types.ts` |
| CREATE | `src/lib/chemeln/fetcher.ts` |
| MODIFY | `src/lib/chemeln/index.ts` |
| CREATE | `tests/unit/chemeln/fetcher.test.ts` |
| CREATE | `tests/integration/chemeln/fetcher.test.ts` |

---

## Dev Notes

**ExpTube AI integration:** The `actual_procedure` field is populated by ExpTube's computer vision system, which watches lab videos and extracts structured steps (actions, durations, equipment used). This field may be `null` for older experiments that predate ExpTube integration.

**Procedure metadata:** The `procedure_metadata` field contains arbitrary key-value data (timestamps, video IDs, AI confidence scores). We store it as `Record<string, unknown>` without enforcing a schema, allowing ExpTube to evolve its metadata format independently.

**Performance consideration:** For large result sets (thousands of experiments), consider adding pagination support using the `applyPagination()` helper from SKB-43.1. The current implementation fetches all matching experiments in a single query, which may timeout for very large datasets.

---

**Last Updated:** 2026-03-21
