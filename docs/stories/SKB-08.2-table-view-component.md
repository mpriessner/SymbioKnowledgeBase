# Story SKB-08.2: Table View Component

**Epic:** Epic 8 - Database (Table View)
**Story ID:** SKB-08.2
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-08.1 (Database and row CRUD APIs must exist)

---

## User Story

As a researcher, I want to view my database as a table, So that I can see all rows and their properties at a glance.

---

## Acceptance Criteria

- [ ] `TableView.tsx` renders database rows as an HTML table with typed property columns
- [ ] Column headers derived from the database schema (column name and type)
- [ ] First column is always the TITLE column (linked to the row's page)
- [ ] Row click navigates to the row's page (`/pages/:pageId`)
- [ ] Property values formatted by type: dates formatted, checkboxes as toggle icons, URLs as clickable links, multi-select as tag pills
- [ ] "Add row" button at the bottom of the table
- [ ] New row creates a `db_row` + `page` in one API call, optimistically added to table
- [ ] Empty state when database has no rows: "No rows yet. Click 'Add row' to create one."
- [ ] TanStack Query for data fetching with optimistic updates
- [ ] Loading skeleton while fetching rows
- [ ] Responsive: horizontal scroll on narrow screens
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
TableView Component
───────────────────

  ┌────────────────────────────────────────────────────────────┐
  │  TableView.tsx                                              │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐  │
  │  │  Title (link) │ Status  │ Due Date   │ Priority      │  │
  │  ├──────────────────────────────────────────────────────┤  │
  │  │  Task A  →    │ ✅ Done │ 2026-03-01 │ 1             │  │
  │  │  Task B  →    │ 📋 Todo │ 2026-04-15 │ 3             │  │
  │  │  Task C  →    │ 🔄 WIP  │ 2026-05-01 │ 2             │  │
  │  ├──────────────────────────────────────────────────────┤  │
  │  │  [+ Add row]                                         │  │
  │  └──────────────────────────────────────────────────────┘  │
  │                                                              │
  │  PropertyCell.tsx (type-aware rendering):                   │
  │  ├── TEXT/TITLE: plain text                                 │
  │  ├── NUMBER: right-aligned number                           │
  │  ├── SELECT: colored pill                                   │
  │  ├── MULTI_SELECT: multiple colored pills                   │
  │  ├── DATE: formatted date string                            │
  │  ├── CHECKBOX: check/uncheck icon                           │
  │  └── URL: clickable external link with icon                 │
  └────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the useDatabaseRows Hook

**File: `src/hooks/useDatabaseRows.ts`**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RowProperties } from '@/types/database';

interface DbRowWithPage {
  id: string;
  database_id: string;
  page_id: string;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null };
}

interface RowsResponse {
  data: DbRowWithPage[];
  meta: { total: number };
}

export function useDatabaseRows(databaseId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<RowsResponse>({
    queryKey: ['databases', databaseId, 'rows'],
    queryFn: async () => {
      const res = await fetch(`/api/databases/${databaseId}/rows`);
      if (!res.ok) throw new Error('Failed to fetch rows');
      return res.json() as Promise<RowsResponse>;
    },
  });

  const createRow = useMutation({
    mutationFn: async (properties: RowProperties) => {
      const res = await fetch(`/api/databases/${databaseId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });
      if (!res.ok) throw new Error('Failed to create row');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['databases', databaseId, 'rows'],
      });
    },
  });

  const updateRow = useMutation({
    mutationFn: async ({
      rowId,
      properties,
    }: {
      rowId: string;
      properties: RowProperties;
    }) => {
      const res = await fetch(
        `/api/databases/${databaseId}/rows/${rowId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties }),
        }
      );
      if (!res.ok) throw new Error('Failed to update row');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['databases', databaseId, 'rows'],
      });
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const res = await fetch(
        `/api/databases/${databaseId}/rows/${rowId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete row');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['databases', databaseId, 'rows'],
      });
    },
  });

  return { ...query, createRow, updateRow, deleteRow };
}
```

---

### Step 2: Create the PropertyCell Component

**File: `src/components/database/PropertyCell.tsx`**

```typescript
'use client';

import type { PropertyValue } from '@/types/database';

interface PropertyCellProps {
  value: PropertyValue | undefined;
}

export function PropertyCell({ value }: PropertyCellProps) {
  if (!value) {
    return <span className="text-[var(--color-text-secondary)]">-</span>;
  }

  switch (value.type) {
    case 'TITLE':
    case 'TEXT':
      return <span>{value.value}</span>;

    case 'NUMBER':
      return <span className="tabular-nums text-right">{value.value}</span>;

    case 'SELECT':
      return (
        <span className="inline-block rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium">
          {value.value}
        </span>
      );

    case 'MULTI_SELECT':
      return (
        <div className="flex flex-wrap gap-1">
          {value.value.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      );

    case 'DATE':
      return (
        <span>
          {new Date(value.value).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      );

    case 'CHECKBOX':
      return (
        <span className="text-lg">
          {value.value ? '\u2705' : '\u2B1C'}
        </span>
      );

    case 'URL':
      return (
        <a
          href={value.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {new URL(value.value).hostname}
        </a>
      );

    default:
      return <span>-</span>;
  }
}
```

---

### Step 3: Create the TableView Component

**File: `src/components/database/TableView.tsx`**

```typescript
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDatabaseRows } from '@/hooks/useDatabaseRows';
import { PropertyCell } from './PropertyCell';
import type { Column, DatabaseSchema, RowProperties } from '@/types/database';

interface TableViewProps {
  databaseId: string;
  schema: DatabaseSchema;
}

export function TableView({ databaseId, schema }: TableViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow } = useDatabaseRows(databaseId);
  const rows = data?.data ?? [];

  // Order columns: TITLE first, then the rest
  const orderedColumns = [...schema.columns].sort((a, b) => {
    if (a.type === 'TITLE') return -1;
    if (b.type === 'TITLE') return 1;
    return 0;
  });

  const handleRowClick = useCallback(
    (pageId: string) => {
      router.push(`/pages/${pageId}`);
    },
    [router]
  );

  const handleAddRow = useCallback(() => {
    const titleColumn = schema.columns.find((c) => c.type === 'TITLE');
    if (!titleColumn) return;

    const defaultProperties: RowProperties = {
      [titleColumn.id]: { type: 'TITLE', value: 'Untitled' },
    };

    createRow.mutate(defaultProperties);
  }, [schema.columns, createRow]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded bg-[var(--color-bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {/* Column headers */}
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {orderedColumns.map((column) => (
              <th
                key={column.id}
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider
                           text-[var(--color-text-secondary)]"
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>

        {/* Rows */}
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={orderedColumns.length}
                className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]"
              >
                No rows yet. Click &quot;Add row&quot; to create one.
              </td>
            </tr>
          )}

          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => handleRowClick(row.page_id)}
              className="border-b border-[var(--color-border)] cursor-pointer
                         hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              {orderedColumns.map((column) => (
                <td key={column.id} className="px-3 py-2">
                  {column.type === 'TITLE' ? (
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {(row.properties as RowProperties)[column.id]?.type === 'TITLE'
                        ? ((row.properties as RowProperties)[column.id] as { type: 'TITLE'; value: string }).value
                        : row.page.title}
                    </span>
                  ) : (
                    <PropertyCell
                      value={(row.properties as RowProperties)[column.id]}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add row button */}
      <button
        onClick={handleAddRow}
        disabled={createRow.isPending}
        className="mt-2 w-full rounded-md border border-dashed border-[var(--color-border)]
                   px-3 py-2 text-sm text-[var(--color-text-secondary)]
                   hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]
                   transition-colors disabled:opacity-50"
      >
        {createRow.isPending ? 'Creating...' : '+ Add row'}
      </button>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/database/TableView.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useDatabaseRows', () => ({
  useDatabaseRows: vi.fn(),
}));

import { TableView } from '@/components/database/TableView';
import { useDatabaseRows } from '@/hooks/useDatabaseRows';
const mockUseDatabaseRows = vi.mocked(useDatabaseRows);

const qc = new QueryClient();

describe('TableView', () => {
  const schema = {
    columns: [
      { id: 'col1', name: 'Title', type: 'TITLE' as const },
      { id: 'col2', name: 'Status', type: 'SELECT' as const, options: ['Todo', 'Done'] },
    ],
  };

  it('should render column headers from schema', () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
    } as any);

    render(
      <QueryClientProvider client={qc}>
        <TableView databaseId="db-1" schema={schema} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should show empty state when no rows', () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
    } as any);

    render(
      <QueryClientProvider client={qc}>
        <TableView databaseId="db-1" schema={schema} />
      </QueryClientProvider>
    );

    expect(screen.getByText(/No rows yet/)).toBeInTheDocument();
  });

  it('should render rows with property values', () => {
    mockUseDatabaseRows.mockReturnValue({
      data: {
        data: [
          {
            id: 'row-1',
            database_id: 'db-1',
            page_id: 'page-1',
            properties: {
              col1: { type: 'TITLE', value: 'Task A' },
              col2: { type: 'SELECT', value: 'Done' },
            },
            page: { id: 'page-1', title: 'Task A', icon: null },
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
    } as any);

    render(
      <QueryClientProvider client={qc}>
        <TableView databaseId="db-1" schema={schema} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('should show Add row button', () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
    } as any);

    render(
      <QueryClientProvider client={qc}>
        <TableView databaseId="db-1" schema={schema} />
      </QueryClientProvider>
    );

    expect(screen.getByText('+ Add row')).toBeInTheDocument();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/hooks/useDatabaseRows.ts` |
| CREATE | `src/components/database/PropertyCell.tsx` |
| CREATE | `src/components/database/TableView.tsx` |
| MODIFY | `src/app/(workspace)/databases/[id]/page.tsx` (render TableView) |
| CREATE | `src/__tests__/components/database/TableView.test.tsx` |

---

**Last Updated:** 2026-02-21
