# Epic 8: Database (Table View)

**Epic ID:** EPIC-08
**Created:** 2026-02-21
**Total Story Points:** 18
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 8 implements Notion-style databases with typed property columns and a table view. Each database is associated with a parent page and defines a schema of typed property columns. Each database row is itself a full page, with its property values stored as JSONB. The table view renders rows as a spreadsheet-like grid with inline editing.

Supported property types for MVP: Title (required, one per database), Text, Number, Select, Multi-select, Date, Checkbox, and URL.

Properties are stored as a JSONB column on the `db_rows` table, validated against the database schema using Zod discriminated unions. The database schema itself is stored as JSONB on the `databases` table, defining column names, types, and options (e.g., select choices).

This epic covers FR41-46 (database functionality).

---

## Business Value

- Databases are the structured data layer that elevates a knowledge base from plain notes to a project management and data tracking tool
- JSONB property storage provides schema flexibility without requiring database migrations for each new property type
- Inline editing removes friction — users can update properties directly in the table without navigating to each page
- Filtering and sorting transform static tables into dynamic views, enabling users to answer questions like "show me all tasks due this week sorted by priority"

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL 18                                                │
│                                                               │
│  databases table                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ id │ page_id │ tenant_id │ schema (JSONB)            │    │
│  │    │         │           │                            │    │
│  │    │         │           │ {                          │    │
│  │    │         │           │   "columns": [             │    │
│  │    │         │           │     { "name": "Status",    │    │
│  │    │         │           │       "type": "select",    │    │
│  │    │         │           │       "options": [...] },  │    │
│  │    │         │           │     { "name": "Due Date",  │    │
│  │    │         │           │       "type": "date" },    │    │
│  │    │         │           │     { "name": "Priority",  │    │
│  │    │         │           │       "type": "number" }   │    │
│  │    │         │           │   ]                        │    │
│  │    │         │           │ }                          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  db_rows table                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ id │ database_id │ page_id │ tenant_id │ properties  │    │
│  │    │             │         │           │ (JSONB)     │    │
│  │    │             │         │           │             │    │
│  │    │             │         │           │ {           │    │
│  │    │             │         │           │  "Status":  │    │
│  │    │             │         │           │    "Done",  │    │
│  │    │             │         │           │  "Due Date":│    │
│  │    │             │         │           │  "2026-03", │    │
│  │    │             │         │           │  "Priority":│    │
│  │    │             │         │           │    1        │    │
│  │    │             │         │           │ }           │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────────┘
                       │  Prisma queries (tenant-scoped)
                       ▼
┌──────────────────────────────────────────┐
│  API Endpoints                            │
│                                           │
│  POST   /api/databases                    │
│  GET    /api/databases/[id]               │
│  PUT    /api/databases/[id]               │
│  DELETE /api/databases/[id]               │
│  POST   /api/databases/[id]/rows          │
│  GET    /api/databases/[id]/rows          │
│  PUT    /api/databases/[id]/rows/[rowId]  │
│  DELETE /api/databases/[id]/rows/[rowId]  │
└──────────────────────┬───────────────────┘
                       │  TanStack Query
                       ▼
┌──────────────────────────────────────────┐
│  TableView Component                      │
│  ┌──────────────────────────────────────┐│
│  │ FilterBar  │  SortControls           ││
│  ├──────────────────────────────────────┤│
│  │ Title    │ Status │ Due Date │ Prio  ││
│  ├──────────────────────────────────────┤│
│  │ Task A   │ Done   │ 2026-03  │  1    ││
│  │ Task B   │ Todo   │ 2026-04  │  3    ││
│  │ + Add row                            ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-08.1: Database Schema and CRUD API — 5 points, Critical

**Delivers:** Prisma schema additions for `databases` table (`id`, `page_id`, `tenant_id`, `schema` as JSONB, `created_at`, `updated_at`) and `db_rows` table (`id`, `database_id`, `page_id`, `tenant_id`, `properties` as JSONB, `created_at`, `updated_at`). Both tables have composite indexes on `(tenant_id, id)`. Full CRUD API endpoints: `POST/GET /api/databases`, `GET/PUT/DELETE /api/databases/[id]`, `POST/GET /api/databases/[id]/rows`, `PUT/DELETE /api/databases/[id]/rows/[rowId]`. Zod schemas for validating database schema structure and typed property values against the schema (e.g., a "number" property rejects string values, a "select" property only allows defined options). Creating a database row automatically creates a linked page.

**Depends on:** SKB-03.1 (page CRUD must exist since each database row is a page)

---

### SKB-08.2: Table View Component — 5 points, High

**Delivers:** `TableView` component (`components/database/TableView.tsx`) rendering database rows in a responsive HTML table. Column headers derived from the database schema. Each row displays the page title (always first column, linked to page) and property values formatted by type (dates formatted, checkboxes as toggle icons, URLs as clickable links, multi-select as tag pills). "Add row" button at the bottom creates a new row via the API and optimistically adds it to the table. Empty state when no rows exist. TanStack Query for data fetching with optimistic updates. Row click navigates to the row's page.

**Depends on:** SKB-08.1 (database and row CRUD APIs must exist)

---

### SKB-08.3: Inline Property Editing — 5 points, High

**Delivers:** Click-to-edit behavior on any property cell in the table view. Each property type has a dedicated editor component: `TextEditor` (text input), `NumberEditor` (number input with validation), `DateEditor` (native date picker), `SelectEditor` (dropdown with schema-defined options), `MultiSelectEditor` (tag input with add/remove), `CheckboxEditor` (toggle switch), `URLEditor` (text input with URL validation). Editors appear inline in the cell on click, save on blur or Enter, cancel on Escape. Changes saved via `PUT /api/databases/[id]/rows/[rowId]` with optimistic UI updates. Zod validation runs client-side before submission to provide instant feedback.

**Depends on:** SKB-08.2 (table view must render cells to make them editable)

---

### SKB-08.4: Filtering and Sorting — 3 points, Medium

**Delivers:** `FilterBar` component (`components/database/FilterBar.tsx`) allowing column-based filtering. Filter operators vary by property type: text/title supports "equals", "contains", "is empty"; number supports "equals", "greater than", "less than"; select supports "is", "is not"; date supports "is", "before", "after"; checkbox supports "is checked", "is not checked". Multiple filters combine with AND logic. `SortControls` component (`components/database/SortControls.tsx`) for ascending/descending sort by any column. Filter and sort state serialized in URL search params (`?filter=Status:is:Done&sort=Priority:asc`) for shareability and back-button support. Filtering and sorting applied client-side on the fetched data set (server-side pagination deferred to a future epic).

**Depends on:** SKB-08.2 (table view must exist to apply filters and sorts to)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 08.1 | Zod validates property types correctly; rejects invalid schema | CRUD operations create/read/update/delete databases and rows; tenant isolation verified; creating row creates linked page | Full API flow via HTTP |
| 08.2 | TableView renders correct columns and rows; "Add row" calls API | - | Navigate to database page, see table, click row navigates to page |
| 08.3 | Each editor renders for its type; save on blur fires API call; Escape cancels | - | Click cell, edit value, blur saves, value persists on reload |
| 08.4 | FilterBar applies correct operators; SortControls sorts correctly; URL params serialize/deserialize | - | Add filter, table updates; sort by column, order changes; reload preserves filter |

---

## Implementation Order

```
08.1 → 08.2 → 08.3 (sequential)
              → 08.4 (parallel with 08.3 after 08.2)

              ┌────────┐
         ┌───▶│ 08.3   │
┌────────┐│   │ Inline │
│ 08.1   ││   │ Edit   │
│ Schema ││   └────────┘
│ + CRUD │▼
└───┬────┘┌────────┐
    │     │ 08.2   │
    └────▶│ Table  │──┐
          │ View   │  │
          └────────┘  │  ┌────────┐
                      └─▶│ 08.4   │
                         │ Filter │
                         │ + Sort │
                         └────────┘
```

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- All UI components use Tailwind utility classes only — no custom CSS classes
- JSONB property values must be validated against the database schema on every write (both client and server)
- Property type "title" is required and unique per database schema — every database must have exactly one title column
- Database schema changes (adding/removing/retyping columns) are handled via PUT on the database endpoint; existing row properties that no longer match the schema are preserved but hidden in the UI
- Client-side filtering is acceptable for MVP; server-side filtering with JSONB path queries is deferred

---

## Files Created/Modified by This Epic

### New Files
- `prisma/migrations/XXXXXX_add_databases_and_rows/migration.sql` — databases and db_rows tables
- `src/app/api/databases/route.ts` — create and list databases
- `src/app/api/databases/[id]/route.ts` — get, update, delete database
- `src/app/api/databases/[id]/rows/route.ts` — create and list rows
- `src/app/api/databases/[id]/rows/[rowId]/route.ts` — get, update, delete row
- `src/lib/database/schema.ts` — Zod schemas for database schema and property validation
- `src/lib/database/propertyValidators.ts` — per-type property validation functions
- `src/components/database/TableView.tsx` — main table view component
- `src/components/database/TableHeader.tsx` — column headers from schema
- `src/components/database/TableRow.tsx` — single row rendering
- `src/components/database/PropertyCell.tsx` — type-aware property value display
- `src/components/database/editors/TextEditor.tsx`
- `src/components/database/editors/NumberEditor.tsx`
- `src/components/database/editors/DateEditor.tsx`
- `src/components/database/editors/SelectEditor.tsx`
- `src/components/database/editors/MultiSelectEditor.tsx`
- `src/components/database/editors/CheckboxEditor.tsx`
- `src/components/database/editors/URLEditor.tsx`
- `src/components/database/FilterBar.tsx` — column-based filtering controls
- `src/components/database/SortControls.tsx` — column sorting controls
- `src/hooks/useDatabase.ts` — TanStack Query hook for database API
- `src/hooks/useDatabaseRows.ts` — TanStack Query hook for rows API
- `src/types/database.ts` — Database, DbRow, PropertySchema, PropertyValue types
- `src/__tests__/lib/database/schema.test.ts`
- `src/__tests__/lib/database/propertyValidators.test.ts`
- `src/__tests__/api/databases/route.test.ts`
- `src/__tests__/api/databases/rows/route.test.ts`
- `src/__tests__/components/database/TableView.test.tsx`
- `src/__tests__/components/database/editors/TextEditor.test.tsx`
- `src/__tests__/components/database/FilterBar.test.tsx`

### Modified Files
- `prisma/schema.prisma` — add Database and DbRow models
- `src/app/(workspace)/databases/[id]/page.tsx` — replace placeholder with TableView
- `src/types/api.ts` — add Database, DbRow API response types

---

**Last Updated:** 2026-02-21