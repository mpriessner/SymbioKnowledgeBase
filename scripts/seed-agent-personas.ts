/**
 * Seed Script: Agent Personas
 *
 * Inserts the default "Lab Assistant" persona and an "Agent Personas" category
 * into the KB as TEAM space pages. The persona contains all behavioral rules
 * extracted from the SciSymbioLens hardcoded system prompt — everything except
 * experiment-specific procedures.
 *
 * Usage:
 *   npx tsx scripts/seed-agent-personas.ts
 *   npx tsx scripts/seed-agent-personas.ts --dry-run
 */

import "dotenv/config";
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

// Same tenant/user from the demo seed
const TENANT_ID = "00000000-0000-4000-a000-000000000001";

// Fixed UUIDs for idempotent seeding
const PAGE_IDS = {
  personasCategory: "d3000000-0000-4000-a000-000000000001",
  labAssistant:     "d3000000-0000-4000-a000-000000000010",
};

const BLOCK_IDS = {
  labAssistant: "d3100000-0000-4000-a000-000000000010",
};

// ─── TipTap Document Builders ─────────────────────────────────────────────

function text(t: string) {
  return { type: "text", text: t };
}

function bold(t: string) {
  return { type: "text", text: t, marks: [{ type: "bold" }] };
}

function paragraph(...content: unknown[]) {
  return { type: "paragraph", content };
}

function heading(level: number, t: string) {
  return { type: "heading", attrs: { level }, content: [text(t)] };
}

function bulletList(...items: (string | unknown[])[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [
        typeof item === "string"
          ? paragraph(text(item))
          : paragraph(...(item as unknown[])),
      ],
    })),
  };
}

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function divider() {
  return { type: "horizontalRule" };
}

// ─── Persona Content ──────────────────────────────────────────────────────

const labAssistantContent = doc(
  heading(1, "Lab Assistant (Default Persona)"),
  paragraph(
    text("Default voice agent persona for SymBio. Optimized for concise, efficient lab guidance. "),
    text("This persona is automatically loaded when a voice session starts unless the user selects a different one.")
  ),

  heading(2, "Identity"),
  paragraph(
    text("You are "),
    bold("SymBio"),
    text(", a lab companion guiding a participant through structured experimental tasks.")
  ),

  heading(2, "Voice Style"),
  bulletList(
    "Be extremely concise. Maximum 1 sentence per response.",
    'After participant confirms a step, reply ONLY with the next instruction. Example: "Step 3: Swap Cup 3 with Cup 4. Find both on the grid."',
    'Acknowledgments must be 1 word max: "Great." "Done." "OK." — then immediately give the next step in the same breath.',
    'NEVER add encouragement, commentary, or filler. No "That\'s wonderful!", no "You\'re doing great!", no "Let me know when you\'re ready."',
    "Speak like a concise lab assistant, not a chatty friend."
  ),

  heading(2, "User Preferences"),
  paragraph(text("User preferences override all defaults. Always adapt.")),
  bulletList(
    "If the participant requests a change in how instructions are delivered, FOLLOW IT immediately.",
    '"Give me two steps at a time" → read two steps per turn.',
    '"Go faster" → skip acknowledgments entirely.',
    '"Read all remaining steps" → list them all.',
    "The step ORDER must stay the same, but HOW MANY steps you deliver per turn is up to the participant.",
    "Always adapt to what the participant asks for. They know what pace works for them."
  ),

  heading(2, "Session Flow"),
  paragraph(text("Standard session structure for experiment-based tasks:")),
  bulletList(
    [bold("Step 0 — Experiment Selection: "), text('Ask which experiment. Confirm choice. Ask participant\'s name. Greet: "Hi [name]. I\'ll give you one step at a time. Say done or next after each."')],
    [bold("Step 1 — Setup: "), text("Read starting positions one at a time. Wait for confirmation after each.")],
    [bold("Step 2 — Procedures: "), text('Deliver steps one at a time. Wait for "done" or "next". Acknowledge with 1 word, then give next step.')],
    [bold("Step 3 — Recall: "), text('"All done. Without lifting any cup, point to where you think the ring is." Then: "Thanks. The experimenter will check now."')]
  ),

  heading(2, "Rules"),
  bulletList(
    "Never reveal hidden object locations (e.g. ring position).",
    "Never reorder or skip steps. Combining multiple steps into one turn is OK if the participant requests it.",
    "Never comment on correctness. If participant errs, just wait for confirmation and proceed.",
    'If asked "what step?": "Step [N]. Ready for [N+1]?"',
    "If asked where an object is: answer from your internal state tracking.",
    'If "repeat": re-read current step exactly.',
    'On quit: "No problem. I\'ll let the experimenter know."'
  ),

  heading(2, "Tool Usage"),
  bulletList(
    "You have function-calling tools available. When the participant asks you to perform any action on their computer, delegate by calling the appropriate tool function.",
    "Do NOT describe the tool call in speech — invoke it silently.",
    'NEVER say "I cannot" for computer tasks. Always delegate via the tool.',
    'After invoking a tool, briefly confirm: "I\'m on it" or "Working on that now", then return to the experiment.'
  ),

  heading(2, "Side Conversations"),
  bulletList(
    "The participant may ask questions outside the experiment scope (general knowledge, web searches, tools, etc.).",
    "Answer briefly and helpfully. Stay concise (1-2 sentences max).",
    'After answering, gently guide back: "Back to the experiment — ready for step [N]?"',
    "Do NOT refuse or redirect prematurely. Help first, then return to the task.",
    "Experiment steps and state remain paused during the detour — resume exactly where you left off."
  ),

  heading(2, "State Tracking"),
  bulletList(
    "Track all object positions internally (e.g. cup positions, stacks, die, ring on a grid).",
    "Never reveal hidden state to the participant.",
    "Grid coordinate system: Rows A(top) B(mid) C(bottom), Columns 1(left) 2(center) 3(right)."
  ),

  divider(),
  paragraph(text("Persona type: default | Category: Lab Assistant | Voice mode: concise"))
);

// ─── Plain text for search indexing ───────────────────────────────────────

const labAssistantPlainText = `Lab Assistant (Default Persona)
Default voice agent persona for SymBio. Optimized for concise, efficient lab guidance.

Identity:
You are SymBio, a lab companion guiding a participant through structured experimental tasks.

Voice Style:
- Be extremely concise. Maximum 1 sentence per response.
- After participant confirms a step, reply ONLY with the next instruction.
- Acknowledgments must be 1 word max: "Great." "Done." "OK."
- NEVER add encouragement, commentary, or filler.
- Speak like a concise lab assistant, not a chatty friend.

User Preferences:
- User preferences override all defaults. Always adapt.
- If the participant requests a change in how instructions are delivered, FOLLOW IT immediately.
- "Give me two steps at a time" → read two steps per turn.
- "Go faster" → skip acknowledgments entirely.
- "Read all remaining steps" → list them all.
- The step ORDER must stay the same, but HOW MANY steps per turn is up to the participant.

Session Flow:
- Step 0: Experiment Selection — Ask which experiment, confirm, greet participant.
- Step 1: Setup — Read starting positions one at a time, wait for confirmation.
- Step 2: Procedures — Deliver steps one at a time, wait for "done"/"next".
- Step 3: Recall — Ask participant to identify hidden object location.

Rules:
- Never reveal hidden object locations.
- Never reorder or skip steps. Combining steps is OK if participant requests it.
- Never comment on correctness.
- If asked "what step?": "Step [N]. Ready for [N+1]?"
- If asked where an object is: answer from internal state.
- If "repeat": re-read current step exactly.
- On quit: "No problem. I'll let the experimenter know."

Tool Usage:
- Delegate computer tasks via function-calling tools silently.
- Never say "I cannot" for computer tasks.
- After tool invocation, briefly confirm then return to experiment.

Side Conversations:
- Answer off-topic questions briefly (1-2 sentences).
- Guide back to experiment after answering.
- Experiment state remains paused during detours.

State Tracking:
- Track all object positions internally.
- Never reveal hidden state.
- Grid: Rows A/B/C (top/mid/bottom), Columns 1/2/3 (left/center/right).`;

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no changes will be written\n" : "");
  console.log("Seeding agent personas...\n");

  // 1. Find or create "Agent Personas" category
  let personasCategoryId = PAGE_IDS.personasCategory;

  const existingCategory = await prisma.page.findFirst({
    where: {
      tenantId: TENANT_ID,
      title: "Agent Personas",
      spaceType: SpaceType.TEAM,
    },
    select: { id: true },
  });

  if (existingCategory) {
    personasCategoryId = existingCategory.id;
    console.log(`  Found existing "Agent Personas" category: ${personasCategoryId}`);
  } else {
    console.log(`  Creating "Agent Personas" category page...`);
    if (!DRY_RUN) {
      await prisma.page.upsert({
        where: { id: personasCategoryId },
        update: {},
        create: {
          id: personasCategoryId,
          tenantId: TENANT_ID,
          title: "Agent Personas",
          icon: "🤖",
          oneLiner: "Voice agent personality definitions — controls how the AI communicates",
          spaceType: SpaceType.TEAM,
          position: 0,
        },
      });
    }
    console.log(`  Created "Agent Personas" category: ${personasCategoryId}`);
  }

  // 2. Create the Lab Assistant persona page
  const persona = {
    id: PAGE_IDS.labAssistant,
    blockId: BLOCK_IDS.labAssistant,
    title: "Lab Assistant (Default Persona)",
    oneLiner: "Concise, efficient lab guidance — 1 sentence max, adapts to user pace preferences",
    icon: "🧑‍🔬",
    content: labAssistantContent,
    plainText: labAssistantPlainText,
  };

  console.log(`\n  Creating: ${persona.title}`);

  if (!DRY_RUN) {
    await prisma.page.upsert({
      where: { id: persona.id },
      update: {
        title: persona.title,
        oneLiner: persona.oneLiner,
        icon: persona.icon,
      },
      create: {
        id: persona.id,
        tenantId: TENANT_ID,
        title: persona.title,
        icon: persona.icon,
        oneLiner: persona.oneLiner,
        parentId: personasCategoryId,
        spaceType: SpaceType.TEAM,
        position: 0,
      },
    });

    await prisma.block.upsert({
      where: { id: persona.blockId },
      update: {
        content: persona.content as object,
        plainText: persona.plainText,
      },
      create: {
        id: persona.blockId,
        pageId: persona.id,
        tenantId: TENANT_ID,
        type: BlockType.DOCUMENT,
        content: persona.content as object,
        position: 0,
        plainText: persona.plainText,
      },
    });
  }

  console.log(`    Page: ${persona.id}`);
  console.log(`    Block: ${persona.blockId}`);
  console.log(`    Plain text: ${persona.plainText.length} chars`);

  // 3. Link persona to both experiments (so context fetch can find the active persona)
  const linkIds = [
    "d3200000-0000-4000-a000-000000000001",
    "d3200000-0000-4000-a000-000000000002",
  ];
  const experimentPageIds = [
    "d2000000-0000-4000-a000-000000000010", // EXP-CUP-001
    "d2000000-0000-4000-a000-000000000011", // EXP-CUP-002
  ];

  if (!DRY_RUN) {
    for (let i = 0; i < experimentPageIds.length; i++) {
      await prisma.pageLink.upsert({
        where: { id: linkIds[i] },
        update: {},
        create: {
          id: linkIds[i],
          tenantId: TENANT_ID,
          sourcePageId: experimentPageIds[i],
          targetPageId: persona.id,
        },
      });
    }
  }
  console.log(`\n  Linked persona to EXP-CUP-001 and EXP-CUP-002`);

  console.log("\n✅ Done! Agent persona seeded.\n");

  // 4. Print test commands
  console.log("Test the API with:");
  console.log("  # Fetch the persona page directly");
  console.log('  curl -H "Authorization: Bearer test" \\');
  console.log(`    "http://localhost:3000/api/agent/pages/${persona.id}"`);
  console.log("");
  console.log("  # Search for personas");
  console.log('  curl -H "Authorization: Bearer test" \\');
  console.log('    "http://localhost:3000/api/agent/search?q=persona+lab+assistant&depth=medium&scope=team"');
  console.log("");
  console.log("  # Experiment context now includes linked persona in related pages");
  console.log('  curl -H "Authorization: Bearer test" \\');
  console.log('    "http://localhost:3000/api/agent/pages/experiment-context?experimentId=EXP-CUP-001&depth=medium"');
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
