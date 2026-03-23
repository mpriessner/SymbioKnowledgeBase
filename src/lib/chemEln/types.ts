export interface ChemElnConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
}

export interface ChemElnChemical {
  name: string;
  cas_number: string;
  molecular_weight: number;
  role: "reagent" | "solvent" | "catalyst" | "product";
  amount: number;
  unit: string;
}

export interface ChemElnResearcher {
  name: string;
  email: string;
  department: string;
}

export interface ChemElnExperiment {
  id: string;
  title: string;
  researcher: ChemElnResearcher;
  date: string;
  status: "planned" | "in-progress" | "completed" | "failed" | "abandoned";
  reaction_type: string;
  chemicals: ChemElnChemical[];
  procedure: string;
  results: string;
  yield: number;
  notes: string;
}

export interface ChemElnListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChemElnError {
  code: string;
  message: string;
  details: string | null;
}

export interface ChemicalRecord {
  casNumber: string | null;
  canonicalName: string;
  synonyms: string[];
  usageCount: number;
  molecularFormula: string | null;
  molecularWeight: number | null;
  experiments: string[];
}

export interface ClassifiedExperiment {
  experimentId: string;
  reactionType: string;
  confidence: "high" | "medium" | "low";
}

export interface ResearcherProfile {
  userId: string;
  name: string;
  email: string | null;
  totalExperiments: number;
  experimentsByReactionType: Record<string, number>;
  primaryExpertise: string[];
  recentExperiments: { title: string; date: string; reactionType: string }[];
}

export interface ReactionTypeStats {
  reactionType: string;
  experimentCount: number;
  experiments: string[];
  avgYield: number | null;
  researchers: string[];
}

export interface ProcedureStep {
  stepNumber: number;
  action: string;
  duration?: string;
  temperature?: string;
}

export interface PracticalNote {
  type: "deviation" | "observation" | "tip" | "warning";
  content: string;
  timestamp?: string;
}

export interface ChemicalRef {
  id: string;
  name: string;
  casNumber: string | null;
  molecularFormula: string | null;
}

export interface ReagentEntry {
  id: string;
  chemical: ChemicalRef;
  role?: string;
  amount: number;
  unit: string;
}

export interface ProductEntry {
  id: string;
  chemical: ChemicalRef;
  yield: number | null;
  unit: string;
}

export interface ProcedureMetadata {
  temperature?: string;
  pressure?: string;
  time?: string;
  solvent?: string;
  atmosphere?: string;
}

export interface ExperimentData {
  id: string;
  title: string;
  objective?: string;
  experimentType: string;
  status: string;
  createdBy: string;
  createdAt: string;
  actualProcedure: ProcedureStep[] | null;
  plannedProcedure?: ProcedureStep[] | null;
  procedureMetadata: ProcedureMetadata | null;
  reagents: ReagentEntry[];
  products: ProductEntry[];
  practicalNotes?: PracticalNote[];
  relatedExperiments?: Array<{ id: string; title: string }>;
}

// ---------------------------------------------------------------------------
// Aggregation types for entity page generators (SKB-44.2)
// ---------------------------------------------------------------------------

export interface ChemicalData {
  id: string;
  name: string;
  casNumber?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  synonyms?: string[];
}

export interface ChemicalUsage {
  experimentId: string;
  experimentTitle: string;
  role: "reagent" | "product" | "catalyst" | "solvent";
  amount: number;
  unit: string;
  yield?: number;
}

export interface KeyLearning {
  content: string;
  researcherName: string;
  experimentId: string;
  date: string;
  qualityScore: number;
}

export interface ReactionTypeAggregation {
  name: string;
  experimentCount: number;
  avgYield: number;
  researcherCount: number;
  experiments: Array<{
    id: string;
    title: string;
    yield: number;
    researcher: string;
    date: string;
  }>;
  keyLearnings: KeyLearning[];
  commonPitfalls: string[];
  topResearchers: Array<{
    name: string;
    experimentCount: number;
    avgYield: number;
  }>;
}

export interface ResearcherProfileData {
  name: string;
  email?: string;
  totalExperiments: number;
  topReactionTypes: Array<{
    name: string;
    count: number;
    avgYield: number;
  }>;
  recentExperiments: Array<{
    id: string;
    title: string;
    date: string;
    reactionType: string;
  }>;
  keyContributions: string[];
}

export interface SubstrateClassAggregation {
  name: string;
  experimentCount?: number;
  challenges: string[];
  whatWorked: Array<{
    description: string;
    experimentId: string;
    experimentTitle: string;
  }>;
  researchers: Array<{ name: string; experimentCount: number }>;
}
