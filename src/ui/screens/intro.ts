import { sceneParticles, sceneSvg } from '../../art/scene';
import { calendarSeason } from '../../data/route';
import { unlockAudio } from '../../services/audio';
import { type Screen } from '../app';
import { frag } from '../dom';
import { ICONS } from '../icons';
import { FIRST_MINUTE } from '../launch-plan';
import { nav } from '../nav';
import { BRAND_TAG } from './home';

/**
 * First launch only: the title over the landscape of the real season, one line
 * saying what Jjak is, and Begin. Begin opens the first-minute demo, and the
 * first-pair metric is measured from this tap.
 */
export function introScreen(): Screen {
  const season = calendarSeason(new Date());
  const el = frag(`<section class="screen opening">
    <div class="scene opening__scene" data-season="${season}">
      ${sceneSvg(season)}
      <div class="scene__particles" aria-hidden="true">${sceneParticles(season)}</div>
    </div>
    <div class="opening__title">
      <div class="seal opening__seal" aria-hidden="true">짝</div>
      <h1 class="brand__word opening__word">Jjak</h1>
      ${BRAND_TAG}
    </div>
    <p class="opening__what">A calm pairing puzzle on the flower cards Korea and Japan share.</p>
    <button class="btn btn--primary btn--block opening__begin">Begin ${ICONS.play}</button>
  </section>`);
  const begin = el.querySelector<HTMLButtonElement>('.opening__begin');
  if (!begin) throw new Error('intro screen markup lost its Begin button');
  // Once: a double tap must not open the demo twice.
  begin.addEventListener(
    'click',
    () => {
      unlockAudio();
      performance.mark(FIRST_MINUTE.beginMark);
      nav.welcome();
    },
    { once: true },
  );
  return { name: 'intro', el };
}
