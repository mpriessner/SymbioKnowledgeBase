# SKB-02.3: API Key Authentication System

**Epic:** EPIC-02 — Authentication & Multi-Tenancy
**Story ID:** SKB-02.3
**Story Points:** 5
**Priority:** Critical
**Status:** Draft
**Depends On:** SKB-02.1 (User must be authenticated to manage API keys)

---

## User Story

**As a** researcher,
**I want to** generate API keys for my AI assistant,
**So that** the AI agent can programmatically read and write to my knowledge base.

---

## Acceptance Criteria

- [ ] Users can generate a new API key via `POST /api/keys`
- [ ] API keys are generated using `crypto.randomBytes(32)` producing a 64-character hex string
- [ ] Generated keys are prefixed with `skb_live_` for easy identification (total format: `skb_live_<64-hex-chars>`)
- [ ] The raw API key is shown to the user exactly ONCE in the creation response; it is never stored or retrievable again
- [ ] Only the SHA-256 hash of the key is persisted in the `api_keys` table
- [ ] Users can list their API keys via `GET /api/keys` (returns name, created_at, last_used_at, last 4 characters of key prefix, NOT full key)
- [ ] Users can revoke an API key via `DELETE /api/keys/[id]` (soft delete via `revoked_at` timestamp)
- [ ] Revoked keys immediately return 401 when used for authentication
- [ ] Each API key has a user-provided `name` (e.g., "Lab Companion Agent") for identification
- [ ] API key names are required and must be between 1 and 100 characters
- [ ] Users can only manage their own API keys (tenant-scoped)
- [ ] An AI agent can authenticate by sending `Authorization: Bearer skb_live_<key>` header
- [ ] The API key resolution middleware hashes the incoming key and looks it up in the `api_keys` table
- [ ] The `ApiKeyManager` component provides a UI for creating, viewing, and revoking API keys
- [ ] When a key is created, the component shows a copy-once modal with the full key and a warning that it cannot be shown again
- [ ] All API responses follow the standard envelope: `{ data, meta }` / `{ error, meta }`

---

## Architecture Overview

```
Settings Page (/settings)
┌──────────────────────────────────────────────────────────┐
│  API Keys                                                │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Name              Created       Last Used   Actions │ │
│  │ ───────────────── ─────────── ─────────── ──────── │ │
│  │ Lab Companion     Feb 21, 2026  2 hours ago [Revoke]│ │
│  │ CI/CD Pipeline    Feb 20, 2026  Never       [Revoke]│ │
│  │ Test Key          Feb 19, 2026  Revoked     ──────  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [+ Generate New API Key]                                │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  (Modal: shown after key generation)                │ │
│  │                                                     │ │
│  │  Your new API key:                                  │ │
│  │  ┌────────────────────────────────────────────────┐ │ │
│  │  │ skb_live_a1b2c3d4e5f6...                [Copy]│ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │  WARNING: This key will not be shown again.         │ │
│  │  Store it securely before closing this dialog.      │ │
│  │                                                     │ │
│  │                               [I've copied the key] │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

API Key Authentication Flow:
────────────────────────────

AI Agent                                        Server
   │                                               │
   │  GET /api/pages                               │
   │  Authorization: Bearer skb_live_a1b2c3...     │
   │  ────────────────────────────────────────────▶│
   │                                               │
   │                               ┌───────────────┤
   │                               │ Extract key   │
   │                               │ from header   │
   │                               │       │       │
   │                               │       ▼       │
   │                               │ SHA-256 hash  │
   │                               │       │       │
   │                               │       ▼       │
   │                               │ SELECT FROM   │
   │                               │ api_keys      │
   │                               │ WHERE         │
   │                               │ key_hash = $1 │
   │                               │ AND           │
   │                               │ revoked_at    │
   │                               │ IS NULL       │
   │                               │       │       │
   │                               │       ▼       │
   │                               │ Resolve       │
   │                               │ tenant_id     │
   │                               │ from user     │
   │                               └───────────────┤
   │                                               │
   │  200 OK { data: [...pages], meta: {...} }     │
   │  ◀────────────────────────────────────────────│
   │                                               │
```

---

## Implementation Steps

### Step 1: Create Zod validation schemas for API keys

**File: `src/lib/validation/apiKeys.ts`**

```typescript
import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
```

### Step 2: Create API key generation utility

The `hashApiKey` function was already created in `src/lib/apiAuth.ts` (SKB-02.2). Here we add the key generation function to the same file.

**File: `src/lib/apiAuth.ts` (extend from SKB-02.2)**

```typescript
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import type { TenantContext } from '@/types/auth';

const API_KEY_PREFIX = 'skb_live_';

/**
 * Hash an API key using SHA-256.
 * The raw key is never stored — only this hash is persisted in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new cryptographically random API key.
 *
 * Format: skb_live_<64 hex characters>
 * The raw key is returned for one-time display to the user.
 * Only the SHA-256 hash should be stored in the database.
 *
 * @returns { rawKey, keyHash } — rawKey for user display, keyHash for storage
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const randomPart = randomBytes(32).toString('hex'); // 64 hex chars
  const rawKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyHash };
}

/**
 * Resolve an API key from the Authorization header to a TenantContext.
 *
 * Extracts the Bearer token, hashes it with SHA-256, and looks up
 * the hash in the api_keys table. Returns the associated tenant context
 * or null if the key is invalid, revoked, or not found.
 */
export async function resolveApiKey(
  authHeader: string | null
): Promise<TenantContext | null> {
  if (!authHeader) {
    return null;
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const rawKey = match[1];
  const keyHash = hashApiKey(rawKey);

  // Look up the hashed key in the database
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null, // Only accept non-revoked keys
    },
    include: {
      user: {
        select: {
          id: true,
          tenantId: true,
          role: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.user) {
    return null;
  }

  // Update last used timestamp (fire-and-forget, no await needed)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      console.error(`Failed to update lastUsedAt for API key ${apiKey.id}`);
    });

  return {
    tenantId: apiKey.user.tenantId,
    userId: apiKey.user.id,
    role: apiKey.user.role,
  };
}
```

### Step 3: Create API key list and create endpoint

**File: `src/app/api/keys/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/tenantContext';
import { generateApiKey } from '@/lib/apiAuth';
import { createApiKeySchema } from '@/lib/validation/apiKeys';

// GET /api/keys — List all API keys for the authenticated user
export const GET = withTenant(async (req: NextRequest, ctx) => {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedKeys = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    revokedAt: key.revokedAt?.toISOString() || null,
    isRevoked: key.revokedAt !== null,
  }));

  return NextResponse.json({
    data: formattedKeys,
    meta: {
      total: formattedKeys.length,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/keys — Generate a new API key
export const POST = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();

  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid API key data',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  const { name } = parsed.data;
  const { rawKey, keyHash } = generateApiKey();

  // Store last 4 characters of the raw key for display purposes
  const keyPrefix = `...${rawKey.slice(-4)}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    },
  });

  // Return the raw key ONCE — it will never be shown again
  return NextResponse.json(
    {
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey, // One-time display only
        keyPrefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt.toISOString(),
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});
```

### Step 4: Create API key revoke endpoint

**File: `src/app/api/keys/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/tenantContext';

// DELETE /api/keys/:id — Revoke an API key (soft delete)
export const DELETE = withTenant(async (req: NextRequest, ctx, params) => {
  const { id } = params;

  // Find the key (scoped to user and tenant)
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    },
  });

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 404 }
    );
  }

  if (apiKey.revokedAt) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message: 'API key is already revoked',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 409 }
    );
  }

  // Soft-delete by setting revokedAt
  const revokedKey = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({
    data: {
      id: revokedKey.id,
      name: revokedKey.name,
      revokedAt: revokedKey.revokedAt!.toISOString(),
    },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

### Step 5: Create ApiKeyManager component

**File: `src/components/settings/ApiKeyManager.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  isRevoked: boolean;
}

interface NewKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Create key form state
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Copy-once modal state
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewKeyResponse | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      const body = await response.json();
      setKeys(body.data);
    } catch (err) {
      setError('Failed to load API keys');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || 'Failed to create API key');
        return;
      }

      const body = await response.json();
      setNewlyCreatedKey(body.data);
      setNewKeyName('');
      setShowCreateForm(false);
      setCopied(false);

      // Refresh the key list
      await fetchKeys();
    } catch {
      setError('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setRevokingId(id);
    setError('');

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || 'Failed to revoke API key');
        return;
      }

      // Refresh the key list
      await fetchKeys();
    } catch {
      setError('Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      try {
        await navigator.clipboard.writeText(newlyCreatedKey.key);
        setCopied(true);
      } catch {
        // Fallback: select the text for manual copy
        const textArea = document.querySelector(
          '[data-key-display]'
        ) as HTMLInputElement;
        if (textArea) {
          textArea.select();
        }
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateStr);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          API Keys
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
            hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          + Generate New API Key
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        API keys allow AI agents to access your knowledge base programmatically.
        Include the key in the <code className="rounded bg-gray-100 px-1 py-0.5
        text-xs dark:bg-gray-800">Authorization: Bearer &lt;key&gt;</code> header.
      </p>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Create Key Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateKey}
          className="flex gap-3 rounded-lg border border-gray-200 p-4
            dark:border-gray-700"
        >
          <input
            type="text"
            placeholder="Key name (e.g., Lab Companion Agent)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            required
            maxLength={100}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
              text-gray-900 placeholder-gray-400
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
              dark:border-gray-600 dark:bg-gray-800 dark:text-white
              dark:placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={isCreating || !newKeyName.trim()}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? 'Generating...' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm
              text-gray-700 hover:bg-gray-50
              dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Newly Created Key Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl
              dark:bg-gray-800"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              API Key Created: {newlyCreatedKey.name}
            </h3>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Your new API key is shown below. Copy it now — it will not be
              displayed again.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newlyCreatedKey.key}
                data-key-display
                className="flex-1 rounded-md border border-gray-300 bg-gray-50
                  px-3 py-2 font-mono text-sm text-gray-900
                  dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                onClick={handleCopyKey}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm
                  hover:bg-gray-50
                  dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-4 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                WARNING: This key will not be shown again. Store it securely
                before closing this dialog.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
                  text-white hover:bg-blue-500"
              >
                I&apos;ve copied the key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8
          text-center dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No API keys yet. Generate one to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200
          dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200
            dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium
                  uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white
              dark:divide-gray-700 dark:bg-gray-900">
              {keys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm
                    font-medium text-gray-900 dark:text-white">
                    {apiKey.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono
                    text-sm text-gray-500 dark:text-gray-400">
                    skb_live_{apiKey.keyPrefix}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm
                    text-gray-500 dark:text-gray-400">
                    {formatDate(apiKey.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm
                    text-gray-500 dark:text-gray-400">
                    {apiKey.isRevoked ? '---' : formatLastUsed(apiKey.lastUsedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {apiKey.isRevoked ? (
                      <span className="inline-flex rounded-full bg-red-100
                        px-2 py-0.5 text-xs font-medium text-red-800
                        dark:bg-red-900/30 dark:text-red-400">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-100
                        px-2 py-0.5 text-xs font-medium text-green-800
                        dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right
                    text-sm">
                    {!apiKey.isRevoked && (
                      <button
                        onClick={() => handleRevokeKey(apiKey.id)}
                        disabled={revokingId === apiKey.id}
                        className="text-red-600 hover:text-red-800
                          disabled:cursor-not-allowed disabled:opacity-50
                          dark:text-red-400 dark:hover:text-red-300"
                      >
                        {revokingId === apiKey.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/auth/apiKey.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey } from '@/lib/apiAuth';

describe('generateApiKey', () => {
  it('generates a key with the correct prefix', () => {
    const { rawKey } = generateApiKey();
    expect(rawKey).toMatch(/^skb_live_[a-f0-9]{64}$/);
  });

  it('generates unique keys on each call', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it('generates a key hash that is a valid SHA-256 hex string', () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates the correct hash for the generated key', () => {
    const { rawKey, keyHash } = generateApiKey();
    const recomputedHash = hashApiKey(rawKey);
    expect(recomputedHash).toBe(keyHash);
  });
});

describe('hashApiKey', () => {
  it('produces deterministic SHA-256 hashes', () => {
    const key = 'skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different keys', () => {
    const hash1 = hashApiKey('skb_live_key1');
    const hash2 = hashApiKey('skb_live_key2');
    expect(hash1).not.toBe(hash2);
  });

  it('produces a 64-character hex string', () => {
    const hash = hashApiKey('any-input');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

**File: `tests/unit/auth/apiKeyValidation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createApiKeySchema } from '@/lib/validation/apiKeys';

describe('createApiKeySchema', () => {
  it('accepts valid key name', () => {
    const result = createApiKeySchema.safeParse({ name: 'Lab Companion Agent' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createApiKeySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = createApiKeySchema.safeParse({ name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from name', () => {
    const result = createApiKeySchema.safeParse({ name: '  My Key  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Key');
    }
  });

  it('rejects missing name field', () => {
    const result = createApiKeySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

**File: `tests/api/apiKeys.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('API Key Management', () => {
  let sessionCookie: string;
  let userId: string;
  let tenantId: string;
  let createdKeyId: string;
  let createdRawKey: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    const tenant = await prisma.tenant.create({
      data: { name: 'API Key Test Tenant' },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        name: 'API Key Test User',
        email: 'test-apikey@example.com',
        passwordHash,
        role: 'USER',
        tenantId: tenant.id,
      },
    });
    userId = user.id;

    // Login to get session
    const loginResponse = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-apikey@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    sessionCookie =
      loginResponse.headers.get('set-cookie')?.split(';')[0] || '';
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('creates a new API key and returns the raw key once', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: 'Test Agent Key' }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe('Test Agent Key');
    expect(body.data.key).toMatch(/^skb_live_[a-f0-9]{64}$/);
    expect(body.data.keyPrefix).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();

    createdKeyId = body.data.id;
    createdRawKey = body.data.key;
  });

  it('lists API keys without showing full key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.length).toBeGreaterThan(0);
    const key = body.data.find(
      (k: { id: string }) => k.id === createdKeyId
    );
    expect(key).toBeDefined();
    expect(key.name).toBe('Test Agent Key');
    expect(key.keyPrefix).toBeDefined();
    expect(key.isRevoked).toBe(false);

    // Full key must NOT be present in list response
    expect(key.key).toBeUndefined();
    expect(key.keyHash).toBeUndefined();
  });

  it('authenticates with the created API key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: {
        Authorization: `Bearer ${createdRawKey}`,
      },
    });

    expect(response.status).toBe(200);
  });

  it('returns 400 for missing key name', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('revokes an API key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys/${createdKeyId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.revokedAt).toBeDefined();
  });

  it('returns 401 when using a revoked API key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: {
        Authorization: `Bearer ${createdRawKey}`,
      },
    });

    expect(response.status).toBe(401);
  });

  it('returns 409 when revoking an already-revoked key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys/${createdKeyId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when revoking a non-existent key', async () => {
    const response = await fetch(
      `${BASE_URL}/api/keys/00000000-0000-0000-0000-000000000000`,
      {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      }
    );

    expect(response.status).toBe(404);
  });

  it('returns 401 for unauthenticated key listing', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`);
    expect(response.status).toBe(401);
  });
});

describe('API Key Tenant Isolation', () => {
  let userASessionCookie: string;
  let userBSessionCookie: string;
  let tenantAId: string;
  let tenantBId: string;
  let keyAId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('testpassword123', 10);

    const tenantA = await prisma.tenant.create({
      data: { name: 'Key Isolation A' },
    });
    tenantAId = tenantA.id;

    await prisma.user.create({
      data: {
        name: 'Key User A',
        email: 'test-keyiso-a@example.com',
        passwordHash,
        role: 'USER',
        tenantId: tenantA.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: { name: 'Key Isolation B' },
    });
    tenantBId = tenantB.id;

    await prisma.user.create({
      data: {
        name: 'Key User B',
        email: 'test-keyiso-b@example.com',
        passwordHash,
        role: 'USER',
        tenantId: tenantB.id,
      },
    });

    // Login both users
    const loginA = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-keyiso-a@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    userASessionCookie =
      loginA.headers.get('set-cookie')?.split(';')[0] || '';

    const loginB = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-keyiso-b@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    userBSessionCookie =
      loginB.headers.get('set-cookie')?.split(';')[0] || '';

    // Create a key as User A
    const createResponse = await fetch(`${BASE_URL}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userASessionCookie,
      },
      body: JSON.stringify({ name: 'User A Agent' }),
    });
    const createBody = await createResponse.json();
    keyAId = createBody.data.id;
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-keyiso-' } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
  });

  it('user B cannot see user A API keys', async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: { Cookie: userBSessionCookie },
    });

    const body = await response.json();
    const keyIds = body.data.map((k: { id: string }) => k.id);
    expect(keyIds).not.toContain(keyAId);
  });

  it('user B cannot revoke user A API key', async () => {
    const response = await fetch(`${BASE_URL}/api/keys/${keyAId}`, {
      method: 'DELETE',
      headers: { Cookie: userBSessionCookie },
    });

    expect(response.status).toBe(404);
  });
});
```

---

## Files to Create/Modify

| Action | File Path | Description |
|--------|-----------|-------------|
| Create | `src/lib/validation/apiKeys.ts` | Zod schema for API key creation |
| Modify | `src/lib/apiAuth.ts` | Add `generateApiKey()` function (extends SKB-02.2 file) |
| Create | `src/app/api/keys/route.ts` | GET (list) and POST (create) API key endpoints |
| Create | `src/app/api/keys/[id]/route.ts` | DELETE (revoke) API key endpoint |
| Create | `src/components/settings/ApiKeyManager.tsx` | API key management UI component |
| Modify | `src/app/(workspace)/settings/page.tsx` | Import and render ApiKeyManager component |
| Create | `tests/unit/auth/apiKey.test.ts` | Unit tests for key generation and hashing |
| Create | `tests/unit/auth/apiKeyValidation.test.ts` | Unit tests for Zod validation schemas |
| Create | `tests/api/apiKeys.test.ts` | Integration tests for API key CRUD and auth |

---

**Last Updated:** 2026-02-21
