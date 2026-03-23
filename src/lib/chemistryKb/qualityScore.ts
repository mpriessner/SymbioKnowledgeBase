export interface QualityScoreInput {
  yield: number;
  hasPracticalNotes: boolean;
  hasProducts: boolean;
  hasCharacterization: boolean;
  hasFullProcedure: boolean;
}

export function computeQualityScore(experiment: QualityScoreInput): number {
  let baseScore = 1;

  if (experiment.yield >= 90) baseScore = 5;
  else if (experiment.yield >= 80) baseScore = 4;
  else if (experiment.yield >= 70) baseScore = 3;
  else if (experiment.yield >= 60) baseScore = 2;
  else baseScore = 1;

  let completenessBonus = 0;

  if (experiment.hasPracticalNotes) completenessBonus += 0.5;
  if (experiment.hasProducts && experiment.hasCharacterization)
    completenessBonus += 0.5;
  if (experiment.hasFullProcedure) completenessBonus += 0.5;

  const finalScore = Math.min(5, Math.max(1, baseScore + completenessBonus));

  return Math.round(finalScore);
}
