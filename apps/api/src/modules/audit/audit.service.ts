import { createHash } from 'node:crypto';
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

const sensitiveKey = /password|token|secret|authorization|cookie|hash/i;

export const sanitizeAuditValue = (value: unknown): unknown => {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : sanitizeAuditValue(nested),
      ]),
  );
};

const serialize = (value: unknown): string | undefined =>
  value === undefined ? undefined : JSON.stringify(sanitizeAuditValue(value));

const hashEvent = (event: AuditEvent): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        action: event.action,
        correlationId: event.correlationId,
        entity: event.entity,
        entityId: event.entityId,
        ipAddress: event.ipAddress,
        module: event.module,
        newValues: sanitizeAuditValue(event.newValues),
        organizationId: event.organizationId,
        previousValues: sanitizeAuditValue(event.previousValues),
        result: event.result,
        userAgent: event.userAgent,
        userId: event.userId,
      }),
    )
    .digest('hex');

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
        eventHash: hashEvent(event),
      },
    });
  },
};
