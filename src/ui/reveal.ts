/**
 * "The road goes on" (길은 계속된다 · 道は続く): the moment after level 600.
 * Shown, not told: the last passport stamp sits on its page, an ink road draws
 * itself past it into new hills, an empty stamp waits at the end, and a fresh
 * passport page turns over. Until this plays, nothing in the game mentions a
 * level past 600.
 */
import { installStampDefs, stampSvg } from '../art/stamp';
import { ROUTE } from '../data/route';
import { sfx } from '../services/audio';
import { haptic } from '../services/haptics';
import { persist, save } from '../services/storage';
import { frag, h } from './dom';
import { ICONS } from './icons';

/** From the last stamp (bottom left) up into new country, ending at an empty stamp. */
const ROAD = 'M60 572C104 548 150 532 170 500S176 436 208 410 270 372 278 318 270 236 286 208';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Play the reveal over everything; resolves when the player walks on. */
export function roadGoesOn(): Promise<void> {
  installStampDefs();
  const last = ROUTE.length - 1;
  const lastStamp = save.journey.stamps[ROUTE[last].id] ?? null;
  const still = reducedMotion();
  const el = frag(`<div class="reveal${still ? ' is-still' : ''}" role="dialog" aria-modal="true" aria-label="The road goes on">
    <svg class="reveal__land" viewBox="0 0 360 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle class="reveal__moon" cx="84" cy="118" r="24"/>
      <path class="reveal__hill reveal__hill--far" d="M0 330C50 290 96 282 140 300S214 262 258 246 320 240 360 260V640H0Z"/>
      <path class="reveal__hill reveal__hill--mid" d="M0 400C60 366 110 372 160 388S250 350 300 344 340 350 360 356V640H0Z"/>
      <path class="reveal__hill reveal__hill--near" d="M0 470C70 446 130 452 190 466S300 448 360 456V640H0Z"/>
      <path class="reveal__road reveal__road--wash" pathLength="1" d="${ROAD}"/>
      <path class="reveal__road" pathLength="1" d="${ROAD}"/>
      <circle class="reveal__next" cx="292" cy="184" r="24"/>
    </svg>
    <div class="reveal__last" aria-hidden="true">${stampSvg(ROUTE[last], last, lastStamp)}</div>
    <div class="reveal__words">
      <h2>The road goes on</h2>
      <p class="reveal__native"><span lang="ko">길은 계속된다</span> · <span class="ja" lang="ja">道は続く</span></p>
    </div>
    <div class="reveal__page" aria-hidden="true">
      <div class="reveal__leaf"><b>Wanderer</b><span>Year 2</span><i></i><i></i><i></i><i></i></div>
    </div>
    <div class="reveal__go"></div>
  </div>`);
  const go = h('button', { class: 'btn btn--primary btn--block', html: `Walk on ${ICONS.play}` });
  el.querySelector('.reveal__go')!.append(go);
  document.body.append(el);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, still ? 0 : ms));
  at(80, () => el.classList.add('is-on'));
  at(900, () => sfx.reveal());
  at(2300, () => {
    sfx.stamp();
    haptic.medium();
  });
  at(3900, () => el.classList.add('is-done'));
  // A tap anywhere before the end skips ahead to the last frame.
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button') || el.classList.contains('is-done')) return;
    timers.forEach(clearTimeout);
    el.classList.add('is-on', 'is-skip', 'is-done');
  });

  return new Promise((resolve) => {
    go.addEventListener('click', () => {
      save.journey.revealed = true;
      persist();
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        resolve();
      }, still ? 0 : 420);
    });
    requestAnimationFrame(() => go.focus({ preventScroll: true }));
  });
}
