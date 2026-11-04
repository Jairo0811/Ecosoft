import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { SessionUser } from '@ecosoft/shared';
import type { tokenService as TokenService } from './token.service';

const db = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  refreshToken: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  document: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => ({ prisma: db }));

const USER_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_ID = '99999999-2222-4333-8444-555555555555';
const FAMILY = '7b1e2b6c-1d1a-4b51-9f56-1f2a3b4c5d6e';

const user: SessionUser = {
  id: USER_ID,
  email: 'ana@ecosoft.test',
  firstName: 'Ana',
  lastName: 'Test',
  organizationId: null,
  authVersion: 1,
  roles: ['READ_ONLY'],
  permissions: ['documents.read'],
};

const storedUser = {
  id: USER_ID,
  email: user.email,
  firstName: 'Ana',
  lastName: 'Test',
  organizationId: null,
  authVersion: 1,
  status: 'ACTIVE',
  roles: [],
};

describe('auth security', () => {
  let app: Express;
  let tokens: typeof TokenService;
  let refresh: { token: string; jti: string };

  beforeAll(async () => {
    ({ tokenService: tokens } = await import('./token.service'));
    const { createApp } = await import('../../app');
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    refresh = tokens.createRefreshToken(USER_ID, FAMILY);
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: USER_ID,
      familyId: FAMILY,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { ...storedUser, organizationId: null },
    });
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    db.refreshToken.create.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});
    db.user.findUnique.mockResolvedValue({ status: 'ACTIVE', authVersion: 1 });
  });

  const refreshCall = () =>
    request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'EcoSoftWeb')
      .set('Cookie', `ecosoft_refresh=${refresh.token}`);

  it('rotates a refresh token exactly once (compare-and-set)', async () => {
    const response = await refreshCall();
    expect(response.status).toBe(200);
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(db.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(response.headers['set-cookie']?.[0]).toMatch(/HttpOnly; SameSite=Strict/);
  });

  it('does not issue a second session when a concurrent refresh already consumed the token', async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    const response = await refreshCall();
    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('REFRESH_CONFLICT');
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes the whole family when a revoked token is replayed', async () => {
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: USER_ID,
      familyId: FAMILY,
      revokedAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      user: storedUser,
    });
    const response = await refreshCall();
    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('TOKEN_REUSE_DETECTED');
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: FAMILY, revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });

  it('rejects refresh without the trusted web header (CSRF)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `ecosoft_refresh=${refresh.token}`);
    expect(response.status).toBe(403);
  });

  it('revokes the refresh cookie on logout even when the access token already expired', async () => {
    db.refreshToken.findUnique.mockResolvedValue({
      userId: USER_ID,
      user: { organizationId: null },
    });
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Requested-With', 'EcoSoftWeb')
      .set('Authorization', 'Bearer expired.or.invalid')
      .set('Cookie', `ecosoft_refresh=${refresh.token}`);
    expect(response.status).toBe(204);
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: tokens.hash(refresh.token), revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(response.headers['set-cookie']?.[0]).toMatch(/ecosoft_refresh=;/);
  });

  it('does not revoke a cookie that belongs to a different authenticated user', async () => {
    db.refreshToken.findUnique.mockResolvedValue({
      userId: OTHER_ID,
      user: { organizationId: null },
    });
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Requested-With', 'EcoSoftWeb')
      .set('Authorization', `Bearer ${tokens.createAccessToken(user)}`)
      .set('Cookie', `ecosoft_refresh=${refresh.token}`);
    expect(response.status).toBe(204);
    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('spends a bcrypt comparison even when the account does not exist (no timing oracle)', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    db.user.findUnique.mockResolvedValueOnce(null);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@ecosoft.test', password: 'Contraseña-incorrecta-1' });
    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
    expect(compare).toHaveBeenCalledTimes(1);
    compare.mockRestore();
  });

  it('rejects expired and tampered access tokens', async () => {
    const jwt = await import('jsonwebtoken');
    const expired = jwt.sign(
      { type: 'access', authVersion: 1, roles: [], permissions: [] },
      process.env.JWT_ACCESS_SECRET!,
      { subject: USER_ID, issuer: 'ecosoft-api', audience: 'ecosoft-web', expiresIn: -10 },
    );
    const forged = jwt.sign(
      { type: 'access', authVersion: 1, roles: ['SUPER_ADMIN'], permissions: ['audit.read'] },
      'attacker-controlled-secret-with-32-characters',
      { subject: USER_ID, issuer: 'ecosoft-api', audience: 'ecosoft-web', expiresIn: 60 },
    );
    for (const token of [expired, forged]) {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect((response.body as { code: string }).code).toBe('INVALID_TOKEN');
    }
  });

  it('rejects a refresh token used as an access token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refresh.token}`);
    expect(response.status).toBe(401);
  });

  it('returns 403 for insufficient permission', async () => {
    const response = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${tokens.createAccessToken(user)}`);
    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('INSUFFICIENT_PERMISSION');
  });
});

describe('HTTP hardening', () => {
  let app: Express;
  beforeAll(async () => {
    const { createApp } = await import('../../app');
    app = createApp();
  });

  it('ignores spoofed X-Forwarded-For unless TRUST_PROXY is configured', async () => {
    const { env } = await import('../../config/env');
    expect(env.TRUST_PROXY).toBe(false);
    expect(app.get('trust proxy')).toBe(false);
  });

  it('answers 413 (not 500) for oversized payloads', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"email":"a@b.co","password":"${'x'.repeat(9 * 1024 * 1024)}"}`);
    expect(response.status).toBe(413);
    expect((response.body as { code: string }).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers 400 for malformed JSON without leaking parser internals', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect((response.body as { code: string }).code).toBe('MALFORMED_REQUEST');
    expect(JSON.stringify(response.body)).not.toMatch(/SyntaxError|stack/);
  });

  it('sends security headers and hides the framework', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('only allows the configured web origin for credentialed CORS', async () => {
    const allowed = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});

describe('TRUST_PROXY parsing', () => {
  const load = async (value: string) => {
    jest.resetModules();
    process.env.TRUST_PROXY = value;
    try {
      return (await import('../../config/env')).env.TRUST_PROXY;
    } finally {
      delete process.env.TRUST_PROXY;
    }
  };

  it('accepts hop counts and subnet lists and refuses blanket trust', async () => {
    await expect(load('1')).resolves.toBe(1);
    await expect(load('loopback, 10.0.0.0/8')).resolves.toBe('loopback, 10.0.0.0/8');
    await expect(load('false')).resolves.toBe(false);
    await expect(load('true')).rejects.toThrow('TRUST_PROXY');
  });
});
