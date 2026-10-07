/**
 * Garden · 정원 · 庭 — the courtyard where Market garden pieces live.
 * Large scene on top (season chips + day/night preview), a daily visitor with a
 * small gift and a verse, and the collection of all 24 pieces below.
 */
import {
  GARDEN_ITEMS,
  GARDEN_VISITORS,
  type GardenItem,
  gardenItemSvg,
  gardenSvg,
  gardenVisitorSvg,
  isNightNow,
  placedItems,
  seasonOf,
} from '../../art/garden';
import { audioReady, sfx, unlockAudio } from '../../services/audio';
import { claimVisit, isHidden, isOwned, ownedPieces, setHidden, shownPieces, takeNewPieces, todaysVisit, VISITOR_LINES } from '../../services/garden';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h, toast } from '../dom';
import { ICONS } from '../icons';
import { openSheet } from '../modal';
import { petalBump } from '../motion';
import { nav } from '../nav';

const SEASONS = [
  { en: 'Spring', ja: '春' },
  { en: 'Summer', ja: '夏' },
  { en: 'Autumn', ja: '秋' },
  { en: 'Winter', ja: '冬' },
];

/** When the fountain's rocker strikes the stone in its 6 s loop (keyframe 88.9% of ga-tip). */
const FOUNTAIN_STRIKE_MS = 5333;

/** Pieces granted by the Flower Path rather than sold for petals. */
const PATH_RANK: Record<string, number> = { crane: 55 };

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>';

const item = (id: string): GardenItem | undefined => GARDEN_ITEMS.find((i) => i.id === id);

export function gardenScreen(): Screen {
  const realSeason = seasonOf();
  let season = realSeason;
  let night = isNightNow();
  const total = GARDEN_ITEMS.length;

  const el = frag(`<section class="screen garden">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Garden</h1><span class="topbar__sub"><span lang="ko">정원</span> · <span class="ja" lang="ja">庭</span></span></div>
      <span class="petals gd-petals" role="img" aria-label="${save.petals} petals">${ICONS.petal}<span class="petals__n">${save.petals}</span></span>
    </header>
    <div class="screen__body scroll gd-body">
      <div class="gd-stage">
        <div class="gd-scene" data-season="${season}"></div>
      </div>
      <div class="gd-controls">
        <div class="seg gd-seasons" role="group" aria-label="Preview a season">
          ${SEASONS.map((s, i) => `<button data-season="${i}" aria-pressed="${i === season}" aria-label="${s.en}${i === realSeason ? ' (now)' : ''}"><span class="ja" aria-hidden="true">${s.ja}</span><span class="gd-seasons__en">${s.en}</span>${i === realSeason ? '<i class="gd-now" aria-hidden="true"></i>' : ''}</button>`).join('')}
        </div>
        <button class="gd-time" data-time aria-pressed="${night}" aria-label="Night">${night ? MOON : SUN}</button>
      </div>
      <div class="gd-info"></div>
      <h2 class="section-label">Pieces <span class="gd-count"></span></h2>
      <ul class="gd-pieces" aria-label="Garden pieces"></ul>
    </div>
  </section>`);

  const sceneEl = el.querySelector<HTMLElement>('.gd-scene')!;
  const info = el.querySelector<HTMLElement>('.gd-info')!;
  const grid = el.querySelector<HTMLElement>('.gd-pieces')!;
  const countEl = el.querySelector<HTMLElement>('.gd-count')!;
  const petalsEl = el.querySelector<HTMLElement>('.gd-petals')!;
  let fresh = takeNewPieces();

  let shownPetals = save.petals;
  const updatePetals = () => {
    petalBump(petalsEl, shownPetals, save.petals);
    shownPetals = save.petals;
  };

  /** A previewed season only shows today's visitor if it would come then. */
  const visitFits = (visit: { visitor: { seasons?: number[] } }) => !visit.visitor.seasons || visit.visitor.seasons.includes(season);

  /* ── the scene ── */
  const renderScene = () => {
    const visit = todaysVisit();
    const shown = shownPieces();
    sceneEl.dataset.season = String(season);
    sceneEl.classList.toggle('is-night', night);
    sceneEl.classList.toggle('is-empty', !shown.length);
    const svg = gardenSvg(season, shown, {
      night,
      visitor: visit && visitFits(visit) && !visit.claimed ? visit.visitor.id : null,
      note: visit?.claimed ? visit.visitor.id : null,
    });
    sceneEl.innerHTML = `${svg}<div class="gd-particles" aria-hidden="true">${particles(season, night)}</div>`;
    sceneEl.querySelector('svg')?.setAttribute('aria-label', sceneLabel(shown, season, night));
    for (const id of fresh) sceneEl.querySelector(`[data-item="${id}"]`)?.classList.add('is-new');
  };

  /* ── the lines under the scene ── */
  const renderInfo = () => {
    const owned = ownedPieces();
    const visit = todaysVisit();
    countEl.textContent = `${owned.length}/${total}`;
    if (!owned.length) {
      info.innerHTML = `<div class="panel gd-empty">
        <p class="gd-empty__lead serif">The courtyard is swept and waiting.</p>
        <p class="muted">Garden pieces from the Market find their own place here, through all four seasons.</p>
        <button class="btn btn--primary btn--block" data-market>Visit the Market to find your first garden piece</button>
      </div>`;
      return;
    }
    const pct = Math.round((owned.length / total) * 100);
    const now = SEASONS[realSeason].en.toLowerCase();
    const v = visit
      ? visit.claimed
        ? `<button class="gd-visit is-done" data-open-note>${ICONS.check}<span>${esc(visit.visitor.name)} came by today and left a note. <u>Read it</u></span></button>`
        : visitFits(visit)
          ? `<button class="gd-visit" data-open-visit><i class="gd-visit__dot" aria-hidden="true"></i><span>A visitor ${esc(visit.visitor.where)} today. <b>Tap it</b> to say hello.</span></button>`
          : `<button class="gd-visit" data-season-now><i class="gd-visit__dot" aria-hidden="true"></i><span>Today’s visitor doesn’t come in ${esc(SEASONS[season].en.toLowerCase())}. <b>Back to ${esc(now)}</b> to say hello.</span></button>`
      : `<p class="gd-visit is-quiet muted">No visitors yet. Birds and animals come to gardens with a wall, a pond, trees or a lantern.</p>`;
    info.innerHTML = `<div class="gd-progress">
        <div class="gd-progress__line"><b>${owned.length}</b> of ${total} pieces${owned.length === total ? ' · complete' : ''}</div>
        <span class="meter" role="progressbar" aria-label="Garden pieces collected" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${owned.length}"><i style="width:${pct}%"></i></span>
      </div>
      ${v}
      ${owned.length < total ? `<button class="chip-btn gd-market" data-market>${ICONS.petal}<span>Find more in the Market</span></button>` : ''}`;
  };

  /* ── the collection ── */
  const renderGrid = () => {
    const placed = new Set(placedItems(shownPieces()));
    grid.innerHTML = GARDEN_ITEMS.map((it) => {
      const owned = isOwned(it.id);
      const hidden = owned && isHidden(it.id);
      const blocked = owned && !hidden && !placed.has(it.id);
      const state = !owned ? (PATH_RANK[it.id] ? `Flower Path · rank ${PATH_RANK[it.id]}` : 'In the Market') : hidden ? 'Put away' : blocked ? `Needs the ${item(it.needs!)?.name.toLowerCase() ?? it.needs}` : 'In the garden';
      const cls = !owned ? 'is-locked' : hidden ? 'is-away' : blocked ? 'is-blocked' : 'is-placed';
      return `<li><button class="gd-piece ${cls}" data-piece="${it.id}" aria-label="${esc(`${it.name}. ${state}`)}">
        <span class="gd-piece__art" data-art="${it.id}"></span>
        <span class="gd-piece__name">${esc(it.name)}</span>
        <span class="gd-piece__state">${esc(state)}</span>
      </button></li>`;
    }).join('');
    // Paint the vignettes after the first frame so the scene appears first.
    requestAnimationFrame(() =>
      setTimeout(() => {
        for (const slot of grid.querySelectorAll<HTMLElement>('[data-art]')) slot.innerHTML = gardenItemSvg(slot.dataset.art!, realSeason);
      }, 60),
    );
  };

  const refresh = () => {
    renderScene();
    renderInfo();
    renderGrid();
  };

  /* ── sheets ── */
  const openPiece = (id: string) => {
    const it = item(id);
    if (!it) return;
    const owned = isOwned(id);
    const hidden = isHidden(id);
    const needOk = !it.needs || placedItems(shownPieces()).includes(it.needs);
    const content = frag(`<div class="gd-sheet">
      <div class="gd-sheet__art">${gardenItemSvg(id, season)}</div>
      <div class="sheet__head">
        <div class="detail__kind">Garden piece · ${!owned ? (PATH_RANK[id] ? 'Flower Path' : 'In the Market') : hidden ? 'Put away' : needOk ? 'In your garden' : 'Waiting'}</div>
        <h2>${esc(it.name)}</h2>
        <p class="gd-sheet__langs"><span class="serif" lang="ko">${it.ko}</span> · <span class="ja" lang="ja">${it.ja}</span></p>
        <p class="muted">${esc(it.blurb)}</p>
        ${id === 'fireflies' && owned && !night ? '<p class="gd-sheet__note">They come out after dark. Try the moon button.</p>' : ''}
        ${it.needs && owned && !needOk ? `<p class="gd-sheet__note">Appears once the ${esc(item(it.needs)?.name.toLowerCase() ?? it.needs)} is in the garden.</p>` : ''}
      </div>
    </div>`);
    const actions = h('div', { class: 'sheet__actions' });
    content.append(actions);
    const sheet = openSheet(content, { label: it.name });
    if (owned) {
      actions.append(
        h(
          'button',
          {
            class: `btn ${hidden ? 'btn--primary' : 'btn--ghost'} btn--block`,
            onclick: () => {
              setHidden(id, !hidden);
              sfx.tap();
              sheet.close();
              fresh = hidden ? [id] : [];
              refresh();
              toast(hidden ? `${it.name} is back in the garden` : `${it.name} put away. You can place it again any time.`);
            },
          },
          hidden ? 'Place in the garden' : 'Put away',
        ),
      );
    } else if (PATH_RANK[id]) {
      actions.append(h('p', { class: 'muted gd-sheet__note' }, `A gift of the Flower Path at rank ${PATH_RANK[id]}.`));
      actions.append(h('button', { class: 'btn btn--ghost btn--block', onclick: () => (sheet.close(), nav.path()) }, 'Open the Flower Path'));
    } else {
      actions.append(h('button', { class: 'btn btn--primary btn--block', onclick: () => (sheet.close(), nav.market('garden')) }, 'Find it in the Market'));
    }
  };

  const openVisit = () => {
    const visit = todaysVisit();
    if (!visit) return;
    const got = visit.claimed ? 0 : claimVisit();
    const v = visit.visitor;
    const content = frag(`<div class="gd-note">
      <div class="gd-note__art">${gardenVisitorSvg(v.id, season, shownPieces())}</div>
      <div class="detail__kind">${got ? 'A visitor' : 'Today’s visitor'} · <span lang="ko">${v.ko}</span> · <span class="ja" lang="ja">${v.ja}</span></div>
      <h2>${esc(v.name)}</h2>
      <p class="muted">${esc(VISITOR_LINES[v.id] ?? '')}</p>
      <blockquote class="gd-note__verse serif">${visit.note.map((l) => `<span>${esc(l)}</span>`).join('')}</blockquote>
      ${got ? `<p class="gd-note__gift">${ICONS.petal}<b>+${got}</b> petals tucked into the note</p>` : '<p class="gd-note__gift is-done muted">Another visitor may come tomorrow.</p>'}
      <p class="gd-note__met muted">Visitors met: ${save.garden.met.length} of ${GARDEN_VISITORS.length}</p>
    </div>`);
    const actions = h('div', { class: 'sheet__actions' });
    content.append(actions);
    const sheet = openSheet(content, { center: true, label: `Note from a ${v.name.toLowerCase()}` });
    actions.append(h('button', { class: 'btn btn--primary btn--block', onclick: () => sheet.close() }, got ? 'Thank you' : 'Close'));
    if (got) {
      sfx.reveal();
      updatePetals();
      // The visitor leaves, its note stays.
      void sheet.closed.then(() => {
        fresh = [];
        renderScene();
        renderInfo();
      });
    }
  };

  /* ── interactions ── */
  el.querySelector('[data-back]')!.addEventListener('click', () => nav.home());

  const setSeason = (next: number) => {
    if (next === season) return;
    season = next;
    sfx.tap();
    el.querySelectorAll<HTMLElement>('.gd-seasons button').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.season) === season)));
    fresh = [];
    renderScene();
    renderInfo();
  };
  el.querySelector('.gd-seasons')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-season]');
    if (b) setSeason(Number(b.dataset.season));
  });

  const timeBtn = el.querySelector<HTMLElement>('[data-time]')!;
  timeBtn.addEventListener('click', () => {
    night = !night;
    sfx.tap();
    timeBtn.setAttribute('aria-pressed', String(night));
    timeBtn.innerHTML = night ? MOON : SUN;
    fresh = [];
    renderScene();
  });

  sceneEl.addEventListener('click', (e) => {
    unlockAudio();
    const t = e.target as Element;
    if (t.closest('[data-visitor]') || t.closest('[data-note]')) {
      sfx.tap();
      openVisit();
      return;
    }
    const g = t.closest<SVGGElement>('[data-item]');
    if (!g) return;
    const id = g.dataset.item!;
    poke(g, id);
    openPiece(id);
  });

  info.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-market]')) nav.market('garden');
    else if (t.closest('[data-season-now]')) setSeason(realSeason);
    else if (t.closest('[data-open-visit]') || t.closest('[data-open-note]')) {
      sfx.tap();
      openVisit();
    }
  });

  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-piece]');
    if (!b) return;
    sfx.tap();
    openPiece(b.dataset.piece!);
  });

  // Ambient motion pauses while the app is in the background.
  const onVis = () => el.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', onVis);

  // The fountain clacks softly each time its rocker strikes the stone in the
  // ambient loop (ga-tip in garden.css: 6 s, the strike lands at 88.9%). No
  // animation (reduced motion, paused, put away) means no clack.
  let clackTimer = 0;
  const onTip = (e: Event) => {
    if ((e as AnimationEvent).animationName !== 'ga-tip') return;
    clearTimeout(clackTimer);
    clackTimer = window.setTimeout(() => {
      if (!document.hidden && el.isConnected && audioReady()) sfx.clack(0.35);
    }, FOUNTAIN_STRIKE_MS);
  };
  sceneEl.addEventListener('animationstart', onTip);
  sceneEl.addEventListener('animationiteration', onTip);

  refresh();
  if (fresh.length) {
    const names = fresh.map((id) => item(id)?.name).filter(Boolean);
    setTimeout(() => toast(names.length === 1 ? `New in your garden: ${names[0]}` : `${names.length} new pieces in your garden`), 450);
    setTimeout(() => (fresh = []), 3000);
  }

  return {
    name: 'garden',
    el,
    destroy() {
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(clackTimer);
    },
  };
}

/** Little reactions when a piece is tapped. */
function poke(g: Element, id: string): void {
  if (id === 'chime') sfx.chime();
  // the tapped rocker strikes the stone 75% into ga-tip-now (1.3 s)
  else if (id === 'fountain') setTimeout(() => sfx.clack(), 975);
  else sfx.tap();
  const cls = id === 'cat' ? 'is-twitch' : id === 'chime' ? 'is-ring' : id === 'fountain' ? 'is-tip' : '';
  if (!cls) return;
  g.classList.remove(cls);
  void (g as SVGGElement).getBBox();
  g.classList.add(cls);
  setTimeout(() => g.classList.remove(cls), 1600);
}

function sceneLabel(shown: string[], season: number, night: boolean): string {
  const placed = placedItems(shown);
  const when = `${SEASONS[season].en.toLowerCase()}${night ? ' night' : ''}`;
  if (!placed.length) return `An empty courtyard in ${when}`;
  const names = placed.map((id) => item(id)?.name.toLowerCase()).filter(Boolean);
  return `Your garden in ${when}: ${names.join(', ')}`;
}

/** Drifting seasonal particles (HTML spans, animated with transforms in garden.css). */
function particles(season: number, night: boolean): string {
  const kind = ['petal', 'seed', 'leaf', 'snow'][season];
  const count = kind === 'seed' ? (night ? 0 : 6) : kind === 'snow' ? 14 : 9;
  const tints: Record<string, string[]> = {
    petal: ['#f2c3cc', '#f7dde2', '#eab3bd', '#fbeef0'],
    seed: ['#fbf7ea'],
    leaf: ['#c9643c', '#b8452f', '#d99a4e', '#cf7a3f'],
    snow: ['#ffffff'],
  };
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (i * 37 + 11) % 100;
    const delay = ((i * 1.9) % 11).toFixed(1);
    const dur = (11 + ((i * 2.3) % 7)).toFixed(1);
    const size = kind === 'snow' ? 2 + ((i * 5) % 4) : kind === 'seed' ? 3 : 5 + ((i * 3) % 4);
    const t = tints[kind];
    out += `<span class="gp gp--${kind}" style="left:${x}%;--d:-${delay}s;--t:${dur}s;--s:${size}px;--c:${t[i % t.length]};--r:${(i * 47) % 180}deg"></span>`;
  }
  return out;
}
