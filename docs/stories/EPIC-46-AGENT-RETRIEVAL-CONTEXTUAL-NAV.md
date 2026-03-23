# Epic 46: Agent Retrieval & Contextual Navigation

**Epic ID:** EPIC-46
**Created:** 2026-03-21
**Total Story Points:** 16
**Priority:** High
**Status:** Planned

---

## Epic Overview

Epic 46 optimizes the Chemistry Knowledge Base for agent queries, ensuring contextually relevant results. The KB's value is only realized if agents can efficiently navigate it and find the RIGHT experiments — not just any experiments of the same reaction type, but those matching the user's specific context (substrate class, scale, functional group challenges, etc.).

This epic defines agent workflows (documented traversal patterns), contextual search tags, and end-to-end test scenarios that validate the entire system. Without these structured navigation patterns, agents would struggle to extract actionable insights from the Chemistry KB, making the system feel like a search engine rather than a true knowledge assistant.

The deliverables include: a root Chemistry KB Index page (entry point for all chemistry queries), structured contextual tags on experiment pages (substrate class, scale, challenge, functional groups), two primary agent workflows ("Find Similar Experiments" and "Who Has Experience"), and comprehensive test scenarios that validate the full agent navigation experience.

---

## Business Value

- Agents can navigate the Chemistry KB efficiently and find contextually relevant experiments, not just keyword matches
- Contextual tags (substrate class, scale, challenge, functional groups) enable precise filtering beyond simple reaction type matching
- Documented agent workflows provide repeatable patterns for common research questions, reducing trial-and-error in agent prompting
- "Who Has Experience" workflow surfaces human expertise with quantified metrics (experiment count, avg yield, recent work), enabling knowledge transfer
- End-to-end test scenarios ensure the entire system works as designed, from question to citation-backed answer
- Reduces time spent on failed experiments by surfacing relevant learnings from past work
- Demo-ready workflows showcase the KB's value to stakeholders and potential users

---

## Architecture Summary

```
Chemistry KB Navigation Architecture
════════════════════════════════════

Entry Point:
┌───────────────────────────────────────────────────┐
│ Chemistry KB Index                                │
│ (/kb/chemistry/index)                             │
│                                                    │
│ Links to:                                         │
│ - All Reaction Types (with experiment counts)    │
│ - Recent Experiments (last 30 days)              │
│ - Researcher Directory                            │
│ - Quick Stats (total experiments, chemicals)     │
│ - Navigation Guide (how agents should traverse)  │
└───────────────────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────────────────┐
│ Reaction Type Page                                │
│ (e.g., [[Suzuki-Coupling]])                       │
│                                                    │
│ Contains:                                         │
│ - Overview & mechanism                            │
│ - Key Learnings (ranked by quality + recency)    │
│ - "Who To Ask" section (researchers by expertise)│
│ - Experiment list (with tags)                    │
│ - Substrate Classes subsection                   │
│ - Common Challenges subsection                   │
└───────────────────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────────────────┐
│ Experiment Page                                   │
│ (e.g., [[EXP-2026-0042]])                        │
│                                                    │
│ Contextual Tags:                                  │
│ - reaction: suzuki-coupling                       │
│ - substrate-class: heteroaryl                     │
│ - scale: medium (5mmol)                          │
│ - challenge: protodeboronation                   │
│ - functional-groups: amino, nitro                │
│                                                    │
│ Content:                                          │
│ - Conditions (catalyst, solvent, temp, time)     │
│ - Reagents with roles and amounts                │
│ - Yield and observations                         │
│ - Practical notes (what worked, what didn't)    │
│ - Researcher attribution                         │
└───────────────────────────────────────────────────┘

Contextual Tag Taxonomy
═══════════════════════

substrate-class:
  - aryl, heteroaryl, vinyl, alkyl
  - allylic, benzylic, neopentyl
  - (extracted from reagent roles + structures)

scale:
  - small (<1mmol)
  - medium (1-10mmol)
  - large (>10mmol)
  - pilot (>100mmol)
  - (extracted from reagent amounts)

challenge:
  - yield, selectivity, purification
  - scale-up, stability, reproducibility
  - side-reaction, protodeboronation
  - (extracted from practical notes keywords)

functional-groups:
  - amino, hydroxyl, nitro, ester
  - halogen, cyano, carbonyl
  - (extracted from substrate structure descriptions)

Agent Workflow: "Find Similar Experiments"
═══════════════════════════════════════════

Input: User describes problem
  ↓
Step 1: Navigate to Chemistry KB Index
  ↓
Step 2: Follow wikilink to Reaction Type page
  ↓
Step 3: Read "Key Learnings" for immediate tips
  ↓
Step 4: Filter experiments by contextual tags
  (substrate class, scale, challenge)
  ↓
Step 5: Read top 3 matching experiment pages
  (sorted by quality_score × relevance)
  ↓
Step 6: Extract practical notes, conditions, attribution
  ↓
Output: Answer with specific citations
  (experiment IDs, researchers, dates)

Agent Workflow: "Who Has Experience"
════════════════════════════════════

Input: User asks about expertise
  ↓
Step 1: Navigate to Reaction Type page
  ↓
Step 2: Read "Who To Ask" section
  ↓
Step 3: Cross-reference Researcher profile pages
  ↓
Step 4: Compile ranked list with:
  - Name, experiment count, avg yield
  - Most recent experiment (ID + date)
  - Specific tips they contributed
  ↓
Output: Researcher recommendations with context
```

---

## Stories Breakdown

### SKB-46.1: Chemistry KB Index Page — 2 points, High

**Delivers:** Root navigation page at `/kb/chemistry/index`. Contents: links to all reaction types (with experiment counts), link to recent experiments (last 30 days), link to researcher directory, quick stats (total experiments, total chemicals, total researchers), guide text explaining how agents should navigate the Chemistry KB (start with reaction type → filter by substrate/scale/challenge → read top experiments → check "Who To Ask"). This page is the standard entry point for any chemistry question. Wikilink-enabled for easy traversal.

**Depends on:** EPIC-45 (Chemistry KB Data Model — reaction types and experiments must be synced)

---

### SKB-46.2: Contextual Search Tags — 3 points, Critical

**Delivers:** Structured tags on experiment pages for contextual filtering. Tags: `substrate-class` (aryl, heteroaryl, vinyl, alkyl, allylic, benzylic, etc.), `scale` (small <1mmol, medium 1-10mmol, large >10mmol, pilot >100mmol), `challenge` (yield, selectivity, purification, scale-up, stability, reproducibility, side-reaction), `functional-groups` (amino, hydroxyl, nitro, ester, halogen, cyano, carbonyl, etc.). Tags rendered as clickable badges on experiment pages. Classification logic: extract substrate class from reagent roles + chemical names, extract scale from reagent amounts, extract challenge from practical notes keywords, extract functional groups from substrate structure descriptions. Tags stored in experiment frontmatter YAML.

**Depends on:** SKB-46.1 (Chemistry KB Index)

---

### SKB-46.3: "Find Similar Experiments" Agent Workflow — 5 points, Critical

**Delivers:** Complete documented agent traversal pattern for finding relevant experiments. Steps: (1) User describes current problem (reaction type, substrate, specific challenge), (2) Agent navigates to Chemistry KB Index page, (3) Agent follows wikilink to matching Reaction Type page, (4) Agent reads "Key Learnings" for immediate relevant tips, (5) Agent uses contextual tags to filter experiments (substrate class, scale, challenge), (6) Agent reads top 3 matching experiment pages (sorted by quality_score × relevance), (7) Agent extracts practical notes, conditions that worked, and researcher attribution, (8) Agent composes answer with specific citations: experiment IDs, researchers, dates. Includes example input/output for the workflow. This is the PRIMARY workflow for the demo. Documented in `/kb/chemistry/agent-workflows/find-similar-experiments.md`.

**Depends on:** SKB-46.2 (Contextual Search Tags)

---

### SKB-46.4: "Who Has Experience" Agent Workflow — 3 points, High

**Delivers:** Documented agent traversal for finding human expertise. Steps: (1) User asks about expertise for specific reaction or substrate, (2) Agent navigates to Reaction Type page → "Who To Ask" section, (3) Cross-references with Researcher profile pages for deeper context, (4) Returns ranked researchers with: name, experiment count, avg yield, most recent experiment (ID + date), specific tips they contributed, (5) Suggest: "Dr. Mueller has done 6 heteroaryl Suzuki couplings with 84% avg yield. Her most recent was EXP-2026-0042 last week." Documented in `/kb/chemistry/agent-workflows/who-has-experience.md`.

**Depends on:** SKB-46.3 ("Find Similar Experiments" workflow as foundation)

---

### SKB-46.5: End-to-End Agent Test Scenarios — 3 points, High

**Delivers:** Detailed test scenarios with: input question, expected navigation path (which pages agent visits), expected output format. Scenarios: (1) "What conditions work for Suzuki coupling on heteroaryl substrates?" (2) "Who in our lab has done Grignard reactions at scale?" (3) "We're getting low yields on this amination — what did others try?" (4) "What safety precautions for handling Pd(PPh3)4?" (5) "Compare our Suzuki coupling results over the last 6 months" (6) "I need to do a Buchwald-Hartwig on a pyridine substrate — any tips?" Each scenario includes: expected pages visited, expected tags filtered, expected experiments cited, expected output structure. Test harness validates agent navigation using MCP server logs.

**Depends on:** SKB-46.4 ("Who Has Experience" workflow — both workflows tested together)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 46.1 | Index page renders all reaction types, experiment counts accurate, recent experiments query (last 30 days) | - | Agent navigates to index → clicks reaction type link → reaches correct page |
| 46.2 | Tag classification logic: substrate class extraction, scale bucket assignment, challenge keyword matching, functional group detection | Experiment page generates correct tags from ChemELN data | Agent filters experiments by tag combination → returns correct subset |
| 46.3 | Workflow step validation, quality_score × relevance sorting | Agent follows documented workflow → reaches correct experiments, extracts citations | Full workflow: question → index → reaction type → filtered experiments → cited answer |
| 46.4 | Researcher ranking logic: experiment count, avg yield calculation, recent experiment sorting | Agent cross-references "Who To Ask" with Researcher profiles | Full workflow: expertise question → "Who To Ask" → researcher profiles → ranked output |
| 46.5 | - | - | All 6 test scenarios pass: input → navigation path → output validated |

---

## Implementation Order

```
46.1 → 46.2 → 46.3 → 46.4 → 46.5 (sequential)

46.1  Chemistry KB Index Page (foundation)
  │
  └──▶ 46.2  Contextual Search Tags
         │
         └──▶ 46.3  "Find Similar Experiments" Workflow (primary)
                │
                └──▶ 46.4  "Who Has Experience" Workflow
                       │
                       └──▶ 46.5  End-to-End Test Scenarios (validation)
```

---

## Shared Constraints

- All pages must use wikilink syntax `[[Page Name]]` for internal navigation
- Contextual tags rendered as clickable badges using Tailwind classes: `bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs`
- Tag classification logic must be deterministic (same input → same tags)
- Quality score calculation: `(yield / 100) × 0.5 + (completeness_score / 100) × 0.3 + (recency_score / 100) × 0.2` (yield 50%, completeness 30%, recency 20%)
- Relevance score: tag match count / total tags (exact match = 1.0, partial match = 0.5)
- Top N experiments sorted by: `quality_score × relevance_score` (descending)
- Agent workflows documented in Markdown with clear numbered steps and example I/O
- Test scenarios must include expected MCP server tool calls (read page, search, filter)
- All dates formatted ISO 8601: `YYYY-MM-DD`
- Researcher attribution format: `[[Dr. Jane Mueller]] (EXP-2026-0042, 2026-03-15)`

---

## Files Created/Modified by This Epic

### New Files
- `/kb/chemistry/index.md` — Root Chemistry KB Index page
- `/kb/chemistry/agent-workflows/find-similar-experiments.md` — Primary agent workflow documentation
- `/kb/chemistry/agent-workflows/who-has-experience.md` — Expertise discovery workflow
- `/kb/chemistry/agent-workflows/README.md` — Overview of all agent workflows
- `scripts/sync-chemeln/classify-tags.ts` — Tag classification logic (substrate, scale, challenge, functional groups)
- `scripts/sync-chemeln/tag-taxonomy.ts` — Tag definitions and validation
- `tests/agent-workflows/find-similar-experiments.test.ts` — E2E workflow test
- `tests/agent-workflows/who-has-experience.test.ts` — E2E workflow test
- `tests/agent-workflows/test-scenarios.ts` — All 6 test scenarios
- `tests/agent-workflows/mcp-mock.ts` — Mock MCP server for testing navigation
- `docs/chemistry-kb/agent-navigation-guide.md` — How agents should use the KB
- `docs/chemistry-kb/tag-classification-rules.md` — Tag extraction logic documentation

### Modified Files
- `scripts/sync-chemeln/sync-experiments.ts` — Add tag classification during sync
- `scripts/sync-chemeln/generate-reaction-type-page.ts` — Add "Who To Ask" section
- `scripts/sync-chemeln/generate-experiment-page.ts` — Add contextual tags as badges
- `scripts/sync-chemeln/generate-researcher-page.ts` — Add expertise metrics
- `README.md` — Add link to Chemistry KB Index and agent workflow docs

---

**Last Updated:** 2026-03-21
