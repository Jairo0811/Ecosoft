import { acceptInvitationSchema, createInvitationSchema } from './users.schemas';

describe('user schemas', () => {
  it('normalizes invitation email', () => {
    const input = createInvitationSchema.parse({
      email: 'USER@Example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      organizationId: 'e4979db9-fe73-42c9-85f3-0369bc777f41',
      roleCodes: ['READ_ONLY'],
    });
    expect(input.email).toBe('user@example.com');
  });

  it('requires a strong matching activation password', () => {
    expect(
      acceptInvitationSchema.safeParse({
        token: 'x'.repeat(43),
        password: 'weak-password',
        confirmPassword: 'weak-password',
      }).success,
    ).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        token: 'x'.repeat(43),
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
      }).success,
    ).toBe(true);
  });
});
