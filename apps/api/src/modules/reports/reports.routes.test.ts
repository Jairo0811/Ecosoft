import type { Express } from 'express';
import request from 'supertest';
import type { SessionUser } from '@ecosoft/shared';

const db = {
  user: { findUnique: jest.fn() },
  auction: { count: jest.fn(), findMany: jest.fn() },
  auditLog: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../config/prisma', () => ({ prisma: db }));

const admin: SessionUser = {
  id: '11111111-2222-4333-8444-555555555555',
  email: 'admin@ecosoft.test',
  firstName: 'Ada',
  lastName: 'Admin',
  organizationId: null,
  authVersion: 1,
  roles: ['CNE_ADMIN'],
  permissions: ['reports.read', 'reports.export'],
};

const auctionRow = (index: number) => ({
  code: `SUB-${index}`,
  title: `Subasta ${index}`,
  status: 'ABIERTA',
  renewableTechnologyCode: 'SOLAR',
  capacityMw: 50,
  maximumPrice: 80.5,
  currencyCode: 'USD',
  openAt: new Date('2026-01-01T00:00:00Z'),
  closeAt: new Date('2026-02-01T00:00:00Z'),
  _count: { participants: 1, bids: 2, awards: 0 },
});

describe('reports API', () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    const { createApp } = await import('../../app');
    const { tokenService } = await import('../auth/token.service');
    app = createApp();
    token = tokenService.createAccessToken(admin);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ status: 'ACTIVE', authVersion: 1 });
    db.auditLog.create.mockResolvedValue({});
  });

  it('paginates in SQL (skip/take) and reports the real total', async () => {
    db.auction.count.mockResolvedValue(45);
    db.auction.findMany.mockResolvedValue([auctionRow(21), auctionRow(22)]);
    const response = await request(app)
      .get('/api/v1/reports/auctions?page=2&pageSize=20')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(db.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    // The count uses the very same filter as the page query.
    const [[countArgs]] = db.auction.count.mock.calls as [[{ where: unknown }]];
    const [[findArgs]] = db.auction.findMany.mock.calls as [[{ where: unknown }]];
    expect(countArgs.where).toEqual(findArgs.where);
    expect(response.body).toMatchObject({
      pagination: { page: 2, pageSize: 20, total: 45, totalPages: 3 },
    });
    expect((response.body as { data: unknown[] }).data).toHaveLength(2);
  });

  it('flags truncated exports instead of truncating silently', async () => {
    db.auction.count.mockResolvedValue(12_345);
    db.auction.findMany.mockResolvedValue([auctionRow(1)]);
    const response = await request(app)
      .get('/api/v1/reports/auctions/export?format=csv')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(db.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10_000 }),
    );
    expect(response.headers['x-report-total']).toBe('12345');
    expect(response.headers['x-report-truncated']).toBe('true');
    const [[audit]] = db.auditLog.create.mock.calls as [[{ data: { newValues: string } }]];
    expect(audit.data.newValues).toContain('"truncated":true');
  });

  it('serves the legacy xls format as a real XLSX workbook', async () => {
    db.auction.count.mockResolvedValue(1);
    db.auction.findMany.mockResolvedValue([auctionRow(1)]);
    const response = await request(app)
      .get('/api/v1/reports/auctions/export?format=xls')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toMatch(/\.xlsx"$/);
    expect((response.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    expect(response.headers['x-report-truncated']).toBe('false');
  });

  it('rejects unknown export formats', async () => {
    const response = await request(app)
      .get('/api/v1/reports/auctions/export?format=exe')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('requires reports.export to export', async () => {
    const { tokenService } = await import('../auth/token.service');
    const reader = tokenService.createAccessToken({ ...admin, permissions: ['reports.read'] });
    const response = await request(app)
      .get('/api/v1/reports/auctions/export?format=pdf')
      .set('Authorization', `Bearer ${reader}`);
    expect(response.status).toBe(403);
    expect(db.auction.findMany).not.toHaveBeenCalled();
  });
});
