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
  ALL_SAMPLE_RESEARCHERS,
  ALL_SAMPLE_REACTION_TYPES,
  ALL_SAMPLE_SUBSTRATE_CLASSES,
} from "../src/lib/chemistryKb/sampleData";

/** Strip markdown syntax to produce plainText for search/graph sizing. */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")     // bold
    .replace(/\*([^*]+)\*/g, "$1")         // italic
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1") // wikilinks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^[-*]\s+/gm, "")            // list markers
    .replace(/`([^`]+)`/g, "$1")           // inline code
    .replace(/\n{3,}/g, "\n\n")            // collapse blank lines
    .trim();
}

async function findOrCreatePage(
  tenantId: string,
  title: string,
  icon: string,
  oneLiner: string,
  markdown: string,
  parentId: string | null,
  forceUpdate = false,
  teamspaceId?: string
): Promise<{ id: string; created: boolean; updated?: boolean }> {
  const existing = await prisma.page.findFirst({
    where: { tenantId, title, parentId },
    select: { id: true },
  });

  if (existing && forceUpdate) {
    // Update existing page content with new template output
    const { content: tiptap } = markdownToTiptap(markdown);
    const plainText = stripMarkdown(markdown);
    // Update oneLiner + teamspace assignment
    await prisma.page.update({
      where: { id: existing.id },
      data: {
        oneLiner: oneLiner || null,
        ...(teamspaceId ? { spaceType: "TEAM" as const, teamspaceId } : {}),
      },
    });
    await prisma.block.deleteMany({ where: { pageId: existing.id, tenantId } });
    await prisma.block.create({
      data: {
        tenantId,
        pageId: existing.id,
        type: "DOCUMENT",
        content: tiptap as Record<string, unknown>,
        plainText,
        position: 0,
      },
    });
    await processAgentWikilinks(existing.id, tenantId, tiptap);
    return { id: existing.id, created: false, updated: true };
  }

  if (existing) {
    // Ensure teamspace assignment even when not force-updating content
    if (teamspaceId) {
      await prisma.page.update({
        where: { id: existing.id },
        data: { spaceType: "TEAM", teamspaceId },
      });
    }
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
      ...(teamspaceId ? { spaceType: "TEAM" as const, teamspaceId } : {}),
    },
  });

  const { content: tiptap } = markdownToTiptap(markdown);
  const plainText = stripMarkdown(markdown);
  await prisma.block.create({
    data: {
      tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as Record<string, unknown>,
      plainText,
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

  // Destructive-op guard: --force rewrites page content and deletes existing
  // blocks for the tenant. Refuse to run it in production, and require an
  // explicit opt-in everywhere else, so it can never be triggered accidentally.
  if (force) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Refusing to run --force seed in production (NODE_ENV=production). " +
          "This rewrites page content and deletes blocks for the tenant."
      );
      process.exit(1);
    }
    if (process.env.ALLOW_DESTRUCTIVE_RESET !== "true") {
      console.error(
        "Refusing to run --force seed: it deletes and rewrites existing Chemistry KB " +
          "content for the tenant. Re-run with ALLOW_DESTRUCTIVE_RESET=true to confirm."
      );
      process.exit(1);
    }
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
      force,
      hierarchy.teamspaceId
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
      force,
      hierarchy.teamspaceId
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${chem.name}`);
  }

  // Step 4: Create reaction type pages
  console.log("\nStep 4: Creating reaction type pages...");
  for (const rt of ALL_SAMPLE_REACTION_TYPES) {
    const markdown = generateReactionTypePage(rt);
    const result = await findOrCreatePage(
      tenantId,
      rt.name,
      "🔬",
      rt.summary,
      markdown,
      hierarchy.reactionTypesId,
      force,
      hierarchy.teamspaceId
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${rt.name}`);
  }

  // Step 5: Create researcher pages
  console.log("\nStep 5: Creating researcher pages...");
  for (const researcher of ALL_SAMPLE_RESEARCHERS) {
    const markdown = generateResearcherPage(researcher);
    const result = await findOrCreatePage(
      tenantId,
      researcher.name,
      "👩‍🔬",
      researcher.summary,
      markdown,
      hierarchy.researchersId,
      force,
      hierarchy.teamspaceId
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${researcher.name}`);
  }

  // Step 6: Create substrate class pages
  console.log("\nStep 6: Creating substrate class pages...");
  for (const sc of ALL_SAMPLE_SUBSTRATE_CLASSES) {
    const markdown = generateSubstrateClassPage(sc);
    const result = await findOrCreatePage(
      tenantId,
      sc.name,
      "🧬",
      sc.summary,
      markdown,
      hierarchy.substrateClassesId,
      force,
      hierarchy.teamspaceId
    );
    console.log(`  ${result.created ? "CREATED" : result.updated ? "UPDATED" : "EXISTS"}: ${sc.name}`);
  }

  // Step 7: Re-process wikilinks now that ALL pages exist
  // (Earlier steps create pages sequentially, so wikilinks from experiments
  //  to chemicals/researchers/etc. couldn't resolve before those pages existed.)
  console.log("\nStep 7: Re-processing wikilinks across all chemistry pages...");
  const allChemPages = await prisma.page.findMany({
    where: {
      tenantId,
      OR: [
        { parentId: hierarchy.experimentsId },
        { parentId: hierarchy.chemicalsId },
        { parentId: hierarchy.reactionTypesId },
        { parentId: hierarchy.researchersId },
        { parentId: hierarchy.substrateClassesId },
      ],
    },
    select: { id: true, title: true },
  });

  let linkCount = 0;
  for (const page of allChemPages) {
    const block = await prisma.block.findFirst({
      where: { pageId: page.id, tenantId, type: "DOCUMENT" },
      select: { content: true },
    });
    if (block?.content) {
      // Count links before
      const before = await prisma.pageLink.count({ where: { sourcePageId: page.id } });
      await processAgentWikilinks(page.id, tenantId, block.content);
      const after = await prisma.pageLink.count({ where: { sourcePageId: page.id } });
      const newLinks = after - before;
      if (newLinks > 0) {
        linkCount += newLinks;
        console.log(`  ${page.title}: +${newLinks} links (total: ${after})`);
      }
    }
  }
  console.log(`  Re-processed ${allChemPages.length} pages, created ${linkCount} new links.`);

  // Summary
  const totalCreated =
    ALL_SAMPLE_EXPERIMENTS.length +
    ALL_SAMPLE_CHEMICALS.length +
    ALL_SAMPLE_REACTION_TYPES.length +
    ALL_SAMPLE_RESEARCHERS.length +
    ALL_SAMPLE_SUBSTRATE_CLASSES.length;

  console.log(`\n=== Done! Created up to ${totalCreated} chemistry pages ===`);
  console.log("Visit http://localhost:3000/home to see your Chemistry KB in the sidebar.");
  console.log("Look for the 📚 Chemistry KB page and expand it.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
