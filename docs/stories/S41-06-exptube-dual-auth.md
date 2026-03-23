# S41-06: ExpTube -- Dual Supabase Auth

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Code
**Priority**: P1
**Depends on**: S41-01, S41-02, S41-03
**Codebase**: `/Users/mpriessner/windsurf_repos/ExpTube`
**Tech stack**: Next.js 14, @supabase/ssr, @supabase/supabase-js

## Objective

Modify ExpTube to use cloud Supabase for Google OAuth while keeping all data operations (videos, experiments, channels, playlists, analysis) on the local Supabase instance.

## Current Auth Architecture

| File | Role |
|------|------|
| `lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient`) |
| `lib/supabase/server.ts` | Server Supabase client (cookie-based) |
| `lib/supabase/admin.ts` | Admin client (`SUPABASE_SERVICE_ROLE_KEY`) |
| `lib/supabase/middleware.ts` | `updateSession()` helper |
| `middleware.ts` | Route protection, session refresh |
| `app/(auth)/login/page.tsx` | Login page: email/password + Google OAuth |
| `app/(auth)/signup/page.tsx` | Signup page: email/password + Google OAuth |
| `app/auth/callback/route.ts` | OAuth callback: exchanges code, sets cookies |
| `components/providers/auth-provider.tsx` | React context: `useAuth()` hook |
| `lib/actions/auth.ts` | Server action: `signOut()` |

## Changes Required

### 1. Add Environment Variables

Add to `.env.local`:
```env
# Cloud Supabase (auth only) -- from S41-01
NEXT_PUBLIC_SUPABASE_CLOUD_URL=https://xysiyvrwvhngtwccouqy.supabase.co
NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY=<cloud anon key>

# Local Supabase (data) -- already exists
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:54341
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing>
# SUPABASE_SERVICE_ROLE_KEY=<existing>
```

### 2. Create Cloud Supabase Client

**New file**: `lib/supabase/cloud-client.ts`

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
    return null; // Fall back to local auth
  }

  return createBrowserClient(url, key);
}
```

### 3. Modify Login Page

**File**: `app/(auth)/login/page.tsx`

Change `handleGoogleLogin` (~line 60-78):

```typescript
import { createCloudClient } from "@/lib/supabase/cloud-client";

// In handleGoogleLogin:
const handleGoogleLogin = async () => {
  setError("");
  setIsLoading(true);

  // Use cloud client for Google OAuth, fall back to local
  const cloudClient = createCloudClient();
  const supabase = cloudClient || createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    setError(error.message);
    setIsLoading(false);
  }
};
```

### 4. Modify Signup Page

**File**: `app/(auth)/signup/page.tsx`

Same change for `handleGoogleSignup` (~line 76-94):

```typescript
import { createCloudClient } from "@/lib/supabase/cloud-client";

// In handleGoogleSignup:
const handleGoogleSignup = async () => {
  const cloudClient = createCloudClient();
  const supabase = cloudClient || createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    setError(error.message);
  }
};
```

### 5. Modify Auth Callback Route

**File**: `app/auth/callback/route.ts`

This is the critical change. Currently exchanges code with local Supabase. Must now detect cloud vs local flow.

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = "/";

  console.log("[Callback] Starting - code:", code ? "present" : "missing");

  if (code) {
    const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

    const cloudUrl = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
    const cloudKey = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;
    const isCloudAuth = !!(cloudUrl && cloudKey);

    if (isCloudAuth) {
      // === CLOUD AUTH FLOW ===
      console.log("[Callback] Using cloud auth flow");

      // Step 1: Exchange code with CLOUD Supabase
      const cloudSupabase = createServerClient(cloudUrl!, cloudKey!, {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            // Collect cloud cookies but we won't persist them all
            cookiesToSet.push({ name, value, options });
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: "", options });
          },
        },
      });

      const { data: cloudData, error: cloudError } =
        await cloudSupabase.auth.exchangeCodeForSession(code);

      if (cloudError || !cloudData?.user) {
        console.log("[Callback] Cloud exchange failed:", cloudError?.message);
        return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
      }

      const cloudUser = cloudData.user;
      console.log("[Callback] Cloud user:", cloudUser.email);

      // Step 2: Map cloud user to local user
      const localAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const email = cloudUser.email!;
      const { data: userList } = await localAdmin.auth.admin.listUsers();
      const existing = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      let localUser;
      if (existing) {
        localUser = existing;
        console.log("[Callback] Found existing local user");
      } else {
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
          console.error("[Callback] Create local user failed:", createErr.message);
          return NextResponse.redirect(`${origin}/login?error=user_creation_failed`);
        }
        localUser = created.user;
        console.log("[Callback] Created new local user");
      }

      // Step 3: Create local session via magic link
      const { data: linkData, error: linkError } =
        await localAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

      if (linkError || !linkData) {
        console.error("[Callback] Generate link failed:", linkError?.message);
        return NextResponse.redirect(`${origin}/login?error=session_failed`);
      }

      // Step 4: Exchange magic link token for local session
      const localCookies: typeof cookiesToSet = [];
      const localSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) { return request.cookies.get(name)?.value; },
            set(name: string, value: string, options: CookieOptions) {
              localCookies.push({ name, value, options });
            },
            remove(name: string, options: CookieOptions) {
              localCookies.push({ name, value: "", options });
            },
          },
        }
      );

      const tokenHash = linkData.properties?.hashed_token;
      if (tokenHash) {
        const { error: verifyErr } = await localSupabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: tokenHash,
        });
        if (verifyErr) {
          console.error("[Callback] Local OTP verify failed:", verifyErr.message);
          return NextResponse.redirect(`${origin}/login?error=session_failed`);
        }
      }

      // Step 5: Redirect with LOCAL session cookies
      const redirectUrl = `${origin}${next}`;
      console.log("[Callback] SUCCESS (cloud) - redirecting to:", redirectUrl);
      const response = NextResponse.redirect(redirectUrl);

      // Set only LOCAL cookies (not cloud cookies)
      for (const { name, value, options } of localCookies) {
        response.cookies.set(name, value, options);
      }

      return response;
    }

    // === LOCAL AUTH FLOW (fallback) ===
    console.log("[Callback] Using local auth flow");
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            cookiesToSet.push({ name, value, options });
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: "", options });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectUrl = `${origin}${next}`;
      const response = NextResponse.redirect(redirectUrl);
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      return response;
    }

    console.log("[Callback] FAILED - error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
```

### 6. No Changes Required to These Files

| File | Why unchanged |
|------|--------------|
| `lib/supabase/client.ts` | Local browser client for data + email/password auth |
| `lib/supabase/server.ts` | Local server client for data queries |
| `lib/supabase/admin.ts` | Local admin client for privileged ops |
| `lib/supabase/middleware.ts` | Session refresh uses local Supabase |
| `middleware.ts` | Route protection checks local session |
| `components/providers/auth-provider.tsx` | Uses local client for user state |
| `lib/actions/auth.ts` | `signOut()` uses local client |
| `app/(auth)/reset-password/page.tsx` | Email-only, no Google OAuth |
| `app/auth/update-password/page.tsx` | Password update, no Google OAuth |

## Files Modified

| File | Change |
|------|--------|
| `lib/supabase/cloud-client.ts` | **NEW** -- Cloud browser client |
| `app/(auth)/login/page.tsx` | Google login uses cloud client |
| `app/(auth)/signup/page.tsx` | Google signup uses cloud client |
| `app/auth/callback/route.ts` | Dual flow: cloud exchange + local mapping |
| `.env.local` | Add cloud URL and keys |

## Testing

### Local
1. Start ExpTube: `npm run dev -- --port 3002`
2. Google sign-in: should redirect via cloud Supabase
3. After sign-in: verify user can see videos, create experiments
4. Email/password: still works with local Supabase
5. Check: `auth-provider.tsx` picks up local session correctly

### Remote (Tailscale)
1. From remote device on Tailscale
2. Access `https://martins-macbook-pro.tail3a744f.ts.net:3002`
3. Google sign-in should work (cloud URL is public)

### Existing Tests
Run existing test suite to verify no regressions:
```bash
cd ExpTube
npm test
# Specifically:
npx vitest run app/auth/callback/__tests__/route.test.ts
npx vitest run app/api/__tests__/cross-app-auth.test.ts
```

## Rollback

Remove or empty `NEXT_PUBLIC_SUPABASE_CLOUD_URL` from `.env.local`. Callback route falls through to local auth flow. Login/signup pages fall back to local client.

## Acceptance Criteria

- [ ] Google OAuth uses cloud Supabase
- [ ] Email/password auth uses local Supabase (unchanged)
- [ ] Cloud user mapped to local user by email
- [ ] Existing local users reused
- [ ] Local session cookies set correctly
- [ ] Videos, experiments, channels still save to local Supabase
- [ ] AuthProvider (`useAuth`) works with local session
- [ ] Middleware route protection works with local session
- [ ] Works locally (localhost:3002)
- [ ] Works remotely (Tailscale)
- [ ] Existing tests pass
- [ ] Falls back to local auth when cloud not configured
