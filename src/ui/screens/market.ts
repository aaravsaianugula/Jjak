/**
 * Market · 장터 · 市 — the reward shop. Petals buy tools and cosmetics; every
 * price is shown plainly, there are no timers, discounts or random boxes.
 *
 * Tabs (deep link with nav.market(tabId)): tools, decks, backs, brushes,
 * effects, papers, garden, music. Rules live in services/market.ts.
 */
import { MONTH_TINTS, cardSvg } from '../../art/cards';
import { art, deckle } from '../../art/market-art';
import { GARDEN_ITEMS, gardenItemSvgCached } from '../../art/garden';
import { cardBackPreviewSvg, cardPreviewSvg } from '../../art/styles';
import { ECONOMY } from '../../config';
import { MONTHS, cardDef, monthDef } from '../../data/deck';
import { type MarketItem, type MarketTab, MARKET_TABS, MAX_STREAK_FREEZES, TOOL, itemsIn, tabOf } from '../../data/market';
import { dailyLevel, localDateKey } from '../../engine/levels';
import { sfx, unlockAudio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import {
  activeBrush,
  activeFx,
  buy,
  check,
  equip,
  gardenShown,
  isEquipped,
  isListed,
  isNew,
  isOwned,
  markSeen,
  setGardenShown,
  slotOf,
} from '../../services/market';
import { music } from '../../services/music';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { brushStroke, burstFx, type Pt } from '../brush-fx';
import { esc, fmt, frag, h, toast } from '../dom';
import { ICONS } from '../icons';
import { type SheetHandle, openSheet } from '../modal';
import { petalBump, reducedMotion } from '../motion';
import { nav } from '../nav';

// ── Extension points ────────────────────────────────────────────────

export interface MarketHooks {
  /**
   * IAP petal bundles (progression feature). Rendered at the bottom of the
   * Tools tab; return null to show nothing. Called on every render of Tools.
   */
  bundlesSection: () => HTMLElement | null;
  /** The player's Flower Path rank, to show progress on rank exclusives. */
  rank?: () => number;
  /** Open the Supporter pack offer (shown on Supporter exclusives). */
  supporter?: () => void;
}

/** EXTENSION POINT: other features assign these at boot. */
export const marketHooks: MarketHooks = { bundlesSection: () => null };

/** EXTENSION POINT: IAP petal bundles at the bottom of Tools (null for now). */
export function bundlesSection(): HTMLElement | null {
  return marketHooks.bundlesSection();
}

// ── Helpers ─────────────────────────────────────────────────────────

const petal = (n: number) => `<span class="mk-price__icon" aria-hidden="true">${ICONS.petal}</span><span class="num">${fmt(n)}</span>`;
const lockIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const KIND: Record<string, string> = { tool: 'Tool', deck: 'Deck', back: 'Card back', brush: 'Brush', fx: 'Effect', paper: 'Board paper', garden: 'Garden', music: 'Music' };
/** Cards shown in deck previews: the pine crane, cherry curtain and full moon. */
const DECK_CARDS = [3, 11, 31];
/** The demo pair (cherry ribbon + curtain). */
const PAIR = [10, 11];

let lastTab = 'tools';

function sourceLine(it: MarketItem): string {
  const s = it.source;
  if (!s) return '';
  if (s.kind === 'path') return `Reach rank ${s.rank} on the Flower Path`;
  if (s.kind === 'supporter') return 'Included in the Supporter pack';
  return `Collect all four ${MONTHS[s.month].en.toLowerCase()} cards in the Album`;
}
const monthHave = (m: number) => [0, 1, 2, 3].filter((v) => save.album.includes(m * 4 + v)).length;

// ── Previews ────────────────────────────────────────────────────────

const toolArt = (it: MarketItem, big: boolean): string => art(`tool-${it.id}`, 'mk-ill mk-ill--tool', '', big);

/**
 * Board papers: a deckle-edged sheet held by a brass weight, with close-up
 * detail over the real board texture. Unpainted, it's the bare sheet (the
 * grid's placeholder until the tile is on screen).
 */
const paperArt = (it: MarketItem, painted: boolean): string => {
  const seed = it.id.split('').reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0;
  const clip = `style="clip-path:${deckle(seed)}"`;
  if (!painted) return `<span class="mk-swatch"><span class="mk-swatch__sheet" ${clip}></span></span>`;
  let face: string;
  if (it.source?.kind === 'album') {
    const m = it.source.month;
    face = `<span class="paper" style="--paper-tint:${MONTH_TINTS[m]}"><svg viewBox="0 0 100 140"><use href="#motif-${m}"/></svg></span>${art('paper-plain', 'mk-sheet__detail', ' preserveAspectRatio="xMidYMid slice"')}`;
  } else if (it.id === 'plain') face = `<span class="paper paper--plainsheet"></span>${art('paper-plain', 'mk-sheet__detail', ' preserveAspectRatio="xMidYMid slice"')}`;
  else face = `<span class="paper paper--market paper--${it.id}"></span>${art(`paper-${it.id}`, 'mk-sheet__detail', ' preserveAspectRatio="xMidYMid slice"')}`;
  return `<span class="mk-swatch"><span class="mk-swatch__sheet" ${clip}>${face}<i class="mk-swatch__light"></i></span>${art('weight', 'mk-swatch__weight')}</span>`;
};

const MUSIC_IDS = new Set(['default', 'gayageum', 'koto', 'flute', 'moonlight']);
const musicArt = (it: MarketItem): string => art(`music-${MUSIC_IDS.has(it.id) ? it.id : 'default'}`, 'mk-ill mk-ill--music');

/** The ink each brush leaves in the inkstone (follows the theme, like the stroke itself). */
const BRUSH_INK: Record<string, string> = {
  ink: 'var(--path)',
  vermilion: 'var(--mk-vermilion)',
  indigo: 'var(--mk-indigo)',
  petals: 'var(--mk-rose)',
  firefly: 'var(--mk-ff-mid)',
  gold: 'var(--mk-gold)',
};

/**
 * Two little cards with a stroke or burst between them. Brushes are shown on a
 * small mounted scroll beside an inkstone; effects on a patch of board.
 * Unpainted, it's the empty scroll or board (the grid's placeholder).
 */
function miniStage(it: MarketItem, big: boolean, painted: boolean): { mount: HTMLElement; stage: HTMLElement } {
  const stage = h('span', { class: `mk-demo${big ? ' mk-demo--big' : ''}`, 'aria-hidden': 'true' });
  if (painted) stage.innerHTML = `<span class="mk-demo__card">${cardSvg(PAIR[0])}</span><span class="mk-demo__card">${cardSvg(PAIR[1])}</span>`;
  if (it.category === 'brush') {
    const scroll = h('span', { class: 'mk-scroll', style: `--mka-ink:${BRUSH_INK[it.id] ?? BRUSH_INK.ink}` });
    const paper = h('span', { class: 'mk-scroll__paper' }, stage);
    scroll.append(paper);
    scroll.insertAdjacentHTML('beforeend', `<i class="mk-scroll__rod"></i><i class="mk-scroll__rod mk-scroll__rod--r"></i>${art('inkstone', 'mk-scroll__stone')}`);
    return { mount: scroll, stage };
  }
  return { mount: h('span', { class: 'mk-board' }, stage), stage };
}

/** Card width and path corners for a demo stage of width W (cards at 22% / 78%). */
function demoGeometry(W: number, H: number) {
  const cw = Math.round(Math.min(W * 0.2, H * 0.4));
  const ch = Math.round(cw * 1.4);
  const ax = W * 0.24;
  const bx = W * 0.76;
  const cy = H * 0.6;
  const top = Math.max(cw * 0.32, cy - ch / 2 - cw * 0.45);
  const pts: Pt[] = [
    { x: ax, y: cy },
    { x: ax, y: top },
    { x: bx, y: top },
    { x: bx, y: cy },
  ];
  return { cw, ch, ax, bx, cy, pts };
}

function layoutDemo(stage: HTMLElement): ReturnType<typeof demoGeometry> | null {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  if (!W || !H) return null;
  const g = demoGeometry(W, H);
  stage.querySelectorAll<HTMLElement>('.mk-demo__card').forEach((c, i) => {
    c.style.width = `${g.cw}px`;
    c.style.height = `${g.ch}px`;
    c.style.left = `${(i ? g.bx : g.ax) - g.cw / 2}px`;
    c.style.top = `${g.cy - g.ch / 2}px`;
  });
  return g;
}

let demoSeq = 0;
function demoLayer(stage: HTMLElement): SVGSVGElement {
  let svg = stage.querySelector<SVGSVGElement>('svg.mk-paths');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'paths mk-paths');
    svg.setAttribute('aria-hidden', 'true');
    stage.append(svg);
  }
  return svg;
}

/** Draw the static tile preview once the stage has a size. */
function paintStill(stage: HTMLElement, it: MarketItem): void {
  const g = layoutDemo(stage);
  if (!g) return;
  if (it.category === 'brush') {
    brushStroke(demoLayer(stage), g.pts, it.id, { cw: g.cw, uid: `mkd-${++demoSeq}`, width: stage.clientWidth, height: stage.clientHeight, still: true, keep: true });
  } else {
    stage.classList.add('is-cleared');
    // A frozen frame: the pair lifting away, the burst caught mid-flight (the same
    // particles as the game, placed by a fixed seed so every tile is composed).
    burstFx(stage, g.ax, g.cy - g.ch * 0.12, it.id, { cw: g.cw * 1.2, still: true, seed: 17 });
    burstFx(stage, g.bx, g.cy - g.ch * 0.12, it.id, { cw: g.cw * 1.2, still: true, seed: 41 });
  }
}

/** Play the demo: the brush crosses, the pair clears, the burst scatters, the cards return. */
function playDemo(stage: HTMLElement, it: MarketItem, brush: string, fx: string): number {
  const g = layoutDemo(stage);
  if (!g) return 0;
  const rm = reducedMotion();
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  stage.classList.remove('is-cleared', 'is-back');
  brushStroke(demoLayer(stage), g.pts, it.category === 'brush' ? it.id : brush, { cw: g.cw, uid: `mkd-${++demoSeq}`, width: W, height: H, still: rm });
  const fxId = it.category === 'fx' ? it.id : fx;
  setTimeout(() => {
    if (!stage.isConnected) return;
    stage.classList.add('is-cleared');
    if (!rm) {
      burstFx(stage, g.ax, g.cy, fxId, { cw: g.cw * 1.15 });
      burstFx(stage, g.bx, g.cy, fxId, { cw: g.cw * 1.15 });
    }
  }, rm ? 120 : 260);
  setTimeout(() => {
    if (!stage.isConnected) return;
    stage.classList.remove('is-cleared');
    stage.classList.add('is-back');
  }, rm ? 900 : 1500);
  return rm ? 1200 : 2600;
}

/*
 * Previews in the grid are painted lazily: a tile gets a placeholder first
 * (blank cards, a bare sheet, an empty scroll) and its art once it's on screen,
 * one tile per frame. Opening a tab never waits on the art, and tiles below
 * the fold cost nothing until reached.
 */
type Paint = () => void;
const lazyFills = new WeakMap<Element, Paint>();
const lazyQueue: Element[] = [];
let lazyRaf = 0;
const lazyIo =
  typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver(
        (entries, io) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.unobserve(e.target);
            lazyQueue.push(e.target);
          }
          pumpLazy();
        },
        { rootMargin: '160px 0px' },
      );
function pumpLazy() {
  if (lazyRaf || !lazyQueue.length) return;
  lazyRaf = requestAnimationFrame(() => {
    lazyRaf = 0;
    // One tile per frame: most of a preview's cost is the browser styling and
    // painting its art after this returns, so that's the unit that fits a frame.
    for (let el = lazyQueue.shift(); el; el = lazyQueue.shift()) {
      const fill = lazyFills.get(el);
      if (!fill || !el.isConnected) continue;
      fill();
      el.classList.add('is-painted');
      break;
    }
    pumpLazy();
  });
}
/** Show `blank` now and run `fill` once `wrap` is on screen; `now` (the detail sheet) fills at once. */
function lazyPaint(wrap: HTMLElement, blank: Paint, fill: Paint, now: boolean) {
  if (now) {
    fill();
    return;
  }
  blank();
  lazyFills.set(wrap, fill);
  if (lazyIo) lazyIo.observe(wrap);
  else {
    lazyQueue.push(wrap);
    pumpLazy();
  }
}
const lazyArt = (wrap: HTMLElement, blank: string, fill: () => string, now: boolean) =>
  lazyPaint(wrap, () => (wrap.innerHTML = blank), () => (wrap.innerHTML = fill()), now);

function itemArt(it: MarketItem, big = false): HTMLElement {
  const wrap = h('span', { class: `mk-art mk-art--${it.category}${big ? ' mk-art--big' : ''}`, 'aria-hidden': 'true' });
  switch (it.category) {
    case 'tool':
      wrap.innerHTML = toolArt(it, big);
      break;
    case 'deck': {
      const fan = (art: (id: number) => string) => `<span class="mk-cards mk-cards--fan">${DECK_CARDS.map((id) => `<span class="mk-card">${art(id)}</span>`).join('')}</span>`;
      lazyArt(wrap, fan(() => ''), () => fan((id) => cardPreviewSvg(id, it.id)), big);
      break;
    }
    case 'back': {
      const pair = (a: string, b: string) => `<span class="mk-cards mk-cards--pair"><span class="mk-card">${a}</span><span class="mk-card">${b}</span></span>`;
      lazyArt(wrap, pair('', ''), () => pair(cardBackPreviewSvg(it.id), cardBackPreviewSvg(it.id)), big);
      break;
    }
    case 'garden':
      lazyArt(wrap, '<span class="mk-garden"></span>', () => `<span class="mk-garden">${gardenItemSvgCached(it.id)}</span>`, big);
      break;
    case 'paper':
      lazyArt(wrap, paperArt(it, false), () => paperArt(it, true), big);
      break;
    case 'music':
      wrap.innerHTML = musicArt(it);
      break;
    case 'brush':
    case 'fx':
      lazyPaint(
        wrap,
        () => wrap.replaceChildren(miniStage(it, big, false).mount),
        () => {
          const { mount, stage } = miniStage(it, big, true);
          wrap.replaceChildren(mount);
          // Grid tiles show a still frame; the detail sheet runs its own demo.
          if (!big) paintStill(stage, it);
        },
        big,
      );
      break;
  }
  return wrap;
}

// ── Tile state ──────────────────────────────────────────────────────

type TileState = 'equipped' | 'owned' | 'locked' | 'needs' | 'short' | 'buy' | 'full';

function stateOf(it: MarketItem): TileState {
  if (isOwned(it.key)) return slotOf(it.category) && isEquipped(it.key) ? 'equipped' : 'owned';
  if (it.source) return 'locked';
  const c = check(it.key);
  if (c.ok) return 'buy';
  if (c.reason === 'needs') return 'needs';
  if (c.reason === 'max' || c.reason === 'complete') return 'full';
  return 'short';
}

function footFor(it: MarketItem, st: TileState): string {
  switch (st) {
    case 'equipped':
      return `<span class="mk-state mk-state--on">${ICONS.check}<span>In use</span></span>`;
    case 'owned':
      if (it.category === 'garden') return `<span class="mk-state">${gardenShown(it.id) ? 'In your garden' : 'Put away'}</span>`;
      return '<span class="mk-state">Owned</span>';
    case 'locked': {
      const s = it.source!;
      if (s.kind === 'path') return `<span class="mk-state mk-state--lock">${lockIcon}<span>Rank ${s.rank}</span></span>`;
      if (s.kind === 'supporter') return `<span class="mk-state mk-state--lock">${ICONS.heart}<span>Supporter</span></span>`;
      return `<span class="mk-state mk-state--lock">${lockIcon}<span>Album · ${monthHave(s.month)}/4</span></span>`;
    }
    case 'needs': {
      const c = check(it.key);
      // Short form for the tile: "Needs pond".
      const need = !c.ok && c.needs ? (c.needs.name.split(' ').pop() ?? '').toLowerCase() : '';
      return `<span class="mk-price is-off">${petal(it.price)}</span><span class="mk-hint">Needs ${esc(need)}</span>`;
    }
    case 'full':
      return `<span class="mk-state">${it.key === TOOL.tea ? `Full · ${MAX_STREAK_FREEZES}/${MAX_STREAK_FREEZES}` : 'Album complete'}</span>`;
    case 'short':
      return `<span class="mk-price is-short">${petal(it.price)}</span><span class="mk-hint">${fmt(it.price - save.petals)} more</span>`;
    default:
      return `<span class="mk-price">${petal(it.price)}</span>`;
  }
}

function haveLine(it: MarketItem): string {
  if (it.key === TOOL.hints) return `You have ${save.hints}`;
  if (it.key === TOOL.shuffles) return `You have ${save.shuffles}`;
  if (it.key === TOOL.tea) return `${save.streakFreezes} of ${MAX_STREAK_FREEZES} cups`;
  if (it.key === TOOL.card) return `${new Set(save.album).size}/48 in Album`;
  return '';
}

// ── Screen ──────────────────────────────────────────────────────────

export function marketScreen(tab?: string): Screen {
  const startTab = MARKET_TABS.some((t) => t.id === tab) ? tab! : lastTab;
  let current = startTab;
  let openDemo: { stop(): void } | null = null;
  /** Tiles whose state just changed (bought, equipped, unequipped): they settle in on the next render. */
  let changedKeys: string[] = [];

  const balanceN = h('span', { class: 'petals__n num' }, fmt(save.petals));
  const balance = h('span', { class: 'petals mk-balance', role: 'status', 'aria-label': `${save.petals} petals`, html: ICONS.petal });
  balance.append(balanceN);
  let shownBalance = save.petals;
  /** Show the balance; a change counts over and bumps the pill (the purchase ghost already counted down). */
  const setBalance = (n = save.petals) => {
    if (n === shownBalance) return;
    petalBump(balance, shownBalance, n, { format: fmt, ms: 360 });
    shownBalance = n;
  };

  const rail = h('div', { class: 'mk-rail scroll', role: 'tablist', 'aria-label': 'Market sections' });
  const body = h('div', { class: 'scroll screen__body mk-body', role: 'tabpanel' });
  const el = h(
    'section',
    { class: 'screen market' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'data-back': '', 'aria-label': 'Back', html: ICONS.back, onclick: () => nav.home() }),
      frag(`<div class="topbar__title"><h1>Market</h1><span class="topbar__sub"><span lang="ko">장터</span> · <span class="ja" lang="ja">市</span></span></div>`),
      balance,
    ),
    rail,
    body,
  );

  const tabHasNew = (t: MarketTab) => itemsIn(t.category).some((it) => isListed(it) && isNew(it));
  function renderRail() {
    rail.replaceChildren(
      ...MARKET_TABS.map((t) =>
        h(
          'button',
          {
            class: `mk-tab${tabHasNew(t) ? ' has-new' : ''}`,
            role: 'tab',
            'data-tab': t.id,
            'aria-selected': String(t.id === current),
            onclick: () => showTab(t.id),
          },
          h('span', { class: 'mk-tab__glyph ja', 'aria-hidden': 'true' }, t.ja.slice(0, 1)),
          h('span', {}, t.name),
        ),
      ),
    );
  }

  function tileFor(it: MarketItem, fresh: boolean): HTMLElement {
    const st = stateOf(it);
    const have = it.category === 'tool' ? haveLine(it) : '';
    const native = `<span lang="ko">${esc(it.ko)}</span> · <span class="ja" lang="ja">${esc(it.ja)}</span>`;
    const label = `${it.name}. ${st === 'buy' || st === 'short' ? `${it.price} petals` : st === 'locked' ? sourceLine(it) : st === 'equipped' ? 'In use' : st === 'owned' ? 'Owned' : ''}`;
    const tile = h('button', { class: `mk-tile is-${st}${fresh ? ' is-new' : ''}${changedKeys.includes(it.key) ? ' is-changed' : ''}`, 'data-key': it.key, 'aria-label': label });
    tile.append(itemArt(it));
    if ((st === 'owned' || st === 'equipped') && !it.isDefault && it.category !== 'paper') tile.append(frag('<span class="mk-seal mk-seal--sm" aria-hidden="true">Yours</span>'));
    if (fresh) tile.append(h('i', { class: 'mk-dot', 'aria-hidden': 'true' }));
    tile.append(
      frag(`<span class="mk-tile__text"><span class="mk-tile__name">${esc(it.name)}</span><span class="mk-tile__native">${have ? esc(have) : native}</span></span>`),
      frag(`<span class="mk-tile__foot">${footFor(it, st)}</span>`),
    );
    tile.addEventListener('click', () => openItem(it));
    return tile;
  }

  function showTab(id: string, keepScroll = false) {
    const t = MARKET_TABS.find((x) => x.id === id) ?? MARKET_TABS[0];
    const changed = t.id !== current;
    // The new section slides in from the side of the tab that was tapped.
    const dir = MARKET_TABS.findIndex((x) => x.id === t.id) > MARKET_TABS.findIndex((x) => x.id === current) ? 1 : -1;
    body.style.setProperty('--tab-dir', String(dir));
    body.classList.toggle('is-switching', changed);
    current = lastTab = t.id;
    renderRail();
    const btn = rail.querySelector<HTMLElement>(`[data-tab="${t.id}"]`);
    btn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: changed && !reducedMotion() ? 'smooth' : 'auto' });
    body.setAttribute('aria-label', t.name);
    const scrollTop = body.scrollTop;
    const items = itemsIn(t.category).filter(isListed);
    const owned = items.filter((it) => !it.consumable && isOwned(it.key)).length;
    const frag0 = document.createDocumentFragment();
    frag0.append(
      frag(`<div class="mk-lede">
        <div class="mk-lede__top"><h2 class="mk-lede__title">${esc(t.name)}</h2><span class="mk-lede__native"><span lang="ko">${t.ko}</span> · <span class="ja" lang="ja">${t.ja}</span></span>
        ${t.category === 'tool' ? '' : `<span class="mk-lede__count num">${owned}/${items.length}</span>`}</div>
        <p class="mk-lede__text">${esc(t.lede)}</p>
      </div>`),
    );
    if (t.category === 'garden') {
      const placed = GARDEN_ITEMS.filter((g) => gardenShown(g.id)).length;
      const visit = frag(`<button class="mk-visit panel"><span class="mk-visit__glyph ja" aria-hidden="true">庭</span><span class="mk-visit__text"><b>Visit your garden</b><small>${placed ? `${placed} of ${GARDEN_ITEMS.length} pieces placed` : 'Your courtyard is waiting for its first piece'}</small></span><span class="row__end" aria-hidden="true">${ICONS.chevron}</span></button>`);
      visit.addEventListener('click', () => nav.garden());
      frag0.append(visit);
    }
    const grid = (list: MarketItem[]) => {
      const g = h('div', { class: `mk-grid mk-grid--${t.category}` });
      list.forEach((it, i) => {
        const tile = tileFor(it, isNew(it));
        // The first tiles of a new section follow it in, one after another.
        if (changed && i < 4) {
          tile.classList.add('is-stagger');
          tile.style.setProperty('--i', String(i));
        }
        g.append(tile);
      });
      return g;
    };
    if (t.category === 'paper') {
      const fromMarket = items.filter((it) => it.source?.kind !== 'album');
      const fromAlbum = items.filter((it) => it.source?.kind === 'album');
      frag0.append(grid(fromMarket));
      frag0.append(frag(`<h3 class="section-label mk-sub">Flower papers <span>Unlocked in the Album</span></h3>`));
      frag0.append(grid(fromAlbum));
    } else frag0.append(grid(items));
    if (t.category === 'tool') {
      const bundles = bundlesSection();
      if (bundles) frag0.append(bundles);
      frag0.append(earnPanel(false));
    }
    frag0.append(frag(`<p class="mk-fine">Prices are always in petals. Nothing here is random, and nothing runs out.</p>`));
    // A new section starts at the top; reset before the swap, while layout is
    // clean, so the tap doesn't force a layout of the new section.
    if (!keepScroll) body.scrollTop = 0;
    body.replaceChildren(frag0);
    changedKeys = [];
    if (keepScroll) body.scrollTop = scrollTop;
    // Dots stay for this visit; next time they're gone.
    markSeen(...items.filter((it) => isNew(it)).map((it) => it.key));
  }

  // ── Ways to earn (gentle; shown when short of petals) ──────────────
  function earnPanel(compact: boolean): HTMLElement {
    const today = localDateKey();
    const dailyDone = !!save.daily.results[today];
    const p = frag(`<div class="mk-earn${compact ? ' mk-earn--compact' : ''}">
      <div class="eyebrow">Ways to earn petals</div>
      <ul class="mk-earn__list">
        <li><span>Daily Jjak</span><b class="num">+${ECONOMY.dailyPetals} a day</b></li>
        <li><span>Journey stars</span><b class="num">+${ECONOMY.petalsPerStar} each new blossom</b></li>
        <li><span>Lantern gifts</span><b>every ${ECONOMY.lanternEvery} levels</b></li>
        <li><span>Missions</span><b>on the Flower Path</b></li>
      </ul>
      <div class="mk-earn__go"></div>
    </div>`);
    const go = p.querySelector('.mk-earn__go')!;
    if (!dailyDone) go.append(h('button', { class: 'chip-btn', onclick: () => { closeAll(); nav.game(dailyLevel(today)); } }, 'Play today’s Daily'));
    go.append(h('button', { class: 'chip-btn', onclick: () => { closeAll(); nav.path(); } }, 'See missions'));
    return p;
  }

  let sheet: SheetHandle | null = null;
  const closeAll = () => {
    sheet?.close();
    sheet = null;
  };

  // ── Item sheet: big preview, price, buy / equip ───────────────────
  function openItem(it: MarketItem) {
    unlockAudio();
    markSeen(it.key);
    const big = itemArt(it, true);
    const stage = h('div', { class: `mk-stage mk-stage--${it.category}` }, big);
    const actions = h('div', { class: 'sheet__actions mk-actions' });
    const status = h('div', { class: 'mk-status', 'aria-live': 'polite' });
    const tab = tabOf(it.category);
    const content = h(
      'div',
      { class: 'mk-sheet' },
      stage,
      frag(`<div class="mk-sheet__head">
        <div class="detail__kind">${esc(KIND[it.category])} · <span lang="ko">${tab.ko}</span> · <span class="ja" lang="ja">${tab.ja}</span></div>
        <h2>${esc(it.name)}</h2>
        <p class="mk-sheet__native"><span class="serif" lang="ko">${esc(it.ko)}</span> · <span class="ja" lang="ja">${esc(it.ja)}</span></p>
        <p class="mk-sheet__blurb">${esc(it.blurb)}</p>
      </div>`),
      status,
      actions,
    );
    sheet = openSheet(content, { label: it.name, close: true });
    const mySheet = sheet;

    // Brush / effect demo loops while the sheet is open.
    let loop: ReturnType<typeof setTimeout> | null = null;
    if (it.category === 'brush' || it.category === 'fx') {
      const demo = big.querySelector<HTMLElement>('.mk-demo')!;
      // Place the pair at once, so the picture never shows unsized cards before the first run.
      requestAnimationFrame(() => layoutDemo(demo));
      const run = () => {
        if (!demo.isConnected) return;
        const ms = playDemo(demo, it, activeBrush(), activeFx());
        if (!reducedMotion()) loop = setTimeout(run, ms + 500);
      };
      if (reducedMotion()) {
        // Reduced motion: a still picture of the brush or burst instead of the loop.
        demo.classList.add('is-still-preview');
        requestAnimationFrame(() => requestAnimationFrame(() => paintStill(demo, it)));
      } else {
        setTimeout(run, 380);
        demo.addEventListener('click', () => {
          if (loop) clearTimeout(loop);
          run();
        });
      }
      demo.setAttribute('role', 'img');
      demo.setAttribute('aria-label', `${it.name}, ${reducedMotion() ? 'preview' : 'animated preview'}`);
      demo.classList.add('is-live');
    }
    const stopLoop = () => {
      if (loop) clearTimeout(loop);
      loop = null;
      const demo = big.querySelector<HTMLElement>('.mk-demo');
      if (!demo) return;
      demo.classList.remove('is-cleared', 'is-back');
      demo.querySelectorAll('.fxb').forEach((n) => n.remove());
      demo.querySelector('.mk-paths')?.replaceChildren();
    };
    openDemo = { stop: stopLoop };
    void mySheet.closed.then(() => {
      if (loop) clearTimeout(loop);
      if (it.category === 'music') music.stopPreview();
      if (sheet === mySheet) sheet = null;
    });

    const render = () => {
      status.replaceChildren();
      actions.replaceChildren();
      const st = stateOf(it);
      const slot = slotOf(it.category);
      if (it.category === 'music') {
        const listen = h('button', { class: 'btn btn--ghost btn--block mk-listen', html: `${ICONS.music}<span>Listen · 4 seconds</span>` });
        listen.addEventListener('click', () => {
          unlockAudio();
          music.preview(it.id, 4000);
          listen.classList.remove('is-playing');
          void listen.offsetWidth;
          listen.classList.add('is-playing');
          setTimeout(() => listen.classList.remove('is-playing'), 4000);
        });
        actions.append(listen);
      }
      if (st === 'equipped') {
        status.append(frag(`<p class="mk-note mk-note--on">${ICONS.check}<span>${it.isDefault ? 'The default, in use now.' : 'Yours, and in use now.'}</span></p>`));
      } else if (st === 'owned') {
        if (slot) {
          status.append(frag(`<p class="mk-note">${it.isDefault ? 'The everyday choice.' : 'In your collection.'}</p>`));
          actions.prepend(
            h('button', {
              class: 'btn btn--primary btn--block',
              onclick: () => {
                const was = itemsIn(it.category).find((x) => x.key !== it.key && isEquipped(x.key));
                if (equip(slot, it.id)) {
                  changedKeys = [it.key, ...(was ? [was.key] : [])];
                  sfx.hint();
                  haptic.medium();
                  refresh();
                  render();
                }
              },
            }, it.category === 'paper' ? 'Use this paper' : it.category === 'music' ? 'Play this music' : 'Use this'),
          );
        } else if (it.category === 'garden') {
          const shown = gardenShown(it.id);
          status.append(frag(`<p class="mk-note">${shown ? 'In your garden.' : 'Put away for now.'}</p>`));
          actions.prepend(
            h('button', { class: 'btn btn--primary btn--block', onclick: () => { closeAll(); nav.garden(); } }, 'Visit the garden'),
            h('button', {
              class: 'btn btn--ghost btn--block',
              onclick: () => {
                setGardenShown(it.id, !shown);
                changedKeys = [it.key];
                haptic.light();
                refresh();
                render();
              },
            }, shown ? 'Put it away' : 'Place it in the garden'),
          );
        }
      } else if (st === 'locked') {
        const s = it.source!;
        const rank = s.kind === 'path' && marketHooks.rank ? marketHooks.rank() : null;
        const progress =
          s.kind === 'album'
            ? `<span class="mk-lock__meter"><i style="width:${(monthHave(s.month) / 4) * 100}%"></i></span><small>${monthHave(s.month)} of 4 collected</small>`
            : rank != null
              ? `<span class="mk-lock__meter"><i style="width:${Math.min(100, (rank / (s as { rank: number }).rank) * 100)}%"></i></span><small>You’re at rank ${rank}</small>`
              : '';
        status.append(
          frag(`<div class="mk-lock"><span class="mk-lock__icon" aria-hidden="true">${s.kind === 'supporter' ? ICONS.heart : lockIcon}</span><span class="mk-lock__text"><b>${esc(sourceLine(it))}</b>${s.kind === 'path' ? '<small>A Flower Path reward. It can’t be bought with petals.</small>' : s.kind === 'supporter' ? '<small>A thank-you for supporting Jjak.</small>' : ''}${progress}</span></div>`),
        );
        if (s.kind === 'path') actions.append(h('button', { class: 'btn btn--ghost btn--block', onclick: () => { closeAll(); nav.path(); } }, 'Open the Flower Path'));
        if (s.kind === 'album') actions.append(h('button', { class: 'btn btn--ghost btn--block', onclick: () => { closeAll(); nav.album(); } }, 'Open the Album'));
        if (s.kind === 'supporter' && marketHooks.supporter) actions.append(h('button', { class: 'btn btn--ghost btn--block', onclick: () => marketHooks.supporter?.() }, 'About the Supporter pack'));
      } else if (st === 'needs') {
        const c = check(it.key);
        const need = !c.ok ? c.needs : undefined;
        status.append(frag(`<p class="mk-note">${lockIcon}<span>Needs the ${esc((need?.name ?? '').toLowerCase())} first.</span></p>`));
        if (need) actions.append(h('button', { class: 'btn btn--ghost btn--block', onclick: () => { mySheet.close(); setTimeout(() => openItem(need), 220); } }, `See the ${need.name.toLowerCase()}`));
      } else if (st === 'full') {
        if (it.category === 'tool') status.append(frag(`<p class="mk-note mk-have"><span>${esc(haveLine(it))}</span></p>`));
        status.append(frag(`<p class="mk-note">${it.key === TOOL.tea ? `Your teapot is full: ${MAX_STREAK_FREEZES} of ${MAX_STREAK_FREEZES} cups. A cup is used when you miss a day.` : 'Your Album is complete. Every card is yours.'}</p>`));
      } else {
        // buy / short
        const short = st === 'short';
        if (it.category === 'tool') status.append(frag(`<p class="mk-note mk-have"><span>${esc(haveLine(it))}</span></p>`));
        status.append(
          frag(`<div class="mk-pay">
            <span class="mk-pay__price">${petal(it.price)}<small>petals</small></span>
            <span class="mk-pay__after">${short ? `You have ${fmt(save.petals)}. <b>${fmt(it.price - save.petals)} more</b> to go.` : `You have ${fmt(save.petals)} · ${fmt(save.petals - it.price)} left after`}</span>
          </div>`),
        );
        const buyBtn = h('button', { class: `btn btn--block ${short ? 'btn--ghost' : 'btn--accent'}`, html: short ? `Not enough petals yet` : `Buy for ${petal(it.price)}` });
        if (short) {
          buyBtn.setAttribute('aria-disabled', 'true');
          buyBtn.classList.add('is-short');
          buyBtn.addEventListener('click', () => {
            haptic.warn();
            buyBtn.classList.remove('is-nudge');
            void buyBtn.offsetWidth;
            buyBtn.classList.add('is-nudge');
          });
          status.append(earnPanel(true));
        } else
          buyBtn.addEventListener('click', () => {
            stopLoop();
            doBuy(it, stage, buyBtn, render);
          });
        actions.prepend(buyBtn);
      }
    };
    render();
  }

  // ── Purchase ────────────────────────────────────────────────────────
  function doBuy(it: MarketItem, stage: HTMLElement, btn: HTMLElement, rerender: () => void) {
    const before = save.petals;
    const res = buy(it.key);
    if (!res.ok) {
      haptic.warn();
      toast(res.reason === 'petals' ? `You need ${res.missing} more petals` : 'This can’t be bought right now');
      rerender();
      return;
    }
    btn.setAttribute('disabled', '');
    const rm = reducedMotion();
    flyPetals(before, save.petals, stage, rm);
    const landAt = rm ? 0 : 620;
    setTimeout(() => {
      setBalance();
      if (it.consumable) {
        sfx.reveal();
        haptic.success();
        if (it.key === TOOL.card && res.drawn != null) {
          closeAll();
          revealCard(res.drawn);
        } else {
          floatNote(stage, it.key === TOOL.tea ? '+1 cup' : '+3');
          changedKeys = [it.key];
          rerender();
          // The "you have" line turns green for a moment: the purchase landed.
          const have = stage.parentElement?.querySelector('.mk-have');
          if (have) {
            have.classList.add('mk-note--on');
            have.insertAdjacentHTML('afterbegin', ICONS.check);
          }
        }
      } else {
        sfx.stamp();
        haptic.success();
        stampYours(stage, rm);
        changedKeys = [it.key];
        rerender();
      }
      refresh();
    }, landAt);
  }

  /** Petals lift off the balance and drift into the item. */
  function flyPetals(from: number, to: number, target: HTMLElement, rm: boolean) {
    const src = balance.getBoundingClientRect();
    if (rm || !src.width) {
      setBalance(to);
      return;
    }
    // A copy of the balance floats above the sheet's scrim and counts down.
    const ghost = h('span', { class: 'petals mk-ghost', 'aria-hidden': 'true', html: `${ICONS.petal}<span class="petals__n num">${fmt(from)}</span>` });
    Object.assign(ghost.style, { left: `${src.left}px`, top: `${src.top}px`, width: `${src.width}px`, height: `${src.height}px` });
    document.body.append(ghost);
    const n = ghost.querySelector('.petals__n')!;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 650);
      n.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const dst = target.getBoundingClientRect();
    const sx = src.left + 20;
    const sy = src.top + src.height / 2;
    const tx = dst.left + dst.width / 2;
    const ty = dst.top + dst.height / 2;
    const count = Math.min(9, Math.max(4, Math.round((from - to) / 60)));
    for (let k = 0; k < count; k++) {
      const p = h('i', { class: 'mk-fly', 'aria-hidden': 'true', html: ICONS.petal });
      p.style.left = `${sx - 9}px`;
      p.style.top = `${sy - 9}px`;
      const dx = tx - sx + (Math.random() - 0.5) * 60;
      const dy = ty - sy + (Math.random() - 0.5) * 30;
      p.style.setProperty('--dx', `${dx.toFixed(0)}px`);
      p.style.setProperty('--dy', `${dy.toFixed(0)}px`);
      p.style.setProperty('--mx', `${(dx * 0.35 - 30 - Math.random() * 40).toFixed(0)}px`);
      p.style.setProperty('--my', `${(dy * 0.25 - 20).toFixed(0)}px`);
      p.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 300)}deg`);
      p.style.animationDelay = `${k * 45}ms`;
      document.body.append(p);
      setTimeout(() => p.remove(), 760 + k * 45);
    }
    setTimeout(() => ghost.classList.add('is-out'), 900);
    setTimeout(() => ghost.remove(), 1200);
  }

  function stampYours(stage: HTMLElement, rm: boolean) {
    stage.querySelector('.mk-seal--big')?.remove();
    const s = frag(`<span class="mk-seal mk-seal--big${rm ? ' is-still' : ''}" aria-hidden="true"><b>Yours</b><small lang="ko">내 것</small></span>`);
    stage.append(s);
    if (!rm) {
      stage.classList.remove('is-thump');
      void stage.offsetWidth;
      stage.classList.add('is-thump');
    }
  }

  function floatNote(stage: HTMLElement, text: string) {
    const n = h('span', { class: 'mk-float', 'aria-hidden': 'true' }, text);
    stage.append(n);
    setTimeout(() => n.remove(), 1100);
  }

  /** Album card: the back turns over to show the new card. */
  function revealCard(id: number) {
    const m = monthDef(id);
    const d = cardDef(id);
    const rm = reducedMotion();
    const c = frag(`<div class="detail mk-reveal${rm ? ' is-still' : ''}">
      <div class="mk-flip"><div class="mk-flip__inner"><span class="mk-flip__face mk-flip__back">${cardSvg('back')}</span><span class="mk-flip__face mk-flip__front">${cardSvg(id)}</span></div><i class="mk-flip__glint" aria-hidden="true"></i></div>
      <div class="mk-reveal__text">
        <div class="detail__kind">New card · ${new Set(save.album).size}/48</div>
        <h2>${esc(m.en)}${d.kind === 'plain' ? '' : ` · ${esc(d.en)}`}</h2>
        <p class="muted"><span class="serif" lang="ko">${m.ko}</span> ${esc(m.koRoman)} · <span class="ja" lang="ja">${m.ja}</span> ${esc(m.jaRoman)}</p>
      </div>
    </div>`);
    const actions = h('div', { class: 'sheet__actions' });
    c.append(actions);
    const s = openSheet(c, { center: true, label: 'New card' });
    actions.append(
      h('button', { class: 'btn btn--primary btn--block', onclick: () => s.close() }, 'Lovely'),
      h('button', { class: 'btn btn--quiet btn--block', onclick: () => { s.close(); nav.album(); } }, 'See it in the Album'),
    );
    if (!rm) setTimeout(() => sfx.reveal(), 380);
    refresh();
  }

  function refresh() {
    setBalance();
    showTab(current, true);
  }

  showTab(startTab);
  // While the player looks around, prepare the deck previews in idle time (one
  // card per idle slot), so the Decks tab opens warm. Then the drawn art of the
  // other tabs, one sprite symbol or garden vignette per idle slot, so a tile's
  // art is ready by the time it's painted.
  const warmArt = [
    ...itemsIn('tool').map((it) => `tool-${it.id}`),
    'inkstone',
    'weight',
    ...['plain', ...itemsIn('paper').filter((it) => !it.source && !it.isDefault).map((it) => it.id)].map((id) => `paper-${id}`),
    ...[...MUSIC_IDS].map((id) => `music-${id}`),
  ];
  const warm: (() => void)[] = [
    ...itemsIn('deck').flatMap((it) => DECK_CARDS.map((id) => () => cardPreviewSvg(id, it.id))),
    ...warmArt.map((sym) => () => art(sym)),
    ...itemsIn('garden').filter(isListed).map((it) => () => gardenItemSvgCached(it.id)),
  ];
  let warmId = 0;
  const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : window.setTimeout(fn, 120));
  const unidle = (n: number) => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(n) : clearTimeout(n));
  const warmNext = () => {
    if (!el.isConnected) return;
    const job = warm.shift();
    if (!job) return;
    job();
    warmId = idle(warmNext);
  };
  warmId = idle(warmNext);
  return {
    name: 'market',
    el,
    destroy() {
      unidle(warmId);
      music.stopPreview();
      openDemo?.stop();
    },
  };
}
