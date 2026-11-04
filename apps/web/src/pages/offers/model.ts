import type { BidStatus } from '@ecosoft/shared';
import { formatBytes } from '../../utils/format';

export { formatBytes };

export interface Bid {
  id: string;
  auctionId: string;
  projectName: string;
  status: BidStatus;
  renewableTechnologyCode: string;
  offeredPowerMw: string;
  estimatedEnergyMwh: string;
  offeredPrice: string | null;
  currencyCode: string | null;
  validUntil: string;
  submittedAt: string | null;
  auction: { id: string; code: string; title: string; status: string; closeAt: string };
  organization: { id: string; legalName: string; commercialName: string | null };
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  documentType: string;
  entityType: string;
  entityId: string;
  status: string;
  confidentiality: string;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersion[];
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

export const bidStatusLabels: Record<BidStatus, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  RETIRADA: 'Retirada',
  EN_EVALUACION: 'En evaluación',
  ADJUDICADA: 'Adjudicada',
  NO_SELECCIONADA: 'No seleccionada',
};

export const bidStatusColor = (
  status: BidStatus,
): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  if (status === 'ENVIADA' || status === 'EN_EVALUACION') return 'info';
  if (status === 'ADJUDICADA') return 'success';
  if (status === 'RETIRADA') return 'warning';
  if (status === 'NO_SELECCIONADA') return 'error';
  return 'default';
};

export const entityTypeLabels: Record<string, string> = {
  BID: 'Oferta',
  ENERGY_PROJECT: 'Proyecto energético',
  PPA_CONTRACT: 'Contrato PPA',
  AUCTION: 'Subasta',
  EVALUATION: 'Evaluación',
  AWARD: 'Adjudicación',
  REGULATION: 'Norma',
};

/** Accepted by the API (documents.schemas.ts), keyed by extension. */
export const acceptedFiles: Record<string, { mime: string; label: string }> = {
  '.pdf': { mime: 'application/pdf', label: 'PDF' },
  '.png': { mime: 'image/png', label: 'PNG' },
  '.jpg': { mime: 'image/jpeg', label: 'JPG' },
  '.jpeg': { mime: 'image/jpeg', label: 'JPG' },
  '.txt': { mime: 'text/plain', label: 'TXT' },
  '.docx': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
  },
  '.xlsx': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'XLSX',
  },
};
export const acceptAttribute = Object.keys(acceptedFiles).join(',');
export const acceptedLabel = 'PDF, PNG, JPG, TXT, DOCX o XLSX';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Client-side pre-check (the API re-validates extension, MIME and the real content). */
export const checkFile = (
  file: File,
): { ok: true; mime: string } | { ok: false; message: string } => {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const accepted = acceptedFiles[extension];
  if (!accepted) {
    return { ok: false, message: `Formato no admitido. Use ${acceptedLabel}.` };
  }
  if (file.size === 0) return { ok: false, message: 'El archivo está vacío.' };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `El archivo pesa ${formatBytes(file.size)}; el máximo es 5 MB.`,
    };
  }
  return { ok: true, mime: accepted.mime };
};

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? (reader.result.split(',')[1] ?? '') : '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });

/** File name from an RFC 5987 Content-Disposition header (falls back to the plain name). */
export const fileNameFromDisposition = (header: string | undefined, fallback: string): string => {
  if (!header) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // fall through to the ASCII name
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
};
