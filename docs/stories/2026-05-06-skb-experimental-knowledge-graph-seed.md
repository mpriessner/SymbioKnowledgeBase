# Story: SKB experimental knowledge-graph seed

**ID:** 2026-05-06-skb-experimental-knowledge-graph-seed
**Status:** Implemented
**Created:** 2026-05-06

## Goal
Rewrite `prisma/seed-demo.ts` so a fresh SKB instance comes up with a realistic, interconnected research-lab knowledge graph that mirrors the experiments now living in the local ExpTube and ChemELN databases — instead of the current generic SaaS demo (Roadmap, Bug Tracker, Feature Specs, etc).

## Context

**Current SKB demo content (after the prior reseed):** 45 pages, 50 blocks, 134 PageLinks, 2 embedded databases (`bug_tracker`, `feature_requests`), 2 teamspaces (Engineering, Product). The content is generic SaaS docs — appropriate for a Notion-clone demo, inappropriate for this product's intended user (a chemistry/biology research org). See `prisma/seed-demo.ts` for the existing structure: idempotent upserts keyed by fixed UUIDs in the `d0000000-…` (pages) and `e0000000-…` (teamspaces) namespaces, ProseMirror-style JSON block content built by helpers (`paragraph`, `bulletList`, `orderedList`, `taskList`, `codeBlock`, `blockquote`, `divider`).

**Upstream sources of truth:**
- **ExpTube** (Postgres `supabase_db_ExpTube`, table `experiments`): the new molecular-biology workflow EXP-2026-0101 through EXP-2026-0106 (Genomic DNA Extraction → Plasmid Mini Prep → Agarose Gel Prep → Quality-Check Gel → PCR-Verification Gel → DNA Purification). Each row carries `name`, `description`, `status`, `start_date`, `eln_experiment_id` (FK to ChemELN). Companion `experiment_analysis` carries AI-extracted `merged_narrative`, `merged_steps/materials/equipment/observations` (jsonb), `completeness_score`, `report_markdown`.
- **ChemELN** (Postgres `supabase_db_ChemELN`, table `experiments`): 24 experiments across 5 projects (Organic Synthesis Lab, Protein Biochemistry, Cell Biology Studies, Materials Characterization, Teaching Demonstrations) plus the molecular-biology series 101–106 mirroring ExpTube. Each carries `experiment_number`, `title`, `objective`, `planned_procedure`, `actual_procedure` (jsonb), `observations`, `conclusions`. Linked tables: `chemicals` (real CAS + formula for ~10 common reagents), `reagents` (per-experiment chemical+role+amount), `qc_verifications`, `planned_procedure_steps`.

**SKB infrastructure facts that constrain the seed:**
- Single tenant `00000000-0000-4000-a000-000000000001` "Default Workspace".
- Three real users: `admin@symbio.local` (id `00000000-…000002`), `dev@symbio.local` (id `dev-user`, the seed-script-only fallback for local dev mode without Supabase), `martin.priessner@gmail.com` (id `23395bc9-b500-4fa7-a6ce-f1dc7c9c6363`, created on first Google sign-in via the ExpTube auth bridge — see workspace memory `project_scisymbiolens_auth_uses_exptube_supabase`).
- Auth flows through ExpTube's local Supabase on port 54341. New Google sign-ins go through `src/app/auth/callback/route.ts → ensureUserExists` which auto-attaches them to `DEFAULT_TENANT_ID`.
- Schema (see `prisma/schema.prisma`): `Page` has no `createdBy` / `ownerId` field. Page "ownership" is operationally tenant + (optional) teamspace membership. Block has no author either. So "owned by Martin" reduces to: Martin is `TeamspaceMember(role=OWNER)` on every new teamspace and a `TenantMember(role=owner)` on the tenant (already true).

**User-confirmed design decisions (2026-05-06):**
- Wipe-and-reseed is OK; this content becomes the new baseline.
- Pages should be visibly "Martin's" — operationally that means teamspace OWNER on every teamspace.
- Link density: **medium** — enough to form visually meaningful clusters of related experiments, findings, and SOPs in a graph view; not enough to look like a hairball.

## Acceptance Criteria

- [ ] Running `docker exec symbioknowledgebase-app-1 sh -c 'cd /app && npx tsx prisma/seed-demo.ts'` on a freshly-restored DB produces exactly the new content set: ~50 pages, ~180 PageLinks, 5 teamspaces, 0 generic SaaS pages.
- [ ] Re-running the same command is **content-idempotent**: the same set of rows exists with the same ids, titles, block content JSON, and link edges. Timestamps (`createdAt`, `updatedAt`) are allowed to refresh because the strategy is wipe-and-reseed; bit-for-bit equality at the row level is **not** an acceptance criterion (Codex round 1).
- [ ] The new teamspaces are: Molecular Biology, Organic Synthesis, Protein Biochemistry, Cell Biology, Analytical & Materials.
- [ ] Every new teamspace has `martin.priessner@gmail.com` as `TeamspaceMember(role=OWNER)` (alongside admin + dev to keep both auth modes working).
- [ ] Every Experiment-summary page corresponds to a real upstream `experiments` row in ExpTube or ChemELN — title matches verbatim, callout block at top of the page cites the upstream ID(s) (`EXP-2026-0101` and/or `ELN-101`).
- [ ] Each Experiment page links to ≥2 SOPs and ≥1 Finding via `PageLink`.
- [ ] Each Finding page links upward to its source Experiment(s) and to ≥1 sibling Finding.
- [ ] Each SOP page is the link target of ≥2 Experiments (real reuse, not 1-to-1).
- [ ] General-purpose pages preserved (in spirit, possibly retitled): Welcome, Onboarding Guide, Database Access Instructions, Equipment Operation Manuals, Safety Protocols & Compliance, Organization Policies.
- [ ] Generic SaaS pages dropped: Roadmap Q1 2026, Bug Tracker, Feature Specifications, CI/CD Pipeline, Sprint Meeting Notes 12/13/14, Frontend Components, Performance Optimization, Embedding & Vector Search, Agent Workflows, Prompt Library, Knowledge Extraction Pipeline, Design System, Changelog (most of the existing 45 pages).
- [ ] Existing embedded `databases` rows (bug_tracker, feature_requests) are removed; the new seed adds **no** Notion-style Database in this iteration (deferred — see Out of Scope).
- [ ] No changes to `prisma/schema.prisma`, no new dependencies, no edits to ExpTube/ChemELN.
- [ ] After `npx tsx prisma/seed-demo.ts` succeeds, `/api/teamspaces` and `/home` return 200 for Martin in a browser (smoke test, not automated).

## Implementation Plan

### Step 1 — Targeted cleanup of OLD-namespace seed (NOT a tenant-wide wipe)

**(Gemini round 2, critical) — `docker-entrypoint.sh:19` runs `prisma db seed` on every container start.** A blanket tenant-scoped wipe inside `seed-demo.ts` would destroy any user-created content on every restart, breaking the local-dev loop and live demo state. **Revised strategy:** explicitly delete only the previous-generation seed UUIDs (the `d0000000-…` page space and `e0000000-…` teamspace space defined in the current `seed-demo.ts`) instead of everything in the tenant. The new content lives in fresh namespaces (`f1000000-…` through `f7000000-…`), so user-created pages remain untouched.

```ts
const OLD_PAGE_PREFIX = "d0000000-0000-4000-a000-";
const OLD_TEAMSPACE_PREFIX = "e0000000-0000-4000-a000-";
const oldPageIds = [/* all the d0000000-… ids enumerated in the existing seed-demo.ts */];
const oldTeamspaceIds = [TEAMSPACE.engineering, TEAMSPACE.product];

await prisma.$transaction([
  prisma.dbRow.deleteMany({ where: { tenantId, page: { id: { in: oldPageIds } } } }),
  prisma.database.deleteMany({ where: { tenantId, page: { id: { in: oldPageIds } } } }),
  prisma.pageLink.deleteMany({ where: { tenantId, OR: [{ sourcePageId: { in: oldPageIds } }, { targetPageId: { in: oldPageIds } }] } }),
  prisma.block.deleteMany({ where: { tenantId, pageId: { in: oldPageIds } } }),
  // (Gemini round 2) Storage-quota hygiene: explicitly delete file attachments
  // pointed at the old pages so Tenant.storageUsed doesn't leak.
  prisma.fileAttachment.deleteMany({ where: { tenantId, pageId: { in: oldPageIds } } }),
  prisma.notification.deleteMany({ where: { tenantId, pageId: { in: oldPageIds } } }),
  prisma.page.deleteMany({ where: { tenantId, id: { in: oldPageIds } } }),
  prisma.teamspaceMember.deleteMany({ where: { teamspaceId: { in: oldTeamspaceIds } } }),
  prisma.teamspace.deleteMany({ where: { id: { in: oldTeamspaceIds } } }),
]);
```

Per Codex round 1: this **is** one DB transaction with operations executed sequentially. No step depends on the return value of an earlier step.

**`Tenant.storageUsed` decrement.** Before the FileAttachment delete, sum their `fileSize`s and decrement `Tenant.storageUsed` accordingly. (Gemini round 2 — explicit storage hygiene.)

Do **not** delete users, tenants, or tenant_members.

**(Gemini round 2, critical) — Companion `prisma/reset-demo.ts` script for the nuclear option.** Add a separate script callable via `npx tsx prisma/reset-demo.ts` (or wired up as `npm run reset-demo`). This one *does* wipe the tenant tenant-wide, for when a developer wants a clean slate. **Not** invoked by the entrypoint; manual only. Its existence makes the targeted cleanup in `seed-demo.ts` defensible — destructive ops are opt-in.

### Step 2 — Constants + helpers + Martin existence guarantee
- Add `MARTIN_USER_ID = "23395bc9-b500-4fa7-a6ce-f1dc7c9c6363"` next to existing `ADMIN_USER_ID` / `DEV_USER_ID`.
- **(Codex round 1, critical; refined by Gemini round 2) — Resolve Martin by email first, then upsert.** `seed.ts` only seeds `admin@symbio.local`; on a fresh DB without prior Google sign-in, Martin's User row doesn't exist and the TeamspaceMember inserts will FK-fail. Hardcoding a UUID (`23395bc9-…6363`) also risks split-brain if Supabase ever issues Martin a different auth UUID. Resolution order:
  1. Look up Martin by `(tenantId, email)`.
  2. If found, use that real ID for all teamspace memberships (it's the Supabase-managed one, source of truth).
  3. If not found, fall back to upserting with `MARTIN_USER_ID = "23395bc9-…6363"` (his current Supabase auth UUID, captured during the 2026-04-30 sign-in).

  ```ts
  const MARTIN_FALLBACK_ID = "23395bc9-b500-4fa7-a6ce-f1dc7c9c6363";
  const MARTIN_EMAIL = "martin.priessner@gmail.com";

  let martin = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: TENANT_ID, email: MARTIN_EMAIL } },
    select: { id: true },
  });
  if (!martin) {
    martin = await prisma.user.create({
      data: {
        id: MARTIN_FALLBACK_ID,
        tenantId: TENANT_ID,
        email: MARTIN_EMAIL,
        name: "Martin Priessner",
        role: "ADMIN",
      },
      select: { id: true },
    });
  }
  const MARTIN_USER_ID = martin.id;

  await prisma.tenantMember.upsert({
    where: { userId_tenantId: { userId: MARTIN_USER_ID, tenantId: TENANT_ID } },
    update: {},
    create: { userId: MARTIN_USER_ID, tenantId: TENANT_ID, role: "owner" },
  });
  ```
  This trades the simple `upsert(where: { id })` shape for a lookup-by-natural-key, which is more robust to Supabase-side ID changes.

- **(Codex round 1, critical) — Block model is page-level TipTap document, NOT one row per heading/paragraph.** The editor (`src/components/editor/BlockEditor.tsx`) loads exactly one `Block` row per page where `type = BlockType.DOCUMENT` and `content` is a complete TipTap JSON tree containing all headings, paragraphs, lists, callouts, and wikilinks. Separate `BlockType.HEADING_1` / `BlockType.PARAGRAPH` / `BlockType.CALLOUT` rows would not render under the current editor path. Drop the original plan to emit one Block per visual element. **New rule:** every seeded page gets exactly one Block of type `DOCUMENT`, position 0, with `content = doc(...)` — the existing `doc()` helper in seed-demo.ts is already correct. The block taxonomy below describes the *internal* TipTap nodes, not separate Block rows.

- **(Codex round 1, critical, trickle-down) — Page-content helpers as TipTap inline/block nodes:**
  - `heading(level: 1|2|3, t: string)` → `{ type: "heading", attrs: { level }, content: [text(t)] }`. (Confirmed inline `text` is fine via existing seed helpers.)
  - `callout(emoji: string, variant: "info"|"warning"|"success"|"error", body: TiptapBlock[])` → `{ type: "callout", attrs: { emoji, variant }, content: body }`. Verified against `src/components/editor/extensions/callout.ts:19` (Codex). Use `variant: "info"` for citation banners, `variant: "warning"` for findings about gotchas, `variant: "success"` for completed-experiment markers.
  - `wikilink(targetPageId: string, displayText: string, pageName?: string)` → `{ type: "wikilink", attrs: { pageId: targetPageId, pageName: pageName ?? displayText, displayText } }`. Verified against `src/components/editor/extensions/WikilinkExtension.ts:30` (Codex). This is an inline atom node; embed it inside a `paragraph` or list `content` array.
  - Reuse existing `paragraph`, `text`, `bulletList`, `orderedList`, `taskList`, `codeBlock`, `blockquote`, `divider`, `doc`.

- **(Codex round 1, nice-to-have) — Populate `Block.plainText` for full-text search.** The DB trigger updates `search_vector` from `plain_text` on insert/update. Reuse `src/lib/search/extractPlainText.ts` (or its import from `~/.../search/`) to extract plain text from the TipTap doc and pass it as `plainText` on Block create. If the helper isn't trivially importable from a tsx-run script, fall back to a small inline tree-walker that handles `text`, `wikilink` (concat displayText + pageName), recursion into `content`. Without this, full-text search returns empty results for seeded content.

### Step 3 — UUID namespaces (fresh, non-overlapping)
- Teamspaces: `f1000000-0000-4000-a000-XXXXXXXXXXXX` (5 ids)
- Landing pages (one per teamspace): `f2000000-…` (5)
- Experiment pages: `f3000000-…` (~18)
- Finding pages: `f4000000-…` (~10)
- SOP pages: `f5000000-…` (~10)
- Reagent / Equipment notes: `f6000000-…` (~6)
- General-space pages (Welcome, Onboarding, etc): `f7000000-…` (6)
Pick stable, hand-assigned values within each block (`f3000000-…000101` for the EXP-101 page, etc) so cross-references stay readable in code.

### Step 4 — Teamspaces + Memberships
Five teamspaces with icon + slug + description:

| name | slug | icon | description |
| --- | --- | --- | --- |
| Molecular Biology | `molbio` | 🧬 | DNA/RNA workflows: extraction, mini-prep, gels, PCR, sequencing prep |
| Organic Synthesis | `orgsynth` | 🧪 | Classic organic reactions: acetylation, Grignard, esterification, recrystallization |
| Protein Biochemistry | `protein` | 🧫 | Protein quantitation, enzyme kinetics, electrophoresis, blotting |
| Cell Biology | `cellbio` | 🔬 | Cell culture, transformation, microscopy, viability |
| Analytical & Materials | `analytics` | 📈 | TLC, UV-Vis spectroscopy, melting-point characterization |

For each teamspace insert `TeamspaceMember(OWNER)` rows for `[ADMIN_USER_ID, DEV_USER_ID, MARTIN_USER_ID]`.

### Step 5 — Page taxonomy

Four content types, distinct visual+structural shapes:

**A) Teamspace landing page** (`f2000000-…`) — one per teamspace. Title matches teamspace name. The page's single DOCUMENT block content is `doc(heading(1, name), paragraph(text(intro)), heading(2, "Experiments in this space"), bulletList(...wikilink list items), heading(2, "Standard Operating Procedures"), bulletList(...), heading(2, "Findings & Learnings"), bulletList(...))`. PageLinks created from landing → all child pages.

**B) Experiment summary** (`f3000000-…`) — one per upstream experiment. Title verbatim. The DOCUMENT block content tree:
1. `callout("📋", "info", [paragraph(text("Source of truth: ExpTube EXP-2026-0101 · ChemELN ELN-101 — full procedure and AI analysis live in the linked systems."))])`
2. `heading(2, "Objective")` then a paragraph (taken from ChemELN.experiments.objective, slightly trimmed).
3. `heading(2, "Status")` then a paragraph showing upstream status (in_progress / completed / draft / active).
4. `heading(2, "Key reagents")` then bulletList items containing real chemical names from ChemELN.chemicals (Ethanol, NaOH, etc).
5. `heading(2, "Key equipment")` then bulletList of named equipment (NanoDrop One, gel rig, thermocycler, etc).
6. `heading(2, "Related SOPs")` then bulletList where each item is `paragraph(wikilink(sopId, sopTitle))`.
7. `heading(2, "Findings from this experiment")` then bulletList of wikilinks to Finding pages.
8. `heading(2, "Sibling experiments")` then bulletList of wikilinks to other Experiment pages.

**C) Finding** (`f4000000-…`) — short page (1–3 paragraphs). DOCUMENT content:
1. `callout("💡", "warning", [paragraph(text("Plasmid yield drops below 50 ng/µL when overnight culture exceeds 16h."))])`
2. paragraph: context.
3. paragraph: evidence / which experiment(s) saw it (with inline wikilinks to those experiments).
4. `heading(3, "Related findings")` + bulletList of wikilinks.

**D) SOP** (`f5000000-…`) — semi-formal procedure. DOCUMENT content:
1. `heading(2, "Purpose")` + 1 paragraph.
2. `heading(2, "Materials")` + bulletList.
3. `heading(2, "Steps")` + orderedList.
4. `heading(2, "Notes & gotchas")` + bulletList.
5. `heading(2, "Used in experiments")` + bulletList of Experiment wikilinks.

**E) Reagent / Equipment note** (`f6000000-…`) — even shorter. DOCUMENT content: 1 paragraph + `heading(3, "Quirks / calibration notes")` + bulletList. Used as link target by SOPs.

### Step 6 — Concrete content map

**Molecular Biology** (largest cluster, mirrors live ExpTube workflow):
- Landing page: "🧬 Molecular Biology"
- Experiments (6, mirror EXP-2026-0101..0106 + ELN-101..106):
  1. "Genomic DNA Extraction - Bacterial Pellet Series" (EXP-101 / ELN-101)
  2. "Plasmid DNA Mini Prep Series" (EXP-102 / ELN-102)
  3. "Agarose Gel Preparation - 1% TAE" (EXP-103 / ELN-103)
  4. "Gel Electrophoresis - DNA Quality Check" (EXP-104 / ELN-104)
  5. "Gel Electrophoresis - PCR Verification" (EXP-105 / ELN-105)
  6. "DNA Purification - PCR Cleanup Series" (EXP-106 / ELN-106)
- SOPs (4, each linked from ≥2 experiments):
  - "SOP: Mini-prep — alkaline lysis (Birnboim/Doly)" (linked from 0102, 0106)
  - "SOP: Casting a 1% agarose TAE gel" (linked from 0103, 0104, 0105)
  - "SOP: NanoDrop quantification of nucleic acids" (linked from 0101, 0102, 0106)
  - "SOP: Sample loading and electrophoresis at 100 V" (linked from 0104, 0105)
- Findings (4):
  - "Plasmid yield drops sharply past 16 h overnight culture" (links 0102 + SOP mini-prep)
  - "1% TAE resolves 0.5–10 kb cleanly; switch to TBE for >10 kb" (links 0103/0104/0105 + gel SOP)
  - "260/280 ratio <1.8 from bacterial pellets indicates carry-over RNA" (links 0101/0102 + NanoDrop SOP)
  - "PCR cleanup recovery is 60–75% with silica spin columns; expect loss" (links 0106)
- Reagent / Equipment notes (3):
  - "TAE 50× stock — recipe and shelf life"
  - "NanoDrop One — quirks and calibration"
  - "Gel rig — Bio-Rad Sub-Cell GT — known issues"

**Organic Synthesis** (medium): Landing + 4 Experiments (Aspirin / Grignard triphenylmethanol / Recrystallization of benzoic acid / Fischer esterification of ethyl acetate) + 2 SOPs (Recrystallization, Reflux setup) + 2 Findings (Aspirin yield decreases with old salicylic acid; Anhydrous conditions critical for Grignard) + 1 Reagent note (Sulfuric acid — handling).

**Protein Biochemistry** (medium): Landing + 4 Experiments (Bradford assay / Lactase kinetics / SDS-PAGE / Western blot GAPDH) + 2 SOPs (Bradford standard curve, SDS-PAGE casting) + 2 Findings (Bradford reads non-linear above ~1 mg/mL; Lane warping in 12% gels at high V).

**Cell Biology** (small): Landing + 3 Experiments (Strawberry DNA / Plasmolysis / pGLO transformation) + 1 SOP (Heat-shock transformation) + 1 Finding (pGLO transformation efficiency drops if competent cells thawed twice).

**Analytical & Materials** (small): Landing + 3 Experiments (TLC plant pigments / UV-Vis Beer-Lambert / Melting point of unknowns) + 1 SOP (TLC plate spotting + development).

**General space** (no teamspace, top-level): Welcome / Onboarding Guide / Database Access Instructions (ChemELN + ExpTube URLs + auth notes) / Equipment Operation Manuals (parent for the Reagent/Equipment notes via wikilinks) / Safety Protocols & Compliance / Organization Policies & Instructions.

### Step 7 — PageLink generation
Two passes:
- **Structural links** (landing → child experiment / SOP / finding) — emitted at page-creation time.
- **Cross-cluster links** (experiment ↔ SOP, finding ↔ experiment, finding ↔ finding) — emitted from a small `LINK_GRAPH` array near the bottom of the file. One source of truth, easy to audit during review.

Use `prisma.pageLink.createMany({ data: [...], skipDuplicates: true })` to insert in one shot. `PageLink` has `@@unique([sourcePageId, targetPageId])` so `skipDuplicates: true` covers idempotency on re-run.

### Step 8 — Embedded databases — Findings hybrid

**(Gemini round 2) — Adopt the hybrid Findings approach.** Drop the existing `bug_tracker` and `feature_requests` databases. Add **one new Database**: "Findings Index" — its rows mirror the Finding pages 1-to-1 via the optional `DbRow.pageId` link.

- Create one `Database` row attached to a "Findings Index" Page (parent: general space, top level). Its `schema` (jsonb) defines columns: `status` (open / validated / archived), `topic` (yield / ratio / instrument / contamination / efficiency / etc — pick a small fixed vocab), `source_experiment` (text — the EXP-XXXX-XXXX id), `severity` (info / warning / critical).
- For each Finding page, insert a `DbRow` with the page id in `pageId` and a `properties` jsonb populated from the same data used to seed the page.
- This gives both views: graph (via PageLinks between Finding pages and their Experiment pages) AND tabular (via the Findings Index database for sort/filter).
- The Findings Index page itself appears in the sidebar; the per-Finding pages remain navigable from the Experiment pages.

**(Gemini round 2, considered and rejected for v1) — DocumentSubscription for cross-system links.** SKB has a `DocumentSubscription` model with `sourceType` ∈ {URL, PAGE, MACHINE_PROTOCOL} that could programmatically link Experiment pages to ExpTube/ChemELN URLs. Considered, but **deferring** to a follow-up story because: (a) the Subscription system is wired for sync/notify/mirror behaviors that aren't desired for read-only seed citations; (b) there's no current downstream consumer that follows those subscriptions in the lab-page UI; (c) v1 callouts with text IDs are searchable and good enough. Revisit when SKB grows a "show me linked external documents" feature.

### Step 8.5 — Pre-bake agent state (NEW — Gemini round 2)

**`src/lib/sweep/pageSelection.ts:115` orders by `lastAgentVisitAt ASC`** — meaning fresh pages with `lastAgentVisitAt = null` go to the front of the sweep queue, triggering an AI compute spike for ~50 pages on every reseed. The page-summary route at `src/app/api/agent/pages/route.ts:174` flags pages for re-summarization when `updatedAt > summaryUpdatedAt` or when `summaryUpdatedAt` is null. To prevent this storm:

For every seeded Page, set:
- `oneLiner` — populated (already in plan)
- `summary` — populated with a short (~200-char) human-written summary describing what the page is and what it covers
- `summaryUpdatedAt: new Date()` — same instant as the implicit `updatedAt`
- `lastAgentVisitAt: new Date()` — tells the sweep service "agent has already looked at this"

Net effect: seeded pages get same-`now()` for `updatedAt` and `summaryUpdatedAt` so the agent skips them, and they sort to the back of the sweep queue (most-recently-visited). Real human-edited pages will still surface because their `updatedAt` will exceed `summaryUpdatedAt`.

### Step 9 — Validation block
After all inserts, run and log:
- `prisma.page.count({ where: { tenantId } })`
- `prisma.block.count({ where: { tenantId } })`
- `prisma.pageLink.count({ where: { tenantId } })`
- `prisma.teamspace.count({ where: { tenantId } })`
- `prisma.teamspaceMember.count({ where: { teamspace: { tenantId } } })`
- `prisma.notification.count({ where: { tenantId, pageId: null } })` (Codex round 1, nice-to-have — track orphans)
- `prisma.fileAttachment.count({ where: { tenantId, pageId: null } })`
Compare pages/links against expected (~50 / ~180 / 5 / ~15 memberships) and `console.warn` if any are zero — early-warning that the seed broke without erroring. Log orphan-notification + orphan-file counts as `console.info` (not warn) — they're a known consequence of the wipe and a future story can decide whether to clean them.

### Step 10 — Documentation touch-up
Update the comment header at the top of `prisma/seed-demo.ts` to describe the new content shape. Update the auto-comment in the bottom of the file noting that teamspace ACL details are still TODO.

### Step 11 — Add `npm run reset-demo` (Gemini round 2)

In `package.json`, add a script:
```json
"reset-demo": "tsx prisma/reset-demo.ts"
```
The script body wipes everything in `TENANT_ID` (the original Step 1 logic from the draft pre-Gemini), used for "I want a clean slate" moments. **Not** part of the auto-seed path. Document in the file header that this is destructive and tenant-wide.

## Risks & Open Questions

- ~~**Editor block-shape uncertainty.**~~ Resolved by Codex round 1: callout shape is `{ type: "callout", attrs: { emoji, variant: "info"|"warning"|"success"|"error" }, content: [...] }` (`src/components/editor/extensions/callout.ts:19`), wikilink shape is `{ type: "wikilink", attrs: { pageId, pageName, displayText } }` (`src/components/editor/extensions/WikilinkExtension.ts:30`). One DOCUMENT block per page (`src/components/editor/BlockEditor.tsx:42`).
- ~~**Wipe surface area.**~~ Resolved by Gemini round 2: the auto-seed path now does only **targeted** old-namespace cleanup (won't touch user-created pages), and the tenant-wide wipe lives in `prisma/reset-demo.ts`, run only manually via `npm run reset-demo`. Container restarts are now safe.
- ~~**Findings as pages vs DbRows.**~~ Resolved by Gemini round 2: hybrid — every Finding is both a Page (for graph edges) and a DbRow in a "Findings Index" Database (for sort/filter). The DbRow's optional `pageId` link is the join. Step 8.
- **No persona realism.** No fabricated researcher accounts. All content lives in the existing `martin / admin / dev` user pool. If reviewers think this hurts the demo, I can add 2 stub User rows (e.g. `alice@symbio.local`, `ben@symbio.local`) and rotate them as TeamspaceMembers — but Page/Block have no createdBy field, so this only affects member chips, not authorship of content.
- **DEV_USER_ID `dev-user` is not a UUID.** The existing seed seeds it as a hard-coded string. If `prisma.user.upsert({ where: { id: 'dev-user' }})` keeps working (it does today), no change. Worth a sanity check during implementation that adding Martin doesn't trip a unique constraint on `(tenantId, email)` — Martin already exists post-Google-signin, so we should `findFirst` rather than `upsert` him to avoid clobbering his real Supabase-managed `id`.
- **`src/generated/prisma` enums.** The seed currently imports `BlockType, SpaceType, TeamspaceRole`. New helpers may need additional enum values; verify they're exported.
- **Schema drift (carryover from 2026-04-30).** `prisma/schema.prisma` had drift vs. the migrations folder; we resolved it with `prisma db push` rather than generating a real migration. If a fresh dev sets up SKB from scratch, they'll hit the same broken seed. **Out of scope here**, but worth noting that this story assumes the developer running the seed has either a synced DB (post `db push`) or generates the missing migration.
- **Content authorship by the AI.** I'm fabricating ~10 lab "findings" and ~10 SOPs from general chemistry knowledge. They will read plausibly to a non-expert and acceptably to a domain expert, but they are **not** validated lab procedures — the demo should never be confused with executable protocols. The CALLOUT on every Experiment page makes clear "source of truth lives in ExpTube/ChemELN".

- **(Gemini round 2) — Split-brain Martin if Supabase auth UUIDs ever change.** The plan looks Martin up by `(tenantId, email)` first, falling back to `MARTIN_FALLBACK_ID = 23395bc9-…6363` only if not found. So the seeded membership always points at whichever ID Supabase considers canonical *at seed time*. Risk remains if (a) ExpTube's Supabase auth DB is wiped between seed runs (Martin gets re-issued a new UUID on next sign-in, the seed-time membership becomes orphaned), or (b) a separate Martin row is somehow created with a different ID. Mitigation: re-running the seed after such an event re-resolves to the current canonical ID. Worth a single sentence in the seed comment explaining the lookup order.

- **(Gemini round 2) — Taxonomy fragmentation across the ecosystem.** SKB's 5 teamspaces don't 1-to-1 mirror ExpTube channels (Demo / Chemistry Lab / Biology Research / Physics / General Science / Student Projects) or ChemELN projects (Organic Synthesis / Protein Biochem / Cell Biology / Materials / Teaching Demos). Three-way mismatch is real. **Decision (deliberate):** SKB's teamspaces match ChemELN's projects 4-of-5 (Organic Synthesis, Protein Biochemistry, Cell Biology, Analytical & Materials), with **Molecular Biology** added because the live ExpTube workflow EXP-2026-0101..0106 (DNA / plasmid / gels / PCR) doesn't fit cleanly under any existing ChemELN project. Once ChemELN gains a "Molecular Biology" project (or these experiments get re-classified into Cell Biology), align then. Don't try to mirror ExpTube channels — those are video-content workspaces, not research-area workspaces.

- **(Gemini round 2) — Edge density target of ~180 PageLinks across ~50 pages = ~3.6 edges/page.** This is the user-confirmed "medium density" target. Whether that produces visually meaningful clusters or noise depends on the graph view's force-directed layout and zoom defaults. Verify visually after first run; adjust the LINK_GRAPH array if the result is too dense or too sparse. Not blocking for v1.

## Out of Scope

- Schema changes (`prisma/schema.prisma` untouched; no new models).
- A "Findings Database" — deferred until after first knowledge-graph review confirms whether pages-as-findings reads well in graph view.
- Cross-system foreign keys to ExpTube/ChemELN (the current cross-system citations are textual, not relational).
- File attachments / images / cover URLs on the new pages.
- Any change to `seed.ts` (the basic seed); only `seed-demo.ts` is rewritten.
- Any change to the docker entrypoint or to migration generation.
- Permissions / RLS / per-page sharing UX — deferred until SKB has a story for ACL.
- A real-content extraction pipeline that pulls the merged_narrative / report_markdown from `experiment_analysis` into SKB pages — out of scope; the seed uses static content keyed off the experiment titles/objectives.

## Reviewer Feedback

### Codex (round 1) — implementation lens
*Verbatim, lightly trimmed for length:*

> 1. Wipe order / FK constraints: the proposed order should not hit FK blockers for the named Page dependents. `Block`, `PageLink`, `PublicShareLink`, `PagePresence`, `DocumentVersion`, `DocumentSubscription`, `PageFavorite`, and `PageShare` all cascade from `Page`; `Notification`, `DbRow`, and `FileAttachment` set their `pageId` to null. The explicit `dbRow -> database -> pageLink -> block -> page` order is safe, just more explicit than necessary.
>
> 2. `prisma.$transaction([...])` with an array does run the operations in one DB transaction, not independent autocommit calls. For this wipe, array transaction is fine because no step depends on returned values from earlier steps.
>
> 3. `Block.searchVector Unsupported("tsvector")` does not block inserts as long as the seed does not try to write `searchVector`. The DB trigger populates it from `plain_text` on insert/update. The real gap is making sure every inserted `DOCUMENT` block has `plainText`; otherwise full-text search will be empty.
>
> 4. Wikilink shape is known. The inline node is `type: "wikilink"` with attrs `{ pageId, pageName, displayText }`; it is inline, atom, selectable. (`src/components/editor/extensions/WikilinkExtension.ts:30`)
>
> 5. CALLOUT shape is also known. The renderer expects a TipTap node `{ type: "callout", attrs: { emoji, variant }, content: [block...] }`, where `variant` is one of `info | warning | success | error`. (`src/components/editor/extensions/callout.ts:19`) Do not use `BlockType.CALLOUT` rows for page content; the app loads one `BlockType.DOCUMENT` block and renders TipTap JSON from its `content`. (`src/components/editor/BlockEditor.tsx:42`)
>
> 6. `npx prisma db seed` will still pick up a rewritten `prisma/seed-demo.ts` because `prisma.config.ts:10` runs `npx tsx prisma/seed.ts && npx tsx prisma/seed-demo.ts`.
>
> 7. No RLS policies in `prisma/` or `src/`. Inserts should not be silently rejected.
>
> 8. `pageLink.createMany({ skipDuplicates: true })` is already used in this codebase with PostgreSQL; safe at Prisma 7.4.1. (`src/lib/wikilinks/indexer.ts:64`)
>
> 9. `dev-user` being non-UUID is not a problem; FK columns are `String`, not Prisma UUID.
>
> 10. **Biggest missing dependency: Martin may not exist in a fresh DB.** `seed.ts` only creates admin; `seed-demo.ts` creates `dev-user`. If the target DB has not already seen Martin via Google sign-in, `TeamspaceMember` inserts for `23395bc9-…6363` will fail on the User FK.
>
> 11. The plan's "idempotent via fixed UUIDs and upsert" conflicts with "wipe-and-reseed." It can be idempotent in counts/content, but not a no-op: it will delete and recreate rows, changing default `createdAt` values unless those are fixed too.
>
> **Critical issues:** Martin user existence is assumed but not guaranteed; "Bit-for-bit idempotent" is false with wipe-and-reseed unless timestamps are fixed; seed content must be one `BlockType.DOCUMENT` block per page with TipTap JSON, not separate `HEADING_*`/`CALLOUT` rows.
>
> **Nice-to-have:** Use the known wikilink and callout node shapes; keep setting `plainText` on every block; add a validation count for orphaned/nullified rows; clarify that `$transaction([...])` is one transaction but sequential array operations.

### Gemini round 2 — architectural lens
*Verbatim:*

> **Architectural concerns:**
>
> 1. **Destructive Auto-Seed on Container Restart:** `docker-entrypoint.sh` runs `prisma db seed` on every startup. If `seed-demo.ts` implements a `tenantId`-scoped wipe-and-reseed (Step 1), any user-generated content in the default workspace will be irreversibly destroyed every time the container is restarted. This breaks the local development loop and ruins any persistent state a user might build up during a demo session.
>
> 2. **Auth Bridge & Hardcoded User ID Conflict:** The script proposes upserting Martin using a hardcoded UUID (`23395bc9-…6363`). However, if the user signs in via the ExpTube Google auth bridge after this seed has run, Supabase Auth will likely generate a completely different UUID for that Google identity. This will result in a split-brain scenario: a "seeded Martin" who owns all the Teamspaces, and a "real Martin" who just logged in, has a different ID, and sees an empty workspace because he lacks the `TeamspaceMember(OWNER)` records tied to the seeded UUID.
>
> 3. **Orphaned File/Notification Bloat and Storage Quotas:** The plan explicitly acknowledges that `FileAttachment.pageId` and `Notification.pageId` will be set to `NULL` rather than deleted. If the seed runs multiple times, the database will fill up with orphaned records. Worse, `Tenant.storageUsed` (which tracks `FileAttachment.fileSize`) will not be freed, causing a storage quota leak that will eventually lock the tenant out of uploading new files.
>
> 4. **Agent Compute Spikes (Epic 32+):** The schema contains `Page.summary`, `lastAgentVisitAt`, and `SweepSession` models. The plan notes that timestamps will refresh on reseed. If the SKB background agent looks for pages with `updatedAt > lastAgentVisitAt` or missing summaries, the wipe-and-reseed will trigger a massive, redundant AI-compute spike to regenerate summaries for the 50 seeded pages on every single container restart.
>
> 5. **Taxonomy Fragmentation:** The proposed 5 teamspaces (Molecular Biology, Organic Synthesis, etc.) do not align exactly with ExpTube's channels or ChemELN's projects. By imposing a third distinct taxonomy in SKB, we create cognitive load for the user and complicate future cross-system RBAC syncing. If these apps are an ecosystem, their top-level organizational boundaries should ideally map 1-to-1.
>
> 6. **Fragile Cross-System Citations:** Relying on plain-text citations (e.g., `EXP-2026-0101` in a TipTap callout node) is fragile. If the upstream ChemELN or ExpTube record is renamed or archived, SKB has no programmatic way to detect the broken link. Given that SKB has a `DocumentSubscription` model designed to mirror external `sourceUrl`s, treating upstream databases as plain text ignores existing infrastructure meant for integration.
>
> 7. **The Findings Data-Structure Trap:** By modeling Findings purely as `Page`s to get `PageLink` graph edges, you sacrifice tabular sortability and filterability. If the product roadmap intends for Findings to be query-able (e.g., "Show me all findings related to 'yield'"), a pure TipTap document is highly opaque compared to a Notion-style database.
>
> **Alternatives worth considering:**
>
> - **Move the Wipe to a Manual Script:** Decouple the destructive wipe-and-reseed from the `prisma db seed` auto-run. Move it to a distinct `npm run reset-demo` script. Let the auto-seed be purely additive (or a true no-op if data exists) to protect user state across container restarts.
> - **Lookup User by Email:** Instead of upserting by a hardcoded UUID, query the DB for `martin.priessner@gmail.com`. If he exists, use his real ID for the `TeamspaceMember` inserts.
> - **Hybrid "Page + DbRow" for Findings:** SKB's schema allows a `DbRow` to optionally link to a `pageId`. You can create a "Findings" `Database`, insert `DbRow`s with structured properties (status, tags, source), and link each row to a `Page`. This gives you both filterable tables and `PageLink` graph edges.
> - **Pre-bake Agent Summaries:** To avoid AI compute spikes, the seed script should populate `Page.summary` and set `lastAgentVisitAt` to a future date or `now()`, effectively telling the sweep service that these seeded pages do not need immediate processing.
> - **Explicit Cleanup of Nullified Rows:** In Step 1, explicitly `deleteMany` on `FileAttachment` and `Notification` where `tenantId = TENANT_ID` to prevent quota leaks and table bloat.
> - **Use DocumentSubscriptions for Cross-System Links:** Instead of just a text callout, create a `DocumentSubscription` for each Experiment page with `sourceType = MACHINE_PROTOCOL` or `URL`, pointing directly to the ExpTube/ChemELN API/URL. This establishes a real relational tie.

## Revision History
- 2026-05-06 — Initial draft.
- 2026-05-06 — Codex round 1 revisions: (a) flipped Block strategy to one DOCUMENT-typed Block per page holding a TipTap JSON tree (was: one Block per visual element); (b) added explicit `User.upsert` + `TenantMember.upsert` for Martin at the top of `main()` to remove FK-fail risk on a fresh DB; (c) softened bit-for-bit idempotency AC to content-idempotency; (d) replaced "uncertain" callout/wikilink helper specs with the verified TipTap node shapes; (e) added `plainText` extraction to Block creates so search index populates; (f) extended Step 9 validation block with orphan-notification / orphan-file counts; (g) clarified `$transaction([...])` semantics in Step 1.
- 2026-05-06 — Gemini round 2 revisions: (a) replaced tenant-wide wipe with **targeted old-namespace cleanup** in `seed-demo.ts` so container restarts no longer destroy user content; (b) added separate `prisma/reset-demo.ts` script + `npm run reset-demo` for manual nuclear option (Step 11); (c) Martin lookup now goes by email first, falling back to UUID — closes split-brain risk; (d) adopted **hybrid Findings**: each Finding is both a Page and a DbRow in a "Findings Index" Database (Step 8); (e) added Step 8.5 to pre-bake `summary`, `summaryUpdatedAt`, and `lastAgentVisitAt = now()` on every seeded page so the sweep service skips them; (f) explicit `FileAttachment` + `Notification` cleanup tied to old page ids, plus `Tenant.storageUsed` decrement, to prevent quota leak; (g) deferred DocumentSubscription cross-system links to a follow-up story (with rationale); (h) documented the deliberate ChemELN-aligned-with-one-extension teamspace taxonomy and edge-density target.
- 2026-05-06 — **Implemented.** Wrote new `prisma/seed-demo.ts` (≈1200 lines) and new `prisma/reset-demo.ts`; added `"reset-demo"` script to `package.json`. First in-container run produced: 56 pages, 56 blocks (one DOCUMENT per page), 171 PageLinks (deduped from 184 builder edges), 5 teamspaces, 15 teamspace memberships (3 users × 5 teamspaces), 1 Findings Index Database with 9 rows, 0 orphan notifications, 0 orphan file attachments. Two implementation bugs caught and fixed mid-run: (1) initial block-id derivation `"f8…" + p.id.slice(-12)` collided across page namespaces because last-12-char suffixes repeat (LP.molbio and E.exp101 both end `000000000001`); fixed by deriving block id as `"a" + p.id.slice(1)` to preserve the namespace byte. (2) `seed.ts` (basic seed, run by docker entrypoint before us) creates a Welcome page at `00000000-…0010` with 6 blocks that fell outside the OLD_PAGE_PREFIX cleanup; added explicit cleanup for that exact id. Block-content shape verified by inspecting `pages.f3000000-…0001` (EXP-101 Genomic DNA Extraction) — TipTap doc with `callout` (correct emoji + variant attrs), `heading` with level attrs, `paragraph`, `bulletList`, and inline `wikilink` nodes; `Block.plainText` correctly includes wikilink display texts so the FTS index will populate.
