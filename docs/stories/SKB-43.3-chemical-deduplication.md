# Story SKB-43.3: Chemical Deduplication & Normalization

**Epic:** Epic 43 - ChemELN Data Extraction & Transformation
**Story ID:** SKB-43.3
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-43.2 (experiment data must be fetched)

---

## User Story

As a data normalization service, I want to deduplicate and normalize chemical records across experiments, So that I can produce a unified chemical inventory with synonym mappings and usage statistics.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/normalizers/chemicals.ts` exports `deduplicateChemicals()` function
- [ ] Primary matching by CAS number (if present) — chemicals with same CAS are merged
- [ ] Secondary matching by normalized name (trim whitespace, lowercase, remove special characters)
- [ ] Normalize chemical names: consistent casing (Title Case), trim whitespace, handle Unicode characters
- [ ] Build synonym registry: map alternative names to canonical name (e.g., THF → Tetrahydrofuran, DCM → Dichloromethane)
- [ ] Merge duplicate entries from different experiments into single `ChemicalRecord` with combined usage count
- [ ] Output `ChemicalRecord[]` with: unique CAS numbers, normalized names, synonym arrays, usage counts per chemical
- [ ] Handle missing CAS numbers gracefully (chemicals without CAS deduplicated by name only)
- [ ] Unit tests verify CAS matching, name normalization, synonym registry
- [ ] Integration test deduplicates real experiment data from ChemELN

---

## Architecture Overview

```
Input: ExperimentData[]
    │
    │ Extract all chemicals from reagents + products
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Raw Chemical List (with duplicates)                │
│  [                                                  │
│    { id: 'c1', name: 'THF', casNumber: '109-99-9' },│
│    { id: 'c2', name: 'tetrahydrofuran',             │
│      casNumber: '109-99-9' },                       │
│    { id: 'c3', name: 'DCM', casNumber: '75-09-2' }, │
│    { id: 'c4', name: 'Dichloromethane',             │
│      casNumber: '75-09-2' },                        │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ Group by CAS number (primary key)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  CAS Groups                                         │
│  {                                                  │
│    '109-99-9': ['THF', 'tetrahydrofuran'],          │
│    '75-09-2': ['DCM', 'Dichloromethane'],           │
│  }                                                  │
└─────────────────────────────────────────────────────┘
    │
    │ Select canonical name (longest or most common)
    │ Build synonym list
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  ChemicalRecord[]                                   │
│  [                                                  │
│    {                                                │
│      casNumber: '109-99-9',                         │
│      canonicalName: 'Tetrahydrofuran',              │
│      synonyms: ['THF', 'tetrahydrofuran'],          │
│      usageCount: 12, // 12 experiments used this    │
│    },                                               │
│    {                                                │
│      casNumber: '75-09-2',                          │
│      canonicalName: 'Dichloromethane',              │
│      synonyms: ['DCM', 'Dichloromethane'],          │
│      usageCount: 8,                                 │
│    },                                               │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
```

**Why CAS numbers are primary keys:** CAS (Chemical Abstracts Service) numbers are globally unique identifiers for chemicals. Unlike names (which have synonyms, abbreviations, IUPAC vs. common names), CAS numbers unambiguously identify substances.

**Why synonym registries:** Researchers use different names for the same chemical (THF vs. Tetrahydrofuran, EtOH vs. Ethanol). The synonym registry allows full-text search to find experiments regardless of which name was used.

---

## Implementation Steps

### Step 1: Define ChemicalRecord Type

Add the output type to `src/lib/chemeln/types.ts`.

**Add to `src/lib/chemeln/types.ts`:**

```typescript
export interface ChemicalRecord {
  casNumber: string | null;
  canonicalName: string;
  synonyms: string[];
  usageCount: number;
  molecularFormula: string | null;
}
```

---

### Step 2: Implement Name Normalization

Create helper functions to normalize chemical names for comparison.

**File: `src/lib/chemeln/normalizers/chemicals.ts`**

```typescript
function normalizeChemicalName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Remove special characters
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Normalization logic:**
- `normalizeChemicalName()`: Used for comparison (removes spaces, punctuation, casing differences)
- `toTitleCase()`: Used for canonical name formatting (e.g., "sodium chloride" → "Sodium Chloride")

---

### Step 3: Extract Chemicals from Experiments

Create a function to extract all chemicals (from reagents and products) across all experiments.

**Add to `src/lib/chemeln/normalizers/chemicals.ts`:**

```typescript
import { ExperimentData, ChemicalData } from '../types';

interface ChemicalWithUsage extends ChemicalData {
  experimentIds: string[];
}

function extractChemicals(experiments: ExperimentData[]): ChemicalWithUsage[] {
  const chemicalsMap = new Map<string, ChemicalWithUsage>();

  for (const exp of experiments) {
    // Extract from reagents
    for (const reagent of exp.reagents) {
      const chem = reagent.chemical;
      const key = chem.casNumber ?? normalizeChemicalName(chem.name);

      if (!chemicalsMap.has(key)) {
        chemicalsMap.set(key, {
          ...chem,
          experimentIds: [],
        });
      }

      const existing = chemicalsMap.get(key)!;
      if (!existing.experimentIds.includes(exp.id)) {
        existing.experimentIds.push(exp.id);
      }
    }

    // Extract from products
    for (const product of exp.products) {
      const chem = product.chemical;
      const key = chem.casNumber ?? normalizeChemicalName(chem.name);

      if (!chemicalsMap.has(key)) {
        chemicalsMap.set(key, {
          ...chem,
          experimentIds: [],
        });
      }

      const existing = chemicalsMap.get(key)!;
      if (!existing.experimentIds.includes(exp.id)) {
        existing.experimentIds.push(exp.id);
      }
    }
  }

  return Array.from(chemicalsMap.values());
}
```

**Key logic:**
- Use `casNumber` as primary key (if present), else use normalized name
- Track experiment IDs for usage count (avoid double-counting if chemical appears as both reagent and product in same experiment)

---

### Step 4: Group Chemicals by CAS Number

Create a function to group chemicals with the same CAS number and collect synonyms.

**Add to `src/lib/chemeln/normalizers/chemicals.ts`:**

```typescript
import { ChemicalRecord } from '../types';

function groupByCAS(chemicals: ChemicalWithUsage[]): Map<string, ChemicalWithUsage[]> {
  const groups = new Map<string, ChemicalWithUsage[]>();

  for (const chem of chemicals) {
    const key = chem.casNumber ?? normalizeChemicalName(chem.name);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(chem);
  }

  return groups;
}
```

---

### Step 5: Merge Duplicates and Build ChemicalRecords

Create the main deduplication function.

**Add to `src/lib/chemeln/normalizers/chemicals.ts`:**

```typescript
export function deduplicateChemicals(experiments: ExperimentData[]): ChemicalRecord[] {
  const allChemicals = extractChemicals(experiments);
  const groups = groupByCAS(allChemicals);

  const deduplicated: ChemicalRecord[] = [];

  for (const [key, chemGroup] of groups.entries()) {
    // Collect all unique names (synonyms)
    const uniqueNames = new Set(chemGroup.map(c => c.name));

    // Select canonical name (longest name, likely IUPAC or full common name)
    const canonicalName = Array.from(uniqueNames)
      .sort((a, b) => b.length - a.length)[0];

    // Collect all experiment IDs
    const allExperimentIds = new Set<string>();
    chemGroup.forEach(c => c.experimentIds.forEach(id => allExperimentIds.add(id)));

    // Get CAS number (should be same across group, or null)
    const casNumber = chemGroup[0].casNumber;

    // Get molecular formula (prefer non-null value if available)
    const molecularFormula = chemGroup.find(c => c.molecularFormula)?.molecularFormula ?? null;

    deduplicated.push({
      casNumber,
      canonicalName: toTitleCase(canonicalName),
      synonyms: Array.from(uniqueNames).filter(name => name !== canonicalName),
      usageCount: allExperimentIds.size,
      molecularFormula,
    });
  }

  // Sort by usage count (most used chemicals first)
  return deduplicated.sort((a, b) => b.usageCount - a.usageCount);
}
```

**Canonical name selection:**
- Choose the longest name in the synonym group (likely the full IUPAC or common name)
- Example: ["THF", "Tetrahydrofuran"] → "Tetrahydrofuran" is canonical, "THF" is synonym

**Usage count:**
- Count unique experiments (not total occurrences)
- If THF appears in 12 experiments (as reagent or product), `usageCount = 12`

---

### Step 6: Add Common Synonym Mappings

Create a predefined synonym registry for common chemical abbreviations.

**Add to `src/lib/chemeln/normalizers/chemicals.ts`:**

```typescript
const COMMON_SYNONYMS: Record<string, string> = {
  'thf': 'tetrahydrofuran',
  'dcm': 'dichloromethane',
  'dmf': 'dimethylformamide',
  'dmso': 'dimethyl sulfoxide',
  'etoh': 'ethanol',
  'meoh': 'methanol',
  'acn': 'acetonitrile',
  'et2o': 'diethyl ether',
  'etoac': 'ethyl acetate',
  'hex': 'hexane',
  'toluene': 'methylbenzene',
};

function expandSynonyms(chemicals: ChemicalRecord[]): ChemicalRecord[] {
  return chemicals.map(chem => {
    const normalizedCanonical = normalizeChemicalName(chem.canonicalName);

    // Check if canonical name matches a known synonym
    if (COMMON_SYNONYMS[normalizedCanonical]) {
      const expandedName = COMMON_SYNONYMS[normalizedCanonical];
      return {
        ...chem,
        canonicalName: toTitleCase(expandedName),
        synonyms: [...chem.synonyms, chem.canonicalName],
      };
    }

    // Add known abbreviations to synonyms
    const abbreviations = Object.keys(COMMON_SYNONYMS).filter(
      abbr => COMMON_SYNONYMS[abbr] === normalizedCanonical
    );

    return {
      ...chem,
      synonyms: [...chem.synonyms, ...abbreviations.map(toTitleCase)],
    };
  });
}
```

**Why common synonyms:** Researchers often use abbreviations (THF, DCM) in lab notebooks. The predefined registry ensures these synonyms are captured even if they don't appear in the raw data.

---

### Step 7: Export Public API

Update `src/lib/chemeln/index.ts` to expose the deduplication function.

**Add to `src/lib/chemeln/index.ts`:**

```typescript
export { deduplicateChemicals } from './normalizers/chemicals';
export type { ChemicalRecord } from './types';
```

---

## Testing Requirements

### Unit Test: `tests/unit/chemeln/normalizers/chemicals.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { deduplicateChemicals } from '@/lib/chemeln/normalizers/chemicals';
import { ExperimentData } from '@/lib/chemeln/types';

describe('Chemical Deduplication', () => {
  it('should deduplicate chemicals with same CAS number', () => {
    const experiments: ExperimentData[] = [
      {
        id: 'exp1',
        reagents: [
          {
            id: 'r1',
            chemical: {
              id: 'c1',
              name: 'THF',
              casNumber: '109-99-9',
              molecularFormula: 'C4H8O',
            },
            amount: 10,
            unit: 'mL',
          },
        ],
        products: [],
        // ... other required fields
      },
      {
        id: 'exp2',
        reagents: [
          {
            id: 'r2',
            chemical: {
              id: 'c2',
              name: 'Tetrahydrofuran',
              casNumber: '109-99-9',
              molecularFormula: 'C4H8O',
            },
            amount: 15,
            unit: 'mL',
          },
        ],
        products: [],
        // ... other required fields
      },
    ];

    const deduplicated = deduplicateChemicals(experiments);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].casNumber).toBe('109-99-9');
    expect(deduplicated[0].canonicalName).toBe('Tetrahydrofuran');
    expect(deduplicated[0].synonyms).toContain('THF');
    expect(deduplicated[0].usageCount).toBe(2);
  });

  it('should normalize chemical names', () => {
    const experiments: ExperimentData[] = [
      {
        id: 'exp1',
        reagents: [
          {
            id: 'r1',
            chemical: {
              id: 'c1',
              name: 'sodium chloride',
              casNumber: '7647-14-5',
              molecularFormula: 'NaCl',
            },
            amount: 1,
            unit: 'g',
          },
        ],
        products: [],
        // ... other required fields
      },
    ];

    const deduplicated = deduplicateChemicals(experiments);

    expect(deduplicated[0].canonicalName).toBe('Sodium Chloride');
  });

  it('should handle chemicals without CAS numbers', () => {
    const experiments: ExperimentData[] = [
      {
        id: 'exp1',
        reagents: [
          {
            id: 'r1',
            chemical: {
              id: 'c1',
              name: 'Custom Reagent A',
              casNumber: null,
              molecularFormula: null,
            },
            amount: 5,
            unit: 'g',
          },
        ],
        products: [],
        // ... other required fields
      },
      {
        id: 'exp2',
        reagents: [
          {
            id: 'r2',
            chemical: {
              id: 'c2',
              name: 'Custom Reagent A',
              casNumber: null,
              molecularFormula: null,
            },
            amount: 3,
            unit: 'g',
          },
        ],
        products: [],
        // ... other required fields
      },
    ];

    const deduplicated = deduplicateChemicals(experiments);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].canonicalName).toBe('Custom Reagent A');
    expect(deduplicated[0].usageCount).toBe(2);
  });
});
```

### Integration Test: `tests/integration/chemeln/normalizers/chemicals.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { fetchExperiments } from '@/lib/chemeln';
import { deduplicateChemicals } from '@/lib/chemeln/normalizers/chemicals';

describe('Chemical Deduplication (Integration)', () => {
  it('should deduplicate chemicals from real ChemELN data', async () => {
    const experiments = await fetchExperiments();
    const deduplicated = deduplicateChemicals(experiments);

    expect(Array.isArray(deduplicated)).toBe(true);
    expect(deduplicated.length).toBeGreaterThan(0);

    // Verify all records have required fields
    deduplicated.forEach(chem => {
      expect(chem).toHaveProperty('canonicalName');
      expect(chem).toHaveProperty('usageCount');
      expect(chem.usageCount).toBeGreaterThan(0);
    });

    // Verify sorted by usage count
    for (let i = 1; i < deduplicated.length; i++) {
      expect(deduplicated[i - 1].usageCount).toBeGreaterThanOrEqual(
        deduplicated[i].usageCount
      );
    }
  }, 20000);
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/lib/chemeln/types.ts` (add ChemicalRecord type) |
| CREATE | `src/lib/chemeln/normalizers/chemicals.ts` |
| MODIFY | `src/lib/chemeln/index.ts` (export deduplicateChemicals) |
| CREATE | `tests/unit/chemeln/normalizers/chemicals.test.ts` |
| CREATE | `tests/integration/chemeln/normalizers/chemicals.test.ts` |

---

## Dev Notes

**CAS number reliability:** CAS numbers are the most reliable deduplication key, but not all chemicals have them (custom mixtures, proprietary reagents). For chemicals without CAS numbers, we fall back to normalized name matching.

**Synonym expansion:** The common synonym registry is manually curated. In the future, this could be expanded by querying PubChem or ChemSpider APIs to fetch synonyms automatically.

**Performance:** For very large datasets (10,000+ unique chemicals), consider using a more efficient data structure (e.g., trie for name matching, hash map for CAS lookup). The current implementation is optimized for datasets with <1,000 unique chemicals.

---

**Last Updated:** 2026-03-21
