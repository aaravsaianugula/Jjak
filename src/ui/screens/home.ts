import { cardSvg } from '../../art/cards';
import { CHAPTERS, LEVELS_PER_CHAPTER, chapterOf, dailyLevel, journeyLevel, localDateKey, zenLevel } from '../../engine/levels';
import { formatTime } from '../../engine/session';
import { unlockAudio } from '../../services/audio';
import { liveStreak } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function homeScreen(): Screen {
  const level = save.level;
  const chapter = chapterOf(level);
  const chapterIndex = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  const slot = (level - 1) % LEVELS_PER_CHAPTER;
  const loop = Math.floor(chapterIndex / CHAPTERS.length);

  const dots = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => `<span class="${i < slot ? 'done' : i === slot ? 'now' : ''}"></span>`).join('');

  const today = localDateKey();
  const daily = dailyLevel(today);
  const result = save.daily.results[today];
  const streak = liveStreak();
  const now = new Date();

  const el = frag(`<section class="screen home">
    <header class="home__head">
      <span class="petals" aria-label="${save.petals} petals">${ICONS.petal}${save.petals}</span>
      <button class="icon-btn" data-go="settings" aria-label="Settings">${ICONS.gear}</button>
    </header>
    <div class="brand">
      <div class="seal" aria-hidden="true">짝</div>
      <div class="brand__word">Jjak</div>
      <div class="brand__tag">Pair the flowers of the four seasons<br><span class="serif">꽃을 맞추다</span> · <span class="ja">花を合わせる</span></div>
    </div>
    <div class="home__fill"></div>
    <button class="panel journey" data-go="journey" aria-label="Continue Journey, level ${level}">
      <span class="journey__season" aria-hidden="true">${chapter.ja}</span>
      <span class="journey__label">Journey · ${esc(chapter.name)}${loop > 0 ? ` · Year ${loop + 1}` : ''}</span>
      <span class="journey__title">Level ${level}</span>
      <span class="chapter-dots" aria-hidden="true">${dots}</span>
      <span class="btn btn--primary btn--block">${level === 1 ? 'Begin' : 'Continue'} ${ICONS.play}</span>
    </button>
    <button class="panel daily" data-go="daily" aria-label="Daily Jjak number ${daily.number}">
      <span class="daily__cal"><small>${MONTH_ABBR[now.getMonth()]}</small><b>${now.getDate()}</b></span>
      <span class="daily__body">
        <span class="daily__title">Daily Jjak #${daily.number}</span><br>
        <span class="daily__sub">${result ? `Solved in ${formatTime(result.ms)}` : 'One board, the whole world'}${streak ? ` · ${streak}-day streak` : ''}</span>
      </span>
      <span class="daily__cta ${result ? 'daily__cta--done' : ''}">${result ? 'Done' : 'Play'}</span>
    </button>
    <div class="tiles">
      <button class="panel tile" data-go="zen"><span class="tile__title">Zen</span><span class="tile__sub">Endless, untimed</span><span class="tile__glyph" aria-hidden="true">禅</span></button>
      <button class="panel tile" data-go="album"><span class="tile__title">Album</span><span class="tile__sub">${save.album.length} of 48 cards</span>
        <span class="tile__cards" aria-hidden="true">${[8, 28, 40].map((id) => cardSvg(save.album.includes(id) ? id : 'back')).join('')}</span></button>
    </div>
  </section>`);

  el.addEventListener('click', (e) => {
    const go = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
    if (!go) return;
    unlockAudio();
    if (go === 'journey') nav.game(journeyLevel(save.level));
    if (go === 'daily') nav.game(dailyLevel(today));
    if (go === 'zen') nav.game(zenLevel(`zen-${Date.now()}`));
    if (go === 'album') nav.album();
    if (go === 'settings') nav.settings();
  });
  void h;
  return { name: 'home', el };
}
