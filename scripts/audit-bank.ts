/**
 * Re-render docs/level-audit.md from docs/level-curve.json (written by
 * `npm run bank`) without rebuilding anything: `npm run bank:audit`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CurveFile, renderAudit } from './lib/audit';

const root = process.cwd();
const curve = JSON.parse(readFileSync(resolve(root, 'docs/level-curve.json'), 'utf8')) as CurveFile;
writeFileSync(resolve(root, 'docs/level-audit.md'), renderAudit(curve));
console.log(`audit: ${curve.levels.length} levels → docs/level-audit.md`);
