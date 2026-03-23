import type { ExperimentStatus, ScaleCategory } from "@/lib/chemistryKb/types";
import type { ExperimentPageData } from "@/lib/chemistryKb/templates";

export interface RawChemical {
  name: string;
  cas_number: string | null;
  molecular_weight: number | null;
  role: "reagent" | "solvent" | "catalyst" | "product";
  amount: number;
  unit: string;
}

export interface RawExperimentData {
  id: string;
  title: string;
  researcher_name: string;
  researcher_email: string;
  date: string;
  status: string;
  reaction_type: string | null;
  substrate_class: string | null;
  chemicals: RawChemical[];
  procedure: string | null;
  results: string | null;
  yield_percent: number | null;
  practical_notes: string | null;
}

export interface TransformedExperiment {
  frontmatter: {
    title: string;
    elnId: string;
    researcher: string;
    date: string;
    status: ExperimentStatus;
    reactionType: string | undefined;
    substrateClass: string | undefined;
    scaleCategory: ScaleCategory;
    qualityScore: number;
    tags: string[];
  };
  body: {
    summary: string;
    reagents: ExperimentPageData["reagents"];
    conditions: ExperimentPageData["conditions"];
    procedureSetup: string[];
    procedureReaction: string[];
    procedureWorkup: string[];
    procedurePurification: string[];
    results: ExperimentPageData["results"];
    practicalNotesWorked: string[];
    practicalNotesChallenges: string[];
    practicalNotesRecommendations: string[];
    relatedChemicals: string[];
  };
  pageData: ExperimentPageData;
}

export interface FetcherOptions {
  page?: number;
  pageSize?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  researcher?: string;
  status?: string;
  dryRun?: boolean;
}

export interface FetcherStats {
  total: number;
  transformed: number;
  skipped: number;
  errors: number;
}

export interface FetcherResult {
  experiments: TransformedExperiment[];
  stats: FetcherStats;
}
