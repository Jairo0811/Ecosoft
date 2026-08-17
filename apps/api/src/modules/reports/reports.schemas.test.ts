import { exportQuerySchema, reportTypeSchema } from './reports.schemas';

describe('report schemas', () => {
  it('acepta reportes y formato Excel explícito', () => {
    expect(reportTypeSchema.parse('contracts')).toBe('contracts');
    expect(exportQuerySchema.parse({ format: 'xls' }).format).toBe('xls');
  });

  it('rechaza rangos de fechas invertidos', () => {
    expect(() =>
      exportQuerySchema.parse({ from: '2026-08-10', to: '2026-08-01', format: 'pdf' }),
    ).toThrow();
  });
});
