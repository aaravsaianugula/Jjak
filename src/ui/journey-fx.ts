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
 * A doubled red silk cord around the card with a butterfly knot (나비매듭) and
 * a tassel (술) with a gold band. Drawn in card units (100 × 140).
 */
const CORD = (y: number) => `M-4 ${y}C18 ${y - 2.6} 34 ${y + 2.2} 50 ${y}S82 ${y - 2.2} 104 ${y + 0.6}`;
export const KNOT_SVG =
  `<svg class="knot__art" viewBox="0 0 100 140" aria-hidden="true">` +
  `<g class="knot__cord">` +
  [78, 85]
    .map(
      (y) =>
        `<path d="${CORD(y)}" stroke="#5e0f17" stroke-width="6.4" fill="none" stroke-linecap="round" opacity=".55"/>` +
        `<path d="${CORD(y)}" stroke="#c0303a" stroke-width="4.6" fill="none" stroke-linecap="round"/>` +
        `<path d="${CORD(y - 0.9)}" stroke="#f3a0a3" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".75" stroke-dasharray="3 2.2"/>`,
    )
    .join('') +
  `</g>` +
  `<g class="knot__bow"><g transform="translate(50 81) scale(1.2) translate(-50 -81)">` +
  // Two loops, then the knot itself.
  `<path d="M50 81C40 66 24 64 25 75C26 84 40 85 50 81Z" fill="#c0303a" stroke="#5e0f17" stroke-width="1.3" stroke-linejoin="round"/>` +
  `<path d="M50 81C60 66 76 64 75 75C74 84 60 85 50 81Z" fill="#c0303a" stroke="#5e0f17" stroke-width="1.3" stroke-linejoin="round"/>` +
  `<path d="M31 74C34 70 41 71 46 78M69 74C66 70 59 71 54 78" stroke="#f3a0a3" stroke-width=".9" fill="none" opacity=".8"/>` +
  `<rect x="44.2" y="75.5" width="11.6" height="11.6" rx="3.4" fill="#a8232d" stroke="#5e0f17" stroke-width="1.2"/>` +
  `<path d="M46.5 79.5H53.5M46.5 83.2H53.5" stroke="#f3a0a3" stroke-width=".8" opacity=".8"/>` +
  // Tassel: two cords down to a gold band, then a soft fringe.
  `<path d="M48 87C47 95 47 101 48 107M52 87C53 95 53 101 52 107" stroke="#c0303a" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
  `<rect x="44.5" y="106" width="11" height="5.6" rx="2" fill="#d6a447" stroke="#7a5418" stroke-width=".8"/>` +
  `<path d="M45.6 112C45 118 44.5 123 44 128M48 112V129M50 112V130M52 112V129M54.4 112C55 118 55.5 123 56 128" stroke="#c0303a" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
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
export function stampMoment(id: string, date: string, at: number): HTMLElement {
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
      <div class="reward__label">Passport stamp · ${Object.keys(save.journey.stamps).length}/${ROUTE.length}</div>
      <div class="passport__name">${esc(c.en)}</div>
      <div class="passport__native"><span lang="ko">${c.ko}</span> · <span class="ja">${c.ja}</span></div>
      <div class="muted passport__season"><span class="ja">${season.ja}</span> ${esc(season.en)} · ${esc(c.postcard)}</div>
    </div>
  </div>`);
  panel.style.setProperty('--stamp-at', `${at}ms`);
  if (!reducedMotion()) setTimeout(() => panel.isConnected && (sfx.stamp(), haptic.medium()), at + 330);
  return panel;
}
