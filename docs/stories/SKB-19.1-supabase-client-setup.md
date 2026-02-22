# Story SKB-19.1: Supabase Client Setup

**Epic:** Epic 19 - Supabase Auth Migration
**Story ID:** SKB-19.1
**Story Points:** 3 | **Priority:** Critical | **Status:** Planned
**Depends On:** None (foundation for entire migration)

---

## User Story

As a developer, I want to configure Supabase clients for browser and server contexts, So that the application can authenticate users via Supabase Auth.

---

## Acceptance Criteria

1. **Package Installation**
   - [ ] `npm install @supabase/supabase-js @supabase/ssr`
   - [ ] Remove `next-auth` from package.json (after migration complete)

2. **Environment Variables**
   - [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
   - [ ] Document in `.env.example`

3. **Browser Client**
   - [ ] `src/lib/supabase/client.ts` — createClient for client components
   - [ ] Automatically manages session in cookies
   - [ ] Used in React components with `useUser()`, `useSession()`

4. **Server Client**
   - [ ] `src/lib/supabase/server.ts` — createServerClient for API routes, SSR
   - [ ] Reads session from cookies via `@supabase/ssr`
   - [ ] Used in API routes and Server Components

5. **Supabase Project Decision**
   - [ ] **Option A:** Shared project with ExpTube (unified user base)
   - [ ] **Option B:** Separate project with linked auth (isolated user base)
   - [ ] Document decision and configuration

---

## Technical Implementation

### Browser Client

**File: `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

### Server Client

**File: `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

---

### Environment Variables

**File: `.env.example`**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Remove after migration:
# NEXTAUTH_SECRET=...
# NEXTAUTH_URL=...
```

---

## Test Scenarios

### Unit Tests

```typescript
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';

describe('Supabase Client', () => {
  it('should create browser client', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('should create server client with cookies', () => {
    const client = createServerClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
```

---

## Dependencies

None (this is the foundation)

---

## Dev Notes

- **Shared vs. Separate Project:** Shared project enables true SSO (single user account across all apps). Separate project requires user invitation/linking between apps.
- **Cookie Domain:** Set cookie domain to `.symbio.com` for cross-app SSO
- **Service Role Key:** Never expose to client — only use in API routes for admin operations

---

**Last Updated:** 2026-02-22
