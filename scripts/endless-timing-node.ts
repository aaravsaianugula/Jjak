/**
 * Endless-road generation timing in Node (EXPANSION_PLAN §C5): the worker's exact job
 * (src/director/endless-core.ts) run back to back for a stretch of endless levels, in
 * both search sizes, the worker's full one and the main-thread fallback's quick one.
 * A job that finds nothing valid before its hard deadline returns null; the game then
 * serves the bank's proven board (endless-fallback.ts), counted here as a fallback.
 *
 *   npm run endless:timing                  180 jobs from level 602
 *   npm run endless:timing -- --from 700 --count 60
 *
 * Node runs unthrottled on a desktop CPU; scripts/endless-timing.mjs measures the same
 * job in Chromium, throttled, for the slow-phone estimate.
 */
import { ENDLESS, defaultEndlessState, endlessIdentity, makeJob, runEndlessJob, tailorFor } from '../src/director/endless-core';
import { levelPlan } from '../src/director/plan';
import { playStyle } from '../src/director/profile';
import { type LevelSpec } from '../src/engine/levels';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const FROM = arg('from', 602);
const COUNT = arg('count', 180);

const q = (s: number[], p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];

for (const [mode, size] of [['full', ENDLESS.search], ['quick', ENDLESS.quick]] as const) {
  const st = defaultEndlessState();
  const recent: LevelSpec[] = [];
  const ms: number[] = [];
  let fallbacks = 0;
  for (let n = FROM; n < FROM + COUNT; n++) {
    const t = tailorFor(playStyle(), st, 0);
    const plan = endlessIdentity(n, t, st, recent.at(-1));
    const job = makeJob(n, plan, levelPlan(n).base, t, recent, { size });
    const t0 = performance.now();
    const r = runEndlessJob(job, () => performance.now());
    ms.push(performance.now() - t0);
    if (!r) {
      fallbacks++;
      continue;
    }
    recent.push(r.spec);
    if (recent.length > 12) recent.shift();
  }
  const s = ms.slice().sort((a, b) => a - b);
  console.log(
    `${mode.padEnd(5)} ${COUNT} jobs from ${FROM}: p50 ${q(s, 0.5).toFixed(0)} ms · p95 ${q(s, 0.95).toFixed(0)} ms · max ${s[s.length - 1].toFixed(0)} ms · ` +
      `fallback ${fallbacks}/${COUNT} (${((100 * fallbacks) / COUNT).toFixed(1)} %) · hard deadline ${size.hardMs} ms`,
  );
}
