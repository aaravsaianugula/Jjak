/**
 * The demo player: a mini board in the real card art that plays a script
 * (demo-model.ts, demos.ts) through the real rules. A soft ink brush glides to
 * each card, the path draws itself, cards lift away and the board reacts
 * (gates open, cards slide, snow turns over, knots untie). Then "your turn":
 * the same mini board takes taps, with gentle feedback.
 *
 * Reduced motion: no brush, no glide and no looping; each beat shows its end
 * state with a short fade.
 */
import { cardSvg } from '../art/cards';
import { gateSvg } from '../art/mechanics';
import { toriiSvg, waterMarkup } from '../art/terrain';
import { MONTHS } from '../data/deck';
import { FENCE_DOWN, FENCE_RIGHT, STONE, gateMonth, isCard, isGate, isInk, isTorii, monthOf, toriiPair } from '../engine/board';
import { currentSeal } from '../engine/rules';
import { dryBlot, inkBlot, setSeal, setWet } from './rule-fx';
import { pathStrokes } from '../engine/path';
import { GOALS } from '../engine/goals';
import { findMove } from '../engine/moves';
import { lockedOf } from '../engine/rules';
import { unlockAudio, sfx } from '../services/audio';
import { haptic } from '../services/haptics';
import { type DemoEvent, type DemoScript, type Ghost, DemoRun, ghostPath, pairProblem, sealWaits, turnPairs } from './demo-model';
import { h } from './dom';
import { reducedMotion, restartAnimations, retrigger } from './motion';
import { ICONS } from './icons';
import { KNOT_SVG } from './journey-fx';

/** Board units: a card slot is 100 × 140, with an outer lane for paths. */
const CW = 100;
const CH = 140;
const GAP = 8;
const LANE = 34;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** The brush in board units (its tip is the bottom centre). */
const BRUSH_W = 40;
const BRUSH_H = 132;


/** Thrown into a running sequence when it is cancelled (a newer one started, or the player was destroyed). */
const CANCEL = Symbol('demo-cancel');
interface Token {
  live: boolean;
}

export interface DemoOptions {
  /** 'stage' (first minute, large), 'sheet' (an intro in a sheet), 'tile' (How to Play: small, no captions) */
  size?: 'stage' | 'sheet' | 'tile';
}

export interface TurnOptions {
  /** ms of no progress before the next pair glows (0 = glow at once) */
  hintAfter?: number;
  /** called after each pair the player makes */
  onPair?: (n: number) => void;
}

const PRAISE = ['Lovely', 'Well read', 'That’s it', 'Nicely done'];

export class DemoPlayer {
  readonly el: HTMLElement;
  private readonly boardEl: HTMLElement;
  private readonly fenceSvg: SVGSVGElement;
  private readonly inkSvg: SVGSVGElement;
  private readonly brush: HTMLElement;
  private readonly capEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly goalEl: HTMLElement;
  private readonly size: 'stage' | 'sheet' | 'tile';
  private script!: DemoScript;
  private run!: DemoRun;
  /** cell → its element (cards, stones, gates) */
  private nodes = new Map<number, HTMLElement>();
  private W = 0;
  private H = 0;
  private tok: Token = { live: false };
  private dead = false;
  private turn: { expect: [number, number][]; k: number; sel: number; busy: boolean; done: () => void; opts: TurnOptions; hintTimer: number } | null = null;
  private inkSeq = 0;
  private static seq = 0;
  private readonly uid = ++DemoPlayer.seq;

  constructor(script: DemoScript, opts: DemoOptions = {}) {
    this.size = opts.size ?? 'sheet';
    this.fenceSvg = document.createElementNS(SVG_NS, 'svg');
    this.fenceSvg.setAttribute('class', 'demo__fences');
    this.fenceSvg.setAttribute('aria-hidden', 'true');
    this.inkSvg = document.createElementNS(SVG_NS, 'svg');
    this.inkSvg.setAttribute('class', 'demo__ink');
    this.inkSvg.setAttribute('aria-hidden', 'true');
    this.brush = h('div', { class: 'demo__brush', 'aria-hidden': 'true', html: BRUSH_SVG });
    this.comboEl = h('div', { class: 'demo__combo', 'aria-hidden': 'true' });
    this.boardEl = h('div', { class: 'demo__board', role: 'group' });
    this.goalEl = h('div', { class: 'demo__goal', hidden: true });
    this.capEl = h('p', { class: 'demo__cap', 'aria-live': 'polite' });
    this.el = h('div', { class: `demo demo--${this.size}` }, this.goalEl, h('div', { class: 'demo__frame' }, this.boardEl), this.capEl);
    this.boardEl.addEventListener('pointerdown', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.demo__card');
      if (!t || !this.turn) return;
      e.preventDefault();
      this.onTap(Number(t.dataset.cell));
    });
    this.boardEl.addEventListener('keydown', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.demo__card');
      if (!t || !this.turn || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      this.onTap(Number(t.dataset.cell));
    });
    this.load(script);
  }

  // ── Board ───────────────────────────────────────────────────────────
  /** Show a script's starting board (cancels anything running). */
  load(script: DemoScript): void {
    this.cancel();
    this.script = script;
    this.run = new DemoRun(script);
    this.render();
  }

  private render() {
    const { rows, cols } = this.run.state.board;
    this.W = cols * CW + 2 * LANE;
    this.H = rows * CH + 2 * LANE;
    this.boardEl.style.setProperty('--ar', String(this.W / this.H));
    this.boardEl.setAttribute('aria-label', `Demo board, ${rows} by ${cols}`);
    this.brush.style.width = `${(BRUSH_W / this.W) * 100}%`;
    for (const svg of [this.fenceSvg, this.inkSvg]) svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.inkSvg.replaceChildren();
    this.nodes.clear();
    const kids: Element[] = [];
    this.run.state.board.cells.forEach((v, i) => {
      let node: HTMLElement | null = null;
      if (isCard(v)) node = this.cardEl(v, i);
      else if (v === STONE) node = h('div', { class: 'demo__stone', 'aria-hidden': 'true' });
      else if (isGate(v)) node = h('div', { class: 'demo__gate', 'aria-hidden': 'true', html: gateSvg(gateMonth(v)) });
      else if (isTorii(v)) node = h('div', { class: 'demo__torii', 'aria-hidden': 'true', html: toriiSvg(toriiPair(v)) });
      else if (isInk(v)) node = inkBlot(this.run.state.board.ink![i], 'demo__blot');
      if (!node) return;
      this.place(node, i);
      this.nodes.set(i, node);
      kids.push(node);
    });
    this.drawFences();
    this.boardEl.replaceChildren(this.fenceSvg, ...kids, this.inkSvg, this.comboEl, this.brush);
    this.brush.classList.remove('is-on');
    this.comboEl.classList.remove('is-on', 'is-centre');
    this.boardEl.classList.remove('is-fever');
    this.updateGoal();
  }

  private cardEl(id: number, i: number): HTMLElement {
    const st = this.run.state;
    const snowy = st.hidden.has(i);
    const c = h('button', {
      class: `demo__card${snowy ? ' is-snow' : ''}${monthOf(id) === 12 ? ' is-lucky' : ''}`,
      'data-cell': i,
      'data-id': id,
      tabindex: -1,
      'aria-label': snowy ? 'Card under snow' : `${MONTHS[monthOf(id)]?.en ?? 'Lucky card'}`,
      html: cardSvg(snowy ? 'snow' : id),
    });
    if (st.knots.has(i)) {
      c.classList.add('is-knot');
      c.append(h('span', { class: 'knot', 'aria-hidden': 'true', html: KNOT_SVG }));
    }
    const n = st.board.seals?.[i] ?? 0;
    if (n) setSeal(c, n, sealWaits(st.board, i));
    return c;
  }

  /** Seals and ink as the rules left them: the next seal brightens, blots dry a shade or go. */
  private syncMarks() {
    const b = this.run.state.board;
    for (const [i, n] of this.nodes) {
      if (n.classList.contains('demo__card')) setSeal(n, b.seals?.[i] ?? 0, sealWaits(b, i));
      else if (n.classList.contains('demo__blot')) {
        if (isInk(b.cells[i])) setWet(n, b.ink![i]);
        else {
          this.nodes.delete(i);
          dryBlot(n);
        }
      }
    }
  }

  /** A sealed card tapped too soon: it shakes, and the seal that goes first answers. */
  private sealNudge(card: HTMLElement | undefined) {
    retrigger(card, 'is-shake');
    const b = this.run.state.board;
    const first = currentSeal(b);
    for (const [i, n] of this.nodes) if (b.seals?.[i] === first) retrigger(n, 'is-first');
    return first;
  }

  private place(node: HTMLElement, i: number) {
    const { cols } = this.run.state.board;
    const r = Math.floor(i / cols);
    const c = i % cols;
    node.style.left = `${((LANE + c * CW + GAP / 2) / this.W) * 100}%`;
    node.style.top = `${((LANE + r * CH + GAP / 2) / this.H) * 100}%`;
    node.style.width = `${((CW - GAP) / this.W) * 100}%`;
    node.style.height = `${((CH - GAP) / this.H) * 100}%`;
    node.dataset.cell = String(i);
  }

  private xOf(c: number) {
    const cols = this.run.state.board.cols;
    return c < 0 ? LANE / 2 : c >= cols ? LANE + cols * CW + LANE / 2 : LANE + (c + 0.5) * CW;
  }
  private yOf(r: number) {
    const rows = this.run.state.board.rows;
    return r < 0 ? LANE / 2 : r >= rows ? LANE + rows * CH + LANE / 2 : LANE + (r + 0.5) * CH;
  }
  private cellXY(i: number) {
    const cols = this.run.state.board.cols;
    return { x: this.xOf(i % cols), y: this.yOf(Math.floor(i / cols)) };
  }

  /** Water (brushed lines along each stream), then bamboo fences on cell edges: a pole with nodes. */
  private drawFences() {
    const { rows, cols, walls, cells } = this.run.state.board;
    this.fenceSvg.innerHTML = waterMarkup(cells, rows, cols, LANE, LANE, CW, CH);
    if (!walls) return;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'fence');
      const line = (cls: string, dx = 0, dy = 0) => {
        const l = document.createElementNS(SVG_NS, 'line');
        l.setAttribute('x1', String(x1 + dx));
        l.setAttribute('y1', String(y1 + dy));
        l.setAttribute('x2', String(x2 + dx));
        l.setAttribute('y2', String(y2 + dy));
        l.setAttribute('class', cls);
        g.append(l);
      };
      line('fence__pole');
      line('fence__shine', x1 === x2 ? -1.6 : 0, y1 === y2 ? -1.6 : 0);
      // Nodes every ~34 units along the pole.
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let s = 22; s < len - 10; s += 34) {
        const t = s / len;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const n = document.createElementNS(SVG_NS, 'line');
        const vertical = x1 === x2;
        n.setAttribute('x1', String(vertical ? x - 6 : x));
        n.setAttribute('y1', String(vertical ? y : y - 6));
        n.setAttribute('x2', String(vertical ? x + 6 : x));
        n.setAttribute('y2', String(vertical ? y : y + 6));
        n.setAttribute('class', 'fence__node');
        g.append(n);
      }
      this.fenceSvg.append(g);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const w = walls[r * cols + c];
        const x = LANE + c * CW;
        const y = LANE + r * CH;
        if (w & FENCE_RIGHT) seg(x + CW, y - 4, x + CW, y + CH + 4);
        if (w & FENCE_DOWN) seg(x - 4, y + CH, x + CW + 4, y + CH);
      }
    }
  }

  // ── Sequencing ──────────────────────────────────────────────────────
  private cancel(): Token {
    this.tok.live = false;
    this.tok = { live: !this.dead };
    if (this.turn) {
      clearTimeout(this.turn.hintTimer);
      this.turn = null;
    }
    this.el.classList.remove('is-turn');
    this.boardEl.querySelectorAll<HTMLElement>('.demo__card').forEach((c) => (c.tabIndex = -1));
    return this.tok;
  }

  private sleep(ms: number, tok: Token): Promise<void> {
    return new Promise((resolve, reject) =>
      setTimeout(() => (tok.live && !this.dead ? resolve() : reject(CANCEL)), ms),
    );
  }

  /** Wait until the current state has painted (two frames), so a following change transitions. */
  private frame(tok: Token): Promise<void> {
    return new Promise((resolve, reject) =>
      requestAnimationFrame(() => requestAnimationFrame(() => (tok.live && !this.dead ? resolve() : reject(CANCEL)))),
    );
  }

  /** Run a sequence, swallowing cancellation. Resolves true if it finished. */
  private async guard(fn: (tok: Token) => Promise<void>): Promise<boolean> {
    const tok = this.cancel();
    try {
      await fn(tok);
      return tok.live;
    } catch (e) {
      if (e === CANCEL) return false;
      throw e;
    }
  }

  /**
   * Play the script `times` times (Infinity loops while the player lives),
   * resetting the board between plays. Reduced motion plays it once.
   * Resolves true when it ran to the end, false if cancelled.
   */
  play(times = 1, opts: { fresh?: boolean; maxLoopMs?: number } = {}): Promise<boolean> {
    const rm = reducedMotion();
    const n = rm ? 1 : times;
    return this.guard(async (tok) => {
      for (let k = 0; k < n; k++) {
        if (k > 0 || opts.fresh) await this.reset(tok);
        const t0 = performance.now();
        for (const step of this.script.steps) await this.beat(this.run.step(step), tok);
        this.hideBrush();
        // A long script plays once: nobody should wait long for their turn.
        const last = k === n - 1 || (opts.maxLoopMs !== undefined && performance.now() - t0 > opts.maxLoopMs);
        await this.sleep(rm ? 300 : last ? 500 : 1000, tok);
        if (last) break;
      }
    });
  }

  /** Fade over to another script's starting board. Resolves false if cancelled. */
  swap(script: DemoScript): Promise<boolean> {
    return this.guard(async (tok) => {
      this.boardEl.classList.add('is-fading');
      await this.sleep(reducedMotion() ? 120 : 280, tok);
      this.el.classList.remove('is-solved');
      this.script = script;
      this.run = new DemoRun(script);
      this.render();
      this.setCaption('');
      this.boardEl.classList.remove('is-fading');
      await this.sleep(reducedMotion() ? 120 : 320, tok);
    });
  }

  /** Fade the board back to the script's start. */
  private async reset(tok: Token) {
    this.boardEl.classList.add('is-fading');
    await this.sleep(reducedMotion() ? 120 : 260, tok);
    this.el.classList.remove('is-solved');
    this.run = new DemoRun(this.script);
    this.render();
    this.setCaption('');
    this.boardEl.classList.remove('is-fading');
    await this.sleep(reducedMotion() ? 120 : 300, tok);
  }

  private async beat(ev: DemoEvent, tok: Token) {
    const rm = reducedMotion();
    switch (ev.kind) {
      case 'caption':
        this.setCaption(ev.text);
        if (ev.text) await this.sleep(rm ? 500 : 240, tok);
        return;
      case 'mark':
        this.mark(ev.cells);
        return;
      case 'wait':
        await this.sleep(ev.ms, tok);
        return;
      case 'tap': {
        await this.brushTo(ev.cell, tok);
        const card = this.nodes.get(ev.cell);
        if (ev.locked === 'seal') this.sealNudge(card);
        else if (ev.locked) {
          retrigger(card, 'is-shake');
          if (ev.locked === 'knot') retrigger(card?.querySelector('.knot'), 'is-tug');
        }
        await this.sleep(rm ? 700 : 480, tok);
        return;
      }
      case 'blocked': {
        await this.brushTo(ev.a, tok);
        this.select(ev.a, true);
        await this.brushTo(ev.b, tok);
        this.select(ev.a, false);
        await this.blockedFx(ev.a, ev.b, ev.ghost, tok);
        return;
      }
      case 'pair': {
        await this.brushTo(ev.a, tok);
        this.select(ev.a, true);
        await this.brushTo(ev.b, tok);
        this.select(ev.b, true);
        await this.pairFx(ev, tok);
        return;
      }
    }
  }

  // ── Effects ─────────────────────────────────────────────────────────
  setCaption(text: string): void {
    if (this.size === 'tile') return;
    if (this.capEl.textContent === text) return;
    this.capEl.textContent = text;
    if (!this.capEl.classList.contains('is-new') || !restartAnimations(this.capEl, ['demo-cap'])) retrigger(this.capEl, 'is-new');
  }

  private mark(cells: number[]) {
    this.boardEl.querySelectorAll('.is-mark').forEach((n) => n.classList.remove('is-mark'));
    for (const i of cells) this.nodes.get(i)?.classList.add('is-mark');
  }

  private select(i: number, on: boolean) {
    const c = this.nodes.get(i);
    c?.classList.toggle('is-selected', on);
    c?.setAttribute('aria-pressed', String(on));
  }

  /** The brush glides to a cell and dabs it. Skipped (instant) with reduced motion. */
  private async brushTo(i: number, tok: Token) {
    if (reducedMotion()) {
      await this.sleep(240, tok);
      return;
    }
    const { x, y } = this.cellXY(i);
    const b = this.brush;
    const first = !b.classList.contains('is-on');
    // The tip sits at (x, y): the brush is 40 × 132 board units, and `translate`
    // percentages are of its own box, so the glide is pure compositing.
    const at = (px: number, py: number) => `${(px / BRUSH_W) * 100}% ${(py / BRUSH_H) * 100}%`;
    if (first) {
      // Enter from below-right of the target, then glide in.
      b.style.transition = 'none';
      b.style.translate = at(x + 70, y + 120);
      await this.frame(tok);
      b.style.transition = '';
      b.classList.add('is-on');
    }
    b.style.translate = at(x, y);
    await this.sleep(first ? 420 : 340, tok);
    retrigger(b, 'is-dab');
    await this.sleep(110, tok);
  }

  private hideBrush() {
    this.brush.classList.remove('is-on');
  }

  private async pairFx(ev: Extract<DemoEvent, { kind: 'pair' }>, tok: Token, byPlayer = false) {
    const rm = reducedMotion();
    // A path through a torii is two strokes: into one torii, out of its twin.
    for (const stroke of pathStrokes(ev.path)) {
      this.ink(stroke.map((p) => ({ x: this.xOf(p.c), y: this.yOf(p.r) })), { bends: !!this.script.bends && !byPlayer });
    }
    if (!byPlayer) this.hideBrushSoon();
    await this.sleep(rm ? 380 : 270, tok);
    const a = this.nodes.get(ev.a);
    const b = this.nodes.get(ev.b);
    this.nodes.delete(ev.a);
    this.nodes.delete(ev.b);
    for (const c of [a, b]) {
      if (!c) continue;
      c.classList.remove('is-selected', 'is-mark', 'is-hint');
      c.classList.add('is-gone');
      setTimeout(() => c.remove(), 520);
    }
    if (ev.lucky) this.float('Lucky!', `+10 petals`, ev.a, ev.b);
    if (this.script.combo && ev.combo >= 2) this.showCombo(ev.combo, !this.nodes.size || ![...this.nodes.values()].some((n) => n.classList.contains('demo__card')));
    if (ev.fever) retrigger(this.boardEl, 'is-fever');
    this.updateGoal();
    await this.sleep(rm ? 200 : 210, tok);
    // The board reacts, exactly as the rules said.
    const { opened, moved, revealed, untied } = ev.res;
    for (const g of opened) {
      const n = this.nodes.get(g);
      this.nodes.delete(g);
      n?.classList.add('is-open');
      setTimeout(() => n?.remove(), 700);
    }
    if (moved.length) {
      const movers = moved.map(([from, to]) => [this.nodes.get(from), to] as const);
      for (const [from] of moved) this.nodes.delete(from);
      const { cols } = this.run.state.board;
      const slid: HTMLElement[] = [];
      for (const [[from], [n, to]] of moved.map((m, k) => [m, movers[k]] as const)) {
        if (!n) continue;
        this.nodes.set(to, n);
        this.place(n, to);
        if (rm) continue;
        // FLIP on `translate` (percent of the card's own box): no left/top animation.
        const dx = ((from % cols) - (to % cols)) * CW;
        const dy = (Math.floor(from / cols) - Math.floor(to / cols)) * CH;
        n.style.translate = `${(dx / (CW - GAP)) * 100}% ${(dy / (CH - GAP)) * 100}%`;
        slid.push(n);
      }
      if (slid.length)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            for (const n of slid) {
              n.classList.add('is-sliding');
              n.style.translate = '';
              setTimeout(() => n.classList.remove('is-sliding'), 560);
            }
          }),
        );
    }
    for (const i of revealed) {
      const n = this.nodes.get(i);
      if (!n) continue;
      const id = Number(n.dataset.id);
      retrigger(n, 'is-flip');
      setTimeout(() => {
        const knot = n.querySelector('.knot');
        n.innerHTML = cardSvg(id);
        if (knot) n.append(knot);
        n.classList.remove('is-snow');
        n.setAttribute('aria-label', MONTHS[monthOf(id)]?.en ?? 'Card');
      }, rm ? 0 : 200);
    }
    for (const i of untied) {
      const n = this.nodes.get(i);
      if (!n) continue;
      n.classList.remove('is-knot');
      const k = n.querySelector('.knot');
      if (rm) k?.remove();
      else {
        k?.classList.add('is-untie');
        setTimeout(() => k?.remove(), 620);
      }
    }
    const { dried } = ev.res;
    if (this.run.state.board.ink || dried.length || this.boardEl.querySelector('.seal')) this.syncMarks();
    if (opened.length || moved.length || revealed.length || untied.length || dried.length) {
      if (byPlayer) sfx.reveal();
      await this.sleep(rm ? 420 : 500, tok);
    } else await this.sleep(rm ? 260 : 120, tok);
  }

  private hideBrushSoon() {
    // The brush lifts off as the ink runs, so it never sits on the path.
    setTimeout(() => this.brush.classList.add('is-lift'), 60);
    setTimeout(() => this.brush.classList.remove('is-lift'), 420);
  }

  private async blockedFx(a: number, b: number, ghost: Ghost | null, tok: Token) {
    for (const i of [a, b]) retrigger(this.nodes.get(i), 'is-shake');
    if (ghost) this.ghost(ghost);
    this.hideBrush();
    await this.sleep(reducedMotion() ? 1100 : 1150, tok);
  }

  /** The 짝짝짝 stamp; once the board is clear it moves to the middle, larger. */
  private showCombo(n: number, centre = false) {
    this.comboEl.replaceChildren(h('b', {}, '짝'.repeat(n)), h('span', {}, `×${n}`));
    this.comboEl.classList.add('is-on');
    // Centred: glide down by half the board (one read, at the end of a demo).
    if (centre) this.comboEl.style.setProperty('--centre-dy', `${this.boardEl.clientHeight / 2}px`);
    this.comboEl.classList.toggle('is-centre', centre);
    this.comboEl.classList.toggle('is-max', n >= 5);
    retrigger(this.comboEl, 'is-pop');
  }

  private float(big: string, small: string, a: number, b: number) {
    const p = this.cellXY(a);
    const q = this.cellXY(b);
    const f = h('div', { class: 'demo__float', 'aria-hidden': 'true' }, h('b', {}, big), h('span', {}, small));
    f.style.left = `${(((p.x + q.x) / 2) / this.W) * 100}%`;
    f.style.top = `${(((p.y + q.y) / 2) / this.H) * 100}%`;
    this.boardEl.append(f);
    setTimeout(() => f.remove(), 1600);
  }

  private updateGoal() {
    const g = this.script.goal;
    if (!g) {
      this.goalEl.hidden = true;
      return;
    }
    const def = GOALS[g];
    const total = this.totalPairs();
    const [have, need] = def.progress(this.run, total);
    const met = def.met(this.run, total);
    const lost = g === 'clean' && this.run.blockedTaps > 0;
    this.goalEl.hidden = false;
    this.goalEl.className = `demo__goal${met ? ' is-met' : ''}${lost ? ' is-lost' : ''}`;
    const prog = g === 'clean' ? (lost ? '×' : '✓') : g === 'combo' || g === 'bloom' ? `×${have}/${need}` : `${have}/${need}`;
    this.goalEl.innerHTML = `<span class="demo__goal-ico" aria-hidden="true">${ICONS.blossom}</span><b>${def.name}</b><span class="demo__goal-n">${prog}</span>`;
    this.goalEl.setAttribute('aria-label', `Goal: ${def.text}. ${met ? 'Met.' : `${have} of ${need}.`}`);
  }

  private totalPairs(): number {
    // Pairs on the script's starting board.
    let n = 0;
    for (const row of this.script.grid) for (const t of row.trim().split(/\s+/)) if (/^\d/.test(t)) n++;
    return n / 2;
  }

  // ── Ink ─────────────────────────────────────────────────────────────
  private mk(tag: string, attrs: Record<string, string | number>, cls?: string) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (cls) e.setAttribute('class', cls);
    return e;
  }

  /**
   * The game's ink-brush look, scaled to the mini board: a tapered body
   * revealed along the path by a mask, a soft wash under it, and a soak at
   * each end. Optionally numbers each bend as the brush reaches it.
   */
  private ink(P: { x: number; y: number }[], opts: { bends?: boolean } = {}) {
    const n = P.length;
    if (n < 2) return;
    const rm = reducedMotion();
    const f = (v: number) => v.toFixed(1);
    let L = 0;
    const at = [0];
    const dirs: { x: number; y: number }[] = [];
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y) || 1;
      dirs.push({ x: (P[i].x - P[i - 1].x) / d, y: (P[i].y - P[i - 1].y) / d });
      L += d;
      at.push(L);
    }
    const w = 13;
    const nrm = (d: { x: number; y: number }) => ({ x: -d.y, y: d.x });
    const miter = (i: number) => {
      if (i === 0) return nrm(dirs[0]);
      if (i === n - 1) return nrm(dirs[n - 2]);
      const a = nrm(dirs[i - 1]);
      const b = nrm(dirs[i]);
      const k = 1 + a.x * b.x + a.y * b.y;
      return k < 0.2 ? b : { x: (a.x + b.x) / k, y: (a.y + b.y) / k };
    };
    const widthAt = (s: number) => {
      const t = s / L;
      return w * (0.62 + 0.38 * Math.min(1, t / 0.08)) * (1 - 0.8 * Math.max(0, (t - 0.66) / 0.34) ** 1.3);
    };
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < n - 1; i++) {
      const steps = Math.max(2, Math.ceil((at[i + 1] - at[i]) / 8));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const m = k === 0 ? miter(i) : nrm(dirs[i]);
        const s = at[i] + (at[i + 1] - at[i]) * t;
        const x = P[i].x + (P[i + 1].x - P[i].x) * t;
        const y = P[i].y + (P[i + 1].y - P[i].y) * t;
        const hw = widthAt(s) / 2;
        left.push(`${f(x + m.x * hw)},${f(y + m.y * hw)}`);
        right.push(`${f(x - m.x * hw)},${f(y - m.y * hw)}`);
      }
    }
    const me = miter(n - 1);
    const he = widthAt(L) / 2;
    left.push(`${f(P[n - 1].x + me.x * he)},${f(P[n - 1].y + me.y * he)}`);
    right.push(`${f(P[n - 1].x - me.x * he)},${f(P[n - 1].y - me.y * he)}`);
    const body = `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
    const centre = P.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
    const id = `dink-${this.uid}-${++this.inkSeq}`;
    const g = this.mk('g', {}, `stroke${rm ? ' is-still' : ''}`);
    g.style.setProperty('--len', f(L + w * 3));
    const dash = `${f(L + w * 3)} ${f(L + w * 6)}`;
    const mask = this.mk('mask', { id, maskUnits: 'userSpaceOnUse', x: -60, y: -60, width: this.W + 120, height: this.H + 120 });
    mask.append(this.mk('polyline', { points: centre, 'stroke-width': f(w * 3), 'stroke-dasharray': dash }, 'ink-reveal'));
    g.append(mask);
    g.append(this.mk('polyline', { points: centre, 'stroke-width': f(w * 2.6), 'stroke-dasharray': dash }, 'ink-wash'));
    for (const [k, p] of [P[0], P[n - 1]].entries()) {
      const soak = this.mk('circle', { cx: f(p.x), cy: f(p.y), r: f(w * 1.8) }, 'ink-soak');
      if (k) soak.style.animationDelay = '300ms';
      g.append(soak);
    }
    const core = this.mk('g', { mask: `url(#${id})` }, 'ink-core');
    core.append(this.mk('path', { d: body }, 'ink-body'));
    g.append(core);
    if (opts.bends) {
      for (let i = 1; i < n - 1; i++) {
        const bend = this.mk('g', {}, 'ink-bend');
        bend.style.animationDelay = `${Math.round((360 * at[i]) / L)}ms`;
        // Outside of the corner.
        const o = { x: dirs[i - 1].x - dirs[i].x, y: dirs[i - 1].y - dirs[i].y };
        const ol = Math.hypot(o.x, o.y) || 1;
        const cx = P[i].x + (o.x / ol) * 30;
        const cy = P[i].y + (o.y / ol) * 30;
        bend.append(this.mk('circle', { cx: f(cx), cy: f(cy), r: 17 }));
        const t = this.mk('text', { x: f(cx), y: f(cy + 7.5), 'text-anchor': 'middle' });
        t.textContent = String(i);
        bend.append(t);
        g.append(bend);
      }
    }
    this.inkSvg.append(g);
    setTimeout(() => g.remove(), opts.bends ? 1500 : 1000);
  }

  /**
   * A would-be path in faint ink, crossed out where it fails: on the obstacle
   * for a blocked straight line, or on the stretch after a third bend (with the
   * bends numbered, the third in red).
   */
  private ghost(gh: Ghost) {
    const P = gh.pts.map((p) => ({ x: this.xOf(p.c), y: this.yOf(p.r) }));
    const f = (v: number) => v.toFixed(1);
    let L = 0;
    const seg: number[] = [];
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
      seg.push(d);
      L += d;
    }
    const n = P.length;
    let mx: number;
    let my: number;
    if (gh.why === 'bends' && n >= 3) {
      mx = (P[n - 2].x + P[n - 1].x) / 2;
      my = (P[n - 2].y + P[n - 1].y) / 2;
    } else {
      let s = L / 2;
      mx = P[0].x;
      my = P[0].y;
      for (let i = 0; i < seg.length; i++) {
        if (s <= seg[i]) {
          mx = P[i].x + ((P[i + 1].x - P[i].x) * s) / (seg[i] || 1);
          my = P[i].y + ((P[i + 1].y - P[i].y) * s) / (seg[i] || 1);
          break;
        }
        s -= seg[i];
      }
    }
    const g = this.mk('g', {}, `ghost${reducedMotion() ? ' is-still' : ''}`);
    g.style.setProperty('--len', f(L));
    g.append(this.mk('polyline', { points: P.map((p) => `${f(p.x)},${f(p.y)}`).join(' '), 'stroke-dasharray': `${f(L)} ${f(L)}` }, 'ghost__line'));
    if (gh.why === 'bends') {
      let at = 0;
      for (let i = 1; i < n - 1; i++) {
        at += seg[i - 1];
        const b = this.mk('g', {}, `ink-bend${i === 3 ? ' is-over' : ''}`);
        b.style.animationDelay = `${Math.round((520 * at) / L)}ms`;
        // Inside the board where possible, so the numbers never clip at the edge.
        const cx = Math.min(this.W - 20, Math.max(20, P[i].x));
        const cy = Math.min(this.H - 20, Math.max(20, P[i].y));
        b.append(this.mk('circle', { cx: f(cx), cy: f(cy), r: 17 }));
        const t = this.mk('text', { x: f(cx), y: f(cy + 7.5), 'text-anchor': 'middle' });
        t.textContent = String(i);
        b.append(t);
        g.append(b);
      }
    }
    const r = 24;
    g.append(this.mk('path', { d: `M${f(mx - r)},${f(my - r)} L${f(mx + r)},${f(my + r)} M${f(mx + r)},${f(my - r)} L${f(mx - r)},${f(my + r)}` }, 'ghost__x'));
    this.inkSvg.append(g);
    setTimeout(() => g.remove(), 1700);
  }

  // ── Your turn ───────────────────────────────────────────────────────
  /**
   * Hand the mini board to the player. For a script with fixed turn pairs the
   * board starts over; for `turn: 'any'` it stays as the demo left it.
   * Resolves when the player has made the pair(s).
   */
  async yourTurn(opts: TurnOptions = {}): Promise<void> {
    const any = this.script.turn === 'any';
    const ok = await this.guard(async (tok) => {
      this.hideBrush();
      if (!any) await this.reset(tok);
    });
    if (!ok) return new Promise(() => {});
    return new Promise<void>((done) => {
      this.turn = { expect: turnPairs(this.script), k: 0, sel: -1, busy: false, done, opts, hintTimer: 0 };
      this.el.classList.add('is-turn');
      this.setCaption('Your turn');
      this.boardEl.querySelectorAll<HTMLElement>('.demo__card').forEach((c) => (c.tabIndex = 0));
      this.armHint();
    });
  }

  /** The pair the player should make next (any legal one for 'any'). */
  private nextPair(): [number, number] | null {
    const t = this.turn;
    if (!t) return null;
    if (t.expect.length) return t.expect[t.k] ?? null;
    return findMove(this.run.state.board, lockedOf(this.run.state));
  }

  private armHint(now = false) {
    const t = this.turn;
    if (!t) return;
    clearTimeout(t.hintTimer);
    const glow = () => {
      if (this.turn !== t) return;
      this.boardEl.querySelectorAll('.is-hint').forEach((n) => n.classList.remove('is-hint'));
      for (const i of this.nextPair() ?? []) this.nodes.get(i)?.classList.add('is-hint');
    };
    const ms = now ? 0 : (t.opts.hintAfter ?? 2600);
    if (ms <= 0) glow();
    else t.hintTimer = window.setTimeout(glow, ms);
  }

  private async onTap(cell: number) {
    const t = this.turn;
    if (!t || t.busy || !this.nodes.has(cell)) return;
    unlockAudio();
    const st = this.run.state;
    const card = this.nodes.get(cell)!;
    if (!card.classList.contains('demo__card')) return;
    if (sealWaits(st.board, cell)) {
      const first = this.sealNudge(card);
      sfx.deselect();
      this.setCaption(`Seal ${first} first`);
      this.armHint(true);
      return;
    }
    if (st.hidden.has(cell) || st.knots.has(cell)) {
      retrigger(card, 'is-shake');
      retrigger(card.querySelector('.knot'), 'is-tug');
      sfx.deselect();
      this.setCaption('Clear beside it');
      this.armHint(true);
      return;
    }
    if (t.sel < 0) {
      t.sel = cell;
      this.select(cell, true);
      sfx.tap();
      haptic.light();
      return;
    }
    if (t.sel === cell) {
      this.select(cell, false);
      t.sel = -1;
      sfx.deselect();
      return;
    }
    const a = t.sel;
    const cells = st.board.cells;
    if (monthOf(cells[a]) !== monthOf(cells[cell])) {
      // A different flower just moves the selection, as in the game.
      this.select(a, false);
      this.select(cell, true);
      t.sel = cell;
      sfx.tap();
      return;
    }
    t.sel = -1;
    const why = pairProblem(st, a, cell);
    if (why === 'path') {
      this.select(a, false);
      this.run.blockedTaps++;
      this.updateGoal();
      sfx.miss();
      haptic.warn();
      this.setCaption(ghostPath(st.board, a, cell)?.why === 'bends' ? 'Too many bends' : 'Path blocked');
      t.busy = true;
      try {
        await this.blockedFx(a, cell, ghostPath(st.board, a, cell), this.tok);
      } catch {
        return;
      }
      t.busy = false;
      this.armHint(true);
      return;
    }
    const want = this.nextPair();
    if (t.expect.length && want && !((want[0] === a && want[1] === cell) || (want[1] === a && want[0] === cell))) {
      // A fine pair, but not the one this intro is about.
      this.select(a, false);
      for (const i of [a, cell]) retrigger(this.nodes.get(i), 'is-nudge');
      sfx.deselect();
      this.setCaption('This pair first');
      this.armHint(true);
      return;
    }
    clearTimeout(t.hintTimer);
    this.boardEl.querySelectorAll('.is-hint').forEach((n) => n.classList.remove('is-hint'));
    this.select(cell, true);
    const ev = this.run.pairUp(a, cell);
    t.k++;
    t.busy = true;
    sfx.match(Math.min(5, t.k + 1));
    haptic.medium();
    t.opts.onPair?.(t.k);
    try {
      await this.pairFx(ev, this.tok, true);
    } catch {
      return;
    }
    t.busy = false;
    const finished = t.expect.length ? t.k >= t.expect.length : true;
    if (finished) {
      this.turn = null;
      clearTimeout(t.hintTimer);
      this.el.classList.remove('is-turn');
      this.el.classList.add('is-solved');
      this.setCaption(PRAISE[(this.uid + t.k) % PRAISE.length]);
      haptic.success();
      t.done();
    } else {
      this.setCaption('Your turn');
      this.armHint();
    }
  }

  /** Stop everything (call when the player leaves the page). */
  destroy(): void {
    this.dead = true;
    this.cancel();
  }
}

/** A soft ink brush: bamboo handle, a brass ferrule, and a tip loaded with ink. */
const BRUSH_SVG = `<svg viewBox="0 0 40 132" aria-hidden="true">
  <path class="brush__handle" d="M16.5 2h7l1.4 74h-9.8z"/>
  <path class="brush__node" d="M16 24h8M15.6 50h8.8"/>
  <path class="brush__ferrule" d="M14.6 74h10.8l.8 10H13.8z"/>
  <path class="brush__hair" d="M13.8 84h12.4c1.4 12-1.6 30-6.2 46-4.6-16-7.6-34-6.2-46z"/>
  <path class="brush__ink" d="M15 104c2 0 8 0 10 0-1 9-3 17-5 26-2-9-4-17-5-26z"/>
</svg>`;
