import { aiClient } from './ai-client';

const respond = (status: number, body: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('aiClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps a 422 from the AI service to an explicit client error', async () => {
    respond(422, { detail: 'no realiza OCR' });
    await expect(aiClient.ocr('AA==', 'image/png')).rejects.toMatchObject({
      statusCode: 422,
      code: 'AI_INPUT_REJECTED',
    });
  });

  it('reports other service failures as 502 without leaking details', async () => {
    respond(500, { detail: 'Traceback (most recent call last)' });
    await expect(aiClient.analyze('texto', 'SUMMARY')).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_SERVICE_ERROR',
    });
  });

  it('rejects results that violate the contract (e.g. >100 references)', async () => {
    respond(200, {
      provider: 'LOCAL_DETERMINISTIC',
      result: {},
      source_references: Array.from({ length: 101 }, (_, i) => `sentence:${i}`),
      confidence: 0.4,
    });
    await expect(aiClient.analyze('texto', 'ANOMALY_REVIEW')).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('treats network errors and timeouts as unavailability', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(aiClient.analyze('texto', 'SUMMARY')).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_SERVICE_UNAVAILABLE',
    });
  });
});
