/**
 * Formatting conventions (single source of truth for the UI):
 *
 * - The API stores and returns instants in UTC (ISO 8601).
 * - Instants (aperturas, cierres, eventos, auditoría) are shown in the viewer's local time
 *   zone, with the zone name, because participants are not necessarily in
 *   America/Santo_Domingo.
 * - Calendar dates without time (vigencia de contratos y normas) are captured as
 *   `YYYY-MM-DD`, persisted as UTC midnight and therefore rendered in UTC so that a viewer at
 *   UTC−4 never sees the previous day.
 * - Numbers use the es-DO locale.
 */
const LOCALE = 'es-DO';

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value: string | Date | null | undefined, fallback = '—'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

/** Short zone label of the viewer, e.g. "GMT-4", shown next to instant inputs. */
export const viewerTimeZoneLabel = (reference: Date = new Date()): string =>
  new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'short' })
    .formatToParts(reference)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'hora local';

/** Date-only business values (persisted as UTC midnight). */
export const formatCalendarDate = (
  value: string | Date | null | undefined,
  fallback = '—',
): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
};

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

export const formatNumber = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return (Number.isInteger(number) ? integerFormat : decimalFormat).format(number);
};

export const formatUnit = (value: unknown, unit: string, fallback = '—'): string => {
  const formatted = formatNumber(value, '');
  return formatted ? `${formatted} ${unit}` : fallback;
};

export const formatMoney = (value: unknown, currency = 'USD', fallback = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${decimalFormat.format(number)} ${currency}`;
  }
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${decimalFormat.format(bytes / 1024)} KB`;
  return `${decimalFormat.format(bytes / (1024 * 1024))} MB`;
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Superadministrador',
  CNE_ADMIN: 'Administrador CNE',
  AUCTION_MANAGER: 'Gestor de subastas',
  TECHNICAL_EVALUATOR: 'Evaluador técnico',
  FINANCIAL_EVALUATOR: 'Evaluador financiero',
  REGULATORY_SUPERVISOR: 'Supervisor regulatorio',
  AUDITOR: 'Auditor',
  COMPANY_ADMIN: 'Administrador de empresa',
  COMPANY_REPRESENTATIVE: 'Representante de empresa',
  READ_ONLY: 'Solo lectura',
};

export const formatRole = (code: string | undefined): string =>
  code ? (roleLabels[code] ?? code.replaceAll('_', ' ')) : '';

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO instant → value for `<input type="datetime-local">` in the viewer's time zone. */
export const toDateTimeLocalInput = (value: string | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

/** `datetime-local` value (viewer's time zone) → ISO instant in UTC, or undefined if empty/invalid. */
export const fromDateTimeLocalInput = (value: string | null | undefined): string | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
