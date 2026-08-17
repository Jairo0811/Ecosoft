import { sanitizeAuditValue } from './audit.service';

describe('sanitizeAuditValue', () => {
  it('redacts secrets recursively and keeps useful evidence', () => {
    expect(
      sanitizeAuditValue({
        email: 'audit@example.com',
        password: 'unsafe',
        nested: { refreshToken: 'unsafe', status: 'ACTIVE' },
      }),
    ).toEqual({
      email: 'audit@example.com',
      nested: { refreshToken: '[REDACTED]', status: 'ACTIVE' },
      password: '[REDACTED]',
    });
  });
});
