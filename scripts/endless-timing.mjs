// Endless-road generation timing in Chromium (EXPANSION_PLAN §C5).
//
// Usage (with the dev server running: npx vite --port 5186 --strictPort):
//   node scripts/endless-timing.mjs [--rate 4] [--from 602] [--count 60] [--tailor] [--url http://localhost:5186/]
//
// Two measurements, because Chromium's CPU throttling (CDP Emulation.setCPUThrottlingRate)
// applies to pages only ("Operation is only supported for pages, not workers"):
//   worker   the real path: prepareEndless(n) through the Web Worker (unthrottled)
//   main     the worker's exact job (same code, sizes and wall-clock budget) run on the
//            page's main thread at --rate× throttle: the slow-phone estimate
// Prints p50 / p95 / max per mode. --tailor runs the main-mode job with both stretches at full.
import { chromium } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const RATE = Number(arg('rate', 4));
const FROM = Number(arg('from', 602));
const COUNT = Number(arg('count', 60));
const TAILOR = process.argv.includes('--tailor');
const URL = arg('url', 'http://localhost:5186/');

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const saveData = JSON.stringify({ v: 1, onboarded: true, level: FROM - 1, gift: { day: 1, lastClaim: today }, journey: { revealed: true } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('jjak.save.v1', s);
    localStorage.setItem('CapacitorStorage.jjak.save.v1', s);
  }, saveData);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(URL);
  await page.waitForSelector('.home');
  await page.waitForTimeout(3000); // the boot warm-up
  return { ctx, page };
}

const stats = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `n=${s.length} p50 ${q(0.5)} ms · p95 ${q(0.95)} ms · max ${s.at(-1)} ms`;
};

// 1. The real worker path (unthrottled: CDP can't throttle workers).
{
  const { ctx, page } = await session();
  const res = await page.evaluate(async ({ from, count }) => {
    const m = await import('/src/director/endless.ts');
    const out = [];
    for (let n = from; n < from + count; n++) {
      const t0 = performance.now();
      await m.prepareEndless(n);
      const run = m.endlessRuns().at(-1);
      out.push({ n, wall: Math.round(performance.now() - t0), src: run.src });
    }
    return out;
  }, { from: FROM, count: COUNT });
  const srcs = res.reduce((a, r) => ((a[r.src] = (a[r.src] ?? 0) + 1), a), {});
  console.log(`worker (1×, round trip):       ${stats(res.map((r) => r.wall))}  ${JSON.stringify(srcs)}`);
  await ctx.close();
}

// 2. The worker's job on the throttled main thread.
{
  const { ctx, page } = await session();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const res = await page.evaluate(async ({ from, count, tailor }) => {
    const core = await import('/src/director/endless-core.ts');
    const { playStyle } = await import('/src/director/profile.ts');
    const { levelPlan } = await import('/src/director/plan.ts');
    const st = core.defaultEndlessState();
    const recent = [];
    const out = [];
    for (let n = from; n < from + count; n++) {
      const t = core.tailorFor(playStyle(), st, 0);
      if (tailor) Object.assign(t, { centreFirst: 8 * core.ENDLESS.centreStep, twoBend: 8 * core.ENDLESS.twoBendStep });
      const plan = core.endlessIdentity(n, t, st, recent.at(-1));
      const job = core.makeJob(n, plan, levelPlan(n).base, t, recent);
      const t0 = performance.now();
      const r = core.runEndlessJob(job, () => performance.now());
      out.push(Math.round(performance.now() - t0));
      if (r) recent.push(r.spec);
      if (recent.length > 12) recent.shift();
    }
    return out;
  }, { from: FROM, count: COUNT, tailor: TAILOR });
  console.log(`worker job, main thread ${RATE}×${TAILOR ? ' tailored' : ''}: ${stats(res)}`);
  await ctx.close();
}
await browser.close();
