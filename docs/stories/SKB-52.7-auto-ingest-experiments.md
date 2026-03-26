# Story SKB-52.7: Auto-Ingest New Experiments from External Platforms

**Epic:** EPIC-52 — Chemistry KB Content Harmonization & Cross-Platform Sync
**Story ID:** SKB-52.7
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-52.4 (Incoming Sync Endpoint — Complete)

---

## User Story

As a researcher using ChemELN or ExpTube,
I want experiments I create to automatically appear in the Chemistry Knowledge Base,
So that I can immediately start adding institutional knowledge (tips, pitfalls, best practices) without manually creating pages.

---

## Problem

The sync endpoint (`POST /api/sync/experiments`) currently supports `delete`, `restore`, `update`, and `purge` actions — but not `create`. When a new experiment is created in ChemELN or ExpTube, there is no way for those platforms to push the experiment into SKB. The user's experiments (e.g., "Titration 6", "Test 6") exist in ChemELN but have no corresponding KB pages.

The pull-based sync infrastructure (`IncrementalSyncRunner`) can discover new experiments, but it requires ChemELN API credentials and is designed as a batch process — not a real-time webhook receiver.

## Solution

Add a `create` action to the existing sync endpoint. When ChemELN or ExpTube creates/completes an experiment, they send a webhook to SKB with the experiment data. SKB creates a templated KB page under the Experiments category with scaffolded sections for institutional knowledge.

---

## Acceptance Criteria

- [ ] `POST /api/sync/experiments` accepts `action: "create"` in addition to existing actions
- [ ] Payload for `create` includes experiment metadata:
  ```json
  {
    "eln_experiment_id": "EXP-2025-0042",
    "action": "create",
    "source": "chemeln",
    "fields": {
      "title": "Titration of NaOH with HCl",
      "researcher": "Dr. Anna Mueller",
      "date": "2026-03-25",
      "status": "completed",
      "reaction_type": "Acid-Base Titration",
      "summary": "Standardization titration achieving 0.1023 M concentration"
    }
  }
  ```
- [ ] On `create`, SKB:
  1. Checks if a page already exists for this ELN ID (idempotent — returns 200 with existing page if found)
  2. Sets up Chemistry KB hierarchy if not present (`setupChemistryKbHierarchy`)
  3. Creates a new Page under the Experiments category with:
     - Title: the experiment title (prefixed with ELN ID if not already)
     - Icon: 🧪
     - oneLiner: from `fields.summary`
     - spaceType: TEAM, assigned to Chemistry KB teamspace
  4. Creates a Block with templated markdown content including:
     - Frontmatter with ELN metadata (id, researcher, date, status, reaction type)
     - Scaffolded sections: Results, Best Practices, Common Challenges, Recommendations
     - Wikilinks to known chemicals, reaction types, researchers (if they exist as pages)
  5. Processes wikilinks via `processAgentWikilinks`
- [ ] Returns `{ status: "created", id: "<page-id>", title: "<title>" }` with HTTP 201
- [ ] If page already exists for this ELN ID: returns `{ status: "exists", id: "<page-id>" }` with HTTP 200
- [ ] Validation: `fields.title` is required for `create` action; returns 400 if missing
- [ ] Anti-loop: never re-propagates `create` events (receiving end only)
- [ ] All existing actions (`delete`, `restore`, `update`, `purge`) continue to work unchanged

---

## Technical Design

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/sync/experiments/route.ts` | Add `"create"` to action enum, add `handleCreate` function |
| `src/lib/chemistryKb/experimentLookup.ts` | No change needed (already has `findExperimentByElnId`) |
| `src/lib/chemistryKb/setupHierarchy.ts` | No change needed (already idempotent) |

### No New Files

This story modifies the existing sync endpoint. No new files are created.

### Template for Auto-Created Pages

The `handleCreate` function generates a minimal but useful KB page:

```markdown
---
title: "EXP-2025-0042: Titration of NaOH with HCl"
eln_id: "EXP-2025-0042"
researcher: "Dr. Anna Mueller"
date: "2026-03-25"
status: "completed"
reaction_type: "Acid-Base Titration"
tags:
  - "eln:EXP-2025-0042"
  - "synced"
---

# EXP-2025-0042: Titration of NaOH with HCl

> Standardization titration achieving 0.1023 M concentration

**Researcher:** [[Dr. Anna Mueller]]
**Date:** 2026-03-25
**Status:** completed
**Reaction Type:** [[Acid-Base Titration]]

---

## Results & Observations

*Auto-generated from ELN sync. Add your observations here.*

## What Works Well

*Add best practices and tips discovered during this experiment.*

## Common Challenges

*Document pitfalls and issues encountered.*

## Recommendations for Next Time

*What would you do differently?*

## Related Experiments

*Add [[wikilinks]] to related experiments here.*
```

### Key Decisions

1. **Minimal template, not full template**: Unlike seeded pages that use `generateExperimentPage()` with rich data (reagents, procedures, characterization), auto-created pages use a lighter template. The detailed data lives in ChemELN; SKB pages are for institutional knowledge that doesn't fit in the ELN.

2. **Idempotent**: Calling `create` twice with the same ELN ID returns the existing page, not a duplicate. This handles webhook retries safely.

3. **No cascade entity creation**: Unlike the full seed which creates Chemical/ReactionType/Researcher pages, the `create` action only creates the experiment page. Entity pages are created by the periodic reconciliation sync (SKB-52.8) or the existing seed script.

---

## Verification

1. **Create via curl:**
   ```bash
   curl -X POST http://localhost:3000/api/sync/experiments \
     -H "Authorization: Bearer $SYNC_SERVICE_KEY" \
     -H "X-Tenant-ID: 00000000-0000-4000-a000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{
       "eln_experiment_id": "EXP-2025-0042",
       "action": "create",
       "source": "chemeln",
       "fields": {
         "title": "Titration of NaOH with HCl",
         "researcher": "Dr. Anna Mueller",
         "summary": "Standardization titration"
       }
     }'
   ```
   → HTTP 201, page appears in sidebar under Chemistry KB > Experiments

2. **Idempotency:** Same curl again → HTTP 200, `{ status: "exists" }`

3. **Missing title:** Omit `fields.title` → HTTP 400 validation error

4. **Existing actions unaffected:** `delete`, `update`, `purge` still work as before

---

## Out of Scope

- Full template generation with reagents/procedures/characterization (that's the seed script's job)
- Automatic entity page creation (chemicals, reaction types) — handled by SKB-52.8
- ExpTube webhook configuration — that's an ExpTube-side task
- ChemELN webhook configuration — that's a ChemELN-side task
