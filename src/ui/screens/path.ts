/**
 * Flower Path · 꽃길 · 花道: the rank road, daily missions + weekly chest, and
 * chapter star chests. Also exports the small pieces other screens mount:
 *   pathStrip()        Home strip (rank, title, XP, missions, ready dot)
 *   pathResult()       XP + rank bar + mission ticks on the result sheet
 *   rankUpMoment()     the rank-up dialog shown after the result sheet
 *   bundlesSection()   petal pouches + Supporter pack (mounted in the Market)
 */
import { Capacitor } from '@capacitor/core';
import { cardSvg } from '../../art/cards';
import { artInline } from '../../art/market-art';
import { pathArt } from '../../art/path-art';
import { IAP } from '../../config';
import { cardDef, monthDef } from '../../data/deck';
import {
  MAX_RANK, PATH_EXCLUSIVES, type RankTitle, type Reward, TITLES, WEEKLY, exclusiveName, isTitleRank, nextTitle, rankInfo, rankReward, titleFor,
} from '../../data/meta';
import { routeOf } from '../../data/route';
import { CHAPTERS, LEVELS_PER_CHAPTER, dailyLevel, localDateKey, rushLevel, zenLevel } from '../../engine/levels';
import {
  type BoardReport, type Granted, claimChest, claimMission, claimRank, claimWeekly, missions, missionsDone, pending, rank,
  ranksToClaim, rerollMission, starChests, weekly,
} from '../../services/meta';
import { formatCountdown, msToNextDaily } from '../../services/progress';
import { save } from '../../services/storage';
import { store } from '../../services/store';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { type Screen } from '../app';
import { esc, fmt, frag, h, toast, wait } from '../dom';
import { ICONS } from '../icons';
import { openSheet } from '../modal';
import { nav } from '../nav';
import { petalBump, reducedMotion, retrigger } from '../motion';

type Tab = 'path' | 'missions' | 'chests';

const TIER_LABEL = { 1: 'Light', 2: 'Steady', 3: 'Long' } as const;

/** The rank seal: a vermilion square with the rank number, like a dojang. */
const rankSeal = (r: number, cls = '') => `<span class="fp-seal ${cls}" aria-hidden="true"><b>${r}</b></span>`;

function chips(r: Reward): string {
  const out: string[] = [];
  const c = (cls: string, icon: string, text: string, label: string) =>
    `<span class="chip chip--${cls}" title="${esc(label)}">${icon}<span>${text}</span></span>`;
  if (r.xp) out.push(c('xp', '', `+${fmt(r.xp)} XP`, `${r.xp} XP`));
  if (r.petals) out.push(c('petals', ICONS.petal, String(r.petals), `${r.petals} petals`));
  if (r.tea) out.push(c('tea', pathArt('i-tea', 'chip__art'), 'Warm tea', 'Warm tea: keeps your Daily streak through a missed day'));
  if (r.foil) out.push(c('foil', '<i class="chip__foil" aria-hidden="true">金</i>', 'Gold leaf', 'A gold-leaf edition of a card in your album'));
  for (const k of r.items ?? []) out.push(c('ex', '<i class="chip__ex" aria-hidden="true">珍</i>', esc(exclusiveName(k)), `${exclusiveName(k)} (Flower Path exclusive)`));
  return out.join('');
}

const cardName = (id: number) => {
  const m = monthDef(id);
  const d = cardDef(id);
  return d.kind === 'plain' ? `${m.en}` : `${m.en} · ${d.en}`;
};

// ───────────────────────────── Home strip ─────────────────────────────

/** Slim Flower Path strip for Home (HTML; the button carries data-go="path"). */
export function pathStrip(): string {
  const r = rank();
  const t = titleFor(r.rank);
  const done = missionsDone();
  const p = pending();
  const pct = Math.round(r.pct * 100);
  const label = `Flower Path: rank ${r.rank}, ${t.en}. ${r.rank >= MAX_RANK ? 'Final rank.' : `${fmt(r.into)} of ${fmt(r.need)} XP to the next rank.`} Missions ${done} of 3 done.${p.total ? ' Rewards ready to claim.' : ''}`;
  return `<button class="fp-strip${p.total ? ' has-ready' : ''}" data-go="path" aria-label="${esc(label)}">
    ${rankSeal(r.rank, 'fp-seal--sm')}
    <span class="fp-strip__body" aria-hidden="true">
      <span class="fp-strip__title"><b>${esc(t.en)}</b><span class="fp-strip__native"><span lang="ko">${t.ko}</span> · <span class="ja" lang="ja">${t.ja}</span></span></span>
      <span class="fp-bar"><i style="width:${pct}%"></i></span>
    </span>
    <span class="fp-strip__missions" aria-hidden="true">${done >= 3 ? ICONS.check : '<i class="fp-strip__ring"></i>'}<b>${done}</b>/3</span>
    ${p.total ? '<i class="fp-strip__dot" aria-hidden="true"></i>' : ''}
  </button>`;
}

/** A bar's fill at `pct`: a full-width fill slid left, so it moves with a transform. */
const barAt = (pct: number) => `translateX(${((Math.max(pct, 0.04) - 1) * 100).toFixed(1)}%)`;
const BAR_EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)';

/**
 * Fill the Home strip's bar from `fromXp` to the XP now (rolling over on a
 * rank-up), sliding the fill with a transform. Nothing to do when no XP came in.
 */
export function fillStrip(strip: HTMLElement | null, fromXp: number, delay = 0): void {
  if (!strip || fromXp >= save.meta.xp || reducedMotion()) return;
  const bar = strip.querySelector<HTMLElement>('.fp-bar i');
  const seal = strip.querySelector<HTMLElement>('.fp-seal');
  if (!bar) return;
  const before = rankInfo(fromXp);
  const after = rank();
  const up = after.rank > before.rank;
  bar.style.width = '100%';
  bar.style.minWidth = '0';
  bar.style.transform = barAt(before.pct);
  if (up && seal) seal.querySelector('b')!.textContent = String(before.rank);
  const go = (pct: number, ms: number) => {
    bar.style.transition = `transform ${ms}ms ${BAR_EASE}`;
    bar.style.transform = barAt(pct);
  };
  setTimeout(() => {
    if (!bar.isConnected) return;
    if (!up) return go(after.pct, 900);
    go(1, 600);
    setTimeout(() => {
      bar.style.transition = 'none';
      bar.style.transform = barAt(0);
      if (seal) {
        seal.querySelector('b')!.textContent = String(after.rank);
        retrigger(seal, 'is-up');
      }
      void bar.offsetWidth;
      go(after.pct, 700);
    }, 640);
  }, delay);
}

// ───────────────────────────── Result sheet ─────────────────────────────

/** Flower Path block for the result sheet: XP gained, a filling rank bar, mission ticks. */
export function pathResult(rep: BoardReport, at = 0): HTMLElement {
  const rm = reducedMotion();
  const up = rep.after.rank > rep.before.rank;
  const el = frag(`<div class="fp-res" role="group" aria-label="Flower Path: plus ${rep.xp} XP, rank ${rep.after.rank}${up ? ', rank up' : ''}">
    <div class="fp-res__top">
      ${rankSeal(rep.before.rank, 'fp-seal--xs')}
      <span class="fp-res__name"><b>Flower Path</b><span class="muted" data-sub>${esc(titleFor(rep.before.rank).en)} · rank ${rep.before.rank}</span></span>
      <b class="fp-res__xp">+${fmt(rep.xp)} XP</b>
    </div>
    <span class="fp-bar fp-bar--lg"><i style="width:${Math.round((rm ? rep.after.pct : rep.before.pct) * 100)}%"></i></span>
  </div>`);
  if (rep.missions.length) {
    el.append(frag(`<ul class="fp-res__ticks">${rep.missions.map((m, i) => `<li style="--i:${i}">${ICONS.check}<span>Mission complete · ${esc(m)}</span></li>`).join('')}</ul>`));
  }
  if (rep.tea) {
    el.append(frag(`<p class="fp-res__tea">${pathArt('i-tea', 'chip__art')}<span>Warm tea kept your streak${rep.tea > 1 ? ` (${rep.tea} cups)` : ''}.</span></p>`));
  }
  if (rep.foil != null) {
    el.append(frag(`<div class="fp-res__foil"><span class="fp-res__card">${cardSvg(rep.foil, 'card-art', { foil: true })}</span><span><b>A gold-leaf card</b><br><span class="muted">${esc(cardName(rep.foil))} · now gilded in your Album</span></span></div>`));
  }
  if (rep.bonus.length) {
    el.append(frag(`<p class="fp-res__tea"><i class="chip__foil" aria-hidden="true">福</i><span>The two lucky cards are now in your Album.</span></p>`));
  }
  if (rm) {
    if (up) el.querySelector('.fp-seal b')!.textContent = String(rep.after.rank);
    return el;
  }
  // Fill: to the end of the rank (and roll over on a rank-up), then to where we are now.
  const bar = el.querySelector<HTMLElement>('.fp-bar i')!;
  const seal = el.querySelector<HTMLElement>('.fp-seal')!;
  const sub = el.querySelector<HTMLElement>('[data-sub]')!;
  bar.style.width = '100%';
  bar.style.minWidth = '0';
  bar.style.transform = barAt(rep.before.pct);
  const go = (pct: number, ms: number) => {
    bar.style.transition = `transform ${ms}ms ${BAR_EASE}`;
    bar.style.transform = barAt(pct);
  };
  setTimeout(() => {
    if (!up) return go(rep.after.pct, 900);
    go(1, 650);
    setTimeout(() => {
      bar.style.transition = 'none';
      bar.style.transform = barAt(0);
      seal.querySelector('b')!.textContent = String(rep.after.rank);
      seal.classList.add('is-up');
      sub.textContent = `${titleFor(rep.after.rank).en} · rank ${rep.after.rank}`;
      void bar.offsetWidth;
      go(rep.after.pct, 700);
    }, 700);
  }, at + 250);
  return el;
}

/** After the result sheet settles: a quiet rank-up moment with an optional claim. */
export function rankUpMoment(rep: BoardReport): void {
  const r = rep.after.rank;
  const t = titleFor(r);
  const newTitle = TITLES.some((x) => x.rank > rep.before.rank && x.rank <= r && x.rank > 1);
  const reward = rankReward(Math.max(1, save.meta.claimed) + 1);
  const content = frag(`<div class="fp-up">
    <div class="fp-up__stage fp-up__stage--rank">${rankSeal(r, 'fp-seal--xl fp-seal-settle')}${petalBurstHtml(6, RANK_UP_REACH)}</div>
    <div class="detail__kind">Rank up · <span lang="ko">승급</span> · <span class="ja" lang="ja">昇級</span></div>
    <h2>Rank ${r}${newTitle ? ` · ${esc(t.en)}` : ''}</h2>
    ${newTitle ? `<p class="fp-up__native"><span lang="ko" class="serif">${t.ko}</span> · <span class="ja" lang="ja">${t.ja}</span></p><p class="muted">${esc(t.line)}</p>` : '<p class="muted">A new step on the Flower Path.</p>'}
    ${ranksToClaim() ? `<div class="fp-up__reward"><span class="eyebrow">${ranksToClaim() > 1 ? `${ranksToClaim()} rewards waiting` : 'Reward waiting'}</span><div class="chips">${chips(reward)}</div></div>` : ''}
  </div>`);
  const actions = h('div', { class: 'sheet__actions' });
  content.append(actions);
  const sheet = openSheet(content, { center: true, label: `Rank ${r}` });
  // The stamp sounds as the seal meets the paper.
  if (!reducedMotion()) setTimeout(() => sfx.stamp(), RANK_UP_LAND_MS);
  haptic.success();
  if (ranksToClaim()) {
    actions.append(
      h('button', {
        class: 'btn btn--accent btn--block',
        onclick: () => {
          const claimed: RankClaimLite[] = [];
          while (ranksToClaim()) {
            const c = claimRank();
            if (!c) break;
            claimed.push(c);
          }
          sheet.close();
          announceClaims(claimed);
        },
      }, ranksToClaim() > 1 ? `Claim ${ranksToClaim()} rewards` : 'Claim reward'),
    );
  }
  actions.append(h('button', { class: 'btn btn--quiet btn--block', onclick: () => sheet.close() }, 'Later'));
}

type RankClaimLite = { rank: number; granted: Granted; title: RankTitle | null };

/** Sum up claimed ranks in a toast; titles and gold leaf get their own reveal. */
function announceClaims(list: RankClaimLite[]): void {
  if (!list.length) return;
  const sum = list.reduce(
    (a, c) => ({
      petals: a.petals + c.granted.petals,
      tea: a.tea + c.granted.tea,
      foil: [...a.foil, ...c.granted.foil],
      items: [...a.items, ...c.granted.items],
    }),
    { petals: 0, tea: 0, foil: [] as number[], items: [] as string[] },
  );
  const title = [...list].reverse().find((c) => c.title)?.title ?? null;
  if (title || sum.foil.length || sum.items.length) revealSheet(title, sum.foil, sum.items);
  const parts = [sum.petals && `+${sum.petals} petals`, sum.tea && 'Warm tea'].filter(Boolean);
  toast(`Rank ${list[list.length - 1].rank} claimed${parts.length ? ` · ${parts.join(' · ')}` : ''}`);
}

/** A title reveal, a gold-leaf card and/or an exclusive item, in one calm sheet. */
function revealSheet(title: RankTitle | null, foil: number[], items: string[]): void {
  const parts: string[] = [];
  if (title) {
    parts.push(`<div class="fp-reveal__title">
      <div class="fp-up__stage"><span class="seal fp-title-seal fp-stamp-in" aria-hidden="true">${title.glyph}</span>${petalBurstHtml(12)}</div>
      <div class="detail__kind">New title · <span lang="ko">새 칭호</span> · <span class="ja" lang="ja">新しい称号</span></div>
      <h2 class="fp-brush">${esc(title.en)}</h2>
      <p class="fp-up__native"><span lang="ko" class="serif">${title.ko}</span> · <span class="ja" lang="ja">${title.ja}</span></p>
      <p class="muted">${esc(title.line)}</p>
    </div>`);
  }
  if (foil.length) {
    parts.push(`<div class="fp-reveal__foil">${foil
      .slice(0, 3)
      .map((id, i) => `<span class="fp-reveal__card" style="--i:${i}">${cardSvg(id, 'card-art', { foil: true })}</span>`)
      .join('')}</div><p class="fp-reveal__cap"><b>Gold leaf</b> · ${foil.map((id) => esc(cardName(id))).join(', ')}<br><span class="muted">Gilded in your Album</span></p>`);
  }
  if (items.length) {
    parts.push(`<p class="fp-reveal__cap"><b>Flower Path exclusive</b><br>${items.map((k) => esc(exclusiveName(k))).join(' · ')}<br><span class="muted">Yours to equip in the Market</span></p>`);
  }
  const content = frag(`<div class="fp-reveal">${parts.join('')}</div>`);
  const actions = h('div', { class: 'sheet__actions' });
  content.append(actions);
  const sheet = openSheet(content, { center: true, label: title ? `New title: ${title.en}` : 'Reward' });
  if (!reducedMotion()) setTimeout(() => sfx.stamp(), 140);
  haptic.success();
  actions.append(h('button', { class: 'btn btn--primary btn--block', onclick: () => sheet.close() }, 'Lovely'));
}

/** The rank-up seal reaches the paper this long into its settle (meta.css fp-seal-settle). */
const RANK_UP_LAND_MS = 300;
/** The rank-up petals only drift a little way from the seal. */
const RANK_UP_REACH = 0.7;

const petalBurstHtml = (n: number, reach = 1) =>
  reducedMotion()
    ? ''
    : `<span class="fp-burst" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = (46 + Math.random() * 34) * reach;
        return `<i style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d - 18)}px;--r:${Math.round(Math.random() * 300 - 150)}deg;--d:${120 + Math.round(Math.random() * 160)}ms"></i>`;
      }).join('')}</span>`;

/**
 * A mission card turns over (a short tilt away and back, transform only):
 * `swap` changes it while it's edge-on and may return the card that replaces it.
 */
function turnOver(card: HTMLElement | null, swap: () => HTMLElement | null | void): void {
  if (!card || reducedMotion()) {
    swap();
    return;
  }
  card.classList.add('is-turning');
  setTimeout(() => {
    const next = swap() || card;
    next.classList.remove('is-turning');
    retrigger(next, 'is-turned');
  }, 170);
}

// ───────────────────────────── Screen ─────────────────────────────

let lastTab: Tab | null = null;

export function pathScreen(): Screen {
  const p0 = pending();
  let tab: Tab = lastTab ?? (p0.ranks ? 'path' : p0.missions || p0.weekly ? 'missions' : p0.chests ? 'chests' : 'path');
  lastTab = null;

  const el = frag(`<section class="screen fp">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Flower Path</h1><span class="topbar__sub"><span lang="ko">꽃길</span> · <span class="ja" lang="ja">花道</span></span></div>
      <span class="petals fp-petals" role="img" aria-label="${save.petals} petals">${ICONS.petal}<span class="petals__n">${save.petals}</span></span>
    </header>
    <div class="screen__body scroll fp__body">
      <div class="fp-hero-slot"></div>
      <div class="fp-tabs" role="tablist" aria-label="Flower Path sections"></div>
      <div class="fp-pane" role="tabpanel"></div>
    </div>
  </section>`);
  const body = el.querySelector<HTMLElement>('.fp__body')!;
  const heroSlot = el.querySelector<HTMLElement>('.fp-hero-slot')!;
  const tabsEl = el.querySelector<HTMLElement>('.fp-tabs')!;
  const pane = el.querySelector<HTMLElement>('.fp-pane')!;
  const petalsN = el.querySelector<HTMLElement>('.petals__n')!;

  let shownPetals = save.petals;
  const refreshPetals = () => {
    petalBump(petalsN.parentElement, shownPetals, save.petals);
    shownPetals = save.petals;
  };

  function renderHero() {
    const r = rank();
    const t = titleFor(r.rank);
    const nt = nextTitle(r.rank);
    const ready = ranksToClaim();
    heroSlot.innerHTML = `<div class="panel fp-hero">
      <span class="fp-hero__mark ja" aria-hidden="true">${t.glyph}</span>
      ${rankSeal(r.rank, 'fp-seal--lg')}
      <div class="fp-hero__body">
        <span class="eyebrow">Rank ${r.rank} of ${MAX_RANK}</span>
        <h2 class="fp-hero__title">${esc(t.en)}</h2>
        <span class="fp-hero__native"><span lang="ko" class="serif">${t.ko}</span> · <span class="ja" lang="ja">${t.ja}</span></span>
        ${
          r.rank >= MAX_RANK
            ? '<span class="fp-hero__xp">The end of the path. Thank you for walking it.</span>'
            : `<span class="fp-bar fp-bar--lg" role="progressbar" aria-label="XP to rank ${r.rank + 1}" aria-valuemin="0" aria-valuemax="${r.need}" aria-valuenow="${r.into}"><i style="width:${Math.round(r.pct * 100)}%"></i></span>
               <span class="fp-hero__xp"><b>${fmt(r.into)}</b> / ${fmt(r.need)} XP${nt ? ` · <span class="muted">${esc(nt.en)} at rank ${nt.rank}</span>` : ''}</span>`
        }
      </div>
      ${ready ? `<button class="btn btn--accent btn--block fp-hero__claim" data-claim-all>${ready > 1 ? `Claim ${ready} rank rewards` : `Claim rank ${Math.max(1, save.meta.claimed) + 1} reward`}</button>` : ''}
    </div>`;
  }

  function renderTabs() {
    const p = pending();
    const dot = (n: number) => (n ? '<i class="fp-tabs__dot" aria-hidden="true"></i>' : '');
    const b = (id: Tab, label: string, n: number) =>
      `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" aria-controls="fp-pane">${label}${dot(n)}${n ? `<span class="sr-only"> (${n} ready)</span>` : ''}</button>`;
    tabsEl.innerHTML = b('path', 'Path', p.ranks) + b('missions', 'Missions', p.missions + (p.weekly ? 1 : 0)) + b('chests', 'Star chests', p.chests);
  }

  function renderPane(keepScroll = false) {
    const top = body.scrollTop;
    pane.id = 'fp-pane';
    pane.innerHTML = '';
    pane.append(tab === 'path' ? roadPane() : tab === 'missions' ? missionsPane() : chestsPane());
    if (keepScroll) body.scrollTop = top;
  }

  function renderAll(keepScroll = true) {
    renderHero();
    renderTabs();
    renderPane(keepScroll);
  }

  // ── Rank road ──
  let showEarlier = false;
  function roadPane(): HTMLElement {
    const r = rank().rank;
    const claimed = Math.max(1, save.meta.claimed);
    const rows: string[] = [];
    // Claimed ranks before the current title fold into one quiet row.
    const foldTo = showEarlier ? 1 : Math.max(1, Math.floor(claimed / 10) * 10 - 1);
    if (foldTo >= 2) {
      rows.push(`<li class="road__fold"><button class="road__fold-btn" data-unfold>${ICONS.check}<span>Ranks 2–${foldTo} claimed</span><span class="road__fold-show">Show</span></button></li>`);
    }
    for (let k = Math.max(2, foldTo + 1); k <= MAX_RANK; k++) {
      const state = k <= claimed ? 'claimed' : k <= r ? 'ready' : k === r + 1 ? 'next' : 'locked';
      if (isTitleRank(k)) {
        const t = titleFor(k);
        rows.push(`<li class="road__title road__title--${k <= r ? 'on' : 'off'}">
          <span class="road__title-seal ja" aria-hidden="true">${t.glyph}</span>
          <span><span class="eyebrow">Title at rank ${k}</span><b>${esc(t.en)}</b> <span class="muted"><span lang="ko" class="serif">${t.ko}</span> · <span class="ja" lang="ja">${t.ja}</span></span></span>
        </li>`);
      }
      const ex = PATH_EXCLUSIVES[k];
      const action =
        state === 'claimed'
          ? `<span class="road__done" aria-label="Claimed">${ICONS.check}</span>`
          : state === 'ready'
            ? k === claimed + 1
              ? `<button class="btn btn--accent road__claim" data-claim="${k}">Claim</button>`
              : '<span class="road__ready">Ready</span>'
            : state === 'next'
              ? `<span class="road__next">${Math.round(rank().pct * 100)}%</span>`
              : '';
      rows.push(`<li class="road__step road__step--${state}${ex ? ' road__step--ex' : ''}${k % 10 === 0 ? ' road__step--ten' : ''}" data-rank="${k}"${state === 'next' ? ` style="--p:${Math.round(rank().pct * 100)}%"` : ''}>
        <span class="road__node" aria-hidden="true"><b>${k}</b></span>
        <span class="road__body">
          <span class="road__label">Rank ${k}${ex ? ' · <span class="road__exlabel">Flower Path exclusive</span>' : ''}</span>
          <span class="chips">${chips(rankReward(k))}</span>
        </span>
        <span class="road__act">${action}</span>
      </li>`);
    }
    const list = frag(`<ol class="road" aria-label="Ranks and rewards">${rows.join('')}</ol>`);
    return list;
  }

  async function claimOne(btn: HTMLElement | null): Promise<RankClaimLite | null> {
    const row = btn?.closest<HTMLElement>('.road__step') ?? pane.querySelector<HTMLElement>(`.road__step[data-rank="${Math.max(1, save.meta.claimed) + 1}"]`);
    const c = claimRank();
    if (!c) return null;
    sfx.stamp();
    haptic.medium();
    if (row && !reducedMotion()) {
      const node = row.querySelector<HTMLElement>('.road__node')!;
      node.insertAdjacentHTML('beforeend', `<span class="fp-seal fp-seal--node fp-stamp-in" aria-hidden="true"><b>${c.rank}</b></span><i class="fp-ring" aria-hidden="true"></i>${petalBurstHtml(8)}`);
      row.classList.add('is-claiming');
      if (!btn) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const act = row.querySelector('.road__act');
      if (act) act.innerHTML = `<span class="road__done">${ICONS.check}</span>`;
    }
    return c;
  }

  // ── Missions ──
  function missionsPane(): HTMLElement {
    const list = missions();
    const w = weekly();
    const wrap = h('div', { class: 'fp-missions' });
    const left = formatCountdown(msToNextDaily());
    wrap.append(frag(`<p class="fp-note">Three new missions every day · next in ${left}. Each can be swapped once.</p>`));
    const ul = h('ul', { class: 'mlist' });
    for (const m of list) {
      const s = m.state;
      const pct = Math.min(100, Math.round((s.n / m.target) * 100));
      const actions = s.claimed
        ? `<span class="mcard__claimed">${ICONS.check}Claimed</span>`
        : s.done
          ? `<button class="btn btn--accent mcard__claim" data-mclaim="${m.slot}">Claim</button>`
          : `${s.rerolled ? '' : `<button class="icon-btn mcard__reroll" data-reroll="${m.slot}" aria-label="Swap this mission for another (once today)">${ICONS.restart}</button>`}<button class="chip-btn mcard__go" data-mgo="${m.def.go}" data-mid="${m.def.id}">${ICONS.play}<span>Play</span></button>`;
      ul.append(
        frag(`<li class="panel mcard${s.done ? ' is-done' : ''}${s.claimed ? ' is-claimed' : ''}" data-slot="${m.slot}">
          <div class="mcard__top">
            <span class="mcard__badge">${pathArt(`m-${m.def.go}`, 'mcard__art')}<span class="tier" data-tier="${m.def.tier}" aria-label="${TIER_LABEL[m.def.tier]}"><i></i><i></i><i></i></span></span>
            <span class="mcard__text">${esc(m.text)}</span>
          </div>
          <div class="mcard__prog"><span class="fp-bar"><i style="width:${pct}%"></i></span><span class="mcard__n">${fmt(Math.min(s.n, m.target))}<span class="muted">/${fmt(m.target)}</span></span></div>
          <div class="mcard__foot">
            <span class="chips">${chips({ xp: m.reward.xp, petals: m.reward.petals })}</span>
            <span class="mcard__act">${actions}</span>
          </div>
        </li>`),
      );
    }
    wrap.append(ul);
    const pips = Array.from({ length: w.target }, (_, i) => `<i class="${i < w.count ? 'on' : ''}"></i>`).join('');
    const nextMonday = (() => {
      const d = new Date();
      const add = ((8 - d.getDay()) % 7) || 7;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
    })();
    const days = Math.max(1, Math.round((nextMonday.getTime() - Date.now()) / 86400000));
    wrap.append(
      frag(`<div class="panel wchest${w.ready ? ' is-ready' : ''}${w.claimed ? ' is-claimed' : ''}">
        <div class="wchest__head">
          <span class="wchest__icon" aria-hidden="true">${pathArt(w.claimed ? 'bandaji-open' : 'bandaji', 'wchest__art')}</span>
          <span class="wchest__titles"><b>Weekly chest</b><span class="muted"><span lang="ko">주간 상자</span> · <span class="ja" lang="ja">週の箱</span></span></span>
          <span class="wchest__count"><b>${w.count}</b>/${w.target}</span>
        </div>
        <div class="wchest__pips" role="progressbar" aria-label="Weekly chest" aria-valuemin="0" aria-valuemax="${w.target}" aria-valuenow="${w.count}">${pips}</div>
        <p class="wchest__note muted">${w.claimed ? `Opened. A new chest starts in ${days} day${days > 1 ? 's' : ''}.` : 'Fills a little with every mission you complete this week (Monday to Sunday).'}</p>
        <div class="wchest__foot"><span class="chips">${chips(WEEKLY.reward)}</span>${w.ready ? '<button class="btn btn--accent wchest__claim" data-wclaim>Open</button>' : ''}</div>
      </div>`),
    );
    return wrap;
  }

  // ── Star chests ──
  function chestsPane(): HTMLElement {
    const wrap = h('div', { class: 'fp-chests' });
    wrap.append(frag(`<p class="fp-note">Each chapter has 12 levels and 36 blossoms. Chests open at 12, 24 and 36. Replay levels on the map for blossoms you missed.</p>`));
    const ul = h('ul', { class: 'chaps' });
    for (const ch of starChests()) {
      const season = CHAPTERS[ch.chapter % CHAPTERS.length];
      const place = routeOf(ch.first).chapter;
      const last = ch.first + LEVELS_PER_CHAPTER - 1;
      const pct = Math.round((ch.stars / 36) * 100);
      const chestsHtml = ch.chests
        .map((c) => {
          const state = c.claimed ? 'claimed' : c.ready ? 'ready' : 'locked';
          const label = `${c.step} blossom chest: ${state === 'claimed' ? 'opened' : state === 'ready' ? 'ready to open' : `${ch.stars} of ${c.step}`}`;
          return `<button class="chest chest--${state}" data-chest="${ch.chapter}" data-step="${c.step}" aria-label="${esc(label)}"${state === 'ready' ? '' : ' aria-disabled="true"'}>
            <span class="chest__icon" aria-hidden="true">${pathArt(state === 'claimed' ? 'chest-empty' : 'chest', 'chest__art')}${state === 'claimed' ? `<i class="chest__done">${ICONS.check}</i>` : ''}</span>
            <span class="chest__step">${ICONS.blossom}${c.step}</span>
            <span class="chips chips--sm">${chips(c.reward)}</span>
            ${state === 'ready' ? '<span class="chest__open">Open</span>' : ''}
          </button>`;
        })
        .join('');
      ul.append(
        frag(`<li class="panel chap${ch.chests.some((c) => c.ready) ? ' is-ready' : ''}">
          <div class="chap__head">
            <span class="chap__season ja" aria-hidden="true">${season.ja}</span>
            <span class="chap__titles"><span class="eyebrow">${esc(season.name)} · Levels ${ch.first}–${last}</span><b>${esc(place.en)} <span class="muted">${esc(place.ko)} · ${esc(place.ja)}</span></b></span>
            <span class="chap__stars">${ICONS.blossom}<b>${ch.stars}</b><span class="muted">/36</span></span>
          </div>
          <div class="chap__track"><span class="fp-bar"><i style="width:${pct}%"></i></span><span class="chap__ticks" aria-hidden="true"><i style="left:33.33%"></i><i style="left:66.66%"></i></span></div>
          <div class="chap__chests">${chestsHtml}</div>
        </li>`),
      );
    }
    wrap.append(ul);
    return wrap;
  }

  // ── Events ──
  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  tabsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab as Tab;
    renderTabs();
    renderPane();
    body.scrollTop = 0;
    if (tab === 'path') scrollToCurrent(false);
  });
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const order: Tab[] = ['path', 'missions', 'chests'];
    tab = order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
    renderTabs();
    renderPane();
    tabsEl.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();
  });

  let busy = false;
  el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (busy) return;
    const claimBtn = t.closest<HTMLElement>('[data-claim]');
    const all = t.closest<HTMLElement>('[data-claim-all]');
    if (claimBtn || all) {
      busy = true;
      const got: RankClaimLite[] = [];
      if (all && tab !== 'path') {
        tab = 'path';
        renderTabs();
        renderPane();
        scrollToCurrent(false);
      }
      do {
        const c = await claimOne(all ? null : claimBtn);
        if (c) got.push(c);
        if (all && ranksToClaim()) await wait(reducedMotion() ? 0 : 260);
      } while (all && ranksToClaim());
      refreshPetals();
      renderHero();
      renderTabs();
      setTimeout(() => {
        renderPane(true);
        busy = false;
      }, reducedMotion() ? 0 : 700);
      announceClaims(got);
      return;
    }
    if (t.closest('[data-unfold]')) {
      showEarlier = true;
      renderPane(true);
      return;
    }
    const mclaim = t.closest<HTMLElement>('[data-mclaim]');
    if (mclaim) {
      const r = claimMission(Number(mclaim.dataset.mclaim));
      if (r) {
        sfx.stamp();
        haptic.medium();
        const card = mclaim.closest<HTMLElement>('.mcard');
        const settle = () => {
          card?.classList.add('is-claimed');
          mclaim.replaceWith(frag(`<span class="mcard__claimed">${ICONS.check}Claimed</span>`));
          if (card && !reducedMotion()) card.insertAdjacentHTML('beforeend', `<span class="mcard__stamp seal fp-stamp-in" aria-hidden="true">済</span>${petalBurstHtml(8)}`);
        };
        turnOver(card, settle);
        toast(`+${r.xp} XP${r.petals ? ` · +${r.petals} petals` : ''}`);
        refreshPetals();
        renderHero();
        renderTabs();
      }
      return;
    }
    const reroll = t.closest<HTMLElement>('[data-reroll]');
    if (reroll) {
      const slot = Number(reroll.dataset.reroll);
      if (rerollMission(slot)) {
        turnOver(reroll.closest<HTMLElement>('.mcard'), () => {
          renderPane(true);
          return pane.querySelector<HTMLElement>(`.mcard[data-slot="${slot}"]`);
        });
        toast('A new mission for today');
      } else toast('No other mission fits right now');
      return;
    }
    const mgo = t.closest<HTMLElement>('[data-mgo]');
    if (mgo) {
      const go = mgo.dataset.mgo;
      if (mgo.dataset.mid === 'improve1') return nav.map();
      if (go === 'daily') nav.game(dailyLevel(localDateKey()));
      else if (go === 'rush') nav.game(rushLevel(`rush-${Date.now()}`, 0));
      else if (go === 'zen') nav.game(zenLevel(`zen-${Date.now()}`));
      else nav.journey(save.level);
      return;
    }
    if (t.closest('[data-wclaim]')) {
      const g = claimWeekly();
      if (g) {
        sfx.stamp();
        haptic.success();
        refreshPetals();
        renderAll();
        pane.querySelector('.wchest')?.classList.add('is-opened');
        revealChest('Weekly chest', g, true);
      }
      return;
    }
    const chest = t.closest<HTMLElement>('[data-chest]');
    if (chest) {
      const g = claimChest(Number(chest.dataset.chest), Number(chest.dataset.step) as 12 | 24 | 36);
      if (!g) {
        const need = Number(chest.dataset.step);
        if (chest.classList.contains('chest--locked')) toast(`Collect ${need} blossoms in this chapter to open it`);
        return;
      }
      sfx.stamp();
      haptic.success();
      refreshPetals();
      renderAll();
      pane.querySelector(`[data-chest="${chest.dataset.chest}"][data-step="${chest.dataset.step}"]`)?.classList.add('is-opened');
      revealChest(`${chest.dataset.step}-blossom chest`, g);
    }
  });

  function scrollToCurrent(smooth: boolean) {
    requestAnimationFrame(() => {
      const target =
        pane.querySelector<HTMLElement>('.road__step--ready') ?? pane.querySelector<HTMLElement>('.road__step--next') ?? pane.querySelector<HTMLElement>('.road__step:last-child');
      if (!target) return;
      // Only scroll when the next step is out of sight, and then just enough to show it.
      const y = target.offsetTop + target.offsetHeight - body.clientHeight * 0.85;
      if (y > body.scrollTop) body.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  renderAll(false);
  if (tab === 'path') scrollToCurrent(false);
  return { name: 'path', el };
}

/** What came out of a chest. */
function revealChest(name: string, g: Granted, weekly = false): void {
  const reward: Reward = { xp: g.xp, petals: g.petals, tea: g.tea };
  const content = frag(`<div class="fp-reveal">
    <div class="fp-up__stage"><span class="fp-chest-big fp-rise-in${reducedMotion() ? ' is-still' : ''}" aria-hidden="true">${artInline(weekly ? 'bandaji-reveal' : 'chest-reveal', 'fp-chest-big__art')}</span>${petalBurstHtml(10)}</div>
    <div class="detail__kind">${esc(name)} · opened</div>
    <div class="chips chips--center">${chips(reward)}</div>
    ${
      g.foil.length
        ? `<div class="fp-reveal__foil">${g.foil.map((id) => `<span class="fp-reveal__card">${cardSvg(id, 'card-art', { foil: true })}</span>`).join('')}</div><p class="fp-reveal__cap"><b>Gold leaf</b> · ${g.foil.map((id) => esc(cardName(id))).join(', ')}<br><span class="muted">Gilded in your Album</span></p>`
        : ''
    }
  </div>`);
  const actions = h('div', { class: 'sheet__actions' });
  content.append(actions);
  const sheet = openSheet(content, { center: true, label: `${name} opened` });
  actions.append(h('button', { class: 'btn btn--primary btn--block', onclick: () => sheet.close() }, 'Lovely'));
}

// ───────────────────────────── Bundles (IAP) ─────────────────────────────

/**
 * Petal pouches and the Supporter pack, for the Market. Honest by design:
 * exactly what you get, Play's own price, no timers, no "discounts", no
 * random rewards. On the web it renders a disabled preview; on a device where
 * the products aren't set up in Play it removes itself.
 */
export function bundlesSection(): HTMLElement | null {
  const native = Capacitor.isNativePlatform();
  const el = h('section', { class: 'bundles', 'aria-labelledby': 'bundles-h' });

  const render = () => {
    const ready = native && store.extrasAvailable;
    const disabled = (id: string) => !ready || !store.has(id);
    const pouchArt = (n: number) =>
      `<span class="pouch__art" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="--i:${i}">${ICONS.petal}</i>`).join('')}</span>`;
    const owned = save.meta.supporter;
    el.innerHTML = `
      <h2 class="section-label" id="bundles-h">Support Jjak <span>Optional</span></h2>
      <div class="bundles__grid">
        ${IAP.pouches
          .map(
            (p, i) => `<div class="panel pouch">
              ${pouchArt(i + 1)}
              <span class="pouch__n"><b>${fmt(p.petals)}</b> petals</span>
              <span class="pouch__name">${esc(p.name)}</span>
              <button class="btn btn--ghost pouch__buy" data-pouch="${p.id}"${disabled(p.id) ? ' disabled' : ''} aria-label="Buy ${fmt(p.petals)} petals for ${esc(store.priceOf(p.id))}">${native ? esc(store.priceOf(p.id)) : 'On Android'}</button>
            </div>`,
          )
          .join('')}
      </div>
      <div class="panel supporter${owned ? ' is-owned' : ''}">
        <div class="supporter__head">
          <span class="seal supporter__seal" aria-hidden="true">援</span>
          <span><b class="supporter__title">Supporter pack</b><span class="muted supporter__native"><span lang="ko">후원</span> · <span class="ja" lang="ja">応援</span> · one-time purchase</span></span>
        </div>
        <ul class="supporter__list">
          <li>${ICONS.check}<span><b>No ads</b> between boards and no banners. Optional reward ads stay available.</span></li>
          <li>${ICONS.check}<span><b>${fmt(IAP.supporterPetals)} petals</b>, once.</span></li>
          <li>${ICONS.check}<span>The <b>Clouds</b> card back, only in this pack.</span></li>
          <li>${ICONS.check}<span>A <b>Supporter</b> seal in your seal book.</span></li>
        </ul>
        ${
          owned
            ? `<p class="supporter__owned">${ICONS.heart}<span>Thank you for supporting Jjak.</span></p>`
            : `<button class="btn btn--accent btn--block" data-supporter${disabled(IAP.supporter) ? ' disabled' : ''}>${native ? `Support Jjak · ${esc(store.priceOf(IAP.supporter))}` : 'Available in the Android app'}</button>`
        }
        ${save.adFree && !owned ? '<p class="muted supporter__fine">You already have Remove ads; the pack still adds the petals, the card back and the seal.</p>' : ''}
      </div>
      <p class="bundles__fine">${native ? 'Prices are set by Google Play in your currency.' : 'Purchases are available in the Android app.'} Everything in Jjak can also be earned by playing. Petals stay in your purse on this device and can’t be traded or cashed out. Purchases can be restored in Settings.</p>`;
  };

  el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const pouch = t.closest<HTMLButtonElement>('[data-pouch]');
    if (pouch && !pouch.disabled) {
      const p = IAP.pouches.find((x) => x.id === pouch.dataset.pouch)!;
      pouch.disabled = true;
      const res = await store.buyPouch(p.id);
      pouch.disabled = false;
      if (res === 'done') {
        toast(`+${fmt(p.petals)} petals. Thank you!`);
        document.dispatchEvent(new CustomEvent('jjak:petals'));
      } else if (res === 'pending') toast('Payment pending. Your petals arrive as soon as it completes.');
      return;
    }
    const sup = t.closest<HTMLButtonElement>('[data-supporter]');
    if (sup && !sup.disabled) {
      sup.disabled = true;
      const ok = await store.buySupporter();
      if (ok) {
        toast('Thank you for supporting Jjak!');
        document.dispatchEvent(new CustomEvent('jjak:petals'));
        render();
      } else sup.disabled = false;
    }
  });

  render();
  if (native) {
    void store.ready.then(() => {
      if (!store.extrasAvailable) el.remove();
      else render();
    });
  }
  return el;
}
