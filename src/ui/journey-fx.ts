/**
 * Journey visuals for the game screen: knots (매듭) tied over cards, the wind's
 * breeze and vane, the lucky-pair celebration, the passport-stamp moment on the
 * result sheet. (First-time intros live in intros.ts, played by the demo player.)
 * The game screen calls these; they own no game state.
 */
import { installStampDefs, stampSvg, stampTilt } from '../art/stamp';
import { ROUTE, SEASON_NAMES } from '../data/route';
import { type Wind } from '../engine/moves';
import { LUCKY_PETALS } from '../engine/session';
import { sfx } from '../services/audio';
import { haptic } from '../services/haptics';
import { save } from '../services/storage';
import { esc, frag, h } from './dom';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const retrigger = (node: Element | null | undefined, cls: string) => {
  if (!node) return;
  node.classList.remove(cls);
  void (node as HTMLElement).offsetWidth;
  node.classList.add(cls);
};

// ── Knots ─────────────────────────────────────────────────────────────
/**
 * A doubled red silk cord around the card, tied at the centre with a
 * chrysanthemum knot (국화매듭): four looped petals around a woven square, a
 * small hanging loop, then a gold-capped tassel (술) of fine silk. The cord's
 * twist is drawn as a light and a dark thread winding along it (continuous
 * lines, no dashes). Drawn in card units (100 × 140); the knot is centred on
 * (50, 81), the pivot of the tug and untie animations.
 */
const KN = (v: number) => String(Math.round(v * 10) / 10);
/** Centre line of one cord across the card (a gentle sag either side of the knot). */
const cordY = (x: number, y: number) => y + Math.sin(((x + 4) / 108) * Math.PI * 2) * 1.4;
function cordPath(y: number, wave = 0, phase = 0): string {
  let d = '';
  for (let x = -4; x <= 104; x += wave ? 2 : 6) {
    const yy = cordY(x, y) + Math.sin(x * 0.9 + phase) * wave;
    d += `${x === -4 ? 'M' : 'L'}${x} ${KN(yy)}`;
  }
  return d;
}
const CORD_RED = '#b8283a';
const CORD_DARK = '#651019';
const CORD_LIGHT = '#f08e93';
const KNOT_CORDS = [77.5, 84.5]
  .map(
    (y) =>
      `<path d="${cordPath(y + 0.9)}" stroke="${CORD_DARK}" stroke-width="5.6" fill="none" stroke-linecap="round" opacity=".45"/>` +
      `<path d="${cordPath(y)}" stroke="${CORD_RED}" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
      `<path d="${cordPath(y + 0.3, 1.25, 1.6)}" stroke="${CORD_DARK}" stroke-width=".7" fill="none" opacity=".55"/>` +
      `<path d="${cordPath(y - 0.4, 1.1)}" stroke="${CORD_LIGHT}" stroke-width=".75" fill="none" opacity=".85"/>`,
  )
  .join('');
/** One looped petal of the knot: a cord running out from the centre and back. */
function petal(rot: number): string {
  const d = 'M0 -3.6C-6.4 -6 -9.6 -15.2 -3.4 -17.2C.4 -18.4 4.6 -15.4 3.6 -10.4C3 -7.4 1.4 -5.2 0 -3.6';
  return (
    `<g transform="rotate(${rot})">` +
    `<path d="${d}" stroke="${CORD_DARK}" stroke-width="4.4" fill="none" stroke-linecap="round"/>` +
    `<path d="${d}" stroke="${CORD_RED}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M-1.2 -5.4C-5.8 -8 -7.4 -14.4 -3.2 -15.6" stroke="${CORD_LIGHT}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".9"/>` +
    `</g>`
  );
}
// The woven square at the heart of the knot: cords crossing over and under.
const WEAVE =
  `<rect x="-6.2" y="-6.2" width="12.4" height="12.4" rx="2.6" transform="rotate(45)" fill="${CORD_RED}" stroke="${CORD_DARK}" stroke-width="1.1"/>` +
  `<path d="M-5.2 -1.6L-1.6 -5.2M-3.4 3.4L3.4 -3.4M1.6 5.2L5.2 1.6" stroke="${CORD_DARK}" stroke-width=".8" opacity=".7"/>` +
  `<path d="M-5.2 1.6L-1.6 5.2M-3.4 -3.4L3.4 3.4M1.6 -5.2L5.2 -1.6" stroke="${CORD_LIGHT}" stroke-width=".7" opacity=".8"/>`;
// Tassel: a fine fan of silk threads under a gold cap, flaring a little and
// shading darker at the sides.
const TASSEL = (() => {
  let threads = '';
  for (let k = 0; k <= 10; k++) {
    const t = k / 10 - 0.5;
    threads += `M${KN(50 + t * 6.6)} 108.5Q${KN(50 + t * 8.4)} 118 ${KN(50 + t * 10.4)} ${KN(130 - Math.abs(t) * 3)}`;
  }
  return (
    // hanging cord from the knot to the cap
    `<path d="M50 89.5V101" stroke="${CORD_DARK}" stroke-width="3.2" stroke-linecap="round"/><path d="M50 89.5V101" stroke="${CORD_RED}" stroke-width="2.1" stroke-linecap="round"/>` +
    // body of the tassel
    `<path d="M46.4 107C44.6 116 43.6 123 44.2 130.4Q50 132.4 55.8 130.4C56.4 123 55.4 116 53.6 107Z" fill="url(#knot-silk)"/>` +
    `<path d="${threads}" stroke="${CORD_LIGHT}" stroke-width=".35" fill="none" opacity=".75"/>` +
    // gold cap with a lit band
    `<path d="M45.6 101.2Q50 99.2 54.4 101.2L54.8 108.6Q50 110.2 45.2 108.6Z" fill="#c8963e" stroke="#7a5418" stroke-width=".7"/>` +
    `<path d="M46.4 103.2Q50 101.8 53.6 103.2" stroke="#f4d585" stroke-width=".9" fill="none"/><path d="M45.8 106.4Q50 107.6 54.2 106.4" stroke="#8a6020" stroke-width=".6" fill="none"/>`
  );
})();
export const KNOT_SVG =
  `<svg class="knot__art" viewBox="0 0 100 140" aria-hidden="true">` +
  `<defs><linearGradient id="knot-silk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${CORD_DARK}"/><stop offset=".35" stop-color="${CORD_RED}"/><stop offset=".6" stop-color="#cf4553"/><stop offset="1" stop-color="${CORD_DARK}"/></linearGradient></defs>` +
  `<g class="knot__cord">${KNOT_CORDS}</g>` +
  `<g class="knot__bow">${TASSEL}<g transform="translate(50 81)">` +
  // the little hanging loop on top
  `<path d="M-2.2 -8.4C-3.6 -14 3.6 -14 2.2 -8.4" stroke="${CORD_DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  `<path d="M-2.2 -8.4C-3.6 -14 3.6 -14 2.2 -8.4" stroke="${CORD_RED}" stroke-width="1.9" fill="none" stroke-linecap="round"/>` +
  [45, 135, 225, 315].map(petal).join('') +
  WEAVE +
  `</g></g></svg>`;

/** Tie or untie (instantly) the cord on a card element. */
export function setKnot(card: HTMLElement | undefined, on: boolean): void {
  if (!card) return;
  card.classList.toggle('is-knot', on);
  const had = card.querySelector('.knot');
  if (on && !had) card.append(h('span', { class: 'knot', 'aria-hidden': 'true', html: KNOT_SVG }));
  if (!on && had) had.remove();
  const label = card.getAttribute('aria-label') ?? '';
  const base = label.replace(/, tied with a cord$/, '');
  card.setAttribute('aria-label', on ? `${base}, tied with a cord` : base);
}

/** The cord slips off and the bow drops away. */
export function untieKnot(card: HTMLElement | undefined): void {
  if (!card) return;
  const k = card.querySelector('.knot');
  card.classList.remove('is-knot');
  card.setAttribute('aria-label', (card.getAttribute('aria-label') ?? '').replace(/, tied with a cord$/, ''));
  if (!k) return;
  if (reducedMotion()) {
    k.remove();
    return;
  }
  k.classList.add('is-untie');
  setTimeout(() => k.remove(), 620);
}

/** A tied card was tapped: the bow gives a little tug. */
export function tugKnot(card: HTMLElement | undefined): void {
  retrigger(card?.querySelector('.knot'), 'is-tug');
}

// ── Wind ──────────────────────────────────────────────────────────────
const ARROWS: Record<Wind, string> = { down: '↓', left: '←', right: '→', up: '↑' };
const WIND_WORD: Record<Wind, string> = { down: 'down', left: 'to the left', right: 'to the right', up: 'upward' };

/** The small vane in the rhythm row that says which way the wind blows. */
export function windVane(dir: Wind): HTMLElement {
  return h(
    'div',
    { class: `wind-vane wind-vane--${dir}`, role: 'img', 'aria-label': `Wind blowing ${WIND_WORD[dir]}` },
    h('b', { class: 'ja' }, '風'),
    h('span', {}, ARROWS[dir]),
  );
}

/** A few faint streaks blow across the stage in the wind's direction. */
export function breeze(stage: HTMLElement, dir: Wind, strong = false): void {
  if (reducedMotion() || dir === 'down') return;
  const w = stage.clientWidth;
  const ht = stage.clientHeight;
  if (!w || !ht) return;
  const layer = stage.querySelector('.breeze') ?? stage.appendChild(h('div', { class: 'breeze', 'aria-hidden': 'true' }));
  const n = strong ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const s = h('i', { class: dir === 'up' ? 'is-v' : '' });
    const len = 50 + Math.random() * 90;
    if (dir === 'up') {
      const x = (0.08 + 0.84 * Math.random()) * w;
      s.style.left = `${x}px`;
      s.style.top = '0';
      s.style.height = `${len}px`;
      s.style.setProperty('--x0', '0px');
      s.style.setProperty('--x1', `${(Math.random() - 0.5) * 30}px`);
      s.style.setProperty('--y0', `${ht + 20}px`);
      s.style.setProperty('--y1', `${-len - 20}px`);
    } else {
      const y = (0.06 + 0.88 * Math.random()) * ht;
      const from = dir === 'right' ? -len - 20 : w + 20;
      const to = dir === 'right' ? w + 20 : -len - 20;
      s.style.top = `${y}px`;
      s.style.left = '0';
      s.style.width = `${len}px`;
      s.style.setProperty('--x0', `${from}px`);
      s.style.setProperty('--x1', `${to}px`);
      s.style.setProperty('--y0', '0px');
      s.style.setProperty('--y1', `${(Math.random() - 0.5) * 24}px`);
    }
    s.style.animationDelay = `${k * 70 + Math.random() * 120}ms`;
    s.style.animationDuration = `${700 + Math.random() * 350}ms`;
    layer.append(s);
    setTimeout(() => s.remove(), 1500);
  }
}

// ── Lucky pair ────────────────────────────────────────────────────────
/** "Lucky! +10 petals" rises from the pair, and a soft gold light washes the stage. */
export function luckyMoment(stage: HTMLElement, x: number, y: number): void {
  sfx.reveal();
  haptic.success();
  const f = h('div', { class: 'lucky-float', 'aria-hidden': 'true' }, h('b', {}, 'Lucky!'), h('span', {}, `+${LUCKY_PETALS} petals`));
  f.style.left = `${x}px`;
  f.style.top = `${y}px`;
  stage.append(f);
  setTimeout(() => f.remove(), 1700);
  if (reducedMotion()) return;
  const flash = h('i', { class: 'lucky-flash', 'aria-hidden': 'true' });
  flash.style.setProperty('--lx', `${x}px`);
  flash.style.setProperty('--ly', `${y}px`);
  const air = stage.querySelector('.lucky-air') ?? stage.appendChild(h('div', { class: 'lucky-air', 'aria-hidden': 'true' }));
  air.append(flash);
  setTimeout(() => flash.remove(), 1300);
  for (let k = 0; k < 10; k++) {
    const g = h('i', { class: 'lucky-glint', 'aria-hidden': 'true' });
    const a = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
    const d = 40 + Math.random() * 46;
    g.style.left = `${x}px`;
    g.style.top = `${y}px`;
    g.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    g.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    g.style.animationDelay = `${Math.random() * 120}ms`;
    air.append(g);
    setTimeout(() => g.remove(), 1100);
  }
}

// ── Passport stamp (result sheet) ─────────────────────────────────────
/**
 * The stamp thunks onto a passport page: it drops in large, presses down, and
 * a ring of ink spreads into the paper. `at` = ms after the sheet opens.
 */
export function stampMoment(id: string, date: string, at: number, year = 0): HTMLElement {
  installStampDefs();
  const index = Math.max(0, ROUTE.findIndex((c) => c.id === id));
  const c = ROUTE[index];
  const season = SEASON_NAMES[c.season];
  const panel = frag(`<div class="passport">
    <div class="passport__page">
      <span class="passport__bleed" aria-hidden="true"></span>
      <span class="passport__stamp" style="--tilt:${stampTilt(index)}deg">${stampSvg(c, index, date, { label: `Passport stamp: ${c.en}` })}</span>
    </div>
    <div class="passport__text">
      <div class="reward__label">${year > 0 ? `Wanderer stamp · Year ${year + 1}` : `Passport stamp · ${Object.keys(save.journey.stamps).length}/${ROUTE.length}`}</div>
      <div class="passport__name">${esc(c.en)}</div>
      <div class="passport__native"><span lang="ko">${c.ko}</span> · <span class="ja">${c.ja}</span></div>
      <div class="muted passport__season"><span class="ja">${season.ja}</span> ${esc(season.en)} · ${esc(c.postcard)}</div>
    </div>
  </div>`);
  panel.style.setProperty('--stamp-at', `${at}ms`);
  if (!reducedMotion()) setTimeout(() => panel.isConnected && (sfx.stamp(), haptic.medium()), at + 330);
  return panel;
}
