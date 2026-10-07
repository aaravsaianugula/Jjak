import { MONTH_TINTS, cardSvg } from '../../art/cards';
import { ECONOMY, LINKS } from '../../config';
import { cardDef, monthDef, KIND_LABEL, MONTHS } from '../../data/deck';
import { type Point, STONE, cardsLeft, isCard } from '../../engine/board';
import { type LevelSpec, RUSH, chapterOf, dailyTheme, journeyLevel, rushLevel, zenLevel } from '../../engine/levels';
import { COMBO_WINDOW_MS, FEVER_MS, Session, formatTime } from '../../engine/session';
import { type Yaku, possibleYaku } from '../../engine/yaku';
import { checkSeals, type Seal } from '../../services/achievements';
import { emit } from '../../services/events';
import { ads } from '../../services/ads';
import { sfx, unlockAudio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { music } from '../../services/music';
import { REMINDER_TIMES, disableReminder, enableReminder, planReminders } from '../../services/reminders';
import { type ClearSummary, completedMonths, drawCard, formatCountdown, localToday, msToNextDaily, recordClear, recordRush, shareTextFor } from '../../services/progress';
import { store } from '../../services/store';
import { AD_POLICY } from '../../config';
import { shareText } from '../../services/share';
import { persist, save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h, toast, wait } from '../dom';
import { ICONS } from '../icons';
import { choose, openSheet } from '../modal';
import { showHowToPlay } from './settings';
import { boardReport } from '../../services/meta';
import { pathResult, rankUpMoment } from './path';
import { nav } from '../nav';
import { MARKET_PAPER_IDS } from '../../data/market';
import { activeBrush, activeFx } from '../../services/market';
import { brushStroke, burstFx } from '../brush-fx';

const MARGIN = 0.32; // outer lane for paths, in card widths
const ASPECT = 1.4; // card height / width
const GAP = 0.06; // gap between cards, in card widths
const SVG_NS = 'http://www.w3.org/2000/svg';

const COMBO_WORDS = ['', '', 'Pair', 'Nice', 'Lovely', 'Brilliant'];
/** Ink-path timing (ms): the brush crosses the board, holds, then soaks away. */
const INK_DRAW = 210;
const INK_LIFE = 900;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n: number) => n.toLocaleString('en-US');
/** Re-run a one-shot CSS animation class. */
function retrigger(node: Element | null | undefined, cls: string) {
  if (!node) return;
  node.classList.remove(cls);
  void (node as HTMLElement).offsetWidth;
  node.classList.add(cls);
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function titleFor(spec: LevelSpec): string {
  if (spec.mode === 'daily') return `Daily #${spec.number}`;
  if (spec.mode === 'rush') return 'Rush';
  if (spec.mode === 'zen') return 'Zen';
  return `Level ${spec.number}`;
}

let uid = 0;

export function gameScreen(initialSpec: LevelSpec): Screen {
  let spec = initialSpec;
  let session = new Session(spec, performance.now());
  let total = cardsLeft(session.board);
  const gid = ++uid;
  // Journey plays its chapter's season; other modes follow the real calendar.
  music.setSeason(spec.mode === 'journey' ? Math.floor((spec.number - 1) / 12) % 4 : [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][new Date().getMonth()]);
  /** Rush run state (null in other modes). */
  const rush =
    spec.mode === 'rush'
      ? { runSeed: spec.seed.replace(/-r\d+$/, ''), round: 0, banked: 0, left: RUSH.startMs, continued: false, pairs: 0, bestCombo: 0, last: 0, over: false }
      : null;

  // ── Layout ────────────────────────────────────────────────────────
  const timeEl = h('b', { class: 'hud__v hud__v--time' }, spec.mode === 'zen' ? `0/${total / 2}` : rush ? formatTime(RUSH.startMs) : '0:00');
  const scoreEl = h('b', { class: 'hud__v hud__v--score' }, '0');
  const leftEl = h('b', { class: 'hud__v hud__v--left' }, String(total / 2));
  const scoreStat = h('div', { class: 'hud__stat hud__stat--score' }, h('span', { class: 'hud__k' }, 'Score'), scoreEl);
  const bar = h('i');
  const board = h('div', { class: 'board', role: 'group', 'aria-label': 'Card board' });
  const air = h('div', { class: 'fever-air', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'stage' }, air, board);
  const coachText = h('span', { class: 'coach__text' });
  const coach = h('div', { class: 'coach', role: 'status', hidden: true }, h('span', { class: 'coach__mark', 'aria-hidden': 'true' }, '짝'), coachText);
  const sr = h('div', { class: 'g-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const live = (msg: string) => {
    sr.textContent = '';
    requestAnimationFrame(() => (sr.textContent = msg));
  };

  const hintBadge = h('span', { class: 'tool__badge', 'aria-hidden': 'true' });
  const shuffleBadge = h('span', { class: 'tool__badge', 'aria-hidden': 'true' });
  const hintNote = h('span', { class: 'g-sr', id: `g${gid}-hint-n` });
  const shuffleNote = h('span', { class: 'g-sr', id: `g${gid}-shuffle-n` });
  const hintBtn = h(
    'button',
    { class: 'tool tool--hint', 'aria-label': 'Hint', 'aria-describedby': `g${gid}-hint-n`, html: ICONS.hint },
    h('span', { class: 'tool__label' }, 'Hint'),
    hintBadge,
    hintNote,
  );
  const shuffleBtn = h(
    'button',
    { class: 'tool tool--shuffle', 'aria-label': 'Shuffle', 'aria-describedby': `g${gid}-shuffle-n`, html: ICONS.shuffle },
    h('span', { class: 'tool__label' }, 'Shuffle'),
    shuffleBadge,
    shuffleNote,
  );
  const restartBtn = h('button', { class: 'tool tool--quiet', 'aria-label': 'Restart', html: ICONS.restart }, h('span', { class: 'tool__label' }, 'Restart'));

  const twist = spec.gravity ? ' · Falling leaves' : spec.snow ? ' · First snow' : '';
  const sub =
    spec.mode === 'journey'
      ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ja}${twist}`
      : spec.mode === 'daily'
        ? `${dailyTheme(spec.seed.replace('daily-', '')).name} · same board worldwide`
        : rush
          ? `Score attack · best ${fmt(save.rush.best)}`
          : 'No clock, no pressure';

  // Rhythm row: the live combo, its draining window, and the Fever tag. It sits
  // between the HUD and the board, so it never covers a card.
  const comboEl = h('div', { class: 'combo', 'aria-hidden': 'true' });
  const comboBar = h('div', { class: 'combo-bar', 'aria-hidden': 'true' }, h('i'));
  comboBar.style.setProperty('--combo-ms', `${COMBO_WINDOW_MS}ms`);
  const feverTag = h('div', { class: 'fever-tag', 'aria-hidden': 'true' }, h('b', {}, '만개'), h('span', {}, '×2'));
  feverTag.style.setProperty('--fever-ms', `${FEVER_MS}ms`);
  const rhythm = h('div', { class: 'rhythm' }, comboEl, comboBar, feverTag);

  const topTitle = h(
    'div',
    { class: 'topbar__title' },
    h('span', { class: 'topbar__name' }, titleFor(spec)),
    h('span', { class: 'topbar__sub' }, sub),
  );
  const topbar = h(
    'header',
    { class: 'topbar game__top' },
    h('button', { class: 'icon-btn', 'aria-label': 'Back', html: ICONS.back, onclick: () => leave() }),
    topTitle,
    h('button', { class: 'icon-btn', 'aria-label': 'Pause', html: ICONS.pause, onclick: () => openPause() }),
  );
  const el = h(
    'section',
    { class: `screen game game--${spec.mode}` },
    topbar,
    h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud__stat hud__stat--time' }, h('span', { class: 'hud__k' }, spec.mode === 'zen' ? 'Pairs' : rush ? 'Time left' : 'Time'), timeEl),
      h('div', { class: 'hud__stat hud__stat--mid' }, h('span', { class: 'hud__k' }, 'Pairs left'), leftEl),
      scoreStat,
    ),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Board progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, bar),
    rhythm,
    stage,
    coach,
    h('nav', { class: 'toolbar', 'aria-label': 'Tools' }, hintBtn, shuffleBtn, restartBtn),
    sr,
  );
  const progressEl = bar.parentElement!;

  // ── Board rendering ───────────────────────────────────────────────
  let cw = 40; // card width px
  let ch = 56;
  let margin = 16;
  const cardEls = new Map<number, HTMLElement>();
  const paperMonth = save.paper === 'plain' ? -1 : Number(save.paper);
  const paper = h('div', {
    class: 'paper',
    'aria-hidden': 'true',
    html: paperMonth >= 0 ? `<svg viewBox="0 0 100 140"><use href="#motif-${paperMonth}"/></svg>` : '',
  });
  if (paperMonth >= 0) paper.style.setProperty('--paper-tint', MONTH_TINTS[paperMonth]);
  if (MARKET_PAPER_IDS.includes(save.paper)) paper.classList.add('paper--market', `paper--${save.paper}`);
  const paths = document.createElementNS(SVG_NS, 'svg');
  paths.classList.add('paths');
  paths.setAttribute('aria-hidden', 'true');

  const xOf = (c: number) => (c < 0 ? margin / 2 : c >= spec.cols ? margin + spec.cols * cw + margin / 2 : margin + (c + 0.5) * cw);
  const yOf = (r: number) => (r < 0 ? margin / 2 : r >= spec.rows ? margin + spec.rows * ch + margin / 2 : margin + (r + 0.5) * ch);
  /** Centre of a cell in board coordinates (no layout reads). */
  const cellXY = (cell: number) => ({ x: xOf(cell % spec.cols), y: yOf(Math.floor(cell / spec.cols)) });

  function layout() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    if (!w || !hgt) return;
    const byW = w / (spec.cols + 2 * MARGIN);
    const byH = hgt / (spec.rows * ASPECT + 2 * MARGIN);
    cw = Math.floor(Math.min(byW, byH, 96));
    ch = Math.round(cw * ASPECT);
    margin = Math.round(cw * MARGIN);
    board.style.width = `${spec.cols * cw + 2 * margin}px`;
    board.style.height = `${spec.rows * ch + 2 * margin}px`;
    const gap = Math.max(2, Math.round(cw * GAP));
    for (const [i, cel] of cardEls) {
      const r = Math.floor(i / spec.cols);
      const c = i % spec.cols;
      cel.style.left = `${margin + c * cw + gap / 2}px`;
      cel.style.top = `${margin + r * ch + gap / 2}px`;
      cel.style.width = `${cw - gap}px`;
      cel.style.height = `${ch - gap}px`;
    }
  }

  function faceLabel(id: number) {
    const m = monthDef(id);
    const d = cardDef(id);
    return `${m.en}, month ${m.index + 1}${d.kind === 'plain' ? '' : `, ${d.en}`}`;
  }

  function renderBoard() {
    board.replaceChildren(paper);
    cardEls.clear();
    session.board.cells.forEach((v, i) => {
      if (v === STONE) {
        const s = h('div', { class: 'stone', 'aria-hidden': 'true' });
        cardEls.set(i, s);
        board.append(s);
      } else if (isCard(v)) {
        const snowy = session.hidden.has(i);
        const c = h('button', {
          class: `card${snowy ? ' is-snow' : ''}`,
          'data-cell': i,
          'aria-label': snowy ? 'Card under snow' : faceLabel(v),
          'aria-pressed': 'false',
          html: cardSvg(snowy ? 'snow' : v),
        });
        cardEls.set(i, c);
        board.append(c);
      }
    });
    board.append(paths);
    layout();
  }

  /** Deal the cards in with a short diagonal cascade (skipped for reduced motion). */
  let dealTimer: ReturnType<typeof setTimeout> | null = null;
  function deal(startMs: number, step = 22) {
    if (reducedMotion()) return;
    let last = 0;
    for (const [i, c] of cardEls) {
      const r = Math.floor(i / spec.cols);
      const col = i % spec.cols;
      const d = startMs + Math.min(14, r + col) * step + ((r * 7 + col * 3) % 4) * 6;
      last = Math.max(last, d);
      c.style.setProperty('--deal', `${d}ms`);
      c.style.setProperty('--tilt', `${((r + col) % 3) - 1}deg`);
      c.classList.add('is-deal');
    }
    if (dealTimer) clearTimeout(dealTimer);
    dealTimer = setTimeout(() => board.querySelectorAll('.is-deal').forEach((c) => c.classList.remove('is-deal')), last + 420);
  }

  function refreshFaces(flip: boolean) {
    const rm = reducedMotion();
    session.board.cells.forEach((v, i) => {
      const c = cardEls.get(i);
      if (!c || !isCard(v) || c.classList.contains('stone')) return;
      const snowy = session.hidden.has(i);
      const swap = () => {
        c.innerHTML = cardSvg(snowy ? 'snow' : v);
        c.classList.toggle('is-snow', snowy);
        c.setAttribute('aria-label', snowy ? 'Card under snow' : faceLabel(v));
      };
      if (flip && !rm) {
        // A quick riffle: each card turns a beat after its neighbour.
        const d = ((Math.floor(i / spec.cols) + (i % spec.cols)) % 10) * 16;
        c.classList.remove('is-deal');
        c.style.setProperty('--flip-d', `${d}ms`);
        retrigger(c, 'is-flip');
        setTimeout(swap, 200 + d);
        setTimeout(() => c.classList.remove('is-flip'), 440 + d);
      } else swap();
    });
  }

  // ── Ink path ──────────────────────────────────────────────────────
  let strokeSeq = 0;
  /**
   * A brush stroke along the real path corners: a tapered, pressure-varying ink
   * body (revealed by an animated mask), a soft wash under it, dry-brush streaks,
   * and a few splatters where the brush turns.
   */
  function drawPath(pts: Point[]) {
    const P = pts.map((p) => ({ x: xOf(p.c), y: yOf(p.r) }));
    const n = P.length;
    if (n < 2) return;
    // Market brushes (the default ink below is unchanged).
    if (activeBrush() !== 'ink') return brushStroke(paths, P, activeBrush(), { cw, uid: `ink-${gid}-${++strokeSeq}`, width: board.clientWidth, height: board.clientHeight, still: reducedMotion() });
    const dirs: { x: number; y: number }[] = [];
    const lens: number[] = [];
    let L = 0;
    for (let i = 1; i < n; i++) {
      const dx = P[i].x - P[i - 1].x;
      const dy = P[i].y - P[i - 1].y;
      const d = Math.hypot(dx, dy) || 1;
      dirs.push({ x: dx / d, y: dy / d });
      lens.push(d);
      L += d;
    }
    if (L < 2) return;
    const w = Math.max(3.8, cw * 0.1);
    const seed = Math.random() * 6.28;
    const nrm = (d: { x: number; y: number }) => ({ x: -d.y, y: d.x });
    // Miter normal at a vertex, scaled so a unit offset keeps the stroke width.
    const miter = (i: number) => {
      if (i === 0) return nrm(dirs[0]);
      if (i === n - 1) return nrm(dirs[n - 2]);
      const a = nrm(dirs[i - 1]);
      const b = nrm(dirs[i]);
      const k = 1 + a.x * b.x + a.y * b.y;
      return k < 0.2 ? b : { x: (a.x + b.x) / k, y: (a.y + b.y) / k };
    };
    // Distance along the stroke of each vertex.
    const at: number[] = [0];
    for (let i = 0; i < lens.length; i++) at.push(at[i] + lens[i]);
    const cornerBump = (s: number) => {
      let b = 0;
      for (let i = 1; i < n - 1; i++) b = Math.max(b, 1 - Math.abs(s - at[i]) / (cw * 0.35));
      return 0.16 * b;
    };
    const widthAt = (s: number) => {
      const t = s / L;
      const press = 0.62 + 0.38 * smooth(0, 0.07, t);
      const lift = 1 - 0.84 * smooth(0.66, 1, t) ** 1.25;
      const wobble = 1 + 0.07 * Math.sin(s / (cw * 0.55) + seed) + 0.04 * Math.sin(s / (cw * 0.21) + seed * 2);
      return w * press * lift * wobble * (1 + cornerBump(s));
    };
    // Sample the centreline every ~5px, using the miter at the real corners.
    type S = { x: number; y: number; mx: number; my: number; w: number };
    const samples: S[] = [];
    for (let i = 0; i < n - 1; i++) {
      const steps = Math.max(2, Math.ceil(lens[i] / 5));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const m = k === 0 ? miter(i) : nrm(dirs[i]);
        const s = at[i] + lens[i] * t;
        samples.push({ x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t, mx: m.x, my: m.y, w: widthAt(s) });
      }
    }
    const mEnd = miter(n - 1);
    samples.push({ x: P[n - 1].x, y: P[n - 1].y, mx: mEnd.x, my: mEnd.y, w: widthAt(L) });
    const f = (v: number) => v.toFixed(1);
    const side = (sg: number) => samples.map((p) => `${f(p.x + (p.mx * p.w * sg) / 2)},${f(p.y + (p.my * p.w * sg) / 2)}`);
    const left = side(1);
    const right = side(-1);
    const d0 = dirs[0];
    const dn = dirs[n - 2];
    const s0 = samples[0];
    const sn = samples[samples.length - 1];
    const body =
      `M${right[0]} Q${f(s0.x - d0.x * s0.w * 0.95)},${f(s0.y - d0.y * s0.w * 0.95)} ${left[0]} L${left.slice(1).join(' L')} ` +
      `Q${f(sn.x + dn.x * sn.w * 1.6)},${f(sn.y + dn.y * sn.w * 1.6)} ${right[right.length - 1]} L${right.slice(0, -1).reverse().join(' L')} Z`;
    const centre = P.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
    const offsetLine = (k: number) => P.map((p, i) => {
      const m = miter(i);
      return `${f(p.x + m.x * w * k)},${f(p.y + m.y * w * k)}`;
    }).join(' ');

    const sid = `ink-${gid}-${++strokeSeq}`;
    const mk = (tag: string, attrs: Record<string, string | number>, cls?: string) => {
      const e = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      if (cls) e.setAttribute('class', cls);
      return e;
    };
    const g = mk('g', {}, 'stroke');
    g.style.setProperty('--len', f(L + w * 3));
    g.style.setProperty('--draw', `${INK_DRAW}ms`);
    // Reveal mask: a fat round stroke that runs along the path.
    const mask = mk('mask', { id: sid, maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: board.clientWidth + 80, height: board.clientHeight + 80 });
    mask.append(mk('polyline', { points: centre, 'stroke-width': f(w * 3.2), 'stroke-dasharray': `${f(L + w * 3)} ${f(L + w * 6)}` }, 'ink-reveal'));
    g.append(mask);
    // Wash: the ink spreading into the paper fibres (two layers fake a soft edge).
    for (const [k, cls] of [[3.8, 'ink-wash ink-wash--soft'], [2.2, 'ink-wash']] as const) {
      g.append(mk('polyline', { points: centre, 'stroke-width': f(w * k), 'stroke-dasharray': `${f(L + w * 3)} ${f(L + w * 6)}` }, cls));
    }
    [P[0], P[n - 1]].forEach((p, k) => {
      const soak = mk('circle', { cx: f(p.x), cy: f(p.y), r: f(w * 1.7) }, 'ink-soak');
      if (k) soak.style.animationDelay = `${Math.round(INK_DRAW * 0.85)}ms`;
      g.append(soak);
    });
    // Body, then dry-brush streaks (flying white) as the ink runs out.
    const inked = mk('g', { mask: `url(#${sid})` }, 'ink-core');
    inked.append(mk('path', { d: body }, 'ink-body'));
    // Short, broken flecks of bare paper inside the tail of the stroke.
    const dry = (from: number) => {
      const parts = [0, L * from];
      for (let s = L * from; s < L; ) {
        const d = w * (0.8 + Math.random() * 2.2);
        const gap = w * (1.2 + Math.random() * 3);
        parts.push(d, gap);
        s += d + gap;
      }
      parts.push(0, L);
      return parts.map(f).join(' ');
    };
    inked.append(mk('polyline', { points: offsetLine(0.16), 'stroke-width': f(Math.max(0.7, w * 0.09)), 'stroke-dasharray': dry(0.5 + Math.random() * 0.1) }, 'ink-dry'));
    inked.append(mk('polyline', { points: offsetLine(-0.14), 'stroke-width': f(Math.max(0.6, w * 0.07)), 'stroke-dasharray': dry(0.66 + Math.random() * 0.1) }, 'ink-dry'));
    g.append(inked);
    // Splatter at each turn, flung to the outside of the corner when the brush arrives.
    const dots = mk('g', {}, 'ink-dots');
    for (let i = 1; i < n - 1; i++) {
      const a = dirs[i - 1];
      const b = dirs[i];
      const ox = a.x - b.x;
      const oy = a.y - b.y;
      const ol = Math.hypot(ox, oy) || 1;
      const delay = (INK_DRAW * at[i]) / L;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < count; k++) {
        const dist = w * (0.95 + k * 0.55 + Math.random() * 0.4);
        const jit = (Math.random() - 0.5) * w * 0.9;
        const dot = mk('circle', {
          cx: f(P[i].x + (ox / ol) * dist + (-oy / ol) * jit),
          cy: f(P[i].y + (oy / ol) * dist + (ox / ol) * jit),
          r: f(w * (0.3 - k * 0.07) * (0.8 + Math.random() * 0.4)),
        }, 'ink-dot');
        dot.style.animationDelay = `${Math.round(delay)}ms`;
        dots.append(dot);
      }
    }
    // A last flick of ink just past the lifted brush.
    const flick = mk('circle', { cx: f(P[n - 1].x + dn.x * w * 2.1), cy: f(P[n - 1].y + dn.y * w * 2.1), r: f(w * 0.16) }, 'ink-dot');
    flick.style.animationDelay = `${INK_DRAW}ms`;
    dots.append(flick);
    g.append(dots);
    if (reducedMotion()) g.classList.add('is-still');
    paths.append(g);
    setTimeout(() => g.remove(), reducedMotion() ? 520 : INK_LIFE);
  }

  /** Petals and a few ink droplets scatter from a cleared card. */
  function petals(cell: number) {
    if (reducedMotion()) return;
    const { x, y } = cellXY(cell);
    // Market effects (the default blossom below is unchanged).
    if (activeFx() !== 'blossom') return void burstFx(board, x, y, activeFx(), { cw });
    const colors = ['#e3a5b0', '#d98a98', '#c4472f', '#e6c27a', '#f2d4da'];
    for (let k = 0; k < 7; k++) {
      const ink = k >= 5;
      const p = h('i', { class: ink ? 'petal petal--ink' : 'petal' });
      const a = (k / 7) * Math.PI * 2 + Math.random() * 0.8;
      const d = cw * (ink ? 0.35 + Math.random() * 0.3 : 0.55 + Math.random() * 0.55);
      p.style.left = `${x - 5}px`;
      p.style.top = `${y - 5}px`;
      if (!ink) p.style.background = colors[k % colors.length];
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      p.style.setProperty('--dy', `${Math.sin(a) * d - cw * 0.1}px`);
      p.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
      board.append(p);
      setTimeout(() => p.remove(), 760);
    }
  }

  // ── Combo, Fever and banners ──────────────────────────────────────
  let comboHide: ReturnType<typeof setTimeout> | null = null;
  function showCombo(n: number) {
    if (comboHide) clearTimeout(comboHide);
    if (n < 2) {
      comboEl.classList.remove('is-on');
      return;
    }
    comboEl.replaceChildren(h('b', {}, '짝'.repeat(n)), h('span', {}, `×${n} · ${COMBO_WORDS[n]}`));
    comboEl.classList.toggle('is-max', n >= 5);
    comboEl.classList.add('is-on');
    retrigger(comboEl, 'is-pop');
    comboHide = setTimeout(() => comboEl.classList.remove('is-on'), COMBO_WINDOW_MS);
  }

  /**
   * Named banners (Fever, card sets) take the title's place in the top bar, one at
   * a time. A newer banner cuts the current one short once it has been readable.
   */
  const BANNER_MIN_MS = 750;
  const bannerQ: { node: HTMLElement; ms: number }[] = [];
  let bannerNow: { node: HTMLElement; at: number; timer: ReturnType<typeof setTimeout>; ending?: boolean } | null = null;
  function banner(node: HTMLElement, ms: number, first = false) {
    if (first) bannerQ.unshift({ node, ms });
    else bannerQ.push({ node, ms });
    if (!bannerNow) nextBanner();
    else if (!bannerNow.ending) {
      clearTimeout(bannerNow.timer);
      bannerNow.timer = setTimeout(endBanner, Math.max(0, BANNER_MIN_MS - (performance.now() - bannerNow.at)));
    }
  }
  function endBanner() {
    const cur = bannerNow;
    if (!cur || cur.ending) return;
    cur.ending = true;
    cur.node.classList.add('is-out');
    setTimeout(() => {
      cur.node.remove();
      bannerNow = null;
      nextBanner();
    }, 260);
  }
  function nextBanner() {
    const it = bannerQ.shift();
    if (!it) {
      topbar.classList.remove('is-announcing');
      return;
    }
    topbar.classList.add('is-announcing');
    it.node.classList.add('banner');
    it.node.setAttribute('aria-hidden', 'true');
    topbar.append(it.node);
    bannerNow = { node: it.node, at: performance.now(), timer: setTimeout(endBanner, bannerQ.length ? BANNER_MIN_MS : it.ms) };
  }

  // ── HUD ───────────────────────────────────────────────────────────
  let scoreShown = 0;
  let scoreRaf = 0;
  /** The score ticks up to its new value instead of jumping. */
  function renderScore(target: number) {
    cancelAnimationFrame(scoreRaf);
    if (target <= scoreShown || reducedMotion()) {
      scoreShown = target;
      scoreEl.textContent = fmt(target);
      return;
    }
    const from = scoreShown;
    const t0 = performance.now();
    const dur = Math.min(700, 320 + (target - from) / 6);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      scoreShown = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      scoreEl.textContent = fmt(scoreShown);
      if (k < 1) scoreRaf = requestAnimationFrame(step);
    };
    scoreRaf = requestAnimationFrame(step);
    retrigger(scoreEl, 'is-bump');
  }
  function scoreGain(n: number) {
    if (n <= 0) return;
    scoreStat.querySelectorAll('.hud__gain').forEach((x) => x.remove());
    const g = h('span', { class: 'hud__gain', 'aria-hidden': 'true' }, `+${fmt(n)}`);
    scoreStat.append(g);
    setTimeout(() => g.remove(), 900);
  }

  function updateHud() {
    renderScore((rush?.banked ?? 0) + session.score);
    const left = cardsLeft(session.board);
    leftEl.textContent = String(left / 2);
    const done = total ? (total - left) / total : 0;
    bar.style.transform = `scaleX(${done})`;
    progressEl.setAttribute('aria-valuenow', String(Math.round(done * 100)));
    if (spec.mode === 'zen') timeEl.textContent = `${session.pairsMade}/${total / 2}`;
    const badge = (b: HTMLElement, note: HTMLElement, n: number) => {
      b.textContent = n > 0 ? (n > 99 ? '99+' : String(n)) : '+';
      b.classList.toggle('tool__badge--ad', n === 0);
      note.textContent = n > 0 ? `${n} left` : 'None left. Watch an ad or spend petals for more.';
    };
    badge(hintBadge, hintNote, save.hints);
    badge(shuffleBadge, shuffleNote, save.shuffles);
  }

  let paused = false;
  let pausedAt = 0;
  let lastSec = -1;
  const tick = setInterval(() => {
    if (rush) {
      const now = performance.now();
      const dt = rush.last ? now - rush.last : 0;
      rush.last = now;
      if (paused || rush.over || busy) return;
      rush.left = Math.max(0, rush.left - dt);
      timeEl.textContent = formatTime(rush.left + 999);
      const urgent = rush.left < 10_000;
      el.classList.toggle('is-urgent', urgent);
      const sec = Math.ceil(rush.left / 1000);
      if (urgent && sec !== lastSec && sec > 0) retrigger(timeEl, 'is-tick');
      lastSec = sec;
      if (rush.left <= 0) void endRush();
      return;
    }
    if (paused || session.done || spec.mode === 'zen') return;
    timeEl.textContent = formatTime(session.elapsedMs(performance.now()));
  }, 250);

  // ── Input ─────────────────────────────────────────────────────────
  let hintCells: number[] = [];
  const clearHint = () => {
    hintCells.forEach((i) => cardEls.get(i)?.classList.remove('is-hint'));
    hintCells = [];
  };
  let busy = false;

  const select = (c: HTMLElement | undefined, on: boolean) => {
    if (!c) return;
    if (on) c.classList.remove('is-shake', 'is-deal');
    c.classList.toggle('is-selected', on);
    c.setAttribute('aria-pressed', String(on));
  };

  function tapCard(target: HTMLElement) {
    if (busy || session.done) return;
    unlockAudio();
    target.classList.remove('is-deal');
    const cell = Number(target.dataset.cell);
    const res = session.tap(cell, performance.now());
    switch (res.kind) {
      case 'select':
        select(target, true);
        sfx.tap();
        haptic.light();
        break;
      case 'deselect':
        select(target, false);
        sfx.deselect();
        break;
      case 'reselect':
        select(cardEls.get(res.from), false);
        select(target, true);
        sfx.tap();
        haptic.light();
        break;
      case 'mismatch':
        select(cardEls.get(res.a), false);
        for (const i of [res.a, res.b]) retrigger(cardEls.get(i), 'is-shake');
        sfx.miss();
        haptic.warn();
        live('No path between those two — the way is blocked.');
        if (spec.mode === 'journey' && spec.number <= 3) setCoach('Same flower — but the path between them needs more than two turns. Clear what’s in the way first.');
        break;
      case 'match':
        onMatch(res);
        break;
      case 'hidden':
        retrigger(target, 'is-shake');
        sfx.deselect();
        setCoach('This card is under snow. Clear a card next to it to reveal it.');
        break;
    }
  }

  board.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (!target || busy || session.done) return;
    e.preventDefault();
    tapCard(target);
  });

  // Keyboard: Enter/Space taps the focused card, arrow keys walk the grid.
  board.addEventListener('keydown', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (!target) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tapCard(target);
      return;
    }
    const move = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<string, [number, number]>)[e.key];
    if (!move) return;
    e.preventDefault();
    let r = Math.floor(Number(target.dataset.cell) / spec.cols);
    let c = Number(target.dataset.cell) % spec.cols;
    for (;;) {
      r += move[0];
      c += move[1];
      if (r < 0 || c < 0 || r >= spec.rows || c >= spec.cols) return;
      const next = cardEls.get(r * spec.cols + c);
      if (next && next.classList.contains('card') && !next.classList.contains('is-gone')) {
        next.focus();
        return;
      }
    }
  });

  function onMatch(res: Extract<ReturnType<Session['tap']>, { kind: 'match' }>) {
    clearHint();
    drawPath(res.path);
    const gone = [res.a, res.b].map((i) => cardEls.get(i)).filter((x): x is HTMLElement => !!x);
    for (const i of [res.a, res.b]) petals(i);
    gone.forEach((c, k) => {
      // Each card flutters off its own way, like a paper slip caught by a breath.
      const s = k === 0 ? -1 : 1;
      c.style.setProperty('--fx', `${s * (8 + Math.random() * 14)}px`);
      c.style.setProperty('--fr', `${s * (10 + Math.random() * 16)}deg`);
      c.style.setProperty('--fy', `${s * (25 + Math.random() * 30)}deg`);
      c.classList.remove('is-selected', 'is-deal', 'is-hint');
      c.classList.add('is-gone');
      c.setAttribute('aria-hidden', 'true');
      c.tabIndex = -1;
    });
    cardEls.delete(res.a);
    cardEls.delete(res.b);
    setTimeout(() => gone.forEach((c) => c.remove()), 460);

    // Falling leaves: re-key the moved cards now, slide them once the pair has faded.
    if (res.moved.length) {
      for (const [from, to] of res.moved) {
        const c = cardEls.get(from);
        if (!c) continue;
        cardEls.delete(from);
        cardEls.set(to, c);
        c.dataset.cell = String(to);
        c.classList.add('is-falling');
      }
      setTimeout(() => {
        layout();
        setTimeout(() => cardEls.forEach((c) => c.classList.remove('is-falling')), 320);
      }, 200);
    }
    if (res.revealed.length) {
      setTimeout(() => {
        for (const i of res.revealed) {
          const c = cardEls.get(i);
          const v = session.board.cells[i];
          if (!c || !isCard(v)) continue;
          c.style.setProperty('--flip-d', '0ms');
          c.classList.add('is-flip');
          setTimeout(() => {
            c.innerHTML = cardSvg(v);
            c.classList.remove('is-snow');
            c.setAttribute('aria-label', faceLabel(v));
          }, 200);
          setTimeout(() => c.classList.remove('is-flip'), 440);
        }
      }, res.moved.length ? 420 : 160);
    }

    sfx.match(res.combo);
    haptic.medium();
    emit('pair', { mode: spec.mode, cards: res.cards, combo: res.combo, fever: res.fever, yaku: res.yaku.map((y) => y.id), session });
    showCombo(res.combo);
    if (res.feverStarted) startFever(res.a, res.b);
    if (res.yaku.length) showYaku(res.yaku);
    if (rush) {
      const add = res.combo >= 3 ? RUSH.perComboPairMs : RUSH.perPairMs;
      rush.left += add;
      rush.pairs++;
      rush.bestCombo = Math.max(rush.bestCombo, res.combo);
      floatText(`+${add / 1000}s`, res.b);
      retrigger(timeEl, 'is-plus');
    }
    restartComboBar();
    scoreGain(res.gained);
    updateHud();
    const left = cardsLeft(session.board) / 2;
    live(`Pair${res.combo >= 2 ? `, combo ${res.combo}` : ''}. ${left} ${left === 1 ? 'pair' : 'pairs'} left.`);
    tutorialStep();
    if (res.reshuffled) {
      setTimeout(() => {
        sfx.shuffle();
        refreshFaces(true);
        toast('No moves left — the cards were reshuffled.');
      }, 520);
    }
    if (res.cleared) void (rush ? nextRushBoard() : finish());
  }

  // ── Fever (×5 combo) ──────────────────────────────────────────────
  let feverTimer: ReturnType<typeof setTimeout> | null = null;
  function startFever(a: number, b: number) {
    el.classList.add('is-fever');
    retrigger(feverTag, 'is-on');
    sfx.stamp();
    haptic.success();
    banner(
      h('div', { class: 'fever' }, h('b', {}, '만개 · 満開'), h('span', {}, 'Full bloom · double points')),
      1600,
      true,
    );
    live('Full bloom! Double points for a few seconds.');
    // Warm air: a bloom of colour from the pair, and petals drifting behind the cards.
    if (!reducedMotion()) {
      air.style.setProperty('--air-h', `${stage.clientHeight}px`);
      const p1 = cellXY(a);
      const p2 = cellXY(b);
      const ring = h('i', { class: 'bloom-ring' });
      ring.style.left = `${board.offsetLeft + (p1.x + p2.x) / 2}px`;
      ring.style.top = `${board.offsetTop + (p1.y + p2.y) / 2}px`;
      air.append(ring);
      setTimeout(() => ring.remove(), 1300);
      air.classList.remove('is-fading');
      air.querySelectorAll('.drift').forEach((p) => p.remove());
      {
        const colors = ['#e3a5b0', '#f2d4da', '#d98a98', '#e6c27a'];
        for (let k = 0; k < 12; k++) {
          const p = h('i', { class: 'drift' });
          p.style.left = `${(k / 12) * 100 + Math.random() * 7}%`;
          p.style.background = colors[k % colors.length];
          p.style.animationDelay = `${-Math.random() * 4000}ms`;
          p.style.animationDuration = `${3800 + Math.random() * 2400}ms`;
          p.style.setProperty('--sway', `${(Math.random() - 0.5) * 70}px`);
          p.style.setProperty('--spin', `${(Math.random() - 0.5) * 540}deg`);
          air.append(p);
        }
      }
    }
    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(endFever, FEVER_MS);
  }
  function endFever() {
    el.classList.remove('is-fever');
    feverTag.classList.remove('is-on');
    if (!air.querySelector('.drift')) return;
    air.classList.add('is-fading');
    setTimeout(() => {
      if (el.classList.contains('is-fever')) return;
      air.classList.remove('is-fading');
      air.querySelectorAll('.drift').forEach((p) => p.remove());
    }, 700);
  }

  /** A completed card set: named banner, bonus, and a record for the seal book. */
  function showYaku(list: Yaku[]) {
    for (const y of list) if (!save.yakuSeen.includes(y.id)) save.yakuSeen.push(y.id);
    persist();
    const y = list[list.length - 1];
    const bonus = list.reduce((n, x) => n + x.bonus, 0);
    sfx.reveal();
    haptic.success();
    banner(
      h('div', { class: 'yaku' }, h('b', {}, y.native), h('span', { class: 'yaku__k' }, `Card set +${fmt(bonus)} · ${y.en}`)),
      2000,
    );
    live(`Card set: ${y.en}. Bonus ${bonus}.`);
  }

  /** Small rising label over a cell (Rush time bonus), or a centred stamp for the board. */
  function floatText(text: string, cell: number) {
    const f = h('span', { class: cell < 0 ? 'floater floater--board' : 'floater', 'aria-hidden': 'true' }, text);
    if (cell >= 0) {
      const { x, y } = cellXY(cell);
      f.style.left = `${x}px`;
      f.style.top = `${y - ch * 0.35}px`;
      board.append(f);
      setTimeout(() => f.remove(), 950);
    } else {
      stage.append(f);
      setTimeout(() => f.remove(), 860);
    }
  }

  // ── Rush ──────────────────────────────────────────────────────────
  async function nextRushBoard() {
    if (!rush) return;
    busy = true;
    rush.banked += session.score + RUSH.boardClearBonus;
    rush.left += RUSH.boardClearMs;
    floatText(`Board clear · +${RUSH.boardClearMs / 1000}s`, -1);
    retrigger(timeEl, 'is-plus');
    live(`Board clear. Plus ${RUSH.boardClearMs / 1000} seconds.`);
    sfx.stamp();
    await wait(450);
    rush.round++;
    spec = rushLevel(rush.runSeed, rush.round);
    session = new Session(spec, performance.now());
    total = cardsLeft(session.board);
    board.classList.add('is-swap');
    renderBoard();
    deal(0, 14);
    updateHud();
    setTimeout(() => board.classList.remove('is-swap'), 500);
    busy = false;
  }

  async function endRush() {
    if (!rush || rush.over) return;
    rush.over = true;
    busy = true;
    el.classList.remove('is-urgent');
    sfx.miss();
    haptic.warn();
    const score = rush.banked + session.score;
    const best = score > save.rush.best && save.rush.best > 0;
    const content = frag(`<div class="result result--rush">
      <div class="result__head"><div class="seal result__seal">짝</div><div><div class="result__kicker">Rush · time’s up</div><h2>Time!</h2><div class="muted">Rush · ${rush.round + 1} boards · ${rush.pairs} pairs</div></div></div>
      <div class="rush-score${best ? ' is-best' : ''}"><b>${fmt(score)}</b><span>${best ? 'New best!' : `Best ${fmt(Math.max(save.rush.best, score))}`}</span></div>
      <div class="statline">
        <div><b>${rush.round + 1}</b><span>Boards</span></div>
        <div><b>${rush.pairs}</b><span>Pairs</span></div>
        <div><b>×${rush.bestCombo}</b><span>Best combo</span></div>
      </div>
    </div>`);
    const actions = h('div', { class: 'sheet__actions result__actions' });
    content.append(actions);
    const sheet = openSheet(content, { dismissible: false, label: 'Rush over' });
    live(`Time! Score ${score}.`);

    const finishRun = async (again: boolean) => {
      sheet.close();
      const sum = recordRush(score, rush.round + 1, rush.pairs, rush.bestCombo);
      emit('rush', { score, rounds: rush.round + 1, pairs: rush.pairs, bestCombo: rush.bestCombo });
      const won = checkSeals();
      if (sum.petals) toast(`+${sum.petals} petals${won.length ? ` · Seal earned: ${won.map((w) => w.title).join(', ')}` : ''}`);
      else if (won.length) toast(`Seal earned: ${won.map((w) => w.title).join(', ')}`);
      await ads.betweenBoards(null);
      if (again) nav.game(rushLevel(`rush-${Date.now()}`, 0));
      else nav.home();
    };

    if (!rush.continued && ads.rewardedAvailable) {
      actions.append(
        h('button', {
          class: 'btn btn--accent btn--block',
          html: `${ICONS.ad}<span>Keep going · +${RUSH.continueMs / 1000}s</span>`,
          onclick: async () => {
            const ok = await ads.rewarded();
            if (!ok) return toast('The ad didn’t finish, so no extra time this round.');
            sheet.close();
            rush.continued = true;
            rush.over = false;
            rush.left = RUSH.continueMs;
            busy = false;
            rush.last = performance.now();
          },
        }),
      );
    }
    actions.append(h('button', { class: 'btn btn--primary btn--block', html: `Play again ${ICONS.play}`, onclick: () => void finishRun(true) }));
    actions.append(h('button', { class: 'btn btn--quiet btn--block', onclick: () => void finishRun(false) }, 'Home'));
  }

  let comboBarOff: ReturnType<typeof setTimeout> | null = null;
  function restartComboBar() {
    retrigger(comboBar, 'on');
    if (comboBarOff) clearTimeout(comboBarOff);
    comboBarOff = setTimeout(() => comboBar.classList.remove('on'), COMBO_WINDOW_MS + 200);
  }

  // ── Tools ─────────────────────────────────────────────────────────
  async function acquire(kind: 'hint' | 'shuffle'): Promise<boolean> {
    const have = kind === 'hint' ? save.hints : save.shuffles;
    if (have > 0) return true;
    const cost = kind === 'hint' ? ECONOMY.hintCost : ECONOMY.shuffleCost;
    const name = kind === 'hint' ? 'hints' : 'shuffles';
    const pick = await choose(`Out of ${name}`, `Spend petals, or watch a short ad for one more.`, [
      { key: 'ad', label: 'Watch an ad · +1', style: 'primary', disabled: !ads.rewardedAvailable },
      { key: 'petals', label: `Use ${cost} petals (you have ${save.petals})`, style: 'ghost', disabled: save.petals < cost },
      { key: 'no', label: 'Not now', style: 'quiet' },
    ]);
    if (pick === 'petals') {
      save.petals -= cost;
    } else if (pick === 'ad') {
      paused = true;
      pausedAt = performance.now();
      const ok = await ads.rewarded();
      resume();
      if (!ok) {
        toast('The ad didn’t finish, so no reward this time.');
        return false;
      }
    } else return false;
    if (kind === 'hint') save.hints++;
    else save.shuffles++;
    persist();
    updateHud();
    return true;
  }

  hintBtn.addEventListener('click', async () => {
    if (session.done || busy) return;
    if (hintCells.length) {
      // Already showing: nudge the pair again instead of spending another hint.
      hintCells.forEach((i) => {
        const c = cardEls.get(i);
        retrigger(c, 'is-ping');
        setTimeout(() => c?.classList.remove('is-ping'), 560);
      });
      return;
    }
    if (!(await acquire('hint'))) return;
    const m = session.hint();
    if (!m) return;
    save.hints--;
    persist();
    emit('tool', { kind: 'hint', mode: spec.mode });
    hintCells = m;
    m.forEach((i) => cardEls.get(i)?.classList.add('is-hint'));
    sfx.hint();
    updateHud();
    live('Hint: two matching cards are glowing.');
  });

  shuffleBtn.addEventListener('click', async () => {
    if (session.done || busy) return;
    if (!(await acquire('shuffle'))) return;
    save.shuffles--;
    persist();
    emit('tool', { kind: 'shuffle', mode: spec.mode });
    clearHint();
    select(cardEls.get(session.selected), false);
    session.shuffle();
    sfx.shuffle();
    haptic.light();
    refreshFaces(true);
    updateHud();
    live('Cards shuffled.');
  });

  restartBtn.addEventListener('click', async () => {
    if (busy) return;
    const ok = await choose('Restart this board?', 'Your time and score start over.', [
      { key: 'yes', label: 'Restart', style: 'primary' },
      { key: 'no', label: 'Keep playing', style: 'quiet' },
    ]);
    if (ok !== 'yes') return;
    restartBoard();
  });

  // ── Tutorial coach marks ──────────────────────────────────────────
  function setCoach(text: string | null) {
    if (!text) {
      coach.hidden = true;
      return;
    }
    if (!coach.hidden && coachText.textContent === text) return;
    coachText.textContent = text;
    coach.hidden = false;
    retrigger(coach, 'is-new');
  }
  let coachStep = 0;
  function tutorialStep() {
    if (spec.mode !== 'journey' || spec.number > 2) return;
    coachStep++;
    if (spec.number === 1 && coachStep === 1) setCoach('A path can bend up to twice, and may run around the outside of the board.');
    else if (coachStep >= 3) setCoach(null);
  }
  function startTutorial() {
    if (spec.mode !== 'journey') return;
    if (spec.number === 1) {
      setCoach('Tap two cards with the same flower to make a jjak (짝) — a pair.');
      const m = session.hint();
      session.hintsUsed = 0; // the teaching hint is free
      if (m) {
        hintCells = m;
        m.forEach((i) => cardEls.get(i)?.classList.add('is-hint'));
      }
    }
    if (spec.number === 6 && !save.seenTips.includes('variants')) showVariantTip();
    if (spec.gravity && !save.seenTips.includes('gravity'))
      showMechanicTip('gravity', 'Falling leaves', '낙엽 · 落葉', 'From now on, cards drop down to fill the gaps after every pair — like leaves settling. Plan from the bottom up, and watch new pairs line up as things fall.', [36, 37, 38, 39]);
    else if (spec.snow > 0 && !save.seenTips.includes('snow'))
      showMechanicTip('snow', 'First snow', '첫눈 · 初雪', 'Some cards start under snow. They can’t be picked until a card next to them is cleared. Snowy cards still block paths.', ['snow', 44, 'snow', 45]);
    if (spec.stones > 0 && !save.seenTips.includes('stones')) {
      save.seenTips.push('stones');
      persist();
      setCoach('Stones (돌 · 石) block paths. Route around them.');
    }
  }

  const tipCards = (cards: (number | 'snow')[]) =>
    `<div class="tip__cards">${cards.map((c, i) => `<div style="--i:${i}">${cardSvg(c)}</div>`).join('')}</div>`;

  /**
   * Level 6 teaches the one rule that changes: cards of the same flower stop
   * looking identical. Shown by example (the four Pine cards, corner numbers
   * circled) and then practised in a three-card mini-quiz.
   */
  function showVariantTip() {
    save.seenTips.push('variants');
    persist();
    const m = MONTHS[0];
    const kinds = [0, 1, 2, 3].map((v) => KIND_LABEL[cardDef(v).kind].en);
    // Quiz: two different-looking Pine cards (both 1) and a Plum card (2) that looks like the crane.
    const quiz = [3, 7, 0];
    const content = frag(`<div class="tip tip--rule">
      <div class="tip__kicker">New rule · Level 6</div>
      <h2>Match the flower, not the picture</h2>
      <p class="tip__lead">From now on, the four cards of each flower look different.<br><b>Same flower + same number in the corner = a pair.</b></p>

      <div class="rule-family">
        <div class="rule-family__cards">
          ${[0, 1, 2, 3]
            .map((id, i) => `<figure class="rule-card" style="--i:${i}">${cardSvg(id)}<span class="num-ring" aria-hidden="true"></span><figcaption>${esc(kinds[i])}</figcaption></figure>`)
            .join('')}
        </div>
        <p class="tip__caption">All four are <b>${esc(m.en)}</b> · <span class="serif">${m.ko}</span> · <span class="ja">${m.ja}</span> — all show <b>1</b>. Any two of them pair.</p>
      </div>

      <div class="quiz" role="group" aria-label="Practice: tap the two cards that pair">
        <div class="quiz__title"><span class="quiz__step">Try it</span> Tap the two cards that make a pair</div>
        <div class="quiz__cards">
          ${quiz.map((id) => `<button class="quiz__card" data-q="${id}" aria-label="${esc(faceLabel(id))}">${cardSvg(id)}<span class="num-ring" aria-hidden="true"></span></button>`).join('')}
        </div>
        <p class="quiz__feedback" aria-live="polite">Hint: look at the number in each corner.</p>
      </div>
    </div>`);
    const btn = h('button', { class: 'btn btn--primary btn--block' }, 'Got it');
    content.append(h('div', { class: 'sheet__actions' }, btn));

    const feedback = content.querySelector<HTMLElement>('.quiz__feedback')!;
    let picked: HTMLElement[] = [];
    let solved = false;
    content.querySelector('.quiz__cards')!.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-q]');
      if (!card || solved) return;
      if (picked.includes(card)) {
        card.classList.remove('is-picked');
        picked = picked.filter((p) => p !== card);
        return;
      }
      card.classList.add('is-picked');
      picked.push(card);
      sfx.tap();
      if (picked.length < 2) return;
      const [x, y] = picked.map((p) => Number(p.dataset.q) >> 2);
      if (x === y) {
        solved = true;
        picked.forEach((p) => p.classList.add('is-right'));
        content.querySelector('.quiz')!.classList.add('is-solved');
        feedback.innerHTML = '<b>Yes!</b> Different pictures, but both are Pine with a 1. That’s a jjak.';
        sfx.match(2);
        haptic.success();
        btn.textContent = 'Start Level 6';
      } else {
        picked.forEach((p) => {
          p.classList.add('is-wrong');
          setTimeout(() => p.classList.remove('is-wrong', 'is-picked'), 650);
        });
        feedback.innerHTML = '<b>Not quite.</b> The bird cards look alike, but one is Pine (1) and one is Plum (2). Match the number in the corner.';
        sfx.miss();
        haptic.warn();
        picked = [];
      }
    });

    paused = true;
    pausedAt = performance.now();
    const sheet = openSheet(content, { label: 'New rule: match the flower' });
    btn.addEventListener('click', () => sheet.close());
    void sheet.closed.then(resume);
  }

  function showMechanicTip(id: string, title: string, native: string, body: string, cards: (number | 'snow')[]) {
    save.seenTips.push(id);
    persist();
    const content = frag(`<div class="tip">
      <div class="tip__kicker">New this season</div>
      <h2>${esc(title)} <span class="tip__native">${native}</span></h2>
      <p class="muted">${esc(body)}</p>
      ${tipCards(cards)}
    </div>`);
    const btn = h('button', { class: 'btn btn--primary btn--block' }, 'Got it');
    content.append(h('div', { class: 'sheet__actions' }, btn));
    paused = true;
    pausedAt = performance.now();
    const sheet = openSheet(content, { label: title });
    btn.addEventListener('click', () => sheet.close());
    void sheet.closed.then(resume);
  }

  // ── Finish ────────────────────────────────────────────────────────
  async function finish() {
    busy = true;
    clearInterval(tick);
    timeEl.textContent = spec.mode === 'zen' ? timeEl.textContent : formatTime(session.elapsedMs(session.finishedAt));
    setCoach(null);
    await wait(420);
    const seal = h('div', { class: 'seal stamp', 'aria-hidden': 'true' }, '짝');
    stage.append(seal);
    shower();
    sfx.stamp();
    haptic.success();
    live('Board cleared!');
    await wait(900);
    const papersBefore = completedMonths().length;
    const summary = recordClear(session);
    emit('clear', { session, summary });
    const seals = checkSeals();
    showResult(summary, seals, completedMonths().length > papersBefore);
  }

  /** Petal shower across the stage when a board is cleared. */
  function shower() {
    if (reducedMotion()) return;
    const colors = ['#e3a5b0', '#d98a98', '#f2d4da', '#c4472f', '#e6c27a'];
    const hgt = stage.clientHeight + 24;
    for (let k = 0; k < 28; k++) {
      const p = h('i', { class: 'fall' });
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[k % colors.length];
      p.style.animationDelay = `${Math.random() * 600}ms`;
      p.style.animationDuration = `${1600 + Math.random() * 1200}ms`;
      p.style.setProperty('--fall', `${hgt}px`);
      p.style.setProperty('--sway', `${(Math.random() - 0.5) * 80}px`);
      p.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
      stage.append(p);
      setTimeout(() => p.remove(), 3200);
    }
  }

  /** Count a number up inside `node` (final value is already its text). */
  function countUp(node: Element | null, to: number, delay: number, ms = 800, prefix = '') {
    if (!node || reducedMotion() || to <= 0) return;
    node.textContent = `${prefix}0`;
    setTimeout(() => {
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        node.textContent = `${prefix}${fmt(Math.round(to * (1 - (1 - k) ** 3)))}`;
        if (k < 1 && node.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }

  function showResult(summary: ClearSummary, seals: Seal[], newPaper: boolean) {
    const st = session.stars();
    const secs = session.elapsedMs(session.finishedAt);
    const rm = reducedMotion();
    const starList = [
      { on: st.clear, label: 'Clear' },
      { on: st.noAssist, label: 'No assists' },
      { on: st.underPar, label: `Under ${formatTime(spec.par * 1000)}` },
    ];
    const heading =
      spec.mode === 'daily' ? `Daily #${spec.number} cleared` : spec.mode === 'zen' ? 'Board cleared' : `Level ${spec.number} cleared`;
    const kicker = spec.mode === 'daily' ? 'Daily board' : spec.mode === 'zen' ? 'Zen · 禅' : 'Journey';
    const subline =
      spec.mode === 'daily'
        ? summary.daily?.counted
          ? `${summary.daily.streak}-day streak`
          : 'Practice round — today’s result is already saved'
        : spec.mode === 'journey'
          ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ko} · ${chapterOf(spec.number).ja}`
          : 'Breathe in, breathe out';
    // Blossoms bloom one by one; then the numbers count up.
    const STAR_AT = 380;
    const STAR_STEP = 300;
    const statsAt = spec.mode === 'zen' ? 300 : STAR_AT + STAR_STEP * 3;
    const won = starList.filter((s) => s.on).length;

    const content = frag(`<div class="result">
      <div class="result__head"><div class="seal result__seal">짝</div><div><div class="result__kicker">${esc(kicker)}</div><h2>${esc(heading)}</h2><div class="muted">${esc(subline)}</div></div></div>
      ${
        spec.mode === 'zen'
          ? ''
          : `<div class="stars" role="img" aria-label="${won} of 3 blossoms">${starList
              .map((s, i) => `<div class="star ${s.on ? 'on' : ''}" style="--at:${STAR_AT + i * STAR_STEP}ms">${ICONS.blossom}<span>${esc(s.label)}</span></div>`)
              .join('')}</div>`
      }
      <div class="statline">
        <div><b>${formatTime(secs)}</b><span>Time</span></div>
        <div><b data-count>${fmt(session.score)}</b><span>Score</span></div>
        <div><b>×${session.bestCombo}</b><span>Best combo</span></div>
      </div>
    </div>`);
    countUp(content.querySelector('[data-count]'), session.score, statsAt, 900);
    if (spec.mode !== 'zen' && !rm) {
      starList.forEach((s, i) => {
        if (s.on) setTimeout(() => content.isConnected && sfx.match(i + 1), STAR_AT + i * STAR_STEP + 120);
      });
    }

    // Rewards, stacked: petals, the new card, lantern gift, paper unlock, seals.
    const rewards = h('div', { class: 'rewards' });
    let rewardAt = statsAt + 200;
    const stagger = (node: HTMLElement) => {
      node.classList.add('reward');
      node.style.setProperty('--at', `${rewardAt}ms`);
      rewardAt += 140;
      rewards.append(node);
    };

    // Petals earned + optional rewarded double.
    if (summary.petals > 0) {
      const pill = h('span', { class: 'petals', html: `${ICONS.petal}<b>+${summary.petals}</b>` });
      const earned = h('div', { class: 'earned' }, h('div', { class: 'earned__k' }, h('span', { class: 'reward__label' }, 'Petals'), pill));
      countUp(pill.querySelector('b'), summary.petals, rewardAt + 100, 600, '+');
      if (ads.rewardedAvailable) {
        const dbl = h('button', { class: 'btn btn--ghost earned__double', html: `${ICONS.ad}<span>Double it</span>` });
        dbl.addEventListener('click', async () => {
          dbl.setAttribute('disabled', '');
          if (await ads.rewarded()) {
            save.petals += summary.petals;
            persist();
            pill.innerHTML = `${ICONS.petal}<b>+${summary.petals * 2}</b>`;
            retrigger(pill, 'is-bump');
            dbl.remove();
          } else dbl.removeAttribute('disabled');
        });
        earned.append(dbl);
      }
      stagger(earned);
    }

    if (summary.drawn != null) {
      stagger(drawPanel(summary.drawn, 'New card', rewardAt + 450));
    }
    if (summary.lantern) {
      const l = summary.lantern;
      stagger(frag(`<div class="lantern"><span class="lantern__icon" aria-hidden="true">${ICONS.lantern}</span><span><b>Lantern gift</b><br><span class="muted">+${l.petals} petals${l.hints ? ' · +1 hint' : ''}${l.shuffles ? ' · +1 shuffle' : ''}</span></span></div>`));
    }
    if (newPaper) stagger(frag(`<p class="unlock">A flower is complete — a new board paper is ready in the Market.</p>`));
    // Flower Path: XP, the rank bar and any missions this board completed.
    const fp = boardReport(session);
    if (fp && (fp.xp > 0 || fp.missions.length || fp.tea || fp.foil != null)) stagger(pathResult(fp, rewardAt));
    if (seals.length) stagger(sealRow(seals));
    if (rewards.childElementCount) content.append(rewards);

    if (spec.mode === 'daily') content.append(frag(`<p class="result__note">Next Daily in ${formatCountdown(msToNextDaily())}</p>`));
    if (summary.daily?.counted) {
      void planReminders();
      if (!save.reminder.asked) content.append(reminderOffer());
    }
    // Near miss: say what the missing blossom needs, next to the retry.
    if (spec.mode === 'journey' && summary.stars < 3) {
      const missing = !st.noAssist ? 'without hints or shuffles' : `under ${formatTime(spec.par * 1000)}`;
      content.append(frag(`<p class="result__note result__note--miss">${ICONS.blossom}<span>One more blossom: clear it ${esc(missing)}.</span></p>`));
    }

    const actions = h('div', { class: 'sheet__actions result__actions' });
    content.append(actions);
    const sheet = openSheet(content, { dismissible: false, label: heading });
    if (fp && fp.after.rank > fp.before.rank) setTimeout(() => content.isConnected && rankUpMoment(fp), (rm ? 0 : rewardAt) + 2400);

    const nextSpec = (): LevelSpec | null =>
      spec.mode === 'journey' ? journeyLevel(spec.number + 1) : spec.mode === 'zen' ? zenLevel(`zen-${Date.now()}`) : null;

    if (spec.mode === 'daily') {
      actions.append(
        h('button', {
          class: 'btn btn--accent btn--block',
          html: `${ICONS.share}<span>Share result</span>`,
          onclick: async () => {
            const res = await shareText(shareTextFor(session, summary, LINKS.store));
            if (res === 'copied') toast('Copied to clipboard');
          },
        }),
      );
    }
    const next = nextSpec();
    if (next) {
      actions.append(
        h('button', {
          class: 'btn btn--primary btn--block btn--next',
          onclick: async () => {
            sheet.close();
            await ads.betweenBoards(spec.mode === 'journey' ? spec.number : null);
            nav.game(next);
          },
          html: `${spec.mode === 'journey' ? `Level ${next.number}` : 'Next board'} ${ICONS.play}`,
        }),
      );
    }
    const row = h('div', { class: 'sheet__row' });
    // Near miss: one tap to try for the missing blossoms.
    if (spec.mode === 'journey' && summary.stars < 3) {
      row.append(
        h('button', {
          class: 'btn btn--ghost',
          html: `${ICONS.restart}<span>Retry <small>for 3 blossoms</small></span>`,
          onclick: () => {
            sheet.close();
            nav.game(journeyLevel(spec.number));
          },
        }),
      );
    }
    row.append(
      h('button', {
        class: row.childElementCount ? 'btn btn--ghost' : 'btn btn--quiet btn--block',
        onclick: async () => {
          sheet.close();
          await ads.betweenBoards(spec.mode === 'journey' ? spec.number : null);
          nav.home();
        },
      }, 'Home'),
    );
    actions.append(row);
    // At most once a day, and only after a few interstitials: a quiet way out of ads.
    const today = localToday();
    if (!save.adFree && store.available && save.ads.interstitialsShown >= AD_POLICY.upsellAfterInterstitials && save.ads.lastUpsell !== today) {
      save.ads.lastUpsell = today;
      persist();
      const link = h('button', { class: 'upsell' }, `Prefer no ads between boards? Remove them for ${store.price}`);
      link.addEventListener('click', async () => {
        if (await store.buyRemoveAds()) {
          link.textContent = 'Thank you! Ads between boards are gone.';
          link.setAttribute('disabled', '');
        }
      });
      actions.append(link);
    }
    live(`${heading}. ${spec.mode === 'zen' ? '' : `${won} of 3 blossoms. `}Score ${session.score}.`);
  }

  /** Inline, one-time offer of a daily reminder (never a pop-up). */
  function reminderOffer(): HTMLElement {
    const box = frag(`<div class="remind">
      <div><b>A gentle nudge tomorrow?</b><br><span class="muted">One quiet reminder a day for the new board. Change it any time in Settings.</span></div>
      <div class="remind__times">${REMINDER_TIMES.map((t) => `<button data-hour="${t.hour}">${esc(t.label)}</button>`).join('')}<button data-hour="off" class="remind__no">No thanks</button></div>
    </div>`);
    box.addEventListener('click', async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hour]');
      if (!b) return;
      if (b.dataset.hour === 'off') {
        save.reminder.asked = true;
        persist();
        await disableReminder();
        box.remove();
        return;
      }
      const ok = await enableReminder(Number(b.dataset.hour));
      box.innerHTML = ok
        ? `<p style="margin:0">Reminder set for ${esc(b.textContent ?? '')}. See you tomorrow.</p>`
        : `<p style="margin:0" class="muted">Notifications are off for Jjak. You can allow them in Android settings.</p>`;
    });
    return box;
  }

  function sealRow(seals: Seal[]): HTMLElement {
    const shown = seals.slice(0, 3);
    const more = seals.length - shown.length;
    return frag(`<div class="earned-seals">${shown
      .map((sl, i) => `<div class="earned-seal" style="--i:${i}"><span class="seal seal--sm">印</span><span><b>${esc(sl.title)}</b>${sl.native ? ` <span class="muted serif">${sl.native}</span>` : ''}<br><span class="muted">Seal earned · +${sl.reward} petals</span></span></div>`)
      .join('')}${more > 0 ? `<p class="muted earned-seals__more">…and ${more} more in your seal book.</p>` : ''}</div>`);
  }

  /** The drawn card arrives face down, then turns over — the moment of the sheet. */
  function drawPanel(id: number, label: string, revealAt = 140): HTMLElement {
    const still = reducedMotion();
    const m = monthDef(id);
    const d = cardDef(id);
    const kind = KIND_LABEL[d.kind];
    const panel = frag(`<div class="draw">
      <div class="draw__card"><div class="draw__flip">${cardSvg(still ? id : 'back')}</div><i class="draw__glint" aria-hidden="true"></i></div>
      <div class="draw__text">
        <div class="draw__label">${esc(label)} · ${save.album.length}/48</div>
        <div class="draw__name">${esc(m.en)}${d.kind === 'plain' ? '' : ` · ${esc(d.en)}`}</div>
        <div class="draw__langs"><span class="serif">${m.ko}</span> ${esc(m.koRoman)} · <span class="ja">${m.ja}</span> ${esc(m.jaRoman)}<br><span class="muted">${esc(kind.en)} · ${kind.ko} · <span class="ja">${kind.ja}</span></span></div>
      </div>
    </div>`);
    const flip = panel.querySelector<HTMLElement>('.draw__flip')!;
    const turn = () => {
      if (!panel.isConnected) {
        flip.innerHTML = cardSvg(id);
        panel.classList.add('is-shown');
        return;
      }
      flip.classList.add('is-turning');
      setTimeout(() => (flip.innerHTML = cardSvg(id)), 230);
      setTimeout(() => panel.classList.add('is-shown'), 250);
      sfx.reveal();
    };
    if (still) {
      panel.classList.add('is-shown');
      setTimeout(() => sfx.reveal(), Math.min(revealAt, 350));
    } else setTimeout(turn, revealAt);
    if (save.album.length < 48 && ads.rewardedAvailable) {
      const more = h('button', { class: 'btn btn--ghost btn--block draw__more', html: `${ICONS.ad}<span>Draw one more card</span>` });
      more.addEventListener('click', async () => {
        more.setAttribute('disabled', '');
        if (await ads.rewarded()) {
          const extra = drawCard();
          if (extra != null) {
            more.replaceWith(drawPanel(extra, 'Bonus card'));
            const won = checkSeals();
            if (won.length) toast(`Seal earned: ${won.map((w) => w.title).join(', ')}`);
          }
        } else more.removeAttribute('disabled');
      });
      const wrap = h('div', { class: 'draw-wrap' }, panel, more);
      return wrap;
    }
    return panel;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  function resume() {
    if (!paused) return;
    paused = false;
    session.startedAt += performance.now() - pausedAt;
  }

  function leave() {
    if ((session.done || session.pairsMade === 0) && !(rush && rush.round > 0)) nav.home();
    else openPause();
  }

  let pauseOpen = false;
  function openPause() {
    if (pauseOpen || session.done) return;
    pauseOpen = true;
    if (!paused) {
      paused = true;
      pausedAt = performance.now();
    }
    const tog = (k: 'sound' | 'music' | 'haptics', label: string) =>
      `<div class="row"><span>${label}</span><button class="switch" role="switch" data-toggle="${k}" aria-checked="${save.settings[k]}" aria-label="${label}"></button></div>`;
    const clock = rush ? formatTime(rush.left + 999) : spec.mode === 'zen' ? '—' : formatTime(session.elapsedMs(pausedAt));
    const content = frag(`<div class="pause">
      <div class="pause__head"><div class="tip__kicker">Paused</div>
      <h2>${esc(titleFor(spec))}</h2>
      <p class="muted">${esc(sub)}</p></div>
      <div class="pause__stats">
        <div><b>${session.pairsMade}<small>/${total / 2}</small></b><span>Pairs</span></div>
        <div><b>${clock}</b><span>${rush ? 'Time left' : 'Time'}</span></div>
        <div><b>${fmt((rush?.banked ?? 0) + session.score)}</b><span>Score</span></div>
      </div>
      <div class="list pause__list">${tog('sound', 'Sound effects')}${tog('music', 'Music')}${tog('haptics', 'Haptics')}</div>
      <div class="sheet__actions">
        <button class="btn btn--primary btn--block" data-p="resume">Resume ${ICONS.play}</button>
        <div class="sheet__row">
          <button class="btn btn--ghost" data-p="restart">${ICONS.restart}<span>Restart</span></button>
          <button class="btn btn--ghost" data-p="how">${ICONS.hint}<span>Rules</span></button>
        </div>
        <button class="btn btn--quiet btn--block" data-p="home">Leave to Home</button>
      </div>
    </div>`);
    const sheet = openSheet(content, { label: 'Paused' });
    el.classList.add('is-paused');
    content.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const sw = t.closest<HTMLElement>('[data-toggle]');
      if (sw) {
        const k = sw.dataset.toggle as 'sound' | 'music' | 'haptics';
        save.settings[k] = !save.settings[k];
        sw.setAttribute('aria-checked', String(save.settings[k]));
        persist();
        if (k === 'music') music.refresh();
        return;
      }
      const act = t.closest<HTMLElement>('[data-p]')?.dataset.p;
      if (!act) return;
      if (act === 'how') {
        showHowToPlay();
        return;
      }
      sheet.close();
      if (act === 'home') nav.home();
      if (act === 'restart') restartBoard();
    });
    void sheet.closed.then(() => {
      pauseOpen = false;
      el.classList.remove('is-paused');
      resume();
    });
  }

  function restartBoard() {
    if (rush) {
      nav.game(rushLevel(`rush-${Date.now()}`, 0));
      return;
    }
    session = new Session(spec, performance.now());
    clearHint();
    renderBoard();
    deal(0);
    updateHud();
    comboBar.classList.remove('on');
    showCombo(0);
    if (feverTimer) clearTimeout(feverTimer);
    endFever();
  }

  /** Title card at the start of a board; the clock starts when it clears. */
  function intro(ms: number): Promise<void> {
    const sets = possibleYaku(session.board.cells.filter((v) => v >= 0));
    const setNote = sets.length ? `<div class="intro__set">This board holds a card set: <b>${esc(sets[0].native)}</b></div>` : '';
    const twistNote = rush
      ? `${RUSH.startMs / 1000} seconds · pairs add time`
      : spec.gravity ? 'Cards fall to fill the gaps' : spec.snow ? 'Some cards start under snow' : spec.stones ? 'Stones block the way' : '';
    const card = frag(`<div class="intro" aria-hidden="true">
      <div class="intro__kicker">${esc(spec.mode === 'journey' ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ko} · ${chapterOf(spec.number).ja}` : spec.mode === 'daily' ? dailyTheme(spec.seed.replace('daily-', '')).name : rush ? 'Score attack' : 'Zen · 禅')}</div>
      <div class="intro__title">${esc(titleFor(spec))}</div>
      <svg class="intro__rule" viewBox="0 0 120 8" preserveAspectRatio="none"><path d="M1 4.6C20 2.6 52 2.4 80 3.1S112 4.2 119 3.6C110 5.4 84 5.7 58 5.8S14 6.3 1 4.6Z"/></svg>
      <div class="intro__sub">${esc([rush ? '' : `${total / 2} pairs`, twistNote].filter(Boolean).join(' · '))}</div>
      ${setNote}
    </div>`);
    stage.append(card);
    live(`${titleFor(spec)}. ${rush ? '' : `${total / 2} pairs.`} ${twistNote}`);
    busy = true;
    return wait(ms).then(() => {
      card.classList.add('intro--out');
      busy = false;
      setTimeout(() => card.remove(), 400);
    });
  }

  const ro = new ResizeObserver(() => layout());
  const onVis = () => {
    if (document.hidden && !paused) {
      paused = true;
      pausedAt = performance.now();
    } else if (!document.hidden) resume();
  };
  document.addEventListener('visibilitychange', onVis);

  requestAnimationFrame(() => {
    const introMs = spec.mode === 'journey' && spec.number === 1 ? 900 : 1150;
    renderBoard();
    // The cards start dealing just as the title card begins to lift.
    deal(Math.max(0, introMs - 320));
    ro.observe(stage);
    updateHud();
    paused = true;
    pausedAt = performance.now();
    void intro(introMs).then(() => {
      session.startedAt = performance.now();
      paused = false;
      emit('start', { session });
      startTutorial();
    });
  });

  return {
    name: 'game',
    el,
    onBack() {
      if (session.done) return false;
      leave();
      return true;
    },
    destroy() {
      clearInterval(tick);
      cancelAnimationFrame(scoreRaf);
      if (feverTimer) clearTimeout(feverTimer);
      if (comboHide) clearTimeout(comboHide);
      if (comboBarOff) clearTimeout(comboBarOff);
      if (dealTimer) clearTimeout(dealTimer);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
