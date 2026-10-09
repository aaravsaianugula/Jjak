/**
 * Re-render docs/level-audit.md from docs/level-curve.json (written by
 * `npm run bank`) without rebuilding anything: `npm run bank:audit`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CurveFile, renderAudit, withKept } from './lib/audit';

const root = process.cwd();
const curve = JSON.parse(readFileSync(resolve(root, 'docs/level-curve.json'), 'utf8')) as CurveFile;
const auditPath = resolve(root, 'docs/level-audit.md');
writeFileSync(auditPath, withKept(renderAudit(curve), existsSync(auditPath) ? readFileSync(auditPath, 'utf8') : null));
console.log(`audit: ${curve.levels.length} levels → docs/level-audit.md`);
