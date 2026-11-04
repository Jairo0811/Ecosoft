import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../common/app-error';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export interface PreparedDocument {
  content: Buffer;
  sha256: string;
  sizeBytes: number;
}

export interface StoredDocument {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

const decode = (contentBase64: string): Buffer => {
  const normalized = contentBase64.replace(/^data:[^;]+;base64,/, '');
  if (
    normalized.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
  )
    throw new AppError(400, 'INVALID_DOCUMENT_CONTENT', 'El contenido base64 no es válido.');
  const content = Buffer.from(normalized, 'base64');
  if (!content.length || content.length > MAX_DOCUMENT_BYTES) {
    throw new AppError(400, 'INVALID_DOCUMENT_SIZE', 'El archivo debe pesar entre 1 byte y 5 MB.');
  }
  return content;
};

const startsWith = (content: Buffer, signature: number[]) =>
  signature.every((byte, index) => content[index] === byte);

const isZip = (content: Buffer) => startsWith(content, [0x50, 0x4b, 0x03, 0x04]);
// OOXML part names are stored uncompressed in local and central directory headers.
const zipContainsEntryPrefix = (content: Buffer, prefix: string) =>
  content.includes(Buffer.from(prefix, 'utf8'));

const isUtf8Text = (content: Buffer) => {
  if (content.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
};

/**
 * Basic content sniffing: the declared MIME type must match the file signature. This blocks
 * renamed executables/HTML being stored as PDFs or images. It is NOT antivirus/CDR scanning.
 */
const contentMatchers: Record<string, { extensions: string[]; matches: (c: Buffer) => boolean }> = {
  'application/pdf': {
    extensions: ['.pdf'],
    matches: (c) => startsWith(c, [0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
  },
  'image/png': {
    extensions: ['.png'],
    matches: (c) => startsWith(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    matches: (c) => startsWith(c, [0xff, 0xd8, 0xff]),
  },
  'text/plain': { extensions: ['.txt'], matches: isUtf8Text },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    matches: (c) => isZip(c) && zipContainsEntryPrefix(c, 'word/'),
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    matches: (c) => isZip(c) && zipContainsEntryPrefix(c, 'xl/'),
  },
};

export const assertFileMatchesType = (fileName: string, mimeType: string, content?: Buffer) => {
  const matcher = contentMatchers[mimeType];
  if (!matcher) {
    throw new AppError(415, 'UNSUPPORTED_DOCUMENT_TYPE', 'El tipo de archivo no está permitido.');
  }
  // Path separators and control characters are never valid in a stored original name.
  // eslint-disable-next-line no-control-regex
  if (/[\\/\u0000-\u001f\u007f]/.test(fileName)) {
    throw new AppError(400, 'INVALID_DOCUMENT_NAME', 'El nombre del archivo no es válido.');
  }
  const extension = path.extname(fileName).toLowerCase();
  if (!matcher.extensions.includes(extension)) {
    throw new AppError(
      400,
      'DOCUMENT_EXTENSION_MISMATCH',
      `La extensión del archivo no corresponde al tipo declarado (${matcher.extensions.join(', ')}).`,
    );
  }
  if (content && !matcher.matches(content)) {
    throw new AppError(
      400,
      'DOCUMENT_CONTENT_MISMATCH',
      'El contenido del archivo no corresponde al tipo declarado.',
    );
  }
};

const filePath = (storageKey: string): string => {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey))
    throw new AppError(500, 'INVALID_STORAGE_KEY', 'La referencia documental no es válida.');
  return path.resolve(env.DOCUMENT_STORAGE_PATH, storageKey);
};

const sha256 = (content: Buffer) => createHash('sha256').update(content).digest('hex');

export const documentStorage = {
  /** Decodes and validates content without touching the disk. */
  prepare(contentBase64: string, fileName?: string, mimeType?: string): PreparedDocument {
    const content = decode(contentBase64);
    if (fileName !== undefined && mimeType !== undefined) {
      assertFileMatchesType(fileName, mimeType, content);
    }
    return { content, sha256: sha256(content), sizeBytes: content.length };
  },

  async write(prepared: PreparedDocument): Promise<StoredDocument> {
    const storageKey = randomUUID();
    await mkdir(path.resolve(env.DOCUMENT_STORAGE_PATH), { recursive: true });
    await writeFile(filePath(storageKey), prepared.content, { flag: 'wx', mode: 0o600 });
    return { storageKey, sha256: prepared.sha256, sizeBytes: prepared.sizeBytes };
  },

  async save(contentBase64: string): Promise<StoredDocument> {
    return this.write(this.prepare(contentBase64));
  },

  read(storageKey: string): Promise<Buffer> {
    return readFile(filePath(storageKey));
  },

  /** Reads a version and fails closed when its bytes no longer match the recorded SHA-256. */
  async readVerified(storageKey: string, expectedSha256: string): Promise<Buffer> {
    const content = await this.read(storageKey);
    if (sha256(content) !== expectedSha256.toLowerCase()) {
      logger.error({ storageKey }, 'Document integrity check failed (SHA-256 mismatch)');
      throw new AppError(
        500,
        'DOCUMENT_INTEGRITY_ERROR',
        'La integridad del documento no pudo verificarse. Contacte al administrador.',
      );
    }
    return content;
  },

  async remove(storageKey: string): Promise<void> {
    await rm(filePath(storageKey), { force: true });
  },

  /**
   * Compensation for a write whose database transaction did not commit. A failure here never
   * hides the original error: it is logged with the key so the orphan can be traced.
   */
  async discardUncommitted(storageKey: string, correlationId?: string): Promise<void> {
    try {
      await this.remove(storageKey);
    } catch (error) {
      logger.error(
        { err: error, storageKey, correlationId },
        'Orphan document file could not be removed after a failed transaction',
      );
    }
  },
};
