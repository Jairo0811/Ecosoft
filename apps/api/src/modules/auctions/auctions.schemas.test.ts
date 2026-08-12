import {
  auctionCreateSchema,
  calendarEventCreateSchema,
  requirementListSchema,
} from './auctions.schemas';

describe('auction schemas', () => {
  const validAuction = {
    code: 'cne-sol-2026-01',
    title: 'Subasta solar nacional 2026',
    managingOrganizationId: 'e4979db9-fe73-42c9-85f3-0369bc777f41',
    renewableTechnologyCode: 'solar',
    currencyCode: 'dop',
    capacityMw: 150,
    maximumPrice: 125.5,
    openAt: '2026-09-01T13:00:00.000Z',
    closeAt: '2026-10-01T13:00:00.000Z',
    evaluationStartAt: '2026-10-02T13:00:00.000Z',
    awardPlannedAt: '2026-11-01T13:00:00.000Z',
  };

  it('normalizes codes and accepts an ordered schedule', () => {
    const result = auctionCreateSchema.parse(validAuction);
    expect(result.code).toBe('CNE-SOL-2026-01');
    expect(result.renewableTechnologyCode).toBe('SOLAR');
    expect(result.currencyCode).toBe('DOP');
  });

  it('rejects closing before opening', () => {
    expect(
      auctionCreateSchema.safeParse({
        ...validAuction,
        closeAt: '2026-08-01T13:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('requires at least one valid requirement', () => {
    expect(requirementListSchema.safeParse({ requirements: [] }).success).toBe(false);
    expect(
      requirementListSchema.safeParse({
        requirements: [{ code: 'REQ-01', title: 'Certificación ambiental', category: 'LEGAL' }],
      }).success,
    ).toBe(true);
  });

  it('rejects calendar events with inverted dates', () => {
    expect(
      calendarEventCreateSchema.safeParse({
        type: 'REUNION',
        title: 'Reunión informativa',
        startsAt: '2026-09-02T13:00:00.000Z',
        endsAt: '2026-09-01T13:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});
