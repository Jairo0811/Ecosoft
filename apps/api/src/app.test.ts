import request from 'supertest';
import { createApp } from './app';

describe('EcoSoft API', () => {
  it('returns the liveness status and correlation id', async () => {
    const response = await request(createApp()).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'ecosoft-api' });
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('does not expose unknown routes', async () => {
    const response = await request(createApp()).get('/api/v1/private-unknown');
    const body = response.body as { code: string };
    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('requires a token for protected resources', async () => {
    for (const resource of [
      'users',
      'analytics/dashboard',
      'reports/auctions',
      'audit',
      'regulatory',
      'notifications',
      'bids',
      'documents',
      'evaluations',
      'projects',
      'contracts',
      'ai',
    ]) {
      const response = await request(createApp()).get(`/api/v1/${resource}`);
      const body = response.body as { code: string };
      expect(response.status).toBe(401);
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    }
  });
});
