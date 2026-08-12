import type { Prisma } from '@prisma/client';

interface AuctionMilestones {
  id: string;
  code: string;
  title: string;
  openAt: Date;
  closeAt: Date;
  evaluationStartAt: Date | null;
  awardPlannedAt: Date | null;
  createdByUserId: string;
}

export const replaceSystemCalendarEvents = async (
  transaction: Prisma.TransactionClient,
  auction: AuctionMilestones,
): Promise<void> => {
  await transaction.calendarEvent.deleteMany({
    where: { auctionId: auction.id, source: 'SYSTEM' },
  });
  const events: Prisma.CalendarEventCreateManyInput[] = [
    {
      auctionId: auction.id,
      createdByUserId: auction.createdByUserId,
      source: 'SYSTEM',
      type: 'APERTURA',
      title: `Apertura · ${auction.code}`,
      description: auction.title,
      startsAt: auction.openAt,
    },
    {
      auctionId: auction.id,
      createdByUserId: auction.createdByUserId,
      source: 'SYSTEM',
      type: 'CIERRE',
      title: `Cierre · ${auction.code}`,
      description: auction.title,
      startsAt: auction.closeAt,
    },
  ];
  if (auction.evaluationStartAt) {
    events.push({
      auctionId: auction.id,
      createdByUserId: auction.createdByUserId,
      source: 'SYSTEM',
      type: 'EVALUACION',
      title: `Evaluación · ${auction.code}`,
      description: auction.title,
      startsAt: auction.evaluationStartAt,
    });
  }
  if (auction.awardPlannedAt) {
    events.push({
      auctionId: auction.id,
      createdByUserId: auction.createdByUserId,
      source: 'SYSTEM',
      type: 'ADJUDICACION',
      title: `Adjudicación · ${auction.code}`,
      description: auction.title,
      startsAt: auction.awardPlannedAt,
    });
  }
  await transaction.calendarEvent.createMany({ data: events });
};
