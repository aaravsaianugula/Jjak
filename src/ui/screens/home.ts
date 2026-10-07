import { sceneParticles, sceneSvg } from '../../art/scene';
import { GIFTS } from '../../config';
import { cardSvg } from '../../art/cards';
import { ads } from '../../services/ads';
import { music } from '../../services/music';
import { checkSeals } from '../../services/achievements';
import { cardDef, monthDef } from '../../data/deck';
import { CHAPTERS, LEVELS_PER_CHAPTER, chapterOf, dailyLevel, dailyTheme, journeyLevel, localDateKey, rushLevel, zenLevel } from '../../engine/levels';
import { formatTime } from '../../engine/session';
import { SEALS } from '../../services/achievements';
import { unlockAudio } from '../../services/audio';
import { claimGift, formatCountdown, lastWeek, levelsToLantern, liveStreak, msToNextDaily, pendingGift } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h, toast } from '../dom';
import { openSheet } from '../modal';
import { ICONS } from '../icons';
import { nav } from '../nav';

/** Last petal total shown on Home, to animate gains. */
let shownPetals: number | null = null;
/** Auto-open the gift once per app session. */
let giftShownThisSession = false;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function homeScreen(): Screen {
  const level = save.level;
  const chapter = chapterOf(level);
  const chapterIndex = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  const slot = (level - 1) % LEVELS_PER_CHAPTER;
  const loop = Math.floor(chapterIndex / CHAPTERS.length);
  const dots = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => `<span class="${i < slot ? 'done' : i === slot ? 'now' : ''}"></span>`).join('');
  const spec = journeyLevel(level);
  music.setSeason(chapterIndex % 4);
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
      <span class="home__head-right">
        ${pendingGift() ? `<button class="icon-btn gift-btn" data-go="gift" aria-label="Daily gift">${ICONS.gift}<i></i></button>` : ''}
        <button class="icon-btn" data-go="settings" aria-label="Settings">${ICONS.gear}</button>
      </span>
    </header>
    <div class="scene" data-season="${chapterIndex % 4}">
      ${sceneSvg(chapterIndex % 4)}
      <div class="scene__particles" aria-hidden="true">${sceneParticles(chapterIndex % 4)}</div>
      <div class="scene__brand">
        <div class="seal" aria-hidden="true">짝</div>
        <div class="brand__word">Jjak</div>
        <div class="brand__tag">Pair the flowers of the four seasons<br><span class="serif">꽃을 맞추다</span> · <span class="ja">花を合わせる</span></div>
      </div>
    </div>
    <div class="panel journey">
      <span class="journey__season" aria-hidden="true">${chapter.ja}</span>
      <div class="journey__top">
        <span class="journey__label">Journey · ${esc(chapter.name)}${loop > 0 ? ` · Year ${loop + 1}` : ''}</span>
        <button class="journey__map" data-go="map">Map ›</button>
      </div>
      <span class="journey__title">Level ${level}${twist ? ` <span class="journey__twist">${twist}</span>` : ''}</span>
      <span class="chapter-dots" aria-hidden="true">${dots}</span>
      <span class="journey__lantern">${ICONS.lantern}${levelsToLantern() === 0 ? 'This level hangs a lantern gift' : `Lantern gift in ${levelsToLantern()} level${levelsToLantern() > 1 ? 's' : ''}`}</span>
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
      <button class="panel tile tile--rush" data-go="rush"><span class="tile__title">Rush</span><span class="tile__sub">${save.rush.best ? `Best ${save.rush.best.toLocaleString('en-US')}` : '60s score attack'}</span><span class="tile__glyph ja" aria-hidden="true">速</span></button>
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
    if (go === 'rush') nav.game(rushLevel(`rush-${Date.now()}`, 0));
    if (go === 'gift') openGift(el);
    if (go === 'album') nav.album();
    if (go === 'seals') nav.seals();
    if (go === 'settings') nav.settings();
  });
  if (pendingGift() && !giftShownThisSession) {
    giftShownThisSession = true;
    setTimeout(() => openGift(el), 650);
  }

  // Count up petals earned since the last visit.
  const pet = el.querySelector<HTMLElement>('.petals')!;
  const from = shownPetals ?? save.petals;
  const to = save.petals;
  shownPetals = to;
  if (to > from) {
    const icon = pet.innerHTML.slice(0, pet.innerHTML.indexOf('</svg>') + 6);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      pet.innerHTML = `${icon}${Math.round(from + (to - from) * (1 - (1 - k) ** 3))}`;
      if (k < 1) requestAnimationFrame(step);
    };
    pet.innerHTML = `${icon}${from}`;
    setTimeout(() => {
      pet.classList.add('is-bump');
      requestAnimationFrame(step);
    }, 350);
  }
  return { name: 'home', el };
}

/** Daily gift calendar: seven days, never resets, optional ×2 with a rewarded ad. */
function openGift(home: HTMLElement): void {
  const p = pendingGift();
  if (!p) return;
  const days = GIFTS.map(
    (g, i) => `<div class="gday ${i < p.day ? 'gday--done' : i === p.day ? 'gday--now' : ''}">
      <span class="gday__n">Day ${i + 1}</span>
      <span class="gday__icon">${g.card ? '<span class="ja">札</span>' : g.hints ? ICONS.hint : g.shuffles ? ICONS.shuffle : ICONS.petal}</span>
      <span class="gday__label">${esc(g.label)}</span>
    </div>`,
  ).join('');
  const content = frag(`<div>
    <div class="detail__kind">Daily gift · 선물 · <span class="ja">贈り物</span></div>
    <h2>${esc(p.gift.label)}</h2>
    <p class="muted">Come back each day for the next gift. Missing a day never resets your calendar.</p>
    <div class="gdays">${days}</div>
  </div>`);
  const actions = h('div', { class: 'sheet__actions' });
  content.append(actions);
  const sheet = openSheet(content, { label: 'Daily gift' });
  const done = (card: number | null, times: number) => {
    sheet.close();
    const won = checkSeals();
    toast(`Gift claimed${times > 1 ? ' ×2' : ''}${won.length ? ` · Seal earned: ${won[0].title}` : ''}`);
    home.querySelector('.gift-btn')?.remove();
    if (card != null) {
      const m = monthDef(card);
      const c = frag(`<div class="detail"><div class="detail__card draw__card is-reveal" style="width:140px;height:auto">${cardSvg(card)}</div>
        <div class="detail__kind">New card · ${save.album.length}/48</div><h2>${esc(m.en)}${cardDef(card).kind === 'plain' ? '' : ` · ${esc(cardDef(card).en)}`}</h2>
        <p class="muted"><span class="serif">${m.ko}</span> ${esc(m.koRoman)} · <span class="ja">${m.ja}</span> ${esc(m.jaRoman)}</p></div>`);
      openSheet(c, { center: true, label: 'New card' });
    }
    const pet = home.querySelector('.petals');
    if (pet) pet.innerHTML = `${ICONS.petal}${save.petals}`;
  };
  actions.append(h('button', { class: 'btn btn--primary btn--block', onclick: () => done(claimGift(1), 1) }, 'Claim'));
  if (ads.rewardedAvailable && !p.gift.card) {
    actions.append(
      h('button', {
        class: 'btn btn--ghost btn--block',
        html: `${ICONS.ad}<span>Claim ×2 · watch a short ad</span>`,
        onclick: async () => {
          if (await ads.rewarded()) done(claimGift(2), 2);
          else toast('The ad didn’t finish. You can still claim the normal gift.');
        },
      }),
    );
  }
}
