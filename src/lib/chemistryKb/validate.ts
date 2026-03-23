import { ChemPageType } from "./types";
import { isValidTagFormat } from "./tags";
import {
  generateExperimentPage,
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
} from "./templates";
import {
  ALL_SAMPLE_CHEMICALS,
  ALL_SAMPLE_EXPERIMENTS,
  ALL_SAMPLE_PAGE_TITLES,
  SYNONYM_MAP,
  sampleDrMueller,
  sampleSuzukiCoupling,
  sampleHeteroarylHalides,
} from "./sampleData";
import { validateFrontmatter } from "./validateFrontmatter";

export interface PageValidationResult {
  pageTitle: string;
  pageType: ChemPageType;
  pass: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationReport {
  tenantId: string;
  totalPages: number;
  passed: number;
  failed: number;
  results: PageValidationResult[];
}

interface GeneratedPage {
  title: string;
  type: ChemPageType;
  markdown: string;
}

function parseFrontmatterFromMarkdown(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yamlContent = match[1];
  const result: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of yamlContent.split("\n")) {
    if (currentArrayKey && line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, "").replace(/^"(.*)"$/, "$1");
      currentArray.push(value);
      continue;
    }

    if (currentArrayKey) {
      result[currentArrayKey] = currentArray;
      currentArrayKey = null;
      currentArray = [];
    }

    if (line.match(/^\s+-\s+/)) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (rawValue === "") {
      currentArrayKey = key;
      currentArray = [];
      continue;
    }

    const unquoted = rawValue.replace(/^"(.*)"$/, "$1");

    const num = Number(unquoted);
    if (!isNaN(num) && rawValue !== "" && !/^".*"$/.test(rawValue)) {
      result[key] = num;
    } else {
      result[key] = unquoted;
    }
  }

  if (currentArrayKey) {
    result[currentArrayKey] = currentArray;
  }

  return result;
}

function extractWikilinks(markdown: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(markdown)) !== null) {
    links.push(m[1]);
  }
  return links;
}

function extractTags(frontmatter: Record<string, unknown>): string[] {
  const tags = frontmatter["tags"];
  if (Array.isArray(tags)) return tags.map(String);
  return [];
}

function validatePage(page: GeneratedPage): PageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate frontmatter is present
  const fmMatch = page.markdown.match(/^---\n[\s\S]*?\n---/);
  if (!fmMatch) {
    errors.push("No valid YAML frontmatter found");
    return { pageTitle: page.title, pageType: page.type, pass: false, errors, warnings };
  }

  // 2. Parse and validate frontmatter fields
  const frontmatter = parseFrontmatterFromMarkdown(page.markdown);
  const fmValidation = validateFrontmatter(page.type, frontmatter);
  if (!fmValidation.valid) {
    errors.push(...fmValidation.errors);
  }

  // 3. Validate tags
  const tags = extractTags(frontmatter);
  for (const tag of tags) {
    if (!isValidTagFormat(tag)) {
      errors.push(`Invalid tag format: "${tag}"`);
    }
  }

  // 4. Validate wikilinks reference known pages or synonyms
  const wikilinks = extractWikilinks(page.markdown);
  const knownTitles = new Set(ALL_SAMPLE_PAGE_TITLES);
  const knownSynonyms = new Set(Object.keys(SYNONYM_MAP));

  for (const link of wikilinks) {
    if (!knownTitles.has(link) && !knownSynonyms.has(link)) {
      warnings.push(`Wikilink [[${link}]] does not match any known page title or synonym`);
    }
  }

  // 5. Validate required sections based on page type
  const content = page.markdown.slice(fmMatch[0].length);
  const sections = content.match(/^## .+$/gm)?.map((s) => s.replace(/^## /, "")) ?? [];

  const requiredSections: Record<ChemPageType, string[]> = {
    [ChemPageType.EXPERIMENT]: [
      "Metadata",
      "Reaction Conditions",
      "Reagents",
      "Procedure",
      "Results",
      "Practical Notes",
    ],
    [ChemPageType.CHEMICAL]: [
      "Properties",
      "Practical Usage Notes",
    ],
    [ChemPageType.REACTION_TYPE]: [
      "Institutional Experience",
      "Key Learnings",
    ],
    [ChemPageType.RESEARCHER]: [
      "Expertise Areas",
      "Recent Experiments",
    ],
    [ChemPageType.SUBSTRATE_CLASS]: [
      "Common Challenges",
      "What Worked",
    ],
  };

  const required = requiredSections[page.type] ?? [];
  for (const section of required) {
    if (!sections.includes(section)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  return {
    pageTitle: page.title,
    pageType: page.type,
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateChemistryKbPages(tenantId: string): ValidationReport {
  const pages: GeneratedPage[] = [];

  // Generate all 11 sample pages
  for (const chem of ALL_SAMPLE_CHEMICALS) {
    pages.push({
      title: chem.name,
      type: ChemPageType.CHEMICAL,
      markdown: generateChemicalPage(chem),
    });
  }

  pages.push({
    title: sampleDrMueller.name,
    type: ChemPageType.RESEARCHER,
    markdown: generateResearcherPage(sampleDrMueller),
  });

  pages.push({
    title: sampleSuzukiCoupling.name,
    type: ChemPageType.REACTION_TYPE,
    markdown: generateReactionTypePage(sampleSuzukiCoupling),
  });

  pages.push({
    title: sampleHeteroarylHalides.name,
    type: ChemPageType.SUBSTRATE_CLASS,
    markdown: generateSubstrateClassPage(sampleHeteroarylHalides),
  });

  for (const exp of ALL_SAMPLE_EXPERIMENTS) {
    pages.push({
      title: exp.title,
      type: ChemPageType.EXPERIMENT,
      markdown: generateExperimentPage(exp),
    });
  }

  // Validate each page
  const results = pages.map(validatePage);

  return {
    tenantId,
    totalPages: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}
