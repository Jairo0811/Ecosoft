import { catalogCreateSchema, catalogQuerySchema, parseMetadata } from './catalogs.schemas';

describe('catalog schemas', () => {
  it('accepts fixed catalog types and uppercase codes', () => {
    expect(
      catalogCreateSchema.safeParse({
        type: 'ENERGY_TECHNOLOGY',
        code: 'SOLAR_CSP',
        name: 'Solar de concentración',
      }).success,
    ).toBe(true);
  });

  it('rejects unsupported catalog types', () => {
    expect(
      catalogCreateSchema.safeParse({ type: 'CUSTOM', code: 'TEST', name: 'Prueba' }).success,
    ).toBe(false);
  });

  it('normalizes active filters and metadata', () => {
    expect(catalogQuerySchema.parse({ active: 'false' }).active).toBe(false);
    expect(parseMetadata('{"unit":"MW"}')).toEqual({ unit: 'MW' });
  });
});
