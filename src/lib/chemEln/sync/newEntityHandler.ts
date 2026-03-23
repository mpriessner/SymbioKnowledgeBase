import type { AffectedEntities } from "./updatePropagator";
import { CrossReferenceResolver } from "./resolver";
import type { PageType } from "./resolver";
import type { SkbAgentApiWriter } from "./writer";
import type { PageResult } from "./types";
import {
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
} from "../generators";
import type {
  ChemicalData,
  ChemicalUsage,
  ReactionTypeAggregation,
  ResearcherProfileData,
  SubstrateClassAggregation,
} from "../types";

export interface EntityRef {
  name: string;
  type: PageType;
  pageId?: string;
}

export interface EntityHandlerResult {
  created: EntityRef[];
  updated: EntityRef[];
  stubbed: EntityRef[];
  errors: EntityHandlerError[];
}

export interface EntityHandlerError {
  entityName: string;
  entityType: PageType;
  message: string;
}

export interface NewEntity {
  name: string;
  type: PageType;
  casNumber?: string;
  experimentId?: string;
  experimentTitle?: string;
  reactionType?: string;
  researcherName?: string;
  yield?: number;
}

export interface NewEntityHandlerConfig {
  parentIds?: Record<string, string>;
}

export function checkEntityExists(
  name: string,
  type: PageType,
  resolver: CrossReferenceResolver,
): boolean {
  const info = resolver.resolveWikilink(name);
  return info !== null && info.type === type;
}

export async function createEntityPage(
  entity: NewEntity,
  writer: SkbAgentApiWriter,
  parentIds: Record<string, string>,
): Promise<PageResult> {
  switch (entity.type) {
    case "chemical":
      return createChemicalEntityPage(entity, writer, parentIds.chemicals);
    case "reaction-type":
      return createReactionTypeEntityPage(
        entity,
        writer,
        parentIds["reaction-types"],
      );
    case "researcher":
      return createResearcherEntityPage(
        entity,
        writer,
        parentIds.researchers,
      );
    case "substrate-class":
      return createSubstrateClassEntityPage(
        entity,
        writer,
        parentIds["substrate-classes"],
      );
    default:
      throw new Error(`Unknown entity type: ${entity.type}`);
  }
}

function buildStubMarkdown(name: string, type: PageType): string {
  const stubResolver = new CrossReferenceResolver();
  return stubResolver.createStubPage(name, type);
}

async function createChemicalEntityPage(
  entity: NewEntity,
  writer: SkbAgentApiWriter,
  parentId?: string,
): Promise<PageResult> {
  if (entity.casNumber) {
    const chemData: ChemicalData = {
      id: entity.casNumber,
      name: entity.name,
      casNumber: entity.casNumber,
    };

    const usages: ChemicalUsage[] = [];
    if (entity.experimentId) {
      usages.push({
        experimentId: entity.experimentId,
        experimentTitle: entity.experimentTitle ?? "",
        role: "reagent",
        amount: 0,
        unit: "",
      });
    }

    const markdown = generateChemicalPage(chemData, usages);
    const matchTag = `cas:${entity.casNumber}`;
    const r = await writer.upsertPage(markdown, matchTag, { parentId });
    return { id: r.pageId, title: r.title };
  }

  const stubMarkdown = buildStubMarkdown(entity.name, "chemical");
  const matchTag = `chemical:${entity.name.toLowerCase().replace(/\s+/g, "-")}`;
  const r = await writer.upsertPage(stubMarkdown, matchTag, { parentId });
  return { id: r.pageId, title: r.title };
}

async function createReactionTypeEntityPage(
  entity: NewEntity,
  writer: SkbAgentApiWriter,
  parentId?: string,
): Promise<PageResult> {
  const data: ReactionTypeAggregation = {
    name: entity.name,
    experimentCount: entity.experimentId ? 1 : 0,
    avgYield: entity.yield ?? 0,
    researcherCount: entity.researcherName ? 1 : 0,
    experiments: entity.experimentId
      ? [
          {
            id: entity.experimentId,
            title: entity.experimentTitle ?? "",
            yield: entity.yield ?? 0,
            researcher: entity.researcherName ?? "",
            date: new Date().toISOString().split("T")[0],
          },
        ]
      : [],
    keyLearnings: [],
    commonPitfalls: [],
    topResearchers: entity.researcherName
      ? [
          {
            name: entity.researcherName,
            experimentCount: 1,
            avgYield: entity.yield ?? 0,
          },
        ]
      : [],
  };

  const markdown = generateReactionTypePage(data);
  const matchTag = `reaction:${entity.name.toLowerCase().replace(/\s+/g, "-")}`;
  const r = await writer.upsertPage(markdown, matchTag, { parentId });
  return { id: r.pageId, title: r.title };
}

async function createResearcherEntityPage(
  entity: NewEntity,
  writer: SkbAgentApiWriter,
  parentId?: string,
): Promise<PageResult> {
  const data: ResearcherProfileData = {
    name: entity.name,
    totalExperiments: entity.experimentId ? 1 : 0,
    topReactionTypes: entity.reactionType
      ? [
          {
            name: entity.reactionType,
            count: 1,
            avgYield: entity.yield ?? 0,
          },
        ]
      : [],
    recentExperiments: entity.experimentId
      ? [
          {
            id: entity.experimentId,
            title: entity.experimentTitle ?? "",
            date: new Date().toISOString().split("T")[0],
            reactionType: entity.reactionType ?? "",
          },
        ]
      : [],
    keyContributions: [],
  };

  const markdown = generateResearcherPage(data);
  const matchTag = `researcher:${entity.name.toLowerCase().replace(/\s+/g, "-")}`;
  const r = await writer.upsertPage(markdown, matchTag, { parentId });
  return { id: r.pageId, title: r.title };
}

async function createSubstrateClassEntityPage(
  entity: NewEntity,
  writer: SkbAgentApiWriter,
  parentId?: string,
): Promise<PageResult> {
  const data: SubstrateClassAggregation = {
    name: entity.name,
    experimentCount: entity.experimentId ? 1 : 0,
    challenges: [],
    whatWorked: [],
    researchers: entity.researcherName
      ? [{ name: entity.researcherName, experimentCount: 1 }]
      : [],
  };

  const markdown = generateSubstrateClassPage(data);
  const matchTag = `substrate-class:${entity.name.toLowerCase().replace(/\s+/g, "-")}`;
  const r = await writer.upsertPage(markdown, matchTag, { parentId });
  return { id: r.pageId, title: r.title };
}

export class NewEntityHandler {
  private readonly writer: SkbAgentApiWriter;
  private readonly resolver: CrossReferenceResolver;
  private readonly config: NewEntityHandlerConfig;

  constructor(
    writer: SkbAgentApiWriter,
    resolver: CrossReferenceResolver,
    config?: NewEntityHandlerConfig,
  ) {
    this.writer = writer;
    this.resolver = resolver;
    this.config = config ?? {};
  }

  async handleNewEntities(
    affectedEntities: AffectedEntities,
  ): Promise<EntityHandlerResult> {
    const result: EntityHandlerResult = {
      created: [],
      updated: [],
      stubbed: [],
      errors: [],
    };

    const parentIds = this.config.parentIds ?? {};

    for (const chemicalName of affectedEntities.chemicals) {
      await this.processEntity(chemicalName, "chemical", parentIds, result);
    }

    for (const reactionType of affectedEntities.reactionTypes) {
      await this.processEntity(
        reactionType,
        "reaction-type",
        parentIds,
        result,
      );
    }

    for (const researcher of affectedEntities.researchers) {
      await this.processEntity(researcher, "researcher", parentIds, result);
    }

    return result;
  }

  private async processEntity(
    name: string,
    type: PageType,
    parentIds: Record<string, string>,
    result: EntityHandlerResult,
  ): Promise<void> {
    try {
      if (checkEntityExists(name, type, this.resolver)) {
        result.updated.push({ name, type });
        return;
      }

      const isCasNumber = type === "chemical" && this.looksLikeCas(name);
      const entity: NewEntity = {
        name,
        type,
        casNumber: isCasNumber ? name : undefined,
      };

      const isStub =
        type === "chemical" ? !entity.casNumber : type === "reaction-type";

      const pageResult = await createEntityPage(entity, this.writer, parentIds);

      const ref: EntityRef = {
        name,
        type,
        pageId: pageResult.id,
      };

      if (isStub) {
        result.stubbed.push(ref);
      } else {
        result.created.push(ref);
      }
    } catch (error) {
      result.errors.push({
        entityName: name,
        entityType: type,
        message: (error as Error).message,
      });
    }
  }

  private looksLikeCas(identifier: string): boolean {
    return /^\d{2,7}-\d{2}-\d$/.test(identifier);
  }
}
