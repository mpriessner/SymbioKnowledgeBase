import { toTitleCase } from "@/lib/chemEln/normalizers/chemicals";

export type PageType =
  | "chemical"
  | "reaction-type"
  | "researcher"
  | "substrate-class"
  | "experiment";

export interface PageInfo {
  name: string;
  normalizedName: string;
  type: PageType;
  matchTag: string;
  id?: string;
  casNumber?: string;
  stubbed: boolean;
}

export interface ChemicalUsage {
  experimentId: string;
  experimentTitle: string;
  role: string;
  amount: number;
  unit: string;
}

export interface LookupChemical {
  id: string;
  name: string;
  casNumber?: string | null;
  molecularFormula?: string | null;
}

export interface LookupReactionType {
  name: string;
  experimentCount: number;
  avgYield: number | null;
  researcherCount: number;
  experiments: unknown[];
  keyLearnings: unknown[];
  commonPitfalls: unknown[];
  topResearchers: unknown[];
}

export interface LookupResearcher {
  name: string;
  totalExperiments: number;
  topReactionTypes: unknown[];
  recentExperiments: unknown[];
  keyContributions: unknown[];
}

export interface LookupSubstrateClass {
  name: string;
  experimentCount: number;
}

export interface LookupData {
  chemicals: LookupChemical[];
  reactionTypes: LookupReactionType[];
  researchers: LookupResearcher[];
  substrateClasses: LookupSubstrateClass[];
}

const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export class CrossReferenceResolver {
  private lookupMap: Map<string, PageInfo> = new Map();
  private chemicalUsages: Map<string, ChemicalUsage[]> = new Map();
  private researcherMap: Map<string, string> = new Map();
  private stubs: Map<string, PageInfo> = new Map();

  buildLookupMap(data: LookupData): void {
    for (const chemical of data.chemicals) {
      const normalized = this.normalize(chemical.name);

      // Handle duplicate names: append CAS number if name already exists
      let finalNormalized = normalized;
      let finalName = chemical.name;
      if (this.lookupMap.has(normalized) && chemical.casNumber) {
        finalNormalized = `${normalized} (${chemical.casNumber.toLowerCase()})`;
        finalName = `${chemical.name} (${chemical.casNumber})`;
      }

      const info: PageInfo = {
        name: toTitleCase(finalName),
        normalizedName: finalNormalized,
        type: "chemical",
        matchTag: chemical.casNumber
          ? `cas:${chemical.casNumber}`
          : `chemical:${chemical.id}`,
        id: chemical.id,
        casNumber: chemical.casNumber ?? undefined,
        stubbed: false,
      };

      this.lookupMap.set(finalNormalized, info);

      if (chemical.casNumber) {
        this.lookupMap.set(chemical.casNumber, info);
      }
    }

    for (const rt of data.reactionTypes) {
      const normalized = this.normalize(rt.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(rt.name),
        normalizedName: normalized,
        type: "reaction-type",
        matchTag: `reaction:${rt.name.toLowerCase().replace(/\s+/g, "-")}`,
        stubbed: false,
      });
    }

    for (const researcher of data.researchers) {
      const normalized = this.normalize(researcher.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(researcher.name),
        normalizedName: normalized,
        type: "researcher",
        matchTag: `researcher:${researcher.name.toLowerCase().replace(/\s+/g, "-")}`,
        stubbed: false,
      });
    }

    for (const sc of data.substrateClasses) {
      const normalized = this.normalize(sc.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(sc.name),
        normalizedName: normalized,
        type: "substrate-class",
        matchTag: `substrate-class:${sc.name.toLowerCase().replace(/\s+/g, "-")}`,
        stubbed: false,
      });
    }
  }

  resolveWikilink(name: string): PageInfo | null {
    return this.lookupMap.get(this.normalize(name)) ?? null;
  }

  findUnresolvedLinks(markdown: string): string[] {
    const unresolved: string[] = [];
    WIKILINK_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = WIKILINK_REGEX.exec(markdown)) !== null) {
      const linkTarget = match[1].trim();
      if (!this.resolveWikilink(linkTarget)) {
        unresolved.push(linkTarget);
      }
    }

    return [...new Set(unresolved)];
  }

  createStubPage(name: string, type: PageType): string {
    const truncatedName =
      name.length > 255
        ? `${name.slice(0, 245)}...${this.shortHash(name)}`
        : name;

    const titleCaseName = toTitleCase(truncatedName);

    const normalized = this.normalize(truncatedName);
    const stubInfo: PageInfo = {
      name: titleCaseName,
      normalizedName: normalized,
      type,
      matchTag: `${type}:${normalized.replace(/\s+/g, "-")}`,
      stubbed: true,
    };
    this.stubs.set(normalized, stubInfo);
    this.lookupMap.set(normalized, stubInfo);

    const icon = type === "chemical" ? "\u2697\uFE0F" : "\uD83D\uDCC4";
    const now = new Date().toISOString();

    return [
      "---",
      `title: "${titleCaseName}"`,
      `icon: "${icon}"`,
      `page-type: "${type}"`,
      "tags:",
      "  - needs-enrichment",
      `  - ${type}`,
      'one-liner: "Auto-generated stub -- needs enrichment"',
      `created: "${now}"`,
      `updated: "${now}"`,
      "---",
      "",
      `# ${titleCaseName}`,
      "",
      "> This page was auto-generated and needs enrichment.",
      "> It was referenced in experiment pages but has no corresponding entry in ChemELN.",
      "",
      "## Used In",
      "",
      "*Referenced in experiment pages -- see backlinks.*",
      "",
    ].join("\n");
  }

  resolveResearcher(userId: string): string {
    return this.researcherMap.get(userId) ?? "Unknown Researcher";
  }

  setResearcherMapping(userId: string, name: string): void {
    this.researcherMap.set(userId, name);
  }

  trackUsage(
    chemicalName: string,
    experimentId: string,
    role: string,
    amount: number,
    unit?: string,
  ): void {
    this.registerUsage(chemicalName, {
      experimentId,
      experimentTitle: "",
      role,
      amount,
      unit: unit ?? "",
    });
  }

  registerUsage(chemicalId: string, usage: ChemicalUsage): void {
    const existing = this.chemicalUsages.get(chemicalId) ?? [];
    existing.push(usage);
    this.chemicalUsages.set(chemicalId, existing);
  }

  getUsages(chemicalName: string): ChemicalUsage[] {
    return this.chemicalUsages.get(chemicalName) ?? [];
  }

  getChemicalUsages(chemicalId: string): ChemicalUsage[] {
    return this.chemicalUsages.get(chemicalId) ?? [];
  }

  getUnresolvedCount(): number {
    return this.stubs.size;
  }

  getAllStubs(): PageInfo[] {
    return Array.from(this.stubs.values());
  }

  private normalize(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, " ");
  }

  private shortHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36).slice(0, 6);
  }
}
