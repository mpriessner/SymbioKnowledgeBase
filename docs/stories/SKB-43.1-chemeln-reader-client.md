# Story SKB-43.1: ChemELN Reader Client

**Epic:** Epic 43 - ChemELN Data Extraction & Transformation
**Story ID:** SKB-43.1
**Story Points:** 3 | **Priority:** Critical | **Status:** Planned
**Depends On:** Nothing (first story in epic)

---

## User Story

As a data extraction service, I want a read-only Supabase client connected to ChemELN's database, So that I can safely query experiment data without risk of modifying the source system.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/client.ts` exports a `getChemELNClient()` function that returns a configured Supabase client
- [ ] Client authenticates using service role key from `CHEMELN_SERVICE_ROLE_KEY` environment variable
- [ ] Supabase URL loaded from `CHEMELN_SUPABASE_URL` environment variable
- [ ] Configuration validation: throws error if required environment variables are missing
- [ ] Connection health check function `checkChemELNConnection()` that verifies database accessibility
- [ ] Pagination helper functions `paginateQuery(query, limit, offset)` for large result sets
- [ ] Error handling for connection failures, invalid credentials, network timeouts
- [ ] All operations are read-only (SELECT queries only) — enforced by service role permissions
- [ ] TypeScript strict mode enabled — no `any` types
- [ ] Unit tests verify client creation, configuration validation, error handling
- [ ] Integration test verifies connection to real ChemELN instance (skipped if credentials unavailable)

---

## Architecture Overview

```
Environment Variables (.env)
    │
    │  CHEMELN_SUPABASE_URL=https://et-eln.supabase.co
    │  CHEMELN_SERVICE_ROLE_KEY=eyJhbGciOi... (read-only)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  src/lib/chemeln/config.ts                          │
│  - loadChemELNConfig()                              │
│  - Validates required env vars                      │
│  - Returns { url, serviceRoleKey }                  │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  src/lib/chemeln/client.ts                          │
│                                                     │
│  export function getChemELNClient() {               │
│    const { url, serviceRoleKey } = loadConfig();   │
│    return createClient(url, serviceRoleKey, {      │
│      auth: { persistSession: false }               │
│    });                                              │
│  }                                                  │
│                                                     │
│  export async function checkConnection() {         │
│    const client = getChemELNClient();              │
│    const { error } = await client                  │
│      .from('experiments')                          │
│      .select('count', { count: 'exact', head: true });│
│    return { healthy: !error, error };              │
│  }                                                  │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Supabase Client Instance                           │
│  - Connected to ChemELN database                    │
│  - Service role permissions (read-only)             │
│  - No session persistence (stateless)               │
└─────────────────────────────────────────────────────┘
```

**Why service role key:** Service role keys bypass Row Level Security (RLS) policies, allowing the extraction service to read all experiments across all tenants in ChemELN without being tied to a specific user session. This is safe because the key has read-only permissions in Supabase.

**Why `persistSession: false`:** The client is used server-side only (not in browser). Disabling session persistence prevents memory leaks from accumulated session state.

---

## Implementation Steps

### Step 1: Create Configuration Module

Create `src/lib/chemeln/config.ts` to load and validate environment variables.

**File: `src/lib/chemeln/config.ts`**

```typescript
export interface ChemELNConfig {
  url: string;
  serviceRoleKey: string;
}

export function loadChemELNConfig(): ChemELNConfig {
  const url = process.env.CHEMELN_SUPABASE_URL;
  const serviceRoleKey = process.env.CHEMELN_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'CHEMELN_SUPABASE_URL environment variable is required. ' +
      'Add it to .env with the ChemELN Supabase project URL.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'CHEMELN_SERVICE_ROLE_KEY environment variable is required. ' +
      'Add it to .env with the ChemELN service role key (read-only).'
    );
  }

  return { url, serviceRoleKey };
}
```

**Validation logic:**
- Throws descriptive errors if variables are missing
- Error messages guide developers to fix the configuration
- Returns typed object for type-safe consumption

---

### Step 2: Create Supabase Client

Create `src/lib/chemeln/client.ts` with the client factory function.

**File: `src/lib/chemeln/client.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadChemELNConfig } from './config';

let clientInstance: SupabaseClient | null = null;

export function getChemELNClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const { url, serviceRoleKey } = loadChemELNConfig();

  clientInstance = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return clientInstance;
}
```

**Singleton pattern:**
- Client instance is created once and reused
- Avoids creating multiple connections to ChemELN
- If configuration changes, restart the application

---

### Step 3: Implement Connection Health Check

Add a health check function to verify database accessibility.

**Add to `src/lib/chemeln/client.ts`:**

```typescript
export interface ConnectionHealth {
  healthy: boolean;
  error: string | null;
  experimentCount?: number;
}

export async function checkChemELNConnection(): Promise<ConnectionHealth> {
  try {
    const client = getChemELNClient();

    const { count, error } = await client
      .from('experiments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }

    return {
      healthy: true,
      error: null,
      experimentCount: count ?? 0,
    };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
```

**Health check logic:**
- Queries `experiments` table with `count: 'exact', head: true` (no data returned, just count)
- Returns `healthy: true` if query succeeds
- Returns error message if connection fails or credentials are invalid
- Catches network errors, DNS failures, timeouts

---

### Step 4: Implement Pagination Helpers

Add utility functions for paginated queries (ChemELN may have thousands of experiments).

**Add to `src/lib/chemeln/client.ts`:**

```typescript
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export function applyPagination<T>(
  query: ReturnType<SupabaseClient['from']>,
  options: PaginationOptions
) {
  return query.range(options.offset, options.offset + options.limit - 1);
}
```

**Usage example:**

```typescript
const client = getChemELNClient();
const query = client.from('experiments').select('*');
const paginatedQuery = applyPagination(query, { limit: 100, offset: 0 });
const { data, error } = await paginatedQuery;
```

**Why `.range()` instead of `.limit()` and `.offset()`:**
- Supabase's `.range(start, end)` is inclusive on both ends
- More explicit: `.range(0, 99)` returns 100 rows
- Easier to calculate: `offset + limit - 1` gives the end index

---

### Step 5: Add Environment Variables to .env.example

Document the required environment variables for ChemELN connection.

**Add to `.env.example`:**

```bash
# ChemELN Database Connection (Read-Only)
# ChemELN is a separate Supabase project (ET_ELN) running on port 54331 (typical)
# The service role key should have read-only permissions (SELECT only)
CHEMELN_SUPABASE_URL=https://your-chemeln-project.supabase.co
CHEMELN_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

### Step 6: Export Public API

Create an index file to expose only the public functions.

**File: `src/lib/chemeln/index.ts`**

```typescript
export { getChemELNClient, checkChemELNConnection } from './client';
export type { ConnectionHealth, PaginationOptions } from './client';
export type { ChemELNConfig } from './config';
```

**Why an index file:**
- Provides a clean public API surface
- Hides internal implementation details (config loading logic)
- Consumers import from `@/lib/chemeln` instead of `@/lib/chemeln/client`

---

## Testing Requirements

### Unit Tests: `tests/unit/chemeln/client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadChemELNConfig } from '@/lib/chemeln/config';

describe('ChemELN Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CHEMELN_SUPABASE_URL;
    delete process.env.CHEMELN_SERVICE_ROLE_KEY;
  });

  it('should load configuration from environment variables', () => {
    process.env.CHEMELN_SUPABASE_URL = 'https://test.supabase.co';
    process.env.CHEMELN_SERVICE_ROLE_KEY = 'test-key';

    const config = loadChemELNConfig();

    expect(config.url).toBe('https://test.supabase.co');
    expect(config.serviceRoleKey).toBe('test-key');
  });

  it('should throw error if CHEMELN_SUPABASE_URL is missing', () => {
    process.env.CHEMELN_SERVICE_ROLE_KEY = 'test-key';

    expect(() => loadChemELNConfig()).toThrow(
      /CHEMELN_SUPABASE_URL environment variable is required/
    );
  });

  it('should throw error if CHEMELN_SERVICE_ROLE_KEY is missing', () => {
    process.env.CHEMELN_SUPABASE_URL = 'https://test.supabase.co';

    expect(() => loadChemELNConfig()).toThrow(
      /CHEMELN_SERVICE_ROLE_KEY environment variable is required/
    );
  });
});
```

### Integration Test: `tests/integration/chemeln/connection.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { checkChemELNConnection } from '@/lib/chemeln';

describe('ChemELN Connection (Integration)', () => {
  it('should successfully connect to ChemELN database', async () => {
    const health = await checkChemELNConnection();

    expect(health.healthy).toBe(true);
    expect(health.error).toBeNull();
    expect(health.experimentCount).toBeGreaterThanOrEqual(0);
  }, 10000); // 10 second timeout for network request
});
```

**Note:** Integration test only runs if `.env.test` contains valid ChemELN credentials.

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/config.ts` |
| CREATE | `src/lib/chemeln/client.ts` |
| CREATE | `src/lib/chemeln/index.ts` |
| MODIFY | `.env.example` |
| CREATE | `tests/unit/chemeln/client.test.ts` |
| CREATE | `tests/integration/chemeln/connection.test.ts` |

---

## Dev Notes

**Service role key permissions:** Ensure the ChemELN service role key has read-only permissions. This should be configured in ChemELN's Supabase dashboard by creating a custom role with `SELECT` privileges only on the required tables (`experiments`, `reagents`, `products`, `chemicals`, `auth.users`).

**Fallback for offline development:** If ChemELN is unavailable (offline development), the health check will return `healthy: false`. Consumers should handle this gracefully by returning empty arrays or cached data.

**Performance consideration:** The client uses a singleton pattern to avoid creating multiple Supabase connections. For serverless deployments (Vercel, Netlify), each invocation creates a new connection, but the singleton pattern still reduces redundant client creation within a single request.

---

**Last Updated:** 2026-03-21
