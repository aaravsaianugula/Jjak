import { ads } from '../../services/ads';
import { unlockAudio } from '../../services/audio';
import { persist, save } from '../../services/storage';
import { type Screen } from '../app';
import { frag } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';

/** First launch: one calm screen with the three rules, then straight into Level 1. */
export function welcomeScreen(): Screen {
  const fan = [8, 20, 44, 28, 36]
    .map((id, i) => `<svg viewBox="0 0 100 140" style="transform:rotate(${(i - 2) * 11}deg);animation-delay:${i * 60}ms" aria-hidden="true"><use href="#card-${id}"/></svg>`)
    .join('');
  const mini = (a: number, b: number) =>
    `<span class="rule__cards" aria-hidden="true"><svg viewBox="0 0 100 140"><use href="#card-${a}"/></svg><svg viewBox="0 0 100 140"><use href="#card-${b}"/></svg></span>`;

  const el = frag(`<section class="screen welcome">
    <div class="welcome__brand"><span class="seal" aria-hidden="true">짝</span>Jjak</div>
    <div class="welcome__fan" aria-hidden="true">${fan}</div>
    <h1>Find the pairs.<br>Clear the seasons.</h1>
    <p class="welcome__lede"><b>Jjak</b> (<span lang="ko">짝</span>) is Korean for “pair”. Match flowers from the 48-card deck that Korea and Japan share, and learn their names as you go.</p>
    <ul class="panel rules" aria-label="Three rules">
      <li class="rule">${mini(8, 11)}<span><b>Same flower, same number</b>Any two cards of one flower make a pair.</span></li>
      <li class="rule"><span class="rule__glyph" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M8 32V12h24v14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="32" r="4" fill="var(--accent)"/><circle cx="32" cy="26" r="4" fill="var(--accent)"/></svg></span><span><b>Two bends at most</b>The line between them may turn twice and run around the edge.</span></li>
      <li class="rule"><span class="rule__glyph serif" aria-hidden="true">짝짝</span><span><b>Keep the rhythm</b>Pairs made quickly build a combo.</span></li>
    </ul>
    <button class="btn btn--primary btn--block" data-begin>Begin ${ICONS.play}</button>
  </section>`);

  el.querySelector('[data-begin]')!.addEventListener('click', async () => {
    unlockAudio();
    save.onboarded = true;
    persist();
    void ads.start();
    nav.journey(1);
  });
  return { name: 'welcome', el };
}
