/**
 * Structure of a single procedure step from ExpTube video analysis.
 * Supports V1 (2023), V2 (2024), and V3 (2025) formats.
 */
export interface ProcedureStep {
  step_number: number;
  planned_action?: string;
  actual_action?: string;
  timestamp?: string;
  deviation?: string;
  observation?: string;
  duration_seconds?: number;
  expected_duration_seconds?: number;
  is_safety_critical?: boolean;
  deviation_severity?: "minor" | "moderate" | "critical";
}

/**
 * Full actual_procedure JSONB structure from ChemELN.
 */
export interface ActualProcedure {
  exptube_entry_id?: string;
  video_url?: string;
  researcher_name?: string;
  steps?: ProcedureStep[];
  overall_notes?: string;
  tips?: string[];
}

/**
 * Importance level for a practical note.
 */
export type NoteImportance = "critical" | "important" | "informational";

/**
 * A single practical note extracted from procedure data.
 */
export interface PracticalNoteEntry {
  text: string;
  importance: NoteImportance;
  sourceStep?: number;
  attribution?: string;
}

/**
 * Formatted deviation for display.
 */
export interface FormattedDeviation {
  stepNumber: number;
  timestamp?: string;
  deviation: string;
  reason?: string;
  observation?: string;
}

/**
 * Result of extracting practical notes from procedure data.
 */
/**
 * Expertise in a single reaction type for a researcher.
 */
export interface ReactionTypeExpertise {
  reactionType: string;
  experimentCount: number;
  avgQualityScore: number;
  avgYield: number | null;
  highQualityCount: number;
  firstExperimentDate: Date;
  lastExperimentDate: Date;
  weightedExpertiseScore: number;
}

/**
 * A key contribution from a researcher (high-quality experiment).
 */
export interface KeyContribution {
  title: string;
  experimentId: string;
  experimentTitle: string;
  date: Date;
  qualityScore: number;
  reactionType: string;
}

/**
 * Activity status based on recency of experiments.
 */
export type ActivityStatus = "active" | "occasional" | "inactive";

/**
 * Complete expertise profile for a researcher.
 */
export interface ExpertiseProfile {
  researcherId: string;
  researcherName: string;
  totalExperiments: number;
  primaryExpertise: ReactionTypeExpertise[];
  allExpertise: ReactionTypeExpertise[];
  contributionScore: number;
  activityStatus: ActivityStatus;
  topContributions: KeyContribution[];
}

/**
 * Input experiment data for expertise computation.
 */
export interface ExpertiseExperimentInput {
  id: string;
  title: string;
  reactionType: string;
  qualityScore: number;
  yieldPercent: number | null;
  date: Date;
  practicalNotesCount: number;
  practicalNotes?: string;
}

/**
 * A researcher with their associated experiments for expertise computation.
 */
export interface ResearcherWithExperiments {
  researcherId: string;
  researcherName: string;
  experiments: ExpertiseExperimentInput[];
}

/**
 * A lightweight experiment reference used by "Who To Ask" substrate/chemical lookups.
 */
export interface ExperimentRef {
  experimentId: string;
  researcherName: string;
  reactionType: string;
  substrateClasses: string[];
  date: Date;
  qualityScore: number;
  yieldPercent: number | null;
}

/**
 * A single "Who To Ask" recommendation entry.
 */
export interface WhoToAskEntry {
  researcherName: string;
  reason: string;
  score: number;
  recentExperimentDate: Date | null;
  activityStatus: ActivityStatus;
}

/**
 * Result from the "Who To Ask" recommender.
 */
export interface WhoToAskResult {
  recommendations: WhoToAskEntry[];
  context: string;
}

/**
 * Context for a reaction-type "Who To Ask" query.
 */
export interface WhoToAskReactionContext {
  type: "reaction";
  reactionType: string;
  expertiseProfiles: ExpertiseProfile[];
}

/**
 * Context for a substrate-class "Who To Ask" query.
 */
export interface WhoToAskSubstrateContext {
  type: "substrate";
  substrateClass: string;
  experiments: ExperimentRef[];
  expertiseProfiles: ExpertiseProfile[];
}

/**
 * Context for a chemical "Who To Ask" query.
 */
export interface WhoToAskChemicalContext {
  type: "chemical";
  chemicalName: string;
  usages: import("../types").ChemicalUsage[];
  expertiseProfiles: ExpertiseProfile[];
}

/**
 * Discriminated union of all "Who To Ask" context types.
 */
export type WhoToAskContext =
  | WhoToAskReactionContext
  | WhoToAskSubstrateContext
  | WhoToAskChemicalContext;

export interface PracticalNotesResult {
  hasData: boolean;
  whatWorked: PracticalNoteEntry[];
  challenges: PracticalNoteEntry[];
  recommendations: PracticalNoteEntry[];
  timingTips: PracticalNoteEntry[];
  safetyNotes: PracticalNoteEntry[];
  deviations: FormattedDeviation[];
  overallNotes?: string;
  tips: string[];
  source?: {
    entryId: string;
    videoUrl: string;
  };
}
