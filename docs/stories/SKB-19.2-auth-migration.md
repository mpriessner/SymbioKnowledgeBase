# Story SKB-19.2: Auth Flow Migration

**Epic:** Epic 19 - Supabase Auth Migration
**Story ID:** SKB-19.2
**Story Points:** 8 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-19.1 (Supabase client must be functional)

---

## User Story

As a user, I want to log in using Supabase Auth instead of NextAuth, So that I can access all Symbio apps with a single account.

---

## Acceptance Criteria

1. **Replace Login/Register Pages**
   - [ ] New login page: `src/app/(auth)/login/page.tsx` using `supabase.auth.signInWithPassword()`
   - [ ] New register page: `src/app/(auth)/register/page.tsx` using `supabase.auth.signUp()`
   - [ ] Delete old NextAuth pages

2. **Replace SessionProvider**
   - [ ] Remove `SessionProvider` from `QueryProvider.tsx`
   - [ ] Add `SupabaseProvider` (context provider exposing Supabase client)
   - [ ] All components use `useSupabaseClient()` and `useUser()`

3. **Replace useSession() Calls**
   - [ ] Find all `useSession()` from `next-auth/react`
   - [ ] Replace with Supabase `useUser()` from `@supabase/auth-helpers-react` or custom hook
   - [ ] Update session data structure (NextAuth → Supabase format)

4. **Replace Middleware**
   - [ ] `src/middleware.ts`: remove `getToken()` from NextAuth
   - [ ] Add Supabase session validation: `supabase.auth.getUser()`
   - [ ] Redirect to `/login` if no session

5. **Migrate Existing Users**
   - [ ] Data migration script: `scripts/migrate-users-to-supabase.ts`
   - [ ] For each user in Prisma `users` table:
     - Create Supabase auth user: `supabase.auth.admin.createUser({ email, password: tempPassword })`
     - Send password reset email
     - Map Supabase `auth.users.id` to Prisma `User.id`

6. **Update All Components**
   - [ ] `SettingsModal`: replace `session.user` with Supabase `user`
   - [ ] `WorkspaceDropdown`: replace `signOut()` with `supabase.auth.signOut()`
   - [ ] All API routes: replace `getServerSession()` with Supabase server client

7. **Remove NextAuth Dependencies**
   - [ ] Uninstall `next-auth`
   - [ ] Delete `src/app/api/auth/[...nextauth]/route.ts`
   - [ ] Delete `src/lib/auth.ts`

---

## Technical Implementation

### SupabaseProvider

**File: `src/components/providers/SupabaseProvider.tsx`**

```typescript
'use client';

import { createContext, useContext, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

const SupabaseContext = createContext<SupabaseClient | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseClient() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabaseClient must be used within SupabaseProvider');
  }
  return context;
}

export function useUser() {
  const supabase = useSupabaseClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  return user;
}
```

---

### Login Page

**File: `src/app/(auth)/login/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@/components/providers/SupabaseProvider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Log In</h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Logging in...' : 'Log In'}
        </Button>
      </form>
    </div>
  );
}
```

---

### Middleware

**File: `src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register).*)'],
};
```

---

### User Migration Script

**File: `scripts/migrate-users-to-supabase.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin key
);

async function migrateUsers() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Create Supabase auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: crypto.randomBytes(32).toString('hex'), // Temp password
      email_confirm: true,
    });

    if (error) {
      console.error(`Failed to migrate ${user.email}:`, error);
      continue;
    }

    // Update Prisma User.id to match Supabase auth.users.id
    await prisma.user.update({
      where: { id: user.id },
      data: { id: data.user.id }, // Supabase UUID
    });

    // Send password reset email
    await supabase.auth.resetPasswordForEmail(user.email);

    console.log(`Migrated ${user.email} → ${data.user.id}`);
  }

  console.log('Migration complete!');
}

migrateUsers().catch(console.error);
```

---

## Test Scenarios

### E2E Tests

```typescript
test('login with Supabase', async ({ page }) => {
  await page.goto('/login');

  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/');
});

test('logout with Supabase', async ({ page }) => {
  await page.goto('/');
  await page.click('[aria-label="User menu"]');
  await page.click('text=Log Out');

  await expect(page).toHaveURL('/login');
});
```

---

## Dependencies

- **SKB-19.1:** Supabase client setup

---

## Dev Notes

- **User ID migration:** Supabase uses UUIDs. If current User.id is not UUID, migration script must update all foreign keys.
- **Password reset:** All migrated users receive password reset email (cannot migrate bcrypt hashes).
- **Session invalidation:** All existing NextAuth sessions will be invalid after migration.

---

**Last Updated:** 2026-02-22
