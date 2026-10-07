import { sceneParticles, sceneSvg } from '../../art/scene';
import { GIFTS } from '../../config';
import { cardSvg } from '../../art/cards';
import { ads } from '../../services/ads';
import { music } from '../../services/music';
import { checkSeals } from '../../services/achievements';
import { cardDef, monthDef } from '../../data/deck';
import { LEVELS_PER_CHAPTER, chapterOf, dailyLevel, dailyTheme, localDateKey, rushLevel, zenLevel } from '../../engine/levels';
import { levelPlan } from '../../director';
import { formatTime } from '../../engine/session';
import { ROUTE_CHAPTERS, routeOf } from '../../data/route';
import { mechanicLabel, windArrow, windOf } from '../../engine/levels';
import { SEALS } from '../../services/achievements';
import { unlockAudio } from '../../services/audio';
import { claimGift, formatCountdown, lastWeek, levelsToLantern, liveStreak, msToNextDaily, pendingGift } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h, toast } from '../dom';
import { openSheet } from '../modal';
import { ICONS } from '../icons';
import { nav } from '../nav';
import { pathStrip } from './path';
import { GARDEN_ITEMS } from '../../art/garden';
import { hasAffordableNew, isOwned } from '../../services/market';

/** Last petal total shown on Home, to animate gains. */
let shownPetals: number | null = null;
/** Auto-open the gift once per app session. */
let giftShownThisSession = false;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function homeScreen(): Screen {
  const level = save.level;
  const chapter = chapterOf(level);
  const chapterIndex = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  const season = routeOf(level).chapter.season;
  const slot = (level - 1) % LEVELS_PER_CHAPTER;
  const chapterStart = chapterIndex * LEVELS_PER_CHAPTER + 1;
  // Twelve segments for the chapter; upcoming lantern levels carry a small gold mark.
  const dots = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
    const lantern = i >= slot && levelsToLantern(chapterStart + i) === 0;
    return `<span class="${i < slot ? 'done' : i === slot ? 'now' : ''}${lantern ? ' lan' : ''}"></span>`;
  }).join('');
  const spec = levelPlan(level).spec;
  music.setSeason(season);
  // Where the road has reached: the place, its season, and the board's twist.
  const road = routeOf(level);
  const wind = windOf(spec);
  const twist = `${mechanicLabel(spec)}${wind && wind !== 'down' ? ` ${windArrow(wind)}` : ''}`;
  const roadPlace = `<div class="journey__place"><b>${esc(road.chapter.en)}</b><span class="journey__place-native"><span lang="ko">${road.chapter.ko}</span> · <span class="ja" lang="${road.chapter.country === 'JP' ? 'ja' : 'ko'}">${road.chapter.ja}</span></span></div>`;
  const toLantern = levelsToLantern();
  const lanternText = toLantern === 0 ? 'This level hangs a lantern gift' : `Lantern gift in ${toLantern} level${toLantern > 1 ? 's' : ''}`;

  const today = localDateKey();
  const daily = dailyLevel(today);
  const theme = dailyTheme(today);
  const result = save.daily.results[today];
  const streak = liveStreak();
  const now = new Date();
  const days = lastWeek(now);
  const solvedThisWeek = days.filter((d) => d.solved).length;
  const week = days
    .map((d) => `<span class="wk${d.solved ? ' wk--on' : ''}${d.isToday ? ' wk--today' : ''}">${d.day}</span>`)
    .join('');
  const untilNext = msToNextDaily(now);
  const nextShort = untilNext >= 3600000 ? `${Math.floor(untilNext / 3600000)}h` : formatCountdown(untilNext);
  const dailyStatus = result ? `Solved in ${formatTime(result.ms)} · next in ${nextShort}` : 'One board for the whole world';
  const streakText = streak ? `${streak}-day streak` : result ? 'Streak started' : 'Start a streak';
  const dailyLabel = `Daily Jjak number ${daily.number}, ${theme.name}. ${dailyStatus}. ${streak ? `${streak}-day streak. ` : ''}${solvedThisWeek} of the last 7 days solved.${result ? '' : ' Play.'}`;

  const rushSub = save.rush.best ? `Best ${save.rush.best.toLocaleString('en-US')}` : '60 seconds';
  const tile = (go: string, title: string, sub: string, glyph: string, label: string, extra = '') =>
    `<button class="panel tile tile--${go}${extra}" data-go="${go}" aria-label="${esc(label)}">
      <span class="tile__glyph ja" aria-hidden="true">${glyph}</span>
      <span class="tile__text"><span class="tile__title">${title}</span><span class="tile__sub">${sub}</span></span>
    </button>`;

  const el = frag(`<section class="screen home">
    <header class="home__head">
      <span class="petals" role="img" aria-label="${save.petals} petals">${ICONS.petal}<span class="petals__n">${save.petals}</span></span>
      <span class="home__head-right">
        ${pendingGift() ? `<button class="icon-btn gift-btn" data-go="gift" aria-label="Daily gift ready">${ICONS.gift}<i aria-hidden="true"></i></button>` : ''}
        <button class="icon-btn" data-go="settings" aria-label="Settings">${ICONS.gear}</button>
      </span>
    </header>
    ${pathStrip()}
    <div class="scene" data-season="${season}">
      ${sceneSvg(season)}
      <div class="scene__particles" aria-hidden="true">${sceneParticles(season)}</div>
      <div class="scene__brand">
        <div class="seal" aria-hidden="true">짝</div>
        <h1 class="brand__word">Jjak</h1>
        <p class="brand__tag"><span class="brand__en">Pair the flowers of the four seasons</span><span class="brand__native" lang="ko"><span class="serif">꽃을 맞추다</span> · <span class="ja" lang="ja">花を合わせる</span></span></p>
      </div>
    </div>
    <div class="panel journey">
      <span class="journey__season ja" aria-hidden="true">${chapter.ja}</span>
      <div class="journey__top">
        <span class="eyebrow"><span class="journey__kicker">Journey · </span>${esc(chapter.name)} · ${road.year > 0 ? `Wanderer ${road.year}` : `Chapter ${road.index + 1}/${ROUTE_CHAPTERS}`}</span>
        <button class="chip-btn journey__map" data-go="map" aria-label="Journey map">${ICONS.map}<span>Map</span></button>
      </div>
      ${roadPlace}
      <div class="journey__title"><span>Level ${level}</span>${twist ? `<span class="journey__twist">${twist}</span>` : ''}</div>
      <div class="journey__progress">
        <span class="chapter-dots" role="progressbar" aria-label="${esc(chapter.name)} chapter" aria-valuemin="0" aria-valuemax="${LEVELS_PER_CHAPTER}" aria-valuenow="${slot}" aria-valuetext="Level ${slot + 1} of ${LEVELS_PER_CHAPTER} in ${esc(chapter.name)}">${dots}</span>
        <span class="journey__meta">
          <span class="journey__lantern${toLantern === 0 ? ' is-now' : ''}">${ICONS.lantern}${lanternText}</span>
          <span class="journey__count" aria-hidden="true">${slot + 1}<span class="muted">/${LEVELS_PER_CHAPTER}</span></span>
        </span>
      </div>
      <button class="btn btn--primary btn--block" data-go="journey">${level === 1 ? 'Begin' : 'Continue'} ${ICONS.play}</button>
    </div>
    <button class="panel daily${result ? ' is-done' : ''}" data-go="daily" aria-label="${esc(dailyLabel)}">
      <span class="daily__main">
        <span class="daily__cal" aria-hidden="true"><small>${MONTH_ABBR[now.getMonth()]}</small><b>${now.getDate()}</b></span>
        <span class="daily__body">
          <span class="daily__title">Daily <span class="daily__num">#${daily.number}</span></span>
          <span class="daily__theme">${esc(theme.name)}</span>
          <span class="daily__sub">${dailyStatus}</span>
        </span>
        <span class="daily__cta" aria-hidden="true">${result ? `${ICONS.check}Done` : 'Play'}</span>
      </span>
      <span class="daily__week" aria-hidden="true">
        <span class="week">${week}</span>
        <span class="daily__streak${streak ? ' is-on' : ''}">${streakText}</span>
      </span>
    </button>
    <nav class="tiles" aria-label="More ways to play">
      ${tile('rush', 'Rush', rushSub, '速', `Rush, ${rushSub}`)}
      ${tile('zen', 'Zen', 'No clock', '禅', 'Zen, untimed')}
      ${tile('album', 'Album', `${save.album.length}<span class="muted">/48</span>`, '札', `Album, ${save.album.length} of 48 cards`)}
      ${tile('seals', 'Seals', `${save.seals.length}<span class="muted">/${SEALS.length}</span>`, '印', `Seals, ${save.seals.length} of ${SEALS.length} earned`)}
      ${tile('market', 'Market', 'Spend petals', '市', `Market${hasAffordableNew() ? ', something new you can afford' : ''}`, hasAffordableNew() ? ' has-new' : '')}
      ${tile('garden', 'Garden', `${GARDEN_ITEMS.filter((g) => isOwned(`garden:${g.id}`)).length}<span class="muted">/${GARDEN_ITEMS.length}</span>`, '庭', `Garden, ${GARDEN_ITEMS.filter((g) => isOwned(`garden:${g.id}`)).length} of ${GARDEN_ITEMS.length} pieces`)}
    </nav>
  </section>`);

  el.addEventListener('click', (e) => {
    const go = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
    if (!go) return;
    e.stopPropagation();
    unlockAudio();
    if (go === 'journey') nav.journey(save.level);
    if (go === 'map') nav.map();
    if (go === 'daily') nav.game(dailyLevel(today));
    if (go === 'zen') nav.game(zenLevel(`zen-${Date.now()}`));
    if (go === 'rush') nav.game(rushLevel(`rush-${Date.now()}`, 0));
    if (go === 'gift') openGift(el);
    if (go === 'album') nav.album();
    if (go === 'seals') nav.seals();
    if (go === 'market') nav.market();
    if (go === 'garden') nav.garden();
    if (go === 'settings') nav.settings();
    if (go === 'path') nav.path();
  });
  if (pendingGift() && !giftShownThisSession) {
    giftShownThisSession = true;
    setTimeout(() => openGift(el), 650);
  }

  // Count up petals earned since the last visit.
  const pet = el.querySelector<HTMLElement>('.petals')!;
  const num = pet.querySelector<HTMLElement>('.petals__n')!;
  const from = shownPetals ?? save.petals;
  const to = save.petals;
  shownPetals = to;
  if (to > from) {
    const t0 = performance.now() + 350;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      num.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    num.textContent = String(from);
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
  const days = GIFTS.map((g, i) => {
    const state = i < p.day ? 'done' : i === p.day ? 'now' : 'next';
    const icon = g.card ? '<span class="ja">札</span>' : g.hints ? ICONS.hint : g.shuffles ? ICONS.shuffle : ICONS.petal;
    return `<li class="gday gday--${state}" aria-label="Day ${i + 1}: ${esc(g.label)}${state === 'done' ? ', claimed' : state === 'now' ? ', today' : ''}">
      <span class="gday__n">${state === 'now' ? 'Today' : `Day ${i + 1}`}</span>
      <span class="gday__icon" aria-hidden="true">${state === 'done' ? ICONS.check : icon}</span>
      <span class="gday__label">${esc(g.label)}</span>
    </li>`;
  }).join('');
  const content = frag(`<div class="gift">
    <div class="sheet__head">
      <div class="detail__kind">Daily gift · <span lang="ko">선물</span> · <span class="ja" lang="ja">贈り物</span></div>
      <h2>${esc(p.gift.label)}</h2>
      <p class="muted">Come back each day for the next gift. Missing a day never resets your calendar.</p>
    </div>
    <ol class="gdays" aria-label="Seven-day gift calendar">${days}</ol>
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
      const c = frag(`<div class="detail"><div class="detail__card draw__card is-reveal">${cardSvg(card)}</div>
        <div class="detail__kind">New card · ${save.album.length}/48</div><h2>${esc(m.en)}${cardDef(card).kind === 'plain' ? '' : ` · ${esc(cardDef(card).en)}`}</h2>
        <p class="muted"><span class="serif" lang="ko">${m.ko}</span> ${esc(m.koRoman)} · <span class="ja" lang="ja">${m.ja}</span> ${esc(m.jaRoman)}</p></div>`);
      openSheet(c, { center: true, label: 'New card' });
    }
    const pet = home.querySelector('.petals');
    if (pet) {
      pet.setAttribute('aria-label', `${save.petals} petals`);
      const n = pet.querySelector('.petals__n');
      if (n) n.textContent = String(save.petals);
    }
    shownPetals = save.petals;
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
