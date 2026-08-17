import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../common/app-error';
import { env } from '../../config/env';

const maxBytes = 5 * 1024 * 1024;

const decode = (contentBase64: string): Buffer => {
  const normalized = contentBase64.replace(/^data:[^;]+;base64,/, '');
  if (
    normalized.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
  )
    throw new AppError(400, 'INVALID_DOCUMENT_CONTENT', 'El contenido base64 no es válido.');
  const content = Buffer.from(normalized, 'base64');
  if (!content.length || content.length > maxBytes) {
    throw new AppError(400, 'INVALID_DOCUMENT_SIZE', 'El archivo debe pesar entre 1 byte y 5 MB.');
  }
  return content;
};

const filePath = (storageKey: string): string => {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey))
    throw new AppError(500, 'INVALID_STORAGE_KEY', 'La referencia documental no es válida.');
  return path.resolve(env.DOCUMENT_STORAGE_PATH, storageKey);
};

export const documentStorage = {
  async save(
    contentBase64: string,
  ): Promise<{ storageKey: string; sha256: string; sizeBytes: number }> {
    const content = decode(contentBase64);
    const storageKey = randomUUID();
    await mkdir(path.resolve(env.DOCUMENT_STORAGE_PATH), { recursive: true });
    await writeFile(filePath(storageKey), content, { flag: 'wx', mode: 0o600 });
    return {
      storageKey,
      sha256: createHash('sha256').update(content).digest('hex'),
      sizeBytes: content.length,
    };
  },
  read(storageKey: string): Promise<Buffer> {
    return readFile(filePath(storageKey));
  },
  async remove(storageKey: string): Promise<void> {
    await rm(filePath(storageKey), { force: true });
  },
};
