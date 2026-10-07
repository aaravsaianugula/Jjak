/**
 * "The road goes on" (길은 계속된다 · 道は続く): the moment after level 600.
 * Shown, not told: an ink-wash landscape rises out of the mist, and the road
 * draws itself from the last passport stamp at your feet, past the waypoints of
 * places already walked, up through the hills to the horizon. A passport opens
 * on a fresh page for the next year. Until this plays, nothing in the game
 * mentions a level past 600.
 */
import { roadSceneSvg } from '../art/road-scene';
import { installStampDefs, stampSvg } from '../art/stamp';
import { ROUTE } from '../data/route';
import { sfx } from '../services/audio';
import { haptic } from '../services/haptics';
import { persist, save } from '../services/storage';
import { frag, h } from './dom';
import { ICONS } from './icons';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the last stamp sits in the scene (viewBox units): at the road's near end. */
const STAMP_AT = { x: 66, y: 474, size: 80 };

/** Play the reveal over everything; resolves when the player walks on. */
export function roadGoesOn(): Promise<void> {
  installStampDefs();
  const last = ROUTE.length - 1;
  const lastStamp = save.journey.stamps[ROUTE[last].id] ?? null;
  const first = ROUTE[0];
  const still = reducedMotion();
  // The last stamp is drawn inside the scene so it always lands on the road's start.
  const stamp = stampSvg(ROUTE[last], last, lastStamp).replace(
    '<svg ',
    `<svg x="${STAMP_AT.x}" y="${STAMP_AT.y}" width="${STAMP_AT.size}" height="${STAMP_AT.size}" `,
  );
  const cx = STAMP_AT.x + STAMP_AT.size / 2;
  const cy = STAMP_AT.y + STAMP_AT.size / 2;
  const scene = roadSceneSvg('rv').replace(
    '</svg>',
    `<g class="rv-stamp"><g transform="rotate(-7 ${cx} ${cy})">${stamp}</g></g></svg>`,
  );
  const petals = Array.from({ length: 8 }, (_, k) => {
    const x = (k * 37) % 100;
    const d = ((k * 53) % 70) / 10;
    const dur = 7 + ((k * 29) % 50) / 10;
    return `<i style="left:${x}%;--d:${d}s;--dur:${dur}s;--sway:${((k % 5) - 2) * 14}px"></i>`;
  }).join('');

  const el = frag(`<div class="reveal${still ? ' is-still' : ''}" role="dialog" aria-modal="true" aria-label="The road goes on">
    ${scene}
    <div class="reveal__petals" aria-hidden="true">${petals}</div>
    <div class="reveal__words">
      <h2>The road goes on</h2>
      <svg class="reveal__rule" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true"><path d="M1 4.6C20 2.6 52 2.4 80 3.1S112 4.2 119 3.6C110 5.4 84 5.7 58 5.8S14 6.3 1 4.6Z"/></svg>
      <p class="reveal__native"><span lang="ko">길은 계속된다</span> · <span class="ja" lang="ja">道は続く</span></p>
    </div>
    <div class="reveal__book" aria-hidden="true">
      <div class="reveal__page">
        <span class="reveal__year"><b>Wanderer</b> · Year 2</span>
        <span class="reveal__slot"><i></i><span><b>${first.en}</b><small><span lang="ko">${first.ko}</span> · <span class="ja">${first.ja}</span></small></span></span>
      </div>
      <div class="reveal__cover"><span class="reveal__crest">짝</span><span class="reveal__title">여권 · <span class="ja">旅券</span></span><span class="reveal__title2">Passport</span></div>
    </div>
    <div class="reveal__go"></div>
  </div>`);
  const go = h('button', { class: 'btn btn--primary btn--block', html: `Walk on ${ICONS.play}` });
  el.querySelector('.reveal__go')!.append(go);
  document.body.append(el);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, still ? 0 : ms));
  at(60, () => el.classList.add('is-on'));
  at(1000, () => sfx.reveal());
  at(3800, () => {
    sfx.stamp();
    haptic.medium();
  });
  at(4400, () => el.classList.add('is-done'));
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
      setTimeout(
        () => {
          el.remove();
          resolve();
        },
        still ? 0 : 420,
      );
    });
    requestAnimationFrame(() => go.focus({ preventScroll: true }));
  });
}
