# Story SKB-52.9: Agent-Driven Knowledge Extraction from Raw Experiment Data

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.9
**Story Points:** 8 | **Priority:** Medium | **Status:** Future
**Depends On:** SKB-52.7 (Auto-Ingest), SKB-52.8 (Reconciliation Sync)

---

## User Story

As a researcher recording experiments via ExpTube and ChemELN,
I want an AI agent to automatically extract institutional knowledge (tips, pitfalls, best practices) from my raw experiment data and conversations,
So that the Chemistry Knowledge Base accumulates practical learnings without me having to manually write them up.

---

## Problem

Currently, KB experiment pages have scaffolded sections ("What Works Well", "Common Challenges", "Recommendations") that are **empty** — they need to be filled in manually. But the raw data that would inform these sections already exists across the ecosystem:

1. **ChemELN**: Actual procedure steps (with deviations from planned procedure), observations, conclusions, yield data
2. **ExpTube**: Video recordings with transcriptions, voice notes, real-time commentary during experiments
3. **Conversation context**: Researchers discuss experiments with voice agents, mention tips, warn about issues

This knowledge is trapped in raw form. No one has time to manually distill it into structured KB entries.

## Vision

An extraction agent watches for new data flowing through ExpTube and ChemELN, and automatically:
1. Identifies actionable takeaways (things that worked, things that went wrong, tips for next time)
2. Classifies them into the right KB section (best practices, challenges, recommendations)
3. Writes them into the corresponding experiment's KB page
4. Cross-references with other experiments of the same type to identify patterns

---

## Data Sources for Extraction

### From ChemELN (`actual_procedure` JSONB field)
- **Deviations**: Steps where `deviations` array is non-empty indicate something unexpected happened
  - Example: `"Temperature 3°C below target"`, `"Heating time extended by 3 minutes"` → Challenge + Recommendation
- **Observations**: Free-text field with experimental observations → Results section
- **Conclusions**: Free-text with outcomes and interpretations → Results section
- **Yield data**: Compare actual yield to theoretical → Best Practice (if high) or Challenge (if low)

### From ExpTube (video transcriptions)
- **Voice commentary**: Researcher narrates while working — contains implicit tips ("I always make sure to..." = Best Practice)
- **Problem mentions**: "This didn't work because...", "Next time I should..." = Challenge + Recommendation
- **Equipment notes**: "This centrifuge runs hot, so..." = Institutional Knowledge

### From Conversation Context (voice agent sessions)
- **Q&A pairs**: When a researcher asks "What temperature should I use for..." and gets an answer from experience → Best Practice
- **Warnings**: "Be careful with..." → Challenge
- **Comparisons**: "Last time we used X instead of Y and it worked better" → Recommendation

---

## Technical Approach

### Architecture

```
Data Sources                    Extraction Agent                    Knowledge Base
─────────────                   ─────────────────                   ──────────────
ChemELN
  actual_procedure  ───┐
  observations      ───┼──→  LLM Extraction Pipeline  ──→  PATCH /api/agent/pages/{id}
  conclusions       ───┘     (classify + distill)          (append to correct section)
                                    │
ExpTube                             │
  transcriptions    ───────────────→│
  video metadata    ───────────────→│
                                    │
Voice Agent Sessions                │
  conversation logs ───────────────→│
```

### Extraction Pipeline

1. **Trigger**: New data arrives (ChemELN procedure update, ExpTube video processed, conversation ended)
2. **Gather**: Collect all raw data for the experiment (procedure + transcription + conversation)
3. **Extract**: LLM prompt to identify:
   - What worked well (best practices)
   - What went wrong or was difficult (challenges)
   - What should be done differently next time (recommendations)
   - Notable observations or results
4. **Classify**: Assign each takeaway to the correct KB section
5. **Deduplicate**: Compare with existing KB content to avoid duplicates
6. **Write**: Append new takeaways to the experiment's KB page via Agent API
7. **Cross-reference**: If a takeaway applies to a reaction type (not just this experiment), also add it to the Reaction Type page

### LLM Extraction Prompt (sketch)

```
You are analyzing raw experiment data to extract institutional knowledge.

Experiment: {title}
Reaction Type: {reaction_type}
Status: {status}

--- Procedure (planned vs actual) ---
{diff of planned vs actual procedure}

--- Observations ---
{observations}

--- Conclusions ---
{conclusions}

--- Voice Transcription (if available) ---
{transcription excerpt}

Extract:
1. BEST_PRACTICE: Things that worked well, tips for success
2. CHALLENGE: Things that went wrong, pitfalls, difficulties
3. RECOMMENDATION: What to do differently next time
4. RESULT: Notable quantitative or qualitative outcomes

Format each as a bullet point. Be specific and actionable.
Only extract what is actually supported by the data — do not infer or generalize.
```

### Write Strategy

- **Append, never overwrite**: New takeaways are appended to existing section content
- **Attribution**: Each extracted takeaway includes source reference: `(from EXP-2025-0001, 2026-03-26)`
- **Confidence**: Only write takeaways with high confidence; flag uncertain ones for human review
- **Human override**: If a researcher edits a section, the agent respects their changes and only appends below

---

## Acceptance Criteria

- [ ] Agent extracts best practices from ChemELN `actual_procedure` deviations
- [ ] Agent extracts challenges from observations/conclusions mentioning problems
- [ ] Agent extracts recommendations from conclusions mentioning future improvements
- [ ] Extracted content is appended to the correct KB page section
- [ ] Deduplication: same takeaway is not added twice
- [ ] Cross-experiment patterns: if 3+ experiments of the same reaction type share a challenge, it's added to the Reaction Type page
- [ ] Human-written content is never overwritten
- [ ] Source attribution on every extracted bullet point
- [ ] Works for both completed and in-progress experiments (updates as data arrives)

---

## Implementation Phases

### Phase 1: ChemELN Procedure Analysis
- Extract from `actual_procedure.steps[].deviations`
- Extract from `observations` and `conclusions` fields
- Write to experiment KB pages

### Phase 2: ExpTube Transcription Analysis
- Extract from video transcriptions
- Requires ExpTube to expose transcription API
- More nuanced — voice content is less structured

### Phase 3: Conversation Context Analysis
- Extract from voice agent conversation logs
- Requires conversation history API
- Most complex — needs to distinguish experiment-specific vs general advice

### Phase 4: Cross-Experiment Pattern Detection
- Aggregate takeaways across experiments of the same type
- Identify recurring patterns (same challenge in 3+ experiments = systemic)
- Write patterns to Reaction Type and Chemical pages

---

## Out of Scope (for this story)

- Real-time extraction during live experiments (batch processing is fine initially)
- Automated quality scoring of extracted knowledge
- User feedback loop (thumbs up/down on extracted takeaways)
- Multi-language support

---

## Dependencies

- SKB-52.7 (create action) — experiment pages must exist before extraction can write to them
- SKB-52.8 (reconciliation) — ensures all ChemELN experiments have KB pages
- ChemELN API access — to read `actual_procedure`, observations, conclusions
- ExpTube transcription API — to read video transcriptions (Phase 2)
- LLM API access — Claude or similar for extraction

---

## Why This Matters

The Knowledge Base is only as valuable as the knowledge in it. Without this agent, the KB pages are empty scaffolds that require manual effort to fill — and researchers won't do it because they're busy doing experiments. The extraction agent turns existing raw data into structured institutional knowledge automatically, making the KB a living resource that grows with every experiment.
