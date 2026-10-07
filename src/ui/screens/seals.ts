import { SEALS, checkSeals, sealDone } from '../../services/achievements';
import { formatTime } from '../../engine/session';
import { liveStreak } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, toast } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';

/** One carved character per seal, as on a real dojang. */
const GLYPH: Record<string, string> = {
  first: '初', pairs500: '対', pairs2000: '千', combo3: '拍', combo5: '響', clean10: '素', fast25: '速', fever: '満',
  rush5k: '疾', rush15k: '雷', yaku1: '役', yaku5: '集', zen10: '禅',
  spring: '春', summer: '夏', autumn: '秋', winter: '冬', stars100: '百', perfect12: '極',
  daily1: '朝', streak3: '三', streak7: '週', streak30: '月',
  month: '花', hongdan: '赤', cheongdan: '青', chodan: '草', godori: '鳥', inoshikacho: '猪', tsukimi: '見', hanami: '桜', ogwang: '光', album48: '札',
};

/** The seal book: achievements plus lifetime stats. */
export function sealsScreen(): Screen {
  // Award anything completed outside a board (e.g. from older saves).
  const fresh = checkSeals();
  if (fresh.length) setTimeout(() => toast(`Seal earned: ${fresh.map((f) => f.title).join(', ')}`), 300);
  const earnedSeals = SEALS.filter((s) => save.seals.includes(s.id));
  const earned = earnedSeals.length;
  const fromSeals = earnedSeals.reduce((a, s) => a + s.reward, 0);
  const groups = [...new Set(SEALS.map((s) => s.group))];
  const stat = (v: string | number, k: string) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`;

  const list = groups
    .map((g) => {
      const inGroup = SEALS.filter((s) => s.group === g);
      const doneCount = inGroup.filter((s) => save.seals.includes(s.id) || sealDone(s)).length;
      const items = inGroup
        .map((s) => {
          const i = SEALS.indexOf(s);
          const done = save.seals.includes(s.id) || sealDone(s);
          const [a, b] = s.progress();
          const cur = Math.min(a, b);
          const pct = Math.min(100, Math.round((cur / b) * 100));
          const rot = ((i * 37) % 11) - 7;
          const label = `${s.title}. ${s.desc} ${done ? 'Earned' : `${cur.toLocaleString('en-US')} of ${b.toLocaleString('en-US')}`}. Reward ${s.reward} petals.`;
          return `<li class="sealrow ${done ? 'is-done' : ''}" aria-label="${esc(label)}">
            <span class="sealmark" style="--rot:${rot}deg" aria-hidden="true">${GLYPH[s.id] ?? '印'}</span>
            <span class="sealrow__body" aria-hidden="true">
              <span class="sealrow__title">${esc(s.title)}${s.native ? `<span class="sealrow__native">${s.native}</span>` : ''}</span>
              <span class="sealrow__desc">${esc(s.desc)}</span>
              ${done ? '' : `<span class="sealrow__prog"><span class="meter"><i style="width:${pct}%"></i></span><span class="sealrow__count">${cur.toLocaleString('en-US')}/${b.toLocaleString('en-US')}</span></span>`}
            </span>
            <span class="sealrow__reward" aria-hidden="true">${done ? ICONS.check : ICONS.petal}+${s.reward}</span>
          </li>`;
        })
        .join('');
      return `<h2 class="section-label">${esc(g)} <span>${doneCount}/${inGroup.length}</span></h2><ul class="list seallist">${items}</ul>`;
    })
    .join('');

  const el = frag(`<section class="screen seals">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Seal book</h1><span class="topbar__sub"><span lang="ko">도장</span> · <span class="ja" lang="ja">印</span></span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="screen__body scroll">
      <div class="panel sealbook-hero">
        <span class="seal" aria-hidden="true">印</span>
        <div class="sealbook-hero__body">
          <div class="sealbook-hero__count"><b>${earned}</b> of ${SEALS.length} seals</div>
          <span class="meter meter--accent" role="progressbar" aria-label="Seals earned" aria-valuemin="0" aria-valuemax="${SEALS.length}" aria-valuenow="${earned}"><i style="width:${Math.round((earned / SEALS.length) * 100)}%"></i></span>
          <div class="sealbook-hero__sub">${fromSeals ? `${fromSeals.toLocaleString('en-US')} petals earned from seals` : 'Each seal adds petals to your purse'}</div>
        </div>
      </div>
      <div class="panel stats" role="group" aria-label="Lifetime stats">
        ${stat(save.stats.pairs.toLocaleString('en-US'), 'Pairs')}
        ${stat(save.stats.clears, 'Boards')}
        ${stat(`×${save.stats.bestCombo}`, 'Best combo')}
        ${stat(Math.max(save.daily.best, liveStreak()), 'Best streak')}
        ${stat(save.stats.bestDailyMs ? formatTime(save.stats.bestDailyMs) : '—', 'Best daily')}
        ${stat(save.rush.best ? save.rush.best.toLocaleString('en-US') : '—', 'Rush best')}
      </div>
      ${list}
    </div>
  </section>`);
  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  return { name: 'seals', el };
}
