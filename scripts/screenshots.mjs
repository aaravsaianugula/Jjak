#!/usr/bin/env node
/**
 * Drives the web build through every screen and saves phone-size screenshots.
 *   npm run dev   (in another terminal)   then   npm run screens [baseUrl] [outDir]
 * Env: THEME=paper|ink, VIEW=390x844, SCALE=2 (store shots: SCALE=2.6214 VIEW=412x732)
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

/** Fresh context whose localStorage already holds `data` (null = first launch). */
async function open(data) {
  const origin = new URL(base).origin;
  const origins = data
    ? [{ origin, localStorage: ['jjak.save.v1', 'CapacitorStorage.jjak.save.v1'].map((name) => ({ name, value: JSON.stringify(data) })) }]
    : [];
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: scale,
    hasTouch: true,
    colorScheme: theme === 'ink' ? 'dark' : 'light',
    storageState: { cookies: [], origins },
  });
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base);
  await page.waitForTimeout(400);
}
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};
/** Play `n` hinted pairs (or until the board/sheet changes). */
async function playPairs(n, gap = 450) {
  for (let k = 0; k < n; k++) {
    if (await page.$('.sheet')) return;
    await page.click('.tool[aria-label="Hint"]');
    await page.waitForTimeout(100);
    const cells = await page.$$eval('.card.is-hint', (els) => els.map((e) => e.getAttribute('data-cell')));
    if (cells.length < 2) return;
    await page.locator(`.card[data-cell="${cells[0]}"]`).dispatchEvent('pointerdown');
    await page.locator(`.card[data-cell="${cells[1]}"]`).dispatchEvent('pointerdown');
    await page.waitForTimeout(gap);
  }
}

const album = [0, 1, 2, 3, 4, 7, 8, 10, 11, 12, 15, 16, 19, 20, 22, 23, 24, 27, 28, 29, 30, 31, 32, 35, 36, 39, 40, 43, 44, 47];
const today = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const results = {};
for (const back of [1, 2, 3, 5]) results[key(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back))] = { ms: 98000, score: 4200, combo: 4, stars: 2 };
const base17 = {
  v: 1, onboarded: true, birthYear: null, level: 17, petals: 145, hints: 9, shuffles: 1,
  stars: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, 2 + (i % 2)])),
  album,
  daily: { streak: 3, best: 6, lastDate: key(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)), results },
  settings: { sound: false, haptics: false, theme },
  stats: { pairs: 412, clears: 21, bestCombo: 5, zenBoards: 2, cleanClears: 7, fastClears: 12, bestDailyMs: 83000 },
  ads: { clearsSinceInterstitial: 0, lastInterstitialAt: 0 },
  seenTips: ['variants', 'stones'],
  seals: ['first', 'combo3', 'combo5', 'spring', 'daily1', 'streak3', 'month', 'godori', 'tsukimi'],
  paper: 'plain',
  gift: { day: 3, lastClaim: key(today) },
  rush: { best: 8400, runs: 6, bestRound: 5 },
};

// 1. First launch
await open(null);
await page.waitForTimeout(2200); // the first-minute intro: the brush mid-demo
await shot('01-welcome');
await page.click('[data-first="skip"]');
await page.waitForTimeout(500);
await shot('02a-intro');
await page.waitForTimeout(900);
await shot('02-level1-tutorial');

// 2. Returning player
await open(base17);
await shot('03-home');
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await shot('04-game');
await playPairs(1, 700);
await page.click('[aria-label="Pause"]');
await shot('04b-pause');
await page.click('[data-p="resume"]');
await page.waitForTimeout(300);
await playPairs(2, 120);
await page.waitForTimeout(80);
await page.screenshot({ path: `${out}/05-path.png` });
console.log('saved 05-path');

// 3. Result sheet with a new card draw + seal
await open({ ...base17, level: 2, stars: {}, hints: 99, seals: [] });
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await playPairs(40, 380);
await page.waitForSelector('.sheet', { timeout: 6000 });
await page.waitForTimeout(3200); // let the blossoms bloom and the new card turn over
await shot('06-result');

// 4. Journey map, seals, album
await open(base17);
await page.click('[data-go="map"]');
await shot('07-map');
await open(base17);
await page.click('[data-go="seals"]');
await page.waitForTimeout(3600); // let the 'seal earned' toast clear
await shot('08-seals');
await open(base17);
await page.click('[data-go="album"]');
await shot('09-album');
await page.click('.month__cards button[data-id="31"]');
await shot('10-card-detail');

// 5. New mechanics (tips dismissed), with a board paper
await open({ ...base17, level: 29, seenTips: ['variants', 'stones', 'gravity', 'snow'], paper: '7', hints: 99 });
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await shot('11-falling-leaves');
await open({ ...base17, level: 38, seenTips: ['variants', 'stones', 'gravity'], hints: 99, paper: '2' });
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await shot('12-snow-tip');
await page.click('.sheet .btn');
await shot('13-snow');

// 6. Settings + paper picker, Daily
await open(base17);
await page.click('[data-go="settings"]');
await shot('14-settings');
await page.click('[data-act="paper"]');
await shot('15-papers');
await open(base17);
await page.click('[data-go="daily"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await shot('16-daily');

// 7. Daily gift, Rush, Fever
await open({ ...base17, gift: { day: 3, lastClaim: null } });
await page.waitForTimeout(900);
await shot('17-gift');
await open({ ...base17, hints: 999 });
await page.click('[data-go="rush"]');
await page.waitForSelector('.card');
await page.waitForTimeout(1400);
await playPairs(6, 260); // quick pairs build a ×5 combo → Fever
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/18-fever.png` });
console.log('saved 18-fever');
await playPairs(30, 260); // finish the first board → next board
await page.waitForTimeout(600);
await shot('19-rush');
if (process.env.RUSH_END) {
  await page.waitForSelector('.rush-score', { timeout: 200000 });
  await shot('20-rush-end');
}

await browser.close();
