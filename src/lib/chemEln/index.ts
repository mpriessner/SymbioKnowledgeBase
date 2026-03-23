export { ChemElnClient, ChemElnRequestError } from "./client";
export type { ListExperimentsOptions } from "./client";
export type {
  ChemElnConfig,
  ChemElnExperiment,
  ChemElnChemical,
  ChemElnResearcher,
  ChemElnListResponse,
  ChemElnError,
} from "./types";
export { deduplicateChemicals } from "./normalizers/chemicals";
export type { ChemicalRecord } from "./types";
export { classifyReactions, classifySingleExperiment } from "./normalizers/reactions";
export type { ClassifiedExperiment, ReactionTypeStats } from "./types";
export {
  extractResearchers,
  getResearcherById,
  getResearchersByExpertise,
} from "./normalizers/researchers";
export type { ResearcherProfile } from "./types";
