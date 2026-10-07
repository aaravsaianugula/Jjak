import { CHAPTERS, LEVELS_PER_CHAPTER, journeyLevel } from '../../engine/levels';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';

const SEASON_NOTE = [
  'The basics, then four cards to every flower.',
  'Stones (돌 · 石) block paths. Route around them.',
  'Falling leaves: cards drop to fill the gaps.',
  'First snow: some cards start hidden.',
];

/** Every chapter so far, with blossoms per level; tap any unlocked level to replay it. */
export function mapScreen(): Screen {
  const unlocked = save.level;
  const lastChapter = Math.floor((unlocked - 1) / LEVELS_PER_CHAPTER) + 1; // include the next one as a preview
  let html = '';
  for (let ch = 0; ch <= lastChapter; ch++) {
    const season = CHAPTERS[ch % 4];
    const year = Math.floor(ch / 4) + 1;
    const first = ch * LEVELS_PER_CHAPTER + 1;
    let got = 0;
    let cells = '';
    for (let n = first; n < first + LEVELS_PER_CHAPTER; n++) {
      const stars = save.stars[n] ?? 0;
      got += stars;
      const locked = n > unlocked;
      const spec = journeyLevel(n);
      const twist = spec.gravity ? '落' : spec.snow ? '雪' : spec.stones ? '石' : '';
      cells += `<button class="lvl ${n === unlocked ? 'lvl--now' : ''}" data-level="${n}" ${locked ? 'disabled' : ''} aria-label="Level ${n}${locked ? ', locked' : `, ${stars} of 3 blossoms`}">
        <span class="lvl__n">${n}</span>
        <span class="lvl__stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}"></i>`).join('')}</span>
        ${twist ? `<span class="lvl__twist ja">${twist}</span>` : ''}
      </button>`;
    }
    html += `<section class="chapter" ${ch === Math.floor((unlocked - 1) / LEVELS_PER_CHAPTER) ? 'data-current' : ''}>
      <div class="chapter__head">
        <span class="chapter__glyph ja">${season.ja}</span>
        <div><div class="chapter__name">${esc(season.name)} <span class="muted serif">${season.ko}</span>${year > 1 ? ` <span class="muted">· Year ${year}</span>` : ''}</div>
        <div class="muted chapter__note">${esc(SEASON_NOTE[ch % 4])}</div></div>
        <span class="chapter__count">${got}/36</span>
      </div>
      <div class="lvl-grid">${cells}</div>
    </section>`;
  }

  const el = frag(`<section class="screen">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title">Journey</div>
      <span class="album__count">${Object.values(save.stars).reduce((a, b) => a + b, 0)}<span class="muted"> ✿</span></span>
    </header>
    <div class="scroll map__list">${html}</div>
  </section>`);

  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  el.querySelector('.map__list')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
    if (b && !b.disabled) nav.game(journeyLevel(Number(b.dataset.level)));
  });
  requestAnimationFrame(() => el.querySelector('[data-current]')?.scrollIntoView({ block: 'start' }));
  return { name: 'map', el };
}
