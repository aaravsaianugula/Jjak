#!/usr/bin/env node
/**
 * The eight Play Store screenshots, from the dev server:
 *   npx vite --port 5173   (in another terminal)   then
 *   SCALE=2.62 VIEW=412x732 npm run screens -- http://localhost:5173/ store/screenshots
 * Env: THEME=paper|ink, VIEW=390x844, SCALE=2 (store shots: SCALE=2.62 VIEW=412x732)
 *
 *   01-home            Home, mid-journey with the Flower Path strip
 *   02-gates           a Flower Road board with a mechanic (gates)
 *   03-map             the Flower Road map with a place open
 *   04-market-decks    the Market's Decks tab
 *   05-garden-night    the Garden at night
 *   06-flower-path     the Flower Path ranks
 *   07-result-stamp    a festival result sheet with its passport stamp
 *   08-fever           a ×5 combo: full bloom
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'screenshots';
const scale = Number(process.env.SCALE ?? 2);
const theme = process.env.THEME ?? 'paper';
const [vw, vh] = (process.env.VIEW ?? '390x844').split('x').map(Number);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
let page;
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const daysAgo = (k) => key(new Date(today.getFullYear(), today.getMonth(), today.getDate() - k));

/** Fresh context whose localStorage already holds `data`. */
async function open(data) {
  if (page) await page.context().close();
  const origin = new URL(base).origin;
  const value = JSON.stringify(data);
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: scale,
    hasTouch: true,
    colorScheme: theme === 'ink' ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin, localStorage: ['jjak.save.v1', 'CapacitorStorage.jjak.save.v1'].map((name) => ({ name, value })) }] },
  });
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base);
  await page.waitForTimeout(700);
  // The dev panel (dev builds only) and the web banner placeholder stay out of store shots.
  await page.addStyleTag({ content: '.devp, .dev-panel, .web-banner { display: none !important; } :root { --banner-h: 0px !important; }' });
}
const shot = async (name, settle = 700) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};
/** Tap one legal pair through the dev hook (no hint glow, no assists). */
async function pair() {
  const m = await page.evaluate(() => window.__game?.session().findMove() ?? null);
  if (!m) return false;
  for (const c of m) await page.locator(`.card:not(.is-gone)[data-cell="${c}"]`).dispatchEvent('pointerdown');
  return true;
}

const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i % 3 ? 3 : 2]));
const album = Array.from({ length: 34 }, (_, i) => (i * 7) % 48);
const results = {};
for (const back of [1, 2, 3, 5]) results[daysAgo(back)] = { ms: 98000, score: 4200, combo: 4, stars: 2 };
const allTips = ['variants', 'stones', 'gravity', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences', 'goal:combo', 'goal:clean', 'goal:bloom', 'goal:straight'];
const garden = ['stones', 'lantern', 'pond', 'koi', 'bridge', 'bamboo', 'plum', 'maple', 'persimmon', 'wisteria', 'irises', 'wall', 'onggi', 'pavilion', 'teatable', 'chime', 'lanterns', 'fireflies'].map((g) => `garden:${g}`);
const player = (over = {}) => ({
  v: 1, onboarded: true, level: 125, petals: 1840, hints: 9, shuffles: 4,
  stars: stars(124), album,
  daily: { streak: 4, best: 9, lastDate: daysAgo(1), results },
  settings: { sound: false, music: false, haptics: false, theme },
  stats: { pairs: 2412, clears: 141, bestCombo: 5, zenBoards: 6, cleanClears: 88, fastClears: 97, bestDailyMs: 83000 },
  seenTips: allTips,
  seals: ['first', 'combo3', 'combo5', 'spring', 'daily1', 'streak3', 'month', 'godori', 'tsukimi'],
  gift: { day: 3, lastClaim: key(today) },
  rush: { best: 8400, runs: 6, bestRound: 5 },
  meta: { xp: 14800, claimed: 31 },
  market: { owned: ['deck:classic', 'back:classic', ...garden], equip: {} },
  journey: { stamps: Object.fromEntries(['gyeongju', 'kamakura', 'seoraksan', 'shirakawago', 'yoshino', 'boseong', 'kyoto', 'pyeongchang', 'jeju', 'yakushima'].map((id) => [id, '2026-09-20'])) },
  ...over,
});

// 1. Home
await open(player());
await shot('01-home', 1600);

// 2. A Flower Road board with gates
await open(player({ level: 124, stars: stars(123) }));
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(2200);
await pair();
await shot('02-gates', 1300);

// 3. The map, with the current place open
await open(player());
await page.click('[data-go="map"]');
await shot('03-map', 1500);

// 4. Market: Decks
await open(player());
await page.click('[data-go="market"]');
await page.waitForTimeout(900);
await page.locator('[data-tab="decks"]').first().click();
await shot('04-market-decks', 1500);

// 5. Garden at night
await open(player());
await page.click('[data-go="garden"]');
await page.waitForTimeout(1200);
if ((await page.getAttribute('[data-time]', 'aria-pressed')) !== 'true') await page.click('[data-time]');
await page.waitForTimeout(3400); // let the "new pieces" note fade
await shot('05-garden-night', 400);

// 6. Flower Path
await open(player({ meta: { xp: 14800, claimed: 33 } }));
await page.click('[data-go="path"]');
await shot('06-flower-path', 1600);

// 7. A festival board's result with its passport stamp (Jeju, level 108)
await open(player({ level: 108, stars: stars(107), journey: { stamps: {} } }));
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(2200);
for (let k = 0; k < 60 && !(await page.$('.sheet .result')); k++) {
  if (!(await pair())) await page.waitForTimeout(300);
  await page.waitForTimeout(260);
}
await page.waitForSelector('.sheet .result', { timeout: 20000 });
await page.waitForTimeout(4600);
await page.evaluate(() => document.querySelector('.passport')?.scrollIntoView({ block: 'center' }));
await shot('07-result-stamp', 900);

// 8. Fever: five quick pairs in Rush
await open(player());
await page.click('[data-go="rush"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1600);
for (let k = 0; k < 5; k++) {
  await pair();
  await page.waitForTimeout(240);
}
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/08-fever.png` });
console.log('saved 08-fever');

await browser.close();
