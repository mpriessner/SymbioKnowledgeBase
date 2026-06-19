# SymbioCore Migration Note — SymbioKnowledgeBase

## Status: NOT STARTED (Future Task)

This file documents a planned future migration. No action is needed now.
SymbioKnowledgeBase continues to work exactly as-is.

## What is SymbioCore?

SymbioCore is a new shared Supabase project being created as the central identity
and context layer for the Symbio ecosystem. It will handle:
- Unified auth (single login across all Symbio apps)
- Agent conversations and memory
- Cross-app shared context

## Current State (Updated 2026-02-27)

SymbioKnowledgeBase has **already migrated from NextAuth.js to Supabase Auth**.
The UI (login, register, middleware, session management) all use Supabase Auth.
NextAuth.js files still exist as dead code but are not used (see EPIC-19, SKB-19.6).

**What's working now:**
- Login page uses `supabase.auth.signInWithPassword()`
- Register page uses `supabase.auth.signUp()` + Prisma User creation
- Middleware uses Supabase session validation (`supabase.auth.getUser()`)
- `SupabaseProvider.tsx` manages auth state with `onAuthStateChange()` and 45-min token refresh
- Prisma User model has `supabaseUserId` field linking to `auth.users`

**What's pending:**
- Google OAuth sign-in (SKB-19.5 — not yet implemented)
- NextAuth legacy code removal (SKB-19.6 — `src/lib/auth.ts`, `[...nextauth]/route.ts` still exist)
- Cross-app SSO verification (SKB-19.4 — requires shared Supabase project or SymbioCore)

**Data storage:** Prisma/PostgreSQL for note content; Supabase Auth for user authentication.

## What Needs to Change (Eventually)

### Phase A: Add SymbioCore as Knowledge Source for Agent
- Expose API endpoints that SymbioAgentMac can query (search notes, retrieve knowledge)
- Agent authenticates via SymbioCore JWT → SymbioKnowledgeBase validates it
- SymbioKnowledgeBase already uses Supabase Auth — aligns with SymbioCore's auth
- **Zero breaking changes to existing app**

### Phase B: Unify with SymbioCore Supabase Project
- **Auth migration is mostly done** (SKB already uses Supabase Auth)
- Remaining: Point SKB at the shared SymbioCore Supabase project (same `auth.users`)
- Add Google OAuth (SKB-19.5) and remove NextAuth dead code (SKB-19.6)
- Verify cross-app SSO (SKB-19.4)
- Keep Prisma/PostgreSQL for note data (just unify the auth layer)
- Users log in once via SymbioCore, access both KnowledgeBase and agent seamlessly

### Phase C: Full SymbioCore Integration (Future)
- Migrate all identity management to SymbioCore
- Shared agent conversations and cross-app context
- See `docs/stories/EPIC-19-SUPABASE-AUTH-MIGRATION.md` for detailed implementation status

### What NOT to Change
- Note storage, knowledge graph, TipTap editor — all stay in SymbioKnowledgeBase's own DB
- Prisma schema for content remains unchanged
- Only the auth layer unifies with SymbioCore

## SymbioKnowledgeBase as the Agent's Knowledge Hub

In the SymbioAgentMac vision, SymbioKnowledgeBase serves as:
- The agent's long-term knowledge store (notes, research, references)
- The user's note-taking surface (agent can save notes here)
- A search target (agent queries KnowledgeBase to answer questions)

This integration is a "Should Have" feature, coming after the SymbioAgentMac MVP.

## Reference
- SymbioCore architecture: see `SymbioAgentMac/docs/bmad/product-brief.md`
- PRD: see `SymbioAgentMac/docs/bmad/prd.md`

---
*Created by SymbioAgentMac BMAD planning. Updated 2026-02-27 to reflect Supabase Auth migration progress.*
