import {
  formatBytes,
  formatCalendarDate,
  formatMoney,
  formatNumber,
  formatRole,
  formatUnit,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from './format';

describe('format utilities', () => {
  it('renders date-only values in UTC so negative offsets never shift the day', () => {
    // Persisted by the API as UTC midnight for a contract starting 1 Jan 2027.
    expect(formatCalendarDate('2027-01-01T00:00:00.000Z')).toMatch(/1.*ene.*2027/i);
  });

  it('round-trips datetime-local values through UTC ISO instants', () => {
    const iso = fromDateTimeLocalInput('2026-11-30T14:45');
    expect(iso).toMatch(/^2026-11-30T\d{2}:45:00\.000Z$/);
    expect(toDateTimeLocalInput(iso)).toBe('2026-11-30T14:45');
  });

  it('rejects empty or malformed datetime-local values instead of producing Invalid Date', () => {
    expect(fromDateTimeLocalInput('')).toBeUndefined();
    expect(fromDateTimeLocalInput('30/11/2026 14:45')).toBeUndefined();
    expect(toDateTimeLocalInput('not-a-date')).toBe('');
  });

  it('formats numbers, units, money and sizes and keeps a visible fallback for missing data', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber('abc')).toBe('—');
    expect(formatUnit(150, 'MW')).toBe('150 MW');
    expect(formatUnit(undefined, 'MW')).toBe('—');
    expect(formatMoney(42.5, 'USD')).toMatch(/42\.50/);
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('translates role codes for display', () => {
    expect(formatRole('COMPANY_ADMIN')).toBe('Administrador de empresa');
    expect(formatRole('CUSTOM_ROLE')).toBe('CUSTOM ROLE');
  });
});
