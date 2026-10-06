import { cardSvg } from '../../art/cards';
import { ads } from '../../services/ads';
import { unlockAudio } from '../../services/audio';
import { persist, save } from '../../services/storage';
import { type Screen } from '../app';
import { frag } from '../dom';
import { nav } from '../nav';
import { journeyLevel } from '../../engine/levels';

/**
 * First launch: a short hello, then a neutral age screen (Google Play Families
 * policy). Age is stored on-device only and used to keep ads age-appropriate.
 */
export function welcomeScreen(): Screen {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 90 }, (_, i) => thisYear - 3 - i);
  const fan = [8, 20, 44, 28, 36]
    .map((id, i) => `<svg viewBox="0 0 100 140" style="transform:rotate(${(i - 2) * 11}deg);animation-delay:${i * 60}ms" aria-hidden="true"><use href="#card-${id}"/></svg>`)
    .join('');
  void cardSvg;

  const el = frag(`<section class="screen welcome">
    <div data-step="1" style="display:flex;flex-direction:column;gap:18px">
      <div class="welcome__fan">${fan}</div>
      <h1>Find the pairs.<br>Clear the seasons.</h1>
      <p><b>Jjak</b> (짝) is Korean for “pair”. Match flowers from the 48-card deck that Korea and Japan share, and learn their names along the way.</p>
      <button class="btn btn--primary btn--block" data-next>Begin</button>
    </div>
    <div data-step="2" hidden style="display:flex;flex-direction:column;gap:16px">
      <div class="seal" style="width:56px;height:56px;font-size:30px;margin:0 auto;transform:rotate(-5deg)">짝</div>
      <h1>What year were you born?</h1>
      <p>We use this only to keep ads age-appropriate. It stays on this device.</p>
      <select class="year" aria-label="Birth year">
        <option value="" selected disabled>Select year</option>
        ${years.map((y) => `<option value="${y}">${y}</option>`).join('')}
      </select>
      <button class="btn btn--primary btn--block" data-done disabled>Continue</button>
    </div>
  </section>`);

  const step1 = el.querySelector<HTMLElement>('[data-step="1"]')!;
  const step2 = el.querySelector<HTMLElement>('[data-step="2"]')!;
  const select = el.querySelector<HTMLSelectElement>('select')!;
  const done = el.querySelector<HTMLButtonElement>('[data-done]')!;

  el.querySelector('[data-next]')!.addEventListener('click', () => {
    unlockAudio();
    step1.hidden = true;
    step1.style.display = 'none';
    step2.hidden = false;
  });
  select.addEventListener('change', () => (done.disabled = !select.value));
  done.addEventListener('click', async () => {
    save.birthYear = Number(select.value);
    persist();
    await ads.start();
    nav.game(journeyLevel(1));
  });
  return { name: 'welcome', el };
}
