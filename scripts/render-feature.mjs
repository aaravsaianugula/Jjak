#!/usr/bin/env node
/** Render store/feature-graphic.png (1024×500) — needs `npm run dev` running. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.goto(`${base}dev/feature.html`);
await page.waitForSelector('body[data-ready]');
await page.waitForTimeout(300);
await page.locator('#f').screenshot({ path: 'store/feature-graphic.png' });
await browser.close();
console.log('rendered store/feature-graphic.png');
