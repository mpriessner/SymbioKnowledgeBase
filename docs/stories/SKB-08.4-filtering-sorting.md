# Story SKB-08.4: Database Filtering and Sorting

**Epic:** Epic 8 - Database (Table View)
**Story ID:** SKB-08.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-08.2 (Table view must exist to apply filters and sorts to)

---

## User Story

As a researcher, I want to filter and sort my database, So that I can focus on specific subsets of data and answer questions like "show me all tasks due this week sorted by priority."

---

## Acceptance Criteria

- [ ] `FilterBar.tsx`: add filter button, column selector, operator selector, value input
- [ ] `SortControls.tsx`: click column header to toggle sort direction (asc/desc)
- [ ] Filter operators vary by property type:
  - TEXT/TITLE: equals, contains, is empty
  - NUMBER: equals, greater than, less than
  - SELECT: is, is not
  - MULTI_SELECT: contains, does not contain
  - DATE: is, before, after
  - CHECKBOX: is checked, is not checked
  - URL: equals, contains, is empty
- [ ] Multiple filters supported (AND logic)
- [ ] Filter/sort state stored in URL search params for shareability: `?filter=Status:is:Done&sort=Priority:asc`
- [ ] Client-side filtering applied to fetched dataset
- [ ] Sort indicator (arrow) on active column header
- [ ] Remove filter button (X) on each active filter
- [ ] "Clear all filters" button when any filter is active
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Filtering/Sorting Data Flow
────────────────────────────

  URL: /databases/:id?filter=col2:is:Done&sort=col4:asc
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  useTableFilters hook                                 │
  │                                                        │
  │  1. Parse URL search params                            │
  │  2. Extract filter and sort state                      │
  │  3. Apply filters to row data (client-side)            │
  │  4. Apply sort to filtered data                        │
  │  5. Return filtered + sorted rows                      │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  TableView renders filtered + sorted rows             │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │ FilterBar: [Status is Done] [x]  [+ Add filter]│   │
  │  ├────────────────────────────────────────────────┤   │
  │  │ Title ↕   │ Status   │ Due Date │ Priority ▲   │   │
  │  ├────────────────────────────────────────────────┤   │
  │  │ Task A    │ Done     │ 2026-03  │ 1            │   │
  │  │ Task C    │ Done     │ 2026-05  │ 2            │   │
  │  └────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘

Filter Operators by Type
────────────────────────

  TEXT/TITLE:    equals | contains | is_empty
  NUMBER:        equals | gt | lt
  SELECT:        is | is_not
  MULTI_SELECT:  contains | not_contains
  DATE:          is | before | after
  CHECKBOX:      is_checked | is_not_checked
  URL:           equals | contains | is_empty
```

---

## Implementation Steps

### Step 1: Define Filter/Sort Types

**File: `src/types/tableFilters.ts`**

```typescript
export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'is_empty'
  | 'gt'
  | 'lt'
  | 'is'
  | 'is_not'
  | 'not_contains'
  | 'before'
  | 'after'
  | 'is_checked'
  | 'is_not_checked';

export interface TableFilter {
  columnId: string;
  operator: FilterOperator;
  value: string;
}

export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  columnId: string;
  direction: SortDirection;
}

export const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  TITLE: ['equals', 'contains', 'is_empty'],
  TEXT: ['equals', 'contains', 'is_empty'],
  NUMBER: ['equals', 'gt', 'lt'],
  SELECT: ['is', 'is_not'],
  MULTI_SELECT: ['contains', 'not_contains'],
  DATE: ['is', 'before', 'after'],
  CHECKBOX: ['is_checked', 'is_not_checked'],
  URL: ['equals', 'contains', 'is_empty'],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'equals',
  contains: 'contains',
  is_empty: 'is empty',
  gt: 'greater than',
  lt: 'less than',
  is: 'is',
  is_not: 'is not',
  not_contains: 'does not contain',
  before: 'before',
  after: 'after',
  is_checked: 'is checked',
  is_not_checked: 'is not checked',
};
```

---

### Step 2: Create the useTableFilters Hook

**File: `src/hooks/useTableFilters.ts`**

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { TableFilter, TableSort, SortDirection } from '@/types/tableFilters';
import type { RowProperties, PropertyValue } from '@/types/database';

interface RowData {
  id: string;
  properties: RowProperties;
  [key: string]: unknown;
}

export function useTableFilters<T extends RowData>(rows: T[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse filters from URL
  const [filters, setFilters] = useState<TableFilter[]>(() => {
    const filterParams = searchParams.getAll('filter');
    return filterParams.map((f) => {
      const [columnId, operator, ...valueParts] = f.split(':');
      return { columnId, operator: operator as TableFilter['operator'], value: valueParts.join(':') };
    });
  });

  // Parse sort from URL
  const [sort, setSort] = useState<TableSort | null>(() => {
    const sortParam = searchParams.get('sort');
    if (!sortParam) return null;
    const [columnId, direction] = sortParam.split(':');
    return { columnId, direction: (direction || 'asc') as SortDirection };
  });

  const syncUrl = useCallback(
    (newFilters: TableFilter[], newSort: TableSort | null) => {
      const params = new URLSearchParams();
      for (const f of newFilters) {
        params.append('filter', `${f.columnId}:${f.operator}:${f.value}`);
      }
      if (newSort) {
        params.set('sort', `${newSort.columnId}:${newSort.direction}`);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const addFilter = useCallback(
    (filter: TableFilter) => {
      const updated = [...filters, filter];
      setFilters(updated);
      syncUrl(updated, sort);
    },
    [filters, sort, syncUrl]
  );

  const removeFilter = useCallback(
    (index: number) => {
      const updated = filters.filter((_, i) => i !== index);
      setFilters(updated);
      syncUrl(updated, sort);
    },
    [filters, sort, syncUrl]
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
    syncUrl([], sort);
  }, [sort, syncUrl]);

  const toggleSort = useCallback(
    (columnId: string) => {
      let newSort: TableSort | null;
      if (sort?.columnId === columnId) {
        newSort = sort.direction === 'asc'
          ? { columnId, direction: 'desc' }
          : null; // Third click removes sort
      } else {
        newSort = { columnId, direction: 'asc' };
      }
      setSort(newSort);
      syncUrl(filters, newSort);
    },
    [sort, filters, syncUrl]
  );

  // Apply filters and sort
  const filteredAndSorted = useMemo(() => {
    let result = [...rows];

    // Apply filters (AND logic)
    for (const filter of filters) {
      result = result.filter((row) => {
        const prop = row.properties[filter.columnId];
        return matchesFilter(prop, filter);
      });
    }

    // Apply sort
    if (sort) {
      result.sort((a, b) => {
        const aVal = a.properties[sort.columnId];
        const bVal = b.properties[sort.columnId];
        const cmp = comparePropertyValues(aVal, bVal);
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, filters, sort]);

  return {
    filters,
    sort,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    filteredRows: filteredAndSorted,
    isFiltered: filters.length > 0,
  };
}

function matchesFilter(prop: PropertyValue | undefined, filter: TableFilter): boolean {
  if (filter.operator === 'is_empty') return !prop || !prop.value;
  if (filter.operator === 'is_checked') return prop?.type === 'CHECKBOX' && prop.value === true;
  if (filter.operator === 'is_not_checked') return prop?.type === 'CHECKBOX' && prop.value === false;

  if (!prop) return false;
  const val = String(prop.value);

  switch (filter.operator) {
    case 'equals':
    case 'is':
      return val === filter.value;
    case 'is_not':
      return val !== filter.value;
    case 'contains':
      return val.toLowerCase().includes(filter.value.toLowerCase());
    case 'not_contains':
      return !val.toLowerCase().includes(filter.value.toLowerCase());
    case 'gt':
      return Number(val) > Number(filter.value);
    case 'lt':
      return Number(val) < Number(filter.value);
    case 'before':
      return new Date(val) < new Date(filter.value);
    case 'after':
      return new Date(val) > new Date(filter.value);
    default:
      return true;
  }
}

function comparePropertyValues(a: PropertyValue | undefined, b: PropertyValue | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  if (a.type === 'NUMBER' && b.type === 'NUMBER') return a.value - b.value;
  if (a.type === 'CHECKBOX' && b.type === 'CHECKBOX') return Number(a.value) - Number(b.value);
  if (a.type === 'DATE' && b.type === 'DATE') return new Date(a.value).getTime() - new Date(b.value).getTime();

  return String(a.value).localeCompare(String(b.value));
}
```

---

### Step 3: Create FilterBar Component

**File: `src/components/database/FilterBar.tsx`**

```typescript
'use client';

import { useState } from 'react';
import type { Column } from '@/types/database';
import type { TableFilter, FilterOperator } from '@/types/tableFilters';
import { OPERATORS_BY_TYPE, OPERATOR_LABELS } from '@/types/tableFilters';

interface FilterBarProps {
  columns: Column[];
  filters: TableFilter[];
  onAddFilter: (filter: TableFilter) => void;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
}

export function FilterBar({ columns, filters, onAddFilter, onRemoveFilter, onClearAll }: FilterBarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newColumnId, setNewColumnId] = useState('');
  const [newOperator, setNewOperator] = useState<FilterOperator>('equals');
  const [newValue, setNewValue] = useState('');

  const selectedColumn = columns.find((c) => c.id === newColumnId);
  const availableOperators = selectedColumn ? OPERATORS_BY_TYPE[selectedColumn.type] || [] : [];

  const handleAdd = () => {
    if (newColumnId && newOperator) {
      onAddFilter({ columnId: newColumnId, operator: newOperator, value: newValue });
      setIsAdding(false);
      setNewColumnId('');
      setNewOperator('equals');
      setNewValue('');
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* Active filters */}
      {filters.map((filter, index) => {
        const col = columns.find((c) => c.id === filter.columnId);
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs"
          >
            <span className="font-medium">{col?.name || filter.columnId}</span>
            <span className="text-[var(--color-text-secondary)]">{OPERATOR_LABELS[filter.operator]}</span>
            {filter.value && <span>&quot;{filter.value}&quot;</span>}
            <button onClick={() => onRemoveFilter(index)} className="ml-1 hover:text-red-500" aria-label="Remove filter">
              x
            </button>
          </span>
        );
      })}

      {/* Add filter form */}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <select value={newColumnId} onChange={(e) => { setNewColumnId(e.target.value); setNewOperator('equals'); }}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs">
            <option value="">Column...</option>
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {newColumnId && (
            <select value={newOperator} onChange={(e) => setNewOperator(e.target.value as FilterOperator)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs">
              {availableOperators.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
            </select>
          )}
          {newColumnId && !['is_empty', 'is_checked', 'is_not_checked'].includes(newOperator) && (
            <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value" className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs" />
          )}
          <button onClick={handleAdd} className="rounded bg-[var(--color-accent)] px-2 py-1 text-xs text-white">Apply</button>
          <button onClick={() => setIsAdding(false)} className="px-2 py-1 text-xs text-[var(--color-text-secondary)]">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)} className="text-xs text-[var(--color-accent)] hover:underline">
          + Add filter
        </button>
      )}

      {filters.length > 0 && (
        <button onClick={onClearAll} className="text-xs text-[var(--color-text-secondary)] hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/database/FilterBar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '@/components/database/FilterBar';

describe('FilterBar', () => {
  const columns = [
    { id: 'col1', name: 'Title', type: 'TITLE' as const },
    { id: 'col2', name: 'Status', type: 'SELECT' as const, options: ['Todo', 'Done'] },
  ];

  it('should render active filters', () => {
    render(
      <FilterBar
        columns={columns}
        filters={[{ columnId: 'col2', operator: 'is', value: 'Done' }]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('is')).toBeInTheDocument();
  });

  it('should show add filter button', () => {
    render(
      <FilterBar columns={columns} filters={[]} onAddFilter={vi.fn()} onRemoveFilter={vi.fn()} onClearAll={vi.fn()} />
    );
    expect(screen.getByText('+ Add filter')).toBeInTheDocument();
  });

  it('should call onRemoveFilter when X is clicked', () => {
    const onRemoveFilter = vi.fn();
    render(
      <FilterBar
        columns={columns}
        filters={[{ columnId: 'col2', operator: 'is', value: 'Done' }]}
        onAddFilter={vi.fn()}
        onRemoveFilter={onRemoveFilter}
        onClearAll={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove filter'));
    expect(onRemoveFilter).toHaveBeenCalledWith(0);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/tableFilters.ts` |
| CREATE | `src/hooks/useTableFilters.ts` |
| CREATE | `src/components/database/FilterBar.tsx` |
| MODIFY | `src/components/database/TableView.tsx` (integrate FilterBar and sort headers) |
| CREATE | `src/__tests__/components/database/FilterBar.test.tsx` |

---

**Last Updated:** 2026-02-21
