import { createHash } from 'node:crypto';

const canonicalize = (value: unknown): unknown => {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
};

export const createSnapshot = (value: unknown): { json: string; hash: string } => {
  const json = JSON.stringify(canonicalize(value));
  return { json, hash: createHash('sha256').update(json).digest('hex') };
};
