import type { NextFunction, Request, Response } from 'express';
import { requirePermission } from './auth.middleware';
import { permissions } from './permissions';

describe('requirePermission', () => {
  const response = {} as Response;

  it('allows a user with every required permission', () => {
    const request = {
      auth: {
        id: 'user-id',
        email: 'test@ecosoft.com.do',
        firstName: 'Test',
        lastName: 'User',
        organizationId: null,
        roles: ['SUPER_ADMIN'],
        permissions: [permissions.usersManage],
      },
    } as Request;
    const next = jest.fn() as NextFunction;
    requirePermission(permissions.usersManage)(request, response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies a user without the permission', () => {
    const request = { auth: { permissions: [] } } as unknown as Request;
    const next = jest.fn() as NextFunction;
    requirePermission(permissions.auditRead)(request, response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
