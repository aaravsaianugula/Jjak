/**
 * The Practice room (연습 · 稽古): every idea the player has met on the road, with its
 * animated intro to watch again and a few gentle boards to try it on. Built from the
 * mechanic registry and the Director's bank (src/director/practice.ts), so a new
 * mechanic appears here on its own. Practice boards never count toward anything.
 */
import { metMechanics, practiceBoards } from '../../director/practice';
import { type Mechanic } from '../../engine/levels';
import { MECHANICS } from '../../engine/mechanics';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { contextOf, openIntro, tipKey } from '../intros';
import { nav } from '../nav';

/** The mechanics this player has met (the room shows nothing they haven't). */
export const practiceMet = (): Mechanic[] => metMechanics((m) => save.seenTips.includes(tipKey(m)), save.level);

/** "한글 · 漢字" with the Japanese half in the Japanese face. */
const nativeHtml = (native: string) =>
  native
    .split(' · ')
    .map((part, i) => (i === 0 ? `<span lang="ko">${esc(part)}</span>` : `<span class="ja" lang="ja">${esc(part)}</span>`))
    .join(' · ');

function row(m: Mechanic, i: number): string {
  const d = MECHANICS[m];
  // Until the bank holds boards for a new mechanic, its row offers the intro alone.
  const list = practiceBoards(m);
  const count = list.length;
  const boards = list.map(
    (_, k) => `<button class="chip-btn practice__board" data-board="${m}:${k}" aria-label="${esc(d.name)}: practice board ${k + 1} of ${count}">${k + 1}</button>`,
  ).join('');
  return `<li class="practice__row" style="--i:${i}">
    <span class="sealmark practice__mark ja" aria-hidden="true">${esc(d.glyph)}</span>
    <span class="practice__body">
      <span class="practice__title">${esc(d.name)} <span class="practice__native">${nativeHtml(d.native)}</span></span>
      <span class="practice__rule">${esc(d.rule)}</span>
      <span class="practice__acts">
        <button class="chip-btn practice__intro" data-intro="${m}" aria-label="Watch the ${esc(d.name)} intro">${ICONS.play}<span>Intro</span></button>
        ${boards ? `<span class="practice__boards" role="group" aria-label="${esc(d.name)} practice boards">${boards}</span>` : ''}
      </span>
    </span>
  </li>`;
}

export function practiceScreen(): Screen {
  const met = practiceMet();
  const el = frag(`<section class="screen practice">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Practice</h1><span class="topbar__sub"><span lang="ko">연습</span> · <span class="ja" lang="ja">稽古</span></span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="screen__body scroll">
      <p class="practice__note">Watch an idea again, then try it on a gentle board. Practice doesn’t count toward blossoms, petals or your level.</p>
      ${
        met.length
          ? `<ul class="list practice__list">${met.map(row).join('')}</ul>`
          : `<p class="practice__empty muted">Each new idea you meet on the road gathers here.</p>`
      }
    </div>
  </section>`);
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-back]')) return nav.home();
    const intro = t.closest<HTMLElement>('[data-intro]')?.dataset.intro as Mechanic | undefined;
    if (intro) {
      const first = practiceBoards(intro)[0];
      openIntro(intro, first ? contextOf(first) : {}, 'Back');
      return;
    }
    const board = t.closest<HTMLElement>('[data-board]')?.dataset.board;
    if (board) {
      const [m, k] = board.split(':');
      nav.game(practiceBoards(m as Mechanic)[Number(k)]);
    }
  });
  return { name: 'practice', el };
}
