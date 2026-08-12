import {
  organizationCreateSchema,
  organizationQuerySchema,
  organizationStatusSchema,
} from './organizations.schemas';

describe('organization schemas', () => {
  it('normalizes pagination defaults', () => {
    expect(organizationQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('rejects an invalid Dominican RNC', () => {
    const result = organizationCreateSchema.safeParse({
      rnc: '123',
      legalName: 'Empresa Solar Dominicana',
      type: 'GENERATION_COMPANY',
    });
    expect(result.success).toBe(false);
  });

  it('requires a reason when rejecting an organization', () => {
    expect(organizationStatusSchema.safeParse({ status: 'REJECTED' }).success).toBe(false);
    expect(
      organizationStatusSchema.safeParse({
        status: 'REJECTED',
        reason: 'Documentación incompleta.',
      }).success,
    ).toBe(true);
  });
});
