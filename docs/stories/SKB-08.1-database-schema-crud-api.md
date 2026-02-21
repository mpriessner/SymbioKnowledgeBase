# Story SKB-08.1: Database Schema and CRUD API

**Epic:** Epic 8 - Database (Table View)
**Story ID:** SKB-08.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-03.1 (Page CRUD must exist since each database row is a page)

---

## User Story

As a researcher, I want to create databases with typed columns, So that I can structure and track data beyond free-form notes.

---

## Acceptance Criteria

- [ ] `databases` table: `id`, `page_id`, `tenant_id`, `schema` (JSONB — column definitions), `created_at`, `updated_at`
- [ ] `db_rows` table: `id`, `database_id`, `page_id`, `tenant_id`, `properties` (JSONB — column values), `created_at`, `updated_at`
- [ ] Schema JSONB format: `{ columns: [{ id, name, type, options? }] }`
- [ ] Property types supported: `TITLE`, `TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `DATE`, `CHECKBOX`, `URL`
- [ ] `db_rows.properties` format: `{ [columnId]: { type, value } }`
- [ ] API: `POST /api/databases`, `GET /api/databases` (list)
- [ ] API: `GET /api/databases/[id]`, `PUT /api/databases/[id]`, `DELETE /api/databases/[id]`
- [ ] API: `POST /api/databases/[id]/rows`, `GET /api/databases/[id]/rows` (list)
- [ ] API: `GET /api/databases/[id]/rows/[rowId]`, `PUT /api/databases/[id]/rows/[rowId]`, `DELETE /api/databases/[id]/rows/[rowId]`
- [ ] Each database is associated with a page via `page_id`
- [ ] Creating a database row automatically creates a linked page
- [ ] Zod validation for database schema structure
- [ ] Zod validation for property values against column type (number column rejects strings, select only allows defined options, etc.)
- [ ] Every database must have exactly one `TITLE` column
- [ ] All queries scoped by `tenant_id` via `withTenant()`
- [ ] Standard API response envelope: `{ data, meta }` / `{ error, meta }`
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Data Model
──────────

  databases table
  ┌────────────────────────────────────────────────────────────┐
  │ id: UUID                                                    │
  │ page_id: UUID → pages(id)  (the database's parent page)   │
  │ tenant_id: UUID → tenants(id)                              │
  │ schema: JSONB                                               │
  │   {                                                        │
  │     "columns": [                                           │
  │       { "id": "col_1", "name": "Title", "type": "TITLE" },│
  │       { "id": "col_2", "name": "Status", "type": "SELECT",│
  │         "options": ["Todo", "In Progress", "Done"] },      │
  │       { "id": "col_3", "name": "Due Date", "type":"DATE"},│
  │       { "id": "col_4", "name": "Priority", "type":"NUMBER"}│
  │     ]                                                      │
  │   }                                                        │
  │ created_at: TIMESTAMPTZ                                    │
  │ updated_at: TIMESTAMPTZ                                    │
  └────────────────────────────────────────────────────────────┘

  db_rows table
  ┌────────────────────────────────────────────────────────────┐
  │ id: UUID                                                    │
  │ database_id: UUID → databases(id)                          │
  │ page_id: UUID → pages(id)  (each row IS a page)           │
  │ tenant_id: UUID → tenants(id)                              │
  │ properties: JSONB                                           │
  │   {                                                        │
  │     "col_1": { "type": "TITLE", "value": "Task A" },      │
  │     "col_2": { "type": "SELECT", "value": "Done" },       │
  │     "col_3": { "type": "DATE", "value": "2026-03-01" },   │
  │     "col_4": { "type": "NUMBER", "value": 1 }             │
  │   }                                                        │
  │ created_at: TIMESTAMPTZ                                    │
  │ updated_at: TIMESTAMPTZ                                    │
  └────────────────────────────────────────────────────────────┘

API Endpoints
─────────────

  POST   /api/databases              → Create database (with schema)
  GET    /api/databases              → List databases for tenant
  GET    /api/databases/[id]         → Get database with schema
  PUT    /api/databases/[id]         → Update schema (add/remove columns)
  DELETE /api/databases/[id]         → Delete database + rows + pages

  POST   /api/databases/[id]/rows           → Create row (+ page)
  GET    /api/databases/[id]/rows           → List rows with properties
  GET    /api/databases/[id]/rows/[rowId]   → Get single row
  PUT    /api/databases/[id]/rows/[rowId]   → Update row properties
  DELETE /api/databases/[id]/rows/[rowId]   → Delete row (+ page)

Row Creation Flow
─────────────────

  POST /api/databases/:id/rows { properties: {...} }
        │
        ▼
  ┌──────────────────────────────────────┐
  │  1. Validate properties against schema│
  │  2. Create a new page (title from    │
  │     TITLE property value)            │
  │  3. Create db_row linked to page     │
  │  4. Return row + page data           │
  └──────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Database Types and Zod Schemas

**File: `src/types/database.ts`**

```typescript
import { z } from 'zod';

/**
 * Supported property types for database columns.
 */
export const PropertyType = {
  TITLE: 'TITLE',
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  DATE: 'DATE',
  CHECKBOX: 'CHECKBOX',
  URL: 'URL',
} as const;

export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

/**
 * A single column definition in the database schema.
 */
export const ColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum([
    'TITLE',
    'TEXT',
    'NUMBER',
    'SELECT',
    'MULTI_SELECT',
    'DATE',
    'CHECKBOX',
    'URL',
  ]),
  options: z.array(z.string()).optional(), // For SELECT and MULTI_SELECT
});

export type Column = z.infer<typeof ColumnSchema>;

/**
 * The database schema stored in the JSONB column.
 * Must have exactly one TITLE column.
 */
export const DatabaseSchemaDefinition = z
  .object({
    columns: z.array(ColumnSchema).min(1),
  })
  .refine(
    (schema) =>
      schema.columns.filter((c) => c.type === 'TITLE').length === 1,
    { message: 'Database schema must have exactly one TITLE column' }
  );

export type DatabaseSchema = z.infer<typeof DatabaseSchemaDefinition>;

/**
 * A single property value stored in db_rows.properties.
 */
export const PropertyValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TITLE'), value: z.string() }),
  z.object({ type: z.literal('TEXT'), value: z.string() }),
  z.object({ type: z.literal('NUMBER'), value: z.number() }),
  z.object({ type: z.literal('SELECT'), value: z.string() }),
  z.object({
    type: z.literal('MULTI_SELECT'),
    value: z.array(z.string()),
  }),
  z.object({ type: z.literal('DATE'), value: z.string() }), // ISO date string
  z.object({ type: z.literal('CHECKBOX'), value: z.boolean() }),
  z.object({ type: z.literal('URL'), value: z.string().url() }),
]);

export type PropertyValue = z.infer<typeof PropertyValueSchema>;

/**
 * The properties JSONB stored on a db_row.
 * Keys are column IDs, values are typed property values.
 */
export const RowPropertiesSchema = z.record(z.string(), PropertyValueSchema);

export type RowProperties = z.infer<typeof RowPropertiesSchema>;

/**
 * API request for creating a new database.
 */
export const CreateDatabaseSchema = z.object({
  pageId: z.string().uuid(),
  schema: DatabaseSchemaDefinition,
});

/**
 * API request for creating a new row.
 */
export const CreateRowSchema = z.object({
  properties: RowPropertiesSchema,
});

/**
 * API request for updating a row.
 */
export const UpdateRowSchema = z.object({
  properties: RowPropertiesSchema,
});
```

---

### Step 2: Add Prisma Models

**File: `prisma/schema.prisma` (modification)**

```prisma
model Database {
  id         String   @id @default(uuid())
  page_id    String   @unique
  tenant_id  String
  schema     Json     // DatabaseSchema JSONB
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  page   Page     @relation(fields: [page_id], references: [id], onDelete: Cascade)
  tenant Tenant   @relation(fields: [tenant_id], references: [id])
  rows   DbRow[]

  @@index([tenant_id])
  @@index([tenant_id, page_id])
}

model DbRow {
  id          String   @id @default(uuid())
  database_id String
  page_id     String   @unique
  tenant_id   String
  properties  Json     // RowProperties JSONB
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  database Database @relation(fields: [database_id], references: [id], onDelete: Cascade)
  page     Page     @relation(fields: [page_id], references: [id], onDelete: Cascade)
  tenant   Tenant   @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, database_id])
  @@index([tenant_id])
}
```

---

### Step 3: Implement Property Validation

**File: `src/lib/database/propertyValidators.ts`**

```typescript
import type { Column, RowProperties, PropertyValue } from '@/types/database';

/**
 * Validates row properties against the database schema.
 * Ensures each property matches its column type and constraints.
 *
 * @param properties - The row properties to validate
 * @param columns - The database schema columns
 * @returns Validation result with errors if any
 */
export function validateProperties(
  properties: RowProperties,
  columns: Column[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  // Check that all provided properties match a column
  for (const [columnId, propValue] of Object.entries(properties)) {
    const column = columnMap.get(columnId);
    if (!column) {
      errors.push(`Unknown column: ${columnId}`);
      continue;
    }

    // Type must match
    if (propValue.type !== column.type) {
      errors.push(
        `Column "${column.name}" expects type ${column.type}, got ${propValue.type}`
      );
      continue;
    }

    // Type-specific validation
    const typeError = validatePropertyByType(propValue, column);
    if (typeError) {
      errors.push(typeError);
    }
  }

  // Check required TITLE column has a value
  const titleColumn = columns.find((c) => c.type === 'TITLE');
  if (titleColumn && !properties[titleColumn.id]) {
    errors.push('TITLE property is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a single property value against its column constraints.
 */
function validatePropertyByType(
  prop: PropertyValue,
  column: Column
): string | null {
  switch (prop.type) {
    case 'SELECT':
      if (column.options && !column.options.includes(prop.value)) {
        return `Column "${column.name}" value "${prop.value}" is not a valid option. Valid: ${column.options.join(', ')}`;
      }
      return null;

    case 'MULTI_SELECT':
      if (column.options) {
        const invalid = prop.value.filter(
          (v) => !column.options!.includes(v)
        );
        if (invalid.length > 0) {
          return `Column "${column.name}" contains invalid options: ${invalid.join(', ')}`;
        }
      }
      return null;

    case 'NUMBER':
      if (typeof prop.value !== 'number' || isNaN(prop.value)) {
        return `Column "${column.name}" must be a valid number`;
      }
      return null;

    case 'URL':
      try {
        new URL(prop.value);
        return null;
      } catch {
        return `Column "${column.name}" must be a valid URL`;
      }

    default:
      return null;
  }
}

/**
 * Extracts the title value from row properties.
 * The TITLE column value is used as the page title.
 */
export function extractTitleFromProperties(
  properties: RowProperties,
  columns: Column[]
): string {
  const titleColumn = columns.find((c) => c.type === 'TITLE');
  if (!titleColumn) return 'Untitled';

  const titleProp = properties[titleColumn.id];
  if (!titleProp || titleProp.type !== 'TITLE') return 'Untitled';

  return titleProp.value || 'Untitled';
}
```

---

### Step 4: Implement Database CRUD API

**File: `src/app/api/databases/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';
import { CreateDatabaseSchema } from '@/types/database';

/**
 * POST /api/databases — Create a new database
 */
export const POST = withTenant(async (req: NextRequest, { tenantId }) => {
  const body = await req.json();

  const parseResult = CreateDatabaseSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message,
          details: parseResult.error.errors,
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  const { pageId, schema } = parseResult.data;

  // Verify the page exists and belongs to this tenant
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenant_id: tenantId },
  });

  if (!page) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: {} },
      { status: 404 }
    );
  }

  const database = await prisma.database.create({
    data: {
      page_id: pageId,
      tenant_id: tenantId,
      schema: schema as unknown as Record<string, unknown>,
    },
  });

  return NextResponse.json(
    {
      data: database,
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});

/**
 * GET /api/databases — List all databases for the tenant
 */
export const GET = withTenant(async (req: NextRequest, { tenantId }) => {
  const databases = await prisma.database.findMany({
    where: { tenant_id: tenantId },
    include: {
      page: { select: { title: true, icon: true } },
      _count: { select: { rows: true } },
    },
    orderBy: { updated_at: 'desc' },
  });

  return NextResponse.json({
    data: databases,
    meta: {
      total: databases.length,
      timestamp: new Date().toISOString(),
    },
  });
});
```

**File: `src/app/api/databases/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';
import { DatabaseSchemaDefinition } from '@/types/database';

/**
 * GET /api/databases/[id] — Get a single database with schema
 */
export const GET = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string }; tenantId: string }) => {
    const database = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
      include: {
        page: { select: { title: true, icon: true } },
      },
    });

    if (!database) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: database,
      meta: { timestamp: new Date().toISOString() },
    });
  }
);

/**
 * PUT /api/databases/[id] — Update database schema
 */
export const PUT = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string }; tenantId: string }) => {
    const body = await req.json();

    // Validate schema if provided
    if (body.schema) {
      const parseResult = DatabaseSchemaDefinition.safeParse(body.schema);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: parseResult.error.errors[0]?.message,
            },
            meta: {},
          },
          { status: 400 }
        );
      }
    }

    const database = await prisma.database.updateMany({
      where: { id: params.id, tenant_id: tenantId },
      data: {
        schema: body.schema as Record<string, unknown>,
        updated_at: new Date(),
      },
    });

    if (database.count === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    const updated = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });

    return NextResponse.json({
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    });
  }
);

/**
 * DELETE /api/databases/[id] — Delete database and all rows
 */
export const DELETE = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string }; tenantId: string }) => {
    const database = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });

    if (!database) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    // Delete database (cascade deletes rows)
    await prisma.database.delete({ where: { id: params.id } });

    return NextResponse.json({
      data: { deleted: true },
      meta: { timestamp: new Date().toISOString() },
    });
  }
);
```

---

### Step 5: Implement Row CRUD API

**File: `src/app/api/databases/[id]/rows/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';
import { CreateRowSchema } from '@/types/database';
import { validateProperties, extractTitleFromProperties } from '@/lib/database/propertyValidators';
import type { DatabaseSchema } from '@/types/database';

/**
 * POST /api/databases/[id]/rows — Create a new row (also creates a page)
 */
export const POST = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string }; tenantId: string }) => {
    const body = await req.json();

    // Validate request body
    const parseResult = CreateRowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message },
          meta: {},
        },
        { status: 400 }
      );
    }

    // Fetch database and validate ownership
    const database = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });

    if (!database) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    const schema = database.schema as unknown as DatabaseSchema;

    // Validate properties against schema
    const validation = validateProperties(parseResult.data.properties, schema.columns);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.errors.join('; '),
          },
          meta: {},
        },
        { status: 400 }
      );
    }

    // Extract title from TITLE property for the auto-created page
    const pageTitle = extractTitleFromProperties(parseResult.data.properties, schema.columns);

    // Create page and row in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          title: pageTitle,
          tenant_id: tenantId,
        },
      });

      const row = await tx.dbRow.create({
        data: {
          database_id: params.id,
          page_id: page.id,
          tenant_id: tenantId,
          properties: parseResult.data.properties as unknown as Record<string, unknown>,
        },
      });

      return { row, page };
    });

    return NextResponse.json(
      {
        data: { ...result.row, page: result.page },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  }
);

/**
 * GET /api/databases/[id]/rows — List all rows for a database
 */
export const GET = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string }; tenantId: string }) => {
    const database = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
      select: { id: true },
    });

    if (!database) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    const rows = await prisma.dbRow.findMany({
      where: { database_id: params.id, tenant_id: tenantId },
      include: {
        page: { select: { id: true, title: true, icon: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({
      data: rows,
      meta: {
        total: rows.length,
        timestamp: new Date().toISOString(),
      },
    });
  }
);
```

**File: `src/app/api/databases/[id]/rows/[rowId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';
import { UpdateRowSchema } from '@/types/database';
import { validateProperties, extractTitleFromProperties } from '@/lib/database/propertyValidators';
import type { DatabaseSchema } from '@/types/database';

/**
 * GET /api/databases/[id]/rows/[rowId]
 */
export const GET = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string; rowId: string }; tenantId: string }) => {
    const row = await prisma.dbRow.findFirst({
      where: { id: params.rowId, database_id: params.id, tenant_id: tenantId },
      include: { page: { select: { id: true, title: true, icon: true } } },
    });

    if (!row) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Row not found' }, meta: {} },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: row,
      meta: { timestamp: new Date().toISOString() },
    });
  }
);

/**
 * PUT /api/databases/[id]/rows/[rowId]
 */
export const PUT = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string; rowId: string }; tenantId: string }) => {
    const body = await req.json();

    const parseResult = UpdateRowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message }, meta: {} },
        { status: 400 }
      );
    }

    // Fetch database schema for validation
    const database = await prisma.database.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });

    if (!database) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Database not found' }, meta: {} },
        { status: 404 }
      );
    }

    const schema = database.schema as unknown as DatabaseSchema;
    const validation = validateProperties(parseResult.data.properties, schema.columns);
    if (!validation.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') }, meta: {} },
        { status: 400 }
      );
    }

    // Update row and sync page title
    const pageTitle = extractTitleFromProperties(parseResult.data.properties, schema.columns);

    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.dbRow.updateMany({
        where: { id: params.rowId, database_id: params.id, tenant_id: tenantId },
        data: {
          properties: parseResult.data.properties as unknown as Record<string, unknown>,
          updated_at: new Date(),
        },
      });

      if (row.count === 0) {
        throw new Error('ROW_NOT_FOUND');
      }

      // Sync page title with TITLE property
      const updatedRow = await tx.dbRow.findFirst({ where: { id: params.rowId } });
      if (updatedRow) {
        await tx.page.update({
          where: { id: updatedRow.page_id },
          data: { title: pageTitle },
        });
      }

      return updatedRow;
    });

    return NextResponse.json({
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  }
);

/**
 * DELETE /api/databases/[id]/rows/[rowId]
 */
export const DELETE = withTenant(
  async (req: NextRequest, { params, tenantId }: { params: { id: string; rowId: string }; tenantId: string }) => {
    const row = await prisma.dbRow.findFirst({
      where: { id: params.rowId, database_id: params.id, tenant_id: tenantId },
    });

    if (!row) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Row not found' }, meta: {} },
        { status: 404 }
      );
    }

    // Delete row (page is cascade-deleted or kept based on business rules)
    await prisma.dbRow.delete({ where: { id: params.rowId } });

    return NextResponse.json({
      data: { deleted: true },
      meta: { timestamp: new Date().toISOString() },
    });
  }
);
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/database/propertyValidators.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateProperties, extractTitleFromProperties } from '@/lib/database/propertyValidators';
import type { Column, RowProperties } from '@/types/database';

const testColumns: Column[] = [
  { id: 'col_title', name: 'Title', type: 'TITLE' },
  { id: 'col_status', name: 'Status', type: 'SELECT', options: ['Todo', 'Done'] },
  { id: 'col_count', name: 'Count', type: 'NUMBER' },
  { id: 'col_tags', name: 'Tags', type: 'MULTI_SELECT', options: ['A', 'B', 'C'] },
];

describe('validateProperties', () => {
  it('should accept valid properties', () => {
    const props: RowProperties = {
      col_title: { type: 'TITLE', value: 'Task 1' },
      col_status: { type: 'SELECT', value: 'Todo' },
      col_count: { type: 'NUMBER', value: 5 },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject unknown column IDs', () => {
    const props: RowProperties = {
      col_title: { type: 'TITLE', value: 'Task' },
      unknown_col: { type: 'TEXT', value: 'bad' },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unknown column');
  });

  it('should reject type mismatches', () => {
    const props: RowProperties = {
      col_title: { type: 'TITLE', value: 'Task' },
      col_count: { type: 'TEXT', value: 'not a number' },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid SELECT options', () => {
    const props: RowProperties = {
      col_title: { type: 'TITLE', value: 'Task' },
      col_status: { type: 'SELECT', value: 'Invalid' },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid option');
  });

  it('should require TITLE property', () => {
    const props: RowProperties = {
      col_status: { type: 'SELECT', value: 'Todo' },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('TITLE property is required');
  });
});

describe('extractTitleFromProperties', () => {
  it('should extract title from TITLE column', () => {
    const props: RowProperties = {
      col_title: { type: 'TITLE', value: 'My Task' },
    };
    expect(extractTitleFromProperties(props, testColumns)).toBe('My Task');
  });

  it('should return "Untitled" when TITLE property is missing', () => {
    expect(extractTitleFromProperties({}, testColumns)).toBe('Untitled');
  });
});
```

### Integration Tests: `src/__tests__/api/databases/route.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Database API (integration)', () => {
  let tenantId: string;
  let pageId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const page = await prisma.page.create({
      data: { title: 'My Database', tenant_id: tenantId },
    });
    pageId = page.id;
  });

  it('should create a database with valid schema', async () => {
    const response = await fetch('/api/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId,
        schema: {
          columns: [
            { id: 'col1', name: 'Title', type: 'TITLE' },
            { id: 'col2', name: 'Status', type: 'SELECT', options: ['Todo', 'Done'] },
          ],
        },
      }),
    });

    expect(response.status).toBe(201);
  });

  it('should reject schema without TITLE column', async () => {
    const response = await fetch('/api/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId,
        schema: {
          columns: [{ id: 'col1', name: 'Status', type: 'SELECT' }],
        },
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/database.ts` |
| CREATE | `src/lib/database/propertyValidators.ts` |
| MODIFY | `prisma/schema.prisma` (add Database and DbRow models) |
| CREATE | `prisma/migrations/XXXXXX_add_databases_and_rows/migration.sql` |
| CREATE | `src/app/api/databases/route.ts` |
| CREATE | `src/app/api/databases/[id]/route.ts` |
| CREATE | `src/app/api/databases/[id]/rows/route.ts` |
| CREATE | `src/app/api/databases/[id]/rows/[rowId]/route.ts` |
| CREATE | `src/__tests__/lib/database/propertyValidators.test.ts` |
| CREATE | `src/__tests__/api/databases/route.test.ts` |

---

**Last Updated:** 2026-02-21
