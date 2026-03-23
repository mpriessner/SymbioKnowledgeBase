# SKB-50.1: Fix Wikilink Persistence in Experiment Pages

**Story ID:** SKB-50.1
**Epic:** EPIC-50 (Chemistry KB — Graph Interconnectivity)
**Points:** 5
**Priority:** High
**Status:** Not Started
**Depends on:** Nothing

---

## User Story

As a knowledge base user, I want wikilinks in experiment pages (researcher, reaction type, substrate class) to survive the TipTap round-trip, so clicking them navigates to the linked entity page and the knowledge graph shows these connections.

---

## What This Story Delivers

Wikilinks like `[[Suzuki Coupling]]` and `[[Dr. Anna Mueller]]` currently placed inside markdown table cells are lost during the markdown → TipTap JSON → markdown round-trip. This story fixes that by restructuring the experiment template's Metadata section from a markdown table to plain paragraphs, where wikilinks are known to survive.

---

## Problem

The experiment template (`src/lib/chemistryKb/templates.ts`, `generateExperimentPage()`) renders metadata like this:

```markdown
| **Reaction Type** | [[Suzuki Coupling]] |
| **Researcher** | [[Dr. Anna Mueller]] |
| **Substrate Class** | [[Aryl Halides]] |
```

When this markdown is converted to TipTap JSON (`markdownToTiptap`), wikilinks inside table cells are stripped — the parser treats table cell content as inline text and doesn't recognize `[[...]]` as wikilink nodes.

The mirrored `.md` files show plain text:
```
**Reaction Type:** Suzuki Coupling
```

No `PageLink` records are created for these connections, so the graph shows no edges.

---

## Root Cause Investigation

Before implementing, verify which step loses the wikilinks:

1. **Check the markdown deserializer** (`markdownToTiptap`) — does it handle `[[wikilinks]]` inside table cells?
2. **Check the TipTap table extension** — does it allow `wikilink` nodes inside `tableCell` content?
3. **Check the wikilink pre-processor regex** — does it run inside table cell content?

The likely answer is (1) or (3) — the wikilink regex runs on the full markdown but table cell parsing happens separately and doesn't invoke it.

---

## Technical Specification

### Fix: Restructure Metadata Section

Replace the markdown table format with headed paragraphs:

**Before (table — wikilinks get lost):**
```markdown
## Metadata

| Field | Value |
|-------|-------|
| **ELN ID** | EXP-2026-0042 |
| **Researcher** | [[Dr. Anna Mueller]] |
| **Reaction Type** | [[Suzuki Coupling]] |
| **Substrate Class** | [[Aryl Halides]] |
| **Date** | 2026-03-15 |
| **Status** | Completed |
```

**After (paragraphs — wikilinks survive):**
```markdown
## Metadata

**ELN ID:** EXP-2026-0042
**Researcher:** [[Dr. Anna Mueller]]
**Reaction Type:** [[Suzuki Coupling]]
**Substrate Class:** [[Aryl Halides]]
**Date:** 2026-03-15
**Status:** Completed
```

This format is already used in other parts of the experiment page (e.g., Reagents section uses `[[chemical]]` in list items successfully).

### Changes to `generateExperimentPage()`

In `src/lib/chemistryKb/templates.ts`, find the Metadata section generation and replace the table rendering with paragraph rendering. The data fields remain identical — only the presentation format changes.

### Verify Related Pages Section

The template also generates a "Related Pages" section with wikilinks. Verify these survive (they should, since they're not in tables). If any are in tables, restructure them too.

### Verify Reagents Section

The Reagents section already uses `[[chemical name]]` in list items. Verify these continue to work after changes.

---

## Files to Modify

- `src/lib/chemistryKb/templates.ts` — Restructure experiment template Metadata section from table to paragraphs

## Files to Verify (read-only)

- `src/lib/markdown/deserializer.ts` — Understand how wikilinks are handled in table cells
- `src/lib/chemistryKb/wikilinkResolver.ts` — Confirm wikilink resolution still works with paragraph format

---

## Acceptance Criteria

- [ ] Experiment pages contain working `[[wikilinks]]` for: researcher, reaction type, substrate class
- [ ] Chemical names in Reagents section remain as `[[wikilinks]]`
- [ ] Related Experiments section uses `[[full title]]` wikilinks
- [ ] Related Pages section has working wikilinks
- [ ] After sync, `PageLink` records are created for all wikilinks in experiment pages
- [ ] Existing experiment data is not lost (only template format changes)
- [ ] Metadata section renders cleanly in both the web editor and as `.md` files

---

## Verification Strategy

1. Run the chemistry sync to regenerate experiment pages with new template
2. Check mirrored `.md` files — wikilinks should appear as `[[...]]` not plain text
3. Query `PageLink` table — experiment pages should have edges to reaction type, researcher, substrate class pages
4. View knowledge graph — experiment nodes should connect to entity nodes

---

## Implementation Notes

- This is the foundation story — SKB-50.2, SKB-50.3, and SKB-50.5 all depend on this
- The change is purely presentational (table → paragraphs). No data fields are added or removed.
- Test by generating a single experiment page and checking the output before running full sync
- If `markdownToTiptap` has a way to support wikilinks in table cells (e.g., a custom extension), that's an alternative fix, but restructuring the template is simpler and more robust

---

**Last Updated:** 2026-03-23
