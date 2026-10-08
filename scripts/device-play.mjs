// Drive the debug app on a USB phone through the WebView inspector (chrome://inspect's socket), for device QA.
// Debug builds only: release builds don't expose the WebView to the inspector.
//
//   node scripts/device-play.mjs play [--seconds 60]        play boards with the hint button (pair it with
//                                                         PLAY_SECONDS=60 scripts/device-qa.sh for frame pacing)
//   node scripts/device-play.mjs seed --level 601         TEST INSTALLS ONLY: overwrites the save (onboarded, stars
//                                                         for every level below, plenty of hints), then force-stops
//   node scripts/device-play.mjs endless [--boards 3]     from a seeded level past 600: cold start, tap Continue at
//                    [--fresh]                            once, time each board's arrival, play it, go to the next
//                                                         (--fresh drops the stored board first, so it's made live)
//   node scripts/device-play.mjs eval '<js expression>'   run an expression in the app and print the result
//
// adb comes from PATH, else $ANDROID_HOME/platform-tools. The inspector is forwarded to localhost:9333.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PKG = 'com.jjak.puzzle';
const PORT = 9333;
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const sdkAdb = sdk && join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const ADB = sdkAdb && existsSync(sdkAdb) ? sdkAdb : 'adb';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).replace(/\r/g, '').trim();

/** Forward the app's inspector socket and attach to its page. */
async function connect() {
  for (let t = 0; t < 60; t++) {
    const pid = adb('shell', 'pidof', PKG).split(/\s+/)[0];
    if (pid && adb('shell', 'cat', '/proc/net/unix').includes(`webview_devtools_remote_${pid}`)) {
      adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
      for (let u = 0; u < 50; u++) {
        // The ads SDK opens WebViews of its own; the app is the page served from https://localhost/.
        const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('https://localhost/'));
        if (page) {
          // Playwright emulates a light colour scheme on attach; let the page follow the phone instead.
          await page.emulateMedia({ colorScheme: null });
          return { browser, page, cdp: await page.context().newCDPSession(page) };
        }
        await sleep(100);
      }
      throw new Error('The app has no inspectable page (is this a debug build?)');
    }
    await sleep(250);
  }
  throw new Error(`${PKG} is not running with an inspectable WebView (debug build installed and open?)`);
}

function coldStart() {
  adb('shell', 'am', 'force-stop', PKG);
  const out = adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  return Number(/TotalTime: (\d+)/.exec(out)?.[1] ?? NaN);
}

/** A real touch (not a mouse click) at the element's centre. */
async function touch(cdp, page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return false;
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return true;
}

/** Sheets that stand between the player and the board: a new idea's intro, the reminder offer. */
const BLOCKERS = ['[data-intro-go]', '.remind__no'];
async function dismiss(cdp, page) {
  for (const sel of BLOCKERS) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      await touch(cdp, page, sel);
      await sleep(600);
      return true;
    }
  }
  return false;
}

/** Play the open board with hints until it clears or time runs out. Returns 'clear' | 'time' | 'stuck'. */
async function playBoard(cdp, page, until) {
  let idle = 0;
  while (Date.now() < until) {
    if (await page.locator('.result__actions .btn').first().isVisible().catch(() => false)) return 'clear';
    if (await dismiss(cdp, page)) continue;
    if (!(await page.locator('.board .card').count())) {
      if (++idle > 40) return 'stuck';
      await sleep(250);
      continue;
    }
    if ((await page.locator('.card.is-hint').count()) < 2) await touch(cdp, page, '.tool--hint');
    await sleep(120);
    const pair = await page.locator('.card.is-hint').evaluateAll((els) => els.map((e) => e.dataset.cell));
    if (pair.length < 2) {
      if (++idle > 40) return 'stuck';
      await sleep(250);
      continue;
    }
    idle = 0;
    await touch(cdp, page, `.card[data-cell="${pair[0]}"]`);
    await sleep(140);
    await touch(cdp, page, `.card[data-cell="${pair[1]}"]`);
    await sleep(420);
  }
  return 'time';
}

/** From Home or a cleared board, open the next Journey board. */
async function next(cdp, page) {
  for (let t = 0; t < 60; t++) {
    for (const sel of ['.btn--next', '[data-go="journey"]']) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) {
        await page.evaluate(() => window.__qa?.mark()); // time from this tap, not from sheets dismissed before it
        return touch(cdp, page, sel);
      }
    }
    if (!(await dismiss(cdp, page))) await sleep(250);
  }
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.classList.contains('card')).map((b) => `${b.className}: ${b.innerText.trim()}`),
  );
  throw new Error(`No way to the next board. Visible buttons:\n  ${shown.join('\n  ')}`);
}

/**
 * In-page watch, measured on the phone's own clock (CDP round trips over adb would add hundreds of ms):
 * tap → the first frame painted with the board's cards, the longest main-thread stall (rAF gap) and long tasks.
 */
const WATCH = `(() => {
  if (window.__qa) return;
  const qa = (window.__qa = { gap: 0, long: 0, longMax: 0, last: performance.now(), tap: 0, cards: 0 });
  const tick = (t) => { qa.gap = Math.max(qa.gap, t - qa.last); qa.last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { qa.long += e.duration; qa.longMax = Math.max(qa.longMax, e.duration); })).observe({ type: 'longtask' }); } catch {}
  addEventListener('pointerdown', () => { if (!qa.tap) qa.tap = performance.now(); }, true);
  new MutationObserver(() => {
    if (!qa.tap || qa.cards || qa.seen || !document.querySelector('.board .card')) return;
    qa.seen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { qa.cards = performance.now() - qa.tap; }));
  }).observe(document.body, { childList: true, subtree: true });
  qa.mark = () => Object.assign(qa, { gap: 0, long: 0, longMax: 0, last: performance.now(), tap: 0, cards: 0, seen: false });
})()`;

const cmd = process.argv[2];
if (cmd === 'seed') {
  const level = Number(arg('level', 601));
  const { browser, page } = await connect();
  await page.evaluate(async (level) => {
    const P = window.Capacitor.Plugins.Preferences;
    const s = JSON.parse((await P.get({ key: 'jjak.save.v1' })).value ?? '{"v":1}');
    s.level = level;
    s.onboarded = true;
    s.journey = { ...s.journey, revealed: level > 600 };
    s.stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [i + 1, 3]));
    s.hints = 9999;
    s.shuffles = 999;
    await P.set({ key: 'jjak.save.v1', value: JSON.stringify(s) });
  }, level);
  await browser.close();
  adb('shell', 'am', 'force-stop', PKG); // not a reload: the page would persist its in-memory save over the edit
  console.log(`Seeded level ${level}; the app is stopped.`);
} else if (cmd === 'play') {
  const until = Date.now() + 1000 * Number(arg('seconds', 60));
  const { browser, page, cdp } = await connect();
  let boards = 0;
  while (Date.now() < until) {
    if (!(await page.locator('.screen.game').count())) await next(cdp, page);
    await page.waitForSelector('.screen.game', { timeout: 20000 });
    const r = await playBoard(cdp, page, until);
    if (r === 'clear') boards++;
    if (r === 'stuck') throw new Error('Stuck: no hint pair and no result screen');
    if (r === 'clear') {
      await sleep(1500);
      await next(cdp, page);
      await page.waitForSelector('.result__actions', { state: 'detached', timeout: 10000 });
    }
  }
  console.log(`Played ${boards} board(s) to a clear.`);
  await browser.close();
} else if (cmd === 'endless') {
  const boards = Number(arg('boards', 3));
  if (process.argv.includes('--fresh')) {
    const { browser, page } = await connect();
    await page.evaluate(async () => {
      const P = window.Capacitor.Plugins.Preferences;
      const s = JSON.parse((await P.get({ key: 'jjak.save.v1' })).value);
      delete s.journey.endless?.levels[s.level];
      await P.set({ key: 'jjak.save.v1', value: JSON.stringify(s) });
    });
    await browser.close();
  }
  const cold = coldStart();
  const { browser, page, cdp } = await connect();
  await page.evaluate(WATCH);
  const level = await page.evaluate(async () => JSON.parse((await window.Capacitor.Plugins.Preferences.get({ key: 'jjak.save.v1' })).value).level);
  if (level <= 600) throw new Error(`The save is at level ${level}: run "seed --level 601" first`);
  console.log(`cold start ${cold} ms · save at level ${level}`);
  for (let b = 0; b < boards; b++) {
    await page.evaluate(() => window.__qa.mark());
    await next(cdp, page);
    await page.waitForFunction(() => window.__qa.cards > 0, null, { timeout: 30000 });
    await sleep(600); // stalls right after the board appears count too
    const w = await page.evaluate(() => ({ ms: Math.round(window.__qa.cards), gap: Math.round(window.__qa.gap), long: Math.round(window.__qa.long), longMax: Math.round(window.__qa.longMax) }));
    const title = await page.evaluate(() => document.querySelector('.topbar, header')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60));
    const made = await page.evaluate(() => performance.getEntriesByType('measure').filter((m) => m.name.startsWith('endless ')).map((m) => `${m.name.slice(8)} ${Math.round(m.duration)} ms`));
    console.log(`  generated so far: ${made.join(', ') || 'none this session'}`);
    console.log(`board ${b + 1}: tap → cards painted ${w.ms} ms · longest frame gap ${w.gap} ms · long tasks ${w.long} ms (max ${w.longMax}) · ${title}`);
    const r = await playBoard(cdp, page, Date.now() + 180000);
    console.log(`  played: ${r}`);
    if (r !== 'clear') break;
    await sleep(2500); // the clear handler prepares the next endless board in the background
  }
  await browser.close();
} else if (cmd === 'eval') {
  const { browser, page } = await connect();
  console.log(JSON.stringify(await page.evaluate(process.argv[3]), null, 1));
  await browser.close();
} else {
  console.log('usage: node scripts/device-play.mjs play|seed|endless|eval ... (see the header)');
  process.exit(1);
}
