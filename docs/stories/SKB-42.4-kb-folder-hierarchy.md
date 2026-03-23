# Story SKB-42.4: KB Folder Hierarchy & Parent Pages

**Epic:** EPIC-42 Chemistry Knowledge Base — Information Architecture
**Story ID:** SKB-42.4
**Story Points:** 2
**Priority:** High
**Status:** Planned
**Depends On:** SKB-42.3

## User Story

As the chemistry KB system, I want a properly structured page hierarchy in SKB, So that experiment, chemical, and reaction pages have correct parent-child relationships and agents can navigate the tree.

## Acceptance Criteria

- [ ] Create root page "Chemistry KB" in SKB via Agent API
- [ ] Create category parent page "Chemistry KB/Experiments" for all experiment pages
- [ ] Create category parent page "Chemistry KB/Reaction Types" for all reaction type pages
- [ ] Create category parent page "Chemistry KB/Chemicals" for all chemical pages
- [ ] Create category parent page "Chemistry KB/Researchers" for all researcher pages
- [ ] Create category parent page "Chemistry KB/Substrate Classes" for all substrate class pages
- [ ] Create "Chemistry KB Index" page with navigation guide for AI agents
- [ ] Verify page tree API returns correct 7-page hierarchy
- [ ] Verify all parent pages have correct icons and one-liner summaries
- [ ] Script is idempotent (can be run multiple times without errors)
- [ ] Script logs all actions for debugging

## Architecture Overview

```
Page Hierarchy Structure
────────────────────────

Chemistry KB/                                    ← Root page (id: chem-kb-root)
├── Chemistry KB Index                           ← Agent navigation guide
├── Experiments/                                 ← Parent for experiments
│   └── (child pages created by EPIC-43+)
├── Reaction Types/                              ← Parent for reaction types
│   └── (child pages created by EPIC-45)
├── Chemicals/                                   ← Parent for chemicals
│   └── (child pages created by EPIC-44)
├── Researchers/                                 ← Parent for researchers
│   └── (child pages created by EPIC-43)
└── Substrate Classes/                           ← Parent for substrate classes
    └── (child pages created by EPIC-45)

Parent Page Purpose:
────────────────────

Each parent page serves as:
1. Navigation entry point (agents and users)
2. Category landing page (shows all child pages)
3. Namespace root (prevents title collisions)
4. Aggregation point (can show stats about children)

Page Tree API Response:
───────────────────────

GET /api/pages/tree?root=chem-kb-root

{
  "id": "chem-kb-root",
  "title": "Chemistry KB",
  "icon": "🧬",
  "children": [
    {
      "id": "chem-kb-index",
      "title": "Chemistry KB Index",
      "icon": "📖",
      "children": []
    },
    {
      "id": "chem-kb-experiments",
      "title": "Experiments",
      "icon": "🧪",
      "children": []  // Will be populated by EPIC-43
    },
    {
      "id": "chem-kb-reaction-types",
      "title": "Reaction Types",
      "icon": "🔬",
      "children": []  // Will be populated by EPIC-45
    },
    {
      "id": "chem-kb-chemicals",
      "title": "Chemicals",
      "icon": "⚗️",
      "children": []  // Will be populated by EPIC-44
    },
    {
      "id": "chem-kb-researchers",
      "title": "Researchers",
      "icon": "👩‍🔬",
      "children": []  // Will be populated by EPIC-43
    },
    {
      "id": "chem-kb-substrate-classes",
      "title": "Substrate Classes",
      "icon": "🧬",
      "children": []  // Will be populated by EPIC-45
    }
  ]
}
```

## Implementation Steps

### 1. Design Root Page Content

The root page provides an overview of the chemistry KB for both humans and AI agents.

**Content for "Chemistry KB" page:**

```markdown
---
title: "Chemistry KB"
icon: "🧬"
tags:
  - chemistry-kb-root
---

# Chemistry KB

> The institutional knowledge base for chemistry experiments, organized for both human navigation and AI-assisted research.

## Purpose

This knowledge base captures practical, institutional chemistry knowledge from ChemELN experiments. It organizes:
- What reactions we've tried
- What chemicals we use and how
- What challenges we've encountered
- Who has expertise in specific areas
- What substrate classes require special handling

This is NOT a database mirror or theoretical chemistry reference. It's focused on **what our lab learned** that isn't written down elsewhere.

## Navigation

- **[[Experiments]]**: Browse all chemistry experiments by date, reaction type, or researcher
- **[[Reaction Types]]**: See institutional learnings aggregated by reaction type
- **[[Chemicals]]**: Find practical notes on chemicals we use frequently
- **[[Researchers]]**: Find who has expertise in specific techniques or substrates
- **[[Substrate Classes]]**: See cross-experiment patterns for specific substrate classes

## For AI Agents

This knowledge base is designed for contextual retrieval. Use tags to filter:
- `reaction:[type]` — Find experiments by reaction type
- `researcher:[name]` — Find experiments by researcher
- `substrate-class:[class]` — Find experiments by substrate
- `scale:[category]` — Find experiments by scale
- `challenge:[issue]` — Find experiments that faced specific challenges
- `quality:[1-5]` — Filter by quality score

Start with the [[Chemistry KB Index]] for navigation guidance.
```

### 2. Design Category Parent Pages

Each parent page provides navigation and context for its category.

**Content for "Experiments" parent page:**

```markdown
---
title: "Experiments"
icon: "🧪"
tags:
  - chemistry-kb-experiments-parent
---

# Experiments

> All chemistry experiments imported from ChemELN, organized for contextual retrieval.

## Browse By

- **Date**: Most recent experiments first
- **Reaction Type**: Group by [[Reaction Types]]
- **Researcher**: Filter by [[Researchers]]
- **Quality Score**: High-quality experiments (quality:4 or quality:5)
- **Scale**: Filter by scale:[small|medium|large|pilot]

## Recent Experiments

(This section will be auto-populated by EPIC-47 continuous sync)

## Related Pages

- [[Reaction Types]]: See experiments grouped by reaction type
- [[Researchers]]: See experiments grouped by researcher
```

**Similar structure for other parent pages** (Reaction Types, Chemicals, Researchers, Substrate Classes).

### 3. Design Chemistry KB Index Page

This page provides explicit navigation guidance for AI agents.

**Content for "Chemistry KB Index" page:**

```markdown
---
title: "Chemistry KB Index"
icon: "📖"
tags:
  - chemistry-kb-index
---

# Chemistry KB Index

> AI agent navigation guide for the chemistry knowledge base

## For Agents: How to Use This KB

### 1. Understanding the Structure

The chemistry KB has 5 page types:
- **Experiment**: Individual chemistry experiments (from ChemELN)
- **Chemical**: Practical info about chemicals we use
- **ReactionType**: Aggregated learnings about reaction types
- **Researcher**: Who has expertise in what areas
- **SubstrateClass**: Cross-experiment patterns for substrate classes

### 2. Tag-Based Filtering

Use these tag patterns to find relevant pages:

**Finding Experiments:**
- `reaction:suzuki-coupling` → All Suzuki coupling experiments
- `researcher:mueller` → All experiments by Dr. Mueller
- `substrate-class:heteroaryl` → All experiments with heteroaryl substrates
- `scale:medium` → Medium-scale experiments (1-10 mmol)
- `challenge:protodeboronation` → Experiments that faced protodeboronation issues
- `quality:4` OR `quality:5` → High-quality experiments only

**Finding Chemicals:**
- `cas:14221-01-3` → Find chemical by CAS number

**Finding Expertise:**
- `researcher` tag → All researcher pages
- Cross-reference with `reaction:*` tags to find who works on what

### 3. Wikilink Navigation

Pages are interconnected via wikilinks:
- Experiments link to chemicals, reaction types, researchers, substrate classes
- Chemical pages link back to experiments that used them
- Reaction type pages aggregate experiments by type
- Researcher pages show all their experiments

### 4. Graph Traversal

Use the graph API to:
- Find related experiments (via shared chemicals or substrate classes)
- Find who else worked on similar problems (via reaction type or substrate class)
- Find alternative approaches (via backlinks from chemicals)

### 5. Contextual Retrieval Example

**User asks: "How do we handle heteroaryl substrates in Suzuki couplings?"**

Agent strategy:
1. Search for pages with tags: `reaction:suzuki-coupling` AND `substrate-class:heteroaryl`
2. Find the [[Heteroaryl Halides]] substrate class page for aggregated insights
3. Read "Practical Notes" sections from top-quality experiments (quality:4+)
4. Check [[Suzuki Coupling]] reaction type page for "Substrate-Specific Advice"
5. Identify expert: Find researcher with most experiments in this area

## Entry Points

- **[[Chemistry KB]]**: Root page
- **[[Experiments]]**: Browse all experiments
- **[[Reaction Types]]**: Browse by reaction type
- **[[Chemicals]]**: Browse chemicals
- **[[Researchers]]**: Find expertise
- **[[Substrate Classes]]**: Browse by substrate class
```

### 4. Create Setup Script

**File:** `scripts/setup-chemistry-kb-hierarchy.ts`

```typescript
/**
 * Setup script for Chemistry KB page hierarchy
 * Creates root page and all category parent pages
 */

import { agentApi } from '../lib/agent-api';

interface PageConfig {
  title: string;
  icon: string;
  tags: string[];
  content: string;
  parentId?: string;
}

const PAGES: PageConfig[] = [
  {
    title: 'Chemistry KB',
    icon: '🧬',
    tags: ['chemistry-kb-root'],
    content: `# Chemistry KB

> The institutional knowledge base for chemistry experiments, organized for both human navigation and AI-assisted research.

## Purpose

This knowledge base captures practical, institutional chemistry knowledge from ChemELN experiments. It organizes:
- What reactions we've tried
- What chemicals we use and how
- What challenges we've encountered
- Who has expertise in specific areas
- What substrate classes require special handling

This is NOT a database mirror or theoretical chemistry reference. It's focused on **what our lab learned** that isn't written down elsewhere.

## Navigation

- **[[Experiments]]**: Browse all chemistry experiments by date, reaction type, or researcher
- **[[Reaction Types]]**: See institutional learnings aggregated by reaction type
- **[[Chemicals]]**: Find practical notes on chemicals we use frequently
- **[[Researchers]]**: Find who has expertise in specific techniques or substrates
- **[[Substrate Classes]]**: See cross-experiment patterns for specific substrate classes

## For AI Agents

This knowledge base is designed for contextual retrieval. Use tags to filter:
- \`reaction:[type]\` — Find experiments by reaction type
- \`researcher:[name]\` — Find experiments by researcher
- \`substrate-class:[class]\` — Find experiments by substrate
- \`scale:[category]\` — Find experiments by scale
- \`challenge:[issue]\` — Find experiments that faced specific challenges
- \`quality:[1-5]\` — Filter by quality score

Start with the [[Chemistry KB Index]] for navigation guidance.`,
  },
  // Additional pages defined similarly...
];

async function setupHierarchy() {
  console.log('Setting up Chemistry KB hierarchy...');

  for (const pageConfig of PAGES) {
    console.log(`Creating page: ${pageConfig.title}`);

    const page = await agentApi.createPage({
      title: pageConfig.title,
      icon: pageConfig.icon,
      tags: pageConfig.tags,
      content: pageConfig.content,
      parentId: pageConfig.parentId,
    });

    console.log(`✓ Created: ${page.title} (id: ${page.id})`);
  }

  console.log('✓ Chemistry KB hierarchy setup complete');
}

setupHierarchy().catch(console.error);
```

### 5. Verify Hierarchy via API

After running the setup script, verify the hierarchy is correct:

```bash
# Query page tree
curl -X GET "http://localhost:3000/api/pages/tree?root=chemistry-kb"

# Verify 7 pages created
# Verify parent-child relationships
# Verify all icons and tags are correct
```

## Testing Requirements

### Page Creation

- [ ] Root page "Chemistry KB" created successfully
- [ ] 5 category parent pages created successfully
- [ ] "Chemistry KB Index" page created successfully
- [ ] All pages have correct icons (🧬, 🧪, 🔬, ⚗️, 👩‍🔬)
- [ ] All pages have correct tags

### Hierarchy Verification

- [ ] Page tree API returns 7 pages in correct hierarchy
- [ ] Parent-child relationships are correct
- [ ] No orphaned pages (all pages have parent except root)

### Script Robustness

- [ ] Script is idempotent (can run multiple times without errors)
- [ ] Script handles errors gracefully (e.g., page already exists)
- [ ] Script logs all actions for debugging
- [ ] Script can be run in CI/CD pipeline

### Content Quality

- [ ] All parent pages have clear one-liner summaries
- [ ] All parent pages explain their purpose
- [ ] "Chemistry KB Index" provides clear agent guidance
- [ ] Navigation wikilinks work correctly

## Files to Create/Modify

| File Path | Type | Purpose |
|-----------|------|---------|
| `scripts/setup-chemistry-kb-hierarchy.ts` | Create | Setup script for hierarchy |
| `tests/chemistry-kb/hierarchy-validation.test.ts` | Create | Test suite for hierarchy |
| `docs/chemistry-kb/HIERARCHY.md` | Create | Documentation of page structure |

## Dev Notes

### Idempotency Strategy

The setup script should check if pages already exist before creating them:

```typescript
const existingPage = await agentApi.findPageByTitle(pageConfig.title);
if (existingPage) {
  console.log(`Page already exists: ${pageConfig.title} (id: ${existingPage.id})`);
  return existingPage.id;
}
```

### Parent ID Resolution

Parent pages must be created before their children. The script should:
1. Create root page first
2. Store its ID
3. Use that ID as `parentId` for child pages

### Multi-Tenant Considerations

- Each tenant gets its own Chemistry KB hierarchy
- Use tenant-scoped API calls
- Page titles must be unique within a tenant

### Error Handling

The script should handle common errors:
- Network failures (retry with exponential backoff)
- Duplicate page titles (skip or update)
- Missing permissions (fail with clear error message)

### Future Enhancements

- Add page counts to parent pages ("X experiments", "Y chemicals")
- Add auto-generated "Recent Activity" sections
- Add breadcrumb navigation to all pages
- Support multiple chemistry KB instances per tenant (e.g., "Organic Chemistry KB", "Medicinal Chemistry KB")
