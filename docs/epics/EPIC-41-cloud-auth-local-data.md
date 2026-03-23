# EPIC-41: Shared Cloud Authentication with Local Data

## Summary

Use the existing Agent Nexus Supabase Cloud project (`xysiyvrwvhngtwccouqy.supabase.co`) as a centralized Google OAuth provider for all 4 Symbio apps, while keeping all application data in the local Supabase instances. This solves the problem where Google OAuth does not work remotely (via Tailscale) because local Supabase GoTrue hardcodes `localhost` in callback URLs.

## Problem

- Local Supabase GoTrue uses `localhost:PORT/auth/v1/callback` as the OAuth callback URL
- When accessing apps remotely via Tailscale, Google redirects back to `localhost` which is unreachable on the remote device
- Each app currently has its own independent auth, requiring separate logins
- Email/password auth works remotely (no redirect), but Google OAuth does not

## Solution: Cloud Auth, Local Data (Option B)

Each app gets two Supabase clients:
1. **Cloud client** -- pointed at `xysiyvrwvhngtwccouqy.supabase.co` -- used ONLY for `signInWithOAuth()` / `signInWithIdToken()`
2. **Local client** -- pointed at `localhost:5434x` -- used for ALL data operations (queries, inserts, RLS, storage)

After cloud auth succeeds, a server-side mapping function creates/finds the corresponding user in the local Supabase using the service role key, then establishes a local session.

## Architecture Diagram

```
User clicks "Sign in with Google"
         |
         v
  Cloud Supabase (xysiyvrwvhngtwccouqy.supabase.co)
  - Google OAuth redirect flow
  - Public URL, works from anywhere
  - Returns cloud JWT with user identity
         |
         v
  App callback route receives cloud auth code
  - Exchanges code for cloud session
  - Extracts user email/identity
         |
         v
  mapCloudUserToLocal()
  - Looks up user in LOCAL Supabase by email
  - If not found: creates via auth.admin.createUser()
  - Returns local user + establishes local session
         |
         v
  All data operations use LOCAL Supabase
  - Experiments, videos, knowledge pages, etc.
  - RLS policies enforced with local user UUID
  - No cloud dependency for data
```

## Apps Affected

| App | Codebase | Port | Local Supabase | Tech Stack |
|-----|----------|------|----------------|------------|
| SymbioKnowledgeBase | `windsurf_repos/SymbioKnowledgeBase` | 3000 | 54351 | Next.js + Prisma |
| ChemELN | `windsurf_repos/ET_ELN` | 3001 | 54331 | Vanilla JS + serve.js |
| ExpTube | `windsurf_repos/ExpTube` | 3002 | 54341 | Next.js |
| SciSymbioLens | `windsurf_repos/SciSymbioLens` | 8000 | 54321 | iOS (Swift) + FastAPI |

## Stories

| Story | Title | Type | Codebase |
|-------|-------|------|----------|
| S41-01 | Configure Cloud Supabase for Google OAuth | Manual/Config | Supabase Dashboard |
| S41-02 | Update Google Cloud Console Redirect URIs | Manual/Config | Google Cloud Console |
| S41-03 | Shared Cloud-to-Local User Mapping | Code | Cross-project utility |
| S41-04 | SymbioKnowledgeBase Dual Auth | Code | SymbioKnowledgeBase |
| S41-05 | ChemELN Dual Auth | Code | ET_ELN |
| S41-06 | ExpTube Dual Auth | Code | ExpTube |
| S41-07 | SciSymbioLens Dual Auth (iOS + Backend) | Code | SciSymbioLens |
| S41-08 | Configure Redirect URLs and End-to-End Testing | Config/QA | All |

## Execution Order

```
S41-01  S41-02       (manual, prerequisite -- can be done in parallel)
   \      /
    v    v
    S41-03            (shared utility, used by all apps)
   /  |  |  \
  v   v  v   v
S41-04 S41-05 S41-06 S41-07   (per-app, can be done in parallel)
   \    |    |    /
    v   v   v   v
      S41-08              (integration testing)
```

## Key Decisions

- **Cloud Supabase project**: `xysiyvrwvhngtwccouqy.supabase.co` (existing Agent Nexus, free tier)
- **User matching strategy**: By email address (handles re-auth, provider changes)
- **Existing users preserved**: Local users (e.g., `bcacfccf-9792-440c-8895-8e6e4418f91c`) are matched by email, not recreated
- **Email/password auth**: Remains on local Supabase (no redirect needed, works everywhere)
- **Backward compatibility**: Local-only auth continues to work; cloud auth is additive
- **No data migration**: All data stays in local Supabase, zero cloud data dependency

## Risks

1. **Free tier limits**: Agent Nexus is on Supabase free tier (50k MAU, should be fine for dev)
2. **Cloud availability**: If cloud Supabase is down, Google OAuth fails (email/password still works)
3. **JWT secret mismatch**: Cloud and local Supabase have different JWT secrets -- apps must use the correct client for each operation
4. **Cookie conflicts**: Two Supabase sessions (cloud + local) stored in cookies -- must use distinct cookie names/prefixes
