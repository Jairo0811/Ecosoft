import { aiAnalysisCreateSchema, aiReviewSchema, aiServiceResultSchema } from './ai.schemas';

describe('AI schemas', () => {
  it('accepts grounded service results', () => {
    expect(
      aiServiceResultSchema.parse({
        provider: 'LOCAL_DETERMINISTIC',
        result: { summary: 'Resultado' },
        source_references: ['sentence:1'],
        confidence: 0.8,
      }),
    ).toBeDefined();
  });

  it('rejects unsupported operations and confidence', () => {
    expect(() =>
      aiAnalysisCreateSchema.parse({
        documentId: '8a769e7d-5169-4146-9fea-718bd4810f89',
        operation: 'AUTO_AWARD',
      }),
    ).toThrow();
    expect(() =>
      aiServiceResultSchema.parse({
        provider: 'test',
        result: {},
        source_references: [],
        confidence: 2,
      }),
    ).toThrow();
  });

  it('requires a reason for human review', () => {
    expect(() => aiReviewSchema.parse({ decision: 'ACCEPTED', notes: '' })).toThrow();
  });
});
