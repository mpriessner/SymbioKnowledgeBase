#!/usr/bin/env tsx
/**
 * Seed the Chemistry KB with sample data.
 *
 * This script:
 * 1. Sets up the Chemistry KB page hierarchy (root + categories)
 * 2. Generates chemistry pages from sample data (experiments, chemicals, researcher, reaction type, substrate class)
 * 3. Creates all pages directly in the database via Prisma
 *
 * Usage:
 *   npx tsx scripts/seed-chemistry-kb.ts --tenant <id>
 *   TENANT_ID=<id> npx tsx scripts/seed-chemistry-kb.ts
 */

import { prisma } from "../src/lib/db";
import { markdownToTiptap } from "../src/lib/markdown/deserializer";
import { processAgentWikilinks } from "../src/lib/agent/wikilinks";
import { setupChemistryKbHierarchy } from "../src/lib/chemistryKb/setupHierarchy";
import {
  generateExperimentPage,
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
} from "../src/lib/chemistryKb/templates";
import {
  ALL_SAMPLE_CHEMICALS,
  ALL_SAMPLE_EXPERIMENTS,
  sampleDrMueller,
  sampleSuzukiCoupling,
  sampleHeteroarylHalides,
} from "../src/lib/chemistryKb/sampleData";

async function findOrCreatePage(
  tenantId: string,
  title: string,
  icon: string,
  oneLiner: string,
  markdown: string,
  parentId: string | null,
  forceUpdate = false
): Promise<{ id: string; created: boolean; updated?: boolean }> {
  const existing = await prisma.page.findFirst({
    where: { tenantId, title, parentId },
    select: { id: true },
  });

  if (existing && forceUpdate) {
    // Update existing page content with new template output
    const { content: tiptap } = markdownToTiptap(markdown);
    await prisma.block.deleteMany({ where: { pageId: existing.id, tenantId } });
    await prisma.block.create({
      data: {
        tenantId,
        pageId: existing.id,
        type: "DOCUMENT",
        content: tiptap as Record<string, unknown>,
        position: 0,
      },
    });
    await processAgentWikilinks(existing.id, tenantId, tiptap);
    return { id: existing.id, created: false, updated: true };
  }

  if (existing) {
    return { id: existing.id, created: false };
  }

  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId },
    _max: { position: true },
  });
  const nextPosition = (maxPosition._max.position ?? -1) + 1;

  const page = await prisma.page.create({
    data: {
      tenantId,
      title,
      icon,
      oneLiner,
      parentId,
      position: nextPosition,
    },
  });

  const { content: tiptap } = markdownToTiptap(markdown);
  await prisma.block.create({
    data: {
      tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as Record<string, unknown>,
      position: 0,
    },
  });
  await processAgentWikilinks(page.id, tenantId, tiptap);

  return { id: page.id, created: true };
}

async function main() {
  const args = process.argv.slice(2);

  let tenantId = process.env.TENANT_ID || "";
  let force = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tenant":
        tenantId = args[++i] || "";
        break;
      case "--force":
        force = true;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!tenantId) {
    console.error("Error: tenantId is required.");
    console.error("Usage: npx tsx scripts/seed-chemistry-kb.ts --tenant <id>");
    console.error("   or: TENANT_ID=<id> npx tsx scripts/seed-chemistry-kb.ts");
    process.exit(1);
  }

  console.log(`\n=== Seeding Chemistry KB for tenant: ${tenantId} ===\n`);

  // Step 1: Set up hierarchy (root + categories + index)
  console.log("Step 1: Setting up Chemistry KB hierarchy...");
  const hierarchy = await setupChemistryKbHierarchy(tenantId);
  console.log(`  Root: ${hierarchy.rootId}`);
  console.log(`  Experiments: ${hierarchy.experimentsId}`);
  console.log(`  Chemicals: ${hierarchy.chemicalsId}`);
  console.log(`  Reaction Types: ${hierarchy.reactionTypesId}`);
  console.log(`  Researchers: ${hierarchy.researchersId}`);
  console.log(`  Substrate Classes: ${hierarchy.substrateClassesId}`);

  // Step 2: Create experiment pages
  console.log("\nStep 2: Creating experiment pages...");
  for (const exp of ALL_SAMPLE_EXPERIMENTS) {
    const markdown = generateExperimentPage(exp);
    const result = await findOrCreatePage(
      tenantId,
      exp.title,
      "🧪",
      exp.summary,
      markdown,
      hierarchy.experimentsId,
      force
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${exp.title}`);
  }

  // Step 3: Create chemical pages
  console.log("\nStep 3: Creating chemical pages...");
  for (const chem of ALL_SAMPLE_CHEMICALS) {
    const markdown = generateChemicalPage(chem);
    const result = await findOrCreatePage(
      tenantId,
      chem.name,
      "⚗️",
      chem.summary,
      markdown,
      hierarchy.chemicalsId,
      force
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${chem.name}`);
  }

  // Step 4: Create reaction type page
  console.log("\nStep 4: Creating reaction type pages...");
  const suzukiMarkdown = generateReactionTypePage(sampleSuzukiCoupling);
  const suzukiResult = await findOrCreatePage(
    tenantId,
    sampleSuzukiCoupling.name,
    "🔬",
    sampleSuzukiCoupling.summary,
    suzukiMarkdown,
    hierarchy.reactionTypesId,
    force
  );
  console.log(`  ${suzukiResult.created ? "CREATED" : suzukiResult.updated ? "UPDATED" : "EXISTS"}: ${sampleSuzukiCoupling.name}`);

  // Step 5: Create researcher page
  console.log("\nStep 5: Creating researcher pages...");
  const muellerMarkdown = generateResearcherPage(sampleDrMueller);
  const muellerResult = await findOrCreatePage(
    tenantId,
    sampleDrMueller.name,
    "👩‍🔬",
    sampleDrMueller.summary,
    muellerMarkdown,
    hierarchy.researchersId,
    force
  );
  console.log(`  ${muellerResult.created ? "CREATED" : muellerResult.updated ? "UPDATED" : "EXISTS"}: ${sampleDrMueller.name}`);

  // Step 6: Create substrate class page
  console.log("\nStep 6: Creating substrate class pages...");
  const halideMarkdown = generateSubstrateClassPage(sampleHeteroarylHalides);
  const halideResult = await findOrCreatePage(
    tenantId,
    sampleHeteroarylHalides.name,
    "🧬",
    sampleHeteroarylHalides.summary,
    halideMarkdown,
    hierarchy.substrateClassesId,
    force
  );
  console.log(`  ${halideResult.created ? "CREATED" : halideResult.updated ? "UPDATED" : "EXISTS"}: ${sampleHeteroarylHalides.name}`);

  // Summary
  const totalCreated = [
    ...ALL_SAMPLE_EXPERIMENTS.map(() => 1),
    ...ALL_SAMPLE_CHEMICALS.map(() => 1),
    1, // reaction type
    1, // researcher
    1, // substrate class
  ].length;

  console.log(`\n=== Done! Created up to ${totalCreated} chemistry pages ===`);
  console.log("Visit http://localhost:3000/home to see your Chemistry KB in the sidebar.");
  console.log("Look for the 📚 Chemistry KB page and expand it.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
