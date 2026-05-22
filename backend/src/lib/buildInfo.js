import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_INFO_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../build-info.json'
);

let cached = null;

/** @returns {{ component: string, version: string | null, builtAt: string | null }} */
export function getBackendBuildInfo() {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
    const data = JSON.parse(raw);
    cached = {
      component: 'backend',
      version: data.version ?? null,
      builtAt: data.builtAt ?? null,
    };
  } catch {
    cached = { component: 'backend', version: null, builtAt: null };
  }
  return cached;
}
