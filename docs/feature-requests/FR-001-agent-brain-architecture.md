# FR-001: Agent Brain Architecture

**Status:** Proposed  
**Priority:** High  
**Created:** 2026-02-21  
**Author:** Martin Priessner

---

## Summary

Transform SymbioKnowledgeBase from a "Knowledge Base" to a true "Agent Brain" - a self-organizing, low-latency cognitive architecture that agents can navigate, maintain, and evolve autonomously.

---

## Core Concepts

### 1. Soul/Personality File Integration

The Brain should contain or reference the agent's core identity files:
- **SOUL.md** - Who the agent is
- **IDENTITY.md** - Creature type, vibe, emoji
- **USER.md** - About the human
- **MEMORY.md** - Long-term curated memories

These files should be **first-class pages** in the Brain with special status.

### 2. Section-Level Knowledge Graph

**Current State:** Pages link to other pages (like wiki)

**Proposed Enhancement:** 
- Links can reference **specific sections** within pages
- Each link carries **semantic hints** about what information awaits
- Example: `[[SOUL.md#core-truths|Agent's fundamental values]]`

**Benefits:**
- Agent knows exactly WHERE to look within a document
- Graph edges carry meaning, not just connectivity
- Faster navigation to relevant information

### 3. Agent-Optimized Page Structure

Every page should have consistent structure for agent parsing:

```markdown
# Page Title

## TL;DR (Agent Summary)
<!-- 2-3 sentences max, machine-readable -->

## Metadata
- Created: YYYY-MM-DD
- Last Updated: YYYY-MM-DD  
- Related: [[Page1]], [[Page2]]
- Tags: #tag1 #tag2

## Content
<!-- Main content -->

## Links Out
<!-- What this page references -->

## Links In  
<!-- Auto-generated: what references this page -->
```

### 4. Autonomous Brain Maintenance

An agent should periodically:
- **Explore** the graph, discovering new paths
- **Validate** links (fix broken references)
- **Consolidate** redundant information
- **Suggest** new connections between related content
- **Archive** stale information
- **Surface** important but forgotten knowledge

This could run as a **cron job** (e.g., daily "brain maintenance").

### 5. Low-Latency Access

**Critical Requirement:** Agent-to-Brain communication must be FAST.

**Options to explore:**
1. **Local SQLite mirror** - Sync brain to local file for instant access
2. **In-memory cache** - Keep hot pages in memory
3. **GraphQL subscriptions** - Push updates instead of polling
4. **Markdown export** - Periodically export to local `.md` files
5. **Embedded DB** - Use SQLite/DuckDB directly instead of PostgreSQL

**Target latency:** <50ms for page retrieval

---

## Naming

**Rebrand:** "SymbioKnowledgeBase" → "SymbioBrain" or just "Brain"

The product IS the agent's brain, not just a knowledge store.

---

## Implementation Considerations

### Phase 1: Structure
- Add TL;DR and metadata sections to page schema
- Implement section-level anchors and links
- Create "Links In" auto-generation

### Phase 2: Agent Navigation
- Build graph traversal API optimized for agents
- Add semantic hints to link schema
- Create "exploration" endpoints

### Phase 3: Maintenance Agent
- Implement cron job for brain maintenance
- Build validation and consolidation logic
- Add suggestion engine for new links

### Phase 4: Performance
- Benchmark current latency
- Implement chosen caching strategy
- Optimize for <50ms retrieval

---

## Related

- FR-002: Notion Migration Tool
- Architecture Decision: Agent-First Design

---

*This feature request captures Martin's vision for an AI-native knowledge system that grows and maintains itself.*
