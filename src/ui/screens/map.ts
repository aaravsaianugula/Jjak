import { stampSvg, stampTilt, installStampDefs } from '../../art/stamp';
import {
  COUNTRY_NAMES,
  type Focus,
  ROUTE,
  ROUTE_CHAPTERS,
  ROUTE_LEVELS_PER_CHAPTER,
  SEASON_NAMES,
  chapterFirstLevel,
  festivalTitle,
  routeOf,
} from '../../data/route';
import { type LevelSpec, windOf } from '../../engine/levels';
import { levelPlan } from '../../director';
import { levelsToLantern, syncStamps } from '../../services/progress';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { flip, measure } from '../motion';
import { nav } from '../nav';

/** What each chapter features, for the open chapter's note. */
const FOCUS_NOTE: Record<Focus, { en: string; native: string; note: string }> = {
  basics: { en: 'The cards', native: '화투 · 花札', note: 'Learn the flowers, then four different cards to every one.' },
  stones: { en: 'Stones', native: '돌 · 石', note: 'Stones block paths. Route around them.' },
  leaves: { en: 'Falling leaves', native: '낙엽 · 落葉', note: 'After each pair, cards drop to fill the gaps.' },
  snow: { en: 'First snow', native: '첫눈 · 初雪', note: 'Some cards start under snow until a neighbour clears.' },
  lucky: { en: 'Lucky cards', native: '복 · 福', note: 'A bonus pair hides on these boards. Pair it for petals.' },
  knots: { en: 'Knots', native: '매듭 · 結び', note: 'A tied card can’t be picked until a card beside it clears.' },
  wind: { en: 'Wind', native: '바람 · 風', note: 'After each pair, cards drift sideways or up with the wind.' },
  gates: { en: 'Gates', native: '문 · 門', note: 'A gate opens when you pair the flower painted on it.' },
  fences: { en: 'Fences', native: '울타리 · 垣', note: 'Paths can’t cross the bamboo fences between cards.' },
  mix: { en: 'A mix', native: '섞기 · 混', note: 'Everything you’ve met so far, side by side.' },
};

/** One glyph per twist for the level grid, plus words for screen readers. */
function twistOf(spec: LevelSpec): { glyph: string; name: string } {
  const w = windOf(spec);
  if (w === 'down') return { glyph: '落', name: 'falling leaves' };
  if (w) return { glyph: '風', name: `wind ${w}` };
  if (spec.snow) return { glyph: '雪', name: 'first snow' };
  if (spec.knots) return { glyph: '結', name: 'knots' };
  if (spec.stones) return { glyph: '石', name: 'stones' };
  return { glyph: '', name: '' };
}

const YEAR_LABEL = (y: number) => (y === 0 ? 'The road' : `Wanderer ${y}`);

/**
 * The Flower Road: fifty places from Gyeongju to Okinawa, top to bottom. Each
 * stop shows its names, season, blossoms and passport stamp; tap an open one
 * to see its twelve levels and replay any of them.
 */
export function mapScreen(): Screen {
  syncStamps();
  installStampDefs();
  const unlocked = save.level;
  const here = routeOf(unlocked);
  const maxYear = here.year;
  let year = maxYear;
  let open: number | null = here.index;

  const journeyStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const stampCount = Object.keys(save.journey.stamps).length;

  const el = frag(`<section class="screen map road">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Flower Road</h1><span class="topbar__sub"><span lang="ko">꽃길</span> · <span class="ja" lang="ja">花の道</span></span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="scroll road__list screen__body">
      <div class="road__summary panel" role="group" aria-label="Journey so far">
        <div><b>${journeyStars}</b><span>Blossoms</span></div>
        <div><b>${stampCount}<small>/${ROUTE_CHAPTERS}</small></b><span>Stamps</span></div>
        <div><b>${unlocked}</b><span>Level</span></div>
      </div>
      ${
        maxYear > 0
          ? `<div class="road__years" role="tablist" aria-label="Journey year">${Array.from({ length: maxYear + 1 }, (_, y) => `<button role="tab" data-year="${y}" aria-selected="${y === year}">${YEAR_LABEL(y)}</button>`).join('')}</div>`
          : ''
      }
      <ol class="road__stops" aria-label="Chapters"></ol>
      <div class="road__legend" aria-label="Level key">
        <span><span class="ja" aria-hidden="true">石</span>Stones</span>
        <span><span class="ja" aria-hidden="true">落</span>Falling leaves</span>
        <span><span class="ja" aria-hidden="true">雪</span>First snow</span>
        <span><span class="ja" aria-hidden="true">結</span>Knots</span>
        <span><span class="ja" aria-hidden="true">風</span>Wind</span>
        <span><span class="ja lucky-key" aria-hidden="true">福</span>Lucky cards</span>
        <span>${ICONS.lantern}Lantern gift</span>
      </div>
      <p class="road__end">Past Okinawa the road begins again, as a Wanderer: the same fifty places, fuller boards.</p>
    </div>
  </section>`);
  const list = el.querySelector<HTMLElement>('.road__stops')!;

  const chapterStars = (first: number) => {
    let got = 0;
    for (let n = first; n < first + ROUTE_LEVELS_PER_CHAPTER; n++) got += save.stars[n] ?? 0;
    return got;
  };

  function levelGrid(first: number): string {
    let cells = '';
    for (let n = first; n < first + ROUTE_LEVELS_PER_CHAPTER; n++) {
      const stars = save.stars[n] ?? 0;
      const isLocked = n > unlocked;
      const spec = levelPlan(n).spec;
      const tw = twistOf(spec);
      const fest = !!spec.festival;
      const lantern = n >= unlocked && levelsToLantern(n) === 0;
      const extras = [tw.name, spec.lucky ? 'lucky cards' : '', fest ? 'festival board' : '', lantern ? 'lantern gift' : ''].filter(Boolean).join(', ');
      const label = `Level ${n}${n === unlocked ? ', next to play' : ''}${isLocked ? ', locked' : n < unlocked ? `, ${stars} of 3 blossoms` : ''}${extras ? `, ${extras}` : ''}`;
      cells += `<button class="lvl${n === unlocked ? ' lvl--now' : ''}${fest ? ' lvl--fest' : ''}" data-level="${n}" ${isLocked ? 'disabled' : ''} aria-label="${label}"${n === unlocked ? ' aria-current="step"' : ''}>
        <span class="lvl__n">${n}</span>
        <span class="lvl__stars" aria-hidden="true">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}"></i>`).join('')}</span>
        ${tw.glyph ? `<span class="lvl__twist ja" aria-hidden="true">${tw.glyph}</span>` : ''}
        ${lantern ? `<span class="lvl__lan" aria-hidden="true">${ICONS.lantern}</span>` : spec.lucky ? '<span class="lvl__luck ja" aria-hidden="true">福</span>' : ''}
      </button>`;
    }
    return cells;
  }

  function stopBody(i: number, first: number): string {
    const c = ROUTE[i];
    const focus = FOCUS_NOTE[year > 0 && c.focus === 'basics' ? 'mix' : c.focus];
    const stamp = save.journey.stamps[c.id];
    return `<div class="stop__body">
      <p class="stop__postcard">${esc(c.postcard)}</p>
      <p class="stop__focus"><b>${esc(focus.en)}</b> <span class="muted">${focus.native}</span> · ${esc(focus.note)}</p>
      <div class="lvl-grid">${levelGrid(first)}</div>
      <p class="stop__fest"><span class="ja" aria-hidden="true">祭</span><span>Level ${first + ROUTE_LEVELS_PER_CHAPTER - 1} is the <b>${esc(festivalTitle(c))}</b>${stamp ? '.' : ' · clear it for the passport stamp.'}</span></p>
    </div>`;
  }

  function render() {
    let html = '';
    const currentFirst = chapterFirstLevel(here.index, here.year);
    for (let i = 0; i < ROUTE_CHAPTERS; i++) {
      const c = ROUTE[i];
      const first = chapterFirstLevel(i, year);
      const locked = first > unlocked;
      const current = first === currentFirst;
      const done = first + ROUTE_LEVELS_PER_CHAPTER - 1 < unlocked;
      const got = chapterStars(first);
      const max = ROUTE_LEVELS_PER_CHAPTER * 3;
      const stamp = save.journey.stamps[c.id] ?? null;
      const season = SEASON_NAMES[c.season];
      const country = COUNTRY_NAMES[c.country];
      const isOpen = open === i && !locked;
      const label = `Chapter ${i + 1}, ${c.en}, ${country.en}, ${season.en.toLowerCase()}. ${locked ? 'Locked.' : `${got} of ${max} blossoms.`}${stamp ? ' Passport stamp earned.' : ''}${current ? ' You are here.' : ''}`;
      html += `<li class="stop${locked ? ' is-locked' : ''}${current ? ' is-here' : ''}${done ? ' is-done' : ''}${isOpen ? ' is-open' : ''}" data-ch="${i}" data-season="${c.season}" style="--acc:${c.accent}">
        <div class="stop__rail" aria-hidden="true">
          <svg class="stop__road" viewBox="0 0 40 100" preserveAspectRatio="none"><path d="${i % 2 ? 'M20 0C31 30 9 64 20 100' : 'M20 0C9 30 31 64 20 100'}" vector-effect="non-scaling-stroke"/></svg>
          <span class="stop__node">${current ? '' : i + 1}</span>
        </div>
        <div class="stop__card">
          <button class="stop__head" data-open="${i}" ${locked ? 'disabled' : ''} aria-expanded="${isOpen}" aria-label="${esc(label)}">
            <span class="stop__text">
              <span class="stop__kicker">${i + 1} · ${esc(country.en)} · <span class="ja">${season.ja}</span> ${esc(season.en)}</span>
              <span class="stop__name">${esc(c.en)}</span>
              <span class="stop__native"><span lang="ko">${c.ko}</span> · <span class="ja" lang="${c.country === 'JP' ? 'ja' : 'ko'}">${c.ja}</span></span>
              <span class="stop__count">${ICONS.blossom}<span>${got}<span class="muted">/${max}</span></span><span class="meter"><i style="width:${Math.round((got / max) * 100)}%"></i></span></span>
            </span>
            <span class="stop__stamp${stamp ? ' is-earned' : ''}" style="--tilt:${stampTilt(i)}deg">${stampSvg(c, i, stamp)}</span>
          </button>
          ${isOpen ? stopBody(i, first) : ''}
        </div>
      </li>`;
    }
    list.innerHTML = html;
  }

  function toggle(i: number) {
    const was = open;
    open = open === i ? null : i;
    // FLIP: the stops below the change glide to their new places (transforms
    // only) while the opened chapter's levels fade in under them.
    const from = Math.min(...[was, open].filter((k): k is number => k != null));
    const sc = el.querySelector<HTMLElement>('.road__list')!;
    const view = sc.getBoundingClientRect();
    const below = [...list.querySelectorAll<HTMLElement>('.stop')].filter((li) => {
      if (Number(li.dataset.ch) <= from) return false;
      const r = li.getBoundingClientRect();
      return r.top < view.bottom + 400 && r.bottom > view.top - 400;
    });
    const before = measure(below);
    for (const k of [was, open]) {
      if (k == null) continue;
      const li = list.querySelector<HTMLElement>(`.stop[data-ch="${k}"]`);
      if (!li) continue;
      const on = k === open;
      li.classList.toggle('is-open', on);
      li.querySelector('.stop__head')?.setAttribute('aria-expanded', String(on));
      li.querySelector('.stop__body')?.remove();
      if (on) {
        li.querySelector('.stop__card')!.insertAdjacentHTML('beforeend', stopBody(k, chapterFirstLevel(k, year)));
        const body = li.querySelector<HTMLElement>('.stop__body')!;
        body.classList.add('is-in');
        // Keep the opened stop in view without jumping the page around.
        const r = li.getBoundingClientRect();
        const box = sc.getBoundingClientRect();
        if (r.bottom > box.bottom - 8) requestAnimationFrame(() => sc.scrollBy({ top: Math.min(r.bottom - box.bottom + 16, r.top - box.top - 8), behavior: 'smooth' }));
      }
    }
    flip(before);
  }

  render();

  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());
  el.querySelector('.road__list')!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const lvl = t.closest<HTMLButtonElement>('[data-level]');
    if (lvl && !lvl.disabled) {
      nav.journey(Number(lvl.dataset.level));
      return;
    }
    const head = t.closest<HTMLButtonElement>('[data-open]');
    if (head && !head.disabled) {
      toggle(Number(head.dataset.open));
      return;
    }
    const tab = t.closest<HTMLElement>('[data-year]');
    if (tab) {
      year = Number(tab.dataset.year);
      open = year === maxYear ? here.index : null;
      el.querySelectorAll('[data-year]').forEach((b) => b.setAttribute('aria-selected', String(Number((b as HTMLElement).dataset.year) === year)));
      render();
    }
  });
  requestAnimationFrame(() => el.querySelector('.stop.is-here')?.scrollIntoView({ block: 'start' }));
  return { name: 'map', el };
}
