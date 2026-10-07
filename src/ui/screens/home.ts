import { CHAPTERS, LEVELS_PER_CHAPTER, chapterOf, dailyLevel, dailyTheme, journeyLevel, localDateKey, zenLevel } from '../../engine/levels';
import { formatTime } from '../../engine/session';
import { SEALS } from '../../services/achievements';
import { unlockAudio } from '../../services/audio';
import { formatCountdown, lastWeek, liveStreak, msToNextDaily } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
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
  const spec = journeyLevel(level);
  const twist = spec.gravity ? 'Falling leaves' : spec.snow ? 'First snow' : spec.stones ? 'Stones' : '';

  const today = localDateKey();
  const daily = dailyLevel(today);
  const theme = dailyTheme(today);
  const result = save.daily.results[today];
  const streak = liveStreak();
  const now = new Date();
  const week = lastWeek(now)
    .map((d) => `<span class="wk ${d.solved ? 'wk--on' : ''} ${d.isToday ? 'wk--today' : ''}" title="${d.key}">${d.day}</span>`)
    .join('');

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
    <div class="panel journey">
      <span class="journey__season" aria-hidden="true">${chapter.ja}</span>
      <div class="journey__top">
        <span class="journey__label">Journey · ${esc(chapter.name)}${loop > 0 ? ` · Year ${loop + 1}` : ''}</span>
        <button class="journey__map" data-go="map">Map ›</button>
      </div>
      <span class="journey__title">Level ${level}${twist ? ` <span class="journey__twist">${twist}</span>` : ''}</span>
      <span class="chapter-dots" aria-hidden="true">${dots}</span>
      <button class="btn btn--primary btn--block" data-go="journey">${level === 1 ? 'Begin' : 'Continue'} ${ICONS.play}</button>
    </div>
    <button class="panel daily" data-go="daily" aria-label="Daily Jjak number ${daily.number}">
      <span class="daily__cal"><small>${MONTH_ABBR[now.getMonth()]}</small><b>${now.getDate()}</b></span>
      <span class="daily__body">
        <span class="daily__title">Daily #${daily.number} <span class="daily__theme">${esc(theme.name)}</span></span>
        <span class="daily__sub">${result ? `Solved in ${formatTime(result.ms)} · next in ${formatCountdown(msToNextDaily(now))}` : 'One board for the whole world'}${streak ? ` · ${streak}-day streak` : ''}</span>
        <span class="week" aria-label="Last seven days">${week}</span>
      </span>
      <span class="daily__cta ${result ? 'daily__cta--done' : ''}">${result ? 'Done' : 'Play'}</span>
    </button>
    <div class="tiles">
      <button class="panel tile" data-go="zen"><span class="tile__title">Zen</span><span class="tile__sub">Untimed</span><span class="tile__glyph ja" aria-hidden="true">禅</span></button>
      <button class="panel tile" data-go="album"><span class="tile__title">Album</span><span class="tile__sub">${save.album.length}/48</span><span class="tile__glyph ja" aria-hidden="true">札</span></button>
      <button class="panel tile" data-go="seals"><span class="tile__title">Seals</span><span class="tile__sub">${save.seals.length}/${SEALS.length}</span><span class="tile__glyph ja" aria-hidden="true">印</span></button>
    </div>
  </section>`);

  el.addEventListener('click', (e) => {
    const go = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
    if (!go) return;
    e.stopPropagation();
    unlockAudio();
    if (go === 'journey') nav.game(journeyLevel(save.level));
    if (go === 'map') nav.map();
    if (go === 'daily') nav.game(dailyLevel(today));
    if (go === 'zen') nav.game(zenLevel(`zen-${Date.now()}`));
    if (go === 'album') nav.album();
    if (go === 'seals') nav.seals();
    if (go === 'settings') nav.settings();
  });
  return { name: 'home', el };
}
