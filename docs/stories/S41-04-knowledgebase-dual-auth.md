# S41-04: SymbioKnowledgeBase -- Dual Supabase Auth

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Code
**Priority**: P1
**Depends on**: S41-01, S41-02, S41-03
**Codebase**: `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase`
**Tech stack**: Next.js 14+, @supabase/ssr, Prisma ORM

## Objective

Modify SymbioKnowledgeBase to use cloud Supabase for Google OAuth while keeping all data operations (pages, knowledge graphs, tenants) on the local Supabase instance.

## Current Auth Architecture

| File | Role |
|------|------|
| `src/lib/supabase/client.ts` | Browser Supabase client (uses `NEXT_PUBLIC_SUPABASE_URL`) |
| `src/lib/supabase/server.ts` | Server Supabase client (cookie-based, internal URL rewrite) |
| `src/lib/supabase/middleware.ts` | Session refresh in middleware (`updateSession`) |
| `src/middleware.ts` | Route protection, redirects unauthenticated to `/login` |
| `src/app/(auth)/login/page.tsx` | Login page with email/password + Google OAuth |
| `src/app/auth/callback/route.ts` | OAuth callback -- exchanges code, calls `ensureUserExists` |
| `src/lib/auth/ensureUserExists.ts` | Creates Prisma User + Tenant records for new auth users |

## Changes Required

### 1. Add Environment Variables

Add to `.env.local`:
```env
# Cloud Supabase (auth only) -- from S41-01
NEXT_PUBLIC_SUPABASE_CLOUD_URL=https://xysiyvrwvhngtwccouqy.supabase.co
NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY=<cloud anon key>
SUPABASE_CLOUD_SERVICE_ROLE_KEY=<cloud service role key>

# Local Supabase (data) -- already exists
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:54351
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing>
# SUPABASE_SERVICE_ROLE_KEY=<existing>  (rename from existing if needed)
```

### 2. Create Cloud Supabase Client

**New file**: `src/lib/supabase/cloud-client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

/**
 * Cloud Supabase client -- used ONLY for Google OAuth sign-in.
 * All data operations must use the local client from ./client.ts
 */
export function createCloudClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;

  if (!url || !key) {
    console.warn("Cloud Supabase not configured, falling back to local auth");
    return null;
  }

  return createBrowserClient(url, key);
}
```

### 3. Modify Login Page

**File**: `src/app/(auth)/login/page.tsx`

Change the `handleGoogleLogin` function (currently at line 69-87) to use the cloud client:

```typescript
// BEFORE (line 70):
const supabase = createClient();

// AFTER:
import { createCloudClient } from "@/lib/supabase/cloud-client";
// ...
const cloudClient = createCloudClient();
// Fall back to local client if cloud not configured
const supabase = cloudClient || createClient();
```

The `signInWithOAuth` call remains the same -- it redirects to Google via the cloud Supabase URL, and the `redirectTo` stays as `${location.origin}/auth/callback?next=...`.

**Email/password auth is unchanged** -- it continues to use the local client directly.

### 4. Modify Auth Callback Route

**File**: `src/app/auth/callback/route.ts`

This is the most critical change. The callback currently:
1. Exchanges auth code with local Supabase
2. Calls `ensureUserExists`
3. Redirects to `/home`

It needs to:
1. Exchange auth code with **cloud** Supabase (because the code came from cloud OAuth)
2. Extract the cloud user identity
3. Map the cloud user to a **local** user (create if needed)
4. Sign in as the local user (set local session cookies)
5. Call `ensureUserExists` (Prisma user/tenant creation)
6. Redirect to `/home`

**Updated implementation**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";

function getExternalOrigin(request: NextRequest): string {
  // ... existing implementation unchanged ...
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/home";
  const origin = getExternalOrigin(request);

  if (code) {
    const cookieStore = await cookies();
    const cloudUrl = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
    const cloudKey = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;

    // Determine if this is a cloud auth flow or local auth flow
    const isCloudAuth = cloudUrl && cloudKey;

    if (isCloudAuth) {
      // === CLOUD AUTH FLOW ===

      // Step 1: Exchange code with CLOUD Supabase
      const cloudSupabase = createServerClient(cloudUrl, cloudKey, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      });

      const { data: cloudData, error: cloudError } =
        await cloudSupabase.auth.exchangeCodeForSession(code);

      if (cloudError || !cloudData.user) {
        console.error("Cloud OAuth exchange failed:", cloudError?.message);
        return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
      }

      const cloudUser = cloudData.user;

      // Step 2: Map cloud user to local user
      const localAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      let localUser;
      const email = cloudUser.email!;

      // Find existing local user by email
      const { data: userList } = await localAdmin.auth.admin.listUsers();
      const existing = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existing) {
        localUser = existing;
      } else {
        // Create new local user
        const { data: created, error: createErr } =
          await localAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: cloudUser.user_metadata?.full_name
                || cloudUser.user_metadata?.name || null,
              avatar_url: cloudUser.user_metadata?.avatar_url || null,
              cloud_user_id: cloudUser.id,
              provider: "google",
            },
          });
        if (createErr) {
          console.error("Failed to create local user:", createErr.message);
          return NextResponse.redirect(`${origin}/login?error=user_creation_failed`);
        }
        localUser = created.user;
      }

      // Step 3: Create local session
      // Generate a magic link or use admin.generateLink to get a session
      const { data: linkData, error: linkError } =
        await localAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${origin}${next}` },
        });

      if (linkError || !linkData) {
        console.error("Failed to generate local session link:", linkError?.message);
        return NextResponse.redirect(`${origin}/login?error=session_failed`);
      }

      // Exchange the token_hash from the generated link for a local session
      const localPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const localAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const localSupabase = createServerClient(localPublicUrl, localAnonKey, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      });

      // Verify the OTP from the generated link to establish local session
      const tokenHash = linkData.properties?.hashed_token;
      if (tokenHash) {
        await localSupabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: tokenHash,
        });
      }

      // Step 4: Ensure Prisma records exist
      await ensureUserExists(localUser);

      return NextResponse.redirect(`${origin}${next}`);
    }

    // === LOCAL AUTH FLOW (fallback, unchanged) ===
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const internalUrl = process.env.SUPABASE_INTERNAL_URL;

    const supabase = createServerClient(
      publicUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
        ...(internalUrl && internalUrl !== publicUrl
          ? {
              global: {
                fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                  const url = input.toString().replace(publicUrl, internalUrl);
                  return fetch(url, init);
                },
              },
            }
          : {}),
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureUserExists(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
```

### 5. No Changes to These Files

The following files need NO modifications:

| File | Why unchanged |
|------|--------------|
| `src/lib/supabase/client.ts` | Still used for local data operations and email/password auth |
| `src/lib/supabase/server.ts` | Still used for server-side data queries |
| `src/lib/supabase/middleware.ts` | Session refresh uses local Supabase -- unchanged |
| `src/middleware.ts` | Route protection checks local session -- unchanged |
| `src/lib/auth/ensureUserExists.ts` | Already handles new users with Prisma -- unchanged |
| `src/lib/auth/withAdmin.ts` | Admin checks use local auth -- unchanged |
| `src/lib/auth/withTenant.ts` | Tenant resolution uses local auth -- unchanged |

### 6. Register Page (Optional)

**File**: `src/app/(auth)/register/page.tsx`

If this page also has a Google sign-up button, apply the same change as the login page (use cloud client for Google OAuth, keep local client for email/password).

## Files Modified

| File | Change |
|------|--------|
| `src/lib/supabase/cloud-client.ts` | **NEW** -- Cloud browser client |
| `src/app/(auth)/login/page.tsx` | Google login uses cloud client |
| `src/app/(auth)/register/page.tsx` | Google signup uses cloud client (if applicable) |
| `src/app/auth/callback/route.ts` | Dual flow: cloud exchange + local user mapping |
| `.env.local` | Add cloud URL and keys |

## Testing

### Local Testing
1. Start local Supabase: `cd SymbioKnowledgeBase && supabase start`
2. Start app: `npm run dev -- --port 3000`
3. Click "Sign in with Google" -- should redirect through cloud Supabase
4. After Google sign-in, should return to `/home` with a valid local session
5. Verify: create a new knowledge page -- should save to local Supabase
6. Verify: existing data (pages, tenants) is still accessible

### Remote Testing (via Tailscale)
1. From a remote device on the Tailscale network
2. Access `https://martins-macbook-pro.tail3a744f.ts.net`
3. Click "Sign in with Google" -- should work (cloud URL is publicly reachable)
4. After sign-in, should see the app with data from local Supabase

### Email/Password Testing
1. Sign in with email/password -- should still work exactly as before
2. No cloud Supabase involvement for email/password auth

## Rollback Plan

If cloud auth fails, set `NEXT_PUBLIC_SUPABASE_CLOUD_URL` to empty string. The callback route falls through to the local auth flow. The login page falls back to local client. Everything works as before.

## Acceptance Criteria

- [ ] Google OAuth uses cloud Supabase for authentication
- [ ] Email/password auth still uses local Supabase directly
- [ ] OAuth callback maps cloud user to local user by email
- [ ] Existing local users (matched by email) are reused, not duplicated
- [ ] New users get Prisma User + Tenant records via `ensureUserExists`
- [ ] Local session cookies are set after mapping (all data queries work)
- [ ] Works locally (localhost:3000)
- [ ] Works remotely (Tailscale hostname)
- [ ] Fallback to local auth when cloud env vars are absent
