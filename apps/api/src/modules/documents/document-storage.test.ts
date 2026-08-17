import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('document storage', () => {
  let directory = '';
  let previousStoragePath: string | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'ecosoft-documents-'));
    previousStoragePath = process.env.DOCUMENT_STORAGE_PATH;
    process.env.DOCUMENT_STORAGE_PATH = directory;
    jest.resetModules();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    if (previousStoragePath === undefined) delete process.env.DOCUMENT_STORAGE_PATH;
    else process.env.DOCUMENT_STORAGE_PATH = previousStoragePath;
  });

  it('stores content privately with its SHA-256', async () => {
    const { documentStorage } = await import('./document-storage');
    const stored = await documentStorage.save(Buffer.from('expediente').toString('base64'));
    await expect(readFile(path.join(directory, stored.storageKey), 'utf8')).resolves.toBe(
      'expediente',
    );
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects malformed base64', async () => {
    const { documentStorage } = await import('./document-storage');
    await expect(documentStorage.save('not-base64')).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_CONTENT',
    });
  });
});
