/**
 * Journey visuals for the game screen: knots (매듭) tied over cards, the wind's
 * breeze and vane, the lucky-pair celebration, the passport-stamp moment on the
 * result sheet, and the first-time Knots and Wind tips with a "Try it" practice.
 * The game screen calls these; they own no game state.
 */
import { cardSvg } from '../art/cards';
import { installStampDefs, stampSvg, stampTilt } from '../art/stamp';
import { ROUTE, SEASON_NAMES } from '../data/route';
import { MONTHS } from '../data/deck';
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

// ── Tips with a "Try it" practice ─────────────────────────────────────
interface MiniCard {
  id: number;
  tied?: boolean;
}

/** A one-row mini board: cards sit in four slots and can be cleared or moved. */
function miniRow(cards: MiniCard[], cls: string): HTMLElement {
  return frag(`<div class="mini ${cls}">${cards
    .map(
      (c, i) =>
        `<button class="mini__card${c.tied ? ' is-knot' : ''}" data-i="${i}" data-m="${c.id >> 2}" style="--slot:${i}" aria-label="${esc(MONTHS[c.id >> 2].en)}, month ${(c.id >> 2) + 1}${c.tied ? ', tied with a cord' : ''}">${cardSvg(c.id)}${c.tied ? `<span class="knot" aria-hidden="true">${KNOT_SVG}</span>` : ''}</button>`,
    )
    .join('')}</div>`);
}

export interface TipSheet {
  content: HTMLElement;
  /** the main button (its label changes once the practice is solved) */
  button: HTMLButtonElement;
}

/** Knots: one rule, one picture, and a two-step practice. */
export function knotTip(level: number): TipSheet {
  const content = frag(`<div class="tip tip--rule tip--knots">
    <div class="tip__kicker">New on the road · Knots</div>
    <h2>Knots <span class="tip__native">매듭 · 結び</span></h2>
    <p class="tip__lead">Some cards are tied with a red silk cord.<br><b>A tied card can’t be picked until a card next to it is cleared.</b></p>
    <p class="tip__caption">Its face stays visible, so you can plan ahead. A knot also comes loose at the edge of the board, and tied cards block paths like any other card.</p>
    <div class="quiz" role="group" aria-label="Practice: untie the knot">
      <div class="quiz__title"><span class="quiz__step">Try it</span> Free the tied Pine, then pair the Pines</div>
      <div class="quiz__board"></div>
      <p class="quiz__feedback" aria-live="polite">Hint: which pair sits right next to the knot?</p>
    </div>
  </div>`);
  const row = miniRow([{ id: 0 }, { id: 1, tied: true }, { id: 4 }, { id: 5 }], 'mini--knot');
  content.querySelector('.quiz__board')!.append(row);
  const feedback = content.querySelector<HTMLElement>('.quiz__feedback')!;
  const button = h('button', { class: 'btn btn--primary btn--block' }, 'Got it') as HTMLButtonElement;
  content.append(h('div', { class: 'sheet__actions' }, button));

  let tied = true;
  let picked: HTMLElement | null = null;
  let solved = false;
  row.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.mini__card');
    if (!card || solved || card.classList.contains('is-gone')) return;
    if (card.classList.contains('is-knot')) {
      retrigger(card.querySelector('.knot'), 'is-tug');
      retrigger(card, 'is-wrong');
      feedback.innerHTML = '<b>It’s tied.</b> Clear a card right next to it first.';
      sfx.deselect();
      return;
    }
    if (!picked) {
      picked = card;
      card.classList.add('is-picked');
      sfx.tap();
      return;
    }
    if (picked === card) {
      card.classList.remove('is-picked');
      picked = null;
      return;
    }
    const a = picked;
    picked = null;
    if (a.dataset.m !== card.dataset.m) {
      for (const p of [a, card]) {
        p.classList.add('is-wrong');
        setTimeout(() => p.classList.remove('is-wrong', 'is-picked'), 600);
      }
      feedback.innerHTML = '<b>Not a pair.</b> Match the number in the corner.';
      sfx.miss();
      return;
    }
    for (const p of [a, card]) p.classList.add('is-gone');
    sfx.match(tied ? 1 : 2);
    if (tied) {
      tied = false;
      const knotted = row.querySelector<HTMLElement>('.mini__card.is-knot')!;
      setTimeout(() => {
        knotted.classList.remove('is-knot');
        knotted.querySelector('.knot')?.classList.add('is-untie');
        sfx.reveal();
      }, 260);
      feedback.innerHTML = '<b>The knot came loose!</b> Now pair the two Pine cards.';
    } else {
      solved = true;
      content.querySelector('.quiz')!.classList.add('is-solved');
      feedback.innerHTML = '<b>That’s it.</b> Clear a neighbour, and the knot lets go.';
      haptic.success();
      button.textContent = `Start Level ${level}`;
    }
  });
  return { content, button };
}

/** Wind: one rule, one picture (a live mini board), and a practice. */
export function windTip(dir: Wind, level: number): TipSheet {
  // The practice blows sideways; an upward wind is shown blowing right.
  const demo: Wind = dir === 'left' ? 'left' : 'right';
  const content = frag(`<div class="tip tip--rule tip--wind">
    <div class="tip__kicker">New on the road · Wind</div>
    <h2>Wind <span class="tip__native">바람 · 風</span></h2>
    <p class="tip__lead">On windy boards, cards don’t stay put.<br><b>After every pair, the cards slide ${WIND_WORD[dir]} until they meet the edge, a stone or another card.</b></p>
    <p class="tip__caption">The vane <span class="wind-vane wind-vane--inline"><b class="ja">風</b><span>${ARROWS[dir]}</span></span> above the board shows which way it blows. New pairs line up as the cards drift.</p>
    <div class="quiz" role="group" aria-label="Practice: let the wind move a card">
      <div class="quiz__title"><span class="quiz__step">Try it</span> Pair the two Plums and watch the Pine</div>
      <div class="quiz__board"><div class="mini__wind" aria-hidden="true">${ARROWS[demo]} ${ARROWS[demo]} ${ARROWS[demo]}</div></div>
      <p class="quiz__feedback" aria-live="polite">The wind here blows ${WIND_WORD[demo]}.</p>
    </div>
  </div>`);
  const ids = demo === 'right' ? [0, 4, 5, 1] : [1, 4, 5, 0];
  const row = miniRow(ids.map((id) => ({ id })), `mini--wind mini--${demo}`);
  content.querySelector('.quiz__board')!.append(row);
  const feedback = content.querySelector<HTMLElement>('.quiz__feedback')!;
  const button = h('button', { class: 'btn btn--primary btn--block' }, 'Got it') as HTMLButtonElement;
  content.append(h('div', { class: 'sheet__actions' }, button));
  let picked: HTMLElement | null = null;
  let step = 0;
  row.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.mini__card');
    if (!card || step >= 2 || card.classList.contains('is-gone')) return;
    if (!picked) {
      picked = card;
      card.classList.add('is-picked');
      sfx.tap();
      return;
    }
    if (picked === card) {
      card.classList.remove('is-picked');
      picked = null;
      return;
    }
    const a = picked;
    picked = null;
    if (a.dataset.m !== card.dataset.m) {
      for (const p of [a, card]) {
        p.classList.add('is-wrong');
        setTimeout(() => p.classList.remove('is-wrong', 'is-picked'), 600);
      }
      feedback.innerHTML = step === 0 ? '<b>Not quite.</b> Start with the two Plum cards in the middle.' : '<b>Not a pair.</b> Match the number in the corner.';
      sfx.miss();
      return;
    }
    if (step === 0 && a.dataset.m !== '1') {
      for (const p of [a, card]) p.classList.remove('is-picked');
      feedback.innerHTML = '<b>That pair works too</b>, but start with the two Plums to see the wind.';
      sfx.deselect();
      return;
    }
    for (const p of [a, card]) p.classList.add('is-gone');
    sfx.match(step + 1);
    if (step === 0) {
      step = 1;
      // The outer Pine drifts across the gap to sit beside the other Pine.
      const mover = row.querySelector<HTMLElement>(`.mini__card[data-i="${demo === 'right' ? 0 : 3}"]`)!;
      setTimeout(() => {
        mover.style.setProperty('--slot', demo === 'right' ? '2' : '1');
        mover.classList.add('is-drift');
        breeze(row, demo, true);
      }, 280);
      feedback.innerHTML = `<b>Whoosh.</b> The Pine slid ${WIND_WORD[demo]} until it met the other Pine. Pair them!`;
    } else {
      step = 2;
      content.querySelector('.quiz')!.classList.add('is-solved');
      feedback.innerHTML = '<b>Lovely.</b> Watch the vane, and let the wind line pairs up for you.';
      haptic.success();
      button.textContent = `Start Level ${level}`;
    }
  });
  return { content, button };
}
