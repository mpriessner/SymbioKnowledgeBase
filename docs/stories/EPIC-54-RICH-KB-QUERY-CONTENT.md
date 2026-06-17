# Epic 54: Rich Content Retrieval for KB Queries

## Motivation

The kb-query endpoint currently truncates context block content to ~300 characters per block,
returning only brief summaries or one-liners. This means the voice agent can't answer detailed
follow-up questions about procedures, safety protocols, or experimental conditions — it falls
back to generic training data instead of the lab's actual documented knowledge.

For demo purposes and real-world utility, when a user asks for detailed information about
a specific entity (chemical, experiment, reaction type), they should get the **full page
content** from the knowledge base, not just a summary.

## Design

### Two content modes

| Mode | When | Content per block | Use case |
|------|------|-------------------|----------|
| **Smart** (default) | `depth: "default"` or `"medium"` | Intent-focused sections, ~300 chars | General questions, token-efficient |
| **Deep** | `depth: "deep"` | Full page markdown, up to `max_block_chars` | Specific entity requests, demos, detailed follow-ups |

### How "deep" mode works

1. **Primary entity block**: Full markdown content of the matched page (not just one section)
2. **Linked entity blocks**: Full oneLiner + key sections (not just oneLiner)
3. **Answer synthesis**: Respects `max_answer_length` parameter (currently buggy, capped at ~600)
4. **Per-block cap**: `max_block_chars` parameter (default 2000, max 5000) prevents runaway blocks

### Page content sizes (from actual data)

| Page type | Typical size | Example |
|-----------|-------------|---------|
| Chemical | 500–1500 chars | MTT: 1015 chars |
| Experiment | 1500–3000 chars | EXP-2025-0015: 2578 chars |
| Researcher | 500–1000 chars | Dr. Sarah Kim: ~800 chars |
| Reaction type | 800–2000 chars | Diazotization: ~1500 chars |

These are well within the 12K context budget on the iOS side.

## Stories

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| SKB-54.1 | Deep content extraction for primary entity blocks | 3 | Draft |
| SKB-54.2 | Rich linked/backlink blocks with key sections | 2 | Draft |
| SKB-54.3 | Fix answer synthesis to respect max_answer_length | 1 | Draft |
| SKB-54.4 | Add max_block_chars parameter (default 2000, max 5000) | 1 | Draft |
| SKB-54.5 | Verification — deep queries return full content (8 scenarios) | 1 | Draft |

## Out of Scope

- iOS-side changes (the app already passes through whatever SKB returns)
- Token cost optimization (future — for now, prioritize quality)
- LLM-based summarization of content (future enhancement)
