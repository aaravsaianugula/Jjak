import { ads } from '../../services/ads';
import { unlockAudio } from '../../services/audio';
import { persist, save } from '../../services/storage';
import { type Screen } from '../app';
import { DemoPlayer } from '../demo';
import { BASIC_DEMOS } from '../demos';
import { frag, h } from '../dom';
import { ICONS } from '../icons';
import { openSheet } from '../modal';
import { nav } from '../nav';

/**
 * The first minute, shown instead of a page of rules. Four short beats on one
 * mini board, almost wordless:
 *   1. the brush pairs two cards and the path draws; then one bend, two bends
 *   2. your turn: the player makes a pair (target: within 20 s of launch)
 *   3. a blocked pair shakes; its three-bend path is crossed out; clear the way
 *   4. three quick pairs: 짝 · 짝짝 · 짝짝짝, the combo
 * Skippable from the first frame. The player's first pair is marked with
 * performance.mark('jjak:first-pair') so it can be measured.
 */
function firstMinute(opts: { replay: boolean; onDone: () => void }): { el: HTMLElement; destroy(): void } {
  const player = new DemoPlayer(BASIC_DEMOS.bends, { size: 'stage' });
  const el = frag(`<div class="first${opts.replay ? ' first--replay' : ''}">
    <header class="first__top">
      <span class="first__brand"><span class="seal" aria-hidden="true">짝</span><span>Jjak<small><span lang="ko">짝</span> means pair</small></span></span>
      <button class="btn btn--quiet first__skip" data-first="skip">${opts.replay ? 'Close' : 'Skip'}</button>
    </header>
    <div class="first__demo"></div>
    <footer class="first__foot">
      <ol class="first__dots" aria-label="Intro progress">${[0, 1, 2, 3].map((i) => `<li data-dot="${i}"></li>`).join('')}</ol>
      <button class="btn btn--primary btn--block first__go" data-first="go" hidden>${opts.replay ? 'Done' : `Play ${ICONS.play}`}</button>
    </footer>
  </div>`);
  el.querySelector('.first__demo')!.append(player.el);
  const go = el.querySelector<HTMLButtonElement>('.first__go')!;
  const dots = [...el.querySelectorAll<HTMLElement>('[data-dot]')];
  const stage = (n: number) =>
    dots.forEach((d, i) => {
      d.classList.toggle('is-on', i === n);
      d.classList.toggle('is-done', i < n);
    });

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    player.destroy();
    opts.onDone();
  };
  el.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-first]')?.dataset.first;
    if (act) end();
  });

  void (async () => {
    stage(0);
    if (!(await player.play(1))) return;
    stage(1);
    await player.yourTurn({
      hintAfter: 900,
      onPair: (n) => {
        if (n === 1 && !opts.replay) performance.mark('jjak:first-pair');
      },
    });
    await new Promise((r) => setTimeout(r, 900));
    stage(2);
    if (!(await player.swap(BASIC_DEMOS.blocked)) || !(await player.play(1))) return;
    stage(3);
    if (!(await player.swap(BASIC_DEMOS.combo)) || !(await player.play(1))) return;
    dots.forEach((d) => d.classList.add('is-done'));
    go.hidden = false;
  })();

  return { el, destroy: () => player.destroy() };
}

/** First launch: the first-minute intro, then straight into Level 1. */
export function welcomeScreen(): Screen {
  const start = () => {
    unlockAudio();
    save.onboarded = true;
    persist();
    void ads.start();
    nav.journey(1);
  };
  const flow = firstMinute({ replay: false, onDone: start });
  const el = h('section', { class: 'screen welcome' }, flow.el);
  return { name: 'welcome', el, destroy: flow.destroy };
}

/** Replay intro (How to Play): the same first minute over whatever is open, then back. */
export function replayIntro(): void {
  let close = () => {};
  const flow = firstMinute({ replay: true, onDone: () => close() });
  const sheet = openSheet(flow.el, { label: 'Intro', dismissible: true });
  sheet.el.classList.add('sheet--full');
  sheet.el.parentElement?.classList.add('scrim--full');
  close = () => sheet.close();
  void sheet.closed.then(flow.destroy);
}
