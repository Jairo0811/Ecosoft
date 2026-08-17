import { calculateEvaluationTotal } from './evaluation-score';

describe('evaluation weighted score', () => {
  const criteria = [
    { id: 'technical', maximumScore: 100, weight: 0.3 },
    { id: 'financial', maximumScore: 50, weight: 0.7 },
  ];

  it('normalizes each criterion before applying its weight', () => {
    expect(
      calculateEvaluationTotal(criteria, [
        { criterionId: 'technical', score: 80 },
        { criterionId: 'financial', score: 40 },
      ]),
    ).toBeCloseTo(80);
  });

  it('rejects missing, repeated and excessive scores', () => {
    expect(() =>
      calculateEvaluationTotal(criteria, [{ criterionId: 'technical', score: 80 }]),
    ).toThrow('exactamente todos los criterios');
    expect(() =>
      calculateEvaluationTotal(criteria, [
        { criterionId: 'technical', score: 80 },
        { criterionId: 'technical', score: 70 },
      ]),
    ).toThrow('exactamente todos los criterios');
    expect(() =>
      calculateEvaluationTotal(criteria, [
        { criterionId: 'technical', score: 101 },
        { criterionId: 'financial', score: 40 },
      ]),
    ).toThrow('excede su máximo');
  });
});
