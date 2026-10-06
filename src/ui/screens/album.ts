import { cardSvg } from '../../art/cards';
import { KIND_LABEL, MONTHS, cardDef, monthDef } from '../../data/deck';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { openSheet } from '../modal';
import { nav } from '../nav';

export function albumScreen(): Screen {
  const owned = new Set(save.album);
  const months = MONTHS.map(
    (m) => `<section class="month">
      <div class="month__head">
        <span class="month__num">${m.index + 1}</span>
        <span class="month__name">${esc(m.en)}</span>
        <span class="month__langs"><span class="serif">${m.ko}</span> · <span class="ja">${m.ja}</span></span>
      </div>
      <div class="month__cards">${[0, 1, 2, 3]
        .map((v) => {
          const id = m.index * 4 + v;
          const have = owned.has(id);
          return `<button data-id="${id}" class="${have ? '' : 'locked'}" aria-label="${have ? esc(`${m.en} ${cardDef(id).en}`) : 'Locked card'}">${cardSvg(have ? id : 'back')}</button>`;
        })
        .join('')}</div>
    </section>`,
  ).join('');

  const el = frag(`<section class="screen">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title">Album <span class="muted serif" style="font-weight:400">· 화투 · <span class="ja">花札</span></span></div>
      <span class="album__count">${owned.size}/48</span>
    </header>
    <p class="muted" style="margin:4px 4px 0;font-size:14px">The same 48 cards are played in Korea as <b>Hwatu</b> and in Japan as <b>Hanafuda</b>. Clear Journey levels and Dailies to collect them.</p>
    <div class="album__list scroll">${months}</div>
  </section>`);

  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  el.querySelector('.album__list')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    openDetail(id, owned.has(id));
  });
  return { name: 'album', el };
}

function openDetail(id: number, have: boolean) {
  const m = monthDef(id);
  const d = cardDef(id);
  const kind = KIND_LABEL[d.kind];
  const koMonthNote = m.koMonth !== m.index + 1 ? ` (month ${m.koMonth} in Korea)` : '';
  const special = d.glyph
    ? `<p style="margin-top:12px"><b>${esc(d.en)}</b> · <span class="serif">${d.ko}</span> · <span class="ja">${d.glyph} ${d.ja}</span></p>`
    : '';
  const content = have
    ? frag(`<div class="detail">
        <div class="detail__card">${cardSvg(id)}</div>
        <div class="detail__kind">${esc(kind.en)} · ${kind.ko} · <span class="ja">${kind.ja}</span></div>
        <h2>${esc(m.en)}</h2>
        <div class="muted">Month ${m.index + 1}${esc(koMonthNote)}</div>
        <div class="langs">
          <div class="lang"><div class="lang__flag">Korean</div><div class="lang__word serif">${m.ko}</div><div class="lang__roman">${esc(m.koRoman)}</div></div>
          <div class="lang"><div class="lang__flag">Japanese</div><div class="lang__word ja">${m.ja}</div><div class="lang__roman"><span class="ja">${m.jaKana}</span> · ${esc(m.jaRoman)}</div></div>
        </div>
        ${special}
        <p class="detail__note">${esc(m.note)}</p>
      </div>`)
    : frag(`<div class="detail">
        <div class="detail__card">${cardSvg('back')}</div>
        <h2>Not yet collected</h2>
        <p class="muted">Clear a new Journey level or today’s Daily to draw a card. This one belongs to <b>${esc(m.en)}</b> — month ${m.index + 1}.</p>
      </div>`);
  openSheet(content, { label: m.en });
}
