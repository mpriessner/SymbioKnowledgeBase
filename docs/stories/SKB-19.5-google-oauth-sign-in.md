# SKB-19.5: Add Google OAuth Sign-In

**Story ID:** SKB-19.5
**Epic:** [EPIC-19 — Supabase Auth Migration](EPIC-19-SUPABASE-AUTH-MIGRATION.md)
**Points:** 5
**Priority:** High
**Status:** Draft

---

## Summary

Add "Sign in with Google" to the SymbioKnowledgeBase login and registration pages, matching the pattern already used in ExpTube. Since SKB already uses Supabase Auth for email/password login, adding Google OAuth requires only the OAuth button, callback handler, and auto-provisioning of Prisma user records for OAuth users.

---

## Current State (Already Working)

SymbioKnowledgeBase is **already partially on Supabase Auth**:

- Login page uses `supabase.auth.signInWithPassword()` (not NextAuth)
- Registration uses `supabase.auth.signUp()` + POST to `/api/auth/register` for Prisma user creation
- Middleware uses Supabase session validation (`supabase.auth.getUser()`)
- `SupabaseProvider.tsx` manages auth state with `onAuthStateChange()` and 45-min token refresh
- Supabase client/server utilities are functional (`@supabase/ssr`)

**What's missing:**
- No Google OAuth button on login/register pages
- No `/auth/callback` route to handle OAuth redirect from Google
- No auto-provisioning of Prisma User + Tenant when a new Google user signs in
- Google OAuth not enabled in Supabase configuration (`supabase/config.toml`)

---

## Reference Implementation: ExpTube

ExpTube already has Google OAuth working. Key pattern:

**File:** `ExpTube/app/(auth)/login/page.tsx` (lines 60-78)
```typescript
const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
};
```

**File:** `ExpTube/app/auth/callback/route.ts`
- Receives OAuth `code` parameter from Google
- Calls `supabase.auth.exchangeCodeForSession(code)`
- Sets session cookies on redirect response
- Redirects to `/` (middleware sends to `/home`)

**File:** `ExpTube/supabase/config.toml` (lines 352-358)
```toml
[auth.external.google]
enabled = true
client_id = "588839890978-..."
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = true
```

---

## Acceptance Criteria

### Login Page
- "Sign in with Google" button visible below the email/password form
- Uses official Google logo (4-color SVG) with proper branding
- Clicking the button redirects to Google account selection
- After Google authorization, user returns to SKB and is logged in
- If the Google account is new (no existing Prisma user), a User + Tenant record is auto-created

### Registration Page
- "Sign up with Google" button visible below the registration form
- Same OAuth flow as login (Google creates the auth user, callback provisions the Prisma user)
- If user already exists, they're simply logged in (no duplicate)

### OAuth Callback
- `/auth/callback` route exchanges the OAuth code for a Supabase session
- If this is a new user (no Prisma User record for this Supabase ID), auto-create:
  - Prisma User with `supabaseUserId`, `email`, `name` from Google profile
  - Prisma Tenant (personal workspace) linked to the user
- Redirect to `/home` on success, `/login?error=oauth_failed` on failure

### Configuration
- Google OAuth enabled in Supabase (same Google Cloud project as ExpTube, OR separate — TBD)
- Environment variables documented in `.env.example`

---

## Implementation Approach

### 1. Enable Google OAuth in Supabase

**Option A (Recommended): Share ExpTube's Supabase project**
- Both apps use the same Supabase instance → same `auth.users` table
- Google OAuth is already configured in ExpTube's Supabase
- Just point SKB's `NEXT_PUBLIC_SUPABASE_URL` to the same project
- Users created via ExpTube are automatically available in SKB
- This is the unified auth approach

**Option B: Separate Supabase project**
- SKB has its own Supabase project
- Configure Google OAuth separately in SKB's Supabase dashboard
- Need a new Google OAuth client or add SKB's callback URL to the existing one
- Users are separate between apps (no SSO until SymbioCore migration)

### 2. Create OAuth callback route

**New file:** `src/app/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    // Exchange code for session (same pattern as ExpTube)
    const supabase = createServerClient(/* ... cookies setup ... */);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Auto-provision Prisma user if needed
      await ensureUserExists(data.user);
      return NextResponse.redirect(`${origin}/home`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}

async function ensureUserExists(supabaseUser: User) {
  // Check if Prisma User exists for this Supabase ID
  // If not, create User + Tenant (same as register route)
}
```

### 3. Add Google OAuth button to login page

In `src/app/(auth)/login/page.tsx`:

```tsx
const handleGoogleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
};

// In JSX:
<div className="flex items-center gap-2 my-4">
  <div className="flex-1 h-px bg-gray-200" />
  <span className="text-xs text-gray-400">or</span>
  <div className="flex-1 h-px bg-gray-200" />
</div>

<button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-2 ...">
  <GoogleLogo />
  Sign in with Google
</button>
```

### 4. Add Google OAuth button to register page

Same pattern as login, with "Sign up with Google" text.

### 5. Update .env.example

Add comments documenting Google OAuth setup requirements.

---

## Files to Modify/Create

| File | Action | Change |
|------|--------|--------|
| `src/app/(auth)/login/page.tsx` | Modify | Add "Sign in with Google" button with `signInWithOAuth` |
| `src/app/(auth)/register/page.tsx` | Modify | Add "Sign up with Google" button |
| `src/app/auth/callback/route.ts` | Create | OAuth callback: exchange code, auto-provision user, redirect |
| `supabase/config.toml` | Modify | Enable `[auth.external.google]` with client ID and secret |
| `.env.example` | Modify | Add `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` |

---

## Unified Auth Context

This story is part of the broader Symbio unified auth strategy:

```
Ecosystem Auth Architecture (Target State)
───────────────────────────────────────────

  Google OAuth → Supabase Auth (shared)
                      │
      ┌───────────────┼───────────────┐
      │               │               │
  ExpTube       SymbioKB          CAM ELN
  (working)     (this story)     (planned)
      │
  SciSymbioLens (Epic 24)

All apps share the same Supabase auth.users table.
Google sign-in in any app = account in all apps.
```

Related cross-platform stories:
- **ET_ELN STORY-05:** Unified Auth with JWT (planned)
- **SciSymbioLens Epic 24:** Auth State Management (planned)
- **SKB-19.4:** Cross-App SSO Verification (depends on this story)
- **SymbioCore Phase C:** Migrate all auth to SymbioCore (future)

---

## Do NOT Break

- Existing email/password login (must continue working)
- Registration with email/password (must continue working)
- Supabase session management (middleware, token refresh)
- Tenant isolation (each new OAuth user gets their own tenant)
- Protected routes and redirects
- Existing user sessions (adding OAuth doesn't invalidate passwords)

---

## Test Coverage

**Unit Tests:**
- Google OAuth button rendered on login page
- Google OAuth button rendered on register page
- `handleGoogleLogin` calls `supabase.auth.signInWithOAuth` with correct params
- `ensureUserExists` creates Prisma User + Tenant for new OAuth users
- `ensureUserExists` skips creation for existing users

**Integration Tests:**
- OAuth callback route exchanges code and sets session cookies
- New Google user auto-provisioned in Prisma database
- Existing Google user logs in without duplicate creation

**E2E Tests:**
1. Click "Sign in with Google" → redirected to Google
2. Authorize → redirected back to SKB → logged in
3. Navigate to workspace → user name shows Google profile name
4. Log out → log in again with Google → same user
5. New Google account → User + Tenant created automatically

---

## Verification Steps

1. Open the login page
2. Verify "Sign in with Google" button is visible below the email/password form
3. Click it → Google account selection screen appears
4. Select your Google account → redirected back to SKB
5. You're logged in and on the home page
6. Check the database: your Prisma User record exists with the correct email and supabaseUserId
7. Log out
8. Open the register page → "Sign up with Google" button visible
9. Click it → same flow, same result
10. Try with a brand new Google account → new User + Tenant created

---

**Last Updated:** 2026-02-27
