// Theme parity check (dev server on :5173): every screen must render identically whether Paper/Ink
// comes from the in-app setting or from the phone's light/dark setting (Auto).
//   npx vite --port 5173 &   node scripts/theme-parity.mjs
// Differential theme test: explicit Ink vs Auto + OS dark (and Paper vs Auto + OS light).
// Every element's computed colours must match; a difference is a rule that exists for one path only.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const allTips = ['variants', 'stones', 'gravity', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences', 'goal:combo', 'goal:clean', 'goal:bloom', 'goal:straight'];
const garden = ['stones', 'lantern', 'pond', 'koi', 'bridge', 'bamboo', 'plum', 'maple', 'wall', 'pavilion', 'lanterns'].map((g) => `garden:${g}`);
const base = { v: 1, onboarded: true, level: 130, stars: stars(129), petals: 900, gift: { day: 1, lastClaim: today }, seenTips: allTips, album: [0, 4, 8, 12, 48], meta: { xp: 9000, claimed: 10 }, market: { owned: garden } };

const flows = {
  home: async () => {},
  map: async (p) => p.click('[data-go="map"]'),
  market: async (p) => p.click('[data-go="market"]'),
  marketDecks: async (p) => { await p.click('[data-go="market"]'); await p.waitForTimeout(600); await p.locator('[data-tab="decks"]').first().click(); },
  garden: async (p) => p.click('[data-go="garden"]'),
  path: async (p) => p.click('[data-go="path"]'),
  album: async (p) => p.click('[data-go="album"]'),
  seals: async (p) => p.click('[data-go="seals"]'),
  settings: async (p) => p.click('[data-go="settings"]'),
  howto: async (p) => { await p.click('[data-go="settings"]'); await p.waitForTimeout(500); await p.click('[data-act="how"]'); },
  board: async (p) => p.click('[data-go="journey"]'),
  pause: async (p) => { await p.click('[data-go="journey"]'); await p.waitForTimeout(2200); await p.click('[aria-label="Pause"]'); },
  intro: async (p) => { await p.click('[data-go="journey"]'); await p.waitForTimeout(2200); await p.click('[aria-label="Pause"]'); await p.waitForTimeout(400); await p.click('[data-p="intro"]'); },
  daily: async (p) => p.click('[data-go="daily"]'),
  gift: async () => {},
};

async function signature(theme, scheme, flow) {
  const save = { ...base, settings: { sound: false, music: false, haptics: false, theme } };
  if (flow === 'gift') save.gift = { day: 2, lastClaim: null };
  const v = JSON.stringify(save);
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, colorScheme: scheme, reducedMotion: 'reduce', storageState: { cookies: [], origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'jjak.save.v1', value: v }, { name: 'CapacitorStorage.jjak.save.v1', value: v }] }] } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(900);
  await flows[flow](p);
  await p.waitForTimeout(2600);
  const sig = await p.evaluate(() => {
    const out = [];
    const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'fill', 'stroke', 'boxShadow', 'filter', 'opacity'];
    let k = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.devp')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const tag = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ').slice(0, 2).join('.')}#${k++}`;
      out.push([tag, props.map((q) => cs[q]).join('|')]);
    }
    return out;
  });
  await ctx.close();
  return sig;
}

let bad = 0;
for (const flow of Object.keys(flows)) {
  for (const [explicit, scheme] of [['ink', 'dark'], ['paper', 'light']]) {
    const a = await signature(explicit, scheme === 'dark' ? 'light' : 'dark', flow); // explicit theme against the opposite OS setting
    const c = await signature('auto', scheme, flow);
    const diffs = [];
    const n = Math.min(a.length, c.length);
    for (let i = 0; i < n; i++) if (a[i][1] !== c[i][1] && a[i][0].split('#')[0] === c[i][0].split('#')[0]) diffs.push(`${a[i][0]}: ${a[i][1]}  ≠  ${c[i][1]}`);
    if (a.length !== c.length) diffs.unshift(`element count ${a.length} vs ${c.length}`);
    if (diffs.length) bad++;
    console.log(`${flow} ${explicit}: ${diffs.length ? diffs.length + ' differences' : 'identical'}`);
    for (const x of diffs.slice(0, 6)) console.log('   ', x.slice(0, 260));
  }
}
console.log(bad ? `\n${bad} flow/theme pairs differ` : '\nall identical');
await b.close();
