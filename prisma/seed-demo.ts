/**
 * SKB experimental knowledge-graph seed.
 *
 * Replaces the previous SaaS-style demo (Roadmap / Bug Tracker / Sprint Notes /
 * etc) with a research-lab content set that mirrors the experiments living in
 * the local ExpTube and ChemELN databases. Designed so that opening SKB after a
 * fresh install shows a meaningful, interconnected demo for the actual
 * intended user — a chemistry/biology research org.
 *
 * Strategy:
 *   1. Targeted cleanup of the OLD seed namespace only (`d0000000-…` pages /
 *      `e0000000-…` teamspaces / `d1000000-…` databases). User-created content
 *      under any other UUID is left alone, so re-running on container restart
 *      is safe.
 *   2. Resolve `martin.priessner@gmail.com` by email; fall back to the
 *      Supabase-issued UUID `23395bc9-…6363` if not present. Avoids a
 *      split-brain Martin if Supabase ever re-issues IDs.
 *   3. Each page is one `BlockType.DOCUMENT` block holding a TipTap JSON tree
 *      with verified node shapes (`callout`, `wikilink`) — separate `H1` /
 *      `PARAGRAPH` / `CALLOUT` block rows would not render under
 *      `src/components/editor/BlockEditor.tsx`.
 *   4. Pre-bake `summary` + `summaryUpdatedAt` + `lastAgentVisitAt = now()` so
 *      the sweep service (`src/lib/sweep/pageSelection.ts`) doesn't trigger an
 *      AI re-compute storm on every reseed.
 *   5. Findings hybrid: every Finding is both a Page (for graph edges) AND a
 *      DbRow in a "Findings Index" Database (for sort/filter).
 *
 * For a tenant-wide nuke, use `npm run reset-demo` (separate script).
 *
 * See `docs/stories/2026-05-06-skb-experimental-knowledge-graph-seed.md`.
 */
import "dotenv/config";
import {
  PrismaClient,
  BlockType,
  SpaceType,
  TeamspaceRole,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Tenant + user constants ──────────────────────────────────────────
const TENANT_ID = "00000000-0000-4000-a000-000000000001";
const ADMIN_USER_ID = "00000000-0000-4000-a000-000000000002";
const DEV_USER_ID = "dev-user";
const MARTIN_FALLBACK_ID = "23395bc9-b500-4fa7-a6ce-f1dc7c9c6363";
const MARTIN_EMAIL = "martin.priessner@gmail.com";

// ── Old-namespace prefixes (cleanup targets) ─────────────────────────
const OLD_PAGE_PREFIX = "d0000000-0000-4000-a000-";
const OLD_TEAMSPACE_PREFIX = "e0000000-0000-4000-a000-";
const OLD_DATABASE_PREFIX = "d1000000-0000-4000-a000-";
// seed.ts (basic seed) creates this Welcome page on every container start.
// Functionally duplicated by our new Welcome page (G.welcome), so remove it.
const SEED_TS_WELCOME_PAGE_ID = "00000000-0000-4000-a000-000000000010";

// ── New UUID namespaces (fresh, non-overlapping) ─────────────────────
const TS = {
  molbio: "f1000000-0000-4000-a000-000000000001",
  orgsynth: "f1000000-0000-4000-a000-000000000002",
  protein: "f1000000-0000-4000-a000-000000000003",
  cellbio: "f1000000-0000-4000-a000-000000000004",
  analytics: "f1000000-0000-4000-a000-000000000005",
};

// Landing pages, one per teamspace.
const LP = {
  molbio: "f2000000-0000-4000-a000-000000000001",
  orgsynth: "f2000000-0000-4000-a000-000000000002",
  protein: "f2000000-0000-4000-a000-000000000003",
  cellbio: "f2000000-0000-4000-a000-000000000004",
  analytics: "f2000000-0000-4000-a000-000000000005",
};

// Experiment pages — slug → uuid.
const E = {
  // Molecular Biology — mirrors live ExpTube EXP-2026-0101..0106 + ChemELN ELN-101..106
  exp101: "f3000000-0000-4000-a000-000000000001", // Genomic DNA Extraction
  exp102: "f3000000-0000-4000-a000-000000000002", // Plasmid Mini Prep
  exp103: "f3000000-0000-4000-a000-000000000003", // Agarose Gel Preparation
  exp104: "f3000000-0000-4000-a000-000000000004", // DNA Quality Check Gel
  exp105: "f3000000-0000-4000-a000-000000000005", // PCR Verification Gel
  exp106: "f3000000-0000-4000-a000-000000000006", // DNA Purification (PCR Cleanup)
  // Organic Synthesis
  expAspirin:    "f3000000-0000-4000-a000-000000000007",
  expGrignard:   "f3000000-0000-4000-a000-000000000008",
  expRecrystal:  "f3000000-0000-4000-a000-000000000009",
  expFischer:    "f3000000-0000-4000-a000-00000000000a",
  // Protein Biochemistry
  expBradford:   "f3000000-0000-4000-a000-00000000000b",
  expLactase:    "f3000000-0000-4000-a000-00000000000c",
  expSdspage:    "f3000000-0000-4000-a000-00000000000d",
  expWestern:    "f3000000-0000-4000-a000-00000000000e",
  // Cell Biology
  expStrawberry: "f3000000-0000-4000-a000-00000000000f",
  expPlasmolysis:"f3000000-0000-4000-a000-000000000010",
  expPglo:       "f3000000-0000-4000-a000-000000000011",
  // Analytical & Materials
  expTlc:        "f3000000-0000-4000-a000-000000000012",
  expUvVis:      "f3000000-0000-4000-a000-000000000013",
  expMeltPoint:  "f3000000-0000-4000-a000-000000000014",
};

// Findings.
const F = {
  findPlasmidYield:    "f4000000-0000-4000-a000-000000000001",
  findGelResolution:   "f4000000-0000-4000-a000-000000000002",
  find260280:          "f4000000-0000-4000-a000-000000000003",
  findPcrCleanup:      "f4000000-0000-4000-a000-000000000004",
  findAspirinYield:    "f4000000-0000-4000-a000-000000000005",
  findGrignardAnhydrous:"f4000000-0000-4000-a000-000000000006",
  findBradfordRange:   "f4000000-0000-4000-a000-000000000007",
  findGelLaneWarp:     "f4000000-0000-4000-a000-000000000008",
  findPgloThaw:        "f4000000-0000-4000-a000-000000000009",
};

// SOPs.
const S = {
  sopMiniprep:         "f5000000-0000-4000-a000-000000000001",
  sopAgaroseGel:       "f5000000-0000-4000-a000-000000000002",
  sopNanoDrop:         "f5000000-0000-4000-a000-000000000003",
  sopElectrophoresis:  "f5000000-0000-4000-a000-000000000004",
  sopRecrystal:        "f5000000-0000-4000-a000-000000000005",
  sopReflux:           "f5000000-0000-4000-a000-000000000006",
  sopBradford:         "f5000000-0000-4000-a000-000000000007",
  sopSdsPage:          "f5000000-0000-4000-a000-000000000008",
  sopHeatShock:        "f5000000-0000-4000-a000-000000000009",
  sopTlcPlate:         "f5000000-0000-4000-a000-00000000000a",
};

// Reagent / Equipment notes.
const R = {
  regTaeStock:    "f6000000-0000-4000-a000-000000000001",
  regNanoDrop:    "f6000000-0000-4000-a000-000000000002",
  regGelRig:      "f6000000-0000-4000-a000-000000000003",
  regSulfuric:    "f6000000-0000-4000-a000-000000000004",
  regCompCells:   "f6000000-0000-4000-a000-000000000005",
};

// General-space pages (top-level, no teamspace).
const G = {
  welcome:        "f7000000-0000-4000-a000-000000000001",
  onboarding:     "f7000000-0000-4000-a000-000000000002",
  dbAccess:       "f7000000-0000-4000-a000-000000000003",
  equipManuals:   "f7000000-0000-4000-a000-000000000004",
  safety:         "f7000000-0000-4000-a000-000000000005",
  orgPolicies:    "f7000000-0000-4000-a000-000000000006",
  findingsIndex:  "f7000000-0000-4000-a000-000000000007",
};

// Findings Index database (one row per Finding page).
const FINDINGS_DB_ID = "f1100000-0000-4000-a000-000000000001";

// ── TipTap node helpers ──────────────────────────────────────────────
type TipTapNode = Record<string, unknown>;

function text(t: string): TipTapNode {
  return { type: "text", text: t };
}
function paragraph(...content: TipTapNode[]): TipTapNode {
  return { type: "paragraph", content };
}
function heading(level: 1 | 2 | 3, t: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: [text(t)] };
}
function bulletList(...items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((s) => ({
      type: "listItem",
      content: [paragraph(text(s))],
    })),
  };
}
function bulletListNodes(...items: TipTapNode[][]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((inline) => ({
      type: "listItem",
      content: [paragraph(...inline)],
    })),
  };
}
function orderedList(...items: string[]): TipTapNode {
  return {
    type: "orderedList",
    content: items.map((s) => ({
      type: "listItem",
      content: [paragraph(text(s))],
    })),
  };
}
function callout(
  emoji: string,
  variant: "info" | "warning" | "success" | "error",
  ...content: TipTapNode[]
): TipTapNode {
  return { type: "callout", attrs: { emoji, variant }, content };
}
function wikilink(pageId: string, displayText: string, pageName?: string): TipTapNode {
  return {
    type: "wikilink",
    attrs: { pageId, pageName: pageName ?? displayText, displayText },
  };
}
function doc(...content: TipTapNode[]): TipTapNode {
  return { type: "doc", content };
}

// Plain-text extraction for Block.plainText (so search index populates).
function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (n.type === "wikilink") {
    const a = (n.attrs ?? {}) as Record<string, unknown>;
    return String(a.displayText ?? a.pageName ?? "");
  }
  const c = n.content;
  if (Array.isArray(c)) return c.map(extractPlainText).join(" ");
  return "";
}

// ── Page / Block / Link / Database accumulators ──────────────────────
type PageSpec = {
  id: string;
  title: string;
  icon: string;
  parentId?: string | null;
  teamspaceId?: string | null;
  spaceType: SpaceType;
  position: number;
  oneLiner: string;
  summary: string;
  content: TipTapNode;
};

const pages: PageSpec[] = [];
const links: Array<{ source: string; target: string }> = [];
function link(source: string, target: string) {
  if (source === target) return;
  links.push({ source, target });
}

// ── Page builders ────────────────────────────────────────────────────
function landingPage(args: {
  id: string;
  teamspaceId: string;
  title: string;
  icon: string;
  intro: string;
  experiments: Array<{ id: string; title: string }>;
  sops: Array<{ id: string; title: string }>;
  findings: Array<{ id: string; title: string }>;
}): PageSpec {
  const expList = bulletListNodes(
    ...args.experiments.map((e) => [wikilink(e.id, e.title)] as TipTapNode[]),
  );
  const sopList = bulletListNodes(
    ...args.sops.map((s) => [wikilink(s.id, s.title)] as TipTapNode[]),
  );
  const findList = bulletListNodes(
    ...args.findings.map((f) => [wikilink(f.id, f.title)] as TipTapNode[]),
  );
  const content = doc(
    heading(1, args.title),
    paragraph(text(args.intro)),
    heading(2, "Experiments in this space"),
    expList,
    heading(2, "Standard Operating Procedures"),
    sopList,
    heading(2, "Findings & Learnings"),
    findList,
  );
  // Edges from the landing page to every child.
  for (const e of args.experiments) link(args.id, e.id);
  for (const s of args.sops) link(args.id, s.id);
  for (const f of args.findings) link(args.id, f.id);
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: args.teamspaceId,
    spaceType: SpaceType.TEAM,
    position: 0,
    oneLiner: args.intro.slice(0, 140),
    summary: args.intro,
    content,
  };
}

function experimentPage(args: {
  id: string;
  teamspaceId: string;
  title: string;
  icon: string;
  position: number;
  expId: string;       // ExpTube id, e.g. "EXP-2026-0101"
  elnId: string;       // ChemELN id, e.g. "ELN-101"
  status: "draft" | "active" | "in_progress" | "completed" | "archived";
  objective: string;
  reagents: string[];
  equipment: string[];
  sops: Array<{ id: string; title: string }>;
  findings: Array<{ id: string; title: string }>;
  siblings: Array<{ id: string; title: string }>;
}): PageSpec {
  const calloutVariant: "success" | "info" =
    args.status === "completed" ? "success" : "info";
  const content = doc(
    callout(
      "📋",
      calloutVariant,
      paragraph(
        text(
          `Source of truth: ExpTube ${args.expId} · ChemELN ${args.elnId} — full procedure and AI analysis live in the linked systems.`,
        ),
      ),
    ),
    heading(2, "Objective"),
    paragraph(text(args.objective)),
    heading(2, "Status"),
    paragraph(text(args.status.replace("_", " "))),
    heading(2, "Key reagents"),
    bulletList(...args.reagents),
    heading(2, "Key equipment"),
    bulletList(...args.equipment),
    heading(2, "Related SOPs"),
    bulletListNodes(...args.sops.map((s) => [wikilink(s.id, s.title)] as TipTapNode[])),
    heading(2, "Findings from this experiment"),
    bulletListNodes(...args.findings.map((f) => [wikilink(f.id, f.title)] as TipTapNode[])),
    heading(2, "Sibling experiments"),
    bulletListNodes(...args.siblings.map((s) => [wikilink(s.id, s.title)] as TipTapNode[])),
  );
  for (const s of args.sops) link(args.id, s.id);
  for (const f of args.findings) link(args.id, f.id);
  for (const s of args.siblings) link(args.id, s.id);
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: args.teamspaceId,
    spaceType: SpaceType.TEAM,
    position: args.position,
    oneLiner: args.objective.slice(0, 140),
    summary: `${args.title}. ${args.objective}`,
    content,
  };
}

function findingPage(args: {
  id: string;
  teamspaceId: string;
  title: string;
  icon: string;
  position: number;
  takeaway: string;
  context: string;
  evidence: TipTapNode[]; // mixed inline content (text + wikilinks) for the evidence paragraph
  related: Array<{ id: string; title: string }>;
  sourceExperiments: string[]; // links back to experiments
  variant?: "warning" | "info" | "success" | "error";
}): PageSpec {
  const content = doc(
    callout("💡", args.variant ?? "warning", paragraph(text(args.takeaway))),
    paragraph(text(args.context)),
    paragraph(...args.evidence),
    heading(3, "Related findings"),
    bulletListNodes(
      ...args.related.map((r) => [wikilink(r.id, r.title)] as TipTapNode[]),
    ),
  );
  for (const e of args.sourceExperiments) {
    link(args.id, e);
    link(e, args.id); // bidirectional in graph (finding ↔ source)
  }
  for (const r of args.related) link(args.id, r.id);
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: args.teamspaceId,
    spaceType: SpaceType.TEAM,
    position: args.position,
    oneLiner: args.takeaway,
    summary: `${args.takeaway} ${args.context}`.trim(),
    content,
  };
}

function sopPage(args: {
  id: string;
  teamspaceId: string;
  title: string;
  icon: string;
  position: number;
  purpose: string;
  materials: string[];
  steps: string[];
  notes: string[];
  usedIn: Array<{ id: string; title: string }>;
  reagentRefs?: Array<{ id: string; title: string }>;
}): PageSpec {
  const usedInList = bulletListNodes(
    ...args.usedIn.map((u) => [wikilink(u.id, u.title)] as TipTapNode[]),
  );
  const reagentNodes: TipTapNode[] = args.reagentRefs && args.reagentRefs.length
    ? [
        heading(3, "Equipment & reagent notes"),
        bulletListNodes(
          ...args.reagentRefs.map((r) => [wikilink(r.id, r.title)] as TipTapNode[]),
        ),
      ]
    : [];
  const content = doc(
    heading(2, "Purpose"),
    paragraph(text(args.purpose)),
    heading(2, "Materials"),
    bulletList(...args.materials),
    heading(2, "Steps"),
    orderedList(...args.steps),
    heading(2, "Notes & gotchas"),
    bulletList(...args.notes),
    heading(2, "Used in experiments"),
    usedInList,
    ...reagentNodes,
  );
  for (const u of args.usedIn) link(args.id, u.id);
  for (const r of args.reagentRefs ?? []) link(args.id, r.id);
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: args.teamspaceId,
    spaceType: SpaceType.TEAM,
    position: args.position,
    oneLiner: args.purpose.slice(0, 140),
    summary: `${args.title}. ${args.purpose}`,
    content,
  };
}

function reagentPage(args: {
  id: string;
  teamspaceId: string;
  title: string;
  icon: string;
  position: number;
  description: string;
  notes: string[];
}): PageSpec {
  const content = doc(
    paragraph(text(args.description)),
    heading(3, "Quirks / calibration notes"),
    bulletList(...args.notes),
  );
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: args.teamspaceId,
    spaceType: SpaceType.TEAM,
    position: args.position,
    oneLiner: args.description.slice(0, 140),
    summary: args.description,
    content,
  };
}

function generalPage(args: {
  id: string;
  title: string;
  icon: string;
  position: number;
  oneLiner: string;
  summary: string;
  content: TipTapNode;
}): PageSpec {
  return {
    id: args.id,
    title: args.title,
    icon: args.icon,
    parentId: null,
    teamspaceId: null,
    spaceType: SpaceType.PRIVATE,
    position: args.position,
    oneLiner: args.oneLiner,
    summary: args.summary,
    content: args.content,
  };
}

// ── Content definitions ──────────────────────────────────────────────

// MOLECULAR BIOLOGY ───────────────────────────────────────────────────
const molbioExpTitles = {
  exp101: "Genomic DNA Extraction - Bacterial Pellet Series",
  exp102: "Plasmid DNA Mini Prep Series",
  exp103: "Agarose Gel Preparation - 1% TAE",
  exp104: "Gel Electrophoresis - DNA Quality Check",
  exp105: "Gel Electrophoresis - PCR Verification",
  exp106: "DNA Purification - PCR Cleanup Series",
};

const molbioExperiments: PageSpec[] = [
  experimentPage({
    id: E.exp101,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp101,
    icon: "🧬",
    position: 1,
    expId: "EXP-2026-0101",
    elnId: "ELN-101",
    status: "in_progress",
    objective:
      "Extract genomic DNA from overnight cultures of E. coli DH5-alpha across three biological replicates and use as PCR template for downstream verification.",
    reagents: [
      "TE buffer",
      "Lysozyme",
      "Proteinase K",
      "Phenol:chloroform:isoamyl alcohol (25:24:1)",
      "Sodium chloride (NaCl)",
      "Ethanol",
    ],
    equipment: ["Benchtop microcentrifuge", "Heat block", "NanoDrop One"],
    sops: [
      { id: S.sopNanoDrop, title: "SOP: NanoDrop quantification of nucleic acids" },
    ],
    findings: [
      { id: F.find260280, title: "260/280 ratio <1.8 from bacterial pellets indicates RNA carry-over" },
    ],
    siblings: [
      { id: E.exp102, title: molbioExpTitles.exp102 },
      { id: E.exp104, title: molbioExpTitles.exp104 },
    ],
  }),
  experimentPage({
    id: E.exp102,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp102,
    icon: "🧫",
    position: 2,
    expId: "EXP-2026-0102",
    elnId: "ELN-102",
    status: "in_progress",
    objective:
      "Recover plasmid DNA from three independent colonies harboring the pUC19 reporter construct; assess yield and purity by NanoDrop and 1% agarose gel.",
    reagents: ["Solution P1 (resuspension)", "Solution P2 (lysis)", "Solution P3 (neutralization)", "Ethanol", "TE buffer"],
    equipment: ["Silica spin columns", "NanoDrop One", "Benchtop microcentrifuge"],
    sops: [
      { id: S.sopMiniprep, title: "SOP: Mini-prep — alkaline lysis (Birnboim/Doly)" },
      { id: S.sopNanoDrop, title: "SOP: NanoDrop quantification of nucleic acids" },
    ],
    findings: [
      { id: F.findPlasmidYield, title: "Plasmid yield drops sharply past 16 h overnight culture" },
      { id: F.find260280, title: "260/280 ratio <1.8 from bacterial pellets indicates RNA carry-over" },
    ],
    siblings: [
      { id: E.exp101, title: molbioExpTitles.exp101 },
      { id: E.exp104, title: molbioExpTitles.exp104 },
    ],
  }),
  experimentPage({
    id: E.exp103,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp103,
    icon: "🟫",
    position: 3,
    expId: "EXP-2026-0103",
    elnId: "ELN-103",
    status: "completed",
    objective:
      "Prepare 1% agarose gels in 1× TAE buffer with ethidium-bromide-equivalent stain for routine DNA size analysis.",
    reagents: ["Agarose powder", "TAE 50× stock", "GelRed (or equivalent)"],
    equipment: ["Microwave", "Casting tray", "Gel rig — Bio-Rad Sub-Cell GT"],
    sops: [
      { id: S.sopAgaroseGel, title: "SOP: Casting a 1% agarose TAE gel" },
    ],
    findings: [
      { id: F.findGelResolution, title: "1% TAE resolves 0.5–10 kb cleanly; switch to TBE for >10 kb" },
    ],
    siblings: [
      { id: E.exp104, title: molbioExpTitles.exp104 },
      { id: E.exp105, title: molbioExpTitles.exp105 },
    ],
  }),
  experimentPage({
    id: E.exp104,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp104,
    icon: "📏",
    position: 4,
    expId: "EXP-2026-0104",
    elnId: "ELN-104",
    status: "active",
    objective:
      "Run mini-prep and genomic-DNA samples on a 1% agarose gel to confirm size, integrity, and absence of RNA contamination before downstream PCR.",
    reagents: ["6× loading dye", "1 kb DNA ladder"],
    equipment: ["Gel rig — Bio-Rad Sub-Cell GT", "Power supply", "UV transilluminator"],
    sops: [
      { id: S.sopAgaroseGel, title: "SOP: Casting a 1% agarose TAE gel" },
      { id: S.sopElectrophoresis, title: "SOP: Sample loading and electrophoresis at 100 V" },
    ],
    findings: [
      { id: F.findGelResolution, title: "1% TAE resolves 0.5–10 kb cleanly; switch to TBE for >10 kb" },
    ],
    siblings: [
      { id: E.exp103, title: molbioExpTitles.exp103 },
      { id: E.exp105, title: molbioExpTitles.exp105 },
    ],
  }),
  experimentPage({
    id: E.exp105,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp105,
    icon: "🧪",
    position: 5,
    expId: "EXP-2026-0105",
    elnId: "ELN-105",
    status: "active",
    objective:
      "Verify PCR amplification of a 700 bp target from plasmid template by gel electrophoresis with a 1 kb ladder.",
    reagents: ["6× loading dye", "1 kb DNA ladder", "PCR products from EXP-0102 templates"],
    equipment: ["Gel rig — Bio-Rad Sub-Cell GT", "Power supply", "UV transilluminator"],
    sops: [
      { id: S.sopAgaroseGel, title: "SOP: Casting a 1% agarose TAE gel" },
      { id: S.sopElectrophoresis, title: "SOP: Sample loading and electrophoresis at 100 V" },
    ],
    findings: [
      { id: F.findGelResolution, title: "1% TAE resolves 0.5–10 kb cleanly; switch to TBE for >10 kb" },
    ],
    siblings: [
      { id: E.exp104, title: molbioExpTitles.exp104 },
      { id: E.exp106, title: molbioExpTitles.exp106 },
    ],
  }),
  experimentPage({
    id: E.exp106,
    teamspaceId: TS.molbio,
    title: molbioExpTitles.exp106,
    icon: "🧹",
    position: 6,
    expId: "EXP-2026-0106",
    elnId: "ELN-106",
    status: "active",
    objective:
      "Clean up PCR products with silica spin columns to remove primers, dNTPs, and polymerase before downstream cloning.",
    reagents: ["Binding buffer (PB)", "Wash buffer (PE) with ethanol", "Elution buffer (EB)"],
    equipment: ["Silica spin columns", "NanoDrop One", "Benchtop microcentrifuge"],
    sops: [
      { id: S.sopMiniprep, title: "SOP: Mini-prep — alkaline lysis (Birnboim/Doly)" },
      { id: S.sopNanoDrop, title: "SOP: NanoDrop quantification of nucleic acids" },
    ],
    findings: [
      { id: F.findPcrCleanup, title: "PCR cleanup recovery is 60–75% with silica spin columns; expect loss" },
    ],
    siblings: [
      { id: E.exp105, title: molbioExpTitles.exp105 },
      { id: E.exp102, title: molbioExpTitles.exp102 },
    ],
  }),
];

const molbioSops: PageSpec[] = [
  sopPage({
    id: S.sopMiniprep,
    teamspaceId: TS.molbio,
    title: "SOP: Mini-prep — alkaline lysis (Birnboim/Doly)",
    icon: "📜",
    position: 7,
    purpose: "Recover supercoiled plasmid DNA from a 5 mL overnight bacterial culture using the standard alkaline-lysis chemistry.",
    materials: [
      "Solution P1 (50 mM Tris-Cl pH 8.0, 10 mM EDTA, RNase A)",
      "Solution P2 (200 mM NaOH, 1% SDS) — make fresh weekly",
      "Solution P3 (3 M potassium acetate pH 5.5)",
      "Silica spin columns",
      "Ethanol (96–100%)",
    ],
    steps: [
      "Pellet 1.5 mL of overnight culture; resuspend pellet in 250 µL P1.",
      "Add 250 µL P2; invert 4–6× until lysate is clear and viscous. Do not vortex.",
      "Add 350 µL P3; invert 4–6× until a white precipitate forms. Centrifuge 10 min at max speed.",
      "Apply supernatant to silica spin column; spin 1 min, discard flow-through.",
      "Wash with 750 µL ethanol-supplemented PE buffer; spin 1 min, discard.",
      "Spin empty column 1 min to dry; elute in 30–50 µL EB warmed to 50 °C.",
    ],
    notes: [
      "P2 ages quickly. Older than 1 week tends to give stringy lysates.",
      "Inadequate P3 mixing leaves chromosomal DNA in the eluate.",
      "Pre-warming EB to 50 °C bumps yield ~10%.",
    ],
    usedIn: [
      { id: E.exp102, title: molbioExpTitles.exp102 },
      { id: E.exp106, title: molbioExpTitles.exp106 },
    ],
    reagentRefs: [
      { id: R.regNanoDrop, title: "NanoDrop One — quirks and calibration" },
    ],
  }),
  sopPage({
    id: S.sopAgaroseGel,
    teamspaceId: TS.molbio,
    title: "SOP: Casting a 1% agarose TAE gel",
    icon: "🟫",
    position: 8,
    purpose: "Cast a 50 mL 1% agarose gel in 1× TAE buffer for routine DNA size analysis (0.5–10 kb).",
    materials: [
      "Agarose powder",
      "1× TAE buffer (from 50× stock)",
      "GelRed or equivalent stain",
      "Casting tray + comb",
      "Microwave",
    ],
    steps: [
      "Combine 0.5 g agarose with 50 mL 1× TAE in a 250 mL flask.",
      "Microwave on medium power, swirling every 30 s, until fully dissolved (~2 min total).",
      "Cool to ~55 °C; add 5 µL GelRed; swirl gently.",
      "Pour into casting tray; insert comb; allow 30 min to set.",
      "Submerge in 1× TAE in gel rig before pulling comb.",
    ],
    notes: [
      "Boiled-dry agarose: top up with deionized water to recover the original volume before pouring.",
      "Gel cracks during pour usually mean the casting tray was tilted.",
    ],
    usedIn: [
      { id: E.exp103, title: molbioExpTitles.exp103 },
      { id: E.exp104, title: molbioExpTitles.exp104 },
      { id: E.exp105, title: molbioExpTitles.exp105 },
    ],
    reagentRefs: [
      { id: R.regTaeStock, title: "TAE 50× stock — recipe and shelf life" },
      { id: R.regGelRig, title: "Gel rig — Bio-Rad Sub-Cell GT — known issues" },
    ],
  }),
  sopPage({
    id: S.sopNanoDrop,
    teamspaceId: TS.molbio,
    title: "SOP: NanoDrop quantification of nucleic acids",
    icon: "💧",
    position: 9,
    purpose: "Measure DNA/RNA concentration and purity (A260, A260/A280, A260/A230) on the NanoDrop One.",
    materials: ["NanoDrop One instrument", "Lint-free wipes", "Elution buffer or water (blank)"],
    steps: [
      "Wipe both pedestals with a damp wipe, then dry.",
      "Blank with 1 µL of the buffer the sample is in (EB or water).",
      "Measure 1 µL of sample. Wipe pedestals between samples.",
      "Record A260 concentration, A260/A280, and A260/A230.",
    ],
    notes: [
      "A260/A280 ~1.8 indicates clean DNA; <1.7 hints at protein or RNA carry-over.",
      "A260/A230 ~2.0 indicates clean DNA; <1.8 hints at salt / phenol carry-over.",
      "Crusted residue on the pedestal causes consistent over-reads.",
    ],
    usedIn: [
      { id: E.exp101, title: molbioExpTitles.exp101 },
      { id: E.exp102, title: molbioExpTitles.exp102 },
      { id: E.exp106, title: molbioExpTitles.exp106 },
    ],
    reagentRefs: [
      { id: R.regNanoDrop, title: "NanoDrop One — quirks and calibration" },
    ],
  }),
  sopPage({
    id: S.sopElectrophoresis,
    teamspaceId: TS.molbio,
    title: "SOP: Sample loading and electrophoresis at 100 V",
    icon: "⚡",
    position: 10,
    purpose: "Load samples mixed with 6× loading dye onto a submerged agarose gel and run at 100 V until the dye front reaches ~80% of the gel length.",
    materials: ["6× loading dye", "1 kb DNA ladder", "Power supply (constant V)", "Pre-cast gel in rig"],
    steps: [
      "Mix 5 µL sample with 1 µL 6× loading dye on a piece of parafilm.",
      "Load 5 µL ladder into the leftmost well of each row.",
      "Load 6 µL of each prepared sample; record well positions.",
      "Run at 100 V constant for ~45 min, watching the dye front.",
      "Stop when the front reaches ~80% of the gel length; image on UV transilluminator.",
    ],
    notes: [
      "Samples float out of wells if the gel rig buffer level is too high; keep buffer just covering the gel.",
      "Lane warping at >120 V — drop to 80 V for better resolution.",
    ],
    usedIn: [
      { id: E.exp104, title: molbioExpTitles.exp104 },
      { id: E.exp105, title: molbioExpTitles.exp105 },
    ],
    reagentRefs: [
      { id: R.regGelRig, title: "Gel rig — Bio-Rad Sub-Cell GT — known issues" },
    ],
  }),
];

const molbioFindings: PageSpec[] = [
  findingPage({
    id: F.findPlasmidYield,
    teamspaceId: TS.molbio,
    title: "Plasmid yield drops sharply past 16 h overnight culture",
    icon: "💡",
    position: 11,
    takeaway:
      "Plasmid yield drops below 50 ng/µL when the overnight culture exceeds 16 h.",
    context:
      "Stationary-phase E. coli with pUC19 increase chromosomal DNA leakage and cell debris with longer incubation, lowering net plasmid yield through the standard mini-prep pipeline.",
    evidence: [
      text("Observed across replicates of "),
      wikilink(E.exp102, molbioExpTitles.exp102),
      text(". When inoculated cultures grew 18–20 h before harvest, yields averaged 35 ng/µL versus 110 ng/µL at 12–14 h. Confirmed by NanoDrop in line with "),
      wikilink(S.sopMiniprep, "SOP: Mini-prep — alkaline lysis"),
      text("."),
    ],
    related: [
      { id: F.find260280, title: "260/280 ratio <1.8 from bacterial pellets indicates RNA carry-over" },
    ],
    sourceExperiments: [E.exp102],
  }),
  findingPage({
    id: F.findGelResolution,
    teamspaceId: TS.molbio,
    title: "1% TAE resolves 0.5–10 kb cleanly; switch to TBE for >10 kb",
    icon: "📏",
    position: 12,
    takeaway: "1% TAE resolves 0.5–10 kb fragments cleanly; switch to TBE for fragments >10 kb.",
    context:
      "TAE has lower buffering capacity than TBE but allows easier downstream gel-extraction. For routine DNA size analysis below 10 kb, 1% TAE is sufficient.",
    evidence: [
      text("Verified across "),
      wikilink(E.exp103, molbioExpTitles.exp103),
      text(", "),
      wikilink(E.exp104, molbioExpTitles.exp104),
      text(", and "),
      wikilink(E.exp105, molbioExpTitles.exp105),
      text(". Lambda HindIII fragments at 23 kb consistently bunched in 1% TAE; switching to 0.7% TBE resolved them."),
    ],
    related: [
      { id: F.findGelLaneWarp, title: "Lane warping in 12% gels at high voltage" },
    ],
    sourceExperiments: [E.exp103, E.exp104, E.exp105],
  }),
  findingPage({
    id: F.find260280,
    teamspaceId: TS.molbio,
    title: "260/280 ratio <1.8 from bacterial pellets indicates RNA carry-over",
    icon: "🧮",
    position: 13,
    takeaway:
      "260/280 ratio below 1.8 in nucleic-acid prep from bacterial pellets is a strong indicator of RNA carry-over rather than protein contamination.",
    context:
      "Both protein and residual RNA pull A280 down relative to A260. In our genomic-DNA preps the RNase A step is the variable; protein removal by phenol:chloroform is rarely the limiting step.",
    evidence: [
      text("Recurrent across "),
      wikilink(E.exp101, molbioExpTitles.exp101),
      text(" and "),
      wikilink(E.exp102, molbioExpTitles.exp102),
      text(". Adding a 30-min 37 °C RNase A digest before the proteinase K step lifted the ratio from 1.65 to 1.85 on average."),
    ],
    related: [
      { id: F.findPlasmidYield, title: "Plasmid yield drops sharply past 16 h overnight culture" },
    ],
    sourceExperiments: [E.exp101, E.exp102],
  }),
  findingPage({
    id: F.findPcrCleanup,
    teamspaceId: TS.molbio,
    title: "PCR cleanup recovery is 60–75% with silica spin columns; expect loss",
    icon: "🧹",
    position: 14,
    takeaway:
      "Silica spin-column PCR cleanup typically recovers 60–75% of input DNA — plan downstream amounts accordingly.",
    context:
      "Reproducible across vendor and home-made resin protocols. Smaller fragments (<200 bp) recover even worse (~40%), so cleaning small amplicons may need a different chemistry (SPRI beads).",
    evidence: [
      text("Confirmed in "),
      wikilink(E.exp106, molbioExpTitles.exp106),
      text(" with three independent PCR products of ~700 bp. Average recovery was 68%."),
    ],
    related: [
      { id: F.findPlasmidYield, title: "Plasmid yield drops sharply past 16 h overnight culture" },
    ],
    sourceExperiments: [E.exp106],
  }),
];

const molbioReagents: PageSpec[] = [
  reagentPage({
    id: R.regTaeStock,
    teamspaceId: TS.molbio,
    title: "TAE 50× stock — recipe and shelf life",
    icon: "🧪",
    position: 15,
    description:
      "TAE 50× stock is 242 g Tris base + 57.1 mL glacial acetic acid + 100 mL 0.5 M EDTA pH 8.0 per liter. Dilute to 1× before use.",
    notes: [
      "Stable at room temperature for ~6 months; precipitates form past that and the buffer behaves erratically.",
      "Discard if a brown tint appears — bacterial growth at the cap.",
    ],
  }),
  reagentPage({
    id: R.regNanoDrop,
    teamspaceId: TS.molbio,
    title: "NanoDrop One — quirks and calibration",
    icon: "💧",
    position: 16,
    description:
      "Bench NanoDrop One in lab room 204. Used for DNA/RNA concentration and purity ratios on 1 µL samples.",
    notes: [
      "Pedestals must be wiped between samples — dried-on droplets cause consistent over-reads.",
      "Re-run blank every 6 samples to catch buffer drift.",
      "Yearly factory recalibration; service log on the rack next to it.",
    ],
  }),
  reagentPage({
    id: R.regGelRig,
    teamspaceId: TS.molbio,
    title: "Gel rig — Bio-Rad Sub-Cell GT — known issues",
    icon: "⚡",
    position: 17,
    description:
      "Mid-size horizontal gel rig with a 15 × 15 cm tray. Two combs (8-well and 15-well) live in the drawer beneath.",
    notes: [
      "The red banana-plug socket has a loose contact; press firmly until power-supply LED stays solid.",
      "Buffer leaks from the rear of the tray if the casting dam isn't seated all the way.",
      "Don't run it past 120 V — lane warping is severe.",
    ],
  }),
];

// Molecular Biology landing
const molbioLanding = landingPage({
  id: LP.molbio,
  teamspaceId: TS.molbio,
  title: "🧬 Molecular Biology",
  icon: "🧬",
  intro:
    "DNA and RNA workflows: extraction, mini-prep, gel electrophoresis, PCR verification, and purification. Mirrors the live ExpTube workflow EXP-2026-0101 through 0106.",
  experiments: Object.entries({
    exp101: molbioExpTitles.exp101,
    exp102: molbioExpTitles.exp102,
    exp103: molbioExpTitles.exp103,
    exp104: molbioExpTitles.exp104,
    exp105: molbioExpTitles.exp105,
    exp106: molbioExpTitles.exp106,
  }).map(([k, t]) => ({ id: (E as Record<string, string>)[k], title: t })),
  sops: [
    { id: S.sopMiniprep, title: "SOP: Mini-prep — alkaline lysis" },
    { id: S.sopAgaroseGel, title: "SOP: Casting a 1% agarose TAE gel" },
    { id: S.sopNanoDrop, title: "SOP: NanoDrop quantification" },
    { id: S.sopElectrophoresis, title: "SOP: Sample loading and electrophoresis" },
  ],
  findings: [
    { id: F.findPlasmidYield, title: "Plasmid yield drops past 16 h overnight" },
    { id: F.findGelResolution, title: "1% TAE resolves 0.5–10 kb; TBE for >10 kb" },
    { id: F.find260280, title: "260/280 <1.8 = RNA carry-over" },
    { id: F.findPcrCleanup, title: "PCR cleanup recovery 60–75%" },
  ],
});

// ORGANIC SYNTHESIS ───────────────────────────────────────────────────
const orgsynthExperiments: PageSpec[] = [
  experimentPage({
    id: E.expAspirin,
    teamspaceId: TS.orgsynth,
    title: "Synthesis of Aspirin (Acetylsalicylic Acid)",
    icon: "💊",
    position: 1,
    expId: "EXP-ELN-001",
    elnId: "ELN-001",
    status: "completed",
    objective:
      "Synthesize aspirin through acetylation of salicylic acid and determine product purity by melting-point analysis.",
    reagents: ["Salicylic acid", "Acetic anhydride", "Sulfuric acid (catalyst)", "Cold water"],
    equipment: ["Erlenmeyer flask", "Hot plate", "Büchner funnel", "Melting-point apparatus"],
    sops: [
      { id: S.sopRecrystal, title: "SOP: Recrystallization from water" },
      { id: S.sopReflux, title: "SOP: Standard reflux setup" },
    ],
    findings: [
      { id: F.findAspirinYield, title: "Aspirin yield decreases with old salicylic acid" },
    ],
    siblings: [
      { id: E.expRecrystal, title: "Recrystallization of Benzoic Acid" },
      { id: E.expFischer, title: "Fischer Esterification: Synthesis of Ethyl Acetate" },
    ],
  }),
  experimentPage({
    id: E.expGrignard,
    teamspaceId: TS.orgsynth,
    title: "Grignard Reaction: Synthesis of Triphenylmethanol",
    icon: "🔥",
    position: 2,
    expId: "EXP-ELN-002",
    elnId: "ELN-002",
    status: "completed",
    objective:
      "Prepare triphenylmethanol via Grignard reaction between phenylmagnesium bromide and benzophenone.",
    reagents: ["Magnesium turnings", "Bromobenzene", "Benzophenone", "Diethyl ether (anhydrous)", "Saturated NH4Cl"],
    equipment: ["3-neck round-bottom flask", "Reflux condenser", "Drying tube"],
    sops: [
      { id: S.sopReflux, title: "SOP: Standard reflux setup" },
      { id: S.sopRecrystal, title: "SOP: Recrystallization from water" },
    ],
    findings: [
      { id: F.findGrignardAnhydrous, title: "Anhydrous conditions critical for Grignard" },
    ],
    siblings: [{ id: E.expAspirin, title: "Synthesis of Aspirin" }],
  }),
  experimentPage({
    id: E.expRecrystal,
    teamspaceId: TS.orgsynth,
    title: "Recrystallization of Benzoic Acid",
    icon: "❄️",
    position: 3,
    expId: "EXP-ELN-003",
    elnId: "ELN-003",
    status: "completed",
    objective:
      "Purify crude benzoic acid using recrystallization from water and confirm purity by melting point.",
    reagents: ["Crude benzoic acid", "Deionized water", "Activated charcoal"],
    equipment: ["Erlenmeyer flask", "Hot plate", "Büchner funnel", "Melting-point apparatus"],
    sops: [{ id: S.sopRecrystal, title: "SOP: Recrystallization from water" }],
    findings: [],
    siblings: [{ id: E.expAspirin, title: "Synthesis of Aspirin" }],
  }),
  experimentPage({
    id: E.expFischer,
    teamspaceId: TS.orgsynth,
    title: "Fischer Esterification: Synthesis of Ethyl Acetate",
    icon: "🧪",
    position: 4,
    expId: "EXP-ELN-005",
    elnId: "ELN-005",
    status: "draft",
    objective:
      "Synthesize ethyl acetate through acid-catalyzed esterification of acetic acid with ethanol.",
    reagents: ["Acetic acid (glacial)", "Ethanol", "Sulfuric acid (catalyst)"],
    equipment: ["Round-bottom flask", "Reflux condenser", "Distillation apparatus"],
    sops: [{ id: S.sopReflux, title: "SOP: Standard reflux setup" }],
    findings: [],
    siblings: [{ id: E.expAspirin, title: "Synthesis of Aspirin" }],
  }),
];

const orgsynthSops: PageSpec[] = [
  sopPage({
    id: S.sopRecrystal,
    teamspaceId: TS.orgsynth,
    title: "SOP: Recrystallization from water",
    icon: "❄️",
    position: 5,
    purpose: "Purify a water-soluble organic solid by hot-saturate / cool / filter recrystallization.",
    materials: ["Hot plate", "Erlenmeyer flask", "Büchner funnel + flask", "Filter paper", "Ice bath"],
    steps: [
      "Dissolve the crude solid in the minimum volume of boiling water.",
      "Add activated charcoal if the solution is colored; boil 2 min more.",
      "Hot-filter through a fluted filter into a clean flask.",
      "Cool slowly to room temperature, then on ice for 15 min.",
      "Vacuum-filter the crystals; wash with cold water.",
      "Air-dry; record yield and melting point.",
    ],
    notes: [
      "Cooling too fast traps impurities; aim for slow cooling under a watch glass.",
      "If no crystals form, scratch the inside of the flask with a glass rod.",
    ],
    usedIn: [
      { id: E.expAspirin, title: "Synthesis of Aspirin" },
      { id: E.expGrignard, title: "Grignard Reaction" },
      { id: E.expRecrystal, title: "Recrystallization of Benzoic Acid" },
    ],
  }),
  sopPage({
    id: S.sopReflux,
    teamspaceId: TS.orgsynth,
    title: "SOP: Standard reflux setup",
    icon: "🔥",
    position: 6,
    purpose: "Heat a reaction at the boiling point of the solvent without losing volatiles.",
    materials: ["Round-bottom flask", "Reflux condenser", "Heating mantle / hot plate", "Stir bar", "Water hoses"],
    steps: [
      "Clamp the round-bottom flask to a stand at the desired height.",
      "Add reagents and a stir bar; attach the reflux condenser greased lightly at the joint.",
      "Connect water in (bottom) and water out (top); start water flow before heating.",
      "Heat with stirring until vapor ring is ~1/3 up the condenser.",
      "Adjust heat to keep ring stable for the required reaction time.",
    ],
    notes: [
      "Never heat a closed system. The condenser must be open at top.",
      "If reaction bumps, lower the heat and add more stirring.",
    ],
    usedIn: [
      { id: E.expAspirin, title: "Synthesis of Aspirin" },
      { id: E.expGrignard, title: "Grignard Reaction" },
      { id: E.expFischer, title: "Fischer Esterification" },
    ],
    reagentRefs: [{ id: R.regSulfuric, title: "Sulfuric acid — handling and disposal" }],
  }),
];

const orgsynthFindings: PageSpec[] = [
  findingPage({
    id: F.findAspirinYield,
    teamspaceId: TS.orgsynth,
    title: "Aspirin yield decreases with old salicylic acid",
    icon: "⏳",
    position: 7,
    takeaway: "Salicylic acid more than ~12 months old gives noticeably lower aspirin yield (often <60%).",
    context:
      "Salicylic acid takes up moisture and slowly oxidizes during storage. Bottles labeled >1 year ago should be re-checked by melting point before use.",
    evidence: [
      text("Side-by-side runs in "),
      wikilink(E.expAspirin, "Synthesis of Aspirin"),
      text(": fresh-bottle reagent gave 78% yield, 14-month-old reagent gave 54%."),
    ],
    related: [{ id: F.findGrignardAnhydrous, title: "Anhydrous conditions critical for Grignard" }],
    sourceExperiments: [E.expAspirin],
  }),
  findingPage({
    id: F.findGrignardAnhydrous,
    teamspaceId: TS.orgsynth,
    title: "Anhydrous conditions critical for Grignard",
    icon: "💧",
    position: 8,
    takeaway:
      "Trace water in the diethyl ether quenches Grignard reagent and stalls the reaction; flame-dry glassware and use freshly opened anhydrous solvent.",
    context:
      "Mg + ArBr → ArMgBr is exquisitely water-sensitive. Even residual moisture from a humid lab can drop the yield below 30%.",
    evidence: [
      text("Compared two runs of "),
      wikilink(E.expGrignard, "Grignard Reaction"),
      text(" in a single afternoon: flame-dried glassware → 72% triphenylmethanol; oven-dry only → 38%."),
    ],
    related: [{ id: F.findAspirinYield, title: "Aspirin yield decreases with old salicylic acid" }],
    sourceExperiments: [E.expGrignard],
  }),
];

const orgsynthReagents: PageSpec[] = [
  reagentPage({
    id: R.regSulfuric,
    teamspaceId: TS.orgsynth,
    title: "Sulfuric acid — handling and disposal",
    icon: "⚠️",
    position: 9,
    description:
      "Concentrated sulfuric acid (98%, ~18 M) is used catalytically in aspirin synthesis and Fischer esterification. Severe burns and fume hazard.",
    notes: [
      "Always add acid to water, never the reverse.",
      "Store in the corrosives cabinet next to the fume hood.",
      "Spent acid goes in the labeled aqueous-acid waste carboy, not the sink.",
      "Eye protection + acid-resistant gloves whenever the bottle is open.",
    ],
  }),
];

const orgsynthLanding = landingPage({
  id: LP.orgsynth,
  teamspaceId: TS.orgsynth,
  title: "🧪 Organic Synthesis",
  icon: "🧪",
  intro:
    "Classic organic-synthesis reactions used in undergraduate teaching and small-scale lab work: acetylation, Grignard, esterification, and recrystallization.",
  experiments: [
    { id: E.expAspirin, title: "Synthesis of Aspirin" },
    { id: E.expGrignard, title: "Grignard Reaction" },
    { id: E.expRecrystal, title: "Recrystallization of Benzoic Acid" },
    { id: E.expFischer, title: "Fischer Esterification" },
  ],
  sops: [
    { id: S.sopRecrystal, title: "SOP: Recrystallization from water" },
    { id: S.sopReflux, title: "SOP: Standard reflux setup" },
  ],
  findings: [
    { id: F.findAspirinYield, title: "Aspirin yield decreases with old salicylic acid" },
    { id: F.findGrignardAnhydrous, title: "Anhydrous conditions critical for Grignard" },
  ],
});

// PROTEIN BIOCHEMISTRY ────────────────────────────────────────────────
const proteinExperiments: PageSpec[] = [
  experimentPage({
    id: E.expBradford,
    teamspaceId: TS.protein,
    title: "Bradford Protein Assay",
    icon: "🧫",
    position: 1,
    expId: "EXP-ELN-006",
    elnId: "ELN-006",
    status: "completed",
    objective: "Quantify protein concentration in unknown samples using the Bradford assay with BSA as a standard.",
    reagents: ["Bradford reagent (Coomassie Brilliant Blue G-250)", "BSA standard (1 mg/mL)", "Phosphate-buffered saline (PBS)"],
    equipment: ["Microplate reader (595 nm)", "96-well plate", "Multichannel pipette"],
    sops: [{ id: S.sopBradford, title: "SOP: Bradford standard curve" }],
    findings: [{ id: F.findBradfordRange, title: "Bradford reads non-linear above ~1 mg/mL" }],
    siblings: [{ id: E.expSdspage, title: "SDS-PAGE Gel Electrophoresis" }],
  }),
  experimentPage({
    id: E.expLactase,
    teamspaceId: TS.protein,
    title: "Enzyme Kinetics: Lactase Activity",
    icon: "⏱️",
    position: 2,
    expId: "EXP-ELN-007",
    elnId: "ELN-007",
    status: "completed",
    objective: "Determine the Km and Vmax of lactase enzyme using ONPG as substrate.",
    reagents: ["Lactase enzyme", "ONPG substrate", "Phosphate buffer (pH 7.0)"],
    equipment: ["UV-Vis spectrophotometer (420 nm)", "Water bath at 37 °C"],
    sops: [],
    findings: [],
    siblings: [{ id: E.expBradford, title: "Bradford Protein Assay" }],
  }),
  experimentPage({
    id: E.expSdspage,
    teamspaceId: TS.protein,
    title: "SDS-PAGE Gel Electrophoresis",
    icon: "📊",
    position: 3,
    expId: "EXP-ELN-008",
    elnId: "ELN-008",
    status: "in_progress",
    objective: "Separate protein samples by molecular weight using SDS-PAGE and estimate sizes using a protein ladder.",
    reagents: ["Tris-glycine running buffer", "SDS sample buffer", "Coomassie stain", "Protein MW ladder"],
    equipment: ["Mini-PROTEAN gel rig", "Power supply", "Heat block"],
    sops: [{ id: S.sopSdsPage, title: "SOP: SDS-PAGE casting and running" }],
    findings: [{ id: F.findGelLaneWarp, title: "Lane warping in 12% gels at high voltage" }],
    siblings: [{ id: E.expWestern, title: "Western Blot Analysis of GAPDH" }],
  }),
  experimentPage({
    id: E.expWestern,
    teamspaceId: TS.protein,
    title: "Western Blot Analysis of GAPDH",
    icon: "🧬",
    position: 4,
    expId: "EXP-ELN-010",
    elnId: "ELN-010",
    status: "draft",
    objective: "Detect GAPDH protein expression in cell lysates using Western blot with chemiluminescent detection.",
    reagents: ["Anti-GAPDH primary antibody", "HRP-conjugated secondary", "Blocking buffer (5% milk)", "ECL substrate"],
    equipment: ["Wet transfer rig", "Imaging system (chemiluminescent)", "Rocker"],
    sops: [{ id: S.sopSdsPage, title: "SOP: SDS-PAGE casting and running" }],
    findings: [],
    siblings: [{ id: E.expSdspage, title: "SDS-PAGE Gel Electrophoresis" }],
  }),
];

const proteinSops: PageSpec[] = [
  sopPage({
    id: S.sopBradford,
    teamspaceId: TS.protein,
    title: "SOP: Bradford standard curve",
    icon: "📐",
    position: 5,
    purpose: "Build a 5-point BSA standard curve in 96-well format and read at 595 nm to quantify unknown protein concentrations.",
    materials: ["BSA stock (1 mg/mL)", "PBS diluent", "Bradford reagent", "96-well flat-bottom plate"],
    steps: [
      "Dilute BSA stock to 0, 0.125, 0.25, 0.5, 1.0 mg/mL in PBS.",
      "Plate 10 µL of each standard or sample in triplicate.",
      "Add 200 µL Bradford reagent per well; incubate 5 min in the dark.",
      "Read absorbance at 595 nm.",
      "Subtract blank; fit a linear regression to the standard curve and back-calculate samples.",
    ],
    notes: [
      "Above ~1 mg/mL the response is non-linear; dilute and re-read.",
      "Read within 30 min — color drifts after that.",
    ],
    usedIn: [{ id: E.expBradford, title: "Bradford Protein Assay" }],
  }),
  sopPage({
    id: S.sopSdsPage,
    teamspaceId: TS.protein,
    title: "SOP: SDS-PAGE casting and running",
    icon: "📊",
    position: 6,
    purpose: "Cast and run a 12% SDS-PAGE mini-gel for routine protein size analysis.",
    materials: ["30% acrylamide:bis (29:1)", "Resolving gel buffer (1.5 M Tris pH 8.8)", "Stacking gel buffer (1.0 M Tris pH 6.8)", "10% SDS", "10% APS", "TEMED"],
    steps: [
      "Assemble glass plates and gel cassette; check the seal with water.",
      "Pour resolving gel (12%); overlay with isopropanol; let polymerize 30 min.",
      "Rinse off isopropanol; pour stacking gel (4%); insert comb; polymerize 20 min.",
      "Mount in rig with running buffer; load samples (denatured 5 min @ 95 °C).",
      "Run at 80 V through stacking, 120 V through resolving until dye front reaches the bottom.",
    ],
    notes: [
      "Lane warping at >150 V — drop the voltage if the dye front looks crooked.",
      "Acrylamide solutions are neurotoxic — gloves at all times.",
    ],
    usedIn: [
      { id: E.expSdspage, title: "SDS-PAGE Gel Electrophoresis" },
      { id: E.expWestern, title: "Western Blot Analysis of GAPDH" },
    ],
  }),
];

const proteinFindings: PageSpec[] = [
  findingPage({
    id: F.findBradfordRange,
    teamspaceId: TS.protein,
    title: "Bradford reads non-linear above ~1 mg/mL",
    icon: "📐",
    position: 7,
    takeaway: "The Bradford assay's response saturates above ~1 mg/mL protein; dilute and re-run any sample above the linear range.",
    context:
      "Coomassie Brilliant Blue G-250's blue-shifted complex saturates at high protein concentrations. Linear range is roughly 0.1–1.0 mg/mL on the microplate format.",
    evidence: [
      text("Multiple runs of "),
      wikilink(E.expBradford, "Bradford Protein Assay"),
      text(" with crude lysates showed flattening of the standard curve past 1 mg/mL. R² dropped from 0.998 (0.1–1.0) to 0.91 (0.1–2.0)."),
    ],
    related: [{ id: F.findGelLaneWarp, title: "Lane warping in 12% gels at high voltage" }],
    sourceExperiments: [E.expBradford],
  }),
  findingPage({
    id: F.findGelLaneWarp,
    teamspaceId: TS.protein,
    title: "Lane warping in 12% gels at high voltage",
    icon: "📊",
    position: 8,
    takeaway: "12% SDS-PAGE gels lose resolution and show curved lanes at >150 V; cap the run at 120 V through the resolving gel.",
    context:
      "Heat generated at high voltage causes uneven migration. The mini-gel format is unforgiving; a slower run is almost always better.",
    evidence: [
      text("Compared two runs of "),
      wikilink(E.expSdspage, "SDS-PAGE Gel Electrophoresis"),
      text(": 180 V → severe smile; 120 V → flat lanes."),
    ],
    related: [
      { id: F.findGelResolution, title: "1% TAE resolves 0.5–10 kb; TBE for >10 kb" },
      { id: F.findBradfordRange, title: "Bradford reads non-linear above ~1 mg/mL" },
    ],
    sourceExperiments: [E.expSdspage],
  }),
];

const proteinLanding = landingPage({
  id: LP.protein,
  teamspaceId: TS.protein,
  title: "🧫 Protein Biochemistry",
  icon: "🧫",
  intro: "Protein quantitation, enzyme kinetics, and electrophoresis. Mirrors ChemELN's Protein Biochemistry project.",
  experiments: [
    { id: E.expBradford, title: "Bradford Protein Assay" },
    { id: E.expLactase, title: "Enzyme Kinetics: Lactase" },
    { id: E.expSdspage, title: "SDS-PAGE Gel Electrophoresis" },
    { id: E.expWestern, title: "Western Blot Analysis of GAPDH" },
  ],
  sops: [
    { id: S.sopBradford, title: "SOP: Bradford standard curve" },
    { id: S.sopSdsPage, title: "SOP: SDS-PAGE casting and running" },
  ],
  findings: [
    { id: F.findBradfordRange, title: "Bradford reads non-linear above ~1 mg/mL" },
    { id: F.findGelLaneWarp, title: "Lane warping in 12% gels at high voltage" },
  ],
});

// CELL BIOLOGY ────────────────────────────────────────────────────────
const cellbioExperiments: PageSpec[] = [
  experimentPage({
    id: E.expStrawberry,
    teamspaceId: TS.cellbio,
    title: "DNA Extraction from Strawberries",
    icon: "🍓",
    position: 1,
    expId: "EXP-ELN-009",
    elnId: "ELN-009",
    status: "in_progress",
    objective: "Isolate and visualize genomic DNA from strawberry tissue using simple extraction methods.",
    reagents: ["Detergent solution (dish soap + salt)", "Cold ethanol", "Strawberries"],
    equipment: ["Mortar and pestle", "Cheesecloth", "Test tubes"],
    sops: [],
    findings: [],
    siblings: [{ id: E.expPlasmolysis, title: "Plant Cell Plasmolysis" }],
  }),
  experimentPage({
    id: E.expPlasmolysis,
    teamspaceId: TS.cellbio,
    title: "Plant Cell Plasmolysis",
    icon: "🪴",
    position: 2,
    expId: "EXP-ELN-012",
    elnId: "ELN-012",
    status: "completed",
    objective: "Observe plasmolysis in Elodea leaf cells using hypertonic salt solutions.",
    reagents: ["NaCl 5% solution", "Distilled water"],
    equipment: ["Light microscope", "Glass slides + coverslips"],
    sops: [],
    findings: [],
    siblings: [{ id: E.expPglo, title: "Bacterial Transformation with pGLO" }],
  }),
  experimentPage({
    id: E.expPglo,
    teamspaceId: TS.cellbio,
    title: "Bacterial Transformation with pGLO Plasmid",
    icon: "🦠",
    position: 3,
    expId: "EXP-ELN-013",
    elnId: "ELN-013",
    status: "in_progress",
    objective: "Transform E. coli with pGLO plasmid containing the GFP gene.",
    reagents: ["Competent E. coli (HB101 or similar)", "pGLO plasmid DNA", "Ampicillin LB agar plates", "Arabinose"],
    equipment: ["42 °C water bath", "37 °C incubator", "UV transilluminator"],
    sops: [{ id: S.sopHeatShock, title: "SOP: Heat-shock transformation" }],
    findings: [{ id: F.findPgloThaw, title: "pGLO transformation efficiency drops if competent cells thawed twice" }],
    siblings: [{ id: E.expStrawberry, title: "DNA Extraction from Strawberries" }],
  }),
];

const cellbioSops: PageSpec[] = [
  sopPage({
    id: S.sopHeatShock,
    teamspaceId: TS.cellbio,
    title: "SOP: Heat-shock transformation",
    icon: "🌡️",
    position: 4,
    purpose: "Introduce plasmid DNA into chemically competent E. coli using a 42 °C heat shock.",
    materials: ["Competent E. coli on ice", "Plasmid DNA (1–10 ng)", "LB recovery medium", "Selection plates"],
    steps: [
      "Thaw competent cells on ice (~10 min).",
      "Add 1–10 ng plasmid; mix gently; incubate on ice 30 min.",
      "Heat shock 45 s at exactly 42 °C; return to ice 2 min.",
      "Add 250 µL LB; recover 1 h at 37 °C with shaking.",
      "Plate 100 µL on selection medium; incubate overnight at 37 °C.",
    ],
    notes: [
      "Re-freezing thawed competent cells halves transformation efficiency.",
      "Heat-shock duration matters more than temperature; 45 s is critical.",
    ],
    usedIn: [{ id: E.expPglo, title: "Bacterial Transformation with pGLO Plasmid" }],
    reagentRefs: [{ id: R.regCompCells, title: "Competent cells — handling and storage" }],
  }),
];

const cellbioFindings: PageSpec[] = [
  findingPage({
    id: F.findPgloThaw,
    teamspaceId: TS.cellbio,
    title: "pGLO transformation efficiency drops if competent cells thawed twice",
    icon: "❄️",
    position: 5,
    takeaway: "Thawing competent cells more than once cuts transformation efficiency roughly in half each time.",
    context:
      "Membrane integrity is fragile after the initial freeze-thaw. Multiple thaw cycles compound the damage and lower the count of transformable cells.",
    evidence: [
      text("Compared one-thaw vs two-thaw aliquots in "),
      wikilink(E.expPglo, "Bacterial Transformation with pGLO Plasmid"),
      text(": ~10⁵ CFU/µg vs ~5×10⁴ CFU/µg."),
    ],
    related: [],
    sourceExperiments: [E.expPglo],
  }),
];

const cellbioReagents: PageSpec[] = [
  reagentPage({
    id: R.regCompCells,
    teamspaceId: TS.cellbio,
    title: "Competent cells — handling and storage",
    icon: "🧊",
    position: 6,
    description: "Chemically competent E. coli (HB101 / DH5-alpha) stored at -80 °C in 50 µL aliquots.",
    notes: [
      "Aliquot fresh; never refreeze a thawed tube.",
      "Quality-control efficiency monthly with pUC19 standard.",
      "Inventory log on the freezer door.",
    ],
  }),
];

const cellbioLanding = landingPage({
  id: LP.cellbio,
  teamspaceId: TS.cellbio,
  title: "🔬 Cell Biology",
  icon: "🔬",
  intro: "Cell culture, transformation, and microscopy experiments.",
  experiments: [
    { id: E.expStrawberry, title: "DNA Extraction from Strawberries" },
    { id: E.expPlasmolysis, title: "Plant Cell Plasmolysis" },
    { id: E.expPglo, title: "Bacterial Transformation with pGLO" },
  ],
  sops: [{ id: S.sopHeatShock, title: "SOP: Heat-shock transformation" }],
  findings: [{ id: F.findPgloThaw, title: "pGLO efficiency drops on second thaw" }],
});

// ANALYTICAL & MATERIALS ──────────────────────────────────────────────
const analyticsExperiments: PageSpec[] = [
  experimentPage({
    id: E.expTlc,
    teamspaceId: TS.analytics,
    title: "Thin Layer Chromatography of Plant Pigments",
    icon: "🌿",
    position: 1,
    expId: "EXP-ELN-016",
    elnId: "ELN-016",
    status: "completed",
    objective: "Separate photosynthetic pigments from spinach leaves using TLC.",
    reagents: ["Spinach leaves", "Acetone", "Hexane:acetone (8:2) developing solvent", "TLC silica plates"],
    equipment: ["Capillary tubes", "Developing chamber", "UV lamp"],
    sops: [{ id: S.sopTlcPlate, title: "SOP: TLC plate spotting and development" }],
    findings: [],
    siblings: [{ id: E.expUvVis, title: "UV-Vis Spectroscopy: Beer-Lambert" }],
  }),
  experimentPage({
    id: E.expUvVis,
    teamspaceId: TS.analytics,
    title: "UV-Vis Spectroscopy: Beer-Lambert Law",
    icon: "📈",
    position: 2,
    expId: "EXP-ELN-017",
    elnId: "ELN-017",
    status: "in_progress",
    objective: "Verify the Beer-Lambert law using methyl orange solutions of varying concentration.",
    reagents: ["Methyl orange standard", "Distilled water"],
    equipment: ["UV-Vis spectrophotometer", "Quartz cuvettes"],
    sops: [],
    findings: [],
    siblings: [{ id: E.expMeltPoint, title: "Melting Point Determination" }],
  }),
  experimentPage({
    id: E.expMeltPoint,
    teamspaceId: TS.analytics,
    title: "Melting Point Determination of Unknown Compounds",
    icon: "🌡️",
    position: 3,
    expId: "EXP-ELN-018",
    elnId: "ELN-018",
    status: "archived",
    objective: "Identify unknown organic compounds by melting-point determination.",
    reagents: ["Set of unknown samples", "Capillary tubes"],
    equipment: ["Melting-point apparatus", "Reference table"],
    sops: [],
    findings: [],
    siblings: [{ id: E.expTlc, title: "Thin Layer Chromatography" }],
  }),
];

const analyticsSops: PageSpec[] = [
  sopPage({
    id: S.sopTlcPlate,
    teamspaceId: TS.analytics,
    title: "SOP: TLC plate spotting and development",
    icon: "📍",
    position: 4,
    purpose: "Spot, develop, and visualize a TLC plate to compare Rf values of mixture components.",
    materials: ["Silica TLC plate", "Capillary tubes", "Developing chamber + lid", "Pencil + ruler", "UV lamp / iodine chamber"],
    steps: [
      "Draw a faint pencil baseline 1 cm from the bottom edge.",
      "Spot samples at marked positions; let each spot dry between applications.",
      "Pre-equilibrate the developing chamber with ~5 mL of solvent for 5 min.",
      "Place the plate in the chamber with the baseline above the solvent level.",
      "Develop until the front reaches ~1 cm from the top; mark the front.",
      "Visualize under UV (254 nm) or with iodine; circle spots in pencil; calculate Rf.",
    ],
    notes: [
      "Spot diameter <2 mm — fat spots smear during development.",
      "If the front isn't a straight line, the chamber wasn't equilibrated.",
    ],
    usedIn: [{ id: E.expTlc, title: "Thin Layer Chromatography of Plant Pigments" }],
  }),
];

const analyticsLanding = landingPage({
  id: LP.analytics,
  teamspaceId: TS.analytics,
  title: "📈 Analytical & Materials",
  icon: "📈",
  intro: "Chromatography, spectroscopy, and physical-property characterization.",
  experiments: [
    { id: E.expTlc, title: "Thin Layer Chromatography" },
    { id: E.expUvVis, title: "UV-Vis Spectroscopy: Beer-Lambert" },
    { id: E.expMeltPoint, title: "Melting Point Determination" },
  ],
  sops: [{ id: S.sopTlcPlate, title: "SOP: TLC plate spotting and development" }],
  findings: [],
});

// GENERAL SPACE — preserved spirit of the previous demo ───────────────
const generalPages: PageSpec[] = [
  generalPage({
    id: G.welcome,
    title: "Welcome to SymbioKnowledgeBase",
    icon: "👋",
    position: 0,
    oneLiner: "Lab knowledge base linked to ExpTube and ChemELN",
    summary:
      "Welcome page. Explains how the SKB demo content is organized — five experimental teamspaces, plus general guidance pages, all linked across the knowledge graph.",
    content: doc(
      heading(1, "Welcome to SymbioKnowledgeBase"),
      paragraph(text("This workspace is the lab knowledge layer that sits alongside the ExpTube experiment-recording app and the ChemELN electronic lab notebook. The demo content here mirrors live experiments running in those systems.")),
      heading(2, "Where to start"),
      bulletListNodes(
        [text("Experimental teamspaces — "), wikilink(LP.molbio, "Molecular Biology"), text(", "), wikilink(LP.orgsynth, "Organic Synthesis"), text(", "), wikilink(LP.protein, "Protein Biochemistry"), text(", "), wikilink(LP.cellbio, "Cell Biology"), text(", "), wikilink(LP.analytics, "Analytical & Materials")],
        [text("General guidance — "), wikilink(G.onboarding, "Onboarding Guide"), text(", "), wikilink(G.dbAccess, "Database Access Instructions"), text(", "), wikilink(G.safety, "Safety Protocols")],
        [text("Cross-cutting — "), wikilink(G.findingsIndex, "Findings Index"), text(" (sortable table of all findings)")],
      ),
      heading(2, "How content is organized"),
      bulletList(
        "Each experimental teamspace contains experiment pages, SOPs, findings, and reagent/equipment notes — all cross-linked.",
        "Experiment pages cite the source-of-truth IDs in ExpTube and ChemELN at the top.",
        "Findings appear both as pages (for graph view) and as rows in the Findings Index database (for sortable / filterable listings).",
      ),
    ),
  }),
  generalPage({
    id: G.onboarding,
    title: "Onboarding Guide",
    icon: "🚪",
    position: 1,
    oneLiner: "First steps for new lab members",
    summary: "Walks new lab members through account setup, finding the right teamspace, and the conventions used across SKB content.",
    content: doc(
      heading(1, "Onboarding Guide"),
      paragraph(text("If you've just joined the lab, this is the page to read first.")),
      heading(2, "Accounts"),
      bulletList(
        "You sign in with Google — the same account works in ExpTube and ChemELN.",
        "Talk to the lab manager about which teamspaces you should be added to.",
      ),
      heading(2, "Conventions"),
      bulletList(
        "Each experiment in ExpTube has a corresponding page here. Find it via the matching teamspace.",
        "When you create a new finding, link it back to at least one experiment and (when relevant) at least one related finding.",
        "Don't paste lab procedures into experiment pages — link out to the SOP page instead.",
      ),
    ),
  }),
  generalPage({
    id: G.dbAccess,
    title: "Database Access Instructions",
    icon: "🗄️",
    position: 2,
    oneLiner: "Where to find the upstream ExpTube and ChemELN data",
    summary: "Pointers to the running ExpTube and ChemELN systems, including local URLs and the Tailscale-mapped versions.",
    content: doc(
      heading(1, "Database Access Instructions"),
      paragraph(text("SKB does not store experimental procedures or AI-extracted protocol analyses. Those live in the upstream systems below.")),
      heading(2, "ExpTube (videos + AI analysis)"),
      bulletList(
        "Local: http://localhost:3002",
        "Tailscale: https://martins-macbook-pro.tail4a14c4.ts.net:3002",
        "Postgres (read-only): localhost:54342, db `postgres`, schema `public`.",
      ),
      heading(2, "ChemELN (planning + procedures)"),
      bulletList(
        "Local: http://localhost:3001",
        "Tailscale: https://martins-macbook-pro.tail4a14c4.ts.net:3001",
        "Postgres (read-only): localhost:54332, db `postgres`, schema `public`.",
      ),
      heading(2, "Auth"),
      paragraph(text("All three apps share auth via the ExpTube Supabase on port 54341. Sign in once with Google; the session works across the trio.")),
    ),
  }),
  generalPage({
    id: G.equipManuals,
    title: "Equipment Operation Manuals",
    icon: "⚙️",
    position: 3,
    oneLiner: "Index of equipment and reagent reference notes",
    summary: "Index of the per-instrument and per-reagent reference notes scattered across teamspaces.",
    content: doc(
      heading(1, "Equipment Operation Manuals"),
      paragraph(text("Quick links to instrument quirks, calibration logs, and reagent recipes used across the lab.")),
      bulletListNodes(
        [wikilink(R.regNanoDrop, "NanoDrop One — quirks and calibration")],
        [wikilink(R.regGelRig, "Gel rig — Bio-Rad Sub-Cell GT — known issues")],
        [wikilink(R.regTaeStock, "TAE 50× stock — recipe and shelf life")],
        [wikilink(R.regSulfuric, "Sulfuric acid — handling and disposal")],
        [wikilink(R.regCompCells, "Competent cells — handling and storage")],
      ),
    ),
  }),
  generalPage({
    id: G.safety,
    title: "Safety Protocols & Compliance",
    icon: "🛡️",
    position: 4,
    oneLiner: "Lab safety baseline and where to find specifics",
    summary: "Baseline safety expectations and pointers to specific reagent-handling pages.",
    content: doc(
      heading(1, "Safety Protocols & Compliance"),
      paragraph(text("PPE: lab coat, gloves, safety glasses at all times. Closed-toe shoes. No eating in the lab.")),
      heading(2, "Specific hazards"),
      bulletListNodes(
        [text("Strong acids — see "), wikilink(R.regSulfuric, "Sulfuric acid — handling and disposal")],
        [text("UV transilluminator — face shield mandatory; see "), wikilink(R.regGelRig, "Gel rig — Bio-Rad Sub-Cell GT")],
        [text("Acrylamide solutions are neurotoxic; gloves at all times — see "), wikilink(S.sopSdsPage, "SOP: SDS-PAGE casting and running")],
      ),
      heading(2, "Incident reporting"),
      paragraph(text("Any spill, cut, or near-miss must be reported the same day in the lab incident log on the door of the prep room.")),
    ),
  }),
  generalPage({
    id: G.orgPolicies,
    title: "Organization Policies & Instructions",
    icon: "📑",
    position: 5,
    oneLiner: "Hours, supplies, ordering, and cross-team conventions",
    summary: "Operational policies — lab hours, ordering, shared-resource etiquette.",
    content: doc(
      heading(1, "Organization Policies & Instructions"),
      heading(2, "Lab hours"),
      paragraph(text("Open access 7 AM – 10 PM weekdays. After-hours work needs a buddy and approval from the safety officer.")),
      heading(2, "Ordering supplies"),
      bulletList(
        "Routine consumables: log requests in the shared spreadsheet; orders placed every Tuesday.",
        "Specialty reagents: include vendor + catalog number + intended experiment.",
        "Hazardous materials: extra approval — talk to the lab manager first.",
      ),
      heading(2, "Shared-resource etiquette"),
      bulletList(
        "Sign up for the NanoDrop and SDS-PAGE rig in 30-min slots on the calendar.",
        "Clean up your bench area before leaving — no exceptions.",
        "If you break it, you log it. Don't just put it back.",
      ),
    ),
  }),
];

// FINDINGS INDEX page (general space, top level) — host page for the Findings Database.
const findingsIndexPage: PageSpec = generalPage({
  id: G.findingsIndex,
  title: "Findings Index",
  icon: "🗃️",
  position: 6,
  oneLiner: "Sortable / filterable index of all lab findings",
  summary: "Database view of every finding across all teamspaces. Sort by status, topic, severity, or source experiment.",
  content: doc(
    heading(1, "Findings Index"),
    paragraph(text("Every Finding page also appears as a row here, with structured properties for sort + filter. The graph view shows the same set as nodes with edges to source experiments.")),
    paragraph(text("Use this database for queries like 'show me all yield-related findings' or 'show me everything with severity = critical'. For a free-form browse, click into any teamspace landing page.")),
  ),
});

// Combine all pages.
pages.push(
  // Landings
  molbioLanding,
  orgsynthLanding,
  proteinLanding,
  cellbioLanding,
  analyticsLanding,
  // Experiments
  ...molbioExperiments,
  ...orgsynthExperiments,
  ...proteinExperiments,
  ...cellbioExperiments,
  ...analyticsExperiments,
  // SOPs
  ...molbioSops,
  ...orgsynthSops,
  ...proteinSops,
  ...cellbioSops,
  ...analyticsSops,
  // Findings
  ...molbioFindings,
  ...orgsynthFindings,
  ...proteinFindings,
  ...cellbioFindings,
  // Reagent / equipment notes
  ...molbioReagents,
  ...orgsynthReagents,
  ...cellbioReagents,
  // General space
  ...generalPages,
  findingsIndexPage,
);

// ── Findings Index database row data ─────────────────────────────────
type FindingRow = {
  pageId: string;
  title: string;
  status: "open" | "validated" | "archived";
  topic: string;
  severity: "info" | "warning" | "critical";
  sourceExperiment: string; // e.g. "EXP-2026-0102"
};

const findingRows: FindingRow[] = [
  { pageId: F.findPlasmidYield,    title: "Plasmid yield drops past 16 h overnight",    status: "validated", topic: "yield",         severity: "warning", sourceExperiment: "EXP-2026-0102" },
  { pageId: F.findGelResolution,   title: "1% TAE for 0.5–10 kb; TBE for >10 kb",        status: "validated", topic: "method",        severity: "info",    sourceExperiment: "EXP-2026-0103" },
  { pageId: F.find260280,          title: "260/280 <1.8 indicates RNA carry-over",       status: "validated", topic: "purity",        severity: "warning", sourceExperiment: "EXP-2026-0101" },
  { pageId: F.findPcrCleanup,      title: "PCR cleanup recovery 60–75%",                 status: "validated", topic: "yield",         severity: "info",    sourceExperiment: "EXP-2026-0106" },
  { pageId: F.findAspirinYield,    title: "Aspirin yield drops with old reagent",        status: "validated", topic: "yield",         severity: "warning", sourceExperiment: "ELN-001" },
  { pageId: F.findGrignardAnhydrous,title:"Anhydrous conditions critical for Grignard",  status: "validated", topic: "technique",     severity: "critical",sourceExperiment: "ELN-002" },
  { pageId: F.findBradfordRange,   title: "Bradford non-linear above ~1 mg/mL",          status: "validated", topic: "instrument",    severity: "warning", sourceExperiment: "ELN-006" },
  { pageId: F.findGelLaneWarp,     title: "Lane warping in 12% gels at high V",          status: "validated", topic: "method",        severity: "warning", sourceExperiment: "ELN-008" },
  { pageId: F.findPgloThaw,        title: "pGLO efficiency drops on second thaw",        status: "validated", topic: "competent cells",severity: "warning",sourceExperiment: "ELN-013" },
];

// ── Cross-cluster extra links (for graph density) ────────────────────
// Most edges already added by the page builders. Add a few sideways ones
// to surface relationships across teamspaces.
const crossLinks: Array<[string, string]> = [
  // Findings linking sideways across teamspaces
  [F.findGelLaneWarp, F.findGelResolution], // protein lane warp ↔ molbio gel resolution
  [F.findBradfordRange, F.find260280],      // both about ratio/range
  // SOPs reused conceptually
  [S.sopElectrophoresis, S.sopSdsPage],     // gel-running technique kinship
  [S.sopRecrystal, S.sopReflux],            // canonical org-chem pair
  // Equipment notes referenced beyond their teamspace
  [G.equipManuals, R.regNanoDrop],
  [G.equipManuals, R.regGelRig],
  [G.equipManuals, R.regTaeStock],
  [G.equipManuals, R.regSulfuric],
  [G.equipManuals, R.regCompCells],
  // Findings index → all findings (so it's a real hub in the graph)
  [G.findingsIndex, F.findPlasmidYield],
  [G.findingsIndex, F.findGelResolution],
  [G.findingsIndex, F.find260280],
  [G.findingsIndex, F.findPcrCleanup],
  [G.findingsIndex, F.findAspirinYield],
  [G.findingsIndex, F.findGrignardAnhydrous],
  [G.findingsIndex, F.findBradfordRange],
  [G.findingsIndex, F.findGelLaneWarp],
  [G.findingsIndex, F.findPgloThaw],
  // Welcome → landing pages for sidebar discoverability
  [G.welcome, LP.molbio],
  [G.welcome, LP.orgsynth],
  [G.welcome, LP.protein],
  [G.welcome, LP.cellbio],
  [G.welcome, LP.analytics],
  [G.welcome, G.findingsIndex],
];
for (const [a, b] of crossLinks) link(a, b);

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding demo data (experimental knowledge graph)…\n");

  // ── Step 1: targeted cleanup of OLD seed namespace ─────────────────
  console.log("[1] Cleaning up old-namespace seed content…");

  // Find old pages first so we can decrement Tenant.storageUsed for any
  // file attachments that point at them. Includes the seed.ts welcome page
  // (00000000-…0010) which we replace with our own G.welcome.
  const oldPages = await prisma.page.findMany({
    where: {
      tenantId: TENANT_ID,
      OR: [
        { id: { startsWith: OLD_PAGE_PREFIX } },
        { id: SEED_TS_WELCOME_PAGE_ID },
      ],
    },
    select: { id: true },
  });
  const oldPageIds = oldPages.map((p) => p.id);

  if (oldPageIds.length > 0) {
    const orphanedFiles = await prisma.fileAttachment.findMany({
      where: { tenantId: TENANT_ID, pageId: { in: oldPageIds } },
      select: { fileSize: true },
    });
    const reclaimedBytes = orphanedFiles.reduce(
      (acc, f) => acc + (typeof f.fileSize === "bigint" ? f.fileSize : BigInt(f.fileSize ?? 0)),
      0n,
    );
    if (reclaimedBytes > 0n) {
      await prisma.tenant.update({
        where: { id: TENANT_ID },
        data: { storageUsed: { decrement: reclaimedBytes } },
      });
      console.log(`    Reclaimed ${reclaimedBytes} bytes from Tenant.storageUsed.`);
    }
  }

  await prisma.$transaction([
    // Wipe old DBs / DbRows first.
    prisma.dbRow.deleteMany({
      where: {
        tenantId: TENANT_ID,
        OR: [
          { databaseId: { startsWith: OLD_DATABASE_PREFIX } },
          { pageId: { in: oldPageIds } },
        ],
      },
    }),
    prisma.database.deleteMany({
      where: {
        tenantId: TENANT_ID,
        OR: [
          { id: { startsWith: OLD_DATABASE_PREFIX } },
          { pageId: { in: oldPageIds } },
        ],
      },
    }),
    // Explicit cleanup of cascading dependents (Page cascade covers most;
    // belt-and-suspenders for auditability).
    prisma.pageLink.deleteMany({
      where: {
        tenantId: TENANT_ID,
        OR: [
          { sourcePageId: { in: oldPageIds } },
          { targetPageId: { in: oldPageIds } },
        ],
      },
    }),
    prisma.block.deleteMany({
      where: { tenantId: TENANT_ID, pageId: { startsWith: OLD_PAGE_PREFIX } },
    }),
    // Storage hygiene: file attachments + notifications pointed at old pages.
    prisma.fileAttachment.deleteMany({
      where: { tenantId: TENANT_ID, pageId: { startsWith: OLD_PAGE_PREFIX } },
    }),
    prisma.notification.deleteMany({
      where: { tenantId: TENANT_ID, pageId: { startsWith: OLD_PAGE_PREFIX } },
    }),
    prisma.page.deleteMany({
      where: { tenantId: TENANT_ID, id: { in: oldPageIds } },
    }),
    prisma.teamspaceMember.deleteMany({
      where: { teamspaceId: { startsWith: OLD_TEAMSPACE_PREFIX } },
    }),
    prisma.teamspace.deleteMany({
      where: { tenantId: TENANT_ID, id: { startsWith: OLD_TEAMSPACE_PREFIX } },
    }),
  ]);
  console.log(`    Removed ${oldPageIds.length} old-namespace pages and their dependents.`);

  // ── Step 2: ensure dev-mode user + Martin exist ─────────────────────
  console.log("[2] Ensuring user rows exist…");

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      tenantId: TENANT_ID,
      email: "dev@symbio.local",
      name: "Dev User",
      passwordHash: "not-a-real-hash",
      role: "ADMIN",
    },
  });

  // Resolve Martin by email first; fall back to the known Supabase UUID.
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
    console.log("    Created Martin from fallback UUID (no prior Google sign-in).");
  } else {
    console.log(`    Resolved Martin by email: ${martin.id}`);
  }
  const MARTIN_USER_ID = martin.id;

  await prisma.tenantMember.upsert({
    where: { userId_tenantId: { userId: MARTIN_USER_ID, tenantId: TENANT_ID } },
    update: {},
    create: { userId: MARTIN_USER_ID, tenantId: TENANT_ID, role: "owner" },
  });

  // ── Step 3: teamspaces ──────────────────────────────────────────────
  console.log("[3] Upserting teamspaces…");
  const teamspaceSpecs = [
    { id: TS.molbio,    slug: "molbio",    name: "Molecular Biology",      icon: "🧬", description: "DNA/RNA workflows: extraction, mini-prep, gels, PCR, sequencing prep." },
    { id: TS.orgsynth,  slug: "orgsynth",  name: "Organic Synthesis",      icon: "🧪", description: "Classic organic reactions: acetylation, Grignard, esterification, recrystallization." },
    { id: TS.protein,   slug: "protein",   name: "Protein Biochemistry",   icon: "🧫", description: "Protein quantitation, enzyme kinetics, electrophoresis, blotting." },
    { id: TS.cellbio,   slug: "cellbio",   name: "Cell Biology",           icon: "🔬", description: "Cell culture, transformation, microscopy, viability." },
    { id: TS.analytics, slug: "analytics", name: "Analytical & Materials", icon: "📈", description: "TLC, UV-Vis spectroscopy, melting-point characterization." },
  ];
  for (const ts of teamspaceSpecs) {
    await prisma.teamspace.upsert({
      where: { id: ts.id },
      update: { name: ts.name, slug: ts.slug, description: ts.description, icon: ts.icon },
      create: { id: ts.id, tenantId: TENANT_ID, name: ts.name, slug: ts.slug, description: ts.description, icon: ts.icon },
    });
  }

  // ── Step 4: teamspace members (admin + dev + Martin as OWNER) ──────
  console.log("[4] Adding teamspace members (admin + dev + Martin)…");
  const memberUserIds = [ADMIN_USER_ID, DEV_USER_ID, MARTIN_USER_ID];
  for (const ts of teamspaceSpecs) {
    for (const uid of memberUserIds) {
      await prisma.teamspaceMember.upsert({
        where: { teamspaceId_userId: { teamspaceId: ts.id, userId: uid } },
        update: { role: TeamspaceRole.OWNER },
        create: { teamspaceId: ts.id, userId: uid, role: TeamspaceRole.OWNER },
      });
    }
  }

  // ── Step 5: pages + DOCUMENT blocks ────────────────────────────────
  console.log(`[5] Upserting ${pages.length} pages + their DOCUMENT blocks…`);
  // Wipe any stale blocks pointed at the new-namespace pages so a re-run
  // can't leave an old block (under a different id derivation) attached.
  await prisma.block.deleteMany({
    where: { tenantId: TENANT_ID, pageId: { in: pages.map((p) => p.id) } },
  });
  const now = new Date();
  for (const p of pages) {
    await prisma.page.upsert({
      where: { id: p.id },
      update: {
        title: p.title,
        icon: p.icon,
        position: p.position,
        parentId: p.parentId ?? null,
        teamspaceId: p.teamspaceId ?? null,
        spaceType: p.spaceType,
        oneLiner: p.oneLiner,
        summary: p.summary,
        summaryUpdatedAt: now,
        lastAgentVisitAt: now,
      },
      create: {
        id: p.id,
        tenantId: TENANT_ID,
        title: p.title,
        icon: p.icon,
        position: p.position,
        parentId: p.parentId ?? null,
        teamspaceId: p.teamspaceId ?? null,
        spaceType: p.spaceType,
        oneLiner: p.oneLiner,
        summary: p.summary,
        summaryUpdatedAt: now,
        lastAgentVisitAt: now,
      },
    });

    // One DOCUMENT block per page, holding the whole TipTap tree.
    // Derive a unique block id by replacing only the first nibble of the page
    // id (page IDs use f1-f7; blocks shift the leading "f" to "a" → a1-a7).
    // Preserves the namespace byte so different page namespaces don't collide.
    const blockId = "a" + p.id.slice(1);
    const plainText = extractPlainText(p.content).replace(/\s+/g, " ").trim();
    await prisma.block.upsert({
      where: { id: blockId },
      update: {
        content: p.content as object,
        plainText,
        type: BlockType.DOCUMENT,
        position: 0,
      },
      create: {
        id: blockId,
        pageId: p.id,
        tenantId: TENANT_ID,
        type: BlockType.DOCUMENT,
        content: p.content as object,
        position: 0,
        plainText,
      },
    });
  }

  // ── Step 6: page links ──────────────────────────────────────────────
  console.log(`[6] Inserting ${links.length} page links…`);
  // Drop any existing links scoped to the new namespace pages first, so a
  // re-run produces a stable set.
  const newPageIds = pages.map((p) => p.id);
  await prisma.pageLink.deleteMany({
    where: {
      tenantId: TENANT_ID,
      OR: [
        { sourcePageId: { in: newPageIds } },
        { targetPageId: { in: newPageIds } },
      ],
    },
  });
  // De-dupe in case any builder added the same edge twice.
  const seenLinks = new Set<string>();
  const dedupedLinks = links.filter((l) => {
    const k = `${l.source}->${l.target}`;
    if (seenLinks.has(k)) return false;
    seenLinks.add(k);
    return true;
  });
  await prisma.pageLink.createMany({
    data: dedupedLinks.map((l) => ({
      tenantId: TENANT_ID,
      sourcePageId: l.source,
      targetPageId: l.target,
    })),
    skipDuplicates: true,
  });

  // ── Step 7: Findings Index database + rows ─────────────────────────
  console.log("[7] Creating Findings Index database…");
  await prisma.database.upsert({
    where: { id: FINDINGS_DB_ID },
    update: {
      schema: {
        properties: [
          { id: "title",            name: "Title",            type: "title" },
          { id: "status",           name: "Status",           type: "select", options: ["open", "validated", "archived"] },
          { id: "topic",            name: "Topic",            type: "select", options: ["yield", "purity", "method", "instrument", "technique", "competent cells"] },
          { id: "severity",         name: "Severity",         type: "select", options: ["info", "warning", "critical"] },
          { id: "source_experiment",name: "Source experiment",type: "text" },
        ],
      } as object,
      defaultView: "table",
    },
    create: {
      id: FINDINGS_DB_ID,
      pageId: G.findingsIndex,
      tenantId: TENANT_ID,
      schema: {
        properties: [
          { id: "title",            name: "Title",            type: "title" },
          { id: "status",           name: "Status",           type: "select", options: ["open", "validated", "archived"] },
          { id: "topic",            name: "Topic",            type: "select", options: ["yield", "purity", "method", "instrument", "technique", "competent cells"] },
          { id: "severity",         name: "Severity",         type: "select", options: ["info", "warning", "critical"] },
          { id: "source_experiment",name: "Source experiment",type: "text" },
        ],
      } as object,
      defaultView: "table",
    },
  });

  // Wipe rows scoped to this database and re-insert (simpler than per-row upsert).
  await prisma.dbRow.deleteMany({ where: { databaseId: FINDINGS_DB_ID } });
  await prisma.dbRow.createMany({
    data: findingRows.map((r) => ({
      databaseId: FINDINGS_DB_ID,
      tenantId: TENANT_ID,
      pageId: r.pageId,
      properties: {
        title: r.title,
        status: r.status,
        topic: r.topic,
        severity: r.severity,
        source_experiment: r.sourceExperiment,
      } as object,
    })),
  });

  // ── Step 8: validation ─────────────────────────────────────────────
  console.log("[8] Validating final state…");
  const [
    pageCount,
    blockCount,
    linkCount,
    teamspaceCount,
    teamspaceMemberCount,
    dbCount,
    dbRowCount,
    orphanedNotifications,
    orphanedFiles,
  ] = await Promise.all([
    prisma.page.count({ where: { tenantId: TENANT_ID } }),
    prisma.block.count({ where: { tenantId: TENANT_ID } }),
    prisma.pageLink.count({ where: { tenantId: TENANT_ID } }),
    prisma.teamspace.count({ where: { tenantId: TENANT_ID } }),
    prisma.teamspaceMember.count({ where: { teamspace: { tenantId: TENANT_ID } } }),
    prisma.database.count({ where: { tenantId: TENANT_ID } }),
    prisma.dbRow.count({ where: { tenantId: TENANT_ID } }),
    prisma.notification.count({ where: { tenantId: TENANT_ID, pageId: null } }),
    prisma.fileAttachment.count({ where: { tenantId: TENANT_ID, pageId: null } }),
  ]);

  console.log(`    Pages:              ${pageCount}`);
  console.log(`    Blocks:             ${blockCount}`);
  console.log(`    PageLinks:          ${linkCount}`);
  console.log(`    Teamspaces:         ${teamspaceCount}`);
  console.log(`    Teamspace members:  ${teamspaceMemberCount}`);
  console.log(`    Databases:          ${dbCount}`);
  console.log(`    DbRows:             ${dbRowCount}`);
  console.info(`    Orphan notifications (pageId=null): ${orphanedNotifications}`);
  console.info(`    Orphan file attachments (pageId=null): ${orphanedFiles}`);

  if (pageCount === 0) console.warn("[!] WARN: page count is 0 — seed likely failed.");
  if (linkCount === 0) console.warn("[!] WARN: link count is 0 — seed likely failed.");
  if (teamspaceMemberCount < memberUserIds.length * teamspaceSpecs.length) {
    console.warn("[!] WARN: not all expected teamspace memberships present.");
  }

  console.log("\nDemo seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
