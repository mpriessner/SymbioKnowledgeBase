# Story SKB-12.2: Session Provider Integration

**Epic:** Epic 12 - Settings & Account Management
**Story ID:** SKB-12.2
**Story Points:** 3 | **Priority:** Medium | **Status:** Done
**Depends On:** None

---

## User Story

As a developer, I want the NextAuth SessionProvider integrated into the application layout, So that all components can access user session data via the useSession hook.

---

## Acceptance Criteria

1. **SessionProvider Integration**
   - [ ] `SessionProvider` from `next-auth/react` imported in `QueryProvider.tsx`
   - [ ] `SessionProvider` wraps `QueryClientProvider` in the component tree
   - [ ] Enables `useSession()` hook in all child components
   - [ ] No separate `AuthProvider.tsx` file (merged into existing QueryProvider)

2. **Component Hierarchy**
   - [ ] `/app/(workspace)/layout.tsx` wraps children in `<QueryProvider>`
   - [ ] `QueryProvider` component structure:
     ```tsx
     <SessionProvider>
       <QueryClientProvider>
         {children}
       </QueryClientProvider>
     </SessionProvider>
     ```

3. **Session Data Access**
   - [ ] `useSession()` returns `{ data: session, status: "loading" | "authenticated" | "unauthenticated" }`
   - [ ] `session.user.name` — user's display name
   - [ ] `session.user.email` — user's email address
   - [ ] `session.user.image` — user's profile picture URL (optional)

4. **Usage in Components**
   - [ ] `SettingsModal` uses `useSession()` to display account info
   - [ ] `WorkspaceDropdown` has access to `useSession()` (for future avatar feature)
   - [ ] All components under `/app/(workspace)/` route have session access

5. **No Breaking Changes**
   - [ ] Existing QueryClient configuration unchanged
   - [ ] All React Query hooks continue working
   - [ ] No impact on non-authenticated routes (login page)

6. **TypeScript**
   - [ ] `SessionProvider` properly typed from `next-auth/react`
   - [ ] No `any` types

---

## Technical Implementation Notes

### File: `src/components/providers/QueryProvider.tsx` (modification)

**Before (React Query only):**
```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**After (React Query + NextAuth):**
```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
```

**Why Merge into QueryProvider?**

Originally attempted as a separate `AuthProvider.tsx` file:

```typescript
// AuthProvider.tsx (DOES NOT EXIST - caused issues)
"use client";
import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Problem:** Turbopack (Next.js 15's bundler) caches module resolution results. When `layout.tsx` tried to import `AuthProvider` before the file was created, Turbopack cached "module not found." Even after creating the file, Turbopack continued throwing the error due to stale cache.

**Solution:** Merge into the existing `QueryProvider.tsx` which Turbopack already tracked. Since `QueryProvider` was already imported by `layout.tsx`, adding `SessionProvider` inside it required no new imports and avoided the cache issue.

**Lessons learned:**
- Turbopack aggressively caches import resolution
- Creating new files during active development can hit cache issues
- Merging into existing tracked files avoids this
- Future: could extract to `AuthProvider.tsx` after stable, but current merged approach works fine

---

### File: `/app/(workspace)/layout.tsx` (no changes needed)

The workspace layout already wraps children in `QueryProvider`:

```typescript
import { QueryProvider } from "@/components/providers/QueryProvider";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <BreadcrumbsWrapper />
          {children}
        </main>
        <QuickSwitcher />
      </div>
    </QueryProvider>
  );
}
```

Since `QueryProvider` now includes `SessionProvider`, all children automatically have session access.

---

### Usage Example: `SettingsModal.tsx`

```typescript
"use client";

import { useSession } from "next-auth/react";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession();

  return (
    // ...
    {session?.user && (
      <div>
        <p>Name: {session.user.name || "Not set"}</p>
        <p>Email: {session.user.email || "Not set"}</p>
      </div>
    )}
    // ...
  );
}
```

**Key points:**
- `useSession()` is a client-side hook (requires `"use client"` directive)
- Returns `{ data: session | null, status: string }`
- `session.user` contains user info from NextAuth
- Optional chaining (`session?.user`) handles loading/unauthenticated states

---

### Session Data Structure

NextAuth session object (from `useSession().data`):

```typescript
{
  user: {
    name: string | null;      // User's display name
    email: string | null;     // User's email
    image: string | null;     // Profile picture URL (optional)
  };
  expires: string;            // ISO 8601 timestamp
}
```

Additional fields can be added via NextAuth callbacks:

```typescript
// In [...nextauth]/route.ts
callbacks: {
  session({ session, token }) {
    session.user.id = token.sub;  // Add user ID
    return session;
  },
}
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/providers/QueryProvider.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryProvider } from '@/components/providers/QueryProvider';

describe('QueryProvider', () => {
  it('should wrap children in SessionProvider and QueryClientProvider', () => {
    const TestChild = () => <div>Test Child</div>;

    render(
      <QueryProvider>
        <TestChild />
      </QueryProvider>
    );

    // Verify child renders (providers wrap successfully)
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should provide session context to children', () => {
    const TestComponent = () => {
      const { data: session } = useSession();
      return <div>{session ? 'Authenticated' : 'Not authenticated'}</div>;
    };

    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>
    );

    // useSession should not throw (context provided)
    expect(screen.getByText(/authenticated/i)).toBeInTheDocument();
  });
});
```

### Integration Tests

**Test: SettingsModal displays user info from session**
```typescript
it('should display user info from session in SettingsModal', async () => {
  // Mock session
  const mockSession = {
    user: { name: 'John Doe', email: 'john@example.com' },
  };

  // Wrap in providers and render
  render(
    <QueryProvider>
      <SettingsModal isOpen={true} onClose={() => {}} />
    </QueryProvider>
  );

  // Wait for session to load
  await waitFor(() => {
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/john@example.com/)).toBeInTheDocument();
  });
});
```

**Test: Multiple components access same session**
```typescript
it('should provide same session to all components', () => {
  const Component1 = () => {
    const { data } = useSession();
    return <div>User 1: {data?.user?.name}</div>;
  };

  const Component2 = () => {
    const { data } = useSession();
    return <div>User 2: {data?.user?.name}</div>;
  };

  render(
    <QueryProvider>
      <Component1 />
      <Component2 />
    </QueryProvider>
  );

  // Both components should show same user
  expect(screen.getAllByText(/User \d: Test User/)).toHaveLength(2);
});
```

### E2E Tests

**Test: User info persists across navigation**
```typescript
test('session persists across page navigation', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to settings
  await page.goto('/home');
  await page.click('text=Settings');

  // Verify user info displayed
  await expect(page.locator('text=test@example.com')).toBeVisible();

  // Navigate to different page
  await page.goto('/graph');

  // Navigate back to settings
  await page.goto('/home');
  await page.click('text=Settings');

  // Verify user info still displayed (session persisted)
  await expect(page.locator('text=test@example.com')).toBeVisible();
});
```

---

## Dependencies

**Libraries:**
- `next-auth/react` — NextAuth client-side hooks and providers
- `@tanstack/react-query` — React Query for data fetching
- React `useState` hook

**Configuration:**
- NextAuth API route: `/app/api/auth/[...nextauth]/route.ts`
- NextAuth configuration: database adapter, providers, callbacks

**Integration Points:**
- All components under `/app/(workspace)/` route group
- `SettingsModal` component (primary consumer)
- `WorkspaceDropdown` component (potential future consumer)

---

## Dev Notes

### Turbopack Caching Issue

**What happened:**
1. Implemented `AuthProvider.tsx` as a new file
2. Added `import { AuthProvider } from '@/components/providers/AuthProvider'` to `layout.tsx`
3. Got error: "Module not found: Can't resolve '@/components/providers/AuthProvider'"
4. Created the file, error persisted even after file existed
5. Tried: restarting dev server, clearing `.next` folder, restarting IDE — nothing worked

**Root cause:** Turbopack (Next.js 15's bundler) caches module resolution results. When it first tried to resolve `AuthProvider` (before file existed), it cached "not found." The cache persisted even after creating the file.

**Why QueryProvider worked:** `QueryProvider.tsx` already existed and was already imported by `layout.tsx`. Turbopack had a valid cache entry for it. Adding code inside an existing tracked file doesn't trigger cache invalidation issues.

**Fix:** Merged `SessionProvider` into `QueryProvider.tsx` instead of creating new file.

**Future considerations:**
- Could split into separate `AuthProvider.tsx` after project is stable
- Or leave merged — having both providers in one file is fine for simple cases
- If splitting in future, do it when dev server is not running to avoid cache issues

**Related Turbopack issues:**
- https://github.com/vercel/next.js/issues/48748 (module resolution caching)
- https://github.com/vercel/next.js/issues/54133 (cache invalidation)

### Provider Order Matters

`SessionProvider` must wrap `QueryClientProvider`:

```tsx
// Correct ✅
<SessionProvider>
  <QueryClientProvider>
    {children}
  </QueryClientProvider>
</SessionProvider>

// Incorrect ❌
<QueryClientProvider>
  <SessionProvider>
    {children}
  </SessionProvider>
</QueryClientProvider>
```

**Why:** React Query hooks (like `useSession` in query keys) need session context available. If `QueryClientProvider` is outer, queries might execute before session loads, causing issues.

In practice, either order works for basic usage, but `SessionProvider` outer is conventional and prevents edge cases.

### Session Loading States

`useSession()` returns three possible statuses:

```typescript
const { data: session, status } = useSession();

// status: "loading" — session still fetching
// status: "authenticated" — user logged in, session available
// status: "unauthenticated" — no active session
```

**Handling loading state:**

```tsx
if (status === "loading") {
  return <div>Loading...</div>;
}

if (!session) {
  return <div>Not logged in</div>;
}

// Render authenticated content
return <div>Welcome, {session.user.name}</div>;
```

**Or with optional chaining (simpler):**

```tsx
return <div>{session?.user?.name || "Guest"}</div>;
```

### Alternative: getServerSession

For server components, use `getServerSession()` instead of `useSession()`:

```typescript
// app/profile/page.tsx (Server Component)
import { getServerSession } from "next-auth/next";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session) {
    return <div>Not logged in</div>;
  }

  return <div>Welcome, {session.user.name}</div>;
}
```

**When to use each:**
- `useSession()` — Client Components that need reactive session updates
- `getServerSession()` — Server Components that need session at render time

---

**Last Updated:** 2026-02-22
