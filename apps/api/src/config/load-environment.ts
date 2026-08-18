import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

const ENV_CANDIDATES = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];

export function loadEnvironment(): void {
  const envPath = ENV_CANDIDATES.find((candidate) => existsSync(candidate));

  if (envPath) {
    config({ path: envPath });
  }
}
