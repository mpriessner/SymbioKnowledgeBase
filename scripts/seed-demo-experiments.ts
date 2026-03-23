/**
 * Seed Script: Demo Cup Experiments
 *
 * Inserts the two cup-manipulation experiments from the SciSymbioLens
 * voice agent into the Chemistry KB as TEAM space pages.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-experiments.ts
 *   npx tsx scripts/seed-demo-experiments.ts --dry-run
 */

import "dotenv/config";
import {
  PrismaClient,
  BlockType,
  SpaceType,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Fallback to the default Docker Compose DB if DATABASE_URL is not set or has no password
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://symbio:symbio_dev_password@localhost:5432/symbio?schema=public";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

// Use the same tenant/user from the demo seed
const TENANT_ID = "00000000-0000-4000-a000-000000000001";
const ADMIN_USER_ID = "00000000-0000-4000-a000-000000000002";

// Fixed UUIDs for idempotent seeding
const PAGE_IDS = {
  experimentsCategory: "d2000000-0000-4000-a000-000000000001",
  experiment1: "d2000000-0000-4000-a000-000000000010",
  experiment2: "d2000000-0000-4000-a000-000000000011",
};

const BLOCK_IDS = {
  experiment1: "d2100000-0000-4000-a000-000000000010",
  experiment2: "d2100000-0000-4000-a000-000000000011",
};

// ─── TipTap Document Builders ─────────────────────────────────────────────

function text(t: string) {
  return { type: "text", text: t };
}

function paragraph(...content: unknown[]) {
  return { type: "paragraph", content };
}

function heading(level: number, t: string) {
  return { type: "heading", attrs: { level }, content: [text(t)] };
}

function bulletList(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function orderedList(...items: string[]) {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function divider() {
  return { type: "horizontalRule" };
}

// ─── Experiment Content ───────────────────────────────────────────────────

const experiment1Content = doc(
  heading(1, "EXP-CUP-001: Cup Manipulation — Experiment 1"),
  paragraph(text("A structured cup manipulation task on a 3×3 grid. Participant follows 12 sequential steps involving cup placement, swaps, stacking, and object tracking.")),

  heading(2, "Starting Position"),
  bulletList(
    "Cup 3 → A1",
    "Cup 5 → A3",
    "Cup 1 → B2",
    "Cup 4 → C1",
    "Cup 2 → C3"
  ),

  heading(2, "Procedures"),
  orderedList(
    "Place the ring under Cup 1 at B2. Don't look under any cup from now on.",
    "Move Cup 5 from A3 to B1.",
    "Swap Cup 3 with Cup 4. Find both on the grid.",
    "Move the cup at C3 to A3.",
    "Stack Cup 2 on Cup 1. Find Cup 2, place it upside-down on Cup 1.",
    "Place the red die on Cup 5. Find Cup 5 first.",
    "Move the stack at B2 to C3. Both cups together.",
    "Swap the cup at A1 with the cup at C1.",
    "Remove the top cup from C3, place it at A2.",
    "Swap Cup 1 with Cup 3. Find both on the grid.",
    "Move the cup at B1 to B2.",
    "Swap Cup 4 with Cup 2. Find both on the grid."
  ),

  heading(2, "Materials"),
  bulletList(
    "5 numbered cups (Cup 1–5)",
    "1 ring (hidden object)",
    "1 red die",
    "3×3 grid (Rows: A/B/C, Columns: 1/2/3)"
  ),

  heading(2, "Best Practices"),
  bulletList(
    "Read one step at a time and wait for confirmation before proceeding",
    "Never reveal the ring location during the experiment",
    "Never reorder or skip steps",
    "If participant asks about cup location, answer from internal grid state",
    "Allow participant to request pace changes (e.g., two steps at a time)"
  ),

  heading(2, "Common Pitfalls"),
  bulletList(
    "Participants may lose track of stacked cups during step 5 and 7",
    "Swaps (steps 3, 8, 10, 12) are the most error-prone — participant may confuse cup numbers with grid positions",
    "Participants sometimes try to look under cups after step 1"
  ),

  divider(),
  paragraph(text("Grid: Rows A(top) B(mid) C(bottom), Columns 1(left) 2(center) 3(right)."))
);

const experiment2Content = doc(
  heading(1, "EXP-CUP-002: Cup Manipulation — Experiment 2"),
  paragraph(text("A structured cup manipulation task on a 3×3 grid. Variant 2 with different starting positions and step sequence.")),

  heading(2, "Starting Position"),
  bulletList(
    "Cup 2 → A2",
    "Cup 4 → A3",
    "Cup 5 → B1",
    "Cup 1 → C1",
    "Cup 3 → C2"
  ),

  heading(2, "Procedures"),
  orderedList(
    "Place the ring under Cup 5 at B1. Don't look under any cup from now on.",
    "Move Cup 4 from A3 to B3.",
    "Swap Cup 2 with Cup 1. Find both on the grid.",
    "Move the cup at C2 to A1.",
    "Stack Cup 3 on Cup 5. Find Cup 3, place it upside-down on Cup 5.",
    "Place the red die on Cup 4. Find Cup 4 first.",
    "Move the stack at B1 to C3. Both cups together.",
    "Swap the cup at A2 with the cup at C1.",
    "Remove the top cup from C3, place it at A3.",
    "Swap Cup 5 with Cup 2. Find both on the grid.",
    "Move the cup at B3 to B2.",
    "Swap Cup 1 with Cup 3. Find both on the grid."
  ),

  heading(2, "Materials"),
  bulletList(
    "5 numbered cups (Cup 1–5)",
    "1 ring (hidden object)",
    "1 red die",
    "3×3 grid (Rows: A/B/C, Columns: 1/2/3)"
  ),

  heading(2, "Best Practices"),
  bulletList(
    "Read one step at a time and wait for confirmation before proceeding",
    "Never reveal the ring location during the experiment",
    "Never reorder or skip steps",
    "If participant asks about cup location, answer from internal grid state",
    "Allow participant to request pace changes (e.g., two steps at a time)"
  ),

  heading(2, "Common Pitfalls"),
  bulletList(
    "Participants may lose track of stacked cups during step 5 and 7",
    "Swaps (steps 3, 8, 10, 12) are the most error-prone — participant may confuse cup numbers with grid positions",
    "Participants sometimes try to look under cups after step 1"
  ),

  divider(),
  paragraph(text("Grid: Rows A(top) B(mid) C(bottom), Columns 1(left) 2(center) 3(right)."))
);

// ─── Plain text for search indexing ───────────────────────────────────────

const experiment1PlainText = `EXP-CUP-001: Cup Manipulation — Experiment 1
A structured cup manipulation task on a 3×3 grid. Participant follows 12 sequential steps involving cup placement, swaps, stacking, and object tracking.

Starting Position:
Cup 3 → A1, Cup 5 → A3, Cup 1 → B2, Cup 4 → C1, Cup 2 → C3

Procedures:
1. Place the ring under Cup 1 at B2. Don't look under any cup from now on.
2. Move Cup 5 from A3 to B1.
3. Swap Cup 3 with Cup 4. Find both on the grid.
4. Move the cup at C3 to A3.
5. Stack Cup 2 on Cup 1. Find Cup 2, place it upside-down on Cup 1.
6. Place the red die on Cup 5. Find Cup 5 first.
7. Move the stack at B2 to C3. Both cups together.
8. Swap the cup at A1 with the cup at C1.
9. Remove the top cup from C3, place it at A2.
10. Swap Cup 1 with Cup 3. Find both on the grid.
11. Move the cup at B1 to B2.
12. Swap Cup 4 with Cup 2. Find both on the grid.

Materials: 5 numbered cups, 1 ring, 1 red die, 3×3 grid.

Best Practices:
- Read one step at a time and wait for confirmation before proceeding
- Never reveal the ring location during the experiment
- Never reorder or skip steps

Common Pitfalls:
- Participants may lose track of stacked cups during step 5 and 7
- Swaps are the most error-prone`;

const experiment2PlainText = `EXP-CUP-002: Cup Manipulation — Experiment 2
A structured cup manipulation task on a 3×3 grid. Variant 2 with different starting positions and step sequence.

Starting Position:
Cup 2 → A2, Cup 4 → A3, Cup 5 → B1, Cup 1 → C1, Cup 3 → C2

Procedures:
1. Place the ring under Cup 5 at B1. Don't look under any cup from now on.
2. Move Cup 4 from A3 to B3.
3. Swap Cup 2 with Cup 1. Find both on the grid.
4. Move the cup at C2 to A1.
5. Stack Cup 3 on Cup 5. Find Cup 3, place it upside-down on Cup 5.
6. Place the red die on Cup 4. Find Cup 4 first.
7. Move the stack at B1 to C3. Both cups together.
8. Swap the cup at A2 with the cup at C1.
9. Remove the top cup from C3, place it at A3.
10. Swap Cup 5 with Cup 2. Find both on the grid.
11. Move the cup at B3 to B2.
12. Swap Cup 1 with Cup 3. Find both on the grid.

Materials: 5 numbered cups, 1 ring, 1 red die, 3×3 grid.

Best Practices:
- Read one step at a time and wait for confirmation before proceeding
- Never reveal the ring location during the experiment
- Never reorder or skip steps

Common Pitfalls:
- Participants may lose track of stacked cups during step 5 and 7
- Swaps are the most error-prone`;

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no changes will be written\n" : "");
  console.log("Seeding demo cup experiments...\n");

  // 1. Find or create an "Experiments" category page
  //    Check if one already exists (from Chemistry KB setup)
  let experimentsCategoryId = PAGE_IDS.experimentsCategory;

  const existingCategory = await prisma.page.findFirst({
    where: {
      tenantId: TENANT_ID,
      title: "Experiments",
      spaceType: SpaceType.TEAM,
    },
    select: { id: true },
  });

  if (existingCategory) {
    experimentsCategoryId = existingCategory.id;
    console.log(`  Found existing "Experiments" category: ${experimentsCategoryId}`);
  } else {
    console.log(`  Creating "Experiments" category page...`);
    if (!DRY_RUN) {
      await prisma.page.upsert({
        where: { id: experimentsCategoryId },
        update: {},
        create: {
          id: experimentsCategoryId,
          tenantId: TENANT_ID,
          title: "Experiments",
          icon: "🧪",
          oneLiner: "All experiment protocols and results",
          spaceType: SpaceType.TEAM,
          position: 0,
        },
      });
    }
    console.log(`  Created "Experiments" category: ${experimentsCategoryId}`);
  }

  // 2. Create experiment pages
  const experiments = [
    {
      id: PAGE_IDS.experiment1,
      blockId: BLOCK_IDS.experiment1,
      title: "EXP-CUP-001: Cup Manipulation — Experiment 1",
      oneLiner: "12-step cup manipulation task on 3×3 grid — starting config A",
      icon: "🥤",
      content: experiment1Content,
      plainText: experiment1PlainText,
    },
    {
      id: PAGE_IDS.experiment2,
      blockId: BLOCK_IDS.experiment2,
      title: "EXP-CUP-002: Cup Manipulation — Experiment 2",
      oneLiner: "12-step cup manipulation task on 3×3 grid — starting config B",
      icon: "🥤",
      content: experiment2Content,
      plainText: experiment2PlainText,
    },
  ];

  for (const exp of experiments) {
    console.log(`\n  Creating: ${exp.title}`);

    if (!DRY_RUN) {
      // Upsert page
      await prisma.page.upsert({
        where: { id: exp.id },
        update: {
          title: exp.title,
          oneLiner: exp.oneLiner,
          icon: exp.icon,
        },
        create: {
          id: exp.id,
          tenantId: TENANT_ID,
          title: exp.title,
          icon: exp.icon,
          oneLiner: exp.oneLiner,
          parentId: experimentsCategoryId,
          spaceType: SpaceType.TEAM,
          position: experiments.indexOf(exp),
        },
      });

      // Upsert DOCUMENT block with content
      await prisma.block.upsert({
        where: { id: exp.blockId },
        update: {
          content: exp.content as object,
          plainText: exp.plainText,
        },
        create: {
          id: exp.blockId,
          pageId: exp.id,
          tenantId: TENANT_ID,
          type: BlockType.DOCUMENT,
          content: exp.content as object,
          position: 0,
          plainText: exp.plainText,
        },
      });
    }

    console.log(`    Page: ${exp.id}`);
    console.log(`    Block: ${exp.blockId}`);
    console.log(`    Plain text: ${exp.plainText.length} chars`);
  }

  // 3. Create a PageLink between the two experiments (they're related)
  const linkId = "d2200000-0000-4000-a000-000000000001";
  if (!DRY_RUN) {
    await prisma.pageLink.upsert({
      where: { id: linkId },
      update: {},
      create: {
        id: linkId,
        tenantId: TENANT_ID,
        sourcePageId: PAGE_IDS.experiment1,
        targetPageId: PAGE_IDS.experiment2,
      },
    });
  }
  console.log(`\n  Created link: EXP-CUP-001 → EXP-CUP-002`);

  console.log("\n✅ Done! Experiments seeded.\n");

  // 4. Print test commands
  console.log("Test the API with:");
  console.log("  # Experiment context (default depth — titles only)");
  console.log('  curl -H "Authorization: Bearer skb_test" \\');
  console.log('    "http://localhost:3000/api/agent/pages/experiment-context?experimentId=EXP-CUP-001&depth=default"');
  console.log("");
  console.log("  # Experiment context (medium depth — full procedures + best practices)");
  console.log('  curl -H "Authorization: Bearer skb_test" \\');
  console.log('    "http://localhost:3000/api/agent/pages/experiment-context?experimentId=EXP-CUP-001&depth=medium"');
  console.log("");
  console.log("  # Search for cup experiments");
  console.log('  curl -H "Authorization: Bearer skb_test" \\');
  console.log('    "http://localhost:3000/api/agent/search?q=cup+manipulation&depth=medium&scope=team"');
  console.log("");
  console.log("  # Bulk context for both experiments");
  console.log('  curl -X POST -H "Authorization: Bearer skb_test" -H "Content-Type: application/json" \\');
  console.log('    -d \'{"experiments":[{"experimentId":"EXP-CUP-001","depth":"medium"},{"experimentId":"EXP-CUP-002","depth":"default"}],"maxTotalSize":45000}\' \\');
  console.log('    "http://localhost:3000/api/agent/pages/experiment-context/bulk"');
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
