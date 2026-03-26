/**
 * Intelligent KB Query Engine for Story 36.1.
 *
 * Processes natural language questions from the voice agent / text chat:
 * 1. Classifies query intent (safety, procedure, expertise, etc.)
 * 2. Extracts the target entity (chemical, experiment, reaction type)
 * 3. Searches the knowledge graph with appropriate depth
 * 4. Builds typed context blocks for LLM system prompt injection
 * 5. Synthesizes a speakable answer
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import {
  depthSearch,
  type SearchDepth,
  type DepthSearchResultItem,
} from "@/lib/search/depthSearch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueryIntent =
  | "safety"
  | "properties"
  | "procedure"
  | "expertise"
  | "related"
  | "reaction"
  | "general";

export type ContextBlockType =
  | "chemical_safety"
  | "chemical_properties"
  | "procedure"
  | "institutional_practice"
  | "related_experiment"
  | "researcher_expertise"
  | "reaction_type"
  | "general_knowledge";

export interface ContextBlock {
  type: ContextBlockType;
  entity: string | null;
  entity_id: string | null;
  content: string;
  relevance: number;
  source_page: string;
}

export interface QueryMetadata {
  intent: QueryIntent;
  search_depth: SearchDepth;
  pages_searched: number;
  graph_hops: number;
  elapsed_ms: number;
}

export interface KbQueryResult {
  answer: string;
  context_blocks: ContextBlock[];
  query_metadata: QueryMetadata;
}

export interface KbQueryOptions {
  query: string;
  tenantId: string;
  experimentId?: string;
  sessionId?: string;
  depth?: SearchDepth;
  maxBlocks?: number;
}

// ---------------------------------------------------------------------------
// Step 1: Intent Classification
// ---------------------------------------------------------------------------

export function classifyIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  if (
    /safety|hazard|ppe|danger|toxic|handle|precaution|burn|exposure|first.aid|protective|corrosive|flammable/.test(
      q
    )
  )
    return "safety";

  if (
    /concentration|temperature|boiling|melting|density|ph\b|solubility|molecular|formula|weight|mass|appearance/.test(
      q
    )
  )
    return "properties";

  if (
    /how to|procedure|protocol|steps|method|prepare|synthesize|technique|process|calibrat/.test(
      q
    )
  )
    return "procedure";

  if (
    /who (should|can|has|knows)|expert|ask (someone|about)|contact|experience with/.test(
      q
    )
  )
    return "expertise";

  if (
    /related|similar|previous|compare|other experiment|what did we|have we done|earlier/.test(
      q
    )
  )
    return "related";

  if (
    /reaction|mechanism|catalyst|yield|conditions|equilibrium|kinetics|coupling|titrat|synthesis/.test(
      q
    )
  )
    return "reaction";

  return "general";
}

// ---------------------------------------------------------------------------
// Step 2: Entity Extraction
// ---------------------------------------------------------------------------

interface EntityMatch {
  name: string;
  pageId: string;
  type: "chemical" | "reaction" | "experiment" | "researcher";
  category: string | null;
}

async function extractEntity(
  query: string,
  tenantId: string,
  experimentId?: string
): Promise<EntityMatch | null> {
  // Strategy 1: If experiment_id provided, check its linked chemicals/entities
  if (experimentId) {
    const expPage = await prisma.page.findFirst({
      where: { tenantId, title: { startsWith: experimentId } },
      select: { id: true, title: true },
    });

    if (expPage) {
      const links = await prisma.pageLink.findMany({
        where: { sourcePageId: expPage.id, tenantId },
        include: {
          targetPage: {
            select: { id: true, title: true, parentId: true },
          },
        },
      });

      const qLower = query.toLowerCase();
      for (const link of links) {
        if (qLower.includes(link.targetPage.title.toLowerCase())) {
          return {
            name: link.targetPage.title,
            pageId: link.targetPage.id,
            type: "chemical",
            category: null,
          };
        }
      }
    }
  }

  // Strategy 2: Search for entity pages by name in the query
  // Try chemical pages, reaction type pages, researcher pages
  const categories = ["Chemicals", "Reaction Types", "Researchers"];

  for (const cat of categories) {
    const catPage = await prisma.page.findFirst({
      where: { tenantId, title: cat },
      select: { id: true },
    });

    if (!catPage) continue;

    const entityPages = await prisma.page.findMany({
      where: { tenantId, parentId: catPage.id },
      select: { id: true, title: true },
    });

    const qLower = query.toLowerCase();
    // Sort by title length descending to match longest entity name first
    const sorted = entityPages.sort(
      (a, b) => b.title.length - a.title.length
    );

    for (const page of sorted) {
      if (qLower.includes(page.title.toLowerCase())) {
        const type =
          cat === "Chemicals"
            ? "chemical"
            : cat === "Reaction Types"
              ? "reaction"
              : "researcher";
        return {
          name: page.title,
          pageId: page.id,
          type,
          category: cat.toLowerCase().replace(/\s+/g, "_"),
        };
      }
    }

    // Also check common synonyms/abbreviations for chemicals
    if (cat === "Chemicals") {
      // Try matching common abbreviations (NaOH → Sodium Hydroxide, etc.)
      const synonymMap = buildSynonymMap(entityPages);
      for (const [synonym, page] of synonymMap) {
        if (qLower.includes(synonym.toLowerCase())) {
          return {
            name: page.title,
            pageId: page.id,
            type: "chemical",
            category: "chemicals",
          };
        }
      }
    }
  }

  // Strategy 3: Fall back to depth search
  const searchResults = await depthSearch({
    tenantId,
    query,
    depth: "default",
    scope: "team",
    limit: 3,
  });

  if (searchResults.results.length > 0) {
    const top = searchResults.results[0];
    const type = categoryToEntityType(top.category);
    return {
      name: top.title,
      pageId: top.pageId,
      type,
      category: top.category,
    };
  }

  return null;
}

function buildSynonymMap(
  pages: Array<{ id: string; title: string }>
): Map<string, { id: string; title: string }> {
  const map = new Map<string, { id: string; title: string }>();

  // Common chemical abbreviations
  const abbreviations: Record<string, string> = {
    naoh: "Sodium Hydroxide",
    hcl: "Hydrochloric Acid",
    h2so4: "Sulfuric Acid",
    nacl: "Sodium Chloride",
    koh: "Potassium Hydroxide",
    nh3: "Ammonia",
    h2o2: "Hydrogen Peroxide",
    ch3oh: "Methanol",
    c2h5oh: "Ethanol",
    etoh: "Ethanol",
    meoh: "Methanol",
    dmso: "Dimethyl Sulfoxide",
    dmf: "Dimethylformamide",
    thf: "Tetrahydrofuran",
    dcm: "Dichloromethane",
    ether: "Diethyl Ether",
    toluene: "Toluene",
    acetone: "Acetone",
  };

  for (const page of pages) {
    const titleLower = page.title.toLowerCase();
    for (const [abbrev, fullName] of Object.entries(abbreviations)) {
      if (titleLower === fullName.toLowerCase()) {
        map.set(abbrev, page);
      }
    }
  }

  return map;
}

function categoryToEntityType(
  category: string | null
): "chemical" | "reaction" | "experiment" | "researcher" {
  switch (category) {
    case "chemicals":
      return "chemical";
    case "reaction_types":
      return "reaction";
    case "researchers":
      return "researcher";
    case "experiments":
      return "experiment";
    default:
      return "chemical";
  }
}

// ---------------------------------------------------------------------------
// Step 3: Graph Traversal & Content Extraction
// ---------------------------------------------------------------------------

interface PageContent {
  id: string;
  title: string;
  oneLiner: string | null;
  markdown: string;
  category: string | null;
  parentTitle: string | null;
}

async function getPageContent(
  pageId: string,
  tenantId: string
): Promise<PageContent | null> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
    select: {
      id: true,
      title: true,
      oneLiner: true,
      parentId: true,
    },
  });

  if (!page) return null;

  const [block, parent] = await Promise.all([
    prisma.block.findFirst({
      where: { pageId, tenantId, type: "DOCUMENT" },
      select: { content: true },
    }),
    page.parentId
      ? prisma.page.findFirst({
          where: { id: page.parentId, tenantId },
          select: { title: true },
        })
      : null,
  ]);

  const markdown = block ? tiptapToMarkdown(block.content) : "";

  return {
    id: page.id,
    title: page.title,
    oneLiner: page.oneLiner,
    markdown,
    category: parent?.title?.toLowerCase().replace(/\s+/g, "_") || null,
    parentTitle: parent?.title || null,
  };
}

async function getLinkedPages(
  pageId: string,
  tenantId: string
): Promise<
  Array<{
    id: string;
    title: string;
    oneLiner: string | null;
    parentTitle: string | null;
  }>
> {
  const links = await prisma.pageLink.findMany({
    where: { sourcePageId: pageId, tenantId },
    include: {
      targetPage: {
        select: {
          id: true,
          title: true,
          oneLiner: true,
          parentId: true,
        },
      },
    },
    take: 15,
  });

  // Fetch parent titles in parallel
  const parentIds = links
    .map((l) => l.targetPage.parentId)
    .filter((id): id is string => id !== null);

  const parents =
    parentIds.length > 0
      ? await prisma.page.findMany({
          where: { id: { in: [...new Set(parentIds)] }, tenantId },
          select: { id: true, title: true },
        })
      : [];

  const parentMap = new Map(parents.map((p) => [p.id, p.title]));

  return links.map((l) => ({
    id: l.targetPage.id,
    title: l.targetPage.title,
    oneLiner: l.targetPage.oneLiner,
    parentTitle: l.targetPage.parentId
      ? parentMap.get(l.targetPage.parentId) || null
      : null,
  }));
}

async function getBacklinks(
  pageId: string,
  tenantId: string
): Promise<
  Array<{
    id: string;
    title: string;
    oneLiner: string | null;
    parentTitle: string | null;
  }>
> {
  const links = await prisma.pageLink.findMany({
    where: { targetPageId: pageId, tenantId },
    include: {
      sourcePage: {
        select: {
          id: true,
          title: true,
          oneLiner: true,
          parentId: true,
        },
      },
    },
    take: 10,
  });

  const parentIds = links
    .map((l) => l.sourcePage.parentId)
    .filter((id): id is string => id !== null);

  const parents =
    parentIds.length > 0
      ? await prisma.page.findMany({
          where: { id: { in: [...new Set(parentIds)] }, tenantId },
          select: { id: true, title: true },
        })
      : [];

  const parentMap = new Map(parents.map((p) => [p.id, p.title]));

  return links.map((l) => ({
    id: l.sourcePage.id,
    title: l.sourcePage.title,
    oneLiner: l.sourcePage.oneLiner,
    parentTitle: l.sourcePage.parentId
      ? parentMap.get(l.sourcePage.parentId) || null
      : null,
  }));
}

// ---------------------------------------------------------------------------
// Step 4: Build Context Blocks
// ---------------------------------------------------------------------------

function extractSection(markdown: string, sectionName: string): string {
  const lines = markdown.split("\n");
  let capturing = false;
  const captured: string[] = [];
  const pattern = new RegExp(`^#{2,3}\\s+.*${sectionName}`, "i");

  for (const line of lines) {
    if (pattern.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^#{2,3}\s+/.test(line)) break;
      captured.push(line);
    }
  }

  return captured.join("\n").trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function intentToBlockType(
  intent: QueryIntent,
  category: string | null
): ContextBlockType {
  switch (intent) {
    case "safety":
      return "chemical_safety";
    case "properties":
      return "chemical_properties";
    case "procedure":
      return "procedure";
    case "expertise":
      return "researcher_expertise";
    case "related":
      return "related_experiment";
    case "reaction":
      return "reaction_type";
    default:
      break;
  }

  // Infer from category
  switch (category) {
    case "chemicals":
      return "chemical_properties";
    case "reaction_types":
      return "reaction_type";
    case "researchers":
      return "researcher_expertise";
    case "experiments":
      return "related_experiment";
    default:
      return "general_knowledge";
  }
}

function classifyPageAsBlockType(parentTitle: string | null): ContextBlockType {
  switch (parentTitle) {
    case "Chemicals":
      return "chemical_properties";
    case "Reaction Types":
      return "reaction_type";
    case "Researchers":
      return "researcher_expertise";
    case "Experiments":
    case "Archive":
      return "related_experiment";
    default:
      return "general_knowledge";
  }
}

function extractRelevantContent(
  page: PageContent,
  intent: QueryIntent
): string {
  const md = page.markdown;

  switch (intent) {
    case "safety": {
      const safety =
        extractSection(md, "Safety|Hazard") ||
        extractSection(md, "Handling") ||
        extractSection(md, "Institutional Knowledge");
      if (safety) return truncate(safety, 300);
      break;
    }
    case "properties": {
      const props =
        extractSection(md, "Properties") ||
        extractSection(md, "Practical Usage");
      if (props) return truncate(props, 300);
      break;
    }
    case "procedure": {
      const proc =
        extractSection(md, "Procedure|Steps|Protocol") ||
        extractSection(md, "Setup|Preparation");
      if (proc) return truncate(proc, 300);
      break;
    }
    case "expertise": {
      const exp =
        extractSection(md, "Expertise|Specialization") ||
        extractSection(md, "Key Contributions");
      if (exp) return truncate(exp, 300);
      break;
    }
    case "reaction": {
      const rx =
        extractSection(md, "Key Learnings|What Works") ||
        extractSection(md, "Institutional Experience");
      if (rx) return truncate(rx, 300);
      break;
    }
    case "related": {
      const rel =
        extractSection(md, "Results|Observations") ||
        extractSection(md, "What Worked|Practical Notes");
      if (rel) return truncate(rel, 300);
      break;
    }
  }

  // Fallback: use oneLiner or first paragraph
  if (page.oneLiner) return page.oneLiner;

  const firstPara = md
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"))
    .slice(0, 3)
    .join(" ")
    .trim();

  return truncate(firstPara, 300);
}

async function buildContextBlocks(
  intent: QueryIntent,
  entity: EntityMatch | null,
  searchResults: DepthSearchResultItem[],
  tenantId: string,
  maxBlocks: number
): Promise<{ blocks: ContextBlock[]; graphHops: number }> {
  const blocks: ContextBlock[] = [];
  let graphHops = 0;

  // Primary block from the entity page itself
  if (entity) {
    const page = await getPageContent(entity.pageId, tenantId);
    if (page) {
      blocks.push({
        type: intentToBlockType(intent, entity.category),
        entity: entity.name,
        entity_id: entity.pageId,
        content: extractRelevantContent(page, intent),
        relevance: 1.0,
        source_page: page.title,
      });

      // Get linked pages (1-hop)
      const linked = await getLinkedPages(entity.pageId, tenantId);
      graphHops = 1;

      for (const lp of linked) {
        if (blocks.length >= maxBlocks) break;
        const blockType = classifyPageAsBlockType(lp.parentTitle);

        // For safety queries, prioritize institutional knowledge links
        if (intent === "safety" && blockType === "general_knowledge") continue;

        blocks.push({
          type: blockType,
          entity: lp.title,
          entity_id: lp.id,
          content: lp.oneLiner || lp.title,
          relevance: 0.7,
          source_page: lp.title,
        });
      }

      // Get backlinks (experiments that reference this entity)
      if (blocks.length < maxBlocks) {
        const backlinks = await getBacklinks(entity.pageId, tenantId);
        graphHops = 2;

        for (const bl of backlinks) {
          if (blocks.length >= maxBlocks) break;
          const blockType = classifyPageAsBlockType(bl.parentTitle);

          blocks.push({
            type: blockType,
            entity: bl.title,
            entity_id: bl.id,
            content: bl.oneLiner || bl.title,
            relevance: 0.5,
            source_page: bl.title,
          });
        }
      }
    }
  }

  // Fill remaining slots from search results (skip pages already added)
  const addedIds = new Set(blocks.map((b) => b.entity_id).filter(Boolean));

  for (const result of searchResults) {
    if (blocks.length >= maxBlocks) break;
    if (addedIds.has(result.pageId)) continue;

    const blockType =
      result.category === "chemicals"
        ? intent === "safety"
          ? "chemical_safety"
          : "chemical_properties"
        : result.category === "reaction_types"
          ? "reaction_type"
          : result.category === "researchers"
            ? "researcher_expertise"
            : result.category === "experiments"
              ? "related_experiment"
              : "general_knowledge";

    blocks.push({
      type: blockType,
      entity: result.title,
      entity_id: result.pageId,
      content: result.snippet || result.oneLiner || result.title,
      relevance: result.score * 0.6,
      source_page: result.title,
    });
    addedIds.add(result.pageId);
  }

  // Always try to include institutional_practice if we haven't yet
  if (
    !blocks.some((b) => b.type === "institutional_practice") &&
    blocks.length < maxBlocks
  ) {
    const practiceResults = searchResults.filter(
      (r) =>
        r.category === "reaction_types" ||
        r.category === "substrate_classes" ||
        (r.institutionalKnowledge && r.institutionalKnowledge.length > 0)
    );

    for (const pr of practiceResults) {
      if (blocks.length >= maxBlocks) break;
      if (addedIds.has(pr.pageId)) continue;

      if (pr.institutionalKnowledge && pr.institutionalKnowledge.length > 0) {
        blocks.push({
          type: "institutional_practice",
          entity: null,
          entity_id: null,
          content: pr.institutionalKnowledge.slice(0, 3).join(". "),
          relevance: 0.6,
          source_page: pr.title,
        });
        break;
      }
    }
  }

  return { blocks: blocks.slice(0, maxBlocks), graphHops };
}

// ---------------------------------------------------------------------------
// Step 5: Answer Synthesis
// ---------------------------------------------------------------------------

function synthesizeAnswer(
  query: string,
  intent: QueryIntent,
  blocks: ContextBlock[]
): string {
  if (blocks.length === 0) {
    return (
      "I couldn't find specific information about that in the knowledge base. " +
      "Try asking about a specific chemical, procedure, or experiment."
    );
  }

  const intros: Record<QueryIntent, string> = {
    safety: "Here's what I found about safety: ",
    properties: "Here are the relevant properties: ",
    procedure: "Here's the procedure information: ",
    expertise: "Based on the lab records: ",
    related: "Here's what I found about related work: ",
    reaction: "Here's the reaction information: ",
    general: "Here's what I found: ",
  };

  // Take top 2-3 blocks with the most content
  const topBlocks = blocks
    .filter((b) => b.content.length > 20)
    .slice(0, 3);

  if (topBlocks.length === 0) {
    // All blocks have short content — just use the first one
    return intros[intent] + blocks[0].content;
  }

  const parts = topBlocks.map((b) => b.content);
  const answer = intros[intent] + parts.join(" Additionally, ");

  // Cap at 500 chars for speakability
  return truncate(answer, 500);
}

// ---------------------------------------------------------------------------
// Main Query Function
// ---------------------------------------------------------------------------

export async function executeKbQuery(
  options: KbQueryOptions
): Promise<KbQueryResult> {
  const startTime = Date.now();
  const {
    query,
    tenantId,
    experimentId,
    depth = "medium",
    maxBlocks = 5,
  } = options;

  // Step 1: Classify intent
  const intent = classifyIntent(query);

  // Step 2: Extract entity
  const entity = await extractEntity(query, tenantId, experimentId);

  // Step 3: Search
  const categoryFilter = intentToSearchCategory(intent);
  const searchResults = await depthSearch({
    tenantId,
    query,
    depth,
    scope: "team",
    category: categoryFilter,
    limit: 15,
  });

  // If experiment_id provided and intent is "related", also search via experiment links
  if (experimentId && intent === "related") {
    const expPage = await prisma.page.findFirst({
      where: { tenantId, title: { startsWith: experimentId } },
      select: { id: true },
    });

    if (expPage) {
      const relatedLinks = await prisma.pageLink.findMany({
        where: { sourcePageId: expPage.id, tenantId },
        include: {
          targetPage: {
            select: { id: true, title: true, oneLiner: true },
          },
        },
        take: 10,
      });

      // Prepend linked experiment results
      for (const link of relatedLinks) {
        if (
          !searchResults.results.some((r) => r.pageId === link.targetPage.id)
        ) {
          searchResults.results.unshift({
            pageId: link.targetPage.id,
            title: link.targetPage.title,
            oneLiner: link.targetPage.oneLiner,
            score: 0.8,
            category: null,
            space: "team",
          });
        }
      }
    }
  }

  // Step 4: Build context blocks
  const { blocks, graphHops } = await buildContextBlocks(
    intent,
    entity,
    searchResults.results,
    tenantId,
    maxBlocks
  );

  // Step 5: Synthesize answer
  const answer = synthesizeAnswer(query, intent, blocks);

  return {
    answer,
    context_blocks: blocks,
    query_metadata: {
      intent,
      search_depth: depth,
      pages_searched: searchResults.totalCount,
      graph_hops: graphHops,
      elapsed_ms: Date.now() - startTime,
    },
  };
}

function intentToSearchCategory(intent: QueryIntent): string | undefined {
  switch (intent) {
    case "safety":
    case "properties":
      return "chemicals";
    case "procedure":
      return "experiments";
    case "expertise":
      return "researchers";
    case "reaction":
      return "reaction_types";
    default:
      return undefined; // search all categories
  }
}
