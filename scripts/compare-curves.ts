/**
 * Before/after tables for two bank builds, from their docs/level-curve.json files:
 * the curve per tier, the d spread per place, the sawtooth, the mechanic mix, the fun
 * marks and the validator counts. Prints Markdown for the audit's hand-written part.
 *
 *   git show <commit>:docs/level-curve.json > before.json
 *   npm run bank:compare -- --before before.json [--after docs/level-curve.json]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CurveFile, type CurveLevel } from './lib/audit';

const opt = (name: string, def?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  if (def == null) throw new Error(`missing --${name} <path to a level-curve.json>`);
  return def;
};
const load = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8')) as CurveFile;
const before = load(opt('before'));
const after = load(opt('after', 'docs/level-curve.json'));
const B = before.levels.filter((l) => l.after?.length === 5);
const A = after.levels.filter((l) => l.after?.length === 5);
const buildB = before.build;
const buildA = after.build;

const TIERS = [0, 1, 2, 3, 4];
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '–');
const q = (xs: number[], p: number) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};
const ba = (b: number, a: number) => `${f2(b)} → ${f2(a)}`;
const out: string[] = [];
const say = (...lines: string[]) => out.push(...lines);

// 1. The curve per tier.
const firstFive = (L: CurveLevel[]) => L.filter((l) => l.ch < 5 && l.n > 6);
const lastFive = (L: CurveLevel[]) => L.filter((l) => l.ch >= 45);
say('### The curve per tier (mean d)', '', '| | T0 | T1 | T2 | T3 | T4 |', '|---|---|---|---|---|---|');
say(`| First five places (levels 7–60) | ${TIERS.map((t) => ba(mean(firstFive(B).map((l) => l.after[t])), mean(firstFive(A).map((l) => l.after[t])))).join(' | ')} |`);
say(`| Last five places (levels 541–600) | ${TIERS.map((t) => ba(mean(lastFive(B).map((l) => l.after[t])), mean(lastFive(A).map((l) => l.after[t])))).join(' | ')} |`);
say(`| Rise, last − first | ${TIERS.map((t) => ba(mean(lastFive(B).map((l) => l.after[t])) - mean(firstFive(B).map((l) => l.after[t])), mean(lastFive(A).map((l) => l.after[t])) - mean(firstFive(A).map((l) => l.after[t])))).join(' | ')} |`);
for (let a = 1; a <= 600; a += 50) {
  const band = (L: CurveLevel[]) => L.filter((l) => l.n >= a && l.n < a + 50);
  say(`| Levels ${a}–${a + 49} | ${TIERS.map((t) => ba(mean(band(B).map((l) => l.after[t])), mean(band(A).map((l) => l.after[t])))).join(' | ')} |`);
}
say('');

// 2. The spread of tier-2 d inside each place.
say('### Tier-2 d per place: 10th / 50th / 90th percentile (nearest rank) of its 12 levels, before → after', '', '| Place | Before | After | Place | Before | After |', '|---|---|---|---|---|---|');
const spread = (L: CurveLevel[], ch: number) => {
  const d = L.filter((l) => l.ch === ch).map((l) => l.after[2]);
  return `${f2(q(d, 0.1))} / ${f2(q(d, 0.5))} / ${f2(q(d, 0.9))}`;
};
for (let ch = 0; ch < 25; ch++) say(`| ${ch + 1} | ${spread(B, ch)} | ${spread(A, ch)} | ${ch + 26} | ${spread(B, ch + 25)} | ${spread(A, ch + 25)} |`);
say('');

// 3. The sawtooth, tier 2, chapters after the first.
const saw = (L: CurveLevel[]) => {
  let loose = 0;
  let strict = 0;
  let chapters = 0;
  for (let ch = 1; ch < 50; ch++) {
    const d = L.filter((l) => l.ch === ch).sort((x, y) => x.slot - y.slot).map((l) => l.after[2]);
    if (d.length !== 12) continue;
    chapters++;
    const s = d.slice().sort((x, y) => x - y);
    if (d[6] <= s[3] && d[0] <= s[5] && d[10] >= s[8]) loose++;
    if (d[10] >= Math.max(...d) && d[11] < d[10] && d[6] <= s[3] && d[0] <= s[3]) strict++;
  }
  const later = L.filter((l) => l.ch > 0);
  const bySlot = (slot: number) => mean(later.filter((l) => l.slot === slot).map((l) => l.after[2]));
  return { loose, strict, chapters, peakRest: bySlot(10) - bySlot(6) };
};
const sB = saw(B);
const sA = saw(A);
say('### Sawtooth (tier 2, chapters 2–50)', '', '| | Before | After |', '|---|---|---|');
say(`| Loose shape passes (rest among the four easiest, open in the easier half, peak among the four hardest) | ${sB.loose} / ${sB.chapters} | ${sA.loose} / ${sA.chapters} |`);
say(`| Strict shape passes (peak the hardest, festival below it, open and rest among the four easiest) | ${sB.strict} / ${sB.chapters} | ${sA.strict} / ${sA.chapters} |`);
say(`| Peak − rest (mean tier-2 d of slot 11 minus slot 7) | ${f2(sB.peakRest)} | ${f2(sA.peakRest)} |`, '');

// 4. The mechanic mix: level-tiers whose identity carries each mechanic.
const mechsOf = (l: CurveLevel) => (l.mech ? l.mech.split('+') : ['plain']);
const count = (L: CurveLevel[]) => {
  const m = new Map<string, number>();
  for (const l of L) for (const x of mechsOf(l)) m.set(x, (m.get(x) ?? 0) + 5);
  return m;
};
const cB = count(B);
const cA = count(A);
const firstOf = (L: CurveLevel[], m: string) => L.find((l) => mechsOf(l).includes(m))?.n;
say(`### Mechanic mix (level-tiers whose level carries the mechanic, of ${B.length * 5} before and ${A.length * 5} after)`, '', '| Mechanic | Before | After | First level (after) |', '|---|---|---|---|');
for (const m of [...new Set([...cB.keys(), ...cA.keys()])].sort((x, y) => (cA.get(y) ?? 0) - (cA.get(x) ?? 0))) {
  say(`| ${m}${cB.has(m) ? '' : ' (new)'} | ${cB.get(m) ?? 0} | ${cA.get(m) ?? 0} | ${firstOf(A, m) ?? '–'} |`);
}
say('');

// 5. Fun marks per tier (the before build did not record them).
const funned = (L: CurveLevel[]) => L.filter((l) => l.fun?.length === 5);
const rate = (L: CurveLevel[], k: number, t: number) => {
  const F = funned(L);
  return F.length ? `${((100 * F.filter((l) => l.fun![t][k] === '1').length) / F.length).toFixed(1)} %` : 'not recorded';
};
const feel = (l: CurveLevel) => `${l.shape}|${l.mech}|${l.goal}`;
const variety = (L: CurveLevel[]) => {
  const byN = new Map(L.map((l) => [l.n, l]));
  const v = L.filter((l) => l.n > 6 && byN.has(l.n - 1));
  return `${((100 * v.filter((l) => feel(byN.get(l.n - 1)!) !== feel(l)).length) / Math.max(1, v.length)).toFixed(1)} %`;
};
say('### Fun marks per tier (after)', '', '| Mark | T0 | T1 | T2 | T3 | T4 |', '|---|---|---|---|---|---|');
for (const [k, name] of [[0, 'Early foothold'], [1, 'Mid-board crunch'], [2, 'Combo finish']] as const) say(`| ${name} | ${TIERS.map((t) => rate(A, k, t)).join(' | ')} |`);
say('', `Variety (the tier-2 board feels different from the level before): ${variety(B)} → ${variety(A)}. The before build did not record the fun marks.`, '');

// 6. Validators.
const rej = (b: CurveFile['build']) => (b ? Object.entries(b.rejected).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ') : '–');
say('### Build and validators', '', '| | Before | After |', '|---|---|---|');
say(`| Boards built and validated by the search | ${buildB?.tried ?? '–'} | ${buildA?.tried ?? '–'} |`);
say(`| Rejected by a validator | ${rej(buildB)} | ${rej(buildA)} |`);
say(`| Failed levels (no valid board) | ${buildB?.failed.length ?? '–'} | ${buildA?.failed.length ?? '–'} |`);
say(`| Build time, threads | ${buildB ? `${buildB.seconds} s, ${buildB.workers}` : '–'} | ${buildA ? `${buildA.seconds} s, ${buildA.workers}` : '–'} |`);
say(`| Bank size | ${buildB ? `${(buildB.bankBytes / 1024).toFixed(1)} KB` : '–'} | ${buildA ? `${(buildA.bankBytes / 1024).toFixed(1)} KB` : '–'} |`, '');

console.log(out.join('\n'));
