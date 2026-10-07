#!/usr/bin/env node
/**
 * Render icon / splash source PNGs (needs `npm run dev` running), then run `npm run assets`
 * to regenerate the Android mipmaps and splash drawables from resources/.
 *   node scripts/render-brand.mjs [baseUrl]
 * Adaptive icon: capacitor-assets wraps both layers in a 16.7% inset, so each PNG spans the
 * visible 72 dp of the 108 dp layer and Android's 66 dp safe circle is ~92% of the PNG
 * (≈940 px of 1024). The seal (side 620, corner radius ≈14%) reaches ≈810 px corner to corner
 * after rotation, comfortably inside it. The background layer is paper with fibres.
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173/';
const jobs = [
  { out: 'resources/icon-only.png', size: 1024, seal: 660, bg: 'paper' },
  { out: 'resources/icon-foreground.png', size: 1024, seal: 620 },
  { out: 'resources/icon-background.png', size: 1024, seal: 0, bg: 'paper' },
  { out: 'resources/splash.png', size: 2732, seal: 440, bg: 'paper', word: 'Jjak' },
  { out: 'resources/splash-dark.png', size: 2732, seal: 440, bg: 'ink', word: 'Jjak' },
  { out: 'store/icon-512.png', size: 512, seal: 330, bg: 'paper' },
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
  const q = new URLSearchParams({ size: j.size, seal: j.seal, bg: j.bg ?? '', word: j.word ?? '' });
  await page.goto(`${base}dev/brand.html?${q}`);
  await page.waitForSelector('body[data-ready]');
  await page.waitForTimeout(200);
  await page.locator('#s').screenshot({ path: j.out, omitBackground: !j.bg });
  console.log('rendered', j.out);
  await page.close();
}
await browser.close();
