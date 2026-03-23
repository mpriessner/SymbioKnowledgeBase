# S41-08: Configure Redirect URLs and End-to-End Testing

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Configuration + QA
**Priority**: P1
**Depends on**: S41-01 through S41-07 (all previous stories)
**Blocks**: Nothing (final story)

## Objective

Finalize all redirect URL configurations across Supabase Cloud, Google Cloud Console, and Tailscale Serve. Then perform end-to-end testing of Google OAuth across all 4 apps, both locally and remotely.

## Part 1: Redirect URL Audit

### Cloud Supabase Redirect URLs

In Supabase Dashboard > Authentication > URL Configuration, ensure ALL of these are listed:

```
# SymbioKnowledgeBase (port 3000)
http://localhost:3000/auth/callback
https://martins-macbook-pro.tail3a744f.ts.net/auth/callback

# ChemELN (port 3001) -- no explicit callback route, uses origin redirect
http://localhost:3001
https://martins-macbook-pro.tail3a744f.ts.net:3001

# ExpTube (port 3002)
http://localhost:3002/auth/callback
https://martins-macbook-pro.tail3a744f.ts.net:3002/auth/callback

# SciSymbioLens (iOS deep link)
com.scisymbiolens.app://auth-callback
```

### Google Cloud Console Redirect URIs

In Google Cloud Console > Credentials > OAuth 2.0 Client ID, ensure this URI is present:

```
https://xysiyvrwvhngtwccouqy.supabase.co/auth/v1/callback
```

This is the ONLY Google redirect URI needed for cloud auth. Google redirects to Supabase Cloud, then Supabase Cloud redirects to the app's callback URL (configured above).

### Tailscale Serve Configuration

Ensure Tailscale Serve is configured to proxy the relevant ports:

```bash
# Check current Tailscale Serve config
tailscale serve status

# If not configured, set up:
tailscale serve --bg https+insecure://localhost:3000   # KnowledgeBase (default port 443)
tailscale serve --bg --set-path /chemeln https+insecure://localhost:3001   # Optional
tailscale serve --bg 3002 https+insecure://localhost:3002   # ExpTube
```

Note: Tailscale Serve maps HTTPS on the Tailscale hostname to local HTTP ports.

## Part 2: End-to-End Test Plan

### Test Matrix

| Test | App | Auth Method | Access | Expected Result |
|------|-----|------------|--------|-----------------|
| T1 | KnowledgeBase | Google | Local | Sign in, see pages |
| T2 | KnowledgeBase | Google | Remote | Sign in via Tailscale |
| T3 | KnowledgeBase | Email/pw | Local | Sign in, see pages |
| T4 | KnowledgeBase | Email/pw | Remote | Sign in via Tailscale |
| T5 | ChemELN | Google | Local | Sign in, see experiments |
| T6 | ChemELN | Google | Remote | Sign in via Tailscale |
| T7 | ChemELN | Email/pw | Local | Sign in, see experiments |
| T8 | ChemELN | Email/pw | Remote | Sign in via Tailscale |
| T9 | ExpTube | Google | Local | Sign in, see videos |
| T10 | ExpTube | Google | Remote | Sign in via Tailscale |
| T11 | ExpTube | Email/pw | Local | Sign in, see videos |
| T12 | ExpTube | Email/pw | Remote | Sign in via Tailscale |
| T13 | SciSymbioLens | Google | Simulator | Sign in, record video |
| T14 | SciSymbioLens | Google | Device+Tailscale | Sign in, upload video |
| T15 | SciSymbioLens | Email/pw | Simulator | Sign in |
| T16 | SciSymbioLens | Email/pw | Device+Tailscale | Sign in |

### Cross-App Identity Tests

| Test | Scenario | Expected |
|------|----------|----------|
| T17 | Sign in to KnowledgeBase with Google, then sign in to ExpTube with same Google account | Same email, different local UUIDs (each app has its own local Supabase) |
| T18 | Sign in with Google on KnowledgeBase, create a page, sign out, sign back in | Page still visible (local user preserved) |
| T19 | User who previously signed in via local Google OAuth signs in via cloud OAuth | Same local user found by email, data preserved |

### Regression Tests

| Test | What to verify |
|------|---------------|
| R1 | KnowledgeBase: create/edit/delete pages, knowledge graph works |
| R2 | ChemELN: create experiment, add procedure steps, view projects |
| R3 | ExpTube: view videos, create experiment, manage playlists |
| R4 | SciSymbioLens: record video, upload to storage, view in app |
| R5 | ChemELN -> ExpTube user sync still works on email/password signup |
| R6 | SciSymbioLens -> ChemELN user sync still works on Google sign-in |

### Automated Tests

```bash
# ExpTube
cd /Users/mpriessner/windsurf_repos/ExpTube
npx vitest run

# KnowledgeBase
cd /Users/mpriessner/windsurf_repos/SymbioKnowledgeBase
npm test
```

## Part 3: Error Scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| Cloud Supabase is down | Google OAuth fails, email/password still works |
| Cloud env vars missing | Falls back to local auth for Google OAuth |
| Local Supabase is down | All auth fails (expected -- data is local) |
| Google Cloud Console changes not propagated | 500 error from Google, retry after 5-30 min |
| User email changed in Google account | New local user created (old data under old email) |
| Two users sign in simultaneously | Race condition handled by "already registered" catch |

## Part 4: Monitoring Checklist

After deployment, monitor for:
- [ ] Supabase Cloud dashboard: Auth > Users shows new sign-ins
- [ ] Local Supabase `auth.users` table: new users created via mapping
- [ ] No orphaned cloud users (every cloud user should have a local counterpart)
- [ ] No duplicate local users (same email appearing twice)

## Acceptance Criteria

- [ ] All redirect URLs configured in Supabase Cloud dashboard
- [ ] Google Cloud Console has cloud callback URI
- [ ] T1-T16 pass (all auth methods, all apps, local + remote)
- [ ] T17-T19 pass (cross-app identity)
- [ ] R1-R6 pass (regression)
- [ ] Automated test suites pass
- [ ] Error scenarios handled gracefully
- [ ] No existing functionality broken
