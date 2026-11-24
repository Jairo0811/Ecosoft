import type { Express } from 'express';
import request from 'supertest';
import type { SessionUser } from '@ecosoft/shared';

/**
 * GET /ai/capabilities exposes what the configured provider really does. Prisma is replaced by
 * a double (only the session check touches it) and the FastAPI service by a fetch stub.
 */
const db = { user: { findUnique: jest.fn() } };
jest.mock('../../config/prisma', () => ({ prisma: db }));

const serviceCapabilities = {
  provider: 'LOCAL_DETERMINISTIC',
  processing: 'deterministic',
  generative_ai: false,
  ocr: false,
  operations: { SUMMARY: 'Resumen extractivo', ANOMALY_REVIEW: 'Señales heurísticas' },
  text_extraction_mime_types: ['application/json', 'text/csv', 'text/markdown', 'text/plain'],
  unsupported: ['OCR de imágenes (PNG/JPEG)', 'PDF escaneados o PDF con texto'],
  human_review_required: true,
};

const analyst: SessionUser = {
  id: '11111111-2222-4333-8444-555555555555',
  email: 'analista@ecosoft.test',
  firstName: 'Ana',
  lastName: 'Analista',
  organizationId: '6b0c6f7e-7a43-4c39-9a0e-5d2f2b8f2a11',
  authVersion: 1,
  roles: ['CNE_ANALYST'],
  permissions: ['ai.use'],
};

describe('GET /api/v1/ai/capabilities', () => {
  let app: Express;
  let token: string;
  let tokenWithoutAi: string;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    const { createApp } = await import('../../app');
    const { tokenService } = await import('../auth/token.service');
    app = createApp();
    token = tokenService.createAccessToken(analyst);
    tokenWithoutAi = tokenService.createAccessToken({ ...analyst, permissions: [] });
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    db.user.findUnique.mockResolvedValue({ status: 'ACTIVE', authVersion: analyst.authVersion });
    // supertest does not use fetch, so every fetch call here is the API calling the AI service.
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(serviceCapabilities), { status: 200 }));
  });

  it('reports the real provider and only the formats the API forwards (text/plain)', async () => {
    const response = await request(app)
      .get('/api/v1/ai/capabilities')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toEqual({
      provider: 'LOCAL_DETERMINISTIC',
      processing: 'deterministic',
      generativeAi: false,
      ocr: false,
      operations: serviceCapabilities.operations,
      textExtractionMimeTypes: ['text/plain'],
      unsupported: serviceCapabilities.unsupported,
      humanReviewRequired: true,
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/capabilities$/);
    expect(init.method).toBe('GET');
  });

  it('requires authentication and the ai.use permission', async () => {
    expect((await request(app).get('/api/v1/ai/capabilities')).status).toBe(401);
    const forbidden = await request(app)
      .get('/api/v1/ai/capabilities')
      .set('Authorization', `Bearer ${tokenWithoutAi}`);
    expect(forbidden.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers 503 without internal details when the AI service is down', async () => {
    fetchSpy.mockRejectedValue(new TypeError('connect ECONNREFUSED 127.0.0.1:8000'));
    const response = await request(app)
      .get('/api/v1/ai/capabilities')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(503);
    expect((response.body as { code: string }).code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('rejects a capabilities payload that breaks the contract', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ...serviceCapabilities, ocr: 'yes' }), { status: 200 }),
    );
    const response = await request(app)
      .get('/api/v1/ai/capabilities')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(503);
  });
});
