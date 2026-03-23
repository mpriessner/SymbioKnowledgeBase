import type { SkbAgentApiWriter } from "./writer";
import type { CrossReferenceResolver } from "./resolver";
import type { UpsertResult } from "./types";
import type {
  ExperimentData,
  ChemicalData,
  ChemicalUsage,
  ReactionTypeAggregation,
  ResearcherProfileData,
  SubstrateClassAggregation,
} from "../types";
import {
  generateExperimentPage,
  type ExperimentPageContext,
} from "../generators/experiment";
import { generateChemicalPage } from "../generators/chemical";
import { generateReactionTypePage } from "../generators/reactionType";
import { generateResearcherPage } from "../generators/researcher";
import { generateSubstrateClassPage } from "../generators/substrateClass";

export interface IngestionData {
  experiments: ExperimentData[];
  chemicals: ChemicalData[];
  reactionTypes: ReactionTypeAggregation[];
  researchers: ResearcherProfileData[];
  substrateClasses: SubstrateClassAggregation[];
}

export interface PassResult {
  passName: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  duration: number;
}

export interface IngestionReport {
  passes: PassResult[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  totalDuration: number;
  pagesPerMinute: number;
}

export type ProgressCallback = (
  current: number,
  total: number,
  passName: string,
  pageName: string
) => void;

export interface OrchestratorConfig {
  dryRun?: boolean;
  onProgress?: ProgressCallback;
  parentIds?: {
    chemicals?: string;
    reactionTypes?: string;
    researchers?: string;
    substrateClasses?: string;
    experiments?: string;
  };
}

interface PageTask {
  id: string;
  tag: string;
  generate: () => string;
  parentId?: string;
}

export class BatchOrchestrator {
  private readonly writer: SkbAgentApiWriter;
  private readonly resolver: CrossReferenceResolver;
  private readonly dryRun: boolean;
  private readonly onProgress?: ProgressCallback;
  private readonly parentIds: NonNullable<OrchestratorConfig["parentIds"]>;

  constructor(
    writer: SkbAgentApiWriter,
    resolver: CrossReferenceResolver,
    config?: OrchestratorConfig
  ) {
    this.writer = writer;
    this.resolver = resolver;
    this.dryRun = config?.dryRun ?? false;
    this.onProgress = config?.onProgress;
    this.parentIds = config?.parentIds ?? {};
  }

  async run(data: IngestionData): Promise<IngestionReport> {
    const startTime = Date.now();
    const passes: PassResult[] = [];

    // Pass 1: Create/update entity pages so wikilinks resolve
    const pass1Tasks: PageTask[] = [
      ...data.chemicals.map((c) => ({
        id: `cas:${c.casNumber ?? c.id}`,
        tag: c.casNumber ? `cas:${c.casNumber}` : `chemical:${c.id}`,
        generate: () => generateChemicalPage(c, []),
        parentId: this.parentIds.chemicals,
      })),
      ...data.reactionTypes.map((rt) => ({
        id: `reaction:${rt.name}`,
        tag: `reaction:${rt.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateReactionTypePage(rt),
        parentId: this.parentIds.reactionTypes,
      })),
      ...data.researchers.map((r) => ({
        id: `researcher:${r.name}`,
        tag: `researcher:${r.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateResearcherPage(r),
        parentId: this.parentIds.researchers,
      })),
      ...data.substrateClasses.map((sc) => ({
        id: `substrate:${sc.name}`,
        tag: `substrate-class:${sc.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateSubstrateClassPage(sc),
        parentId: this.parentIds.substrateClasses,
      })),
    ];
    passes.push(await this.runPass("Pass 1: Entities", pass1Tasks));

    // Pass 2: Create/update experiment pages (wikilinks now resolve)
    const pass2Tasks: PageTask[] = data.experiments.map((exp) => ({
      id: `eln:${exp.id}`,
      tag: `eln:${exp.id}`,
      generate: () => {
        const context: ExperimentPageContext = {
          researcherName: this.resolver.resolveResearcher(exp.createdBy),
          reactionType: exp.experimentType,
        };
        return generateExperimentPage(exp, context);
      },
      parentId: this.parentIds.experiments,
    }));
    passes.push(await this.runPass("Pass 2: Experiments", pass2Tasks));

    // Pass 3: Re-generate entity pages with cross-references
    const pass3Tasks: PageTask[] = [
      // Chemicals with usage data
      ...data.chemicals.map((c) => {
        const usages = this.resolver.getChemicalUsages(
          c.id
        ) as unknown as ChemicalUsage[];
        return {
          id: `cas:${c.casNumber ?? c.id}`,
          tag: c.casNumber ? `cas:${c.casNumber}` : `chemical:${c.id}`,
          generate: () => generateChemicalPage(c, usages),
          parentId: this.parentIds.chemicals,
        };
      }),
      // Reaction types (already have experiment/researcher data from aggregation)
      ...data.reactionTypes.map((rt) => ({
        id: `reaction:${rt.name}`,
        tag: `reaction:${rt.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateReactionTypePage(rt),
        parentId: this.parentIds.reactionTypes,
      })),
      // Researchers (already have experiment/expertise data)
      ...data.researchers.map((r) => ({
        id: `researcher:${r.name}`,
        tag: `researcher:${r.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateResearcherPage(r),
        parentId: this.parentIds.researchers,
      })),
      // Substrate classes (already have experiment/researcher data)
      ...data.substrateClasses.map((sc) => ({
        id: `substrate:${sc.name}`,
        tag: `substrate-class:${sc.name.toLowerCase().replace(/\s+/g, "-")}`,
        generate: () => generateSubstrateClassPage(sc),
        parentId: this.parentIds.substrateClasses,
      })),
    ];
    passes.push(await this.runPass("Pass 3: Aggregation", pass3Tasks));

    const totalDuration = Date.now() - startTime;
    const totalProcessed = passes.reduce(
      (sum, p) => sum + p.created + p.updated + p.skipped,
      0
    );

    return {
      passes,
      totalCreated: passes.reduce((sum, p) => sum + p.created, 0),
      totalUpdated: passes.reduce((sum, p) => sum + p.updated, 0),
      totalSkipped: passes.reduce((sum, p) => sum + p.skipped, 0),
      totalFailed: passes.reduce((sum, p) => sum + p.failed, 0),
      totalDuration,
      pagesPerMinute:
        totalDuration > 0 ? totalProcessed / (totalDuration / 60000) : 0,
    };
  }

  private async runPass(
    passName: string,
    tasks: PageTask[]
  ): Promise<PassResult> {
    const start = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      this.onProgress?.(i + 1, tasks.length, passName, task.id);

      try {
        const markdown = task.generate();

        if (this.dryRun) {
          const existing = await this.writer.searchPages(`tag:${task.tag}`);
          if (existing.length > 0) {
            const page = await this.writer.getPage(existing[0].id);
            if (page) {
              const newHash = this.writer.computeHash(markdown);
              const existingHash = this.writer.computeHash(page.markdown);
              if (newHash === existingHash) {
                skipped++;
              } else {
                updated++;
              }
            } else {
              updated++;
            }
          } else {
            created++;
          }
          continue;
        }

        const result: UpsertResult = await this.writer.upsertPage(
          markdown,
          task.tag,
          { parentId: task.parentId }
        );

        switch (result.action) {
          case "created":
            created++;
            break;
          case "updated":
            updated++;
            break;
          case "skipped":
            skipped++;
            break;
        }
      } catch (error) {
        failed++;
        errors.push({
          id: task.id,
          error: (error as Error).message,
        });
      }
    }

    return {
      passName,
      created,
      updated,
      skipped,
      failed,
      errors,
      duration: Date.now() - start,
    };
  }
}

export function formatIngestionReport(report: IngestionReport): string {
  const lines: string[] = [
    "=".repeat(50),
    "  ChemELN -> SKB Ingestion Report",
    "=".repeat(50),
    "",
  ];

  for (const pass of report.passes) {
    lines.push(`  ${pass.passName}:`);
    lines.push(
      `    Created: ${pass.created}  Updated: ${pass.updated}  Skipped: ${pass.skipped}  Failed: ${pass.failed}`
    );
    lines.push(`    Duration: ${(pass.duration / 1000).toFixed(1)}s`);
    lines.push("");
  }

  lines.push("-".repeat(50));
  lines.push(`  Total Created:  ${report.totalCreated}`);
  lines.push(`  Total Updated:  ${report.totalUpdated}`);
  lines.push(`  Total Skipped:  ${report.totalSkipped}`);
  lines.push(`  Total Failed:   ${report.totalFailed}`);
  lines.push(`  Total Time:     ${(report.totalDuration / 1000).toFixed(1)}s`);
  lines.push(`  Rate:           ${report.pagesPerMinute.toFixed(0)} pages/min`);
  lines.push("=".repeat(50));

  const allErrors = report.passes.flatMap((p) => p.errors);
  if (allErrors.length > 0) {
    lines.push("");
    lines.push("  Failed Pages:");
    for (const err of allErrors) {
      lines.push(`    - ${err.id}: ${err.error}`);
    }
  }

  return lines.join("\n");
}
