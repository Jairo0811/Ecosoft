import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import type { SessionUser } from '@ecosoft/shared';

/**
 * Integrity tests for document persistence. Prisma is replaced by an in-memory double so the
 * failure points (transaction, audit, post-commit read, concurrent versions) can be forced
 * deterministically; storage uses a real temporary directory to observe files on disk.
 */
const tx = {
  document: { create: jest.fn(), updateMany: jest.fn() },
  documentVersion: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  user: { findUnique: jest.fn() },
  document: { findFirst: jest.fn() },
  documentVersion: { findUnique: jest.fn() },
  bid: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('../../config/prisma', () => ({ prisma: db }));

const firstCallArgument = (mock: jest.Mock): unknown => (mock.mock.calls as unknown[][])[0]?.[0];

const ORG_A = '6b0c6f7e-7a43-4c39-9a0e-5d2f2b8f2a11';
const ORG_B = 'c6a1b0d9-2a8e-4d3f-8b1c-0e9f7d6c5b44';
const BID_ID = '2f1d8c9b-3a4e-4b5f-8c6d-7e8f9a0b1c2d';
const DOC_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const pdfBase64 = Buffer.from('%PDF-1.7\nexpediente técnico\n%%EOF').toString('base64');
const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString(
  'base64',
);

const companyUser: SessionUser = {
  id: '11111111-2222-4333-8444-555555555555',
  email: 'empresa@ecosoft.test',
  firstName: 'Ana',
  lastName: 'Empresa',
  organizationId: ORG_A,
  authVersion: 3,
  roles: ['COMPANY_REPRESENTATIVE'],
  permissions: ['documents.read', 'documents.manage'],
};

const storedDocument = (overrides: Record<string, unknown> = {}) => ({
  id: DOC_ID,
  organizationId: ORG_A,
  entityType: 'BID',
  entityId: BID_ID,
  documentType: 'PROPUESTA_TECNICA',
  title: 'Propuesta técnica',
  confidentiality: 'PRIVATE',
  status: 'ACTIVE',
  currentVersionNumber: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { firstName: 'Ana', lastName: 'Empresa', email: 'empresa@ecosoft.test' },
  versions: [],
  ...overrides,
});

const createBody = {
  entityType: 'BID',
  entityId: BID_ID,
  documentType: 'propuesta_tecnica',
  title: 'Propuesta técnica',
  fileName: 'propuesta-técnica.pdf',
  mimeType: 'application/pdf',
  contentBase64: pdfBase64,
};

describe('documents API persistence integrity', () => {
  let app: Express;
  let storage: string;
  let token: string;

  const files = () => readdir(storage).catch(() => [] as string[]);
  const post = (url: string, body: unknown, authToken = token) =>
    request(app)
      .post(url)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Requested-With', 'EcoSoftWeb')
      .send(body as object);

  beforeAll(async () => {
    storage = await mkdtemp(path.join(tmpdir(), 'ecosoft-doc-routes-'));
    process.env.DOCUMENT_STORAGE_PATH = storage;
    const { createApp } = await import('../../app');
    const { tokenService } = await import('../auth/token.service');
    app = createApp();
    token = tokenService.createAccessToken(companyUser);
  });

  afterAll(async () => {
    await rm(storage, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const file of await files()) await rm(path.join(storage, file), { force: true });
    db.user.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      authVersion: companyUser.authVersion,
    });
    db.bid.findUnique.mockResolvedValue({ organizationId: ORG_A });
    db.$transaction.mockImplementation((work: (client: typeof tx) => Promise<unknown>) => work(tx));
    tx.document.create.mockResolvedValue({ id: DOC_ID });
    tx.document.updateMany.mockResolvedValue({ count: 1 });
    tx.documentVersion.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});
    db.document.findFirst.mockResolvedValue(storedDocument());
  });

  it('creates document, version and audit evidence in one transaction', async () => {
    const response = await post('/api/v1/documents', createBody);
    expect(response.status).toBe(201);
    expect(await files()).toHaveLength(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).not.toHaveBeenCalled(); // audit is not written outside the tx
    const version = firstCallArgument(tx.documentVersion.create) as {
      data: { sha256: string; storageKey: string };
    };
    expect(version.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await files()).toEqual([version.data.storageKey]);
  });

  it('removes the file when the transaction (including audit) does not commit', async () => {
    tx.auditLog.create.mockRejectedValue(new Error('audit insert failed'));
    const response = await post('/api/v1/documents', createBody);
    expect(response.status).toBe(500);
    expect((response.body as { message: string }).message).toBe('Ocurrió un error interno.');
    expect(JSON.stringify(response.body)).not.toContain('audit insert failed');
    expect(await files()).toHaveLength(0);
  });

  it('keeps the file when a failure happens after the record was committed', async () => {
    // Regression: the former catch-all deleted the file of an already committed record.
    db.document.findFirst.mockRejectedValue(new Error('read replica unavailable'));
    const response = await post('/api/v1/documents', createBody);
    expect(response.status).toBe(500);
    const version = firstCallArgument(tx.documentVersion.create) as {
      data: { storageKey: string };
    };
    expect(await files()).toEqual([version.data.storageKey]);
  });

  it('rejects content that does not match the declared type before writing anything', async () => {
    const response = await post('/api/v1/documents', { ...createBody, contentBase64: pngBase64 });
    expect(response.status).toBe(400);
    expect((response.body as { code: string }).code).toBe('DOCUMENT_CONTENT_MISMATCH');
    expect(await files()).toHaveLength(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects mismatching extensions and path-like names', async () => {
    const wrongExtension = await post('/api/v1/documents', { ...createBody, fileName: 'x.exe' });
    expect((wrongExtension.body as { code: string }).code).toBe('DOCUMENT_EXTENSION_MISMATCH');
    const traversal = await post('/api/v1/documents', { ...createBody, fileName: '../a.pdf' });
    expect((traversal.body as { code: string }).code).toBe('INVALID_DOCUMENT_NAME');
    expect(await files()).toHaveLength(0);
  });

  it('conceals entities of another organization (IDOR) without writing files', async () => {
    db.bid.findUnique.mockResolvedValue({ organizationId: ORG_B });
    const response = await post('/api/v1/documents', createBody);
    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('DOCUMENT_ENTITY_NOT_FOUND');
    expect(await files()).toHaveLength(0);
  });

  it('answers 409 and discards the file when a concurrent version won the race', async () => {
    tx.document.updateMany.mockResolvedValue({ count: 0 });
    const response = await post(`/api/v1/documents/${DOC_ID}/versions`, {
      fileName: 'v2.pdf',
      mimeType: 'application/pdf',
      contentBase64: pdfBase64,
    });
    expect(response.status).toBe(409);
    expect((response.body as { code: string }).code).toBe('DOCUMENT_VERSION_CONFLICT');
    expect(tx.documentVersion.create).not.toHaveBeenCalled();
    expect(await files()).toHaveLength(0);
  });

  it('maps a duplicate (documentId, versionNumber) to 409 instead of 500', async () => {
    tx.documentVersion.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    const response = await post(`/api/v1/documents/${DOC_ID}/versions`, {
      fileName: 'v2.pdf',
      mimeType: 'application/pdf',
      contentBase64: pdfBase64,
    });
    expect(response.status).toBe(409);
    expect(await files()).toHaveLength(0);
  });

  it('only one of two simultaneous version uploads succeeds', async () => {
    let current = 1;
    tx.document.updateMany.mockImplementation(
      ({ where }: { where: { currentVersionNumber: number } }) => {
        if (where.currentVersionNumber !== current) return Promise.resolve({ count: 0 });
        current += 1;
        return Promise.resolve({ count: 1 });
      },
    );
    const body = { fileName: 'v2.pdf', mimeType: 'application/pdf', contentBase64: pdfBase64 };
    const results = await Promise.all([
      post(`/api/v1/documents/${DOC_ID}/versions`, body),
      post(`/api/v1/documents/${DOC_ID}/versions`, body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await files()).toHaveLength(1);
    expect(tx.documentVersion.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to serve a stored file whose SHA-256 no longer matches', async () => {
    await writeFile(path.join(storage, '0a0b0c0d-0000-4000-8000-000000000001'), 'tampered');
    db.documentVersion.findUnique.mockResolvedValue({
      storageKey: '0a0b0c0d-0000-4000-8000-000000000001',
      sha256: 'a'.repeat(64),
      mimeType: 'application/pdf',
      originalFileName: 'informe.pdf',
    });
    const response = await request(app)
      .get(`/api/v1/documents/${DOC_ID}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect((response.body as { code: string }).code).toBe('DOCUMENT_INTEGRITY_ERROR');
  });

  it('serves verified downloads with a UTF-8 safe file name and no caching', async () => {
    const content = Buffer.from('%PDF-1.7\ncontenido');
    const { createHash } = await import('node:crypto');
    await writeFile(path.join(storage, '0a0b0c0d-0000-4000-8000-000000000002'), content);
    db.documentVersion.findUnique.mockResolvedValue({
      storageKey: '0a0b0c0d-0000-4000-8000-000000000002',
      sha256: createHash('sha256').update(content).digest('hex'),
      mimeType: 'application/pdf',
      originalFileName: 'evaluación "final".pdf',
    });
    const response = await request(app)
      .get(`/api/v1/documents/${DOC_ID}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="evaluacion _final_.pdf"; filename*=UTF-8''${encodeURIComponent('evaluación "final".pdf')}`,
    );
  });

  describe('authorization', () => {
    it('requires a token', async () => {
      const response = await request(app).post('/api/v1/documents').send(createBody);
      expect(response.status).toBe(401);
    });

    it('rejects revoked sessions (authVersion changed)', async () => {
      db.user.findUnique.mockResolvedValue({ status: 'ACTIVE', authVersion: 99 });
      const response = await post('/api/v1/documents', createBody);
      expect(response.status).toBe(401);
      expect((response.body as { code: string }).code).toBe('SESSION_REVOKED');
    });

    it('requires documents.manage', async () => {
      const { tokenService } = await import('../auth/token.service');
      const readOnly = tokenService.createAccessToken({
        ...companyUser,
        roles: ['READ_ONLY'],
        permissions: ['documents.read'],
      });
      const response = await post('/api/v1/documents', createBody, readOnly);
      expect(response.status).toBe(403);
      expect(await files()).toHaveLength(0);
    });

    it('requires the trusted web header (CSRF defence)', async () => {
      const response = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token}`)
        .send(createBody);
      expect(response.status).toBe(403);
      expect((response.body as { code: string }).code).toBe('UNTRUSTED_REQUEST');
    });
  });
});
