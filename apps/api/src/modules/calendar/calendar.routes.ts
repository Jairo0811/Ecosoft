import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auctionAccessWhere, hasInstitutionalAuctionAccess } from '../auctions/auction-access';
import { calendarEventCreateSchema, calendarQuerySchema } from '../auctions/auctions.schemas';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

router.get(
  '/',
  authenticate,
  requirePermission(permissions.auctionsRead),
  asyncHandler(async (request, response) => {
    const query = calendarQuerySchema.parse(request.query);
    const access = auctionAccessWhere(request.auth!);
    const where: Prisma.CalendarEventWhereInput = {
      startsAt: { gte: query.from, lte: query.to },
      ...(query.type ? { type: query.type } : {}),
      ...(hasInstitutionalAuctionAccess(request.auth!) ? {} : { auction: { is: access } }),
    };
    const events = await prisma.calendarEvent.findMany({
      where,
      select: {
        id: true,
        type: true,
        source: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        location: true,
        auction: { select: { id: true, code: true, title: true, status: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { title: 'asc' }],
    });
    response.json({ data: events });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.auctionsUpdate),
  asyncHandler(async (request, response) => {
    if (!hasInstitutionalAuctionAccess(request.auth!)) {
      throw new AppError(403, 'CALENDAR_MANAGEMENT_REQUIRED', 'No puede crear eventos.');
    }
    const input = calendarEventCreateSchema.parse(request.body);
    if (input.auctionId) {
      const auction = await prisma.auction.findUnique({
        where: { id: input.auctionId },
        select: { id: true },
      });
      if (!auction) throw new AppError(404, 'AUCTION_NOT_FOUND', 'La subasta no existe.');
    }
    const event = await prisma.calendarEvent.create({
      data: { ...input, source: 'MANUAL', createdByUserId: request.auth!.id },
      select: {
        id: true,
        auctionId: true,
        type: true,
        source: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        location: true,
      },
    });
    await auditService.record({
      userId: request.auth!.id,
      action: 'CREATE',
      module: 'CALENDAR',
      entity: 'CalendarEvent',
      entityId: event.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: event,
    });
    response.status(201).json({ data: event });
  }),
);

router.delete(
  '/:id',
  authenticate,
  requirePermission(permissions.auctionsUpdate),
  asyncHandler(async (request, response) => {
    if (!hasInstitutionalAuctionAccess(request.auth!)) {
      throw new AppError(403, 'CALENDAR_MANAGEMENT_REQUIRED', 'No puede eliminar eventos.');
    }
    const id = parseId(request.params.id);
    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new AppError(404, 'CALENDAR_EVENT_NOT_FOUND', 'El evento no existe.');
    if (event.source !== 'MANUAL') {
      throw new AppError(
        409,
        'SYSTEM_EVENT_PROTECTED',
        'Los hitos automáticos se modifican desde la subasta.',
      );
    }
    await prisma.calendarEvent.delete({ where: { id } });
    await auditService.record({
      userId: request.auth!.id,
      action: 'DELETE',
      module: 'CALENDAR',
      entity: 'CalendarEvent',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: event,
    });
    response.status(204).send();
  }),
);

export { router as calendarRouter };
