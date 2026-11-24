import type { SessionUser } from '@ecosoft/shared';

/**
 * Every Prisma delegate method resolves to an empty-but-valid result so the dashboard can be
 * computed without a database; the test then inspects the queries that were issued.
 */
const calls: Record<string, unknown[]> = {};
const emptyResult = (method: string): unknown => {
  if (method === 'count') return 0;
  if (method === 'aggregate') return { _count: { _all: 0 }, _sum: {} };
  return [];
};
const delegate = (model: string) =>
  new Proxy(
    {},
    {
      get: (_target, method: string) =>
        jest.fn((args: unknown) => {
          (calls[`${model}.${method}`] ??= []).push(args);
          return Promise.resolve(emptyResult(method));
        }),
    },
  );
jest.mock('../../config/prisma', () => ({
  prisma: new Proxy({}, { get: (_target, model: string) => delegate(model) }),
}));

import { getDashboardAnalytics } from './analytics.service';

const actor = (roles: string[], permissions: string[], organizationId: string | null = null) =>
  ({
    id: '11111111-2222-4333-8444-555555555555',
    email: 'user@ecosoft.test',
    firstName: 'U',
    lastName: 'Ser',
    organizationId,
    authVersion: 1,
    roles,
    permissions,
  }) satisfies SessionUser;

const auditWhere = () =>
  (calls['auditLog.findMany']?.[0] as { where: Record<string, unknown> }).where;

describe('dashboard analytics: recent activity disclosure', () => {
  beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
  });

  it('shows installation-wide activity to roles that can read the audit log', async () => {
    await getDashboardAnalytics(actor(['AUDITOR'], ['analytics.read', 'audit.read']), {});
    expect(auditWhere()).toEqual({});
  });

  it('does not disclose audit activity to evaluators without audit.read', async () => {
    await getDashboardAnalytics(actor(['TECHNICAL_EVALUATOR'], ['analytics.read']), {});
    expect(auditWhere()).toEqual({ id: { in: [] } });
  });

  it('keeps company users inside their organization and without audit activity', async () => {
    const org = 'f26e2d9a-b03f-4a8b-8f25-ea0f9a8e0a8d';
    await getDashboardAnalytics(actor(['COMPANY_ADMIN'], ['analytics.read'], org), {});
    expect(auditWhere()).toEqual({ organizationId: org, id: { in: [] } });
    const bidQuery = calls['bid.aggregate']?.[0] as { where: { organizationId: string } };
    expect(bidQuery.where.organizationId).toBe(org);
  });
});
