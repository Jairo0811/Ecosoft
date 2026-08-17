import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../common/async-handler';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { toCsv, toExcelXml, toPdf } from './report-export';
import { exportQuerySchema, reportQuerySchema, reportTypeSchema } from './reports.schemas';
import { getReport } from './reports.service';

const router = Router();
const exportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'EXPORT_RATE_LIMITED', message: 'Demasiadas exportaciones. Intente luego.' },
});

router.get(
  '/:type/export',
  exportLimiter,
  authenticate,
  requirePermission(permissions.reportsExport),
  asyncHandler(async (request, response) => {
    const type = reportTypeSchema.parse(request.params.type);
    const query = exportQuerySchema.parse(request.query);
    const report = await getReport(type, request.auth!, query);
    const generated =
      query.format === 'csv'
        ? { body: toCsv(report.columns, report.rows), mime: 'text/csv; charset=utf-8' }
        : query.format === 'xls'
          ? {
              body: toExcelXml(report.title, report.columns, report.rows),
              mime: 'application/vnd.ms-excel',
            }
          : { body: toPdf(report.title, report.columns, report.rows), mime: 'application/pdf' };
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'EXPORT',
      module: 'REPORTS',
      entity: type,
      result: 'SUCCESS',
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
      correlationId: request.correlationId,
      newValues: { format: query.format, rows: report.rows.length },
    });
    response
      .status(200)
      .set({
        'Content-Type': generated.mime,
        'Content-Disposition': `attachment; filename="ecosoft-${type}.${query.format}"`,
        'Cache-Control': 'private, no-store',
      })
      .send(generated.body);
  }),
);

router.get(
  '/:type',
  authenticate,
  requirePermission(permissions.reportsRead),
  asyncHandler(async (request, response) => {
    const type = reportTypeSchema.parse(request.params.type);
    const query = reportQuerySchema.parse(request.query);
    const report = await getReport(type, request.auth!, query);
    const start = (query.page - 1) * query.pageSize;
    response.json({
      data: report.rows.slice(start, start + query.pageSize),
      columns: report.columns,
      title: report.title,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: report.rows.length,
        totalPages: Math.max(1, Math.ceil(report.rows.length / query.pageSize)),
      },
    });
  }),
);

export { router as reportsRouter };
