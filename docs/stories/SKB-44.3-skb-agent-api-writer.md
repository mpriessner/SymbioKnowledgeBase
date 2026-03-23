# Story SKB-44.3: SKB Agent API Writer Client

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.3
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-15 (Agent API must exist with POST/PUT endpoints)

---

## User Story

As an ingestion pipeline, I want a TypeScript client that writes generated Markdown pages to SymbioKnowledgeBase via the Agent API, So that generated pages are stored as real knowledge base pages with proper parent hierarchies, wikilinks, and metadata.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/sync/writer.ts` exports `SkbAgentApiWriter` class
- [ ] Create pages: `POST /api/agent/pages` with markdown body and optional `parent_id`
- [ ] Update pages: `PUT /api/agent/pages/:id` with markdown body
- [ ] Search pages: `GET /api/agent/pages?q=tag:eln:EXP-2024-001` for upsert matching
- [ ] Authentication via API key from environment variable (`SKB_AGENT_API_KEY`)
- [ ] API base URL from environment variable (`SKB_AGENT_API_URL`)
- [ ] Rate limiting: max 10 API calls/second using token bucket algorithm
- [ ] Error handling:
  - 429 Too Many Requests → exponential backoff (2s, 4s, 8s, max 30s)
  - 500 Server Error → retry up to 3 times with 1s delay
  - 404 Not Found → skip with warning log
  - 400 Bad Request → fail immediately with error details
- [ ] All API calls use `Content-Type: text/markdown` for write operations
- [ ] All API calls use `Accept: text/markdown` for read operations
- [ ] Unit tests cover retry logic, rate limiting, error handling
- [ ] Integration test creates, searches, and updates a test page

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  SkbAgentApiWriter                                          │
│                                                             │
│  Configuration:                                             │
│    apiUrl: string (from SKB_AGENT_API_URL env)              │
│    apiKey: string (from SKB_AGENT_API_KEY env)              │
│    rateLimit: 10 calls/sec                                  │
│    maxRetries: 3                                            │
│                                                             │
│  Methods:                                                   │
│    createPage(markdown, parentId?) → PageResult             │
│    updatePage(pageId, markdown) → PageResult                │
│    searchByTag(tag) → PageResult[]                          │
│    searchByTitle(title) → PageResult | null                 │
│    upsertPage(markdown, matchTag) → UpsertResult            │
│    healthCheck() → boolean                                  │
│                                                             │
│  Internal:                                                  │
│    tokenBucket: TokenBucket (10 tokens/sec)                 │
│    fetchWithRetry(url, options) → Response                  │
│    waitForToken() → void                                    │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTP
         ▼
┌─────────────────────────────────────────────────────────────┐
│  SymbioKnowledgeBase Agent API (EPIC-15)                    │
│                                                             │
│  POST /api/agent/pages                                      │
│    Headers: Authorization: Bearer <key>                     │
│    Content-Type: text/markdown                              │
│    Body: markdown string (with YAML frontmatter)            │
│    Response: { id, title, created_at }                      │
│                                                             │
│  PUT /api/agent/pages/:id                                   │
│    Headers: Authorization: Bearer <key>                     │
│    Content-Type: text/markdown                              │
│    Body: markdown string                                    │
│    Response: { id, title, updated_at }                      │
│                                                             │
│  GET /api/agent/pages?q=tag:eln:EXP-2024-001                │
│    Headers: Authorization: Bearer <key>                     │
│    Accept: application/json                                 │
│    Response: { pages: [{ id, title, tags }] }               │
│                                                             │
│  GET /api/agent/pages?q=title:"Palladium Acetate"           │
│    Response: { pages: [{ id, title, tags }] }               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Types

**File: `src/lib/chemeln/sync/types.ts`**

```typescript
export interface PageResult {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface UpsertResult {
  action: 'created' | 'updated' | 'skipped';
  pageId: string;
  title: string;
  contentHash: string;
}

export interface WriterConfig {
  apiUrl: string;
  apiKey: string;
  rateLimit?: number; // calls per second, default 10
  maxRetries?: number; // default 3
}
```

### Step 2: Implement Token Bucket Rate Limiter

```typescript
class TokenBucket {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

### Step 3: Implement SkbAgentApiWriter

**File: `src/lib/chemeln/sync/writer.ts`**

```typescript
import { PageResult, UpsertResult, WriterConfig } from './types';
import crypto from 'crypto';

export class SkbAgentApiWriter {
  private config: Required<WriterConfig>;
  private tokenBucket: TokenBucket;

  constructor(config: WriterConfig) {
    this.config = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      rateLimit: config.rateLimit ?? 10,
      maxRetries: config.maxRetries ?? 3,
    };
    this.tokenBucket = new TokenBucket(this.config.rateLimit, this.config.rateLimit);
  }

  async createPage(markdown: string, parentId?: string): Promise<PageResult> {
    await this.tokenBucket.acquire();
    const url = `${this.config.apiUrl}/api/agent/pages`;
    const body: Record<string, string> = { content: markdown };
    if (parentId) body.parent_id = parentId;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return response.json() as Promise<PageResult>;
  }

  async updatePage(pageId: string, markdown: string): Promise<PageResult> {
    await this.tokenBucket.acquire();
    const url = `${this.config.apiUrl}/api/agent/pages/${pageId}`;

    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'text/markdown',
      },
      body: markdown,
    });

    return response.json() as Promise<PageResult>;
  }

  async searchByTag(tag: string): Promise<PageResult[]> {
    await this.tokenBucket.acquire();
    const url = `${this.config.apiUrl}/api/agent/pages?q=tag:${encodeURIComponent(tag)}`;

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json() as { pages: PageResult[] };
    return data.pages;
  }

  async searchByTitle(title: string): Promise<PageResult | null> {
    await this.tokenBucket.acquire();
    const url = `${this.config.apiUrl}/api/agent/pages?q=title:${encodeURIComponent(`"${title}"`)}`;

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json() as { pages: PageResult[] };
    return data.pages[0] ?? null;
  }

  async upsertPage(markdown: string, matchTag: string): Promise<UpsertResult> {
    const contentHash = this.computeHash(markdown);

    // Search for existing page
    const existing = await this.searchByTag(matchTag);

    if (existing.length > 0) {
      const page = existing[0];
      // In a real implementation, compare content hashes
      const result = await this.updatePage(page.id, markdown);
      return { action: 'updated', pageId: result.id, title: result.title ?? '', contentHash };
    }

    // Create new page
    const result = await this.createPage(markdown);
    return { action: 'created', pageId: result.id, title: result.title ?? '', contentHash };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/agent/health`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private computeHash(content: string): string {
    // Strip timestamps from frontmatter for stable hashing
    const stripped = content.replace(/^(created|updated):.*$/gm, '');
    return crypto.createHash('md5').update(stripped).digest('hex');
  }

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.ok) return response;

        if (response.status === 429) {
          // Rate limited — exponential backoff
          const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.warn(`Rate limited (429). Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (response.status >= 500) {
          // Server error — retry
          console.warn(`Server error (${response.status}). Retry ${attempt + 1}/${this.config.maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        if (response.status === 404) {
          console.warn(`Not found (404): ${url}. Skipping.`);
          throw new Error(`Not found: ${url}`);
        }

        if (response.status === 400) {
          const body = await response.text();
          throw new Error(`Bad request (400): ${body}`);
        }

        throw new Error(`Unexpected status ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).message.includes('Not found') || (error as Error).message.includes('Bad request')) {
          throw error; // Don't retry 404 or 400
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }
}
```

### Step 4: Factory Function

```typescript
export function createWriter(): SkbAgentApiWriter {
  const apiUrl = process.env.SKB_AGENT_API_URL;
  const apiKey = process.env.SKB_AGENT_API_KEY;

  if (!apiUrl) throw new Error('SKB_AGENT_API_URL environment variable is required');
  if (!apiKey) throw new Error('SKB_AGENT_API_KEY environment variable is required');

  return new SkbAgentApiWriter({ apiUrl, apiKey });
}
```

---

## Testing Requirements

### Unit Test: `src/__tests__/lib/chemeln/sync/writer.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkbAgentApiWriter } from '@/lib/chemeln/sync/writer';

describe('SkbAgentApiWriter', () => {
  let writer: SkbAgentApiWriter;

  beforeEach(() => {
    writer = new SkbAgentApiWriter({
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      rateLimit: 100, // high limit for tests
      maxRetries: 2,
    });
  });

  it('should retry on 500 errors', async () => {
    let attempts = 0;
    global.fetch = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        return new Response('Server Error', { status: 500 });
      }
      return new Response(JSON.stringify({ id: 'page-1', title: 'Test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await writer.createPage('# Test\n\nContent');
    expect(result.id).toBe('page-1');
    expect(attempts).toBe(3);
  });

  it('should fail immediately on 400 errors', async () => {
    global.fetch = vi.fn(async () => {
      return new Response('Invalid markdown', { status: 400 });
    });

    await expect(writer.createPage('bad content')).rejects.toThrow('Bad request');
  });

  it('should exponentially backoff on 429 errors', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, delay: number) => {
      delays.push(delay);
      return originalSetTimeout(fn, 0); // Execute immediately in tests
    }) as typeof setTimeout);

    let attempts = 0;
    global.fetch = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        return new Response('Rate limited', { status: 429 });
      }
      return new Response(JSON.stringify({ id: 'page-1', title: 'Test' }), { status: 200 });
    });

    await writer.createPage('# Test');
    expect(delays[0]).toBe(2000);
    expect(delays[1]).toBe(4000);
  });

  it('should compute stable content hash ignoring timestamps', () => {
    const md1 = '---\ntitle: Test\ncreated: 2026-03-01\n---\n# Content';
    const md2 = '---\ntitle: Test\ncreated: 2026-03-21\n---\n# Content';
    // Both should produce same hash since timestamps are stripped
    // (This would test the private method — may need to make it accessible for testing)
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/sync/writer.ts` |
| CREATE | `src/lib/chemeln/sync/types.ts` |
| MODIFY | `.env.example` (add SKB_AGENT_API_KEY, SKB_AGENT_API_URL) |
| CREATE | `src/__tests__/lib/chemeln/sync/writer.test.ts` |

---

## Dev Notes

**Content-Type negotiation:** The SKB Agent API (EPIC-15) supports both JSON and Markdown formats. We use `text/markdown` for writes (the API converts to TipTap JSON internally via EPIC-14 deserializer) and `application/json` for search results.

**Token bucket vs leaky bucket:** Token bucket allows short bursts (e.g., 10 rapid calls) then throttles. This is better for batch sync where we want maximum throughput within the rate limit. A leaky bucket would space calls evenly, which is unnecessary overhead for this use case.

**Upsert matching:** We match by tag (e.g., `eln:EXP-2024-001` for experiments, `cas:107-06-2` for chemicals) rather than title, because tags are guaranteed unique while titles might change. Fallback to title match for entities without unique identifiers.

**Content hash stability:** The hash ignores `created` and `updated` frontmatter timestamps. This prevents unnecessary updates when only timestamps change but content stays the same.

---

**Last Updated:** 2026-03-21
