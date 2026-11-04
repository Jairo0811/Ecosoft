import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../common/async-handler';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { XLSX_MIME, toCsv, toPdf, toXlsx, type ExportMeta } from './report-export';
import {
  exportQuerySchema,
  reportQuerySchema,
  reportTypeSchema,
  type ReportQuery,
} from './reports.schemas';
import { EXPORT_ROW_LIMIT, getReport } from './reports.service';

const router = Router();
const exportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'EXPORT_RATE_LIMITED', message: 'Demasiadas exportaciones. Intente luego.' },
});

/** Human-readable filter summary printed on PDF exports. */
const describeFilters = (query: ReportQuery): string[] =>
  [
    query.from ? `Desde ${query.from.toISOString().slice(0, 10)}` : null,
    query.to ? `Hasta ${query.to.toISOString().slice(0, 10)}` : null,
    query.technology ? `Tecnología ${query.technology}` : null,
    query.status ? `Estado ${query.status}` : null,
    query.organizationId ? `Organización ${query.organizationId}` : null,
  ].filter((value): value is string => value !== null);

router.get(
  '/:type/export',
  exportLimiter,
  authenticate,
  requirePermission(permissions.reportsExport),
  asyncHandler(async (request, response) => {
    const type = reportTypeSchema.parse(request.params.type);
    const query = exportQuerySchema.parse(request.query);
    const report = await getReport(type, request.auth!, query, {
      skip: 0,
      take: EXPORT_ROW_LIMIT,
    });
    const meta: ExportMeta = {
      title: report.title,
      generatedAt: new Date(),
      total: report.total,
      truncated: report.total > report.rows.length,
    };
    // `xls` is accepted for backwards compatibility and now yields a real XLSX workbook (the
    // former SpreadsheetML payload made Excel warn that content and extension did not match).
    const format = query.format === 'xls' ? 'xlsx' : query.format;
    const generated =
      format === 'csv'
        ? { body: toCsv(report.columns, report.rows), mime: 'text/csv; charset=utf-8' }
        : format === 'xlsx'
          ? { body: toXlsx(meta, report.columns, report.rows), mime: XLSX_MIME }
          : {
              body: toPdf(meta, report.columns, report.rows, describeFilters(query)),
              mime: 'application/pdf',
            };
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
      newValues: {
        format,
        rows: report.rows.length,
        total: report.total,
        truncated: meta.truncated,
      },
    });
    const stamp = meta.generatedAt.toISOString().slice(0, 10);
    response
      .status(200)
      .set({
        'Content-Type': generated.mime,
        'Content-Disposition': `attachment; filename="ecosoft-${type}-${stamp}.${format}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        // Truncation is never silent: clients surface these headers to the user.
        'X-Report-Total': String(report.total),
        'X-Report-Rows': String(report.rows.length),
        'X-Report-Truncated': String(meta.truncated),
        'Access-Control-Expose-Headers':
          'Content-Disposition, X-Report-Total, X-Report-Rows, X-Report-Truncated',
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
    const report = await getReport(type, request.auth!, query, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    response.json({
      data: report.rows,
      columns: report.columns,
      title: report.title,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: report.total,
        totalPages: Math.max(1, Math.ceil(report.total / query.pageSize)),
      },
    });
  }),
);

export { router as reportsRouter };
