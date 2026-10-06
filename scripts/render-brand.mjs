#!/usr/bin/env node
/** Render icon / splash source PNGs into resources/ (needs `npm run dev` running). */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173/';
const jobs = [
  { out: 'resources/icon-only.png', size: 1024, seal: 680, bg: 'paper' },
  { out: 'resources/icon-foreground.png', size: 1024, seal: 520 },
  { out: 'resources/icon-background.png', size: 1024, seal: 0, bg: 'paper' },
  { out: 'resources/splash.png', size: 2732, seal: 420, bg: 'paper', word: 'Jjak' },
  { out: 'resources/splash-dark.png', size: 2732, seal: 420, bg: 'ink', word: 'Jjak' },
  { out: 'store/icon-512.png', size: 512, seal: 340, bg: 'paper' },
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
  const q = new URLSearchParams({ size: j.size, seal: j.seal, bg: j.bg ?? '', word: j.word ?? '' });
  await page.goto(`${base}dev/brand.html?${q}`);
  await page.waitForSelector('body[data-ready]');
  if (!j.seal) await page.evaluate(() => (document.querySelector('.seal').style.display = 'none'));
  await page.waitForTimeout(200);
  await page.locator('#s').screenshot({ path: j.out, omitBackground: true });
  console.log('rendered', j.out);
  await page.close();
}
await browser.close();
