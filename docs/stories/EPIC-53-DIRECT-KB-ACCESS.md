# Epic 53: Direct Knowledge Base Access for SciSymbioLens

## Motivation

Currently, SciSymbioLens accesses the SymbioKnowledgeBase (SKB) through the Clawdbot Gateway,
which adds an unnecessary hop, latency, and a dependency on a service whose primary purpose
is personal assistant functionality (Notion, Claude, calendar, email).

This epic removes the gateway as middleman for KB operations, establishing a direct
iOS → SKB connection. The gateway retains its role for Clawdbot/Symbio interactions
(`ask_clawdbot` tool) but is no longer involved in chemistry knowledge retrieval.

## Architecture Change

### Before (current)
```
SciSymbioLens (iOS)
  → Clawdbot Gateway (port 18799) /kb/experiment-context
    → SKB (port 3000) /api/agent/pages/experiment-context
  → Clawdbot Gateway (port 18799) /kb/query
    → SKB (port 3000) /api/agent/kb-query
  → Clawdbot Gateway (port 18799) /kb/session-context/{id}
    → (in-memory session store on gateway)
```

### After (this epic)
```
SciSymbioLens (iOS)
  → SKB (port 3000) /api/agent/pages/experiment-context     (direct)
  → SKB (port 3000) /api/agent/kb-query                     (direct)
  → SKB (port 3000) /api/agent/sessions/{id}/context         (NEW — server-side accumulation)
  OR
  → Local iOS accumulator (client-side accumulation)          (alternative)
```

## Key Decisions

1. **Session context accumulation**: The gateway currently accumulates KB context blocks
   across multiple queries within a voice session (max 20 blocks, deduped, sorted by relevance).
   This is needed because Gemini Live sessions are stateless — each WebSocket reconnection
   requires re-injecting all context. Two options:
   - **Option A (server-side)**: Add session-context endpoints to SKB itself
   - **Option B (client-side)**: Accumulate in the iOS app's memory (simpler, no server state)
   - **Recommendation**: Option B (client-side). The iOS process outlives individual WebSocket
     sessions, and the logic is ~50 lines. No need for server-side session state.

2. **Context size limit**: Currently capped at 4000 chars in `buildMergedContext()`.
   Gemini 2.5 Flash supports 1M tokens (~4M chars). Raising to 12,000–15,000 chars
   allows richer KB context while staying well under limits (~3-4K tokens).

3. **Gateway KB endpoints**: Deprecated but not removed immediately. Can be removed
   once SciSymbioLens is fully migrated and tested.

## Stories

| Story | Title | Owner | Points | Depends On |
|-------|-------|-------|--------|------------|
| SKB-53.1 | Verify & document SKB agent API contract for direct access | SKB | 1 | — |
| SKB-53.2 | Add CORS / network access support for direct iOS connections | SKB | 2 | SKB-53.1 |
| SKB-53.3 | Enhance kb-query response with richer context for direct consumers | SKB | 2 | SKB-53.1 |
| SSL-37.1 | Create SKBClient.swift — direct SKB HTTP client | SciSymbioLens | 3 | SKB-53.1 |
| SSL-37.2 | Create SKBKeyManager for secure credential storage | SciSymbioLens | 2 | — |
| SSL-37.3 | Add SKB connection settings UI | SciSymbioLens | 2 | SSL-37.2 |
| SSL-37.4 | Create local KBContextAccumulator | SciSymbioLens | 2 | — |
| SSL-37.5 | Rewire KBContextService for direct SKB pre-fetch | SciSymbioLens | 3 | SSL-37.1, SSL-37.2 |
| SSL-37.6 | Rewire VoiceAgentToolRouter for direct KB queries | SciSymbioLens | 3 | SSL-37.1, SSL-37.4 |
| SSL-37.7 | Raise context size limit and integrate accumulator into reconnection | SciSymbioLens | 2 | SSL-37.4, SSL-37.6 |
| SSL-37.8 | End-to-end verification: direct KB access in voice session | SciSymbioLens | 2 | All above |

## Out of Scope

- Removing gateway `/kb/*` endpoints (future cleanup)
- Changing `ask_clawdbot` routing (stays via gateway)
- SKB authentication changes (existing `skb_live_*` keys work as-is)
