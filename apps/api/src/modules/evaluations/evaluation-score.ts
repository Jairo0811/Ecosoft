import { AppError } from '../../common/app-error';

interface CriterionInput {
  id: string;
  maximumScore: number;
  weight: number;
}

interface ScoreInput {
  criterionId: string;
  score: number;
}

export const calculateEvaluationTotal = (
  criteria: readonly CriterionInput[],
  scores: readonly ScoreInput[],
): number => {
  const criteriaById = new Map(criteria.map((item) => [item.id, item]));
  if (
    scores.length !== criteria.length ||
    new Set(scores.map((item) => item.criterionId)).size !== criteria.length
  )
    throw new AppError(
      400,
      'INCOMPLETE_EVALUATION',
      'Debe puntuar exactamente todos los criterios del tipo seleccionado.',
    );
  let total = 0;
  for (const item of scores) {
    const criterion = criteriaById.get(item.criterionId);
    if (!criterion || item.score > criterion.maximumScore)
      throw new AppError(
        400,
        'INVALID_EVALUATION_SCORE',
        'Una puntuación no corresponde a la matriz o excede su máximo.',
      );
    total += (item.score / criterion.maximumScore) * criterion.weight * 100;
  }
  return total;
};
