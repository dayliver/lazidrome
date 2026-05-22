#!/usr/bin/env node
/**
 * 배포·빌드 직전에 프론트/백엔드 build-info.json 생성 (Settings 배포 시각 표시용)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const builtAt = new Date().toISOString();

function write(component, outPath) {
  const payload = {
    component,
    version: pkg.version ?? '0.0.0',
    builtAt,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[build-info] ${component} → ${path.relative(root, outPath)} (${builtAt})`);
}

write('frontend', path.join(root, 'frontend/public/build-info.json'));
write('backend', path.join(root, 'backend/build-info.json'));
