/**
 * Seed Script: Demo Cup Experiments (v2)
 *
 * Seeds 6 pages into the Knowledge Base under "Demo Experiments":
 *   - EXP-CUP-001 (EN + DE)
 *   - EXP-CUP-002 (EN + DE)
 *   - Voice Agent Prompt v5.1 (EN + DE)
 *
 * Reads content from data/DEMO_EXPERIMENTS/*.md files.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-experiments.ts
 *   npx tsx scripts/seed-demo-experiments.ts --dry-run
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PrismaClient,
  BlockType,
  SpaceType,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://symbio:symbio_dev_password@localhost:5432/symbio?schema=public";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

const TENANT_ID = "00000000-0000-4000-a000-000000000001";

const DATA_DIR = join(__dirname, "..", "data", "DEMO_EXPERIMENTS");

// Fixed UUIDs for idempotent seeding
const PAGE_IDS = {
  experimentsCategory: "d2000000-0000-4000-a000-000000000001",
  experiment1_en: "d2000000-0000-4000-a000-000000000010",
  experiment1_de: "d2000000-0000-4000-a000-000000000012",
  experiment2_en: "d2000000-0000-4000-a000-000000000011",
  experiment2_de: "d2000000-0000-4000-a000-000000000013",
  voicePrompt_en: "d2000000-0000-4000-a000-000000000020",
  voicePrompt_de: "d2000000-0000-4000-a000-000000000021",
};

const BLOCK_IDS = {
  experiment1_en: "d2100000-0000-4000-a000-000000000010",
  experiment1_de: "d2100000-0000-4000-a000-000000000012",
  experiment2_en: "d2100000-0000-4000-a000-000000000011",
  experiment2_de: "d2100000-0000-4000-a000-000000000013",
  voicePrompt_en: "d2100000-0000-4000-a000-000000000020",
  voicePrompt_de: "d2100000-0000-4000-a000-000000000021",
};

// ─── Markdown to TipTap Converter ────────────────────────────────────────

function textNode(t: string) {
  return { type: "text", text: t };
}

function boldText(t: string) {
  return { type: "text", text: t, marks: [{ type: "bold" }] };
}

function paragraph(...content: unknown[]) {
  if (content.length === 0) return { type: "paragraph" };
  return { type: "paragraph", content };
}

function heading(level: number, t: string) {
  return { type: "heading", attrs: { level }, content: [textNode(t)] };
}

function bulletList(...items: unknown[][]) {
  return {
    type: "bulletList",
    content: items.map((content) => ({
      type: "listItem",
      content: [{ type: "paragraph", content }],
    })),
  };
}

function orderedList(...items: unknown[][]) {
  return {
    type: "orderedList",
    content: items.map((content) => ({
      type: "listItem",
      content: [{ type: "paragraph", content }],
    })),
  };
}

function codeBlock(code: string, language?: string) {
  return {
    type: "codeBlock",
    attrs: { language: language || null },
    content: [textNode(code)],
  };
}

function divider() {
  return { type: "horizontalRule" };
}

function tableNode(rows: string[][]) {
  return {
    type: "table",
    content: rows.map((cells, rowIdx) => ({
      type: "tableRow",
      content: cells.map((cell) => ({
        type: rowIdx === 0 ? "tableHeader" : "tableCell",
        content: [paragraph(textNode(cell))],
      })),
    })),
  };
}

/**
 * Parse a markdown string into a TipTap JSON document.
 * Handles: headings, bullet lists, ordered lists, paragraphs,
 * horizontal rules, code blocks, and simple tables.
 */
function markdownToTiptap(md: string) {
  const lines = md.split("\n");
  const content: unknown[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      content.push(divider());
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      content.push(codeBlock(codeLines.join("\n"), lang));
      i++; // skip closing ```
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        const row = lines[i]
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        // Skip separator rows like |---|---|
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        content.push(tableNode(tableRows));
      }
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      content.push(heading(headingMatch[1].length, headingMatch[2]));
      i++;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: unknown[][] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(parseInlineText(itemText));
        i++;
      }
      content.push(orderedList(...items));
      continue;
    }

    // Bullet list (- or *)
    if (/^[-*]\s/.test(line.trim())) {
      const items: unknown[][] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, "");
        items.push(parseInlineText(itemText));
        i++;
      }
      content.push(bulletList(...items));
      continue;
    }

    // Regular paragraph
    content.push(paragraph(...parseInlineText(line)));
    i++;
  }

  return { type: "doc", content };
}

/**
 * Parse inline markdown: **bold** segments.
 */
function parseInlineText(text: string): unknown[] {
  const parts: unknown[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(textNode(text.slice(lastIndex, match.index)));
    }
    parts.push(boldText(match[1]));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(textNode(text.slice(lastIndex)));
  }

  if (parts.length === 0) {
    parts.push(textNode(text));
  }

  return parts;
}

// ─── Load files ──────────────────────────────────────────────────────────

function loadFile(filename: string): string {
  return readFileSync(join(DATA_DIR, filename), "utf-8");
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no changes will be written\n" : "");
  console.log("Seeding demo cup experiments (v2 — 6 pages)...\n");

  // Load markdown files
  const files = {
    exp1_en: loadFile("EXP-CUP-001_Experiment1.md"),
    exp1_de: loadFile("EXP-CUP-001_Experiment1_DE.md"),
    exp2_en: loadFile("EXP-CUP-002_Experiment2.md"),
    exp2_de: loadFile("EXP-CUP-002_Experiment2_DE.md"),
    prompt_en: loadFile("voice_agent_prompt_v5.md"),
    prompt_de: loadFile("voice_agent_prompt_v5_DE.md"),
  };
  console.log("  Loaded 6 markdown files from data/DEMO_EXPERIMENTS/\n");

  // 1. Find or create "Demo Experiments" category
  const teamspace = await prisma.teamspace.findFirst({
    where: { tenantId: TENANT_ID, name: "Chemistry KB" },
    select: { id: true },
  });
  const teamspaceId = teamspace?.id || null;
  if (teamspaceId) {
    console.log(`  Found Chemistry KB teamspace: ${teamspaceId}`);
  } else {
    console.log(`  Warning: Chemistry KB teamspace not found — pages will be TEAM but unassigned`);
  }

  let experimentsCategoryId = PAGE_IDS.experimentsCategory;
  const existingCategory = await prisma.page.findFirst({
    where: {
      tenantId: TENANT_ID,
      title: "Demo Experiments",
      spaceType: SpaceType.TEAM,
    },
    select: { id: true },
  });

  if (existingCategory) {
    experimentsCategoryId = existingCategory.id;
    console.log(`  Found existing "Demo Experiments" category: ${experimentsCategoryId}`);
  } else {
    console.log(`  Creating "Demo Experiments" category page...`);
    if (!DRY_RUN) {
      await prisma.page.upsert({
        where: { id: experimentsCategoryId },
        update: {},
        create: {
          id: experimentsCategoryId,
          tenantId: TENANT_ID,
          title: "Demo Experiments",
          icon: "🧪",
          oneLiner: "Demo experiment protocols and voice agent prompts (EN + DE)",
          spaceType: SpaceType.TEAM,
          teamspaceId,
          position: 0,
        },
      });
    }
    console.log(`  Created "Demo Experiments" category: ${experimentsCategoryId}`);
  }

  // 2. Define all 6 pages
  const pages = [
    {
      id: PAGE_IDS.experiment1_en,
      blockId: BLOCK_IDS.experiment1_en,
      title: "EXP-CUP-001: Cup Manipulation — Experiment 1",
      oneLiner: "15-step cup manipulation on 3×3 grid — config A, two ninjas, mixed references (EN)",
      icon: "🥤",
      markdown: files.exp1_en,
    },
    {
      id: PAGE_IDS.experiment1_de,
      blockId: BLOCK_IDS.experiment1_de,
      title: "EXP-CUP-001: Bechermanipulation — Experiment 1 (DE)",
      oneLiner: "15-Schritt Bechermanipulation auf 3×3-Raster — Konfiguration A, zwei Ninjas (DE)",
      icon: "🥤",
      markdown: files.exp1_de,
    },
    {
      id: PAGE_IDS.experiment2_en,
      blockId: BLOCK_IDS.experiment2_en,
      title: "EXP-CUP-002: Cup Manipulation — Experiment 2",
      oneLiner: "15-step cup manipulation on 3×3 grid — config B, two ninjas, mixed references (EN)",
      icon: "🥤",
      markdown: files.exp2_en,
    },
    {
      id: PAGE_IDS.experiment2_de,
      blockId: BLOCK_IDS.experiment2_de,
      title: "EXP-CUP-002: Bechermanipulation — Experiment 2 (DE)",
      oneLiner: "15-Schritt Bechermanipulation auf 3×3-Raster — Konfiguration B, zwei Ninjas (DE)",
      icon: "🥤",
      markdown: files.exp2_de,
    },
    {
      id: PAGE_IDS.voicePrompt_en,
      blockId: BLOCK_IDS.voicePrompt_en,
      title: "Voice Agent Prompt v5.1 — Cup Experiments (EN)",
      oneLiner: "System prompt for SymBio voice agent — both experiments, mixed references (EN)",
      icon: "🤖",
      markdown: files.prompt_en,
      asCodeBlock: true,
    },
    {
      id: PAGE_IDS.voicePrompt_de,
      blockId: BLOCK_IDS.voicePrompt_de,
      title: "Sprachagent-Prompt v5.1 — Becherexperimente (DE)",
      oneLiner: "Systemprompt für SymBio Sprachagent — beide Experimente, gemischte Referenzen (DE)",
      icon: "🤖",
      markdown: files.prompt_de,
      asCodeBlock: true,
    },
  ];

  // 3. Upsert each page + block
  for (const page of pages) {
    console.log(`\n  Seeding: ${page.title}`);

    const isPrompt = "asCodeBlock" in page && page.asCodeBlock;
    const tiptapContent = isPrompt
      ? {
          type: "doc",
          content: [
            heading(1, page.title),
            paragraph(textNode(page.oneLiner)),
            divider(),
            heading(2, isPrompt && page.markdown.includes("Deutsch") ? "Vollständiger Systemprompt" : "Full System Prompt"),
            paragraph(
              textNode(
                isPrompt && page.markdown.includes("Deutsch")
                  ? "Der folgende Prompt kann direkt als Systemprompt für den Sprachagenten verwendet werden:"
                  : "The following prompt can be used directly as a system prompt for the voice agent:"
              )
            ),
            codeBlock(page.markdown, "markdown"),
          ],
        }
      : markdownToTiptap(page.markdown);
    const plainText = page.markdown;

    if (!DRY_RUN) {
      await prisma.page.upsert({
        where: { id: page.id },
        update: {
          title: page.title,
          oneLiner: page.oneLiner,
          icon: page.icon,
        },
        create: {
          id: page.id,
          tenantId: TENANT_ID,
          title: page.title,
          icon: page.icon,
          oneLiner: page.oneLiner,
          parentId: experimentsCategoryId,
          spaceType: SpaceType.TEAM,
          teamspaceId,
          position: pages.indexOf(page),
        },
      });

      await prisma.block.upsert({
        where: { id: page.blockId },
        update: {
          content: tiptapContent as object,
          plainText,
        },
        create: {
          id: page.blockId,
          pageId: page.id,
          tenantId: TENANT_ID,
          type: BlockType.DOCUMENT,
          content: tiptapContent as object,
          position: 0,
          plainText,
        },
      });
    }

    console.log(`    Page:  ${page.id}`);
    console.log(`    Block: ${page.blockId}`);
    console.log(`    Text:  ${plainText.length} chars`);
  }

  // 4. Create PageLinks between related pages
  const links = [
    { id: "d2200000-0000-4000-a000-000000000001", source: PAGE_IDS.experiment1_en, target: PAGE_IDS.experiment2_en },
    { id: "d2200000-0000-4000-a000-000000000002", source: PAGE_IDS.experiment1_en, target: PAGE_IDS.experiment1_de },
    { id: "d2200000-0000-4000-a000-000000000003", source: PAGE_IDS.experiment2_en, target: PAGE_IDS.experiment2_de },
    { id: "d2200000-0000-4000-a000-000000000004", source: PAGE_IDS.voicePrompt_en, target: PAGE_IDS.voicePrompt_de },
    { id: "d2200000-0000-4000-a000-000000000005", source: PAGE_IDS.voicePrompt_en, target: PAGE_IDS.experiment1_en },
    { id: "d2200000-0000-4000-a000-000000000006", source: PAGE_IDS.voicePrompt_en, target: PAGE_IDS.experiment2_en },
  ];

  if (!DRY_RUN) {
    for (const link of links) {
      await prisma.pageLink.upsert({
        where: { id: link.id },
        update: {},
        create: {
          id: link.id,
          tenantId: TENANT_ID,
          sourcePageId: link.source,
          targetPageId: link.target,
        },
      });
    }
  }
  console.log(`\n  Created ${links.length} page links (EN↔DE, experiments↔prompt)`);

  console.log("\n✅ Done! 6 pages seeded under Demo Experiments.\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
