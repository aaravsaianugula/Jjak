import { CHAPTERS, LEVELS_PER_CHAPTER, journeyLevel } from '../../engine/levels';
import { levelsToLantern } from '../../services/progress';
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
  const currentChapter = Math.floor((unlocked - 1) / LEVELS_PER_CHAPTER);
  const lastChapter = currentChapter + 1; // include the next one as a preview
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  let html = '';
  for (let ch = 0; ch <= lastChapter; ch++) {
    const season = CHAPTERS[ch % 4];
    const year = Math.floor(ch / 4) + 1;
    const first = ch * LEVELS_PER_CHAPTER + 1;
    const locked = first > unlocked;
    let got = 0;
    let cells = '';
    for (let n = first; n < first + LEVELS_PER_CHAPTER; n++) {
      const stars = save.stars[n] ?? 0;
      got += stars;
      const isLocked = n > unlocked;
      const spec = journeyLevel(n);
      const twist = spec.gravity ? '落' : spec.snow ? '雪' : spec.stones ? '石' : '';
      const twistName = spec.gravity ? 'falling leaves' : spec.snow ? 'first snow' : spec.stones ? 'stones' : '';
      const lantern = n >= unlocked && levelsToLantern(n) === 0;
      const label = `Level ${n}${n === unlocked ? ', next to play' : ''}${isLocked ? ', locked' : n < unlocked ? `, ${stars} of 3 blossoms` : ''}${twistName ? `, ${twistName}` : ''}${lantern ? ', lantern gift' : ''}`;
      cells += `<button class="lvl ${n === unlocked ? 'lvl--now' : ''}" data-level="${n}" ${isLocked ? 'disabled' : ''} aria-label="${label}"${n === unlocked ? ' aria-current="step"' : ''}>
        <span class="lvl__n">${n}</span>
        <span class="lvl__stars" aria-hidden="true">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}"></i>`).join('')}</span>
        ${twist ? `<span class="lvl__twist ja" aria-hidden="true">${twist}</span>` : ''}
        ${lantern ? `<span class="lvl__lan" aria-hidden="true">${ICONS.lantern}</span>` : ''}
      </button>`;
    }
    const max = LEVELS_PER_CHAPTER * 3;
    html += `<section class="panel chapter${locked ? ' is-locked' : ''}" data-season="${ch % 4}" ${ch === currentChapter ? 'data-current' : ''} aria-labelledby="ch-${ch}">
      <div class="chapter__head">
        <span class="chapter__glyph ja" aria-hidden="true">${season.ja}</span>
        <div class="chapter__titles">
          <h2 class="chapter__name" id="ch-${ch}">${esc(season.name)}<span class="muted serif" lang="ko">${season.ko}</span>${year > 1 ? ` <span class="muted">· Year ${year}</span>` : ''}</h2>
          <div class="chapter__note">${locked ? 'Opens when you finish the chapter before. ' : ''}${esc(SEASON_NOTE[ch % 4])}</div>
        </div>
        <div class="chapter__count" aria-label="${got} of ${max} blossoms">
          <span aria-hidden="true">${ICONS.blossom}<span>${got}<span class="muted">/${max}</span></span></span>
          <span class="meter" aria-hidden="true"><i style="width:${Math.round((got / max) * 100)}%"></i></span>
        </div>
      </div>
      <div class="lvl-grid">${cells}</div>
    </section>`;
  }

  const el = frag(`<section class="screen map">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Journey</h1><span class="topbar__sub">${totalStars} blossoms · Level ${unlocked}</span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="scroll map__list screen__body">
      <div class="map-legend" aria-label="Map key">
        <span><span class="ja" aria-hidden="true">石</span>Stones</span>
        <span><span class="ja" aria-hidden="true">落</span>Falling leaves</span>
        <span><span class="ja" aria-hidden="true">雪</span>First snow</span>
        <span>${ICONS.lantern}Lantern gift</span>
      </div>
      ${html}
    </div>
  </section>`);

  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  el.querySelector('.map__list')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
    if (b && !b.disabled) nav.game(journeyLevel(Number(b.dataset.level)));
  });
  requestAnimationFrame(() => el.querySelector('[data-current]')?.scrollIntoView({ block: 'start' }));
  return { name: 'map', el };
}
