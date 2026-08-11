import { prisma } from '../../config/prisma';

export interface AuditEvent {
  userId?: string;
  organizationId?: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  previousValues?: unknown;
  newValues?: unknown;
}

const serialize = (value: unknown): string | undefined =>
  value === undefined ? undefined : JSON.stringify(value);

export const auditService = {
  async record(event: AuditEvent): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        organizationId: event.organizationId,
        action: event.action,
        module: event.module,
        entity: event.entity,
        entityId: event.entityId,
        result: event.result,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        correlationId: event.correlationId,
        previousValues: serialize(event.previousValues),
        newValues: serialize(event.newValues),
      },
    });
  },
};
