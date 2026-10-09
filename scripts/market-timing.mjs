// Market tab-switch timing: tap → second animation frame (the first frame after the
// tab's content has been styled, laid out and painted), per tab, at a CPU throttle.
//
// Usage (with the dev server running: npx vite --port 5191 --strictPort):
//   node scripts/market-timing.mjs [--rate 4] [--rounds 5] [--settle 4000] [--url http://localhost:5191/]
//
// Each round visits every tab from Tools (so every switch starts from the same tab).
// Round 1 is the first visit (what a player meets); median and min cover every round
// (min is the least disturbed by other load on the machine).
// --settle is how long the Market sits open before the first tap (its idle warm-up).
import { chromium } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const RATE = Number(arg('rate', 4));
const ROUNDS = Number(arg('rounds', 5));
const SETTLE = Number(arg('settle', 4000));
const URL = arg('url', 'http://localhost:5191/');
const TABS = ['decks', 'backs', 'brushes', 'effects', 'papers', 'garden', 'music'];

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const saveData = JSON.stringify({ v: 1, onboarded: true, level: 130, petals: 900, gift: { day: 1, lastClaim: today }, journey: { revealed: true } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => {
  localStorage.setItem('jjak.save.v1', s);
  localStorage.setItem('CapacitorStorage.jjak.save.v1', s);
}, saveData);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(URL);
await page.waitForSelector('.home');
await page.waitForTimeout(2500); // the boot warm-up
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
await page.click('[data-go="market"]');
await page.waitForSelector('.market [data-tab="tools"]');
await page.waitForTimeout(SETTLE);

/** Tap a tab and time it to the second animation frame after. */
const tapTab = (id) =>
  page.evaluate(
    (tab) =>
      new Promise((resolve) => {
        const btn = document.querySelector(`.market [data-tab="${tab}"]`);
        if (!(btn instanceof HTMLElement)) throw new Error(`no tab ${tab}`);
        const t0 = performance.now();
        btn.click();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - t0))));
      }),
    id,
  );

const times = Object.fromEntries(TABS.map((t) => [t, []]));
for (let r = 0; r < ROUNDS; r++) {
  for (const t of TABS) {
    await tapTab('tools');
    await page.waitForTimeout(700);
    times[t].push(await tapTab(t));
    await page.waitForTimeout(700);
  }
}
const sorted = (xs) => xs.slice().sort((a, b) => a - b);
const median = (xs) => sorted(xs)[Math.floor(xs.length / 2)];
console.log(`Market tab → 2nd rAF at ${RATE}× CPU throttle (390×844), ms over ${ROUNDS} rounds`);
console.log('tab       first  median  min   all');
for (const t of TABS) {
  const xs = times[t];
  console.log(`${t.padEnd(9)} ${String(xs[0]).padStart(5)}  ${String(median(xs)).padStart(6)}  ${String(sorted(xs)[0]).padStart(4)}  ${xs.join(' ')}`);
}
await browser.close();
