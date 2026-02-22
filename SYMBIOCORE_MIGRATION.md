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

## Current State

SymbioKnowledgeBase currently uses **NextAuth.js** with Prisma/PostgreSQL.
This is a different auth system from the rest of the Symbio ecosystem
(which uses Supabase).

## What Needs to Change (Eventually)

### Phase A: Add SymbioCore as Knowledge Source for Agent
- Expose API endpoints that SymbioAgentMac can query (search notes, retrieve knowledge)
- Agent authenticates via SymbioCore JWT → SymbioKnowledgeBase validates it
- SymbioKnowledgeBase's own auth (NextAuth) continues to work for direct web access
- **Zero breaking changes to existing app**

### Phase B: Migrate Auth from NextAuth to SymbioCore (Later)
- Replace NextAuth.js with Supabase Auth (SymbioCore)
- Keep Prisma/PostgreSQL for note data (just change the auth layer)
- Users log in once via SymbioCore, access both KnowledgeBase and agent seamlessly

### What NOT to Change
- Note storage, knowledge graph, TipTap editor — all stay in SymbioKnowledgeBase's own DB
- Prisma schema for content remains unchanged
- Only the auth layer migrates

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
*Created by SymbioAgentMac BMAD planning. This is informational only — no code changes needed.*
