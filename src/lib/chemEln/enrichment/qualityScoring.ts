import type {
  ExperimentData,
  ProcedureStep,
  PracticalNote,
  ReagentEntry,
  ProductEntry,
  ProcedureMetadata,
} from "../types";

/**
 * Input interface for the enhanced quality scoring model.
 * Can be constructed from various experiment data formats.
 */
export interface QualityScoringInput {
  yieldPercent: number | null;
  status: string | null;
  procedureSteps: ProcedureStep[] | null;
  practicalNotes: PracticalNote[] | null;
  reagents: ReagentEntry[] | null;
  products: ProductEntry[] | null;
  procedureMetadata: ProcedureMetadata | null;
  procedureText: string | null;
}

/**
 * Breakdown of individual dimension scores.
 */
export interface QualityScoreBreakdown {
  yield: number;
  completeness: number;
  documentation: number;
  reproducibility: number;
}

/**
 * Result of the enhanced quality scoring computation.
 */
export interface QualityScoreResult {
  overall: number;
  breakdown: QualityScoreBreakdown;
  confidence: "high" | "medium" | "low";
}

/**
 * Dimension weights for the composite score calculation.
 */
const WEIGHTS = {
  yield: 0.4,
  completeness: 0.25,
  documentation: 0.2,
  reproducibility: 0.15,
} as const;

/**
 * Compute the yield dimension score (0-5).
 *
 * >90% = 5, >80% = 4, >70% = 3, >60% = 2, <60% = 1, null = 0
 */
export function computeYieldScore(yieldPercent: number | null): number {
  if (yieldPercent === null || yieldPercent === undefined) return 0;
  if (yieldPercent > 90) return 5;
  if (yieldPercent > 80) return 4;
  if (yieldPercent > 70) return 3;
  if (yieldPercent > 60) return 2;
  return 1;
}

/**
 * Compute the completeness dimension score (0-5).
 *
 * Awards 1 point per present field category:
 * - Has procedure (steps or text)
 * - Has reagents with amounts
 * - Has products with characterization (yield data)
 * - Has practical notes
 * - Has conditions (procedureMetadata with at least one field)
 */
export function computeCompletenessScore(input: QualityScoringInput): number {
  let score = 0;

  const hasProcedure =
    (input.procedureSteps !== null && input.procedureSteps.length > 0) ||
    (input.procedureText !== null && input.procedureText.trim().length > 0);
  if (hasProcedure) score += 1;

  const hasReagentsWithAmounts =
    input.reagents !== null &&
    input.reagents.length > 0 &&
    input.reagents.some((r) => r.amount > 0);
  if (hasReagentsWithAmounts) score += 1;

  const hasProductsWithCharacterization =
    input.products !== null &&
    input.products.length > 0 &&
    input.products.some((p) => p.yield !== null && p.yield !== undefined);
  if (hasProductsWithCharacterization) score += 1;

  const hasPracticalNotes =
    input.practicalNotes !== null && input.practicalNotes.length > 0;
  if (hasPracticalNotes) score += 1;

  const hasConditions =
    input.procedureMetadata !== null &&
    Object.values(input.procedureMetadata).some(
      (v) => v !== null && v !== undefined && String(v).trim().length > 0
    );
  if (hasConditions) score += 1;

  return score;
}

/**
 * Compute the documentation quality dimension score (0-5).
 *
 * Based on procedure detail level:
 * - Step count: 0 steps=0, 1-2=1, 3-5=2, 6+=3
 * - Observation count from practical notes: 0=0, 1-2=1, 3+=2 (max contribution)
 * - Deviation documentation: any deviations documented adds up to 1 point (0 if none, 0.5 for 1, 1 for 2+)
 *
 * Note: points are summed but capped at 5.
 */
export function computeDocumentationScore(input: QualityScoringInput): number {
  let score = 0;

  const stepCount = input.procedureSteps?.length ?? 0;
  if (stepCount >= 6) score += 3;
  else if (stepCount >= 3) score += 2;
  else if (stepCount >= 1) score += 1;

  const observations =
    input.practicalNotes?.filter((n) => n.type === "observation") ?? [];
  if (observations.length >= 3) score += 2;
  else if (observations.length >= 1) score += 1;

  // Also count procedure text length as a fallback for step count
  if (stepCount === 0 && input.procedureText) {
    const lineCount = input.procedureText
      .split("\n")
      .filter((l) => l.trim().length > 0).length;
    if (lineCount >= 6) score += 3;
    else if (lineCount >= 3) score += 2;
    else if (lineCount >= 1) score += 1;
  }

  const deviations =
    input.practicalNotes?.filter((n) => n.type === "deviation") ?? [];
  if (deviations.length >= 2) score += 1;
  else if (deviations.length === 1) score += 0.5;

  return Math.min(5, score);
}

/**
 * Compute the reproducibility dimension score (0-5).
 *
 * Awards 1 point per fully specified condition:
 * - Temperature specified
 * - Time specified
 * - Solvent specified
 * - Atmosphere specified
 * - Concentrations available (reagents with amounts and units)
 */
export function computeReproducibilityScore(
  input: QualityScoringInput
): number {
  let score = 0;
  const meta = input.procedureMetadata;

  if (meta?.temperature && meta.temperature.trim().length > 0) score += 1;
  if (meta?.time && meta.time.trim().length > 0) score += 1;
  if (meta?.solvent && meta.solvent.trim().length > 0) score += 1;
  if (meta?.atmosphere && meta.atmosphere.trim().length > 0) score += 1;

  const hasConcentrations =
    input.reagents !== null &&
    input.reagents.length > 0 &&
    input.reagents.every((r) => r.amount > 0 && r.unit.trim().length > 0);
  if (hasConcentrations) score += 1;

  return score;
}

/**
 * Determine confidence level based on how much data was available to score.
 *
 * High: at least 3 dimensions had non-zero scores
 * Medium: 2 dimensions had non-zero scores
 * Low: 0-1 dimensions had non-zero scores
 */
export function computeConfidence(
  breakdown: QualityScoreBreakdown
): "high" | "medium" | "low" {
  const nonZero = Object.values(breakdown).filter((v) => v > 0).length;
  if (nonZero >= 3) return "high";
  if (nonZero >= 2) return "medium";
  return "low";
}

/**
 * Clamp a value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute the enhanced multi-dimensional quality score for an experiment.
 *
 * Dimensions and weights:
 * - Yield (40%): outcome quality based on yield percentage
 * - Completeness (25%): how many data fields are filled
 * - Documentation (20%): procedure detail level
 * - Reproducibility (15%): whether conditions are fully specified
 *
 * The weighted composite is mapped to a 1-5 integer scale.
 */
export function computeEnhancedQualityScore(
  input: QualityScoringInput
): QualityScoreResult {
  const breakdown: QualityScoreBreakdown = {
    yield: computeYieldScore(input.yieldPercent),
    completeness: computeCompletenessScore(input),
    documentation: computeDocumentationScore(input),
    reproducibility: computeReproducibilityScore(input),
  };

  const weightedSum =
    breakdown.yield * WEIGHTS.yield +
    breakdown.completeness * WEIGHTS.completeness +
    breakdown.documentation * WEIGHTS.documentation +
    breakdown.reproducibility * WEIGHTS.reproducibility;

  const overall = clamp(Math.round(weightedSum), 1, 5);
  const confidence = computeConfidence(breakdown);

  return { overall, breakdown, confidence };
}

/**
 * Adapter: convert ExperimentData to QualityScoringInput.
 */
export function experimentDataToScoringInput(
  experiment: ExperimentData
): QualityScoringInput {
  const yieldPercent =
    experiment.products.length > 0
      ? experiment.products.reduce((max, p) => {
          if (p.yield !== null && p.yield !== undefined) {
            return Math.max(max, p.yield);
          }
          return max;
        }, -1)
      : null;

  return {
    yieldPercent: yieldPercent !== null && yieldPercent >= 0 ? yieldPercent : null,
    status: experiment.status,
    procedureSteps: experiment.actualProcedure,
    practicalNotes: experiment.practicalNotes ?? null,
    reagents: experiment.reagents,
    products: experiment.products,
    procedureMetadata: experiment.procedureMetadata,
    procedureText: null,
  };
}

/**
 * Adapter: convert raw/flat experiment fields to QualityScoringInput.
 * Useful when data comes from different sources with varying shapes.
 */
export function rawFieldsToScoringInput(fields: {
  yieldPercent?: number | null;
  status?: string | null;
  procedureText?: string | null;
  stepCount?: number;
  reagentCount?: number;
  hasReagentAmounts?: boolean;
  productCount?: number;
  hasProductYield?: boolean;
  practicalNoteCount?: number;
  observationCount?: number;
  deviationCount?: number;
  temperature?: string | null;
  time?: string | null;
  solvent?: string | null;
  atmosphere?: string | null;
}): QualityScoringInput {
  const steps: ProcedureStep[] = [];
  for (let i = 0; i < (fields.stepCount ?? 0); i++) {
    steps.push({ stepNumber: i + 1, action: `Step ${i + 1}` });
  }

  const notes: PracticalNote[] = [];
  for (let i = 0; i < (fields.observationCount ?? 0); i++) {
    notes.push({ type: "observation", content: `Observation ${i + 1}` });
  }
  for (let i = 0; i < (fields.deviationCount ?? 0); i++) {
    notes.push({ type: "deviation", content: `Deviation ${i + 1}` });
  }
  const remainingNotes =
    (fields.practicalNoteCount ?? 0) -
    (fields.observationCount ?? 0) -
    (fields.deviationCount ?? 0);
  for (let i = 0; i < Math.max(0, remainingNotes); i++) {
    notes.push({ type: "tip", content: `Tip ${i + 1}` });
  }

  const reagents: ReagentEntry[] = [];
  for (let i = 0; i < (fields.reagentCount ?? 0); i++) {
    reagents.push({
      id: `r${i}`,
      chemical: {
        id: `c${i}`,
        name: `Reagent ${i + 1}`,
        casNumber: null,
        molecularFormula: null,
      },
      amount: fields.hasReagentAmounts ? 1.0 : 0,
      unit: fields.hasReagentAmounts ? "mmol" : "",
    });
  }

  const products: ProductEntry[] = [];
  for (let i = 0; i < (fields.productCount ?? 0); i++) {
    products.push({
      id: `p${i}`,
      chemical: {
        id: `pc${i}`,
        name: `Product ${i + 1}`,
        casNumber: null,
        molecularFormula: null,
      },
      yield: fields.hasProductYield ? (fields.yieldPercent ?? null) : null,
      unit: "mg",
    });
  }

  const metadata: ProcedureMetadata = {};
  if (fields.temperature) metadata.temperature = fields.temperature;
  if (fields.time) metadata.time = fields.time;
  if (fields.solvent) metadata.solvent = fields.solvent;
  if (fields.atmosphere) metadata.atmosphere = fields.atmosphere;

  return {
    yieldPercent: fields.yieldPercent ?? null,
    status: fields.status ?? null,
    procedureSteps: steps.length > 0 ? steps : null,
    practicalNotes: notes.length > 0 ? notes : null,
    reagents: reagents.length > 0 ? reagents : null,
    products: products.length > 0 ? products : null,
    procedureMetadata:
      Object.keys(metadata).length > 0 ? metadata : null,
    procedureText: fields.procedureText ?? null,
  };
}
