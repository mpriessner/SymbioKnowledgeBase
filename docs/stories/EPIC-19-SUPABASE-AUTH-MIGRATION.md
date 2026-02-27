# Epic 19: Supabase Auth Migration

**Epic ID:** EPIC-19
**Created:** 2026-02-22
**Total Story Points:** 29
**Priority:** Critical
**Status:** Planned
**Dependencies:** Blocks EPIC-15 (Symbio ecosystem integration requires unified auth)

---

## Epic Overview

Epic 19 migrates SymbioKnowledgeBase authentication from NextAuth.js (credentials provider with JWT sessions) to Supabase Auth. This aligns SymbioKnowledgeBase with the rest of the Symbio ecosystem: ExpTube, CAM ELN, and SciSymbioLens all use Supabase Auth for single sign-on (SSO).

Currently, SymbioKnowledgeBase uses:
- NextAuth.js v4 with CredentialsProvider (email/password)
- JWT sessions stored in cookies
- Prisma User model with bcrypt password hashing
- `useSession()` from `next-auth/react`
- `signOut()` from `next-auth/react`

After migration:
- Supabase Auth with email/password and OAuth providers
- Supabase session cookies via `@supabase/ssr`
- Supabase `auth.users` table (managed by Supabase)
- `useUser()` / `useSession()` from Supabase client
- `supabase.auth.signOut()`
- **Same credentials work across all Symbio apps** (SSO)

This epic covers Supabase client setup, auth flow migration, database migration strategies, and cross-app SSO verification.

---

## Business Value

- **Unified authentication:** Users log in once, access all Symbio apps (ExpTube, CAM ELN, SymbioKnowledgeBase, SciSymbioLens)
- **Reduced maintenance:** Supabase handles auth complexity (session management, password reset, OAuth)
- **Security improvements:** Supabase Auth is battle-tested, supports MFA, and handles edge cases
- **Unlocks integrations:** Sharing data between Symbio apps requires shared auth layer
- **Future-proof:** OAuth providers (Google, GitHub) can be added with minimal code

---

## Architecture Summary

```
Current State (NextAuth.js)
───────────────────────────

  Browser
    │
    ├─ POST /api/auth/signin (NextAuth)
    ├─ useSession() → JWT from cookie
    └─ signOut() → clear cookie

  Database (PostgreSQL)
    │
    └─ users table (email, passwordHash, tenantId)

Target State (Supabase Auth)
────────────────────────────

  Browser
    │
    ├─ supabase.auth.signInWithPassword()
    ├─ useUser() → Supabase session
    └─ supabase.auth.signOut()

  Supabase Auth (auth.users)
    │
    ├─ Manages user credentials
    ├─ Issues JWT (stored in cookie via @supabase/ssr)
    └─ Provides OAuth integrations

  Database (PostgreSQL)
    │
    ├─ users table → references auth.users.id
    └─ OR migrate to Supabase Postgres (unified DB)

Migration Strategies
────────────────────

  Option A: Separate PostgreSQL + Supabase Auth only
    - Keep existing PostgreSQL database
    - Add Supabase Auth for authentication only
    - Map Supabase auth.users.id to existing User.id
    - Minimal disruption, easiest path

  Option B: Full migration to Supabase PostgreSQL
    - Migrate entire database to Supabase Postgres
    - Use Supabase Auth + Supabase Database
    - Single platform, simplified architecture
    - More effort, higher risk

  RECOMMENDED: Start with Option A (auth-only), migrate to Option B later if needed.

Cross-App SSO Flow
──────────────────

  User logs into ExpTube
    │
    ├─ Supabase Auth issues JWT
    ├─ JWT stored in cookie (domain: *.symbio.com)
    │
    ▼
  User navigates to SymbioKnowledgeBase
    │
    ├─ Supabase client reads JWT from cookie
    ├─ Validates session with Supabase Auth
    └─ User is already logged in (no re-auth)
```

---

## Stories Breakdown

### SKB-19.1: Supabase Client Setup — 3 points, Critical

**Delivers:** Install `@supabase/supabase-js` and `@supabase/ssr`. Create Supabase client utilities for server (SSR, API routes) and browser (client components). Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Decide: shared Supabase project with ExpTube OR separate project with linked auth. Document setup in README.

**Depends on:** None (foundation for entire migration)

---

### SKB-19.2: Auth Flow Migration — 8 points, Critical

**Delivers:** Replace NextAuth login/register pages with Supabase Auth. Replace `middleware.ts` auth check with Supabase session validation. Replace all `useSession()` calls with Supabase `useUser()`. Replace `SessionProvider` with `SupabaseProvider` in `QueryProvider.tsx`. Migrate existing users from Prisma User table to Supabase `auth.users` (data migration script). Update all components: `SettingsModal`, `WorkspaceDropdown`, API routes using `getServerSession()`. Remove NextAuth.js dependencies.

**Depends on:** SKB-19.1 (Supabase client must be functional)

---

### SKB-19.3: Database Migration Strategy — 5 points, High

**Delivers:** Implement **Option A** (recommended): Keep existing PostgreSQL, add Supabase Auth only. Update Prisma schema: `User.id` now references Supabase `auth.users.id` (UUID string). Data migration script: create Supabase auth users for existing users (copy email, set temp password, send reset link). Update all foreign keys and queries to use Supabase user IDs. Document rollback plan if migration fails.

**Depends on:** SKB-19.2 (auth flow must be migrated first)

---

### SKB-19.4: Cross-App SSO Verification — 5 points, Medium

**Delivers:** Test SSO flow: log into ExpTube → navigate to SymbioKnowledgeBase → verify no re-login required. Test reverse: log into SymbioKnowledgeBase → navigate to ExpTube. Test token refresh (Supabase auto-refreshes expired tokens). Handle edge cases: expired tokens, different app permissions, user exists in one app but not another. Document SSO configuration (cookie domain, Supabase project linking). E2E tests covering cross-app navigation.

**Depends on:** SKB-19.3 (database migration must be complete)

---

### SKB-19.5: Add Google OAuth Sign-In — 5 points, High

**Delivers:** "Sign in with Google" and "Sign up with Google" buttons on login and registration pages. OAuth callback handler that auto-provisions Prisma User + Tenant for new Google users. Google OAuth enabled in Supabase configuration.

**Details:** See [SKB-19.5 story file](SKB-19.5-google-oauth-sign-in.md)

**Depends on:** SKB-19.1 (Supabase client must be functional). Can be done in parallel with SKB-19.2 if Supabase Auth is already working for email/password.

**Reference:** Follows the exact pattern from ExpTube's Google sign-in (`ExpTube/app/(auth)/login/page.tsx` lines 60-78, `ExpTube/app/auth/callback/route.ts`).

---

### SKB-19.6: Remove NextAuth.js Legacy Code — 3 points, Medium

**Delivers:** Clean removal of all NextAuth.js files, dependencies, and environment variables. The codebase uses only Supabase Auth with zero NextAuth remnants.

**Details:** See [SKB-19.6 story file](SKB-19.6-remove-nextauth-legacy-code.md)

**Depends on:** SKB-19.5 (Google OAuth must be working before removing fallback)

---

## Current Migration Status (Updated 2026-02-27)

**Investigation reveals the migration is partially complete:**

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase client setup (SKB-19.1) | **Done** | `client.ts`, `server.ts`, `middleware.ts` all functional |
| Login page | **Done** | Uses `supabase.auth.signInWithPassword()` |
| Register page | **Done** | Uses `supabase.auth.signUp()` + Prisma user creation |
| Middleware | **Done** | Uses Supabase session validation |
| SupabaseProvider | **Done** | Auth context with `useUser()`, `onAuthStateChange()`, 45-min token refresh |
| NextAuth removal (SKB-19.6) | **Not started** | `src/lib/auth.ts` and `[...nextauth]/route.ts` still exist as dead code |
| Google OAuth (SKB-19.5) | **Not started** | No OAuth button, no callback handler |
| Database migration (SKB-19.3) | **Partially done** | Prisma User has `supabaseUserId` field; register route links them |
| Cross-App SSO (SKB-19.4) | **Not started** | Requires shared Supabase project or SymbioCore |

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 19.1 | Supabase client initialization, env vars validated | Server client fetches session, browser client signs in | - |
| 19.2 | Login form submits to Supabase, useUser returns correct user | Sign in → session persisted, sign out → session cleared | Full login → navigate → logout flow |
| 19.3 | User ID mapping (Supabase UUID ↔ Prisma User), migration script idempotent | Migrated user can log in, tenant isolation preserved | - |
| 19.4 | Token expiry handled, refresh logic tested | - | Login to ExpTube → navigate to SKB → verify logged in |
| 19.5 | Google OAuth button rendered, `signInWithOAuth` called with correct params, `ensureUserExists` creates/skips Prisma User | OAuth callback exchanges code and sets session cookies, new Google user auto-provisioned | Click "Sign in with Google" → Google auth → redirected back → logged in |
| 19.6 | No imports of `next-auth` remain in codebase | Build succeeds without NextAuth dependencies | Login, registration, logout still work via Supabase Auth |

---

## Implementation Order

```
19.1 → 19.2 → 19.3 → 19.4 (sequential, each depends on previous)
19.5 can start after 19.1 (parallel with 19.2 if email/password auth works)
19.6 runs last (after 19.5, removes all NextAuth remnants)

19.1  Supabase Client Setup          ✅ DONE
  │
  ├──────────────────────┐
  ▼                      ▼
19.2  Auth Flow Migration    19.5  Google OAuth Sign-In
  │   ✅ DONE (mostly)
  ▼
19.3  Database Migration Strategy
  │   ⚡ PARTIALLY DONE
  ▼
19.4  Cross-App SSO Verification
  │
  ▼
19.6  Remove NextAuth Legacy Code
```

---

## Shared Constraints

- All Supabase operations use `@supabase/ssr` for server-side rendering compatibility
- JWT tokens stored in HTTP-only cookies (secure, no localStorage)
- Supabase project must be configured with correct redirect URLs for all Symbio apps
- User migration is one-way (no rollback to NextAuth once complete)
- TypeScript strict mode — no `any` types in auth code
- All API responses follow standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- Existing tenant isolation logic preserved (tenantId remains in Prisma User model)

---

## Files Created/Modified by This Epic

### New Files (SKB-19.1 through 19.4)
- `src/lib/supabase/client.ts` — Browser Supabase client ✅
- `src/lib/supabase/server.ts` — Server Supabase client (SSR, API routes) ✅
- `src/lib/supabase/middleware.ts` — Supabase auth middleware ✅
- `src/components/providers/SupabaseProvider.tsx` — Supabase context provider ✅
- `src/app/(auth)/supabase-login/page.tsx` — Supabase login page (replaces NextAuth login) ✅
- `src/app/(auth)/supabase-register/page.tsx` — Supabase registration page ✅
- `scripts/migrate-users-to-supabase.ts` — User migration script
- `src/__tests__/lib/supabase/client.test.ts`
- `src/__tests__/lib/supabase/server.test.ts`
- `tests/e2e/supabase-auth.spec.ts`
- `tests/e2e/cross-app-sso.spec.ts`

### New Files (SKB-19.5 — Google OAuth)
- `src/app/auth/callback/route.ts` — OAuth callback: exchange code for session, auto-provision Prisma User + Tenant
- `src/components/icons/GoogleLogo.tsx` — Google 4-color SVG logo component (optional, could inline SVG)

### Modified Files
- `src/components/providers/QueryProvider.tsx` — Replace SessionProvider with SupabaseProvider ✅
- `src/middleware.ts` — Replace NextAuth middleware with Supabase session check ✅
- `src/components/settings/SettingsModal.tsx` — Replace `useSession()` with `useUser()` ✅
- `src/components/workspace/WorkspaceDropdown.tsx` — Replace `signOut()` with `supabase.auth.signOut()` ✅
- `src/app/api/**/*.ts` — Replace `getServerSession()` with Supabase server client ✅
- `package.json` — Remove `next-auth`, add `@supabase/supabase-js`, `@supabase/ssr`
- `prisma/schema.prisma` — Update User.id to match Supabase UUID format (if needed)
- `.env.example` — Add Supabase env vars, remove NextAuth vars
- `README.md` — Update auth setup documentation
- `src/app/(auth)/login/page.tsx` — Add "Sign in with Google" button (SKB-19.5)
- `src/app/(auth)/register/page.tsx` — Add "Sign up with Google" button (SKB-19.5)
- `supabase/config.toml` — Enable `[auth.external.google]` (SKB-19.5)

### Deleted Files (SKB-19.6)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler (dead code)
- `src/lib/auth.ts` — NextAuth configuration (dead code)
- `next-auth` — Remove from `package.json` dependencies
- `@auth/prisma-adapter` — Remove from `package.json` if unused
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — Remove from `.env.example`

---

## Migration Risks & Mitigation

### Risk 1: User Data Loss
**Mitigation:** Test migration script on staging environment with production data snapshot. Verify all users migrated successfully before deploying to production.

### Risk 2: Session Invalidation
**Mitigation:** Plan migration during low-traffic window. Notify users of scheduled maintenance. Provide "re-login required" banner after migration.

### Risk 3: Tenant Isolation Broken
**Mitigation:** Comprehensive integration tests verifying tenant isolation after migration. No cross-tenant data leakage allowed.

### Risk 4: SSO Not Working
**Mitigation:** Test SSO between all Symbio apps before production release. Document exact Supabase configuration required.

---

## Rollback Plan

If migration fails catastrophically:
1. Revert code to pre-migration commit
2. Restore database from backup (before migration)
3. Re-enable NextAuth.js authentication
4. Users must re-login (sessions invalidated)
5. Investigate failure, fix issues, retry migration

**Point of No Return:** Once users are migrated to Supabase `auth.users`, rolling back requires recreating NextAuth user accounts (complex, avoid if possible).

---

**Last Updated:** 2026-02-27
