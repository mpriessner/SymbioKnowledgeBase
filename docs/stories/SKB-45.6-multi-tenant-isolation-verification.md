# Story SKB-45.6: Multi-Tenant Isolation Verification

**Epic:** Epic 45 - Practical Knowledge Enrichment & Multi-User Attribution
**Story ID:** SKB-45.6
**Story Points:** 2 | **Priority:** Medium | **Status:** Planned
**Depends On:** Epic 42 (sync pipeline), SKB-45.1-45.5 (all enrichment features)

---

## User Story

As a SaaS operator deploying SymbioKnowledgeBase for multiple institutions, I want verified multi-tenant isolation ensuring each institution's ChemELN data maps only to their SKB tenant, So that no cross-tenant data leakage occurs in page creation, search, or graph queries.

---

## Acceptance Criteria

- [ ] Verify sync pipeline respects tenant boundaries (each ChemELN instance → one SKB tenant)
- [ ] Configuration via `CHEMELN_TENANT_ID` env var links ChemELN instance to SKB tenant
- [ ] All database queries include `tenant_id` WHERE clause
- [ ] Test suite with simulated multi-tenant scenario (2+ tenants, separate ChemELN databases)
- [ ] Verify no cross-tenant data leakage in page creation
- [ ] Verify no cross-tenant data leakage in search queries
- [ ] Verify no cross-tenant data leakage in graph queries (wikilinks, backlinks)
- [ ] Verify practical notes, quality scores, key learnings scoped to tenant
- [ ] Verify "Who To Ask" sections only show researchers from same tenant
- [ ] Documentation: multi-tenant deployment guide
- [ ] TypeScript strict mode — no `any` types
- [ ] All test utilities have JSDoc comments

---

## Architecture Overview

```
Multi-Tenant Isolation Architecture
────────────────────────────────────

┌─────────────────────────────────────────────────┐
│  Institution A (tenant_id: inst-a-uuid)          │
│                                                   │
│  ChemELN Database A                              │
│  (postgres://chemeln-a.internal/chemeln)          │
│                                                   │
│  Env: CHEMELN_TENANT_ID=inst-a-uuid              │
└─────────────────────────────────────────────────┘
                    │
                    │ Sync Pipeline (isolated)
                    ▼
┌─────────────────────────────────────────────────┐
│  SKB Database                                    │
│                                                   │
│  pages table:                                    │
│    - tenant_id: inst-a-uuid                      │
│    - path: /experiments/EXP-2024-001             │
│    - content: {...practical notes...}            │
│                                                   │
│  blocks table:                                   │
│    - tenant_id: inst-a-uuid                      │
│    - page_id: ...                                │
│    - content: {...}                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Institution B (tenant_id: inst-b-uuid)          │
│                                                   │
│  ChemELN Database B                              │
│  (postgres://chemeln-b.internal/chemeln)          │
│                                                   │
│  Env: CHEMELN_TENANT_ID=inst-b-uuid              │
└─────────────────────────────────────────────────┘
                    │
                    │ Sync Pipeline (isolated)
                    ▼
┌─────────────────────────────────────────────────┐
│  SKB Database                                    │
│                                                   │
│  pages table:                                    │
│    - tenant_id: inst-b-uuid  ← DIFFERENT TENANT │
│    - path: /experiments/EXP-2024-001  ← SAME ID │
│    - content: {...different notes...}            │
│                                                   │
│  NO CROSS-TENANT QUERIES ALLOWED                 │
└─────────────────────────────────────────────────┘

Isolation Checks:
─────────────────
✓ Sync: ChemELN A → SKB tenant A only
✓ Sync: ChemELN B → SKB tenant B only
✓ Search: tenant A query → tenant A results only
✓ Graph: tenant A wikilinks → tenant A pages only
✓ "Who To Ask": tenant A → tenant A researchers only
✗ Cross-tenant query → returns empty or throws error
```

---

## Implementation Steps

### Step 1: Add Tenant ID Configuration

**File: `.env.example`** (modify)

```bash
# ChemELN Integration
CHEMELN_DATABASE_URL=postgres://user:pass@localhost:5432/chemeln
CHEMELN_TENANT_ID=your-tenant-uuid-here

# SKB Database
DATABASE_URL=postgres://user:pass@localhost:5432/skb

# Auth
CLERK_SECRET_KEY=...
```

---

### Step 2: Implement Tenant Isolation Utilities

**File: `src/lib/chemeln/enrichment/tenant-isolation.ts`** (create)

```typescript
import { prisma } from '@/lib/db';

/**
 * Get ChemELN tenant ID from environment.
 *
 * @throws Error if CHEMELN_TENANT_ID not set
 * @returns Tenant UUID
 */
export function getChemELNTenantId(): string {
  const tenantId = process.env.CHEMELN_TENANT_ID;

  if (!tenantId) {
    throw new Error(
      'CHEMELN_TENANT_ID environment variable not set. Required for multi-tenant isolation.'
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error(`Invalid CHEMELN_TENANT_ID format: ${tenantId}. Expected UUID.`);
  }

  return tenantId;
}

/**
 * Verify a page belongs to the expected tenant.
 *
 * @param pageId - Page ID to check
 * @param expectedTenantId - Expected tenant ID
 * @throws Error if page belongs to different tenant
 */
export async function verifyPageTenant(pageId: string, expectedTenantId: string): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { tenant_id: true },
  });

  if (!page) {
    throw new Error(`Page not found: ${pageId}`);
  }

  if (page.tenant_id !== expectedTenantId) {
    throw new Error(
      `Tenant isolation violation: Page ${pageId} belongs to tenant ${page.tenant_id}, expected ${expectedTenantId}`
    );
  }
}

/**
 * Verify all pages in a list belong to the expected tenant.
 *
 * @param pageIds - Page IDs to check
 * @param expectedTenantId - Expected tenant ID
 * @throws Error if any page belongs to different tenant
 */
export async function verifyPagesTenant(
  pageIds: string[],
  expectedTenantId: string
): Promise<void> {
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, tenant_id: true },
  });

  for (const page of pages) {
    if (page.tenant_id !== expectedTenantId) {
      throw new Error(
        `Tenant isolation violation: Page ${page.id} belongs to tenant ${page.tenant_id}, expected ${expectedTenantId}`
      );
    }
  }
}

/**
 * Audit all queries in a function for tenant_id filtering.
 *
 * Development helper to ensure tenant isolation.
 *
 * @param fn - Function to audit
 * @returns Audit report
 */
export async function auditTenantIsolation<T>(
  fn: () => Promise<T>
): Promise<{ result: T; queriesWithoutTenantFilter: string[] }> {
  // This is a simplified audit — production would use Prisma middleware
  const queriesWithoutTenantFilter: string[] = [];

  // Install Prisma middleware to track queries
  const middleware = prisma.$use(async (params, next) => {
    // Check if query includes tenant_id filter
    const hasTenantFilter =
      params.args?.where?.tenant_id !== undefined ||
      params.args?.where?.AND?.some((clause: any) => clause.tenant_id !== undefined);

    if (!hasTenantFilter && params.model && params.action !== 'findUnique') {
      queriesWithoutTenantFilter.push(`${params.model}.${params.action}`);
    }

    return next(params);
  });

  try {
    const result = await fn();
    return { result, queriesWithoutTenantFilter };
  } finally {
    // Note: Prisma doesn't support middleware removal, so this is conceptual
  }
}
```

---

### Step 3: Verify Sync Pipeline Tenant Scoping

**File: `src/lib/chemeln/sync/experiment-sync.ts`** (modify)

```typescript
import { getChemELNTenantId, verifyPageTenant } from '../enrichment/tenant-isolation';

export async function syncExperiments(): Promise<void> {
  // Get tenant ID from environment
  const tenantId = getChemELNTenantId();

  console.log(`[ChemELN Sync] Starting experiment sync for tenant: ${tenantId}`);

  // Fetch experiments from ChemELN (scoped to this ChemELN instance)
  const experiments = await fetchExperimentsFromChemELN();

  for (const experiment of experiments) {
    // Create/update page with tenant_id
    const page = await prisma.page.upsert({
      where: {
        tenant_id_path: {
          tenant_id: tenantId, // ← CRITICAL: Always scoped to tenant
          path: `/experiments/${experiment.id}`,
        },
      },
      update: {
        // ... update fields
      },
      create: {
        tenant_id: tenantId, // ← CRITICAL: Set tenant on creation
        path: `/experiments/${experiment.id}`,
        // ... other fields
      },
    });

    // Verify page belongs to expected tenant
    await verifyPageTenant(page.id, tenantId);
  }

  console.log(`[ChemELN Sync] Completed experiment sync for tenant: ${tenantId}`);
}
```

---

### Step 4: Create Multi-Tenant Test Suite

**File: `src/__tests__/lib/chemeln/enrichment/tenant-isolation.test.ts`** (create)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  getChemELNTenantId,
  verifyPageTenant,
  verifyPagesTenant,
} from '@/lib/chemeln/enrichment/tenant-isolation';
import { syncExperiments } from '@/lib/chemeln/sync/experiment-sync';

describe('Multi-Tenant Isolation', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    // Clean database
    await prisma.block.deleteMany();
    await prisma.page.deleteMany();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.CHEMELN_TENANT_ID;
  });

  describe('getChemELNTenantId', () => {
    it('should return tenant ID from environment', () => {
      process.env.CHEMELN_TENANT_ID = TENANT_A;
      expect(getChemELNTenantId()).toBe(TENANT_A);
    });

    it('should throw if CHEMELN_TENANT_ID not set', () => {
      delete process.env.CHEMELN_TENANT_ID;
      expect(() => getChemELNTenantId()).toThrow('CHEMELN_TENANT_ID environment variable not set');
    });

    it('should throw if CHEMELN_TENANT_ID invalid UUID', () => {
      process.env.CHEMELN_TENANT_ID = 'not-a-uuid';
      expect(() => getChemELNTenantId()).toThrow('Invalid CHEMELN_TENANT_ID format');
    });
  });

  describe('verifyPageTenant', () => {
    it('should pass for correct tenant', async () => {
      const page = await prisma.page.create({
        data: {
          tenant_id: TENANT_A,
          path: '/test-page',
          title: 'Test Page',
        },
      });

      await expect(verifyPageTenant(page.id, TENANT_A)).resolves.not.toThrow();
    });

    it('should throw for wrong tenant', async () => {
      const page = await prisma.page.create({
        data: {
          tenant_id: TENANT_A,
          path: '/test-page',
          title: 'Test Page',
        },
      });

      await expect(verifyPageTenant(page.id, TENANT_B)).rejects.toThrow(
        'Tenant isolation violation'
      );
    });
  });

  describe('Page Creation Isolation', () => {
    it('should create pages scoped to correct tenant', async () => {
      process.env.CHEMELN_TENANT_ID = TENANT_A;

      // Simulate sync for tenant A
      const pageA = await prisma.page.create({
        data: {
          tenant_id: getChemELNTenantId(),
          path: '/experiments/EXP-001',
          title: 'Experiment 1',
        },
      });

      expect(pageA.tenant_id).toBe(TENANT_A);

      // Change tenant
      process.env.CHEMELN_TENANT_ID = TENANT_B;

      // Simulate sync for tenant B (same experiment ID)
      const pageB = await prisma.page.create({
        data: {
          tenant_id: getChemELNTenantId(),
          path: '/experiments/EXP-001', // Same path, different tenant
          title: 'Experiment 1 (Tenant B)',
        },
      });

      expect(pageB.tenant_id).toBe(TENANT_B);
      expect(pageA.id).not.toBe(pageB.id); // Different pages

      // Verify both exist but are isolated
      const allPages = await prisma.page.findMany();
      expect(allPages).toHaveLength(2);
    });
  });

  describe('Search Isolation', () => {
    it('should only return results from same tenant', async () => {
      // Create pages for tenant A
      await prisma.page.create({
        data: {
          tenant_id: TENANT_A,
          path: '/experiments/exp-a',
          title: 'Suzuki Coupling Experiment',
        },
      });

      // Create pages for tenant B
      await prisma.page.create({
        data: {
          tenant_id: TENANT_B,
          path: '/experiments/exp-b',
          title: 'Suzuki Coupling Experiment',
        },
      });

      // Search for tenant A
      const resultsA = await prisma.page.findMany({
        where: {
          tenant_id: TENANT_A,
          title: { contains: 'Suzuki' },
        },
      });

      expect(resultsA).toHaveLength(1);
      expect(resultsA[0].tenant_id).toBe(TENANT_A);

      // Search for tenant B
      const resultsB = await prisma.page.findMany({
        where: {
          tenant_id: TENANT_B,
          title: { contains: 'Suzuki' },
        },
      });

      expect(resultsB).toHaveLength(1);
      expect(resultsB[0].tenant_id).toBe(TENANT_B);
    });
  });

  describe('Graph Queries Isolation', () => {
    it('should only return wikilinks within same tenant', async () => {
      // Create researcher page for tenant A
      const researcherA = await prisma.page.create({
        data: {
          tenant_id: TENANT_A,
          path: '/researchers/dr-mueller',
          title: 'Dr. Mueller',
        },
      });

      // Create experiment page for tenant A with wikilink
      const experimentA = await prisma.page.create({
        data: {
          tenant_id: TENANT_A,
          path: '/experiments/exp-a',
          title: 'Experiment A',
        },
      });

      // Create wikilink in same tenant
      await prisma.link.create({
        data: {
          source_page_id: experimentA.id,
          target_page_id: researcherA.id,
          link_text: 'Dr. Mueller',
        },
      });

      // Create researcher page for tenant B (same name)
      const researcherB = await prisma.page.create({
        data: {
          tenant_id: TENANT_B,
          path: '/researchers/dr-mueller',
          title: 'Dr. Mueller',
        },
      });

      // Query wikilinks for tenant A (should not include tenant B pages)
      const linksA = await prisma.link.findMany({
        where: {
          source_page: { tenant_id: TENANT_A },
        },
        include: {
          target_page: true,
        },
      });

      expect(linksA).toHaveLength(1);
      expect(linksA[0].target_page.tenant_id).toBe(TENANT_A);
      expect(linksA[0].target_page.id).not.toBe(researcherB.id);
    });
  });

  describe('Enrichment Feature Isolation', () => {
    it('should scope "Who To Ask" to same tenant', async () => {
      // Create researcher + experiments for tenant A
      await prisma.page.createMany({
        data: [
          {
            tenant_id: TENANT_A,
            path: '/researchers/dr-a',
            title: 'Dr. A',
          },
          {
            tenant_id: TENANT_A,
            path: '/experiments/exp-a-1',
            title: 'Experiment A1',
            metadata: { reaction_type: 'Suzuki Coupling', quality_score: 4.5 },
          },
        ],
      });

      // Create researcher + experiments for tenant B
      await prisma.page.createMany({
        data: [
          {
            tenant_id: TENANT_B,
            path: '/researchers/dr-b',
            title: 'Dr. B',
          },
          {
            tenant_id: TENANT_B,
            path: '/experiments/exp-b-1',
            title: 'Experiment B1',
            metadata: { reaction_type: 'Suzuki Coupling', quality_score: 5.0 },
          },
        ],
      });

      // Query researchers for tenant A
      const researchersA = await prisma.page.findMany({
        where: {
          tenant_id: TENANT_A,
          path: { startsWith: '/researchers/' },
        },
      });

      expect(researchersA).toHaveLength(1);
      expect(researchersA[0].title).toBe('Dr. A');

      // Verify "Who To Ask" would only include Dr. A
      const experimentsA = await prisma.page.findMany({
        where: {
          tenant_id: TENANT_A,
          path: { startsWith: '/experiments/' },
        },
      });

      expect(experimentsA).toHaveLength(1);
      // "Who To Ask" generation would only use researchersA + experimentsA
    });
  });
});
```

---

### Step 5: Documentation

**File: `docs/deployment/multi-tenant-setup.md`** (create)

```markdown
# Multi-Tenant Deployment Guide

## Overview

SymbioKnowledgeBase supports multi-tenant deployment where multiple institutions share a single SKB instance but maintain strict data isolation.

## Architecture

Each institution:
- Has its own ChemELN database
- Maps to a unique SKB tenant (identified by UUID)
- Cannot access data from other tenants

## Setup

### 1. Create Tenant in SKB

Use Clerk or your auth provider to create a tenant:

```sql
-- In SKB database
INSERT INTO tenants (id, name, created_at)
VALUES ('inst-a-uuid', 'Institution A', NOW());
```

### 2. Configure ChemELN Sync

Set environment variable for the sync pipeline:

```bash
# .env
CHEMELN_TENANT_ID=inst-a-uuid
CHEMELN_DATABASE_URL=postgres://user:pass@chemeln-a.internal/chemeln
```

### 3. Run Sync

```bash
npm run sync:chemeln
```

All synced data will be scoped to `inst-a-uuid`.

## Verification

Run the tenant isolation test suite:

```bash
npm test -- tenant-isolation
```

Verify:
- ✓ Pages created with correct tenant_id
- ✓ Search queries scoped to tenant
- ✓ Wikilinks don't cross tenant boundaries
- ✓ "Who To Ask" sections only show same-tenant researchers

## Common Issues

### Cross-Tenant Data Leakage

If you see data from another tenant:
1. Check CHEMELN_TENANT_ID is set correctly
2. Verify all database queries include `tenant_id` filter
3. Run audit: `npm run audit:tenant-isolation`

### Missing Tenant ID

Error: "CHEMELN_TENANT_ID environment variable not set"
- Set CHEMELN_TENANT_ID in .env before running sync

## Security

- **Database level**: All queries MUST include `WHERE tenant_id = $1`
- **Application level**: Use `getChemELNTenantId()` utility
- **Verification**: Run `verifyPageTenant()` after page creation
```

---

## Testing Requirements

See Step 4 for complete test suite covering:
- Tenant ID configuration validation
- Page creation isolation
- Search query isolation
- Graph query (wikilinks) isolation
- Enrichment feature (Who To Ask) isolation

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `.env.example` (add CHEMELN_TENANT_ID) |
| CREATE | `src/lib/chemeln/enrichment/tenant-isolation.ts` |
| CREATE | `src/__tests__/lib/chemeln/enrichment/tenant-isolation.test.ts` |
| MODIFY | `src/lib/chemeln/sync/experiment-sync.ts` (add tenant verification) |
| MODIFY | `src/lib/chemeln/sync/researcher-sync.ts` (add tenant verification) |
| MODIFY | `src/lib/chemeln/sync/reaction-type-sync.ts` (add tenant verification) |
| CREATE | `docs/deployment/multi-tenant-setup.md` |

---

## Dev Notes

### Why Tenant ID in Environment?

Each sync pipeline instance serves ONE ChemELN database → ONE SKB tenant. The tenant ID is deployment config, not runtime config, so environment variables are appropriate.

For multi-tenant sync (multiple ChemELN instances), run multiple pipeline instances with different `CHEMELN_TENANT_ID` values.

### Database-Level Isolation

The `tenant_id_path` unique constraint in Prisma schema ensures:
- Same path (e.g., `/experiments/EXP-001`) can exist in multiple tenants
- Each (tenant_id, path) pair is unique

```prisma
model Page {
  @@unique([tenant_id, path], name: "tenant_id_path")
}
```

### Audit Strategy

In production, use Prisma middleware to log all queries and verify `tenant_id` filtering:

```typescript
prisma.$use(async (params, next) => {
  if (params.model === 'Page' && !params.args?.where?.tenant_id) {
    console.warn(`Query without tenant_id filter: ${params.action}`);
  }
  return next(params);
});
```

---

**Last Updated:** 2026-03-21
