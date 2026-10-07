import { MONTH_TINTS, cardSvg } from '../../art/cards';
import { BONUS_IDS, BONUS_MONTH, KIND_LABEL, MONTHS, cardDef, monthDef } from '../../data/deck';
import { SEALS } from '../../services/achievements';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { openSheet } from '../modal';
import { nav } from '../nav';

const CARD_SETS = SEALS.filter((s) => s.cards);

export function albumScreen(): Screen {
  const owned = new Set(save.album);
  const fullMonths = MONTHS.filter((m) => [0, 1, 2, 3].every((v) => owned.has(m.index * 4 + v))).length;
  const setsDone = CARD_SETS.filter((s) => s.cards!.every((c) => owned.has(c))).length;
  const pct = Math.round((owned.size / 48) * 100);
  // Gold-leaf (foil) editions and the two lucky bonus cards (Flower Path).
  const foiled = new Set(save.meta.foil.filter((id) => owned.has(id)));

  const months = MONTHS.map((m) => {
    const have = [0, 1, 2, 3].filter((v) => owned.has(m.index * 4 + v)).length;
    const complete = have === 4;
    return `<section class="panel month${complete ? ' is-complete' : ''}" aria-labelledby="month-${m.index}">
      <div class="month__head">
        <span class="month__num" aria-hidden="true">${m.index + 1}</span>
        <span class="month__titles">
          <span class="month__name" id="month-${m.index}">${esc(m.en)}</span>
          <span class="month__langs"><span class="serif" lang="ko">${m.ko}</span> · <span class="ja" lang="ja">${m.ja}</span> · ${complete ? '<span class="month__unlock">Paper unlocked</span>' : `Month ${m.index + 1}`}</span>
        </span>
        <span class="month__progress" aria-label="${have} of 4 collected${complete ? ', complete' : ''}">
          <span class="pips" aria-hidden="true">${[0, 1, 2, 3].map((k) => `<i class="${k < have ? 'on' : ''}"></i>`).join('')}</span>${have}/4
        </span>
      </div>
      <div class="month__cards">${[0, 1, 2, 3]
        .map((v) => {
          const id = m.index * 4 + v;
          const d = cardDef(id);
          const has = owned.has(id);
          const name = d.kind === 'plain' ? `${m.en}, plain card` : `${m.en}, ${d.en}`;
          return `<button data-id="${id}" class="${has ? '' : 'locked'}${foiled.has(id) ? ' is-foil' : ''}" data-kind="${esc(KIND_LABEL[d.kind].en)}" aria-label="${esc(has ? `${name}${foiled.has(id) ? ', gold leaf' : ''}` : `Not yet collected: ${m.en} ${KIND_LABEL[d.kind].en.toLowerCase()} card`)}">${cardSvg(id, 'card-art', { foil: foiled.has(id) })}</button>`;
        })
        .join('')}</div>
    </section>`;
  }).join('');

  const el = frag(`<section class="screen album">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Album</h1><span class="topbar__sub"><span lang="ko">화투</span> · <span class="ja" lang="ja">花札</span></span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="album__list screen__body scroll">
      <div class="panel album-sum">
        <div class="album-sum__top">
          <div class="album-sum__count"><b>${owned.size}</b><span>of 48 cards</span></div>
          <div class="album-sum__facts">
            <span><b>${fullMonths}</b> of 12 flowers complete</span>
            <span><b>${setsDone}</b> of ${CARD_SETS.length} card sets</span>
            <span class="album-sum__foil">Gold leaf <b>${foiled.size}</b>/48</span>
          </div>
        </div>
        <span class="meter meter--accent" role="progressbar" aria-label="Album" aria-valuemin="0" aria-valuemax="48" aria-valuenow="${owned.size}"><i style="width:${pct}%"></i></span>
        <p class="album-sum__note">The same 48 cards are played in Korea as <b>Hwatu</b> and in Japan as <b>Hanafuda</b>. Clear new Journey levels and Dailies to collect them.</p>
      </div>
      ${months}
      ${bonusSection()}
    </div>
  </section>`);

  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  el.querySelector('.album__list')!.addEventListener('click', (e) => {
    const bonus = (e.target as HTMLElement).closest<HTMLElement>('[data-bonus]');
    if (bonus) return openBonus(Number(bonus.dataset.bonus));
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
  const koMonthNote = m.koMonth !== m.index + 1 ? ` · month ${m.koMonth} in Korea` : '';
  const title = d.kind === 'plain' ? m.en : d.en;
  const sub = d.kind === 'plain' ? `Plain card · Month ${m.index + 1}${koMonthNote}` : `${m.en} · Month ${m.index + 1}${koMonthNote}`;
  const special = d.glyph
    ? `<div class="special">
        <span class="special__glyph ja" aria-hidden="true">${d.glyph}</span>
        <span class="special__text"><b>${esc(d.en)}</b><span><span class="serif" lang="ko">${d.ko}</span> in Korean · <span class="ja" lang="ja">${d.ja}</span> in Japanese</span></span>
      </div>`
    : '';
  const stage = (ghost: boolean) =>
    `<div class="detail__stage" style="--tint:${MONTH_TINTS[m.index]}"><div class="detail__card${ghost ? ' is-ghost' : ''}">${cardSvg(id)}</div></div>`;
  const content = have
    ? frag(`<div class="detail">
        ${stage(false)}
        <div class="detail__kind">${esc(kind.en)} · <span lang="ko">${kind.ko}</span> · <span class="ja" lang="ja">${kind.ja}</span></div>
        <h2>${esc(title)}</h2>
        <div class="detail__sub">${esc(sub)}</div>
        <div class="langs">
          <div class="lang" lang="ko"><div class="lang__flag">Korean</div><div class="lang__word serif">${m.ko}</div><div class="lang__roman">${esc(m.koRoman)}</div></div>
          <div class="lang" lang="ja"><div class="lang__flag">Japanese</div><div class="lang__word ja">${m.ja}</div><div class="lang__roman"><span class="ja">${m.jaKana}</span> · ${esc(m.jaRoman)}</div></div>
        </div>
        ${special}
        <p class="detail__note">${esc(m.note)}</p>
        ${sets(id)}
      </div>`)
    : frag(`<div class="detail">
        ${stage(true)}
        <div class="detail__kind">${esc(kind.en)} · Not yet collected</div>
        <h2>${esc(m.en)}</h2>
        <div class="detail__sub">Month ${m.index + 1}${esc(koMonthNote)}</div>
        <p class="detail__note">Clear a new Journey level or today’s Daily to draw a card. This one belongs to <b>${esc(m.en)}</b>, <span class="serif" lang="ko">${m.ko}</span> · <span class="ja" lang="ja">${m.ja}</span>.</p>
        ${sets(id)}
      </div>`);
  if (have && save.meta.foil.includes(id)) addFoilToggle(content, id);
  openSheet(content, { label: have ? `${title}, ${m.en}` : `${m.en}, not yet collected`, close: true });
}

/** Card detail: switch between the printed card and its gold-leaf edition. */
function addFoilToggle(content: HTMLElement, id: number) {
  const card = content.querySelector<HTMLElement>('.detail__card');
  if (!card) return;
  const seg = frag(`<div class="foil-toggle" role="group" aria-label="Edition">
    <div class="seg"><button aria-pressed="false" data-ed="plain">Printed</button><button aria-pressed="true" data-ed="foil">Gold leaf <span class="ja" aria-hidden="true">金</span></button></div>
  </div>`);
  const set = (foil: boolean) => {
    card.innerHTML = cardSvg(id, 'card-art', { foil });
    card.classList.toggle('is-foil', foil);
    seg.querySelectorAll<HTMLElement>('[data-ed]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.ed === 'foil') === foil)));
  };
  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ed]');
    if (b) set(b.dataset.ed === 'foil');
  });
  card.closest('.detail__stage')?.after(seg);
  set(true);
}

/** The two lucky bonus cards (보너스패): collected the first time you pair them. Not part of the 48. */
function bonusSection(): string {
  const have = new Set(save.meta.bonus);
  const n = BONUS_IDS.filter((id) => have.has(id)).length;
  return `<section class="panel month month--bonus${n === BONUS_IDS.length ? ' is-complete' : ''}" aria-labelledby="month-bonus">
    <div class="month__head">
      <span class="month__num" aria-hidden="true">福</span>
      <span class="month__titles">
        <span class="month__name" id="month-bonus">Bonus</span>
        <span class="month__langs"><span class="serif" lang="ko">${BONUS_MONTH.ko}패</span> · <span class="ja" lang="ja">${BONUS_MONTH.ja}</span> · Lucky cards</span>
      </span>
      <span class="month__progress" aria-label="${n} of 2 collected">${n}/2</span>
    </div>
    <div class="month__cards month__cards--bonus">${BONUS_IDS.map((id) => {
      const ok = have.has(id);
      return `<button data-bonus="${id}" class="${ok ? '' : 'locked'}" aria-label="${ok ? esc(cardDef(id).en) : 'Lucky card, not yet found'}">${cardSvg(ok ? id : 'back')}</button>`;
    }).join('')}<p class="month__bonus-note">${n ? 'Pair the lucky cards on the Journey road for a small gift.' : 'Two lucky cards hide on later Journey boards. Pair them to keep them here.'}</p></div>
  </section>`;
}

function openBonus(id: number) {
  const have = save.meta.bonus.includes(id);
  const d = cardDef(id);
  const content = frag(`<div class="detail">
    <div class="detail__stage" style="--tint:#c9a24a"><div class="detail__card${have ? '' : ' is-ghost'}">${cardSvg(have ? id : 'back')}</div></div>
    <div class="detail__kind">Bonus card · <span lang="ko">보너스패</span> · <span class="ja" lang="ja">${BONUS_MONTH.ja}</span></div>
    <h2>${have ? esc(d.en) : 'A lucky card'}</h2>
    <div class="detail__sub">${have ? `<span class="serif" lang="ko">${d.ko ?? ''}</span> · not part of the 48` : 'Not yet found'}</div>
    <p class="detail__note">${esc(BONUS_MONTH.note)}</p>
  </div>`);
  openSheet(content, { label: have ? d.en : 'Lucky card, not yet found', close: true });
}

/** Card-set seals this card belongs to (Go-Stop / Koi-Koi yaku). */
function sets(id: number): string {
  const mine = CARD_SETS.filter((s) => s.cards!.includes(id));
  if (!mine.length) return '';
  return `<div class="sets-block"><span class="eyebrow">Part of ${mine.length > 1 ? 'these card sets' : 'a card set'}</span><div class="sets">${mine
    .map((s) => {
      const have = s.cards!.filter((c) => save.album.includes(c)).length;
      const done = have === s.cards!.length;
      return `<span class="set ${done ? 'set--done' : ''}">${done ? ICONS.check : ''}${esc(s.title)}${s.native ? ` · <span class="serif">${s.native}</span>` : ''} <b>${have}/${s.cards!.length}</b></span>`;
    })
    .join('')}</div></div>`;
}
