# SKB-19.6: Remove NextAuth.js Legacy Code

**Story ID:** SKB-19.6
**Epic:** [EPIC-19 — Supabase Auth Migration](EPIC-19-SUPABASE-AUTH-MIGRATION.md)
**Points:** 3
**Priority:** Medium
**Status:** Draft

---

## Summary

SymbioKnowledgeBase still contains NextAuth.js configuration files and dependencies even though the UI has already migrated to Supabase Auth. This legacy code should be removed to reduce confusion, eliminate dead code, and prevent accidental use of the old auth system.

---

## Current State

The following NextAuth files/dependencies still exist but are **not used by the UI**:

| File | Status | Purpose |
|------|--------|---------|
| `src/lib/auth.ts` | Dead code | NextAuth config with CredentialsProvider, JWT callbacks |
| `src/app/api/auth/[...nextauth]/route.ts` | Dead code | NextAuth API route handler |
| `next-auth` in `package.json` | Unused dependency | NextAuth.js package |
| `@auth/prisma-adapter` in `package.json` | Possibly unused | Prisma adapter for NextAuth |
| `NEXTAUTH_SECRET` in `.env` | Unused env var | NextAuth JWT secret |
| `NEXTAUTH_URL` in `.env` | Unused env var | NextAuth base URL |

**What IS being used (keep these):**
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server Supabase client
- `src/lib/supabase/middleware.ts` — Session refresh
- `src/components/providers/SupabaseProvider.tsx` — Auth context
- `src/middleware.ts` — Supabase session check
- `@supabase/supabase-js` and `@supabase/ssr` in `package.json`

---

## Acceptance Criteria

- `src/lib/auth.ts` deleted
- `src/app/api/auth/[...nextauth]/route.ts` deleted
- `next-auth` removed from `package.json` dependencies
- `@auth/prisma-adapter` removed if not used elsewhere
- `NEXTAUTH_SECRET` and `NEXTAUTH_URL` removed from `.env.example`
- All imports of `next-auth` or `next-auth/react` are removed from codebase
- No remaining references to `getServerSession`, `useSession`, `SessionProvider` from NextAuth
- Application builds without errors
- Login, registration, and logout still work via Supabase Auth

---

## Implementation Approach

1. **Search for all NextAuth imports:**
   ```bash
   grep -r "next-auth" src/ --include="*.ts" --include="*.tsx"
   grep -r "getServerSession" src/ --include="*.ts" --include="*.tsx"
   grep -r "useSession" src/ --include="*.ts" --include="*.tsx"
   ```

2. **Remove or replace any remaining references**
   - If any component still imports `useSession`, replace with `useUser()` from SupabaseProvider
   - If any API route uses `getServerSession`, replace with Supabase server client

3. **Delete files:**
   - `src/lib/auth.ts`
   - `src/app/api/auth/[...nextauth]/route.ts`

4. **Remove packages:**
   ```bash
   npm uninstall next-auth @auth/prisma-adapter
   ```

5. **Clean up environment:**
   - Remove `NEXTAUTH_SECRET` and `NEXTAUTH_URL` from `.env.example`

6. **Build and test:**
   ```bash
   npm run build
   npm run test
   ```

---

## Files to Modify/Delete

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Delete |
| `src/app/api/auth/[...nextauth]/route.ts` | Delete |
| `package.json` | Remove `next-auth`, `@auth/prisma-adapter` |
| `.env.example` | Remove `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Any file with `next-auth` imports | Replace with Supabase equivalents |

---

## Do NOT Break

- Supabase Auth login/registration
- Supabase session management
- Middleware protected routes
- API routes that use Supabase server client
- Build process
- Existing user sessions

---

## Test Coverage

**Unit Tests:**
- No imports of `next-auth` remain in codebase
- Build succeeds without NextAuth dependencies

**E2E Tests:**
1. Login with email/password — works
2. Login with Google OAuth — works (if SKB-19.5 is done)
3. Protected routes redirect to login when not authenticated
4. Logout clears session

---

## Verification Steps

1. Run `grep -r "next-auth" src/` — zero results
2. `npm run build` — succeeds without errors
3. Login with email/password — works
4. Navigate protected routes — works
5. Logout — works

---

**Last Updated:** 2026-02-27
