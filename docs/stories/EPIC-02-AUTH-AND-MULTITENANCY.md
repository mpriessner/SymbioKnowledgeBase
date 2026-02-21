# Epic 2: Authentication & Multi-Tenancy

**Epic ID:** EPIC-02
**Created:** 2026-02-21
**Total Story Points:** ~16
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 2 implements the dual authentication system (NextAuth.js for web UI + API key for AI agents) and the multi-tenant isolation layer. Every API endpoint and database query depends on this epic — it is the security boundary for the entire application. Without tenant isolation middleware, no subsequent feature can safely query the database; without authentication, no endpoint can be exposed.

This epic covers FR47-51 (User Management functional requirements) and NFR6-11 (security, multi-tenancy, and access control non-functional requirements). The design follows the architecture document's dual-auth pattern: NextAuth.js v4 JWT sessions for browser-based users, and hashed API keys (crypto.randomBytes(32)) for AI agent access.

---

## Business Value

- Enables secure multi-tenant operation — tenants can never see each other's data
- Unlocks AI-agent-first design by providing API key authentication alongside traditional sessions
- Blocks all subsequent epics from shipping without this security layer in place
- Admin user management allows workspace owners to control access

---

## Architecture Summary

```
Browser User                          AI Agent
    │                                     │
    │  POST /api/auth/signin              │  GET /api/pages
    │  (email + password)                 │  Authorization: Bearer sk_...
    ▼                                     ▼
┌──────────────┐                 ┌──────────────────┐
│  NextAuth.js │                 │  API Key Auth     │
│  v4          │                 │  Middleware        │
│              │                 │                    │
│  - JWT       │                 │  - Extract Bearer  │
│    session   │                 │  - SHA-256 hash    │
│  - Cookies   │                 │  - Lookup in       │
│              │                 │    api_keys table  │
└──────┬───────┘                 └────────┬───────────┘
       │                                  │
       │  session.user.tenantId           │  apiKey.tenant_id
       ▼                                  ▼
┌─────────────────────────────────────────────────┐
│  Tenant Isolation Middleware                     │
│                                                  │
│  - Extracts tenant_id from session OR API key   │
│  - Attaches to request context                  │
│  - ALL downstream queries include tenant_id     │
│    WHERE clause                                  │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL 18 — All queries scoped by tenant   │
│                                                  │
│  SELECT * FROM pages WHERE tenant_id = $1       │
│  INSERT INTO blocks (..., tenant_id) VALUES ... │
└─────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-02.1: User Registration and Login with NextAuth.js — 5 points, Critical

**Delivers:** Email/password registration endpoint (`POST /api/auth/register`) with bcryptjs password hashing, NextAuth.js v4 configuration with Credentials provider, JWT session strategy storing `userId` and `tenantId` in the token, login page (`/login`) and registration page (`/register`) with form validation, protected route middleware that redirects unauthenticated users to `/login`.

**Depends on:** SKB-01.2 (Prisma schema with `users` and `tenants` tables must exist)

---

### SKB-02.2: Tenant Isolation Middleware — 3 points, Critical

**Delivers:** `src/lib/auth/getTenantContext.ts` middleware function that extracts `tenant_id` from the authenticated session (NextAuth.js) or API key (Bearer token). Returns a `TenantContext` object (`{ tenantId, userId, role }`) that is passed to all data-access functions. A `withTenant()` wrapper for API route handlers that automatically injects tenant context. All subsequent API routes use this — no raw Prisma query should ever omit `tenant_id`.

**Depends on:** SKB-02.1 (NextAuth.js session must be functional)

---

### SKB-02.3: API Key Authentication System — 5 points, Critical

**Delivers:** API key generation using `crypto.randomBytes(32)` producing `sk_` prefixed keys. Keys are SHA-256 hashed before storage in the `api_keys` table (only the hash is persisted; the raw key is shown once at creation time). Bearer token authentication middleware that hashes the incoming token and looks it up in `api_keys`. API endpoints: `POST /api/keys` (generate), `GET /api/keys` (list, shows prefix only), `DELETE /api/keys/:id` (revoke). Settings page UI (`/settings`) with key management: generate new key (with copy-once modal), list active keys, and revoke button.

**Depends on:** SKB-02.1 (user must be authenticated to manage keys)

---

### SKB-02.4: Admin User Management — 3 points, High

**Delivers:** Admin-only API endpoints: `GET /api/admin/users` (list users in tenant), `POST /api/admin/users` (invite/create user), `PATCH /api/admin/users/:id` (update role, deactivate). `withAdmin()` middleware wrapper that checks `role === 'admin'` from tenant context before allowing access. Admin section in settings page showing user list with role badges and deactivate toggles.

**Depends on:** SKB-02.2 (tenant isolation middleware must be in place for admin endpoints)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 02.1 | Password hashing round-trip, JWT token payload structure, Zod validation for registration input | Registration creates user in DB, login returns valid JWT, duplicate email rejected with 409 | Full registration → login → redirect to workspace flow |
| 02.2 | `getTenantContext()` extracts correct tenant_id from mock session, rejects missing auth with 401 | API route with `withTenant()` returns 401 without auth, 200 with valid session | - |
| 02.3 | Key generation produces correct prefix and length, SHA-256 hashing is deterministic | Create key → authenticate with it → access protected endpoint, revoked key returns 401 | Generate key in UI → copy → use in API call → revoke → verify 401 |
| 02.4 | `withAdmin()` rejects non-admin role, allows admin role | Admin can list users, non-admin gets 403, deactivated user cannot log in | Admin creates user → user logs in → admin deactivates → user gets rejected |

---

## Implementation Order

```
02.1 → 02.2 → 02.3 → 02.4 (sequential, each depends on previous)

02.1  User Registration & Login (NextAuth.js)
  │
  ▼
02.2  Tenant Isolation Middleware
  │
  ├──▶ 02.3  API Key Authentication System
  │
  └──▶ 02.4  Admin User Management
```

---

## Shared Constraints

- All passwords hashed with bcryptjs (min 10 salt rounds)
- API keys use `crypto.randomBytes(32)` — never stored in plaintext, only SHA-256 hash persisted
- All API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- Every database query must include `tenant_id` — no exceptions
- TypeScript strict mode — no `any` types in auth code
- JWT tokens must include `userId`, `tenantId`, and `role` claims
- Rate limiting on auth endpoints: 10 attempts per minute per IP (to be enforced at middleware level)
- All auth-related environment variables documented in `.env.example`

---

## Files Created/Modified by This Epic

### New Files
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth.js configuration and route handler
- `src/app/api/auth/register/route.ts` — Registration endpoint
- `src/app/(auth)/login/page.tsx` — Login page (replaces placeholder from Epic 1)
- `src/app/(auth)/register/page.tsx` — Registration page (replaces placeholder from Epic 1)
- `src/lib/auth/getTenantContext.ts` — Tenant context extraction
- `src/lib/auth/withTenant.ts` — Tenant isolation wrapper for API routes
- `src/lib/auth/withAdmin.ts` — Admin role check wrapper
- `src/lib/auth/apiKeyAuth.ts` — API key authentication logic
- `src/app/api/keys/route.ts` — API key generation and listing
- `src/app/api/keys/[id]/route.ts` — API key revocation
- `src/app/api/admin/users/route.ts` — Admin user listing and creation
- `src/app/api/admin/users/[id]/route.ts` — Admin user update/deactivation
- `src/components/auth/LoginForm.tsx` — Login form component
- `src/components/auth/RegisterForm.tsx` — Registration form component
- `src/components/settings/ApiKeyManager.tsx` — API key management UI
- `src/components/settings/UserManagement.tsx` — Admin user management UI
- `src/types/auth.ts` — Auth-related TypeScript types (TenantContext, etc.)

### Modified Files
- `src/app/(workspace)/settings/page.tsx` — Add API key and user management sections
- `prisma/schema.prisma` — No changes (tables already defined in Epic 1)
- `src/middleware.ts` — Add NextAuth.js protected route logic
- `.env.example` — Add NEXTAUTH_SECRET, NEXTAUTH_URL variables

---

**Last Updated:** 2026-02-21
