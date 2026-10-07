import { SEALS, checkSeals, sealDone } from '../../services/achievements';
import { formatTime } from '../../engine/session';
import { liveStreak } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, toast } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';

/** The seal book: achievements plus lifetime stats. */
export function sealsScreen(): Screen {
  // Award anything completed outside a board (e.g. from older saves).
  const fresh = checkSeals();
  if (fresh.length) setTimeout(() => toast(`Seal earned: ${fresh.map((f) => f.title).join(', ')}`), 300);
  const earned = SEALS.filter((s) => save.seals.includes(s.id)).length;
  const groups = [...new Set(SEALS.map((s) => s.group))];
  const stat = (v: string | number, k: string) => `<div><b>${v}</b><span>${k}</span></div>`;

  const list = groups
    .map((g) => {
      const items = SEALS.filter((s) => s.group === g)
        .map((s) => {
          const done = save.seals.includes(s.id) || sealDone(s);
          const [a, b] = s.progress();
          const pct = Math.min(100, Math.round((Math.min(a, b) / b) * 100));
          return `<li class="sealrow ${done ? 'is-done' : ''}">
            <span class="sealmark" aria-hidden="true">${done ? '印' : ''}</span>
            <span class="sealrow__body">
              <span class="sealrow__title">${esc(s.title)}${s.native ? ` <span class="muted serif">${s.native}</span>` : ''}</span>
              <span class="sealrow__desc">${esc(s.desc)}</span>
              ${done ? '' : `<span class="meter"><i style="width:${pct}%"></i></span>`}
            </span>
            <span class="sealrow__reward">${done ? 'Done' : `${Math.min(a, b)}/${b}`}<br><small>+${s.reward} ✿</small></span>
          </li>`;
        })
        .join('');
      return `<div class="section-label">${esc(g)}</div><ul class="list seallist">${items}</ul>`;
    })
    .join('');

  const el = frag(`<section class="screen">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title">Seals <span class="muted serif" style="font-weight:400">· 도장 · <span class="ja">印</span></span></div>
      <span class="album__count">${earned}/${SEALS.length}</span>
    </header>
    <div class="scroll" style="flex:1;margin:0 -16px;padding:4px 16px 24px">
      <div class="statline statline--card">
        ${stat(save.stats.pairs.toLocaleString('en-US'), 'Pairs')}
        ${stat(save.stats.clears, 'Boards')}
        ${stat(`×${save.stats.bestCombo}`, 'Best combo')}
      </div>
      <div class="statline statline--card">
        ${stat(Math.max(save.daily.best, liveStreak()), 'Best streak')}
        ${stat(save.stats.bestDailyMs ? formatTime(save.stats.bestDailyMs) : '—', 'Best daily')}
        ${stat(`${save.album.length}/48`, 'Album')}
      </div>
      ${list}
    </div>
  </section>`);
  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  return { name: 'seals', el };
}
