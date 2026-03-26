/**
 * Agent-driven knowledge extraction from raw experiment data.
 *
 * Reads experiment KB pages, fetches raw data from upstream sources (ChemELN/ExpTube),
 * uses LLM to extract institutional knowledge (best practices, challenges, recommendations),
 * and appends extracted content to the correct KB page sections.
 *
 * SKB-52.9
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import {
  SUMMARY_LLM_PROVIDER,
  SUMMARY_LLM_MODEL,
  SUMMARY_LLM_API_KEY,
  SUMMARY_LLM_TIMEOUT_MS,
} from "@/lib/summary/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionSource {
  type: "chemeln_procedure" | "exptube_transcription" | "conversation";
  data: Record<string, unknown>;
}

export interface ExtractedKnowledge {
  bestPractices: string[];
  challenges: string[];
  recommendations: string[];
  results: string[];
}

export interface ExtractionResult {
  pageId: string;
  elnId: string;
  title: string;
  extracted: ExtractedKnowledge;
  sectionsUpdated: string[];
  dryRun: boolean;
}

export interface BulkExtractionResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
  results: ExtractionResult[];
}

// ---------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are analyzing raw experiment data to extract institutional knowledge for a chemistry knowledge base.

Given the experiment details and raw data below, extract actionable takeaways that would help someone repeating this experiment or a similar one.

Experiment: {title}
Reaction Type: {reaction_type}
Status: {status}

--- Raw Data ---
{raw_data}

--- Existing KB Content ---
{existing_content}

Extract ONLY what is clearly supported by the data. Do not infer or generalize.
Return JSON with these arrays (each item is a bullet-point string):

{
  "bestPractices": ["Things that worked well, tips for success"],
  "challenges": ["Things that went wrong, pitfalls, difficulties"],
  "recommendations": ["What to do differently next time"],
  "results": ["Notable quantitative or qualitative outcomes"]
}

Rules:
- Be specific and actionable, not generic
- Include measurements, temperatures, times when mentioned
- Skip items that are already covered in the existing KB content
- Each bullet should stand alone without needing the full context
- If no items for a category, return an empty array
- Maximum 5 items per category`;

async function callLLM(prompt: string): Promise<string> {
  if (!SUMMARY_LLM_API_KEY) {
    throw new Error("LLM API key not configured (SUMMARY_LLM_API_KEY)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARY_LLM_TIMEOUT_MS);

  try {
    if (SUMMARY_LLM_PROVIDER === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SUMMARY_LLM_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: SUMMARY_LLM_MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}`);
      }

      const data = (await response.json()) as {
        content: Array<{ text: string }>;
      };
      return data.content[0]?.text || "";
    }

    // Default: OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUMMARY_LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: SUMMARY_LLM_MODEL,
        messages: [
          {
            role: "system",
            content: "You extract institutional knowledge from experiment data. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseExtractionResponse(text: string): ExtractedKnowledge {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const toStringArray = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  };

  return {
    bestPractices: toStringArray(parsed.bestPractices),
    challenges: toStringArray(parsed.challenges),
    recommendations: toStringArray(parsed.recommendations),
    results: toStringArray(parsed.results),
  };
}

// ---------------------------------------------------------------------------
// Page content manipulation
// ---------------------------------------------------------------------------

async function getPageMarkdown(pageId: string, tenantId: string): Promise<string> {
  const block = await prisma.block.findFirst({
    where: { pageId, tenantId, type: "DOCUMENT" },
    select: { content: true },
  });
  if (!block) return "";
  return tiptapToMarkdown(block.content);
}

function appendToSection(
  markdown: string,
  sectionHeading: string,
  newItems: string[],
  attribution: string
): { updated: string; appended: number } {
  if (newItems.length === 0) return { updated: markdown, appended: 0 };

  const lines = markdown.split("\n");
  const headingPattern = new RegExp(`^#{2,3}\\s+${sectionHeading}`, "i");

  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i])) {
      sectionStart = i;
      break;
    }
  }

  if (sectionStart === -1) return { updated: markdown, appended: 0 };

  // Find end of section (next heading of same or higher level)
  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  // Get existing content to deduplicate
  const existingSection = lines.slice(sectionStart + 1, sectionEnd).join("\n").toLowerCase();

  // Filter out items that already exist
  const newUnique = newItems.filter((item) => {
    const normalized = item.toLowerCase().replace(/[^\w\s]/g, "");
    return !existingSection.includes(normalized.slice(0, 40));
  });

  if (newUnique.length === 0) return { updated: markdown, appended: 0 };

  // Remove placeholder text if present
  const placeholderPattern = /^\*.*(?:Add|No|yet).*\*$/i;
  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);
  const filteredSectionLines = sectionLines.filter(
    (line) => !placeholderPattern.test(line.trim()) || line.trim() === ""
  );

  // Build new section content
  const bullets = newUnique.map((item) => `- ${item} *(${attribution})*`);
  const newSection = [...filteredSectionLines, ...bullets];

  // Replace section content
  const result = [
    ...lines.slice(0, sectionStart + 1),
    ...newSection,
    ...lines.slice(sectionEnd),
  ];

  return { updated: result.join("\n"), appended: newUnique.length };
}

async function updatePageContent(
  pageId: string,
  tenantId: string,
  newMarkdown: string
): Promise<void> {
  const { content: tiptap } = markdownToTiptap(newMarkdown);

  await prisma.block.updateMany({
    where: { pageId, tenantId, type: "DOCUMENT" },
    data: {
      content: tiptap as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
    },
  });

  await processAgentWikilinks(pageId, tenantId, tiptap);
}

// ---------------------------------------------------------------------------
// Extraction pipeline
// ---------------------------------------------------------------------------

export async function extractKnowledgeForExperiment(
  tenantId: string,
  pageId: string,
  sources: ExtractionSource[],
  options: { dryRun?: boolean } = {}
): Promise<ExtractionResult> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true },
  });

  if (!page) {
    throw new Error(`Page ${pageId} not found`);
  }

  // Extract ELN ID from title
  const elnMatch = page.title.match(/^(EXP-\d{4}-\d{4})/);
  const elnId = elnMatch ? elnMatch[1] : page.id;

  // Get existing page content
  const existingMarkdown = await getPageMarkdown(pageId, tenantId);

  // Parse experiment metadata from frontmatter
  const reactionTypeMatch = existingMarkdown.match(/\*\*Reaction Type:\*\*\s+\[\[(.+?)\]\]/);
  const statusMatch = existingMarkdown.match(/\*\*Status:\*\*\s+(\w+)/);

  // Build raw data string from sources
  const rawDataParts: string[] = [];
  for (const source of sources) {
    rawDataParts.push(`[${source.type}]`);
    rawDataParts.push(JSON.stringify(source.data, null, 2));
    rawDataParts.push("");
  }

  // Build prompt
  const prompt = EXTRACTION_PROMPT
    .replace("{title}", page.title)
    .replace("{reaction_type}", reactionTypeMatch?.[1] || "Unknown")
    .replace("{status}", statusMatch?.[1] || "unknown")
    .replace("{raw_data}", rawDataParts.join("\n").slice(0, 3000))
    .replace("{existing_content}", existingMarkdown.slice(0, 2000));

  // Call LLM
  const llmResponse = await callLLM(prompt);
  const extracted = parseExtractionResponse(llmResponse);

  const today = new Date().toISOString().split("T")[0];
  const attribution = `extracted ${today}`;

  if (options.dryRun) {
    return {
      pageId,
      elnId,
      title: page.title,
      extracted,
      sectionsUpdated: [],
      dryRun: true,
    };
  }

  // Append extracted content to page sections
  let markdown = existingMarkdown;
  const sectionsUpdated: string[] = [];

  const sectionMap: Array<{ heading: string; items: string[] }> = [
    { heading: "What Works Well", items: extracted.bestPractices },
    { heading: "Common Challenges", items: extracted.challenges },
    { heading: "Recommendations for Next Time", items: extracted.recommendations },
    { heading: "Results & Observations", items: extracted.results },
  ];

  for (const { heading, items } of sectionMap) {
    const { updated, appended } = appendToSection(markdown, heading, items, attribution);
    if (appended > 0) {
      markdown = updated;
      sectionsUpdated.push(heading);
    }
  }

  // Write back if changed
  if (sectionsUpdated.length > 0) {
    await updatePageContent(pageId, tenantId, markdown);
  }

  return {
    pageId,
    elnId,
    title: page.title,
    extracted,
    sectionsUpdated,
    dryRun: false,
  };
}

/**
 * Run extraction for multiple experiments under the Experiments folder.
 */
export async function extractKnowledgeBulk(
  tenantId: string,
  options: { dryRun?: boolean; limit?: number; elnIds?: string[] } = {}
): Promise<BulkExtractionResult> {
  const result: BulkExtractionResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    results: [],
  };

  // Find experiment pages
  const whereClause: Record<string, unknown> = { tenantId };
  if (options.elnIds && options.elnIds.length > 0) {
    whereClause.title = { in: options.elnIds.map((id) => ({ startsWith: id })) };
  }

  const pages = await prisma.page.findMany({
    where: whereClause,
    select: { id: true, title: true },
    take: options.limit || 10,
    orderBy: { updatedAt: "desc" },
  });

  // Filter to only experiment pages (title starts with EXP-)
  const experimentPages = pages.filter((p) => /^EXP-\d{4}-\d{4}/.test(p.title));

  for (const page of experimentPages) {
    try {
      // Get page content to use as source data (the raw experiment info is in the page itself)
      const markdown = await getPageMarkdown(page.id, tenantId);

      // Check if sections are still empty (placeholder text)
      const hasPlaceholder = markdown.includes("*Add your observations") ||
        markdown.includes("*Add best practices") ||
        markdown.includes("*Document pitfalls") ||
        markdown.includes("*What would you do differently");

      if (!hasPlaceholder) {
        result.skipped++;
        continue;
      }

      const sources: ExtractionSource[] = [
        {
          type: "chemeln_procedure",
          data: { pageContent: markdown },
        },
      ];

      const extractionResult = await extractKnowledgeForExperiment(
        tenantId,
        page.id,
        sources,
        { dryRun: options.dryRun }
      );

      result.results.push(extractionResult);
      result.processed++;

      if (extractionResult.sectionsUpdated.length > 0) {
        result.updated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${page.title}: ${msg}`);
    }
  }

  return result;
}
