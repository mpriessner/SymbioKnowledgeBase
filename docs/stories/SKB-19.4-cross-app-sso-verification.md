# Story SKB-19.4: Cross-App SSO Verification

**Epic:** Epic 19 - Supabase Auth Migration
**Story ID:** SKB-19.4
**Story Points:** 5 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-19.3 (database migration must be complete)

---

## User Story

As a user, I want to log in once and access all Symbio apps (ExpTube, CAM ELN, SymbioKnowledgeBase, SciSymbioLens), So that I have a seamless experience across the ecosystem.

---

## Acceptance Criteria

1. **SSO Test: ExpTube → SymbioKnowledgeBase**
   - [ ] Log into ExpTube with Supabase Auth
   - [ ] Navigate to SymbioKnowledgeBase
   - [ ] Verify user is already logged in (no login prompt)
   - [ ] Verify correct user data displayed

2. **SSO Test: SymbioKnowledgeBase → ExpTube**
   - [ ] Log into SymbioKnowledgeBase
   - [ ] Navigate to ExpTube
   - [ ] Verify user is already logged in

3. **Token Refresh**
   - [ ] Supabase tokens expire after 1 hour
   - [ ] Verify auto-refresh works (no re-login required)
   - [ ] Test with session older than 1 hour

4. **Edge Cases**
   - [ ] **Expired token:** User logs out after prolonged inactivity
   - [ ] **User exists in one app but not another:** Create user record on first access
   - [ ] **Different app permissions:** User is admin in ExpTube but regular user in SymbioKnowledgeBase

5. **Cookie Configuration**
   - [ ] Cookie domain: `.symbio.com` (accessible across subdomains)
   - [ ] Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`
   - [ ] Supabase session cookie name: consistent across apps

6. **Documentation**
   - [ ] Document SSO setup in README
   - [ ] Environment variables required for SSO
   - [ ] Supabase project configuration (redirect URLs, JWT settings)

---

## Technical Implementation

### Cookie Domain Configuration

**Supabase Auth Config (Supabase Dashboard)**

- **Redirect URLs:**
  - `https://exptube.symbio.com/auth/callback`
  - `https://knowledge.symbio.com/auth/callback`
  - `https://eln.symbio.com/auth/callback`
  - `https://scisymbio.symbio.com/auth/callback`

- **JWT Settings:**
  - Issuer: `https://xxxxx.supabase.co/auth/v1`
  - Audience: `authenticated`
  - Expiration: 3600 seconds (1 hour)

- **Cookie Domain:** `.symbio.com` (set in Supabase client config)

---

### Supabase Client with Cookie Domain

**File: `src/lib/supabase/client.ts` (updated)**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        domain: '.symbio.com', // Enable cross-subdomain access
      },
    }
  );
}
```

---

### Token Refresh Logic

**File: `src/hooks/useAuthRefresh.ts`**

```typescript
import { useEffect } from 'react';
import { useSupabaseClient } from '@/components/providers/SupabaseProvider';

export function useAuthRefresh() {
  const supabase = useSupabaseClient();

  useEffect(() => {
    // Refresh token every 45 minutes (before 1-hour expiration)
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }, [supabase]);
}

// Use in root layout:
// useAuthRefresh();
```

---

### Cross-App User Creation

**File: `src/lib/auth/ensureUserExists.ts`**

```typescript
import { prisma } from '@/lib/db';

export async function ensureUserExists(supabaseUser: any) {
  // Check if user exists in our database
  let user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
  });

  if (!user) {
    // User logged in via another Symbio app — create record in this app
    const tenantId = supabaseUser.user_metadata?.tenantId || await createDefaultTenant();

    user = await prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        tenantId,
        name: supabaseUser.user_metadata?.name,
      },
    });

    console.log(`Created user ${user.email} from cross-app SSO`);
  }

  return user;
}
```

---

## Test Scenarios

### E2E Cross-App Tests

**File: `tests/e2e/cross-app-sso.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cross-App SSO', () => {
  test('should login in ExpTube and access SymbioKnowledgeBase', async ({ page, context }) => {
    // Login to ExpTube
    await page.goto('https://exptube.symbio.local/login');
    await page.fill('input[type="email"]', 'test@symbio.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('https://exptube.symbio.local/');

    // Navigate to SymbioKnowledgeBase (same context = same cookies)
    await page.goto('https://knowledge.symbio.local/');

    // Should be logged in already (no login page)
    await expect(page).toHaveURL('https://knowledge.symbio.local/');
    await expect(page.locator('text=Log In')).not.toBeVisible();

    // Verify user name displayed
    await expect(page.locator('[aria-label="User menu"]')).toHaveText('test@symbio.com');
  });

  test('should handle token refresh across apps', async ({ page }) => {
    // Login
    await page.goto('https://knowledge.symbio.local/login');
    await page.fill('input[type="email"]', 'test@symbio.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait 1 hour (simulate token expiration)
    await page.waitForTimeout(3600 * 1000); // Not practical — mock time instead

    // Refresh page (should auto-refresh token)
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL('https://knowledge.symbio.local/');
  });
});
```

---

## Dependencies

- **SKB-19.3:** Database migration complete, user IDs aligned
- **ExpTube, CAM ELN, SciSymbioLens:** Must all use same Supabase project

---

## Dev Notes

### Cookie Domain Caveats

- **Local development:** Cannot test cross-subdomain cookies on `localhost` — use `.local` domain or `.test` with `/etc/hosts` entries
- **Production:** Ensure all apps use `https://` (cookies won't work with mixed http/https)

### User Data Sync

- **Tenant mapping:** If user exists in ExpTube but not SymbioKnowledgeBase, create user record with default tenant
- **Role differences:** User can be admin in one app but regular user in another (app-specific roles)

### Token Expiration

- **Default:** 1 hour
- **Refresh:** Supabase auto-refreshes if `autoRefreshToken: true` (default)
- **Manual refresh:** Use `supabase.auth.refreshSession()` if needed

---

**Last Updated:** 2026-02-22
