#!/usr/bin/env node
/**
 * Drives the web build through every screen and saves phone-size screenshots.
 *   npm run dev   (in another terminal)   then   npm run screens [baseUrl] [outDir]
 * Also used to produce Play Store screenshots (1080×2340 at scale 2.77).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'screenshots';
const scale = Number(process.env.SCALE ?? 2);
const theme = process.env.THEME ?? 'paper';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, hasTouch: true, colorScheme: theme === 'ink' ? 'dark' : 'light' });
let page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log('console:', m.text()));
/** Boot the app in a fresh context whose localStorage already holds `data`. */
const loadWith = async (data) => {
  const origin = new URL(base).origin;
  const t = JSON.stringify(data);
  const fresh = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, hasTouch: true, colorScheme: theme === 'ink' ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'jjak.save.v1', value: t }, { name: 'CapacitorStorage.jjak.save.v1', value: t }] }] },
  });
  page = await fresh.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base);
};
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

// 1. First launch
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await shot('01-welcome');
await page.click('[data-next]');
await shot('02-age');
await page.selectOption('select.year', '2008');
await page.click('[data-done]');
await shot('03-level1-tutorial');

// 2. A returning player mid-way through Summer
const saveData = {
  v: 1, birthYear: 2006, level: 17, petals: 145, hints: 2, shuffles: 1,
  stars: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, 2 + (i % 2)])),
  album: [0, 3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 23, 24, 28, 29, 31, 32, 35, 36, 40, 43, 44, 47],
  daily: { streak: 4, best: 6, lastDate: null, results: {} },
  settings: { sound: false, haptics: false, theme },
  stats: { pairs: 300, clears: 16, bestCombo: 5, zenBoards: 2 },
  ads: { clearsSinceInterstitial: 0, lastInterstitialAt: 0 },
  seenTips: ['variants', 'stones'],
};
await loadWith(saveData);
await shot('04-home');

await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
await shot('05-game');

// make a couple of moves using the hint button logic exposed through the DOM
for (let k = 0; k < 3; k++) {
  await page.click('.tool[aria-label="Hint"]');
  await page.waitForTimeout(150);
  const cells = await page.$$eval('.card.is-hint', (els) => els.map((e) => e.getAttribute('data-cell')));
  if (cells.length < 2) break;
  await page.locator(`.card[data-cell="${cells[0]}"]`).dispatchEvent('pointerdown');
  if (k === 2) {
    await page.waitForTimeout(100);
    await shot('06-selected');
  }
  await page.locator(`.card[data-cell="${cells[1]}"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(120);
  if (k === 1) await page.screenshot({ path: `${out}/07-path.png` });
  await page.waitForTimeout(500);
}

// 3. Solve a whole small board to reach the result sheet
await loadWith({ ...saveData, level: 2, hints: 99 });
await page.click('[data-go="journey"]');
await page.waitForSelector('.card');
for (let k = 0; k < 40; k++) {
  if (await page.$('.sheet')) break;
  await page.click('.tool[aria-label="Hint"]');
  await page.waitForTimeout(80);
  const cells = await page.$$eval('.card.is-hint', (els) => els.map((e) => e.getAttribute('data-cell')));
  if (cells.length < 2) break;
  await page.locator(`.card[data-cell="${cells[0]}"]`).dispatchEvent('pointerdown');
  await page.locator(`.card[data-cell="${cells[1]}"]`).dispatchEvent('pointerdown');
  await page.waitForTimeout(420);
}
await page.waitForSelector('.sheet', { timeout: 5000 });
await page.waitForTimeout(900);
await shot('08-result');

// 4. Album + detail
await loadWith(saveData);
await page.click('[data-go="album"]');
await shot('09-album');
await page.click('.month__cards button[data-id="28"]');
await shot('10-card-detail');

// 5. Settings, Daily
await loadWith(saveData);
await page.click('[data-go="settings"]');
await shot('11-settings');
await loadWith(saveData);
await page.click('[data-go="daily"]');
await page.waitForSelector('.card');
await shot('12-daily');

await browser.close();
