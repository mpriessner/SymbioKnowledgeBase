export enum ChemPageType {
  EXPERIMENT = "EXPERIMENT",
  CHEMICAL = "CHEMICAL",
  REACTION_TYPE = "REACTION_TYPE",
  RESEARCHER = "RESEARCHER",
  SUBSTRATE_CLASS = "SUBSTRATE_CLASS",
}

export type ExperimentStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "failed"
  | "abandoned";

export type ScaleCategory = "small" | "medium" | "large" | "pilot";

export const TAG_NAMESPACES = {
  ELN: "eln:",
  CAS: "cas:",
  REACTION: "reaction:",
  RESEARCHER: "researcher:",
  SUBSTRATE_CLASS: "substrate-class:",
  SCALE: "scale:",
  CHALLENGE: "challenge:",
  QUALITY: "quality:",
} as const;

export type TagNamespace = (typeof TAG_NAMESPACES)[keyof typeof TAG_NAMESPACES];

export interface ChemPageBase {
  title: string;
  icon: string;
  tags: string[];
}

export interface ExperimentFrontmatter extends ChemPageBase {
  type: ChemPageType.EXPERIMENT;
  icon: "\u{1F9EA}";
  eln_id: string;
  researcher: string;
  date: string;
  status: ExperimentStatus;
  reaction_type?: string;
  substrate_class?: string;
  scale_category: ScaleCategory;
  quality_score: number;
}

export interface ChemicalFrontmatter extends ChemPageBase {
  type: ChemPageType.CHEMICAL;
  icon: "\u2697\uFE0F";
  cas_number: string;
  molecular_weight?: number;
  common_synonyms?: string[];
}

export interface ReactionTypeFrontmatter extends ChemPageBase {
  type: ChemPageType.REACTION_TYPE;
  icon: "\u{1F52C}";
  experiment_count: number;
  avg_yield?: number;
  researcher_count: number;
}

export interface ResearcherFrontmatter extends ChemPageBase {
  type: ChemPageType.RESEARCHER;
  icon: "\u{1F469}\u200D\u{1F52C}";
  email?: string;
  experiment_count: number;
  primary_expertise?: string[];
}

export interface SubstrateClassFrontmatter extends ChemPageBase {
  type: ChemPageType.SUBSTRATE_CLASS;
  icon: "\u{1F9EC}";
  experiment_count: number;
}

export type ChemKbFrontmatter =
  | ExperimentFrontmatter
  | ChemicalFrontmatter
  | ReactionTypeFrontmatter
  | ResearcherFrontmatter
  | SubstrateClassFrontmatter;
