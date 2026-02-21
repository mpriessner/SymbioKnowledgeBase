# SymbioKnowledgeBase - Implementation Batches

**Total Stories:** 41 | **Total Story Points:** ~160
**Estimated Duration:** 6-8 Batches with parallel agent teams

---

## Batch 1: Foundation (MUST BE SEQUENTIAL)
**Stories:** 4 | **Points:** 18 | **Duration:** ~2-3 hours

These must run sequentially as each depends on the previous.

| Order | Story | Points | Agent |
|-------|-------|--------|-------|
| 1 | SKB-01.1 Project Initialization | 5 | Claude Code |
| 2 | SKB-01.2 Database Schema Prisma | 5 | Claude Code |
| 3 | SKB-01.3 Docker Compose Dev | 3 | Claude Code |
| 4 | SKB-01.4 Application Shell | 5 | Claude Code |

**Commit after Batch 1** ✓

---

## Batch 2: Auth & Pages Core (PARALLEL)
**Stories:** 6 | **Points:** 24 | **Duration:** ~2 hours

Can run 2 parallel streams after Batch 1.

### Stream A: Auth (Agent 1 - Claude Code)
| Story | Points |
|-------|--------|
| SKB-02.1 User Auth NextAuth | 5 |
| SKB-02.2 Tenant Isolation Middleware | 3 |
| SKB-02.3 API Key Auth | 5 |

### Stream B: Pages API (Agent 2 - Codex)
| Story | Points |
|-------|--------|
| SKB-03.1 Page CRUD API | 5 |
| SKB-03.2 Page Hierarchy | 3 |
| SKB-08.1 Database Schema CRUD API | 5 |

**Commit after Batch 2** ✓

---

## Batch 3: Editor Core (PARALLEL)
**Stories:** 6 | **Points:** 25 | **Duration:** ~2-3 hours

### Stream A: TipTap Editor (Agent 1 - Claude Code)
| Story | Points |
|-------|--------|
| SKB-04.1 TipTap Editor Basic Blocks | 8 |
| SKB-04.2 Slash Command Menu | 3 |
| SKB-04.3 Rich Text Formatting | 3 |

### Stream B: Page UI (Agent 2 - Codex)
| Story | Points |
|-------|--------|
| SKB-03.3 Sidebar Page Tree | 5 |
| SKB-03.4 Breadcrumb Navigation | 2 |
| SKB-03.5 Page Icons Covers | 3 |

**Commit after Batch 3** ✓

---

## Batch 4: Editor Advanced + Wikilinks (PARALLEL)
**Stories:** 7 | **Points:** 26 | **Duration:** ~2-3 hours

### Stream A: Editor Advanced (Agent 1)
| Story | Points |
|-------|--------|
| SKB-04.4 Block Drag Drop | 3 |
| SKB-04.5 Advanced Block Types | 5 |
| SKB-04.6 Block Conversion Undo Redo | 4 |

### Stream B: Wikilinks (Agent 2)
| Story | Points |
|-------|--------|
| SKB-05.1 Wikilink Parser Index | 5 |
| SKB-05.2 Wikilink TipTap Extension | 5 |
| SKB-05.3 Backlinks Panel | 5 |

**Commit after Batch 4** ✓

---

## Batch 5: Search & Graph (PARALLEL)
**Stories:** 8 | **Points:** 29 | **Duration:** ~2-3 hours

### Stream A: Search (Agent 1)
| Story | Points |
|-------|--------|
| SKB-06.1 Postgres FTS Setup | 3 |
| SKB-06.2 Search API | 3 |
| SKB-06.3 Search UI | 4 |
| SKB-06.4 Quick Switcher | 3 |

### Stream B: Knowledge Graph (Agent 2)
| Story | Points |
|-------|--------|
| SKB-07.1 Graph Data API | 3 |
| SKB-07.2 Global Knowledge Graph | 5 |
| SKB-07.3 Local Page Graph | 5 |
| SKB-07.4 Graph Filtering | 3 |

**Commit after Batch 5** ✓

---

## Batch 6: Database Views & Polish (PARALLEL)
**Stories:** 7 | **Points:** 26 | **Duration:** ~2-3 hours

### Stream A: Database Table View (Agent 1)
| Story | Points |
|-------|--------|
| SKB-08.2 Table View Component | 5 |
| SKB-08.3 Inline Property Editing | 5 |
| SKB-08.4 Filtering Sorting | 3 |

### Stream B: UI Polish + Misc (Agent 2)
| Story | Points |
|-------|--------|
| SKB-03.6 Page Drag Drop Reorder | 3 |
| SKB-05.4 Link Auto Update Rename | 3 |
| SKB-02.4 Admin User Management | 3 |
| SKB-09.2 UI Design System | 3 |

**Commit after Batch 6** ✓

---

## Batch 7: Theming & Deployment (PARALLEL)
**Stories:** 4 | **Points:** 15 | **Duration:** ~1-2 hours

### Stream A: Theming (Agent 1)
| Story | Points |
|-------|--------|
| SKB-09.1 Light Dark Mode | 5 |

### Stream B: Deployment (Agent 2)
| Story | Points |
|-------|--------|
| SKB-10.1 OpenAPI Swagger | 3 |
| SKB-10.2 Docker Production Build | 4 |
| SKB-10.3 Production Environment | 3 |

**Final Commit** ✓

---

## Summary

| Batch | Stories | Points | Parallel Streams | Estimated Time |
|-------|---------|--------|------------------|----------------|
| 1 | 4 | 18 | 1 (sequential) | 2-3h |
| 2 | 6 | 24 | 2 | 2h |
| 3 | 6 | 25 | 2 | 2-3h |
| 4 | 7 | 26 | 2 | 2-3h |
| 5 | 8 | 29 | 2 | 2-3h |
| 6 | 7 | 26 | 2 | 2-3h |
| 7 | 4 | 15 | 2 | 1-2h |
| **Total** | **41** | **~160** | - | **~15-20h** |

---

## Agent Team Spawn Command

```bash
# For each batch with parallel streams:
bash /home/martin/clawd/skills/dev-orchestra/scripts/spawn.sh

# Then assign:
# - Claude Code (Pane 0): Stream A stories
# - Codex (Pane 2): Stream B stories
# - Gemini (Pane 1): Code review between streams
```

---

## Quick Start: Batch 1

```bash
cd ~/coding_projects/SymbioKnowledgeBase

# Start Claude Code
claude --dangerously-skip-permissions

# Then paste:
Implement Batch 1 sequentially:
1. SKB-01.1 - Read docs/stories/SKB-01.1-project-initialization.md and implement
2. SKB-01.2 - Read docs/stories/SKB-01.2-database-schema-prisma.md and implement
3. SKB-01.3 - Read docs/stories/SKB-01.3-docker-compose-dev.md and implement
4. SKB-01.4 - Read docs/stories/SKB-01.4-application-shell.md and implement

Commit after each story. Push after all 4 are done.
```

---

*Generated: 2026-02-21*
