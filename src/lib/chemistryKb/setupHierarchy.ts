/**
 * Setup script for Chemistry KB page hierarchy.
 * Creates root page and all category parent pages with idempotent upsert logic.
 */

import { prisma } from "@/lib/db";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { generateIndexPageContent } from "./indexPage";

export interface CategoryPageConfig {
  key: string;
  title: string;
  icon: string;
  oneLiner: string;
  markdown: string;
}

export interface HierarchyResult {
  rootId: string;
  indexId: string;
  experimentsId: string;
  reactionTypesId: string;
  chemicalsId: string;
  researchersId: string;
  substrateClassesId: string;
  teamspaceId?: string;
}

export interface SetupOptions {
  /** If provided, pages are created with spaceType TEAM and this teamspaceId */
  teamspaceId?: string;
}

const ROOT_PAGE: Omit<CategoryPageConfig, "key"> & { key: "root" } = {
  key: "root",
  title: "Chemistry KB",
  icon: "\u{1F4DA}",
  oneLiner:
    "The institutional knowledge base for chemistry experiments, organized for both human navigation and AI-assisted research.",
  markdown: `# Chemistry KB

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
};

export const CATEGORY_PAGES: CategoryPageConfig[] = [
  {
    key: "experiments",
    title: "Experiments",
    icon: "\u{1F9EA}",
    oneLiner:
      "All chemistry experiments imported from ChemELN, organized for contextual retrieval.",
    markdown: `# Experiments

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
- [[Researchers]]: See experiments grouped by researcher`,
  },
  {
    key: "reactionTypes",
    title: "Reaction Types",
    icon: "\u{1F52C}",
    oneLiner:
      "Aggregated institutional learnings organized by reaction type.",
    markdown: `# Reaction Types

> Aggregated institutional learnings organized by reaction type.

## Overview

Each reaction type page aggregates learnings from all experiments of that type. This includes:
- Common conditions and protocols
- Typical yields and success rates
- Known challenges and mitigations
- Substrate-specific advice

## Browse

Child pages are organized alphabetically by reaction type name.

## Related Pages

- [[Experiments]]: Browse individual experiments
- [[Substrate Classes]]: See substrate-specific patterns`,
  },
  {
    key: "chemicals",
    title: "Chemicals",
    icon: "\u2697\uFE0F",
    oneLiner:
      "Practical notes on chemicals we use frequently, including handling tips and supplier info.",
    markdown: `# Chemicals

> Practical notes on chemicals we use frequently, including handling tips and supplier info.

## Overview

Each chemical page captures practical, institutional knowledge about chemicals used in our lab:
- Handling and storage notes
- Supplier and quality information
- Common uses in our experiments
- Known issues and workarounds

## Browse

Child pages are organized alphabetically by chemical name. Use \`cas:[number]\` tags to search by CAS number.

## Related Pages

- [[Experiments]]: See which experiments use specific chemicals`,
  },
  {
    key: "researchers",
    title: "Researchers",
    icon: "\u{1F469}\u200D\u{1F52C}",
    oneLiner:
      "Researcher profiles showing expertise areas and experiment history.",
    markdown: `# Researchers

> Researcher profiles showing expertise areas and experiment history.

## Overview

Each researcher page aggregates:
- Primary expertise areas
- Experiment count and history
- Reaction types they work with
- Substrate classes they have experience with

## Browse

Child pages are organized alphabetically by researcher name.

## Related Pages

- [[Experiments]]: Browse experiments by researcher
- [[Reaction Types]]: See which researchers work on which reactions`,
  },
  {
    key: "substrateClasses",
    title: "Substrate Classes",
    icon: "\u{1F9EC}",
    oneLiner:
      "Cross-experiment patterns and insights organized by substrate class.",
    markdown: `# Substrate Classes

> Cross-experiment patterns and insights organized by substrate class.

## Overview

Each substrate class page aggregates cross-experiment patterns:
- Common conditions for this substrate class
- Known challenges and mitigations
- Which researchers have experience
- Related reaction types

## Browse

Child pages are organized alphabetically by substrate class name.

## Related Pages

- [[Experiments]]: Browse experiments by substrate class
- [[Reaction Types]]: See which reactions work with which substrates`,
  },
];

async function findOrCreatePage(
  tenantId: string,
  title: string,
  icon: string,
  oneLiner: string,
  markdown: string,
  parentId: string | null,
  options?: { teamspaceId?: string }
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.page.findFirst({
    where: { tenantId, title, parentId },
    select: { id: true },
  });

  if (existing) {
    // Ensure existing page is assigned to teamspace if provided
    if (options?.teamspaceId) {
      await prisma.page.update({
        where: { id: existing.id },
        data: { spaceType: "TEAM", teamspaceId: options.teamspaceId },
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
      ...(options?.teamspaceId
        ? { spaceType: "TEAM", teamspaceId: options.teamspaceId }
        : {}),
    },
  });

  const { content: tiptap } = markdownToTiptap(markdown);
  await prisma.block.create({
    data: {
      tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
      position: 0,
    },
  });
  await processAgentWikilinks(page.id, tenantId, tiptap);

  return { id: page.id, created: true };
}

export async function setupChemistryKbHierarchy(
  tenantId: string,
  options?: SetupOptions
): Promise<HierarchyResult> {
  console.log(`[chemistry-kb] Setting up hierarchy for tenant ${tenantId}...`);

  // Auto-create or find Chemistry KB teamspace if no explicit teamspaceId provided
  let teamspaceId = options?.teamspaceId;
  if (!teamspaceId) {
    const existing = await prisma.teamspace.findFirst({
      where: { tenantId, name: "Chemistry KB" },
      select: { id: true },
    });
    if (existing) {
      teamspaceId = existing.id;
      console.log(`[chemistry-kb] Found existing teamspace: ${teamspaceId}`);
    } else {
      const created = await prisma.teamspace.create({
        data: {
          tenantId,
          name: "Chemistry KB",
          slug: "chemistry-kb",
          description:
            "Institutional chemistry knowledge — experiments, best practices, and procedures",
          icon: "\u{1F4DA}",
        },
      });
      teamspaceId = created.id;
      console.log(`[chemistry-kb] Created teamspace: ${teamspaceId}`);

      // Add all active tenant users as members
      const users = await prisma.user.findMany({
        where: { tenantId, deactivatedAt: null },
        select: { id: true, role: true },
      });
      for (const user of users) {
        await prisma.teamspaceMember.upsert({
          where: {
            teamspaceId_userId: { teamspaceId, userId: user.id },
          },
          create: {
            teamspaceId,
            userId: user.id,
            role: user.role === "ADMIN" ? "ADMIN" : "MEMBER",
          },
          update: {},
        });
      }
      console.log(`[chemistry-kb] Added ${users.length} users as teamspace members`);
    }
  }

  const pageOptions = { teamspaceId };

  // 1. Create root page
  const root = await findOrCreatePage(
    tenantId,
    ROOT_PAGE.title,
    ROOT_PAGE.icon,
    ROOT_PAGE.oneLiner,
    ROOT_PAGE.markdown,
    null,
    pageOptions
  );
  console.log(
    `[chemistry-kb] Root "${ROOT_PAGE.title}": ${root.created ? "CREATED" : "already exists"} (${root.id})`
  );

  // 2. Create category parent pages under root
  const categoryIds: Record<string, string> = {};
  for (const cat of CATEGORY_PAGES) {
    const result = await findOrCreatePage(
      tenantId,
      cat.title,
      cat.icon,
      cat.oneLiner,
      cat.markdown,
      root.id,
      pageOptions
    );
    categoryIds[cat.key] = result.id;
    console.log(
      `[chemistry-kb] Category "${cat.title}": ${result.created ? "CREATED" : "already exists"} (${result.id})`
    );
  }

  // 3. Create index page under root
  const indexMarkdown = generateIndexPageContent();
  const index = await findOrCreatePage(
    tenantId,
    "Chemistry KB Index",
    "\u{1F4CB}",
    "AI agent navigation guide for the chemistry knowledge base.",
    indexMarkdown,
    root.id,
    pageOptions
  );
  console.log(
    `[chemistry-kb] Index "Chemistry KB Index": ${index.created ? "CREATED" : "already exists"} (${index.id})`
  );

  console.log("[chemistry-kb] Hierarchy setup complete.");

  return {
    rootId: root.id,
    indexId: index.id,
    experimentsId: categoryIds.experiments,
    reactionTypesId: categoryIds.reactionTypes,
    chemicalsId: categoryIds.chemicals,
    researchersId: categoryIds.researchers,
    substrateClassesId: categoryIds.substrateClasses,
    teamspaceId,
  };
}
